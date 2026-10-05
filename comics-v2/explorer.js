// ALLABOUTDC Comics Explorer — generic DC architecture, currently seeded with New 52 Batman territory.
// Source of truth: Series -> Publication Units (Issues/Annuals/Specials) -> Collected Editions.
import * as data from "./data.js?v=dc3";
import { COLLECTIONS } from "./schema.js";
import * as bp from "./branch-paths.js?v=bp6";
import {CATEGORIES,categoryOf,categoryRank} from "./categories.js?v=cat2";

const esc=s=>s==null?"":String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");
const year=s=>String(s?.startDate||"").slice(0,4);
const range=s=>{const a=s?.startDate||"",b=s?.endDate||"";return a&&b?`${a}–${b}`:a?`${a}–present`:b;};
const issueType=i=>String(i?.issueLabelType||"numbered");
const issueNum=i=>{const n=parseFloat(i?.issueNumber);return Number.isFinite(n)?n:Infinity;};
const sortIssues=a=>a.sort((x,y)=>issueNum(x)-issueNum(y)||String(x.issueLabel||"").localeCompare(String(y.issueLabel||"")));
const titleOf=c=>c?.displayName||c?.name||"Character";
const GROUP_ORDER={"Core Batman":0,"Core Superman":0,"Core Flash":0,"Core Lantern":0,"Core Justice League":0,"Core Wonder Woman":0,"Core Aquaman":0,"Core Green Arrow":0,"Aquaman Spin-offs":10,"Core Dark":0,"Extended League":10,"New 52":0,"DC You (2015)":10,"Legion":0,"Future":10,"Earth 2 Core":0,"Earth 2 Companions":10,"Other Heroes":0,"Dark":10,"Trinity of Sin":20,"Young Heroes":30,"Task Force":40,"Core":0,"Bat-Family":10,"Superman Family":10,"Lantern Spin-offs":10,"Lantern-Adjacent":20,"Gotham & Spin-offs":20,"Gotham & Spin-Offs":20,"Team-Ups":30,"Limited Series":40,"Other":99};
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
  let roots;
  if(flagged.length)roots=flagged;
  else{
    const leads=new Set((series||[]).map(s=>s?.characterIds?.[0]).filter(Boolean));
    roots=list.filter(c=>!c.parentCharacterId&&leads.has(c.id));
  }
  // Deterministic catalogue order (never alphabetical): a root takes the rank of the franchise category
  // of the series it leads (categories.js order); ties keep stable id order.
  const rank=c=>{let r=999;for(const s of (series||[])){if(s?.characterIds?.[0]===c.id)r=Math.min(r,categoryRank(categoryOf(s).key));}return r;};
  return roots.map(c=>[c,rank(c)]).sort((a,b)=>a[1]-b[1]||(a[0].id<b[0].id?-1:a[0].id>b[0].id?1:0)).map(x=>x[0]);
}
// Top-level browse entries = the franchise categories (categories.js order), each with its mapped series.
function categoryEntries(series){const by=new Map(CATEGORIES.map(c=>[c.key,[]]));(series||[]).forEach(s=>{const k=categoryOf(s).key;if(by.has(k))by.get(k).push(s);});return CATEGORIES.map(c=>({cat:c,list:by.get(c.key)})).filter(e=>e.list.length);}
// A category that is led by a catalogue-root character (Batman, Superman, Green Lantern …) keeps that character's family chips.
const rootOfCat=(catKey,roots,series)=>(roots||[]).find(r=>(series||[]).some(s=>s?.characterIds?.[0]===r.id&&categoryOf(s).key===catKey));
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
  const by=new Map();own.forEach(c=>{const k=formatKey(c);if(!by.has(k))by.set(k,new Set());by.get(k).add(c.volume!=null?"v"+c.volume:c.id);}); /* editions of one numbered volume count once */
  by.forEach((set,k)=>by.set(k,set.size));
  const pref=["TPB","Volume"].filter(k=>by.has(k)).sort((a,b)=>by.get(b)-by.get(a))[0]||[...by.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
  const evs=eventGroups(events).length;
  return {n:pref?by.get(pref):0,label:pref?(pref==="Volume"?"Collected volumes":`${pref} volumes`):"Collected editions",events:evs,shared:shared.length};
}
function wirePublications(el,issues,collections,s){el.querySelectorAll("[data-pub]").forEach(r=>r.addEventListener("click",()=>{const i=issues.find(x=>x.id===r.dataset.pub);if(i)push("issue",i.issueLabel,{issue:i,series:s});}));el.querySelectorAll("[data-coll]").forEach(r=>r.addEventListener("click",()=>{const c=collections.find(x=>x.id===r.dataset.coll);if(c)push("collection",c.title,{collectionEntity:c});}));}

async function root(){
  const [universes,conts,chars,series]=await Promise.all([data.getAllUniverses(20),data.getAllContinuities(50),data.getAllCharacters(200),allSeries()]);
  const roots=resolveRoots(chars,series); const ct=conts[0]; const u=universes[0];
  return {html:`<div class="cx-kicker">DC COMICS</div><h2 class="cx-title">Explore the DC Universe</h2><div class="cx-subtitle">The catalogue grows territory by territory. Current mapped coverage: ${esc(ct?.shortName||"The New 52")} → ${esc(categoryEntries(series).map(e=>e.cat.label).join(" · ")||"first territories")}.</div>
    <div class="cx-entry-grid">
      <button class="cx-entry-btn" data-go="characterList"><span class="cx-entry-icon">◉</span><span class="cx-entry-btn-label">By Character</span><span class="cx-entry-btn-sub">${categoryEntries(series).length} franchise categories</span><span class="cx-entry-arrow">↗</span></button>
      <button class="cx-entry-btn" data-go="continuityList"><span class="cx-entry-icon">◎</span><span class="cx-entry-btn-label">By Continuity / Era</span><span class="cx-entry-btn-sub">Explore the DC timeline by era and continuity</span><span class="cx-entry-arrow">↗</span></button>
      <button class="cx-entry-btn" data-go="seriesList"><span class="cx-entry-icon">▦</span><span class="cx-entry-btn-label">Browse Series</span><span class="cx-entry-btn-sub">${series.length} currently mapped series</span><span class="cx-entry-arrow">↗</span></button>
      <button class="cx-entry-btn" data-go="atlas"><span class="cx-entry-icon">✦</span><span class="cx-entry-btn-label">Story Map</span><span class="cx-entry-btn-sub">Enter the connected DC universe graph</span><span class="cx-entry-arrow">↗</span></button>
    </div>`,
    wire(c){c.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>{const a=b.dataset.go;if(a==="atlas"){window.__comicsStoryMap?.open?.("universe",u?.id);return;}if(a==="continuity")push("continuity",ct?.name||"Continuity",{continuity:ct});else{const labels={categoryList:"Categories",characterList:"Characters",continuityList:"Continuity / Era",seriesList:"Series"};push(a,labels[a]||a,{});}}));}};
}

async function categoryList(){
  const ss=await allSeries();const by=new Map(CATEGORIES.map(c=>[c.key,[]]));ss.forEach(s=>by.get(categoryOf(s).key).push(s));
  const rows=CATEGORIES.map(c=>{const list=by.get(c.key);const issues=list.reduce((n,s)=>n+(Number(s.issueCount)||0),0);
    return list.length?row(c.label,`${list.length} series · ${issues} numbered issues`,`data-cat="${esc(c.key)}"`):`<div class="cx-row" style="opacity:.5" aria-disabled="true"><div class="cx-row-body"><div class="cx-row-title">${esc(c.label)}</div><div class="cx-row-sub">Not mapped yet</div></div></div>`;}).join("");
  return{html:`<div class="cx-kicker">THE NEW 52</div><h2 class="cx-title">Browse by category</h2><div class="cx-subtitle">The New 52 organised by franchise, in a fixed order. Each category opens its series.</div><div class="cx-list">${rows}</div>`,
    wire(c){c.querySelectorAll("[data-cat]").forEach(r=>r.addEventListener("click",()=>{const x=CATEGORIES.find(v=>v.key===r.dataset.cat);push("category",x.label,{categoryKey:x.key});}));}};
}
async function category(p){
  const cat=CATEGORIES.find(c=>c.key===p.categoryKey);if(!cat)return{html:empty("Category not found.")};
  const series=(await allSeries()).filter(s=>categoryOf(s).key===cat.key);
  const lines=lineGroups(series);const totalIssues=series.reduce((n,s)=>n+(Number(s.issueCount)||0),0);
  let html=`<div class="cx-kicker">CATEGORY</div><h2 class="cx-title">${esc(cat.label)}</h2><div class="cx-stat-grid">${stat("Series",series.length)}${stat("Numbered issues",totalIssues)}${stat("Publication lines",lines.length)}</div>`;
  if(!series.length)html+=`<div class="sheet-section">${empty("No series are mapped to this category yet.")}</div>`;
  for(const [g,list] of lines){html+=`<div class="cx-series-section" data-line-section="${esc(g)}"><div class="cx-section-head"><div><span>${esc(g.toUpperCase())}</span><h3>${esc(g)}</h3></div><em>${list.length} series</em></div><div class="cx-series-grid">${list.map(s=>`<button class="cx-series-card" data-series="${esc(s.id)}"><div class="cx-series-card-top"><span>${esc(year(s)||"DC")}</span><b>${String(s.issueCount||0).padStart(2,"0")}</b></div><strong>${esc(s.title)}</strong><small>${esc(range(s))}</small><i>Open series →</i></button>`).join("")}</div></div>`;}
  return{html,wire(cn){cn.querySelectorAll("[data-series]").forEach(r=>r.addEventListener("click",()=>{const s=series.find(x=>x.id===r.dataset.series);if(s)push("series",s.title,{series:s});}));}};
}

