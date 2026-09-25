import { db, auth } from "./firebase-config.js";
import {
  collection, getDocs, addDoc, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

/* ============================= CONFIG ============================= */
const CATS = [
  {id:"movies", label:"Movies"},
  {id:"series", label:"Series"},
  {id:"games",  label:"Games"},
  {id:"comics", label:"Comics"},
];
const INTRO = {
  home:"An unofficial DC reading & watch guide — every movie, series, game and comic run, organized by hero, timeline and how deep you want to go.",
  movies:"Every DC film — pick Live Action or Animated, then sort by newest, by hero or team, by connected timeline, or by rating.",
  series:"Every DC TV series — pick Live Action or Animated, then sort by newest, by hero or team, by connected timeline, or by rating.",
  games:"Organized by franchise (Arkham, Injustice, LEGO, and so on) rather than platform or year, since that's how most of these actually relate to each other.",
  comics:"Filter by era, canon status, and character line to figure out what's essential, what's a fun detour, and what order to read an arc in."
};

// Field schema per category — drives both the add-entry form and card/detail rendering.
const SCHEMA = {
  movies: [
    {key:"t", label:"Title", type:"text", required:true},
    {key:"y", label:"Year", type:"text", required:true, placeholder:"e.g. 2013"},
    {key:"type", label:"Type", type:"select", options:["Live Action","Animated"], required:true},
    {key:"format", label:"Format", type:"select", options:["Theatrical","Direct-to-Video","TV Movie","Serial"], required:true},
    {key:"connected", label:"Connected story / timeline", type:"text", required:true, placeholder:"e.g. DCEU, DCU (Gunnverse), Nolanverse, Standalone"},
    {key:"group", label:"Hero / Team group — the ONE group this belongs under", type:"text", required:true, placeholder:"e.g. Batman, Justice League, Suicide Squad — or \"Other DC Characters\" if it's the only one for that character"},
    {key:"rt", label:"Rotten Tomatoes % (blank if none)", type:"text", required:false},
    {key:"imdb", label:"IMDb rating out of 10 (blank if none)", type:"text", required:false},
    {key:"blurb", label:"Summary", type:"textarea", required:true},
    {key:"director", label:"Director", type:"text", required:false},
    {key:"cast", label:"Cast", type:"text", required:false, placeholder:"comma-separated lead actors"},
    {key:"runtime", label:"Runtime", type:"text", required:false, placeholder:"e.g. 143 min"},
    {key:"plot", label:"Longer plot summary", type:"textarea", required:false},
    {key:"whereToWatch", label:"Where to watch", type:"text", required:false},
    {key:"boxOffice", label:"Box office", type:"text", required:false, placeholder:"e.g. Budget ~$X · Gross ~$Y"},
    {key:"ageRating", label:"Age rating", type:"text", required:false, placeholder:"e.g. PG-13"},
    {key:"trailer", label:"Trailer — YouTube video ID (e.g. TQfATDZY5Y4, not the full link)", type:"text", required:false},
    {key:"viewerLevel", label:"Viewer level", type:"select", required:true, options:["New Viewer","Familiar Viewer","Experienced Viewer","Hardcore Fan"]},
    {key:"complexity", label:"Complexity", type:"select", required:true, options:["Low","Medium","High"]},
    {key:"canonStatus", label:"Canon status", type:"select", required:true, options:["Shared Universe / Connected Continuity","Standalone / No Shared Continuity","Elseworlds / Alternate Continuity"]},
  ],
  series: [
    {key:"t", label:"Title", type:"text", required:true},
    {key:"y", label:"Year(s)", type:"text", required:true, placeholder:"e.g. 2019–2023"},
    {key:"type", label:"Type", type:"select", options:["Live Action","Animated"], required:true},
    {key:"connected", label:"Connected story / timeline", type:"text", required:true, placeholder:"e.g. Arrowverse, DCU (Gunnverse), Standalone"},
    {key:"group", label:"Hero / Team group — the ONE group this belongs under", type:"text", required:true, placeholder:"e.g. Flash, Justice League, Teen Titans — or \"Other DC Characters\" if it's the only one for that character"},
    {key:"seasons", label:"Seasons (number, blank if TBA)", type:"text", required:false},
    {key:"episodes", label:"Total episodes (number, blank if TBA)", type:"text", required:false},
    {key:"rt", label:"Rotten Tomatoes % (blank if none)", type:"text", required:false},
    {key:"imdb", label:"IMDb rating out of 10 (blank if none)", type:"text", required:false},
    {key:"blurb", label:"Summary", type:"textarea", required:true},
    {key:"creators", label:"Created by / showrunner", type:"text", required:false},
    {key:"cast", label:"Cast", type:"text", required:false, placeholder:"comma-separated lead actors"},
    {key:"runtime", label:"Runtime per episode", type:"text", required:false, placeholder:"e.g. ~45 min"},
    {key:"plot", label:"Longer plot summary", type:"textarea", required:false},
    {key:"whereToWatch", label:"Where to watch", type:"text", required:false},
    {key:"ageRating", label:"Age rating", type:"text", required:false, placeholder:"e.g. TV-MA"},
    {key:"trailer", label:"Trailer — YouTube video ID (series-wide, e.g. TQfATDZY5Y4)", type:"text", required:false},
    {key:"viewerLevel", label:"Viewer level", type:"select", required:true, options:["New Viewer","Familiar Viewer","Experienced Viewer","Hardcore Fan"]},
    {key:"complexity", label:"Complexity", type:"select", required:true, options:["Low","Medium","High"]},
    {key:"canonStatus", label:"Canon status", type:"select", required:true, options:["Shared Universe / Connected Continuity","Standalone / No Shared Continuity","Elseworlds / Alternate Continuity"]},
  ],
  games: [
    {key:"t", label:"Title", type:"text", required:true},
    {key:"y", label:"Year", type:"text", required:true},
    {key:"fr", label:"Franchise / story group", type:"text", required:true, placeholder:"e.g. Batman: Arkham, Injustice"},
    {key:"plats", label:"Platforms — comma separated", type:"text", required:true, placeholder:"e.g. PS5, Xbox Series X/S, PC"},
    {key:"blurb", label:"Summary", type:"textarea", required:true},
    {key:"director", label:"Director", type:"text", required:false},
    {key:"cast", label:"Cast / voice cast", type:"text", required:false},
    {key:"plot", label:"Longer plot summary", type:"textarea", required:false},
    {key:"whereToWatch", label:"Where to buy / play", type:"text", required:false},
    {key:"ageRating", label:"Age rating", type:"text", required:false, placeholder:"e.g. ESRB T"},
    {key:"trailer", label:"Trailer — YouTube video ID", type:"text", required:false},
    {key:"viewerLevel", label:"Viewer level", type:"select", required:true, options:["New Viewer","Familiar Viewer","Experienced Viewer","Hardcore Fan"]},
    {key:"complexity", label:"Complexity", type:"select", required:true, options:["Low","Medium","High"]},
    {key:"canonStatus", label:"Canon status", type:"select", required:true, options:["Shared Universe / Connected Continuity","Standalone / No Shared Continuity","Elseworlds / Alternate Continuity"]},
  ],
  comics: [
    {key:"t", label:"Title", type:"text", required:true},
    {key:"y", label:"Year(s)", type:"text", required:true},
    {key:"era", label:"Era", type:"text", required:true, placeholder:"e.g. Golden Age, New 52, Dawn of DC"},
    {key:"canon", label:"Canon status", type:"select", required:true,
      options:["Main Continuity","Elseworlds","Alternate Universe","Imprint — Vertigo","Imprint — Black Label"]},
    {key:"line", label:"Character line", type:"text", required:true, placeholder:"e.g. Batman, Justice League, Vertigo/Mature"},
    {key:"group", label:"Hero / Team group — the ONE group this belongs under, for the character hub", type:"text", required:true, placeholder:"e.g. Batman, Justice League — or \"Other DC Characters\""},
    {key:"fmt", label:"Collected formats", type:"text", required:true, placeholder:"e.g. TPB, Omnibus, Absolute Edition"},
    {key:"readingLevel", label:"Reading level — how much prior DC knowledge this assumes", type:"select", required:true, options:["New Reader","Familiar Reader","Experienced Reader","Hardcore"]},
    {key:"ord", label:"Where it fits / reading order", type:"textarea", required:true},
    {key:"blurb", label:"Summary", type:"textarea", required:true},
  ],
};

/* ============================= STATE ============================= */
let DATA = { movies:[], series:[], games:[], comics:[] };
let state = {
  cat:"home",
  search:"",
  f1:"all", f2:"all", f3:"all", chip:"all", // games/comics filters (f3: comics reading level)
  typeFilter:"Live Action",                // movies/series: Live Action | Animated
  sortMode:"newest",                       // movies/series: newest | hero | story | rating
  viewerLevelFilter:"all", complexityFilter:"all", canonFilter:"all", // movies/series: new filters (Phase 1, Task 7)
  gameMode:"all", gamePlatform:"all",      // games: all | platform | story
};
let isAdmin = false;
let loaded = false;

/* ============================= DOM ============================= */
const $ = (sel,root=document)=>root.querySelector(sel);
const tabsEl = $("#tabs"), filterRow = $("#filterRow"), chipRow=$("#chipRow"),
      gridEl = $("#grid"), countEl = $("#resultCount"), introEl = $("#introText"),
      searchInput = $("#searchInput");

/* ============================= DATA LOADING ============================= */
async function loadAll(){
  for(const c of CATS){
    const snap = await getDocs(collection(db, c.id));
    DATA[c.id] = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  }
  loaded = true;
  render();
}
loadAll().catch(err=>{
  gridEl.innerHTML = `<div class="empty">Couldn't reach the database.<br>Check firebase-config.js has your real project config, and that Firestore is enabled.<br><span style="font-family:var(--font-mono);font-size:11px;">${err.message}</span></div>`;
});

/* ============================= HELPERS ============================= */
function uniq(arr){ return [...new Set(arr)].filter(Boolean); }
function firstYear(y){
  if(!y) return 0;
  const m = String(y).match(/\d{4}/);
  return m ? parseInt(m[0],10) : 0;
}
function heroList(d){
  if(Array.isArray(d.hero)) return d.hero;
  if(typeof d.hero === "string" && d.hero.trim()) return d.hero.split(",").map(s=>s.trim()).filter(Boolean);
  return [];
}
function ratingScore(d){
  if(d.rt !== null && d.rt !== undefined && d.rt !== "") return Number(d.rt);
  if(d.imdb !== null && d.imdb !== undefined && d.imdb !== "") return Number(d.imdb) * 10;
  return null;
}
const HERO_PRIORITY = ["Batman","Superman","Justice League","Wonder Woman","Aquaman","Flash","Suicide Squad","Harley Quinn","Joker","Green Lantern","Shazam","Supergirl","Teen Titans","DC Super Hero Girls","LEGO DC","Watchmen","Constantine","Catwoman","Swamp Thing","Legion of Super-Heroes","Human Target","Vertigo / Imprint Films"];

/* ---- Themed backgrounds per hero / team group (Phase 1, Task 2) ---- */
const GROUP_THEMES = {
  "Batman":                   { a:"#3a3f4a", b:"#0d0d10" },
  "Superman":                 { a:"#2c5fd1", b:"#a3182a" },
  "Justice League":           { a:"#1f3f7a", b:"#c9a227" },
  "Wonder Woman":             { a:"#a3132a", b:"#c9a227" },
  "Aquaman":                  { a:"#0e7490", b:"#e07c1e" },
  "Flash":                    { a:"#c0272d", b:"#f4c430" },
  "Suicide Squad":            { a:"#7a1f1f", b:"#2b2b2b" },
  "Harley Quinn":             { a:"#d6336c", b:"#1c1c1c" },
  "Joker":                    { a:"#6a2c91", b:"#3f8f3f" },
  "Green Lantern":            { a:"#1f8f4d", b:"#0d2b0d" },
  "Shazam":                   { a:"#c0272d", b:"#f2c230" },
  "Supergirl":                { a:"#3d74d6", b:"#c0272d" },
  "Teen Titans":              { a:"#6a3fae", b:"#2fae6a" },
  "DC Super Hero Girls":      { a:"#e0479a", b:"#7a3fd1" },
  "LEGO DC":                  { a:"#d1272d", b:"#2c5fd1" },
  "Watchmen":                 { a:"#b8860b", b:"#1a1a1a" },
  "Constantine":              { a:"#8a1f1f", b:"#2b2b2b" },
  "Catwoman":                 { a:"#4a2f6a", b:"#17171c" },
  "Swamp Thing":              { a:"#2f6a2f", b:"#1a2b1a" },
  "Legion of Super-Heroes":   { a:"#3f3fae", b:"#1a1a3a" },
  "Human Target":             { a:"#4a4f5a", b:"#22242c" },
  "Vertigo / Imprint Films":  { a:"#5a2f5a", b:"#17171c" },
  "Other DC Characters":      { a:"#4a4f5a", b:"#22242c" },
};
function groupTheme(g){ return GROUP_THEMES[g] || GROUP_THEMES["Other DC Characters"]; }

/* ---- Cross-category group lookup, for Character/Team hub pages (Phase 2) ---- */
const GAME_GROUP = {
  "Batman: Arkham": "Batman",
  "Gotham Knights": "Batman",
  "Telltale Batman": "Batman",
  "LEGO DC": "LEGO DC",
  "DC Universe Online": "Justice League",
  "Injustice": "Justice League",
};
function groupOf(cat, d){
  if(cat==="movies" || cat==="series" || cat==="comics") return d.group || "Other DC Characters";
  if(cat==="games") return GAME_GROUP[d.fr] || "Other DC Characters";
  return "Other DC Characters";
}
function allGroupMembers(group){
  const out = [];
  CATS.forEach(c=>{
    (DATA[c.id]||[]).forEach(d=>{
      if(groupOf(c.id, d)===group) out.push({d, cat:c.id});
    });
  });
  return out.sort((a,b)=>firstYear(a.d.y)-firstYear(b.d.y));
}
function sortHeroNames(heroMap){
  return Object.keys(heroMap).sort((a,b)=>{
    const ia = HERO_PRIORITY.indexOf(a), ib = HERO_PRIORITY.indexOf(b);
    if(ia!==-1 && ib!==-1) return ia-ib;
    if(ia!==-1) return -1;
    if(ib!==-1) return 1;
    const diff = heroMap[b].length - heroMap[a].length;
    return diff!==0 ? diff : a.localeCompare(b);
  });
}

/* ============================= RENDER: TABS ============================= */
function resetFiltersForTabSwitch(){
  state.f1="all"; state.f2="all"; state.f3="all"; state.chip="all"; state.search="";
  state.sortMode="newest";
  state.gameMode="all"; state.gamePlatform="all";
  state.viewerLevelFilter="all"; state.complexityFilter="all"; state.canonFilter="all";
  searchInput.value="";
  globalSearchResults.innerHTML = ""; globalSearchResults.dataset.open = "false";
}
function goToCategory(cat, opts){
  state.cat = cat;
  resetFiltersForTabSwitch();
  if(opts){
    if(opts.sortMode) state.sortMode = opts.sortMode;
    if(opts.typeFilter) state.typeFilter = opts.typeFilter;
    if(opts.viewerLevelFilter) state.viewerLevelFilter = opts.viewerLevelFilter;
    if(opts.complexityFilter) state.complexityFilter = opts.complexityFilter;
  }
  render();
}
function buildTabs(){
  const homeBtn = `<button class="tab-btn" data-cat="home" data-active="${state.cat==="home"}">Home</button>`;
  tabsEl.innerHTML = homeBtn + CATS.map(c=>{
    const n = DATA[c.id].length;
    return `<button class="tab-btn" data-cat="${c.id}" data-active="${state.cat===c.id}">${c.label}<span class="n">${n}</span></button>`;
  }).join("");
  tabsEl.querySelectorAll(".tab-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      state.cat = btn.dataset.cat;
      resetFiltersForTabSwitch();
      render();
    });
  });
}

