// ============================================================================
// comics-v2 / explorer.js
// ----------------------------------------------------------------------------
// INTERACTIVE COMICS CONTINUITY EXPLORER (Pointer 3 / Phase 3).
//
// A character-first drill-down UI over the new, normalized Comics data model:
//   Comics -> Characters/Continuities/Series -> Character -> Continuity/Era
//   -> Series -> Creative Run -> Story -> Issues -> Issue detail
//
// Design rules this file follows throughout:
//   - EVERY screen is populated by a targeted Firestore read via comics-v2/data.js
//     (single doc, a capped list read, or a where()/array-contains query) —
//     never a bulk download of the whole Comics graph. Nothing here hardcodes
//     any real Comics data (no "Batman", "Court of Owls", "New 52", etc.) —
//     all of that is discovered from whatever the database actually returns.
//   - Like the rest of comics-v2, this module is independent of app.js: no
//     imports either direction. It reuses the SITE'S EXISTING sheet visual
//     language (the .sheet / .sheet-backdrop bottom-sheet, .sheet-section /
//     .sheet-label / .tag classes) purely via shared CSS classes on its own
//     DOM (#comicsExplorerSheet, added to index.html), plus a small set of
//     new cx-* classes (in style.css) for the drill-down list/breadcrumb UI
//     that don't already exist on the site.
//   - Every level has Loading / Empty / Error states, tolerates missing
//     fields without ever showing "undefined" or a broken image, and exposes
//     extra raw/verification detail only when Nerd Mode (the site's existing
//     #nerdToggle / localStorage "dc_nerd_mode") is on.
//   - Navigation is an explicit in-sheet stack (breadcrumb + back button),
//     not the browser history stack — the existing app.js popstate handler
//     already closes whatever sheet is open on a hardware/browser Back press,
//     which is exactly the "never trapped, always get back out" behavior
//     Pointer 3 requires, without this module needing to touch app.js's
//     shared tab/history logic at all.
// ============================================================================
// "?v=p5" — data.js gained new Pointer 5 helpers (reading paths / collection overlap);
// the query string busts GitHub Pages' ~10min cache the same way Pointer 4 did for storymap.js.
import * as data from "./data.js?v=p65";
import { COLLECTIONS } from "./schema.js";
// Pointer 6 — personal reading progress (derived from the site's one progress store via
// window.__readerProgress) + the contextual Story Graph. Same "?v=p6" specifier everywhere so
// every comics-v2 module shares one instance of each.
import * as RP from "./reading-progress.js?v=p6";
import { groupConnections, connectionSentence, isNonOrderingGroup } from "./story-graph.js?v=p6";
import {
  pathTypeLabel, sortPathsByType, pathEntryCount, locateInPath,
  groupCoverageBySeries, compressCoverageRows, coverageSummaryLines,
  hasPartialCoverage, coverageBarSegments,
  formatEditionMeta, verificationLabel,
} from "./reading-collections.js?v=p6";

