// game.js - main logic (ES module)
// Keep code defensive and modular. Initializes after DOMContentLoaded.
// NOTE: older browsers and some file:// contexts don't support `import ... assert { type: 'json' }`.
// Load data.json at runtime via fetch with a fallback to avoid syntax errors.

const FALLBACK_DATA = {
  "buildings": [
    {"name":"Дом v1","cost":{"wood":20},"shape":[0,1,3,4],"bonuses":{"maxPopulation":5},"requiredLevel":1},
    {"name":"Дом v2","cost":{"wood":50,"stone":20},"shape":[0,1,2,3,4,5],"bonuses":{"maxPopulation":10},"requiredLevel":2},
    {"name":"Академия","cost":{"wood":50,"stone":20,"iron":10},"shape":[0,1,2,3,4],"bonuses":{"researchMenu":true},"requiredLevel":1},
    {"name":"Казарма v1","cost":{"wood":20,"iron":10},"shape":[0,1,2,3,4,5],"bonuses":{"armyStorage":20},"requiredLevel":1},
    {"name":"Ферма v1","cost":{"wood":30},"shape":[1,2,4,5,7,8],"bonuses":{"foodProduction":10},"requiredLevel":1},
    {"name":"Ферма v2","cost":{"wood":60,"stone":20},"shape":[0,1,2,3,4,5,6,7,8],"bonuses":{"foodProduction":30},"requiredLevel":2},
    {"name":"Шахта v1","cost":{"stone":30,"iron":10},"shape":[3,4,5,6,7,8],"bonuses":{"ironProduction":5},"requiredLevel":1},
    {"name":"Шахта v2","cost":{"stone":80,"iron":40},"shape":[0,1,2,3,4,5,6,7,8],"bonuses":{"ironProduction":20},"requiredLevel":2},
    {"name":"Колодец","cost":{"stone":15},"shape":[4],"bonuses":{"water":10},"requiredLevel":1},
    {"name":"Пожарная станция","cost":{"wood":40,"stone":20},"shape":[0,1,3,4],"bonuses":{"fireProtection":true},"requiredLevel":3}
  ],
  "units": [
    {"name":"Отряд солдат v1","cost":{"people":50},"move":2,"range":5,"dmgMin":0,"dmgMax":50,"hp":[40,50],"arrivalTurns":1,"requiredLevel":1},
    {"name":"Элитный отряд v2","cost":{"people":50,"iron":20},"move":3,"range":7,"dmgMin":20,"dmgMax":50,"hp":[50,50],"arrivalTurns":3,"requiredLevel":2},
    {"name":"Танковый взвод","cost":{"people":500,"iron":150},"move":7,"range":15,"dmgMin":250,"dmgMax":250,"hp":[1000,1000],"arrivalTurns":10,"requiredLevel":2},
    {"name":"Артиллерия","cost":{"people":200,"iron":100},"move":1,"range":20,"dmgMin":100,"dmgMax":300,"hp":[200,200],"arrivalTurns":5,"requiredLevel":3},
    {"name":"Рокетчики","cost":{"people":100,"iron":50},"move":4,"range":10,"dmgMin":50,"dmgMax":150,"hp":[30,30],"arrivalTurns":4,"requiredLevel":2},
    {"name":"Самолеты","cost":{"people":300,"iron":200},"move":10,"range":15,"dmgMin":200,"dmgMax":400,"hp":[150,150],"arrivalTurns":8,"requiredLevel":4},
    {"name":"ПВО","cost":{"people":150,"iron":100},"move":1,"range":12,"dmgMin":100,"dmgMax":200,"hp":[250,250],"arrivalTurns":6,"requiredLevel":3},
    {"name":"Робот-артиллерия","cost":{"iron":100},"move":1,"range":18,"dmgMin":80,"dmgMax":220,"hp":[150,200],"arrivalTurns":0,"requiredLevel":1}
  ]
};

class Vec2{constructor(x,y){this.x=x;this.y=y}}

class BuildingDef{
  constructor(obj){Object.assign(this,obj)}
}

class UnitDef{constructor(obj){Object.assign(this,obj)}}

