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
} from './new52-map-data.js?v=20260928-map4';

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
  state={mode,selected:null,detailType:null,character:null,path:null,view:{k:1,x:0,y:0},drag:null,pointers:new Map()};
}
function shell(){
  if(root)return;
  root=document.createElement('div'); root.id='storyMap'; root.className='sm-root'; root.dataset.open='false';
  root.innerHTML=`
    <header class="sm-topbar">
      <button class="sm-icon-btn" id="smBack" aria-label="Back">←</button>
      <div class="sm-heading"><div class="sm-kicker">DC UNIVERSE ATLAS</div><div class="sm-crumbs" id="smCrumbs">Universe</div></div>
      <div class="sm-mode-nav" id="smModeNav">
        <button data-mode="universe">Universe</button><button data-mode="new52">New 52</button><button data-mode="characters">Characters</button><button data-mode="continuity">Eras</button><button data-mode="paths">Paths</button>
      </div>
      <button class="sm-icon-btn" id="smClose" aria-label="Close story map">✕</button>
    </header>
    <main class="sm-stage" id="smStage" tabindex="0" aria-label="Interactive DC Universe atlas"><div class="sm-world" id="smWorld"></div></main>
    <div class="sm-atlas-tools"><button data-tool="out">−</button><button data-tool="in">+</button><button data-tool="fit">Fit</button><button data-tool="reset">Reset</button></div>
    <aside class="sm-detail" id="smDetail" data-open="false"><div class="sm-detail-handle"></div><button class="sm-icon-btn sm-detail-close" id="smDetailClose">✕</button><div id="smDetailBody"></div></aside>`;
  document.body.appendChild(root); stage=root.querySelector('#smStage'); detail=root.querySelector('#smDetail');
  root.querySelector('#smClose').onclick=close; root.querySelector('#smBack').onclick=back; root.querySelector('#smDetailClose').onclick=()=>closeDetail();
  root.querySelector('#smModeNav').onclick=e=>{const b=e.target.closest('[data-mode]');if(b)navigate(b.dataset.mode);};
  root.querySelector('.sm-atlas-tools').onclick=e=>{const b=e.target.closest('[data-tool]');if(!b)return; if(b.dataset.tool==='in')zoom(1.18,stage.clientWidth/2,stage.clientHeight/2);if(b.dataset.tool==='out')zoom(.85,stage.clientWidth/2,stage.clientHeight/2);if(b.dataset.tool==='fit')fit();if(b.dataset.tool==='reset')reset();};
  stage.addEventListener('click',onWorldClick);
  stage.addEventListener('pointerdown',pointerDown); stage.addEventListener('pointermove',pointerMove); stage.addEventListener('pointerup',pointerEnd); stage.addEventListener('pointercancel',pointerEnd);
  stage.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.08:.92,e.clientX-stage.getBoundingClientRect().left,e.clientY-stage.getBoundingClientRect().top);},{passive:false});
  window.addEventListener('resize',()=>{if(root.dataset.open==='true'){render();requestAnimationFrame(fit);}});
}
function pointerDown(e){if(e.target.closest('button,.sm-detail'))return;state.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(state.pointers.size===1){state.drag={x:e.clientX,y:e.clientY,ox:state.view.x,oy:state.view.y};stage.setPointerCapture?.(e.pointerId);stage.classList.add('sm-dragging');}}
function pointerMove(e){if(!state.pointers.has(e.pointerId)||state.pointers.size!==1||!state.drag)return;state.view.x=state.drag.ox+e.clientX-state.drag.x;state.view.y=state.drag.oy+e.clientY-state.drag.y;applyView(false);}
function pointerEnd(e){state.pointers.delete(e.pointerId);if(!state.pointers.size){state.drag=null;stage.classList.remove('sm-dragging');}}
function zoom(f,cx,cy){const old=state.view.k,next=Math.max(.72,Math.min(1.65,old*f)),r=next/old;state.view.x=cx-(cx-state.view.x)*r;state.view.y=cy-(cy-state.view.y)*r;state.view.k=next;applyView(true);}
function applyView(anim=true){const w=root.querySelector('#smWorld');if(!w)return;w.classList.toggle('sm-animate',anim);w.style.transform=`translate3d(${state.view.x}px,${state.view.y}px,0) scale(${state.view.k})`;if(anim)setTimeout(()=>w.classList.remove('sm-animate'),260);}
function fit(){if(!state||!root)return;state.view={k:1,x:0,y:0};const w=root.querySelector('#smWorld');if(!w)return;const sr=stage.getBoundingClientRect(),ww=Math.max(w.scrollWidth,w.offsetWidth),hh=Math.max(w.scrollHeight,w.offsetHeight);const k=Math.min((sr.width-24)/ww,(sr.height-24)/hh,1);state.view.k=Math.max(.72,Math.min(1,k));state.view.x=(sr.width-ww*state.view.k)/2;state.view.y=Math.max(8,(sr.height-hh*state.view.k)/2);applyView(true);}
function reset(){state.view={k:1,x:0,y:0};applyView(true);}
function open(mode='universe'){shell();session(mode);root.dataset.open='true';document.documentElement.classList.add('sm-lock');render();requestAnimationFrame(fit);}
function close(){if(!root)return;root.dataset.open='false';document.documentElement.classList.remove('sm-lock');state=null;}
function closeDetail(){if(!state)return;state.selected=null;state.detailType=null;detail.dataset.open='false';root.dataset.detail='false';}
function back(){if(state?.selected){closeDetail();return;}if(state?.mode!=='universe'){navigate('universe');return;}close();}
function navigate(mode){if(!state)return;closeDetail();state.mode=mode;state.character=null;state.path=null;render();requestAnimationFrame(fit);}

