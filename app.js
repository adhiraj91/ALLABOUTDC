import { db, auth } from "./firebase-config.js";
import {
  collection, getDocs, addDoc, deleteDoc, doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider,
  signOut, onAuthStateChanged
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
  journey:"Your favorites and progress, saved on this device — tap ♡ on any title, or \"Mark as Watched/Read/Played\", to track them here.",
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
// META_COLLECTIONS: non-title-record collections (curated editorial data, not movies/series/games/comics
// entries themselves) — loaded the same way but never shown as a browse tab.
const META_COLLECTIONS = ["beginnerRecommendations"];
let DATA = { movies:[], series:[], games:[], comics:[], beginnerRecommendations:[] };
let state = {
  cat:"home",
  search:"",
  f1:"all", f2:"all", f3:"all", chip:"all", // games/comics filters (f3: comics reading level)
  typeFilter:"Live Action",                // movies/series: Live Action | Animated
  sortMode:"newest",                       // movies/series: newest | hero | story | rating
  viewerLevelFilter:"all", complexityFilter:"all", canonFilter:"all", // movies/series: new filters (Phase 1, Task 7)
  gameMode:"all", gamePlatform:"all",      // games: all | platform | story
  nerdMode: (localStorage.getItem("dc_nerd_mode") === "true"), // Phase 4, Task 22
};
let isAdmin = false;
let loaded = false;
// readerUser: the signed-in Firebase Auth user acting as a READER (personalization/sync), independent of
// isAdmin (a role, checked separately against the admins/{uid} collection — see checkIsAdmin below). Any
// signed-in user, including the admin, has a reader profile under their own uid.
let readerUser = null;

/* ============================= MY JOURNEY: favorites & progress (Phase 3, extended Phase 1) =============================
   localStorage is always the fast, always-available local cache — every read/write goes through it first so
   the UI never waits on a network round trip. When a reader is signed in, every change is ALSO mirrored to
   Firestore under users/{uid}/favorites|progress (fire-and-forget), and on login we merge local + cloud data
   both ways so favorites/progress follow the reader across devices without losing anything. Logged-out
   visitors keep working exactly as before, per-device only. */
const LS_FAV_KEY = "dc_favorites";
const LS_PROGRESS_KEY = "dc_progress";
function lsGetJson(key, fallback){
  try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch(e){ return fallback; }
}
function lsSetJson(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){ /* storage unavailable — fail quietly */ }
}
function itemKey(cat, id){ return `${cat}:${id}`; }
function getFavorites(){ return lsGetJson(LS_FAV_KEY, []); }
function isFavorite(cat, id){ return getFavorites().includes(itemKey(cat,id)); }
function syncFavoriteToCloud(cat, id, active){
  if(!readerUser) return;
  const ref = doc(db, "users", readerUser.uid, "favorites", itemKey(cat,id));
  const p = active
    ? setDoc(ref, { cat, titleId:id, addedAt: serverTimestamp() })
    : deleteDoc(ref);
  p.catch(e=>console.warn("[Reader] favorite sync failed:", e.message));
}
function toggleFavorite(cat, id){
  const key = itemKey(cat,id);
  let favs = getFavorites();
  if(favs.includes(key)) favs = favs.filter(k=>k!==key);
  else favs = [...favs, key];
  lsSetJson(LS_FAV_KEY, favs);
  const nowActive = favs.includes(key);
  syncFavoriteToCloud(cat, id, nowActive);
  return nowActive;
}
function getProgress(){ return lsGetJson(LS_PROGRESS_KEY, {}); }
function isDone(cat, id){ return !!getProgress()[itemKey(cat,id)]; }
function syncProgressToCloud(cat, id, done){
  if(!readerUser) return;
  const ref = doc(db, "users", readerUser.uid, "progress", itemKey(cat,id));
  const p = done
    ? setDoc(ref, { cat, titleId:id, done:true, updatedAt: serverTimestamp() })
    : deleteDoc(ref);
  p.catch(e=>console.warn("[Reader] progress sync failed:", e.message));
}
function toggleDone(cat, id){
  const key = itemKey(cat,id);
  const prog = getProgress();
  if(prog[key]) delete prog[key];
  else prog[key] = true;
  lsSetJson(LS_PROGRESS_KEY, prog);
  const nowDone = !!prog[key];
  syncProgressToCloud(cat, id, nowDone);
  return nowDone;
}
const PROGRESS_VERB = { movies:"Watched", series:"Watched", games:"Played", comics:"Read" };