class BuildingInstance{
  constructor(def, x,y,shapeIndex){this.def=def;this.x=x;this.y=y;this.shapeIndex=shapeIndex;this.id=Math.random().toString(36).slice(2,9)}
}

class Game{
  constructor(){
    this.gridW=100;this.gridH=100;this.cellSize=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size'))||40;
    this.viewW=0;this.viewH=0;this.offsetX=0;this.offsetY=0;this.scale=1;
    this.gridData=new Array(this.gridW*this.gridH).fill(null); // store building id or null
    this.buildings={};// id->instance
    this.resources={wood:100,stone:100,iron:100,people:0,maxPeople:100,food:0,water:0}
    this.populationTimer=null;this.productionTimer=null;
    this.cityLevel=1;this.population=0;
    this.units=[];
    // defs will be set via initWithData after data.json is loaded (avoids import assert issues)
    this.buildingDefs=[];this.unitDefs=[];
  this.placingDef = null; // currently selected building for placement
    this.initDOM();this.attachEvents();this.startTimers();this.renderResources();this.renderGrid();
  }

  initWithData(data){
    const D = data || FALLBACK_DATA;
    this.buildingDefs = (D.buildings||[]).map(b=>new BuildingDef(b));
    this.unitDefs = (D.units||[]).map(u=>new UnitDef(u));
    // refresh UI
    this.renderGrid();this.renderResources();
    this.populateSidebar();
  }

  populateSidebar(){
    const listEl = document.getElementById('buildingList'); if(!listEl) return; listEl.innerHTML='';
    this.buildingDefs.forEach((b,idx)=>{
      if(b.requiredLevel>this.cityLevel) return; // hide locked
      const entry=document.createElement('div');entry.className='building-entry';entry.dataset.idx=idx;
      const name=document.createElement('div');name.textContent=b.name;
      const cost=document.createElement('div');cost.className='cost';cost.textContent=Object.entries(b.cost||{}).map(kv=>kv[0]+':'+kv[1]).join(', ');
      entry.appendChild(name);entry.appendChild(cost);
  entry.addEventListener('click', ()=>{ this.selectBuildingForPlace(idx); });
  // drag start for pointer events; add fallbacks and logs
  entry.addEventListener('pointerdown', (ev)=>{ console.log('pointerdown on entry', idx); ev.preventDefault(); this.startDragPlacement(ev, idx, entry); });
  entry.addEventListener('mousedown', (ev)=>{ console.log('mousedown fallback on entry', idx); ev.preventDefault(); this.startDragPlacement(ev, idx, entry); });
  entry.addEventListener('touchstart', (ev)=>{ console.log('touchstart fallback on entry', idx); ev.preventDefault(); this.startDragPlacement(ev.changedTouches ? ev.changedTouches[0] : ev, idx, entry); }, {passive:false});
      listEl.appendChild(entry);
    });
  }

