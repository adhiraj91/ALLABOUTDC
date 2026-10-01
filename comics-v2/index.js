// ============================================================================
// comics-v2 / index.js — Batman New 52 clean rebuild
// ============================================================================
import * as schema from "./schema.js";
import * as slug from "./slug.js";
import * as data from "./data.js";
import { db } from "../firebase-config.js";
import { collection, getDocs, deleteDoc, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { dataset, validateDataset, importDataset } from "./seed-batman-new52.js?v=dc4";

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

// Developer inspection hooks. No writes occur merely by loading this module.
window.__comicsV2 = {
  schema,
  slug,
  data,
  COLLECTIONS,
  dataset,
  validate: validateDataset,
  batmanNew52: {
    dataset,
    validate: validateDataset,
    import: resetAndImportBatmanNew52,
    resetAndImport: resetAndImportBatmanNew52,
    clearAll: clearAllComicsData,
  },
};
