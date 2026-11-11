(()=>{
"use strict";

const ALLOWED_TAGS=new Set("A B BLOCKQUOTE BR CODE DEL DETAILS DIV EM FIGCAPTION FIGURE H2 H3 HR I IMG LI MARK OL P S SECTION SMALL SPAN STRONG SUMMARY U UL".split(" "));
const DROP_TAGS=new Set(["SCRIPT","STYLE","IFRAME","OBJECT","EMBED","FORM","INPUT","BUTTON","SELECT","TEXTAREA","META","LINK"]);
const ALLOWED_ATTRS=new Set(["class","href","target","rel","src","alt","title","style","open","data-kind","data-block-id","data-x-hidden","data-rich-role","data-checkable-toggle","data-auto-toggle-depth","data-check-depth","data-media-id","data-media-size","data-rich-video-url"]);
const SAFE_CLASSES=/^(?:(?:sm-rich-[\w-]+|sm-special|kp-special|kp-special-(?:head|title|body)|kind-chip|image-grid|cols-[1-4]|kp-marker|kb-rich-(?:official-link|video))(?:\s|$))+$/;

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>crypto.randomUUID?.()||`sm-rich-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function textToHtml(text){
 const lines=String(text||"").replace(/\r/g,"").split("\n");
 return (lines.length?lines:[""]).map(line=>`<p>${line?esc(line):"<br>"}</p>`).join("");
}
function plainText(html){const d=document.createElement("div");d.innerHTML=String(html||"");return (d.innerText||d.textContent||"").replace(/\u200B/g,"").trim()}
const TEXT_BLOCK_TAGS=new Set(["P","DIV","H2","H3","BLOCKQUOTE","LI","UL","OL","SECTION","FIGURE","FIGCAPTION","DETAILS","SUMMARY"]);
function htmlWithLineBreaks(root){
 let out="";
 const newline=()=>{if(!out.endsWith("\n"))out+="\n"};
 const walk=node=>{
   if(node.nodeType===3){out+=node.textContent||"";return}
   if(node.nodeType!==1)return;
   if(node.tagName==="BR"){out+="\n";return}
   if(node.tagName==="HR"){newline();out+="――";newline();return}
   const block=TEXT_BLOCK_TAGS.has(node.tagName);
   if(block&&out&&!out.endsWith("\n"))newline();
   [...node.childNodes].forEach(walk);
   if(block)newline();
 };
 [...root.childNodes].forEach(walk);
 return out;
}
function xMaskText(text){return [...String(text||"").replace(/\r\n?/g,"\n")].map(ch=>ch==="\n"?"\n":"×").join("")}
function plainTextForX(html){
 const d=document.createElement("div");d.innerHTML=sanitizeHtml(html);
 // X用本文は、折りたたみを開けた時だけ読める内容を一切使用しない。
 // details自体を先に除くため、入れ子の深さに関係なく内部本文も除外される。
 d.querySelectorAll("details").forEach(x=>x.remove());
 const hidden=[...d.querySelectorAll('[data-x-hidden="true"]')].filter(x=>!x.parentElement?.closest('[data-x-hidden="true"]'));
 hidden.forEach(x=>x.replaceWith(document.createTextNode(xMaskText(htmlWithLineBreaks(x)))));
 return htmlWithLineBreaks(d)
   .replace(/\u200B/g,"")
   .replace(/――(?:[ \t]*――)+/g,"――")
   .replace(/\r/g,"")
   .replace(/[ \t]+\n/g,"\n")
   .replace(/\n{3,}/g,"\n\n")
   .trim();
}
function hasXHidden(html){const d=document.createElement("div");d.innerHTML=sanitizeHtml(html);return !!d.querySelector('[data-x-hidden="true"]')}
function shareHiddenHtml(html){
 const tpl=document.createElement("template");tpl.innerHTML=sanitizeHtml(html);
 const hidden=[...tpl.content.querySelectorAll('[data-x-hidden="true"]')].filter(node=>!node.parentElement?.closest('[data-x-hidden="true"]'));
 hidden.forEach(node=>{
  const button=document.createElement("span");button.className="share-inline-hidden";button.setAttribute("role","button");button.setAttribute("tabindex","0");button.setAttribute("aria-expanded","false");button.setAttribute("aria-label","隠された文章を表示");
  const label=document.createElement("span");label.className="share-inline-hidden-label";label.textContent="🙈 この部分は隠されています";
  const content=document.createElement("span");content.className="share-inline-hidden-content";while(node.firstChild)content.appendChild(node.firstChild);
  button.append(label,content);node.replaceWith(button);
 });
 return tpl.innerHTML;
}
function bindShareHidden(root=document){
 root.querySelectorAll(".share-inline-hidden").forEach(node=>{
  const reveal=()=>{if(node.classList.contains("is-revealed"))return;node.classList.add("is-revealed");node.setAttribute("aria-expanded","true");node.removeAttribute("aria-label");node.removeAttribute("role");node.removeAttribute("tabindex")};
  node.addEventListener("click",reveal,{once:true});
  node.addEventListener("keydown",event=>{if(event.key!=="Enter"&&event.key!==" ")return;event.preventDefault();reveal()});
 });
}
function safeUrl(value,{image=false}={}){
 const v=String(value||"").trim();
 if(!v)return "";
 if(image&&/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(v))return v;
 try{const u=new URL(v,location.href);return ["http:","https:"].includes(u.protocol)?u.href:""}catch{return ""}
}
function sanitizeHtml(html){
 const template=document.createElement("template");template.innerHTML=String(html||"");
 const walk=node=>{
  [...node.childNodes].forEach(child=>{
   if(child.nodeType===8){child.remove();return}
   if(child.nodeType!==1)return;
   const tag=child.tagName;
   if(DROP_TAGS.has(tag)){child.remove();return}
   if(!ALLOWED_TAGS.has(tag)){walk(child);child.replaceWith(...child.childNodes);return}
   [...child.attributes].forEach(a=>{
    const n=a.name.toLowerCase();
    if(n.startsWith("on")||!ALLOWED_ATTRS.has(n)){child.removeAttribute(a.name);return}
    if(n==="class"&&!SAFE_CLASSES.test(a.value)){child.removeAttribute("class");return}
    if(n==="style"){
     const safe=a.value.split(";").map(x=>x.trim()).filter(x=>/^(?:text-align\s*:\s*(?:left|center|right)|color\s*:\s*(?:#[0-9a-f]{3,8}|rgb\([^)]*\))|background-color\s*:\s*(?:transparent|#[0-9a-f]{3,8}|rgb\([^)]*\)))$/i.test(x)).join(";");
     if(safe)child.setAttribute("style",safe);else child.removeAttribute("style");
    }
   });
   if(tag==="A"){
    const href=safeUrl(child.getAttribute("href"));if(href){child.href=href;child.target="_blank";child.rel="noopener noreferrer"}else child.removeAttribute("href");
   }
   if(tag==="IMG"){
    const src=safeUrl(child.getAttribute("src"),{image:true});if(src)child.src=src;else{child.remove();return}
   }
   walk(child);
  });
 };
 walk(template.content);return template.innerHTML;
}
function cleanupEditorHtml(editor,extraCleanup){
 const clone=editor.cloneNode(true);
 convertTypedMarkers(clone);
 clone.removeAttribute("contenteditable");
 clone.querySelectorAll(".sm-rich-ui,.sm-outline-ui,.sm-drag-handle,.img-remove,.grid-help,.kp-special-move").forEach(x=>x.remove());
 clone.querySelectorAll(".sm-rich-selected,.sm-outline-collapsed,.sm-outline-heading,.sm-block,.sm-block-dragging,.sm-drop-before,.sm-drop-after,.sm-rich-sort-dragging,.kp-state-open,.kp-state-fail").forEach(x=>{
  x.classList.remove("sm-rich-selected","sm-outline-collapsed","sm-outline-heading","sm-block","sm-block-dragging","sm-drop-before","sm-drop-after","sm-rich-sort-dragging","kp-state-open","kp-state-fail");if(!x.className)x.removeAttribute("class");
 });
 extraCleanup?.(clone);
 return clone.innerHTML||"<p><br></p>";
}
function convertTypedMarkers(root,round=0){
 const markerFor=value=>checkToggleMarkerParts(value)||toggleMarkerParts(value)||checklistBulletParts(value);
 let converted=0;
 [...root.querySelectorAll("p,div")].forEach(line=>{
  const parent=line.parentElement,inToggleBody=!!line.closest(".sm-rich-toggle-body"),nestedBlocks=line.querySelector("p,div,details,section,figure");
  if(!root.contains(line)||line.classList.contains("sm-rich-ui")||(parent!==root&&!inToggleBody)||nestedBlocks||!line.querySelector("br"))return;
  const lines=htmlWithLineBreaks(line).replace(/\r/g,"").split("\n").map(text=>text.trim()).filter(Boolean);
  if(lines.length<2||!lines.some(markerFor))return;
  const fragment=document.createDocumentFragment();lines.forEach(text=>{const paragraph=document.createElement("p");paragraph.textContent=text;fragment.append(paragraph)});line.replaceWith(fragment);
 });
 [...root.querySelectorAll("p,div")].forEach(line=>{
  const parent=line.parentElement,inToggleBody=!!line.closest(".sm-rich-toggle-body"),nestedBlocks=line.querySelector("p,div,details,section,figure");
  if(!root.contains(line)||line.classList.contains("sm-rich-ui")||(parent!==root&&!inToggleBody)||nestedBlocks)return;
  const raw=String(line.textContent||"").trim(),checkToggle=checkToggleMarkerParts(raw),parsedToggle=checkToggle||toggleMarkerParts(raw),toggle=parsedToggle?markerDepthInContext(parsedToggle,line):null,bullet=!toggle&&checklistBulletParts(raw);if(!toggle&&!bullet)return;
  const box=document.createElement("div");
  if(toggle){
   box.innerHTML=richToggleNodeHtml({...toggle,notes:[],children:[]});const block=box.firstElementChild,body=block.querySelector(":scope > .sm-rich-toggle-body"),tail=body.querySelector(":scope > p:last-child");line.replaceWith(block);converted++;
   let next=block.nextElementSibling;while(next&&!markerFor(String(next.textContent||"").trim())&&!next.matches("h1,h2,h3,h4,h5,h6,.sm-special,hr")){const following=next.nextElementSibling;if(!next.classList.contains("sm-rich-ui"))body.insertBefore(next,tail);next=following}
   return;
  }
  box.innerHTML=inToggleBody?richChecklistItemHtml({...bullet,text:esc(bullet.text)}):richChecklistHtml([{...bullet,text:esc(bullet.text)}]);const block=box.firstElementChild,text=block.querySelector(".sm-rich-check-text");line.replaceWith(block);converted++;
  let next=block.nextElementSibling;while(next&&!markerFor(String(next.textContent||"").trim())&&!next.matches("h1,h2,h3,h4,h5,h6,.sm-special,hr")){const following=next.nextElementSibling;if(!next.classList.contains("sm-rich-ui")&&String(next.textContent||"").trim()){text.insertAdjacentHTML("beforeend",`<br>${esc(String(next.textContent||"").trim())}`);next.remove()}next=following}
 });
 nestAutoToggles(root);
 if(converted&&round<12)converted+=convertTypedMarkers(root,round+1);
 return converted;
}
function normalizeRichHtml(html){
 const box=document.createElement("div");box.innerHTML=sanitizeHtml(html);convertTypedMarkers(box);return sanitizeHtml(box.innerHTML);
}
function nestAutoToggles(root){
 const toggles=[...root.querySelectorAll('details.sm-rich-toggle[data-auto-toggle-depth]')],stack=[];
 toggles.forEach(block=>{
  const depth=Math.max(0,Math.min(12,Math.floor(Number(block.dataset.autoToggleDepth)||0)));
  const existingParent=block.parentElement?.closest?.('details.sm-rich-toggle');
  if(depth>0&&!existingParent){const parent=stack[depth-1],body=parent?.querySelector(':scope > .sm-rich-toggle-body');if(body&&!parent.contains(block)){const controls=block.previousElementSibling?.classList.contains('sm-rich-block-controls')?block.previousElementSibling:null;controls?.remove();const tail=[...body.children].reverse().find(item=>item.matches('p')&&!String(item.textContent||'').trim());body.insertBefore(block,tail||null)}}
  stack.length=depth;stack[depth]=block;
 });
}
function normalizeExistingEditor(editor){
 [...editor.childNodes].forEach(n=>{if(n.nodeType===3&&n.textContent.trim()){const p=document.createElement("p");p.textContent=n.textContent;editor.replaceChild(p,n)}});
 if(!editor.children.length)editor.innerHTML="<p><br></p>";
 return editor;
}
function ensureEditableTail(editor){
 const last=[...editor.children].filter(node=>!node.classList.contains("sm-rich-ui")).at(-1);
 if(last?.matches(".sm-special,figure,hr")){const paragraph=document.createElement("p");paragraph.innerHTML="<br>";last.after(paragraph);return paragraph}
 return null;
}
function normalizePastedHtml(html){
 const template=document.createElement("template");template.innerHTML=sanitizeHtml(html);
 const emptyBlock=node=>{
  if(node?.nodeType!==Node.ELEMENT_NODE||!node.matches("p,div"))return false;
  if(node.querySelector("img,hr,details,section,figure,iframe,audio,video"))return false;
  return !String(node.textContent||"").replace(/\u00a0/g," ").trim();
 };
 const compact=parent=>{
  let previousBlank=false;
  [...parent.children].forEach(node=>{
   if(!node.matches("details,section,.sm-special,.kp-special"))compact(node);
   if(!emptyBlock(node)){previousBlank=false;return}
   if(previousBlank)node.remove();else previousBlank=true;
  });
  while(parent.lastElementChild&&emptyBlock(parent.lastElementChild))parent.lastElementChild.remove();
 };
 compact(template.content);
 return template.innerHTML;
}
function normalizePastedText(text){
 return String(text||"").replace(/\r\n?/g,"\n").replace(/\n(?:[ \t]*\n){2,}/g,"\n\n").replace(/[ \t\n]+$/g,"");
}
function execCommand(editor,command,showUI=false,value=null){
 editor?.focus?.();
 return document.execCommand(command,showUI,value);
}
function explicitHighlightNodes(editor){
 return [...editor.querySelectorAll("mark,[style]")].filter(node=>node.tagName==="MARK"||!!node.style.backgroundColor);
}
function snapshotExplicitHighlights(editor){
 const nodes=explicitHighlightNodes(editor);if(!nodes.length)return [];
 const targets=new Set(nodes),starts=new Map();let offset=0;
 const walk=node=>{
  if(node.nodeType===Node.TEXT_NODE){offset+=node.nodeValue?.length||0;return}
  if(node.nodeType!==Node.ELEMENT_NODE)return;
  if(targets.has(node))starts.set(node,offset);
  node.childNodes.forEach(walk);
 };
 editor.childNodes.forEach(walk);
 return nodes.map(node=>({node,source:node.cloneNode(false),text:String(node.textContent||""),start:starts.get(node)||0}));
}
function longestSharedBounds(before,after){
 const a=[...String(before||"")],b=[...String(after||"")];
 if(!a.length||!b.length)return null;
 // Marker selections are normally short. Avoid a quadratic table for pasted novels.
 if(a.length*b.length>250000){const at=String(after).indexOf(String(before));return at<0?null:[at,at+a.length]}
 const rows=Array.from({length:a.length+1},()=>new Uint32Array(b.length+1));
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)rows[i][j]=a[i-1]===b[j-1]?rows[i-1][j-1]+1:Math.max(rows[i-1][j],rows[i][j-1]);
 let i=a.length,j=b.length,min=b.length,max=-1;
 while(i&&j){if(a[i-1]===b[j-1]){min=Math.min(min,j-1);max=Math.max(max,j-1);i--;j--}else if(rows[i-1][j]>=rows[i][j-1])i--;else j--}
 return max<0?null:[min,max+1];
}
function textBoundary(root,offset){
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node,left=Math.max(0,offset),last=null;
 while((node=walker.nextNode())){last=node;if(left<=node.length)return [node,left];left-=node.length}
 return last?[last,last.length]:[root,root.childNodes.length];
}
function keepHighlightRange(node,start,end){
 const length=[...String(node.textContent||"")].length;
 if(start<=0&&end>=length)return;
 const toCodeUnit=(text,count)=>[...String(text||"")].slice(0,count).join("").length;
 const text=node.textContent||"",startUnit=toCodeUnit(text,start),endUnit=toCodeUnit(text,end);
 const [startNode,startOffset]=textBoundary(node,startUnit),[endNode,endOffset]=textBoundary(node,endUnit);
 const before=document.createRange(),kept=document.createRange(),after=document.createRange();
 before.selectNodeContents(node);before.setEnd(startNode,startOffset);
 kept.setStart(startNode,startOffset);kept.setEnd(endNode,endOffset);
 after.selectNodeContents(node);after.setStart(endNode,endOffset);
 const beforeFrag=before.cloneContents(),keptFrag=kept.cloneContents(),afterFrag=after.cloneContents(),clone=node.cloneNode(false);
 clone.append(keptFrag);node.replaceWith(beforeFrag,clone,afterFrag);
}
function applyHighlightRange(editor,start,end,source){
 if(end<=start)return;
 const [startNode,startOffset]=textBoundary(editor,start),[endNode,endOffset]=textBoundary(editor,end);
 const range=document.createRange();range.setStart(startNode,startOffset);range.setEnd(endNode,endOffset);
 const clone=source.cloneNode(false),content=range.extractContents();clone.append(content);range.insertNode(clone);
}
function clearExplicitHighlight(node){
 if(node.tagName==="MARK"){node.replaceWith(...node.childNodes);return}
 node.style.removeProperty("background-color");node.style.removeProperty("background");
 if(!node.getAttribute("style"))node.removeAttribute("style");
 if(node.tagName==="SPAN"&&!node.attributes.length)node.replaceWith(...node.childNodes);
}
function restoreHighlightsAfterDelete(editor,snapshots){
 const originalNodes=new Set(snapshots.map(item=>item.node));
 explicitHighlightNodes(editor).filter(node=>!originalNodes.has(node)).forEach(clearExplicitHighlight);
 let fullText=null;
 snapshots.forEach(item=>{
  const node=item.node;
  if(!node.isConnected||!editor.contains(node)){
   const full=fullText??=String(editor.textContent||"");let found=-1,at=full.indexOf(item.text);
   while(at>=0){if(found<0||Math.abs(at-item.start)<Math.abs(found-item.start))found=at;at=full.indexOf(item.text,at+1)}
   if(found>=0)applyHighlightRange(editor,found,found+item.text.length,item.source);
   return;
  }
  const current=String(node.textContent||"");
  // Shorter content is an ordinary deletion inside the marker. Growth means the
  // browser absorbed neighbouring plain text while joining paragraphs.
  if([...current].length<=[...item.text].length)return;
  const bounds=longestSharedBounds(item.text,current);if(bounds)keepHighlightRange(node,bounds[0],bounds[1]);
 });
 editor.normalize();
}
function specialHtml(kind){
 const labels={note:"メモ",rp:"RP",secret:"秘匿",dialogue:"会話ログ"};
 if(kind==="toggle"||kind==="headingtoggle"||kind==="bodytoggle"){const style=kind==="bodytoggle"?"body":"subheading",title=style==="body"?"本文トグル":"小見出しトグル";return `<details class="sm-special sm-rich-toggle" data-toggle-style="${style}" open><summary><span>${title}</span></summary><div class="sm-rich-toggle-body"><p><br></p></div></details><p><br></p>`;}
 if(kind==="checktoggle")return `${richToggleNodeHtml({depth:0,title:"チェック付きトグル",checkable:true,notes:[],children:[]})}<p><br></p>`;
 const label=labels[kind]||"特殊ブロック";
 return `<section class="sm-special kp-special" data-kind="${esc(kind)}" data-block-id="${esc(uid())}"><div class="kp-special-head" contenteditable="false"><span class="kind-chip">${esc(label)}</span></div><div class="kp-special-title">${esc(label)}</div><div class="kp-special-body"><p><br></p></div></section><p><br></p>`;
}
function markerText(value){return String(value||"").replace(/[\u200B-\u200D\u2060\uFEFF]/g,"").trim()}
function markerCount(value,pattern){return [...String(value||"")].filter(ch=>pattern.test(ch)).length}
function markerDepthInContext(marker,line){const parent=line?.closest?.("details.sm-rich-toggle"),base=parent?Math.max(0,Math.floor(Number(parent.dataset.autoToggleDepth)||0))+1:0;return {...marker,depth:Math.min(12,base+Math.max(0,Math.floor(Number(marker?.depth)||0)))}}
function checklistBulletParts(value){const match=markerText(value).match(/^((?:[・･•·]\s*)+)\s*([\s\S]*)$/);return match?{depth:Math.max(0,markerCount(match[1],/[・･•·]/)-1),text:match[2].trim()}:null}
function richChecklistItemHtml(item={}){const depth=Math.max(0,Math.min(12,Math.floor(Number(item.depth)||0))),text=String(item.text||"").trim()||"確認すること";return `<div class="sm-rich-checklist-item" data-check-depth="${depth}" style="--check-depth:${depth}"><span data-rich-role="check-toggle">☐</span><span class="sm-rich-check-text">${text}</span></div>`}
function repairInlineChecklistItem(row){const text=row?.querySelector?.(":scope > .sm-rich-check-text");if(!text)return;[...row.childNodes].slice([...row.childNodes].indexOf(text)+1).forEach(node=>{if(node.nodeType===3&&!String(node.textContent||"").trim()){node.remove();return}text.append(document.createElement("br"));if(node.nodeType===3){text.append(node);return}while(node.firstChild)text.append(node.firstChild);node.remove()})}
function richChecklistHtml(items){return `<section class="sm-special sm-rich-article-tool" data-kind="checklist"><div class="kp-special-head"><span class="kind-chip">チェック</span></div><div class="kp-special-title">チェックリスト</div><div class="kp-special-body">${items.map(richChecklistItemHtml).join("")}</div></section>`}
function checklistItemsFromText(value){const items=[];String(value||"").replace(/\r/g,"").split("\n").forEach(line=>{const bullet=checklistBulletParts(line.trim());if(bullet){items.push({...bullet,text:esc(bullet.text)});return}if(!items.length||!line.trim())return;items[items.length-1].text+=`<br>${esc(line.trim())}`});return items}
function checklistItemDepth(item){return Math.max(0,Math.floor(Number(item?.dataset.checkDepth)||0))}
function checklistItemChecked(item){return /^☑/.test(item?.querySelector?.('[data-rich-role="check-toggle"]')?.textContent||"")}
function setChecklistItemChecked(item,checked){const toggle=item?.querySelector?.('[data-rich-role="check-toggle"]');if(toggle)toggle.textContent=checked?"☑":"☐"}
function syncRichChecklistParents(block){const items=[...block.querySelectorAll(':scope > .kp-special-body > .sm-rich-checklist-item')];for(let i=items.length-1;i>=0;i--){const depth=checklistItemDepth(items[i]),leaves=[];for(let j=i+1;j<items.length&&checklistItemDepth(items[j])>depth;j++){const nextDepth=checklistItemDepth(items[j]);if(!items[j+1]||checklistItemDepth(items[j+1])<=nextDepth)leaves.push(items[j])}if(leaves.length)setChecklistItemChecked(items[i],leaves.every(checklistItemChecked))}}
function toggleMarkerParts(value){const match=markerText(value).match(/^((?:[＞>]\s*)+)\s*([\s\S]*)$/);return match?{depth:Math.max(0,markerCount(match[1],/[＞>]/)-1),title:match[2].trim()||"トグル見出し"}:null}
function checkToggleMarkerParts(value){const source=markerText(value),forward=source.match(/^((?:[・･]\s*)+)((?:[＞>]\s*)+)([\s\S]*)$/),reverse=!forward&&source.match(/^((?:[＞>]\s*)+)((?:[・･]\s*)+)([\s\S]*)$/),match=forward||reverse;if(!match)return null;const depth=Math.max(markerCount(match[1],/[＞>]/),markerCount(match[2],/[＞>]/),markerCount(match[1],/[・･]/),markerCount(match[2],/[・･]/))-1;return {depth:Math.max(0,depth),title:match[3].trim()||"トグル見出し",checkable:true}}
function toggleNodesFromText(value,parser=toggleMarkerParts){const roots=[],stack=[];let previous=0,current=null;String(value||"").replace(/\r/g,"").split("\n").forEach(raw=>{const line=raw.trim(),marker=parser(line);if(marker){let depth=marker.depth;if(!roots.length)depth=0;else depth=Math.min(depth,previous+1);const node={...marker,depth,notes:[],children:[]};if(depth===0)roots.push(node);else (stack[depth-1]?.children||roots).push(node);stack.length=depth;stack[depth]=node;previous=depth;current=node;return}if(current&&line)current.notes.push(line)});return roots}
function richToggleNodeHtml(node){const depth=Math.max(0,Math.min(12,Math.floor(Number(node?.depth)||0))),notes=(node?.notes||[]).map(line=>`<p>${esc(line)}</p>`).join(""),children=(node?.children||[]).map(richToggleNodeHtml).join(""),check=node?.checkable?'<span data-rich-role="check-toggle">☐</span> ':"",style=node?.checkable?' data-toggle-style="check"':node?.style?` data-toggle-style="${esc(node.style)}"`:"";return `<details class="sm-special sm-rich-toggle" data-auto-toggle-depth="${depth}"${style} ${node?.checkable?'data-checkable-toggle="true" ':""}open><summary>${check}<span>${esc(node?.title||"トグル見出し")}</span></summary><div class="sm-rich-toggle-body">${notes}${children}<p><br></p></div></details>`}
function richToggleTreeHtml(nodes){return (nodes||[]).map(richToggleNodeHtml).join("")}
function toolbarHtml(options={}){const specialKinds=Array.isArray(options.specialKinds)?options.specialKinds:["note","rp","secret","dialogue","headingtoggle","bodytoggle","checktoggle"],insertKinds=Array.isArray(options.insertTools)?options.insertTools:[],toggleMenuEnabled=specialKinds.includes("checktoggle")&&insertKinds.includes("toggle"),specialButtons=[["note","＋ メモ"],["rp","＋ RP"],["secret","＋ 秘匿"],["dialogue","💬 会話"],["headingtoggle","▸ 小見出し"],["bodytoggle","▸ 本文"],["checktoggle","☑ チェック付"]].filter(([kind])=>specialKinds.includes(kind)&&(!toggleMenuEnabled||!["headingtoggle","bodytoggle","checktoggle"].includes(kind))).map(([kind,label])=>`<button type="button" data-rich-special="${kind}">${label}</button>`).join(""),insertLabels={text:"＋ 本文",toggle:"▣ 大見出しトグル",image:"🖼 画像",url:"🔗 URL",conversation:"💬 会話",mediaGroup:"▦ メディア",checklist:"☑ チェック",calculator:"Σ 計算"},insertButtons=insertKinds.filter(kind=>!toggleMenuEnabled||kind!=="toggle").map(kind=>`<button type="button" data-rich-insert="${esc(kind)}">${insertLabels[kind]||esc(kind)}</button>`).join(""),toggleMenu=toggleMenuEnabled?'<details class="sm-rich-toggle-menu"><summary>▸ トグル</summary><div><button type="button" data-rich-insert="toggle">▣ 大見出しトグル</button><button type="button" data-rich-special="headingtoggle">▸ 小見出しトグル</button><button type="button" data-rich-special="bodytoggle">▸ 本文トグル</button><button type="button" data-rich-special="checktoggle">☑ チェック付きトグル</button></div></details>':"";return `<div class="sm-rich-toolbar sm-rich-ui" contenteditable="false">
 <div class="sm-rich-group"><button type="button" data-rich-undo title="元に戻す">↶</button><button type="button" data-rich-redo title="やり直す">↷</button></div>
 <div class="sm-rich-group"><span class="sm-rich-format-wrap"><select data-rich-format aria-label="段落形式"><option value="p">本文</option><option value="h2">大見出し</option><option value="h3">小見出し</option><option value="blockquote">引用</option></select><span class="sm-rich-format-preview sm-rich-render" aria-hidden="true"><h2>大見出し</h2><h3>小見出し</h3><p>本文の見本です。</p><blockquote>引用の見本です。</blockquote></span></span><button type="button" data-rich-cmd="bold"><b>B</b></button><button type="button" data-rich-cmd="italic"><i>I</i></button><button type="button" data-rich-cmd="underline"><u>U</u></button><button type="button" data-rich-cmd="strikeThrough"><s>S</s></button></div>
 <div class="sm-rich-group"><button type="button" data-rich-cmd="justifyLeft">左</button><button type="button" data-rich-cmd="justifyCenter">中</button><button type="button" data-rich-cmd="justifyRight">右</button><button type="button" data-rich-cmd="insertUnorderedList">• 箇条書き</button><button type="button" data-rich-cmd="insertOrderedList">1. 番号</button><button type="button" data-rich-link>🔗</button><button type="button" data-rich-hr>―</button></div>
 <div class="sm-rich-group sm-rich-stationery" aria-label="マーカーとクレヨン"><span class="sm-rich-tool-label">マーカー</span><button type="button" data-rich-marker="#fff0a8" title="黄色マーカー">黄</button><button type="button" data-rich-marker="#ffd1df" title="桃色マーカー">桃</button><button type="button" data-rich-marker="#cfe7ff" title="青色マーカー">青</button><button type="button" data-rich-marker="#d8f2cf" title="緑色マーカー">緑</button><button type="button" data-rich-crayon title="クレヨン風の強調">クレヨン</button><button type="button" data-rich-clear-format title="選択範囲の装飾を外す">消す</button></div>
 ${(specialButtons||toggleMenu)?`<div class="sm-rich-group">${specialButtons}${toggleMenu}</div>`:""}
 ${options.enableXHide?'<div class="sm-rich-group"><button type="button" data-rich-x-hide title="選択部分を共有画面では伏せ、X投稿では同じ文字数の×に置き換えます">🙈 この部分を隠す</button></div>':""}
 ${insertButtons?`<div class="sm-rich-group sm-rich-insert-group" aria-label="本文へ追加">${insertButtons}</div>`:""}
 </div>`}
function toggleXHidden(editor,range){
 if(!range||range.collapsed)return false;
 const start=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement;
 const end=range.endContainer.nodeType===1?range.endContainer:range.endContainer.parentElement;
 const existing=start?.closest?.('[data-x-hidden="true"]');
 if(existing&&existing===end?.closest?.('[data-x-hidden="true"]')){existing.replaceWith(...existing.childNodes);return true}
 const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT),nodes=[];let node;
 while((node=walker.nextNode())){try{if(!node.textContent||node.parentElement?.closest('[data-x-hidden="true"]'))continue;const nodeRange=document.createRange();nodeRange.selectNodeContents(node);const endsBefore=range.compareBoundaryPoints(Range.START_TO_END,nodeRange)<=0;const startsAfter=range.compareBoundaryPoints(Range.END_TO_START,nodeRange)>=0;if(!endsBefore&&!startsAfter)nodes.push(node)}catch{}}
 let applied=0;
 nodes.reverse().forEach(textNode=>{
  const startOffset=textNode===range.startContainer?range.startOffset:0,endOffset=textNode===range.endContainer?range.endOffset:textNode.length;if(endOffset<=startOffset)return;
  let selected=textNode;if(endOffset<textNode.length)textNode.splitText(endOffset);if(startOffset>0)selected=textNode.splitText(startOffset);const span=document.createElement("span");span.className="sm-rich-x-hidden";span.dataset.xHidden="true";selected.replaceWith(span);span.appendChild(selected);applied++;
 });
 return applied>0;
}
function updateRichCalculator(block){
 if(!block)return;
 const total=[...block.querySelectorAll('[data-rich-role="calc-value"]')]
  .reduce((sum,item)=>sum+(Number(String(item.textContent||"").replace(/,/g,""))||0),0);
 const out=block.querySelector('[data-rich-role="calc-total"]');
 if(out)out.textContent=`合計 ${new Intl.NumberFormat("ja-JP",{maximumFractionDigits:4}).format(total)}`;
}
function syncRichToggleDepths(root){root.querySelectorAll("details.sm-rich-toggle").forEach(toggle=>{let depth=0,parent=toggle.parentElement?.closest?.("details.sm-rich-toggle");while(parent){depth++;parent=parent.parentElement?.closest?.("details.sm-rich-toggle")}toggle.dataset.autoToggleDepth=String(depth)})}
function syncCheckableToggleParents(toggle){let parent=toggle?.parentElement?.closest?.("details.sm-rich-toggle[data-checkable-toggle]");while(parent){const children=[...parent.querySelectorAll(":scope > .sm-rich-toggle-body > details.sm-rich-toggle[data-checkable-toggle] > summary > [data-rich-role=\"check-toggle\"]")],check=parent.querySelector(":scope > summary > [data-rich-role=\"check-toggle\"]");if(check&&children.length)check.textContent=children.every(item=>/^☑/.test(item.textContent||""))?"☑":"☐";parent=parent.parentElement?.closest?.("details.sm-rich-toggle[data-checkable-toggle]")}}
function decorateSpecialBlocks(editor){
 editor.querySelectorAll(".sm-special").forEach(block=>{
  if(block.querySelector(":scope > .sm-rich-special-remove,:scope > .kp-special-head > .sm-rich-special-remove"))return;
  const button=document.createElement("button");button.type="button";button.className="sm-rich-special-remove sm-rich-ui";button.contentEditable="false";button.textContent="削除";button.title="このブロックを削除";
  const head=block.matches("section")?block.querySelector(":scope > .kp-special-head"):null;(head||block).append(button);
 });
 editor.querySelectorAll("details.sm-rich-toggle").forEach(block=>{
  const body=block.querySelector(":scope > .sm-rich-toggle-body");if(!body)return;
  if(block.hasAttribute("data-checkable-toggle")){const summary=block.querySelector(":scope > summary");let title=summary?.querySelector(':scope > span:not([data-rich-role="check-toggle"])');if(summary&&!title){title=document.createElement("span");summary.append(" ",title)}if(title&&!String(title.textContent||"").trim()){const fallen=[...body.children].find(item=>!item.classList.contains("sm-rich-ui")&&item.matches("p,div")&&String(item.textContent||"").trim());if(fallen){title.innerHTML=fallen.innerHTML;fallen.remove()}}}
  if(block.querySelector(":scope > .sm-rich-toggle-body > .sm-rich-toggle-actions"))return;
  const actions=document.createElement("div");actions.className="sm-rich-toggle-actions sm-rich-ui";actions.contentEditable="false";actions.innerHTML='<button type="button" data-toggle-child>＋ 子</button><button type="button" data-toggle-sibling>＋ 同階層</button><button type="button" data-toggle-indent>→ 子にする</button><button type="button" data-toggle-outdent>← 外へ出す</button>';
  const makeToggle=depth=>{const box=document.createElement("div");box.innerHTML=richToggleNodeHtml({depth,title:"チェック付きトグル",checkable:true,notes:[],children:[]});return box.firstElementChild};
  actions.querySelector("[data-toggle-child]").onclick=e=>{e.preventDefault();e.stopPropagation();const child=makeToggle((Number(block.dataset.autoToggleDepth)||0)+1),tail=[...body.children].reverse().find(item=>item.matches("p")&&!String(item.textContent||"").trim());body.insertBefore(child,tail||null);syncRichToggleDepths(editor);decorateSpecialBlocks(editor);editor.dispatchEvent(new Event("input",{bubbles:true}));child.querySelector("summary span:last-child")?.focus()};
  actions.querySelector("[data-toggle-sibling]").onclick=e=>{e.preventDefault();e.stopPropagation();const sibling=makeToggle(Number(block.dataset.autoToggleDepth)||0);block.after(sibling);syncRichToggleDepths(editor);decorateSpecialBlocks(editor);editor.dispatchEvent(new Event("input",{bubbles:true}));sibling.querySelector("summary span:last-child")?.focus()};
  actions.querySelector("[data-toggle-indent]").onclick=e=>{e.preventDefault();e.stopPropagation();let previous=block.previousElementSibling;while(previous?.classList.contains("sm-rich-ui"))previous=previous.previousElementSibling;if(!previous?.matches("details.sm-rich-toggle"))return;const target=previous.querySelector(":scope > .sm-rich-toggle-body"),tail=[...target.children].reverse().find(item=>item.matches("p")&&!String(item.textContent||"").trim());block.previousElementSibling?.classList.contains("sm-rich-block-controls")&&block.previousElementSibling.remove();target.insertBefore(block,tail||null);syncRichToggleDepths(editor);decorateSpecialBlocks(editor);editor.dispatchEvent(new Event("input",{bubbles:true}))};
  actions.querySelector("[data-toggle-outdent]").onclick=e=>{e.preventDefault();e.stopPropagation();const parent=block.parentElement?.closest?.("details.sm-rich-toggle");if(!parent)return;block.previousElementSibling?.classList.contains("sm-rich-block-controls")&&block.previousElementSibling.remove();parent.after(block);syncRichToggleDepths(editor);decorateSpecialBlocks(editor);editor.dispatchEvent(new Event("input",{bubbles:true}))};
  body.prepend(actions);
 });
 editor.querySelectorAll("figure.sm-rich-image").forEach(figure=>{
  figure.contentEditable="false";
  const caption=figure.querySelector(":scope > figcaption");if(caption)caption.contentEditable="true";
  if(figure.querySelector(":scope > .sm-rich-image-remove"))return;
  const button=document.createElement("button");button.type="button";button.className="sm-rich-image-remove sm-rich-ui";button.contentEditable="false";button.textContent="削除";button.title="この画像を削除";figure.prepend(button);
 });
 editor.querySelectorAll('[data-rich-role="check-toggle"]').forEach(item=>{const row=item.closest('.sm-rich-checklist-item'),toggle=item.closest('details.sm-rich-toggle[data-checkable-toggle]'),toggleCheck=toggle?.querySelector(':scope > summary > [data-rich-role="check-toggle"]');if(!row&&toggleCheck!==item){item.remove();return}item.contentEditable="false";if(!/^[☐☑]/.test(item.textContent||""))item.textContent="☐";if(row){repairInlineChecklistItem(row);const depth=Math.max(0,Math.min(12,checklistItemDepth(row)));row.dataset.checkDepth=String(depth);row.style.setProperty('--check-depth',String(depth))}});
 editor.querySelectorAll('[data-rich-role="calc-total"]').forEach(item=>item.contentEditable="false");
 editor.querySelectorAll('.sm-rich-article-tool[data-kind="calculator"]').forEach(updateRichCalculator);
 editor.querySelectorAll('.sm-rich-article-tool[data-kind="checklist"],.sm-rich-article-tool[data-kind="calculator"]').forEach(block=>{
  if(block.querySelector(':scope > .sm-rich-tool-add'))return;
  const button=document.createElement("button");button.type="button";button.className="sm-rich-tool-add sm-rich-ui";button.contentEditable="false";button.dataset.richToolAdd=block.dataset.kind;button.textContent=block.dataset.kind==="checklist"?"＋ 項目":"＋ 計算行";
  button.onclick=e=>{e.preventDefault();e.stopPropagation();const body=block.querySelector(":scope > .kp-special-body");if(!body)return;if(block.dataset.kind==="checklist")body.insertAdjacentHTML("beforeend",richChecklistItemHtml({depth:0,text:"確認すること"}));else{const total=body.querySelector('[data-rich-role="calc-total"]'),row='<div class="sm-rich-calc-row"><span>項目</span><span data-rich-role="calc-value">0</span></div>';if(total)total.insertAdjacentHTML("beforebegin",row);else body.insertAdjacentHTML("beforeend",row)}decorateSpecialBlocks(editor);editor.dispatchEvent(new Event("input",{bubbles:true}))};
  block.append(button);
 });
}
function create(options={}){
 const mount=options.mount;if(!mount)throw new Error("RichEditor mount is required");
 mount.classList.add("sm-rich-shell");mount.classList.toggle("sm-rich-reorder-mode",!!options.reorderMode);mount.innerHTML=toolbarHtml(options)+`<article class="sm-rich-editor blog-editor" contenteditable="true" role="textbox" aria-multiline="true"></article>`;
 const editor=mount.querySelector(".sm-rich-editor"),toolbar=mount.querySelector(".sm-rich-toolbar");
 editor.innerHTML=String(options.html||"").trim()?normalizeRichHtml(options.html):textToHtml(options.text||"");normalizeExistingEditor(editor);ensureEditableTail(editor);decorateSpecialBlocks(editor);
 let range=null,history=[cleanupEditorHtml(editor)],index=0,timer=0,sortTimer=0,destroyed=false,sortObserver=null,sortDecorating=false,draggedSortBlock=null;
 const saveRange=()=>{const s=getSelection();if(s?.rangeCount&&editor.contains(s.getRangeAt(0).commonAncestorContainer))range=s.getRangeAt(0).cloneRange()};
 const restoreRange=()=>{editor.focus();const s=getSelection();s.removeAllRanges();if(range)s.addRange(range);else{const r=document.createRange();r.selectNodeContents(editor);r.collapse(false);s.addRange(r)}};
 const value=()=>cleanupEditorHtml(editor,options.cleanup);
 const splitValueAtRange=()=>{
  restoreRange();const point=range?.cloneRange();if(!point||!editor.contains(point.commonAncestorContainer))return null;point.collapse(true);
  const before=document.createRange(),after=document.createRange();before.selectNodeContents(editor);before.setEnd(point.startContainer,point.startOffset);after.selectNodeContents(editor);after.setStart(point.startContainer,point.startOffset);
  const part=fragment=>{const box=document.createElement("div");box.append(fragment);normalizeExistingEditor(box);const html=cleanupEditorHtml(box,options.cleanup);return {html,text:plainText(html)}};
  return {before:part(before.cloneContents()),after:part(after.cloneContents())};
 };
 const updateButtons=()=>{toolbar.querySelector("[data-rich-undo]").disabled=index<=0;toolbar.querySelector("[data-rich-redo]").disabled=index>=history.length-1};
 const updateFormatSelect=()=>{const selection=getSelection(),anchor=selection?.anchorNode,element=anchor?.nodeType===1?anchor:anchor?.parentElement,block=element?.closest?.("h2,h3,blockquote,p,div"),select=toolbar.querySelector("[data-rich-format]");if(select&&block&&editor.contains(block))select.value=["h2","h3","blockquote"].includes(block.tagName.toLowerCase())?block.tagName.toLowerCase():"p"};
 const notify=({record=true}={})=>{normalizeExistingEditor(editor);decorateSpecialBlocks(editor);const html=value();if(record&&html!==history[index]){history=history.slice(0,index+1);history.push(html);if(history.length>31)history.shift();index=history.length-1}updateButtons();options.onChange?.({html,text:plainText(html)})};
 const sortableContainers=()=>[editor,...editor.querySelectorAll("details.sm-rich-toggle > .sm-rich-toggle-body")];
 const sortableChildren=container=>[...container.children].filter(x=>!x.classList.contains("sm-rich-ui"));
 const sortControlFor=block=>block?.previousElementSibling?.classList.contains("sm-rich-block-controls")?block.previousElementSibling:null;
 const decorateInlineAdders=()=>{
  editor.querySelectorAll(".sm-rich-inline-add").forEach(x=>x.remove());
  sortableContainers().forEach(container=>sortableChildren(container).forEach(block=>{
   const menu=document.createElement("details");menu.className="sm-rich-inline-add sm-rich-ui";menu.contentEditable="false";
   menu.innerHTML=`<summary title="この位置に追加" aria-label="この位置に追加">＋</summary><div><button type="button" data-inline-rich="text">本文</button>${container===editor?'<button type="button" data-inline-rich="large">大見出しトグル</button>':""}<button type="button" data-inline-rich="headingtoggle">小見出しトグル</button><button type="button" data-inline-rich="bodytoggle">本文トグル</button><button type="button" data-inline-rich="checktoggle">チェック付きトグル</button></div>`;
   container.insertBefore(menu,sortControlFor(block)||block);
   menu.querySelectorAll("[data-inline-rich]").forEach(button=>button.onclick=e=>{e.preventDefault();e.stopPropagation();const kind=button.dataset.inlineRich;menu.removeAttribute("open");if(kind==="large"){const caret=document.createRange();caret.setStartBefore(block);caret.collapse(true);range=caret;const split=splitValueAtRange();options.onInsertBlock?.("toggle",{html:value(),text:plainText(value()),split});return}const template=document.createElement("template");template.innerHTML=kind==="text"?"<p><br></p>":specialHtml(kind);block.before(template.content);normalizeExistingEditor(editor);decorateSpecialBlocks(editor);notify();decorateInlineAdders();decorateSortableBlocks()});
  }));
 };
 const compactSortableContainer=container=>{
  if(!container)return;
  const blocks=sortableChildren(container),empty=block=>block.matches("p")&&!String(block.textContent||"").trim()&&!block.querySelector("img,hr,details,section,figure");
  const keep=empty(blocks.at(-1))?blocks.at(-1):null;
  blocks.forEach(block=>{if(block!==keep&&empty(block)){sortControlFor(block)?.remove();block.remove()}});
  const remaining=sortableChildren(container),last=remaining.at(-1);if(last?.matches(".sm-special,figure,hr")){const paragraph=document.createElement("p");paragraph.innerHTML="<br>";container.append(paragraph)}
 };
 const clearSortMarks=()=>editor.querySelectorAll(".sm-drop-before,.sm-drop-after,.sm-rich-sort-dragging").forEach(x=>x.classList.remove("sm-drop-before","sm-drop-after","sm-rich-sort-dragging"));
 const moveSortableBlock=(block,target,before=true)=>{
  if(!block||!target||block===target||block.contains(target))return false;
  const sourceControls=sortControlFor(block),targetControls=sortControlFor(target),sourceParent=block.parentElement,parent=target.parentElement;
  if(!sourceControls||!targetControls||!parent)return false;
  const reference=before?targetControls:target.nextSibling;
  parent.insertBefore(sourceControls,reference);
  parent.insertBefore(block,reference);
  compactSortableContainer(sourceParent);if(parent!==sourceParent)compactSortableContainer(parent);
  return true;
 };
 const moveSortableSibling=(block,delta)=>{
  const parent=block?.parentElement;if(!parent)return false;
  const siblings=sortableChildren(parent),i=siblings.indexOf(block),j=i+delta;if(i<0||j<0||j>=siblings.length)return false;
  const order=siblings.slice();[order[i],order[j]]=[order[j],order[i]];
  order.forEach(item=>{const controls=sortControlFor(item);if(controls)parent.appendChild(controls);parent.appendChild(item)});
  compactSortableContainer(parent);
  return true;
 };
 const decorateSortableBlocks=()=>{
  if(!options.enableBlockReorder||sortDecorating||destroyed)return;
  sortDecorating=true;
  try{
   editor.querySelectorAll(".sm-rich-block-controls").forEach(x=>x.remove());
   sortableContainers().forEach(container=>{
    const blocks=sortableChildren(container);
    blocks.forEach((block,index)=>{
     const controls=document.createElement("div");controls.className="sm-rich-block-controls sm-rich-ui";controls.contentEditable="false";
     controls.innerHTML=`<button type="button" class="sm-rich-drag-handle" draggable="true" title="ドラッグして並び替え" aria-label="このブロックをドラッグして並び替え">≡</button><button type="button" data-sm-block-up title="同じ階層で上へ" aria-label="このブロックを上へ" ${index===0?"disabled":""}>↑</button><button type="button" data-sm-block-down title="同じ階層で下へ" aria-label="このブロックを下へ" ${index===blocks.length-1?"disabled":""}>↓</button>`;
     container.insertBefore(controls,block);
     controls.querySelector("[data-sm-block-up]").onclick=e=>{e.preventDefault();e.stopPropagation();if(moveSortableSibling(block,-1)){notify();decorateSortableBlocks()}};
     controls.querySelector("[data-sm-block-down]").onclick=e=>{e.preventDefault();e.stopPropagation();if(moveSortableSibling(block,1)){notify();decorateSortableBlocks()}};
     const handle=controls.querySelector(".sm-rich-drag-handle");
     handle.addEventListener("click",e=>{e.preventDefault();e.stopPropagation()});
     handle.addEventListener("dragstart",e=>{e.stopPropagation();draggedSortBlock=block;block.classList.add("sm-rich-sort-dragging");e.dataTransfer.effectAllowed="move";try{e.dataTransfer.setData("text/plain","sakumeru-rich-block")}catch{}});
     handle.addEventListener("dragend",()=>{draggedSortBlock=null;clearSortMarks()});
     block.ondragover=e=>{if(!draggedSortBlock||draggedSortBlock===block||draggedSortBlock.contains(block))return;e.preventDefault();e.stopPropagation();clearSortMarks();const r=block.getBoundingClientRect();block.classList.add(e.clientY<r.top+r.height/2?"sm-drop-before":"sm-drop-after");e.dataTransfer.dropEffect="move"};
     block.ondrop=e=>{if(!draggedSortBlock||draggedSortBlock===block)return;e.preventDefault();e.stopPropagation();const before=block.classList.contains("sm-drop-before");const moved=moveSortableBlock(draggedSortBlock,block,before);draggedSortBlock=null;clearSortMarks();if(moved){notify();decorateSortableBlocks()}};
    });
    container.ondragover=e=>{if(!draggedSortBlock||e.target!==container||draggedSortBlock.contains(container))return;e.preventDefault();e.dataTransfer.dropEffect="move"};
    container.ondrop=e=>{if(!draggedSortBlock||e.target!==container||draggedSortBlock.contains(container))return;e.preventDefault();e.stopPropagation();const controls=sortControlFor(draggedSortBlock);if(!controls)return;container.append(controls,draggedSortBlock);draggedSortBlock=null;clearSortMarks();notify();decorateSortableBlocks()};
   });
  }finally{sortDecorating=false}
 };
 const exec=(cmd,arg=null)=>{restoreRange();document.execCommand(cmd,false,arg);saveRange();notify()};
 const applyBlockFormat=tag=>{restoreRange();document.execCommand("formatBlock",false,`<${["h2","h3","blockquote"].includes(tag)?tag:"p"}>`);saveRange();notify()};
 const commitMarkers=()=>{const changed=convertTypedMarkers(editor),tail=ensureEditableTail(editor);if(changed||tail){normalizeExistingEditor(editor);decorateSpecialBlocks(editor);range=null;decorateInlineAdders();decorateSortableBlocks();notify()}return changed};
 toolbar.addEventListener("mousedown",saveRange);
 toolbar.querySelectorAll("[data-rich-cmd]").forEach(b=>b.onclick=()=>exec(b.dataset.richCmd));
 toolbar.querySelector("[data-rich-format]").onchange=e=>applyBlockFormat(e.target.value);
 toolbar.querySelector("[data-rich-link]").onclick=()=>{const u=prompt("リンク先URL");if(u)exec("createLink",u)};
 toolbar.querySelector("[data-rich-hr]").onclick=()=>{restoreRange();document.execCommand("insertHTML",false,"<hr><p><br></p>");notify();decorateSortableBlocks()};
 toolbar.querySelectorAll("[data-rich-marker]").forEach(b=>b.onclick=()=>exec("hiliteColor",b.dataset.richMarker));
 toolbar.querySelector("[data-rich-crayon]").onclick=()=>{restoreRange();const s=getSelection(),selected=s?.rangeCount?s.getRangeAt(0):null;if(!selected||selected.collapsed){alert("強調する文章を選択してください。");return}const span=document.createElement("span");span.className="sm-rich-crayon";try{selected.surroundContents(span)}catch{document.execCommand("insertHTML",false,`<span class="sm-rich-crayon">${esc(selected.toString())}</span>`)}range=null;notify()};
 toolbar.querySelector("[data-rich-clear-format]").onclick=()=>exec("removeFormat");
 toolbar.querySelectorAll("[data-rich-special]").forEach(b=>b.onclick=()=>{restoreRange();document.execCommand("insertHTML",false,specialHtml(b.dataset.richSpecial));b.closest("details.sm-rich-toggle-menu")?.removeAttribute("open");notify();decorateInlineAdders();decorateSortableBlocks()});
 toolbar.querySelectorAll("[data-rich-insert]").forEach(b=>b.onclick=()=>{saveRange();const split=splitValueAtRange();b.closest("details.sm-rich-toggle-menu")?.removeAttribute("open");options.onInsertBlock?.(b.dataset.richInsert,{html:value(),text:plainText(value()),split})});
 const xHideButton=toolbar.querySelector("[data-rich-x-hide]");if(xHideButton)xHideButton.onclick=()=>{restoreRange();const s=getSelection(),selected=s?.rangeCount?s.getRangeAt(0):null;if(!selected||selected.collapsed){alert("隠したい文章を選択してください。");return}if(toggleXHidden(editor,selected)){range=null;notify()}};
 toolbar.querySelector("[data-rich-undo]").onclick=()=>{if(index<=0)return;index--;editor.innerHTML=history[index];normalizeExistingEditor(editor);decorateSpecialBlocks(editor);decorateInlineAdders();decorateSortableBlocks();range=null;updateButtons();options.onChange?.({html:value(),text:plainText(value())})};
 toolbar.querySelector("[data-rich-redo]").onclick=()=>{if(index>=history.length-1)return;index++;editor.innerHTML=history[index];normalizeExistingEditor(editor);decorateSpecialBlocks(editor);decorateInlineAdders();decorateSortableBlocks();range=null;updateButtons();options.onChange?.({html:value(),text:plainText(value())})};
 editor.addEventListener("click",e=>{const check=e.target.closest?.('[data-rich-role="check-toggle"]');if(check){e.preventDefault();e.stopPropagation();const item=check.closest('.sm-rich-checklist-item'),block=check.closest('.sm-rich-article-tool[data-kind="checklist"]'),checked=!/^☑/.test(check.textContent||"");if(item&&block){const items=[...block.querySelectorAll(':scope > .kp-special-body > .sm-rich-checklist-item')],index=items.indexOf(item),depth=checklistItemDepth(item);setChecklistItemChecked(item,checked);for(let i=index+1;i<items.length&&checklistItemDepth(items[i])>depth;i++)setChecklistItemChecked(items[i],checked);syncRichChecklistParents(block)}else{const toggle=check.closest('details.sm-rich-toggle[data-checkable-toggle]');check.textContent=checked?"☑":"☐";if(toggle){toggle.querySelectorAll('.sm-rich-toggle-body details.sm-rich-toggle[data-checkable-toggle] [data-rich-role="check-toggle"]').forEach(child=>child.textContent=checked?"☑":"☐");syncCheckableToggleParents(toggle)}}notify();return}const imageButton=e.target.closest?.(".sm-rich-image-remove");if(imageButton){e.preventDefault();e.stopPropagation();const figure=imageButton.closest("figure.sm-rich-image");if(figure&&confirm("この画像を削除しますか？")){sortControlFor(figure)?.remove();figure.remove();range=null;notify();decorateSortableBlocks()}return}const button=e.target.closest?.(".sm-rich-special-remove");if(!button)return;e.preventDefault();e.stopPropagation();const block=button.closest(".sm-special");if(block&&confirm("このブロックを削除しますか？")){sortControlFor(block)?.remove();block.remove();range=null;notify();decorateSortableBlocks()}});
 let deleteHighlightSnapshot=null;
 editor.addEventListener("beforeinput",event=>{
  deleteHighlightSnapshot=String(event.inputType||"").startsWith("delete")
   ?snapshotExplicitHighlights(editor)
   :null;
 });
 editor.addEventListener("keyup",()=>{saveRange();updateFormatSelect()});editor.addEventListener("mouseup",()=>{saveRange();updateFormatSelect()});editor.addEventListener("focusin",updateFormatSelect);editor.addEventListener("blur",saveRange);
 editor.addEventListener("copy",event=>{
  const selection=getSelection();if(!selection?.rangeCount||selection.isCollapsed||!event.clipboardData)return;
  const selectionRange=selection.getRangeAt(0),blocks=[...editor.querySelectorAll(".sm-special,figure.sm-rich-image")].filter(block=>{try{return selectionRange.intersectsNode(block)}catch{return false}});
  if(!blocks.length)return;
  const holder=document.createElement("div");holder.append(selectionRange.cloneContents());
  const html=cleanupEditorHtml(holder),plain=plainText(html);event.preventDefault();event.clipboardData.setData("text/html",html);event.clipboardData.setData("text/plain",plain);
 });
 editor.addEventListener("paste",event=>{
  const clipboard=event.clipboardData;if(!clipboard)return;
  const sourceHtml=clipboard.getData("text/html"),sourceText=clipboard.getData("text/plain");
  if(!sourceHtml&&!sourceText)return;
  const checkToggleNodes=toggleNodesFromText(sourceText,checkToggleMarkerParts);if(checkToggleNodes.length&&/^\s*(?:・+\s*[＞>]+|[＞>]+\s*・+)/.test(sourceText)){event.preventDefault();document.execCommand("insertHTML",false,richToggleTreeHtml(checkToggleNodes)+"<p><br></p>");decorateSpecialBlocks(editor);saveRange();clearTimeout(timer);timer=setTimeout(()=>notify(),0);return}
  const toggleNodes=toggleNodesFromText(sourceText);if(toggleNodes.length&&/^\s*[＞>]/.test(sourceText)){event.preventDefault();document.execCommand("insertHTML",false,richToggleTreeHtml(toggleNodes)+"<p><br></p>");decorateSpecialBlocks(editor);saveRange();clearTimeout(timer);timer=setTimeout(()=>notify(),0);return}
  const checklistItems=checklistItemsFromText(sourceText);if(checklistItems.length&&/^\s*・/.test(sourceText)){event.preventDefault();document.execCommand("insertHTML",false,richChecklistHtml(checklistItems)+"<p><br></p>");decorateSpecialBlocks(editor);saveRange();clearTimeout(timer);timer=setTimeout(()=>notify(),0);return}
  const html=sourceHtml?normalizePastedHtml(sourceHtml):textToHtml(normalizePastedText(sourceText));
  event.preventDefault();
  if(html)document.execCommand("insertHTML",false,html);
  saveRange();clearTimeout(timer);timer=setTimeout(()=>notify(),250);
 });
 editor.addEventListener("input",event=>{
  if(String(event.inputType||"").startsWith("delete")&&deleteHighlightSnapshot){restoreHighlightsAfterDelete(editor,deleteHighlightSnapshot);deleteHighlightSnapshot=null}
  ensureEditableTail(editor);
  editor.querySelectorAll('.sm-rich-article-tool[data-kind="calculator"]').forEach(updateRichCalculator);
  saveRange();clearTimeout(timer);timer=setTimeout(()=>notify(),250)
 });
 editor.addEventListener("keydown",e=>{
  if(e.key==="Enter"&&!e.ctrlKey&&!e.metaKey&&!e.altKey){const selection=getSelection(),anchor=selection?.anchorNode,element=anchor?.nodeType===1?anchor:anchor?.parentElement,text=element?.closest?.('.sm-rich-check-text'),item=text?.closest?.('.sm-rich-checklist-item');if(text&&item&&editor.contains(item)){e.preventDefault();if(e.shiftKey){document.execCommand("insertLineBreak",false);saveRange();notify();return}const paragraph=document.createElement("p");paragraph.innerHTML="<br>";item.after(paragraph);const caret=document.createRange();caret.selectNodeContents(paragraph);caret.collapse(true);selection.removeAllRanges();selection.addRange(caret);range=caret.cloneRange();notify();return}}
  if(e.key==="Backspace"&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
   const selection=getSelection();if(selection?.rangeCount&&selection.isCollapsed){const anchor=selection.anchorNode,element=anchor?.nodeType===1?anchor:anchor?.parentElement,line=element?.closest?.("p,div");if(line?.parentElement===editor&&!String(line.textContent||"").trim()){const before=document.createRange();before.selectNodeContents(line);try{before.setEnd(anchor,selection.anchorOffset)}catch{}const previous=(()=>{let node=line.previousElementSibling;while(node?.classList.contains("sm-rich-ui"))node=node.previousElementSibling;return node})();if(!before.toString()&&previous?.matches?.(".sm-special,figure,hr")){e.preventDefault();return}}}
  }
  if(e.key==="Enter"&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
   const selection=getSelection(),anchor=selection?.anchorNode,element=anchor?.nodeType===1?anchor:anchor?.parentElement,line=element?.closest?.("p,div,h1,h2,h3,h4,h5,h6,blockquote");
   if(line&&editor.contains(line)&&(!line.closest('.sm-special')||!!line.closest('details.sm-rich-toggle'))){
    const previous=(()=>{let node=line.previousElementSibling;while(node?.classList.contains('sm-rich-ui'))node=node.previousElementSibling;return node})(),paragraph=document.createElement("p");paragraph.innerHTML="<br>";
    const parsedToggle=checkToggleMarkerParts(line.textContent||"")||toggleMarkerParts(line.textContent||""),toggle=parsedToggle?markerDepthInContext(parsedToggle,line):null;
    if(toggle){
     e.preventDefault();const node={...toggle,notes:[],children:[]},box=document.createElement("div");box.innerHTML=richToggleNodeHtml(node);const block=box.firstElementChild;
     if(toggle.depth>0&&previous?.matches?.('details.sm-rich-toggle')){const candidates=[previous,...previous.querySelectorAll('details.sm-rich-toggle')].filter(item=>Math.max(0,Number(item.dataset.autoToggleDepth)||0)===toggle.depth-1),parent=candidates[candidates.length-1],body=parent?.querySelector(':scope > .sm-rich-toggle-body');if(body){const emptyParagraphs=[...body.children].filter(item=>item.matches('p')&&!String(item.textContent||"").trim()),tail=emptyParagraphs[emptyParagraphs.length-1];body.insertBefore(block,tail||null);sortControlFor(line)?.remove();line.replaceWith(paragraph)}else{line.replaceWith(block);block.after(paragraph)}}else{line.replaceWith(block);block.after(paragraph)}
     nestAutoToggles(editor);decorateSpecialBlocks(editor);decorateSortableBlocks();const caret=document.createRange();caret.selectNodeContents(paragraph);caret.collapse(true);selection.removeAllRanges();selection.addRange(caret);range=caret.cloneRange();notify();return;
    }
    const bullet=checklistBulletParts(line.textContent||"");
    if(bullet){
     e.preventDefault();const item={...bullet,text:esc(bullet.text)};
     const toggleBody=line.closest('.sm-rich-toggle-body');
     if(toggleBody){const box=document.createElement("div");box.innerHTML=richChecklistItemHtml(item);const block=box.firstElementChild;line.replaceWith(block);block.after(paragraph)}else if(previous?.matches?.('.sm-rich-article-tool[data-kind="checklist"]')){previous.querySelector(':scope > .kp-special-body')?.insertAdjacentHTML("beforeend",richChecklistItemHtml(item));sortControlFor(line)?.remove();line.replaceWith(paragraph);syncRichChecklistParents(previous)}else{const box=document.createElement("div");box.innerHTML=richChecklistHtml([item]);const block=box.firstElementChild;line.replaceWith(block);block.after(paragraph)}
     decorateSpecialBlocks(editor);decorateSortableBlocks();const caret=document.createRange();caret.selectNodeContents(paragraph);caret.collapse(true);selection.removeAllRanges();selection.addRange(caret);range=caret.cloneRange();notify();return;
    }
    if(line.matches("h1,h2,h3,h4,h5,h6,blockquote"))setTimeout(()=>{document.execCommand("formatBlock",false,"<p>");saveRange();notify()},0);
   }
  }
  if(!(e.ctrlKey||e.metaKey)||e.altKey)return;const k=e.key.toLowerCase();if(k==="z"||k==="y"){e.preventDefault();toolbar.querySelector(k==="y"||e.shiftKey?"[data-rich-redo]":"[data-rich-undo]").click()}
 });
 decorateInlineAdders();
 if(options.enableBlockReorder){decorateSortableBlocks();sortObserver=new MutationObserver(mutations=>{if(sortDecorating)return;const changed=[...mutations].flatMap(m=>[...m.addedNodes,...m.removedNodes]),structural=changed.some(n=>n.nodeType===1&&!n.classList?.contains("sm-rich-ui")),missingToggleUi=changed.some(n=>n.nodeType===1&&n.matches?.(".sm-rich-toggle-actions,.sm-rich-special-remove"));if(!structural&&!missingToggleUi)return;clearTimeout(sortTimer);sortTimer=setTimeout(()=>{if(missingToggleUi)decorateSpecialBlocks(editor);decorateInlineAdders();decorateSortableBlocks()},60)});sortObserver.observe(editor,{childList:true,subtree:true})}
 updateButtons();
 return {editor,getHtml:value,getText:()=>plainText(value()),commitMarkers,insertHtml(html){restoreRange();document.execCommand("insertHTML",false,String(html||""));saveRange();notify();decorateInlineAdders();decorateSortableBlocks()},setHtml(html){editor.innerHTML=normalizeRichHtml(html)||"<p><br></p>";normalizeExistingEditor(editor);ensureEditableTail(editor);decorateSpecialBlocks(editor);history=[value()];index=0;range=null;decorateInlineAdders();decorateSortableBlocks();updateButtons()},setReorderMode(active){mount.classList.toggle("sm-rich-reorder-mode",!!active);editor.contentEditable=active?"false":"true";clearSortMarks()},focus(){editor.focus()},destroy(){destroyed=true;sortObserver?.disconnect();clearTimeout(timer);clearTimeout(sortTimer);mount.innerHTML=""},get destroyed(){return destroyed}};
}

window.SAKUMERichEditor={create,textToHtml,plainText,plainTextForX,hasXHidden,shareHiddenHtml,bindShareHidden,sanitizeHtml,normalizeRichHtml,cleanupEditorHtml,normalizeExistingEditor,normalizePastedHtml,normalizePastedText,execCommand};
})();
