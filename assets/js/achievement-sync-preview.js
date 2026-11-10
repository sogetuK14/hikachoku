/* Ephemeral standalone preview. Reuses the prototype transport and ID matching. Never writes or calls application load/save. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const dialog = $('achievementPreviewDialog');
  if (!dialog || dialog.dataset.previewBound) return;
  dialog.dataset.previewBound = '1';
  const input = $('achievementPreviewCharacterId'), start = $('achievementPreviewStart');
  const status = $('achievementPreviewStatus'), result = $('achievementPreviewResult');
  const cancel = $('achievementPreviewCancel'), pages = $('achievementPreviewPagination');
  const MAX_BYTES = 2 * 1048576, MAX_IDS = 25000, MAX_LEGACY = 50000;
  const TIMEOUT_MS = 15000, COOLDOWN_MS = 30000, PAGE_SIZE = 50;
  let active = null, sequence = 0, nextAllowedAt = 0, ticker = null, displayed = null, pageIndex = 0;

  class PreviewError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  const fail = (code, message) => { throw new PreviewError(code, message); };
  function id(value) {
    if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
    return typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value) ? value : null;
  }
  function message(text, state) { status.textContent = text; status.dataset.state = state; }
  function buttons() {
    const wait = Math.max(0, Math.ceil((nextAllowedAt - Date.now()) / 1000));
    start.disabled = !!active || wait > 0;
    start.textContent = wait && !active ? `次の取得まで ${wait}秒` : '保存せずプレビュー';
    cancel.disabled = !active;
    if (!wait && ticker) { clearInterval(ticker); ticker = null; }
  }
  function tick() {
    if (ticker) clearInterval(ticker);
    ticker = setInterval(buttons, 1000);
    buttons();
  }
  function clearResult() { displayed = null; pageIndex = 0; result.replaceChildren(); pages.hidden = true; }
  function stop(text = '取得を中止しました。結果は保存していません。') {
    const run = active;
    active = null; sequence++;
    if (run) run.controller.abort();
    clearResult(); buttons(); message(text, 'cancelled');
  }
  function sameRun(run) {
    return active === run && sequence === run.sequence && input.value.trim() === run.targetId && dialog.isConnected && (dialog.dataset.standalone === 'true' || dialog.open);
  }
  function catalog() {
    if (typeof ACHIEVEMENT_DB === 'undefined' || !Array.isArray(ACHIEVEMENT_DB) || !ACHIEVEMENT_DB.length || ACHIEVEMENT_DB.length > MAX_IDS)
      fail('catalog', '既存カタログを安全に読み取れません。照合を中止しました。');
    const map = new Map();
    for (const row of ACHIEVEMENT_DB) {
      const key = id(row?.id);
      if (!key || typeof row.name !== 'string' || !row.name || map.has(key))
        fail('catalog', '既存カタログに不正または重複したゲームIDがあります。照合を中止しました。');
      map.set(key, row.name);
    }
    return map;
  }
  async function legacy(signal) {
    const reader = window.HikachokuAchievementPreviewReader;
    if (!reader) return { available: false, reason: '専用の読み取り処理がありません' };
    const source = await reader.read(signal);
    if (!source.available) return source;
    const raw = source.progress, keys = Object.keys(raw);
    if (keys.length > MAX_LEGACY) return { available: false, reason: '旧記録の件数が安全上限を超えています' };
    const records = new Map(); let invalid = 0;
    for (const key of keys) {
      const normalized = id(key);
      if (!normalized) { invalid++; continue; }
      const value = raw[key], field = value && typeof value === 'object' ? Object.getOwnPropertyDescriptor(value, 'done') : null;
      let state = '記録あり・達成値を判定できません';
      if (field && Object.hasOwn(field, 'value')) {
        if (field.value === true) state = '達成値あり（手動・同期混在）';
        else if (field.value === false) state = '未達成値あり（出所不明）';
      }
      records.set(normalized, state);
    }
    return { available: true, records, invalid, token: source.token, reason: source.reason,
      signature: JSON.stringify([invalid, [...records].sort((a, b) => a[0].localeCompare(b[0]))]) };
  }
  async function readJson(response) {
    if (!/\bapplication\/(?:json|[^;\s]+\+json)\b/i.test(response.headers.get('Content-Type') || ''))
      fail('format', 'JSON以外の応答です。ログイン画面や取得不能の可能性があります。');
    const length = Number(response.headers.get('Content-Length'));
    if (Number.isFinite(length) && length > MAX_BYTES) fail('capacity', '応答が安全上限2MiBを超えています。');
    if (!response.body?.getReader) fail('unsupported', 'このブラウザでは容量を制限した読み取りができません。');
    const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
    const chunks = []; let size = 0, ended = false;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) { ended = true; break; }
        size += chunk.value.byteLength;
        if (size > MAX_BYTES) fail('capacity', '応答が安全上限2MiBを超えています。');
        chunks.push(decoder.decode(chunk.value, { stream: true }));
      }
      chunks.push(decoder.decode());
      try { return JSON.parse(chunks.join('')); }
      catch { fail('format', 'JSONの形式が不正です。照合を中止しました。'); }
    } finally {
      if (!ended) await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  function parse(data, targetId) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || id(data.id) !== targetId)
      fail('identity', '応答のキャラクターIDが対象と一致しません。結果は破棄しました。');
    const a = data.achievements;
    if (!a || typeof a !== 'object' || Array.isArray(a)) fail('unavailable', 'アチーブメント情報を取得できません。未達成とは扱いません。');
    if (a.public === false) fail('private', 'アチーブメントは非公開です。旧記録は変更しません。');
    if (a.public !== true) fail('unavailable', '公開状態を確認できません。結果を利用しません。');
    if (!Array.isArray(a.ids)) fail('format', '達成ID一覧がありません。未達成とは扱いません。');
    if (a.ids.length > MAX_IDS) fail('capacity', '達成ID件数が安全上限25,000件を超えています。');
    const ids = new Set(), duplicates = [];
    for (const value of a.ids) {
      const key = id(value);
      if (!key) fail('id', '不正なAchievement IDがあります。名称による補完は行いません。');
      if (ids.has(key)) duplicates.push(key);
      ids.add(key);
    }
    if (duplicates.length) fail('duplicate', `達成IDが重複しています（${duplicates.length}件、例：${duplicates.slice(0, 5).join(', ')}）。照合を中止しました。`);
    if (!Number.isSafeInteger(a.count) || a.count < 0 || a.count !== ids.size)
      fail('incomplete', '達成件数とID一覧が一致しません。部分取得の可能性があるため中止しました。');
    return { ids, lastParsed: typeof data.last_parsed === 'string' ? data.last_parsed.slice(0, 80) : null };
  }
  function paragraph(text) { const p = document.createElement('p'); p.textContent = text; result.append(p); }
  function showRows() {
    if (!displayed) return;
    result.replaceChildren();
    const d = displayed;
    paragraph(`対象Lodestone ID：${d.targetId} ／ 取得日時：${d.observedAt}`);
    paragraph(`照合カタログ：${d.catalogVersion} ／ ${d.catalogCount}件（通信開始時に固定）`);
    paragraph(`FFXIV Collectの更新日時：${d.lastParsed || '不明（鮮度を保証できません）'}`);
    paragraph(`APIの達成ID ${d.received}件 ／ ゲームID照合一致 ${d.matched}件 ／ 未知のID ${d.unknown}件`);
    paragraph('一覧にないIDは「今回確認できない」と表示します。未達成の確定や、全履歴の完全性を保証する結果ではありません。');
    paragraph(d.comparisonNote);
    paragraph(d.comparisonAvailable ? `旧記録に達成値があり今回確認できないID：${d.legacyOnly}件。取得時に達成を観測し旧記録に達成値がないID：${d.remoteOnly}件。いずれも表示だけです。` : '旧記録との差分件数は算出していません。');
    if (d.invalidLegacy) paragraph(`旧記録の形式を照合できない項目：${d.invalidLegacy}件（変更せず保持）。`);
    const table = document.createElement('table'); table.style.width = '100%';
    const head = table.createTHead().insertRow();
    for (const text of ['ゲームID', '既存カタログ名', '今回の観測', 'キャラ未割当の旧記録']) { const th = document.createElement('th'); th.textContent = text; head.append(th); }
    const body = table.createTBody();
    for (const row of d.rows.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE)) {
      const tr = body.insertRow();
      for (const text of row) tr.insertCell().textContent = text;
    }
    result.append(table);
    const count = Math.max(1, Math.ceil(d.rows.length / PAGE_SIZE));
    pages.hidden = d.rows.length <= PAGE_SIZE;
    $('achievementPreviewPage').textContent = `${pageIndex + 1} / ${count}ページ`;
    $('achievementPreviewPrevious').disabled = pageIndex === 0;
    $('achievementPreviewNext').disabled = pageIndex + 1 >= count;
  }
  async function render(run, parsed) {
    const current = await legacy(run.controller.signal);
    if (!sameRun(run)) return;
    const validComparison = run.legacy?.available && current.available && run.legacy.signature === current.signature && run.legacy.token === current.token;
    const old = validComparison ? run.legacy.records : new Map();
    const keys = new Set([...parsed.ids, ...old.keys()]);
    const rows = []; let unknown = 0, legacyOnly = 0, remoteOnly = 0;
    for (const key of keys) {
      const seen = parsed.ids.has(key), done = old.get(key) === '達成値あり（手動・同期混在）';
      if (seen && !run.catalog.has(key)) unknown++;
      if (validComparison && done && !seen) legacyOnly++;
      if (validComparison && seen && !done) remoteOnly++;
      rows.push([key, run.catalog.get(key)?.slice(0, 300) || 'カタログ未収録・照合不能', seen ? 'Collectで達成を観測' : '今回確認できない', validComparison ? old.get(key) || '旧記録なし' : '比較保留']);
    }
    rows.sort((a, b) => a[0].length - b[0].length || a[0].localeCompare(b[0]));
    displayed = { targetId: run.targetId, observedAt: new Date().toISOString(), lastParsed: parsed.lastParsed, received: parsed.ids.size,
      matched: parsed.ids.size - unknown, unknown, rows, legacyOnly, remoteOnly, invalidLegacy: run.legacy?.available ? run.legacy.invalid : 0,
      comparisonAvailable: validComparison, catalogCount: run.catalog.size, catalogVersion: run.catalogVersion,
      comparisonNote: validComparison ? '比較基準：通信開始時の保存済みキャラ未割当レガシー記録。対象キャラの手動記録と同一とはみなしません。' : `旧記録との比較は保留です。${!run.legacy?.available ? run.legacy?.reason : !current.available ? current.reason : '通信中に保存済みデータが変化しました。'}` };
    pageIndex = 0; showRows();
    message(`取得結果のプレビュー${unknown ? '（未知のIDがあるため一部照合不能）' : ''}。対象ID：${run.targetId}。保存・変更はしていません。`, unknown ? 'partial' : 'ready');
  }
  async function preview() {
    if (active) return;
    if (Date.now() < nextAllowedAt) { buttons(); return; }
    const targetId = id(input.value.trim());
    clearResult();
    if (!targetId) { message('Lodestoneの数字IDを入力してください。URLや表示名、先頭0のIDは使えません。', 'invalid-input'); return; }
    let map;
    try { map = catalog(); } catch (error) { message(error.message, error.code || 'error'); return; }
    const run = { targetId, controller: new AbortController(), sequence: ++sequence, catalog: map, legacy: null, timedOut: false,
      catalogVersion: typeof ACHIEVEMENT_DATA_META !== 'undefined' ? String(ACHIEVEMENT_DATA_META.version || '不明') : dialog.dataset.catalogVersion || '不明' };
    active = run; nextAllowedAt = Date.now() + COOLDOWN_MS; tick();
    message(`対象Lodestone ID：${targetId} の公開情報を取得中…（保存しません）`, 'loading');
    const timeout = setTimeout(() => { run.timedOut = true; run.controller.abort(); }, TIMEOUT_MS);
    try {
      run.legacy = await legacy(run.controller.signal);
      if (!sameRun(run)) return;
      const response = await fetch(`https://ffxivcollect.com/api/characters/${encodeURIComponent(targetId)}?ids=1`, {
        method: 'GET', headers: { Accept: 'application/json' }, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: run.controller.signal
      });
      if (!sameRun(run)) return;
      if (response.status === 403) fail('private', 'キャラクターまたは対象情報が非公開・アクセス不可です。旧記録は変更しません。');
      if (response.status === 404) fail('not-found', 'FFXIV Collectで未登録、または対象を取得できません。未達成とは扱いません。');
      if (response.status === 429) {
        const retry = response.headers.get('Retry-After'), seconds = /^\d+$/.test(retry || '') ? Number(retry) : NaN;
        const when = Number.isFinite(seconds) ? Date.now() + seconds * 1000 : Date.parse(retry || '');
        if (Number.isFinite(when)) nextAllowedAt = Math.max(nextAllowedAt, Math.min(when, Date.now() + 86400000));
        fail('rate-limit', '取得元のアクセス制限です。自動再試行は行いません。時間を置いてください。');
      }
      if (!response.ok) fail('http-error', `取得元がHTTP ${response.status}を返しました。旧記録を保持して終了します。`);
      const data = await readJson(response);
      if (sameRun(run)) await render(run, parse(data, targetId));
    } catch (error) {
      if (sameRun(run)) { clearResult(); message(run.timedOut ? '15秒以内に取得できなかったため中止しました。保存はしていません。' : error instanceof PreviewError ? error.message : '通信または応答読み取りに失敗しました。取得不能として終了し、保存・変更しません。', run.timedOut ? 'timeout' : error.code || 'network-error'); }
    } finally {
      clearTimeout(timeout);
      run.controller.abort();
      if (active === run) { active = null; buttons(); }
    }
  }
  start.addEventListener('click', preview);
  cancel.addEventListener('click', () => stop());
  $('achievementPreviewClear').addEventListener('click', () => stop('プレビュー結果を破棄しました。保存はしていません。'));
  $('achievementPreviewClose').addEventListener('click', () => { stop('入力IDと結果を破棄しました。保存はしていません。'); input.value = ''; });
  input.addEventListener('input', () => stop('対象IDが変わったため、前の取得・結果を破棄しました。'));
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); preview(); } });
  for (const type of ['input', 'change']) dialog.addEventListener(type, event => event.stopPropagation());
  $('achievementPreviewPrevious').addEventListener('click', () => { if (displayed && pageIndex > 0) { pageIndex--; showRows(); } });
  $('achievementPreviewNext').addEventListener('click', () => { if (displayed && (pageIndex + 1) * PAGE_SIZE < displayed.rows.length) { pageIndex++; showRows(); } });
  window.addEventListener('pagehide', () => { if (active) active.controller.abort(); active = null; clearResult(); input.value = ''; if (ticker) clearInterval(ticker); ticker = null; });
  buttons();
})();
