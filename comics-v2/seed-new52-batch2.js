// ============================================================================
// ALLABOUTDC — NEW 52 BATCH 2 (Justice League Dark, Swamp Thing, Animal Man, I, Vampire, Frankenstein, Resurrection Man,
// Phantom Stranger, Pandora, Constantine, Teen Titans, Blue Beetle, Firestorm, Hawk and Dove, Suicide Squad, Deathstroke)
// Isolated, additive import built from data-new52-batch2.js (the owner-supplied RIGOROUS FINAL CSV). It writes ONLY those records:
//  - every write goes to a deterministic id, so re-running is idempotent;
//  - ids that belong to another dataset (Batman / Superman / Flash / Green Lantern / Batch 1) are reserved and refused;
//  - issues of series that ALREADY exist (Batman #17, Aquaman #31 …) are referenced by their existing issue id — never copied;
//    every such reference is checked against the live catalogue before anything is written;
//  - shared catalogue records (universe, continuity) are created only if absent.
// ============================================================================
import * as schema from "./schema.js";
import * as slug from "./slug.js";
import {B2_DESCRIPTIONS,B2_CHARACTERS,B2_CREATORS,B2_DEFS,B2_RUNS,B2_STATUS,B2_EXTERNAL,B2_COLLECTION_RECORDS} from "./data-new52-batch2.js?v=b2c";
const {makeUniverse,makeContinuity,makeCharacter,makeSeries,makeRun,makeIssue,makeCollection,makeCreator,makeSourceInfo,validateSeries,validateRun,validateIssue,validateCollection,validateCharacter,validateCreator}=schema;

const UNIVERSE_ID=slug.buildUniverseId("DC Universe"), CONTINUITY_ID=slug.buildContinuityId("The New 52");
const SRC_NAME="Owner-supplied New 52 Batch 2 CSV (RIGOROUS FINAL)";
const src=(notes)=>makeSourceInfo({sourceUrl:null,sourceName:SRC_NAME,sourceType:"other",verificationStatus:"verified",notes});
const isUrl=u=>/^https?:\/\//.test(u||"");
const srcType=u=>!isUrl(u)?"other":/dc\.com/.test(u)?"official":/crushingkrisis/.test(u)?"database":"other";

const universe=makeUniverse({id:UNIVERSE_ID,name:"DC Universe",description:"The canonical DC Universe graph.",continuityIds:[CONTINUITY_ID],characterIds:[],sourceInfo:src("Created only if absent; an existing universe record is never modified by this import.")});
const continuity=makeContinuity({id:CONTINUITY_ID,name:"The New 52",shortName:"New 52",description:"Post-Flashpoint DC continuity/publication era.",universeId:UNIVERSE_ID,startDate:"2011-09",endDate:"2016-05",sourceInfo:src("Created only if absent; an existing continuity record is never modified by this import.")});
continuity.earthName="Prime Earth"; continuity.eraNote="Post-Flashpoint";

const characters=B2_CHARACTERS.map(c=>makeCharacter({id:slug.buildCharacterId(c.name),name:c.name,displayName:c.name,aliases:[],universeIds:[UNIVERSE_ID],continuityIds:[CONTINUITY_ID],browseRoot:!!c.root,parentCharacterId:null,sourceInfo:src("Family named in the supplied Batch 2 series rows.")}));
const creators=B2_CREATORS.map(n=>makeCreator({id:slug.buildCreatorId(n),name:n,displayName:n,sourceInfo:src("Creator named in the supplied Batch 2 rows.")}));

