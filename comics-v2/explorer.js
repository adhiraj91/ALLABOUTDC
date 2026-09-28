// ALLABOUTDC Comics Explorer — generic DC architecture, currently seeded with New 52 Batman territory.
// Source of truth: Series -> Publication Units (Issues/Annuals/Specials) -> Collected Editions.
import * as data from "./data.js?v=dc3";
import { COLLECTIONS } from "./schema.js";

const esc=s=>s==null?"":String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");
const year=s=>String(s?.startDate||"").slice(0,4);
const range=s=>{const a=s?.startDate||"",b=s?.endDate||"";return a&&b?`${a}–${b}`:a?`${a}–present`:b;};
const issueType=i=>String(i?.issueLabelType||"numbered");
const issueNum=i=>{const n=parseFloat(i?.issueNumber);return Number.isFinite(n)?n:Infinity;};
const sortIssues=a=>a.sort((x,y)=>issueNum(x)-issueNum(y)||String(x.issueLabel||"").localeCompare(String(y.issueLabel||"")));
const titleOf=c=>c?.displayName||c?.name||"Character";
const GROUP_ORDER={"Core Batman":0,"Core":0,"Gotham & Spin-offs":10,"Gotham & Spin-Offs":10,"Team-Ups":20,"Bat-Family":30,"Other":99};
const groupRank=g=>GROUP_ORDER[g]??50;

