// ============================================================================
// comics-v2 / data.js
// ----------------------------------------------------------------------------
// Firestore data-access layer for the new Comics domain model (Step 16/17).
//
// Every query here is TARGETED (where/array-contains/limit) — nothing in this
// file ever downloads a full collection to the browser. This is deliberate:
// the existing site's Movies/Series/Games/(old) Comics tabs load their whole
// collection once at startup because those catalogues are small; the new,
// much richer Comics graph is expected to grow large, so every lookup here is
// scoped to exactly what the caller asked for.
//
// This module is completely independent of app.js — it does not import from
// or modify app.js, and app.js does not import from here either. That is the
// "compatibility layer" (Step 17): the existing Comics tab keeps using
// DATA.comics exactly as it does today, untouched, while this module is the
// foundation the *future* Comics phases will build on.
// ============================================================================
import { db } from "../firebase-config.js";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, limit as fsLimit, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { COLLECTIONS } from "./schema.js";

/* ---------------------------------------------------------------------------
   Generic helpers — every entity's CRUD goes through these, so Firestore
   calls stay in one place instead of scattered through future UI code.
--------------------------------------------------------------------------- */

/** Fetch one document by its stable id. Returns null if it doesn't exist. */
export async function getEntity(collectionName, id) {
  const snap = await getDoc(doc(db, collectionName, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Create or fully replace a document at a caller-supplied stable id
 * (never an auto-generated id — see slug.js). Stamps createdAt only when the
 * document doesn't already exist, always refreshes updatedAt.
 */
export async function upsertEntity(collectionName, id, data) {
  if (!id) throw new Error(`upsertEntity(${collectionName}): id is required`);
  const ref = doc(db, collectionName, id);
  const existing = await getDoc(ref);
  const payload = { ...data, id, updatedAt: serverTimestamp() };
  if (!existing.exists()) payload.createdAt = serverTimestamp();
  await setDoc(ref, payload, { merge: false });
  return payload;
}

/** Patch specific fields on an existing document (does not touch the rest). */
export async function patchEntity(collectionName, id, patch) {
  await updateDoc(doc(db, collectionName, id), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteEntity(collectionName, id) {
  await deleteDoc(doc(db, collectionName, id));
}

/** Cheap existence probe (used by the foundation self-test — never a full download). */
export async function collectionIsReachable(collectionName) {
  try {
    await getDocs(query(collection(db, collectionName), fsLimit(1)));
    return true;
  } catch (e) {
    console.warn(`[comics-v2] collection "${collectionName}" is not reachable:`, e.message);
    return false;
  }
}

const docsOf = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));

/* ---------------------------------------------------------------------------
   Universe / Continuity
--------------------------------------------------------------------------- */
export const getUniverse    = (id) => getEntity(COLLECTIONS.UNIVERSES, id);
export const getContinuity  = (id) => getEntity(COLLECTIONS.CONTINUITIES, id);

/** All continuities belonging to a universe. */
export async function getContinuitiesForUniverse(universeId) {
  const q = query(collection(db, COLLECTIONS.CONTINUITIES), where("universeId", "==", universeId));
  return docsOf(await getDocs(q));
}

/* ---------------------------------------------------------------------------
   Character
--------------------------------------------------------------------------- */
export const getCharacter = (id) => getEntity(COLLECTIONS.CHARACTERS, id);

/** "All series for a character" — queried from Series (source of truth), not a cached array on Character. */
export async function getSeriesForCharacter(characterId) {
  const q = query(collection(db, COLLECTIONS.SERIES), where("characterIds", "array-contains", characterId));
  return docsOf(await getDocs(q));
}

/** "All series in a continuity". */
export async function getSeriesForContinuity(continuityId) {
  const q = query(collection(db, COLLECTIONS.SERIES), where("continuityIds", "array-contains", continuityId));
  return docsOf(await getDocs(q));
}

/* ---------------------------------------------------------------------------
   Series / Run
--------------------------------------------------------------------------- */
export const getSeries = (id) => getEntity(COLLECTIONS.SERIES, id);

/** "All runs for a series". */
export async function getRunsForSeries(seriesId) {
  const q = query(collection(db, COLLECTIONS.RUNS), where("seriesId", "==", seriesId));
  return docsOf(await getDocs(q));
}

/* ---------------------------------------------------------------------------
   Story
--------------------------------------------------------------------------- */
export const getStory = (id) => getEntity(COLLECTIONS.STORIES, id);

/** "All stories in a run". */
export async function getStoriesForRun(runId) {
  const q = query(collection(db, COLLECTIONS.STORIES), where("runId", "==", runId));
  return docsOf(await getDocs(q));
}

/** A story can span multiple series (crossovers) — queried the other way too. */
export async function getStoriesForSeries(seriesId) {
  const q = query(collection(db, COLLECTIONS.STORIES), where("seriesIds", "array-contains", seriesId));
  return docsOf(await getDocs(q));
}

/* ---------------------------------------------------------------------------
   Issue
--------------------------------------------------------------------------- */
export const getIssue = (id) => getEntity(COLLECTIONS.ISSUES, id);

/** "All issues in a story". */
export async function getIssuesForStory(storyId) {
  const q = query(collection(db, COLLECTIONS.ISSUES), where("storyIds", "array-contains", storyId));
  return docsOf(await getDocs(q));
}

/** All issues belonging to a series (e.g. to paginate an issue list). */
export async function getIssuesForSeries(seriesId) {
  const q = query(collection(db, COLLECTIONS.ISSUES), where("seriesId", "==", seriesId));
  return docsOf(await getDocs(q));
}

/* ---------------------------------------------------------------------------
   Collection / Edition
--------------------------------------------------------------------------- */
export const getCollectionEdition = (id) => getEntity(COLLECTIONS.COLLECTIONS, id);

/**
 * "Which collection(s) contain issue X" — uses issueIdsCovered, the flat
 * mirror of issueCoverage[].issueId (see schema.js for why the mirror
 * exists: Firestore array-contains can't match a field *inside* an array of
 * objects).
 */
export async function getCollectionsContainingIssue(issueId) {
  const q = query(collection(db, COLLECTIONS.COLLECTIONS), where("issueIdsCovered", "array-contains", issueId));
  return docsOf(await getDocs(q));
}

/** "What collections contain this story". */
export async function getCollectionsContainingStory(storyId) {
  const q = query(collection(db, COLLECTIONS.COLLECTIONS), where("storyIds", "array-contains", storyId));
  return docsOf(await getDocs(q));
}

/**
 * Upsert a collection/edition, keeping issueIdsCovered in sync with
 * issueCoverage automatically — callers only ever need to supply
 * issueCoverage.
 */
export async function upsertCollectionEdition(id, data) {
  const issueCoverage = data.issueCoverage || [];
  const issueIdsCovered = issueCoverage.map(c => c.issueId).filter(Boolean);
  return upsertEntity(COLLECTIONS.COLLECTIONS, id, { ...data, issueCoverage, issueIdsCovered });
}

/* ---------------------------------------------------------------------------
   Creator
--------------------------------------------------------------------------- */
export const getCreator = (id) => getEntity(COLLECTIONS.CREATORS, id);

/* ---------------------------------------------------------------------------
   Relationships (generic graph)
--------------------------------------------------------------------------- */
/** "All relationships for an entity" — it may be the source OR the target, so this runs both and merges. */
export async function getRelationshipsForEntity(entityId) {
  const [asSource, asTarget] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.RELATIONSHIPS), where("sourceId", "==", entityId))),
    getDocs(query(collection(db, COLLECTIONS.RELATIONSHIPS), where("targetId", "==", entityId))),
  ]);
  const byId = new Map();
  [...docsOf(asSource), ...docsOf(asTarget)].forEach(r => byId.set(r.id, r));
  return [...byId.values()];
}

export async function getRelationshipsByType(relationshipType) {
  const q = query(collection(db, COLLECTIONS.RELATIONSHIPS), where("relationshipType", "==", relationshipType));
  return docsOf(await getDocs(q));
}

/* ---------------------------------------------------------------------------
   Reading paths
--------------------------------------------------------------------------- */
/** "All reading paths for a character". */
export async function getReadingPathsForCharacter(characterId) {
  const q = query(collection(db, COLLECTIONS.READING_PATHS), where("characterId", "==", characterId));
  return docsOf(await getDocs(q));
}

export async function getReadingPathsForContinuity(continuityId) {
  const q = query(collection(db, COLLECTIONS.READING_PATHS), where("continuityId", "==", continuityId));
  return docsOf(await getDocs(q));
}