async function characterList(){
  const [all,series]=await Promise.all([data.getAllCharacters(200),allSeries()]);
  const entries=categoryEntries(series); const roots=resolveRoots(all,series);
  if(!entries.length)return {html:empty("No series are mapped yet. An admin can load them from Admin Tools → Reset & Import · New 52.")};
  const trees=entries.map(({cat,list})=>{const lines=lineGroups(list);
    const rc=rootOfCat(cat.key,roots,series); const kids=rc?childrenOf(rc,all).sort((a,b)=>leadCount(b,series)-leadCount(a,series)||titleOf(a).localeCompare(titleOf(b))):[];
    return `<div class="cx-char-tree">
      <button class="cx-character-card" data-cat="${esc(cat.key)}"><div class="cx-character-orb">${esc(cat.label.slice(0,1))}</div><div><span>CATEGORY</span><strong>${esc(cat.label)}</strong><small>${list.length} series in this category</small></div><b>→</b></button>
      ${lines.length>1?`<div class="cx-char-branches">${lines.map(([k,v])=>`<button class="cx-char-branch" data-cat="${esc(cat.key)}"><span>${esc(k)}</span><b>${v.length}</b></button>`).join("")}</div>`:""}
      ${kids.length?`<div class="cx-char-family"><div class="cx-char-family-label">FAMILY &amp; ALLIES</div><div class="cx-char-family-track">${kids.map(k=>`<button class="cx-char-chip" data-char="${esc(k.id)}"><i>${esc(titleOf(k).slice(0,1))}</i><span>${esc(titleOf(k))}</span></button>`).join("")}</div></div>`:""}
    </div>`;}).join("");
  return {html:`<div class="cx-kicker">CHARACTERS</div><h2 class="cx-title">Enter through a franchise</h2><div class="cx-subtitle">Each category opens its connected series, in catalogue order.</div><div class="cx-char-trees">${trees}</div>`,
    wire(el){el.querySelectorAll("[data-cat]").forEach(r=>r.addEventListener("click",()=>{const x=CATEGORIES.find(v=>v.key===r.dataset.cat);if(x)push("category",x.label,{categoryKey:x.key});}));
      el.querySelectorAll("[data-char]").forEach(r=>r.addEventListener("click",()=>{const x=all.find(v=>v.id===r.dataset.char);if(x)push("character",titleOf(x),{character:x});}));}};
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
  const catEntries=categoryEntries(series); const roots=resolveRoots(chars,series);
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
  const jumps=[catEntries.length?["characters","Characters"]:null,["lines","Publishing lines"],events.length?["crossovers","Crossovers"]:null,years.length>1?["timeline","Timeline"]:null].filter(Boolean);
  html+=`<nav class="cxa-jump" aria-label="Explore ${esc(ct.name)}">${jumps.map(([k,l])=>`<button data-jump="${k}">${esc(l)}</button>`).join("")}</nav>`;

  // ---- characters: each root with its family orbiting it ----
  if(catEntries.length){
    html+=`<section class="cxa-sec" data-sec="characters"><div class="cxa-sec-head"><span>01</span><h3>Characters</h3></div>${catEntries.map(({cat,list})=>{const rc=rootOfCat(cat.key,roots,series);const kids=rc?childrenOf(rc,chars).sort((a,b)=>leadCount(b,series)-leadCount(a,series)||titleOf(a).localeCompare(titleOf(b))):[];return `<div class="cxa-constellation">
        <button class="cxa-core" data-cat="${esc(cat.key)}"><span class="cxa-core-orb">${esc(cat.label.slice(0,1))}</span><span class="cxa-core-body"><em>Category</em><strong>${esc(cat.label)}</strong><small>${list.length} series</small></span><b>Enter →</b></button>
        ${kids.length?`<div class="cxa-orbit">${kids.map(k=>{const n=leadCount(k,series);return `<button class="cxa-sat" data-char="${esc(k.id)}"><i>${esc(titleOf(k).slice(0,1))}</i><span>${esc(titleOf(k))}</span>${n?`<small>${n} lead series</small>`:`<small>supporting</small>`}</button>`;}).join("")}</div>`:""}
      </div>`;}).join("")}</section>`;
  }

  // ---- publishing lines: one line at a time, series drawn as lifespans across the era ----
  html+=`<section class="cxa-sec" data-sec="lines"><div class="cxa-sec-head"><span>${catEntries.length?"02":"01"}</span><h3>Publishing lines</h3></div>
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
    el.querySelectorAll("[data-cat]").forEach(b=>b.addEventListener("click",()=>{const x=CATEGORIES.find(v=>v.key===b.dataset.cat);if(x)push("category",x.label,{categoryKey:x.key});}));
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

async function seriesList(){const ss=(await allSeries()).sort((a,b)=>categoryRank(categoryOf(a).key)-categoryRank(categoryOf(b).key)||groupRank(a.lineCategory)-groupRank(b.lineCategory)||year(a).localeCompare(year(b))||a.title.localeCompare(b.title));if(!ss.length)return{html:empty("No series are mapped yet.")};const groups=new Map();ss.forEach(s=>{const k=categoryOf(s).label;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s);});let html=`<div class="cx-kicker">SERIES</div><h2 class="cx-title">DC Comics catalogue</h2><div class="cx-subtitle">Every mapped publication, grouped by franchise category in a fixed order. New territories appear here automatically.</div>`;for(const [g,list] of groups){html+=`<div class="cx-series-section"><div class="cx-section-head"><div><span>${esc(g.toUpperCase())}</span><h3>${esc(g)}</h3></div><em>${list.length} series</em></div><div class="cx-series-grid">${list.map(s=>`<button class="cx-series-card" data-series="${esc(s.id)}"><div class="cx-series-card-top"><span>${esc(year(s)||"DC")}</span><b>${String(s.issueCount||0).padStart(2,"0")}</b></div><strong>${esc(s.title)}</strong><small>${esc(range(s))}</small><i>Open series →</i></button>`).join("")}</div></div>`;}return{html,wire(c){c.querySelectorAll("[data-series]").forEach(r=>r.addEventListener("click",()=>{const s=ss.find(x=>x.id===r.dataset.series);push("series",s.title,{series:s});}));}};}

// ---- Reading paths: MAIN PATH -> CROSSOVER -> BRANCHES -> RETURN. Pure relationships between existing series/collections;
// nothing here owns issues. Shown on a series (or run) page only when the owner-supplied branch paths mention that series.
const bpMemo=new Map();
const bpColls=sid=>{if(!bpMemo.has(sid))bpMemo.set(sid,data.getCollectionsForSeries(sid).then(l=>(l||[]).filter(c=>!c.runId)).catch(()=>[]));return bpMemo.get(sid);};
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
    const explicit=(b?.collectionIds||[]).length?b.collectionIds:null;
    const only=(b?.labels||[]).length?new Set(b.labels):null;const keep=r=>!only||only.has(String(bpNum(r.issueLabel)));
    const baseRows=rows.filter(keep);const v=bpVolumes(bid,colls,explicit?colls.filter(c=>explicit.includes(c.id)).flatMap(c=>(c.issueCoverage||[]).filter(r=>r.seriesId===bid&&keep(r))):baseRows,explicit);
    const exRows=explicit?colls.filter(c=>explicit.includes(c.id)).flatMap(c=>(c.issueCoverage||[]).filter(r=>r.seriesId===bid&&keep(r))):baseRows;
    return {rows:[...new Map(exRows.map(r=>[r.issueId,r])).values()],...v};};
  return {ev,bySeries};
}
function bpVolBtn(c){return `<button class="cx-bp-vol" data-bp-coll="${esc(c.id)}"><span class="cx-bp-fmt">${esc(pillLabel(c))}</span>${esc(displayCollectionTitle(c))}</button>`;}
function bpNode(kind,label,body){return `<div class="cx-bp-node is-${kind}"><span class="cx-bp-tag">${esc(label)}</span>${body}</div>`;}
const bpArrow=`<div class="cx-bp-arrow" aria-hidden="true">↓</div>`;
const bpJoin=a=>a.length<2?a.join(""):a.length===2?a.join(" and "):a.slice(0,-1).join(", ")+" and "+a[a.length-1];
async function bpPathHtml(path,s,mode,paths,detail){
  const L=await bpLoad(path,s.id);
  const sInfo=await L.bySeries(s.id);
  const evBtns=L.ev.length?`<div class="cx-evt-eds">${L.ev.map(c=>`<button class="cx-evt-ed" data-bp-coll="${esc(c.id)}"><span>${esc(pillLabel(c))}</span>${c.publicationDate?`<em>${esc(String(c.publicationDate).slice(0,4))}</em>`:""}</button>`).join("")}</div>`:"";
  const linked=id=>id?(paths||[]).find(x=>x.id===id)||null:null;
  const next=linked(path.nextPathId),prev=linked(path.followsPathId);
  const instruction=path.readingInstruction||`Enter ${path.title}, explore the participating series, then return to the main story.`;
  const count=(path.branches||[]).length;
  // Compact by default (progressive disclosure, not data removal): the full narrative sits behind an explicit expand action.
  if(!detail){
    const titles=sInfo.tie.map(displayCollectionTitle);
    const moreBtn=`<button class="cx-bp-more" data-bp-more="1">Show details ▾</button>`;
    if(mode==="main")return `<div class="cx-bp-compact"><span class="cx-bp-sel">Main Path · ${esc(s.title)}</span><strong>${esc(path.title)}</strong>${titles.length?`<small>Entry: ${esc(bpJoin(titles))}</small>`:""}${moreBtn}</div>`;
    return `<div class="cx-bp-compact"><span class="cx-bp-sel">Crossover</span><strong>${esc(path.title)}</strong><small>${count} participating ${count===1?"series":"series"}</small>${moreBtn}</div>`;
  }
  const retLine=i=>i.ret?`<span class="cx-bp-return">Return to main story: then ${bpVolBtn(i.ret)}</span>`:`<span class="cx-bp-return">Return to main story: carries on with the series' next issues.</span>`;
  const nextNote=next?`<small class="cx-bp-note">Then continue into ${esc(next.title)}.</small>`:"";
  const prevNote=prev?`<small class="cx-bp-note">Follows ${esc(prev.title)}.</small>`:"";
  // ONE renderer for every event: each participating series resolves to its existing collection(s) + issue range (event-scoped
  // by this path's own event collections), or to the collection's own wording where the series has no record of its own.
  const cards=(await Promise.all((path.branches||[]).map(async b=>{
    if(!b.seriesId){const cs=(await Promise.all((b.collectionIds||[]).map(id=>get(COLLECTIONS.COLLECTIONS,id)))).filter(Boolean);const one=cs.filter(c=>formatKey(c)==="TPB"||formatKey(c)==="Volume").concat(cs).slice(0,1);
      return `<div class="cx-bp-branch is-text"><b>${esc(b.label)}</b><small>${esc(b.note||"")}</small>${one.length?`<div class="cx-bp-vols">${one.map(bpVolBtn).join("")}</div>`:""}<span class="cx-bp-opt">Optional branch</span></div>`;}
    const i=await L.bySeries(b.seriesId);const here=b.seriesId===s.id;
    const evOnly=!i.tie.length&&L.ev.length?`<small>Collected in ${esc(L.ev.map(c=>displayCollectionTitle(c)).filter((t,k,a)=>a.indexOf(t)===k).join(" / "))}</small>`:"";
    return `<div class="cx-bp-branch ${here?"is-here":""}"><b>${esc(b.label)}${b.related?` <em>related title</em>`:""}</b><small>${esc(compressLabels(i.rows)||"")}</small>${i.tie.length?`<div class="cx-bp-vols">${i.tie.map(bpVolBtn).join("")}</div>`:evOnly}${retLine(i)}${here?`<span class="cx-bp-here">You are here</span>`:`<button class="cx-bp-open" data-bp-series="${esc(b.seriesId)}">Open series →</button><span class="cx-bp-opt">Optional branch</span>`}</div>`;}))).join("");
  const participants=bpNode("branch","PARTICIPATING SERIES",`<div class="cx-bp-branches">${cards}</div>`);
  const ret=bpNode("ret","RETURN TO MAIN STORY",`<div class="cx-bp-ret"><b>${esc(s.title)}</b>${sInfo.ret?`<span>then ${bpVolBtn(sInfo.ret)}</span>`:`<span class="cx-bp-note">carries on with the series' next issues</span>`}</div>${nextNote}`);
  const less=`<button class="cx-bp-more" data-bp-more="0">Hide details ▴</button>`;
  if(mode==="main"){
    const titles=sInfo.tie.map(displayCollectionTitle);
    const intro=titles.length?`Read through ${bpJoin(titles)}, then explore the crossover branches. Return to the main story afterward.`:instruction;
    return bpNode("main","MAIN PATH",`<strong>${esc(s.title)}</strong><small class="cx-bp-here-line">You are here</small><small>${esc(intro)}</small>${sInfo.tie.length?`<div class="cx-bp-vols">${sInfo.tie.map(bpVolBtn).join("")}</div>`:""}`)+bpArrow
      +bpNode("cross","CROSSOVER",`<strong>${esc(path.title)}</strong><small>Optional, parallel reading.</small>${evBtns}${prevNote}`)+bpArrow+participants+bpArrow+ret+less;
  }
  return bpNode("cross","CROSSOVER",`<strong>${esc(path.title)}</strong><small>${esc(instruction)}</small>${evBtns}${prevNote}`)+bpArrow+participants+bpArrow+ret+less;
}
async function mountReadingPaths(host,s,range){
  if(!host)return;let paths;try{paths=await bp.getBranchPathsForSeries(s.id);}catch(e){console.warn("[Comics Explorer] reading paths unavailable",e);return;}
  if(!paths.length)return;
  if(range){const inRange=async p=>{const ev=(await Promise.all((p.eventCollectionIds||[]).map(id=>get(COLLECTIONS.COLLECTIONS,id)))).filter(Boolean);const mine=(p.branches||[]).find(b=>b.seriesId===s.id);const ex=mine?.collectionIds||[];const cs=[...ev,...(await Promise.all(ex.map(id=>get(COLLECTIONS.COLLECTIONS,id)))).filter(Boolean)];const only=new Set(mine?.labels||[]);const ns=cs.flatMap(c=>(c.issueCoverage||[]).filter(r=>r.seriesId===s.id).map(r=>bpNum(r.issueLabel))).filter(n=>n!=null&&(!only.size||only.has(String(n))));return !ns.length||ns.some(n=>n>=range[0]&&n<=range[1]);};
    const ok=await Promise.all(paths.map(inRange));paths=paths.filter((_,i)=>ok[i]);if(!paths.length)return;}
  paths.sort((a,b)=>String(a.pathCode).localeCompare(String(b.pathCode)));
  const state=new Map(paths.map(p=>[p.id,{open:false,mode:"main",detail:{main:false,cross:false}}]));
  // Collapsed by default: one compact row per crossover, so Overview / Publications stay near the top of the page.
  host.innerHTML=`<div class="cx-series-section cx-bp-wrap"><div class="cx-section-head"><div><span>READING PATH</span><h3>Crossovers</h3></div><em>${paths.length}</em></div><div class="cx-bp-list">${paths.map(p=>`<div class="cx-bp" data-bp="${esc(p.id)}" data-open="false"><button class="cx-bp-row" aria-expanded="false"><span>${esc(p.title)}</span><i>›</i></button><div class="cx-bp-panel" hidden><div class="cx-bp-modes"><button class="cx-bp-mode is-active" data-mode="main">Main Path</button><button class="cx-bp-mode" data-mode="cross">Crossover</button></div><div class="cx-bp-body"></div></div></div>`).join("")}</div></div>`;
  const draw=async(box,p)=>{const st=state.get(p.id);const body=box.querySelector(".cx-bp-body");const t=++st.tok;
    let html;try{html=await bpPathHtml(p,s,st.mode,paths,st.detail[st.mode]);}catch(e){console.warn(e);html=empty("This crossover couldn't be loaded right now.");}
    if(t!==st.tok)return;body.innerHTML=html;
    box.querySelectorAll(".cx-bp-mode").forEach(b=>b.classList.toggle("is-active",b.dataset.mode===st.mode));
    body.querySelectorAll("[data-bp-more]").forEach(b=>b.addEventListener("click",()=>{st.detail[st.mode]=b.dataset.bpMore==="1";draw(box,p);}));
    body.querySelectorAll("[data-bp-coll]").forEach(b=>b.addEventListener("click",async()=>{const c=await get(COLLECTIONS.COLLECTIONS,b.dataset.bpColl);if(c)push("collection",c.title,{collectionEntity:c});}));
    body.querySelectorAll("[data-bp-series]").forEach(b=>b.addEventListener("click",async()=>{const x=await get(COLLECTIONS.SERIES,b.dataset.bpSeries);if(x)push("series",x.title,{series:x});}));};
  host.querySelectorAll(".cx-bp").forEach(box=>{const p=paths.find(x=>x.id===box.dataset.bp);const st=state.get(p.id);st.tok=0;
    box.querySelector(".cx-bp-row").addEventListener("click",()=>{st.open=!st.open;box.dataset.open=String(st.open);box.querySelector(".cx-bp-row").setAttribute("aria-expanded",String(st.open));box.querySelector(".cx-bp-panel").hidden=!st.open;if(st.open)draw(box,p);});
    box.querySelectorAll(".cx-bp-mode").forEach(b=>b.addEventListener("click",()=>{st.mode=b.dataset.mode;draw(box,p);}));});
}

async function series(p){
  const s=p.series;if(!s)return{html:empty("Series not found.")};
  const [issues,collections,runs,creators]=await Promise.all([data.getIssuesForSeries(s.id),data.getCollectionsForSeries(s.id).catch(()=>[]),data.getRunsForSeries(s.id),Promise.all((s.creatorIds||[]).map(id=>get(COLLECTIONS.CREATORS,id)))]);sortIssues(issues);
  // A relaunch run (e.g. Deathstroke 2014) lives in the same series but restarts numbering: its issues/collections carry a runId and are shown on that run's page, never mixed into this run's counts.
  const mainColl=collections.filter(c=>!c.runId);const b=issueBuckets(issues.filter(i=>!i.runId));
  const counts={issues:b.numbered.length,annuals:b.annual.length,specials:b.special.length+b.one_shot.length};
  const ml=mainlineSummary(mainColl,s.id);
  const first=b.numbered[0]?.issueNumber,last=b.numbered[b.numbered.length-1]?.issueNumber;
  let html=`<div class="cx-kicker">SERIES</div><h2 class="cx-title">${esc(s.title)}</h2><div class="cx-subtitle">${esc(range(s))} · ${counts.issues} numbered issues${counts.annuals?` · ${counts.annuals} annuals`:""}${counts.specials?` · ${counts.specials} specials/one-shots`:""}</div>`;
  if(s.anthology)html+=`<div class="cx-tag-row"><span class="tag">Anthology</span></div>`;
  if(creators.filter(Boolean).length)html+=`<div class="cx-tag-row">${creators.filter(Boolean).map(c=>`<span class="tag">${esc(titleOf(c))}</span>`).join("")}</div>`;
  html+=`<div class="sheet-section"><div class="sheet-label">THE STORY</div><div class="cx-info-card">${esc(s.description||"A New 52 publication mapped as part of the connected DC Comics catalogue.")}</div></div>`;
  html+=`<div class="cx-publication-summary"><div>${stat("Issues",counts.issues)}<span class="cx-summary-detail">${counts.issues?`#${first}–#${last}`:"Not recorded"}</span></div><div>${stat("Annuals",counts.annuals)}<span class="cx-summary-detail">${counts.annuals?"Annual publications recorded":"None recorded"}</span></div><div>${stat("Specials",counts.specials)}<span class="cx-summary-detail">${counts.specials?"Special / one-shot units":"None recorded"}</span></div></div>`;
  if(runs.length){html+=`<div class="cx-series-section"><div class="cx-section-head"><div><span>CREATIVE HISTORY</span><h3>Creative runs</h3></div><em>${runs.length} runs</em></div><div class="cx-run-grid">${runs.sort((a,b)=>(Number(a.startIssue)||0)-(Number(b.startIssue)||0)).map((r,i)=>`<div class="cx-run-card"><strong>${esc(r.title||creators.filter(Boolean).map(c=>titleOf(c)).join(" / ")||"Run")}</strong><span>${esc(coverage(r))}</span><b>Creative history</b></div>`).join("")}</div></div>`;}
  html+=`<div id="cxReadingPaths"></div>`;
  html+=`<div class="cx-series-section"><div class="cx-section-head"><div><span>PUBLICATIONS</span><h3>Collected editions & extras</h3></div></div>${tabs("overview",[["overview","Overview"],mainColl.length?["collections","Collected Editions"]:null,counts.annuals?["annuals","Annuals",counts.annuals]:null,counts.specials?["specials","Specials",counts.specials]:null].filter(Boolean))}<div id="cxTabBody"></div></div>`;
  return{html,wire(c){mountReadingPaths(c.querySelector("#cxReadingPaths"),s);const tabBody=c.querySelector("#cxTabBody");const renderTab=t=>{
      if(t==="overview")tabBody.innerHTML=`<div class="cx-overview-panel"><div class="cx-issue-box"><span>NUMBERED RUN</span><strong>${esc(counts.issues?`#${first} — #${last}`:"No numbered issues recorded")}</strong><small>This is the complete numbered run represented in the catalogue. The story itself is organised below through its creative history and collected editions.</small></div><div class="cx-overview-grid"><div><b>${counts.annuals}</b><span>Annual publications</span><small>${esc(b.annual.map(i=>i.issueLabel).join(" · ")||"None recorded")}</small></div><div><b>${counts.specials}</b><span>Specials / one-shots</span><small>${esc([...b.special,...b.one_shot].map(i=>i.issueLabel).join(" · ")||"None recorded")}</small></div><div><b>${ml.n}</b><span>${esc(ml.label)}</span><small>${esc(ml.events||ml.shared?`Mainline volumes only · ${ml.events} crossover/event collection${ml.events===1?"":"s"} listed separately`:"Mainline volumes only")}</small></div></div></div>`;
      else if(t==="collections")mountEditions(tabBody,mainColl,issues,s);
      else if(t==="annuals")tabBody.innerHTML=publicationRows(b.annual);
      else tabBody.innerHTML=publicationRows([...b.special,...b.one_shot]);
      if(t!=="collections")wirePublications(tabBody,issues,collections,s);
    };renderTab("overview");c.querySelectorAll(":scope > .cx-series-section .cx-tabs > .cx-tab").forEach(t=>t.addEventListener("click",()=>{c.querySelectorAll(":scope > .cx-series-section .cx-tabs > .cx-tab").forEach(x=>x.classList.remove("is-active"));t.classList.add("is-active");renderTab(t.dataset.tab);}));}};
}

async function run(p){
  const r=p.run,s=p.series;if(!r||!s)return{html:empty("Run not found.")};
  const creators=await Promise.all((r.creatorIds||[]).map(id=>get(COLLECTIONS.CREATORS,id)));
  const [issues,collections]=await Promise.all([data.getIssuesForSeries(s.id),data.getCollectionsForSeries(s.id).catch(()=>[])]);sortIssues(issues);
  const rel=Array.isArray(r.issueIds)&&r.issueIds.length>0;const runIss=new Set(r.issueIds||[]);
  const lo=rel?NaN:Number(r.startIssue),hi=rel?NaN:Number(r.endIssue);const inRun=rel?issues.filter(i=>runIss.has(i.id)):(Number.isFinite(lo)&&Number.isFinite(hi)?issues.filter(i=>{if(i.runId)return false;const n=issueNum(i);return n>=lo&&n<=hi;}):[]);const b=issueBuckets(inRun);
  const runColls=rel?collections.filter(c=>c.runId===r.id):collections.filter(c=>!c.runId);
  const counts={issues:b.numbered.length,annuals:b.annual.length,specials:b.special.length+b.one_shot.length};
  const ml=mainlineSummary(runColls,s.id);
  let html=`<div class="cx-kicker">CREATIVE RUN</div><h2 class="cx-title">${esc(r.title||creators.filter(Boolean).map(titleOf).join(" / ")||"Run")}</h2><div class="cx-subtitle">${esc(coverage(r))}${counts.issues?` · ${counts.issues} numbered issues`:""}</div>`;
  if(creators.filter(Boolean).length)html+=`<div class="cx-tag-row">${creators.filter(Boolean).map(c=>`<span class="tag">${esc(titleOf(c))}</span>`).join("")}</div>`;
  html+=`<div class="cx-publication-summary">${stat("Issues",counts.issues)}${stat("Annuals",counts.annuals)}${stat("Specials",counts.specials)}</div>`;
  html+=`<div class="sheet-section"><div class="sheet-label">PUBLICATION COVERAGE</div><div class="cx-coverage-callout">${esc(coverage(r))}</div></div>`;
  html+=`<div id="cxReadingPaths"></div>`;
  html+=`<div class="cx-series-section"><div class="cx-section-head"><div><span>PUBLICATIONS</span><h3>Run material</h3></div></div>${tabs("overview",[["overview","Overview"],runColls.length?["collections","Collected Editions"]:null,counts.annuals?["annuals","Annuals",counts.annuals]:null,counts.specials?["specials","Specials",counts.specials]:null].filter(Boolean))}<div id="cxRunTab"></div></div>`;
  return{html,wire(c){if(!rel)mountReadingPaths(c.querySelector("#cxReadingPaths"),s,Number.isFinite(lo)&&Number.isFinite(hi)?[lo,hi]:null);const body=c.querySelector("#cxRunTab");const draw=t=>{
      if(t==="overview")body.innerHTML=`<div class="cx-overview-panel"><div class="cx-issue-box"><span>RUN COVERAGE</span><strong>${esc(coverage(r))}</strong><small>${counts.issues} numbered issue${counts.issues===1?"":"s"} in this creative run. Annuals and specials are listed separately below.</small></div><div class="cx-overview-grid"><div><b>${counts.annuals}</b><span>Annual publications</span><small>${esc(b.annual.map(i=>i.issueLabel).join(" · ")||"None recorded")}</small></div><div><b>${counts.specials}</b><span>Specials / one-shots</span><small>${esc([...b.special,...b.one_shot].map(i=>i.issueLabel).join(" · ")||"None recorded")}</small></div><div><b>${ml.n}</b><span>${esc(ml.label)}</span><small>Mainline volumes of the series</small></div></div></div>`;
      else if(t==="collections")mountEditions(body,runColls,issues,s);
      else if(t==="annuals")body.innerHTML=publicationRows(b.annual);
      else body.innerHTML=publicationRows([...b.special,...b.one_shot]);
      if(t!=="collections")wirePublications(body,inRun,collections,s);
    };draw("overview");c.querySelectorAll(":scope > .cx-series-section .cx-tabs > .cx-tab").forEach(t=>t.addEventListener("click",()=>{c.querySelectorAll(":scope > .cx-series-section .cx-tabs > .cx-tab").forEach(x=>x.classList.remove("is-active"));t.classList.add("is-active");draw(t.dataset.tab);}));}};
}

async function issue(p){const i=p.issue;if(!i)return{html:empty("Issue not found.")};const s=p.series||await get(COLLECTIONS.SERIES,i.seriesId);const cs=await Promise.all((i.creatorIds||[]).map(id=>get(COLLECTIONS.CREATORS,id)));let html=`<div class="cx-kicker">PUBLICATION</div><h2 class="cx-title">${esc(i.issueLabel||"Issue")}${i.title?` — ${esc(i.title)}`:""}</h2><div class="cx-subtitle">${esc(s?.title||"")}${i.publicationDate?` · ${esc(i.publicationDate)}`:""}</div>`;if(i.issueLabelType)html+=`<div class="cx-tag-row"><span class="tag">${esc(i.issueLabelType)}</span></div>`;if(i.collectionStatusNote)html+=`<div class="sheet-section"><div class="sheet-label">COLLECTION STATUS</div><div class="cx-info-card">${esc(i.collectionStatus==="end of run"?"End of run · not in a standard volume":(i.collectionStatus||""))}. ${esc(i.collectionStatusNote)}</div></div>`;if(cs.filter(Boolean).length)html+=`<div class="cx-tag-row">${cs.filter(Boolean).map(c=>`<span class="tag">${esc(titleOf(c))}</span>`).join("")}</div>`;return{html};}
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


// ============================================================================
// ERA HUB — an atlas "dashboard" of four horizontal rails, one per question. A navigation/presentation layer over existing sources:
//   WHAT HAPPENED?            → new52-map-data.js (crossoverSpine order, transitionEvents, lanes, limited series) — read, never copied
//   WHO / WHICH CORNER?       → categories.js + existing root/family logic (curated lead-series eligibility, data.js)
//   WHAT WAS PUBLISHED?       → data.getSeriesForContinuity, in categories.js order; category tiles first, then that category's series
//   HOW SHOULD I EXPERIENCE IT? → new52ReadingPaths. These are lists of EVENT ids (no issue-level order, no branches), so they are
//                               presented as event spines, never as a reading order. comicReadingPaths records (bp-*) have no ordered
//                               entries either, so they only enrich an event with its participating series and collected editions.
// Every card opens an existing level (series / category / character / collection) or one of the detail levels below.
// Nothing here owns data; phases are presentation groupings, not records.
// ============================================================================
const eraYears=ct=>{const a=ct?.startDate?String(ct.startDate).slice(0,4):"",b=ct?.endDate?String(ct.endDate).slice(0,4):"";return a?`${a} — ${b||"present"}`:"";};
const isNew52=ct=>/new\s*52/i.test(`${ct?.shortName||""} ${ct?.name||""}`);
const ATLAS_IMG=f=>new URL(`./assets/atlas/${f}?v=1`,import.meta.url).href;
const MAP_DATA="./new52-map-data.js?v=3";
// Presentation phases (not records). The Launch is a special state: Flashpoint is the transition into the New 52 and the relaunch is a publishing
// event, not a story, so it owns no spine event (Court of Owls is a Batman story inside the early universe). The other phases start at these
// events of the source's own spine order. Multiverse works and transitions are not placed in a phase (they are shown as what they are).
const PHASES=[
  {n:1,title:"The Launch",kind:"launch",img:"07-new-52.webp"},
  {n:2,title:"Early Universe",from:"court-owls"},
  {n:3,title:"Escalation",from:"rotworld"},
  {n:4,title:"Late Era",from:"doomed"},
  {n:5,title:"The Finale",from:"darkseid-war"}];
const isStoryEvent=e=>e.type!=="transition"&&e.type!=="multiverse";
function derivePhases(m){
  const spine=m.crossoverSpine.filter(isStoryEvent);
  const cuts=PHASES.filter(ph=>ph.from).map(ph=>({ph,i:spine.findIndex(e=>e.id===ph.from)})).filter(x=>x.i>=0).sort((a,b)=>a.i-b.i);
  const body=cuts.map((c,k)=>({...c.ph,events:spine.slice(c.i,k+1<cuts.length?cuts[k+1].i:spine.length)})).filter(x=>x.events.length);
  return [...PHASES.filter(ph=>ph.kind==="launch").map(ph=>({...ph,events:[]})),...body];
}
const plain=t=>String(t||"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g,"");
// An event that is also a limited series in the source (Forever Evil, Futures End, The Multiversity…) is "owned" by that record's lane.
const limitedFor=(ev,m)=>m.new52Limited.find(l=>plain(l.title)===plain(ev.title))||null;
const eventLaneIds=(ev,m)=>[...new Set([...(ev.lanes||[]),...(limitedFor(ev,m)?.lane?[limitedFor(ev,m).lane]:[])])].filter(id=>m.getLane(id));
const laneTitle=(m,id)=>m.getLane(id)?.title||"";
const phaseLanes=(ph,m)=>[...new Set(ph.events.flatMap(e=>eventLaneIds(e,m)))].map(id=>laneTitle(m,id)).filter(Boolean);
const normKey=t=>eventKey(t).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g,"");
const recordFor=(ev,recs)=>(recs||[]).find(r=>normKey(r.title)===normKey(ev.title))||null;
const eraTop=(kicker,title,sub)=>`<div class="cxe-head"><div class="cx-kicker">${esc(kicker)}</div><h2 class="cx-title">${esc(title)}</h2>${sub?`<div class="cx-subtitle">${esc(sub)}</div>`:""}</div>`;
const hueOf=i=>`--h:${(i*47+210)%360}`;
const rail=(id,q,title,body,extra="",after="")=>`<section class="cxe-railsec" data-rail="${id}"><div class="cxe-rail-head"><div><span class="cxe-q">${esc(q)}</span><h3>${esc(title)}</h3></div><div class="cxe-rail-nav"><button type="button" data-dir="-1" aria-label="Scroll ${esc(title)} back">‹</button><button type="button" data-dir="1" aria-label="Scroll ${esc(title)} forward">›</button></div></div><div class="cxe-rail ${extra}" tabindex="0" role="list" aria-label="${esc(title)}">${body}</div>${after}</section>`;
const bgImg=f=>f?`<img class="cxe-bg" src="${ATLAS_IMG(f)}" alt="" loading="lazy" decoding="async">`:"";
function wireRails(el){
  el.querySelectorAll(".cxe-rail-nav button").forEach(b=>b.addEventListener("click",()=>{const r=b.closest(".cxe-railsec").querySelector(".cxe-rail");r.scrollBy({left:+b.dataset.dir*Math.max(240,r.clientWidth*.8),behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});}));
  el.querySelectorAll("img.cxe-bg").forEach(i=>i.addEventListener("error",()=>i.remove()));
}
// Small UI memory so returning to a hub/territory screen finds it as it was left (the screens re-render on Back).
const eraUI={serCat:null,lanes:new Set()};
// Dates are shown only where the source states them (the era description / transition summaries); never inferred.
const MONTHS="January|February|March|April|May|June|July|August|September|October|November|December";
const launchWhen=m=>(String(m.new52Era?.description||"").match(new RegExp(`(?:${MONTHS})\\s+\\d{4}`))||[])[0]||"";
const bridgeLabel=t=>String(t.title||"").replace("DC Universe: ","");
const eraTitleOf=(m,id)=>m.eras.find(e=>e.id===id)?.title||id;
const kindLabel=k=>({multiverse:"Multiverse / Limited series",event:"Event limited series",maxiseries:"Maxi-series",miniseries:"Miniseries","tie-in":"Tie-in miniseries",transition:"Transition limited series","dc-you-continuation":"DC You continuation"})[k]||String(k||"Limited series").replace(/[-_]/g," ");
const pathTypeLabelOf=t=>({essential:"Core event spine",main_series:"Lane event list",event_crossover:"Full event spine"})[t]||"Event spine";
const evTypeLabel=t=>({story:"Story arc",crossover:"Crossover",event:"Event",multiverse:"Multiverse work",transition:"Transition"})[t]||"Event";
const issueLabel=l=>/^\d/.test(String(l))?`#${l}`:String(l);

async function eraHub(p){
  const ct=p.continuity;if(!ct)return{html:empty("Era not found.")};
  const n52=isNew52(ct);
  const [series,allChars,paths,m]=await Promise.all([data.getSeriesForContinuity(ct.id),data.getAllCharacters(200),data.getAllReadingPaths(200).catch(()=>[]),n52?import(MAP_DATA):null]);
  const chars=allChars.filter(c=>!c.continuityIds?.length||c.continuityIds.includes(ct.id));
  const entries=categoryEntries(series),roots=resolveRoots(chars,series);
  const yrs=eraYears(ct);
  let html=`${p.exitOnBack?`<button type="button" class="cxe-atlas-link" data-atlas>← DC UNIVERSE ATLAS</button>`:""}<div class="cxe-hero"><div class="cx-kicker">ERA</div><h2 class="cx-title">${esc(ct.name)}</h2>${yrs?`<div class="cxe-years">${esc(yrs)}</div>`:""}</div>`;

  // 1 — WHAT HAPPENED? a journey: transition → phases → transition
  if(m){
    const phases=derivePhases(m),T=id=>m.transitionEvents.find(t=>t.id===id);
    const flash=T("transition-new52"),reb=T("transition-rebirth");
    const bridgeCard=(t,img)=>t?`<div class="cxe-card cxe-bridgecard" role="listitem">${bgImg(img)}<button type="button" class="cxe-card-main" data-bridge="${esc(t.id)}"><span class="cxe-tag">TRANSITION</span><strong>${esc(t.title)}</strong><small>${esc(eraTitleOf(m,t.from))} → ${esc(eraTitleOf(m,t.to))}</small></button></div>`:"";
    const when=launchWhen(m);
    const cards=[bridgeCard(flash,"06-flashpoint.webp"),
      ...phases.map((ph,i)=>{const e=ph.events;
        if(ph.kind==="launch")return `<div class="cxe-card cxe-phase is-launch" role="listitem" style="${hueOf(i)}">${bgImg(ph.img)}<button type="button" class="cxe-card-main" data-phase="${ph.n}"><span class="cxe-phase-n">0${ph.n}</span><strong>${esc(ph.title)}</strong><small>Flashpoint → ${esc(when?`${when} relaunch`:"the relaunch")}</small><span class="cxe-minis"><i>Flashpoint</i><i>New 52 relaunch</i><i>First wave</i></span><span class="cxe-go">Explore the first wave →</span></button></div>`;
        const desc=e.length>1?`${e[0].title} → ${e[e.length-1].title}`:e[0].title;
        return `<div class="cxe-card cxe-phase" role="listitem" style="${hueOf(i)}">${bgImg(ph.img)}<button type="button" class="cxe-card-main" data-phase="${ph.n}"><span class="cxe-phase-n">0${ph.n}</span><strong>${esc(ph.title)}</strong><small>${esc(desc)}</small><span class="cxe-minis">${e.slice(0,4).map(x=>`<i>${esc(x.title.split(" / ")[0])}</i>`).join("")}${e.length>4?`<i>+${e.length-4}</i>`:""}</span><span class="cxe-go">Explore →</span></button></div>`;}),
      bridgeCard(reb,"08-rebirth.webp"),
      `<div class="cxe-card cxe-endcard" role="listitem"><button type="button" class="cxe-card-main" data-lanes><span class="cxe-tag">DETAIL</span><strong>Publishing territories</strong><small>Core publications and crossover participation, lane by lane</small></button></div>`,
      `<div class="cxe-card cxe-endcard" role="listitem"><button type="button" class="cxe-card-main" data-full><span class="cxe-tag">DETAIL</span><strong>Crossover editions &amp; year timeline</strong><small>Events by period, with lanes and collected editions</small></button></div>`].join("");
    html+=rail("timeline","WHAT HAPPENED?","Timeline & Events",cards,"is-journey");
  }
  // 2 — WHO / WHICH CORNER?
  if(entries.length){
    const cards=entries.map(({cat,list},i)=>{const rc=rootOfCat(cat.key,roots,series);
      const kids=rc?childrenOf(rc,chars).filter(k=>data.isEligibleLeadCharacter(k.id,series)).sort((a,b)=>leadCount(b,series)-leadCount(a,series)||titleOf(a).localeCompare(titleOf(b))).slice(0,3):[];
      const lines=lineGroups(list).map(x=>x[0]).slice(0,3).join(" · ");
      return `<div class="cxe-card cxe-faction" role="listitem" style="${hueOf(categoryRank(cat.key))}"><span class="cxe-glyph" aria-hidden="true">${esc(cat.label.slice(0,1))}</span><button type="button" class="cxe-card-main" data-cat="${esc(cat.key)}"><span class="cxe-tag">${esc(lines||"Franchise")}</span><strong>${esc(cat.label)}</strong><small>${list.length} series</small><span class="cxe-go">Explore →</span></button>${kids.length?`<div class="cxe-kids">${kids.map(k=>`<button type="button" data-char="${esc(k.id)}">${esc(titleOf(k))}</button>`).join("")}</div>`:""}</div>`;}).join("");
    html+=rail("factions","WHO? WHICH CORNER OF THE UNIVERSE?","Heroes & Factions",cards);
  }
  // 3 — WHAT WAS PUBLISHED? two levels: a publication territory first (compact tiles), then that territory's series in a contained panel
  if(entries.length){
    const tiles=entries.map(({cat,list})=>{const iss=list.reduce((n,s)=>n+(Number(s.issueCount)||0),0);
      return `<div class="cxe-card cxe-sertile" role="listitem" style="${hueOf(categoryRank(cat.key))}"><button type="button" class="cxe-card-main" data-sercat="${esc(cat.key)}" aria-expanded="false" aria-controls="cxeSerPanel"><strong>${esc(cat.label)}</strong><small>${list.length} series</small><span class="cxe-count">${iss} issues</span></button></div>`;}).join("");
    html+=rail("series","WHAT WAS PUBLISHED?","Series",tiles,"is-tiles",`<div class="cxe-serpanel" id="cxeSerPanel" hidden></div>`);
  }
  // 4 — HOW SHOULD I EXPERIENCE IT? event spines from the source's own path definitions (event ids only — no reading order is implied)
  if(m&&m.new52ReadingPaths.length){
    const evById=new Map(m.crossoverSpine.map(e=>[e.id,e]));
    const cards=m.new52ReadingPaths.map((rp,i)=>{const steps=rp.eventIds.map(id=>evById.get(id)).filter(e=>e&&e.type!=="transition");if(!steps.length)return "";
      return `<div class="cxe-card cxe-path" role="listitem" style="${hueOf(i+3)}"><button type="button" class="cxe-card-main" data-path="${esc(rp.id)}"><span class="cxe-tag">${esc(pathTypeLabelOf(rp.type))}</span><strong>${esc(rp.title)}</strong><small>${esc(rp.sub||"")}</small><span class="cxe-route-line"><i>${esc(steps[0].title.split(" / ")[0])}</i><b aria-hidden="true">→</b><i>${esc(steps[steps.length-1].title.split(" / ")[0])}</i></span><span class="cxe-count">${steps.length} events</span><span class="cxe-go">Open spine →</span></button></div>`;}).join("");
    html+=rail("paths","HOW SHOULD I EXPERIENCE IT?","Paths & Event Spines",cards);
  }
  return{html,wire(el){
    wireRails(el);
    el.querySelector("[data-atlas]")?.addEventListener("click",close);
    el.querySelectorAll("[data-phase]").forEach(b=>b.addEventListener("click",()=>{const ph=PHASES.find(x=>x.n===+b.dataset.phase);push("eraPhase",`${String(ph.n).padStart(2,"0")} · ${ph.title}`,{continuity:ct,phase:ph.n});}));
    el.querySelectorAll("[data-bridge]").forEach(b=>b.addEventListener("click",()=>{const t=m.transitionEvents.find(x=>x.id===b.dataset.bridge);push("eraPhase",t?bridgeLabel(t):"Transition",{continuity:ct,bridge:b.dataset.bridge});}));
    el.querySelector("[data-lanes]")?.addEventListener("click",()=>push("eraLanes","Publishing territories",{continuity:ct}));
    el.querySelector("[data-full]")?.addEventListener("click",()=>push("eraTimeline","Events & editions by period",{continuity:ct}));
    el.querySelectorAll("[data-cat]").forEach(b=>b.addEventListener("click",()=>{const x=CATEGORIES.find(v=>v.key===b.dataset.cat);if(x)push("category",x.label,{categoryKey:x.key});}));
    el.querySelectorAll("[data-char]").forEach(b=>b.addEventListener("click",()=>{const x=chars.find(v=>v.id===b.dataset.char);if(x)push("character",titleOf(x),{character:x});}));
    el.querySelectorAll("[data-path]").forEach(b=>b.addEventListener("click",()=>{const rp=m.new52ReadingPaths.find(x=>x.id===b.dataset.path);push("eraPath",rp.title,{continuity:ct,pathId:rp.id});}));
    // series territories
    const panel=el.querySelector("#cxeSerPanel");
    if(panel){
      const tilesEls=[...el.querySelectorAll("[data-sercat]")];
      const sorted=l=>[...l].sort((a,b)=>String(a.startDate||"").localeCompare(String(b.startDate||""))||String(a.title).localeCompare(String(b.title)));
      const show=(key,scroll)=>{const e=entries.find(x=>x.cat.key===key);eraUI.serCat=e?key:null;
        tilesEls.forEach(t=>{const on=!!e&&t.dataset.sercat===key;t.setAttribute("aria-expanded",String(on));t.closest(".cxe-sertile").classList.toggle("is-active",on);});
        if(!e){panel.hidden=true;panel.innerHTML="";return;}
        const iss=e.list.reduce((n,s)=>n+(Number(s.issueCount)||0),0);
        panel.style.cssText=hueOf(categoryRank(e.cat.key));
        panel.innerHTML=`<div class="cxe-serpanel-head"><div><span class="cxe-q">PUBLICATION TERRITORY</span><h4>${esc(e.cat.label)}</h4><small>${e.list.length} series · ${iss} issues</small></div><button type="button" data-closepanel aria-label="Close ${esc(e.cat.label)} series">✕</button></div><div class="cxe-serlist">${sorted(e.list).map(s=>`<button type="button" class="cxe-serrow" data-series="${esc(s.id)}"><strong>${esc(s.title)}</strong><small>${esc(range(s)||"Years not recorded")}</small><b>${Number(s.issueCount)||0} issues</b></button>`).join("")}</div>`;
        panel.hidden=false;
        panel.querySelector("[data-closepanel]").addEventListener("click",()=>{show(null);tilesEls.find(t=>t.dataset.sercat===key)?.focus();});
        panel.querySelectorAll("[data-series]").forEach(b=>b.addEventListener("click",()=>{const s=series.find(x=>x.id===b.dataset.series);if(s)push("series",s.title,{series:s});}));
        if(scroll)requestAnimationFrame(()=>panel.scrollIntoView({block:"nearest",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"}));};
      tilesEls.forEach(t=>t.addEventListener("click",()=>show(eraUI.serCat===t.dataset.sercat?null:t.dataset.sercat,true)));
      if(eraUI.serCat)show(eraUI.serCat,false);
    }
  }};
}

// Canonical routes for an item that has no reading-path record: the catalogue's own collections / series / issues are looked up by title, never
// copied. A story arc resolves to its mainline volume; a crossover to its crossover collection. Nothing is shown unless the catalogue has it.
let allCollsP=null;
const allCollections=()=>allCollsP||(allCollsP=data.getAllCollections(1000).catch(()=>[]));
const hasVolume=c=>/\bVol(?:ume)?\.?\s*\d/i.test(String(c.title||""));
async function canonFor(ev,X){
  const key=plain(eventKey(ev.title));if(key.length<6)return null;
  const colls=(await allCollections()).filter(c=>plain(c.title).includes(key)&&(c.issueCoverage||[]).some(r=>X.byId.has(r.seriesId)));
  if(!colls.length)return null;
  const want=ev.type==="story"?"mainline":"crossover";
  let pool=colls.filter(c=>roleOf(c)===want);if(!pool.length)pool=colls;
  pool=[...pool].sort((a,b)=>(hasVolume(b)-hasVolume(a))||((a.issueCoverage||[]).length-(b.issueCoverage||[]).length));
  return{primary:pool[0],colls:colls.sort((a,b)=>(a===pool[0]?-1:b===pool[0]?1:0))};
}
async function fillCanon(box,ev,X){
  const cn=await canonFor(ev,X);if(!cn){box.hidden=true;return;}
  const {primary,colls}=cn;const rows=(primary.issueCoverage||[]).filter(r=>X.byId.has(r.seriesId));
  const bySer=new Map();rows.forEach(r=>{if(!bySer.has(r.seriesId))bySer.set(r.seriesId,[]);bySer.get(r.seriesId).push(r);});
  const runs=await Promise.all([...bySer.keys()].map(id=>data.getRunsForSeries(id).catch(()=>[])));
  const num=l=>{const n=parseFloat(String(l).replace(/[^0-9.]/g,""));return Number.isFinite(n)?n:null;};
  const runTag=[...bySer.keys()].map((id,i)=>{const ns=bySer.get(id).map(r=>num(r.issueLabel)).filter(n=>n!=null);if(!ns.length)return"";const lo=Math.min(...ns),hi=Math.max(...ns);
    const r=runs[i].find(x=>{const a=num(x.startIssue),b=num(x.endIssue);return a!=null&&b!=null&&a<=lo&&b>=hi;});return r?.title?`${X.byId.get(id).title} · ${r.title}`:"";}).filter(Boolean);
  const many=[...bySer.values()].some(l=>l.length>14);
  box.innerHTML=`<div class="cxe-eds-label">${ev.type==="story"?"STORY ARC IN":"PUBLISHED IN"}</div>
    <div class="cxe-chips is-btn">${[...bySer.keys()].map(id=>`<button type="button" data-series="${esc(id)}">${esc(X.byId.get(id).title)}<em>${esc(compressLabels(bySer.get(id)))}</em></button>`).join("")}</div>
    ${runTag.length?`<small class="cxe-canon-run">${esc(runTag.join(" · "))}</small>`:""}
    ${many?"":`<div class="cxe-eds-label">ISSUES</div><div class="cxe-chips is-btn">${rows.map(r=>`<button type="button" data-issue="${esc(r.issueId)}" data-iser="${esc(r.seriesId)}">${esc(X.byId.get(r.seriesId).title.replace(/\s*\(.*?\)/,""))} ${esc(issueLabel(r.issueLabel))}</button>`).join("")}</div>`}
    <div class="cxe-eds-label">COLLECTED IN</div><div class="cxe-chips is-btn">${colls.map(c=>`<button type="button" data-coll="${esc(c.id)}">${esc(c.title)}<em>${esc(pillLabel(c))}</em></button>`).join("")}</div>`;
  box.querySelectorAll("[data-series]").forEach(b=>b.addEventListener("click",()=>{const x=X.byId.get(b.dataset.series);if(x)push("series",x.title,{series:x});}));
  box.querySelectorAll("[data-issue]").forEach(b=>b.addEventListener("click",async()=>{const i=await get(COLLECTIONS.ISSUES,b.dataset.issue);if(i)push("issue",i.issueLabel||b.textContent,{issue:i,series:X.byId.get(b.dataset.iser)});}));
  box.querySelectorAll("[data-coll]").forEach(b=>b.addEventListener("click",()=>{const c=colls.find(x=>x.id===b.dataset.coll);if(c)push("collection",c.title,{collectionEntity:c});}));
}

// One event, expandable: type, recorded issue range, involved lanes (main series vs participation), the researched editions of its own limited-series
// record where it has one, and — where a crossover record with the same title exists — that record's participating series and collected editions.
function eventItem(ev,m,rec,o={}){
  const ids=eventLaneIds(ev,m),owner=limitedFor(ev,m)?.lane||null,work=limitedFor(ev,m);
  const multi=ids.length>1;
  let role="";
  if(o.lane&&ev.type==="story")role="Story arc in this lane";
  else if(o.lane){role=owner===o.lane?"Main series in this lane":multi?`Participates${owner?` · main series: ${laneTitle(m,owner)}`:" · multi-lane crossover"}`:"Lane crossover";}
  else role=`${evTypeLabel(ev.type)}${multi?` · across ${ids.length} lanes`:""}`;
  const chips=ids.map(id=>{const t=laneTitle(m,id);return owner===id&&multi?`<span class="is-owner">${esc(t)} · main series</span>`:`<span>${esc(t)}${multi&&owner&&owner!==id?" · participates":""}</span>`;}).join("");
  const eds=(work?.collections||[]);
  return `<div class="cxe-ev" data-ev="${esc(ev.id)}"><button type="button" class="cxe-ev-head" aria-expanded="false"><span class="cxe-ev-t"><strong>${esc(ev.title)}</strong><small>${esc(role)}</small>${o.showIssues?`<small class="cxe-ev-rng">${esc(ev.issues||"")}</small>`:""}${o.showIssues&&(eds.length||rec?.eventCollectionIds?.length)?`<small class="cxe-ev-eds">${(eds.length||0)+(rec?.eventCollectionIds?.length||0)} collected edition${(eds.length||0)+(rec?.eventCollectionIds?.length||0)===1?"":"s"} recorded</small>`:""}</span><i aria-hidden="true">›</i></button><div class="cxe-ev-more" hidden>
    <div class="cxe-ev-issues">${esc(ev.issues||"")}</div>
    ${chips?`<div class="cxe-chips">${chips}</div>`:""}
    ${eds.length?`<div class="cxe-eds-label">COLLECTED EDITIONS</div><div class="cxe-chips">${eds.map(c=>`<span>${esc(c.format)} · ${esc(c.title)}</span>`).join("")}</div>`:""}
    ${work?`<div class="cxe-chips is-btn"><button type="button" data-work="${esc(work.id)}">Open ${esc(work.title)} detail →</button></div>`:""}
    ${!rec&&ev.type!=="transition"&&ev.type!=="multiverse"?`<div class="cxe-canon" data-canon="${esc(ev.id)}"></div>`:""}
    ${rec?`<div class="cxe-rec" data-rec="${esc(rec.id)}">${rec.readingInstruction?`<p>${esc(rec.readingInstruction)}</p>`:""}<div class="cxe-rec-box"></div></div>`:""}</div></div>`;
}
function wireEvents(el,X){
  const {recs,byId,ct}=X;
  el.querySelectorAll("[data-work]").forEach(b=>b.addEventListener("click",()=>{const w=X.m.new52Limited.find(x=>x.id===b.dataset.work);if(w)push("eraWork",w.title,{continuity:ct,workId:w.id});}));
  el.querySelectorAll(".cxe-ev-head").forEach(h=>h.addEventListener("click",async()=>{const more=h.nextElementSibling;const o=more.hidden;more.hidden=!o;h.setAttribute("aria-expanded",String(o));
    const cb=more.querySelector(".cxe-canon");if(o&&cb&&!cb.dataset.done){cb.dataset.done="1";const ev=X.m.crossoverSpine.find(e=>e.id===cb.dataset.canon);if(ev)fillCanon(cb,ev,X);}
    const box=more.querySelector(".cxe-rec-box");if(!o||!box||box.dataset.done)return;box.dataset.done="1";
    const rec=recs.find(r=>r.id===box.parentElement.dataset.rec);if(!rec)return;
    const br=(rec.branches||[]).filter(b=>b.seriesId&&byId.has(b.seriesId));
    const cs=(await Promise.all((rec.eventCollectionIds||[]).map(id=>get(COLLECTIONS.COLLECTIONS,id)))).filter(Boolean);
    box.innerHTML=`${br.length?`<div class="cxe-eds-label">PARTICIPATING SERIES</div><div class="cxe-chips is-btn">${br.map(b=>`<button type="button" data-series="${esc(b.seriesId)}">${esc(b.label||byId.get(b.seriesId).title)}</button>`).join("")}</div>`:""}${cs.length?`<div class="cxe-eds-label">COLLECTED IN</div><div class="cxe-chips is-btn">${cs.map(c=>`<button type="button" data-coll="${esc(c.id)}">${esc(pillLabel(c))} · ${esc(displayCollectionTitle(c))}</button>`).join("")}</div>`:""}`;
    box.querySelectorAll("[data-series]").forEach(b=>b.addEventListener("click",()=>{const s=byId.get(b.dataset.series);if(s)push("series",s.title,{series:s});}));
    box.querySelectorAll("[data-coll]").forEach(b=>b.addEventListener("click",()=>{const c=cs.find(x=>x.id===b.dataset.coll);if(c)push("collection",c.title,{collectionEntity:c});}));}));
}
async function eraCtx(ct){
  const [series,paths,m]=await Promise.all([data.getSeriesForContinuity(ct.id),data.getAllReadingPaths(200).catch(()=>[]),import(MAP_DATA)]);
  const ids=new Set(series.map(s=>s.id));
  return {ct,m,series,byId:new Map(series.map(s=>[s.id,s])),recs:paths.filter(x=>x.continuityId===ct.id||(x.seriesIds||[]).some(id=>ids.has(id)))};
}
// A catalogue series matching a research-index title (the two sources use different ids, so titles are the only join; no match = not clickable).
const seriesByTitle=(X,t)=>X.series.find(s=>plain(s.title)===plain(t))||X.series.find(s=>plain(String(s.title).replace(/\(.*?\)/g,""))===plain(t))||null;

// A transition bridge, rendered from whatever fields its record has (title, from → to, kicker, summary, core issues, editions).
function transitionHtml(t,m,X){
  const issues=Array.isArray(t.issues)?t.issues:[],eds=Array.isArray(t.editions)?t.editions:[];
  const rel=X.series.filter(s=>issues.some(i=>plain(String(i).replace(/\s*#.*$/,""))===plain(s.title)));
  return `${eraTop("TRANSITION",t.title,t.kicker)}<div class="cxe-bridge">
    ${t.from||t.to?`<div class="cxe-xfer"><span>${esc(eraTitleOf(m,t.from))}</span><b aria-hidden="true">↓</b><span>${esc(eraTitleOf(m,t.to))}</span></div>`:""}
    ${t.summary?`<p>${esc(t.summary)}</p>`:""}</div>
    ${t.to&&t.to===m.new52Era?.id?`<div class="cxe-sec-sub">INTO THE NEW 52</div>${m.new52Era.description?`<div class="cx-info-card">${esc(m.new52Era.description)}</div>`:""}<div class="cxe-chips is-btn"><button type="button" data-tolaunch>See the New 52 launch →</button></div>`:""}
    ${t.from&&t.from===m.new52Era?.id?`<div class="cxe-sec-sub">OUT OF THE NEW 52</div><p class="cxe-note is-soft">This transition closes the New 52 era and leads into ${esc(eraTitleOf(m,t.to))}.</p>`:""}
    ${issues.length?`<div class="cxe-sec-sub">CORE ISSUES</div><ul class="cxe-issuegrid">${issues.map(i=>`<li><strong>${esc(i)}</strong></li>`).join("")}</ul>`:""}
    ${eds.length?`<div class="cxe-sec-sub">COLLECTED EDITIONS</div><div class="cxe-edgrid">${eds.map(e=>`<div class="cxe-ed">${e.format?`<span class="cxe-tag">${esc(e.format)}</span>`:""}${e.title?`<strong>${esc(e.title)}</strong>`:""}${e.coverage?`<small>${esc(e.coverage)}</small>`:""}${e.notes?`<em>${esc(e.notes)}</em>`:""}</div>`).join("")}</div>`:""}
    ${rel.length?`<div class="cxe-sec-sub">IN THE CATALOGUE</div><div class="cxe-chips is-btn">${rel.map(s=>`<button type="button" data-series="${esc(s.id)}">${esc(s.title)}</button>`).join("")}</div>`:""}`;
}

// Launch material: the opening story of Justice League (2011), reached through the catalogue's own records (series → issues → collection). The
// collection id is only a presentation reference; the title, issues and series all come from that record, and nothing shows if it is absent.
const LAUNCH_COLLECTION="justice-league-vol-1-origin";
async function launchMaterial(box,X){
  if(!box)return;const c=await get(COLLECTIONS.COLLECTIONS,LAUNCH_COLLECTION);if(!c)return;
  const rows=(c.issueCoverage||[]).filter(r=>X.byId.has(r.seriesId));if(!rows.length)return;
  const sid=rows[0].seriesId,ser=X.byId.get(sid),tm=String(c.title).match(/^(.*?)\s+Vol\.\s*\d+:\s*(.+)$/),story=tm?`${tm[1]}: ${tm[2]}`:c.title;
  box.hidden=false;
  box.innerHTML=`<div class="cxe-sec-sub">LAUNCH MATERIAL</div><p class="cxe-note is-soft">The opening story of ${esc(ser.title)} — a story arc in a launch title, not a crossover or an event.</p>
    <div class="cxe-chips is-btn"><button type="button" data-lm-series>${esc(ser.title)}<em>${esc(compressLabels(rows))}</em></button></div>
    <div class="cxe-eds-label">${esc(story)} · ISSUES</div><div class="cxe-chips is-btn">${rows.map(r=>`<button type="button" data-issue="${esc(r.issueId)}">${esc(ser.title.replace(/\s*\(.*?\)/,""))} ${esc(issueLabel(r.issueLabel))}</button>`).join("")}</div>
    <div class="cxe-eds-label">COLLECTED IN</div><div class="cxe-chips is-btn"><button type="button" data-lm-coll>${esc(c.title)}</button></div>`;
  box.querySelector("[data-lm-series]").addEventListener("click",()=>push("series",ser.title,{series:ser}));
  box.querySelectorAll("[data-issue]").forEach(b=>b.addEventListener("click",async()=>{const i=await get(COLLECTIONS.ISSUES,b.dataset.issue);if(i)push("issue",i.issueLabel||b.textContent,{issue:i,series:ser});}));
  box.querySelector("[data-lm-coll]").addEventListener("click",()=>push("collection",c.title,{collectionEntity:c}));
}

// A phase (its events), the special Launch state, or a transition bridge.
async function eraPhase(p){
  const ct=p.continuity;if(!ct||!isNew52(ct))return{html:empty("Timeline not available for this era.")};
  const X=await eraCtx(ct),{m}=X;
  const openSeries=el=>el.querySelectorAll("[data-series]").forEach(b=>b.addEventListener("click",()=>{const s=X.byId.get(b.dataset.series);if(s)push("series",s.title,{series:s});}));
  if(p.bridge){const t=m.transitionEvents.find(x=>x.id===p.bridge);if(!t)return{html:empty("Transition not found.")};
    return{html:transitionHtml(t,m,X),wire(el){openSeries(el);el.querySelector("[data-tolaunch]")?.addEventListener("click",()=>push("eraPhase","01 · The Launch",{continuity:ct,phase:1}));}};}
  const ph=derivePhases(m).find(x=>x.n===p.phase);if(!ph)return{html:empty("Phase not found.")};
  if(ph.kind==="launch"){
    const flash=m.transitionEvents.find(t=>t.id==="transition-new52"),when=launchWhen(m);
    const first=X.series.filter(s=>year(s)==="2011").sort((a,b)=>String(a.startDate||"").localeCompare(String(b.startDate||""))||String(a.title).localeCompare(String(b.title)));
    const html=`${eraTop(`PHASE 01 · ${ct.name}`,ph.title,`Flashpoint → ${when?`${when} relaunch`:"the relaunch"}`)}
      ${flash?`<button type="button" class="cxe-bridgerow" data-bridge="${esc(flash.id)}"><span class="cxe-tag">TRANSITION</span><strong>${esc(flash.title)}</strong><small>${esc(eraTitleOf(m,flash.from))} → ${esc(eraTitleOf(m,flash.to))} · ${esc(flash.kicker||"")}</small></button>`:""}
      ${m.new52Era?.description?`<div class="sheet-section"><div class="sheet-label">THE RELAUNCH</div><div class="cx-info-card">${esc(m.new52Era.description)}</div></div>`:""}
      <p class="cxe-note is-soft">The relaunch is a line-wide publishing initiative, not a single story, so no event is listed for it. Early stories and crossovers — such as the Court of Owls and Night of the Owls — belong to <b>02 · Early Universe</b>.</p>
      <div class="cxe-launchmat" data-launchmat hidden></div>
      <div class="cxe-sec-sub">THE FIRST WAVE</div>
      ${first.length?`<p class="cxe-note">${first.length} series in the catalogue began in 2011.</p><div class="cxe-serlist is-page">${first.map(s=>`<button type="button" class="cxe-serrow" data-series="${esc(s.id)}"><strong>${esc(s.title)}</strong><small>${esc(range(s))}</small><b>${Number(s.issueCount)||0} issues</b></button>`).join("")}</div>`:`<p class="cxe-note">No 2011 start dates are recorded in the catalogue yet.</p>`}`;
    return{html,wire(el){openSeries(el);el.querySelector("[data-bridge]")?.addEventListener("click",()=>push("eraPhase",bridgeLabel(flash),{continuity:ct,bridge:flash.id}));
      launchMaterial(el.querySelector("[data-launchmat]"),X);}};
  }
  const lanes=phaseLanes(ph,m);
  const html=`${eraTop(`PHASE 0${ph.n} · ${ct.name}`,ph.title,`${ph.events.length} event${ph.events.length===1?"":"s"} grouped by the part of the era they belong to. Exact dates aren't tracked, and events overlap.`)}
    ${lanes.length?`<div class="cxe-chips">${lanes.map(l=>`<span>${esc(l)}</span>`).join("")}</div>`:""}
    <div class="cxe-evlist is-page">${ph.events.map(e=>eventItem(e,m,recordFor(e,X.recs))).join("")}</div>`;
  return{html,wire(el){wireEvents(el,X);}};
}

// Dedicated New 52 event/edition view: the source's events grouped into broad periods, with type, issue range, lanes, collected editions
// and the transitions on either side. A year is shown only where the source states one; everything else gets the broader period.
async function eraTimeline(p){
  const ct=p.continuity;if(!ct||!isNew52(ct))return{html:empty("Not available for this era.")};
  const X=await eraCtx(ct),{m}=X;const T=id=>m.transitionEvents.find(t=>t.id===id);
  const flash=T("transition-new52"),reb=T("transition-rebirth");
  const when=launchWhen(m),conv=(String(m.new52Era?.description||"").match(/Convergence in (\d{4})/)||[])[1],rb=(String(reb?.summary||"").match(new RegExp(`(?:${MONTHS})\\s+\\d{4}`))||[])[0];
  const undated="Exact dates aren't tracked — events overlap";
  const bridgeRow=(t)=>t?`<button type="button" class="cxe-bridgerow" data-bridge="${esc(t.id)}"><span class="cxe-tag">TRANSITION</span><strong>${esc(t.title)}</strong><small>${esc(eraTitleOf(m,t.from))} → ${esc(eraTitleOf(m,t.to))}${(t.issues||[]).length?` · ${t.issues.length} core issue entr${t.issues.length===1?"y":"ies"}`:""}${(t.editions||[]).length?` · ${t.editions.length} editions`:""}</small></button>`:"";
  const sec=(when,title,note,body,cls="")=>`<section class="cxe-period ${cls}"><div class="cxe-period-head"><span class="cxe-period-when">${esc(when)}</span><h3>${esc(title)}</h3>${note?`<small>${esc(note)}</small>`:""}</div>${body}</section>`;
  const list=evs=>`<div class="cxe-evlist is-page">${evs.map(e=>eventItem(e,m,recordFor(e,X.recs),{showIssues:true})).join("")}</div>`;
  const phases=derivePhases(m),mv=m.crossoverSpine.filter(e=>e.type==="multiverse");
  let body="";
  body+=sec(when||"Launch","Flashpoint → New 52 launch","The transition into the New 52, then the line-wide relaunch",`${bridgeRow(flash)}<button type="button" class="cxe-bridgerow is-launch" data-phase="1"><span class="cxe-tag">LAUNCH</span><strong>The New 52 relaunch</strong><small>First-wave publications — a publishing relaunch, not a single event</small></button>`,"is-transition");
  for(const ph of phases.filter(x=>x.events.length))body+=sec(`0${ph.n} · ${ph.title}`,`${ph.events[0].title}${ph.events.length>1?` → ${ph.events[ph.events.length-1].title}`:""}`,undated,list(ph.events));
  if(mv.length)body+=sec("Alternate Earths","Multiverse works",undated,list(mv));
  body+=sec([conv,rb].filter(Boolean).join(" – ")||"New 52 → Rebirth","Convergence → Rebirth","The transition out of the New 52",bridgeRow(reb),"is-transition");
  const html=`${eraTop("TIMELINE & EVENTS · DETAIL","Crossover editions & year timeline","Major New 52 stories and events grouped by era phase. Exact dates aren't tracked, apart from the launch and the Convergence → Rebirth transition. Open an item for its series, issues and collected editions.")}<div class="cxe-periods">${body}</div>`;
  return{html,wire(el){wireEvents(el,X);
    el.querySelectorAll("[data-bridge]").forEach(b=>b.addEventListener("click",()=>{const t=T(b.dataset.bridge);push("eraPhase",t?bridgeLabel(t):"Transition",{continuity:ct,bridge:b.dataset.bridge});}));
    el.querySelector("[data-phase]")?.addEventListener("click",()=>push("eraPhase","01 · The Launch",{continuity:ct,phase:1}));}};
}

// Publishing territories (lanes): CORE PUBLICATIONS (the lane's own series) → CROSSOVER PARTICIPATION (events it takes part in, never presented
// as its own stories) → FAMILY / RELATED CHARACTERS (research-index groups concentrated in the lane). Alternate and future material sits apart.
async function eraLanes(p){
  const ct=p.continuity;if(!ct||!isNew52(ct))return{html:empty("Not available for this era.")};
  const X=await eraCtx(ct),{m}=X;const evs=m.crossoverSpine.filter(e=>e.type!=="transition");
  const laneOf=new Map([...m.new52Series,...m.new52Limited].map(s=>[s.id,s.lane]));
  const pub=(s,tag)=>{const fs=seriesByTitle(X,s.title);return fs?`<button type="button" data-series="${esc(fs.id)}">${esc(s.title)}${tag?` <em>${esc(tag)}</em>`:""}</button>`:`<span class="is-static">${esc(s.title)}${tag?` <em>${esc(tag)}</em>`:""}</span>`;};
  const lane=l=>{
    const ong=m.new52Series.filter(s=>s.lane===l.id),lim=m.new52Limited.filter(s=>s.lane===l.id);
    const inLane=evs.filter(e=>eventLaneIds(e,m).includes(l.id)),stories=inLane.filter(e=>e.type==="story"),parts=inLane.filter(e=>e.type!=="story");
    const fam=m.new52CharacterHubs.map(h=>({h,n:h.seriesIds.filter(id=>laneOf.get(id)===l.id).length})).filter(x=>x.n>0&&x.n*2>x.h.seriesIds.length);
    const open=eraUI.lanes.has(l.id);
    const secs=`${ong.length||lim.length?`<div class="cxe-sub">CORE PUBLICATIONS <em>${[ong.length?`${ong.length} ongoing`:"",lim.length?`${lim.length} limited`:""].filter(Boolean).join(" · ")}</em></div><div class="cxe-chips is-btn">${ong.map(s=>pub(s)).join("")}${lim.map(s=>pub(s,s.kind==="miniseries"?"limited":s.kind)).join("")}</div>`:""}
      ${stories.length?`<div class="cxe-sub">KEY STORIES <em>${stories.length}</em></div><p class="cxe-note is-soft">Story arcs that belong to this lane's own series — not crossovers.</p><div class="cxe-evlist">${stories.map(e=>eventItem(e,m,recordFor(e,X.recs),{lane:l.id})).join("")}</div>`:""}
      ${parts.length?`<div class="cxe-sub">CROSSOVER PARTICIPATION <em>${parts.length}</em></div><p class="cxe-note is-soft">Events this lane takes part in. Taking part is not owning: each event names its main series and the other lanes involved.</p><div class="cxe-evlist">${parts.map(e=>eventItem(e,m,recordFor(e,X.recs),{lane:l.id})).join("")}</div>`:""}
      ${fam.length?`<div class="cxe-sub">FAMILY / RELATED CHARACTERS</div><div class="cxe-chips">${fam.map(x=>`<span>${esc(x.h.title)} · ${x.n} series</span>`).join("")}</div>`:""}`;
    return `<section class="cxe-lane${l.alt?" is-alt":""}" data-lane-id="${esc(l.id)}"><button type="button" class="cxe-lane-head" data-lane="${esc(l.id)}" aria-expanded="${open}"><span><strong>${esc(l.title)}</strong><small>${esc(l.sub||"")}</small></span><span class="cxe-lane-n">${ong.length+lim.length} publications${parts.length?` · ${parts.length} events`:""}</span><i aria-hidden="true">›</i></button><div class="cxe-lane-body"${open?"":" hidden"}>${secs}</div></section>`;};
  const main=m.lanes.filter(l=>!l.alt),alt=m.lanes.filter(l=>l.alt);
  const html=`${eraTop("TIMELINE & EVENTS · DETAIL","Publishing territories","Each lane lists its own publications first. Crossovers it takes part in are shown separately as participation, not as that lane's own stories.")}${main.map(lane).join("")}<div class="cxe-sec-sub">PARALLEL &amp; FUTURE EARTHS</div><p class="cxe-note is-soft">Alternate-Earth and future material is kept apart from the main lanes.</p>${alt.map(lane).join("")}`;
  return{html,wire(el){wireEvents(el,X);
    el.querySelectorAll("[data-lane]").forEach(b=>b.addEventListener("click",()=>{const body=b.nextElementSibling,o=body.hidden;body.hidden=!o;b.setAttribute("aria-expanded",String(o));o?eraUI.lanes.add(b.dataset.lane):eraUI.lanes.delete(b.dataset.lane);}));
    el.querySelectorAll(".cxe-lane-body [data-series]").forEach(b=>b.addEventListener("click",()=>{const s=X.byId.get(b.dataset.series);if(s)push("series",s.title,{series:s});}));}};
}

// A limited series / maxi-series from the research index, in full: type, notes, the recorded chapters in source order, researched editions,
// and — only where the catalogue has a matching entity — a way into it. The event spine entry stays a separate thing that links here.
async function eraWork(p){
  const ct=p.continuity;if(!ct||!isNew52(ct))return{html:empty("Not available for this era.")};
  const X=await eraCtx(ct),{m}=X;const w=m.new52Limited.find(x=>x.id===p.workId);if(!w)return{html:empty("Series record not found.")};
  const ev=m.crossoverSpine.find(e=>limitedFor(e,m)===w),eds=w.collections||[],fs=seriesByTitle(X,w.title),iss=w.issues||[];
  const html=`${eraTop(`NEW 52 · ${kindLabel(w.kind).toUpperCase()}`,w.title,laneTitle(m,w.lane)?`Publishing lane: ${laneTitle(m,w.lane)}`:"")}
    <div class="cx-stat-grid">${stat("Type",kindLabel(w.kind))}${stat("Recorded chapters",iss.length)}${stat("Collected editions",eds.length)}</div>
    ${w.notes?`<div class="sheet-section"><div class="sheet-label">DESCRIPTION / NOTES</div><div class="cx-info-card">${esc(w.notes)}</div></div>`:""}
    ${ev?`<div class="sheet-section"><div class="sheet-label">IN THE EVENT SPINE</div><div class="cx-info-card">${esc(ev.title)} — ${esc(ev.issues||"")}</div></div>`:""}
    ${iss.length?`<div class="cxe-sec-sub">STRUCTURE · ${iss.length} CHAPTERS, AS LISTED</div><ol class="cxe-struct">${iss.map((l,i)=>`<li><span>${i+1}</span><strong>${esc(issueLabel(l))}</strong></li>`).join("")}</ol>`:""}
    ${eds.length?`<div class="cxe-sec-sub">COLLECTED EDITIONS</div><div class="cxe-edgrid">${eds.map(e=>`<div class="cxe-ed">${e.format?`<span class="cxe-tag">${esc(e.format)}</span>`:""}<strong>${esc(e.title)}</strong>${e.coverage?`<small>${esc(e.coverage)}</small>`:""}${e.notes?`<em>${esc(e.notes)}</em>`:""}</div>`).join("")}</div>`:`<p class="cxe-note is-soft">No collected edition is listed for this title yet.</p>`}
    <div class="cxe-sec-sub">IN THE CATALOGUE</div>
    ${fs?`<div class="cxe-chips is-btn"><button type="button" data-series="${esc(fs.id)}">Open ${esc(fs.title)} →</button></div>`:`<p class="cxe-note is-soft">This title is not mapped as a catalogue series yet, so its chapters and editions are shown here as listed.</p>`}`;
  return{html,wire(el){el.querySelector("[data-series]")?.addEventListener("click",()=>{if(fs)push("series",fs.title,{series:fs});});}};
}

// A curated list of major stories and events. It is NOT an issue-by-issue reading order, so there is no
// "start here"/"finish"; transitions appear only as bridges at the ends of the full-era spine.
async function eraPath(p){
  const ct=p.continuity;if(!ct||!isNew52(ct))return{html:empty("Not available for this era.")};
  const X=await eraCtx(ct),{m}=X;const rp=m.new52ReadingPaths.find(x=>x.id===p.pathId);if(!rp)return{html:empty("Spine not found.")};
  const evById=new Map(m.crossoverSpine.map(e=>[e.id,e]));const steps=rp.eventIds.map(id=>evById.get(id)).filter(e=>e&&e.type!=="transition");
  const T=id=>m.transitionEvents.find(t=>t.id===id);const full=rp.type==="event_crossover";
  const bridge=t=>t?`<li class="cxe-spine-bridge"><button type="button" class="cxe-bridgerow" data-bridge="${esc(t.id)}"><span class="cxe-tag">TRANSITION</span><strong>${esc(t.title)}</strong><small>${esc(eraTitleOf(m,t.from))} → ${esc(eraTitleOf(m,t.to))}</small></button></li>`:"";
  const html=`${eraTop(pathTypeLabelOf(rp.type).toUpperCase(),rp.title,rp.sub)}
    <p class="cxe-note is-soft">${steps.length} major stories and events from across the era — a curated guide to the big moments, not an issue-by-issue reading order and not a strict timeline. Open one for its issues, series and collected editions.</p>
    <ul class="cxe-spine">${full?bridge(T("transition-new52")):""}${steps.map(e=>`<li class="cxe-spine-ev">${eventItem(e,m,recordFor(e,X.recs))}</li>`).join("")}${full?bridge(T("transition-rebirth")):""}</ul>`;
  return{html,wire(el){wireEvents(el,X);el.querySelectorAll("[data-bridge]").forEach(b=>b.addEventListener("click",()=>{const t=T(b.dataset.bridge);push("eraPhase",t?bridgeLabel(t):"Transition",{continuity:ct,bridge:b.dataset.bridge});}));}};
}

const LEVELS={root,categoryList,category,characterList,character,continuityList,continuity,seriesList,series,run,issue,collection,eraHub,eraPhase,eraLanes,eraPath,eraTimeline,eraWork};
let stack=[];let token=0;
// Navigation = one explorer stack level per Back, from every input. The stack is mirrored in browser history (one entry per level pushed above the
// level the explorer opened at), so the phone's system Back / browser Back pops exactly one level too instead of closing the whole sheet.
// hdepth = levels pushed since opening; baseLen = stack length when the explorer opened (or after a crumb jump below it); expectPop = history moves we made ourselves.
let hdepth=0,baseLen=1,expectPop=0,baseEntry=false;
const sheetOpen=()=>document.getElementById("comicsExplorerSheet")?.dataset.open==="true";
// The explorer always sits on its own history entry (the Atlas pushes one before opening the hub; any other opener gets one here), so the Back that leaves
// level 0 closes the explorer and returns to the page underneath instead of navigating away from the site.
function ensureBase(){if(history.state&&history.state.cxhExplorer){baseEntry=true;return;}try{history.pushState({...(history.state||{}),cxhExplorer:true},"",location.href);baseEntry=true;}catch(e){baseEntry=false;}}
function hpush(){try{history.pushState({...(history.state||{}),cxe:hdepth+1},"",location.href);hdepth++;}catch(e){/* history unavailable: stack-only navigation still works */}}
function hgo(n){if(n<=0)return;expectPop++;try{history.go(-n);}catch(e){expectPop--;}}
function shell(body){const crumbs=stack.map((x,i)=>`${i?`<span class="cx-crumb-sep">/</span>`:""}<span class="cx-crumb" data-i="${i}" data-current="${i===stack.length-1}">${esc(x.label)}</span>`).join("");return `<div class="cx-topbar"><button class="cx-back-btn" id="cxBackBtn" aria-label="${stack.length>1?"Back one level":"Close"}">${stack.length>1?"←":"✕"}</button><div class="cx-breadcrumb">${crumbs}</div></div>${body}`;}
async function render(){const el=document.getElementById("comicsExplorerContent");if(!el||!stack.length)return;const t=++token;const top=stack.at(-1);el.innerHTML=shell(`<div class="cx-loading">Loading…</div>`);let out;try{out=await LEVELS[top.level](top.params||{});}catch(e){console.error("[Comics Explorer]",e);out={html:`<div class="cx-error">Couldn't load this right now. ${esc(e.message||"")}</div>`};}if(t!==token)return;el.innerHTML=shell(out.html);el.querySelector("#cxBackBtn")?.addEventListener("click",back);el.querySelectorAll('.cx-crumb[data-current="false"]').forEach(x=>x.addEventListener("click",()=>jumpTo(+x.dataset.i)));out.wire?.(el);if(top.scroll){const sc=document.getElementById("comicsExplorerSheet");if(sc)requestAnimationFrame(()=>{sc.scrollTop=top.scroll;});}}
function push(level,label,params){const actual=label?.label?String(label.label):label;const sc=document.getElementById("comicsExplorerSheet");if(stack.length&&sc)stack.at(-1).scroll=sc.scrollTop;stack.push({level,label:actual||level,params:params||{}});if(sheetOpen())hpush();render();}
// Breadcrumb jump: the same hierarchy, just several levels at once (history is unwound by the same amount).
function jumpTo(i){const n=i+1;if(n>=stack.length)return;if(n>=baseLen){const nh=n-baseLen;hgo(hdepth-nh);hdepth=nh;}else{hgo(hdepth);hdepth=0;baseLen=n;}stack=stack.slice(0,n);render();}
function openAt(trail){ensureBase();hdepth=0;expectPop=0;stack=[{level:"root",label:"Comics",params:{}}];for(const t of (trail||[])){if(LEVELS[t.level])stack.push({level:t.level,label:t.label||t.level,params:t.params||{}});}baseLen=stack.length;open();render();}
function open(){const b=document.getElementById("comicsExplorerBackdrop"),s=document.getElementById("comicsExplorerSheet");if(b)b.dataset.open="true";if(s)s.dataset.open="true";}
function back(){if(stack.length<=1||stack.at(-1).params?.exitOnBack){close();return;}stack.pop();if(hdepth>0){hdepth--;hgo(1);}else baseLen=Math.min(baseLen,stack.length);render();}
function close(){const wasOpen=sheetOpen();document.getElementById("comicsExplorerBackdrop")?.setAttribute("data-open","false");document.getElementById("comicsExplorerSheet")?.setAttribute("data-open","false");
  // When the Atlas pushed its own entry, landing.js unwinds (1 + cxe) entries on close; otherwise unwind ours here.
  if(wasOpen&&hdepth>0&&!baseEntry){const n=hdepth;try{history.go(-n);}catch(e){}}hdepth=0;}
// System/browser Back (and Forward) while the sheet is open. app.js's popstate handler asks this first (it runs before any listener added later, so it
// cannot be pre-empted from here) and only treats the step as "leave the explorer" when this returns false — i.e. a Back at depth 0.
window.__comicsExplorerPop=e=>{
  if(!sheetOpen())return false;
  if(expectPop>0){expectPop--;return true;}
  const target=(history.state&&history.state.cxe)||0;
  if(target<hdepth){stack=stack.slice(0,baseLen+target);hdepth=target;render();return true;}
  if(target>hdepth){hgo(target-hdepth);return true;}
  return false;
};
export function openComicsExplorer(){ensureBase();hdepth=0;expectPop=0;baseLen=1;stack=[{level:"root",label:"Comics",params:{}}];open();render();}
export function openComicsExplorerAt(t){openAt(t);}
window.__comicsExplorer={open:openComicsExplorer,openAt:openComicsExplorerAt};
window.dispatchEvent(new CustomEvent("comicsv2:explorer-ready"));
document.addEventListener("click",e=>{if(e.target.closest("#comicsExplorerEntryBtn"))openComicsExplorer();});
document.getElementById("comicsExplorerBackdrop")?.addEventListener("click",close);
document.getElementById("comicsExplorerClose")?.addEventListener("click",close);
