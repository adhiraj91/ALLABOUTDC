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
// Participants that exist only as out-of-scope text on a collection's contents (no series record in the catalogue):
// they are shown as text cards that open that collection. Nothing is invented — the wording is the collection's own.
const JOKER_DOTF = ["the-joker-death-of-the-family", "the-joker-death-of-the-family-hc"];

// Each entry = one row of new52_all_existing_branching_source_of_truth.csv (csv:{…} verbatim) + the existing ids it resolves to.
// `key` keeps the stored document id stable (bp-<key>) so re-importing updates the earlier records in place.
export const BRANCH_DEFS = [
  {
    key: "bat-dotf", family: "Batman", csv: { path_id: "DOTF", trigger: "Death of the Family", branch_from: "Batman Vol. 3: Death of the Family", branch_to: "Batman", branch_type: "main_event", reading_instruction: "Read through Batman Vol. 3, then explore the crossover branches. Return to the main story afterward.", notes: "Participants: Batman, Batgirl, Catwoman, Batman and Robin, Nightwing, Detective Comics, Red Hood and the Outlaws, Teen Titans, Suicide Squad." },
    anchorSeriesIds: ["batman-2011"], mainCollectionIds: ["batman-vol-3-death-of-the-family", "batman-vol-3-death-of-the-family-hc"],
    eventCollectionIds: JOKER_DOTF,
    branches: [
      { label: "Batman", seriesId: "batman-2011" }, { label: "Batgirl", seriesId: "batgirl-2011" }, { label: "Catwoman", seriesId: "catwoman-2011" },
      { label: "Batman and Robin", seriesId: "batman-and-robin-2011" }, { label: "Nightwing", seriesId: "nightwing-2011" },
      { label: "Detective Comics", seriesId: "detective-comics-2011" }, { label: "Red Hood and the Outlaws", seriesId: "red-hood-and-the-outlaws-2011" },
      { label: "Teen Titans", seriesId: null, collectionIds: [JOKER_DOTF[0]], note: "Teen Titans #15; pages from #14 and #16 — collected in The Joker: Death of the Family." },
      { label: "Suicide Squad", seriesId: null, collectionIds: [JOKER_DOTF[0]], note: "Pages from Suicide Squad #14-15 — collected in The Joker: Death of the Family." },
    ],
  },
  {
    key: "bat-robinwar", family: "Batman", csv: { path_id: "ROBIN_WAR", trigger: "Robin War", branch_from: "Batman", branch_to: "Bat-family branches", branch_type: "crossover", reading_instruction: "Enter Robin War from the Batman-family path, explore participating branches, then return to the main path.", notes: "Use existing site data only." },
    anchorSeriesIds: ["batman-2011"], eventCollectionIds: ["robin-war"],
    branches: [
      { label: "Detective Comics", seriesId: "detective-comics-2011" }, { label: "Grayson", seriesId: "grayson-2014" },
      { label: "We Are Robin", seriesId: "we-are-robin-2015" }, { label: "Robin: Son of Batman", seriesId: "robin-son-of-batman-2015" },
      { label: "Gotham Academy", seriesId: "gotham-academy-2014" }, { label: "Red Hood/Arsenal", seriesId: "red-hood-arsenal-2015" },
      { label: "Teen Titans", seriesId: null, collectionIds: ["robin-war"], note: "Teen Titans #15 — collected in Robin War." },
    ],
  },
  {
    key: "sup-hel", family: "Superman", csv: { path_id: "HEL", trigger: "H'el on Earth", branch_from: "Superman / Supergirl / Superboy", branch_to: "Superman-family branches", branch_type: "crossover", reading_instruction: "Enter H'el on Earth, explore participating Superman-family branches, then return to the relevant main path.", notes: "Use existing Superman source-of-truth data." },
    anchorSeriesIds: ["superman-2011", "supergirl-2011", "superboy-2011"], eventCollectionIds: ["superman-hel-on-earth"],
    branches: [{ label: "Superman", seriesId: "superman-2011" }, { label: "Supergirl", seriesId: "supergirl-2011" }, { label: "Superboy", seriesId: "superboy-2011" }],
  },
  {
    // The crossover only. The separate Doomed #1-6 mini-series (doomed-2015) is deliberately NOT referenced here.
    key: "sup-doomed", family: "Superman", csv: { path_id: "DOOMED", trigger: "Doomed", branch_from: "Superman", branch_to: "Action Comics / Superman / Supergirl / Superman-Wonder Woman", branch_type: "crossover", reading_instruction: "Enter Doomed, explore participating branches, then return to the main Superman-family path.", notes: "Do not merge this event with the separate Doomed #1-6 mini-series." },
    anchorSeriesIds: ["superman-2011"], eventCollectionIds: ["superman-doomed"],
    branches: [{ label: "Action Comics", seriesId: "action-comics-2011" }, { label: "Superman", seriesId: "superman-2011" }, { label: "Supergirl", seriesId: "supergirl-2011" }, { label: "Superman/Wonder Woman", seriesId: "superman-wonder-woman-2013" }, { label: "Batman/Superman", seriesId: "batman-superman-2013" }],
  },
  {
    // No single "Truth" collection exists in the catalogue: each title's own Truth-named volume is its branch.
    key: "sup-truth", family: "Superman", csv: { path_id: "TRUTH", trigger: "Truth", branch_from: "Superman", branch_to: "Superman-family branches", branch_type: "crossover", reading_instruction: "Enter Truth and follow the relevant Superman-family branches before continuing the main path.", notes: "Use existing site data only." },
    anchorSeriesIds: ["superman-2011"], eventCollectionIds: [],
    branches: [
      { label: "Superman", seriesId: "superman-2011", collectionIds: ["superman-vol-1-before-truth"] },
      { label: "Action Comics", seriesId: "action-comics-2011", collectionIds: ["action-comics-vol-8-truth"] },
      { label: "Superman/Wonder Woman", seriesId: "superman-wonder-woman-2013", collectionIds: ["superman-wonder-woman-vol-4-dark-truth"] },
      { label: "Batman/Superman", seriesId: "batman-superman-2013", collectionIds: ["batman-superman-vol-5-truth-hurts", "batman-superman-vol-5-truth-hurts-tpb"], related: true },
    ],
  },
  {
    key: "flash-rogues", family: "Flash", csv: { path_id: "ROGUES_REBELLION", trigger: "Forever Evil: Rogues Rebellion", branch_from: "The Flash", branch_to: "Rogues Rebellion", branch_type: "crossover", reading_instruction: "Branch from the Flash path into Rogues Rebellion, then return to the Flash path.", notes: "Use existing Flash source-of-truth data." },
    anchorSeriesIds: ["the-flash-2011"], eventCollectionIds: ["forever-evil-rogues-rebellion"],
    branches: [{ label: "The Flash", seriesId: "the-flash-2011" }],
  },
  {
    key: "gl-third-army", family: "Green Lantern", csv: { path_id: "THIRD_ARMY", trigger: "Rise of the Third Army", branch_from: "Green Lantern", branch_to: "Green Lantern / Green Lantern Corps / New Guardians / Red Lanterns", branch_type: "crossover", reading_instruction: "Enter Rise of the Third Army, follow the participating Lantern branches, then continue into Wrath of the First Lantern.", notes: "Use existing Green Lantern source-of-truth data." },
    anchorSeriesIds: ["green-lantern"], eventCollectionIds: ["green-lantern-rise-of-the-third-army"], nextKey: "gl-first-lantern", branches: GL4(),
  },
  {
    key: "gl-first-lantern", family: "Green Lantern", csv: { path_id: "FIRST_LANTERN", trigger: "Wrath of the First Lantern", branch_from: "Green Lantern", branch_to: "Green Lantern / Green Lantern Corps / New Guardians / Red Lanterns", branch_type: "crossover", reading_instruction: "Follow the participating Lantern branches, then merge back into the main Lantern path.", notes: "Follows Rise of the Third Army." },
    anchorSeriesIds: ["green-lantern"], eventCollectionIds: ["green-lantern-the-wrath-of-the-first-lantern"], followsKey: "gl-third-army", branches: GL4(),
  },
  {
    key: "gl-lights-out", family: "Green Lantern", csv: { path_id: "LIGHTS_OUT", trigger: "Lights Out", branch_from: "Green Lantern", branch_to: "Green Lantern / Green Lantern Corps / New Guardians / Red Lanterns", branch_type: "crossover", reading_instruction: "Enter Lights Out and expose all participating Lantern branches before returning to the main path.", notes: "Use existing event data." },
    anchorSeriesIds: ["green-lantern"], eventCollectionIds: ["green-lantern-lights-out"], branches: GL4(),
  },
  {
    key: "gl-godhead", family: "Green Lantern", csv: { path_id: "GODHEAD", trigger: "Godhead", branch_from: "Green Lantern", branch_to: "Green Lantern / Green Lantern Corps / New Guardians / Red Lanterns / Sinestro", branch_type: "crossover", reading_instruction: "Enter Godhead and expose all participating Lantern branches before returning to the main path.", notes: "Use existing event data." },
    anchorSeriesIds: ["green-lantern"], eventCollectionIds: ["green-lantern-new-gods-godhead"], branches: GL4([{ label: "Sinestro", seriesId: "sinestro" }]),
  },
];

const idFor = (d) => "bp-" + d.key;

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
    eventCollectionIds: d.eventCollectionIds || [],
    nextPathId: d.nextKey ? "bp-" + d.nextKey : null, followsPathId: d.followsKey ? "bp-" + d.followsKey : null,
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
    for (const ref of [d.nextPathId, d.followsPathId]) if (ref && !BRANCH_DEFS.some(x => idFor(x) === ref)) errors.push(d.id + ": unknown linked path " + ref);
    if (d.eventCollectionIds.includes("doomed") || d.seriesIds.includes("doomed-2015")) errors.push(d.id + ": the Doomed mini-series must not be merged into the crossover");
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
