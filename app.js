import { db, auth } from "./firebase-config.js";
import {
  collection, getDocs, addDoc, deleteDoc, doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider,
  signOut, onAuthStateChanged, sendPasswordResetEmail, updateProfile, deleteUser
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
  comicsView:"landing", // Pointer 4: Comics tab opens its landing; "browse" = the old flat catalogue
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
// Admin is a separate ROLE, not "any signed-in user". The REAL enforcement is firestore.rules, which grants
// catalogue writes to exactly one hardcoded UID. This client-side check only decides whether to SHOW the
// admin tools, and mirrors the same UID so the UI and the rules can never disagree. (The legacy
// admins/{uid} lookup is kept as a fallback for older rule versions; with the current rules that read is
// denied and simply returns false.) A reader signing in via Google/email can never become admin.
const ADMIN_UID = "LKn2UQKsUMcb26Fe4eFeuTxmONm1";
async function checkIsAdmin(uid){
  if(uid === ADMIN_UID) return true;
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
  // Phase 14: a refresh restores the tab you were on (from the URL hash) instead of dumping you on Home —
  // unless the reader turned off "Continue Where I Left Off" in Settings, in which case always start fresh.
  const fromHash = continueWhereLeftOffOn() ? tabFromHash() : null;
  if(fromHash) state.cat = fromHash;
  else{
    const def = defaultContentSetting();
    if(def && def!=="all") state.cat = def;
  }
  history.replaceState({cat:state.cat}, "", location.href);
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

/* ============================= JOURNEYS (Phases 8, 10, 11, 12, 15) =============================
   A reader can have MANY journeys at once — a New to DC starter path, branches spawned from it ("Go deeper",
   "Keep watching"…), and comics reading paths. Starting a new journey never deletes an old one.

   Storage (logged out): localStorage "dc_journeys" = { activeId, journeys:[…] }.
   Storage (logged in):  the same object mirrored to users/{uid}/preferences/dcJourneys, merged per-journey by
                         id on login (newest updatedAt wins), so journeys follow the reader across devices.
   Journeys store ONLY ids + state — titles are referenced by the stable "cat::title::year" titleKey (never a
   Firestore doc id, which changes on every catalogue re-import) and never duplicated.
   Done/not-done is the site-wide progress store (isDone), so finishing a title counts in every journey.

   Journey shape: { id, kind:"starter"|"branch"|"comics", title, heroGroup, selectedHero, selectedMedium,
                    selectedIntent, parentId, branchMode, continuity, pathOrder, recommendedTitleKeys[],
                    completedAt{itemKey:iso}, createdAt, updatedAt }
   The legacy single-journey key "dc_journey" (and cloud doc preferences/dcJourney) is migrated once. */
const LS_JOURNEY_KEY = "dc_journey";     // legacy single journey — read once for migration, never written
const LS_JOURNEYS_KEY = "dc_journeys";
function newJourneyId(){ return "j_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function legacyJourneyToEntry(legacy){
  if(!legacy || !Array.isArray(legacy.recommendedTitleKeys)) return null;
  // Deterministic id from createdAt so the same legacy journey migrated on two devices merges, not duplicates.
  return { ...legacy, id: legacy.id || ("legacy_" + (legacy.createdAt || "0")), kind: legacy.kind || "starter" };
}
function getJourneyStore(){
  let store = lsGetJson(LS_JOURNEYS_KEY, null);
  if(!store || !Array.isArray(store.journeys)){
    store = { activeId:null, journeys:[] };
    const migrated = legacyJourneyToEntry(lsGetJson(LS_JOURNEY_KEY, null));
    if(migrated){ store.journeys.push(migrated); store.activeId = migrated.id; }
    lsSetJson(LS_JOURNEYS_KEY, store);
  }
  if(store.journeys.length && !store.journeys.some(j=>j.id===store.activeId)){
    store.activeId = [...store.journeys].sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""))[0].id;
  }
  return store;
}
function saveJourneyStore(store, opts){
  lsSetJson(LS_JOURNEYS_KEY, store);
  if(readerUser && !(opts && opts.noSync)) syncJourneysToCloud(readerUser.uid, store);
}
function getAllJourneys(){ return getJourneyStore().journeys; }
function getJourneyById(id){ return getAllJourneys().find(j=>j.id===id) || null; }
// The ACTIVE journey (what "Continue" shows). Kept under its old name so older call sites keep working.
function getSavedJourney(){ const s = getJourneyStore(); return s.journeys.find(j=>j.id===s.activeId) || null; }
// Upsert a journey. `makeActive` defaults to true for brand-new journeys only.
function upsertJourney(journey, makeActive){
  const store = getJourneyStore();
  if(!journey.id) journey.id = newJourneyId();
  journey.kind = journey.kind || "starter";
  journey.updatedAt = new Date().toISOString();
  const idx = store.journeys.findIndex(j=>j.id===journey.id);
  const isNew = idx<0;
  if(isNew) store.journeys.unshift(journey); else store.journeys[idx] = journey;
  if(makeActive===true || (makeActive===undefined && isNew)) store.activeId = journey.id;
  saveJourneyStore(store);
  return journey;
}
function setSavedJourney(journey){ return upsertJourney(journey, true); }
function setActiveJourney(id){
  const store = getJourneyStore();
  if(!store.journeys.some(j=>j.id===id)) return;
  store.activeId = id;
  saveJourneyStore(store);
}
function syncJourneysToCloud(uid, store){
  const ref = doc(db, "users", uid, "preferences", "dcJourneys");
  setDoc(ref, { activeId: store.activeId || null, journeys: store.journeys, updatedAt: serverTimestamp() })
    .catch(e=>console.warn("[Reader] journeys sync failed:", e.message));
}
async function pullJourneyFromCloud(uid){
  try{
    const local = getJourneyStore();
    const [snap, legacySnap] = await Promise.all([
      getDoc(doc(db, "users", uid, "preferences", "dcJourneys")),
      getDoc(doc(db, "users", uid, "preferences", "dcJourney")),
    ]);
    const cloudJourneys = snap.exists() && Array.isArray(snap.data().journeys) ? snap.data().journeys : [];
    const legacyCloud = legacySnap.exists() ? legacyJourneyToEntry(legacySnap.data()) : null;
    const byId = new Map();
    [...cloudJourneys, ...(legacyCloud?[legacyCloud]:[]), ...local.journeys].forEach(j=>{
      if(!j || !j.id) return;
      const prev = byId.get(j.id);
      if(!prev || (j.updatedAt||"") >= (prev.updatedAt||"")) byId.set(j.id, j);   // newest edit wins, never deletes
    });
    const merged = [...byId.values()].sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));
    let activeId = local.activeId;
    if(!merged.some(j=>j.id===activeId)) activeId = snap.exists() ? snap.data().activeId : null;
    if(!merged.some(j=>j.id===activeId)) activeId = merged[0] ? merged[0].id : null;
    const store = { activeId, journeys: merged };
    saveJourneyStore(store, {noSync:true});
    syncJourneysToCloud(uid, store);
  }catch(e){ console.warn("[Reader] journey pull failed:", e.message); }
}

/* ---- Journey helpers ---- */
function journeyHero(journey){
  // Starter journeys reference a BEGINNER_CHARACTERS id; comics/branch journeys may reference any real
  // hero/team group (e.g. "Justice League"). Either way we return the {id,label,group} shape scoring uses.
  const b = BEGINNER_CHARACTERS.find(h=>h.id===journey.selectedHero);
  if(b) return b;
  const g = journey.heroGroup || journey.selectedHero;
  return g ? { id:g, label:g, group:g } : null;
}
function journeyItems(journey){ return (journey.recommendedTitleKeys||[]).map(resolveTitleKey).filter(Boolean); }
function journeyStats(journey){
  const items = journeyItems(journey);
  const done = items.filter(it=>isDone(it.cat, it.d.id)).length;
  return { items, done, total:items.length, complete: items.length>0 && done===items.length };
}
function journeyTitle(journey){
  if(journey.title) return journey.title;
  const h = journeyHero(journey);
  return `${h ? h.label : "DC"} starting path`;
}
const JOURNEY_KIND_LABEL = { starter:"Starting path", branch:"Journey", comics:"Comics reading path" };

/* ---- Phase 8 + 11: past-completion branching ----
   A finished journey becomes a branch point. Each choice either opens a real existing destination
   (comics reading paths, the Multiverse Map of continuities) or creates a NEW child journey whose picks are
   re-scored by the same ranked engine that built the starter path (scoreCandidate — never random, never
   rating-only). The parent journey is kept, so the reader's history of journeys grows rather than being
   overwritten. Titles already in ANY journey, or already marked done, are never re-suggested. */
