/* Full backup v2. Export only. Source stores are never modified. */
(() => {
  'use strict';
  const FORMAT='hikachoku-full-backup',VERSION=2;
  const LIMITS={chunkBytes:1048576,maxEntryBytes:64*1048576,maxPayloadBytes:256*1048576,maxSourceEstimateBytes:192*1048576,maxNodes:1000000,maxEntries:60000,maxDepth:256,maxRecords:200000,maxDurationMs:180000};
  const scope=/^(lifeArchive|life_archive_|hikachoku_|eorzeaArchive_|eorzea_)/,dbScope=/^(LifeArchiveDB$|hikachoku_|life_archive_|eorzea_)/;
  const knownDBs=['LifeArchiveDB','hikachoku_media_v1','hikachoku_activity_diary_media_v1'];
  const caches=new Set(['life_archive_craft_materials_v1','life_archive_craft_reverse_v1','life_archive_triad_npcs_v1','life_archive_guildleves_v8','life_archive_guildleves_v9_delivery_items']);
  const utf8=new TextEncoder(),hex=b=>[...new Uint8Array(b)].map(n=>n.toString(16).padStart(2,'0')).join('');
  const fail=(area,e)=>new Error(`${area}: ${e?.message||e}`),pause=()=>new Promise(r=>setTimeout(r,0));
  const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
  async function digest(blob){return hex(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))}
  async function crc(blob){let n=0xffffffff;const r=blob.stream().getReader();try{for(;;){const x=await r.read();if(x.done)break;for(const v of x.value)n=crcTable[(n^v)&255]^(n>>>8)}}finally{r.releaseLock()}return(n^0xffffffff)>>>0}
  function header(size,fields){const b=new Uint8Array(size),v=new DataView(b.buffer);for(const[o,n,x]of fields)n===2?v.setUint16(o,x,true):v.setUint32(o,x,true);return b}
  function guard(run,depth=0){if(depth>LIMITS.maxDepth)throw fail('作業メモリー制限','階層が深すぎます');if(performance.now()-run.started>LIMITS.maxDurationMs)throw fail('処理時間制限','安全上の時間上限に達しました')}
  // Conservative per-source estimate, not a claim about the browser's actual heap.
  function sourceBudget(value,run){const seen=new WeakSet(),stack=[value];let size=0,nodes=0;while(stack.length){const x=stack.pop();if(typeof x==='string')size+=x.length*2;else if(x&&typeof x==='object'&&!seen.has(x)){seen.add(x);if(++nodes>LIMITS.maxNodes)throw fail('作業メモリー制限','単一ソースのオブジェクト数が上限を超えます');if(x instanceof Blob)size+=512;else if(x instanceof ArrayBuffer||ArrayBuffer.isView(x))size+=x.byteLength;else if(x instanceof Map)for(const[k,v]of x)stack.push(k,v);else if(x instanceof Set)for(const v of x)stack.push(v);else for(const k of Object.keys(x)){const d=Object.getOwnPropertyDescriptor(x,k);if(!d||!Object.hasOwn(d,'value'))throw fail('型情報','アクセサー値は安全に書き出せません');size+=k.length*2+24;stack.push(d.value)}}if(size>LIMITS.maxSourceEstimateBytes)throw fail('作業メモリー制限','単一ソースの読取見積が192MiBを超えます');if((nodes&4095)===0)guard(run)}run.maxSourceEstimate=Math.max(run.maxSourceEstimate,size)}
  class Sink{
    constructor(retain,progress){this.retain=retain;this.progress=progress;this.files=[];this.total=0;this.started=performance.now();this.maxSourceEstimate=0;this.records=0;this.serial=0;this.currentArea='開始';}
    async add(path,blob){guard(this);if(blob.size>LIMITS.maxEntryBytes)throw fail(path,'単一ファイル64MiBの安全上限を超えます');if(this.total+blob.size>LIMITS.maxPayloadBytes)throw fail(path,'全体256MiBの安全上限を超えます');if(this.files.length>=LIMITS.maxEntries)throw fail(path,'ZIPファイル数の安全上限を超えます');const entry={path,size:blob.size,sha256:await digest(blob),crc32:await crc(blob)};this.total+=blob.size;if(this.retain)entry.blob=blob;this.files.push(entry)}
  }
  class Parts{
    constructor(sink,prefix){this.sink=sink;this.prefix=prefix;this.paths=[];this.buffer=new Uint8Array(LIMITS.chunkBytes);this.used=0;this.size=0}
    async flush(){if(!this.used)return;const path=`${this.prefix}/${String(this.paths.length+1).padStart(6,'0')}.part`;await this.sink.add(path,new Blob([this.buffer.slice(0,this.used)]));this.paths.push(path);this.used=0;await pause()}
    async write(bytes){for(let i=0;i<bytes.length;){const n=Math.min(bytes.length-i,this.buffer.length-this.used);this.buffer.set(bytes.subarray(i,i+n),this.used);this.used+=n;this.size+=n;i+=n;if(this.used===this.buffer.length)await this.flush()}}
    async text(s){await this.write(utf8.encode(s))}
    async finish(){await this.flush();return {parts:this.paths,bytes:this.size}}
  }
  async function stringResource(value,sink,prefix){
    const parts=new Parts(sink,prefix);await parts.text('"');
    for(let i=0;i<value.length;){guard(sink);let end=Math.min(i+4096,value.length);if(end<value.length){const x=value.charCodeAt(end-1);if(x>=0xd800&&x<=0xdbff)end--}await parts.text(JSON.stringify(value.slice(i,end)).slice(1,-1));i=end}
    await parts.text('"');return {encoding:'json-string-utf8',...(await parts.finish())};
  }
  async function binaryResource(value,sink,prefix){const paths=[];for(let i=0;i<value.size;i+=LIMITS.chunkBytes){guard(sink);const path=`${prefix}/${String(paths.length+1).padStart(6,'0')}.part`;await sink.add(path,value.slice(i,Math.min(i+LIMITS.chunkBytes,value.size)));paths.push(path);await pause()}return {encoding:'raw',bytes:value.size,parts:paths}}
  async function graph(value,sink,unitId){
    sourceBudget(value,sink);const seen=new WeakMap(),events=new Parts(sink,`graphs/${unitId}`),resources=[];let nextId=1,nodeCount=0,operations=0;
    const emit=async row=>{await events.text(JSON.stringify(row)+'\n');if(++operations%2048===0){guard(sink);await pause()}};
    async function string(s){if(s.length<=4096)return ['s',s];const id=resources.length;resources.push(null);resources[id]=await stringResource(s,sink,`resources/${unitId}/${id}`);return ['S',id]}
    async function visit(x,depth=0){
      guard(sink,depth);
      if(x===null)return ['z'];if(x===undefined)return ['u'];
      if(typeof x==='string')return string(x);if(typeof x==='boolean')return ['b',x];
      if(typeof x==='number')return ['n',Object.is(x,-0)?'-0':String(x)];
      if(typeof x==='bigint')return ['i',await string(String(x))];
      if(typeof x!=='object')throw fail('型情報','未対応の保存値です');
      if(seen.has(x))return ['r',seen.get(x)];
      if(Object.getOwnPropertySymbols(x).length)throw fail('型情報','Symbolキーは安全に書き出せません');const id=nextId++;seen.set(x,id);if(++nodeCount>LIMITS.maxNodes)throw fail('作業メモリー制限','単一ソースのオブジェクト数が上限を超えます');
      if(x instanceof Blob){const resource=resources.length;resources.push(null);resources[resource]=await binaryResource(x,sink,`resources/${unitId}/${resource}`);await emit(x instanceof File?['file',id,resource,await string(x.type),await string(x.name),x.lastModified]:['blob',id,resource,await string(x.type)]);}
      else if(x instanceof ArrayBuffer){const resource=resources.length;resources.push(null);resources[resource]=await binaryResource(new Blob([x]),sink,`resources/${unitId}/${resource}`);await emit(['buffer',id,resource]);}
      else if(ArrayBuffer.isView(x)){const ref=await visit(x.buffer,depth+1);await emit(['view',id,x.constructor.name,ref,x.byteOffset,x instanceof DataView?x.byteLength:x.length]);}
      else if(x instanceof Date)await emit(['date',id,String(x.getTime())]);
      else if(x instanceof RegExp)await emit(['regexp',id,await string(x.source),x.flags,x.lastIndex]);
      else if(x instanceof Map){await emit(['map',id]);for(const[k,v]of x)await emit(['mapitem',id,await visit(k,depth+1),await visit(v,depth+1)]);}
      else if(x instanceof Set){await emit(['set',id]);for(const v of x)await emit(['setitem',id,await visit(v,depth+1)]);}
      else if(Array.isArray(x))await emit(['array',id,x.length]);
      else if(Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null)await emit(['object',id,Object.getPrototypeOf(x)===null]);
      else throw fail('型情報','未対応のオブジェクト型です。省略して出力しません');
      // Blob/File built-ins have no ordinary enumerable payload. Views' numeric keys
      // are already represented by the shared buffer, so do not duplicate them.
      for(const key of Object.keys(x)){
        if(ArrayBuffer.isView(x)&&/^(0|[1-9][0-9]*)$/.test(key))continue;
        const descriptor=Object.getOwnPropertyDescriptor(x,key);if(!descriptor||!Object.hasOwn(descriptor,'value'))throw fail('型情報','アクセサー値は安全に書き出せません');
        await emit(['prop',id,await string(key),await visit(descriptor.value,depth+1)]);
      }
      return ['r',id];
    }
    const root=await visit(value);const eventParts=await events.finish();return {encoding:'graph-events-v2',root,events:eventParts,resources,nodeCount};
  }
  function localKeys(){const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&scope.test(k))keys.push(k)}return keys.sort((a,b)=>a.localeCompare(b))}
  async function listDB(){if(typeof indexedDB.databases!=='function')throw fail('IndexedDB一覧','非作成でのDB列挙に対応していません');return (await indexedDB.databases()).filter(x=>x.name&&dbScope.test(x.name)).sort((a,b)=>a.name.localeCompare(b.name))}
  function openDB(info){return new Promise((resolve,reject)=>{let settled=false;let req;try{req=indexedDB.open(info.name,info.version)}catch(e){reject(fail(`IndexedDB/${info.name}`,e));return}const timer=setTimeout(()=>finish(new Error('読み取り開始のタイムアウト')),10000);function finish(e,db){if(settled){db?.close();return}settled=true;clearTimeout(timer);e?reject(fail(`IndexedDB/${info.name}`,e)):resolve(db)}req.onupgradeneeded=()=>{req.transaction.abort();finish(new Error('DB構成が変化しました。新規作成は中止しました'))};req.onerror=()=>finish(req.error);req.onblocked=()=>finish(new Error('DBが使用中です'));req.onsuccess=()=>finish(null,req.result)})}
  function read(db,store,make){return new Promise((resolve,reject)=>{let tx,req,result,timer;try{tx=db.transaction(store,'readonly');req=make(tx.objectStore(store));timer=setTimeout(()=>{try{tx.abort()}catch{}reject(fail(`IndexedDB/${db.name}/${store}`,'読み取りのタイムアウト'))},10000);req.onsuccess=()=>{const x=req.result;result=x&&typeof x.continue==='function'?{key:x.primaryKey,value:x.value}:x};tx.oncomplete=()=>{clearTimeout(timer);resolve(result)};tx.onerror=tx.onabort=()=>{clearTimeout(timer);reject(fail(`IndexedDB/${db.name}/${store}`,tx.error||'読み取りが中断されました'))}}catch(e){clearTimeout(timer);reject(fail(`IndexedDB/${db.name}/${store}`,e))}})}
  async function* rows(db,name){let last,first=true;for(;;){const row=await read(db,name,s=>s.openCursor(first?undefined:IDBKeyRange.lowerBound(last,true)));if(!row)break;first=false;last=row.key;yield row}}
  function imageRefs(notes,target){if(!Array.isArray(notes))return;for(const n of notes)for(const x of n?.images||[])target.add(String(x.id))}
  async function scan(sink){
    const units=[],databases=[],local=[],references={notes:new Set(),noteImages:new Set(),diary:new Set(),diaryImages:new Set()};
    const add=async(source,value)=>{const id=String(units.length+1).padStart(6,'0');sink.currentArea=source.kind==='indexedDB'?`IndexedDB/${source.database}/${source.store}`:source.kind;sink.progress(`${sink.currentArea} を読み取っています…`);try{units.push({id,source,graph:await graph(value,sink,id)})}catch(e){throw fail(sink.currentArea,e)}};
    try{if(typeof IDB_WRITE_CHAIN!=='undefined')await IDB_WRITE_CHAIN}catch(e){throw fail('既存保存の完了待ち',e)}
    const keys=localKeys();
    for(const key of keys){const value=localStorage.getItem(key);if(value===null)throw fail('localStorage','読み取り中にキーが消えました');local.push({key,classification:caches.has(key)?'reacquirable-cache':'user-or-legacy-data'});await add({kind:'localStorage',key},value);if(key==='hikachoku_notes_media_v1'){try{imageRefs(JSON.parse(value),references.notes)}catch{throw fail('SSメモ参照','旧メタデータを解析できません')}}if(key==='lifeArchiveData'){try{imageRefs(JSON.parse(value)?.activityDiary,references.diary)}catch{throw fail('本体参照','localStorage本体を解析できません')}}}
    const memoryPresent=typeof LIVE_DATA!=='undefined'&&LIVE_DATA!==null;
    if(memoryPresent){imageRefs(LIVE_DATA.activityDiary,references.diary);await add({kind:'memory',name:'LIVE_DATA',authoritative:false},LIVE_DATA)}
    const listing=await listDB();
    for(const info of listing){const db=await openDB(info);let changed=false;db.onversionchange=()=>{changed=true;db.close()};try{
      const meta={name:info.name,version:db.version,stores:[]};databases.push(meta);
      for(const name of [...db.objectStoreNames].sort()){
        const t=db.transaction(name,'readonly'),s=t.objectStore(name);
        const schema={name,keyPath:s.keyPath,autoIncrement:s.autoIncrement,indexes:[...s.indexNames].map(n=>{const x=s.index(n);return {name:n,keyPath:x.keyPath,unique:x.unique,multiEntry:x.multiEntry}}),count:0};meta.stores.push(schema);
        const expected=await read(db,name,s=>s.count());
        for await(const row of rows(db,name)){
          if(++sink.records>LIMITS.maxRecords)throw fail('レコード数制限','20万レコードの安全上限を超えます');
          if(info.name==='LifeArchiveDB'&&name==='state'&&row.key==='main')imageRefs(row.value?.activityDiary,references.diary);
          if(info.name==='hikachoku_media_v1'&&name==='notes')imageRefs(row.value?.notes,references.notes);
          if(info.name==='hikachoku_media_v1'&&name==='images'&&row.value?.blob instanceof Blob)references.noteImages.add(String(row.value.id??row.key));
          if(info.name==='hikachoku_activity_diary_media_v1'&&name==='images'&&row.value?.blob instanceof Blob)references.diaryImages.add(String(row.value.id??row.key));
          await add({kind:'indexedDB',database:info.name,store:name,ordinal:schema.count},row);schema.count++;await pause();
        }
        if(schema.count!==expected||await read(db,name,s=>s.count())!==expected)throw fail(`IndexedDB/${info.name}/${name}`,'読み取り中に件数が変わりました');
      }
      if(changed)throw fail(`IndexedDB/${info.name}`,'読み取り中にDB構成が変わりました');
    }catch(e){throw fail(`IndexedDB/${info.name}`,e)}finally{db.close()}}
    if(JSON.stringify(keys)!==JSON.stringify(localKeys())||JSON.stringify(listing)!==JSON.stringify(await listDB()))throw fail('途中変更','保存領域一覧が変わりました');
    if([...references.notes].some(id=>!references.noteImages.has(id))||[...references.diary].some(id=>!references.diaryImages.has(id)))throw fail('画像参照の整合性','参照先の画像を読み取れませんでした。完全バックアップは生成しません');
    return {units,localStorage:local,indexedDB:databases,memoryPresent,absentDatabases:knownDBs.filter(n=>!listing.some(d=>d.name===n)),referenceCheck:{noteReferences:references.notes.size,diaryReferences:references.diary.size,missingImages:0}};
  }
  async function zip(files){const parts=[],central=[];let offset=0;for(const e of files){const name=utf8.encode(e.path);const h=header(30,[[0,4,0x04034b50],[4,2,20],[6,2,0x800],[14,4,e.crc32],[18,4,e.size],[22,4,e.size],[26,2,name.length]]);parts.push(h,name,e.blob);central.push(header(46,[[0,4,0x02014b50],[4,2,20],[6,2,20],[8,2,0x800],[16,4,e.crc32],[20,4,e.size],[24,4,e.size],[28,2,name.length],[42,4,offset]]),name);offset+=30+name.length+e.size}const c=new Blob(central);return new Blob([...parts,c,header(22,[[0,4,0x06054b50],[8,2,files.length],[10,2,files.length],[12,4,c.size],[16,4,offset]])],{type:'application/zip'})}
  async function verifyZip(blob,files){const end=new DataView(await blob.slice(-22).arrayBuffer());if(end.getUint32(0,true)!==0x06054b50||end.getUint16(10,true)!==files.length)throw fail('ZIP検証','件数が一致しません');let p=0,c=end.getUint32(16,true);for(const e of files){const h=new DataView(await blob.slice(p,p+30).arrayBuffer()),n=h.getUint16(26,true),name=new TextDecoder().decode(await blob.slice(p+30,p+30+n).arrayBuffer()),central=new DataView(await blob.slice(c,c+46).arrayBuffer());if(h.getUint32(0,true)!==0x04034b50||h.getUint16(8,true)!==0||h.getUint32(18,true)!==e.size||h.getUint32(14,true)!==e.crc32||name!==e.path||central.getUint32(0,true)!==0x02014b50||central.getUint32(42,true)!==p||central.getUint32(24,true)!==e.size||central.getUint32(16,true)!==e.crc32)throw fail('ZIP検証','ヘッダーが一致しません');if(h.getUint32(22,true)!==e.size||central.getUint16(28,true)!==n||central.getUint16(10,true)!==0||central.getUint32(20,true)!==e.size||new TextDecoder().decode(await blob.slice(c+46,c+46+n).arrayBuffer())!==e.path)throw fail('ZIP検証','中央ディレクトリが一致しません');const data=blob.slice(p+30+n,p+30+n+e.size);if(await digest(data)!==e.sha256||await crc(data)!==e.crc32)throw fail('ZIP検証','内容が一致しません');p+=30+n+e.size;c+=46+n}if(p!==end.getUint32(16,true)||c!==blob.size-22)throw fail('ZIP検証','領域サイズが一致しません')}
  async function build(progress=()=>{}){
    if(!crypto.subtle)throw fail('SHA-256','HTTPS等の安全な接続が必要です');
    progress('完全バックアップv2を作成中です。別タブも含め編集を控えてください。');
    const first=new Sink(true,progress),snapshot=await scan(first);
    progress('保存領域を再読取して、途中変更を検証しています…');
    const second=new Sink(false,()=>{}),check=await scan(second);
    const inventory=s=>s.files.map(({blob,...x})=>x);
    if(JSON.stringify(snapshot)!==JSON.stringify(check)||JSON.stringify(inventory(first))!==JSON.stringify(inventory(second)))throw fail('途中変更','二度の読み取りが一致しません。編集を止めて再実行してください');
    const manifest={format:FORMAT,formatVersion:VERSION,encoding:'graph-events-v2',baseCommit:'0a8393ffb68d9c8efd8ace80129c63205858965d',createdAt:new Date().toISOString(),origin:location.origin,sourceURL:location.href,limits:LIMITS,workEstimate:{maxSingleSourceBytes:first.maxSourceEstimate,note:'元レコード等の概算。ブラウザー全体の実ヒープ上限保証ではありません。'},compression:'none',deduplication:'identity-within-source-only; different sources retained independently',...snapshot,files:inventory(first),consistency:{twoReadPassesMatched:true,zipVerification:'SHA-256 and CRC32 per part'},restoreImplemented:false,restoreNotes:['IndexedDBの内部autoIncrement採番カウンターはreadonly APIでは取得できません。現存レコードのキーとautoIncrement設定は保存します。'],exclusions:['他アプリの保存領域（対象プレフィックス外）','Cookie・HTTPキャッシュ・現行コードがユーザー情報を保存しないsessionStorage']};
    // Manifest is bounded separately and receives the same total/entry guards.
    const manifestBlob=new Blob([JSON.stringify(manifest)]);if(manifestBlob.size>8*1048576)throw fail('作業メモリー制限','マニフェストが8MiBの安全上限を超えます');
    await first.add('manifest.json',manifestBlob);
    await first.add('FORMAT.txt',new Blob([FORMAT_TEXT]));
    progress('ZIPの各分割ファイルを読み戻し、件数とハッシュを検証しています…');
    const blob=await zip(first.files);if(blob.size>LIMITS.maxPayloadBytes)throw fail('ZIP全体容量制限','ヘッダーを含むZIPが256MiBの安全上限を超えます');await verifyZip(blob,first.files);
    const d=new Date(),pad=n=>String(n).padStart(2,'0'),filename=`hikachoku-full-backup-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.zip`;
    return {blob,manifest,filename};
  }
  const FORMAT_TEXT=`Hikachoku full backup format 2. Export only; no restore UI.
Read manifest.json. Preserve all source units independently (localStorage raw string; memory root; indexedDB root with key and value). DB versions, stores, indexes, source ordinal and counts are recorded. Units and file parts are ordered arrays; never sort or omit them.
For each unit, concatenate graph.events.parts as UTF-8 JSON lines. Allocate all node IDs before assigning properties. Resource paths are per-unit ordered arrays. raw resources concatenate original bytes; json-string-utf8 resources concatenate UTF-8 JSON string syntax and JSON.parse recovers exact original UTF-16 including lone surrogates.
Tokens: [z]=null; [u]=undefined; [s,string]=small string; [S,resource]=large string; [b,bool]; [n,lexeme]=Number (including -0, NaN, Infinity); [i,string-token]=BigInt; [r,id]=node reference.
Definitions: [object,id,nullPrototype]; [array,id,length] (unassigned indices remain holes); [date,id,timeLexeme]; [regexp,id,sourceStringToken,flags,lastIndex]; [map,id]; [set,id]; [buffer,id,rawResource]; [view,id,constructorName,bufferRef,byteOffset,length]; [blob,id,rawResource,typeStringToken]; [file,id,rawResource,typeStringToken,nameStringToken,lastModified].
Events: [prop,id,keyStringToken,valueToken] (define own data property without prototype setters); [mapitem,id,keyToken,valueToken]; [setitem,id,valueToken]. Event order preserves property, map and set order. First allocate objects/arrays/maps/sets/dates/regex/buffers/blobs/files; then views referencing allocated buffers; then apply properties/map/set entries in event order. Root is a token. Node IDs are scoped to each unit. Buffers and views preserve shared backing and offsets. A graph may contain cycles.
Verify all manifest file sizes and SHA-256/CRC32 before reconstruction. ZIP CRC covers manifest.json and FORMAT.txt too (manifest cannot hash itself). No source data is overwritten, repaired, normalized or merged. ZIP is not encrypted. Download initiation is not confirmation of a saved file. Legacy capacity diagnostics still estimate v1, not v2. IndexedDB internal autoIncrement generator counters are not exposed by readonly APIs; existing keys and the autoIncrement setting are preserved, but the hidden next counter is not recoverable from this archive.
`;
  window.HikachokuFullBackup=Object.freeze({build,format:FORMAT,version:VERSION});
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
      status.textContent=`ZIP生成・内容検証が完了しました（形式v2）。localStorage ${result.manifest.localStorage.length}件、IndexedDB ${count}件、バイナリ ${result.manifest.units.reduce((n,u)=>n+u.graph.resources.filter(r=>r.encoding==='raw').length,0)}件。ダウンロードを要求しましたが、端末への保存完了は確認できません。保存先のファイルを確認してください。`;
    } catch (e) { status.textContent=`完全バックアップを作成できませんでした。${e.message}`; }
    finally { button.disabled=false; }
  });
})();
