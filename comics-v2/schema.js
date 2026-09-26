// ============================================================================
// comics-v2 / schema.js
// ----------------------------------------------------------------------------
// The new, richer Comics domain model — PHASE 1 (foundation only).
//
// This file does NOT touch the existing "comics" Firestore collection or the
// existing flat comic records used by the current site. It defines a
// SEPARATE set of collections that the future Comics phases (explorer,
// reading journeys, story maps, research/data-entry) will read and write.
//
// Collections introduced by this phase (all new, all additive):
//   comicUniverses, comicContinuities, comicCharacters, comicSeries,
//   comicRuns, comicStories, comicIssues, comicCollections, comicCreators,
//   comicRelationships, comicReadingPaths
//
// Design notes:
//   - IDs are always stable slugs (see slug.js), never a raw display title.
//   - Where two entities reference each other, ONE side is the source of
//     truth (an explicit foreign-key field) and the other direction is
//     reached with a query, not a denormalized array that can drift out of
//     sync. E.g. comicCharacters does NOT store seriesIds/runIds/etc. —
//     those are queried from comicSeries/comicRuns/... via characterIds
//     (array-contains). This is called out per entity below.
//   - Every entity carries a `sourceInfo` block (source + verification
//     status) per Step 15. Nothing defaults to "verified".
// ============================================================================

export const COLLECTIONS = Object.freeze({
  UNIVERSES:      "comicUniverses",
  CONTINUITIES:   "comicContinuities",
  CHARACTERS:     "comicCharacters",
  SERIES:         "comicSeries",
  RUNS:           "comicRuns",
  STORIES:        "comicStories",
  ISSUES:         "comicIssues",
  COLLECTIONS:    "comicCollections",
  CREATORS:       "comicCreators",
  RELATIONSHIPS:  "comicRelationships",
  READING_PATHS:  "comicReadingPaths",
});

/* ---------------------------------------------------------------------------
   Extensible enums. These are STARTING sets, not closed lists — validators
   below only warn (never block) on a value outside the starting set, because
   every "Step" in the spec explicitly requires room to grow these later
   without a schema redesign.
--------------------------------------------------------------------------- */
export const VERIFICATION_STATUSES = ["unverified", "partially_verified", "verified"];

export const SOURCE_TYPES = ["official", "database", "wiki", "retailer", "other"];

export const CREATOR_ROLES = [
  "Writer", "Artist", "Penciller", "Inker", "Colorist", "Letterer",
  "Cover Artist", "Editor", "Creator",
];

export const COLLECTION_FORMATS = [
  "TPB", "Hardcover", "Omnibus", "Absolute", "Deluxe Edition",
  "Compendium", "Box Set", "Digital Collection", "Other",
];

export const ISSUE_LABEL_TYPES = ["numbered", "annual", "special", "one_shot", "other"];

export const RELATIONSHIP_TYPES = [
  "sequel_to", "prequel_to", "crossover_with", "tie_in_to", "part_of_event",
  "spin_off_from", "continues", "relaunches", "alternate_version_of",
  "adaptation_of", "features_character",
];

export const ENTITY_TYPES = [
  "universe", "continuity", "character", "series", "run", "story",
  "issue", "collection", "creator",
];

export const READING_PATH_TYPES = [
  "beginner", "essential", "main_series", "complete",
  "publication_order", "chronological", "event_crossover",
];

/* ---------------------------------------------------------------------------
   Source / verification block — Step 15. Shared shape used on every entity.
--------------------------------------------------------------------------- */
export function makeSourceInfo(overrides = {}) {
  return {
    sourceUrl: null,
    sourceName: null,
    sourceType: null,        // one of SOURCE_TYPES, or null if not yet researched
    verificationStatus: "unverified", // NEVER default to "verified"
    notes: null,
    ...overrides,
  };
}
function validateSourceInfo(s, errors, path) {
  if (!s || typeof s !== "object") { errors.push(`${path}: sourceInfo is required`); return; }
  if (!VERIFICATION_STATUSES.includes(s.verificationStatus)) {
    errors.push(`${path}.verificationStatus: must be one of ${VERIFICATION_STATUSES.join("|")}`);
  }
  if (s.sourceType != null && !SOURCE_TYPES.includes(s.sourceType)) {
    errors.push(`${path}.sourceType: "${s.sourceType}" is outside the starting set (${SOURCE_TYPES.join("|")}) — allowed, just flagging`);
  }
}

const nowIso = () => new Date().toISOString();