/* ---- Reader account: profile, admin-role check, and local↔cloud merge on login ---- */
async function upsertReaderProfile(user){
  const ref = doc(db, "users", user.uid);
  const base = { displayName:user.displayName||"", email:user.email||"", photoURL:user.photoURL||"", lastLoginAt: serverTimestamp() };
  try{
    const snap = await getDoc(ref);
    if(snap.exists()) await updateDoc(ref, base);
    else await setDoc(ref, { ...base, createdAt: serverTimestamp() });
  }catch(e){ console.warn("[Reader] profile upsert failed:", e.message); }
}
// Admin is a separate ROLE, not "any signed-in user" — checked against a server-side allowlist
// (admins/{uid}) that only Firestore security rules and the site owner (via the Firebase console) can
// write to. A reader signing up/in through Google or email/password can never become admin this way.
async function checkIsAdmin(uid){
  try{
    const snap = await getDoc(doc(db, "admins", uid));
    return snap.exists();
  }catch(e){ return false; }
}
async function pushLocalDataToCloud(uid){
  const localFavs = getFavorites();
  const localProg = getProgress();
  const [favSnap, progSnap] = await Promise.all([
    getDocs(collection(db, "users", uid, "favorites")),
    getDocs(collection(db, "users", uid, "progress")),
  ]);
  const cloudFavKeys = new Set(favSnap.docs.map(d=>d.id));
  const cloudProgKeys = new Set(progSnap.docs.map(d=>d.id));
  const writes = [];
  localFavs.forEach(key=>{
    if(cloudFavKeys.has(key)) return; // merge, never duplicate
    const [cat,id] = key.split(":");
    writes.push(setDoc(doc(db,"users",uid,"favorites",key), { cat, titleId:id, addedAt: serverTimestamp() }));
  });
  Object.keys(localProg).forEach(key=>{
    if(!localProg[key] || cloudProgKeys.has(key)) return;
    const [cat,id] = key.split(":");
    writes.push(setDoc(doc(db,"users",uid,"progress",key), { cat, titleId:id, done:true, updatedAt: serverTimestamp() }));
  });
  await Promise.all(writes);
}
async function pullCloudDataToLocal(uid){
  const [favSnap, progSnap] = await Promise.all([
    getDocs(collection(db, "users", uid, "favorites")),
    getDocs(collection(db, "users", uid, "progress")),
  ]);
  const mergedFavs = uniq([...getFavorites(), ...favSnap.docs.map(d=>d.id)]);
  lsSetJson(LS_FAV_KEY, mergedFavs);
  const mergedProg = { ...getProgress() };
  progSnap.docs.forEach(d=>{ mergedProg[d.id] = true; });
  lsSetJson(LS_PROGRESS_KEY, mergedProg);
}
// Runs once per reader account (marked via users/{uid}/meta/migration) to migrate this device's
// pre-existing localStorage favorites/progress into the cloud without overwriting anything already there,
// then always pulls the merged cloud state back down — so returning on ANY device, in ANY order, converges
// on the same union of data rather than one device's copy clobbering another's.
async function onReaderLogin(uid){
  try{
    const migRef = doc(db, "users", uid, "meta", "migration");
    const migSnap = await getDoc(migRef);
    if(!migSnap.exists() || !migSnap.data().localStorageMigrated){
      await pushLocalDataToCloud(uid);
      await setDoc(migRef, { localStorageMigrated:true, migratedAt: serverTimestamp() });
    }
    await pullCloudDataToLocal(uid);
    await pullJourneyFromCloud(uid);
  }catch(e){
    console.warn("[Reader] login sync failed:", e.message);
  }
}

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
  // Beginner-guide editorial data (curated paths / starter picks) — same Firestore pattern as the
  // title collections above, but not shown as a browse tab. Safe to be empty (admin hasn't imported
  // it yet, or is mid-setup) — the Start Here experience falls back gracefully either way.
  for(const key of META_COLLECTIONS){
    try{
      const snap = await getDocs(collection(db, key));
      DATA[key] = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    }catch(e){
      console.warn(`[Beginner Guide] Couldn't load "${key}":`, e.message);
      DATA[key] = [];
    }
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

/* ============================= BEGINNER GUIDE ("New to DC?") =============================
   Curated recommendation data (DATA.beginnerRecommendations) is loaded from
   Firestore like everything else, but it never duplicates a title record — every recommendation
   references an existing movies/series/games/comics entry via a stable "titleKey" of the form
   "<category>::<title>::<year>", resolved against the real catalogue at render time. There is no
   Firestore document ID to reference here: seed-data.json entries have none (Firestore assigns one
   only at import, and it changes every time an admin re-imports), so title+year is the only stable,
   human-readable key that survives a re-import. */
function resolveTitleKey(key){
  if(!key || typeof key !== "string") return null;
  const parts = key.split("::");
  if(parts.length < 3) return null;
  const cat = parts[0];
  const y = parts[parts.length - 1];
  const t = parts.slice(1, -1).join("::");
  if(!DATA[cat]) return null;
  const d = DATA[cat].find(x => x.t === t && String(x.y) === String(y));
  if(!d){
    console.warn(`[Beginner Guide] Could not resolve titleKey "${key}" against current data — skipping this card.`);
    return null;
  }
  return { d, cat };
}
// accessibility(): how beginner-friendly a single title is, derived from its own existing
// viewerLevel/complexity (movies/series/games) or readingLevel (comics) — 0-25, higher = easier.
// Never stored as separate metadata; always computed from real catalogue fields.
function accessibility(cat, d){
  if(cat === "comics"){
    const rl = d.readingLevel;
    if(rl === "New Reader") return 25;
    if(rl === "Familiar Reader") return 15;
    if(rl === "Experienced Reader") return 5;
    return 0; // Hardcore
  }
  let score = 0;
  const vl = d.viewerLevel, cx = d.complexity;
  if(vl === "New Viewer") score += 15;
  else if(vl === "Familiar Viewer") score += 8;
  else if(vl === "Experienced Viewer") score += 2;
  if(cx === "Low") score += 10;
  else if(cx === "Medium") score += 5;
  return score;
}

/* ============================= "NEW TO DC?" — hero picker + ranked recommendation engine =============================
   Rebuilt per spec: Step 1 shows ONLY individual hero characters (never teams/universes/media types).
   Config lives here, separate from any title's own "group" field, so the hero list is an explicit,
   curated set rather than something derived blindly from the data. */
const BEGINNER_CHARACTERS = [
  { id:"batman",        label:"Batman",        group:"Batman" },
  { id:"superman",       label:"Superman",      group:"Superman" },
  { id:"wonder-woman",   label:"Wonder Woman",  group:"Wonder Woman" },
  { id:"flash",          label:"The Flash",     group:"Flash" },
  { id:"aquaman",        label:"Aquaman",       group:"Aquaman" },
  { id:"green-lantern",  label:"Green Lantern", group:"Green Lantern" },
];
const MEDIUM_OPTIONS = [
  { id:"all", label:"Everything" }, { id:"movies", label:"🎬 Movies" }, { id:"series", label:"📺 Series" },
  { id:"comics", label:"📖 Comics" }, { id:"games", label:"🎮 Games" },
];
// Intent-based, NOT expertise-based — the user already told us they're new to DC.
const START_INTENTS = [
  { id:"easiest",    label:"Give me the easiest place to start" },
  { id:"meet-hero",  label:"I want to meet this hero" },
  { id:"universe",   label:"I want to understand the bigger DC Universe" },
  { id:"standalone", label:"I want a great standalone story" },
  { id:"comics",     label:"I want to start with comics" },
  { id:"surprise",   label:"Surprise me" },
];
function firstSentence(text){
  if(!text || typeof text !== "string") return "";
  const m = text.match(/^[^.!?]*[.!?]/);
  const s = m ? m[0].trim() : text.trim();
  return s.length > 160 ? s.slice(0,157).trim() + "…" : s;
}
// Curated editorial data (DATA.beginnerRecommendations) never duplicates a title record — each entry
// references an existing title via the same "cat::title::year" titleKey used elsewhere, keyed here per
// hero for fast lookup during scoring.
function buildCuratedMap(heroId){
  const map = new Map();
  (DATA.beginnerRecommendations || []).forEach(r=>{
    if(!Array.isArray(r.characterIds) || !r.characterIds.includes(heroId)) return;
    const hit = resolveTitleKey(r.titleKey);
    if(!hit) return;
    map.set(itemKey(hit.cat, hit.d.id), r);
  });
  return map;
}
// Ranked scoring — NOT a simple filter intersection. Character match dominates, then curated editorial
// data, then medium (a soft preference, never a hard filter), then intent-specific heuristics drawn from
// each title's real canonStatus/canon + accessibility, and rating only as a final tiebreaker.
function scoreCandidate(cat, d, hero, medium, intent, curatedMap){
  let score = 0;
  const group = groupOf(cat, d);
  const heroes = heroList(d);
  const heroNameBare = hero.label.replace(/^The\s+/i,"").toLowerCase();
  if(group === hero.group) score += 40;                       // 1. strong character match (own hub)
  else if(heroes.some(h=>h.toLowerCase().includes(heroNameBare))) score += 22; // hero appears, different group (e.g. team-up)

  const cur = curatedMap.get(itemKey(cat, d.id));
  if(cur){                                                      // 2. editorial curation
    score += 45 + (Number(cur.priority)||0) * 3;
    if(cur.starter) score += 12;
    if(cur.intent === intent) score += 15;
    if(cur.mediaType && (cur.mediaType === medium || medium === "all")) score += 5;
  }
  if(medium !== "all" && cat === medium) score += 15;           // 3. medium preference (soft)

  const canonVal = cat === "comics" ? d.canon : d.canonStatus;  // 4. intent heuristics on real fields
  const acc = accessibility(cat, d);
  if(intent === "easiest"){
    score += acc;
  } else if(intent === "meet-hero"){
    score += acc * 0.6;
    if(canonVal && /Standalone/.test(canonVal)) score += 8;
  } else if(intent === "universe"){
    if(canonVal && /(Shared Universe|Main Canon)/.test(canonVal)) score += 18;
    score += acc * 0.3;
  } else if(intent === "standalone"){
    if(canonVal && /(Standalone|Black Label)/.test(canonVal)) score += 20;
  } else if(intent === "comics"){
    score += cat === "comics" ? 25 : -8;
  } else if(intent === "surprise"){
    let h = 0; const s = `${d.t}${d.y}`;
    for(let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) >>> 0;
    score += (h % 20) + acc * 0.2;
  }
  const r = ratingScore(d);                                      // 5. rating — last-resort tiebreaker
  if(r !== null) score += r / 12;
  return score;
}
function buildCandidatePool(hero){
  const pool = [];
  CATS.forEach(c=>{ (DATA[c.id]||[]).forEach(d=>{ if(groupOf(c.id,d)===hero.group) pool.push({cat:c.id,d}); }); });
  return pool;
}
function buildRelatedPool(hero, exclude){
  const pool = [];
  const heroNameBare = hero.label.replace(/^The\s+/i,"").toLowerCase();
  CATS.forEach(c=>{ (DATA[c.id]||[]).forEach(d=>{
    const key = itemKey(c.id, d.id);
    if(exclude.has(key)) return;
    if(heroList(d).some(h=>h.toLowerCase().includes(heroNameBare))) pool.push({cat:c.id,d});
  }); });
  return pool;
}
function buildBroaderPool(exclude){
  const pool = [];
  CATS.forEach(c=>{ (DATA[c.id]||[]).forEach(d=>{
    const key = itemKey(c.id, d.id);
    if(!exclude.has(key)) pool.push({cat:c.id,d});
  }); });
  return pool;
}
// 3-tier fallback cascade — guarantees a minimum of `minTarget` results whenever the catalogue has
// ANY titles at all, so "0 titles" can never happen again: exact hero group → hero-related titles in
// other groups → the broader catalogue, each tier ranked and appended rather than replacing the last.
function getRecommendations(heroId, medium, intent, opts){
  opts = opts || {};
  const limit = opts.limit || 6, minTarget = opts.minTarget || 3;
  const hero = BEGINNER_CHARACTERS.find(h=>h.id===heroId);
  if(!hero) return [];
  const curated = buildCuratedMap(heroId);
  const seen = new Set();
  const scoreAndRank = pool => pool.map(({cat,d})=>({
    cat, d,
    score: scoreCandidate(cat, d, hero, medium, intent, curated),
    reason: (curated.get(itemKey(cat,d.id))||{}).reason || firstSentence(d.blurb),
  })).sort((a,b)=>b.score-a.score);

  const tier1 = buildCandidatePool(hero);
  tier1.forEach(({cat,d})=>seen.add(itemKey(cat,d.id)));
  let ranked = scoreAndRank(tier1);

  if(ranked.length < minTarget){
    const tier2 = buildRelatedPool(hero, seen);
    tier2.forEach(({cat,d})=>seen.add(itemKey(cat,d.id)));
    ranked = ranked.concat(scoreAndRank(tier2)).sort((a,b)=>b.score-a.score);
  }
  if(ranked.length < minTarget){
    const tier3 = buildBroaderPool(seen);
    ranked = ranked.concat(scoreAndRank(tier3)).sort((a,b)=>b.score-a.score);
  }
  return ranked.slice(0, limit);
}

/* ---- Journey persistence: the saved "sequence" from a completed New to DC flow (Phase 2) ----
   Stored locally (fast, always available) and mirrored to users/{uid}/preferences/dcJourney when
   signed in. Titles are referenced by the same stable "cat::title::year" titleKey used by curated
   recommendation data — never a raw Firestore doc id, which changes on every catalogue re-import. */
const LS_JOURNEY_KEY = "dc_journey";
function getSavedJourney(){ return lsGetJson(LS_JOURNEY_KEY, null); }
function setSavedJourney(journey){
  lsSetJson(LS_JOURNEY_KEY, journey);
  if(readerUser) syncJourneyToCloud(readerUser.uid, journey);
}
function syncJourneyToCloud(uid, journey){
  if(!journey) return;
  const ref = doc(db, "users", uid, "preferences", "dcJourney");
  setDoc(ref, { ...journey, updatedAt: serverTimestamp() }).catch(e=>console.warn("[Reader] journey sync failed:", e.message));
}
async function pullJourneyFromCloud(uid){
  try{
    const snap = await getDoc(doc(db, "users", uid, "preferences", "dcJourney"));
    const local = getSavedJourney();
    if(snap.exists() && !local){
      lsSetJson(LS_JOURNEY_KEY, snap.data());
    } else if(local){
      // Local journey is the source of truth if both exist (avoid over-engineering a merge here) —
      // still push it up so a fresh device without one adopts it.
      syncJourneyToCloud(uid, local);
    }
  }catch(e){ console.warn("[Reader] journey pull failed:", e.message); }
}
/* ---- Phase 8 (CRITICAL): journey must not stop dead at completion. When every item is marked done,
   we surface real, working next-step choices. Each choice re-scores the catalogue with the same ranked
   engine used to build the original journey (scoreCandidate / buildCandidatePool / buildBroaderPool —
   never a random fill) and APPENDS new picks onto the same journey, excluding anything already in it —
   so the journey keeps growing rather than being replaced or duplicated. */
const JOURNEY_BRANCH_OPTIONS = [
  { id:"deeper",       label:h=>`Go deeper into ${h}`,          sub:"More of everything for this hero" },
  { id:"comics",       label:h=>`Explore ${h} comics`,          sub:"Add comic-book picks to your journey" },
  { id:"wider",        label:()=>"Explore the wider DC Universe", sub:"Branch out to shared-universe titles" },
  { id:"keepwatching", label:()=>"Keep watching",                sub:"More movies & series for this hero" },
  { id:"surprise",     label:()=>"Surprise me",                  sub:"A wildcard pick from the whole compendium" },
];
function journeyExistingKeys(journey){
  return new Set(journey.recommendedTitleKeys||[]);
}
// Extends (never replaces) the saved journey with new ranked picks. Returns how many were actually added
// so the UI can say plainly when a branch has nothing left to offer, instead of pretending it worked.
function extendJourney(mode){
  const journey = getSavedJourney();
  if(!journey) return { added:0 };
  const hero = BEGINNER_CHARACTERS.find(h=>h.id===journey.selectedHero);
  if(!hero) return { added:0 };
  const existingKeys = journeyExistingKeys(journey);

  let pool;
  if(mode==="wider" || mode==="surprise"){
    pool = buildBroaderPool(new Set()); // score against the whole catalogue, exclude below by key
  } else {
    pool = buildCandidatePool(hero); // same hero group — "deeper"/"comics"/"keepwatching"
  }
  if(mode==="comics") pool = pool.filter(p=>p.cat==="comics");
  if(mode==="keepwatching") pool = pool.filter(p=>p.cat==="movies" || p.cat==="series");

  const curated = buildCuratedMap(journey.selectedHero);
  const scoreIntent = mode==="wider" ? "universe" : (mode==="surprise" ? "surprise" : (journey.selectedIntent||"easiest"));
  const scoreMedium = mode==="comics" ? "comics" : (mode==="keepwatching" ? "movies" : (journey.selectedMedium||"all"));

  const scored = pool
    .map(p=>({ cat:p.cat, d:p.d, key:`${p.cat}::${p.d.t}::${p.d.y}` }))
    .filter(p=>!existingKeys.has(p.key))
    .map(p=>({ ...p, score:scoreCandidate(p.cat, p.d, hero, scoreMedium, scoreIntent, curated) }))
    .sort((a,b)=>b.score-a.score);

  const picks = scored.slice(0, 4);
  if(!picks.length) return { added:0 };

  journey.recommendedTitleKeys = [...(journey.recommendedTitleKeys||[]), ...picks.map(p=>p.key)];
  journey.updatedAt = new Date().toISOString();
  journey.branchHistory = journey.branchHistory || [];
  journey.branchHistory.push({ mode, at:journey.updatedAt, addedCount:picks.length });
  setSavedJourney(journey);
  return { added:picks.length, journey };
}
// Records when a journey item was marked done (journey-scoped only, not the site-wide progress store) so
// the "Recently Completed" section on My Journey (Phase 12) can show real completion order.
function recordJourneyCompletion(cat, id, done){
  const journey = getSavedJourney();
  if(!journey) return;
  const key = itemKey(cat, id);
  journey.completedAt = journey.completedAt || {};
  if(done) journey.completedAt[key] = new Date().toISOString();
  else delete journey.completedAt[key];
  setSavedJourney(journey);
}
function journeyCompletionHtml(journey, heroLabel){
  const buttons = JOURNEY_BRANCH_OPTIONS.map(opt=>
    `<button class="journey-branch-btn" data-branch="${opt.id}">
       <span class="journey-branch-label">${opt.label(heroLabel)}</span>
       <span class="journey-branch-sub">${opt.sub}</span>
     </button>`
  ).join("");
  return `<div class="journey-complete-block" id="journeyCompleteBlock">
      <div class="journey-complete-title">${heroLabel.toUpperCase()} STARTING PATH COMPLETE ✓</div>
      <div class="journey-complete-sub">You've got the basics. Where do you want to go next?</div>
      <div class="journey-branch-grid">${buttons}</div>
    </div>`;
}
function journeyNextUpHtml(nextItem){
  if(!nextItem) return "";
  const catLabel = (CATS.find(c=>c.id===nextItem.cat)||{}).label || nextItem.cat;
  return `<div class="journey-next-up" id="journeyNextUp" data-cat="${nextItem.cat}" data-id="${nextItem.d.id}">
      <span class="journey-next-up-label">NEXT UP</span>
      <span class="journey-next-up-title">${nextItem.d.t}<span class="bc-year">${nextItem.d.y||""}</span></span>
      <span class="journey-next-up-meta">${CAT_ICON[nextItem.cat]||""} ${catLabel}</span>
      <span class="journey-next-up-cta">Continue Journey →</span>
    </div>`;
}
function renderJourneySequenceHtml(journey){
  const items = (journey.recommendedTitleKeys||[]).map(resolveTitleKey).filter(Boolean);
  if(!items.length) return "";
  const heroLabel = (BEGINNER_CHARACTERS.find(h=>h.id===journey.selectedHero)||{}).label || "DC";
  const doneCount = items.filter(it=>isDone(it.cat, it.d.id)).length;
  const rows = items.map((it,i)=>{
    const done = isDone(it.cat, it.d.id);
    const catLabel = (CATS.find(c=>c.id===it.cat)||{}).label || it.cat;
    return `<div class="journey-seq-item" data-cat="${it.cat}" data-id="${it.d.id}">
        <div class="journey-seq-num" data-done="${done}">${done?"✓":i+1}</div>
        <div class="journey-seq-body">
          <div class="journey-seq-title">${it.d.t}<span class="bc-year">${it.d.y||""}</span></div>
          <div class="journey-seq-meta">${CAT_ICON[it.cat]||""} ${catLabel}</div>
        </div>
        <button class="btn btn-small journey-seq-toggle" data-cat="${it.cat}" data-id="${it.d.id}">${done?"Done":"Mark done"}</button>
      </div>`;
  }).join("");
  const allDone = doneCount===items.length;
  const nextItem = !allDone ? items.find(it=>!isDone(it.cat, it.d.id)) : null;
  const tail = allDone ? journeyCompletionHtml(journey, heroLabel) : journeyNextUpHtml(nextItem);
  return `<div class="home-section" id="journeySequenceSection">
      <div class="home-section-head"><h3>Your DC Journey — ${heroLabel}</h3><span class="home-section-sub">${doneCount}/${items.length}</span></div>
      <div class="journey-seq-list">${rows}</div>
      ${tail}
    </div>`;
}
function wireJourneySequenceHandlers(root){
  root.querySelectorAll(".journey-seq-toggle").forEach(btn=>{
    btn.addEventListener("click", e=>{
      e.stopPropagation();
      const nowDone = toggleDone(btn.dataset.cat, btn.dataset.id);
      recordJourneyCompletion(btn.dataset.cat, btn.dataset.id, nowDone);
      if(state.cat==="journey") renderJourney();
    });
  });
  root.querySelectorAll(".journey-seq-item").forEach(item=>{
    item.addEventListener("click", e=>{
      if(e.target.closest(".journey-seq-toggle")) return;
      const cat = item.dataset.cat, id = item.dataset.id;
      const d = (DATA[cat]||[]).find(x=>x.id===id);
      if(!d) return;
      state.cat = cat;
      if(d.type) state.typeFilter = d.type;
      openSheet(d);
    });
  });
  const nextUp = root.querySelector("#journeyNextUp");
  if(nextUp){
    nextUp.addEventListener("click", ()=>{
      const cat = nextUp.dataset.cat, id = nextUp.dataset.id;
      const d = (DATA[cat]||[]).find(x=>x.id===id);
      if(!d) return;
      state.cat = cat;
      if(d.type) state.typeFilter = d.type;
      openSheet(d);
    });
  }
  root.querySelectorAll(".journey-branch-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const mode = btn.dataset.branch;
      const result = extendJourney(mode);
      if(!result.added){
        btn.querySelector(".journey-branch-sub").textContent = "Nothing new to add here right now — try another option.";
        return;
      }
      if(state.cat==="journey") renderJourney();
      setTimeout(()=> document.getElementById("journeySequenceSection")?.scrollIntoView({behavior:"smooth", block:"start"}), 60);
    });
  });
}

