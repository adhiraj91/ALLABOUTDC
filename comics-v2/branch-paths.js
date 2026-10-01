// ============================================================================
// comics-v2 / branch-paths.js — New 52 branching reading paths
// ----------------------------------------------------------------------------
// Source of truth: the owner-supplied new52_existing_branching_reading_paths.csv (nothing here is researched).
// Model: the EXISTING comicReadingPaths collection, using the schema's own `branches` field.
//   run/series -> event (shared node) -> branches -> return to each series
// A branch path is a RELATIONSHIP between entities that already exist (series ids + collection ids). It stores no
// issues and no collections of its own, so nothing is duplicated.
// Isolation: `entries` is left empty and characterId/continuityId/universeId are null, so the Atlas and the
// reader-progress "continue reading" logic (which read reading paths by continuity/character, or only paths with
// entries) never pick these up. Only the series/run detail page reads them, by `seriesIds`.
// ============================================================================
import { db } from "../firebase-config.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { COLLECTIONS } from "./schema.js";

export const BRANCH_BASIS = "owner_csv_branching";
const CSV_FILE = "new52_existing_branching_reading_paths.csv";

const GL4 = (extra = []) => [
  { label: "Green Lantern", seriesId: "green-lantern" },
  { label: "Green Lantern Corps", seriesId: "green-lantern-corps" },
  { label: "Green Lantern: New Guardians", seriesId: "green-lantern-new-guardians" },
  { label: "Red Lanterns", seriesId: "red-lanterns" },
  ...extra,
];

