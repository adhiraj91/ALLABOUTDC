// ALLABOUTDC Comics Explorer — generic DC architecture, currently seeded with New 52 Batman territory.
// Source of truth: Series -> Issues -> Collections. Runs describe creator coverage only.
import * as data from "./data.js?v=dc1";
import { COLLECTIONS } from "./schema.js";

const esc=s=>s==null?"":String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");
const year=s=>String(s?.startDate||"").slice(0,4);
const range=s=>{const a=s?.startDate||"",b=s?.endDate||"";return a&&b?`${a}–${b}`:a?`${a}–present`:b;};
const issueType=i=>String(i?.issueLabelType||"numbered");
const issueNum=i=>{const n=parseFloat(i?.issueNumber);return Number.isFinite(n)?n:Infinity;};
const sortIssues=a=>a.sort((x,y)=>issueNum(x)-issueNum(y)||String(x.issueLabel||"").localeCompare(String(y.issueLabel||"")));
const titleOf=c=>c?.displayName||c?.name||"Character";
const groupOrder=(a,b)=>String(a||"").localeCompare(String(b||""));

const cache=new Map();
async function get(col,id){if(!id)return null;const k=`${col}:${id}`;if(cache.has(k))return cache.get(k);const p=data.getEntity(col,id).catch(()=>null);cache.set(k,p);return p;}
async function allSeries(){return (await data.getAllSeries(500)).filter(s=>s && s.scope==="batman-new52");}
function issueBuckets(issues){
  const b={numbered:[],annual:[],special:[],one_shot:[]};
  for(const i of issues){const t=issueType(i);if(t==="annual")b.annual.push(i);else if(t==="one_shot")b.one_shot.push(i);else if(t==="special")b.special.push(i);else b.numbered.push(i);}
  Object.values(b).forEach(sortIssues);return b;
}
function tabs(active,items){return `<div class="cx-tabs" role="tablist">${items.map(x=>`<button class="cx-tab ${x[0]===active?"is-active":""}" data-tab="${esc(x[0])}" role="tab">${esc(x[1])}${x[2]!=null?` <span>${x[2]}</span>`:""}</button>`).join("")}</div>`;}
function row(title,sub,attrs=""){return `<div class="cx-row" ${attrs}><div class="cx-row-body"><div class="cx-row-title">${esc(title)}</div>${sub?`<div class="cx-row-sub">${esc(sub)}</div>`:""}</div><div class="cx-row-chevron">›</div></div>`;}
function empty(msg){return `<div class="cx-empty">${esc(msg)}</div>`;}

async function root(){
  const [universes,conts,chars,series]=await Promise.all([data.getAllUniverses(20),data.getAllContinuities(50),data.getAllCharacters(200),allSeries()]);
  const roots=chars.filter(c=>c.browseRoot===true);
  const ct=conts[0]; const u=universes[0];
  return {html:`<div class="cx-kicker">DC COMICS</div><h2 class="cx-title">Explore the DC Universe</h2><div class="cx-subtitle">The catalogue grows territory by territory. Current mapped coverage starts with The New 52 → Batman.</div>
    <div class="cx-entry-grid">
      <button class="cx-entry-btn" data-go="characterList"><span class="cx-entry-btn-label">By Character</span><span class="cx-entry-btn-sub">${roots.length} mapped starting character${roots.length===1?"":"s"}</span></button>
      <button class="cx-entry-btn" data-go="continuityList"><span class="cx-entry-btn-label">By Continuity / Era</span><span class="cx-entry-btn-sub">${conts.length} mapped continuity${conts.length===1?"":"ies"}</span></button>
      <button class="cx-entry-btn" data-go="seriesList"><span class="cx-entry-btn-label">Browse Series</span><span class="cx-entry-btn-sub">${series.length} currently mapped series</span></button>
      <button class="cx-entry-btn" data-go="atlas"><span class="cx-entry-btn-label">Story Map</span><span class="cx-entry-btn-sub">Same underlying universe graph</span></button>
    </div>
    ${u?`<div class="sheet-section"><div class="sheet-label">CURRENT TERRITORY</div>${row(ct?ct.name:"The New 52",`${series.length} series · ${series.reduce((n,s)=>n+(Number(s.issueCount)||0),0).toLocaleString()} numbered issues`, 'data-go="continuity"')}</div>`:""}`,
    wire(c){c.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>{const a=b.dataset.go;if(a==="atlas"){window.__comicsStoryMap?.open?.("universe",u?.id);return;} if(a==="continuity")push("continuity",ct?.name||"Continuity",{continuity:ct});else { const labels={characterList:"Characters",continuityList:"Continuity / Era",seriesList:"Series"}; push(a,labels[a]||a,{}); };}));}};
}

