/*
 * ALLABOUTDC — Story Map 4.0
 *
 * The map is intentionally an atlas, not an ETL/flowchart:
 * - chronology lives in a persistent era ribbon + transition gates
 * - the centre of the screen is an explorable DC "world"
 * - New 52 publications are territories/lenses, not hundreds of nodes
 * - Characters / Era / Reading Paths open the same map and the same source
 * - series -> issues -> collected editions remains the canonical drill-down
 */
import {
  eras, new52Era, transitionEvents, crossoverSpine, new52Series, new52Limited,
  new52CharacterHubs, new52ReadingPaths, auditNew52
} from './new52-map-data.js?v=20260928-atlas5';

const esc=s=>s==null?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
let root=null,stage=null,detail=null,state=null;

const allPubs=()=>[...new52Series,...new52Limited];
const laneFor=id=>[...new52Era.mainLanes,...new52Era.alternateLanes].find(x=>x.id===id)||null;
const seriesById=id=>allPubs().find(x=>x.id===id)||null;
const transitionFor=(from,to)=>transitionEvents.find(x=>x.from===from&&x.to===to)||null;
const issueCount=s=>(s?.issues||[]).length;
const formatKey=raw=>{const f=String(raw||'').toLowerCase();if(/trade|paperback|softcover/.test(f))return 'Trade Paperback';if(/deluxe|absolute/.test(f))return 'Deluxe / Absolute';if(/omnibus/.test(f))return 'Omnibus';if(/hardcover/.test(f))return 'Hardcover';return null;};
const formats=s=>[...new Set((s?.collections||[]).map(x=>formatKey(x.format)).filter(Boolean))];
const formatOrder=['Trade Paperback','Hardcover','Omnibus','Deluxe / Absolute'];

