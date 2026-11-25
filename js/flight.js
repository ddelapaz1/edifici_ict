/* Vol lliure: moviment en metres, orientació sense roll i límits propis de cada model. */
'use strict';

const FLIGHT_KEYS=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyC','ShiftLeft','ShiftRight']);
const FLIGHT={enabled:false, source:null, locking:false, keys:new Set(), angles:new THREE.Euler(0,0,0,'YXZ'),
  bounds:null, right:V(0,0,0), forward:V(0,0,0), move:V(0,0,0), pad:null, padButtons:[],
  padTimer:null, aimTimer:null, aim:null, drag:null, dragged:false};

function flightBounds(){
  const b=CFG.flightArea();
  return new THREE.Box3(V(b.x0-10,b.bottom,b.z0-10),V(b.x1+10,b.roof+10,b.z1+10));
}
function flightRotate(yaw,pitch){
  if(!yaw&&!pitch) return;
  const a=FLIGHT.angles, limit=Math.PI/2-0.01;
  a.y+=yaw; a.x=THREE.MathUtils.clamp(a.x+pitch,-limit,limit);
  camera.quaternion.setFromEuler(a);
  invalidate();
}
function flightMove(side,forward,vertical,distance){
  if(!side&&!forward&&!vertical) return;
  const f=FLIGHT;
  f.forward.set(0,0,-1).applyQuaternion(camera.quaternion);
  f.right.set(1,0,0).applyQuaternion(camera.quaternion);
  f.move.copy(f.forward).multiplyScalar(forward).addScaledVector(f.right,side);
  f.move.y+=vertical;
  f.move.clampLength(0,1);
  camera.position.addScaledVector(f.move,distance).clamp(f.bounds.min,f.bounds.max);
  requestFrame();
}
function flightPrecise(){ return FLIGHT.keys.has('ShiftLeft')||FLIGHT.keys.has('ShiftRight'); }
function flightInputFromKeys(){
  const keys=FLIGHT.keys, n=k=>Number(keys.has(k));
  return [n('ArrowRight')-n('ArrowLeft'),n('ArrowUp')-n('ArrowDown'),n('Space')-n('KeyC')];
}

function flightCandidates(){
  try{ return Array.from(navigator.getGamepads?.()||[]).filter(p=>p?.connected&&p.mapping==='standard'); }
  catch(_){ return []; }
}
function flightAxis(value){
  const dead=0.18, a=Math.abs(value||0);
  return a<=dead?0:Math.sign(value)*(a-dead)/(1-dead);
}
function flightPadInput(pad){
  const [x,y,lookX,lookY]=Array.from({length:4},(_,i)=>flightAxis(pad.axes[i]));
  const lift=(pad.buttons[7]?.value||0)-(pad.buttons[6]?.value||0);
  return {move:[x,-y,flightAxis(lift)],look:[lookX,lookY]};
}
function flightPollPad(){
  if(!FLIGHT.enabled||document.hidden||!document.hasFocus()||$('dialog[open]')) return;
  const pads=flightCandidates(), p=pads.find(p=>p.index===FLIGHT.pad)||pads[0];
  if(FLIGHT.source==='pad'&&p?.index!==FLIGHT.pad){ pauseFlight('Comandament desconnectat.'); FLIGHT.pad=null; FLIGHT.padButtons=[]; return; }
  if(!p){ FLIGHT.pad=null; FLIGHT.padButtons=[]; return; }
  if(FLIGHT.pad!==p.index){ FLIGHT.pad=p.index; FLIGHT.padButtons=[]; }
  const buttons=p.buttons.map(b=>b.pressed), pressed=i=>buttons[i]&&!FLIGHT.padButtons[i];
  const [selectPressed,pausePressed,openPressed]=[pressed(0),pressed(1),pressed(2)];
  FLIGHT.padButtons=buttons;
  if(!FLIGHT.source){
    if(selectPressed&&!FLIGHT.locking) startFlight('pad');
    return;
  }
  if(FLIGHT.source!=='pad') return;
  if(pausePressed){ pauseFlight(); return; }
  if(openPressed) flightToggleAim();
  else if(selectPressed) flightSelect();
  const {move,look}=flightPadInput(p);
  if(move.some(Boolean)||look.some(Boolean)) requestFrame();
}

