/* Read-only, local capacity analysis. Does not call application load/save/normalizers. */
(() => {
  'use strict';
  const MIB=1048576, SINGLE=64*MIB, TOTAL=256*MIB, MAX_DEPTH=120;
  const scope=/^(lifeArchive|life_archive_|hikachoku_|eorzeaArchive_|eorzea_)/;
  const dbScope=/^(LifeArchiveDB$|hikachoku_|life_archive_|eorzea_)/;
  const safeKey=/^(lifeArchive(?:Data(?:_backup_[1-5])?|088|091|09274|0928|0929|09291|09292|09293|09294|09295|InboxDraft)|life_archive_(?:activity_timer_v1|pomodoro_v1|et_alarms_v1|restore_pending|stable_data_v1|last_sakumeru_kp_v1|craft_materials_v1|craft_reverse_v1|triad_npcs_v1|guildleves_v8|guildleves_v9_delivery_items)|eorzeaArchive_ui_v1|eorzea_lodestone_proxy_v1|hikachoku_(?:notes_media_v1|fold_states_v1|wiki_sort_v1|wiki_tree_collapsed_v1|achievement_history_filter_v1|progress_dashboard_sort|recent_pages_open_v1))$/;
  const knownDB=new Set(['LifeArchiveDB','hikachoku_media_v1','hikachoku_activity_diary_media_v1']);
  const enc=new TextEncoder();
  let running=false, cancelled=false, lastText='';
  let operations=0, started=0;
  function check(depth=0){
    if(cancelled)throw new Error('利用者が診断を中止しました。');
    if(depth>MAX_DEPTH)throw new Error('安全上の深さ上限に達しました。');
    if(++operations>12000000 || performance.now()-started>120000)throw new Error('安全上の処理量・時間上限に達しました。');
  }
  const pause=()=>new Promise(r=>setTimeout(r,0));
  // Counts JSON string bytes exactly, without allocating the escaped full string.
  function stringBytes(s){
    let n=2;
    for(let i=0;i<s.length;i++){
      if((i&65535)===0)check();
      const c=s.charCodeAt(i);
      if(c===34||c===92||c===8||c===9||c===10||c===12||c===13)n+=2;
      else if(c<32)n+=6;
      else if(c<128)n++;
      else if(c<2048)n+=2;
      else if(c>=0xd800&&c<=0xdbff){const d=s.charCodeAt(i+1);if(d>=0xdc00&&d<=0xdfff){n+=4;i++}else n+=6}
      else if(c>=0xdc00&&c<=0xdfff)n+=6;
      else n+=3;
    }
    return n;
  }
  function utf8Bytes(s){return stringBytes(s)-2-escapeExtra(s)}
  function escapeExtra(s){let n=0;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c===34||c===92||[8,9,10,12,13].includes(c))n++;else if(c<32)n+=5;else if(c>=0xd800&&c<=0xdbff){const d=s.charCodeAt(i+1);if(d>=0xdc00&&d<=0xdfff)i++;else n+=3}else if(c>=0xdc00&&c<=0xdfff)n+=3}return n}
  function objectSize(fields,d){if(!fields.length)return 2;return 2+fields.reduce((n,[k,v])=>n+2*(d+1)+stringBytes(k)+2+v,0)+2*(fields.length-1)+2+2*d}
  function arraySize(sizes,d){if(!sizes.length)return 2;return 2+sizes.reduce((a,b)=>a+b,0)+sizes.length*2*(d+1)+2*(sizes.length-1)+2+2*d}
  // Compact plain JSON tokens, <=4096 input characters per string fragment.
  function* plain(value,stack=new WeakSet(),depth=0){
    check(depth);
    if(value===null){yield 'null';return}
    if(typeof value==='string'){
      yield '"';for(let i=0;i<value.length;){let end=Math.min(i+4096,value.length);if(end<value.length&&value.charCodeAt(end-1)>=0xd800&&value.charCodeAt(end-1)<=0xdbff)end--;const part=value.slice(i,end);yield JSON.stringify(part).slice(1,-1);i=end}yield '"';return;
    }
    if(typeof value==='number'){yield Number.isFinite(value)?String(value):'null';return}
    if(typeof value==='boolean'){yield String(value);return}
    if(typeof value==='undefined'){yield 'null';return}
    if(typeof value==='bigint')throw new Error('通常JSONで表現できない型の容量比較は未対応です。');
    if(value instanceof Date){yield* plain(value.toJSON(),stack,depth+1);return}
    if(stack.has(value))throw new Error('循環参照の通常JSON容量・重複比較は未対応です。');
    stack.add(value);
    if(Array.isArray(value)){
      yield '[';for(let i=0;i<value.length;i++){if(i)yield ',';yield* plain(value[i],stack,depth+1)}yield ']';
    }else{
      yield '{';let comma=false;for(const k of Object.keys(value)){if(value[k]===undefined)continue;if(comma)yield ',';comma=true;yield* plain(k,stack,depth+1);yield ':';yield* plain(value[k],stack,depth+1)}yield '}';
    }
    stack.delete(value);
  }
  async function fingerprint(value){
    let size=0,used=0,steps=0;const buffer=new Uint8Array(65536),digests=[];
    const flush=async()=>{digests.push(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer.subarray(0,used))));used=0};
    for(const token of plain(value)){
      const b=enc.encode(token);size+=b.length;
      for(let i=0;i<b.length;){const n=Math.min(buffer.length-used,b.length-i);buffer.set(b.subarray(i,i+n),used);i+=n;used+=n;if(used===buffer.length)await flush()}
      if(++steps%8192===0){check();await pause()}
    }
    if(used)await flush();
    const hashInput=new Uint8Array(digests.length*32);digests.forEach((d,i)=>hashInput.set(d,i*32));
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',hashInput))].map(n=>n.toString(16).padStart(2,'0')).join('');
    return {size,signature:`chunked-json-v1:${size}:${digest}`};
  }
  function rawSize(value,d=0,seen=new WeakSet()){
    check(d);if(value===null)return 4;
    if(typeof value==='string')return stringBytes(value);
    if(typeof value==='number')return Number.isFinite(value)?String(value).length:4;
    if(typeof value==='boolean')return value?4:5;
    if(value===undefined)return 4;
    if(typeof value==='bigint')throw new Error('通常JSONで表現できない型');
    if(value instanceof Date)return value.toJSON()===null?4:stringBytes(value.toJSON());
    if(seen.has(value))throw new Error('循環参照の通常JSON容量は未対応');seen.add(value);
    let n=2,count=0;
    if(Array.isArray(value)){for(let i=0;i<value.length;i++){n+=rawSize(value[i],d+1,seen);count++}}
    else for(const k of Object.keys(value)){if(value[k]===undefined)continue;n+=stringBytes(k)+1+rawSize(value[k],d+1,seen);count++}
    seen.delete(value);return n+Math.max(0,count-1);
  }
  class Records {constructor(iterator){this.iterator=iterator}}
  const extension=type=>({'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp','image/avif':'avif','video/mp4':'mp4','video/webm':'webm'})[type]||'bin';
  function context(){return {seen:new WeakMap(),id:1,binary:0,files:[],blobBytes:0,imageBytes:0,dataURLs:{image:{count:0,textBytes:0,decodedBytes:0},video:{count:0,textBytes:0,decodedBytes:0},other:{count:0,textBytes:0,decodedBytes:0}}}}
  function dataURL(s,c){
    if(s.slice(0,5).toLowerCase()!=='data:')return;
    const comma=s.indexOf(',');if(comma<0||comma>1024)return;
    const head=s.slice(0,comma).toLowerCase(),kind=head.startsWith('data:image/')?'image':head.startsWith('data:video/')?'video':'other',row=c.dataURLs[kind];
    row.count++;row.textBytes+=utf8Bytes(s);
    if(/;base64$/i.test(head)){let count=0,padding=0,valid=true;for(let i=comma+1;i<s.length;i++){if((i&65535)===0)check();const code=s.charCodeAt(i);if(code===32||code===9||code===10||code===13)continue;count++;if(code===61)padding++;else if(padding||!((code>=65&&code<=90)||(code>=97&&code<=122)||(code>=48&&code<=57)||code===43||code===47||code===45||code===95))valid=false}if(padding>2||count%4===1||(padding&&count%4!==0))valid=false;if(valid)row.decodedBytes+=Math.max(0,Math.floor(count*3/4)-padding);else row.decodedUnavailable=true;}
    else row.decodedUnavailable=true;
  }
  function scanURLs(value,c,seen=new WeakSet(),d=0){check(d);if(typeof value==='string'){dataURL(value,c);return}if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);for(const key of Object.keys(value))scanURLs(value[key],c,seen,d+1)}
  function readEstimate(value,seen=new WeakSet(),d=0){check(d);if(typeof value==='string')return value.length*2;if(!value||typeof value!=='object'||seen.has(value))return 0;seen.add(value);if(value instanceof Blob)return value.size;if(value instanceof ArrayBuffer||ArrayBuffer.isView(value))return value.byteLength;let n=0;if(value instanceof Map){for(const [k,v] of value)n+=readEstimate(k,seen,d+1)+readEstimate(v,seen,d+1)}else if(value instanceof Set){for(const v of value)n+=readEstimate(v,seen,d+1)}else for(const k of Object.keys(value))n+=k.length*2+16+readEstimate(value[k],seen,d+1);return n}
  // Computes the CURRENT export's tagged, two-space-indented UTF-8 JSON size.
  // Only small metadata sizes are retained; no encoded tree/string/Blob is built.
  async function tagged(value,d,c){
    check(d);const str=(s,depth)=>stringBytes(s),simple=(fields)=>objectSize(fields.map(([k,v])=>[k,typeof v==='string'?str(v,d+1):v]),d);
    if(value===undefined)return simple([['t','undefined']]);
    if(value===null||typeof value==='string'||typeof value==='boolean'){
      if(typeof value==='string')dataURL(value,c);
      return objectSize([['t',str('value')],['v',value===null?4:typeof value==='string'?str(value):value?4:5]],d);
    }
    if(typeof value==='number')return simple([['t','number'],['v',Object.is(value,-0)?'-0':String(value)]]);
    if(typeof value==='bigint')return simple([['t','bigint'],['v',String(value)]]);
    if(typeof value!=='object')throw new Error('未対応の保存値があります。');
    if(c.seen.has(value))return objectSize([['t',str('ref')],['id',String(c.seen.get(value)).length]],d);
    const id=c.id++;c.seen.set(value,id);const idSize=String(id).length;
    if(value instanceof Blob||value instanceof ArrayBuffer||ArrayBuffer.isView(value)){
      const blob=value instanceof Blob,size=blob?value.size:value.byteLength,type=blob?value.type:'',path=`binary/${String(++c.binary).padStart(6,'0')}.${blob?extension(type):'bin'}`;
      c.files.push({path,bytes:size,kind:'binary'});if(blob){c.blobBytes+=size;if(type.startsWith('image/'))c.imageBytes+=size}
      const fields=[['t',str(blob?(value instanceof File?'file':'blob'):'buffer')],['id',idSize]];
      if(blob)fields.push(['path',str(path)],['mime',str(type)],['size',String(size).length]);else fields.push(['kind',str(value.constructor.name)],['path',str(path)],['size',String(size).length]);
      if(value instanceof File)fields.push(['name',str(value.name)],['lastModified',String(value.lastModified).length]);
      return objectSize(fields,d);
    }
    if(value instanceof Date)return objectSize([['t',str('date')],['id',idSize],['v',Number.isFinite(value.getTime())?String(value.getTime()).length:4]],d);
    if(value instanceof RegExp)return objectSize([['t',str('regexp')],['id',idSize],['source',str(value.source)],['flags',str(value.flags)]],d);
    const kind=value instanceof Records||Array.isArray(value)?'array':value instanceof Map?'map':value instanceof Set?'set':'object';
    let count=0,sum=0;
    const add=bytes=>{count++;sum+=bytes};
    if(value instanceof Records){for await(const row of value.iterator()){const size=await tagged(row,d+2,c);c.lastRecordSize=size;add(size)}}
    else if(kind==='array'){for(let i=0;i<value.length;i++)add(i in value?await tagged(value[i],d+2,c):objectSize([['t',str('hole')]],d+2))}
    else if(kind==='set'){for(const x of value)add(await tagged(x,d+2,c))}
    else if(kind==='map'){for(const [k,v] of value)add(arraySize([await tagged(k,d+3,c),await tagged(v,d+3,c)],d+2))}
    else{
      if(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)throw new Error('未対応の保存形式があります。');
      for(const k of Object.keys(value))add(arraySize([str(k),await tagged(value[k],d+3,c)],d+2));
    }
    const array=count?2+sum+count*2*(d+2)+2*(count-1)+2+2*(d+1):2;
    if((operations&2047)===0)await pause();
    return objectSize([['t',str(kind)],['id',idSize],['v',array]],d);
  }
  async function listDB(){if(typeof indexedDB.databases!=='function')throw new Error('既存DBの安全な列挙に対応していません。');return (await indexedDB.databases()).filter(x=>x.name&&dbScope.test(x.name)).sort((a,b)=>a.name.localeCompare(b.name))}
  function openDB(info){return new Promise((resolve,reject)=>{
    let settled=false;const request=indexedDB.open(info.name,info.version),timer=setTimeout(()=>done(new Error('DBの読み取り開始がタイムアウトしました。')),10000);
    function done(error,db){if(settled){db?.close();return}settled=true;clearTimeout(timer);error?reject(error):resolve(db)}
    request.onupgradeneeded=()=>{request.transaction.abort();done(new Error('DB構成が変化しました。新規作成は中止しました。'))};
    request.onerror=()=>done(new Error('DBを開けませんでした。'));request.onblocked=()=>done(new Error('DBが使用中です。'));request.onsuccess=()=>done(null,request.result);
  })}
  function transactionRead(db,store,read){return new Promise((resolve,reject)=>{
    let result;const tx=db.transaction(store,'readonly'),request=read(tx.objectStore(store));
    const timer=setTimeout(()=>{try{tx.abort()}catch{}reject(new Error('ストア読取がタイムアウトしました。'))},10000);
    request.onsuccess=()=>{const cursor=request.result;result=cursor&&typeof cursor.continue==='function'?{key:cursor.primaryKey,value:cursor.value}:cursor};
    tx.oncomplete=()=>{clearTimeout(timer);resolve(result)};tx.onabort=tx.onerror=()=>{clearTimeout(timer);reject(new Error('ストアを読み取れませんでした。'))};
  })}
  async function* records(db,name){let last,first=true;for(;;){check();const row=await transactionRead(db,name,s=>s.openCursor(first?undefined:IDBKeyRange.lowerBound(last,true)));if(!row)break;first=false;last=row.key;yield row;await pause()}}
  function localRows(){const out=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&scope.test(key))out.push({key,value:localStorage.getItem(key),classification:['life_archive_craft_materials_v1','life_archive_craft_reverse_v1','life_archive_triad_npcs_v1','life_archive_guildleves_v8','life_archive_guildleves_v9_delivery_items'].includes(key)?'reacquirable-cache':'user-or-legacy-data'})}return out.sort((a,b)=>a.key.localeCompare(b.key))}
  function verdict(files){let sum=0;const steps=[];for(const f of files){const single=f.bytes>SINGLE,total=sum+f.bytes>TOTAL;steps.push({file:f.path,bytes:f.bytes,cumulativeBytes:sum+f.bytes,single64MiB:single,total256MiB:total});sum+=f.bytes}return {kind:'現行形式への換算値。実行時点の推定であり、過去の失敗の実測値ではありません。',totalBytes:sum,firstFailure:steps.find(s=>s.single64MiB||s.total256MiB)||null,files:steps}}
  async function diagnose(progress=()=>{}){
    operations=0;started=performance.now();cancelled=false;
    const result={format:'hikachoku-capacity-diagnostic-v1',complete:false,measurements:'件数・Blob.sizeは読取値。JSON容量はUTF-8表現の計算値で、実ディスク占有量ではありません。変換後は現行書出形式への換算推定値。',localStorage:[],indexedDB:[],main:null,memory:null,duplicates:[],unavailable:[],warnings:['診断中は他のタブも含め編集を控えてください。保存領域間を原子的に固定する診断ではありません。','未知のキー・DB・ストア名と、レコード名・本文・画像・ハッシュは表示・コピーしません。'],recommendations:[]};
    const ctx=context(),signatures={},sources={};let local,listing,area='開始準備',readBudget=0,recordCount=0,memoryReadEstimate=0;
    try{
      if(!crypto.subtle)throw new Error('SHA-256による重複比較にはHTTPSが必要です。');
      area='localStorage';progress('localStorageの容量を数えています…');local=localRows();
      readBudget+=readEstimate(local);
      let extra=0;
      for(const row of local){result.localStorage.push({key:safeKey.test(row.key)?row.key:`追加キー${++extra}`,valueUTF8Bytes:utf8Bytes(row.value||''),keyUTF8Bytes:utf8Bytes(row.key),estimatedUTF16Bytes:2*(row.key.length+(row.value?.length||0)),classification:row.classification});}
      const localURLContext=context();for(const row of local){let value;try{value=JSON.parse(row.value)}catch{value=row.value}scanURLs(value,localURLContext)}result.localStorageDataURLs=localURLContext.dataURLs;
      ctx.files.push({path:'localStorage.json',bytes:await prettyLocalSize(local),kind:'json'});
      const rawMain=local.find(r=>r.key==='lifeArchiveData');
      if(rawMain)try{const fp=await fingerprint(JSON.parse(rawMain.value));signatures.localStorage=fp.signature;sources.localStorage={bytes:fp.size}}catch{result.unavailable.push('localStorage本体の重複比較（JSON形式を確認できません）')}
      area='LIVE_DATA';progress('メモリー上の本体を数えています…');
      const memory=typeof LIVE_DATA!=='undefined'?LIVE_DATA:null;
      memoryReadEstimate=readEstimate(memory);
      let memoryOriginal=null;
      if(memory!==null){memoryOriginal=await fingerprint(memory);signatures.LIVE_DATA=memoryOriginal.signature;sources.LIVE_DATA={bytes:memoryOriginal.size};result.memory={source:'LIVE_DATA',originalJSONBytes:memoryOriginal.size};}
      const memBytes=await tagged(memory,0,ctx);ctx.files.push({path:'memory.json',bytes:memBytes,kind:'json'});if(result.memory)result.memory.taggedJSONBytes=memBytes;
      area='IndexedDB一覧';listing=await listDB();let extraDB=0;
      for(let i=0;i<listing.length;i++){
        check();const info=listing[i],label=knownDB.has(info.name)?info.name:`追加DB${++extraDB}`;area=`IndexedDB/${label}`;const db=await openDB(info);
        try{
          let changed=false;db.onversionchange=()=>{changed=true;db.close()};
          const row={database:label,version:db.version,stores:[],taggedJSONBytes:0};result.indexedDB.push(row);let extraStore=0;
          const virtual={name:info.name,version:db.version,stores:[]};
          for(const name of [...db.objectStoreNames].sort()){
            const tx=db.transaction(name,'readonly'),store=tx.objectStore(name);
            const meta={name,keyPath:store.keyPath,autoIncrement:store.autoIncrement,indexes:[...store.indexNames].map(n=>{const x=store.index(n);return {name:n,keyPath:x.keyPath,unique:x.unique,multiEntry:x.multiEntry}})};
            const labelStore=['state','notes','images'].includes(name)?name:`追加ストア${++extraStore}`;
            const stat={store:labelStore,count:0,originalJSONBytes:0,blobBytes:0,imageBlobBytes:0,taggedRecordsBytes:0};row.stores.push(stat);
            const initialCount=await transactionRead(db,name,s=>s.count());
            meta.records=new Records(async function*(){
              for await(const record of records(db,name)){
                area=`IndexedDB/${label}/${labelStore}`;progress(`${label}/${labelStore} を読み取っています（${stat.count+1}件目）…`);
                stat.count++;
                readBudget+=readEstimate(record);recordCount++;
                const before=ctx.blobBytes,imagesBefore=ctx.imageBytes;
                let raw=null;try{raw=rawSize(record.value);stat.originalJSONBytes+=raw}catch{result.unavailable.push(`${label}/${labelStore} の一部レコードの通常JSON容量`)}
                if(info.name==='LifeArchiveDB'&&name==='state'&&record.key==='main'){
                  const fp=await fingerprint(record.value);signatures.IndexedDB=fp.signature;sources.IndexedDB={bytes:fp.size};result.main={source:'LifeArchiveDB/state/main',originalJSONBytes:fp.size};
                  const fields=new Set(['_savedAt','inbox','records','historyItems','historyEvents','toolChecklists','trpgAnalyses','people','characterRelations','scenarioLibrary','quickCaptures','shopping','purchases','foodInventory','cookingRecipes','cookingHistory','achievements','manualProgressLists','fishing','fishingProgress','craftingProgress','craftingPlan','craftInventory','guildleveProgress','yokaiProgress','minionProgress','mountProgress','cardProgress','triadNpcProgress','weapons','backupMeta','settings','migrated','wikiPages','wikiEditLog','activityDiary','ffxivVideos','goals','achievementProgress','ffProfile','characters','relicProgress','stackParents','stackDays','stackEntries']);result.main.fields=[];let extraField=0;
                  if(record.value&&typeof record.value==='object')for(const field of Object.keys(record.value))result.main.fields.push({field:fields.has(field)?field:`追加フィールド${++extraField}`,originalJSONBytes:rawSize(record.value[field])});
                }
                // tagged() resumes while the row is yielded; observe totals afterwards.
                yield record;
                stat.blobBytes+=ctx.blobBytes-before;stat.imageBlobBytes+=ctx.imageBytes-imagesBefore;
                stat.taggedRecordsBytes+=ctx.lastRecordSize||0;
                if(result.main&&info.name==='LifeArchiveDB'&&name==='state'&&record.key==='main')result.main.taggedRecordBytes=ctx.lastRecordSize;
              }
            });virtual.stores.push(meta);
            // Count is checked after traversal below; no writes or keepalive requests.
            stat.initialCount=initialCount;stat._actualName=name;
          }
          row.taggedJSONBytes=await tagged(virtual,0,ctx);
          const path=`indexedDB/${String(i+1).padStart(3,'0')}.json`;ctx.files.push({path,bytes:row.taggedJSONBytes,kind:'json'});row.file=path;
          for(const stat of row.stores){const after=await transactionRead(db,stat._actualName,s=>s.count());delete stat._actualName;if(stat.count!==stat.initialCount||after!==stat.initialCount)throw new Error('診断中にストア件数が変わりました。');}
          row.originalJSONBytes=row.stores.reduce((n,s)=>n+s.originalJSONBytes,0);row.expansionRatio=row.originalJSONBytes?row.taggedJSONBytes/row.originalJSONBytes:null;
          if(changed)throw new Error('診断中にDB構成が変わりました。');
        }finally{db.close()}
      }
      if(memory!==null){const after=await fingerprint(memory);if(after.signature!==memoryOriginal.signature)throw new Error('診断中にメモリー本体が変わりました。');}
      const afterLocal=localRows();const a=await fingerprint(local),b=await fingerprint(afterLocal);if(a.signature!==b.signature)throw new Error('診断中にlocalStorageが変わりました。');
      const afterDBs=await listDB();if(JSON.stringify(listing)!==JSON.stringify(afterDBs))throw new Error('診断中にDB一覧が変わりました。');
      for(const [left,right] of [['LIVE_DATA','localStorage'],['LIVE_DATA','IndexedDB'],['localStorage','IndexedDB']])result.duplicates.push({sources:[left,right],comparison:signatures[left]&&signatures[right]?(signatures[left]===signatures[right]?'通常JSON表現が一致':'通常JSON表現が異なる（意味の同一性までは判定しません）'):'一方または両方が存在しない、または比較不可'});
      result.sourceCopies=Object.entries(sources).map(([source,v])=>({source,...v}));
      result.binary={allBlobBytes:ctx.blobBytes,imageBlobBytes:ctx.imageBytes,note:'保存元ごとの実体を合算。内容が同じ別コピーも含みます。画像データは読み出して表示しません。'};
      result.dataURLs=ctx.dataURLs;result.backupProjection=verdict(ctx.files);
      result.readGuard={estimatedBytes:readBudget+memoryReadEstimate,limitBytes:TOTAL,exceeded:readBudget+memoryReadEstimate>TOTAL,recordCount,recordLimit:200000,recordLimitExceeded:recordCount>200000,note:'現行captureの概算と同じ規則。実際のヒープ計測ではありません。この制限が超過するとJSON変換より先に停止します。'};
      result.dataURLNote='dataURLsはLIVE_DATAとIndexedDBの保存元別合計。localStorageDataURLsは別計上。同じ内容のコピーも合算します。decodedBytesは有効なBase64の概算です。';
      result.duplicateNote='JSON表現の一致のみ比較します。Blobや通常JSONで表現できない型の内容一致・意味の同一性は保証しません。';
      if(result.main){result.main.expansionRatio=result.main.taggedRecordBytes/result.main.originalJSONBytes;result.main.taggedRecordNote='変換後はmainキーとレコード枠を含む換算値。';}
      result.storageCapacityNote='ストアの元容量は各valueの通常JSONバイト数合計です。BlobはJSONでは空オブジェクトになるため、本体バイト数をbinaryに別計上します。通常JSON容量はIndexedDB実ディスク占有量ではありません。';
      result.recommendations=['型情報・字下げによる膨張を抑え、巨大レコードを分割して順次処理する設計を検討。','単一ファイル容量と総量・作業メモリー上限を区別する。制限は自動変更しません。'];
      result.complete=true;
    }catch(error){result.unavailable.push('診断は未完了です。上限判定・重複・総容量の未確定値を成功扱いしません。');result.failureArea=area;result.failure=cancelled?'診断を中止しました。':safeError(error);}
    if(!result.complete){result.partialBinary={allBlobBytes:ctx.blobBytes,imageBlobBytes:ctx.imageBytes};result.backupProjection={kind:'未完了のため判定不可'};}
    result.durationMs=Math.round(performance.now()-started);return result;
  }
  // This handles ONLY the small fixed localStorage record envelope; its value strings
  // are counted with stringBytes, never stringified as a whole.
  async function prettyLocalSize(rows){const sizes=[];for(const r of rows)sizes.push(objectSize([['key',stringBytes(r.key)],['value',r.value===null?4:stringBytes(r.value)],['classification',stringBytes(r.classification)]],1));return arraySize(sizes,0)}
  function safeError(e){
    const allowed=new Set(['利用者が診断を中止しました。','安全上の深さ上限に達しました。','安全上の処理量・時間上限に達しました。','DB構成が変化しました。新規作成は中止しました。','DBの読み取り開始がタイムアウトしました。','DBを開けませんでした。','DBが使用中です。','ストア読取がタイムアウトしました。','ストアを読み取れませんでした。','診断中にストア件数が変わりました。','診断中にDB構成が変わりました。','診断中にメモリー本体が変わりました。','診断中にlocalStorageが変わりました。','診断中にDB一覧が変わりました。','既存DBの安全な列挙に対応していません。','SHA-256による重複比較にはHTTPSが必要です。','循環参照の通常JSON容量・重複比較は未対応です。','通常JSONで表現できない型の容量比較は未対応です。','未対応の保存値があります。','未対応の保存形式があります。']);
    const msg=String(e?.message||'');return allowed.has(msg)?msg:'保存領域の読み取りまたは容量計算に失敗しました。詳細な値や本文は表示しません。';
  }
  function renderTable(result){
    const target=document.getElementById('capacityDiagnosticTable');if(!target)return;target.replaceChildren();
    const table=document.createElement('table');table.style.width='100%';
    const row=(cells,head=false)=>{const tr=document.createElement('tr');for(const value of cells){const td=document.createElement(head?'th':'td');td.textContent=String(value);td.style.cssText='padding:6px;text-align:left;border-bottom:1px solid var(--line)';tr.appendChild(td)}table.appendChild(tr)};
    const size=n=>n===undefined?'未計算':`${(n/MIB).toFixed(2)} MiB`;
    row(['保存領域','件数（読取）','元JSON/文字列（計算値）','変換後（推定）','Blob（読取）'],true);
    for(const r of result.localStorage)row([`localStorage/${r.key}`,1,size(r.valueUTF8Bytes),'保存キー全体の換算は詳細へ','—']);
    if(result.memory)row(['LIVE_DATA',1,size(result.memory.originalJSONBytes),size(result.memory.taggedJSONBytes),'保存元別合計は詳細へ']);
    for(const db of result.indexedDB){row([db.database,db.stores.reduce((n,s)=>n+s.count,0),size(db.originalJSONBytes),size(db.taggedJSONBytes),size(db.stores.reduce((n,s)=>n+s.blobBytes,0))]);for(const s of db.stores)row([`${db.database}/${s.store}`,s.count,size(s.originalJSONBytes),size(s.taggedRecordsBytes),size(s.blobBytes)]);}
    if(result.main)row(['LifeArchiveDB/state/main',1,size(result.main.originalJSONBytes),size(result.main.taggedRecordBytes),'本体の画像・動画内訳は詳細へ']);
    target.appendChild(table);
    const note=document.createElement('p');note.className='small';note.textContent='ストアの変換後はレコード枠を含み、DB全体はストア・索引の定義も含みます。Blob本体は別ファイルとして加算。未完了の診断では表の一部が途中値です。';target.appendChild(note);
  }
  const button=document.getElementById('capacityDiagnose'),output=document.getElementById('capacityDiagnosticResult'),copy=document.getElementById('capacityDiagnosticCopy'),cancel=document.getElementById('capacityDiagnosticCancel');
  if(button&&output)button.addEventListener('click',async()=>{
    const exportButton=document.getElementById('fullBackupExport'),ordinary=document.getElementById('fullBackupOrdinaryJSON');
    if(exportButton?.disabled){output.textContent='バックアップ処理の完了後に診断してください。';return;}
    if(running)return;running=true;button.disabled=true;copy.disabled=true;cancel.disabled=false;lastText='';
    const priorDisabled=ordinary?.disabled;if(exportButton)exportButton.disabled=true;if(ordinary)ordinary.disabled=true;
    document.getElementById('capacityDiagnosticTable')?.replaceChildren();
    try{const result=await diagnose(text=>{output.textContent=text});lastText=JSON.stringify(result,null,2);output.textContent=lastText;copy.disabled=false;renderTable(result);
      const format=n=>`${(n/MIB).toFixed(2)} MiB (${n.toLocaleString('ja-JP')}バイト)`;
      const first=result.backupProjection?.firstFailure;
      document.getElementById('capacityDiagnosticSummary').textContent=!result.complete?`診断未完了：${result.failureArea}。${result.failure}`:result.readGuard.exceeded||result.readGuard.recordLimitExceeded?'現行の読み取り時の安全上限を超える推定です。変換後の制限より先に停止する可能性があります。':first?`変換後の推定で制限超過：${first.file}。単一64MiB：${first.single64MiB?'超過':'未超過'}、合計256MiB：${first.total256MiB?'超過':'未超過'}。このファイル ${format(first.bytes)}、累計 ${format(first.cumulativeBytes)}。${result.main?`本体の膨張倍率は約${result.main.expansionRatio.toFixed(2)}倍。`:''}`:`換算推定では単一64MiB・合計256MiBの超過なし。合計 ${format(result.backupProjection.totalBytes)}。読み取り時のメモリー見積もり制限は別判定です。`;
    }
    catch{output.textContent='診断に失敗しました。保存データは変更していません。';}
    finally{running=false;button.disabled=false;cancel.disabled=true;if(exportButton)exportButton.disabled=false;if(ordinary)ordinary.disabled=priorDisabled}
  });
  cancel?.addEventListener('click',()=>{cancelled=true});
  copy?.addEventListener('click',async()=>{if(!lastText)return;try{await navigator.clipboard.writeText(lastText);document.getElementById('capacityDiagnosticCopyStatus').textContent='技術情報だけをコピーしました。'}catch{document.getElementById('capacityDiagnosticCopyStatus').textContent='コピーできませんでした。下の診断結果を選択してコピーしてください。'}});
  window.HikachokuCapacityDiagnostic=Object.freeze({diagnose});
})();
