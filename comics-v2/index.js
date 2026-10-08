// ============================================================================
// comics-v2 / index.js — Batman New 52 clean rebuild
// ============================================================================
import * as schema from "./schema.js";
import * as slug from "./slug.js";
import * as data from "./data.js?v=fp3";
import { db } from "../firebase-config.js";
import { collection, getDocs, deleteDoc, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { dataset, validateDataset, importDataset } from "./seed-batman-new52.js?v=dc5";
import * as flashGl from "./seed-new52-flash-gl.js?v=dc1";
import * as branchPaths from "./branch-paths.js?v=bp6";
import * as batch1 from "./seed-new52-batch1.js?v=b1c";
import * as batch2 from "./seed-new52-batch2.js?v=b2c";
import * as batch3 from "./seed-new52-batch3.js?v=b3b";
import * as pending from "./seed-new52-pending.js?v=p2";
import * as eventsSeed from "./seed-events.js?v=fp2";
import * as eventsData from "./events-data.js?v=fp3";

export const COLLECTIONS = schema.COLLECTIONS;

const V2_COLLECTIONS = [
  COLLECTIONS.UNIVERSES,
  COLLECTIONS.CONTINUITIES,
  COLLECTIONS.CHARACTERS,
  COLLECTIONS.SERIES,
  COLLECTIONS.RUNS,
  COLLECTIONS.STORIES,
  COLLECTIONS.ISSUES,
  COLLECTIONS.COLLECTIONS,
  COLLECTIONS.CREATORS,
  COLLECTIONS.RELATIONSHIPS,
  COLLECTIONS.READING_PATHS,
];

// The old flat catalogue is deliberately cleared too. The new Batman dataset is
// the only Comics source of truth after this operation.
const LEGACY_COMICS_COLLECTION = "comics";

async function deleteAllDocs(collectionName, progress) {
  const snap = await getDocs(collection(db, collectionName));
  const docs = snap.docs;
  let deleted = 0;
  const chunkSize = 40;
  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
    await Promise.all(chunk.map(d => deleteDoc(doc(db, collectionName, d.id))));
    deleted += chunk.length;
    if (progress) progress(collectionName, deleted, docs.length);
  }
  return deleted;
}

export async function clearAllComicsData(progress) {
  const written = {};
  for (const name of [...V2_COLLECTIONS, LEGACY_COMICS_COLLECTION]) {
    written[name] = await deleteAllDocs(name, progress);
  }
  return written;
}

export async function resetAndImportBatmanNew52(progress) {
  const validation = validateDataset();
  if (!validation.valid) return { validation, cleared: null, imported: null, errors: [] };
  const cleared = await clearAllComicsData(progress);
  // The reset has just deleted the target collections, so a direct set is both
  // faster and deterministic; no read-before-write is needed.
  const freshUpsert = async (collectionName, id, entity) => {
    await setDoc(doc(db, collectionName, id), { ...entity, id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: false });
  };
  const freshCollection = async (id, entity) => {
    const issueCoverage = entity.issueCoverage || [];
    await freshUpsert(COLLECTIONS.COLLECTIONS, id, { ...entity, issueCoverage, issueIdsCovered: issueCoverage.map(x => x.issueId).filter(Boolean) });
  };
  const imported = await importDataset({
    upsertEntity: freshUpsert,
    upsertCollectionEdition: freshCollection,
    COLLECTIONS,
  });
  return { validation, cleared, imported, errors: imported.errors || [] };
}

// ---------------------------------------------------------------------------
// Additive import: New 52 Flash + Green Lantern. Independent of the Batman/Superman reset:
// it never calls clearAllComicsData / resetAndImportBatmanNew52, never truncates a collection and
// never writes an id that belongs to the Batman/Superman dataset (those ids are reserved).
// Every write is an upsert at a deterministic id, so running it again changes nothing.
// ---------------------------------------------------------------------------
export async function importNew52FlashAndGreenLantern(progress) {
  const reserved = {
    characters: new Set(dataset.characters.map(x => x.id)),
    creators: new Set(dataset.creators.map(x => x.id)),
    series: new Set(dataset.series.map(x => x.id)),
    runs: new Set(dataset.runs.map(x => x.id)),
    issues: new Set(dataset.issues.map(x => x.id)),
    collections: new Set(dataset.collections.map(x => x.id)),
  };
  return flashGl.importDataset({
    upsertEntity: data.upsertEntity,
    upsertCollectionEdition: data.upsertCollectionEdition,
    getEntity: data.getEntity,
    COLLECTIONS,
    reserved,
    progress,
  });
}