/* ---- Themed backgrounds per hero / team group (Phase 1, Task 2) ---- */
const GROUP_THEMES = {
  "Batman":                   { a:"#3a3f4a", b:"#0d0d10" },
  "Superman":                 { a:"#2c5fd1", b:"#a3182a" },
  "Justice League":           { a:"#1f3f7a", b:"#c9a227" },
  "Justice Society":          { a:"#8a6a1f", b:"#3a2f0d" },
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
  const journeyBtn = `<button class="tab-btn" data-cat="journey" data-active="${state.cat==="journey"}">My Journey</button>`;
  tabsEl.innerHTML = homeBtn + CATS.map(c=>{
    const n = DATA[c.id].length;
    return `<button class="tab-btn" data-cat="${c.id}" data-active="${state.cat===c.id}">${c.label}<span class="n">${n}</span></button>`;
  }).join("") + journeyBtn;
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
  if(cat==="home"){
    introEl.textContent = "";
    introEl.style.display = "none";
  } else {
    introEl.style.display = "";
    introEl.textContent = INTRO[cat];
  }
  filterRow.innerHTML = "";
  chipRow.innerHTML = "";

  if(cat==="home" || cat==="journey") return;

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
  return canon==="Main Canon" ? "canon-main" : "canon-alt";
}
function metaTagsGeneric(cat, d){
  if(cat==="games"){
    const plats = (d.plats||[]).map(p=>`<span class="tag plat">${p}</span>`).join("");
    return `<span class="tag">${d.fr||""}</span>${plats}`;
  }
  if(cat==="comics"){
    const rl = d.readingLevel ? `<span class="qf-pill rl-${readingLevelClass(d.readingLevel)}">${d.readingLevel}</span>` : "";
    const review = (d.verificationStatus && d.verificationStatus!=="verified")
      ? `<span class="tag needs-review" title="Continuity not definitively confirmed by DC">⚠ needs review</span>` : "";
    return `<span class="tag">${d.era||""}</span><span class="tag ${canonTagClass(d.canon)}">${d.canon||""}</span><span class="tag">${d.line||""}</span>${rl}${review}`;
  }
  return "";
}

/* ---- Phase 3: active-filter summary + "broaden search" empty state (fixes Explore 0-results UX) ----
   The underlying filter logic already treats "all" as no-filter correctly — confirmed by inspection
   and direct testing against the real catalogue data. What was actually missing was UX: some filter
   combinations are genuinely empty in the real data (e.g. no Live Action title is tagged "Hardcore
   Fan"), and the app gave no way to see WHICH filters were active or remove just one of them. This
   never silently changes the user's selection — it only ever removes a filter the user explicitly taps. */
function activeMovieSeriesFilterChips(){
  const chips = [];
  if(state.viewerLevelFilter!=="all") chips.push({label:`Viewer level: ${state.viewerLevelFilter}`, key:"viewerLevelFilter"});
  if(state.complexityFilter!=="all") chips.push({label:`Complexity: ${state.complexityFilter}`, key:"complexityFilter"});
  if(state.canonFilter!=="all") chips.push({label:`Canon: ${canonShort(state.canonFilter)}`, key:"canonFilter"});
  if(state.search.trim()) chips.push({label:`Search: "${state.search.trim()}"`, key:"search"});
  return chips;
}
function activeGenericFilterChips(){
  const cat = state.cat;
  const chips = [];
  if(cat==="comics"){
    if(state.f1!=="all") chips.push({label:`Era: ${state.f1}`, key:"f1"});
    if(state.f2!=="all") chips.push({label:`Canon: ${state.f2}`, key:"f2"});
    if(state.f3!=="all") chips.push({label:`Reading level: ${state.f3}`, key:"f3"});
    if(state.chip!=="all") chips.push({label:`Line: ${state.chip}`, key:"chip"});
  }
  if(cat==="games" && state.gameMode==="platform" && state.gamePlatform!=="all"){
    chips.push({label:`Platform: ${state.gamePlatform}`, key:"gamePlatform"});
  }
  if(state.search.trim()) chips.push({label:`Search: "${state.search.trim()}"`, key:"search"});
  return chips;
}
function clearFilterChip(key){
  if(key==="search"){ state.search=""; if(searchInput) searchInput.value=""; }
  else state[key] = "all";
}
function activeFilterBarHtml(chips){
  if(!chips.length) return "";
  const pills = chips.map((c,i)=>`<button class="active-filter-chip" data-clear-i="${i}">${escapeAttr(c.label)} <span class="x">✕</span></button>`).join("");
  return `<div class="active-filter-bar">${pills}<button class="active-filter-clearall" id="clearAllFiltersBtn">Clear all</button></div>`;
}
function noMatchesHtml(chips){
  if(!chips.length){
    return `<div class="empty">Nothing here yet.</div>`;
  }
  const removeBtns = chips.map((c,i)=>`<button class="btn btn-small" data-clear-i="${i}">Remove: ${escapeAttr(c.label)}</button>`).join("");
  return `<div class="empty empty-broaden">
      <div class="empty-title">No exact matches</div>
      <div class="empty-sub">Nothing in the compendium matches all of these filters together. Broaden your search:</div>
      <div class="empty-actions">${removeBtns}<button class="btn btn-small" id="emptyClearAllBtn">Clear all filters</button></div>
    </div>`;
}
function wireFilterBarHandlers(root, chips){
  root.querySelectorAll("[data-clear-i]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      clearFilterChip(chips[+btn.dataset.clearI].key);
      buildFilters(); renderCards();
    });
  });
  const clearAll = root.querySelector("#clearAllFiltersBtn, #emptyClearAllBtn");
  if(clearAll){
    clearAll.addEventListener("click", ()=>{
      chips.forEach(c=>clearFilterChip(c.key));
      buildFilters(); renderCards();
    });
  }
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