/* ============================= RENDER: FILTERS ============================= */
function buildFilters(){
  const cat = state.cat;
  introEl.textContent = INTRO[cat];
  filterRow.innerHTML = "";
  chipRow.innerHTML = "";

  if(cat==="home") return;

  if(cat==="movies" || cat==="series"){
    buildMovieSeriesFilters(cat);
    return;
  }

  const data = DATA[cat];

  if(cat==="games"){
    const modes = [
      {id:"all", label:"All"},
      {id:"platform", label:"By Platform"},
      {id:"story", label:"By Story"},
    ];
    chipRow.innerHTML = modes.map(m=>
      `<div class="chip games" data-val="${m.id}" data-active="${state.gameMode===m.id}">${m.label}</div>`
    ).join("");
    chipRow.querySelectorAll(".chip").forEach(ch=>{
      ch.addEventListener("click", ()=>{
        state.gameMode = ch.dataset.val;
        buildFilters();
        renderCards();
      });
    });

    if(state.gameMode==="platform"){
      const allPlats = uniq(data.flatMap(d=>d.plats||[])).sort();
      filterRow.innerHTML = `<select id="selPlatform"><option value="all">All platforms</option>${allPlats.map(p=>`<option value="${p}">${p}</option>`).join("")}</select>`;
      $("#selPlatform").addEventListener("change", e=>{ state.gamePlatform = e.target.value; renderCards(); });
      $("#selPlatform").value = state.gamePlatform;
    }
  }

  if(cat==="comics"){
    const eras = uniq(data.map(d=>d.era));
    const canons = uniq(data.map(d=>d.canon));
    const lines = uniq(data.map(d=>d.line));
    const readingLevels = ["New Reader","Familiar Reader","Experienced Reader","Hardcore"];
    filterRow.innerHTML = `
      <select id="selEra"><option value="all">All eras</option>${eras.map(e=>`<option value="${e}">${e}</option>`).join("")}</select>
      <select id="selCanon"><option value="all">All canon status</option>${canons.map(c=>`<option value="${c}">${c}</option>`).join("")}</select>
      <select id="selComicsReadingLevel"><option value="all">Any reading level</option>${readingLevels.map(r=>`<option value="${r}">${r}</option>`).join("")}</select>`;
    $("#selEra").addEventListener("change", e=>{ state.f1=e.target.value; renderCards(); });
    $("#selCanon").addEventListener("change", e=>{ state.f2=e.target.value; renderCards(); });
    $("#selComicsReadingLevel").addEventListener("change", e=>{ state.f3=e.target.value; renderCards(); });
    $("#selEra").value = state.f1; $("#selCanon").value = state.f2; $("#selComicsReadingLevel").value = state.f3;

    chipRow.innerHTML = `<div class="chip comics" data-val="all" data-active="${state.chip==='all'}">All lines</div>` +
      lines.map(l=>`<div class="chip comics" data-val="${l}" data-active="${state.chip===l}">${l}</div>`).join("");
    chipRow.querySelectorAll(".chip").forEach(ch=>{
      ch.addEventListener("click", ()=>{
        state.chip = ch.dataset.val;
        chipRow.querySelectorAll(".chip").forEach(c=>c.dataset.active = (c.dataset.val===state.chip));
        renderCards();
      });
    });
  }
}

