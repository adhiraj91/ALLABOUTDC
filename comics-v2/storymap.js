/*
 * ALLABOUTDC Story Map — era-first / New 52 world map
 *
 * This replaces the old Firestore-shaped Character -> Continuity -> Series map.
 * The map is intentionally editorial rather than database-first:
 *
 *   DC UNIVERSE
 *      ↓ newest era at top
 *   ERA
 *      ↓ transition event
 *   ERA
 *
 * Opening THE NEW 52 reveals:
 *   MAIN CONTINUITY
 *      parallel franchise lanes
 *   ALTERNATE / PARALLEL
 *   CROSSOVER SPINE
 *   FUTURE / CONTINUATION
 *
 * The same series is never duplicated merely because another character appears
 * in it. Batman-family books stay under Batman/Gotham unless they are genuinely
 * separate continuities. Batman Eternal is explicitly main New 52 continuity.
 */
import {
  eras, new52Era, transitionEvents, crossoverSpine,
  getSeriesForLane, getSeries, auditNew52,
} from './new52-map-data.js';

const esc = s => s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const issueLabel = (s,i) => s.title + (i ? ` #${i}` : '');

let root = null, viewport = null, world = null, nodesEl = null, edgesEl = null, detail = null, controls = null;
let state = null;
let touchPoints = new Map();

function makeNode(type, data, parent=null, extra={}) {
  const id = `${type}:${data.id}`;
  const n = { id, type, data, parent, expanded:false, children:null, ...extra };
  state.nodes.set(id,n); return n;
}
function session() {
  state = { nodes:new Map(), root:null, selected:null, view:{k:1,tx:0,ty:0}, drag:null, mode:'tree' };
}

