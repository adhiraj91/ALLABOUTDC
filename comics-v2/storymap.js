// ============================================================================
// comics-v2 / storymap.js
// ----------------------------------------------------------------------------
// POINTER 4 — the zoomable, expandable COMICS STORY MAP.
//
//   Character / Universe -> Continuity -> Series -> Creative Run -> Story -> Issues
//
// - 100% data-driven: every node comes from the comic* Firestore collections via
//   comics-v2/data.js. Nothing about Batman / New 52 is hardcoded; any character,
//   continuity, series or run can be the root.
// - Progressive disclosure: only the root's first level (plus a small, data-chosen
//   "richest path") is loaded up front; everything deeper is fetched when the user
//   expands it. Reads are memoised for the page lifetime and batched with `in`
//   queries (runs for all series of a continuity, relationships for all stories of
//   a series …) — never one query per child, never a whole-collection download.
// - Relationships (comicRelationships) are drawn only where BOTH ends are on the
//   map, and only when the data has them. Sequential links (sequel_to /
//   prequel_to) and structural links (part_of_event, tie_in_to, crossover_with,
//   continues, …) are styled differently, and the legend says plainly that
//   neither is a reading order (reading paths are a later phase).
// - Hand-rolled HTML nodes + one SVG edge layer inside a CSS-transformed "world":
//   mouse wheel zoom, drag-pan, pinch-zoom + drag on touch, fit / reset, keyboard.
//   Desktop lays the graph out left-to-right as a tree; phones get a vertical
//   outline layout at readable size (not a shrunken desktop graph).
// - Independent of app.js (no imports either way). Detail actions such as "Open
//   story" hand off to the Pointer 3 explorer screens (window.__comicsExplorer.openAt).
// ============================================================================
// "?v=p4" — data.js gained new batched helpers in Pointer 4; the query string makes
// browsers fetch the new file even if an older data.js is still cached (GitHub Pages
// caches for ~10 min). It is only a separate module instance of the same stateless file.
import * as data from "./data.js?v=p4";
import { COLLECTIONS } from "./schema.js";

