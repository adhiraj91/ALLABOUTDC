// ============================================================================
// ALLABOUTDC — NEW 52 FLASH + GREEN LANTERN (isolated, additive import)
// Builds records from data-new52-flash-gl.js and writes ONLY those records.
// Never clears, truncates or overwrites anything it did not build itself:
//  - every write goes to a deterministic id, so re-running is idempotent;
//  - ids that belong to another dataset (Batman / Superman) are reserved and refused;
//  - shared catalogue records (universe, continuity) are created only if absent.
// ============================================================================
import * as schema from "./schema.js";
import * as slug from "./slug.js";
import {FG_DESCRIPTIONS,FG_CHARACTERS,FG_CREATORS,FG_DEFS,FG_RUNS,FG_SPLIT_ISSUES,FG_COLLECTION_RECORDS} from "./data-new52-flash-gl.js?v=dc1";
const {makeUniverse,makeContinuity,makeCharacter,makeSeries,makeRun,makeIssue,makeCollection,makeCreator,makeSourceInfo,validateSeries,validateRun,validateIssue,validateCollection,validateCharacter,validateCreator}=schema;

const UNIVERSE_ID=slug.buildUniverseId("DC Universe"), CONTINUITY_ID=slug.buildContinuityId("The New 52");
const SRC_NAME="Owner-supplied verified New 52 Flash + Green Lantern CSV";
const src=(notes)=>makeSourceInfo({sourceUrl:null,sourceName:SRC_NAME,sourceType:"other",verificationStatus:"verified",notes});
const srcType=u=>/dc\.com/.test(u||"")?"official":/crushingkrisis/.test(u||"")?"database":"other";

// ---- shared catalogue records (created only if missing) ----
const universe=makeUniverse({id:UNIVERSE_ID,name:"DC Universe",description:"The canonical DC Universe graph.",continuityIds:[CONTINUITY_ID],characterIds:[],sourceInfo:src("Created only if absent; an existing universe record is never modified by this import.")});
const continuity=makeContinuity({id:CONTINUITY_ID,name:"The New 52",shortName:"New 52",description:"Post-Flashpoint DC continuity/publication era.",universeId:UNIVERSE_ID,startDate:"2011-09",endDate:"2016-05",sourceInfo:src("Created only if absent; an existing continuity record is never modified by this import.")});
continuity.earthName="Prime Earth"; continuity.eraNote="Post-Flashpoint";

const characters=FG_CHARACTERS.map(c=>makeCharacter({id:slug.buildCharacterId(c.name),name:c.name,displayName:c.name,aliases:[],universeIds:[UNIVERSE_ID],continuityIds:[CONTINUITY_ID],browseRoot:!!c.root,parentCharacterId:c.parent?slug.buildCharacterId(c.parent):null,sourceInfo:src("Character named in the supplied Flash / Green Lantern series notes.")}));
const creators=FG_CREATORS.map(n=>makeCreator({id:slug.buildCreatorId(n),name:n,displayName:n,sourceInfo:src("Creator named in the supplied Flash / Green Lantern series notes.")}));
const creatorId=n=>slug.buildCreatorId(n);