function shell() {
  if (root) return;
  root = document.createElement('div');
  root.className='sm-root'; root.id='storyMap'; root.dataset.open='false';
  root.setAttribute('role','dialog'); root.setAttribute('aria-modal','true');
  root.innerHTML=`
    <div class="sm-topbar">
      <button class="sm-icon-btn" id="smBack" aria-label="Back">←</button>
      <div class="sm-heading"><div class="sm-kicker">STORY MAP</div><nav class="sm-crumbs" id="smCrumbs"></nav></div>
      <button class="sm-icon-btn" id="smClose" aria-label="Close story map">✕</button>
    </div>
    <div class="sm-viewport" id="smViewport" tabindex="0">
      <div class="sm-world" id="smWorld"><svg class="sm-edges" id="smEdges"><g id="smEdgeTree"></g></svg><div class="sm-nodes" id="smNodes"></div></div>
    </div>
    <div class="sm-controls" id="smControls">
      <button class="sm-ctl" data-c="out">−</button><button class="sm-ctl" data-c="in">+</button>
      <button class="sm-ctl sm-ctl-text" data-c="fit">Fit</button><button class="sm-ctl sm-ctl-text" data-c="reset">Reset</button>
      <button class="sm-ctl sm-ctl-text" data-c="collapse">Collapse</button><button class="sm-ctl sm-ctl-text" data-c="focus">Focus</button><button class="sm-ctl sm-ctl-text" data-c="key">Key</button>
    </div>
    <div class="sm-legend" id="smLegend" hidden>
      <div class="sm-legend-row"><span><b>Era</b> — publishing/continuity period</span></div>
      <div class="sm-legend-row"><span><b>Transition</b> — the event/comic that bridges eras</span></div>
      <div class="sm-legend-row"><span><b>Lane</b> — parallel reading track inside an era</span></div>
      <div class="sm-legend-row"><span><b>Series</b> — a publication line; runs stay separate</span></div>
      <div class="sm-legend-row"><span><b>Run / Story / Issues</b> — progressively deeper detail</span></div>
      <p class="sm-legend-note">Crossovers are bridges between lanes, not a replacement for the individual series.</p>
    </div>
    <aside class="sm-detail" id="smDetail" data-open="false"><div class="sm-detail-handle"></div><button class="sm-icon-btn sm-detail-close" id="smDetailClose">✕</button><div class="sm-detail-body" id="smDetailBody"></div></aside>`;
  document.body.appendChild(root);
  viewport=root.querySelector('#smViewport'); world=root.querySelector('#smWorld'); nodesEl=root.querySelector('#smNodes'); edgesEl=root.querySelector('#smEdgeTree');
  detail=root.querySelector('#smDetail'); controls=root.querySelector('#smControls');

  root.querySelector('#smClose').onclick=close;
  root.querySelector('#smBack').onclick=back;
  root.querySelector('#smDetailClose').onclick=()=>select(null);
  controls.onclick=e=>{
    const b=e.target.closest('[data-c]'); if(!b)return;
    if(b.dataset.c==='in') zoomAt(1.25, viewport.clientWidth/2, viewport.clientHeight/2);
    if(b.dataset.c==='out') zoomAt(.8, viewport.clientWidth/2, viewport.clientHeight/2);
    if(b.dataset.c==='fit') fit();
    if(b.dataset.c==='reset') reset();
    if(b.dataset.c==='collapse') collapseAll();
    if(b.dataset.c==='focus') focusSelected();
    if(b.dataset.c==='key') root.querySelector('#smLegend').hidden=!root.querySelector('#smLegend').hidden;
  };
  viewport.addEventListener('pointerdown',e=>{
    touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(touchPoints.size===1){
      state.drag={x:e.clientX,y:e.clientY,tx:state.view.tx,ty:state.view.ty};
      viewport.setPointerCapture?.(e.pointerId); viewport.classList.add('sm-dragging');
    } else if(touchPoints.size===2){
      state.drag=null;
      const pts=[...touchPoints.values()]; state.pinch={distance:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),scale:state.view.k};
    }
  });
  viewport.addEventListener('pointermove',e=>{
    if(!touchPoints.has(e.pointerId))return; touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(touchPoints.size>=2 && state.pinch){
      const pts=[...touchPoints.values()]; const d=Math.max(20,Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y));
      const mid={x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};
      const f=Math.max(.65,Math.min(1.45,d/state.pinch.distance)); zoomAtFromBase(f,state.pinch.scale,mid.x,mid.y);
    } else if(state.drag){
      state.view.tx=state.drag.tx+e.clientX-state.drag.x; state.view.ty=state.drag.ty+e.clientY-state.drag.y; applyView(false);
    }
  });
  const endPointer=e=>{touchPoints.delete(e.pointerId); if(touchPoints.size<2)state.pinch=null; if(touchPoints.size===0){state.drag=null;viewport.classList.remove('sm-dragging');}};
  viewport.addEventListener('pointerup',endPointer); viewport.addEventListener('pointercancel',endPointer); viewport.addEventListener('pointerleave',()=>{if(touchPoints.size===0){state.drag=null;viewport.classList.remove('sm-dragging')}});
  viewport.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.deltaY<0?1.12:.89,e.clientX-viewport.getBoundingClientRect().left,e.clientY-viewport.getBoundingClientRect().top)}, {passive:false});
  viewport.addEventListener('dblclick',e=>{ if(e.target.closest('.sm-node,.sm-chip,.sm-controls'))return; const r=viewport.getBoundingClientRect(); zoomAt(1.35,e.clientX-r.left,e.clientY-r.top); });
  window.addEventListener('resize',()=>{if(root.dataset.open==='true'){render();fit()}});
}

function open() {
  shell(); session(); root.dataset.open='true'; document.documentElement.classList.add('sm-lock');
  const dc={id:'dc-universe',title:'DC Universe',years:'All eras'};
  const n=makeNode('universe',dc); state.root=n.id; buildEraChildren(n); n.expanded=true; render(); window.requestAnimationFrame(()=>focusNode(n.id)); fit();
  root.querySelector('#smCrumbs').innerHTML='<button class="sm-crumb sm-crumb-current">DC Universe</button>';
}
function buildEraChildren(n) {
  n.children=[];
  eras.forEach((era,i)=>{
    const en=makeNode('continuity',era,n.id,{expanded:false}); n.children.push(en.id);
    const next=eras[i+1];
    if(next){
      const tr=transitionEvents.find(x=>x.from===next.id && x.to===era.id);
      if(tr){ const tn=makeNode('event',tr,n.id,{expanded:false}); n.children.push(tn.id); }
    }
  });
}

