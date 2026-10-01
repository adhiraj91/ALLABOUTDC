// ALLABOUTDC Comics Explorer — generic DC architecture, currently seeded with New 52 Batman territory.
// Source of truth: Series -> Publication Units (Issues/Annuals/Specials) -> Collected Editions.
import * as data from "./data.js?v=dc3";
import { COLLECTIONS } from "./schema.js";
import * as bp from "./branch-paths.js?v=bp2";

const esc=s=>s==null?"":String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");
const year=s=>String(s?.startDate||"").slice(0,4);
const range=s=>{const a=s?.startDate||"",b=s?.endDate||"";return a&&b?`${a}–${b}`:a?`${a}–present`:b;};
const issueType=i=>String(i?.issueLabelType||"numbered");
const issueNum=i=>{const n=parseFloat(i?.issueNumber);return Number.isFinite(n)?n:Infinity;};
const sortIssues=a=>a.sort((x,y)=>issueNum(x)-issueNum(y)||String(x.issueLabel||"").localeCompare(String(y.issueLabel||"")));
const titleOf=c=>c?.displayName||c?.name||"Character";
const GROUP_ORDER={"Core Batman":0,"Core Superman":0,"Core Flash":0,"Core Lantern":0,"Core":0,"Bat-Family":10,"Superman Family":10,"Lantern Spin-offs":10,"Lantern-Adjacent":20,"Gotham & Spin-offs":20,"Gotham & Spin-Offs":20,"Team-Ups":30,"Limited Series":40,"Other":99};
const groupRank=g=>GROUP_ORDER[g]??50;