function flightTick(dt){
  if(!FLIGHT.source) return false;
  const move=flightInputFromKeys(), pad=FLIGHT.source==='pad'&&flightCandidates().find(p=>p.index===FLIGHT.pad);
  let turning=false;
  if(pad){
    const input=flightPadInput(pad);
    for(let i=0;i<3;i++) move[i]=THREE.MathUtils.clamp(move[i]+input.move[i],-1,1);
    const [x,y]=input.look;
    turning=!!(x||y);
    if(turning) flightRotate(-x*2.1*dt,-y*2.1*dt);
  }
  const moving=move.some(Boolean);
  if(moving) flightMove(...move,dt*(flightPrecise()?0.62:3.1));
  return moving||turning;
}

function flightUI(message=''){
  const f=FLIGHT, hud=$('#flightHUD'), btn=$('#btnFlight'), aim=$('#flightAim');
  btn.setAttribute('aria-pressed',String(f.enabled));
  hud.hidden=!f.enabled; aim.hidden=!f.source;
  $('#view3d').classList.toggle('freeFlight',f.enabled);
  if(!f.enabled) return;
  const action=$('#flightAction'), label=$('#flightTarget'), target=f.aim;
  const hint={mouse:'Fletxes i roda · Espai / C · Maj per afinar · Esc per pausar',
    pad:'Estics per volar i mirar · Gallets per pujar i baixar · B per pausar',
    drag:'Arrossega per mirar · Fletxes i roda · Espai / C · Esc per pausar'};
  $('#flightHint').textContent=message||hint[f.source]||'Clica el visor o prem Retorn. Amb el comandament, prem A.';
  const of=target?.openId, leaf=target?.leaf;
  const name=leaf?leafName(leaf):target?.id?EL[target.id].name:'';
  label.textContent=name; label.hidden=!name;
  action.hidden=!(of||leaf);
  if(!action.hidden){
    const open=leaf?leafOpen(leaf):isOpen(of);
    const key=f.source==='pad'?'X':f.source?'E':'';
    action.textContent=(open?'Tancar':'Obrir')+(key?' ('+key+')':'');
    action.setAttribute('aria-label',(open?'Tancar ':'Obrir ')+name);
  }
}
function flightPosition(){
  if(!FLIGHT.enabled) return;
  const v=camera.view, x=v?.enabled?v.offsetX:0, y=v?.enabled?v.offsetY:0;
  const el=$('#view3d');
  el.style.setProperty('--flight-x',x+'px');
  el.style.setProperty('--flight-y',y+'px');
}

