// ============================================================================
// comics-v2 / landing.js
// ----------------------------------------------------------------------------
// POINTER 4 — the dedicated COMICS LANDING view (what the "Comics" tab opens).
//
// app.js owns the tab and simply asks this module to render into its #grid when
// the Comics tab is showing its landing (window.__comicsV2Landing.render). If this
// module hasn't loaded, app.js falls back to the old catalogue, so Comics never
// breaks. The old flat catalogue stays one tap away ("Browse all comics") but no
// longer dominates the first screen.
//
// Every entry point is data-driven (comicCharacters / comicContinuities /
// comicSeries / comicRuns / comicUniverses — capped, targeted reads, fetched once
// per page and cached). Characters or eras with no recorded series are shown
// honestly as "not mapped yet", never padded with invented data.
// ============================================================================
import * as data from "./data.js?v=p4";

const esc = (s) => s == null ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const yearOf = (d) => { const m = String(d || "").match(/\d{4}/); return m ? m[0] : ""; };
function yearRange(a, b) { const ya = yearOf(a), yb = yearOf(b); if (ya && yb) return ya === yb ? ya : `${ya}–${yb}`; if (ya) return `${ya}–`; return yb || ""; }
const initials = (t) => String(t || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();

let _dataPromise = null;
function loadLandingData() {
  if (_dataPromise) return _dataPromise;
  const safe = (p) => p.then(v => ({ ok: true, v }), e => { console.warn("[Comics landing]", e); return { ok: false, v: [] }; });
  _dataPromise = Promise.all([
    safe(data.getAllCharacters(200)), safe(data.getAllContinuities(100)), safe(data.getAllSeries(200)),
    safe(data.getAllRuns(24)), safe(data.getAllUniverses(10)),
  ]).then(([ch, ct, se, ru, un]) => {
    const failed = [ch, ct, se, ru, un].some(r => !r.ok);
    if (failed) _dataPromise = null; // let a later visit retry
    return { characters: ch.v, continuities: ct.v, series: se.v, runs: ru.v, universes: un.v, failed, allFailed: !ch.ok && !ct.ok && !se.ok };
  });
  return _dataPromise;
}

function orderContinuities(list) {
  const before = (a, b) => (a.successorId === b.id) || (b.predecessorId === a.id);
  return list.slice().sort((a, b) => {
    if (before(a, b)) return -1;
    if (before(b, a)) return 1;
    return String(a.startDate || "9999").localeCompare(String(b.startDate || "9999")) || String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function heroHtml(hooks) {
  const n = hooks && hooks.catalogueCount;
  return `
  <section class="cl-hero">
    <div class="cl-eyebrow">COMICS</div>
    <h2 class="cl-title">The DC Comics<br>Story Map</h2>
    <p class="cl-lede">Explore DC Comics the way it's actually built — through characters, continuities, series, creative runs and the stories inside them.</p>
    <div class="cl-ladder" aria-label="How the map is organised">
      <span>Character</span><i>›</i><span>Continuity</span><i>›</i><span>Series</span><i>›</i><span>Run</span><i>›</i><span>Story</span><i>›</i><span>Issues</span>
    </div>
    <div class="cl-hero-actions">
      <button class="btn-cta cl-open-map" id="clOpenMapBtn" disabled>Open the Story Map</button>
      <button class="cl-browse-link" id="comicsBrowseAllBtn">Browse all comics${n ? ` · ${n}` : ""} →</button>
    </div>
  </section>
  <nav class="cl-pillars" aria-label="Explore comics by">
    <button class="cl-pillar" data-jump="clCharacters"><span class="cl-pillar-k">01</span><span class="cl-pillar-l">Characters</span><span class="cl-pillar-n" data-count="characters"></span></button>
    <button class="cl-pillar" data-jump="clEras"><span class="cl-pillar-k">02</span><span class="cl-pillar-l">Continuities / Eras</span><span class="cl-pillar-n" data-count="eras"></span></button>
    <button class="cl-pillar" data-jump="clRuns"><span class="cl-pillar-k">03</span><span class="cl-pillar-l">Series / Runs</span><span class="cl-pillar-n" data-count="series"></span></button>
    <button class="cl-pillar" data-jump="clStories"><span class="cl-pillar-k">04</span><span class="cl-pillar-l">Stories</span><span class="cl-pillar-n">Arcs, events &amp; issues</span></button>
  </nav>`;
}

function skeletonSection(id, title, sub) {
  return `<section class="cl-section" id="${id}"><div class="cl-head"><h3>${esc(title)}</h3>${sub ? `<span>${esc(sub)}</span>` : ""}</div><div class="cl-skel"><i></i><i></i><i></i></div></section>`;
}

function charactersSection(d, counts) {
  const chars = d.characters.slice().sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0) || String(a.displayName || a.name).localeCompare(String(b.displayName || b.name)));
  if (!chars.length) return `<div class="cl-empty">No characters have been added to the comics database yet.</div>`;
  const tiles = chars.map(c => {
    const n = counts.get(c.id) || 0;
    return `<button class="cl-char" data-map-type="character" data-map-id="${esc(c.id)}" data-mapped="${n > 0}">
        <span class="cl-char-mono">${esc(initials(c.displayName || c.name))}</span>
        <span class="cl-char-name">${esc(c.displayName || c.name)}</span>
        <span class="cl-char-meta">${n ? `${n} series` : "Not mapped yet"}</span>
      </button>`;
  }).join("");
  return `<div class="cl-rail cl-char-rail">${tiles}</div>`;
}

function erasSection(d, contCounts) {
  const conts = orderContinuities(d.continuities);
  if (!conts.length) return `<div class="cl-empty">No continuities have been added yet.</div>`;
  const rows = conts.map(ct => {
    const n = contCounts.get(ct.id) || 0;
    const sub = [ct.shortName && ct.shortName !== ct.name ? ct.shortName : "", yearRange(ct.startDate, ct.endDate)].filter(Boolean).join(" · ");
    return `<button class="cl-era" data-map-type="continuity" data-map-id="${esc(ct.id)}" data-mapped="${n > 0}">
        <span class="cl-era-dot" aria-hidden="true"></span>
        <span class="cl-era-name">${esc(ct.name)}</span>
        ${sub ? `<span class="cl-era-sub">${esc(sub)}</span>` : ""}
        <span class="cl-era-count">${n ? `${n} series` : "No series recorded yet"}</span>
      </button>`;
  }).join("");
  const uni = d.universes[0];
  const uniLink = d.universes.length === 1
    ? `<button class="cl-text-link" data-map-type="universe" data-map-id="${esc(uni.id)}">Map every era of the ${esc(uni.name)} →</button>` : "";
  return `<div class="cl-era-line">${rows}</div>${uniLink}`;
}

function runsSection(d, seriesById) {
  const runs = d.runs.filter(r => seriesById.has(r.seriesId) || r.title);
  if (!runs.length) return `<div class="cl-empty">No creative runs have been mapped yet.</div>`;
  const cards = runs.map(r => {
    const s = seriesById.get(r.seriesId);
    const range = r.startIssue != null && r.endIssue != null ? `Issues #${r.startIssue}–${r.endIssue}` : "";
    const years = yearRange(r.startDate || (s && s.startDate), r.endDate || (s && s.endDate));
    return `<button class="cl-run" data-map-type="series" data-map-id="${esc(r.seriesId)}" data-map-run="${esc(r.id)}">
        <span class="cl-run-k">${esc(s ? `${s.title}${yearOf(s.startDate) ? ` (${yearOf(s.startDate)})` : ""}` : "Series")}</span>
        <span class="cl-run-t">${esc(r.title || "Creative run")}</span>
        <span class="cl-run-m">${esc([range, years].filter(Boolean).join(" · "))}</span>
        <span class="cl-run-go">Open story map →</span>
      </button>`;
  }).join("");
  return `<div class="cl-run-grid">${cards}</div><button class="cl-text-link" id="clSeriesListBtn">All ${d.series.length} mapped series →</button>`;
}

function storiesSection() {
  return `<div class="cl-links">
      <button class="cl-link-row" id="comicsExplorerEntryBtn"><span class="cl-link-t">Continuity Explorer</span><span class="cl-link-s">Step through characters, eras, series, runs, stories and issues as lists</span><span class="cl-link-a">›</span></button>
      <button class="cl-link-row" id="comicsLandingPathBtn"><span class="cl-link-t">Not sure where to start?</span><span class="cl-link-s">Build a reading path with progress tracking</span><span class="cl-link-a">›</span></button>
    </div>`;
}

function catalogueCard(hooks) {
  const n = hooks && hooks.catalogueCount;
  return `<section class="cl-catalogue">
      <div><div class="cl-cat-t">The full comics catalogue</div><div class="cl-cat-s">${n ? `${n} titles · ` : ""}filter by era, canon status and reading level</div></div>
      <button class="btn btn-ghost" id="comicsBrowseAllBtn2">Browse all comics</button>
    </section>`;
}

let renderSeq = 0;
/**
 * Render the landing into `container` (app.js's #grid).
 * hooks: { catalogueCount, onBrowseAll(), onReadingPath() }
 */
export function renderComicsLanding(container, hooks = {}) {
  const my = ++renderSeq;
  container.innerHTML = `<div class="cl-wrap">${heroHtml(hooks)}
      ${skeletonSection("clCharacters", "Explore by Character", "Start the map from a hero")}
      ${skeletonSection("clEras", "Explore by Continuity / Era", "Each era has its own map")}
      ${skeletonSection("clRuns", "Featured Story Maps", "Series → creative runs → story arcs")}
      <section class="cl-section" id="clStories"><div class="cl-head"><h3>Stories &amp; Issues</h3><span>Other ways in</span></div>${storiesSection()}</section>
      ${catalogueCard(hooks)}
    </div>`;
  loadLandingData().then(d => {
    if (my !== renderSeq || !container.isConnected || !container.querySelector(".cl-wrap")) return;
    const charCounts = new Map(), contCounts = new Map(), seriesById = new Map();
    d.series.forEach(s => {
      seriesById.set(s.id, s);
      (s.characterIds || []).forEach(id => charCounts.set(id, (charCounts.get(id) || 0) + 1));
      (s.continuityIds || []).forEach(id => contCounts.set(id, (contCounts.get(id) || 0) + 1));
    });
    const put = (id, html) => { const sec = container.querySelector("#" + id); if (sec) { const sk = sec.querySelector(".cl-skel"); if (sk) sk.outerHTML = html; } };
    if (d.allFailed) {
      const msg = `<div class="cl-empty cl-error">Couldn't reach the comics map right now. You can still <button class="cl-inline-link" data-browse-all>browse all comics</button>.</div>`;
      ["clCharacters", "clEras", "clRuns"].forEach(id => put(id, msg));
    } else {
      put("clCharacters", charactersSection(d, charCounts));
      put("clEras", erasSection(d, contCounts));
      put("clRuns", runsSection(d, seriesById));
    }
    const setCount = (k, v) => { const e = container.querySelector(`[data-count="${k}"]`); if (e && v) e.textContent = v; };
    const plural = (n, one, many) => n ? `${n} ${n === 1 ? one : many}` : "";
    setCount("characters", plural(d.characters.length, "character", "characters"));
    setCount("eras", plural(d.continuities.length, "era", "eras"));
    setCount("series", [plural(d.series.length, "series", "series"), plural(d.runs.length, "run", "runs")].filter(Boolean).join(" · "));
    // Hero CTA: start from the character the data covers most (data-driven, never a hardcoded name).
    const top = d.characters.slice().sort((a, b) => (charCounts.get(b.id) || 0) - (charCounts.get(a.id) || 0))[0];
    const cta = container.querySelector("#clOpenMapBtn");
    if (cta) {
      if (top && (charCounts.get(top.id) || 0) > 0) {
        cta.disabled = false;
        cta.dataset.mapType = "character"; cta.dataset.mapId = top.id;
        cta.innerHTML = `Open the Story Map <span class="cl-cta-sub">starting with ${esc(top.displayName || top.name)}</span>`;
      } else cta.remove();
    }
  });
}

function onLandingClick(e) {
  const container = e.currentTarget;
  const hooks = container._clHooks || {};
  if (!container.querySelector(".cl-wrap")) return; // grid now shows something else
  const map = e.target.closest("[data-map-type]");
  if (map) {
    const sm = window.__comicsStoryMap;
    if (!sm) return;
    const opts = map.dataset.mapRun ? { expandPath: [map.dataset.mapRun] } : {};
    sm.open(map.dataset.mapType, map.dataset.mapId, opts);
    return;
  }
  if (e.target.closest("#comicsBrowseAllBtn, #comicsBrowseAllBtn2, [data-browse-all]")) { if (hooks.onBrowseAll) hooks.onBrowseAll(); return; }
  if (e.target.closest("#comicsLandingPathBtn")) { if (hooks.onReadingPath) hooks.onReadingPath(); return; }
  if (e.target.closest("#clSeriesListBtn")) {
    const ex = window.__comicsExplorer;
    if (ex && ex.openAt) ex.openAt([{ level: "seriesList", label: "Series", params: {} }]);
    return;
  }
  const jump = e.target.closest("[data-jump]");
  if (jump) {
    const target = container.querySelector("#" + jump.dataset.jump);
    if (target) {
      const header = document.querySelector("header");
      const off = header && getComputedStyle(header).position === "sticky" ? header.getBoundingClientRect().height : 0;
      window.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - off - 12), behavior: "smooth" });
    }
  }
}

// The grid element is reused across tabs, so the delegated listener is attached once per element.
const _wired = new WeakSet();
function renderSafe(container, hooks) {
  if (!_wired.has(container)) { _wired.add(container); container.addEventListener("click", onLandingClick); }
  container._clHooks = hooks;
  renderComicsLanding(container, hooks);
}

window.__comicsV2Landing = { render: renderSafe, preload: loadLandingData };
document.dispatchEvent(new CustomEvent("comicsv2:landing-ready"));
