// ============================================================================
// ALLABOUTDC — NEW 52 BATCH 1 (Justice League, Wonder Woman, Aquaman, Aquaman and The Others, Green Arrow)
// Isolated, additive import built from data-new52-batch1.js (the owner-supplied CSV). It writes ONLY those records:
//  - every write goes to a deterministic id, so re-running is idempotent;
//  - ids that belong to another dataset (Batman / Superman / Flash / Green Lantern) are reserved and refused;
//  - shared catalogue records (universe, continuity) are created only if absent.
// ============================================================================
import * as schema from "./schema.js";
import * as slug from "./slug.js";
import {B1_DESCRIPTIONS,B1_CHARACTERS,B1_CREATORS,B1_DEFS,B1_RUNS,B1_STATUS,B1_COLLECTION_RECORDS} from "./data-new52-batch1.js?v=b1";
const {makeUniverse,makeContinuity,makeCharacter,makeSeries,makeRun,makeIssue,makeCollection,makeCreator,makeSourceInfo,validateSeries,validateRun,validateIssue,validateCollection,validateCharacter,validateCreator}=schema;

const UNIVERSE_ID=slug.buildUniverseId("DC Universe"), CONTINUITY_ID=slug.buildContinuityId("The New 52");
const SRC_NAME="Owner-supplied New 52 Batch 1 CSV (updated with Forever Evil)";
const src=(notes)=>makeSourceInfo({sourceUrl:null,sourceName:SRC_NAME,sourceType:"other",verificationStatus:"verified",notes});
const isUrl=u=>/^https?:\/\//.test(u||"");
const srcType=u=>!isUrl(u)?"other":/dc\.com/.test(u)?"official":/crushingkrisis/.test(u)?"database":"other";

// ---- shared catalogue records (created only if missing) ----
const universe=makeUniverse({id:UNIVERSE_ID,name:"DC Universe",description:"The canonical DC Universe graph.",continuityIds:[CONTINUITY_ID],characterIds:[],sourceInfo:src("Created only if absent; an existing universe record is never modified by this import.")});
const continuity=makeContinuity({id:CONTINUITY_ID,name:"The New 52",shortName:"New 52",description:"Post-Flashpoint DC continuity/publication era.",universeId:UNIVERSE_ID,startDate:"2011-09",endDate:"2016-05",sourceInfo:src("Created only if absent; an existing continuity record is never modified by this import.")});
continuity.earthName="Prime Earth"; continuity.eraNote="Post-Flashpoint";

const characters=B1_CHARACTERS.map(c=>makeCharacter({id:slug.buildCharacterId(c.name),name:c.name,displayName:c.name,aliases:[],universeIds:[UNIVERSE_ID],continuityIds:[CONTINUITY_ID],browseRoot:!!c.root,parentCharacterId:c.parent?slug.buildCharacterId(c.parent):null,sourceInfo:src("Character named in the supplied Batch 1 series.")}));
const creators=B1_CREATORS.map(n=>makeCreator({id:slug.buildCreatorId(n),name:n,displayName:n,sourceInfo:src("Creator named in the supplied Batch 1 series notes.")}));
const creatorId=n=>slug.buildCreatorId(n);

