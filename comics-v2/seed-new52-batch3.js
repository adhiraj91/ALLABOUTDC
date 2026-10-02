// ============================================================================
// ALLABOUTDC — NEW 52 BATCH 3 (Justice League International, Justice League of America, JLA's Vibe, Justice League United, Legion of Super-Heroes,
// Legion Lost, Justice League 3000, Justice League 3001, Earth 2, Earth 2: World's End, Worlds' Finest, The Savage Hawkman, Cyborg, Martian Manhunter,
// Captain Atom, Mister Terrific). Isolated, additive import built from data-new52-batch3.js (the owner-supplied rigorously validated CSV):
//  - every write goes to a deterministic id, so re-running is idempotent;
//  - ids owned by Batman / Superman / Flash / Green Lantern / Batch 1 / Batch 2 are reserved and refused (a collision aborts before any write);
//  - issues of series that ALREADY exist (Firestorm #9, Batman/Superman #8-9) are referenced by their existing id — never copied, and verified to exist first;
//  - shared catalogue records (universe, continuity) are created only if absent; each series carries its category key for the category hierarchy.
// ============================================================================
import * as schema from "./schema.js";
import * as slug from "./slug.js";
import {B3_DESCRIPTIONS,B3_CHARACTERS,B3_CREATORS,B3_DEFS,B3_RUNS,B3_STATUS,B3_EXTERNAL,B3_COLLECTION_RECORDS} from "./data-new52-batch3.js?v=b3";
const {makeUniverse,makeContinuity,makeCharacter,makeSeries,makeRun,makeIssue,makeCollection,makeCreator,makeSourceInfo,validateSeries,validateRun,validateIssue,validateCollection,validateCharacter,validateCreator}=schema;

const UNIVERSE_ID=slug.buildUniverseId("DC Universe"), CONTINUITY_ID=slug.buildContinuityId("The New 52");
const SRC_NAME="Owner-supplied New 52 Batch 3 CSV (rigorously validated)";
const src=(notes)=>makeSourceInfo({sourceUrl:null,sourceName:SRC_NAME,sourceType:"other",verificationStatus:"verified",notes});
const isUrl=u=>/^https?:\/\//.test(u||"");
const srcType=u=>!isUrl(u)?"other":/dc\.com/.test(u)?"official":/crushingkrisis/.test(u)?"database":"other";

const universe=makeUniverse({id:UNIVERSE_ID,name:"DC Universe",description:"The canonical DC Universe graph.",continuityIds:[CONTINUITY_ID],characterIds:[],sourceInfo:src("Created only if absent; an existing universe record is never modified by this import.")});
const continuity=makeContinuity({id:CONTINUITY_ID,name:"The New 52",shortName:"New 52",description:"Post-Flashpoint DC continuity/publication era.",universeId:UNIVERSE_ID,startDate:"2011-09",endDate:"2016-05",sourceInfo:src("Created only if absent; an existing continuity record is never modified by this import.")});
continuity.earthName="Prime Earth"; continuity.eraNote="Post-Flashpoint";

const characters=B3_CHARACTERS.map(c=>makeCharacter({id:slug.buildCharacterId(c.name),name:c.name,displayName:c.name,aliases:[],universeIds:[UNIVERSE_ID],continuityIds:[CONTINUITY_ID],browseRoot:!!c.root,parentCharacterId:null,sourceInfo:src("Family named in the supplied Batch 3 series rows.")}));
const creators=B3_CREATORS.map(n=>makeCreator({id:slug.buildCreatorId(n),name:n,displayName:n,sourceInfo:src("Creator named in the supplied Batch 3 rows.")}));