/* ============================= utils ============================= */
const esc = (s) => s == null ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const uniq = (a) => [...new Set((a || []).filter(Boolean))];
const isNerd = () => { try { return localStorage.getItem("dc_nerd_mode") === "true"; } catch (e) { return false; } };
const yearOf = (d) => { const m = String(d || "").match(/\d{4}/); return m ? m[0] : ""; };
function yearRange(a, b) {
  const ya = yearOf(a), yb = yearOf(b);
  if (ya && yb) return ya === yb ? ya : `${ya}–${yb}`;
  if (ya) return `${ya}–`;
  return yb || "";
}
const humanRel = (t) => String(t || "").replace(/_/g, " ");
const issueNum = (i) => { const n = parseFloat(i && i.issueNumber); return isNaN(n) ? Infinity : n; };
function sortIssues(list) {
  return list.sort((a, b) => (issueNum(a) - issueNum(b)) || String(a.issueLabel || "").localeCompare(String(b.issueLabel || "")));
}
/** "#1–7, #9" style compression of the issue numbers actually on record (never inferred). */
function compressIssueLabels(issues) {
  const nums = [], other = [];
  issues.forEach(i => { const n = issueNum(i); if (Number.isInteger(n)) nums.push(n); else other.push(i.issueLabel || i.issueNumber || "?"); });
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

const COL_BY_TYPE = {
  universe: COLLECTIONS.UNIVERSES, continuity: COLLECTIONS.CONTINUITIES, character: COLLECTIONS.CHARACTERS,
  series: COLLECTIONS.SERIES, run: COLLECTIONS.RUNS, story: COLLECTIONS.STORIES, event: COLLECTIONS.STORIES,
  issue: COLLECTIONS.ISSUES, collection: COLLECTIONS.COLLECTIONS, creator: COLLECTIONS.CREATORS,
};
const TYPE_LABEL = {
  character: "Character", universe: "Universe", continuity: "Continuity / Era", series: "Series",
  run: "Creative Run", story: "Story Arc", event: "Event", issue: "Issue",
};
const SEQUENTIAL = new Set(["sequel_to", "prequel_to"]);

/* ============================= read-through caches =============================
   Entities by collection+id, and query results by a key. A failed read is evicted
   so "Retry" really retries. */
const ENT = new Map();
const MEMO = new Map();
const remember = (col, list) => { (list || []).forEach(e => e && e.id && ENT.set(col + "::" + e.id, e)); return list; };
const cached = (col, id) => ENT.get(col + "::" + id) || null;
function memo(key, fn) {
  if (MEMO.has(key)) return MEMO.get(key);
  const p = Promise.resolve().then(fn);
  MEMO.set(key, p);
  p.catch(() => MEMO.delete(key));
  return p;
}
async function getMany(col, ids) {
  const want = uniq(ids);
  const missing = want.filter(id => !ENT.has(col + "::" + id));
  if (missing.length) remember(col, await memo(`many:${col}:${missing.slice().sort().join("|")}`, () => data.getEntitiesByIds(col, missing)));
  return want.map(id => cached(col, id)).filter(Boolean);
}
async function getOne(col, id) {
  if (!id) return null;
  const hit = cached(col, id);
  if (hit) return hit;
  const e = await memo(`one:${col}:${id}`, () => data.getEntity(col, id));
  if (e) remember(col, [e]);
  return e;
}

/* relationships — fetched in batches for whatever just became visible */
const RELS = new Map();          // relId -> rel
const RELS_BY_ENT = new Map();   // entityId -> Set(relId)
const RELS_FETCHED = new Set();  // entity ids already asked about
async function ensureRels(ids) {
  const need = uniq(ids).filter(id => !RELS_FETCHED.has(id));
  if (!need.length) return;
  const rels = await memo("rels:" + need.slice().sort().join("|"), () => data.getRelationshipsForEntities(need));
  need.forEach(id => RELS_FETCHED.add(id));
  rels.forEach(r => {
    RELS.set(r.id, r);
    [r.sourceId, r.targetId].forEach(eid => {
      if (!RELS_BY_ENT.has(eid)) RELS_BY_ENT.set(eid, new Set());
      RELS_BY_ENT.get(eid).add(r.id);
    });
  });
}
const relsFor = (id) => [...(RELS_BY_ENT.get(id) || [])].map(rid => RELS.get(rid)).filter(Boolean);

/* runs for many series in one batched read */
const RUNS_BY_SERIES = new Map();
async function ensureRunsFor(seriesIds) {
  const need = uniq(seriesIds).filter(id => !RUNS_BY_SERIES.has(id));
  if (!need.length) return;
  const runs = await memo("runs:" + need.slice().sort().join("|"), () => data.getRunsForSeriesIds(need));
  remember(COLLECTIONS.RUNS, runs);
  need.forEach(id => RUNS_BY_SERIES.set(id, []));
  runs.forEach(r => { if (RUNS_BY_SERIES.has(r.seriesId)) RUNS_BY_SERIES.get(r.seriesId).push(r); });
}

/* ============================= ordering (only from genuine data) ============================= */
function orderContinuities(list) {
  // successor/predecessor links first (the data's own era chain), then startDate, then name.
  const ids = new Set(list.map(c => c.id));
  const before = (a, b) => (a.successorId === b.id) || (b.predecessorId === a.id);
  return list.slice().sort((a, b) => {
    if (ids.has(b.id) && before(a, b)) return -1;
    if (ids.has(a.id) && before(b, a)) return 1;
    const sa = a.startDate || "9999", sb = b.startDate || "9999";
    if (sa !== sb) {
      // an undated era that is the recorded predecessor of a dated one sorts just before it
      return sa < sb ? -1 : 1;
    }
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}
function orderSeries(list) {
  return list.slice().sort((a, b) => String(a.startDate || "9999").localeCompare(String(b.startDate || "9999")) || String(a.title || "").localeCompare(String(b.title || "")));
}
function orderRuns(list) {
  return list.slice().sort((a, b) => (parseFloat(a.startIssue) || 0) - (parseFloat(b.startIssue) || 0) || String(a.startDate || "").localeCompare(String(b.startDate || "")));
}
/** Stories have no "order within run" field. The only ordering used is the data's own
    sequel_to / prequel_to links (a stable topological sort); anything unlinked keeps
    the order Firestore returned. This is story continuity, NOT a recommended reading order. */
function orderStories(list) {
  const idx = new Map(list.map((s, i) => [s.id, i]));
  const after = new Map(list.map(s => [s.id, new Set()]));  // id -> ids that must come before it
  list.forEach(s => relsFor(s.id).forEach(r => {
    if (!idx.has(r.sourceId) || !idx.has(r.targetId)) return;
    if (r.relationshipType === "sequel_to") after.get(r.sourceId).add(r.targetId);
    if (r.relationshipType === "prequel_to") after.get(r.targetId).add(r.sourceId);
  }));
  const out = [], done = new Set();
  while (out.length < list.length) {
    const ready = list.filter(s => !done.has(s.id) && [...after.get(s.id)].every(d => done.has(d)));
    const pick = ready.length ? ready[0] : list.find(s => !done.has(s.id)); // cycle guard
    done.add(pick.id); out.push(pick);
  }
  return out;
}
/** An "event" is a story the data itself marks as one: referenced by another story's eventId,
    or the target of a part_of_event relationship. */
function isEventStory(id) {
  for (const r of relsFor(id)) if (r.relationshipType === "part_of_event" && r.targetId === id) return true;
  for (const [k, e] of ENT) if (k.startsWith(COLLECTIONS.STORIES + "::") && e.eventId === id) return true;
  return false;
}

/* ============================= labels ============================= */
function entityTitle(type, e) {
  if (!e) return "";
  if (type === "character" || type === "creator") return e.displayName || e.name || "Unnamed";
  if (type === "universe" || type === "continuity") return e.name || "Untitled";
  if (type === "series") return e.title ? `${e.title}${yearOf(e.startDate) ? ` (${yearOf(e.startDate)})` : ""}` : "Untitled series";
  if (type === "run") return e.title || runCreatorsLabel(e) || "Creative run";
  if (type === "issue") {
    const s = cached(COLLECTIONS.SERIES, e.seriesId);
    return `${s ? s.title + " " : ""}${e.issueLabel || (e.issueNumber != null ? "#" + e.issueNumber : "Issue")}`;
  }
  return e.title || "Untitled";
}
function runCreatorsLabel(r) {
  return (r.creatorIds || []).map(id => cached(COLLECTIONS.CREATORS, id)).filter(Boolean).map(c => c.displayName || c.name).join(" / ");
}
function runIssueRange(r) {
  if (r.startIssue != null && r.endIssue != null) return `#${r.startIssue}–${r.endIssue}`;
  if (r.startIssue != null) return `from #${r.startIssue}`;
  return "";
}

/* ============================= node model ============================= */
let S = null; // current map session

function newSession(rootType, rootId, opts) {
  return {
    rootType, rootId, opts: opts || {},
    nodes: new Map(), rootKey: null, focusKey: null, selectedKey: null,
    view: { k: 1, tx: 0, ty: 0 }, layout: null, mode: null,
    showRels: true, relatedMode: false, token: 0, prevRendered: new Set(),
  };
}
function makeNode(type, e, parentKey, extra) {
  const key = (parentKey ? parentKey + "/" : "") + type + ":" + e.id;
  const parent = parentKey ? S.nodes.get(parentKey) : null;
  const n = {
    key, type, id: e.id, e, parent: parentKey, depth: parent ? parent.depth + 1 : 0,
    children: null, expanded: false, status: "idle", err: null, pool: null, ...(extra || {}),
  };
  S.nodes.set(key, n);
  return n;
}
const displayType = (n) => (n.type === "story" && isEventStory(n.id)) ? "event" : n.type;
const canExpand = (n) => n.type !== "issue" && n.type !== "empty";
function ancestors(n) { const out = []; let c = n; while (c) { out.unshift(c); c = c.parent ? S.nodes.get(c.parent) : null; } return out; }
const ancestorOfType = (n, t) => ancestors(n).reverse().find(a => a.type === t && a !== n) || null;

/** Loads (once, memoised) and returns the child specs of a node — the only place that reads Firestore for the map. */
async function childSpecs(n) {
  const e = n.e;
  if (n.type === "character") {
    const series = remember(COLLECTIONS.SERIES, await memo("sfc:" + e.id, () => data.getSeriesForCharacter(e.id)));
    const conts = orderContinuities(await getMany(COLLECTIONS.CONTINUITIES, uniq([...(e.continuityIds || []), ...series.flatMap(s => s.continuityIds || [])])));
    const specs = conts.map(ct => ({ type: "continuity", e: ct, pool: series.filter(s => (s.continuityIds || []).includes(ct.id)) }));
    orderSeries(series.filter(s => !(s.continuityIds || []).length)).forEach(s => specs.push({ type: "series", e: s }));
    return specs;
  }
  if (n.type === "universe") {
    const conts = remember(COLLECTIONS.CONTINUITIES, await memo("cfu:" + e.id, () => data.getContinuitiesForUniverse(e.id)));
    return orderContinuities(conts).map(ct => ({ type: "continuity", e: ct }));
  }
  if (n.type === "continuity") {
    const series = n.pool || remember(COLLECTIONS.SERIES, await memo("sfct:" + e.id, () => data.getSeriesForContinuity(e.id)));
    n.pool = series;
    await Promise.all([ensureRunsFor(series.map(s => s.id)), ensureRels(series.map(s => s.id))]);
    return orderSeries(series).map(s => ({ type: "series", e: s }));
  }
  if (n.type === "series") {
    const [, stories] = await Promise.all([
      ensureRunsFor([e.id]),
      memo("stfs:" + e.id, () => data.getStoriesForSeries(e.id)),
    ]);
    remember(COLLECTIONS.STORIES, stories);
    const runs = orderRuns(RUNS_BY_SERIES.get(e.id) || []);
    await Promise.all([
      ensureRels([...stories.map(s => s.id), ...runs.map(r => r.id)]),
      getMany(COLLECTIONS.CREATORS, runs.flatMap(r => r.creatorIds || [])),
    ]);
    const runIds = new Set(runs.map(r => r.id));
    const specs = runs.map(r => ({ type: "run", e: r, pool: stories.filter(st => st.runId === r.id) }));
    orderStories(stories.filter(st => !runIds.has(st.runId))).forEach(st => specs.push({ type: "story", e: st }));
    return specs;
  }
  if (n.type === "run") {
    const stories = n.pool || remember(COLLECTIONS.STORIES, await memo("stfr:" + e.id, () => data.getStoriesForRun(e.id)));
    n.pool = stories;
    await ensureRels(stories.map(s => s.id));
    return orderStories(stories).map(st => ({ type: "story", e: st }));
  }
  if (n.type === "story") {
    const issues = remember(COLLECTIONS.ISSUES, await memo("ifs:" + e.id, () => data.getIssuesForStory(e.id)));
    await getMany(COLLECTIONS.SERIES, issues.map(i => i.seriesId));
    return sortIssues(issues.slice()).map(i => ({ type: "issue", e: i }));
  }
  return [];
}

async function expand(n, { quiet } = {}) {
  if (!canExpand(n)) return;
  n.expanded = true;
  if (n.children) { if (!quiet) { S.focusKey = n.key; relayout(); focusOn(n, true); } return; }
  n.status = "loading"; n.err = null;
  if (!quiet) render();
  const sess = S;
  try {
    const specs = await childSpecs(n);
    if (S !== sess) return;
    n.children = specs.map(sp => makeNode(sp.type, sp.e, n.key, sp.pool ? { pool: sp.pool } : null).key);
    n.status = "ready";
  } catch (err) {
    if (S !== sess) return;
    console.warn("[Story Map] couldn't load children of", n.key, err);
    n.status = "error"; n.err = err; n.expanded = false;
  }
  if (!quiet) { S.focusKey = n.key; relayout(); focusOn(n, true); if (S.selectedKey === n.key) renderDetail(); }
}
function collapse(n) {
  n.expanded = false;
  const walk = (k) => { const c = S.nodes.get(k); if (!c) return; c.expanded = false; (c.children || []).forEach(walk); };
  (n.children || []).forEach(walk);
  if (S.selectedKey && !isVisible(S.selectedKey)) { S.selectedKey = null; closeDetail(); }
  if (S.focusKey && !isVisible(S.focusKey)) S.focusKey = n.key;
}
function isVisible(key) {
  let n = S.nodes.get(key);
  if (!n) return false;
  while (n.parent) { const p = S.nodes.get(n.parent); if (!p || !p.expanded) return false; n = p; }
  return true;
}

/* Initial "richest path": expand the data's own biggest branch a few levels deep so the first
   view is understandable (root -> era -> series -> run -> stories), without any hardcoding. */
async function autoExpand(n, depthLeft) {
  await expand(n, { quiet: true });
  if (depthLeft <= 0 || !n.children || !n.children.length) return;
  const kids = n.children.map(k => S.nodes.get(k));
  const score = (c) => {
    if (c.type === "continuity") return (c.pool || []).length;
    if (c.type === "series") return (RUNS_BY_SERIES.get(c.id) || []).length;
    if (c.type === "run") return (c.pool || []).length + 1;
    return 0;
  };
  let best = null, bestScore = 0;
  kids.forEach(c => { const s = score(c); if (s > bestScore) { best = c; bestScore = s; } });
  if (best) await autoExpand(best, depthLeft - 1);
}

/* ============================= layout ============================= */
const TREE_SIZE = {
  character: [230, 70], universe: [230, 64], continuity: [220, 62], series: [220, 60],
  run: [236, 66], story: [220, 60], event: [220, 64], empty: [200, 38],
};
const COL_GAP = 78, ROW_GAP = 12;

function visibleTree() {
  const out = [];
  const walk = (key, depth) => {
    const n = S.nodes.get(key); if (!n) return;
    out.push(n);
    if (n.expanded && n.children) n.children.forEach(k => walk(k, depth + 1));
  };
  walk(S.rootKey, 0);
  return out;
}

function chipWidth(n) { return Math.max(46, Math.min(190, 18 + entityTitle("issue", n.e).length * 6.6)); }

function computeLayout() {
  const vp = el.viewport.getBoundingClientRect();
  const mode = vp.width < 760 ? "outline" : "tree";
  S.mode = mode;
  el.root.dataset.mode = mode;
  const pos = new Map();
  const blocks = []; // issue chip blocks: {parentKey, x, y, w, h}
  if (mode === "tree") {
    let cursor = 0;
    const colX = (d) => d * (236 + COL_GAP);
    const place = (n) => {
      const t = displayType(n);
      const [w, h] = TREE_SIZE[t] || TREE_SIZE.story;
      const x = colX(n.depth);
      const kids = (n.expanded && n.children) ? n.children.map(k => S.nodes.get(k)) : [];
      if (n.expanded && n.children && !n.children.length) {
        // empty-state leaf
        const ey = cursor; cursor += 38 + ROW_GAP;
        pos.set(n.key + "#empty", { x: colX(n.depth + 1), y: ey, w: 200, h: 38, empty: true, parentKey: n.key });
        pos.set(n.key, { x, y: ey + 19 - h / 2, w, h });
        return;
      }
      if (!kids.length) { pos.set(n.key, { x, y: cursor, w, h }); cursor += h + ROW_GAP; return; }
      if (kids.every(k => k.type === "issue")) {
        const maxW = 380, gap = 6, chipH = 30;
        let cx = 0, cy = 0, rowW = 0;
        const bx = colX(n.depth + 1), by0 = cursor;
        kids.forEach(k => {
          const cw = chipWidth(k);
          if (cx > 0 && cx + cw > maxW) { cx = 0; cy += chipH + gap; }
          pos.set(k.key, { x: bx + cx, y: by0 + cy, w: cw, h: chipH, chip: true });
          cx += cw + gap; rowW = Math.max(rowW, cx);
        });
        const bh = cy + chipH;
        blocks.push({ parentKey: n.key, x: bx, y: by0, w: rowW - gap, h: bh });
        const blockMid = by0 + bh / 2;
        cursor = by0 + Math.max(bh, h) + ROW_GAP + 6;
        pos.set(n.key, { x, y: blockMid - h / 2, w, h });
        return;
      }
      kids.forEach(place);
      const first = pos.get(kids[0].key), last = pos.get(kids[kids.length - 1].key);
      const mid = ((first.y + first.h / 2) + (last.y + last.h / 2)) / 2;
      pos.set(n.key, { x, y: mid - h / 2, w, h });
      if (n.depth <= 1) cursor += 10; // breathing room between big branches
    };
    place(S.nodes.get(S.rootKey));
  } else {
    // Phone: vertical outline. Every node gets its own readable row; depth is an indent; a right
    // gutter is kept free for relationship arcs.
    const W = Math.max(300, vp.width);
    const INDENT = 20, LEFT = 10, GUTTER = 32;
    let cursor = 8;
    const place = (n) => {
      const t = displayType(n);
      const h = t === "character" ? 64 : t === "run" ? 62 : (t === "event" || t === "story") ? 58 : 56;
      const x = LEFT + n.depth * INDENT;
      const w = W - x - GUTTER;
      pos.set(n.key, { x, y: cursor, w, h });
      cursor += h + 10;
      if (!n.expanded || !n.children) return;
      const kids = n.children.map(k => S.nodes.get(k));
      if (!kids.length) {
        const ex = LEFT + (n.depth + 1) * INDENT;
        pos.set(n.key + "#empty", { x: ex, y: cursor, w: W - ex - GUTTER, h: 36, empty: true, parentKey: n.key });
        cursor += 46; return;
      }
      if (kids.every(k => k.type === "issue")) {
        const bx = LEFT + (n.depth + 1) * INDENT, maxW = W - bx - GUTTER, gap = 6, chipH = 32;
        let cx = 0, cy = 0;
        const by0 = cursor;
        kids.forEach(k => {
          const cw = Math.min(maxW, chipWidth(k));
          if (cx > 0 && cx + cw > maxW) { cx = 0; cy += chipH + gap; }
          pos.set(k.key, { x: bx + cx, y: by0 + cy, w: cw, h: chipH, chip: true });
          cx += cw + gap;
        });
        blocks.push({ parentKey: n.key, x: bx, y: by0, w: maxW, h: cy + chipH });
        cursor = by0 + cy + chipH + 14;
        return;
      }
      kids.forEach(place);
      if (n.depth === 0) cursor += 4;
    };
    place(S.nodes.get(S.rootKey));
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pos.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x + p.w); maxY = Math.max(maxY, p.y + p.h); });
  if (mode === "outline") { maxX = Math.max(maxX + 34, vp.width); minX = 0; }
  // Normalise so the layout starts at (0,0) — tree mode can place a parent above its first child.
  const dx = -minX, dy = -minY;
  pos.forEach(p => { p.x += dx; p.y += dy; });
  blocks.forEach(b => { b.x += dx; b.y += dy; });
  return { mode, pos, blocks, width: maxX - minX, height: maxY - minY };
}

/* ============================= DOM ============================= */
const el = {};
function buildShell() {
  if (el.root) return;
  const root = document.createElement("div");
  root.className = "sm-root";
  root.id = "storyMap";
  root.dataset.open = "false";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Comics Story Map");
  root.innerHTML = `
    <div class="sm-topbar">
      <button class="sm-icon-btn" id="smBack" aria-label="Back">←</button>
      <div class="sm-heading">
        <div class="sm-kicker">STORY MAP</div>
        <nav class="sm-crumbs" id="smCrumbs" aria-label="Breadcrumb"></nav>
      </div>
      <button class="sm-icon-btn" id="smClose" aria-label="Close story map">✕</button>
    </div>
    <div class="sm-viewport" id="smViewport" tabindex="0" aria-label="Story map canvas. Drag to pan, scroll or pinch to zoom.">
      <div class="sm-world" id="smWorld">
        <svg class="sm-edges" id="smEdges" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="smArrowSeq" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" class="sm-arrow-seq"/></marker>
          </defs>
          <g id="smEdgesTree"></g><g id="smEdgesRel"></g>
        </svg>
        <div class="sm-nodes" id="smNodes"></div>
      </div>
      <div class="sm-state" id="smState" hidden></div>
    </div>
    <div class="sm-controls" id="smControls" role="toolbar" aria-label="Map controls">
      <button class="sm-ctl" data-ctl="out" aria-label="Zoom out">−</button>
      <button class="sm-ctl" data-ctl="in" aria-label="Zoom in">+</button>
      <button class="sm-ctl sm-ctl-text" data-ctl="fit" aria-label="Fit map to screen">Fit</button>
      <button class="sm-ctl sm-ctl-text" data-ctl="reset" aria-label="Reset map">Reset</button>
      <button class="sm-ctl sm-ctl-text" data-ctl="collapse" aria-label="Collapse all branches">Collapse</button>
      <button class="sm-ctl sm-ctl-text" data-ctl="legend" aria-label="Show legend" aria-expanded="false">Key</button>
    </div>
    <div class="sm-legend" id="smLegend" hidden>
      <div class="sm-legend-row"><svg width="34" height="10"><path d="M1 5 H33" class="sm-edge-tree"/></svg><span><b>Structure</b> — character › era › series › run › story › issues</span></div>
      <div class="sm-legend-row"><svg width="34" height="10"><path d="M1 5 H30" class="sm-rel sm-rel-seq" marker-end="url(#smArrowSeq)"/></svg><span><b>Sequel / prequel</b> — story continuity recorded in the data</span></div>
      <div class="sm-legend-row"><svg width="34" height="10"><path d="M1 5 H33" class="sm-rel sm-rel-struct"/></svg><span><b>Event · tie-in · crossover · continues</b> — how stories connect</span></div>
      <p class="sm-legend-note">Connections are not a reading order — guided reading paths come later.</p>
      <label class="sm-legend-toggle"><input type="checkbox" id="smRelToggle" checked> Show connections</label>
    </div>
    <aside class="sm-detail" id="smDetail" data-open="false" aria-live="polite">
      <div class="sm-detail-handle"></div>
      <button class="sm-icon-btn sm-detail-close" id="smDetailClose" aria-label="Close details">✕</button>
      <div class="sm-detail-body" id="smDetailBody"></div>
    </aside>`;
  document.body.appendChild(root);
  Object.assign(el, {
    root, viewport: root.querySelector("#smViewport"), world: root.querySelector("#smWorld"),
    edgesSvg: root.querySelector("#smEdges"), edgesTree: root.querySelector("#smEdgesTree"), edgesRel: root.querySelector("#smEdgesRel"),
    nodes: root.querySelector("#smNodes"), state: root.querySelector("#smState"), crumbs: root.querySelector("#smCrumbs"),
    detail: root.querySelector("#smDetail"), detailBody: root.querySelector("#smDetailBody"), legend: root.querySelector("#smLegend"),
    controls: root.querySelector("#smControls"),
  });
  wireShell();
}

function nodeKicker(n) {
  const t = displayType(n), e = n.e;
  if (t === "continuity") return ["Era", e.shortName && e.shortName !== e.name ? e.shortName : "", yearRange(e.startDate, e.endDate)].filter(Boolean).join(" · ");
  if (t === "series") return ["Series", yearRange(e.startDate, e.endDate)].filter(Boolean).join(" · ");
  if (t === "run") return ["Creative run", runIssueRange(e)].filter(Boolean).join(" · ");
  if (t === "universe") return "Universe";
  if (t === "character") return "Character";
  if (t === "event") return "Event";
  return "Story arc";
}
function nodeSub(n) {
  const t = displayType(n), e = n.e;
  if (t === "character") return (e.aliases || []).slice(0, 2).join(" · ");
  if (t === "universe") return e.description ? "" : "";
  if (t === "continuity") return n.pool ? `${n.pool.length} series` : "";
  if (t === "series") {
    const runs = RUNS_BY_SERIES.get(e.id);
    return [e.issueCount ? `${e.issueCount} issues` : "", runs && runs.length ? `${runs.length} run${runs.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");
  }
  if (t === "run") { const c = runCreatorsLabel(e); return c && c !== e.title ? c : (n.pool ? `${n.pool.length} stories` : ""); }
  if (t === "story" || t === "event") {
    const k = (e.issueIds || []).length;
    const multi = (e.seriesIds || []).length > 1 ? `across ${(e.seriesIds || []).length} series` : "";
    return [k ? `${k} issue${k === 1 ? "" : "s"}` : "", multi].filter(Boolean).join(" · ");
  }
  return "";
}
function childCountHint(n) {
  if (n.children) return n.children.length;
  if (n.type === "continuity" && n.pool) return n.pool.length;
  if (n.type === "run" && n.pool) return n.pool.length;
  if (n.type === "story") return (n.e.issueIds || []).length || null;
  return null;
}

function nodeHtml(n, p, isNew) {
  const t = displayType(n);
  const title = entityTitle(n.type, n.e);
  const sel = S.selectedKey === n.key;
  const related = S.relatedSet && S.relatedSet.has(n.id) && !sel;
  const dim = S.relatedMode && S.relatedSet && !sel && !related;
  const common = `data-key="${esc(n.key)}" data-type="${t}" data-selected="${sel}" data-related="${!!related}" data-dim="${!!dim}"${isNew ? ' data-enter="true"' : ""}`;
  const style = `transform:translate(${p.x}px,${p.y}px);width:${p.w}px;height:${p.h}px`;
  if (p.chip) {
    return `<button class="sm-chip" ${common} style="${style}" title="${esc(title)}">${esc(title)}</button>`;
  }
  let toggle = "";
  if (canExpand(n)) {
    const cnt = childCountHint(n);
    const label = n.status === "loading" ? `<span class="sm-spin" aria-hidden="true"></span>` : n.status === "error" ? "!" : n.expanded ? "−" : (cnt ? `+${cnt}` : "+");
    const aria = n.status === "error" ? "Retry loading" : n.expanded ? "Collapse" : "Expand";
    toggle = `<button class="sm-toggle" data-toggle="${esc(n.key)}" data-status="${n.status}" aria-label="${aria} ${esc(title)}" aria-expanded="${n.expanded}">${label}</button>`;
  }
  const sub = nodeSub(n);
  const mono = t === "character" ? `<span class="sm-mono" aria-hidden="true">${esc(String(title).trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase())}</span>` : "";
  return `<div class="sm-node" ${common} data-expanded="${n.expanded}" style="${style}">
      <button class="sm-node-main" data-select="${esc(n.key)}" title="${esc(title)}">
        ${mono}<span class="sm-node-text"><span class="sm-node-kicker">${esc(nodeKicker(n))}</span><span class="sm-node-title">${esc(title)}</span>${sub ? `<span class="sm-node-sub">${esc(sub)}</span>` : ""}</span>
      </button>${toggle}
    </div>`;
}

function edgePathTree(a, b) {
  const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
  const mx = x1 + (x2 - x1) * 0.5;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}
function edgePathOutline(a, b) {
  // rail starts behind the parent card (edges are drawn under the nodes), so no gap at rounded corners
  const x1 = a.x + 10, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + Math.min(b.h / 2, 18);
  const r = 7;
  return `M${x1},${y1} V${y2 - r} Q${x1},${y2} ${x1 + r},${y2} H${x2}`;
}

function relayout() { render(); }

function render() {
  if (!S || !el.root) return;
  const L = computeLayout();
  S.layout = L;
  const vis = visibleTree();
  const visKeys = new Set(vis.map(n => n.key));
  // Selected node's related entities (for highlighting)
  S.relatedSet = null;
  if (S.selectedKey) {
    const sn = S.nodes.get(S.selectedKey);
    if (sn) S.relatedSet = new Set(relsFor(sn.id).map(r => r.sourceId === sn.id ? r.targetId : r.sourceId));
  }
  let html = "";
  vis.forEach(n => {
    const p = L.pos.get(n.key); if (!p) return;
    html += nodeHtml(n, p, !S.prevRendered.has(n.key));
    const ep = L.pos.get(n.key + "#empty");
    if (ep) html += `<div class="sm-empty-leaf" style="transform:translate(${ep.x}px,${ep.y}px);width:${ep.w}px;height:${ep.h}px">${esc(emptyText(n))}</div>`;
  });
  S.prevRendered = visKeys;
  el.nodes.innerHTML = html;
  el.world.style.width = L.width + "px";
  el.world.style.height = L.height + "px";
  el.edgesSvg.setAttribute("width", Math.ceil(L.width + 80));
  el.edgesSvg.setAttribute("height", Math.ceil(L.height + 40));

  // hierarchy edges
  let tree = "";
  const pathFn = L.mode === "tree" ? edgePathTree : edgePathOutline;
  vis.forEach(n => {
    if (!n.expanded || !n.children) return;
    const a = L.pos.get(n.key);
    const block = L.blocks.find(b => b.parentKey === n.key);
    if (block) { tree += `<path class="sm-edge-tree" d="${pathFn(a, { x: block.x - (L.mode === "tree" ? 8 : 0), y: block.y, w: block.w, h: L.mode === "tree" ? block.h : 32 })}"/>`; return; }
    if (!n.children.length) { const ep = L.pos.get(n.key + "#empty"); if (ep) tree += `<path class="sm-edge-tree sm-edge-faint" d="${pathFn(a, ep)}"/>`; return; }
    n.children.forEach(k => { const b = L.pos.get(k); if (b) tree += `<path class="sm-edge-tree" data-from="${esc(n.key)}" d="${pathFn(a, b)}"/>`; });
  });
  if (L.blocks.length && L.mode === "tree") L.blocks.forEach(b => { tree += `<rect class="sm-issue-block" x="${b.x - 8}" y="${b.y - 6}" width="${b.w + 16}" height="${b.h + 12}" rx="12"/>`; });
  el.edgesTree.innerHTML = tree;
  el.edgesRel.innerHTML = S.showRels ? relEdgesSvg(vis, L) : "";

  renderCrumbs();
  applyView(false);
}

function emptyText(n) {
  const t = n.type;
  if (t === "character") return "No series recorded yet";
  if (t === "universe") return "No continuities recorded yet";
  if (t === "continuity") return "No series recorded for this era yet";
  if (t === "series") return "No runs or stories recorded yet";
  if (t === "run") return "No stories recorded yet";
  if (t === "story") return "No issues recorded yet";
  return "Nothing recorded yet";
}

/** Relationship overlay — only between two nodes that are both on the map right now. */
function relEdgesSvg(vis, L) {
  const byEnt = new Map();
  vis.forEach(n => { if (!byEnt.has(n.id)) byEnt.set(n.id, []); byEnt.get(n.id).push(n); });
  const seriesAnc = (n) => { const s = ancestorOfType(n, "series"); return s ? s.key : ""; };
  const seen = new Set();
  let out = "";
  const lanes = new Map(); // column x -> used lane count (spreads parallel arcs)
  RELS.forEach(r => {
    const A = byEnt.get(r.sourceId), B = byEnt.get(r.targetId);
    if (!A || !B || seen.has(r.id)) return;
    seen.add(r.id);
    // pick the pair of on-map instances that share a series branch, if any
    let a = A[0], b = B[0];
    outer: for (const x of A) for (const y of B) if (seriesAnc(x) && seriesAnc(x) === seriesAnc(y)) { a = x; b = y; break outer; }
    const pa = L.pos.get(a.key), pb = L.pos.get(b.key);
    if (!pa || !pb) return;
    const seq = SEQUENTIAL.has(r.relationshipType);
    // arrows point toward the LATER story in the data's own sequel/prequel link
    let from = pa, to = pb;
    if (r.relationshipType === "sequel_to") { from = pb; to = pa; }
    let d;
    const sameCol = Math.abs(from.x - to.x) < 2 || L.mode === "outline";
    if (sameCol) {
      const xr = Math.max(from.x + from.w, to.x + to.w);
      const laneKey = Math.round(xr);
      const lane = (lanes.get(laneKey) || 0); lanes.set(laneKey, lane + 1);
      const y1 = from.y + from.h / 2, y2 = to.y + to.h / 2;
      const bulge = L.mode === "outline" ? Math.min(26, 10 + Math.abs(y2 - y1) * 0.05) + (seq ? 0 : 4) : Math.min(90, 22 + Math.abs(y2 - y1) * 0.18) + (seq ? 0 : 14);
      const x1 = from.x + from.w + 2, x2 = to.x + to.w + 2;
      d = `M${x1},${y1} C${xr + bulge},${y1} ${xr + bulge},${y2} ${x2},${y2}`;
    } else {
      const leftToRight = from.x < to.x;
      const x1 = leftToRight ? from.x + from.w : from.x, x2 = leftToRight ? to.x : to.x + to.w;
      const y1 = from.y + from.h / 2, y2 = to.y + to.h / 2;
      const mx = (x1 + x2) / 2;
      d = `M${x1},${y1} C${mx},${y1 - 30} ${mx},${y2 + 30} ${x2},${y2}`;
    }
    const hl = S.selectedKey && (a.key === S.selectedKey || b.key === S.selectedKey);
    const label = `${entityTitle(a.type, a.e)} — ${humanRel(r.relationshipType)} — ${entityTitle(b.type, b.e)}`;
    out += `<path class="sm-rel ${seq ? "sm-rel-seq" : "sm-rel-struct"}" data-rel="${esc(r.relationshipType)}" data-hl="${!!hl}" d="${d}"${seq ? ' marker-end="url(#smArrowSeq)"' : ""}><title>${esc(label)}</title></path>`;
  });
  return out;
}

function renderCrumbs() {
  const focus = S.nodes.get(S.selectedKey || S.focusKey || S.rootKey);
  const trail = focus ? ancestors(focus) : [];
  let html = `<button class="sm-crumb" data-crumb="__comics">Comics</button>`;
  trail.forEach((n, i) => {
    const last = i === trail.length - 1;
    html += `<span class="sm-crumb-sep">›</span><button class="sm-crumb" data-crumb="${esc(n.key)}" data-current="${last}">${esc(shortTitle(n))}</button>`;
  });
  el.crumbs.innerHTML = html;
  const cur = el.crumbs.querySelector('[data-current="true"]');
  if (cur && cur.scrollIntoView) { try { el.crumbs.scrollLeft = el.crumbs.scrollWidth; } catch (e) { /* ignore */ } }
}
function shortTitle(n) {
  if (n.type === "run") return runCreatorsLabel(n.e) || entityTitle(n.type, n.e);
  return entityTitle(n.type, n.e);
}

/* ============================= camera (pan / zoom) ============================= */
const MIN_K = 0.3, MAX_K = 2.4;
function applyView(animate) {
  const v = S.view;
  el.world.classList.toggle("sm-animating", !!animate);
  el.world.style.transform = `translate(${v.tx}px, ${v.ty}px) scale(${v.k})`;
  el.world.dataset.k = v.k.toFixed(3);
  if (animate) { clearTimeout(applyView._t); applyView._t = setTimeout(() => el.world.classList.remove("sm-animating"), 320); }
}
function zoomAt(px, py, factor, animate) {
  const v = S.view;
  const k2 = Math.max(MIN_K, Math.min(MAX_K, v.k * factor));
  const f = k2 / v.k;
  v.tx = px - (px - v.tx) * f; v.ty = py - (py - v.ty) * f; v.k = k2;
  applyView(animate);
}
function viewportCenter() { const r = el.viewport.getBoundingClientRect(); return [r.width / 2, r.height / 2]; }
function detailInset() {
  // area of the viewport covered by the detail panel (so fits avoid hiding things under it)
  if (el.detail.dataset.open !== "true") return { right: 0, bottom: 0 };
  // offsetWidth/offsetHeight ignore the slide-in transform, so this is right even mid-animation.
  return S.mode === "tree" ? { right: el.detail.offsetWidth + 32, bottom: 0 } : { right: 0, bottom: el.detail.offsetHeight };
}
function fitBox(box, { maxK = 1, minK = MIN_K, animate = true, pad = 28, align } = {}) {
  const r = el.viewport.getBoundingClientRect();
  const inset = detailInset();
  const aw = Math.max(120, r.width - inset.right - pad * 2), ah = Math.max(120, r.height - inset.bottom - pad * 2 - 56);
  const k = Math.max(minK, Math.min(maxK, aw / Math.max(1, box.w), ah / Math.max(1, box.h)));
  const v = S.view;
  v.k = k;
  v.tx = pad + (aw - box.w * k) / 2 - box.x * k;
  v.ty = pad + (ah - box.h * k) / 2 - box.y * k;
  if (align === "top" && box.h * k > ah) v.ty = pad - box.y * k;
  if (align === "left" && box.w * k > aw) v.tx = pad - box.x * k;
  applyView(animate);
}
function fitAll(animate = true) {
  const L = S.layout; if (!L) return;
  fitBox({ x: 0, y: 0, w: L.width + (L.mode === "outline" ? 0 : 60), h: L.height }, { maxK: 1, minK: MIN_K, animate, align: "top" });
}
function resetView(animate = true) {
  const L = S.layout; if (!L) return;
  if (L.mode === "outline") { S.view = { k: 1, tx: 0, ty: 12 }; applyView(animate); return; }
  // Desktop: show the root and its whole first-expanded path at a readable scale.
  const focus = deepestExpanded();
  focusBox(focus, animate);
}
function deepestExpanded() {
  let n = S.nodes.get(S.rootKey), best = n;
  const walk = (x) => { if (x.expanded && x.children && x.children.length) { if (x.depth >= best.depth) best = x; x.children.forEach(k => walk(S.nodes.get(k))); } };
  walk(n);
  return best;
}
function subtreeBox(n, includeAncestors) {
  const L = S.layout; const keys = [n.key];
  if (n.expanded && n.children) n.children.forEach(k => keys.push(k));
  if (includeAncestors) ancestors(n).forEach(a => keys.push(a.key));
  L.blocks.filter(b => b.parentKey === n.key).forEach(b => keys.push({ box: b }));
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  keys.forEach(k => {
    const p = typeof k === "string" ? L.pos.get(k) || L.pos.get(k + "#empty") : k.box;
    if (!p) return;
    x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y); x2 = Math.max(x2, p.x + p.w); y2 = Math.max(y2, p.y + p.h);
  });
  const ep = L.pos.get(n.key + "#empty"); if (ep) { x2 = Math.max(x2, ep.x + ep.w); y2 = Math.max(y2, ep.y + ep.h); }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
function focusBox(n, animate) {
  if (!n || !S.layout) return;
  const b = subtreeBox(n, true);
  if (S.layout.mode === "tree" && S.showRels) b.w += 90; // relationship arcs bulge to the right of the last column
  fitBox(b, { maxK: 1, minK: 0.55, animate, align: "top" });
}
/** After expanding / selecting: pan (never jarringly zoom) so the node and its new children are in view. */
function focusOn(n, withChildren) {
  if (!n || !S.layout) return;
  S.focusKey = n.key;
  const L = S.layout;
  const box = withChildren ? subtreeBox(n, false) : (L.pos.get(n.key) || null);
  if (!box) return;
  const r = el.viewport.getBoundingClientRect(), inset = detailInset(), v = S.view;
  const pad = 24, aw = r.width - inset.right, ah = r.height - inset.bottom - 64;
  let sx = box.x * v.k + v.tx, sy = box.y * v.k + v.ty, sw = box.w * v.k, sh = box.h * v.k;
  let dx = 0, dy = 0;
  if (sw + pad * 2 > aw) dx = pad - sx; else if (sx < pad) dx = pad - sx; else if (sx + sw > aw - pad) dx = (aw - pad) - (sx + sw);
  if (sh + pad * 2 > ah) dy = pad - sy; else if (sy < pad) dy = pad - sy; else if (sy + sh > ah - pad) dy = (ah - pad) - (sy + sh);
  if (L.mode === "outline") dx = 0;
  if (dx || dy) { v.tx += dx; v.ty += dy; applyView(true); }
}

/* pointer handling: 1 pointer = pan, 2 pointers = pinch zoom + pan. Clicks on nodes still work
   because capture only starts once the pointer has really moved. */
const ptrs = new Map();
let drag = null, pinch = null, suppressClick = false;
function vpPoint(e) { const r = el.viewport.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function onPointerDown(e) {
  if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
  ptrs.set(e.pointerId, vpPoint(e));
  if (ptrs.size === 1) { drag = { id: e.pointerId, start: vpPoint(e), tx: S.view.tx, ty: S.view.ty, moved: false }; suppressClick = false; }
  if (ptrs.size === 2) {
    const [p1, p2] = [...ptrs.values()];
    pinch = { d: Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) || 1, mid: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2], k: S.view.k, tx: S.view.tx, ty: S.view.ty };
    drag = null; suppressClick = true;
    [...ptrs.keys()].forEach(id => { try { el.viewport.setPointerCapture(id); } catch (x) { /* ignore */ } });
  }
}
function onPointerMove(e) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, vpPoint(e));
  if (pinch && ptrs.size >= 2) {
    const [p1, p2] = [...ptrs.values()];
    const d = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) || 1;
    const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    const k2 = Math.max(MIN_K, Math.min(MAX_K, pinch.k * d / pinch.d));
    const f = k2 / pinch.k;
    S.view.k = k2;
    S.view.tx = mid[0] - (pinch.mid[0] - pinch.tx) * f;
    S.view.ty = mid[1] - (pinch.mid[1] - pinch.ty) * f;
    applyView(false);
    e.preventDefault();
    return;
  }
  if (drag && drag.id === e.pointerId) {
    const p = vpPoint(e);
    const dx = p[0] - drag.start[0], dy = p[1] - drag.start[1];
    if (!drag.moved && Math.hypot(dx, dy) > 5) {
      drag.moved = true; suppressClick = true;
      el.viewport.classList.add("sm-dragging");
      try { el.viewport.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    }
    if (drag.moved) { S.view.tx = drag.tx + dx; S.view.ty = drag.ty + dy; applyView(false); e.preventDefault(); }
  }
}
function onPointerUp(e) {
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (ptrs.size === 1 && !drag) {
    // one finger lifted after a pinch: continue as a pan with the remaining finger
    const [id, p] = [...ptrs.entries()][0];
    drag = { id, start: p, tx: S.view.tx, ty: S.view.ty, moved: true };
  }
  if (!ptrs.size) { drag = null; el.viewport.classList.remove("sm-dragging"); }
}
function onWheel(e) {
  e.preventDefault();
  if (e.shiftKey) { S.view.tx -= e.deltaY; applyView(false); return; }
  const [x, y] = vpPoint(e);
  const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  zoomAt(x, y, Math.exp(-delta * 0.0018), false);
}

/* ============================= detail panel ============================= */
let detailToken = 0;
function closeDetail() {
  el.detail.dataset.open = "false";
  el.root.dataset.detail = "false";
}
async function renderDetail() {
  const n = S && S.nodes.get(S.selectedKey);
  if (!n) { closeDetail(); return; }
  const my = ++detailToken;
  el.detail.dataset.open = "true";
  el.root.dataset.detail = "true";
  const t = displayType(n), e = n.e;
  const head = `<div class="sm-d-kicker" data-type="${t}">${esc(TYPE_LABEL[t] || t)}</div><h2 class="sm-d-title">${esc(entityTitle(n.type, e))}</h2>`;
  el.detailBody.innerHTML = head + `<div class="sm-d-loading">Loading details…</div>`;
  let body = "";
  try {
    body = await detailBodyHtml(n, t);
  } catch (err) {
    console.warn("[Story Map] detail failed", err);
    body = `<div class="sm-d-error">Couldn't load these details right now.</div>`;
  }
  if (my !== detailToken || !S || S.selectedKey !== n.key) return;
  el.detailBody.innerHTML = head + body + actionsHtml(n, t) + (isNerd() ? nerdHtml(n) : "");
  el.detailBody.scrollTop = 0;
  // the sheet's final height is only known now — keep the selected node clear of it
  requestAnimationFrame(() => { if (S && S.selectedKey === n.key) focusOn(n, false); });
}
function factRow(label, value) { return value ? `<div class="sm-d-fact"><span>${esc(label)}</span><span>${esc(value)}</span></div>` : ""; }
async function detailBodyHtml(n, t) {
  const e = n.e;
  const parts = [];
  const facts = [];
  if (t === "character") {
    if ((e.aliases || []).length) facts.push(factRow("Also known as", e.aliases.slice(0, 4).join(", ")));
    if (n.children) facts.push(factRow("On this map", `${n.children.length} continuit${n.children.length === 1 ? "y" : "ies"} / branch${n.children.length === 1 ? "" : "es"}`));
  } else if (t === "universe") {
    if (e.description) parts.push(`<p class="sm-d-desc">${esc(e.description)}</p>`);
  } else if (t === "continuity") {
    facts.push(factRow("Short name", e.shortName && e.shortName !== e.name ? e.shortName : ""));
    facts.push(factRow("Years", yearRange(e.startDate, e.endDate)));
    const [pred, succ] = await Promise.all([getOne(COLLECTIONS.CONTINUITIES, e.predecessorId), getOne(COLLECTIONS.CONTINUITIES, e.successorId)]);
    facts.push(factRow("Follows", pred && pred.name));
    facts.push(factRow("Followed by", succ && succ.name));
    if (n.pool) facts.push(factRow("Series here", String(n.pool.length)));
    if (e.description) parts.push(`<p class="sm-d-desc" data-clamp="true">${esc(e.description)}</p>`);
  } else if (t === "series") {
    const creators = await getMany(COLLECTIONS.CREATORS, e.creatorIds || []);
    facts.push(factRow("Published", yearRange(e.startDate, e.endDate)));
    facts.push(factRow("Issues", e.issueCount ? String(e.issueCount) : ""));
    facts.push(factRow("Publisher", e.publisher));
    const runs = RUNS_BY_SERIES.get(e.id);
    if (runs) facts.push(factRow("Creative runs", String(runs.length)));
    if (creators.length) facts.push(factRow("Creators", creators.map(c => c.displayName || c.name).join(", ")));
    if (e.description) parts.push(`<p class="sm-d-desc" data-clamp="true">${esc(e.description)}</p>`);
  } else if (t === "run") {
    const [creators, series] = await Promise.all([getMany(COLLECTIONS.CREATORS, e.creatorIds || []), getOne(COLLECTIONS.SERIES, e.seriesId)]);
    facts.push(factRow("Series", series && entityTitle("series", series)));
    if (creators.length) facts.push(factRow("Creators", creators.map(c => c.displayName || c.name).join(" · ")));
    facts.push(factRow("Issues", runIssueRange(e)));
    facts.push(factRow("Years", yearRange(e.startDate, e.endDate)));
    if (n.pool) facts.push(factRow("Stories", String(n.pool.length)));
    if (e.description) parts.push(`<p class="sm-d-desc" data-clamp="true">${esc(e.description)}</p>`);
  } else if (t === "story" || t === "event") {
    const [issues, series, creators, chars, run] = await Promise.all([
      memo("ifs:" + e.id, () => data.getIssuesForStory(e.id)).then(l => remember(COLLECTIONS.ISSUES, l)),
      getMany(COLLECTIONS.SERIES, e.seriesIds || []),
      getMany(COLLECTIONS.CREATORS, e.creatorIds || []),
      getMany(COLLECTIONS.CHARACTERS, e.characterIds || []),
      getOne(COLLECTIONS.RUNS, e.runId),
    ]);
    await getMany(COLLECTIONS.SERIES, issues.map(i => i.seriesId));
    const bySeries = new Map();
    issues.forEach(i => { if (!bySeries.has(i.seriesId)) bySeries.set(i.seriesId, []); bySeries.get(i.seriesId).push(i); });
    const coverage = [...bySeries.entries()].map(([sid, list]) => { const s = cached(COLLECTIONS.SERIES, sid); return `${s ? s.title : sid} ${compressIssueLabels(list)}`; });
    facts.push(factRow(series.length > 1 ? "Series" : "Series", series.map(s => entityTitle("series", s)).join(", ")));
    if (run) facts.push(factRow("Creative run", run.title || runCreatorsLabel(run)));
    if (creators.length) facts.push(factRow("Creators", creators.map(c => c.displayName || c.name).join(" · ")));
    if (coverage.length) parts.push(`<div class="sm-d-section"><div class="sm-d-label">Issue coverage</div><div class="sm-d-coverage">${coverage.map(c => `<div>${esc(c)}</div>`).join("")}</div></div>`);
    if (chars.length) parts.push(`<div class="sm-d-section"><div class="sm-d-label">Characters</div><div class="sm-d-names">${chars.slice(0, 8).map(c => esc(c.displayName || c.name)).join(" · ")}${chars.length > 8 ? ` · +${chars.length - 8}` : ""}</div></div>`);
    if (e.description) parts.unshift(`<p class="sm-d-desc" data-clamp="true">${esc(e.description)}</p>`);
  } else if (t === "issue") {
    const [series, stories, creators] = await Promise.all([
      getOne(COLLECTIONS.SERIES, e.seriesId), getMany(COLLECTIONS.STORIES, e.storyIds || []), getMany(COLLECTIONS.CREATORS, e.creatorIds || []),
    ]);
    facts.push(factRow("Series", series && entityTitle("series", series)));
    facts.push(factRow("Title", e.title));
    facts.push(factRow("Published", e.publicationDate || e.coverDate));
    if (stories.length) facts.push(factRow("Story", stories.map(s => s.title).join(", ")));
    if (creators.length) facts.push(factRow("Creators", creators.map(c => c.displayName || c.name).join(" · ")));
  }
  // Relationships (both directions), with the other end resolved to a name.
  await ensureRels([e.id]);
  const rels = relsFor(e.id);
  if (rels.length) {
    const rows = await Promise.all(rels.map(async r => {
      const outgoing = r.sourceId === e.id;
      const otherId = outgoing ? r.targetId : r.sourceId, otherType = outgoing ? r.targetType : r.sourceType;
      const col = COL_BY_TYPE[otherType];
      const other = col ? await getOne(col, otherId) : null;
      if (!other) return "";
      const phrase = relPhrase(r.relationshipType, outgoing);
      const onMap = visibleKeyFor(otherId);
      const seq = SEQUENTIAL.has(r.relationshipType);
      return `<button class="sm-d-rel" data-rel-kind="${seq ? "seq" : "struct"}" data-goto="${esc(onMap || "")}" data-goto-type="${esc(otherType)}" data-goto-id="${esc(otherId)}">
          <span class="sm-d-rel-type">${esc(phrase)}</span><span class="sm-d-rel-name">${esc(entityTitle(otherType === "event" ? "story" : otherType, other))}</span>
          <span class="sm-d-rel-go">${onMap ? "Show" : "Open"}</span></button>`;
    }));
    const body = rows.filter(Boolean).join("");
    if (body) parts.push(`<div class="sm-d-section"><div class="sm-d-label">Connections</div><div class="sm-d-rels">${body}</div><div class="sm-d-hint">Recorded links between stories — not a reading order.</div></div>`);
  }
  return `<div class="sm-d-facts">${facts.join("")}</div>` + parts.join("");
}
function relPhrase(type, outgoing) {
  const map = {
    sequel_to: ["Sequel to", "Followed by (sequel)"], prequel_to: ["Prequel to", "Preceded by (prequel)"],
    part_of_event: ["Part of event", "Includes"], tie_in_to: ["Tie-in to", "Has tie-in"],
    crossover_with: ["Crossover with", "Crossover with"], continues: ["Continues", "Continued by"],
    relaunches: ["Relaunches", "Relaunched as"], spin_off_from: ["Spin-off from", "Spun off into"],
    alternate_version_of: ["Alternate version of", "Has alternate version"], adaptation_of: ["Adaptation of", "Adapted as"],
    features_character: ["Features", "Featured in"],
  };
  const m = map[type];
  return m ? m[outgoing ? 0 : 1] : humanRel(type);
}
function visibleKeyFor(entityId) {
  for (const n of visibleTree()) if (n.id === entityId) return n.key;
  return null;
}
function actionsHtml(n, t) {
  const b = (act, label, primary) => `<button class="sm-d-action${primary ? " sm-d-primary" : ""}" data-act="${act}">${esc(label)}</button>`;
  const acts = [];
  const exp = canExpand(n) ? b("toggle", n.expanded ? "Collapse" : (t === "story" || t === "event" ? "View issues" : "Expand on map"), true) : "";
  if (t === "story" || t === "event") {
    acts.push(b("explore-story", "Open story", true), exp.replace(" sm-d-primary", ""));
    if ((n.e.seriesIds || []).length) acts.push(b("explore-series", "View series"));
    if (relsFor(n.id).length) acts.push(b("related", S.relatedMode ? "Show all" : "Explore related stories"));
  } else if (t === "issue") {
    acts.push(b("explore-issue", "Open issue", true));
    acts.push(b("explore-story-of-issue", "Open story"));
  } else {
    if (exp) acts.push(exp);
    const label = { character: "Open in Explorer", continuity: "Open in Explorer", series: "View series", run: "Open run" }[t];
    if (label) acts.push(b("explore-self", label));
    if (t !== "character" && t !== "universe") acts.push(b("recenter", "Map from here"));
  }
  return `<div class="sm-d-actions">${acts.join("")}</div>`;
}
function nerdHtml(n) {
  const e = n.e, si = e.sourceInfo || {};
  const lines = [`id: ${e.id}`, `type: ${n.type}`, `verification: ${si.verificationStatus || "unverified"}${si.sourceName ? ` (${si.sourceName})` : ""}`];
  ["universeId", "continuityId", "seriesId", "runId", "eventId"].forEach(k => { if (e[k]) lines.push(`${k}: ${e[k]}`); });
  ["continuityIds", "seriesIds", "characterIds"].forEach(k => { if ((e[k] || []).length) lines.push(`${k}: ${e[k].join(", ")}`); });
  return `<div class="sm-d-nerd">${lines.map(esc).join("<br>")}</div>`;
}

/* ---- hand-offs to the Pointer 3 explorer screens ---- */
function explorerTrailFor(n) {
  const trail = [];
  const chain = ancestors(n);
  let character = null, series = null, run = null, story = null;
  chain.forEach(a => {
    if (a.type === "character") { character = a.e; trail.push({ level: "character", label: entityTitle("character", a.e), params: { character: a.e } }); }
    else if (a.type === "continuity") trail.push({ level: "continuity", label: a.e.name, params: character ? { continuity: a.e, character } : { continuity: a.e } });
    else if (a.type === "series") { series = a.e; trail.push({ level: "series", label: a.e.title, params: { series: a.e } }); }
    else if (a.type === "run") { run = a.e; trail.push({ level: "run", label: a.e.title || runCreatorsLabel(a.e) || "Run", params: { run: a.e, series } }); }
    else if (a.type === "story") { story = a.e; trail.push({ level: "story", label: a.e.title, params: { story: a.e, series, run } }); }
    else if (a.type === "issue") trail.push({ level: "issue", label: a.e.issueLabel || "Issue", params: { issue: a.e, story } });
  });
  return trail;
}
function openExplorer(trail) {
  const ex = window.__comicsExplorer;
  if (ex && ex.openAt) ex.openAt(trail);
  else if (ex && ex.open) ex.open();
}
async function onDetailAction(act, n) {
  const t = displayType(n);
  if (act === "toggle") {
    if (n.expanded) { collapse(n); render(); renderDetail(); }
    else { await expand(n); renderDetail(); }
    return;
  }
  if (act === "explore-self" || act === "explore-story" || act === "explore-issue") { openExplorer(explorerTrailFor(n)); return; }
  if (act === "explore-series") {
    const sAnc = ancestorOfType(n, "series");
    if (sAnc) { openExplorer(explorerTrailFor(sAnc)); return; }
    const s = await getOne(COLLECTIONS.SERIES, (n.e.seriesIds || [])[0]);
    if (s) openExplorer([{ level: "series", label: s.title, params: { series: s } }]);
    return;
  }
  if (act === "explore-story-of-issue") {
    const st = ancestorOfType(n, "story");
    if (st) openExplorer(explorerTrailFor(st));
    return;
  }
  if (act === "related") {
    S.relatedMode = !S.relatedMode;
    S.showRels = true; syncRelToggle();
    render(); renderDetail();
    return;
  }
  if (act === "recenter") { openMap(n.type === "event" ? "story" : n.type, n.id, { entity: n.e }); return; }
  void t;
}

/* ============================= selection / navigation ============================= */
function select(key, { center } = {}) {
  const n = S.nodes.get(key); if (!n) return;
  S.selectedKey = key; S.focusKey = key;
  if (!(S.relatedSet && S.relatedSet.has(n.id))) S.relatedMode = false;
  render();
  renderDetail();
  requestAnimationFrame(() => focusOn(n, false));
  void center;
}
function goBack() {
  const cur = S && S.nodes.get(S.selectedKey || S.focusKey || S.rootKey);
  if (!cur || !cur.parent) { requestClose(); return; }
  const parent = S.nodes.get(cur.parent);
  if (cur.expanded) collapse(cur);
  S.relatedMode = false;
  if (el.detail.dataset.open === "true") { select(parent.key); return; }
  S.selectedKey = null; S.focusKey = parent.key;
  render();
  focusOn(parent, true);
}

/* ============================= open / close ============================= */
async function resolveRoot(type, id, entity) {
  if (entity) return entity;
  const col = COL_BY_TYPE[type];
  return col ? await getOne(col, id) : null;
}
export async function openMap(type, id, opts = {}) {
  buildShell();
  const firstOpen = el.root.dataset.open !== "true";
  S = newSession(type, id, opts);
  const sess = S;
  el.root.dataset.open = "true";
  document.documentElement.classList.add("sm-lock");
  closeDetail();
  el.nodes.innerHTML = ""; el.edgesTree.innerHTML = ""; el.edgesRel.innerHTML = "";
  el.crumbs.innerHTML = `<button class="sm-crumb" data-crumb="__comics">Comics</button>`;
  showState(`<div class="sm-loading"><span class="sm-spin sm-spin-lg"></span><div>Mapping the story…</div></div>`);
  if (firstOpen && !(history.state && history.state.storyMap)) {
    try { history.pushState({ ...(history.state || {}), storyMap: true }, "", location.href); } catch (e) { /* ignore */ }
  }
  try { el.viewport.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  let rootEntity;
  try {
    rootEntity = await resolveRoot(type, id, opts.entity);
    if (S !== sess) return;
    if (!rootEntity) throw new Error(`No ${type} "${id}" in the comics database`);
    const nodeType = type === "event" ? "story" : type;
    const root = makeNode(nodeType, rootEntity, null);
    S.rootKey = root.key; S.focusKey = root.key;
    if (opts.expandPath && opts.expandPath.length) {
      // e.g. landing "featured story map": series root with a specific run opened
      await expand(root, { quiet: true });
      let cur = root;
      for (const want of opts.expandPath) {
        const child = (cur.children || []).map(k => S.nodes.get(k)).find(c => c.id === want);
        if (!child) break;
        await expand(child, { quiet: true });
        cur = child;
      }
    } else {
      await autoExpand(root, opts.depth != null ? opts.depth : 3);
    }
    if (S !== sess) return;
    S.focusKey = deepestExpanded().key;
    hideState();
    render();
    if (root.status === "error") showRootError(root);
    else if (root.children && (!root.children.length || (root.type === "character" && root.children.every(k => { const c = S.nodes.get(k); return c.type === "continuity" && c.pool && !c.pool.length; })))) showState(`<div class="sm-empty-card"><div class="sm-empty-title">${esc(entityTitle(root.type, root.e))} isn't mapped yet</div><p>No ${root.type === "universe" ? "continuities" : root.type === "character" ? "series" : "entries"} have been recorded for this ${TYPE_LABEL[root.type] ? TYPE_LABEL[root.type].toLowerCase() : "entry"} yet. The map grows automatically as comics data is added.</p><button class="sm-d-action sm-d-primary" data-state-act="close">Back to Comics</button></div>`, true);
    requestAnimationFrame(() => { if (S === sess) { resetView(false); S.prevRendered = new Set(visibleTree().map(n => n.key)); } });
  } catch (err) {
    if (S !== sess) return;
    console.warn("[Story Map] couldn't open", type, id, err);
    showState(`<div class="sm-empty-card sm-error-card"><div class="sm-empty-title">Couldn't load the story map</div><p>The comics database didn't respond. Check your connection and try again.</p>${isNerd() ? `<div class="sm-d-nerd">${esc(err && err.message)}</div>` : ""}<div class="sm-d-actions"><button class="sm-d-action sm-d-primary" data-state-act="retry">Try again</button><button class="sm-d-action" data-state-act="close">Back to Comics</button></div></div>`);
  }
}
function showRootError(root) {
  showState(`<div class="sm-empty-card sm-error-card"><div class="sm-empty-title">Couldn't load ${esc(entityTitle(root.type, root.e))}</div><p>Part of the map didn't load. Try again in a moment.</p><div class="sm-d-actions"><button class="sm-d-action sm-d-primary" data-state-act="retry">Try again</button><button class="sm-d-action" data-state-act="close">Back to Comics</button></div></div>`);
}
function showState(html, overlayOnly) {
  el.state.innerHTML = html; el.state.hidden = false;
  el.state.dataset.overlay = overlayOnly ? "true" : "false";
}
function hideState() { el.state.hidden = true; el.state.innerHTML = ""; }

function doClose() {
  if (!el.root) return;
  el.root.dataset.open = "false";
  document.documentElement.classList.remove("sm-lock");
  closeDetail();
  S = null;
  document.dispatchEvent(new CustomEvent("comicsv2:storymap-closed"));
}
function requestClose() {
  // The map added one history entry when it opened; consume it so Back doesn't need two presses.
  if (history.state && history.state.storyMap) { try { history.back(); return; } catch (e) { /* fall through */ } }
  doClose();
}
window.addEventListener("popstate", () => {
  if (!el.root || el.root.dataset.open !== "true") return;
  if (document.querySelector('.sheet[data-open="true"]')) return; // app.js closes the sheet on top first
  if (!(history.state && history.state.storyMap)) doClose();
});

/* ============================= wiring ============================= */
function syncRelToggle() { const cb = el.root.querySelector("#smRelToggle"); if (cb) cb.checked = S.showRels; }
function wireShell() {
  el.root.querySelector("#smClose").addEventListener("click", requestClose);
  el.root.querySelector("#smBack").addEventListener("click", () => { if (S) goBack(); });
  el.root.querySelector("#smDetailClose").addEventListener("click", () => { if (!S) return; S.selectedKey = null; S.relatedMode = false; closeDetail(); render(); });
  el.crumbs.addEventListener("click", (e) => {
    const b = e.target.closest("[data-crumb]"); if (!b || !S) return;
    if (b.dataset.crumb === "__comics") { requestClose(); return; }
    const n = S.nodes.get(b.dataset.crumb); if (!n) return;
    S.relatedMode = false;
    select(n.key);
  });
  el.viewport.addEventListener("pointerdown", onPointerDown);
  el.viewport.addEventListener("pointermove", onPointerMove, { passive: false });
  el.viewport.addEventListener("pointerup", onPointerUp);
  el.viewport.addEventListener("pointercancel", onPointerUp);
  el.viewport.addEventListener("wheel", onWheel, { passive: false });
  el.viewport.addEventListener("click", async (e) => {
    if (!S) return;
    if (suppressClick) { suppressClick = false; e.stopPropagation(); return; }
    const st = e.target.closest("[data-state-act]");
    if (st) { if (st.dataset.stateAct === "retry") openMap(S.rootType, S.rootId, S.opts); else requestClose(); return; }
    const tg = e.target.closest("[data-toggle]");
    if (tg) {
      const n = S.nodes.get(tg.dataset.toggle); if (!n) return;
      if (n.expanded) { collapse(n); render(); } else { await expand(n); }
      if (S && S.selectedKey === n.key) renderDetail();
      return;
    }
    const sel = e.target.closest("[data-select], .sm-chip");
    if (sel) { select(sel.dataset.select || sel.dataset.key); return; }
    if (e.target === el.viewport || e.target.closest(".sm-world") === el.world && !e.target.closest(".sm-node,.sm-chip")) {
      // tap on empty canvas: clear related-highlighting only (keep the detail open — less jumpy)
      if (S.relatedMode) { S.relatedMode = false; render(); renderDetail(); }
    }
  });
  el.viewport.addEventListener("dblclick", (e) => {
    if (!S) return;
    const sel = e.target.closest("[data-select]");
    if (sel) { const n = S.nodes.get(sel.dataset.select); if (n && canExpand(n)) { if (n.expanded) { collapse(n); render(); } else expand(n); } return; }
    const [x, y] = vpPoint(e); zoomAt(x, y, 1.5, true);
  });
  el.viewport.addEventListener("keydown", (e) => {
    if (!S) return;
    const [cx, cy] = viewportCenter();
    const step = 60;
    if (e.key === "+" || e.key === "=") zoomAt(cx, cy, 1.25, true);
    else if (e.key === "-" || e.key === "_") zoomAt(cx, cy, 0.8, true);
    else if (e.key === "0") resetView(true);
    else if (e.key === "ArrowLeft" && !e.target.closest("button")) { S.view.tx += step; applyView(true); }
    else if (e.key === "ArrowRight" && !e.target.closest("button")) { S.view.tx -= step; applyView(true); }
    else if (e.key === "ArrowUp" && !e.target.closest("button")) { S.view.ty += step; applyView(true); }
    else if (e.key === "ArrowDown" && !e.target.closest("button")) { S.view.ty -= step; applyView(true); }
    else return;
    e.preventDefault();
  });
  el.controls.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ctl]"); if (!b || !S) return;
    const [cx, cy] = viewportCenter();
    const c = b.dataset.ctl;
    if (c === "in") zoomAt(cx, cy, 1.3, true);
    else if (c === "out") zoomAt(cx, cy, 1 / 1.3, true);
    else if (c === "fit") fitAll(true);
    else if (c === "reset") resetView(true);
    else if (c === "collapse") {
      const root = S.nodes.get(S.rootKey);
      (root.children || []).forEach(k => collapse(S.nodes.get(k)));
      S.selectedKey = null; S.relatedMode = false; closeDetail();
      render(); resetView(true);
    } else if (c === "legend") {
      el.legend.hidden = !el.legend.hidden;
      b.setAttribute("aria-expanded", String(!el.legend.hidden));
    }
  });
  el.root.querySelector("#smRelToggle").addEventListener("change", (e) => { if (!S) return; S.showRels = e.target.checked; render(); });
  el.detail.addEventListener("click", async (e) => {
    if (!S) return;
    const a = e.target.closest("[data-act]");
    const n = S.nodes.get(S.selectedKey);
    if (a && n) { onDetailAction(a.dataset.act, n); return; }
    const g = e.target.closest("[data-goto-id]");
    if (g) {
      if (g.dataset.goto) { select(g.dataset.goto); return; }
      const type = g.dataset.gotoType, id = g.dataset.gotoId;
      const col = COL_BY_TYPE[type];
      const ent = col ? await getOne(col, id) : null;
      if (!ent) return;
      const lvl = { story: "story", event: "story", series: "series", run: "run", issue: "issue", character: "character", continuity: "continuity" }[type];
      if (!lvl) return;
      const params = lvl === "story" ? { story: ent } : lvl === "run" ? { run: ent, series: await getOne(COLLECTIONS.SERIES, ent.seriesId) } : { [lvl]: ent };
      openExplorer([{ level: lvl, label: entityTitle(type === "event" ? "story" : type, ent), params }]);
    }
    const d = e.target.closest(".sm-d-desc[data-clamp]");
    if (d) d.dataset.clamp = d.dataset.clamp === "true" ? "false" : "true";
  });
  // Bottom-nav taps (phones) leave the map — the site's nav must always work (Phase 14 rule).
  const mnav = document.getElementById("mobileNav");
  if (mnav) mnav.addEventListener("click", () => { if (el.root.dataset.open === "true") doClose(); }, true);
  // Nerd Mode is live, like the rest of the site.
  const nerd = document.getElementById("nerdToggle");
  if (nerd) nerd.addEventListener("click", () => { if (S && S.selectedKey) setTimeout(renderDetail, 0); });
  let rz = null;
  window.addEventListener("resize", () => {
    if (!S || el.root.dataset.open !== "true") return;
    clearTimeout(rz);
    rz = setTimeout(() => { const before = S.mode; render(); if (S.mode !== before) resetView(false); }, 120);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && el.root && el.root.dataset.open === "true" && !document.querySelector('.sheet[data-open="true"]')) {
      if (el.detail.dataset.open === "true") { S.selectedKey = null; closeDetail(); render(); } else requestClose();
    }
  });
}

/* ============================= public API ============================= */
window.__comicsStoryMap = {
  open: openMap,
  close: requestClose,
  isOpen: () => !!(el.root && el.root.dataset.open === "true"),
  view: () => (S ? { ...S.view, mode: S.mode } : null),
  nodes: () => (S ? visibleTree().map(n => ({ key: n.key, type: displayType(n), id: n.id, title: entityTitle(n.type, n.e), expanded: n.expanded, status: n.status, children: n.children ? n.children.length : null })) : []),
  select: (key) => S && select(key),
};
document.dispatchEvent(new CustomEvent("comicsv2:storymap-ready"));
