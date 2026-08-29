
(()=>{
  const $=id=>document.getElementById(id);
  const KEY="eorzea_lodestone_proxy_v1";
  const clean=v=>{let s=String(v||"").trim();if(s&&!/^https?:\/\//i.test(s))s="https://"+s;return s.replace(/\/+$/,"")};
  const normalizeId=v=>{
    const s=String(v||"").trim();
    const m=s.match(/\/lodestone\/character\/(\d+)/i);
    if(m)return m[1];
    return /^\d+$/.test(s)?s:"";
  };
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  async function testWorker(){
    const status=$("ffLodestoneProxyStatus");
    const proxy=clean($("ffLodestoneProxy")?.value || localStorage.getItem(KEY));
    const id=normalizeId($("ffLodestoneId")?.value);
    if(!proxy){
      if(status)status.innerHTML="<b>⚠ Worker URLが未設定です。</b>";
      return;
    }
    if(!id){
      if(status)status.innerHTML="<b>⚠ Lodestone IDまたはURLを入力してください。</b>";
      return;
    }
    localStorage.setItem(KEY,proxy);
    if(status)status.innerHTML="<b>接続テスト中…</b>";
    try{
      const url=`${proxy}?id=${encodeURIComponent(id)}&page=profile`;
      const r=await fetch(url,{cache:"no-store"});
      const txt=await r.text();
      if(!r.ok)throw new Error(`HTTP ${r.status}${txt?` / ${txt.slice(0,160).replace(/\s+/g," ")}`:""}`);
      if(txt.length<1000)throw new Error(`応答が短すぎます（${txt.length}文字）`);
      if(status)status.innerHTML=`<b>✓ Worker応答OK</b><div class="small">Lodestone HTMLを ${txt.length.toLocaleString("ja-JP")}文字取得しました。</div>`;
    }catch(e){
      console.error("Standalone Worker test failed",e);
      if(status)status.innerHTML=`<b>⚠ Worker接続テスト失敗</b><div class="small">${esc(e?.message||String(e))}</div>`;
    }
  }

  function saveWorker(){
    const status=$("ffLodestoneProxyStatus");
    const v=clean($("ffLodestoneProxy")?.value);
    if(v)localStorage.setItem(KEY,v); else localStorage.removeItem(KEY);
    if(status)status.textContent=v?"Worker URLを保存しました。":"Worker URLを入力してください。";
  }

  function bind(){
    const input=$("ffLodestoneProxy");
    if(input && !input.value)input.value=localStorage.getItem(KEY)||"";
    const save=$("ffLodestoneProxySave");
    const test=$("ffLodestoneProxyTest");
    if(save)save.addEventListener("click",saveWorker);
    if(test)test.addEventListener("click",testWorker);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});
  else bind();
})();