function render(){
  if(!state)return;
  root.dataset.mode=state.mode;
  root.querySelectorAll('#smModeNav [data-mode]').forEach(b=>b.classList.toggle('is-active',b.dataset.mode===state.mode));
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
  return `<div class="sm-atlas sm-universe-atlas">
    ${eraRibbon()}
    <section class="sm-universe-hero"><div class="sm-hero-copy"><span class="sm-eyebrow">DC CONTINUITY ATLAS</span><h1>Enter the DC Universe.</h1><p>Chronology is the spine. Worlds, characters and stories are the places you explore.</p><div class="sm-hero-actions"><button class="sm-primary" data-open-new52>Enter The New 52</button><button class="sm-secondary" data-mode="characters">Explore characters</button></div></div><div class="sm-orbit"><div class="sm-orbit-ring ring-a"></div><div class="sm-orbit-ring ring-b"></div><div class="sm-orbit-core"><span>DC</span><b>UNIVERSE</b><small>EARTH-0 + MULTIVERSE</small></div><i class="orbit-dot d1"></i><i class="orbit-dot d2"></i><i class="orbit-dot d3"></i><i class="orbit-dot d4"></i></div></section>
    <section class="sm-continuity-gates"><div class="sm-section-title"><span>THE CONTINUITY SPINE</span><b>Follow the gates</b></div><div class="sm-gate-grid">${eras.map((e,i)=>{const next=eras[i+1],tr=next?transitionFor(next.id,e.id):null;return `<article class="sm-gate"><button class="sm-era-portal" data-era="${esc(e.id)}"><span class="sm-era-no">${String(i+1).padStart(2,'0')}</span><span><small>${esc(e.years||'')}</small><strong>${esc(e.title)}</strong></span><em>${e.id==='new52'?'EXPLORE':'ENTER'}</em></button>${next?`<button class="sm-transition-gate" data-transition="${esc(tr?.id||'')}"><span class="gate-line"></span><span class="gate-node">${tr?'✦':'·'}</span><span class="gate-copy">${tr?`<small>${esc(tr.kicker||'TRANSITION')}</small><b>${esc(tr.title)}</b>`:'CONTINUITY CONTINUES'}</span><span class="gate-arrow">↓</span></button>`:''}</article>`;}).join('')}</div></section>
    <section class="sm-event-constellation"><div class="sm-section-title"><span>MAJOR GATES</span><b>Events that changed the shape of DC</b></div><div class="sm-event-row">${events.map(e=>`<button class="sm-event-chip" data-transition="${esc(e.id)}"><span class="event-orb"></span><span><b>${esc(e.title)}</b><small>${esc(e.issues?.[0]||'')}</small></span></button>`).join('')}</div></section>
  </div>`;
}

