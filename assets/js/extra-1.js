
(()=>{
 "use strict";
 const KEY="life_archive_pomodoro_v1";
 const $p=id=>document.getElementById(id);
 const defaults=()=>({mode:"work",running:false,endAt:0,remainingMs:25*60*1000,workMin:25,breakMin:5,today:"",setsToday:0,collapsed:false});
 let state=defaults(),tickHandle=0,alertHandle=0;
 function dayKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
 function loadPomo(){try{const raw=localStorage.getItem(KEY);if(raw)state={...defaults(),...JSON.parse(raw)}}catch(e){} if(state.today!==dayKey()){state.today=dayKey();state.setsToday=0} normalizeState();}
 function savePomo(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}
 function durationMs(mode=state.mode){return (mode==="work"?state.workMin:state.breakMin)*60*1000}
 function normalizeState(){state.workMin=Math.min(180,Math.max(1,Number(state.workMin)||25));state.breakMin=Math.min(60,Math.max(1,Number(state.breakMin)||5));if(!Number.isFinite(state.remainingMs)||state.remainingMs<0)state.remainingMs=durationMs();}
 function remaining(){return state.running?Math.max(0,state.endAt-Date.now()):Math.max(0,state.remainingMs)}
 function fmt(ms){const s=Math.ceil(ms/1000),m=Math.floor(s/60),r=s%60;return `${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}`}
 function beep(){try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const c=new A(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=740;g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.15,c.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.5);o.start();o.stop(c.currentTime+.52);setTimeout(()=>c.close(),700)}catch(e){}}
 function alertPomo(text){const el=$p("pomodoroAlert");if(!el)return;el.textContent=text;el.classList.add("pomo-alert-show");clearTimeout(alertHandle);alertHandle=setTimeout(()=>el.classList.remove("pomo-alert-show"),9000);beep();}
 function switchMode(auto=false){const was=state.mode;if(was==="work"&&auto)state.setsToday=(Number(state.setsToday)||0)+1;state.mode=was==="work"?"break":"work";state.running=false;state.remainingMs=durationMs(state.mode);state.endAt=0;savePomo();renderPomo();if(auto)alertPomo(state.mode==="break"?"休憩です。いったん画面から目を離しましょう。":"休憩終了。次の作業を始められます。");}
 function complete(){switchMode(true);}
 function renderPomo(){const box=$p("pomodoroMini");if(!box)return;const ms=remaining();if(state.running&&ms<=0){complete();return}const text=fmt(ms);$p("pomoTime").textContent=text;$p("pomoMode").textContent=state.mode==="work"?(state.running?"作業中":"作業時間"):(state.running?"休憩中":"休憩時間");$p("pomoStart").textContent=state.running?"一時停止":"開始";$p("pomoCount").textContent=`今日 ${Number(state.setsToday)||0}セット`;$p("pomoTitle").dataset.mini=text;box.classList.toggle("pomo-break",state.mode==="break");box.classList.toggle("pomo-paused",!state.running);box.classList.toggle("collapsed",!!state.collapsed);$p("pomoCollapse").textContent=state.collapsed?"＋":"－";if(document.activeElement!==$p("pomoWorkMin"))$p("pomoWorkMin").value=state.workMin;if(document.activeElement!==$p("pomoBreakMin"))$p("pomoBreakMin").value=state.breakMin;}
 function startPause(){if(state.running){state.remainingMs=remaining();state.running=false;state.endAt=0}else{if(remaining()<=0)state.remainingMs=durationMs();state.running=true;state.endAt=Date.now()+state.remainingMs}savePomo();renderPomo();}
 function reset(){state.running=false;state.endAt=0;state.remainingMs=durationMs();savePomo();renderPomo();}
 function updateDurations(){const oldWork=state.workMin,oldBreak=state.breakMin;state.workMin=Math.min(180,Math.max(1,Number($p("pomoWorkMin").value)||25));state.breakMin=Math.min(60,Math.max(1,Number($p("pomoBreakMin").value)||5));if(!state.running && ((state.mode==="work"&&oldWork!==state.workMin)||(state.mode==="break"&&oldBreak!==state.breakMin)))state.remainingMs=durationMs();savePomo();renderPomo();}
 function init(){loadPomo();const box=$p("pomodoroMini");if(!box)return;$p("pomoStart").onclick=startPause;$p("pomoReset").onclick=reset;$p("pomoSkip").onclick=()=>switchMode(false);$p("pomoCollapse").onclick=()=>{state.collapsed=!state.collapsed;savePomo();renderPomo()};$p("pomoWorkMin").onchange=updateDurations;$p("pomoBreakMin").onchange=updateDurations;renderPomo();tickHandle=setInterval(renderPomo,500);document.addEventListener("visibilitychange",renderPomo);window.addEventListener("focus",renderPomo);}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