const cache=new Map();
async function get(col,id){if(!id)return null;const k=`${col}:${id}`;if(cache.has(k))return cache.get(k);const p=data.getEntity(col,id).catch(()=>null);cache.set(k,p);return p;}
async function allSeries(){return (await data.getAllSeries(500)).filter(s=>s && s.scope==="batman-new52");}
function isRootCharacter(c){return c?.browseRoot===true || (c?.browseRoot==null && !c?.parentCharacterId);}
function issueBuckets(issues){
  const b={numbered:[],annual:[],special:[],one_shot:[]};
  for(const i of issues){const t=issueType(i);if(t==="annual")b.annual.push(i);else if(t==="one_shot")b.one_shot.push(i);else if(t==="special")b.special.push(i);else b.numbered.push(i);}
  Object.values(b).forEach(sortIssues);return b;
}
function tabs(active,items){return `<div class="cx-tabs" role="tablist">${items.map(x=>`<button class="cx-tab ${x[0]===active?"is-active":""}" data-tab="${esc(x[0])}" role="tab">${esc(x[1])}${x[2]!=null?` <span>${x[2]}</span>`:""}</button>`).join("")}</div>`;}
function row(title,sub,attrs=""){return `<div class="cx-row" ${attrs}><div class="cx-row-body"><div class="cx-row-title">${esc(title)}</div>${sub?`<div class="cx-row-sub">${esc(sub)}</div>`:""}</div><div class="cx-row-chevron">›</div></div>`;}
function empty(msg){return `<div class="cx-empty">${esc(msg)}</div>`;}
function stat(label,value){return `<div class="cx-stat"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;}
function formatKey(c){
  const title=String(c?.title||"").toLowerCase();
  const raw=String(c?.format||"Other").toLowerCase();
  if(title.includes("compact comics edition") || raw.includes("compact"))return "Compact";
  if(raw.includes("deluxe") || title.includes("deluxe edition"))return "Deluxe";
  if(raw.includes("omnibus") || title.includes("omnibus"))return "Omnibus";
  if(raw.includes("hardcover") || raw==="hc")return "Hardcover";
  if(raw.includes("tpb") || raw.includes("trade"))return "TPB";
  return "Other";
}
const FORMAT_ORDER={TPB:0,Hardcover:1,Omnibus:2,Deluxe:3,Compact:4,Other:9};
const formatLabel=f=>f==="Other"?"Special Editions":f;
function collectionStart(c){const first=c?.issueCoverage?.[0]?.issueLabel||"";const n=parseFloat(String(first).replace(/[^0-9.]/g,""));return Number.isFinite(n)?n:9999;}
function collectionVolume(c){const m=String(c?.title||"").match(/\bVol\.\s*(\d+)/i);return m?Number(m[1]):9999;}
function collectionSort(a,b){return collectionStart(a)-collectionStart(b)||collectionVolume(a)-collectionVolume(b)||String(a.title||"").localeCompare(String(b.title||""));}
function displayCollectionTitle(c,collections){
  const title=String(c?.title||"");
  // The publisher reused Vol. 1/2/3 numbering after the Batgirl creative reset.
  // Keep the official title in the data, but make the catalogue sequence unambiguous.
  if(c?.seriesIds?.some(id=>id.includes("batgirl-2011"))){
    const m=title.match(/^Batgirl Vol\.\s*(\d+)\s*:\s*(.+)$/i);
    if(m){
      const n=Number(m[1]);
      if(n===1 && /Batgirl of Burnside/i.test(m[2])) return "Batgirl: Batgirl of Burnside";
      if(n===2 && /Family Business/i.test(m[2])) return "Batgirl: Family Business";
      if(n===3 && /Mindfields/i.test(m[2])) return "Batgirl: Mindfields";
    }
  }
  if(title.includes("Compact Comics Edition")) return title.replace(/\s+—\s+DC Compact Comics Edition/i, " — Compact Edition");
  return title;
}
function coverageLabel(c){
  const labels=(c?.issueCoverage||[]).map(x=>x.issueLabel).filter(Boolean);
  if(!labels.length)return "Coverage recorded in catalogue";
  const nums=labels.filter(x=>/^#?\d+(\.\d+)?$/.test(String(x).replace(/^#/,"")));
  if(nums.length===labels.length){
    const n=nums.map(x=>parseFloat(String(x).replace(/^#/,""))).sort((a,b)=>a-b);
    if(n.length===1)return `Issue #${n[0]}`;
    return `Issues #${n[0]}–#${n[n.length-1]} · ${labels.length} units`;
  }
  return `${labels.length} publication units`;
}
function collectionRows(cs){
  if(!cs.length)return empty("No collected editions are recorded for this format.");
  const sorted=[...cs].sort(collectionSort);
  return `<div class="cx-collection-grid">${sorted.map((c,n)=>`<button class="cx-collection-card" data-coll="${esc(c.id)}"><div class="cx-collection-top"><span class="cx-collection-num">${String(n+1).padStart(2,"0")}</span><span class="cx-format-pill">${esc(formatLabel(formatKey(c)))}</span></div><strong>${esc(displayCollectionTitle(c,sorted))}</strong><small>${esc(coverageLabel(c))}</small><span class="cx-card-arrow">↗</span></button>`).join("")}</div>`;
}
function wirePublications(el,issues,collections,s){el.querySelectorAll("[data-pub]").forEach(r=>r.addEventListener("click",()=>{const i=issues.find(x=>x.id===r.dataset.pub);if(i)push("issue",i.issueLabel,{issue:i,series:s});}));el.querySelectorAll("[data-coll]").forEach(r=>r.addEventListener("click",()=>{const c=collections.find(x=>x.id===r.dataset.coll);if(c)push("collection",c.title,{collectionEntity:c});}));}