const laneTheme={justice:'justice',batman:'gotham',superman:'metropolis',lantern:'cosmic',young:'titans',dark:'magic',edge:'edge',alternate:'rift',future:'future'};
function renderNew52(){
  const lanes=new52Era.mainLanes;
  const stats={series:new52Series.length,limited:new52Limited.length,issues:new52Series.reduce((n,s)=>n+issueCount(s),0)+new52Limited.reduce((n,s)=>n+issueCount(s),0),editions:new52Series.reduce((n,s)=>n+(s.collections?.length||0),0)+new52Limited.reduce((n,s)=>n+(s.collections?.length||0),0)};
  return `<div class="sm-atlas sm-new52-atlas">
    ${eraRibbon()}
    <section class="sm-world-hero"><div class="sm-hero-copy"><span class="sm-eyebrow">2011 — 2016 · EARTH-0</span><h1>The New 52</h1><p>${esc(new52Era.description)}</p><div class="sm-stat-strip"><span><b>${stats.series}</b><small>ONGOING RUNS</small></span><span><b>${stats.limited}</b><small>LIMITED / EVENTS</small></span><span><b>${stats.issues}</b><small>ISSUE RECORDS</small></span><span><b>${stats.editions}</b><small>EDITION RECORDS</small></span></div></div><div class="sm-earth-core"><div class="sm-earth-glow"></div><div class="sm-earth-label"><small>PRIMARY WORLD</small><b>EARTH-0</b><span>NEW 52</span></div></div></section>
    <section class="sm-world-map"><div class="sm-section-title"><span>THE WORLD</span><b>Choose where you want to go</b></div><div class="sm-territory-grid">${lanes.map((l,i)=>territory(l,i)).join('')}</div><div class="sm-rift-row"><button class="sm-rift-card" data-lane="alternate"><span class="sm-rift-icon">◈</span><span><small>PARALLEL EARTHS</small><b>Alternate Worlds</b><em>Earth-2 · Worlds’ Finest · Multiversity · Convergence</em></span><strong>↗</strong></button><button class="sm-rift-card" data-lane="future"><span class="sm-rift-icon">◌</span><span><small>TIME / CONTINUATION</small><b>Future & DC You</b><em>Futures End · Batman Beyond · Justice League 3001</em></span><strong>↗</strong></button></div></section>
    <section class="sm-crossroads"><div class="sm-section-title"><span>CROSSOVER CONSTELLATION</span><b>The events that make the lanes touch</b></div><div class="sm-crossroad-line">${crossoverSpine.map((e,i)=>`<button class="sm-crossroad" data-cross="${esc(e.id)}"><i></i><span>${String(i+1).padStart(2,'0')}</span><b>${esc(e.title)}</b><small>${esc(e.issues)}</small></button>`).join('')}</div></section>
    <section class="sm-explore-decks"><button data-mode="characters"><span>♟</span><b>Character Atlas</b><small>Flagship heroes + logical character groups</small></button><button data-mode="paths"><span>↝</span><b>Reading Paths</b><small>Follow a route through lanes and crossovers</small></button><button data-mode="continuity"><span>◉</span><b>Continuity</b><small>Return to the chronological spine</small></button></section>
  </div>`;
}
function territory(l,i){
  const pubs=new52Series.filter(s=>s.lane===l.id), lim=new52Limited.filter(s=>s.lane===l.id); const theme=laneTheme[l.id]||'justice';
  const featured=pubs.slice(0,4);
  return `<button class="sm-territory territory-${theme}" data-lane="${esc(l.id)}"><span class="territory-index">${String(i+1).padStart(2,'0')}</span><span class="territory-aura"></span><span class="territory-copy"><small>${esc(l.title.split(' / ')[0])}</small><b>${esc(l.title)}</b><em>${pubs.length+lim.length} publications · ${pubs.reduce((n,s)=>n+issueCount(s),0)+lim.reduce((n,s)=>n+issueCount(s),0)} mapped issues</em><span class="territory-books">${featured.map(s=>esc(s.title)).join(' · ')}</span></span><strong>ENTER</strong></button>`;
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
  if(!state)return;
  const mode=e.target.closest('[data-mode]'); if(mode){navigate(mode.dataset.mode);return;}
  const enter=e.target.closest('[data-open-new52]'); if(enter){navigate('new52');return;}
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