/* ---------------------------------------------------------------------------
   1. UNIVERSE
--------------------------------------------------------------------------- */
export function makeUniverse({ id, name, description = "", continuityIds = [], characterIds = [], sourceInfo } = {}) {
  return {
    id, name, description,
    continuityIds, characterIds,
    sourceInfo: sourceInfo || makeSourceInfo(),
    createdAt: nowIso(), updatedAt: nowIso(),
  };
}
export function validateUniverse(u) {
  const errors = [];
  if (!u || !u.id) errors.push("universe.id is required");
  if (!u || !u.name) errors.push("universe.name is required");
  if (u) validateSourceInfo(u.sourceInfo, errors, "universe");
  return { valid: errors.length === 0, errors };
}

/* ---------------------------------------------------------------------------
   2. CONTINUITY / ERA
--------------------------------------------------------------------------- */
export function makeContinuity({
  id, name, shortName = "", description = "", universeId = null,
  startDate = null, endDate = null, predecessorId = null, successorId = null,
  majorEventIds = [], sourceInfo,
} = {}) {
  return {
    id, name, shortName, description, universeId,
    startDate, endDate, predecessorId, successorId, majorEventIds,
    sourceInfo: sourceInfo || makeSourceInfo(),
    createdAt: nowIso(), updatedAt: nowIso(),
  };
}
export function validateContinuity(c) {
  const errors = [];
  if (!c || !c.id) errors.push("continuity.id is required");
  if (!c || !c.name) errors.push("continuity.name is required");
  if (c) validateSourceInfo(c.sourceInfo, errors, "continuity");
  return { valid: errors.length === 0, errors };
}

/* ---------------------------------------------------------------------------
   3. CHARACTER
   NOTE: series/run/story/issue/collection associations are NOT stored here —
   they're queried from the child collections' characterIds (array-contains),
   which are the source of truth. Storing them here too would just be a copy
   that can silently go stale.
--------------------------------------------------------------------------- */
export function makeCharacter({
  id, name, displayName = "", aliases = [],
  universeIds = [], continuityIds = [], sourceInfo,
} = {}) {
  return {
    id, name, displayName: displayName || name, aliases,
    universeIds, continuityIds,
    sourceInfo: sourceInfo || makeSourceInfo(),
    createdAt: nowIso(), updatedAt: nowIso(),
  };
}
export function validateCharacter(c) {
  const errors = [];
  if (!c || !c.id) errors.push("character.id is required");
  if (!c || !c.name) errors.push("character.name is required");
  if (c) validateSourceInfo(c.sourceInfo, errors, "character");
  return { valid: errors.length === 0, errors };
}

/* ---------------------------------------------------------------------------
   4. SERIES
--------------------------------------------------------------------------- */
export function makeSeries({
  id, title, publisher = "DC Comics", startDate = null, endDate = null,
  issueCount = null, universeId = null, continuityIds = [], characterIds = [],
  creatorIds = [], description = "", coverImage = null, sourceInfo,
} = {}) {
  return {
    id, title, publisher, startDate, endDate, issueCount,
    universeId, continuityIds, characterIds, creatorIds,
    description, coverImage,
    sourceInfo: sourceInfo || makeSourceInfo(),
    createdAt: nowIso(), updatedAt: nowIso(),
  };
}
export function validateSeries(s) {
  const errors = [];
  if (!s || !s.id) errors.push("series.id is required");
  if (!s || !s.title) errors.push("series.title is required");
  if (s && !Array.isArray(s.continuityIds)) errors.push("series.continuityIds must be an array (a series can span more than one continuity)");
  if (s) validateSourceInfo(s.sourceInfo, errors, "series");
  return { valid: errors.length === 0, errors };
}

/* ---------------------------------------------------------------------------
   5. CREATIVE RUN (distinct from Series — a series can contain many runs)
--------------------------------------------------------------------------- */
export function makeRun({
  id, seriesId, title = "", creatorIds = [], startIssue = null, endIssue = null,
  startDate = null, endDate = null, storyIds = [], description = "", sourceInfo,
} = {}) {
  return {
    id, seriesId, title, creatorIds, startIssue, endIssue,
    startDate, endDate, storyIds, description,
    sourceInfo: sourceInfo || makeSourceInfo(),
    createdAt: nowIso(), updatedAt: nowIso(),
  };
}
export function validateRun(r) {
  const errors = [];
  if (!r || !r.id) errors.push("run.id is required");
  if (!r || !r.seriesId) errors.push("run.seriesId is required");
  if (r) validateSourceInfo(r.sourceInfo, errors, "run");
  return { valid: errors.length === 0, errors };
}

