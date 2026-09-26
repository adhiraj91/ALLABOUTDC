// ============================================================================
// comics-v2 / seed-batman-new52-collections.js
// ----------------------------------------------------------------------------
// POINTER 5 — SEED ADDITIONS (NOT auto-imported — see index.js / final report).
//
// The Pointer 4 dataset (seed-batman-new52.js) already researched and
// recorded four of Scott Snyder & Greg Capullo's nine Batman (2011) story
// arcs with real published collected editions (Court of Owls, City of Owls,
// Death of the Family, Epilogue) plus the wider Omnibus Vol. 1. FIVE arcs had
// NO comicCollections record at all: Zero Year (its two published volumes),
// Endgame, Superheavy and Bloom — even though this dataset's own story notes
// already cited the exact dc.com/Penguin Random House issue ranges for three
// of them. This file closes that gap with the same research discipline as
// the original seed (officially-sourced where possible, disagreements
// between sources flagged rather than silently resolved), and reuses every
// existing id (series/story) — it creates ZERO new series, stories, issues,
// characters or runs, only comicCollections records.
//
// RESEARCH (2026-09-26 pass, via official dc.com collection pages + Penguin
// Random House's own catalog pages for format/date/page-count/ISBN):
//   - Batman Vol. 4: Zero Year – Secret City  (dc.com; PRH ISBN 9781401249335)
//   - Batman Vol. 5: Zero Year – Dark City    (dc.com; PRH ISBN 9781401253356)
//   - Batman Vol. 7: Endgame                  (dc.com; PRH ISBN 9781401261160)
//   - Batman Vol. 8: Superheavy                (PRH ISBN 9781401266301)
//   - Batman Vol. 9: Bloom                     (PRH ISBN 9781401269227)
// Every disagreement between the two official-adjacent sources found is
// called out in that collection's own sourceInfo.notes rather than picked
// silently (Part 13) — see "Zero Year – Dark City" (page count) and
// "Endgame" (a second ISBN found for what appears to be a later printing).
//
// NOT auto-imported: nothing in this file is called by index.js or wired to
// any UI "import" button. A human reviews the counts/sources below and runs
// importAdditions() deliberately (e.g. from a browser console) if approved.
// ============================================================================
import { makeCollection, validateCollection, makeSourceInfo } from "./schema.js";
import { buildSeriesId, buildStoryId, buildIssueId, buildCollectionId } from "./slug.js";

const officialDC = (url, notes, status = "verified") => makeSourceInfo({
  sourceUrl: url, sourceName: "DC.com (official collection page)", sourceType: "official",
  verificationStatus: status, notes,
});
const prh = (url, notes, status = "verified") => makeSourceInfo({
  sourceUrl: url, sourceName: "Penguin Random House (DC's book-trade publisher catalog page)", sourceType: "official",
  verificationStatus: status, notes,
});

// Reuse of EXISTING ids only — this file introduces no new series/story ids.
const SERIES_BATMAN = buildSeriesId("Batman", 2011);
const STORY_ZERO_YEAR_SECRET_CITY = buildStoryId(SERIES_BATMAN, "Zero Year Secret City");
const STORY_ZERO_YEAR_DARK_CITY = buildStoryId(SERIES_BATMAN, "Zero Year Dark City");
const STORY_ENDGAME = buildStoryId(SERIES_BATMAN, "Endgame");
const STORY_SUPERHEAVY = buildStoryId(SERIES_BATMAN, "Superheavy");
const STORY_BLOOM = buildStoryId(SERIES_BATMAN, "Bloom");

function coveredRow(n, coveragePart = "complete") {
  return { seriesId: SERIES_BATMAN, issueId: buildIssueId(SERIES_BATMAN, n), issueLabel: `#${n}`, coveragePart };
}
function collection({ title, format, publicationDate, isbn = null, pageCount = null, rows, storyIds, notes, status = "verified" }) {
  return makeCollection({
    id: buildCollectionId(title), title, publisher: "DC Comics", format, publicationDate, isbn, pageCount,
    seriesIds: [SERIES_BATMAN], issueCoverage: rows, storyIds,
    sourceInfo: officialDC(null, notes, status),
  });
}

