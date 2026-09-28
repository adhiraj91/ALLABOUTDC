// ============================================================================
// comics-v2 / landing.js
// ----------------------------------------------------------------------------
// POINTER 4 (Comics Home) — restructured by POINTER 6.5.
//
// app.js owns the tab and simply asks this module to render into its #grid when
// the Comics tab is showing its landing (window.__comicsV2Landing.render). If this
// module hasn't loaded, app.js falls back to the old catalogue, so Comics never
// breaks. The old flat catalogue stays one tap away ("Browse all comics") but no
// longer dominates the first screen.
//
// Pointer 6.5 simplifies this page down to a small, fixed set of entry points —
// By Character / By Continuity-Era / Story Map / Reading Paths — plus a Continue
// Reading card shown ONLY when the reader has real progress, and a de-emphasized
// Browse All Comics link. The character rail / era rail / "Featured Story Maps"
// run rail and the old per-tile Story Map deep links this page used to render
// directly are gone: every one of those routes converged on the SAME Comics
// Explorer (comics-v2/explorer.js) and Story Map (comics-v2/storymap.js) screens
// that the four buttons below already reach, so removing them loses no
// destination — only the duplicate ways of getting there (the spec's "ONE
// Story Map entry point" / "ONE Character exploration route" / "ONE Era route"
// / "ONE Reading Paths destination" requirement).
// ============================================================================
import * as data from "./data.js?v=p65";
// Pointer 6: "Continue Reading" (or a data-driven "Start reading" point) at the top of Comics Home.
import { renderContinueCard } from "./reading-progress.js?v=p6";
import { new52Era, new52Series, new52Limited, new52CharacterIndex, new52ReadingPaths } from "./new52-map-data.js";

const esc = (s) => s == null ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Only what this page itself needs: the one DC universe, so the single Story
// Map entry point has a generic (never character-specific) root to open at.
// Nothing character/era/series/run-shaped is fetched here any more — those
// screens are the Explorer's job now.
let _dataPromise = null;
function loadLandingData() {
  if (_dataPromise) return _dataPromise;
  _dataPromise = data.getAllUniverses(5).then(
    (universes) => ({ universes, ok: true }),
    (e) => { console.warn("[Comics landing]", e); _dataPromise = null; return { universes: [], ok: false }; },
  );
  return _dataPromise;
}

function heroHtml() {
  return `
  <section class="cl-hero cl-hero-compact">
    <div class="cl-eyebrow">COMICS</div>
    <h2 class="cl-title">Explore DC Comics</h2>
    <p class="cl-lede">Through its stories, eras and reading journeys.</p>
  </section>
  <section class="cl-continue" id="clContinue" hidden></section>`;
}

// The four curated entry points (Pointer 6.5). Each opens the Explorer sheet
// directly at the relevant level, or (Story Map) the Story Map itself — every
// button below is the ONLY way this page links to that destination.
const EXPLORE_ENTRIES = [
  { key: "character", label: "By Character", sub: `${new52CharacterIndex.length} character lines · flagship heroes + logical family/team groups.` },
  { key: "era", label: "By Continuity / Era", sub: `The same chronological spine used by Story Map, with The New 52 as the researched world.` },
  { key: "storymap", label: "Story Map", sub: "Enter the immersive DC atlas: eras, worlds, lanes, events and runs." },
  { key: "paths", label: "Reading Paths", sub: `${new52ReadingPaths.length} routes built from the same New 52 lanes and crossover spine.` },
];
function exploreGridHtml() {
  const tiles = EXPLORE_ENTRIES.map(e => `
    <button class="cl-explore-tile" data-explore="${e.key}">
      <span class="cl-explore-label">${esc(e.label)}</span>
      <span class="cl-explore-sub">${esc(e.sub)}</span>
    </button>`).join("");
  return `<section class="cl-section" id="clExplore"><div class="cl-head"><h3>Explore</h3></div><div class="cl-explore-grid">${tiles}</div></section>`;
}

