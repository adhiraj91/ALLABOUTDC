// ============================================================================
// comics-v2 / landing.js
// ----------------------------------------------------------------------------
// STEP 3 — Comics Home shell.
//
// This is the first real redesign of the Comics landing page. It intentionally
// does NOT change the underlying Comics data model, Explorer, Story Map, or the
// legacy catalogue. It creates a data-driven home/atlas entry point on top of
// the existing comics-v2 domain model.
//
// The page is deliberately honest about coverage: counts and featured items
// come from the current comics-v2 Firestore data. Nothing is invented merely
// to make the UI look populated.
// ============================================================================
import * as data from "./data.js?v=p67";
import { renderContinueCard } from "./reading-progress.js?v=p6";

const esc = (s) => s == null ? "" : String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let _dataPromise = null;
function loadHomeData() {
  if (_dataPromise) return _dataPromise;
  _dataPromise = Promise.all([
    data.getAllUniverses(10),
    data.getAllContinuities(50),
    data.getAllCharacters(100),
    data.getAllSeries(200),
    data.getAllRuns(50),
    data.getAllReadingPaths(20),
  ]).then(([universes, continuities, characters, series, runs, readingPaths]) => ({
    universes, continuities, characters, series, runs, readingPaths, ok: true,
  })).catch(e => {
    console.warn("[Comics landing] data load", e);
    _dataPromise = null;
    return { universes: [], continuities: [], characters: [], series: [], runs: [], readingPaths: [], ok: false };
  });
  return _dataPromise;
}

function findNew52(continuities) {
  return (continuities || []).find(c =>
    String(c.shortName || "").toLowerCase() === "new 52" ||
    String(c.name || "").toLowerCase() === "the new 52" ||
    String(c.name || "").toLowerCase() === "new 52"
  ) || null;
}

function firstYear(v) {
  const m = String(v || "").match(/\d{4}/);
  return m ? Number(m[0]) : 9999;
}

function countIssues(series) {
  return (series || []).reduce((n, s) => n + (Number(s.issueCount) || 0), 0);
}

function heroHtml() {
  return `
    <section class="cl3-hero">
      <div class="cl3-hero-art" aria-hidden="true">
        <span class="cl3-orbit cl3-orbit-a"></span>
        <span class="cl3-orbit cl3-orbit-b"></span>
        <span class="cl3-city cl3-city-a"></span>
        <span class="cl3-city cl3-city-b"></span>
        <span class="cl3-city cl3-city-c"></span>
        <span class="cl3-sigil">DC</span>
      </div>
      <div class="cl3-hero-copy">
        <div class="cl3-eyebrow">ALLABOUTDC · COMICS</div>
        <h2>DC <span>COMICS</span></h2>
        <p>Every character. Every world. Every story.</p>
        <div class="cl3-hero-sub">Explore the Comics universe through continuity, characters, events, series and reading paths.</div>
      </div>
      <div class="cl3-hero-meta">
        <div class="cl3-meta-k">CURRENT COMICS GRAPH</div>
        <div class="cl3-meta-v" id="cl3UniverseMeta">Loading universe data…</div>
      </div>
    </section>`;
}

function statStripHtml() {
  return `<section class="cl3-stats" id="cl3Stats" aria-label="Comics data coverage">
    <div class="cl3-stat"><b id="cl3StatSeries">—</b><span>Series</span></div>
    <div class="cl3-stat"><b id="cl3StatIssues">—</b><span>Issues mapped</span></div>
    <div class="cl3-stat"><b id="cl3StatCharacters">—</b><span>Characters</span></div>
    <div class="cl3-stat"><b id="cl3StatContinuities">—</b><span>Continuities</span></div>
  </section>`;
}

const EXPLORE_ENTRIES = [
  { key: "character", icon: "✦", label: "By Character", sub: "Start with a hero, villain or legacy." },
  { key: "era", icon: "◈", label: "Continuity / Era", sub: "Move through DC's publishing history." },
  { key: "storymap", icon: "◎", label: "Universe Atlas", sub: "See worlds, events and connections." },
  { key: "paths", icon: "⌁", label: "Reading Paths", sub: "Follow a curated journey." },
];

function exploreHtml() {
  return `<section class="cl3-section">
    <div class="cl3-section-head"><div><div class="cl3-kicker">START HERE</div><h3>Explore the DC Comics universe</h3></div><span>Choose a lens</span></div>
    <div class="cl3-explore-grid">
      ${EXPLORE_ENTRIES.map(e => `<button class="cl3-explore-card" data-explore="${e.key}">
        <span class="cl3-explore-icon">${e.icon}</span>
        <span class="cl3-explore-copy"><strong>${esc(e.label)}</strong><small>${esc(e.sub)}</small></span>
        <span class="cl3-arrow">→</span>
      </button>`).join("")}
    </div>
  </section>`;
}