const cache=new Map();
async function get(col,id){if(!id)return null;const k=`${col}:${id}`;if(cache.has(k))return cache.get(k);const p=data.getEntity(col,id).catch(()=>null);cache.set(k,p);return p;}
// Every mapped series (no territory-specific filter — new territories appear automatically).
async function allSeries(){return (await data.getAllSeries(500)).filter(Boolean);}
// Catalogue-root characters, derived from the data rather than any hardcoded name:
// records flagged browseRoot:true; if no record carries that flag (records written before the
// hierarchy fields existed), a root is a character with no parent who leads at least one series.
function resolveRoots(chars,series){
  const list=(chars||[]).filter(Boolean);
  const flagged=list.filter(c=>c.browseRoot===true);
  if(flagged.length)return flagged;
  const leads=new Set((series||[]).map(s=>s?.characterIds?.[0]).filter(Boolean));
  return list.filter(c=>!c.parentCharacterId&&leads.has(c.id));
}
const childrenOf=(c,chars)=>(chars||[]).filter(x=>x&&x.parentCharacterId===c.id);
// A character's territory: series featuring the character or anyone in its family branch.
function territorySeries(c,chars,series){const ids=new Set([c.id,...childrenOf(c,chars).map(x=>x.id)]);return (series||[]).filter(s=>(s.characterIds||[]).some(id=>ids.has(id)));}
const leadCount=(c,series)=>(series||[]).filter(s=>s?.characterIds?.[0]===c.id).length;
function lineGroups(list){const m=new Map();(list||[]).forEach(s=>{const k=s.lineCategory||"Other";if(!m.has(k))m.set(k,[]);m.get(k).push(s);});return [...m.entries()].sort((a,b)=>groupRank(a[0])-groupRank(b[0])||a[0].localeCompare(b[0])).map(([k,v])=>[k,v.sort((x,y)=>String(x.startDate||"").localeCompare(String(y.startDate||""))||x.title.localeCompare(y.title))]);}
function issueBuckets(issues){
  const b={numbered:[],annual:[],special:[],one_shot:[]};
  for(const i of issues){const t=issueType(i);if(t==="annual")b.annual.push(i);else if(t==="one_shot")b.one_shot.push(i);else if(t==="special")b.special.push(i);else b.numbered.push(i);}
  Object.values(b).forEach(sortIssues);return b;
}
function tabs(active,items){return `<div class="cx-tabs" role="tablist">${items.map(x=>`<button class="cx-tab ${x[0]===active?"is-active":""}" data-tab="${esc(x[0])}" role="tab">${esc(x[1])}${x[2]!=null?` <span>${x[2]}</span>`:""}</button>`).join("")}</div>`;}
function row(title,sub,attrs=""){return `<div class="cx-row" ${attrs}><div class="cx-row-body"><div class="cx-row-title">${esc(title)}</div>${sub?`<div class="cx-row-sub">${esc(sub)}</div>`:""}</div><div class="cx-row-chevron">›</div></div>`;}
function empty(msg){return `<div class="cx-empty">${esc(msg)}</div>`;}
// Run coverage line, e.g. "Issues #1–#52 · 2011-09–2016-05" — built only from the run record's own fields.
function coverage(r){const a=r?.startIssue,b=r?.endIssue;const has=v=>v!=null&&String(v)!=="";const iss=has(a)&&has(b)?(String(a)===String(b)?`Issue #${a}`:`Issues #${a}–#${b}`):"Issue range not recorded";const yrs=range(r);return yrs?`${iss} · ${yrs}`:iss;}
// Annual / special rows; data-pub is what wirePublications() listens for to open the issue screen.
function publicationRows(list){if(!list||!list.length)return empty("None recorded.");return `<div class="cx-list">${list.map(i=>row(i.issueLabel||(i.issueNumber!=null?`#${i.issueNumber}`:"Issue"),[i.title,i.publicationDate].filter(Boolean).join(" · "),`data-pub="${esc(i.id)}"`)).join("")}</div>`;}
function stat(label,value){return `<div class="cx-stat"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;}
// Format is read from the record's own `format` field — never inferred from the title.
// "HC/TPB" is a supplied value meaning the source does not separate hardcover from paperback,
// so it stays its own "Collected Volumes" group instead of being counted as TPB.
function formatKey(c){
  const raw=String(c?.format||"Other").trim().toLowerCase().replace(/\s+/g,"");
  if(raw==="hc/tpb"||raw==="tpb/hc")return "Volume";
  if(raw.includes("compact"))return "Compact";
  if(raw.includes("essential"))return "Essential";
  if(raw.includes("deluxe"))return "Deluxe";
  if(raw.includes("omnibus"))return "Omnibus";
  if(raw.includes("hardcover")||raw==="hc")return "Hardcover";
  if(raw.includes("tpb")||raw.includes("trade")||raw.includes("paperback"))return "TPB";
  return "Other";
}
const FORMAT_ORDER={Volume:0,TPB:0,Hardcover:1,Omnibus:2,Deluxe:3,Essential:4,Compact:5,Other:9};
const formatLabel=f=>f==="Other"?"Special Editions":f==="Volume"?"Collected Volumes":f;
const pillLabel=c=>formatKey(c)==="Volume"?"HC/TPB":formatLabel(formatKey(c));
// Role separates a series' own numbered volumes from crossover / event collections (which only appear in it).
const roleOf=c=>c?.role||(c?.crossover?"crossover":"mainline");
const isEventRole=c=>{const r=roleOf(c);return r==="crossover"||r==="compilation";};
// Global anthologies (e.g. a New 52 Omnibus) belong to no series: they are relationships, never a series' own volume.
const isAnthology=c=>roleOf(c)==="anthology";
const isOwnMainline=(c,seriesId)=>!isEventRole(c)&&!isAnthology(c)&&(!c.primarySeriesId||!seriesId||c.primarySeriesId===seriesId);
const eventKey=t=>String(t||"").replace(/\(.*?\)/g,"").trim().replace(/^[^:]*:\s*/,"").replace(/^the\s+/i,"").replace(/\s+(compendium|saga)$/i,"").trim();
function collectionStart(c){const first=c?.issueCoverage?.[0]?.issueLabel||"";const n=parseFloat(String(first).replace(/[^0-9.]/g,""));return Number.isFinite(n)?n:9999;}
function collectionVolume(c){const m=String(c?.title||"").match(/\bVol\.\s*(\d+)/i);return m?Number(m[1]):9999;}
// Recorded publication sequence first (set per series + format in the dataset), then first issue, then volume.
function collectionSort(a,b){const sa=Number(a?.sequence),sb=Number(b?.sequence);if(Number.isFinite(sa)&&Number.isFinite(sb)&&sa!==sb)return sa-sb;return collectionStart(a)-collectionStart(b)||collectionVolume(a)-collectionVolume(b)||String(a.title||"").localeCompare(String(b.title||""));}
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
// "#1–7, #9, Annual 1" from coverage rows (decimal issues, annuals and specials kept as written).
function compressLabels(rows){
  const nums=[],other=[];(rows||[]).forEach(r=>{const l=String(r.issueLabel||"");const m=l.match(/^#?(\d+)$/);if(m)nums.push(+m[1]);else other.push(l);});
  nums.sort((a,b)=>a-b);const parts=[];for(let i=0;i<nums.length;){let j=i;while(j+1<nums.length&&nums[j+1]===nums[j]+1)j++;parts.push(i===j?`#${nums[i]}`:`#${nums[i]}–${nums[j]}`);i=j+1;}
  return [...parts,...other].join(", ");
}
// Coverage grouped by series id (a collection can span several series).
function seriesCoverage(c){const m=new Map();(c?.issueCoverage||[]).forEach(r=>{const k=r.seriesId||"?";if(!m.has(k))m.set(k,[]);m.get(k).push(r);});return m;}
function coverageLabel(c,seriesId,seriesTitle){
  const m=seriesCoverage(c);if(!m.size)return "Coverage not recorded";
  const mine=seriesId?m.get(seriesId):null;const others=m.size-(mine?1:0);
  const head=mine?`${seriesTitle?seriesTitle+" ":""}${compressLabels(mine)}`:`${(c.issueCoverage||[]).length} issues`;
  return others?`${head} + ${others} more series`:head;
}
function editionMeta(c){return [c.publicationDate?String(c.publicationDate).slice(0,4):null,c.pageCount?`${c.pageCount} pp`:null].filter(Boolean).join(" · ");}
function collectionCard(c,num,seriesId,seriesTitle){
  const review=c.reviewStatus==="needs_review";const meta=editionMeta(c);
  return `<button class="cx-collection-card" data-coll="${esc(c.id)}"><div class="cx-collection-top"><span class="cx-collection-num">${esc(num)}</span><span class="cx-format-pill">${esc(pillLabel(c))}</span></div><strong>${esc(displayCollectionTitle(c))}</strong><small>${esc(coverageLabel(c,seriesId,seriesTitle))}</small>${meta||review?`<em class="cx-collection-meta">${esc(meta)}${review?`<span class="cx-review-flag">Needs review</span>`:""}</em>`:""}<span class="cx-card-arrow">↗</span></button>`;
}
// ---- Publications: a series' own mainline volumes are grouped by format and counted per format;
// crossover / event collections and other series' volumes that merely include its issues live in their own tab.
function splitEditions(collections,seriesId){
  const list=(collections||[]).filter(Boolean);
  return {own:list.filter(c=>isOwnMainline(c,seriesId)),events:list.filter(isEventRole),anth:list.filter(isAnthology),shared:list.filter(c=>!isEventRole(c)&&!isAnthology(c)&&!isOwnMainline(c,seriesId))};
}
function eventGroups(events){
  const m=new Map();
  events.forEach(c=>{const name=eventKey(c.title);const k=name.toLowerCase().replace(/[^a-z0-9]/g,"");const g=m.get(k)||{name,eds:[]};g.eds.push(c);m.set(k,g);});
  const first=g=>g.eds.map(c=>c.publicationDate).filter(Boolean).sort()[0]||"9999";
  return [...m.values()].sort((a,b)=>first(a).localeCompare(first(b))||a.name.localeCompare(b.name));
}
function mainlineGrid(cs,seriesId,seriesTitle){
  if(!cs.length)return empty("No collected editions are recorded for this format.");
  return `<div class="cx-collection-grid">${[...cs].sort(collectionSort).map((c,n)=>collectionCard(c,String(n+1).padStart(2,"0"),seriesId,seriesTitle)).join("")}</div>`;
}
function eventsHtml(ctx,seriesId,seriesTitle){
  let html="";
  if(ctx.groups.length)html+=`<div class="cx-collection-group-label">Crossovers &amp; events · appearances in this series</div><div class="cx-evt-list">${ctx.groups.map(g=>{
    const rows=new Map();g.eds.forEach(c=>(c.issueCoverage||[]).filter(r=>r.seriesId===seriesId).forEach(r=>rows.set(r.issueId,r)));
    const mine=[...rows.values()];const others=new Set();g.eds.forEach(c=>(c.seriesIds||[]).forEach(id=>{if(id!==seriesId)others.add(id);}));
    const eds=[...g.eds].sort((a,b)=>String(a.publicationDate||"9999").localeCompare(String(b.publicationDate||"9999"))||(FORMAT_ORDER[formatKey(a)]??9)-(FORMAT_ORDER[formatKey(b)]??9));
    return `<div class="cx-evt"><div class="cx-evt-head"><span class="cx-evt-mark">✦</span><div><strong>${esc(g.name)}</strong><small>${esc([mine.length?`${seriesTitle} ${compressLabels(mine)}`:null,others.size?`+ ${others.size} other series`:null].filter(Boolean).join(" · "))}</small></div></div><div class="cx-evt-eds">${eds.map(c=>`<button class="cx-evt-ed" data-coll="${esc(c.id)}"><span>${esc(pillLabel(c))}</span>${c.publicationDate?`<em>${esc(String(c.publicationDate).slice(0,4))}</em>`:""}</button>`).join("")}</div></div>`;}).join("")}</div>`;
  if(ctx.anth.length)html+=`<div class="cx-collection-group-label">Global anthologies · not series collections</div><div class="cx-collection-grid">${[...ctx.anth].sort((a,b)=>String(a.publicationDate||"9999").localeCompare(String(b.publicationDate||"9999"))||String(a.title||"").localeCompare(String(b.title||""))).map(c=>collectionCard(c,"◈",seriesId,seriesTitle)).join("")}</div>`;
  if(ctx.shared.length)html+=`<div class="cx-collection-group-label">Also collected in other series' volumes</div><div class="cx-collection-grid">${[...ctx.shared].sort((a,b)=>String(a.publicationDate||"9999").localeCompare(String(b.publicationDate||"9999"))||String(a.title||"").localeCompare(String(b.title||""))).map(c=>collectionCard(c,"↔",seriesId,seriesTitle)).join("")}</div>`;
  return html;
}
// Sub-tabs: one per format that actually has mainline editions (counted per format), then Crossovers & shared.
// A format with no editions gets no tab.
function mountEditions(container,collections,issues,s){
  const sp=splitEditions(collections,s.id);const ctx={...sp,groups:eventGroups(sp.events)};
  const fmts=Array.from(new Set(sp.own.map(formatKey))).sort((a,b)=>(FORMAT_ORDER[a]??9)-(FORMAT_ORDER[b]??9)||a.localeCompare(b));
  const extra=ctx.groups.length+sp.shared.length+sp.anth.length;
  const items=[...fmts.map(f=>[f,formatLabel(f),sp.own.filter(c=>formatKey(c)===f).length]),...(extra?[["__x","Crossovers & shared",extra]]:[])];
  if(!items.length){container.innerHTML=empty("No collected editions are recorded for this series.");return;}
  container.innerHTML=`<div class="cx-subtab-wrap">${tabs(items[0][0],items)}<div class="cx-edition-body"></div></div>`;
  const body=container.querySelector(".cx-edition-body");
  const draw=k=>{body.innerHTML=k==="__x"?eventsHtml(ctx,s.id,s.title):mainlineGrid(sp.own.filter(c=>formatKey(c)===k),s.id,s.title);wirePublications(body,issues,collections,s);};
  draw(items[0][0]);
  container.querySelectorAll(".cx-subtab-wrap > .cx-tabs .cx-tab").forEach(btn=>btn.addEventListener("click",()=>{container.querySelectorAll(".cx-subtab-wrap > .cx-tabs .cx-tab").forEach(x=>x.classList.remove("is-active"));btn.classList.add("is-active");draw(btn.dataset.tab);}));
}
// Headline numbers for the overview: mainline volumes in the series' main collected format.
function mainlineSummary(collections,seriesId){
  const {own,events,shared}=splitEditions(collections,seriesId);
  const by=new Map();own.forEach(c=>{const k=formatKey(c);by.set(k,(by.get(k)||0)+1);});
  const pref=["TPB","Volume"].find(k=>by.has(k))||[...by.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
  const evs=eventGroups(events).length;
  return {n:pref?by.get(pref):0,label:pref?(pref==="Volume"?"Collected volumes":`${pref} volumes`):"Collected editions",events:evs,shared:shared.length};
}
function wirePublications(el,issues,collections,s){el.querySelectorAll("[data-pub]").forEach(r=>r.addEventListener("click",()=>{const i=issues.find(x=>x.id===r.dataset.pub);if(i)push("issue",i.issueLabel,{issue:i,series:s});}));el.querySelectorAll("[data-coll]").forEach(r=>r.addEventListener("click",()=>{const c=collections.find(x=>x.id===r.dataset.coll);if(c)push("collection",c.title,{collectionEntity:c});}));}

async function root(){
  const [universes,conts,chars,series]=await Promise.all([data.getAllUniverses(20),data.getAllContinuities(50),data.getAllCharacters(200),allSeries()]);
  const roots=resolveRoots(chars,series); const ct=conts[0]; const u=universes[0];
  return {html:`<div class="cx-kicker">DC COMICS</div><h2 class="cx-title">Explore the DC Universe</h2><div class="cx-subtitle">The catalogue grows territory by territory. Current mapped coverage: ${esc(ct?.shortName||"The New 52")} → ${esc(roots.map(titleOf).sort().join(" · ")||"first territories")}.</div>
    <div class="cx-entry-grid">
      <button class="cx-entry-btn" data-go="characterList"><span class="cx-entry-icon">◉</span><span class="cx-entry-btn-label">By Character</span><span class="cx-entry-btn-sub">${roots.length} mapped starting character${roots.length===1?"":"s"}</span><span class="cx-entry-arrow">↗</span></button>
      <button class="cx-entry-btn" data-go="continuityList"><span class="cx-entry-icon">◎</span><span class="cx-entry-btn-label">By Continuity / Era</span><span class="cx-entry-btn-sub">Explore the DC timeline by era and continuity</span><span class="cx-entry-arrow">↗</span></button>
      <button class="cx-entry-btn" data-go="seriesList"><span class="cx-entry-icon">▦</span><span class="cx-entry-btn-label">Browse Series</span><span class="cx-entry-btn-sub">${series.length} currently mapped series</span><span class="cx-entry-arrow">↗</span></button>
      <button class="cx-entry-btn" data-go="atlas"><span class="cx-entry-icon">✦</span><span class="cx-entry-btn-label">Story Map</span><span class="cx-entry-btn-sub">Enter the connected DC universe graph</span><span class="cx-entry-arrow">↗</span></button>
    </div>`,
    wire(c){c.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>{const a=b.dataset.go;if(a==="atlas"){window.__comicsStoryMap?.open?.("universe",u?.id);return;}if(a==="continuity")push("continuity",ct?.name||"Continuity",{continuity:ct});else{const labels={characterList:"Characters",continuityList:"Continuity / Era",seriesList:"Series"};push(a,labels[a]||a,{});}}));}};
}

