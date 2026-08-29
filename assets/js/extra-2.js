
(()=>{
 "use strict";
 const KEY="life_archive_et_alarms_v1";
 const RATIO=144/7; // 70 real minutes = 24 Eorzea hours.
 const ET_DAY=24*60*60*1000;
 const $e=id=>document.getElementById(id);
 let state={alarms:[]};
 let lastEtTotal=Date.now()*RATIO;
 let alertHandle=0;

 function uid(){return (crypto&&crypto.randomUUID)?crypto.randomUUID():"eta_"+Date.now().toString(36)+Math.random().toString(36).slice(2)}
 function pad(n){return String(n).padStart(2,"0")}
 function etTotal(){return Date.now()*RATIO}
 function etParts(total=etTotal()){
   const dayMs=((total%ET_DAY)+ET_DAY)%ET_DAY;
   const mins=Math.floor(dayMs/60000);
   return {hour:Math.floor(mins/60),minute:mins%60,minuteOfDay:mins,day:Math.floor(total/ET_DAY)};
 }
 function load(){
   try{
     const raw=localStorage.getItem(KEY);
     if(raw){
       const parsed=JSON.parse(raw);
       state={alarms:Array.isArray(parsed?.alarms)?parsed.alarms:[]};
     }
   }catch(e){}
   state.alarms=state.alarms.map(a=>({
     id:a.id||uid(),
     name:String(a.name||"ETアラーム"),
     minuteOfDay:Math.max(0,Math.min(1439,Number(a.minuteOfDay)||0)),
     memo:String(a.memo||""),
     enabled:a.enabled!==false,
     lastTriggeredEtDay:Number.isFinite(Number(a.lastTriggeredEtDay))?Number(a.lastTriggeredEtDay):-1
   }));
 }
 function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}

 function beep(){
   try{
     const A=window.AudioContext||window.webkitAudioContext;if(!A)return;
     const c=new A(),g=c.createGain();g.connect(c.destination);
     const notes=[880,1175,880];
     notes.forEach((f,i)=>{
       const o=c.createOscillator();o.connect(g);o.frequency.value=f;
       const st=c.currentTime+i*.19;
       g.gain.setValueAtTime(.0001,st);
       g.gain.exponentialRampToValueAtTime(.16,st+.02);
       g.gain.exponentialRampToValueAtTime(.0001,st+.14);
       o.start(st);o.stop(st+.16);
     });
     setTimeout(()=>c.close(),900);
   }catch(e){}
 }
 function notifyAlarm(a){
   const hh=Math.floor(a.minuteOfDay/60),mm=a.minuteOfDay%60;
   const title=`ET ${pad(hh)}:${pad(mm)}　${a.name}`;
   const body=a.memo||"登録したエオルゼアアラームの時刻です。";
   const el=$e("etAlarmAlert");
   if(el){
     el.innerHTML=`<div>${escapeHtml(title)}</div>${a.memo?`<div class="small" style="margin-top:4px">${escapeHtml(a.memo)}</div>`:""}`;
     el.classList.add("show");
     clearTimeout(alertHandle);
     alertHandle=setTimeout(()=>el.classList.remove("show"),12000);
   }
   beep();
   try{
     if("Notification" in window && Notification.permission==="granted"){
       new Notification(title,{body,tag:"life-archive-et-"+a.id});
     }
   }catch(e){}
 }
 function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}

 function timeToMinute(v){
   const m=String(v||"").match(/^(\d{1,2}):(\d{2})$/);
   if(!m)return null;
   const h=Number(m[1]),mi=Number(m[2]);
   if(h<0||h>23||mi<0||mi>59)return null;
   return h*60+mi;
 }
 function nextOccurrence(a,nowTotal=etTotal()){
   const p=etParts(nowTotal);
   const todayTarget=p.day*ET_DAY+a.minuteOfDay*60000;
   return todayTarget>nowTotal?todayTarget:todayTarget+ET_DAY;
 }
 function realUntil(etMs){return Math.max(0,etMs/RATIO)}
 function fmtUntil(realMs){
   const s=Math.ceil(realMs/1000);
   if(s<60)return `${s}秒後`;
   const m=Math.floor(s/60);
   const r=s%60;
   if(m<60)return `${m}分${r?String(r)+"秒":""}後`;
   const h=Math.floor(m/60),rm=m%60;
   return `${h}時間${rm?String(rm)+"分":""}後`;
 }
 function updateClocks(){
   const now=new Date(),p=etParts();
   if($e("etClock"))$e("etClock").textContent=`ET ${pad(p.hour)}:${pad(p.minute)}`;
   if($e("ltClock"))$e("ltClock").textContent=`LT ${pad(now.getHours())}:${pad(now.getMinutes())}`;

   const enabled=state.alarms.filter(a=>a.enabled);
   if($e("etNextAlarm")){
     if(!enabled.length){
       $e("etNextAlarm").textContent="次のETアラーム：なし";
     }else{
       const next=enabled.map(a=>({a,target:nextOccurrence(a)})).sort((x,y)=>x.target-y.target)[0];
       const hh=Math.floor(next.a.minuteOfDay/60),mm=next.a.minuteOfDay%60;
       $e("etNextAlarm").textContent=`次：ET ${pad(hh)}:${pad(mm)} ${next.a.name}（${fmtUntil(realUntil(next.target-etTotal()))}）`;
       $e("etNextAlarm").title=$e("etNextAlarm").textContent;
     }
   }
 }

 function checkAlarms(){
   const nowTotal=etTotal();
   if(nowTotal<lastEtTotal){lastEtTotal=nowTotal;return}
   // Avoid replaying a huge backlog after the computer/browser was closed for a long time.
   const span=Math.min(nowTotal-lastEtTotal,ET_DAY*2);
   const from=nowTotal-span;
   for(const a of state.alarms){
     if(!a.enabled)continue;
     const firstDay=Math.floor(from/ET_DAY);
     const lastDay=Math.floor(nowTotal/ET_DAY);
     let hitDay=-1;
     for(let d=firstDay;d<=lastDay;d++){
       const target=d*ET_DAY+a.minuteOfDay*60000;
       if(target>from && target<=nowTotal)hitDay=d;
     }
     if(hitDay>=0 && a.lastTriggeredEtDay!==hitDay){
       a.lastTriggeredEtDay=hitDay;
       save();
       notifyAlarm(a);
     }
   }
   lastEtTotal=nowTotal;
 }

 function renderList(){
   const box=$e("etAlarmList");if(!box)return;
   const rows=[...state.alarms].sort((a,b)=>a.minuteOfDay-b.minuteOfDay||a.name.localeCompare(b.name,"ja"));
   box.innerHTML=rows.length?rows.map(a=>{
     const hh=Math.floor(a.minuteOfDay/60),mm=a.minuteOfDay%60;
     return `<div class="et-alarm-item">
       <div class="et-alarm-main">
        <input type="checkbox" class="etAlarmToggle" data-id="${a.id}" ${a.enabled?"checked":""} title="ON/OFF">
        <span class="et-alarm-time">ET ${pad(hh)}:${pad(mm)}</span>
        <button type="button" class="danger et-alarm-delete etAlarmDelete" data-id="${a.id}">×</button>
       </div>
       <div class="et-alarm-name" style="margin-left:23px">${escapeHtml(a.name)}</div>
       ${a.memo?`<div class="et-alarm-memo">${escapeHtml(a.memo)}</div>`:""}
      </div>`;
   }).join(""):'<div class="small" style="padding:7px 0">保存済みアラームはありません。</div>';

   box.querySelectorAll(".etAlarmToggle").forEach(c=>c.onchange=()=>{
     const a=state.alarms.find(x=>x.id===c.dataset.id);if(!a)return;
     a.enabled=c.checked;save();renderList();updateClocks();
   });
   box.querySelectorAll(".etAlarmDelete").forEach(b=>b.onclick=()=>{
     state.alarms=state.alarms.filter(x=>x.id!==b.dataset.id);
     save();renderList();updateClocks();
   });
 }

 function addAlarm(){
   const name=($e("etAlarmName")?.value||"").trim();
   const minuteOfDay=timeToMinute($e("etAlarmTime")?.value);
   const memo=($e("etAlarmMemo")?.value||"").trim();
   if(minuteOfDay==null){
     const el=$e("etAlarmAlert");if(el){el.textContent="ET時刻を入力してください。";el.classList.add("show");setTimeout(()=>el.classList.remove("show"),5000)}
     return;
   }
   state.alarms.push({id:uid(),name:name||"ETアラーム",minuteOfDay,memo,enabled:true,lastTriggeredEtDay:-1});
   save();
   if($e("etAlarmName"))$e("etAlarmName").value="";
   if($e("etAlarmMemo"))$e("etAlarmMemo").value="";
   renderList();updateClocks();
 }

 async function requestNotification(){
   const status=$e("etNotifyStatus");
   if(!("Notification" in window)){if(status)status.textContent="このブラウザは通知非対応";return}
   try{
     const result=await Notification.requestPermission();
     if(status)status.textContent=result==="granted"?"デスクトップ通知：ON":result==="denied"?"デスクトップ通知：拒否":"画面通知＋音";
   }catch(e){if(status)status.textContent="画面通知＋音";}
 }

 function renderNotifyStatus(){
   const status=$e("etNotifyStatus");if(!status)return;
   if(!("Notification" in window)){status.textContent="画面通知＋音";return}
   status.textContent=Notification.permission==="granted"?"デスクトップ通知：ON":Notification.permission==="denied"?"デスクトップ通知：拒否":"画面通知＋音";
 }

 function init(){
   load();
   if($e("etAlarmAdd"))$e("etAlarmAdd").onclick=addAlarm;
   if($e("etNotifyPermission"))$e("etNotifyPermission").onclick=requestNotification;
   renderNotifyStatus();renderList();updateClocks();
   lastEtTotal=etTotal();
   setInterval(()=>{checkAlarms();updateClocks()},500);
   document.addEventListener("visibilitychange",()=>{checkAlarms();updateClocks()});
   window.addEventListener("focus",()=>{checkAlarms();updateClocks()});
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
