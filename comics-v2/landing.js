// ============================================================================
// comics-v2 / landing.js
// STEP 4B-1 — Comics Home information-architecture cleanup.
//
// This pass deliberately changes ONLY the Comics Home presentation and its
// existing entry points. No routing, Story Map, Explorer, data or catalogue
// implementation is changed.
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
    data.getAllReadingPaths(20),
  ]).then(([universes, continuities, characters, series, readingPaths]) => ({
    universes, continuities, characters, series, readingPaths, ok: true,
  })).catch(e => {
    console.warn("[Comics landing] data load", e);
    _dataPromise = null;
    return { universes: [], continuities: [], characters: [], series: [], readingPaths: [], ok: false };
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
    <section class="cl4-hero cl4-hero-compact">
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
        <div class="cl4-hero-sub">A connected way to explore DC Comics — from characters and series to eras, stories and issues.</div>
        <div class="cl4-hero-actions">
          <button class="cl4-primary" data-action="storymap">Enter the Universe Atlas <b>→</b></button>
          <button class="cl4-secondary" data-explore="paths">Start Reading</button>
        </div>
      </div>
      <div class="cl4-hero-side">
        <span>THE COMICS UNIVERSE</span>
        <strong id="cl4HeroMeta">Loading…</strong>
        <small>The same underlying Comics graph powers every view.</small>
      </div>
    </section>`;
}

function exploreHtml() {
  const entries = [
    { key: "character", icon: "✦", label: "Characters", sub: "Follow a hero, villain or legacy.", tone: "blue" },
    { key: "series", icon: "▣", label: "Series & Runs", sub: "Find the books and creative runs.", tone: "gold" },
    { key: "paths", icon: "⌁", label: "Reading Paths", sub: "Follow a curated way in.", tone: "red" },
  ];
  return `<section class="cl4-section cl4-explore-section">
    <div class="cl4-section-head"><div><div class="cl4-kicker">START HERE</div><h3>Choose your starting point</h3></div><span>Three useful lenses</span></div>
    <div class="cl4-explore-grid cl4-explore-grid-three">
      ${entries.map((e, i) => `<button class="cl4-explore-card cl4-tone-${e.tone}" data-explore="${e.key}">
        <span class="cl4-explore-number">0${i + 1}</span>
        <span class="cl4-explore-icon">${e.icon}</span>
        <span class="cl4-explore-copy"><strong>${esc(e.label)}</strong><small>${esc(e.sub)}</small></span>
        <span class="cl4-arrow">→</span>
      </button>`).join("")}
    </div>
  </section>`;
}

function atlasHtml() {
  return `<section class="cl4-section cl4-atlas-section cl4-atlas-single">
    <div class="cl4-section-head"><div><div class="cl4-kicker">THE UNIVERSE</div><h3>One Atlas</h3></div><span>One graph · one destination</span></div>
    <button class="cl4-atlas-visual cl4-atlas-visual-wide" data-action="storymap" aria-label="Open Universe Atlas">
      <div class="cl4-atlas-grid"></div>
      <div class="cl4-atlas-line cl4-line-1"></div><div class="cl4-atlas-line cl4-line-2"></div><div class="cl4-atlas-line cl4-line-3"></div>
      <div class="cl4-atlas-node cl4-node-core"><span>DC</span><small>UNIVERSE</small></div>
      <div class="cl4-atlas-node cl4-node-era"><b>ERAS</b><span id="cl4AtlasEra">Loading</span></div>
      <div class="cl4-atlas-node cl4-node-character"><b>CHARACTERS</b><span id="cl4AtlasCharacters">—</span></div>
      <div class="cl4-atlas-node cl4-node-series"><b>SERIES</b><span id="cl4AtlasSeries">—</span></div>
      <div class="cl4-atlas-node cl4-node-new52"><b>NEW 52</b><span>territory</span></div>
      <div class="cl4-atlas-watermark">ENTER ATLAS →</div>
    </button>
    <div class="cl4-atlas-caption">
      <div><strong>Era → Event → Character → Series → Issue</strong><span>Explore the relationships from one place instead of opening separate versions of the same map.</span></div>
      <button class="cl4-text-btn" data-action="storymap">Open Universe Atlas →</button>
    </div>
  </section>`;
}

function territoryHtml() {
  return `<section class="cl4-section">
    <div class="cl4-section-head"><div><div class="cl4-kicker">FEATURED TERRITORY</div><h3>The New 52</h3></div><span id="cl4New52Status">Current mapped coverage</span></div>
    <button class="cl4-new52" id="cl4New52Btn" disabled>
      <div class="cl4-new52-art"><span>52</span><i></i><i></i><i></i></div>
      <div class="cl4-new52-copy">
        <span class="cl4-mini-kicker">2011 · EARTH-0</span>
        <strong>The New 52</strong>
        <span id="cl4New52Sub">Loading current coverage…</span>
        <small>Our most deeply populated territory right now. Explore it as a connected part of the wider Comics graph.</small>
      </div>
      <span class="cl4-new52-arrow">Explore territory <b>→</b></span>
    </button>
  </section>`;
}

function seriesHtml() {
  return `<section class="cl4-section">
    <div class="cl4-section-head"><div><div class="cl4-kicker">FEATURED BOOKS</div><h3>Start with a series</h3></div><button class="cl4-text-btn" data-action="series">Browse series →</button></div>
    <div class="cl4-series-rail" id="cl4SeriesRail"><div class="cl4-loading-line">Loading current series…</div></div>
  </section>`;
}

function renderSeriesRail(container, series) {
  if (!container) return;
  const sorted = [...(series || [])].sort((a, b) => firstYear(a.startDate) - firstYear(b.startDate));
  if (!sorted.length) {
    container.innerHTML = `<div class="cl4-empty">No series have been mapped yet.</div>`;
    return;
  }
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
  else if (sm) {
    loadHomeData().then(d => {
      const universe = d.universes[0];
      if (universe) sm.open("universe", universe.id);
    });
  }
}

function wireExplore(container, key) {
  if (key === "character") openExplorerAt("characterList", "Characters", {});
  else if (key === "series") openExplorerAt("seriesList", "Series", {});
  else if (key === "paths") openExplorerAt("readingPathList", "Reading Paths", {});
}

function renderLoadedState(container, d) {
  const universe = d.universes[0] || null;
  const new52 = findNew52(d.continuities);
  const sortedContinuities = [...d.continuities].sort((a, b) => firstYear(a.startDate) - firstYear(b.startDate));
  const set = (id, value) => { const el = container.querySelector(`#${id}`); if (el) el.textContent = value; };

  set("cl4HeroMeta", universe ? `${d.series.length} series · ${countIssues(d.series).toLocaleString()} issues mapped` : "Current Comics graph");
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
  } else {
    set("cl4New52Sub", "New 52 continuity is not mapped in the current dataset yet.");
  }

  renderSeriesRail(container.querySelector("#cl4SeriesRail"), d.series);
}

let renderSeq = 0;

function renderComicsLanding(container, hooks = {}) {
  const my = ++renderSeq;
  const main = container.closest("main");
  if (main) main.classList.add("comics-home-main");

  container.innerHTML = `<div class="cl4-wrap cl4-home-ia">
    ${heroHtml()}
    ${exploreHtml()}
    ${atlasHtml()}
    ${territoryHtml()}
    ${seriesHtml()}
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

  // The old flat catalogue is intentionally NOT promoted on this Home pass.
  // It remains reachable through the existing app catalogue flow while the
  // future Comics Library is designed as a proper Series → Run → Issue →
  // Collection experience.
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
