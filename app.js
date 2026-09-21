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
  movies:"Every DC film — pick Live Action or Animated, then sort by newest, by character, by connected timeline, or by rating.",
  series:"Every DC TV series — pick Live Action or Animated, then sort by newest, by character, by connected timeline, or by rating.",
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
    {key:"hero", label:"Hero(es) — comma separated, only if 2+ standalones exist", type:"text", required:false, placeholder:"e.g. Batman, Justice League"},
    {key:"rt", label:"Rotten Tomatoes % (blank if none)", type:"text", required:false},
    {key:"imdb", label:"IMDb rating out of 10 (blank if none)", type:"text", required:false},
    {key:"blurb", label:"Summary", type:"textarea", required:true},
  ],
  series: [
    {key:"t", label:"Title", type:"text", required:true},
    {key:"y", label:"Year(s)", type:"text", required:true, placeholder:"e.g. 2019–2023"},
    {key:"type", label:"Type", type:"select", options:["Live Action","Animated"], required:true},
    {key:"connected", label:"Connected story / timeline", type:"text", required:true, placeholder:"e.g. Arrowverse, DCU (Gunnverse), Standalone"},
    {key:"hero", label:"Hero(es) — comma separated, only if 2+ standalones exist", type:"text", required:false, placeholder:"e.g. Flash, Justice League"},
    {key:"seasons", label:"Seasons (number, blank if TBA)", type:"text", required:false},
    {key:"episodes", label:"Total episodes (number, blank if TBA)", type:"text", required:false},
    {key:"rt", label:"Rotten Tomatoes % (blank if none)", type:"text", required:false},
    {key:"imdb", label:"IMDb rating out of 10 (blank if none)", type:"text", required:false},
    {key:"blurb", label:"Summary", type:"textarea", required:true},
  ],
  games: [
    {key:"t", label:"Title", type:"text", required:true},
    {key:"y", label:"Year", type:"text", required:true},
    {key:"fr", label:"Franchise", type:"text", required:true, placeholder:"e.g. Batman: Arkham, Injustice"},
    {key:"plat", label:"Platform", type:"text", required:true, placeholder:"e.g. Multi-platform"},
    {key:"blurb", label:"Summary", type:"textarea", required:true},
  ],
  comics: [
    {key:"t", label:"Title", type:"text", required:true},
    {key:"y", label:"Year(s)", type:"text", required:true},
    {key:"era", label:"Era", type:"text", required:true, placeholder:"e.g. Golden Age, New 52, Dawn of DC"},
    {key:"canon", label:"Canon status", type:"select", required:true,
      options:["Main Continuity","Elseworlds","Alternate Universe","Imprint — Vertigo","Imprint — Black Label"]},
    {key:"line", label:"Character line", type:"text", required:true, placeholder:"e.g. Batman, Justice League, Vertigo/Mature"},
    {key:"fmt", label:"Collected formats", type:"text", required:true, placeholder:"e.g. TPB, Omnibus, Absolute Edition"},
    {key:"ord", label:"Where it fits / reading order", type:"textarea", required:true},
    {key:"blurb", label:"Summary", type:"textarea", required:true},
  ],
};

