// ALLABOUTDC — DC Comics landing page.
// Self-contained UI: no Firestore dependency. Explorer loads only when a navigation action is tapped.
const openExplorer = async (level, label, params = {}) => {
  try {
    const mod = await import(`./explorer.js?v=dc22`);
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

function render(container){
  container.innerHTML = `<div class="dcx-wrap">
   <section class="dcx-hero"><div class="dcx-hero-art"><span class="dcx-orbit a"></span><span class="dcx-orbit b"></span><span class="dcx-orbit c"></span><span class="dcx-hero-mark">DC</span></div><div class="dcx-hero-copy"><div class="dcx-kicker">EXPLORE</div><h2>DC <span>COMICS</span></h2><p>Every character. Every world. Every story.</p><small>Explore the complete DC universe as one connected catalogue.</small></div><div class="dcx-quote">“Comics are where it all begins.”<br><b>— DC</b></div></section>
   <section class="dcx-section"><div class="dcx-head"><h3>Start Exploring</h3><span>Different ways to dive into the DC universe</span></div><div class="dcx-start-grid">
    <button data-go="characters"><b>◉</b><strong>By Character</strong><small>Explore comics featuring your favourite characters</small><i>→</i></button>
    <button data-go="continuity"><b>▦</b><strong>By Continuity / Era</strong><small>From Golden Age to Modern Age. Explore the timeline.</small><i>→</i></button>
    <button data-go="atlas"><b>◎</b><strong>Story Map</strong><small>Visual map of universes, eras, characters and connections</small><i>→</i></button>
    <button data-go="series"><b>⌘</b><strong>Browse Series</strong><small>Explore every mapped publication line</small><i>→</i></button>
   </div></section>
   <button class="dcx-browse" data-go="series"><span>▱</span><div><strong>Browse All Comics</strong><small>Search and explore the complete DC comics catalogue</small></div><b>→</b></button>
  </div>`;
  container.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>{
    const a=b.dataset.go;
    if(a==="characters") return openExplorer("characterList","Characters");
    if(a==="continuity") return openExplorer("continuityList","Continuity / Era");
    if(a==="series") return openExplorer("seriesList","Series");
    if(a==="atlas") return openAtlas();
  }));
}

window.__comicsV2Landing = { render };
document.dispatchEvent(new CustomEvent("comicsv2:landing-ready"));