function buildMovieSeriesFilters(cat){
  const VL_OPTIONS = ["New Viewer","Familiar Viewer","Experienced Viewer","Hardcore Fan"];
  const CX_OPTIONS = ["Low","Medium","High"];
  const CANON_OPTIONS = ["Shared Universe / Connected Continuity","Standalone / No Shared Continuity","Elseworlds / Alternate Continuity"];
  filterRow.innerHTML = `
    <div class="radio-row">
      <label class="radio-pill ${cat}"><input type="radio" name="typeFilter" value="Live Action" ${state.typeFilter==="Live Action"?"checked":""}> Live Action</label>
      <label class="radio-pill ${cat}"><input type="radio" name="typeFilter" value="Animated" ${state.typeFilter==="Animated"?"checked":""}> Animated</label>
    </div>
    <div class="select-row">
      <select id="selViewerLevel"><option value="all">Any viewer level</option>${VL_OPTIONS.map(o=>`<option value="${o}">${o}</option>`).join("")}</select>
      <select id="selComplexity"><option value="all">Any complexity</option>${CX_OPTIONS.map(o=>`<option value="${o}">${o}</option>`).join("")}</select>
      <select id="selCanonStatus"><option value="all">Any canon status</option>${CANON_OPTIONS.map(o=>`<option value="${o}">${canonShort(o)}</option>`).join("")}</select>
    </div>`;
  filterRow.querySelectorAll('input[name="typeFilter"]').forEach(r=>{
    r.addEventListener("change", e=>{ state.typeFilter = e.target.value; renderCards(); });
  });
  $("#selViewerLevel").value = state.viewerLevelFilter;
  $("#selComplexity").value = state.complexityFilter;
  $("#selCanonStatus").value = state.canonFilter;
  $("#selViewerLevel").addEventListener("change", e=>{ state.viewerLevelFilter = e.target.value; renderCards(); });
  $("#selComplexity").addEventListener("change", e=>{ state.complexityFilter = e.target.value; renderCards(); });
  $("#selCanonStatus").addEventListener("change", e=>{ state.canonFilter = e.target.value; renderCards(); });

  const modes = [
    {id:"newest", label:"Newest → Oldest"},
    {id:"hero", label:"By Hero / Team"},
    {id:"story", label:"Connected Story"},
    {id:"rating", label:"By Rating"},
  ];
  chipRow.innerHTML = modes.map(m=>
    `<div class="chip ${cat}" data-val="${m.id}" data-active="${state.sortMode===m.id}">${m.label}</div>`
  ).join("");
  chipRow.querySelectorAll(".chip").forEach(ch=>{
    ch.addEventListener("click", ()=>{
      state.sortMode = ch.dataset.val;
      chipRow.querySelectorAll(".chip").forEach(c=>c.dataset.active = (c.dataset.val===state.sortMode));
      renderCards();
    });
  });
}

/* ============================= RENDER: CARDS (games/comics — unchanged) ============================= */
function filteredDataGeneric(){
  const cat = state.cat;
  const data = DATA[cat];
  const q = state.search.trim().toLowerCase();
  return data.filter(d=>{
    if(q && !(d.t||"").toLowerCase().includes(q) && !(d.blurb||"").toLowerCase().includes(q)) return false;
    if(cat==="games" && state.gameMode==="platform" && state.gamePlatform!=="all"){
      if(!(d.plats||[]).includes(state.gamePlatform)) return false;
    }
    if(cat==="comics"){
      if(state.f1!=="all" && d.era!==state.f1) return false;
      if(state.f2!=="all" && d.canon!==state.f2) return false;
      if(state.f3!=="all" && d.readingLevel!==state.f3) return false;
      if(state.chip!=="all" && d.line!==state.chip) return false;
    }
    return true;
  });
}
function canonTagClass(canon){
  if(!canon) return "";
  return canon==="Main Continuity" ? "canon-main" : "canon-alt";
}
function metaTagsGeneric(cat, d){
  if(cat==="games"){
    const plats = (d.plats||[]).map(p=>`<span class="tag plat">${p}</span>`).join("");
    return `<span class="tag">${d.fr||""}</span>${plats}`;
  }
  if(cat==="comics"){
    const rl = d.readingLevel ? `<span class="qf-pill rl-${readingLevelClass(d.readingLevel)}">${d.readingLevel}</span>` : "";
    return `<span class="tag">${d.era||""}</span><span class="tag ${canonTagClass(d.canon)}">${d.canon||""}</span><span class="tag">${d.line||""}</span>${rl}`;
  }
  return "";
}

/* ============================= RENDER: CARDS (movies/series) ============================= */
function filteredMovieSeries(){
  const cat = state.cat;
  const q = state.search.trim().toLowerCase();
  return DATA[cat].filter(d=>{
    if(d.type !== state.typeFilter) return false;
    if(state.viewerLevelFilter!=="all" && d.viewerLevel !== state.viewerLevelFilter) return false;
    if(state.complexityFilter!=="all" && d.complexity !== state.complexityFilter) return false;
    if(state.canonFilter!=="all" && d.canonStatus !== state.canonFilter) return false;
    if(q && !(d.t||"").toLowerCase().includes(q) && !(d.blurb||"").toLowerCase().includes(q)) return false;
    return true;
  });
}

function movieSeriesMetaTags(cat, d){
  let tags = `<span class="tag">${d.connected||""}</span>`;
  if(cat==="movies" && d.format) tags += `<span class="tag">${d.format}</span>`;
  if(cat==="series" && d.seasons) tags += `<span class="tag">${d.seasons} season${d.seasons==1?"":"s"}${d.episodes?` · ${d.episodes} ep`:""}</span>`;
  const rating = ratingLabel(d);
  if(rating) tags += `<span class="tag rating">${rating}</span>`;
  return tags;
}
// Sheet-only variant: omits connected/format/seasons since Quick Facts already shows them; keeps rating.
function sheetMetaTags(cat, d){
  const rating = ratingLabel(d);
  let tags = "";
  if(cat==="series" && d.seasons) tags += `<span class="tag">${d.seasons} season${d.seasons==1?"":"s"}${d.episodes?` · ${d.episodes} ep`:""}</span>`;
  if(rating) tags += `<span class="tag rating">${rating}</span>`;
  return tags;
}
function readingLevelClass(rl){
  if(!rl) return "";
  if(rl.startsWith("New")) return "new";
  if(rl.startsWith("Familiar")) return "familiar";
  if(rl.startsWith("Experienced")) return "experienced";
  if(rl.startsWith("Hardcore")) return "hardcore";
  return "";
}
function complexityClass(c){
  if(c==="Low") return "low";
  if(c==="Medium") return "medium";
  if(c==="High") return "high";
  return "";
}
function canonShort(c){
  if(!c) return "";
  if(c.startsWith("Shared")) return "Shared Universe";
  if(c.startsWith("Standalone")) return "Standalone";
  if(c.startsWith("Elseworlds")) return "Elseworlds";
  return c;
}
function quickFactsHtml(cat, d){
  const medium = cat==="movies" ? (d.format || "Movie") : "Series";
  const cells = [
    ["MEDIUM", medium],
    ["YEAR", d.y || "—"],
    ["UNIVERSE", d.connected || "—"],
  ];
  if(d.viewerLevel) cells.push(["VIEWER LEVEL", `<span class="qf-pill rl-${readingLevelClass(d.viewerLevel)}">${d.viewerLevel}</span>`]);
  if(d.complexity) cells.push(["COMPLEXITY", `<span class="qf-pill cx-${complexityClass(d.complexity)}">${d.complexity}</span>`]);
  if(d.canonStatus) cells.push(["CANON STATUS", canonShort(d.canonStatus)]);
  return `<div class="quick-facts">${cells.map(([label,val])=>
    `<div class="qf-cell"><div class="qf-label">${label}</div><div class="qf-val">${val}</div></div>`
  ).join("")}</div>`;
}
function ratingLabel(d){
  const parts = [];
  if(d.rt !== null && d.rt !== undefined && d.rt !== "") parts.push(`🍅 ${d.rt}%`);
  if(d.imdb !== null && d.imdb !== undefined && d.imdb !== "") parts.push(`⭐ ${d.imdb}`);
  return parts.join(" · ");
}

