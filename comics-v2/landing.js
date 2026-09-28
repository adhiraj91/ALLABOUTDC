// ============================================================================
// comics-v2 / landing.js
// ----------------------------------------------------------------------------
// STEP 4 — Comics Universe Home (visual evolution only).
//
// Important: this file deliberately reuses the existing Comics Explorer and
// Story Map entry points. It does not change routing, the data model, the
// legacy catalogue, or any non-Comics section. The page is an immersive home
// for the same graph that already powers the current Comics tools.
// ============================================================================
import * as data from "./data.js?v=p68";
import { renderContinueCard } from "./reading-progress.js?v=p7";

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

function continuityLabel(c) {
  return c?.shortName || c?.name || "Continuity";
}

function heroHtml() {
  return `
    <section class="cl4-hero">
      <div class="cl4-hero-art" aria-hidden="true">
        <span class="cl4-glow cl4-glow-a"></span>
        <span class="cl4-glow cl4-glow-b"></span>
        <span class="cl4-orbit cl4-orbit-a"></span>
        <span class="cl4-orbit cl4-orbit-b"></span>
        <span class="cl4-orbit cl4-orbit-c"></span>
        <span class="cl4-star cl4-star-a"></span><span class="cl4-star cl4-star-b"></span>
        <span class="cl4-star cl4-star-c"></span><span class="cl4-star cl4-star-d"></span>
        <span class="cl4-sigil">DC</span>
      </div>
      <div class="cl4-hero-copy">
        <div class="cl4-eyebrow">ALLABOUTDC · COMICS</div>
        <h2>DC <span>COMICS</span></h2>
        <p>Every character. Every world. Every story.</p>
        <div class="cl4-hero-sub">Explore the DC Comics universe through continuity, characters, events, series and reading paths — all connected to the same underlying graph.</div>
        <div class="cl4-hero-actions">
          <button class="cl4-primary" data-action="storymap">Open Universe Atlas <b>→</b></button>
          <button class="cl4-secondary" data-explore="era">Explore Eras</button>
        </div>
      </div>
      <div class="cl4-hero-side">
        <span>THE COMICS UNIVERSE</span>
        <strong id="cl4HeroMeta">Loading…</strong>
        <small>One connected place to move from era → event → character → series → issue.</small>
      </div>
    </section>`;
}

function statStripHtml() {
  return `<section class="cl4-stats" id="cl4Stats" aria-label="Current Comics data coverage">
    <div class="cl4-stat"><b id="cl4StatSeries">—</b><span>Series mapped</span></div>
    <div class="cl4-stat"><b id="cl4StatIssues">—</b><span>Issues mapped</span></div>
    <div class="cl4-stat"><b id="cl4StatCharacters">—</b><span>Characters</span></div>
    <div class="cl4-stat"><b id="cl4StatContinuities">—</b><span>Continuities</span></div>
  </section>`;
}

const EXPLORE_ENTRIES = [
  { key: "character", icon: "✦", label: "By Character", sub: "Start with a hero, villain or legacy.", tone: "blue" },
  { key: "era", icon: "◈", label: "Continuity / Era", sub: "Move through DC's publishing history.", tone: "gold" },
  { key: "storymap", icon: "◎", label: "Universe Atlas", sub: "See worlds, eras and connections.", tone: "violet" },
  { key: "paths", icon: "⌁", label: "Reading Paths", sub: "Follow a curated journey.", tone: "red" },
];

function exploreHtml() {
  return `<section class="cl4-section">
    <div class="cl4-section-head"><div><div class="cl4-kicker">START HERE</div><h3>Explore the DC Comics universe</h3></div><span>Choose a lens</span></div>
    <div class="cl4-explore-grid">
      ${EXPLORE_ENTRIES.map(e => `<button class="cl4-explore-card cl4-tone-${e.tone}" data-explore="${e.key}">
        <span class="cl4-explore-number">0${EXPLORE_ENTRIES.indexOf(e) + 1}</span>
        <span class="cl4-explore-icon">${e.icon}</span>
        <span class="cl4-explore-copy"><strong>${esc(e.label)}</strong><small>${esc(e.sub)}</small></span>
        <span class="cl4-arrow">→</span>
      </button>`).join("")}
    </div>
  </section>`;
}