async function characterList(){
  const chars=(await data.getAllCharacters(200)).filter(c=>c.browseRoot===true);
  if(!chars.length)return {html:empty("No top-level characters are mapped yet.")};
  const rows=chars.sort((a,b)=>titleOf(a).localeCompare(titleOf(b))).map(c=>row(titleOf(c),c.aliases?.length?c.aliases.join(" · "):"Mapped character",`data-char="${esc(c.id)}"`)).join("");
  return {html:`<div class="cx-kicker">CHARACTERS</div><h2 class="cx-title">Start with a character</h2><div class="cx-subtitle">Only characters marked as catalogue roots appear here. Family members live inside their parent character's territory until their own DC territory is mapped.</div><div class="cx-list">${rows}</div>`,wire(c){c.querySelectorAll("[data-char]").forEach(r=>{r.addEventListener("click",async()=>{const x=chars.find(v=>v.id===r.dataset.char);push("character",titleOf(x),{character:x});});});}};
}

async function character(p){
  const c=p.character; if(!c)return {html:empty("Character not found.")};
  const series=(await allSeries()).filter(s=>Array.isArray(s.characterIds)&&s.characterIds.includes(c.id));
  const grouped=new Map();
  series.forEach(s=>{const k=s.lineCategory||"Other";if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(s);});
  const cats=[...grouped.keys()].sort(groupOrder);
  let html=`<div class="cx-kicker">CHARACTER</div><h2 class="cx-title">${esc(titleOf(c))}</h2><div class="cx-subtitle">${esc((c.aliases||[]).join(" · "))}${c.aliases?.length?" · ":""}New 52 mapped territory</div>`;
  for(const cat of cats){const list=grouped.get(cat).sort((a,b)=>year(a).localeCompare(year(b))||a.title.localeCompare(b.title));html+=`<div class="sheet-section"><div class="sheet-label">${esc(cat.toUpperCase())}</div><div class="cx-list">${list.map(s=>row(s.title,`${range(s)} · ${s.issueCount||0} issues${(Number(s.zeroIssueCount)||0)+(Number(s.annualCount)||0)+(Number(s.decimalIssueCount)||0)+(Number(s.specialCount)||0)?` · ${((Number(s.zeroIssueCount)||0)+(Number(s.annualCount)||0)+(Number(s.decimalIssueCount)||0)+(Number(s.specialCount)||0))} other publications`:""}`,`data-series="${esc(s.id)}"`)).join("")}</div></div>`;}
  return {html,wire(cn){cn.querySelectorAll("[data-series]").forEach(r=>r.addEventListener("click",()=>{const s=series.find(x=>x.id===r.dataset.series);push("series",s.title,{series:s});}));}};
}

async function continuityList(){const cs=await data.getAllContinuities(50);if(!cs.length)return{html:empty("No continuities are mapped yet.")};return{html:`<div class="cx-kicker">CONTINUITY / ERA</div><h2 class="cx-title">Choose a territory</h2><div class="cx-list">${cs.sort((a,b)=>String(a.startDate||"").localeCompare(String(b.startDate||""))).map(c=>row(c.name,`${c.shortName||""}${c.startDate?` · ${c.startDate}–${c.endDate||"present"}`:""}`,`data-cont="${esc(c.id)}"`)).join("")}</div>`,wire(c){c.querySelectorAll("[data-cont]").forEach(r=>r.addEventListener("click",()=>{const x=cs.find(v=>v.id===r.dataset.cont);push("continuity",x.name,{continuity:x});}));}};}

async function continuity(p){const ct=p.continuity;const [series,chars]=await Promise.all([data.getSeriesForContinuity(ct.id),data.getAllCharacters(200)]);const roots=chars.filter(c=>c.browseRoot===true&&c.continuityIds?.includes(ct.id));
 let html=`<div class="cx-kicker">CONTINUITY / ERA</div><h2 class="cx-title">${esc(ct.name)}</h2><div class="cx-subtitle">${esc(ct.startDate||"")}${ct.endDate?`–${esc(ct.endDate)}`:""} · ${series.length} mapped series</div>`;
 if(ct.description)html+=`<div class="sheet-section"><div class="sheet-label">ABOUT</div><div class="sheet-body">${esc(ct.description)}</div></div>`;
 if(roots.length)html+=`<div class="sheet-section"><div class="sheet-label">CHARACTERS</div><div class="cx-list">${roots.map(c=>row(titleOf(c),"Open character territory",`data-root-char="${esc(c.id)}"`)).join("")}</div></div>`;
 html+=`<div class="sheet-section"><div class="sheet-label">SERIES</div><div class="cx-list">${series.sort((a,b)=>year(a).localeCompare(year(b))||a.title.localeCompare(b.title)).map(s=>row(s.title,`${range(s)} · ${s.issueCount||0} issues`,`data-series="${esc(s.id)}"`)).join("")}</div></div>`;
 return{html,wire(c){c.querySelectorAll("[data-root-char]").forEach(r=>r.addEventListener("click",()=>{const x=roots.find(v=>v.id===r.dataset.rootChar);push("character",titleOf(x),{character:x});}));c.querySelectorAll("[data-series]").forEach(r=>r.addEventListener("click",()=>{const x=series.find(v=>v.id===r.dataset.series);push("series",x.title,{series:x});}));}};
}