function universeHtml() {
  return `<section class="cl3-section cl3-universe-section">
    <div class="cl3-section-head"><div><div class="cl3-kicker">THE UNIVERSE</div><h3>One graph, many ways in</h3></div><span>Same data · different views</span></div>
    <div class="cl3-universe-grid">
      <button class="cl3-universe-card cl3-universe-main" data-action="storymap">
        <div class="cl3-card-glow"></div>
        <div class="cl3-universe-label">DC UNIVERSE</div>
        <h4 id="cl3UniverseName">Loading…</h4>
        <p>Continuities, characters, stories and relationships connected through the same Comics data model.</p>
        <span class="cl3-card-cta">Open Universe Atlas →</span>
      </button>
      <div class="cl3-mini-stack">
        <button class="cl3-mini-card" data-explore="era"><b>CONTINUITY</b><span id="cl3ContinuityPreview">Loading…</span><small>Explore eras →</small></button>
        <button class="cl3-mini-card" data-explore="character"><b>CHARACTERS</b><span id="cl3CharacterPreview">Loading…</span><small>Browse characters →</small></button>
        <button class="cl3-mini-card" data-explore="paths"><b>READING PATHS</b><span id="cl3PathPreview">Loading…</span><small>Choose a journey →</small></button>
      </div>
    </div>
  </section>`;
}

function new52Html() {
  return `<section class="cl3-section">
    <div class="cl3-section-head"><div><div class="cl3-kicker">FEATURED TERRITORY</div><h3>New 52</h3></div><span id="cl3New52Status">Current mapped coverage</span></div>
    <button class="cl3-new52" id="cl3New52Btn" disabled>
      <div class="cl3-new52-mark">52</div>
      <div class="cl3-new52-copy">
        <strong>The New 52</strong>
        <span id="cl3New52Sub">Loading current coverage…</span>
        <small>This is the first deeply populated territory. More of the wider DC catalogue can be added without changing the Atlas architecture.</small>
      </div>
      <span class="cl3-arrow">→</span>
    </button>
  </section>`;
}

function seriesHtml() {
  return `<section class="cl3-section">
    <div class="cl3-section-head"><div><div class="cl3-kicker">COMICS CATALOGUE</div><h3>Explore series</h3></div><button class="cl3-text-btn" data-action="series">Browse all series →</button></div>
    <div class="cl3-series-rail" id="cl3SeriesRail"><div class="cl3-loading-line">Loading current series…</div></div>
  </section>`;
}

function catalogueHtml() {
  return `<section class="cl3-catalogue">
    <div><div class="cl3-kicker">FULL CATALOGUE</div><h3>Browse All Comics</h3><p>Use the existing catalogue when you want direct title search, filters and the full legacy list.</p></div>
    <button class="btn btn-ghost" id="comicsBrowseAllBtn">Browse all comics →</button>
  </section>`;
}

function renderSeriesRail(container, series) {
  if (!container) return;
  const sorted = [...(series || [])].sort((a, b) => firstYear(a.startDate) - firstYear(b.startDate));
  if (!sorted.length) {
    container.innerHTML = `<div class="cl3-empty">No series have been mapped yet.</div>`;
    return;
  }
  const featured = sorted.slice(0, 8);
  container.innerHTML = featured.map(s => `
    <button class="cl3-series-card" data-series-id="${esc(s.id)}">
      <span class="cl3-series-year">${esc(String(s.startDate || "").slice(0, 4) || "—")}</span>
      <strong>${esc(s.title || "Untitled series")}</strong>
      <span>${s.issueCount ? `${esc(s.issueCount)} issues` : "Issue count pending"}</span>
    </button>`).join("");
  container.querySelectorAll("[data-series-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const s = sorted.find(x => x.id === btn.dataset.seriesId);
      if (s) openExplorerAt("series", s.title, { series: s });
    });
  });
}

function openExplorerAt(level, label, params = {}) {
  const ex = window.__comicsExplorer;
  if (ex && ex.openAt) ex.openAt([{ level, label, params }]);
}

function wireAction(container, action) {
  if (action === "series") openExplorerAt("seriesList", "Series", {});
  else if (action === "storymap") {
    const sm = window.__comicsStoryMap;
    const uniId = container.querySelector("#cl3UniverseName")?.dataset?.universeId;
    if (sm && uniId) sm.open("universe", uniId);
  }
}

