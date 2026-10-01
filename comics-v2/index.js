// ============================================================================
// comics-v2 / index.js — Batman New 52 clean rebuild
// ============================================================================
import * as schema from "./schema.js";
import * as slug from "./slug.js";
import * as data from "./data.js";
import { db } from "../firebase-config.js";
import { collection, getDocs, deleteDoc, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { dataset, validateDataset, importDataset } from "./seed-batman-new52.js?v=dc5";
import * as flashGl from "./seed-new52-flash-gl.js?v=dc1";
import * as branchPaths from "./branch-paths.js?v=bp3";
import * as batch1 from "./seed-new52-batch1.js?v=b1";

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
const BATCH1_PATH_IDS = ["bp-jl-throne-of-atlantis", "bp-jl-trinity-war", "bp-ga-hawkman-wanted"];
export async function importNew52Batch1(progress) {
  const sets = (ds) => ({
    characters: ds.characters.map(x => x.id), creators: ds.creators.map(x => x.id), series: ds.series.map(x => x.id),
    runs: ds.runs.map(x => x.id), issues: ds.issues.map(x => x.id), collections: ds.collections.map(x => x.id),
  });
  const reserved = {};
  for (const ds of [dataset, flashGl.dataset]) { const s = sets(ds); for (const k of Object.keys(s)) reserved[k] = new Set([...(reserved[k] || []), ...s[k]]); }
  const result = await batch1.importDataset({
    upsertEntity: data.upsertEntity, upsertCollectionEdition: data.upsertCollectionEdition, getEntity: data.getEntity, COLLECTIONS, reserved, progress,
  });
  if (result.validation?.valid && !result.errors.length) {
    result.paths = await branchPaths.importBranchPaths({ upsertEntity: data.upsertEntity, getEntity: data.getEntity, progress, only: BATCH1_PATH_IDS });
  }
  return result;
}

// Additive import: New 52 branching reading paths (event -> branches -> return). Writes ONLY bp-* documents in
// comicReadingPaths, at deterministic ids; reads series/collections to verify they exist; never clears or edits anything else.
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
