// ============================================================================
// comics-v2 / reading-progress.js
// ----------------------------------------------------------------------------
// POINTER 6 — Personal reading progress for the comics domain model.
//
// There is NO progress store in here. The single source of truth is the site's
// existing progress store owned by app.js (localStorage "dc_progress" mirrored to
// users/{uid}/progress), where a read issue is just one more key:
// "comicIssue:<canonical issue id>". app.js exposes it through
// window.__readerProgress (readSets / setRead / setReading / followPath /
// getState) and announces every change with the DOM event
// "readerprogress:change" — this module never imports app.js (and vice versa).
//
// Everything above the issue is DERIVED here, on the fly, from canonical ids:
//   issue  -> story      (story.issueIds)
//   story  -> run        (stories whose runId is the run)
//   issues -> series     (only as an exact fraction when every issue is on record)
//   entries-> path       (comicReadingPaths.entries, story/issue/series entries)
//   issues -> collection (comicCollections.issueCoverage)
// Nothing derived is ever written back, so levels can never disagree.
//
// Explicit completion (comicStory:/comicSeries: keys) is only offered where issue
// data can't decide it: a story with no issueIds, or a series whose issue records
// don't cover its issueCount.
// ============================================================================
import * as data from "./data.js?v=p6";
import { COLLECTIONS } from "./schema.js";
import { sortPathsByType, locateInPath } from "./reading-collections.js?v=p6";

const esc = (s) => s == null ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const yearOf = (d) => { const m = String(d || "").match(/\d{4}/); return m ? m[0] : ""; };

/* ============================= bridge ============================= */
export function bridge() { return window.__readerProgress || null; }
export function readSets() {
  const b = bridge();
  return b ? b.readSets() : { issue: new Set(), story: new Set(), series: new Set() };
}
export function readingState() {
  const b = bridge();
  const empty = { activePath: null, position: null, reading: {}, readAt: { issue: {}, story: {}, series: {} } };
  return b ? b.getState() : empty;
}
/** One snapshot per render pass (cheap: a localStorage parse). */
export function snapshot() { return { sets: readSets(), st: readingState() }; }
export function hasAnyComicsActivity(snap) {
  const { sets, st } = snap || snapshot();
  return sets.issue.size > 0 || sets.story.size > 0 || sets.series.size > 0 ||
    Object.keys(st.reading || {}).length > 0 || !!(st.activePath && st.activePath.id);
}

/* ============================= cached, contextual reads =============================
   Only what the caller is looking at is loaded (one path, one story, one series …),
   batched with `in` queries, memoised for the page lifetime. Clicking a progress
   control never triggers a read — progress is recomputed from ids already in memory. */
const MEMO = new Map();
function memo(key, fn) {
  if (MEMO.has(key)) return MEMO.get(key);
  const p = Promise.resolve().then(fn);
  MEMO.set(key, p);
  p.catch(() => MEMO.delete(key));
  return p;
}
const ENT = new Map();
async function getOne(col, id) {
  if (!id) return null;
  const k = col + "::" + id;
  if (ENT.has(k)) return ENT.get(k);
  const e = await memo("one:" + k, () => data.getEntity(col, id));
  if (e) ENT.set(k, e);
  return e;
}
async function getMany(col, ids) {
  const want = [...new Set((ids || []).filter(Boolean))];
  const missing = want.filter(id => !ENT.has(col + "::" + id));
  if (missing.length) {
    const got = await memo(`many:${col}:${missing.slice().sort().join("|")}`, () => data.getEntitiesByIds(col, missing));
    got.forEach(e => ENT.set(col + "::" + e.id, e));
  }
  return want.map(id => ENT.get(col + "::" + id)).filter(Boolean);
}
export const getStory = (id) => getOne(COLLECTIONS.STORIES, id);
export const getIssue = (id) => getOne(COLLECTIONS.ISSUES, id);
export const getSeriesEnt = (id) => getOne(COLLECTIONS.SERIES, id);
export const getPath = (id) => getOne(COLLECTIONS.READING_PATHS, id);
export async function issuesForSeries(seriesId) {
  const list = await memo("ifser:" + seriesId, () => data.getIssuesForSeries(seriesId));
  list.forEach(e => ENT.set(COLLECTIONS.ISSUES + "::" + e.id, e));
  return list;
}
async function pathsForContinuity(continuityId) {
  if (!continuityId) return [];
  return memo("rpc:" + continuityId, () => data.getReadingPathsFor({ continuityId }));
}

