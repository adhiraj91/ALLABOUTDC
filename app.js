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
  movies:"Every live-action and animated DC film, tagged by continuity — so you know whether Batman v Superman connects to The Batman (it doesn't).",
  series:"Live-action and animated DC television, tagged by shared continuity — the Arrowverse, the DCAU, and everything standalone.",
  games:"Organized by franchise (Arkham, Injustice, LEGO, and so on) rather than platform or year, since that's how most of these actually relate to each other.",
  comics:"Filter by era, canon status, and character line to figure out what's essential, what's a fun detour, and what order to read an arc in."
};

// Field schema per category — drives both the add-entry form and card/detail rendering.
const SCHEMA = {
  movies: [
    {key:"t", label:"Title", type:"text", required:true},
    {key:"y", label:"Year", type:"text", required:true, placeholder:"e.g. 2013 or 2012–13"},
    {key:"type", label:"Type", type:"select", options:["Live Action","Animated"], required:true},
    {key:"cont", label:"Continuity", type:"text", required:true, placeholder:"e.g. DCEU, DCAU, Elseworlds"},
    {key:"blurb", label:"Summary", type:"textarea", required:true},
  ],
  series: [
    {key:"t", label:"Title", type:"text", required:true},
    {key:"y", label:"Years", type:"text", required:true, placeholder:"e.g. 2019–2023"},
    {key:"type", label:"Type", type:"select", options:["Live Action","Animated"], required:true},
    {key:"cont", label:"Continuity", type:"text", required:true, placeholder:"e.g. Arrowverse, DCAU"},
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
let state = { cat:"comics", search:"", f1:"all", f2:"all", chip:"all" };
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

/* ============================= RENDER: TABS / FILTERS ============================= */
function buildTabs(){
  tabsEl.innerHTML = CATS.map(c=>{
    const n = DATA[c.id].length;
    return `<button class="tab-btn" data-cat="${c.id}" data-active="${state.cat===c.id}">${c.label}<span class="n">${n}</span></button>`;
  }).join("");
  tabsEl.querySelectorAll(".tab-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      state.cat = btn.dataset.cat;
      state.f1="all"; state.f2="all"; state.chip="all"; state.search="";
      searchInput.value="";
      render();
    });
  });
}
function uniq(arr){ return [...new Set(arr)].filter(Boolean); }

function buildFilters(){
  const cat = state.cat;
  introEl.textContent = INTRO[cat];
  filterRow.innerHTML = "";
  chipRow.innerHTML = "";
  const data = DATA[cat];

  if(cat==="movies" || cat==="series"){
    const conts = uniq(data.map(d=>d.cont));
    filterRow.innerHTML = `
      <select id="selType">
        <option value="all">All types</option>
        <option value="Live Action">Live Action</option>
        <option value="Animated">Animated</option>
      </select>
      <select id="selCont"><option value="all">All continuities</option>${conts.map(c=>`<option value="${c}">${c}</option>`).join("")}</select>`;
    $("#selType").addEventListener("change", e=>{ state.f1=e.target.value; renderCards(); });
    $("#selCont").addEventListener("change", e=>{ state.f2=e.target.value; renderCards(); });
    $("#selType").value = state.f1; $("#selCont").value = state.f2;
  }

  if(cat==="games"){
    const frs = uniq(data.map(d=>d.fr));
    chipRow.innerHTML = `<div class="chip games" data-val="all" data-active="${state.f1==='all'}">All</div>` +
      frs.map(f=>`<div class="chip games" data-val="${f}" data-active="${state.f1===f}">${f}</div>`).join("");
    chipRow.querySelectorAll(".chip").forEach(ch=>{
      ch.addEventListener("click", ()=>{ state.f1 = ch.dataset.val; renderCards(); });
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
      ch.addEventListener("click", ()=>{ state.chip = ch.dataset.val; renderCards(); });
    });
  }
}

