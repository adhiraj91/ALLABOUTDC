// ============================================================================
// Comics V2 DATA AUDIT / COVERAGE REPAIR — September 2026
// Safe, additive repair for the currently represented New 52 Batman ecosystem.
//
// This module does NOT replace existing issue records. It only creates missing
// numbered issues / known annuals / known Villains Month issues and corrects
// series metadata where the current seed is demonstrably inconsistent.
// Existing richer records always win.
// ============================================================================
import { makeIssue, makeSourceInfo, makeCollection } from "./schema.js";
import { buildSeriesId, buildIssueId, buildCollectionId } from "./slug.js";
import { getIssuesForSeries } from "./data.js";

const SERIES = {
  BATMAN: buildSeriesId("Batman", 2011),
  DETECTIVE: buildSeriesId("Detective Comics", 2011),
  BATMAN_ROBIN: buildSeriesId("Batman and Robin", 2011),
  NIGHTWING: buildSeriesId("Nightwing", 2011),
  BATGIRL: buildSeriesId("Batgirl", 2011),
  CATWOMAN: buildSeriesId("Catwoman", 2011),
  RED_HOOD: buildSeriesId("Red Hood and the Outlaws", 2011),
  DARK_KNIGHT: buildSeriesId("Batman: The Dark Knight", 2011),
  BATMAN_INC: buildSeriesId("Batman Incorporated", 2012),
};

const SOURCE = {
  batman: "https://www.dc.com/comics/batman-2011",
  detective: "https://en.wikipedia.org/wiki/Detective_Comics",
  batmanRobin: "https://www.findmecomics.com/comic/batman-and-robin-2011",
  nightwing: "https://www.goodreads.com/series/216838-nightwing-2011-single-issues",
  batgirl: "https://www.goodreads.com/series/199217-batgirl-2011-single-issues",
  catwoman: "https://www.goodreads.com/series/100406-catwoman-2011-single-issues",
  redHood: "https://www.goodreads.com/series/216839-red-hood-and-the-outlaws-2011-single-issues",
  darkKnight: "https://www.goodreads.com/series/214036-batman-the-dark-knight-single-issues",
  batmanInc: "https://play.google.com/store/books/series?id=HR4qGwAAABA2BM",
};

const SERIES_RULES = [
  { id: SERIES.BATMAN, max: 52, source: SOURCE.batman, label: "Batman (2011) numbered sequence #0-52", annuals: 4, points: 4 },
  { id: SERIES.DETECTIVE, max: 52, source: SOURCE.detective, label: "Detective Comics (2011) numbered sequence #0-52", annuals: 3, points: 4 },
  { id: SERIES.BATMAN_ROBIN, max: 40, source: SOURCE.batmanRobin, label: "Batman and Robin (2011) numbered sequence #0-40", annuals: 3, points: 4 },
  { id: SERIES.NIGHTWING, max: 30, source: SOURCE.nightwing, label: "Nightwing (2011) numbered sequence #0-30", annuals: 1, points: 0 },
  { id: SERIES.BATGIRL, max: 52, source: SOURCE.batgirl, label: "Batgirl (2011) numbered sequence #0-52", annuals: 3, points: 0 },
  { id: SERIES.CATWOMAN, max: 52, source: SOURCE.catwoman, label: "Catwoman (2011) numbered sequence #0-52", annuals: 2, points: 0 },
  { id: SERIES.RED_HOOD, max: 40, source: SOURCE.redHood, label: "Red Hood and the Outlaws (2011) numbered sequence #0-40", annuals: 2, points: 0 },
  { id: SERIES.DARK_KNIGHT, max: 29, source: SOURCE.darkKnight, label: "Batman: The Dark Knight (2011) numbered sequence #0-29", annuals: 1, points: 4 },
  { id: SERIES.BATMAN_INC, max: 13, source: SOURCE.batmanInc, label: "Batman Incorporated (2012) numbered sequence #0-13", annuals: 0, points: 0 },
];

// issueCount is normalized here to mean numbered issues including #0, matching
// Batman's existing convention. Annuals / point-one issues remain separate
// issue records and are not folded into issueCount.
export const seriesMetadataCorrections = SERIES_RULES.map(r => ({
  id: r.id,
  issueCount: r.max + 1,
}));

function sourceInfo(url, notes) {
  return makeSourceInfo({
    sourceUrl: url,
    sourceName: "Comics data audit — sequence cross-check",
    sourceType: "database",
    verificationStatus: "partially_verified",
    notes,
  });
}