async function characterList(){
  const [all,series]=await Promise.all([data.getAllCharacters(200),allSeries()]);
  if(!all.length)return {html:empty("No character records are in the comics database yet. An admin can load them from Admin Tools → Reset & Import · New 52.")};
  const roots=resolveRoots(all,series).sort((a,b)=>titleOf(a).localeCompare(titleOf(b)));
  if(!roots.length)return {html:empty("Characters are recorded, but none is marked as a catalogue entry point yet.")};
  const trees=roots.map(c=>{
    const kids=childrenOf(c,all).sort((a,b)=>leadCount(b,series)-leadCount(a,series)||titleOf(a).localeCompare(titleOf(b)));
    const terr=territorySeries(c,all,series);const lines=lineGroups(terr);
    return `<div class="cx-char-tree">
      <button class="cx-character-card" data-char="${esc(c.id)}"><div class="cx-character-orb">${esc(titleOf(c).slice(0,1))}</div><div><span>CATALOGUE ROOT</span><strong>${esc(titleOf(c))}</strong><small>${terr.length} series in this territory${kids.length?` · ${kids.length} family characters`:""}</small></div><b>→</b></button>
      ${lines.length?`<div class="cx-char-branches">${lines.map(([k,v])=>`<button class="cx-char-branch" data-char="${esc(c.id)}" data-line="${esc(k)}"><span>${esc(k)}</span><b>${v.length}</b></button>`).join("")}</div>`:""}
      ${kids.length?`<div class="cx-char-family"><div class="cx-char-family-label">FAMILY &amp; ALLIES</div><div class="cx-char-family-track">${kids.map(k=>`<button class="cx-char-chip" data-char="${esc(k.id)}"><i>${esc(titleOf(k).slice(0,1))}</i><span>${esc(titleOf(k))}</span></button>`).join("")}</div></div>`:""}
    </div>`;
  }).join("");
  return {html:`<div class="cx-kicker">CHARACTERS</div><h2 class="cx-title">Enter through a character</h2><div class="cx-subtitle">Each catalogue root opens its connected territory — family, publishing lines and series.</div><div class="cx-char-trees">${trees}</div>`,
    wire(el){el.querySelectorAll("[data-char]").forEach(r=>r.addEventListener("click",()=>{const x=all.find(v=>v.id===r.dataset.char);if(x)push("character",titleOf(x),{character:x,line:r.dataset.line||null});}));}};
}

async function character(p){
  const c=p.character;if(!c)return{html:empty("Character not found.")};
  const [all,allS]=await Promise.all([data.getAllCharacters(200),allSeries()]);
  const kids=childrenOf(c,all).sort((a,b)=>titleOf(a).localeCompare(titleOf(b)));
  const series=kids.length?territorySeries(c,all,allS):allS.filter(s=>(s.characterIds||[]).includes(c.id));
  const lines=lineGroups(series);
  const parent=c.parentCharacterId?all.find(x=>x.id===c.parentCharacterId):null;
  const totalIssues=series.reduce((n,s)=>n+(Number(s.issueCount)||0),0);
  const sub=[...(c.aliases||[]),parent?`Part of ${titleOf(parent)}'s territory`:null].filter(Boolean).join(" · ");
  let html=`<div class="cx-character-hero"><div class="cx-character-orb large">${esc(titleOf(c).slice(0,1))}</div><div><div class="cx-kicker">${kids.length?"CHARACTER TERRITORY":"CHARACTER"}</div><h2 class="cx-title">${esc(titleOf(c))}</h2>${sub?`<div class="cx-subtitle">${esc(sub)}</div>`:""}</div></div><div class="cx-stat-grid">${stat("Series",series.length)}${stat("Numbered issues",totalIssues)}${stat("Publication lines",lines.length)}</div>`;
  if(kids.length)html+=`<div class="cx-char-family is-inline"><div class="cx-char-family-label">FAMILY &amp; ALLIES</div><div class="cx-char-family-track">${kids.map(k=>`<button class="cx-char-chip" data-char="${esc(k.id)}"><i>${esc(titleOf(k).slice(0,1))}</i><span>${esc(titleOf(k))}</span></button>`).join("")}</div></div>`;
  if(!series.length)html+=`<div class="sheet-section">${empty("No series are mapped for this character yet.")}</div>`;
  for(const [cat,list] of lines){html+=`<div class="cx-series-section" data-line-section="${esc(cat)}"><div class="cx-section-head"><div><span>${esc(cat.toUpperCase())}</span><h3>${esc(cat)}</h3></div><em>${list.length} series</em></div><div class="cx-series-grid">${list.map(s=>`<button class="cx-series-card" data-series="${esc(s.id)}"><div class="cx-series-card-top"><span>${esc(year(s)||"DC")}</span><b>${String(s.issueCount||0).padStart(2,"0")}</b></div><strong>${esc(s.title)}</strong><small>${esc(range(s))}</small><i>Open series →</i></button>`).join("")}</div></div>`;}
  return{html,wire(cn){
    cn.querySelectorAll("[data-series]").forEach(r=>r.addEventListener("click",()=>{const s=series.find(x=>x.id===r.dataset.series);if(s)push("series",s.title,{series:s});}));
    cn.querySelectorAll("[data-char]").forEach(r=>r.addEventListener("click",()=>{const x=all.find(v=>v.id===r.dataset.char);if(x)push("character",titleOf(x),{character:x});}));
    if(p.line){const t=[...cn.querySelectorAll("[data-line-section]")].find(x=>x.dataset.lineSection===p.line);if(t)requestAnimationFrame(()=>t.scrollIntoView({block:"start"}));}
  }};
}

