
const LIFE_ARCHIVE_STABLE_KEY="life_archive_stable_data_v1";
function stableSaveSnapshot(data){
 try{
  const payload={savedAt:Date.now(),data:data};
  localStorage.setItem(LIFE_ARCHIVE_STABLE_KEY,JSON.stringify(payload));
 }catch(e){console.warn("stable snapshot save failed",e)}
}
function stableLoadSnapshot(){
 try{
  const raw=localStorage.getItem(LIFE_ARCHIVE_STABLE_KEY);
  if(!raw)return null;
  const p=JSON.parse(raw);
  return p&&p.data?p.data:null;
 }catch(e){console.warn("stable snapshot load failed",e);return null}
}
function stableMergeMissing(current,backup){
 if(!backup||typeof backup!=="object")return current;
 if(!current||typeof current!=="object")return backup;
 // Prefer current user edits, but restore missing/empty major data branches from stable storage.
 const out={...backup,...current};
 for(const k of Object.keys(backup)){
  const cv=current[k],bv=backup[k];
  if(cv==null || (Array.isArray(cv)&&cv.length===0&&Array.isArray(bv)&&bv.length) ||
     (typeof cv==="object"&&!Array.isArray(cv)&&cv&&Object.keys(cv).length===0 &&
      typeof bv==="object"&&!Array.isArray(bv)&&bv&&Object.keys(bv).length)){
    out[k]=bv;
  }
 }
 return out;
}

const RECOVERED_V09272={};

const KEY="lifeArchiveData", OLD="lifeArchive088", $=id=>document.getElementById(id);
function showLocalStorageGuard(){
  const box=$("localStorageWarning"), path=$("localStoragePath");
  if(!box)return;
  if(location.protocol==="file:"){
    box.style.display="block";
    if(path)path.textContent="現在のファイル: "+decodeURIComponent(location.pathname);
  }
}
showLocalStorageGuard();
const rules={
 "FF14":["ff14","エオルゼア","極","零式","討滅","レイド","アチーブ","ヌシ","釣り","幻海流","ジョブ","レベル","武器","ファントムウェポン","ミニオン","マウント","fate","ID","コンテンツ"],
 "TRPG":["trpg","卓","kp","skp","pl","シナリオ","セッション","探索者","クリティカル","ファンブル","決定的成功","スペシャル","coc"],
 "買い物":["買った","購入","買い物","円","売って","猫砂","スーパー","ドラッグストア"],
 "食事":["食べた","朝食","昼食","夕食","ごはん","コーヒー","牛乳","ヨーグルト","うどん","豚肉","卵"],
 "体調":["頭痛","痛い","眠い","息苦しい","体調","薬","生理","疲れ","だるい","熱"],
 "予定":["予定","明日","予約","固定","時から","行く","締切"]
};

/* ACHIEVEMENT_DB moved to assets/js/data/achievement_db.js */

const ACHIEVEMENT_DATA_META={
 version:"2026-08-07",
 label:"v0.94 初回正式データパック"
};
let achPage=1;
function base(){return {inbox:[],records:[],stackParents:[],stackDays:[],stackEntries:[],historyItems:[],historyEvents:[],toolChecklists:[],trpgAnalyses:[],people:[],characters:[],characterRelations:[],scenarioLibrary:[],quickCaptures:[],shopping:[],purchases:[],foodInventory:[],cookingRecipes:[],cookingHistory:[],achievements:[],achievementProgress:{},fishing:[],fishingProgress:{},craftingProgress:{},craftingPlan:{items:{},checks:{}},craftInventory:{},relicProgress:{},guildleveProgress:{},yokaiProgress:{},minionProgress:{},mountProgress:{},cardProgress:{},triadNpcProgress:{},weapons:[],ffProfile:{lodestoneId:"",profileUrl:"",lastFetchedAt:0,source:"",character:null,jobs:[],minionSync:{lastImportedAt:0,lodestoneTotal:0,matched:0,fileName:""},
ffxivCollect:{lastCatalogSyncAt:0,catalogs:{},sources:{}}},backupMeta:{lastExportAt:0,lastImportAt:0,lastExportSavedAt:0},settings:{guideUrl:"https://www.google.com/search?q={query}+FF14+攻略",youtubeUrl:"https://www.youtube.com/results?search_query={query}+FF14"},migrated:false}}
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(16).slice(2)}

function checklistItemName(item){
 if(item&&typeof item==="object")return String(item.name??item.text??item.label??"");
 return String(item??"");
}
function checklistToLines(items){
 return (Array.isArray(items)?items:[]).map(checklistItemName).filter(Boolean).join("\n");
}
function checklistFromLines(value,oldItems=[]){
 const old=Array.isArray(oldItems)?oldItems:[];
 return String(value||"").split(/\r?\n/).map(v=>v.trim()).filter(Boolean).map(name=>{
  const prev=old.find(i=>checklistItemName(i)===name);
  return {id:prev?.id||uid(),name,done:!!prev?.done};
 });
}

let LIVE_DATA=null;
const DB_NAME="LifeArchiveDB",DB_VERSION=1,DB_STORE="state",DB_KEY="main";
const AUTO_BACKUP_KEYS=["lifeArchiveData_backup_1","lifeArchiveData_backup_2","lifeArchiveData_backup_3","lifeArchiveData_backup_4","lifeArchiveData_backup_5"];
let IDB_WRITE_CHAIN=Promise.resolve();
const LEGACY_KEYS=["lifeArchive09295","lifeArchive09294","lifeArchive09293","lifeArchive09292","lifeArchive09291","lifeArchive0929","lifeArchive0928","lifeArchive09274","lifeArchive091"];

function setSaveStatus(text,ok=true){
 const el=$("saveStatus");if(!el)return;
 el.textContent=text;el.style.color=ok?"var(--green)":"var(--red)";
}
function hasUsefulData(d){
 return !!d&&(
  (Array.isArray(d.inbox)&&d.inbox.length)||
  (Array.isArray(d.records)&&d.records.length)||
  (Array.isArray(d.stackParents)&&d.stackParents.length)||
  (Array.isArray(d.purchases)&&d.purchases.length)||
  (d.achievementProgress&&Object.keys(d.achievementProgress).length)||
  (Array.isArray(d.weapons)&&d.weapons.length)||
  (Array.isArray(d.trpgAnalyses)&&d.trpgAnalyses.length)
 );
}
function normalizeData(d){
 const src=(d&&typeof d==="object")?d:{};
 const out={...base(),...src,migrated:true};
 const arrKeys=["inbox","records","stackParents","stackDays","stackEntries","historyItems","historyEvents","toolChecklists","trpgAnalyses","people","characters","characterRelations","scenarioLibrary","quickCaptures","shopping","purchases","foodInventory","cookingRecipes","cookingHistory","purchases","achievements","fishing","weapons"];
 for(const k of arrKeys)if(!Array.isArray(out[k]))out[k]=[];
 if(!out.achievementProgress||typeof out.achievementProgress!=="object"||Array.isArray(out.achievementProgress))out.achievementProgress={};
 if(!out.fishingProgress||typeof out.fishingProgress!=="object"||Array.isArray(out.fishingProgress))out.fishingProgress={};
 if(!out.craftingProgress||typeof out.craftingProgress!=="object"||Array.isArray(out.craftingProgress))out.craftingProgress={};
 if(!out.craftingPlan||typeof out.craftingPlan!=="object"||Array.isArray(out.craftingPlan))out.craftingPlan={items:{},checks:{}};
 if(!out.craftingPlan.items||typeof out.craftingPlan.items!=="object"||Array.isArray(out.craftingPlan.items))out.craftingPlan.items={};
 if(!out.craftingPlan.checks||typeof out.craftingPlan.checks!=="object"||Array.isArray(out.craftingPlan.checks))out.craftingPlan.checks={};
 if(!out.craftInventory||typeof out.craftInventory!=="object"||Array.isArray(out.craftInventory))out.craftInventory={};
 if(!out.relicProgress||typeof out.relicProgress!=="object"||Array.isArray(out.relicProgress))out.relicProgress={};
 if(!out.guildleveProgress||typeof out.guildleveProgress!=="object"||Array.isArray(out.guildleveProgress))out.guildleveProgress={};
 if(!out.yokaiProgress||typeof out.yokaiProgress!=="object"||Array.isArray(out.yokaiProgress))out.yokaiProgress={};
 if(!out.minionProgress||typeof out.minionProgress!=="object"||Array.isArray(out.minionProgress))out.minionProgress={};
 if(!out.mountProgress||typeof out.mountProgress!=="object"||Array.isArray(out.mountProgress))out.mountProgress={};
 if(!out.cardProgress||typeof out.cardProgress!=="object"||Array.isArray(out.cardProgress))out.cardProgress={};
 if(!out.triadNpcProgress||typeof out.triadNpcProgress!=="object"||Array.isArray(out.triadNpcProgress))out.triadNpcProgress={};
 if(!out.ffProfile||typeof out.ffProfile!=="object"||Array.isArray(out.ffProfile))out.ffProfile={lodestoneId:"",profileUrl:"",lastFetchedAt:0,source:"",character:null,jobs:[]};
 if(!Array.isArray(out.ffProfile.jobs))out.ffProfile.jobs=[];
 if(!out.ffProfile.minionSync||typeof out.ffProfile.minionSync!=="object")out.ffProfile.minionSync={lastImportedAt:0,lodestoneTotal:0,matched:0,fileName:""};
 if(!out.ffProfile.ffxivCollect||typeof out.ffProfile.ffxivCollect!=="object")out.ffProfile.ffxivCollect={lastCatalogSyncAt:0,catalogs:{},sources:{}};
 if(!out.ffProfile.ffxivCollect.catalogs||typeof out.ffProfile.ffxivCollect.catalogs!=="object")out.ffProfile.ffxivCollect.catalogs={};

 if(!out.backupMeta||typeof out.backupMeta!=="object"||Array.isArray(out.backupMeta))out.backupMeta={lastExportAt:0,lastImportAt:0,lastExportSavedAt:0};
 if(!out.settings||typeof out.settings!=="object"||Array.isArray(out.settings))out.settings={...base().settings};

 out.stackParents=out.stackParents.filter(Boolean).map((p,i)=>({
  ...p,
  id:p.id||uid(),
  name:String(p.name||p.title||`親ページ ${i+1}`),
  category:String(p.category||p.type||"その他"),
  role:String(p.role||""),
  tags:Array.isArray(p.tags)?p.tags:(typeof p.tags==="string"?p.tags.split(/[,、]/).map(v=>v.trim()).filter(Boolean):[]),
  participantLinks:Array.isArray(p.participantLinks)?p.participantLinks.map(x=>({
   personId:String(x?.personId||""),characterId:String(x?.characterId||""),role:String(x?.role||"PL")
  })).filter(x=>x.personId||x.characterId):[],
  status:p.status||"実施",
  time:Number(p.time||p.createdAt||Date.now()),
  createdAt:Number(p.createdAt||p.time||Date.now()),
  updatedAt:Number(p.updatedAt||p.createdAt||p.time||Date.now())
 }));
 out.people=out.people.filter(Boolean).map((p,i)=>({
  ...p,id:p.id||uid(),name:String(p.name||`人物 ${i+1}`),aliases:Array.isArray(p.aliases)?p.aliases:[],
  groups:Array.isArray(p.groups)?p.groups:[],memo:String(p.memo||""),createdAt:Number(p.createdAt||Date.now()),updatedAt:Number(p.updatedAt||p.createdAt||Date.now())
 }));
 out.characters=out.characters.filter(Boolean).map((c,i)=>({
  ...c,id:c.id||uid(),name:String(c.name||`PC ${i+1}`),personId:String(c.personId||""),
  systems:Array.isArray(c.systems)?c.systems:(String(c.system||"").trim()?[String(c.system||"").trim()]:[]),
  system:String(c.system||""),
  sheetUrl:String(c.sheetUrl||c.url||""),imageData:String(c.imageData||c.imageUrl||""),memo:String(c.memo||""),createdAt:Number(c.createdAt||Date.now()),updatedAt:Number(c.updatedAt||c.createdAt||Date.now())
 }));
 out.characterRelations=out.characterRelations.filter(Boolean).map(r=>({
  ...r,id:r.id||uid(),fromId:String(r.fromId||""),toId:String(r.toId||""),label:String(r.label||""),
  scenarioParentIds:Array.isArray(r.scenarioParentIds)?r.scenarioParentIds.filter(Boolean):(r.scenarioParentId?[String(r.scenarioParentId)]:[]),
  scenarioParentId:String(r.scenarioParentId||""),
  memo:String(r.memo||""),createdAt:Number(r.createdAt||Date.now()),updatedAt:Number(r.updatedAt||r.createdAt||Date.now())
 })).filter(r=>r.fromId&&r.toId);

 out.scenarioLibrary=out.scenarioLibrary.filter(Boolean).map((s,i)=>({
  ...s,id:s.id||uid(),title:String(s.title||`シナリオ ${i+1}`),
  systems:Array.isArray(s.systems)?s.systems:[],author:String(s.author||""),sourceUrl:String(s.sourceUrl||""),
  purchasedAt:Number(s.purchasedAt||0),players:String(s.players||""),playTime:String(s.playTime||""),
  status:String(s.status||"未通過"),tags:Array.isArray(s.tags)?s.tags:[],
  assets:(s.assets&&typeof s.assets==="object")?s.assets:{pdf:false,room:false,npc:false,bgm:false,ccfolia:false,other:false},
  storageUrl:String(s.storageUrl||""),memo:String(s.memo||""),linkedParentIds:Array.isArray(s.linkedParentIds)?s.linkedParentIds:[],
  createdAt:Number(s.createdAt||Date.now()),updatedAt:Number(s.updatedAt||s.createdAt||Date.now())
 }));
 out.quickCaptures=out.quickCaptures.filter(Boolean).map((q,i)=>({
  ...q,id:q.id||uid(),text:String(q.text||""),kind:String(q.kind||"記録"),
  tags:Array.isArray(q.tags)?q.tags:[],done:!!q.done,date:Number(q.date||q.createdAt||Date.now()),
  createdAt:Number(q.createdAt||Date.now()),updatedAt:Number(q.updatedAt||q.createdAt||Date.now())
 }));
 out.stackDays=out.stackDays.filter(Boolean).map((day,i)=>({
  ...day,
  id:day.id||uid(),
  parentId:day.parentId||day.stackParentId||"",
  order:Number.isFinite(Number(day.order))?Number(day.order):i+1,
  label:String(day.label||day.name||`${i+1}ページ目`),
  time:Number(day.time||day.createdAt||Date.now()),
  status:day.status||"実施",
  createdAt:Number(day.createdAt||day.time||Date.now())
 }));
 out.stackEntries=(Array.isArray(out.stackEntries)?out.stackEntries:[]).filter(Boolean).map((e)=>({
  ...e,
  tags:Array.isArray(e.tags)?e.tags:(typeof e.tags==="string"?e.tags.split(/[,、]/).map(v=>v.trim()).filter(Boolean):[]),
  checklist:Array.isArray(e.checklist)
   ? e.checklist.map(item=>{
      if(item&&typeof item==="object")return {...item,id:item.id||uid(),name:checklistItemName(item),done:!!item.done};
      return {id:uid(),name:checklistItemName(item),done:false};
     })
   : []
 }));
 return out;
}
function loadRaw(){
 if(LIVE_DATA)return LIVE_DATA;
 try{
  const saved=JSON.parse(localStorage.getItem(KEY)||"null");
  if(saved){LIVE_DATA=normalizeData(saved);return LIVE_DATA}
  for(const k of LEGACY_KEYS){
   const legacy=JSON.parse(localStorage.getItem(k)||"null");
   if(hasUsefulData(legacy)){LIVE_DATA=normalizeData(legacy);return LIVE_DATA}
  }
 }catch(e){}
 LIVE_DATA=normalizeData(base());
 return LIVE_DATA;
}
function load(){
 // 起動後はLIVE_DATAだけを正規データとして使う。
 // ページ移動のたびにlocalStorage/補助スナップショットを再合成しない。
 if(!LIVE_DATA)LIVE_DATA=loadRaw();
 return LIVE_DATA;
}
function openArchiveDB(){
 return new Promise((resolve,reject)=>{
  if(!("indexedDB" in window))return reject(new Error("IndexedDB unavailable"));
  const req=indexedDB.open(DB_NAME,DB_VERSION);
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE)};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
}
async function idbRead(){
 const db=await openArchiveDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(DB_STORE,"readonly"),req=tx.objectStore(DB_STORE).get(DB_KEY);
  req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
 });
}
async function idbWrite(data){
 const db=await openArchiveDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(DB_STORE,"readwrite");
  tx.objectStore(DB_STORE).put(data,DB_KEY);
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
 });
}
function rotateAutoBackups(){
 try{
  const current=localStorage.getItem(KEY);
  if(!current)return;
  const parsed=JSON.parse(current);
  if(!hasUsefulData(parsed))return;
  for(let i=AUTO_BACKUP_KEYS.length-1;i>0;i--){
   const prev=localStorage.getItem(AUTO_BACKUP_KEYS[i-1]);
   if(prev)localStorage.setItem(AUTO_BACKUP_KEYS[i],prev);
  }
  localStorage.setItem(AUTO_BACKUP_KEYS[0],current);
 }catch(e){}
}
async function persistData(data,{backup=false}={}){
 let localOK=false,idbOK=false;
 try{localStorage.setItem(KEY,JSON.stringify(data));localOK=true}catch(e){}
 try{await idbWrite(data);idbOK=true}catch(e){}
 const stamp=new Date().toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
 if(localOK||idbOK)setSaveStatus(`保存済み ${stamp}（${localOK&&idbOK?"二重保存":localOK?"ブラウザ保存":"IndexedDB"}）`,true);
 else setSaveStatus("⚠ 保存領域へ書き込めません。バックアップを書き出してください",false);
}
function save(d){
 LIVE_DATA=normalizeData(d);LIVE_DATA._savedAt=Date.now();
 const snapshot=structuredClone(LIVE_DATA);
 try{
  localStorage.setItem(KEY,JSON.stringify(snapshot));
  setSaveStatus("保存中…",true);
 }catch(e){setSaveStatus("⚠ ブラウザ保存に失敗。IndexedDBへ保存を試みます",false)}
 IDB_WRITE_CHAIN=IDB_WRITE_CHAIN.then(()=>idbWrite(snapshot)).then(()=>{
  const stamp=new Date().toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  setSaveStatus(`保存済み ${stamp}（二重保存）`,true);
 }).catch(()=>{
  const stamp=new Date().toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  setSaveStatus(`保存済み ${stamp}（ブラウザ保存）`,true);
 });
 stableSaveSnapshot(d);
}
function upgradeAutoStackPageLabels(d){
 let changed=false;
 const parents=d.stackParents||[],days=d.stackDays||[];
 for(const parent of parents){
  const own=days.filter(day=>day.parentId===parent.id).sort((a,b)=>(a.order||0)-(b.order||0));
  if(!own.length)continue;
  const allAuto=own.every((day,i)=>day.label===(i===0?"初日":`${i+1}日目`));
  if(!allAuto)continue;
  own.forEach((day,i)=>{day.label=`${i+1}ページ目`;changed=true});
 }
 return changed;
}

function clearLegacyAutoRecoveryMarker(){
 // v0.9333以降、過去バックアップは自動復元・自動統合しない。
 // バックアップ自体は手動復旧用として残す。
 return;
}
async function initializePersistentData(){
 setSaveStatus("保存データ確認中…",true);

 // localStorage と IndexedDB は「統合」せず、同じ保存データの二重保管として扱う。
 // どちらか片方が古くても、_savedAt が新しい方だけを正規データとして採用する。
 let local=null,idb=null;
 try{local=JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){}
 try{idb=await idbRead()}catch(e){}

 const localValid=!!local;
 const idbValid=!!idb;

 if(localValid||idbValid){
  const localStamp=Number(local?._savedAt||0);
  const idbStamp=Number(idb?._savedAt||0);

  let chosen=null,source="";
  const restorePending=localStorage.getItem("life_archive_restore_pending")==="1";
  if(restorePending&&idbValid){
   chosen=idb;source="バックアップ復元（IndexedDB）";
   try{localStorage.removeItem("life_archive_restore_pending")}catch(e){}
  }else if(localValid&&idbValid){
   if(idbStamp>localStamp){
    chosen=idb;source="IndexedDB（新しい保存）";
   }else{
    chosen=local;source="ブラウザ保存（新しい保存）";
   }
  }else if(localValid){
   chosen=local;source="ブラウザ保存";
  }else{
   chosen=idb;source="IndexedDB";
  }

  LIVE_DATA=normalizeData(chosen);
  upgradeAutoStackPageLabels(LIVE_DATA);

  // 選ばれた最新データを両方へ同期する。古いデータとのマージはしない。
  const snapshot=structuredClone(LIVE_DATA);
  try{localStorage.setItem(KEY,JSON.stringify(snapshot))}catch(e){}
  try{await idbWrite(snapshot)}catch(e){}

  setSaveStatus(`${source}を使用（親 ${(LIVE_DATA.stackParents||[]).length} ／ 子ページ ${(LIVE_DATA.stackDays||[]).length}）`,true);
  return;
 }

 // 完全初回のみ空データで開始。古い固定復旧データ・自動バックアップは採用しない。
 LIVE_DATA=normalizeData(base());
 LIVE_DATA._savedAt=Date.now();
 try{localStorage.setItem(KEY,JSON.stringify(LIVE_DATA))}catch(e){}
 try{await idbWrite(structuredClone(LIVE_DATA))}catch(e){}
 setSaveStatus("初期データで開始",true);
}

function isDirectImageUrl(url){return /\.(png|jpe?g|gif|webp|avif)(\?|#|$)/i.test(url||"")}
function mediaPreview(url){
 if(!url)return "";
 const safe=esc(url);
 if(isDirectImageUrl(url))return `<a href="${safe}" target="_blank" rel="noopener"><img src="${safe}" alt="添付画像" style="max-width:220px;max-height:150px;object-fit:cover;border-radius:10px;border:1px solid var(--line)" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span style="display:none" class="small">画像を直接表示できません。リンクから開いてください。</span></a>`;
 const isGoogle=/photos\.app\.goo\.gl|photos\.google\.com/i.test(url);
 return `<a class="card" style="display:block;text-decoration:none;color:var(--text);padding:12px" href="${safe}" target="_blank" rel="noopener"><b>${isGoogle?"Googleフォト":"添付リンク"}</b><div class="small">クリックして画像を開く</div></a>`;
}

function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function nl(v){return esc(v).replaceAll("\n","<br>")}
function fmt(ms){return new Date(ms).toLocaleString("ja-JP",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}
function localValue(ms=Date.now()){const d=new Date(ms),z=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`}
function toLocalInput(ms=Date.now()){return localValue(ms)}
function day(ms){const d=new Date(ms);return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`}

function statusClass(status){
 if(status==="取消")return "status-cancelled";
 if(status==="延期")return "status-postponed";
 if(status==="中止")return "status-stopped";
 return "";
}
function statusLabel(status){
 return {"実施":"○ 実施","完了":"● 完了","延期":"／ 延期","中止":"× 中止","取消":"~~ 取消"}[status]||"○ 実施";
}
function classify(text){
 const s=String(text).toLowerCase(),scores={};for(const [k,words] of Object.entries(rules)){scores[k]=words.reduce((n,w)=>n+(s.includes(w.toLowerCase())?1:0),0)}
 let type=Object.entries(scores).sort((a,b)=>b[1]-a[1])[0];if(!type||type[1]===0) return {type:"日常",scores};
 if(type[0]==="買い物"&&scores["食事"]>scores["買い物"])type=["食事",scores["食事"]];
 return {type:type[0],scores};
}
function migrate(){
 let d=load();if(d.migrated)return;
 try{const old=JSON.parse(localStorage.getItem(OLD)||"null");if(old){
  d.records=(old.records||[]).map(x=>({...x,id:x.id||uid(),category:x.type||"日常",status:x.status||"実施"}));
  d.inbox=(old.inbox||[]).map(x=>({...x,id:x.id||uid(),candidate:x.type||classify(x.text).type,status:x.status||"実施",done:!!x.archived}));
  d.shopping=old.shopping||[];d.purchases=old.stockHistory||[];d.achievements=old.achievements||[];d.fishing=old.fishing||[];d.weapons=old.weapons||[];
 }}catch(e){}
 d.migrated=true;save(d);
}
const BICOLOR_VENDORS=[
 ["漆黒","コルシア島","ズムット","X:11.8 Y:8.9"],["漆黒","アム・アレーン","ハルデン","X:10.6 Y:17.1"],["漆黒","レイクランド","スール＝メット","X:35.5 Y:20.6"],["漆黒","イル・メグ","スール＝ラド","X:16.0 Y:31.0"],["漆黒","ラケティカ大森林","ナシル","X:28.0 Y:18.0"],["漆黒","テンペスト","ゴウスィー・オーン","X:33.0 Y:18.0"],["漆黒","クリスタリウム","グラムソル","X:11.1 Y:13.6"],["漆黒","ユールモア","ペドロニール","X:11.0 Y:12.0"],
 ["暁月","ラヴィリンソス","フェーズブロース","X:29.9 Y:12.9"],["暁月","サベネア島","マーヴェーダ","X:25.8 Y:34.6"],["暁月","ガレマルド","ザワワ","X:12.9 Y:30.0"],["暁月","嘆きの海","トレーディングウェイ","X:21.8 Y:12.2"],["暁月","エルピス","アイサラ","X:24.4 Y:23.4"],["暁月","ウルティマ・トゥーレ","N-1499","X:30.8 Y:28.0"],["暁月","オールド・シャーレアン","ガドフリッド","X:12.7 Y:10.4"],["暁月","ラザハン","サジャリーン","X:11.1 Y:10.2"],
 ["黄金","オルコ・パチャ","テプリ","X:27.5 Y:11.7"],["黄金","コザマル・カ","クヌハリ","X:17.4 Y:11.0"],["黄金","ヤクテル樹海","ラル・ウルク","X:13.8 Y:12.7"],["黄金","シャーローニ荒野","ミテペ","X:28.6 Y:30.8"],["黄金","ヘリテージファウンド","トアシャナ","X:16.3 Y:9.6"],["黄金","リビング・メモリー","事務員PX-0029","X:22.0 Y:37.5"],["黄金","トライヨラ","カジェール・ジャ","X:12.8 Y:13.0"],["黄金","ソリューション・ナイン","ベリル","X:8.4 Y:14.0"]
].map(x=>({exp:x[0],zone:x[1],npc:x[2],xy:x[3]}));
const BICOLOR_ITEMS=[
 ["漆黒","コルシア島","マウント速度","コルシア島詳細地図",70,1],["漆黒","コルシア島","オーケストリオン譜","クイックウェイ ～コルシア島：夜～",350,2],["漆黒","コルシア島","オーケストリオン譜","分かたれし世界",350,3],
 ["漆黒","アム・アレーン","マウント速度","アム・アレーン詳細地図",70,1],["漆黒","アム・アレーン","オーケストリオン譜","鮮血の砂漠 ～アム・アレーン：夜～",350,2],["漆黒","アム・アレーン","ミニオン","ミクロ・ギガテンダー",400,3],["漆黒","アム・アレーン","オーケストリオン譜","琥珀の砂漠",350,3],
 ["暁月","サベネア島","マウント速度","サベネア島詳細地図",70,2],["暁月","サベネア島","オーケストリオン譜","神々の訓え",350,3],["暁月","サベネア島","オーケストリオン譜","人々の祈り",350,3],
 ["暁月","ラヴィリンソス","マウント速度","ラヴィリンソス詳細地図",70,2],["暁月","ラヴィリンソス","オーケストリオン譜","迷宮",350,3],["暁月","ラヴィリンソス","オーケストリオン譜","人の夢",350,3],
 ["暁月","ウルティマ・トゥーレ","マウント速度","ウルティマ・トゥーレ詳細地図",70,2],["暁月","ウルティマ・トゥーレ","ミニオン","プチイーア",500,3],["暁月","ウルティマ・トゥーレ","オーケストリオン譜","Close in the Distance",350,3],
 ["暁月","オールド・シャーレアン","交換券","バイカラージェム納品証",100,"全地域ランク3"],["暁月","オールド・シャーレアン","オーケストリオン譜","知恵の水瓶",350,"全地域ランク3"],["暁月","ラザハン","交換券","バイカラージェム納品証",100,"全地域ランク3"],["暁月","ラザハン","オーケストリオン譜","宵闇の露台",350,"全地域ランク3"],
 ["黄金","シャーローニ荒野","マウント速度","シャーローニ荒野詳細地図",90,2],["黄金","リビング・メモリー","マウント速度","リビング・メモリー詳細地図",90,2],["黄金","リビング・メモリー","家具","ネオキングダム・ランプポスト",150,3],["黄金","リビング・メモリー","オーケストリオン譜","過ぎ去りし安寧",450,4],["黄金","リビング・メモリー","オーケストリオン譜","記憶の残響",450,4],
 ["黄金","トライヨラ","交換券","トラルバイカラージェム納品証",100,"全地域ランク4"],["黄金","トライヨラ","オーケストリオン譜","金煌なる民",450,"全地域ランク4"],["黄金","トライヨラ","オーケストリオン譜","金煌なる魔法",450,"全地域ランク4"],["黄金","ソリューション・ナイン","交換券","トラルバイカラージェム納品証",100,"全地域ランク4"],["黄金","ソリューション・ナイン","家具","ヴェンディングマシン・ナイン",150,"全地域ランク4"],["黄金","ソリューション・ナイン","オーケストリオン譜","星なき摩天楼",450,"全地域ランク4"]
].map((x,i)=>({id:`bg_${i+1}`,exp:x[0],zone:x[1],type:x[2],name:x[3],cost:x[4],rank:x[5]}));
const BICOLOR_ORCHESTRION_SOURCE_NAMES={
 "クイックウェイ ～コルシア島：夜～":"The Quick Way",
 "分かたれし世界":"A World Divided",
 "鮮血の砂漠 ～アム・アレーン：夜～":"Sands of Blood",
 "琥珀の砂漠":"Sands of Amber",
 "神々の訓え":"Divine Words",
 "人々の祈り":"Prayers Repeated",
 "迷宮":"The Labyrinth",
 "人の夢":"Dreams of Man",
 "知恵の水瓶":"The Ewer Brimmeth",
 "宵闇の露台":"Twilit Terraces",
 "過ぎ去りし安寧":"Bygone Serenity",
 "記憶の残響":"Echoes of Memory",
 "金煌なる民":"Morrow's Might",
 "金煌なる魔法":"Morrow's Magic",
 "星なき摩天楼":"Starless Skyline"
};
BICOLOR_ITEMS.push(
 {id:"bg_zone_shb_lakeland_map",exp:"漆黒",zone:"レイクランド",type:"マウント速度",name:"レイクランド詳細地図",cost:70,rank:1},
 {id:"bg_zone_shb_ilmeg_map",exp:"漆黒",zone:"イル・メグ",type:"マウント速度",name:"イル・メグ詳細地図",cost:70,rank:1},
 {id:"bg_zone_shb_raktika_map",exp:"漆黒",zone:"ラケティカ大森林",type:"マウント速度",name:"ラケティカ大森林詳細地図",cost:70,rank:1},
 {id:"bg_zone_shb_tempest_map",exp:"漆黒",zone:"テンペスト",type:"マウント速度",name:"テンペスト詳細地図",cost:70,rank:1},
 {id:"bg_zone_ew_garlemald_map",exp:"暁月",zone:"ガレマルド",type:"マウント速度",name:"ガレマルド詳細地図",cost:70,rank:2},
 {id:"bg_zone_ew_mare_map",exp:"暁月",zone:"嘆きの海",type:"マウント速度",name:"嘆きの海詳細地図",cost:70,rank:2},
 {id:"bg_zone_ew_elpis_map",exp:"暁月",zone:"エルピス",type:"マウント速度",name:"エルピス詳細地図",cost:70,rank:2},
 {id:"bg_zone_dt_urqopacha_map",exp:"黄金",zone:"オルコ・パチャ",type:"マウント速度",name:"オルコ・パチャ詳細地図",cost:90,rank:2},
 {id:"bg_zone_dt_kozama_map",exp:"黄金",zone:"コザマル・カ",type:"マウント速度",name:"コザマル・カ詳細地図",cost:90,rank:2},
 {id:"bg_zone_dt_yaktel_map",exp:"黄金",zone:"ヤクテル樹海",type:"マウント速度",name:"ヤクテル樹海詳細地図",cost:90,rank:2},
 {id:"bg_zone_dt_heritage_map",exp:"黄金",zone:"ヘリテージファウンド",type:"マウント速度",name:"ヘリテージファウンド詳細地図",cost:90,rank:2}
);
function bicolorRoot(d){d.bicolor=d.bicolor||{owned:{},currentGem:0};d.bicolor.owned=d.bicolor.owned||{};return d.bicolor}
function bicolorVendor(x){return BICOLOR_VENDORS.find(v=>v.exp===x.exp&&v.zone===x.zone)||{}}
function renderBicolor(){
 const box=$("bicolorList");if(!box)return;
 const d=load(),root=bicolorRoot(d),exp=$("bicolorExpansion")?.value||"",status=$("bicolorStatus")?.value||"all",type=$("bicolorType")?.value||"",q=($("bicolorSearch")?.value||"").trim().toLowerCase();
 const zones=[...new Set(BICOLOR_VENDORS.filter(x=>!exp||x.exp===exp).map(x=>x.zone))],zs=$("bicolorZone"),oldZone=zs?.value||"";
 if(zs){zs.innerHTML='<option value="">すべて</option>'+zones.map(z=>`<option value="${esc(z)}">${esc(z)}</option>`).join("");if(zones.includes(oldZone))zs.value=oldZone}
 const zone=zs?.value||"";if($("bicolorCurrentGem"))$("bicolorCurrentGem").value=root.currentGem||"";
 const items=BICOLOR_ITEMS.filter(x=>{const owned=!!root.owned[x.id]?.done,v=bicolorVendor(x),hay=[x.name,x.sourceName,x.zone,x.type,v.npc].join(" ").toLowerCase();return(!exp||x.exp===exp)&&(!zone||x.zone===zone)&&(!type||x.type===type)&&(!q||hay.includes(q))&&(status==="all"||(status==="owned"&&owned)||(status==="missing"&&!owned))});
 const missing=BICOLOR_ITEMS.filter(x=>!root.owned[x.id]?.done),need=missing.reduce((s,x)=>s+Number(x.cost),0),cur=Number(root.currentGem||0);
 $("bicolorSummary").textContent=`収録 ${BICOLOR_ITEMS.length}件 ／ 未交換 ${missing.length}件 ／ 必要 ${need.toLocaleString("ja-JP")}ジェム ／ 現在 ${cur.toLocaleString("ja-JP")} ／ あと ${Math.max(0,need-cur).toLocaleString("ja-JP")}`;
 box.innerHTML=items.length?items.map(x=>{const st=root.owned[x.id]||{},v=bicolorVendor(x);return `<div class="card ${st.done?"archived":""}"><div class="row"><div><label style="margin:0;color:var(--text)"><input type="checkbox" class="bicolorCheck" data-id="${x.id}" style="width:auto" ${st.done?"checked":""}> <b>${esc(x.name)}</b></label><div class="time">${esc(x.exp)} ／ ${esc(x.zone)} ／ ${esc(x.type)} ／ ${x.cost} 💎 ／ 解放 ${esc(x.rank)}${x.sourceName&&x.sourceName!==x.name?` ／ 原題：${esc(x.sourceName)}`:""}</div></div><span class="badge">${esc(v.npc||"")}</span></div><div class="small">📍 ${esc(x.zone)} ${esc(v.xy||"")} ／ ${esc(v.npc||"")}${st.doneAt?`<br>交換日：${new Date(st.doneAt).toLocaleDateString("ja-JP")}`:""}</div><input class="bicolorMemo" data-id="${x.id}" value="${esc(st.memo||"")}" placeholder="自分用メモ" style="margin-top:8px"></div>`}).join(""):'<div class="empty">このエリアの収録交換品はまだありません。交換NPC・エリア情報は登録済みです。</div>';
 document.querySelectorAll(".bicolorCheck").forEach(el=>el.onchange=()=>{const d=load(),r=bicolorRoot(d),st=r.owned[el.dataset.id]||{};st.done=el.checked;st.doneAt=el.checked?Date.now():0;r.owned[el.dataset.id]=st;save(d);renderBicolor();renderDateArchive()});
 document.querySelectorAll(".bicolorMemo").forEach(el=>el.onchange=()=>{const d=load(),r=bicolorRoot(d),st=r.owned[el.dataset.id]||{};st.memo=el.value;r.owned[el.dataset.id]=st;save(d)});
}

let damageGear=[];

const XIVAPI_V2="https://v2.xivapi.com/api";
function xivFieldValue(v){
 if(v==null)return 0;
 if(typeof v==="number"||typeof v==="string")return v;
 if(typeof v==="object"){
  if("value" in v&&v.value!=null)return v.value;
  if(v.fields&&"Value" in v.fields)return v.fields.Value;
 }
 return 0;
}
function xivRelName(v){
 if(!v)return"";
 if(typeof v==="string")return v;
 return v.fields?.Name||v.Name||"";
}
function xivBaseParams(fields){
 const names=Array.isArray(fields.BaseParam)?fields.BaseParam:[];
 const vals=Array.isArray(fields.BaseParamValue)?fields.BaseParamValue:[];
 const out={};
 names.forEach((bp,i)=>{
  const name=xivRelName(bp);
  const val=Number(xivFieldValue(vals[i])||0);
  if(name&&val)out[name]=(out[name]||0)+val;
 });
 return out;
}
function xivPickParam(map,names){
 for(const n of names)if(map[n]!=null)return Number(map[n]||0);
 return 0;
}
function xivItemToGear(row){
 const f=row?.fields||{},bp=xivBaseParams(f);
 const category=xivRelName(f.ItemUICategory);
 const slot=xivRelName(f.EquipSlotCategory);
 const isWeapon=/Arm|Weapon|武器|斧|剣|槍|弓|杖|刀|銃|本|天球|武具|両手斧/i.test(category);
 return {
  xivapiId:row.row_id||row.rowId||0,
  name:f.Name||"",
  ilvl:Number(xivFieldValue(f.LevelItem)||0),
  wd:Number(xivFieldValue(f.DamagePhys)||xivFieldValue(f.DamageMag)||0),
  str:xivPickParam(bp,["Strength","STR","力"]),
  vit:xivPickParam(bp,["Vitality","VIT","ＶＩＴ","耐久力"]),
  crit:xivPickParam(bp,["Critical Hit","Critical Hit Rate","クリティカル"]),
  det:xivPickParam(bp,["Determination","意思力"]),
  dh:xivPickParam(bp,["Direct Hit Rate","Direct Hit","ダイレクトヒット"]),
  sks:xivPickParam(bp,["Skill Speed","スキルスピード"]),
  ten:xivPickParam(bp,["Tenacity","不屈"]),
  category,slot,isWeapon
 };
}
function guessGearSlot(g){
 const s=(g.slot+" "+g.category).toLowerCase();
 if(g.isWeapon)return"武器";
 if(/head|頭/.test(s))return"頭";if(/body|chest|胴/.test(s))return"胴";if(/hands|hand|手/.test(s))return"手";
 if(/legs|leg|脚/.test(s))return"脚";if(/feet|foot|足/.test(s))return"足";if(/ear|耳/.test(s))return"耳";
 if(/neck|首/.test(s))return"首";if(/wrist|bracelet|腕/.test(s))return"腕";if(/finger|ring|指/.test(s))return"指輪1";
 return $("dmgGearSlot")?.value||"武器";
}
function normalizedGearSlotLabel(s){
 const x=String(s||"").toLowerCase();
 if(/weapon|arm|両手斧|片手斧|斧|武器|sword|axe|spear|bow|gun|rod|book|blade/.test(x))return"武器";
 if(/head|頭/.test(x))return"頭";
 if(/body|chest|胴/.test(x))return"胴";
 if(/hands|hand|手/.test(x))return"手";
 if(/legs|leg|脚/.test(x))return"脚";
 if(/feet|foot|足/.test(x))return"足";
 if(/ear|耳/.test(x))return"耳";
 if(/neck|首/.test(x))return"首";
 if(/wrist|bracelet|腕/.test(x))return"腕";
 if(/finger|ring|指/.test(x))return"指輪";
 return"";
}
function resultMatchesGearSlot(row,slot){
 const f=row?.fields||{},text=[xivRelName(f.EquipSlotCategory),xivRelName(f.ItemUICategory)].join(" ");
 const detected=normalizedGearSlotLabel(text);
 if(slot==="指輪")return detected==="指輪";
 return detected===slot;
}
async function searchXivGear(){
 const q=$("dmgGearSearch").value.trim(),slot=$("dmgGearSearchSlot")?.value||"武器";if(!q)return alert("装備名を入力してください。");
 $("dmgGearSearchStatus").textContent=`${slot}を検索中…`;$("dmgGearSearchResults").innerHTML="";
 try{
  const query=encodeURIComponent(`Name~"${q.replaceAll('"','')}"`);
  const fields=encodeURIComponent("Name,LevelItem,ItemUICategory.Name,EquipSlotCategory.Name,ClassJobCategory.Name");
  const url=`${XIVAPI_V2}/search?sheets=Item&fields=${fields}&language=ja&query=${query}&limit=100`;
  const res=await fetch(url);if(!res.ok)throw new Error(`XIVAPI ${res.status}`);
  const data=await res.json();
  const rows=(data.results||[]).filter(x=>x.fields?.Name).filter(x=>resultMatchesGearSlot(x,slot));
  $("dmgGearSearchStatus").textContent=`${slot}：${rows.length}件見つかりました。装備を選んでください。`;
  $("dmgGearSearchResults").innerHTML=rows.length?rows.map(r=>`<div class="listitem"><div class="row"><div><b>${esc(r.fields.Name)}</b><div class="small">IL ${xivFieldValue(r.fields.LevelItem)||"-"} ／ ${esc(xivRelName(r.fields.ItemUICategory)||"カテゴリ不明")}</div></div><button class="secondary dmgGearPick" data-id="${r.row_id}" data-slot="${esc(slot)}">選択</button></div></div>`).join(""):'<div class="empty">この部位では該当する装備がありません。</div>';
  document.querySelectorAll(".dmgGearPick").forEach(b=>b.onclick=()=>loadXivGearDetail(Number(b.dataset.id),b.dataset.slot));
 }catch(e){
  console.error(e);$("dmgGearSearchStatus").textContent="装備DBの検索に失敗しました。手入力はそのまま利用できます。";
 }
}
async function loadXivGearDetail(id,selectedSlot=""){
 $("dmgGearSearchStatus").textContent="装備データを読み込み中…";
 try{
  const fields=encodeURIComponent("Name,LevelItem,DamagePhys,DamageMag,ItemUICategory.Name,EquipSlotCategory.Name,BaseParam[].Name,BaseParamValue[]");
  const res=await fetch(`${XIVAPI_V2}/sheet/Item/${id}?fields=${fields}&language=ja`);
  if(!res.ok)throw new Error(`XIVAPI ${res.status}`);
  const row=await res.json(),g=xivItemToGear({...row,row_id:id});
  {
   const slot=selectedSlot||guessGearSlot(g);
   $("dmgGearSlot").value=slot==="指輪"?"指輪1":slot;
  }$("dmgGearName").value=g.name;$("dmgGearIlvl").value=g.ilvl||0;$("dmgGearWd").value=g.wd||0;
  $("dmgGearStr").value=g.str||0;$("dmgGearVit").value=g.vit||0;$("dmgGearCrit").value=g.crit||0;$("dmgGearDet").value=g.det||0;$("dmgGearDh").value=g.dh||0;$("dmgGearSks").value=g.sks||0;$("dmgGearTen").value=g.ten||0;
  $("dmgGearSearchStatus").textContent=`「${g.name}」を入力欄へ反映しました。内容を確認して「この装備を追加 / 更新」を押してください。`;
 }catch(e){
  console.error(e);$("dmgGearSearchStatus").textContent="装備詳細の取得に失敗しました。";
 }
}
const DAMAGE_GEAR_SLOT_ORDER={"武器":0,"頭":1,"胴":2,"手":3,"脚":4,"足":5,"耳":6,"首":7,"腕":8,"指輪1":9,"指輪2":10};
function sortDamageGear(){damageGear.sort((a,b)=>(DAMAGE_GEAR_SLOT_ORDER[a.slot]??99)-(DAMAGE_GEAR_SLOT_ORDER[b.slot]??99));}
function gearTotals(){
 const z={wd:0,str:0,vit:0,crit:0,det:0,dh:0,sks:0,ten:0,ilvl:0,count:0};
 for(const g of damageGear){z.wd=Math.max(z.wd,Number(g.wd||0));z.str+=Number(g.str||0);z.vit+=Number(g.vit||0);z.crit+=Number(g.crit||0);z.det+=Number(g.det||0);z.dh+=Number(g.dh||0);z.sks+=Number(g.sks||0);z.ten+=Number(g.ten||0);z.ilvl+=Number(g.ilvl||0);z.count++}
 const mv=nval("dmgMateriaValue",54);
 for(const g of damageGear)for(const m of (g.materia||[])){if(m&&Object.prototype.hasOwnProperty.call(z,m))z[m]+=mv}
 z.avgIlvl=z.count?z.ilvl/z.count:0;return z;
}
function renderDamageGear(){
 if(!$("dmgGearList"))return;
 sortDamageGear();
 $("dmgGearList").innerHTML=damageGear.length?damageGear.map((g,i)=>`<div class="listitem"><div class="row"><div><b>${esc(g.slot)}：${esc(g.name||"名称未入力")}</b> <span class="badge">IL ${g.ilvl||"-"}</span><div class="small">${g.wd?`武器性能 ${g.wd} ／ `:""}STR ${g.str||0} ／ VIT ${g.vit||0} ／ クリ ${g.crit||0} ／ 意思 ${g.det||0} ／ DH ${g.dh||0} ／ スキス ${g.sks||0} ／ 不屈 ${g.ten||0}${(g.materia||[]).length?`<br>マテリア：${g.materia.map(m=>({crit:"武略",det:"雄略",dh:"天眼",sks:"剛柔"})[m]||m).join("・")}`:""}</div></div><button class="danger dmgGearDelete" data-i="${i}">削除</button></div></div>`).join(""):'<div class="empty">装備はまだ登録されていません。</div>';
 const z=gearTotals();$("dmgGearTotals").innerHTML=damageGear.length?`<b>装備合計：</b> 平均IL ${z.avgIlvl.toFixed(1)} ／ 物理基本性能 ${z.wd} ／ STR ${z.str} ／ VIT ${z.vit} ／ クリ ${z.crit} ／ 意思 ${z.det} ／ DH ${z.dh} ／ スキス ${z.sks} ／ 不屈 ${z.ten}`:"";
 document.querySelectorAll(".dmgGearDelete").forEach(b=>b.onclick=()=>{damageGear.splice(Number(b.dataset.i),1);syncGearToStats();renderDamageGear();calcDamage()});
}
function syncGearToStats(){
 const z=gearTotals();if(!damageGear.length)return;
 $("dmgWeaponDamage").value=z.wd;$("dmgStr").value=z.str;$("dmgVit").value=z.vit;$("dmgCritStat").value=z.crit;$("dmgDetStat").value=z.det;$("dmgDhStat").value=z.dh;$("dmgSksStat").value=z.sks;$("dmgTenStat").value=z.ten;
}
function addOrUpdateDamageGear(){
 const slot=$("dmgGearSlot").value,g={slot,name:$("dmgGearName").value.trim(),ilvl:nval("dmgGearIlvl"),wd:nval("dmgGearWd"),str:nval("dmgGearStr"),vit:nval("dmgGearVit"),crit:nval("dmgGearCrit"),det:nval("dmgGearDet"),dh:nval("dmgGearDh"),sks:nval("dmgGearSks"),ten:nval("dmgGearTen"),materia:[$("dmgGearMateria1").value,$("dmgGearMateria2").value].filter(Boolean)};
 const i=damageGear.findIndex(x=>x.slot===slot);if(i>=0)damageGear[i]=g;else damageGear.push(g);
 sortDamageGear();syncGearToStats();renderDamageGear();calcDamage();
 ["dmgGearName","dmgGearIlvl","dmgGearWd","dmgGearStr","dmgGearVit","dmgGearCrit","dmgGearDet","dmgGearDh","dmgGearSks","dmgGearTen"].forEach(id=>$(id).value=id==="dmgGearWd"?"0":"");
}
function damageHistoryRoot(d=load()){d.ffxivDamageHistory=d.ffxivDamageHistory||[];return d}
function fullDamageSnapshot(name){
 const z=gearTotals(),eff=effectiveDamageStats(),p=potionInfo();
 return {
  id:uid(),name:name||"装備セット",time:Date.now(),
  gear:JSON.parse(JSON.stringify(damageGear)),
  materiaValue:nval("dmgMateriaValue",54),targetGcd:nval("dmgTargetGcd",2.5),
  baseStats:{...z},effectiveStats:{...eff.effective},
  food:{preset:$("dmgFoodPreset")?.value||"",quality:$("dmgFoodQuality")?.value||"hq",stat1:$("dmgFoodStat1")?.value||"",pct1:nval("dmgFoodPct1"),cap1:nval("dmgFoodCap1"),stat2:$("dmgFoodStat2")?.value||"",pct2:nval("dmgFoodPct2"),cap2:nval("dmgFoodCap2")},
  potion:{preset:$("dmgPotionPreset")?.value||"",quality:$("dmgPotionQuality")?.value||"hq",pct:nval("dmgPotionPct"),cap:nval("dmgPotionCap"),duration:nval("dmgPotionDuration"),uses:nval("dmgPotionUses")},
  rotation:JSON.parse(JSON.stringify(damageRows)),
  fight:{duration:nval("dmgDuration",120),tempest:nval("dmgTempest",1.1),critRate:nval("dmgCritRate"),critMult:nval("dmgCritMult",1.4),dhRate:nval("dmgDhRate"),dhMult:nval("dmgDhMult",1.25)},
  expectedPps:Number($("dmgExpectedPps")?.textContent||0),expectedTotal:Number(String($("dmgExpected")?.textContent||"0").replaceAll(",",""))||0,
  potionAverageStrRatio:p.avgStrRatio
 };
}
function saveDamageHistory(){
 const name=$("dmgHistoryName").value.trim()||`装備セット ${new Date().toLocaleDateString("ja-JP")}`;
 const d=damageHistoryRoot(load());d.ffxivDamageHistory.push(fullDamageSnapshot(name));save(d);$("dmgHistoryName").value="";renderDamageHistory();
}
function renderDamageHistory(){
 if(!$("dmgHistoryList"))return;const d=damageHistoryRoot(load()),rows=[...d.ffxivDamageHistory].sort((a,b)=>b.time-a.time);
 const opts='<option value="">選択</option>'+rows.map(x=>`<option value="${x.id}">${esc(x.name)} ／ ${new Date(x.time).toLocaleString("ja-JP")}</option>`).join("");
 const oldB=$("dmgHistoryBefore").value,oldA=$("dmgHistoryAfter").value;$("dmgHistoryBefore").innerHTML=opts;$("dmgHistoryAfter").innerHTML=opts;
 if(rows.some(x=>x.id===oldB))$("dmgHistoryBefore").value=oldB;if(rows.some(x=>x.id===oldA))$("dmgHistoryAfter").value=oldA;
 if(!oldB&&rows[1])$("dmgHistoryBefore").value=rows[1].id;if(!oldA&&rows[0])$("dmgHistoryAfter").value=rows[0].id;
 $("dmgHistoryList").innerHTML=rows.length?rows.map(x=>`<div class="listitem"><div class="row"><div><b>${esc(x.name)}</b><div class="small">${new Date(x.time).toLocaleString("ja-JP")} ／ 平均IL ${Number(x.baseStats?.avgIlvl||0).toFixed(1)} ／ STR ${Math.round(x.effectiveStats?.str||0)} ／ 期待威力/秒 ${Number(x.expectedPps||0).toFixed(1)}</div></div><div class="wrap"><button class="secondary dmgHistoryLoad" data-id="${x.id}">読み込む</button><button class="danger dmgHistoryDelete" data-id="${x.id}">削除</button></div></div></div>`).join(""):'<div class="empty">保存済みセットはありません。</div>';
 document.querySelectorAll(".dmgHistoryLoad").forEach(b=>b.onclick=()=>loadDamageHistory(b.dataset.id));
 document.querySelectorAll(".dmgHistoryDelete").forEach(b=>b.onclick=()=>{if(!confirm("この装備セット履歴を削除しますか？"))return;const d=damageHistoryRoot(load());d.ffxivDamageHistory=d.ffxivDamageHistory.filter(x=>x.id!==b.dataset.id);save(d);renderDamageHistory()});
}
function loadDamageHistory(id){
 const d=damageHistoryRoot(load()),x=d.ffxivDamageHistory.find(v=>v.id===id);if(!x)return;
 damageGear=JSON.parse(JSON.stringify(x.gear||[]));damageRows=JSON.parse(JSON.stringify(x.rotation||[]));
 $("dmgMateriaValue").value=x.materiaValue??54;$("dmgTargetGcd").value=x.targetGcd??2.5;
 const f=x.food||{},p=x.potion||{},fight=x.fight||{};
 if($("dmgFoodPreset"))$("dmgFoodPreset").value=f.preset||"";if($("dmgFoodQuality"))$("dmgFoodQuality").value=f.quality||"hq";
 [["dmgFoodStat1",f.stat1],["dmgFoodPct1",f.pct1],["dmgFoodCap1",f.cap1],["dmgFoodStat2",f.stat2],["dmgFoodPct2",f.pct2],["dmgFoodCap2",f.cap2],["dmgPotionPreset",p.preset],["dmgPotionQuality",p.quality],["dmgPotionPct",p.pct],["dmgPotionCap",p.cap],["dmgPotionDuration",p.duration],["dmgPotionUses",p.uses],["dmgDuration",fight.duration],["dmgTempest",fight.tempest],["dmgCritRate",fight.critRate],["dmgCritMult",fight.critMult],["dmgDhRate",fight.dhRate],["dmgDhMult",fight.dhMult]].forEach(([id,v])=>{if($(id)&&v!=null)$(id).value=v});
 syncGearToStats();renderDamageGear();renderDamageCalc();$("dmgHistoryName").value=x.name;
}
function compareDamageHistory(){
 const d=damageHistoryRoot(load()),a=d.ffxivDamageHistory.find(x=>x.id===$("dmgHistoryBefore").value),b=d.ffxivDamageHistory.find(x=>x.id===$("dmgHistoryAfter").value);
 if(!a||!b)return $("dmgHistoryCompareResult").textContent="前回と今回を選択してください。";
 const keys=[["avgIlvl","平均IL",1],["wd","物理基本性能",0],["str","STR",0],["vit","VIT",0],["crit","クリ",0],["det","意思",0],["dh","DH",0],["sks","スキス",0],["ten","不屈",0]];
 const lines=keys.map(([k,n,dig])=>{const av=Number(a.baseStats?.[k]||0),bv=Number(b.baseStats?.[k]||0),diff=bv-av;return `${n}：${av.toFixed(dig)} → ${bv.toFixed(dig)}（${diff>=0?"+":""}${diff.toFixed(dig)}）`});
 const dp=Number(b.expectedPps||0)-Number(a.expectedPps||0),pct=Number(a.expectedPps||0)?dp/Number(a.expectedPps)*100:0;
 $("dmgHistoryCompareResult").innerHTML=`<b>${esc(a.name)} → ${esc(b.name)}</b><br>${lines.join("<br>")}<br><span class="badge gold">期待威力/秒：${Number(a.expectedPps||0).toFixed(1)} → ${Number(b.expectedPps||0).toFixed(1)}（${dp>=0?"+":""}${dp.toFixed(1)} / ${pct>=0?"+":""}${pct.toFixed(2)}%）</span>`;
}
let damageSavedSets={A:null,B:null};
function snapshotDamageSet(label){
 const z=gearTotals(),p=potionInfo();
 return {label,gear:JSON.parse(JSON.stringify(damageGear)),stats:{...z},expectedPps:Number($("dmgExpectedPps")?.textContent||0),targetGcd:nval("dmgTargetGcd",2.5),food:$("dmgFoodPreset")?.selectedOptions?.[0]?.text||"手動",potion:$("dmgPotionPreset")?.selectedOptions?.[0]?.text||"手動"};
}
function saveDamageSet(label){damageSavedSets[label]=snapshotDamageSet(label);$("dmgSetCompare").textContent=`セット${label}を保存しました。`}
function compareDamageSets(){
 const a=damageSavedSets.A,b=damageSavedSets.B;if(!a||!b)return $("dmgSetCompare").textContent="セットAとBを両方保存してください。";
 const keys=[["avgIlvl","平均IL"],["wd","物理基本性能"],["str","STR"],["vit","VIT"],["crit","クリ"],["det","意思"],["dh","DH"],["sks","スキス"],["ten","不屈"]];
 const lines=keys.map(([k,n])=>`${n}：A ${Number(a.stats[k]||0).toFixed(k==="avgIlvl"?1:0)} / B ${Number(b.stats[k]||0).toFixed(k==="avgIlvl"?1:0)}`);
 $("dmgSetCompare").innerHTML=`<b>セット比較</b><br>${lines.join("<br>")}<br><span class="badge gold">期待威力/秒 A ${a.expectedPps.toFixed(1)} / B ${b.expectedPps.toFixed(1)}</span><div style="margin-top:6px">※ XivGear同様、最終的なBiS判定ではGCD条件・丸めによるステータス閾値・実際のジョブシミュレーションを考慮する必要があります。現在のLAは比較補助段階です。</div>`;
}
const BALANCE_WAR_ALL_AROUND_OPENER=[
 ["トマホーク",150,1,false,"ウォークライ"],
 ["ヘヴィスウィング",240,1,false,""],
 ["メイム（コンボ）",340,1,false,""],
 ["シュトルムブレハ（コンボ）",500,1,false,"原初の解放＋薬"],
 ["インナーカオス",700,1,true,"アップヒーバル＋オンスロート"],
 ["プライマルレンド",720,1,true,"オンスロート"],
 ["プライマルルイネーション",800,1,true,"オンスロート"],
 ["フェルクリーヴ",580,1,false,""],
 ["フェルクリーヴ",580,1,false,""],
 ["フェルクリーヴ",580,1,false,"プライマルラス＋ウォークライ"],
 ["インナーカオス",700,1,true,""],
 ["ヘヴィスウィング",240,1,false,""],
 ["メイム（コンボ）",340,1,false,""],
 ["シュトルムヴィント（コンボ）",500,1,false,""],
 ["フェルクリーヴ",580,1,false,"ウォークライ"],
 ["インナーカオス",700,1,true,""],
 ["ヘヴィスウィング",240,1,false,""],
 ["メイム（コンボ）",340,1,false,"アップヒーバル"],
 ["シュトルムブレハ（コンボ）",500,1,false,""]
];
function loadBalanceWarOpener(){
 damageRows=BALANCE_WAR_ALL_AROUND_OPENER.map(([name,potency,count,cdh])=>({name,potency,count,cdh}));
 if($("dmgOpenerTimeline"))$("dmgOpenerTimeline").innerHTML=`<details class="listitem" open><summary><b>The Balance WAR All-Around Opener</b> <span class="badge">Patch 7.4</span></summary><div class="small" style="margin-top:8px">${BALANCE_WAR_ALL_AROUND_OPENER.map((x,i)=>`${i+1}. ${esc(x[0])}${x[4]?` ＋ ${esc(x[4])}`:""}`).join("<br>")}</div><div class="small" style="margin-top:8px">出典：The Balance Warrior Basic Guide / Openers。GCD 2.47秒以上（遅め）ならskill-for-skillでコピー可能と案内されています。速いGCDではoGCD位置の調整が必要です。</div></details>`;
 renderDamageCalc();
}
let damageRows=[];
function normalizeNumericText(v){return String(v??"").replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/[．。]/g,".").replace(/[，、]/g,",").replace(/[－ー−]/g,"-").replace(/[＋]/g,"+").replace(/[,\s￥¥]/g,"")}
function numericValue(v,def=0){const n=Number(normalizeNumericText(v));return Number.isFinite(n)?n:def}
function nval(id,def=0){const el=$(id);return numericValue(el?.value,def)}
// IME保持用: 家計簿の数値欄は通常のtext入力にし、全角数字はblur時に正規化する。
function setupBudgetNumericInput(root=document){root.querySelectorAll?.(".budgetNumericInput").forEach(el=>{if(el.dataset.jpnumReady)return;el.dataset.jpnumReady="1";el.type="text";el.removeAttribute("inputmode");el.removeAttribute("lang");el.addEventListener("blur",()=>{const raw=el.value.trim();if(!raw)return;const normalized=normalizeNumericText(raw);if(normalized!==raw)el.value=normalized})});root.querySelectorAll?.(".budgetJapaneseInput,.budgetItemName").forEach(el=>{el.type="text";el.removeAttribute("inputmode");el.removeAttribute("lang");el.setAttribute("autocomplete","off")})}
function damageExpectedMultiplier(cdh=false){
 const cr=Math.max(0,Math.min(1,nval("dmgCritRate")/100)),cm=Math.max(1,nval("dmgCritMult",1.4));
 const dr=Math.max(0,Math.min(1,nval("dmgDhRate")/100)),dm=Math.max(1,nval("dmgDhMult",1.25));
 return cdh?cm*dm:(1+cr*(cm-1))*(1+dr*(dm-1));
}
function baseDamageStats(){
 return {
  wd:nval("dmgWeaponDamage"),str:nval("dmgStr"),vit:nval("dmgVit"),
  crit:nval("dmgCritStat")+nval("dmgMatCrit"),
  det:nval("dmgDetStat")+nval("dmgMatDet"),
  dh:nval("dmgDhStat")+nval("dmgMatDh"),
  sks:nval("dmgSksStat")+nval("dmgMatSks"),
  ten:nval("dmgTenStat")+nval("dmgMatTen")
 };
}
function foodGain(base,pct,cap){return Math.max(0,Math.min(Math.floor(base*Math.max(0,pct)/100),Math.max(0,cap)))}
function effectiveDamageStats(){
 const s=baseDamageStats(),out={...s},gains={};
 for(const idx of [1,2]){
  const stat=$("dmgFoodStat"+idx)?.value||"",pct=nval("dmgFoodPct"+idx),cap=nval("dmgFoodCap"+idx);
  if(stat&&Object.prototype.hasOwnProperty.call(out,stat)){
   const gain=foodGain(s[stat],pct,cap);out[stat]+=gain;gains[stat]=(gains[stat]||0)+gain;
  }
 }
 return {base:s,effective:out,gains};
}
function potionInfo(){
 const {effective}=effectiveDamageStats(),baseStr=effective.str,pct=nval("dmgPotionPct"),cap=nval("dmgPotionCap");
 const gain=foodGain(baseStr,pct,cap),drugStr=baseStr+gain,dur=Math.max(0,nval("dmgPotionDuration")),uses=Math.max(0,nval("dmgPotionUses")),fight=Math.max(1,nval("dmgDuration",120));
 const uptime=Math.min(1,(dur*uses)/fight),strRatio=baseStr>0?drugStr/baseStr:1,avgStrRatio=1+(strRatio-1)*uptime;
 return {baseStr,gain,drugStr,dur,uses,uptime,strRatio,avgStrRatio};
}
function renderDamageStatSummary(){
 if(!$("dmgEffectiveStats"))return;
 const {base,effective,gains}=effectiveDamageStats(),p=potionInfo();
 $("dmgEffectiveStats").innerHTML=`<b>飯・マテリア反映後：</b> STR ${Math.round(effective.str)} ／ VIT ${Math.round(effective.vit)} ／ クリ ${Math.round(effective.crit)} ／ 意思 ${Math.round(effective.det)} ／ DH ${Math.round(effective.dh)} ／ スキス ${Math.round(effective.sks)} ／ 不屈 ${Math.round(effective.ten)}${base.wd?` ／ 物理基本性能 ${base.wd}`:""}`;
 const foodParts=Object.entries(gains).filter(([,v])=>v).map(([k,v])=>`${({crit:"クリ",det:"意思",dh:"DH",sks:"スキス",ten:"不屈"})[k]||k} +${v}`);
 $("dmgFoodSummary").textContent=foodParts.length?`飯による増加：${foodParts.join(" ／ ")}`:"飯による増加なし";
 $("dmgPotionSummary").textContent=p.gain?`薬中STR ${Math.round(p.drugStr)}（+${p.gain}）／ 稼働率 ${(p.uptime*100).toFixed(1)}% ／ 全体平均STR係数 ×${p.avgStrRatio.toFixed(4)}`:"薬によるSTR増加なし";
}
function renderDamageCalc(){
 if(!$("dmgRows"))return;
 $("dmgRows").innerHTML=damageRows.length?damageRows.map((r,i)=>`<div class="listitem"><div class="row"><div><b>${esc(r.name)}</b> <span class="badge">${r.potency}</span>${r.cdh?` <span class="badge gold">確定クリDH</span>`:""}<div class="small">${r.count}回 ／ 合計威力 ${(r.potency*r.count).toLocaleString()}</div></div><div class="wrap"><input class="dmgRowCount" data-i="${i}" type="number" min="0" value="${r.count}" style="width:90px"><button class="danger dmgRowDelete" data-i="${i}">削除</button></div></div></div>`).join(""):'<div class="empty">スキルを追加してください。</div>';
 document.querySelectorAll(".dmgRowCount").forEach(el=>el.oninput=()=>{damageRows[Number(el.dataset.i)].count=Math.max(0,Number(el.value||0));calcDamage()});
 document.querySelectorAll(".dmgRowDelete").forEach(b=>b.onclick=()=>{damageRows.splice(Number(b.dataset.i),1);renderDamageCalc();calcDamage()});
 calcDamage();
}
function calcDamage(){
 if(!$("dmgTotalPotency"))return;
 renderDamageStatSummary();
 const dur=Math.max(1,nval("dmgDuration",120)),temp=nval("dmgTempest",1.1),p=potionInfo();
 let total=0,expected=0;const lines=[];
 for(const r of damageRows){
  const raw=Number(r.potency||0)*Number(r.count||0),buffed=raw*temp,exp=buffed*damageExpectedMultiplier(r.cdh)*p.avgStrRatio;
  total+=buffed;expected+=exp;lines.push(`${r.name}：${r.count}回 ／ 威力 ${Math.round(buffed).toLocaleString()} ／ 期待 ${Math.round(exp).toLocaleString()}`);
 }
 $("dmgTotalPotency").textContent=Math.round(total).toLocaleString();$("dmgPps").textContent=(total/dur).toFixed(1);
 $("dmgExpected").textContent=Math.round(expected).toLocaleString();$("dmgExpectedPps").textContent=(expected/dur).toFixed(1);
 $("dmgBreakdown").innerHTML=lines.length?`<b>内訳</b><div class="small" style="margin-top:7px">${lines.map(esc).join("<br>")}</div><div class="small" style="margin-top:8px">薬の平均STR係数：×${p.avgStrRatio.toFixed(4)}</div>`:'<div class="empty">まだ計算対象がありません。</div>';
}
function addDamageAction(name,potency,count,cdh){damageRows.push({name:String(name||"アクション"),potency:Number(potency||0),count:Math.max(1,Number(count||1)),cdh:!!cdh});renderDamageCalc()}
function applyFoodPreset(){
 if($("dmgFoodPreset")?.value==="caramel"){
  const hq=$("dmgFoodQuality")?.value!=="nq";
  $("dmgFoodStat1").value="crit";$("dmgFoodPct1").value=hq?10:8;$("dmgFoodCap1").value=hq?90:72;
  $("dmgFoodStat2").value="det";$("dmgFoodPct2").value=hq?10:8;$("dmgFoodCap2").value=hq?150:120;
 }
 calcDamage();
}
function applyPotionPreset(){
 if($("dmgPotionPreset")?.value==="grade4str"){
  const hq=$("dmgPotionQuality")?.value!=="nq";
  $("dmgPotionPct").value=hq?10:8;$("dmgPotionCap").value=hq?541:432;$("dmgPotionDuration").value=30;
 }
 calcDamage();
}
function budgetRoot(d=load()){
 d.householdBudget=d.householdBudget||{entries:[],fixed:[],variableBudgets:[],monthlyLimit:0,inventory:[],postpayPlans:[]};
 d.householdBudget.inventory=d.householdBudget.inventory||[];d.householdBudget.variableBudgets=d.householdBudget.variableBudgets||[];d.householdBudget.postpayPlans=d.householdBudget.postpayPlans||[];
 if(!Array.isArray(d.householdBudget.paymentMethods)||!d.householdBudget.paymentMethods.length)d.householdBudget.paymentMethods=["現金","PayPay","ワンバンク","バンドル","銀行","その他"];
 return d
}
function budgetPaymentMethods(d=budgetRoot(load())){return [...new Set((d.householdBudget.paymentMethods||[]).map(x=>String(x||"").trim()).filter(Boolean))]}
function refreshBudgetPaymentSelects(){
 const d=budgetRoot(load()),methods=budgetPaymentMethods(d),defs={budgetPayment:"現金",budgetIncomeDest:"銀行",budgetTransferFrom:"現金",budgetTransferTo:"PayPay",postpayReservePlace:"PayPay"};
 Object.entries(defs).forEach(([id,fallback])=>{const el=$(id);if(!el)return;const current=el.value||fallback;el.innerHTML=methods.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");if(methods.includes(current))el.value=current;else if(methods.includes(fallback))el.value=fallback});
}
function renderBudgetPaymentMethods(){
 const el=$("budgetPaymentMethodList");if(!el)return;const d=budgetRoot(load()),methods=budgetPaymentMethods(d);
 el.innerHTML=methods.length?methods.map(x=>`<div class="listitem"><div class="row"><b>${esc(x)}</b><button class="danger budgetPaymentMethodDelete" data-name="${esc(x)}">削除</button></div></div>`).join(""):'<div class="empty">支払い方法は未登録です。</div>';
 document.querySelectorAll(".budgetPaymentMethodDelete").forEach(b=>b.onclick=()=>{const name=b.dataset.name;if(!confirm(`「${name}」を支払い方法一覧から削除しますか？\n過去の家計簿記録は削除されません。`))return;const d=budgetRoot(load());d.householdBudget.paymentMethods=budgetPaymentMethods(d).filter(x=>x!==name);save(d);refreshBudgetPaymentSelects();renderBudgetPaymentMethods()});
}
function addBudgetPaymentMethod(){const name=$("budgetPaymentMethodName")?.value.trim();if(!name)return;const d=budgetRoot(load());const methods=budgetPaymentMethods(d);if(!methods.includes(name))methods.push(name);d.householdBudget.paymentMethods=methods;save(d);$("budgetPaymentMethodName").value="";refreshBudgetPaymentSelects();renderBudgetPaymentMethods()}
function yen(n){return "¥"+Math.round(Number(n||0)).toLocaleString("ja-JP")}
function renderBudget(){if(!$("budgetList"))return;setupBudgetNumericInput($("householdBudget"));const d=budgetRoot(load()),now=new Date(),mk=$("budgetMonth").value||`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;$("budgetMonth").value=mk;$("budgetMonthlyLimit").value=d.householdBudget.monthlyLimit||"";const rows=d.householdBudget.entries.filter(x=>String(x.date||"").slice(0,7)===mk).sort((a,b)=>String(b.date).localeCompare(String(a.date)));const inc=rows.filter(x=>x.type==="income").reduce((s,x)=>s+Number(x.amount||0),0),exp=rows.filter(x=>x.type==="expense").reduce((s,x)=>s+Number(x.amount||0),0);$("budgetIncome").textContent=yen(inc);$("budgetExpense").textContent=yen(exp);$("budgetBalance").textContent=yen(inc-exp);const lim=Number(d.householdBudget.monthlyLimit||0),fixedTotal=d.householdBudget.fixed.reduce((s,x)=>s+Number(x.amount||0),0),variableBudgetTotal=d.householdBudget.variableBudgets.reduce((s,x)=>s+Number(x.amount||0),0),reservedNames=new Set(d.householdBudget.variableBudgets.map(x=>String(x.name||"").trim()).filter(Boolean)),variableExp=rows.filter(x=>x.type==="expense"&&x.category!=="固定費"&&!reservedNames.has(String(x.title||"").trim())).reduce((s,x)=>s+Number(x.amount||0),0),afterFixed=lim-fixedTotal-variableBudgetTotal,rem=afterFixed-variableExp;if($("budgetAfterFixed"))$("budgetAfterFixed").textContent=lim?yen(afterFixed):"未設定";$("budgetRemaining").textContent=lim?yen(rem):"未設定";const [yy,mm]=mk.split("-").map(Number),last=new Date(yy,mm,0).getDate(),today=(now.getFullYear()===yy&&now.getMonth()+1===mm)?now.getDate():1;$("budgetPerDay").textContent=lim?yen(Math.max(0,rem)/Math.max(1,last-today+1)):"未設定";const cats={};rows.filter(x=>x.type==="expense").forEach(x=>cats[x.category]=(cats[x.category]||0)+Number(x.amount||0));$("budgetCategorySummary").innerHTML=Object.keys(cats).length?"<b>カテゴリ別：</b> "+Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${esc(k)} ${yen(v)}`).join(" ／ "):"支出記録はまだありません。";const pays={};rows.filter(x=>x.type==="expense").forEach(x=>{const k=x.payment||"未設定";pays[k]=(pays[k]||0)+Number(x.amount||0)});if($("budgetPaymentSummary"))$("budgetPaymentSummary").innerHTML=Object.keys(pays).length?"<b>支払い方法別：</b> "+Object.entries(pays).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${esc(k)} ${yen(v)}`).join(" ／ "):"";$("budgetList").innerHTML=rows.length?rows.map(x=>`<div class="listitem"><div class="row"><div><b>${x.type==="income"?"＋":x.type==="transfer"?"↔":"－"} ${yen(x.amount)}　${esc(x.title||x.category)}</b><div class="small">${esc(x.date)} ／ ${esc(x.category)}${x.type==="expense"&&x.payment?` ／ ${esc(x.payment)}`:""}${x.type==="income"&&x.incomeDest?` ／ 入金先 ${esc(x.incomeDest)}`:""}${x.type==="transfer"?` ／ ${esc(x.transferFrom||"-")} → ${esc(x.transferTo||"-")}`:""}${x.memo?` ／ ${esc(x.memo)}`:""}</div></div><div class="wrap"><button class="secondary budgetEdit" data-id="${x.id}">編集</button><button class="danger budgetDelete" data-id="${x.id}">削除</button></div></div></div>`).join(""):'<div class="empty">この月の記録はありません。</div>';document.querySelectorAll(".budgetEdit").forEach(b=>b.onclick=()=>editBudgetEntry(b.dataset.id));
document.querySelectorAll(".budgetDelete").forEach(b=>b.onclick=()=>{if(!confirm("この家計簿記録を削除しますか？\n家計簿から追加済みの在庫はそのまま残します。"))return;const d=budgetRoot(load());d.householdBudget.entries=d.householdBudget.entries.filter(x=>x.id!==b.dataset.id);save(d);renderBudget();renderInventory()});renderFixedCosts();renderVariableBudgets();renderPostpay();renderInventory();refreshBudgetPaymentSelects();renderBudgetPaymentMethods()}
let budgetDraftItems=[];let budgetEditingEntryId="";
function addBudgetDraftItem(seed={}){
 budgetDraftItems.push({id:uid(),name:seed.name||"",unitPrice:Number(seed.unitPrice??seed.amount??0),buyQty:Number(seed.buyQty||1),toInventory:!!seed.toInventory,contentQty:Number(seed.contentQty??seed.qty??1),unit:seed.unit||"",place:seed.place||"冷蔵",tags:seed.tags||"",expiry:seed.expiry||""});renderBudgetDraftItems();
}
function renderBudgetDraftItems(){
 if(!$("budgetItems"))return;
 $("budgetItems").innerHTML=budgetDraftItems.length?budgetDraftItems.map((x,i)=>`<div class="listitem"><div class="grid3">
 <div><label>品名</label><input class="budgetItemName budgetJapaneseInput" data-i="${i}" value="${esc(x.name)}" placeholder="品名を入力" autocomplete="off"></div>
 <div><label>単価</label><input class="budgetItemPrice budgetNumericInput" data-i="${i}" type="text" placeholder="金額を入力" value="${x.unitPrice||""}"></div>
 <div><label>購入数</label><input class="budgetItemBuyQty budgetNumericInput" data-i="${i}" type="text" value="${x.buyQty||1}"></div>
 <div><label><input class="budgetItemInv" data-i="${i}" type="checkbox" ${x.toInventory?"checked":""}> 在庫登録</label><button class="danger budgetItemRemove" data-i="${i}">内訳削除</button></div>
 </div><div class="small">小計：<b>${yen((Number(x.unitPrice||0))*(Number(x.buyQty||0)))}</b></div>${x.toInventory?`<div class="grid3" style="margin-top:6px">
 <div><label>1つあたり内容量</label><input class="budgetItemContentQty budgetNumericInput" data-i="${i}" type="text" value="${x.contentQty||1}"></div>
 <div><label>単位</label><input class="budgetItemUnit" data-i="${i}" value="${esc(x.unit)}" placeholder="個 / g / ml"></div>
 <div><label>保管場所</label><input class="budgetItemPlace" data-i="${i}" value="${esc(x.place)}" placeholder="冷蔵庫 / 冷凍庫 / 棚"></div>
 <div><label>タグ</label><input class="budgetItemTags" data-i="${i}" value="${esc(x.tags)}" placeholder="肉, 朝食, 開封済み"></div>
 <div><label>期限</label><input class="budgetItemExpiry" data-i="${i}" type="date" value="${esc(x.expiry)}"></div>
 <div><label>在庫総量</label><div class="small">${(Number(x.contentQty||0)*Number(x.buyQty||0))}${esc(x.unit||"")}</div></div></div>`:""}</div>`).join(""):'<div class="empty">必要なら「＋ 内訳を追加」で品目を登録できます。</div>';
 const sync=(sel,key,conv=v=>v)=>document.querySelectorAll(sel).forEach(el=>el.oninput=el.onchange=()=>{budgetDraftItems[Number(el.dataset.i)][key]=conv(el.type==="checkbox"?el.checked:el.value);renderBudgetDraftTotal()});
 sync(".budgetItemName","name");sync(".budgetItemPrice","unitPrice",numericValue);sync(".budgetItemBuyQty","buyQty",numericValue);sync(".budgetItemContentQty","contentQty",numericValue);sync(".budgetItemUnit","unit");sync(".budgetItemPlace","place");sync(".budgetItemTags","tags");sync(".budgetItemExpiry","expiry");
 document.querySelectorAll(".budgetItemInv").forEach(el=>el.onchange=()=>{budgetDraftItems[Number(el.dataset.i)].toInventory=el.checked;renderBudgetDraftItems()});
 document.querySelectorAll(".budgetItemRemove").forEach(b=>b.onclick=()=>{budgetDraftItems.splice(Number(b.dataset.i),1);renderBudgetDraftItems()});setupBudgetNumericInput($("budgetItems"));renderBudgetDraftTotal();
}
function renderBudgetDraftTotal(){
 if(!$("budgetItemsTotal"))return;const total=budgetDraftItems.reduce((s,x)=>s+(Number(x.unitPrice||0)*Number(x.buyQty||0)),0),receipt=nval("budgetAmount"),diff=receipt-total;
 $("budgetItemsTotal").innerHTML=`内訳合計 <b>${yen(total)}</b>${receipt?` ／ レシート合計 ${yen(receipt)} ／ 差額 <b>${yen(diff)}</b>`:""}`;
}
function editBudgetEntry(id){
 const d=budgetRoot(load()),x=d.householdBudget.entries.find(v=>v.id===id);if(!x)return;
 budgetEditingEntryId=id;$("budgetDate").value=x.date||"";$("budgetType").value=x.type||"expense";$("budgetAmount").value=x.amount||"";$("budgetCategory").value=x.category||"その他";$("budgetTitle").value=x.title||"";$("budgetMemo").value=x.memo||"";if($("budgetPayment"))$("budgetPayment").value=x.payment||"現金";if($("budgetIncomeDest"))$("budgetIncomeDest").value=x.incomeDest||"銀行";if($("budgetTransferFrom"))$("budgetTransferFrom").value=x.transferFrom||"現金";if($("budgetTransferTo"))$("budgetTransferTo").value=x.transferTo||"PayPay";
 budgetDraftItems=JSON.parse(JSON.stringify(x.items||[])).map(v=>({id:v.id||uid(),name:v.name||"",unitPrice:Number(v.unitPrice??v.amount??0),buyQty:Number(v.buyQty||1),toInventory:!!v.toInventory,contentQty:Number(v.contentQty??v.qty??1),unit:v.unit||"",place:v.place||"冷蔵",tags:Array.isArray(v.tags)?v.tags.join(", "):(v.tags||""),expiry:v.expiry||""}));
 renderBudgetDraftItems();renderBudgetDraftTotal();toggleBudgetTypeUI();
 $("budgetAdd").textContent="変更を保存";
 $("budgetAdd").classList.add("success");if($("budgetEditCancel"))$("budgetEditCancel").style.display="inline-block";
 $("budgetTitle").scrollIntoView({behavior:"smooth",block:"start"});
}
function addBudgetEntry(){
 const amount=nval("budgetAmount");if(!amount)return alert("金額を入力してください。");
 const d=budgetRoot(load()),type=$("budgetType").value,isIncome=type==="income",isTransfer=type==="transfer",entry={id:budgetEditingEntryId||uid(),date:$("budgetDate").value||new Date().toISOString().slice(0,10),type,amount,category:isIncome?"収入":isTransfer?"振替":$("budgetCategory").value,title:$("budgetTitle").value.trim(),memo:$("budgetMemo").value.trim(),payment:type==="expense"?$("budgetPayment").value:"",incomeDest:isIncome?$("budgetIncomeDest").value:"",transferFrom:isTransfer?$("budgetTransferFrom").value:"",transferTo:isTransfer?$("budgetTransferTo").value:"",items:type==="expense"?JSON.parse(JSON.stringify(budgetDraftItems)):[]};
 if(budgetEditingEntryId){
  const idx=d.householdBudget.entries.findIndex(x=>x.id===budgetEditingEntryId);if(idx>=0)d.householdBudget.entries[idx]=entry;
  d.householdBudget.inventory=d.householdBudget.inventory.filter(x=>x.entryId!==budgetEditingEntryId);
 }else d.householdBudget.entries.push(entry);
 if(entry.type==="expense"){
  d.householdBudget.inventory=d.householdBudget.inventory||[];
  budgetDraftItems.filter(x=>x.toInventory&&x.name.trim()).forEach(x=>d.householdBudget.inventory.push({id:uid(),entryId:entry.id,name:x.name.trim(),qty:Number(x.contentQty||1)*Number(x.buyQty||1),unit:x.unit.trim(),place:x.place.trim(),tags:x.tags.split(",").map(v=>v.trim()).filter(Boolean),expiry:x.expiry,purchased:entry.date,price:Number(x.unitPrice||0)*Number(x.buyQty||1)}));
 }
 save(d);["budgetAmount","budgetTitle","budgetMemo"].forEach(id=>$(id).value="");budgetDraftItems=[];budgetEditingEntryId="";$("budgetAdd").textContent="記録する";$("budgetAdd").classList.remove("success");if($("budgetEditCancel"))$("budgetEditCancel").style.display="none";renderBudgetDraftItems();renderBudget();renderInventory();
}
function renderInventory(){
 if(!$("inventoryList"))return;const d=budgetRoot(load()),filter=$("inventoryFilter")?.value||"";
 const rows=d.householdBudget.inventory.filter(x=>Number(x.qty||0)>0).filter(x=>!filter||x.place===filter||((x.tags||[]).includes(filter))).sort((a,b)=>(a.expiry||"9999").localeCompare(b.expiry||"9999"));
 $("inventorySummary").textContent=`在庫 ${rows.length}品 ／ 購入額 ${yen(rows.reduce((s,x)=>s+Number(x.price||0),0))}`;
 $("inventoryList").innerHTML=rows.length?rows.map(x=>`<div class="listitem"><div class="row"><div><b>${esc(x.name)}</b> <span class="badge">${esc(x.place||"場所未設定")}</span>${(x.tags||[]).map(v=>` <span class="badge">${esc(v)}</span>`).join("")}<div class="small">${x.qty}${esc(x.unit||"")} ／ 購入 ${esc(x.purchased||"-")} ／ ${yen(x.price)}${x.expiry?` ／ 期限 ${esc(x.expiry)}`:""}</div></div><div class="wrap"><button class="secondary invUse" data-id="${x.id}">使う</button><button class="secondary invToShopping" data-id="${x.id}">買い物リストへ</button><button class="secondary invEdit" data-id="${x.id}">場所・タグ編集</button><button class="danger invDelete" data-id="${x.id}">削除</button></div></div></div>`).join(""):'<div class="empty">在庫はまだありません。</div>';
 document.querySelectorAll(".invUse").forEach(b=>b.onclick=()=>{const d=budgetRoot(load()),x=d.householdBudget.inventory.find(v=>v.id===b.dataset.id);if(!x)return;const q=Number(prompt(`「${x.name}」をいくつ使いましたか？`,1));if(!q||q<0)return;x.qty=Math.max(0,Number(x.qty||0)-q);save(d);renderInventory()});
 document.querySelectorAll(".invToShopping").forEach(b=>b.onclick=()=>{const d=budgetRoot(load()),x=d.householdBudget.inventory.find(v=>v.id===b.dataset.id);if(!x)return;d.shopping=d.shopping||[];const exists=d.shopping.some(v=>!v.done&&String(v.name||"").trim()===String(x.name||"").trim());if(!exists)d.shopping.push({id:uid(),name:x.name,category:(x.place==="日用品"?"日用品":"食材"),memo:"在庫から追加",done:false,time:Date.now()});save(d);renderShopping();b.textContent=exists?"追加済み":"追加しました";setTimeout(()=>b.textContent="買い物リストへ",900)});
 document.querySelectorAll(".invEdit").forEach(b=>b.onclick=()=>{const d=budgetRoot(load()),x=d.householdBudget.inventory.find(v=>v.id===b.dataset.id);if(!x)return;const place=prompt("保管場所を変更",x.place||"");if(place===null)return;const tags=prompt("タグ（カンマ区切り）",(x.tags||[]).join(", "));if(tags===null)return;x.place=place.trim();x.tags=tags.split(",").map(v=>v.trim()).filter(Boolean);save(d);renderInventory()});
 document.querySelectorAll(".invDelete").forEach(b=>b.onclick=()=>{if(!confirm("この在庫を削除しますか？"))return;const d=budgetRoot(load());d.householdBudget.inventory=d.householdBudget.inventory.filter(x=>x.id!==b.dataset.id);save(d);renderInventory()});
}
function currentBudgetMonth(){return $("budgetMonth")?.value||new Date().toISOString().slice(0,7)}
function postpayCalc(){
 const target=nval("postpayLivingTarget"),amount=nval("postpayAmount"),own=Math.max(0,target-amount),rate=target?Math.max(0,Math.min(100,amount/target*100)):0;
 if($("postpayOwn"))$("postpayOwn").textContent=yen(own);if($("postpayRepay"))$("postpayRepay").textContent=yen(amount);if($("postpayRate"))$("postpayRate").textContent=target?`${rate.toFixed(0)}%`:"—";if($("postpayBar"))$("postpayBar").style.width=`${rate}%`;
 const d=budgetRoot(load()),hist=d.householdBudget.postpayPlans.slice().sort((a,b)=>String(a.month).localeCompare(String(b.month))),first=hist.find(x=>Number(x.amount)>0),base=Number(first?.amount||target||0),reduced=Math.max(0,base-amount);if($("postpayReduced"))$("postpayReduced").textContent=yen(reduced);
}
function renderPostpay(){
 if(!$("postpayHistory"))return;const d=budgetRoot(load()),mk=currentBudgetMonth(),plan=d.householdBudget.postpayPlans.find(x=>x.month===mk);
 if(plan){$("postpayLivingTarget").value=plan.target||"";$("postpayAmount").value=plan.amount||"";$("postpayService").value=plan.service||"ワンバンク";$("postpayDue").value=plan.due||"";$("postpayReservePlace").value=plan.reservePlace||"PayPay";$("postpayMemo").value=plan.memo||""}else{const prev=d.householdBudget.postpayPlans.slice().sort((a,b)=>String(b.month).localeCompare(String(a.month)))[0];$("postpayLivingTarget").value=prev?.target||50000;$("postpayAmount").value="";$("postpayDue").value="";$("postpayMemo").value=""}
 postpayCalc();
 const rows=d.householdBudget.postpayPlans.slice().sort((a,b)=>String(b.month).localeCompare(String(a.month)));
 $("postpayStatus").innerHTML=plan?`<b>${esc(mk)}</b>：${esc(plan.service)} ${yen(plan.amount)} ／ 自前 ${yen(Math.max(0,Number(plan.target)-Number(plan.amount)))} ／ 返済 ${plan.paid?"済":"未"}${plan.due?`（期限 ${esc(plan.due)}）`:""}`:"この月の計画は未登録です。";
 $("postpayHistory").innerHTML=rows.length?rows.map(x=>{const own=Math.max(0,Number(x.target)-Number(x.amount)),rate=Number(x.target)?Number(x.amount)/Number(x.target)*100:0;return `<div class="listitem"><div class="row"><div><b>${esc(x.month)}　${esc(x.service)}</b><div class="small">あと払い ${yen(x.amount)}（${rate.toFixed(0)}%） ／ 自前 ${yen(own)} → ${esc(x.reservePlace||"-")} ／ 返済 ${x.paid?"済":"未"}${x.due?` ${esc(x.due)}`:""}</div></div><button class="danger postpayDelete" data-month="${esc(x.month)}">削除</button></div></div>`}).join(""):'<div class="empty">履歴はまだありません。</div>';
 document.querySelectorAll(".postpayDelete").forEach(b=>b.onclick=()=>{if(!confirm("この月の計画を削除しますか？"))return;const d=budgetRoot(load());d.householdBudget.postpayPlans=d.householdBudget.postpayPlans.filter(x=>x.month!==b.dataset.month);save(d);renderPostpay()});
}
function savePostpay(){
 const target=nval("postpayLivingTarget"),amount=nval("postpayAmount");if(!target)return alert("生活費目標を入力してください。");if(amount>target&&!confirm("あと払い額が生活費目標を超えています。このまま保存しますか？"))return;
 const d=budgetRoot(load()),mk=currentBudgetMonth(),old=d.householdBudget.postpayPlans.find(x=>x.month===mk),obj={month:mk,target,amount,service:$("postpayService").value,due:$("postpayDue").value,reservePlace:$("postpayReservePlace").value,memo:$("postpayMemo").value.trim(),paid:old?.paid||false};
 if(old)Object.assign(old,obj);else d.householdBudget.postpayPlans.push(obj);save(d);renderPostpay();
}
function markPostpayPaid(){const d=budgetRoot(load()),mk=currentBudgetMonth(),x=d.householdBudget.postpayPlans.find(v=>v.month===mk);if(!x)return alert("先に今月の計画を保存してください。");x.paid=true;save(d);renderPostpay()}
function renderVariableBudgets(){
 if(!$("variableBudgetList"))return;const d=budgetRoot(load()),rows=d.householdBudget.variableBudgets,total=rows.reduce((s,x)=>s+Number(x.amount||0),0);if($("variableBudgetTotal"))$("variableBudgetTotal").textContent=yen(total);
 const mk=$("budgetMonth")?.value||new Date().toISOString().slice(0,7),entries=d.householdBudget.entries.filter(x=>x.type==="expense"&&String(x.date||"").slice(0,7)===mk);
 $("variableBudgetList").innerHTML=rows.length?rows.map(x=>{const actual=entries.filter(e=>String(e.title||"").trim()===String(x.name||"").trim()).reduce((s,e)=>s+Number(e.amount||0),0),diff=Number(x.amount||0)-actual;return `<div class="listitem"><div class="row"><div><b>${esc(x.name)}</b>　予算 ${yen(x.amount)}<div class="small">実績 ${yen(actual)} ／ ${diff>=0?"残り":"超過"} ${yen(Math.abs(diff))}</div></div><button class="danger variableBudgetDelete" data-id="${x.id}">削除</button></div></div>`}).join(""):'<div class="empty">変動固定費の予算枠は未登録です。</div>';
 document.querySelectorAll(".variableBudgetDelete").forEach(b=>b.onclick=()=>{const d=budgetRoot(load());d.householdBudget.variableBudgets=d.householdBudget.variableBudgets.filter(x=>x.id!==b.dataset.id);save(d);renderBudget()});
}
function addVariableBudget(){const name=$("variableBudgetName").value.trim(),amount=nval("variableBudgetAmount");if(!name||!amount)return alert("項目と予算を入力してください。");const d=budgetRoot(load());const old=d.householdBudget.variableBudgets.find(x=>x.name===name);if(old)old.amount=amount;else d.householdBudget.variableBudgets.push({id:uid(),name,amount});save(d);$("variableBudgetName").value="";$("variableBudgetAmount").value="";renderBudget()}
function toggleBudgetTypeUI(){
 const type=$("budgetType")?.value||"expense",income=type==="income",transfer=type==="transfer";
 document.querySelectorAll(".budgetMode").forEach(b=>b.classList.toggle("active",b.dataset.type===type));
 if($("budgetPurchaseDetails"))$("budgetPurchaseDetails").style.display=type==="expense"?"block":"none";
 if($("budgetPaymentWrap"))$("budgetPaymentWrap").style.display=type==="expense"?"block":"none";
 if($("budgetIncomeDestWrap"))$("budgetIncomeDestWrap").style.display=income?"block":"none";
 if($("budgetTransferFromWrap"))$("budgetTransferFromWrap").style.display=transfer?"block":"none";
 if($("budgetTransferToWrap"))$("budgetTransferToWrap").style.display=transfer?"block":"none";
 if($("budgetCategory")){if(income)$("budgetCategory").value="収入";$("budgetCategory").disabled=transfer}
 if($("budgetTitleLabel"))$("budgetTitleLabel").textContent=income?"収入内容":transfer?"振替名":"店・用途";
 if($("budgetTitle"))$("budgetTitle").placeholder=income?"例：給与・給付・臨時収入":transfer?"例：PayPayチャージ":"例：西友 / 電気";
}
function renderFixedCosts(){if(!$("fixedList"))return;const d=budgetRoot(load());const fixedTotal=d.householdBudget.fixed.reduce((s,x)=>s+Number(x.amount||0),0);if($("fixedTotal"))$("fixedTotal").textContent=yen(fixedTotal);$("fixedList").innerHTML=d.householdBudget.fixed.length?d.householdBudget.fixed.map(x=>`<div class="listitem"><div class="row"><div>${esc(x.name)} <b>${yen(x.amount)}</b></div><button class="danger fixedDelete" data-id="${x.id}">削除</button></div></div>`).join(""):'<div class="empty">固定費は未登録です。</div>';document.querySelectorAll(".fixedDelete").forEach(b=>b.onclick=()=>{const d=budgetRoot(load());d.householdBudget.fixed=d.householdBudget.fixed.filter(x=>x.id!==b.dataset.id);save(d);renderFixedCosts()})}
function addFixedCost(){const name=$("fixedName").value.trim(),amount=nval("fixedAmount");if(!name||!amount)return alert("項目と金額を入力してください。");const d=budgetRoot(load());d.householdBudget.fixed.push({id:uid(),name,amount});save(d);$("fixedName").value="";$("fixedAmount").value="";renderFixedCosts()}
const UI_KEY="eorzeaArchive_ui_v1";
const pageTitles={home:"ホーム",activityLog:"時間記録",dateArchive:"日付アーカイブ",inbox:"受信箱",records:"記録庫",history:"履歴",shopping:"買い物・在庫",cooking:"料理図鑑",ff14:"エオルゼア",achievements:"アチーブメント",ffxivAcquisition:"入手・交換品図鑑",ffxivDamage:"火力計算機",householdBudget:"家計簿",guildleves:"ギルドリーヴ",yokai:"妖怪ウォッチ",eventsHome:"イベント",crafting:"制作手帳",weapons:"武器制作",fishing:"釣り手帳",trpg:"TRPG・PL履歴",trpg_kp:"TRPG・KP履歴",peopleCodex:"人物・PC図鑑",scenarioLibrary:"所持シナリオ",trpgAssets:"TRPG素材庫",todayHub:"今日",quickCapture:"クイック記録",diceTool:"ダイスログ抽出",kpTools:"KP補助",checklistTool:"自由チェックメモ",sakumeru:"SAKU+MERU",settings:"設定",backup:"バックアップ",ffcollect:"収集図鑑",bicolor:"バイカラージェム"};
function loadUI(){try{return JSON.parse(localStorage.getItem(UI_KEY)||"{}")}catch{return {}}}
function saveUI(patch){const ui={...loadUI(),...patch};localStorage.setItem(UI_KEY,JSON.stringify(ui));return ui}
function closeSidebar(){document.getElementById("sidebar")?.classList.remove("open");document.getElementById("sidebarOverlay")?.classList.remove("open")}
function switchView(id,options={}){
 if(id==="sakumeru"){const f=document.getElementById("sakumeruFrame");if(f&&!f.src)f.src=f.dataset.src||"https://pp-hibithx.github.io/sakumeru/";}
 const pomo=document.getElementById("pomodoroMini");if(pomo)pomo.classList.toggle("budget-compact",id==="householdBudget");
 document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
 document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===id));
 if($("currentPageTitle"))$("currentPageTitle").textContent=pageTitles[id]||id;
 saveUI({activeView:id});
 render();
 if(options.anchor)requestAnimationFrame(()=>document.getElementById(options.anchor)?.scrollIntoView({behavior:"smooth",block:"start"}));
 closeSidebar();
}

function getClassification(x,fallback="日常"){
 return x?.classification||x?.candidate||x?.type||x?.category||fallback;
}
function setClassification(x,value){
 const v=value||"日常";
 x.classification=v;
 // compatibility mirrors for older screens/data, but classification is canonical.
 if("candidate" in x)x.candidate=v;
 if("type" in x)x.type=v;
 if("category" in x)x.category=v;
 return v;
}

function normalizeTags(tags){
 if(Array.isArray(tags))return [...new Set(tags.map(v=>String(v||"").trim()).filter(Boolean))];
 if(typeof tags==="string")return [...new Set(tags.split(/[,、]/).map(v=>v.trim()).filter(Boolean))];
 return [];
}
function hasTagLike(x,pattern){
 return normalizeTags(x?.tags).some(t=>pattern.test(t));
}
function crossReferenceRecords(d=load()){
 const ordinary=(d.records||[]).map(r=>({
  ...r,
  _source:"record",
  _sourceLabel:"単独記録",
  tags:normalizeTags(r.tags),
  classification:getClassification(r,"日常")
 }));
 const parentMap=new Map((d.stackParents||[]).map(p=>[p.id,p]));
 const dayMap=new Map((d.stackDays||[]).map(day=>[day.id,day]));
 const grouped=(d.stackEntries||[]).map(e=>{
  const day=dayMap.get(e.dayId),parent=parentMap.get(e.parentId||day?.parentId);
  const parentTags=normalizeTags(parent?.tags),dayTags=normalizeTags(day?.tags),entryTags=normalizeTags(e.tags);
  const tags=normalizeTags([...parentTags,...dayTags,...entryTags]);
  const parentName=parent?.name||"親ページ";
  const dayName=day?.label||day?.name||"";
  const title=e.title||[parentName,dayName,e.entryType].filter(Boolean).join(" / ");
  return {
   ...e,
   title,
   text:e.text||"",
   url:e.url||"",
   time:Number(e.time||day?.time||parent?.time||e.createdAt||Date.now()),
   tags,
   classification:String(parent?.category||getClassification(e,"その他")),
   category:String(parent?.category||getClassification(e,"その他")),
   _source:"stack",
   _sourceLabel:"親子ページ",
   _parentId:parent?.id||"",
   _parentName:parentName,
   _dayId:day?.id||"",
   _dayName:dayName,
   _parentTags:parentTags,
   _dayTags:dayTags,
   _entryTags:entryTags
  };
 });
 return [...ordinary,...grouped];
}
function isKpRecord(x){
 const hay=[x?.title,x?.text,...normalizeTags(x?.tags)].join(" ");
 return /(^|[\s#【［(（／/・,、])KP($|[\s#】］)）／/・,、])|キーパー/i.test(hay);
}


function repairDestinationConflicts(){
 const d=load();let changed=false;
 for(const inbox of d.inbox||[]){
  // 親子ページへの整理は recordMode=grouped / stackParentId を正規判定にする。
  // 旧版が destination=record と保存していても、子記録を削除しない。
  const isGrouped=inbox.recordMode==="grouped"||!!inbox.stackParentId||inbox.destination==="stack";
  const dest=isGrouped?"stack":(inbox.destination||"record");

  if(isGrouped&&inbox.destination!=="stack"){
   inbox.destination="stack";
   changed=true;
  }

  if(dest==="stack"){
   // 親子ページが保存先：通常記録側に残った古い複製だけを除去する。
   const before=d.records.length;
   d.records=d.records.filter(r=>r.sourceInboxId!==inbox.id);
   if(d.records.length!==before)changed=true;
  }else if(dest==="record"){
   // 単独記録が保存先のときだけ、親子側の複製を除去する。
   const before=d.stackEntries.length;
   d.stackEntries=d.stackEntries.filter(e=>e.sourceInboxId!==inbox.id);
   if(d.stackEntries.length!==before)changed=true;
  }
 }
 if(changed)save(d);
}

function recoverMisroutedChecklists(){
 const d=load();let changed=false;
 const recoveredToolIds=new Set();

 for(const inbox of d.inbox||[]){
  const tool=(d.toolChecklists||[]).find(t=>t.name===(inbox.title||"")&&!recoveredToolIds.has(t.id));
  if(!tool)continue;

  const items=structuredClone((inbox.checklist&&inbox.checklist.length)?inbox.checklist:(tool.items||[]));
  const originalDestination=inbox.destination||"record";

  if(originalDestination==="stack"){
   // If a stack entry for this inbox already exists, leave it alone.
   const existingEntry=(d.stackEntries||[]).find(e=>e.sourceInboxId===inbox.id);
   if(existingEntry){
    recoveredToolIds.add(tool.id);
    continue;
   }

   // Prefer an explicitly remembered parent id/name if present.
   let parent=null;
   if(inbox.stackParentId)parent=(d.stackParents||[]).find(p=>p.id===inbox.stackParentId);
   if(!parent&&inbox.stackParentName)parent=(d.stackParents||[]).find(p=>p.name===inbox.stackParentName);

   // As a safe fallback, reuse a single matching titled parent.
   if(!parent){
    const same=(d.stackParents||[]).filter(p=>p.name===(inbox.parentTitle||inbox.title));
    if(same.length===1)parent=same[0];
   }

   // If no parent can be identified safely, create one from the inbox title.
   if(!parent){
    parent={
     id:uid(),
     name:inbox.stackParentName||inbox.parentTitle||inbox.title||"無題",
     category:getClassification(inbox,"その他"),
     role:"",
     tags:structuredClone(inbox.tags||[]),
     createdAt:Date.now(),updatedAt:Date.now()
    };
    d.stackParents.push(parent);
   }

   let day=null;
   if(inbox.stackDayId)day=(d.stackDays||[]).find(x=>x.id===inbox.stackDayId);
   if(!day){
    day=nextStackDay(parent.id,d);
    day.time=inbox.time||Date.now();
    d.stackDays.push(day);
   }

   d.stackEntries.push({
    id:uid(),parentId:parent.id,dayId:day.id,
    entryType:inbox.stackEntryType||"チェックリスト",
    title:inbox.title||"",
    text:inbox.text||"",
    time:inbox.time||Date.now(),
    status:inbox.status||"実施",
    minutes:0,
    tags:structuredClone(inbox.tags||[]),
    url:inbox.url||"",
    checklist:items,
    sourceInboxId:inbox.id,
    createdAt:Date.now(),updatedAt:Date.now()
   });
   parent.updatedAt=Date.now();
   recoveredToolIds.add(tool.id);
   changed=true;
   continue;
  }

  // Only recover to the ordinary record library when that was the original destination.
  if(originalDestination==="record"){
   const already=(d.records||[]).find(r=>r.sourceInboxId===inbox.id);
   if(!already){
    const cls=getClassification(inbox,"日常");
    d.records.push({
     id:uid(),title:inbox.title||tool.name||"無題",text:inbox.text||"",
     time:inbox.time||Date.now(),classification:cls,type:cls,category:cls,
     tags:structuredClone(inbox.tags||[]),status:inbox.status||"実施",
     checklist:items,url:inbox.url||"",sourceInboxId:inbox.id,
     createdAt:Date.now(),updatedAt:Date.now()
    });
    changed=true;
   }
   recoveredToolIds.add(tool.id);
  }
 }

 if(recoveredToolIds.size){
  d.toolChecklists=(d.toolChecklists||[]).filter(t=>!recoveredToolIds.has(t.id));
  changed=true;
 }
 if(changed)save(d);
}

function migrateClassifications(){
 const d=load();let changed=false;
 const canonical=new Set(["FF14","TRPG","買い物","食事","体調","日常","予定","メモ"]);
 const ffTags=new Set(["FF14","冒険日誌","武器制作","零式","アチーブメント","釣り","制作","ファントムウェポン"]);
 const trpgTags=new Set(["TRPG","KP","PL","卓記録","セッション"]);

 function infer(x,fallback){
  const tags=(x.tags||[]).map(String);
  const text=((x.title||"")+" "+(x.text||"")+" "+tags.join(" ")).toLowerCase();
  const current=x.classification||x.candidate||x.type||x.category||"";

  // Explicit modern categories win.
  if(canonical.has(current)&&current!=="メモ"&&current!=="日常")return current;

  // Legacy FF14 adventure diary records.
  if(tags.some(t=>ffTags.has(t))||tags.includes("冒険日誌")||
     /ff14|零式|ファントムウェポン|pw最終|ナイトのクエ|エオルゼア|アチーブ|武器制作/.test(text)){
    return "FF14";
  }

  // Legacy TRPG records.
  if(tags.some(t=>trpgTags.has(t))||/\btrpg\b|kp|pl|卓|セッション/.test(text)){
    return "TRPG";
  }

  if(canonical.has(current))return current;
  if(current==="日記"||current==="")return fallback;
  return fallback;
 }

 for(const x of d.inbox||[]){
  const v=infer(x,"メモ");
  if(x.classification!==v){x.classification=v;changed=true}
 }
 for(const x of d.records||[]){
  const v=infer(x,"日常");
  if(x.classification!==v){x.classification=v;changed=true}
  // keep compatibility mirrors aligned
  if(x.type!==v){x.type=v;changed=true}
  if(x.category!==v){x.category=v;changed=true}
 }
 if(changed)save(d);
}


const INBOX_DRAFT_KEY="lifeArchiveInboxDraft";
let inboxDraftTimer=null;
function inboxDraftFieldIds(){
 return ["captureTitle","captureText","captureTags","captureTime","captureType","captureStatus","captureDestination","captureRecordMode","captureUrl","captureHasChecklist","captureChecklistItems"];
}
function readInboxDraft(){
 const out={};
 for(const id of inboxDraftFieldIds()){
  const el=$(id);if(!el)continue;
  out[id]=el.type==="checkbox"?el.checked:el.value;
 }
 out.savedAt=Date.now();
 return out;
}
function setInboxDraftStatus(text,ok=true){
 const el=$("inboxDraftStatus");if(!el)return;
 el.textContent=text;el.style.color=ok?"var(--green)":"var(--muted)";
}
function saveInboxDraftNow(){
 try{
  localStorage.setItem(INBOX_DRAFT_KEY,JSON.stringify(readInboxDraft()));
  setInboxDraftStatus(`下書き保存済み ✓ ${new Date().toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}`,true);
 }catch(e){setInboxDraftStatus("下書きを保存できません",false)}
}
function scheduleInboxDraftSave(){
 clearTimeout(inboxDraftTimer);setInboxDraftStatus("入力中…",false);
 inboxDraftTimer=setTimeout(saveInboxDraftNow,350);
}
function restoreInboxDraft(){
 let d=null;try{d=JSON.parse(localStorage.getItem(INBOX_DRAFT_KEY)||"null")}catch(e){}
 if(!d)return;
 for(const id of inboxDraftFieldIds()){
  const el=$(id);if(!el||!(id in d))continue;
  if(el.type==="checkbox")el.checked=!!d[id];else el.value=d[id];
 }
 if($("captureChecklistArea")&&$("captureHasChecklist"))$("captureChecklistArea").style.display=$("captureHasChecklist").checked?"block":"none";
 const t=d.savedAt?new Date(d.savedAt).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"}):"";
 setInboxDraftStatus(`下書きを復元しました${t?`（${t}）`:""}`,true);
}
function clearInboxDraft(){
 clearTimeout(inboxDraftTimer);
 try{localStorage.removeItem(INBOX_DRAFT_KEY)}catch(e){}
 setInboxDraftStatus("下書きなし",false);
}

function addInbox(text,type="",time=Date.now(),url="",options={}){
 const raw=String(text||"").trim(),title=String(options.title||"").trim()||raw.split("\n")[0].slice(0,50);
 if(!title&&!raw)return;
 const combined=(title+" "+raw).trim(),d=load(),c=type||classify(combined).type;
 d.inbox.push({id:uid(),text:raw,title:title||"無題",time,classification:c,candidate:c,status:options.status||"実施",destination:options.destination||"record",recordMode:options.recordMode||"single",tags:options.tags||[],checklist:options.checklist||[],url,done:false});
 save(d);render();
}

function addTaskFromCapture(){
 const title=($("captureTitle")?.value||"").trim();
 const text=($("captureText")?.value||"").trim();
 const tags=($("captureTags")?.value||"").split(/[,、]/).map(v=>v.trim()).filter(Boolean);
 const when=new Date($("captureTime")?.value||"").getTime()||Date.now();
 const taskText=text||title;
 if(!taskText){alert("タスク内容を入力してください。");return}
 const d=load();
 d.inbox=d.inbox||[];
 d.inbox.push({
  id:uid(),
  title:title||taskText.split("\n")[0].slice(0,50),
  text:taskText,
  time:when,
  classification:"タスク",
  candidate:"タスク",
  status:"実施",
  destination:"record",
  recordMode:"single",
  tags:[...new Set([...tags,"タスク"])],
  checklist:[],
  url:"",
  done:false,
  doneAt:0,
  createdAt:Date.now(),
  updatedAt:Date.now()
 });
 save(d);
 clearInboxDraft();
 $("captureTitle").value="";
 $("captureText").value="";
 $("captureTags").value="";
 if($("captureChecklistItems"))$("captureChecklistItems").value="";
 if($("captureHasChecklist"))$("captureHasChecklist").checked=false;
 if($("captureChecklistArea"))$("captureChecklistArea").style.display="none";
 render();
 if(typeof renderTodayHub==="function")renderTodayHub();
}
function renderInbox(){const d=load(),f=$("inboxFilter").value;let a=d.inbox.slice().sort((a,b)=>b.time-a.time);if(f==="pending")a=a.filter(x=>!x.done);if(f==="done")a=a.filter(x=>x.done);
 $("inboxList").innerHTML=a.length?a.map(x=>`<div class="card ${x.done?"archived":"candidate"}"><div class="row"><b>${esc(x.title)}</b><span class="time">${fmt(x.time)}</span></div><p>${nl(x.text)}</p><span class="badge gold">分類：${esc(getClassification(x,"メモ"))}</span>${x.status?`<span class="badge">${esc(statusLabel(x.status))}</span>`:""}${x.destination?`<span class="badge">${x.destination==="stack"?"積み重ねる記録":x.destination==="history"?"挑戦履歴":"記録庫"}</span>`:""}<div class="row" style="margin-top:8px"><div>${(x.tags||[]).length?x.tags.map(t=>`<span class="badge">#${esc(t)}</span>`).join(""):'<span class="small">タグなし</span>'}</div><button class="ghost editInboxTags" data-id="${x.id}">タグ編集</button></div>${(x.checklist||[]).length?`<div class="card"><b>チェック項目</b>${x.checklist.map(i=>`<div class="listitem">□ ${esc(checklistItemName(i))}</div>`).join("")}</div>`:""}${x.url?`<div>${mediaPreview(x.url)}</div><p><a class="link" target="_blank" href="${esc(x.url)}">${esc(x.url)}</a></p>`:""}<div class="wrap" style="margin-top:10px">${x.done?`<span class="badge green">整理済み</span>${linkedRecordForInbox(d,x.id)?'<span class="badge">→ 記録庫へ整理済み</span>':""}<button type="button" class="secondary organizeInbox" data-id="${x.id}">振り分け変更</button>`:`<button type="button" class="secondary organizeInbox" data-id="${x.id}">確認して整理</button>`}<button class="secondary editInbox" data-id="${x.id}">編集</button><button class="danger delInbox" data-id="${x.id}">削除</button></div></div>`).join(""):'<div class="empty">受信箱は空です。</div>';
 document.querySelectorAll(".organize").forEach(b=>b.onclick=()=>openOrganize(b.dataset.id));document.querySelectorAll(".editInbox").forEach(b=>b.onclick=()=>openEdit("inbox",b.dataset.id));
document.addEventListener("click",e=>{
 const btn=e.target.closest(".organizeInbox");
 if(!btn)return;
 e.preventDefault();
 e.stopPropagation();
 const id=btn.dataset.id;
 if(!id)return;
 try{openOrganize(id)}catch(err){console.error(err);alert("整理画面を開けませんでした。エラー: "+err.message)}
});

document.querySelectorAll(".editInboxTags").forEach(b=>b.onclick=()=>{
 const d=load(),x=d.inbox.find(v=>v.id===b.dataset.id);if(!x)return;
 const val=prompt("タグ（カンマ区切り）",(x.tags||[]).join(", "));if(val===null)return;
 x.tags=val.split(/[,、]/).map(v=>v.trim()).filter(Boolean);save(d);renderInbox();
});document.querySelectorAll(".delInbox").forEach(b=>b.onclick=()=>{
 if(!confirm("この受信箱データを削除しますか？\n整理済みの記録庫データは残ります。"))return;
 const d=load();d.inbox=d.inbox.filter(x=>x.id!==b.dataset.id);save(d);render();
});
}
function openOrganize(id){
 const confirmBtn=$("confirmOrganize");if(confirmBtn){confirmBtn.disabled=false;confirmBtn.textContent="この内容で記録へ";}
 const x=load().inbox.find(r=>r.id===id);if(!x)return;
 const lines=String(x.text||"").split("\n"),first=(lines.shift()||"").trim(),rest=lines.join("\n").trim();
 $("orgId").value=id;$("orgDestination").value=x.destination==="history"?"history":"record";$("orgRecordMode").value=(x.destination==="stack"||x.recordMode==="grouped"||x.stackParentId)?"grouped":"single";
 const routeBox=$("orgCurrentRoute");
 if(routeBox){
  if(x.done){
   const route=x.recordMode==="grouped"&&x.stackParentName?`現在：${x.stackParentName}${x.stackDayId?" ＞ 子ページ":""}${x.stackEntryType?` ＞ ${x.stackEntryType}`:""}`:x.destination==="history"?"現在：挑戦・実施履歴":"現在：単独記録";
   routeBox.textContent=route+"（ここから振り分けを変更できます）";routeBox.style.display="block";
  }else routeBox.style.display="none";
 }$("orgType").value=getClassification(x,"メモ");$("orgStatus").value=x.status||"実施";toggleOrgDestination();
 $("orgTitle").value=x.title||first||"無題";
 $("orgText").value=x.text||"";
 $("orgTags").value=(x.tags||[]).join(", ");$("orgHistoryName").value=x.title||"";
 refreshOrganizerStack(x.stackParentId||"");
 if($("orgStackCreateNew"))$("orgStackCreateNew").checked=!x.stackParentId;
 refreshOrganizerEntryTypes(x.stackEntryType||"");
 if($("orgStackNewName"))$("orgStackNewName").value=x.stackParentName||x.title||"";if($("orgStackNewRole"))$("orgStackNewRole").value="";if($("orgStackMinutes"))$("orgStackMinutes").value="";$("organizeDialog").showModal();
}
function toggleOrgDestination(){
 const dest=$("orgDestination").value;
 const grouped=dest==="record"&&$("orgRecordMode")?.value==="grouped";
 $("orgStackFields").style.display=grouped?"block":"none";
 $("orgHistoryFields").style.display=dest==="history"?"block":"none";
 if(grouped){refreshOrganizerStack($("orgStackParent")?.value||"");}
}
async function organize(){
 const clickedBtn=$("confirmOrganize");if(clickedBtn){clickedBtn.textContent="処理中…";clickedBtn.disabled=true;}
 const resetOrganizeButton=()=>{if(clickedBtn){clickedBtn.disabled=false;clickedBtn.textContent="この内容で記録へ";}};
 const d=load(),x=d.inbox.find(r=>r.id===$("orgId").value);if(!x)return;
 const dest=$("orgDestination").value,type=$("orgType").value,title=$("orgTitle").value.trim()||"無題",bodyText=$("orgText").value,tags=$("orgTags").value.split(/[,、]/).map(x=>x.trim()).filter(Boolean);
 const grouped=dest==="record"&&$("orgRecordMode").value==="grouped";
 let groupedParentId="",groupedDayId="";

 if(grouped){
  // Parent-child record: same archive, grouped presentation.
  let parentId=$("orgStackParent").value;
  let parent=d.stackParents.find(v=>v.id===parentId)||null;
  if($("orgStackCreateNew").checked||!parent){
   parent={id:uid(),name:$("orgStackNewName").value.trim()||title,category:type,role:$("orgStackNewRole").value.trim(),tags:structuredClone(tags),time:x.time||Date.now(),createdAt:Date.now(),updatedAt:Date.now()};
   d.stackParents.push(parent);parentId=parent.id;
  }

  let existing=d.stackEntries.find(e=>e.sourceInboxId===x.id);
  let day=null;

  // 「既存のページへ追加」を選んだ場合は、その選択を最優先。
  if($("orgStackDay").value==="existing"){
   day=d.stackDays.find(v=>v.id===$("orgStackExistingDay").value&&v.parentId===parentId)||null;
  }

  // 同じ親ページ内での再編集なら、以前の子ページを維持。
  if(!day&&existing){
   const oldDay=d.stackDays.find(v=>v&&v.id===existing.dayId);
   if(oldDay&&oldDay.parentId===parentId)day=oldDay;
  }

  // 親ページを変更した、または以前のページが無い場合は新しい子ページを作る。
  if(!day){day=nextStackDay(parentId,d);day.time=x.time;d.stackDays.push(day)}

  const payload={parentId,dayId:day.id,entryType:$("orgStackEntryType").value,title,text:bodyText,time:x.time,status:$("orgStatus").value||"実施",minutes:Number($("orgStackMinutes").value)||0,tags:structuredClone(tags),url:x.url||"",checklist:structuredClone(x.checklist||[]),sourceInboxId:x.id,updatedAt:Date.now()};

  // 同じ受信箱記事を別の子ページへ追加する場合、
  // 既存の子記録を移動・上書きせず、新しい子記録として追加する。
  const existingDay=existing?d.stackDays.find(v=>v&&v.id===existing.dayId):null;
  if(existing&&existing.dayId===day.id&&existingDay?.parentId===parentId){
   Object.assign(existing,payload);
  }else{
   d.stackEntries.push({id:uid(),...payload,createdAt:Date.now()});
  }

  parent.updatedAt=Date.now();
  groupedParentId=parentId;groupedDayId=day.id;
  x.destination="stack";x.recordMode="grouped";x.stackParentId=parentId;x.stackParentName=parent.name;x.stackDayId=day.id;x.stackEntryType=$("orgStackEntryType").value;
  // Remove an obsolete standalone copy of the same inbox if one exists.
  d.records=d.records.filter(r=>r.sourceInboxId!==x.id);
 }else if(dest==="record"){
  // Standalone record.
  x.destination="record";x.recordMode="single";
  delete x.stackParentId;delete x.stackParentName;delete x.stackDayId;delete x.stackEntryType;
  d.stackEntries=d.stackEntries.filter(e=>e.sourceInboxId!==x.id);
  const existing=d.records.find(r=>r.sourceInboxId===x.id);
  if(existing){
   existing.title=title;existing.text=bodyText;existing.time=x.time;setClassification(existing,type);existing.tags=structuredClone(tags);existing.status=$("orgStatus").value||"実施";existing.checklist=structuredClone(x.checklist||[]);existing.url=x.url||"";existing.updatedAt=Date.now();
  }else{
   const rec={id:uid(),title,text:bodyText,time:x.time,classification:type,type,category:type,tags:structuredClone(tags),status:$("orgStatus").value||"実施",checklist:structuredClone(x.checklist||[]),url:x.url||"",sourceInboxId:x.id,createdAt:Date.now(),updatedAt:Date.now()};
   setClassification(rec,type);d.records.push(rec);
  }
 }else if(dest==="history"){
  x.destination="history";x.recordMode="single";
  delete x.stackParentId;delete x.stackParentName;delete x.stackDayId;delete x.stackEntryType;
  d.stackEntries=d.stackEntries.filter(e=>e.sourceInboxId!==x.id);
  d.records=d.records.filter(r=>r.sourceInboxId!==x.id);
  const name=$("orgHistoryName").value.trim()||title;
  let item=d.historyItems.find(i=>i.name===name);
  if(!item){item={id:uid(),name,category:type==="FF14"?"FF14":type==="TRPG"?"TRPG":"生活",targetDays:0,tags,createdAt:Date.now()};d.historyItems.push(item)}
  d.historyEvents.push({id:uid(),itemId:item.id,time:x.time,status:$("orgStatus").value||"実施",minutes:Number($("orgHistoryMinutes").value)||0,note:bodyText||title});
 }

 x.done=true;setClassification(x,type);x.status=$("orgStatus").value||x.status||"実施";x.title=title;x.text=bodyText;x.tags=tags;

 // 受信箱→親子ページ整理は、永続保存が終わるまで画面を閉じない。
 const btn=clickedBtn||$("confirmOrganize");
 const oldLabel="この内容で記録へ";
 if(btn){btn.disabled=true;btn.textContent="保存中…";}
 save(d);

 try{
  await IDB_WRITE_CHAIN;

  // grouped の場合、保存直後に子記録がLIVE_DATAへ存在することを確認。
  if(grouped){
   const saved=(LIVE_DATA.stackEntries||[]).find(e=>e&&e.sourceInboxId===x.id&&e.dayId===groupedDayId);
   if(!saved)throw new Error("選択した子ページに子記録が作成されませんでした");

   // 子記録の所属親は stackDay.parentId で確認する。
   const savedDay=(LIVE_DATA.stackDays||[]).find(v=>v&&v.id===groupedDayId);
   if(!savedDay||savedDay.parentId!==groupedParentId)throw new Error("子記録の親ページ紐付けを確認できませんでした");

   // IndexedDBからも読み返して永続化を確認。
   const persisted=await idbRead();
   const persistedEntry=(persisted?.stackEntries||[]).find(e=>e&&e.sourceInboxId===x.id&&e.dayId===groupedDayId);
   const persistedDay=(persisted?.stackDays||[]).find(v=>v&&v.id===groupedDayId);
   if(!persistedEntry||!persistedDay||persistedDay.parentId!==groupedParentId)throw new Error("選択した子ページへの永続保存を確認できませんでした");
  }

  if(btn){btn.textContent="この内容で記録へ";btn.disabled=false;}
  $("organizeDialog").close();
  render();
 }catch(err){
  console.error("organize durable save failed",err);
  if(btn){btn.disabled=false;btn.textContent=oldLabel||"この内容で記録へ";}
  setSaveStatus("⚠ 親子記録の保存を確認できません",false);
  alert("親子ページへの保存を確認できませんでした。受信箱の内容は残しています。\n\n"+err.message);
 }
}

document.addEventListener("click",e=>{
 const btn=e.target.closest?.("#confirmOrganize");
 if(!btn)return;
 e.preventDefault();
 if(btn.disabled)return;
 Promise.resolve(organize()).catch(err=>{console.error("organize click failed",err);const b=$("confirmOrganize");if(b){b.disabled=false;b.textContent="この内容で記録へ";}alert("振り分け処理でエラーが発生しました。\n"+err.message);});
});




function repairGroupedInboxLinks(){
 const d=load();let changed=false,repaired=0;
 d.stackParents=Array.isArray(d.stackParents)?d.stackParents:[];
 d.stackDays=Array.isArray(d.stackDays)?d.stackDays:[];
 d.stackEntries=Array.isArray(d.stackEntries)?d.stackEntries:[];

 for(const x of (d.inbox||[])){
  if(!x||!x.done||x.recordMode!=="grouped"||!x.stackParentId)continue;
  if(d.stackEntries.some(e=>e&&e.sourceInboxId===x.id))continue;

  const parent=d.stackParents.find(p=>p.id===x.stackParentId);
  if(!parent)continue;

  let day=x.stackDayId?d.stackDays.find(v=>v.id===x.stackDayId):null;
  if(!day){
   day=nextStackDay(parent.id,d);
   day.time=x.time||Date.now();
   d.stackDays.push(day);
   x.stackDayId=day.id;
  }

  d.stackEntries.push({
   id:uid(), parentId:parent.id, dayId:day.id,
   entryType:x.stackEntryType||"記録・メモ",
   title:x.title||"無題", text:x.text||"",
   time:x.time||Date.now(), status:x.status||"実施", minutes:0,
   tags:structuredClone(x.tags||[]), url:x.url||"",
   checklist:structuredClone(x.checklist||[]),
   sourceInboxId:x.id, createdAt:Date.now(), updatedAt:Date.now()
  });
  parent.updatedAt=Date.now();
  changed=true;repaired++;
 }
 if(changed)save(d);
 return repaired;
}

function linkedRecordForInbox(d,inboxId){
 return d.records.find(r=>r.sourceInboxId===inboxId)||null;
}
function linkedInboxForRecord(d,record){
 return record?.sourceInboxId?d.inbox.find(i=>i.id===record.sourceInboxId)||null:null;
}
function syncInboxToRecord(d,inbox){
 const rec=linkedRecordForInbox(d,inbox.id);if(!rec)return null;
 rec.title=inbox.title||rec.title||"無題";
 rec.text=inbox.text||"";
 rec.time=inbox.time||rec.time||Date.now();
 rec.type=inbox.candidate||rec.type||"日常";
 rec.category=rec.type;
 rec.status=inbox.status||rec.status||"実施";
 rec.url=inbox.url||"";
 rec.tags=Array.isArray(inbox.tags)?structuredClone(inbox.tags):(rec.tags||[]);
 rec.checklist=Array.isArray(inbox.checklist)?structuredClone(inbox.checklist):(rec.checklist||[]);
 rec.updatedAt=Date.now();
 return rec;
}
function syncRecordToInbox(d,rec){
 const inbox=linkedInboxForRecord(d,rec);if(!inbox)return null;
 inbox.title=rec.title||inbox.title||"無題";
 inbox.text=rec.text||"";
 inbox.time=rec.time||inbox.time||Date.now();
 inbox.candidate=rec.type||inbox.candidate||"日常";
 inbox.status=rec.status||inbox.status||"実施";
 inbox.url=rec.url||"";
 inbox.tags=Array.isArray(rec.tags)?structuredClone(rec.tags):(inbox.tags||[]);
 inbox.checklist=Array.isArray(rec.checklist)?structuredClone(rec.checklist):(inbox.checklist||[]);
 inbox.done=true;
 inbox.updatedAt=Date.now();
 return inbox;
}

function updateEditUrlPreview(){const u=$("editUrl").value.trim();$("editUrlPreview").innerHTML=u?mediaPreview(u):""}
function openEdit(kind,id){
 $("editUrlLabel").style.display="block";$("editUrl").style.display="block";$("editUrlPreview").innerHTML="";
 $("editStatusLabel").style.display="block";$("editStatus").style.display="block";
 $("editType").innerHTML='<option>FF14</option><option>TRPG</option><option>買い物</option><option>食事</option><option>体調</option><option>日常</option><option>予定</option><option>メモ</option>';
 $("editTags").setAttribute("type","text");$("editTagsLabel").textContent="タグ（カンマ区切り）";$("editTimeLabel").textContent="日時";

 const d=load();let x;
 $("editKind").value=kind;$("editId").value=id;
 $("editTagsLabel").style.display="block";$("editTags").style.display="block";
 $("editTimeLabel").style.display="block";$("editTime").style.display="block";
 if(kind==="inbox"){
  x=d.inbox.find(v=>v.id===id);if(!x)return;
  $("editType").value=getClassification(x,"日常");$("editStatus").value=x.status||"実施";$("editTitle").value=x.title||"";
  $("editText").value=x.text||"";$("editUrl").value=x.url||"";$("editTags").value="";updateEditUrlPreview();
  $("editTime").value=localValue(x.time||Date.now());
 }else if(kind==="record"){
  x=d.records.find(v=>v.id===id);if(!x)return;
  $("editType").value=getClassification(x,"日常");$("editStatus").value=x.status||"実施";$("editTitle").value=x.title||"";
  $("editText").value=x.text||"";$("editUrl").value=x.url||"";$("editTags").value=(x.tags||[]).join(", ");updateEditUrlPreview();
  $("editTime").value=localValue(x.time||Date.now());
 }else if(kind==="shopping"){
  x=d.shopping.find(v=>v.id===id);if(!x)return;
  $("editType").value=x.category||"その他";$("editStatusLabel").style.display="none";$("editStatus").style.display="none";$("editTitle").value=x.name||"";
  $("editText").value=x.memo||"";$("editTags").value="";
  $("editUrlLabel").style.display="none";$("editUrl").style.display="none";$("editUrlPreview").innerHTML="";$("editTagsLabel").style.display="none";$("editTags").style.display="none";
  $("editTimeLabel").style.display="none";$("editTime").style.display="none";
 }else if(kind==="purchase"){
  x=d.purchases.find(v=>v.id===id);if(!x)return;
  $("editType").innerHTML='<option>在庫あり</option><option>使用中</option><option>消費済み</option>';
  $("editType").value=x.status||"在庫あり";$("editStatusLabel").style.display="none";$("editStatus").style.display="none";$("editTitle").value=x.name||x.text||"";
  $("editText").value=x.memo||"";$("editTagsLabel").textContent="消費日時";$("editTags").style.display="block";$("editTagsLabel").style.display="block";
  $("editTags").value=x.consumedTime?localValue(x.consumedTime):"";
  $("editTags").setAttribute("type","datetime-local");
  $("editTimeLabel").style.display="block";$("editTime").style.display="block";
  $("editTimeLabel").textContent="購入日時";$("editTime").value=localValue(x.time||Date.now());
 }
 $("editDialog").showModal();
}
function saveEdited(){
 const d=load(),kind=$("editKind").value,id=$("editId").value;
 if(kind==="inbox"){
  const x=d.inbox.find(v=>v.id===id);if(!x)return;
  setClassification(x,$("editType").value);x.status=$("editStatus").value||"実施";x.title=$("editTitle").value.trim()||"無題";
  x.text=$("editText").value;x.url=$("editUrl").value.trim();x.tags=x.tags||[];x.time=new Date($("editTime").value).getTime()||x.time;
 }else if(kind==="record"){
  const x=d.records.find(v=>v.id===id);if(!x)return;
  setClassification(x,$("editType").value);x.status=$("editStatus").value||"実施";x.title=$("editTitle").value.trim()||"無題";
  x.text=$("editText").value;x.url=$("editUrl").value.trim();x.tags=$("editTags").value.split(/[,、]/).map(v=>v.trim()).filter(Boolean);
  x.time=new Date($("editTime").value).getTime()||x.time;
 }else if(kind==="shopping"){
  const x=d.shopping.find(v=>v.id===id);if(!x)return;
  x.category=$("editType").value;x.name=$("editTitle").value.trim()||"無題";
  x.memo=$("editText").value;
 }else if(kind==="purchase"){
  const x=d.purchases.find(v=>v.id===id);if(!x)return;
  x.name=$("editTitle").value.trim()||"購入";
  x.memo=$("editText").value;
  x.status=$("editType").value||"在庫あり";
  x.time=new Date($("editTime").value).getTime()||x.time||Date.now();
  const consumed=new Date($("editTags").value).getTime();
  x.consumedTime=Number.isFinite(consumed)?consumed:(x.status==="消費済み"?(x.consumedTime||Date.now()):null);
 }
 save(d);$("editDialog").close();render();
}


function openRecordDetail(id){
 const x=load().records.find(v=>v.id===id);if(!x)return;
 $("recordDetailTitle").textContent=x.title||"記録詳細";
 $("recordDetailBody").innerHTML=`<div class="${statusClass(x.status)}"><div class="wrap"><span class="badge">${esc(getClassification(x,"日常"))}</span><span class="badge">${esc(statusLabel(x.status))}</span><span class="time">${fmt(x.time)}</span></div><p>${nl(x.text||"")}</p>${(x.checklist||[]).length?`<div class="card"><b>チェック項目</b>${x.checklist.map(i=>`<label class="listitem" style="display:block;color:var(--text)"><input class="recordChecklistToggle" data-record="${x.id}" data-item="${i.id||""}" data-name="${esc(checklistItemName(i))}" type="checkbox" style="width:auto" ${i.done?"checked":""}> ${esc(checklistItemName(i))}</label>`).join("")}</div>`:""}${x.url?mediaPreview(x.url):""}${x.url?`<p><a class="link" target="_blank" href="${esc(x.url)}">${esc(x.url)}</a></p>`:""}<div>${(x.tags||[]).map(t=>`<span class="badge">#${esc(t)}</span>`).join("")}</div></div>`;
 $("recordDetailDialog").showModal();
 document.querySelectorAll(".recordChecklistToggle").forEach(c=>c.onchange=()=>{
  const d=load(),r=d.records.find(v=>v.id===c.dataset.record);if(!r)return;
  const item=(r.checklist||[]).find(i=>(i.id&&i.id===c.dataset.item)||(!i.id&&checklistItemName(i)===c.dataset.name));
  if(item&&typeof item==="object")item.done=c.checked;
  save(d);renderRecords();
 });
}


function renderRecordGroups(){
 const d=load(),target=$("recordGroupedList");if(!target)return;
 // 親子ページは通常記録の検索・分類・状態フィルターから独立させる。
 // 下の記録一覧をFF14等で絞っても、親子ページが消えないようにする。
 const parents=[...(Array.isArray(d.stackParents)?d.stackParents:[])]
  .filter(Boolean)
  .filter(p=>!currentRecordCategoryFilter||String(p.category||"その他")===currentRecordCategoryFilter)
  .sort((a,b)=>(Number(b.updatedAt||b.createdAt)||0)-(Number(a.updatedAt||a.createdAt)||0));
 const orphanDays=(d.stackDays||[]).filter(day=>!(d.stackParents||[]).some(p=>p.id===day.parentId)).length;
 target.innerHTML=`<div class="card" style="border-color:var(--green)"><b>親子ページ${currentRecordCategoryFilter?`：${esc(currentRecordCategoryFilter)}`:""}</b><div class="small">表示中の親 ${parents.length}件 ／ 全子ページ ${(d.stackDays||[]).length}件 ／ 全子記録 ${(d.stackEntries||[]).length}件${orphanDays?` ／ 親を失った子ページ ${orphanDays}件`:""}</div><div class="small">古いバックアップからの自動復元・自動統合は停止しました。</div></div>` + (parents.length?parents.map(p=>{
  const days=stackDaysFor(p.id,d);
  const allEntries=days.flatMap(day=>stackEntriesFor(day.id,d));
  const filteredDays=days.map(day=>({day,entries:stackEntriesFor(day.id,d)}));
  const totalMinutes=allEntries.reduce((n,e)=>n+Number(e.minutes||0),0);
  const ps=stackParentStats(p.id,d);
  return `<details class="card record-parent ${statusClass(p.status||"実施")}" id="parentDetails_${p.id}">
   <summary style="cursor:pointer">
    <span class="row">
     <span><b>🔗 ${esc(p.name)}</b>${p.role?` <span class="badge">${esc(p.role)}</span>`:""}</span>
     <span><span class="badge ${p.category==="FF14"?"gold":p.category==="TRPG"?"purple":""}">${esc(p.category||"その他")}</span> <span class="badge">${days.length}日・段階</span> <span class="badge">${esc(statusLabel(p.status||"実施"))}</span></span>
    </span>
   </summary>
   <div class="wrap" style="margin:8px 0">
    <button type="button" class="primary parentDetailBtn" data-id="${p.id}">詳細</button>
    <button type="button" class="secondary parentStatusBtn" data-id="${p.id}" data-status="完了">完了</button>
    <button type="button" class="secondary parentStatusBtn" data-id="${p.id}" data-status="延期">延期</button>
    <button type="button" class="secondary parentStatusBtn" data-id="${p.id}" data-status="中止">中止</button>
    <button type="button" class="secondary parentStatusBtn" data-id="${p.id}" data-status="取消">取消</button>
    <button type="button" class="secondary inlineParentEditStart" data-id="${p.id}">編集</button>
    <button type="button" class="ghost inlineParentDateEdit" data-id="${p.id}">親ページ日付を変更</button>
    <button type="button" class="danger unifiedParentDelete" data-id="${p.id}">削除</button>
   </div>
   <div class="small" style="margin:8px 0">${ps.first?`開始 ${new Date(ps.first).toLocaleDateString("ja-JP")} ／ `:""}${ps.last?`最終 ${new Date(ps.last).toLocaleDateString("ja-JP")} ／ `:""}${ps.elapsed!==null?`経過 ${ps.elapsed}日 ／ `:""}子記録 ${allEntries.length}件${totalMinutes?` ／ 合計 ${formatDuration(totalMinutes)}`:""} ${(p.tags||[]).map(t=>`#${esc(t)}`).join(" ")}</div>
   <div id="parentView_${p.id}" class="card">
    <div><b>親記録の概要</b><div class="small">${p.summary?esc(p.summary):"概要・全体感想はまだありません。"}</div></div>
   </div>
   <div id="parentEdit_${p.id}" class="card" style="display:none">
    <label>親記録名</label><input class="inlineParentName" data-id="${p.id}" value="${esc(p.name)}">
    <label>役割・種類</label><input class="inlineParentRole" data-id="${p.id}" value="${esc(p.role||"")}">
    <label>タグ</label><input class="inlineParentTags" data-id="${p.id}" value="${esc((p.tags||[]).join(", "))}">
    <label>状態</label><select class="inlineParentStatus" data-id="${p.id}">
      <option value="実施" ${(p.status||"実施")==="実施"?"selected":""}>実施</option>
      <option value="完了" ${p.status==="完了"?"selected":""}>完了</option>
      <option value="延期" ${p.status==="延期"?"selected":""}>延期</option>
      <option value="中止" ${p.status==="中止"?"selected":""}>中止</option>
      <option value="取消" ${p.status==="取消"?"selected":""}>取消</option>
    </select>
    <label>親ページ日付</label><input class="inlineParentDate" data-id="${p.id}" type="datetime-local" value="${toLocalInput(p.time||p.createdAt||Date.now())}">
    <label>概要・全体感想</label><textarea class="inlineParentSummary" data-id="${p.id}">${esc(p.summary||"")}</textarea>
    <div class="wrap">
      <button type="button" class="primary inlineParentSave" data-id="${p.id}">保存</button>
      <button type="button" class="secondary inlineParentCancel" data-id="${p.id}">キャンセル</button>
    </div>
   </div>
   ${filteredDays.length?filteredDays.map(({day,entries})=>`<details class="card" style="margin-left:10px">
      <summary style="cursor:pointer"><span class="row"><b>${esc(day.label)}</b><span><span class="time">${fmt(day.time)}</span> <span class="badge">${entries.length}件</span></span></span></summary>
      <div class="wrap" style="margin:8px 0">
        <button type="button" class="secondary stackEditDayInline" data-day="${day.id}">見出し変更</button>
        <button type="button" class="ghost stackEditDayDateInline" data-day="${day.id}">ページ日付を変更</button>
        <button type="button" class="ghost stackDayMoveUp" data-day="${day.id}" title="ひとつ上へ">↑ 上へ</button>
        <button type="button" class="ghost stackDayMoveDown" data-day="${day.id}" title="ひとつ下へ">↓ 下へ</button>
      </div>
      <div style="margin-top:8px">${entries.length?entries.map(e=>`<details class="listitem ${statusClass(e.status)}" style="display:block">
        <summary style="cursor:pointer;list-style:none">
          <div class="row">
            <b>${esc(e.entryType||"記録")}${e.title?`：${esc(e.title)}`:""}</b>
            <span><span class="badge">${esc(statusLabel(e.status))}</span>${e.minutes?` <span class="badge">${formatDuration(e.minutes)}</span>`:""}</span>
          </div>
          <div class="small">${esc((e.text||"").slice(0,120))}${(e.text||"").length>120?"…":""}</div>
        </summary>
        <div class="wrap" style="margin:8px 0">
          <button type="button" class="primary childDetailBtn" data-id="${e.id}">詳細</button>
          <button type="button" class="secondary childStatusBtn" data-id="${e.id}" data-status="完了">完了</button>
          <button type="button" class="secondary childStatusBtn" data-id="${e.id}" data-status="延期">延期</button>
          <button type="button" class="secondary childStatusBtn" data-id="${e.id}" data-status="中止">中止</button>
          <button type="button" class="secondary childStatusBtn" data-id="${e.id}" data-status="取消">取消</button>
          <button type="button" class="secondary inlineChildEditStart" data-id="${e.id}">編集</button>
          <button type="button" class="danger unifiedChildDelete" data-id="${e.id}">削除</button>
        </div>
        <div id="childView_${e.id}" class="card" style="margin-top:8px">
          ${e.text?`<div>${nl(e.text)}</div>`:'<div class="small">本文なし</div>'}
          ${(e.tags||[]).length?`<div style="margin-top:8px">${e.tags.map(t=>`<span class="badge">#${esc(t)}</span>`).join("")}</div>`:""}
          ${e.url?`<div style="margin-top:8px">${mediaPreview(e.url)}</div>`:""}
          ${(e.checklist||[]).length?`<div class="card" style="margin-top:8px"><b>チェック項目</b><div class="small">□をクリックすると、その場で状態を保存します。</div>${e.checklist.map((i,idx)=>`<label class="listitem" style="display:flex;align-items:center;gap:8px;color:var(--text);cursor:pointer"><input class="liveRecordChecklist" data-entry="${e.id}" data-index="${idx}" type="checkbox" style="width:auto;min-width:18px;height:18px" ${i.done?"checked":""}> <span class="${i.done?"checkDone":""}">${esc(checklistItemName(i))}</span></label>`).join("")}</div>`:""}

        </div>
        <div id="childEdit_${e.id}" class="card" style="display:none;margin-top:8px">
          <label>子記録の種類</label><input class="inlineChildType" data-id="${e.id}" value="${esc(e.entryType||"記録")}">
          <label>タイトル</label><input class="inlineChildTitle" data-id="${e.id}" value="${esc(e.title||"")}">
          <label>本文</label><textarea class="inlineChildText" data-id="${e.id}">${esc(e.text||"")}</textarea>
          <div class="inline2">
            <div><label>状態</label><select class="inlineChildStatus" data-id="${e.id}">
              <option value="実施" ${(e.status||"実施")==="実施"?"selected":""}>実施</option>
              <option value="完了" ${e.status==="完了"?"selected":""}>完了</option>
              <option value="延期" ${e.status==="延期"?"selected":""}>延期</option>
              <option value="中止" ${e.status==="中止"?"selected":""}>中止</option>
              <option value="取消" ${e.status==="取消"?"selected":""}>取消</option>
            </select></div>
            <div><label>実施時間（分）</label><input class="inlineChildMinutes" data-id="${e.id}" type="number" min="0" value="${Number(e.minutes||0)}"></div>
          </div>
          <label>タグ</label><input class="inlineChildTags" data-id="${e.id}" value="${esc((e.tags||[]).join(", "))}">
          <label>画像・参考URL</label><input class="inlineChildUrl" data-id="${e.id}" value="${esc(e.url||"")}">
          <label>チェック項目（1行に1つ）</label><textarea class="inlineChildChecklist" data-id="${e.id}">${esc(checklistToLines(e.checklist))}</textarea>
          <div class="wrap">
            <button type="button" class="primary inlineChildSave" data-id="${e.id}">保存</button>
            <button type="button" class="secondary inlineChildCancel" data-id="${e.id}">キャンセル</button>
          </div>
        </div>
       </details>`).join(""):'<div class="empty">この日・段階には記録がありません。</div>'}</div>
    </details>`).join(""):'<div class="empty">表示条件に合う子記録はありません。</div>'}
   
  </details>`;
 }).join(""):'<div class="empty">親子でつながった記録はまだありません。上の診断で「子ページ」または「子記録」が1件以上なら、復旧対象として表示処理を確認できます。</div>');

 document.querySelectorAll(".parentDetailBtn").forEach(b=>b.onclick=()=>{
  const el=$("parentDetails_"+b.dataset.id);if(el)el.open=true;
 });
 document.querySelectorAll(".parentStatusBtn").forEach(b=>b.onclick=()=>{
  const d=load(),p=d.stackParents.find(v=>v.id===b.dataset.id);if(!p)return;
  p.status=b.dataset.status;
  if(p.status==="完了"&&!p.completedAt)p.completedAt=Date.now();
  if(p.status!=="完了")p.completedAt=null;
  p.updatedAt=Date.now();save(d);renderRecords();
 });
 document.querySelectorAll(".unifiedParentDelete").forEach(b=>b.onclick=()=>{
  if(!confirm("この親記録と、その下の日・子記録をすべて削除しますか？"))return;
  const d=load(),dayIds=d.stackDays.filter(x=>x.parentId===b.dataset.id).map(x=>x.id);
  d.stackParents=d.stackParents.filter(x=>x.id!==b.dataset.id);
  d.stackDays=d.stackDays.filter(x=>x.parentId!==b.dataset.id);
  d.stackEntries=d.stackEntries.filter(x=>!dayIds.includes(x.dayId));
  save(d);renderRecords();
 });
 document.querySelectorAll(".childDetailBtn").forEach(b=>b.onclick=()=>{
  const btn=b.closest("details");if(btn)btn.open=true;
 });
 document.querySelectorAll(".childStatusBtn").forEach(b=>b.onclick=()=>{
  const d=load(),e=d.stackEntries.find(v=>v.id===b.dataset.id);if(!e)return;
  e.status=b.dataset.status;e.updatedAt=Date.now();save(d);renderRecords();
 });
 document.querySelectorAll(".inlineParentEditStart").forEach(b=>b.onclick=()=>{
  const id=b.dataset.id;$("parentView_"+id).style.display="none";$("parentEdit_"+id).style.display="block";
 });
 document.querySelectorAll(".inlineParentDateEdit").forEach(b=>b.onclick=()=>{
  openStackDateDialog("parent",b.dataset.id);
 });
 document.querySelectorAll(".stackEditDayDateInline").forEach(b=>b.onclick=()=>{
  openStackDateDialog("day",b.dataset.day);
 });
 document.querySelectorAll(".inlineParentCancel").forEach(b=>b.onclick=()=>{
  const id=b.dataset.id;$("parentEdit_"+id).style.display="none";$("parentView_"+id).style.display="block";
 });
 document.querySelectorAll(".inlineParentSave").forEach(b=>b.onclick=()=>{
  const id=b.dataset.id,d=load(),p=d.stackParents.find(v=>v.id===id);if(!p)return;
  p.name=document.querySelector(`.inlineParentName[data-id="${id}"]`).value.trim()||p.name;
  p.role=document.querySelector(`.inlineParentRole[data-id="${id}"]`).value.trim();
  p.tags=document.querySelector(`.inlineParentTags[data-id="${id}"]`).value.split(/[,、]/).map(v=>v.trim()).filter(Boolean);
  p.status=document.querySelector(`.inlineParentStatus[data-id="${id}"]`).value;
  if(p.status==="完了"&&!p.completedAt)p.completedAt=Date.now();
  if(p.status!=="完了")p.completedAt=null;
  const dateInput=document.querySelector(`.inlineParentDate[data-id="${id}"]`)?.value;
  if(dateInput){
    const t=new Date(dateInput).getTime();
    if(Number.isFinite(t))p.time=t;
  }
  p.summary=document.querySelector(`.inlineParentSummary[data-id="${id}"]`).value;
  p.updatedAt=Date.now();save(d);renderRecords();
 });
 document.querySelectorAll(".inlineChildEditStart").forEach(b=>b.onclick=()=>{
  const id=b.dataset.id;$("childView_"+id).style.display="none";$("childEdit_"+id).style.display="block";
 });
 document.querySelectorAll(".inlineChildCancel").forEach(b=>b.onclick=()=>{
  const id=b.dataset.id;$("childEdit_"+id).style.display="none";$("childView_"+id).style.display="block";
 });
 document.querySelectorAll(".inlineChildSave").forEach(b=>b.onclick=()=>{
  const id=b.dataset.id,d=load(),e=d.stackEntries.find(v=>v.id===id);if(!e)return;
  e.entryType=document.querySelector(`.inlineChildType[data-id="${id}"]`).value.trim()||"記録";
  e.title=document.querySelector(`.inlineChildTitle[data-id="${id}"]`).value.trim();
  e.text=document.querySelector(`.inlineChildText[data-id="${id}"]`).value;
  e.status=document.querySelector(`.inlineChildStatus[data-id="${id}"]`).value;
  e.minutes=Number(document.querySelector(`.inlineChildMinutes[data-id="${id}"]`).value)||0;
  e.tags=document.querySelector(`.inlineChildTags[data-id="${id}"]`).value.split(/[,、]/).map(v=>v.trim()).filter(Boolean);
  e.url=document.querySelector(`.inlineChildUrl[data-id="${id}"]`).value.trim();
  const oldItems=e.checklist||[];
  e.checklist=checklistFromLines(document.querySelector(`.inlineChildChecklist[data-id="${id}"]`).value,oldItems);
  e.updatedAt=Date.now();save(d);renderRecords();
 });
 document.querySelectorAll(".unifiedChildDelete").forEach(b=>b.onclick=()=>{
  if(!confirm("この子記録を削除しますか？"))return;
  const d=load();d.stackEntries=d.stackEntries.filter(e=>e.id!==b.dataset.id);save(d);renderRecords();
 });
 document.querySelectorAll(".stackEditDayInline").forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();editStackDay(b.dataset.day)});
 document.querySelectorAll(".stackDayMoveUp").forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();moveStackDay(b.dataset.day,-1)});
 document.querySelectorAll(".stackDayMoveDown").forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();moveStackDay(b.dataset.day,1)});
 document.querySelectorAll(".liveRecordChecklist").forEach(c=>c.onchange=()=>{
  const d=load(),e=d.stackEntries.find(v=>v.id===c.dataset.entry);if(!e)return;
  const idx=Number(c.dataset.index);
  if(!Array.isArray(e.checklist)||!e.checklist[idx])return;
  if(typeof e.checklist[idx]!=="object")e.checklist[idx]={id:uid(),name:checklistItemName(e.checklist[idx]),done:false};
  e.checklist[idx].done=c.checked;
  e.updatedAt=Date.now();
  save(d);
  const text=c.parentElement?.querySelector("span");
  if(text)text.classList.toggle("checkDone",c.checked);
 });

}

function bindRecordParentCreate(){
 const dateInput=$("recordParentCreateDate");
 if(dateInput&&!dateInput.value)dateInput.value=toLocalInput(Date.now());
 const btn=$("recordParentCreateBtn");
 if(!btn)return;
 btn.onclick=()=>{
  const name=$("recordParentCreateName").value.trim();
  if(!name)return alert("親ページ名を入力してください");
  const d=load(),raw=$("recordParentCreateDate").value;
  const t=raw?new Date(raw).getTime():Date.now();
  const parent={id:uid(),name,category:$("recordParentCreateCategory").value,role:$("recordParentCreateRole").value.trim(),tags:$("recordParentCreateTags").value.split(/[,、]/).map(v=>v.trim()).filter(Boolean),status:"実施",time:Number.isFinite(t)?t:Date.now(),createdAt:Date.now(),updatedAt:Date.now()};
  d.stackParents=d.stackParents||[];d.stackDays=d.stackDays||[];d.stackEntries=d.stackEntries||[];
  d.stackParents.push(parent);
  save(d);
  $("recordParentCreateName").value="";$("recordParentCreateRole").value="";$("recordParentCreateTags").value="";$("recordParentCreateDate").value=toLocalInput(Date.now());
  renderRecords();
  const el=$("parentDetails_"+parent.id);if(el){el.open=true;el.scrollIntoView({behavior:"smooth",block:"start"});}
 };
}

function renderRecords(){
 // 親子ページの描画エラーで通常記録一覧まで消えないよう完全分離。
 try{renderRecordGroups()}catch(e){
   console.error("parent/child record render error",e);
   const g=$("recordGroupedList");
   if(g)g.innerHTML='<div class="card" style="border-color:var(--red)"><b>親子ページの表示でエラーが発生しました</b><div class="small">通常記録は下にそのまま表示します。親子データは削除していません。v0.9336では親子描画で欠けていた日付変換関数を復旧しました。</div></div>';
 }
 try{bindRecordParentCreate()}catch(e){console.error("parent create bind error",e)}
 const d=load();
 const summary=$("recordClassificationSummary");
 if(summary){const counts={};(d.records||[]).forEach(x=>{const c=getClassification(x);counts[c]=(counts[c]||0)+1});summary.textContent=Object.entries(counts).map(([k,v])=>`${k}:${v}`).join(" ／ ")||"記録なし"}
 const search=$("recordSearch"),filter=$("recordFilter"),statusFilter=$("recordStatusFilter");
 const q=(search?.value||"").toLowerCase(),f=filter?.value||"",sf=statusFilter?.value||"";
 let a=(d.records||[]).slice().sort((a,b)=>(b.time||0)-(a.time||0)).filter(x=>(!f||getClassification(x)===f)&&(!sf||(x.status||"実施")===sf)&&(!q||JSON.stringify(x).toLowerCase().includes(q)));
 const list=$("recordList");
 if(!list)return;
 list.innerHTML=a.length?a.map(x=>`<div class="card ${statusClass(x.status)}"><div class="row"><div><b>${esc(x.title)}</b><div class="time">${fmt(x.time)}</div></div><div><span class="badge ${getClassification(x)==="FF14"?"gold":getClassification(x)==="TRPG"?"purple":""}">${esc(getClassification(x))}</span><span class="badge">${esc(statusLabel(x.status))}</span></div></div><p>${nl(x.text)}</p>${(x.checklist||[]).length?`<div class="card"><b>チェック項目</b>${x.checklist.map(i=>`<div class="listitem">${i.done?"☑":"□"} ${esc(checklistItemName(i))}</div>`).join("")}</div>`:""}${x.url?mediaPreview(x.url):""}<div>${(x.tags||[]).map(t=>`<span class="badge">#${esc(t)}</span>`).join("")}</div><div class="wrap">${x.sourceInboxId?'<span class="badge">元：受信箱</span>':""}<button class="primary openRecordDetail" data-id="${x.id}">詳細</button><button class="ghost setRecordStatus" data-id="${x.id}" data-status="完了">完了</button><button class="ghost setRecordStatus" data-id="${x.id}" data-status="延期">延期</button><button class="ghost setRecordStatus" data-id="${x.id}" data-status="中止">中止</button><button class="ghost setRecordStatus" data-id="${x.id}" data-status="取消">取消</button><button class="secondary editRecord" data-id="${x.id}">編集</button><button class="danger delRecord" data-id="${x.id}">削除</button></div></div>`).join(""):'<div class="empty">該当する記録はありません。</div>';
 // 親子ページ内の子記録も、同じデータを複製せず記録庫から参照表示する。
 const rawChildEntries=Array.isArray(d.stackEntries)?d.stackEntries:[];
 const childRows=rawChildEntries.map(e=>{
  const day=(d.stackDays||[]).find(v=>v.id===e.dayId);
  const parent=day?(d.stackParents||[]).find(v=>v.id===day.parentId):null;
  const category=parent?.category||"その他";
  return {e,day,parent,category};
 }).filter(row=>!currentRecordCategoryFilter||row.category===currentRecordCategoryFilter)
   .sort((x,y)=>(Number(y.e.time)||0)-(Number(x.e.time)||0));
 const childHtml=childRows.length?childRows.map(({e,day,parent,category})=>`<div class="card ${statusClass(e.status)}" style="border-left:4px solid var(--blue)">
  <div class="row"><div><b>${esc(e.title||e.entryType||"子記録")}</b><div class="time">${fmt(e.time)}</div></div><div><span class="badge ${category==="FF14"?"gold":category==="TRPG"?"purple":""}">${esc(category)}</span><span class="badge">${esc(statusLabel(e.status))}</span></div></div>
  <div class="small" style="margin:6px 0">🔗 ${esc(parent?.name||"親不明")} ＞ ${esc(day?.label||"ページ不明")} ＞ ${esc(e.entryType||"記録")}</div>
  ${e.text?`<p>${nl(e.text)}</p>`:""}
  ${(e.tags||[]).length?`<div>${e.tags.map(tag=>`<span class="badge">#${esc(tag)}</span>`).join("")}</div>`:""}
  <div class="wrap" style="margin-top:8px"><span class="badge">親子ページ内の記録</span><button type="button" class="primary archiveChildDetail" data-id="${e.id}">詳細</button></div>
 </div>`).join(""):'<div class="empty">該当する子記録はありません。</div>';
 list.insertAdjacentHTML("beforeend",`<div class="card" style="border-color:var(--blue);margin-top:18px"><b>親子ページ内の子記録</b><div class="small">親子ページの中身を記録庫からも参照できます。親ページの分類に従って表示します。検索・状態フィルターとは独立表示です。保存されている子記録：${rawChildEntries.length}件（v0.9355は子記録本体を正規化で書き換えません）。</div></div>${childHtml}`);
 // 通常記録の操作ボタンは親子ページとは独立して必ず登録。
 document.querySelectorAll(".openRecordDetail").forEach(b=>b.onclick=()=>openRecordDetail(b.dataset.id));
 document.querySelectorAll(".editRecord").forEach(b=>b.onclick=()=>openEdit("record",b.dataset.id));
 document.querySelectorAll(".delRecord").forEach(b=>b.onclick=()=>{if(!confirm("この記録を削除しますか？"))return;const x=load();x.records=(x.records||[]).filter(v=>v.id!==b.dataset.id);save(x);renderRecords()});
 document.querySelectorAll(".setRecordStatus").forEach(b=>b.onclick=()=>{const x=load(),r=(x.records||[]).find(v=>v.id===b.dataset.id);if(!r)return;r.status=b.dataset.status;save(x);renderRecords()});
 document.querySelectorAll(".archiveChildDetail").forEach(b=>b.onclick=()=>openStackEntryDetail(b.dataset.id));
}
let currentRecordCategoryFilter="";
let dateArchiveDate=new Date();
function archiveDateKey(value){
 const d=value instanceof Date?value:new Date(value);
 if(Number.isNaN(d.getTime()))return "";
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function archiveDateFromKey(key){
 const [y,m,d]=String(key).split("-").map(Number);
 return new Date(y,m-1,d,12,0,0,0);
}
function renderDateArchive(){
 const box=$("dateArchiveList");if(!box)return;
 const d=load(),key=archiveDateKey(dateArchiveDate);
 $("dateArchivePicker").value=key;
 $("dateArchiveHeading").innerHTML=`<h2>${dateArchiveDate.toLocaleDateString("ja-JP",{year:"numeric",month:"long",day:"numeric",weekday:"short"})}</h2>`;
 const rows=[];
 const addTimeline=(date,category,title,text="",status="記録",extra={})=>{
  if(!date||archiveDateKey(date)!==key)return;
  rows.push({kind:"timeline",id:extra.id||"",time:Number(date)||new Date(date).getTime()||date,category:category||"その他",title:title||"記録",text:text||"",status,source:extra.source||"",tags:extra.tags||[],url:extra.url||"",checklist:extra.checklist||[]});
 };
 (d.records||[]).forEach(r=>{
  if(archiveDateKey(r.time||r.createdAt)!==key)return;
  rows.push({kind:"single",id:r.id,time:r.time||r.createdAt,category:getClassification(r,"その他"),title:r.title||"無題",text:r.text||"",status:r.status||"実施",tags:r.tags||[],url:r.url||"",checklist:r.checklist||[]});
 });
 (d.stackEntries||[]).forEach(e=>{
  if(archiveDateKey(e.time||e.createdAt)!==key)return;
  const dayObj=(d.stackDays||[]).find(x=>x.id===e.dayId);
  const resolvedParentId=e.parentId||dayObj?.parentId||"";
  const parent=(d.stackParents||[]).find(p=>p.id===resolvedParentId);
  rows.push({kind:"child",id:e.id,parentId:resolvedParentId,time:e.time||e.createdAt,category:parent?.category||"その他",title:e.title||e.entryType||"記録",parent:parent?.name||"親記録",dayLabel:dayObj?.label||"",text:e.text||"",status:e.status||"実施",tags:e.tags||[],url:e.url||"",checklist:e.checklist||[]});
 });

 // 今日ページで完了したタスク
 (d.inbox||[]).forEach(x=>{if(x?.done&&x?.doneAt)addTimeline(x.doneAt,getClassification(x,"タスク"),`☑ ${x.text||x.title||"タスク"}`,"","完了",{source:"今日・タスク",tags:normalizeTags(x.tags)})});
 (d.quickCaptures||[]).forEach(x=>{if(x?.kind==="タスク"&&x?.done&&x?.doneAt)addTimeline(x.doneAt,"タスク",`☑ ${x.text||x.title||"タスク"}`,"","完了",{source:"今日・タスク",tags:normalizeTags(x.tags)})});

 // Life Archive全体から、日付を持つ主要データを横断収集する。
 // 挑戦・実施履歴：historyEvents の実施日時を、その履歴項目名と分類付きで表示する。
 (d.historyEvents||[]).forEach(e=>{
  const item=(d.historyItems||[]).find(i=>i.id===e.itemId);
  const title=item?.name||"履歴";
  const category=item?.category||"履歴";
  const mins=Number(e.minutes||0);
  const metaText=[e.status||"実施",mins?`${mins}分`:""].filter(Boolean).join(" ／ ");
  addTimeline(e.time,category,title,e.note||"",metaText,{source:"挑戦・実施履歴",tags:item?.tags||[]});
 });
 (d.memories||[]).forEach(x=>addTimeline(x.date||x.time||x.createdAt,"思い出",x.title||x.name||"思い出",x.text||x.note||x.memo||"","記録",{source:"思い出",url:x.url||x.image||""}));
 (d.shoppingHistory||d.purchaseHistory||[]).forEach(x=>addTimeline(x.purchasedAt||x.date||x.time||x.createdAt,"買い物",x.title||x.name||"買い物",x.note||x.memo||"","購入",{source:"買い物"}));
 (d.cookingHistory||d.mealHistory||[]).forEach(x=>addTimeline(x.cookedAt||x.date||x.time||x.createdAt,"料理・食事",x.title||x.name||"料理・食事",x.note||x.memo||"","実施",{source:"料理"}));
 // FF14 Collectのユーザー情報：入手日を持つ収集品は日付アーカイブへ。
 try{
  const fc=ffProfileData(d)?.ffxivCollect||d?.ffxivCollect;
  const userMeta=fc?.userMeta||{};
  Object.entries(fc?.catalogs||{}).forEach(([kind,cat])=>{
   (cat?.items||[]).forEach(item=>{
    const meta=userMeta?.[kind]?.[String(item.id)]||{};
    const acquired=meta.acquiredDate||meta.acquiredAt||item.acquiredAt||item.obtainedAt;
    const labels={minions:"ミニオン",mounts:"マウント",achievements:"アチーブメント",hairstyles:"ヘアカタログ",emotes:"エモート",orchestrions:"オーケストリオン",frames:"ポートレート",spells:"青魔法",cards:"カード",facewear:"フェイスアクセ"};
    const checkText=(meta.checks||[]).length?`チェック ${meta.checks.filter(x=>x.done).length}/${meta.checks.length}`:"";
    const note=[meta.memo||"",checkText].filter(Boolean).join("\n");
    const displayName=kind==="achievements"?(fcJapaneseTitle(item,kind)||item.name_ja||item.name||"名称未取得"):(item.name_ja||item.name||"名称未取得");
    const ach=kind==="achievements"?fcAchievementLocalJP(item):null;
    const achCategory=ach?[ach.kind,ach.category].filter(Boolean).join(" ＞ "):"";
    const userTags=Array.isArray(meta.tags)?meta.tags:[];
    const archiveNote=[achCategory,note].filter(Boolean).join("\n");
    if(acquired)addTimeline(acquired,"FF14",kind==="achievements"?`🏆 アチーブメント「${displayName}」達成`:`${labels[kind]||kind}「${displayName}」入手`,archiveNote,kind==="achievements"?"達成":"入手",{source:kind==="achievements"?"アチーブ":"収集図鑑",tags:userTags});
    // チェックメモの完了日も、その日の進捗として残す。
    if(kind==="achievements"){
     (meta.checks||[]).forEach(c=>{
      if(!c?.doneAt)return;
      addTimeline(c.doneAt,"FF14",`☑️ アチーブ進捗「${displayName}」`,c.text||"チェック項目完了","進捗",{source:"アチーブ",tags:userTags});
     });
    }
   });
  });
 }catch(e){}

 // アチーブ進捗チェック：チェックした日時を日付アーカイブへ。
 Object.entries(d.achievementProgress||{}).forEach(([achId,st])=>{
  const ach=(typeof ACHIEVEMENT_DB!=="undefined"?ACHIEVEMENT_DB:[]).find(a=>String(a.id)===String(achId));
  const title=ach?.name||`#${achId}`;
  if(st?.doneAt)addTimeline(st.doneAt,"FF14",`アチーブメント「${title}」達成チェック`,st.note||"","達成",{source:"アチーブ"});
  (st?.checklist||[]).forEach(c=>{if(c.doneAt)addTimeline(c.doneAt,"FF14",`アチーブ進捗「${title}」`,c.name||c.text||"チェック項目完了","進捗",{source:"アチーブ"})});
 });
 const achRoots=[d.achievementFolders,d.achievementPlans,d.achievements].filter(Boolean);
 const seenAch=new Set();
 const walkAch=(node,parentTitle="アチーブメント")=>{
  if(!node||typeof node!=="object")return;
  if(Array.isArray(node)){node.forEach(x=>walkAch(x,parentTitle));return}
  const title=node.title||node.name||parentTitle;
  const checks=node.checks||node.checklist||node.items;
  if(Array.isArray(checks)){
   checks.forEach(c=>{
    if(!c||typeof c!=="object")return;
    const doneAt=c.doneAt||c.checkedAt||c.completedAt;
    if(doneAt){
     const sig=[title,c.id||"",doneAt].join("|");
     if(!seenAch.has(sig)){
      seenAch.add(sig);
      addTimeline(doneAt,"FF14",`アチーブ進捗「${title}」`,c.text||c.title||c.name||"チェック項目完了","進捗",{source:"アチーブ"});
     }
    }
   });
  }
  Object.entries(node).forEach(([k,v])=>{if(!["checks","checklist","items"].includes(k)&&v&&typeof v==="object")walkAch(v,title)});
 };
 achRoots.forEach(x=>walkAch(x));

  // バイカラージェム交換品
 if(typeof BICOLOR_ITEMS!=="undefined"){
  const bg=d.bicolor?.owned||{};
  BICOLOR_ITEMS.forEach(x=>{
   const st=bg[x.id];if(!st?.doneAt)return;
   const v=typeof bicolorVendor==="function"?bicolorVendor(x):{};
   addTimeline(st.doneAt,"FF14",`💎 バイカラージェム交換「${x.name}」`,`${x.zone} ／ ${x.cost}ジェム${v?.npc?` ／ ${v.npc}`:""}${st.memo?`\n${st.memo}`:""}`,"交換",{source:"バイカラージェム"});
  });
 }

  // 時間記録
 (d.activityLogs||[]).forEach(x=>{const ms=Math.max(0,Number(x.activeMs)||0),mins=Math.round(ms/60000),h=Math.floor(mins/60),m=mins%60,duration=h?`${h}時間${m?m+"分":""}`:`${m}分`;addTimeline(x.startedAt||x.date,"時間記録",`${x.category||"その他"}：${x.name||"活動"}`,x.memo||"",duration,{source:"時間記録"});});
 // ポモドーロは保存されている「今日」の実績を該当日に表示。
 try{
  const ps=JSON.parse(localStorage.getItem("life_archive_pomodoro_v1")||"{}");
  if(ps?.day===key&&Number(ps.todayCount)>0)addTimeline(key+"T12:00:00","集中",`ポモドーロ ${Number(ps.todayCount)}セット`,"","完了",{source:"ポモドーロ"});
 }catch(e){}

  rows.sort((a,b)=>(a.time||0)-(b.time||0));
 const counts={};rows.forEach(r=>counts[r.category]=(counts[r.category]||0)+1);
 $("dateArchiveSummary").innerHTML=`<span class="badge">記録 ${rows.length}件</span>`+Object.entries(counts).map(([k,v])=>`<span class="badge ${k==="FF14"?"gold":k==="TRPG"?"purple":""}">${esc(k)} ${v}</span>`).join("");
 box.innerHTML=rows.length?rows.map(r=>`<details class="card ${statusClass(r.status)}">
  <summary style="cursor:pointer">
   <div class="row"><b>${r.kind==="child"?`🔗 ${esc(r.parent)} → ${esc(r.dayLabel)} → `:""}${esc(r.title)}</b><span><span class="badge ${r.category==="FF14"?"gold":r.category==="TRPG"?"purple":""}">${esc(r.category)}</span> <span class="badge">${esc(statusLabel(r.status))}</span></span></div>
   <div class="small">${new Date(r.time).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"})}${r.text?` ／ ${esc(r.text.slice(0,100))}${r.text.length>100?"…":""}`:""}${r.kind==="timeline"&&r.source?` ／ ${esc(r.source)}`:""}</div>
  </summary>
  <div class="card" style="margin-top:8px">
   ${r.text?`<div>${nl(r.text)}</div>`:'<div class="small">本文なし</div>'}
   ${(r.tags||[]).length?`<div style="margin-top:8px">${r.tags.map(t=>`<span class="badge">#${esc(t)}</span>`).join("")}</div>`:""}
   ${r.url?`<div style="margin-top:8px">${mediaPreview(r.url)}</div>`:""}
   ${(r.checklist||[]).length?`<div class="card" style="margin-top:8px"><b>チェック項目</b>${r.checklist.map(i=>`<div class="listitem">${i.done?"☑":"☐"} ${esc(checklistItemName(i))}</div>`).join("")}</div>`:""}
   <div class="wrap" style="margin-top:8px">${r.kind==="single"?`<button class="secondary archiveOpenSingle" data-id="${r.id}">記録庫で開く</button>`:r.kind==="child"?`<button class="secondary archiveOpenParent" data-id="${r.parentId}">親子記録で開く</button>`:r.source==="アチーブ"?`<button class="secondary archiveOpenAchievements">アチーブメントを開く</button><span class="badge">${esc(r.source)}</span>`:r.source?`<span class="badge">${esc(r.source)}</span>`:""}</div>
  </div>
 </details>`).join(""):'<div class="empty">この日の記録はありません。</div>';
 document.querySelectorAll(".archiveOpenSingle").forEach(b=>b.onclick=()=>{switchView("records");setTimeout(()=>openRecordDetail(b.dataset.id),0)});
 document.querySelectorAll(".archiveOpenParent").forEach(b=>b.onclick=()=>{switchView("records");setTimeout(()=>{const p=$("parentDetails_"+b.dataset.id);if(p){p.open=true;p.scrollIntoView({behavior:"smooth",block:"start"})}},0)});
 document.querySelectorAll(".archiveOpenAchievements").forEach(b=>b.onclick=()=>{
  switchView("ffxivCollect");
  setTimeout(()=>{
   const kind=$("fcExplorerKind");if(kind){kind.value="achievements";renderFCExplorer()}
   $("fcExplorerList")?.scrollIntoView({behavior:"smooth",block:"start"});
  },0);
 });
}

function renderHome(){const d=load(),today=day(Date.now()),r=d.records.filter(x=>day(x.time)===today),i=d.inbox.filter(x=>!x.done);$("sToday").textContent=r.length;$("sInbox").textContent=i.length;$("sFF14").textContent=d.records.filter(x=>getClassification(x)==="FF14").length+(d.stackParents||[]).filter(p=>p.category==="FF14").length;$("sTRPG").textContent=d.records.filter(x=>getClassification(x)==="TRPG").length+(d.stackParents||[]).filter(p=>p.category==="TRPG").length;$("sLife").textContent=d.records.filter(x=>!["FF14","TRPG"].includes(x.type)).length;
 $("todayList").innerHTML=r.length?r.sort((a,b)=>a.time-b.time).map(x=>`<div class="listitem ${statusClass(x.status)}"><div class="row"><b>${new Date(x.time).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"})} ${esc(x.title)}</b><div><span class="badge">${esc(x.type)}</span><span class="badge">${esc(statusLabel(x.status))}</span></div></div><div>${nl(x.text)}</div>${x.url?mediaPreview(x.url):""}<div class="wrap" style="margin-top:9px"><button class="primary todayDetail" data-id="${x.id}">詳細</button><button class="secondary todayEdit" data-id="${x.id}">編集</button><button class="ghost todayStatus" data-id="${x.id}" data-status="完了">完了</button><button class="ghost todayStatus" data-id="${x.id}" data-status="延期">延期</button><button class="ghost todayStatus" data-id="${x.id}" data-status="中止">中止</button><button class="ghost todayStatus" data-id="${x.id}" data-status="取消">取消</button></div></div>`).join(""):'<div class="empty">今日はまだ整理済みの記録がありません。</div>';
 document.querySelectorAll(".todayDetail").forEach(b=>b.onclick=()=>openRecordDetail(b.dataset.id));
 document.querySelectorAll(".todayEdit").forEach(b=>b.onclick=()=>openEdit("record",b.dataset.id));
 document.querySelectorAll(".todayStatus").forEach(b=>b.onclick=()=>{const d=load(),x=d.records.find(v=>v.id===b.dataset.id);if(x){x.status=b.dataset.status;save(d);render()}});

}


function stackParentOptions(selected=""){
 const d=load(),items=d.stackParents.slice().sort((a,b)=>(b.updatedAt||b.createdAt)-(a.updatedAt||a.createdAt));
 return items.map(p=>`<option value="${p.id}" ${p.id===selected?"selected":""}>${esc(p.name)}${p.role?`（${esc(p.role)}）`:""}</option>`).join("");
}
function stackDaysFor(parentId,d=load()){return (Array.isArray(d.stackDays)?d.stackDays:[]).filter(x=>x&&x.parentId===parentId).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0))}
function stackEntriesFor(dayId,d=load()){return (Array.isArray(d.stackEntries)?d.stackEntries:[]).filter(x=>x&&x.dayId===dayId).sort((a,b)=>(Number(a.time)||0)-(Number(b.time)||0))}
function moveStackDay(dayId,direction){
 const d=load(),day=d.stackDays.find(x=>x.id===dayId);if(!day)return;
 const days=stackDaysFor(day.parentId,d);
 const index=days.findIndex(x=>x.id===dayId),targetIndex=index+direction;
 if(index<0||targetIndex<0||targetIndex>=days.length)return;
 const target=days[targetIndex];
 const currentOrder=Number(day.order)||index+1,targetOrder=Number(target.order)||targetIndex+1;
 day.order=targetOrder;target.order=currentOrder;
 const parent=d.stackParents.find(x=>x.id===day.parentId);if(parent)parent.updatedAt=Date.now();
 save(d);renderRecords();
 if(CURRENT_STACK_PARENT_ID===day.parentId)openStackDetail(day.parentId);
}
const ENTRY_TYPE_COMMON=["記録・メモ","画像・SS","チェックリスト","リンク・資料","ログ・データ","感想","結果・まとめ","その他"];
const ENTRY_TYPE_BY_CATEGORY={
 "TRPG":["セッション記録","ダイスログ","成長・報酬"],
 "FF14":["コンテンツ記録","攻略メモ","戦利品","進捗"],
 "生活":["日記","買い物","家事・片付け","出来事"],
 "健康":["体調記録","服薬・ケア","経過"],
 "家事":["家事記録","片付け","Before／After"],
 "買い物":["購入記録","価格メモ","在庫・消費"],
 "猫":["猫の記録","写真","体調・様子"],
 "制作":["制作記録","素材・進捗","完成記録"]
};
function entryTypesForCategory(category){
 const specific=ENTRY_TYPE_BY_CATEGORY[String(category||"")]||[];
 return [...specific,...ENTRY_TYPE_COMMON.filter(x=>!specific.includes(x))];
}
function fillEntryTypeSelect(select,category,preferred=""){
 if(!select)return;
 const types=entryTypesForCategory(category);
 if(preferred&&!types.includes(preferred))types.unshift(preferred);
 select.innerHTML=types.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
 select.value=preferred&&types.includes(preferred)?preferred:types[0];
}
function selectedParentCategory(parentId,d=load()){
 const p=(Array.isArray(d.stackParents)?d.stackParents:[]).find(x=>x&&x.id===parentId);
 return p?.category||$("orgType")?.value||"";
}
function refreshOrganizerEntryTypes(preferred=""){
 const d=load();
 const creatingNew=$("orgStackCreateNew")?.checked;
 const category=creatingNew?($("orgType")?.value||""):selectedParentCategory($("orgStackParent")?.value||"",d);
 fillEntryTypeSelect($("orgStackEntryType"),category,preferred||$("orgStackEntryType")?.value||"");
}
function refreshStackAddEntryTypes(parentId,preferred=""){
 const d=load(),parent=(Array.isArray(d.stackParents)?d.stackParents:[]).find(x=>x&&x.id===parentId);
 fillEntryTypeSelect($("stackAddEntryType"),parent?.category||"",preferred||$("stackAddEntryType")?.value||"");
}
function refreshOrganizerStack(parentId=""){
 const d=load(),sel=$("orgStackParent");if(!sel)return;
 sel.innerHTML=stackParentOptions(parentId);
 if(parentId&&[...sel.options].some(o=>o.value===parentId))sel.value=parentId;
 refreshOrganizerDays();
 refreshOrganizerEntryTypes();
}

function refreshOrganizerDays(){
 const d=load();
 const parentId=$("orgStackParent")?.value||"";
 const wrap=$("orgStackExistingDayWrap");
 const sel=$("orgStackExistingDay");
 if(!sel)return;

 if(!parentId){
  sel.innerHTML="";
  if(wrap)wrap.style.display="none";
  return;
 }

 const days=stackDaysFor(parentId,d);
 sel.innerHTML=days.length
  ? days.map(day=>`<option value="${day.id}">${esc(day.label)}${day.time?`（${new Date(day.time).toLocaleDateString("ja-JP")}）`:""}</option>`).join("")
  : '<option value="">既存の日・段階なし</option>';

 if($("orgStackDay")?.value==="existing"){
  if(wrap)wrap.style.display="block";
 }else{
  if(wrap)wrap.style.display="none";
 }
}

function nextStackDay(parentId,d){
 const days=stackDaysFor(parentId,d),n=days.length+1;
 return {id:uid(),parentId,order:n,label:`${n}ページ目`,time:Date.now(),status:"実施",createdAt:Date.now()};
}
function renderStacks(){
 const d=load(),q=$("stackSearch").value.trim().toLowerCase(),cat=$("stackCategoryFilter").value;
 const parents=d.stackParents.filter(p=>(!cat||p.category===cat)&&(!q||(p.name+" "+p.role+" "+(p.tags||[]).join(" ")).toLowerCase().includes(q))).sort((a,b)=>(b.updatedAt||b.createdAt)-(a.updatedAt||a.createdAt));
 $("stackList").innerHTML=parents.length?parents.map(p=>{
  const days=stackDaysFor(p.id,d),entries=days.flatMap(day=>stackEntriesFor(day.id,d)),done=entries.filter(e=>e.status==="完了").length;
  return `<article class="card">
   <div class="row"><div><h3 style="margin:0">${esc(p.name)}</h3><div>${(p.tags||[]).map(t=>`<span class="badge">#${esc(t)}</span>`).join("")}</div></div><div><span class="badge gold">${esc(p.category)}</span>${p.role?`<span class="badge">${esc(p.role)}</span>`:""}</div></div>
   <div class="small">実施日・段階 ${days.length} ／ 子記録 ${entries.length} ／ 完了記録 ${done}</div>
   <div class="card" style="margin-top:10px">
    ${days.length?days.slice(0,3).map(day=>`<div class="listitem"><div class="row"><b>${esc(day.label)}</b><span class="badge">${stackEntriesFor(day.id,d).length}件</span></div><div class="small">${fmt(day.time)}</div></div>`).join(""):'<div class="empty">まだ日・段階がありません。</div>'}
   </div>
   <div class="wrap"><button class="primary stackParentOpen" data-id="${p.id}">詳細を開く</button><button class="danger stackParentDelete" data-id="${p.id}">親記録を削除</button></div>
  </article>`;
 }).join(""):'<div class="empty">積み重ねる記録はまだありません。</div>';
 document.querySelectorAll(".stackParentOpen").forEach(b=>b.onclick=()=>openStackDetail(b.dataset.id));
 document.querySelectorAll(".stackEntryEdit").forEach(b=>b.onclick=()=>editStackEntry(b.dataset.id));
 document.querySelectorAll(".stackEntryDelete").forEach(b=>b.onclick=()=>{if(!confirm("この子記録を削除しますか？"))return;const d=load();d.stackEntries=d.stackEntries.filter(x=>x.id!==b.dataset.id);save(d);renderStacks()});
 document.querySelectorAll(".stackParentDelete").forEach(b=>b.onclick=()=>{if(!confirm("親記録と、その下の日・子記録をすべて削除しますか？"))return;const d=load(),dayIds=d.stackDays.filter(x=>x.parentId===b.dataset.id).map(x=>x.id);d.stackParents=d.stackParents.filter(x=>x.id!==b.dataset.id);d.stackDays=d.stackDays.filter(x=>x.parentId!==b.dataset.id);d.stackEntries=d.stackEntries.filter(x=>!dayIds.includes(x.dayId));save(d);renderStacks()});
}

let CURRENT_STACK_PARENT_ID="";
let CURRENT_STACK_ENTRY_ID="";

function stackParentStats(parentId,d=load()){
 const parent=d.stackParents.find(p=>p.id===parentId);
 const days=stackDaysFor(parentId,d);
 const entries=days.flatMap(day=>stackEntriesFor(day.id,d));
 const active=entries.filter(e=>e.status!=="取消");
 const totalMinutes=active.reduce((n,e)=>n+Number(e.minutes||0),0);
 // 親ページの進捗日は、ページ日時と子記録日時の両方から算出する。
 const parentTime=parent?.time||parent?.createdAt||null;
 const times=[parentTime,...days.map(x=>x.time),...active.map(x=>x.time)].filter(Boolean).sort((a,b)=>a-b);
 const latestEntry=[...active].sort((a,b)=>(b.time||b.updatedAt||b.createdAt||0)-(a.time||a.updatedAt||a.createdAt||0))[0]||null;
 const first=times[0]||null,last=times[times.length-1]||null;
 return {
  parent,days,entries,active,totalMinutes,
  first,last,elapsed:first&&last?daysBetween(first,last):null,
  latestEntry,
  completed:parent?.status==="完了"||false,
  completedAt:parent?.completedAt||null
 };
}

function openStackDetail(parentId){
 CURRENT_STACK_PARENT_ID=parentId;
 const d=load(),s=stackParentStats(parentId,d);
 if(!s.parent)return;
 $("stackDetailNav").style.display="block";
 $("stackDetailTitle").textContent=s.parent.name;
 $("stackDetailMeta").innerHTML=`<span class="badge gold">${esc(s.parent.category||"その他")}</span>${s.parent.role?`<span class="badge">${esc(s.parent.role)}</span>`:""}${(s.parent.tags||[]).map(t=>`<span class="badge">#${esc(t)}</span>`).join("")}${s.completed?'<span class="badge green">完走・完了</span>':""}<span class="time">親ページ日付：${fmt(s.parent.time||s.parent.createdAt)}</span>`;
 $("stackDetailSummary").innerHTML=`
  <div class="stat">開始日<b>${s.first?new Date(s.first).toLocaleDateString("ja-JP"):"—"}</b></div>
  <div class="stat">最終更新日<b>${s.last?new Date(s.last).toLocaleDateString("ja-JP"):"—"}</b></div>
  <div class="stat">経過日数<b>${s.elapsed!==null?s.elapsed+"日":"—"}</b></div>
  <div class="stat">ページ数<b>${s.days.length}</b></div>
  <div class="stat">記録件数<b>${s.entries.length}</b></div>
  <div class="stat">総時間<b>${formatDuration(s.totalMinutes)}</b></div>
  <div class="stat">状態<b>${esc(statusLabel(s.parent.status||"実施"))}</b></div>`;
 const latest=s.latestEntry;
 $("stackDetailOverview").innerHTML=`
  <div class="row"><b>概要</b><span class="small">${s.completedAt?`完了日：${new Date(s.completedAt).toLocaleDateString("ja-JP")}`:esc(statusLabel(s.parent.status||"実施"))}</span></div>
  <p>${nl(s.parent.summary||"親記録の概要や、完走後の全体感想は「親記録を編集」から追加できます。")}</p>
  <hr>
  <b>最新の記録</b>
  ${latest?`<div class="listitem ${statusClass(latest.status)}" style="margin-top:8px"><div class="row"><b>${esc(latest.entryType||"記録")}${latest.title?`：${esc(latest.title)}`:""}</b><span class="time">${fmt(latest.time)}</span></div>${latest.text?`<div style="margin-top:6px">${nl(latest.text)}</div>`:'<div class="small" style="margin-top:6px">本文なし</div>'}</div>`:'<div class="small" style="margin-top:8px">まだ子記録がありません。</div>'}`;
 $("stackDetailDays").innerHTML=s.days.length?s.days.map(day=>{
   const entries=stackEntriesFor(day.id,d);
   return `<details class="card stack-day" open>
    <summary style="cursor:pointer">
      <span class="row"><span><b>${esc(day.label)}</b> <span class="time">${fmt(day.time)}</span></span><span class="badge">${entries.length}件</span></span>
    </summary>
    <div style="margin-top:10px">
      ${entries.length?entries.map(e=>`<div class="listitem ${statusClass(e.status)}" data-entry="${e.id}">
        <div class="row"><b>${esc(e.entryType||"記録")}${e.title?`：${esc(e.title)}`:""}</b><span class="badge">${esc(statusLabel(e.status))}</span></div>
        <div class="time">${fmt(e.time)}${e.minutes?` ／ ${formatDuration(e.minutes)}`:""}</div>
        ${e.text?`<div style="margin-top:8px">${nl(e.text)}</div>`:'<div class="small" style="margin-top:8px">本文なし</div>'}
        ${(e.tags||[]).length?`<div style="margin-top:8px">${e.tags.map(t=>`<span class="badge">#${esc(t)}</span>`).join("")}</div>`:""}
        ${e.url?`<div style="margin-top:8px">${mediaPreview(e.url)}</div>`:""}
        ${(e.checklist||[]).length?`<div class="card" style="margin-top:8px"><b>チェック項目</b>${e.checklist.map(i=>`<div class="listitem">${i.done?"☑":"☐"} ${esc(checklistItemName(i))}</div>`).join("")}</div>`:""}
        <div class="wrap" style="margin-top:10px">
          <button type="button" class="primary stackEntryOpen" data-id="${e.id}">詳細</button>
          <button type="button" class="secondary stackEntryEditDirect" data-id="${e.id}">編集</button>
          <button type="button" class="danger stackEntryDeleteDirect" data-id="${e.id}">削除</button>
        </div>
      </div>`).join(""):'<div class="empty">このページの記録はまだありません。</div>'}
      <div class="wrap"><button class="primary stackAddEntryToDay" data-day="${day.id}">このページへ追加</button><button class="secondary stackEditDay" data-day="${day.id}">見出し変更</button><button class="ghost stackEditDayDate" data-day="${day.id}">ページ日付を変更</button><button class="ghost stackDayMoveUp" data-day="${day.id}">↑ 上へ</button><button class="ghost stackDayMoveDown" data-day="${day.id}">↓ 下へ</button></div>
    </div>
   </details>`;
 }).join(""):'<div class="empty">まだ日・段階がありません。</div>';
 document.querySelectorAll(".stackEntryOpen").forEach(b=>b.onclick=()=>openStackEntryDetail(b.dataset.id));
 document.querySelectorAll(".stackEntryEditDirect").forEach(b=>b.onclick=()=>editStackEntry(b.dataset.id));
 document.querySelectorAll(".stackEntryDeleteDirect").forEach(b=>b.onclick=()=>{if(!confirm("この子記録を削除しますか？"))return;const d2=load();d2.stackEntries=d2.stackEntries.filter(x=>x.id!==b.dataset.id);save(d2);openStackDetail(parentId)});
 document.querySelectorAll(".stackAddEntryToDay").forEach(b=>b.onclick=()=>openStackAddDialog(parentId,b.dataset.day));
 document.querySelectorAll(".stackEditDay").forEach(b=>b.onclick=()=>editStackDay(b.dataset.day));
 document.querySelectorAll(".stackEditDayDate").forEach(b=>b.onclick=()=>openStackDateDialog("day",b.dataset.day));
 document.querySelectorAll("#stackDetailDays .stackDayMoveUp").forEach(b=>b.onclick=()=>moveStackDay(b.dataset.day,-1));
 document.querySelectorAll("#stackDetailDays .stackDayMoveDown").forEach(b=>b.onclick=()=>moveStackDay(b.dataset.day,1));
 switchView("stackDetail");
}

function openStackEntryDetail(entryId){
 const d=load(),e=d.stackEntries.find(x=>x.id===entryId);if(!e)return;
 CURRENT_STACK_ENTRY_ID=entryId;
 const day=d.stackDays.find(x=>x.id===e.dayId);
 $("stackEntryDetailTitle").textContent=e.title||e.entryType||"子記録";
 $("stackEntryDetailBody").innerHTML=`
  <div class="wrap"><span class="badge gold">${esc(day?.label||"")}</span><span class="badge">${esc(e.entryType||"その他")}</span><span class="badge">${esc(statusLabel(e.status))}</span><span class="time">${fmt(e.time)}</span></div>
  <p>${nl(e.text||"")}</p>
  ${e.minutes?`<div class="card">実施時間：<b>${formatDuration(e.minutes)}</b></div>`:""}
  ${(e.tags||[]).length?`<div>${e.tags.map(t=>`<span class="badge">#${esc(t)}</span>`).join("")}</div>`:""}
  ${e.url?mediaPreview(e.url):""}
  ${(e.checklist||[]).length?`<div class="card"><b>チェック項目</b>${e.checklist.map(i=>`<div class="listitem">${i.done?"☑":"☐"} ${esc(checklistItemName(i))}</div>`).join("")}</div>`:""}`;
 $("stackEntryDetailDialog").showModal();
}

function openStackAddDialog(parentId,dayId=""){
 const d=load(),days=stackDaysFor(parentId,d);
 $("stackAddParentId").value=parentId;
 $("stackAddDayId").value=dayId;
 $("stackAddDaySelect").innerHTML=days.map(day=>`<option value="${day.id}" ${day.id===dayId?"selected":""}>${esc(day.label)}</option>`).join("");
 refreshStackAddEntryTypes(parentId);
 $("stackAddTitle").value="";
 $("stackAddText").value="";
 $("stackAddTime").value=localValue();
 $("stackAddStatus").value="実施";
 $("stackAddMinutes").value="";
 $("stackAddTags").value="";
 $("stackAddUrl").value="";
 $("stackAddChecklist").value="";
 $("stackAddDialog").showModal();
}

function addNewStackDay(parentId){
 const d=load(),day=nextStackDay(parentId,d);
 const label=prompt("ページ見出し",day.label);if(label===null)return;
 day.label=label.trim()||day.label;
 day.time=Date.now();
 d.stackDays.push(day);
 const parent=d.stackParents.find(x=>x.id===parentId);if(parent)parent.updatedAt=Date.now();
 save(d);openStackDetail(parentId);
}

function editStackDay(dayId){
 const d=load(),day=d.stackDays.find(x=>x.id===dayId);if(!day)return;
 const label=prompt("ページ見出し",day.label);if(label===null)return;
 day.label=label.trim()||day.label;
 save(d);openStackDetail(day.parentId);
}

function editStackParent(parentId){
 const d=load(),p=d.stackParents.find(x=>x.id===parentId);if(!p)return;
 const name=prompt("親記録名",p.name);if(name===null)return;
 const role=prompt("役割・種類",p.role||"");if(role===null)return;
 const summary=prompt("概要・全体の感想",p.summary||"");if(summary===null)return;
 p.name=name.trim()||p.name;p.role=role.trim();p.summary=summary;p.updatedAt=Date.now();
 save(d);openStackDetail(parentId);
}

function openStackDateDialog(kind,id){
 const d=load();
 const obj=kind==="parent"?d.stackParents.find(x=>x.id===id):d.stackDays.find(x=>x.id===id);
 if(!obj)return;
 const ms=obj.time||obj.createdAt||Date.now();
 $("stackDateKind").value=kind;$("stackDateId").value=id;$("stackDateValue").value=localValue(ms);
 $("stackDateDialogTitle").textContent=kind==="parent"?"親ページの日付を変更":"子ページの日付を変更";
 $("stackDateDialog").showModal();
}
function saveStackDate(){
 const kind=$("stackDateKind").value,id=$("stackDateId").value,raw=$("stackDateValue").value;
 if(!raw)return alert("日付を入力してください");
 const ms=new Date(raw).getTime();if(!Number.isFinite(ms))return alert("有効な日付を入力してください");
 const d=load(),obj=kind==="parent"?d.stackParents.find(x=>x.id===id):d.stackDays.find(x=>x.id===id);if(!obj)return;
 obj.time=ms;obj.updatedAt=Date.now();
 if(kind==="day"){const p=d.stackParents.find(x=>x.id===obj.parentId);if(p)p.updatedAt=Date.now()}
 save(d);$("stackDateDialog").close();
 if(kind==="parent")openStackDetail(id);else openStackDetail(obj.parentId);
}

function editStackEntry(id){
 const d=load(),e=d.stackEntries.find(x=>x.id===id);if(!e)return;
 const type=prompt("子記録の種類",e.entryType||"その他");if(type===null)return;
 const title=prompt("タイトル",e.title||"");if(title===null)return;
 const text=prompt("本文・感想・ログ",e.text||"");if(text===null)return;
 const url=prompt("画像・参考URL",e.url||"");if(url===null)return;
 const minutes=prompt("実施時間（分）",e.minutes||"");if(minutes===null)return;
 e.entryType=type.trim()||e.entryType;e.title=title;e.text=text;e.url=url;e.minutes=Number(minutes)||0;e.updatedAt=Date.now();save(d);
 if(CURRENT_STACK_PARENT_ID)openStackDetail(CURRENT_STACK_PARENT_ID);else renderStacks();
}

function dateOnly(ms){const d=new Date(ms);return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()}
function daysBetween(a,b){return Math.round((dateOnly(b)-dateOnly(a))/86400000)}
function formatDuration(mins){
 mins=Number(mins||0);if(!mins)return "—";
 const h=Math.floor(mins/60),m=mins%60;
 return h?`${h}時間${m?m+"分":""}`:`${m}分`;
}
function historyStats(item,d){
 const events=d.historyEvents.filter(e=>e.itemId===item.id&&e.status!=="取消").sort((a,b)=>a.time-b.time);
 const effective=events.filter(e=>["実施","完了"].includes(e.status));
 const first=effective[0],last=effective[effective.length-1],prev=effective[effective.length-2];
 const totalMinutes=effective.reduce((n,e)=>n+Number(e.minutes||0),0);
 return {
  events,effective,first,last,prev,totalMinutes,
  count:effective.length,
  span:first&&last?daysBetween(first.time,last.time):0,
  since:last?daysBetween(last.time,Date.now()):null,
  interval:prev&&last?daysBetween(prev.time,last.time):null
 };
}
function openHistoryLog(id){
 const item=load().historyItems.find(x=>x.id===id);if(!item)return;
 $("historyItemId").value=id;$("historyDialogTitle").textContent=`${item.name}：履歴を追加`;
 $("historyEventTime").value=localValue();$("historyEventStatus").value="実施";
 $("historyEventMinutes").value="";$("historyEventNote").value="";
 $("historyDialog").showModal();
}
function renderHistory(){
 const d=load(),q=$("historySearch").value.trim().toLowerCase(),cat=$("historyCategoryFilter").value;
 const items=d.historyItems.filter(x=>(!cat||x.category===cat)&&(!q||(x.name+" "+(x.tags||[]).join(" ")).toLowerCase().includes(q)));
 $("historyList").innerHTML=items.length?items.map(item=>{
  const s=historyStats(item,d),target=Number(item.targetDays||0);
  const due=target&&s.since!==null?s.since>=target:false;
  const recent=s.events.slice().sort((a,b)=>b.time-a.time).slice(0,8);
  return `<div class="card">
   <div class="row"><div><b>${esc(item.name)}</b><div>${(item.tags||[]).map(t=>`<span class="badge">#${esc(t)}</span>`).join("")}</div></div><span class="badge ${due?"gold":"green"}">${esc(item.category||"その他")}</span></div>
   <div class="stats" style="margin-top:10px">
    <div class="stat">最終日<b>${s.last?new Date(s.last.time).toLocaleDateString("ja-JP"):"—"}</b></div>
    <div class="stat">最終日から<b>${s.since===null?"—":s.since+"日"}</b></div>
    <div class="stat">前回間隔<b>${s.interval===null?"—":s.interval+"日"}</b></div>
    <div class="stat">実施回数<b>${s.count}</b></div>
    <div class="stat">総時間<b>${formatDuration(s.totalMinutes)}</b></div>
   </div>
   <div class="small" style="margin-top:9px">初回：${s.first?fmt(s.first.time):"—"} ／ 期間：${s.count?`${s.span}日`:"—"}${target?` ／ 目安：${target}日ごと`:""}</div>
   <div class="wrap" style="margin-top:10px"><button class="primary addHistoryEvent" data-id="${item.id}">今回を記録</button><button class="secondary editHistoryItem" data-id="${item.id}">項目編集</button><button class="danger deleteHistoryItem" data-id="${item.id}">項目削除</button></div>
   <details style="margin-top:10px"><summary>挑戦・実施履歴（${s.events.length}件）</summary>
   ${recent.length?recent.map(e=>`<div class="listitem ${statusClass(e.status)}"><div class="row"><b>${fmt(e.time)}</b><span class="badge">${esc(statusLabel(e.status))}</span></div><div>${e.minutes?formatDuration(e.minutes):""} ${esc(e.note||"")}</div><div class="wrap"><button class="ghost historyEventStatus" data-id="${e.id}" data-status="取消">取消</button><button class="danger deleteHistoryEvent" data-id="${e.id}">削除</button></div></div>`).join(""):'<div class="empty">履歴はまだありません。</div>'}
   </details>
  </div>`;
 }).join(""):'<div class="empty">履歴項目はまだありません。</div>';
 document.querySelectorAll(".addHistoryEvent").forEach(b=>b.onclick=()=>openHistoryLog(b.dataset.id));
 document.querySelectorAll(".editHistoryItem").forEach(b=>b.onclick=()=>{
  const d=load(),x=d.historyItems.find(v=>v.id===b.dataset.id);if(!x)return;
  const name=prompt("項目名",x.name);if(name===null)return;
  x.name=name.trim()||x.name;
  const target=prompt("目安間隔（日。不要なら空欄）",x.targetDays||"");if(target!==null)x.targetDays=Number(target)||0;
  save(d);renderHistory();
 });
 document.querySelectorAll(".deleteHistoryItem").forEach(b=>b.onclick=()=>{
  if(!confirm("項目とその履歴を削除しますか？ 取消で残したい場合は、各履歴を取消にしてください。"))return;
  const d=load();d.historyItems=d.historyItems.filter(x=>x.id!==b.dataset.id);d.historyEvents=d.historyEvents.filter(x=>x.itemId!==b.dataset.id);save(d);renderHistory();
 });
 document.querySelectorAll(".historyEventStatus").forEach(b=>b.onclick=()=>{const d=load(),x=d.historyEvents.find(v=>v.id===b.dataset.id);if(x){x.status=b.dataset.status;save(d);renderHistory()}});
 document.querySelectorAll(".deleteHistoryEvent").forEach(b=>b.onclick=()=>{if(confirm("この履歴を完全に削除しますか？")){const d=load();d.historyEvents=d.historyEvents.filter(x=>x.id!==b.dataset.id);save(d);renderHistory()}});
}


let cookingMode="now";
function parseCookNumber(v){
 const s=String(v??"").trim().replace(/／/g,"/");
 if(!s||/^(適量|少々|お好み|適宜|ひとつまみ|少量)$/u.test(s))return null;
 const mix=s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
 if(mix)return Number(mix[1])+Number(mix[2])/Number(mix[3]);
 const frac=s.match(/^(\d+)\/(\d+)$/);
 if(frac&&Number(frac[2]))return Number(frac[1])/Number(frac[2]);
 const n=Number(s);
 return Number.isFinite(n)?n:null;
}
function normalizeCookUnit(u){
 const s=String(u||"").trim().replace(/\s+/g,"");
 const map={"グラム":"g","ｇ":"g","G":"g","キログラム":"kg","Ｋｇ":"kg","ml":"ml","ｍｌ":"ml","mL":"ml","ミリリットル":"ml","L":"l","リットル":"l","個":"個","玉":"玉","袋":"袋","本":"本","枚":"枚","缶":"缶","パック":"パック","大さじ":"大さじ","小さじ":"小さじ"};
 return map[s]||s;
}
function splitNaturalCookIngredient(line){
 const s=String(line||"").trim().replace(/^[-・●○■□]\s*/,"");
 if(!s)return null;
 if(s.includes("|")){
  const [name,qraw,uraw]=s.split("|").map(x=>String(x||"").trim());
  const qty=parseCookNumber(qraw);
  return {name,qty,unit:normalizeCookUnit(uraw),rawQty:qraw};
 }
 // 「ごま油……小さじ1」「醤油 大さじ1」「砂糖 小さじ1/2」などを許容
 const natural=s.match(/^(.+?)(?:\s*[\.．…・:：]+\s*|\s+)(大さじ|小さじ)\s*([0-9０-９]+(?:\s*[\/／]\s*[0-9０-９]+)?|適量|少々)$/u);
 if(natural){
  const q=natural[3].replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0));
  return {name:natural[1].trim(),qty:parseCookNumber(q),unit:normalizeCookUnit(natural[2]),rawQty:q};
 }
 const tail=s.match(/^(.+?)(?:\s*[\.．…・:：]+\s*|\s+)([0-9０-９]+(?:\s*[\/／]\s*[0-9０-９]+)?)(\s*(?:g|kg|ml|mL|l|L|個|玉|袋|本|枚|缶|パック))$/u);
 if(tail){
  const q=tail[2].replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0));
  return {name:tail[1].trim(),qty:parseCookNumber(q),unit:normalizeCookUnit(tail[3]),rawQty:q};
 }
 return {name:s,qty:null,unit:"",rawQty:""};
}
function normalizeCookIngredient(ing){
 if(!ing)return {name:"",qty:null,unit:""};
 let name=String(ing.name||"").trim(),unit=normalizeCookUnit(ing.unit||""),qty=Number(ing.qty);
 qty=Number.isFinite(qty)?qty:null;
 // 旧版で「ごま油……小さじ1」の全体がnameに保存されたレシピをその場で救済
 if(name && qty==null && !unit){
  const parsed=splitNaturalCookIngredient(name);
  if(parsed && parsed.name!==name)return {name:parsed.name,qty:parsed.qty,unit:parsed.unit};
 }
 return {name,qty,unit};
}
function parseCookIngredients(v){
 return String(v||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(splitNaturalCookIngredient).filter(x=>x&&x.name).map(normalizeCookIngredient);
}
function cookIngredientsToText(a){return (a||[]).map(raw=>{const x=normalizeCookIngredient(raw);return `${x.name} | ${x.qty??""} | ${x.unit||""}`}).join("\n")}
function parseCookAlternatives(v){
 const out={};String(v||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean).forEach(line=>{const [a,b]=line.split("=");if(a&&b)out[a.trim()]=b.split(/[,、]/).map(x=>x.trim()).filter(Boolean)});return out;
}
function cookAlternativesToText(o){return Object.entries(o||{}).map(([k,v])=>`${k} = ${(v||[]).join(", ")}`).join("\n")}
function foodKey(s){return String(s||"").trim().toLowerCase()}
function foodStockMap(d){
 const m={};(d.foodInventory||[]).forEach(x=>{m[foodKey(x.name)]={...x,qty:Number(x.qty)||0,unit:normalizeCookUnit(x.unit||"")}});return m;
}
function cookUnitFactor(unit){
 const u=normalizeCookUnit(unit);
 if(u==="kg")return {base:"g",factor:1000};
 if(u==="g")return {base:"g",factor:1};
 if(u==="l")return {base:"ml",factor:1000};
 if(u==="ml")return {base:"ml",factor:1};
 return {base:u,factor:1};
}
function hasEnoughCookStock(stockItem,ingredient){
 if(!stockItem||Number(stockItem.qty)<=0)return false;
 const ing=normalizeCookIngredient(ingredient),need=ing.qty;
 if(need==null)return true;
 const su=cookUnitFactor(stockItem.unit),iu=cookUnitFactor(ing.unit);
 // 同じ単位（g↔kg、ml↔L含む）なら数量比較。それ以外は「在庫あり」を優先。
 if(su.base&&iu.base&&su.base===iu.base)return Number(stockItem.qty)*su.factor>=need*iu.factor;
 if(!ing.unit || !stockItem.unit)return true;
 return true;
}
function analyzeCookRecipe(r,d){
 const stock=foodStockMap(d),missing=[],usedAlt=[];
 for(const rawIng of r.ingredients||[]){
  const ing=normalizeCookIngredient(rawIng);
  const direct=stock[foodKey(ing.name)];
  let ok=hasEnoughCookStock(direct,ing);
  if(!ok){
   for(const alt of (r.alternatives?.[rawIng.name]||r.alternatives?.[ing.name]||[])){
    const a=stock[foodKey(alt)];
    if(hasEnoughCookStock(a,ing)){ok=true;usedAlt.push(`${ing.name}→${alt}`);break}
   }
  }
  if(!ok)missing.push({name:ing.name,need:ing.qty,unit:ing.unit||""});
 }
 return {possible:missing.length===0,missing,usedAlt};
}
function renderFoodInventory(){
 const d=load(),box=$("foodInventoryList");if(!box)return;
 const storageOrder=["冷蔵","冷凍","常温"];
 const normalized=(d.foodInventory||[]).map(x=>({...x,storage:x.storage||"冷蔵"}));
 const groups=storageOrder.map(storage=>({
  storage,
  rows:normalized.filter(x=>x.storage===storage).sort((a,b)=>(a.expiry||Infinity)-(b.expiry||Infinity)||a.name.localeCompare(b.name,"ja"))
 }));
 const unknown=normalized.filter(x=>!storageOrder.includes(x.storage)).sort((a,b)=>a.name.localeCompare(b.name,"ja"));
 if(unknown.length)groups.push({storage:"その他",rows:unknown});
 const total=normalized.length;
 box.innerHTML=total?groups.filter(g=>g.rows.length).map(g=>`<div style="margin-top:12px"><div class="row" style="margin-bottom:6px"><b>${g.storage==="冷蔵"?"🧊":g.storage==="冷凍"?"❄️":g.storage==="常温"?"📦":"📍"} ${esc(g.storage)}</b><span class="badge">${g.rows.length}件</span></div>${g.rows.map(x=>`<div class="listitem"><div class="row"><b>${esc(x.name)}</b><div class="wrap"><input class="foodQtyEdit" data-id="${x.id}" type="number" min="0" step="0.1" value="${x.qty}" style="width:75px"><span>${esc(x.unit||"")}</span><button class="danger foodDel" data-id="${x.id}">×</button></div></div><div class="row" style="margin-top:6px"><div class="small">${x.expiry?`期限：${localDateValue(x.expiry)}`:"期限なし"}</div><select class="foodStorageEdit" data-id="${x.id}" style="width:auto;min-width:92px"><option value="冷蔵" ${x.storage==="冷蔵"?"selected":""}>冷蔵</option><option value="冷凍" ${x.storage==="冷凍"?"selected":""}>冷凍</option><option value="常温" ${x.storage==="常温"?"selected":""}>常温</option></select></div></div>`).join("")}</div>`).join(""):'<div class="empty">食材在庫はまだありません。</div>';
 document.querySelectorAll(".foodQtyEdit").forEach(i=>i.onchange=()=>{const d=load(),x=d.foodInventory.find(v=>v.id===i.dataset.id);if(!x)return;x.qty=Math.max(0,Number(i.value)||0);save(d);renderCooking()});
 document.querySelectorAll(".foodStorageEdit").forEach(s=>s.onchange=()=>{const d=load(),x=d.foodInventory.find(v=>v.id===s.dataset.id);if(!x)return;x.storage=s.value||"冷蔵";x.updatedAt=Date.now();save(d);renderCooking()});
 document.querySelectorAll(".foodDel").forEach(b=>b.onclick=()=>{const d=load();d.foodInventory=d.foodInventory.filter(x=>x.id!==b.dataset.id);save(d);renderCooking()});
}
function renderCookSuggestions(){
 const d=load(),box=$("cookSuggest");if(!box)return;
 let rows=(d.cookingRecipes||[]).map(r=>({r,a:analyzeCookRecipe(r,d)}));
 if(cookingMode==="now")rows=rows.filter(x=>x.a.possible);
 else if(cookingMode==="one")rows=rows.filter(x=>x.a.missing.length===1);
 else rows=rows.filter(x=>!x.a.possible).sort((a,b)=>a.a.missing.length-b.a.missing.length).slice(0,30);
 box.innerHTML=rows.length?rows.map(({r,a})=>`<div class="listitem"><div class="row"><span><b>${esc(r.name)}</b> ${r.minutes?`<span class="badge">${r.minutes}分</span>`:""}</span><div class="wrap">${a.possible?`<span class="badge green">作れます</span>`:`<span class="badge gold">あと${a.missing.length}品</span>`}<button class="success cookMade" data-id="${r.id}">作った</button></div></div>${a.missing.length?`<div class="small">不足：${a.missing.map(x=>`${esc(x.name)}${x.need!=null?` ${x.need}${esc(x.unit)}`:""}`).join(" ／ ")}</div>`:""}${a.usedAlt.length?`<div class="small">代替：${a.usedAlt.map(esc).join(" ／ ")}</div>`:""}</div>`).join(""):'<div class="empty">該当する料理はありません。</div>';
 document.querySelectorAll(".cookMade").forEach(b=>b.onclick=()=>cookMade(b.dataset.id));
}
function cookMade(id){
 const d=load(),r=d.cookingRecipes.find(x=>x.id===id);if(!r)return;
 const a=analyzeCookRecipe(r,d);
 d.cookingHistory.push({id:uid(),recipeId:id,name:r.name,time:Date.now()});
 // Only deduct exact-name ingredients when units match conceptually; alternatives remain advisory.
 for(const ing of r.ingredients||[]){
  const x=d.foodInventory.find(v=>foodKey(v.name)===foodKey(ing.name));
  if(x&&ing.qty!=null&&Number(x.qty)>=ing.qty)x.qty=Math.max(0,Number(x.qty)-ing.qty);
 }
 save(d);renderCooking();
}
function clearCookForm(){
 ["cookName","cookMinutes","cookTags","cookIngredients","cookAlternatives","cookMemo"].forEach(id=>{if($(id))$(id).value=""});
 if($("cookSave")){delete $("cookSave").dataset.editId;$("cookSave").textContent="レシピを登録"}if($("cookCancel"))$("cookCancel").style.display="none";if($("cookFormTitle"))$("cookFormTitle").textContent="📖 レシピ登録";
}
function editCookRecipe(id){
 const d=load(),r=d.cookingRecipes.find(x=>x.id===id);if(!r)return;
 $("cookName").value=r.name;$("cookMinutes").value=r.minutes||"";$("cookTags").value=(r.tags||[]).join(", ");$("cookIngredients").value=cookIngredientsToText(r.ingredients);$("cookAlternatives").value=cookAlternativesToText(r.alternatives);$("cookMemo").value=r.memo||"";
 $("cookSave").dataset.editId=id;$("cookSave").textContent="レシピを更新";$("cookCancel").style.display="";$("cookFormTitle").textContent=`✏ ${r.name} を編集`;$("cookFormTitle").scrollIntoView({behavior:"smooth",block:"center"});
}
function renderCooking(){
 if(!$("cookRecipeList"))return;renderFoodInventory();renderCookSuggestions();
 const d=load(),q=($("cookSearch")?.value||"").trim().toLowerCase(),tag=($("cookTagFilter")?.value||"").trim().toLowerCase();
 let rows=(d.cookingRecipes||[]).filter(r=>{const hay=[r.name,...(r.tags||[]),...(r.ingredients||[]).map(x=>x.name)].join(" ").toLowerCase();return(!q||hay.includes(q))&&(!tag||(r.tags||[]).some(t=>t.toLowerCase().includes(tag)))});
 $("cookRecipeList").innerHTML=rows.length?rows.map(r=>{const count=(d.cookingHistory||[]).filter(h=>h.recipeId===r.id).length;return `<details class="card"><summary><b>${esc(r.name)}</b> <span class="small">作った回数 ${count}</span></summary><div style="margin-top:8px">${(r.tags||[]).map(t=>`<span class="badge">${esc(t)}</span>`).join(" ")}<div class="small" style="margin-top:8px">${(r.ingredients||[]).map(raw=>{const x=normalizeCookIngredient(raw);return `<div style="padding:2px 0">・${esc(x.name)}${x.qty!=null?` ${x.qty}${esc(x.unit||"")}`:""}</div>`}).join("")}</div>${r.memo?`<p>${nl(r.memo)}</p>`:""}<div class="wrap"><button class="success cookMade" data-id="${r.id}">作った</button><button class="secondary cookEdit" data-id="${r.id}">編集</button><button class="danger cookDelete" data-id="${r.id}">削除</button></div></div></details>`}).join(""):'<div class="empty">料理レシピはまだありません。</div>';
 document.querySelectorAll("#cookRecipeList .cookMade").forEach(b=>b.onclick=()=>cookMade(b.dataset.id));
 document.querySelectorAll(".cookEdit").forEach(b=>b.onclick=()=>editCookRecipe(b.dataset.id));
 document.querySelectorAll(".cookDelete").forEach(b=>b.onclick=()=>{if(!confirm("このレシピを削除しますか？"))return;const d=load();d.cookingRecipes=d.cookingRecipes.filter(x=>x.id!==b.dataset.id);save(d);renderCooking()});
}
function renderShopping(){const d=load();$("shopList").innerHTML=d.shopping.length?d.shopping.map(x=>`<div class="listitem"><label style="margin:0"><input class="shopCheck" data-id="${x.id}" type="checkbox" style="width:auto" ${x.done?"checked":""}> ${esc(x.name)}</label><div class="small">${esc(x.category||"")} ${esc(x.memo||"")}</div><div class="wrap" style="margin-top:8px"><button class="secondary editShop" data-id="${x.id}">編集</button><button class="danger delShop" data-id="${x.id}">削除</button></div></div>`).join(""):'<div class="empty">買い物候補はありません。</div>';
 document.querySelectorAll(".editShop").forEach(b=>b.onclick=()=>openEdit("shopping",b.dataset.id));document.querySelectorAll(".delShop").forEach(b=>b.onclick=()=>{if(confirm("削除しますか？")){const d=load();d.shopping=d.shopping.filter(x=>x.id!==b.dataset.id);save(d);render()}});document.querySelectorAll(".shopCheck").forEach(c=>c.onchange=()=>{const d=load(),x=d.shopping.find(v=>v.id===c.dataset.id);x.done=c.checked;if(c.checked&&!x.purchaseId){const p={id:uid(),name:x.name,time:Date.now(),memo:x.memo||"",sourceShoppingId:x.id,status:"在庫あり",consumedTime:null};d.purchases.push(p);x.purchaseId=p.id}else if(!c.checked&&x.purchaseId){const p=d.purchases.find(v=>v.id===x.purchaseId);if(p)p.unchecked=true}save(d);render()});
 const pf=$("purchaseStatusFilter")?.value||"",purchases=d.purchases.filter(x=>!pf||(x.status||"在庫あり")===pf).slice().reverse();
 $("purchaseList").innerHTML=purchases.length?purchases.map(x=>`<div class="listitem"><div class="row"><b>${esc(x.name||x.text||"購入")}</b><span class="badge ${x.status==="消費済み"?"":x.status==="使用中"?"gold":"green"}">${esc(x.status||"在庫あり")}</span></div><div class="time">購入：${fmt(x.time||Date.now())}${x.consumedTime?` ／ 消費：${fmt(x.consumedTime)}`:""}</div>${x.memo?`<div class="small">${esc(x.memo)}</div>`:""}<div class="wrap" style="margin-top:8px"><button class="secondary purchaseStatus" data-id="${x.id}" data-status="在庫あり">在庫あり</button><button class="secondary purchaseStatus" data-id="${x.id}" data-status="使用中">使用中</button><button class="success purchaseStatus" data-id="${x.id}" data-status="消費済み">消費済み</button><button class="secondary editPurchase" data-id="${x.id}">編集</button><button class="danger delPurchase" data-id="${x.id}">削除</button></div></div>`).join(""):'<div class="empty">該当する購入履歴はありません。</div>';
 document.querySelectorAll(".purchaseStatus").forEach(b=>b.onclick=()=>{const d=load(),x=d.purchases.find(v=>v.id===b.dataset.id);if(!x)return;x.status=b.dataset.status;if(x.status==="消費済み"){x.consumedTime=x.consumedTime||Date.now()}else{x.consumedTime=null}save(d);render()});
 document.querySelectorAll(".editPurchase").forEach(b=>b.onclick=()=>openEdit("purchase",b.dataset.id));
 document.querySelectorAll(".delPurchase").forEach(b=>b.onclick=()=>{if(confirm("この購入履歴を削除しますか？")){const d=load();d.purchases=d.purchases.filter(x=>x.id!==b.dataset.id);save(d);render()}});

}

function achievementState(d,id){
 return (d.achievementProgress&&d.achievementProgress[id])||{done:false,date:"",note:"",checklist:[],tags:[]};
}
function filteredAchievements(){
 const d=load(),q=$("achSearch").value.trim().toLowerCase(),kind=$("achKind").value,cat=$("achCategory").value,status=$("achStatus").value,hidden=$("achIncludeHidden").checked;
 const tagQ=$("achTagSearch").value.trim().toLowerCase(),inputStatus=$("achInputStatus").value,reward=$("achReward").value,sort=$("achSort").value;
 let list=ACHIEVEMENT_DB.filter(a=>a.kind!=="レガシー").filter(a=>{
  const st=achievementState(d,a.id),tags=st.tags||[],checks=st.checklist||[];
  const tagHit=!tagQ||tags.some(t=>t.toLowerCase().includes(tagQ));
  const inputHit=!inputStatus
   ||(inputStatus==="noDate"&&!st.date)
   ||(inputStatus==="noNote"&&!String(st.note||"").trim())
   ||(inputStatus==="hasChecklist"&&checks.length>0)
   ||(inputStatus==="checklistIncomplete"&&checks.length>0&&checks.some(i=>!i.done))
   ||(inputStatus==="hasTag"&&tags.length>0);
  const rewardHit=!reward||(reward==="title"&&a.rewardTitle)||(reward==="item"&&a.rewardItem);
  return (hidden||!a.hidden)
   &&(!q||(a.name+" "+a.description+" "+tags.join(" ")).toLowerCase().includes(q))
   &&(!kind||a.kind===kind)&&(!cat||a.category===cat)
   &&(!status||(status==="done"?st.done:!st.done))
   &&tagHit&&inputHit&&rewardHit;
 });
 if(sort==="name")list.sort((a,b)=>a.name.localeCompare(b.name,"ja"));
 else if(sort==="dateDesc")list.sort((a,b)=>String(achievementState(d,b.id).date||"").localeCompare(String(achievementState(d,a.id).date||"")));
 else if(sort==="dateAsc")list.sort((a,b)=>String(achievementState(d,a.id).date||"9999").localeCompare(String(achievementState(d,b.id).date||"9999")));
 else list.sort((a,b)=>a.id-b.id);
 return list;
}
function updateAchievementCategories(){
 const kind=$("achKind").value,current=$("achCategory").value;
 const cats=[...new Set(ACHIEVEMENT_DB.filter(a=>!kind||a.kind===kind).map(a=>a.category))].sort((a,b)=>a.localeCompare(b,"ja"));
 $("achCategory").innerHTML='<option value="">すべて</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
 if(cats.includes(current))$("achCategory").value=current;
}

function renderAchievementDataPackInfo(){
 const el=$("achDataPackMeta");if(!el)return;
 const total=ACHIEVEMENT_DB.length;
 const maxId=ACHIEVEMENT_DB.reduce((m,a)=>Math.max(m,Number(a.id)||0),0);
 const categoryCount=new Set(ACHIEVEMENT_DB.map(a=>`${a.kind}::${a.category}`)).size;
 const d=load();
 const progressCount=Object.keys(d.achievementProgress||{}).length;
 const doneCount=Object.values(d.achievementProgress||{}).filter(v=>v&&v.done).length;
 el.innerHTML=`${ACHIEVEMENT_DATA_META.label} ／ データ日 ${ACHIEVEMENT_DATA_META.version}<br>
 実データ <b>${total.toLocaleString("ja-JP")}件</b> ／ 分類 ${categoryCount} ／ 最大ID ${maxId}<br>
 はいびすの登録進捗 ${progressCount}件（取得済み ${doneCount}件）<br>
 <span class="muted">アチーブメント本体と取得状況は別保存です。レガシーは通常表示から除外していますが、データ自体は保持しています。今後データパックを更新しても、同じIDの取得状況はそのまま引き継ぎます。</span>`;
}
function renderAchievements(){
 renderAchievementDataPackInfo();
 const d=load(),allDone=Object.values(d.achievementProgress||{}).filter(x=>x.done).length;
 const points=ACHIEVEMENT_DB.filter(a=>a.kind!=="レガシー").reduce((n,a)=>n+(achievementState(d,a.id).done?a.points:0),0);
 const visibleBase=ACHIEVEMENT_DB.filter(a=>!a.hidden&&a.kind!=="レガシー");
 const visibleDone=visibleBase.filter(a=>achievementState(d,a.id).done).length;
 const arr=filteredAchievements(),size=Number($("achPageSize").value||50),pages=Math.max(1,Math.ceil(arr.length/size));
 achPage=Math.min(Math.max(1,achPage),pages);const start=(achPage-1)*size,items=arr.slice(start,start+size);
 $("achTotal").textContent=visibleBase.length;$("achDone").textContent=visibleDone;$("achPoints").textContent=points.toLocaleString("ja-JP");$("achShown").textContent=arr.length;$("achRate").textContent=(visibleBase.length?visibleDone/visibleBase.length*100:0).toFixed(1)+"%";
 $("achList").innerHTML=items.length?items.map(a=>{const st=achievementState(d,a.id);return `<div class="card ${st.done?"archived":""}">
 <div class="row"><div><label style="margin:0;color:var(--text)"><input class="achCheck" data-id="${a.id}" type="checkbox" style="width:auto" ${st.done?"checked":""}> <b>${esc(a.name)}</b>${st.doneAt?` <span class="ach-check-date">達成チェック ${new Date(st.doneAt).toLocaleDateString("ja-JP")}</span>`:""}</label><div class="time">${esc(a.kind)} ＞ ${esc(a.category)}・${a.points}pt${a.hidden?"・非表示/過去":""}</div></div><div class="wrap">${a.rewardTitle?'<span class="badge purple">称号</span>':""}${a.rewardItem?'<span class="badge gold">アイテム</span>':""}</div></div>
 <p>${nl(a.description)}</p>
 <div class="inline2"><div><label>取得日 <span class="small muted">（任意・手入力）</span></label><input class="achDate" data-id="${a.id}" type="date" value="${esc(st.date||"")}"></div><div><label>自分用メモ</label><input class="achNote" data-id="${a.id}" value="${esc(st.note||"")}" placeholder="進捗、思い出など"></div></div>
 <label>ユーザータグ（カンマ区切り）</label><input class="achTags" data-id="${a.id}" value="${esc((st.tags||[]).join(", "))}" placeholder="例：事件屋, 黄金, 優先">
 <label>攻略・参考URL（任意）</label><input class="achRefUrl" data-id="${a.id}" type="url" value="${esc(st.refUrl||"")}" placeholder="https://...">
 <div style="margin-top:6px">${(st.tags||[]).map(t=>`<span class="badge">#${esc(t)}</span>`).join("")}</div>
 <div class="card" style="margin-top:12px;background:#182638">
   <div class="row"><b>任意チェックリスト</b><span class="small">${(st.checklist||[]).filter(i=>i.done).length}/${(st.checklist||[]).length}</span></div>
   <div class="achChecklist" data-id="${a.id}">
     ${(st.checklist||[]).length?(st.checklist||[]).map(i=>`<div class="listitem" style="padding:9px"><div class="row"><label style="margin:0;color:var(--text)"><input class="achSubCheck" data-ach="${a.id}" data-sub="${i.id}" type="checkbox" style="width:auto" ${i.done?"checked":""}> ${esc(i.name)}${i.doneAt?` <span class="ach-check-date">${new Date(i.doneAt).toLocaleDateString("ja-JP")}</span>`:""}</label><button class="danger achSubDelete" data-ach="${a.id}" data-sub="${i.id}">削除</button></div></div>`).join(""):'<div class="small">項目はまだありません。</div>'}
   </div>
   <div class="wrap" style="margin-top:9px"><input class="achSubInput" data-id="${a.id}" placeholder="例：ガンマ、サウガ、マヘス…" style="flex:1;min-width:210px"><button class="secondary achSubAdd" data-id="${a.id}">項目を追加</button></div>
 </div>
 <div class="wrap" style="margin-top:9px"><button class="secondary achOfficial" data-name="${esc(a.name)}">公式で確認</button>${st.refUrl?`<button class="secondary achRefOpen" data-url="${esc(st.refUrl)}">参考URLを開く</button>`:""}<button class="ghost achSave" data-id="${a.id}">日付・メモ・URLを保存</button></div>
 </div>`}).join(""):'<div class="empty">条件に合うアチーブメントはありません。</div>';
 $("achPageInfo").textContent=`${arr.length?start+1:0}～${Math.min(start+size,arr.length)} / ${arr.length}件（${achPage}/${pages}ページ）`;
 $("achPrev").disabled=achPage<=1;$("achNext").disabled=achPage>=pages;
 document.querySelectorAll(".achCheck").forEach(c=>c.onchange=()=>{const d=load(),id=c.dataset.id;d.achievementProgress=d.achievementProgress||{};const st=d.achievementProgress[id]||{done:false,date:"",note:"",checklist:[],tags:[]};const visibleDate=document.querySelector(`.achDate[data-id="${id}"]`)?.value||"";st.done=c.checked;if(c.checked){if(!st.doneAt)st.doneAt=Date.now();if(!visibleDate&&!st.date)st.date=localDateValue(Date.now())}else st.doneAt=0;if(visibleDate)st.date=visibleDate;d.achievementProgress[id]=st;save(d);renderAchievements();renderFFSummary();if(typeof renderDateArchive==="function")renderDateArchive()});
 document.querySelectorAll(".achDate").forEach(input=>input.onchange=()=>{const d=load(),id=input.dataset.id;d.achievementProgress=d.achievementProgress||{};const st=d.achievementProgress[id]||{done:false,date:"",note:"",checklist:[],tags:[]};st.date=input.value;d.achievementProgress[id]=st;save(d)});
 document.querySelectorAll(".achSave").forEach(b=>b.onclick=()=>{const d=load(),id=b.dataset.id;d.achievementProgress=d.achievementProgress||{};const st=d.achievementProgress[id]||{done:false,date:"",note:"",checklist:[],tags:[]};st.date=document.querySelector(`.achDate[data-id="${id}"]`).value;st.note=document.querySelector(`.achNote[data-id="${id}"]`).value;st.tags=document.querySelector(`.achTags[data-id="${id}"]`).value.split(/[,、]/).map(v=>v.trim()).filter(Boolean);st.refUrl=document.querySelector(`.achRefUrl[data-id="${id}"]`).value.trim();d.achievementProgress[id]=st;save(d);renderAchievements();setTimeout(()=>b.textContent="日付・メモを保存",900)});

 document.querySelectorAll(".achSubAdd").forEach(b=>b.onclick=()=>{
   const id=b.dataset.id,input=document.querySelector(`.achSubInput[data-id="${id}"]`),name=input.value.trim();
   if(!name)return;
   const d=load();d.achievementProgress=d.achievementProgress||{};
   const st=d.achievementProgress[id]||{done:false,date:"",note:"",checklist:[],tags:[]};
   st.checklist=st.checklist||[];
   st.checklist.push({id:uid(),name,done:false});
   d.achievementProgress[id]=st;save(d);renderAchievements();
 });
 document.querySelectorAll(".achSubInput").forEach(input=>input.onkeydown=e=>{
   if(e.key==="Enter"){e.preventDefault();document.querySelector(`.achSubAdd[data-id="${input.dataset.id}"]`).click();}
 });
 document.querySelectorAll(".achSubCheck").forEach(c=>c.onchange=()=>{
   const d=load(),st=d.achievementProgress?.[c.dataset.ach];if(!st)return;
   const item=(st.checklist||[]).find(i=>i.id===c.dataset.sub);if(item){item.done=c.checked;if(c.checked){if(!item.doneAt)item.doneAt=Date.now()}else item.doneAt=0}
   save(d);renderAchievements();if(typeof renderDateArchive==="function")renderDateArchive();
 });
 document.querySelectorAll(".achSubDelete").forEach(b=>b.onclick=()=>{
   if(!confirm("この項目を削除しますか？"))return;
   const d=load(),st=d.achievementProgress?.[b.dataset.ach];if(!st)return;
   st.checklist=(st.checklist||[]).filter(i=>i.id!==b.dataset.sub);
   save(d);renderAchievements();
 });
 document.querySelectorAll(".achRefOpen").forEach(b=>b.onclick=()=>window.open(b.dataset.url,"_blank","noopener"));
 document.querySelectorAll(".achOfficial").forEach(b=>b.onclick=()=>openTemplate("https://jp.finalfantasyxiv.com/lodestone/playguide/db/achievement/?q={query}",b.dataset.name));
}

/* FISH_DATA moved to assets/js/data/fish_data.js */

const LEGENDARY_BIG_FISH_IDS=new Set([8754, 8756, 8763, 8768, 8772, 8775, 17588, 17589, 17590, 17591, 17592, 17593, 24211, 24212, 24213, 24214, 24215, 24216, 28925, 28926, 28927, 28928, 28929, 28930, 41407, 41408, 41409, 41410, 41411, 41412, 52007, 52008, 52009, 52010, 52011, 52297]);
const FEAST_OF_FAMINE_IDS=new Set([8754, 8756, 8763, 8768, 8772, 8775]);
FISH_DATA.forEach(f=>{f.legendaryBigFish=LEGENDARY_BIG_FISH_IDS.has(Number(f.id));f.feastOfFamine=FEAST_OF_FAMINE_IDS.has(Number(f.id));})
function fishState(d,id){return d.fishingProgress?.[id]||{done:false,note:""};}
function filteredFish(){
 const d=load(),q=($("fishSearch")?.value||"").trim().toLowerCase(),exp=$("fishExpansion")?.value||"",status=$("fishStatus")?.value||"",kind=$("fishKind")?.value||"";
 return FISH_DATA.filter(f=>{
  const st=fishState(d,f.id);
  const hay=`${f.name} ${f.region} ${f.zone} ${f.spot} ${f.bait} ${f.weather} ${f.previousWeather} ${f.folklore}`.toLowerCase();
  const kindOk=!kind||(kind==="big"&&f.bigFish)||(kind==="legendary"&&f.legendaryBigFish)||(kind==="feast"&&f.feastOfFamine)||(kind==="timed"&&f.time!=="常時")||(kind==="weather"&&!!f.weather)||(kind==="folklore"&&!!f.folklore);
  return (!q||hay.includes(q))&&(!exp||f.expansion===exp)&&(!status||(status==="done"?st.done:!st.done))&&kindOk;
 });
}
function renderFishing(){
 if(!$("fishList"))return;
 const d=load(),arr=filteredFish(),done=FISH_DATA.filter(f=>fishState(d,f.id).done).length;
 $("fishTotal").textContent=FISH_DATA.length.toLocaleString("ja-JP");
 $("fishDone").textContent=done.toLocaleString("ja-JP");
 $("fishTodo").textContent=(FISH_DATA.length-done).toLocaleString("ja-JP");
 $("fishBig").textContent=FISH_DATA.filter(f=>f.bigFish).length.toLocaleString("ja-JP");
 $("fishLegendary").textContent=FISH_DATA.filter(f=>f.legendaryBigFish).length.toLocaleString("ja-JP");
 $("fishShown").textContent=arr.length.toLocaleString("ja-JP");
 $("fishingSummary").innerHTML=`<div class="listitem">従来の自由釣り記録：<b>${d.fishing.length}</b></div>`;
 $("fishList").innerHTML=arr.slice(0,250).map(f=>{
  const st=fishState(d,f.id),coord=f.coords?.length?` X:${Number(f.coords[0]).toFixed(1)} Y:${Number(f.coords[1]).toFixed(1)}`:"";
  return `<div class="card ${st.done?"archived":""}">
   <div class="row"><div><label style="margin:0;color:var(--text)"><input type="checkbox" class="fishCheck" data-id="${f.id}" style="width:auto" ${st.done?"checked":""}> <b>${esc(f.name)}</b></label>
   <div class="time">${esc(f.expansion)} Patch ${f.patch} ／ ${esc(f.region)} ＞ ${esc(f.zone)} ＞ ${esc(f.spot)}${coord}</div></div>
   <div class="wrap">${f.legendaryBigFish?'<span class="badge purple">オオヌシ</span>':(f.bigFish?'<span class="badge gold">ヌシ</span>':"")}${f.feastOfFamine?'<span class="badge green">爆釣エオルゼア</span>':""}${f.collectable?'<span class="badge">収集品</span>':""}</div></div>
   <div class="wrap" style="margin-top:8px">${f.bait?`<span class="badge">🎣 ${esc(f.bait)}</span>`:""}<span class="badge">${esc(f.time)}</span>${f.weather?`<span class="badge">☁ ${esc(f.weather)}</span>`:""}${f.previousWeather?`<span class="badge">移ろい：${esc(f.previousWeather)}</span>`:""}${f.hookset?`<span class="badge">${esc(f.hookset)}・${esc(f.tug)}</span>`:""}</div>
   ${f.folklore?`<div class="small" style="margin-top:8px">📖 ${esc(f.folklore)}</div>`:""}
   <div class="inline2" style="margin-top:8px"><input class="fishNote" data-id="${f.id}" value="${esc(st.note||"")}" placeholder="自分用メモ"><button type="button" class="secondary fishOfficial" data-name="${esc(f.name)}">公式DBで検索</button></div>
  </div>`;
 }).join("")+(arr.length>250?`<div class="empty">表示が多いため先頭250件を表示中です。検索・絞り込みを使ってください。</div>`:"");
 document.querySelectorAll(".fishCheck").forEach(c=>c.onchange=()=>{
  const d=load(),id=c.dataset.id;d.fishingProgress=d.fishingProgress||{};
  const st=d.fishingProgress[id]||{done:false,note:""};st.done=c.checked;d.fishingProgress[id]=st;save(d);renderFishing();
 });
 document.querySelectorAll(".fishNote").forEach(i=>i.onchange=()=>{
  const d=load(),id=i.dataset.id;d.fishingProgress=d.fishingProgress||{};
  const st=d.fishingProgress[id]||{done:false,note:""};st.note=i.value;d.fishingProgress[id]=st;save(d);
 });
 document.querySelectorAll(".fishOfficial").forEach(b=>b.onclick=()=>openTemplate("https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/?q={query}",b.dataset.name));
}

/* CRAFT_RECIPE_DATA moved to assets/js/data/craft_recipe_data.js */

let craftPage=1;
function craftPatchLabel(n){
 const v=Number(n||0);
 if(!v)return "";
 const major=Math.floor(v/100),minor=Math.floor((v%100)/10),sub=v%10;
 return `${major}.${minor}${sub?sub:""}`;
}
function craftRecipeState(d,id){return d.craftingProgress?.[id]||{done:false,note:""};}
function filteredCraftRecipes(){
 const d=load();
 const q=($("craftSearch")?.value||"").trim().toLowerCase();
 const job=$("craftJob")?.value||"",band=$("craftLevelBand")?.value||"",status=$("craftStatus")?.value||"",special=$("craftSpecial")?.value||"";
 let min=0,max=999;
 if(band){const p=band.split("-").map(Number);min=p[0];max=p[1];}
 return CRAFT_RECIPE_DATA.filter(r=>{
  const st=craftRecipeState(d,r.id);
  const specialOk=!special
   ||(special==="star"&&r.stars>0)
   ||(special==="secret"&&r.secret>0)
   ||(special==="specialist"&&r.specialist)
   ||(special==="expert"&&r.expert)
   ||(special==="noquick"&&!r.quick);
  return (!q||r.name.toLowerCase().includes(q))
   &&(!job||r.craft===job)
   &&(!band||(r.level>=min&&r.level<=max))
   &&(!status||(status==="done"?st.done:!st.done))
   &&specialOk;
 });
}
function renderCrafting(){
 if(!$("craftRecipeList"))return;
 const d=load(),arr=filteredCraftRecipes(),size=Number($("craftPageSize")?.value||100);
 const pages=Math.max(1,Math.ceil(arr.length/size));craftPage=Math.min(Math.max(1,craftPage),pages);
 const start=(craftPage-1)*size,items=arr.slice(start,start+size);
 const done=CRAFT_RECIPE_DATA.filter(r=>craftRecipeState(d,r.id).done).length;
 $("craftRecipeTotal").textContent=CRAFT_RECIPE_DATA.length.toLocaleString("ja-JP");
 $("craftRecipeDone").textContent=done.toLocaleString("ja-JP");
 $("craftRecipeTodo").textContent=(CRAFT_RECIPE_DATA.length-done).toLocaleString("ja-JP");
 $("craftRecipeShown").textContent=arr.length.toLocaleString("ja-JP");
 $("craftingSummary").innerHTML=`<div class="listitem">制作済みチェック：<b>${done.toLocaleString("ja-JP")} / ${CRAFT_RECIPE_DATA.length.toLocaleString("ja-JP")}</b></div>`;
 $("craftPageInfo").textContent=`${craftPage} / ${pages}ページ`;
 $("craftPrev").disabled=craftPage<=1;$("craftNext").disabled=craftPage>=pages;

 $("craftRecipeList").innerHTML=items.length?items.map(r=>{
  const st=craftRecipeState(d,r.id);
  return `<div class="card ${st.done?"archived":""}">
   <div class="row">
    <div>
     <label style="margin:0;color:var(--text)"><input type="checkbox" class="craftCheck" data-id="${r.id}" style="width:auto" ${st.done?"checked":""}> <b>${esc(r.name)}</b></label>
     <div class="time">${esc(r.craft)} Lv.${r.level}${r.stars?` ★${r.stars}`:""}${r.patch?` ／ Patch ${craftPatchLabel(r.patch)}`:""}</div>
    </div>
    <div class="wrap">
     ${r.secret?'<span class="badge gold">秘伝書</span>':""}
     ${r.specialist?'<span class="badge purple">マイスター</span>':""}
     ${r.expert?'<span class="badge purple">高難易度</span>':""}
     ${!r.quick?'<span class="badge">簡易不可</span>':""}
     ${r.amount>1?`<span class="badge">×${r.amount}</span>`:""}
    </div>
   </div>
   <div class="inline2" style="margin-top:8px">
    <input class="craftNote" data-id="${r.id}" value="${esc(st.note||"")}" placeholder="自分用メモ">
    <div class="wrap">
      <label style="margin:0"><input type="checkbox" class="craftPlanToggle" data-id="${r.id}" style="width:auto" ${(d.craftingPlan?.items?.[r.id])?"checked":""}> 計画に追加</label>
      <input type="number" min="1" step="1" class="craftPlanQty" data-id="${r.id}" value="${Number(d.craftingPlan?.items?.[r.id]||1)}" style="width:90px" title="作りたい個数">
      <button type="button" class="secondary craftMaterials" data-id="${r.id}" data-item="${r.itemId}" data-name="${esc(r.name)}">🧺 素材を見る</button>
      <button type="button" class="secondary craftOfficial" data-name="${esc(r.name)}">公式DBで検索</button>
    </div>
   </div>
   <div class="craftMaterialBox" id="craftMaterialBox_${r.id}" style="display:none;margin-top:8px"></div>
  </div>`;
 }).join(""):'<div class="empty">該当するレシピはありません。</div>';

 renderCraftPlan();
 renderCraftInventory();
 fillCraftIngredientCatalog();
 if($("craftIndexStatus"))$("craftIndexStatus").textContent=craftIndexReady()?`準備済み ${Object.keys(craftReverseIndex.recipes).length.toLocaleString("ja-JP")}レシピ`:"未準備";
 document.querySelectorAll(".craftCheck").forEach(c=>c.onchange=()=>{
  const d=load(),id=c.dataset.id;d.craftingProgress=d.craftingProgress||{};
  const st=d.craftingProgress[id]||{done:false,note:""};st.done=c.checked;d.craftingProgress[id]=st;save(d);renderCrafting();
 });
 document.querySelectorAll(".craftNote").forEach(i=>i.onchange=()=>{
  const d=load(),id=i.dataset.id;d.craftingProgress=d.craftingProgress||{};
  const st=d.craftingProgress[id]||{done:false,note:""};st.note=i.value;d.craftingProgress[id]=st;save(d);
 });
 document.querySelectorAll(".craftPlanToggle").forEach(c=>c.onchange=()=>{
  const d=load(),id=c.dataset.id;d.craftingPlan=d.craftingPlan||{items:{},checks:{}};d.craftingPlan.items=d.craftingPlan.items||{};
  if(c.checked){const q=Number(document.querySelector(`.craftPlanQty[data-id="${id}"]`)?.value||1);d.craftingPlan.items[id]=Math.max(1,Math.floor(q));}
  else delete d.craftingPlan.items[id];
  save(d);renderCraftPlan();
 });
 document.querySelectorAll(".craftPlanQty").forEach(i=>i.onchange=()=>{
  const d=load(),id=i.dataset.id,q=Math.max(1,Math.floor(Number(i.value)||1));i.value=q;
  if(d.craftingPlan?.items?.[id]){d.craftingPlan.items[id]=q;save(d);renderCraftPlan();}
 });
 document.querySelectorAll(".craftMaterials").forEach(b=>b.onclick=()=>openCraftMaterials(b));
 document.querySelectorAll(".craftOfficial").forEach(b=>b.onclick=()=>openTemplate("https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/?q={query}",b.dataset.name));
}


const CRAFT_MATERIAL_CACHE_KEY="life_archive_craft_materials_v1";
let craftMaterialCache={};
try{craftMaterialCache=JSON.parse(localStorage.getItem(CRAFT_MATERIAL_CACHE_KEY)||"{}")||{}}catch(e){craftMaterialCache={};}
function saveCraftMaterialCache(){try{localStorage.setItem(CRAFT_MATERIAL_CACHE_KEY,JSON.stringify(craftMaterialCache))}catch(e){}}

const CRAFT_REVERSE_INDEX_KEY="life_archive_craft_reverse_v1";
let craftReverseIndex=null,craftReverseMode="uses";
try{craftReverseIndex=JSON.parse(localStorage.getItem(CRAFT_REVERSE_INDEX_KEY)||"null")}catch(e){craftReverseIndex=null}
function saveCraftReverseIndex(){
 try{localStorage.setItem(CRAFT_REVERSE_INDEX_KEY,JSON.stringify(craftReverseIndex))}catch(e){console.warn("craft reverse cache save failed",e)}
}
function craftIndexReady(){return !!craftReverseIndex&&craftReverseIndex.recipes&&craftReverseIndex.items}
function parseRecipeSheetRows(payload,base={recipes:{},items:{},builtAt:0}){
 const rows=payload?.rows||payload?.results||[];
 const recipes=base.recipes||{},items=base.items||{};
 for(const row of rows){
  const f=row.fields||row,id=Number(row.row_id??row.id??f["#"]??0);
  if(!id)continue;
  const ingredients=f.Ingredient||f.Ingredients||[];
  const ingredientRaw=f["Ingredient@as(raw)"]||f["Ingredients@as(raw)"]||[];
  const amounts=f.AmountIngredient||f.AmountIngredients||[];
  const list=[];
  const len=Math.max(ingredients.length||0,ingredientRaw.length||0,amounts.length||0);
  for(let i=0;i<len;i++){
   const ing=ingredients[i],raw=ingredientRaw[i],qty=Number(amounts[i]||0);
   const itemId=Number(raw??ing?.row_id??ing?.value??ing?.id??ing??0);
   if(itemId>0&&qty>0){
    let name=String(ing?.fields?.Name||ing?.name||"").trim();
    if(!name){const known=CRAFT_RECIPE_DATA.find(r=>Number(r.itemId)===itemId);if(known)name=known.name}
    name=name||`Item #${itemId}`;
    list.push({itemId,name,amount:qty});
    if(!items[itemId]||String(items[itemId]).startsWith("Item #"))items[itemId]=name;
   }
  }
  recipes[id]=list;
  if(list.length)craftMaterialCache[String(id)]=list;
 }
 return {recipes,items,builtAt:Date.now()};
}
async function buildCraftReverseIndex(force=false){
 const st=$("craftIndexStatus");
 if(craftIndexReady()&&!force){
  if(st)st.textContent=`準備済み ${Object.keys(craftReverseIndex.recipes).length.toLocaleString("ja-JP")}レシピ`;
  fillCraftIngredientCatalog();return true;
 }
 if(st)st.textContent="必要素材データを取得中…";
 try{
  let merged={recipes:{},items:{},builtAt:Date.now()},after=-1,totalRows=0,page=0;
  const limit=500;
  while(true){
   const qs=new URLSearchParams({
    language:"ja",
    fields:"Ingredient[].Name,Ingredient@as(raw),AmountIngredient",
    limit:String(limit)
   });
   if(after>=0)qs.set("after",String(after));
   const url=`https://v2.xivapi.com/api/sheet/Recipe?${qs.toString()}`;
   const r=await fetch(url,{headers:{Accept:"application/json"},cache:"no-store"});
   if(!r.ok)throw new Error(`XIVAPI HTTP ${r.status}`);
   const payload=await r.json();
   const rows=payload?.rows||payload?.results||[];
   if(!rows.length)break;
   merged=parseRecipeSheetRows(payload,merged);
   totalRows+=rows.length;page++;
   const lastId=Number(rows[rows.length-1]?.row_id??rows[rows.length-1]?.id??-1);
   if(st)st.textContent=`必要素材データを取得中… ${totalRows.toLocaleString("ja-JP")}件`;
   if(!Number.isFinite(lastId)||lastId<=after)break;
   after=lastId;
   if(rows.length<limit)break;
   // Safety valve; Recipe sheet should finish well before this.
   if(page>100)throw new Error("Recipe sheet pagination exceeded safety limit");
  }
  craftReverseIndex=merged;
  saveCraftReverseIndex();saveCraftMaterialCache();fillCraftIngredientCatalog();
  const usable=Object.values(craftReverseIndex.recipes||{}).filter(x=>Array.isArray(x)&&x.length).length;
  if(st)st.textContent=`準備完了 ${Object.keys(craftReverseIndex.recipes).length.toLocaleString("ja-JP")}レシピ（素材あり ${usable.toLocaleString("ja-JP")}）`;
  return usable>0;
 }catch(e){
  console.error("craft reverse index build failed",e);
  if(st)st.textContent=`準備に失敗しました：${String(e?.message||e)}`;
  return false;
 }
}
function fillCraftIngredientCatalog(){
 const dl=$("craftIngredientCatalog");if(!dl||!craftIndexReady())return;
 const entries=Object.entries(craftReverseIndex.items||{}).sort((a,b)=>String(a[1]).localeCompare(String(b[1]),"ja"));
 dl.innerHTML=entries.map(([id,name])=>`<option value="${esc(name)}" data-id="${id}"></option>`).join("");
}
function craftInventoryData(d=load()){d.craftInventory=d.craftInventory||{};return d.craftInventory}
function craftInventoryQtyFor(stock,itemId,name){
 const direct=Number(stock?.[String(itemId)]?.qty||0);
 if(direct>0)return direct;
 const q=normalizeCollectionName(String(name||""));
 if(!q)return 0;
 for(const x of Object.values(stock||{})){
  if(Number(x?.qty||0)<=0)continue;
  if(normalizeCollectionName(String(x?.name||""))===q)return Number(x.qty)||0;
 }
 return 0;
}
function craftInventoryEntryFor(stock,itemId,name){
 const direct=stock?.[String(itemId)];
 if(direct)return {key:String(itemId),entry:direct};
 const q=normalizeCollectionName(String(name||""));
 if(!q)return null;
 for(const [key,x] of Object.entries(stock||{})){
  if(normalizeCollectionName(String(x?.name||""))===q)return {key,entry:x};
 }
 return null;
}
function findCraftIngredientByName(name){
 const q=String(name||"").trim();if(!q)return null;
 if(craftIndexReady()){
  const exact=Object.entries(craftReverseIndex.items||{}).find(([,n])=>String(n).trim()===q);
  if(exact)return {itemId:Number(exact[0]),name:String(exact[1]),catalog:true};
  const loose=Object.entries(craftReverseIndex.items||{}).find(([,n])=>normalizeCollectionName(String(n))===normalizeCollectionName(q));
  if(loose)return {itemId:Number(loose[0]),name:String(loose[1]),catalog:true};
 }
 return {itemId:"custom:"+q.toLowerCase().replace(/\s+/g," ").trim(),name:q,catalog:false};
}
function renderCraftInventory(){
 const box=$("craftInventoryList");if(!box)return;
 const d=load(),inv=craftInventoryData(d),rows=Object.entries(inv).map(([id,x])=>({itemId:id,name:x.name||craftReverseIndex?.items?.[id]||String(id).replace(/^custom:/,""),qty:Number(x.qty)||0})).filter(x=>x.qty>0).sort((a,b)=>a.name.localeCompare(b.name,"ja"));
 box.innerHTML=rows.length?`<div class="grid3">${rows.map(x=>`<div class="listitem"><div class="row"><b>${esc(x.name)}</b><div class="wrap"><input type="number" min="0" class="craftInventoryEdit" data-item="${x.itemId}" value="${x.qty}" style="width:80px"><button class="danger craftInventoryRemove" data-item="${x.itemId}">×</button></div></div></div>`).join("")}</div>`:'<div class="empty">素材在庫はまだ登録されていません。</div>';
 document.querySelectorAll(".craftInventoryEdit").forEach(i=>i.onchange=()=>{const d=load(),inv=craftInventoryData(d),q=Math.max(0,Math.floor(Number(i.value)||0));if(q)inv[i.dataset.item].qty=q;else delete inv[i.dataset.item];save(d);renderCraftInventory()});
 document.querySelectorAll(".craftInventoryRemove").forEach(b=>b.onclick=()=>{const d=load(),inv=craftInventoryData(d);delete inv[b.dataset.item];save(d);renderCraftInventory()});
}
function reverseRecipeRows(recipe){return craftReverseIndex?.recipes?.[String(recipe.id)]||[]}
function usesOwnedMaterialAnalysis(recipe,stock){
 const need=reverseRecipeRows(recipe);if(!need.length)return {possible:false,matched:0,missing:Infinity,details:[]};
 const details=need.map(x=>{
  const have=craftInventoryQtyFor(stock,x.itemId,x.name);
  return {name:x.name,need:x.amount,have,matched:have>0,missing:Math.max(0,x.amount-have)};
 });
 const matched=details.filter(x=>x.matched).length;
 return {possible:matched>0,matched,missing:details.reduce((n,x)=>n+x.missing,0),details};
}
function directRecipeAnalysis(recipe,stock){
 const need=reverseRecipeRows(recipe);if(!need.length)return {possible:false,missing:Infinity,details:[]};
 const details=need.map(x=>{const have=craftInventoryQtyFor(stock,x.itemId,x.name);return {name:x.name,need:x.amount,have,missing:Math.max(0,x.amount-have)}});
 const missing=details.reduce((n,x)=>n+x.missing,0);
 return {possible:missing===0,missing,details};
}
function consumeCraftItem(itemId,qty,stock,trail=[],depth=0,name=""){
 const match=craftInventoryEntryFor(stock,itemId,name);
 const have=Number(match?.entry?.qty||0);
 if(have>=qty){match.entry.qty=have-qty;return {ok:true,missing:0}}
 let remaining=qty-have;if(have>0&&match)match.entry.qty=0;
 const sub=craftRecipeByItem(itemId);
 if(!sub||depth>=12||trail.includes(Number(itemId)))return {ok:false,missing:remaining};
 const mats=reverseRecipeRows(sub);if(!mats.length)return {ok:false,missing:remaining};
 const output=Math.max(1,Number(sub.amount)||1),crafts=Math.ceil(remaining/output);
 let missing=0;
 for(const m of mats){
  const r=consumeCraftItem(m.itemId,m.amount*crafts,stock,[...trail,Number(itemId)],depth+1,m.name);
  missing+=r.missing;
 }
 return {ok:missing===0,missing};
}
function recursiveRecipeAnalysis(recipe,inventory){
 const stock=structuredClone(inventory),mats=reverseRecipeRows(recipe);if(!mats.length)return {possible:false,missing:Infinity};
 let missing=0;
 for(const m of mats)missing+=consumeCraftItem(m.itemId,m.amount,stock,[Number(recipe.itemId)],0,m.name).missing;
 return {possible:missing===0,missing};
}
function renderCraftReverseResults(rows,mode){
 const box=$("craftReverseResults");if(!box)return;
 box.innerHTML=rows.length?rows.slice(0,250).map(({r,a})=>`<div class="listitem"><div class="row"><span><b>${esc(r.name)}</b> <span class="small">${esc(r.craft)} Lv.${r.level}</span></span><div class="wrap">${mode==="uses"?`<span class="badge green">所持素材 ${a.matched}種</span>`:mode==="near"?`<span class="badge gold">あと ${a.missing}</span>`:`<span class="badge green">${mode==="now"?"今すぐ":"加工OK"}</span>`}<button class="secondary craftReversePlan" data-id="${r.id}">制作計画へ</button></div></div>${(mode==="uses"||mode==="near")&&a.details?`<div class="small" style="margin-top:5px">${a.details.map(x=>`${x.have>0?"✓":"・"} ${esc(x.name)} ${x.have>0?`所持${x.have} / 必要${x.need}`:`不足${x.need}`}`).join(" ／ ")}</div>`:""}</div>`).join("")+(rows.length>250?`<div class="small">上位250件を表示（該当 ${rows.length.toLocaleString("ja-JP")}件）</div>`:""):'<div class="empty">${mode==="uses"?"登録した素材を使う未制作レシピはありません。":"該当する未制作レシピはありません。"}</div>';
 document.querySelectorAll(".craftReversePlan").forEach(b=>b.onclick=()=>{const d=load(),p=craftPlanData(d);p.items[b.dataset.id]=p.items[b.dataset.id]||1;save(d);renderCrafting()});
}
async function runCraftReverse(){
 const status=$("craftReverseStatus");
 const recipeCount=craftIndexReady()?Object.keys(craftReverseIndex.recipes||{}).length:0;
 if(!craftIndexReady()||recipeCount<1000){
  if(status)status.textContent="必要素材データを全件準備しています…";
  if(!await buildCraftReverseIndex(true))return;
 }
 const d=load(),inv=craftInventoryData(d),owned=Object.entries(inv).filter(([,x])=>Number(x?.qty)>0);
 if(!owned.length){if(status)status.textContent="先に素材在庫を登録してください。";return}
 if(status)status.textContent="未制作レシピを判定中…";
 await new Promise(r=>setTimeout(r,0));
 const todo=CRAFT_RECIPE_DATA.filter(r=>!craftRecipeState(d,r.id).done&&reverseRecipeRows(r).length);
 const limit=Math.max(1,Number($("craftNearLimit")?.value||3)),out=[];
 for(const r of todo){
  if(craftReverseMode==="uses"){
   const a=usesOwnedMaterialAnalysis(r,inv);if(a.possible)out.push({r,a});
  }else if(craftReverseMode==="now"){
   const a=directRecipeAnalysis(r,inv);if(a.possible)out.push({r,a});
  }else if(craftReverseMode==="process"){
   const direct=directRecipeAnalysis(r,inv);if(!direct.possible){const a=recursiveRecipeAnalysis(r,inv);if(a.possible)out.push({r,a})}
  }else{
   const a=directRecipeAnalysis(r,inv);if(!a.possible&&a.missing>0&&a.missing<=limit)out.push({r,a});
  }
 }
 out.sort((x,y)=>craftReverseMode==="uses"?(y.a.matched-x.a.matched||x.a.missing-y.a.missing||x.r.level-y.r.level):craftReverseMode==="near"?x.a.missing-y.a.missing:x.r.level-y.r.level||x.r.name.localeCompare(y.r.name,"ja"));
 if(status){
  const indexed=Object.keys(craftReverseIndex?.recipes||{}).length;
  const usable=Object.values(craftReverseIndex?.recipes||{}).filter(x=>Array.isArray(x)&&x.length).length;
  status.textContent=`判定完了：${out.length.toLocaleString("ja-JP")}件 ／ 索引 ${indexed.toLocaleString("ja-JP")}件（素材あり ${usable.toLocaleString("ja-JP")}）`;
 }
 renderCraftReverseResults(out,craftReverseMode);
}

function craftRecipeByItem(itemId){return CRAFT_RECIPE_DATA.find(r=>Number(r.itemId)===Number(itemId))||null;}
async function fetchCraftMaterials(recipeId){
 const key=String(recipeId);
 if(Array.isArray(craftMaterialCache[key]))return craftMaterialCache[key];
 const urls=[
  `https://v2.xivapi.com/api/sheet/Recipe/${recipeId}?language=ja`,
  `https://v2.xivapi.com/api/sheet/Recipe/${recipeId}?language=ja&fields=Ingredient,AmountIngredient`
 ];
 let row=null,lastErr=null;
 for(const url of urls){try{const res=await fetch(url);if(!res.ok)throw new Error(`HTTP ${res.status}`);row=await res.json();if(row)break}catch(e){lastErr=e}}
 if(!row)throw lastErr||new Error("Recipe API error");
 const f=row.fields||row;
 const ingredients=f.Ingredient||f.Ingredients||[];
 const amounts=f.AmountIngredient||f.AmountIngredients||[];
 const result=[];
 for(let i=0;i<Math.max(ingredients.length,amounts.length);i++){
  const ing=ingredients[i],amount=Number(amounts[i]||0);
  const id=Number(ing?.row_id??ing?.value??ing?.id??ing??0);
  if(id>0&&amount>0){
   let name=ing?.fields?.Name||ing?.name||"";
   if(!name){const known=CRAFT_RECIPE_DATA.find(r=>Number(r.itemId)===id);if(known)name=known.name;}
   result.push({itemId:id,name:name||`Item #${id}`,amount});
  }
 }
 craftMaterialCache[key]=result;saveCraftMaterialCache();return result;
}
function renderMaterialRows(rows,mult=1,depth=0){
 if(!rows.length)return '<div class="small muted">素材情報なし</div>';
 return `<div>${rows.map(x=>{
  const sub=craftRecipeByItem(x.itemId),need=x.amount*mult;
  return `<div class="listitem"><div class="row"><span>${"　".repeat(depth)}${esc(x.name)} × <b>${need}</b></span>${sub?`<button type="button" class="secondary craftExpandSub" data-recipe="${sub.id}" data-mult="${need}" data-depth="${depth+1}">中間素材を展開</button>`:""}</div><div class="craftSubBox"></div></div>`;
 }).join("")}</div>`;
}
async function openCraftMaterials(btn){
 const rid=Number(btn.dataset.id),box=$(`craftMaterialBox_${rid}`);if(!box)return;
 if(box.style.display!=="none"){box.style.display="none";return}
 box.style.display="block";box.innerHTML='<div class="small">素材を読み込んでいます…</div>';
 try{
  const rows=await fetchCraftMaterials(rid);
  box.innerHTML=`<div class="card"><div class="row"><b>🧺 ${esc(btn.dataset.name)} の必要素材</b><span class="small">必要なレシピだけ読み込み</span></div>${renderMaterialRows(rows)}</div>`;
  bindCraftSubButtons(box);
 }catch(e){console.error(e);box.innerHTML='<div class="empty">素材データを取得できませんでした。通信状態を確認して、もう一度押してください。</div>'}
}
function bindCraftSubButtons(root=document){
 root.querySelectorAll(".craftExpandSub").forEach(b=>b.onclick=async()=>{
  const host=b.closest(".listitem")?.querySelector(".craftSubBox");if(!host)return;
  if(host.innerHTML){host.innerHTML="";b.textContent="中間素材を展開";return}
  b.textContent="読込中…";
  try{
   const rows=await fetchCraftMaterials(Number(b.dataset.recipe));
   host.innerHTML=renderMaterialRows(rows,Number(b.dataset.mult)||1,Number(b.dataset.depth)||1);
   b.textContent="中間素材を閉じる";bindCraftSubButtons(host);
  }catch(e){host.innerHTML='<div class="small muted">中間素材を取得できませんでした。</div>';b.textContent="再試行"}
 });
}

function craftPlanData(d=load()){
 d.craftingPlan=d.craftingPlan||{items:{},checks:{}};
 d.craftingPlan.items=d.craftingPlan.items||{};
 d.craftingPlan.checks=d.craftingPlan.checks||{};
 return d.craftingPlan;
}
function renderCraftPlan(){
 const box=$("craftPlanProducts");if(!box)return;
 const d=load(),plan=craftPlanData(d);
 const entries=Object.entries(plan.items).map(([rid,qty])=>({recipe:CRAFT_RECIPE_DATA.find(r=>String(r.id)===String(rid)),qty:Number(qty)||1})).filter(x=>x.recipe);
 box.innerHTML=entries.length?entries.map(({recipe:r,qty})=>`<div class="listitem">
  <div class="row"><span><b>${esc(r.name)}</b> <span class="small">${esc(r.craft)} Lv.${r.level}</span></span>
  <div class="wrap"><label style="margin:0">個数 <input type="number" min="1" step="1" class="craftPlanProductQty" data-id="${r.id}" value="${qty}" style="width:90px"></label><button type="button" class="danger craftPlanRemove" data-id="${r.id}">外す</button></div></div>
 </div>`).join(""):'<div class="empty">レシピ一覧の「計画に追加」から完成品を選んでください。</div>';
 document.querySelectorAll(".craftPlanProductQty").forEach(i=>i.onchange=()=>{
  const d=load(),p=craftPlanData(d),q=Math.max(1,Math.floor(Number(i.value)||1));p.items[i.dataset.id]=q;save(d);renderCraftPlan();
 });
 document.querySelectorAll(".craftPlanRemove").forEach(b=>b.onclick=()=>{
  const d=load(),p=craftPlanData(d);delete p.items[b.dataset.id];save(d);renderCraftPlan();renderCrafting();
 });
}
function addCraftPlanAmount(map,itemId,name,qty){
 const key=String(itemId);
 if(!map[key])map[key]={itemId:Number(itemId),name:name||`Item #${itemId}`,qty:0};
 map[key].qty+=Number(qty)||0;
}
async function expandCraftPlanIngredient(itemId,name,qty,raw,intermediate,trail=[],depth=0){
 if(qty<=0)return;
 const sub=craftRecipeByItem(itemId);
 if(!sub||depth>=14||trail.includes(Number(itemId))){
  addCraftPlanAmount(raw,itemId,name,qty);return;
 }
 const output=Math.max(1,Number(sub.amount)||1),crafts=Math.ceil(qty/output);
 const key=String(itemId);
 if(!intermediate[key])intermediate[key]={itemId:Number(itemId),name:name||sub.name,needQty:0,crafts:0,output};
 intermediate[key].needQty+=qty;intermediate[key].crafts+=crafts;
 const rows=await fetchCraftMaterials(sub.id);
 if(!rows.length){addCraftPlanAmount(raw,itemId,name,qty);return}
 for(const x of rows)await expandCraftPlanIngredient(x.itemId,x.name,x.amount*crafts,raw,intermediate,[...trail,Number(itemId)],depth+1);
}
async function buildCraftPlan(){
 const d=load(),plan=craftPlanData(d),selected=Object.entries(plan.items).map(([rid,qty])=>({recipe:CRAFT_RECIPE_DATA.find(r=>String(r.id)===String(rid)),qty:Number(qty)||1})).filter(x=>x.recipe);
 const status=$("craftPlanStatus"),result=$("craftPlanResults");
 if(!selected.length){if(status)status.textContent="完成品が選ばれていません。";if(result)result.innerHTML="";return}
 if(status)status.textContent=`${selected.length}種類のレシピを集計中…`;
 if(result)result.innerHTML='<div class="small">中間素材をたどっています。初回は素材データの取得に少し時間がかかります。</div>';
 try{
  const raw={},intermediate={};
  for(const {recipe:r,qty} of selected){
   const crafts=Math.ceil(qty/Math.max(1,Number(r.amount)||1));
   const rows=await fetchCraftMaterials(r.id);
   for(const x of rows)await expandCraftPlanIngredient(x.itemId,x.name,x.amount*crafts,raw,intermediate,[Number(r.itemId)],0);
  }
  const rawRows=Object.values(raw).filter(x=>x.qty>0).sort((a,b)=>a.name.localeCompare(b.name,"ja"));
  const midRows=Object.values(intermediate).filter(x=>x.needQty>0).sort((a,b)=>a.name.localeCompare(b.name,"ja"));
  if(status)status.textContent=`集計完了：最終素材 ${rawRows.length}種 ／ 中間素材 ${midRows.length}種`;
  result.innerHTML=`<div class="grid2">
   <div class="card"><div class="row"><b>☑ 最終素材チェックリスト</b><span class="small">${rawRows.length}種</span></div>
    ${rawRows.length?rawRows.map(x=>`<label class="listitem" style="display:block"><input type="checkbox" class="craftRawCheck" data-item="${x.itemId}" style="width:auto" ${plan.checks?.[x.itemId]?"checked":""}> ${esc(x.name)} × <b>${x.qty}</b></label>`).join(""):'<div class="empty">素材なし</div>'}
   </div>
   <div class="card"><div class="row"><b>⚒ 制作する中間素材</b><span class="small">${midRows.length}種</span></div>
    ${midRows.length?midRows.map(x=>`<div class="listitem">${esc(x.name)}：必要 <b>${x.needQty}</b> ／ 制作回数 <b>${x.crafts}</b>${x.output>1?`（1回${x.output}個）`:""}</div>`).join(""):'<div class="empty">中間素材なし</div>'}
   </div>
  </div>`;
  document.querySelectorAll(".craftRawCheck").forEach(c=>c.onchange=()=>{
   const d=load(),p=craftPlanData(d);if(c.checked)p.checks[c.dataset.item]=true;else delete p.checks[c.dataset.item];save(d);
  });
 }catch(e){
  console.error("craft plan build failed",e);
  if(status)status.textContent="素材集計でエラーが発生しました。";
  if(result)result.innerHTML='<div class="empty">素材データを取得できませんでした。通信状態を確認してもう一度集計してください。</div>';
 }
}
function clearCraftPlan(){
 if(!confirm("制作計画と素材チェックをクリアしますか？"))return;
 const d=load();d.craftingPlan={items:{},checks:{}};save(d);
 if($("craftPlanResults"))$("craftPlanResults").innerHTML="";
 if($("craftPlanStatus"))$("craftPlanStatus").textContent="";
 renderCrafting();
}

/* MINION_DATA moved to assets/js/data/minion_data.js */


/* MOUNT_DATA moved to assets/js/data/mount_data.js */

let collectionKind="minion",collectionPage=1;
function collectionData(){return collectionKind==="mount"?MOUNT_DATA:MINION_DATA;}
function collectionProgress(d){return collectionKind==="mount"?(d.mountProgress||{}):(d.minionProgress||{});}
function collectionState(d,id){return collectionProgress(d)[id]||{done:false,note:""};}
function updateCollectionSpecial(){
 const s=$("collectionSpecial");if(!s)return;
 const val=s.value;
 s.innerHTML=collectionKind==="mount"
  ?'<option value="">すべて</option><option value="multi">複数人乗り</option><option value="single">1人乗り</option>'
  :'<option value="">すべて</option><option value="roulette">ミニオンルーレット対象</option><option value="battle">LoVMバトル設定あり</option>';
 if([...s.options].some(o=>o.value===val))s.value=val;
}
function filteredCollection(){
 const d=load(),data=collectionData(),q=($("collectionSearch")?.value||"").trim().toLowerCase(),status=$("collectionStatus")?.value||"",special=$("collectionSpecial")?.value||"";
 return data.filter(x=>{
  const st=collectionState(d,x.id);
  const specialOk=!special||(collectionKind==="mount"?((special==="multi"&&x.seats>1)||(special==="single"&&x.seats===1)):((special==="roulette"&&x.roulette)||(special==="battle"&&x.battle)));
  return (!q||x.name.toLowerCase().includes(q))&&(!status||(status==="done"?st.done:!st.done))&&specialOk;
 });
}



function normalizeCollectionName(s){
 return String(s||"")
  .normalize("NFKC")
  .replace(/[・･\s　"'“”‘’()（）\[\]【】]/g,"")
  .toLowerCase();
}


const FFXIV_COLLECT_API="https://ffxivcollect.com/api";

const FC_OWNERSHIP_LABELS={
 minions:"ミニオン",mounts:"マウント",achievements:"アチーブメント",
 hairstyles:"ヘアカタログ",emotes:"エモート",orchestrions:"オーケストリオン",
 portraits:"ポートレート",spells:"青魔法",cards:"カード"
};
function fcProgressKey(kind){
 const map={minions:"minionProgress",mounts:"mountProgress",achievements:"achievementProgress",
 hairstyles:"hairstyleProgress",emotes:"emoteProgress",orchestrions:"orchestrionProgress",
 portraits:"portraitProgress",spells:"spellProgress",cards:"cardProgress",facewear:"facewearProgress"};
 return map[kind]||`${kind}Progress`;
}
function fcOwnedIdsFromPayload(payload){
 const candidates=[
  payload?.owned,payload?.items,payload?.results,payload?.data,
  payload?.minions,payload?.mounts,payload?.achievements,payload?.hairstyles,
  payload?.emotes,payload?.orchestrions,payload?.portraits,payload?.spells,payload?.cards
 ];
 for(const arr of candidates){
  if(!Array.isArray(arr))continue;
  const ids=arr.map(x=>typeof x==="object"?(x.id??x.ID??x.item_id??x.itemId):x)
               .filter(v=>v!==undefined&&v!==null).map(String);
  if(ids.length)return ids;
 }
 return [];
}

const FFXIV_COLLECT_CATALOGS={
 minions:{label:"ミニオン",endpoints:["minions"],hub:"fcHubMinions"},
 mounts:{label:"マウント",endpoints:["mounts"],hub:"fcHubMounts"},
 achievements:{label:"アチーブメント",endpoints:["achievements"],hub:"fcHubAchievements"},
 hairstyles:{label:"ヘアカタログ",endpoints:["hairstyles"],hub:"fcHubHairstyles"},
 emotes:{label:"エモート",endpoints:["emotes"],hub:"fcHubEmotes"},
 orchestrions:{label:"オーケストリオン",endpoints:["orchestrions","orchestrion"],hub:"fcHubOrchestrions"},
 frames:{label:"ポートレート",endpoints:["frames","framer-kits"],hub:"fcHubFrames"},
 spells:{label:"青魔法",endpoints:["spells","blue-magic"],hub:"fcHubSpells"},
 cards:{label:"カード",endpoints:["cards"],hub:"fcHubCards"}
};
function fcExtractResults(j){
 if(Array.isArray(j))return j;
 if(Array.isArray(j?.results))return j.results;
 if(Array.isArray(j?.data))return j.data;
 return [];
}
async function fcFetchJson(url){
 const r=await fetch(url,{headers:{Accept:"application/json"},cache:"no-store"});
 if(!r.ok)throw new Error(`HTTP ${r.status}`);
 return await r.json();
}
function fcCompactItem(x){
 return {
  id:x?.id??null,
  name:x?.name||"",
  description:x?.description||"",
  enhanced_description:x?.enhanced_description||"",
  patch:x?.patch??null,
  icon:x?.icon||x?.image||"",
  owned:x?.owned??null,
  rarity:x?.rarity??null,
  source:x?.source||x?.sources||[],
  sources:x?.sources||x?.source||[],
  type:x?.type||"",
  category:x?.category||"",
  points:x?.points??null
 };
}
async function fcFetchCatalog(endpoint){
 let page=1,all=[];
 while(page<=50){
  const sep=endpoint.includes("?")?"&":"?";
  const j=await fcFetchJson(`${FFXIV_COLLECT_API}/${endpoint}${sep}page=${page}`);
  const rows=fcExtractResults(j);
  if(!rows.length)break;
  all.push(...rows.map(fcCompactItem));
  const last=Number(j?.last_page||j?.pagination?.last_page||j?.meta?.last_page||0);
  const next=j?.next_page_url||j?.links?.next;
  if(last&&page>=last)break;
  if(!last&&!next&&rows.length<100)break;
  page++;
 }
 return [...new Map(all.map(x=>[String(x.id??x.name),x])).values()];
}
async function fcFetchCatalogCandidates(endpoints){
 let last=null;
 for(const endpoint of endpoints){
  try{
   const items=await fcFetchCatalog(endpoint);
   if(items.length)return {items,endpoint};
  }catch(e){last=e}
 }
 throw last||new Error("利用できるAPIエンドポイントが見つかりません");
}

/* FF_HUNT_ACQ_PRESET moved to assets/js/data/ff_hunt_acq_preset.js */

function importHuntAcquisitionPreset(){
 const d=ffAcqRoot(load());let added=0;
 for(const p of FF_HUNT_ACQ_PRESET){
  const key=[p.name,p.currency,p.cost,p.source].join("|");
  const exists=d.ffxivAcquisition.some(x=>x.presetKey===key);
  if(exists)continue;
  d.ffxivAcquisition.push({...p,id:uid(),owned:false,ownedAt:0,wanted:false,createdAt:Date.now(),presetKey:key,presetSource:"Lodestone"});
  added++;
 }
 save(d);if($("ffAcqImportStatus"))$("ffAcqImportStatus").textContent=added?`${added}件追加しました。`:"初期データは追加済みです。";renderFFAcquisition();
}
function ffAcqRoot(d=load()){d.ffxivAcquisition=d.ffxivAcquisition||[];return d}
function ffAcqNorm(s){return String(s||"").trim().replace(/\s+/g," ").toLowerCase()}
function ffAcqRouteKey(r){return [r.method,r.source,r.currency,r.cost,r.area,r.url].map(ffAcqNorm).join("|")}
function ffAcqItemKey(x){return [ffAcqNorm(x.name),ffAcqNorm(x.itemType)].join("|")}
function ffAcqMigrate(d){
 d=ffAcqRoot(d);
 const grouped=new Map();
 for(const x of d.ffxivAcquisition){
  const key=ffAcqItemKey(x);
  if(!grouped.has(key)){
   grouped.set(key,{id:x.id||uid(),name:x.name||"",itemType:x.itemType||"その他",memo:x.memo||"",owned:!!x.owned,ownedAt:x.ownedAt||0,wanted:!!x.wanted,createdAt:x.createdAt||Date.now(),routes:[]});
  }
  const g=grouped.get(key);
  g.owned=g.owned||!!x.owned;g.wanted=g.wanted||!!x.wanted;if(!g.memo&&x.memo)g.memo=x.memo;
  const routes=Array.isArray(x.routes)?x.routes:[{method:x.method||"その他",source:x.source||"",currency:x.currency||"",cost:x.cost||"",area:x.area||"",url:x.url||"",memo:x.routeMemo||"",presetKey:x.presetKey||"",presetSource:x.presetSource||""}];
  for(const r of routes){if(!g.routes.some(z=>ffAcqRouteKey(z)===ffAcqRouteKey(r)))g.routes.push({...r,id:r.id||uid()})}
 }
 d.ffxivAcquisition=[...grouped.values()];return d;
}
function ffAcqAddOrMerge(d,item,route){
 d=ffAcqMigrate(d);const key=ffAcqItemKey(item);let x=d.ffxivAcquisition.find(v=>ffAcqItemKey(v)===key);
 if(!x){x={id:item.id||uid(),name:item.name,itemType:item.itemType||"その他",memo:item.memo||"",owned:!!item.owned,ownedAt:item.ownedAt||0,wanted:!!item.wanted,createdAt:item.createdAt||Date.now(),routes:[]};d.ffxivAcquisition.push(x)}
 if(route&&!x.routes.some(r=>ffAcqRouteKey(r)===ffAcqRouteKey(route)))x.routes.push({...route,id:route.id||uid()});
 return x;
}
function importHuntAcquisitionPreset(){
 let d=ffAcqMigrate(load()),added=0,routesAdded=0;
 for(const p of FF_HUNT_ACQ_PRESET){
  const before=d.ffxivAcquisition.length;
  const x=ffAcqAddOrMerge(d,{name:p.name,itemType:p.itemType,memo:p.memo||"",createdAt:Date.now()},{method:p.method,source:p.source,currency:p.currency,cost:p.cost,area:p.area,url:p.url,memo:p.memo||"",presetKey:[p.name,p.currency,p.cost,p.source].join("|"),presetSource:"Lodestone"});
  if(d.ffxivAcquisition.length>before)added++;
  else routesAdded++;
 }
 save(d);if($("ffAcqImportStatus"))$("ffAcqImportStatus").textContent=(added||routesAdded)?`${added}件の報酬を追加 ／ ${routesAdded}件は既存報酬へ入手経路として統合しました。`:"初期データは追加済みです。";renderFFAcquisition();
}
function renderFFAcquisition(){
 let d=ffAcqMigrate(load());save(d);
 const q=($("ffAcqSearch").value||"").trim().toLowerCase(),mf=$("ffAcqFilterMethod").value||"",sf=$("ffAcqFilterState").value||"";
 let rows=d.ffxivAcquisition.filter(x=>{
  const routeText=(x.routes||[]).map(r=>[r.method,r.source,r.currency,r.area,r.memo].join(" ")).join(" ");
  const hay=[x.name,x.itemType,x.memo,routeText].join(" ").toLowerCase();
  const methodOK=!mf||(x.routes||[]).some(r=>r.method===mf);
  return(!q||hay.includes(q))&&methodOK&&(!sf||(sf==="owned"&&x.owned)||(sf==="missing"&&!x.owned)||(sf==="wanted"&&x.wanted));
 }).sort((a,b)=>(Number(b.wanted)-Number(a.wanted))||(Number(a.owned)-Number(b.owned))||String(a.name).localeCompare(String(b.name),"ja"));
 const all=d.ffxivAcquisition;$("ffAcqCount").textContent=`${all.length}件`;$("ffAcqTotal").textContent=all.length;$("ffAcqOwned").textContent=all.filter(x=>x.owned).length;$("ffAcqMissing").textContent=all.filter(x=>!x.owned).length;$("ffAcqWanted").textContent=all.filter(x=>x.wanted).length;
 $("ffAcqList").innerHTML=rows.length?rows.map(x=>`<details class="listitem"><summary><span><b>${esc(x.name)}</b> <span class="badge gold">${esc(x.itemType)}</span> <span class="badge">${(x.routes||[]).length}経路</span></span><span>${x.owned?"✓ 入手済":x.wanted?"★ 欲しい":""}</span></summary><div style="margin-top:8px">${(x.routes||[]).map(r=>`<div class="card" style="margin:6px 0"><b>${esc(r.method||"その他")}</b><div class="small">${esc(r.source||"入手先未登録")}${r.area?` ／ ${esc(r.area)}`:""}${r.currency?` ／ ${esc(r.currency)}${r.cost?` × ${esc(r.cost)}`:""}`:""}</div>${r.memo?`<div class="small">${esc(r.memo)}</div>`:""}${r.url?`<button class="secondary ffAcqRouteOpen" data-url="${esc(r.url)}">開く</button>`:""}</div>`).join("")}${x.memo?`<div class="small">${esc(x.memo)}</div>`:""}<div class="wrap"><button class="${x.owned?"success":"secondary"} ffAcqOwned" data-id="${x.id}">${x.owned?"✓ 入手済":"入手"}</button><button class="${x.wanted?"primary":"ghost"} ffAcqWanted" data-id="${x.id}">${x.wanted?"★":"☆"}</button><button class="danger ffAcqDelete" data-id="${x.id}">削除</button></div></div></details>`).join(""):'<div class="empty">該当する報酬はありません。</div>';
 document.querySelectorAll(".ffAcqOwned").forEach(b=>b.onclick=e=>{e.preventDefault();const d=ffAcqMigrate(load()),x=d.ffxivAcquisition.find(v=>v.id===b.dataset.id);if(!x)return;x.owned=!x.owned;x.ownedAt=x.owned?Date.now():0;save(d);renderFFAcquisition();if(typeof renderTodayHub==="function")renderTodayHub()});
 document.querySelectorAll(".ffAcqWanted").forEach(b=>b.onclick=e=>{e.preventDefault();const d=ffAcqMigrate(load()),x=d.ffxivAcquisition.find(v=>v.id===b.dataset.id);if(!x)return;x.wanted=!x.wanted;save(d);renderFFAcquisition()});
 document.querySelectorAll(".ffAcqRouteOpen").forEach(b=>b.onclick=e=>{e.preventDefault();if(b.dataset.url)window.open(b.dataset.url,"_blank","noopener")});
 document.querySelectorAll(".ffAcqDelete").forEach(b=>b.onclick=e=>{e.preventDefault();if(!confirm("この報酬と登録済みの入手経路を削除しますか？"))return;const d=ffAcqMigrate(load());d.ffxivAcquisition=d.ffxivAcquisition.filter(v=>v.id!==b.dataset.id);save(d);renderFFAcquisition()});
}
function renderFFXIVCollectHub(){
 const d=load(),p=ffProfileData(d),fc=p.ffxivCollect||{catalogs:{}};
 for(const [key,cfg] of Object.entries(FFXIV_COLLECT_CATALOGS)){
  const el=$(cfg.hub),c=fc.catalogs?.[key];
  if(el)el.textContent=c?.count?`${c.count}件 ／ 更新 ${fmt(c.updatedAt)}`:"未取得";
 }
 const st=$("ffxivCollectHubStatus");
 const catCount=Object.keys(fc.catalogs||{}).length;
 if(st){
  if(fc.lastCatalogSyncAt)st.innerHTML=`最終更新：<b>${fmt(fc.lastCatalogSyncAt)}</b> ／ ${catCount}カテゴリ`;
  else st.textContent=catCount?`${catCount}カテゴリ`:"未取得";
 }
 renderFCExplorer();
}

function openLifeArchiveView(view){
 const btn=document.querySelector(`.tab[data-view="${view}"]`);
 if(btn){btn.click();return}
 document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
 const target=$(view);if(target)target.classList.add("active");
}
document.querySelectorAll(".fcHomeLink").forEach(btn=>btn.onclick=()=>openLifeArchiveView(btn.dataset.viewTarget));
document.querySelectorAll(".fcTriadJump").forEach(btn=>btn.onclick=()=>{
 const el=$("triadCollectionHome");if(el)el.scrollIntoView({behavior:"smooth",block:"start"});
});

async function syncFFXIVCollectOwnership(){
 const btn=$("ffxivCollectOwnershipSync"),st=$("ffxivCollectOwnershipStatus");
 const d=load(),p=ffProfileData(d);
 const cid=String(p.lodestoneId||p.characterId||"").trim();
 if(!cid){alert("先にLodestone IDを登録してください。");return}

 if(btn)btn.disabled=true;
 if(st)st.innerHTML="<b>同期中…</b> 所持状況を確認しています。";

 // Lodestone公開情報からFFXIV Collectが自動更新できるカテゴリだけを対象にする。
 const supported=[
  ["minions","ミニオン"],
  ["mounts","マウント"],
  ["achievements","アチーブメント"],
  ["emotes","エモート"],
  ["facewear","フェイスアクセ"]
 ];

 let total=0;
 const rows=[];

 for(const [kind,label] of supported){
  try{
   const url=`https://ffxivcollect.com/api/characters/${encodeURIComponent(cid)}/${kind}/owned`;
   const r=await fetch(url,{headers:{Accept:"application/json"},cache:"no-store"});
   if(!r.ok)throw new Error(`HTTP ${r.status}`);
   const payload=await r.json();

   let ids=fcOwnedIdsFromPayload(payload);

   // Some endpoints may return a bare array.
   if(!ids.length&&Array.isArray(payload)){
    ids=payload.map(x=>typeof x==="object"?(x.id??x.ID??x.item_id??x.itemId):x)
               .filter(v=>v!==undefined&&v!==null).map(String);
   }

   const key=fcProgressKey(kind);
   d[key]=d[key]||{};

   for(const id of ids){
    const prev=d[key][id]||{};
    d[key][id]={...prev,done:true,owned:true,syncedAt:Date.now()};
   }

   total+=ids.length;
   rows.push(`${label}：${ids.length}件`);
  }catch(e){
   console.error("FFXIV Collect ownership sync",kind,e);
   rows.push(`${label}：取得できませんでした`);
  }
 }

 save(d);
 renderCollections();
 renderFFXIVCollectHub();
 renderFFSummary();

 const manual=["ヘアカタログ","オーケストリオン","ポートレート","青魔法","カード"];
 if(st)st.innerHTML=`<b>✓ 所持状況を同期</b>　${total}件<div class="small">${rows.map(esc).join(" ／ ")}</div><div class="small">手動管理：${manual.join("・")}</div>`;
 if(btn)btn.disabled=false;
}

async function syncFFXIVCollectCatalogs(){
 const btn=$("ffxivCollectCatalogSync"),st=$("ffxivCollectHubStatus");
 if(btn)btn.disabled=true;
 if(st)st.innerHTML="<b>更新中…</b> 図鑑データを確認しています。";

 const d=load(),p=ffProfileData(d),fc=p.ffxivCollect||(p.ffxivCollect={lastCatalogSyncAt:0,catalogs:{},sources:{}});
 fc.catalogs=fc.catalogs||{};
 const results=[];
 let totalNew=0,totalUpdated=0,totalSame=0;

 for(const [key,cfg] of Object.entries(FFXIV_COLLECT_CATALOGS)){
  try{
   const got=await fcFetchCatalogCandidates(cfg.endpoints||[cfg.endpoint]);
   const incoming=got.items||[];
   if(!incoming.length)throw new Error("0件");

   const oldCat=fc.catalogs[key]||{items:[]};
   const oldItems=Array.isArray(oldCat.items)?oldCat.items:[];
   const oldMap=new Map(oldItems.map(x=>[String(x.id??x.name),x]));
   let added=0,updated=0,same=0;

   for(const item of incoming){
    const id=String(item.id??item.name);
    const prev=oldMap.get(id);
    if(!prev){
     oldMap.set(id,item);
     added++;
     continue;
    }

    // Compare only the fetched catalog item itself. User progress is stored elsewhere.
    const before=JSON.stringify(prev);
    const after=JSON.stringify(item);
    if(before!==after){
     oldMap.set(id,{...prev,...item});
     updated++;
    }else{
     same++;
    }
   }

   const merged=[...oldMap.values()];
   fc.catalogs[key]={
    ...oldCat,
    items:merged,
    count:merged.length,
    updatedAt:Date.now(),
    endpoint:got.endpoint
   };

   totalNew+=added;totalUpdated+=updated;totalSame+=same;
   results.push(`${cfg.label}：新規 ${added} ／ 更新 ${updated}`);
  }catch(e){
   console.error("FFXIV Collect catalog sync",key,e);
   results.push(`${cfg.label}：前回データ維持`);
  }
 }

 const achCat=fc.catalogs?.achievements;
 if(achCat)fcApplyLocalAchievementJapanese(achCat);
 fc.lastCatalogSyncAt=Date.now();
 save(d);
 renderFFXIVCollectHub();
 renderCollections();

 if(st){
  st.innerHTML=`<b>✓ 図鑑の更新完了</b>　新規 <b>${totalNew}</b> ／ 更新 <b>${totalUpdated}</b> ／ 変更なし <b>${totalSame}</b><div class="small">${results.map(esc).join(" ／ ")}</div>`;
 }
 if(btn)btn.disabled=false;
}
function fcCatalogMap(kind){
 const p=ffProfileData(load()),items=p.ffxivCollect?.catalogs?.[kind]?.items||[];
 return {
  byId:new Map(items.map(x=>[Number(x.id),x])),
  byName:new Map(items.map(x=>[normalizeCollectionName(x.name),x]))
 };
}

const XIVAPI_V2_SHEET="https://v2.xivapi.com/api/sheet";

/* FC_JA_DESCRIPTION_SHEETS moved to assets/js/data/fc_ja_description_sheets.js */

function fcPlainXivapiText(v){
 return String(v??"").replace(/\r/g,"").replace(/\n{3,}/g,"\n\n").trim();
}
function fcXivapiEnglishName(row){
 return String(row?.fields?.["Singular@lang(en)"]??row?.fields?.Singular??"").trim();
}
function fcXivapiJapaneseName(row){
 return String(row?.fields?.Singular??"").trim();
}
function fcXivapiJapaneseDescription(row){
 const t=row?.transient||{};
 const v=t.Description??t["Description@lang(ja)"]??"";
 return fcPlainXivapiText(v);
}
async function fcFetchXivapiJaSheet(sheet){
 const rows=[];
 let after=-1;
 // Companion / Mount are small sheets, but paginate so future additions are safe.
 for(let guard=0;guard<20;guard++){
  const q=new URLSearchParams({
   fields:"Singular,Singular@lang(en)",
   transient:"Description",
   language:"ja",
   limit:"500"
  });
  if(after>=0)q.set("after",String(after));
  const r=await fetch(`${XIVAPI_V2_SHEET}/${encodeURIComponent(sheet)}?${q}`,{headers:{Accept:"application/json"},cache:"no-store"});
  if(!r.ok)throw new Error(`${sheet}: HTTP ${r.status}`);
  const j=await r.json();
  const part=Array.isArray(j?.rows)?j.rows:[];
  if(!part.length)break;
  rows.push(...part);
  const last=Number(part[part.length-1]?.row_id);
  if(!Number.isFinite(last)||last<=after)break;
  after=last;
  if(part.length<500)break;
 }
 return rows;
}
async function syncFFXIVCollectJapaneseDescriptions(){
 const btn=$("ffxivCollectJapaneseSync"),st=$("ffxivCollectJapaneseStatus");
 if(btn)btn.disabled=true;
 if(st)st.innerHTML="<b>取得中…</b> 日本語説明を確認しています。";
 try{
  const d=load(),p=ffProfileData(d),fc=p.ffxivCollect||(p.ffxivCollect={lastCatalogSyncAt:0,catalogs:{},sources:{}});
  fc.catalogs=fc.catalogs||{};
  let total=0;
  const result=[];
  for(const [kind,cfg] of Object.entries(FC_JA_DESCRIPTION_SHEETS)){
   const cat=fc.catalogs[kind];
   const items=Array.isArray(cat?.items)?cat.items:[];
   if(!items.length){result.push(`${cfg.label}：図鑑未取得`);continue}
   if(cfg.localAchievement){
    const applied=fcApplyLocalAchievementJapanese(cat);
    cat.jpDescriptionUpdatedAt=Date.now();
    cat.jpDescriptionSource="Life Archive Achievement DB / Japanese game data";
    total+=applied;
    result.push(`${cfg.label}：${applied}件`);
    continue;
   }
   const rows=await fcFetchXivapiJaSheet(cfg.sheet);
   const byId=new Map(rows.map(r=>[String(r.row_id),r]));
   const byEnglishName=new Map(rows.map(r=>[normalizeCollectionName(fcXivapiEnglishName(r)),r]).filter(([k])=>k));
   let applied=0;
   for(const item of items){
    const row=byId.get(String(item.id))||byEnglishName.get(normalizeCollectionName(item.name));
    if(!row)continue;
    const desc=fcXivapiJapaneseDescription(row);
    const jaName=fcXivapiJapaneseName(row);
    if(desc){item.description_ja=desc;applied++}
    if(jaName)item.name_ja=jaName;
   }
   cat.jpDescriptionUpdatedAt=Date.now();
   cat.jpDescriptionSource="XIVAPI v2 / FFXIV game client Japanese data";
   total+=applied;
   result.push(`${cfg.label}：${applied}件`);
  }
  fc.lastJapaneseDescriptionSyncAt=Date.now();
  save(d);
  renderFFXIVCollectHub();
  renderCollections();
  renderFCExplorer();
  if(st)st.innerHTML=`<b>✓ 日本語説明を同期</b>　${total}件<div class="small">${result.map(esc).join(" ／ ")}</div>`;
 }catch(e){
  console.error("Japanese description sync",e);
  if(st)st.innerHTML=`<b>⚠ 日本語説明の取得に失敗</b><div class="small">${esc(String(e?.message||e))}</div>`;
 }finally{
  if(btn)btn.disabled=false;
 }
}


function fcJapaneseDescription(item,kind=""){
 if(!item)return "";
 if(kind==="achievements"){
  const a=fcAchievementLocalJP(item);
  if(a?.description)return a.description;
 }
 // APIに日本語説明フィールドが含まれる場合は必ずそちらを優先。
 const direct=[
  item.description_ja,item.descriptionJa,item.japanese_description,
  item.ja?.description,item.translations?.ja?.description,
  item.localization?.ja?.description
 ].find(v=>typeof v==="string"&&v.trim());
 if(direct)return direct.trim();

 const raw=String(item.description||"").trim();
 if(!raw)return "";

 // 英語説明を勝手に機械翻訳して「公式文」に見せない。
 // 日本語が含まれている説明だけ、そのまま表示する。
 if(/[ぁ-んァ-ヶ一-龯々〆〤]/.test(raw))return raw;
 return "";
}
function fcDescriptionHTML(item,kind=""){
 const ja=fcJapaneseDescription(item,kind);
 if(ja)return `<details style="margin-top:4px"><summary class="small">説明</summary><div class="small" style="margin-top:3px">${esc(ja)}</div></details>`;
 const raw=String(item?.description||"").trim();
 if(raw)return `<details style="margin-top:4px"><summary class="small">説明</summary><div class="small muted" style="margin-top:3px">日本語説明は未取得</div></details>`;
 return "";
}

function fcAcquisitionInfo(item){
 const s=item?.sources??item?.source??[];
 const rows=Array.isArray(s)?s:[s];
 const out=[];
 for(const x of rows){
  if(!x)continue;
  if(typeof x==="string"){
   const txt=fcCompactAcquisitionText(x);
   if(txt)out.push({kind:"",detail:txt});
   continue;
  }
  const kind=fcJapaneseAcquisitionType(x.type||x.category||"");
  const detail=fcCompactAcquisitionText(x.text||x.name||x.description||"");
  const extra=[
   x.cost?String(x.cost):"",
   x.currency?fcJapaneseText(x.currency):"",
   x.zone?fcJapaneseProperName(x.zone):"",
   x.location?fcJapaneseProperName(x.location):"",
   x.npc?fcJapaneseProperName(x.npc):""
  ].filter(Boolean);
  out.push({kind,detail,extra});
 }
 return out.filter(x=>x.kind||x.detail||(x.extra&&x.extra.length));
}
function fcAcquisitionHTML(item){
 const rows=fcAcquisitionInfo(item);
 if(!rows.length)return "";
 return `<div class="acq-list">${rows.map(r=>{
  const same=r.kind&&r.detail&&normalizeCollectionName(r.kind)===normalizeCollectionName(r.detail);
  const main=same?r.kind:[r.kind,r.detail].filter(Boolean).join("：");
  const extra=(r.extra||[]).join(" ／ ");
  return `<div class="small">📍 ${esc(main)}${extra?` <span class="muted">／ ${esc(extra)}</span>`:""}</div>`;
 }).join("")}</div>`;
}


function fcUserMetaRoot(d){
 const p=ffProfileData(d);
 p.ffxivCollect=p.ffxivCollect||{lastCatalogSyncAt:0,catalogs:{},sources:{}};
 p.ffxivCollect.userMeta=p.ffxivCollect.userMeta||{};
 return p.ffxivCollect.userMeta;
}
function fcUserMeta(d,kind,id){
 const root=fcUserMetaRoot(d);
 root[kind]=root[kind]||{};
 const key=String(id);
 const m=root[kind][key]||{acquiredDate:"",memo:"",checks:[],tags:[]};
 m.acquiredDate=String(m.acquiredDate||"");
 m.memo=String(m.memo||"");
 m.checks=Array.isArray(m.checks)?m.checks:[];
 m.tags=Array.isArray(m.tags)?m.tags:[];
 root[kind][key]=m;
 return m;
}
function fcDisplayDateInput(v){
 if(!v)return "";
 const d=new Date(v);
 if(Number.isNaN(d.getTime()))return String(v).slice(0,10);
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function fcAllAchievementTags(d){
 const root=fcUserMetaRoot(d)?.achievements||{};
 const tags=[];
 for(const m of Object.values(root)){
  for(const tag of (m?.tags||[]))if(tag&& !tags.includes(tag))tags.push(tag);
 }
 return tags.sort((a,b)=>a.localeCompare(b,"ja"));
}
function fcNormalizeTags(v){
 return [...new Set(String(v||"").split(/[,、\n]/).map(x=>x.trim()).filter(Boolean))];
}
function fcAchievementTagHTML(d,kind,item){
 if(kind!=="achievements")return "";
 const m=fcUserMeta(d,kind,item.id);
 m.tags=Array.isArray(m.tags)?m.tags:[];
 const all=fcAllAchievementTags(d);
 return `<div class="fc-journal-grid" style="margin-top:8px">
  <div style="grid-column:1/-1">
   <label>自分用タグ</label>
   <input class="fcTagsInput" data-kind="${esc(kind)}" data-id="${esc(item.id)}" value="${esc(m.tags.join(", "))}" list="fcTagSuggestions_${esc(item.id)}" placeholder="例：黄金巡り, 優先, マウント関連">
   <datalist id="fcTagSuggestions_${esc(item.id)}">${all.map(x=>`<option value="${esc(x)}"></option>`).join("")}</datalist>
   <div style="margin-top:5px">${m.tags.map(x=>`<span class="badge">#${esc(x)}</span>`).join("")}</div>
  </div>
 </div>`;
}
function refreshFCExplorerTagOptions(d,kind){
 const row=$("fcExplorerTagRow"),sel=$("fcExplorerTag"),search=$("fcExplorerTagSearch");
 if(row)row.style.display=kind==="achievements"?"grid":"none";
 if(!sel)return;
 if(kind!=="achievements"){sel.innerHTML='<option value="">すべて</option>';if(search)search.value="";return}
 const prev=sel.value||"",tags=fcAllAchievementTags(d);
 sel.innerHTML='<option value="">すべて</option>'+tags.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
 if(tags.includes(prev))sel.value=prev;
}
function fcJournalHTML(d,kind,item){
 const m=fcUserMeta(d,kind,item.id);
 const checks=m.checks||[];
 return `<details class="fc-journal">
  <summary>📝 入手記録・メモ${m.acquiredDate?` <span class="badge green">入手 ${esc(fcDisplayDateInput(m.acquiredDate))}</span>`:""}${checks.length?` <span class="badge">${checks.filter(x=>x.done).length}/${checks.length}</span>`:""}</summary>
  <div class="fc-journal-grid">
   <div><label>${kind==="achievements"?"達成日":"入手日"}</label><input type="date" class="fcAcquiredDate" data-kind="${esc(kind)}" data-id="${esc(item.id)}" value="${esc(fcDisplayDateInput(m.acquiredDate))}"></div>
   <div><label>メモ</label><textarea class="fcMemo" data-kind="${esc(kind)}" data-id="${esc(item.id)}" placeholder="例：なかなか出なくて苦戦。最後は直接ドロップ。">${esc(m.memo||"")}</textarea></div>
  </div>
  ${fcAchievementTagHTML(d,kind,item)}
  <div class="small" style="margin-top:6px">チェックメモ</div>
  <div class="fc-check-list">${checks.length?checks.map(c=>`<div class="fc-check-row ${c.done?"done":""}"><input type="checkbox" class="fcCheckToggle" data-kind="${esc(kind)}" data-id="${esc(item.id)}" data-check="${esc(c.id)}" ${c.done?"checked":""}><div class="fc-check-text">${esc(c.text||"")}</div><button type="button" class="danger fcCheckDelete" data-kind="${esc(kind)}" data-id="${esc(item.id)}" data-check="${esc(c.id)}">×</button></div>`).join(""):'<div class="small">チェック項目はまだありません。</div>'}</div>
  <div class="fc-check-add"><input class="fcCheckNew" data-kind="${esc(kind)}" data-id="${esc(item.id)}" placeholder="例：極○○を50周した"><button type="button" class="secondary fcCheckAdd" data-kind="${esc(kind)}" data-id="${esc(item.id)}">＋</button></div>
 </details>`;
}
function bindFCJournalEvents(){
 document.querySelectorAll(".fcAcquiredDate").forEach(el=>el.onchange=()=>{
  const d=load(),m=fcUserMeta(d,el.dataset.kind,el.dataset.id);m.acquiredDate=el.value||"";save(d);renderFCExplorer();if(typeof renderDateArchive==="function")renderDateArchive();
 });
 document.querySelectorAll(".fcMemo").forEach(el=>el.onchange=()=>{
  const d=load(),m=fcUserMeta(d,el.dataset.kind,el.dataset.id);m.memo=el.value;save(d);
 });
 document.querySelectorAll(".fcTagsInput").forEach(el=>el.onchange=()=>{
  const d=load(),m=fcUserMeta(d,el.dataset.kind,el.dataset.id);m.tags=fcNormalizeTags(el.value);save(d);renderFCExplorer();if(typeof renderDateArchive==="function")renderDateArchive();
 });
 document.querySelectorAll(".fcCheckToggle").forEach(el=>el.onchange=()=>{
  const d=load(),m=fcUserMeta(d,el.dataset.kind,el.dataset.id),c=m.checks.find(x=>String(x.id)===String(el.dataset.check));if(!c)return;c.done=el.checked;c.doneAt=el.checked?Date.now():0;save(d);renderFCExplorer();if(typeof renderDateArchive==="function")renderDateArchive();
 });
 document.querySelectorAll(".fcCheckDelete").forEach(b=>b.onclick=()=>{
  const d=load(),m=fcUserMeta(d,b.dataset.kind,b.dataset.id);m.checks=m.checks.filter(x=>String(x.id)!==String(b.dataset.check));save(d);renderFCExplorer();
 });
 document.querySelectorAll(".fcCheckAdd").forEach(b=>b.onclick=()=>{
  const input=document.querySelector(`.fcCheckNew[data-kind="${CSS.escape(b.dataset.kind)}"][data-id="${CSS.escape(b.dataset.id)}"]`);
  const text=(input?.value||"").trim();if(!text)return;
  const d=load(),m=fcUserMeta(d,b.dataset.kind,b.dataset.id);m.checks.push({id:uid(),text,done:false,createdAt:Date.now(),doneAt:0});save(d);renderFCExplorer();
 });
}
function refreshFCExplorerSourceOptions(kind){
 const sel=$("fcExplorerSource"),label=$("fcExplorerSourceLabel");if(!sel)return;
 const previous=sel.value||"";
 const collection=["ダンジョン","討伐・討滅戦","レイド","クエスト","製作","採集","交換","ショップ","ゴールドソーサー","シーズナルイベント","オンラインストア","宝の地図","F.A.T.E.","PvP"];
 const achievementBase=["キャラクター","バトル","クエスト","製作・採集","PvP","探検","グランドカンパニー","アイテム","その他"];
 const achievementDetail=["ダンジョン","討伐・討滅戦","レイド"];
 const achievementKinds=(typeof ACHIEVEMENT_DB!=="undefined"?[...new Set(ACHIEVEMENT_DB.filter(a=>a.kind&&a.kind!=="レガシー").map(a=>a.kind))]:[]);
 const achievement=[...new Set([...achievementBase,...achievementKinds,...achievementDetail])];
 const rows=kind==="achievements"?achievement:collection;
 if(label)label.textContent=kind==="achievements"?"カテゴリ":"入手方法";
 const current=[...sel.options].slice(1).map(o=>o.value||o.textContent);
 if(current.join("\n")!==rows.join("\n")){
  sel.innerHTML='<option value="">すべて</option>'+rows.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
  if(rows.includes(previous))sel.value=previous;
 }
}
function renderFCExplorer(){
 const kind=$("fcExplorerKind")?.value||"minions";
 refreshFCExplorerSourceOptions(kind);
 const q=($("fcExplorerSearch")?.value||"").trim().toLowerCase();
 const status=$("fcExplorerStatus")?.value||"all";
 const sourceFilter=$("fcExplorerSource")?.value||"";
 const sort=$("fcExplorerSort")?.value||"default";
 const tagFilter=$("fcExplorerTag")?.value||"";
 const tagSearch=($("fcExplorerTagSearch")?.value||"").trim().toLowerCase();
 const d=load(),p=ffProfileData(d),c=p.ffxivCollect?.catalogs?.[kind],box=$("fcExplorerList"),sum=$("fcExplorerSummary");
 refreshFCExplorerTagOptions(d,kind);
 if(!box)return;
 const progress=kind==="minions"?(d.minionProgress||{}):kind==="mounts"?(d.mountProgress||{}):null;
 const isOwned=x=>{
  if(progress){
   const local=(kind==="minions"?MINION_DATA:MOUNT_DATA);
   const localItem=local.find(v=>Number(v.id)===Number(x.id))||local.find(v=>normalizeCollectionName(v.name)===normalizeCollectionName(x.name));
   return !!(localItem&&progress[String(localItem.id)]?.done);
  }
  return x.owned===true;
 };
 let source=(c?.items||[]);
 let filtered=source.filter(x=>{
  const src=fcSourceText(x);
  const acqRows=fcAcquisitionInfo(x);
  const acq=acqRows.map(r=>[r.kind,r.detail,...(r.extra||[])].join(" ")).join(" ");
  const hay=[x.name,x.name_ja,x.description,x.description_ja,x.category,x.category_ja,x.type,x.subcategory_ja,src,acq].join(" ").toLowerCase();
  const owned=isOwned(x);
  const sourceHit=!sourceFilter||(()=>{
   // アチーブメントにはFFXIV Collectの「入手方法 sources」が無い。
   // 代わりに公式Achievement DBの大分類・小分類を同じフィルターで判定する。
   if(kind==="achievements"){
    const a=fcAchievementLocalJP(x);
    const fields=[
     a?.kind,a?.category,x.category_ja,x.subcategory_ja,
     x.category,x.type
    ].filter(Boolean);
    const target=normalizeCollectionName(sourceFilter);
    return fields.some(v=>{
     const n=normalizeCollectionName(fcJapaneseText(v));
     return n===target||n.includes(target)||target.includes(n);
    });
   }
   return acqRows.some(r=>{
    const parts=[r.kind,r.detail,...(r.extra||[])].filter(Boolean);
    return parts.some(v=>normalizeCollectionName(v)===normalizeCollectionName(sourceFilter)||String(v).includes(sourceFilter));
   });
  })();
  const meta=kind==="achievements"?fcUserMeta(d,kind,x.id):null;
  const tags=meta?.tags||[];
  const tagHit=!tagFilter||tags.includes(tagFilter);
  const tagSearchHit=!tagSearch||tags.some(v=>v.toLowerCase().includes(tagSearch));
  return (!q||hay.includes(q))&&sourceHit&&tagHit&&tagSearchHit&&(status==="all"||(status==="owned"&&owned)||(status==="missing"&&!owned));
 });
 if(sort==="name")filtered.sort((a,b)=>(fcJapaneseTitle(a,kind)||a.name||"").localeCompare(fcJapaneseTitle(b,kind)||b.name||"","ja"));
 if(sort==="acquiredDesc"||sort==="acquiredAsc"){
  filtered.sort((a,b)=>{
   const da=fcUserMeta(d,kind,a.id).acquiredDate||"",db=fcUserMeta(d,kind,b.id).acquiredDate||"";
   if(!da&&!db)return 0;if(!da)return 1;if(!db)return -1;
   return sort==="acquiredDesc"?db.localeCompare(da):da.localeCompare(db);
  });
 }
 const totalFiltered=filtered.length,rows=filtered.slice(0,200);
 if(sum)sum.textContent=c?`${c.count}件中 ${totalFiltered}件${totalFiltered>200?"（200件まで表示）":""}`:"このカテゴリはまだ取得されていません。";
 box.innerHTML=rows.length?rows.map(x=>{
  const owned=isOwned(x);
  const name=fcJapaneseTitle(x,kind)||fcJapaneseProperName(x.name||"")||x.name||`#${x.id}`;
  const achLocal=kind==="achievements"?fcAchievementLocalJP(x):null;
  const meta=[x.patch?`Patch ${x.patch}`:"",x.points!=null?`${x.points}pt`:"",achLocal?.kind||x.category_ja||(x.category?fcJapaneseText(x.category):""),achLocal?.category||x.subcategory_ja||(x.type?fcJapaneseText(x.type):"")].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(" ／ ");
  const ownedBadge=progress?`<span class="badge ${owned?"green":""}">${owned?"✓ 取得済み":"未取得"}</span>`:"";
  const userTags=kind==="achievements"?(fcUserMeta(d,kind,x.id).tags||[]):[];
  return `<div class="listitem"><div class="row"><div><b>${esc(name)}</b> ${ownedBadge}</div><span class="small">${esc(meta)}</span></div>${userTags.length?`<div style="margin-top:4px">${userTags.map(t=>`<span class="badge">#${esc(t)}</span>`).join("")}</div>`:""}${fcAcquisitionHTML(x)}${fcDescriptionHTML(x,kind)}${fcJournalHTML(d,kind,x)}</div>`;
 }).join(""):'<div class="empty">該当データはありません。</div>';
 bindFCJournalEvents();
}
const FC_JA_TERMS=[
 ["Achievement","アチーブメント"],["Achievements","アチーブメント"],
 ["Dungeon","ダンジョン"],["Dungeons","ダンジョン"],
 ["Trial","討伐・討滅戦"],["Trials","討伐・討滅戦"],
 ["Raid","レイド"],["Raids","レイド"],
 ["Alliance Raid","アライアンスレイド"],["Treasure Hunt","トレジャーハント"],
 ["Quest","クエスト"],["Quests","クエスト"],["Side Quest","サブクエスト"],
 ["Main Scenario Quest","メインクエスト"],["Beast Tribe","友好部族"],
 ["Tribal Quest","友好部族クエスト"],["FATE","F.A.T.E."],
 ["Crafting","製作"],["Crafted","製作"],["Gathering","採集"],["Gathered","採集"],
 ["Fishing","釣り"],["Venture","リテイナーベンチャー"],["Retainer Venture","リテイナーベンチャー"],
 ["Gold Saucer","ゴールドソーサー"],["MGP","MGP"],["PvP","PvP"],
 ["Deep Dungeon","ディープダンジョン"],["Variant Dungeon","ヴァリアントダンジョン"],
 ["Criterion Dungeon","アナザーダンジョン"],["Field Operations","フィールド探索型コンテンツ"],
 ["Bozja","ボズヤ"],["Eureka","エウレカ"],["The Diadem","雲海採集 ディアデム諸島"],
 ["Island Sanctuary","無人島開拓"],["Ocean Fishing","オーシャンフィッシング"],
 ["Treasure Map","宝の地図"],["Maps","宝の地図"],["Map","地図"],
 ["Online Store","オンラインストア"],["Mog Station","モグステーション"],
 ["Seasonal Event","シーズナルイベント"],["Event","イベント"],
 ["Purchase","購入"],["Purchased","購入"],["Exchange","交換"],["Vendor","ショップ"],
 ["Drop","ドロップ"],["Drops","ドロップ"],["Reward","報酬"],["Rewards","報酬"],
 ["Loot","戦利品"],["Chest","宝箱"],["Coffer","宝箱"],["Desynthesis","分解"],
 ["Gardening","栽培"],["Subaquatic Voyages","潜水艦探索"],["Airship Voyages","飛空艇探索"],
 ["Wondrous Tails","クロの空想帳"],["Khloe's Gold Certificate of Commendation","クロの賞状：金賞"],
 ["Bicolor Gemstones","バイカラージェム"],["Allied Seals","同盟記章"],
 ["Centurio Seals","セントリオ記章"],["Sacks of Nuts","モブハントの戦利品"],
 ["Company Seals","軍票"],["Wolf Marks","対人戦績"],["Trophy Crystals","トロフィークリスタル"],
 ["Tomestones","アラガントームストーン"],["Gil","ギル"],
 ["Hairstyle","ヘアスタイル"],["Emote","エモート"],["Orchestrion","オーケストリオン"],
 ["Framer's Kit","ポートレート教材"],["Blue Magic","青魔法"],["Triple Triad","トリプルトライアド"],
 ["General","一般"],["Special","スペシャル"],["Expressions","表情"],
 ["Common","コモン"],["Uncommon","アンコモン"],["Rare","レア"]
];

const FC_JA_PROPER_NAMES={
 // Duties / areas / recurring acquisition destinations.
 "The Gold Saucer":"ゴールドソーサー",
 "The Diadem":"雲海採集 ディアデム諸島",
 "Eureka Orthos":"オルト・エウレカ",
 "Heaven-on-High":"アメノミハシラ",
 "Palace of the Dead":"死者の宮殿",
 "The Bozjan Southern Front":"南方ボズヤ戦線",
 "Zadnor":"ザトゥノル高原",
 "The Forbidden Land, Eureka":"禁断の地 エウレカ",
 "Island Sanctuary":"無人島開拓",
 "Ocean Fishing":"オーシャンフィッシング",
 // Common system/source labels that can appear as text rather than type.
 "Online Store":"オンラインストア",
 "Mog Station":"モグステーション",
 "Seasonal Event":"シーズナルイベント",
 "Gold Saucer":"ゴールドソーサー"
};
function fcJapaneseProperName(value){
 const raw=String(value||"").trim();if(!raw)return "";
 if(FC_JA_PROPER_NAMES[raw])return FC_JA_PROPER_NAMES[raw];
 // Preserve punctuation around a known exact proper name.
 for(const [en,ja] of Object.entries(FC_JA_PROPER_NAMES)){
  if(raw===en)return ja;
 }
 return raw;
}

function fcJapaneseText(value){
 let s=String(value||"").trim();if(!s)return "";
 const exact=fcJapaneseProperName(s);
 if(exact!==s)return exact;
 // Common source sentence patterns first.
 s=s.replace(/\bCrafted by ([A-Za-z ]+)\b/gi,(_,job)=>`${fcJobJa(job)}で製作`);
 s=s.replace(/\bGathered by ([A-Za-z ]+)\b/gi,(_,job)=>`${fcJobJa(job)}で採集`);
 s=s.replace(/\bPurchased from\b/gi,"購入：");
 s=s.replace(/\bDropped by\b/gi,"ドロップ：");
 s=s.replace(/\bReward from\b/gi,"報酬：");
 s=s.replace(/\bReward for\b/gi,"報酬：");
 s=s.replace(/\bObtained from\b/gi,"入手：");
 for(const [en,ja] of FC_JA_TERMS){
  const rx=new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`,"gi");
  s=s.replace(rx,ja);
 }
 return s;
}
function fcJobJa(job){
 const m={
  "Alchemist":"錬金術師","Armorer":"甲冑師","Blacksmith":"鍛冶師","Carpenter":"木工師",
  "Culinarian":"調理師","Goldsmith":"彫金師","Leatherworker":"革細工師","Weaver":"裁縫師",
  "Botanist":"園芸師","Fisher":"漁師","Miner":"採掘師"
 };
 return m[String(job||"").trim()]||String(job||"").trim();
}

const FC_JA_TITLE_MAP={
 // 確認済み・Life Archive内で使う代表的な正式日本語名。
 // 今後、公式日本語名を確認した項目をここへ追加する。
 "Demi-Ozma":"デミオズマ",
 "Palace Pal":"パレス・オブ・デッド",
 "Wind-up Alpha":"マメット・アルファ",
 "Wind-up Estinien":"マメット・エスティニアン",
 "Wind-up Haurchefant":"マメット・オルシュファン",
 "Wind-up G'raha Tia":"マメット・グ・ラハ・ティア",
 "Wind-up Ardbert":"マメット・アルバート",
 "Wind-up Ryne":"マメット・リーン",
 "Wind-up Gaia":"マメット・ガイア"
};

function fcAchievementLocalJP(item){
 if(!item||typeof ACHIEVEMENT_DB==="undefined")return null;
 const id=Number(item.id);
 let a=Number.isFinite(id)?ACHIEVEMENT_DB.find(x=>Number(x.id)===id):null;
 if(!a&&item.name){
  const q=normalizeCollectionName(item.name);
  a=ACHIEVEMENT_DB.find(x=>normalizeCollectionName(x.name)===q)||null;
 }
 return a||null;
}
function fcApplyLocalAchievementJapanese(cat){
 if(!cat||!Array.isArray(cat.items))return 0;
 let applied=0;
 for(const item of cat.items){
  const a=fcAchievementLocalJP(item);
  if(!a)continue;
  if(a.name)item.name_ja=a.name;
  if(a.description)item.description_ja=a.description;
  if(a.kind)item.category_ja=a.kind;
  if(a.category)item.subcategory_ja=a.category;
  applied++;
 }
 return applied;
}
function fcJapaneseTitle(item,kind){
 if(!item)return "";
 // 0) アチーブメントはLife Archive内蔵の公式日本語データを最優先
 if(kind==="achievements"){
  const a=fcAchievementLocalJP(item);
  if(a?.name)return a.name;
  if(item.name_ja)return item.name_ja;
 }
 // 1) Life Archiveが既に持つ日本語マスターを最優先
 const local=fcOfficialNameBase(item,kind);
 if(local&&local!==item.name)return local;
 // 2) 確認済み正式日本語名辞書
 const raw=String(item.name||"").trim();
 if(FC_JA_TITLE_MAP[raw])return FC_JA_TITLE_MAP[raw];
 // 3) 未確認の固有名詞は誤訳せず原文
 return raw;
}
function fcOfficialNameBase(item,kind){
 if(!item)return "";
 const data=kind==="minions"?MINION_DATA:kind==="mounts"?MOUNT_DATA:kind==="achievements"?ACHIEVEMENT_DB:null;
 if(data){
  const byId=data.find(x=>Number(x.id)===Number(item.id));
  if(byId)return byId.name;
  const byName=data.find(x=>normalizeCollectionName(x.name)===normalizeCollectionName(item.name));
  if(byName)return byName.name;
 }
 return item.name||"";
}

function fcOfficialName(item,kind){
 return fcJapaneseTitle(item,kind);
}



const FC_ACQ_JA_RULES=[
 [/Dungeon/i,"ダンジョン"],
 [/Trial/i,"討伐・討滅戦"],
 [/Raid/i,"レイド"],
 [/Quest/i,"クエスト"],
 [/Craft(?:ed|ing)?/i,"製作"],
 [/Gather(?:ed|ing)?/i,"採集"],
 [/Vendor|Purchase|Purchased/i,"ショップ"],
 [/Exchange|Trade/i,"交換"],
 [/Gold Saucer|MGP/i,"ゴールドソーサー"],
 [/Seasonal Event|Seasonal/i,"シーズナルイベント"],
 [/Tomestones?/i,"アラガントームストーン"],
 [/Allied Seals?/i,"同盟記章"],
 [/Centurio Seals?/i,"セントリオ記章"],
 [/Bicolor Gemstones?/i,"バイカラージェム"],
 [/Wolf Marks?/i,"対人戦績"],
 [/Achievement Certificates?/i,"アチーブメントスクリップ"],
 [/Online Store|Mog Station/i,"オンラインストア"],
 [/Treasure Map|Treasure Hunt/i,"宝の地図"],
 [/F\.?A\.?T\.?E\.?/i,"F.A.T.E."],
 [/PvP/i,"PvP"],
 [/Achievement/i,"アチーブメント"],
 [/Deep Dungeon/i,"ディープダンジョン"],
 [/Retainer Venture|Venture/i,"リテイナーベンチャー"],
 [/Hunt/i,"モブハント"],
 [/Island Sanctuary/i,"無人島開拓"],
 [/Variant Dungeon/i,"ヴァリアントダンジョン"],
 [/Criterion Dungeon/i,"アナザーダンジョン"],
 [/Field Operation/i,"特殊フィールド探索"],
 [/Bozja|Bozjan/i,"ボズヤ"],
 [/Eureka/i,"禁断の地 エウレカ"]
];
function fcJapaneseAcquisitionType(v){
 const raw=String(v||"").trim();
 if(!raw)return "";
 const normalized=raw.replace(/\s+/g," ");
 const exact={
  "Raid":"レイド","Raids":"レイド","Alliance Raid":"アライアンスレイド",
  "Dungeon":"ダンジョン","Trial":"討伐・討滅戦","Quest":"クエスト",
  "FATE":"F.A.T.E.","PvP":"PvP","Achievement":"アチーブメント"
 };
 if(exact[normalized])return exact[normalized];
 for(const [re,ja] of FC_ACQ_JA_RULES)if(re.test(raw))return ja;
 return fcJapaneseText(raw);
}
function fcCompactAcquisitionText(v){
 let s=String(v||"").trim();
 if(!s)return "";
 // よく出る定型だけを日本語化。固有名詞は無理に翻訳しない。
 const rules=[
  [/\bPurchased from\b/gi,"購入"],
  [/\bPurchase from\b/gi,"購入"],
  [/\bReward from\b/gi,"報酬"],
  [/\bDropped by\b/gi,"ドロップ"],
  [/\bDrops from\b/gi,"ドロップ"],
  [/\bObtained from\b/gi,"入手"],
  [/\bObtained via\b/gi,"入手"],
  [/\bAwarded for\b/gi,"報酬"],
  [/\bExchange(?:d)? for\b/gi,"交換"],
  [/\bComplete\b/gi,"クリア"],
  [/\bCompleting\b/gi,"クリア"],
  [/\bCrafted by\b/gi,"製作"],
  [/\bGathered by\b/gi,"採集"],
  [/\bAvailable during\b/gi,"期間"],
  [/\bAvailable from\b/gi,"入手先"],
  [/\bAchievement\b/gi,"アチーブメント"],
  [/\bQuest\b/gi,"クエスト"],
  [/\bDungeon\b/gi,"ダンジョン"],
  [/\bTrial\b/gi,"討伐・討滅戦"],
  [/\bRaid\b/gi,"レイド"],
  [/\bVendor\b/gi,"ショップ"],
  [/\bGold Saucer\b/gi,"ゴールドソーサー"],
  [/\bOnline Store\b/gi,"オンラインストア"],
  [/\bMog Station\b/gi,"オンラインストア"],
  [/\bTreasure Map\b/gi,"宝の地図"],
  [/\bSeasonal Event\b/gi,"シーズナルイベント"]
 ];
 for(const [re,ja] of rules)s=s.replace(re,ja);
 return fcJapaneseSourceDetail(s);
}

function fcJapaneseSourceDetail(value){
 const raw=String(value||"").trim();if(!raw)return "";
 const exact=fcJapaneseProperName(raw);
 if(exact!==raw)return exact;
 // Translate known system terms while leaving unknown NPC/duty/item names untouched.
 return fcJapaneseText(raw);
}

function fcSourceText(item){
 const s=item?.sources??item?.source??[];
 const one=x=>{
  if(typeof x==="string")return fcJapaneseText(x);
  if(!x||typeof x!=="object")return "";
  const type=fcJapaneseText(x.type||x.category||"");
  const text=fcJapaneseSourceDetail(x.text||x.name||x.description||"");
  // Keep both fields: FFXIV Collect commonly stores e.g. type="Dungeon", text="The Dead Ends".
  if(type&&text&&normalizeCollectionName(type)!==normalizeCollectionName(text))return `${type}：${text}`;
  return text||type;
 };
 if(Array.isArray(s))return s.map(one).filter(Boolean).join(" / ");
 return one(s);
}

async function syncMinionsFromFFXIVCollect(){
 const st=$("minionLodestoneStatus"),d=load(),p=ffProfileData(d);
 const id=p.lodestoneId||normalizeLodestoneId($("ffLodestoneId")?.value);
 if(!id){alert("先にFF14プロフィールでLodestone IDを登録してください");return}
 if(st)st.innerHTML="<b>同期中…</b> FFXIV Collectの公開データを取得しています。";
 try{
  const urls=[
   `https://ffxivcollect.com/api/characters/${id}/minions/owned?latest=true`,
   `https://ffxivcollect.com/api/characters/${id}/minions/owned`
  ];
  let data=null,last=null;
  for(const url of urls){
   try{
    const r=await fetch(url,{headers:{Accept:"application/json"},cache:"no-store"});
    if(r.status===403)throw new Error("FFXIV Collect上でミニオン情報が非公開です");
    if(r.status===404)throw new Error("FFXIV Collectにこのキャラクターがまだ登録されていません");
    if(!r.ok)throw new Error(`FFXIV Collect HTTP ${r.status}`);
    const j=await r.json();
    if(Array.isArray(j)){data=j;break}
    if(Array.isArray(j?.results)){data=j.results;break}
    throw new Error("APIレスポンス形式を認識できません");
   }catch(e){last=e}
  }
  if(!data)throw last||new Error("取得できませんでした");
  const byId=new Map(MINION_DATA.map(m=>[Number(m.id),m]));
  const byName=new Map(MINION_DATA.map(m=>[normalizeCollectionName(m.name),m]));
  const matched=[],unmatched=[];
  for(const x of data){
   let m=byId.get(Number(x.id));
   if(!m&&x.name)m=byName.get(normalizeCollectionName(x.name));
   if(m)matched.push(m);else unmatched.push({id:x.id,name:x.name||""});
  }
  const unique=[...new Map(matched.map(m=>[String(m.id),m])).values()];
  let newly=0,already=0;
  d.minionProgress=d.minionProgress||{};
  for(const m of unique){
   const key=String(m.id),s=d.minionProgress[key]||{done:false,note:""};
   if(s.done)already++;else newly++;
   s.done=true;s.lodestoneSynced=true;s.lodestoneSyncedAt=Date.now();s.syncSource="FFXIV Collect";
   d.minionProgress[key]=s;
  }
  p.minionSync={lastImportedAt:Date.now(),lodestoneTotal:data.length,matched:unique.length,fileName:"FFXIV Collect API",unmatched:unmatched.slice(0,50)};
  save(d);
  const warn=unmatched.length?` ／ 未照合 ${unmatched.length}件`:"";
  if(st)st.innerHTML=`<b>✓ API同期完了</b>：${unique.length}件（新規 ${newly} ／ 既存 ${already}）${warn}${unmatched.length?`<div>未照合：${unmatched.slice(0,10).map(x=>esc(x.name||("#"+x.id))).join("、")}${unmatched.length>10?"…":""}</div>`:""}`;
  renderCollections();
 }catch(e){
  console.error("FFXIV Collect minion sync failed",e);
  if(st)st.innerHTML=`<b>⚠ API同期できませんでした。</b><div>${esc(e.message||String(e))}</div><div>${/404|登録/i.test(String(e.message||e))?"FFXIV Collectでキャラクターを検索・更新してから、もう一度同期してください。":"通信またはLife Archive側の処理を確認してください。"}</div>`;
 }
}
function renderMinionSyncStatus(){
 const el=$("minionLodestoneStatus");if(!el)return;
 const p=ffProfileData(load()),s=p.minionSync||{};
 if(s.lastImportedAt)el.innerHTML=`最終同期：${fmt(s.lastImportedAt)} ／ ${s.matched}${s.lodestoneTotal?` / ${s.lodestoneTotal}`:""}件 ／ ${esc(s.fileName||"")}`;
}
function renderCollections(){
 if(!$("collectionList"))return;
 renderMinionSyncStatus();
 updateCollectionSpecial();
 const d=load(),data=collectionData(),arr=filteredCollection(),size=Number($("collectionPageSize")?.value||100);
 const pages=Math.max(1,Math.ceil(arr.length/size));collectionPage=Math.min(Math.max(1,collectionPage),pages);
 const start=(collectionPage-1)*size,items=arr.slice(start,start+size),listedDone=data.filter(x=>collectionState(d,x.id).done).length;
 const sync=collectionKind==="minion"?(ffProfileData(d).minionSync||{}):{};
 const done=collectionKind==="minion"&&sync.lastImportedAt?Math.max(listedDone,Number(sync.found||sync.lodestoneTotal||0)):listedDone;
 $("collectionTotal").textContent=data.length.toLocaleString("ja-JP");
 $("collectionDone").textContent=done.toLocaleString("ja-JP");
 $("collectionTodo").textContent=Math.max(0,data.length-done).toLocaleString("ja-JP");
 $("collectionShown").textContent=arr.length.toLocaleString("ja-JP");
 $("collectionPageInfo").textContent=`${collectionPage} / ${pages}ページ`;
 $("collectionPrev").disabled=collectionPage<=1;$("collectionNext").disabled=collectionPage>=pages;
 document.querySelectorAll(".collectionTab").forEach(b=>{b.classList.toggle("primary",b.dataset.kind===collectionKind);b.classList.toggle("secondary",b.dataset.kind!==collectionKind)});
 $("collectionList").innerHTML=items.length?items.map(x=>{
  const st=collectionState(d,x.id);
  const syncBadge=collectionKind==="minion"&&st.lodestoneSynced?'<span class="badge green">外部同期</span>':"";
  const fcKind=collectionKind==="minion"?"minions":"mounts",fcMap=fcCatalogMap(fcKind);
  const fcItem=fcMap.byId.get(Number(x.id))||fcMap.byName.get(normalizeCollectionName(x.name));
  const fcSource=fcSourceText(fcItem);
  const detail=collectionKind==="mount"
   ?`${x.seats>1?`<span class="badge gold">${x.seats}人乗り</span>`:""}`
   :`${x.roulette?'<span class="badge">ルーレット対象</span>':""}${x.battle?'<span class="badge">LoVM</span>':""}`;
  return `<div class="card ${st.done?"archived":""}">
   <div class="row"><label style="margin:0;color:var(--text)"><input type="checkbox" class="collectionCheck" data-id="${x.id}" style="width:auto" ${st.done?"checked":""}> <b>${esc(x.name)}</b></label><div class="wrap">${syncBadge}${detail}</div></div>${fcSource?`<div class="small" style="margin-top:4px">📍 ${esc(fcSource)}</div>`:""}
   <div class="inline2" style="margin-top:8px"><input class="collectionNote" data-id="${x.id}" value="${esc(st.note||"")}" placeholder="自分用メモ"><button type="button" class="secondary collectionOfficial" data-name="${esc(x.name)}">公式DBで検索</button></div>
  </div>`;
 }).join(""):'<div class="empty">該当するデータはありません。</div>';
 document.querySelectorAll(".collectionCheck").forEach(c=>c.onchange=()=>{
  const d=load(),id=c.dataset.id,key=collectionKind==="mount"?"mountProgress":"minionProgress";d[key]=d[key]||{};
  const st=d[key][id]||{done:false,note:""};st.done=c.checked;d[key][id]=st;save(d);renderCollections();
 });
 document.querySelectorAll(".collectionNote").forEach(i=>i.onchange=()=>{
  const d=load(),id=i.dataset.id,key=collectionKind==="mount"?"mountProgress":"minionProgress";d[key]=d[key]||{};
  const st=d[key][id]||{done:false,note:""};st.note=i.value;d[key][id]=st;save(d);
 });
 document.querySelectorAll(".collectionOfficial").forEach(b=>b.onclick=()=>openTemplate("https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/?q={query}",b.dataset.name));
}

/* TRIPLE_TRIAD_DATA moved to assets/js/data/triple_triad_data.js */

let cardPage=1;
function cardState(d,id){return d.cardProgress?.[id]||{done:false,note:""};}
function fillCardTypes(){
 const s=$("cardType");if(!s)return;
 const old=s.value;
 const types=[...new Set(TRIPLE_TRIAD_DATA.map(c=>c.type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ja"));
 s.innerHTML='<option value="">すべて</option>'+types.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("");
 if(types.includes(old))s.value=old;
}
function filteredCards(){
 const d=load(),q=($("cardSearch")?.value||"").trim().toLowerCase(),status=$("cardStatus")?.value||"",rarity=$("cardRarity")?.value||"",type=$("cardType")?.value||"",sort=$("cardSort")?.value||"number";
 let arr=TRIPLE_TRIAD_DATA.filter(c=>{
  const st=cardState(d,c.id);
  return (!q||(c.name+" "+c.type).toLowerCase().includes(q))
    &&(!status||(status==="done"?st.done:!st.done))
    &&(!rarity||String(c.rarity)===rarity)
    &&(!type||c.type===type);
 });
 if(sort==="name")arr.sort((a,b)=>a.name.localeCompare(b.name,"ja"));
 else if(sort==="rarity")arr.sort((a,b)=>b.rarity-a.rarity||a.number-b.number);
 else arr.sort((a,b)=>a.number-b.number||a.id-b.id);
 return arr;
}
function renderCards(){
 if(!$("cardList"))return;
 fillCardTypes();
 const d=load(),arr=filteredCards(),size=Number($("cardPageSize")?.value||100);
 const pages=Math.max(1,Math.ceil(arr.length/size));cardPage=Math.min(Math.max(1,cardPage),pages);
 const start=(cardPage-1)*size,items=arr.slice(start,start+size),done=TRIPLE_TRIAD_DATA.filter(c=>cardState(d,c.id).done).length;
 $("cardTotal").textContent=TRIPLE_TRIAD_DATA.length.toLocaleString("ja-JP");
 $("cardDone").textContent=done.toLocaleString("ja-JP");
 $("cardTodo").textContent=(TRIPLE_TRIAD_DATA.length-done).toLocaleString("ja-JP");
 $("cardShown").textContent=arr.length.toLocaleString("ja-JP");
 $("cardPageInfo").textContent=`${cardPage} / ${pages}ページ`;
 $("cardPrev").disabled=cardPage<=1;$("cardNext").disabled=cardPage>=pages;

 $("cardList").innerHTML=items.length?items.map(c=>{
  const st=cardState(d,c.id);
  const stars="★".repeat(Math.max(0,Math.min(5,Number(c.rarity)||0)));
  return `<div class="card ${st.done?"archived":""}">
   <div class="row">
    <div><label style="margin:0;color:var(--text)"><input type="checkbox" class="cardCheck" data-id="${c.id}" style="width:auto" ${st.done?"checked":""}> <b>No.${c.number} ${esc(c.name)}</b></label>
    <div class="time">${stars||"—"}${c.type?` ／ ${esc(c.type)}`:""}</div></div>
    <div class="wrap"><span class="badge">↑${c.top}</span><span class="badge">←${c.left}</span><span class="badge">→${c.right}</span><span class="badge">↓${c.bottom}</span></div>
   </div>
   <div class="inline2" style="margin-top:8px">
    <input class="cardNote" data-id="${c.id}" value="${esc(st.note||"")}" placeholder="自分用メモ">
    <button type="button" class="secondary cardOfficial" data-name="${esc(c.name)}">公式DBで検索</button>
   </div>
  </div>`;
 }).join(""):'<div class="empty">該当するカードはありません。</div>';

 document.querySelectorAll(".cardCheck").forEach(ch=>ch.onchange=()=>{
  const d=load(),id=ch.dataset.id;d.cardProgress=d.cardProgress||{};
  const st=d.cardProgress[id]||{done:false,note:""};st.done=ch.checked;d.cardProgress[id]=st;save(d);renderCards();
 });
 document.querySelectorAll(".cardNote").forEach(i=>i.onchange=()=>{
  const d=load(),id=i.dataset.id;d.cardProgress=d.cardProgress||{};
  const st=d.cardProgress[id]||{done:false,note:""};st.note=i.value;d.cardProgress[id]=st;save(d);
 });
 document.querySelectorAll(".cardOfficial").forEach(b=>b.onclick=()=>openTemplate("https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/?q={query}",b.dataset.name));
}

const TRIAD_NPC_CACHE_KEY="life_archive_triad_npcs_v1";
let triadMode="cards",triadNpcData=[],triadNpcPage=1,triadNpcLoading=false;

function triadNpcState(d,id){return d.triadNpcProgress?.[id]||{done:false,note:""};}
function setTriadMode(mode){
 triadMode=mode;
 if($("triadCardsPanel"))$("triadCardsPanel").style.display=mode==="cards"?"block":"none";
 if($("triadNpcPanel"))$("triadNpcPanel").style.display=mode==="npcs"?"block":"none";
 document.querySelectorAll(".triadModeTab").forEach(b=>{
  b.classList.toggle("primary",b.dataset.mode===mode);
  b.classList.toggle("secondary",b.dataset.mode!==mode);
 });
 if(mode==="npcs"){if(!triadNpcData.length)loadTriadNpcs();else renderTriadNpcs();}
 else renderCards();
}
function readTriadNpcCache(){
 try{
  const raw=localStorage.getItem(TRIAD_NPC_CACHE_KEY);
  if(!raw)return [];
  const parsed=JSON.parse(raw);
  return Array.isArray(parsed?.results)?parsed.results:[];
 }catch(e){return []}
}
async function loadTriadNpcs(force=false){
 if(triadNpcLoading)return;
 triadNpcLoading=true;
 const status=$("triadNpcLoadStatus");
 if(status)status.textContent="NPCデータ読込中…";
 try{
  if(!force){
   const cache=readTriadNpcCache();
   if(cache.length){triadNpcData=cache;if(status)status.textContent=`キャッシュ ${cache.length}件`;triadNpcLoading=false;fillTriadNpcPatches();renderTriadNpcs();return;}
  }
  const res=await fetch("https://ffxivcollect.com/api/triad/npcs?language=ja&limit=500",{headers:{Accept:"application/json"}});
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  const data=await res.json();
  triadNpcData=Array.isArray(data?.results)?data.results:[];
  try{localStorage.setItem(TRIAD_NPC_CACHE_KEY,JSON.stringify({savedAt:Date.now(),results:triadNpcData}))}catch(e){}
  if(status)status.textContent=`取得済み ${triadNpcData.length}件`;
  fillTriadNpcPatches();renderTriadNpcs();
 }catch(err){
  console.error("triad npc load failed",err);
  const cache=readTriadNpcCache();
  if(cache.length){triadNpcData=cache;if(status)status.textContent=`通信失敗・キャッシュ ${cache.length}件を使用`;fillTriadNpcPatches();renderTriadNpcs();}
  else if(status)status.textContent="NPCデータ取得に失敗しました";
 }finally{triadNpcLoading=false;}
}
function fillTriadNpcPatches(){
 const s=$("triadNpcPatch");if(!s)return;
 const old=s.value;
 const patches=[...new Set(triadNpcData.map(n=>String(n.patch||"")).filter(Boolean))].sort((a,b)=>Number(b)-Number(a));
 s.innerHTML='<option value="">すべて</option>'+patches.map(p=>`<option>${esc(p)}</option>`).join("");
 if(patches.includes(old))s.value=old;
}
function filteredTriadNpcs(){
 const d=load(),q=($("triadNpcSearch")?.value||"").trim().toLowerCase(),status=$("triadNpcStatus")?.value||"",patch=$("triadNpcPatch")?.value||"";
 return triadNpcData.filter(n=>{
  const st=triadNpcState(d,n.id),rewards=Array.isArray(n.rewards)?n.rewards:[];
  const hay=[n.name,n.location?.name,n.location?.region,n.quest?.name,...(n.rules||[]),...rewards.map(r=>r.name)].join(" ").toLowerCase();
  return (!q||hay.includes(q))&&(!status||(status==="done"?st.done:!st.done))&&(!patch||String(n.patch||"")===patch);
 });
}
function renderTriadNpcs(){
 if(!$("triadNpcList"))return;
 const d=load(),arr=filteredTriadNpcs(),size=Number($("triadNpcPageSize")?.value||50);
 const pages=Math.max(1,Math.ceil(arr.length/size));triadNpcPage=Math.min(Math.max(1,triadNpcPage),pages);
 const start=(triadNpcPage-1)*size,items=arr.slice(start,start+size),done=triadNpcData.filter(n=>triadNpcState(d,n.id).done).length;
 $("triadNpcTotal").textContent=triadNpcData.length.toLocaleString("ja-JP");
 $("triadNpcDone").textContent=done.toLocaleString("ja-JP");
 $("triadNpcTodo").textContent=(triadNpcData.length-done).toLocaleString("ja-JP");
 $("triadNpcShown").textContent=arr.length.toLocaleString("ja-JP");
 $("triadNpcPageInfo").textContent=`${triadNpcPage} / ${pages}ページ`;
 $("triadNpcPrev").disabled=triadNpcPage<=1;$("triadNpcNext").disabled=triadNpcPage>=pages;

 $("triadNpcList").innerHTML=items.length?items.map(n=>{
  const st=triadNpcState(d,n.id),loc=n.location||{},rewards=Array.isArray(n.rewards)?n.rewards:[],rules=Array.isArray(n.rules)?n.rules:[];
  const xy=(loc.x!=null&&loc.y!=null)?` X:${Number(loc.x).toFixed(1)} Y:${Number(loc.y).toFixed(1)}`:"";
  return `<div class="card ${st.done?"archived":""}">
   <div class="row"><div><label style="margin:0;color:var(--text)"><input type="checkbox" class="triadNpcCheck" data-id="${n.id}" style="width:auto" ${st.done?"checked":""}> <b>${esc(n.name||"NPC")}</b></label>
   <div class="time">${esc(loc.name||"場所不明")}${xy}${n.patch?` ／ Patch ${esc(n.patch)}`:""}</div></div>
   <div class="wrap">${rules.map(r=>`<span class="badge">${esc(r)}</span>`).join("")}</div></div>
   ${n.quest?.name?`<div class="small" style="margin-top:6px">🔓 解放：${esc(n.quest.name)}</div>`:""}
   ${rewards.length?`<div style="margin-top:8px"><b>報酬カード</b><div class="wrap">${rewards.map(r=>`<span class="badge gold">${esc(r.name||"カード")}</span>`).join("")}</div></div>`:'<div class="small muted" style="margin-top:8px">報酬カード情報なし</div>'}
   <div class="inline2" style="margin-top:8px"><input class="triadNpcNote" data-id="${n.id}" value="${esc(st.note||"")}" placeholder="自分用メモ"><button type="button" class="secondary triadNpcSource" data-name="${esc(n.name||"")}">FFXIV Collectで確認</button></div>
  </div>`;
 }).join(""):'<div class="empty">該当するNPCはありません。</div>';

 document.querySelectorAll(".triadNpcCheck").forEach(c=>c.onchange=()=>{
  const d=load(),id=c.dataset.id;d.triadNpcProgress=d.triadNpcProgress||{};
  const st=d.triadNpcProgress[id]||{done:false,note:""};st.done=c.checked;d.triadNpcProgress[id]=st;save(d);renderTriadNpcs();
 });
 document.querySelectorAll(".triadNpcNote").forEach(i=>i.onchange=()=>{
  const d=load(),id=i.dataset.id;d.triadNpcProgress=d.triadNpcProgress||{};
  const st=d.triadNpcProgress[id]||{done:false,note:""};st.note=i.value;d.triadNpcProgress[id]=st;save(d);
 });
 document.querySelectorAll(".triadNpcSource").forEach(b=>b.onclick=()=>window.open("https://ffxivcollect.com/triad/npcs","_blank","noopener"));
}

/* RELIC_SERIES moved to assets/js/data/relic_series.js */

function relicState(d,sid){
 d.relicProgress=d.relicProgress||{};
 if(!d.relicProgress[sid])d.relicProgress[sid]={steps:{},note:""};
 if(!d.relicProgress[sid].steps||typeof d.relicProgress[sid].steps!=="object")d.relicProgress[sid].steps={};
 return d.relicProgress[sid];
}
function relicSeriesStatus(d,s){
 const st=relicState(d,s.id),done=s.steps.filter((_,i)=>st.steps[i]).length;
 return done>=s.steps.length?"done":done>0?"active":"notstarted";
}
function initializeWarRelicDefaults(){
 const d=load();let changed=false;
 const completed=["zodiac","anima","manderville","phantom"];
 completed.forEach(id=>{const s=RELIC_SERIES.find(x=>x.id===id);if(!s)return;const st=relicState(d,id);if(!Object.keys(st.steps).length){s.steps.forEach((_,i)=>st.steps[i]=true);changed=true;}});
 // Eureka / Resistance intentionally remain untouched: exact current stage is not assumed.
 if(changed)save(d);
}
function renderRelicRoadmap(){
 const box=$("relicRoadmap");if(!box)return;
 const d=load(),sf=$("relicSeriesFilter")?.value||"",status=$("relicStatusFilter")?.value||"";
 let totalSteps=0,doneSteps=0,doneSeries=0,activeSeries=0;
 RELIC_SERIES.forEach(s=>{const st=relicState(d,s.id),n=s.steps.filter((_,i)=>st.steps[i]).length;totalSteps+=s.steps.length;doneSteps+=n;const z=n>=s.steps.length?"done":n>0?"active":"notstarted";if(z==="done")doneSeries++;if(z==="active")activeSeries++;});
 $("relicSeriesDone").textContent=doneSeries;$("relicSeriesActive").textContent=activeSeries;$("relicStepProgress").textContent=`${doneSteps} / ${totalSteps}`;
 const visible=RELIC_SERIES.filter(s=>(!sf||s.id===sf)&&(!status||relicSeriesStatus(d,s)===status));
 box.innerHTML=visible.map(s=>{
  const st=relicState(d,s.id),done=s.steps.filter((_,i)=>st.steps[i]).length,pct=Math.round(done/s.steps.length*100),z=relicSeriesStatus(d,s);
  return `<div class="card ${z==="done"?"archived":""}">
   <div class="row"><div><b>${esc(s.name)}</b> <span class="badge">${esc(s.era)}</span> <span class="badge gold">戦士</span><div class="time">${z==="done"?"完成":z==="active"?"制作中":"未着手"} ／ ${done} / ${s.steps.length}工程</div></div><b>${pct}%</b></div>
   <div style="height:8px;background:var(--line);border-radius:999px;overflow:hidden;margin:10px 0"><div style="height:100%;width:${pct}%;background:var(--gold)"></div></div>
   <div>${s.steps.map((step,i)=>`<label class="listitem" style="display:block"><input type="checkbox" class="relicStepCheck" data-series="${s.id}" data-step="${i}" style="width:auto" ${st.steps[i]?"checked":""}> ${esc(step)}</label>`).join("")}</div>
   <div class="inline2" style="margin-top:8px"><input class="relicNote" data-series="${s.id}" value="${esc(st.note||"")}" placeholder="現在の周回・残数などのメモ"><div class="wrap"><button type="button" class="secondary relicAll" data-series="${s.id}">全工程完了</button><button type="button" class="secondary relicReset" data-series="${s.id}">工程をリセット</button></div></div>
  </div>`;
 }).join("")||'<div class="empty">該当するシリーズはありません。</div>';
 document.querySelectorAll(".relicStepCheck").forEach(c=>c.onchange=()=>{const d=load(),st=relicState(d,c.dataset.series);if(c.checked)st.steps[c.dataset.step]=true;else delete st.steps[c.dataset.step];save(d);renderRelicRoadmap();});
 document.querySelectorAll(".relicNote").forEach(i=>i.onchange=()=>{const d=load(),st=relicState(d,i.dataset.series);st.note=i.value;save(d);});
 document.querySelectorAll(".relicAll").forEach(b=>b.onclick=()=>{const d=load(),s=RELIC_SERIES.find(x=>x.id===b.dataset.series),st=relicState(d,b.dataset.series);s.steps.forEach((_,i)=>st.steps[i]=true);save(d);renderRelicRoadmap();});
 document.querySelectorAll(".relicReset").forEach(b=>b.onclick=()=>{if(!confirm("このシリーズの工程チェックをリセットしますか？"))return;const d=load(),st=relicState(d,b.dataset.series);st.steps={};save(d);renderRelicRoadmap();});
}
function fillRelicFilters(){
 const s=$("relicSeriesFilter");if(!s)return;
 s.innerHTML='<option value="">6シリーズすべて</option>'+RELIC_SERIES.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("");
}
function weaponProgressPercent(w){
 const total=Math.max(1,Number(w.totalStage)||1),stage=Math.max(0,Number(w.stage)||0);
 return Math.max(0,Math.min(100,stage/total*100));
}
function renderWeapons(){
 renderRelicRoadmap();
 const box=$("weaponList");if(!box)return;
 const d=load(),items=(Array.isArray(d.weapons)?d.weapons:[]).slice().sort((a,b)=>(Number(b.updatedAt||b.createdAt||b.time)||0)-(Number(a.updatedAt||a.createdAt||a.time)||0));
 const complete=items.filter(w=>w.complete).length;
 $("weaponTotal").textContent=items.length.toLocaleString("ja-JP");
 $("weaponComplete").textContent=complete.toLocaleString("ja-JP");
 $("weaponActive").textContent=(items.length-complete).toLocaleString("ja-JP");

 box.innerHTML=items.length?items.map(w=>{
  const total=Math.max(1,Number(w.totalStage)||1),stage=Math.max(0,Number(w.stage)||0),pct=weaponProgressPercent(w);
  const history=Array.isArray(w.history)?w.history:[];
  return `<div class="card ${w.complete?"archived":""}">
   <div class="row">
    <div><b>${esc(w.name||w.title||"武器制作")}</b>${w.job?` <span class="badge gold">${esc(w.job)}</span>`:""}<div class="time">${w.complete?"完成":"進行中"} ／ ${stage} / ${total} 段階</div></div>
    <div class="wrap"><span class="badge">${pct.toFixed(0)}%</span>${w.complete?'<span class="badge green">完成</span>':""}</div>
   </div>
   <div style="height:8px;background:var(--line);border-radius:999px;overflow:hidden;margin:10px 0"><div style="height:100%;width:${pct}%;background:var(--gold)"></div></div>
   ${w.text?`<p>${nl(w.text)}</p>`:""}
   ${(w.tags||[]).length?`<div class="wrap">${w.tags.map(t=>`<span class="badge">#${esc(t)}</span>`).join("")}</div>`:""}
   <div class="wrap" style="margin-top:10px">
    <button type="button" class="secondary weaponStageDown" data-id="${w.id}">− 1段階</button>
    <button type="button" class="primary weaponStageUp" data-id="${w.id}">＋ 1段階</button>
    <button type="button" class="secondary weaponToggleComplete" data-id="${w.id}">${w.complete?"未完成に戻す":"完成にする"}</button>
    <button type="button" class="secondary weaponEdit" data-id="${w.id}">編集</button>
    <button type="button" class="danger weaponDelete" data-id="${w.id}">削除</button>
   </div>
   ${history.length?`<details style="margin-top:10px"><summary>履歴 ${history.length}件</summary>${history.slice().reverse().map(h=>`<div class="listitem"><b>${esc(h.title||h.name||"記録")}</b><div class="time">${h.time?fmt(h.time):""}</div>${h.text?`<div class="small">${nl(h.text)}</div>`:""}</div>`).join("")}</details>`:""}
  </div>`;
 }).join(""):'<div class="empty">武器制作記録はまだありません。</div>';

 document.querySelectorAll(".weaponStageUp").forEach(b=>b.onclick=()=>{
  const d=load(),w=d.weapons.find(x=>x.id===b.dataset.id);if(!w)return;
  const total=Math.max(1,Number(w.totalStage)||1);w.stage=Math.min(total,(Number(w.stage)||0)+1);w.complete=w.stage>=total;w.updatedAt=Date.now();save(d);renderWeapons();
 });
 document.querySelectorAll(".weaponStageDown").forEach(b=>b.onclick=()=>{
  const d=load(),w=d.weapons.find(x=>x.id===b.dataset.id);if(!w)return;
  w.stage=Math.max(0,(Number(w.stage)||0)-1);w.complete=false;w.updatedAt=Date.now();save(d);renderWeapons();
 });
 document.querySelectorAll(".weaponToggleComplete").forEach(b=>b.onclick=()=>{
  const d=load(),w=d.weapons.find(x=>x.id===b.dataset.id);if(!w)return;
  w.complete=!w.complete;if(w.complete)w.stage=Math.max(Number(w.stage)||0,Number(w.totalStage)||1);w.updatedAt=Date.now();save(d);renderWeapons();
 });
 document.querySelectorAll(".weaponEdit").forEach(b=>b.onclick=()=>{
  const d=load(),w=d.weapons.find(x=>x.id===b.dataset.id);if(!w)return;
  const name=prompt("シリーズ名",w.name||w.title||"");if(name===null)return;
  const job=prompt("ジョブ",w.job||"");if(job===null)return;
  const stage=prompt("現在段階",String(Number(w.stage)||0));if(stage===null)return;
  const total=prompt("全段階",String(Math.max(1,Number(w.totalStage)||1)));if(total===null)return;
  const memo=prompt("メモ",w.text||"");if(memo===null)return;
  w.name=name.trim()||w.name||w.title||"武器制作";w.job=job.trim();w.stage=Math.max(0,Number(stage)||0);w.totalStage=Math.max(1,Number(total)||1);w.text=memo;w.complete=w.stage>=w.totalStage;w.updatedAt=Date.now();save(d);renderWeapons();
 });
 document.querySelectorAll(".weaponDelete").forEach(b=>b.onclick=()=>{
  if(!confirm("この武器制作記録を削除しますか？"))return;
  const d=load();d.weapons=d.weapons.filter(x=>x.id!==b.dataset.id);save(d);renderWeapons();
 });
}

const GUILDLEVE_CACHE_KEY="life_archive_guildleves_v8";
let guildleveData=[],levePage=1,leveLoading=false;
function leveState(d,id){return d.guildleveProgress?.[id]||{done:false,note:""};}
function readLeveCache(){try{const x=JSON.parse(localStorage.getItem(GUILDLEVE_CACHE_KEY)||"null");return Array.isArray(x?.results)?x.results:[]}catch(e){return []}}
function pickField(f,names){for(const n of names){if(f&&f[n]!=null)return f[n]}return null}
function fieldText(v){return String(v?.fields?.Name??v?.fields?.Singular??v?.value??v?.name??v??"").trim()}
function leveTitleText(v){
 if(v==null)return "";
 if(typeof v==="string")return v.trim();
 if(typeof v==="object"){
  const candidates=[v?.fields?.Name,v?.fields?.Title,v?.fields?.Text,v?.name,v?.title,v?.text];
  for(const x of candidates)if(typeof x==="string"&&x.trim())return x.trim();
 }
 return "";
}
function isPlaceholderLeveTitle(v){
 const s=String(v||"").trim();
 return !s||/^リーヴ\s*#?\s*(?:[1-9]|1\d|20)$/u.test(s)||/^Leve\s*#?\s*\d+$/i.test(s)||/^\d+$/.test(s);
}
const LEVE_JOB_MAP={
 "Carpenter":"木工師","Blacksmith":"鍛冶師","Armorer":"甲冑師","Goldsmith":"彫金師",
 "Leatherworker":"革細工師","Weaver":"裁縫師","Alchemist":"錬金術師","Culinarian":"調理師",
 "Miner":"採掘師","Botanist":"園芸師","Fisher":"漁師",
 "木工師":"木工師","鍛冶師":"鍛冶師","甲冑師":"甲冑師","彫金師":"彫金師",
 "革細工師":"革細工師","裁縫師":"裁縫師","錬金術師":"錬金術師","調理師":"調理師",
 "採掘師":"採掘師","園芸師":"園芸師","漁師":"漁師"
};
const LEVE_ASSIGNMENT_TYPE_JA={
 1:"傭兵稼業",
 2:"採掘師",3:"園芸師",4:"漁師",
 5:"木工師",6:"鍛冶師",7:"甲冑師",8:"彫金師",
 9:"革細工師",10:"裁縫師",11:"錬金術師",12:"調理師",
 13:"黒渦団",14:"双蛇党",15:"不滅隊"
};
function leveAssignmentTypeId(v){
 if(v==null)return 0;
 if(typeof v==="number")return Number(v)||0;
 if(typeof v==="string"&&/^\d+$/.test(v.trim()))return Number(v)||0;
 if(typeof v==="object"){
  const raw=v.value??v.row_id??v.id??v["#"];
  if(Number.isFinite(Number(raw)))return Number(raw)||0;
 }
 return 0;
}
function leveAssignmentCategory(f){
 const v=f?.LeveAssignmentType;
 const id=leveAssignmentTypeId(v);
 if(LEVE_ASSIGNMENT_TYPE_JA[id])return LEVE_ASSIGNMENT_TYPE_JA[id];
 const text=fieldText(v);
 if(text&&text!=="0"&&!/^\d+$/.test(text))return text;
 return "";
}
function leveJobFromText(v){
 const s=String(v||"").trim();if(!s)return "";
 for(const [en,ja] of Object.entries(LEVE_JOB_MAP)){
  if(s===en||s===ja||s.includes(en)||s.includes(ja))return ja;
 }
 return "";
}
function leveJobFromFields(f){
 const candidates=[
  fieldText(f?.ClassJobCategory),fieldText(f?.ClassJob),fieldText(f?.CraftLeve),fieldText(f?.GatheringLeve),
  leveTitleText(f?.ClassJobCategory),leveTitleText(f?.ClassJob),leveTitleText(f?.CraftLeve),leveTitleText(f?.GatheringLeve)
 ].filter(Boolean);
 for(const c of candidates){const j=leveJobFromText(c);if(j)return j}
 const flat=JSON.stringify({
  ClassJobCategory:f?.ClassJobCategory,ClassJob:f?.ClassJob,CraftLeve:f?.CraftLeve,GatheringLeve:f?.GatheringLeve
 });
 return leveJobFromText(flat);
}
function leveClientNameFromFields(f){
 const v=f?.LeveClient;
 if(!v)return "";
 return leveTitleText(v?.fields?.Name)||leveTitleText(v?.fields?.Singular)||leveTitleText(v?.Name)||leveTitleText(v?.Singular)||leveTitleText(v);
}
function leveDeliveryPlaceFromFields(f){
 const v=f?.LeveClient;
 const candidates=[
  v?.fields?.PlaceName?.fields?.Name,
  v?.fields?.PlaceName?.Name,
  v?.fields?.TerritoryType?.fields?.PlaceName?.fields?.Name,
  v?.fields?.TerritoryType?.fields?.Name,
  v?.fields?.Location?.fields?.PlaceName?.fields?.Name,
  v?.fields?.Location?.fields?.Name
 ];
 for(const c of candidates){const s=leveTitleText(c)||fieldText(c);if(s&&s!=="[object Object]")return s}
 return "";
}
function leveDeliveryCoordsFromFields(f){
 const v=f?.LeveClient;
 const candidates=[v?.fields?.Level,v?.fields?.Location,v?.fields?.LevelLevemete];
 for(const c of candidates){
  const x=Number(c?.fields?.X??c?.X??NaN),y=Number(c?.fields?.Y??c?.Y??NaN);
  if(Number.isFinite(x)&&Number.isFinite(y))return [x,y];
 }
 return [];
}

function rawRelId(v){
 if(v==null)return 0;
 if(typeof v==="number")return Number(v)||0;
 if(typeof v==="string"&&/^\d+$/.test(v.trim()))return Number(v)||0;
 if(typeof v==="object")return Number(v.row_id??v.id??v.value??v["#"]??0)||0;
 return 0;
}
function relName(v){
 if(!v)return "";
 const vals=[
  v?.fields?.Name,v?.fields?.Singular,v?.fields?.Title,v?.fields?.PlaceName?.fields?.Name,
  v?.Name,v?.Singular,v?.Title,v?.name
 ];
 for(const x of vals)if(typeof x==="string"&&x.trim())return x.trim();
 return "";
}
async function loadGuildleves(force=false){
 if(leveLoading)return;leveLoading=true;
 const status=$("leveLoadStatus");if(status)status.textContent="読込中…";
 try{
  if(!force){
   const c=readLeveCache();
   if(c.length){
    guildleveData=c.filter(x=>!isPlaceholderLeveTitle(x.name));
    if(status)status.textContent=`キャッシュ ${guildleveData.length}件`;
    fillLeveFilters();renderGuildleves();leveLoading=false;return;
   }
  }

  async function fetchPaged(makeUrl,onRows){
   let after=-1,page=0,total=0;
   const limit=500;
   while(true){
    const url=makeUrl(after,limit);
    const r=await fetch(url,{headers:{Accept:"application/json"},cache:"no-store"});
    if(!r.ok)throw new Error(`XIVAPI HTTP ${r.status}`);
    const payload=await r.json();
    const rows=payload?.rows||payload?.results||[];
    if(!rows.length)break;
    onRows(rows);total+=rows.length;
    if(status)status.textContent=`読込中… ${total.toLocaleString("ja-JP")}件`;
    const lastId=Number(rows.at(-1)?.row_id??rows.at(-1)?.id??-1);
    if(!Number.isFinite(lastId)||lastId<=after||rows.length<limit)break;
    after=lastId;
    if(++page>100)throw new Error("Leve pagination exceeded safety limit");
   }
  }

  const allRows=[];
  await fetchPaged((after,limit)=>{
   const qs=new URLSearchParams({language:"ja",limit:String(limit)});
   if(after>=0)qs.set("after",String(after));
   return `https://v2.xivapi.com/api/sheet/Leve?${qs.toString()}`;
  },rows=>allRows.push(...rows));

  // Relationship展開形式に依存しないよう、LeveAssignmentTypeの元IDを別取得する。
  const assignmentByLeveId=new Map();
  await fetchPaged((after,limit)=>{
   const qs=new URLSearchParams({
    language:"ja",
    fields:"LeveAssignmentType@as(raw)",
    limit:String(limit)
   });
   if(after>=0)qs.set("after",String(after));
   return `https://v2.xivapi.com/api/sheet/Leve?${qs.toString()}`;
  },rows=>{
   for(const row of rows){
    const id=Number(row.row_id??row.id??0);
    const raw=row?.fields?.["LeveAssignmentType@as(raw)"];
    const typeId=Number(raw??0)||0;
    if(id)assignmentByLeveId.set(id,typeId);
   }
  });


  // 場所/NPC系はRelationship展開に依存せず raw ID も取得する。
  const leveRawMeta=new Map();
  await fetchPaged((after,limit)=>{
   const qs=new URLSearchParams({
    language:"ja",
    fields:"PlaceName@as(raw),LeveClient@as(raw),LevelLevemete@as(raw),Levemete@as(raw)",
    limit:String(limit)
   });
   if(after>=0)qs.set("after",String(after));
   return `https://v2.xivapi.com/api/sheet/Leve?${qs.toString()}`;
  },rows=>{
   for(const row of rows){
    const id=Number(row.row_id??row.id??0);if(!id)continue;
    const f=row.fields||{};
    leveRawMeta.set(id,{
     placeId:Number(f["PlaceName@as(raw)"]??0)||0,
     clientId:Number(f["LeveClient@as(raw)"]??0)||0,
     levelLevemeteId:Number(f["LevelLevemete@as(raw)"]??0)||0,
     levemeteId:Number(f["Levemete@as(raw)"]??0)||0
    });
   }
  });


  // LevelLevemete をLeve側からもネスト指定で取得。スキーマ差による取りこぼしの補助。
  const nestedAcceptByLeveId=new Map();
  try{
   await fetchPaged((after,limit)=>{
    const qs=new URLSearchParams({
     language:"ja",
     fields:"LevelLevemete.X,LevelLevemete.Y,LevelLevemete.Territory.PlaceName.Name,LevelLevemete.Map.PlaceName.Name,LevelLevemete.Object.ENpcResident.Singular",
     limit:String(limit)
    });
    if(after>=0)qs.set("after",String(after));
    return `https://v2.xivapi.com/api/sheet/Leve?${qs.toString()}`;
   },rows=>{
    for(const row of rows){
     const id=Number(row.row_id??row.id??0);if(!id)continue;
     const lv=row?.fields?.LevelLevemete;
     if(lv)nestedAcceptByLeveId.set(id,lv?.fields||lv);
    }
   });
  }catch(e){console.warn("nested LevelLevemete fetch skipped",e)}

  // Relationshipの実体名をまとめて引く。存在しないシート/行は静かに無視する。
  async function fetchRowsByIds(sheet,ids,fields="Name"){
   const out=new Map(),unique=[...new Set(ids.filter(x=>Number(x)>0))];
   for(let i=0;i<unique.length;i+=80){
    const batch=unique.slice(i,i+80);
    await Promise.all(batch.map(async id=>{
     try{
      const qs=new URLSearchParams({language:"ja",fields});
      const r=await fetch(`https://v2.xivapi.com/api/sheet/${sheet}/${id}?${qs.toString()}`,{headers:{Accept:"application/json"},cache:"no-store"});
      if(!r.ok)return;
      const j=await r.json();out.set(id,j?.fields||j);
     }catch(e){}
    }));
   }
   return out;
  }
  const metas=[...leveRawMeta.values()];
  const placeRows=await fetchRowsByIds("PlaceName",metas.map(x=>x.placeId),"Name");
  const clientRows=await fetchRowsByIds("LeveClient",metas.map(x=>x.clientId),"Name,PlaceName,TerritoryType,Level");
  const levelRows=await fetchRowsByIds(
   "Level",
   metas.map(x=>x.levelLevemeteId),
   "X,Y,Territory,Territory.PlaceName.Name,Territory.PlaceName,Map,Map.PlaceName.Name,Object,Object.ENpcResident.Singular"
  );
  const levemeteRows=await fetchRowsByIds("ENpcResident",metas.map(x=>x.levemeteId),"Singular");


  function levelAcceptPlace(levelRow){
   if(!levelRow)return "";
   const candidates=[
    levelRow?.Territory?.fields?.PlaceName?.fields?.Name,
    levelRow?.Territory?.fields?.PlaceName?.Name,
    levelRow?.Territory?.PlaceName?.fields?.Name,
    levelRow?.Territory?.PlaceName?.Name,
    levelRow?.Map?.fields?.PlaceName?.fields?.Name,
    levelRow?.Map?.fields?.PlaceName?.Name,
    levelRow?.Territory?.fields?.Name,
    levelRow?.Territory?.Name
   ];
   for(const c of candidates){
    const s=leveTitleText(c)||fieldText(c);
    if(s&&s!=="[object Object]"&&!/^\d+$/.test(s))return s;
   }
   return "";
  }
  function levelAcceptNpc(levelRow){
   const candidates=[
    levelRow?.Object?.fields?.ENpcResident?.fields?.Singular,
    levelRow?.Object?.fields?.ENpcResident?.Singular,
    levelRow?.Object?.ENpcResident?.fields?.Singular,
    levelRow?.Object?.ENpcResident?.Singular
   ];
   for(const c of candidates){
    const s=leveTitleText(c)||fieldText(c);
    if(s&&s!=="[object Object]")return s;
   }
   return "";
  }

  guildleveData=allRows.map(row=>{
   const f=row.fields||row;
   const id=Number(row.row_id??row.id??f["#"]??0);
   const name=
     leveTitleText(f.Name)||
     leveTitleText(f.Title)||
     leveTitleText(f.LeveString)||
     leveTitleText(f.LeveString?.fields)||
     "";

   const rawTypeId=assignmentByLeveId.get(id)||0;
   const assignmentCategory=LEVE_ASSIGNMENT_TYPE_JA[rawTypeId]||leveAssignmentCategory(f);
   const inferredJob=leveJobFromFields(f);
   const resolvedJob=leveJobFromText(assignmentCategory)||inferredJob||leveJobFromText(fieldText(pickField(f,["ClassJobCategory","ClassJob","CraftLeve","GatheringLeve"])));
   const classJob=resolvedJob||assignmentCategory||"";
   const leveType=assignmentCategory||fieldText(pickField(f,["LeveType","Category"]));
   const level=Number(pickField(f,["ClassJobLevel","Level","LevelLevemete"])?.value??pickField(f,["ClassJobLevel","Level","LevelLevemete"])??0)||0;
   const rawMeta=leveRawMeta.get(id)||{};
   const placeRow=placeRows.get(rawMeta.placeId)||{};
   const clientRow=clientRows.get(rawMeta.clientId)||{};
   const levelRow=nestedAcceptByLeveId.get(id)||levelRows.get(rawMeta.levelLevemeteId)||{};
   const levemeteRow=levemeteRows.get(rawMeta.levemeteId)||{};
   const place=
    levelAcceptPlace(levelRow)||
    relName(placeRow)||
    fieldText(pickField(f,["PlaceName","TerritoryType"]))||
    "";
   const acceptNpc=
    levelAcceptNpc(levelRow)||
    relName(levemeteRow)||
    relName(f?.Levemete)||
    "";
   const clientName=relName(clientRow)||leveClientNameFromFields(f);
   const deliveryPlace=relName(clientRow?.PlaceName)||relName(clientRow?.TerritoryType?.fields?.PlaceName)||leveDeliveryPlaceFromFields(f);
   let deliveryCoords=leveDeliveryCoordsFromFields(f);
   const acceptX=Number(levelRow?.X??levelRow?.fields?.X??NaN);
   const acceptY=Number(levelRow?.Y??levelRow?.fields?.Y??NaN);
   const acceptCoords=Number.isFinite(acceptX)&&Number.isFinite(acceptY)?[acceptX,acceptY]:[];
   const desc=leveTitleText(pickField(f,["Description","Objective","DataId"]));
   const category=leveType||resolvedJob||"その他";
   return {id,name,classJob:resolvedJob||classJob,category,level,place,acceptPlace:place,acceptNpc,acceptCoords,clientName,deliveryPlace,deliveryCoords,description:desc,assignmentTypeId:rawTypeId};
  }).filter(x=>x.id>0&&!isPlaceholderLeveTitle(x.name));

  try{localStorage.setItem(GUILDLEVE_CACHE_KEY,JSON.stringify({savedAt:Date.now(),results:guildleveData}))}catch(e){}
  const classified=guildleveData.filter(x=>x.category&&x.category!=="その他").length;
  const withAcceptPlace=guildleveData.filter(x=>x.acceptPlace).length;
  const withAcceptNpc=guildleveData.filter(x=>x.acceptNpc).length;
  const withClient=guildleveData.filter(x=>x.clientName||x.deliveryPlace).length;
  if(status)status.textContent=`取得済み ${guildleveData.length}件 ／ 分類済み ${classified}件 ／ 受注場所 ${withAcceptPlace}件 ／ 受注NPC ${withAcceptNpc}件 ／ 納品 ${withClient}件`;
  fillLeveFilters();renderGuildleves();
 }catch(e){
  console.error("guildleve load failed",e);
  const c=readLeveCache().filter(x=>!isPlaceholderLeveTitle(x.name));
  if(c.length){
   guildleveData=c;
   if(status)status.textContent=`通信失敗・キャッシュ ${c.length}件`;
   fillLeveFilters();renderGuildleves();
  }else if(status)status.textContent=`データ取得に失敗しました：${String(e?.message||e)}`;
 }finally{leveLoading=false}
}
function fillLeveFilters(){
 const c=$("leveCategory"),l=$("leveLevel");if(!c||!l)return;
 const cv=c.value,lv=l.value;
 const order=["木工師","鍛冶師","甲冑師","彫金師","革細工師","裁縫師","錬金術師","調理師","採掘師","園芸師","漁師","傭兵稼業","黒渦団","双蛇党","不滅隊","その他"];
 const cats=[...new Set(guildleveData.map(x=>x.category).filter(Boolean))].sort((a,b)=>{const ai=order.indexOf(a),bi=order.indexOf(b);return (ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b,"ja")});
 const levels=[...new Set(guildleveData.map(x=>x.level).filter(x=>x>0))].sort((a,b)=>a-b);
 c.innerHTML='<option value="">すべて</option>'+cats.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
 l.innerHTML='<option value="">すべて</option>'+levels.map(x=>`<option value="${x}">Lv.${x}</option>`).join("");
 if(cats.includes(cv))c.value=cv;if(levels.map(String).includes(lv))l.value=lv;
}
function filteredLeves(){
 const d=load(),q=($("leveSearch")?.value||"").trim().toLowerCase(),status=$("leveStatus")?.value||"",cat=$("leveCategory")?.value||"",level=$("leveLevel")?.value||"";
 return guildleveData.filter(x=>{const st=leveState(d,x.id),hay=[x.name,x.classJob,x.category,x.place,x.description].join(" ").toLowerCase();return(!q||hay.includes(q))&&(!status||(status==="done"?st.done:!st.done))&&(!cat||x.category===cat)&&(!level||String(x.level)===level)});
}
function renderGuildleves(){
 if(!$("leveList"))return;
 const d=load(),arr=filteredLeves(),size=Number($("levePageSize")?.value||100),pages=Math.max(1,Math.ceil(arr.length/size));levePage=Math.min(Math.max(1,levePage),pages);
 const items=arr.slice((levePage-1)*size,levePage*size),done=guildleveData.filter(x=>leveState(d,x.id).done).length;
 $("leveTotal").textContent=guildleveData.length.toLocaleString("ja-JP");$("leveDone").textContent=done.toLocaleString("ja-JP");$("leveTodo").textContent=(guildleveData.length-done).toLocaleString("ja-JP");$("leveShown").textContent=arr.length.toLocaleString("ja-JP");$("levePageInfo").textContent=`${levePage} / ${pages}ページ`;$("levePrev").disabled=levePage<=1;$("leveNext").disabled=levePage>=pages;
 $("leveList").innerHTML=items.length?items.map(x=>{const st=leveState(d,x.id);return `<div class="card ${st.done?"archived":""}"><div class="row"><div><label style="margin:0;color:var(--text)"><input type="checkbox" class="leveCheck" data-id="${x.id}" style="width:auto" ${st.done?"checked":""}> <b>${esc(x.name)}</b></label><div class="time">${x.level?`Lv.${x.level}`:""}${x.category?` ／ ${esc(x.category)}`:""}${x.classJob&&x.classJob!==x.category?` ／ ${esc(x.classJob)}`:""}</div></div></div>
 <div class="small" style="margin-top:6px">${x.acceptPlace||x.acceptNpc?`📥 受注：${x.acceptPlace?esc(x.acceptPlace):""}${x.acceptPlace&&x.acceptNpc?" ／ ":""}${x.acceptNpc?esc(x.acceptNpc):""}${Array.isArray(x.acceptCoords)&&x.acceptCoords.length===2?`（X:${Number(x.acceptCoords[0]).toFixed(1)} Y:${Number(x.acceptCoords[1]).toFixed(1)}）`:""}`:"📥 受注場所：未取得"}${x.clientName||x.deliveryPlace?`<br>📦 納品：${x.deliveryPlace?esc(x.deliveryPlace)+" ／ ":""}${x.clientName?esc(x.clientName):""}${Array.isArray(x.deliveryCoords)&&x.deliveryCoords.length===2?`（X:${Number(x.deliveryCoords[0]).toFixed(1)} Y:${Number(x.deliveryCoords[1]).toFixed(1)}）`:""}`:"<br>📦 納品先：未取得"}</div>
 ${x.description?`<div class="small" style="margin-top:6px">${esc(x.description)}</div>`:""}<input class="leveNote" data-id="${x.id}" value="${esc(st.note||"")}" placeholder="自分用メモ" style="margin-top:8px"></div>`}).join(""):'<div class="empty">該当するギルドリーヴはありません。</div>';
 document.querySelectorAll(".leveCheck").forEach(c=>c.onchange=()=>{const d=load();d.guildleveProgress=d.guildleveProgress||{};const st=d.guildleveProgress[c.dataset.id]||{done:false,note:""};st.done=c.checked;d.guildleveProgress[c.dataset.id]=st;save(d);renderGuildleves()});
 document.querySelectorAll(".leveNote").forEach(i=>i.onchange=()=>{const d=load();d.guildleveProgress=d.guildleveProgress||{};const st=d.guildleveProgress[i.dataset.id]||{done:false,note:""};st.note=i.value;d.guildleveProgress[i.dataset.id]=st;save(d)});
}

/* YOKAI_EVENT_DATA moved to assets/js/data/yokai_event_data.js */

function yokaiEventState(d,id){
 d.yokaiProgress=d.yokaiProgress||{};
 if(!d.yokaiProgress[id])d.yokaiProgress[id]={minion:false,weapon:false,medals:0,note:""};
 return d.yokaiProgress[id];
}
function yokaiBonusState(d){
 d.yokaiProgress=d.yokaiProgress||{};
 if(!d.yokaiProgress.__bonus)d.yokaiProgress.__bonus={portrait:false,furnitureJibanyan:false,furnitureKomasan:false,furnitureUsapyon:false};
 return d.yokaiProgress.__bonus;
}
function renderYokai(){
 const box=$("yokaiList");if(!box)return;
 const d=load(),q=($("yokaiSearch")?.value||"").trim().toLowerCase(),status=$("yokaiStatus")?.value||"";
 const minionDone=YOKAI_EVENT_DATA.filter(x=>yokaiEventState(d,x.id).minion).length;
 const weaponDone=YOKAI_EVENT_DATA.filter(x=>yokaiEventState(d,x.id).weapon).length;
 const medalTouched=YOKAI_EVENT_DATA.filter(x=>Number(yokaiEventState(d,x.id).medals)>0).length;
 $("yokaiMinionProgress").textContent=`${minionDone} / 17`;
 $("yokaiWeaponProgress").textContent=`${weaponDone} / 17`;
 $("yokaiMedalProgress").textContent=`${medalTouched} / 17`;
 const rate=((minionDone+weaponDone)/(17*2)*100);
 $("yokaiRate").textContent=`${rate.toFixed(1)}%`;

 const milestones=[
  {name:"ウィスパー号",ok:minionDone>=13,cond:"ミニオン13体"},
  {name:"ウィスパー号改",ok:weaponDone>=13,cond:"武器13種"},
  {name:"ジバニャンソファ",ok:weaponDone>=17,cond:"武器17種"},
  {name:"妖怪ウォッチ ぷにぷに ポートレート教材",ok:minionDone>=17,cond:"ミニオン17体"}
 ];
 $("yokaiMilestones").innerHTML=milestones.map(m=>`<div class="listitem"><span>${m.ok?"☑":"□"} <b>${esc(m.name)}</b></span><span class="small">${esc(m.cond)}</span></div>`).join("");

 const items=YOKAI_EVENT_DATA.filter(x=>{
  const st=yokaiEventState(d,x.id),hay=[x.yokai,x.job,x.weapon].join(" ").toLowerCase(),complete=st.minion&&st.weapon;
  return (!q||hay.includes(q))&&(!status||(status==="done"?complete:!complete));
 });
 box.innerHTML=items.length?items.map(x=>{
  const st=yokaiEventState(d,x.id);
  return `<div class="card ${st.minion&&st.weapon?"archived":""}">
   <div class="row">
    <div><b>${esc(x.yokai)}</b> <span class="badge gold">${esc(x.job)}</span><div class="time">${esc(x.weapon)}</div></div>
    <span class="badge">${st.minion&&st.weapon?"完了":"進行中"}</span>
   </div>
   <div class="grid2" style="margin-top:10px">
    <label class="listitem" style="display:block"><input type="checkbox" class="yokaiMinionCheck" data-id="${x.id}" style="width:auto" ${st.minion?"checked":""}> ミニオン取得</label>
    <label class="listitem" style="display:block"><input type="checkbox" class="yokaiWeaponCheck" data-id="${x.id}" style="width:auto" ${st.weapon?"checked":""}> 武器取得</label>
   </div>
   <div class="inline2" style="margin-top:8px">
    <div><label>妖怪レジェンドメダル</label><input type="number" min="0" class="yokaiMedalInput" data-id="${x.id}" value="${Number(st.medals)||0}"></div>
    <div><label>メモ</label><input class="yokaiNote" data-id="${x.id}" value="${esc(st.note||"")}" placeholder="残り枚数、周回エリアなど"></div>
   </div>
  </div>`;
 }).join(""):'<div class="empty">該当する妖怪はありません。</div>';

 document.querySelectorAll(".yokaiMinionCheck").forEach(c=>c.onchange=()=>{const d=load(),st=yokaiEventState(d,c.dataset.id);st.minion=c.checked;save(d);renderYokai();});
 document.querySelectorAll(".yokaiWeaponCheck").forEach(c=>c.onchange=()=>{const d=load(),st=yokaiEventState(d,c.dataset.id);st.weapon=c.checked;save(d);renderYokai();});
 document.querySelectorAll(".yokaiMedalInput").forEach(i=>i.onchange=()=>{const d=load(),st=yokaiEventState(d,i.dataset.id);st.medals=Math.max(0,Math.floor(Number(i.value)||0));i.value=st.medals;save(d);renderYokai();});
 document.querySelectorAll(".yokaiNote").forEach(i=>i.onchange=()=>{const d=load(),st=yokaiEventState(d,i.dataset.id);st.note=i.value;save(d);});

 const bonus=yokaiBonusState(d);
 const bonusItems=[
  ["portrait","妖怪ウォッチ ぷにぷに ポートレート教材"],
  ["furnitureJibanyan","2026追加調度品：ジバニャン"],
  ["furnitureKomasan","2026追加調度品：コマさん"],
  ["furnitureUsapyon","2026追加調度品：USAピョン"]
 ];
 $("yokaiBonusRewards").innerHTML=bonusItems.map(([key,name])=>`<label class="listitem" style="display:block"><input type="checkbox" class="yokaiBonusCheck" data-key="${key}" style="width:auto" ${bonus[key]?"checked":""}> ${esc(name)}</label>`).join("");
 document.querySelectorAll(".yokaiBonusCheck").forEach(c=>c.onchange=()=>{const d=load(),b=yokaiBonusState(d);b[c.dataset.key]=c.checked;save(d);renderYokai();});
}

function backupDateText(ts){
 const n=Number(ts||0);if(!n)return "未実施";
 return new Date(n).toLocaleString("ja-JP",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function backupFileStamp(){
 const d=new Date(),p=n=>String(n).padStart(2,"0");
 return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function downloadArchiveJSON(data,filename){
 const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
 const a=document.createElement("a"),url=URL.createObjectURL(blob);
 a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function renderBackupStatus(){
 if(!$("backupCurrentStamp"))return;
 const d=load(),meta=d.backupMeta||{},saved=Number(d._savedAt||0),last=Number(meta.lastExportAt||0);
 $("backupCurrentStamp").textContent=backupDateText(saved);
 $("backupLastStamp").textContent=backupDateText(last);
 const dirty=!last||saved>Number(meta.lastExportSavedAt||0);
 $("backupDirtyState").textContent=dirty?"あり":"なし";
 const age=last?Date.now()-last:Infinity,days=Math.floor(age/86400000),health=$("backupHealth");
 if(!last){
  health.innerHTML="<b>⚠ 外部バックアップがまだありません。</b><div class='small'>ブラウザの外に1本保存しておくと、サイトデータを削除してしまった場合にも復元できます。</div>";
  health.style.borderColor="var(--red)";
 }else if(dirty&&age>7*86400000){
  health.innerHTML=`<b>⚠ 最終バックアップから ${days}日経過し、その後に変更があります。</b><div class='small'>そろそろ新しいバックアップを作成してください。</div>`;
  health.style.borderColor="var(--gold)";
 }else if(dirty){
  health.innerHTML="<b>● バックアップ後に新しい変更があります。</b><div class='small'>重要な入力が増えた区切りでバックアップすると安心です。</div>";
  health.style.borderColor="var(--gold)";
 }else{
  health.innerHTML="<b>✓ 現在の保存内容はバックアップ済みです。</b><div class='small'>ブラウザ内の二重保存に加えて、外部バックアップがあります。</div>";
  health.style.borderColor="var(--green)";
 }
}
function renderFFSummary(){
 const d=load(),visible=ACHIEVEMENT_DB.filter(a=>!a.hidden),done=visible.filter(a=>achievementState(d,a.id).done),pts=done.reduce((n,a)=>n+a.points,0);
 $("ffAch").innerHTML=`<div class="listitem">取得済み：<b>${done.length.toLocaleString("ja-JP")} / ${visible.length.toLocaleString("ja-JP")}</b></div><div class="listitem">記録上のポイント：<b>${pts.toLocaleString("ja-JP")}</b></div><div class="listitem">達成率：<b>${(visible.length?done.length/visible.length*100:0).toFixed(1)}%</b></div>`;
}


function ffProfileData(d=load()){
 d.ffProfile=d.ffProfile||{lodestoneId:"",profileUrl:"",lastFetchedAt:0,source:"",character:null,jobs:[]};
 d.ffProfile.jobs=Array.isArray(d.ffProfile.jobs)?d.ffProfile.jobs:[];
 return d.ffProfile;
}
function normalizeLodestoneId(value){
 const s=String(value||"").trim();
 const m=s.match(/lodestone\/character\/(\d+)/i);
 if(m)return m[1];
 return /^\d+$/.test(s)?s:"";
}
function lodestoneUrls(id){
 const base=`https://jp.finalfantasyxiv.com/lodestone/character/${id}/`;
 return {profile:base,jobs:base+"class_job/"};
}
function looksLikeLodestoneHtml(text){
 const s=String(text||"");
 return s.length>1000 && (
  /finalfantasyxiv\.com\/lodestone/i.test(s) ||
  /class=["'][^"']*(?:character|frame__chara)/i.test(s) ||
  /キャラクター|種族\/部族\/性別|クラス・ジョブ/i.test(s)
 );
}
async function fetchTextWithFallback(url){
 const enc=encodeURIComponent(url);
 const attempts=[
  {name:"direct",url},
  {name:"allorigins-raw",url:`https://api.allorigins.win/raw?url=${enc}`},
  {name:"allorigins-json",url:`https://api.allorigins.win/get?url=${enc}`,json:true}
 ];
 let lastErr=null;
 for(const a of attempts){
  try{
   const r=await fetch(a.url,{cache:"no-store",headers:{Accept:a.json?"application/json,text/plain,*/*":"text/html,text/plain,*/*"}});
   if(!r.ok)throw new Error(`${a.name}: HTTP ${r.status}`);
   let txt="";
   if(a.json){
    const body=await r.json();
    txt=String(body?.contents||"");
   }else{
    txt=await r.text();
   }
   if(looksLikeLodestoneHtml(txt))return {text:txt,source:a.name};
   throw new Error(`${a.name}: Lodestone HTML not found`);
  }catch(e){
   lastErr=e;
   console.warn("Lodestone fetch failed:",a.name,e);
  }
 }
 throw lastErr||new Error("fetch failed");
}
function textAfterLabel(body,label){
 const lines=String(body||"").split(/\n+/).map(x=>x.trim()).filter(Boolean);
 const i=lines.findIndex(x=>x===label||x.startsWith(label));
 if(i<0)return "";
 const same=lines[i].slice(label.length).trim();
 if(same)return same;
 return lines[i+1]||"";
}
function parseLodestoneProfileHtml(html,id,url){
 const doc=new DOMParser().parseFromString(html,"text/html"),body=(doc.body?.innerText||"").replace(/\r/g,"");
 const q=(...sels)=>{for(const s of sels){const el=doc.querySelector(s);if(el?.textContent?.trim())return el.textContent.trim()}return ""};
 const qa=(...sels)=>{for(const s of sels){const el=doc.querySelector(s);const v=el?.getAttribute?.("src");if(v)return v}return ""};
 let name=q(".frame__chara__name",".character__name",".ldst__window .heading--lg");
 let world=q(".frame__chara__world",".character__world");
 let dc="";
 if(world){
  const m=world.match(/(.+?)\s*\[([^\]]+)\]/);if(m){world=m[1].trim();dc=m[2].trim()}
 }
 if(!name){
  const m=body.match(/##\s*キャラクター\s*\n+([^\n]+?)\s+([A-Za-z][A-Za-z0-9' -]+)\s*\[([^\]]+)\]/);
  if(m){name=m[1].trim();world=world||m[2].trim();dc=dc||m[3].trim()}
 }
 // More tolerant heading fallback: "Name World [DC]"
 if(!name){
  const lines=body.split("\n").map(x=>x.trim()).filter(Boolean);
  const charIdx=lines.findIndex(x=>x==="キャラクター");
  if(charIdx>=0&&lines[charIdx+1]){
   const line=lines[charIdx+1],m=line.match(/^(.+?)\s+([A-Za-z][A-Za-z0-9' -]+)\s*\[([^\]]+)\]$/);
   if(m){name=m[1].trim();world=m[2].trim();dc=m[3].trim()}
  }
 }
 let avatar=qa(".character__detail__image img",".frame__chara__face img",".character__face img");
 if(avatar&&avatar.startsWith("//"))avatar="https:"+avatar;
 if(avatar&&avatar.startsWith("/"))avatar=new URL(avatar,url).href;
 const raceBlock=textAfterLabel(body,"種族/部族/性別");
 let race="",tribe="",gender="";
 if(raceBlock){
  const next=body.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const idx=next.findIndex(x=>x==="種族/部族/性別");
  if(idx>=0){race=next[idx+1]||"";const second=next[idx+2]||"";const mm=second.match(/(.+?)\s*\/\s*([♂♀])/);tribe=mm?mm[1].trim():second;gender=mm?mm[2]:""}
 }
 const birthday=textAfterLabel(body,"誕生日");
 const guardian=textAfterLabel(body,"守護神");
 const city=textAfterLabel(body,"開始都市");
 const gc=textAfterLabel(body,"所属グランドカンパニー");
 let fc="";
 const lines=body.split(/\n+/).map(x=>x.trim()).filter(Boolean),fci=lines.findIndex(x=>x==="フリーカンパニー");
 if(fci>=0)fc=lines.slice(fci+1,fci+5).find(x=>x&&!/^Image$/.test(x)&&!/^プロフィール$/.test(x))||"";
 const jm=body.match(/LEVEL\s*(\d+)\s*([^\n]+)/i);
 const currentJob=jm?{level:Number(jm[1]),name:jm[2].trim()}:{level:0,name:""};
 const intro=textAfterLabel(body,"自己紹介");
 return {id:String(id),url,name,world,dc,avatar,race,tribe,gender,birthday,guardian,city,gc,fc,currentJob,intro};
}
function parseLodestoneJobsHtml(html){
 const doc=new DOMParser().parseFromString(html,"text/html"),out=[];
 // Lodestone selectors used by current/older layouts
 const blocks=[...doc.querySelectorAll(".character__job, .character__job__list li, .character__class__list li")];
 for(const b of blocks){
  const name=(b.querySelector(".character__job__name,.character__job__name--meister,.character__class__name")?.textContent||"").trim();
  const lv=(b.querySelector(".character__job__level,.character__class__level")?.textContent||"").match(/\d+/);
  if(name&&lv)out.push({name,level:Number(lv[0])});
 }
 if(out.length)return [...new Map(out.map(x=>[x.name,x])).values()];
 // text fallback
 const body=(doc.body?.innerText||"").replace(/\r/g,"");
 const lines=body.split(/\n+/).map(x=>x.trim()).filter(Boolean);
 for(let i=0;i<lines.length;i++){
  const m=lines[i].match(/^(.+?)\s+(?:LEVEL|Lv\.?)\s*(\d+)$/i);
  if(m)out.push({name:m[1].trim(),level:Number(m[2])});
  else if(/^(LEVEL|Lv\.?)\s*\d+$/i.test(lines[i])&&i>0){
   const lv=Number(lines[i].match(/\d+/)?.[0]||0),name=lines[i-1];
   if(name&&lv)out.push({name,level:lv});
  }
 }
 return [...new Map(out.map(x=>[x.name,x])).values()];
}
function parseLegacyXivapiCharacter(j,id,url){
 const c=j?.Character||j?.character||j;
 if(!c||typeof c!=="object")return null;
 const jobs=(j?.ClassJobs||j?.classjobs||[]).map(x=>({name:x.Name||x.ClassJob?.Name||x.UnlockedState?.Name||"",level:Number(x.Level||0)})).filter(x=>x.name);
 return {
  character:{
   id:String(id),url,name:c.Name||"",world:c.Server||c.World||"",dc:c.DC||c.DataCenter||"",
   avatar:c.Avatar||c.Portrait||"",race:c.Race?.Name||c.Race||"",tribe:c.Tribe?.Name||c.Tribe||"",
   gender:c.Gender===1?"♂":c.Gender===2?"♀":String(c.Gender||""),birthday:c.Nameday||"",
   guardian:c.GuardianDeity?.Name||c.GuardianDeity||"",city:c.Town?.Name||c.Town||"",
   gc:c.GrandCompany?.Name||c.GrandCompany||"",fc:c.FreeCompanyName||c.FreeCompany?.Name||"",
   currentJob:{name:c.ActiveClassJob?.Job?.Name||c.ActiveClassJob?.Class?.Name||"",level:Number(c.ActiveClassJob?.Level||0)},
   intro:c.Bio||""
  },jobs
 };
}

async function importLodestoneHtmlFiles(){
 const files=[...($("ffProfileHtmlFiles")?.files||[])],st=$("ffProfileHtmlStatus");
 if(!files.length){alert("Lodestoneから保存したHTMLファイルを選んでください");return}
 const inputId=normalizeLodestoneId($("ffLodestoneId")?.value);
 let profile=null,jobs=[],id=inputId,profileUrl="",profileFile="",jobFile="";
 try{
  for(const file of files){
   const html=await file.text(),doc=new DOMParser().parseFromString(html,"text/html"),body=(doc.body?.innerText||"");
   const urlMatch=html.match(/https?:\/\/(?:jp|na|eu|fr|de)\.finalfantasyxiv\.com\/lodestone\/character\/(\d+)/i);
   if(!id&&urlMatch)id=urlMatch[1];
   const looksJobs=/クラス・ジョブ|Class\/Job|Classes\/Jobs/i.test(body)||/class_job/i.test(file.name);
   if(looksJobs){
    const parsedJobs=parseLodestoneJobsHtml(html);
    if(parsedJobs.length){jobs=parsedJobs;jobFile=file.name}
   }else{
    const useId=id||"";
    const url=useId?lodestoneUrls(useId).profile:"";
    const parsed=parseLodestoneProfileHtml(html,useId,url||"https://jp.finalfantasyxiv.com/");
    if(parsed?.name){profile=parsed;profileFile=file.name}
   }
  }
  // If classification by text failed, try all files as profile/jobs.
  if(!profile){
   for(const file of files){
    const html=await file.text(),parsed=parseLodestoneProfileHtml(html,id||"",id?lodestoneUrls(id).profile:"https://jp.finalfantasyxiv.com/");
    if(parsed?.name){profile=parsed;profileFile=file.name;break}
   }
  }
  if(!jobs.length){
   for(const file of files){
    const html=await file.text(),parsed=parseLodestoneJobsHtml(html);
    if(parsed.length){jobs=parsed;jobFile=file.name;break}
   }
  }
  if(!profile)throw new Error("プロフィール情報を解析できませんでした");
  const d=load(),p=ffProfileData(d);
  if(id){p.lodestoneId=id;p.profileUrl=lodestoneUrls(id).profile;profile.id=id;profile.url=p.profileUrl}
  p.character=profile;
  if(jobs.length)p.jobs=jobs;
  p.lastFetchedAt=Date.now();
  p.source=`Lodestone HTML${jobFile?" + Job HTML":""}`;
  save(d);
  if($("ffLodestoneId")&&id)$("ffLodestoneId").value=id;
  if(st)st.innerHTML=`<b>✓ HTMLから取り込みました。</b> ${esc(profileFile)}${jobFile?` ／ ${esc(jobFile)}`:""}`;
  renderFFProfile();renderFF14();
 }catch(e){
  console.error("lodestone html import failed",e);
  if(st)st.innerHTML="<b>⚠ HTMLを解析できませんでした。</b> LodestoneのプロフィールページをHTML形式で保存して、もう一度選択してください。";
 }
}
async function syncLodestoneProfile(){
 const input=$("ffLodestoneId"),status=$("ffProfileSyncStatus"),id=normalizeLodestoneId(input?.value);
 if(!id){alert("Lodestone IDかキャラクターページURLを入力してください");return}
 const urls=lodestoneUrls(id);
 if(status)status.innerHTML="<b>同期中…</b><div class='small'>Lodestoneの公開プロフィールを取得しています。</div>";
 let character=null,jobs=[],source="",errors=[];
 try{
  const p=await fetchTextWithFallback(urls.profile);
  const parsed=parseLodestoneProfileHtml(p.text,id,urls.profile);
  if(!parsed?.name)throw new Error("profile parse failed");
  character=parsed;
  source=p.source==="direct"?"Lodestone direct":"Lodestone via AllOrigins";
  try{
   const j=await fetchTextWithFallback(urls.jobs);
   jobs=parseLodestoneJobsHtml(j.text);
  }catch(e){
   errors.push("jobs");
   console.warn("Lodestone jobs sync failed",e);
  }
 }catch(e){
  errors.push("profile");
  console.error("Lodestone profile sync failed",e);
 }
 if(!character){
  const d=load(),old=ffProfileData(d);
  if(status)status.innerHTML=`<b>⚠ Lodestoneへ接続できませんでした。</b><div class="small">前回保存したプロフィールは保持しています。時間をおいて再試行するか、下の「HTMLからプロフィールを取り込む」を利用してください。</div>`;
  if(old.character)renderFFProfile();
  return;
 }
 const d=load(),p=ffProfileData(d);
 p.lodestoneId=id;
 p.profileUrl=urls.profile;
 p.character=character;
 if(jobs.length)p.jobs=jobs;
 p.lastFetchedAt=Date.now();
 p.source=source+(jobs.length?"":"（ジョブ情報は前回値を保持）");
 save(d);
 if(input)input.value=id;
 renderFFProfile();renderFF14();
 if(status)status.innerHTML=`<b>✓ Lodestone同期完了</b><div class="small">${esc(source)}${jobs.length?` ／ ジョブ ${jobs.length}件`:" ／ ジョブ情報は取得できなかったため前回値を保持"}</div>`;
}
function renderFFProfile(){
 const box=$("ffProfileCard"),status=$("ffProfileSyncStatus");if(!box)return;
 const d=load(),p=ffProfileData(d),c=p.character;
 if($("ffLodestoneId")&&!$("ffLodestoneId").value)$("ffLodestoneId").value=p.lodestoneId||"";
 if(!c){
  box.innerHTML='<div class="empty">Lodestone IDを登録すると、公開プロフィールをここへ保存できます。</div>';
  if(status)status.textContent=p.lodestoneId?"未同期":"未登録";return;
 }
 if(status)status.innerHTML=`<b>✓ 保存済み</b><div class="small">最終同期：${p.lastFetchedAt?fmt(p.lastFetchedAt):"—"} ／ ${esc(p.source||"公開プロフィール")}</div>`;
 const identity=[c.race,c.tribe,c.gender].filter(Boolean).join(" / ");
 const jobs=(p.jobs||[]).slice().sort((a,b)=>b.level-a.level||a.name.localeCompare(b.name,"ja"));
 box.innerHTML=`<div class="ff-profile-card">
  ${c.avatar?`<img class="ff-profile-avatar" src="${c.avatar}" alt="${esc(c.name||"FF14 character")}">`:`<div class="ff-profile-avatar ff-profile-empty">NO IMAGE</div>`}
  <div class="ff-profile-body">
   <div class="row"><div><h2 style="margin:0">${esc(c.name||"名称未取得")}</h2><div class="time">${esc(c.world||"")}${c.dc?` [${esc(c.dc)}]`:""} ／ Lodestone #${esc(p.lodestoneId||c.id||"")}</div></div>${c.currentJob?.name?`<span class="badge gold">${esc(c.currentJob.name)} Lv.${c.currentJob.level||"?"}</span>`:""}</div>
   <div class="grid2 ff-profile-meta" style="margin-top:10px">
    ${identity?`<div class="listitem"><b>種族 / 部族 / 性別</b><div class="small">${esc(identity)}</div></div>`:""}
    ${c.gc?`<div class="listitem"><b>グランドカンパニー</b><div class="small">${esc(c.gc)}</div></div>`:""}
    ${c.fc?`<div class="listitem"><b>フリーカンパニー</b><div class="small">${esc(c.fc)}</div></div>`:""}
    ${c.city?`<div class="listitem"><b>開始都市</b><div class="small">${esc(c.city)}</div></div>`:""}
    ${c.guardian?`<div class="listitem"><b>守護神</b><div class="small">${esc(c.guardian)}</div></div>`:""}
    ${c.birthday?`<div class="listitem"><b>誕生日</b><div class="small">${esc(c.birthday)}</div></div>`:""}
   </div>
   ${jobs.length?`<details class="card" style="margin-top:10px"><summary><b>クラス・ジョブ ${jobs.length}件</b></summary><div class="grid3" style="margin-top:8px">${jobs.map(j=>`<div class="listitem"><span>${esc(j.name)}</span><b>Lv.${j.level}</b></div>`).join("")}</div></details>`:""}
  </div>
 </div>`;
}
function renderFF14(){renderFFProfile();const d=load(),ff=d.records.filter(x=>getClassification(x)==="FF14").slice().sort((a,b)=>b.time-a.time);$("ffRecent").innerHTML=ff.slice(0,8).map(x=>`<div class="listitem"><b>${esc(x.title)}</b><div class="time">${fmt(x.time)}</div></div>`).join("")||'<div class="empty">まだありません。</div>';renderFFSummary();$("ffOther").innerHTML=`<div class="listitem">釣り記録：<b>${d.fishing.length}</b></div><div class="listitem">武器制作：<b>${d.weapons.length}</b></div>`;if($("craftRecipeList"))renderCrafting();if($("fishingSummary"))renderFishing();if($("collectionList"))renderCollections();if($("cardList"))renderCards();renderAchievements();
}




function localDateValue(ms=Date.now()){
 const d=new Date(ms),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`;
}
function dayBounds(value){
 const d=value?new Date(value+"T00:00:00"):new Date();d.setHours(0,0,0,0);const start=d.getTime();return [start,start+86400000];
}
function renderQuickCaptures(){
 if(!$("quickList"))return;const d=load(),q=($("quickSearch")?.value||"").trim().toLowerCase(),f=$("quickFilter")?.value||"";
 const rows=(d.quickCaptures||[]).filter(x=>(!f||x.kind===f)&&(!q||[x.text,x.kind,...(x.tags||[])].join(" ").toLowerCase().includes(q))).sort((a,b)=>b.date-a.date);
 $("quickList").innerHTML=rows.length?rows.map(x=>`<div class="listitem"><div class="row"><span>${x.kind==="タスク"?`<input type="checkbox" class="quickDone" data-id="${x.id}" ${x.done?"checked":""}> `:""}<b>${esc(x.kind)}</b> ${nl(x.text)}</span><div class="wrap"><span class="time">${fmt(x.date)}</span><button class="danger quickDelete" data-id="${x.id}">削除</button></div></div>${(x.tags||[]).length?`<div class="wrap">${x.tags.map(t=>`<span class="badge">#${esc(t)}</span>`).join("")}</div>`:""}</div>`).join(""):'<div class="empty">まだクイック記録はありません。</div>';
 document.querySelectorAll(".quickDone").forEach(b=>b.onchange=()=>{const d=load(),x=d.quickCaptures.find(q=>q.id===b.dataset.id);if(!x)return;x.done=b.checked;x.updatedAt=Date.now();save(d);renderQuickCaptures();renderTodayHub()});
 document.querySelectorAll(".quickDelete").forEach(b=>b.onclick=()=>{const d=load();d.quickCaptures=d.quickCaptures.filter(x=>x.id!==b.dataset.id);save(d);renderQuickCaptures();renderTodayHub()});
}

function todayItemsByKind(rows,kinds){return rows.filter(x=>kinds.includes(x.kind))}
function inboxKind(item){
 const cls=getClassification(item,"");
 if(cls==="タスク")return "タスク";
 if(cls==="FF14")return "FF14";
 if(cls==="TRPG")return "TRPG";
 if(cls==="買い物"||cls==="生活")return item.tags?.some(t=>/買い物/.test(t))?"買い物":"記録";
 if(item.tags?.some(t=>/思い出|写真|SS/.test(t)))return "思い出";
 if(item.tags?.some(t=>/タスク|todo|TODO/.test(t)))return "タスク";
 return "記録";
}
function todayUnifiedRows(d,a,b){
 const inbox=(d.inbox||[]).filter(x=>Number(x.time||x.createdAt||0)>=a&&Number(x.time||x.createdAt||0)<b).map(x=>({
  id:x.id,text:x.text||x.title||"",title:x.title||"",kind:inboxKind(x),tags:normalizeTags(x.tags),done:!!x.done,date:Number(x.time||x.createdAt||0),source:"inbox"
 }));
 const legacy=(d.quickCaptures||[]).filter(x=>x.date>=a&&x.date<b).map(x=>({...x,source:"legacy"}));
 return [...inbox,...legacy].sort((x,y)=>x.date-y);
}
function renderTodayBucket(id,rows,task=false){
 const box=$(id);if(!box)return;
 box.innerHTML=rows.length?rows.map(x=>`<div class="listitem">
  ${task?`<label><input type="checkbox" class="todayTaskDone" data-source="${x.source}" data-id="${x.id}" ${x.done?"checked":""}> ${nl(x.text||x.title||"")}</label>`:`${nl(x.text||x.title||"")}`}
  <div class="small">${x.source==="inbox"?"受信箱":""} ${(x.tags||[]).map(t=>`#${esc(t)}`).join(" ")}</div>
 </div>`).join(""):'<div class="empty">なし</div>';
}

function activityDurationText(ms){
 const mins=Math.round(Math.max(0,Number(ms)||0)/60000),h=Math.floor(mins/60),m=mins%60;
 return h?`${h}時間${m?m+"分":""}`:`${m}分`;
}
function activityDayKey(v){
 const d=new Date(v);if(Number.isNaN(d.getTime()))return "";
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function renderActivityLog(){
 const box=$("activityLogList");if(!box)return;
 const d=load(),from=$("activityLogFrom")?.value||"",to=$("activityLogTo")?.value||"",cat=$("activityLogCategory")?.value||"",q=($("activityLogSearch")?.value||"").trim().toLowerCase(),sort=$("activityLogSort")?.value||"new";
 let rows=[...(d.activityLogs||[])].filter(x=>{
  const key=activityDayKey(x.startedAt||x.date);
  const hay=[x.name,x.memo,x.category].join(" ").toLowerCase();
  return (!from||key>=from)&&(!to||key<=to)&&(!cat||x.category===cat)&&(!q||hay.includes(q));
 });
 if(sort==="old")rows.sort((a,b)=>Number(a.startedAt)-Number(b.startedAt));
 else if(sort==="long")rows.sort((a,b)=>Number(b.activeMs)-Number(a.activeMs));
 else rows.sort((a,b)=>Number(b.startedAt)-Number(a.startedAt));
 const total=rows.reduce((n,x)=>n+Number(x.activeMs||0),0);
 const cats={};rows.forEach(x=>cats[x.category||"その他"]=(cats[x.category||"その他"]||0)+Number(x.activeMs||0));
 if($("activityLogSummary"))$("activityLogSummary").innerHTML=`<div class="stat">記録数<b>${rows.length}</b></div><div class="stat">合計時間<b>${activityDurationText(total)}</b></div>`+Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>`<div class="stat">${esc(k)}<b>${activityDurationText(v)}</b></div>`).join("");
 box.innerHTML=rows.length?rows.map(x=>`<details class="card"><summary><div class="row"><b>${esc(x.category||"その他")}：${esc(x.name||"活動")}</b><span class="badge">${activityDurationText(x.activeMs)}</span></div><div class="small">${new Date(x.startedAt).toLocaleString("ja-JP")}</div></summary><div style="margin-top:8px">${x.memo?`<div>${nl(x.memo)}</div>`:""}${(x.laps||[]).length?`<div class="card" style="margin-top:8px"><b>ラップ ${(x.laps||[]).length}回</b>${x.laps.map((l,i)=>`<div class="listitem"><div class="row"><span>Lap ${i+1}</span><span>${activityDurationText(l.lapMs)} ／ 合計 ${activityDurationText(l.totalMs)}</span></div></div>`).join("")}</div>`:""}<div class="small">開始 ${new Date(x.startedAt).toLocaleTimeString("ja-JP")} ／ 終了 ${x.endedAt?new Date(x.endedAt).toLocaleTimeString("ja-JP"):"—"}${(x.pauses||[]).length?` ／ 休憩 ${(x.pauses||[]).length}回`:""}</div><div class="wrap" style="margin-top:8px"><button class="danger activityLogDelete" data-id="${esc(x.id)}">削除</button></div></div></details>`).join(""):'<div class="empty">条件に合う時間記録はありません。</div>';
 document.querySelectorAll(".activityLogDelete").forEach(b=>b.onclick=()=>{if(!confirm("この時間記録を削除しますか？"))return;const d=load();d.activityLogs=(d.activityLogs||[]).filter(x=>String(x.id)!==String(b.dataset.id));save(d);renderActivityLog();renderDateArchive();renderTodayHub()});
}
function todayActivityRows(d,value){
 return (d.activityLogs||[]).filter(x=>activityDayKey(x.startedAt||x.date)===value).sort((a,b)=>Number(a.startedAt)-Number(b.startedAt));
}
function renderTodayHub(){
 if(!$("todayDate"))return;
 const d=load(),value=$("todayDate").value||localDateValue(),[a,b]=dayBounds(value),rows=todayUnifiedRows(d,a,b);
 $("todayHeadline").textContent=value===localDateValue()?"今日":"表示中の日";
 const tasks=rows.filter(x=>x.kind==="タスク"),todo=tasks.filter(x=>!x.done),doneTasks=tasks.filter(x=>x.done);
 const acts=todayActivityRows(d,value);
 const highlights=[];
 Object.entries(d.achievementProgress||{}).forEach(([id,st])=>{if(st?.doneAt&&activityDayKey(st.doneAt)===value){const a=(typeof ACHIEVEMENT_DB!=="undefined"?ACHIEVEMENT_DB:[]).find(x=>String(x.id)===String(id));highlights.push({icon:"🏆",title:a?.name||"#"+id,detail:"アチーブメント達成"})}});
 try{
  const fc=ffProfileData(d)?.ffxivCollect||d?.ffxivCollect,userMeta=fc?.userMeta||{};
  Object.entries(fc?.catalogs||{}).forEach(([kind,cat])=>(cat?.items||[]).forEach(item=>{const m=userMeta?.[kind]?.[String(item.id)]||{},dt=m.acquiredDate||m.acquiredAt;if(dt&&activityDayKey(dt)===value)highlights.push({icon:"✨",title:item.name_ja||item.name||"収集品",detail:"収集品入手"})}));
 }catch(e){}
 const bicolorDone=[];
 if(typeof BICOLOR_ITEMS!=="undefined"){const bg=d.bicolor?.owned||{};BICOLOR_ITEMS.forEach(x=>{const st=bg[x.id];if(st?.doneAt&&activityDayKey(st.doneAt)===value)bicolorDone.push({icon:"💎",title:x.name,detail:`${x.zone} ／ ${x.cost}ジェム`})})}
 const ordinary=rows.filter(x=>x.kind!=="タスク");
 const doneItems=[
  ...doneTasks.map(x=>({icon:"☑",title:x.text||x.title||"タスク",detail:"タスク完了"})),
  ...acts.map(x=>({icon:"⏱",title:`${x.category||"その他"}：${x.name||"活動"}`,detail:activityDurationText(x.activeMs)})),
  ...ordinary.map(x=>({icon:x.kind==="FF14"?"🎮":x.kind==="TRPG"?"🎲":x.kind==="買い物"?"🛒":x.kind==="思い出"?"📷":"📝",title:x.text||x.title||x.kind,detail:x.kind})),
  ...highlights,...bicolorDone
 ];
 $("todaySummary").textContent=`やること ${todo.length}件 ／ やったこと ${doneItems.length}件`;
 renderTodayBucket("todayTodo",todo,true);
 if($("todayDone"))$("todayDone").innerHTML=doneItems.length?doneItems.map(x=>`<div class="listitem"><div><b>${x.icon} ${nl(x.title)}</b></div><div class="small">${esc(x.detail||"")}</div></div>`).join(""):'<div class="empty">まだ記録はありません。</div>';

 renderTodayBucket("todayNotes",todayItemsByKind(rows,["記録","メモ"]));
 renderTodayBucket("todayFF14",todayItemsByKind(rows,["FF14"]));
 renderTodayBucket("todayTRPG",todayItemsByKind(rows,["TRPG"]));
 renderTodayBucket("todayShopping",todayItemsByKind(rows,["買い物"]));
 renderTodayBucket("todayMemories",todayItemsByKind(rows,["思い出"]));
 if($("todayActivity"))$("todayActivity").innerHTML=acts.length?acts.map(x=>`<div class="listitem"><b>${esc(x.category||"その他")}：${esc(x.name||"活動")}</b><div class="small">${activityDurationText(x.activeMs)}${(x.laps||[]).length?` ／ ラップ ${(x.laps||[]).length}回`:""}</div></div>`).join(""):'<div class="empty">なし</div>';
 if($("todayArchiveHighlights"))$("todayArchiveHighlights").innerHTML=[...highlights,...bicolorDone].length?[...highlights,...bicolorDone].map(x=>`<div class="listitem">${x.icon} ${esc(x.title)}<div class="small">${esc(x.detail||"")}</div></div>`).join(""):'<div class="empty">なし</div>';

 document.querySelectorAll(".todayTaskDone").forEach(el=>el.onchange=()=>{
  const d=load(),now=Date.now();
  if(el.dataset.source==="legacy"){
   const x=(d.quickCaptures||[]).find(q=>String(q.id)===String(el.dataset.id));if(!x)return;
   x.done=el.checked;x.doneAt=el.checked?now:0;x.updatedAt=now;
  }else{
   const x=(d.inbox||[]).find(q=>String(q.id)===String(el.dataset.id));if(!x)return;
   x.done=el.checked;x.doneAt=el.checked?now:0;x.updatedAt=now;
  }
  save(d);renderTodayHub();if(typeof renderDateArchive==="function")renderDateArchive();
 });
}
function scenarioAssetLabels(a={}){
 const defs=[["pdf","PDF"],["room","部屋素材"],["npc","NPC立ち絵"],["bgm","BGM"],["ccfolia","ココフォリア"],["other","その他"]];
 return defs.filter(([k])=>a[k]).map(([,v])=>v);
}
function scenarioFirstDateLabel(d,parentId){
 const n=scenarioFirstSessionDate(d,parentId);return n?fmt(n):"日付未登録";
}
function refreshScenarioSelectors(){
 const d=load(),lib=(d.scenarioLibrary||[]).slice().sort((a,b)=>a.title.localeCompare(b.title,"ja"));
 if($("scenarioLinkLibrary"))$("scenarioLinkLibrary").innerHTML='<option value="">選択</option>'+lib.map(s=>`<option value="${s.id}">${esc(s.title)}</option>`).join("");
 const parents=trpgParentsAll(d).slice().sort((a,b)=>scenarioFirstSessionDate(d,b.id)-scenarioFirstSessionDate(d,a.id));
 if($("scenarioLinkParent"))$("scenarioLinkParent").innerHTML=parents.map(p=>`<option value="${p.id}">${esc(p.name)} ｜ 初回 ${scenarioFirstDateLabel(d,p.id)}</option>`).join("");
}
function clearScenarioForm(){
 ["scenarioTitle","scenarioSystems","scenarioAuthor","scenarioSourceUrl","scenarioPurchasedAt","scenarioPlayers","scenarioPlayTime","scenarioTags","scenarioStorageUrl","scenarioMemo"].forEach(id=>{if($(id))$(id).value=""});
 ["assetPdf","assetRoom","assetNpc","assetBgm","assetCcfolia","assetOther"].forEach(id=>{if($(id))$(id).checked=false});
 if($("scenarioStatus"))$("scenarioStatus").value="未通過";
 if($("scenarioSave")){delete $("scenarioSave").dataset.editId;$("scenarioSave").textContent="シナリオを登録";}
 if($("scenarioCancel"))$("scenarioCancel").style.display="none";
 if($("scenarioFormTitle"))$("scenarioFormTitle").textContent="＋ シナリオを登録";
}
function editScenario(id){
 const d=load(),s=d.scenarioLibrary.find(x=>x.id===id);if(!s)return;
 $("scenarioTitle").value=s.title;$("scenarioSystems").value=(s.systems||[]).join(", ");$("scenarioAuthor").value=s.author||"";$("scenarioSourceUrl").value=s.sourceUrl||"";
 $("scenarioPurchasedAt").value=s.purchasedAt?new Date(s.purchasedAt).toISOString().slice(0,10):"";$("scenarioPlayers").value=s.players||"";$("scenarioPlayTime").value=s.playTime||"";$("scenarioStatus").value=s.status||"未通過";$("scenarioTags").value=(s.tags||[]).join(", ");$("scenarioStorageUrl").value=s.storageUrl||"";$("scenarioMemo").value=s.memo||"";
 [["assetPdf","pdf"],["assetRoom","room"],["assetNpc","npc"],["assetBgm","bgm"],["assetCcfolia","ccfolia"],["assetOther","other"]].forEach(([id,k])=>$(id).checked=!!s.assets?.[k]);
 $("scenarioSave").dataset.editId=s.id;$("scenarioSave").textContent="シナリオを更新";$("scenarioCancel").style.display="";$("scenarioFormTitle").textContent=`✏ ${s.title} を編集`;$("scenarioFormTitle").scrollIntoView({behavior:"smooth",block:"center"});
}

function trpgAssetRoot(d=load()){
 d.trpgAssets=d.trpgAssets||[];d.trpgAssetUsage=d.trpgAssetUsage||[];return d;
}
function refreshTRPGAssetSelectors(){
 const d=trpgAssetRoot(load()),sc=(d.scenarioLibrary||[]).slice().sort((a,b)=>String(a.title).localeCompare(String(b.title),"ja")),as=(d.trpgAssets||[]).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),"ja"));
 const so='<option value="">選択</option>'+sc.map(x=>`<option value="${x.id}">${esc(x.title)}</option>`).join("");
 const ao='<option value="">選択</option>'+as.map(x=>`<option value="${x.id}">${esc(x.name)}［${esc(x.type)}］</option>`).join("");
 if($("trpgAssetScenario"))$("trpgAssetScenario").innerHTML=so;if($("kpAssetScenario"))$("kpAssetScenario").innerHTML=so;if($("trpgAssetLinkAsset"))$("trpgAssetLinkAsset").innerHTML=ao;
}
function assetUsageFor(d,assetId){return (d.trpgAssetUsage||[]).filter(x=>x.assetId===assetId)}
function renderTRPGAssets(){
 if(!$("trpgAssetList"))return;const d=trpgAssetRoot(load()),q=($("trpgAssetSearch").value||"").trim().toLowerCase(),f=$("trpgAssetFilter").value||"";
 const rows=(d.trpgAssets||[]).filter(a=>{const uses=assetUsageFor(d,a.id).map(u=>(d.scenarioLibrary||[]).find(s=>s.id===u.scenarioId)?.title||"");const hay=[a.name,a.type,a.author,a.terms,a.memo,...(a.tags||[]),...uses].join(" ").toLowerCase();return(!q||hay.includes(q))&&(!f||a.type===f)});
 $("trpgAssetCount").textContent=`${(d.trpgAssets||[]).length}件`;
 $("trpgAssetList").innerHTML=rows.length?rows.map(a=>{const uses=assetUsageFor(d,a.id),sc=[...new Set(uses.map(u=>(d.scenarioLibrary||[]).find(s=>s.id===u.scenarioId)?.title).filter(Boolean))];return `<details class="card"><summary><span><b>${esc(a.name)}</b> <span class="badge gold">${esc(a.type)}</span></span><span class="badge">${sc.length}シナリオ</span></summary><div style="margin-top:8px">${a.author?`<div class="small">作者・配布元：${esc(a.author)}</div>`:""}${a.terms?`<div class="small">利用条件：${esc(a.terms)}</div>`:""}${(a.tags||[]).length?`<div class="wrap">${a.tags.map(x=>`<span class="badge">${esc(x)}</span>`).join("")}</div>`:""}${sc.length?`<div class="small" style="margin-top:7px"><b>使用：</b>${sc.map(esc).join(" ／ ")}</div>`:""}${a.memo?`<p>${nl(a.memo)}</p>`:""}<div class="wrap">${a.url?`<button class="secondary trpgAssetOpen" data-id="${a.id}">素材を開く</button>`:""}<button class="danger trpgAssetDelete" data-id="${a.id}">削除</button></div></div></details>`}).join(""):'<div class="empty">素材はまだありません。</div>';
 document.querySelectorAll(".trpgAssetOpen").forEach(b=>b.onclick=()=>{const a=load().trpgAssets?.find(x=>x.id===b.dataset.id);if(a?.url)window.open(a.url,"_blank","noopener")});
 document.querySelectorAll(".trpgAssetDelete").forEach(b=>b.onclick=()=>{if(!confirm("この素材を削除しますか？ シナリオとの紐付けも削除します。"))return;const d=trpgAssetRoot(load());d.trpgAssets=d.trpgAssets.filter(x=>x.id!==b.dataset.id);d.trpgAssetUsage=d.trpgAssetUsage.filter(x=>x.assetId!==b.dataset.id);save(d);refreshTRPGAssetSelectors();renderTRPGAssets();renderScenarioAssetUsage();renderKPAssetUsage()});
 refreshTRPGAssetSelectors();renderScenarioAssetUsage();
}
function renderScenarioAssetUsage(){
 if(!$("trpgAssetScenarioUsage"))return;const d=trpgAssetRoot(load()),sid=$("trpgAssetScenario").value;
 if(!sid){$("trpgAssetScenarioUsage").innerHTML='<div class="empty">シナリオを選択すると使用素材が表示されます。</div>';return}
 const rows=(d.trpgAssetUsage||[]).filter(x=>x.scenarioId===sid).sort((a,b)=>(a.order||a.time)-(b.order||b.time));
 $("trpgAssetScenarioUsage").innerHTML=rows.length?rows.map(u=>{const a=d.trpgAssets.find(x=>x.id===u.assetId);if(!a)return"";return `<div class="listitem"><div class="row"><div><b>${esc(a.name)}</b> <span class="badge gold">${esc(a.type)}</span><div class="small">${esc(u.scene||"シーン未指定")}${u.purpose?` ／ ${esc(u.purpose)}`:""}</div></div><button class="danger trpgUsageDelete" data-id="${u.id}">解除</button></div></div>`}).join(""):'<div class="empty">このシナリオにはまだ素材を登録していません。</div>';
 document.querySelectorAll(".trpgUsageDelete").forEach(b=>b.onclick=()=>{const d=trpgAssetRoot(load());d.trpgAssetUsage=d.trpgAssetUsage.filter(x=>x.id!==b.dataset.id);save(d);renderScenarioAssetUsage();renderTRPGAssets();renderKPAssetUsage()});
}
function renderKPAssetUsage(){
 if(!$("kpAssetUsage"))return;const d=trpgAssetRoot(load()),sid=$("kpAssetScenario").value;if(!sid){$("kpAssetUsage").innerHTML='<div class="empty">シナリオを選択してください。</div>';return}
 const rows=(d.trpgAssetUsage||[]).filter(x=>x.scenarioId===sid).sort((a,b)=>(a.order||a.time)-(b.order||b.time));
 $("kpAssetUsage").innerHTML=rows.length?rows.map(u=>{const a=d.trpgAssets.find(x=>x.id===u.assetId);if(!a)return"";return `<div class="listitem"><div class="row"><div><b>${esc(u.scene||"シーン未指定")}</b><div>${esc(a.name)} <span class="badge">${esc(a.type)}</span></div><div class="small">${esc(u.purpose||"")}</div></div>${a.url?`<button class="secondary kpAssetOpen" data-id="${a.id}">開く</button>`:""}</div></div>`}).join(""):'<div class="empty">使用素材はまだありません。</div>';
 document.querySelectorAll(".kpAssetOpen").forEach(b=>b.onclick=()=>{const a=load().trpgAssets?.find(x=>x.id===b.dataset.id);if(a?.url)window.open(a.url,"_blank","noopener")});
}
function renderScenarioLibrary(){
 if(!$("scenarioLibraryList"))return;
 const d=load(),q=($("scenarioSearch")?.value||"").trim().toLowerCase(),filter=$("scenarioFilter")?.value||"";
 let rows=(d.scenarioLibrary||[]).filter(s=>{
  const hay=[s.title,s.author,...(s.systems||[]),...(s.tags||[])].join(" ").toLowerCase();
  return (!q||hay.includes(q))&&(!filter||s.status===filter);
 }).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
 $("scenarioCount").textContent=(d.scenarioLibrary||[]).length;
 $("scenarioUnreadCount").textContent=(d.scenarioLibrary||[]).filter(s=>s.status==="未通過").length;
 $("scenarioKpCount").textContent=(d.scenarioLibrary||[]).filter(s=>/KP済/.test(s.status)).length;
 $("scenarioTableLinkCount").textContent=(d.scenarioLibrary||[]).reduce((n,s)=>n+(s.linkedParentIds||[]).length,0);
 if($("scenarioUsedAssetCount"))$("scenarioUsedAssetCount").textContent=(d.trpgAssetUsage||[]).length;
 $("scenarioLibraryList").innerHTML=rows.length?rows.map(s=>{
  const assets=scenarioAssetLabels(s.assets),parents=(s.linkedParentIds||[]).map(id=>(d.stackParents||[]).find(p=>p.id===id)).filter(Boolean);
  return `<details class="card">
   <summary><span><b>${esc(s.title)}</b> ${(s.systems||[]).map(t=>`<span class="badge gold">${esc(t)}</span>`).join("")}</span><span class="badge">${esc(s.status)}</span></summary>
   <div style="margin-top:10px">
    <div class="small">${s.author?`作者：${esc(s.author)} ／ `:""}${s.players?`人数：${esc(s.players)} ／ `:""}${s.playTime?`想定：${esc(s.playTime)}`:""}</div>
    ${(s.tags||[]).length?`<div class="wrap" style="margin-top:7px">${s.tags.map(t=>`<span class="badge">${esc(t)}</span>`).join("")}</div>`:""}
    ${assets.length?`<div class="small" style="margin-top:8px"><b>所持素材：</b>${assets.map(esc).join(" ／ ")}</div>`:""}
    ${parents.length?`<details style="margin-top:8px"><summary>遊んだ卓 ${parents.length}件</summary>${parents.map(p=>`<div class="listitem"><b>${esc(p.name)}</b><div class="time">初回 ${scenarioFirstDateLabel(d,p.id)}</div></div>`).join("")}</details>`:""}
    ${(()=>{const uses=(d.trpgAssetUsage||[]).filter(u=>u.scenarioId===s.id),items=uses.map(u=>({u,a:(d.trpgAssets||[]).find(a=>a.id===u.assetId)})).filter(x=>x.a);return items.length?`<details style="margin-top:8px"><summary>🎬 使用素材 ${items.length}件</summary>${items.map(({u,a})=>`<div class="listitem"><b>${esc(a.name)}</b> <span class="badge">${esc(a.type)}</span><div class="small">${esc(u.scene||"シーン未指定")}${u.purpose?` ／ ${esc(u.purpose)}`:""}</div></div>`).join("")}</details>`:""})()}
    ${s.memo?`<p>${nl(s.memo)}</p>`:""}
    <div class="wrap" style="margin-top:8px">
     ${s.sourceUrl?`<button class="secondary scenarioOpenSource" data-id="${s.id}">購入・配布元</button>`:""}
     ${s.storageUrl?`<button class="secondary scenarioOpenStorage" data-id="${s.id}">素材保存先</button>`:""}
     <button class="secondary scenarioEdit" data-id="${s.id}">編集</button><button class="danger scenarioDelete" data-id="${s.id}">削除</button>
    </div>
   </div>
  </details>`;
 }).join(""):'<div class="empty">該当する所持シナリオはありません。</div>';
 document.querySelectorAll(".scenarioEdit").forEach(b=>b.onclick=()=>editScenario(b.dataset.id));
 document.querySelectorAll(".scenarioDelete").forEach(b=>b.onclick=()=>{if(!confirm("この所持シナリオデータを削除しますか？"))return;const d=load();d.scenarioLibrary=d.scenarioLibrary.filter(x=>x.id!==b.dataset.id);save(d);refreshScenarioSelectors();renderScenarioLibrary()});
 document.querySelectorAll(".scenarioOpenSource").forEach(b=>b.onclick=()=>{const s=load().scenarioLibrary.find(x=>x.id===b.dataset.id);if(s?.sourceUrl)window.open(s.sourceUrl,"_blank","noopener")});
 document.querySelectorAll(".scenarioOpenStorage").forEach(b=>b.onclick=()=>{const s=load().scenarioLibrary.find(x=>x.id===b.dataset.id);if(s?.storageUrl)window.open(s.storageUrl,"_blank","noopener")});
}
function personById(d,id){return (d.people||[]).find(p=>p.id===id)||null}
function characterById(d,id){return (d.characters||[]).find(c=>c.id===id)||null}
function trpgParentsAll(d=load()){return (d.stackParents||[]).filter(p=>String(p.category||"")==="TRPG")}
function personSessions(d,personId){
 const rows=[];
 trpgParentsAll(d).forEach(parent=>{
  const links=(parent.participantLinks||[]).filter(x=>x.personId===personId);
  if(!links.length)return;
  const days=(d.stackDays||[]).filter(day=>day.parentId===parent.id).sort((a,b)=>(Number(a.time||a.createdAt)||0)-(Number(b.time||b.createdAt)||0));
  const first=days.length?Number(days[0].time||days[0].createdAt):Number(parent.time||parent.createdAt||0);
  const last=days.length?Number(days[days.length-1].time||days[days.length-1].createdAt):first;
  rows.push({parent,links,days,first,last});
 });
 return rows.sort((a,b)=>b.last-a.last);
}
function refreshPeopleSelectors(){
 const d=load(),people=(d.people||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,"ja")),chars=(d.characters||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,"ja")),parents=trpgParentsAll(d).slice().sort((a,b)=>(Number(b.updatedAt||b.time)||0)-(Number(a.updatedAt||a.time)||0));
 const personOptions='<option value="">未指定</option>'+people.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
 if($("characterPerson"))$("characterPerson").innerHTML=personOptions;
 const charOptions='<option value="">選択</option>'+chars.map(c=>`<option value="${c.id}">${esc(c.name)}${personById(d,c.personId)?`（${esc(personById(d,c.personId).name)}）`:""}</option>`).join("");
 if($("relationFrom"))$("relationFrom").innerHTML=charOptions;if($("relationTo"))$("relationTo").innerHTML=charOptions;
 const parentOptions='<option value="">選択してください</option>'+parents.map(p=>{
  const first=scenarioFirstSessionDate(d,p.id);
  return `<option value="${p.id}">${esc(p.name)}${first?` ｜ 初回 ${new Date(first).toLocaleDateString("ja-JP")}`:" ｜ 日付未登録"}</option>`;
 }).join("");
 if($("linkParent"))$("linkParent").innerHTML=parentOptions;
 if($("relationScenario"))$("relationScenario").innerHTML=parents.map(p=>{
  const first=scenarioFirstSessionDate(d,p.id);
  return `<option value="${p.id}">${esc(p.name)}${first?` ｜ 初回 ${new Date(first).toLocaleDateString("ja-JP")}`:" ｜ 日付未登録"}</option>`;
 }).join("");
}
function participantRowHtml(link={}){
 const d=load(),people=(d.people||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,"ja")),chars=(d.characters||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,"ja"));
 return `<div class="inline2 participantLinkRow" style="margin-top:7px">
  <div><label>人物</label><select class="participantPerson"><option value="">未指定</option>${people.map(p=>`<option value="${p.id}" ${p.id===link.personId?"selected":""}>${esc(p.name)}</option>`).join("")}</select></div>
  <div><label>PC</label><select class="participantCharacter"><option value="">未指定</option>${chars.map(c=>`<option value="${c.id}" ${c.id===link.characterId?"selected":""}>${esc(c.name)}</option>`).join("")}</select></div>
  <div><label>役割</label><select class="participantRole"><option ${link.role==="PL"?"selected":""}>PL</option><option ${link.role==="KP"?"selected":""}>KP</option><option ${link.role==="SKP"?"selected":""}>SKP</option><option ${link.role==="見学"?"selected":""}>見学</option></select></div>
  <div style="display:flex;align-items:end"><button type="button" class="danger participantRemove">行を削除</button></div>
 </div>`;
}
function bindParticipantRows(){
 document.querySelectorAll(".participantRemove").forEach(b=>b.onclick=()=>b.closest(".participantLinkRow")?.remove());
}
function loadParentParticipants(){
 const d=load(),p=(d.stackParents||[]).find(x=>x.id===$("linkParent")?.value),box=$("linkParticipantRows");if(!box)return;
 box.innerHTML=p&&p.participantLinks?.length?p.participantLinks.map(participantRowHtml).join(""):participantRowHtml();
 bindParticipantRows();
}
function renderPeopleCodex(){
 if(!$("peopleCodexList"))return;
 const d=load(),q=($("peopleSearch")?.value||"").trim().toLowerCase(),sort=$("peopleSort")?.value||"recent";
 const people=(d.people||[]).map(p=>{
  const sessions=personSessions(d,p.id),chars=(d.characters||[]).filter(c=>c.personId===p.id);
  const first=sessions.length?Math.min(...sessions.map(s=>s.first).filter(Boolean)):0,last=sessions.length?Math.max(...sessions.map(s=>s.last).filter(Boolean)):0;
  const hay=[p.name,...(p.aliases||[]),...(p.groups||[]),...chars.map(c=>c.name),...sessions.map(s=>s.parent.name)].join(" ").toLowerCase();
  return {p,sessions,chars,first,last,hay};
 }).filter(x=>!q||x.hay.includes(q));
 people.sort((a,b)=>sort==="name"?a.p.name.localeCompare(b.p.name,"ja"):sort==="first"?(a.first||Infinity)-(b.first||Infinity):sort==="count"?b.sessions.length-a.sessions.length:(b.last||0)-(a.last||0));
 $("peopleCount").textContent=(d.people||[]).length;$("characterCount").textContent=(d.characters||[]).length;$("relationCount").textContent=(d.characterRelations||[]).length;$("participantLinkCount").textContent=(d.stackParents||[]).reduce((n,p)=>n+(p.participantLinks||[]).length,0);

 $("peopleCodexList").innerHTML=people.length?people.map(x=>`<details class="card">
  <summary><span><b>${esc(x.p.name)}</b> ${(x.p.groups||[]).map(t=>`<span class="badge">${esc(t)}</span>`).join("")}</span><span class="small">共卓 ${x.sessions.length}卓${x.last?` ／ 最近 ${fmt(x.last)}`:""}</span></summary>
  <div style="margin-top:10px">
   ${(x.p.aliases||[]).length?`<div class="small">別名：${x.p.aliases.map(esc).join(" ／ ")}</div>`:""}
   <div class="small">${x.first?`初共卓：${fmt(x.first)}`:"初共卓：未登録"}${x.last?` ／ 最終：${fmt(x.last)}`:""}</div>
   ${x.p.memo?`<p>${nl(x.p.memo)}</p>`:""}
   <div class="row" style="margin-top:8px"><b>PC</b><button class="secondary personEdit" data-id="${x.p.id}">人物編集</button></div>
   ${x.chars.length?x.chars.map(c=>`<div class="listitem">
    <div class="pcCodexEntry">
      ${c.imageData?`<img class="pcPortrait" src="${c.imageData}" alt="${esc(c.name)}">`:`<div class="pcPortrait pcPortraitEmpty">NO IMAGE</div>`}
      <div class="pcCodexBody">
    <div class="row">
      <span><b>${esc(c.name)}</b>${(c.systems||[]).map(s=>` <span class="badge gold">${esc(s)}</span>`).join("")}</span>
      <div class="wrap">${c.sheetUrl?`<button type="button" class="secondary characterSheetOpen" data-id="${c.id}">キャラシを開く</button>`:""}<button type="button" class="secondary characterImageEdit" data-id="${c.id}">${c.imageData?"画像変更":"画像追加"}</button>${c.imageData?`<button type="button" class="secondary characterImageRemove" data-id="${c.id}">画像を外す</button>`:""}<button type="button" class="secondary characterEdit" data-id="${c.id}">PC編集</button></div>
    </div>
    ${c.sheetUrl?`<div class="small" style="margin-top:5px;overflow-wrap:anywhere">${esc(c.sheetUrl)}</div>`:""}
    ${c.memo?`<div class="small">${esc(c.memo)}</div>`:""}
      </div>
    </div>
   </div>`).join(""):'<div class="empty">PC未登録</div>'}
   <details style="margin-top:8px"><summary>共卓履歴 ${x.sessions.length}件</summary>
    ${x.sessions.length?x.sessions.map(s=>`<div class="listitem"><b>${esc(s.parent.name)}</b><div class="time">${s.first?fmt(s.first):"—"}${s.last&&s.last!==s.first?` ～ ${fmt(s.last)}`:""} ／ ${s.days.length}日</div><div class="small">${s.links.map(l=>{const c=characterById(d,l.characterId);return `${esc(l.role||"PL")}${c?`：${esc(c.name)}`:""}`}).join(" ／ ")}</div></div>`).join(""):'<div class="empty">履歴なし</div>'}
   </details>
  </div>
 </details>`).join(""):'<div class="empty">人物はまだ登録されていません。</div>';
 document.querySelectorAll(".personEdit").forEach(b=>b.onclick=()=>{const d=load(),p=d.people.find(x=>x.id===b.dataset.id);if(!p)return;const name=prompt("名前",p.name);if(name===null)return;const memo=prompt("メモ",p.memo||"");if(memo===null)return;p.name=name.trim()||p.name;p.memo=memo;p.updatedAt=Date.now();save(d);refreshPeopleSelectors();renderPeopleCodex();});
 document.querySelectorAll(".characterSheetOpen").forEach(b=>b.onclick=()=>{const d=load(),c=d.characters.find(x=>x.id===b.dataset.id);if(c?.sheetUrl)window.open(c.sheetUrl,"_blank","noopener")});
 document.querySelectorAll(".characterEdit").forEach(b=>b.onclick=()=>{
  const d=load(),c=d.characters.find(x=>x.id===b.dataset.id);if(!c)return;
  const name=prompt("PC名",c.name);if(name===null)return;
  const systems=prompt("システムタグ（カンマ区切り）",(c.systems||[]).join(", "));if(systems===null)return;
  const url=prompt("キャラクターシートURL",c.sheetUrl||"");if(url===null)return;
  const memo=prompt("メモ",c.memo||"");if(memo===null)return;
  c.name=name.trim()||c.name;c.systems=systems.split(/[,、]/).map(x=>x.trim()).filter(Boolean);c.sheetUrl=url.trim();c.memo=memo;c.updatedAt=Date.now();save(d);refreshPeopleSelectors();renderPeopleCodex();
 });
 document.querySelectorAll(".characterImageEdit").forEach(b=>b.onclick=()=>{
  const input=document.createElement("input");input.type="file";input.accept="image/*";
  input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{const data=await fileToDataUrl(file),d=load(),c=d.characters.find(x=>x.id===b.dataset.id);if(!c)return;c.imageData=data;c.updatedAt=Date.now();save(d);renderPeopleCodex()}catch(e){alert("画像を読み込めませんでした")}};
  input.click();
 });
 document.querySelectorAll(".characterImageRemove").forEach(b=>b.onclick=()=>{if(!confirm("このPC画像を外しますか？"))return;const d=load(),c=d.characters.find(x=>x.id===b.dataset.id);if(!c)return;c.imageData="";c.updatedAt=Date.now();save(d);renderPeopleCodex()});

 renderRelations();
}

function scenarioFirstSessionDate(d,parentId){
 const p=(d.stackParents||[]).find(x=>x.id===parentId);
 if(!p)return 0;
 const days=(d.stackDays||[]).filter(day=>day.parentId===parentId)
   .map(day=>Number(day.time||day.createdAt||0)).filter(Boolean).sort((a,b)=>a-b);
 return days[0]||Number(p.time||p.createdAt||0);
}
function renderRelations(){
 const box=$("relationList");if(!box)return;const d=load();
 box.innerHTML=(d.characterRelations||[]).length?(d.characterRelations||[]).map(r=>{
  const a=characterById(d,r.fromId),b=characterById(d,r.toId);
  const scenarioIds=Array.isArray(r.scenarioParentIds)?r.scenarioParentIds:(r.scenarioParentId?[r.scenarioParentId]:[]);
  const scenarios=scenarioIds.map(id=>(d.stackParents||[]).find(p=>p.id===id)).filter(Boolean);
  return `<div class="listitem">
    <div class="row"><span><b>${esc(a?.name||"?")}</b> ── ${esc(r.label||"関係")} ── <b>${esc(b?.name||"?")}</b></span>
      <div class="wrap"><button class="secondary relationEdit" data-id="${r.id}">編集</button><button class="danger relationDelete" data-id="${r.id}">削除</button></div>
    </div>
    ${scenarios.length?`<div style="margin-top:7px"><div class="small"><b>関連シナリオ</b></div>${scenarios.map(s=>{const first=scenarioFirstSessionDate(d,s.id);return `<div class="listitem" style="padding:7px 9px;margin-top:5px"><span class="badge">${esc(s.name)}</span><span class="small" style="margin-left:8px">初回セッション：${first?fmt(first):"日付未登録"}</span></div>`}).join("")}</div>`:""}
    ${r.memo?`<div class="small" style="margin-top:5px">${esc(r.memo)}</div>`:""}
  </div>`;
 }).join(""):'<div class="empty">PC関係はまだありません。</div>';

 document.querySelectorAll(".relationEdit").forEach(b=>b.onclick=()=>{
  const d=load(),r=d.characterRelations.find(x=>x.id===b.dataset.id);if(!r)return;
  if($("relationFrom"))$("relationFrom").value=r.fromId;
  if($("relationTo"))$("relationTo").value=r.toId;
  if($("relationLabel"))$("relationLabel").value=r.label||"";
  if($("relationMemo"))$("relationMemo").value=r.memo||"";
  const ids=new Set(Array.isArray(r.scenarioParentIds)?r.scenarioParentIds:(r.scenarioParentId?[r.scenarioParentId]:[]));
  [...($("relationScenario")?.options||[])].forEach(o=>o.selected=ids.has(o.value));
  $("relationAdd").dataset.editId=r.id;
  $("relationAdd").textContent="関係を更新";
  if($("relationCancelEdit"))$("relationCancelEdit").style.display="";
  if($("relationEditStatus"))$("relationEditStatus").textContent="編集中：関連シナリオを追加・削除できます";
  $("relationFrom")?.scrollIntoView({behavior:"smooth",block:"center"});
 });
 document.querySelectorAll(".relationDelete").forEach(b=>b.onclick=()=>{const d=load();d.characterRelations=d.characterRelations.filter(x=>x.id!==b.dataset.id);save(d);renderPeopleCodex()});
}
function trpgStackGroups(role){
 const d=load();
 const parents=(d.stackParents||[]).filter(p=>String(p.category||"")==="TRPG");
 return parents.map(parent=>{
  const parentTags=normalizeTags(parent.tags);
  const roleIsKp=/kp|キーパー/i.test([parent.name,...parentTags].join(" "));
  if((role==="kp")!==roleIsKp)return null;
  const days=(d.stackDays||[])
    .filter(day=>day.parentId===parent.id)
    .slice()
    .sort((a,b)=>(Number(a.time||a.createdAt)||0)-(Number(b.time||b.createdAt)||0));
  const entries=(d.stackEntries||[]).filter(e=>{
    const day=days.find(x=>x.id===e.dayId);
    return e.parentId===parent.id||!!day;
  });
  const parentDate=Number(parent.time||parent.createdAt||0);
  const firstSession=days.length?Number(days[0].time||days[0].createdAt||0):parentDate;
  const lastSession=days.length?Number(days[days.length-1].time||days[days.length-1].createdAt||0):parentDate;
  return {parent,days,entries,parentDate,firstSession,lastSession};
 }).filter(Boolean).sort((a,b)=>(b.lastSession||b.parentDate||0)-(a.lastSession||a.parentDate||0));
}
function renderTrpgStackTimeline(role){
 const groups=trpgStackGroups(role);
 if(!groups.length)return '<div class="empty">親子ページのセッション記録はまだありません。</div>';
 return groups.map(g=>{
  const parentTags=normalizeTags(g.parent.tags);
  return `<div class="card">
   <div class="row">
    <div><b>${esc(g.parent.name||"無題")}</b><div class="time">${g.days.length}日分 ／ 親子ページ</div></div>
    <div class="wrap">${parentTags.map(t=>`<span class="badge gold">#${esc(t)}</span>`).join("")}</div>
   </div>
   ${g.days.length?g.days.map((day,i)=>{
     const dayEntries=g.entries.filter(e=>e.dayId===day.id);
     const mergedTags=normalizeTags([...parentTags,...normalizeTags(day.tags),...dayEntries.flatMap(e=>normalizeTags(e.tags))]);
     return `<div class="listitem">
      <div class="row">
       <div><b>${esc(day.label||day.name||`${i+1}日目`)}</b><div class="time">${fmt(Number(day.time||day.createdAt||Date.now()))}</div></div>
       <div class="wrap">${mergedTags.map(t=>`<span class="badge">#${esc(t)}</span>`).join("")}</div>
      </div>
      ${dayEntries.length?`<div class="small" style="margin-top:6px">${dayEntries.length}件の子記録：${dayEntries.map(e=>esc(e.title||e.entryType||"記録")).join(" ／ ")}</div>`:'<div class="small muted" style="margin-top:6px">子記録なし</div>'}
     </div>`;
   }).join(""):'<div class="empty">子ページはまだありません。</div>'}
  </div>`;
 }).join("");
}

function trpgParentHistoryHtml(role){
 const groups=trpgStackGroups(role);
 if(!groups.length)return '<div class="empty">親子ページの卓履歴はまだありません。</div>';

 return groups.map(g=>{
  const p=g.parent,parentTags=normalizeTags(p.tags);
  const status=p.status||"実施";
  const startDate=Number(g.firstSession||g.parentDate||p.time||p.createdAt||Date.now());
  const lastDate=Number(g.lastSession||startDate);
  const dayBlocks=g.days.map((day,i)=>{
    const dayEntries=g.entries.filter(e=>e.dayId===day.id);
    const dayTags=normalizeTags(day.tags);
    const entryTags=dayEntries.flatMap(e=>normalizeTags(e.tags));
    const mergedTags=normalizeTags([...parentTags,...dayTags,...entryTags]);
    return `<details class="listitem trpg-day-toggle">
      <summary>
        <span><b>${esc(day.label||day.name||`${i+1}日目`)}</b> <span class="small">${fmt(Number(day.time||day.createdAt||Date.now()))}</span></span>
        <span class="small">${dayEntries.length}件</span>
      </summary>
      <div style="margin-top:8px">
        ${mergedTags.length?`<div class="wrap" style="margin-bottom:7px">${mergedTags.map(t=>`<span class="badge">#${esc(t)}</span>`).join("")}</div>`:""}
        ${dayEntries.length?dayEntries.map(e=>`<div class="card">
          <div class="row"><b>${esc(e.title||e.entryType||"記録")}</b><span class="badge">${esc(e.entryType||"記録")}</span></div>
          ${e.text?`<p>${nl(e.text)}</p>`:""}
          ${e.url?mediaPreview(e.url):""}
        </div>`).join(""):'<div class="empty">この日の子記録はありません。</div>'}
      </div>
    </details>`;
  }).join("");

  return `<details class="card trpg-parent-toggle">
    <summary>
      <span><b>${esc(p.name||"無題")}</b> <span class="badge gold">${esc(status)}</span></span>
      <span class="small">開始 ${fmt(startDate)} ／ 最終 ${fmt(lastDate)} ／ 全${g.days.length}日</span>
    </summary>
    <div style="margin-top:10px">
      ${parentTags.length?`<div class="wrap" style="margin-bottom:9px">${parentTags.map(t=>`<span class="badge gold">#${esc(t)}</span>`).join("")}</div>`:""}
      ${(p.participantLinks||[]).length?`<div class="small" style="margin-bottom:9px"><b>参加者：</b>${(p.participantLinks||[]).map(l=>{const person=personById(load(),l.personId),ch=characterById(load(),l.characterId);return `${esc(person?.name||"未指定")}${ch?`（${esc(ch.name)}）`:""} [${esc(l.role||"PL")}]`}).join(" ／ ")}</div>`:""}
      ${dayBlocks||'<div class="empty">子ページはまだありません。</div>'}
    </div>
  </details>`;
 }).join("");
}

function trpgStandaloneHtml(role){
 const all=(load().records||[])
   .filter(x=>getClassification(x)==="TRPG")
   .filter(x=>role==="kp"?isKpRecord(x):!isKpRecord(x))
   .sort((a,b)=>b.time-a.time);
 if(!all.length)return "";
 return `<details class="card" style="margin-top:14px">
   <summary><b>単独記録 ${all.length}件</b></summary>
   <div style="margin-top:10px">${all.map(x=>`<div class="card">
     <div class="row"><div><b>${esc(x.title||"無題")}</b><div class="time">${fmt(x.time)}</div></div><div class="wrap">${normalizeTags(x.tags).map(t=>`<span class="badge">#${esc(t)}</span>`).join("")}</div></div>
     ${x.text?`<p>${nl(x.text)}</p>`:""}${x.url?mediaPreview(x.url):""}
   </div>`).join("")}</div>
 </details>`;
}

function renderTRPG(){
 if($("trpgList"))$("trpgList").innerHTML=trpgParentHistoryHtml("pl")+trpgStandaloneHtml("pl");
 if($("trpgKpList"))$("trpgKpList").innerHTML=trpgParentHistoryHtml("kp")+trpgStandaloneHtml("kp");
}



const COC_INITIAL_SKILLS={
 "6":[
  ["キック",25],["組みつき",25],["こぶし",50],["こぶし/パンチ",50],["頭突き",10],["投擲",25],["マーシャルアーツ",1],
  ["拳銃",20],["サブマシンガン",15],["ショットガン",30],["マシンガン",15],["ライフル",25],
  ["応急手当",30],["鍵開け",1],["隠す",15],["隠れる",10],["聞き耳",25],["忍び歩き",10],["写真術",10],["精神分析",1],["追跡",10],["登攀",40],["図書館",25],["目星",25],
  ["運転",20],["機械修理",20],["重機械操作",1],["乗馬",5],["水泳",25],["製作",5],["操縦",1],["跳躍",25],["電気修理",10],["ナビゲート",10],["変装",1],
  ["言いくるめ",5],["信用",15],["説得",15],["値切り",5],["医学",5],["オカルト",5],["化学",1],["芸術",5],["経理",10],["考古学",1],["コンピューター",1],["心理学",5],["人類学",1],["生物学",1],["地質学",1],["電子工学",1],["天文学",1],["博物学",10],["物理学",1],["法律",5],["薬学",1],["歴史",20]
 ],
 "7":[
  ["威圧",15],["医学",1],["運転",20],["応急手当",30],["オカルト",5],["回避",null,"DEX/2"],["科学",1],["鍵開け",1],["鑑定",5],["機械修理",10],["聞き耳",20],["近接戦闘",25],["近接戦闘（格闘）",25],["クトゥルフ神話",0],
  ["芸術/製作",5],["経理",5],["考古学",1],["コンピューター",5],["サバイバル",10],["自然",10],["射撃",20],["射撃（拳銃）",20],["重機械操作",1],["乗馬",5],["信用",0],["心理学",10],["人類学",1],["水泳",20],["精神分析",1],["説得",10],["操縦",1],["跳躍",20],["追跡",10],["手さばき",10],["電気修理",10],["図書館",20],["投擲",20],["登攀",20],["ナビゲート",10],["変装",5],["法律",5],["魅惑",15],["目星",25],["歴史",5],["言いくるめ",5],["母国語",null,"EDU"]
 ]
};
function normSkillName(s){return String(s||"").replace(/[〈〉<>【】［］\[\]\s]/g,"").replace(/：/g,":").toLowerCase()}
function kpRoot(d=load()){d.kpTools=d.kpTools||{overrides:[],notes:[]};d.kpTools.overrides=d.kpTools.overrides||[];d.kpTools.notes=d.kpTools.notes||[];return d.kpTools}
function skillInitialValue(skill,edition){
 const d=load(),root=kpRoot(d),key=normSkillName(skill);
 const ov=(root.overrides||[]).slice().reverse().find(x=>x.edition===String(edition)&&normSkillName(x.skill)===key);
 if(ov)return {value:Number(ov.value),source:"卓用上書き"};
 const rows=COC_INITIAL_SKILLS[String(edition)]||[];
 let hit=rows.find(x=>normSkillName(x[0])===key);
 if(!hit){
  hit=rows.find(x=>{
   const base=normSkillName(x[0]);
   return key.startsWith(base+"(")||key.startsWith(base+"（")||base.startsWith(key+"(");
  });
 }
 return hit?{value:hit[1],formula:hit[2]||"",source:"初期値表"}:null;
}
function markInitialGrowth(rows){
 const ed=$("trpgEdition")?.value||"6",enabled=!!$("trpgInitialGrowth")?.checked;
 for(const x of rows){
  const iv=skillInitialValue(x.skill,ed);
  x.initialValue=iv?.value??null;x.initialFormula=iv?.formula||"";
  x.initialSuccess=!!(enabled&&iv&&iv.value!==null&&Number(x.target)===Number(iv.value)&&["成功","決定的成功","スペシャル"].includes(x.result));
  if(x.initialSuccess&&!x.manualGrowth)x.growth=true;
 }
}
function renderKPSkills(){
 if(!$("kpSkillList"))return;
 const ed=$("kpEdition").value,q=normSkillName($("kpSkillSearch").value),rows=(COC_INITIAL_SKILLS[ed]||[]).filter(x=>!q||normSkillName(x[0]).includes(q));
 $("kpSkillList").innerHTML=rows.length?`<div style="overflow:auto"><table class="dice-table"><thead><tr><th>技能</th><th>初期値</th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${esc(x[0])}</b></td><td>${x[1]===null?`能力値依存（${esc(x[2]||"")})`:`${x[1]}%`}</td></tr>`).join("")}</tbody></table></div>`:'<div class="empty">該当する技能がありません。</div>';
}
function renderKPOverrides(){
 if(!$("kpOverrideList"))return;const d=load(),a=kpRoot(d).overrides||[];
 $("kpOverrideList").innerHTML=a.length?a.slice().reverse().map(x=>`<div class="listitem"><div class="row"><div><b>${esc(x.skill)}</b><div class="small">${esc(x.edition)}版 ／ 初期値 ${x.value}%</div></div><button class="danger kpOverrideDelete" data-id="${x.id}">削除</button></div></div>`).join(""):'<div class="empty">卓用上書きはありません。</div>';
 document.querySelectorAll(".kpOverrideDelete").forEach(b=>b.onclick=()=>{const d=load(),r=kpRoot(d);r.overrides=r.overrides.filter(x=>x.id!==b.dataset.id);save(d);renderKPOverrides()});
}
function renderKPNotes(){
 if(!$("kpChecklistList"))return;const d=load(),a=kpRoot(d).notes||[];
 $("kpChecklistList").innerHTML=a.length?a.slice().reverse().map(n=>`<div class="card"><div class="row"><div><b>${esc(n.session||"KPメモ")}</b><div class="small">${esc(n.scene||"")} ／ ${fmt(n.time)}</div></div><button class="danger kpNoteDelete" data-id="${n.id}">削除</button></div>${(n.items||[]).map(i=>`<label class="checkline"><input class="kpNoteCheck" type="checkbox" data-note="${n.id}" data-item="${i.id}" ${i.done?"checked":""}> <span class="${i.done?"checkDone":""}">${esc(i.text)}</span></label>`).join("")}</div>`).join(""):'<div class="empty">KPメモはまだありません。</div>';
 document.querySelectorAll(".kpNoteCheck").forEach(c=>c.onchange=()=>{const d=load(),n=kpRoot(d).notes.find(x=>x.id===c.dataset.note),i=n?.items.find(x=>x.id===c.dataset.item);if(i){i.done=c.checked;save(d);renderKPNotes()}});
 document.querySelectorAll(".kpNoteDelete").forEach(b=>b.onclick=()=>{if(!confirm("このKPメモを削除しますか？"))return;const d=load(),r=kpRoot(d);r.notes=r.notes.filter(x=>x.id!==b.dataset.id);save(d);renderKPNotes()});
}
function renderKPTools(){renderKPSkills();renderKPOverrides();renderKPNotes()}
let currentDiceResults=[];
let currentDiceTotalResults=[];
let currentSourceRange={lines:[],start:0,end:0,startFound:false,endFound:false,startMark:"",endMark:""};
function stripTRPGHtml(raw){const doc=new DOMParser().parseFromString(raw,"text/html");return (doc.body?.innerText||raw).replace(/\r/g,"")}
function selectedGrowthResults(){return new Set([...document.querySelectorAll(".growthRule:checked")].map(x=>x.value))}
function resultRank(text){const s=String(text||"");if(/致命的失敗|ファンブル/i.test(s))return "致命的失敗";if(/決定的成功|クリティカル/i.test(s))return "決定的成功";if(/スペシャル/i.test(s))return "スペシャル";if(/成功/i.test(s))return "成功";if(/失敗/i.test(s))return "失敗";return s.trim()||"不明"}
function resultClass(r){if(r==="決定的成功"||r==="スペシャル")return "result-critical";if(r==="致命的失敗")return "result-fumble";if(r==="成功")return "result-success";return "result-failure"}
function selectLogRange(raw){
 const all=String(raw||"").replace(/\r/g,"").split("\n"),startMark=$("trpgStartMarker").value.trim(),endMark=$("trpgEndMarker").value.trim();
 let start=0,end=all.length,startFound=!startMark,endFound=!endMark;
 if(startMark){const i=all.findIndex(x=>x.includes(startMark));if(i>=0){start=i;startFound=true}}
 if(endMark){const i=all.findIndex((x,n)=>n>start&&x.includes(endMark));if(i>=0){end=i;endFound=true}}
 if(end<start)end=all.length;
 currentSourceRange={lines:all.slice(start,end),start,end,startFound,endFound,startMark,endMark};return currentSourceRange;
}
function parseDiceLines(lineObjects){
 let speaker="不明";const out=[],commandRe=/(?:CCB|CC|CBR|RESB|1D100)\s*(?:<=?|≦)\s*(\d+)?/i,rollRe=/[＞>]\s*(\d+)\s*[＞>]\s*([^\n]+)$/;
 const isDiceLine=line=>commandRe.test(line)&&rollRe.test(line),rules=selectedGrowthResults();
 const lines=lineObjects.map((x,idx)=>typeof x==="string"?{text:x.trim(),sourceLine:idx+1}:{text:String(x.text||"").trim(),sourceLine:x.sourceLine||idx+1}).filter(x=>x.text);
 for(let i=0;i<lines.length;i++){
  const lineObj=lines[i],line=lineObj.text,prefix=line.match(/^(.+?)\s+-\s+(?:昨日|今日|\d{1,2}:\d{2}|\d{4}[\/.-]\d{1,2})/);if(prefix)speaker=prefix[1].trim();
  if(!isDiceLine(line)){if(i+1<lines.length&&isDiceLine(lines[i+1].text)&&!/^(KP|system|システム)$/i.test(line)&&line.length<80)speaker=line.replace(/\s+-.*$/,"").trim();continue}
  const command=line.match(commandRe),rollMatch=line.match(rollRe),target=Number(command?.[1])||null,roll=Number(rollMatch?.[1]),result=resultRank(rollMatch?.[2]||"");
  let skill="";const brackets=[...line.matchAll(/【([^】]+)】/g)];if(brackets.length)skill=brackets[brackets.length-1][1].trim();
  if(!skill){const beforeRoll=line.slice(0,rollMatch.index),afterCommand=beforeRoll.slice((command.index||0)+command[0].length).replace(/\([^)]*\)/g," ").replace(/[：:＝=<>＜＞]/g," ").trim();if(afterCommand)skill=afterCommand.split(/\s{2,}|\t/)[0].trim()}
  if(!skill)skill="技能名を取得できず";
  out.push({id:uid(),speaker,skill,target,roll,result,raw:line,sourceLine:lineObj.sourceLine,growth:rules.has(result),manualGrowth:false});
 }
 return out;
}
function parseDiceLog(raw){
 const range=selectLogRange(raw);
 return parseDiceLines(range.lines.map((text,idx)=>({text,sourceLine:range.start+idx+1})));
}
function parseDiceLogTotal(raw){
 const all=String(raw||"").replace(/\r/g,"").split("\n");
 return parseDiceLines(all.map((text,idx)=>({text,sourceLine:idx+1})));
}
function renderSourcePreview(){
 const r=currentSourceRange,box=$("trpgSourcePreview"),sum=$("trpgRangeSummary");
 if(!r.lines.length){sum.textContent="解析対象の範囲が空です。目印を確認してください。";box.innerHTML='<div class="empty">表示できる行がありません。</div>';$("trpgJumpFirst").disabled=true;return}
 const hitLines=new Set(currentDiceResults.map(x=>x.sourceLine)),startText=r.startMark?(r.startFound?`開始目印を ${r.start+1} 行目で確認`:`開始目印「${esc(r.startMark)}」が見つからず、先頭から解析`):"先頭から解析",endText=r.endMark?(r.endFound?`終了目印の直前 ${r.end} 行目まで`:`終了目印「${esc(r.endMark)}」が見つからず、末尾まで解析`):"末尾まで解析";
 sum.innerHTML=`<b>${startText}</b> ／ <b>${endText}</b><br><span class="small">対象：${r.lines.length}行・判定抽出：${currentDiceResults.length}件</span>`;
 box.innerHTML=r.lines.map((line,i)=>{const no=r.start+i+1,hit=hitLines.has(no);return `<div id="sourceLine${no}" class="source-line ${hit?'hit dice':''}"><span class="line-no">${no}</span><span>${esc(line)||'&nbsp;'}</span></div>`}).join("");$("trpgJumpFirst").disabled=!currentDiceResults.length;
}
function filteredDiceResults(){
 let a=currentDiceResults.slice(),ch=$("trpgCharacterFilter").value,res=$("trpgResultFilter").value;if(ch)a=a.filter(x=>x.speaker===ch);if(res)a=a.filter(x=>x.result===res);if($("trpgGrowthOnly").checked)a=a.filter(x=>x.growth);
 if($("trpgMergeSkills").checked){const map=new Map();for(const x of a){const k=x.speaker+"\u0000"+x.skill;if(!map.has(k))map.set(k,{...x,count:1,rolls:[x.roll],results:[x.result],sourceIds:[x.id]});else{const y=map.get(k);y.count++;y.rolls.push(x.roll);y.results.push(x.result);y.sourceIds.push(x.id);y.growth=y.growth||x.growth}}a=[...map.values()]}
 return a;
}

function critFumbleBySpeaker(results){
 const map=new Map();
 for(const r of results){
  const name=r.speaker||"不明",skill=r.skill||"技能名不明";
  const rolls=Array.isArray(r.rolls)?r.rolls:[r.roll];
  const resultList=Array.isArray(r.results)?r.results:[r.result];
  for(let i=0;i<resultList.length;i++){
   const result=resultList[i],roll=rolls[i]??rolls[0];
   if(result!=="決定的成功"&&result!=="致命的失敗")continue;
   if(!map.has(name))map.set(name,{speaker:name,critical:0,fumble:0,total:0,criticalSkills:{},fumbleSkills:{}});
   const x=map.get(name),bucket=result==="決定的成功"?x.criticalSkills:x.fumbleSkills;
   if(!bucket[skill])bucket[skill]=[];
   if(Number.isFinite(Number(roll)))bucket[skill].push(Number(roll));
   if(result==="決定的成功")x.critical++;else x.fumble++;
   x.total++;
  }
 }
 return [...map.values()].sort((a,b)=>b.total-a.total||a.speaker.localeCompare(b.speaker,"ja"));
}
function critFumbleSkillHtml(obj,label){
 const entries=Object.entries(obj||{});
 if(!entries.length)return `<div class="small">${label}なし</div>`;
 return entries.map(([skill,rolls])=>`<div class="listitem" style="margin:6px 0;padding:9px"><b>${esc(skill)}</b><div class="small">出目：${rolls.join(", ")}</div></div>`).join("");
}
function renderCritFumbleSummary(targetId,results){
 const rows=critFumbleBySpeaker(results);
 const critical=rows.reduce((n,x)=>n+x.critical,0),fumble=rows.reduce((n,x)=>n+x.fumble,0),total=critical+fumble;
 $(targetId).innerHTML=`<div class="wrap" style="margin-bottom:8px"><span class="badge gold">クリティカル ${critical}</span><span class="badge">ファンブル ${fumble}</span><span class="badge green">合計 ${total}</span></div>${rows.length?rows.map(x=>`<details class="listitem"><summary><span><b>${esc(x.speaker)}</b></span><span class="wrap"><span class="badge gold">クリ ${x.critical}</span><span class="badge">ファン ${x.fumble}</span></span></summary><div class="grid2" style="margin-top:8px"><div><b>✨ クリティカル ${x.critical}回</b>${critFumbleSkillHtml(x.criticalSkills,"クリティカル")}</div><div><b>💥 ファンブル ${x.fumble}回</b>${critFumbleSkillHtml(x.fumbleSkills,"ファンブル")}</div></div></details>`).join(""):'<div class="empty">クリティカル／ファンブルはありません。</div>'}`;
}

function growthExcludedSkillSet(){return new Set(String($("trpgGrowthExcludeSkills")?.value||"").split(/\r?\n|,/).map(x=>x.trim().toLowerCase()).filter(Boolean))}
function isAbilityGrowthRoll(skill){
 const s=String(skill||"").trim().toUpperCase().replace(/\s+/g," ");
 return /^(STR|CON|POW|DEX|APP|SIZ|INT|EDU)(?:\s*[×X*]\s*\d+(?:\.\d+)?)?$/.test(s);
}
function growthAutoExcluded(x){
 if($("trpgExcludeAbilityGrowth")?.checked&&isAbilityGrowthRoll(x.skill))return "能力値ロール";
 if(growthExcludedSkillSet().has(String(x.skill||"").trim().toLowerCase()))return "除外技能";
 return "";
}
function applyGrowthExclusions(results=currentDiceResults){
 for(const x of results){
  const reason=x.manualExcluded?"個別除外":growthAutoExcluded(x);
  x.growthExcluded=!!reason;x.growthExcludeReason=reason;
  if(reason)x.growth=false;
 }
}
function renderDiceResults(){
 applyGrowthExclusions(currentDiceResults);
 const a=filteredDiceResults(),growthCount=currentDiceResults.filter(x=>x.growth).length;$("trpgAnalyzeSummary").innerHTML=`抽出：<b>${currentDiceResults.length}件</b> ／ 表示：<b>${a.length}件</b> ／ 成長候補：<b>${growthCount}件</b>`;$("trpgCopyResults").disabled=!a.length;$("trpgSaveAnalysis").disabled=!currentDiceResults.length;
 if(!a.length){$("trpgResults").innerHTML='<div class="empty">条件に一致する判定はありません。</div>';return}
 $("trpgResults").innerHTML=`<div style="overflow:auto"><table class="dice-table"><thead><tr><th>人物</th><th>技能</th><th>目標</th><th>出目</th><th>結果</th><th>元ログ</th><th>成長候補</th></tr></thead><tbody>${a.map(x=>`<tr class="${resultClass(x.result)}"><td>${esc(x.speaker)}</td><td><b>${esc(x.skill)}</b>${x.initialSuccess?`<div class="badge green">🌱 初期値成功</div>`:""}${x.growthExcluded?`<div class="badge">🚫 ${esc(x.growthExcludeReason)}</div>`:""}${x.initialFormula&&x.initialValue===null?`<div class="small">初期値：${esc(x.initialFormula)}（上書き未設定）</div>`:""}${x.count?`<div class="small">${x.count}回</div>`:""}</td><td>${x.target??"-"}</td><td>${x.rolls?x.rolls.join(", "):x.roll}</td><td>${x.results?x.results.map(esc).join("・"):esc(x.result)}</td><td>${x.sourceLine?`<button class="ghost raw-toggle jumpSource" data-line="${x.sourceLine}">${x.sourceLine}行</button>`:"-"}</td><td>${x.count?`<span class="badge ${x.growth?"green":""}">${x.growth?"候補あり":"候補なし"}</span>`:`<label class="checkline" style="margin:0"><input class="diceGrowthToggle" type="checkbox" data-id="${x.id}" ${x.growth?"checked":""}> 候補</label><button class="ghost diceGrowthExclude" data-id="${x.id}" style="margin-top:5px">${x.manualExcluded?"除外を解除":"この判定を除外"}</button>`}</td></tr>`).join("")}</tbody></table></div>`;
 document.querySelectorAll(".jumpSource").forEach(b=>b.onclick=()=>{$("sourceLine"+b.dataset.line)?.scrollIntoView({behavior:"smooth",block:"center"})});
 document.querySelectorAll(".diceGrowthToggle").forEach(c=>c.onchange=()=>{const row=currentDiceResults.find(v=>v.id===c.dataset.id);if(row){row.growth=c.checked;row.manualGrowth=true;if(c.checked)row.manualExcluded=false;renderDiceResults()}});
 document.querySelectorAll(".diceGrowthExclude").forEach(b=>b.onclick=()=>{const row=currentDiceResults.find(v=>v.id===b.dataset.id);if(!row)return;row.manualExcluded=!row.manualExcluded;if(row.manualExcluded){row.growth=false;row.manualGrowth=true}else{row.manualGrowth=false;row.growth=selectedGrowthResults().has(row.result);markInitialGrowth([row])}renderDiceResults()});
}

function diceSpeakerName(x){return String(x?.name||x?.speaker||x?.character||"").trim()}
function renderSkillOnlySpeakers(){
 if(!$("trpgSkillOnlySpeakers"))return;const names=[];
 for(const x of currentDiceResults){const n=diceSpeakerName(x);if(n&&!names.includes(n))names.push(n)}
 const selected=new Set([...document.querySelectorAll(".trpgSkillOnlySpeaker:checked")].map(x=>x.value));
 $("trpgSkillOnlySpeakers").innerHTML=names.length?names.map(n=>`<label class="checkline"><input class="trpgSkillOnlySpeaker" type="checkbox" value="${esc(n)}" ${selected.has(n)?"checked":""}> ${esc(n)}</label>`).join(""):'<span class="small">ログを解析すると発言者が表示されます。</span>';
}
function makeSkillOnlyOutput(){
 const selected=new Set([...document.querySelectorAll(".trpgSkillOnlySpeaker:checked")].map(x=>x.value));if(!selected.size)return alert("発言者を選択してください。");
 const unique=$("trpgSkillOnlyUnique").checked,order=$("trpgSkillOnlyOrder").value;
 if(order==="appearance"){const seen=new Set(),lines=[];for(const x of currentDiceResults){const n=diceSpeakerName(x);if(!selected.has(n)||!x.skill)continue;const k=n+"\u0000"+x.skill;if(unique&&seen.has(k))continue;seen.add(k);lines.push(`${n}：${x.skill}`)}$("trpgSkillOnlyOutput").value=lines.join("\n");return}
 const groups=new Map();for(const x of currentDiceResults){const n=diceSpeakerName(x);if(!selected.has(n)||!x.skill)continue;if(!groups.has(n))groups.set(n,[]);const a=groups.get(n);if(!unique||!a.includes(x.skill))a.push(x.skill)}
 $("trpgSkillOnlyOutput").value=[...groups].map(([n,a])=>`${n}\n${a.join("\n")}`).join("\n\n");
}
function applyGrowthRules(){const rules=selectedGrowthResults();currentDiceResults.forEach(x=>{if(!x.manualGrowth)x.growth=rules.has(x.result)});markInitialGrowth(currentDiceResults);applyGrowthExclusions(currentDiceResults);renderDiceResults()}
function analyzeTRPG(){const raw=$("trpgLogText").value;currentDiceResults=parseDiceLog(raw);currentDiceTotalResults=parseDiceLogTotal(raw);markInitialGrowth(currentDiceResults);markInitialGrowth(currentDiceTotalResults);applyGrowthExclusions(currentDiceResults);applyGrowthExclusions(currentDiceTotalResults);const names=[...new Set(currentDiceResults.map(x=>x.speaker))].sort();$("trpgCharacterFilter").innerHTML='<option value="">全員</option>'+names.map(x=>`<option>${esc(x)}</option>`).join("");renderDiceResults();renderSourcePreview();renderCritFumbleSummary("trpgRangeCritFumble",currentDiceResults);renderCritFumbleSummary("trpgTotalCritFumble",currentDiceTotalResults);if((currentSourceRange.startMark&&!currentSourceRange.startFound)||(currentSourceRange.endMark&&!currentSourceRange.endFound))alert("指定した区切りの目印が一部見つかりませんでした。抽出範囲の確認欄を確認してください。");if(!currentDiceResults.length)alert("技能判定を見つけられませんでした。ログ形式を確認してください.")}
function saveTRPGAnalysis(){if(!currentDiceResults.length)return;const d=load();d.trpgAnalyses=d.trpgAnalyses||[];d.trpgAnalyses.push({id:uid(),campaign:$("trpgCampaign").value.trim()||"単発・未分類",scenario:$("trpgScenario").value.trim()||"区切り未設定",time:Date.now(),growthRules:[...selectedGrowthResults()],growthExclusions:{abilityRolls:!!$("trpgExcludeAbilityGrowth")?.checked,skills:[...growthExcludedSkillSet()]},range:{startMarker:$("trpgStartMarker").value.trim(),endMarker:$("trpgEndMarker").value.trim(),start:currentSourceRange.start,end:currentSourceRange.end,lines:currentSourceRange.lines},results:currentDiceResults.map(x=>({...x})),criticalFumble:{range:critFumbleBySpeaker(currentDiceResults),scenario:critFumbleBySpeaker(currentDiceTotalResults)}});save(d);renderSavedDiceAnalyses();alert("解析結果を保存しました。")}
function renderSavedDiceAnalyses(){
 const d=load(),a=(d.trpgAnalyses||[]).slice().sort((x,y)=>y.time-x.time);$("trpgAnalysisList").innerHTML=a.length?a.map(x=>{const growth=(x.results||[]).filter(r=>r.growth).length;return `<div class="card"><div class="row"><div><b>${esc(x.campaign)}</b><div class="small">${esc(x.scenario)} ／ ${fmt(x.time)}</div></div><span class="badge gold">${(x.results||[]).length}件・候補${growth}件</span></div><div class="small">成長ルール：${(x.growthRules||[]).map(esc).join("・")||"なし"}</div><div class="wrap" style="margin-top:8px"><button class="secondary savedDiceCopy" data-id="${x.id}">コピー</button><button class="danger savedDiceDelete" data-id="${x.id}">削除</button></div></div>`}).join(""):'<div class="empty">保存済み解析はまだありません。</div>';
 document.querySelectorAll(".savedDiceCopy").forEach(b=>b.onclick=async()=>{const d=load(),x=(d.trpgAnalyses||[]).find(v=>v.id===b.dataset.id);if(!x)return;const text=(x.results||[]).map(r=>`${r.speaker}｜${r.skill}｜${r.target??"-"}｜${r.roll}｜${r.result}${r.growth?"｜成長候補":""}`).join("\n");try{await navigator.clipboard.writeText(text);b.textContent="コピーしました";setTimeout(()=>b.textContent="コピー",900)}catch{alert("コピーできませんでした")}});
 document.querySelectorAll(".savedDiceDelete").forEach(b=>b.onclick=()=>{if(!confirm("この保存済み解析を削除しますか？"))return;const d=load();d.trpgAnalyses=(d.trpgAnalyses||[]).filter(v=>v.id!==b.dataset.id);save(d);renderSavedDiceAnalyses()});
 renderSkillOnlySpeakers();
}
function renderToolChecklists(){const d=load();$("toolChecklistList").innerHTML=d.toolChecklists.length?d.toolChecklists.map(list=>`<div class="card"><div class="row"><b>${esc(list.name)}</b><div class="wrap"><span class="badge">${(list.items||[]).filter(i=>i.done).length}/${(list.items||[]).length}</span><button class="danger deleteToolChecklist" data-id="${list.id}">削除</button></div></div>${(list.items||[]).map(item=>`<div class="listitem"><label style="margin:0;color:var(--text)"><input class="toolChecklistCheck" data-list="${list.id}" data-item="${item.id}" type="checkbox" style="width:auto" ${item.done?"checked":""}> ${esc(item.name)}</label></div>`).join("")}</div>`).join(""):'<div class="empty">自由チェックリストはまだありません。</div>';document.querySelectorAll(".toolChecklistCheck").forEach(c=>c.onchange=()=>{const d=load(),list=d.toolChecklists.find(x=>x.id===c.dataset.list),item=list?.items.find(x=>x.id===c.dataset.item);if(item){item.done=c.checked;save(d);renderToolChecklists()}});document.querySelectorAll(".deleteToolChecklist").forEach(b=>b.onclick=()=>{if(confirm("このチェックリストを削除しますか？")){const d=load();d.toolChecklists=d.toolChecklists.filter(x=>x.id!==b.dataset.id);save(d);renderToolChecklists()}})}


function trpgDayCards(role){
 const d=load(),rows=[];
 d.historyItems.filter(i=>i.category==="TRPG").forEach(item=>{
  const ev=d.historyEvents.filter(e=>e.itemId===item.id&&e.status!=="取消").sort((a,b)=>a.time-b.time);
  ev.forEach((e,i)=>rows.push({item,e,day:i+1}));
 });
 rows.sort((a,b)=>b.e.time-a.e.time);
 const filtered=rows.filter(r=>{
  const s=(r.item.name+" "+(r.e.note||"")+" "+(r.item.tags||[]).join(" ")).toLowerCase();
  return role==="kp"?/kp|キーパー/.test(s):!/kp|キーパー/.test(s);
 });
 return filtered.map(r=>`<div class="card ${statusClass(r.e.status)}"><div class="row"><b>${esc(r.item.name)}</b><span class="badge gold">${r.day}日目</span></div><div class="time">${fmt(r.e.time)}</div><div>${esc(statusLabel(r.e.status))}${r.e.minutes?`・${formatDuration(r.e.minutes)}`:""}</div><p>${nl(r.e.note||"")}</p></div>`).join("")||'<div class="empty">旧セッション履歴はありません。</div>';
}
function renderTrpgDays(){
 if($("trpgSessionPl")){
  const stack=renderTrpgStackTimeline("pl");
  const legacy=trpgDayCards("pl");
  $("trpgSessionPl").innerHTML=stack+(legacy.includes("旧セッション履歴はありません")?"":`<details class="card"><summary>旧セッション履歴</summary>${legacy}</details>`);
 }
 if($("trpgSessionKp")){
  const stack=renderTrpgStackTimeline("kp");
  const legacy=trpgDayCards("kp");
  $("trpgSessionKp").innerHTML=stack+(legacy.includes("旧セッション履歴はありません")?"":`<details class="card"><summary>旧セッション履歴</summary>${legacy}</details>`);
 }
}

function renderSettings(){const d=load();$("guideUrl").value=d.settings.guideUrl;$("youtubeUrl").value=d.settings.youtubeUrl;$("ruleView").innerHTML=Object.entries(rules).map(([k,v])=>`<div class="listitem"><b>${k}</b><div class="small">${v.join("・")}</div></div>`).join("")}
function safeRender(name,fn){try{fn()}catch(e){console.error("Life Archive render error:",name,e);const st=$("saveStatus");if(st)st.textContent=`⚠ ${name}表示エラー（他の画面は継続）`;}}
function render(){
 safeRender("日付アーカイブ",renderDateArchive);
 safeRender("今日",renderHome);
 safeRender("受信箱",renderInbox);
 safeRender("記録庫",renderRecords);
 safeRender("親子詳細",renderStacks);
 safeRender("履歴",renderHistory);
 safeRender("買い物",renderShopping);
 safeRender("料理図鑑",renderCooking);
 safeRender("FF14",renderFF14);
 safeRender("家計簿",()=>{renderBudgetDraftItems();renderBudget()});
safeRender("火力計算機",()=>{applyFoodPreset();applyPotionPreset();renderDamageGear();renderDamageCalc();renderDamageHistory()});
 safeRender("収集図鑑",renderFFXIVCollectHub);
 safeRender("入手・交換品図鑑",renderFFAcquisition);
 safeRender("バイカラージェム",renderBicolor);
 safeRender("データ引き継ぎ確認",renderPersistenceTest);
 safeRender("ギルドリーヴ",renderGuildleves);
 safeRender("妖怪ウォッチ",renderYokai);
 safeRender("バックアップ状態",renderBackupStatus);
 safeRender("武器制作",renderWeapons);
 safeRender("TRPG",renderTRPG);
 safeRender("人物・PC図鑑",renderPeopleCodex);
 safeRender("所持シナリオ",renderScenarioLibrary);
 safeRender("TRPG素材庫",renderTRPGAssets);
 safeRender("KP使用素材",renderKPAssetUsage);
 safeRender("今日",renderTodayHub);
 safeRender("時間記録",renderActivityLog);
 safeRender("ダイス解析",renderSavedDiceAnalyses);
 safeRender("KP補助",renderKPTools);
 safeRender("チェックメモ",renderToolChecklists);
 safeRender("設定",renderSettings);
}
function openTemplate(t,q){if(!q.trim()){alert("検索語を入力してください");return}window.open(t.replace("{query}",encodeURIComponent(q.trim())),"_blank","noopener")}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{if(b.dataset.view==="records")currentRecordCategoryFilter="";
 switchView(b.dataset.view);
 if(b.dataset.view==="records"&&$("adventureRecordNotice"))$("adventureRecordNotice").style.display="none";
});

const LA_LAST_KP_KEY="life_archive_last_sakumeru_kp_v1";
function loadLaLastKp(){
 try{
   const x=JSON.parse(localStorage.getItem(LA_LAST_KP_KEY)||"null");
   if(x?.url&&x.url.includes("https://pp-hibithx.github.io/sakumeru/")){
     x.url=x.url.replace("https://pp-hibithx.github.io/sakumeru/","https://pp-hibithx.github.io/sakumeru/");
     localStorage.setItem(LA_LAST_KP_KEY,JSON.stringify(x));
   }
   return x;
 }catch{return null}
}
function saveLaLastKp(x){
 if(!x||!x.scenarioId||!x.url)return;
 try{localStorage.setItem(LA_LAST_KP_KEY,JSON.stringify(x))}catch{}
 renderLaLastKp();
}
function renderLaLastKp(){
 const btn=$("sakumeruLastKp"),x=loadLaLastKp();
 if(!btn)return;
 if(!x?.url){btn.hidden=true;return}
 btn.hidden=false;
 btn.textContent=x.scenarioTitle?`KP：${x.scenarioTitle}`:"KPバインダーへ";
 btn.title=x.scenarioTitle?`最後に開いた「${x.scenarioTitle}」へ移動`:"最後に開いたKPバインダーへ移動";
}
window.addEventListener("message",e=>{
 if(e.origin!=="https://pp-hibithx.github.io")return;
 const d=e.data;
 if(!d||d.type!=="sakumeru:last-kp-binder")return;
 saveLaLastKp({
   scenarioId:String(d.scenarioId||""),
   scenarioTitle:String(d.scenarioTitle||"シナリオ"),
   openedAt:String(d.openedAt||new Date().toISOString()),
   url:String(d.url||"")
 });
});
if($("sakumeruLastKp"))$("sakumeruLastKp").onclick=()=>{
 const f=$("sakumeruFrame"),x=loadLaLastKp();
 if(!f||!x?.url)return;
 f.src=x.url+(x.url.includes("?")?"&":"?")+"la_open="+Date.now();
};
if($("sakumeruReload"))$("sakumeruReload").onclick=()=>{
 const f=$("sakumeruFrame");if(!f)return;
 const base=(f.dataset.src||"https://pp-hibithx.github.io/sakumeru/").split("?")[0];
 f.src=base+"?la_refresh="+Date.now();
};
if($("sakumeruOpenExternal"))$("sakumeruOpenExternal").onclick=()=>window.open("https://pp-hibithx.github.io/sakumeru/","_blank","noopener");
renderLaLastKp();

document.querySelectorAll(".trpgToolJump").forEach(b=>b.onclick=()=>switchView(b.dataset.viewTarget));
document.querySelectorAll(".nav-anchor").forEach(b=>b.onclick=()=>{if(b.dataset.view==="records")currentRecordCategoryFilter=b.dataset.recordType||"";
 const view=b.dataset.view;
 switchView(view,{anchor:b.dataset.anchor||""});
 if(b.dataset.recordType&&$("recordFilter")){
  $("recordFilter").value=b.dataset.recordType;
  renderRecords();
  if($("adventureRecordNotice")){
   const isAdventure=b.dataset.recordType==="FF14";
   $("adventureRecordNotice").style.display=isAdventure?"block":"none";
   if(isAdventure){
    const count=crossReferenceRecords(load()).filter(x=>getClassification(x)==="FF14").length;
    $("adventureRecordCount").textContent=`FF14分類の記録を ${count}件（単独＋親子）参照できます。`;
   }
  }
 }
 if(b.dataset.historyCategory&&$("historyCategoryFilter")){$("historyCategoryFilter").value=b.dataset.historyCategory;renderHistory()}
});
document.querySelectorAll(".nav-group").forEach(g=>{
 const ui=loadUI(),key=g.dataset.group;
 g.open=!!ui.groups?.[key];
 g.addEventListener("toggle",()=>{const state=loadUI(),groups={...(state.groups||{}),[key]:g.open};saveUI({groups})});
});
$("menuToggle").onclick=()=>{$("sidebar").classList.toggle("open");$("sidebarOverlay").classList.toggle("open")};
$("sidebarOverlay").onclick=closeSidebar;
$("quickSave").onclick=()=>{
 const value=$("quickText").value.trim();if(!value)return;
 addInbox(value,"",Date.now(),"",{title:value.split("\n")[0]});
 $("quickText").value="";
 if($("todayDate"))$("todayDate").value=localDateValue();
 renderTodayHub();
 switchView("inbox");
};
$("quickDetailed").onclick=()=>{switchView("inbox");$("captureDetails").open=true;$("captureTitle").focus()};
$("captureHasChecklist").onchange=()=>{$("captureChecklistArea").style.display=$("captureHasChecklist").checked?"block":"none"};
$("captureSave").onclick=()=>{
 const t=new Date($("captureTime").value).getTime()||Date.now(),items=checklistFromLines($("captureChecklistItems").value,[]);
 addInbox($("captureText").value,$("captureType").value,t,$("captureUrl").value.trim(),{title:$("captureTitle").value,status:$("captureStatus").value,destination:$("captureDestination").value,recordMode:$("captureRecordMode").value,tags:$("captureTags").value.split(/[,、]/).map(v=>v.trim()).filter(Boolean),checklist:$("captureHasChecklist").checked?items:[]});clearInboxDraft();
 $("captureTitle").value="";$("captureText").value="";$("captureUrl").value="";$("captureTags").value="";$("captureChecklistItems").value="";$("captureHasChecklist").checked=false;$("captureChecklistArea").style.display="none";
};
if($("captureTaskSave"))$("captureTaskSave").onclick=addTaskFromCapture;

$("stackDetailBack").onclick=()=>switchView("stacks");
$("stackDetailAddDay").onclick=()=>{if(CURRENT_STACK_PARENT_ID)addNewStackDay(CURRENT_STACK_PARENT_ID)};
$("stackDetailEditParent").onclick=()=>{if(CURRENT_STACK_PARENT_ID)editStackParent(CURRENT_STACK_PARENT_ID)};
$("stackDetailEditParentDate").onclick=()=>{if(CURRENT_STACK_PARENT_ID)openStackDateDialog("parent",CURRENT_STACK_PARENT_ID)};
$("stackDateDialogClose").onclick=()=>$("stackDateDialog").close();
$("stackDateSave").onclick=saveStackDate;
$("stackDetailComplete").onclick=()=>{
 if(!CURRENT_STACK_PARENT_ID)return;
 const d=load(),p=d.stackParents.find(x=>x.id===CURRENT_STACK_PARENT_ID);if(!p)return;
 p.status=p.status==="完了"?"実施":"完了";p.completedAt=p.status==="完了"?Date.now():null;p.updatedAt=Date.now();save(d);openStackDetail(p.id);
};
$("stackEntryDetailClose").onclick=()=>$("stackEntryDetailDialog").close();
$("stackEntryDetailEdit").onclick=()=>{const id=CURRENT_STACK_ENTRY_ID;$("stackEntryDetailDialog").close();editStackEntry(id);if(CURRENT_STACK_PARENT_ID)openStackDetail(CURRENT_STACK_PARENT_ID)};
$("stackEntryDetailDelete").onclick=()=>{
 if(!CURRENT_STACK_ENTRY_ID||!confirm("この子記録を削除しますか？"))return;
 const d=load();d.stackEntries=d.stackEntries.filter(x=>x.id!==CURRENT_STACK_ENTRY_ID);save(d);$("stackEntryDetailDialog").close();openStackDetail(CURRENT_STACK_PARENT_ID);
};
$("stackAddDialogClose").onclick=()=>$("stackAddDialog").close();
$("stackAddSave").onclick=()=>{
 const d=load(),parentId=$("stackAddParentId").value,dayId=$("stackAddDaySelect").value;
 const items=checklistFromLines($("stackAddChecklist").value,[]);
 d.stackEntries.push({id:uid(),parentId,dayId,entryType:$("stackAddEntryType").value,title:$("stackAddTitle").value.trim(),text:$("stackAddText").value.trim(),time:new Date($("stackAddTime").value).getTime()||Date.now(),status:$("stackAddStatus").value,minutes:Number($("stackAddMinutes").value)||0,tags:$("stackAddTags").value.split(/[,、]/).map(v=>v.trim()).filter(Boolean),url:$("stackAddUrl").value.trim(),checklist:items,createdAt:Date.now(),updatedAt:Date.now()});
 const p=d.stackParents.find(x=>x.id===parentId);if(p)p.updatedAt=Date.now();
 save(d);$("stackAddDialog").close();openStackDetail(parentId);
};

$("captureTime").value=localValue();
$("orgDestination").onchange=toggleOrgDestination;$("orgRecordMode").onchange=toggleOrgDestination;
$("orgStackCreateNew").onchange=()=>{$("orgStackNewFields").style.display=$("orgStackCreateNew").checked?"block":"none"};
$("orgStackParent").onchange=()=>refreshOrganizerStack($("orgStackParent").value);
$("orgStackDay").onchange=()=>refreshOrganizerDays();
if($("orgType"))$("orgType").addEventListener("change",()=>refreshOrganizerEntryTypes());
if($("orgStackCreateNew"))$("orgStackCreateNew").addEventListener("change",()=>refreshOrganizerEntryTypes());
$("stackParentAdd").onclick=()=>{const name=$("stackParentName").value.trim();if(!name)return alert("親記録名を入力してください");const d=load();d.stackParents.push({id:uid(),name,category:$("stackParentCategory").value,role:$("stackParentRole").value.trim(),tags:$("stackParentTags").value.split(/[,、]/).map(v=>v.trim()).filter(Boolean),time:Date.now(),createdAt:Date.now(),updatedAt:Date.now()});save(d);$("stackParentName").value="";$("stackParentRole").value="";$("stackParentTags").value="";renderStacks()};
$("stackSearch").oninput=renderStacks;$("stackCategoryFilter").onchange=renderStacks;$("closeDialog").onclick=()=>{const b=$("confirmOrganize");if(b){b.disabled=false;b.textContent="この内容で記録へ";}$("organizeDialog").close();};$("closeEditDialog").onclick=()=>$("editDialog").close();$("editUrl").oninput=updateEditUrlPreview;$("saveEdit").onclick=saveEdited;
$("recordSearch").oninput=renderRecords;$("recordFilter").onchange=()=>{currentRecordCategoryFilter=$("recordFilter").value||"";renderRecords()};$("recordStatusFilter").onchange=renderRecords;$("inboxFilter").onchange=renderInbox;

$("historyAdd").onclick=()=>{
 const name=$("historyName").value.trim();if(!name)return alert("項目名を入力してください");
 const d=load();d.historyItems.push({id:uid(),name,category:$("historyCategory").value,targetDays:Number($("historyTargetDays").value)||0,tags:$("historyTags").value.split(/[,、]/).map(v=>v.trim()).filter(Boolean),createdAt:Date.now()});save(d);
 $("historyName").value="";$("historyTargetDays").value="";$("historyTags").value="";renderHistory();
};
$("historySearch").oninput=renderHistory;$("historyCategoryFilter").onchange=renderHistory;
$("historyDialogClose").onclick=()=>$("historyDialog").close();$("recordDetailClose").onclick=()=>$("recordDetailDialog").close();
$("historyEventSave").onclick=()=>{
 const d=load(),itemId=$("historyItemId").value,time=new Date($("historyEventTime").value).getTime()||Date.now();
 d.historyEvents.push({id:uid(),itemId,time,status:$("historyEventStatus").value,minutes:Number($("historyEventMinutes").value)||0,note:$("historyEventNote").value.trim()});
 save(d);$("historyDialog").close();renderHistory();
};

$("purchaseStatusFilter").onchange=renderShopping;
$("shopAdd").onclick=()=>{const name=$("shopName").value.trim();if(!name)return;const d=load();d.shopping.push({id:uid(),name,category:$("shopCategory").value,memo:$("shopMemo").value,done:false,time:Date.now()});save(d);$("shopName").value="";$("shopMemo").value="";render()};

if($("trpgAssetSave"))$("trpgAssetSave").onclick=()=>{
 const name=$("trpgAssetName").value.trim();if(!name)return alert("素材名を入力してください。");const d=trpgAssetRoot(load());
 d.trpgAssets.push({id:uid(),name,type:$("trpgAssetType").value,author:$("trpgAssetAuthor").value.trim(),url:$("trpgAssetUrl").value.trim(),terms:$("trpgAssetTerms").value.trim(),tags:$("trpgAssetTags").value.split(/[,、]/).map(x=>x.trim()).filter(Boolean),memo:$("trpgAssetMemo").value.trim(),time:Date.now()});save(d);
 ["trpgAssetName","trpgAssetAuthor","trpgAssetUrl","trpgAssetTerms","trpgAssetTags","trpgAssetMemo"].forEach(id=>$(id).value="");renderTRPGAssets();
};
if($("trpgAssetLinkSave"))$("trpgAssetLinkSave").onclick=()=>{const sid=$("trpgAssetScenario").value,aid=$("trpgAssetLinkAsset").value;if(!sid||!aid)return alert("シナリオと素材を選択してください。");const d=trpgAssetRoot(load());d.trpgAssetUsage.push({id:uid(),scenarioId:sid,assetId:aid,scene:$("trpgAssetScene").value.trim(),purpose:$("trpgAssetPurpose").value.trim(),time:Date.now(),order:Date.now()});save(d);$("trpgAssetScene").value="";$("trpgAssetPurpose").value="";renderTRPGAssets();renderScenarioLibrary();renderKPAssetUsage()};
if($("trpgAssetSearch"))$("trpgAssetSearch").oninput=renderTRPGAssets;if($("trpgAssetFilter"))$("trpgAssetFilter").onchange=renderTRPGAssets;if($("trpgAssetScenario"))$("trpgAssetScenario").onchange=renderScenarioAssetUsage;
if($("kpAssetScenario"))$("kpAssetScenario").onchange=renderKPAssetUsage;
if($("kpOpenAssetLibrary"))$("kpOpenAssetLibrary").onclick=()=>{const b=document.querySelector('.tab[data-view="trpgAssets"]');if(b)b.click()};
if($("ffAcqImportHunt"))$("ffAcqImportHunt").onclick=importHuntAcquisitionPreset;
if($("ffAcqAdd"))$("ffAcqAdd").onclick=()=>{const name=$("ffAcqName").value.trim();if(!name)return alert("アイテム・報酬名を入力してください。");let d=ffAcqMigrate(load());ffAcqAddOrMerge(d,{name,itemType:$("ffAcqItemType").value,memo:$("ffAcqMemo").value.trim(),createdAt:Date.now()},{method:$("ffAcqMethod").value,source:$("ffAcqSource").value.trim(),currency:$("ffAcqCurrency").value.trim(),cost:$("ffAcqCost").value.trim(),area:$("ffAcqArea").value.trim(),url:$("ffAcqUrl").value.trim(),memo:""});save(d);["ffAcqName","ffAcqSource","ffAcqCurrency","ffAcqCost","ffAcqArea","ffAcqUrl","ffAcqMemo"].forEach(id=>$(id).value="");renderFFAcquisition()};
if($("ffAcqSearch"))$("ffAcqSearch").oninput=renderFFAcquisition;if($("ffAcqFilterMethod"))$("ffAcqFilterMethod").onchange=renderFFAcquisition;if($("ffAcqFilterState"))$("ffAcqFilterState").onchange=renderFFAcquisition;
if($("trpgSkillOnlyRefresh"))$("trpgSkillOnlyRefresh").onclick=renderSkillOnlySpeakers;
if($("trpgSkillOnlyMake"))$("trpgSkillOnlyMake").onclick=makeSkillOnlyOutput;
if($("trpgSkillOnlyCopy"))$("trpgSkillOnlyCopy").onclick=async()=>{const text=$("trpgSkillOnlyOutput").value;if(!text)return;try{await navigator.clipboard.writeText(text);$("trpgSkillOnlyCopy").textContent="✓ コピーしました";setTimeout(()=>$("trpgSkillOnlyCopy").textContent="コピー",1200)}catch(e){$("trpgSkillOnlyOutput").select();document.execCommand("copy")}};
$("trpgAnalyze").onclick=analyzeTRPG;
if($("trpgEdition"))$("trpgEdition").onchange=()=>{markInitialGrowth(currentDiceResults);markInitialGrowth(currentDiceTotalResults);renderDiceResults()};
if($("trpgInitialGrowth"))$("trpgInitialGrowth").onchange=applyGrowthRules;
if($("kpEdition"))$("kpEdition").onchange=renderKPSkills;
if($("kpSkillSearch"))$("kpSkillSearch").oninput=renderKPSkills;
if($("kpOverrideAdd"))$("kpOverrideAdd").onclick=()=>{
 const skill=$("kpOverrideSkill").value.trim(),value=Number($("kpOverrideValue").value),edition=$("kpOverrideEdition").value;
 if(!skill||!Number.isFinite(value)||value<0||value>100)return alert("技能名と0〜100の初期値を入力してください。");
 const d=load(),r=kpRoot(d);r.overrides.push({id:uid(),skill,value,edition,time:Date.now()});save(d);$("kpOverrideSkill").value="";$("kpOverrideValue").value="";renderKPOverrides();
};
if($("kpChecklistSave"))$("kpChecklistSave").onclick=()=>{
 const items=$("kpChecklistInput").value.split("\n").map(x=>x.trim()).filter(Boolean);if(!items.length)return alert("確認事項を入力してください。");
 const d=load(),r=kpRoot(d);r.notes.push({id:uid(),session:$("kpSessionName").value.trim(),scene:$("kpScene").value.trim(),time:Date.now(),items:items.map(text=>({id:uid(),text,done:false}))});save(d);$("kpChecklistInput").value="";renderKPNotes();
};
$("trpgClear").onclick=()=>{$("trpgLogText").value="";$("trpgScenario").value="";$("trpgStartMarker").value="";$("trpgEndMarker").value="";currentDiceResults=[];currentDiceTotalResults=[];currentSourceRange={lines:[],start:0,end:0,startFound:false,endFound:false,startMark:"",endMark:""};$("trpgCharacterFilter").innerHTML='<option value="">全員</option>';$("trpgResultFilter").value="";$("trpgGrowthOnly").checked=false;$("trpgMergeSkills").checked=false;renderDiceResults();renderSourcePreview();$("trpgRangeCritFumble").innerHTML='<div class="empty">解析後に表示します。</div>';$("trpgTotalCritFumble").innerHTML='<div class="empty">解析後に表示します。</div>'};
$("trpgLogFile").onchange=async()=>{const f=$("trpgLogFile").files[0];if(!f)return;const raw=await f.text();$("trpgLogText").value=/\.html?$/i.test(f.name)?stripTRPGHtml(raw):raw;analyzeTRPG()};
$("trpgCharacterFilter").onchange=renderDiceResults;$("trpgResultFilter").onchange=renderDiceResults;$("trpgGrowthOnly").onchange=renderDiceResults;
$("trpgExcludeAbilityGrowth").onchange=applyGrowthRules;$("trpgGrowthExcludeSkills").oninput=applyGrowthRules;$("trpgMergeSkills").onchange=renderDiceResults;
document.querySelectorAll(".growthRule").forEach(c=>c.onchange=applyGrowthRules);
$("trpgJumpFirst").onclick=()=>{const first=currentDiceResults[0];if(first?.sourceLine)$("sourceLine"+first.sourceLine)?.scrollIntoView({behavior:"smooth",block:"center"})};
$("trpgSaveAnalysis").onclick=saveTRPGAnalysis;
$("trpgCopyResults").onclick=async()=>{const a=filteredDiceResults(),text=a.map(x=>`${x.speaker}｜${x.skill}｜${x.target??"-"}｜${x.rolls?x.rolls.join(","):x.roll}｜${x.results?x.results.join("・"):x.result}${x.growth?"｜成長候補":""}`).join("\n");try{await navigator.clipboard.writeText(text);$("trpgCopyResults").textContent="コピーしました";setTimeout(()=>$("trpgCopyResults").textContent="一覧をコピー",900)}catch{alert("コピーできませんでした")}};
$("toolChecklistAdd").onclick=()=>{const name=$("toolChecklistName").value.trim(),items=$("toolChecklistItems").value.split("\n").map(x=>x.trim()).filter(Boolean);if(!name||!items.length)return alert("リスト名と項目を入力してください");const d=load();d.toolChecklists.push({id:uid(),name,items:items.map(name=>({id:uid(),name,done:false})),createdAt:Date.now()});save(d);$("toolChecklistName").value="";$("toolChecklistItems").value="";renderToolChecklists()};

$("saveSettings").onclick=()=>{const d=load();d.settings.guideUrl=$("guideUrl").value.trim();d.settings.youtubeUrl=$("youtubeUrl").value.trim();save(d);alert("保存しました")};
if($("dmgGearSearchSlot"))$("dmgGearSearchSlot").onchange=()=>{const s=$("dmgGearSearchSlot").value;$("dmgGearSlot").value=s==="指輪"?"指輪1":s};
if($("budgetDate"))$("budgetDate").value=new Date().toISOString().slice(0,10);
if($("inventoryFilter"))$("inventoryFilter").onchange=renderInventory;
if($("budgetPaymentMethodAdd"))$("budgetPaymentMethodAdd").onclick=addBudgetPaymentMethod;
if($("budgetPaymentMethodName"))$("budgetPaymentMethodName").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();addBudgetPaymentMethod()}};
refreshBudgetPaymentSelects();renderBudgetPaymentMethods();
if($("budgetItemAdd"))$("budgetItemAdd").onclick=()=>addBudgetDraftItem();
if($("budgetAmount"))$("budgetAmount").oninput=renderBudgetDraftTotal;
if($("budgetEditCancel"))$("budgetEditCancel").onclick=()=>{budgetEditingEntryId="";budgetDraftItems=[];$("budgetAdd").textContent="記録する";$("budgetAdd").classList.remove("success");$("budgetEditCancel").style.display="none";["budgetAmount","budgetTitle","budgetMemo"].forEach(id=>$(id).value="");renderBudgetDraftItems()};
document.querySelectorAll(".budgetMode").forEach(b=>b.onclick=()=>{$("budgetType").value=b.dataset.type;toggleBudgetTypeUI();renderBudgetDraftTotal()});
if($("budgetType"))$("budgetType").onchange=toggleBudgetTypeUI;
if($("variableBudgetAdd"))$("variableBudgetAdd").onclick=addVariableBudget;
if($("postpaySave"))$("postpaySave").onclick=savePostpay;
if($("postpayPaid"))$("postpayPaid").onclick=markPostpayPaid;
["postpayLivingTarget","postpayAmount"].forEach(id=>{if($(id))$(id).oninput=postpayCalc});

toggleBudgetTypeUI();
if($("budgetAdd"))$("budgetAdd").onclick=addBudgetEntry;
if($("fixedAdd"))$("fixedAdd").onclick=addFixedCost;
if($("budgetMonth"))$("budgetMonth").onchange=renderBudget;
if($("budgetMonthlyLimit"))$("budgetMonthlyLimit").onchange=()=>{const d=budgetRoot(load());d.householdBudget.monthlyLimit=nval("budgetMonthlyLimit");save(d);renderBudget()};
if($("dmgGearSearchBtn"))$("dmgGearSearchBtn").onclick=searchXivGear;
if($("dmgGearSearch"))$("dmgGearSearch").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();searchXivGear()}};
if($("dmgGearOfficialSearch"))$("dmgGearOfficialSearch").onclick=()=>{const q=$("dmgGearSearch").value.trim()||$("dmgGearName").value.trim();window.open(`https://jp.finalfantasyxiv.com/lodestone/playguide/db/search/?q=${encodeURIComponent(q)}`,"_blank","noopener")};
if($("dmgSaveHistory"))$("dmgSaveHistory").onclick=saveDamageHistory;
if($("dmgHistoryCompare"))$("dmgHistoryCompare").onclick=compareDamageHistory;
if($("dmgSaveSetA"))$("dmgSaveSetA").onclick=()=>saveDamageSet("A");
if($("dmgSaveSetB"))$("dmgSaveSetB").onclick=()=>saveDamageSet("B");
if($("dmgCompareSets"))$("dmgCompareSets").onclick=compareDamageSets;
if($("dmgMateriaValue"))$("dmgMateriaValue").oninput=()=>{syncGearToStats();renderDamageGear();calcDamage()};
if($("dmgGearAdd"))$("dmgGearAdd").onclick=addOrUpdateDamageGear;
if($("dmgGearClear"))$("dmgGearClear").onclick=()=>{damageGear=[];["dmgWeaponDamage","dmgStr","dmgVit","dmgCritStat","dmgDetStat","dmgDhStat","dmgSksStat","dmgTenStat"].forEach(id=>$(id).value=0);renderDamageGear();calcDamage()};
if($("dmgLoadBalanceOpener"))$("dmgLoadBalanceOpener").onclick=loadBalanceWarOpener;
if($("dmgAddAction"))$("dmgAddAction").onclick=()=>{const s=$("dmgActionSelect"),opt=s.options[s.selectedIndex],name=opt.text.replace(/（\d+）$/,""),pot=Number(opt.value||0),cdh=opt.dataset.cdh==="true";addDamageAction(name,pot,$("dmgActionCount").value,cdh)};
if($("dmgAddCustom"))$("dmgAddCustom").onclick=()=>{const name=$("dmgCustomName").value.trim(),pot=Number($("dmgCustomPotency").value||0);if(!name||pot<=0)return alert("アクション名と威力を入力してください。");addDamageAction(name,pot,$("dmgCustomCount").value,$("dmgCustomCDH").checked);$("dmgCustomName").value="";$("dmgCustomPotency").value=""};
if($("dmgReset"))$("dmgReset").onclick=()=>{damageRows=[];if($("dmgOpenerTimeline"))$("dmgOpenerTimeline").innerHTML="";renderDamageCalc()};
["dmgWeaponDamage","dmgStr","dmgCritStat","dmgDetStat","dmgDhStat","dmgSksStat","dmgTenStat","dmgMatCrit","dmgMatDet","dmgMatDh","dmgMatSks","dmgMatTen","dmgFoodStat1","dmgFoodPct1","dmgFoodCap1","dmgFoodStat2","dmgFoodPct2","dmgFoodCap2","dmgPotionPct","dmgPotionCap","dmgPotionDuration","dmgPotionUses","dmgDuration","dmgTempest","dmgCritRate","dmgCritMult","dmgDhRate","dmgDhMult"].forEach(id=>{if($(id)){$(id).oninput=calcDamage;$(id).onchange=calcDamage}});
if($("dmgFoodPreset"))$("dmgFoodPreset").onchange=applyFoodPreset;
if($("dmgFoodQuality"))$("dmgFoodQuality").onchange=applyFoodPreset;
if($("dmgPotionPreset"))$("dmgPotionPreset").onchange=applyPotionPreset;
if($("dmgPotionQuality"))$("dmgPotionQuality").onchange=applyPotionPreset;
$("officialSearch").onclick=()=>openTemplate("https://jp.finalfantasyxiv.com/lodestone/playguide/db/search/?q={query}",$("ffQuery").value);
$("guideSearch").onclick=()=>openTemplate(load().settings.guideUrl,$("ffQuery").value);$("youtubeSearch").onclick=()=>openTemplate(load().settings.youtubeUrl,$("ffQuery").value);


function jumpToAchievement(targetId){
 const visible=filteredAchievements(),idx=visible.findIndex(a=>a.id===targetId);
 if(idx<0)return false;
 const size=Number($("achPageSize").value||50);achPage=Math.floor(idx/size)+1;renderAchievements();
 requestAnimationFrame(()=>{const cb=document.querySelector(`.achCheck[data-id="${targetId}"]`);if(cb){cb.closest(".card").scrollIntoView({behavior:"smooth",block:"center"});cb.closest(".card").style.outline="2px solid var(--gold)";setTimeout(()=>cb.closest(".card").style.outline="",1400)}});
 return true;
}
function moveMissing(direction){
 const list=filteredAchievements(),missing=list.filter(a=>{const st=achievementState(load(),a.id);return st.done&&!st.date});
 if(!missing.length){alert("現在の絞り込み条件では、達成日未入力の取得済みアチーブはありません。");return}
 const size=Number($("achPageSize").value||50),currentStart=(achPage-1)*size,currentId=(list[currentStart]||list[0])?.id;
 let idx=missing.findIndex(a=>a.id>=currentId);if(idx<0)idx=0;
 idx=(idx+(direction>0?1:-1)+missing.length)%missing.length;
 jumpToAchievement(missing[idx].id);
}

$("achSearch").oninput=()=>{achPage=1;renderAchievements()};
$("achKind").onchange=()=>{updateAchievementCategories();achPage=1;renderAchievements()};
$("achCategory").onchange=()=>{achPage=1;renderAchievements()};
$("achStatus").onchange=()=>{achPage=1;renderAchievements()};
$("achTagSearch").oninput=()=>{achPage=1;renderAchievements()};
$("achInputStatus").onchange=()=>{achPage=1;renderAchievements()};
$("achReward").onchange=()=>{achPage=1;renderAchievements()};
$("achSort").onchange=()=>{achPage=1;renderAchievements()};
$("achIncludeHidden").onchange=()=>{achPage=1;renderAchievements()};
$("achPageSize").onchange=()=>{achPage=1;renderAchievements()};
$("achPrevMissing").onclick=()=>moveMissing(-1);
$("achNextMissing").onclick=()=>moveMissing(1);
$("achRandomTodo").onclick=()=>{const list=filteredAchievements().filter(a=>!achievementState(load(),a.id).done);if(!list.length)return alert("現在の条件では未取得アチーブがありません。");jumpToAchievement(list[Math.floor(Math.random()*list.length)].id)};
$("achPrev").onclick=()=>{achPage--;renderAchievements();window.scrollTo({top:$("achList").offsetTop-100,behavior:"smooth"})};
$("achNext").onclick=()=>{achPage++;renderAchievements();window.scrollTo({top:$("achList").offsetTop-100,behavior:"smooth"})};
$("achOfficialTop").onclick=()=>window.open("https://jp.finalfantasyxiv.com/lodestone/playguide/db/achievement/","_blank","noopener");
updateAchievementCategories();


$("dateArchivePrev").onclick=()=>{dateArchiveDate.setDate(dateArchiveDate.getDate()-1);renderDateArchive()};
$("dateArchiveNext").onclick=()=>{dateArchiveDate.setDate(dateArchiveDate.getDate()+1);renderDateArchive()};
$("dateArchiveToday").onclick=()=>{dateArchiveDate=new Date();renderDateArchive()};
$("dateArchivePicker").onchange=()=>{if($("dateArchivePicker").value){dateArchiveDate=archiveDateFromKey($("dateArchivePicker").value);renderDateArchive()}};


for(const id of inboxDraftFieldIds()){
 const el=$(id);if(!el)continue;
 el.addEventListener("input",scheduleInboxDraftSave);
 el.addEventListener("change",scheduleInboxDraftSave);
}
window.addEventListener("beforeunload",()=>{
 const hasDraft=!!($("captureTitle")?.value||$("captureText")?.value||$("captureTags")?.value||$("captureUrl")?.value||$("captureChecklistItems")?.value);
 if(hasDraft)saveInboxDraftNow();
});
restoreInboxDraft();

$("exportBtn").onclick=()=>{
 const d=load(),exportAt=Date.now(),snapshot=structuredClone(d);
 snapshot.backupMeta={...(snapshot.backupMeta||{}),lastExportAt:exportAt,lastExportSavedAt:Number(snapshot._savedAt||0)};
 downloadArchiveJSON(snapshot,`life_archive_backup_${backupFileStamp()}.json`);
 const live=load();live.backupMeta={...(live.backupMeta||{}),lastExportAt:exportAt,lastExportSavedAt:Number(live._savedAt||0)};save(live);
 $("backupMsg").innerHTML="<b>✓ バックアップを書き出しました。</b><div class='small'>このJSONファイルを安全な場所に保管してください。</div>";
 renderBackupStatus();
};
if($("quickTodayExportBtn"))$("quickTodayExportBtn").onclick=()=>{
 const d=load(),date=localDateValue(),[a,b]=dayBounds(date);
 const rows=todayUnifiedRows(d,a,b).filter(x=>x.kind==="タスク"&&!x.done);
 const payload={format:"life-archive-today",version:1,date,exportedAt:Date.now(),items:rows.map(x=>({id:String(x.id),source:x.source,text:x.text||x.title||"",tags:x.tags||[],done:false,doneAt:0}))};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),ael=document.createElement("a"),url=URL.createObjectURL(blob);
 ael.href=url;ael.download=`LifeArchive_TODAY_${date}.json`;ael.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 if($("quickTodayExportStatus"))$("quickTodayExportStatus").textContent=`今日の未完了タスク ${payload.items.length}件を書き出しました。`;
};
$("importBtn").onclick=async()=>{
 const f=$("importFile").files[0];if(!f)return alert("復元するバックアップファイルを選んでください");
 if(!confirm("選択したバックアップで現在のLife Archiveを復元します。"))return;
 try{
  const current=structuredClone(load());
  downloadArchiveJSON(current,`life_archive_before_restore_${backupFileStamp()}.json`);
  await importStableBackupFile(f);
 }catch(e){
  console.error("backup restore failed",e);
  alert("Life Archiveのバックアップを復元できませんでした："+(e?.message||e));
 }
};
if($("quickImportBtn"))$("quickImportBtn").onclick=async()=>{
 const f=$("quickImportFile")?.files?.[0];if(!f)return alert("QUICK転送ファイルを選んでください。");
 const quickStatus=$("quickImportStatus");if(quickStatus)quickStatus.textContent="読み込み中…";
 try{
  const payload=JSON.parse(await f.text());
  if(payload?.format!=="life-archive-quick"||!Array.isArray(payload.items))throw new Error("Life Archive QUICKの転送ファイルではありません。");
  const d=load();d.inbox=d.inbox||[];
  const existing=new Set(d.inbox.map(x=>String(x.quickSourceId||"")));
  let added=0,taskUpdates=0,activityAdded=0;
  payload.items.forEach(q=>{
   if(!q?.id||existing.has(String(q.id)))return;
   const ts=q.date?new Date(q.date+"T12:00:00").getTime():Number(q.createdAt||Date.now());
   d.inbox.push({id:uid(),text:String(q.text||""),kind:String(q.kind||"記録"),classification:String(q.kind||"記録"),tags:Array.isArray(q.tags)?q.tags:[],date:q.date||"",createdAt:ts,updatedAt:Date.now(),done:false,doneAt:0,quickSourceId:String(q.id),source:"Life Archive QUICK"});
   added++;
  });
  if(Array.isArray(payload?.activityLogs)){
   d.activityLogs=d.activityLogs||[];
   const activityExisting=new Set(d.activityLogs.map(x=>String(x.quickSourceId||x.id||"")));
   for(const q of payload.activityLogs){
    if(!q?.id||activityExisting.has(String(q.id)))continue;
    d.activityLogs.push({id:uid(),name:String(q.name||"活動"),category:String(q.category||"その他"),memo:String(q.memo||""),startedAt:Number(q.startedAt||Date.now()),endedAt:Number(q.endedAt||Date.now()),activeMs:Number(q.activeMs||0),pauses:Array.isArray(q.pauses)?q.pauses:[],laps:Array.isArray(q.laps)?q.laps:[],createdAt:Number(q.createdAt||Date.now()),quickSourceId:String(q.id),source:"Life Archive QUICK"});
    activityExisting.add(String(q.id));activityAdded++;
   }
  }
  if(payload?.today&&Array.isArray(payload.today.items)){
   for(const q of payload.today.items){
    if(!q?.id)continue;
    let x=null;
    if(q.source==="legacy")x=(d.quickCaptures||[]).find(v=>String(v.id)===String(q.id));
    else x=(d.inbox||[]).find(v=>String(v.id)===String(q.id));
    if(!x)continue;
    const was=!!x.done,next=!!q.done;
    if(was!==next||Number(x.doneAt||0)!==Number(q.doneAt||0)){x.done=next;x.doneAt=next?Number(q.doneAt||Date.now()):0;x.updatedAt=Date.now();taskUpdates++}
   }
  }
  save(d);if(typeof render==="function")render();if(typeof renderActivityLog==="function")renderActivityLog();if(typeof renderTodayHub==="function")renderTodayHub();if(typeof renderDateArchive==="function")renderDateArchive();
  const msg=`QUICK受信箱 ${added}件追加 ／ 時間記録 ${activityAdded}件追加 ／ 今日タスク ${taskUpdates}件反映。${payload.items.length-added}件は取り込み済みのためスキップしました。`;
  if($("backupMsg"))$("backupMsg").textContent=msg;if(quickStatus)quickStatus.textContent=msg;
 }catch(e){console.error(e);if(quickStatus)quickStatus.textContent="取り込みに失敗しました。";alert("QUICK受信箱を取り込めませんでした："+(e?.message||e))}
};
["fishSearch"].forEach(id=>{if($(id))$(id).oninput=()=>renderFishing()});["fishExpansion","fishStatus","fishKind"].forEach(id=>{if($(id))$(id).onchange=()=>renderFishing()});

["craftSearch"].forEach(id=>{if($(id))$(id).oninput=()=>{craftPage=1;renderCrafting()}});
["craftJob","craftLevelBand","craftStatus","craftSpecial","craftPageSize"].forEach(id=>{if($(id))$(id).onchange=()=>{craftPage=1;renderCrafting()}});
if($("craftPrev"))$("craftPrev").onclick=()=>{craftPage=Math.max(1,craftPage-1);renderCrafting()};
if($("craftNext"))$("craftNext").onclick=()=>{craftPage++;renderCrafting()};


document.querySelectorAll(".collectionTab").forEach(b=>b.onclick=()=>{collectionKind=b.dataset.kind;collectionPage=1;updateCollectionSpecial();renderCollections()});
if($("collectionSearch"))$("collectionSearch").oninput=()=>{collectionPage=1;renderCollections()};
["collectionStatus","collectionSpecial","collectionPageSize"].forEach(id=>{if($(id))$(id).onchange=()=>{collectionPage=1;renderCollections()}});
if($("collectionPrev"))$("collectionPrev").onclick=()=>{collectionPage=Math.max(1,collectionPage-1);renderCollections()};
if($("collectionNext"))$("collectionNext").onclick=()=>{collectionPage++;renderCollections()};


if($("cardSearch"))$("cardSearch").oninput=()=>{cardPage=1;renderCards()};
["cardStatus","cardRarity","cardType","cardPageSize","cardSort"].forEach(id=>{if($(id))$(id).onchange=()=>{cardPage=1;renderCards()}});
if($("cardPrev"))$("cardPrev").onclick=()=>{cardPage=Math.max(1,cardPage-1);renderCards()};
if($("cardNext"))$("cardNext").onclick=()=>{cardPage++;renderCards()};


document.querySelectorAll(".triadModeTab").forEach(b=>b.onclick=()=>setTriadMode(b.dataset.mode));
if($("triadNpcSearch"))$("triadNpcSearch").oninput=()=>{triadNpcPage=1;renderTriadNpcs()};
["triadNpcStatus","triadNpcPatch","triadNpcPageSize"].forEach(id=>{if($(id))$(id).onchange=()=>{triadNpcPage=1;renderTriadNpcs()}});
if($("triadNpcPrev"))$("triadNpcPrev").onclick=()=>{triadNpcPage=Math.max(1,triadNpcPage-1);renderTriadNpcs()};
if($("triadNpcNext"))$("triadNpcNext").onclick=()=>{triadNpcPage++;renderTriadNpcs()};
if($("triadNpcReload"))$("triadNpcReload").onclick=()=>loadTriadNpcs(true);

if($("craftPlanBuild"))$("craftPlanBuild").onclick=()=>buildCraftPlan();
if($("craftPlanClear"))$("craftPlanClear").onclick=()=>clearCraftPlan();


if($("weaponCreate"))$("weaponCreate").onclick=()=>{
 const name=$("weaponCreateName").value.trim();if(!name){alert("シリーズ名を入力してください");return}
 const d=load(),now=Date.now(),stage=Math.max(0,Number($("weaponCreateStage").value)||0),total=Math.max(1,Number($("weaponCreateTotal").value)||1),memo=$("weaponCreateMemo").value;
 d.weapons.push({id:uid(),name,title:name,job:$("weaponCreateJob").value.trim(),stage,totalStage:total,complete:stage>=total,text:memo,time:now,createdAt:now,updatedAt:now,tags:["武器制作"],history:[]});
 save(d);
 $("weaponCreateName").value="";$("weaponCreateJob").value="";$("weaponCreateStage").value="0";$("weaponCreateTotal").value="6";$("weaponCreateMemo").value="";
 renderWeapons();
};

fillRelicFilters();
if($("relicSeriesFilter"))$("relicSeriesFilter").onchange=()=>renderRelicRoadmap();
if($("relicStatusFilter"))$("relicStatusFilter").onchange=()=>renderRelicRoadmap();

if($("leveSearch"))$("leveSearch").oninput=()=>{levePage=1;renderGuildleves()};
["leveStatus","leveCategory","leveLevel","levePageSize"].forEach(id=>{if($(id))$(id).onchange=()=>{levePage=1;renderGuildleves()}});
if($("levePrev"))$("levePrev").onclick=()=>{levePage=Math.max(1,levePage-1);renderGuildleves()};
if($("leveNext"))$("leveNext").onclick=()=>{levePage++;renderGuildleves()};
if($("leveReload"))$("leveReload").onclick=()=>loadGuildleves(true);

if($("yokaiSearch"))$("yokaiSearch").oninput=()=>renderYokai();
if($("yokaiStatus"))$("yokaiStatus").onchange=()=>renderYokai();

document.querySelectorAll(".event-launch").forEach(b=>b.onclick=()=>{const target=b.dataset.target;const tab=document.querySelector(`.tab[data-view="${target}"]`);if(tab)tab.click();});


if($("personAdd"))$("personAdd").onclick=()=>{
 const name=$("personName").value.trim();if(!name)return alert("人物名を入力してください");
 const d=load(),now=Date.now();d.people.push({id:uid(),name,aliases:$("personAliases").value.split(/[,、]/).map(x=>x.trim()).filter(Boolean),groups:$("personGroups").value.split(/[,、]/).map(x=>x.trim()).filter(Boolean),memo:$("personMemo").value,createdAt:now,updatedAt:now});save(d);
 ["personName","personAliases","personGroups","personMemo"].forEach(id=>$(id).value="");refreshPeopleSelectors();renderPeopleCodex();
};
function fileToDataUrl(file){
 return new Promise((resolve,reject)=>{
  if(!file)return resolve("");
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result||""));
  reader.onerror=()=>reject(reader.error);
  reader.readAsDataURL(file);
 });
}
if($("characterAdd"))$("characterAdd").onclick=async()=>{
 const name=$("characterName").value.trim();if(!name)return alert("PC名を入力してください");
 let imageData="";try{imageData=await fileToDataUrl($("characterImage").files?.[0])}catch(e){return alert("画像を読み込めませんでした")}
 const d=load(),now=Date.now();d.characters.push({id:uid(),name,personId:$("characterPerson").value,systems:$("characterSystems").value.split(/[,、]/).map(x=>x.trim()).filter(Boolean),sheetUrl:$("characterSheetUrl").value.trim(),imageData,memo:$("characterMemo").value,createdAt:now,updatedAt:now});save(d);
 ["characterName","characterSystems","characterSheetUrl","characterMemo"].forEach(id=>$(id).value="");$("characterImage").value="";$("characterPerson").value="";refreshPeopleSelectors();renderPeopleCodex();
};
if($("linkParent"))$("linkParent").onchange=loadParentParticipants;
if($("linkParticipantAddRow"))$("linkParticipantAddRow").onclick=()=>{const b=$("linkParticipantRows");b.insertAdjacentHTML("beforeend",participantRowHtml());bindParticipantRows()};
if($("linkParticipantsSave"))$("linkParticipantsSave").onclick=()=>{
 const d=load(),p=d.stackParents.find(x=>x.id===$("linkParent").value);if(!p)return alert("卓を選択してください");
 p.participantLinks=[...document.querySelectorAll(".participantLinkRow")].map(row=>({personId:row.querySelector(".participantPerson").value,characterId:row.querySelector(".participantCharacter").value,role:row.querySelector(".participantRole").value})).filter(x=>x.personId||x.characterId);
 p.updatedAt=Date.now();save(d);renderTRPG();renderPeopleCodex();alert("参加者を保存しました");
};
if($("peopleSearch"))$("peopleSearch").oninput=renderPeopleCodex;
if($("peopleSort"))$("peopleSort").onchange=renderPeopleCodex;
function clearRelationEditor(){
 if($("relationFrom"))$("relationFrom").value="";
 if($("relationTo"))$("relationTo").value="";
 if($("relationLabel"))$("relationLabel").value="";
 if($("relationMemo"))$("relationMemo").value="";
 if($("relationScenario"))[...$("relationScenario").options].forEach(o=>o.selected=false);
 if($("relationAdd")){delete $("relationAdd").dataset.editId;$("relationAdd").textContent="関係を登録";}
 if($("relationCancelEdit"))$("relationCancelEdit").style.display="none";
 if($("relationEditStatus"))$("relationEditStatus").textContent="";
}
if($("relationCancelEdit"))$("relationCancelEdit").onclick=clearRelationEditor;
if($("relationAdd"))$("relationAdd").onclick=()=>{
 const from=$("relationFrom").value,to=$("relationTo").value;if(!from||!to)return alert("PC AとPC Bを選択してください");if(from===to)return alert("同じPC同士は登録できません");
 const d=load(),selected=[...$("relationScenario").selectedOptions].map(o=>o.value).filter(Boolean),editId=$("relationAdd").dataset.editId||"",label=$("relationLabel").value.trim()||"関係",memo=$("relationMemo").value.trim();
 if(editId){
  const r=d.characterRelations.find(x=>x.id===editId);if(!r)return;
  r.fromId=from;r.toId=to;r.label=label;r.scenarioParentIds=selected;r.memo=memo;r.updatedAt=Date.now();
 }else{
  const same=d.characterRelations.find(r=>{
   const samePair=(r.fromId===from&&r.toId===to)||(r.fromId===to&&r.toId===from);
   return samePair&&String(r.label||"関係").trim()===label;
  });
  if(same){
   same.scenarioParentIds=[...new Set([...(same.scenarioParentIds||[]),...selected])];
   if(memo) same.memo=same.memo?`${same.memo}
${memo}`:memo;
   same.updatedAt=Date.now();
   alert("同じPCペア・同じ関係があるため、関連シナリオを既存データへ追加しました。");
  }else{
   d.characterRelations.push({id:uid(),fromId:from,toId:to,label,scenarioParentIds:selected,memo,createdAt:Date.now(),updatedAt:Date.now()});
  }
 }
 save(d);clearRelationEditor();renderPeopleCodex();
};


if($("scenarioSave"))$("scenarioSave").onclick=()=>{
 const title=$("scenarioTitle").value.trim();if(!title)return alert("シナリオ名を入力してください");
 const d=load(),editId=$("scenarioSave").dataset.editId||"",now=Date.now();
 const obj={title,systems:$("scenarioSystems").value.split(/[,、]/).map(x=>x.trim()).filter(Boolean),author:$("scenarioAuthor").value.trim(),sourceUrl:$("scenarioSourceUrl").value.trim(),purchasedAt:$("scenarioPurchasedAt").value?new Date($("scenarioPurchasedAt").value+"T12:00:00").getTime():0,players:$("scenarioPlayers").value.trim(),playTime:$("scenarioPlayTime").value.trim(),status:$("scenarioStatus").value,tags:$("scenarioTags").value.split(/[,、]/).map(x=>x.trim()).filter(Boolean),assets:{pdf:$("assetPdf").checked,room:$("assetRoom").checked,npc:$("assetNpc").checked,bgm:$("assetBgm").checked,ccfolia:$("assetCcfolia").checked,other:$("assetOther").checked},storageUrl:$("scenarioStorageUrl").value.trim(),memo:$("scenarioMemo").value};
 if(editId){const s=d.scenarioLibrary.find(x=>x.id===editId);if(!s)return;Object.assign(s,obj,{updatedAt:now})}
 else d.scenarioLibrary.push({...obj,id:uid(),linkedParentIds:[],createdAt:now,updatedAt:now});
 save(d);clearScenarioForm();refreshScenarioSelectors();renderScenarioLibrary();
};
if($("scenarioCancel"))$("scenarioCancel").onclick=clearScenarioForm;
if($("scenarioSearch"))$("scenarioSearch").oninput=renderScenarioLibrary;
if($("scenarioFilter"))$("scenarioFilter").onchange=renderScenarioLibrary;
if($("scenarioLinkLibrary"))$("scenarioLinkLibrary").onchange=()=>{
 const d=load(),s=d.scenarioLibrary.find(x=>x.id===$("scenarioLinkLibrary").value),ids=new Set(s?.linkedParentIds||[]);
 [...$("scenarioLinkParent").options].forEach(o=>o.selected=ids.has(o.value));
};
if($("scenarioLinkSave"))$("scenarioLinkSave").onclick=()=>{
 const d=load(),s=d.scenarioLibrary.find(x=>x.id===$("scenarioLinkLibrary").value);if(!s)return alert("所持シナリオを選択してください");
 s.linkedParentIds=[...$("scenarioLinkParent").selectedOptions].map(o=>o.value);s.updatedAt=Date.now();save(d);renderScenarioLibrary();alert("卓リンクを保存しました");
};


if($("todayDate"))$("todayDate").value=localDateValue();
if($("todayDate"))$("todayDate").onchange=renderTodayHub;


if($("craftIndexBuild"))$("craftIndexBuild").onclick=()=>buildCraftReverseIndex(true);
document.querySelectorAll(".craftReverseMode").forEach(b=>b.onclick=()=>{
 craftReverseMode=b.dataset.mode;document.querySelectorAll(".craftReverseMode").forEach(x=>x.classList.toggle("primary",x===b));document.querySelectorAll(".craftReverseMode").forEach(x=>x.classList.toggle("secondary",x!==b));
});
if(document.querySelector('.craftReverseMode[data-mode="uses"]'))document.querySelector('.craftReverseMode[data-mode="uses"]').classList.add("primary");
if($("craftInventoryAdd"))$("craftInventoryAdd").onclick=async()=>{
 const raw=$("craftInventoryName").value.trim();if(!raw)return alert("素材名を入力してください");
 const hit=findCraftIngredientByName(raw);
 const q=Math.max(0,Math.floor(Number($("craftInventoryQty").value)||0)),d=load(),inv=craftInventoryData(d);
 if(q)inv[String(hit.itemId)]={name:hit.name,qty:q,catalog:!!hit.catalog};else delete inv[String(hit.itemId)];
 save(d);$("craftInventoryName").value="";$("craftInventoryQty").value="1";renderCraftInventory();
};
if($("craftReverseRun"))$("craftReverseRun").onclick=runCraftReverse;


if($("foodAdd"))$("foodAdd").onclick=()=>{
 const name=$("foodName").value.trim();if(!name)return alert("食材名を入力してください");
 const d=load(),key=foodKey(name),old=d.foodInventory.find(x=>foodKey(x.name)===key),qty=Math.max(0,Number($("foodQty").value)||0),unit=$("foodUnit").value.trim(),expiry=$("foodExpiry").value?new Date($("foodExpiry").value+"T12:00:00").getTime():0,storage=$("foodStorage")?.value||"冷蔵";
 if(old){old.qty=qty;old.unit=unit||old.unit;old.expiry=expiry;old.storage=storage;old.updatedAt=Date.now()}else d.foodInventory.push({id:uid(),name,qty,unit,expiry,storage,createdAt:Date.now(),updatedAt:Date.now()});
 save(d);$("foodName").value="";$("foodQty").value="1";$("foodUnit").value="";$("foodExpiry").value="";if($("foodStorage"))$("foodStorage").value="冷蔵";renderCooking();
};
if($("cookSave"))$("cookSave").onclick=()=>{
 const name=$("cookName").value.trim();if(!name)return alert("料理名を入力してください");
 const ingredients=parseCookIngredients($("cookIngredients").value);if(!ingredients.length)return alert("必要食材を1つ以上登録してください");
 const d=load(),id=$("cookSave").dataset.editId||"",obj={name,minutes:Math.max(0,Number($("cookMinutes").value)||0),tags:$("cookTags").value.split(/[,、]/).map(x=>x.trim()).filter(Boolean),ingredients,alternatives:parseCookAlternatives($("cookAlternatives").value),memo:$("cookMemo").value,updatedAt:Date.now()};
 if(id){const r=d.cookingRecipes.find(x=>x.id===id);if(!r)return;Object.assign(r,obj)}else d.cookingRecipes.push({...obj,id:uid(),createdAt:Date.now()});
 save(d);clearCookForm();renderCooking();
};
if($("cookCancel"))$("cookCancel").onclick=clearCookForm;
document.querySelectorAll(".cookMode").forEach(b=>b.onclick=()=>{cookingMode=b.dataset.mode;document.querySelectorAll(".cookMode").forEach(x=>{x.classList.toggle("primary",x===b);x.classList.toggle("secondary",x!==b)});renderCookSuggestions()});
if($("cookSearch"))$("cookSearch").oninput=renderCooking;
if($("cookTagFilter"))$("cookTagFilter").oninput=renderCooking;


if($("ffProfileSync"))$("ffProfileSync").onclick=syncLodestoneProfile;
if($("ffLodestoneId"))$("ffLodestoneId").onchange=()=>{
 const id=normalizeLodestoneId($("ffLodestoneId").value);if(!id)return;
 const d=load(),p=ffProfileData(d);p.lodestoneId=id;p.profileUrl=lodestoneUrls(id).profile;save(d);
};
if($("ffProfileOpen"))$("ffProfileOpen").onclick=()=>{
 const d=load(),p=ffProfileData(d),id=normalizeLodestoneId($("ffLodestoneId")?.value)||p.lodestoneId;
 if(!id)return alert("Lodestone IDを入力してください");
 window.open(lodestoneUrls(id).profile,"_blank","noopener");
};

if($("ffProfileHtmlImport"))$("ffProfileHtmlImport").onclick=importLodestoneHtmlFiles;

if($("minionLodestoneOpen"))$("minionLodestoneOpen").onclick=()=>{
 const p=ffProfileData(load()),id=p.lodestoneId||normalizeLodestoneId($("ffLodestoneId")?.value);
 if(!id)return alert("先にFF14プロフィールでLodestone IDを登録してください");
 window.open(`https://jp.finalfantasyxiv.com/lodestone/character/${id}/minion/`,"_blank","noopener");
};


if($("minionCollectSync"))$("minionCollectSync").onclick=syncMinionsFromFFXIVCollect;
if($("minionCollectOpen"))$("minionCollectOpen").onclick=()=>{
 const p=ffProfileData(load()),id=p.lodestoneId||normalizeLodestoneId($("ffLodestoneId")?.value);
 if(!id)return window.open("https://ffxivcollect.com/","_blank","noopener");
 window.open(`https://ffxivcollect.com/characters/${id}`,"_blank","noopener");
};

if($("ffxivCollectCatalogSync"))$("ffxivCollectCatalogSync").onclick=syncFFXIVCollectCatalogs;
if($("ffxivCollectJapaneseSync"))$("ffxivCollectJapaneseSync").onclick=syncFFXIVCollectJapaneseDescriptions;
if($("ffxivCollectOwnershipSync"))$("ffxivCollectOwnershipSync").onclick=syncFFXIVCollectOwnership;
if($("fcExplorerKind"))$("fcExplorerKind").onchange=renderFCExplorer;$("fcExplorerSort").onchange=renderFCExplorer;
if($("fcExplorerSearch"))$("fcExplorerSearch").oninput=renderFCExplorer;
if($("fcExplorerStatus"))$("fcExplorerStatus").onchange=renderFCExplorer;

function downloadStableBackup(){
 const d=load();
 const blob=new Blob([JSON.stringify({app:"Life Archive",format:1,savedAt:new Date().toISOString(),data:d},null,2)],{type:"application/json"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);
 a.download=`life_archive_backup_${new Date().toISOString().slice(0,10)}.json`;
 a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
async function importStableBackupFile(file){
 const raw=await file.text(),p=JSON.parse(raw),incoming=p?.data||p;
 if(!incoming||typeof incoming!=="object"||Array.isArray(incoming))throw new Error("バックアップ形式が正しくありません");

 const restored=normalizeData(incoming);
 restored._savedAt=Date.now();

 // 実バックアップで必須データを確認
 const cats=restored?.ffProfile?.ffxivCollect?.catalogs||{};
 const catCount=Object.keys(cats).length;
 const totalCount=Object.values(cats).reduce((n,c)=>n+Number(c?.count||c?.items?.length||0),0);
 const minionCount=Object.keys(restored?.minionProgress||{}).length;
 const mountCount=Object.keys(restored?.mountProgress||{}).length;

 // まず現在メモリへ採用。再読込を待たず画面に反映できるようにする。
 LIVE_DATA=structuredClone(restored);

 // IndexedDBを正として確実に保存
 await idbWrite(structuredClone(restored));

 // localStorageは容量内なら補助保存
 try{localStorage.setItem(KEY,JSON.stringify(restored))}catch(e){console.warn("localStorage backup copy skipped",e)}
 try{stableSaveSnapshot(restored)}catch(e){}

 // IndexedDBから再読込して中身を検証
 const verify=await idbRead();
 const verifyCats=verify?.ffProfile?.ffxivCollect?.catalogs||{};
 const verifyCatCount=Object.keys(verifyCats).length;
 if(catCount && verifyCatCount!==catCount)throw new Error(`図鑑復元確認に失敗しました（${verifyCatCount}/${catCount}カテゴリ）`);

 // 画面をその場で再描画。location.reload()はしない。
 LIVE_DATA=normalizeData(verify||restored);
 render();
 renderPersistenceTest();
 renderFFXIVCollectHub();
 renderCollections();
 renderBackupStatus();

 const msg=`復元完了：図鑑 ${catCount}カテゴリ・${totalCount}件 ／ ミニオン進捗 ${minionCount} ／ マウント進捗 ${mountCount}`;
 setSaveStatus(msg,true);
 if($("backupMsg"))$("backupMsg").innerHTML=`<b>✓ ${esc(msg)}</b>`;
 alert(msg);
}
if($("stableBackupDownload"))$("stableBackupDownload").onclick=downloadStableBackup;
if($("stableBackupImport"))$("stableBackupImport").onclick=()=>$("stableBackupFile")?.click();
if($("stableBackupFile"))$("stableBackupFile").onchange=async e=>{
 try{const f=e.target.files?.[0];if(f)await importStableBackupFile(f)}
 catch(err){alert("バックアップを読み込めませんでした："+err.message)}
};

window.addEventListener("beforeunload",()=>{try{if(LIVE_DATA)stableSaveSnapshot(LIVE_DATA)}catch(e){}});

function renderPersistenceTest(){
 const el=$("persistTestStatus");if(!el)return;
 const current=LIVE_DATA||null;
 const cats=current?.ffProfile?.ffxivCollect?.catalogs||{};
 const count=Object.values(cats).reduce((n,c)=>n+Number(c?.count||c?.items?.length||0),0);
 const catCount=Object.keys(cats).length;
 const minions=Object.keys(current?.minionProgress||{}).length;
 const mounts=Object.keys(current?.mountProgress||{}).length;
 el.innerHTML=`図鑑：<b>${catCount?`${catCount}カテゴリ・${count}件`:"未取得"}</b> ／ ミニオン進捗：<b>${minions}</b> ／ マウント進捗：<b>${mounts}</b>`;
}

["activityLogFrom","activityLogTo","activityLogCategory","activityLogSort"].forEach(id=>{if($(id))$(id).onchange=renderActivityLog});
if($("activityLogSearch"))$("activityLogSearch").oninput=renderActivityLog;
if($("todayDate"))$("todayDate").onchange=renderTodayHub;
if($("fcExplorerSource"))$("fcExplorerSource").onchange=renderFCExplorer;
if($("fcExplorerTag"))$("fcExplorerTag").onchange=renderFCExplorer;
if($("fcExplorerTagSearch"))$("fcExplorerTagSearch").oninput=renderFCExplorer;
["bicolorExpansion","bicolorZone","bicolorStatus","bicolorType"].forEach(id=>{if($(id))$(id).onchange=renderBicolor});
if($("bicolorSearch"))$("bicolorSearch").oninput=renderBicolor;
if($("bicolorCurrentGem"))$("bicolorCurrentGem").onchange=()=>{const d=load(),r=bicolorRoot(d);r.currentGem=Math.max(0,Number($("bicolorCurrentGem").value||0));save(d);renderBicolor()};
initializePersistentData().then(()=>{renderPersistenceTest();
 initializeWarRelicDefaults();
 refreshPeopleSelectors();
 refreshScenarioSelectors();
 loadParentParticipants();
 loadGuildleves();
 try{repairGroupedInboxLinks()}catch(e){console.error("grouped inbox repair failed",e)}
 migrate();migrateClassifications();recoverMisroutedChecklists();repairDestinationConflicts();
 const initialView=loadUI().activeView||"ff14";
 switchView(document.getElementById(initialView)?initialView:"ff14");
}).catch(()=>{
 LIVE_DATA=normalizeData(base());
 setSaveStatus("⚠ 永続保存の初期化に失敗しました（古い復旧データは自動投入しません）",false);
 migrate();
 const initialView=loadUI().activeView||"ff14";
 switchView(document.getElementById(initialView)?initialView:"ff14");
});