function stubIssue(seriesId, n, url, label) {
  return makeIssue({
    id: buildIssueId(seriesId, n),
    seriesId,
    issueNumber: n,
    issueLabelType: "numbered",
    title: "",
    publicationDate: null,
    storyIds: [],
    characterIds: [],
    creatorIds: [],
    eventIds: [],
    sourceInfo: sourceInfo(url, `${label}. The issue exists in the documented numbered sequence; detailed title/date/credits are deliberately left null until independently verified.`),
  });
}

function annualIssue(seriesId, n, url, label) {
  const issueNumber = `Annual ${n}`;
  return makeIssue({
    id: buildIssueId(seriesId, issueNumber),
    seriesId,
    issueNumber: null,
    issueLabel: `Annual #${n}`,
    issueLabelType: "annual",
    title: "",
    publicationDate: null,
    storyIds: [], characterIds: [], creatorIds: [], eventIds: [],
    sourceInfo: sourceInfo(url, `${label} Annual #${n} is documented as part of this New 52 volume. Detailed contents/credits are left null until independently verified.`),
  });
}

function pointIssue(seriesId, n, url, label) {
  return makeIssue({
    id: buildIssueId(seriesId, n),
    seriesId,
    issueNumber: n,
    issueLabelType: "special",
    title: "",
    publicationDate: null,
    storyIds: [], characterIds: [], creatorIds: [], eventIds: [],
    sourceInfo: sourceInfo(url, `${label} Villains Month issue ${n}. The issue's existence/numbering is verified; detailed story/creator data remains intentionally unresolved here.`),
  });
}

// Known additional collection records needed to repair the Batman collection
// tabs. Only exact coverage that has a reliable source is represented.
const BATMAN = SERIES.BATMAN;
function coverage(seriesId, values) {
  return values.map(v => ({
    seriesId,
    issueId: buildIssueId(seriesId, v),
    issueLabel: typeof v === "string" && /^Annual/i.test(v) ? v : `#${v}`,
    coveragePart: "complete",
  }));
}