/* ============================= STATE ============================= */
let DATA = { movies:[], series:[], games:[], comics:[] };
let state = {
  cat:"comics",
  search:"",
  f1:"all", f2:"all", chip:"all",         // games/comics filters (unchanged behavior)
  typeFilter:"Live Action",                // movies/series: Live Action | Animated
  sortMode:"newest",                       // movies/series: newest | hero | story | rating
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
const HERO_PRIORITY = ["Batman","Superman","Wonder Woman","Aquaman","Justice League","Flash","Suicide Squad","Harley Quinn","Joker","Green Lantern","Shazam"];
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
function buildTabs(){
  tabsEl.innerHTML = CATS.map(c=>{
    const n = DATA[c.id].length;
    return `<button class="tab-btn" data-cat="${c.id}" data-active="${state.cat===c.id}">${c.label}<span class="n">${n}</span></button>`;
  }).join("");
  tabsEl.querySelectorAll(".tab-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      state.cat = btn.dataset.cat;
      state.f1="all"; state.f2="all"; state.chip="all"; state.search="";
      state.sortMode="newest";
      searchInput.value="";
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

  if(cat==="movies" || cat==="series"){
    buildMovieSeriesFilters(cat);
    return;
  }

  const data = DATA[cat];

  if(cat==="games"){
    const frs = uniq(data.map(d=>d.fr));
    chipRow.innerHTML = `<div class="chip games" data-val="all" data-active="${state.f1==='all'}">All</div>` +
      frs.map(f=>`<div class="chip games" data-val="${f}" data-active="${state.f1===f}">${f}</div>`).join("");
    chipRow.querySelectorAll(".chip").forEach(ch=>{
      ch.addEventListener("click", ()=>{
        state.f1 = ch.dataset.val;
        chipRow.querySelectorAll(".chip").forEach(c=>c.dataset.active = (c.dataset.val===state.f1));
        renderCards();
      });
    });
  }

  if(cat==="comics"){
    const eras = uniq(data.map(d=>d.era));
    const canons = uniq(data.map(d=>d.canon));
    const lines = uniq(data.map(d=>d.line));
    filterRow.innerHTML = `
      <select id="selEra"><option value="all">All eras</option>${eras.map(e=>`<option value="${e}">${e}</option>`).join("")}</select>
      <select id="selCanon"><option value="all">All canon status</option>${canons.map(c=>`<option value="${c}">${c}</option>`).join("")}</select>`;
    $("#selEra").addEventListener("change", e=>{ state.f1=e.target.value; renderCards(); });
    $("#selCanon").addEventListener("change", e=>{ state.f2=e.target.value; renderCards(); });
    $("#selEra").value = state.f1; $("#selCanon").value = state.f2;

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
  filterRow.innerHTML = `
    <div class="radio-row">
      <label class="radio-pill ${cat}"><input type="radio" name="typeFilter" value="Live Action" ${state.typeFilter==="Live Action"?"checked":""}> Live Action</label>
      <label class="radio-pill ${cat}"><input type="radio" name="typeFilter" value="Animated" ${state.typeFilter==="Animated"?"checked":""}> Animated</label>
    </div>`;
  filterRow.querySelectorAll('input[name="typeFilter"]').forEach(r=>{
    r.addEventListener("change", e=>{ state.typeFilter = e.target.value; renderCards(); });
  });

  const modes = [
    {id:"newest", label:"Newest → Oldest"},
    {id:"hero", label:"By Character"},
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
    if(cat==="games"){ if(state.f1!=="all" && d.fr!==state.f1) return false; }
    if(cat==="comics"){
      if(state.f1!=="all" && d.era!==state.f1) return false;
      if(state.f2!=="all" && d.canon!==state.f2) return false;
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
  if(cat==="games") return `<span class="tag">${d.fr||""}</span><span class="tag">${d.plat||""}</span>`;
  if(cat==="comics") return `<span class="tag">${d.era||""}</span><span class="tag ${canonTagClass(d.canon)}">${d.canon||""}</span><span class="tag">${d.line||""}</span>`;
  return "";
}

/* ============================= RENDER: CARDS (movies/series) ============================= */
function filteredMovieSeries(){
  const cat = state.cat;
  const q = state.search.trim().toLowerCase();
  return DATA[cat].filter(d=>{
    if(d.type !== state.typeFilter) return false;
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
function ratingLabel(d){
  const parts = [];
  if(d.rt !== null && d.rt !== undefined && d.rt !== "") parts.push(`🍅 ${d.rt}%`);
  if(d.imdb !== null && d.imdb !== undefined && d.imdb !== "") parts.push(`⭐ ${d.imdb}`);
  return parts.join(" · ");
}

function cardHtml(cat, d){
  const meta = (cat==="movies"||cat==="series") ? movieSeriesMetaTags(cat, d) : metaTagsGeneric(cat, d);
  return `<div class="card ${cat}" data-id="${d.id}">
      <div class="card-top"><div class="card-title">${d.t}</div><div class="card-year">${d.y||""}</div></div>
      <div class="card-meta">${meta}</div>
      <div class="card-blurb">${d.blurb||""}</div>
      ${isAdmin ? `<div class="card-admin-row"><button class="mini-btn danger" data-del="${d.id}">Delete</button></div>` : ""}
    </div>`;
}
function groupHeaderHtml(label, count){
  return `<div class="group-header">${label}<span class="group-count">${count}</span></div>`;
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
    const heroMap = {};
    const other = [];
    items.forEach(d=>{
      const heroes = heroList(d);
      if(heroes.length===0){ other.push(d); return; }
      heroes.forEach(h=>{ (heroMap[h] = heroMap[h] || []).push(d); });
    });
    const heroNames = sortHeroNames(heroMap);
    heroNames.forEach(h=>{
      const list = heroMap[h].sort((a,b)=>firstYear(b.y)-firstYear(a.y));
      html += groupHeaderHtml(h, list.length) + list.map(d=>cardHtml(cat,d)).join("");
    });
    if(other.length){
      const list = other.sort((a,b)=>firstYear(b.y)-firstYear(a.y));
      html += groupHeaderHtml("Ensemble / Other", list.length) + list.map(d=>cardHtml(cat,d)).join("");
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
      html += groupHeaderHtml(g, list.length) + list.map(d=>cardHtml(cat,d)).join("");
    });
  }
  gridEl.innerHTML = html;
  attachCardHandlers(cat);
}

function attachCardHandlers(cat){
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
  gridEl.innerHTML = items.map(d=>cardHtml(cat,d)).join("");
  attachCardHandlers(cat);
}

function renderCards(){
  if(!loaded) return;
  if(state.cat==="movies" || state.cat==="series") renderMovieSeriesCards();
  else renderGenericCards();
}
function render(){ buildTabs(); buildFilters(); renderCards(); }

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

function openSheet(d){
  const cat = state.cat;
  let html = `<div class="sheet-eyebrow">${cat.toUpperCase()} · ${d.y||""}</div><h2>${d.t}</h2>`;

  if(cat==="movies"||cat==="series"){
    html += `<div class="sheet-tags">${movieSeriesMetaTags(cat, d)}</div>`;
    html += `<div class="sheet-section"><div class="sheet-label">ABOUT</div><div class="sheet-body">${d.blurb||""}</div></div>`;

    if(cat==="series" && d.seasons){
      html += `<div class="sheet-section"><div class="sheet-label">SEASONS</div><div class="sheet-body">`;
      html += `${d.seasons} season${d.seasons==1?"":"s"}${d.episodes?`, ${d.episodes} episodes total`:""} — tap a season to see episodes</div>`;
      html += `<div class="season-chips">`;
      for(let i=1;i<=d.seasons;i++) html += `<span class="season-chip" data-season="${i}">S${i}</span>`;
      html += `</div><div id="episodeList"></div></div>`;
    }

    const related = relatedInUniverse(d.connected, cat, d.id);
    if(related.length){
      html += `<div class="sheet-section"><div class="sheet-label">SAME TIMELINE — ${(d.connected||"").toUpperCase()}</div>`;
      html += related.map(r=>`<div class="related-row" data-related-cat="${r._cat}" data-related-id="${r.id}"><span class="related-year">${r.y}</span> ${r.t} <span class="related-type">${r._cat}</span></div>`).join("");
      html += `</div>`;
    }
  } else {
    html += `<div class="sheet-tags">${metaTagsGeneric(cat, d)}</div>`;
    html += `<div class="sheet-section"><div class="sheet-label">ABOUT</div><div class="sheet-body">${d.blurb||""}</div></div>`;
    if(cat==="comics"){
      html += `<div class="sheet-section"><div class="sheet-label">WHERE IT FITS / READING ORDER</div><div class="sheet-body">${d.ord||""}</div></div>`;
      html += `<div class="sheet-section"><div class="sheet-label">COLLECTED FORMATS</div><div class="sheet-body">${d.fmt||""}</div></div>`;
    }
  }

  sheetContent.innerHTML = html;

  sheetContent.querySelectorAll("[data-season]").forEach(chip=>{
    chip.addEventListener("click", ()=>{
      sheetContent.querySelectorAll(".season-chip").forEach(c=>c.dataset.active="false");
      chip.dataset.active = "true";
      renderEpisodeList(d, chip.dataset.season);
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
backdrop.addEventListener("click", ()=>closeSheetEl(backdrop, sheet));
$("#sheetClose").addEventListener("click", ()=>closeSheetEl(backdrop, sheet));

let searchTimer;
searchInput.addEventListener("input", e=>{
  clearTimeout(searchTimer);
  const v = e.target.value;
  searchTimer = setTimeout(()=>{ state.search = v; renderCards(); }, 120);
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
    if(!confirm(`This deletes all existing Movies and Series entries, then loads the expanded dataset (153 movies, 85 series). Continue?`)) return;
    replaceBtn.disabled = true;
    replaceMsg.className = "form-msg";
    try{
      replaceMsg.textContent = "Fetching expanded dataset…";
      const res = await fetch("./seed-data.json", { cache: "no-store" });
      if(!res.ok) throw new Error("seed-data.json not found");
      const seed = await res.json();

      for(const cat of ["movies","series"]){
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
      replaceMsg.textContent = "Done — Movies and Series replaced with the expanded dataset.";
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