// Additive import: New 52 Batch 1 (Justice League, Wonder Woman, Aquaman, Aquaman and The Others, Green Arrow).
// Never clears or resets anything; every write is an upsert at a deterministic id; ids owned by the Batman/Superman/Flash/Green Lantern
// datasets are reserved (a collision aborts before any write). Its three event reading paths are written at the end (bp-* docs only).
const BATCH1_PATH_IDS = ["bp-jl-throne-of-atlantis", "bp-jl-trinity-war", "bp-jl-forever-evil", "bp-jl-darkseid-war", "bp-ga-hawkman-wanted"];
export async function importNew52Batch1(progress) {
  const sets = (ds) => ({
    characters: ds.characters.map(x => x.id), creators: ds.creators.map(x => x.id), series: ds.series.map(x => x.id),
    runs: ds.runs.map(x => x.id), issues: ds.issues.map(x => x.id), collections: ds.collections.map(x => x.id),
  });
  const reserved = {};
  for (const ds of [dataset, flashGl.dataset]) { const s = sets(ds); for (const k of Object.keys(s)) reserved[k] = new Set([...(reserved[k] || []), ...s[k]]); }
  const result = await batch1.importDataset({
    upsertEntity: data.upsertEntity, upsertCollectionEdition: data.upsertCollectionEdition, getEntity: data.getEntity, patchEntity: data.patchEntity, COLLECTIONS, reserved, progress,
  });
  if (result.validation?.valid && !result.errors.length) {
    result.paths = await branchPaths.importBranchPaths({ upsertEntity: data.upsertEntity, getEntity: data.getEntity, progress, only: BATCH1_PATH_IDS });
  }
  return result;
}

// Additive import: New 52 Batch 2 (Justice League Dark, Swamp Thing, Animal Man, I Vampire, Frankenstein, Resurrection Man, Phantom Stranger,
// Pandora, Constantine, Teen Titans, Blue Beetle, Firestorm, Hawk and Dove, Suicide Squad, Deathstroke). Same safety model as Batch 1: never clears or
// resets, deterministic upserts only, ids owned by every other dataset are reserved, and referenced existing issues (Batman #17, Aquaman #31 …) are
// verified to exist before anything is written. Its six event paths + the Teen Titans participation in the existing Death of the Family path are
// written at the end (bp-* documents only; the Death of the Family event is the existing global one, not a duplicate).
const BATCH2_PATH_IDS = ["bp-dark-rise-of-the-vampires", "bp-dark-rotworld", "bp-dark-blight", "bp-ss-resurrection-man", "bp-teen-culling", "bp-bat-dotf", "bp-jl-forever-evil", "bp-ga-hawkman-wanted"];
export async function importNew52Batch2(progress) {
  const sets = (ds) => ({
    characters: ds.characters.map(x => x.id), creators: ds.creators.map(x => x.id), series: ds.series.map(x => x.id),
    runs: ds.runs.map(x => x.id), issues: ds.issues.map(x => x.id), collections: ds.collections.map(x => x.id),
  });
  const reserved = {};
  for (const ds of [dataset, flashGl.dataset, batch1.dataset]) { const s = sets(ds); for (const k of Object.keys(s)) reserved[k] = new Set([...(reserved[k] || []), ...s[k]]); }
  const result = await batch2.importDataset({
    upsertEntity: data.upsertEntity, upsertCollectionEdition: data.upsertCollectionEdition, getEntity: data.getEntity, COLLECTIONS, reserved, progress,
  });
  if (result.validation?.valid && !result.errors.length) {
    result.paths = await branchPaths.importBranchPaths({ upsertEntity: data.upsertEntity, getEntity: data.getEntity, progress, only: BATCH2_PATH_IDS });
  }
  return result;
}

// Additive import: New 52 Batch 3 (Justice League International / of America / Vibe / United, Legion of Super-Heroes, Legion Lost, Justice League 3000 / 3001,
// Earth 2, Earth 2: World's End, Worlds' Finest, The Savage Hawkman, Cyborg, Martian Manhunter, Captain Atom, Mister Terrific). Same safety model as Batches 1-2:
// never clears or resets, deterministic upserts only, ids owned by every other dataset are reserved, referenced existing issues (Firestorm #9, Batman/Superman #8-9)
// are verified to exist first. Justice League International Vol. 2 reuses the id of the Batch 2 cross-title record (one publication, not two). The Culling and
// Hawkman: Wanted paths are rewritten so Legion Lost / Savage Hawkman become real participants (bp-* documents only).
const BATCH3_PATH_IDS = ["bp-teen-culling", "bp-ga-hawkman-wanted"];
export async function importNew52Batch3(progress) {
  const sets = (ds) => ({
    characters: ds.characters.map(x => x.id), creators: ds.creators.map(x => x.id), series: ds.series.map(x => x.id),
    runs: ds.runs.map(x => x.id), issues: ds.issues.map(x => x.id), collections: ds.collections.map(x => x.id),
  });
  const reserved = {};
  for (const ds of [dataset, flashGl.dataset, batch1.dataset, batch2.dataset]) { const s = sets(ds); for (const k of Object.keys(s)) reserved[k] = new Set([...(reserved[k] || []), ...s[k]]); }
  const result = await batch3.importDataset({
    upsertEntity: data.upsertEntity, upsertCollectionEdition: data.upsertCollectionEdition, getEntity: data.getEntity, COLLECTIONS, reserved, progress,
  });
  if (result.validation?.valid && !result.errors.length) {
    result.paths = await branchPaths.importBranchPaths({ upsertEntity: data.upsertEntity, getEntity: data.getEntity, progress, only: BATCH3_PATH_IDS });
  }
  return result;
}

