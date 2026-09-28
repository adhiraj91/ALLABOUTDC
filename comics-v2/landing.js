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
    <section class="cl4-hero">
      <div class="cl4-hero-grid" aria-hidden="true"></div>
      <div class="cl4-hero-rings" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="cl4-hero-glow" aria-hidden="true"></div>
      <div class="cl4-hero-copy">
        <div class="cl4-eyebrow">ALLABOUTDC · COMICS</div>
        <h2>THE <span>DC</span><br>COMICS UNIVERSE</h2>
        <p>Every character. Every world. Every story.</p>
        <div class="cl4-hero-sub">Explore continuity, characters, events, series and reading paths through one connected Comics experience.</div>
        <div class="cl4-hero-actions">
          <button class="cl4-primary" data-explore="storymap">Open Universe Atlas <span>→</span></button>
          <button class="cl4-secondary" data-explore="era">Explore Eras <span>→</span></button>
        </div>
      </div>
      <div class="cl4-hero-orbit" aria-hidden="true">
        <div class="cl4-orbit-label">DC UNIVERSE</div>
        <div class="cl4-orbit-core">DC</div>
        <span class="cl4-node n1">EARTHS</span>
        <span class="cl4-node n2">EVENTS</span>
        <span class="cl4-node n3">CHARACTERS</span>
        <span class="cl4-node n4">SERIES</span>
      </div>
    </section>`;
}

function statStripHtml() {
  return `<section class="cl4-stats" id="cl3Stats" aria-label="Comics data coverage">
    <div class="cl4-stat"><b id="cl3StatSeries">—</b><span>Series</span></div>
    <div class="cl4-stat"><b id="cl3StatIssues">—</b><span>Issues mapped</span></div>
    <div class="cl4-stat"><b id="cl3StatCharacters">—</b><span>Characters</span></div>
    <div class="cl4-stat"><b id="cl3StatContinuities">—</b><span>Continuities</span></div>
  </section>`;
}

const EXPLORE_ENTRIES = [
  { key: "character", number: "01", label: "Characters", sub: "Start with a hero, villain or legacy.", icon: "✦" },
  { key: "era", number: "02", label: "Continuity & Eras", sub: "Move through DC's publishing history.", icon: "◈" },
  { key: "storymap", number: "03", label: "Universe Atlas", sub: "See worlds, events and connections.", icon: "◎" },
  { key: "paths", number: "04", label: "Reading Paths", sub: "Follow a curated journey.", icon: "⌁" },
];

function exploreHtml() {
  return `<section class="cl4-section">
    <div class="cl4-section-head"><div><div class="cl4-kicker">START EXPLORING</div><h3>Choose your way into DC</h3></div><span>Four views · one connected graph</span></div>
    <div class="cl4-explore-grid">
      ${EXPLORE_ENTRIES.map(e => `<button class="cl4-explore-card" data-explore="${e.key}">
        <span class="cl4-explore-number">${e.number}</span>
        <span class="cl4-explore-icon">${e.icon}</span>
        <span class="cl4-explore-copy"><strong>${esc(e.label)}</strong><small>${esc(e.sub)}</small></span>
        <span class="cl4-arrow">↗</span>
      </button>`).join("")}
    </div>
  </section>`;
}

function universeAtlasHtml() {
  return `<section class="cl4-section cl4-atlas-section">
    <div class="cl4-section-head"><div><div class="cl4-kicker">THE UNIVERSE</div><h3>One universe. Many connections.</h3></div><span>Click a territory to enter it</span></div>
    <div class="cl4-atlas">
      <div class="cl4-atlas-backdrop" aria-hidden="true"></div>
      <div class="cl4-atlas-copy">
        <div class="cl4-atlas-label">DC UNIVERSE ATLAS</div>
        <h4 id="cl3UniverseName">Loading…</h4>
        <p>Continuity, characters, stories and series connected through the same Comics data model.</p>
        <button class="cl4-atlas-open" data-action="storymap">Open the full Atlas <span>→</span></button>
      </div>
      <div class="cl4-atlas-constellation" aria-hidden="true">
        <div class="cl4-star s1"></div><div class="cl4-star s2"></div><div class="cl4-star s3"></div><div class="cl4-star s4"></div><div class="cl4-star s5"></div>
        <div class="cl4-connection c1"></div><div class="cl4-connection c2"></div><div class="cl4-connection c3"></div>
        <button class="cl4-atlas-node an1" data-explore="era"><b>ERAS</b><span id="cl4EraNode">—</span></button>
        <button class="cl4-atlas-node an2" data-explore="character"><b>CHARACTERS</b><span id="cl4CharacterNode">—</span></button>
        <button class="cl4-atlas-node an3" data-explore="paths"><b>READING</b><span id="cl4PathNode">—</span></button>
        <button class="cl4-atlas-node an4" id="cl4New52Node" disabled><b>NEW 52</b><span id="cl4New52NodeMeta">—</span></button>
      </div>
    </div>
  </section>`;
}

function continuityHtml() {
  return `<section class="cl4-section">
    <div class="cl4-section-head"><div><div class="cl4-kicker">PUBLISHING HISTORY</div><h3>Continuity through the ages</h3></div><button class="cl4-text-btn" data-explore="era">View all eras →</button></div>
    <div class="cl4-timeline" id="cl4Timeline"><div class="cl4-loading-line">Loading continuity…</div></div>
  </section>`;
}

function territoryHtml() {
  return `<section class="cl4-section">
    <div class="cl4-section-head"><div><div class="cl4-kicker">FEATURED TERRITORY</div><h3>The New 52</h3></div><span>Deepest current coverage</span></div>
    <button class="cl4-territory" id="cl3New52Btn" disabled>
      <div class="cl4-territory-mark"><span>52</span><i></i></div>
      <div class="cl4-territory-copy">
        <div class="cl4-territory-kicker">CONTINUITY</div>
        <strong>The New 52</strong>
        <span id="cl3New52Sub">Loading current coverage…</span>
        <small>Explore the mapped series, characters and stories in this territory. The same Atlas architecture will support the wider DC catalogue as it grows.</small>
      </div>
      <span class="cl4-territory-arrow">→</span>
    </button>
  </section>`;
}

function runsHtml() {
  return `<section class="cl4-section">
    <div class="cl4-section-head"><div><div class="cl4-kicker">FEATURED RUNS</div><h3>Stories worth following</h3></div><button class="cl4-text-btn" data-action="series">Browse series →</button></div>
    <div class="cl4-run-grid" id="cl4RunGrid"><div class="cl4-loading-line">Loading current runs…</div></div>
  </section>`;
}

function seriesHtml() {
  return `<section class="cl4-section">
    <div class="cl4-section-head"><div><div class="cl4-kicker">SERIES</div><h3>Mapped in the current graph</h3></div><button class="cl4-text-btn" data-action="series">Browse all series →</button></div>
    <div class="cl4-series-rail" id="cl3SeriesRail"><div class="cl4-loading-line">Loading current series…</div></div>
  </section>`;
}

function catalogueHtml() {
  return `<section class="cl4-catalogue">
    <div><div class="cl4-kicker">FULL CATALOGUE</div><h3>Want the database view?</h3><p>Search titles, use filters and browse the existing full catalogue.</p></div>
    <button class="cl4-catalogue-btn" id="comicsBrowseAllBtn">Browse all comics <span>→</span></button>
  </section>`;
}

function renderTimeline(container, continuities) {
  if (!container) return;
  const sorted = [...(continuities || [])].sort((a,b) => firstYear(a.startDate) - firstYear(b.startDate));
  if (!sorted.length) { container.innerHTML = `<div class="cl4-empty">No continuity records are mapped yet.</div>`; return; }
  container.innerHTML = sorted.map((c, i) => `
    <button class="cl4-era" data-continuity-id="${esc(c.id)}">
      <span class="cl4-era-dot"></span><span class="cl4-era-line"></span>
      <small>${esc(c.startDate ? String(c.startDate).slice(0,4) : "—")}</small>
      <strong>${esc(c.shortName || c.name || "Continuity")}</strong>
      <span>${esc(c.name || "Explore continuity")}</span>
    </button>`).join("");
  container.querySelectorAll("[data-continuity-id]").forEach(btn => btn.addEventListener("click", () => {
    const c = sorted.find(x => x.id === btn.dataset.continuityId);
    if (c) openExplorerAt("continuity", c.name || c.shortName || "Continuity", { continuity:c });
  }));
}

function renderRuns(container, runs, series) {
  if (!container) return;
  const byId = new Map((series || []).map(s => [s.id, s]));
  const list = [...(runs || [])].filter(r => byId.has(r.seriesId)).slice(0, 6);
  if (!list.length) {
    const fallback = [...(series || [])].slice(0, 6);
    container.innerHTML = fallback.length ? fallback.map(s => `<button class="cl4-run-card" data-series-id="${esc(s.id)}"><span>RUN</span><strong>${esc(s.title)}</strong><small>${esc(s.issueCount || "—")} issues mapped</small></button>`).join("") : `<div class="cl4-empty">No runs are mapped yet.</div>`;
  } else {
    container.innerHTML = list.map(r => {
      const s = byId.get(r.seriesId);
      return `<button class="cl4-run-card" data-series-id="${esc(s.id)}"><span>${esc(r.title || "CREATIVE RUN")}</span><strong>${esc(s.title)}</strong><small>${esc(r.startIssue || "")} ${r.endIssue ? `– ${esc(r.endIssue)}` : ""}</small></button>`;
    }).join("");
  }
  container.querySelectorAll("[data-series-id]").forEach(btn => btn.addEventListener("click", () => {
    const s = byId.get(btn.dataset.seriesId);
    if (s) openExplorerAt("series", s.title, { series:s });
  }));
}

function renderSeriesRail(container, series) {
  if (!container) return;
  const sorted = [...(series || [])].sort((a, b) => firstYear(a.startDate) - firstYear(b.startDate));
  if (!sorted.length) { container.innerHTML = `<div class="cl4-empty">No series have been mapped yet.</div>`; return; }
  const featured = sorted.slice(0, 10);
  container.innerHTML = featured.map(s => `
    <button class="cl4-series-card" data-series-id="${esc(s.id)}">
      <span class="cl4-series-year">${esc(String(s.startDate || "").slice(0, 4) || "—")}</span>
      <strong>${esc(s.title || "Untitled series")}</strong>
      <span>${s.issueCount ? `${esc(s.issueCount)} issues` : "Issue count pending"}</span>
      <i>→</i>
    </button>`).join("");
  container.querySelectorAll("[data-series-id]").forEach(btn => btn.addEventListener("click", () => {
    const s = sorted.find(x => x.id === btn.dataset.seriesId);
    if (s) openExplorerAt("series", s.title, { series: s });
  }));
}

function openExplorerAt(level, label, params = {}) {
  const ex = window.__comicsExplorer;
  if (ex && ex.openAt) ex.openAt([{ level, label, params }]);
}

function openUniverse(container) {
  const sm = window.__comicsStoryMap;
  const uniId = container.querySelector("#cl3UniverseName")?.dataset?.universeId;
  if (sm && uniId) sm.open("universe", uniId);
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

  const uniName = container.querySelector("#cl3UniverseName");
  if (uniName && universe) { uniName.textContent = universe.name || "DC Universe"; uniName.dataset.universeId = universe.id; }
  const eraNode = container.querySelector("#cl4EraNode");
  if (eraNode) eraNode.textContent = `${d.continuities.length} mapped`;
  const charNode = container.querySelector("#cl4CharacterNode");
  if (charNode) charNode.textContent = `${d.characters.length} characters`;
  const pathNode = container.querySelector("#cl4PathNode");
  if (pathNode) pathNode.textContent = `${d.readingPaths.length} paths`;

  const n52Btn = container.querySelector("#cl3New52Btn");
  const n52Node = container.querySelector("#cl4New52Node");
  const n52Sub = container.querySelector("#cl3New52Sub");
  if (new52) {
    const n52Series = d.series.filter(s => Array.isArray(s.continuityIds) && s.continuityIds.includes(new52.id));
    const n52Issues = countIssues(n52Series);
    const text = `${n52Series.length} mapped series · ${n52Issues.toLocaleString()} mapped issues`;
    if (n52Btn) { n52Btn.disabled = false; n52Btn.dataset.continuityId = new52.id; n52Btn.dataset.continuityName = new52.name; }
    if (n52Sub) n52Sub.textContent = text;
    if (n52Node) { n52Node.disabled = false; n52Node.dataset.continuityId = new52.id; n52Node.dataset.continuityName = new52.name; const meta = container.querySelector("#cl4New52NodeMeta"); if (meta) meta.textContent = `${n52Series.length} series`; }
  } else if (n52Sub) n52Sub.textContent = "New 52 continuity is not mapped in the current dataset yet.";

  renderTimeline(container.querySelector("#cl4Timeline"), d.continuities);
  renderRuns(container.querySelector("#cl4RunGrid"), d.runs, d.series);
  renderSeriesRail(container.querySelector("#cl3SeriesRail"), d.series);
}

let renderSeq = 0;

function renderComicsLanding(container, hooks = {}) {
  const my = ++renderSeq;
  const main = container.closest("main");
  if (main) main.classList.add("comics-home-main");
  container.innerHTML = `<div class="cl4-wrap">
    ${heroHtml()}
    ${statStripHtml()}
    ${exploreHtml()}
    ${universeAtlasHtml()}
    ${continuityHtml()}
    ${territoryHtml()}
    ${runsHtml()}
    ${seriesHtml()}
    ${catalogueHtml()}
  </div>`;

  container.querySelectorAll("[data-explore]").forEach(btn => btn.addEventListener("click", () => {
    const key = btn.dataset.explore;
    if (key === "character") openExplorerAt("characterList", "Characters", {});
    else if (key === "era") openExplorerAt("continuityList", "Continuities", {});
    else if (key === "paths") openExplorerAt("readingPathList", "Reading Paths", {});
    else if (key === "storymap") openUniverse(container);
  }));

  container.querySelectorAll("[data-action]").forEach(btn => btn.addEventListener("click", () => {
    const action = btn.dataset.action;
    if (action === "series") openExplorerAt("seriesList", "Series", {});
    if (action === "storymap") openUniverse(container);
  }));

  const n52Open = (id, name) => {
    if (id) loadHomeData().then(d => { const c = d.continuities.find(x => x.id === id); if (c) openExplorerAt("continuity", name, { continuity:c }); });
  };
  container.querySelector("#cl3New52Btn")?.addEventListener("click", e => n52Open(e.currentTarget.dataset.continuityId, e.currentTarget.dataset.continuityName || "The New 52"));
  container.querySelector("#cl4New52Node")?.addEventListener("click", e => n52Open(e.currentTarget.dataset.continuityId, e.currentTarget.dataset.continuityName || "The New 52"));

  container.querySelector("#comicsBrowseAllBtn")?.addEventListener("click", () => {
    if (main) main.classList.remove("comics-home-main");
    if (hooks.onBrowseAll) hooks.onBrowseAll();
  });

  loadHomeData().then(d => {
    if (my !== renderSeq || !container.isConnected) return;
    renderLoadedState(container, d);
  });
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