function enableFlight(){
  if(!sceneReady||FLIGHT.enabled) return;
  const f=FLIGHT, p=camera.position.clone(), q=camera.quaternion.clone();
  /* Buida la inèrcia d'òrbita abans de cedir el control de la càmera. */
  const damping=controls.enableDamping;
  controls.enableDamping=false; controls.update(); controls.enableDamping=damping;
  camera.position.copy(p); camera.quaternion.copy(q); controls.enabled=false;
  camAnim=null; WHEEL.d=0; down=null; hoverQueued=null;
  if(pendingClick){ clearTimeout(pendingClick.timer); pendingClick=null; }
  setHover(null); hideLeafChip(); $('#help').classList.add('hidden');
  setPanel('views',false); setPanel('eye',false);
  f.enabled=true; f.bounds=flightBounds(); f.aim=null;
  f.angles.setFromQuaternion(camera.quaternion,'YXZ'); f.angles.z=0;
  f.padTimer=setInterval(flightPollPad,60);
  flightPosition(); flightUI();
  announce('Vol lliure. Clica el visor o prem Retorn per començar.');
  renderer.domElement.focus({preventScroll:true});
  invalidate();
}
function startFlight(source){
  if(!FLIGHT.enabled) return;
  FLIGHT.source=source;
  FLIGHT.locking=false;
  camera.position.clamp(FLIGHT.bounds.min,FLIGHT.bounds.max);
  camera.quaternion.setFromEuler(FLIGHT.angles);
  renderer.domElement.focus({preventScroll:true});
  const message=source==='drag'?'Cursor disponible. Arrossega per mirar i clica per seleccionar.':'';
  flightUI(message);
  announce('Vol lliure actiu. Esc per pausar.');
  invalidate();
}
function pauseFlight(message=''){
  if(!FLIGHT.source&&!FLIGHT.locking) return false;
  if(FLIGHT.source) FLIGHT.aim=readFlightAim();
  FLIGHT.source=null; FLIGHT.locking=false; FLIGHT.keys.clear();
  clearTimeout(FLIGHT.aimTimer); FLIGHT.aimTimer=null;
  clearFlightDrag();
  if(document.pointerLockElement===renderer.domElement) document.exitPointerLock();
  flightUI(message||'Vol en pausa. Clica el visor o prem Retorn per reprendre.');
  announce(message||'Vol en pausa. Cursor disponible.');
  return true;
}
function exitFlight(){
  if(!FLIGHT.enabled) return;
  pauseFlight(); clearInterval(FLIGHT.padTimer); FLIGHT.padTimer=null;
  FLIGHT.enabled=false; FLIGHT.aim=null; FLIGHT.pad=null; FLIGHT.padButtons=[];
  /* L'òrbita gira al voltant d'un punt sota la càmera. */
  const pitch=Math.min(FLIGHT.angles.x,controls.maxPolarAngle-Math.PI/2);
  const dir=V(0,0,-1).applyEuler(new THREE.Euler(pitch,FLIGHT.angles.y,0,'YXZ'));
  controls.target.copy(camera.position).addScaledVector(dir,3);
  controls.enabled=true;
  flightUI(); announce('Vista orbital.'); invalidate();
}

function readFlightAim(){
  const r=renderer.domElement.getBoundingClientRect(), v=camera.view;
  const x=r.left+r.width/2-(v?.enabled?v.offsetX:0), y=r.top+r.height/2-(v?.enabled?v.offsetY:0);
  camera.updateMatrixWorld();
  const hit=leafAt(x,y,true), id=pickAt(x,y,{lookThrough:true,far:hit?hit.dist+0.02:Infinity});
  if(hit&&hit.dist<=pickAt.dist+0.02) return hit.leaf?{leaf:hit.leaf,id:hit.leaf.of}:null;
  if(!id) return null;
  const e=EL[id], openId=e.openOf||(e.lid?id:null);
  return {id,openId};
}
function queueFlightAim(){
  if(!FLIGHT.source||FLIGHT.aimTimer) return;
  /* El punt de mira s'avalua després del dibuix, amb l'oclusió temporal ja restaurada. */
  FLIGHT.aimTimer=setTimeout(()=>{
    FLIGHT.aimTimer=null;
    const prev=FLIGHT.aim, aim=FLIGHT.aim=readFlightAim();
    if(prev?.id!==aim?.id||prev?.leaf!==aim?.leaf||prev?.openId!==aim?.openId) flightUI();
  },85);
}
function flightSelect(){
  const aim=FLIGHT.aim=readFlightAim();
  if(aim?.id) select(aim.id);
  else if(!aim&&!Q.active) select(null);
  flightUI();
}
function flightToggleAim(){
  const aim=FLIGHT.aim=readFlightAim();
  if(aim?.leaf) toggleLeaf(aim.leaf);
  else if(aim?.openId){
    const id=aim.openId, open=!isOpen(id);
    setOpen(id,open); applyVisibility(); renderInfo();
    announce(EL[id].name+(open?': obert.':': tancat.'));
  }
  flightUI();
}