  startDragPlacement(ev, idx, entryEl){
    const def=this.buildingDefs[idx]; if(!def) return;
    // create ghost element that follows cursor
    this.ghost = document.createElement('div'); this.ghost.className='ghost-building'; this.ghost.textContent = def.name; document.body.appendChild(this.ghost);
    this.placingDef = def;
  // pointer capture for reliability
  try{ entryEl.setPointerCapture(ev.pointerId); }catch(e){}
  const onMove = (e)=>{ /*console.debug('drag move', e.clientX, e.clientY)*/; this.updateDrag(e); };
  const onUp = (e)=>{ /*console.debug('drag up', e.clientX, e.clientY)*/; this.endDrag(e); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); try{ entryEl.releasePointerCapture(ev.pointerId); }catch(err){} };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
    // initial pos
    this.updateDrag(ev);
  }

  updateDrag(ev){
  if(this.ghost) { try{ this.ghost.style.left = ev.clientX+'px'; this.ghost.style.top = ev.clientY+'px'; }catch(e){} }
    // compute cell under cursor and show preview
    const pos=this.worldToCell(ev.clientX, ev.clientY);
    this.updatePlacementPreview(pos.cx, pos.cy);
  }

  endDrag(ev){
    if(this.ghost){ this.ghost.remove(); this.ghost=null; }
  try{ if(ev && ev.pointerId) { /* nothing */ } }catch(e){}
    const pos=this.worldToCell(ev.clientX, ev.clientY);
    if(this.placingDef && this.canAfford(this.placingDef.cost) && this.canPlaceShape(this.placingDef.shape,pos.cx,pos.cy)){
      this.spend(this.placingDef.cost); this.placeBuilding(this.placingDef,pos.cx,pos.cy);
    }
    this.clearPlacementPreview(); this.placingDef=null; const cancel=document.getElementById('cancelPlace'); if(cancel) cancel.classList.add('hidden');
    this.renderResources();
  }

  updatePlacementPreview(cx, cy){
    this.clearPlacementPreview(); if(!this.placingDef) return; const shape=this.placingDef.shape;
    const valid = this.canPlaceShape(shape,cx,cy);
    // create a preview overlay sized to bounding box
    const minX= Math.min(...shape.map(s=>s%3)); const maxX=Math.max(...shape.map(s=>s%3)); const minY=Math.min(...shape.map(s=>Math.floor(s/3))); const maxY=Math.max(...shape.map(s=>Math.floor(s/3)));
    const width = (maxX-minX+1)*this.cellSize; const height=(maxY-minY+1)*this.cellSize;
    const left = (cx + minX -1)*this.cellSize; const top = (cy + minY -1)*this.cellSize;
    const preview=document.createElement('div'); preview.className = 'preview-cell '+(valid? 'preview-valid':'preview-invalid'); preview.style.left = left+'px'; preview.style.top = top+'px'; preview.style.width = width+'px'; preview.style.height = height+'px'; this.gridEl.appendChild(preview); this._lastPreview = preview;
  }

  clearPlacementPreview(){ if(this._lastPreview){ this._lastPreview.remove(); this._lastPreview=null; } }

  selectBuildingForPlace(idx){
    const def=this.buildingDefs[idx]; if(!def) return; this.placingDef=def;
    const biName=document.getElementById('biName'); const biCost=document.getElementById('biCost'); const biBonuses=document.getElementById('biBonuses'); const cancel=document.getElementById('cancelPlace');
    if(biName) biName.textContent = def.name; if(biCost) biCost.textContent = 'Стоимость: '+JSON.stringify(def.cost); if(biBonuses) biBonuses.textContent = 'Бонусы: '+JSON.stringify(def.bonuses||{});
    if(cancel){ cancel.classList.remove('hidden'); cancel.onclick = ()=>{ this.placingDef=null; cancel.classList.add('hidden'); if(biName) biName.textContent='Выберите здание'; } }
  }

  initDOM(){
  this.gridEl=document.getElementById('grid');this.gridContainer=document.getElementById('gridContainer');
  this.resourcesEl=document.getElementById('resources');this.cityStatsEl=document.getElementById('cityStats');
  this.saveBtn=document.getElementById('saveBtn');this.loadBtn=document.getElementById('loadBtn');this.missionsBtn=document.getElementById('missionsBtn');
  this.battleModal=document.getElementById('battleModal');this.battleGrid=document.getElementById('battleGrid');this.battleLog=document.getElementById('battleLog');
  // compute grid size
  if(!this.gridEl || !this.gridContainer){ console.error('Missing #grid or #gridContainer in DOM. Ensure index.html layout matches expected IDs.'); return; }
  this.gridEl.style.width=(this.gridW*this.cellSize)+'px';this.gridEl.style.height=(this.gridH*this.cellSize)+'px';
  }

  attachEvents(){
  console.log('attachEvents: wiring UI events');
  document.addEventListener('wheel', (e)=>{e.preventDefault();this.onZoom(e)} ,{passive:false});
  document.addEventListener('keydown',(e)=>this.onKey(e));
  if(this.gridContainer) this.gridContainer.addEventListener('click', (e)=>this.onGridClick(e)); else console.warn('attachEvents: missing gridContainer');
  if(this.saveBtn) this.saveBtn.addEventListener('click', ()=>this.save()); else console.warn('attachEvents: missing saveBtn');
  if(this.loadBtn) this.loadBtn.addEventListener('click', ()=>this.load()); else console.warn('attachEvents: missing loadBtn');
  if(this.missionsBtn) this.missionsBtn.addEventListener('click', ()=>this.openMissions()); else console.warn('attachEvents: missing missionsBtn');
  const closeBtn = document.getElementById('closeBattle'); if(closeBtn) closeBtn.addEventListener('click',()=>this.closeBattle()); else console.warn('attachEvents: missing closeBattle');
  window.addEventListener('resize', ()=>this.renderGrid());
  }

  onZoom(e){
    const delta = -e.deltaY/500;let s = this.scale + delta; s=Math.min(2,Math.max(0.5,s));this.scale=s;this.updateTransform();
  }

  onKey(e){
    const step = 50;switch(e.key){case 'w':case 'ArrowUp': this.offsetY=Math.max(0,this.offsetY-step); break;case 's':case 'ArrowDown': this.offsetY=Math.min(this.gridH*this.cellSize - this.gridContainer.clientHeight, this.offsetY+step);break;case 'a':case 'ArrowLeft': this.offsetX=Math.max(0,this.offsetX-step);break;case 'd':case 'ArrowRight': this.offsetX=Math.min(this.gridW*this.cellSize - this.gridContainer.clientWidth, this.offsetX+step);break;}
    this.updateTransform();
  }

  updateTransform(){
    this.gridEl.style.transform = `translate(${-this.offsetX}px,${-this.offsetY}px) scale(${this.scale})`;
  }

  worldToCell(clientX,clientY){
  if(!this.gridEl) return {cx:-1, cy:-1};
  const rect=this.gridEl.getBoundingClientRect();
  const x = (clientX - rect.left + this.offsetX)/ (this.scale*this.cellSize);
  const y = (clientY - rect.top + this.offsetY)/ (this.scale*this.cellSize);
  if(!isFinite(x) || !isFinite(y)) return {cx:-1, cy:-1};
  return {cx:Math.floor(x), cy:Math.floor(y)};
  }

  onGridClick(e){
    // detect cell
    const pos=this.worldToCell(e.clientX,e.clientY);
    if(pos.cx<0||pos.cy<0||pos.cx>=this.gridW||pos.cy>=this.gridH) return;
    const idx=pos.cy*this.gridW+pos.cx;const bid=this.gridData[idx];
    if(bid){ // building clicked
      const inst=this.buildings[bid];if(!inst) return;
      const info = `${inst.def.name}\nBonuses: ${JSON.stringify(inst.def.bonuses)}`;
      if(confirm(info + '\nУничтожить?')){this.demolishBuilding(inst)}
    } else {
      // empty cell: if user selected a building from sidebar, place it here
      if(this.placingDef){ const def=this.placingDef; if(this.canAfford(def.cost) && this.canPlaceShape(def.shape,pos.cx,pos.cy)){ this.spend(def.cost); this.placeBuilding(def,pos.cx,pos.cy); this.placingDef=null; const cancel=document.getElementById('cancelPlace'); if(cancel) cancel.classList.add('hidden'); const biName=document.getElementById('biName'); if(biName) biName.textContent='Выберите здание'; } else { alert('Невозможно построить здесь или недостаточно ресурсов.'); } }
      // otherwise click does nothing
    }
    this.renderResources();
  }

  canAfford(cost){for(const k in cost){if((this.resources[k]||0) < cost[k]) return false}return true}
  spend(cost){for(const k in cost){this.resources[k]=(this.resources[k]||0)-cost[k]}}

  canPlaceShape(shape, cx,cy){
    // shape indexes 0-8 mapping to 3x3: 0:(-1,-1),1:(0,-1),2:(1,-1),3:(-1,0),4:(0,0),5:(1,0),6:(-1,1),7:(0,1),8:(1,1)
    for(const s of shape){const dx=(s%3)-1;const dy=Math.floor(s/3)-1; const x=cx+dx,y=cy+dy; if(x<0||y<0||x>=this.gridW||y>=this.gridH) return false; if(this.gridData[y*this.gridW+x]) return false;}return true
  }

  placeBuilding(def,cx,cy){
    // occupy cells
    const id='b_'+Math.random().toString(36).slice(2,9);
    const inst=new BuildingInstance(def,cx,cy,0);this.buildings[id]=inst;
    for(const s of def.shape){const dx=(s%3)-1;const dy=Math.floor(s/3)-1;const x=cx+dx,y=cy+dy;this.gridData[y*this.gridW+x]=id}
    // create DOM nodes for visible cells
    this.createBuildingDOM(id,inst);
    // apply bonuses
    this.applyBonuses(def.bonuses,true);
    return inst;
  }

  createBuildingDOM(id,inst){
    const def=inst.def;const el=document.createElement('div');el.className='building building-new '+this.cssForName(def.name);el.dataset.id=id;el.style.left=(inst.x*this.cellSize)+'px';el.style.top=(inst.y*this.cellSize)+'px';el.style.width=(this.cellSize* (this.boundingShapeWidth(def.shape)))+'px';el.style.height=(this.cellSize*(this.boundingShapeHeight(def.shape)))+'px';
    const inner=document.createElement('div');inner.className='inner';inner.textContent=def.name;el.appendChild(inner);
    this.gridEl.appendChild(el);
  }

  boundingShapeWidth(shape){let minX=9,maxX=-9;for(const s of shape){const x=(s%3);minX=Math.min(minX,x);maxX=Math.max(maxX,x);}return maxX-minX+1}
  boundingShapeHeight(shape){let minY=9,maxY=-9;for(const s of shape){const y=Math.floor(s/3);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}return maxY-minY+1}

  cssForName(name){if(name.includes('Дом')) return 'house'; if(name.includes('Ферма')) return 'farm'; if(name.includes('Шахта')) return 'mine'; if(name.includes('Академия')) return 'academy'; if(name.includes('Казарма')) return 'barracks'; return ''}

  demolishBuilding(inst){
    // remove from gridData
    for(const s of inst.def.shape){const dx=(s%3)-1;const dy=Math.floor(s/3)-1;const x=inst.x+dx,y=inst.y+dy; if(x>=0&&y>=0&&x<this.gridW&&y<this.gridH){const idx=y*this.gridW+x; if(this.gridData[idx]===inst.id) this.gridData[idx]=null}}
    // reverse bonuses
    this.applyBonuses(inst.def.bonuses,false);
    // remove DOM
    const el=this.gridEl.querySelector(`[data-id="${inst.id}"]`); if(el){el.classList.add('building-remove'); setTimeout(()=>el.remove(),350)}
    delete this.buildings[inst.id];
    this.renderResources();
  }

  applyBonuses(bonuses,apply=true){ if(!bonuses) return; for(const k in bonuses){ if(k==='maxPopulation'){ if(apply) this.resources.maxPeople += bonuses[k]; else this.resources.maxPeople -= bonuses[k]; } else if(k==='foodProduction'){ if(apply) this.resources.food += bonuses[k]; else this.resources.food -= bonuses[k]; } else if(k==='ironProduction'){ if(apply) this.resources.iron += bonuses[k]; else this.resources.iron -= bonuses[k]; } }
  }

  startTimers(){
    this.populationTimer=setInterval(()=>{this.tickPopulation()},3000);
    this.productionTimer=setInterval(()=>{this.tickProduction()},5000);
  }

  tickPopulation(){
    // if food & water positive and below maxPeople
    const needsMet = (this.resources.food>0);
    if(needsMet && this.population < this.resources.maxPeople){ this.population += 1; this.resources.people = this.population; }
    // level up
    if(this.population>1000 && this.cityLevel<2) this.cityLevel=2;
    if(this.population>5000 && this.cityLevel<3) this.cityLevel=3;
    this.renderResources();
  }

  tickProduction(){
    // simple production: resource increments if production bonuses present
    // farms increase wood? (we used foodProduction)
    if(this.resources.food>0) this.resources.wood += Math.floor(this.resources.food/10);
    if(this.resources.iron>0) this.resources.iron += Math.floor(this.resources.iron/50);
    this.renderResources();
  }

  renderResources(){
  // legacy info area
  this.resourcesEl && (this.resourcesEl.textContent = `Ресурсы — Дерево: ${this.resources.wood}  Камень: ${this.resources.stone}  Железо: ${this.resources.iron}`);
  const cw=document.getElementById('counterWood'); if(cw) cw.querySelector('.val').textContent = this.resources.wood;
  const cs=document.getElementById('counterStone'); if(cs) cs.querySelector('.val').textContent = this.resources.stone;
  const ci=document.getElementById('counterIron'); if(ci) ci.querySelector('.val').textContent = this.resources.iron;
  const cp=document.getElementById('counterPop'); if(cp) cp.querySelector('.val').textContent = `${this.population}/${this.resources.maxPeople}`;
  const cl=document.getElementById('counterCity'); if(cl) cl.querySelector('.val').textContent = `L${this.cityLevel}`;
  }

  renderGrid(){
    // virtualization: clear and render only visible cells region
    const containerRect=this.gridContainer.getBoundingClientRect();const viewW=Math.ceil(containerRect.width/ (this.cellSize*this.scale))+2;const viewH=Math.ceil(containerRect.height/(this.cellSize*this.scale))+2;
    // but for simplicity, we'll ensure at least initial cells exist as background cells for interaction
    this.gridEl.innerHTML='';
    // render visible rows/cols starting at offsetX/Y
    const startX = Math.floor(this.offsetX/this.cellSize); const startY = Math.floor(this.offsetY/this.cellSize);
    const endX = Math.min(this.gridW, startX+viewW); const endY = Math.min(this.gridH, startY+viewH);
    for(let y=startY;y<endY;y++){
      for(let x=startX;x<endX;x++){
        const cell=document.createElement('div');cell.className='cell empty';cell.style.left=(x*this.cellSize)+'px';cell.style.top=(y*this.cellSize)+'px';cell.style.width=this.cellSize+'px';cell.style.height=this.cellSize+'px';cell.dataset.x=x;cell.dataset.y=y;this.gridEl.appendChild(cell);
        const bid=this.gridData[y*this.gridW+x]; if(bid){const inst=this.buildings[bid]; if(inst){ /* create building overlay if not exists */ const bex=this.gridEl.querySelector(`[data-id="${bid}"]`); if(!bex){this.createBuildingDOM(bid,inst);} }
        }
      }
    }
    this.updateTransform();
  }

  save(){ const data={grid:this.gridData,buildings:this.buildings,resources:this.resources,pop:this.population,cityLevel:this.cityLevel}; localStorage.setItem('mdg_save',JSON.stringify(data)); alert('Сохранено в localStorage'); }
  load(){ const raw=localStorage.getItem('mdg_save'); if(!raw){alert('Нет сохранения');return} const data=JSON.parse(raw); this.gridData=data.grid; this.buildings=data.buildings; this.resources=data.resources; this.population=data.pop; this.cityLevel=data.cityLevel; // DOM rebuild
    this.renderGrid(); this.renderResources(); alert('Загружено'); }

  openMissions(){ this.battleModal.classList.remove('hidden'); this.startBattle(); }
  closeBattle(){ this.battleModal.classList.add('hidden'); }

  startBattle(){ // build simple 15x15 battle grid and populate with sample units
    this.battleGrid.innerHTML=''; this.battleLog.textContent='Начало миссии';
    for(let i=0;i<15*15;i++){const c=document.createElement('div');c.className='battle-cell';this.battleGrid.appendChild(c)}
    // place one unit for player and a few robots
    const player=document.createElement('div');player.className='unit soldier';player.textContent='Отряд';player.style.position='absolute';player.style.left='10%';player.style.top='10%';player.style.transition='transform 400ms linear';this.battleGrid.children[0].appendChild(player);
    const robot=document.createElement('div');robot.className='unit robot';robot.textContent='Робот';robot.style.position='absolute';robot.style.left='50%';robot.style.top='50%';this.battleGrid.children[200%15?200:10].appendChild(robot);
  }
}

// Initialize the game after DOM ready and after loading data.json. Use fetch with fallback.
document.addEventListener('DOMContentLoaded', async ()=>{
  const game = new Game();
  try{
    const resp = await fetch('data.json', {cache: 'no-store'});
    if(resp.ok){ const data = await resp.json(); game.initWithData(data); }
    else { console.warn('data.json fetch failed, using fallback data'); game.initWithData(FALLBACK_DATA); }
  }catch(err){ console.warn('failed to load data.json, using fallback', err); game.initWithData(FALLBACK_DATA); }
  window.game = game;
});
