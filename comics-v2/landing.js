// ALLABOUTDC — DC Comics landing page (Phase 1 redesign: "The DC Universe").
// Self-contained UI: no Firestore dependency on load. The explorer / data modules load only when a navigation action is tapped.
const openExplorer = async (level, label, params = {}) => {
  try {
    const mod = await import(`./explorer.js?v=dc36`);
    const openAt = mod.openComicsExplorerAt || window.__comicsExplorer?.openAt;
    if (typeof openAt !== "function") throw new Error("Comics Explorer entry point unavailable");
    openAt([{ level, label, params }]);
  } catch (e) {
    console.error("[Comics landing] Explorer failed to open", e);
  }
};

function openAtlas(){
  // openMap(type, id, opts) requires an id to resolve the root entity (storymap.js's
  // resolveRoot() does `COL_BY_TYPE[type]` then looks up that id — an undefined id
  // means the lookup fails and the map shows "Couldn't load the story map"). The seed
  // builds the one DC Universe record's id as slug.buildUniverseId("DC Universe"),
  // which is "dc-universe" — matching explorer.js's own root-level Story Map tile,
  // which already passes this id correctly (`window.__comicsStoryMap?.open?.("universe", u?.id)`).
  window.__comicsStoryMap?.open?.("universe", "dc-universe");
}

// The New 52 Era Hub opens over the Atlas (explorer root stays one tap away via the "Comics" crumb); its Back arrow closes the explorer and lands on the Atlas.
const ERA_HUB = "eraHub";

// Opening the hub adds one history entry (plus one per explorer level pushed above it, see explorer.js), so browser Back steps up one level at a time and the last Back lands on the Atlas; closing from the UI removes all of those entries again.
function pushExplorerEntry(){
  try { if (!(history.state && history.state.cxhExplorer)) history.pushState({ ...(history.state || {}), cxhExplorer: true }, "", location.href); } catch (e) { /* ignore */ }
}
(function watchExplorerClose(){
  const sheet = document.getElementById("comicsExplorerSheet");
  if (!sheet || typeof MutationObserver === "undefined") return;
  new MutationObserver(() => {
    if (sheet.dataset.open !== "true" && history.state && history.state.cxhExplorer) { try { history.go(-(1 + (history.state.cxe || 0))); } catch (e) { /* ignore */ } }
  }).observe(sheet, { attributes: true, attributeFilter: ["data-open"] });
})();

/** Event Hub (Phase 5): generic — the id alone picks the record; the hub itself loads it (Firestore, else the bundled owner definition). Same history pattern as openNew52. */
async function openEvent(eventId, title){
  try {
    const mod = await import(`./explorer.js?v=dc36`);
    const openAt = mod.openComicsExplorerAt || window.__comicsExplorer?.openAt;
    if (typeof openAt !== "function") throw new Error("Comics Explorer entry point unavailable");
    pushExplorerEntry();
    openAt([{ level: "event", label: title || "Event", params: { eventId, exitOnBack: true } }]);
  } catch (e) { console.error("[Comics landing] Event hub failed to open", e); }
}

/** New 52 Era Hub: resolves the existing New 52 continuity record (no new record is created). The lookup runs on tap only, never on load. */
async function openNew52(){
  try {
    const [mod, data] = await Promise.all([import(`./explorer.js?v=dc36`), import(`./data.js?v=dc5`)]);
    const openAt = mod.openComicsExplorerAt || window.__comicsExplorer?.openAt;
    if (typeof openAt !== "function") throw new Error("Comics Explorer entry point unavailable");
    const all = await data.getAllContinuities(50);
    const ct = all.find(c => /new\s*52/i.test(`${c.shortName || ""} ${c.name || ""}`));
    if (!ct) throw new Error("New 52 continuity not found");
    pushExplorerEntry();
    openAt([{ level: ERA_HUB, label: ct.name, params: { continuity: ct, exitOnBack: true } }]);
  } catch (e) {
    console.warn("[Comics landing] New 52 lookup failed — using the era list", e);
    pushExplorerEntry();
    try {
      const mod = await import(`./explorer.js?v=dc36`);
      const openAt = mod.openComicsExplorerAt || window.__comicsExplorer?.openAt;
      if (typeof openAt === "function") openAt([{ level: "continuityList", label: "Continuity / Era", params: {} }]);
    } catch (e2) { console.error("[Comics landing] Explorer failed to open", e2); }
  }
}