const seriesList=[],seriesByTitle=new Map(),issues=[],runs=[],collections=[];
for(const [title,year,startDate,endDate,max,zeros,annuals,decimals,specials,lineCategory,charNames,creatorNames] of B2_DEFS){
  const id=slug.buildSeriesId(title,year);
  const s=makeSeries({id,title,publisher:"DC Comics",startDate,endDate,issueCount:max,universeId:UNIVERSE_ID,continuityIds:[CONTINUITY_ID],characterIds:charNames.map(n=>slug.buildCharacterId(n)),creatorIds:creatorNames.map(n=>slug.buildCreatorId(n)),description:B2_DESCRIPTIONS[title]||"",sourceInfo:src("Series scope exactly as supplied. issueCount is regular numbered issues only; #0, annuals, decimal issues and Futures End one-shots are separate publication units.")});
  Object.assign(s,{lineCategory,regularIssueCount:max,zeroIssueCount:zeros.length,annualCount:annuals.length,decimalIssueCount:decimals.length,specialCount:specials.length,scope:"batch2-new52"});
  seriesList.push(s); seriesByTitle.set(title,s);
  const add=(label,type="numbered")=>issues.push(makeIssue({id:slug.buildIssueId(id,label),seriesId:id,issueNumber:String(label).replace(/^#/,""),issueLabel:type==="numbered"?`#${label}`:String(label),issueLabelType:type,continuityId:CONTINUITY_ID,universeId:UNIVERSE_ID,characterIds:s.characterIds,creatorIds:s.creatorIds,sourceInfo:src("Publication unit within the supplied series scope.")}));
  zeros.forEach(x=>add(x,"special")); for(let n=1;n<=max;n++)add(String(n)); annuals.forEach(x=>add(x,"annual")); decimals.forEach(x=>add(x,"one_shot")); specials.forEach(x=>add(x,"special"));
}
void B2_RUNS; void B2_STATUS;

const labelOf=(label)=>/^Annual/.test(label)||/\./.test(label)||/[A-Za-z]/.test(label)?label:`#${label}`;
/** external references (series already in the catalogue): [{seriesId,issueId,issueLabel,partial}] */
const externalRefs=[];
for(const r of B2_COLLECTION_RECORDS){
  const rows=[],sids=(r.ss||[]).map(t=>seriesByTitle.get(t).id);
  for(const [st,labels,partial=[]] of r.cov){
    const own=seriesByTitle.get(st);
    if(own){ if(!sids.includes(own.id))sids.push(own.id); labels.forEach(l=>rows.push({seriesId:own.id,issueId:slug.buildIssueId(own.id,String(l)),issueLabel:labelOf(String(l)),coveragePart:partial.includes(l)?"partial":"complete"})); continue; }
    const extId=B2_EXTERNAL[st]; if(!extId)throw new Error(`Collection ${r.id}: unknown series ${st}`);
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
  for(const s of seriesList){for(const id of s.characterIds)if(!ids.character.has(id))errors.push(`Series ${s.id} missing character ${id}`);}
  const ext=new Set(externalRefs.map(r=>r.issueId));
  for(const c of collections){for(const row of c.issueCoverage){if(!ids.issue.has(row.issueId)&&!ext.has(row.issueId))errors.push(`Collection ${c.id} references unknown issue ${row.issueId}`);}}
  for(const s of seriesList){const nums=issues.filter(i=>i.seriesId===s.id&&i.issueLabelType==="numbered").map(i=>Number(i.issueNumber)).sort((a,b)=>a-b); if(JSON.stringify(nums)!==JSON.stringify(Array.from({length:s.issueCount},(_,i)=>i+1)))errors.push(`Series ${s.id}: numbered issues do not equal 1..${s.issueCount}`);}
  const sid=t=>seriesByTitle.get(t)?.id; const col=id=>collections.find(c=>c.id===id);
  const need=(ok,msg)=>{if(!ok)errors.push(msg);};
  const cov=(cid,series,label)=>!!col(cid)?.issueCoverage.some(r=>r.seriesId===(sid(series)||series)&&r.issueLabel===label);
  const labels=(cid,series)=>(col(cid)?.issueCoverage||[]).filter(r=>r.seriesId===sid(series)).map(r=>r.issueLabel);
  const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>`#${a+i}`);
  need(seriesList.length===15,"15 series");
  for(const c of collections){if(c.role==="mainline"&&!c.primarySeriesId)errors.push(`${c.id}: a mainline volume needs a primary series`);}
  // numbered mainline volumes per series (editions of the same volume count once)
  const vols=(t)=>new Set(collections.filter(c=>c.primarySeriesId===sid(t)&&c.role==="mainline"&&c.volume).map(c=>c.volume)).size;
  for(const [t,n] of [["Justice League Dark",6],["Swamp Thing",7],["Animal Man",5],["I, Vampire",3],["Frankenstein: Agent of S.H.A.D.E.",2],["Resurrection Man",2],["Trinity of Sin: Phantom Stranger",3],["Trinity of Sin: Pandora",2],["Constantine",4],["Teen Titans",5],["Blue Beetle",2],["The Fury of Firestorm: The Nuclear Men",3],["Hawk and Dove",1],["Suicide Squad",5],["Deathstroke",2]])need(vols(t)===n,`${t}: expected ${n} numbered volumes, found ${vols(t)}`);
  // edition-specific conflicts
  need(JSON.stringify(labels("justice-league-dark-vol-3-the-death-of-magic","Justice League Dark"))===JSON.stringify(range(14,21)),"JLD Vol. 3 is #14-21 (source conflict preserved, #20-21 not truncated)");
  const bb1=col("blue-beetle-vol-2-blue-diamond-original-solicitation"),bb2=col("blue-beetle-vol-2-blue-diamond-resolicited-expanded-edition");
  need(bb1&&bb2&&bb1.id!==bb2.id&&!cov(bb1.id,"Blue Beetle","#0")&&cov(bb2.id,"Blue Beetle","#0")&&cov(bb2.id,"Blue Beetle","#16")&&!cov(bb1.id,"Blue Beetle","#13"),"Blue Beetle Vol. 2 keeps original and resolicited editions as separate records");
  const ds1=col("deathstroke-vol-2-lobo-hunt-original-edition"),ds2=col("deathstroke-vol-2-lobo-hunt-expanded-resolicited-edition");
  need(ds1&&ds2&&cov(ds1.id,"Deathstroke","#14")&&!cov(ds1.id,"Deathstroke","#15")&&cov(ds2.id,"Deathstroke","#20"),"Deathstroke Vol. 2 keeps original (#9-14) and expanded (#9-20) editions as separate records");
  need(JSON.stringify(labels("suicide-squad-vol-2-basilisk-rising","Suicide Squad"))===JSON.stringify(["#0",...range(8,13)])&&cov("suicide-squad-vol-2-basilisk-rising","Resurrection Man","#9"),"Suicide Squad Vol. 2 is #0, #8-13 + Resurrection Man #9");
  need(!issues.some(i=>i.seriesId===sid("Suicide Squad")&&i.issueNumber==="23.1")&&!cov("suicide-squad-vol-4-discipline-and-punish","Suicide Squad","#23.1"),"Suicide Squad has no #23.1");
  const st6=col("swamp-thing-vol-6-the-sureen"); const aq=st6?.issueCoverage.filter(r=>r.seriesId===B2_EXTERNAL["Aquaman"]);
  need(aq?.length===1&&aq[0].issueLabel==="#31"&&aq[0].coveragePart==="partial"&&!st6.issueCoverage.some(r=>r.seriesId===B2_EXTERNAL["Aquaman"]&&r.coveragePart!=="partial"),"Swamp Thing Vol. 6 maps only pages of Aquaman #31 (partial, existing issue)");
  need(!cov("animal-man-vol-3-rotworld-the-red-kingdom","Animal Man","#18")&&!cov("animal-man-vol-3-rotworld-the-red-kingdom","Animal Man","#19"),"Animal Man Vol. 3 is not expanded to #18-19");
  need(cov("trinity-of-sin-pandora-vol-1-the-curse","Trinity of Sin: Pandora","#6")&&cov("trinity-of-sin-pandora-vol-2-choices","Trinity of Sin: Pandora","#6"),"Pandora #6 intentionally appears in Vols. 1 and 2");
  need(col("teen-titans-vol-3-death-of-the-family").issueCoverage.some(r=>r.seriesId===B2_EXTERNAL["Batman"]&&r.issueLabel==="#17")&&col("teen-titans-vol-3-death-of-the-family").issueCoverage.some(r=>r.seriesId===B2_EXTERNAL["Red Hood and the Outlaws"]&&r.issueLabel==="#16"),"Teen Titans Vol. 3 references the existing Batman #17 and Red Hood and the Outlaws #16");
  need(col("forever-evil-blight")?.issueCoverage.map(r=>r.seriesId).filter((v,i,a)=>a.indexOf(v)===i).length===4,"Forever Evil: Blight spans four series");
  need(JSON.stringify(labels("i-vampire-vol-2-rise-of-the-vampires","Justice League Dark"))===JSON.stringify(["#7","#8"]),"I, Vampire Vol. 2 carries Justice League Dark #7-8");
  need(col("hawk-and-dove-vol-1-first-strikes")?.issueCoverage.length===8,"Hawk and Dove Vol. 1 is #1-8");
  need(!issues.some(i=>/Amanda Waller|Rebirth/i.test(i.issueLabel)),"no issue records for non-series one-shots");
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
  say("Writing characters…"); await own(COLLECTIONS.CHARACTERS,characters,"characters"); if(creators.length)await own(COLLECTIONS.CREATORS,creators,"creators");
  const all=async(col,list,fn,label)=>{say(`Writing ${label}…`); let n=0; for(const e of list){try{if(fn)await fn(e.id,e);else await upsertEntity(col,e.id,e);n++;}catch(err){result.errors.push(`${col}/${e.id}: ${err.message}`);}} result.written[col]=n;};
  await all(COLLECTIONS.SERIES,seriesList,null,"series"); await all(COLLECTIONS.ISSUES,issues,null,"issues"); await all(COLLECTIONS.COLLECTIONS,collections,upsertCollectionEdition,"collected editions");
  return result;
}
