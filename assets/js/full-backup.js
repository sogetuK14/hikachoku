/* Additive, read-only full export. No application load/save/migration calls. */
(() => {
  'use strict';
  const FORMAT = 'hikachoku-full-backup', VERSION = 1;
  const SOURCE_SHA256 = '7FDBC842E98E1466BA182D5FA3EEEED73B24F86B5696C1C65AB9B2388FE52CA9';
  const MAX_FILE = 64 * 1024 * 1024, MAX_TOTAL = 256 * 1024 * 1024;
  const scope = /^(lifeArchive|life_archive_|hikachoku_|eorzeaArchive_|eorzea_)/;
  const dbScope = /^(LifeArchiveDB$|hikachoku_|life_archive_|eorzea_)/;
  const knownDBs = ['LifeArchiveDB', 'hikachoku_media_v1', 'hikachoku_activity_diary_media_v1'];
  const caches = new Set(['life_archive_craft_materials_v1', 'life_archive_craft_reverse_v1', 'life_archive_triad_npcs_v1', 'life_archive_guildleves_v8', 'life_archive_guildleves_v9_delivery_items']);
  const encoder = new TextEncoder();
  const fail = (area, error) => new Error(`${area}: ${error?.message || error}`);
  const json = value => JSON.stringify(value, null, 2);
  const bytes = value => encoder.encode(value);
  const hex = buffer => [...new Uint8Array(buffer)].map(n => n.toString(16).padStart(2, '0')).join('');
  async function sha(blob) {
    if (blob.size > MAX_FILE) throw fail('容量制限', '単一ファイルが64MiBを超えます。完全バックアップは生成していません。');
    return hex(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
  }
  const crcTable = Array.from({length: 256}, (_, n) => {
    for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  async function crc(blob) {
    let value = 0xffffffff;
    const reader = blob.stream().getReader();
    try { for (;;) { const part = await reader.read(); if (part.done) break; for (const n of part.value) value = crcTable[(value ^ n) & 255] ^ (value >>> 8); } }
    finally { reader.releaseLock(); }
    return (value ^ 0xffffffff) >>> 0;
  }
  function header(length, values) {
    const b = new Uint8Array(length), v = new DataView(b.buffer);
    for (const [offset, size, value] of values) size === 2 ? v.setUint16(offset, value, true) : v.setUint32(offset, value, true);
    return b;
  }
  function localSnapshot() {
    try {
      const result = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && scope.test(key)) result.push({key, value: localStorage.getItem(key), classification: caches.has(key) ? 'reacquirable-cache' : 'user-or-legacy-data'});
      }
      return result.sort((a, b) => a.key.localeCompare(b.key));
    } catch (e) { throw fail('localStorage', e); }
  }
  async function databaseList() {
    try {
      if (typeof indexedDB.databases !== 'function') throw new Error('既存DBを非作成で列挙できないブラウザーです。対応ブラウザーで実行してください。');
      return (await indexedDB.databases()).filter(d => d.name && dbScope.test(d.name)).sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) { throw fail('IndexedDB一覧', e); }
  }
  function account(value, budget) {
    const pending = [value], seen = new WeakSet();
    while (pending.length) {
      const item = pending.pop();
      if (typeof item === 'string') budget.bytes += item.length * 2;
      else if (item && typeof item === 'object' && !seen.has(item)) {
        seen.add(item);
        if (item instanceof Blob) budget.bytes += item.size;
        else if (item instanceof ArrayBuffer) budget.bytes += item.byteLength;
        else if (ArrayBuffer.isView(item)) budget.bytes += item.byteLength;
        else if (item instanceof Map) for (const [k,v] of item) pending.push(k,v);
        else if (item instanceof Set) for (const v of item) pending.push(v);
        else for (const key of Object.keys(item)) { budget.bytes += key.length * 2 + 16; pending.push(item[key]); }
      }
      if (budget.bytes > MAX_TOTAL) throw new Error('読取データが安全上のメモリー上限256MiBを超えます。処理を中止しました。');
    }
  }
  function readDatabase(info, budget) {
    return new Promise((resolve, reject) => {
      let request;
      try { request = indexedDB.open(info.name, info.version); }
      catch (e) { reject(fail(`IndexedDB/${info.name}`,e)); return; }
      let settled = false, db;
      const timer = setTimeout(() => finish(new Error('読み取りがタイムアウトしました')), 30000);
      function finish(error, result) {
        if (settled) return; settled = true; clearTimeout(timer); db?.close();
        error ? reject(fail(`IndexedDB/${info.name}`, error)) : resolve(result);
      }
      request.onupgradeneeded = () => { request.transaction.abort(); finish(new Error('DBが変更または削除されました。新規作成は中止しました')); };
      request.onerror = () => finish(request.error);
      request.onblocked = () => finish(new Error('別の画面がDBを使用中です'));
      request.onsuccess = () => {
        db = request.result;
        if (settled) { db.close(); return; }
        db.onversionchange = () => { finish(new Error('バックアップ中にDB構成が変わりました')); };
        const names = [...db.objectStoreNames].sort();
        const result = {name: db.name, version: db.version, stores: []};
        if (!names.length) return finish(null, result);
        try {
          const tx = db.transaction(names, 'readonly');
          tx.onabort = () => finish(tx.error || new Error('読み取りが中断されました'));
          tx.onerror = () => finish(tx.error || new Error('読み取りに失敗しました'));
          tx.oncomplete = () => finish(null, result);
          for (const name of names) {
            const store = tx.objectStore(name);
            const entry = {name, keyPath: store.keyPath, autoIncrement: store.autoIncrement, indexes: [...store.indexNames].map(n => {
              const index = store.index(n); return {name: n, keyPath: index.keyPath, unique: index.unique, multiEntry: index.multiEntry};
            }), records: []};
            result.stores.push(entry);
            const cursor = store.openCursor();
            cursor.onerror = () => finish(fail(name, cursor.error));
            cursor.onsuccess = () => {
              const row = cursor.result;
              if (row) try {
                if (++budget.records > 200000) throw new Error('安全上の上限20万レコードを超えます');
                const record = {key: row.primaryKey, value: row.value}; account(record, budget);
                entry.records.push(record); row.continue();
              } catch (e) { tx.abort(); finish(fail(name,e)); }
            };
          }
        } catch (e) { finish(e); }
      };
    });
  }
  async function capture() {
    // Waiting for already scheduled saves does not schedule a write of our own.
    try { if (typeof IDB_WRITE_CHAIN !== 'undefined') await IDB_WRITE_CHAIN; } catch (e) { throw fail('既存保存の完了待ち', e); }
    const local = localSnapshot(), listing = await databaseList(), databases = [];
    if (bytes(json(local)).length > MAX_FILE) throw fail('localStorage', '読取量が64MiBを超えます');
    const budget = {bytes:0, records:0}; account(local,budget);
    for (const info of listing) databases.push(await readDatabase(info,budget));
    let memory = null;
    try { if (typeof LIVE_DATA !== 'undefined' && LIVE_DATA !== null) { account(LIVE_DATA,budget); memory = structuredClone(LIVE_DATA); } }
    catch (e) { throw fail('メモリー上の本体データ', e); }
    if (json(local) !== json(localSnapshot()) || json(listing) !== json(await databaseList())) throw fail('保存領域の変更検知', '読み取り中に保存領域が変わりました。再実行してください。');
    return {local, databases, memory};
  }
  async function encodeSnapshot(snapshot) {
    const entries = [], binaries = [], objects = new WeakMap();
    let total = 0;
    async function add(path, blob, role) {
      if (blob.size > MAX_FILE || total + blob.size > MAX_TOTAL) throw fail(path, '安全上の容量制限（単一64MiB・合計256MiB）を超えます。省略したバックアップは生成しません。');
      total += blob.size;
      const entry = {path, blob, role, size: blob.size, sha256: await sha(blob), crc32: await crc(blob)};
      entries.push(entry); return entry;
    }
    async function encode(value) {
      if (value === undefined) return {t: 'undefined'};
      if (value === null || typeof value === 'string' || typeof value === 'boolean') return {t: 'value', v: value};
      if (typeof value === 'number') return {t: 'number', v: Object.is(value, -0) ? '-0' : String(value)};
      if (typeof value === 'bigint') return {t: 'bigint', v: String(value)};
      if (typeof value !== 'object') throw new Error('未対応の保存値です');
      if (objects.has(value)) return {t: 'ref', id: objects.get(value)};
      const id = encode.nextId++; objects.set(value, id);
      if (value instanceof Blob) {
        const extension = ({'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp','image/avif':'avif','video/mp4':'mp4','video/webm':'webm'})[value.type] || 'bin';
        const path = `binary/${String(binaries.length + 1).padStart(6, '0')}.${extension}`;
        await add(path, value, 'binary');
        const record = {t: value instanceof File ? 'file' : 'blob', id, path, mime: value.type, size: value.size};
        if (value instanceof File) Object.assign(record, {name: value.name, lastModified: value.lastModified});
        binaries.push(record); return record;
      }
      if (value instanceof Date) return {t: 'date', id, v: value.getTime()};
      if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
        const buffer = value instanceof ArrayBuffer ? value : value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
        const path = `binary/${String(binaries.length + 1).padStart(6, '0')}.bin`;
        await add(path, new Blob([buffer]), 'binary');
        const record = {t: 'buffer', id, kind: value.constructor.name, path, size: buffer.byteLength}; binaries.push(record); return record;
      }
      if (value instanceof Map) { const v = []; for (const [k, x] of value) v.push([await encode(k), await encode(x)]); return {t: 'map', id, v}; }
      if (value instanceof Set) { const v = []; for (const x of value) v.push(await encode(x)); return {t: 'set', id, v}; }
      if (value instanceof RegExp) return {t: 'regexp', id, source: value.source, flags: value.flags};
      if (Array.isArray(value)) { const v = []; for (let i = 0; i < value.length; i++) v.push(i in value ? await encode(value[i]) : {t:'hole'}); return {t: 'array', id, v}; }
      if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new Error(`未対応の保存値: ${value.constructor?.name}`);
      const v = []; for (const key of Object.keys(value)) v.push([key, await encode(value[key])]);
      return {t: 'object', id, v};
    }
    encode.nextId = 1;
    await add('localStorage.json', new Blob([json(snapshot.local)], {type:'application/json'}), 'localStorage');
    await add('memory.json', new Blob([json(await encode(snapshot.memory))], {type:'application/json'}), 'memory');
    const inventory = [];
    for (let i = 0; i < snapshot.databases.length; i++) {
      const db = snapshot.databases[i], path = `indexedDB/${String(i + 1).padStart(3, '0')}.json`;
      try { await add(path, new Blob([json(await encode(db))], {type:'application/json'}), 'indexedDB'); }
      catch (e) { throw fail(`IndexedDB/${db.name}`, e); }
      inventory.push({name: db.name, version: db.version, path, stores: db.stores.map(s => ({name: s.name, count: s.records.length, keyPath: s.keyPath, autoIncrement: s.autoIncrement, indexes: s.indexes}))});
    }
    return {entries, binaries, inventory, total};
  }
  function references(snapshot) {
    const checks = [], warnings = [];
    const media = snapshot.databases.find(d => d.name === 'hikachoku_media_v1');
    const images = media?.stores.find(s => s.name === 'images')?.records || [];
    const notesRecord = media?.stores.find(s => s.name === 'notes')?.records.find(r => r.key === 'all');
    const localNotes = snapshot.local.find(r => r.key === 'hikachoku_notes_media_v1');
    let legacyNotes = [];
    if (localNotes) try { legacyNotes = JSON.parse(localNotes.value); } catch { warnings.push('旧SSメモのJSONが不正です。元文字列は保存しました。'); }
    const checkImages = (notes, rows, area) => {
      if (!Array.isArray(notes)) return;
      const ids = new Map(rows.map(r => [String(r.value?.id ?? r.key), r.value]));
      for (const note of notes) for (const image of note.images || []) {
        const row = ids.get(String(image.id));
        checks.push({area, ownerId: note.id, imageId: image.id, valid: !!row && row.blob instanceof Blob});
      }
    };
    checkImages(notesRecord?.value?.notes, images, 'SSメモ/IndexedDB');
    checkImages(legacyNotes, images, 'SSメモ/localStorage');
    const diaryImages = snapshot.databases.find(d => d.name === 'hikachoku_activity_diary_media_v1')?.stores.find(s => s.name === 'images')?.records || [];
    const roots = [snapshot.memory];
    const main = snapshot.databases.find(d => d.name === 'LifeArchiveDB')?.stores.find(s => s.name === 'state')?.records.find(r => r.key === 'main');
    if (main) roots.push(main.value);
    const localMain = snapshot.local.find(r => r.key === 'lifeArchiveData');
    if (localMain) try { roots.push(JSON.parse(localMain.value)); } catch { warnings.push('localStorage本体のJSONが不正です。元文字列は保存しました。'); }
    for (const root of roots) checkImages(root?.activityDiary, diaryImages, '旧活動日記');
    for (const root of roots.filter(Boolean)) {
      const pages = new Set((root.wikiPages || []).map(p => String(p.id)));
      for (const page of root.wikiPages || []) if (page.parentId && !pages.has(String(page.parentId))) warnings.push(`既存の子ページ参照先がありません: ${page.id}`);
    }
    if (checks.some(c => !c.valid)) throw fail('画像参照の整合性', json(checks.filter(c => !c.valid)));
    return {checks, warnings};
  }
  async function makeZip(entries) {
    const parts = [], central = []; let offset = 0;
    for (const e of entries) {
      const name = bytes(e.path);
      const local = header(30, [[0,4,0x04034b50],[4,2,20],[6,2,0x800],[14,4,e.crc32],[18,4,e.size],[22,4,e.size],[26,2,name.length]]);
      parts.push(local, name, e.blob);
      const c = header(46, [[0,4,0x02014b50],[4,2,20],[6,2,20],[8,2,0x800],[16,4,e.crc32],[20,4,e.size],[24,4,e.size],[28,2,name.length],[42,4,offset]]);
      central.push(c, name); offset += local.length + name.length + e.size;
    }
    if (entries.length > 65535) throw fail('ZIP', 'ファイル数がZIP形式の制限を超えます');
    const centralBlob = new Blob(central);
    return new Blob([...parts, centralBlob, header(22, [[0,4,0x06054b50],[8,2,entries.length],[10,2,entries.length],[12,4,centralBlob.size],[16,4,offset]])], {type:'application/zip'});
  }
  async function verifyZip(blob, entries) {
    const end = new DataView(await blob.slice(-22).arrayBuffer());
    if (end.getUint32(0,true) !== 0x06054b50 || end.getUint16(10,true) !== entries.length) throw fail('ZIP検証', '終端・ファイル件数が一致しません');
    let centralOffset = end.getUint32(16,true), offset = 0;
    for (const e of entries) {
      const v = new DataView(await blob.slice(offset, offset + 30).arrayBuffer()), n = v.getUint16(26,true);
      const name = new TextDecoder().decode(await blob.slice(offset+30,offset+30+n).arrayBuffer());
      const c = new DataView(await blob.slice(centralOffset,centralOffset+46).arrayBuffer());
      if (v.getUint32(0,true)!==0x04034b50 || v.getUint16(8,true)!==0 || name!==e.path || v.getUint32(18,true)!==e.size || v.getUint32(14,true)!==e.crc32 || c.getUint32(0,true)!==0x02014b50 || c.getUint32(42,true)!==offset || c.getUint32(16,true)!==e.crc32 || c.getUint32(24,true)!==e.size) throw fail(`ZIP検証/${e.path}`, 'ヘッダーが一致しません');
      const data = blob.slice(offset+30+n,offset+30+n+e.size);
      if (await sha(data)!==e.sha256 || await crc(data)!==e.crc32) throw fail(`ZIP検証/${e.path}`, '内容のハッシュが一致しません');
      offset += 30+n+e.size; centralOffset += 46+n;
    }
    if (offset!==end.getUint32(16,true) || centralOffset!==blob.size-22) throw fail('ZIP検証', '領域サイズが一致しません');
  }
  async function build(progress = () => {}) {
    if (!crypto.subtle) throw fail('SHA-256', '安全な接続（HTTPSまたはlocalhost）が必要です');
    progress('保存領域を読み取っています。完了するまで他の画面で編集しないでください。');
    const startedAt = new Date().toISOString(), first = await capture();
    const relations = references(first), data = await encodeSnapshot(first);
    progress('再読み取りで元データの一致を確認しています…');
    const second = await encodeSnapshot(await capture());
    const fingerprints = result => json(result.entries.map(e => [e.path,e.size,e.sha256]));
    if (fingerprints(data)!==fingerprints(second)) throw fail('保存領域の変更検知', 'バックアップ中にデータが変わりました。編集やタイマーの更新が落ち着いてから再実行してください。');
    const manifest = {
      format:FORMAT, formatVersion:VERSION, sourceArchiveSha256:SOURCE_SHA256,
      startedAt, completedAt:new Date().toISOString(), timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,
      origin:location.origin, sourceUrl:location.href, encoding:'tagged-structured-clone-v1',
      localStorage:{path:'localStorage.json',count:first.local.length,rawStrings:true,keys:first.local.map(r=>({key:r.key,classification:r.classification}))},
      indexedDB:data.inventory, absentDatabases:knownDBs.filter(name=>!first.databases.some(d=>d.name===name)),
      memory:{path:'memory.json',present:first.memory!==null,authoritative:false},
      binaryCount:data.binaries.length, binaries:data.binaries, references:relations,
      referenceSchema:{
        wikiPages:'wikiPages[].parentId -> wikiPages[].id; blocks[].id remains stable; toggle.children recursively holds blocks; open/checked are preserved',
        legacyStacks:'stackDays[].parentId -> stackParents[].id; stackEntries[].dayId -> stackDays[].id',
        notes:'hikachoku_media_v1/notes[all].notes[].images[].id -> hikachoku_media_v1/images[].id; image.noteId -> note.id',
        activityDiary:'activityDiary[].images[].id -> hikachoku_activity_diary_media_v1/images[].id',
        achievements:'sourceAchievementId, achievementId, linkedAchievementIds -> achievementProgress keys / distributed achievement catalogue',
        videosAndGoals:'ffxivVideos[].goalId -> goals[].id; wikiPages[].legacyVideoId / legacyGoalId -> original records',
        typedValues:'IDs and reference tags are scoped to the whole snapshot, decoded in order memory.json then indexedDB files in manifest order'
      },
      files:data.entries.map(({path,size,sha256,crc32,role})=>({path,size,sha256,crc32,role})),
      consistency:{doubleReadMatched:true,zipPayloadVerification:'SHA-256 and CRC32; checked before download'},
      exclusions:['他アプリのlocalStorage・IndexedDB（指定プレフィックス以外）','sessionStorage（現行コードにユーザーデータ保存処理なし）','ブラウザーのCookie・HTTPキャッシュ・アプリ配布ファイル'],
      limits:{maxFileBytes:MAX_FILE,maxPayloadBytes:MAX_TOTAL},
      restoreImplemented:false
    };
    const readme = 'Hikachoku full backup v1\nNo restore operation is implemented. Keep this ZIP private.\nlocalStorage.json preserves exact source strings. memory.json and indexedDB/*.json use tagged-structured-clone-v1: object/array entries carry id; ref points to that id; binary paths resolve inside this ZIP; keys and values are both encoded. Database versions, stores and indexes are in manifest.json.\nAll scoped stores, including reacquirable caches (labelled separately), are preserved. Different main-store copies are retained separately; no merge or migration is performed.\nSHA-256 and CRC32 for all payload files are in manifest.json. manifest.json itself is checked during generation, but cannot contain its own hash.\nDownload initiation is not confirmation of a saved file. Verify the downloaded ZIP on your device.\n';
    for (const [path,text] of [['README.txt',readme],['manifest.json',null]]) {
      if (path === 'manifest.json') manifest.files = data.entries.map(({path,size,sha256,crc32,role})=>({path,size,sha256,crc32,role}));
      const blob = new Blob([text ?? json(manifest)]); data.entries.push({path,blob,size:blob.size,sha256:await sha(blob),crc32:await crc(blob),role:'metadata'});
    }
    progress('ZIPの件数と内容を検証しています…');
    const blob = await makeZip(data.entries); await verifyZip(blob,data.entries);
    const date = new Date(), pad = n=>String(n).padStart(2,'0');
    const filename = `hikachoku-full-backup-${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.zip`;
    return {blob,manifest,filename};
  }
  window.HikachokuFullBackup = Object.freeze({build,format:FORMAT,version:VERSION});
  // Navigation only: reuse the existing JSON exporter; never reveal legacyLaCompat.
  const openButton = document.getElementById('fullBackupOpen');
  const dialog = document.getElementById('fullBackupDialog');
  if (openButton && dialog) openButton.addEventListener('click', () => {
    if (!dialog.open) dialog.showModal();
  });
  const ordinaryButton = document.getElementById('fullBackupOrdinaryJSON');
  if (ordinaryButton) ordinaryButton.addEventListener('click', () => {
    try {
      if (typeof downloadStableBackup !== 'function') throw new Error('既存のJSON書き出しを利用できません。');
      downloadStableBackup();
    } catch (error) {
      const message = document.getElementById('fullBackupStatus');
      if (message) message.textContent = `通常JSONを書き出せませんでした。${error.message}`;
    }
  });
  const button = document.getElementById('fullBackupExport'), status = document.getElementById('fullBackupStatus');
  let downloadUrl;
  if (button && status) button.addEventListener('click', async () => {
    button.disabled = true;
    const prior = document.getElementById('fullBackupDownload'); prior?.remove();
    if (downloadUrl) { URL.revokeObjectURL(downloadUrl); downloadUrl = null; }
    try {
      const result = await build(message => { status.textContent = message; });
      downloadUrl = URL.createObjectURL(result.blob);
      const link = document.createElement('a'); link.id='fullBackupDownload'; link.href=downloadUrl; link.download=result.filename; link.textContent='生成済みZIPをダウンロード';
      status.after(link); link.click();
      const count = result.manifest.indexedDB.reduce((n,d)=>n+d.stores.reduce((m,s)=>m+s.count,0),0);
      status.textContent=`ZIP生成・内容検証が完了しました。localStorage ${result.manifest.localStorage.count}件、IndexedDB ${count}件、バイナリ ${result.manifest.binaryCount}件。ダウンロードを要求しましたが、端末への保存完了は確認できません。保存先のファイルを確認してください。${result.manifest.references.warnings.length ? ' 既存データの注意: '+result.manifest.references.warnings.join(' / ') : ''}`;
    } catch (e) { status.textContent=`完全バックアップを作成できませんでした。${e.message}`; }
    finally { button.disabled=false; }
  });
})();