// Atlas journey — semantics, labels and navigation live here, never in filenames.
// "era" = an era card; "transition" = a bridge event between two eras (rendered as a rupture, never as an equivalent era card).
// Only New 52 has a destination (action "new52"); every other node is a visual node. No dates are invented.
const ATLAS_DIR = "./assets/atlas/";
const JOURNEY = [
  { type: "era", id: "golden-age", name: "Golden Age", file: "01-golden-age.webp" },
  { type: "era", id: "silver-age", name: "Silver Age", file: "02-silver-age.webp" },
  { type: "era", id: "bronze-age", name: "Bronze Age", file: "03-bronze-age.webp" },
  { type: "era", id: "crisis-transition", name: "Crisis / Transition", file: "04-crisis-transition.webp" },
  { type: "era", id: "post-crisis", name: "Post-Crisis", sub: "Pre-Flashpoint", file: "05-post-crisis.webp" },
  { type: "transition", id: "flashpoint", name: "Flashpoint", kind: "Transition Event", file: "06-flashpoint.webp" },
  { type: "era", id: "new52", name: "New 52", years: "2011 — 2016", file: "07-new-52.webp", action: "new52" },
  { type: "era", id: "rebirth", name: "Rebirth", file: "08-rebirth.webp" },
  { type: "era", id: "infinite-frontier", name: "Infinite Frontier", file: "09-infinite-frontier.webp" },
  { type: "era", id: "dawn-of-dc", name: "Dawn of DC", file: "10-dawn-of-dc.webp" },
  { type: "era", id: "current-era", name: "Current Era", file: "11-current-era.webp" },
];
const assetUrl = f => new URL(ATLAS_DIR + f + "?v=1", import.meta.url).href;
const HERO_SRC = new URL("./assets/hero-dc-universe.webp?v=2", import.meta.url).href;

const reduced = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

/* ---------------- Stage 1 — the gateway ---------------- */
function gatewayHtml(){
  return `<div class="cxh cxh-gateway">
   <section class="cxh-gate" aria-labelledby="cxh-hero-title">
    <div class="cxh-art" aria-hidden="true"><img src="${HERO_SRC}" alt="" width="1376" height="768" decoding="async" fetchpriority="high"></div>
    <div class="cxh-in cxh-gate-copy">
     <div class="cxh-kicker">ALLABOUTDC • COMICS</div>
     <h2 class="cxh-title" id="cxh-hero-title">THE DC UNIVERSE</h2>
     <p class="cxh-tag"><span>Every World.</span><span>Every Era.</span><span>Every Story.</span></p>
     <button type="button" class="cxh-btn" data-go="enter">ENTER THE UNIVERSE</button>
    </div>
   </section>
  </div>`;
}

/* ---------------- Stage 2 — the DC Universe Atlas (one config-driven journey: vertical on phones/tablets, horizontal on desktop) ---------------- */
function nodeHtml(it, i){
  const img = `<img src="${assetUrl(it.file)}" alt="" width="1122" height="1402" decoding="async" loading="${i === 0 ? "eager" : "lazy"}">`;
  if (it.type === "transition") {
    return `<li class="cxh-node cxh-rupture" data-id="${it.id}" aria-label="${it.kind}: ${it.name}">
     <div class="cxh-rup-art" aria-hidden="true">${img}</div>
     <div class="cxh-rup-body"><span class="cxh-rup-kind">${it.kind}</span><h3 class="cxh-rup-name">${it.name}</h3><span class="cxh-rup-open" aria-hidden="true">OPEN EVENT →</span></div>
     <button type="button" class="cxh-rup-hit" data-go="event" data-event="${it.id}" data-title="${it.name}" aria-label="${it.name} — ${it.kind}. Open the event hub"></button>
    </li>`;
  }
  const live = !!it.action;
  const head = `<h3 class="cxh-pname">${it.name}</h3>${it.sub ? `<p class="cxh-sub">${it.sub}</p>` : ""}${it.years ? `<p class="cxh-years">${it.years}</p>` : ""}`;
  const cta = live ? `<button type="button" class="cxh-cta" data-go="${it.action}" aria-label="Explore ${it.name}">EXPLORE ${it.name.toUpperCase()} →</button>` : "";
  return `<li class="cxh-node cxh-era${live ? " cxh-era-live" : ""}" data-id="${it.id}">
   <div class="cxh-card"><div class="cxh-card-art" aria-hidden="true">${img}</div><div class="cxh-card-body">${head}${cta}</div></div>
  </li>`;
}

