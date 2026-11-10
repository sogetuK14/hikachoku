/* Saved-state inspection only. No application bootstrap, normalization, or writes. */
(() => {
  'use strict';
  const KEY = 'lifeArchiveData', DB = 'LifeArchiveDB', STORE = 'state', RECORD = 'main';
  const MAX_CHARS = 8 * 1048576, MAX_NODES = 250000, MAX_BYTES = 32 * 1048576, MAX_DEPTH = 128;
  const unavailable = reason => ({ available: false, reason });
  function listDatabases(signal) {
    return new Promise((resolve, reject) => {
      let ended = false;
      const finish = (error, value) => { if (ended) return; ended = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(value); };
      const abort = () => finish(Error('読み取りを中止しました'));
      const timer = setTimeout(() => finish(Error('DB存在確認が時間切れです')), 3000);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      try { indexedDB.databases().then(list => finish(null, list), () => finish(Error('DBの存在を確認できません'))); }
      catch { finish(Error('DBの存在を確認できません')); }
    });
  }
  function equalJson(a, b) {
    const stack = [[a, b, 0]]; let nodes = 0, bytes = 0;
    while (stack.length) {
      const [left, right, depth] = stack.pop();
      if (++nodes > MAX_NODES || depth > MAX_DEPTH || bytes > MAX_BYTES) throw Error('保存データの比較が安全上限を超えました');
      if (typeof left !== typeof right) return false;
      if (left === null || right === null) { if (left !== right) return false; continue; }
      if (typeof left !== 'object') {
        if (!['string', 'number', 'boolean'].includes(typeof left) || typeof left === 'number' && !Number.isFinite(left)) throw Error('JSONと比較できない型があります');
        if (!Object.is(left, right)) return false;
        if (typeof left === 'string') bytes += left.length * 2;
        continue;
      }
      if (Array.isArray(left) !== Array.isArray(right)) return false;
      if (!Array.isArray(left) && (Object.getPrototypeOf(left) !== Object.prototype || Object.getPrototypeOf(right) !== Object.prototype)) throw Error('JSONと比較できない型があります');
      const keys = Object.keys(left), other = Object.keys(right);
      if (keys.length !== other.length || Array.isArray(left) && left.length !== right.length) return false;
      for (const key of keys) {
        bytes += key.length * 2;
        const l = Object.getOwnPropertyDescriptor(left, key), r = Object.getOwnPropertyDescriptor(right, key);
        if (!r) return false;
        if (!Object.hasOwn(l, 'value') || !Object.hasOwn(r, 'value')) throw Error('アクセサー値は比較できません');
        stack.push([l.value, r.value, depth + 1]);
      }
    }
    if (bytes > MAX_BYTES) throw Error('保存データの比較が安全上限を超えました');
    return true;
  }
  function existingRecord(signal) {
    return new Promise((resolve, reject) => {
      let settled = false, database = null;
      const finish = (error, value) => {
        if (settled) return;
        settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
        database?.close(); error ? reject(error) : resolve(value);
      };
      const abort = () => finish(Error('読み取りを中止しました'));
      const timer = setTimeout(() => finish(Error('保存領域の読み取りが時間切れです')), 5000);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      // Called only after databases() confirmed existence. A deletion race must not create a DB.
      const request = indexedDB.open(DB);
      request.onupgradeneeded = () => { request.transaction.abort(); finish(Error('既存DBが見つかりません。新規作成せず中止しました')); };
      request.onerror = () => finish(Error('既存DBを読み取れません'));
      request.onblocked = () => finish(Error('既存DBの読み取りがブロックされました'));
      request.onsuccess = () => {
        database = request.result;
        if (settled) { database.close(); return; }
        database.onversionchange = () => { database.close(); finish(Error('保存領域の版が変化しました')); };
        if (!database.objectStoreNames.contains(STORE)) { finish(Error('既存のstateストアがありません')); return; }
        try {
          const transaction = database.transaction(STORE, 'readonly'), get = transaction.objectStore(STORE).get(RECORD);
          let value;
          get.onsuccess = () => { value = get.result; };
          transaction.oncomplete = () => finish(null, value);
          transaction.onabort = transaction.onerror = () => finish(Error('既存レコードを読み取れません'));
        } catch { finish(Error('既存ストアを読み取れません')); }
      };
    });
  }
  async function read(signal) {
    try {
      if (signal?.aborted) return unavailable('読み取りを中止しました');
      const raw = localStorage.getItem(KEY);
      if (raw === null) return unavailable('localStorageの保存済み本体がありません。比較不能です');
      if (raw.length > MAX_CHARS) return unavailable('localStorage本体が安全上限を超えるため比較しません');
      if (!globalThis.indexedDB || typeof indexedDB.databases !== 'function') return unavailable('既存DBの存在を確認できないため開きません');
      const list = await listDatabases(signal);
      if (!list.some(entry => entry.name === DB)) return unavailable('既存のLifeArchiveDBがありません。新規作成しません');
      const stored = await existingRecord(signal);
      if (signal?.aborted) return unavailable('読み取りを中止しました');
      if (localStorage.getItem(KEY) !== raw) return unavailable('読み取り中に保存データが変化しました');
      let local;
      try { local = JSON.parse(raw); } catch { return unavailable('localStorageのJSONが不正です。修復しません'); }
      if (!stored || !local || typeof local !== 'object' || Array.isArray(local) || !equalJson(local, stored)) return unavailable('localStorageとIndexedDBが一致しません。自動統合せず比較不能とします');
      const progress = Object.getOwnPropertyDescriptor(local, 'achievementProgress');
      if (!progress || !progress.value || typeof progress.value !== 'object' || Array.isArray(progress.value)) return unavailable('既存のachievementProgress形式を比較できません。初期化しません');
      return { available: true, progress: progress.value, token: raw, reason: '保存済みのlocalStorageとIndexedDB全体が一致（JSONの値・型・配列順序を比較）' };
    } catch (error) {
      return unavailable(error?.message || '保存領域を読み取れません。変更せず比較を保留します');
    }
  }
  Object.defineProperty(window, 'HikachokuAchievementPreviewReader', { value: Object.freeze({ read }), configurable: false, writable: false });
})();