function universeHtml() {
  return `<section class="cl4-section cl4-atlas-section">
    <div class="cl4-section-head"><div><div class="cl4-kicker">THE UNIVERSE</div><h3>One graph. Many ways in.</h3></div><span>Same data · different views</span></div>
    <div class="cl4-atlas-shell">
      <button class="cl4-atlas-visual" data-action="storymap" aria-label="Open Universe Atlas">
        <div class="cl4-atlas-grid"></div>
        <div class="cl4-atlas-line cl4-line-1"></div><div class="cl4-atlas-line cl4-line-2"></div><div class="cl4-atlas-line cl4-line-3"></div>
        <div class="cl4-atlas-node cl4-node-core"><span>DC</span><small>UNIVERSE</small></div>
        <div class="cl4-atlas-node cl4-node-era"><b>ERA</b><span id="cl4AtlasEra">Loading</span></div>
        <div class="cl4-atlas-node cl4-node-character"><b>CHARACTERS</b><span id="cl4AtlasCharacters">—</span></div>
        <div class="cl4-atlas-node cl4-node-series"><b>SERIES</b><span id="cl4AtlasSeries">—</span></div>
        <div class="cl4-atlas-node cl4-node-new52"><b>NEW 52</b><span>territory</span></div>
        <div class="cl4-atlas-watermark">OPEN ATLAS →</div>
      </button>
      <div class="cl4-atlas-info">
        <div class="cl4-atlas-info-card cl4-atlas-primary">
          <span class="cl4-mini-kicker">DC UNIVERSE</span>
          <h4 id="cl4UniverseName">Loading…</h4>
          <p>Continuities, characters, stories and relationships connected through the same Comics data model.</p>
          <button data-action="storymap">Open Universe Atlas <b>→</b></button>
        </div>
        <button class="cl4-atlas-info-card" data-explore="era"><span>CONTINUITY</span><strong id="cl4ContinuityPreview">Loading…</strong><small>Explore eras →</small></button>
        <button class="cl4-atlas-info-card" data-explore="character"><span>CHARACTERS</span><strong id="cl4CharacterPreview">Loading…</strong><small>Browse characters →</small></button>
        <button class="cl4-atlas-info-card" data-explore="paths"><span>READING PATHS</span><strong id="cl4PathPreview">Loading…</strong><small>Choose a journey →</small></button>
      </div>
    </div>
  </section>`;
}

function timelineHtml() {
  return `<section class="cl4-section">
    <div class="cl4-section-head"><div><div class="cl4-kicker">PUBLISHING HISTORY</div><h3>Move through the eras</h3></div><button class="cl4-text-btn" data-explore="era">View all eras →</button></div>
    <div class="cl4-era-track" id="cl4EraTrack"><div class="cl4-loading-line">Loading continuity history…</div></div>
  </section>`;
}

function new52Html() {
  return `<section class="cl4-section">
    <div class="cl4-section-head"><div><div class="cl4-kicker">FEATURED TERRITORY</div><h3>The New 52</h3></div><span id="cl4New52Status">Current mapped coverage</span></div>
    <button class="cl4-new52" id="cl4New52Btn" disabled>
      <div class="cl4-new52-art"><span>52</span><i></i><i></i><i></i></div>
      <div class="cl4-new52-copy">
        <span class="cl4-mini-kicker">2011 · EARTH-0</span>
        <strong>The New 52</strong>
        <span id="cl4New52Sub">Loading current coverage…</span>
        <small>Our first deeply populated territory. Its series, issues and relationships become the model for expanding the wider DC catalogue.</small>
      </div>
      <span class="cl4-new52-arrow">Explore territory <b>→</b></span>
    </button>
  </section>`;
}

function runsHtml() {
  return `<section class="cl4-section">
    <div class="cl4-section-head"><div><div class="cl4-kicker">CREATIVE RUNS</div><h3>Stories shaped by creators</h3></div><span>From the current Comics graph</span></div>
    <div class="cl4-run-grid" id="cl4RunGrid"><div class="cl4-loading-line">Loading featured runs…</div></div>
  </section>`;
}

