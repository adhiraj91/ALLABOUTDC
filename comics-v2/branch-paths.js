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
const CSV_FILE_B12 = "new52_batch1_and_batch2_reading_paths_RIGOROUS_FINAL.csv";

const GL4 = (extra = []) => [
  { label: "Green Lantern", seriesId: "green-lantern" },
  { label: "Green Lantern Corps", seriesId: "green-lantern-corps" },
  { label: "Green Lantern: New Guardians", seriesId: "green-lantern-new-guardians" },
  { label: "Red Lanterns", seriesId: "red-lanterns" },
  ...extra,
];
// Participants that exist only as out-of-scope text on a collection's contents (no series record in the catalogue):
// they are shown as text cards that open that collection. Nothing is invented — the wording is the collection's own.
const B12 = "b12";
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
      // Batch 2 adds Teen Titans to THIS existing global event (no duplicate event). Until Batch 2 is imported the original text card is used (ifMissing).
      { label: "Teen Titans", seriesId: "teen-titans-2011", collectionIds: ["teen-titans-vol-3-death-of-the-family"], labels: ["15", "16", "17"], note: "Teen Titans #15-16 are the event tie-ins; #17 is the aftermath.",
        ifMissing: { seriesId: null, collectionIds: [JOKER_DOTF[0]], labels: [], note: "Teen Titans #15; pages from #14 and #16 — collected in The Joker: Death of the Family." } },
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
  {
    key: "jl-throne-of-atlantis", family: "Justice League", csv: { path_id: "THRONE_OF_ATLANTIS", trigger: "Throne of Atlantis", branch_from: "Justice League", branch_to: "Aquaman", branch_type: "crossover", reading_instruction: "Justice League main path → Throne of Atlantis → Aquaman branch → return to JL", notes: "Event relationship; do not create duplicate issues." },
    anchorSeriesIds: ["justice-league-2011", "aquaman-2011"], eventCollectionIds: ["justice-league-vol-3-throne-of-atlantis", "aquaman-vol-3-throne-of-atlantis"],
    branches: [{ label: "Justice League", seriesId: "justice-league-2011", labels: ["13", "14", "15", "16", "17"] }, { label: "Aquaman", seriesId: "aquaman-2011", labels: ["14", "15", "16"] }],
  },
  {
    key: "jl-trinity-war", family: "Justice League", csv: { path_id: "TRINITY_WAR", trigger: "Trinity War", branch_from: "Justice League", branch_to: "Justice League #22-23; Justice League of America #6-7; Justice League Dark #22-23; Constantine #5; Trinity of Sin: Pandora #1-3; Trinity of Sin: Phantom Stranger #11", branch_type: "crossover", reading_instruction: "JL main path → Trinity War → multiple League/Trinity branches → return", notes: "Full event collection." },
    anchorSeriesIds: ["justice-league-2011"], eventCollectionIds: ["justice-league-trinity-war"],
    branches: [
      { label: "Justice League", seriesId: "justice-league-2011", labels: ["22", "23"] },
      { label: "Justice League of America", seriesId: null, collectionIds: ["justice-league-trinity-war"], note: "Justice League of America #6-7 — collected in Justice League: Trinity War." },
      { label: "Justice League Dark", seriesId: null, collectionIds: ["justice-league-trinity-war"], note: "Justice League Dark #22-23 — collected in Justice League: Trinity War." },
      { label: "Constantine", seriesId: null, collectionIds: ["justice-league-trinity-war"], note: "Constantine #5 — collected in Justice League: Trinity War." },
      { label: "Trinity of Sin: Pandora", seriesId: null, collectionIds: ["justice-league-trinity-war"], note: "Trinity of Sin: Pandora #1-3 — collected in Justice League: Trinity War." },
      { label: "Trinity of Sin: Phantom Stranger", seriesId: null, collectionIds: ["justice-league-trinity-war"], note: "Trinity of Sin: Phantom Stranger #11 — collected in Justice League: Trinity War." },
    ],
  },
  {
    key: "ga-hawkman-wanted", family: "Green Arrow", csv: { path_id: "HAWKMAN_WANTED", trigger: "Hawkman: Wanted", branch_from: "Green Arrow", branch_to: "Green Arrow #14; Deathstroke #14; Savage Hawkman #14", branch_type: "crossover", reading_instruction: "Green Arrow → crossover → return", notes: "Green Arrow #14 is one chapter of the crossover; do not misclassify the other books as Green Arrow series. Batch 3 lists Savage Hawkman #13 for this event; the Batch 1 Green Arrow Vol. 3 listing says Savage Hawkman #14 (both kept as supplied)." },
    anchorSeriesIds: ["green-arrow-2011"], eventCollectionIds: [],
    branches: [
      { label: "Green Arrow", seriesId: "green-arrow-2011", collectionIds: ["green-arrow-vol-3-harrow"], labels: ["14"] },
      { label: "Deathstroke", seriesId: "deathstroke-2011", collectionIds: ["deathstroke-vol-2-lobo-hunt-original-edition", "deathstroke-vol-2-lobo-hunt-expanded-resolicited-edition"], labels: ["14"],
        ifMissing: { seriesId: null, collectionIds: [], labels: [], note: "Deathstroke #14 — not catalogued as a series here." } },
      { label: "Savage Hawkman", seriesId: "the-savage-hawkman-2011", collectionIds: ["the-savage-hawkman-vol-2-wanted"], labels: ["13"],
        ifMissing: { seriesId: null, collectionIds: ["green-arrow-vol-3-harrow"], labels: [], note: "Savage Hawkman #14 — included in Green Arrow Vol. 3: Harrow." } },
    ],
  },
  {
    key: "jl-forever-evil", family: "Justice League", src: B12, csv: { path_id: "FOREVER_EVIL", trigger: "Forever Evil", branch_from: "Justice League", branch_to: "Forever Evil #1-7; Justice League #24-29", branch_type: "crossover", reading_instruction: "JL main path after Trinity War → Forever Evil → JL branch / Crime Syndicate aftermath → return at JL #30", notes: "Justice League branch of the universe-wide Forever Evil event; JL #24-29 are collected as Forever Heroes. No duplicate issue records for the event." },
    anchorSeriesIds: ["justice-league-2011"], eventCollectionIds: ["forever-evil-hc"], followsKey: "jl-trinity-war",
    branches: [
      // Main event first, then the Justice League branch, then the tie-in books the catalogue already holds (only where they exist).
      { label: "Forever Evil", seriesId: null, collectionIds: ["forever-evil-hc"], note: "Main event: Forever Evil #1-7 — collected in Forever Evil HC." },
      { label: "Justice League", seriesId: "justice-league-2011", collectionIds: ["justice-league-vol-5-forever-heroes"], labels: ["24", "25", "26", "27", "28", "29"] },
      { label: "Forever Evil: Blight", seriesId: null, collectionIds: ["forever-evil-blight"], optional: true, note: "Tie-in: Justice League Dark #24-29, Constantine #9-12, Trinity of Sin: Pandora #6-9, Trinity of Sin: Phantom Stranger #14-17 — collected in Forever Evil: Blight." },
      { label: "Forever Evil: Rogues Rebellion", seriesId: null, collectionIds: ["forever-evil-rogues-rebellion"], optional: true, note: "Tie-in collected in Forever Evil: Rogues Rebellion." },
    ],
  },
  {
    key: "jl-darkseid-war", family: "Justice League", src: B12, csv: { path_id: "DARKSEID_WAR", trigger: "Darkseid War", branch_from: "Justice League", branch_to: "JL #40-50; Darkseid War Special #1; Divergence JL story", branch_type: "crossover", reading_instruction: "JL Vol.7 → Darkseid War branches/specials → JL Vol.8", notes: "Premium editions (Omnibus, Essential Edition) are separate publications of the same issues." },
    anchorSeriesIds: ["justice-league-2011"], eventCollectionIds: ["justice-league-the-darkseid-war-saga-omnibus", "justice-league-the-darkseid-war-dc-essential-edition"],
    branches: [
      { label: "Justice League", seriesId: "justice-league-2011", collectionIds: ["justice-league-vol-7-darkseid-war-part-1", "justice-league-vol-8-darkseid-war-part-2"], labels: ["40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50"] },
      { label: "DC Comics: Divergence #1 — Justice League story", seriesId: null, collectionIds: ["justice-league-vol-7-darkseid-war-part-1"], note: "Collected in Justice League Vol. 7: Darkseid War Part 1." },
      { label: "Justice League: Darkseid War Special #1", seriesId: null, collectionIds: ["justice-league-vol-8-darkseid-war-part-2"], note: "Collected in Justice League Vol. 8: Darkseid War Part 2." },
    ],
  },
  {
    key: "dark-rise-of-the-vampires", family: "Justice League Dark", src: B12, csv: { path_id: "RISE_OF_THE_VAMPIRES", trigger: "Rise of the Vampires", branch_from: "Justice League Dark + I, Vampire", branch_to: "I, Vampire #7-12; Justice League Dark #7-8", branch_type: "crossover", reading_instruction: "JLD main path → vampire branch → I, Vampire → JLD #9 → return", notes: "Branch between I, Vampire and JLD. Dedicated collection is I, Vampire Vol. 2." },
    anchorSeriesIds: ["justice-league-dark-2011", "i-vampire-2011"], eventCollectionIds: ["i-vampire-vol-2-rise-of-the-vampires"],
    branches: [
      { label: "Justice League Dark", seriesId: "justice-league-dark-2011", collectionIds: ["justice-league-dark-vol-2-the-books-of-magic"], labels: ["7", "8"] },
      { label: "I, Vampire", seriesId: "i-vampire-2011", collectionIds: ["i-vampire-vol-2-rise-of-the-vampires"], labels: ["7", "8", "9", "10", "11", "12"] },
    ],
  },
  {
    key: "dark-rotworld", family: "Swamp Thing", src: B12, csv: { path_id: "ROTWORLD", trigger: "Rotworld", branch_from: "Swamp Thing + Animal Man + Frankenstein", branch_to: "Animal Man #12-17; Swamp Thing #12-18; Frankenstein #13-16", branch_type: "crossover", reading_instruction: "Animal Man / Swamp Thing main paths → Rotworld → parallel Red/Green/Frankenstein branches → merge after Rotworld", notes: "Animal Man / Swamp Thing are the two principal collected branches; Frankenstein #13-16 is the parallel S.H.A.D.E. branch. Not collapsed into one series collection." },
    anchorSeriesIds: ["swamp-thing-2011", "animal-man-2011"], eventCollectionIds: ["swamp-thing-vol-3-rotworld-the-green-kingdom", "animal-man-vol-3-rotworld-the-red-kingdom"],
    branches: [
      { label: "Swamp Thing", seriesId: "swamp-thing-2011", collectionIds: ["swamp-thing-vol-3-rotworld-the-green-kingdom"], labels: ["12", "13", "14", "15", "16", "17", "18"] },
      { label: "Animal Man", seriesId: "animal-man-2011", collectionIds: ["animal-man-vol-3-rotworld-the-red-kingdom"], labels: ["12", "13", "14", "15", "16", "17"] },
      { label: "Frankenstein: Agent of S.H.A.D.E.", seriesId: "frankenstein-agent-of-s-h-a-d-e-2011", collectionIds: ["frankenstein-agent-of-s-h-a-d-e-vol-2-secrets-of-the-dead"], labels: ["13", "14", "15", "16"] },
    ],
  },
  {
    key: "dark-blight", family: "Justice League Dark", src: B12, csv: { path_id: "FOREVER_EVIL_BLIGHT", trigger: "Forever Evil: Blight", branch_from: "Justice League Dark + Constantine + Pandora + Phantom Stranger", branch_to: "JLD #24-29; Constantine #9-12; Pandora #6-9; Phantom Stranger #14-17", branch_type: "crossover", reading_instruction: "JLD / Constantine / Trinity of Sin → Blight → four-series branches → merge into post-Blight status quo", notes: "Dedicated four-series crossover collection." },
    anchorSeriesIds: ["justice-league-dark-2011", "constantine-2013", "trinity-of-sin-pandora-2013", "trinity-of-sin-phantom-stranger-2012"], eventCollectionIds: ["forever-evil-blight"],
    branches: [
      { label: "Justice League Dark", seriesId: "justice-league-dark-2011", collectionIds: ["justice-league-dark-vol-4-the-rebirth-of-evil"], labels: ["24", "25", "26", "27", "28", "29"] },
      { label: "Constantine", seriesId: "constantine-2013", collectionIds: ["constantine-vol-2-blight"], labels: ["9", "10", "11", "12"] },
      { label: "Trinity of Sin: Pandora", seriesId: "trinity-of-sin-pandora-2013", collectionIds: ["trinity-of-sin-pandora-vol-2-choices"], labels: ["6", "7", "8", "9"] },
      { label: "Trinity of Sin: Phantom Stranger", seriesId: "trinity-of-sin-phantom-stranger-2012", collectionIds: ["trinity-of-sin-the-phantom-stranger-vol-3-the-crack-in-creation"], labels: ["14", "15", "16", "17"] },
    ],
  },
  {
    key: "ss-resurrection-man", family: "Suicide Squad", src: B12, csv: { path_id: "RESMAN_SUICIDE_SQUAD", trigger: "Resurrection Man / Suicide Squad crossover", branch_from: "Resurrection Man + Suicide Squad", branch_to: "Suicide Squad #9 → Resurrection Man #9", branch_type: "crossover", reading_instruction: "Resurrection Man #8 lead-in → Suicide Squad #9 → Resurrection Man #9 → return", notes: "Officially advertised as a two-part crossover; Suicide Squad #9 is Part 1 and Resurrection Man #9 continues it." },
    anchorSeriesIds: ["resurrection-man-2011", "suicide-squad-2011"], eventCollectionIds: ["resurrection-man-vol-2-a-matter-of-death-and-life", "suicide-squad-vol-2-basilisk-rising"],
    branches: [
      { label: "Resurrection Man", seriesId: "resurrection-man-2011", collectionIds: ["resurrection-man-vol-2-a-matter-of-death-and-life"], labels: ["8", "9"] },
      { label: "Suicide Squad", seriesId: "suicide-squad-2011", collectionIds: ["suicide-squad-vol-2-basilisk-rising"], labels: ["9"] },
    ],
  },
  {
    key: "teen-culling", family: "Teen Titans", src: B12, csv: { path_id: "THE_CULLING", trigger: "The Culling", branch_from: "Teen Titans + Superboy + Legion Lost", branch_to: "Teen Titans #8-14; Superboy #8-12; Legion Lost #8-10; DCPU #12", branch_type: "crossover", reading_instruction: "Teen Titans #8 → Culling → Superboy/Legion Lost branches → Teen Titans #14 → return", notes: "Event relationship is broader than the Teen Titans Vol. 2 collection, which itself contains TT #8-14 + DCPU #12." },
    anchorSeriesIds: ["teen-titans-2011"], eventCollectionIds: ["teen-titans-vol-2-the-culling"],
    branches: [
      { label: "Teen Titans", seriesId: "teen-titans-2011", collectionIds: ["teen-titans-vol-2-the-culling"], labels: ["8", "9", "10", "11", "12", "13", "14"] },
      { label: "Superboy", seriesId: "superboy-2011", collectionIds: ["superboy-vol-2-extraction"], labels: ["8", "9", "10", "11", "12"] },
      { label: "Legion Lost", seriesId: "legion-lost-2011", collectionIds: ["legion-lost-vol-2-the-culling"], labels: ["8", "9"],
        ifMissing: { seriesId: null, collectionIds: [], labels: [], note: "Legion Lost #8-10 — not catalogued as a series here." } },
      { label: "DC Universe Presents #12", seriesId: null, collectionIds: ["teen-titans-vol-2-the-culling"], note: "Included in Teen Titans Vol. 2: The Culling." },
    ],
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
    branches: d.branches.map((b, i) => ({ id: `${idFor(d)}-b${i + 1}`, label: b.label, fromEntryIndex: null, entries: [], seriesId: b.seriesId || null, collectionIds: b.collectionIds || [], connection: !!b.connection, related: !!b.related, note: b.note || "", labels: b.labels || [] })),
    family: d.family, seriesIds,
    anchorSeriesIds: d.anchorSeriesIds || [], mainCollectionIds: d.mainCollectionIds || [],
    eventCollectionIds: d.eventCollectionIds || [],
    nextPathId: d.nextKey ? "bp-" + d.nextKey : null, followsPathId: d.followsKey ? "bp-" + d.followsKey : null,
    branchType: d.csv.branch_type, branchFrom: d.csv.branch_from, branchTo: d.csv.branch_to,
    readingInstruction: d.csv.reading_instruction, csvNotes: d.csv.notes, pathCode: d.csv.path_id,
    dataBasis: BRANCH_BASIS,
    sourceInfo: { sourceUrl: null, sourceName: d.src === B12 ? CSV_FILE_B12 : CSV_FILE, verificationStatus: "owner_supplied", notes: d.src === B12 ? "Owner-supplied Batch 1 + Batch 2 reading-path CSV." : "Owner-supplied branching reading-path CSV." },
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
/** A branch may carry `ifMissing`: the text-only wording used while the participating series/collections are not imported yet. */
async function resolveDef(d, getEntity) {
  const branches = [];
  for (const b of d.branches) {
    if (!b.ifMissing && !b.optional) { branches.push(b); continue; }
    const ok = (!b.seriesId || await getEntity(COLLECTIONS.SERIES, b.seriesId)) && (await Promise.all((b.collectionIds || []).map(id => getEntity(COLLECTIONS.COLLECTIONS, id)))).every(Boolean);
    if (ok) branches.push(b); else if (!b.optional) branches.push({ label: b.label, ...b.ifMissing });
  }
  return { ...d, branches };
}
export async function importBranchPaths({ upsertEntity, getEntity, progress, only = null } = {}) {
  const validation = validate();
  const result = { validation, written: 0, skipped: [], errors: [] };
  if (!validation.valid) return result;
  for (const def of BRANCH_DEFS.filter(d => !only || only.includes(idFor(d)))) {
    let doc; try { doc = buildDoc(await resolveDef(def, getEntity)); } catch (e) { result.errors.push(`${idFor(def)}: ${e.message}`); continue; }
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