const seriesList=[],seriesByTitle=new Map(),issues=[],runs=[],collections=[];
for(const [title,year,startDate,endDate,max,zeros,annuals,decimals,specials,lineCategory,charNames,creatorNames] of FG_DEFS){
  const id=slug.buildSeriesId(title,year);
  const s=makeSeries({id,title,publisher:"DC Comics",startDate,endDate,issueCount:max,universeId:UNIVERSE_ID,continuityIds:[CONTINUITY_ID],characterIds:charNames.map(n=>slug.buildCharacterId(n)),creatorIds:creatorNames.map(creatorId),description:FG_DESCRIPTIONS[title]||"",sourceInfo:src("Series scope exactly as supplied. issueCount is regular numbered issues only; #0, annuals, decimal issues and specials are separate publication units.")});
  Object.assign(s,{lineCategory,regularIssueCount:max,zeroIssueCount:zeros.length,annualCount:annuals.length,decimalIssueCount:decimals.length,specialCount:specials.length,scope:"flash-gl-new52"});
  seriesList.push(s); seriesByTitle.set(title,s);
  const add=(label,type="numbered")=>issues.push(makeIssue({id:slug.buildIssueId(id,label),seriesId:id,issueNumber:String(label).replace(/^#/,""),issueLabel:type==="numbered"?`#${label}`:String(label),issueLabelType:type,continuityId:CONTINUITY_ID,universeId:UNIVERSE_ID,characterIds:s.characterIds,creatorIds:s.creatorIds,sourceInfo:src("Publication unit within the supplied series scope.")}));
  zeros.forEach(x=>add(x,"special")); for(let n=1;n<=max;n++)add(String(n)); annuals.forEach(x=>add(x,"annual")); decimals.forEach(x=>add(x,"one_shot")); specials.forEach(x=>add(x,"special"));
}
// the split issue stays two linked units, flagged — never a plain duplicate
for(const [stitle,labels] of Object.entries(FG_SPLIT_ISSUES.units)){const s=seriesByTitle.get(stitle); for(const l of labels){const it=issues.find(i=>i.id===slug.buildIssueId(s.id,l)); it.splitIssue=true; it.title=`Split issue: ${FG_SPLIT_ISSUES.label}`;}}
for(const [stitle,runTitle,names,a,b] of FG_RUNS){const s=seriesByTitle.get(stitle); runs.push(makeRun({id:slug.buildRunId(s.id,runTitle),seriesId:s.id,title:runTitle,creatorIds:names.map(creatorId),startIssue:a,endIssue:b,sourceInfo:src("Run boundaries from the supplied series notes.")}));}

const covRow=(s,label,partial)=>({seriesId:s.id,issueId:slug.buildIssueId(s.id,label),issueLabel:/^Annual/.test(label)||/\./.test(label)||/[A-Za-z]/.test(label)?label:`#${label}`,coveragePart:partial?"partial":"complete"});
for(const r of FG_COLLECTION_RECORDS){
  const rows=[],sids=[];
  for(const [st,labels,partial=[]] of r.cov){const s=seriesByTitle.get(st); if(!s)throw new Error(`Collection ${r.id}: unknown series ${st}`); if(!sids.includes(s.id))sids.push(s.id); labels.forEach(l=>rows.push(covRow(s,String(l),partial.includes(l))));}
  const ps=r.ps?seriesByTitle.get(r.ps):null;
  const verified=r.cv==="verified";
  const c=makeCollection({id:r.id,title:r.t,publisher:"DC Comics",format:r.f,publicationDate:null,isbn:null,pageCount:null,seriesIds:sids,issueCoverage:rows,editionInfo:{editionNumber:null,editionName:null,printing:null},sourceInfo:makeSourceInfo({sourceUrl:r.src[0]||null,sourceName:SRC_NAME,sourceType:r.src[0]?srcType(r.src[0]):"other",verificationStatus:verified?"verified":"partially_verified",notes:r.an||""})});
  Object.assign(c,{primarySeriesId:ps?ps.id:null,sequence:r.seq,volume:r.v,isbn10:null,priceUSD:null,outOfScopeContents:r.oos||null,reprints:[],sources:r.src,reviewStatus:null,auditClass:null,crossover:r.rl==="crossover",role:r.rl,coverageNote:r.cn||null,dataBasis:"owner_csv_verified"});
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
  const sid=t=>seriesByTitle.get(t)?.id; const mainline=(t,f)=>collections.filter(c=>c.primarySeriesId===sid(t)&&c.role==="mainline"&&c.format===f).length;
  for(const [t,f,n] of [["The Flash","HC/TPB",9],["Green Lantern","HC/TPB",8],["Green Lantern Corps","HC/TPB",6],["Green Lantern: New Guardians","HC/TPB",6],["Red Lanterns","TPB",6],["Larfleeze","TPB",2],["Sinestro","TPB",4]])if(mainline(t,f)!==n)errors.push(`${t}: expected ${n} mainline ${f} volumes, found ${mainline(t,f)}`);
  for(const c of collections){if(c.role==="anthology"&&c.primarySeriesId)errors.push(`${c.id}: a global anthology must not have a primary series`); if(c.role==="mainline"&&!c.primarySeriesId)errors.push(`${c.id}: a mainline volume needs a primary series`);}
  const has=(cid,series,label)=>!!collections.find(c=>c.id===cid)?.issueCoverage.some(r=>r.seriesId===sid(series)&&r.issueLabel===label);
  if(!has("green-lantern-vol-5-test-of-wills","Green Lantern Corps","#31"))errors.push("GL Vol. 5 must include Green Lantern Corps #31-33");
  if(has("green-lantern-new-guardians-vol-5-godkillers","Green Lantern: New Guardians","Annual 2"))errors.push("New Guardians Vol. 5 must not include Annual #2");
  const lf=collections.find(c=>c.id==="larfleeze-vol-1-revolt-of-the-orange-lanterns"); if(lf?.issueCoverage.filter(r=>r.seriesId===sid("Larfleeze")).length!==5)errors.push("Larfleeze Vol. 1 must contain Larfleeze #1-5 only");
  return {valid:errors.length===0,errors};
}

/** ids this dataset would write, per kind — used to refuse collisions with another dataset. */
export function plannedIds(){return {characters:characters.map(x=>x.id),creators:creators.map(x=>x.id),series:seriesList.map(x=>x.id),runs:runs.map(x=>x.id),issues:issues.map(x=>x.id),collections:collections.map(x=>x.id)};}

/**
 * Additive import. `reserved` = {characters,creators,series,runs,issues,collections: Set<id>} owned by other datasets.
 * Nothing is deleted. Returns {validation, written, skipped, ensured, errors}.
 */
export async function importDataset({upsertEntity,upsertCollectionEdition,getEntity,COLLECTIONS,reserved={},progress}){
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
  const all=async(col,list,fn,label)=>{say(`Writing ${label}…`); let n=0; for(const e of list){try{if(fn)await fn(e.id,e);else await upsertEntity(col,e.id,e);n++;}catch(err){result.errors.push(`${col}/${e.id}: ${err.message}`);}} result.written[col]=n;};
  await all(COLLECTIONS.SERIES,seriesList,null,"series"); await all(COLLECTIONS.RUNS,runs,null,"runs"); await all(COLLECTIONS.ISSUES,issues,null,"issues"); await all(COLLECTIONS.COLLECTIONS,collections,upsertCollectionEdition,"collected editions");
  return result;
}
