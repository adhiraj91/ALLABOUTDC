// ALLABOUTDC — DC Comics landing page (Phase 1 redesign: "The DC Universe").
// Self-contained UI: no Firestore dependency on load. The explorer / data modules load only when a navigation action is tapped.
const openExplorer = async (level, label, params = {}) => {
  try {
    const mod = await import(`./explorer.js?v=dc24`);
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

// The explorer's own stack, so Back from the New 52 page walks through the existing era list and the existing Comics explorer root (Characters, Story Map, Series).
const ROOT_LEVEL = { level: "root", label: "Comics", params: {} };
const ERA_LEVEL = { level: "continuityList", label: "Continuity / Era", params: {} };

/** New 52 continuity: same navigation the era list uses (era list → continuity page). The lookup runs on tap only, never on load. */
async function openNew52(){
  try {
    const [mod, data] = await Promise.all([import(`./explorer.js?v=dc24`), import(`./data.js?v=dc3`)]);
    const openAt = mod.openComicsExplorerAt || window.__comicsExplorer?.openAt;
    if (typeof openAt !== "function") throw new Error("Comics Explorer entry point unavailable");
    const all = await data.getAllContinuities(50);
    const ct = all.find(c => /new\s*52/i.test(`${c.shortName || ""} ${c.name || ""}`));
    if (!ct) throw new Error("New 52 continuity not found");
    openAt([ROOT_LEVEL, ERA_LEVEL, { level: "continuity", label: ct.name, params: { continuity: ct } }]);
  } catch (e) {
    console.warn("[Comics landing] New 52 lookup failed — using the era list", e);
    try {
      const mod = await import(`./explorer.js?v=dc24`);
      const openAt = mod.openComicsExplorerAt || window.__comicsExplorer?.openAt;
      if (typeof openAt === "function") openAt([ROOT_LEVEL, ERA_LEVEL]);
    } catch (e2) { console.error("[Comics landing] Explorer failed to open", e2); }
  }
}

const ERAS = [
  { n: "Golden Age",          a: "#3a2a12", b: "#14110d", g: "rgba(214,160,60,.34)" },
  { n: "Silver Age",          a: "#252e3c", b: "#12141a", g: "rgba(150,175,205,.30)" },
  { n: "Bronze Age",          a: "#3a2216", b: "#14100e", g: "rgba(200,120,70,.32)" },
  { n: "Crisis / Transition", a: "#3a1519", b: "#120d0f", g: "rgba(215,60,60,.34)" },
  { n: "Post-Crisis",         a: "#1c2142", b: "#10111a", g: "rgba(110,120,230,.32)" },
  { n: "Flashpoint",          a: "#43200f", b: "#130e0d", g: "rgba(255,110,40,.40)" },
  { n: "NEW 52", live: true,  a: "#12263f", b: "#2a170c", g: "rgba(224,172,43,.34)" },
  { n: "Rebirth",             a: "#352c14", b: "#13120e", g: "rgba(240,205,110,.30)" },
  { n: "Infinite Frontier",   a: "#14303a", b: "#0f1318", g: "rgba(70,190,210,.30)" },
  { n: "Dawn of DC",          a: "#3a2418", b: "#12151f", g: "rgba(255,150,90,.32)" },
  { n: "Current Era",         a: "#232733", b: "#111218", g: "rgba(160,170,200,.26)" },
];
const LIVE_INDEX = ERAS.findIndex(e => e.live);
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

/* ---------------- Stage 2 — the DC Universe Atlas (horizontal era journey) ---------------- */
function atlasHtml(){
  const panels = ERAS.map((e, i) => {
    const num = String(i + 1).padStart(2, "0");
    const style = `--ea:${e.a};--eb:${e.b};--eg:${e.g}`;
    if (e.live) return `<li class="cxh-panel cxh-panel-live" style="${style}" data-i="${i}"><span class="cxh-ord" aria-hidden="true">${num}</span><span class="cxh-mark" aria-hidden="true">52</span><div class="cxh-pbody"><h3 class="cxh-pname">NEW 52</h3><p class="cxh-years">2011 — 2016</p><button type="button" class="cxh-cta" data-go="new52">EXPLORE NEW 52 →</button></div></li>`;
    return `<li class="cxh-panel" style="${style}" data-i="${i}"><span class="cxh-ord" aria-hidden="true">${num}</span><div class="cxh-pbody"><h3 class="cxh-pname">${e.n}</h3></div></li>`;
  }).join("");
  const ticks = ERAS.map((e, i) => `<span class="${e.live ? "is-live" : ""}" data-i="${i}"></span>`).join("");
  return `<div class="cxh cxh-atlasview">
   <section class="cxh-atlas" aria-labelledby="cxh-atlas-title">
    <div class="cxh-atlas-top cxh-in">
     <button type="button" class="cxh-back" data-go="back" aria-label="Back to Comics home">← COMICS</button>
     <h2 class="cxh-atlas-kicker" id="cxh-atlas-title">DC UNIVERSE ATLAS</h2>
    </div>
    <div class="cxh-stage">
     <div class="cxh-track" tabindex="0" role="region" aria-label="DC eras. Swipe or use the arrow keys to move between eras.">
      <ol class="cxh-eras">${panels}</ol>
     </div>
     <button type="button" class="cxh-nav cxh-prev" data-go="prev" aria-label="Previous era">‹</button>
     <button type="button" class="cxh-nav cxh-next" data-go="next" aria-label="Next era">›</button>
    </div>
    <div class="cxh-prog" aria-hidden="true">${ticks}</div>
   </section>
  </div>`;
}

let host = null, atlasOpen = false;

function showGateway(){
  if (!host || !host.isConnected) return;
  atlasOpen = false;
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
  const panels = [...root.querySelectorAll(".cxh-panel")];
  const ticks = [...root.querySelectorAll(".cxh-prog span")];
  let active = -1;
  const centerOf = el => el.offsetLeft + el.offsetWidth / 2;
  const setActive = i => {
    if (i === active) return; active = i;
    panels.forEach((p, k) => p.classList.toggle("is-active", k === i));
    ticks.forEach((t, k) => t.classList.toggle("is-active", k === i));
  };
  const nearest = () => {
    const mid = track.scrollLeft + track.clientWidth / 2; let best = 0, d = Infinity;
    panels.forEach((p, k) => { const dd = Math.abs(centerOf(p) - mid); if (dd < d) { d = dd; best = k; } });
    return best;
  };
  let target = LIVE_INDEX, until = 0; // rapid taps stack on the pending target instead of the half-scrolled position
  const cur = () => (Date.now() < until ? target : nearest());
  const goTo = (i, smooth) => {
    i = Math.max(0, Math.min(panels.length - 1, i)); target = i; until = smooth && !reduced() ? Date.now() + 700 : 0;
    const p = panels[i];
    track.scrollTo({ left: centerOf(p) - track.clientWidth / 2, behavior: smooth && !reduced() ? "smooth" : "auto" });
  };
  let raf = 0;
  track.addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setActive(nearest())); }, { passive: true });
  track.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(cur() + 1, true); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); goTo(cur() - 1, true); }
  });
  // The Atlas opens on the one era that has data; the earlier and later eras stay partly visible on either side.
  requestAnimationFrame(() => { goTo(LIVE_INDEX, false); setActive(LIVE_INDEX); });

  root.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => {
    const a = b.dataset.go;
    if (a === "prev") return goTo(cur() - 1, true);
    if (a === "next") return goTo(cur() + 1, true);
    if (a === "back") { if (history.state && history.state.cxhAtlas) { history.back(); } else { showGateway(); } return; }
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