export const collectionAdditions = [
  makeCollection({
    id: buildCollectionId("Batman Vol. 1: The Court of Owls (TPB)"),
    title: "Batman Vol. 1: The Court of Owls",
    publisher: "DC Comics", format: "TPB", publicationDate: null,
    seriesIds: [BATMAN],
    issueCoverage: coverage(BATMAN, [1,2,3,4,5,6,7]),
    sourceInfo: sourceInfo("https://www.dc.com/graphic-novels/batman-2011/batman-vol-1-the-court-of-owls", "The TPB edition collects Batman #1-7. Exact coverage is represented separately from the existing hardcover edition, which collects #1-6."),
  }),
  makeCollection({
    id: buildCollectionId("Batman Vol. 3: Death of the Family (TPB)"),
    title: "Batman Vol. 3: Death of the Family",
    publisher: "DC Comics", format: "TPB", publicationDate: null,
    seriesIds: [BATMAN], issueCoverage: coverage(BATMAN, [13,14,15,16,17]),
    sourceInfo: sourceInfo("https://www.dc.com/graphic-novels/batman-2011/batman-vol-3-death-of-the-family", "DC's collection description confirms Batman #13-17."),
  }),
  makeCollection({
    id: buildCollectionId("Batman Vol. 10: Epilogue (TPB)"),
    title: "Batman Vol. 10: Epilogue",
    publisher: "DC Comics", format: "TPB", publicationDate: "2016-12-14",
    seriesIds: [BATMAN],
    issueCoverage: [...coverage(BATMAN, [51,52]), ...coverage(BATMAN, ["Annual 4"])],
    sourceInfo: sourceInfo("https://www.dc.com/graphic-novels/batman-2011/batman-vol-10-epilogue", "DC confirms this collection contains Batman #51-52 and Batman Annual #4, plus Batman: Futures End #1 and Batman: Rebirth #1, which are outside this dataset's current Batman series issue scope."),
  }),
  makeCollection({
    id: buildCollectionId("Batman by Scott Snyder & Greg Capullo Omnibus Vol. 2"),
    title: "Batman by Scott Snyder & Greg Capullo Omnibus Vol. 2",
    publisher: "DC Comics", format: "Omnibus", publicationDate: "2021-11-23", isbn: "9781779513267", pageCount: 928,
    seriesIds: [BATMAN], issueCoverage: coverage(BATMAN, Array.from({length:19}, (_,i)=>i+34).concat(["Annual 3","Annual 4"])),
    sourceInfo: sourceInfo("https://www.penguinrandomhouse.com/books/691314/batman-by-scott-snyder-and-greg-capullo-omnibus-vol-2-by-scott-snyder/", "Penguin Random House confirms Batman #34-52 and Batman Annual #3-4, plus Detective Comics #27, Batman: Futures End #1, DC Sneak Peek: Batman #1, Detective Comics #1000 and Batman: Last Knight on Earth #1-3."),
  }),
  makeCollection({
    id: buildCollectionId("Batman: Death of the Family Saga (DC Essential Edition)"),
    title: "Batman: Death of the Family Saga (DC Essential Edition)",
    publisher: "DC Comics", format: "Essential Edition", publicationDate: "2019-04-10", pageCount: 376,
    seriesIds: [BATMAN], issueCoverage: [
      ...coverage(BATMAN,[13,14,15,16,17]),
      ...coverage(buildSeriesId("Batgirl",2011),[14,15,16]),
      ...coverage(buildSeriesId("Nightwing",2011),[15,16]),
      ...coverage(buildSeriesId("Batman and Robin",2011),[15,16]),
      ...coverage(buildSeriesId("Batgirl",2011),["#13"].map(x=>x.replace(/^#/,'13'))),
    ],
    sourceInfo: sourceInfo("https://www.dc.com/graphic-novels/batman-2011/batman-death-of-the-family-saga-dc-essential-edition", "DC confirms the core contents and explicitly lists Batman #13-17, Batgirl #14-16, Nightwing #15-16, Batman and Robin #15-16, plus selected pages from additional tie-ins."),
  }),
];

export function validateAuditDefinitions() {
  const errors = [];
  const seen = new Set();
  for (const r of SERIES_RULES) {
    if (seen.has(r.id)) errors.push(`duplicate series rule: ${r.id}`);
    seen.add(r.id);
    if (!Number.isInteger(r.max) || r.max < 0) errors.push(`invalid max for ${r.id}`);
  }
  return { valid: errors.length === 0, errors };
}

export async function importComicsDataAudit({ upsertEntity, getEntity, upsertCollectionEdition, COLLECTIONS }) {
  const validation = validateAuditDefinitions();
  const result = { validation, seriesPatched: 0, issuesAdded: 0, collectionsAdded: 0, errors: [] };
  if (!validation.valid) return result;

  // 1. Correct only demonstrably wrong series issue counts.
  for (const patch of seriesMetadataCorrections) {
    try {
      const existing = await getEntity(COLLECTIONS.SERIES, patch.id);
      if (!existing) continue;
      if (existing.issueCount !== patch.issueCount) {
        await upsertEntity(COLLECTIONS.SERIES, patch.id, { ...existing, issueCount: patch.issueCount, notes: `${existing.notes || ""}\n\nDATA AUDIT 2026-09-27: normalized issueCount to the numbered sequence including #0; annuals and Villains Month point-one issues remain separate records.`.trim() });
        result.seriesPatched++;
      }
    } catch (e) { result.errors.push(`series ${patch.id}: ${e.message}`); }
  }

  // 2. Add missing numbered issues, never overwrite an existing richer record.
  for (const rule of SERIES_RULES) {
    try {
      const existing = await getIssuesForSeries(rule.id);
      const ids = new Set(existing.map(x => x.id));
      for (let n = 0; n <= rule.max; n++) {
        const id = buildIssueId(rule.id, n);
        if (ids.has(id)) continue;
        await upsertEntity(COLLECTIONS.ISSUES, id, stubIssue(rule.id, n, rule.source, rule.label));
        result.issuesAdded++;
      }
      for (let n = 1; n <= rule.annuals; n++) {
        const id = buildIssueId(rule.id, `Annual ${n}`);
        if (ids.has(id)) continue;
        await upsertEntity(COLLECTIONS.ISSUES, id, annualIssue(rule.id, n, rule.source, rule.label));
        result.issuesAdded++;
      }
      for (const n of ["23.1","23.2","23.3","23.4"].slice(0, rule.points)) {
        const id = buildIssueId(rule.id, n);
        if (ids.has(id)) continue;
        await upsertEntity(COLLECTIONS.ISSUES, id, pointIssue(rule.id, n, rule.source, rule.label));
        result.issuesAdded++;
      }
    } catch (e) { result.errors.push(`issues ${rule.id}: ${e.message}`); }
  }

  // 3. Add missing researched Batman collections. Existing IDs are left alone.
  for (const c of collectionAdditions) {
    try {
      const existing = await getEntity(COLLECTIONS.COLLECTIONS, c.id);
      if (!existing) {
        await upsertCollectionEdition(c.id, c);
        result.collectionsAdded++;
      }
    } catch (e) { result.errors.push(`collection ${c.id}: ${e.message}`); }
  }

  return result;
}