/* ============================= small utils ============================= */
function esc(s) {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function isNerd() {
  try { return localStorage.getItem("dc_nerd_mode") === "true"; } catch (e) { return false; }
}
function dateRangeText(start, end) {
  if (!start && !end) return "";
  if (start && end) return `${start}–${end}`;
  if (start) return `${start}–present`;
  return String(end);
}
function firstYearOf(entityWithStartDate) {
  const m = String((entityWithStartDate && entityWithStartDate.startDate) || "").match(/\d{4}/);
  return m ? parseInt(m[0], 10) : 0;
}
function seriesDateRange(s) { return dateRangeText(s.startDate, s.endDate); }
function contDateRange(ct) {
  const range = dateRangeText(ct.startDate, ct.endDate);
  return [ct.shortName, range].filter(Boolean).join(" · ");
}
function runRangeText(r) {
  if (r.startIssue && r.endIssue) return `Issues #${r.startIssue}–#${r.endIssue}`;
  if (r.startIssue) return `From issue #${r.startIssue}`;
  return "";
}
function initialsOf(text) {
  const w = String(text || "?").trim().split(/\s+/).slice(0, 2).map(x => x[0]).join("").toUpperCase();
  return w || "?";
}
function humanizeRel(t) { return String(t || "").replace(/_/g, " "); }
function sortIssuesInPlace(issues) {
  issues.sort((a, b) => {
    const na = parseFloat(a.issueNumber), nb = parseFloat(b.issueNumber);
    const ka = isNaN(na) ? Infinity : na, kb = isNaN(nb) ? Infinity : nb;
    if (ka !== kb) return ka - kb;
    return String(a.issueLabel || "").localeCompare(String(b.issueLabel || ""));
  });
}

/* Small read-through cache — many screens resolve the same creator/character/
   continuity doc more than once per render pass; this keeps each unique id to
   one network read for the lifetime of the page (never a bulk collection scan). */
const _cache = new Map();
async function cachedGet(col, id) {
  if (!id) return null;
  const key = col + "::" + id;
  if (_cache.has(key)) return _cache.get(key);
  try {
    const e = await data.getEntity(col, id);
    _cache.set(key, e);
    return e;
  } catch (err) {
    console.warn("[Comics Explorer] read failed", col, id, err);
    return null;
  }
}
const ENTITY_META = {
  universe: { col: COLLECTIONS.UNIVERSES, name: e => e.name },
  continuity: { col: COLLECTIONS.CONTINUITIES, name: e => e.name },
  character: { col: COLLECTIONS.CHARACTERS, name: e => e.displayName || e.name },
  series: { col: COLLECTIONS.SERIES, name: e => e.title },
  run: { col: COLLECTIONS.RUNS, name: e => e.title || "Run" },
  story: { col: COLLECTIONS.STORIES, name: e => e.title },
  issue: { col: COLLECTIONS.ISSUES, name: e => e.issueLabel || e.title || "Issue" },
  collection: { col: COLLECTIONS.COLLECTIONS, name: e => e.title },
  creator: { col: COLLECTIONS.CREATORS, name: e => e.displayName || e.name },
};
async function labelForEntity(type, id) {
  const meta = ENTITY_META[type];
  if (!meta) return null;
  const e = await cachedGet(meta.col, id);
  return e ? meta.name(e) : null;
}
async function runLabel(r) {
  if (r.title) return r.title;
  const names = await Promise.all((r.creatorIds || []).map(id => cachedGet(COLLECTIONS.CREATORS, id)));
  const joined = names.filter(Boolean).map(c => c.displayName || c.name).join(" / ");
  return joined || "Untitled Run";
}

/* ============================= fragments ============================= */
function emptyHtml(msg) { return `<div class="cx-empty">${esc(msg)}</div>`; }
function errorHtml(e) {
  return `<div class="cx-error">Couldn't load this right now — please try again.${isNerd() && e ? `<div class="cx-nerd-block">${esc(e.message || String(e))}</div>` : ""}</div>`;
}
function coverBlockHtml(url, altLabel) {
  if (!url) return "";
  return `<div class="cx-hero-cover"><img class="cx-cover" src="${esc(url)}" alt="" data-fallback="${esc(altLabel || "")}"></div>`;
}
function wireCovers(container) {
  container.querySelectorAll("img.cx-cover").forEach(img => {
    img.addEventListener("error", () => {
      const wrap = img.parentElement;
      const label = img.dataset.fallback || "";
      wrap.innerHTML = `<div class="cx-cover-fallback">${esc(initialsOf(label))}</div>`;
    }, { once: true });
  });
}
function nerdBlock(obj) {
  const lines = Object.entries(obj)
    .filter(([k, v]) => k !== "verification" && v != null && !(Array.isArray(v) && v.length === 0) && v !== "")
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  const v = obj.verification;
  if (v) {
    lines.push(`verification: ${v.verificationStatus || "unverified"}${v.sourceName ? ` (source: ${v.sourceName})` : ""}`);
    if (v.notes) lines.push(`notes: ${v.notes}`);
  }
  if (!lines.length) return "";
  return `<div class="cx-nerd-block">${lines.map(esc).join("<br>")}</div>`;
}
/**
 * Part 11 (Story Map) / Part 9 (Explorer): "Collected in: [collection name +
 * coverage]" from a Story or Issue's own detail — collections are reached
 * from here, never shown as their own primary browse level and never turned
 * into Story Map graph nodes. Each row shows the STRUCTURED coverage (never
 * prose) for the series currently being viewed, plus verification status, and
 * opens the Collection detail level on tap.
 */
async function collectedInHtml(list) {
  if (!list || !list.length) return "";
  const seriesIds = [...new Set(list.flatMap(c => (c.issueCoverage || []).map(r => r.seriesId).filter(Boolean)))];
  const seriesEnts = await Promise.all(seriesIds.map(id => cachedGet(COLLECTIONS.SERIES, id)));
  const titleFor = (id) => { const s = seriesEnts.find(x => x && x.id === id); return s ? s.title : null; };
  const rows = list.map((c, idx) => {
    const lines = coverageSummaryLines(c.issueCoverage, titleFor);
    const partial = hasPartialCoverage(c.issueCoverage) ? `<span class="tag" style="margin-left:6px;">partial</span>` : "";
    return `<div class="cx-row" data-coll-idx="${idx}">
      <div class="cx-row-body">
        <div class="cx-row-title">${esc(c.title)}${partial}</div>
        <div class="cx-row-sub">${esc(formatEditionMeta(c))}</div>
        ${lines.length ? `<div class="cx-row-sub cx-coverage-line">${lines.map(esc).join(" · ")}</div>` : ""}
      </div>
      <div class="cx-row-chevron">›</div>
    </div>`;
  }).join("");
  return {
    html: `<div class="sheet-section"><div class="sheet-label">COLLECTED IN</div><div class="cx-list">${rows}</div></div>`,
    wire(container) {
      container.querySelectorAll("[data-coll-idx]").forEach(row => {
        row.addEventListener("click", () => {
          const c = list[+row.dataset.collIdx];
          pushLevel("collection", c.title, { collectionEntity: c });
        });
      });
    },
  };
}

/* ============================= Pointer 6: progress fragments =============================
   Small, text-first marks (✓ / 3/7) and the site's existing journey-btn toggles — never bars.
   Every control is re-drawn IN PLACE from the progress store on "readerprogress:change"
   (see currentLevelUpdate below), so tapping one never re-fetches anything from Firestore. */
function readToggleHtml(issueId, state, label) {
  const read = state === "read";
  const aria = read ? `Mark ${label} as unread` : `Mark ${label} as read`;
  return `<button class="cx-read-toggle" data-issue-toggle="${esc(issueId)}" data-label="${esc(label)}" data-state="${state}" aria-pressed="${read}" aria-label="${esc(aria)}" title="${esc(aria)}"><span aria-hidden="true">${read ? "✓" : ""}</span></button>`;
}
function patchIssueToggles(container, snap) {
  container.querySelectorAll("[data-issue-toggle]").forEach(b => {
    const st = RP.issueState(b.dataset.issueToggle, snap);
    const read = st === "read", label = b.dataset.label || "issue";
    b.dataset.state = st;
    b.setAttribute("aria-pressed", String(read));
    const aria = read ? `Mark ${label} as unread` : `Mark ${label} as read`;
    b.setAttribute("aria-label", aria); b.title = aria;
    b.innerHTML = `<span aria-hidden="true">${read ? "✓" : ""}</span>`;
  });
}
function markHtml(p, attrs) {
  const t = RP.markText(p);
  return `<span class="cx-mark" data-state="${p ? p.state : "unread"}"${attrs || ""}>${esc(t)}</span>`;
}
function patchStoryMarks(container, stories, snap) {
  const byId = new Map((stories || []).filter(Boolean).map(st => [st.id, st]));
  container.querySelectorAll("[data-mark-story]").forEach(el => {
    const st = byId.get(el.dataset.markStory);
    if (!st) return;
    const p = RP.storyProgress(st, snap);
    el.dataset.state = p.state;
    el.textContent = RP.markText(p);
  });
}
function updateBlocks(container, blocks) {
  container.querySelectorAll("[data-prog-block]").forEach(el => {
    const f = blocks[el.dataset.progBlock];
    if (f) el.innerHTML = f();
  });
}
function progressApi() { return RP.bridge(); }
function toggleIssueRead(issueId, ctx) {
  const b = progressApi(); if (!b) return;
  b.setRead("issue", issueId, !b.isRead("issue", issueId), ctx);
}

/* ============================= Pointer 6: Story Graph (contextual) =============================
   One story at a time: its recorded comicRelationships, grouped Before / After / Part of event /
   In this event / Crossover / Tie-ins / Related (only groups the data actually has). Selecting a
   connected story opens a concise "connected" level — never a giant web, never a reading order. */
async function storyGraphHtml(story, rels) {
  const groups = groupConnections(story.id, rels);
  const typeCol = { story: COLLECTIONS.STORIES, event: COLLECTIONS.STORIES, series: COLLECTIONS.SERIES, issue: COLLECTIONS.ISSUES, character: COLLECTIONS.CHARACTERS, run: COLLECTIONS.RUNS, collection: COLLECTIONS.COLLECTIONS };
  const items = [];
  for (const g of groups) {
    for (const it of g.items) {
      const col = typeCol[it.otherType];
      it.entity = col ? await cachedGet(col, it.otherId) : null;
      it.group = g;
      if (it.entity) items.push(it);
    }
  }
  const label = `<div class="sheet-label">CONNECTED STORIES</div>`;
  if (!items.length) {
    return { html: `<div class="sheet-section cx-graph">${label}<div class="cx-graph-empty">No connected stories are recorded for ${esc(story.title)} yet.</div></div>`, items };
  }
  const snap = RP.snapshot();
  let html = `<div class="sheet-section cx-graph">${label}`;
  groups.forEach(g => {
    const rows = items.filter(it => it.group.id === g.id);
    if (!rows.length) return;
    html += `<div class="cx-graph-group" data-group="${g.id}"><div class="cx-graph-label">${esc(g.label)}</div><div class="cx-list">`;
    html += rows.map(it => {
      const idx = items.indexOf(it);
      const e = it.entity;
      const isStory = it.otherType === "story" || it.otherType === "event";
      const title = isStory ? e.title : (ENTITY_META[it.otherType] ? ENTITY_META[it.otherType].name(e) : e.title || e.name);
      const n = isStory ? (e.issueIds || []).length : 0;
      const multi = isStory && (e.seriesIds || []).length > 1 ? `across ${(e.seriesIds || []).length} series` : "";
      const sub = [it.phrase, n ? `${n} issue${n === 1 ? "" : "s"}` : "", multi].filter(Boolean).join(" · ");
      const prog = isStory ? RP.storyProgress(e, snap) : null;
      return `<div class="cx-row cx-graph-row" data-graph-idx="${idx}" data-kind="${isNonOrderingGroup(g.id) ? "link" : "order"}">
          <div class="cx-row-body"><div class="cx-row-title">${esc(title)}</div><div class="cx-row-sub">${esc(sub)}</div></div>
          ${prog ? markHtml(prog, ` data-mark-story="${esc(e.id)}"`) : ""}<div class="cx-row-chevron">›</div>
        </div>`;
    }).join("");
    html += `</div></div>`;
  });
  html += `<div class="cx-hint">Recorded connections, not a reading order — a reading path decides what to read next.</div></div>`;
  return { html, items };
}
function wireStoryGraph(container, story, items) {
  container.querySelectorAll("[data-graph-idx]").forEach(row => {
    row.addEventListener("click", () => {
      const it = items[+row.dataset.graphIdx];
      if (!it) return;
      const e = it.entity;
      if (it.otherType === "story" || it.otherType === "event") pushLevel("connected", e.title, { story: e, from: story, rel: it.rel, group: it.group });
      else if (it.otherType === "series") pushLevel("series", e.title, { series: e });
      else if (it.otherType === "issue") pushLevel("issue", e.issueLabel || "Issue", { issue: e });
      else if (it.otherType === "character") pushLevel("character", e.displayName || e.name, { character: e });
      else if (it.otherType === "collection") pushLevel("collection", e.title, { collectionEntity: e });
    });
  });
}

/* ============================= Reading Paths (Part 2/3/4) =============================
   Progressive disclosure: a compact row of path-type chips (only for path types the
   data actually has) — tapping one opens the full ordered path as its own level, never
   a wall of buttons and never a fabricated/derived order (entries come straight off the
   comicReadingPaths record). */
function readingPathsChipsHtml(paths, anchorEntityId) {
  if (!paths || !paths.length) return "";
  const sorted = sortPathsByType(paths);
  const chips = sorted.map((p, idx) => {
    const onPath = anchorEntityId ? locateInPath(p, anchorEntityId).index !== -1 : false;
    return `<button class="cx-chip" data-path-idx="${idx}" data-on-path="${onPath}">${esc(pathTypeLabel(p.pathType))}<span class="cx-chip-n">${pathEntryCount(p)}</span></button>`;
  }).join("");
  return `<div class="sheet-section"><div class="sheet-label">READING PATHS</div><div class="cx-chip-row">${chips}</div></div>`;
}
function wireReadingPathChips(container, paths, anchorEntityId, contextLabel) {
  if (!paths || !paths.length) return;
  container.querySelectorAll("[data-path-idx]").forEach(btn => {
    btn.addEventListener("click", () => {
      const p = sortPathsByType(paths)[+btn.dataset.pathIdx];
      pushLevel("readingPath", p.title, { path: p, anchorEntityId, contextLabel });
    });
  });
}

/* ============================= level renderers =============================
   Each returns { html, wire(container) } — wire() attaches click handlers with
   closures over the exact objects already fetched for this screen, so opening
   a level never needs to re-fetch or re-look-up-by-id. */

async function levelRoot() {
  const html = `
    <div class="cx-kicker">BATMAN · THE NEW 52</div>
    <h2 class="cx-title">Batman — The New 52</h2>
    <p class="cx-subtitle">One canonical catalogue: core Batman, Bat-Family, Gotham spin-offs, team-ups, every publication unit and researched collected editions.</p>
    <div class="cx-entry-grid">
      <button class="cx-entry-btn" data-nav="characterList"><span class="cx-entry-btn-label">Batman</span><span class="cx-entry-btn-sub">Open the Batman line</span></button>
      <button class="cx-entry-btn" data-nav="seriesList"><span class="cx-entry-btn-label">Series Catalogue</span><span class="cx-entry-btn-sub">Every New 52 Batman-line series</span></button>
    </div>
    <div class="sheet-section">
      <div class="sheet-label">DATA MODEL</div>
      <div class="sheet-body">Series define the publication lines. Issues are the canonical publication units. Collected editions point back to those same issue records. There are no competing Essential / Complete / Expanded reading-path datasets.</div>
    </div>`;
  return { html, wire(container) {
    const labels={characterList:"Batman",seriesList:"Series Catalogue"};
    container.querySelectorAll("[data-nav]").forEach(btn=>btn.addEventListener("click",()=>pushLevel(btn.dataset.nav,labels[btn.dataset.nav],{})));
  }};
}

/**
 * Pointer 6.5 — the CURATED Character browser. Not every comicCharacters
 * record: only characters data.curateCharacters() judges to have a genuine
 * standalone reading journey (see data.js for the exact rule). Supporting
 * characters stay fully reachable through Stories/Issues/Story Graph/Search —
 * they just don't clutter this primary entry point.
 */
async function levelCharacterList() {
  const chars = await data.getAllCharacters(50);
  const batman = chars.find(c => String(c.displayName || c.name || "").toLowerCase() === "batman");
  if (!batman) return { html: emptyHtml("Batman has not been seeded yet.") };
  const html = `<div class="cx-kicker">CHARACTER</div><h2 class="cx-title">Batman</h2><p class="cx-subtitle">The Batman line is the entry point. Bat-Family books are grouped inside it instead of being mixed into the top-level character list.</p><div class="cx-list"><div class="cx-row" data-id="${esc(batman.id)}"><div class="cx-row-body"><div class="cx-row-title">Batman</div><div class="cx-row-sub">Core line · Bat-Family · Gotham spin-offs · team-ups</div></div><div class="cx-row-chevron">›</div></div></div>`;
  return { html, wire(container){ container.querySelector("[data-id]")?.addEventListener("click",()=>pushLevel("character","Batman",{character:batman})); } };
}

/**
 * Pointer 6.5 — a single "Reading Paths" destination: every comicReadingPaths
 * record, grouped/ordered by path type (sortPathsByType, same helper used
 * everywhere else paths are listed). Selecting one opens the existing
 * levelReadingPath detail — no separate reading-path UI.
 */
async function levelReadingPathList() {
  const paths = sortPathsByType(await data.getAllReadingPaths(30));
  if (!paths.length) return { html: emptyHtml("No reading paths have been added yet.") };
  const rows = paths.map((p, idx) => `<div class="cx-row" data-idx="${idx}"><div class="cx-row-body"><div class="cx-row-title">${esc(p.title)}</div><div class="cx-row-sub">${esc(pathTypeLabel(p.pathType))} · ${pathEntryCount(p)} step${pathEntryCount(p) === 1 ? "" : "s"}</div></div><div class="cx-row-chevron">›</div></div>`).join("");
  const html = `<div class="cx-kicker">READING PATHS</div><h2 class="cx-title">Follow a curated journey</h2><div class="cx-list">${rows}</div>`;
  return {
    html,
    wire(container) {
      container.querySelectorAll(".cx-row[data-idx]").forEach(row => {
        row.addEventListener("click", () => { const p = paths[+row.dataset.idx]; pushLevel("readingPath", p.title, { path: p }); });
      });
    },
  };
}

async function levelCharacter(params) {
  const c=params.character;
  const all=await data.getAllSeries(200);
  const grouped=new Map();
  ["Core Batman","Bat-Family","Gotham & Spin-offs","Team-Ups"].forEach(k=>grouped.set(k,[]));
  all.filter(s=>s.scope==="batman-new52").sort((a,b)=>firstYearOf(a)-firstYearOf(b)||String(a.title).localeCompare(String(b.title))).forEach(s=>{
    const k=grouped.has(s.lineCategory)?s.lineCategory:"Gotham & Spin-offs"; grouped.get(k).push(s);
  });
  let html=`<div class="cx-kicker">BATMAN · NEW 52</div><h2 class="cx-title">Batman</h2><div class="cx-subtitle">2011–2016 · one canonical Batman-line catalogue</div>`;
  const categoryDescriptions={
    "Core Batman":"Batman-led ongoing, limited and weekly core books.",
    "Bat-Family":"Books led by Batman's allies and legacy characters. They stay grouped here rather than appearing beside Batman as unrelated top-level characters.",
    "Gotham & Spin-offs":"Gotham/Arkham and adjacent Batman-world publications.",
    "Team-Ups":"Batman co-starring publications kept separate from the core line."
  };
  const indexes=[];
  for(const [label,list] of grouped){
    if(!list.length) continue;
    const base=indexes.length;
    html+=`<div class="sheet-section"><div class="sheet-label">${esc(label.toUpperCase())}</div><div class="cx-section-note">${esc(categoryDescriptions[label])}</div><div class="cx-list">`;
    list.forEach((s,i)=>{indexes.push(s);html+=`<div class="cx-row" data-series-index="${base+i}"><div class="cx-row-body"><div class="cx-row-title">${esc(s.title)}</div><div class="cx-row-sub">${esc(seriesDateRange(s))} · ${esc(String(s.issueCount||0))} numbered issues${s.annualCount?` · ${s.annualCount} Annual${s.annualCount>1?'s':''}`:""}${s.specialCount||s.zeroIssueCount?` · ${Number(s.zeroIssueCount||0)+Number(s.specialCount||0)} specials`:""}</div></div><div class="cx-row-chevron">›</div></div>`});
    html+=`</div></div>`;
  }
  return {html,wire(container){container.querySelectorAll("[data-series-index]").forEach(row=>row.addEventListener("click",()=>{const s=indexes[+row.dataset.seriesIndex];pushLevel("series",s.title,{series:s});}));}};
}

async function levelContinuityList() {
  const conts = await data.getAllContinuities();
  conts.sort((a, b) => String(a.startDate || "").localeCompare(String(b.startDate || "")));
  if (!conts.length) return { html: emptyHtml("No continuities have been added yet.") };
  const rows = conts.map(ct => `<div class="cx-row" data-id="${esc(ct.id)}"><div class="cx-row-body"><div class="cx-row-title">${esc(ct.name)}</div><div class="cx-row-sub">${esc(contDateRange(ct))}</div></div><div class="cx-row-chevron">›</div></div>`).join("");
  const html = `<div class="cx-kicker">CONTINUITIES</div><h2 class="cx-title">Choose an era</h2><div class="cx-list">${rows}</div>`;
  return {
    html,
    wire(container) {
      container.querySelectorAll(".cx-row[data-id]").forEach(row => {
        row.addEventListener("click", () => {
          const ct = conts.find(x => x.id === row.dataset.id);
          pushLevel("continuity", ct.name, { continuity: ct });
        });
      });
    },
  };
}

function seriesListSectionHtml(series, label) {
  const rows = series.map(s => `<div class="cx-row" data-series="${esc(s.id)}"><div class="cx-row-body"><div class="cx-row-title">${esc(s.title)}</div><div class="cx-row-sub">${esc(seriesDateRange(s))}${s.issueCount ? ` · ${s.issueCount} issues` : ""}</div></div><div class="cx-row-chevron">›</div></div>`).join("");
  return `<div class="sheet-section"><div class="sheet-label">${esc(label)}</div><div class="cx-list">${rows}</div></div>`;
}
async function levelContinuity(params) {
  const ct = params.continuity;
  // Character-scoped (reached via Character → Era, or Era → Character below): the character's OWN
  // ecosystem within this era — meaningful parallel series, never every series in the era.
  if (params.character) {
    const c = params.character;
    const all = await data.getSeriesForCharacter(c.id);
    const series = all.filter(s => Array.isArray(s.continuityIds) && s.continuityIds.includes(ct.id)).sort((a, b) => firstYearOf(a) - firstYearOf(b));
    let html = `<div class="cx-kicker">${esc((c.displayName || c.name || "").toUpperCase())} · CONTINUITY</div><h2 class="cx-title">${esc(ct.name)}</h2>`;
    const sub = contDateRange(ct);
    if (sub) html += `<div class="cx-subtitle">${esc(sub)}</div>`;
    if (!series.length) { html += emptyHtml(`No ${c.displayName || c.name} comics recorded for this era yet.`); return { html }; }
    html += seriesListSectionHtml(series, `${(c.displayName || c.name || "").toUpperCase()}'S ${ct.name.toUpperCase()} SERIES`);
    return {
      html,
      wire(container) {
        container.querySelectorAll("[data-series]").forEach(row => {
          row.addEventListener("click", () => { const s = series.find(x => x.id === row.dataset.series); pushLevel("series", s.title, { series: s }); });
        });
      },
    };
  }
  // Entered directly from the era (Pointer 6.5): don't dump the whole era's series list up front —
  // offer a curated "explore by character" list scoped to this era, with the full series list one
  // tap away (de-emphasized), never the primary view.
  const [series, chars] = await Promise.all([data.getSeriesForContinuity(ct.id), data.getAllCharacters()]);
  series.sort((a, b) => firstYearOf(a) - firstYearOf(b));
  const eraChars = chars.filter(c => Array.isArray(c.continuityIds) && c.continuityIds.includes(ct.id));
  const curated = data.curateCharacters(eraChars, series).sort((a, b) => (a.displayName || a.name || "").localeCompare(b.displayName || b.name || ""));

  let html = `<div class="cx-kicker">CONTINUITY</div><h2 class="cx-title">${esc(ct.name)}</h2>`;
  const sub = contDateRange(ct);
  if (sub) html += `<div class="cx-subtitle">${esc(sub)}</div>`;
  if (ct.description) html += `<div class="sheet-section"><div class="sheet-body">${esc(ct.description)}</div></div>`;
  if (!series.length) { html += emptyHtml("No series recorded for this continuity yet."); return { html }; }
  if (curated.length) {
    html += `<div class="sheet-section"><div class="sheet-label">EXPLORE BY CHARACTER</div><div class="cx-list">`;
    html += curated.map(c => `<div class="cx-row" data-char="${esc(c.id)}"><div class="cx-row-body"><div class="cx-row-title">${esc(c.displayName || c.name)}</div></div><div class="cx-row-chevron">›</div></div>`).join("");
    html += `</div></div>`;
  }
  html += `<div class="sheet-section"><button class="cx-text-link" id="cxAllSeriesToggle" aria-expanded="false">All ${series.length} series in ${esc(ct.name)} →</button><div class="cx-list" id="cxAllSeriesList" hidden></div></div>`;
  return {
    html,
    wire(container) {
      container.querySelectorAll("[data-char]").forEach(row => {
        row.addEventListener("click", () => {
          const c = curated.find(x => x.id === row.dataset.char);
          pushLevel("continuity", ct.name, { continuity: ct, character: c });
        });
      });
      const toggle = container.querySelector("#cxAllSeriesToggle");
      const list = container.querySelector("#cxAllSeriesList");
      if (toggle && list) {
        toggle.addEventListener("click", () => {
          const open = !list.hidden;
          if (!open && !list.dataset.filled) {
            list.innerHTML = series.map(s => `<div class="cx-row" data-series="${esc(s.id)}"><div class="cx-row-body"><div class="cx-row-title">${esc(s.title)}</div><div class="cx-row-sub">${esc(seriesDateRange(s))}${s.issueCount ? ` · ${s.issueCount} issues` : ""}</div></div><div class="cx-row-chevron">›</div></div>`).join("");
            list.dataset.filled = "true";
            list.querySelectorAll("[data-series]").forEach(row => {
              row.addEventListener("click", () => { const s = series.find(x => x.id === row.dataset.series); pushLevel("series", s.title, { series: s }); });
            });
          }
          list.hidden = open;
          toggle.setAttribute("aria-expanded", String(!open));
          toggle.textContent = open ? `All ${series.length} series in ${ct.name} →` : "Hide full series list";
        });
      }
    },
  };
}

async function levelSeriesList() {
  const all=(await data.getAllSeries(200)).filter(s=>s.scope==="batman-new52").sort((a,b)=>firstYearOf(a)-firstYearOf(b)||String(a.title).localeCompare(String(b.title)));
  if(!all.length)return{html:emptyHtml("Batman / New 52 data has not been seeded yet.")};
  const groups=["Core Batman","Bat-Family","Gotham & Spin-offs","Team-Ups"];
  let html=`<div class="cx-kicker">BATMAN · NEW 52</div><h2 class="cx-title">Series Catalogue</h2>`;
  const index=[];
  for(const g of groups){const list=all.filter(s=>(s.lineCategory||"")==g);if(!list.length)continue;html+=`<div class="sheet-section"><div class="sheet-label">${esc(g.toUpperCase())}</div><div class="cx-list">`;for(const s of list){const i=index.push(s)-1;html+=`<div class="cx-row" data-index="${i}"><div class="cx-row-body"><div class="cx-row-title">${esc(s.title)}</div><div class="cx-row-sub">${esc(seriesDateRange(s))} · ${s.issueCount||0} numbered issues</div></div><div class="cx-row-chevron">›</div></div>`}html+=`</div></div>`;}
  return{html,wire(container){container.querySelectorAll("[data-index]").forEach(r=>r.addEventListener("click",()=>{const s=index[+r.dataset.index];pushLevel("series",s.title,{series:s});}))}};
}

async function levelSeries(params) {
  const s=params.series;
  const [runs,creators,issues,collections]=await Promise.all([
    data.getRunsForSeries(s.id),
    Promise.all((s.creatorIds||[]).map(id=>cachedGet(COLLECTIONS.CREATORS,id))),
    data.getIssuesForSeries(s.id),
    data.getCollectionsForSeries(s.id).catch(()=>[]),
  ]);
  sortIssuesInPlace(issues);
  const runLabels=await Promise.all(runs.map(r=>runLabel(r)));
  const extra=(Number(s.zeroIssueCount)||0)+(Number(s.annualCount)||0)+(Number(s.decimalIssueCount)||0)+(Number(s.specialCount)||0);
  let html=coverBlockHtml(s.coverImage,s.title);
  html+=`<div class="cx-kicker">SERIES</div><h2 class="cx-title">${esc(s.title)}</h2>`;
  html+=`<div class="cx-subtitle">${esc(seriesDateRange(s))} · ${esc(String(s.issueCount||0))} numbered issues${extra?` · ${extra} additional publications`:""}</div>`;
  if(s.lineCategory)html+=`<div class="cx-tag-row"><span class="tag">${esc(s.lineCategory)}</span></div>`;
  const creatorsText=creators.filter(Boolean).map(c=>c.displayName||c.name); if(creatorsText.length)html+=`<div class="cx-tag-row">${creatorsText.map(n=>`<span class="tag">${esc(n)}</span>`).join("")}</div>`;
  if(s.description)html+=`<div class="sheet-section"><div class="sheet-label">ABOUT</div><div class="sheet-body">${esc(s.description)}</div></div>`;
  if(runs.length){html+=`<div class="sheet-section"><div class="sheet-label">CREATIVE RUNS</div><div class="cx-list">`;runs.forEach((r,i)=>html+=`<div class="cx-row" data-run-index="${i}"><div class="cx-row-body"><div class="cx-row-title">${esc(runLabels[i])}</div>${runRangeText(r)?`<div class="cx-row-sub">${esc(runRangeText(r))}</div>`:""}</div><div class="cx-row-chevron">›</div></div>`);html+=`</div></div>`;}
  const renderIssueRows=(list)=>list.map((iss,i)=>`<div class="cx-row" data-issue-index="${issues.indexOf(iss)}"><div class="cx-row-body"><div class="cx-row-title">${esc(iss.issueLabel||"Issue")}${iss.title?` — ${esc(iss.title)}`:""}</div><div class="cx-row-sub">${esc(iss.issueLabelType||"numbered")}${iss.publicationDate?` · ${esc(iss.publicationDate)}`:""}</div></div><div class="cx-row-chevron">›</div></div>`).join("");
  const first=issues.slice(0,12);
  html+=`<div class="sheet-section"><div class="sheet-label">ISSUE LIST · ${issues.length} PUBLICATIONS</div><div class="cx-list" id="cxSeriesIssues">${renderIssueRows(first)}</div>${issues.length>12?`<button class="cx-text-link" id="cxShowAllIssues">Show all ${issues.length} publications →</button>`:""}</div>`;
  if(collections.length){
    html+=`<div class="sheet-section"><div class="sheet-label">COLLECTED EDITIONS · ${collections.length}</div><div class="cx-chip-row" id="cxEditionFilters"><button class="cx-chip" data-format="all">All ${collections.length}</button><button class="cx-chip" data-format="TPB">TPB</button><button class="cx-chip" data-format="Hardcover">Hardcover</button><button class="cx-chip" data-format="Omnibus">Omnibus</button></div><div class="cx-list" id="cxCollectionsList"></div></div>`;
  }
  return{html,wire(container){
    const openIssue=i=>{const iss=issues[i];if(iss)pushLevel("issue",iss.issueLabel||"Issue",{issue:iss,series:s});};
    container.querySelectorAll("[data-issue-index]").forEach(r=>r.addEventListener("click",()=>openIssue(+r.dataset.issueIndex)));
    container.querySelectorAll("[data-run-index]").forEach(r=>r.addEventListener("click",()=>{const x=runs[+r.dataset.runIndex];pushLevel("run",runLabels[+r.dataset.runIndex],{run:x,series:s});}));
    const more=container.querySelector("#cxShowAllIssues"), issueList=container.querySelector("#cxSeriesIssues");
    if(more&&issueList)more.addEventListener("click",()=>{issueList.innerHTML=renderIssueRows(issues);more.remove();issueList.querySelectorAll("[data-issue-index]").forEach(r=>r.addEventListener("click",()=>openIssue(+r.dataset.issueIndex)));});
    const collList=container.querySelector("#cxCollectionsList");
    const drawCollections=(format="all")=>{if(!collList)return;const list=format==="all"?collections:collections.filter(c=>c.format===format);collList.innerHTML=list.map((c,i)=>`<div class="cx-row" data-coll-index="${collections.indexOf(c)}"><div class="cx-row-body"><div class="cx-row-title">${esc(c.title)}</div><div class="cx-row-sub">${esc(c.format||"Edition")} · ${c.issueCoverage?.length||0} issue units</div></div><div class="cx-row-chevron">›</div></div>`).join("");collList.querySelectorAll("[data-coll-index]").forEach(r=>r.addEventListener("click",()=>{const c=collections[+r.dataset.collIndex];pushLevel("collection",c.title,{collectionEntity:c});}));};
    drawCollections(); container.querySelectorAll("#cxEditionFilters [data-format]").forEach(b=>b.addEventListener("click",()=>drawCollections(b.dataset.format)));
  }};
}

function issueNum(iss) { const n = parseFloat(iss && iss.issueNumber); return isNaN(n) ? null : n; }

/**
 * Pointer 6.5 — RUN DETAIL PAGE, the centerpiece of this pass.
 * Header (title, creative team, year range as plain metadata, issue count) +
 * Continue Reading, then ISSUES | TPB | HARDCOVER | OMNIBUS — four views of
 * the exact same canonical run data (same issues/collections, just filtered
 * by format for the collection tabs), plus an Expanded/Optional Reading
 * section wherever comicRelationships actually distinguishes core from
 * tie-in/event material for this run (never forced when the data doesn't).
 */
async function levelRun(params) {
  const r=params.run,s=params.series;
  const [issues,collections]=await Promise.all([data.getIssuesForSeries(s.id),data.getCollectionsForSeries(s.id).catch(()=>[])]);
  sortIssuesInPlace(issues);
  const lo=r.startIssue!=null?parseFloat(r.startIssue):null, hi=r.endIssue!=null?parseFloat(r.endIssue):null;
  const runIssues=(lo==null||hi==null)?issues:issues.filter(i=>{const n=issueNum(i);return n!=null&&n>=lo&&n<=hi;});
  const label=await runLabel(r);
  let html=`<div class="cx-kicker">CREATIVE RUN</div><h2 class="cx-title">${esc(label)}</h2><div class="cx-subtitle">${esc(runRangeText(r))} · ${runIssues.length} issue${runIssues.length===1?"":"s"}</div>`;
  if((r.creatorIds||[]).length){const cs=await Promise.all(r.creatorIds.map(id=>cachedGet(COLLECTIONS.CREATORS,id)));html+=`<div class="cx-tag-row">${cs.filter(Boolean).map(c=>`<span class="tag">${esc(c.displayName||c.name)}</span>`).join("")}</div>`;}
  html+=`<div class="sheet-section"><div class="sheet-label">ISSUES</div><div class="cx-list">${runIssues.map((i,idx)=>`<div class="cx-row" data-i="${idx}"><div class="cx-row-body"><div class="cx-row-title">${esc(i.issueLabel)}</div><div class="cx-row-sub">${esc(i.issueLabelType||"numbered")}</div></div><div class="cx-row-chevron">›</div></div>`).join("")}</div></div>`;
  if(collections.length)html+=`<div class="sheet-section"><div class="sheet-label">COLLECTED EDITIONS</div><div class="cx-list">${collections.map((c,i)=>`<div class="cx-row" data-c="${i}"><div class="cx-row-body"><div class="cx-row-title">${esc(c.title)}</div><div class="cx-row-sub">${esc(c.format||"Edition")}</div></div><div class="cx-row-chevron">›</div></div>`).join("")}</div></div>`;
  return{html,wire(container){container.querySelectorAll("[data-i]").forEach(x=>x.addEventListener("click",()=>{const i=runIssues[+x.dataset.i];pushLevel("issue",i.issueLabel,{issue:i,series:s});}));container.querySelectorAll("[data-c]").forEach(x=>x.addEventListener("click",()=>{const c=collections[+x.dataset.c];pushLevel("collection",c.title,{collectionEntity:c});}));}};
}

async function levelStory(params) {
  const st = params.story;
  const seriesIdsToResolve = (st.seriesIds && st.seriesIds.length) ? st.seriesIds : (params.series ? [params.series.id] : []);
  const [issues, collections, seriesEntities, continuityEnt, characters, creators, readingPaths, relationships] = await Promise.all([
    data.getIssuesForStory(st.id),
    data.getCollectionsForStory(st.id, st.issueIds),
    Promise.all(seriesIdsToResolve.map(id => cachedGet(COLLECTIONS.SERIES, id))),
    st.continuityId ? cachedGet(COLLECTIONS.CONTINUITIES, st.continuityId) : null,
    Promise.all((st.characterIds || []).map(id => cachedGet(COLLECTIONS.CHARACTERS, id))),
    Promise.all((st.creatorIds || []).map(id => cachedGet(COLLECTIONS.CREATORS, id))),
    data.getReadingPathsFor({ continuityId: st.continuityId }),
    data.getRelationshipsForEntity(st.id).catch(() => []),
  ]);
  sortIssuesInPlace(issues);
  // Keep the story's OWN issue order (its canonical issueIds) wherever it's recorded.
  if ((st.issueIds || []).length) {
    const order = new Map(st.issueIds.map((id, i) => [id, i]));
    issues.sort((a, b) => (order.has(a.id) ? order.get(a.id) : 1e6) - (order.has(b.id) ? order.get(b.id) : 1e6));
  }

  const seriesTitles = seriesEntities.filter(Boolean).map(x => x.title);
  const seriesTitleById = new Map(seriesEntities.filter(Boolean).map(x => [x.id, x.title]));
  const multiSeries = new Set(issues.map(i => i.seriesId)).size > 1;
  const issueRowLabel = (iss) => {
    const lbl = iss.issueLabel || iss.title || "Issue";
    const t = seriesTitleById.get(iss.seriesId);
    return multiSeries && t && /^#/.test(lbl) ? `${t} ${lbl}` : lbl;
  };
  const fullLabel = (iss) => { const t = seriesTitleById.get(iss.seriesId); const lbl = iss.issueLabel || "Issue"; return t && /^#/.test(lbl) ? `${t} ${lbl}` : lbl; };
  const pctx = { storyId: st.id, pathId: params.pathId || null };
  const summaryBlock = () => {
    const p = RP.storyProgress(st, RP.snapshot());
    let out = `<span class="cx-progress-text" data-state="${p.state}">${esc(RP.storySummaryText(p))}</span>`;
    if (p.derived && p.state === "in_progress" && p.nextIssueId) {
      const nx = issues.find(i => i.id === p.nextIssueId);
      if (nx) out += `<button class="cx-continue-row" data-prog-act="open-issue" data-issue-id="${esc(nx.id)}"><span class="cx-continue-k">Continue</span><span class="cx-continue-t">${esc(fullLabel(nx))}</span><span class="cx-row-chevron">›</span></button>`;
    }
    if (!p.derived) {
      out += `<div class="sheet-journey-row cx-progress-row"><button class="journey-btn done-toggle" data-prog-act="story-explicit" data-active="${p.state === "complete"}">${p.state === "complete" ? "✓ Read" : "Mark story as Read"}</button></div>`;
    }
    return out;
  };
  const bulkBlock = () => {
    if (!issues.length) return "";
    const p = RP.storyProgress(st, RP.snapshot());
    return p.state === "complete"
      ? `<button class="cx-text-btn" data-prog-act="story-all" data-read="false">Mark all ${issues.length} as unread</button>`
      : `<button class="cx-text-btn" data-prog-act="story-all" data-read="true">Mark all ${issues.length} as read</button>`;
  };
  const graph = await storyGraphHtml(st, relationships);

  const runLabelText = params.run ? await runLabel(params.run) : "";
  let html = `<div class="cx-kicker">${[runLabelText, seriesTitles.join(", ")].filter(Boolean).map(esc).join(" · ")}</div><h2 class="cx-title">${esc(st.title)}</h2>`;
  html += `<div class="cx-progress-block" data-prog-block="story-summary">${summaryBlock()}</div>`;
  if (continuityEnt) html += `<div class="cx-tag-row"><span class="tag">${esc(continuityEnt.name)}</span></div>`;
  if (st.description) html += `<div class="sheet-section"><div class="sheet-label">ABOUT</div><div class="sheet-body">${esc(st.description)}</div></div>`;
  const charNames = characters.filter(Boolean).map(c => c.displayName || c.name);
  if (charNames.length) html += `<div class="sheet-section"><div class="sheet-label">CHARACTERS</div><div class="cx-tag-row">${charNames.map(n => `<span class="tag">${esc(n)}</span>`).join("")}</div></div>`;
  const credNames = creators.filter(Boolean).map(c => c.displayName || c.name);
  if (credNames.length) html += `<div class="sheet-section"><div class="sheet-label">CREATORS</div><div class="cx-tag-row">${credNames.map(n => `<span class="tag">${esc(n)}</span>`).join("")}</div></div>`;
  if (!issues.length) {
    html += emptyHtml("No issues recorded for this story yet.");
  } else {
    const snap = RP.snapshot();
    html += `<div class="sheet-section" data-section="issues"><div class="sheet-label">ISSUES</div><div class="cx-list">`;
    html += issues.map((iss, idx) => `<div class="cx-row cx-issue-row" data-idx="${idx}"><div class="cx-row-body"><div class="cx-row-title">${esc(issueRowLabel(iss))}</div>${iss.title && iss.issueLabel ? `<div class="cx-row-sub">${esc(iss.title)}</div>` : ""}</div>${readToggleHtml(iss.id, RP.issueState(iss.id, snap), fullLabel(iss))}</div>`).join("");
    html += `</div><div data-prog-block="story-bulk">${bulkBlock()}</div></div>`;
  }
  html += graph.html;
  html += readingPathsChipsHtml(readingPaths, st.id);
  const collectedIn = await collectedInHtml(collections);
  html += collectedIn.html || "";
  if (isNerd()) html += nerdBlock({ id: st.id, seriesIds: st.seriesIds, runId: st.runId, continuityId: st.continuityId, universeId: st.universeId, eventId: st.eventId, verification: st.sourceInfo });
  return {
    html,
    update(container) {
      const snap = RP.snapshot();
      updateBlocks(container, { "story-summary": summaryBlock, "story-bulk": bulkBlock });
      patchIssueToggles(container, snap);
      patchStoryMarks(container, graph.items.map(it => it.entity), snap);
    },
    onAct(el) {
      const b = progressApi(); if (!b) return;
      if (el.dataset.issueToggle) { toggleIssueRead(el.dataset.issueToggle, pctx); return; }
      const act = el.dataset.progAct;
      if (act === "story-all") b.setRead("issue", issues.map(i => i.id), el.dataset.read === "true", pctx);
      else if (act === "story-explicit") b.setRead("story", st.id, !b.isRead("story", st.id), pctx);
      else if (act === "open-issue") {
        const iss = issues.find(i => i.id === el.dataset.issueId);
        if (iss) pushLevel("issue", fullLabel(iss), { issue: iss, story: st, pathId: params.pathId || null });
      }
    },
    wire(container) {
      container.querySelectorAll(".cx-row[data-idx]").forEach(row => {
        row.addEventListener("click", () => {
          const iss = issues[+row.dataset.idx];
          pushLevel("issue", fullLabel(iss), { issue: iss, story: st, pathId: params.pathId || null });
        });
      });
      wireStoryGraph(container, st, graph.items);
      if (collectedIn.wire) collectedIn.wire(container);
      wireReadingPathChips(container, readingPaths, st.id, st.title);
      if (params.focus === "issues") {
        const sec = container.querySelector('[data-section="issues"]');
        if (sec) requestAnimationFrame(() => sec.scrollIntoView({ block: "start" }));
      }
    },
  };
}

async function levelIssue(params) {
  const iss = params.issue;
  const [series, stories, continuityEnt, characters, creators, collections, relationships] = await Promise.all([
    iss.seriesId ? cachedGet(COLLECTIONS.SERIES, iss.seriesId) : null,
    Promise.all((iss.storyIds || []).map(id => cachedGet(COLLECTIONS.STORIES, id))),
    iss.continuityId ? cachedGet(COLLECTIONS.CONTINUITIES, iss.continuityId) : null,
    Promise.all((iss.characterIds || []).map(id => cachedGet(COLLECTIONS.CHARACTERS, id))),
    Promise.all((iss.creatorIds || []).map(id => cachedGet(COLLECTIONS.CREATORS, id))),
    data.getCollectionsContainingIssue(iss.id),
    data.getRelationshipsForEntity(iss.id),
  ]);
  const storyList = stories.filter(Boolean);
  // Pointer 6: the story this issue is being read as part of — the one we came from, else its arc story.
  const ctxStory = (params.story && (params.story.issueIds || []).includes(iss.id)) ? params.story
    : (storyList.find(x => x.runId) || storyList[0] || null);
  const pctx = { storyId: ctxStory ? ctxStory.id : null, pathId: params.pathId || null };
  let nextInStory = null;
  if (ctxStory) {
    const ids = ctxStory.issueIds || [];
    const at = ids.indexOf(iss.id);
    if (at !== -1 && ids[at + 1]) nextInStory = await cachedGet(COLLECTIONS.ISSUES, ids[at + 1]);
  }
  const nextSeries = nextInStory && nextInStory.seriesId !== iss.seriesId ? await cachedGet(COLLECTIONS.SERIES, nextInStory.seriesId) : series;
  const nextLabel = nextInStory ? RP.issueLabelWith(nextInStory, nextSeries) : "";
  const progressBlock = () => {
    const snap = RP.snapshot();
    const state = RP.issueState(iss.id, snap);
    const read = state === "read", reading = state === "reading";
    let out = `<div class="sheet-journey-row cx-progress-row">
        <button class="journey-btn done-toggle" data-prog-act="issue-read" data-active="${read}">${read ? "✓ Read" : "Mark as Read"}</button>
        ${read ? "" : `<button class="journey-btn cx-reading-toggle" data-prog-act="issue-reading" data-active="${reading}">${reading ? "Reading now" : "Start reading"}</button>`}
      </div>`;
    if (ctxStory) {
      const sp = RP.storyProgress(ctxStory, snap);
      out += `<div class="cx-progress-line"><span class="cx-progress-text" data-state="${sp.state}">${esc(ctxStory.title)} · ${esc(RP.storySummaryText(sp))}</span></div>`;
    }
    return out;
  };

  let html = coverBlockHtml(iss.coverImage, series ? series.title : iss.issueLabel);
  html += `<div class="cx-kicker">${series ? esc(series.title) : ""}</div><h2 class="cx-title">${esc(iss.issueLabel || (iss.issueNumber ? "#" + iss.issueNumber : "Issue"))}${iss.title ? ` — ${esc(iss.title)}` : ""}</h2>`;
  const dateStr = iss.publicationDate || iss.coverDate;
  if (dateStr) html += `<div class="cx-subtitle">${esc(dateStr)}</div>`;
  html += `<div class="cx-progress-block" data-prog-block="issue">${progressBlock()}</div>`;
  if (nextInStory) {
    html += `<div class="sheet-section"><div class="sheet-label">NEXT IN ${esc((ctxStory.title || "").toUpperCase())}</div><div class="cx-list"><div class="cx-row" data-act="next-issue"><div class="cx-row-body"><div class="cx-row-title">${esc(nextLabel)}</div></div>${readToggleHtml(nextInStory.id, RP.issueState(nextInStory.id, RP.snapshot()), nextLabel)}</div></div></div>`;
  }
  if (continuityEnt) html += `<div class="cx-tag-row"><span class="tag">${esc(continuityEnt.name)}</span></div>`;
  if (storyList.length) {
    html += `<div class="sheet-section"><div class="sheet-label">STORY</div><div class="cx-list">`;
    html += storyList.map((stt, idx) => `<div class="cx-row" data-story-idx="${idx}"><div class="cx-row-body"><div class="cx-row-title">${esc(stt.title)}</div></div><div class="cx-row-chevron">›</div></div>`).join("");
    html += `</div></div>`;
  }
  const charNames = characters.filter(Boolean).map(c => c.displayName || c.name);
  if (charNames.length) html += `<div class="sheet-section"><div class="sheet-label">CHARACTERS</div><div class="cx-tag-row">${charNames.map(n => `<span class="tag">${esc(n)}</span>`).join("")}</div></div>`;
  const credNames = creators.filter(Boolean).map(c => c.displayName || c.name);
  if (credNames.length) html += `<div class="sheet-section"><div class="sheet-label">CREATORS</div><div class="cx-tag-row">${credNames.map(n => `<span class="tag">${esc(n)}</span>`).join("")}</div></div>`;

  const relLines = (await Promise.all(relationships.slice(0, 8).map(async rel => {
    const otherId = rel.sourceId === iss.id ? rel.targetId : rel.sourceId;
    const otherType = rel.sourceId === iss.id ? rel.targetType : rel.sourceType;
    const label = await labelForEntity(otherType, otherId);
    if (!label) return null;
    return `${humanizeRel(rel.relationshipType)} ${label}`;
  }))).filter(Boolean);
  if (relLines.length) html += `<div class="sheet-section"><div class="sheet-label">RELATED</div><div class="sheet-body">${relLines.map(l => `<div>${esc(l)}</div>`).join("")}</div></div>`;

  const collectedIn = await collectedInHtml(collections);
  html += collectedIn.html || "";
  if (isNerd()) html += nerdBlock({ id: iss.id, seriesId: iss.seriesId, storyIds: iss.storyIds, continuityId: iss.continuityId, universeId: iss.universeId, eventIds: iss.eventIds, verification: iss.sourceInfo });
  return {
    html,
    update(container) {
      updateBlocks(container, { issue: progressBlock });
      patchIssueToggles(container, RP.snapshot());
    },
    onAct(el) {
      const b = progressApi(); if (!b) return;
      if (el.dataset.issueToggle) { toggleIssueRead(el.dataset.issueToggle, pctx); return; }
      const act = el.dataset.progAct;
      if (act === "issue-read") b.setRead("issue", iss.id, !b.isRead("issue", iss.id), pctx);
      else if (act === "issue-reading") b.setReading(iss.id, RP.issueState(iss.id, RP.snapshot()) !== "reading", pctx);
    },
    wire(container) {
      container.querySelectorAll("[data-story-idx]").forEach(row => {
        row.addEventListener("click", () => {
          const stt = storyList[+row.dataset.storyIdx];
          pushLevel("story", stt.title, { story: stt, pathId: params.pathId || null });
        });
      });
      const nx = container.querySelector('[data-act="next-issue"]');
      if (nx && nextInStory) nx.addEventListener("click", () => pushLevel("issue", nextLabel, { issue: nextInStory, story: ctxStory, pathId: params.pathId || null }));
      if (collectedIn.wire) collectedIn.wire(container);
    },
  };
}

/* ============================= Reading Path detail (Part 4) + Pointer 6 progress ============================= */
async function levelReadingPath(params) {
  const p = params.path;
  const { index: curIdx, next } = locateInPath(p, params.anchorEntityId);
  const entries = p.entries || [];
  // Pointer 6: one batched load for the whole path (stories/issues/series by id, `in` queries) instead of
  // one read per entry — the same context also drives the path's derived progress.
  const ctx = await RP.loadPathContext(p);
  const fromCtx = (e) => e.entityType === "story" ? ctx.stories.get(e.entityId) : e.entityType === "issue" ? ctx.issues.get(e.entityId) : e.entityType === "series" ? ctx.series.get(e.entityId) : undefined;
  const resolved = await Promise.all(entries.map(async (e) => {
    const meta = ENTITY_META[e.entityType];
    let ent = fromCtx(e);
    if (ent === undefined) ent = meta ? await cachedGet(meta.col, e.entityId) : null;
    let label = ent && meta ? meta.name(ent) : (e.entityId || "Unknown");
    if (ent && e.entityType === "issue") label = await RP.issueLabel(ent);
    return { entry: e, entity: ent || null, label };
  }));
  const pathCtx = { pathId: p.id };
  const following = () => { const st = RP.readingState(); return !!(st.activePath && st.activePath.id === p.id); };
  const summaryBlock = () => {
    const pp = RP.pathProgress(p, ctx, RP.snapshot());
    const bits = [];
    if (pp.total) bits.push(pp.state === "complete" ? `✓ Path complete · ${pp.total} ${pp.unit}` : `${pp.complete} / ${pp.total} ${pp.unit} complete`);
    if (pp.currentIdx !== -1 && resolved[pp.currentIdx]) bits.push(`Current: ${resolved[pp.currentIdx].label}`);
    const nx = pp.currentIdx !== -1 ? pp.per.findIndex((q, i) => i > pp.currentIdx && q.state !== "complete" && q.state !== "unknown") : pp.nextIdx;
    if (nx !== -1 && nx != null && resolved[nx] && pp.state !== "complete") bits.push(`Next: ${resolved[nx].label}`);
    let out = `<div class="cx-progress-line"><span class="cx-progress-text" data-state="${pp.state}">${bits.map(esc).join(" · ")}</span></div>`;
    const f = following();
    out += `<div class="sheet-journey-row cx-progress-row"><button class="journey-btn done-toggle" data-prog-act="path-follow" data-active="${f}">${f ? "✓ Following this path" : "Follow this path"}</button></div>`;
    const t = pp.targetIdx;
    if (t != null && t !== -1 && pp.state !== "complete") {
      const ep = pp.per[t];
      const iss = ep.nextIssueId ? ctx.issues.get(ep.nextIssueId) || null : null;
      const label = iss ? (issueLabelCache.get(iss.id) || resolved[t].label) : resolved[t].label;
      out += `<button class="cx-continue-row" data-prog-act="path-continue"><span class="cx-continue-k">${pp.state === "unread" ? "Start" : "Continue"}</span><span class="cx-continue-t">${esc(resolved[t].label)}${iss ? ` · ${esc(label)}` : ""}</span><span class="cx-row-chevron">›</span></button>`;
    }
    return out;
  };
  // Resolve (and remember) the label of each entry's "next issue" once, so re-draws stay synchronous.
  const issueLabelCache = new Map();
  async function primeNextIssue() {
    const pp = RP.pathProgress(p, ctx, RP.snapshot());
    const t = pp.targetIdx;
    if (t == null || t === -1) return;
    const id = pp.per[t].nextIssueId;
    if (!id || issueLabelCache.has(id)) return;
    let iss = ctx.issues.get(id);
    if (!iss) { iss = await cachedGet(COLLECTIONS.ISSUES, id); if (iss) ctx.issues.set(id, iss); }
    if (iss) issueLabelCache.set(id, await RP.issueLabel(iss));
  }
  await primeNextIssue();
  const entryMark = (idx) => {
    const pp = RP.pathProgress(p, ctx, RP.snapshot());
    const ep = pp.per[idx];
    const upNext = idx === pp.targetIdx && pp.state !== "complete";
    let out = markHtml(ep);
    if (ep.canMark) out += `<button class="cx-read-toggle" data-entry-toggle="${idx}" data-state="${ep.state === "complete" ? "read" : "unread"}" aria-pressed="${ep.state === "complete"}" aria-label="${esc(ep.state === "complete" ? "Mark as unread" : "Mark as read")}" title="${esc(ep.state === "complete" ? "Mark as unread" : "Mark as read — the issue list for this entry isn't complete, so it can't be worked out from issues")}"><span aria-hidden="true">${ep.state === "complete" ? "✓" : ""}</span></button>`;
    return { html: out, upNext };
  };

  let html = `<div class="cx-kicker">READING PATH${params.contextLabel ? " · " + esc(params.contextLabel) : ""}</div><h2 class="cx-title">${esc(p.title)}</h2>`;
  html += `<div class="cx-tag-row"><span class="tag">${esc(pathTypeLabel(p.pathType))}</span><span class="tag">${entries.length} step${entries.length === 1 ? "" : "s"}</span></div>`;
  html += `<div class="cx-progress-block" data-prog-block="path-summary">${summaryBlock()}</div>`;
  if (p.description) html += `<div class="sheet-section"><div class="sheet-label">WHY THIS PATH</div><div class="sheet-body">${esc(p.description)}</div></div>`;
  if (curIdx !== -1) {
    html += `<div class="sheet-section"><div class="sheet-label">YOUR POSITION</div><div class="sheet-body">Step ${curIdx + 1} of ${entries.length}${next ? ` — next up: ${esc(resolved[curIdx + 1] ? resolved[curIdx + 1].label : "")}` : " — this is the final step on this path."}</div></div>`;
  }
  html += `<div class="sheet-section"><div class="sheet-label">ORDER</div><div class="cx-list">`;
  html += resolved.map((r, idx) => {
    const isCurrent = idx === curIdx;
    const m = entryMark(idx);
    return `<div class="cx-row" data-entry-idx="${idx}" data-current="${isCurrent}" data-up-next="${m.upNext}">
      <div class="cx-path-order">${r.entry.order != null ? r.entry.order : idx + 1}</div>
      <div class="cx-row-body">
        <div class="cx-row-title">${esc(r.label)}${isCurrent ? ` <span class="tag">you are here</span>` : ""}</div>
        ${r.entry.note ? `<div class="cx-row-sub">${esc(r.entry.note)}</div>` : ""}
      </div>
      <span class="cx-entry-prog" data-entry-prog="${idx}">${m.html}</span>
      <div class="cx-row-chevron">›</div>
    </div>`;
  }).join("");
  html += `</div></div>`;
  if (p.branches && p.branches.length) {
    html += `<div class="sheet-section"><div class="sheet-label">ALTERNATE / BRANCH</div>`;
    html += p.branches.map(b => `<div class="sheet-body"><strong>${esc(b.label)}</strong>${(b.entries || []).map(e => `<div class="cx-row-sub">${esc(e.note || e.entityId)}</div>`).join("")}</div>`).join("");
    html += `</div>`;
  }
  if (isNerd()) html += nerdBlock({ id: p.id, pathType: p.pathType, characterId: p.characterId, continuityId: p.continuityId, verification: p.sourceInfo });
  const openEntry = (r) => {
    if (!r || !r.entity) return;
    const type = r.entry.entityType;
    if (type === "story") pushLevel("story", r.label, { story: r.entity, pathId: p.id });
    else if (type === "series") pushLevel("series", r.label, { series: r.entity });
    else if (type === "issue") pushLevel("issue", r.label, { issue: r.entity, pathId: p.id });
    else if (type === "run") pushLevel("run", r.label, { run: r.entity, series: params.series });
    else if (type === "collection") pushLevel("collection", r.label, { collectionEntity: r.entity });
  };
  return {
    html,
    async update(container) {
      await primeNextIssue();
      updateBlocks(container, { "path-summary": summaryBlock });
      const pp = RP.pathProgress(p, ctx, RP.snapshot());
      container.querySelectorAll("[data-entry-prog]").forEach(el => {
        const idx = +el.dataset.entryProg;
        const m = entryMark(idx);
        el.innerHTML = m.html;
        const row = el.closest("[data-entry-idx]");
        if (row) row.dataset.upNext = String(idx === pp.targetIdx && pp.state !== "complete");
      });
    },
    onAct(el) {
      const b = progressApi(); if (!b) return;
      if (el.dataset.entryToggle != null) {
        const r = resolved[+el.dataset.entryToggle];
        if (!r) return;
        const kind = r.entry.entityType === "series" ? "series" : "story";
        b.setRead(kind, r.entry.entityId, !b.isRead(kind, r.entry.entityId), { ...pathCtx, storyId: kind === "story" ? r.entry.entityId : null });
        return;
      }
      const act = el.dataset.progAct;
      if (act === "path-follow") b.followPath(following() ? null : p.id);
      else if (act === "path-continue") {
        const pp = RP.pathProgress(p, ctx, RP.snapshot());
        const t = pp.targetIdx;
        const r = resolved[t];
        if (!r || !r.entity) return;
        const iss = pp.per[t].nextIssueId ? ctx.issues.get(pp.per[t].nextIssueId) : null;
        if (r.entry.entityType === "story" && iss) {
          cxStack.push({ level: "story", label: r.label, params: { story: r.entity, pathId: p.id } });
          pushLevel("issue", issueLabelCache.get(iss.id) || iss.issueLabel || "Issue", { issue: iss, story: r.entity, pathId: p.id });
        } else if (iss && r.entry.entityType !== "issue") {
          pushLevel("issue", issueLabelCache.get(iss.id) || iss.issueLabel || "Issue", { issue: iss, pathId: p.id });
        } else openEntry(r);
      }
    },
    wire(container) {
      container.querySelectorAll("[data-entry-idx]").forEach(row => {
        row.addEventListener("click", () => openEntry(resolved[+row.dataset.entryIdx]));
      });
    },
  };
}

/* ============================= Collection / Edition detail (Parts 5-10) ============================= */
async function levelCollection(params) {
  const c = params.collectionEntity;
  const seriesIds = [...new Set((c.issueCoverage || []).map(r => r.seriesId).filter(Boolean).concat(c.seriesIds || []))];
  const [seriesEnts, overlapping] = await Promise.all([
    Promise.all(seriesIds.map(id => cachedGet(COLLECTIONS.SERIES, id))),
    data.getCollectionsSharingIssues((c.issueCoverage || []).map(r => r.issueId), c.id),
  ]);
  const seriesById = new Map(seriesEnts.filter(Boolean).map(s => [s.id, s]));
  const titleFor = (id) => (seriesById.get(id) || {}).title || null;
  const bySeries = groupCoverageBySeries(c.issueCoverage || []);

  let html = `<div class="cx-kicker">COLLECTED EDITION</div><h2 class="cx-title">${esc(c.title)}</h2>`;
  html += `<div class="cx-tag-row"><span class="tag">${esc(c.format || "Collection")}</span>${hasPartialCoverage(c.issueCoverage) ? `<span class="tag">partial coverage</span>` : ""}<span class="tag">${esc(verificationLabel(c.sourceInfo))}</span></div>`;
  const factsRows = [
    ["Publisher", c.publisher], ["Publication date", c.publicationDate], ["Pages", c.pageCount ? String(c.pageCount) : ""],
    ["ISBN", c.isbn], ["Edition", c.editionInfo && (c.editionInfo.editionName || c.editionInfo.editionNumber) ? [c.editionInfo.editionName, c.editionInfo.editionNumber].filter(Boolean).join(" ") : ""],
  ].filter(([, v]) => v);
  if (factsRows.length) {
    html += `<div class="sheet-section"><div class="cx-fact-list">${factsRows.map(([k, v]) => `<div class="cx-fact"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")}</div></div>`;
  }
  // Pointer 6: progress straight from the edition's structured coverage — the issue stays the only unit.
  const collProgressBlock = () => {
    const cp = RP.collectionProgress(c, RP.snapshot());
    if (!cp.total || !cp.read) return "";
    return `<span class="cx-progress-text" data-state="${cp.state}">${cp.state === "complete" ? `✓ You've read every issue in this edition (${cp.total})` : `You've read ${cp.read} / ${cp.total} issues in this edition`}</span>`;
  };
  html += `<div class="cx-progress-line" data-prog-block="collection-progress">${collProgressBlock()}</div>`;
  html += `<div class="sheet-section"><div class="sheet-label">EXACT ISSUE COVERAGE</div>`;
  for (const [seriesId, rows] of bySeries.entries()) {
    const nums = rows.map(r => parseFloat(String(r.issueLabel || "").replace(/[^\d.]/g, ""))).filter(n => !isNaN(n));
    const domain = nums.length ? { min: Math.min(...nums), max: Math.max(...nums) } : { min: 0, max: 1 };
    const segs = coverageBarSegments(rows, domain.min, domain.max);
    html += `<div class="cx-coverage-row">
      <div class="cx-coverage-row-title">${esc(titleFor(seriesId) || seriesId)}</div>
      <div class="cx-coverage-bar"><div class="cx-coverage-track">${segs.map(s => `<div class="cx-coverage-seg" style="left:${s.leftPct}%;width:${s.widthPct}%;"></div>`).join("")}</div></div>
      <div class="cx-coverage-row-range">${esc(compressCoverageRows(rows))}</div>
    </div>`;
  }
  html += `</div>`;
  html += `<div class="sheet-section"><div class="sheet-label">ALL ISSUES IN THIS EDITION</div><div class="cx-list" id="cxIssueExpandList" data-collapsed="true">`;
  const allRows = (c.issueCoverage || []);
  const snapC = RP.snapshot();
  html += allRows.map(r => `<div class="cx-row" style="cursor:default;"><div class="cx-row-body"><div class="cx-row-title">${esc(titleFor(r.seriesId) || "")} ${esc(displayLabelSafe(r))}</div></div>${r.coveragePart === "partial" ? `<span class="tag">partial</span>` : ""}${r.issueId ? `<span class="cx-mark" data-mark-issue="${esc(r.issueId)}" data-state="${snapC.sets.issue.has(r.issueId) ? "complete" : "unread"}">${snapC.sets.issue.has(r.issueId) ? "✓" : ""}</span>` : ""}</div>`).join("");
  html += `</div><button class="cx-entry-btn" id="cxToggleIssues" style="margin-top:8px;">Show individual issues</button></div>`;

  if (overlapping.length) {
    html += `<div class="sheet-section"><div class="sheet-label">OTHER EDITIONS COVERING SOME OF THE SAME ISSUES</div><div class="cx-compare-list">`;
    html += [c, ...overlapping].map(ed => `<div class="cx-compare-card">
        <div class="cx-compare-format">${esc(ed.format || "Collection")}${ed.id === c.id ? ` <span class="tag">this edition</span>` : ""}</div>
        <div class="cx-row-title">${esc(ed.title)}</div>
        <div class="cx-row-sub">${esc(formatEditionMeta(ed))}${ed.isbn ? ` · ISBN ${esc(ed.isbn)}` : ""}</div>
        <div class="cx-row-sub">${esc(coverageSummaryLines(ed.issueCoverage, titleFor).join(" · "))}</div>
      </div>`).join("");
    html += `</div><div class="cx-hint">Shown factually, side by side — no ranking or "best pick" between editions.</div></div>`;
  }
  html += `<div class="sheet-section"><div class="cx-entry-grid">
    ${seriesEnts.filter(Boolean).length === 1 ? `<button class="cx-entry-btn" data-act="view-series"><span class="cx-entry-btn-label">View Series</span></button>` : ""}
  </div></div>`;
  if (isNerd()) html += nerdBlock({ id: c.id, seriesIds: c.seriesIds, storyIds: c.storyIds, verification: c.sourceInfo });
  return {
    html,
    update(container) {
      updateBlocks(container, { "collection-progress": collProgressBlock });
      const snap = RP.snapshot();
      container.querySelectorAll("[data-mark-issue]").forEach(el => {
        const read = snap.sets.issue.has(el.dataset.markIssue);
        el.dataset.state = read ? "complete" : "unread"; el.textContent = read ? "✓" : "";
      });
    },
    wire(container) {
      const toggle = container.querySelector("#cxToggleIssues");
      const list = container.querySelector("#cxIssueExpandList");
      if (toggle && list) {
        list.style.display = "none";
        toggle.addEventListener("click", () => {
          const open = list.style.display !== "none";
          list.style.display = open ? "none" : "";
          toggle.textContent = open ? "Show individual issues" : "Hide individual issues";
        });
      }
      const viewSeriesBtn = container.querySelector('[data-act="view-series"]');
      if (viewSeriesBtn) {
        viewSeriesBtn.addEventListener("click", () => {
          const s = seriesEnts.filter(Boolean)[0];
          if (s) pushLevel("series", s.title, { series: s });
        });
      }
    },
  };
}
/* ============================= Pointer 6: connected story (concise detail, Part 14) ============================= */
async function levelConnected(params) {
  const o = params.story, from = params.from, rel = params.rel;
  const [seriesEnts, cont, paths] = await Promise.all([
    Promise.all((o.seriesIds || []).map(id => cachedGet(COLLECTIONS.SERIES, id))),
    o.continuityId ? cachedGet(COLLECTIONS.CONTINUITIES, o.continuityId) : null,
    data.getReadingPathsFor({ continuityId: o.continuityId || null }).catch(() => []),
  ]);
  const onPaths = sortPathsByType(paths).filter(p => locateInPath(p, o.id).index !== -1);
  const titleOf = (id) => id === o.id ? o.title : (from && id === from.id ? from.title : "");
  const sentence = rel ? connectionSentence(rel, titleOf(rel.sourceId), titleOf(rel.targetId)) : "";
  const progLine = () => {
    const p = RP.storyProgress(o, RP.snapshot());
    return p.state === "unread" && p.derived ? "" : `<div class="cx-fact"><span>Your progress</span><span data-prog-block="connected-progress">${esc(RP.storySummaryText(p))}</span></div>`;
  };
  let html = `<div class="cx-kicker">CONNECTED STORY${params.group ? " · " + esc(String(params.group.label).toUpperCase()) : ""}</div><h2 class="cx-title">${esc(o.title)}</h2>`;
  if (sentence) html += `<div class="sheet-section"><div class="sheet-label">CONNECTION</div><div class="sheet-body cx-connection">${esc(sentence)}</div></div>`;
  const n = (o.issueIds || []).length;
  const facts = [
    ["Series", seriesEnts.filter(Boolean).map(x => x.title).join(", ")],
    ["Continuity", cont ? cont.name : ""],
    ["Issues", n ? `${n} issue${n === 1 ? "" : "s"}` : ""],
  ].filter(([, v]) => v);
  html += `<div class="sheet-section"><div class="cx-fact-list">${facts.map(([k, v]) => `<div class="cx-fact"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")}${progLine()}</div></div>`;
  if (params.group && isNonOrderingGroup(params.group.id)) html += `<div class="cx-hint">A connection, not a reading order — use a reading path to decide what to read next.</div>`;
  html += `<div class="sheet-section"><div class="sm-d-actions">
      <button class="sm-d-action sm-d-primary" data-cn-act="open">Open Story</button>
      ${n ? `<button class="sm-d-action" data-cn-act="issues">View Issues</button>` : ""}
      ${onPaths.length ? `<button class="sm-d-action" data-cn-act="paths" aria-expanded="false">View Reading Paths</button>` : ""}
    </div>
    ${onPaths.length ? `<div class="cx-list cx-connected-paths" hidden>${onPaths.map((p, i) => `<div class="cx-row" data-cn-path="${i}"><div class="cx-row-body"><div class="cx-row-title">${esc(p.title)}</div><div class="cx-row-sub">${esc(pathTypeLabel(p.pathType))} · step ${locateInPath(p, o.id).index + 1} of ${(p.entries || []).length}</div></div><div class="cx-row-chevron">›</div></div>`).join("")}</div>` : ""}
  </div>`;
  return {
    html,
    update(container) {
      const sec = container.querySelector(".cx-fact-list");
      if (!sec) return;
      const old = sec.querySelector("[data-prog-block='connected-progress']");
      if (old) old.closest(".cx-fact").remove();
      sec.insertAdjacentHTML("beforeend", progLine());
    },
    wire(container) {
      container.querySelectorAll("[data-cn-act]").forEach(b => b.addEventListener("click", () => {
        const a = b.dataset.cnAct;
        if (a === "open") pushLevel("story", o.title, { story: o });
        else if (a === "issues") pushLevel("story", o.title, { story: o, focus: "issues" });
        else if (a === "paths") {
          const list = container.querySelector(".cx-connected-paths");
          if (onPaths.length === 1) { pushLevel("readingPath", onPaths[0].title, { path: onPaths[0], anchorEntityId: o.id, contextLabel: o.title }); return; }
          if (list) { list.hidden = !list.hidden; b.setAttribute("aria-expanded", String(!list.hidden)); }
        }
      }));
      container.querySelectorAll("[data-cn-path]").forEach(row => row.addEventListener("click", () => {
        const p = onPaths[+row.dataset.cnPath];
        pushLevel("readingPath", p.title, { path: p, anchorEntityId: o.id, contextLabel: o.title });
      }));
    },
  };
}

function displayLabelSafe(row) {
  const lbl = row.issueLabel;
  if (lbl == null) return "?";
  const s = String(lbl);
  return s.startsWith("#") || /^[A-Za-z]/.test(s) ? s : `#${s}`;
}

const LEVELS = {
  root: levelRoot,
  characterList: levelCharacterList,
  character: levelCharacter,
  continuityList: levelContinuityList,
  continuity: levelContinuity,
  seriesList: levelSeriesList,
  series: levelSeries,
  run: levelRun,
  story: levelStory,
  issue: levelIssue,
  collection: levelCollection,
  connected: levelConnected,
};

/* ============================= shell (breadcrumb + back) ============================= */
let cxStack = [];
let cxLoadToken = 0;
let cxCurrent = null; // { result, token } of the level on screen — for Pointer 6 in-place progress updates

function shellHtml(bodyHtml) {
  const crumbs = cxStack.map((item, idx) => {
    const isLast = idx === cxStack.length - 1;
    const sep = idx > 0 ? `<span class="cx-crumb-sep">/</span>` : "";
    return `${sep}<span class="cx-crumb" data-idx="${idx}" data-current="${isLast}">${esc(item.label || "")}</span>`;
  }).join("");
  const backLabel = cxStack.length > 1 ? "←" : "✕";
  return `<div class="cx-topbar"><button class="cx-back-btn" id="cxBackBtn" aria-label="Back">${backLabel}</button><div class="cx-breadcrumb" id="cxBreadcrumb">${crumbs}</div></div>${bodyHtml}`;
}
function wireShellHandlers(container) {
  const backBtn = container.querySelector("#cxBackBtn");
  if (backBtn) backBtn.addEventListener("click", goBack);
  container.querySelectorAll('.cx-crumb[data-current="false"]').forEach(el => {
    el.addEventListener("click", () => goToCrumb(+el.dataset.idx));
  });
}

async function renderCurrentLevel() {
  const myToken = ++cxLoadToken;
  const top = cxStack[cxStack.length - 1];
  const contentEl = document.getElementById("comicsExplorerContent");
  if (!contentEl) return;
  const setShell = (bodyHtml) => { contentEl.innerHTML = shellHtml(bodyHtml); wireShellHandlers(contentEl); };
  setShell(`<div class="cx-loading">Loading…</div>`);
  let result;
  try {
    result = await LEVELS[top.level](top.params || {});
  } catch (e) {
    if (myToken !== cxLoadToken) return;
    setShell(errorHtml(e));
    return;
  }
  if (myToken !== cxLoadToken) return;
  setShell(result.html);
  wireCovers(contentEl);
  cxCurrent = { result, token: myToken };
  if (result.wire) result.wire(contentEl);
}
/* Pointer 6: progress controls. One capturing listener on the sheet content hands any progress control
   to the level on screen (so a ✓ inside a tappable row never also opens that row), and every progress
   change — from here, the Story Map, another tab of the site or a login merge — redraws the marks in
   place from the progress store, without re-fetching the level. */
const _cxContentEl = document.getElementById("comicsExplorerContent");
if (_cxContentEl) {
  _cxContentEl.addEventListener("click", (e) => {
    const a = e.target.closest("[data-prog-act], [data-issue-toggle], [data-entry-toggle]");
    if (!a || !_cxContentEl.contains(a)) return;
    e.stopPropagation();
    e.preventDefault();
    const cur = cxCurrent && cxCurrent.token === cxLoadToken ? cxCurrent.result : null;
    if (cur && cur.onAct) cur.onAct(a, e);
  }, true);
}
document.addEventListener("readerprogress:change", () => {
  const sh = document.getElementById("comicsExplorerSheet");
  const cur = cxCurrent && cxCurrent.token === cxLoadToken ? cxCurrent.result : null;
  if (!sh || sh.dataset.open !== "true" || !cur || !cur.update || !_cxContentEl) return;
  try { Promise.resolve(cur.update(_cxContentEl)).catch(err => console.warn("[Comics Explorer] progress refresh failed", err)); }
  catch (err) { console.warn("[Comics Explorer] progress refresh failed", err); }
});

function pushLevel(level, label, levelParams) {
  cxStack.push({ level, label, params: levelParams || {} });
  renderCurrentLevel();
}
function goToCrumb(idx) {
  cxStack = cxStack.slice(0, idx + 1);
  renderCurrentLevel();
}
function goBack() {
  if (cxStack.length <= 1) { closeCxSheet(); return; }
  cxStack.pop();
  renderCurrentLevel();
}

/* ============================= open / close (reuses the site's existing
   bottom-sheet visual pattern on its own new #comicsExplorerSheet element) ============================= */
function openCxSheet() {
  const bd = document.getElementById("comicsExplorerBackdrop"), sh = document.getElementById("comicsExplorerSheet");
  if (!bd || !sh) return;
  bd.dataset.open = "true";
  sh.dataset.open = "true";
  if (!(history.state && history.state.cxSheet)) {
    try { history.pushState({ cxSheet: true }, "", location.href); } catch (e) { /* ignore */ }
  }
}
function closeCxSheet() {
  const bd = document.getElementById("comicsExplorerBackdrop"), sh = document.getElementById("comicsExplorerSheet");
  if (bd) bd.dataset.open = "false";
  if (sh) sh.dataset.open = "false";
}
export function openComicsExplorer() {
  cxStack = [{ level: "root", label: "Comics", params: {} }];
  openCxSheet();
  renderCurrentLevel();
}
/* Pointer 4: the Story Map hands off to these same screens ("Open Story", "View Series", …) instead of
   duplicating them. `trail` is [{ level, label, params }] using the exact level names/params above, built
   from entities the map already fetched — so the breadcrumb mirrors the map path and Back walks up it. */
export function openComicsExplorerAt(trail) {
  const valid = (trail || []).filter(t => t && LEVELS[t.level]);
  cxStack = [{ level: "root", label: "Comics", params: {} }, ...valid.map(t => ({ level: t.level, label: t.label || "", params: t.params || {} }))];
  openCxSheet();
  renderCurrentLevel();
}

/* ============================= wiring (minimal, additive) =============================
   Entry point button lives inside the existing Comics tab's card grid (app.js
   renders it, id="comicsExplorerEntryBtn") — that grid's innerHTML is replaced
   on every tab switch/filter change, so this listens on document via
   delegation instead of binding to the button directly. */
document.addEventListener("click", (e) => {
  if (e.target.closest("#comicsExplorerEntryBtn")) openComicsExplorer();
});

const _cxBackdrop = document.getElementById("comicsExplorerBackdrop");
const _cxSheetEl = document.getElementById("comicsExplorerSheet");
const _cxCloseBtn = document.getElementById("comicsExplorerClose");
if (_cxBackdrop) _cxBackdrop.addEventListener("click", closeCxSheet);
if (_cxCloseBtn) _cxCloseBtn.addEventListener("click", closeCxSheet);

// Respect the site's existing Nerd Mode toggle live, without redesigning it:
// if the explorer is open when it's flipped, just re-render the current level.
const _nerdToggleEl = document.getElementById("nerdToggle");
if (_nerdToggleEl) {
  _nerdToggleEl.addEventListener("click", () => {
    if (_cxSheetEl && _cxSheetEl.dataset.open === "true") setTimeout(renderCurrentLevel, 0);
  });
}

window.__comicsExplorer = { open: openComicsExplorer, openAt: openComicsExplorerAt };