// Pending master batch (34 series, 62 collection records). Additive + idempotent: every earlier dataset's ids are reserved (a collision aborts before any write),
// referenced existing issues (Justice League #23.3, Red Lanterns #10, Gotham Academy #17) are verified live, and the Culling path is rewritten (bp-* doc only).
const PENDING_PATH_IDS = ["bp-teen-culling"];
export async function importNew52Pending(progress) {
  const sets = (ds) => ({
    characters: ds.characters.map(x => x.id), creators: ds.creators.map(x => x.id), series: ds.series.map(x => x.id),
    runs: ds.runs.map(x => x.id), issues: ds.issues.map(x => x.id), collections: ds.collections.map(x => x.id),
  });
  const reserved = {};
  for (const ds of [dataset, flashGl.dataset, batch1.dataset, batch2.dataset, batch3.dataset]) { const s = sets(ds); for (const k of Object.keys(s)) reserved[k] = new Set([...(reserved[k] || []), ...s[k]]); }
  const result = await pending.importDataset({
    upsertEntity: data.upsertEntity, upsertCollectionEdition: data.upsertCollectionEdition, getEntity: data.getEntity, COLLECTIONS, reserved, progress,
  });
  if (result.validation?.valid && !result.errors.length) {
    result.paths = await branchPaths.importBranchPaths({ upsertEntity: data.upsertEntity, getEntity: data.getEntity, progress, only: PENDING_PATH_IDS });
  }
  return result;
}

// Additive import: New 52 branching reading paths (event -> branches -> return). Writes ONLY bp-* documents in
// comicReadingPaths, at deterministic ids; reads series/collections to verify they exist; never clears or edits anything else.
// Phase 5 — additive event import (events + issue.eventIds + event→event edges). Validation-first; nothing is deleted or guessed.
export async function importNew52Events(progress) {
  const r = await eventsSeed.importEvents({ data, progress });
  try { window.__comicsV2.lastEventImport = r; if (r && r.audit && r.audit.length && console.table) console.table(r.audit.map(a => ({ id: a.eventId, type: a.semanticType, desc: a.descriptionPresent, issues: a.issueCount, series: a.participatingSeries, rp: a.readingPathResolved, colls: a.collections, status: a.status }))); } catch (e) { /* diagnostics only */ }
  return r;
}

export async function importNew52BranchPaths(progress) {
  return branchPaths.importBranchPaths({ upsertEntity: data.upsertEntity, getEntity: data.getEntity, progress });
}

// Developer inspection hooks. No writes occur merely by loading this module.
window.__comicsV2 = {
  schema,
  slug,
  data,
  COLLECTIONS,
  dataset,
  validate: validateDataset,
  new52FlashGl: {
    dataset: flashGl.dataset,
    validate: flashGl.validateDataset,
    import: importNew52FlashAndGreenLantern,
  },
  new52Batch1: {
    dataset: batch1.dataset,
    validate: batch1.validateDataset,
    import: importNew52Batch1,
  },
  new52Batch2: {
    dataset: batch2.dataset,
    validate: batch2.validateDataset,
    import: importNew52Batch2,
  },
  new52Pending: {
    dataset: pending.dataset,
    validate: pending.validateDataset,
    import: importNew52Pending,
  },
  new52Batch3: {
    dataset: batch3.dataset,
    validate: batch3.validateDataset,
    import: importNew52Batch3,
  },
  new52Events: {
    build: eventsData.buildEvents,
    members: eventsSeed.plannedMembership,
    validate: eventsSeed.validateDataset,
    retired: eventsData.RETIRED_EVENTS,
    enrichment: eventsData.EVENT_ENRICHMENT,
    merge: eventsSeed.mergeEvent,
    import: importNew52Events,
  },
  new52BranchPaths: {
    build: branchPaths.buildAll,
    validate: branchPaths.validate,
    import: importNew52BranchPaths,
  },
  batmanNew52: {
    dataset,
    validate: validateDataset,
    import: resetAndImportBatmanNew52,
    resetAndImport: resetAndImportBatmanNew52,
    clearAll: clearAllComicsData,
  },
};
