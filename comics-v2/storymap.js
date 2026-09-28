/*
 * ALLABOUTDC Story Map — modern era timeline
 *
 * Design rule:
 * - The ERA level is a single chronological spine. Newest era is at the top.
 * - A transition event is a clickable card BETWEEN the two eras it connects.
 * - No generic tree/branch connectors are used for the era map.
 * - Opening an era turns it into a focused explorer made of tabs + cards.
 * - Issues and collected editions are detail content, never hundreds of map nodes.
 */
import { eras, new52Era, transitionEvents, crossoverSpine, getSeriesForLane, auditNew52 } from './new52-map-data.js';

const esc = s => s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
let root=null, viewport=null, world=null, detail=null, controls=null;
let state=null;

function session(){
  state={ selected:null, expandedEra:null, tab:'main', view:{k:1,tx:0,ty:0}, drag:null, touch:new Map(), lastTap:0 };
}
function shell(){
  if(root)return;
  root=document.createElement('div');
  root.className='sm-root'; root.id='storyMap'; root.dataset.open='false';
  root.setAttribute('role','dialog'); root.setAttribute('aria-modal','true');
  root.innerHTML=`
    <div class="sm-topbar">
      <button class="sm-icon-btn" id="smBack" aria-label="Back">←</button>
      <div class="sm-heading"><div class="sm-kicker">STORY MAP</div><nav class="sm-crumbs" id="smCrumbs">DC Universe</nav></div>
      <button class="sm-icon-btn" id="smClose" aria-label="Close story map">✕</button>
    </div>
    <div class="sm-viewport" id="smViewport" tabindex="0" aria-label="Interactive DC Universe map">
      <div class="sm-world" id="smWorld"></div>
    </div>
    <div class="sm-controls" id="smControls">
      <button class="sm-ctl" data-c="out">−</button><button class="sm-ctl" data-c="in">+</button>
      <button class="sm-ctl sm-ctl-text" data-c="fit">Fit</button><button class="sm-ctl sm-ctl-text" data-c="reset">Reset</button>
      <button class="sm-ctl sm-ctl-text" data-c="collapse">Collapse</button><button class="sm-ctl sm-ctl-text" data-c="focus">Focus</button><button class="sm-ctl sm-ctl-text" data-c="key">Key</button>
    </div>
    <div class="sm-legend" id="smLegend" hidden>
      <div class="sm-legend-row"><span><b>Era</b> — chronological publishing / continuity period</span></div>
      <div class="sm-legend-row"><span><b>Transition</b> — clickable event between eras</span></div>
      <div class="sm-legend-row"><span><b>World explorer</b> — cards and tabs inside an era</span></div>
      <p class="sm-legend-note">The main era spine is chronological. Parallel stories only branch after you enter an era.</p>
    </div>
    <aside class="sm-detail" id="smDetail" data-open="false"><div class="sm-detail-handle"></div><button class="sm-icon-btn sm-detail-close" id="smDetailClose">✕</button><div class="sm-detail-body" id="smDetailBody"></div></aside>`;
  document.body.appendChild(root);
  viewport=root.querySelector('#smViewport'); world=root.querySelector('#smWorld'); detail=root.querySelector('#smDetail'); controls=root.querySelector('#smControls');
  root.querySelector('#smClose').onclick=close;
  root.querySelector('#smBack').onclick=back;
  root.querySelector('#smDetailClose').onclick=()=>select(null);
  controls.onclick=e=>{
    const b=e.target.closest('[data-c]'); if(!b)return;
    if(b.dataset.c==='in')zoomAt(1.22,viewport.clientWidth/2,viewport.clientHeight/2);
    if(b.dataset.c==='out')zoomAt(.82,viewport.clientWidth/2,viewport.clientHeight/2);
    if(b.dataset.c==='fit')fit();
    if(b.dataset.c==='reset')reset();
    if(b.dataset.c==='collapse'){state.expandedEra=null;state.selected=null;render();fit();}
    if(b.dataset.c==='focus')focusSelected();
    if(b.dataset.c==='key')root.querySelector('#smLegend').hidden=!root.querySelector('#smLegend').hidden;
  };
  viewport.addEventListener('pointerdown',onPointerDown);
  viewport.addEventListener('pointermove',onPointerMove);
  viewport.addEventListener('pointerup',onPointerEnd);
  viewport.addEventListener('pointercancel',onPointerEnd);
  viewport.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.deltaY<0?1.1:.91,e.clientX-viewport.getBoundingClientRect().left,e.clientY-viewport.getBoundingClientRect().top);},{passive:false});
  viewport.addEventListener('dblclick',e=>{if(e.target.closest('button,.sm-detail'))return;const r=viewport.getBoundingClientRect();zoomAt(1.3,e.clientX-r.left,e.clientY-r.top);});
  window.addEventListener('resize',()=>{if(root.dataset.open==='true'){render();fit();}});
}
function onPointerDown(e){
  if(e.target.closest('button,.sm-detail'))return;
  state.touch.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(state.touch.size===1){state.drag={x:e.clientX,y:e.clientY,tx:state.view.tx,ty:state.view.ty};viewport.setPointerCapture?.(e.pointerId);viewport.classList.add('sm-dragging');}
  else if(state.touch.size===2){state.drag=null;const p=[...state.touch.values()];state.pinch={distance:dist(p[0],p[1]),scale:state.view.k};}
}
function onPointerMove(e){
  if(!state.touch.has(e.pointerId))return;state.touch.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(state.touch.size>=2&&state.pinch){const p=[...state.touch.values()];const d=Math.max(20,dist(p[0],p[1]));const r=viewport.getBoundingClientRect();const mid={x:(p[0].x+p[1].x)/2-r.left,y:(p[0].y+p[1].y)/2-r.top};zoomAtFromBase(d/state.pinch.distance,state.pinch.scale,mid.x,mid.y);}
  else if(state.drag){state.view.tx=state.drag.tx+e.clientX-state.drag.x;state.view.ty=state.drag.ty+e.clientY-state.drag.y;applyView(false);}
}
function onPointerEnd(e){state.touch.delete(e.pointerId);if(state.touch.size<2)state.pinch=null;if(state.touch.size===0){state.drag=null;viewport.classList.remove('sm-dragging');}}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}