/* ============================= labels ============================= */
export function seriesLabel(s) { return s ? `${s.title}${yearOf(s.startDate) ? ` (${yearOf(s.startDate)})` : ""}` : ""; }
/** "Batman #8" — issueLabel is "#8" for numbered issues but already "Batman Annual 1" for annuals. */
export function issueLabelWith(issue, series) {
  if (!issue) return "";
  const lbl = issue.issueLabel || (issue.issueNumber != null ? `#${issue.issueNumber}` : "Issue");
  if (!series || !/^#/.test(lbl)) return lbl;
  return `${series.title} ${lbl}`;
}
export async function issueLabel(issue) {
  if (!issue) return "";
  const s = await getSeriesEnt(issue.seriesId);
  return issueLabelWith(issue, s);
}
export function sortIssues(list) {
  const n = (i) => { const x = parseFloat(i && i.issueNumber); return isNaN(x) ? Infinity : x; };
  return list.slice().sort((a, b) => (n(a) - n(b)) || String(a.issueLabel || "").localeCompare(String(b.issueLabel || "")));
}

/* ============================= derived progress (pure) ============================= */
export function issueState(id, snap) {
  const { sets, st } = snap;
  if (sets.issue.has(id)) return "read";
  if (st.reading && st.reading[id]) return "reading";
  return "unread";
}
/**
 * Story progress. With issue data: always derived (never a manual toggle).
 * Without: the explicit comicStory:<id> flag (Part 3).
 */
export function storyProgress(story, snap) {
  const ids = (story && story.issueIds) || [];
  if (!ids.length) {
    const done = snap.sets.story.has(story && story.id);
    return { derived: false, total: 0, read: 0, reading: 0, state: done ? "complete" : "unread", nextIssueId: null, currentIssueId: null };
  }
  let read = 0, reading = 0, currentIssueId = null, nextIssueId = null;
  ids.forEach(id => {
    const s = issueState(id, snap);
    if (s === "read") read++;
    else {
      if (s === "reading") { reading++; if (!currentIssueId) currentIssueId = id; }
      if (!nextIssueId) nextIssueId = id;
    }
  });
  const state = read === ids.length ? "complete" : (read || reading) ? "in_progress" : "unread";
  // "next" = the issue you're in the middle of, else the first unread issue in the story's own order.
  return { derived: true, total: ids.length, read, reading, state, nextIssueId: currentIssueId || nextIssueId, currentIssueId };
}
export function runProgress(stories, snap) {
  const per = stories.map(s => storyProgress(s, snap));
  const complete = per.filter(p => p.state === "complete").length;
  const started = per.filter(p => p.state !== "unread").length;
  return { total: stories.length, complete, started, state: stories.length && complete === stories.length ? "complete" : started ? "in_progress" : "unread", per };
}
/**
 * Series: an exact "x / y issues" only when the issue records cover the series'
 * own issueCount; otherwise just "n read" (Part 4: no false precision).
 */
export function seriesProgress(series, issues, snap) {
  const total = (issues || []).length;
  const read = (issues || []).filter(i => snap.sets.issue.has(i.id)).length;
  const exact = !!(series && total && series.issueCount && total >= series.issueCount);
  const explicit = !!(series && snap.sets.series.has(series.id));
  let state = read ? "in_progress" : "unread";
  if (exact && read === total) state = "complete";
  if (explicit) state = "complete";
  return { exact, total, read, explicit, state };
}
/** Collection progress straight from its structured issueCoverage — no collection-progress store (Part 17). */
export function collectionProgress(c, snap) {
  const ids = [...new Set(((c && c.issueCoverage) || []).map(r => r.issueId).filter(Boolean))];
  const read = ids.filter(id => snap.sets.issue.has(id)).length;
  return { total: ids.length, read, state: ids.length && read === ids.length ? "complete" : read ? "in_progress" : "unread" };
}

/* ---- reading paths ---- */
/** Loads just what one path needs to compute progress: its story entries (batched) and any series entries' issues. */
export async function loadPathContext(path) {
  const entries = (path && path.entries) || [];
  const storyIds = entries.filter(e => e.entityType === "story").map(e => e.entityId);
  const issueIds = entries.filter(e => e.entityType === "issue").map(e => e.entityId);
  const seriesIds = entries.filter(e => e.entityType === "series").map(e => e.entityId);
  const [stories, issues, series] = await Promise.all([
    getMany(COLLECTIONS.STORIES, storyIds),
    getMany(COLLECTIONS.ISSUES, issueIds),
    getMany(COLLECTIONS.SERIES, seriesIds),
  ]);
  const seriesIssues = new Map();
  await Promise.all(seriesIds.map(async id => seriesIssues.set(id, await issuesForSeries(id))));
  return {
    stories: new Map(stories.map(s => [s.id, s])),
    issues: new Map(issues.map(i => [i.id, i])),
    series: new Map(series.map(s => [s.id, s])),
    seriesIssues,
  };
}
export function entryProgress(entry, ctx, snap) {
  const t = entry.entityType, id = entry.entityId;
  if (t === "story") {
    const s = ctx.stories.get(id);
    if (!s) return { state: "unknown", kind: "story" };
    const p = storyProgress(s, snap);
    return { ...p, kind: "story", canMark: !p.derived };
  }
  if (t === "issue") {
    const s = issueState(id, snap);
    return { kind: "issue", derived: true, total: 1, read: s === "read" ? 1 : 0, state: s === "read" ? "complete" : s === "reading" ? "in_progress" : "unread", nextIssueId: s === "read" ? null : id };
  }
  if (t === "series") {
    const ser = ctx.series.get(id);
    const issues = sortIssues(ctx.seriesIssues.get(id) || []);
    const p = seriesProgress(ser, issues, snap);
    const next = issues.find(i => !snap.sets.issue.has(i.id));
    return { kind: "series", derived: p.exact, total: p.exact ? p.total : 0, read: p.read, state: p.state, canMark: !p.exact, nextIssueId: p.state === "complete" ? null : (next ? next.id : null) };
  }
  return { state: "unknown", kind: t };
}
/**
 * Path progress: entry states + where the reader is. current = the first entry in
 * progress; next = the first unfinished entry after the furthest entry touched
 * (so skipping ahead doesn't bounce you back), else the first unfinished one.
 * Entries are taken ONLY in the path's own explicit order — never re-sorted.
 */
export function pathProgress(path, ctx, snap) {
  const entries = (path && path.entries) || [];
  const per = entries.map(e => entryProgress(e, ctx, snap));
  const countable = per.filter(p => p.state !== "unknown");
  const complete = countable.filter(p => p.state === "complete").length;
  const currentIdx = per.findIndex(p => p.state === "in_progress");
  let lastTouched = -1;
  per.forEach((p, i) => { if (p.state === "complete" || p.state === "in_progress") lastTouched = i; });
  let nextIdx = per.findIndex((p, i) => i > lastTouched && p.state !== "complete" && p.state !== "unknown");
  if (nextIdx === -1) nextIdx = per.findIndex(p => p.state !== "complete" && p.state !== "unknown");
  const types = new Set(entries.map(e => e.entityType));
  const unit = types.size === 1 ? ({ story: "stories", issue: "issues", series: "series" }[[...types][0]] || "steps") : "steps";
  return {
    per, complete, total: countable.length, unit,
    currentIdx, nextIdx, targetIdx: currentIdx !== -1 ? currentIdx : nextIdx,
    state: countable.length && complete === countable.length ? "complete" : (complete || currentIdx !== -1) ? "in_progress" : "unread",
  };
}

/* ============================= small shared markup =============================
   Subtle, text-first progress marks (never progress-bar walls). */
export function markText(p) {
  if (!p || p.state === "unknown") return "";
  if (p.state === "complete") return "✓";
  if (p.state === "in_progress") return p.total ? `${p.read}/${p.total}` : "In progress";
  return "";
}
export function statusWord(p) {
  if (!p) return "";
  return p.state === "complete" ? "Complete" : p.state === "in_progress" ? "In progress" : "Unread";
}
/** "5 / 7 issues · In progress" / "✓ Complete · 7 issues" / "7 issues · Unread" */
export function storySummaryText(p) {
  if (!p.derived) return p.state === "complete" ? "✓ Read" : "Unread";
  if (p.state === "complete") return `✓ Complete · ${p.total} issue${p.total === 1 ? "" : "s"}`;
  if (p.state === "in_progress") return `${p.read} / ${p.total} issues · In progress`;
  return `${p.total} issue${p.total === 1 ? "" : "s"} · Unread`;
}

/* ============================= Continue Reading (Part 6/7) =============================
   Priority: 1. explicitly followed reading path  2. the most recent story you worked in
   (inside the path you were using, if any)  3. the most recently read issue's story
   4. the next unfinished item of a reading path containing that story  5. (optional) a
   sensible starting point. Relationships (crossover/tie-in/event) are NEVER used to pick
   what comes next — only a reading path's explicit order or a story's own issue order. */
async function destinationForEntry(path, ctx, pp, idx, snap, source) {
  const entry = path.entries[idx];
  const ep = pp.per[idx];
  let story = null, issue = null, series = null;
  if (entry.entityType === "story") story = ctx.stories.get(entry.entityId) || null;
  if (entry.entityType === "series") series = ctx.series.get(entry.entityId) || null;
  if (story) await getMany(COLLECTIONS.ISSUES, story.issueIds || []); // one batched read, then every "next" is cached
  if (ep.nextIssueId) issue = ctx.issues.get(ep.nextIssueId) || await getIssue(ep.nextIssueId);
  if (!story && !issue && !series) return null;
  return { kind: source === "start" ? "start" : "continue", source, path, pathProgress: pp, entryIdx: idx, entry, story, series, issue, entryProgress: ep };
}
async function continueInPath(pathId, snap, source, afterEntityId) {
  const path = await getPath(pathId);
  if (!path || !(path.entries || []).length) return null;
  const ctx = await loadPathContext(path);
  const pp = pathProgress(path, ctx, snap);
  let idx = pp.targetIdx;
  if (afterEntityId) {
    // "what comes after this story on this path" — the path's order decides, nothing else.
    const at = locateInPath(path, afterEntityId).index;
    if (at !== -1) {
      const after = pp.per.findIndex((p, i) => i > at && p.state !== "complete" && p.state !== "unknown");
      if (after !== -1) idx = after;
    }
  }
  if (idx == null || idx === -1) return null; // path complete: no destination → no Continue control
  return destinationForEntry(path, ctx, pp, idx, snap, source);
}
async function continueInStory(storyId, snap, source) {
  const story = await getStory(storyId);
  if (!story) return null;
  const sp = storyProgress(story, snap);
  await getMany(COLLECTIONS.ISSUES, story.issueIds || []); // batched + cached: toggling issues never re-reads
  if (sp.state !== "complete" && sp.nextIssueId) {
    const issue = await getIssue(sp.nextIssueId);
    return { kind: "continue", source, path: null, story, issue, entryProgress: sp };
  }
  if (sp.state !== "complete") return null;
  // Story finished: only a reading path can say what's next. Prefer the path types a reader
  // would expect first (essential before complete/expanded …), and only paths containing it.
  const paths = sortPathsByType(await pathsForContinuity(story.continuityId));
  for (const p of paths) {
    if (locateInPath(p, story.id).index === -1) continue;
    ENT.set(COLLECTIONS.READING_PATHS + "::" + p.id, p);
    const r = await continueInPath(p.id, snap, "after-story", story.id);
    if (r) return { ...r, afterStory: story };
  }
  return null;
}
function mostRecentIssueId(st) {
  let best = null, bestAt = -1;
  const consider = (map) => Object.entries(map || {}).forEach(([id, at]) => { if ((at || 0) > bestAt) { best = id; bestAt = at || 0; } });
  consider(st.readAt && st.readAt.issue);
  consider(st.reading);
  return best;
}
/** Picks the story an issue "belongs to" for continuing: its arc story (one with a run) over an event it also sits in. */
async function primaryStoryOf(issue) {
  const stories = await getMany(COLLECTIONS.STORIES, issue.storyIds || []);
  return stories.find(s => s.runId) || stories[0] || null;
}
export async function resolveContinue({ allowStart = false } = {}) {
  if (!bridge()) return null;
  const snap = snapshot();
  const { st } = snap;
  try {
    if (st.activePath && st.activePath.id) {
      const r = await continueInPath(st.activePath.id, snap, "active-path");
      if (r) return r;
    }
    const pos = st.position;
    if (pos && pos.pathId && !(st.activePath && st.activePath.id === pos.pathId)) {
      const r = await continueInPath(pos.pathId, snap, "recent-path");
      if (r) return r;
    }
    if (pos && pos.storyId) {
      const r = await continueInStory(pos.storyId, snap, "recent-story");
      if (r) return r;
    }
    const lastId = (pos && pos.issueId) || mostRecentIssueId(st);
    if (lastId) {
      const iss = await getIssue(lastId);
      const story = iss ? await primaryStoryOf(iss) : null;
      if (story) { const r = await continueInStory(story.id, snap, "recent-issue"); if (r) return r; }
    }
    // Old progress with no timestamps (e.g. merged from the cloud): any read issue still points somewhere.
    if (snap.sets.issue.size && !lastId) {
      const iss = await getIssue([...snap.sets.issue][snap.sets.issue.size - 1]);
      const story = iss ? await primaryStoryOf(iss) : null;
      if (story) { const r = await continueInStory(story.id, snap, "recent-issue"); if (r) return r; }
    }
    if (allowStart) return await startingPoint(snap);
  } catch (e) {
    console.warn("[Comics progress] continue reading unavailable", e);
  }
  return null;
}
async function startingPoint(snap) {
  const paths = sortPathsByType(await memo("allpaths", () => data.getAllReadingPaths(20)));
  for (const p of paths) {
    ENT.set(COLLECTIONS.READING_PATHS + "::" + p.id, p);
    const r = await continueInPath(p.id, snap, "start");
    if (r) return r;
  }
  return null;
}

/** Explorer trail for a Continue destination: path › story › issue (breadcrumb mirrors the path). */
export async function trailFor(dest) {
  const trail = [];
  const pathId = dest.path ? dest.path.id : null;
  if (dest.path) trail.push({ level: "readingPath", label: dest.path.title, params: { path: dest.path, anchorEntityId: dest.entry ? dest.entry.entityId : null } });
  if (dest.story) trail.push({ level: "story", label: dest.story.title, params: { story: dest.story, pathId } });
  else if (dest.series) trail.push({ level: "series", label: dest.series.title, params: { series: dest.series } });
  if (dest.issue) trail.push({ level: "issue", label: await issueLabel(dest.issue), params: { issue: dest.issue, story: dest.story, pathId } });
  return trail;
}
function openTrail(trail) {
  const ex = window.__comicsExplorer;
  if (ex && ex.openAt) ex.openAt(trail);
  else if (ex && ex.open) ex.open();
}
async function describe(dest) {
  const title = dest.story ? dest.story.title : dest.series ? seriesLabel(dest.series) : dest.issue ? await issueLabel(dest.issue) : "";
  const next = dest.issue ? await issueLabel(dest.issue) : "";
  const pp = dest.pathProgress;
  const pathLine = dest.path ? `${dest.path.title}${pp && pp.total ? ` · ${pp.complete} / ${pp.total} ${pp.unit} complete` : ""}` : "";
  return { title, next, pathLine };
}

/* ============================= My Journey block (Part 8) =============================
   Rendered into app.js's #journeyComicsSection slot, in My Journey's own visual language
   (journey-next-up + compact rows). Deliberately small: continue · path · one progress
   line · recent. Hidden entirely for readers with no comics activity. */
let journeySeq = 0;
async function recentCompletedStories(snap, max) {
  const byTs = Object.entries((snap.st.readAt && snap.st.readAt.issue) || {}).sort((a, b) => b[1] - a[1]).slice(0, 40);
  const issues = await getMany(COLLECTIONS.ISSUES, byTs.map(([id]) => id));
  const lastAt = new Map();
  issues.forEach(i => (i.storyIds || []).forEach(sid => {
    const at = (snap.st.readAt.issue || {})[i.id] || 0;
    lastAt.set(sid, Math.max(lastAt.get(sid) || 0, at));
  }));
  Object.entries((snap.st.readAt && snap.st.readAt.story) || {}).forEach(([sid, at]) => lastAt.set(sid, Math.max(lastAt.get(sid) || 0, at)));
  const stories = await getMany(COLLECTIONS.STORIES, [...lastAt.keys()]);
  return stories
    .filter(s => storyProgress(s, snap).state === "complete")
    .sort((a, b) => (lastAt.get(b.id) || 0) - (lastAt.get(a.id) || 0))
    .slice(0, max);
}
async function seriesLineFor(snap) {
  const id = (snap.st.position && snap.st.position.issueId) || mostRecentIssueId(snap.st) || [...snap.sets.issue][0];
  if (!id) return null;
  const iss = await getIssue(id);
  if (!iss) return null;
  const [ser, issues] = await Promise.all([getSeriesEnt(iss.seriesId), issuesForSeries(iss.seriesId)]);
  if (!ser) return null;
  const p = seriesProgress(ser, issues, snap);
  if (!p.read) return null;
  return { series: ser, text: p.exact ? `${p.read} / ${p.total} issues` : `${p.read} issue${p.read === 1 ? "" : "s"} read` };
}
async function activePathLine(snap) {
  const ap = snap.st.activePath;
  if (!ap || !ap.id) return null;
  const path = await getPath(ap.id);
  if (!path) return null;
  const pp = pathProgress(path, await loadPathContext(path), snap);
  return { path, pp, text: pp.state === "complete" ? "✓ Complete" : `${pp.complete} / ${pp.total} ${pp.unit}` };
}
export async function renderJourneyBlock(container) {
  if (!container) return;
  const my = ++journeySeq;
  const snap = snapshot();
  if (!hasAnyComicsActivity(snap)) { container.hidden = true; container.innerHTML = ""; return; }
  let cont = null, series = null, active = null, recent = [];
  try {
    [cont, series, active, recent] = await Promise.all([
      resolveContinue({ allowStart: false }),
      seriesLineFor(snap).catch(() => null),
      activePathLine(snap).catch(() => null),
      recentCompletedStories(snap, 3).catch(() => []),
    ]);
  } catch (e) { console.warn("[Comics progress] journey block", e); }
  if (my !== journeySeq || !container.isConnected) return;
  const trails = [];
  const rows = [];
  let html = `<div class="home-section-head"><h3>COMICS</h3><span class="home-section-sub">Your reading</span></div>`;
  if (cont) {
    const d = await describe(cont);
    trails.push(await trailFor(cont));
    html += `<div class="journey-next-up journey-comics-continue" data-jc-trail="${trails.length - 1}" role="button" tabindex="0">
        <span class="journey-next-up-label">CONTINUE READING</span>
        <span class="journey-next-up-title">${esc(d.title)}</span>
        <span class="journey-next-up-meta">${esc([cont.path ? cont.path.title : "", d.next ? `Next: ${d.next}` : ""].filter(Boolean).join(" · "))}</span>
        <span class="journey-next-up-cta">Continue →</span>
      </div>`;
  }
  if (active) {
    trails.push([{ level: "readingPath", label: active.path.title, params: { path: active.path } }]);
    rows.push(`<button class="journey-comics-row" data-jc-trail="${trails.length - 1}"><span class="journey-comics-k">Active reading path</span><span class="journey-comics-v">${esc(active.path.title)}</span><span class="journey-comics-n">${esc(active.text)}</span></button>`);
  }
  if (series) {
    trails.push([{ level: "series", label: series.series.title, params: { series: series.series } }]);
    rows.push(`<button class="journey-comics-row" data-jc-trail="${trails.length - 1}"><span class="journey-comics-k">Comics progress</span><span class="journey-comics-v">${esc(seriesLabel(series.series))}</span><span class="journey-comics-n">${esc(series.text)}</span></button>`);
  }
  if (recent.length) {
    const first = trails.length;
    recent.forEach(s => trails.push([{ level: "story", label: s.title, params: { story: s } }]));
    rows.push(`<div class="journey-comics-row journey-comics-recent"><span class="journey-comics-k">Recent</span><span class="journey-comics-v">${recent.map((s, i) => `<button class="journey-comics-link" data-jc-trail="${first + i}">${esc(s.title)} <span class="journey-comics-tick">✓</span></button>`).join("")}</span></div>`);
  }
  if (!cont && !rows.length) { container.hidden = true; container.innerHTML = ""; return; }
  if (rows.length) html += `<div class="journey-comics-list">${rows.join("")}</div>`;
  container.innerHTML = html;
  container.hidden = false;
  container.querySelectorAll("[data-jc-trail]").forEach(elm => {
    const go = (e) => { e.stopPropagation(); openTrail(trails[+elm.dataset.jcTrail]); };
    elm.addEventListener("click", go);
    elm.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(e); } });
  });
}