// Each entry = one CSV row (csv:{…} is the row verbatim) + the ids it resolves to in the existing catalogue.
export const BRANCH_DEFS = [
  {
    family: "Batman", csv: { path_id: "BAT-DOTF", trigger: "Death of the Family", branch_from: "Batman Vol. 3: Death of the Family", branch_to: "Bat-family tie-in stories", branch_type: "event_branch", reading_instruction: "After entering the event, offer Bat-family tie-ins as an optional/complete-event branch before returning to Batman.", notes: "Keep the event separate from Detective/Batman run identity." },
    anchorSeriesIds: ["batman-2011"], mainCollectionIds: ["batman-vol-3-death-of-the-family", "batman-vol-3-death-of-the-family-hc"],
    eventCollectionIds: ["the-joker-death-of-the-family", "the-joker-death-of-the-family-hc"],
    branches: [
      { label: "Batman", seriesId: "batman-2011" },
      { label: "Catwoman", seriesId: "catwoman-2011" }, { label: "Batgirl", seriesId: "batgirl-2011" },
      { label: "Batman and Robin", seriesId: "batman-and-robin-2011" }, { label: "Nightwing", seriesId: "nightwing-2011" },
      { label: "Detective Comics", seriesId: "detective-comics-2011" }, { label: "Red Hood and the Outlaws", seriesId: "red-hood-and-the-outlaws-2011" },
    ],
  },
  {
    family: "Batman", csv: { path_id: "BAT-ROBINWAR", trigger: "Robin War", branch_from: "Detective Comics #47 / Robin War", branch_to: "Bat-family tie-ins", branch_type: "event_branch", reading_instruction: "Offer Robin War as a crossover branch, then return to the relevant Bat-family continuations.", notes: "Do not make Robin War the Detective Comics story identity." },
    anchorSeriesIds: ["detective-comics-2011"], eventCollectionIds: ["robin-war"],
    branches: [
      { label: "Detective Comics", seriesId: "detective-comics-2011" }, { label: "Grayson", seriesId: "grayson-2014" },
      { label: "We Are Robin", seriesId: "we-are-robin-2015" }, { label: "Robin: Son of Batman", seriesId: "robin-son-of-batman-2015" },
      { label: "Gotham Academy", seriesId: "gotham-academy-2014" }, { label: "Red Hood/Arsenal", seriesId: "red-hood-arsenal-2015" },
    ],
  },
  {
    family: "Superman", csv: { path_id: "SUP-HEL", trigger: "H'el on Earth", branch_from: "Superman / Supergirl / Superboy crossover point", branch_to: "Superman; Supergirl; Superboy", branch_type: "multi_series_branch", reading_instruction: "Show the three Superman-family branches, then return to each series.", notes: "Do not duplicate issues." },
    anchorSeriesIds: ["superman-2011", "supergirl-2011", "superboy-2011"], eventCollectionIds: ["superman-hel-on-earth"],
    branches: [{ label: "Superman", seriesId: "superman-2011" }, { label: "Supergirl", seriesId: "supergirl-2011" }, { label: "Superboy", seriesId: "superboy-2011" }],
  },
  {
    family: "Superman", csv: { path_id: "SUP-DOOMED", trigger: "Doomed", branch_from: "Action Comics / Superman / Supergirl / Superman-Wonder Woman", branch_to: "Doomed crossover branches", branch_type: "multi_series_branch", reading_instruction: "Offer a complete Doomed branch and return to each participating series.", notes: "Do not make Doomed the primary identity of any series." },
    anchorSeriesIds: ["action-comics-2011", "superman-2011", "supergirl-2011", "superman-wonder-woman-2013"], eventCollectionIds: ["superman-doomed"],
    branches: [{ label: "Action Comics", seriesId: "action-comics-2011" }, { label: "Superman", seriesId: "superman-2011" }, { label: "Supergirl", seriesId: "supergirl-2011" }, { label: "Superman/Wonder Woman", seriesId: "superman-wonder-woman-2013" }],
  },
  {
    // No single "Truth" collection exists in the catalogue: each title's own Truth-named volume is the branch,
    // so the era stays a path across separate series rather than a collection.
    family: "Superman", csv: { path_id: "SUP-TRUTH", trigger: "Truth", branch_from: "Superman / Action Comics / Superman-Wonder Woman / related titles", branch_to: "Truth-era branches", branch_type: "event_branch", reading_instruction: "Show Truth as a branching era/event path while preserving individual series chronology.", notes: "Keep series separate." },
    anchorSeriesIds: ["action-comics-2011", "superman-2011", "superman-wonder-woman-2013"], eventCollectionIds: [],
    branches: [
      { label: "Action Comics", seriesId: "action-comics-2011", collectionIds: ["action-comics-vol-8-truth"] },
      { label: "Superman", seriesId: "superman-2011", collectionIds: ["superman-vol-1-before-truth"] },
      { label: "Superman/Wonder Woman", seriesId: "superman-wonder-woman-2013", collectionIds: ["superman-wonder-woman-vol-4-dark-truth"] },
      { label: "Batman/Superman", seriesId: "batman-superman-2013", collectionIds: ["batman-superman-vol-5-truth-hurts", "batman-superman-vol-5-truth-hurts-tpb"], related: true },
    ],
  },
  {
    family: "Flash", csv: { path_id: "FLASH-ROGUES", trigger: "Forever Evil: Rogues Rebellion", branch_from: "The Flash / Flash #23.3", branch_to: "Rogues Rebellion", branch_type: "event_branch", reading_instruction: "Offer Rogues Rebellion as an optional crossover branch, then return to Flash.", notes: "Do not count it as another mainline Flash volume." },
    anchorSeriesIds: ["the-flash-2011"], eventCollectionIds: ["forever-evil-rogues-rebellion"],
    branches: [{ label: "The Flash", seriesId: "the-flash-2011" }],
  },
  {
    family: "Green Lantern", csv: { path_id: "GL-THIRD-ARMY", trigger: "Rise of the Third Army", branch_from: "Green Lantern #13-16 / event boundary", branch_to: "Green Lantern; Green Lantern Corps; New Guardians; Red Lanterns", branch_type: "multi_series_branch", reading_instruction: "Branch into the four Lantern series; allow main-series-only or complete-event exploration.", notes: "Represent the event as one shared node." },
    anchorSeriesIds: ["green-lantern"], eventCollectionIds: ["green-lantern-rise-of-the-third-army"], branches: GL4(),
  },
  {
    family: "Green Lantern", csv: { path_id: "GL-FIRST-LANTERN", trigger: "Wrath of the First Lantern", branch_from: "Third Army branches", branch_to: "Green Lantern; Green Lantern Corps; New Guardians; Red Lanterns", branch_type: "multi_series_merge", reading_instruction: "Show the four Lantern branches converging into this event, then returning to their series.", notes: "Merge point after Third Army." },
    anchorSeriesIds: ["green-lantern"], eventCollectionIds: ["green-lantern-the-wrath-of-the-first-lantern"], mergeFromPathId: "GL-THIRD-ARMY", branches: GL4(),
  },
  {
    family: "Green Lantern", csv: { path_id: "GL-LIGHTS-OUT", trigger: "Lights Out", branch_from: "Green Lantern #23.1 / #24 boundary", branch_to: "Green Lantern; Green Lantern Corps; New Guardians; Red Lanterns", branch_type: "multi_series_branch", reading_instruction: "Show shared event with parallel Lantern branches and return paths.", notes: "Keep event separate from series identity." },
    anchorSeriesIds: ["green-lantern"], eventCollectionIds: ["green-lantern-lights-out"], branches: GL4(),
  },
  {
    family: "Green Lantern", csv: { path_id: "GL-GODHEAD", trigger: "Godhead", branch_from: "Green Lantern #35-37 boundary", branch_to: "Green Lantern; Green Lantern Corps; New Guardians; Red Lanterns; Sinestro; New Gods", branch_type: "multi_series_branch", reading_instruction: "Show the large crossover as a branch and preserve each series' continuation afterward.", notes: "New Gods material is an event connection." },
    anchorSeriesIds: ["green-lantern"], eventCollectionIds: ["green-lantern-new-gods-godhead"],
    branches: GL4([{ label: "Sinestro", seriesId: "sinestro" }, { label: "New Gods", seriesId: null, connection: true, note: "New Gods material is an event connection." }]),
  },
];