/* ---------------------------------------------------------------------------
   6. STORY / ARC
   NOTE: publication order, chronological order and recommended reading order
   are deliberately kept as separate concepts — nothing here assumes any one
   of them can be derived from another (that's the whole point of
   comicReadingPaths existing as its own entity in a later phase).
--------------------------------------------------------------------------- */
export function makeStory({
  id, title, description = "", seriesIds = [], runId = null, issueIds = [],
  continuityId = null, universeId = null, characterIds = [], creatorIds = [],
  eventId = null, sourceInfo,
} = {}) {
  return {
    id, title, description, seriesIds, runId, issueIds,
    continuityId, universeId, characterIds, creatorIds, eventId,
    sourceInfo: sourceInfo || makeSourceInfo(),
    createdAt: nowIso(), updatedAt: nowIso(),
  };
}
export function validateStory(s) {
  const errors = [];
  if (!s || !s.id) errors.push("story.id is required");
  if (!s || !s.title) errors.push("story.title is required");
  if (s && !Array.isArray(s.seriesIds)) errors.push("story.seriesIds must be an array (crossovers span multiple series)");
  if (s) validateSourceInfo(s.sourceInfo, errors, "story");
  return { valid: errors.length === 0, errors };
}

/* ---------------------------------------------------------------------------
   7. ISSUE
   issueNumber/issueLabel are always strings — "#0", "#23.1", "Annual",
   "Special", "One-Shot" all need to work without a schema change.
--------------------------------------------------------------------------- */
export function makeIssue({
  id, seriesId, issueNumber, issueLabel, issueLabelType = "numbered",
  title = "", publicationDate = null, coverDate = null, storyIds = [],
  continuityId = null, universeId = null, characterIds = [], creatorIds = [],
  eventIds = [], sourceInfo,
} = {}) {
  return {
    id, seriesId,
    issueNumber: issueNumber == null ? null : String(issueNumber),
    issueLabel: issueLabel || (issueNumber != null ? `#${issueNumber}` : ""),
    issueLabelType,
    title, publicationDate, coverDate, storyIds,
    continuityId, universeId, characterIds, creatorIds, eventIds,
    sourceInfo: sourceInfo || makeSourceInfo(),
    createdAt: nowIso(), updatedAt: nowIso(),
  };
}
export function validateIssue(i) {
  const errors = [];
  if (!i || !i.id) errors.push("issue.id is required");
  if (!i || !i.seriesId) errors.push("issue.seriesId is required");
  if (!i || typeof i.issueLabel !== "string" || !i.issueLabel) errors.push("issue.issueLabel is required (a display label, not just a number)");
  if (i && !ISSUE_LABEL_TYPES.includes(i.issueLabelType)) errors.push(`issue.issueLabelType: must be one of ${ISSUE_LABEL_TYPES.join("|")}`);
  if (i) validateSourceInfo(i.sourceInfo, errors, "issue");
  return { valid: errors.length === 0, errors };
}

/* ---------------------------------------------------------------------------
   8. COLLECTION / EDITION
   `issueCoverage` is structured (never a plain-text range like "Batman
   #1-7"), so future UI can answer "which collection contains issue X" and
   "which issues does this collection contain" directly.
   `issueIdsCovered` is a flat mirror of issueCoverage[].issueId that exists
   ONLY so Firestore can query it with array-contains (Firestore can't
   array-contains-match a field *inside* an array of objects) — it is kept in
   sync by upsertCollection() in data.js, never edited by hand.
--------------------------------------------------------------------------- */
export function makeCollection({
  id, title, publisher = "DC Comics", format = "TPB", publicationDate = null,
  isbn = null, pageCount = null, seriesIds = [], issueCoverage = [],
  storyIds = [], coverImage = null, editionInfo = null, sourceInfo,
} = {}) {
  return {
    id, title, publisher, format, publicationDate, isbn, pageCount,
    seriesIds,
    issueCoverage,                                     // [{seriesId, issueId, issueLabel, coveragePart}]
    issueIdsCovered: issueCoverage.map(c => c.issueId).filter(Boolean),
    storyIds, coverImage,
    editionInfo: editionInfo || { editionNumber: null, editionName: null, printing: null },
    sourceInfo: sourceInfo || makeSourceInfo(),
    createdAt: nowIso(), updatedAt: nowIso(),
  };
}
export function validateCollection(c) {
  const errors = [];
  if (!c || !c.id) errors.push("collection.id is required");
  if (!c || !c.title) errors.push("collection.title is required");
  if (c && !Array.isArray(c.issueCoverage)) {
    errors.push("collection.issueCoverage must be a structured array, not plain text (e.g. never \"Batman #1-7\" as a string)");
  } else if (c) {
    c.issueCoverage.forEach((row, idx) => {
      if (!row.issueId) errors.push(`collection.issueCoverage[${idx}].issueId is required`);
      if (!row.coveragePart) errors.push(`collection.issueCoverage[${idx}].coveragePart is required ("complete" | "partial")`);
    });
  }
  if (c) validateSourceInfo(c.sourceInfo, errors, "collection");
  return { valid: errors.length === 0, errors };
}