function renderLoadedState(container, d) {
  const universe = d.universes[0] || null;
  const new52 = findNew52(d.continuities);
  const statSeries = container.querySelector("#cl3StatSeries");
  const statIssues = container.querySelector("#cl3StatIssues");
  const statCharacters = container.querySelector("#cl3StatCharacters");
  const statContinuities = container.querySelector("#cl3StatContinuities");
  if (statSeries) statSeries.textContent = d.series.length.toLocaleString();
  if (statIssues) statIssues.textContent = countIssues(d.series).toLocaleString();
  if (statCharacters) statCharacters.textContent = d.characters.length.toLocaleString();
  if (statContinuities) statContinuities.textContent = d.continuities.length.toLocaleString();

  const meta = container.querySelector("#cl3UniverseMeta");
  if (meta) meta.textContent = universe ? `${d.continuities.length} continuity${d.continuities.length === 1 ? "" : "ies"} · ${d.series.length} series mapped` : "No universe record loaded";
  const uniName = container.querySelector("#cl3UniverseName");
  if (uniName && universe) { uniName.textContent = universe.name || "DC Universe"; uniName.dataset.universeId = universe.id; }
  const contPreview = container.querySelector("#cl3ContinuityPreview");
  if (contPreview) contPreview.textContent = d.continuities.length ? d.continuities.slice(0, 3).map(c => c.shortName || c.name).join(" · ") : "No continuities mapped";
  const charPreview = container.querySelector("#cl3CharacterPreview");
  if (charPreview) charPreview.textContent = d.characters.length ? `${d.characters.length} characters in the current graph` : "No characters mapped";
  const pathPreview = container.querySelector("#cl3PathPreview");
  if (pathPreview) pathPreview.textContent = d.readingPaths.length ? `${d.readingPaths.length} curated path${d.readingPaths.length === 1 ? "" : "s"}` : "No paths mapped yet";

  const n52Btn = container.querySelector("#cl3New52Btn");
  const n52Sub = container.querySelector("#cl3New52Sub");
  if (n52Btn && new52) {
    n52Btn.disabled = false;
    n52Btn.dataset.continuityId = new52.id;
    n52Btn.dataset.continuityName = new52.name;
    const n52Series = d.series.filter(s => Array.isArray(s.continuityIds) && s.continuityIds.includes(new52.id));
    const n52Issues = countIssues(n52Series);
    if (n52Sub) n52Sub.textContent = `${n52Series.length} mapped series · ${n52Issues.toLocaleString()} mapped issues`;
  } else if (n52Sub) {
    n52Sub.textContent = "New 52 continuity is not mapped in the current dataset yet.";
  }
  renderSeriesRail(container.querySelector("#cl3SeriesRail"), d.series);
}

let renderSeq = 0;

function renderComicsLanding(container, hooks = {}) {
  const my = ++renderSeq;
  const main = container.closest("main");
  if (main) main.classList.add("comics-home-main");
  container.innerHTML = `<div class="cl3-wrap">
    ${heroHtml()}
    ${statStripHtml()}
    ${exploreHtml()}
    ${universeHtml()}
    ${new52Html()}
    ${seriesHtml()}
    ${catalogueHtml()}
    <div class="cl3-continue" id="clContinue" hidden></div>
  </div>`;

  const continueSlot = container.querySelector("#clContinue");
  renderContinueCard(continueSlot).then(() => {
    if (!continueSlot?.isConnected) return;
    const start = continueSlot.querySelector('[data-state="start"]');
    if (start) { continueSlot.hidden = true; continueSlot.innerHTML = ""; }
  }).catch(e => console.warn("[Comics landing] continue card", e));

  container.querySelectorAll("[data-explore]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.explore;
      if (key === "character") openExplorerAt("characterList", "Characters", {});
      else if (key === "era") openExplorerAt("continuityList", "Continuities", {});
      else if (key === "paths") openExplorerAt("readingPathList", "Reading Paths", {});
      else if (key === "storymap") {
        const sm = window.__comicsStoryMap;
        const uniId = container.querySelector("#cl3UniverseName")?.dataset?.universeId;
        if (sm && uniId) sm.open("universe", uniId);
      }
    });
  });

  container.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", () => wireAction(container, btn.dataset.action));
  });

  container.querySelector("#cl3New52Btn")?.addEventListener("click", e => {
    const id = e.currentTarget.dataset.continuityId;
    const name = e.currentTarget.dataset.continuityName || "The New 52";
    if (id) {
      loadHomeData().then(d => {
        const continuity = d.continuities.find(c => c.id === id);
        if (continuity) openExplorerAt("continuity", name, { continuity });
      });
    }
  });

  container.querySelector("#comicsBrowseAllBtn")?.addEventListener("click", () => {
    if (main) main.classList.remove("comics-home-main");
    if (hooks.onBrowseAll) hooks.onBrowseAll();
  });

  loadHomeData().then(d => {
    if (my !== renderSeq || !container.isConnected) return;
    renderLoadedState(container, d);
  });
}

const _wired = new WeakSet();
function renderSafe(container, hooks = {}) {
  if (!_wired.has(container)) _wired.add(container);
  container._clHooks = hooks;
  renderComicsLanding(container, hooks);
}

document.addEventListener("readerprogress:change", () => {
  const slot = document.getElementById("clContinue");
  if (slot?.isConnected) {
    renderContinueCard(slot).catch(() => {});
  }
});

window.__comicsV2Landing = { render: renderSafe, preload: loadHomeData };
document.dispatchEvent(new CustomEvent("comicsv2:landing-ready"));