/* ============================= Comics landing card ============================= */
let landingSeq = 0;
export async function renderContinueCard(container) {
  if (!container) return;
  const my = ++landingSeq;
  const dest = await resolveContinue({ allowStart: true });
  if (my !== landingSeq || !container.isConnected) return;
  if (!dest) { container.hidden = true; container.innerHTML = ""; return; }
  const d = await describe(dest);
  const trail = await trailFor(dest);
  if (my !== landingSeq || !container.isConnected) return;
  const isStart = dest.kind === "start";
  container.innerHTML = `<button class="cl-continue-card" data-state="${isStart ? "start" : "continue"}">
      <span class="cl-continue-k">${isStart ? "Start reading" : "Continue reading"}</span>
      <span class="cl-continue-t">${esc(d.title)}</span>
      ${d.pathLine ? `<span class="cl-continue-m">${esc(d.pathLine)}</span>` : ""}
      ${d.next ? `<span class="cl-continue-next">${isStart ? "Begin with" : "Next"}: <b>${esc(d.next)}</b></span>` : ""}
      <span class="cl-continue-go">${isStart ? "Start →" : "Continue →"}</span>
    </button>`;
  container.hidden = false;
  container.querySelector(".cl-continue-card").addEventListener("click", () => openTrail(trail));
}

window.__comicsReading = { renderJourneyBlock, renderContinueCard, resolveContinue };
document.dispatchEvent(new CustomEvent("comicsv2:reading-ready"));