function open(){
  shell();session();root.dataset.open='true';document.documentElement.classList.add('sm-lock');
  render();requestAnimationFrame(fit);
}
function close(){if(!root)return;root.dataset.open='false';document.documentElement.classList.remove('sm-lock');state=null;}
function back(){if(state?.selected){select(null);return;}if(state?.expandedEra){state.expandedEra=null;state.tab='main';render();fit();return;}close();}
function select(item){state.selected=item;if(!item){detail.dataset.open='false';root.dataset.detail='false';render();return;}renderDetail(item);}

function eraTransition(upper,lower){return transitionEvents.find(x=>x.from===lower.id&&x.to===upper.id)||null;}
function render(){
  if(!state)return;
  const parts=[];
  parts.push(`<section class="sm-era-map"><div class="sm-map-intro"><span class="sm-map-eyebrow">DC UNIVERSE</span><h1>Every era. One clear path.</h1><p>Follow the main chronological spine. Open an era to explore its parallel worlds, runs and events.</p></div>`);
  eras.forEach((era,i)=>{
    const expanded=state.expandedEra===era.id;
    parts.push(`<article class="sm-era-block ${expanded?'is-open':''}" data-era="${esc(era.id)}">
      <button class="sm-era-card" data-era-open="${esc(era.id)}">
        <span class="sm-era-index">${String(i+1).padStart(2,'0')}</span>
        <span class="sm-era-copy"><span class="sm-era-kicker">ERA · ${esc(era.years||'')}</span><strong>${esc(era.title)}</strong><small>${era.id==='new52'?'Shared DC Universe · open to explore':(era.status==='future-build'?'Map layer ready to be researched':'')}</small></span>
        <span class="sm-era-action">${expanded?'Close':'Explore'} <b>${expanded?'−':'↗'}</b></span>
      </button>`);
    if(expanded)parts.push(renderEraExplorer(era));
    parts.push(`</article>`);
    const next=eras[i+1];
    if(next){const tr=eraTransition(era,next);parts.push(renderTransition(tr,era,next));}
  });
  parts.push('</section>');
  world.innerHTML=parts.join('');
  world.querySelectorAll('[data-era-open]').forEach(b=>b.onclick=()=>toggleEra(b.dataset.eraOpen));
  world.querySelectorAll('[data-transition]').forEach(b=>b.onclick=()=>select({type:'event',data:transitionEvents.find(x=>x.id===b.dataset.transition)}));
  world.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render();requestAnimationFrame(()=>focusExpanded());});
  world.querySelectorAll('[data-series]').forEach(b=>b.onclick=()=>{const s=new52Era.series.find(x=>x.id===b.dataset.series)||new52Era.limited.find(x=>x.id===b.dataset.series);if(s)select({type:'series',data:s});});
  world.querySelectorAll('[data-lane]').forEach(b=>b.onclick=()=>openLane(b.dataset.lane));
  world.querySelectorAll('[data-cross]').forEach(b=>b.onclick=()=>{const x=crossoverSpine.find(e=>e.id===b.dataset.cross);if(x)select({type:'event',data:x});});
  world.querySelectorAll('[data-format-series]').forEach(b=>b.onclick=()=>{const s=new52Era.series.find(x=>x.id===b.dataset.formatSeries);if(s)select({type:'series',data:s});});
  applyView(false);renderCrumbs();
}
function renderTransition(tr,upper,lower){
  if(!tr)return `<div class="sm-era-connector" aria-hidden="true"><span class="sm-connector-line"></span><span class="sm-connector-arrow">↓</span></div>`;
  return `<div class="sm-era-connector"><span class="sm-connector-line"></span><button class="sm-transition-card" data-transition="${esc(tr.id)}"><span class="sm-transition-label">TRANSITION EVENT</span><strong>${esc(tr.title)}</strong><small>${esc(tr.issues?.[0]||'Open event details')}</small><span class="sm-transition-arrow">↓</span></button><span class="sm-connector-line"></span></div>`;
}
function toggleEra(id){
  state.expandedEra=state.expandedEra===id?null:id;state.selected=null;state.tab='main';render();requestAnimationFrame(()=>state.expandedEra?focusExpanded():fit());
}
function renderEraExplorer(era){
  if(era.id!=='new52')return `<div class="sm-era-explorer sm-era-placeholder"><div><span class="sm-section-eyebrow">ERA LAYER</span><h2>${esc(era.title)}</h2><p>This era is mapped on the chronological spine. Its detailed world will be built in the same card-based format, without turning the map into an old-style branch tree.</p></div></div>`;
  const tabs=[['main','Main continuity'],['alternate','Alternate worlds'],['events','Crossover spine'],['future','Future / continuation']];
  let body='';
  if(state.tab==='main')body=renderMainWorld();
  if(state.tab==='alternate')body=renderAlternateWorld();
  if(state.tab==='events')body=renderEventsWorld();
  if(state.tab==='future')body=renderFutureWorld();
  return `<div class="sm-era-explorer sm-new52-explorer">
    <div class="sm-new52-hero"><div><span class="sm-section-eyebrow">THE NEW 52 · 2011–2016</span><h2>Explore the shared world</h2><p>Main continuity stays parallel. Crossovers connect lanes. Alternate Earths remain separate.</p></div><span class="sm-live-badge">RESEARCH MAP</span></div>
    <div class="sm-map-tabs" role="tablist">${tabs.map(([id,label])=>`<button data-tab="${id}" class="${state.tab===id?'is-active':''}" role="tab">${esc(label)}</button>`).join('')}</div>
    <div class="sm-map-panel">${body}</div>
  </div>`;
}
function card(type,id,title,sub,meta=''){
  const attr=type==='series'?`data-series="${esc(id)}"`:type==='lane'?`data-lane="${esc(id)}"`:type==='cross'?`data-cross="${esc(id)}"`:'';
  return `<button class="sm-world-card sm-card-${type}" ${attr}><span class="sm-card-meta">${esc(meta||type)}</span><strong>${esc(title)}</strong><small>${esc(sub||'')}</small><span class="sm-card-go">→</span></button>`;
}
function renderMainWorld(){
  const lanes=new52Era.mainLanes;
  return `<div class="sm-world-section"><div class="sm-section-head"><div><span class="sm-section-eyebrow">MAIN CONTINUITY · EARTH-0</span><h3>Parallel reading lanes</h3></div><span class="sm-section-count">${lanes.length} lanes</span></div><div class="sm-lane-grid">${lanes.map(l=>card('lane',l.id,l.title,l.sub,'LANE')).join('')}</div></div>`;
}
function openLane(id){
  state.selected={type:'lane',data:new52Era.mainLanes.find(l=>l.id===id)||new52Era.alternateLanes.find(l=>l.id===id)||{id,title:id}};
  renderLaneDetail(state.selected.data);
}
function renderLaneDetail(lane){
  const series=[...new52Era.series.filter(s=>s.lane===lane.id),...new52Era.limited.filter(s=>s.lane===lane.id)];
  detail.dataset.open='true';root.dataset.detail='true';
  detail.querySelector('#smDetailBody').innerHTML=`<div class="sm-d-kicker">LANE</div><h2 class="sm-d-title">${esc(lane.title)}</h2><p class="sm-d-desc">${esc(lane.sub||'')}</p><div class="sm-d-section"><div class="sm-d-section-title">PUBLICATION RUNS</div><div class="sm-world-card-grid">${series.map(s=>`<button class="sm-world-card sm-card-series" data-side-series="${esc(s.id)}"><span class="sm-card-meta">SERIES · ${esc(s.issueCount||s.issues?.length||'')} issues</span><strong>${esc(s.title)}</strong><small>${esc(s.notes||'')}</small></button>`).join('')}</div></div>`;
  detail.querySelectorAll('[data-side-series]').forEach(b=>b.onclick=()=>{const s=new52Era.series.find(x=>x.id===b.dataset.sideSeries)||new52Era.limited.find(x=>x.id===b.dataset.sideSeries);if(s)renderSeriesDetail(s);});
}
function renderAlternateWorld(){
  const items=[...getSeriesForLane('alternate'),...new52Era.limited.filter(x=>x.lane==='alternate')];
  return `<div class="sm-world-section"><div class="sm-section-head"><div><span class="sm-section-eyebrow">PARALLEL CONTINUITIES</span><h3>Separate worlds</h3></div></div><div class="sm-world-card-grid">${items.map(s=>card('series',s.id,s.title,s.notes||'Alternate / parallel continuity','ALTERNATE')).join('')}</div><div class="sm-note-panel"><b>Navigation rule</b><span>These are not hidden inside the Earth-0 reading lanes. Enter them only when you want the parallel-universe material.</span></div></div>`;
}
function renderEventsWorld(){
  return `<div class="sm-world-section"><div class="sm-section-head"><div><span class="sm-section-eyebrow">CROSSOVER SPINE</span><h3>Events that connect the lanes</h3></div></div><div class="sm-world-card-grid">${crossoverSpine.map(e=>card('cross',e.id,e.title,e.issues,'EVENT')).join('')}</div></div>`;
}
function renderFutureWorld(){
  const items=[...getSeriesForLane('future'),...new52Era.limited.filter(x=>['futures-end','earth2-worlds-end','convergence','batman-robin-eternal','batman-beyond-v5','prez-v2','justice-league-3001'].includes(x.id))];
  return `<div class="sm-world-section"><div class="sm-section-head"><div><span class="sm-section-eyebrow">LATE NEW 52 / DC YOU</span><h3>Future-facing continuation</h3></div></div><div class="sm-world-card-grid">${items.map(s=>card('series',s.id,s.title,s.notes||'Future / continuation','CONTINUATION')).join('')}</div></div>`;
}