function initials(title){
  if(!title) return "?";
  const words = title.replace(/[^A-Za-z0-9 ]/g," ").trim().split(/\s+/).filter(w=>w.length);
  if(words.length===0) return "?";
  if(words.length===1) return words[0].slice(0,2).toUpperCase();
  return (words[0][0]+words[1][0]).toUpperCase();
}
function thumbHtml(cat, d){
  if(d.poster){
    return `<div class="card-thumb">
      <img src="${escapeAttr(d.poster)}" alt="" loading="lazy" data-fallback-initials="${escapeAttr(initials(d.t))}">
    </div>`;
  }
  return `<div class="card-thumb"><div class="card-thumb-fallback">${initials(d.t)}</div></div>`;
}
function escapeAttr(s){
  return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function wireImageFallbacks(root){
  root.querySelectorAll("img[data-fallback-initials]").forEach(img=>{
    img.addEventListener("error", ()=>{
      const wrap = img.parentElement;
      wrap.innerHTML = "";
      const div = document.createElement("div");
      div.className = "card-thumb-fallback";
      div.textContent = img.dataset.fallbackInitials;
      wrap.appendChild(div);
    }, {once:true});
  });
  root.querySelectorAll("img[data-fallback-title]").forEach(img=>{
    img.addEventListener("error", ()=>{
      const wrap = img.parentElement;
      wrap.classList.remove("has-poster");
      wrap.innerHTML = "";
      const div = document.createElement("div");
      div.className = "sheet-hero-fallback";
      div.textContent = img.dataset.fallbackTitle;
      wrap.appendChild(div);
    }, {once:true});
  });
}

function cardHtml(cat, d){
  const meta = (cat==="movies"||cat==="series") ? movieSeriesMetaTags(cat, d) : metaTagsGeneric(cat, d);
  return `<div class="card ${cat}" data-id="${d.id}" data-cat="${cat}">
      ${thumbHtml(cat, d)}
      <div class="card-body">
        <div class="card-top"><div class="card-title">${d.t}</div><div class="card-year">${d.y||""}</div></div>
        <div class="card-meta">${meta}</div>
        <div class="card-blurb">${d.blurb||""}</div>
        ${isAdmin ? `<div class="card-admin-row"><button class="mini-btn danger" data-del="${d.id}">Delete</button></div>` : ""}
      </div>
    </div>`;
}
function groupHeaderHtml(label, count, theme, hubGroup, universeHub){
  const clickable = hubGroup ? ` data-hub-group="${escapeAttr(hubGroup)}"` : (universeHub ? ` data-universe-hub="${escapeAttr(universeHub)}"` : "");
  const hint = (hubGroup || universeHub) ? `<span class="group-hub-hint">View hub →</span>` : "";
  const inner = `<span class="group-header-label">${label}</span><span class="group-count">${count}</span>${hint}`;
  if(theme){
    return `<div class="group-header themed"${clickable} style="--theme-a:${theme.a};--theme-b:${theme.b}">${inner}</div>`;
  }
  return `<div class="group-header"${clickable}>${inner}</div>`;
}

function renderMovieSeriesCards(){
  const cat = state.cat;
  const items = filteredMovieSeries();
  countEl.textContent = `${items.length} title${items.length===1?"":"s"}`;
  if(items.length===0){
    gridEl.innerHTML = `<div class="empty">Nothing matches those filters yet.<br>Try the other type, or clear the search.</div>`;
    return;
  }

  let html = "";
  if(state.sortMode==="newest"){
    const sorted = [...items].sort((a,b)=>firstYear(b.y)-firstYear(a.y));
    html = sorted.map(d=>cardHtml(cat,d)).join("");
  }
  else if(state.sortMode==="rating"){
    const rated = items.filter(d=>ratingScore(d)!==null).sort((a,b)=>ratingScore(b)-ratingScore(a));
    const unrated = items.filter(d=>ratingScore(d)===null).sort((a,b)=>firstYear(b.y)-firstYear(a.y));
    html = rated.map(d=>cardHtml(cat,d)).join("");
    if(unrated.length){
      html += groupHeaderHtml("Not yet rated", unrated.length) + unrated.map(d=>cardHtml(cat,d)).join("");
    }
  }
  else if(state.sortMode==="hero"){
    // Each title belongs to exactly ONE group now (d.group) — no more showing
    // the same title under multiple heroes/teams. Falls back to the legacy
    // multi-tag "hero" field only for any entry that predates the "group" field.
    const heroMap = {};
    items.forEach(d=>{
      const g = d.group || heroList(d)[0] || "Other DC Characters";
      (heroMap[g] = heroMap[g] || []).push(d);
    });
    const heroNames = sortHeroNames(heroMap).filter(h=>h!=="Other DC Characters");
    heroNames.forEach(h=>{
      const list = heroMap[h].sort((a,b)=>firstYear(b.y)-firstYear(a.y));
      html += groupHeaderHtml(h, list.length, groupTheme(h), h) + list.map(d=>cardHtml(cat,d)).join("");
    });
    if(heroMap["Other DC Characters"] && heroMap["Other DC Characters"].length){
      const list = heroMap["Other DC Characters"].sort((a,b)=>firstYear(b.y)-firstYear(a.y));
      html += groupHeaderHtml("Other DC Characters", list.length, null, "Other DC Characters") + list.map(d=>cardHtml(cat,d)).join("");
    }
  }
  else if(state.sortMode==="story"){
    const groups = {};
    items.forEach(d=>{
      const key = d.connected || "Standalone";
      (groups[key] = groups[key] || []).push(d);
    });
    const groupNames = Object.keys(groups).sort((a,b)=>{
      const la = Math.max(...groups[a].map(d=>firstYear(d.y)||0));
      const lb = Math.max(...groups[b].map(d=>firstYear(d.y)||0));
      return lb-la; // newest universe first
    });
    groupNames.forEach(g=>{
      const list = groups[g].sort((a,b)=>firstYear(a.y)-firstYear(b.y)); // true sequel/chronological order within the universe
      html += groupHeaderHtml(g, list.length, null, null, g!=="Standalone" ? g : null) + list.map(d=>cardHtml(cat,d)).join("");
    });
  }
  gridEl.innerHTML = html;
  attachCardHandlers(cat);
}

function attachCardHandlers(cat){
  wireImageFallbacks(gridEl);
  gridEl.querySelectorAll(".card").forEach(c=>{
    c.addEventListener("click", (e)=>{
      if(e.target.closest("[data-del]")) return;
      const d = DATA[cat].find(x=>x.id===c.dataset.id);
      if(d) openSheet(d);
    });
  });
  gridEl.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", async (e)=>{
      e.stopPropagation();
      if(!confirm("Delete this entry for everyone?")) return;
      await deleteDoc(doc(db, cat, btn.dataset.del));
      DATA[cat] = DATA[cat].filter(x=>x.id!==btn.dataset.del);
      buildTabs(); renderCards();
    });
  });
  gridEl.querySelectorAll("[data-hub-group]").forEach(h=>{
    h.addEventListener("click", ()=> openHub(h.dataset.hubGroup));
  });
  gridEl.querySelectorAll("[data-universe-hub]").forEach(h=>{
    h.addEventListener("click", ()=> openUniverseHub(h.dataset.universeHub));
  });
}

/* ============================= RENDER: GENERIC CARDS (games/comics) ============================= */
function renderGenericCards(){
  const cat = state.cat;
  const items = filteredDataGeneric();
  countEl.textContent = `${items.length} title${items.length===1?"":"s"}`;
  if(items.length===0){
    gridEl.innerHTML = `<div class="empty">Nothing matches those filters yet.<br>Try clearing a filter or the search.</div>`;
    return;
  }
  if(cat==="games" && state.gameMode==="story"){
    const groups = {};
    items.forEach(d=>{ (groups[d.fr||"Other"] = groups[d.fr||"Other"] || []).push(d); });
    const groupNames = Object.keys(groups).sort();
    let html = "";
    groupNames.forEach(g=>{
      const list = groups[g].sort((a,b)=>firstYear(b.y)-firstYear(a.y));
      html += groupHeaderHtml(g, list.length) + list.map(d=>cardHtml(cat,d)).join("");
    });
    gridEl.innerHTML = html;
  } else {
    gridEl.innerHTML = items.map(d=>cardHtml(cat,d)).join("");
  }
  attachCardHandlers(cat);
}