const JOURNEY_BRANCH_OPTIONS = [
  { id:"deeper",       label:h=>`Go deeper into ${h}`,           sub:"More essential stories for this hero" },
  { id:"comics",       label:h=>`Explore ${h} comics`,           sub:"Pick a continuity and start a reading path" },
  { id:"continuities", label:()=>"Explore DC continuities",      sub:"See how every DC timeline fits together" },
  { id:"wider",        label:()=>"Explore the wider DC Universe", sub:"Connected team-ups and shared-universe picks" },
  { id:"keepwatching", label:()=>"Keep watching",                 sub:"More movies & series" },
  { id:"surprise",     label:()=>"Surprise me",                   sub:"A wildcard path from the whole compendium" },
];
function comicsCountForGroup(group){ return (DATA.comics||[]).filter(d=>d.group===group).length; }
function allJourneyKeys(){
  const s = new Set();
  getAllJourneys().forEach(j=>(j.recommendedTitleKeys||[]).forEach(k=>s.add(k)));
  return s;
}
function titleKeyOf(cat, d){ return `${cat}::${d.t}::${d.y}`; }
function rankBranchPicks(parent, mode, limit){
  const hero = journeyHero(parent);
  if(!hero) return [];
  const exclude = allJourneyKeys();
  const curated = buildCuratedMap(hero.id);
  const intent = mode==="wider" ? "universe" : (mode==="surprise" ? "surprise" : (parent.selectedIntent || "meet-hero"));
  const medium = mode==="keepwatching" ? "movies" : (parent.selectedMedium || "all");
  const rank = pool => pool
    .map(p=>({ cat:p.cat, d:p.d, key:titleKeyOf(p.cat, p.d) }))
    .filter(p=>!exclude.has(p.key) && !isDone(p.cat, p.d.id))
    .map(p=>({ ...p, score:scoreCandidate(p.cat, p.d, hero, medium, intent, curated) }))
    .sort((a,b)=>b.score-a.score);

  const heroKeys = new Set(buildCandidatePool(hero).map(p=>itemKey(p.cat,p.d.id)));
  let tiers;
  if(mode==="deeper"){
    tiers = [ buildCandidatePool(hero), buildRelatedPool(hero, heroKeys) ];
  } else if(mode==="keepwatching"){
    const ms = p=>p.cat==="movies"||p.cat==="series";
    tiers = [ buildCandidatePool(hero).filter(ms), buildRelatedPool(hero, heroKeys).filter(ms) ];
  } else if(mode==="wider"){
    // Explicitly NOT this hero's own titles: team-ups featuring the hero first, then shared-universe titles.
    tiers = [ buildRelatedPool(hero, heroKeys), buildBroaderPool(heroKeys) ];
  } else {
    tiers = [ buildBroaderPool(new Set()) ];
  }
  const out = [], seen = new Set();
  tiers.forEach(pool=>{
    rank(pool).forEach(p=>{ if(out.length<limit && !seen.has(p.key)){ seen.add(p.key); out.push(p); } });
  });
  return out;
}
// Returns { journey } on success, or { error } with a plain-language reason.
function branchFromJourney(parent, mode){
  const hero = journeyHero(parent);
  const heroLabel = hero ? hero.label : "DC";
  // Re-use an existing branch of the same kind instead of creating duplicates.
  const existing = getAllJourneys().find(j=>j.parentId===parent.id && j.branchMode===mode);
  if(existing){ setActiveJourney(existing.id); return { journey:existing }; }
  const picks = rankBranchPicks(parent, mode, 6);
  if(!picks.length) return { error:"Nothing new left for this path yet — try another option." };
  const opt = JOURNEY_BRANCH_OPTIONS.find(o=>o.id===mode);
  const child = {
    id: newJourneyId(), kind:"branch", parentId: parent.id, branchMode: mode,
    title: mode==="surprise" ? "Surprise path" : (mode==="wider" ? "The wider DC Universe" : `${heroLabel}: ${opt.label(heroLabel).replace(/^Go deeper into .*/,"Going deeper")}`),
    heroGroup: hero ? hero.group : null, selectedHero: parent.selectedHero,
    selectedMedium: parent.selectedMedium, selectedIntent: parent.selectedIntent,
    recommendedTitleKeys: picks.map(p=>p.key), completedAt:{}, createdAt: new Date().toISOString(),
  };
  setSavedJourney(child);
  return { journey:child };
}
// Journey-scoped completion timestamps (for "Recently Completed"). Applied to EVERY journey that contains the
// title, since done-state is shared across journeys.
function recordJourneyCompletion(cat, id, done){
  const d = (DATA[cat]||[]).find(x=>x.id===id);
  if(!d) return;
  const key = titleKeyOf(cat, d), ik = itemKey(cat, id);
  const store = getJourneyStore();
  let changed = false;
  store.journeys.forEach(j=>{
    if(!(j.recommendedTitleKeys||[]).includes(key)) return;
    j.completedAt = j.completedAt || {};
    if(done) j.completedAt[ik] = new Date().toISOString(); else delete j.completedAt[ik];
    j.updatedAt = new Date().toISOString();
    changed = true;
  });
  if(changed) saveJourneyStore(store);
}

