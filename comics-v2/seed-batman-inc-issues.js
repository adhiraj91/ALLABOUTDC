// ============================================================================
// comics-v2 / seed-batman-inc-issues.js
// ----------------------------------------------------------------------------
// SEED ADDITIONS (NOT auto-imported by default — see index.js).
//
// Closes a data gap flagged during Pointer 6: Batman Incorporated (2012) is a
// 14-issue series (#0-13, per its own series record's issueCount) but
// seed-batman-new52.js only ever recorded 9 of them (#0-6, #8, #13) — issues
// #7 and #9-12 had no comicIssues record at all, so per-issue reading
// progress for this series was incomplete (it fell back to a plain
// story/series-level "mark as read" toggle instead of issue-by-issue
// tracking).
//
// This file adds ONLY those 5 missing comicIssues records. It creates ZERO
// new series, stories, runs, characters, creators or collections, and reuses
// every existing id — it does not touch or overwrite anything already
// imported from seed-batman-new52.js.
//
// RESEARCH (2026-09-27 pass, via each issue's own official dc.com issue page):
//   - Batman, Incorporated #7  — on-sale 2013-01-30 — dc.com
//   - Batman, Incorporated #9  — on-sale 2013-03-27 — dc.com
//   - Batman, Incorporated #10 — on-sale 2013-04-24 — dc.com
//   - Batman, Incorporated #11 — on-sale 2013-05-22 — dc.com
//   - Batman, Incorporated #12 — on-sale 2013-07-03 — dc.com
// Writer (Grant Morrison) and artist (Chris Burnham) confirmed on each
// issue's own dc.com page, consistent with every other issue of this run
// (the whole series is a single Morrison/Burnham creative run per its own
// existing run record). None of the 5 pages gave the issue an individual
// story title beyond "Batman, Incorporated #N" — dc.com simply doesn't list
// one — so `title` is left null here rather than invented, matching this
// dataset's existing pattern for every other untitled issue (e.g. Batman
// (2011) #1-7). No sources disagreed on anything recorded below.
//
// NOT auto-imported: nothing in this file is called by index.js's automatic
// self-test, or wired to any UI button, on its own. A human runs
// importIssueAdditions() deliberately (folded into the existing "Import /
// Update Batman New 52 Data" admin button) once approved.
// ============================================================================
import { makeIssue, validateIssue, makeSourceInfo } from "./schema.js";
import { buildSeriesId, buildIssueId, buildCharacterId, buildCreatorId } from "./slug.js";

const officialDC = (url, notes) => makeSourceInfo({
  sourceUrl: url, sourceName: "DC.com (official issue page)",
  sourceType: "official", verificationStatus: "verified", notes,
});

// Reuse of EXISTING ids only, built the same way seed-batman-new52.js built
// them — this file introduces no new series/character/creator records.
const SERIES_BATMAN_INC_2012 = buildSeriesId("Batman Incorporated", 2012);
const CHAR_BATMAN = buildCharacterId("Batman");
const CHAR_ROBIN_DAMIAN = buildCharacterId("Robin Damian Wayne");
const CREATOR_MORRISON = buildCreatorId("Grant Morrison");
const CREATOR_BURNHAM = buildCreatorId("Chris Burnham");

function issue(n, url, onSaleDate) {
  return makeIssue({
    id: buildIssueId(SERIES_BATMAN_INC_2012, n),
    seriesId: SERIES_BATMAN_INC_2012, issueNumber: n, issueLabelType: "numbered",
    title: null, publicationDate: onSaleDate, storyIds: [],
    characterIds: [CHAR_BATMAN, CHAR_ROBIN_DAMIAN],
    creatorIds: [CREATOR_MORRISON, CREATOR_BURNHAM],
    sourceInfo: officialDC(url, `Writer (Grant Morrison) and artist (Chris Burnham) confirmed on this issue's own dc.com page, matching the series' single confirmed creative run. dc.com does not give this issue its own story title, so title is left null rather than invented. On-sale date ${onSaleDate} per dc.com.`),
  });
}

export const issueAdditions = [
  issue(7, "https://www.dc.com/comics/batman-incorporated-2012/batman-incorporated-7", "2013-01-30"),
  issue(9, "https://www.dc.com/comics/batman-incorporated-2012/batman-incorporated-9", "2013-03-27"),
  issue(10, "https://www.dc.com/comics/batman-incorporated-2012/batman-incorporated-10", "2013-04-24"),
  issue(11, "https://www.dc.com/comics/batman-incorporated-2012/batman-incorporated-11", "2013-05-22"),
  issue(12, "https://www.dc.com/comics/batman-incorporated-2012/batman-incorporated-12", "2013-07-03"),
];

/** Offline validation only (no Firestore access). */
export function validateIssueAdditions() {
  const errors = [];
  const seen = new Set();
  for (const i of issueAdditions) {
    const { valid, errors: e } = validateIssue(i);
    if (!valid) errors.push(`[issue ${i.id}] ${e.join("; ")}`);
    if (seen.has(i.id)) errors.push(`duplicate issue id: ${i.id}`);
    seen.add(i.id);
  }
  return { valid: errors.length === 0, errors, counts: { comicIssues: issueAdditions.length } };
}

/**
 * A human runs this explicitly (folded into the existing Comics V2 admin
 * button) — never called automatically. Additive only: every id here is a
 * NEW comicIssues document; none of it touches seed-batman-new52.js's
 * already-imported content.
 */
export async function importIssueAdditions({ upsertEntity, COLLECTIONS }) {
  const validation = validateIssueAdditions();
  const result = { validation, written: 0, errors: [] };
  if (!validation.valid) return result;
  for (const i of issueAdditions) {
    try { await upsertEntity(COLLECTIONS.ISSUES, i.id, i); result.written++; }
    catch (e) { result.errors.push(`${i.id}: ${e.message}`); }
  }
  return result;
}
