
(()=>{
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 let lastCraftRows=[];

 function state(){try{return typeof load==="function"?load():{}}catch(e){return {}}}
 function recipeDone(d,id){return !!d?.craftingProgress?.[id]?.done}
 function invQty(d,itemId,name){
   if(typeof craftInventoryQtyFor==="function")return craftInventoryQtyFor(d?.craftInventory||{},itemId,name);
   return Number(d?.craftInventory?.[String(itemId)]?.qty||0);
 }
 function saveInv(itemId,name,qty){
   if(typeof load!=="function"||typeof save!=="function")return;
   const d=load();d.craftInventory=d.craftInventory||{};
   const key=String(itemId),q=Math.max(0,Math.floor(Number(qty)||0));
   if(q)d.craftInventory[key]={...(d.craftInventory[key]||{}),name,qty:q};
   else delete d.craftInventory[key];
   save(d);
 }

 async function ensureIndex(){
   const st=$("hubCraftStatus");
   const count=(typeof craftReverseIndex!=="undefined"&&craftReverseIndex?.recipes)?Object.keys(craftReverseIndex.recipes).length:0;
   if(count>=1000)return true;
   if(st)st.textContent="Lv1～100の必要素材データを準備しています…";
   if(typeof buildCraftReverseIndex!=="function")return false;
   return await buildCraftReverseIndex(true);
 }

 function aggregate(job,remainingOnly){
   const d=state(),map=new Map();
   const recipes=CRAFT_RECIPE_DATA.filter(r=>r.craft===job&&Number(r.level)>=1&&Number(r.level)<=100);
   const target=remainingOnly?recipes.filter(r=>!recipeDone(d,r.id)):recipes;
   let indexed=0;
   for(const r of target){
     const mats=(typeof reverseRecipeRows==="function"?reverseRecipeRows(r):[])||[];
     if(mats.length)indexed++;
     for(const m of mats){
       const key=String(m.itemId||m.name);
       if(!map.has(key))map.set(key,{itemId:m.itemId,name:m.name,need:0,tags:new Set(),recipes:0});
       const x=map.get(key);
       x.need+=Number(m.amount)||0;x.recipes++;
       x.tags.add(`#${job}Lv${r.level}`);x.tags.add("#制作手帳");
     }
   }
   const rows=[...map.values()].map(x=>{
     const have=invQty(d,x.itemId,x.name);
     return {...x,have,remain:Math.max(0,x.need-have),tags:[...x.tags]};
   }).sort((a,b)=>b.remain-a.remain||b.need-a.need||a.name.localeCompare(b.name,"ja"));
   return {recipes,target,indexed,rows};
 }

 function renderRows(){
   const box=$("hubCraftMaterials");if(!box)return;
   const q=($("hubCraftSearch")?.value||"").trim().toLowerCase(),showZero=!!$("hubCraftShowZero")?.checked;
   const rows=lastCraftRows.filter(x=>(showZero||x.remain>0)&&(!q||`${x.name} ${x.tags.join(" ")}`.toLowerCase().includes(q)));
   box.innerHTML=rows.length?rows.map(x=>`
    <div class="hub-material-row">
      <div class="hub-material-main">
        <div class="row"><b>${esc(x.name)}</b><span class="hub-need">残り <strong>${x.remain.toLocaleString("ja-JP")}</strong></span></div>
        <div class="small">必要 ${x.need.toLocaleString("ja-JP")} ／ 所持 ${x.have.toLocaleString("ja-JP")} ／ 使用レシピ ${x.recipes}件</div>
        <div class="hub-tags">${x.tags.slice(0,14).map(t=>`<span class="badge">${esc(t)}</span>`).join("")}${x.tags.length>14?`<span class="small">＋${x.tags.length-14}</span>`:""}</div>
      </div>
      <div class="hub-stock"><label>所持数</label><input class="hubInventoryQty" data-id="${esc(x.itemId)}" data-name="${esc(x.name)}" type="number" min="0" step="1" value="${x.have}"></div>
    </div>`).join(""):'<div class="empty">表示する素材はありません。</div>';
   box.querySelectorAll(".hubInventoryQty").forEach(i=>i.onchange=()=>{saveInv(i.dataset.id,i.dataset.name,i.value);runCraft(false)});
 }

 async function runCraft(rebuild=true){
   if(rebuild && !(await ensureIndex())){if($("hubCraftStatus"))$("hubCraftStatus").textContent="素材索引を取得できませんでした。";return}
   const job=$("hubCraftJob")?.value||"木工",remainingOnly=$("hubCraftRemaining")?.checked!==false;
   const x=aggregate(job,remainingOnly);lastCraftRows=x.rows;
   const totalNeed=x.rows.reduce((n,r)=>n+r.need,0),totalRemain=x.rows.reduce((n,r)=>n+r.remain,0);
   const done=x.recipes.length-x.target.length;
   $("hubCraftRecipeTotal").textContent=x.recipes.length.toLocaleString("ja-JP");
   $("hubCraftRecipeDone").textContent=done.toLocaleString("ja-JP");
   $("hubCraftMaterialKinds").textContent=x.rows.length.toLocaleString("ja-JP");
   $("hubCraftMaterialTotal").textContent=totalRemain.toLocaleString("ja-JP");
   const missing=x.target.length-x.indexed;
   $("hubCraftStatus").innerHTML=`${esc(job)} Lv1～100：${remainingOnly?"未制作分":"全レシピ"}を集計。素材 ${totalNeed.toLocaleString("ja-JP")}個 → 所持分を引いて <b>残り ${totalRemain.toLocaleString("ja-JP")}個</b>${missing>0?`<br><span class="muted">※ 素材索引未取得 ${missing}レシピは集計外です。</span>`:""}`;
   renderRows();
 }

 function searchArea(){
   const q=($("hubAreaSearch")?.value||"").trim().toLowerCase(),box=$("hubAreaResults");if(!box)return;
   if(!q){box.innerHTML='<div class="empty">エリア名を入力してください。</div>';return}
   const out=[];
   const add=(type,title,detail,tags=[])=>out.push({type,title,detail,tags});
   for(const f of (typeof FISH_DATA!=="undefined"?FISH_DATA:[])){
     if(`${f.region||""} ${f.zone||""} ${f.spot||""}`.toLowerCase().includes(q))
       add("釣り",f.name,`${f.zone||f.region||"エリア不明"}${f.spot?` ／ ${f.spot}`:""}`,[`#${f.expansion||"釣り"}`,"#釣り手帳"]);
   }
   for(const a of (typeof FF_HUNT_ACQ_PRESET!=="undefined"?FF_HUNT_ACQ_PRESET:[])){
     if(`${a.area||""} ${a.source||""} ${a.method||""}`.toLowerCase().includes(q))
       add(a.itemType||"入手品",a.name,`${a.area||""}${a.source?` ／ ${a.source}`:""}${a.cost?` ／ ${a.currency||""} ${a.cost}`:""}`,[`#${a.method||"入手"}`]);
   }
   if(typeof guildleveData!=="undefined"&&Array.isArray(guildleveData)){
     for(const l of guildleveData){
       if(`${l.place||""} ${l.acceptPlace||""} ${l.deliveryPlace||""} ${l.acceptNpc||""}`.toLowerCase().includes(q))
         add("ギルドリーヴ",l.name,`${l.acceptPlace||l.place||""}${l.level?` ／ Lv${l.level}`:""}`,[`#${l.classJob||l.category||"ギルドリーヴ"}`,"#ギルドリーヴ"]);
     }
   }
   const rows=out.slice(0,250);
   box.innerHTML=rows.length?`<div class="small" style="margin-bottom:8px">接続済みデータから ${rows.length}件。探検手帳・サブクエストは次の接続対象です。</div>${rows.map(x=>`<div class="listitem"><div class="row"><b>${esc(x.title)}</b><span class="badge">${esc(x.type)}</span></div><div class="small">${esc(x.detail)}</div><div>${x.tags.map(t=>`<span class="badge">${esc(t)}</span>`).join(" ")}</div></div>`).join("")}`:'<div class="empty">現在接続済みのデータには該当がありません。</div>';
 }

 function searchItem(){
   const q=($("hubItemSearch")?.value||"").trim().toLowerCase(),box=$("hubItemResults");if(!box)return;
   if(!q){box.innerHTML='<div class="empty">アイテム名を入力してください。</div>';return}
   const out=[],seen=new Set();
   const add=(key,type,name,detail,tags=[])=>{const k=`${key}:${name}`;if(seen.has(k))return;seen.add(k);out.push({type,name,detail,tags})};
   for(const r of (typeof CRAFT_RECIPE_DATA!=="undefined"?CRAFT_RECIPE_DATA:[]))
     if(r.name.toLowerCase().includes(q))add(`craft:${r.itemId}`,"制作",r.name,`${r.craft} Lv${r.level}`,[`#${r.craft}Lv${r.level}`,"#制作手帳"]);
   for(const a of (typeof FF_HUNT_ACQ_PRESET!=="undefined"?FF_HUNT_ACQ_PRESET:[]))
     if(`${a.name} ${a.method} ${a.source} ${a.area}`.toLowerCase().includes(q))
       add(`acq:${a.name}`,"入手・交換",a.name,`${a.method||""}${a.area?` ／ ${a.area}`:""}${a.cost?` ／ ${a.currency||""} ${a.cost}`:""}`,[`#${a.itemType||"入手品"}`]);
   for(const m of (typeof MINION_DATA!=="undefined"?MINION_DATA:[]))
     if(String(m.name||"").toLowerCase().includes(q))add(`minion:${m.id}`,"ミニオン",m.name,"収集図鑑に登録済み",["#ミニオン"]);
   for(const m of (typeof MOUNT_DATA!=="undefined"?MOUNT_DATA:[]))
     if(String(m.name||"").toLowerCase().includes(q))add(`mount:${m.id}`,"マウント",m.name,"収集図鑑に登録済み",["#マウント"]);
   box.innerHTML=out.length?out.slice(0,200).map(x=>`<div class="listitem"><div class="row"><b>${esc(x.name)}</b><span class="badge">${esc(x.type)}</span></div><div class="small">${esc(x.detail)}</div><div>${x.tags.map(t=>`<span class="badge">${esc(t)}</span>`).join(" ")}</div></div>`).join(""):'<div class="empty">該当する接続済みデータはありません。</div>';
 }

 function bind(){
   document.querySelector('.tab[data-view="eorzeaHub"]')?.addEventListener("click",()=>setTimeout(()=>runCraft(false),0));
   $("hubCraftBuild")?.addEventListener("click",()=>runCraft(true));
   $("hubCraftJob")?.addEventListener("change",()=>runCraft(false));
   $("hubCraftRemaining")?.addEventListener("change",()=>runCraft(false));
   $("hubCraftSearch")?.addEventListener("input",renderRows);
   $("hubCraftShowZero")?.addEventListener("change",renderRows);
   $("hubAreaRun")?.addEventListener("click",searchArea);
   $("hubAreaSearch")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchArea()}});
   $("hubItemRun")?.addEventListener("click",searchItem);
   $("hubItemSearch")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchItem()}});
   document.querySelectorAll(".hubAxis").forEach(b=>b.addEventListener("click",()=>{
     document.querySelectorAll(".hubAxis").forEach(x=>x.classList.toggle("active",x===b));
     document.querySelectorAll(".hub-axis-panel").forEach(p=>p.hidden=p.dataset.axis!==b.dataset.axis);
   }));
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