function renderCards(){
  if(!loaded) return;
  if(state.cat==="home") renderHome();
  else if(state.cat==="movies" || state.cat==="series") renderMovieSeriesCards();
  else renderGenericCards();
}

/* ============================= RENDER: HOME ============================= */
function stripCardHtml(cat, d){
  const rating = ratingLabel(d);
  return `<div class="strip-card" data-id="${d.id}" data-cat="${cat}">
      ${thumbHtml(cat, d)}
      <div class="strip-card-title">${d.t}</div>
      <div class="strip-card-meta">${d.y||""}${rating?` · ${rating}`:""}</div>
    </div>`;
}
function stripHtml(id, title, subtitle, items){
  if(!items.length) return "";
  return `<div class="home-section">
      <div class="home-section-head"><h3>${title}</h3>${subtitle?`<span class="home-section-sub">${subtitle}</span>`:""}</div>
      <div class="home-strip" id="${id}">${items.map(({d,cat})=>stripCardHtml(cat,d)).join("")}</div>
    </div>`;
}
function renderHome(){
  countEl.textContent = "";
  const allMS = [
    ...DATA.movies.map(d=>({d,cat:"movies"})),
    ...DATA.series.map(d=>({d,cat:"series"})),
  ];

  const startHere = allMS
    .filter(({d})=>d.viewerLevel==="New Viewer" && d.complexity==="Low")
    .sort((a,b)=> (ratingScore(b.d)||0) - (ratingScore(a.d)||0))
    .slice(0, 12);

  const topRated = allMS
    .filter(({d})=>ratingScore(d)!==null)
    .sort((a,b)=> ratingScore(b.d) - ratingScore(a.d))
    .slice(0, 12);

  const catCounts = CATS.map(c=>({...c, n: DATA[c.id].length}));

  let html = `
    <div class="home-hero">
      <div class="home-hero-badge">💥 UNOFFICIAL DC GUIDE</div>
      <h2>Every DC story, organized by hero, timeline &amp; how deep you want to go.</h2>
      <p>${catCounts.map(c=>`${c.n} ${c.label.toLowerCase()}`).join(" · ")}</p>
      <div class="home-hero-actions">
        <button class="btn btn-primary home-btn" id="homeStartHereBtn">New to DC? Start Here</button>
        <button class="btn btn-ghost home-btn" id="homeBrowseBtn">Browse Everything</button>
      </div>
    </div>`;

  html += stripHtml("homeStartHereStrip", "New to DC? Start Here", "Low-complexity, standalone-friendly picks", startHere);
  html += stripHtml("homeTopRatedStrip", "Top Rated", "Highest-rated movies & series on the site", topRated);

  html += `<div class="home-section">
      <div class="home-section-head"><h3>Explore by Category</h3></div>
      <div class="home-discover-grid">
        ${catCounts.map(c=>`<div class="discover-tile ${c.id}" data-cat="${c.id}">
            <div class="discover-tile-icon">${CAT_ICON[c.id]||""}</div>
            <div class="discover-tile-label">${c.label}</div>
            <div class="discover-tile-count">${c.n} entries</div>
          </div>`).join("")}
      </div>
    </div>`;

  html += `<div class="home-section">
      <div class="home-section-head"><h3>Browse By</h3></div>
      <div class="home-discover-grid">
        <div class="discover-tile" data-cat="movies" data-sort="hero"><div class="discover-tile-icon">🦇</div><div class="discover-tile-label">Hero / Team</div><div class="discover-tile-count">Movies &amp; series</div></div>
        <div class="discover-tile" data-cat="movies" data-sort="story"><div class="discover-tile-icon">🌐</div><div class="discover-tile-label">Connected Story</div><div class="discover-tile-count">Movies &amp; series</div></div>
        <div class="discover-tile" data-cat="games" data-sort="story"><div class="discover-tile-icon">🎮</div><div class="discover-tile-label">Games by Franchise</div><div class="discover-tile-count">Arkham, Injustice &amp; more</div></div>
        <div class="discover-tile" data-cat="comics"><div class="discover-tile-icon">📖</div><div class="discover-tile-label">Comics by Era</div><div class="discover-tile-count">Golden Age to today</div></div>
      </div>
    </div>`;

  gridEl.innerHTML = html;
  wireImageFallbacks(gridEl);

  gridEl.querySelectorAll(".strip-card").forEach(c=>{
    c.addEventListener("click", ()=>{
      const cat = c.dataset.cat, id = c.dataset.id;
      const d = DATA[cat].find(x=>x.id===id);
      if(!d) return;
      state.cat = cat;
      if(d.type) state.typeFilter = d.type;
      openSheet(d);
    });
  });
  gridEl.querySelectorAll(".discover-tile").forEach(t=>{
    t.addEventListener("click", ()=>{
      goToCategory(t.dataset.cat, { sortMode: t.dataset.sort });
    });
  });
  const startBtn = $("#homeStartHereBtn");
  if(startBtn) startBtn.addEventListener("click", ()=>{
    document.getElementById("homeStartHereStrip")?.scrollIntoView({behavior:"smooth", block:"center"});
  });
  const browseBtn = $("#homeBrowseBtn");
  if(browseBtn) browseBtn.addEventListener("click", ()=> goToCategory("movies"));
}
function render(){ buildTabs(); buildFilters(); renderCards(); updateMobileNavActive(); }

/* ============================= CHARACTER / TEAM HUB (Phase 2) ============================= */
const hubBackdrop = $("#hubBackdrop"), hubSheet = $("#hubSheet"), hubContent = $("#hubContent");
function openHub(group){
  const theme = groupTheme(group);
  hubSheet.style.setProperty("--theme-a", theme.a);
  hubSheet.style.setProperty("--theme-b", theme.b);
  hubSheet.dataset.themed = "true";

  const members = allGroupMembers(group);
  const byCat = { movies:[], series:[], games:[], comics:[] };
  members.forEach(m=> byCat[m.cat].push(m));

  let html = `<div class="sheet-eyebrow">CHARACTER / TEAM HUB</div><h2>${group}</h2>
    <p class="hub-count">${members.length} title${members.length===1?"":"s"} across ${CATS.filter(c=>byCat[c.id].length).map(c=>c.label.toLowerCase()).join(", ")}</p>`;

  CATS.forEach(c=>{
    const list = byCat[c.id];
    if(!list.length) return;
    html += `<div class="home-section">
        <div class="home-section-head"><h3>${CAT_ICON[c.id]||""} ${c.label}</h3><span class="home-section-sub">${list.length}</span></div>
        <div class="home-strip">${list.map(({d,cat})=>stripCardHtml(cat,d)).join("")}</div>
      </div>`;
  });

  hubContent.innerHTML = html;
  wireImageFallbacks(hubContent);
  hubContent.querySelectorAll(".strip-card").forEach(c=>{
    c.addEventListener("click", ()=>{
      const cat = c.dataset.cat, id = c.dataset.id;
      const d = (DATA[cat]||[]).find(x=>x.id===id);
      if(!d) return;
      closeSheetEl(hubBackdrop, hubSheet);
      state.cat = cat;
      if(d.type) state.typeFilter = d.type;
      openSheet(d);
    });
  });
  openSheetEl(hubBackdrop, hubSheet);
}

/* ============================= UNIVERSE / CONNECTED-STORY HUB (Phase 2) ============================= */
function openUniverseHub(connected){
  hubSheet.style.removeProperty("--theme-a");
  hubSheet.style.removeProperty("--theme-b");
  hubSheet.dataset.themed = "false";

  const members = relatedInUniverse(connected, null, null); // full list, nothing excluded
  const byYear = [...members].sort((a,b)=>firstYear(a.y)-firstYear(b.y));

  let html = `<div class="sheet-eyebrow">CONNECTED UNIVERSE</div><h2>${connected}</h2>
    <p class="hub-count">${members.length} title${members.length===1?"":"s"} — recommended watch order</p>`;

  html += `<div class="home-section">
      <div class="home-strip">${byYear.map(d=>stripCardHtml(d._cat, d)).join("")}</div>
    </div>`;

  html += `<div class="home-section">
      <div class="home-section-head"><h3>Timeline</h3></div>
      <div class="universe-timeline">
        ${byYear.map(d=>`<div class="timeline-row" data-cat="${d._cat}" data-id="${d.id}">
            <span class="timeline-year">${d.y||""}</span>
            <span class="timeline-icon">${CAT_ICON[d._cat]||""}</span>
            <span class="timeline-title">${d.t}</span>
          </div>`).join("")}
      </div>
    </div>`;

  hubContent.innerHTML = html;
  wireImageFallbacks(hubContent);
  const openItem = (cat, id)=>{
    const d = (DATA[cat]||[]).find(x=>x.id===id);
    if(!d) return;
    closeSheetEl(hubBackdrop, hubSheet);
    state.cat = cat;
    if(d.type) state.typeFilter = d.type;
    openSheet(d);
  };
  hubContent.querySelectorAll(".strip-card").forEach(c=>{
    c.addEventListener("click", ()=> openItem(c.dataset.cat, c.dataset.id));
  });
  hubContent.querySelectorAll(".timeline-row").forEach(r=>{
    r.addEventListener("click", ()=> openItem(r.dataset.cat, r.dataset.id));
  });
  openSheetEl(hubBackdrop, hubSheet);
}