async function continuityList(){
  const cs=await data.getAllContinuities(50);if(!cs.length)return{html:empty("No continuities are mapped yet.")};
  const cards=cs.sort((a,b)=>String(a.startDate||"").localeCompare(String(b.startDate||""))).map((c,i)=>`<button class="cx-era-card ${i===0?"is-current":""}" data-cont="${esc(c.id)}"><div class="cx-era-number">${String(i+1).padStart(2,"0")}</div><div class="cx-era-line"></div><span>${esc(c.shortName||"CONTINUITY")}</span><strong>${esc(c.name)}</strong><small>${esc(c.startDate?`${c.startDate}–${c.endDate||"present"}`:"Timeline territory")}</small><b>Enter →</b></button>`).join("");
  return{html:`<div class="cx-kicker">DC TIMELINE</div><h2 class="cx-title">Explore the timeline</h2><div class="cx-subtitle">Move through DC history by era and continuity. Each territory opens into the characters, series and publications mapped there.</div><div class="cx-era-grid">${cards}</div>` ,wire(c){c.querySelectorAll("[data-cont]").forEach(r=>r.addEventListener("click",()=>{const x=cs.find(v=>v.id===r.dataset.cont);push("continuity",x.name,{continuity:x});}));}};
}

// Continuity "atlas": compact identity, then exploration layers — characters, publishing lines,
// crossovers and a year timeline — each derived from this continuity's own records. Nothing here
// names a specific character, series or era; sections with no data are not rendered.
async function continuity(p){
  const ct=p.continuity;if(!ct)return{html:empty("Continuity not found.")};
  const [series,allChars,colls]=await Promise.all([data.getSeriesForContinuity(ct.id),data.getAllCharacters(200),data.getAllCollections(1000).catch(()=>[])]);
  if(!series.length)return{html:`<div class="cxa-id"><h2 class="cxa-name">${esc(ct.name)}</h2></div>${empty("No series are mapped in this continuity yet.")}`};
  const sIds=new Set(series.map(s=>s.id));const seriesById=new Map(series.map(s=>[s.id,s]));
  const chars=allChars.filter(c=>!c.continuityIds?.length||c.continuityIds.includes(ct.id));
  const roots=resolveRoots(chars,series);
  const ctColls=colls.filter(c=>(c.seriesIds||[]).some(id=>sIds.has(id)));

  // Crossovers: editions flagged as crossovers or spanning 3+ of this continuity's series.
  // HC / TPB / compendium printings of one event are grouped into a single event.
  const evMap=new Map();
  ctColls.forEach(c=>{const span=(c.seriesIds||[]).filter(id=>sIds.has(id));if(span.length<2||!(c.crossover||span.length>=3))return;
    const name=eventKey(c.title);const k=name.toLowerCase().replace(/[^a-z0-9]/g,"");
    const e=evMap.get(k)||{name,editions:[],series:new Set(),first:null};e.editions.push(c);span.forEach(id=>e.series.add(id));
    if(c.publicationDate&&(!e.first||c.publicationDate<e.first))e.first=c.publicationDate;evMap.set(k,e);});
  const events=[...evMap.values()].sort((a,b)=>String(a.first||"9999").localeCompare(String(b.first||"9999")));

  // Era bounds (months) for lifespan bars — the continuity's span widened to any series that runs past it.
  const mo=d=>{const m=String(d||"").match(/^(\d{4})(?:-(\d{2}))?/);return m?(+m[1])*12+((+m[2]||1)-1):null;};
  const starts=series.map(s=>mo(s.startDate)).filter(v=>v!=null),ends=series.map(s=>mo(s.endDate)).filter(v=>v!=null);
  const lo=Math.min(mo(ct.startDate)??Infinity,...starts),hi=Math.max(mo(ct.endDate)??-Infinity,...ends);
  const span=Math.max(1,hi-lo+1);
  const pct=v=>((v-lo)/span*100).toFixed(2);
  const y0=Math.floor(lo/12),y1=Math.floor(hi/12);
  const years=[];for(let y=y0;y<=y1;y++)years.push(y);
  const ctY0=ct.startDate?String(ct.startDate).slice(0,4):String(y0),ctY1=ct.endDate?String(ct.endDate).slice(0,4):"";

  const lines=lineGroups(series);
  const tags=[ct.earthName,ct.eraNote].filter(Boolean);

  // ---- identity (compact) ----
  let html=`<div class="cxa-id">
    ${tags.length?`<div class="cxa-tags">${tags.map(t=>`<span>${esc(t)}</span>`).join("")}</div>`:""}
    <h2 class="cxa-name">${esc(ct.name)}</h2>
    <div class="cxa-years"><b>${esc(ctY0)}</b><i aria-hidden="true"></i><b>${esc(ctY1||"present")}</b></div>
    <div class="cxa-counts"><span><b>${series.length}</b> series</span>${chars.length?`<span><b>${chars.length}</b> characters</span>`:""}${ctColls.length?`<span><b>${ctColls.length}</b> editions</span>`:""}${events.length?`<span><b>${events.length}</b> crossovers</span>`:""}</div>
  </div>`;

  // ---- jump bar ----
  const jumps=[roots.length?["characters","Characters"]:null,["lines","Publishing lines"],events.length?["crossovers","Crossovers"]:null,years.length>1?["timeline","Timeline"]:null].filter(Boolean);
  html+=`<nav class="cxa-jump" aria-label="Explore ${esc(ct.name)}">${jumps.map(([k,l])=>`<button data-jump="${k}">${esc(l)}</button>`).join("")}</nav>`;

  // ---- characters: each root with its family orbiting it ----
  if(roots.length){
    html+=`<section class="cxa-sec" data-sec="characters"><div class="cxa-sec-head"><span>01</span><h3>Characters</h3></div>${roots.map(r=>{
      const kids=childrenOf(r,chars).sort((a,b)=>leadCount(b,series)-leadCount(a,series)||titleOf(a).localeCompare(titleOf(b)));
      const terr=territorySeries(r,chars,series);
      return `<div class="cxa-constellation">
        <button class="cxa-core" data-char="${esc(r.id)}"><span class="cxa-core-orb">${esc(titleOf(r).slice(0,1))}</span><span class="cxa-core-body"><em>Territory</em><strong>${esc(titleOf(r))}</strong><small>${terr.length} series${kids.length?` · ${kids.length} family characters`:""}</small></span><b>Enter →</b></button>
        ${kids.length?`<div class="cxa-orbit">${kids.map(k=>{const n=leadCount(k,series);return `<button class="cxa-sat" data-char="${esc(k.id)}"><i>${esc(titleOf(k).slice(0,1))}</i><span>${esc(titleOf(k))}</span>${n?`<small>${n} lead series</small>`:`<small>supporting</small>`}</button>`;}).join("")}</div>`:""}
      </div>`;}).join("")}</section>`;
  }

  // ---- publishing lines: one line at a time, series drawn as lifespans across the era ----
  html+=`<section class="cxa-sec" data-sec="lines"><div class="cxa-sec-head"><span>${roots.length?"02":"01"}</span><h3>Publishing lines</h3></div>
    <div class="cxa-line-tabs" role="tablist">${lines.map(([k,v],i)=>`<button role="tab" data-line="${i}" aria-selected="${i===0}">${esc(k)}<b>${v.length}</b></button>`).join("")}</div>
    <div class="cxa-axis" aria-hidden="true">${years.map(y=>`<span style="left:${pct((Math.max(lo,y*12)+Math.min(hi,y*12+11))/2)}%">${String(y).slice(2)}</span>`).join("")}</div>
    ${lines.map(([k,v],i)=>`<div class="cxa-line-panel" data-line-panel="${i}" ${i===0?"":"hidden"}>${v.map(s=>{const a=mo(s.startDate)??lo,b=mo(s.endDate)??hi;return `<button class="cxa-life" data-series="${esc(s.id)}"><span class="cxa-life-head"><strong>${esc(s.title)}</strong><em>${s.issueCount?`${s.issueCount} issues`:""}</em></span><span class="cxa-life-track"><i style="left:${pct(a)}%;width:${Math.max(1.5,(b-a+1)/span*100).toFixed(2)}%"></i></span><small>${esc(range(s))}</small></button>`;}).join("")}</div>`).join("")}
  </section>`;

  // ---- crossovers ----
  if(events.length){
    html+=`<section class="cxa-sec" data-sec="crossovers"><div class="cxa-sec-head"><span>${String(jumps.findIndex(j=>j[0]==="crossovers")+1).padStart(2,"0")}</span><h3>Crossovers &amp; events</h3></div><div class="cxa-events">${events.map((e,i)=>{
      const ss=[...e.series].map(id=>seriesById.get(id)).filter(Boolean).sort((a,b)=>groupRank(a.lineCategory)-groupRank(b.lineCategory)||a.title.localeCompare(b.title));
      const eds=[...e.editions].sort((a,b)=>String(a.publicationDate||"9999").localeCompare(String(b.publicationDate||"9999")));
      return `<div class="cxa-event" data-event="${i}"><button class="cxa-event-head" aria-expanded="false"><span class="cxa-event-mark">✦</span><span class="cxa-event-body"><strong>${esc(e.name)}</strong><small>${ss.length} series · ${eds.length} edition${eds.length===1?"":"s"}</small></span><span class="cxa-event-dots" aria-hidden="true">${ss.slice(0,8).map(()=>"<i></i>").join("")}</span></button>
        <div class="cxa-event-more" hidden><div class="cxa-chiprow">${ss.map(s=>`<button class="cxa-chip" data-series="${esc(s.id)}">${esc(s.title)}</button>`).join("")}</div><div class="cxa-edlist">${eds.map(c=>`<button class="cxa-ed" data-coll="${esc(c.id)}"><span>${esc(pillLabel(c))}</span><strong>${esc(c.title)}</strong><small>${esc(editionMeta(c)||"Details not recorded")}</small></button>`).join("")}</div></div></div>`;}).join("")}</div></section>`;
  }

  // ---- timeline: series active per year; tap a year for launches / endings ----
  if(years.length>1){
    const yr=d=>{const m=String(d||"").match(/^(\d{4})/);return m?+m[1]:null;};
    const active=y=>series.filter(s=>(yr(s.startDate)??y0)<=y&&(yr(s.endDate)??y1)>=y);
    const maxA=Math.max(1,...years.map(y=>active(y).length));
    html+=`<section class="cxa-sec" data-sec="timeline"><div class="cxa-sec-head"><span>${String(jumps.findIndex(j=>j[0]==="timeline")+1).padStart(2,"0")}</span><h3>Timeline</h3></div>
      <div class="cxa-years-rail" role="tablist">${years.map((y,i)=>{const n=active(y).length;return `<button role="tab" data-year="${y}" aria-selected="${i===0}"><span class="cxa-bar"><i style="height:${Math.round(n/maxA*100)}%"></i></span><b>${y}</b><small>${n} active</small></button>`;}).join("")}</div>
      <div class="cxa-year-panel" id="cxaYearPanel"></div></section>`;
  }

  if(ct.description)html+=`<details class="cxa-about"><summary>About this era</summary><p>${esc(ct.description)}</p></details>`;

  return{html,wire(el){
    const go=(id)=>{const s=seriesById.get(id);if(s)push("series",s.title,{series:s});};
    el.querySelectorAll("[data-series]").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();go(b.dataset.series);}));
    el.querySelectorAll("[data-char]").forEach(b=>b.addEventListener("click",()=>{const x=chars.find(v=>v.id===b.dataset.char);if(x)push("character",titleOf(x),{character:x});}));
    el.querySelectorAll("[data-coll]").forEach(b=>b.addEventListener("click",()=>{const c=ctColls.find(x=>x.id===b.dataset.coll);if(c)push("collection",c.title,{collectionEntity:c});}));
    el.querySelectorAll("[data-jump]").forEach(b=>b.addEventListener("click",()=>{const t=el.querySelector(`[data-sec="${b.dataset.jump}"]`);if(t)t.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});}));
    el.querySelectorAll(".cxa-line-tabs [data-line]").forEach(b=>b.addEventListener("click",()=>{
      el.querySelectorAll(".cxa-line-tabs [data-line]").forEach(x=>x.setAttribute("aria-selected",String(x===b)));
      el.querySelectorAll("[data-line-panel]").forEach(pn=>{pn.hidden=pn.dataset.linePanel!==b.dataset.line;});}));
    el.querySelectorAll(".cxa-event-head").forEach(h=>h.addEventListener("click",()=>{const more=h.nextElementSibling;const open=more.hidden;more.hidden=!open;h.setAttribute("aria-expanded",String(open));}));
    const panel=el.querySelector("#cxaYearPanel");
    if(panel){
      const yr=d=>{const m=String(d||"").match(/^(\d{4})/);return m?+m[1]:null;};
      const chip=s=>`<button class="cxa-chip" data-series="${esc(s.id)}">${esc(s.title)}</button>`;
      const show=y=>{const launched=series.filter(s=>yr(s.startDate)===y),ended=series.filter(s=>yr(s.endDate)===y);
        const act=series.filter(s=>(yr(s.startDate)??y0)<=y&&(yr(s.endDate)??y1)>=y);
        panel.innerHTML=`<div class="cxa-year-title"><strong>${y}</strong><span>${act.length} series on the stands</span></div>
          ${launched.length?`<div class="cxa-year-row"><em>Launched</em><div class="cxa-chiprow">${launched.map(chip).join("")}</div></div>`:""}
          ${ended.length?`<div class="cxa-year-row"><em>Concluded</em><div class="cxa-chiprow">${ended.map(chip).join("")}</div></div>`:""}
          ${!launched.length&&!ended.length?`<div class="cxa-year-row"><em>Running</em><div class="cxa-chiprow">${act.map(chip).join("")}</div></div>`:""}`;
        panel.querySelectorAll("[data-series]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.series)));};
      el.querySelectorAll("[data-year]").forEach(b=>b.addEventListener("click",()=>{el.querySelectorAll("[data-year]").forEach(x=>x.setAttribute("aria-selected",String(x===b)));show(+b.dataset.year);}));
      show(years[0]);
    }
  }};
}