function renderDetail(item){
  const n=item.data,dtype=item.type;
  detail.dataset.open='true';root.dataset.detail='true';
  if(dtype==='series'){renderSeriesDetail(n);return;}
  if(dtype==='event'){renderEventDetail(n);return;}
  detail.querySelector('#smDetailBody').innerHTML=`<div class="sm-d-kicker">${esc(dtype)}</div><h2 class="sm-d-title">${esc(n.title)}</h2><p class="sm-d-desc">${esc(n.sub||n.notes||'')}</p>`;
}
function renderSeriesDetail(d){
  detail.dataset.open='true';root.dataset.detail='true';
  const issues=d.issues||[];const cols=d.collections||[];
  const formatRows=(format)=>cols.filter(c=>c.format===format || (format==='Hardcover'&&/Hardcover/.test(c.format)) || (format==='Omnibus'&&/Omnibus/.test(c.format)) || (format==='Deluxe / Absolute'&&/Deluxe|Absolute/.test(c.format)));
  detail.querySelector('#smDetailBody').innerHTML=`
    <div class="sm-d-kicker">SERIES</div><h2 class="sm-d-title">${esc(d.title)}</h2>
    <p class="sm-d-desc">${esc(d.notes||'New 52 publication run')}</p>
    <div class="sm-d-facts"><div><b>Issue coverage:</b> ${d.issueSpec?.from===0?'#0–':''}${d.issueSpec?.from!=null&&d.issueSpec?.to!=null?`#${d.issueSpec.from}–#${d.issueSpec.to}`:''}</div><div><b>Issues mapped:</b> ${issues.length}</div></div>
    <div class="sm-d-section"><div class="sm-d-section-title">ISSUES</div><div class="sm-issue-list sm-issue-list-large">${issues.map(x=>`<span class="sm-issue-pill">#${esc(x)}</span>`).join('')}</div></div>
    <div class="sm-d-section"><div class="sm-d-section-title">PUBLICATIONS · COLLECTED FORMATS</div><div class="sm-format-tabs">${['Trade Paperback','Hardcover','Omnibus','Deluxe / Absolute'].map((f,i)=>`<button class="sm-format-tab" data-sf="${esc(f)}" aria-selected="${i===0}">${esc(f)}</button>`).join('')}</div><div class="sm-format-panel" id="smSideFormatPanel"></div></div>`;
  const paint=f=>{detail.querySelectorAll('[data-sf]').forEach(t=>t.setAttribute('aria-selected',String(t.dataset.sf===f)));const rows=formatRows(f);detail.querySelector('#smSideFormatPanel').innerHTML=rows.length?rows.map(c=>`<article class="sm-publication-card"><div class="sm-publication-title">${esc(c.title)}</div><span class="sm-publication-format">${esc(c.format)}</span><div class="sm-publication-coverage">${esc(c.coverage)}</div>${c.notes?`<div class="sm-publication-note">${esc(c.notes)}</div>`:''}</article>`).join(''):`<div class="sm-format-empty">No verified ${esc(f)} edition record is entered yet. Nothing is guessed.</div>`;};
  detail.querySelectorAll('[data-sf]').forEach(b=>b.onclick=()=>paint(b.dataset.sf));paint('Trade Paperback');
}
function renderEventDetail(d){
  const editions=d.editions||[];
  detail.querySelector('#smDetailBody').innerHTML=`<div class="sm-d-kicker">TRANSITION / EVENT</div><h2 class="sm-d-title">${esc(d.title)}</h2><p class="sm-d-desc">${esc(d.summary||d.notes||'')}</p>${d.issues?`<div class="sm-d-section"><div class="sm-d-section-title">CORE TRANSITION COMICS</div><div class="sm-issue-list sm-issue-list-large">${d.issues.map(x=>`<span class="sm-issue-pill">${esc(x)}</span>`).join('')}</div></div>`:''}${editions.length?`<div class="sm-d-section"><div class="sm-d-section-title">PUBLISHED FORMATS</div><div class="sm-publication-list">${editions.map(e=>`<article class="sm-publication-card"><div class="sm-publication-title">${esc(e.title)}</div><span class="sm-publication-format">${esc(e.format)}</span><div class="sm-publication-coverage">${esc(e.coverage)}</div>${e.notes?`<div class="sm-publication-note">${esc(e.notes)}</div>`:''}</article>`).join('')}</div></div>`:''}`;
  detail.dataset.open='true';root.dataset.detail='true';
}
function renderCrumbs(){root.querySelector('#smCrumbs').innerHTML=state.expandedEra?`<button class="sm-crumb sm-crumb-current">DC Universe › ${esc(state.expandedEra==='new52'?'The New 52':(eras.find(e=>e.id===state.expandedEra)?.title||''))}</button>`:`<button class="sm-crumb sm-crumb-current">DC Universe</button>`;}
function focusExpanded(){const el=world.querySelector('.sm-era-block.is-open');if(!el)return;const r=el.getBoundingClientRect(),v=viewport.getBoundingClientRect();state.view.ty+=v.top+110-(r.top+r.height/2);applyView(true);}
function focusSelected(){if(!state.selected){fit();return;}focusExpanded();}
function applyView(anim=false){if(!world||!state)return;world.classList.toggle('sm-world-animating',anim);world.style.transform=`translate3d(${state.view.tx}px,${state.view.ty}px,0) scale(${state.view.k})`;if(anim){clearTimeout(state.animTimer);state.animTimer=setTimeout(()=>world.classList.remove('sm-world-animating'),280);}}
function zoomAt(f,cx,cy){const old=state.view.k,next=Math.max(.45,Math.min(2.2,old*f)),ratio=next/old;state.view.tx=cx-(cx-state.view.tx)*ratio;state.view.ty=cy-(cy-state.view.ty)*ratio;state.view.k=next;applyView(true);}
function zoomAtFromBase(f,base,cx,cy){const target=Math.max(.45,Math.min(2.2,base*f)),old=state.view.k,ratio=target/old;state.view.tx=cx-(cx-state.view.tx)*ratio;state.view.ty=cy-(cy-state.view.ty)*ratio;state.view.k=target;applyView(false);}
function fit(){if(!state||!world)return;const r=viewport.getBoundingClientRect(),w=world.scrollWidth||world.offsetWidth||800,h=world.scrollHeight||world.offsetHeight||1200;const k=Math.min((r.width-32)/w,(r.height-120)/h);state.view.k=Math.max(.45,Math.min(.95,k));state.view.tx=(r.width-w*state.view.k)/2;state.view.ty=18;applyView(true);}
function reset(){state.view={k:1,tx:16,ty:16};applyView(true);}

window.__comicsStoryMap={open,close,isOpen:()=>!!(root&&root.dataset.open==='true'),audit:()=>auditNew52()};
document.dispatchEvent(new CustomEvent('comicsv2:storymap-ready'));