function buildNew52(n) {
  const main=makeNode('character',{id:'main-continuity',title:'Main Continuity · Earth-0 / Prime Earth',sub:'Parallel franchise lanes inside the shared New 52 world'},n.id);
  const alt=makeNode('character',{id:'alternate-continuity',title:'Alternate / Parallel Continuities',sub:'Earth-2, Multiversity and other separate worlds',alt:true},n.id);
  const events=makeNode('event',{id:'crossover-spine',title:'Crossover Spine',kicker:'Events / Bridges',sub:'Major events connecting otherwise parallel lanes'},n.id);
  const future=makeNode('character',{id:'future-continuation',title:'Future / DC You Continuation',sub:'Futures End, Convergence and the post-branding continuation'},n.id);
  n.children=[main.id,alt.id,events.id,future.id];
  return {main,alt,events,future};
}
function buildLane(n) {
  const laneId=n.data.id==='main-continuity' ? null : n.data.id;
  if(laneId==='alternate-continuity'){
    const specs=[...getSeriesForLane('alternate'),{id:'multiversity',title:'The Multiversity',lane:'alternate',notes:'Parallel-Earth anthology/guidebook'}];
    n.children=specs.map(s=>makeNode('series',s,n.id).id); return;
  }
  if(laneId==='future-continuation'){
    const specs=[...getSeriesForLane('future'),...new52Era.limited.filter(x=>['futures-end','earth2-worlds-end','convergence','batman-robin-eternal','batman-beyond-v5','prez-v2','justice-league-3001'].includes(x.id))];
    n.children=specs.map(s=>makeNode('series',s,n.id).id); return;
  }
  if(laneId===null){
    const lanes=new52Era.mainLanes;
    n.children=lanes.map(l=>makeNode('character',l,n.id).id); return;
  }
  if(n.data.id==='crossover-spine'){
    n.children=crossoverSpine.map(x=>makeNode('event',x,n.id).id); return;
  }
}
function buildSeriesLane(n){
  const data=new52Era.series.filter(s=>s.lane===n.data.id);
  const limited=new52Era.limited.filter(x=>x.lane===n.data.id);
  const children=[];
  data.forEach(s=>children.push(makeNode('series',s,n.id).id));
  limited.forEach(s=>children.push(makeNode('series',s,n.id,{limited:true}).id));
  n.children=children;
}
function buildSeries(n){
  const s=n.data;
  const runs=(s.runs&&s.runs.length?s.runs:[]);
  if(!runs.length){
    runs.push({id:`${s.id}-core-run`,title:'New 52 publication run',from:s.issueSpec?.from ?? 1,to:s.issueSpec?.to ?? (s.issues?.length||1),notes:s.notes||''});
  }
  const children=[];
  runs.forEach((r,i)=>children.push(makeNode('run',{...r,id:r.id||`${s.id}-run-${i}`},n.id).id));
  children.push(makeNode('story',{id:`${s.id}-issues`,title:'Issues',kind:'issues',series:s},n.id).id);
  children.push(makeNode('story',{id:`${s.id}-publications`,title:'Collected Editions',kind:'collections',collections:s.collections||[]},n.id).id);
  n.children=children;
}
function buildRun(n){
  // Runs are narrative/creator groupings. Individual issues are deliberately NOT map branches.
  // Issues live in the series detail panel so the map remains a universe/reading map rather than a database dump.
  n.children=[];
}
function findSeriesAncestor(n){let p=n.parent?state.nodes.get(n.parent):null;while(p){if(p.type==='series')return p.data;p=p.parent?state.nodes.get(p.parent):null}return null}
function expand(n){
  if(n.expanded)return;
  if(n.type==='continuity' && n.data.id==='new52'){
    buildNew52(n);
  } else if(n.type==='character' && ['main-continuity','alternate-continuity','crossover-spine','future-continuation'].includes(n.data.id)){
    buildLane(n);
  } else if(n.type==='character') buildSeriesLane(n);
  else if(n.type==='series') buildSeries(n);
  else if(n.type==='run') buildRun(n);
  else if(n.type==='event' && n.data.editions) n.children=n.data.editions.map((e,i)=>makeNode('story',{id:`${n.data.id}-edition-${i}`,title:e.title,format:e.format,coverage:e.coverage,notes:e.notes},n.id).id);
  else if(n.type==='event' && n.data.id==='crossover-spine') buildLane(n);
  else if(n.type==='story' && n.data.kind==='collections') n.children=[];
  else if(n.type==='story' && n.data.kind==='issues') n.children=[];
  else n.children=[];
  n.expanded=true; render(); window.requestAnimationFrame(()=>focusNode(n.id));
}
function collapse(n){n.expanded=false;(n.children||[]).forEach(id=>{const c=state.nodes.get(id);if(c)collapse(c)});}
function collapseAll(){collapse(state.nodes.get(state.root));state.selected=null;closeDetail();render();fit()}