async function seriesList(){const ss=(await allSeries()).sort((a,b)=>groupRank(a.lineCategory)-groupRank(b.lineCategory)||year(a).localeCompare(year(b))||a.title.localeCompare(b.title));if(!ss.length)return{html:empty("No series are mapped yet.")};const groups=new Map();ss.forEach(s=>{const k=s.lineCategory||"Other";if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s);});let html=`<div class="cx-kicker">SERIES</div><h2 class="cx-title">DC Comics catalogue</h2><div class="cx-subtitle">Every mapped publication, grouped by publishing line. New territories appear here automatically.</div>`;for(const [g,list] of groups){html+=`<div class="cx-series-section"><div class="cx-section-head"><div><span>${esc(g.toUpperCase())}</span><h3>${esc(g)}</h3></div><em>${list.length} series</em></div><div class="cx-series-grid">${list.map(s=>`<button class="cx-series-card" data-series="${esc(s.id)}"><div class="cx-series-card-top"><span>${esc(year(s)||"DC")}</span><b>${String(s.issueCount||0).padStart(2,"0")}</b></div><strong>${esc(s.title)}</strong><small>${esc(range(s))}</small><i>Open series →</i></button>`).join("")}</div></div>`;}return{html,wire(c){c.querySelectorAll("[data-series]").forEach(r=>r.addEventListener("click",()=>{const s=ss.find(x=>x.id===r.dataset.series);push("series",s.title,{series:s});}));}};}