/* ---- Journey rendering ---- */
function journeyCompletionHtml(journey){
  const hero = journeyHero(journey);
  const heroLabel = hero ? hero.label : "DC";
  const hasComics = hero && comicsCountForGroup(hero.group) > 0;
  const buttons = JOURNEY_BRANCH_OPTIONS
    .filter(opt=> opt.id!=="comics" || hasComics)   // never offer a comics path for a hero with no comics in the data
    .filter(opt=> !(journey.kind==="comics" && opt.id==="comics"))
    .map(opt=>{
      const existing = getAllJourneys().find(j=>j.parentId===journey.id && j.branchMode===opt.id);
      return `<button class="journey-branch-btn" data-branch="${opt.id}">
         <span class="journey-branch-label">${opt.label(heroLabel)}</span>
         <span class="journey-branch-sub">${existing ? "Continue this path →" : opt.sub}</span>
       </button>`;
    }).join("");
  const title = journey.kind==="starter"
    ? `${heroLabel.toUpperCase()} STARTING PATH COMPLETE ✓`
    : `${journeyTitle(journey).toUpperCase()} COMPLETE ✓`;
  const sub = journey.kind==="starter" ? "You've got the basics. Where do you want to go next?" : "Where do you want to go next?";
  return `<div class="journey-complete-block" id="journeyCompleteBlock">
      <div class="journey-complete-title">${title}</div>
      <div class="journey-complete-sub">${sub}</div>
      <div class="journey-branch-grid">${buttons}</div>
    </div>`;
}
function journeyNextUpHtml(nextItem, idAttr){
  if(!nextItem) return "";
  const catLabel = (CATS.find(c=>c.id===nextItem.cat)||{}).label || nextItem.cat;
  return `<div class="journey-next-up" id="${idAttr||"journeyNextUp"}" data-cat="${nextItem.cat}" data-id="${nextItem.d.id}">
      <span class="journey-next-up-label">NEXT UP</span>
      <span class="journey-next-up-title">${nextItem.d.t}<span class="bc-year">${nextItem.d.y||""}</span></span>
      <span class="journey-next-up-meta">${CAT_ICON[nextItem.cat]||""} ${catLabel}</span>
      <span class="journey-next-up-cta">Continue Journey →</span>
    </div>`;
}
function renderJourneySequenceHtml(journey){
  const { items, done:doneCount, complete } = journeyStats(journey);
  if(!items.length) return "";
  const hero = journeyHero(journey);
  const theme = groupTheme(hero ? hero.group : "");
  const rows = items.map((it,i)=>{
    const done = isDone(it.cat, it.d.id);
    const catLabel = (CATS.find(c=>c.id===it.cat)||{}).label || it.cat;
    const extra = it.cat==="comics" && it.d.era ? ` · ${it.d.era}` : "";
    return `<div class="journey-seq-item" data-cat="${it.cat}" data-id="${it.d.id}" data-done="${done}">
        <div class="journey-seq-num" data-done="${done}">${done?"✓":i+1}</div>
        <div class="journey-seq-body">
          <div class="journey-seq-title">${it.d.t}<span class="bc-year">${it.d.y||""}</span></div>
          <div class="journey-seq-meta">${CAT_ICON[it.cat]||""} ${catLabel}${extra}</div>
        </div>
        <button class="btn btn-small journey-seq-toggle" data-cat="${it.cat}" data-id="${it.d.id}">${done?"Done ✓":"Mark done"}</button>
      </div>`;
  }).join("");
  const nextItem = !complete ? items.find(it=>!isDone(it.cat, it.d.id)) : null;
  const tail = complete ? journeyCompletionHtml(journey) : journeyNextUpHtml(nextItem);
  const pct = Math.round((doneCount/items.length)*100);
  const parent = journey.parentId ? getJourneyById(journey.parentId) : null;
  return `<div class="home-section journey-active" id="journeySequenceSection" style="--theme-a:${theme.a};--theme-b:${theme.b}">
      <div class="journey-active-head">
        <div class="journey-active-kind">${(JOURNEY_KIND_LABEL[journey.kind]||"Journey").toUpperCase()}${parent?` · FROM ${escapeAttr(journeyTitle(parent)).toUpperCase()}`:""}</div>
        <h3 class="journey-active-title">${escapeAttr(journeyTitle(journey))}</h3>
        <div class="journey-active-progress"><div class="journey-progress-bar"><div class="journey-progress-fill" style="width:${pct}%"></div></div><span>${doneCount}/${items.length}</span></div>
      </div>
      ${complete ? "" : tail}
      <div class="journey-seq-list">${rows}</div>
      ${complete ? tail : ""}
    </div>`;
}
function openJourneyTitle(cat, id){
  const d = (DATA[cat]||[]).find(x=>x.id===id);
  if(d) openSheet(d, cat);
}
function wireJourneySequenceHandlers(root){
  root.querySelectorAll(".journey-seq-toggle").forEach(btn=>{
    btn.addEventListener("click", e=>{
      e.stopPropagation();
      const nowDone = toggleDone(btn.dataset.cat, btn.dataset.id);
      recordJourneyCompletion(btn.dataset.cat, btn.dataset.id, nowDone);
      if(state.cat==="journey") renderJourney({skipRefresh:true});
    });
  });
  root.querySelectorAll(".journey-seq-item").forEach(item=>{
    item.addEventListener("click", e=>{
      if(e.target.closest(".journey-seq-toggle")) return;
      openJourneyTitle(item.dataset.cat, item.dataset.id);
    });
  });
  root.querySelectorAll("#journeyNextUp").forEach(nextUp=>{
    nextUp.addEventListener("click", ()=> openJourneyTitle(nextUp.dataset.cat, nextUp.dataset.id));
  });
  root.querySelectorAll(".journey-branch-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const mode = btn.dataset.branch;
      const parent = getSavedJourney();
      if(!parent) return;
      const hero = journeyHero(parent);
      if(mode==="comics"){ openComicsPath(hero ? hero.group : null, parent.id); return; }
      if(mode==="continuities"){ openMultiverseMap(); return; }
      const result = branchFromJourney(parent, mode);
      if(result.error){
        btn.querySelector(".journey-branch-sub").textContent = result.error;
        return;
      }
      goToCategory("journey");
      window.scrollTo({top:0, behavior:"smooth"});
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
  state.comicsView="landing";
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
  if(cat==="home" || cat==="journey" || isComicsLanding()){
    introEl.textContent = "";
    introEl.style.display = "none";
  } else {
    introEl.style.display = "";
    introEl.textContent = INTRO[cat];
  }
  filterRow.innerHTML = "";
  chipRow.innerHTML = "";

  if(cat==="home" || cat==="journey" || isComicsLanding()) return;

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
      <select id="selViewerLevel"><option value="all">Any viewer level</option>${VL_OPTIONS.map(o=>`<option value="${o}">${o} (${msCountWith({viewerLevelFilter:o})})</option>`).join("")}</select>
      <select id="selComplexity"><option value="all">Any complexity</option>${CX_OPTIONS.map(o=>`<option value="${o}">${o} (${msCountWith({complexityFilter:o})})</option>`).join("")}</select>
      <select id="selCanonStatus"><option value="all">Any canon status</option>${CANON_OPTIONS.map(o=>`<option value="${o}">${canonShort(o)} (${msCountWith({canonFilter:o})})</option>`).join("")}</select>
    </div>`;
  filterRow.querySelectorAll('input[name="typeFilter"]').forEach(r=>{
    r.addEventListener("change", e=>{ state.typeFilter = e.target.value; buildFilters(); renderCards(); });
  });
  $("#selViewerLevel").value = state.viewerLevelFilter;
  $("#selComplexity").value = state.complexityFilter;
  $("#selCanonStatus").value = state.canonFilter;
  $("#selViewerLevel").addEventListener("change", e=>{ state.viewerLevelFilter = e.target.value; buildFilters(); renderCards(); });
  $("#selComplexity").addEventListener("change", e=>{ state.complexityFilter = e.target.value; buildFilters(); renderCards(); });
  $("#selCanonStatus").addEventListener("change", e=>{ state.canonFilter = e.target.value; buildFilters(); renderCards(); });

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
function noMatchesHtml(chips, extra){
  if(!chips.length && !extra){
    return `<div class="empty">Nothing here yet.</div>`;
  }
  const removeBtns = (extra ? `<button class="btn btn-small btn-primary" id="emptyExtraBtn">${escapeAttr(extra.label)}</button>` : "") +
    chips.map((c,i)=>`<button class="btn btn-small" data-clear-i="${i}">Remove: ${escapeAttr(c.label)}</button>`).join("");
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

// How many titles a filter option WOULD return given every other active filter — shown next to each option
// ("Hardcore Fan (0)") so readers can see a genuinely empty combination before choosing it.
function msCountWith(overrides){
  const saved = {};
  Object.keys(overrides).forEach(k=>{ saved[k] = state[k]; state[k] = overrides[k]; });
  const n = filteredMovieSeries().length;
  Object.keys(saved).forEach(k=>{ state[k] = saved[k]; });
  return n;
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
    // "Show related titles" suggestion: the same filters in the OTHER format (Live Action ↔ Animated),
    // offered as an explicit button — the reader's selection is never changed silently.
    const other = state.typeFilter==="Live Action" ? "Animated" : "Live Action";
    const otherN = msCountWith({typeFilter:other});
    const extra = otherN ? { label:`Show ${otherN} ${other} match${otherN===1?"":"es"} instead` } : null;
    gridEl.innerHTML = activeFilterBarHtml(chips) + noMatchesHtml(chips, extra);
    wireFilterBarHandlers(gridEl, chips);
    const extraBtn = $("#emptyExtraBtn");
    if(extraBtn) extraBtn.addEventListener("click", ()=>{ state.typeFilter = other; buildFilters(); renderCards(); });
    return;
  }

  let html = activeFilterBarHtml(chips);
  if(state.sortMode==="newest"){
    const sorted = [...items].sort((a,b)=>firstYear(b.y)-firstYear(a.y));
    html += sorted.map(d=>cardHtml(cat,d)).join("");
  }
  else if(state.sortMode==="rating"){
    const rated = items.filter(d=>ratingScore(d)!==null).sort((a,b)=>ratingScore(b)-ratingScore(a));
    const unrated = items.filter(d=>ratingScore(d)===null).sort((a,b)=>firstYear(b.y)-firstYear(a.y));
    html += rated.map(d=>cardHtml(cat,d)).join("");
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
      if(d) openSheet(d, cat);
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
  if(cat==="comics"){
    // Pointer 3: entry point into the new character-first Comics Continuity Explorer
    // (comics-v2/explorer.js — an independent module; it delegates clicks on this button's id
    // rather than app.js calling into it directly, since this grid re-renders on every filter change).
    // This is purely additive — the flat catalogue below is completely untouched.
    html += `<button class="cl-back-landing" id="comicsBackToLandingBtn">← Comics home · Story Map</button>`;
    html += `<button class="cp-entry-card" id="comicsExplorerEntryBtn"><span>🧭 Explore the DC Comics Continuity</span><span class="cp-entry-sub">Characters → continuities → series → runs → stories → issues →</span></button>`;
    html += `<button class="cp-entry-card" id="comicsTabPathBtn"><span>📖 Not sure where to start? Build a reading path</span><span class="cp-entry-sub">Hero → continuity → read in order, with progress tracking →</span></button>`;
  }
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
  const comicsTabPathBtn = $("#comicsTabPathBtn");
  if(comicsTabPathBtn) comicsTabPathBtn.addEventListener("click", ()=> openComicsPath(null));
  const backToLanding = $("#comicsBackToLandingBtn");
  if(backToLanding) backToLanding.addEventListener("click", ()=> goToCategory("comics"));
  attachCardHandlers(cat);
}

function renderCards(){
  if(!loaded) return;
  if(state.cat==="home") renderHome();
  else if(state.cat==="journey") renderJourney();
  else if(state.cat==="movies" || state.cat==="series") renderMovieSeriesCards();
  else if(isComicsLanding()) renderComicsLanding();
  else renderGenericCards();
}

/* ============================= RENDER: COMICS LANDING (Pointer 4) =============================
   The Comics tab opens a dedicated landing (comics-v2/landing.js — an independent module, reached
   through window.__comicsV2Landing). The old flat catalogue is one tap away ("Browse all comics")
   and is still what any era/canon/line filter shows. If the module hasn't loaded, fall back to the
   catalogue so Comics can never break. */
function isComicsLanding(){
  return state.cat==="comics" && state.comicsView!=="browse" &&
    state.f1==="all" && state.f2==="all" && state.f3==="all" && state.chip==="all"; // search uses the global dropdown
}
function renderComicsLanding(){
  const landing = window.__comicsV2Landing;
  if(!landing || typeof landing.render!=="function"){ renderGenericCards(); return; }
  countEl.textContent = "";
  landing.render(gridEl, {
    catalogueCount: (DATA.comics||[]).length,
    onBrowseAll: ()=>{ state.comicsView = "browse"; buildFilters(); renderCards(); window.scrollTo(0,0); },
    onReadingPath: ()=> openComicsPath(null),
  });
}
document.addEventListener("comicsv2:landing-ready", ()=>{ if(loaded && isComicsLanding()){ buildFilters(); renderCards(); } });

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
  const activeHero = activeJourney ? journeyHero(activeJourney) : null;
  const journeyHeroGroup = activeHero ? activeHero.group : null;
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

  // Phase 12/15: the active journey's next step is one tap from Home — works logged out (local) or in (synced).
  if(activeJourney){
    const st = journeyStats(activeJourney);
    if(st.total){
      const nextIt = st.items.find(it=>!isDone(it.cat, it.d.id));
      html += `<div class="home-section" id="homeJourneyNext">
          <div class="home-section-head"><h3>Your Journey</h3><span class="home-section-sub">${escapeAttr(journeyTitle(activeJourney))} · ${st.done}/${st.total}</span></div>
          ${nextIt ? journeyNextUpHtml(nextIt, "homeNextUp") :
            `<div class="journey-next-up" id="homeNextUpDone"><span class="journey-next-up-label">PATH COMPLETE ✓</span><span class="journey-next-up-title">Choose where to go next</span><span class="journey-next-up-cta">Open My Journey →</span></div>`}
        </div>`;
    }
  }
  if(journeyItems.length){
    html += stripHtml("homeJourneyStrip", "Continue Your Journey", "Your favorites & progress", journeyItems);
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
      openSheet(d, cat);
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
  const homeNextUp = $("#homeNextUp");
  if(homeNextUp) homeNextUp.addEventListener("click", ()=> goToCategory("journey"));
  const homeNextUpDone = $("#homeNextUpDone");
  if(homeNextUpDone) homeNextUpDone.addEventListener("click", ()=> goToCategory("journey"));
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

  // ---- Phase 12: My Journey is a hub — CONTINUE / YOUR JOURNEYS / RECENTLY COMPLETED / DISCOVER NEXT ----
  const journeys = getAllJourneys();
  const journey = getSavedJourney();
  if(journey){
    html += `<div class="home-section-head journey-section-label"><h3>CONTINUE</h3></div>`;
    html += renderJourneySequenceHtml(journey);
  } else {
    html += `<div class="journey-empty-cta home-section" id="journeyEmptyCta">
        <div class="home-section-head"><h3>CONTINUE</h3></div>
        <p class="journey-empty">You haven't started a DC journey yet — no sign-in needed.</p>
        <button class="btn btn-primary" id="journeyStartCtaBtn">New to DC? Start Here</button>
        <button class="btn btn-ghost journey-comics-cta" id="journeyComicsCtaBtn">📖 Start a comics reading path</button>
      </div>`;
  }

  if(journeys.length){
    const cards = journeys.map(j=>{
      const st = journeyStats(j);
      const hero = journeyHero(j);
      const t = groupTheme(hero ? hero.group : "");
      const active = journey && j.id===journey.id;
      const badge = st.complete ? `<span class="jc-badge done">✓ Complete</span>` : (active ? `<span class="jc-badge">Active</span>` : "");
      return `<div class="journey-card" data-journey-id="${j.id}" data-active="${active}" style="--theme-a:${t.a};--theme-b:${t.b}">
          <div class="jc-kind">${(JOURNEY_KIND_LABEL[j.kind]||"Journey").toUpperCase()}</div>
          <div class="jc-title">${escapeAttr(journeyTitle(j))}</div>
          <div class="jc-foot"><span>${st.done}/${st.total}</span>${badge}</div>
        </div>`;
    }).join("");
    html += `<div class="home-section" id="journeyListSection">
        <div class="home-section-head"><h3>YOUR JOURNEYS</h3><span class="home-section-sub">${journeys.length}</span></div>
        <div class="home-strip journey-card-strip">${cards}
          <div class="journey-card journey-card-new" id="journeyNewCard"><div class="jc-title">＋ New journey</div><div class="jc-kind">Pick a hero</div></div>
          <div class="journey-card journey-card-new" id="journeyNewComicsCard"><div class="jc-title">📖 Comics path</div><div class="jc-kind">Pick a continuity</div></div>
        </div>
      </div>`;

    // RECENTLY COMPLETED — titles finished inside any journey, most recent first
    const seen = new Set(), done = [];
    journeys.forEach(j=>{
      journeyItems(j).forEach(it=>{
        const ik = itemKey(it.cat, it.d.id);
        if(seen.has(ik) || !isDone(it.cat, it.d.id)) return;
        seen.add(ik);
        done.push({ ...it, at: (j.completedAt||{})[ik] || "" });
      });
    });
    done.sort((a,b)=>b.at.localeCompare(a.at));
    if(done.length){
      html += `<div class="home-section" id="journeyRecentlyCompletedSection">
          <div class="home-section-head"><h3>RECENTLY COMPLETED</h3><span class="home-section-sub">${done.length}</span></div>
          <div class="home-strip">${done.slice(0,15).map(({d,cat})=>stripCardHtml(cat,d)).join("")}</div>
        </div>`;
    }
  }

  // DISCOVER NEXT — heroes the reader hasn't started a journey for yet (real groups with real titles)
  {
    const startedGroups = new Set(journeys.map(j=>{ const h = journeyHero(j); return h ? h.group : null; }));
    const otherHeroes = realHeroGroups().filter(h=>!startedGroups.has(h.group)).slice(0,8);
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
      openSheet(d, cat);
    });
  });
  const signInLink = $("#journeySignInLink");
  if(signInLink) signInLink.addEventListener("click", (e)=>{ e.preventDefault(); openSheetEl(readerBackdrop, readerSheet); });
  const startCtaBtn = $("#journeyStartCtaBtn");
  if(startCtaBtn) startCtaBtn.addEventListener("click", openStartSheet);
  const comicsCtaBtn = $("#journeyComicsCtaBtn");
  if(comicsCtaBtn) comicsCtaBtn.addEventListener("click", ()=> openComicsPath(null));
  const newCard = $("#journeyNewCard");
  if(newCard) newCard.addEventListener("click", openStartSheet);
  const newComicsCard = $("#journeyNewComicsCard");
  if(newComicsCard) newComicsCard.addEventListener("click", ()=> openComicsPath(null));
  gridEl.querySelectorAll(".journey-card[data-journey-id]").forEach(c=>{
    c.addEventListener("click", ()=>{
      setActiveJourney(c.dataset.journeyId);
      renderJourney({skipRefresh:true});
      window.scrollTo({top:0, behavior:"smooth"});
    });
  });
  gridEl.querySelectorAll("#journeyDiscoverRail .explore-rail-tile").forEach(t=>{
    t.addEventListener("click", ()=> openHub(t.dataset.group));
  });
  wireJourneySequenceHandlers(gridEl);

  // If signed in, refresh from Firestore once in the background so cross-device changes show up here —
  // localStorage (read above) already renders instantly; this just quietly catches it up if stale.
  // skipRefresh on the follow-up render prevents this from looping.
  if(signedIn && !opts.skipRefresh){
    Promise.all([pullCloudDataToLocal(readerUser.uid), pullJourneyFromCloud(readerUser.uid)]).then(()=>{
      if(state.cat==="journey") renderJourney({skipRefresh:true});
    }).catch(()=>{});
  }
}

let lastRenderedView = "";
function render(){
  buildTabs(); buildFilters(); renderCards(); updateMobileNavActive(); renderStatsFooter(); syncHistoryForTab();
  // Pointer 4: entering the Comics landing always starts at the top (never a stale catalogue scroll position).
  const view = state.cat + (isComicsLanding() ? ":landing" : "");
  if(view==="comics:landing") window.scrollTo(0,0);
  lastRenderedView = view;
}

/* ---- Phase 14: back button + refresh ----
   Each tab gets a URL hash (#journey, #comics…), so the browser/phone back button returns to the previous
   tab and a refresh reopens the same tab (journeys themselves live in localStorage/Firestore, so a refresh
   never loses them). Opening a sheet adds one history entry, so "back" closes the sheet first instead of
   leaving the site. */
const VALID_TABS = ["home","journey","movies","series","games","comics"];
function tabFromHash(){
  const h = (location.hash||"").replace(/^#/,"");
  return VALID_TABS.includes(h) ? h : null;
}
let applyingHistory = false;
function syncHistoryForTab(){
  if(applyingHistory) return;
  const want = state.cat==="home" ? "" : "#"+state.cat;
  if((location.hash||"") !== want){
    history.pushState({cat:state.cat}, "", want || (location.pathname + location.search));
  }
}
window.addEventListener("popstate", ()=>{
  if(document.querySelector('.sheet[data-open="true"]')){ closeAllSheets(); return; }
  const cat = tabFromHash() || "home";
  if(cat !== state.cat && loaded){
    applyingHistory = true;
    state.cat = cat;
    resetFiltersForTabSwitch();
    render();
    applyingHistory = false;
  }
});

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
    const pathBtn = c.id==="comics"
      ? `<button class="cp-entry-card" id="hubComicsPathBtn" data-group="${escapeAttr(group)}"><span>📖 Start a ${group} reading path</span><span class="cp-entry-sub">Pick a continuity and read in order →</span></button>` : "";
    html += `<div class="home-section">
        <div class="home-section-head"><h3>${CAT_ICON[c.id]||""} ${c.label}</h3><span class="home-section-sub">${list.length}</span></div>
        ${pathBtn}
        <div class="home-strip">${list.map(({d,cat})=>stripCardHtml(cat,d)).join("")}</div>
      </div>`;
  });

  hubContent.innerHTML = html;
  const hubPathBtn = hubContent.querySelector("#hubComicsPathBtn");
  if(hubPathBtn) hubPathBtn.addEventListener("click", ()=> openComicsPath(hubPathBtn.dataset.group));
  wireImageFallbacks(hubContent);
  hubContent.querySelectorAll(".strip-card").forEach(c=>{
    c.addEventListener("click", (e)=>{
      if(e.target.closest(".fav-btn")) return;
      const cat = c.dataset.cat, id = c.dataset.id;
      const d = (DATA[cat]||[]).find(x=>x.id===id);
      if(!d) return;
      closeSheetEl(hubBackdrop, hubSheet);
      openSheet(d, cat);
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
      openSheet(d, cat);
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
    openSheet(d, cat);
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
    openSheet(d, cat);
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
  openSheet(d, cat);
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
    // Phase 11: a new starter path is ADDED to the reader's journeys — it never replaces or deletes an
    // existing one. Re-running the exact same choices just re-opens that journey instead of duplicating it.
    const keys = recs.map(r=>`${r.cat}::${r.d.t}::${r.d.y}`);
    const same = getAllJourneys().find(j=>j.kind==="starter" && j.selectedHero===startState.heroId &&
      j.selectedMedium===startState.medium && j.selectedIntent===startState.intent);
    if(same){
      setActiveJourney(same.id);
    } else {
      setSavedJourney({
        kind: "starter",
        title: `${hero ? hero.label : "DC"} starting path`,
        heroGroup: hero ? hero.group : null,
        selectedHero: startState.heroId,
        selectedMedium: startState.medium,
        selectedIntent: startState.intent,
        recommendedTitleKeys: keys,
        completedAt: {},
        createdAt: new Date().toISOString(),
      });
    }
    closeSheetEl(startBackdrop, startSheet);
    goToCategory("journey");
    window.scrollTo({top:0});
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

/* ============================= COMICS READING PATHS (Phases 9 + 10) =============================
   Hero → Continuity → Reading order → Reading Journey.
   Everything shown is derived from the real comics catalogue: only heroes that actually have comics, only
   continuities that actually contain that hero's comics (the `continuity` field), and only reading orders
   that can be reliably generated from real fields — publication order (`y`) and easiest-first (`readingLevel`).
   In-story chronological order and per-issue "series/run" breakdowns are NOT offered: the catalogue stores a
   run as one entry and has no in-story timeline field, and inventing either would be fabricated data. */
const comicsPathBackdrop = $("#comicsPathBackdrop"), comicsPathSheet = $("#comicsPathSheet"), comicsPathContent = $("#comicsPathContent");
let cpState = { step:"hero", group:null, continuity:null, order:null, parentId:null };
const READING_LEVEL_RANK = { "New Reader":0, "Familiar Reader":1, "Experienced Reader":2, "Hardcore":3 };
const ALL_CONTINUITIES = "__all__";
const COMICS_READING_ORDERS = [
  { id:"publication", label:"Publication order", sub:"Oldest to newest, the order they came out",
    available: ()=>true },
  { id:"beginner",    label:"Easiest first",     sub:"New-reader-friendly books first, then builds up",
    available: items=> new Set(items.map(d=>d.readingLevel).filter(Boolean)).size > 1 },
];
function comicsHeroGroups(){
  const counts = {};
  (DATA.comics||[]).forEach(d=>{ const g = d.group || "Other DC Characters"; counts[g] = (counts[g]||0)+1; });
  return sortHeroNames(counts).filter(g=>g!=="Other DC Characters").map(g=>({ group:g, count:counts[g] }));
}
function comicsFor(group, continuity){
  return (DATA.comics||[]).filter(d=>d.group===group && (continuity===ALL_CONTINUITIES || !continuity || d.continuity===continuity));
}
function continuitiesFor(group){
  const map = {};
  comicsFor(group, ALL_CONTINUITIES).forEach(d=>{
    const c = d.continuity || "Unspecified continuity";
    const y = firstYear(d.y);
    const m = map[c] = map[c] || { continuity:c, count:0, yMin:9999, yMax:0, eras:new Set(), easiest:9 };
    m.count++;
    if(y){ m.yMin = Math.min(m.yMin, y); m.yMax = Math.max(m.yMax, y); }
    if(d.era) m.eras.add(d.era);
    m.easiest = Math.min(m.easiest, READING_LEVEL_RANK[d.readingLevel] ?? 9);
  });
  return Object.values(map).sort((a,b)=>a.yMin-b.yMin);
}
// Last year of a "2011–2015" / "2024–" span (open-ended = still running) — publication-order tie-breaker so a
// single launch issue ("Batman (2011) #1") comes before the multi-year run that follows it.
function lastYearOf(y){
  const s = String(y||"");
  if(/[–-]\s*$/.test(s)) return 9999;
  const m = s.match(/\d{4}/g);
  return m ? parseInt(m[m.length-1]) : 9999;
}
function orderComics(items, order){
  const arr = [...items];
  const pub = (a,b)=>(firstYear(a.y)-firstYear(b.y)) || (lastYearOf(a.y)-lastYearOf(b.y)) || String(a.t).localeCompare(String(b.t));
  if(order==="beginner"){
    arr.sort((a,b)=>((READING_LEVEL_RANK[a.readingLevel]??9)-(READING_LEVEL_RANK[b.readingLevel]??9)) || pub(a,b));
  } else {
    arr.sort(pub);
  }
  return arr;
}
function yearSpan(a,b){ return a===9999 ? "" : (a===b ? `${a}` : `${a}–${b}`); }
function cpHeader(title, sub, showBack){
  const trail = [cpState.group, cpState.continuity && (cpState.continuity===ALL_CONTINUITIES ? "Every continuity" : cpState.continuity)]
    .filter(Boolean).map(escapeAttr).join(" › ");
  return `<div class="sheet-eyebrow">COMICS READING PATH${trail?` · ${trail.toUpperCase()}`:""}</div>
    ${showBack ? `<div class="start-back" id="cpBackBtn">‹ Back</div>` : ""}
    <h2>${title}</h2>
    ${sub ? `<p class="sheet-body" style="color:var(--ink-dim);margin-bottom:16px;">${sub}</p>` : ""}`;
}
function cpGo(step){ cpState.step = step; renderComicsPath(); comicsPathSheet.scrollTop = 0; }
function renderComicsPath(){
  const st = cpState;
  let html = "";
  if(st.step==="hero"){
    const groups = comicsHeroGroups();
    html = cpHeader("Whose comics do you want to read?", "Only heroes with comics in the compendium are shown.", false) +
      `<div class="cp-card-grid">${groups.map(g=>{
        const t = groupTheme(g.group);
        return `<div class="cp-dest-card themed" data-group="${escapeAttr(g.group)}" style="--theme-a:${t.a};--theme-b:${t.b}">
            <div class="cp-dest-title">${g.group}</div><div class="cp-dest-sub">${g.count} comic${g.count===1?"":"s"}</div></div>`;
      }).join("")}</div>`;
    comicsPathContent.innerHTML = html;
    comicsPathContent.querySelectorAll("[data-group]").forEach(c=>c.addEventListener("click", ()=>{
      st.group = c.dataset.group; st.continuity = null; st.order = null; cpGo("continuity");
    }));
    return;
  }
  if(st.step==="continuity"){
    const conts = continuitiesFor(st.group);
    if(!conts.length){
      comicsPathContent.innerHTML = cpHeader(`No ${escapeAttr(st.group)} comics yet`,
        `The compendium doesn't have any ${escapeAttr(st.group)} comics catalogued yet, so there's no reading path to build.`, false) +
        `<button class="btn btn-primary" id="cpPickHero" style="width:100%">Choose another hero</button>`;
      $("#cpPickHero").addEventListener("click", ()=>{ st.group=null; cpGo("hero"); });
      return;
    }
    if(conts.length===1){ st.continuity = conts[0].continuity; cpGo("order"); return; }
    const total = conts.reduce((n,c)=>n+c.count,0);
    html = cpHeader(`Pick a ${escapeAttr(st.group)} continuity`,
      "Each DC continuity is its own timeline. These are the ones your comics actually come from.", true) +
      `<div class="cp-card-list">${conts.map(c=>`
        <div class="cp-dest-card" data-cont="${escapeAttr(c.continuity)}">
          <div class="cp-dest-title">${c.continuity}</div>
          <div class="cp-dest-sub">${yearSpan(c.yMin,c.yMax)} · ${[...c.eras].join(", ")}</div>
          <div class="cp-dest-foot">${c.count} comic${c.count===1?"":"s"}</div>
        </div>`).join("")}
        <div class="cp-dest-card" data-cont="${ALL_CONTINUITIES}">
          <div class="cp-dest-title">Every continuity</div>
          <div class="cp-dest-sub">All ${total} ${escapeAttr(st.group)} comics across every timeline</div>
        </div>
      </div>`;
    comicsPathContent.innerHTML = html;
    $("#cpBackBtn").addEventListener("click", ()=>{ st.group=null; cpGo("hero"); });
    comicsPathContent.querySelectorAll("[data-cont]").forEach(c=>c.addEventListener("click", ()=>{
      st.continuity = c.dataset.cont; st.order = null; cpGo("order");
    }));
    return;
  }
  const items = comicsFor(st.group, st.continuity);
  const orders = COMICS_READING_ORDERS.filter(o=>o.available(items));
  if(st.step==="order"){
    if(orders.length===1){ st.order = orders[0].id; cpGo("preview"); return; }
    html = cpHeader("How do you want to read it?", "", true) +
      `<div class="cp-card-list">${orders.map(o=>`
        <div class="cp-dest-card" data-order="${o.id}"><div class="cp-dest-title">${o.label}</div><div class="cp-dest-sub">${o.sub}</div></div>`).join("")}
      </div>
      <p class="cp-note">In-story chronological order isn't offered yet — the compendium doesn't track where each story sits in its timeline, and we won't guess.</p>`;
    comicsPathContent.innerHTML = html;
    $("#cpBackBtn").addEventListener("click", ()=>{
      const conts = continuitiesFor(st.group);
      if(conts.length<=1){ st.group=null; st.continuity=null; cpGo("hero"); } else { st.continuity=null; cpGo("continuity"); }
    });
    comicsPathContent.querySelectorAll("[data-order]").forEach(c=>c.addEventListener("click", ()=>{ st.order = c.dataset.order; cpGo("preview"); }));
    return;
  }
  // preview → start the reading journey
  const ordered = orderComics(items, st.order);
  const orderLabel = (COMICS_READING_ORDERS.find(o=>o.id===st.order)||{}).label || "";
  const contLabel = st.continuity===ALL_CONTINUITIES ? "Every continuity" : st.continuity;
  html = cpHeader(`Your ${escapeAttr(st.group)} reading path`, `${escapeAttr(contLabel)} · ${orderLabel} · ${ordered.length} stop${ordered.length===1?"":"s"}`, true) +
    `<div class="cp-path-list">${ordered.map((d,i)=>`
      <div class="cp-path-row" data-id="${d.id}">
        <div class="journey-seq-num" data-done="${isDone("comics", d.id)}">${isDone("comics", d.id)?"✓":i+1}</div>
        <div class="cp-path-body">
          <div class="cp-path-title">${d.t}<span class="bc-year">${d.y||""}</span></div>
          <div class="cp-path-meta">${d.era||""}${d.readingLevel?` · <span class="qf-pill rl-${readingLevelClass(d.readingLevel)}">${d.readingLevel}</span>`:""}</div>
          ${d.ord ? `<div class="cp-path-ord">${firstSentence(d.ord)}</div>` : ""}
        </div>
      </div>`).join("")}
    </div>
    <button class="btn btn-primary" id="cpStartBtn" style="width:100%;margin-top:16px;">Start Reading Journey</button>`;
  comicsPathContent.innerHTML = html;
  $("#cpBackBtn").addEventListener("click", ()=>{
    if(orders.length>1) cpGo("order");
    else if(continuitiesFor(st.group).length>1){ st.continuity=null; cpGo("continuity"); }
    else { st.group=null; st.continuity=null; cpGo("hero"); }
  });
  comicsPathContent.querySelectorAll(".cp-path-row").forEach(r=>r.addEventListener("click", ()=>{
    const d = (DATA.comics||[]).find(x=>x.id===r.dataset.id);
    if(d){ closeSheetEl(comicsPathBackdrop, comicsPathSheet); openSheet(d, "comics"); }
  }));
  $("#cpStartBtn").addEventListener("click", ()=>{
    const keys = ordered.map(d=>titleKeyOf("comics", d));
    const same = getAllJourneys().find(j=>j.kind==="comics" && j.heroGroup===st.group && j.continuity===st.continuity && j.pathOrder===st.order);
    if(same){
      setActiveJourney(same.id);
    } else {
      const beginner = BEGINNER_CHARACTERS.find(h=>h.group===st.group);
      setSavedJourney({
        kind:"comics", title:`${st.group} comics — ${contLabel}`,
        heroGroup: st.group, selectedHero: beginner ? beginner.id : st.group,
        selectedMedium:"comics", selectedIntent:"comics",
        continuity: st.continuity, pathOrder: st.order, parentId: st.parentId || null,
        branchMode: st.parentId ? "comics" : null,
        recommendedTitleKeys: keys, completedAt:{}, createdAt: new Date().toISOString(),
      });
    }
    closeSheetEl(comicsPathBackdrop, comicsPathSheet);
    goToCategory("journey");
    window.scrollTo({top:0});
  });
}
function openComicsPath(group, parentId){
  cpState = { step: group ? "continuity" : "hero", group: group||null, continuity:null, order:null, parentId: parentId||null };
  // Close anything else that might be open so the path sheet is never stacked under another sheet.
  closeAllSheets();
  renderComicsPath();
  openSheetEl(comicsPathBackdrop, comicsPathSheet);
}
comicsPathBackdrop.addEventListener("click", ()=> closeSheetEl(comicsPathBackdrop, comicsPathSheet));
$("#comicsPathClose").addEventListener("click", ()=> closeSheetEl(comicsPathBackdrop, comicsPathSheet));

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
    const spoilerOn = spoilerProtectionOn();
    html += `<div class="sheet-section spoiler-section">
      <div class="sheet-label">FULL PLOT</div>
      ${spoilerOn ? `<div class="spoiler-gate">
        <span>⚠ Contains major plot details</span>
        <button class="spoiler-reveal-btn">Reveal spoilers</button>
      </div>` : ``}
      <div class="sheet-body spoiler-body" data-revealed="${spoilerOn ? "false" : "true"}">${d.plot}</div>
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

// `catOverride` lets any view (Home, My Journey, hubs, Start Here) open a detail sheet WITHOUT mutating
// state.cat. Previously every caller set state.cat to the title's category first, which silently desynced
// the app from what was on screen (e.g. My Journey stopped refreshing after 'Mark done' in the sheet,
// Nerd Mode re-rendered a movies grid under the Home tab, bottom-nav active state went wrong).
let sheetCat = null;
function openSheet(d, catOverride){
  const cat = catOverride || state.cat;
  sheetCat = cat;
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
    if(state.cat==="journey" || state.cat==="home") renderCards();
  });
  const doneToggleBtn = sheetContent.querySelector(".done-toggle");
  if(doneToggleBtn) doneToggleBtn.addEventListener("click", ()=>{
    const c = doneToggleBtn.dataset.doneCat, id = doneToggleBtn.dataset.doneId;
    const nowDone = toggleDone(c, id);
    const verb = PROGRESS_VERB[c] || "Done";
    doneToggleBtn.dataset.active = nowDone ? "true" : "false";
    doneToggleBtn.textContent = nowDone ? `✓ ${verb}` : `Mark as ${verb}`;
    // Marking done from the detail sheet must advance any journey containing this title (Phase 8) and
    // refresh whichever personalised view is underneath (My Journey / Home "Continue" rail).
    recordJourneyCompletion(c, id, nowDone);
    if(state.cat==="journey" || state.cat==="home") renderCards();
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
        openSheet(rd, rcat);
      }
    });
  });
  openSheetEl(backdrop, sheet);
}
function openSheetEl(bd, sh){
  bd.dataset.open="true"; sh.dataset.open="true";
  if(!(history.state && history.state.sheet)) history.pushState({cat:state.cat, sheet:true}, "", location.href);
}
function closeSheetEl(bd, sh){ bd.dataset.open="false"; sh.dataset.open="false"; }
// Phase 14: one call that guarantees no sheet/backdrop is left open (used by bottom nav, back button and
// before opening a new flow) — a stale open backdrop was what could leave the page untappable.
function closeAllSheets(){
  if(typeof stopAllTrailers==="function") stopAllTrailers();
  document.querySelectorAll('.sheet[data-open="true"], .sheet-backdrop[data-open="true"]').forEach(el=>{ el.dataset.open = "false"; });
}
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

/* ============================= ADMIN: LOGIN =============================
   Account/Admin cleanup: the header no longer has a separate Admin button. Admin sign-in is reached only
   via the small "Admin Access" link inside the logged-out Account flow (readerAdminAccessLink below), or
   automatically skipped straight to Admin Tools if the signed-in user is already the admin. This loginSheet
   is now a plain sign-in form — the admin-only tools it used to hold live in their own Admin Tools sheet. */
const loginBackdrop = $("#loginBackdrop"), loginSheet = $("#loginSheet");
const loginArea = $("#loginArea");
const loginEmail = $("#loginEmail"), loginPassword = $("#loginPassword"), loginMsg = $("#loginMsg");
const fab = $("#fabAdd");

/* ---- Phase 18: read-only data-health panel for the admin ----
   Shows the gaps that limit New to DC / journeys / comics reading paths, so the admin knows what to add
   next via the existing Replace/Import tools — without growing the admin UI into a full editor. */
function renderAdminDataHealth(){
  const el = $("#adminDataHealth");
  if(!el || !loaded) return;
  const recs = DATA.beginnerRecommendations || [];
  const unresolved = recs.filter(r=>!resolveTitleKey(r.titleKey)).length;
  const rows = BEGINNER_CHARACTERS.map(h=>{
    const curated = recs.filter(r=>(r.characterIds||[]).includes(h.id)).length;
    const comics = comicsCountForGroup(h.group);
    const conts = comics ? continuitiesFor(h.group).length : 0;
    const warn = (!comics || curated<3) ? " ⚠" : "";
    return `<li><b>${h.label}</b>: ${curated} curated starter pick${curated===1?"":"s"} · ${comics} comic${comics===1?"":"s"} across ${conts} continuit${conts===1?"y":"ies"}${warn}</li>`;
  }).join("");
  const noCont = (DATA.comics||[]).filter(d=>!d.continuity).length;
  el.innerHTML = `<ul style="margin:6px 0 8px 16px;padding:0;line-height:1.6;">${rows}</ul>
    <div>${recs.length} beginner-guide records · ${unresolved} pointing at titles that no longer exist${unresolved?" ⚠":""}</div>
    <div>${noCont} comic${noCont===1?"":"s"} missing a continuity (excluded from reading paths)${noCont?" ⚠":""}</div>
    <div style="margin-top:6px;color:var(--ink-faint);">⚠ = a hero with no comics gets no "Explore comics" option; fewer than 3 curated picks means New to DC relies more on automatic ranking.</div>`;
}

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
    const cred = await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value);
    const ok = await checkIsAdmin(cred.user.uid);
    if(!ok){
      await signOut(auth);
      loginMsg.textContent = "That account isn't authorized for admin access.";
      loginMsg.className = "form-msg err";
      return;
    }
    loginEmail.value = ""; loginPassword.value = "";
    closeSheetEl(loginBackdrop, loginSheet);
    renderAdminDataHealth();
    openSheetEl(adminToolsBackdrop, adminToolsSheet);
  }catch(err){
    loginMsg.textContent = "Sign-in failed — check the email and password.";
    loginMsg.className = "form-msg err";
  }
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
  const ptl = $("#profileToggleLabel");
  if(ptl) ptl.textContent = signedIn ? "Account" : "Sign In";
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

$("#readerForgotLink").addEventListener("click", async (e)=>{
  e.preventDefault();
  readerMsg.className = "form-msg";
  const email = readerEmail.value.trim();
  if(!email){ readerMsg.textContent = "Type your email above first, then tap Forgot password."; readerMsg.className = "form-msg err"; return; }
  try{
    await sendPasswordResetEmail(auth, email);
    readerMsg.textContent = `If an account exists for ${email}, a reset link is on its way.`;
    readerMsg.className = "form-msg ok";
  }catch(err){
    readerMsg.textContent = "Couldn't send a reset email: " + err.message;
    readerMsg.className = "form-msg err";
  }
});
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

/* ---- Account/Admin cleanup: one Account button, role-specific rows inside it ----
   Logged out: the reader auth form, plus a small "Admin Access" link that leads to the admin sign-in
   form (loginSheet) — never a header button. Signed in as the admin: the same Account sheet additionally
   shows "Admin Tools", which opens its own sheet holding the existing Replace/Import actions untouched. */
const adminToolsBackdrop = $("#adminToolsBackdrop"), adminToolsSheet = $("#adminToolsSheet");
adminToolsBackdrop.addEventListener("click", ()=> closeSheetEl(adminToolsBackdrop, adminToolsSheet));
$("#adminToolsClose").addEventListener("click", ()=> closeSheetEl(adminToolsBackdrop, adminToolsSheet));

/* Comics-v2 (beta): one-tap import button for the New 52 Batman dataset built in comics-v2/seed-batman-new52.js.
   Fully independent of the rest of Admin Tools — talks only to window.__comicsV2 (comics-v2/index.js). */
$("#importBatmanNew52Btn")?.addEventListener("click", async ()=>{
  const btn = $("#importBatmanNew52Btn"), msg = $("#importBatmanNew52Msg");
  if(!window.__comicsV2 || !window.__comicsV2.batmanNew52){
    msg.textContent = "Comics v2 module not loaded — check that comics-v2/index.js is uploaded.";
    msg.className = "form-msg err";
    return;
  }
  btn.disabled = true;
  msg.textContent = "Importing…";
  msg.className = "form-msg";
  try{
    const result = await window.__comicsV2.batmanNew52.import();
    if(result?.validation && !result.validation.valid){
      msg.textContent = "Dataset failed validation — nothing was written: " + JSON.stringify(result.validation.errors || result.validation);
      msg.className = "form-msg err";
      return;
    }
    const total = Object.values(result?.written || {}).reduce((a,b)=>a+b, 0);
    if(result?.errors?.length){
      msg.textContent = `Wrote ${total} records, but ${result.errors.length} failed: ${result.errors.slice(0,3).join(" | ")}`;
      msg.className = "form-msg err";
    }else{
      msg.textContent = `Done — imported ${total} records across ${Object.keys(result?.written||{}).length} collections.`;
      msg.className = "form-msg ok";
    }
  }catch(err){
    console.error(err);
    msg.textContent = "Import failed: " + (err?.message || err);
    msg.className = "form-msg err";
  }finally{
    btn.disabled = false;
  }
});

$("#readerGoAdminTools").addEventListener("click", ()=>{
  closeSheetEl(readerBackdrop, readerSheet);
  renderAdminDataHealth();
  openSheetEl(adminToolsBackdrop, adminToolsSheet);
});
$("#readerAdminAccessLink").addEventListener("click", (e)=>{
  e.preventDefault();
  closeSheetEl(readerBackdrop, readerSheet);
  if(isAdmin){
    renderAdminDataHealth();
    openSheetEl(adminToolsBackdrop, adminToolsSheet);
  }else{
    loginMsg.textContent = ""; loginMsg.className = "form-msg";
    openSheetEl(loginBackdrop, loginSheet);
  }
});

/* ---- Settings (Account → Settings) ---- */
const settingsBackdrop = $("#settingsBackdrop"), settingsSheet = $("#settingsSheet");
settingsBackdrop.addEventListener("click", ()=> closeSheetEl(settingsBackdrop, settingsSheet));
$("#settingsClose").addEventListener("click", ()=> closeSheetEl(settingsBackdrop, settingsSheet));

const LS_SPOILER_KEY = "dc_spoiler_protection";   // "on" | "off" — default on
const LS_DEFAULT_CONTENT_KEY = "dc_default_content"; // "all"|"movies"|"series"|"comics"|"games" — default "all"
const LS_CONTINUE_TAB_KEY = "dc_continue_last_tab"; // "on" | "off" — default on
function spoilerProtectionOn(){ return localStorage.getItem(LS_SPOILER_KEY) !== "off"; }
function defaultContentSetting(){ return localStorage.getItem(LS_DEFAULT_CONTENT_KEY) || "all"; }
function continueWhereLeftOffOn(){ return localStorage.getItem(LS_CONTINUE_TAB_KEY) !== "off"; }

function renderSettingsSheet(){
  $("#settingsDisplayName").value = readerUser ? (readerUser.displayName || "") : "";
  $("#settingsEmailValue").textContent = readerUser ? (readerUser.email || "") : "";
  const spoilerBtn = $("#settingSpoilerToggle");
  const spoilerOn = spoilerProtectionOn();
  spoilerBtn.dataset.on = spoilerOn ? "true" : "false";
  spoilerBtn.textContent = spoilerOn ? "On" : "Off";
  $("#settingDefaultContent").value = defaultContentSetting();
  const continueBtn = $("#settingContinueToggle");
  const continueOn = continueWhereLeftOffOn();
  continueBtn.dataset.on = continueOn ? "true" : "false";
  continueBtn.textContent = continueOn ? "On" : "Off";
  ["settingsNameMsg","settingsJourneyMsg","settingsDataMsg","settingsAccountMsg"].forEach(id=>{
    const el = $("#"+id); if(el){ el.textContent=""; el.className="form-msg"; }
  });
}
$("#readerGoSettings").addEventListener("click", ()=>{
  closeSheetEl(readerBackdrop, readerSheet);
  renderSettingsSheet();
  openSheetEl(settingsBackdrop, settingsSheet);
});
$("#settingSpoilerToggle").addEventListener("click", ()=>{
  const on = !spoilerProtectionOn();
  localStorage.setItem(LS_SPOILER_KEY, on ? "on" : "off");
  renderSettingsSheet();
});
$("#settingContinueToggle").addEventListener("click", ()=>{
  const on = !continueWhereLeftOffOn();
  localStorage.setItem(LS_CONTINUE_TAB_KEY, on ? "on" : "off");
  renderSettingsSheet();
});
$("#settingDefaultContent").addEventListener("change", (e)=>{
  localStorage.setItem(LS_DEFAULT_CONTENT_KEY, e.target.value);
});

$("#settingsSaveNameBtn").addEventListener("click", async ()=>{
  const msg = $("#settingsNameMsg");
  if(!readerUser){ msg.textContent = "Sign in first."; msg.className = "form-msg err"; return; }
  const name = $("#settingsDisplayName").value.trim();
  msg.textContent = "Saving…"; msg.className = "form-msg";
  try{
    await updateProfile(readerUser, { displayName: name });
    await upsertReaderProfile(readerUser);
    updateReaderProfileUI();
    msg.textContent = "Saved."; msg.className = "form-msg ok";
  }catch(err){
    msg.textContent = "Couldn't save: " + err.message; msg.className = "form-msg err";
  }
});

$("#settingsResetJourneyBtn").addEventListener("click", ()=>{
  const msg = $("#settingsJourneyMsg");
  const store = getJourneyStore();
  const active = getJourneyById(store.activeId);
  if(!active){ msg.textContent = "No active journey to reset."; msg.className = "form-msg"; return; }
  if(!confirm(`This removes your current journey ("${journeyTitle(active)}") so you can start it over. Your watched/read progress and favorites are not affected. Continue?`)) return;
  store.journeys = store.journeys.filter(j=>j.id!==active.id);
  store.activeId = store.journeys.length ? store.journeys[store.journeys.length-1].id : null;
  saveJourneyStore(store);
  msg.textContent = "Current journey reset."; msg.className = "form-msg ok";
  if(state.cat==="journey") renderJourney();
  if(state.cat==="home") renderCards();
});
$("#settingsResetProgressBtn").addEventListener("click", async ()=>{
  const msg = $("#settingsJourneyMsg");
  if(!confirm("This marks every title in every journey as not done again. Favorites are not affected. Continue?")) return;
  lsSetJson(LS_PROGRESS_KEY, {});
  const store = getJourneyStore();
  store.journeys.forEach(j=>{ j.completedAt = {}; j.updatedAt = new Date().toISOString(); });
  saveJourneyStore(store);
  if(readerUser){
    try{
      const progSnap = await getDocs(collection(db, "users", readerUser.uid, "progress"));
      await Promise.all(progSnap.docs.map(d=>deleteDoc(doc(db, "users", readerUser.uid, "progress", d.id))));
    }catch(e){ console.warn("[Settings] cloud progress reset failed:", e.message); }
  }
  msg.textContent = "All journey progress reset."; msg.className = "form-msg ok";
  if(state.cat==="journey") renderJourney();
  renderCards();
});

$("#settingsExportBtn").addEventListener("click", ()=>{
  const payload = {
    exportedAt: new Date().toISOString(),
    account: readerUser ? { displayName: readerUser.displayName, email: readerUser.email } : null,
    favorites: getFavorites(),
    progress: getProgress(),
    journeys: getJourneyStore(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "allaboutdc-my-data.json";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});
$("#settingsClearLocalBtn").addEventListener("click", ()=>{
  const msg = $("#settingsDataMsg");
  if(!confirm("This clears your favorites, progress and journeys saved on this device. If you're not signed in, this can't be undone. Continue?")) return;
  lsSetJson(LS_FAV_KEY, []);
  lsSetJson(LS_PROGRESS_KEY, {});
  localStorage.removeItem(LS_JOURNEYS_KEY);
  localStorage.removeItem("dc_journey");
  msg.textContent = "Local data cleared."; msg.className = "form-msg ok";
  renderCards();
  if(state.cat==="journey") renderJourney();
});

$("#settingsSignOutBtn").addEventListener("click", async ()=>{
  await signOut(auth);
  closeSheetEl(settingsBackdrop, settingsSheet);
});
$("#settingsDeleteAccountBtn").addEventListener("click", async ()=>{
  const msg = $("#settingsAccountMsg");
  if(!readerUser){ msg.textContent = "Sign in first."; msg.className = "form-msg err"; return; }
  const ok = confirm("Delete your account permanently?\n\nThis deletes your profile, favorites, progress and journeys stored in the cloud, and signs you out. Data saved only on this device (if any) is not affected by this action — use Clear Local Data for that. This cannot be undone.");
  if(!ok) return;
  msg.textContent = "Deleting…"; msg.className = "form-msg";
  try{
    const uid = readerUser.uid;
    for(const sub of ["favorites","progress","preferences","meta"]){
      const snap = await getDocs(collection(db, "users", uid, sub));
      await Promise.all(snap.docs.map(d=>deleteDoc(doc(db, "users", uid, sub, d.id))));
    }
    await deleteDoc(doc(db, "users", uid)).catch(()=>{});
    await deleteUser(auth.currentUser);
    closeSheetEl(settingsBackdrop, settingsSheet);
  }catch(err){
    if(err.code === "auth/requires-recent-login"){
      msg.textContent = "For security, please sign out and sign back in, then try Delete Account again right away.";
    }else{
      msg.textContent = "Couldn't delete account: " + err.message;
    }
    msg.className = "form-msg err";
  }
});

onAuthStateChanged(auth, async (user)=>{
  const wasSignedIn = !!readerUser;
  readerUser = user || null;

  // Admin is a separate, server-checked role — never inferred from "a user is signed in".
  isAdmin = user ? await checkIsAdmin(user.uid) : false;
  document.body.dataset.admin = isAdmin ? "true" : "false";
  fab.dataset.visible = isAdmin ? "true" : "false";
  const adminToolsRow = $("#readerGoAdminTools");
  if(adminToolsRow) adminToolsRow.style.display = isAdmin ? "block" : "none";

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
  const section = state.cat==="home" ? "home" : (state.cat==="journey" ? "more" : "explore");
  mobileNav.querySelectorAll(".mobile-nav-btn").forEach(btn=>{
    btn.dataset.active = btn.dataset.mnav===section ? "true" : "false";
  });
}

mobileNav.querySelectorAll(".mobile-nav-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const which = btn.dataset.mnav;
    // Phase 14: the bottom nav always works — whatever sheet/flow is open is closed first, so a stale
    // backdrop can never swallow the tap or leave the page untappable.
    closeAllSheets();
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
$("#moreQuickComicsPath").addEventListener("click", ()=>{
  closeSheetEl(moreBackdrop, moreSheet);
  openComicsPath(null);
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
$("#moreQuickAccount").addEventListener("click", ()=>{
  closeSheetEl(moreBackdrop, moreSheet);
  profileToggle.click();
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