hubBackdrop.addEventListener("click", ()=> closeSheetEl(hubBackdrop, hubSheet));
$("#hubClose").addEventListener("click", ()=> closeSheetEl(hubBackdrop, hubSheet));

/* ============================= DETAIL SHEET ============================= */
const backdrop = $("#backdrop"), sheet = $("#sheet"), sheetContent = $("#sheetContent");

function formatDate(iso){
  if(!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if(isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, {year:"numeric", month:"long", day:"numeric"});
}

function renderEpisodeList(d, seasonNum){
  const listEl = $("#episodeList");
  if(!listEl) return;
  const details = d.epDetails && d.epDetails[seasonNum];
  if(details && details.length){
    listEl.innerHTML = `<div class="episode-list">` + details.map(ep=>`
      <div class="episode-row">
        <div class="episode-num">E${ep.n}</div>
        <div class="episode-info">
          <div class="episode-title">${ep.t || `Episode ${ep.n}`}</div>
          <div class="episode-date">${formatDate(ep.d) || "Air date not yet added"}</div>
        </div>
      </div>`).join("") + `</div>`;
  } else {
    listEl.innerHTML = `<div class="episode-empty">Episode-by-episode details for Season ${seasonNum} haven't been added yet — ask to have this season researched and I'll add real titles and air dates rather than guessing.</div>`;
  }
}

function relatedInUniverse(connected, cat, excludeId){
  if(!connected || connected==="Standalone") return [];
  const results = [];
  ["movies","series"].forEach(c=>{
    DATA[c].forEach(d=>{
      if(d.connected===connected && !(c===cat && d.id===excludeId)) results.push({...d, _cat:c});
    });
  });
  return results.sort((a,b)=>firstYear(a.y)-firstYear(b.y));
}

function trailerListOf(d){
  if(Array.isArray(d.trailers) && d.trailers.length) return d.trailers;
  if(d.trailer) return [{ id: d.trailer, label: "Trailer" }];
  return [];
}
function trailerStripHtml(trailers){
  return trailers.map((t,i)=>`
    <div class="trailer-card" data-idx="${i}">
      <div class="trailer-card-media">
        <img src="https://i.ytimg.com/vi/${escapeAttr(t.id)}/hqdefault.jpg" alt="" loading="lazy">
        <button class="trailer-play" data-yt="${escapeAttr(t.id)}">▶</button>
      </div>
      <div class="trailer-card-label">${t.label||"Trailer"}</div>
    </div>`).join("");
}
function extraDetailsHtml(cat, d){
  let html = "";
  const trailers = trailerListOf(d);
  if(trailers.length){
    html += `<button class="trailer-btn">▶ Watch Trailer${trailers.length>1?"s":""}${trailers.length>1?` (${trailers.length})`:""}</button><div class="trailer-strip" id="trailerStrip"></div>`;
  }
  if(d.plot){
    html += `<div class="sheet-section spoiler-section">
      <div class="sheet-label">FULL PLOT</div>
      <div class="spoiler-gate">
        <span>⚠ Contains major plot details</span>
        <button class="spoiler-reveal-btn">Reveal spoilers</button>
      </div>
      <div class="sheet-body spoiler-body" data-revealed="false">${d.plot}</div>
    </div>`;
  }
  const credits = [];
  if(cat==="movies" && d.director) credits.push(["DIRECTOR", d.director]);
  if(cat==="series" && d.creators) credits.push(["CREATED BY", d.creators]);
  if(d.cast) credits.push(["CAST", d.cast]);
  if(d.runtime) credits.push(["RUNTIME", d.runtime]);
  if(d.whereToWatch) credits.push(["WHERE TO WATCH", d.whereToWatch]);
  if(cat==="movies" && d.boxOffice) credits.push(["BOX OFFICE", d.boxOffice]);
  if(d.ageRating) credits.push(["AGE RATING", d.ageRating]);
  credits.forEach(([label,val])=>{
    html += `<div class="sheet-section"><div class="sheet-label">${label}</div><div class="sheet-body">${val}</div></div>`;
  });
  return html;
}

function heroHtml(cat, d){
  const theme = (cat==="movies"||cat==="series") ? groupTheme(d.group) : null;
  const themeStyle = theme ? ` style="--theme-a:${theme.a};--theme-b:${theme.b}"` : "";
  if(d.poster){
    return `<div class="sheet-hero has-poster ${cat}${theme?" themed":""}"${themeStyle}>
      <img src="${escapeAttr(d.poster)}" alt="" data-fallback-title="${escapeAttr(d.t)}">
    </div>`;
  }
  return `<div class="sheet-hero ${cat}${theme?" themed":""}"${themeStyle}><div class="sheet-hero-fallback">${d.t}</div></div>`;
}

function openSheet(d){
  const cat = state.cat;
  if(cat==="movies"||cat==="series"){
    const theme = groupTheme(d.group);
    sheet.style.setProperty("--theme-a", theme.a);
    sheet.style.setProperty("--theme-b", theme.b);
    sheet.dataset.themed = "true";
  } else {
    sheet.dataset.themed = "false";
  }
  let html = heroHtml(cat, d);
  html += `<div class="sheet-eyebrow">${cat.toUpperCase()} · ${d.y||""}</div><h2>${d.t}</h2>`;
  const hubGroup = groupOf(cat, d);
  html += `<button class="hub-link-btn" data-hub-group="${escapeAttr(hubGroup)}">🔗 ${hubGroup} hub — every movie, series, game &amp; comic</button>`;

  if(cat==="movies"||cat==="series"){
    html += quickFactsHtml(cat, d);
    const sheetTags = sheetMetaTags(cat, d);
    if(sheetTags) html += `<div class="sheet-tags">${sheetTags}</div>`;
    html += `<div class="sheet-section"><div class="sheet-label">ABOUT · SPOILER-FREE</div><div class="sheet-body">${d.blurb||""}</div></div>`;
    html += extraDetailsHtml(cat, d);

    if(cat==="series" && d.seasons){
      html += `<div class="sheet-section"><div class="sheet-label">SEASONS</div><div class="sheet-body">`;
      html += `${d.seasons} season${d.seasons==1?"":"s"}${d.episodes?`, ${d.episodes} episodes total`:""} — tap a season to see episodes</div>`;
      html += `<div class="season-chips">`;
      if(d.epDetails && d.epDetails["0"]) html += `<span class="season-chip" data-season="0">Shorts</span>`;
      for(let i=1;i<=d.seasons;i++) html += `<span class="season-chip" data-season="${i}">S${i}</span>`;
      html += `</div><div id="episodeList"></div></div>`;
    }

    const related = relatedInUniverse(d.connected, cat, d.id);
    if(related.length){
      const fullTimeline = [...related, {...d, _cat:cat}].sort((a,b)=>firstYear(a.y)-firstYear(b.y));
      const dIdx = fullTimeline.findIndex(x=>x._cat===cat && x.id===d.id);
      const upNext = dIdx>=0 ? fullTimeline.slice(dIdx+1).find(x=>!(x._cat===cat && x.id===d.id)) : null;
      if(upNext){
        html += `<div class="sheet-section up-next-block" data-related-cat="${upNext._cat}" data-related-id="${upNext.id}">
            <div class="sheet-label">UP NEXT IN ${(d.connected||"").toUpperCase()}</div>
            <div class="up-next-row"><span class="up-next-icon">${CAT_ICON[upNext._cat]||""}</span><span class="up-next-title">${upNext.t}</span><span class="up-next-year">${upNext.y||""}</span></div>
          </div>`;
      }
      html += `<div class="sheet-section"><div class="sheet-label sheet-label-link" data-universe-hub="${escapeAttr(d.connected)}">SAME TIMELINE — ${(d.connected||"").toUpperCase()} · View full universe →</div>`;
      html += related.map(r=>`<div class="related-row" data-related-cat="${r._cat}" data-related-id="${r.id}"><span class="related-year">${r.y}</span> ${r.t} <span class="related-type">${r._cat}</span></div>`).join("");
      html += `</div>`;
    }
  } else {
    html += `<div class="sheet-tags">${metaTagsGeneric(cat, d)}</div>`;
    html += `<div class="sheet-section"><div class="sheet-label">ABOUT</div><div class="sheet-body">${d.blurb||""}</div></div>`;
    if(cat==="games") html += extraDetailsHtml(cat, d);
    if(cat==="comics"){
      html += `<div class="sheet-section"><div class="sheet-label">WHERE IT FITS / READING ORDER</div><div class="sheet-body">${d.ord||""}</div></div>`;
      html += `<div class="sheet-section"><div class="sheet-label">COLLECTED FORMATS</div><div class="sheet-body">${d.fmt||""}</div></div>`;
    }
  }

  sheetContent.innerHTML = html;
  wireImageFallbacks(sheetContent);

  const hubBtn = sheetContent.querySelector(".hub-link-btn");
  if(hubBtn) hubBtn.addEventListener("click", ()=>{
    stopAllTrailers();
    closeSheetEl(backdrop, sheet);
    openHub(hubBtn.dataset.hubGroup);
  });

  const trailerBtn = sheetContent.querySelector(".trailer-btn");
  if(trailerBtn){
    const trailers = trailerListOf(d);
    trailerBtn.addEventListener("click", ()=>{
      const strip = $("#trailerStrip");
      strip.innerHTML = trailerStripHtml(trailers);
      strip.dataset.active = "true";
      strip.querySelectorAll(".trailer-play").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const vid = btn.dataset.yt;
          const media = btn.closest(".trailer-card-media");
          media.innerHTML = `<iframe src="https://www.youtube.com/embed/${vid}?autoplay=1" title="Trailer" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        });
      });
      trailerBtn.style.display = "none";
    });
  }

  sheetContent.querySelectorAll(".spoiler-reveal-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const section = btn.closest(".spoiler-section");
      section.querySelector(".spoiler-body").dataset.revealed = "true";
      section.querySelector(".spoiler-gate").style.display = "none";
    });
  });

  sheetContent.querySelectorAll("[data-season]").forEach(chip=>{
    chip.addEventListener("click", ()=>{
      sheetContent.querySelectorAll(".season-chip").forEach(c=>c.dataset.active="false");
      chip.dataset.active = "true";
      renderEpisodeList(d, chip.dataset.season);
    });
  });

  sheetContent.querySelectorAll("[data-universe-hub]").forEach(el=>{
    el.addEventListener("click", ()=>{
      stopAllTrailers();
      closeSheetEl(backdrop, sheet);
      openUniverseHub(el.dataset.universeHub);
    });
  });

  sheetContent.querySelectorAll("[data-related-id]").forEach(row=>{
    row.addEventListener("click", ()=>{
      const rcat = row.dataset.relatedCat, rid = row.dataset.relatedId;
      const rd = DATA[rcat].find(x=>x.id===rid);
      if(rd){
        state.cat = rcat;
        if(rd.type) state.typeFilter = rd.type;
        openSheet(rd);
      }
    });
  });
  openSheetEl(backdrop, sheet);
}
function openSheetEl(bd, sh){ bd.dataset.open="true"; sh.dataset.open="true"; }
function closeSheetEl(bd, sh){ bd.dataset.open="false"; sh.dataset.open="false"; }
function stopAllTrailers(){
  // Removing/blanking the iframe src actually halts YouTube playback;
  // hiding the sheet with CSS alone leaves the audio/video running.
  sheetContent.querySelectorAll(".trailer-card-media iframe").forEach(f=>{ f.src = "about:blank"; });
  const strip = $("#trailerStrip");
  if(strip){ strip.innerHTML = ""; strip.dataset.active = "false"; }
}
backdrop.addEventListener("click", ()=>{ stopAllTrailers(); closeSheetEl(backdrop, sheet); });
$("#sheetClose").addEventListener("click", ()=>{ stopAllTrailers(); closeSheetEl(backdrop, sheet); });

/* ============================= GLOBAL CROSS-CATEGORY SEARCH ============================= */
const CAT_ICON = { movies:"🎬", series:"📺", games:"🎮", comics:"📖" };
const globalSearchResults = $("#globalSearchResults");
function catLabelOf(catId){ return (CATS.find(c=>c.id===catId)||{}).label || catId; }
function globalSearchMatches(q){
  const results = [];
  CATS.forEach(c=>{
    (DATA[c.id]||[]).forEach(d=>{
      const title = (d.t||"").toLowerCase();
      if(title.includes(q)) results.push({ d, cat:c.id, score: title.startsWith(q) ? 0 : 1 });
    });
  });
  results.sort((a,b)=> a.score - b.score || (a.d.t||"").localeCompare(b.d.t||""));
  return results.slice(0, 10);
}
function renderGlobalSearchDropdown(query){
  const q = query.trim().toLowerCase();
  if(q.length < 2 || !loaded){ globalSearchResults.innerHTML = ""; globalSearchResults.dataset.open="false"; return; }
  const matches = globalSearchMatches(q);
  if(!matches.length){
    globalSearchResults.innerHTML = `<div class="gsr-empty">No matches across movies, series, games or comics.</div>`;
    globalSearchResults.dataset.open = "true";
    return;
  }
  globalSearchResults.innerHTML = matches.map(({d,cat})=>
    `<div class="gsr-row" data-cat="${cat}" data-id="${d.id}">
      <span class="gsr-icon">${CAT_ICON[cat]||""}</span>
      <span class="gsr-title">${d.t}</span>
      <span class="gsr-meta">${d.y||""} · ${catLabelOf(cat)}</span>
    </div>`
  ).join("");
  globalSearchResults.dataset.open = "true";
  globalSearchResults.querySelectorAll(".gsr-row").forEach(row=>{
    row.addEventListener("click", ()=>{
      const cat = row.dataset.cat, id = row.dataset.id;
      const d = (DATA[cat]||[]).find(x=>x.id===id);
      if(!d) return;
      globalSearchResults.dataset.open = "false";
      globalSearchResults.innerHTML = "";
      searchInput.value = "";
      state.search = "";
      state.cat = cat;
      if(d.type) state.typeFilter = d.type;
      render();
      openSheet(d);
    });
  });
}

let searchTimer;
searchInput.addEventListener("input", e=>{
  clearTimeout(searchTimer);
  const v = e.target.value;
  searchTimer = setTimeout(()=>{
    state.search = v;
    renderCards();
    renderGlobalSearchDropdown(v);
  }, 120);
});
searchInput.addEventListener("focus", ()=>{ if(searchInput.value.trim().length>=2) renderGlobalSearchDropdown(searchInput.value); });
document.addEventListener("click", e=>{
  if(!e.target.closest(".search-row")){ globalSearchResults.dataset.open = "false"; }
});

/* ============================= ADMIN: LOGIN ============================= */
const adminToggle = $("#adminToggle");
const loginBackdrop = $("#loginBackdrop"), loginSheet = $("#loginSheet");
const loginArea = $("#loginArea"), signedInArea = $("#signedInArea");
const loginEmail = $("#loginEmail"), loginPassword = $("#loginPassword"), loginMsg = $("#loginMsg");
const fab = $("#fabAdd");

adminToggle.addEventListener("click", ()=> openSheetEl(loginBackdrop, loginSheet));
loginBackdrop.addEventListener("click", ()=> closeSheetEl(loginBackdrop, loginSheet));
$("#loginClose").addEventListener("click", ()=> closeSheetEl(loginBackdrop, loginSheet));
$("#loginCancel").addEventListener("click", ()=> closeSheetEl(loginBackdrop, loginSheet));

$("#loginSubmit").addEventListener("click", async ()=>{
  loginMsg.textContent = ""; loginMsg.className = "form-msg";
  try{
    await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value);
    closeSheetEl(loginBackdrop, loginSheet);
  }catch(err){
    loginMsg.textContent = "Sign-in failed — check the email and password.";
    loginMsg.className = "form-msg err";
  }
});
$("#logoutBtn").addEventListener("click", async ()=>{
  await signOut(auth);
  closeSheetEl(loginBackdrop, loginSheet);
});

onAuthStateChanged(auth, (user)=>{
  isAdmin = !!user;
  adminToggle.dataset.signedIn = isAdmin ? "true" : "false";
  adminToggle.textContent = isAdmin ? "🔓" : "🔒";
  fab.dataset.visible = isAdmin ? "true" : "false";
  if(isAdmin){
    loginArea.style.display = "none";
    signedInArea.style.display = "block";
    $("#signedInEmail").textContent = user.email;
  }else{
    loginArea.style.display = "block";
    signedInArea.style.display = "none";
  }
  if(loaded) renderCards();
});

/* ============================= MOBILE BOTTOM NAV ============================= */
const mobileNav = $("#mobileNav");
const exploreBackdrop = $("#exploreBackdrop"), exploreSheet = $("#exploreSheet"), exploreGrid = $("#exploreGrid");
const moreBackdrop = $("#moreBackdrop"), moreSheet = $("#moreSheet");

function buildExploreGrid(){
  exploreGrid.innerHTML = CATS.map(c=>`<div class="discover-tile ${c.id}" data-cat="${c.id}">
      <div class="discover-tile-icon">${CAT_ICON[c.id]||""}</div>
      <div class="discover-tile-label">${c.label}</div>
      <div class="discover-tile-count">${DATA[c.id].length} entries</div>
    </div>`).join("");
  exploreGrid.querySelectorAll(".discover-tile").forEach(t=>{
    t.addEventListener("click", ()=>{
      closeSheetEl(exploreBackdrop, exploreSheet);
      goToCategory(t.dataset.cat);
    });
  });
}

function updateMobileNavActive(){
  mobileNav.querySelectorAll(".mobile-nav-btn").forEach(btn=>{
    btn.dataset.active = (btn.dataset.mnav==="home" && state.cat==="home") ? "true" : "false";
  });
}

mobileNav.querySelectorAll(".mobile-nav-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const which = btn.dataset.mnav;
    if(which==="home"){
      goToCategory("home");
    } else if(which==="explore"){
      buildExploreGrid();
      openSheetEl(exploreBackdrop, exploreSheet);
    } else if(which==="search"){
      window.scrollTo({top:0, behavior:"smooth"});
      setTimeout(()=> searchInput.focus(), 250);
    } else if(which==="more"){
      openSheetEl(moreBackdrop, moreSheet);
    }
    updateMobileNavActive();
  });
});
exploreBackdrop.addEventListener("click", ()=> closeSheetEl(exploreBackdrop, exploreSheet));
$("#exploreClose").addEventListener("click", ()=> closeSheetEl(exploreBackdrop, exploreSheet));
moreBackdrop.addEventListener("click", ()=> closeSheetEl(moreBackdrop, moreSheet));
$("#moreClose").addEventListener("click", ()=> closeSheetEl(moreBackdrop, moreSheet));

$("#moreQuickHero").addEventListener("click", ()=>{
  closeSheetEl(moreBackdrop, moreSheet);
  goToCategory("movies", { sortMode:"hero" });
});
$("#moreQuickStory").addEventListener("click", ()=>{
  closeSheetEl(moreBackdrop, moreSheet);
  goToCategory("movies", { sortMode:"story" });
});
$("#moreQuickTopRated").addEventListener("click", ()=>{
  closeSheetEl(moreBackdrop, moreSheet);
  goToCategory("movies", { sortMode:"rating" });
});
$("#moreAdmin").addEventListener("click", ()=>{
  closeSheetEl(moreBackdrop, moreSheet);
  openSheetEl(loginBackdrop, loginSheet);
});

/* ============================= ADMIN: IMPORT STARTER DATA (first-time, all 4) ============================= */
const importBtn = $("#importBtn");
const importMsg = $("#importMsg");
importBtn.addEventListener("click", async ()=>{
  const alreadyHas = CATS.some(c => DATA[c.id].length > 0);
  if(alreadyHas && !confirm("Some collections already have entries. Importing again may create duplicates. Continue anyway?")) return;
  importBtn.disabled = true;
  importMsg.className = "form-msg";
  try{
    importMsg.textContent = "Fetching seed-data.json…";
    const res = await fetch("./seed-data.json", { cache: "no-store" });
    if(!res.ok) throw new Error("seed-data.json not found next to index.html");
    const seed = await res.json();
    for(const cat of Object.keys(seed)){
      const items = seed[cat];
      for(let i=0;i<items.length;i++){
        importMsg.textContent = `Importing ${cat}: ${i+1} / ${items.length}…`;
        const ref = await addDoc(collection(db, cat), items[i]);
        DATA[cat].push({ id: ref.id, ...items[i] });
      }
    }
    importMsg.textContent = "Done — all starter entries imported.";
    importMsg.className = "form-msg ok";
    buildTabs();
    renderCards();
  }catch(err){
    importMsg.textContent = "Import failed: " + err.message;
    importMsg.className = "form-msg err";
  }finally{
    importBtn.disabled = false;
  }
});

/* ============================= ADMIN: REPLACE MOVIES + SERIES (expanded dataset) ============================= */
const replaceBtn = $("#replaceMSBtn");
const replaceMsg = $("#replaceMSMsg");
if(replaceBtn){
  replaceBtn.addEventListener("click", async ()=>{
    if(!confirm(`This deletes all existing Movies, Series, and Games entries, then loads the expanded dataset (153 movies, 85 series, 21 games). Continue?`)) return;
    replaceBtn.disabled = true;
    replaceMsg.className = "form-msg";
    try{
      replaceMsg.textContent = "Fetching expanded dataset…";
      const res = await fetch("./seed-data.json", { cache: "no-store" });
      if(!res.ok) throw new Error("seed-data.json not found");
      const seed = await res.json();

      for(const cat of ["movies","series","games"]){
        const existing = DATA[cat];
        for(let i=0;i<existing.length;i++){
          replaceMsg.textContent = `Deleting old ${cat}: ${i+1} / ${existing.length}…`;
          await deleteDoc(doc(db, cat, existing[i].id));
        }
        DATA[cat] = [];

        const items = seed[cat] || [];
        for(let i=0;i<items.length;i++){
          replaceMsg.textContent = `Importing new ${cat}: ${i+1} / ${items.length}…`;
          const ref = await addDoc(collection(db, cat), items[i]);
          DATA[cat].push({ id: ref.id, ...items[i] });
        }
      }
      replaceMsg.textContent = "Done — Movies, Series, and Games replaced with the expanded dataset.";
      replaceMsg.className = "form-msg ok";
      buildTabs();
      renderCards();
    }catch(err){
      replaceMsg.textContent = "Replace failed: " + err.message;
      replaceMsg.className = "form-msg err";
    }finally{
      replaceBtn.disabled = false;
    }
  });
}

/* ============================= ADMIN: ADD ENTRY ============================= */
const addBackdrop = $("#addBackdrop"), addSheet = $("#addSheet");
const addCategory = $("#addCategory"), addFormFields = $("#addFormFields"), addMsg = $("#addMsg");

fab.addEventListener("click", ()=>{
  addCategory.value = state.cat;
  buildAddForm();
  openSheetEl(addBackdrop, addSheet);
});
addBackdrop.addEventListener("click", ()=> closeSheetEl(addBackdrop, addSheet));
$("#addClose").addEventListener("click", ()=> closeSheetEl(addBackdrop, addSheet));
$("#addCancel").addEventListener("click", ()=> closeSheetEl(addBackdrop, addSheet));
addCategory.addEventListener("change", buildAddForm);

function buildAddForm(){
  const fields = SCHEMA[addCategory.value];
  addFormFields.innerHTML = fields.map(f=>{
    if(f.type==="textarea"){
      return `<div class="form-group"><label>${f.label}</label><textarea data-field="${f.key}" placeholder="${f.placeholder||""}"></textarea></div>`;
    }
    if(f.type==="select"){
      return `<div class="form-group"><label>${f.label}</label><select data-field="${f.key}">${f.options.map(o=>`<option value="${o}">${o}</option>`).join("")}</select></div>`;
    }
    return `<div class="form-group"><label>${f.label}</label><input type="text" data-field="${f.key}" placeholder="${f.placeholder||""}"></div>`;
  }).join("");
  addMsg.textContent = ""; addMsg.className = "form-msg";
}
buildAddForm();

$("#addSubmit").addEventListener("click", async ()=>{
  const cat = addCategory.value;
  const fields = SCHEMA[cat];
  const entry = {};
  for(const f of fields){
    const el = addFormFields.querySelector(`[data-field="${f.key}"]`);
    let val = el.value.trim();
    if(f.required && !val){
      addMsg.textContent = `${f.label} is required.`;
      addMsg.className = "form-msg err";
      el.focus();
      return;
    }
    if(f.key==="hero" && val) val = val.split(",").map(s=>s.trim()).filter(Boolean);
    else if(f.key==="hero") val = [];
    if(f.key==="plats" && val) val = val.split(",").map(s=>s.trim()).filter(Boolean);
    if((f.key==="rt"||f.key==="imdb"||f.key==="seasons"||f.key==="episodes") && val!=="") val = Number(val);
    entry[f.key] = val;
  }
  addMsg.textContent = "Adding…"; addMsg.className = "form-msg";
  try{
    const ref = await addDoc(collection(db, cat), entry);
    DATA[cat].push({ id:ref.id, ...entry });
    addMsg.textContent = "Added."; addMsg.className = "form-msg ok";
    buildTabs();
    if(state.cat===cat) renderCards();
    setTimeout(()=>{
      closeSheetEl(addBackdrop, addSheet);
      buildAddForm();
    }, 500);
  }catch(err){
    addMsg.textContent = "Couldn't save — check you're still signed in.";
    addMsg.className = "form-msg err";
  }
});
