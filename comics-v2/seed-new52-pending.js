// ============================================================================
// ALLABOUTDC — NEW 52 PENDING MASTER BATCH (34 series: DC Universe Presents, Katana, Secret Origins, Harley Quinn, Static Shock, The Ravagers, All-Star Western,
// Blackhawks, G.I. Combat, Grifter, Infinity Man and the Forever People, Lobo, Men of War, New Suicide Squad, O.M.A.C., Secret Six, G.I. Zombie, Stormwatch, Team 7,
// The Green Team, The Movement, Voodoo, Demon Knights, Dial H, Klarion, Sword of Sorcery, Trinity of Sin, JLA (2015), Black Canary, Constantine: The Hellblazer,
// Doctor Fate, Earth 2: Society, Midnighter, Starfire). Isolated, additive import built from data-new52-pending.js (the owner-supplied pending master CSV):
//  - canonical series ids come from the CSV; every write goes to a deterministic id, so re-running is idempotent;
//  - ids owned by every earlier dataset are reserved and refused (a collision aborts before any write);
//  - issues of series that ALREADY exist (Justice League #23.3, Red Lanterns #10, Gotham Academy #17) are referenced by their existing id — never copied, and verified to exist first;
//  - issue units = the CSV issue_range + annuals only; anything else named in a collection mapping is kept as text (outOfScopeContents), never invented as an issue;
//  - no characters or creators are created (the CSV supplies none), so no series can become an accidental top-level root.
// The two RUN-AUDIT rows (Deathstroke 2014, Teen Titans 2014) are NOT imported here — see the report: their issue numbers restart inside series that already hold #1-6 / #1-8.
// ============================================================================
import * as schema from "./schema.js";
import * as slug from "./slug.js";
import {P_SERIES,P_DESCRIPTIONS,P_EXTERNAL,P_COLLECTIONS} from "./data-new52-pending.js?v=p1";
const {makeUniverse,makeContinuity,makeCharacter,makeSeries,makeRun,makeIssue,makeCollection,makeCreator,makeSourceInfo,validateSeries,validateRun,validateIssue,validateCollection,validateCharacter,validateCreator}=schema;

const UNIVERSE_ID=slug.buildUniverseId("DC Universe"), CONTINUITY_ID=slug.buildContinuityId("The New 52");
const SRC_NAME="Owner-supplied New 52 pending master CSV";
const src=(notes)=>makeSourceInfo({sourceUrl:null,sourceName:SRC_NAME,sourceType:"other",verificationStatus:"verified",notes});
const isUrl=u=>/^https?:\/\//.test(u||"");
const srcType=u=>!isUrl(u)?"other":/dc\.com/.test(u)?"official":/crushingkrisis/.test(u)?"database":"other";

const universe=makeUniverse({id:UNIVERSE_ID,name:"DC Universe",description:"The canonical DC Universe graph.",continuityIds:[CONTINUITY_ID],characterIds:[],sourceInfo:src("Created only if absent; an existing universe record is never modified by this import.")});
const continuity=makeContinuity({id:CONTINUITY_ID,name:"The New 52",shortName:"New 52",description:"Post-Flashpoint DC continuity/publication era.",universeId:UNIVERSE_ID,startDate:"2011-09",endDate:"2016-05",sourceInfo:src("Created only if absent; an existing continuity record is never modified by this import.")});
continuity.earthName="Prime Earth"; continuity.eraNote="Post-Flashpoint";

const characters=[];
const creators=[];