const sizes={universe:[270,76],continuity:[260,68],character:[290,70],series:[270,64],run:[280,64],story:[280,62],event:[300,68],issue:[130,34]};
function layout(){
  // Constellation layout: the map grows in visual groups rather than a rigid old-school tree.
  const pos=new Map(); const colGap=26,rowGap=20,levelGap=72;
  const nodeSize=t=>{const base=sizes[t]||sizes.story; return t==='issue'?[150,38]:[Math.min(300,Math.max(230,base[0])),Math.max(base[1],68)]};
  const visibleKids=n=>(n.expanded&&n.children||[]).map(id=>state.nodes.get(id)).filter(Boolean);
  const blocks=[];
  const measure=n=>{
    const [w,h]=nodeSize(n.type); const kids=visibleKids(n);
    if(!kids.length){n._mw=w;n._mh=h;return [w,h];}
    const cols=Math.min(4,Math.max(1,Math.ceil(Math.sqrt(kids.length))));
    const rows=Math.ceil(kids.length/cols);
    let rowHeights=Array(rows).fill(0), colWidths=Array(cols).fill(0);
    kids.forEach((k,i)=>{const [cw,ch]=measure(k);const c=i%cols,r=Math.floor(i/cols);colWidths[c]=Math.max(colWidths[c],cw);rowHeights[r]=Math.max(rowHeights[r],ch);});
    const gw=colWidths.reduce((a,b)=>a+b,0)+colGap*(cols-1);
    const gh=rowHeights.reduce((a,b)=>a+b,0)+rowGap*(rows-1);
    n._mw=Math.max(w,gw); n._mh=h+levelGap+gh; n._cols=cols;n._colWidths=colWidths;n._rowHeights=rowHeights;
    return [n._mw,n._mh];
  };
  const place=(n,x,y)=>{
    const [w,h]=nodeSize(n.type); const totalW=n._mw||w; pos.set(n.id,{x:x+(totalW-w)/2,y,w,h});
    const kids=visibleKids(n); if(!kids.length)return;
    const cols=n._cols, widths=n._colWidths, heights=n._rowHeights;
    const gw=widths.reduce((a,b)=>a+b,0)+colGap*(cols-1); let sx=x+(totalW-gw)/2, cy=y+h+levelGap;
    const colX=[]; let acc=sx; for(let c=0;c<cols;c++){colX[c]=acc;acc+=widths[c]+colGap;}
    let rowY=cy;
    heights.forEach((rh,r)=>{
      for(let c=0;c<cols;c++){const i=r*cols+c;if(i>=kids.length)break;const k=kids[i];place(k,colX[c],rowY);}
      rowY+=rh+rowGap;
    });
  };
  const r=state.nodes.get(state.root); measure(r); place(r,0,0);
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity; for(const p of pos.values()){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x+p.w);maxY=Math.max(maxY,p.y+p.h);}
  const dx=-minX+40,dy=-minY+40; pos.forEach(v=>{v.x+=dx;v.y+=dy;});
  return {pos,width:maxX-minX+80,height:maxY-minY+80};
}
function render(){
  if(!state)return; const lay=layout(); const pos=lay.pos; nodesEl.innerHTML='';edgesEl.innerHTML='';
  const visible=[]; const walk=n=>{visible.push(n);if(n.expanded)(n.children||[]).forEach(id=>{const c=state.nodes.get(id);if(c)walk(c)})};walk(state.nodes.get(state.root));
  world.style.width=`${lay.width}px`;world.style.height=`${lay.height}px`;
  visible.forEach(n=>{const p=pos.get(n.id); if(!p)return; const div=document.createElement(n.type==='issue'?'button':'div'); div.className=n.type==='issue'?'sm-chip':'sm-node'; div.dataset.key=n.id;div.dataset.type=n.type;div.dataset.expanded=n.expanded;div.style.cssText=`position:absolute;left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px`;
    const d=n.data; const isSelected=state.selected===n.id; if(isSelected)div.dataset.selected='true';
    if(n.type==='issue'){div.innerHTML=esc(d.title+' #'+d.issue);}
    else {const kicker=n.type==='continuity'?'ERA':n.type==='character'?'LANE':n.type==='series'?'SERIES':n.type==='run'?'RUN':n.type==='event'?'EVENT':'DETAIL'; const sub=d.sub||d.years||d.notes|| (d.issueCount?`${d.issueCount} issues`:''); const count=n.children?.length; div.innerHTML=`<button class="sm-node-main"><span class="sm-node-text"><span class="sm-node-kicker">${esc(d.kicker||kicker)}${d.years?' · '+esc(d.years):''}</span><span class="sm-node-title">${esc(d.title)}</span>${sub?`<span class="sm-node-sub">${esc(String(sub))}</span>`:''}</span></button>${(n.type!=='issue'&&n.type!=='story')?`<button class="sm-toggle">${n.expanded?'−':(count?`+${count}`:'+')}</button>`:''}`; }
    div.onclick=e=>{if(e.target.closest('.sm-toggle')){e.stopPropagation(); if(n.expanded)collapse(n);else expand(n);render();return;} if(n.type==='issue'||n.type==='story'){select(n.id);return;} if(n.type==='universe'||n.type==='continuity'||n.type==='character'||n.type==='series'||n.type==='run'||n.type==='event'){ if(!n.expanded) expand(n); select(n.id); return; }};
    nodesEl.appendChild(div);
  });
  visible.forEach(n=>{if(!n.parent)return;const p=state.nodes.get(n.parent);if(!p||!p.expanded)return;const a=pos.get(p.id),b=pos.get(n.id);if(!a||!b)return;const x1=a.x+a.w,y1=a.y+a.h/2,x2=b.x,y2=b.y+b.h/2,m=(x1+x2)/2; const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}`);path.setAttribute('class','sm-edge-tree');edgesEl.appendChild(path);});
  renderCrumbs();applyView(false);
}
function renderCrumbs(){
  const c=root.querySelector('#smCrumbs'); if(!state||!state.selected){c.innerHTML='<button class="sm-crumb sm-crumb-current">DC Universe</button>';return;}
  const n=state.nodes.get(state.selected), chain=[];let p=n;while(p){chain.unshift(p);p=p.parent?state.nodes.get(p.parent):null;} c.innerHTML=chain.map((x,i)=>`<button class="sm-crumb ${i===chain.length-1?'sm-crumb-current':''}" data-id="${x.id}">${esc(x.data.title)}</button>`).join('<span class="sm-crumb-sep">›</span>');c.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>select(b.dataset.id));
}
function select(id){state.selected=id; if(!id){detail.dataset.open='false';root.dataset.detail='false';render();return;} const n=state.nodes.get(id);if(!n)return; renderDetail(n);render();}
function wireFormatTabs(series){
  const tabs=detail.querySelectorAll('.sm-format-tab'), panel=detail.querySelector('#smFormatPanel');
  if(!tabs.length||!panel)return;
  const paint=(format)=>{
    tabs.forEach(t=>t.setAttribute('aria-selected',String(t.dataset.format===format)));
    const rows=(series.collections||[]).filter(c=>c.format===format || (format==='Hardcover'&&/Hardcover/.test(c.format)) || (format==='Omnibus'&&/Omnibus/.test(c.format)) || (format==='Deluxe / Absolute'&&/Deluxe|Absolute/.test(c.format)));
    panel.innerHTML=rows.length ? rows.map(c=>`<div class="sm-edition-row"><div class="sm-edition-title">${esc(c.title)}</div><div class="sm-edition-coverage">${esc(c.coverage)}</div>${c.notes?`<div class="sm-edition-note">${esc(c.notes)}</div>`:''}</div>`).join('') : `<div class="sm-format-empty">No verified ${esc(format)} edition record has been entered for this series yet. The issue map is preserved; no edition coverage is guessed.</div>`;
  };
  tabs.forEach(t=>t.onclick=()=>paint(t.dataset.format)); paint('Trade Paperback');
}
function renderDetail(n){
  detail.dataset.open='true';root.dataset.detail='true'; const d=n.data; let html=`<div class="sm-d-kicker">${esc(n.type)}</div><h2 class="sm-d-title">${esc(d.title)}</h2>`;
  if(d.years)html+=`<div class="sm-d-facts"><div>${esc(d.years)}</div></div>`;
  if(d.description||d.summary||d.notes)html+=`<p class="sm-d-desc">${esc(d.description||d.summary||d.notes)}</p>`;
  if(n.type==='continuity'&&d.id==='new52'){
    html+=`<div class="sm-d-actions"><button class="sm-d-action sm-d-primary" data-expand>Open the New 52 world</button></div><div class="sm-d-section"><div class="sm-d-section-title">MAP PRINCIPLE</div><p class="sm-d-desc">Main continuity stays in parallel lanes. Batman, Detective Comics, Batman and Robin, Catwoman and the rest are separate series inside the Batman/Gotham lane. Crossovers are bridges between lanes. Alternate Earths are kept outside the main lane.</p></div>`;
  }
  if(n.type==='event'){
    const editions=d.editions||[]; if(d.issues)html+=`<div class="sm-d-section"><div class="sm-d-section-title">TRANSITION / EVENT ISSUES</div><div class="sm-d-desc">${esc(Array.isArray(d.issues)?d.issues.join(' · '):d.issues)}</div></div>`;
    if(editions.length){html+=`<div class="sm-d-section"><div class="sm-d-section-title">PUBLISHED FORMATS</div>`; editions.forEach(e=>html+=`<div class="sm-d-fact-row"><b>${esc(e.format)}</b><span>${esc(e.coverage)}</span></div>`);html+='</div>';}
    if(d.type)html+=`<div class="sm-d-section"><div class="sm-d-section-title">ROLE</div><div class="sm-d-desc">${esc(d.type)}</div></div>`;
  }
  if(n.type==='series'){
    if(d.issueSpec)html+=`<div class="sm-d-facts"><div><b>Issue coverage:</b> ${d.issueSpec.from===0?'#0–':''}${d.issueSpec.from!=null&&d.issueSpec.to!=null?`#${d.issueSpec.from}–#${d.issueSpec.to}`:''}</div><div><b>Issues in map:</b> ${d.issueCount}</div></div>`;
    const labels=(d.issues||[]);
    html+=`<div class="sm-d-section"><div class="sm-d-section-title">ISSUES · LIST VIEW</div><div class="sm-issue-list">${labels.map(x=>`<span class="sm-issue-pill">#${esc(x)}</span>`).join('')}</div></div>`;
    html+=`<div class="sm-d-section"><div class="sm-d-section-title">PUBLICATIONS · COLLECTED FORMATS</div><div class="sm-format-tabs">`;
    const formats=['Trade Paperback','Hardcover','Omnibus','Deluxe / Absolute'];
    formats.forEach((f,i)=>html+=`<button class="sm-format-tab" data-format="${esc(f)}" data-series="${esc(d.id)}" aria-selected="${i===0}">${esc(f)}</button>`);
    html+=`</div><div class="sm-format-panel" id="smFormatPanel"></div></div>`;
  }
  if(n.type==='story' && d.kind==='issues'){
    const s=d.series||{}; html+=`<div class="sm-d-section"><div class="sm-d-section-title">ALL ISSUES</div><div class="sm-issue-list sm-issue-list-large">${(s.issues||[]).map(x=>`<span class="sm-issue-pill">#${esc(x)}</span>`).join('')}</div></div>`;
  }
  if(n.type==='story' && d.kind==='collections'){
    html+=`<div class="sm-d-section"><div class="sm-d-section-title">PUBLICATIONS</div>`;
    const cs=d.collections||[]; html+=cs.length?`<div class="sm-publication-list">${cs.map(c=>`<article class="sm-publication-card"><div class="sm-publication-title">${esc(c.title)}</div><span class="sm-publication-format">${esc(c.format)}</span><div class="sm-publication-coverage">${esc(c.coverage)}</div>${c.notes?`<div class="sm-publication-note">${esc(c.notes)}</div>`:''}</article>`).join('')}</div>`:`<div class="sm-format-empty">No verified collected-edition records are attached to this series yet.</div>`;
    html+='</div>';
  }
  if(n.type==='run')html+=`<div class="sm-d-facts"><div><b>Issue span:</b> #${esc(d.from)}–#${esc(d.to)}</div></div>`;
  if(n.type==='issue')html+=`<div class="sm-d-facts"><div><b>Issue:</b> #${esc(d.issue)}</div><div><b>Parent series:</b> ${esc(d.title)}</div></div>`;
  if(d.format)html+=`<div class="sm-d-facts"><div><b>Format:</b> ${esc(d.format)}</div><div><b>Coverage:</b> ${esc(d.coverage||'')}</div></div>`;
  detail.querySelector('#smDetailBody').innerHTML=html;
  if(n.type==='series') wireFormatTabs(n.data);
  const b=detail.querySelector('[data-expand]');if(b)b.onclick=()=>{expand(n);select(n.id)};
}
function back(){if(state.selected){const n=state.nodes.get(state.selected);if(n?.parent)select(n.parent);else close();}else close();}
function close(){if(!root)return;root.dataset.open='false';root.dataset.detail='false';document.documentElement.classList.remove('sm-lock');state=null;}
function applyView(anim=false){if(!world||!state)return;world.classList.toggle('sm-world-animating',!!anim);world.style.transform=`translate3d(${state.view.tx}px,${state.view.ty}px,0) scale(${state.view.k})`; if(anim)window.clearTimeout(state.animTimer),state.animTimer=window.setTimeout(()=>world.classList.remove('sm-world-animating'),320);}
function zoomAt(f,cx,cy){if(!state)return; const old=state.view.k; const next=Math.max(.3,Math.min(3.2,old*f)); const ratio=next/old; state.view.tx=cx-(cx-state.view.tx)*ratio; state.view.ty=cy-(cy-state.view.ty)*ratio; state.view.k=next; applyView(true);}
function zoomAtFromBase(f,base,cx,cy){if(!state)return; const target=Math.max(.3,Math.min(3.2,base*f)); const old=state.view.k; const ratio=target/old; state.view.tx=cx-(cx-state.view.tx)*ratio; state.view.ty=cy-(cy-state.view.ty)*ratio; state.view.k=target; applyView(false);}
function zoom(f){zoomAt(f,viewport.clientWidth/2,viewport.clientHeight/2)}
function focusNode(id){if(!state||!id)return; const el=nodesEl.querySelector(`[data-key="${CSS.escape(id)}"]`); if(!el)return; const r=el.getBoundingClientRect(), vr=viewport.getBoundingClientRect(); const cx=r.left+r.width/2-vr.left, cy=r.top+r.height/2-vr.top; state.view.tx += vr.width/2-cx; state.view.ty += vr.height/2-cy; applyView(true);}
function focusSelected(){focusNode(state?.selected||state?.root);}
function fit(){if(!state)return;const r=viewport.getBoundingClientRect(), w=parseFloat(world.style.width)||100,h=parseFloat(world.style.height)||100;const k=Math.min((r.width-44)/w,(r.height-150)/h);state.view.k=Math.max(.3,Math.min(1.05,k));state.view.tx=(r.width-w*state.view.k)/2;state.view.ty=Math.max(20,(r.height-h*state.view.k)/2);applyView(true)}
function reset(){state.view={k:1,tx:20,ty:20};applyView(true)}

window.__comicsStoryMap={open,close,isOpen:()=>!!(root&&root.dataset.open==='true'),nodes:()=>state?[...state.nodes.values()].map(n=>({id:n.id,type:n.type,title:n.data.title,expanded:n.expanded})) : [],audit:()=>auditNew52()};
document.dispatchEvent(new CustomEvent('comicsv2:storymap-ready'));