function catalogueCard(hooks) {
  const n = hooks && hooks.catalogueCount;
  // Pointer 6.5: the ONE "Browse All Comics" entry point on this page (kept as a secondary,
  // de-emphasized destination, not the default Comics experience) — id unchanged from Pointer 4
  // (#comicsBrowseAllBtn) since it's still the same single destination.
  return `<section class="cl-catalogue">
      <div><div class="cl-cat-t">Browse database comics</div><div class="cl-cat-s">${n ? `${n} database records · ` : ""}the broader Firestore catalogue. The researched New 52 map is the source for the four entry points above.</div></div>
      <button class="btn btn-ghost" id="comicsBrowseAllBtn">Browse database</button>
    </section>`;
}

// Pointer 6.5: "ONLY display [Continue Reading] when the user actually has comic
// progress" (Comics Home specifically — the run detail page has its own, separately
// correct, no-progress-no-button gating in explorer.js's levelRun). reading-progress.js's
// shared renderContinueCard() is reused UNCHANGED (Pointer 6), including its own
// data-driven "Start reading" nudge for a reader with zero progress — that nudge is
// exactly right inside a Character/Run screen the reader has already drilled into, but
// wrong as the very first thing Comics Home shows a reader who has done nothing yet.
// So: render it as usual, then hide it here if what came back was that "start" variant,
// rather than forking reading-progress.js's own resolveContinue() into two behaviors.
function showContinueCard(container) {
  if (!container) return;
  renderContinueCard(container).then(() => {
    if (!container.isConnected) return;
    const card = container.querySelector('[data-state="start"]');
    if (card) { container.hidden = true; container.innerHTML = ""; }
  }).catch(e => console.warn("[Comics landing] continue card", e));
}

let renderSeq = 0;
/**
 * Render the landing into `container` (app.js's #grid).
 * hooks: { catalogueCount, onBrowseAll(), onReadingPath() }
 */
export function renderComicsLanding(container, hooks = {}) {
  const my = ++renderSeq;
  container.innerHTML = `<div class="cl-wrap">${heroHtml()}
      ${exploreGridHtml()}
      ${catalogueCard(hooks)}
    </div>`;
  showContinueCard(container.querySelector("#clContinue"));
  loadLandingData().then(d => {
    if (my !== renderSeq || !container.isConnected) return;

  });
}

function onLandingClick(e) {
  const container = e.currentTarget;
  const hooks = container._clHooks || {};
  if (!container.querySelector(".cl-wrap")) return; // grid now shows something else
  const explore = e.target.closest("[data-explore]");
  if (explore) {
    const key = explore.dataset.explore;
    if (key === "storymap") {
      const sm = window.__comicsStoryMap;
      if (sm) sm.open();
      return;
    }
    const sm = window.__comicsStoryMap;
    if (sm) {
      if (key === "character") sm.open("characters");
      else if (key === "era") sm.open("continuity");
      else if (key === "paths") sm.open("paths");
      else if (key === "storymap") sm.open("universe");
    }
    return;
  }
  if (e.target.closest("#comicsBrowseAllBtn, [data-browse-all]")) { if (hooks.onBrowseAll) hooks.onBrowseAll(); return; }
}

// The grid element is reused across tabs, so the delegated listener is attached once per element.
const _wired = new WeakSet();
function renderSafe(container, hooks) {
  if (!_wired.has(container)) { _wired.add(container); container.addEventListener("click", onLandingClick); }
  container._clHooks = hooks;
  renderComicsLanding(container, hooks);
}

// Progress changed (Explorer, Story Map, login merge …) while Comics Home is showing: refresh just the card.
document.addEventListener("readerprogress:change", () => {
  const slot = document.getElementById("clContinue");
  if (slot && slot.isConnected) showContinueCard(slot);
});

window.__comicsV2Landing = { render: renderSafe, preload: loadLandingData };
document.dispatchEvent(new CustomEvent("comicsv2:landing-ready"));