function nerdBadgesHtml(cat, d){
  if(cat==="comics"){
    const parts = [];
    if(d.continuity) parts.push(`<span class="tag">${d.continuity}</span>`);
    if(d.universe) parts.push(`<span class="tag">${d.universe}</span>`);
    if(d.credits) parts.push(`<span class="tag">${d.credits}</span>`);
    if(!parts.length) return "";
    return `<div class="nerd-badges">${parts.join("")}</div>`;
  }
  const parts = [];
  if(d.viewerLevel) parts.push(`<span class="qf-pill rl-${readingLevelClass(d.viewerLevel)}">${d.viewerLevel}</span>`);
  if(d.complexity) parts.push(`<span class="qf-pill cx-${complexityClass(d.complexity)}">${d.complexity}</span>`);
  if(d.canonStatus) parts.push(`<span class="tag">${canonShort(d.canonStatus)}</span>`);
  if(!parts.length) return "";
  return `<div class="nerd-badges">${parts.join("")}</div>`;
}
function cardHtml(cat, d){
  const meta = (cat==="movies"||cat==="series") ? movieSeriesMetaTags(cat, d) : metaTagsGeneric(cat, d);
  const fav = isFavorite(cat, d.id);
  return `<div class="card ${cat}" data-id="${d.id}" data-cat="${cat}">
      <div class="card-thumb-wrap">
        ${thumbHtml(cat, d)}
        <button class="fav-btn" data-fav-cat="${cat}" data-fav-id="${d.id}" data-active="${fav}" aria-label="Favorite">${fav?"♥":"♡"}</button>
      </div>
      <div class="card-body">
        <div class="card-top"><div class="card-title">${d.t}</div><div class="card-year">${d.y||""}</div></div>
        <div class="card-meta">${meta}</div>
        ${state.nerdMode ? nerdBadgesHtml(cat, d) : ""}
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
  const chips = activeMovieSeriesFilterChips();
  countEl.textContent = `${items.length} title${items.length===1?"":"s"}`;
  if(items.length===0){
    gridEl.innerHTML = activeFilterBarHtml(chips) + noMatchesHtml(chips);
    wireFilterBarHandlers(gridEl, chips);
    return;
  }

  let html = activeFilterBarHtml(chips);
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
  wireFilterBarHandlers(gridEl, chips);
  attachCardHandlers(cat);
}

function attachCardHandlers(cat){
  wireImageFallbacks(gridEl);
  gridEl.querySelectorAll(".card").forEach(c=>{
    c.addEventListener("click", (e)=>{
      if(e.target.closest("[data-del]") || e.target.closest(".fav-btn")) return;
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
  const chips = activeGenericFilterChips();
  countEl.textContent = `${items.length} title${items.length===1?"":"s"}`;
  if(items.length===0){
    gridEl.innerHTML = activeFilterBarHtml(chips) + noMatchesHtml(chips);
    wireFilterBarHandlers(gridEl, chips);
    return;
  }
  let html = activeFilterBarHtml(chips);
  if(cat==="games" && state.gameMode==="story"){
    const groups = {};
    items.forEach(d=>{ (groups[d.fr||"Other"] = groups[d.fr||"Other"] || []).push(d); });
    const groupNames = Object.keys(groups).sort();
    groupNames.forEach(g=>{
      const list = groups[g].sort((a,b)=>firstYear(b.y)-firstYear(a.y));
      html += groupHeaderHtml(g, list.length) + list.map(d=>cardHtml(cat,d)).join("");
    });
    gridEl.innerHTML = html;
  } else {
    html += items.map(d=>cardHtml(cat,d)).join("");
    gridEl.innerHTML = html;
  }
  wireFilterBarHandlers(gridEl, chips);
  attachCardHandlers(cat);
}

function renderCards(){
  if(!loaded) return;
  if(state.cat==="home") renderHome();
  else if(state.cat==="journey") renderJourney();
  else if(state.cat==="movies" || state.cat==="series") renderMovieSeriesCards();
  else renderGenericCards();
}

/* ============================= RENDER: HOME ============================= */
function stripCardHtml(cat, d){
  const rating = ratingLabel(d);
  const fav = isFavorite(cat, d.id);
  return `<div class="strip-card" data-id="${d.id}" data-cat="${cat}">
      <div class="card-thumb-wrap">
        ${thumbHtml(cat, d)}
        <button class="fav-btn" data-fav-cat="${cat}" data-fav-id="${d.id}" data-active="${fav}" aria-label="Favorite">${fav?"♥":"♡"}</button>
      </div>
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
const ERA_ORDER = ["Golden Age","Silver Age","Bronze Age","Crisis Transition","Modern Age / Post-Crisis","New 52","Rebirth","Infinite Frontier","Dawn of DC","Absolute-era publishing"];
const ERA_ICON = {
  "Golden Age":"⭐", "Silver Age":"🌙", "Bronze Age":"🥉", "Crisis Transition":"💥",
  "Modern Age / Post-Crisis":"🏙️", "New 52":"5️⃣2️⃣", "Rebirth":"🔥", "Infinite Frontier":"♾️",
  "Dawn of DC":"🌅", "Absolute-era publishing":"🅰️",
};
function renderHome(){
  countEl.textContent = "";
  const allMS = [
    ...DATA.movies.map(d=>({d,cat:"movies"})),
    ...DATA.series.map(d=>({d,cat:"series"})),
  ];

  const topRated = allMS
    .filter(({d})=>ratingScore(d)!==null)
    .sort((a,b)=> ratingScore(b.d) - ratingScore(a.d))
    .slice(0, 12);

  const recentlyAdded = ["movies","series","games","comics"]
    .flatMap(cat=>DATA[cat].filter(d=>d.addedAt).map(d=>({d,cat})))
    .sort((a,b)=> (b.d.addedAt||"").localeCompare(a.d.addedAt||""))
    .slice(0, 12);

  // Featured — one flagship (highest-rated) pick per top hero/team, for a diverse showcase rail
  const featured = [];
  const seenFeatured = new Set();
  HERO_PRIORITY.forEach(group=>{
    const inGroup = allMS.filter(({d})=> (d.group||"Other DC Characters")===group && ratingScore(d)!==null);
    if(!inGroup.length) return;
    const best = inGroup.sort((a,b)=>ratingScore(b.d)-ratingScore(a.d))[0];
    const key = best.cat+":"+best.d.id;
    if(seenFeatured.has(key)) return;
    seenFeatured.add(key);
    featured.push(best);
  });

  // Explore by Hero — every group with at least one title, DC-priority order first
  const allGroupNames = uniq([
    ...DATA.movies.map(d=>d.group), ...DATA.series.map(d=>d.group), ...DATA.comics.map(d=>d.group),
    ...DATA.games.map(d=>GAME_GROUP[d.fr]||"Other DC Characters"),
  ]);
  const heroRailGroups = sortHeroNames(Object.fromEntries(allGroupNames.map(g=>[g, allGroupMembers(g)])))
    .filter(g=>g!=="Other DC Characters")
    .slice(0, 14);

  // Explore by Era — from the comics catalogue's own era tagging
  const eraCounts = {};
  DATA.comics.forEach(d=>{ if(d.era) eraCounts[d.era] = (eraCounts[d.era]||0)+1; });
  const eraTiles = [
    ...ERA_ORDER.filter(e=>eraCounts[e]).map(e=>({era:e, n:eraCounts[e]})),
    ...Object.keys(eraCounts).filter(e=>!ERA_ORDER.includes(e)).map(e=>({era:e, n:eraCounts[e]})),
  ];

  // Continue Your Journey — personalized rail from this device's saved favorites/progress, when there is any.
  // Phase 13: when a saved New to DC journey exists, items related to that journey's hero are surfaced
  // first — real relationship data (groupOf), never a random reorder — so "finished a Batman starter path"
  // actually shows more Batman-adjacent content before broadly unrelated DC titles.
  const favKeys = getFavorites();
  const progressKeys = Object.keys(getProgress());
  let journeyItems = [
    ...resolveKeys(favKeys),
    ...resolveKeys(progressKeys.filter(k=>!favKeys.includes(k))),
  ];
  const activeJourney = getSavedJourney();
  const journeyHeroGroup = activeJourney ? (BEGINNER_CHARACTERS.find(h=>h.id===activeJourney.selectedHero)||{}).group : null;
  if(journeyHeroGroup){
    journeyItems = [...journeyItems].sort((a,b)=>{
      const aMatch = groupOf(a.cat, a.d)===journeyHeroGroup ? 1 : 0;
      const bMatch = groupOf(b.cat, b.d)===journeyHeroGroup ? 1 : 0;
      return bMatch - aMatch; // hero-matching items first, otherwise stable (favorites still lead progress)
    });
  }
  journeyItems = journeyItems.slice(0, 12);

  let html = `
    <section class="home-hero-cinematic">
      <div class="hhc-eyebrow">UNOFFICIAL DC GUIDE</div>
      <h2>Discover DC</h2>
      <p>Every movie, series, game and comic — organized by hero, timeline, and how deep you want to go.</p>
      <button class="btn-cta" id="heroExploreBtn">Explore the DC Universe</button>
    </section>`;

  if(journeyItems.length){
    html += stripHtml("homeJourneyStrip", "Continue Your Journey", "Your favorites & progress on this device", journeyItems);
  }

  html += `
    <div class="starting-point-card" id="startingPointCard">
      <div class="spc-icon">🧭</div>
      <div class="spc-text">
        <div class="spc-title">New to DC?</div>
        <div class="spc-sub">Find My Starting Point — low-complexity, standalone-friendly picks</div>
      </div>
      <div class="spc-arrow">→</div>
    </div>`;

  html += `<div class="home-section">
      <div class="home-section-head"><h3>Explore by Hero</h3></div>
      <div class="home-strip hero-rail" id="homeHeroRail">
        ${heroRailGroups.map(g=>{
          const theme = groupTheme(g);
          const n = allGroupMembers(g).length;
          return `<div class="hero-tile" data-group="${escapeAttr(g)}" style="--ta:${theme.a};--tb:${theme.b}">
              <div class="hero-tile-name">${g}</div>
              <div class="hero-tile-count">${n} title${n===1?"":"s"}</div>
            </div>`;
        }).join("")}
      </div>
    </div>`;

  html += stripHtml("homeFeaturedStrip", "Featured", "Flagship picks across the DC universe", featured);

  if(eraTiles.length){
    html += `<div class="home-section">
        <div class="home-section-head"><h3>Explore by Era</h3><span class="home-section-sub">Comics, Golden Age to today</span></div>
        <div class="home-strip era-rail" id="homeEraRail">
          ${eraTiles.map(({era,n})=>`<div class="era-tile" data-era="${escapeAttr(era)}">
              <div class="era-tile-icon">${ERA_ICON[era]||"📖"}</div>
              <div class="era-tile-name">${era}</div>
              <div class="era-tile-count">${n} issue${n===1?"":"s"}</div>
            </div>`).join("")}
        </div>
      </div>`;
  }

  html += stripHtml("homeRecentlyAddedStrip", "Recently Added", "Newest entries on the site", recentlyAdded);
  html += stripHtml("homeTopRatedStrip", "Top Rated", "Highest-rated movies & series on the site", topRated);

  const catCounts = CATS.map(c=>({...c, n: DATA[c.id].length}));
  html += `<div class="home-section">
      <div class="home-section-head"><h3>Browse Everything</h3></div>
      <div class="home-category-row">
        ${catCounts.map(c=>`<button class="cat-pill ${c.id}" data-cat="${c.id}">${CAT_ICON[c.id]||""} ${c.label} <span>${c.n}</span></button>`).join("")}
      </div>
    </div>`;

  html += `<div class="home-section">
      <div class="home-section-head"><h3>More Ways to Browse</h3></div>
      <div class="home-discover-grid">
        <div class="discover-tile" data-cat="movies" data-sort="story"><div class="discover-tile-icon">🌐</div><div class="discover-tile-label">Connected Story</div><div class="discover-tile-count">Movies &amp; series</div></div>
        <div class="discover-tile" data-cat="games" data-sort="story"><div class="discover-tile-icon">🎮</div><div class="discover-tile-label">Games by Franchise</div><div class="discover-tile-count">Arkham, Injustice &amp; more</div></div>
        <div class="discover-tile" data-hub="event"><div class="discover-tile-icon">💥</div><div class="discover-tile-label">Multiverse Events</div><div class="discover-tile-count">Crisis crossovers, in order</div></div>
        <div class="discover-tile" data-hub="glossary"><div class="discover-tile-icon">📚</div><div class="discover-tile-label">DC Glossary</div><div class="discover-tile-count">Canon, Elseworlds &amp; more, explained</div></div>
        <div class="discover-tile" data-hub="multiverse"><div class="discover-tile-icon">🌀</div><div class="discover-tile-label">Multiverse Map</div><div class="discover-tile-count">Every continuity, at a glance</div></div>
      </div>
    </div>`;

  gridEl.innerHTML = html;
  wireImageFallbacks(gridEl);

  gridEl.querySelectorAll(".strip-card").forEach(c=>{
    c.addEventListener("click", (e)=>{
      if(e.target.closest(".fav-btn")) return;
      const cat = c.dataset.cat, id = c.dataset.id;
      const d = DATA[cat].find(x=>x.id===id);
      if(!d) return;
      state.cat = cat;
      if(d.type) state.typeFilter = d.type;
      openSheet(d);
    });
  });
  const eventTile = gridEl.querySelector('[data-hub="event"]');
  if(eventTile) eventTile.addEventListener("click", openEventHub);
  const glossaryTile = gridEl.querySelector('[data-hub="glossary"]');
  if(glossaryTile) glossaryTile.addEventListener("click", openGlossary);
  const multiverseTile = gridEl.querySelector('[data-hub="multiverse"]');
  if(multiverseTile) multiverseTile.addEventListener("click", openMultiverseMap);
  gridEl.querySelectorAll(".discover-tile:not([data-hub])").forEach(t=>{
    t.addEventListener("click", ()=>{
      goToCategory(t.dataset.cat, { sortMode: t.dataset.sort });
    });
  });
  gridEl.querySelectorAll(".cat-pill").forEach(p=>{
    p.addEventListener("click", ()=> goToCategory(p.dataset.cat));
  });
  gridEl.querySelectorAll(".hero-tile").forEach(t=>{
    t.addEventListener("click", ()=> openHub(t.dataset.group));
  });
  gridEl.querySelectorAll(".era-tile").forEach(t=>{
    t.addEventListener("click", ()=>{
      state.cat = "comics";
      resetFiltersForTabSwitch();
      state.f1 = t.dataset.era;
      render();
    });
  });
  const spc = $("#startingPointCard");
  if(spc) spc.addEventListener("click", openStartSheet);
  const heroBtn = $("#heroExploreBtn");
  if(heroBtn) heroBtn.addEventListener("click", ()=>{
    buildExploreGrid();
    openSheetEl(exploreBackdrop, exploreSheet);
  });
}
/* ============================= RENDER: MY JOURNEY ============================= */
function resolveKeys(keys){
  const out = [];
  keys.forEach(k=>{
    const [cat, id] = k.split(":");
    const d = (DATA[cat]||[]).find(x=>x.id===id);
    if(d) out.push({d, cat});
  });
  return out;
}
function renderJourney(opts){
  opts = opts || {};
  countEl.textContent = "";
  const favItems = resolveKeys(getFavorites());
  const progressKeys = Object.keys(getProgress());
  const doneByCat = { movies:0, series:0, games:0, comics:0 };
  progressKeys.forEach(k=>{
    const [cat] = k.split(":");
    if(doneByCat[cat]!==undefined) doneByCat[cat]++;
  });
  const signedIn = !!readerUser;

  let html = signedIn
    ? `<div class="home-hero journey-hero">
        <div class="home-hero-badge">☁️ SYNCED TO YOUR ACCOUNT</div>
        <h2>My Journey</h2>
        <p>Signed in as ${escapeAttr(readerUser.displayName || readerUser.email || "you")} — favorites and progress follow you to any device.</p>
      </div>`
    : `<div class="home-hero journey-hero">
        <div class="home-hero-badge">📌 SAVED ON THIS DEVICE</div>
        <h2>My Journey</h2>
        <p>Favorites and progress live in this browser only right now. <a href="#" id="journeySignInLink" style="color:var(--ink);text-decoration:underline;">Sign in</a> to sync them across every device.</p>
      </div>`;

  const journey = getSavedJourney();
  if(journey){
    html += `<div class="home-section-head journey-section-label"><h3>CONTINUE</h3></div>`;
    html += renderJourneySequenceHtml(journey);

    // ---- Phase 12: RECENTLY COMPLETED — journey items marked done, most-recently-completed first ----
    const completedItems = (journey.recommendedTitleKeys||[]).map(resolveTitleKey).filter(Boolean)
      .filter(it=>isDone(it.cat, it.d.id));
    if(completedItems.length){
      const completedAt = journey.completedAt || {};
      const sorted = [...completedItems].sort((a,b)=>{
        const ta = completedAt[itemKey(a.cat,a.d.id)] || "";
        const tb = completedAt[itemKey(b.cat,b.d.id)] || "";
        return tb.localeCompare(ta); // newest first; items with no timestamp (pre-existing) sink to the end
      });
      html += `<div class="home-section" id="journeyRecentlyCompletedSection">
          <div class="home-section-head"><h3>RECENTLY COMPLETED</h3><span class="home-section-sub">${sorted.length}</span></div>
          <div class="home-strip">${sorted.map(({d,cat})=>stripCardHtml(cat,d)).join("")}</div>
        </div>`;
    }
  } else {
    html += `<div class="journey-empty-cta home-section" id="journeyEmptyCta">
        <div class="home-section-head"><h3>CONTINUE</h3></div>
        <p class="journey-empty">You haven't started a DC journey yet.</p>
        <button class="btn btn-primary" id="journeyStartCtaBtn">New to DC? Start Here</button>
      </div>`;
  }

  // ---- Phase 12: DISCOVER NEXT — other real, data-backed heroes to branch into ----
  {
    const currentHeroGroup = journey ? (BEGINNER_CHARACTERS.find(h=>h.id===journey.selectedHero)||{}).group : null;
    const otherHeroes = realHeroGroups().filter(h=>h.group!==currentHeroGroup).slice(0,6);
    if(otherHeroes.length){
      html += `<div class="home-section" id="journeyDiscoverNextSection">
          <div class="home-section-head"><h3>DISCOVER NEXT</h3></div>
          <div class="explore-hero-rail" id="journeyDiscoverRail">
            ${otherHeroes.map(h=>{
              const t = groupTheme(h.group);
              return `<div class="explore-rail-tile" data-group="${escapeAttr(h.group)}" style="--theme-a:${t.a};--theme-b:${t.b};">
                  <div class="explore-rail-tile-label">${h.group}</div>
                  <div class="explore-rail-tile-count">${h.count} title${h.count===1?"":"s"}</div>
                </div>`;
            }).join("")}
          </div>
        </div>`;
    }
  }

  html += `<div class="home-section" id="journeyProgressSection">
      <div class="home-section-head"><h3>Progress</h3></div>
      <div class="journey-progress-grid">
        ${CATS.map(c=>{
          const total = DATA[c.id].length;
          const done = doneByCat[c.id]||0;
          const pct = total ? Math.round((done/total)*100) : 0;
          return `<div class="journey-progress-card">
              <div class="journey-progress-top"><span>${CAT_ICON[c.id]||""} ${c.label}</span><span>${done}/${total}</span></div>
              <div class="journey-progress-bar"><div class="journey-progress-fill" style="width:${pct}%"></div></div>
            </div>`;
        }).join("")}
      </div>
    </div>`;

  if(favItems.length){
    html += `<div class="home-section" id="journeyFavoritesSection">
        <div class="home-section-head"><h3>♥ Favorites</h3><span class="home-section-sub">${favItems.length}</span></div>
        <div class="home-strip">${favItems.map(({d,cat})=>stripCardHtml(cat,d)).join("")}</div>
      </div>`;
  } else {
    html += `<div class="home-section" id="journeyFavoritesSection">
        <div class="home-section-head"><h3>♥ Favorites</h3></div>
        <p class="journey-empty">Nothing favorited yet — tap the ♡ on any title's card or detail page to save it here.</p>
      </div>`;
  }

  gridEl.innerHTML = html;
  wireImageFallbacks(gridEl);
  gridEl.querySelectorAll(".strip-card").forEach(c=>{
    c.addEventListener("click", (e)=>{
      if(e.target.closest(".fav-btn")) return;
      const cat = c.dataset.cat, id = c.dataset.id;
      const d = DATA[cat].find(x=>x.id===id);
      if(!d) return;
      state.cat = cat;
      if(d.type) state.typeFilter = d.type;
      openSheet(d);
    });
  });
  const signInLink = $("#journeySignInLink");
  if(signInLink) signInLink.addEventListener("click", (e)=>{ e.preventDefault(); openSheetEl(readerBackdrop, readerSheet); });
  const startCtaBtn = $("#journeyStartCtaBtn");
  if(startCtaBtn) startCtaBtn.addEventListener("click", openStartSheet);
  gridEl.querySelectorAll("#journeyDiscoverRail .explore-rail-tile").forEach(t=>{
    t.addEventListener("click", ()=> openHub(t.dataset.group));
  });
  wireJourneySequenceHandlers(gridEl);

  // If signed in, refresh from Firestore once in the background so cross-device changes show up here —
  // localStorage (read above) already renders instantly; this just quietly catches it up if stale.
  // skipRefresh on the follow-up render prevents this from looping.
  if(signedIn && !opts.skipRefresh){
    pullCloudDataToLocal(readerUser.uid).then(()=>{
      if(state.cat==="journey") renderJourney({skipRefresh:true});
    }).catch(()=>{});
  }
}

function render(){ buildTabs(); buildFilters(); renderCards(); updateMobileNavActive(); renderStatsFooter(); }

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

  const origin = [...members].sort((a,b)=>firstYear(a.d.y)-firstYear(b.d.y)).find(m=>m.d.blurb);
  if(origin){
    html += `<div class="sheet-section origin-block">
        <div class="sheet-label">ORIGIN — ${escapeAttr(origin.d.t)} (${origin.d.y||""})</div>
        <div class="sheet-body">${origin.d.blurb}</div>
      </div>`;
  }

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
    c.addEventListener("click", (e)=>{
      if(e.target.closest(".fav-btn")) return;
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
function timelineRowsWithDecades(sortedItems){
  let html = "";
  let lastDecade = null;
  sortedItems.forEach(d=>{
    const yr = firstYear(d.y);
    if(yr){
      const decade = Math.floor(yr/10)*10;
      if(decade !== lastDecade){
        html += `<div class="timeline-decade">${decade}s</div>`;
        lastDecade = decade;
      }
    }
    html += `<div class="timeline-row" data-cat="${d._cat}" data-id="${d.id}">
        <span class="timeline-year">${d.y||""}</span>
        <span class="timeline-icon">${CAT_ICON[d._cat]||""}</span>
        <span class="timeline-title">${d.t}</span>
      </div>`;
  });
  return html;
}

/* ============================= COMIC EVENT HUB (Phase 2) ============================= */
/* ============================= GLOSSARY (Phase 4) ============================= */
const GLOSSARY_TERMS = [
  ["Canon", "The official, \"really happened\" continuity of a shared universe — as opposed to Elseworlds or alternate-universe stories, which don't affect it."],
  ["Continuity", "The connected timeline a story belongs to. Titles in the same continuity reference each other's events; titles outside it don't."],
  ["Elseworlds", "A DC imprint/label for standalone \"what if\" stories that place familiar characters outside their usual continuity (e.g. a different era, moral alignment, or outcome). Self-contained — no prior reading required."],
  ["Multiverse", "The idea that many parallel Earths and continuities exist simultaneously, each a variation on the DC universe (e.g. Earth-1, Earth-2, Earth-3)."],
  ["Crisis / Crossover Event", "A large story arc that spans many titles at once, usually reshaping or resetting continuity going forward (Crisis on Infinite Earths, Flashpoint, Infinite Crisis)."],
  ["Retcon", "Short for \"retroactive continuity\" — when a later story changes or reinterprets an earlier established fact."],
  ["Reboot", "A full restart of a character's or universe's continuity, discarding some or all prior history (e.g. the New 52 in 2011)."],
  ["Golden Age", "The earliest era of superhero comics, roughly late 1930s–early 1950s — Action Comics #1, Detective Comics #27, and the genre's birth."],
  ["Silver Age", "Roughly mid-1950s–early 1970s — the era that reintroduced and modernized many heroes (the Barry Allen Flash, the Multiverse concept)."],
  ["Bronze Age", "Roughly early 1970s–mid-1980s — grittier, more socially conscious storytelling."],
  ["Post-Crisis", "The continuity that followed 1985's Crisis on Infinite Earths, which merged the Multiverse into a single streamlined universe."],
  ["New 52", "DC's 2011 line-wide relaunch and soft reboot of continuity, starting every series back at issue #1."],
  ["Rebirth", "DC's 2016 course-correction after the New 52, restoring some classic continuity and legacy relationships."],
  ["Imprint", "A publishing label under DC for content outside the core shared universe — Vertigo (mature, creator-owned/horror), Black Label (mature, prestige one-offs)."],
  ["Standalone", "A story that doesn't depend on or feed into a larger shared continuity — can be read/watched with zero prior context."],
  ["Shared Universe", "A continuity where multiple heroes' stories interconnect and reference each other's events."],
  ["Legacy Character", "A codename passed between different characters over time (e.g. multiple people have been \"the Flash\" or \"Robin\")."],
  ["Canon Status (on this site)", "How AllAboutDC classifies each title: Shared Universe (connects to others), Standalone (self-contained), or Elseworlds (deliberately outside continuity)."],
  ["TPB", "Trade Paperback — a softcover collecting several single issues of a comic run."],
  ["Omnibus / Absolute Edition", "Larger hardcover collections gathering many issues (omnibus) or a premium oversized edition with extras (Absolute)."],
];
function openGlossary(){
  hubSheet.style.removeProperty("--theme-a");
  hubSheet.style.removeProperty("--theme-b");
  hubSheet.dataset.themed = "false";

  let html = `<div class="sheet-eyebrow">REFERENCE</div><h2>DC Glossary</h2>
    <p class="hub-count">${GLOSSARY_TERMS.length} terms used across the site</p>`;
  html += `<div class="glossary-list">${GLOSSARY_TERMS.map(([term,def])=>`
      <div class="glossary-row">
        <div class="glossary-term">${term}</div>
        <div class="glossary-def">${def}</div>
      </div>`).join("")}</div>`;

  hubContent.innerHTML = html;
  openSheetEl(hubBackdrop, hubSheet);
}

function creatorWorks(name){
  if(!name) return [];
  const movies = DATA.movies.filter(d=>d.director===name).map(d=>({...d, _cat:"movies"}));
  const series = DATA.series.filter(d=>d.creators===name).map(d=>({...d, _cat:"series"}));
  return [...movies, ...series].sort((a,b)=>firstYear(a.y)-firstYear(b.y));
}

function openCreatorHub(name){
  hubSheet.style.removeProperty("--theme-a");
  hubSheet.style.removeProperty("--theme-b");
  hubSheet.dataset.themed = "false";

  const works = creatorWorks(name);
  let html = `<div class="sheet-eyebrow">CREATOR</div><h2>${name}</h2>
    <p class="hub-count">${works.length} title${works.length===1?"":"s"} on AllAboutDC</p>`;

  html += `<div class="home-section">
      <div class="home-strip">${works.map(d=>stripCardHtml(d._cat, d)).join("")}</div>
    </div>`;

  hubContent.innerHTML = html;
  wireImageFallbacks(hubContent);
  hubContent.querySelectorAll(".strip-card").forEach(c=>{
    c.addEventListener("click", (e)=>{
      if(e.target.closest(".fav-btn")) return;
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

const CANON_SECTION_ORDER = [
  "Shared Universe / Connected Continuity",
  "Elseworlds / Alternate Continuity",
  "Standalone / No Shared Continuity",
];
const MULTIVERSE_EXCLUDE = new Set(["Standalone", "Standalone (Vertigo)"]);

function multiverseGroups(){
  const info = {};
  for(const cat of ["movies","series"]){
    for(const d of DATA[cat]){
      const name = d.connected;
      if(!name || MULTIVERSE_EXCLUDE.has(name)) continue;
      if(!info[name]) info[name] = { count:0, canonStatus: d.canonStatus || "Other" };
      info[name].count++;
    }
  }
  const groups = {};
  Object.entries(info).forEach(([name, v])=>{
    if(!groups[v.canonStatus]) groups[v.canonStatus] = [];
    groups[v.canonStatus].push({ name, count: v.count });
  });
  Object.values(groups).forEach(arr=>arr.sort((a,b)=>b.count-a.count));
  return groups;
}

function openMultiverseMap(){
  hubSheet.style.removeProperty("--theme-a");
  hubSheet.style.removeProperty("--theme-b");
  hubSheet.dataset.themed = "false";

  const groups = multiverseGroups();
  const keys = [...CANON_SECTION_ORDER.filter(k=>groups[k]), ...Object.keys(groups).filter(k=>!CANON_SECTION_ORDER.includes(k))];
  const totalUniverses = keys.reduce((n,k)=>n+groups[k].length, 0);

  let html = `<div class="sheet-eyebrow">REFERENCE</div><h2>Multiverse Map</h2>
    <p class="hub-count">${totalUniverses} continuities across movies &amp; series — tap one to browse its watch order</p>`;

  keys.forEach(k=>{
    html += `<div class="multiverse-section">
        <div class="multiverse-section-title">${k}</div>
        <div class="multiverse-grid">
          ${groups[k].map(g=>`<div class="discover-tile" data-universe="${escapeAttr(g.name)}">
              <div class="discover-tile-label">${g.name}</div>
              <div class="discover-tile-count">${g.count} title${g.count===1?"":"s"}</div>
            </div>`).join("")}
        </div>
      </div>`;
  });

  hubContent.innerHTML = html;
  hubContent.querySelectorAll("[data-universe]").forEach(t=>{
    t.addEventListener("click", ()=> openUniverseHub(t.dataset.universe));
  });
  openSheetEl(hubBackdrop, hubSheet);
}

function siteStats(){
  const universeCount = Object.values(multiverseGroups()).reduce((n,arr)=>n+arr.length, 0);
  const creatorCounts = {};
  for(const cat of ["movies","series"]){
    for(const d of DATA[cat]){
      const name = cat==="movies" ? d.director : d.creators;
      if(!name) continue;
      creatorCounts[name] = (creatorCounts[name]||0) + 1;
    }
  }
  const trackedCreators = Object.values(creatorCounts).filter(n=>n>=2).length;
  return {
    movies: DATA.movies.length,
    series: DATA.series.length,
    games: DATA.games.length,
    comics: DATA.comics.length,
    universes: universeCount,
    creators: trackedCreators,
  };
}

function renderStatsFooter(){
  const footer = $("#siteStatsFooter");
  if(!footer) return;
  if(!state.nerdMode){
    footer.style.display = "none";
    footer.innerHTML = "";
    return;
  }
  const s = siteStats();
  const total = s.movies + s.series + s.games + s.comics;
  footer.innerHTML = `<div class="stats-eyebrow">🤓 NERD MODE — SITE STATS</div>
    <div class="stats-grid">
      <div class="stat-item"><div class="stat-num">${total}</div><div class="stat-label">Total Titles</div></div>
      <div class="stat-item"><div class="stat-num">${s.movies}</div><div class="stat-label">Movies</div></div>
      <div class="stat-item"><div class="stat-num">${s.series}</div><div class="stat-label">Series</div></div>
      <div class="stat-item"><div class="stat-num">${s.games}</div><div class="stat-label">Games</div></div>
      <div class="stat-item"><div class="stat-num">${s.comics}</div><div class="stat-label">Comics</div></div>
      <div class="stat-item"><div class="stat-num">${s.universes}</div><div class="stat-label">Continuities</div></div>
      <div class="stat-item"><div class="stat-num">${s.creators}</div><div class="stat-label">Tracked Creators</div></div>
    </div>`;
  footer.style.display = "block";
}

function openEventHub(){
  hubSheet.style.removeProperty("--theme-a");
  hubSheet.style.removeProperty("--theme-b");
  hubSheet.dataset.themed = "false";

  const events = DATA.comics
    .filter(d=>d.line==="Multiverse/Crisis Event")
    .map(d=>({...d, _cat:"comics"}))
    .sort((a,b)=>firstYear(a.y)-firstYear(b.y));

  let html = `<div class="sheet-eyebrow">COMIC EVENTS</div><h2>DC Multiverse &amp; Crisis Events</h2>
    <p class="hub-count">${events.length} major crossover events, in publication order</p>
    <div class="sheet-section"><div class="sheet-body">The big reality-shaking crossovers — the ones that reset, merge, or fracture DC continuity. Reading these in order (below) roughly tracks how DC's shared universe has evolved since 1961.</div></div>`;

  html += `<div class="home-section"><div class="universe-timeline">${timelineRowsWithDecades(events)}</div></div>`;

  html += `<div class="home-section">
      <div class="home-section-head"><h3>Where each one fits</h3></div>
      ${events.map(d=>`<div class="event-detail-row" data-cat="comics" data-id="${d.id}">
          <div class="event-detail-title">${d.t} <span class="event-detail-year">${d.y||""}</span></div>
          <div class="event-detail-fit">${d.ord||""}</div>
        </div>`).join("")}
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
  hubContent.querySelectorAll(".timeline-row, .event-detail-row").forEach(r=>{
    r.addEventListener("click", ()=> openItem(r.dataset.cat, r.dataset.id));
  });
  openSheetEl(hubBackdrop, hubSheet);
}

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
        ${timelineRowsWithDecades(byYear)}
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
    c.addEventListener("click", (e)=>{
      if(e.target.closest(".fav-btn")) return;
      openItem(c.dataset.cat, c.dataset.id);
    });
  });
  hubContent.querySelectorAll(".timeline-row").forEach(r=>{
    r.addEventListener("click", ()=> openItem(r.dataset.cat, r.dataset.id));
  });
  openSheetEl(hubBackdrop, hubSheet);
}

hubBackdrop.addEventListener("click", ()=> closeSheetEl(hubBackdrop, hubSheet));
$("#hubClose").addEventListener("click", ()=> closeSheetEl(hubBackdrop, hubSheet));

/* ============================= NEW TO DC? — hero → medium → intent → picks ============================= */
const startBackdrop = $("#startBackdrop"), startSheet = $("#startSheet"), startContent = $("#startContent");
let startState = { step:1, heroId:null, medium:"all", intent:null };

function startResultCardHtml(r){
  const catLabel = (CATS.find(c=>c.id===r.cat)||{}).label || r.cat;
  return `<div class="beginner-card" data-id="${r.d.id}" data-cat="${r.cat}">
      <div class="bc-thumb">${thumbHtml(r.cat, r.d)}</div>
      <div class="bc-body">
        <div class="bc-title">${r.d.t}<span class="bc-year">${r.d.y||""}</span></div>
        <div class="bc-medium">${CAT_ICON[r.cat]||""} ${catLabel}</div>
        <div class="bc-reason">${r.reason||""}</div>
      </div>
      <button class="btn btn-small bc-view" data-id="${r.d.id}" data-cat="${r.cat}">View</button>
    </div>`;
}
function openStartTitle(cat, id){
  const d = (DATA[cat]||[]).find(x=>x.id===id);
  if(!d) return;
  closeSheetEl(startBackdrop, startSheet);
  state.cat = cat;
  if(d.type) state.typeFilter = d.type;
  openSheet(d);
}
function renderStartStepHero(){
  let html = `<div class="sheet-eyebrow">YOUR DC STARTING POINT</div>
    <h2>Who do you want to meet?</h2>
    <p class="sheet-body" style="color:var(--ink-dim);margin-bottom:18px;">Pick a hero — we'll build a starting path just for them.</p>
    <div class="start-hero-grid">
      ${BEGINNER_CHARACTERS.map(h=>{
        const t = groupTheme(h.group);
        return `<div class="start-hero-tile" data-id="${h.id}" style="--theme-a:${t.a};--theme-b:${t.b};">${h.label}</div>`;
      }).join("")}
    </div>`;
  startContent.innerHTML = html;
  startContent.querySelectorAll(".start-hero-tile").forEach(t=>{
    t.addEventListener("click", ()=>{ startState.heroId = t.dataset.id; startState.step = 2; renderStartSheet(); });
  });
}
function renderStartStepMedium(){
  const hero = BEGINNER_CHARACTERS.find(h=>h.id===startState.heroId);
  let html = `<div class="sheet-eyebrow">YOUR DC STARTING POINT</div>
    <div class="start-back" id="startBackBtn">‹ Back</div>
    <h2>What do you want to watch or read?</h2>
    <p class="sheet-body" style="color:var(--ink-dim);margin-bottom:18px;">Starting with ${hero?hero.label:"DC"}. This is just a preference — we'll still surface the best pick even outside it.</p>
    <div class="start-hero-grid">
      ${MEDIUM_OPTIONS.map(m=>`<div class="start-hero-tile plain" data-val="${m.id}">${m.label}</div>`).join("")}
    </div>`;
  startContent.innerHTML = html;
  $("#startBackBtn").addEventListener("click", ()=>{ startState.step = 1; renderStartSheet(); });
  startContent.querySelectorAll(".start-hero-tile").forEach(c=>{
    c.addEventListener("click", ()=>{ startState.medium = c.dataset.val; startState.step = 3; renderStartSheet(); });
  });
}
function renderStartStepIntent(){
  let html = `<div class="sheet-eyebrow">YOUR DC STARTING POINT</div>
    <div class="start-back" id="startBackBtn">‹ Back</div>
    <h2>What sounds good?</h2>
    <div class="start-intent-list">
      ${START_INTENTS.map(i=>`<div class="start-intent-tile" data-val="${i.id}">${i.label}</div>`).join("")}
    </div>`;
  startContent.innerHTML = html;
  $("#startBackBtn").addEventListener("click", ()=>{ startState.step = 2; renderStartSheet(); });
  startContent.querySelectorAll(".start-intent-tile").forEach(t=>{
    t.addEventListener("click", ()=>{ startState.intent = t.dataset.val; startState.step = 4; renderStartSheet(); });
  });
}
function renderStartResults(){
  const hero = BEGINNER_CHARACTERS.find(h=>h.id===startState.heroId);
  const recs = getRecommendations(startState.heroId, startState.medium, startState.intent, {limit:6, minTarget:3});
  let html = `<div class="sheet-eyebrow">YOUR DC STARTING PICKS</div>
    <div class="start-back" id="startBackBtn">‹ Back</div>
    <h2>${hero?hero.label:"Your"} starting picks</h2>
    <div class="beginner-card-list">${recs.map(startResultCardHtml).join("")}</div>
    <div class="home-section" style="margin-top:18px;">
      <div class="home-section-head"><h3>Why these picks?</h3></div>
      <p class="sheet-body" style="color:var(--ink-dim);">Ranked for ${hero?hero.label:"this hero"} by character fit, how beginner-friendly each one is, and editorial picks curated for new readers — never just by star rating or release date.</p>
    </div>
    <button class="btn btn-primary" id="startJourneyBtn" style="width:100%;margin-top:16px;" ${recs.length?"":"disabled"}>Start My DC Journey</button>
    ${readerUser?"":`<p class="sheet-body" style="color:var(--ink-faint);text-align:center;margin-top:8px;">Sign in to save your journey across devices — or just start now.</p>`}`;
  startContent.innerHTML = html;
  wireImageFallbacks(startContent);
  $("#startBackBtn").addEventListener("click", ()=>{ startState.step = 3; renderStartSheet(); });
  startContent.querySelectorAll(".beginner-card").forEach(c=>{
    c.addEventListener("click", e=>{ if(e.target.closest(".bc-view")) return; openStartTitle(c.dataset.cat, c.dataset.id); });
  });
  startContent.querySelectorAll(".bc-view").forEach(btn=>{
    btn.addEventListener("click", e=>{ e.stopPropagation(); openStartTitle(btn.dataset.cat, btn.dataset.id); });
  });
  const journeyBtn = $("#startJourneyBtn");
  if(journeyBtn) journeyBtn.addEventListener("click", ()=>{
    if(!recs.length) return;
    const journey = {
      selectedHero: startState.heroId,
      selectedMedium: startState.medium,
      selectedIntent: startState.intent,
      recommendedTitleKeys: recs.map(r=>`${r.cat}::${r.d.t}::${r.d.y}`),
      currentPosition: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSavedJourney(journey);
    closeSheetEl(startBackdrop, startSheet);
    state.cat = "journey";
    resetFiltersForTabSwitch();
    render();
  });
}
function renderStartSheet(){
  if(startState.step===1) return renderStartStepHero();
  if(startState.step===2) return renderStartStepMedium();
  if(startState.step===3) return renderStartStepIntent();
  return renderStartResults();
}
function openStartSheet(){
  startState = { step:1, heroId:null, medium:"all", intent:null };
  renderStartSheet();
  openSheetEl(startBackdrop, startSheet);
}
startBackdrop.addEventListener("click", ()=> closeSheetEl(startBackdrop, startSheet));
$("#startClose").addEventListener("click", ()=> closeSheetEl(startBackdrop, startSheet));

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
  if(cat==="movies" && d.director) credits.push(["DIRECTOR", d.director, "director"]);
  if(cat==="series" && d.creators) credits.push(["CREATED BY", d.creators, "creators"]);
  if(d.cast) credits.push(["CAST", d.cast]);
  if(d.runtime) credits.push(["RUNTIME", d.runtime]);
  if(d.whereToWatch) credits.push(["WHERE TO WATCH", d.whereToWatch]);
  if(cat==="movies" && d.boxOffice) credits.push(["BOX OFFICE", d.boxOffice]);
  if(d.ageRating) credits.push(["AGE RATING", d.ageRating]);
  credits.forEach(([label,val,creatorField])=>{
    const isCreatorLink = creatorField && creatorWorks(val).length > 1;
    const bodyClass = isCreatorLink ? "sheet-body sheet-label-link" : "sheet-body";
    const linkAttr = isCreatorLink ? ` data-creator-link="${escapeAttr(val)}"` : "";
    html += `<div class="sheet-section"><div class="sheet-label">${label}</div><div class="${bodyClass}"${linkAttr}>${val}${isCreatorLink?" · view all →":""}</div></div>`;
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

  const fav = isFavorite(cat, d.id);
  const done = isDone(cat, d.id);
  const verb = PROGRESS_VERB[cat] || "Done";
  html += `<div class="sheet-journey-row">
      <button class="journey-btn fav-toggle" data-fav-cat="${cat}" data-fav-id="${d.id}" data-active="${fav}">${fav?"♥ Favorited":"♡ Favorite"}</button>
      <button class="journey-btn done-toggle" data-done-cat="${cat}" data-done-id="${d.id}" data-active="${done}">${done?`✓ ${verb}`:`Mark as ${verb}`}</button>
    </div>`;

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
      if(d.credits){
        html += `<div class="sheet-section"><div class="sheet-label">CREDITS</div><div class="sheet-body">${d.credits}</div></div>`;
      }
      if(d.issueNumber){
        const bits = [];
        if(d.onSaleDate) bits.push(`On sale ${d.onSaleDate}`);
        if(d.coverPrice) bits.push(d.coverPrice);
        if(d.pageCount) bits.push(`${d.pageCount} pages`);
        if(d.rating) bits.push(`Rated ${d.rating}`);
        html += `<div class="sheet-section"><div class="sheet-label">ISSUE DETAILS</div><div class="sheet-body">${bits.join(" · ")}</div></div>`;
      }
      if(d.continuity || d.universe){
        const bits = [];
        if(d.continuity) bits.push(`<span class="tag">${d.continuity}</span>`);
        if(d.universe) bits.push(`<span class="tag">${d.universe}</span>`);
        html += `<div class="sheet-section"><div class="sheet-label">CONTINUITY &amp; UNIVERSE</div><div class="sheet-body">${bits.join(" ")}</div></div>`;
      }
      if(d.verificationStatus && d.verificationStatus!=="verified"){
        const label = d.verificationStatus==="needs_review" ? "Needs review" : "Partially verified";
        html += `<div class="sheet-section"><div class="sheet-label">RESEARCH STATUS</div><div class="sheet-body">⚠ ${label} — DC has never definitively clarified this title's exact continuity placement.${d.researchNote?` <span class="research-note">${d.researchNote}</span>`:""}</div></div>`;
      }
    }
  }

  sheetContent.innerHTML = html;
  wireImageFallbacks(sheetContent);

  const favToggleBtn = sheetContent.querySelector(".fav-toggle");
  if(favToggleBtn) favToggleBtn.addEventListener("click", ()=>{
    const nowFav = toggleFavorite(favToggleBtn.dataset.favCat, favToggleBtn.dataset.favId);
    favToggleBtn.dataset.active = nowFav ? "true" : "false";
    favToggleBtn.textContent = nowFav ? "♥ Favorited" : "♡ Favorite";
    document.querySelectorAll(`.fav-btn[data-fav-cat="${favToggleBtn.dataset.favCat}"][data-fav-id="${favToggleBtn.dataset.favId}"]`).forEach(b=>{
      b.dataset.active = nowFav ? "true" : "false";
      b.textContent = nowFav ? "♥" : "♡";
    });
    if(state.cat==="journey") renderJourney();
  });
  const doneToggleBtn = sheetContent.querySelector(".done-toggle");
  if(doneToggleBtn) doneToggleBtn.addEventListener("click", ()=>{
    const c = doneToggleBtn.dataset.doneCat, id = doneToggleBtn.dataset.doneId;
    const nowDone = toggleDone(c, id);
    const verb = PROGRESS_VERB[c] || "Done";
    doneToggleBtn.dataset.active = nowDone ? "true" : "false";
    doneToggleBtn.textContent = nowDone ? `✓ ${verb}` : `Mark as ${verb}`;
    if(state.cat==="journey") renderJourney();
  });

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

  sheetContent.querySelectorAll("[data-creator-link]").forEach(el=>{
    el.addEventListener("click", ()=>{
      stopAllTrailers();
      closeSheetEl(backdrop, sheet);
      openCreatorHub(el.dataset.creatorLink);
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

/* ============================= NERD MODE (Phase 4, Task 22) ============================= */
const nerdToggle = $("#nerdToggle");
function applyNerdModeUI(){
  nerdToggle.dataset.active = state.nerdMode ? "true" : "false";
  nerdToggle.title = state.nerdMode ? "Nerd Mode: ON" : "Nerd Mode: OFF";
}
applyNerdModeUI();
nerdToggle.addEventListener("click", ()=>{
  state.nerdMode = !state.nerdMode;
  localStorage.setItem("dc_nerd_mode", state.nerdMode ? "true" : "false");
  applyNerdModeUI();
  renderCards();
  renderStatsFooter();
});
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

/* ============================= READER ACCOUNT (Phase 1) ============================= */
const profileToggle = $("#profileToggle");
const profileAvatarImg = $("#profileAvatarImg"), profileAvatarFallback = $("#profileAvatarFallback");
const readerBackdrop = $("#readerBackdrop"), readerSheet = $("#readerSheet");
const readerAuthArea = $("#readerAuthArea"), readerProfileArea = $("#readerProfileArea");
const readerEmail = $("#readerEmail"), readerPassword = $("#readerPassword"), readerMsg = $("#readerMsg");
const readerHeading = $("#readerHeading"), readerSubmit = $("#readerSubmit");
const readerModeSignup = $("#readerModeSignup"), readerModeLogin = $("#readerModeLogin");
let readerAuthMode = "login"; // "login" | "signup"

function setReaderAuthMode(mode){
  readerAuthMode = mode;
  readerMsg.textContent = ""; readerMsg.className = "form-msg";
  if(mode==="signup"){
    readerHeading.textContent = "Create Account";
    readerSubmit.textContent = "Create Account";
    readerModeSignup.style.display = "none";
    readerModeLogin.style.display = "inline";
  }else{
    readerHeading.textContent = "Sign In";
    readerSubmit.textContent = "Sign In";
    readerModeSignup.style.display = "inline";
    readerModeLogin.style.display = "none";
  }
}
function updateReaderProfileUI(){
  const signedIn = !!readerUser;
  profileToggle.dataset.signedIn = signedIn ? "true" : "false";
  profileToggle.title = signedIn ? (readerUser.displayName || readerUser.email || "Account") : "Sign In";
  if(signedIn && readerUser.photoURL){
    profileAvatarImg.src = readerUser.photoURL;
    profileAvatarImg.style.display = "block";
    profileAvatarFallback.style.display = "none";
  }else{
    profileAvatarImg.style.display = "none";
    profileAvatarFallback.style.display = "flex";
  }
  if(signedIn){
    readerAuthArea.style.display = "none";
    readerProfileArea.style.display = "block";
    const name = readerUser.displayName || (readerUser.email ? readerUser.email.split("@")[0] : "Reader");
    $("#readerProfileName").textContent = name;
    $("#readerProfileEmail").textContent = readerUser.email || "";
    const fb = $("#readerProfileAvatarFallback"), img = $("#readerProfileAvatarImg");
    if(readerUser.photoURL){ img.src = readerUser.photoURL; img.style.display="block"; fb.style.display="none"; }
    else{ img.style.display="none"; fb.style.display="flex"; fb.textContent = initials(name); }
  }else{
    readerAuthArea.style.display = "block";
    readerProfileArea.style.display = "none";
    setReaderAuthMode("login");
  }
}
updateReaderProfileUI();

profileToggle.addEventListener("click", ()=>{
  updateReaderProfileUI();
  openSheetEl(readerBackdrop, readerSheet);
});
readerBackdrop.addEventListener("click", ()=> closeSheetEl(readerBackdrop, readerSheet));
$("#readerClose").addEventListener("click", ()=> closeSheetEl(readerBackdrop, readerSheet));
$("#readerCancel").addEventListener("click", ()=> closeSheetEl(readerBackdrop, readerSheet));
$("#readerToggleMode").addEventListener("click", (e)=>{ e.preventDefault(); setReaderAuthMode("signup"); });
$("#readerToggleModeBack").addEventListener("click", (e)=>{ e.preventDefault(); setReaderAuthMode("login"); });

$("#googleSignInBtn").addEventListener("click", async ()=>{
  readerMsg.textContent = ""; readerMsg.className = "form-msg";
  try{
    await signInWithPopup(auth, new GoogleAuthProvider());
    closeSheetEl(readerBackdrop, readerSheet);
  }catch(err){
    readerMsg.textContent = "Google sign-in failed: " + err.message;
    readerMsg.className = "form-msg err";
  }
});
readerSubmit.addEventListener("click", async ()=>{
  readerMsg.textContent = ""; readerMsg.className = "form-msg";
  const email = readerEmail.value.trim(), pw = readerPassword.value;
  if(!email || !pw){
    readerMsg.textContent = "Enter an email and password.";
    readerMsg.className = "form-msg err";
    return;
  }
  readerSubmit.disabled = true;
  try{
    if(readerAuthMode==="signup") await createUserWithEmailAndPassword(auth, email, pw);
    else await signInWithEmailAndPassword(auth, email, pw);
    closeSheetEl(readerBackdrop, readerSheet);
    readerEmail.value = ""; readerPassword.value = "";
  }catch(err){
    readerMsg.textContent = readerAuthMode==="signup"
      ? "Couldn't create account: " + err.message
      : "Sign-in failed — check the email and password.";
    readerMsg.className = "form-msg err";
  }finally{
    readerSubmit.disabled = false;
  }
});
$("#readerLogoutBtn").addEventListener("click", async ()=>{
  await signOut(auth);
  closeSheetEl(readerBackdrop, readerSheet);
});
$("#readerGoJourney").addEventListener("click", ()=>{
  closeSheetEl(readerBackdrop, readerSheet);
  goToCategory("journey");
});
$("#readerGoFavorites").addEventListener("click", ()=>{
  closeSheetEl(readerBackdrop, readerSheet);
  goToCategory("journey");
  setTimeout(()=> document.getElementById("journeyFavoritesSection")?.scrollIntoView({behavior:"smooth"}), 250);
});
$("#readerGoProgress").addEventListener("click", ()=>{
  closeSheetEl(readerBackdrop, readerSheet);
  goToCategory("journey");
  setTimeout(()=> document.getElementById("journeyProgressSection")?.scrollIntoView({behavior:"smooth"}), 250);
});

onAuthStateChanged(auth, async (user)=>{
  const wasSignedIn = !!readerUser;
  readerUser = user || null;

  // Admin is a separate, server-checked role — never inferred from "a user is signed in".
  isAdmin = user ? await checkIsAdmin(user.uid) : false;
  adminToggle.dataset.signedIn = isAdmin ? "true" : "false";
  fab.dataset.visible = isAdmin ? "true" : "false";
  if(isAdmin){
    loginArea.style.display = "none";
    signedInArea.style.display = "block";
    $("#signedInEmail").textContent = user.email;
  }else{
    loginArea.style.display = "block";
    signedInArea.style.display = "none";
  }

  updateReaderProfileUI();
  if(user && !wasSignedIn){
    await upsertReaderProfile(user);
    await onReaderLogin(user.uid);
    if(state.cat==="journey") renderJourney();
  }

  if(loaded) renderCards();
});

/* ============================= MOBILE BOTTOM NAV ============================= */
const mobileNav = $("#mobileNav");
const exploreBackdrop = $("#exploreBackdrop"), exploreSheet = $("#exploreSheet"), exploreGrid = $("#exploreGrid");
const moreBackdrop = $("#moreBackdrop"), moreSheet = $("#moreSheet");

/* ---- Phase 4: "Explore DC" discovery rails — real, data-backed categories only, never invented ---- */
function realHeroGroups(){
  // Every group that actually has at least one title anywhere in the catalogue, ranked the same way
  // the movies/series "By Hero" sort mode already ranks them — no invented groups, no empty tiles.
  const counts = {};
  CATS.forEach(c=>{ (DATA[c.id]||[]).forEach(d=>{ const g = groupOf(c.id,d); counts[g] = (counts[g]||0)+1; }); });
  return sortHeroNames(counts).filter(g=>g!=="Other DC Characters").map(g=>({ group:g, count:counts[g] }));
}
function realComicsEras(){
  // Pulled straight from the comics catalogue's own `era` field — whatever eras actually exist in the
  // real data, in first-appearance (oldest→newest) order, never a hardcoded/invented list.
  const withYear = {};
  (DATA.comics||[]).forEach(d=>{
    if(!d.era) return;
    const y = firstYear(d.y);
    if(withYear[d.era]===undefined || (y && y<withYear[d.era])) withYear[d.era] = y||withYear[d.era]||9999;
  });
  return Object.keys(withYear).sort((a,b)=>(withYear[a]||9999)-(withYear[b]||9999))
    .map(era=>({ era, count:(DATA.comics||[]).filter(d=>d.era===era).length }));
}
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

  const heroes = realHeroGroups();
  const exploreHeroRail = $("#exploreHeroRail");
  if(exploreHeroRail){
    exploreHeroRail.innerHTML = heroes.map(h=>{
      const t = groupTheme(h.group);
      return `<div class="explore-rail-tile" data-group="${escapeAttr(h.group)}" style="--theme-a:${t.a};--theme-b:${t.b};">
          <div class="explore-rail-tile-label">${h.group}</div>
          <div class="explore-rail-tile-count">${h.count} title${h.count===1?"":"s"}</div>
        </div>`;
    }).join("");
    exploreHeroRail.querySelectorAll(".explore-rail-tile").forEach(t=>{
      t.addEventListener("click", ()=>{
        closeSheetEl(exploreBackdrop, exploreSheet);
        openHub(t.dataset.group);
      });
    });
  }

  const eras = realComicsEras();
  const exploreEraRail = $("#exploreEraRail");
  if(exploreEraRail){
    if(!eras.length){
      exploreEraRail.innerHTML = "";
      exploreEraRail.closest(".explore-rail-section").style.display = "none";
    } else {
      exploreEraRail.closest(".explore-rail-section").style.display = "";
      exploreEraRail.innerHTML = eras.map(e=>
        `<div class="explore-rail-tile era" data-era="${escapeAttr(e.era)}">
           <div class="explore-rail-tile-label">${e.era}</div>
           <div class="explore-rail-tile-count">${e.count} comic${e.count===1?"":"s"}</div>
         </div>`
      ).join("");
      exploreEraRail.querySelectorAll(".explore-rail-tile").forEach(t=>{
        t.addEventListener("click", ()=>{
          closeSheetEl(exploreBackdrop, exploreSheet);
          state.cat = "comics";
          resetFiltersForTabSwitch();
          state.f1 = t.dataset.era;
          render();
        });
      });
    }
  }
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
      const nerdRow = $("#moreQuickNerd");
      if(nerdRow) nerdRow.textContent = state.nerdMode ? "🤓 Nerd Mode: ON" : "🤓 Nerd Mode: OFF";
      openSheetEl(moreBackdrop, moreSheet);
    }
    updateMobileNavActive();
  });
});
exploreBackdrop.addEventListener("click", ()=> closeSheetEl(exploreBackdrop, exploreSheet));
$("#exploreClose").addEventListener("click", ()=> closeSheetEl(exploreBackdrop, exploreSheet));
moreBackdrop.addEventListener("click", ()=> closeSheetEl(moreBackdrop, moreSheet));
$("#moreClose").addEventListener("click", ()=> closeSheetEl(moreBackdrop, moreSheet));

$("#moreQuickStart").addEventListener("click", ()=>{
  closeSheetEl(moreBackdrop, moreSheet);
  openStartSheet();
});
$("#moreQuickJourney").addEventListener("click", ()=>{
  closeSheetEl(moreBackdrop, moreSheet);
  goToCategory("journey");
});
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
$("#moreQuickEvents").addEventListener("click", ()=>{
  closeSheetEl(moreBackdrop, moreSheet);
  openEventHub();
});
$("#moreQuickGlossary").addEventListener("click", ()=>{
  closeSheetEl(moreBackdrop, moreSheet);
  openGlossary();
});
$("#moreQuickMultiverse").addEventListener("click", ()=>{
  closeSheetEl(moreBackdrop, moreSheet);
  openMultiverseMap();
});
$("#moreQuickNerd").addEventListener("click", ()=>{
  nerdToggle.click();
  $("#moreQuickNerd").textContent = state.nerdMode ? "🤓 Nerd Mode: ON" : "🤓 Nerd Mode: OFF";
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

/* ============================= ADMIN: REPLACE COMICS ============================= */
const replaceComicsBtn = $("#replaceComicsBtn");
const replaceComicsMsg = $("#replaceComicsMsg");
if(replaceComicsBtn){
  replaceComicsBtn.addEventListener("click", async ()=>{
    if(!confirm("This deletes all existing Comics entries, then loads the current dataset from seed-data.json. Continue?")) return;
    replaceComicsBtn.disabled = true;
    replaceComicsMsg.className = "form-msg";
    try{
      replaceComicsMsg.textContent = "Fetching dataset…";
      const res = await fetch("./seed-data.json", { cache: "no-store" });
      if(!res.ok) throw new Error("seed-data.json not found");
      const seed = await res.json();

      const existing = DATA.comics;
      for(let i=0;i<existing.length;i++){
        replaceComicsMsg.textContent = `Deleting old comics: ${i+1} / ${existing.length}…`;
        await deleteDoc(doc(db, "comics", existing[i].id));
      }
      DATA.comics = [];

      const items = seed.comics || [];
      for(let i=0;i<items.length;i++){
        replaceComicsMsg.textContent = `Importing new comics: ${i+1} / ${items.length}…`;
        const ref = await addDoc(collection(db, "comics"), items[i]);
        DATA.comics.push({ id: ref.id, ...items[i] });
      }
      replaceComicsMsg.textContent = `Done — Comics replaced (${items.length} entries).`;
      replaceComicsMsg.className = "form-msg ok";
      buildTabs();
      renderCards();
    }catch(err){
      replaceComicsMsg.textContent = "Replace failed: " + err.message;
      replaceComicsMsg.className = "form-msg err";
    }finally{
      replaceComicsBtn.disabled = false;
    }
  });
}

/* ============================= ADMIN: REPLACE BEGINNER GUIDE ============================= */
const replaceBeginnerBtn = $("#replaceBeginnerBtn");
const replaceBeginnerMsg = $("#replaceBeginnerMsg");
if(replaceBeginnerBtn){
  replaceBeginnerBtn.addEventListener("click", async ()=>{
    if(!confirm('This deletes the existing "New to DC?" beginner-guide data, then loads the current curated dataset from seed-data.json. Continue?')) return;
    replaceBeginnerBtn.disabled = true;
    replaceBeginnerMsg.className = "form-msg";
    try{
      replaceBeginnerMsg.textContent = "Fetching dataset…";
      const res = await fetch("./seed-data.json", { cache: "no-store" });
      if(!res.ok) throw new Error("seed-data.json not found");
      const seed = await res.json();

      let total = 0;
      for(const key of META_COLLECTIONS){
        const existing = DATA[key] || [];
        for(let i=0;i<existing.length;i++){
          replaceBeginnerMsg.textContent = `Deleting old ${key}: ${i+1} / ${existing.length}…`;
          await deleteDoc(doc(db, key, existing[i].id));
        }
        DATA[key] = [];

        const items = seed[key] || [];
        for(let i=0;i<items.length;i++){
          replaceBeginnerMsg.textContent = `Importing ${key}: ${i+1} / ${items.length}…`;
          const ref = await addDoc(collection(db, key), items[i]);
          DATA[key].push({ id: ref.id, ...items[i] });
        }
        total += items.length;
      }
      replaceBeginnerMsg.textContent = `Done — Beginner guide replaced (${total} records).`;
      replaceBeginnerMsg.className = "form-msg ok";
    }catch(err){
      replaceBeginnerMsg.textContent = "Replace failed: " + err.message;
      replaceBeginnerMsg.className = "form-msg err";
    }finally{
      replaceBeginnerBtn.disabled = false;
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
  entry.addedAt = new Date().toISOString().slice(0,10);
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

/* ============================= FAVORITE BUTTON (global, event-delegated) ============================= */
document.addEventListener("click", (e)=>{
  const btn = e.target.closest(".fav-btn");
  if(!btn) return;
  e.stopPropagation();
  e.preventDefault();
  const cat = btn.dataset.favCat, id = btn.dataset.favId;
  const nowFav = toggleFavorite(cat, id);
  btn.dataset.active = nowFav ? "true" : "false";
  btn.textContent = nowFav ? "♥" : "♡";
  document.querySelectorAll(`.fav-btn[data-fav-cat="${cat}"][data-fav-id="${id}"]`).forEach(b=>{
    b.dataset.active = nowFav ? "true" : "false";
    b.textContent = nowFav ? "♥" : "♡";
  });
  if(state.cat==="journey") renderJourney();
});
