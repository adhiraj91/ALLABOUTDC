// ============================================================================
// comics-v2 / reading-collections.js
// ----------------------------------------------------------------------------
// POINTER 5 — small, PURE (no Firestore, no DOM) helper functions shared by
// explorer.js and storymap.js for the two things this pointer adds:
//   1. Reading Paths  (comicReadingPaths — pathType, entries, branches)
//   2. Collections/Editions + exact issue coverage (comicCollections —
//      issueCoverage[], never prose)
//
// This file does NOT introduce a new data model or new Firestore collections —
// it only formats/derives display strings and small view-models from the
// EXISTING comicReadingPaths / comicCollections records defined in schema.js
// and fetched via data.js. Keeping this logic in one place means the Explorer
// (Pointer 3) and the Story Map (Pointer 4) render reading paths and
// collection coverage identically instead of two diverging implementations.
// ============================================================================

/* ---------------------------------------------------------------------------
   Reading paths
--------------------------------------------------------------------------- */

// Human labels for the READING_PATH_TYPES starting set in schema.js. A path
// type outside this set (future data) still renders — just with its raw
// value, snake_case humanized — rather than being hidden.
export const PATH_TYPE_LABELS = {
  beginner: "Beginner",
  essential: "Essential",
  main_series: "Main Series",
  complete: "Complete / Expanded",
  publication_order: "Publication Order",
  chronological: "Chronological Order",
  event_crossover: "Event / Crossover",
};
export function pathTypeLabel(pathType) {
  return PATH_TYPE_LABELS[pathType] || String(pathType || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
// Ordered so the picker always lists paths in a sensible progression rather
// than whatever order Firestore happens to return.
const PATH_TYPE_ORDER = ["beginner", "essential", "main_series", "publication_order", "chronological", "complete", "event_crossover"];
export function sortPathsByType(paths) {
  return [...paths].sort((a, b) => {
    const ia = PATH_TYPE_ORDER.indexOf(a.pathType), ib = PATH_TYPE_ORDER.indexOf(b.pathType);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}
/** Total entries a path represents, counting the default branch only (branches are alternates, not additive). */
export function pathEntryCount(path) {
  return (path.entries || []).length;
}
/**
 * Find this path's entries and, if `anchorEntityId` (a story/series/issue id
 * the user is currently looking at) appears in it, the entry before/at/after
 * it — used to show "current position" / "what's next" (Part 4) wherever the
 * data genuinely supports it. Returns nulls rather than guessing when the
 * anchor isn't actually part of this path.
 */
export function locateInPath(path, anchorEntityId) {
  const entries = path.entries || [];
  if (!anchorEntityId) return { index: -1, current: null, next: null };
  const index = entries.findIndex(e => e.entityId === anchorEntityId);
  if (index === -1) return { index: -1, current: null, next: null };
  return { index, current: entries[index], next: entries[index + 1] || null };
}

/* ---------------------------------------------------------------------------
   Collections / editions — structured issueCoverage helpers
--------------------------------------------------------------------------- */

/** Extract a sortable numeric issue number from a coverage row (or an issue entity), or null for non-numeric labels (annuals, specials). */
function numericOf(row) {
  const raw = row.issueId && /#(-?[\d.]+)$/.test(row.issueId) ? null : null; // (kept for clarity — number comes from issueLabel/issueNumber below)
  void raw;
  const src = row.issueLabel != null ? row.issueLabel : row.issueNumber;
  const m = String(src == null ? "" : src).match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
function displayLabel(row) {
  const lbl = row.issueLabel || row.issueNumber;
  if (lbl == null) return "?";
  const s = String(lbl);
  return /^#/.test(s) || /^\D/.test(s) === false ? (s.startsWith("#") ? s : `#${s}`) : s;
}
/** "#1–7" style compression of a list of coverage rows for ONE series, non-contiguous ranges kept separate ("#25–27, #29–33"). */
export function compressCoverageRows(rows) {
  const nums = [], other = [];
  rows.forEach(r => { const n = numericOf(r); if (n != null) nums.push(n); else other.push(displayLabel(r)); });
  nums.sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < nums.length; i++) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    parts.push(i === j ? `#${nums[i]}` : `#${nums[i]}–${nums[j]}`);
    i = j;
  }
  return [...parts, ...other].join(", ");
}
/** Group a collection's flat issueCoverage[] by seriesId (multi-series editions like "Night of the Owls"). */
export function groupCoverageBySeries(issueCoverage) {
  const bySeries = new Map();
  (issueCoverage || []).forEach(row => {
    const key = row.seriesId || "?";
    if (!bySeries.has(key)) bySeries.set(key, []);
    bySeries.get(key).push(row);
  });
  return bySeries;
}
/** One line per contributing series: "Batman #8–9, Annual #1", "Nightwing #8–9", ... */
export function coverageSummaryLines(issueCoverage, seriesTitleFor) {
  const bySeries = groupCoverageBySeries(issueCoverage);
  return [...bySeries.entries()].map(([seriesId, rows]) => {
    const title = (seriesTitleFor && seriesTitleFor(seriesId)) || null;
    const range = compressCoverageRows(rows);
    return title ? `${title} ${range}` : range;
  });
}
/** Any row marked "partial" (Part 6/7) rather than a complete issue. */
export function hasPartialCoverage(issueCoverage) {
  return (issueCoverage || []).some(r => r.coveragePart === "partial");
}

/**
 * A compact visual "coverage bar" for ONE series' rows: a track spanning
 * [domainMin, domainMax] with highlighted segments for each contiguous run of
 * covered issues (Part 8 — comparing #1–7 vs #1–11 vs #0–33 without hundreds
 * of individual issue cards). Returns a view-model (numbers only) so callers
 * in explorer.js / storymap.js render it with their own existing CSS classes.
 */
export function coverageBarSegments(rows, domainMin, domainMax) {
  const nums = rows.map(numericOf).filter(n => n != null).sort((a, b) => a - b);
  if (!nums.length || domainMax <= domainMin) return [];
  const span = domainMax - domainMin || 1;
  const segs = [];
  for (let i = 0; i < nums.length; i++) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    const startPct = ((nums[i] - domainMin) / span) * 100;
    const endPct = ((nums[j] - domainMin) / span) * 100;
    segs.push({ leftPct: Math.max(0, startPct), widthPct: Math.max(1.2, endPct - startPct) });
    i = j;
  }
  return segs;
}
/** Domain (min/max issue number) spanning ALL given collections' coverage for one series — so compared bars share one scale. */
export function sharedDomain(collectionsRows) {
  let min = Infinity, max = -Infinity;
  collectionsRows.forEach(rows => rows.forEach(r => {
    const n = numericOf(r);
    if (n != null) { min = Math.min(min, n); max = Math.max(max, n); }
  }));
  if (min === Infinity) return { min: 0, max: 1 };
  return { min, max: Math.max(max, min + 1) };
}
export function formatEditionMeta(c) {
  return [c.format, c.publicationDate, c.pageCount ? `${c.pageCount} pages` : null].filter(Boolean).join(" · ");
}
export function verificationLabel(sourceInfo) {
  const s = (sourceInfo && sourceInfo.verificationStatus) || "unverified";
  return { verified: "Verified", partially_verified: "Partially verified", unverified: "Unverified" }[s] || s;
}