/* ---------------------------------------------------------------------------
   9. CREATOR
--------------------------------------------------------------------------- */
export function makeCreator({ id, name, displayName = "", roles = [], bio = "", image = null, sourceInfo } = {}) {
  return {
    id, name, displayName: displayName || name, roles, bio, image,
    sourceInfo: sourceInfo || makeSourceInfo(),
    createdAt: nowIso(), updatedAt: nowIso(),
  };
}
export function validateCreator(c) {
  const errors = [];
  if (!c || !c.id) errors.push("creator.id is required");
  if (!c || !c.name) errors.push("creator.name is required");
  if (c) validateSourceInfo(c.sourceInfo, errors, "creator");
  return { valid: errors.length === 0, errors };
}

/* ---------------------------------------------------------------------------
   10. RELATIONSHIP (generic graph edge between any two entities)
--------------------------------------------------------------------------- */
export function makeRelationship({
  id, sourceId, sourceType, relationshipType, targetId, targetType,
  metadata = {}, sourceInfo,
} = {}) {
  return {
    id, sourceId, sourceType, relationshipType, targetId, targetType,
    metadata,
    sourceInfo: sourceInfo || makeSourceInfo(),
    createdAt: nowIso(), updatedAt: nowIso(),
  };
}
export function validateRelationship(r) {
  const errors = [];
  if (!r || !r.id) errors.push("relationship.id is required");
  if (!r || !r.sourceId || !r.targetId) errors.push("relationship.sourceId and targetId are required");
  if (r && !ENTITY_TYPES.includes(r.sourceType)) errors.push(`relationship.sourceType: must be one of ${ENTITY_TYPES.join("|")}`);
  if (r && !ENTITY_TYPES.includes(r.targetType)) errors.push(`relationship.targetType: must be one of ${ENTITY_TYPES.join("|")}`);
  if (r && !RELATIONSHIP_TYPES.includes(r.relationshipType)) {
    errors.push(`relationship.relationshipType: "${r.relationshipType}" is outside the starting set (${RELATIONSHIP_TYPES.join("|")}) — allowed, just flagging`);
  }
  if (r) validateSourceInfo(r.sourceInfo, errors, "relationship");
  return { valid: errors.length === 0, errors };
}

/* ---------------------------------------------------------------------------
   11. READING PATH
   `entries` is an explicit, ordered, hand-curated list — reading paths are
   NEVER generated just by sorting issue numbers (Step 14).
--------------------------------------------------------------------------- */
export function makeReadingPath({
  id, characterId = null, continuityId = null, universeId = null,
  pathType, title, description = "", entries = [], branches = [], sourceInfo,
} = {}) {
  return {
    id, characterId, continuityId, universeId, pathType, title, description,
    entries,   // [{ order, entityType, entityId, branchLabel, note }]
    branches,  // [{ id, label, fromEntryIndex, entries:[...] }]
    sourceInfo: sourceInfo || makeSourceInfo(),
    createdAt: nowIso(), updatedAt: nowIso(),
  };
}
export function validateReadingPath(p) {
  const errors = [];
  if (!p || !p.id) errors.push("readingPath.id is required");
  if (!p || !p.title) errors.push("readingPath.title is required");
  if (p && !Array.isArray(p.entries)) errors.push("readingPath.entries must be an explicit ordered array (never derived by sorting issue numbers)");
  else if (p) p.entries.forEach((e, idx) => {
    if (e.order == null) errors.push(`readingPath.entries[${idx}].order is required`);
    if (!e.entityType || !e.entityId) errors.push(`readingPath.entries[${idx}] needs entityType + entityId`);
  });
  if (p) validateSourceInfo(p.sourceInfo, errors, "readingPath");
  return { valid: errors.length === 0, errors };
}