function seriesHtml() {
  return `<section class="cl4-section">
    <div class="cl4-section-head"><div><div class="cl4-kicker">COMICS CATALOGUE</div><h3>Explore series</h3></div><button class="cl4-text-btn" data-action="series">Browse all series →</button></div>
    <div class="cl4-series-rail" id="cl4SeriesRail"><div class="cl4-loading-line">Loading current series…</div></div>
  </section>`;
}

function catalogueHtml() {
  return `<section class="cl4-catalogue">
    <div><div class="cl4-kicker">FULL CATALOGUE</div><h3>Browse All Comics</h3><p>Use the existing catalogue when you want direct title search, filters and the full legacy list.</p></div>
    <button class="cl4-catalogue-btn" id="comicsBrowseAllBtn">Browse all comics <b>→</b></button>
  </section>`;
}

function renderEraTrack(container, continuities) {
  if (!container) return;
  const sorted = [...(continuities || [])].sort((a, b) => firstYear(a.startDate) - firstYear(b.startDate));
  if (!sorted.length) { container.innerHTML = `<div class="cl4-empty">No continuity history is mapped yet.</div>`; return; }
  container.innerHTML = sorted.map((c, i) => `
    <button class="cl4-era-card ${i === sorted.length - 1 ? "is-current" : ""}" data-continuity-id="${esc(c.id)}">
      <span class="cl4-era-line"></span><small>${esc(String(c.startDate || "").slice(0, 4) || "ERA")}</small>
      <strong>${esc(continuityLabel(c))}</strong><span>Explore →</span>
    </button>`).join("");
  container.querySelectorAll("[data-continuity-id]").forEach(btn => btn.addEventListener("click", () => {
    const c = sorted.find(x => x.id === btn.dataset.continuityId);
    if (c) openExplorerAt("continuity", continuityLabel(c), { continuity: c });
  }));
}

function renderRuns(container, runs) {
  if (!container) return;
  const sorted = [...(runs || [])].slice(0, 4);
  if (!sorted.length) { container.innerHTML = `<div class="cl4-empty">No creative runs have been mapped yet.</div>`; return; }
  container.innerHTML = sorted.map((r, i) => `
    <button class="cl4-run-card" data-run-id="${esc(r.id)}">
      <span class="cl4-run-index">0${i + 1}</span>
      <div><small>CREATIVE RUN</small><strong>${esc(r.title || "Untitled run")}</strong><span>${esc(r.description || "Explore this mapped creative run.").slice(0, 150)}</span></div>
      <b>→</b>
    </button>`).join("");
  // Runs are intentionally visual-only in this pass. The dedicated run
  // detail route will be wired later once that route is part of the Comics
  // interaction model; this avoids inventing a new navigation path here.
}