function requestFlightLock(cv){
  if(FLIGHT.locking) return;
  FLIGHT.locking=true;
  const rejected=()=>{ if(FLIGHT.enabled&&FLIGHT.locking) startFlight('drag'); };
  if(!cv.requestPointerLock){ rejected(); return; }
  try{ cv.requestPointerLock()?.catch(rejected); }catch(_){ rejected(); }
}
function clearFlightDrag(){
  const d=FLIGHT.drag, cv=renderer.domElement;
  if(d&&cv.hasPointerCapture(d.id)) cv.releasePointerCapture(d.id);
  FLIGHT.drag=null; FLIGHT.dragged=false;
}
function bindFlight(cv){
  $('#btnFlight').onclick=()=>{ if(FLIGHT.enabled){ exitFlight(); setPanel('views',false); $('#btnViews').focus(); } else enableFlight(); };
  $('#flightExit').onclick=()=>{ exitFlight(); $('#btnViews').focus(); };
  $('#flightAction').onclick=flightToggleAim;
  cv.addEventListener('click',e=>{
    if(!FLIGHT.enabled||e.button!==0) return;
    if(!FLIGHT.source){ requestFlightLock(cv); return; }
    if(!FLIGHT.dragged) flightSelect();
    FLIGHT.dragged=false;
  });
  document.addEventListener('pointerlockchange',()=>{
    if(document.pointerLockElement===cv){
      if(FLIGHT.enabled&&FLIGHT.locking) startFlight('mouse');
      else if(FLIGHT.source!=='mouse') document.exitPointerLock();
    } else if(FLIGHT.source==='mouse') pauseFlight();
  });
  document.addEventListener('pointerlockerror',()=>{ if(FLIGHT.enabled&&FLIGHT.locking) startFlight('drag'); });
  document.addEventListener('mousemove',e=>{
    if(FLIGHT.source==='mouse'&&document.pointerLockElement===cv) flightRotate(-(e.movementX||0)*0.0022,-(e.movementY||0)*0.0022);
  });
  cv.addEventListener('pointerdown',e=>{
    if(FLIGHT.source!=='drag'||e.button!==0||!e.isPrimary) return;
    FLIGHT.drag={id:e.pointerId,x:e.clientX,y:e.clientY,distance:0}; FLIGHT.dragged=false;
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove',e=>{
    const d=FLIGHT.drag;
    if(!d||d.id!==e.pointerId) return;
    const dx=e.clientX-d.x, dy=e.clientY-d.y;
    d.x=e.clientX; d.y=e.clientY; d.distance+=Math.hypot(dx,dy);
    if(d.distance>4){ FLIGHT.dragged=true; flightRotate(-dx*0.004,-dy*0.004); }
  });
  cv.addEventListener('lostpointercapture',()=>{ FLIGHT.drag=null; });
  cv.addEventListener('pointercancel',()=>{ FLIGHT.drag=null; FLIGHT.dragged=false; });
  cv.addEventListener('wheel',e=>{
    if(!FLIGHT.source) return;
    e.preventDefault();
    const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?cv.clientHeight:1);
    const distance=THREE.MathUtils.clamp(-delta*(e.shiftKey||flightPrecise()?0.001:0.004),-1.2,1.2);
    flightMove(0,Math.sign(distance),0,Math.abs(distance));
  },{passive:false});
  addEventListener('keydown',e=>{
    if(!FLIGHT.enabled||$('dialog[open]')||e.target!==cv||e.altKey||e.ctrlKey||e.metaKey) return;
    if(e.code==='Enter'){
      e.preventDefault();
      if(!e.repeat){ if(FLIGHT.source) flightSelect(); else requestFlightLock(cv); }
      return;
    }
    if(!FLIGHT.source) return;
    if(e.code==='KeyE'){ if(!e.repeat) flightToggleAim(); return; }
    if(!FLIGHT_KEYS.has(e.code)) return;
    e.preventDefault(); FLIGHT.keys.add(e.code); requestFrame();
  });
  addEventListener('keyup',e=>FLIGHT.keys.delete(e.code));
  cv.addEventListener('blur',()=>FLIGHT.keys.clear());
  addEventListener('blur',()=>pauseFlight());
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) pauseFlight(); });
}