// ---- Reading paths: MAIN PATH -> CROSSOVER -> BRANCHES -> RETURN. Pure relationships between existing series/collections;
// nothing here owns issues. Shown on a series (or run) page only when the owner-supplied branch paths mention that series.
const bpMemo=new Map();
const bpColls=sid=>{if(!bpMemo.has(sid))bpMemo.set(sid,data.getCollectionsForSeries(sid).catch(()=>[]));return bpMemo.get(sid);};
const bpNum=l=>{const m=String(l||"").match(/^#?(\d+(?:\.\d+)?)$/);return m?parseFloat(m[1]):null;};
const bpRange=(c,sid)=>{const ns=(c.issueCoverage||[]).filter(r=>r.seriesId===sid).map(r=>bpNum(r.issueLabel)).filter(n=>n!=null);return ns.length?[Math.min(...ns),Math.max(...ns)]:null;};
function bpVolumes(sid,colls,evRows,explicit){
  const own=colls.filter(c=>isOwnMainline(c,sid));
  const pref=["TPB","Volume"].find(f=>own.some(c=>formatKey(c)===f))||(own[0]?formatKey(own[0]):null);
  const ownP=own.filter(c=>formatKey(c)===pref).sort(collectionSort);
  const ids=new Set(evRows.map(r=>r.issueId));
  let tie=explicit&&explicit.length?colls.filter(c=>explicit.includes(c.id)):own.filter(c=>(c.issueIdsCovered||[]).some(i=>ids.has(i)));
  const byTitle=new Map();tie.forEach(c=>{const cur=byTitle.get(c.title);if(!cur||(formatKey(c)===pref&&formatKey(cur)!==pref))byTitle.set(c.title,c);});
  tie=[...byTitle.values()];if(tie.some(c=>formatKey(c)===pref))tie=tie.filter(c=>formatKey(c)===pref);tie.sort(collectionSort);
  if(!tie.length){const n=Math.min(...evRows.map(r=>bpNum(r.issueLabel)).filter(x=>x!=null));if(Number.isFinite(n)){const hit=ownP.find(c=>{const r=bpRange(c,sid);return r&&n>=r[0]&&n<=r[1];})||[...ownP].reverse().find(c=>{const r=bpRange(c,sid);return r&&r[0]<=n;});if(hit)tie=[hit];}}
  const last=tie[tie.length-1];const at=last?ownP.findIndex(c=>c.id===last.id||c.title===last.title):-1;
  return {tie,ret:at>=0?ownP[at+1]||null:null};
}
async function bpLoad(path,sid){
  const ev=(await Promise.all((path.eventCollectionIds||[]).map(id=>get(COLLECTIONS.COLLECTIONS,id)))).filter(Boolean);
  const bySeries=async(bid)=>{const colls=await bpColls(bid);const b=(path.branches||[]).find(x=>x.seriesId===bid);const rows=ev.flatMap(c=>(c.issueCoverage||[]).filter(r=>r.seriesId===bid));
    const explicit=(b?.collectionIds||[]).length?b.collectionIds:null;const v=bpVolumes(bid,colls,rows,explicit);
    const exRows=explicit?colls.filter(c=>explicit.includes(c.id)).flatMap(c=>(c.issueCoverage||[]).filter(r=>r.seriesId===bid)):rows;
    return {rows:[...new Map(exRows.map(r=>[r.issueId,r])).values()],...v};};
  return {ev,bySeries};
}
function bpVolBtn(c){return `<button class="cx-bp-vol" data-bp-coll="${esc(c.id)}">${esc(displayCollectionTitle(c))}</button>`;}
function bpNode(kind,label,body){return `<div class="cx-bp-node is-${kind}"><span class="cx-bp-tag">${esc(label)}</span>${body}</div>`;}
const bpArrow=`<div class="cx-bp-arrow" aria-hidden="true">↓</div>`;
const bpJoin=a=>a.length<2?a.join(""):a.length===2?a.join(" and "):a.slice(0,-1).join(", ")+" and "+a[a.length-1];
async function bpPathHtml(path,s,mode,paths){
  const L=await bpLoad(path,s.id);
  const mine=(path.branches||[]).find(b=>b.seriesId===s.id);
  const sInfo=await L.bySeries(s.id);
  const evBtns=L.ev.length?`<div class="cx-evt-eds">${L.ev.map(c=>`<button class="cx-evt-ed" data-bp-coll="${esc(c.id)}"><span>${esc(pillLabel(c))}</span>${c.publicationDate?`<em>${esc(String(c.publicationDate).slice(0,4))}</em>`:""}</button>`).join("")}</div>`:"";
  const linked=async(id)=>id?(paths||[]).find(x=>x.id===id)||null:null;
  const next=await linked(path.nextPathId),prev=await linked(path.followsPathId);
  const retRow=async(sid,label)=>{const i=await L.bySeries(sid);return `<div class="cx-bp-ret"><b>${esc(label)}</b>${i.ret?`<span>then ${bpVolBtn(i.ret)}</span>`:`<span class="cx-bp-note">carries on with the series' next issues</span>`}</div>`;};
  const nextNote=next?`<small class="cx-bp-note">Then continue into ${esc(next.title)}.</small>`:"";
  const prevNote=prev?`<small class="cx-bp-note">Follows ${esc(prev.title)}.</small>`:"";
  let html="";
  if(mode==="main"){
    const titles=sInfo.tie.map(displayCollectionTitle);
    const intro=titles.length?`Read through ${bpJoin(titles)}, then explore the crossover branches. Return to the main story afterward.`:(path.readingInstruction||"");
    const names=(path.branches||[]).map(b=>b.label);
    html=bpNode("main","MAIN PATH",`<strong>${esc(s.title)}</strong><small class="cx-bp-here-line">You are here</small><small>${esc(intro)}</small>${sInfo.tie.length?`<div class="cx-bp-vols">${sInfo.tie.map(bpVolBtn).join("")}</div>`:""}`)+bpArrow
      +bpNode("cross","CROSSOVER",`<strong>${esc(path.title)}</strong><small>Optional, parallel reading. Participating series: ${esc(bpJoin(names))}.</small>${evBtns}${prevNote}`)+bpArrow
      +bpNode("ret","RETURN TO MAIN STORY",await retRow(s.id,s.title)+nextNote);
  }else{
    const cards=await Promise.all((path.branches||[]).map(async b=>{
      if(!b.seriesId){const cs=(await Promise.all((b.collectionIds||[]).map(id=>get(COLLECTIONS.COLLECTIONS,id)))).filter(Boolean);const one=cs.filter(c=>formatKey(c)==="TPB").concat(cs).slice(0,1);
        return `<div class="cx-bp-branch is-text"><b>${esc(b.label)}</b><small>${esc(b.note||"")}</small>${one.length?`<div class="cx-bp-vols">${one.map(bpVolBtn).join("")}</div>`:""}<span class="cx-bp-opt">Optional branch</span></div>`;}
      const i=await L.bySeries(b.seriesId);const here=b.seriesId===s.id;
      return `<div class="cx-bp-branch ${here?"is-here":""}"><b>${esc(b.label)}${b.related?` <em>related title</em>`:""}</b><small>${esc(compressLabels(i.rows)||"")}</small>${i.tie.length?`<div class="cx-bp-vols">${i.tie.map(bpVolBtn).join("")}</div>`:""}${here?`<span class="cx-bp-here">You are here</span>`:`<button class="cx-bp-open" data-bp-series="${esc(b.seriesId)}">Open series →</button><span class="cx-bp-opt">Optional branch</span>`}</div>`;}));
    const rets=(await Promise.all((path.branches||[]).filter(b=>b.seriesId).map(b=>retRow(b.seriesId,b.label)))).join("");
    html=bpNode("cross","CROSSOVER",`<strong>${esc(path.title)}</strong><small>${esc(path.readingInstruction||"")}</small>${evBtns}${prevNote}`)+bpArrow
      +bpNode("branch","PARTICIPATING SERIES",`<div class="cx-bp-branches">${cards.join("")}</div>`)+bpArrow
      +bpNode("ret","RETURN TO MAIN STORY",rets+nextNote);
  }
  return html;
}
async function mountReadingPaths(host,s,range){
  if(!host)return;let paths;try{paths=await bp.getBranchPathsForSeries(s.id);}catch(e){console.warn("[Comics Explorer] reading paths unavailable",e);return;}
  if(!paths.length)return;
  if(range){const keep=[];for(const p of paths){const ev=(await Promise.all((p.eventCollectionIds||[]).map(id=>get(COLLECTIONS.COLLECTIONS,id)))).filter(Boolean);const ex=(p.branches||[]).find(b=>b.seriesId===s.id)?.collectionIds||[];const cs=[...ev,...(await Promise.all(ex.map(id=>get(COLLECTIONS.COLLECTIONS,id)))).filter(Boolean)];const ns=cs.flatMap(c=>(c.issueCoverage||[]).filter(r=>r.seriesId===s.id).map(r=>bpNum(r.issueLabel))).filter(n=>n!=null);if(!ns.length||ns.some(n=>n>=range[0]&&n<=range[1]))keep.push(p);}paths=keep;if(!paths.length)return;}
  paths.sort((a,b)=>String(a.pathCode).localeCompare(String(b.pathCode)));
  const state=new Map(paths.map(p=>[p.id,{mode:"main"}]));
  host.innerHTML=`<div class="cx-series-section cx-bp-wrap"><div class="cx-section-head"><div><span>READING PATH</span><h3>Crossovers</h3></div><em>${paths.length} ${paths.length===1?"crossover":"crossovers"}</em></div><div class="cx-bp-list">${paths.map(p=>`<div class="cx-bp" data-bp="${esc(p.id)}"><div class="cx-bp-head"><div><small>${esc(String(p.family||"").toUpperCase())} · CROSSOVER</small><strong>${esc(p.title)}</strong></div></div><div class="cx-bp-modes"><button class="cx-bp-mode is-active" data-mode="main">Main Path</button><button class="cx-bp-mode" data-mode="cross">Crossover</button></div><div class="cx-bp-body"><div class="cx-loading">Loading…</div></div></div>`).join("")}</div></div>`;
  const draw=async(box,p)=>{const st=state.get(p.id);const body=box.querySelector(".cx-bp-body");try{body.innerHTML=await bpPathHtml(p,s,st.mode,paths);}catch(e){console.warn(e);body.innerHTML=empty("This path couldn't be loaded right now.");}
    box.querySelectorAll(".cx-bp-mode").forEach(b=>b.classList.toggle("is-active",b.dataset.mode===st.mode));
    body.querySelectorAll("[data-bp-coll]").forEach(b=>b.addEventListener("click",async()=>{const c=await get(COLLECTIONS.COLLECTIONS,b.dataset.bpColl);if(c)push("collection",c.title,{collectionEntity:c});}));
    body.querySelectorAll("[data-bp-series]").forEach(b=>b.addEventListener("click",async()=>{const x=await get(COLLECTIONS.SERIES,b.dataset.bpSeries);if(x)push("series",x.title,{series:x});}));};
  host.querySelectorAll(".cx-bp").forEach(box=>{const p=paths.find(x=>x.id===box.dataset.bp);box.querySelectorAll(".cx-bp-mode").forEach(b=>b.addEventListener("click",()=>{state.get(p.id).mode=b.dataset.mode;draw(box,p);}));draw(box,p);});
}

async function series(p){
  const s=p.series;if(!s)return{html:empty("Series not found.")};
  const [issues,collections,runs,creators]=await Promise.all([data.getIssuesForSeries(s.id),data.getCollectionsForSeries(s.id).catch(()=>[]),data.getRunsForSeries(s.id),Promise.all((s.creatorIds||[]).map(id=>get(COLLECTIONS.CREATORS,id)))]);sortIssues(issues);const b=issueBuckets(issues);
  const counts={issues:b.numbered.length,annuals:b.annual.length,specials:b.special.length+b.one_shot.length};
  const ml=mainlineSummary(collections,s.id);
  const first=b.numbered[0]?.issueNumber,last=b.numbered[b.numbered.length-1]?.issueNumber;
  let html=`<div class="cx-kicker">SERIES</div><h2 class="cx-title">${esc(s.title)}</h2><div class="cx-subtitle">${esc(range(s))} · ${counts.issues} numbered issues${counts.annuals?` · ${counts.annuals} annuals`:""}${counts.specials?` · ${counts.specials} specials/one-shots`:""}</div>`;
  if(creators.filter(Boolean).length)html+=`<div class="cx-tag-row">${creators.filter(Boolean).map(c=>`<span class="tag">${esc(titleOf(c))}</span>`).join("")}</div>`;
  html+=`<div class="sheet-section"><div class="sheet-label">THE STORY</div><div class="cx-info-card">${esc(s.description||"A New 52 publication mapped as part of the connected DC Comics catalogue.")}</div></div>`;
  html+=`<div class="cx-publication-summary"><div>${stat("Issues",counts.issues)}<span class="cx-summary-detail">${counts.issues?`#${first}–#${last}`:"Not recorded"}</span></div><div>${stat("Annuals",counts.annuals)}<span class="cx-summary-detail">${counts.annuals?"Annual publications recorded":"None recorded"}</span></div><div>${stat("Specials",counts.specials)}<span class="cx-summary-detail">${counts.specials?"Special / one-shot units":"None recorded"}</span></div></div>`;
  if(runs.length){html+=`<div class="cx-series-section"><div class="cx-section-head"><div><span>CREATIVE HISTORY</span><h3>Creative runs</h3></div><em>${runs.length} runs</em></div><div class="cx-run-grid">${runs.sort((a,b)=>(Number(a.startIssue)||0)-(Number(b.startIssue)||0)).map((r,i)=>`<div class="cx-run-card"><strong>${esc(r.title||creators.filter(Boolean).map(c=>titleOf(c)).join(" / ")||"Run")}</strong><span>${esc(coverage(r))}</span><b>Creative history</b></div>`).join("")}</div></div>`;}
  html+=`<div id="cxReadingPaths"></div>`;
  html+=`<div class="cx-series-section"><div class="cx-section-head"><div><span>PUBLICATIONS</span><h3>Collected editions & extras</h3></div></div>${tabs("overview",[["overview","Overview"],["collections","Collected Editions"],["annuals","Annuals",counts.annuals],["specials","Specials",counts.specials]])}<div id="cxTabBody"></div></div>`;
  return{html,wire(c){mountReadingPaths(c.querySelector("#cxReadingPaths"),s);const tabBody=c.querySelector("#cxTabBody");const renderTab=t=>{
      if(t==="overview")tabBody.innerHTML=`<div class="cx-overview-panel"><div class="cx-issue-box"><span>NUMBERED RUN</span><strong>${esc(counts.issues?`#${first} — #${last}`:"No numbered issues recorded")}</strong><small>This is the complete numbered run represented in the catalogue. The story itself is organised below through its creative history and collected editions.</small></div><div class="cx-overview-grid"><div><b>${counts.annuals}</b><span>Annual publications</span><small>${esc(b.annual.map(i=>i.issueLabel).join(" · ")||"None recorded")}</small></div><div><b>${counts.specials}</b><span>Specials / one-shots</span><small>${esc([...b.special,...b.one_shot].map(i=>i.issueLabel).join(" · ")||"None recorded")}</small></div><div><b>${ml.n}</b><span>${esc(ml.label)}</span><small>${esc(ml.events||ml.shared?`Mainline volumes only · ${ml.events} crossover/event collection${ml.events===1?"":"s"} listed separately`:"Mainline volumes only")}</small></div></div></div>`;
      else if(t==="collections")mountEditions(tabBody,collections,issues,s);
      else if(t==="annuals")tabBody.innerHTML=publicationRows(b.annual);
      else tabBody.innerHTML=publicationRows([...b.special,...b.one_shot]);
      if(t!=="collections")wirePublications(tabBody,issues,collections,s);
    };renderTab("overview");c.querySelectorAll(":scope > .cx-series-section .cx-tabs > .cx-tab").forEach(t=>t.addEventListener("click",()=>{c.querySelectorAll(":scope > .cx-series-section .cx-tabs > .cx-tab").forEach(x=>x.classList.remove("is-active"));t.classList.add("is-active");renderTab(t.dataset.tab);}));}};
}

async function run(p){
  const r=p.run,s=p.series;if(!r||!s)return{html:empty("Run not found.")};
  const creators=await Promise.all((r.creatorIds||[]).map(id=>get(COLLECTIONS.CREATORS,id)));
  const [issues,collections]=await Promise.all([data.getIssuesForSeries(s.id),data.getCollectionsForSeries(s.id).catch(()=>[])]);sortIssues(issues);
  const lo=Number(r.startIssue),hi=Number(r.endIssue);const inRun=Number.isFinite(lo)&&Number.isFinite(hi)?issues.filter(i=>{const n=issueNum(i);return n>=lo&&n<=hi;}):[];const b=issueBuckets(inRun);
  const counts={issues:b.numbered.length,annuals:b.annual.length,specials:b.special.length+b.one_shot.length};
  const ml=mainlineSummary(collections,s.id);
  let html=`<div class="cx-kicker">CREATIVE RUN</div><h2 class="cx-title">${esc(r.title||creators.filter(Boolean).map(titleOf).join(" / ")||"Run")}</h2><div class="cx-subtitle">${esc(coverage(r))}${inRun.length?` · ${inRun.length} numbered issues`:""}</div>`;
  if(creators.filter(Boolean).length)html+=`<div class="cx-tag-row">${creators.filter(Boolean).map(c=>`<span class="tag">${esc(titleOf(c))}</span>`).join("")}</div>`;
  html+=`<div class="cx-publication-summary">${stat("Issues",counts.issues)}${stat("Annuals",counts.annuals)}${stat("Specials",counts.specials)}</div>`;
  html+=`<div class="sheet-section"><div class="sheet-label">PUBLICATION COVERAGE</div><div class="cx-coverage-callout">${esc(coverage(r))}</div></div>`;
  html+=`<div id="cxReadingPaths"></div>`;
  html+=`<div class="cx-series-section"><div class="cx-section-head"><div><span>PUBLICATIONS</span><h3>Run material</h3></div></div>${tabs("overview",[["overview","Overview"],["collections","Collected Editions"],["annuals","Annuals",counts.annuals],["specials","Specials",counts.specials]])}<div id="cxRunTab"></div></div>`;
  return{html,wire(c){mountReadingPaths(c.querySelector("#cxReadingPaths"),s,Number.isFinite(lo)&&Number.isFinite(hi)?[lo,hi]:null);const body=c.querySelector("#cxRunTab");const draw=t=>{
      if(t==="overview")body.innerHTML=`<div class="cx-overview-panel"><div class="cx-issue-box"><span>RUN COVERAGE</span><strong>${esc(coverage(r))}</strong><small>${counts.issues} numbered issue${counts.issues===1?"":"s"} in this creative run. Annuals and specials are listed separately below.</small></div><div class="cx-overview-grid"><div><b>${counts.annuals}</b><span>Annual publications</span><small>${esc(b.annual.map(i=>i.issueLabel).join(" · ")||"None recorded")}</small></div><div><b>${counts.specials}</b><span>Specials / one-shots</span><small>${esc([...b.special,...b.one_shot].map(i=>i.issueLabel).join(" · ")||"None recorded")}</small></div><div><b>${ml.n}</b><span>${esc(ml.label)}</span><small>Mainline volumes of the series</small></div></div></div>`;
      else if(t==="collections")mountEditions(body,collections,issues,s);
      else if(t==="annuals")body.innerHTML=publicationRows(b.annual);
      else body.innerHTML=publicationRows([...b.special,...b.one_shot]);
      if(t!=="collections")wirePublications(body,inRun,collections,s);
    };draw("overview");c.querySelectorAll(":scope > .cx-series-section .cx-tabs > .cx-tab").forEach(t=>t.addEventListener("click",()=>{c.querySelectorAll(":scope > .cx-series-section .cx-tabs > .cx-tab").forEach(x=>x.classList.remove("is-active"));t.classList.add("is-active");draw(t.dataset.tab);}));}};
}

async function issue(p){const i=p.issue;if(!i)return{html:empty("Issue not found.")};const s=p.series||await get(COLLECTIONS.SERIES,i.seriesId);const cs=await Promise.all((i.creatorIds||[]).map(id=>get(COLLECTIONS.CREATORS,id)));let html=`<div class="cx-kicker">PUBLICATION</div><h2 class="cx-title">${esc(i.issueLabel||"Issue")}${i.title?` — ${esc(i.title)}`:""}</h2><div class="cx-subtitle">${esc(s?.title||"")}${i.publicationDate?` · ${esc(i.publicationDate)}`:""}</div>`;if(i.issueLabelType)html+=`<div class="cx-tag-row"><span class="tag">${esc(i.issueLabelType)}</span></div>`;if(cs.filter(Boolean).length)html+=`<div class="cx-tag-row">${cs.filter(Boolean).map(c=>`<span class="tag">${esc(titleOf(c))}</span>`).join("")}</div>`;return{html};}
async function collection(p){
  const c=p.collectionEntity;if(!c)return{html:empty("Edition not found.")};
  const m=seriesCoverage(c);const sids=[...m.keys()];const ss=await Promise.all(sids.map(id=>get(COLLECTIONS.SERIES,id)));
  const titleFor=id=>ss[sids.indexOf(id)]?.title||id;
  const vs=c.sourceInfo?.verificationStatus;
  const status=c.reviewStatus==="needs_review"?"Needs review":c.dataBasis==="owner_csv"?"Supplied dataset":vs==="verified"?"Verified":vs==="partially_verified"?"Partially verified":"Unverified";
  const fmt=pillLabel(c);
  let html=`<div class="cx-kicker">${roleOf(c)==="mainline"?"COLLECTED EDITION":roleOf(c)==="crossover"?"CROSSOVER COLLECTION":roleOf(c)==="anthology"?"GLOBAL ANTHOLOGY":"EVENT COLLECTION"} · ${esc(fmt.toUpperCase())}</div><h2 class="cx-title">${esc(c.title)}</h2><div class="cx-subtitle">${esc([c.editionInfo?.editionName,sids.length>1?`Collects ${sids.length} series`:titleFor(sids[0])].filter(Boolean).join(" · "))}</div>`;
  const facts=[["On sale",c.publicationDate],["Pages",c.pageCount],["US price",c.priceUSD?`$${c.priceUSD}`:null],["ISBN-13",c.isbn],["ISBN-10",c.isbn10],["Status",status]].filter(x=>x[1]!=null&&x[1]!=="");
  html+=`<div class="cx-edition-facts">${facts.map(([k,v])=>`<div${k==="Status"&&status!=="Verified"?' class="is-flag"':""}><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>`;
  html+=`<div class="sheet-section"><div class="sheet-label">COLLECTS</div><div class="cx-edition-cov">${sids.map(id=>{const rows=m.get(id);const full=rows.filter(r=>r.coveragePart!=="partial");const part=rows.filter(r=>r.coveragePart==="partial");return `<button class="cx-edition-cov-row" data-cov-series="${esc(id)}"><strong>${esc(titleFor(id))}</strong><span>${esc([full.length?compressLabels(full):"",part.length?`material from ${compressLabels(part)}`:""].filter(Boolean).join(" · "))}</span></button>`;}).join("")}${c.coverageNote?`<div class="cx-edition-cov-row is-oos"><strong>Note</strong><span>${esc(c.coverageNote)}</span></div>`:""}${c.outOfScopeContents?`<div class="cx-edition-cov-row is-oos"><strong>Also includes</strong><span>${esc(c.outOfScopeContents)}</span></div>`:""}</div></div>`;
  if(c.reprints?.length)html+=`<div class="sheet-section"><div class="sheet-label">OTHER PRINTINGS · SAME CONTENTS</div><div class="cx-list">${c.reprints.map(r=>`<div class="cx-row"><div class="cx-row-body"><div class="cx-row-title">${esc(r.editionNote||r.title)}</div><div class="cx-row-sub">${esc([r.onSaleDate,r.isbn13?`ISBN ${r.isbn13}`:null,r.priceUSD?`$${r.priceUSD}`:null].filter(Boolean).join(" · ")||"Details not recorded")}</div></div></div>`).join("")}</div></div>`;
  const srcs=(c.sources&&c.sources.length)?c.sources:(c.sourceInfo?.sourceUrl?[c.sourceInfo.sourceUrl]:[]);
  if(srcs.length)html+=`<div class="sheet-section"><div class="sheet-label">SOURCES</div><div class="cx-source-links">${srcs.map(u=>{let h=u;try{h=new URL(u).hostname.replace(/^www\./,"");}catch(e){}return `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(h)}</a>`;}).join("")}</div></div>`;
  return{html,wire(el){el.querySelectorAll("[data-cov-series]").forEach(b=>b.addEventListener("click",()=>{const s=ss[sids.indexOf(b.dataset.covSeries)];if(s)push("series",s.title,{series:s});}));}};
}

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
window.dispatchEvent(new CustomEvent("comicsv2:explorer-ready"));
document.addEventListener("click",e=>{if(e.target.closest("#comicsExplorerEntryBtn"))openComicsExplorer();});
document.getElementById("comicsExplorerBackdrop")?.addEventListener("click",close);
document.getElementById("comicsExplorerClose")?.addEventListener("click",close);