const seriesList=[],seriesById=new Map(),issues=[],runs=[],collections=[];
for(const [id,title,categoryKey,max,zero,annuals,lineCategory,anthology,scope] of P_SERIES){
  const s=makeSeries({id,title,publisher:"DC Comics",startDate:null,endDate:null,issueCount:max,universeId:UNIVERSE_ID,continuityIds:[CONTINUITY_ID],characterIds:[],creatorIds:[],description:P_DESCRIPTIONS[id]||"",sourceInfo:src("Series scope exactly as supplied (issue_range + annuals). issueCount is regular numbered issues only.")});
  Object.assign(s,{categoryKey,lineCategory,regularIssueCount:max,zeroIssueCount:zero?1:0,annualCount:annuals.length,decimalIssueCount:0,specialCount:0,scope:"pending-"+scope});
  if(anthology){s.anthology=true;}
  seriesList.push(s); seriesById.set(id,s);
  const add=(label,type="numbered")=>issues.push(makeIssue({id:slug.buildIssueId(id,label),seriesId:id,issueNumber:String(label).replace(/^#/,""),issueLabel:type==="numbered"?`#${label}`:String(label),issueLabelType:type,continuityId:CONTINUITY_ID,universeId:UNIVERSE_ID,characterIds:[],creatorIds:[],sourceInfo:src("Publication unit within the supplied series scope.")}));
  if(zero)add("0","special"); for(let n=1;n<=max;n++)add(String(n)); annuals.forEach(x=>add(x,"annual"));
}

const labelOf=(label)=>/^Annual/.test(label)||/\./.test(label)||/[A-Za-z]/.test(label)?label:`#${label}`;
const EXT_IDS=new Set(Object.values(P_EXTERNAL));
/** external references (series already in the catalogue): [{collectionId,seriesId,issueId,issueLabel}] */
const externalRefs=[];
for(const r of P_COLLECTIONS){
  const id=slug.buildCollectionId(r.t),rows=[],sids=[r.ps];
  for(const [sid,labels] of r.cov){
    const own=seriesById.has(sid);
    if(!own&&!EXT_IDS.has(sid))throw new Error(`Collection ${id}: unknown series ${sid}`);
    if(!sids.includes(sid))sids.push(sid);
    labels.forEach(l=>{const row={seriesId:sid,issueId:slug.buildIssueId(sid,String(l)),issueLabel:labelOf(String(l)),coveragePart:"complete"}; rows.push(row); if(!own)externalRefs.push({collectionId:id,...row});});
  }
  const c=makeCollection({id,title:r.t,publisher:"DC Comics",format:"Other",publicationDate:null,isbn:null,pageCount:null,seriesIds:sids,issueCoverage:rows,editionInfo:{editionNumber:null,editionName:null,printing:null},sourceInfo:src("Collection mapping exactly as supplied in verified_collection_mapping. No ISBN, format or date was supplied, so none is recorded.")});
  Object.assign(c,{primarySeriesId:r.ps,sequence:r.seq,volume:r.v,isbn10:null,priceUSD:null,outOfScopeContents:r.oos||null,reprints:[],sources:[],reviewStatus:null,auditClass:null,crossover:false,role:"mainline",csvRole:null,coverageNote:r.cn?`Source note: ${r.cn}.${r.oos&&/Secret Six/.test(r.oos)?" Only #1-2 are recorded as issues in this catalogue.":""}`:null,dataBasis:"owner_csv_verified"});
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
  const need=(ok,msg)=>{if(!ok)errors.push(msg);};
  const KEYS=["batman","justice-league","green-arrow","titans-young-heroes","suicide-squad","magic-supernatural","deathstroke-assassins","earth-2","other-dc-heroes","wildstorm","all-star-western","war-military","cosmic-fourth-world"];
  const S=id=>seriesById.get(id); const col=t=>collections.find(c=>c.title===t);
  need(seriesList.length===34,"34 series");
  need(seriesList.every(s=>KEYS.includes(s.categoryKey)&&s.categoryKey!=="other-obscure"),"every series carries a CSV category key (none falls into other-obscure)");
  need(S("dc-universe-presents-2011")?.categoryKey==="other-dc-heroes"&&S("dc-universe-presents-2011").anthology===true&&S("secret-origins-2014")?.anthology===true,"DC Universe Presents is Other DC Heroes; both anthologies are flagged");
  need(["war-military"].every(k=>seriesList.filter(s=>s.categoryKey===k).length===4)&&seriesList.filter(s=>s.categoryKey==="cosmic-fourth-world").length===1,"War & Military 4 series, Cosmic & Fourth World 1 series");
  need(S("trinity-of-sin-2014")&&S("justice-league-of-america-2015")&&S("constantine-the-hellblazer-2015")&&S("earth-2-society-2015")&&S("new-suicide-squad-2014")&&S("secret-six-2014"),"distinct series ids kept separate from their namesakes");
  need(!seriesList.some(s=>/^(deathstroke|teen-titans)-/.test(s.id)),"no Deathstroke / Teen Titans series is created (RUN-AUDIT rows are not imported)");
  const n=(id)=>issues.filter(i=>i.seriesId===id).length;
  need(n("harley-quinn-2013")===18&&!issues.some(i=>i.seriesId==="harley-quinn-2013"&&i.issueNumber==="17"),"Harley Quinn = #0-16 + Annual #1 only (no DC You #17)");
  need(n("lobo-2014")===6&&n("new-suicide-squad-2014")===8&&n("secret-six-2014")===2,"Lobo #1-6, New Suicide Squad #1-8, Secret Six #1-2 only");
  need(issues.some(i=>i.id==="earth-2-society-2015-007")&&!collections.some(c=>c.issueCoverage.some(r=>r.issueId==="earth-2-society-2015-007")),"Earth 2: Society #7 exists as an issue even though no collection covers it");
  need(col("Earth 2: Society Vol. 3: A Whole New World").issueCoverage.some(r=>r.issueLabel==="Annual 1"),"Earth 2: Society Vol. 3 includes Annual #1");
  need(col("Dial H Vol. 2: Exchange").issueCoverage.some(r=>r.issueId==="justice-league-2011-23-3"),"Dial H Vol. 2 keeps the Justice League #23.3 (Dial E) relationship");
  need(col("Stormwatch Vol. 2: Enemies of Earth").issueCoverage.some(r=>r.issueId==="red-lanterns-010"),"Stormwatch Vol. 2 keeps Red Lanterns #10");
  need(col("Harley Quinn Vol. 2: Power Outage").issueCoverage.some(r=>r.issueId==="secret-origins-2014-004")&&/Futures End #1/.test(col("Harley Quinn Vol. 2: Power Outage").outOfScopeContents),"Harley Vol. 2 = #9-13 + Secret Origins #4 (real issue) + Futures End #1 (text)");
  need(/#3-6/.test(col("Secret Six Vol. 1: Friends in Low Places").outOfScopeContents||"")&&col("Secret Six Vol. 1: Friends in Low Places").issueCoverage.length===2,"Secret Six Vol. 1: #1-2 as issues, #3-6 kept as text");
  need(!collections.some(c=>c.isbn)&&collections.every(c=>c.format==="Other"),"no ISBN or format invented");
  need(collections.every(c=>c.primarySeriesId&&seriesById.has(c.primarySeriesId)),"every collection has an own primary series");
  need(!collections.some(c=>/Sword of Sorcery/.test(c.title)||c.primarySeriesId==="jla-2015"||c.primarySeriesId==="justice-league-of-america-2015"),"no collection for Sword of Sorcery or JLA (2015) (none verified in the CSV)");
  return {valid:errors.length===0,errors};
}

export function plannedIds(){return {characters:characters.map(x=>x.id),creators:creators.map(x=>x.id),series:seriesList.map(x=>x.id),runs:runs.map(x=>x.id),issues:issues.map(x=>x.id),collections:collections.map(x=>x.id)};}

/**
 * One collection of this CSV already exists as a PARTIAL record written by the Batman dataset: the Gotham Academy #17 stub of "Black Canary Vol. 2: New Killer Star"
 * (it was primary-series Gotham Academy only because Black Canary was out of scope then). The CSV now supplies the full verified mapping, so the existing record is
 * COMPLETED, not duplicated: its verified ISBN / price / date / sources / format are kept, and only series ownership, coverage and out-of-scope text are updated.
 */
const ADOPT={"black-canary-vol-2-new-killer-star":"gotham-academy-2014"};
/**
 * Additive import. `reserved` = {characters,creators,series,runs,issues,collections: Set<id>} owned by other datasets
 * (it must also contain the ids of the existing series/issues that collections reference).
 * Nothing is deleted. Returns {validation, written, skipped, ensured, errors}.
 */
export async function importDataset({upsertEntity,upsertCollectionEdition,getEntity,COLLECTIONS,reserved={},progress}){
  const validation=validateDataset(); const result={validation,written:{},skipped:{},ensured:{},errors:[]};
  if(!validation.valid)return result;
  const plan=plannedIds();
  for(const k of ["series","runs","issues","collections"]){const hit=plan[k].filter(id=>reserved[k]?.has(id)&&!(k==="collections"&&ADOPT[id])); if(hit.length){result.errors.push(`Refusing to write: ${hit.length} ${k} id(s) already belong to another dataset (e.g. ${hit[0]}). Nothing was written.`); return result;}}
  const say=(m)=>{try{progress&&progress(m);}catch(e){}};
  // every referenced existing issue must exist in the catalogue (code-level AND live) before anything is written
  say("Checking referenced issues in the existing catalogue…");
  const need=[...new Set(externalRefs.map(r=>r.issueId))]; const missing=[];
  for(const id of need){ if(!reserved.issues?.has(id)){missing.push(id);continue;} try{ if(!(await getEntity(COLLECTIONS.ISSUES,id)))missing.push(id); }catch(e){missing.push(id);} }
  if(missing.length){result.errors.push(`Cannot import yet: ${missing.length} referenced existing issue(s) are not in the catalogue (${missing.slice(0,3).join(", ")}). Import Batches 1 and 2 first. Nothing was written.`); return result;}
  const ensure=async(col,e)=>{try{if(await getEntity(col,e.id)){result.skipped[col]=(result.skipped[col]||0)+1;return;} await upsertEntity(col,e.id,e); result.ensured[col]=(result.ensured[col]||0)+1;}catch(err){result.errors.push(`${col}/${e.id}: ${err.message}`);}};
  say("Checking shared catalogue records…");
  await ensure(COLLECTIONS.UNIVERSES,universe); await ensure(COLLECTIONS.CONTINUITIES,continuity);
  // characters: an existing record owned by another dataset is never overwritten
  const own=async(col,list,resKey)=>{let n=0,sk=0; for(const e of list){if(reserved[resKey]?.has(e.id)){sk++;continue;} try{await upsertEntity(col,e.id,e);n++;}catch(err){result.errors.push(`${col}/${e.id}: ${err.message}`);}} result.written[col]=n; if(sk)result.skipped[col]=(result.skipped[col]||0)+sk;};
  if(characters.length){say("Writing characters…"); await own(COLLECTIONS.CHARACTERS,characters,"characters");} if(creators.length)await own(COLLECTIONS.CREATORS,creators,"creators");
  const all=async(col,list,fn,label)=>{say(`Writing ${label}…`); let n=0; for(const e of list){try{if(fn)await fn(e.id,e);else await upsertEntity(col,e.id,e);n++;}catch(err){result.errors.push(`${col}/${e.id}: ${err.message}`);}} result.written[col]=n;};
  // adopt (complete) the partial Black Canary Vol. 2 record instead of duplicating it
  const toWrite=[]; 
  for(const c of collections){
    const from=ADOPT[c.id]; if(!from){toWrite.push(c);continue;}
    let ex=null; try{ex=await getEntity(COLLECTIONS.COLLECTIONS,c.id);}catch(e){}
    if(ex&&ex.primarySeriesId!==from&&ex.primarySeriesId!==c.primarySeriesId){result.errors.push(`Refusing to write: ${c.id} exists with an unexpected primary series (${ex.primarySeriesId}). Nothing was written.`);return result;}
    if(!ex){toWrite.push(c);continue;}
    const keep={format:ex.format,publicationDate:ex.publicationDate,isbn:ex.isbn,isbn10:ex.isbn10,pageCount:ex.pageCount,priceUSD:ex.priceUSD,sources:ex.sources,editionInfo:ex.editionInfo,coverImage:ex.coverImage};
    const done=ex.primarySeriesId===c.primarySeriesId; const notes=done?(ex.sourceInfo?.notes||""):(ex.sourceInfo?.notes||"")+" | Completed by the pending master CSV: Black Canary (2015) #8-12 + Gotham Academy #17 + Batgirl and the Birds of Prey: Rebirth #1 (text); primary series is now Black Canary.";
    toWrite.push({...c,...keep,sourceInfo:{...(ex.sourceInfo||c.sourceInfo),notes},adoptedFrom:from,coverageNote:null});
    (result.adopted=result.adopted||[]).push(c.id);
  }
  await all(COLLECTIONS.SERIES,seriesList,null,"series"); await all(COLLECTIONS.ISSUES,issues,null,"issues"); await all(COLLECTIONS.COLLECTIONS,toWrite,upsertCollectionEdition,"collected editions");
  return result;
}
