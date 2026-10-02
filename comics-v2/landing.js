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

/** New 52 continuity: same navigation the era list uses (era list → continuity page). The lookup runs on tap only, never on load. */
async function openNew52(){
  try {
    const [mod, data] = await Promise.all([import(`./explorer.js?v=dc24`), import(`./data.js?v=dc3`)]);
    const openAt = mod.openComicsExplorerAt || window.__comicsExplorer?.openAt;
    if (typeof openAt !== "function") throw new Error("Comics Explorer entry point unavailable");
    const all = await data.getAllContinuities(50);
    const ct = all.find(c => /new\s*52/i.test(`${c.shortName || ""} ${c.name || ""}`));
    if (!ct) throw new Error("New 52 continuity not found");
    openAt([{ level: "continuityList", label: "Continuity / Era", params: {} }, { level: "continuity", label: ct.name, params: { continuity: ct } }]);
  } catch (e) {
    console.warn("[Comics landing] New 52 lookup failed — using the era list", e);
    return openExplorer("continuityList", "Continuity / Era");
  }
}

const ERAS = ["Golden Age", "Silver Age", "Bronze Age", "Crisis / Transition", "Post-Crisis", "Flashpoint", "NEW 52", "Rebirth", "Infinite Frontier", "Dawn of DC", "Current Era"];
const GAP_BEFORE = new Set(["Crisis / Transition", "Flashpoint", "Rebirth"]); // chapter breathing room
const CHAIN = ["Flashpoint", "New 52", "Major Events", "Darkseid War", "Convergence", "Rebirth"];
const HERO_SRC = new URL("./assets/hero-dc-universe.webp?v=1", import.meta.url).href;

const reduced = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

function scrollToEl(el){
  if (!el) return;
  const header = document.querySelector("header");
  const offset = header ? header.getBoundingClientRect().bottom : 0;
  const top = el.getBoundingClientRect().top + window.scrollY - Math.max(0, offset) - 8;
  window.scrollTo({ top: Math.max(0, top), behavior: reduced() ? "auto" : "smooth" });
  const h = el.querySelector("h2");
  if (h) { h.setAttribute("tabindex", "-1"); try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
}

function render(container){
  const eras = ERAS.map(name => {
    const gap = GAP_BEFORE.has(name) ? " cxh-gap" : "";
    if (name === "NEW 52") return `<li class="cxh-era cxh-era-live${gap}"><button type="button" class="cxh-era-btn" data-go="new52-section" aria-controls="cxh-new52"><span class="cxh-era-name">NEW 52</span><span class="cxh-vh"> — jump to the New 52 section</span></button></li>`;
    return `<li class="cxh-era${gap}"><span class="cxh-era-name">${name}</span></li>`;
  }).join("");
  const chain = CHAIN.map(s => `<li>${s}</li>`).join("");
  container.innerHTML = `<div class="cxh">
   <section class="cxh-hero" aria-labelledby="cxh-hero-title">
    <div class="cxh-art" aria-hidden="true"><img src="${HERO_SRC}" alt="" width="1376" height="768" decoding="async" fetchpriority="high"></div>
    <div class="cxh-in">
     <div class="cxh-kicker">ALLABOUTDC • COMICS</div>
     <h2 class="cxh-title" id="cxh-hero-title">THE DC<br>UNIVERSE</h2>
     <p class="cxh-tag"><span>Every World.</span><span>Every Era.</span><span>Every Story.</span></p>
     <button type="button" class="cxh-btn" data-go="universe">ENTER THE UNIVERSE</button>
    </div>
   </section>
   <section class="cxh-universe" id="cxh-universe" aria-labelledby="cxh-universe-title">
    <div class="cxh-in">
     <h2 class="cxh-h2" id="cxh-universe-title">THE UNIVERSE</h2>
     <ol class="cxh-spine" aria-label="DC timeline">${eras}</ol>
    </div>
   </section>
   <section class="cxh-new52" id="cxh-new52" aria-labelledby="cxh-new52-title">
    <span class="cxh-mark" aria-hidden="true">52</span>
    <div class="cxh-in">
     <h2 class="cxh-big" id="cxh-new52-title">NEW 52</h2>
     <p class="cxh-years">2011 — 2016</p>
     <ol class="cxh-chain" aria-label="The New 52 journey">${chain}</ol>
     <button type="button" class="cxh-cta" data-go="new52">EXPLORE NEW 52 →</button>
    </div>
   </section>
   <section class="cxh-explore" aria-labelledby="cxh-explore-title">
    <div class="cxh-in">
     <h2 class="cxh-h2" id="cxh-explore-title">EXPLORE THE UNIVERSE</h2>
     <div class="cxh-rows">
      <button type="button" class="cxh-row" data-go="characters"><span class="cxh-row-t">CHARACTERS</span><span class="cxh-row-d">Follow your favourite characters across every era.</span><span class="cxh-row-a" aria-hidden="true">→</span></button>
      <button type="button" class="cxh-row" data-go="atlas"><span class="cxh-row-t">STORIES &amp; EVENTS</span><span class="cxh-row-d">Crossovers, events and how the stories connect.</span><span class="cxh-row-a" aria-hidden="true">→</span></button>
      <button type="button" class="cxh-row" data-go="series"><span class="cxh-row-t">SERIES &amp; RUNS</span><span class="cxh-row-d">Every mapped publication line, run by run.</span><span class="cxh-row-a" aria-hidden="true">→</span></button>
     </div>
     <button type="button" class="cxh-link" data-go="series">Browse all comics</button>
    </div>
   </section>
  </div>`;
  const root = container.querySelector(".cxh");

  container.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => {
    const a = b.dataset.go;
    if (a === "universe") return scrollToEl(root.querySelector("#cxh-universe"));
    if (a === "new52-section") return scrollToEl(root.querySelector("#cxh-new52"));
    if (a === "new52") {
      if (b.dataset.busy) return;
      b.dataset.busy = "1"; b.setAttribute("aria-busy", "true"); b.classList.add("is-pressed");
      return openNew52().finally(() => setTimeout(() => { delete b.dataset.busy; b.removeAttribute("aria-busy"); b.classList.remove("is-pressed"); }, 400));
    }
    if (a === "characters") return openExplorer("characterList", "Characters");
    if (a === "series") return openExplorer("seriesList", "Series");
    if (a === "atlas") return openAtlas();
  }));

  // Subtle scroll-reactive reveal of the spine. Without IntersectionObserver (or with reduced motion) everything simply stays visible.
  if (!reduced() && "IntersectionObserver" in window) {
    root.classList.add("cxh-anim");
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.2 });
    root.querySelectorAll(".cxh-era, .cxh-chain li, .cxh-row").forEach(el => io.observe(el));
  }
}

window.__comicsV2Landing = { render };
document.dispatchEvent(new CustomEvent("comicsv2:landing-ready"));