const idFor = (d) => "bp-" + d.csv.path_id.toLowerCase();

/** Build the Firestore document for one definition (schema-shaped reading path + branch data in `branches`). */
export function buildDoc(d) {
  const seriesIds = [...new Set([...(d.anchorSeriesIds || []), ...d.branches.map(b => b.seriesId).filter(Boolean)])];
  return {
    id: idFor(d),
    characterId: null, continuityId: null, universeId: null,
    pathType: "event_crossover",
    title: d.csv.trigger,
    description: d.csv.reading_instruction,
    entries: [],
    branches: d.branches.map((b, i) => ({ id: `${idFor(d)}-b${i + 1}`, label: b.label, fromEntryIndex: null, entries: [], seriesId: b.seriesId || null, collectionIds: b.collectionIds || [], connection: !!b.connection, related: !!b.related, note: b.note || "" })),
    family: d.family, seriesIds,
    anchorSeriesIds: d.anchorSeriesIds || [], mainCollectionIds: d.mainCollectionIds || [],
    eventCollectionIds: d.eventCollectionIds || [], mergeFromPathId: d.mergeFromPathId ? idFor({ csv: { path_id: d.mergeFromPathId } }) : null,
    branchType: d.csv.branch_type, branchFrom: d.csv.branch_from, branchTo: d.csv.branch_to,
    readingInstruction: d.csv.reading_instruction, csvNotes: d.csv.notes, pathCode: d.csv.path_id,
    dataBasis: BRANCH_BASIS,
    sourceInfo: { sourceUrl: null, sourceName: CSV_FILE, verificationStatus: "owner_supplied", notes: "Owner-supplied branching reading-path CSV." },
  };
}
export const buildAll = () => BRANCH_DEFS.map(buildDoc);

export function validate() {
  const errors = [], ids = new Set();
  for (const d of buildAll()) {
    if (ids.has(d.id)) errors.push("duplicate " + d.id); ids.add(d.id);
    if (!d.entries || d.entries.length) errors.push(d.id + ": entries must stay empty");
    if (!d.eventCollectionIds.length && !d.branches.some(b => (b.collectionIds || []).length)) errors.push(d.id + ": no event or branch collections");
    if (!d.branches.length) errors.push(d.id + ": no branches");
    if (d.mergeFromPathId && !ids.has(d.mergeFromPathId) && !BRANCH_DEFS.some(x => idFor(x) === d.mergeFromPathId)) errors.push(d.id + ": unknown merge source");
  }
  return { valid: errors.length === 0, errors, count: ids.size };
}

/** Isolated, additive, idempotent. Writes only bp-* ids in comicReadingPaths; reads (never writes) series/collections. */
export async function importBranchPaths({ upsertEntity, getEntity, progress } = {}) {
  const validation = validate();
  const result = { validation, written: 0, skipped: [], errors: [] };
  if (!validation.valid) return result;
  for (const doc of buildAll()) {
    const need = [
      ...doc.seriesIds.map(id => [COLLECTIONS.SERIES, id]),
      ...[...doc.eventCollectionIds, ...doc.mainCollectionIds, ...doc.branches.flatMap(b => b.collectionIds)].map(id => [COLLECTIONS.COLLECTIONS, id]),
    ];
    try {
      const missing = [];
      for (const [col, id] of need) if (!(await getEntity(col, id))) missing.push(id);
      if (missing.length) { result.skipped.push(`${doc.title}: needs ${[...new Set(missing)].slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""} (import that family first)`); continue; }
      const existing = await getEntity(COLLECTIONS.READING_PATHS, doc.id);
      if (existing && existing.dataBasis !== BRANCH_BASIS) { result.errors.push(`${doc.id}: id already used by another reading path — left untouched`); continue; }
      if (progress) progress(`Writing branch path: ${doc.title}…`);
      await upsertEntity(COLLECTIONS.READING_PATHS, doc.id, doc);
      result.written++;
    } catch (e) { result.errors.push(`${doc.id}: ${e.message}`); }
  }
  return result;
}

/** Branch paths a series takes part in (targeted array-contains query; the collection holds only a handful of docs). */
export async function getBranchPathsForSeries(seriesId) {
  const snap = await getDocs(query(collection(db, COLLECTIONS.READING_PATHS), where("seriesIds", "array-contains", seriesId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.dataBasis === BRANCH_BASIS);
}
