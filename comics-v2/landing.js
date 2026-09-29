// ALLABOUTDC — DC Comics landing page.
// Generic DC architecture. Current mapped coverage starts with New 52 Batman only.
import * as data from "./data.js?v=dc1";
const esc=s=>s==null?"":String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");
let cache=null;
async function load(){if(cache)return cache;cache=Promise.all([data.getAllUniverses(10),data.getAllContinuities(30),data.getAllCharacters(200),data.getAllSeries(500),data.getAllCollections(500)]).then(([universes,continuities,characters,series,collections])=>({universes,continuities,characters,series:series.filter(s=>s.scope==="batman-new52"),collections})).catch(e=>{cache=null;throw e;});return cache;}
function openExplorer(level,label,params={}){
  const go=()=>{
    const openAt=window.__comicsExplorer?.openAt;
    if(typeof openAt!=="function") return false;
    openAt([{level,label,params}]);
    return true;
  };
  if(go()) return;
  const once=()=>{
    window.removeEventListener("comicsv2:explorer-ready",once);
    go();
  };
  window.addEventListener("comicsv2:explorer-ready",once,{once:true});
}

function openAtlas(d){window.__comicsStoryMap?.open?.("universe",d.universes[0]?.id);}
function render(container){
 container.innerHTML=`<div class="dcx-wrap">
  <section class="dcx-hero"><div class="dcx-hero-art"><span class="dcx-orbit a"></span><span class="dcx-orbit b"></span><span class="dcx-orbit c"></span><span class="dcx-hero-mark">DC</span></div><div class="dcx-hero-copy"><div class="dcx-kicker">EXPLORE</div><h2>DC <span>COMICS</span></h2><p>Every character. Every world. Every story.</p><small>Explore the complete DC universe as one connected catalogue.</small></div><div class="dcx-quote">“Comics are where it all begins.”<br><b>— DC</b></div></section>
  <section class="dcx-section"><div class="dcx-head"><h3>Start Exploring</h3><span>Different ways to dive into the DC universe</span></div><div class="dcx-start-grid">
   <button data-go="characters"><b>◉</b><strong>By Character</strong><small>Explore comics featuring your favourite characters</small><i>→</i></button>
   <button data-go="continuity"><b>▦</b><strong>By Continuity / Era</strong><small>From Golden Age to Modern Age. Explore the timeline.</small><i>→</i></button>
   <button data-go="atlas"><b>◎</b><strong>Story Map</strong><small>Visual map of universes, eras, characters and connections</small><i>→</i></button>
   <button data-go="series"><b>⌘</b><strong>Browse Series</strong><small>Explore every mapped publication line</small><i>→</i></button>
  </div></section>
  <button class="dcx-browse" data-go="series"><span>▱</span><div><strong>Browse All Comics</strong><small>Search and explore the complete DC comics catalogue</small></div><b>→</b></button>
 </div>`;
 container.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",async()=>{const a=b.dataset.go;if(a==="characters")return openExplorer("characterList","Characters");if(a==="continuity")return openExplorer("continuityList","Continuity / Era");if(a==="series")return openExplorer("seriesList","Series");if(a==="atlas"){try{const d=await load();return openAtlas(d);}catch(e){console.error("[Comics landing] Story Map data load failed",e);return;}}if(a==="batman"){try{const d=await load();const c=d.characters.find(x=>x.browseRoot===true);if(c)return openExplorer("character",c.displayName||c.name,{character:c});}catch(e){console.error("[Comics landing] Batman data load failed",e);}}}));

}
window.__comicsV2Landing={render,preload:load};document.dispatchEvent(new CustomEvent("comicsv2:landing-ready"));