function session(mode='universe'){
  state={mode,selected:null,detailType:null,character:null,path:null,view:{k:1,x:0,y:0},drag:null,pointers:new Map(),gesture:{type:null,moved:false,suppressClick:false,startX:0,startY:0,startViewX:0,startViewY:0,startDistance:0,startScale:1,startMidX:0,startMidY:0}};
}
function shell(){
  if(root)return;
  root=document.createElement('div'); root.id='storyMap'; root.className='sm-root'; root.dataset.open='false';
  root.innerHTML=`
    <header class="sm-topbar">
      <button class="sm-icon-btn" id="smBack" aria-label="Back">←</button>
      <div class="sm-heading"><div class="sm-kicker">DC UNIVERSE ATLAS</div><div class="sm-crumbs" id="smCrumbs">Universe</div></div>
      <nav class="sm-mode-nav" id="smModeNav">
        <button data-mode="universe">Universe</button><button data-mode="new52">New 52</button><button data-mode="characters">Characters</button><button data-mode="continuity">Eras</button><button data-mode="paths">Paths</button>
      </nav>
      <button class="sm-icon-btn" id="smClose" aria-label="Close story map">✕</button>
    </header>
    <aside class="sm-left-rail" id="smLeftRail">
      <div class="sm-rail-title"><span>MAP MODES</span><b>Explore</b></div>
      <button class="sm-rail-mode is-active" data-mode="universe"><span>◉</span><b>Universe Atlas</b><i>↗</i></button>
      <button class="sm-rail-mode" data-mode="continuity"><span>◌</span><b>Era Timeline</b><i>↗</i></button>
      <button class="sm-rail-mode" data-mode="characters"><span>✦</span><b>Character Atlas</b><i>↗</i></button>
      <button class="sm-rail-mode" data-mode="paths"><span>⌁</span><b>Reading Paths</b><i>↗</i></button>
      <div class="sm-rail-divider"></div>
      <div class="sm-rail-title"><span>FILTERS</span><b>Shape the atlas</b></div>
      <button class="sm-filter" data-filter="eras"><span>◫</span><b>Era</b><i>⌄</i></button><div class="sm-filter-options" data-filter-options="eras">${eras.map(e=>`<button data-era="${esc(e.id)}"><b>${esc(e.title)}</b><small>${esc(e.years||'')}</small></button>`).join('')}</div>
      <button class="sm-filter" data-filter="continuity"><span>◈</span><b>Continuity</b><i>⌄</i></button><div class="sm-filter-options" data-filter-options="continuity"><button data-mode="new52"><b>Main continuity</b><small>Earth-0 · New 52</small></button><button data-world="multiverse"><b>Alternate worlds</b><small>Earth-2 · Earth-3 · Multiverse</small></button></div>
      <button class="sm-filter" data-filter="characters"><span>♙</span><b>Character</b><i>⌄</i></button><div class="sm-filter-options" data-filter-options="characters"><button data-mode="characters"><b>Character Atlas</b><small>Heroes + family groups</small></button></div>
      <button class="sm-filter" data-filter="events"><span>✦</span><b>Events</b><i>⌄</i></button><div class="sm-filter-options" data-filter-options="events"><button data-world="events"><b>Major events</b><small>Crisis · Flashpoint · Metal</small></button></div>
      <button class="sm-filter" data-filter="earths"><span>◎</span><b>Earth / World</b><i>⌄</i></button><div class="sm-filter-options" data-filter-options="earths"><button data-world="multiverse"><b>Multiverse</b><small>Parallel Earths & realms</small></button><button data-world="earth"><b>Earth-0</b><small>Main continuity</small></button></div>
      <button class="sm-filter" data-filter="formats"><span>▣</span><b>Publication Format</b><i>⌄</i></button><div class="sm-filter-options" data-filter-options="formats"><button data-mode="new52"><b>Collected editions</b><small>TPB · HC · Omnibus · Deluxe</small></button></div>
      <div class="sm-rail-divider"></div>
      <div class="sm-rail-title"><span>QUICK WORLDS</span><b>Jump in</b></div>
      <button class="sm-quick" data-mode="new52"><span class="quick-dot dot-red"></span>New 52</button>
      <button class="sm-quick" data-world="multiverse"><span class="quick-dot dot-purple"></span>Multiverse</button>
      <button class="sm-quick" data-world="events"><span class="quick-dot dot-gold"></span>Major Events</button>
      <div class="sm-rail-divider"></div>
      <div class="sm-rail-title"><span>COMICS</span><b>Publication layer</b></div>
      <button class="sm-quick" data-mode="new52"><span class="quick-dot dot-red"></span>Runs &amp; Issues</button>
      <button class="sm-quick" data-browse-catalogue="true"><span class="quick-dot dot-blue"></span>Browse Catalogue</button>
      <div class="sm-rail-note">Everything here is a lens over the same researched publication data.</div>
    </aside>
    <main class="sm-stage" id="smStage" tabindex="0" aria-label="Interactive DC Universe atlas"><div class="sm-world" id="smWorld"></div></main>
    <div class="sm-atlas-tools"><button data-tool="out">−</button><button data-tool="in">+</button><button data-tool="fit">Fit</button><button data-tool="reset">Reset</button></div>
    <aside class="sm-detail" id="smDetail" data-open="false"><div class="sm-detail-handle"></div><button class="sm-icon-btn sm-detail-close" id="smDetailClose">✕</button><div id="smDetailBody"></div></aside>`;
  document.body.appendChild(root); stage=root.querySelector('#smStage'); detail=root.querySelector('#smDetail');
  root.querySelector('#smClose').onclick=close; root.querySelector('#smBack').onclick=back; root.querySelector('#smDetailClose').onclick=()=>closeDetail();
  root.querySelector('#smModeNav').onclick=e=>{const b=e.target.closest('[data-mode]');if(b)navigate(b.dataset.mode);};
  root.querySelector('#smLeftRail').onclick=e=>{
    const mode=e.target.closest('[data-mode]'); if(mode){navigate(mode.dataset.mode);return;}
    const filter=e.target.closest('[data-filter]'); if(filter){handleFilter(filter.dataset.filter);return;}
    const world=e.target.closest('[data-world]'); if(world){handleWorld(world.dataset.world);return;}
    const browse=e.target.closest('[data-browse-catalogue]'); if(browse){
      const fn=window.__comicsAtlasBrowse;
      if(typeof fn==='function') fn();
      else close();
      return;
    }
  };
  root.querySelector('.sm-atlas-tools').onclick=e=>{const b=e.target.closest('[data-tool]');if(!b)return; if(b.dataset.tool==='in')zoom(1.18,stage.clientWidth/2,stage.clientHeight/2);if(b.dataset.tool==='out')zoom(.85,stage.clientWidth/2,stage.clientHeight/2);if(b.dataset.tool==='fit')fit();if(b.dataset.tool==='reset')reset();};
  stage.addEventListener('click',onWorldClick);
  stage.addEventListener('pointerdown',pointerDown,{passive:false});
  stage.addEventListener('pointermove',pointerMove,{passive:false});
  stage.addEventListener('pointerup',pointerEnd,{passive:false});
  stage.addEventListener('pointercancel',pointerEnd,{passive:false});
  stage.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.08:.92,e.clientX-stage.getBoundingClientRect().left,e.clientY-stage.getBoundingClientRect().top);},{passive:false});
  stage.addEventListener('dblclick',e=>{if(e.target.closest('button,.sm-detail'))return;const r=stage.getBoundingClientRect();zoom(1.22,e.clientX-r.left,e.clientY-r.top);},{passive:false});
  window.addEventListener('resize',()=>{if(root.dataset.open==='true'){render();requestAnimationFrame(fit);}});
}
function handleFilter(kind){
  const panel=root?.querySelector(`[data-filter-options="${kind}"]`);
  if(panel){
    const open=panel.classList.contains('is-open');
    root.querySelectorAll('.sm-filter-options').forEach(x=>x.classList.remove('is-open'));
    root.querySelectorAll('.sm-filter').forEach(x=>x.classList.remove('is-open'));
    if(!open){panel.classList.add('is-open');root.querySelector(`.sm-filter[data-filter="${kind}"]`)?.classList.add('is-open');}
  }
}
function handleWorld(kind){
  if(kind==='multiverse'){state.mode='universe';render();requestAnimationFrame(()=>root.querySelector('.sm-panel-worlds')?.scrollIntoView({block:'center',inline:'nearest'}));}
  else if(kind==='events'){state.mode='universe';render();requestAnimationFrame(()=>root.querySelector('.sm-panel-events')?.scrollIntoView({block:'center',inline:'nearest'}));}
  else if(kind==='earth'){showDetail('era',{id:'earth-0',title:'Earth-0 · Main Continuity',years:'New 52 / Main Universe',notes:'Earth-0 is the primary continuity lens. Enter The New 52 to explore its publication territories, characters, crossovers and collected editions.'});}
}
function pointerPos(){
  return [...state.pointers.values()];
}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function midpoint(a,b){return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
function pointerDown(e){
  if(!state||!stage)return;
  if(e.pointerType==='touch')e.preventDefault();
  state.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const pts=pointerPos();
  if(pts.length===1){
    state.gesture={type:'pan',moved:false,startX:e.clientX,startY:e.clientY,startViewX:state.view.x,startViewY:state.view.y,startDistance:0,startScale:state.view.k,startMidX:0,startMidY:0};
    state.drag={x:e.clientX,y:e.clientY,ox:state.view.x,oy:state.view.y};
    stage.classList.remove('sm-dragging');
  }else if(pts.length===2){
    const [a,b]=pts,mid=midpoint(a,b);
    state.gesture={type:'pinch',moved:true,startX:0,startY:0,startViewX:state.view.x,startViewY:state.view.y,startDistance:Math.max(1,distance(a,b)),startScale:state.view.k,startMidX:mid.x,startMidY:mid.y};
    state.drag=null;
    stage.classList.add('sm-dragging');
    for(const id of state.pointers.keys())stage.setPointerCapture?.(id);
  }
}
function pointerMove(e){
  if(!state||!state.pointers.has(e.pointerId))return;
  if(e.pointerType==='touch')e.preventDefault();
  state.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const pts=pointerPos();
  if(pts.length===1&&state.gesture.type==='pan'){
    const dx=e.clientX-state.gesture.startX,dy=e.clientY-state.gesture.startY;
    if(Math.hypot(dx,dy)>6){
      state.gesture.moved=true;state.gesture.suppressClick=true;
      try{stage.setPointerCapture?.(e.pointerId);}catch{}
      stage.classList.add('sm-dragging');
    }
    if(!state.gesture.moved)return;
    state.view.x=state.gesture.startViewX+dx;
    state.view.y=state.gesture.startViewY+dy;
    applyView(false);
    return;
  }
  if(pts.length>=2&&state.gesture.type==='pinch'){
    const [a,b]=pts;
    const mid=midpoint(a,b),scale=Math.max(.72,Math.min(1.65,state.gesture.startScale*(distance(a,b)/state.gesture.startDistance)));
    const ratio=scale/state.gesture.startScale;
    state.view.k=scale;
    state.view.x=mid.x-(state.gesture.startMidX-state.gesture.startViewX)*ratio;
    state.view.y=mid.y-(state.gesture.startMidY-state.gesture.startViewY)*ratio;
    applyView(false);
  }
}
function pointerEnd(e){
  if(!state)return;
  state.pointers.delete(e.pointerId);
  try{stage.releasePointerCapture?.(e.pointerId);}catch{}
  if(state.pointers.size===0){
    const suppress=state.gesture.suppressClick;
    state.drag=null;state.gesture.type=null;stage.classList.remove('sm-dragging');
    if(suppress){state.suppressClick=true;setTimeout(()=>{if(state)state.suppressClick=false;},80);}
  }else if(state.pointers.size===1){
    const [p]=pointerPos();
    state.gesture={type:'pan',moved:true,startX:p.x,startY:p.y,startViewX:state.view.x,startViewY:state.view.y,startDistance:0,startScale:state.view.k,startMidX:0,startMidY:0};
  }
}
function zoom(f,cx,cy){const old=state.view.k,next=Math.max(.72,Math.min(1.65,old*f)),r=next/old;state.view.x=cx-(cx-state.view.x)*r;state.view.y=cy-(cy-state.view.y)*r;state.view.k=next;applyView(true);}
function applyView(anim=true){const w=root.querySelector('#smWorld');if(!w)return;w.classList.toggle('sm-animate',anim);w.style.transform=`translate3d(${state.view.x}px,${state.view.y}px,0) scale(${state.view.k})`;if(anim)setTimeout(()=>w.classList.remove('sm-animate'),260);}
function fit(){
  if(!state||!root||!stage)return;
  const w=root.querySelector('#smWorld');if(!w)return;
  const sr=stage.getBoundingClientRect();
  const ww=Math.max(w.scrollWidth,w.offsetWidth,w.getBoundingClientRect().width);
  const hh=Math.max(w.scrollHeight,w.offsetHeight,w.getBoundingClientRect().height);
  const k=Math.max(.55,Math.min(1,(sr.width-24)/Math.max(1,ww),(sr.height-24)/Math.max(1,hh)));
  state.view.k=k;
  state.view.x=Math.max(8,(sr.width-ww*k)/2);
  state.view.y=Math.max(8,(sr.height-hh*k)/2);
  applyView(true);
}
function reset(){state.view={k:1,x:0,y:0};applyView(true);}
function open(mode='universe'){shell();session(mode);root.dataset.open='true';document.documentElement.classList.add('sm-lock');render();requestAnimationFrame(fit);}
function close(){
  if(!root)return;
  root.dataset.open='false';
  document.documentElement.classList.remove('sm-lock');
  state=null;
  const backToApp=window.__comicsAtlasReturn;
  if(typeof backToApp==='function') backToApp();
}
function closeDetail(){if(!state)return;state.selected=null;state.detailType=null;detail.dataset.open='false';root.dataset.detail='false';}
function back(){if(state?.selected){closeDetail();return;}if(state?.mode!=='universe'){navigate('universe');return;}close();}
function navigate(mode){if(!state)return;closeDetail();state.mode=mode;state.character=null;state.path=null;render();requestAnimationFrame(fit);}

function render(){
  if(!state)return;
  root.dataset.mode=state.mode;
  root.querySelectorAll('#smModeNav [data-mode]').forEach(b=>b.classList.toggle('is-active',b.dataset.mode===state.mode)); root.querySelectorAll('#smLeftRail [data-mode]').forEach(b=>b.classList.toggle('is-active',b.dataset.mode===state.mode));
  let html='';
  if(state.mode==='universe')html=renderUniverse();
  if(state.mode==='new52')html=renderNew52();
  if(state.mode==='characters')html=renderCharacters();
  if(state.mode==='continuity')html=renderContinuity();
  if(state.mode==='paths')html=renderPaths();
  root.querySelector('#smWorld').innerHTML=html; applyView(false); updateCrumbs();
}
function updateCrumbs(){const labels={universe:'Universe',new52:'The New 52',characters:'Character Atlas',continuity:'Continuity / Eras',paths:'Reading Paths'};root.querySelector('#smCrumbs').textContent=labels[state.mode]||'Universe';}

function eraRibbon(){
  return `<div class="sm-era-ribbon">${eras.map((e,i)=>`<button class="sm-era-pill ${e.id==='new52'?'is-hot':''}" data-era="${esc(e.id)}"><span>${String(i+1).padStart(2,'0')}</span><b>${esc(e.title)}</b><small>${esc(e.years||'')}</small></button>`).join('')}</div>`;
}
function renderUniverse(){
  const events=transitionEvents.slice().reverse();
  const erasTop=eras.slice().reverse();
  return `<div class="sm-atlas sm-universe-atlas sm-immersive">
    <div class="sm-cosmic-backdrop"><span class="nebula n1"></span><span class="nebula n2"></span><span class="nebula n3"></span><span class="city-haze"></span><span class="starfield"></span></div>
    <section class="sm-map-hero">
      <div class="sm-map-copy"><span class="sm-eyebrow">DC CONTINUITY MAP</span><h1>The DC Universe is a world to explore.</h1><p>Travel the eras, step through the crises, discover the Earths and follow the characters who connect them.</p><div class="sm-legend"><span><i class="lg blue"></i>Main Continuity</span><span><i class="lg red"></i>Alternate Earth</span><span><i class="lg gold"></i>Event</span><span><i class="lg purple"></i>Multiverse</span></div></div>
      <div class="sm-universe-canvas">
        <div class="sm-constellation-label label-multiverse">THE MULTIVERSE</div><div class="sm-constellation-label label-events">EVENTS</div><div class="sm-constellation-label label-heroes">HEROES & TEAMS</div>
        <button class="sm-world-orb orb-earth" data-world="earth"><span class="orb-ring"></span><b>EARTH-0</b><small>MAIN CONTINUITY</small></button>
        <button class="sm-world-orb orb-crisis" data-transition="transition-new52"><span class="orb-ring"></span><b>FLASHPOINT</b><small>2011</small></button>
        <button class="sm-world-orb orb-metal" data-transition="transition-infinite"><span class="orb-ring"></span><b>DARK NIGHTS: METAL</b><small>2017</small></button>
        <button class="sm-world-orb orb-earth2" data-world="multiverse"><span class="orb-ring"></span><b>EARTH-2</b><small>ALTERNATE EARTH</small></button>
        <button class="sm-world-orb orb-magic" data-world="multiverse"><span class="orb-ring"></span><b>MAGIC / DARK</b><small>JUSTICE LEAGUE DARK</small></button>
        <button class="sm-world-orb orb-cosmic" data-world="multiverse"><span class="orb-ring"></span><b>COSMIC</b><small>LANTERN CORPS</small></button>
        <span class="sm-map-trail trail-a"></span><span class="sm-map-trail trail-b"></span><span class="sm-map-trail trail-c"></span><span class="sm-map-trail trail-d"></span>
        <div class="sm-map-landmark lm-bat"><b>BATMAN</b><small>GOTHAM</small></div><div class="sm-map-landmark lm-sup"><b>SUPERMAN</b><small>METROPOLIS</small></div><div class="sm-map-landmark lm-jl"><b>JUSTICE LEAGUE</b><small>CORE</small></div><div class="sm-map-landmark lm-gl"><b>GREEN LANTERN</b><small>COSMIC</small></div>
      </div>
      <button class="sm-enter-new52" data-open-new52><span>ENTER THE NEW 52</span><b>2011–2016</b><i>↗</i></button>
    </section>
    <section class="sm-timeline-deck"><div class="sm-deck-head"><span>DC UNIVERSE TIMELINE</span><b>Follow the continuity spine</b><small>Every era is a portal. Every transition is an event.</small></div><div class="sm-era-ribbon sm-era-ribbon-large">${erasTop.map((e,i)=>`<button class="sm-era-pill ${e.id==='new52'?'is-hot':''}" data-era="${esc(e.id)}"><span>${String(eras.length-i).padStart(2,'0')}</span><b>${esc(e.title)}</b><small>${esc(e.years||'')}</small></button>`).join('')}</div></section>
    <section class="sm-map-exploration-grid">
      <article class="sm-map-panel sm-panel-events"><div class="sm-panel-head"><span>FEATURED EVENTS</span><b>Moments that reshaped reality</b><button data-world="events">View all ↗</button></div><div class="sm-event-cards">${events.slice(0,6).map((e,i)=>`<button class="sm-event-art-card" data-transition="${esc(e.id)}"><span class="event-art event-art-${i%6}"><i>${i+1}</i></span><b>${esc(e.title)}</b><small>${esc(e.issues?.[0]||'Major continuity event')}</small></button>`).join('')}</div></article>
      <article class="sm-map-panel sm-panel-worlds"><div class="sm-panel-head"><span>WORLDS & EARTHS</span><b>There is more than one DC</b><button data-world="multiverse">Explore ↗</button></div><div class="sm-earth-cards"><button data-world="multiverse"><span class="earth-art ea2"></span><b>Earth-2</b><small>Alternate continuity</small></button><button data-world="multiverse"><span class="earth-art ea3"></span><b>Earth-3</b><small>Crime Syndicate</small></button><button data-world="multiverse"><span class="earth-art emu"></span><b>Multiverse</b><small>Elseworlds & parallel worlds</small></button></div></article>
    </section>
    <section class="sm-map-fan-deck"><button data-mode="characters"><span>CHARACTERS</span><b>Walk into Gotham, Metropolis, Central City and beyond.</b><i>Explore ↗</i></button><button data-mode="paths"><span>READING PATHS</span><b>Follow a character, a family, a team or a crossover.</b><i>Explore ↗</i></button><button data-mode="new52"><span>THE NEW 52</span><b>Enter the fully researched publication world.</b><i>Explore ↗</i></button></section>
  </div>`;
}
function renderNew52(){
  const lanes=[...new52Era.mainLanes,...new52Era.alternateLanes];
  return `<div class="sm-atlas sm-new52-atlas sm-immersive">
    <div class="sm-cosmic-backdrop new52-backdrop"><span class="nebula n1"></span><span class="nebula n2"></span><span class="city-haze"></span><span class="starfield"></span></div>
    <section class="sm-new52-hero"><div class="sm-new52-copy"><span class="sm-eyebrow">THE NEW 52 · 2011–2016</span><h1>One universe. Dozens of worlds within it.</h1><p>Start in Earth-0, choose a territory, then descend into the actual runs, issues and collected editions.</p><div class="sm-new52-stats"><span><b>${new52Series.length}</b><small>RUNS</small></span><span><b>${new52Limited.length}</b><small>LIMITED / SPECIAL</small></span><span><b>${crossoverSpine.length}</b><small>CROSSOVERS</small></span></div></div><div class="sm-new52-sigil"><div class="sigil-ring r1"></div><div class="sigil-ring r2"></div><div class="sigil-core"><b>52</b><small>EARTH-0</small></div><i></i><i></i><i></i></div></section>
    <section class="sm-territory-atlas"><div class="sm-deck-head"><span>THE NEW 52 WORLD</span><b>Choose your territory</b><small>Every card is connected to the same publication dataset.</small></div><div class="sm-territory-map">${lanes.map((l,i)=>territory(l,i)).join('')}<button class="sm-territory territory-void sm-multiverse-zone" data-lane="alternate"><span class="territory-index">∞</span><span class="territory-aura"></span><span class="territory-copy"><small>PARALLEL WORLDS</small><b>Alternate Earths</b><em>Earth-2 · Worlds’ Finest · Multiversity · Convergence</em><span class="territory-books">${new52Series.filter(s=>s.lane==='alternate').slice(0,4).map(s=>esc(s.title)).join(' · ')}</span></span><strong>ENTER</strong></button><button class="sm-territory territory-future" data-lane="future"><span class="territory-index">∞</span><span class="territory-aura"></span><span class="territory-copy"><small>TIME / CONTINUATION</small><b>Future & DC You</b><em>Futures End · Batman Beyond · Justice League 3001</em></span><strong>ENTER</strong></button></div></section>
    <section class="sm-crossroads sm-map-panel"><div class="sm-panel-head"><span>CROSSOVER CONSTELLATION</span><b>Where the territories touch</b><button data-mode="paths">Use in a reading path ↗</button></div><div class="sm-crossroad-line">${crossoverSpine.map((e,i)=>`<button class="sm-crossroad" data-cross="${esc(e.id)}"><i></i><span>${String(i+1).padStart(2,'0')}</span><b>${esc(e.title)}</b><small>${esc(e.issues)}</small></button>`).join('')}</div></section>
  </div>`;
}
function renderCharacters(){
  const heroes=new52CharacterHubs.filter(x=>x.type==='hero'), groups=new52CharacterHubs.filter(x=>x.type==='group');
  return `<div class="sm-atlas sm-character-atlas">${eraRibbon()}<section class="sm-atlas-heading"><span class="sm-eyebrow">NEW 52 · CHARACTER ATLAS</span><h1>Who do you want to follow?</h1><p>Start with a flagship character, or enter a family / team region. Every destination resolves to the same New 52 runs, issues and collected editions as the map.</p></section><section><div class="sm-section-title"><span>FLAGSHIP CHARACTERS</span><b>Standalone lines</b></div><div class="sm-hero-grid">${heroes.map(h=>characterCard(h)).join('')}</div></section><section><div class="sm-section-title"><span>CHARACTER REGIONS</span><b>Grouped supporting runs</b></div><div class="sm-group-grid">${groups.map(h=>characterCard(h)).join('')}</div></section></div>`;
}
function characterCard(h){const pubs=h.seriesIds.map(seriesById).filter(Boolean);return `<button class="sm-character-card ${h.type==='group'?'is-group':''}" data-character="${esc(h.id)}"><span class="char-symbol">${h.type==='hero'?'◆':'◇'}</span><span><small>${h.type==='hero'?'CHARACTER':'REGION'}</small><b>${esc(h.title)}</b><em>${pubs.length} mapped publications</em></span><strong>→</strong></button>`;}

function renderContinuity(){
  return `<div class="sm-atlas sm-continuity-atlas">${eraRibbon()}<section class="sm-atlas-heading"><span class="sm-eyebrow">CONTINUITY / ERA</span><h1>See where every story sits.</h1><p>The same era spine drives the Story Map. The New 52 is the currently researched world; other eras remain navigational anchors until their layers are researched.</p></section><div class="sm-timeline-stack">${eras.map((e,i)=>{const tr=eras[i+1]?transitionFor(eras[i+1].id,e.id):null;return `<div class="sm-era-row"><button class="sm-era-large ${e.id==='new52'?'is-researched':''}" data-era="${esc(e.id)}"><span>${String(i+1).padStart(2,'0')}</span><small>${esc(e.years||'')}</small><b>${esc(e.title)}</b><em>${e.id==='new52'?'RESEARCHED WORLD':'NAVIGATION ANCHOR'}</em></button>${eras[i+1]?`<button class="sm-transition-inline" data-transition="${esc(tr?.id||'')}"><i></i><span>${tr?esc(tr.title):'CONTINUITY CONTINUES'}</span><b>↓</b></button>`:''}</div>`;}).join('')}</div></div>`;
}
function renderPaths(){
  return `<div class="sm-atlas sm-path-atlas">${eraRibbon()}<section class="sm-atlas-heading"><span class="sm-eyebrow">NEW 52 · READING PATHS</span><h1>Choose your route through the universe.</h1><p>Paths are lenses over the same publication data. They never replace the individual runs or turn issues into map nodes.</p></section><div class="sm-path-grid">${new52ReadingPaths.map((p,i)=>{const series=p.laneIds.flatMap(id=>new52Series.filter(s=>s.lane===id));return `<button class="sm-path-card" data-path="${esc(p.id)}"><span class="path-no">${String(i+1).padStart(2,'0')}</span><span><small>${esc(p.type||'PATH')}</small><b>${esc(p.title)}</b><em>${esc(p.sub)}</em><strong>${series.length} runs · ${p.eventIds.length} event stops</strong></span><i>↗</i></button>`;}).join('')}</div></div>`;
}

function onWorldClick(e){
  if(!state||state.suppressClick)return;
  const mode=e.target.closest('[data-mode]'); if(mode){navigate(mode.dataset.mode);return;}
  const enter=e.target.closest('[data-open-new52]'); if(enter){navigate('new52');return;}
  const world=e.target.closest('[data-world]'); if(world){handleWorld(world.dataset.world);return;}
  const era=e.target.closest('[data-era]'); if(era){openEra(era.dataset.era);return;}
  const tr=e.target.closest('[data-transition]'); if(tr&&tr.dataset.transition){const x=transitionEvents.find(v=>v.id===tr.dataset.transition);if(x)showDetail('event',x);return;}
  const lane=e.target.closest('[data-lane]'); if(lane){openLane(lane.dataset.lane);return;}
  const cross=e.target.closest('[data-cross]'); if(cross){const x=crossoverSpine.find(v=>v.id===cross.dataset.cross);if(x)showDetail('event',x);return;}
  const ch=e.target.closest('[data-character]'); if(ch){openCharacter(ch.dataset.character);return;}
  const path=e.target.closest('[data-path]'); if(path){openPath(path.dataset.path);return;}
}
function openEra(id){if(id==='new52'){navigate('new52');return;}const e=eras.find(x=>x.id===id);if(e)showDetail('era',e);}
function openLane(id){const l=laneFor(id);if(!l)return;const pubs=allPubs().filter(s=>s.lane===id);showDetail('lane',{...l,publications:pubs});}
function openCharacter(id){const c=new52CharacterHubs.find(x=>x.id===id);if(c)showDetail('character',c);}
function openPath(id){const p=new52ReadingPaths.find(x=>x.id===id);if(p)showDetail('path',p);}
function showDetail(type,data){state.selected=data;state.detailType=type;detail.dataset.open='true';root.dataset.detail='true';renderDetail(type,data);}
function renderDetail(type,d){
  const body=detail.querySelector('#smDetailBody');
  if(type==='series'){renderSeriesDetail(d);return;}
  if(type==='event'){body.innerHTML=eventDetail(d);wireDetail();return;}
  if(type==='era'){body.innerHTML=eraDetail(d);wireDetail();return;}
  if(type==='lane'){body.innerHTML=laneDetail(d);wireDetail();return;}
  if(type==='character'){body.innerHTML=characterDetail(d);wireDetail();return;}
  if(type==='path'){body.innerHTML=pathDetail(d);wireDetail();return;}
}
function detailHead(k,title,sub=''){return `<div class="sm-d-kicker">${esc(k)}</div><h2 class="sm-d-title">${esc(title)}</h2>${sub?`<p class="sm-d-desc">${esc(sub)}</p>`:''}`;}
function pubRows(pubs){return `<div class="sm-d-series-grid">${pubs.map(s=>`<button class="sm-d-series" data-detail-series="${esc(s.id)}"><span><small>${issueCount(s)} issues</small><b>${esc(s.title)}</b><em>${formats(s).join(' · ')||'Edition research pending'}</em></span><i>→</i></button>`).join('')}</div>`;}
function laneDetail(l){return detailHead('NEW 52 · TERRITORY',l.title,l.sub)+`<div class="sm-d-stats"><span><b>${l.publications.length}</b><small>PUBLICATIONS</small></span><span><b>${l.publications.reduce((n,s)=>n+issueCount(s),0)}</b><small>ISSUES</small></span></div><section class="sm-d-section"><div class="sm-d-section-title">ENTER A RUN</div>${pubRows(l.publications)}</section>`;}
function characterDetail(c){const pubs=c.seriesIds.map(seriesById).filter(Boolean);return detailHead(c.type==='hero'?'CHARACTER':'CHARACTER REGION',c.title,c.sub)+`<div class="sm-d-stats"><span><b>${pubs.length}</b><small>PUBLICATIONS</small></span><span><b>${pubs.reduce((n,s)=>n+issueCount(s),0)}</b><small>ISSUES</small></span></div><section class="sm-d-section"><div class="sm-d-section-title">NEW 52 RUNS</div>${pubRows(pubs)}</section>`;}
function eraDetail(e){const tr=eras.find(x=>x.id===e.id);return detailHead('CONTINUITY ERA',e.title,e.years)+`<div class="sm-era-note"><b>${e.id==='new52'?'This world is fully navigable.':'Navigation anchor'}</b><span>${e.id==='new52'?'Enter The New 52 to explore lanes, characters, events, issues and editions from the researched dataset.':'The detailed layer for this era has not been researched in this build yet; it remains visible so the chronological spine is honest.'}</span></div>${e.id==='new52'?`<button class="sm-detail-primary" data-mode="new52">Enter The New 52 ↗</button>`:''}`;}
function eventDetail(e){const editions=e.editions||[];return detailHead(e.kicker||'EVENT',e.title,e.summary||e.notes||'')+`${e.issues?.length?`<section class="sm-d-section"><div class="sm-d-section-title">CORE COMICS</div><div class="sm-issue-list">${e.issues.map(x=>`<span>${esc(x)}</span>`).join('')}</div></section>`:''}${editions.length?`<section class="sm-d-section"><div class="sm-d-section-title">PUBLISHED FORMATS</div><div class="sm-pub-list">${editions.map(x=>`<article><small>${esc(x.format)}</small><b>${esc(x.title)}</b><span>${esc(x.coverage)}</span></article>`).join('')}</div></section>`:''}`;}
function pathDetail(p){const pubs=p.laneIds.flatMap(id=>new52Series.filter(s=>s.lane===id));const events=p.eventIds.map(id=>crossoverSpine.find(e=>e.id===id)).filter(Boolean);return detailHead('READING PATH',p.title,p.sub)+`<div class="sm-d-stats"><span><b>${pubs.length}</b><small>RUNS</small></span><span><b>${events.length}</b><small>EVENT STOPS</small></span></div><section class="sm-d-section"><div class="sm-d-section-title">PUBLICATION TERRITORIES</div>${pubRows(pubs)}</section><section class="sm-d-section"><div class="sm-d-section-title">CROSSOVER STOPS</div><div class="sm-pub-list">${events.map((e,i)=>`<button class="sm-event-detail-row" data-detail-event="${esc(e.id)}"><b>${i+1}. ${esc(e.title)}</b><span>${esc(e.issues)}</span></button>`).join('')}</div></section>`;}
function renderSeriesDetail(s){state.selected=s;state.detailType='series';detail.dataset.open='true';root.dataset.detail='true';const body=detail.querySelector('#smDetailBody');const lane=laneFor(s.lane);const fs=formats(s).sort((a,b)=>formatOrder.indexOf(a)-formatOrder.indexOf(b));body.innerHTML=detailHead('NEW 52 · RUN',s.title,s.notes||s.kind||'Publication run')+`<div class="sm-d-stats"><span><b>${issueCount(s)}</b><small>ISSUES MAPPED</small></span><span><b>${esc(s.runYears||'2011–2016')}</b><small>RUN</small></span><span><b>${fs.length||0}</b><small>FORMATS</small></span></div><div class="sm-d-meta-line"><b>Territory</b><span>${esc(lane?.title||s.lane)}</span></div><section class="sm-d-section"><div class="sm-d-section-title">ISSUE RUN</div><div class="sm-issue-list">${(s.issues||[]).map(x=>`<span>#${esc(x)}</span>`).join('')}</div></section><section class="sm-d-section"><div class="sm-d-section-title">COLLECTED EDITIONS</div>${fs.length?`<div class="sm-format-tabs">${fs.map((f,i)=>`<button data-format="${esc(f)}" class="${i===0?'is-active':''}">${esc(f)}</button>`).join('')}</div><div id="smFormatPanel"></div>`:`<div class="sm-no-editions">No verified collected-edition record is entered for this publication yet. The issue run remains visible; no format is invented.</div>`}</section>`;paintFormats(s,fs[0]);wireDetail();}
function paintFormats(s,f){const panel=detail.querySelector('#smFormatPanel');if(!panel||!f)return;const rows=(s.collections||[]).filter(x=>formatKey(x.format)===f);panel.innerHTML=rows.map(c=>`<article class="sm-edition"><small>${esc(c.format)}</small><b>${esc(c.title)}</b><strong>${esc(c.coverage)}</strong>${c.notes?`<span>${esc(c.notes)}</span>`:''}</article>`).join('')||`<div class="sm-no-editions">No verified ${esc(f)} edition is entered for this publication.</div>`;detail.querySelectorAll('[data-format]').forEach(b=>b.classList.toggle('is-active',b.dataset.format===f));}
function wireDetail(){
  detail.querySelectorAll('[data-detail-series]').forEach(b=>b.onclick=()=>{const s=seriesById(b.dataset.detailSeries);if(s)renderSeriesDetail(s);});
  detail.querySelectorAll('[data-format]').forEach(b=>b.onclick=()=>{const s=state.selected;if(state.detailType==='series')paintFormats(s,b.dataset.format);});
  detail.querySelectorAll('[data-detail-event]').forEach(b=>b.onclick=()=>{const x=crossoverSpine.find(e=>e.id===b.dataset.detailEvent);if(x)showDetail('event',x);});
  detail.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>navigate(b.dataset.mode));
}

window.__comicsStoryMap={open,close,navigate,isOpen:()=>!!(root&&root.dataset.open==='true'),audit:()=>auditNew52()};
document.dispatchEvent(new CustomEvent('comicsv2:storymap-ready'));