async function root(){
  const [universes,conts,chars,series]=await Promise.all([data.getAllUniverses(20),data.getAllContinuities(50),data.getAllCharacters(200),allSeries()]);
  const roots=chars.filter(isRootCharacter); const ct=conts[0]; const u=universes[0];
  return {html:`<div class="cx-kicker">DC COMICS</div><h2 class="cx-title">Explore the DC Universe</h2><div class="cx-subtitle">The catalogue grows territory by territory. Current mapped coverage starts with The New 52 → Batman.</div>
    <div class="cx-entry-grid">
      <button class="cx-entry-btn" data-go="characterList"><span class="cx-entry-icon">◉</span><span class="cx-entry-btn-label">By Character</span><span class="cx-entry-btn-sub">${roots.length} mapped starting character${roots.length===1?"":"s"}</span><span class="cx-entry-arrow">↗</span></button>
      <button class="cx-entry-btn" data-go="continuityList"><span class="cx-entry-icon">◎</span><span class="cx-entry-btn-label">By Continuity / Era</span><span class="cx-entry-btn-sub">Explore the DC timeline by era and continuity</span><span class="cx-entry-arrow">↗</span></button>
      <button class="cx-entry-btn" data-go="seriesList"><span class="cx-entry-icon">▦</span><span class="cx-entry-btn-label">Browse Series</span><span class="cx-entry-btn-sub">${series.length} currently mapped series</span><span class="cx-entry-arrow">↗</span></button>
      <button class="cx-entry-btn" data-go="atlas"><span class="cx-entry-icon">✦</span><span class="cx-entry-btn-label">Story Map</span><span class="cx-entry-btn-sub">Enter the connected DC universe graph</span><span class="cx-entry-arrow">↗</span></button>
    </div>
,
    wire(c){c.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>{const a=b.dataset.go;if(a==="atlas"){window.__comicsStoryMap?.open?.("universe",u?.id);return;}if(a==="continuity")push("continuity",ct?.name||"Continuity",{continuity:ct});else{const labels={characterList:"Characters",continuityList:"Continuity / Era",seriesList:"Series"};push(a,labels[a]||a,{});}}));}};
}

async function characterList(){
  const all=await data.getAllCharacters(200); const chars=all.filter(c=>c?.browseRoot===true);
  if(!chars.length)return {html:empty("No catalogue-root characters are mapped yet.")};
  const series=await allSeries();
  const cards=chars.sort((a,b)=>titleOf(a).localeCompare(titleOf(b))).map(c=>{const n=series.filter(s=>s.characterIds?.includes(c.id)).length;return `<button class="cx-character-card" data-char="${esc(c.id)}"><div class="cx-character-orb">${esc(titleOf(c).slice(0,1))}</div><div><span>CATALOGUE ROOT</span><strong>${esc(titleOf(c))}</strong><small>${n} mapped series · New 52 starting territory</small></div><b>→</b></button>`;}).join("");
  return {html:`<div class="cx-kicker">CHARACTERS</div><h2 class="cx-title">Enter through a character</h2><div class="cx-subtitle">Batman is the current character entry point. Supporting characters, Bat-Family branches and Gotham-side books live inside Batman’s connected territory.</div><div class="cx-character-grid">${cards}</div>`,wire(c){c.querySelectorAll("[data-char]").forEach(r=>r.addEventListener("click",()=>{const x=chars.find(v=>v.id===r.dataset.char);push("character",titleOf(x),{character:x});}));}};
}

async function character(p){
  const c=p.character;if(!c)return{html:empty("Character not found.")};
  const series=(await allSeries()).filter(s=>Array.isArray(s.characterIds)&&s.characterIds.includes(c.id));
  const grouped=new Map();
  const classify=(s)=>{
    if(String(s.title||"").toLowerCase()==="batman") return "Batman";
    if(s.lineCategory==="Gotham & Spin-offs"||s.lineCategory==="Gotham & Spin-offs") return "Gotham & Spin-offs";
    if(s.lineCategory==="Team-Ups") return "Team-Ups";
    if(s.lineCategory==="Bat-Family" || s.lineCategory==="Core Batman") return "Bat-Family";
    return "Other Batman";
  };
  series.forEach(s=>{const k=classify(s);if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(s);});
  const CAT_ORDER={"Batman":0,"Bat-Family":10,"Gotham & Spin-offs":20,"Team-Ups":30,"Other Batman":40}; const cats=[...grouped.keys()].sort((a,b)=>(CAT_ORDER[a]??99)-(CAT_ORDER[b]??99)||a.localeCompare(b));
  const totalIssues=series.reduce((n,s)=>n+(Number(s.issueCount)||0),0);
  let html=`<div class="cx-character-hero"><div class="cx-character-orb large">${esc(titleOf(c).slice(0,1))}</div><div><div class="cx-kicker">CHARACTER TERRITORY</div><h2 class="cx-title">${esc(titleOf(c))}</h2><div class="cx-subtitle">${esc((c.aliases||[]).join(" · "))}${c.aliases?.length?" · ":""}New 52 mapped territory</div></div></div><div class="cx-stat-grid">${stat("Mapped series",series.length)}${stat("Numbered issues",totalIssues)}${stat("Publication lines",cats.length)}</div>`;
  for(const cat of cats){const list=grouped.get(cat).sort((a,b)=>year(a).localeCompare(year(b))||a.title.localeCompare(b.title));html+=`<div class="cx-series-section"><div class="cx-section-head"><div><span>${esc(cat.toUpperCase())}</span><h3>${esc(cat)}</h3></div><em>${list.length} series</em></div><div class="cx-series-grid">${list.map(s=>`<button class="cx-series-card" data-series="${esc(s.id)}"><div class="cx-series-card-top"><span>${esc(year(s)||"DC")}</span><b>${String(s.issueCount||0).padStart(2,"0")}</b></div><strong>${esc(s.title)}</strong><small>${esc(range(s))}</small><i>Open series →</i></button>`).join("")}</div></div>`;}
  return{html,wire(cn){cn.querySelectorAll("[data-series]").forEach(r=>r.addEventListener("click",()=>{const s=series.find(x=>x.id===r.dataset.series);push("series",s.title,{series:s});}));}};
}

async function continuityList(){
  const cs=await data.getAllContinuities(50);if(!cs.length)return{html:empty("No continuities are mapped yet.")};
  const cards=cs.sort((a,b)=>String(a.startDate||"").localeCompare(String(b.startDate||""))).map((c,i)=>`<button class="cx-era-card ${i===0?"is-current":""}" data-cont="${esc(c.id)}"><div class="cx-era-number">${String(i+1).padStart(2,"0")}</div><div class="cx-era-line"></div><span>${esc(c.shortName||"CONTINUITY")}</span><strong>${esc(c.name)}</strong><small>${esc(c.startDate?`${c.startDate}–${c.endDate||"present"}`:"Timeline territory")}</small><b>Enter →</b></button>`).join("");
  return{html:`<div class="cx-kicker">DC TIMELINE</div><h2 class="cx-title">Explore the timeline</h2><div class="cx-subtitle">Move through DC history by era and continuity. Each territory opens into the characters, series and publications mapped there.</div><div class="cx-era-grid">${cards}</div>` ,wire(c){c.querySelectorAll("[data-cont]").forEach(r=>r.addEventListener("click",()=>{const x=cs.find(v=>v.id===r.dataset.cont);push("continuity",x.name,{continuity:x});}));}};
}

async function continuity(p){const ct=p.continuity;const [series,chars]=await Promise.all([data.getSeriesForContinuity(ct.id),data.getAllCharacters(200)]);const roots=chars.filter(c=>c?.browseRoot===true&&c.continuityIds?.includes(ct.id));
 let html=`<div class="cx-kicker">CONTINUITY / ERA</div><h2 class="cx-title">${esc(ct.name)}</h2><div class="cx-subtitle">${esc(ct.startDate||"")}${ct.endDate?`–${esc(ct.endDate)}`:""} · ${series.length} mapped series</div>`;
 if(ct.description)html+=`<div class="sheet-section"><div class="sheet-label">ABOUT THIS TERRITORY</div><div class="cx-info-card">${esc(ct.description)}</div></div>`;
 if(roots.length)html+=`<div class="sheet-section"><div class="sheet-label">ENTRY POINTS</div><div class="cx-character-grid">${roots.map(c=>`<button class="cx-character-card" data-root-char="${esc(c.id)}"><div class="cx-character-orb">${esc(titleOf(c).slice(0,1))}</div><div><span>CHARACTER</span><strong>${esc(titleOf(c))}</strong><small>Open character territory</small></div><b>→</b></button>`).join("")}</div></div>`;
 html+=`<div class="sheet-section"><div class="sheet-label">SERIES IN THIS TERRITORY</div><div class="cx-series-grid">${series.sort((a,b)=>groupRank(a.lineCategory)-groupRank(b.lineCategory)||year(a).localeCompare(year(b))||a.title.localeCompare(b.title)).map(s=>`<button class="cx-series-card" data-series="${esc(s.id)}"><div class="cx-series-card-top"><span>${esc(s.lineCategory||"SERIES")}</span><b>${String(s.issueCount||0).padStart(2,"0")}</b></div><strong>${esc(s.title)}</strong><small>${esc(range(s))}</small><i>Open series →</i></button>`).join("")}</div></div>`;
 return{html,wire(c){c.querySelectorAll("[data-root-char]").forEach(r=>r.addEventListener("click",()=>{const x=roots.find(v=>v.id===r.dataset.rootChar);push("character",titleOf(x),{character:x});}));c.querySelectorAll("[data-series]").forEach(r=>r.addEventListener("click",()=>{const x=series.find(v=>v.id===r.dataset.series);push("series",x.title,{series:x});}));}};
}

async function seriesList(){const ss=(await allSeries()).sort((a,b)=>groupRank(a.lineCategory)-groupRank(b.lineCategory)||year(a).localeCompare(year(b))||a.title.localeCompare(b.title));if(!ss.length)return{html:empty("No series are mapped yet.")};const groups=new Map();ss.forEach(s=>{const k=s.lineCategory||"Other";if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s);});let html=`<div class="cx-kicker">SERIES</div><h2 class="cx-title">DC Comics catalogue</h2><div class="cx-subtitle">Current mapped territory: The New 52 · Batman. Future New 52 territories use this same catalogue.</div>`;for(const [g,list] of groups){html+=`<div class="cx-series-section"><div class="cx-section-head"><div><span>${esc(g.toUpperCase())}</span><h3>${esc(g)}</h3></div><em>${list.length} series</em></div><div class="cx-series-grid">${list.map(s=>`<button class="cx-series-card" data-series="${esc(s.id)}"><div class="cx-series-card-top"><span>${esc(year(s)||"DC")}</span><b>${String(s.issueCount||0).padStart(2,"0")}</b></div><strong>${esc(s.title)}</strong><small>${esc(range(s))}</small><i>Open series →</i></button>`).join("")}</div></div>`;}return{html,wire(c){c.querySelectorAll("[data-series]").forEach(r=>r.addEventListener("click",()=>{const s=ss.find(x=>x.id===r.dataset.series);push("series",s.title,{series:s});}));}};}

async function series(p){
  const s=p.series;if(!s)return{html:empty("Series not found.")};
  const [issues,collections,runs,creators]=await Promise.all([data.getIssuesForSeries(s.id),data.getCollectionsForSeries(s.id).catch(()=>[]),data.getRunsForSeries(s.id),Promise.all((s.creatorIds||[]).map(id=>get(COLLECTIONS.CREATORS,id)))]);sortIssues(issues);const b=issueBuckets(issues);
  const counts={issues:b.numbered.length,annuals:b.annual.length,specials:b.special.length+b.one_shot.length,collections:collections.length};
  const first=b.numbered[0]?.issueNumber,last=b.numbered[b.numbered.length-1]?.issueNumber;
  const availableFormats=Array.from(new Set(collections.map(formatKey))).sort((a,b)=>(FORMAT_ORDER[a]??9)-(FORMAT_ORDER[b]??9));
  let html=`<div class="cx-kicker">SERIES</div><h2 class="cx-title">${esc(s.title)}</h2><div class="cx-subtitle">${esc(range(s))} · ${counts.issues} numbered issues${counts.annuals?` · ${counts.annuals} annuals`:""}${counts.specials?` · ${counts.specials} specials/one-shots`:""}</div>`;
  if(creators.filter(Boolean).length)html+=`<div class="cx-tag-row">${creators.filter(Boolean).map(c=>`<span class="tag">${esc(titleOf(c))}</span>`).join("")}</div>`;
  html+=`<div class="sheet-section"><div class="sheet-label">THE STORY</div><div class="cx-info-card">${esc(s.description||"A New 52 publication mapped as part of the connected DC Comics catalogue.")}</div></div>`;
  html+=`<div class="cx-publication-summary"><div>${stat("Issues",counts.issues)}<span class="cx-summary-detail">${counts.issues?`#${first}–#${last}`:"Not recorded"}</span></div><div>${stat("Annuals",counts.annuals)}<span class="cx-summary-detail">${counts.annuals?"Annual publications recorded":"None recorded"}</span></div><div>${stat("Specials",counts.specials)}<span class="cx-summary-detail">${counts.specials?"Special / one-shot units":"None recorded"}</span></div></div>`;
  if(runs.length){html+=`<div class="cx-series-section"><div class="cx-section-head"><div><span>CREATIVE HISTORY</span><h3>Creative runs</h3></div><em>${runs.length} runs</em></div><div class="cx-run-grid">${runs.sort((a,b)=>(Number(a.startIssue)||0)-(Number(b.startIssue)||0)).map((r,i)=>`<div class="cx-run-card"><strong>${esc(r.title||creators.filter(Boolean).map(c=>titleOf(c)).join(" / ")||"Run")}</strong><span>${esc(coverage(r))}</span><b>Creative history</b></div>`).join("")}</div></div>`;}
  html+=`<div class="cx-series-section"><div class="cx-section-head"><div><span>PUBLICATIONS</span><h3>Collected editions & extras</h3></div></div>${tabs("overview",[["overview","Overview"],["collections","Collected Editions",counts.collections],["annuals","Annuals",counts.annuals],["specials","Specials",counts.specials]])}<div id="cxTabBody"></div></div>`;
  return{html,wire(c){const tabBody=c.querySelector("#cxTabBody");const renderTab=t=>{
      if(t==="overview")tabBody.innerHTML=`<div class="cx-overview-panel"><div class="cx-issue-box"><span>NUMBERED RUN</span><strong>${esc(counts.issues?`#${first} — #${last}`:"No numbered issues recorded")}</strong><small>This is the complete numbered run represented in the catalogue. The story itself is organised below through its creative history and collected editions.</small></div><div class="cx-overview-grid"><div><b>${counts.annuals}</b><span>Annual publications</span><small>${esc(b.annual.map(i=>i.issueLabel).join(" · ")||"None recorded")}</small></div><div><b>${counts.specials}</b><span>Specials / one-shots</span><small>${esc([...b.special,...b.one_shot].map(i=>i.issueLabel).join(" · ")||"None recorded")}</small></div><div><b>${counts.collections}</b><span>Collected editions</span><small>Organised by publication format</small></div></div></div>`;
      else if(t==="collections")tabBody.innerHTML=`<div class="cx-subtab-wrap">${tabs(availableFormats[0]||"",availableFormats.map(f=>[f,formatLabel(f),collections.filter(c=>formatKey(c)===f).length]))}<div id="cxCollectionBody"></div></div>`;
      else if(t==="annuals")tabBody.innerHTML=publicationRows(b.annual);
      else tabBody.innerHTML=publicationRows([...b.special,...b.one_shot]);
      if(t==="collections"){const body=tabBody.querySelector("#cxCollectionBody");const drawFormat=f=>{body.innerHTML=collectionRows(collections.filter(c=>formatKey(c)===f));wirePublications(body,issues,collections,s);};drawFormat(availableFormats[0]||"");tabBody.querySelectorAll(".cx-tab").forEach(btn=>btn.addEventListener("click",()=>{tabBody.querySelectorAll(".cx-tab").forEach(x=>x.classList.remove("is-active"));btn.classList.add("is-active");drawFormat(btn.dataset.tab);}));}else wirePublications(tabBody,issues,collections,s);
    };renderTab("overview");c.querySelectorAll(":scope > .cx-series-section .cx-tabs > .cx-tab").forEach(t=>t.addEventListener("click",()=>{c.querySelectorAll(":scope > .cx-series-section .cx-tabs > .cx-tab").forEach(x=>x.classList.remove("is-active"));t.classList.add("is-active");renderTab(t.dataset.tab);}));}};
}

async function run(p){
  const r=p.run,s=p.series;if(!r||!s)return{html:empty("Run not found.")};
  const creators=await Promise.all((r.creatorIds||[]).map(id=>get(COLLECTIONS.CREATORS,id)));
  const [issues,collections]=await Promise.all([data.getIssuesForSeries(s.id),data.getCollectionsForSeries(s.id).catch(()=>[])]);sortIssues(issues);
  const lo=Number(r.startIssue),hi=Number(r.endIssue);const inRun=Number.isFinite(lo)&&Number.isFinite(hi)?issues.filter(i=>{const n=issueNum(i);return n>=lo&&n<=hi;}):[];const b=issueBuckets(inRun);
  const counts={issues:b.numbered.length,annuals:b.annual.length,specials:b.special.length+b.one_shot.length,collections:collections.length};
  let html=`<div class="cx-kicker">CREATIVE RUN</div><h2 class="cx-title">${esc(r.title||creators.filter(Boolean).map(titleOf).join(" / ")||"Run")}</h2><div class="cx-subtitle">${esc(coverage(r))}${inRun.length?` · ${inRun.length} numbered issues`:""}</div>`;
  if(creators.filter(Boolean).length)html+=`<div class="cx-tag-row">${creators.filter(Boolean).map(c=>`<span class="tag">${esc(titleOf(c))}</span>`).join("")}</div>`;
  html+=`<div class="cx-publication-summary">${stat("Issues",counts.issues)}${stat("Annuals",counts.annuals)}${stat("Specials",counts.specials)}</div>`;
  html+=`<div class="sheet-section"><div class="sheet-label">PUBLICATION COVERAGE</div><div class="cx-coverage-callout">${esc(coverage(r))}</div></div>`;
  html+=`<div class="cx-series-section"><div class="cx-section-head"><div><span>PUBLICATIONS</span><h3>Run material</h3></div></div>${tabs("overview",[["overview","Overview"],["collections","Collected Editions",counts.collections],["annuals","Annuals",counts.annuals],["specials","Specials",counts.specials]])}<div id="cxRunTab"></div></div>`;
  return{html,wire(c){const body=c.querySelector("#cxRunTab");const draw=t=>{
      if(t==="overview")body.innerHTML=`<div class="cx-overview-panel"><div class="cx-issue-box"><span>RUN COVERAGE</span><strong>${esc(coverage(r))}</strong><small>${counts.issues} numbered issue${counts.issues===1?"":"s"} in this creative run. Annuals and specials are listed separately below.</small></div><div class="cx-overview-grid"><div><b>${counts.annuals}</b><span>Annual publications</span><small>${esc(b.annual.map(i=>i.issueLabel).join(" · ")||"None recorded")}</small></div><div><b>${counts.specials}</b><span>Specials / one-shots</span><small>${esc([...b.special,...b.one_shot].map(i=>i.issueLabel).join(" · ")||"None recorded")}</small></div><div><b>${counts.collections}</b><span>Collected editions</span><small>Organised by publication format</small></div></div></div>`;
      else if(t==="collections")body.innerHTML=collectionRows(collections);
      else if(t==="annuals")body.innerHTML=publicationRows(b.annual);
      else body.innerHTML=publicationRows([...b.special,...b.one_shot]);
      wirePublications(body,inRun,collections,s);
    };draw("overview");c.querySelectorAll(":scope > .cx-series-section .cx-tabs > .cx-tab").forEach(t=>t.addEventListener("click",()=>{c.querySelectorAll(":scope > .cx-series-section .cx-tabs > .cx-tab").forEach(x=>x.classList.remove("is-active"));t.classList.add("is-active");draw(t.dataset.tab);}));}};
}

async function issue(p){const i=p.issue;if(!i)return{html:empty("Issue not found.")};const s=p.series||await get(COLLECTIONS.SERIES,i.seriesId);const cs=await Promise.all((i.creatorIds||[]).map(id=>get(COLLECTIONS.CREATORS,id)));let html=`<div class="cx-kicker">PUBLICATION</div><h2 class="cx-title">${esc(i.issueLabel||"Issue")}${i.title?` — ${esc(i.title)}`:""}</h2><div class="cx-subtitle">${esc(s?.title||"")}${i.publicationDate?` · ${esc(i.publicationDate)}`:""}</div>`;if(i.issueLabelType)html+=`<div class="cx-tag-row"><span class="tag">${esc(i.issueLabelType)}</span></div>`;if(cs.filter(Boolean).length)html+=`<div class="cx-tag-row">${cs.filter(Boolean).map(c=>`<span class="tag">${esc(titleOf(c))}</span>`).join("")}</div>`;return{html};}
async function collection(p){const c=p.collectionEntity;if(!c)return{html:empty("Edition not found.")};const s=await get(COLLECTIONS.SERIES,c.seriesIds?.[0]);let html=`<div class="cx-kicker">COLLECTED EDITION</div><h2 class="cx-title">${esc(c.title)}</h2><div class="cx-subtitle">${esc(formatKey(c))}${s?` · ${esc(s.title)}`:""}</div>`;if(c.issueCoverage?.length){const labels=c.issueCoverage.map(x=>x.issueLabel).filter(Boolean);html+=`<div class="sheet-section"><div class="sheet-label">COVERS</div><div class="cx-coverage-callout">${esc(labels.length?labels.join(", "):`${c.issueCoverage.length} issue units`)}</div></div>`;}return{html};}

const LEVELS={root,characterList,character,continuityList,continuity,seriesList,series,run,issue,collection};
let stack=[];let token=0;
function shell(body){const crumbs=stack.map((x,i)=>`${i?`<span class="cx-crumb-sep">/</span>`:""}<span class="cx-crumb" data-i="${i}" data-current="${i===stack.length-1}">${esc(x.label)}</span>`).join("");return `<div class="cx-topbar"><button class="cx-back-btn" id="cxBackBtn">${stack.length>1?"←":"✕"}</button><div class="cx-breadcrumb">${crumbs}</div></div>${body}`;}
async function render(){const el=document.getElementById("comicsExplorerContent");if(!el||!stack.length)return;const t=++token;el.innerHTML=shell(`<div class="cx-loading">Loading…</div>`);let out;try{out=await LEVELS[stack.at(-1).level](stack.at(-1).params||{});}catch(e){console.error("[Comics Explorer]",e);out={html:`<div class="cx-error">Couldn't load this right now. ${esc(e.message||"")}</div>`};}if(t!==token)return;el.innerHTML=shell(out.html);el.querySelector("#cxBackBtn")?.addEventListener("click",back);el.querySelectorAll('.cx-crumb[data-current="false"]').forEach(x=>x.addEventListener("click",()=>{stack=stack.slice(0,+x.dataset.i+1);render();}));out.wire?.(el);}
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