function atlasHtml(){
  return `<div class="cxh cxh-atlasview">
   <section class="cxh-atlas" aria-labelledby="cxh-atlas-title">
    <div class="cxh-atlas-top cxh-in">
     <button type="button" class="cxh-back" data-go="back" aria-label="Back to Comics home">← COMICS</button>
     <h2 class="cxh-atlas-kicker" id="cxh-atlas-title">DC UNIVERSE ATLAS</h2>
    </div>
    <div class="cxh-stage">
     <div class="cxh-track" role="region" aria-label="DC Universe timeline, oldest to newest">
      <ol class="cxh-journey">${JOURNEY.map(nodeHtml).join("")}</ol>
     </div>
     <button type="button" class="cxh-nav cxh-prev" data-go="prev" aria-label="Earlier eras">‹</button>
     <button type="button" class="cxh-nav cxh-next" data-go="next" aria-label="Later eras">›</button>
    </div>
   </section>
  </div>`;
}

let host = null, atlasOpen = false, onResize = null;

function showGateway(){
  if (!host || !host.isConnected) return;
  atlasOpen = false;
  if (onResize) { window.removeEventListener("resize", onResize); onResize = null; }
  host.innerHTML = gatewayHtml();
  host.querySelector("[data-go='enter']").addEventListener("click", enterAtlas);
}

function enterAtlas(){
  if (!host || !host.isConnected) return;
  atlasOpen = true;
  try { history.pushState({ ...(history.state || {}), cxhAtlas: true }, "", location.href); } catch (e) { /* ignore */ }
  host.innerHTML = atlasHtml();
  window.scrollTo(0, 0);
  wireAtlas(host);
}

function wireAtlas(root){
  const track = root.querySelector(".cxh-track");
  const horizontal = () => track.scrollWidth > track.clientWidth + 4 && getComputedStyle(root.querySelector(".cxh-journey")).flexDirection === "row";
  const step = dir => {
    const w = (root.querySelector(".cxh-card")?.offsetWidth || 300) + 48;
    track.scrollBy({ left: dir * w, behavior: reduced() ? "auto" : "smooth" });
  };
  const sync = () => {
    const h = horizontal(); if (h) track.setAttribute("tabindex", "0"); else track.removeAttribute("tabindex");
    const max = track.scrollWidth - track.clientWidth - 2;
    root.querySelector(".cxh-prev").hidden = !h || track.scrollLeft <= 2;
    root.querySelector(".cxh-next").hidden = !h || track.scrollLeft >= max;
  };
  let raf = 0;
  track.addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); }, { passive: true });
  if (onResize) window.removeEventListener("resize", onResize);
  onResize = sync; window.addEventListener("resize", onResize);
  track.addEventListener("keydown", e => {
    if (!horizontal()) return;
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
  });
  requestAnimationFrame(sync);

  root.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => {
    const a = b.dataset.go;
    if (a === "prev") return step(-1);
    if (a === "next") return step(1);
    if (a === "back") { if (history.state && history.state.cxhAtlas) { history.back(); } else { showGateway(); } return; }
    if (a === "event") {
      if (b.dataset.busy) return;
      b.dataset.busy = "1";
      return openEvent(b.dataset.event, b.dataset.title).finally(() => setTimeout(() => { delete b.dataset.busy; }, 400));
    }
    if (a === "new52") {
      if (b.dataset.busy) return;
      b.dataset.busy = "1"; b.setAttribute("aria-busy", "true"); b.classList.add("is-pressed");
      return openNew52().finally(() => setTimeout(() => { delete b.dataset.busy; b.removeAttribute("aria-busy"); b.classList.remove("is-pressed"); }, 400));
    }
  }));
  const h = root.querySelector("#cxh-atlas-title");
  if (h) { h.setAttribute("tabindex", "-1"); try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
}

window.addEventListener("popstate", () => {
  if (atlasOpen && host && host.isConnected && !(history.state && history.state.cxhAtlas)) showGateway();
});

function render(container){
  host = container; atlasOpen = false;
  showGateway();
}

window.__comicsV2Landing = { render };
document.dispatchEvent(new CustomEvent("comicsv2:landing-ready"));