/* ============================= RENDER: CARDS ============================= */
function filteredData(){
  const cat = state.cat;
  const data = DATA[cat];
  const q = state.search.trim().toLowerCase();
  return data.filter(d=>{
    if(q && !(d.t||"").toLowerCase().includes(q) && !(d.blurb||"").toLowerCase().includes(q)) return false;
    if(cat==="movies" || cat==="series"){
      if(state.f1!=="all" && d.type!==state.f1) return false;
      if(state.f2!=="all" && d.cont!==state.f2) return false;
    }
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
function metaTags(cat, d){
  if(cat==="movies"||cat==="series") return `<span class="tag">${d.type||""}</span><span class="tag">${d.cont||""}</span>`;
  if(cat==="games") return `<span class="tag">${d.fr||""}</span><span class="tag">${d.plat||""}</span>`;
  if(cat==="comics") return `<span class="tag">${d.era||""}</span><span class="tag ${canonTagClass(d.canon)}">${d.canon||""}</span><span class="tag">${d.line||""}</span>`;
  return "";
}
function renderCards(){
  if(!loaded) return;
  const items = filteredData();
  countEl.textContent = `${items.length} title${items.length===1?"":"s"}`;
  if(items.length===0){
    gridEl.innerHTML = `<div class="empty">Nothing matches those filters yet.<br>Try clearing a filter or the search.</div>`;
    return;
  }
  gridEl.innerHTML = items.map(d=>`
    <div class="card ${state.cat}" data-id="${d.id}">
      <div class="card-top"><div class="card-title">${d.t}</div><div class="card-year">${d.y||""}</div></div>
      <div class="card-meta">${metaTags(state.cat, d)}</div>
      <div class="card-blurb">${d.blurb||""}</div>
      ${isAdmin ? `<div class="card-admin-row"><button class="mini-btn danger" data-del="${d.id}">Delete</button></div>` : ""}
    </div>`).join("");
  gridEl.querySelectorAll(".card").forEach(c=>{
    c.addEventListener("click", (e)=>{
      if(e.target.closest("[data-del]")) return;
      const d = DATA[state.cat].find(x=>x.id===c.dataset.id);
      if(d) openSheet(d);
    });
  });
  gridEl.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", async (e)=>{
      e.stopPropagation();
      if(!confirm("Delete this entry for everyone?")) return;
      await deleteDoc(doc(db, state.cat, btn.dataset.del));
      DATA[state.cat] = DATA[state.cat].filter(x=>x.id!==btn.dataset.del);
      buildTabs(); renderCards();
    });
  });
}
function render(){ buildTabs(); buildFilters(); renderCards(); }

/* ============================= DETAIL SHEET ============================= */
const backdrop = $("#backdrop"), sheet = $("#sheet"), sheetContent = $("#sheetContent");
function openSheet(d){
  let html = `<div class="sheet-eyebrow">${state.cat.toUpperCase()} · ${d.y||""}</div><h2>${d.t}</h2>`;
  html += `<div class="sheet-tags">${metaTags(state.cat, d)}</div>`;
  html += `<div class="sheet-section"><div class="sheet-label">ABOUT</div><div class="sheet-body">${d.blurb||""}</div></div>`;
  if(state.cat==="comics"){
    html += `<div class="sheet-section"><div class="sheet-label">WHERE IT FITS / READING ORDER</div><div class="sheet-body">${d.ord||""}</div></div>`;
    html += `<div class="sheet-section"><div class="sheet-label">COLLECTED FORMATS</div><div class="sheet-body">${d.fmt||""}</div></div>`;
  }
  sheetContent.innerHTML = html;
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

const importBtn = $("#importBtn");
const importMsg = $("#importMsg");
importBtn.addEventListener("click", async ()=>{
  const alreadyHas = CATS.some(c => DATA[c.id].length > 0);
  if(alreadyHas && !confirm("Some collections already have entries. Importing again may create duplicates. Continue anyway?")) return;
  importBtn.disabled = true;
  importMsg.className = "form-msg";
  try{
    importMsg.textContent = "Fetching seed-data.json…";
    const res = await fetch("./seed-data.json");
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
    const val = el.value.trim();
    if(f.required && !val){
      addMsg.textContent = `${f.label} is required.`;
      addMsg.className = "form-msg err";
      el.focus();
      return;
    }
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