function renderSeriesRail(container, series) {
  if (!container) return;
  const sorted = [...(series || [])].sort((a, b) => firstYear(a.startDate) - firstYear(b.startDate));
  if (!sorted.length) { container.innerHTML = `<div class="cl4-empty">No series have been mapped yet.</div>`; return; }
  const featured = sorted.slice(0, 8);
  container.innerHTML = featured.map(s => `
    <button class="cl4-series-card" data-series-id="${esc(s.id)}">
      <span class="cl4-series-year">${esc(String(s.startDate || "").slice(0, 4) || "—")}</span>
      <strong>${esc(s.title || "Untitled series")}</strong>
      <span>${s.issueCount ? `${esc(s.issueCount)} issues` : "Issue count pending"}</span>
      <i>Open series →</i>
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

function openStoryMap(container) {
  const sm = window.__comicsStoryMap;
  const uniId = container.querySelector("#cl4UniverseName")?.dataset?.universeId;
  if (sm && uniId) sm.open("universe", uniId);
}

function wireExplore(container, key) {
  if (key === "character") openExplorerAt("characterList", "Characters", {});
  else if (key === "era") openExplorerAt("continuityList", "Continuities", {});
  else if (key === "paths") openExplorerAt("readingPathList", "Reading Paths", {});
  else if (key === "storymap") openStoryMap(container);
}

function renderLoadedState(container, d) {
  const universe = d.universes[0] || null;
  const new52 = findNew52(d.continuities);
  const sortedContinuities = [...d.continuities].sort((a, b) => firstYear(a.startDate) - firstYear(b.startDate));

  const set = (id, value) => { const el = container.querySelector(`#${id}`); if (el) el.textContent = value; };
  set("cl4StatSeries", d.series.length.toLocaleString());
  set("cl4StatIssues", countIssues(d.series).toLocaleString());
  set("cl4StatCharacters", d.characters.length.toLocaleString());
  set("cl4StatContinuities", d.continuities.length.toLocaleString());
  set("cl4HeroMeta", universe ? `${d.continuities.length} continuities · ${d.series.length} series mapped` : "Current Comics graph");

  const uniName = container.querySelector("#cl4UniverseName");
  if (uniName && universe) { uniName.textContent = universe.name || "DC Universe"; uniName.dataset.universeId = universe.id; }
  set("cl4ContinuityPreview", d.continuities.length ? d.continuities.slice(0, 3).map(continuityLabel).join(" · ") : "No continuities mapped");
  set("cl4CharacterPreview", d.characters.length ? `${d.characters.length} characters in the current graph` : "No characters mapped");
  set("cl4PathPreview", d.readingPaths.length ? `${d.readingPaths.length} curated path${d.readingPaths.length === 1 ? "" : "s"}` : "No paths mapped yet");
  set("cl4AtlasEra", sortedContinuities.length ? continuityLabel(sortedContinuities[sortedContinuities.length - 1]) : "—");
  set("cl4AtlasCharacters", d.characters.length.toLocaleString());
  set("cl4AtlasSeries", d.series.length.toLocaleString());

  const n52Btn = container.querySelector("#cl4New52Btn");
  if (n52Btn && new52) {
    n52Btn.disabled = false;
    n52Btn.dataset.continuityId = new52.id;
    n52Btn.dataset.continuityName = new52.name;
    const n52Series = d.series.filter(s => Array.isArray(s.continuityIds) && s.continuityIds.includes(new52.id));
    set("cl4New52Sub", `${n52Series.length} mapped series · ${countIssues(n52Series).toLocaleString()} mapped issues`);
  } else set("cl4New52Sub", "New 52 continuity is not mapped in the current dataset yet.");

  renderEraTrack(container.querySelector("#cl4EraTrack"), d.continuities);
  renderRuns(container.querySelector("#cl4RunGrid"), d.runs);
  renderSeriesRail(container.querySelector("#cl4SeriesRail"), d.series);
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
    ${universeHtml()}
    ${timelineHtml()}
    ${new52Html()}
    ${runsHtml()}
    ${seriesHtml()}
    ${catalogueHtml()}
    <div class="cl4-continue" id="clContinue" hidden></div>
  </div>`;

  const continueSlot = container.querySelector("#clContinue");
  renderContinueCard(continueSlot).then(() => {
    if (!continueSlot?.isConnected) return;
    const start = continueSlot.querySelector('[data-state="start"]');
    if (start) { continueSlot.hidden = true; continueSlot.innerHTML = ""; }
  }).catch(e => console.warn("[Comics landing] continue card", e));

  container.querySelectorAll("[data-explore]").forEach(btn => btn.addEventListener("click", () => wireExplore(container, btn.dataset.explore)));
  container.querySelectorAll("[data-action]").forEach(btn => btn.addEventListener("click", () => {
    const action = btn.dataset.action;
    if (action === "storymap") openStoryMap(container);
    else if (action === "series") openExplorerAt("seriesList", "Series", {});
  }));

  container.querySelector("#cl4New52Btn")?.addEventListener("click", e => {
    const id = e.currentTarget.dataset.continuityId;
    const name = e.currentTarget.dataset.continuityName || "The New 52";
    if (id) loadHomeData().then(d => {
      const continuity = d.continuities.find(c => c.id === id);
      if (continuity) openExplorerAt("continuity", name, { continuity });
    });
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
  if (slot?.isConnected) renderContinueCard(slot).catch(() => {});
});

window.__comicsV2Landing = { render: renderSafe, preload: loadHomeData };
document.dispatchEvent(new CustomEvent("comicsv2:landing-ready"));
