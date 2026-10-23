(()=>{
  "use strict";
  const PROTOCOL="la-service-v1";
  const ALLOWED_PARENT="https://sogetuk14.github.io";

  function rows(value){return Array.isArray(value)?value:[]}
  function goalState(goal){
    const current=Number(goal?.current)||0,target=Number(goal?.target)||0;
    return {complete:target>0&&current>=target,remaining:Math.max(0,target-current)};
  }
  function manualItems(data){
    return rows(data?.manualProgressLists).flatMap(list=>rows(list?.groups).flatMap(group=>rows(group?.checklist)));
  }
  function relicCounts(data){
    let done=0,total=0;
    Object.values(data?.relicProgress||{}).forEach(state=>{
      const steps=state?.steps&&typeof state.steps==="object"?Object.values(state.steps):[];
      total+=steps.length;done+=steps.filter(Boolean).length;
      rows(state?.customSteps).forEach(step=>{total++;if(step?.done)done++});
    });
    return {done,total};
  }
  function summary(){
    const data=typeof window.load==="function"?window.load():{};
    const goals=rows(data?.goals),activeGoals=goals.filter(goal=>!goalState(goal).complete);
    const manual=manualItems(data),relic=relicCounts(data);
    const nextGoal=[...activeGoals].sort((a,b)=>(Number(b?.priority)||0)-(Number(a?.priority)||0)||String(a?.deadline||"9999-99-99").localeCompare(String(b?.deadline||"9999-99-99")))[0];
    return {
      protocol:PROTOCOL,type:"la:service-summary",service:"hikachoku",version:1,
      generatedAt:new Date().toISOString(),savedAt:Number(data?._savedAt||0),
      status:"connected",
      metrics:{activeGoals:activeGoals.length,totalGoals:goals.length,manualRemaining:manual.filter(x=>!x?.done).length,manualTotal:manual.length,relicDone:relic.done,relicTotal:relic.total},
      nextAction:nextGoal?{title:String(nextGoal.name||"GOAL"),deadline:String(nextGoal.deadline||""),remaining:goalState(nextGoal).remaining,unit:String(nextGoal.unit||"")}:null,
      links:{home:"https://sogetuk14.github.io/hikachoku/",goals:"https://sogetuk14.github.io/hikachoku/?la_view=goals",progress:"https://sogetuk14.github.io/hikachoku/?la_view=manualProgress",weapons:"https://sogetuk14.github.io/hikachoku/?la_view=weapons"}
    };
  }
  function publish(target=window.parent){
    if(target===window)return;
    try{target.postMessage(summary(),ALLOWED_PARENT)}catch(error){console.warn("HIKACHOKU LA bridge publish failed",error)}
  }
  window.addEventListener("message",event=>{
    if(event.origin!==ALLOWED_PARENT||event.source!==window.parent)return;
    if(event.data?.protocol===PROTOCOL&&event.data?.type==="la:request-summary")publish(event.source);
  });
  function init(){
    const view=new URLSearchParams(location.search).get("la_view");
    if(view&&typeof window.switchView==="function")setTimeout(()=>window.switchView(view),0);
    publish();
    window.addEventListener("storage",event=>{if(event.key==="lifeArchiveData")publish()});
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)publish()});
  }
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init,{once:true}):init();
})();