async function seriesList(){const ss=(await allSeries()).sort((a,b)=>year(a).localeCompare(year(b))||a.title.localeCompare(b.title));if(!ss.length)return{html:empty("No series are mapped yet.")};const groups=new Map();ss.forEach(s=>{const k=s.lineCategory||"Other";if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s);});let html=`<div class="cx-kicker">SERIES</div><h2 class="cx-title">DC Comics catalogue</h2><div class="cx-subtitle">Current mapped territory: The New 52 · Batman. Future New 52 territories use this same catalogue.</div>`;for(const [g,list] of groups){html+=`<div class="sheet-section"><div class="sheet-label">${esc(g.toUpperCase())}</div><div class="cx-list">${list.map(s=>row(s.title,`${range(s)} · ${s.issueCount||0} numbered issues`,`data-series="${esc(s.id)}"`)).join("")}</div></div>`;}return{html,wire(c){c.querySelectorAll("[data-series]").forEach(r=>r.addEventListener("click",()=>{const s=ss.find(x=>x.id===r.dataset.series);push("series",s.title,{series:s});}));}};}

async function series(p){const s=p.series;if(!s)return{html:empty("Series not found.")};const [issues,collections,runs,creators]=await Promise.all([data.getIssuesForSeries(s.id),data.getCollectionsForSeries(s.id).catch(()=>[]),data.getRunsForSeries(s.id),Promise.all((s.creatorIds||[]).map(id=>get(COLLECTIONS.CREATORS,id)))]);sortIssues(issues);const b=issueBuckets(issues);
 const counts={issues:b.numbered.length,annuals:b.annual.length,specials:b.special.length+b.one_shot.length,collections:collections.length};
 let html=`<div class="cx-kicker">SERIES</div><h2 class="cx-title">${esc(s.title)}</h2><div class="cx-subtitle">${esc(range(s))} · ${counts.issues} numbered issues${counts.annuals?` · ${counts.annuals} annuals`:""}${counts.specials?` · ${counts.specials} specials/one-shots`:""}</div>`;
 if(creators.filter(Boolean).length)html+=`<div class="cx-tag-row">${creators.filter(Boolean).map(c=>`<span class="tag">${esc(titleOf(c))}</span>`).join("")}</div>`;
 if(s.description)html+=`<div class="sheet-section"><div class="sheet-label">ABOUT</div><div class="sheet-body">${esc(s.description)}</div></div>`;
 if(runs.length){html+=`<div class="sheet-section"><div class="sheet-label">CREATIVE RUNS</div><div class="cx-list">${runs.sort((a,b)=>(Number(a.startIssue)||0)-(Number(b.startIssue)||0)).map((r,i)=>row(r.title||creators.filter(Boolean).map(c=>titleOf(c)).join(" / ")||"Run",coverage(r),`data-run="${i}"`)).join("")}</div></div>`;}
 html+=`<div class="sheet-section"><div class="sheet-label">PUBLICATIONS</div>${tabs("overview",[["overview","Overview"],["issues","Issues",counts.issues],["annuals","Annuals",counts.annuals],["specials","Specials",counts.specials],["collections","Collected Editions",counts.collections]])}<div id="cxTabBody"></div></div>`;
 return{html,wire(c){const tabBody=c.querySelector("#cxTabBody");const renderTab=t=>{if(t==="overview")tabBody.innerHTML=`<div class="cx-overview-line">${esc(counts.issues?`Numbered run: #${b.numbered[0]?.issueNumber||1}–#${b.numbered[b.numbered.length-1]?.issueNumber||counts.issues}`:"No numbered issues recorded.")}</div>`;else if(t==="issues")tabBody.innerHTML=publicationRows(b.numbered);else if(t==="annuals")tabBody.innerHTML=publicationRows(b.annual);else if(t==="specials")tabBody.innerHTML=publicationRows([...b.special,...b.one_shot]);else tabBody.innerHTML=collectionRows(collections);wirePublications(tabBody,issues,collections,s);};renderTab("overview");c.querySelectorAll(".cx-tab").forEach(t=>t.addEventListener("click",()=>{c.querySelectorAll(".cx-tab").forEach(x=>x.classList.remove("is-active"));t.classList.add("is-active");renderTab(t.dataset.tab);}));c.querySelectorAll("[data-run]").forEach(r=>r.addEventListener("click",()=>{const x=runs[+r.dataset.run];push("run",x.title||"Creative Run",{run:x,series:s});}));}};
}
function coverage(r){if(r.startIssue!=null&&r.endIssue!=null)return `Covers issues #${r.startIssue}–#${r.endIssue}`;if(r.startIssue!=null)return `Covers issue #${r.startIssue} onward`;return "Issue coverage recorded in run metadata";}
function publicationRows(xs){if(!xs.length)return empty("No publications of this type are recorded for this series.");return `<div class="cx-list">${xs.map((i,n)=>row(i.issueLabel||`#${i.issueNumber}`,i.title||i.publicationDate||"Publication",`data-pub="${esc(i.id)}"`)).join("")}</div>`;}
function collectionRows(cs){if(!cs.length)return empty("No collected editions are recorded for this series.");return `<div class="cx-list">${cs.map((c,n)=>row(c.title,`${c.format||"Edition"}${c.issueCoverage?.length?` · ${c.issueCoverage.length} issue units`:""}`,`data-coll="${esc(c.id)}"`)).join("")}</div>`;}
function wirePublications(el,issues,collections,s){el.querySelectorAll("[data-pub]").forEach(r=>r.addEventListener("click",()=>{const i=issues.find(x=>x.id===r.dataset.pub);if(i)push("issue",i.issueLabel,{issue:i,series:s});}));el.querySelectorAll("[data-coll]").forEach(r=>r.addEventListener("click",()=>{const c=collections.find(x=>x.id===r.dataset.coll);if(c)push("collection",c.title,{collectionEntity:c});}));}

async function run(p){const r=p.run,s=p.series;if(!r||!s)return{html:empty("Run not found.")};const creators=await Promise.all((r.creatorIds||[]).map(id=>get(COLLECTIONS.CREATORS,id)));const [issues,collections]=await Promise.all([data.getIssuesForSeries(s.id),data.getCollectionsForSeries(s.id).catch(()=>[])]);sortIssues(issues);const lo=Number(r.startIssue),hi=Number(r.endIssue);const inRun=Number.isFinite(lo)&&Number.isFinite(hi)?issues.filter(i=>{const n=issueNum(i);return n>=lo&&n<=hi;}):[];const b=issueBuckets(inRun);
 let html=`<div class="cx-kicker">CREATIVE RUN</div><h2 class="cx-title">${esc(r.title||creators.filter(Boolean).map(titleOf).join(" / ")||"Run")}</h2><div class="cx-subtitle">${esc(coverage(r))}${inRun.length?` · ${inRun.length} numbered issues`:""}</div>`;
 if(creators.filter(Boolean).length)html+=`<div class="cx-tag-row">${creators.filter(Boolean).map(c=>`<span class="tag">${esc(titleOf(c))}</span>`).join("")}</div>`;
 html+=`<div class="sheet-section"><div class="sheet-label">PUBLICATION COVERAGE</div><div class="cx-coverage-callout">${esc(coverage(r))}</div></div>`;
 html+=`<div class="sheet-section"><div class="sheet-label">PUBLICATIONS</div>${tabs("issues",[["issues","Issues",b.numbered.length],["annuals","Annuals",b.annual.length],["specials","Specials",b.special.length+b.one_shot.length],["collections","Collected Editions",collections.length]])}<div id="cxRunTab"></div></div>`;
 return{html,wire(c){const body=c.querySelector("#cxRunTab");const draw=t=>{if(t==="issues")body.innerHTML=publicationRows(b.numbered);else if(t==="annuals")body.innerHTML=publicationRows(b.annual);else if(t==="specials")body.innerHTML=publicationRows([...b.special,...b.one_shot]);else body.innerHTML=collectionRows(collections);wirePublications(body,inRun,collections,s);};draw("issues");c.querySelectorAll(".cx-tab").forEach(t=>t.addEventListener("click",()=>{c.querySelectorAll(".cx-tab").forEach(x=>x.classList.remove("is-active"));t.classList.add("is-active");draw(t.dataset.tab);}));}};
}

async function issue(p){const i=p.issue;if(!i)return{html:empty("Issue not found.")};const s=p.series||await get(COLLECTIONS.SERIES,i.seriesId);const cs=await Promise.all((i.creatorIds||[]).map(id=>get(COLLECTIONS.CREATORS,id)));let html=`<div class="cx-kicker">PUBLICATION</div><h2 class="cx-title">${esc(i.issueLabel||"Issue")}${i.title?` — ${esc(i.title)}`:""}</h2><div class="cx-subtitle">${esc(s?.title||"")}${i.publicationDate?` · ${esc(i.publicationDate)}`:""}</div>`;if(i.issueLabelType)html+=`<div class="cx-tag-row"><span class="tag">${esc(i.issueLabelType)}</span></div>`;if(cs.filter(Boolean).length)html+=`<div class="cx-tag-row">${cs.filter(Boolean).map(c=>`<span class="tag">${esc(titleOf(c))}</span>`).join("")}</div>`;return{html};}
async function collection(p){const c=p.collectionEntity;if(!c)return{html:empty("Edition not found.")};const s=await get(COLLECTIONS.SERIES,c.seriesIds?.[0]);let html=`<div class="cx-kicker">COLLECTED EDITION</div><h2 class="cx-title">${esc(c.title)}</h2><div class="cx-subtitle">${esc(c.format||"Edition")}${s?` · ${esc(s.title)}`:""}</div>`;if(c.issueCoverage?.length){const labels=c.issueCoverage.map(x=>x.issueLabel).filter(Boolean);html+=`<div class="sheet-section"><div class="sheet-label">COVERS</div><div class="cx-coverage-callout">${esc(labels.length?labels.join(", "):`${c.issueCoverage.length} issue units`)}</div></div>`;}return{html};}

const LEVELS={root,characterList,character,continuityList,continuity,seriesList,series,run,issue,collection};
let stack=[];let token=0;
function shell(body){const crumbs=stack.map((x,i)=>`${i?`<span class="cx-crumb-sep">/</span>`:""}<span class="cx-crumb" data-i="${i}" data-current="${i===stack.length-1}">${esc(x.label)}</span>`).join("");return `<div class="cx-topbar"><button class="cx-back-btn" id="cxBackBtn">${stack.length>1?"←":"✕"}</button><div class="cx-breadcrumb">${crumbs}</div></div>${body}`;}
async function render(){const el=document.getElementById("comicsExplorerContent");if(!el||!stack.length)return;const t=++token;el.innerHTML=shell(`<div class="cx-loading">Loading…</div>`);let out;try{out=await LEVELS[stack.at(-1).level](stack.at(-1).params||{});}catch(e){console.error("[Comics Explorer]",e);out={html:`<div class="cx-error">Couldn't load this right now. ${esc(e.message||"")}</div>`};}if(t!==token)return;el.innerHTML=shell(out.html);el.querySelector("#cxBackBtn")?.addEventListener("click",back);el.querySelectorAll(".cx-crumb[data-current=\"false\"]").forEach(x=>x.addEventListener("click",()=>{stack=stack.slice(0,+x.dataset.i+1);render();}));out.wire?.(el);}
function push(level,label,params){const actual=label?.label?String(label.label):label;stack.push({level,label:actual||level,params:params||{}});render();}
function openAt(trail){stack=[{level:"root",label:"Comics",params:{}}];for(const t of (trail||[])){if(LEVELS[t.level])stack.push({level:t.level,label:t.label||t.level,params:t.params||{}});}open();render();}
function open(){const b=document.getElementById("comicsExplorerBackdrop"),s=document.getElementById("comicsExplorerSheet");if(b)b.dataset.open="true";if(s)s.dataset.open="true";}
function back(){if(stack.length<=1){close();return;}stack.pop();render();}
function close(){document.getElementById("comicsExplorerBackdrop")?.setAttribute("data-open","false");document.getElementById("comicsExplorerSheet")?.setAttribute("data-open","false");}
export function openComicsExplorer(){stack=[{level:"root",label:"Comics",params:{}}];open();render();}
export function openComicsExplorerAt(t){openAt(t);}
window.__comicsExplorer={open:openComicsExplorer,openAt:openComicsExplorerAt};
document.addEventListener("click",e=>{if(e.target.closest("#comicsExplorerEntryBtn"))openComicsExplorer();});
document.getElementById("comicsExplorerBackdrop")?.addEventListener("click",close);
document.getElementById("comicsExplorerClose")?.addEventListener("click",close);