const seriesList=[],seriesByTitle=new Map(),issues=[],runs=[],collections=[];
for(const [title,year,startDate,endDate,max,zeros,annuals,decimals,specials,lineCategory,charNames,creatorNames,categoryKey] of B3_DEFS){
  const id=slug.buildSeriesId(title,year);
  const s=makeSeries({id,title,publisher:"DC Comics",startDate,endDate,issueCount:max,universeId:UNIVERSE_ID,continuityIds:[CONTINUITY_ID],characterIds:charNames.map(n=>slug.buildCharacterId(n)),creatorIds:creatorNames.map(n=>slug.buildCreatorId(n)),description:B3_DESCRIPTIONS[title]||"",sourceInfo:src("Series scope exactly as supplied. issueCount is regular numbered issues only; #0, annuals, decimal issues and Futures End one-shots are separate publication units.")});
  Object.assign(s,{categoryKey,lineCategory,regularIssueCount:max,zeroIssueCount:zeros.length,annualCount:annuals.length,decimalIssueCount:decimals.length,specialCount:specials.length,scope:"batch3-new52"});
  seriesList.push(s); seriesByTitle.set(title,s);
  const add=(label,type="numbered")=>issues.push(makeIssue({id:slug.buildIssueId(id,label),seriesId:id,issueNumber:String(label).replace(/^#/,""),issueLabel:type==="numbered"?`#${label}`:String(label),issueLabelType:type,continuityId:CONTINUITY_ID,universeId:UNIVERSE_ID,characterIds:s.characterIds,creatorIds:s.creatorIds,sourceInfo:src("Publication unit within the supplied series scope.")}));
  zeros.forEach(x=>add(x,"special")); for(let n=1;n<=max;n++)add(String(n)); annuals.forEach(x=>add(x,"annual")); decimals.forEach(x=>add(x,"one_shot")); specials.forEach(x=>add(x,"special"));
}
void B3_RUNS; void B3_STATUS;

const labelOf=(label)=>/^Annual/.test(label)||/\./.test(label)||/[A-Za-z]/.test(label)?label:`#${label}`;
/** external references (series already in the catalogue): [{seriesId,issueId,issueLabel,partial}] */
const externalRefs=[];
for(const r of B3_COLLECTION_RECORDS){
  const rows=[],sids=(r.ss||[]).map(t=>seriesByTitle.get(t).id);
  for(const [st,labels,partial=[]] of r.cov){
    const own=seriesByTitle.get(st);
    if(own){ if(!sids.includes(own.id))sids.push(own.id); labels.forEach(l=>rows.push({seriesId:own.id,issueId:slug.buildIssueId(own.id,String(l)),issueLabel:labelOf(String(l)),coveragePart:partial.includes(l)?"partial":"complete"})); continue; }
    const extId=B3_EXTERNAL[st]; if(!extId)throw new Error(`Collection ${r.id}: unknown series ${st}`);
    if(!sids.includes(extId))sids.push(extId);
    labels.forEach(l=>{const row={seriesId:extId,issueId:slug.buildIssueId(extId,String(l)),issueLabel:labelOf(String(l)),coveragePart:partial.includes(l)?"partial":"complete"}; rows.push(row); externalRefs.push({collectionId:r.id,...row});});
  }
  const ps=r.ps?seriesByTitle.get(r.ps):null;
  const verified=r.cv==="verified";
  const c=makeCollection({id:r.id,title:r.t,publisher:"DC Comics",format:r.f,publicationDate:null,isbn:r.isbn13||null,pageCount:null,seriesIds:sids,issueCoverage:rows,editionInfo:{editionNumber:null,editionName:null,printing:null},sourceInfo:makeSourceInfo({sourceUrl:isUrl(r.src[0])?r.src[0]:null,sourceName:SRC_NAME+(r.src[0]&&!isUrl(r.src[0])?` — ${r.src[0]}`:""),sourceType:srcType(r.src[0]),verificationStatus:verified?"verified":"partially_verified",notes:r.an||""})});
  Object.assign(c,{primarySeriesId:ps?ps.id:null,sequence:r.seq,volume:r.v,isbn10:null,priceUSD:null,outOfScopeContents:r.oos||null,reprints:[],sources:r.src,reviewStatus:null,auditClass:null,crossover:r.rl==="crossover"||!!r.x,role:r.rl,csvRole:r.csvrole||null,coverageNote:r.cn||null,dataBasis:"owner_csv_verified"});
  collections.push(c);
}

export const dataset={universes:[universe],continuities:[continuity],characters,series:seriesList,runs,issues,collections,creators};
export const externalReferences=externalRefs;

export function validateDataset(){
  const errors=[]; const ids={};
  const checks=[["character",characters,validateCharacter],["series",seriesList,validateSeries],["run",runs,validateRun],["issue",issues,validateIssue],["collection",collections,validateCollection],["creator",creators,validateCreator]];
  for(const [name,list,fn] of checks){ids[name]=new Set(); for(const e of list){const v=fn(e); if(!v.valid)errors.push(`[${name}/${e.id}] ${v.errors.join("; ")}`); if(ids[name].has(e.id))errors.push(`Duplicate ${name}: ${e.id}`); ids[name].add(e.id);}}
  const ext=new Set(externalRefs.map(r=>r.issueId));
  for(const c of collections){for(const row of c.issueCoverage){if(!ids.issue.has(row.issueId)&&!ext.has(row.issueId))errors.push(`Collection ${c.id} references unknown issue ${row.issueId}`);}}
  for(const s of seriesList){const nums=issues.filter(i=>i.seriesId===s.id&&i.issueLabelType==="numbered").map(i=>Number(i.issueNumber)).sort((a,b)=>a-b); if(JSON.stringify(nums)!==JSON.stringify(Array.from({length:s.issueCount},(_,i)=>i+1)))errors.push(`Series ${s.id}: numbered issues do not equal 1..${s.issueCount}`);}
  const sid=t=>seriesByTitle.get(t)?.id; const col=id=>collections.find(c=>c.id===id);
  const need=(ok,msg)=>{if(!ok)errors.push(msg);};
  const cov=(cid,series,label)=>!!col(cid)?.issueCoverage.some(r=>r.seriesId===(sid(series)||series)&&r.issueLabel===label);
  const labels=(cid,series)=>(col(cid)?.issueCoverage||[]).filter(r=>r.seriesId===(sid(series)||series)).map(r=>r.issueLabel);
  const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>`#${a+i}`);
  need(seriesList.length===16,"16 series");
  need(seriesList.every(s=>s.categoryKey&&["justice-league","legion-future","earth-2","other-dc-heroes"].includes(s.categoryKey)),"every series carries its category key");
  for(const c of collections){if(c.role==="mainline"&&!c.primarySeriesId)errors.push(`${c.id}: a mainline volume needs a primary series`);}
  const vols=(t)=>new Set(collections.filter(c=>c.primarySeriesId===sid(t)&&c.volume).map(c=>c.volume)).size;
  for(const [t,n] of [["Justice League International",2],["Justice League of America",2],["Justice League of America's Vibe",1],["Justice League United",2],["Legion of Super-Heroes",3],["Legion Lost",2],["Justice League 3000",2],["Justice League 3001",1],["Earth 2",6],["Earth 2: World's End",2],["Worlds' Finest",6],["The Savage Hawkman",2],["Cyborg",2],["Martian Manhunter",2],["Captain Atom",2],["Mister Terrific",1]])need(vols(t)===n,`${t}: expected ${n} volumes, found ${vols(t)}`);
  // edition-specific mappings from the brief
  const jli=col("justice-league-international-vol-2-breakdown-firestorm-material");
  need(!!jli&&jli.title==="Justice League International Vol. 2: Breakdown"&&jli.primarySeriesId===sid("Justice League International")&&JSON.stringify(labels(jli.id,"Justice League International"))===JSON.stringify([...range(7,12),"Annual 1"])&&jli.issueCoverage.some(r=>r.seriesId===B3_EXTERNAL["The Fury of Firestorm: The Nuclear Men"]&&r.issueLabel==="#9"),"JLI Vol. 2 = JLI #7-12 + Annual #1 + existing Firestorm #9 (reuses the Batch 2 cross-title record id)");
  const jlu=col("justice-league-united-vol-2-the-infinitus-saga");
  need(JSON.stringify(labels(jlu.id,"Justice League United"))===JSON.stringify([...range(6,10),"Annual 1","Futures End #1"])&&/Justice League: Futures End #1/.test(jlu.outOfScopeContents||""),"JLU Vol. 2 = #6-10 + Annual #1 + JLU: Futures End #1 + Justice League: Futures End #1 (text)");
  need(!collections.some(c=>/justice-league-united-vol-3/.test(c.id)),"no record for the cancelled JLU Vol. 3");
  need(/DC Universe Presents #0/.test(col("earth-2-vol-2-the-tower-of-fate").outOfScopeContents||"")&&cov("earth-2-vol-2-the-tower-of-fate","Earth 2","#0"),"Earth 2 Vol. 2 keeps the DC Universe Presents #0 story as text");
  need(cov("earth-2-vol-3-battle-cry","Earth 2","15.1")&&!cov("earth-2-vol-3-battle-cry","Earth 2","15.2"),"Earth 2 Vol. 3 includes #15.1 only");
  need(/Earth 2: Futures End #1/.test(col("earth-2-vol-5-the-kryptonian").outOfScopeContents||"")&&!issues.some(i=>i.seriesId===sid("Earth 2")&&/Futures End/.test(i.issueLabel)),"Earth 2 Vol. 5 keeps Earth 2: Futures End #1 as text (the supplied series inventory has no such unit)");
  need(JSON.stringify(labels("worlds-finest-vol-4-first-contact","Worlds' Finest"))===JSON.stringify(range(18,22))&&JSON.stringify(labels("worlds-finest-vol-4-first-contact",B3_EXTERNAL["Batman/Superman"]))===JSON.stringify(["#8","#9"]),"Worlds' Finest Vol. 4 = #18-22 + existing Batman/Superman #8-9");
  need(cov("worlds-finest-vol-5-homeward-bound","Worlds' Finest","#22")&&cov("worlds-finest-vol-5-homeward-bound","Worlds' Finest","Futures End #1")&&cov("worlds-finest-vol-4-first-contact","Worlds' Finest","#22"),"Worlds' Finest Vols. 4 and 5 overlap on #22 (preserved) and Vol. 5 carries Futures End #1");
  need(JSON.stringify(labels("worlds-finest-vol-3-control-issues","Worlds' Finest"))===JSON.stringify(range(13,18)),"Worlds' Finest Vol. 3 = #13-18");
  need(/Cyborg: Rebirth #1/.test(col("cyborg-vol-2-enemy-of-the-state").outOfScopeContents||"")&&!issues.some(i=>/Rebirth/i.test(i.issueLabel)),"Cyborg Vol. 2 keeps Cyborg: Rebirth #1 as text; no Rebirth issue records");
  need(cov("martian-manhunter-vol-2-the-red-rising","Justice League of America","#5")&&cov("martian-manhunter-vol-2-the-red-rising","Martian Manhunter","#12"),"Martian Manhunter Vol. 2 references Justice League of America #5 (existing issue record)");
  need(cov("justice-league-3001-vol-1-deja-vu-all-over-again","Justice League 3000","#14")&&cov("justice-league-3001-vol-1-deja-vu-all-over-again","Justice League 3001","#6"),"JL 3001 Vol. 1 = JL 3000 #14-15 + JL 3001 #1-6");
  need(JSON.stringify(labels("legion-of-super-heroes-vol-2-the-dominators","Legion of Super-Heroes"))===JSON.stringify(["#0",...range(8,14)]),"Legion of Super-Heroes Vol. 2 = #0, #8-14");
  need(issues.filter(i=>i.seriesId===sid("Earth 2")&&/^15\.[12]$/.test(i.issueNumber)).length===2,"Earth 2 #15.1 and #15.2 are separate issues");
  need(!col("justice-league-of-americas-vibe-vol-1-breach")?.issueCoverage.some(r=>r.seriesId===sid("Justice League of America")),"Vibe Vol. 1 is Vibe #1-10 only");
  return {valid:errors.length===0,errors};
}

export function plannedIds(){return {characters:characters.map(x=>x.id),creators:creators.map(x=>x.id),series:seriesList.map(x=>x.id),runs:runs.map(x=>x.id),issues:issues.map(x=>x.id),collections:collections.map(x=>x.id)};}

/**
 * Additive import. `reserved` = {characters,creators,series,runs,issues,collections: Set<id>} owned by other datasets
 * (it must also contain the ids of the existing series/issues that collections reference).
 * Nothing is deleted. Returns {validation, written, skipped, ensured, errors}.
 */
export async function importDataset({upsertEntity,upsertCollectionEdition,getEntity,COLLECTIONS,reserved={},progress}){
  const validation=validateDataset(); const result={validation,written:{},skipped:{},ensured:{},errors:[]};
  if(!validation.valid)return result;
  const plan=plannedIds();
  for(const k of ["series","runs","issues","collections"]){const hit=plan[k].filter(id=>reserved[k]?.has(id)); if(hit.length){result.errors.push(`Refusing to write: ${hit.length} ${k} id(s) already belong to another dataset (e.g. ${hit[0]}). Nothing was written.`); return result;}}
  const say=(m)=>{try{progress&&progress(m);}catch(e){}};
  // every referenced existing issue must exist in the catalogue (code-level AND live) before anything is written
  say("Checking referenced issues in the existing catalogue…");
  const need=[...new Set(externalRefs.map(r=>r.issueId))]; const missing=[];
  for(const id of need){ if(!reserved.issues?.has(id)){missing.push(id);continue;} try{ if(!(await getEntity(COLLECTIONS.ISSUES,id)))missing.push(id); }catch(e){missing.push(id);} }
  if(missing.length){result.errors.push(`Cannot import yet: ${missing.length} referenced existing issue(s) are not in the catalogue (${missing.slice(0,3).join(", ")}). Import the earlier New 52 batches first. Nothing was written.`); return result;}
  const ensure=async(col,e)=>{try{if(await getEntity(col,e.id)){result.skipped[col]=(result.skipped[col]||0)+1;return;} await upsertEntity(col,e.id,e); result.ensured[col]=(result.ensured[col]||0)+1;}catch(err){result.errors.push(`${col}/${e.id}: ${err.message}`);}};
  say("Checking shared catalogue records…");
  await ensure(COLLECTIONS.UNIVERSES,universe); await ensure(COLLECTIONS.CONTINUITIES,continuity);
  // characters: an existing record owned by another dataset is never overwritten
  const own=async(col,list,resKey)=>{let n=0,sk=0; for(const e of list){if(reserved[resKey]?.has(e.id)){sk++;continue;} try{await upsertEntity(col,e.id,e);n++;}catch(err){result.errors.push(`${col}/${e.id}: ${err.message}`);}} result.written[col]=n; if(sk)result.skipped[col]=(result.skipped[col]||0)+sk;};
  if(characters.length){say("Writing characters…"); await own(COLLECTIONS.CHARACTERS,characters,"characters");} if(creators.length)await own(COLLECTIONS.CREATORS,creators,"creators");
  const all=async(col,list,fn,label)=>{say(`Writing ${label}…`); let n=0; for(const e of list){try{if(fn)await fn(e.id,e);else await upsertEntity(col,e.id,e);n++;}catch(err){result.errors.push(`${col}/${e.id}: ${err.message}`);}} result.written[col]=n;};
  await all(COLLECTIONS.SERIES,seriesList,null,"series"); await all(COLLECTIONS.ISSUES,issues,null,"issues"); await all(COLLECTIONS.COLLECTIONS,collections,upsertCollectionEdition,"collected editions");
  return result;
}