export const collectionAdditions = [
  collection({
    title: "Batman Vol. 4: Zero Year – Secret City", format: "TPB",
    publicationDate: "2014-10-07", isbn: "9781401249335", pageCount: 176,
    rows: [21, 22, 23, 24].map(n => coveredRow(n)),
    storyIds: [STORY_ZERO_YEAR_SECRET_CITY],
    notes: "Confirmed via the official dc.com collection page (\"BATMAN #21-24\") and Penguin Random House's catalog page for ISBN 9781401249335 (paperback, Oct. 7 2014, 176pp, $16.99). NOTE: dc.com's own page lists this specific edition as \"Hardcover\" while PRH's book-trade listing for the same ISBN lists it as \"Paperback\" — this is very likely dc.com describing a *different*, later-printed edition/binding rather than a factual conflict about content, but the discrepancy is recorded here rather than silently resolved (Part 13); format is recorded as TPB/Paperback per the PRH catalog entry tied to the specific ISBN on file. Exactly matches this dataset's existing STORY_ZERO_YEAR_SECRET_CITY issue range (#21-24) with zero drift.",
    status: "verified",
  }),
  collection({
    title: "Batman Vol. 5: Zero Year – Dark City", format: "TPB",
    publicationDate: "2015-05-05", isbn: "9781401253356",
    rows: [25, 26, 27, 29, 30, 31, 32, 33].map(n => coveredRow(n)),
    storyIds: [STORY_ZERO_YEAR_DARK_CITY],
    notes: "Confirmed via the official dc.com collection page (\"Batman #25-27 and #29-33\" — #28 explicitly excluded, matching this dataset's existing STORY_ZERO_YEAR_DARK_CITY non-contiguous range exactly) and Penguin Random House's catalog page for ISBN 9781401253356 (paperback, published May 5 2015, $16.99). PAGE COUNT CONFLICT, flagged rather than picked: dc.com states 240 pages, PRH's own catalog page for the same ISBN states 256 pages — pageCount is left null here rather than guessing between the two sources; see notes instead of a possibly-wrong number.",
    pageCount: null,
    status: "partially_verified",
  }),
  collection({
    title: "Batman Vol. 7: Endgame", format: "TPB",
    publicationDate: null, isbn: "9781401261160", pageCount: 200,
    rows: [35, 36, 37, 38, 39, 40].map(n => coveredRow(n)),
    storyIds: [STORY_ENDGAME],
    notes: "Confirmed via the official dc.com collection page (\"stories from BATMAN #35-40\", 200 pages) — exactly matches this dataset's existing STORY_ENDGAME issue range with zero drift. ISBN 9781401261160 confirmed via Penguin Random House's own catalog page for this title. A SECOND ISBN (9781401256890) was also found attached to \"Batman Vol. 7: Endgame\" listings elsewhere (very likely an earlier/different printing or a pre-2016 catalog number for the same content) — not adopted here since it wasn't independently corroborated against an official source the way 9781401261160 was; flagged rather than silently picked one. Publication date could not be independently confirmed from an official source in this pass and is left null rather than guessed (secondary listings suggested March 2016, but that wasn't corroborated against dc.com/PRH directly).",
    status: "partially_verified",
  }),
  collection({
    title: "Batman Vol. 8: Superheavy", format: "TPB",
    publicationDate: "2016-09-13", isbn: "9781401266301", pageCount: 160,
    rows: [41, 42, 43, 44, 45].map(n => coveredRow(n)),
    storyIds: [STORY_SUPERHEAVY],
    notes: "Confirmed via Penguin Random House's catalog page for ISBN 9781401266301 (paperback, Sept. 13 2016, 160pp, $16.99): \"Collects Batman #41-45 and DC Sneak Peak: Batman #1.\" Matches this dataset's existing STORY_SUPERHEAVY issue range (#41-45) exactly. The bonus story from \"DC Sneak Peak: Batman #1\" (NOT the same title this dataset's own story notes had guessed, \"DC Comics: Divergence #1\" — that guess is NOT corroborated by this pass's sources and is superseded by the PRH catalog text) is a different, out-of-scope series/one-shot and is deliberately NOT represented as an issue/series record here, exactly like this dataset's existing pattern for other out-of-scope crossover tie-ins (e.g. Night of the Owls' Batwing/Birds of Prey/All-Star Western #9 tie-ins) — noted here only, never fabricated as data.",
    status: "verified",
  }),
  collection({
    title: "Batman Vol. 9: Bloom", format: "TPB",
    publicationDate: "2016-12-20", isbn: "9781401269227", pageCount: 200,
    rows: [46, 47, 48, 49, 50].map(n => coveredRow(n)),
    storyIds: [STORY_BLOOM],
    notes: "Confirmed via Penguin Random House's catalog page for ISBN 9781401269227 (paperback, Dec. 20 2016, 200pp): \"gathers Batman #46-50, as well as a story from Detective Comics #27.\" Matches this dataset's existing STORY_BLOOM issue range (#46-50) exactly. The bonus story from Detective Comics #27 is a different series/issue outside this dataset's issue-by-issue scope for Detective Comics and is deliberately NOT represented as an issue coverage row here — noted only, per the same out-of-scope-tie-in pattern used elsewhere in this dataset.",
    status: "verified",
  }),
];

/** Offline validation only (no Firestore access) — mirrors seed-batman-new52.js's own validateDataset() shape but scoped to just these 5 additions. */
export function validateCollectionAdditions() {
  const errors = [];
  const seen = new Set();
  for (const c of collectionAdditions) {
    const { valid, errors: e } = validateCollection(c);
    if (!valid) errors.push(`[collection ${c.id}] ${e.join("; ")}`);
    if (seen.has(c.id)) errors.push(`duplicate collection id: ${c.id}`);
    seen.add(c.id);
  }
  return { valid: errors.length === 0, errors, counts: { comicCollections: collectionAdditions.length } };
}

/**
 * Deliberately NOT called by index.js or any UI button (Pointer 5 spec: never
 * auto-import researched additions). A human runs this explicitly — e.g. from
 * the browser console after reviewing validateCollectionAdditions() and the
 * final report — once they've approved it. Additive only: every id here is a
 * NEW comicCollections document; none of it touches or overwrites anything
 * from seed-batman-new52.js (which already imported successfully in Pointer 2).
 */
export async function importCollectionAdditions({ upsertCollectionEdition }) {
  const validation = validateCollectionAdditions();
  const result = { validation, written: 0, errors: [] };
  if (!validation.valid) return result;
  for (const c of collectionAdditions) {
    try { await upsertCollectionEdition(c.id, c); result.written++; }
    catch (e) { result.errors.push(`${c.id}: ${e.message}`); }
  }
  return result;
}