const seriesList=[],seriesByTitle=new Map(),issues=[],runs=[],collections=[];
for(const [title,year,startDate,endDate,max,zeros,annuals,decimals,specials,lineCategory,charNames,creatorNames] of B1_DEFS){
  const id=slug.buildSeriesId(title,year);
  const s=makeSeries({id,title,publisher:"DC Comics",startDate,endDate,issueCount:max,universeId:UNIVERSE_ID,continuityIds:[CONTINUITY_ID],characterIds:charNames.map(n=>slug.buildCharacterId(n)),creatorIds:creatorNames.map(creatorId),description:B1_DESCRIPTIONS[title]||"",sourceInfo:src("Series scope exactly as supplied. issueCount is regular numbered issues only; #0, annuals, decimal issues and specials are separate publication units.")});
  Object.assign(s,{lineCategory,regularIssueCount:max,zeroIssueCount:zeros.length,annualCount:annuals.length,decimalIssueCount:decimals.length,specialCount:specials.length,scope:"batch1-new52"});
  seriesList.push(s); seriesByTitle.set(title,s);
  const add=(label,type="numbered")=>issues.push(makeIssue({id:slug.buildIssueId(id,label),seriesId:id,issueNumber:String(label).replace(/^#/,""),issueLabel:type==="numbered"?`#${label}`:String(label),issueLabelType:type,continuityId:CONTINUITY_ID,universeId:UNIVERSE_ID,characterIds:s.characterIds,creatorIds:s.creatorIds,sourceInfo:src("Publication unit within the supplied series scope.")}));
  zeros.forEach(x=>add(x,"special")); for(let n=1;n<=max;n++)add(String(n)); annuals.forEach(x=>add(x,"annual")); decimals.forEach(x=>add(x,"one_shot")); specials.forEach(x=>add(x,"special"));
}
// end-of-run status rows (e.g. Justice League #52 is not collected in a standard volume) are recorded on the issue itself
for(const st of B1_STATUS){const sr=seriesByTitle.get(st.series); const it=issues.find(i=>i.id===slug.buildIssueId(sr.id,st.label)); if(!it)throw new Error("status row for unknown issue "+st.label); it.collectionStatus=st.status; it.collectionStatusNote=st.note;}
for(const [stitle,runTitle,names,a,b] of B1_RUNS){const s=seriesByTitle.get(stitle); runs.push(makeRun({id:slug.buildRunId(s.id,runTitle),seriesId:s.id,title:runTitle,creatorIds:names.map(creatorId),startIssue:a,endIssue:b,sourceInfo:src("Run boundaries from the supplied series notes.")}));}

const covRow=(s,label,partial)=>({seriesId:s.id,issueId:slug.buildIssueId(s.id,label),issueLabel:/^Annual/.test(label)||/\./.test(label)||/[A-Za-z]/.test(label)?label:`#${label}`,coveragePart:partial?"partial":"complete"});
for(const r of B1_COLLECTION_RECORDS){
  const rows=[],sids=[...(r.ss||[]).map(t=>{const x=seriesByTitle.get(t); if(!x)throw new Error(`Collection ${r.id}: unknown series ${t}`); return x.id;})];
  for(const [st,labels,partial=[]] of r.cov){const s=seriesByTitle.get(st); if(!s)throw new Error(`Collection ${r.id}: unknown series ${st}`); if(!sids.includes(s.id))sids.push(s.id); labels.forEach(l=>rows.push(covRow(s,String(l),partial.includes(l))));}
  const ps=r.ps?seriesByTitle.get(r.ps):null;
  const verified=r.cv==="verified";
  const c=makeCollection({id:r.id,title:r.t,publisher:"DC Comics",format:r.f,publicationDate:null,isbn:r.isbn13||null,pageCount:null,seriesIds:sids,issueCoverage:rows,editionInfo:{editionNumber:null,editionName:null,printing:null},sourceInfo:makeSourceInfo({sourceUrl:isUrl(r.src[0])?r.src[0]:null,sourceName:SRC_NAME+(r.src[0]&&!isUrl(r.src[0])?` — ${r.src[0]}`:""),sourceType:srcType(r.src[0]),verificationStatus:verified?"verified":"partially_verified",notes:r.an||""})});
  Object.assign(c,{primarySeriesId:ps?ps.id:null,sequence:r.seq,volume:r.v,isbn10:null,priceUSD:null,outOfScopeContents:r.oos||null,reprints:[],sources:r.src,reviewStatus:null,auditClass:null,crossover:r.rl==="crossover"||!!r.x,role:r.rl,csvRole:r.csvrole||null,coverageNote:r.cn||null,dataBasis:"owner_csv_verified"});
  collections.push(c);
}

export const dataset={universes:[universe],continuities:[continuity],characters,series:seriesList,runs,issues,collections,creators};

export function validateDataset(){
  const errors=[]; const ids={};
  const checks=[["character",characters,validateCharacter],["series",seriesList,validateSeries],["run",runs,validateRun],["issue",issues,validateIssue],["collection",collections,validateCollection],["creator",creators,validateCreator]];
  for(const [name,list,fn] of checks){ids[name]=new Set(); for(const e of list){const v=fn(e); if(!v.valid)errors.push(`[${name}/${e.id}] ${v.errors.join("; ")}`); if(ids[name].has(e.id))errors.push(`Duplicate ${name}: ${e.id}`); ids[name].add(e.id);}}
  for(const s of seriesList){for(const id of s.characterIds)if(!ids.character.has(id))errors.push(`Series ${s.id} missing character ${id}`);}
  for(const c of collections){for(const row of c.issueCoverage){if(!ids.issue.has(row.issueId))errors.push(`Collection ${c.id} references unknown issue ${row.issueId}`);}}
  for(const s of seriesList){const nums=issues.filter(i=>i.seriesId===s.id&&i.issueLabelType==="numbered").map(i=>Number(i.issueNumber)).sort((a,b)=>a-b); if(JSON.stringify(nums)!==JSON.stringify(Array.from({length:s.issueCount},(_,i)=>i+1)))errors.push(`Series ${s.id}: numbered issues do not equal 1..${s.issueCount}`);}
  // modelling rules from the brief
  const sid=t=>seriesByTitle.get(t)?.id; const vols=(t,f)=>collections.filter(c=>c.primarySeriesId===sid(t)&&c.role==="mainline"&&c.format===f&&/Vol\./.test(c.title)).length;
  for(const [t,f,n] of [["Justice League","HC/TPB",8],["Wonder Woman","HC/TPB",9],["Aquaman","HC/TPB",7],["Aquaman and The Others","TPB",2],["Green Arrow","TPB",9]])if(vols(t,f)!==n)errors.push(`${t}: expected ${n} ${f} volumes, found ${vols(t,f)}`);
  for(const c of collections){if(c.role==="anthology"&&c.primarySeriesId)errors.push(`${c.id}: a global anthology must not have a primary series`); if(c.role==="mainline"&&!c.primarySeriesId)errors.push(`${c.id}: a mainline volume needs a primary series`);}
  const cov=(cid,series,label)=>!!collections.find(c=>c.id===cid)?.issueCoverage.some(r=>r.seriesId===sid(series)&&r.issueLabel===label);
  const need=(ok,msg)=>{if(!ok)errors.push(msg);};
  need(!cov("justice-league-vol-4-the-grid","Justice League","#21")&&cov("justice-league-vol-4-the-grid","Justice League","#22"),"JL Vol. 4 is #18-20 and #22-23 (no #21)");
  need(cov("aquaman-vol-5-sea-of-storms-hardcover","Aquaman","#32")&&cov("aquaman-vol-6-maelstrom","Aquaman","#32")&&!cov("aquaman-vol-5-sea-of-storms-trade-paperback","Aquaman","#32"),"Aquaman #32 is in Vol. 5 HC and Vol. 6, not in the Vol. 5 TPB");
  need(cov("aquaman-vol-5-sea-of-storms-trade-paperback","Aquaman","Annual 2")&&cov("aquaman-vol-5-sea-of-storms-hardcover","Aquaman","Annual 2"),"Both Aquaman Vol. 5 variants include Annual #2");
  need(/Swamp Thing #32/.test(collections.find(c=>c.id==="aquaman-vol-5-sea-of-storms-trade-paperback")?.outOfScopeContents||""),"Aquaman Vol. 5 TPB carries Swamp Thing #32 as out-of-scope text");
  need(collections.find(c=>c.id==="aquaman-vol-5-sea-of-storms-trade-paperback")?.isbn==="9781401254407","Aquaman Vol. 5 TPB ISBN 9781401254407");
  need(!cov("wonder-woman-vol-7-war-torn","Wonder Woman","#26")&&cov("wonder-woman-vol-7-war-torn","Wonder Woman","Annual 1")&&cov("wonder-woman-vol-7-war-torn","Wonder Woman","#36"),"WW Vol. 7 is #36-40 + Annual #1 (not #26-40)");
  need(!issues.some(i=>/Rebirth/i.test(i.issueLabel)),"Rebirth #1 must not be a New 52 issue");
  need(cov("green-arrow-vol-3-harrow","Justice League","#8"),"GA Vol. 3 references the existing Justice League #8 issue");
  need(/Savage Hawkman #14/.test(collections.find(c=>c.id==="green-arrow-vol-3-harrow")?.outOfScopeContents||"")&&!cov("green-arrow-vol-3-harrow","Green Arrow","#14")===false,"GA Vol. 3 keeps Savage Hawkman #14 as text and Green Arrow #14 as an issue");
  need(collections.filter(c=>/Villains Omnibus/.test(c.title)).length===4,"four Villains Omnibus slices (JL, WW, Aquaman, GA)");
  need(issues.find(i=>i.id===slug.buildIssueId(sid("Justice League"),"52"))?.collectionStatus==="end of run","JL #52 end-of-run status");
  const fe=collections.find(c=>c.id==="forever-evil-hc");
  need(!!fe&&fe.role==="crossover"&&fe.issueCoverage.length===0&&fe.outOfScopeContents==="Forever Evil #1-7"&&fe.seriesIds.includes(sid("Justice League")),"Forever Evil HC is a publication record (Forever Evil #1-7 kept as text, no issue records)");
  need(JSON.stringify(collections.find(c=>c.id==="justice-league-vol-5-forever-heroes")?.issueCoverage.map(r=>r.issueLabel))===JSON.stringify(["#24","#25","#26","#27","#28","#29"]),"JL Vol. 5 Forever Heroes stays JL #24-29");
  need(!issues.some(i=>/Forever Evil/i.test(i.seriesId)),"no Forever Evil series/issue records");
  return {valid:errors.length===0,errors};
}

/** ids this dataset would write, per kind — used to refuse collisions with another dataset. */
export function plannedIds(){return {characters:characters.map(x=>x.id),creators:creators.map(x=>x.id),series:seriesList.map(x=>x.id),runs:runs.map(x=>x.id),issues:issues.map(x=>x.id),collections:collections.map(x=>x.id)};}

/**
 * Additive import. `reserved` = {characters,creators,series,runs,issues,collections: Set<id>} owned by other datasets.
 * Nothing is deleted. Returns {validation, written, skipped, ensured, errors}.
 */
export async function importDataset({upsertEntity,upsertCollectionEdition,getEntity,patchEntity,COLLECTIONS,reserved={},progress}){
  const validation=validateDataset(); const result={validation,written:{},skipped:{},ensured:{},errors:[]};
  if(!validation.valid)return result;
  const plan=plannedIds();
  // series / runs / issues / collections must be entirely ours — any collision aborts BEFORE any write.
  for(const k of ["series","runs","issues","collections"]){const hit=plan[k].filter(id=>reserved[k]?.has(id)); if(hit.length){result.errors.push(`Refusing to write: ${hit.length} ${k} id(s) already belong to another dataset (e.g. ${hit[0]}). Nothing was written.`); return result;}}
  const say=(m)=>{try{progress&&progress(m);}catch(e){}};
  const ensure=async(col,e)=>{ // create only if absent
    try{if(await getEntity(col,e.id)){result.skipped[col]=(result.skipped[col]||0)+1;return;} await upsertEntity(col,e.id,e); result.ensured[col]=(result.ensured[col]||0)+1;}catch(err){result.errors.push(`${col}/${e.id}: ${err.message}`);}};
  say("Checking shared catalogue records…");
  await ensure(COLLECTIONS.UNIVERSES,universe); await ensure(COLLECTIONS.CONTINUITIES,continuity);
  // characters / creators: another dataset's record is never overwritten; our own are refreshed
  const own=async(col,list,resKey)=>{let n=0,sk=0; for(const e of list){if(reserved[resKey]?.has(e.id)){sk++;continue;} try{await upsertEntity(col,e.id,e);n++;}catch(err){result.errors.push(`${col}/${e.id}: ${err.message}`);}} result.written[col]=n; if(sk)result.skipped[col]=(result.skipped[col]||0)+sk;};
  say("Writing characters and creators…"); await own(COLLECTIONS.CHARACTERS,characters,"characters"); await own(COLLECTIONS.CREATORS,creators,"creators");
  // A catalogue root that another dataset already owns (Wonder Woman: written non-root by the Superman seed) is never overwritten —
  // only its single browseRoot field is patched so it appears as a top-level character. Nothing else on that record changes.
  for(const c of characters){ if(!c.browseRoot||!reserved.characters?.has(c.id)||!patchEntity)continue;
    try{const ex=await getEntity(COLLECTIONS.CHARACTERS,c.id); if(ex&&ex.browseRoot!==true){await patchEntity(COLLECTIONS.CHARACTERS,c.id,{browseRoot:true}); (result.rootsPromoted=result.rootsPromoted||[]).push(c.id);}}catch(err){result.errors.push(`characters/${c.id} (browseRoot): ${err.message}`);} }
  const all=async(col,list,fn,label)=>{say(`Writing ${label}…`); let n=0; for(const e of list){try{if(fn)await fn(e.id,e);else await upsertEntity(col,e.id,e);n++;}catch(err){result.errors.push(`${col}/${e.id}: ${err.message}`);}} result.written[col]=n;};
  await all(COLLECTIONS.SERIES,seriesList,null,"series"); await all(COLLECTIONS.RUNS,runs,null,"runs"); await all(COLLECTIONS.ISSUES,issues,null,"issues"); await all(COLLECTIONS.COLLECTIONS,collections,upsertCollectionEdition,"collected editions");
  return result;
}
