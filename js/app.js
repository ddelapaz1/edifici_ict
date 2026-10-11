/* =====================================================================
   APLICACIÓ: escena, geometria procedimental i connexions
   ===================================================================== */
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const V = (x,y,z) => new THREE.Vector3(x,y,z);
const yb = f => 3*f;

/* ---------- Estat de la interfície ---------- */
const S0 = () => ({learn:'free', mode:'oberta', floor:CFG.floor0, unitSide:CFG.side0, layers:{facana:true,estructura:true,recintes:true,registres:true,canalitzacions:true,xarxes:true,punts:true,equips:true,etiquetes:true},
  svc:'all', colorBy:'real', allLabels:false, tubesSee:true, openRec:false, openReg:false, sat:true, transp:0.25,
  reduced: window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, lowq:false,
  selected:null, hover:null, related:new Set(), openOv:new Map(), leaf:new Map(), openCanal:new Set(),
  cut:true, cap:'A', ritsLook:'real', ritsLight:false, ritsRoof:false, ritsFront:false, ritsCut:false, ritsXray:false, ritsHl:null});
let S = S0();
function curUnit(){ return CFG.unitFloors.includes(S.floor) ? `${S.floor}${S.unitSide}` : null; }

/* ---------- Registre de geometria ---------- */
const G = {meshes:[], byEl:{}, pick:[], cables:{}, arch:[], refs:[], refLabels:[], lids:[]};
let renderer=null, scene, camera, controls, glOK=true;

/* materials compartits d'arquitectura (es creen a archMats(), building.js) */
const AM = {};
/* textures de patró per tecnologia (pista no cromàtica) */
const TEX = {};
function makeTex(kind){
  const c=document.createElement('canvas'); c.width=64; c.height=16; const g=c.getContext('2d');
  g.fillStyle='#fff'; g.fillRect(0,0,64,16);
  if(kind==='fo'){ g.fillStyle='#9a9a9a'; g.fillRect(28,0,8,16); }
  if(kind==='pt'){ g.strokeStyle='#8a8a8a'; g.lineWidth=5; for(let x=-16;x<80;x+=16){g.beginPath();g.moveTo(x,0);g.lineTo(x+16,16);g.stroke();} }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}
function ud(mesh, o){ mesh.userData = Object.assign({}, o); return mesh; }

/* element ICT: crea material propi (per poder ressaltar-lo) */
/* contenidor on es creen les malles (null: l'escena). El model de cases construeix el RITS i els habitatges dins de
   grups girats i desplaçats: el codi de cada peça fa servir les seves coordenades de sempre. */
let ROOT=null;
function withRoot(r, f){ const p=ROOT; ROOT=r; try{ return f(); } finally{ ROOT=p; } }
function ictMesh(geo, color, elId, o={}){
  const e=EL[elId]; if(!e) throw new Error('Element desconegut '+elId);
  const opacity = o.opacity ?? 1;
  let mat;
  if(o.std) mat=new THREE.MeshStandardMaterial(Object.assign({color, envMapIntensity:0.75}, o.std, {transparent: opacity<1, opacity, depthWrite: opacity>=1}));
  else mat=new THREE.MeshLambertMaterial({color, transparent: opacity<1, opacity, depthWrite: opacity>=1, map:o.map||null});
  const m=new THREE.Mesh(geo,mat);
  ud(m, Object.assign({kind:'ict', el:elId, base:color, baseOp:opacity}, o)); delete m.userData.map; delete m.userData.parent; if(o.std) m.userData.std=true;
  if(o.cast) m.castShadow=true; if(o.rits) m.receiveShadow=true;
  (o.parent||ROOT||scene).add(m); G.meshes.push(m); (G.byEl[elId] ||= []).push(m); if(SCOPE) SCOPE.meshes.push(m);
  if(o.lidOf) G.lids.push(m);
  return m;
}
let ictN=0;
function iBox(elId,w,h,d,x,y,z,color,o={}){
  const e=0.0006*(1+(ictN++%5));
  const m=ictMesh(new THREE.BoxGeometry(w+2*e,h+2*e,d+2*e),color,elId,o); m.position.set(x,y,z);
  if(o.pick!==false){
    const pw=Math.max(w,0.26), ph=Math.max(h,0.26), pd=Math.max(d,0.2);
    if(pw>w||ph>h||pd>d){ addProxy(m,new THREE.BoxGeometry(pw,ph,pd)); } else G.pick.push(m);
  }
  return m;
}
const proxyMat = new THREE.MeshBasicMaterial({visible:false});
function addProxy(parent, geo){ const p=new THREE.Mesh(geo,proxyMat); p.userData={proxy:true}; parent.add(p); G.pick.push(p); return p; }

/* ---------- dimensions físiques dels cables ----------
   d: diàmetre exterior; rb: radi mínim de curvatura (metres). Three.js rep RADIS: r = d/2.
   Referències consultades (fitxes del fabricant o del distribuïdor):
   rg6      coaxial RG-6 Televes T100 (2126xx / T100plus 2141xx): Ø6,6 mm, radi mínim 33 mm.
   foAcom   escomesa interior ICT de 2 fibres G.657A2, LSZH (holgada, aramida): Ø3,8 ± 0,2 mm, radi mínim 18 mm.
   foDist   distribució interior de 48 fibres G.657A2, 6 tubs × 8 (p. ex. Gescable 48 FO, Ikusi CFH-048): Ø8,0 mm;
            radi adoptat 10 × Ø (estàtic). 48 fibres: capacitat coherent amb el panell de sortida de 48 SC (CTO_FO).
   foAlim   cable d'operador interior/exterior 24 FO (Optronics OPCFOIE09, Ø7,9 mm): radi d'instal·lació 160 mm.
   foPatch  latiguillo SC/APC simplex G.657A2 Ø2,0 mm, radi 15 mm.
   pt50     mànega 50 × 2 × 0,5 mm F/UTP Cat 3 LSZH (Keynet 512D505BLP): Ø14,4 mm; radi adoptat 10 × Ø.
   ptAlim   mànega de l'operador (100 parells, representativa): Ø18 mm; radi 10 × Ø.
   pt2      escomesa interior de 2 parells 0,51 mm LSZH (SXA2, General Cable CABICTEL): Ø4 mm representatiu; radi 5 × Ø.
   pair     parell extret de la mànega: dos conductors de Ø0,9 mm (coure 0,5 mm + aïllament) trenats.
   cat6     U/UTP Cat 6 Televes DK6000 (2123, 219910): Ø6,2 ± 0,2 mm; radi 4 × Ø (instal·lat).
   catPatch latiguillo U/UTP Cat 6 (Televes 2090xx, representatiu): Ø5,5 mm; radi 4 × Ø. */
const CBL={
  rg6:{d:0.0066, rb:0.033}, foAcom:{d:0.0038, rb:0.018}, foDist:{d:0.008, rb:0.08}, foAlim:{d:0.0079, rb:0.16},
  foPatch:{d:0.002, rb:0.015}, pt50:{d:0.0144, rb:0.144}, ptAlim:{d:0.018, rb:0.18}, pt2:{d:0.004, rb:0.02},
  pair:{d:0.0018, rb:0.01, cond:0.0009}, cat6:{d:0.0062, rb:0.025}, catPatch:{d:0.0055, rb:0.022}
};
/* tipus de cable de cada tram (per la clau); els coaxials sempre RG-6 */
const CBL_KEY=[[/^xd_pt/,'pt50'],[/^xal_pt/,'ptAlim'],[/^xs_pt/,'pt2'],[/^xi_dat/,'cat6'],[/^(patch_(pau|rtr|eth|ret)|pc_patch)/,'catPatch'],
  [/^xd_fo/,'foDist'],[/^xal_fo/,'foAlim'],[/^(xs_fo|xi_fo)/,'foAcom'],[/^(patch_fo|pi_fo_l)/,'foPatch']];
function cableKind(key,tech){ for(const [re,k] of CBL_KEY) if(re.test(key)) return k; if(tech==='coax') return 'rg6'; throw new Error('Tipus de cable desconegut: '+key); }

/* arc de circumferència 3D: centre c, a = vector del centre a l'inici, b = tangent inicial (|a| = |b| = radi) */
class Arc3 extends THREE.Curve{
  constructor(c,a,b,ang){ super(); this.c=c; this.a=a; this.b=b; this.ang=ang; }
  getPoint(t,o=new THREE.Vector3()){ const th=this.ang*t; return o.copy(this.c).addScaledVector(this.a,Math.cos(th)).addScaledVector(this.b,Math.sin(th)); }
  getTangent(t,o=new THREE.Vector3()){ const th=this.ang*t; return o.copy(this.a).multiplyScalar(-Math.sin(th)).addScaledVector(this.b,Math.cos(th)).normalize(); }
  getLength(){ return this.a.length()*this.ang; }
}
const BEND=[];   // cantonades on el radi mínim no hi cap (validació: __ICT.BEND)
/* corba amb cantonades arrodonides a partir d'una polilínia.
   Sense radi: cantonada Bézier quadràtica retallada a cr (tubs i camins antics).
   Amb radi (argument R o propietat p.R del punt): arc tangent de radi R, és a dir, radi de curvatura real.
   Cada cantonada pot fer servir la meitat de cada tram (tot el tram si l'altre extrem és un extrem del camí);
   si no hi cap, el radi es redueix i, si queda per sota del mínim (tag.rb), es registra a BEND. */
function polyCurve(pts, cr=0.12, R, tag){
  if(R || pts.some(p=>p.R)) pts=pts.filter((B,i)=>{ if(i===0||i===pts.length-1) return true;      // punts alineats o repetits: no limiten el tram
    const a=B.clone().sub(pts[i-1]), c=pts[i+1].clone().sub(B); return a.length()>1e-6 && c.length()>1e-6 && a.angleTo(c)>2e-3; });
  const path=new THREE.CurvePath(); let prev=pts[0].clone(); const n=pts.length;
  for(let i=1;i<n;i++){
    const B=pts[i];
    if(i<n-1){
      const A=pts[i-1], C=pts[i+1];
      const la=B.distanceTo(A), lc=B.distanceTo(C), Rc=B.R ?? R;
      if(Rc){
        if(la<1e-6||lc<1e-6) continue;
        const u1=B.clone().sub(A).divideScalar(la), u2=C.clone().sub(B).divideScalar(lc), phi=Math.acos(THREE.MathUtils.clamp(u1.dot(u2),-1,1));
        if(phi<2e-3) continue;                                   // punt alineat: el tram continua recte
        const av=Math.min(i===1?la:la/2, i===n-2?lc:lc/2), tn=Math.tan(Math.min(phi,3.13)/2);
        let t=Rc*tn; if(t>av) t=av; const Re=t/tn;
        if(tag && Re<tag.rb*0.98) BEND.push({key:tag.key, i, R:+Re.toFixed(4), rb:tag.rb, at:B.toArray().map(v=>+v.toFixed(3))});
        const p1=B.clone().addScaledVector(u1,-t), nrm=u2.clone().addScaledVector(u1,-u1.dot(u2)).normalize();
        if(prev.distanceTo(p1)>1e-5) path.add(new THREE.LineCurve3(prev.clone(),p1));
        path.add(new Arc3(p1.clone().addScaledVector(nrm,Re), nrm.multiplyScalar(-Re), u1.clone().multiplyScalar(Re), phi));
        prev=B.clone().addScaledVector(u2,t); continue;
      }
      const la2=la, lc2=lc;
      const r=Math.min(cr, la2/2.2, lc2/2.2);
      const p1=B.clone().add(A.clone().sub(B).normalize().multiplyScalar(r));
      const p2=B.clone().add(C.clone().sub(B).normalize().multiplyScalar(r));
      if(prev.distanceTo(p1)>1e-4) path.add(new THREE.LineCurve3(prev.clone(),p1));
      if(r>1e-4) path.add(new THREE.QuadraticBezierCurve3(p1,B.clone(),p2)); prev=p2;
    } else if(prev.distanceTo(B)>1e-5) path.add(new THREE.LineCurve3(prev.clone(),B.clone()));
  }
  return path;
}
/* mostreig adaptatiu d'una corba: els trams rectes només als extrems i els arcs cada 7,5° (sense facetes visibles
   en corbes curtes i sense multiplicar anelles als trams llargs). Retorna punts, tangents i longitud acumulada. */
function pathSamples(path){
  const P=[], T=[], L=[]; let s=0;
  for(const c of path.curves){
    let n=1;
    if(c instanceof Arc3) n=Math.max(2,Math.ceil(c.ang/(Math.PI/24)));
    else if(c.isQuadraticBezierCurve3){ const a=c.v1.clone().sub(c.v0).normalize(), b=c.v2.clone().sub(c.v1).normalize(); n=Math.max(2,Math.ceil(Math.acos(THREE.MathUtils.clamp(a.dot(b),-1,1))/(Math.PI/24))+1); }
    for(let k=P.length?1:0;k<=n;k++){ const p=c.getPoint(k/n);
      if(P.length){ const d=p.distanceTo(P[P.length-1]); if(d<1e-7) continue; s+=d; }
      P.push(p); T.push(c.getTangent(k/n)); L.push(s); }
  }
  return {P,T,L};
}
/* tros d'un mostreig entre les longituds s0 i s1 (talls de la mànega a la finestra del sangrat) */
function sliceSamples(S,s0,s1){
  const P=[],T=[],L=[], at=s=>{ let i=1; while(i<S.L.length-1 && S.L[i]<s) i++; const u=(s-S.L[i-1])/Math.max(1e-9,S.L[i]-S.L[i-1]);
    return [S.P[i-1].clone().lerp(S.P[i],THREE.MathUtils.clamp(u,0,1)), S.T[i-1].clone().lerp(S.T[i],THREE.MathUtils.clamp(u,0,1)).normalize()]; };
  const add=([p,t],s)=>{ P.push(p); T.push(t); L.push(s); };
  add(at(s0),s0); for(let i=0;i<S.L.length;i++) if(S.L[i]>s0+1e-6 && S.L[i]<s1-1e-6) add([S.P[i].clone(),S.T[i].clone()],S.L[i]); add(at(s1),s1);
  return {P,T,L};
}
/* tub escombrat al llarg d'un mostreig amb marcs de transport paral·lel (sense girs bruscos de la secció).
   a0–a1: obertura angular (per a la coberta oberta de la finestra del sangrat); off(i,j): desplaçament opcional. */
/* cap: tapa els dos extrems amb un disc (cables massissos: si no, es veuen buits per dins). Només amb el perímetre sencer. */
function sweepGeo(S, r, radial=8, a0=0, a1=Math.PI*2, upRef, cap=false){
  const n=S.P.length, cols=radial+1, cv = cap && a1-a0>=Math.PI*2-1e-6 ? 2*(cols+1) : 0, nv=n*cols+cv;
  const pos=new Float32Array(nv*3), nor=new Float32Array(nv*3), uv=new Float32Array(nv*2), idx=[];
  const T0=S.T[0]; let N=(upRef||(Math.abs(T0.y)<0.9?V(0,1,0):V(1,0,0))).clone(); N.addScaledVector(T0,-N.dot(T0)).normalize();
  const B=new THREE.Vector3(), d=new THREE.Vector3(), ax=new THREE.Vector3();
  for(let i=0;i<n;i++){
    const T=S.T[i];
    if(i>0){ ax.crossVectors(S.T[i-1],T); const sl=ax.length(); if(sl>1e-9) N.applyAxisAngle(ax.divideScalar(sl),Math.atan2(sl,S.T[i-1].dot(T))); N.addScaledVector(T,-N.dot(T)).normalize(); }
    B.crossVectors(T,N);
    for(let j=0;j<=radial;j++){ const a=a0+(a1-a0)*j/radial, k=(i*cols+j);
      d.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B,Math.sin(a));
      pos[k*3]=S.P[i].x+d.x*r; pos[k*3+1]=S.P[i].y+d.y*r; pos[k*3+2]=S.P[i].z+d.z*r;
      nor[k*3]=d.x; nor[k*3+1]=d.y; nor[k*3+2]=d.z; uv[k*2]=S.L[i]*3; uv[k*2+1]=j/radial; }
  }
  /* cares cap enfora (ordre antihorari vist des de fora): amb l'ordre invers es veia la paret interior i el cable semblava buit */
  for(let i=0;i<n-1;i++) for(let j=0;j<radial;j++){ const a=i*cols+j, b=a+cols; idx.push(a,a+1,b, a+1,b+1,b); }
  if(cv) for(const [i,s] of [[0,-1],[n-1,1]]){                    // tapes: centre + còpia de l'anell amb normal axial (±T)
    const c=n*cols+(s>0?cols+1:0), T=S.T[i];
    for(let j=0;j<=cols;j++){ const k=c+j, src=j?((i*cols+j-1)*3):null;
      if(j){ pos[k*3]=pos[src]; pos[k*3+1]=pos[src+1]; pos[k*3+2]=pos[src+2]; } else { pos[k*3]=S.P[i].x; pos[k*3+1]=S.P[i].y; pos[k*3+2]=S.P[i].z; }
      nor[k*3]=T.x*s; nor[k*3+1]=T.y*s; nor[k*3+2]=T.z*s; }
    for(let j=1;j<cols;j++) s>0 ? idx.push(c,c+j,c+j+1) : idx.push(c,c+j+1,c+j); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('normal',new THREE.BufferAttribute(nor,3)); g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); g.setIndex(idx);
  return g;
}
function polyLen(pts){ let L=0; for(let i=1;i<pts.length;i++) L+=pts[i].distanceTo(pts[i-1]); return L; }
function tubeGeo(pts, r, radial=8, cr, R, tag, cap){ return sweepGeo(pathSamples(polyCurve(pts, cr ?? Math.max(r*1.6,0.06), R, tag)), r, radial, 0, Math.PI*2, null, cap); }
/* punts: [x,y,z] o [x,y,z,R] (R: radi de corba propi d'aquella cantonada) */
const P = a => a.map(p => Array.isArray(p) ? (p.length>3 ? Object.assign(V(p[0],p[1],p[2]),{R:p[3]}) : V(p[0],p[1],p[2])) : p);
/* camí d'un tub desplaçat un vector constant v: si el tub i el cable fan servir el mateix radi R a les cantonades,
   la corba del cable és exactament la del tub traslladada, i per tant hi queda a dins (distància a l'eix = |v|). */
const inTube = (pts,v,R) => pts.map(p=>[p[0]+v[0],p[1]+v[1],p[2]+v[2],R]);

/* cable: tram de xarxa amb dades de connexió. o.k: tipus de CBL (si no, per la clau); o.r i o.R ho sobreescriuen */
function cable(key, elId, pts, o){
  pts=P(pts); const e=EL[elId];
  const tram=o.tram||e.tram, tech=o.tech||e.tech, svc=o.svc||e.svc;
  const D=CBL[o.k||cableKind(key,tech)], r=o.r ?? D.d/2;
  const real=o.real ?? realColorFor(key,tech);
  const color = cableColor(tram,tech,real);
  const Sm=pathSamples(polyCurve(pts, 0, o.R ?? D.rb, {key, rb:D.rb}));
  const m=ictMesh(sweepGeo(Sm,r,o.radial ?? (tram==='usr'?12:8),0,Math.PI*2,null,true), color, elId, {cable:key,   // latiguillos: secció més rodona (es veuen de prop)
    tram, tech, svc, real, texMap:TEX[tech]||null, map: S.colorBy==='real' ? null : (TEX[tech]||null)});
  addProxy(m, sweepGeo(Sm, o.pr ?? Math.max(r*3,0.02), 4));   // tolerància de selecció (invisible), independent del gruix real
  G.cables[key]={key, el:elId, pts, mesh:m, from:o.from||null, to:o.to||null, via:o.via||null, sm:Sm, r};
  return m;
}
/* colors d'aspecte real: coaxial del cable de distribució 1 blanc i del 2 negre, fibra groga, parells trenats gris, mànega marfil */
const REAL={white:0xF4F3EF, black:0x1C1D1F, fo:0xF2C200, pt:0x9EA4AA, pt50:0xD6D0BC};   // mànega de 50 parells: coberta LSZH marfil
function realColorFor(key,tech){ if(tech==='fo') return REAL.fo; if(tech==='pt') return /^xd_pt/.test(key) ? REAL.pt50 : REAL.pt; return /^(xd|xs)_rtv_b_/.test(key) ? REAL.black : REAL.white; }
function cableColor(tram,tech,real){ if(S.colorBy==='real') return real ?? (tech==='fo'?REAL.fo:tech==='pt'?REAL.pt:REAL.white); return new THREE.Color(S.colorBy==='tech' ? TECHS[tech].color : TRAMS[tram].color).getHex(); }

/* tub de canalització (contenidor físic). o.mouth: boques que queden dins d'un registre o recinte (0: inici, 1: final,
   2: totes dues); s'hi dibuixa un collar més opac perquè es vegi on acaba el tub i per on en surt el cable */
function tube(elId, pts, r, o={}){
  pts=P(pts);
  const m=ictMesh(tubeGeo(pts,r,12,o.cr,o.R), o.color||0x9AA3AD, elId, Object.assign({canal:true, opacity:0.32, svc:o.svc||'all'}, o));
  m.renderOrder=2; G.pick.push(m);
  (G.tubes ||= []).push({el:elId, pts, r, cr:o.cr, R:o.R});
  for(const e of (o.mouth===2?[0,1]:o.mouth===undefined?[]:[o.mouth])){
    const p=pts[e?pts.length-1:0], t=p.clone().sub(pts[e?pts.length-2:1]).normalize().multiplyScalar(e?1:-1);
    const g=new THREE.CylinderGeometry(r*1.04,r*1.04,0.008,16,1,true); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP,t));
    g.translate(p.x-t.x*0.004,p.y-t.y*0.004,p.z-t.z*0.004);
    const key=[elId,o.svc,o.tubeSvc,o.color].join('|');
    ((MOUTHS[key] ||= {elId, o, g:[]}).g).push([g,new THREE.Matrix4()]);
  }
  return m;
}
/* collars de les boques: una sola malla per element i servei (es fusionen en acabar buildICT) */
const MOUTHS={};
function flushMouths(){
  for(const [k,{elId,o,g}] of Object.entries(MOUTHS)){
    const c=ictMesh(mergeParts(g), o.color||0x9AA3AD, elId, Object.assign({canal:true, svc:o.svc||'all'}, o, {opacity:0.75, mouth:undefined}));
    c.material.side=THREE.DoubleSide; c.renderOrder=2; delete MOUTHS[k];
  }
}
function iCyl(elId, r, h, x,y,z, color, axis='y', o={}){
  const g=new THREE.CylinderGeometry(r,r,h,14); if(axis==='x') g.rotateZ(Math.PI/2); if(axis==='z') g.rotateX(Math.PI/2);
  const m=ictMesh(g,color,elId,o); m.position.set(x,y,z);
  if(o.pick!==false){ if(r<0.08) addProxy(m, new THREE.BoxGeometry(axis==='x'?h:0.2, axis==='y'?h:0.2, axis==='z'?h:0.2)); else G.pick.push(m); }
  return m;
}
/* registre o caixa amb tapa frontal (cara +z) */
function regBox(elId, w,h,d, x,y,z, color, lidColor, dir=1){
  const t=0.025;
  iBox(elId,w,h,t,x,y,z-dir*(d/2-t/2),color);              // fons
  iBox(elId,t,h,d,x-w/2+t/2,y,z,color); iBox(elId,t,h,d,x+w/2-t/2,y,z,color);
  iBox(elId,w,t,d,x,y+h/2-t/2,z,color); iBox(elId,w,t,d,x,y-h/2+t/2,z,color);
  if(lidColor!==undefined) iBox(elId,w+0.02,h+0.02,0.03,x,y,z+dir*(d/2+0.012),lidColor,{lidOf:elId});
}

/* porta abatible: frontissa vertical a x=hx; side=+1 la fulla creix cap a +x */
function doorLeaf(elId,hx,w,y0,y1,z,color,side){
  const h=y1-y0, piv=new THREE.Group(); piv.position.set(hx,y0+h/2,z); (ROOT||scene).add(piv);
  const m=ictMesh(new THREE.BoxGeometry(w,h,0.05),color,elId,{door:true}); scene.remove(m); piv.add(m); m.position.set(side*w/2,0,0); G.pick.push(m);
  const hd=ictMesh(new THREE.BoxGeometry(0.04,0.32,0.05),0x4A5560,elId,{door:true}); scene.remove(hd); piv.add(hd); hd.position.set(side*(w-0.12),-0.05,0.05);
  for(const yy of [-h/2+0.06,h/2-0.06]){ const st=ictMesh(new THREE.BoxGeometry(w-0.08,0.03,0.01),0x8494A6,elId,{door:true}); scene.remove(st); piv.add(st); st.position.set(side*w/2,yy,0.03); }
  (G.doors ||= []).push({piv, of:elId, side, cur:0});
}
function doorPair(elId,x0,x1,y0,y1,z,color){ const w=(x1-x0)/2-0.01; doorLeaf(elId,x0,w,y0,y1,z,color,1); doorLeaf(elId,x1,w,y0,y1,z,color,-1); }
/* RITI i RITS (parets formen part de l'element recinte) */
function buildEnclosures(){
  const C=0xB9C7D6, LID=0x9FB0C2;
  // RITI
  iBox('riti',0.12,2.8,2.35,-0.4,1.4,-3.575,C); iBox('riti',0.12,2.8,2.35,3.4,1.4,-3.575,C);
  iBox('riti',3.92,0.3,0.14,1.5,2.65,-2.4,C);                    // llinda
  doorPair('riti',-0.34,3.34,0.02,2.5,-2.36,LID);                   // dues portes abatibles
  iBox('riti',3.6,0.05,0.3,1.45,2.0,-4.55,0x8C96A0); // safata de cables
  iBox('riti',3.6,0.12,0.03,1.45,2.06,-4.4,0x8C96A0,{pick:false});
}

/* ---------- punt d'interconnexió òptic: caixes terminals òptiques (CTO) murals ----------
   Tres CTO apilades dins del registre principal òptic: a dalt, la de l'edifici (panell de sortida, etiqueta blava);
   a sota, una per operador (repartidor d'entrada, etiqueta taronja). Cada CTO té un cos principal (empalmaments)
   i un compartiment lateral (connectors), premsaestopes al costat esquerre i a la base, i els latiguillos grocs
   pugen pel canal de la dreta des de cada operador fins a la CTO de sortida. */
const CTO_FO = (()=>{
  /* mides reals d'una CTO multioperador de 48 SC (p. ex. 450 × 180 × 150 mm): cos principal 300 mm + compartiment lateral 145 mm */
  const x0=1.78, wm=0.30, ws=0.145, gap=0.005, zb=-4.725, zf=-4.575, zc=-4.65, h=0.18;
  const xs=x0+wm+gap, gx=j=>xs+0.022+0.024*j;
  const ops=[{y0:1.37, num:'598005', gz:-4.68, cords:[0,1,2]}, {y0:1.08, num:'570074', gz:-4.62, cords:[3,4]}];
  for(const o of ops) o.gland=[x0-0.022, o.y0+0.065, o.gz];
  return {x0, wm, ws, xs, gap, zb, zf, zc, h, gx, ops, outY0:1.66, cx:1.725, xr:xs+ws+0.025, out:[x0+0.06, 1.66+h+0.022, zc]};
})();
let LASER_TEX=null;
function laserTex(){ return canvasTex(128,112,(g,w,hh)=>{ g.clearRect(0,0,w,hh);
  const tri=(p,c)=>{ g.fillStyle=c; g.beginPath(); g.moveTo(w/2,p); g.lineTo(w-p*1.1,hh-p*0.75); g.lineTo(p*1.1,hh-p*0.75); g.closePath(); g.fill(); };
  tri(2,'#1A1A1A'); tri(14,'#F2C200');
  g.strokeStyle='#1A1A1A'; g.fillStyle='#1A1A1A'; g.lineWidth=4; g.beginPath(); g.arc(w/2,hh*0.64,7,0,7); g.fill();
  for(let a=0;a<8;a++){ const t=a*Math.PI/4; g.beginPath(); g.moveTo(w/2+Math.cos(t)*11,hh*0.64+Math.sin(t)*11); g.lineTo(w/2+Math.cos(t)*(a===0?40:18),hh*0.64+Math.sin(t)*(a===0?0:18)); g.stroke(); } }); }
function ctoBox(y0, o){
  const K=CTO_FO, {x0,wm,ws,xs,zb,zf,zc,h}=K, el='pi_fo', y1=y0+h;
  const GREY=0xD3D8DC, DOOR=0xDDE2E5, HINGE=0xBCC3C9, ZAM=0xB4BBC1, DARK=0x2A2D31;
  /* cossos i portes (la porta, lleugerament reculada, marca el junt perimetral) */
  for(const [a,b] of [[x0,x0+wm],[xs,xs+ws]]){
    rBox(el,a,b,y0,y1,zb,zf-0.005,GREY,'plastic',{pick:true,cast:true});
    rBox(el,a+0.003,b-0.003,y0+0.003,y1-0.003,zf-0.006,zf,DOOR,'plastic');
  }
  /* frontisses del cos principal (a dalt i a baix, com les tapes abatibles reals) */
  const nh=6; for(let i=0;i<nh;i++){ const cx=x0+0.03+i*(wm-0.06)/(nh-1);
    for(const yy of [y1-0.003,y0+0.003]) rBox(el,cx-0.009,cx+0.009,yy-0.004,yy+0.004,zf-0.003,zf+0.003,HINGE,'plastic'); }
  /* panys de clau triangular */
  const lock=(x,y,r)=>{ rCyl(el,r,0.005,V(x,y,zf+0.002),V(0,0,1),ZAM,'zamak'); rCyl(el,r*0.5,0.006,V(x,y,zf+0.003),V(0,0,1),DARK,'zamakDark',{seg:3}); };
  lock(x0+0.028,y1-0.03,0.009); lock(x0+wm-0.028,y1-0.03,0.009); lock(xs+0.025,y1-0.03,0.008);
  /* passacables rodó del compartiment lateral */
  rCyl(el,0.015,0.005,V(xs+ws/2,y0+h*0.5,zf+0.002),V(0,0,1),0xF1F3F4,'plastic'); rCyl(el,0.0085,0.006,V(xs+ws/2,y0+h*0.5,zf+0.003),V(0,0,1),DARK,'rubber');
  /* etiqueta, marca de color i senyal de làser */
  rPlane(el,0.12,0.036,V(x0+wm*0.46,y0+h*0.33,zf+0.001),V(0,0,1),textTex([o.num],{w:320,h:96,size:64,bold:[true],border:'#1A1A1A',bw:3}));
  rBox(el,xs+ws-0.033,xs+ws-0.013,y0+0.015,y0+0.035,zf,zf+0.0015,o.tag,'plastic');
  rBox(el,x0+0.015,x0+0.035,y0+0.015,y0+0.035,zf,zf+0.0015,o.tag,'plastic');
  rPlane(el,0.03,0.026,V(xs+ws/2,y1-0.038,zf+0.001),V(0,0,1),LASER_TEX||(LASER_TEX=laserTex())).material.alphaTest=0.5;
  /* premsaestopes: dos al costat esquerre (cables d'operador o de distribució) i un a la base del compartiment lateral per latiguillo */
  const gland=(pos,dir,r=0.008)=>{ const d=dir.clone().normalize();
    rHex(el,r+0.004,0.006,pos.clone().addScaledVector(d,0.003),d,0xC9CED2,'plastic');
    rCyl(el,r,0.016,pos.clone().addScaledVector(d,0.012),d,DARK,'rubber',{r2:r*0.75}); };
  for(const z of [-4.68,-4.62]) gland(V(x0,y0+0.065,z),V(-1,0,0));
  gland(V(x0,y0+0.125,zc),V(-1,0,0),0.006);
  for(const j of o.cords) gland(V(K.gx(j),y0,zc),V(0,-1,0),0.005);
  if(o.top) gland(V(o.top[0],y1,zc),V(0,1,0),0.007);
}
function buildRITIFibre(){
  const K=CTO_FO;
  ctoBox(K.outY0,{num:'SORTIDA', tag:0x2F6FDE, cords:[0,1,2,3,4], top:K.out});
  for(const op of K.ops) ctoBox(op.y0,{num:op.num, tag:0xE07B24, cords:op.cords});
  /* latiguillos: de la base de cada CTO d'operador, pel canal de la dreta, fins a la base de la CTO de sortida */
  let n=0;
  for(const op of K.ops) op.cords.forEach((j,i)=>{
    const gx=K.gx(j), yl=op.y0-0.035-0.008*i, zi=-4.69+0.025*j, yt=K.outY0-0.04;
    cable(`pi_fo_l${n++}`,'pi_fo',[[gx,op.y0-0.016,K.zc],[gx,yl,K.zc],[K.xr,yl,zi],[K.xr,yt,zi],[gx,yt,K.zc],[gx,K.outY0-0.016,K.zc]],{tram:'usr',tech:'fo'});
  });
}

/* ---------- telefonia per parells (STDP, RD 346/2011 annex II, xarxa de cables de parells) ----------
   Regletes tipus Krone (LSA, connexió per desplaçament d'aïllant) de 10 parells. Demanda: 16 habitatges × 2 línies
   + local 3 + serveis comuns 2 = 37 línies; × 1,2 = 44,4 → mànega normalitzada de 50 parells (5 regletes de sortida).
   Regletes d'entrada: 1,5 × 50 = 75 → 8 regletes (80 parells). A cada planta, sangrat de 10 parells cap a una regleta
   del registre secundari: 8 connectats a les quatre escomeses de 2 parells i 2 lliures. */
const KR={L:0.125, h:0.022, d:0.032, pitch:0.034};
const KRI={xl:2.7725, xr:3.1275, yTop:1.80, zb:-4.71, xm:2.95};
let KRONE_TEX=null;
function kroneTex(){ return KRONE_TEX ||= canvasTex(512,96,(g,w,h)=>{ g.fillStyle='#F2F1EC'; g.fillRect(0,0,w,h);
  const cw=(w-16)/20; for(let i=0;i<20;i++){ g.fillStyle='#55595D'; g.fillRect(8+i*cw+cw*0.38,4,cw*0.24,40); }
  g.fillStyle='#D3D0C8'; g.fillRect(0,47,w,3);
  g.fillStyle='#1A1A1A'; g.font='700 30px Arial, sans-serif'; g.textAlign='center'; g.textBaseline='middle';
  for(let p=0;p<10;p++) g.fillText(String((p+1)%10), 8+(p+0.5)*(w-16)/10, 73); }); }
/* posició del contacte del parell p (1–10) a la cara frontal d'una regleta centrada a xc */
const krX = (xc,p) => xc-KR.L/2+0.004+(p-0.5)*(KR.L-0.008)/10;
function kroneModule(el, xc, yc, zb, o={}){
  const {L,h,d}=KR, zf=zb+d;
  rBox(el,xc-L/2,xc+L/2,yc-h/2,yc+h/2,zb,zf-0.0005,0xEDEBE4,'plastic',{pick:o.pick!==false});
  rPlane(el,L,h,V(xc,yc,zf),V(0,0,1),kroneTex());
  /* suports grisos dels extrems */
  rBox(el,xc-L/2-0.008,xc-L/2,yc-h/2-0.003,yc+h/2+0.003,zb-0.004,zb+d*0.7,0xA7ABAE,'plastic');
  rBox(el,xc+L/2,xc+L/2+0.008,yc-h/2-0.003,yc+h/2+0.003,zb-0.004,zb+d*0.7,0xA7ABAE,'plastic');
}
/* columna de regletes sobre dos perfils de muntatge, amb rètol */
function kroneColumn(el, xc, yTop, n, label){
  const {L,pitch}=KR, ys=[];
  for(let i=0;i<n;i++){ const yc=yTop-i*pitch; kroneModule(el,xc,yc,KRI.zb); ys.push(yc); }
  const y0=ys[n-1]-0.03, y1=yTop+0.03;
  for(const s of [-1,1]){ const xx=xc+s*(L/2+0.004); rBox(el,xx-0.006,xx+0.006,y0,y1,-4.725,KRI.zb-0.004,0xB9BEC2,'galv'); }
  rPlane(el,L+0.02,0.034,V(xc,y1+0.026,-4.718),V(0,0,1),textTex(label,{w:300,h:100,fs:[38,28],bold:[true,false],border:'#55595D',bw:3}));
  return ys;
}
function wire(el, pts, color, r=CBL.pair.d/2){ return ictMesh(tubeGeo(P(pts),r,6,0,CBL.pair.rb,undefined,true), color, el, {std:RM.pvc, fixedColor:true}); }   // pont de parell (2 × Ø0,9 mm)
/* regletes d'entrada i de sortida, rètols i ponts [regleta d'entrada, parell, regleta de sortida, parell] (el model de cases ho canvia) */
const KRP={nin:8, nout:5, lin:['OPERADOR','entrada · 80 parells'], lout:['EDIFICI','sortida · 50 parells'],
  J:[[0,2,0,1],[1,5,0,4],[2,1,1,3],[3,7,2,2],[4,3,3,6],[5,8,1,8],[6,4,2,7]]};
function buildRITIPairs(){
  const el='pi_pt', zf=KRI.zb+KR.d;
  const yl=kroneColumn(el,KRI.xl,KRI.yTop,KRP.nin,KRP.lin);
  const yr=kroneColumn(el,KRI.xr,KRI.yTop,KRP.nout,KRP.lout);
  /* anelles guia per als ponts */
  const rings=[1.74,1.62,1.50];
  for(const yy of rings){
    const t=ictMesh(new THREE.TorusGeometry(0.012,0.0022,6,16),0x2A2D31,el,{std:RM.plastic}); t.position.set(KRI.xm,yy,-4.672); t.rotation.y=Math.PI/2;
    rBox(el,KRI.xm-0.002,KRI.xm+0.002,yy-0.014,yy-0.010,-4.725,-4.672,0x2A2D31,'plastic');
  }
  /* ponts (línies d'alta): parell de la regleta d'entrada de l'operador → parell de la regleta de sortida de l'habitatge */
  KRP.J.forEach(([mi,p,mo,q],i)=>{
    const x1=krX(KRI.xl,p), y1=yl[mi]-0.005, x2=krX(KRI.xr,q), y2=yr[mo]-0.005;
    const ry=rings.find(r=>r<Math.min(y1,y2)-0.015) ?? rings[rings.length-1];
    wire(el,[[x1,y1,zf+0.001],[x1,y1-0.012,zf+0.012],[KRI.xm,ry,-4.672],[x2,y2-0.012,zf+0.012],[x2,y2,zf+0.001]], i%2?0x1565C0:0xC62828);
  });
}

/* ---------- mànega de 50 parells: baixant continu del RITI als registres secundaris ----------
   Un sol camí (radi de corba 144 mm = 10 × Ø14,4) que es talla a la finestra del sangrat de cada planta:
   dins del tub va a (x, z); al registre fa una S fins a la placa del fons (xp, zp), hi puja subjectada amb dues brides
   i torna a fer una S cap al tub superior. A la 4a planta la mànega acaba al registre amb un caputxó (parells 41–50 de reserva). */
const PT50={x:1.05, z:-4.56, xp:1.17, zp:-4.712, w0:1.74, w1:1.90};
/* colors del codi de parells telefònic (25/50 parells): primari a × secundari b */
const PAIRC={a:[0xF4F4F0,0xC62828,0x26282B,0xF2C200,0x7B3FA0], b:[0x1E63C6,0xF07F14,0x2E9B3F,0x7A4A21,0x8A9097]};
const pairCols = n => [PAIRC.a[Math.floor((n-1)/5)%5], PAIRC.b[(n-1)%5]];
/* mostres denses (cada ds) d'un camí, per enrotllar-hi conductors */
function denseSamples(path, ds){
  const L=path.getLength(), n=Math.max(2,Math.ceil(L/ds)), P=[], T=[], Ls=[];
  for(let i=0;i<=n;i++){ const u=i/n; P.push(path.getPointAt(u)); T.push(path.getTangentAt(u).normalize()); Ls.push(u*L); }
  return {P,T,L:Ls};
}
/* helicoide al voltant d'un mostreig (marcs de transport paral·lel): radi rh, pas pitch, fase ph */
function helixSamples(S, rh, pitch, ph, up){
  const P=[], T=[], L=[], N=(up||(Math.abs(S.T[0].y)<0.9?V(0,1,0):V(1,0,0))).clone(); N.addScaledVector(S.T[0],-N.dot(S.T[0])).normalize();
  const ax=new THREE.Vector3();
  for(let i=0;i<S.P.length;i++){
    if(i>0){ ax.crossVectors(S.T[i-1],S.T[i]); const sl=ax.length(); if(sl>1e-9) N.applyAxisAngle(ax.divideScalar(sl),Math.atan2(sl,S.T[i-1].dot(S.T[i]))); N.addScaledVector(S.T[i],-N.dot(S.T[i])).normalize(); }
    const B=S.T[i].clone().cross(N), a=ph+2*Math.PI*S.L[i]/pitch;
    P.push(S.P[i].clone().addScaledVector(N,rh*Math.cos(a)).addScaledVector(B,rh*Math.sin(a))); L.push(S.L[i]);
  }
  for(let i=0;i<P.length;i++) T.push(P[Math.min(i+1,P.length-1)].clone().sub(P[Math.max(i-1,0)]).normalize());
  return {P,T,L};
}
/* parell trenat: dos conductors de Ø0,9 mm, pas de 12 mm. Retorna les dues geometries per fusionar */
function twistedPair(S, cols){ const rc=CBL.pair.cond/2; return [0,1].map(k=>[sweepGeo(helixSamples(S,rc,0.012,k*Math.PI),rc,5,0,Math.PI*2,null,true),new THREE.Matrix4(),cols[k]]); }
/* malla de cable registrada a partir d'un mostreig ja fet (trams de la mànega) */
function cableFromSamples(key, elId, Sm, r, o={}){
  const e=EL[elId], tram=o.tram||e.tram, tech=o.tech||e.tech, svc=o.svc||e.svc, real=o.real ?? realColorFor(key,tech);
  const m=ictMesh(sweepGeo(Sm,r,o.radial||10,0,Math.PI*2,null,true), cableColor(tram,tech,real), elId, {cable:key, tram, tech, svc, real, texMap:TEX[tech]||null, map: S.colorBy==='real'?null:(TEX[tech]||null)});
  addProxy(m, sweepGeo(Sm, Math.max(r*3,0.02), 4));
  G.cables[key]={key, el:elId, pts:o.pts||Sm.P, mesh:m, from:o.from||null, to:o.to||null, via:o.via||null, sm:Sm, r};
  return m;
}
function buildPairRiser(){
  const D=CBL.pt50, r=D.d/2, {x,z,xp,zp,w0,w1}=PT50, el='xd_pt', e=EL[el];
  /* RITI: surt de la columna de sortida, va per la safata i s'alinea amb el tub de parells (Ø50) abans d'entrar-hi a 2,20 m;
     als registres secundaris torna a l'eix del tub abans de sortir per dalt (y+2,65) */
  const pts=[[3.212,1.60,-4.705],[3.212,2.036,-4.67],[x+0.40,2.036,-4.67],[x,2.036,z]];
  for(const f of [1,2,3,4]){ const y=yb(f);
    pts.push([x,y+1.40,z],[xp,y+1.68,zp]);
    if(f<4) pts.push([xp,y+2.34,zp],[x,y+2.58,z]); else pts.push([xp,y+2.20,zp]);
  }
  const Sm=pathSamples(polyCurve(P(pts),0,D.rb,{key:'xd_pt',rb:D.rb}));
  const sAt=yy=>{ for(let i=1;i<Sm.P.length;i++){ const a=Sm.P[i-1], b=Sm.P[i];
      if(Math.abs(a.x-xp)<1e-4 && Math.abs(b.x-xp)<1e-4 && (a.y-yy)*(b.y-yy)<=0) return Sm.L[i-1]+(yy-a.y)/(b.y-a.y)*(Sm.L[i]-Sm.L[i-1]); }
    throw new Error('finestra del sangrat fora del tram recte'); };
  const cut=[1,2,3,4].map(f=>[sAt(yb(f)+w0),sAt(yb(f)+w1)]), Lt=Sm.L[Sm.L.length-1];
  cableFromSamples('xd_pt_0',el,sliceSamples(Sm,0,cut[0][0]),r,{from:'pi_pt', to:'rs_1', via:'canal_principal'});
  for(const f of [1,2,3]) cableFromSamples(`xd_pt_${f}`,el,sliceSamples(Sm,cut[f-1][1],cut[f][0]),r,{from:`rs_${f}`, to:`rs_${f+1}`, via:'canal_principal'});
  /* final de la mànega a la 4a planta, amb caputxó termoretràctil */
  const Se=sliceSamples(Sm,cut[3][1],Lt), base={cableLike:true, tram:e.tram, tech:e.tech, svc:e.svc};
  const me=ictMesh(sweepGeo(Se,r,10,0,Math.PI*2,null,true),cableColor(e.tram,e.tech,REAL.pt50),el,Object.assign({real:REAL.pt50},base)); addProxy(me,sweepGeo(Se,0.02,4));
  const pe=Se.P[Se.P.length-1]; iCyl('xd_pt',r+0.0012,0.03,pe.x,pe.y-0.012,pe.z,0x2A2D31,'y',{pick:false});
  for(const f of [1,2,3,4]){ pairWindow(f,Sm,cut[f-1][0],cut[f-1][1]);
    /* brides de subjecció a la placa del fons */
    const y=yb(f), cl=[], t=0.0013, Rb=r+t/2, M=new THREE.Matrix4();
    for(const yy of (f<4?[2.05,2.25]:[2.05])){
      const band=new THREE.TorusGeometry(Rb,t/2+0.0004,6,16,Math.PI); band.rotateX(Math.PI/2);   // mitja anella per davant
      cl.push([band,M.clone().makeTranslation(xp,y+yy,zp),0xE6E6E2]);
      for(const s of [-1,1]) cl.push([new THREE.BoxGeometry(0.008,0.012,0.0025),M.clone().makeTranslation(xp+s*(Rb+0.004),y+yy,-4.7235),0xE6E6E2]);
    }
    ictMesh(mergeParts(cl),0xFFFFFF,`rs_${f}`,{std:{roughness:0.6,metalness:0,vertexColors:true}});
  }
}
/* finestra del sangrat: obertura longitudinal de la coberta (es conserva la meitat del darrere i es veuen els talls),
   nucli de parells que continua en pas i els 10 parells de la planta, extrets i portats ordenadament a la regleta */
function pairWindow(f, Sm, s0, s1){
  const el='xd_pt', e=EL[el], y=yb(f), {xp,zp,w0}=PT50, r=CBL.pt50.d/2, ri=r-0.0012, front=V(0,0,1);
  const base={cableLike:true, tram:e.tram, tech:e.tech, svc:e.svc};
  const W=sliceSamples(Sm,s0,s1), op=1.0;
  /* coberta oberta (obertura de 115° cap endavant) i anelles de tall a banda i banda */
  const parts=[[sweepGeo(W,r-0.0006,14,op,Math.PI*2-op,front),new THREE.Matrix4()]];
  for(const i of [0,W.P.length-1]){ const g=new THREE.RingGeometry(ri,r,20); g.lookAt(W.T[i]); g.translate(W.P[i].x,W.P[i].y,W.P[i].z); parts.push([g,new THREE.Matrix4()]); }
  const jm=ictMesh(mergeParts(parts),cableColor(e.tram,e.tech,REAL.pt50),el,Object.assign({real:REAL.pt50, std:{roughness:0.7,metalness:0,side:THREE.DoubleSide}},base));
  addProxy(jm,sweepGeo(W,0.02,4));
  /* nucli en pas: 8 grups de parells cablejats en hèlix (representació simplificada dels parells que continuen) */
  const Wd=denseSamples(new THREE.LineCurve3(W.P[0],W.P[W.P.length-1]),0.004), core=[];
  for(let k=0;k<8;k++) core.push([sweepGeo(helixSamples(Wd,0.0033,0.09,k*Math.PI/4,front),0.0021,6,0,Math.PI*2,null,true),new THREE.Matrix4(),k%2?PAIRC.b[(k>>1)%5]:PAIRC.a[(k>>1)%5]]);
  ictMesh(mergeParts(core),0xFFFFFF,el,Object.assign({real:0xFFFFFF, vcol:true, std:{roughness:0.5,metalness:0,vertexColors:true}},base));
  /* 10 parells extrets: surten per l'obertura, van en cinta horitzontal (el primer a dalt) i pugen a la regleta per sota */
  const conds=[]; let mid=null;
  for(let p=1;p<=10;p++){
    const n=10*(f-1)+p, ox=(p-5.5)*0.0009, yl=y+1.86+(10-p)*0.003, kx=krX(RSK.x,p), zl=-4.686;
    const path=polyCurve(P([[xp+ox,y+w0+0.015,zp+0.0058],[xp+ox,yl,zp+0.0058],[xp+ox,yl,zl],[kx,yl,zl],[kx,y+RSK.y-KR.h/2,zl]]),0,CBL.pair.rb,{key:`xd_pt_s${f}`,rb:CBL.pair.rb});
    const Sd=denseSamples(path,0.0025); conds.push(...twistedPair(Sd,pairCols(n))); if(p===5) mid=Sd;
  }
  const pm=ictMesh(mergeParts(conds),0xFFFFFF,el,{cable:`xd_pt_s${f}`, tram:e.tram, tech:e.tech, svc:e.svc, real:0xFFFFFF, vcol:true, std:{roughness:0.5,metalness:0,vertexColors:true}});
  addProxy(pm,sweepGeo(mid,0.012,4));
  G.cables[`xd_pt_s${f}`]={key:`xd_pt_s${f}`, el, pts:mid.P, mesh:pm, from:`rs_${f}`, to:`bucle_${f}`, via:null};
}

/* ===================================================================
   ICT: geometria + connexions
   =================================================================== */
/* canalització principal (RD 346/2011): 6 tubs de Ø50 mm — RTV, 2 de coaxial (TBA), fibra, parells i reserva */
const RX={rtv:0.55, tba1:0.675, fo:0.80, tba2:0.925, pt:1.05, res:1.175}, RZ=-4.56, RPR=0.025;
const DER={a:0.48, b:0.68}; // derivadors dins del registre secundari (el «a», separat de la paret esquerra perquè els coaxials hi girin amb radi ≥ 33 mm)
const DPX={in:-0.0426, t1:-0.0256, t2:-0.0086, t3:0.0084, t4:0.0254, out:0.0424};   // ports F del derivador (reserva sense model glTF)
let TAPTX={};
function tapText(txt,w,h){ return TAPTX[txt] ||= canvasTex(w,h,(g)=>{ g.clearRect(0,0,w,h); g.fillStyle='#34373B';
  g.font=`500 ${Math.round(h*0.8)}px Menlo, Consolas, "DejaVu Sans Mono", monospace`; g.textBaseline='middle'; g.fillText(txt,1,h/2+1); }); }
const DERPORT={}; // extrems dels connectors F: planta, baixant i port
const RSK={x:1.40, y:1.95};          // regleta de parells dins del registre secundari (per sobre de la finestra del sangrat)
/* Registre secundari (x 0,325–1,575; placa del fons a z = −4,725). Ordre del cablejat, amb coordenades relatives a yb(f):
   - coaxials de dispersió: baixen 2 cm alineats amb el port, giren a un carril horitzontal arran de placa (zP) per sota
     dels derivadors i pugen per una columna pròpia junt a la paret del seu costat; dalt de tot avancen fins a la z del
     seu tub (el de RTV és el més alt). Carrils i columnes estan imbricats perquè no es creuïn; els coaxials del derivador
     «a» que van a la dreta passen per davant (zF) dels que van a l'esquerra des del «b».
   - fibra i parells de dispersió: pugen des de la caixa de segregació i la regleta i van horitzontals a l'alçada del seu tub,
     per davant de les columnes de coaxial.
   - baixants (RTV, fibra i mànega) dins dels tubs de la canalització principal en posicions fixes (RISE). */
const RSW={zP:-4.706, zF:-4.686, zIn:-4.64, yLoop:1.453};
const TAPR={a:{t1:{lane:1.43,col:0.388}, t2:{lane:1.42,col:0.3795}, t3:{lane:1.285,col:1.538,fwd:true}, t4:{lane:1.295,col:1.5295,fwd:true}},
            b:{t1:{lane:1.41,col:0.371}, t2:{lane:1.40,col:0.3625}, t3:{lane:1.305,col:1.521}, t4:{lane:1.315,col:1.5125}}};
const RISE={a:[RX.rtv-0.008,RZ], b:[RX.rtv+0.008,RZ], fo:[RX.fo,RZ]};   // posició (x, z) dels baixants dins dels tubs (Ø50)
const CSEG={x:0.95, y:1.5, z:-4.685, gz:-4.66, xf:0.86, gx:{A:0.91, D:0.94, C:1.00, B:1.03}};   // caixa de segregació (a la placa) i premsaestopes
const RCS=0.10;   // radi de corba dels tubs de la canalització secundària (i dels cables que hi van a dins)
const RCI=0.035;  // radi de corba dels tubs de la xarxa interior (≥ radi mínim del RG-6, 33 mm)
const RPW=0.085;  // registre de presa: caixa de 85 × 85 mm centrada a 35 cm del terra (la BAT de 80 × 80 mm la tapa)
const DINS=0.025; // tram de tub que entra dins d'un registre o recinte (en surt el cable), per veure per on arriba
const RIT=0.010;  // xarxa interior d'usuari: un tub de Ø20 mm (mínim RD 346/2011) del RTR a cada registre de presa
const DXI=0.0045; // presa doble: dos cables al mateix tub de Ø20, desplaçats ±DXI (vegeu inTube) sense tocar-se ni sortir-ne
const OFF={a:[-0.03,-0.02], b:[0.03,0.02]};
const mx=(u,x)=> (u.s==='A'||u.s==='D') ? x : -x;   // disposició A (x negatiu); B i C reflectits en x; C i D reflectits en z (vegeu building.js)

function buildICT(){
  const C={reg:0x6F7F8F, regLid:0x8D9AA8, box:0xE8E8E8, dark:0x3A3F45, eq:0x4A5560, pt:0x6E5A2A};
  /* --- Arqueta d'entrada (coberta per una tapa) --- */
  const ax=4.5, az=7.0;
  iBox('arqueta',1.0,0.06,1.0,ax,-0.92,az,0x8A8A85);
  iBox('arqueta',1.0,0.86,0.08,ax,-0.5,az-0.46,0x9C9C96); iBox('arqueta',1.0,0.86,0.08,ax,-0.5,az+0.46,0x9C9C96);
  iBox('arqueta',0.08,0.86,1.0,ax-0.46,-0.5,az,0x9C9C96); iBox('arqueta',0.08,0.86,1.0,ax+0.46,-0.5,az,0x9C9C96);
  iBox('arqueta',1.04,0.05,1.04,ax,0.0,az,0x55595E,{lidOf:'arqueta'});
  /* --- Canalització externa i enllaç inferior --- */
  /* RD 346/2011: externa, 4 tubs de Ø63 mm; enllaç inferior, el mateix nombre (Ø40–63 segons els cables: aquí Ø63 per
     l'alimentació de parells, Ø18 mm i radi de corba de 18 cm). Un tub per cable: fibra (2 operadors), parells i reserva.
     Cada cable va per l'eix del seu tub amb el mateix radi de corba (RAL), de manera que no en surt a les cantonades. */
  const RAL=0.25, ALX={fo2:-0.105, fo:-0.035, pt:0.035, res:0.105}, alInf=dx=>[[ax+dx,-0.5,5.0],[ax+dx,-0.5,4.62,RAL]];
  const alUp=dx=>[[ax+dx,2.55,4.62,RAL],[ax+dx,2.55,-3.48+dx,RAL]];
  for(const dx of Object.values(ALX)){
    /* les boques entren uns 2,5 cm dins de l'arqueta, del registre d'enllaç i del RITI (DINS) */
    tube('canal_ext',[[ax+dx,-0.5,6.58+DINS],[ax+dx,-0.5,5.0]],0.0315,{mouth:0});
    tube('canal_enllac_inf',[...alInf(dx),[ax+dx,0.395+DINS,4.62]],0.0315,{R:RAL, mouth:1});
    tube('canal_enllac_inf',[[ax+dx,0.845-DINS,4.62],...alUp(dx),[3.3,2.55,-3.48+dx]],0.0315,{R:RAL, mouth:2});
  }
  /* PEG: pas a través del fonament */
  iCyl('peg',0.17,0.42,ax,-0.5,4.9,0xD08A3A,'z');
  iBox('peg',0.5,0.5,0.03,ax,-0.5,5.12,0xE6B47A,{opacity:0.9});
  /* Registre d'enllaç inferior */
  regBox('reg_enllac_inf',0.5,0.5,0.25,ax,0.62,4.6,C.reg,C.regLid);
  /* Xarxes d'alimentació: un cable per tub (vegeu ALX) */
  /* fibra: dos operadors, cadascun amb el seu cable fins al premsaestopes de la seva CTO (vegeu CTO_FO) */
  const foTail = op => { const g=CTO_FO.ops[op].gland; return [[CTO_FO.cx,2.05,g[2]],[CTO_FO.cx,g[1]+0.05,g[2]],[CTO_FO.cx+0.02,g[1],g[2]],g]; };
  for(const [k,el,tail] of [['fo','xal_fo',foTail(0)],['fo2','xal_fo',foTail(1)],['pt','xal_pt',[[2.688,2.05,-4.6],[2.688,1.84,-4.705],[2.688,1.50,-4.705]]]]){
    const dx=ALX[k];
    const x=ax+dx, tx=tail[0][0];
    cable(`xal_${k}_1`, el, [[x,-0.55,14],[x,-0.55,7.55],[x,-0.75,7.2],[x,-0.75,6.8]], {from:'operador', to:'arqueta'});
    cable(`xal_${k}_2`, el, [[x,-0.75,6.8],[x,-0.5,6.68],[x,-0.5,5.0]], {from:'arqueta', to:'peg', via:'canal_ext'});
    cable(`xal_${k}_3`, el, [...alInf(dx),...alUp(dx),[tx,2.55,-3.48+dx],...tail], {from:'peg', to: el==='xal_fo'?'pi_fo':'pi_pt', via:'canal_enllac_inf'});
  }
  /* --- RITI: registres principals i punts d'interconnexió --- */
  regBox('rp_fo',0.75,1.0,0.3,2.05,1.45,-4.6,C.reg,C.regLid);   // les CTO del punt d'interconnexió òptic es construeixen a buildRITIFibre()
  regBox('rp_pt',0.6,1.0,0.3,2.95,1.45,-4.6,C.reg,C.regLid);
  buildEnclosures(); buildRITS(); buildRITIFibre(); buildRITIPairs();
  /* --- Canalització principal: 6 tubs de Ø50 mm, interromputs pels registres secundaris --- */
  /* cada tram entra DINS dins dels registres secundaris (parets de 25 mm a y+0,95 i y+2,65) */
  const breaks=[[2.2,3.975+DINS],[5.625-DINS,6.975+DINS],[8.625-DINS,9.975+DINS],[11.625-DINS,12.975+DINS],[14.625-DINS,14.96]];
  for(const [k,x] of Object.entries(RX)) for(const [y0,y1] of breaks)
    tube('canal_principal',[[x,y0,RZ],[x,y1,RZ]],RPR,{tubeSvc:k.replace(/\d/,''), mouth:2});
  /* --- Registres secundaris --- */
  for(const f of [1,2,3,4]){
    const y=yb(f);
    regBox(`rs_${f}`,1.3,1.7,0.4,0.95,y+1.8,-4.55,C.reg,C.regLid);
    buildSecTrunk(f,C);
    for(const c of ['a','b']){
      if(MODELS.deriv?.scene){
        const ms=placeModel('deriv',`deriv_${f}`,DER[c],y+1.55,-4.715);
        for(const m of ms) G.pick.push(m);
        /* valor de derivació i referència d'aquesta planta, a la posició que tenen a la serigrafia del plànol */
        for(const [txt,dx,dy,w] of [[`${TAPF[f].db}dB`,-0.0276,-0.0033,0.0072],[`${TAPF[f].ref}/F 4D`,0.0314,-0.0003,0.0186]]){
          const tm=rPlane(`deriv_${f}`,w,0.0026,V(DER[c]+dx,y+1.55+dy,-4.715+0.0186),V(0,0,1),tapText(txt,Math.round(w*20000),52)); tm.material.alphaTest=0.5; }
        const pg=new THREE.BoxGeometry(0.14,0.12,0.08); pg.translate(DER[c],y+1.55,-4.706);
        addProxy(ms[0],pg);
        if(f===1){
          if(MODELS.carrega?.scene){
            const mc=placeModel('carrega','deriv_1',DER[c]+0.0424,y+1.523,-4.706,{},[Math.PI,0,0]);
            for(const m of mc) G.pick.push(m);
          } else {
            iCyl('deriv_1',0.006,0.02,DER[c]+DPX.out,y+1.513,-4.706,0x222222,'y',{pick:false});
          }
        }
      } else {
        iBox(`deriv_${f}`,0.109,0.054,0.018,DER[c],y+1.55,-4.706,0xD7DCE2);                            // reserva: 109 × 54 × 18 mm
        if(f===1) iCyl('deriv_1',0.006,0.02,DER[c]+DPX.out,y+1.513,-4.706,0x222222,'y',{pick:false});
      }
      /* connectors F dels cables (la femella del port és al model del derivador); DERPORT: on comença cada cable */
      const ports=DERPORT[`${f}${c}`]={}, us={t1:'A',t2:'D',t3:'C',t4:'B'};
      for(const name of ['in','out','t1','t2','t3','t4']){
        if(name==='out' && f===1) continue; // càrrega terminal en lloc de cable
        const mp=modelPoint('deriv',name), q=mp||{x:DPX[name], y:-0.0267, z:0.009};
        const tip=V(DER[c]+q.x,y+1.55+q.y,-4.715+q.z), dir=V(0,-1,0);
        const el=us[name]?`xs_rtv_${f}${us[name]}`:'xd_rtv';
        ports[name]=coaxPlug(el,tip.addScaledVector(dir,-0.004),dir);
      }
    }
    /* caixa de segregació de fibra a la placa del fons; premsaestopes: distribució per sota i per dalt, escomeses per dalt */
    iBox(`cseg_${f}`,0.22,0.34,0.08,CSEG.x,y+CSEG.y,CSEG.z,0xF2F2F2);
    iBox(`cseg_${f}`,0.16,0.06,0.02,CSEG.x,y+CSEG.y+0.06,CSEG.z+0.045,0x0AA5C2,{pick:false});
    { const gl=[], cy=new THREE.CylinderGeometry(0.0065,0.0065,0.012,12), M=(x,yy)=>new THREE.Matrix4().makeTranslation(x,yy,CSEG.gz);
      for(const x of [CSEG.xf,...Object.values(CSEG.gx)]) gl.push([cy,M(x,y+CSEG.y+0.176),0x3A3F45]);
      gl.push([cy,M(CSEG.xf,y+CSEG.y-0.176),0x3A3F45]);
      ictMesh(mergeParts(gl),0xFFFFFF,`cseg_${f}`,{std:{roughness:0.8,metalness:0,vertexColors:true}}); }
    /* punt de distribució de parells: regleta Krone de 10 parells sobre placa (entrada per sota des del sangrat, sortida per dalt) */
    rBox(`bucle_${f}`,RSK.x-0.085,RSK.x+0.085,y+RSK.y-0.04,y+RSK.y+0.04,-4.725,-4.715,0xB9BEC2,'galv',{pick:true});
    kroneModule(`bucle_${f}`,RSK.x,y+RSK.y,-4.715);
  }
  buildPairRiser();
  /* --- El sistema de captació (torre, antenes, parabòlica), l'enllaç superior i el RITS es construeixen a antenes.js i rits.js --- */
  /* --- Xarxa de distribució de RTV (2 cables, de dalt a baix) ---
     entrada: baixa del tub superior, passa per davant del derivador i fa un bucle (radi 33 mm) per entrar al port per sota;
     sortida: baixa 2 cm, gira endavant per sota dels carrils i torna a la seva posició dins del tub inferior. */
  const inRS=(c,y)=>{ const [tx,tz]=RISE[c], p=DERPORT[`${y/3}${c}`].in, x=p.x, yl=y+RSW.yLoop;
    return [[tx,y+2.05,tz],[x,y+1.80,RSW.zIn],[x,yl,RSW.zIn],[x,yl,RSW.zP],p]; };
  const outRS=(c,y)=>{ const [tx,tz]=RISE[c], p=DERPORT[`${y/3}${c}`].out, x=p.x, yl=y+RSW.yLoop;
    const d=Math.abs(x-tx);   // desplaçament curt fins a la posició dins del tub (Ø50): en diagonal suau, no amb dues cantonades seguides
    return [p,[x,yl,RSW.zP],[x,yl,tz],...(d<1e-3?[]:d<0.07?[[tx,yl-0.12,tz]]:[[tx,yl,tz]])]; };
  for(const c of ['a','b']){
    const [tx,tz]=RISE[c];
    cable(`xd_rtv_${c}_4`,'xd_rtv',[RITS_EXIT[c],[tx,14.80,tz],...inRS(c,12)],{from:'cap_mix', to:'deriv_4', via:'canal_principal'});
    for(const f of [3,2,1]) cable(`xd_rtv_${c}_${f}`,'xd_rtv',[...outRS(c,yb(f+1)),...inRS(c,yb(f))],{from:`deriv_${f+1}`, to:`deriv_${f}`, via:'canal_principal'});
  }
  /* --- Xarxa de distribució de fibra (de baix a dalt): entra i surt de la caixa de segregació pels premsaestopes;
         a sobre de la caixa es desplaça a x = 0,80 arran de placa, per darrere dels carrils de dispersió --- */
  const [fx,fz]=RISE.fo, gz=CSEG.gz, xf=CSEG.xf;
  const foIn = y => [[fx,y+1.02,fz],[xf,y+1.22,gz],[xf,y+CSEG.y-0.17,gz]];
  const foOut= y => [[xf,y+CSEG.y+0.17,gz],[xf,y+1.74,gz],[fx,y+1.86,-4.70],[fx,y+2.42,-4.70],[fx,y+2.54,fz]];
  const go=CTO_FO.out;
  cable('xd_fo_0','xd_fo',[go,[go[0],2.03,go[2]],[fx,2.03,fz],...foIn(3)],{from:'pi_fo', to:'cseg_1', via:'canal_principal'});
  for(const f of [1,2,3]) cable(`xd_fo_${f}`,'xd_fo',[...foOut(yb(f)),...foIn(yb(f+1))],{from:`cseg_${f}`, to:`cseg_${f+1}`, via:'canal_principal'});

  /* --- Per habitatge --- */
  for(const u of UNITS) buildUnit(u, C);
  flushMouths();
}

/* canalització secundària (RD 346/2011), a cada costat del distribuïdor (esquerra: A i D; dreta: B i C):
   - tram comunitari: 4 tubs de Ø25 mm (atén 2 PAU), un per servei, del registre secundari (cara x = 0,3 o 1,6) al
     registre de pas, pel sostre del distribuïdor. Entren al registre de pas per la cara lateral (z = RPS.zf).
   - registre de pas (tipus A, 360 × 360 × 120 mm) a la paret del distribuïdor (x = ±2), sobre la mitgera z = −5.
   - accés: 3 tubs de Ø25 mm per habitatge (RTV; parells i fibra; TBA) des del fons del registre de pas, per dins de la
     paret, fins al RTR. h1: alçada d'arribada al RTR (1.26, 1.52, 1.78); al registre de pas, 2.20–2.52. */
const CS_H2 = h1 => 2.2 + (h1-1.26)/0.26*0.16;
const CSR=0.0125;
const RPD=0.012;  // el registre de pas és poc fondo (12 cm): els tubs només hi entren 12 mm   // tubs de Ø25 mm
const CSC={rtv:{h:2.52,z:-4.55}, fo:{h:2.40,z:-4.45}, pt:{h:2.32,z:-4.62}, tba:{h:2.20,z:-4.55}};   // tram comunitari (alçada i z)
const RPS={x:1.94, y:2.36, z:-5.0, zf:-4.82, w:0.36, d:0.12, zA:-4.90};   // registre de pas (|x| del centre); zA: z dels tubs d'accés de A/B
const cscPath = (R,y,k) => { const c=CSC[k]; return [[R<0?0.335:1.565,y+c.h,c.z],[R*RPS.x,y+c.h,c.z],[R*RPS.x,y+c.h,RPS.zf-0.02-RPD]]; };
/* desplaçament d'un cable dins del tram comunitari (s: mig pas). x: cap al fons del registre de pas el de l'habitatge que
   gira primer (A, B), cap enfora el que passa per davant seu (D, C); y: més alt el que passa per sobre de les columnes dels
   altres dins del registre secundari; z: perpendicular a la corba del sostre (x → −z) respecte del cable de l'altre habitatge.
   Al tub d'accés, cscW: separats només en y i z (mai en la direcció d'una corba), conservant l'ordre en alçada. */
const cscV = (u,s,up) => { const vx=mx(u,ZM(u)?s:-s); return [vx, up?s:-s, XS(u)===1?-vx:vx]; };
const cscW = (u,up) => { const a=up?0.004:-0.004; return [0, a, ZM(u)?-a:a]; };
function buildSecTrunk(f, C){
  const y=yb(f);
  for(const [R,k] of [[-1,'e'],[1,'d']]){
    for(const t of Object.keys(CSC)) tube(`csc_${f}${k}`,cscPath(R,y,t),CSR,{tubeSvc:t, R:RCS, mouth:2});
    /* registre de pas: caixa amb tapa cap al distribuïdor (−x a la dreta, +x a l'esquerra) */
    const el=`rps_${f}${k}`, yc=y+RPS.y, h=RPS.w, w=RPS.w, d=RPS.d, t=0.02, xc=R*RPS.x;
    iBox(el,t,h,w,R*(2.0-t/2),yc,RPS.z,C.reg);
    for(const sg of [-1,1]){ iBox(el,d,h,t,xc,yc,RPS.z+sg*(w/2-t/2),C.reg); iBox(el,d,t,w,xc,yc+sg*(h/2-t/2),RPS.z,C.reg); }
    iBox(el,0.03,h+0.02,w+0.02,R*(RPS.x-d/2-0.012),yc,RPS.z,C.regLid,{lidOf:el});
  }
}
/* PAU de fibra (Televes 231502) al RTR de l'habitatge u: origen (centre de la cara posterior), gir, cara ampla dels SC i
   punts del model (sc1…sc4, entrada_d, entrada_e). La sortida 1 cau sempre a X(-3.16), sigui quina sigui l'orientació. */
const PFD={sc1:[-0.04123,-0.05004,0.0235], sc2:[-0.02158,-0.05004,0.0235], entrada_d:[0.0597,0.02334,0.007], entrada_e:[-0.0597,0.02334,0.007]};
function pauFoPos(u){
  const sz=SZ(u), rot=sz<0?Math.PI:0, q=new THREE.Quaternion().setFromAxisAngle(UP,rot);
  const pt=n=>(modelPoint('pauFo',n)||new THREE.Vector3(...PFD[n])).applyQuaternion(q);
  const PO=new THREE.Vector3(mx(u,-3.16),yb(u.f)+1.645,mz(u,-4.722)).sub(new THREE.Vector3(pt('sc1').x,0,0));
  return {PO, rot, side:new THREE.Vector3(sz<0?-1:1,0,0), at:n=>PO.clone().add(pt(n))};
}
/* PAU + repartidor de RTV (Televes 519534, sense logotip): 109 × 54 × 18 mm, cargolat a la paret del fons del RTR amb els
   sis connectors F cap avall (entrada, entrada carregada i 4 sortides, a 17 mm). El model no es reflecteix (serigrafia):
   a les vivendes C i D està girat 180°, així que l'ordre dels ports en x depèn de l'habitatge. at(n): boca del port n. */
const PRD={in:-0.0426, inc:-0.0256, o1:-0.0086, o2:0.0084, o3:0.0254, o4:0.0424};
function pauRtvPos(u){
  const sz=SZ(u), rot=sz<0?Math.PI:0, q=new THREE.Quaternion().setFromAxisAngle(UP,rot);
  const pt=n=>(modelPoint('pauRtv',n)||new THREE.Vector3(PRD[n],-0.0267,0.009)).applyQuaternion(q);
  const PO=new THREE.Vector3(mx(u,-3.48),yb(u.f)+1.60,mz(u,-4.722));
  return {PO, rot, at:n=>PO.clone().add(pt(n))};
}
/* PAU de TBA coaxial: repartidor 2D de 5–1220 MHz (Televes 519602, sense logotip), 74 × 54 × 18 mm, cargolat a la paret
   del fons del RTR, sota el PAU de RTV, amb els tres connectors F cap avall: entrada (x −25,6 mm) i 2 sortides (8,4 i 25,4).
   Com el de RTV, no es reflecteix: a les vivendes C i D està girat 180°. at(n): boca del port n. */
const PTD={in:-0.0256, o1:0.0084, o2:0.0254};
function pauTbaPos(u){
  const sz=SZ(u), rot=sz<0?Math.PI:0, q=new THREE.Quaternion().setFromAxisAngle(UP,rot);
  const pt=n=>(modelPoint('pauTba',n)||new THREE.Vector3(PTD[n],-0.0267,0.009)).applyQuaternion(q);
  const PO=new THREE.Vector3(mx(u,-3.30),yb(u.f)+1.38,mz(u,-4.722));
  return {PO, rot, at:n=>PO.clone().add(pt(n))};
}
/* tub d'accés: del fons del registre de pas, per dins de la paret, fins al lateral del RTR */
function csPath(u, y, h1){
  const h2=y+CS_H2(h1), H1=y+h1, R=XS(u)===1 ? -1 : 1, zA=mz(u,RPS.zA), zr=mz(u,-4.58);
  return [[R*(1.98-RPD),h2,zA],[R*2.45,h2,zA],[R*2.45,H1,zr],[R*(2.725+DINS),H1,zr]];
}
function buildUnit(u, C){
  const y=yb(u.f), id=u.id, X=x=>mx(u,x), Z=z=>mz(u,z), sz=SZ(u);
  for(const [yy,svc] of [[1.78,'rtv'],[1.52,'all'],[1.26,'tba']]) tube(`cs_${id}`,csPath(u,y,yy),CSR,{tubeSvc:svc, R:RCS, mouth:2});
  /* registre de terminació de xarxa (C i D: tapa cap a -z) */
  regBox(`rtr_${id}`,1.0,0.8,0.3,X(-3.2),y+1.5,Z(-4.6),0xE9E6DF,0xF4F2EE,SZ(u));
  /* dispersió: dins del registre secundari, recorreguts ordenats (vegeu RSW); dins dels tubs, el camí del tub traslladat
     un vector fix (mateix radi de corba RCS), de manera que el cable no en surt ni a les corbes: v al tram comunitari
     (cscV, compartit amb l'altre habitatge del costat) i w al tub d'accés. Al registre de pas, el cable baixa pel lateral
     fins a la z del seu tub d'accés i gira cap al fons. */
  const R=XS(u)===1?-1:1, zA=mz(u,RPS.zA);
  const accIn=(ap,w)=>[...inTube(ap.slice(0,-1),w,RCS), ap[ap.length-1].map((q,i)=>q+w[i])];
  /* surt recte per la boca i gira fora del tub; si el tub d'accés és pràcticament a la mateixa alçada, sense vèrtex a la boca */
  const viaRPS=(k,v,ap,w)=>{ const c=inTube(cscPath(R,y,k).slice(1),v,RCS), m=[R*RPS.x+v[0],ap[0][1]+w[1],zA+w[2]];
    return [c[0], ...(Math.abs(c[1][1]-m[1])<0.01?[]:[c[1].slice(0,3)]), m, ...accIn(ap,w).slice(1)]; };
  const port={A:'t1',D:'t2',C:'t3',B:'t4'}[u.s];
  for(const c of ['a','b']){
    const up=(R<0)===(c==='a'), w=cscW(u,up), v=cscV(u,0.0037,up), tp=csPath(u,y,1.78), t=TAPR[c][port];
    /* la columna puja arran de placa (per darrere dels carrils de fibra i parells) i avança fins a la z del tub just a sota
       de la sortida (el tub de RTV és el més alt, a 2,52) */
    const pe=DERPORT[`${u.f}${c}`][port], x=pe.x, z0=t.fwd?RSW.zF:RSW.zP, zt=CSC.rtv.z+v[2], H=y+CSC.rtv.h+v[1];
    const rs=[pe, ...(t.fwd?[[x,y+1.475,RSW.zP],[x,y+1.445,z0]]:[]), [x,y+t.lane,z0],[t.col,y+t.lane,z0],[t.col,y+2.41,z0],[t.col,H-0.066,zt],[t.col,H,zt]];
    /* RTR: el cable 1 (blanc) va a l'entrada del PAU i el 2 (negre) a l'entrada carregada (reserva). Els ports miren avall:
       el cable baixa per davant del PAU, fa una U (radi 33 mm) i puja fins al connector. El que va més lluny baixa més endavant per no tocar l'altre. */
    const PR=pauRtvPos(u), E=PR.at(c==='a'?'in':'inc').add(V(0,0.004-FC_LENGTH,0)), yu=E.y-0.06;
    const far=Math.abs(PR.at(c==='a'?'in':'inc').x-tp[tp.length-1][0]) > Math.abs(PR.at(c==='a'?'inc':'in').x-tp[tp.length-1][0]), zf=E.z+sz*(far?0.084:0.068);
    const te=tp[tp.length-1][1]+w[1];                                                   // alçada d'entrada al RTR
    const tail = [[E.x,te,zf],[E.x,yu,zf],[E.x,yu,E.z],[E.x,E.y,E.z]];
    cable(`xs_rtv_${c}_${id}`, `xs_rtv_${id}`, [...rs,...viaRPS('rtv',v,tp,w),...tail], {tram:'disp',tech:'coax',svc:'rtv',from:`deriv_${u.f}`, to:`pau_rtv_${id}`, via:`cs_${id}`});
  }
  /* fibra: de la caixa de segregació puja i va horitzontal a l'alçada del tub; entra al PAU de fibra pel pretallat lateral
     del costat del tub, amb un passacables de goma */
  { const gx=CSEG.gx[u.s], w=cscW(u,true), v=cscV(u,0.004,ZM(u)), tp=csPath(u,y,1.52), zt=CSC.fo.z+v[2], H=y+CSC.fo.h+v[1], dz=Math.abs(zt-CSEG.gz), E=tp[tp.length-1][1]+w[1];
    const pf=pauFoPos(u), ed=pf.at('entrada_d'), ee=pf.at('entrada_e'), en=Math.abs(ed.x-X(-2.96))<Math.abs(ee.x-X(-2.96))?ed:ee, out=Math.sign(X(-2.96)-en.x);
    rCyl(`pau_fo_${id}`,0.0036,0.003,V(en.x+out*0.001,en.y,en.z),V(1,0,0),0x2A2D31,'rubber',{r2:0.0036});
    cable(`xs_fo_${id}`, `xs_fo_${id}`, [[gx,y+CSEG.y+0.17,CSEG.gz],[gx,y+1.72,CSEG.gz],[gx,y+1.72+dz,zt],[gx,H,zt],...viaRPS('fo',v,tp,w),
      [X(-2.96),E,en.z],[X(-2.96),en.y,en.z],[en.x-out*0.008,en.y,en.z]], {tram:'disp',tech:'fo',svc:'fo',from:`cseg_${u.f}`, to:`pau_fo_${id}`, via:`cs_${id}`}); }
  /* parells: escomesa de 2 parells des de la sortida (part de dalt) de la regleta; la del D passa per darrere de les del
     C i el B, i la del B per sobre de la columna del C */
  { const kx=krX(RSK.x,2*'ABCD'.indexOf(u.s)+1.5), w=cscW(u,false), v=cscV(u,0.004,(R<0)===ZM(u)), tp=csPath(u,y,1.52), zt=CSC.pt.z+v[2], H=y+CSC.pt.h+v[1], E=tp[tp.length-1][1]+w[1];
    const z0=-4.69, pp=X(-2.86);   // parells 1-2 (A), 3-4 (B), 5-6 (C), 7-8 (D); el 9 i el 10 lliures
    const col = u.s==='D' ? [[kx,y+2.20,z0],[kx,y+2.23,-4.66],[kx,H,-4.66],[1.28,H,-4.66],[1.22,H,zt]]
              : (yy=>[[kx,y+yy,z0],[kx,y+yy+Math.abs(zt-z0),zt],[kx,H,zt]])(u.s==='C'?2.16:2.00);
    cable(`xs_pt_${id}`, `xs_pt_${id}`, [[kx,y+RSK.y+0.014,z0],...col,...viaRPS('pt',v,tp,w),[pp,E,Z(-4.705)],[pp,y+1.69,Z(-4.712)]], {tram:'disp',tech:'pt',svc:'pt',from:`bucle_${u.f}`, to:`pau_pt_${id}`, via:`cs_${id}`}); }
  buildInterior(u);
}

/* Posició dels registres de presa (disposició A; B reflectit).
   x, z: centre del registre; dir: cap on mira la placa (+1 → +z, -1 → -z); yl: alçada del tub al terra */
const PPOS = {
  dat_cuina:{x:-6.85,z:-1.89,dir:-1,yl:0.16}, rtv_cuina:{x:-7.2,z:-1.89,dir:-1,yl:0.16},
  tba_sala:{x:-7.4,z:-1.71,dir:1,yl:0.07}, rtv_sala:{x:-6.95,z:-1.71,dir:1,yl:0.07}, dat_sala:{x:-6.3,z:-1.71,dir:1,yl:0.07}, fo_sala:{x:-5.92,z:-1.71,dir:1,yl:0.07},
  dat2_sala:{ax:'x',x:-7.71,z:2.6,dir:1,yl:0.07},
  rtv_d2:{x:-4.0,z:-2.11,dir:1,yl:0.25}, dat_d2:{x:-3.65,z:-2.11,dir:1,yl:0.25},
  rtv_d1:{x:-4.2,z:1.69,dir:1,yl:0.16}, tba_d1:{x:-3.88,z:1.69,dir:1,yl:0.16}, dat_d1:{x:-3.5,z:1.69,dir:1,yl:0.16},
  dat2_d1:{ax:'x',x:-4.36,z:2.75,dir:1,yl:0.07},
  conf:{x:-2.45,z:-4.71,dir:1,yl:0.5}
};
const EXIT_ORDER = ['dat_cuina','rtv_cuina','tba_sala','rtv_sala','dat_sala','fo_sala','dat2_sala','rtv_d2','dat_d2','rtv_d1','tba_d1','dat_d1','dat2_d1','conf'];
function dedupe(pts){ const o=[]; for(const p of pts){ const l=o[o.length-1]; if(!l || Math.hypot(l[0]-p[0],l[1]-p[1],l[2]-p[2])>1e-4) o.push(p); } return o; }

/* multiplexor passiu RJ45 de l'RTR (1 entrada, 8 sortides telefòniques i 1 sortida ADSL), 142 × 60 × 24 mm.
   Disposició del frontal en mm des de la cantonada superior esquerra; MUXJ() retorna [lx, ly] en metres des del centre. */
const MUX={W:0.142, H:0.06, D:0.024, cols:[17,37,57,77], rows:[20,42], rx:118, ry:{adsl:17, line:42}};
const MUXJ = n => { const mp=modelPoint('mux', typeof n==='number' ? 'j'+n : n); if(mp) return [mp.x,mp.y];   // boques del model glTF
  return n==='line' ? [(MUX.rx-71)/1000,(30-MUX.ry.line)/1000] : n==='adsl' ? [(MUX.rx-71)/1000,(30-MUX.ry.adsl)/1000]
                 : [(MUX.cols[(n-1)%4]-71)/1000,(30-MUX.rows[Math.floor((n-1)/4)])/1000]; };
/* cables interiors de parells trenats a l'RTR: a les BAT dobles de la sala i del dormitori 1, una boca és de telefonia
   (sortida del multiplexor) i l'altra de dades (latiguillo de l'encaminador); la resta queden lliures amb el connector RJ45 */
const MUXOUT={dat_sala_a:1, dat_d1_a:2};
const PATCHED={dat_sala_b:-2.95, dat_d1_b:-2.77};
const FREEEND={dat2_sala:-2.91, dat_cuina:-2.88, dat_d2:-2.85, dat2_d1:-2.82};
let MUX_TEX=null;
function muxTex(){ return MUX_TEX ||= canvasTex(568,240,(g,w,h)=>{ const k=4;
  g.fillStyle='#2C2E31'; g.fillRect(0,0,w,h); g.strokeStyle='#45484C'; g.lineWidth=6; g.strokeRect(3,3,w-6,h-6);
  const jack=(xm,ym)=>{ const x=xm*k, y=ym*k; g.fillStyle='#4A4D51'; g.fillRect(x-30,y-26,60,50); g.fillStyle='#0E0F10'; g.fillRect(x-24,y-20,48,38);
    g.fillStyle='#C9A13A'; for(let i=0;i<8;i++) g.fillRect(x-17+i*4.6,y-18,2.4,10); g.fillStyle='#0E0F10'; g.fillRect(x-8,y+14,16,8); };
  g.fillStyle='#8D9196'; g.font='600 20px Arial, sans-serif'; g.textAlign='center'; g.textBaseline='middle';
  MUX.rows.forEach((ry,r)=>MUX.cols.forEach((cx,c)=>{ jack(cx,ry); g.fillText('☎ '+(r*4+c+1), cx*k, (ry+9.5)*k); }));
  g.fillStyle='#36393C'; g.fillRect((MUX.rx-14)*k,5*k,28*k,51*k); g.strokeStyle='#5A5E62'; g.lineWidth=3; g.strokeRect((MUX.rx-14)*k,5*k,28*k,51*k);
  jack(MUX.rx,MUX.ry.adsl); jack(MUX.rx,MUX.ry.line);
  g.fillStyle='#8D9196'; g.font='600 16px Arial, sans-serif'; g.fillText('ADSL Out',(MUX.rx)*k,(MUX.ry.adsl+10)*k); g.fillText('Line In',(MUX.rx)*k,(MUX.ry.line+10)*k); }); }
/* ---------- connector RJ45 mascle (8P8C) ----------
   Mides reals: cos transparent d'11,7 mm d'ample, 6,6–8 mm d'alt i 21 mm de llarg; 8 contactes daurats a 1,02 mm de pas
   al costat oposat a la pestanya; conductors visibles a dins (codi T568B); pestanya de retenció; caputxó (bota) de protecció.
   Es fusiona en tres malles (cos, contactes i conductors, caputxó) per no carregar el dibuix. */
function mergeParts(list){
  const pos=[], nor=[], col=[], c=new THREE.Color();
  for(const [g0,m,hex] of list){ const g=g0.index?g0.toNonIndexed():g0.clone(); g.applyMatrix4(m);
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    if(hex!==undefined){ c.setHex(hex); for(let i=0;i<g.attributes.position.count;i++) col.push(c.r,c.g,c.b); } }
  const out=new THREE.BufferGeometry(); out.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); out.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  if(col.length) out.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); return out; }
const T568B=[0xF3D2B0,0xF07F14,0xD3EBCB,0x1F5FD0,0xCCD8F2,0x2E9B3F,0xE6D3BE,0x7A4A21];
const RJ={W:0.0117, H:0.0066, Hr:0.008, Lf:0.0135, L:0.021, out:0.041};
let RJ_GEO=null;
function rj45Geos(){
  if(RJ_GEO) return RJ_GEO;
  const B=(w,h,d)=>new THREE.BoxGeometry(w,h,d), M=(x,y,z,rx=0)=>new THREE.Matrix4().makeRotationX(rx).setPosition(x,y,z), {W,H,Hr,Lf,L}=RJ;
  const la=0.22, ll=0.013;
  const body=mergeParts([[B(W,H,Lf),M(0,0,Lf/2)],[B(W,Hr,L-Lf),M(0,(Hr-H)/2,(Lf+L)/2)],
    [B(0.0062,0.0009,ll),M(0,H/2+0.0006+Math.sin(la)*ll/2,0.0025+Math.cos(la)*ll/2,-la)],                // pestanya de retenció
    [B(0.0062,0.0016,0.002),M(0,H/2+0.0006,0.0018)]]);
  const parts=[];
  for(let i=0;i<8;i++){ const x=(i-3.5)*0.00102;
    parts.push([B(0.0007,0.0016,0.0035),M(x,-H/2+0.0005,0.0026),0xD9B44A]);                               // contacte daurat
    parts.push([B(0.0008,0.0008,0.0125),M(x,-0.0004,0.0115),T568B[i]]); }                                 // conductor
  parts.push([B(W-0.0016,0.0016,0.0028),M(0,-H/2+0.0012,0.0145),0xBFC5C9]);                                // falca de crimpat
  const det=mergeParts(parts);
  /* caputxó: cos rectangular i cua cònica de 16 mm que s'estreny fins al diàmetre del cable (Ø6,8 mm, cobreix el Cat 6 de Ø6,2) */
  const cyl=new THREE.CylinderGeometry(0.0034,0.0047,0.016,24);
  const boot=mergeParts([[B(0.0102,0.0088,0.006),M(0,(Hr-H)/2,L+0.003)],[cyl,new THREE.Matrix4().makeRotationX(Math.PI/2).setPosition(0,(Hr-H)/2,L+0.014)]]);
  return RJ_GEO={body,det,boot};
}
/* tip: punta del connector (on toca els contactes de la boca); dir: sentit d'inserció; up: costat de la pestanya.
   Retorna el punt on comença el cable (darrere del caputxó). */
function rj45(el, tip, dir, up, boot=0x8E949A){
  const z=dir.clone().normalize().negate(), yv=up.clone().sub(z.clone().multiplyScalar(up.dot(z))).normalize(), x=new THREE.Vector3().crossVectors(yv,z);
  const Mw=new THREE.Matrix4().makeBasis(x,yv,z).setPosition(tip), G0=rj45Geos();
  ictMesh(G0.body.clone().applyMatrix4(Mw),0xE4EDF1,el,{std:{roughness:0.12,metalness:0},opacity:0.55});
  ictMesh(G0.det.clone().applyMatrix4(Mw),0xFFFFFF,el,{std:{roughness:0.35,metalness:0.35,vertexColors:true}});
  ictMesh(G0.boot.clone().applyMatrix4(Mw),boot,el,{std:{roughness:0.6,metalness:0}});
  return new THREE.Vector3(0,(RJ.Hr-RJ.H)/2,RJ.out).applyMatrix4(Mw).toArray();   // eix de la cua del caputxó
}
/* empalmament RJ45 femella-femella vertical (uneix dos connectors mascles) */
function rj45Coupler(el,x,y,z){
  iBox(el,0.0165,0.03,0.0145,x,y,z,0x2A2D31,{pick:false});
  for(const s of [-1,1]) iBox(el,0.0125,0.0012,0.0085,x,y+s*0.0151,z,0x0E0F10,{pick:false});
}
/* rectangle arrodonit extrudit (centrat), per a caixes de plàstic */
function rrectGeo(w,h,d,r,bev,holes){ const s=new THREE.Shape(), x=-w/2+bev, y=-h/2+bev, W=w-2*bev, H=h-2*bev, R=Math.max(0.0005,r-bev);
  s.moveTo(x+R,y); s.lineTo(x+W-R,y); s.quadraticCurveTo(x+W,y,x+W,y+R); s.lineTo(x+W,y+H-R); s.quadraticCurveTo(x+W,y+H,x+W-R,y+H);
  s.lineTo(x+R,y+H); s.quadraticCurveTo(x,y+H,x,y+H-R); s.lineTo(x,y+R); s.quadraticCurveTo(x,y,x+R,y);
  for(const [hx,hy,hr] of holes||[]){ const h=new THREE.Path(); h.absarc(hx,hy,hr+bev,0,Math.PI*2,true); s.holes.push(h); }   // forats passants (el bisell els arrodoneix)
  const g=new THREE.ExtrudeGeometry(s,{depth:Math.max(0.0005,d-2*bev), bevelEnabled:bev>0, bevelThickness:bev, bevelSize:bev, bevelSegments:3, curveSegments:holes?28:6}); g.center(); return g; }
/* ---------- base d'accés terminal (BAT) ----------
   Placa blanca quadrada amb els connectors, com les preses comercials: RJ45 simple o doble, RTV (TV mascle + SAT femella,
   serigrafiats), coaxial de TBA (CATV, sense serigrafia) i òptica (allotjament quadrat amb l'adaptador SC/APC).
   Coordenades locals de la placa: x cap a la dreta de qui la mira de cara, y amunt, z sortint de la paret (z = 0 al centre
   del registre de presa). Es fusiona en una sola malla amb colors per vèrtex. Desa les boques a BATP[el] i retorna la boca
   de l'adaptador òptic (fo). */
const BATP={};                                                  // boques de cada BAT: {p (punt del frontal), n, t}
/* mides reals (m): placa de 80 × 80 mm i 10 mm de gruix, recolzada al frontal del registre de presa (z = BATZ) */
const BATZ=0.04, BATT=0.01, BATW=0.08, BATC={plate:0xF7F7F4, bezel:0xEDEDE9, step:0xE2E2DD, hole:0x2C2E31, strip:0x4A4D52, gold:0xD9B44A, pin:0x9A948F, ni:0xC9CCCF, cni:0x9A9FA5};
/* boca RJ45 en mm, centrada en el connector mascle (11,7 × 6,6 mm): cos a dalt (contactes) i ranures de la pestanya a baix */
const RJ45_OPEN=[[-6.1,3.6],[6.1,3.6],[6.1,-3.5],[4.7,-3.5],[4.7,-5.3],[3.4,-5.3],[3.4,-7.2],[-3.4,-7.2],[-3.4,-5.3],[-4.7,-5.3],[-4.7,-3.5],[-6.1,-3.5]];
function batPlate(el,t,dbl,C,N){
  const Rv=new THREE.Vector3().crossVectors(UP,N).normalize(), Mw=new THREE.Matrix4().makeBasis(Rv,UP,N).setPosition(C);
  const parts=[], T=(x,y,z)=>Mw.clone().multiply(new THREE.Matrix4().makeTranslation(x,y,z)), RX=new THREE.Matrix4().makeRotationX(Math.PI/2);
  const add=(g,x,y,z,hex)=>parts.push([g,T(x,y,z),hex]), ports=BATP[el]=[], port=(x,y,z,t)=>ports.push({p:new THREE.Vector3(x,y,z).applyMatrix4(Mw), n:N.clone(), t});
  const cyl=(r,h,x,y,z,hex,seg=28)=>parts.push([new THREE.CylinderGeometry(r,r,h,seg),T(x,y,z).multiply(RX),hex]);
  const shape=(pts,d,x,y,z,hex)=>{ const g=new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([a,b])=>new THREE.Vector2(a/1000,b/1000))),{depth:d,bevelEnabled:false}); add(g,x,y,z,hex); };
  const F=BATZ+BATT;                                                                     // frontal de la placa
  const CX = t==='rtv' ? [[-0.0165,-0.004,true],[0.0165,-0.004,false]] : t==='tba' ? [[-0.0165,0,true],[0.0165,0,false]] : [];
  add(rrectGeo(BATW,BATW,BATT,0.006,0.001,CX.map(([x,y])=>[x,y,0.0065])),0,0,F-BATT/2,BATC.plate);   // placa (amb els forats de les preses coaxials)
  const ring=(ro,ri,d,x,y,z,hex)=>{ const sh=new THREE.Shape(); sh.absarc(0,0,ro,0,Math.PI*2,false); const h=new THREE.Path(); h.absarc(0,0,ri,0,Math.PI*2,true); sh.holes.push(h);
    add(new THREE.ExtrudeGeometry(sh,{depth:d,bevelEnabled:false,curveSegments:24}),x,y,z-d,hex); };          // anell extrudit cap endins; z = cara de davant
  const jack=(cx,cy)=>{                                                                  // mòdul RJ45 (femella 8P8C) de 15 × 18 mm
    const py=cy+0.0018;                                                                  // centre del connector mascle
    add(rrectGeo(0.015,0.018,0.0025,0.0018,0.0004),cx,cy,F+0.00125,BATC.bezel);
    add(rrectGeo(0.0136,0.0166,0.0005,0.0014,0),cx,cy,F+0.00275,BATC.step);
    shape(RJ45_OPEN,0.0003,cx,py,F+0.003,BATC.hole);
    add(new THREE.BoxGeometry(0.009,0.0018,0.0003),cx,py+0.0025,F+0.00345,BATC.strip);
    for(let i=0;i<8;i++) add(new THREE.BoxGeometry(0.0006,0.0014,0.0003),cx+(i-3.5)*0.00102,py+0.0025,F+0.00375,BATC.gold);   // contactes a 1,02 mm de pas
    port(cx,py,F+0.003-0.013,'rj45'); };                                                 // el mascle hi entra 13 mm
  /* presa coaxial enrasada: forat de Ø13 mm amb l'insert fosc, el conductor exterior i el contacte central a dins, sense res que sobresurti */
  const coax=(cx,cy,male)=>{
    ring(0.0065,0.0048,0.008,cx,cy,F-0.0008,BATC.hole);                                  // insert de plàstic fosc
    cyl(0.0048,0.0004,cx,cy,F-0.0088,BATC.hole);                                          // fons
    if(male){ ring(0.0034,0.0025,0.006,cx,cy,F-0.002,BATC.cni); cyl(0.0006,0.005,cx,cy,F-0.0055,BATC.pin,12); }      // TV: conductor exterior i pin central
    else { ring(0.0042,0.0021,0.006,cx,cy,F-0.0015,BATC.cni); cyl(0.0021,0.0004,cx,cy,F-0.0075,BATC.hole,16); cyl(0.0005,0.004,cx,cy,F-0.0058,BATC.pin,12); }   // SAT: rosca F i contacte
    port(cx,cy,F,male?'tv':'sat'); };
  let fo=null;
  if(t==='dat'){ for(const x of (dbl?[-0.0105,0.0105]:[0])) jack(x,0); }
  else if(CX.length){ for(const [x,y,male] of CX) coax(x,y,male); }
  else if(t==='fo'){                                                                     // allotjament per a l'adaptador SC/APC (brida de 15,5 × 11 mm)
    add(rrectGeo(0.022,0.02,0.0025,0.002,0.0004),0,0,F+0.00125,BATC.bezel);
    shape([[-8.25,-5.9],[8.25,-5.9],[8.25,5.9],[2,5.9],[2,7.4],[-2,7.4],[-2,5.9],[-8.25,5.9]],0.0003,0,0,F+0.0025,BATC.hole);
    fo=new THREE.Vector3(0,0,F+0.0028+0.0032).applyMatrix4(Mw); }                        // la brida (3,2 mm) recolza a l'allotjament
  const m=ictMesh(mergeParts(parts),0xFFFFFF,el,{std:{roughness:0.45,metalness:0,vertexColors:true}});
  addProxy(m,new THREE.BoxGeometry(0.14,0.14,0.08).applyMatrix4(T(0,0,F)));
  /* serigrafia: text sobre fons transparent (pren el to de la placa) */
  const lbl=(txt,x,y,w,h,fs)=>{ const pos=new THREE.Vector3(x,y,F+0.0002).applyMatrix4(Mw), pw=Math.round(w/h*64);
    const tx=_texCache['bat:'+txt] ||= canvasTex(pw*4,256,g=>{ g.fillStyle='#2A2A2A'; g.textAlign='center'; g.textBaseline='middle'; g.font=`500 ${fs}px Arial, sans-serif`; g.fillText(txt,pw*2,132); });
    rPlane(el,w,h,pos,N,tx,{opacity:0.999}); };
  if(t==='rtv'){ lbl('TV',-0.0165,0.0115,0.012,0.0055,200); lbl('SAT',0.0165,0.0115,0.012,0.0055,200); }
  if(t==='fo') lbl('FO  ⚠ Làser',0,0.0215,0.04,0.0075,150);
  return fo;
}
function buildInterior(u){
  const y=yb(u.f), U=u.id, X=x=>mx(u,x), Z=z=>mz(u,z), sz=SZ(u);
  /* PAU i elements dins del RTR */
  /* PAU + repartidor de RTV (Televes 519534): entrada ← cable 1 (blanc), entrada carregada ← cable 2 (negre, en reserva),
     4 sortides → preses. Les sortides s'assignen d'esquerra a dreta (coordenades lògiques) a cuina, sala, dormitori 2 i 1. */
  const SZV=V(0,0,sz);
  const P0=`pau_rtv_${U}`, PR=pauRtvPos(u);
  if(MODELS.pauRtv.scene){
    const ms=placeModel('pauRtv',P0,PR.PO.x,PR.PO.y,PR.PO.z,{},PR.rot);
    addProxy(ms[0],new THREE.BoxGeometry(0.14,0.10,0.05).translate(PR.PO.x,PR.PO.y-0.01,PR.PO.z+sz*0.02));                  // zona de selecció
  } else {
    iBox(P0,0.109,0.0263,0.018,PR.PO.x,PR.PO.y,PR.PO.z+sz*0.009,0xC2C6C9);                                                  // reserva: cos de 109 × 54 × 18 mm
    for(const n of Object.keys(PRD)){ const b=PR.at(n).add(V(0,0.0145,0)); fFemale(P0,b,V(0,-1,0)); }
  }
  const pPlug=(el,n)=>coaxPlug(el,PR.at(n).add(V(0,0.004,0)),V(0,-1,0));
  pPlug(`xs_rtv_${U}`,'in'); pPlug(`xs_rtv_${U}`,'inc');                                     // connectors F dels cables de dispersió
  const outs=['o1','o2','o3','o4'].map(n=>[n,X(PR.at(n).x)]).sort((a,b)=>a[1]-b[1]);
  const RTVOUT={}, RTVTAIL={};
  ['rtv_cuina','rtv_sala','rtv_d2','rtv_d1'].forEach((k,i)=>{ RTVOUT[k]=outs[i][1]; RTVTAIL[k]=pPlug(`xi_rtv_${U}`,outs[i][0]); });
  /* PAU de fibra òptica (Televes 231502, sense logotip): 119 × 94 × 33 mm, cargolat a la paret del fons del RTR.
     Sortides SC/APC per la base (1 i 2 davant, 3 i 4 darrere); porta els 2 adaptadors de sèrie a les sortides 1 i 2.
     La sortida 1 cau sempre a X(-3.16), sigui quina sigui l'orientació de l'habitatge. */
  const PF=`pau_fo_${U}`, {PO,rot:PFR,side:PSIDE,at:pfAt}=pauFoPos(u);
  if(MODELS.pauFo.scene){
    const ms=placeModel('pauFo',PF,PO.x,PO.y,PO.z,{},PFR);
    addProxy(ms[0],new THREE.BoxGeometry(0.15,0.13,0.05).translate(PO.x,PO.y,PO.z+sz*0.02));                  // zona de selecció
  } else {
    iBox(PF,0.119,0.0936,0.033,PO.x,PO.y,PO.z+sz*0.0165,0xF4F4F0);
    rPlane(PF,0.08,0.0243,V(PO.x,PO.y-0.0123,PO.z+sz*0.0335),SZV,textTex(['PAU FIBRA ÒPTICA','1   2   3   4'],{w:400,h:120,fs:[40,34],bold:[true],bg:'#1A1A1B',fg:'#FFFFFF'}),{});
  }
  const sc1=pfAt('sc1'), sc2=pfAt('sc2');
  const PF_TAIL=scPlug(`xi_fo_${U}`,scAdapter(PF,sc1,UP,PSIDE,true),V(0,-1,0),PSIDE);      // sortida 1 → fibra interior cap a la sala
  scAdapter(PF,sc2,UP,PSIDE,false);                                                            // sortida 2: en reserva, amb la tapa tancada
  /* PAU de TBA coaxial (repartidor 2D Televes 519602): entrada lliure amb càrrega 4061 (no hi ha operador de cable);
     les 2 sortides, d'esquerra a dreta (coordenades lògiques), cap a la sala i el dormitori 1 */
  const PT0=`div_tba_${U}`, PT=pauTbaPos(u);
  if(MODELS.pauTba.scene){
    const ms=placeModel('pauTba',PT0,PT.PO.x,PT.PO.y,PT.PO.z,{},PT.rot);
    addProxy(ms[0],new THREE.BoxGeometry(0.10,0.09,0.05).translate(PT.PO.x,PT.PO.y-0.01,PT.PO.z+sz*0.02));                  // zona de selecció
  } else {
    iBox(PT0,0.0615,0.0241,0.018,PT.PO.x,PT.PO.y-0.0002,PT.PO.z+sz*0.009,0xC2C6C9);                                         // reserva: cos de 74 × 54 × 18 mm
    for(const n of Object.keys(PTD)){ const b=PT.at(n).add(V(0,0.0145,0)); fFemale(PT0,b,V(0,-1,0)); }
  }
  fLoad(PT0,PT.at('in').add(V(0,0.0025,0)),V(0,-1,0));
  const tOuts=['o1','o2'].map(n=>[n,X(PT.at(n).x)]).sort((a,b)=>a[1]-b[1]), TBAOUT={}, TBATAIL={};
  ['tba_sala','tba_d1'].forEach((k,i)=>{ TBAOUT[k]=tOuts[i][1]; TBATAIL[k]=coaxPlug(`xi_tba_${U}`,PT.at(tOuts[i][0]).add(V(0,0.004,0)),V(0,-1,0)); });
  let PAU_PATCH, FO_BAT;
  /* PAU de parells: roseta doble RJ45 de superfície (línia 1 i línia 2) a la paret del fons del RTR, amb les boques cap avall */
  {
    const el=`pau_pt_${U}`, rx=X(-2.86), ry=y+1.72, W=0.07, H=0.07, hb=(H-0.008)/2, zb=-4.722, zm=Z(zb+0.021), zf=zb+0.036;
    const base=ictMesh(rrectGeo(W+0.002,H+0.002,0.006,0.006,0.002),0xE9E9E3,el,{std:{roughness:0.55,metalness:0}}); base.position.set(rx,ry,Z(zb+0.003));
    const body=ictMesh(rrectGeo(W-0.008,H-0.008,0.03,0.008,0.004),0xF4F4F0,el,{std:{roughness:0.5,metalness:0}}); body.position.set(rx,ry,zm);
    addProxy(body,new THREE.BoxGeometry(0.12,0.12,0.08));
    /* finestra de l'etiqueta i marques en relleu de la tapa */
    iBox(el,0.042,0.011,0.002,rx,ry+0.019,Z(zf),0xE4E4DE,{pick:false});
    iBox(el,0.022,0.008,0.0015,rx,ry+0.002,Z(zf),0xE4E4DE,{pick:false});
    for(const dx of [-0.017,0.017]) iBox(el,0.01,0.005,0.0015,X(-2.86+dx),ry-0.013,Z(zf),0xE4E4DE,{pick:false});
    /* boques RJ45 a la cara inferior: línia 1 (esquerra) i línia 2 (dreta) */
    for(const dx of [-0.017,0.017]){ const jx=X(-2.86+dx);
      iBox(el,0.016,0.008,0.014,jx,ry-hb+0.0035,zm,0x1E2022,{pick:false});
      for(let k=0;k<8;k++) iBox(el,0.0008,0.0008,0.006,jx-0.0049+k*0.0014,ry-hb+0.0005,zm,0xC9A13A,{pick:false}); }
    /* connector RJ45 a la línia 1 i cable fins al multiplexor passiu */
    const j1=X(-2.877);
    PAU_PATCH=rj45(el,V(j1,ry-hb+0.010,zm),V(0,1,0),SZV.clone());
  }
  /* multiplexor passiu (model inspirat en el Televes 546501, sense marca), cargolat a la paret del fons del RTR */
  const MX0=X(-2.86), MY=y+1.40, mzb=-4.722, mzf=mzb+MUX.D, mxw = lx => MX0+lx*sz;   // el frontal es llegeix d'esquerra a dreta des de l'habitatge
  if(MODELS.mux.scene){                                                                                  // model glTF (models/multiplexor.glb)
    const ms=placeModel('mux',`pau_pt_${U}`,MX0,MY,Z(mzb),{},sz<0?Math.PI:0);
    addProxy(ms[0],new THREE.BoxGeometry(0.15,0.07,0.03).translate(MX0,MY,Z(mzb)+sz*0.012));                                          // zona de selecció
  } else {
    const el=`pau_pt_${U}`;
    const body=ictMesh(rrectGeo(MUX.W,MUX.H,MUX.D,0.004,0.0015),0x2B2D30,el,{std:{roughness:0.6,metalness:0}}); body.position.set(MX0,MY,Z(mzb+MUX.D/2));
    addProxy(body,new THREE.BoxGeometry(0.18,0.1,0.06));
    rPlane(el,MUX.W-0.003,MUX.H-0.003,V(MX0,MY,Z(mzf+0.0003)),SZV,muxTex(),{rotZ:0});
    for(const s2 of [-1,1]){ const ex=MX0+s2*(MUX.W/2+0.006);                                             // orelles de fixació
      iBox(el,0.014,0.044,0.003,ex,MY-0.006,Z(mzb+0.0015),0x1F2124,{pick:false});
      iBox(el,0.004,0.012,0.0035,ex+s2*0.001,MY-0.012,Z(mzb+0.0015),0xD9D5CC,{pick:false}); }
  }
  /* connector RJ45 endollat a una boca del frontal; retorna on comença el cable */
  const muxPlug = (el,n) => { const [lx,ly]=MUXJ(n);
    return rj45(el,V(mxw(lx),MY+ly,Z(mzf-0.012)),V(0,0,-sz),V(0,MODELS.mux.scene?1:-1,0)); };   // pestanya cap a l'osca de la boca   // contactes cap amunt, pestanya cap avall (com les boques del frontal)
  const lineIn = muxPlug(`pau_pt_${U}`,'line');
  cable(`patch_pau_${U}`,`pau_pt_${U}`,[PAU_PATCH,[PAU_PATCH[0],PAU_PATCH[1]-0.012,PAU_PATCH[2]],[PAU_PATCH[0],MY+0.06,Z(-4.69)],[lineIn[0],MY+0.045,Z(mzf+0.045)],[lineIn[0],lineIn[1]+0.006,lineIn[2]+sz*0.014],lineIn],{tram:'usr',tech:'pt',svc:'pt'});
  /* latiguillo al RTR: uneix el cable de retorn de la sala amb el de l'estància de destinació */
  /* cada extrem del latiguillo s'endolla a un empalmament femella-femella; per sota hi entra el cable interior */
  const CPY=y+1.365, CPZ=Z(-4.62);   // prou amunt perquè els cables interiors baixin rectes fins al pla de 1,234 m
  for(const px of Object.values(PATCHED)) rj45Coupler(`pau_pt_${U}`,X(px),CPY,CPZ);
  const pa=rj45(`pau_pt_${U}`,V(X(PATCHED.dat_sala_b),CPY+0.002,CPZ),V(0,-1,0),SZV.clone()), pb=rj45(`pau_pt_${U}`,V(X(PATCHED.dat_d1_b),CPY+0.002,CPZ),V(0,-1,0),SZV.clone());
  cable(`patch_rtr_${U}`,`pau_pt_${U}`,[pa,[pa[0],pa[1]+0.03,pa[2]],[X(-2.86),y+1.48,Z(-4.585)],[pb[0],pb[1]+0.03,pb[2]],pb],{tram:'usr',tech:'pt',svc:'pt'});
  /* registre de pas al camí de la paret del televisor */
  iBox(`rpas_${U}`,0.3,0.36,0.46,X(-4.24),y+0.19,Z(-1.5),0x8D9AA8,{opacity:0.55});
  /* tubs i cables en estrella */
  const N=EXIT_ORDER.length, LAY={}, used=[];
  { const iv=[]; EXIT_ORDER.forEach((k,i)=>{ if(k==='conf') return; const p=PRESES.find(o=>o.k===k), xe=-3.66+i*(0.92/(N-1));
      for(const [ab,dx] of (p.dbl?[['a',-DXI],['b',DXI]]:[['',0]])){ const key=ab?`${k}_${ab}`:k;
        const sx = p.t==='rtv'?RTVOUT[k] : p.t==='tba'?TBAOUT[k] : p.t==='fo'?-3.16 : MUXOUT[key]?-2.86 : (PATCHED[key]??FREEEND[key]);
        iv.push([key,Math.min(sx,xe+dx)-0.03,Math.max(sx,xe+dx)+0.03]); } });
    iv.sort((a,b)=>a[1]-b[1]);
    for(const [key,lo,hi] of iv){ let l=0; while(used[l]!==undefined && used[l]>lo) l++; used[l]=hi; LAY[key]=l; } }
  EXIT_ORDER.forEach((k,i)=>{
    const q=PPOS[k], xe=X(-3.66+i*(0.92/(N-1))), xt=X(q.x), yl=q.yl, qz=Z(q.z), dir = q.ax==='x' ? q.dir : q.dir*sz;
    const gi = EXIT_ORDER.filter(o=>PPOS[o].z===q.z && PPOS[o].dir===q.dir).indexOf(k);
    const lane = qz + dir*(0.12+0.05*gi);
    const AX = q.ax==='x', dw = AX ? (XS(u)===1?q.dir:-q.dir) : dir;
    /* el tub arriba per terra fins a sota del registre de presa i hi entra per baix (radi de corba RCI) */
    /* les boques entren 18 mm dins del RTR (terra a y+1,10–1,125) i 20 mm dins del registre de presa (poc fons: terra a y+0,3075) */
    const yr=y+1.143, yp=y+0.35-RPW/2+0.02;
    const pts = AX ? dedupe([[xe,yr,Z(-4.64)],[xe,y+yl,Z(-4.64)],[xe,y+yl,qz],[xt,y+yl,qz],[xt,yp,qz]])
                   : dedupe([[xe,yr,Z(-4.64)],[xe,y+yl,Z(-4.64)],[xe,y+yl,lane],[xt,y+yl,lane],[xt,y+yl,qz],[xt,yp,qz]]);
    if(k==='conf'){
      tube(`ci_${U}`,dedupe([[xe,yr,Z(-4.64)],[xe,y+0.6,Z(-4.64)],[xt,y+0.6,Z(-4.66)],[xt,y+0.475-DINS,Z(-4.68)]]),RIT,{mouth:2});
      regBox(`rconf_${U}`,0.3,0.3,0.08,xt,y+0.35,Z(-4.71),0x8D9AA8,0xB7C1CC,sz);
      return;
    }
    const p=PRESES.find(o=>o.k===k), T=PTYPE[p.t], pid=`${k}_${U}`;
    tube(`ci_${U}`,pts,RIT,{svc:T.svc, R:RCI, mouth:2});
    /* RTR → tub: sortida recta del connector, descens fins a la capa pròpia (LAY), tram horitzontal a 1,234 m,
       baixada davant del tub i entrada per la boca (a 1,15 m). Capes diferents per als recorreguts que se solapen: cap creuament. */
    let src, from;
    if(p.t==='rtv'){ const t=RTVTAIL[k]; src=[t,[t.x,y+1.44,t.z]]; from=`pau_rtv_${U}`; }
    else if(p.t==='tba'){ const t=TBATAIL[k]; src=[t,[t.x,y+1.30,t.z]]; from=`div_tba_${U}`; }   // dues sortides del PAU de TBA
    else if(p.t==='fo'){ src=[PF_TAIL,[PF_TAIL[0],PF_TAIL[1]-0.035,PF_TAIL[2]]]; from=`pau_fo_${U}`; }
    else from=`pau_pt_${U}`;
    const offs = p.dbl ? [['a',-DXI],['b',DXI]] : [['',0]];
    for(const [ab,dx] of offs){
      /* dins del tub: camí del tub traslladat v (dos cables: v oposats, separats en totes les direccions del tub) */
      const v=[dx,0.7*dx,0.7*dx], sh=inTube(pts,v,RCI), key=ab?`${k}_${ab}`:k;
      if(p.t==='dat'){ const el2=`${T.net}_${U}`;
        /* sortida recta de 3,5–4,5 cm alineada amb el connector abans de corbar (radi del Cat 6: 25 mm) */
        if(MUXOUT[key]){ const pl=muxPlug(el2,MUXOUT[key]); src=[pl,[pl[0],pl[1],pl[2]+sz*0.045]]; }
        else { const pl=rj45(el2,V(X(PATCHED[key]??FREEEND[key]),CPY-0.002,Z(-4.62)),V(0,1,0),SZV.clone());   // a l'empalmament del latiguillo o connector lliure
          src=[pl,[pl[0],pl[1]-0.035,pl[2]]]; } }
      /* avança fins a la capa a l'alçada del connector (per sobre de 1,24 m: no talla cap tram horitzontal) i hi baixa vertical */
      const S0=src[src.length-1], zi=Z(-4.64)+sz*(0.075+0.0105*LAY[key]), xd=xe+v[0], fl=[[xd,y+1.168,zi],[xd,y+1.168,Z(-4.64)+v[2]]];
      const run = Math.abs(S0[0]-xd)<0.07 ? [[S0[0],S0[1],zi],...fl] : [[S0[0],S0[1],zi],[S0[0],y+1.234,zi],[xd,y+1.234,zi],...fl];
      const se=sh[sh.length-1], sp=sh[sh.length-2], sl=Math.hypot(se[0]-sp[0],se[1]-sp[1],se[2]-sp[2]), end=se.slice(0,3).map((q,i)=>q+(q-sp[i])/sl*0.03);   // surt 3 cm per la boca dins del registre de presa
      cable(`xi_${k}${ab}_${U}`, `${T.net}_${U}`, [...src,...run,...sh.slice(1),end],
        {tram:'int',tech:T.tech,svc:T.svc, from, to:`bat_${pid}`, via:`ci_${U}`});
    }
    /* registre de presa (caixa) i BAT (placa frontal) */
    /* B(): caixa en coordenades locals de la paret (a = al llarg de la paret, n = normal) */
    const B=(el,wa,h,dn,da,yy,dnn,col,o)=> AX ? iBox(el,dn,h,wa,xt+dnn*dw,yy,qz+da,col,o) : iBox(el,wa,h,dn,xt+da,yy,qz+dnn*dir,col,o);
    const Cy=(el,r,len,da,yy,dnn,col)=> AX ? iCyl(el,r,len,xt+dnn*dw,yy,qz+da,col,'x',{pick:false}) : iCyl(el,r,len,xt+da,yy,qz+dnn*dir,col,'z',{pick:false});
    B(`rp_${pid}`,RPW,RPW,0.08,0,y+0.35,0,0x8D9AA8);
    /* BAT: placa frontal de 80 × 80 mm a mida real (els connectors mascles hi encaixen) */
    { const N = AX ? V(dw,0,0) : V(0,0,dir), C = V(xt,y+0.35,qz);
      const fo = batPlate(`bat_${pid}`,p.t,!!p.dbl,C,N);
      if(fo){ const S = AX ? V(0,0,1) : V(1,0,0);
        /* adaptador SC/APC simplex a mida real al centre de la roseta; el latiguillo de l'ONT hi va endollat */
        FO_BAT=scPlug(`ont_${U}`,scAdapter(`bat_${pid}`,fo,N.clone().negate(),S,true),N,S); } }
  });
  /* equips de l'usuari a la sala: ONT i encaminador al costat de la presa òptica */
  iBox(`ont_${U}`,0.26,0.2,0.1,X(-6.16),y+1.07,Z(-1.62),0xFAFAFA); iBox(`ont_${U}`,0.03,0.03,0.01,X(-6.22),y+1.1,Z(-1.565),0x2E9E5B,{pick:false});
  iBox(`router_${U}`,0.3,0.08,0.2,X(-5.86),y+1.01,Z(-1.62),0x30363D); iCyl(`router_${U}`,0.012,0.22,X(-5.97),y+1.16,Z(-1.7),0x30363D,'y',{pick:false}); iCyl(`router_${U}`,0.012,0.22,X(-5.75),y+1.16,Z(-1.7),0x30363D,'y',{pick:false});
  /* latiguillo SC/APC: surt de la presa òptica, puja per davant del prestatge (cantell a z −1,48) i entra al port òptic
     del frontal de l'ONT, arran del prestatge */
  { const zf=Z(-1.465), ot=scPlug(`ont_${U}`,V(X(-6.12),y+0.983,Z(-1.58)),V(0,0,sz),V(1,0,0)), b=FO_BAT;
    cable(`patch_fo_${U}`,`ont_${U}`,[b,[b[0],b[1],zf],[b[0],y+0.983,zf],[ot[0],y+0.983,zf],ot],{tram:'usr',tech:'fo',svc:'fo', from:`bat_fo_sala_${U}`, to:`ont_${U}`}); }
  cable(`patch_eth_${U}`,`router_${U}`,[[X(-6.03),y+1.04,Z(-1.58)],[X(-6.0),y+1.04,Z(-1.52)],[X(-5.92),y+1.02,Z(-1.55)]],{tram:'usr',tech:'pt',svc:'fo', from:`ont_${U}`, to:`router_${U}`});
  /* latiguillos endollats a les boques de les BAT (la més propera al recorregut original) */
  const near=(el,x,t)=>BATP[el].filter(q=>q.t===t).sort((a,b)=>Math.abs(a.p.x-x)-Math.abs(b.p.x-x))[0];
  const plugRJ=(el,q)=>{ const pl=V(...rj45(el,q.p,q.n.clone().negate(),V(0,-1,0)));   // el cable comença 6 mm dins del caputxó
    return [pl.clone().addScaledVector(q.n,-0.006).toArray(),pl.clone().addScaledVector(q.n,0.03).toArray()]; };   // 3 cm rectes abans de corbar
  { const [pl,out]=plugRJ(`router_${U}`,near(`bat_dat_sala_${U}`,X(-6.25),'rj45'));
    cable(`patch_ret_${U}`,`router_${U}`,[[X(-5.86),y+0.98,Z(-1.52)],[X(-6.02),y+0.75,Z(-1.5)],[pl[0],y+0.5,out[2]],out,pl],{tram:'usr',tech:'pt',svc:'pt', from:`router_${U}`, to:`bat_dat_sala_${U}`}); }
  /* equips terminals */
  iBox(`tv_${U}`,1.1,0.62,0.06,X(-7.1),y+0.85,Z(-1.35),0x22262B); iBox(`tv_${U}`,0.2,0.3,0.12,X(-7.1),y+0.55,Z(-1.35),0x22262B,{pick:false});
  /* connector IEC femella acodat (90°): el tram estret (Ø9,2 mm) entra sencer dins de la boca TV fins al graó del cos;
     colze amb el caputxó gris cap avall. El cable comença dins del caputxó (no se'n veu l'extrem), baixa, fa una corba
     davant de la paret i puja fins al televisor */
  { const q=near(`bat_rtv_sala_${U}`,X(-6.99),'tv'), at=d=>q.p.clone().addScaledVector(q.n,d), el=`tv_${U}`, MET=0xC3C7CB, BOOT=0x9EA3A8;
    rCyl(el,0.0046,0.0085,at(-0.00375),q.n,MET,'zamak',{seg:24});                                 // tram estret, dins del forat
    rCyl(el,0.0068,0.012,at(0.0065),q.n,MET,'zamak',{seg:28});                                    // cos (el graó queda arran de la placa)
    const e=at(0.0195);                                                                            // eix vertical del colze
    rCyl(el,0.0072,0.0135,e.clone().add(V(0,-0.00275,0)),UP,MET,'zamak',{seg:28});
    const hs=rMesh(el,new THREE.SphereGeometry(0.0072,28,10,0,Math.PI*2,0,Math.PI/2),MET,'zamak'); hs.position.copy(e).add(V(0,0.004,0));   // cap arrodonit
    rCyl(el,0.0062,0.0008,e.clone().add(V(0,-0.0094,0)),UP,0x6E7378,'zamakDark',{seg:28});        // junta
    rCyl(el,0.0062,0.016,e.clone().add(V(0,-0.0178,0)),UP,BOOT,'plastic',{seg:28,r2:0.0071});     // caputxó
    const st=e.clone().add(V(0,-0.02,0)), lo=st.clone().addScaledVector(q.n,0.09);
    cable(`tv_patch_${U}`,el,[st.toArray(),[st.x,y+0.22,st.z],[lo.x,y+0.22,lo.z],[X(-7.0),y+0.5,Z(-1.5)],[X(-7.05),y+0.6,Z(-1.4)]],{tram:'usr',tech:'coax',svc:'rtv', from:`bat_rtv_sala_${U}`, to:el}); }
  iBox(`pc_${U}`,0.5,0.32,0.04,X(-2.75),y+0.9,Z(2.2),0x22262B); iBox(`pc_${U}`,0.08,0.06,0.12,X(-2.75),y+0.75,Z(2.22),0x22262B,{pick:false}); iBox(`pc_${U}`,0.2,0.45,0.42,X(-2.55),y+0.23,Z(2.3),0x3A3F45);
  { const [pl,out]=plugRJ(`pc_${U}`,near(`bat_dat_d1_${U}`,X(-3.44),'rj45'));
    cable(`pc_patch_${U}`,`pc_${U}`,[pl,out,[out[0],y+0.1,Z(1.95)],[X(-2.65),y+0.15,Z(2.2)]],{tram:'usr',tech:'pt',svc:'pt', from:`bat_dat_d1_${U}`, to:`pc_${U}`}); }
}

/* ===================================================================
   VISIBILITAT I ESTAT
   =================================================================== */
/* obertura: estat per element (botons i opcions generals) i, a sobre, estat per fulla (doble clic) */
function elOpenDefault(id){ const e=EL[id]; if(!e) return false; if(S.openOv.has(id)) return S.openOv.get(id); return e.layer==='recintes' ? S.openRec : S.openReg; }
function isOpen(id){ const ls=LEAF_OF[id]; if(ls && ls.length) return ls.some(leafOpen); return elOpenDefault(id); }
function setOpen(id,v){ S.openOv.set(id,v); for(const l of (LEAF_OF[id]||[])) S.leaf.delete(l.key); }
/* obre o tanca una fulla concreta (porta, tapa, porta d'armari) */
function toggleLeaf(l, v){
  const nv = v===undefined ? !leafOpen(l) : v;
  S.leaf.set(l.key,nv);
  if(l.pair){ S.leaf.set(l.pair,nv); }
  if(l.lift!==undefined && nv){ setLiftFloor(l.lift); for(const f of [-1,0,1,2,3,4]) if(f!==l.lift){ S.leaf.set(`asc:${f}a`,false); S.leaf.set(`asc:${f}b`,false); } }
  if(l.of){ applyVisibility(); if(S.selected===l.of || EL[S.selected]?.openOf===l.of) renderInfo(); }
  announce(`${leafName(l)}: ${nv?'oberta':'tancada'}.`);
  return nv;
}
function leafName(l){ if(l.label) return l.label[0].toUpperCase()+l.label.slice(1); const e=EL[l.of]; return e ? (e.layer==='recintes'?'Porta: ':'Tapa: ')+(e.sigla||e.name) : 'Porta'; }
function closeAllLeaves(){ S.leaf.clear(); S.openOv.clear(); S.openRec=false; S.openReg=false; setLiftFloor(0); syncControls(); applyVisibility(); renderInfo(); announce('S\'han tancat totes les portes i tapes.'); }
function announce(t){ const st=$('#statusNav'); if(st) st.textContent=t; }
function elAllowedByMode(e){
  const m=S.mode;
  if(m==='planta') return S.floor===-1 ? e.floor===-1 : (!!e.vertical || e.floor===S.floor);
  if(m==='habitatge'){ const u=curUnit(); return (u && e.unit===u) || (e.rs && e.floor===S.floor); }
  return true;
}
function elVisible(e){
  if(!e || e.noModel) return false;
  if(!S.layers[e.layer]) return false;
  if(e.optional && !S.sat) return false;
  if(e.variant && e.variant!==S.cap) return false;
  return elAllowedByMode(e);
}
function meshVisible(m){
  const d=m.userData, e=EL[d.el];
  if(!elVisible(e)) return false;
  if(d.svc && d.svc!=='all' && S.svc!=='all' && d.svc!==S.svc) return false;
  if(!d.svc && e.svc!=='all' && S.svc!=='all' && e.svc!==S.svc) return false;
  if(d.didOnly && S.ritsLook!=='did') return false;
  if(d.ritsPart==='roof' && S.ritsRoof) return false;
  if(d.ritsPart==='front' && S.ritsFront) return false;
  if(d.corrPiece==='openHalf' && S.ritsCut) return false;
  if(d.corrPiece==='cutEdge' && !S.ritsCut) return false;
  return true;
}
function archVisible(d){
  const m=S.mode;
  if(m==='ict') return false;
  if(d.cut!==undefined && d.cut!==S.cut) return false;   // peces amb tall transversal o sense (model de cases)
  if(d.facade){ if(!S.layers.facana || m==='planta' || m==='habitatge') return false; }
  else if(!S.layers.estructura) return false;
  if(d.ground) return m==='oberta'||m==='transp'||(m==='planta'&&S.floor===0);
  if(m==='oberta'||m==='transp') return true;
  if(m==='planta') return d.floor===S.floor;
  if(m==='habitatge'){ const u=curUnit(); return d.floor===S.floor && (d.slab || d.unit===u); }
  return true;
}
/* cadena de contenidors: un element interior és seleccionable si tots els seus contenidors visibles són oberts */
function innerPickable(id){
  let p=EL[id].parent;
  while(p){ const pe=EL[p]; if(pe.lid && elVisible(pe) && !isOpen(p) && !(p==='rits' && (S.ritsRoof||S.ritsFront))) return false; p=pe.parent; }
  return true;
}
function applyVisibility(){
  for(const m of G.arch) m.visible = archVisible(m.userData);
  const tr = S.mode==='transp';
  for(const mat of AM.list){ mat.transparent=tr; mat.opacity=tr?S.transp:1; mat.depthWrite=!tr; mat.needsUpdate=true; }
  for(const m of G.meshes) m.visible = meshVisible(m);
  for(const l of G.refs) l.visible = (S.mode==='ict') || (S.mode==='planta' && l.userData.floor===S.floor);
  ritsVisibility(); landscapeVisibility(); applyMaterials();
  $('#transpWrap').classList.toggle('hidden', S.mode!=='transp');
  updateStatus(); renderList(); needLabels=true;
}
/* colors, opacitats i ressaltats */
function applyMaterials(){
  const rel=S.related;
  for(const m of G.meshes){
    const d=m.userData, mat=m.material;
    if((d.cable || d.cableLike) && !d.fixedColor){ mat.color.setHex(cableColor(d.tram,d.tech,d.real));
      if(d.vcol){ const w=S.colorBy==='real'; if(mat.vertexColors!==w){ mat.vertexColors=w; mat.needsUpdate=true; } }
      const wm = S.colorBy==='real' ? null : (d.texMap||null); if(d.cable && mat.map!==wm){ mat.map=wm; mat.needsUpdate=true; } }
    if(d.corr){ const op=S.ritsXray?0.2:1; const tr=op<1; if(mat.transparent!==tr){ mat.transparent=tr; mat.depthWrite=!tr; mat.needsUpdate=true; } mat.opacity=op; }
    else if(d.canal){
      let op = S.tubesSee ? 0.3 : 1; if(S.openCanal.has(d.el)) op=0.07;
      mat.opacity=op; mat.transparent=op<1; mat.depthWrite=op>=1; mat.needsUpdate=true;
    }
    let em=0x000000;
    /* la selecció no canvia el color: només es marca amb el contorn taronja */
    if(rel.has(d.el)) em=0x00456E;
    else if(d.el===S.hover && d.el!==S.selected) em=0x3A3A3A;
    if(!mat.emissive) continue;
    mat.emissive.setHex(em); if(d.std && em) mat.emissive.multiplyScalar(0.75);
    if(d.glow){ if(!em && S.ritsLight){ mat.emissive.setHex(0xFFF1D6); mat.emissiveIntensity=1.25; } else mat.emissiveIntensity=1; }
    if(d.led && !em) mat.emissive.setHex(d.led);
  }
  updateSelBox();
}
let selBox=null;
function elBox(id, onlyVisible=true){
  const b=new THREE.Box3(); let any=false;
  for(const m of (G.byEl[id]||[])){ if(onlyVisible && !m.visible) continue; m.updateMatrixWorld(); const bb=new THREE.Box3().setFromObject(m); if(!bb.isEmpty()){ b.union(bb); any=true; } }
  if(!any && EL[id] && (EL[id].children||[]).length){ for(const c of EL[id].children){ if(ritsBad(c)) continue; const bb=elBox(c,onlyVisible); if(bb){ b.union(bb); any=true; } } }
  return any?b:null;
}
function updateSelBox(){
  if(!scene) return;
  if(selBox){ scene.remove(selBox); selBox=null; }
  if(!S.selected) return;
  const b=elBox(S.selected); if(!b) return;
  b.expandByScalar(0.04); selBox=new THREE.Box3Helper(b,0xF5A400); selBox.material.depthTest=false; selBox.renderOrder=10; scene.add(selBox);
}

/* ===================================================================
   CÀMERA
   =================================================================== */
const VIEWS = {
  start:   ()=>(camera&&camera.aspect<1 ? {p:V(10,16,46+30*(1-camera.aspect)), t:V(-0.5,9.0,-5)} : {p:V(12,15,39), t:V(-0.5,9.2,-5)}),
  building:()=>({p:V(30,19,34), t:V(-0.5,9.6,-5)}),
  entry:   ()=>({p:V(4.9,1.75,3.9), t:V(1.4,1.05,-2.6)}),
  roof:    ()=>({p:V(7.5,25.5,10.5), t:V(-2.6,18.4,-4)}),
  basement:()=>({p:V(6,13,15), t:V(2.2,-3,-9)}),
  floor:   ()=>{ const f=S.floor, y=yb(f);
    if(f===5) return {p:V(9,22.5,10), t:V(-0.5,16.2,-3)};
    if(f===-1) return VIEWS.basement();
    return {p:V(4,y+12,12.5), t:V(0,y+0.4,-5)}; },
  ritsElec:()=>({p:ritsW(V(1.25,17.55,-3.05)), t:ritsW(V(3.25,16.35,-3.35))}),
  ritsIn:  ()=>({p:ritsW(V(1.75,17.85,-2.45)), t:ritsW(V(1.40,16.20,-4.55))}),
  home:    ()=>{ const u=UNIT(curUnit()||'2A'), y=yb(u.f), x=mx(u,-5); return {p:V(x+mx(u,1.2),y+10.2,mz(u,8.6)), t:V(x,y+0.2,mz(u,-0.1))}; }
};
let camAnim=null;
function flyTo(p,t){
  if(!renderer) return;
  if(S.reduced){ camera.position.copy(p); controls.target.copy(t); controls.update(); return; }
  camAnim={p0:camera.position.clone(), t0:controls.target.clone(), p1:p.clone(), t1:t.clone(), s:performance.now(), d:650};
}
/* vistes predefinides (menú «Vistes»): cada canvi es desa a l'historial de «Tornar» */
function setView(name, opt={}){
  if(!opt.noPush) navPush();
  if(name==='ritsIn'){ ritsInterior(); return; }
  if(name==='complet'){ S.mode='oberta'; S.layers.facana=true; S.layers.estructura=true; syncControls(); applyVisibility(); name='building'; }
  else if(name==='oberta'){ S.mode='oberta'; S.layers.facana=false; S.layers.estructura=true; syncControls(); applyVisibility(); name='building'; }
  else if(name==='basement'||name==='ground'||/^f[1-4]$/.test(name)){ S.floor = name==='basement'?-1 : name==='ground'?0 : +name[1]; S.mode='planta'; syncControls(); applyVisibility(); name='floor'; }
  else if(name==='roof'){ if(S.mode==='planta'||S.mode==='habitatge') S.mode='oberta'; syncControls(); applyVisibility(); }
  if(name==='home'){
    if(!curUnit()){ S.floor=CFG.floor0; S.unitSide=CFG.side0; }
    S.mode='habitatge'; syncControls(); applyVisibility();
  }
  if((name==='building'||name==='entry') && (S.mode==='planta'||S.mode==='habitatge')){ S.mode='oberta'; syncControls(); applyVisibility(); }
  if(name==='entry' && S.layers.facana){ S.layers.facana=false; syncControls(); applyVisibility(); }
  const v=VIEWS[name](); flyTo(v.p,v.t); navUI();
}
function frameEl(id){
  if(!renderer) return;
  /* element únic fora del RITS: vista sense obstacles (la mateixa que el clic a l'escena) */
  if(!Array.isArray(id) && !inRits(id)){ const v=bestView(id); if(v){ flyTo(v.p,v.t); return; } }
  let b;
  if(Array.isArray(id)){ b=new THREE.Box3(); for(const k of id){ const bb=elBox(k)||elBox(k,false); if(bb) b.union(bb); } if(b.isEmpty()) return; id=id[0]; }
  else { b=elBox(id) || elBox(id,false); if(!b) return; }
  const c=b.getCenter(new THREE.Vector3()), sz=b.getSize(new THREE.Vector3());
  const r=Math.max(sz.length()/2,0.35);
  const e=EL[id];
  let elev = e?.rs ? 0.12 : (e.floor>=1&&e.floor<=4&&S.mode!=='habitatge') ? 0.28 : S.mode==='habitatge' ? 0.85 : 0.5;
  if(e.vertical) elev=0.15;
  const back = CFG.backOf ? CFG.backOf(e,c) : e.unit ? ZM(UNIT(e.unit)) : (c.z<-5.0 && c.y<15 && c.y>-0.5);
  let dir=V(THREE.MathUtils.clamp(c.x/9,-0.55,0.55), elev, back ? -1 : 1).normalize();   // habitatges C i D: des de la façana posterior
  let dist=THREE.MathUtils.clamp((r*2.6+(e?.rs?0.35:1.1))/visFrac(), (e?.rs?0.75:1.8), 45);
  const cl=c.clone().applyMatrix4(RITSI.copy(RITSM).invert());   // centre en coordenades del RITS
  if(inRits(id) && r<1.6 && cl.x>-0.4 && cl.x<3.4 && cl.z<-2.4 && cl.y>15){   // dins del RITS: des de l'espai de treball
    dir = cl.x>3.05 ? V(-1,0.4,0.25) : cl.x<-0.1 ? V(1,0.4,0.25) : V(THREE.MathUtils.clamp((1.5-cl.x)/4,-0.3,0.3),0.42,1);
    dir.transformDirection(RITSM); dist=THREE.MathUtils.clamp(r*2.4+0.45, 0.55, 2.0);
    if(!S.ritsRoof && !S.ritsFront){ S.ritsRoof=true; applyVisibility(); }
  } else if(inRits(id) && id!=='rits' && id!=='rits_porta'){
    if(!S.ritsRoof && !S.ritsFront){ S.ritsRoof=true; applyVisibility(); }
    flyTo(ritsW(V(1.5,19.7,-0.3)), ritsW(V(1.5,16.0,-3.7))); return;
  }
  flyTo(c.clone().add(dir.multiplyScalar(dist)), c);
}
/* garanteix que un element es pugui veure: capes, servei, mode i contenidors */
function ensureVisible(id){
  const e=EL[id]; if(!e||e.noModel) return;
  let ch=false;
  if(!S.layers[e.layer]){ S.layers[e.layer]=true; ch=true; }
  if(e.optional && !S.sat){ S.sat=true; ch=true; }
  if(S.svc!=='all' && e.svc!=='all' && e.svc!==S.svc){ S.svc='all'; ch=true; }
  if(e.fam==='xarxa' && !S.tubesSee){ S.tubesSee=true; ch=true; }
  const outside=['antena','antena_dab','antena_fm','torre','mastil','tirants','lnb','cab_dab','cab_fm','parabola','arqueta','canal_ext','peg','cab_capt','cab_sat','cab_sat2','canal_enllac_sup','reg_enllac_sup','xal_fo','xal_pt','rits'];
  if(S.layers.facana && !outside.includes(id) && !CFG.keepFacade?.(id) && S.mode!=='ict'){ S.layers.facana=false; ch=true; }
  if(S.mode==='planta' && !elAllowedByMode(e)){ if(e.floor!=null){ S.floor=e.floor; } else S.mode='oberta'; ch=true; }
  if(S.mode==='habitatge' && !elAllowedByMode(e)){ if(e.unit){ const u=UNIT(e.unit); S.floor=u.f; S.unitSide=u.s; } else if(e.rs && e.floor!=null){ S.floor=e.floor; } else S.mode='oberta'; ch=true; }
  if(e.variant && e.variant!==S.cap) setCap(e.variant);
  if(inRits(id) && id!=='rits' && id!=='rits_porta' && !S.ritsRoof && !S.ritsFront){ S.ritsRoof=true; ch=true; }
  let p=e.parent; while(p){ if(EL[p].lid && !isOpen(p)){ setOpen(p,true); ch=true; } p=EL[p].parent; }
  if(ch){ syncControls(); applyVisibility(); }
}

/* ===================================================================
   SELECCIÓ
   =================================================================== */
function select(id, opts={}){
  S.selected=id; S.related=new Set();
  if(id && opts.fromList){ ensureVisible(id); }
  applyMaterials(); renderInfo(); renderList(); updateStatus(); needLabels=true;
  $('#vCenter').disabled = !id || EL[id].noModel || !renderer;
  /* primer s'obre la fitxa: l'enquadrament ja té en compte l'espai que ocupa */
  if(id && opts.openPanel!==false) openDrawer('right',true);
  if(!id && !Q.active && !opts.keepPanel) openDrawer('right',false);
  if(id && opts.fromList && !EL[id].noModel) frameEl(id);
  if(id && Q.active) quizPick(id);
}
function relatedOf(id){
  const e=EL[id], s=new Set();
  for(const k of ['nets','canals','links','children']) for(const x of (e[k]||[])) if(EL[x]) s.add(x);
  if(e.parent) s.add(e.parent);
  for(const o of Object.values(EL)) if((o.nets||[]).includes(id)||(o.canals||[]).includes(id)||(o.links||[]).includes(id)) s.add(o.id);
  s.delete(id); for(const x of [...s]) if(ritsBad(x)) s.delete(x); return s;
}
function showConnections(id){
  S.related=relatedOf(id);
  for(const r of S.related){ const e=EL[r]; if(!e.noModel && !S.layers[e.layer]) S.layers[e.layer]=true; }
  syncControls(); applyVisibility(); needLabels=true;
  renderInfo();
}

/* ---------- Raycasting: clic vs arrossegament ---------- */
const ray=new THREE.Raycaster(), mouse=new THREE.Vector2();
function shown(o){ while(o){ if(!o.visible) return false; o=o.parent; } return true; }
const PRIO = {punts:4, equips:4, xarxes:3, canalitzacions:2, registres:1, recintes:0};
function pickAt(cx,cy){
  if(!renderer) return null;
  const r=renderer.domElement.getBoundingClientRect();
  mouse.set(((cx-r.left)/r.width)*2-1, -((cy-r.top)/r.height)*2+1);
  ray.setFromCamera(mouse,camera);
  let hits=ray.intersectObjects(G.pick,false).filter(h=>shown(h.object));
  const fac=G.arch.filter(m=>m.visible && m.userData.facade && m.material!==AM.glass && m.material!==AM.glassRail);
  if(fac.length){ const fh=ray.intersectObjects(fac,false)[0]; if(fh) hits=hits.filter(h=>h.distance<fh.distance+0.02); }
  const cand=[];
  for(const h of hits){
    const m = h.object.userData.proxy ? h.object.parent : h.object, d=m.userData;
    if(!d.el) continue;
    if(!innerPickable(d.el)) continue;
    if(d.cable && !S.tubesSee && G.cables[d.cable].via) { /* cable dins de tub opac: només si no hi ha tub davant */ }
    cand.push({id:d.el, dist:h.distance, m});
  }
  if(!cand.length){ pickAt.dist=Infinity; return null; }
  const d0=cand[0].dist; pickAt.dist=d0;
  // dins d'una petita profunditat, prioritza punts/equips/cables sobre contenidors
  const win=cand.filter(c=>c.dist<=d0+0.45);
  const pr=id=>EL[id].support ? 2.5 : PRIO[EL[id].layer];   // suports (torre, màstil, tirants, reflector): per sota dels cables
  win.sort((a,b)=> (pr(b.id)-pr(a.id)) || a.dist-b.dist);
  // amb tubs opacs, un tub davant del cable té prioritat
  if(!S.tubesSee && cand[0].m.userData.canal && !cand[0].m.userData.corr) return cand[0].id;
  if(!S.ritsXray && cand[0].m.userData.corr) return cand[0].id;
  return win[0].id;
}
/* ---------- Clic, doble clic i arrossegament ----------
   · Arrossegar (> 6 px o > 600 ms) només gira o desplaça la càmera: mai no selecciona ni obre.
   · Un clic s'executa amb un petit retard (DBL_MS) perquè, si arriba un segon clic, es tracti com a doble clic
     i no es faci el centratge del clic simple.
   · Doble clic sobre una porta, tapa o porta d'armari: l'obre; doble clic sobre la fulla oberta: la tanca. */
const DBL_MS=300;
let down=null, hoverQueued=null, pendingClick=null;
const _lr=new THREE.Raycaster();
function leafMeshes(){ const a=[]; for(const l of LEAVES) l.piv.traverse(o=>{ if(o.isMesh && o.userData.leafKey) a.push(o); }); return a; }
let LEAFM=null;
/* primer impacte sobre l'arquitectura visible (inclou fulles) o sobre una fulla d'element ICT */
function leafAt(cx,cy){
  if(!renderer) return null;
  const r=renderer.domElement.getBoundingClientRect();
  mouse.set(((cx-r.left)/r.width)*2-1, -((cy-r.top)/r.height)*2+1);
  _lr.setFromCamera(mouse,camera);
  LEAFM ||= leafMeshes();
  const objs=[...G.arch.filter(m=>m.visible && !m.userData.sign && m.material!==AM.glass && m.material!==AM.glassRail), ...LEAFM.filter(m=>!m.userData.archLeaf && shown(m))];
  const h=_lr.intersectObjects(objs,false).find(h=>shown(h.object));
  if(!h || !h.object.userData.leafKey) return h ? {wall:true, dist:h.distance} : null;
  return {leaf:LEAF_BY_KEY[h.object.userData.leafKey], dist:h.distance};
}
function onPointerDown(ev){ down={x:ev.clientX,y:ev.clientY,t:performance.now(),moved:false,btn:ev.button}; }
function onPointerMove(ev){
  if(down && Math.hypot(ev.clientX-down.x,ev.clientY-down.y)>6) down.moved=true;
  if(ev.pointerType==='touch') return;
  hoverQueued={x:ev.clientX,y:ev.clientY};
}
function onPointerUp(ev){
  if(!down) return; const d=down; down=null;
  if(d.moved || d.btn!==0 || performance.now()-d.t>600){ return; }  // ha estat un arrossegament: no es fa cap acció
  const now=performance.now(), x=ev.clientX, y=ev.clientY;
  if(pendingClick && now-pendingClick.t<DBL_MS && Math.hypot(x-pendingClick.x,y-pendingClick.y)<16){
    clearTimeout(pendingClick.timer); pendingClick=null; doubleAction(x,y); return;
  }
  if(pendingClick){ clearTimeout(pendingClick.timer); }
  pendingClick={t:now,x,y,timer:setTimeout(()=>{ pendingClick=null; singleAction(x,y); }, DBL_MS)};
}
/* clic simple: selecciona; amb la navegació interactiva, també centra i apropa */
function singleAction(x,y){
  const id=pickAt(x,y), lh=leafAt(x,y);
  if(lh && lh.leaf && lh.leaf.arch && (!id || lh.dist < pickAt.dist-0.05)){ showLeafChip(lh.leaf); return; }
  hideLeafChip();
  if(id){ if(NAV.on && !Q.active) navTo(id); else select(id); }
  else if(!Q.active) select(null);
}
/* doble clic: obre o tanca la fulla que hi ha sota el cursor */
function doubleAction(x,y){
  const lh=leafAt(x,y);
  if(lh && lh.leaf){ toggleLeaf(lh.leaf); if(LEAFCHIP===lh.leaf) showLeafChip(lh.leaf); return; }
  const id=pickAt(x,y); if(!id) return;
  const oid=EL[id].openOf||id, ls=LEAF_OF[oid];
  if(ls && ls.length===1) toggleLeaf(ls[0]);
  else if(ls && ls.length){ setOpen(oid,!isOpen(oid)); applyVisibility(); renderInfo(); announce(`${EL[oid].name}: ${isOpen(oid)?'obert':'tancat'}.`); }
}
/* xip flotant per a portes d'arquitectura (no són elements de la ICT) */
let LEAFCHIP=null;
function showLeafChip(l){
  LEAFCHIP=l; const c=$('#leafChip'); c.classList.remove('hidden');
  c.innerHTML=`<span>${esc(leafName(l))}</span><button id="leafTog" class="on">${leafOpen(l)?'Tancar':'Obrir'}</button><button id="leafX" aria-label="Amaga">×</button>`;
  $('#leafTog').onclick=()=>{ toggleLeaf(l); showLeafChip(l); };
  $('#leafX').onclick=hideLeafChip;
}
function hideLeafChip(){ LEAFCHIP=null; $('#leafChip')?.classList.add('hidden'); }
function doHover(){
  if(!hoverQueued) return; const {x,y}=hoverQueued; hoverQueued=null;
  if(down && down.moved){ setHover(null); return; }
  const id=pickAt(x,y); setHover(id, x, y);
}
function setHover(id,x,y){
  const tip=$('#tip'), cv=renderer.domElement;
  if(id!==S.hover){ S.hover=id; applyMaterials(); }
  if(!id){ tip.style.display='none'; cv.style.cursor='grab'; return; }
  cv.style.cursor='pointer';
  const r=$('#view3d').getBoundingClientRect(), e=EL[id], oid=e.openOf||id;
  const act = NAV.on ? 'clic per apropar-t\'hi' : 'clic per seleccionar';
  tip.innerHTML=`${famIcon(e)} ${esc(e.sigla? e.sigla+' · ':'')}${esc(shortName(e))} <b>· ${act}${LEAF_OF[oid]?' · doble clic per obrir o tancar':''}</b>`;
  tip.style.display='block';
  const tx=Math.min(x-r.left+14, r.width-tip.offsetWidth-6), ty=Math.max(y-r.top-30,4);
  tip.style.left=tx+'px'; tip.style.top=ty+'px';
}

/* ===================================================================
   ETIQUETES
   =================================================================== */
let needLabels=true; const LBL={}; const NOHOVER = matchMedia('(hover: none)').matches;
function famIcon(e){ return {xarxa:'〰',canal:'◯',recinte:'▣',punt:'●'}[e.fam]; }
function shortName(e){ return e.name; }
function labelText(e){
  let t = e.sigla ? e.sigla : e.name.split(' (')[0].split(' — ')[0];
  if(e.ptype){ const ty={rtv:'RTV',dat:'RJ45',tba:'TBA',fo:'fibra'}[e.ptype]; t = (e.sigla?'BAT ':'Registre ')+ty+(e.dbl?' doble':'')+' · '+ROOM(e.room).name; return `${famIcon(e)} ${t}`; }
  if(e.sigla && e.unit) t+=` ${UNIT(e.unit).name}`;
  else if(!e.sigla && e.unit) t+=` · ${UNIT(e.unit).name}`;
  else if(e.rs) t+=` · ${e.rsTag||e.floor+'a'}`;
  return `${famIcon(e)} ${t}`;
}
function anchorOf(id){
  const b=elBox(id); if(!b) return null;
  const c=b.getCenter(new THREE.Vector3()); c.y=b.max.y+0.05; return c;
}
function labelSet(){
  const s=new Set();
  if(!S.layers.etiquetes) { if(NOHOVER && S.selected) s.add(S.selected); return s; }
  for(const e of Object.values(EL)){
    if(!elVisible(e)) continue;
    if(S.allLabels) s.add(e.id);
  }
  /* sense ratolí (pantalla tàctil) no hi ha «hover»: es mostra només l'etiqueta de l'element seleccionat */
  if(NOHOVER && S.selected) s.add(S.selected);
  for(const id of [...s]) if(!(G.byEl[id]||[]).some(m=>m.visible)) s.delete(id);
  return s;
}
let curLabels=new Set(), refLabelEls=[];
function rebuildLabels(){
  needLabels=false;
  const want=labelSet(); const box=$('#labels');
  for(const id of curLabels) if(!want.has(id)){ LBL[id].el.remove(); delete LBL[id]; }
  for(const id of want){
    if(!LBL[id]){ const d=document.createElement('div'); d.className='lbl'; d.textContent=labelText(EL[id]); box.appendChild(d); LBL[id]={el:d}; }
    LBL[id].pos=anchorOf(id);
    LBL[id].el.className='lbl'+(id===S.selected?' sel':S.related.has(id)?' rel':'');
  }
  curLabels=want;
  for(const r of refLabelEls) r.el.remove(); refLabelEls=[];
  if(S.layers.etiquetes) for(const r of G.refLabels){
    let show=false;
    if(r.cls==='room') show = (S.mode==='habitatge' && curUnit()===r.unit) || (S.mode==='planta' && S.floor===r.floor && S.allLabels);
    else if(r.unitLbl) show = (S.mode==='planta' && r.floor===S.floor) || (S.mode==='habitatge' && r.unit===curUnit()) || (S.allLabels && S.mode==='oberta');
    else if(r.cls==='zone') show = (S.mode==='planta' && r.floor===S.floor) || (S.allLabels && S.mode==='oberta');
    else show = S.mode==='ict' || (S.mode==='planta' && r.floor===S.floor) || S.allLabels;
    if(S.mode==='habitatge' && r.unit && r.unit!==curUnit()) show=false;
    if(S.mode==='planta' && r.floor!==S.floor) show=false;
    if(!show) continue;
    const d=document.createElement('div'); d.className='lbl '+r.cls; d.textContent=r.text; box.appendChild(d); refLabelEls.push({el:d,pos:r.pos});
  }
}
function archOrIct(r){ return S.mode!=='habitatge' || r.unit===curUnit(); }
const _v=new THREE.Vector3();
function placeLabels(){
  const r=$('#view3d').getBoundingClientRect(), W=r.width, H=r.height;
  const place=(el,pos)=>{
    if(!pos){ el.style.display='none'; return; }
    _v.copy(pos).project(camera);
    if(_v.z>1||_v.z<-1||Math.abs(_v.x)>1.1||Math.abs(_v.y)>1.1){ el.style.display='none'; return; }
    el.style.display='block'; el.style.left=((_v.x+1)/2*W)+'px'; el.style.top=((1-_v.y)/2*H)+'px';
  };
  const placed=[];
  const order=[...curLabels].sort((a,b)=>(b===S.selected)-(a===S.selected) || (S.related.has(b))-(S.related.has(a)));
  for(const id of order){ const el=LBL[id].el; place(el, LBL[id].pos); if(el.style.display==='none') continue;
    const w=el.offsetWidth, h=el.offsetHeight, x=parseFloat(el.style.left)-w/2, y=parseFloat(el.style.top)-h;
    if(id!==S.selected && placed.some(p=>x<p.x+p.w+2 && x+w+2>p.x && y<p.y+p.h+1 && y+h+1>p.y)){ el.style.display='none'; continue; }
    placed.push({x,y,w,h}); }
  for(const x of refLabelEls) place(x.el,x.pos);
}

/* ===================================================================
   LLISTA LATERAL
   =================================================================== */
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* text normalitzat per a la cerca: minúscules i sense accents ni punt volat (accés = acces, instal·lació = instalacio) */
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[·.]/g,'').toLowerCase();
const famOpen = {xarxa:true, canal:true, recinte:true, punt:true};
function listOrder(e){ return (e.floor==null? (e.noModel?9:0.5) : e.floor===5? -1 : e.floor) * 100 + (e.unit?50:0); }
function renderList(){
  const q=norm(($('#search').value||'').trim()), fl=$('#fltFloor').value;
  const box=$('#list'); let h='';
  for(const [fk,fam] of Object.entries(FAMILIES)){
    let items=Object.values(EL).filter(e=>e.fam===fk && !ritsBad(e.id));
    if(fl==='none') items=items.filter(e=>e.noModel);
    else if(fl!=='any') items=items.filter(e=>!e.noModel && (e.floor===+fl || (e.vertical)));
    if(q){ const words=q.split(/\s+/); items=items.filter(e=>{ const t=e._q ||= (x=>x+' '+x.replace(/ll/g,'l'))(norm(e.name+' '+(e.sigla||'')+' '+(e.what||''))); return words.every(w=>t.includes(w)); }); }
    items.sort((a,b)=>listOrder(a)-listOrder(b));
    h+=`<details class="fam" data-fam="${fk}" ${famOpen[fk]||q?'open':''}><summary>${famIcon({fam:fk})} ${esc(fam.name)} <span class="muted small">(${items.length})</span></summary><ul>`;
    const li=e=>{ const vis = e.noModel ? 'sense 3D' : (elVisible(e) ? '' : 'ocult');
      return `<li><button class="item${e.id===S.selected?' sel':''}" data-id="${e.id}" aria-pressed="${e.id===S.selected}"><span class="ic" aria-hidden="true">${famIcon(e)}</span><span>${esc(e.name)}${e.sigla?` <b>(${esc(e.sigla)})</b>`:''}</span>${vis?`<span class="hid">${vis}</span>`:''}</button></li>`; };
    for(const e of items.filter(e=>!e.unit)) h+=li(e);
    for(const un of UNITS){
      const its=items.filter(e=>e.unit===un.id); if(!its.length) continue;
      const k=fk+'_'+un.id, open = q || famOpen[k] || (S.selected && EL[S.selected].unit===un.id && EL[S.selected].fam===fk);
      h+=`<li><details class="fam sub" data-fam="${k}" ${open?'open':''}><summary>${esc(unitTitle(un))} <span class="muted small">(${its.length})</span></summary><ul>${its.map(li).join('')}</ul></details></li>`;
    }
    h+='</ul></details>';
  }
  box.innerHTML=h;
}

/* ===================================================================
   PANELL D'EXPLICACIÓ
   =================================================================== */
function chip(id){ const e=EL[id]; if(!e) return ''; let t=e.name.split(' — ')[0]; if(e.sigla && !t.includes('('+e.sigla)) t=`${t} (${e.sigla})`; if(e.unit && !e.parent) t+=` · ${UNIT(e.unit).name}`; return `<button class="chip" data-goto="${id}">${famIcon(e)} ${esc(t)}</button>`; }
function renderInfo(){
  const box=$('#infoPanel'), id=S.selected;
  if(!id){
    box.innerHTML = Q.active ? '' : `<div class="card"><h2>Benvingut/da</h2>
    ${CFG.welcome || `<p>Aquest model mostra la <b>ICT</b> (infraestructura comuna de telecomunicacions) d'un edifici amb soterrani d'aparcament, planta baixa amb vestíbul i botiga, i quatre plantes amb quatre habitatges per planta (A, B, C i D: 16 habitatges).</p>`}
    <p><b>Com començar:</b></p><ol class="small"><li>Fes clic en un element de l'escena: se selecciona i la càmera s'hi apropa. El botó <b>◀</b> torna a la vista anterior.</li><li>Fes <b>doble clic</b> en una porta, un armari o una tapa per obrir-la; torna-hi a fer doble clic per tancar-la.</li><li>Amb la icona de l'<b>ull</b> tries què es veu (per exemple, treure la façana) i hi tens la llegenda de colors; amb <b>Vistes</b> vas a una planta, a un habitatge o a l'interior del RITS.</li><li>Quan acabis d'explorar, posa't a prova amb <b>Comprova què has après</b>.</li></ol>
    <p class="small muted">Famílies: 〰 xarxes (cables) · ◯ canalitzacions (tubs) · ▣ recintes i registres (locals i caixes) · ● punts de connexió i equips.</p></div>`;
    return;
  }
  const e=Object.assign({}, EL[id], (EL[id].vt||{})[S.cap]||{}), fam=FAMILIES[e.fam];
  const loc = e.noModel ? 'No representat al model' : (e.unit? `${unitTitle(UNIT(e.unit))} · ` : '') + (e.floor==null? 'Diverses plantes (tram vertical)' : FLOORNAME(e.floor));
  const parentChain=[]; let p=e.parent; while(p){ parentChain.push(p); p=EL[p].parent; }
  const rel=relatedOf(id);
  const nets=[...rel].filter(x=>EL[x].fam==='xarxa'), cans=[...rel].filter(x=>EL[x].fam==='canal');
  const contains=(e.children||[]).filter(x=>!ritsBad(x));
  const openId=e.openOf||id, canOpen = (e.lid||e.openOf) && !e.noModel;
  box.innerHTML = `<div class="card" aria-label="Fitxa de l'element seleccionat">
   <h2>${famIcon(e)} ${esc(e.name)}${e.sigla?` <span class="muted">(${esc(e.sigla)})</span>`:''}</h2>
   <span class="fambadge">${esc(fam.name)}</span><span class="fambadge zone">Zona ${esc(e.zone||'—')}</span>
   <p style="margin:6px 0"><b>Què és?</b> ${esc(e.what)}</p>
   <p style="margin:6px 0"><b>Per a què serveix?</b> ${esc(e.purpose)}</p>
   <p style="margin:6px 0"><b>On es troba?</b> ${esc(e.where)} <span class="muted small">(${esc(loc)})</span></p>
   ${parentChain.length?`<div class="small"><b>Allotjat a:</b><div class="chips">${parentChain.map(chip).join(' ')}</div></div>`:''}
   ${contains.length?`<div class="small" style="margin-top:6px"><b>Allotja:</b><div class="chips">${contains.map(chip).join(' ')}</div></div>`:''}
   <div class="actions">
    <button data-act="center" ${e.noModel||!renderer?'disabled':''}>Centrar</button>
    <button data-act="conn">Veure connexions</button>
    ${canOpen?`<button data-act="open" class="primary" aria-pressed="${isOpen(openId)}">${isOpen(openId)?'Tancar':'Obrir'} ${openId==='rits'?'la porta':(G.doors||[]).some(d=>d.of===openId)&&EL[openId].layer==='recintes'?'les portes':EL[openId].layer==='recintes'?'el recinte':'la tapa'}</button>`:''}
    ${e.fam==='canal'&&!e.noModel?`<button data-act="opencanal">${S.openCanal.has(id)?'Tancar el tram':'Obrir el tram (veure cables)'}</button>`:''}
    <button data-act="desel">Desseleccionar</button>
   </div>
   <details class="more"><summary>Amplia la informació</summary>
    <dl><dt>Què connecta o què allotja</dt><dd>${esc(e.connects)}</dd>
    ${nets.length?`<dt>Xarxes relacionades</dt><dd class="chips">${nets.map(chip).join(' ')}</dd>`:''}
    ${cans.length?`<dt>Canalitzacions relacionades</dt><dd class="chips">${cans.map(chip).join(' ')}</dd>`:''}
    ${(()=>{const o=[...rel].filter(x=>!['xarxa','canal'].includes(EL[x].fam)&&!contains.includes(x)&&!parentChain.includes(x)); return o.length?`<dt>Altres elements relacionats</dt><dd class="chips">${o.map(chip).join(' ')}</dd>`:'';})()}
    </dl>
    <div class="ex"><b>Exemple pràctic:</b> ${esc(e.example)}</div>
    <div class="cf"><b>Confusió habitual:</b> ${esc(e.confusion)}</div>
    ${e.more?`<div class="ex"><b>${esc(e.more[0])}:</b> ${esc(e.more[1])}</div>`:''}
   </details>
   ${S.related.size?`<p class="small muted" style="margin-bottom:0">Elements relacionats ressaltats en blau a l'escena.</p>`:''}
  </div>${inRits(id)||id==='rits'?ritsCardHTML(id):''}`;
}

/* ===================================================================
   MODES I CONTROLS
   =================================================================== */
function setMode(m, silent){
  if(!silent) navPush();
  if(m==='complet'){ m='oberta'; S.layers.facana=true; }
  S.mode=m;
  if(m==='habitatge' && !curUnit()){ S.floor=CFG.floor0; S.unitSide=CFG.side0; }
  syncControls(); applyVisibility();
  if(!silent && renderer){ if(m==='habitatge') flyTo(VIEWS.home().p,VIEWS.home().t); else if(m==='planta') flyTo(VIEWS.floor().p,VIEWS.floor().t); }
  navUI();
}
function syncControls(){
  $('#selMode').value=S.mode; $('#selFloor').value=String(S.floor); $('#selUnit').value=S.unitSide;
  $('#selUnit').disabled = !CFG.unitFloors.includes(S.floor);
  for(const [k] of Object.entries(LAYERS)){ const c=$(`#ly_${k}`); if(c) c.checked=S.layers[k]; }
  const sv=$(`input[name=svc][value=${S.svc}]`); if(sv) sv.checked=true;
  $(`input[name=colorBy][value=${S.colorBy}]`).checked=true;
  $('#optAllLabels').checked=S.allLabels; $('#optTubes').checked=S.tubesSee; $('#optOpenRec').checked=S.openRec; $('#optOpenReg').checked=S.openReg;
  $('#optSat').checked=S.sat; if($('#optCut')) $('#optCut').checked=S.cut; $('#optReduced').checked=S.reduced; $('#optLowQ').checked=S.lowq; $('#transp').value=S.transp; $('#optNav').checked=NAV.on;
  $('#homeFloor').value=String(curUnit()?S.floor:CFG.floor0); $('#homeUnit').value=S.unitSide;
  renderLegend();
}
function updateStatus(){
  const names={oberta:S.layers.facana?CFG.whole:'Façana oberta',transp:'Transparència',ict:'Només ICT',planta:'Planta aïllada',habitatge:CFG.homeMode||'Habitatge detallat'};
  let t=`<b>${names[S.mode]}</b>`;
  if(S.mode==='planta') t+=` · ${FLOORNAME(S.floor)}`;
  if(S.mode==='habitatge') t+=` · ${unitTitle(UNIT(curUnit()))}`;
  if(S.svc!=='all') t+=` · Servei: ${SERVICES[S.svc]}`;
  if(S.selected) t+=` · ${esc(EL[S.selected].sigla||EL[S.selected].name)}`;
  $('#statusChip').innerHTML=t;
  const eye=$('#btnEye'); if(eye){ const def=S0(); const diff=Object.keys(def.layers).some(k=>def.layers[k]!==S.layers[k]) || S.svc!=='all'; eye.classList.toggle('mod',diff); }
}
function renderLegend(){
  const by=S.colorBy;
  if(by==='real'){ const sw=(c,t)=>`<span><span class="sw" style="background:${c};border:1px solid #888"></span>${t}</span>`;
    $('#legend').innerHTML=`<b>Llegenda — colors d'aspecte real:</b>`+sw('#F4F3EF','Coaxial de RTV · cable de distribució 1 (i cables interiors)')+sw('#1C1D1F','Coaxial de RTV · cable de distribució 2')+sw('#F2C200','Fibra òptica')+sw('#2E9B3F','Connectors de fibra SC/APC')+sw('#9EA4AA','Parells de coure (mànegues, escomeses i cables interiors)')+
      `<span><span class="sw tube"></span>Tub de canalització</span><span><span class="sw box"></span>Recinte o registre</span><span class="muted">Per veure el tram de xarxa, tria «Per tram de xarxa».</span>`; return; }
  let h=`<b>Llegenda — el color dels cables indica ${by==='tram'?'<u>el tram de xarxa</u>':'<u>la tecnologia del cable</u>'}:</b>`;
  if(by==='tram') for(const t of Object.values(TRAMS)) h+=`<span><span class="sw" style="background:${t.color}"></span>${t.sym} ${esc(t.name)}</span>`;
  else for(const t of Object.values(TECHS)) h+=`<span><span class="sw" style="background:${t.color}"></span>${t.sym} ${esc(t.name)} (${t.pattern})</span>`;
  h+=`<span><span class="sw tube"></span>Tub de canalització</span><span><span class="sw box"></span>Recinte o registre</span><span class="muted">Colors: codi didàctic, no obligatori. ${by==='tram'?'Patró de la superfície: tecnologia.':''}</span>`;
  $('#legend').innerHTML=h;
}
function resetView(){ const v=VIEWS.start(); flyTo(v.p,v.t); }
function resetAll(){
  Q.active=false; NAV.stack=[]; hideLeafChip(); setLiftFloor(0);
  const keep=S.reduced; S=S0(); S.reduced=keep; if(renderer && CAPBUILT!==S.cap){ clearScope(); withRoot(RITS_ROOT,()=>buildCapVariant(S.cap)); } if(RG.spot) RG.spot.intensity=0; shadowRefresh();
  setLearn('free'); syncControls(); applyVisibility(); select(null); resetView(); setPanel('eye',false); setPanel('views',false);
  for(const w of ['left','right']) openDrawer(w,false); navUI();
}
/* ===================================================================
   NAVEGACIÓ INTERACTIVA: doble clic → vista òptima; «Tornar» → vista anterior
   =================================================================== */
const NAV = {on:true, stack:[]};
const _rc = new THREE.Raycaster();
function pathPoint(pts,u){ let d=u*polyLen(pts); for(let i=1;i<pts.length;i++){ const L=pts[i].distanceTo(pts[i-1]); if(d<=L) return pts[i-1].clone().lerp(pts[i], L>0?d/L:0); d-=L; } return pts[pts.length-1].clone(); }
function bestView(id){
  const b=elBox(id)||elBox(id,false); if(!b) return null;
  let c=b.getCenter(new THREE.Vector3()); const sz=b.getSize(new THREE.Vector3());
  let r=Math.max(sz.length()/2,0.22);
  const cabs=Object.values(G.cables).filter(k=>k.el===id && k.mesh && k.mesh.visible && k.pts.length>1);
  if(cabs.length){ const cb=cabs.reduce((a,k)=>polyLen(k.pts)>polyLen(a.pts)?k:a); c=pathPoint(cb.pts,0.5).applyMatrix4(cb.mesh.matrixWorld); r=Math.min(r,1.6); }
  const vis=visArea(), vf0=camera.fov*Math.PI/180, vf=2*Math.atan(Math.tan(vf0/2)*vis.y), hf=2*Math.atan(Math.tan(vf0/2)*camera.aspect*vis.x), fit=Math.min(vf,hf);
  const want=THREE.MathUtils.clamp(r/Math.sin(fit/2)*1.25, (EL[id]?.rs ? 0.65 : 0.9), 45);
  /* eix més prim: cara frontal de registres, preses i plaques */
  const dims=[sz.x,sz.y,sz.z], k=dims.indexOf(Math.min(...dims)), others=dims.filter((_,i)=>i!==k);
  const thin = dims[k] < 0.5*Math.min(...others) && k!==1;
  const own=new Set(G.byEl[id]||[]);
  const occA=G.arch.filter(m=>m.visible && m.material!==AM.glass && m.material!==AM.glassRail && !m.userData.sign);
  const openLeaf = m => { const k=m.userData.leafKey; return k && LEAF_BY_KEY[k] && leafOpen(LEAF_BY_KEY[k]); };   // fulles que s'estan obrint: no tapen
  let occ=[...occA, ...G.meshes.filter(m=>m.visible && !own.has(m) && !m.userData.cable && !openLeaf(m) && !(m.material.transparent && m.material.opacity<0.85))];
  const curDir=camera.position.clone().sub(controls.target).normalize();
  let best=null;
  for(let pass=0; pass<2 && !best; pass++){ if(pass===1) occ=occA;
  for(const el of [12,28,45,62,80]) for(let a=0;a<360;a+=20){
    const er=el*Math.PI/180, ar=a*Math.PI/180;
    const d=new THREE.Vector3(Math.cos(er)*Math.sin(ar), Math.sin(er), Math.cos(er)*Math.cos(ar));
    let score = 1 - Math.abs(el-35)/90 + 0.35*d.dot(curDir);
    if(thin){ const n=new THREE.Vector3(); n.setComponent(k,1); score += 1.6*Math.abs(d.dot(n)) - 0.9*(1-Math.abs(d.dot(n))); }
    _rc.set(c,d); _rc.near=0; _rc.far=want;
    const h=_rc.intersectObjects(occ,false)[0];
    let dist=want;
    if(h){ dist=h.distance*0.9; if(dist < r*1.15+0.15) continue; score -= 0.6*(1-dist/want); }
    if(dist<0.45) continue;
    if(!best || score>best.score) best={score,d,dist};
  } }
  if(!best) return null;
  return {p:c.clone().add(best.d.clone().multiplyScalar(best.dist)), t:c};
}
/* historial de navegació: càmera i context de visibilitat */
function navState(){ return {p:camera.position.clone(), t:controls.target.clone(), mode:S.mode, floor:S.floor, unitSide:S.unitSide, selected:S.selected,
  layers:Object.assign({},S.layers), svc:S.svc, sat:S.sat, tubesSee:S.tubesSee, open:new Map(S.openOv), leaf:new Map(S.leaf), openRec:S.openRec, openReg:S.openReg,
  ritsRoof:S.ritsRoof, ritsFront:S.ritsFront, lift:LIFT.floor}; }
function navPush(){
  if(!renderer) return;
  const st=navState(), l=NAV.stack[NAV.stack.length-1];
  if(l && l.p.distanceTo(st.p)<0.02 && l.t.distanceTo(st.t)<0.02 && l.mode===st.mode && l.floor===st.floor && l.unitSide===st.unitSide && l.selected===st.selected && JSON.stringify(l.layers)===JSON.stringify(st.layers)) return;
  NAV.stack.push(st); if(NAV.stack.length>40) NAV.stack.shift(); navUI();
}
function navTo(id){
  if(!id || !renderer) return;
  navPush();
  ensureVisible(id);
  select(id);
  let v=bestView(id);
  if(!v && S.layers.facana){ S.layers.facana=false; syncControls(); applyVisibility(); v=bestView(id); }
  if(!v && EL[id].unit && S.mode!=='habitatge'){ const u=UNIT(EL[id].unit); S.floor=u.f; S.unitSide=u.s; S.mode='habitatge'; syncControls(); applyVisibility(); v=bestView(id); }
  if(v) flyTo(v.p,v.t); else frameEl(id);
  controls.minDistance=0.3;
  navUI();
}
function navBack(){
  const s=NAV.stack.pop(); if(!s) return;
  S.mode=s.mode; S.floor=s.floor; S.unitSide=s.unitSide; S.layers=Object.assign({},s.layers); S.svc=s.svc; S.sat=s.sat; S.tubesSee=s.tubesSee;
  S.openOv=new Map(s.open); S.leaf=new Map(s.leaf); S.openRec=s.openRec; S.openReg=s.openReg; S.ritsRoof=s.ritsRoof; S.ritsFront=s.ritsFront; setLiftFloor(s.lift);
  syncControls(); applyVisibility();
  S.selected=s.selected; S.related=new Set(); applyMaterials(); renderInfo(); renderList(); needLabels=true;
  if(!s.selected && !Q.active) openDrawer('right',false);
  $('#vCenter').disabled=!s.selected;
  flyTo(s.p,s.t); navUI(); announce('Vista anterior recuperada.');
}
function setNav(on){
  NAV.on=on; if(!on) controls.minDistance=0.6;
  navUI(); syncControls();
  announce(on ? 'Navegació interactiva activada: un clic selecciona un element i hi apropa la càmera.' : 'Navegació interactiva desactivada: un clic només selecciona.');
}
function navUI(){
  const bk=$('#vBack'); if(!bk) return;
  bk.disabled=!NAV.stack.length;
  const n=NAV.stack.length;
  bk.title = n ? `Torna a la vista anterior (${n} ${n===1?'pas':'passos'} desats) · tecla Retrocés` : 'No hi ha cap vista anterior';
  bk.setAttribute('aria-label', n ? `Tornar a la vista anterior (${n})` : 'Tornar a la vista anterior (no disponible)');
  $('#backN').textContent = n>1 ? String(n) : '';
}

/* ===================================================================
   ACTIVITATS
   =================================================================== */
const Q = {active:false, i:0, done:new Set(), fb:null, order:null};
function renderQuiz(){
  const box=$('#modePanel'), q=QUIZ[Q.i];
  let body='';
  if(q.type==='pick') body=`<p class="small">Selecciona'l fent clic a l'escena o des de la llista d'elements de l'esquerra.</p>`;
  if(q.type==='mcq') body=`<div class="mcq">${q.opts.map((o,i)=>`<button data-mcq="${i}">${String.fromCharCode(97+i)}) ${esc(o)}</button>`).join('')}</div>`;
  if(q.type==='order'){
    Q.order ||= q.items.slice();
    body=`<ol class="ord" style="padding-left:18px">${Q.order.map((o,i)=>`<li><span>${esc(o)}</span><button data-up="${i}" aria-label="Puja ${esc(o)}" ${i===0?'disabled':''}>↑</button><button data-dn="${i}" aria-label="Baixa ${esc(o)}" ${i===Q.order.length-1?'disabled':''}>↓</button></li>`).join('')}</ol><button data-qact="checkorder" class="on">Comprova l'ordre</button>`;
  }
  box.innerHTML=`<div class="modebox"><h2>Comprova què has après</h2>
   <div class="qlist" role="group" aria-label="Activitats">${QUIZ.map((x,i)=>`<button data-q="${i}" class="${Q.done.has(i)?'done':''} ${i===Q.i?'on':''}" aria-label="Activitat ${i+1}${Q.done.has(i)?' (feta)':''}">${i+1}${Q.done.has(i)?' ✓':''}</button>`).join('')}</div>
   <h3>Activitat ${Q.i+1} de ${QUIZ.length}</h3><p><b>${esc(q.q)}</b></p>${body}
   ${Q.fb?`<div class="fb ${Q.fb.ok?'ok':'ko'}" role="status">${Q.fb.ok?'✓ ':'✗ '}${esc(Q.fb.t)}${Q.fb.ok?'':' Torna-ho a provar.'}</div>`:''}
   <div class="stepnav"><button data-qact="prev" ${Q.i===0?'disabled':''}>◀ Anterior</button><button data-qact="next" ${Q.i===QUIZ.length-1?'disabled':''}>Següent ▶</button><button data-qact="exit">Sortir</button></div>
   <p class="small muted" style="margin-bottom:0">${Q.done.size} de ${QUIZ.length} activitats completades. Sense límit de temps ni penalitzacions.</p></div>`;
}
function quizPick(id){
  const q=QUIZ[Q.i]; if(q.type!=='pick') return;
  if(q.ok(id)){ Q.fb={ok:true,t:q.good}; Q.done.add(Q.i); } else Q.fb={ok:false,t:q.hint(id)};
  renderQuiz();
}
function setLearn(m){
  S.learn=m; $$('[data-learn]').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.learn===m)));
  Q.active = m==='quiz';
  if(m==='quiz'){ Q.fb=null; renderQuiz(); }
  else $('#modePanel').innerHTML='';
  renderInfo();
  if(m!=='free') openDrawer('right',true);
}

/* ===================================================================
   DIÀLEGS, ESDEVENIMENTS I INICI
   =================================================================== */
/* calaixos plegables: Elements (esquerra) i Fitxa (dreta).
   En pantalles petites són fulls inferiors i només n'hi ha un d'obert alhora. */
const DRW={left:'#btnLeft', right:'#btnRight'};
/* espai de l'escena tapat pels calaixos oberts (els calaixos se superposen a l'escena) */
function drawerCover(){
  const c={l:0,r:0,b:0}; const W=$('#view3d').clientWidth;
  for(const w of ['left','right']){ const el=$('#'+w); if(!el.classList.contains('open')) continue;
    if(innerWidth<=760) c.b=Math.max(c.b, el.offsetHeight); else if(w==='left') c.l=el.offsetWidth; else c.r=el.offsetWidth; }
  c.l=Math.min(c.l,W*0.5); c.r=Math.min(c.r,W*0.5); return c;
}
/* fracció visible de l'escena (per calcular la distància d'enquadrament) */
function visArea(){ const el=$('#view3d'), W=el.clientWidth||1, H=el.clientHeight||1, c=drawerCover(); return {x:Math.max(0.3,(W-c.l-c.r)/W), y:Math.max(0.3,(H-c.b)/H)}; }
function visFrac(){ const v=visArea(); return Math.min(v.x,v.y); }
/* desplaça el centre de projecció cap a la part visible: l'element enquadrat no queda sota la fitxa */
const VOFF={x:0,y:0,tx:0,ty:0};
function syncViewOffset(instant){
  if(!renderer) return;
  const c=drawerCover(); VOFF.tx=(c.r-c.l)/2; VOFF.ty=c.b/2;
  if(instant || S.reduced){ VOFF.x=VOFF.tx; VOFF.y=VOFF.ty; applyViewOffset(); }
}
function applyViewOffset(){
  const el=$('#view3d'), W=el.clientWidth, H=el.clientHeight;
  if(Math.abs(VOFF.x)<0.5 && Math.abs(VOFF.y)<0.5) camera.clearViewOffset(); else camera.setViewOffset(W,H,VOFF.x,VOFF.y,W,H);
  camera.updateProjectionMatrix();
}
function openDrawer(which, open){
  const el=$('#'+which), btn=$(DRW[which]); if(!el) return;
  const v = open ?? !el.classList.contains('open');
  el.classList.toggle('open',v); btn.setAttribute('aria-expanded',String(v)); btn.classList.toggle('on',v);
  $('.app').classList.toggle(which+'Open',v);
  if(v && innerWidth<=760) for(const o of Object.keys(DRW)) if(o!==which && $('#'+o).classList.contains('open')) openDrawer(o,false);
  if(v && innerWidth<=760){ setPanel('eye',false); setPanel('views',false); }
  syncViewOffset(); needLabels=true;
}
/* menús flotants del visor: ull (capes) i vistes */
function setPanel(which, open){
  const p=$(which==='eye'?'#eyePanel':'#viewMenu'), b=$(which==='eye'?'#btnEye':'#btnViews'); if(!p) return;
  const v = open ?? p.classList.contains('hidden');
  p.classList.toggle('hidden',!v); b.setAttribute('aria-expanded',String(v)); b.classList.toggle('on',v);
  if(v){ setPanel(which==='eye'?'views':'eye',false); if(innerWidth<=760) for(const o of Object.keys(DRW)) openDrawer(o,false); }
}
function buildStaticUI(){
  $('#layerBox').innerHTML=Object.entries(LAYERS).map(([k,n])=>`<label><input type="checkbox" id="ly_${k}" data-layer="${k}"> ${esc(n)}</label>`).join('');
  $('#svcBox').innerHTML=Object.entries(SERVICES).map(([k,n])=>`<label class="opt"><input type="radio" name="svc" value="${k}" ${k==='all'?'checked':''}> ${esc(n)}</label>`).join('');
  $('#conceptsBody').innerHTML=CONCEPTS.map(([t,x])=>`<div class="concept"><h3>${esc(t)}</h3><p style="margin:2px 0">${x}</p></div>`).join('');
  $('#aboutBody').innerHTML=`<h3>Simplificacions i limitacions</h3><ul>${SIMPLIFICATIONS.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>
   ${CFG.about ?? `<h3>Configuració representada</h3><ul><li>RTV: torre de 6 m amb tres tirants i màstil amb antenes TDT, DAB i FM; parabòlica offset amb LNB doble (es pot amagar) → cinc coaxials independents per l\'enllaç superior → capçalera al RITS amb dos amplificadors de FI i mesclador (cable 1: terrestre + SAT A; cable 2: terrestre + SAT B) → dos cables de distribució en arbre-branca amb derivadors a cada registre secundari → dos cables de dispersió (blanc i negre) fins al PAU + repartidor (2 entrades F, una carregada; 4 sortides) → xarxa interior en estrella.</li>
   <li>Fibra òptica: operador → arqueta → canalització externa → punt d'entrada general → enllaç inferior → registre principal òptic (punt d'interconnexió) → cable multifibra de distribució → caixa de segregació amb empalmaments a cada planta → escomesa → roseta òptica (PAU) → fibra interior → presa òptica de la sala d'estar → ONT i encaminador (equips de l'usuari) → retorn per la BAT RJ45 doble fins al registre de terminació de xarxa → xarxa interior de parells trenats.</li>
   <li>Preses de cada habitatge (dotació mínima): 4 de RTV, 6 registres de parells trenats (BAT doble a la sala i al dormitori 1), 2 coaxials de TBA (sala i dormitori 1), 1 de fibra òptica a la sala i 1 registre configurable al rebedor. El bany no en té.</li>
   <li>Parells (STDP): mànega de l'operador → 8 regletes Krone d'entrada → ponts → 5 regletes de sortida → mànega de 50 parells (37 línies × 1,2) → sangrat de 10 parells a cada planta → regleta del registre secundari (8 parells connectats, 2 lliures) → escomesa de 2 parells → dues rosetes RJ45 al PAU.</li></ul>
   <h3>Fonts tècniques</h3><ul><li>Reial decret 346/2011, d'11 de març, Reglament regulador de les infraestructures comunes de telecomunicacions (text consolidat, BOE-A-2011-5834): annex I (RTV), annex II (telefonia i banda ampla) i annex III (canalitzacions, recintes i elements complementaris; apartat 5.13 en la redacció de l'Ordre ECE/983/2019). <a href="https://www.boe.es/buscar/act.php?id=BOE-A-2011-5834" target="_blank" rel="noopener">boe.es</a></li></ul>
   <h3>Fonts dels models del RITS</h3><ul class="small">
    <li>Televes AVANT 12 PRO SAT, ref. 532204: 4 entrades VHF+UHF, 1 d'FM i 1 de satèl·lit (FI, guany 41 dB, alimentació de l'LNB); sortida TV (només terrestre) i sortida TV+SAT. <a href="https://www.televes.com/es/532204-central-programable-avant-12-pro-sat-para-terrestre-satelite-32-filtros-digitales-y-programacion-automatica-avanzada-mediante-asuite-bluetoothr.html" target="_blank" rel="noopener">televes.com</a></li>
    <li>Televes sèrie T12: 509812 (monocanal UHF), 508312 (banda III), 508012 (FI 950‑2150 MHz, alimenta l'LNB, 350 mA màx.), font 549812 (24 V, 2,5 A, classe II), carril 5071, pont F 5074. <a href="https://www.televes.com/es/508012-amplificador-t12-fi-sat-950-2150mhz.html" target="_blank" rel="noopener">televes.com</a></li>
    <li>Mescladors Televes 740710 (TERR + SAT A + SAT B → OUT A i OUT B) i 745210 (MATV + FI → 1 sortida). <a href="https://www.televes.com/es/740710-mezclador-de-se-al-terrestre-y-2-satelites-3-entradas-matv-fi-fi.html" target="_blank" rel="noopener">televes.com</a></li>
    <li>Televes filtre LTE/5G 403201, càrregues 4061 (amb bloqueig de CC) i 4058, adaptador F‑F 4173, connector F roscat 417101 (perfil del plànol CAD07190354 i fotos de referència), cables T100 (exterior PE negre i interior PVC blanc). <a href="https://www.televes.com" target="_blank" rel="noopener">televes.com</a></li>
    <li>Recinte (porta, safata, alimentació elèctrica, il·luminació, ventilació, placa i anell de terra): RD 346/2011, annex III, apartats 5.5 i 7.1. El model en fa una representació orientativa; no n'acredita el compliment.</li></ul>
   <h3>L'edifici del model</h3><p class="small">Edifici plurifamiliar entre mitgeres amb nucli central d'escala i ascensor: soterrani d'aparcament (16 places, rampa de vehicles, trasters i vestíbul d'independència), planta baixa (vestíbul, local de serveis, RITI i una botiga), quatre plantes amb quatre habitatges (A–D) al voltant d'un distribuïdor comú i coberta transitable amb el RITS i les antenes. Les dimensions (forjats de 3 m entre plantes, escala de dos trams amb esglaons de 17 × 28 cm, portes de 0,9 m, cabina d'ascensor d'uns 1,4 × 1,9 m) són plausibles però <b>no constitueixen un projecte arquitectònic</b> ni acrediten el compliment del CTE (DB-SUA, DB-SI) ni de la normativa d'accessibilitat.</p>
   <ul class="small"><li>Tipologies generals d'habitatge plurifamiliar amb nucli central i distribuïdor (manuals de projecte i exemples docents d'arquitectura); dimensions d'escales i passos de referència del CTE DB-SUA 1 (consulta orientativa). <a href="https://www.codigotecnico.org" target="_blank" rel="noopener">codigotecnico.org</a></li></ul>
`}
   <h3>Tecnologia</h3><p class="small">Pàgina web estàtica amb Three.js r160 inclòs (sense connexió a internet). Els models glTF dels equips es carreguen si la pàgina se serveix des d'un servidor web; si no, se'n mostra una versió simplificada.</p>`;
}
function bindEvents(){
  $('#list').addEventListener('click',e=>{ const b=e.target.closest('[data-id]'); if(b) select(b.dataset.id,{fromList:true}); });
  $('#list').addEventListener('toggle',e=>{ const d=e.target.closest('details.fam'); if(d) famOpen[d.dataset.fam]=d.open; },true);
  $('#search').addEventListener('input',renderList); $('#fltFloor').addEventListener('change',renderList);
  $('#layerBox').addEventListener('change',e=>{ const k=e.target.dataset.layer; if(k){ S.layers[k]=e.target.checked; applyVisibility(); } });
  $('#svcBox').addEventListener('change',e=>{ if(e.target.name==='svc'){ S.svc=e.target.value; applyVisibility(); } });
  $$('input[name=colorBy]').forEach(r=>r.addEventListener('change',()=>{ S.colorBy=$('input[name=colorBy]:checked').value; applyMaterials(); renderLegend(); }));
  $('#optAllLabels').onchange=e=>{ S.allLabels=e.target.checked; needLabels=true; };
  $('#optTubes').onchange=e=>{ S.tubesSee=e.target.checked; applyMaterials(); };
  $('#optOpenRec').onchange=e=>{ S.openRec=e.target.checked; for(const k of [...S.openOv.keys()]) if(EL[k].layer==='recintes') S.openOv.delete(k); applyVisibility(); renderInfo(); };
  $('#optOpenReg').onchange=e=>{ S.openReg=e.target.checked; for(const k of [...S.openOv.keys()]) if(EL[k].layer!=='recintes') S.openOv.delete(k); applyVisibility(); renderInfo(); };
  $('#optSat').onchange=e=>{ S.sat=e.target.checked; applyVisibility(); };
  if($('#optCut')) $('#optCut').onchange=e=>{ S.cut=e.target.checked; applyVisibility(); };
  $('#optReduced').onchange=e=>{ S.reduced=e.target.checked; };
  $('#optLowQ').onchange=e=>{ S.lowq=e.target.checked; if(renderer){ renderer.setPixelRatio(S.lowq?1:Math.min(devicePixelRatio,2)); onResize(); shadowRefresh(); } };
  $('#selMode').onchange=e=>setMode(e.target.value);
  $('#transp').oninput=e=>{ S.transp=+e.target.value; applyVisibility(); };
  $('#selFloor').onchange=e=>{ navPush(); S.floor=+e.target.value; if(S.mode==='habitatge' && !curUnit()) S.mode='planta'; if(S.mode!=='habitatge') S.mode='planta'; syncControls(); applyVisibility(); setView(S.mode==='habitatge'?'home':'floor',{noPush:true}); };
  $('#selUnit').onchange=e=>{ navPush(); S.unitSide=e.target.value; applyVisibility(); if(S.mode==='habitatge') setView('home',{noPush:true}); };
  $('#homeGo').onclick=()=>{ navPush(); S.floor=+$('#homeFloor').value; S.unitSide=$('#homeUnit').value; setView('home',{noPush:true}); if(innerWidth<=760) setPanel('views',false); };
  $$('[data-view]').forEach(b=>b.onclick=()=>{ setView(b.dataset.view); if(innerWidth<=760) setPanel('views',false); });
  $('#zIn').onclick=()=>dolly(0.75); $('#zOut').onclick=()=>dolly(1.33);
  $('#vReset').onclick=()=>{ navPush(); resetView(); };
  $('#vCenter').onclick=()=>{ if(S.selected){ if(NAV.on) navTo(S.selected); else { ensureVisible(S.selected); frameEl(S.selected); } } };
  $('#optNav').onchange=e=>setNav(e.target.checked); $('#vBack').onclick=navBack;
  $('#btnEye').onclick=()=>setPanel('eye'); $('#btnViews').onclick=()=>setPanel('views');
  $('#btnCloseAll').onclick=closeAllLeaves;
  $$('.panelClose').forEach(b=>b.onclick=()=>{ setPanel(b.dataset.panel,false); $(b.dataset.panel==='eye'?'#btnEye':'#btnViews').focus(); });
  addEventListener('keydown',e=>{ if(e.key==='Backspace' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && !document.querySelector('dialog[open]')){ e.preventDefault(); navBack(); } });
  $('#infoPanel').addEventListener('click',e=>{
    const g=e.target.closest('[data-goto]'); if(g){ select(g.dataset.goto,{fromList:true}); return; }
    const ra=e.target.closest('[data-ract]'); if(ra){ ritsAction(ra.dataset.ract); return; }
    const a=e.target.closest('[data-act]'); if(!a) return; const id=S.selected;
    if(a.dataset.act==='center'){ ensureVisible(id); frameEl(id); }
    if(a.dataset.act==='conn') showConnections(id);
    if(a.dataset.act==='desel') select(null);
    if(a.dataset.act==='open'){ const oid=EL[id].openOf||id; setOpen(oid,!isOpen(oid)); applyVisibility(); renderInfo(); announce(`${EL[oid].name}: ${isOpen(oid)?'obert':'tancat'}.`); }
    if(a.dataset.act==='opencanal'){ S.openCanal.has(id)?S.openCanal.delete(id):S.openCanal.add(id); applyMaterials(); renderInfo(); }
  });
  $('#infoPanel').addEventListener('change',e=>{
    if(e.target.name==='ritsCap'){ setCap(e.target.value); }
    if(e.target.name==='ritsLook'){ S.ritsLook=e.target.value; applyVisibility(); renderInfo(); }
  });
  $('#modePanel').addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.q!==undefined){ Q.i=+b.dataset.q; Q.fb=null; Q.order=null; renderQuiz(); }
    const qa=b.dataset.qact, q=QUIZ[Q.i];
    if(qa==='prev'){ Q.i--; Q.fb=null; Q.order=null; renderQuiz(); } if(qa==='next'){ Q.i++; Q.fb=null; Q.order=null; renderQuiz(); }
    if(qa==='exit') setLearn('free');
    if(b.dataset.mcq!==undefined){ const i=+b.dataset.mcq; Q.fb = i===q.ok ? {ok:true,t:q.good} : {ok:false,t:q.why[i]}; if(i===q.ok) Q.done.add(Q.i); renderQuiz(); }
    if(b.dataset.up!==undefined){ const i=+b.dataset.up; [Q.order[i-1],Q.order[i]]=[Q.order[i],Q.order[i-1]]; Q.fb=null; renderQuiz(); $(`[data-up="${i-1}"]`)?.focus(); }
    if(b.dataset.dn!==undefined){ const i=+b.dataset.dn; [Q.order[i+1],Q.order[i]]=[Q.order[i],Q.order[i+1]]; Q.fb=null; renderQuiz(); $(`[data-dn="${i+1}"]`)?.focus(); }
    if(qa==='checkorder'){ const ok=Q.order.join('|')===q.ok.join('|'); Q.fb= ok?{ok:true,t:q.good}:{ok:false,t:q.bad}; if(ok) Q.done.add(Q.i); renderQuiz(); }
  });
  $$('[data-learn]').forEach(b=>b.onclick=()=>setLearn(b.dataset.learn));
  $('#btnConcepts').onclick=()=>$('#dlgConcepts').showModal(); $('#btnAbout').onclick=()=>$('#dlgAbout').showModal(); $('#btnHelp').onclick=()=>$('#help').classList.toggle('hidden');
  $$('.closeDlg').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  $('#btnResetAll').onclick=resetAll;
  $$('.drawerClose').forEach(b=>b.onclick=()=>{ openDrawer(b.dataset.close,false); $(DRW[b.dataset.close]).focus(); }); $('#btnLeft').onclick=()=>openDrawer('left'); $('#btnRight').onclick=()=>openDrawer('right');
  $('#helpOk').onclick=()=>{ $('#help').classList.add('hidden'); try{ localStorage.setItem('ict3d.helpSeen','1'); }catch(_){} renderer?.domElement.focus(); };
  addEventListener('keydown',e=>{ if(e.key!=='Escape' || document.querySelector('dialog[open]')) return;
    if(!$('#eyePanel').classList.contains('hidden')||!$('#viewMenu').classList.contains('hidden')){ setPanel('eye',false); setPanel('views',false); return; }
    if(!$('#help').classList.contains('hidden')){ $('#help').classList.add('hidden'); return; }
    if(LEAFCHIP){ hideLeafChip(); return; }
    for(const w of ['left','right']) openDrawer(w,false); });
  $('#view3d').addEventListener('pointerdown',e=>{ if(e.target===renderer?.domElement && innerWidth<=760){ setPanel('eye',false); setPanel('views',false); } });
}
function dolly(k){
  if(!renderer) return;
  const off=camera.position.clone().sub(controls.target); const d=THREE.MathUtils.clamp(off.length()*k, controls.minDistance, controls.maxDistance);
  flyTo(controls.target.clone().add(off.setLength(d)), controls.target.clone());
}
function onResize(){
  if(!renderer) return;
  const el=$('#view3d'), w=el.clientWidth, h=el.clientHeight;
  renderer.setSize(w,h,false); camera.aspect=w/Math.max(h,1); syncViewOffset(true); applyViewOffset(); needLabels=true;
}
function initGL(){
  try{
    const c=document.createElement('canvas'); const ok=!!(window.WebGLRenderingContext && (c.getContext('webgl2')||c.getContext('webgl')));
    if(!ok) throw new Error('sense WebGL');
    renderer=new THREE.WebGLRenderer({antialias:true, logarithmicDepthBuffer:true});
  }catch(err){ renderer=null; glOK=false; $('#nogl').style.display='flex'; $('#help').classList.add('hidden'); return false; }
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.domElement.tabIndex=0; renderer.domElement.setAttribute('aria-label',CFG.sceneLabel+'. Usa la llista d\'elements per seleccionar amb el teclat.');
  $('#view3d').prepend(renderer.domElement);
  renderer.shadowMap.enabled=false; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate=false;
  scene=new THREE.Scene(); scene.background=new THREE.Color(0xEEF2F6);
  camera=new THREE.PerspectiveCamera(42,1,0.05,400);
  scene.add(new THREE.HemisphereLight(0xffffff,0xB8B4AC,2.1));
  const dl=new THREE.DirectionalLight(0xffffff,1.9); dl.position.set(18,30,22); scene.add(dl);
  const dl2=new THREE.DirectionalLight(0xffffff,0.7); dl2.position.set(-20,10,-15); scene.add(dl2);
  controls=new OrbitControls(camera, renderer.domElement);
  controls.enableDamping=true; controls.dampingFactor=0.12; controls.minDistance=0.3; controls.maxDistance=80; controls.zoomToCursor=true; controls.zoomSpeed=1.1; controls.rotateSpeed=0.8;
  controls.maxPolarAngle=Math.PI*0.495; controls.screenSpacePanning=true;
  controls.addEventListener('change',()=>{ const t=controls.target, K=CFG.clamp; t.x=THREE.MathUtils.clamp(t.x,...K.x); t.y=THREE.MathUtils.clamp(t.y,...K.y); t.z=THREE.MathUtils.clamp(t.z,...K.z); });
  controls.addEventListener('start',()=>{ camAnim=null; });
  const cv=renderer.domElement;
  cv.addEventListener('pointerdown',onPointerDown); cv.addEventListener('pointermove',onPointerMove);
  cv.addEventListener('pointerup',onPointerUp); cv.addEventListener('pointerleave',()=>{ hoverQueued=null; setHover(null); });
  addEventListener('resize',onResize); new ResizeObserver(onResize).observe($('#view3d'));
  return true;
}
let last=performance.now();
function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min((now-last)/1000,0.1); last=now;
  if(camAnim){ let u=(now-camAnim.s)/camAnim.d; if(u>=1){u=1;} const k=u<0.5?2*u*u:1-Math.pow(-2*u+2,2)/2;
    camera.position.lerpVectors(camAnim.p0,camAnim.p1,k); controls.target.lerpVectors(camAnim.t0,camAnim.t1,k); if(u>=1) camAnim=null; }
  controls.update();
  if(Math.abs(VOFF.x-VOFF.tx)>0.5 || Math.abs(VOFF.y-VOFF.ty)>0.5){ const k=Math.min(1,dt*10); VOFF.x+=(VOFF.tx-VOFF.x)*k; VOFF.y+=(VOFF.ty-VOFF.y)*k; if(Math.abs(VOFF.x-VOFF.tx)<=0.5) VOFF.x=VOFF.tx; if(Math.abs(VOFF.y-VOFF.ty)<=0.5) VOFF.y=VOFF.ty; applyViewOffset(); }
  doHover(); leavesTick(dt);
  if(needLabels) rebuildLabels();
  placeLabels();
  renderer.render(scene,camera);
}
/* =====================================================================
   ARQUITECTURA DE L'EDIFICI
   Soterrani (aparcament), planta baixa (vestíbul, RITI, local de serveis,
   botiga), quatre plantes amb quatre habitatges (A, B, C, D) i coberta.
   Coordenades: x (amplada) -8..8, z (fondària) -15..5 (façana principal a z=5).
   Els habitatges es defineixen en coordenades de l'habitatge A i es reflecteixen:
   B (x → -x), D (z → -10-z) i C (x → -x, z → -10-z).
   ===================================================================== */
const BLD = {x0:-8, x1:8, z0:-15, z1:5, H:2.8,
  core:{x0:-2, x1:2},
  stair:{x0:-2.0, x1:0.3, lL:[-2.0,-0.88], lR:[-0.82,0.3], z0:1.3, tread:0.28, n:8, zl:3.54, z1:4.75},
  lift:{x0:0.4, x1:1.9, z0:2.75, z1:4.75, wz0:2.65, dx0:0.75, dx1:1.65},
  pat:{x0:-0.2, x1:1.75, z0:-5.25, z1:-4.75},
  well:{x0:-2, x1:2, z0:-15, z1:-8},
  bas:{x0:-8, x1:12.4, z0:-22, z1:5, ramp:{x0:8.3, x1:12.1, z0:-12, z1:5}}};
const XS = u => (u.s==='A'||u.s==='D') ? 1 : -1;
const ZM = u => (u.s==='C'||u.s==='D');
const SZ = u => ZM(u) ? -1 : 1;
const mz = (u,z) => ZM(u) ? -10 - z : z;

/* ---------- materials ---------- */
function archMats(){
  const L = (c,o={}) => new THREE.MeshLambertMaterial(Object.assign({color:c}, o));
  AM.wall=L(0xEDE8DF); AM.wallIn=L(0xF6F3EE); AM.facade=L(0xE7DCCB); AM.facade2=L(0xC98F6B); AM.slab=L(0xD9D5CE); AM.roof=L(0xC9C4BB);
  AM.edge=L(0xB9B2A6); AM.plinth=L(0xA8A39A);
  AM.glass=L(0x8FB3CF,{transparent:true, opacity:0.42, depthWrite:false}); AM.glassRail=L(0xA9C9DC,{transparent:true, opacity:0.32, depthWrite:false});
  AM.frame=L(0x4A4F55); AM.rail=L(0x5B6168); AM.stair=L(0xCFCAC2); AM.stairEdge=L(0xB2ABA0); AM.furn=L(0xC8B79E); AM.furn2=L(0x9DB4C8); AM.furn3=L(0x7E9A6E);
  AM.ground=L(0xC9D8B8); AM.side=L(0xCFCCC6); AM.street=L(0x8E9196); AM.soil=L(0x8B6B4A); AM.found=L(0xB8B2A8);
  AM.park=L(0x9EA2A6); AM.line=L(0xF4F4F0); AM.lineY=L(0xE8C547); AM.concrete=L(0xB7B5B0); AM.door=L(0x9A7A58); AM.doorM=L(0x8E979F); AM.liftDoor=L(0xA9B1B8);
  AM.car1=L(0x3F6FB5); AM.car2=L(0xB8433A); AM.car3=L(0xD9D9D4); AM.car4=L(0x3E4348); AM.tyre=L(0x222222);
  AM.shop=L(0xEFE6D2); AM.shelf=L(0xB98B5E); AM.awning=L(0x2F8A5B); AM.tile=L(0xD8CDBB); AM.lobby=L(0xE2DBD0);
  AM.ref=new THREE.LineBasicMaterial({color:0x5D6B7A});
  AM.list=[AM.wall,AM.wallIn,AM.facade,AM.facade2,AM.slab,AM.roof,AM.edge,AM.plinth,AM.frame,AM.rail,AM.stair,AM.stairEdge,AM.furn,AM.furn2,AM.furn3,AM.found,AM.park,AM.concrete,AM.door,AM.doorM,AM.liftDoor,AM.shop,AM.shelf,AM.tile,AM.lobby,AM.car1,AM.car2,AM.car3,AM.car4,AM.tyre,AM.line,AM.lineY,AM.awning];
}

/* ---------- cua de caixes d'arquitectura: es fusionen per material i etiquetes ---------- */
const ARCHQ = new Map(); const COLL=[];   // COLL: caixes per a les col·lisions del mode primera persona
let archN=0;
function aBox(w,h,d,x,y,z,mat,o={}){
  if(w<=0.0005||h<=0.0005||d<=0.0005) return null;
  const e=0.0015*(1+(archN++%6));
  const g=new THREE.BoxGeometry(w+2*e,h+2*e,d+2*e); g.translate(x,y,z);
  const flags=Object.assign({}, o); const key=(mat.uuid)+'|'+JSON.stringify(flags);
  if(!ARCHQ.has(key)) ARCHQ.set(key,{mat,flags,geos:[]});
  ARCHQ.get(key).geos.push(g.toNonIndexed()); g.dispose();
  if(mat!==AM.line && mat!==AM.lineY && !o.noColl) COLL.push({x0:x-w/2,x1:x+w/2,y0:y-h/2,y1:y+h/2,z0:z-d/2,z1:z+d/2,f:flags});
  return null;
}
function aBoxB(x0,x1,y0,y1,z0,z1,mat,o){ return aBox(Math.abs(x1-x0),Math.abs(y1-y0),Math.abs(z1-z0),(x0+x1)/2,(y0+y1)/2,(z0+z1)/2,mat,o); }
function mergeGeos(geos){
  let n=0; for(const g of geos) n+=g.attributes.position.count;
  const pos=new Float32Array(n*3), nor=new Float32Array(n*3), uv=new Float32Array(n*2); let o=0;
  for(const g of geos){ pos.set(g.attributes.position.array,o*3); nor.set(g.attributes.normal.array,o*3); uv.set(g.attributes.uv.array,o*2); o+=g.attributes.position.count; g.dispose(); }
  const m=new THREE.BufferGeometry(); m.setAttribute('position',new THREE.BufferAttribute(pos,3)); m.setAttribute('normal',new THREE.BufferAttribute(nor,3)); m.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  m.computeBoundingBox(); m.computeBoundingSphere(); return m;
}
function flushArch(){
  for(const {mat,flags,geos} of ARCHQ.values()){
    const m=new THREE.Mesh(mergeGeos(geos),mat); addArch(m,flags);
  }
  ARCHQ.clear();
}
function addArch(mesh, o){ ud(mesh, Object.assign({kind:'arch'}, o)); scene.add(mesh); G.arch.push(mesh); return mesh; }

/* caixa en coordenades de l'habitatge A, reflectida per a l'habitatge u */
function UB(u,x0,x1,y0,y1,z0,z1,mat,o){ const a=mx(u,x0),b=mx(u,x1),c=mz(u,z0),d=mz(u,z1); return aBoxB(Math.min(a,b),Math.max(a,b),y0,y1,Math.min(c,d),Math.max(c,d),mat,o); }

/* paret amb obertures. axis 'x': paret al llarg de x (gruix en z); 'z': al llarg de z.
   ops: [a0,a1,b0,b1] (a: coordenada al llarg de la paret; b: alçada relativa a y0) */
function wallOps(B, axis, a0, a1, t0, t1, y0, y1, ops, mat, o, glass){
  const H=y1-y0, list=ops.slice().sort((p,q)=>p[0]-q[0]); let a=a0;
  const put=(p0,p1,q0,q1)=>{ if(p1-p0<1e-3||q1-q0<1e-3) return; if(axis==='x') B(p0,p1,y0+q0,y0+q1,t0,t1,mat,o); else B(t0,t1,y0+q0,y0+q1,p0,p1,mat,o); };
  for(const [s0,s1,b0,b1] of list){ put(a,s0,0,H); put(s0,s1,0,b0); put(s0,s1,b1,H); a=s1; }
  put(a,a1,0,H);
  if(glass) for(const op of list){ if(op[4]==='door') continue; const [s0,s1,b0,b1]=op, tm=(t0+t1)/2, fr=0.05;
    if(axis==='x'){ B(s0,s1,y0+b0,y0+b1,tm-0.01,tm+0.01,AM.glass,glass); B(s0,s1,y0+b0,y0+b0+fr,t0-0.02,t1+0.02,AM.frame,glass); B(s0,s1,y0+b1-fr,y0+b1,tm-0.03,tm+0.03,AM.frame,glass); B(s0,s0+fr,y0+b0,y0+b1,tm-0.03,tm+0.03,AM.frame,glass); B(s1-fr,s1,y0+b0,y0+b1,tm-0.03,tm+0.03,AM.frame,glass); if(s1-s0>1.1) B((s0+s1)/2-0.025,(s0+s1)/2+0.025,y0+b0,y0+b1,tm-0.03,tm+0.03,AM.frame,glass); }
    else { B(tm-0.01,tm+0.01,y0+b0,y0+b1,s0,s1,AM.glass,glass); B(t0-0.02,t1+0.02,y0+b0,y0+b0+fr,s0,s1,AM.frame,glass); B(tm-0.03,tm+0.03,y0+b1-fr,y0+b1,s0,s1,AM.frame,glass); B(tm-0.03,tm+0.03,y0+b0,y0+b1,s0,s0+fr,AM.frame,glass); B(tm-0.03,tm+0.03,y0+b0,y0+b1,s1-fr,s1,AM.frame,glass); if(s1-s0>1.1) B(tm-0.03,tm+0.03,y0+b0,y0+b1,(s0+s1)/2-0.025,(s0+s1)/2+0.025,AM.frame,glass); }
  }
}
const WB = (x0,x1,y0,y1,z0,z1,mat,o)=>aBoxB(Math.min(x0,x1),Math.max(x0,x1),y0,y1,Math.min(z0,z1),Math.max(z0,z1),mat,o);
const UWB = u => (x0,x1,y0,y1,z0,z1,mat,o)=>UB(u,x0,x1,y0,y1,z0,z1,mat,o);

/* forjat rectangular amb buits */
function slabHoles(x0,x1,z0,z1,y0,y1,holes,mat,o){
  const xs=[...new Set([x0,x1,...holes.flatMap(h=>[h[0],h[1]]).filter(v=>v>x0&&v<x1)])].sort((a,b)=>a-b);
  const zs=[...new Set([z0,z1,...holes.flatMap(h=>[h[2],h[3]]).filter(v=>v>z0&&v<z1)])].sort((a,b)=>a-b);
  for(let i=0;i<xs.length-1;i++){
    let run=null;
    for(let j=0;j<zs.length-1;j++){
      const cx=(xs[i]+xs[i+1])/2, cz=(zs[j]+zs[j+1])/2;
      const inHole=holes.some(h=>cx>h[0]&&cx<h[1]&&cz>h[2]&&cz<h[3]);
      if(!inHole){ if(run) run[1]=zs[j+1]; else run=[zs[j],zs[j+1]]; }
      if(inHole||j===zs.length-2){ if(run){ aBoxB(xs[i],xs[i+1],y0,y1,run[0],run[1],mat,o); run=null; } }
    }
  }
}

/* ---------- textures de text (rètols) ---------- */
function textPlane(lines, w, h, pos, normal, o={}){
  const c=document.createElement('canvas'), W=o.px||512, Hh=Math.round(W*h/w); c.width=W; c.height=Hh; const g=c.getContext('2d');
  g.fillStyle=o.bg||'#FFFFFF'; g.fillRect(0,0,W,Hh);
  if(o.border){ g.strokeStyle=o.border; g.lineWidth=Math.max(4,Hh*0.05); g.strokeRect(2,2,W-4,Hh-4); }
  g.fillStyle=o.fg||'#2C2C2B'; g.textAlign='center'; g.textBaseline='middle';
  const fs=o.size||Math.round(Hh/(lines.length+0.6)); lines.forEach((t,i)=>{ g.font=`${i===0&&o.bold!==false?'700 ':''}${i===0?fs:Math.round(fs*0.62)}px Arial, sans-serif`; g.fillText(t,W/2,Hh*(i+0.8)/(lines.length+0.6)); });
  const tex=new THREE.CanvasTexture(c); tex.anisotropy=4; if(THREE.SRGBColorSpace) tex.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({map:tex, toneMapped:false}));
  m.position.copy(pos); m.lookAt(pos.clone().add(normal)); return addArch(m, Object.assign({sign:true}, o.flags||{}));
}

/* ---------- fulles practicables (portes, tapes) ---------- */
const LEAVES=[]; const LEAF_OF={}; const LEAF_BY_KEY={};
function regLeaf(l){ LEAVES.push(l); LEAF_BY_KEY[l.key]=l; if(l.of) (LEAF_OF[l.of] ||= []).push(l); l.cur=l.cur||0;
  l.piv.traverse(o=>{ if(o.isMesh) o.userData.leafKey=l.key; }); return l; }
/* porta abatible d'arquitectura: frontissa a (hx,hz), fulla al llarg de 'along' (vector unitari xz), obre cap a 'swing' */
function archDoor(key, label, hx, y0, hz, along, w, h, swing, mat, flags, o={}){
  const piv=new THREE.Group(); piv.position.set(hx,y0,hz); scene.add(piv);
  const rot0=Math.atan2(-along.z, along.x); piv.rotation.y=rot0;
  const mk=(geo,m,x,y,z)=>{ const me=new THREE.Mesh(geo,m); me.position.set(x,y,z); piv.add(me); ud(me,Object.assign({kind:'arch', archLeaf:true},flags)); G.arch.push(me); return me; };
  const t=o.t||0.045;
  if(o.glass){ mk(new THREE.BoxGeometry(w,0.06,t),AM.frame,w/2,0.03,0); mk(new THREE.BoxGeometry(w,0.06,t),AM.frame,w/2,h-0.03,0); mk(new THREE.BoxGeometry(0.06,h,t),AM.frame,0.03,h/2,0); mk(new THREE.BoxGeometry(0.06,h,t),AM.frame,w-0.03,h/2,0); mk(new THREE.BoxGeometry(w-0.1,h-0.1,0.012),AM.glass,w/2,h/2,0); }
  else mk(new THREE.BoxGeometry(w,h,t),mat,w/2,h/2,0);
  for(const s of [1,-1]) mk(new THREE.BoxGeometry(0.13,0.025,0.025),AM.frame,w-0.12,1.02,s*(t/2+0.03));
  // sentit d'obertura: el que porta l'extrem lliure cap a 'swing'
  const tip=d=>{ const a=rot0+d; return {x:Math.cos(a)*w, z:-Math.sin(a)*w}; };
  const tp=tip(1.6), ang = (tp.x*swing.x+tp.z*swing.z)>0 ? 1.6 : -1.6;
  return regLeaf({key, label, piv, kind:'rot', base:rot0, open:o.open??ang, arch:true, flags});
}
/* porta corredissa (ascensor) */
function slideDoor(key,label,x,y0,z,w,h,dx,mat,flags){
  const piv=new THREE.Group(); piv.position.set(x,y0,z); scene.add(piv);
  const me=new THREE.Mesh(new THREE.BoxGeometry(w,h,0.04),mat); me.position.set(0,h/2,0); piv.add(me); ud(me,Object.assign({kind:'arch',archLeaf:true},flags)); G.arch.push(me);
  return regLeaf({key,label,piv,kind:'slide',base:x,open:dx,arch:true,flags});
}
function leafOpen(l){ if(S.leaf.has(l.key)) return S.leaf.get(l.key); return l.of ? elOpenDefault(l.of) : false; }
function leavesTick(dt){
  for(const l of LEAVES){
    const tg = leafOpen(l) ? 1 : 0;
    l.cur = S.reduced ? tg : l.cur + (tg-l.cur)*Math.min(1,dt*5);
    if(l.kind==='rot') l.piv.rotation.y = l.base + l.open*l.cur;
    else if(l.kind==='rotx') l.piv.rotation.x = l.open*l.cur;
    else if(l.kind==='slide') l.piv.position.x = l.base + l.open*l.cur;
  }
}
/* tapes de registres i armaris: la tapa gira sobre una frontissa en comptes de desaparèixer */
function finalizeLids(){
  scene.updateMatrixWorld(true);   // tapes dins de grups (model de cases): caixes en coordenades de l'escena
  const groups={}; for(const m of new Set(G.lids)) (groups[m.userData.lidOf] ||= []).push(m);
  for(const [of,ms] of Object.entries(groups)){
    const lb=new THREE.Box3(); for(const m of ms){ m.updateMatrixWorld(true); lb.union(new THREE.Box3().setFromObject(m)); }
    const own=new Set(ms), bb=new THREE.Box3(); for(const m of (G.byEl[of]||[])) if(!own.has(m)){ m.updateMatrixWorld(true); bb.union(new THREE.Box3().setFromObject(m)); }
    const sz=lb.getSize(new THREE.Vector3()), lc=lb.getCenter(new THREE.Vector3()), bc=bb.isEmpty()?lc.clone():bb.getCenter(new THREE.Vector3());
    const dims=[sz.x,sz.y,sz.z], k=dims.indexOf(Math.min(...dims));
    const piv=new THREE.Group(); let l;
    if(k===1){ const out=Math.sign(lc.y-bc.y)||1; piv.position.set(lc.x,lb.max.y,lb.min.z); scene.add(piv); for(const m of ms) piv.attach(m); l={key:'lid:'+of, of, piv, kind:'rotx', open:-1.75*out}; }
    else if(k===2){ const out=Math.sign(lc.z-bc.z)||1; piv.position.set(lb.min.x,lc.y,lc.z); scene.add(piv); for(const m of ms) piv.attach(m); l={key:'lid:'+of, of, piv, kind:'rot', base:0, open:-1.75*out}; }
    else { const out=Math.sign(lc.x-bc.x)||1; piv.position.set(lc.x,lc.y,lb.min.z); scene.add(piv); for(const m of ms) piv.attach(m); l={key:'lid:'+of, of, piv, kind:'rot', base:0, open:1.75*out}; }
    regLeaf(l);
  }
  /* portes d'elements de la ICT (RITI, RITS, quadre del RITS) */
  (G.doors||[]).forEach((d,i)=>regLeaf({key:`${d.of}#${i}`, of:d.of, piv:d.piv, kind:'rot', base:0, open:-d.side*1.85}));
}

/* ===================================================================
   CONSTRUCCIÓ
   =================================================================== */
function buildArchitecture(){
  buildGround(); buildBasement(); buildGroundFloor();
  for(let f=1; f<=4; f++) buildResidentialFloor(f);
  buildRoof(); buildCore();
  for(const u of UNITS){ buildUnitShell(u); buildPartitions(u); buildFurniture(u); }
  flushArch();
}

function buildGround(){
  const Gd={ground:true, floor:0};
  // terreny (amb buits per a l'edifici i la rampa)
  aBoxB(-30,BLD.x0,-0.32,-0.16,-40,5,AM.ground,Gd); aBoxB(12.4,30,-0.32,-0.16,-40,5,AM.ground,Gd);
  aBoxB(BLD.x0,12.4,-0.32,-0.16,-40,BLD.z0,AM.ground,Gd); aBoxB(8,12.4,-0.32,-0.16,BLD.z0,-12,AM.ground,Gd);
  aBoxB(-30,30,-0.32,-0.16,8.5,30,AM.street,Gd);
  // vorera (z 5..8.5) amb obertura sobre l'arqueta i la canalització externa (x 3.6..5.4, z 5..7.9)
  aBoxB(-30,3.55,-0.16,0,5,8.5,AM.side,Gd); aBoxB(5.45,30,-0.16,0,5,8.5,AM.side,Gd);
  aBoxB(3.55,5.45,-0.16,0,7.95,8.5,AM.side,Gd);
  aBoxB(3.6,5.4,-1.0,-0.95,5,7.9,AM.soil,Gd);
  aBoxB(3.55,3.6,-1.0,0,5,7.9,AM.soil,Gd); aBoxB(5.4,5.45,-1.0,0,5,7.9,AM.soil,Gd); aBoxB(3.55,5.45,-1.0,0,7.9,7.95,AM.soil,Gd);
  // gual del garatge a la vorera
  aBoxB(8.3,12.1,-0.02,0.005,5.0,8.5,AM.lineY,Gd);
}

/* ---------- PAISATGE DE FONS: cel amb núvols i muntanyes (panorama generat) i plana fins a l'horitzó ----------
   El panorama és una textura equirectangular dibuixada amb canvas (sense imatges externes). La plana i el tram de carrer
   allargat s'esvaeixen amb boira llunyana del mateix color que l'horitzó del panorama. En el mode «Només ICT» es manté
   el fons llis. */
const BG_PLAIN=new THREE.Color(0xEEF2F6), HORIZ=0xD6E0D8;
let SKY_TEX=null, FOG=null, MOUNTS=null;
function rng(seed){ return ()=>{ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function skyTexture(){
  const W=2048, H=1024, HZ=H/2, R=rng(7), c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d');
  const hex=n=>'#'+n.toString(16).padStart(6,'0');
  /* cel i terra llunyana */
  let gr=g.createLinearGradient(0,0,0,HZ); gr.addColorStop(0,'#5E98D6'); gr.addColorStop(0.55,'#9CC3E8'); gr.addColorStop(1,'#DDE9F3');
  g.fillStyle=gr; g.fillRect(0,0,W,HZ);
  g.fillStyle=hex(HORIZ); g.fillRect(0,HZ,W,H-HZ);
  /* núvols: grups d'el·lipses suaus; més amples a prop del zenit (compensa la deformació de la projecció) */
  const puff=(x,y,rx,ry,a)=>{ for(const dx of [0,-W,W]){ const q=g.createRadialGradient(x+dx,y,0,x+dx,y,rx);
      q.addColorStop(0,`rgba(255,255,255,${a})`); q.addColorStop(0.6,`rgba(250,251,253,${a*0.6})`); q.addColorStop(1,'rgba(255,255,255,0)');
      g.save(); g.translate(x+dx,y); g.scale(1,ry/rx); g.translate(-(x+dx),-y); g.fillStyle=q; g.beginPath(); g.arc(x+dx,y,rx,0,7); g.fill(); g.restore(); } };
  for(let i=0;i<46;i++){
    const y=110+R()*330, el=(HZ-y)/HZ*Math.PI/2, k=Math.min(3,1/Math.cos(el)), sz=(0.35+0.65*(y-60)/400)*(26+R()*34);
    const x=R()*W, n=6+Math.floor(R()*7);
    for(let j=0;j<n;j++) puff(x+(R()-0.5)*sz*3.2*k, y+(R()-0.5)*sz*0.5, sz*(0.6+R()*0.7)*k, sz*(0.45+R()*0.35), 0.55+R()*0.3);
  }
  const t=new THREE.CanvasTexture(c); t.mapping=THREE.EquirectangularReflectionMapping; t.colorSpace=THREE.SRGBColorSpace;
  t.generateMipmaps=false; t.minFilter=THREE.LinearFilter;          // sense mipmaps: evita la franja borrosa a la costura del panorama
  return t;
}
/* serralades en 3D: tres anells (230–270 m) amb el perfil d'una suma de sinusoides periòdica; colors de boira, sense
   il·luminació ni boira de l'escena; més altes darrere de l'edifici (−z) i amb neu a l'anell del fons */
function buildMountains(){
  const grp=new THREE.Group(), cH=new THREE.Color(HORIZ), white=new THREE.Color(0xF4F7FA);
  for(const [seed,R,base,amp,rough,top,snow] of [[11,270,62,48,0.85,0x8FA4BE,true],[23,250,40,32,0.9,0x7E94A8,false],[37,230,18,15,1.0,0x718C7B,false]]){
    const r=rng(seed), terms=[]; for(let k=1;k<=60;k++) terms.push([k, r()*Math.PI*2, Math.pow(k,-rough)*(0.6+r()*0.8)]);
    const N=720, pos=[], col=[], idx=[], cT=new THREE.Color(top);
    const H=[]; for(let i=0;i<=N;i++){ const u=i/N; let h=0; for(const [k,ph,a] of terms) h+=a*Math.sin(2*Math.PI*k*u+ph);
      const env=0.5+0.5*Math.cos(2*Math.PI*(u-0.75)); H.push(Math.max(1.5,(base+h*amp*0.22)*(0.35+0.65*env))); }
    const hmax=Math.max(...H);
    /* tres files de vèrtexs: base (color de l'horitzó), 70 % de l'alçada (color de la serralada) i cim (neu als més alts) */
    for(let i=0;i<=N;i++){ const a=i/N*Math.PI*2, x=Math.cos(a)*R, z=Math.sin(a)*R;
      pos.push(x,-1,z, x,H[i]*0.7,z, x,H[i],z);
      const c=snow && H[i]>hmax*0.78 ? cT.clone().lerp(white,Math.min(1,(H[i]/hmax-0.78)/0.1)) : cT;
      col.push(cH.r,cH.g,cH.b, cT.r,cT.g,cT.b, c.r,c.g,c.b);
      if(i<N) for(const r of [0,1]){ const b=i*3+r; idx.push(b,b+3,b+1, b+1,b+3,b+4); } }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx);
    grp.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true, side:THREE.DoubleSide, fog:false})));
  }
  scene.add(grp); return grp;
}
function buildLandscape(){
  SKY_TEX=skyTexture(); FOG=new THREE.Fog(HORIZ,110,290); MOUNTS=buildMountains();
  const Gd={ground:true, floor:0}, F=320;
  // plana al voltant del terreny i carrer allargat a banda i banda (s'esvaeixen amb la boira)
  aBoxB(-F,F,-0.32,-0.16,-F,-40,AM.ground,Gd); aBoxB(-F,F,-0.32,-0.16,30,F,AM.ground,Gd);
  aBoxB(-F,-30,-0.32,-0.16,-40,8.5,AM.ground,Gd); aBoxB(30,F,-0.32,-0.16,-40,8.5,AM.ground,Gd);
  aBoxB(-F,-30,-0.32,-0.16,8.5,30,AM.street,Gd); aBoxB(30,F,-0.32,-0.16,8.5,30,AM.street,Gd);
}
function landscapeVisibility(){ if(!scene || !SKY_TEX) return; const on=S.mode!=='ict'; scene.background = on ? SKY_TEX : BG_PLAIN; scene.fog = on ? FOG : null; if(MOUNTS) MOUNTS.visible=on; }

/* ---------- SOTERRANI: aparcament ---------- */
function buildBasement(){
  const y=-3, f=-1, o={floor:f}, ow={floor:f}, B=BLD.bas, H=2.8;
  // terra
  aBoxB(B.x0,B.x1,y-0.2,y,B.z0,B.z1,AM.park,Object.assign({slab:true},o));
  // parets perimetrals (sota terra)
  WB(B.x0-0.25,B.x0,y,y+H+0.2,B.z0-0.25,B.z1,AM.concrete,ow);           // esquerra
  WB(B.x0,8,y,y+H+0.2,4.75,5,AM.concrete,ow);                              // davant (sota la façana)
  WB(7.75,8.3,y,y+H+0.2,-12,4.75,AM.concrete,ow);                          // mur entre el soterrani i la rampa
  WB(12.1,12.4,y,y+H+0.2,-22,-12,AM.concrete,ow);
  WB(B.x0,12.4,y,y+H+0.2,B.z0-0.25,B.z0,AM.concrete,ow);                   // fons
  // sostre sota el jardí (en planta aïllada no es mostra)
  // trasters de la part davantera i vestíbul d'independència
  WB(B.x0,-2.2,y,y+H,-2.2,-2,AM.wall,ow); WB(2.2,7.75,y,y+H,-2.2,-2,AM.wall,ow);
  WB(-2.2,-2,y,y+H,-2.2,4.75,AM.wall,ow); WB(2,2.2,y,y+H,-2.2,4.75,AM.wall,ow);
  wallOps(WB,'x',-2,2,-2.12,-1.98,y,y+H,[[-1.25,-0.25,0,2.1,'door']],AM.wall,ow);
  archDoor('sot:vest','porta del vestíbul d\'independència (resistent al foc)',-1.25,y,-2.05,V(1,0,0),1.0,2.1,V(0,0,1),AM.doorM,o);
  for(const x of [-5.1,5.1]) WB(x-0.05,x+0.05,y,y+H,-2,4.75,AM.wall,ow);   // separació de trasters
  for(const [x0,x1] of [[-8,-5.1],[-5.1,-2.2],[2.2,5.1],[5.1,7.75]]) aBoxB(x0+0.4,x0+1.3,y,y+2.1,-2.25,-2.15,AM.doorM,ow);
  // places: 4+4 al passadís central i 8 al fons
  const L=(x0,x1,z0,z1)=>aBoxB(x0,x1,y,y+0.012,z0,z1,AM.line,ow);
  const P=[];
  for(const [x0,x1] of [[B.x0,-2.75],[2.75,7.75]]) for(let i=0;i<4;i++){ const z0=-12+i*2.5; P.push({x0,x1,z0,z1:z0+2.5,ax:'x'}); }
  for(let i=0;i<8;i++){ const x0=-8+i*2.5; P.push({x0,x1:x0+2.5,z0:-22,z1:-17,ax:'z'}); }
  P.forEach((p,i)=>{
    if(p.ax==='x'){ L(p.x0,p.x1,p.z0-0.05,p.z0+0.05); L(p.x0,p.x1,p.z1-0.05,p.z1+0.05); }
    else { L(p.x0-0.05,p.x0+0.05,p.z0,p.z1); L(p.x1-0.05,p.x1+0.05,p.z0,p.z1); }
    const c=V((p.x0+p.x1)/2, y+0.02, (p.z0+p.z1)/2);
    const off = p.ax==='x' ? V(p.x0<0? 1.7 : -1.7,0,0) : V(0,0,1.7);
    textPlane([String(i+1)],0.7,0.7,c.clone().add(off),V(0,1,0),{bg:'#9EA2A6',fg:'#FFFFFF',px:128,flags:{floor:f}});
  });
  // cotxes d'exemple
  const car=(cx,cz,ax,mat)=>{ const [lw,ll]=[1.75,4.2]; const bx=ax==='x'?ll:lw, bz=ax==='x'?lw:ll;
    aBox(bx,0.62,bz,cx,y+0.55,cz,mat,ow); aBox(ax==='x'?2.2:1.55,0.5,ax==='x'?1.55:2.2,cx,y+1.1,cz,mat,ow);
    aBox(ax==='x'?2.0:1.58,0.38,ax==='x'?1.58:2.0,cx,y+1.1,cz,AM.glass,ow);
    for(const s of [-1,1]) for(const t of [-1,1]) aBox(ax==='x'?0.62:0.22,0.62,ax==='x'?0.22:0.62,cx+(ax==='x'?s*1.35:t*0.82),y+0.31,cz+(ax==='x'?t*0.82:s*1.35),AM.tyre,ow); };
  car(-5.3,-10.75,'x',AM.car1); car(5.25,-5.75,'x',AM.car2); car(0.75,-19.6,'z',AM.car3); car(5.75,-19.6,'z',AM.car4); car(-5.3,-3.25,'x',AM.car3);
  // pilars
  for(const [x,z] of [[-2.95,-12],[2.95,-12],[-2.95,-7],[2.95,-7],[2,-17],[-3,-17],[7,-17]]) aBoxB(x-0.2,x+0.2,y,y+H,z-0.2,z+0.2,AM.concrete,ow);
  // fletxes i rètols
  textPlane(['Escala i ascensor','→ vestíbul d\'independència'],1.6,0.45,V(0.0,y+2.45,-2.2),V(0,0,-1),{bg:'#1F6E43',fg:'#FFFFFF',flags:{floor:f}});
  textPlane(['SORTIDA DE VEHICLES','rampa ↑'],1.8,0.45,V(10.2,y+2.55,-12.05),V(0,0,-1),{bg:'#2C2C2B',fg:'#FFFFFF',flags:{floor:f}});
  // rampa d'accés (a cel obert entre la vorera i el soterrani)
  const R=B.ramp, len=R.z1-R.z0, ang=Math.atan2(3,len);
  { const g=new THREE.BoxGeometry(R.x1-R.x0, 0.25, Math.hypot(len,3)); g.rotateX(-ang); g.translate((R.x0+R.x1)/2,-1.5-0.125/Math.cos(ang),(R.z0+R.z1)/2);
    const m=new THREE.Mesh(g,AM.concrete); addArch(m,{floor:f, ramp:true}); }
  for(let i=0;i<12;i++){ const z=R.z1-0.6-i*1.4; const yy=-3*(R.z1-z)/len; aBoxB(R.x0+0.3,R.x1-0.3,yy-0.01,yy+0.02,z-0.06,z+0.06,AM.lineY,ow); }
  WB(8,8.3,-3,0.1,R.z0,R.z1,AM.concrete,ow); WB(12.1,12.4,-3,0.1,R.z0,R.z1,AM.concrete,ow);
  for(const x of [8.15,12.25]){ WB(x-0.03,x+0.03,0.9,0.95,R.z0,R.z1,AM.rail,{floor:f}); for(let z=R.z0;z<=R.z1;z+=1.5) WB(x-0.02,x+0.02,0.1,0.92,z-0.02,z+0.02,AM.rail,{floor:f}); }
  // porta del garatge (oberta, enrotllada a dalt) i llinda
  WB(8.3,12.1,y+2.35,0.1,-12.15,-11.95,AM.concrete,ow); WB(8.3,12.1,y+2.15,y+2.35,-12.1,-11.98,AM.doorM,ow);
}

/* ---------- PLANTA BAIXA ---------- */
function buildGroundFloor(){
  const f=0, y=0, H=BLD.H, o={floor:0};
  slabHoles(BLD.x0,BLD.x1,BLD.z0,BLD.z1,y-0.2,y,[[BLD.stair.x0,BLD.stair.x1,BLD.stair.z0,BLD.stair.z1],[BLD.lift.x0,BLD.lift.x1,BLD.lift.z0,BLD.lift.z1]],AM.slab,{floor:0,slab:true});
  aBoxB(-2,5.6,y,y+0.01,-2.4,BLD.stair.z0,AM.lobby,o); aBoxB(2,5.6,y,y+0.01,BLD.stair.z0,4.75,AM.lobby,o);   // paviment del vestíbul
  aBoxB(-7.75,-2.2,y,y+0.01,-14.75,4.75,AM.tile,o);                                                      // paviment de la botiga
  const F={floor:0, facade:true, fside:'front'}, Fb={floor:0, facade:true, fside:'back'}, Fs={floor:0, facade:true, fside:'side'};
  // façana principal: aparador i porta de la botiga, finestra de l'escala, porta del vestíbul i finestra del local de serveis
  wallOps(WB,'x',BLD.x0,BLD.x1,4.75,5,y,y+H,[[-7.4,-3.75,0.45,2.45],[-3.55,-2.6,0,2.4,'door'],[-1.6,-0.4,1.0,2.3],[2.7,4.1,0,2.4,'door'],[6.2,7.3,1.2,2.2]],AM.plinth,F,F);
  aBoxB(-7.6,-2.4,2.42,2.56,5.0,6.1,AM.awning,F);                        // tendal
  textPlane(['BOTIGA','queviures · fruita'],3.2,0.42,V(-5.0,2.68,5.035),V(0,0,1),{bg:'#2F8A5B',fg:'#FFFFFF',flags:F});
  textPlane(['Núm. 12'],0.5,0.22,V(4.45,2.55,5.03),V(0,0,1),{bg:'#1F3A5F',fg:'#FFFFFF',px:256,flags:F});
  archDoor('pb:botiga','porta de la botiga',-3.55,y,4.87,V(1,0,0),0.95,2.4,V(0,0,-1),null,o,{glass:true});
  archDoor('pb:vest_a','porta d\'entrada (fulla esquerra)',2.7,y,4.87,V(1,0,0),0.7,2.4,V(0,0,-1),null,o,{glass:true});
  archDoor('pb:vest_b','porta d\'entrada (fulla dreta)',4.1,y,4.87,V(-1,0,0),0.7,2.4,V(0,0,-1),null,o,{glass:true});
  // façana posterior i laterals
  wallOps(WB,'x',BLD.x0,BLD.x1,BLD.z0,BLD.z0+0.25,y,y+H,[[-7.0,-4.0,1.0,2.3],[-1.45,-0.55,0,2.1,'door'],[4.0,6.5,1.2,2.2]],AM.facade,Fb,Fb);
  archDoor('pb:pati','porta posterior (pati)',-1.45,y,BLD.z0+0.12,V(1,0,0),0.9,2.1,V(0,0,1),AM.doorM,o);
  wallOps(WB,'z',BLD.z0+0.25,4.75,BLD.x0,BLD.x0+0.25,y,y+H,[[-11,-8,1.0,2.3],[-3,0,1.0,2.3]],AM.facade,Fs,Fs);
  wallOps(WB,'z',BLD.z0+0.25,4.75,BLD.x1-0.25,BLD.x1,y,y+H,[[-10,-7.5,1.2,2.2],[-4,-1.5,1.2,2.2]],AM.facade,Fs,Fs);
  // botiga: paret mitgera amb el nucli
  WB(-2.2,-2,y,y+H,BLD.z0+0.25,4.75,AM.wall,o);
  for(const z of [-13.5,-10.5,-7.5,-4.5]) { aBoxB(-7.7,-7.3,y,y+2.0,z-1.2,z+1.2,AM.shelf,o); for(const yy of [0.5,1.0,1.5]) aBoxB(-7.7,-7.25,y+yy,y+yy+0.05,z-1.2,z+1.2,AM.furn,o); }
  for(const x of [-6.2,-4.6]) { aBoxB(x-0.4,x+0.4,y,y+1.45,-12,-5,AM.shelf,o); aBoxB(x-0.42,x+0.42,y+0.7,y+0.75,-12,-5,AM.furn,o); }
  aBoxB(-4.2,-2.6,y,y+1.0,1.6,2.3,AM.furn,o); aBoxB(-4.2,-2.6,y+1.0,y+1.05,1.55,2.35,AM.furn2,o);   // taulell
  for(const [x,z] of [[-6.6,3.6],[-5.6,3.6]]) aBoxB(x-0.35,x+0.35,y,y+0.75,z-0.3,z+0.3,AM.furn3,o); // caixes de fruita
  // vestíbul: paret amb el local de serveis, bústies i banc
  wallOps(WB,'z',-2.4,4.75,5.6,5.8,y,y+H,[[0.0,0.9,0,2.1,'door']],AM.wall,o);
  archDoor('pb:serveis','porta del local de serveis',5.7,y,0.0,V(0,0,1),0.9,2.1,V(1,0,0),AM.doorM,o);
  WB(3.4,5.8,y,y+H,-2.6,-2.4,AM.wall,o);
  aBoxB(5.4,5.6,y+0.9,y+1.9,1.2,3.6,AM.frame,o); for(let i=0;i<4;i++) for(let j=0;j<5;j++) aBoxB(5.37,5.4,y+0.95+i*0.24,y+1.15+i*0.24,1.25+j*0.47,1.65+j*0.47,AM.doorM,o);
  textPlane(['Bústies'],0.6,0.18,V(5.36,y+2.05,2.4),V(-1,0,0),{flags:o,px:256});
  aBoxB(2.3,3.6,y,y+0.45,-2.3,-1.9,AM.furn,o);
  // passadís posterior i RITI
  WB(-0.4,3.4,y,y+H,-5,-4.75,AM.wall,o);                                     // paret del fons del RITI
  wallOps(WB,'z',BLD.z0+0.25,-5,2,2.2,y,y+H,[[-6.6,-5.7,0,2.1,'door']],AM.wall,o); WB(3.4,3.6,y,y+H,-5,-2.6,AM.wall,o);
  archDoor('pb:local2','porta del local de serveis (passadís)',2.1,y,-6.6,V(0,0,1),0.9,2.1,V(1,0,0),AM.doorM,o);
  textPlane(['Local de serveis','comptadors · bicicletes'],1.2,0.36,V(5.82,y+2.3,0.45),V(1,0,0),{flags:o,px:384});
  textPlane(['RITI'],0.5,0.2,V(1.5,y+2.62,-2.29),V(0,0,1),{bg:'#2F6FDE',fg:'#FFFFFF',flags:o,px:256});
  for(const [x,z] of [[6.5,-10],[6.5,-12]]) aBoxB(x-0.3,x+0.3,y,y+1.0,z-0.9,z+0.9,AM.rail,o);   // bicicletes (esquemàtic)
}

/* ---------- PLANTES D'HABITATGES (parts comunes) ---------- */
function buildResidentialFloor(f){
  const y=yb(f), H=BLD.H, o={floor:f};
  const holes=[[BLD.stair.x0,BLD.stair.x1,BLD.stair.z0,BLD.stair.z1],[BLD.lift.x0,BLD.lift.x1,BLD.lift.z0,BLD.lift.z1]];
  if(f>=2) holes.push([BLD.well.x0,BLD.well.x1,BLD.well.z0,BLD.well.z1]);
  slabHoles(BLD.x0,BLD.x1,BLD.z0,BLD.z1,y-0.2,y,holes,AM.slab,{floor:f,slab:true});
  aBoxB(-2,2,y,y+0.01,-8,BLD.stair.z0,AM.lobby,o);
  // patinet d'instal·lacions (hi va la canalització principal i el registre secundari)
  aBoxB(BLD.pat.x0,BLD.pat.x1,y,y+H,BLD.pat.z0,BLD.pat.z1,AM.wall,o);
  // final del distribuïdor, amb finestra al pati de llums
  wallOps(WB,'x',-2,2,-8.1,-7.9,y,y+H,[[-1.1,1.1,0.9,2.2]],AM.wall,o,o);
  // façana del nucli (finestra de l'escala) i pati de llums
  const F={floor:f, facade:true, fside:'front'}, Fb={floor:f, facade:true, fside:'back'};
  wallOps(WB,'x',-2,2,4.75,5,y,y+H,[[-1.6,-0.4,1.9,2.6]],AM.facade,F,F);
  WB(-2,2,y,y+H,BLD.z0,BLD.z0+0.25,AM.facade,Fb);
  if(f===1) aBoxB(-2,2,y,y+0.02,BLD.well.z0+0.25,-8.1,AM.roof,o);   // fons del pati de llums (coberta de la planta baixa)
}

/* ---------- COBERTA ---------- */
function buildRoof(){
  const y=15, o={floor:5}, F={floor:5, facade:true, fside:'front'};
  slabHoles(BLD.x0,BLD.x1,BLD.z0,BLD.z1,y-0.2,y,[[BLD.stair.x0,BLD.stair.x1,BLD.stair.z0,BLD.stair.z1],[BLD.well.x0,BLD.well.x1,BLD.well.z0,BLD.well.z1]],AM.roof,{floor:5,slab:true});
  // ampits perimetrals
  WB(BLD.x0,BLD.x1,y,y+1.05,4.75,5,AM.facade,F); WB(BLD.x0,BLD.x1,y,y+1.05,BLD.z0,BLD.z0+0.25,AM.facade,Object.assign({},F,{fside:'back'}));
  WB(BLD.x0,BLD.x0+0.25,y,y+1.05,BLD.z0,BLD.z1,AM.facade,Object.assign({},F,{fside:'side'})); WB(BLD.x1-0.25,BLD.x1,y,y+1.05,BLD.z0,BLD.z1,AM.facade,Object.assign({},F,{fside:'side'}));
  // ampit del pati de llums
  WB(-2.2,-2,y,y+1.05,BLD.well.z0,BLD.well.z1+0.2,AM.wall,o); WB(2,2.2,y,y+1.05,BLD.well.z0,BLD.well.z1+0.2,AM.wall,o); WB(-2.2,2.2,y,y+1.05,BLD.well.z1,BLD.well.z1+0.2,AM.wall,o);
  // caseta d'escala amb porta a la coberta
  const c={floor:5};
  WB(-2.2,-2,y,y+2.6,-0.1,4.75,AM.wall,c); WB(0.3,0.4,y,y+2.6,-0.1,2.65,AM.wall,c);
  wallOps(WB,'x',-2.2,0.4,-0.1,0.1,y,y+2.6,[[-1.6,-0.7,0,2.1,'door']],AM.wall,c);
  WB(-2.2,0.4,y+1.05,y+2.6,4.75,5,AM.wall,c); WB(0.3,0.4,y+1.4,y+2.6,2.65,4.75,AM.wall,c);
  WB(-2.3,0.5,y+2.6,y+2.8,-0.2,4.85,AM.roof,c);
  archDoor('cob:porta','porta de la caseta d\'escala',-1.6,y,0.0,V(1,0,0),0.9,2.1,V(0,0,-1),AM.doorM,c);
  // barana de protecció del forat de l'escala a nivell de coberta
  WB(-2,-0.88,y,y+1.0,BLD.stair.z0-0.04,BLD.stair.z0,AM.rail,c);
  // sala de màquines de l'ascensor (sense moviment)
  WB(0.3,2.0,y,y+1.4,2.65,4.85,AM.concrete,c); WB(0.25,2.05,y+1.4,y+1.5,2.6,4.9,AM.roof,c);
  textPlane(['Ascensor'],0.6,0.18,V(1.15,y+1.1,2.64),V(0,0,-1),{flags:c,px:256});
  // ampit al costat de la caseta (façana davantera ja tapa el darrere)
}

/* ---------- NUCLI COMÚ: escala contínua i pou de l'ascensor ---------- */
const LIFT={floor:0, cab:null};
function buildCore(){
  const st=BLD.stair, rh=3/18;
  for(let f=-1; f<=4; f++){
    const y=yb(f), o={floor:f};
    // tram 1 (carril esquerre, puja cap a la façana)
    for(let i=0;i<st.n;i++){ const top=y+(i+1)*rh, z0=st.z0+st.tread*i; aBoxB(st.lL[0],st.lL[1],top-0.3,top,z0,z0+st.tread,AM.stair,o); aBoxB(st.lL[0],st.lL[1],top-0.004,top+0.004,z0+st.tread-0.04,z0+st.tread,AM.stairEdge,o); }
    // replà intermedi
    aBoxB(st.x0,st.x1,y+1.5-0.2,y+1.5,st.zl,st.z1,AM.stair,o);
    // tram 2 (carril dret, torna cap al distribuïdor)
    for(let j=0;j<st.n;j++){ const top=y+1.5+(j+1)*rh, z1=st.zl-st.tread*j; aBoxB(st.lR[0],st.lR[1],top-0.3,top,z1-st.tread,z1,AM.stair,o); aBoxB(st.lR[0],st.lR[1],top-0.004,top+0.004,z1-st.tread,z1-st.tread+0.04,AM.stairEdge,o); }
    // mur central (ull de l'escala) i passamans
    aBoxB(st.lL[1],st.lR[0],y,y+3,st.z0,st.zl,AM.wall,o);
    const rail=(x,z0,z1,y0,y1)=>{ const L=Math.hypot(z1-z0,y1-y0), a=Math.atan2(y1-y0,z1-z0); const g=new THREE.BoxGeometry(0.05,0.05,L); g.rotateX(-a); g.translate(x,(y0+y1)/2+0.9,(z0+z1)/2); const m=new THREE.Mesh(g,AM.rail); addArch(m,o); };
    rail(st.lL[0]+0.06,st.z0,st.zl,y,y+1.5); rail(st.lR[1]-0.06,st.zl,st.z0,y+1.5,y+3);
    if(f===-1){ aBoxB(st.x0,st.x1,y,y+1.25,st.zl,st.z1,AM.wall,o); aBoxB(st.lR[0],st.lR[1],y,y+1.6,1.9,st.zl,AM.wall,o); }
  }
  // pou de l'ascensor: parets a cada planta i portes de replà
  const L=BLD.lift;
  for(let f=-1; f<=4; f++){
    const y=yb(f), o={floor:f}, H=BLD.H;
    wallOps(WB,'x',0.3,2.0,L.wz0,L.z0,y,y+H,[[L.dx0,L.dx1,0,2.1,'door']],AM.concrete,o);
    WB(0.3,0.4,y,y+H,L.z0,4.75,AM.concrete,o); WB(1.9,2.0,y,y+H,L.z0,4.75,AM.concrete,o);
    aBoxB(L.dx0-0.06,L.dx1+0.06,y+2.1,y+2.2,L.wz0-0.03,L.wz0,AM.frame,o);
    const w=(L.dx1-L.dx0)/2;
    slideDoor(`asc:${f}a`,`porta de l'ascensor (${FLOORNAME(f).toLowerCase()})`,L.dx0+w/2,y,L.wz0-0.03,w,2.1,-w+0.04,AM.liftDoor,o);
    slideDoor(`asc:${f}b`,`porta de l'ascensor (${FLOORNAME(f).toLowerCase()})`,L.dx1-w/2,y,L.wz0-0.06,w,2.1,w-0.04,AM.liftDoor,o);
    LEAF_BY_KEY[`asc:${f}a`].pair=`asc:${f}b`; LEAF_BY_KEY[`asc:${f}b`].pair=`asc:${f}a`;
    LEAF_BY_KEY[`asc:${f}a`].lift=f; LEAF_BY_KEY[`asc:${f}b`].lift=f;
    aBoxB(L.dx1+0.08,L.dx1+0.18,y+1.0,y+1.2,L.wz0-0.02,L.wz0,AM.frame,o);    // botonera
    textPlane([f===-1?'S':f===0?'PB':String(f)],0.22,0.22,V(L.dx0-0.2,y+1.7,L.wz0-0.005),V(0,0,-1),{bg:'#1F3A5F',fg:'#FFFFFF',px:128,flags:o});
  }
  // cabina (fixa a la planta on es crida; no es simula el moviment)
  const cab=new THREE.Group(); scene.add(cab); LIFT.cab=cab;
  const cm=(w,h,d,x,yy,z,m)=>{ const me=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); me.position.set(x,yy,z); cab.add(me); ud(me,{kind:'arch',cabin:true,floor:0}); G.arch.push(me); };
  cm(1.46,0.08,1.94,1.15,-0.04,3.75,AM.concrete); cm(1.46,0.04,1.94,1.15,2.3,3.75,AM.liftDoor);
  cm(0.03,2.3,1.94,0.44,1.15,3.75,AM.liftDoor); cm(0.03,2.3,1.94,1.86,1.15,3.75,AM.liftDoor); cm(1.46,2.3,0.03,1.15,1.15,4.71,AM.liftDoor);
  cm(1.3,0.04,0.04,1.15,0.95,4.66,AM.rail); cm(0.06,0.4,0.2,1.82,1.2,3.3,AM.frame);
  setLiftFloor(0);
}
function setLiftFloor(f){ LIFT.floor=f; if(!LIFT.cab) return; LIFT.cab.position.y=yb(f); LIFT.cab.children.forEach(m=>m.userData.floor=f); }

/* ---------- HABITATGES: envolupant, portes, balcons ---------- */
function buildUnitShell(u){
  const f=u.f, y=yb(f), H=BLD.H, o={floor:f, unit:u.id}, B=UWB(u);
  const F={floor:f, unit:u.id, facade:true, fside:ZM(u)?'back':'front'}, Fs={floor:f, unit:u.id, facade:true, fside:'side'};
  // paret amb el distribuïdor (porta d'entrada) i paret mitgera entre habitatges (z=-5)
  wallOps(B,'z',-5,5,-2.2,-2,y,y+H,[[-3.4,-2.5,0,2.1,'door']],AM.wall,o);
  B(-7.75,-2.2,y,y+H,-5,-4.75,AM.wall,o);
  // façanes: principal (o posterior per a C i D) i lateral
  wallOps(B,'x',-8,-2.2,4.75,5,y,y+H,[[-7.35,-6.65,1.5,2.15],[-5.75,-4.65,0,2.15,'door'],[-3.9,-2.7,0.9,2.15]],AM.facade,F,F);
  B(-8,-2.2,y+H-0.02,y+H+0.2,4.98,5.06,AM.facade2,F);       // cornisa de forjat
  wallOps(B,'z',-5,5,-8,-7.75,y,y+H,[[-3.7,-2.7,1.0,2.15],[-0.5,0.9,0.6,2.15]],AM.facade,Fs,Fs);
  // balcó o terrassa de l'habitatge, amb accés des de la sala d'estar
  B(-7.8,-2.4,y-0.2,y,5,6.3,AM.slab,o); B(-7.8,-2.4,y-0.22,y-0.18,6.26,6.34,AM.edge,o);
  B(-7.8,-2.4,y,y+1.0,6.24,6.28,AM.glassRail,o); B(-7.8,-2.4,y+1.0,y+1.05,6.22,6.3,AM.rail,o);
  for(const x of [-7.8,-2.44]){ B(x,x+0.04,y,y+1.0,5,6.28,AM.glassRail,o); B(x,x+0.04,y+1.0,y+1.05,5,6.3,AM.rail,o); }
  // portes (fulles practicables)
  const X=x=>mx(u,x), Z=z=>mz(u,z), xs=XS(u), sz=SZ(u);
  archDoor(`ent:${u.id}`,`porta d'entrada del ${u.name}`,X(-2.1),y,Z(-3.4),V(0,0,sz),0.9,2.1,V(-xs,0,0),AM.door,o);
  archDoor(`bal:${u.id}`,`porta del balcó del ${u.name}`,X(-5.75),y,Z(4.87),V(xs,0,0),1.1,2.15,V(0,0,-sz),null,o,{glass:true});
  // rètol de la porta al distribuïdor
  textPlane([u.name],0.36,0.16,V(X(-1.985),y+1.65,Z(-2.25)),V(xs,0,0),{bg:'#FFFFFF',fg:'#1F3A5F',border:'#1F3A5F',px:256,flags:o});
}
/* envans interiors (tall a mitja alçada) — disposició A */
function buildPartitions(u){
  const y=yb(u.f), h=1.1, o={floor:u.f,unit:u.id}, t=0.05, B=UWB(u);
  const W=(xa,xb,za,zb)=>B(xa,xb,y,y+h,za,zb,AM.wallIn,o);
  W(-4.4-t,-4.4+t,-4.75,-3.6); W(-4.4-t,-4.4+t,-2.8,-0.6); W(-4.4-t,-4.4+t,0.4,1.75); W(-4.4-t,-4.4+t,2.45,4.75);
  W(-7.75,-5.6,-1.8-t,-1.8+t); W(-4.8,-4.4,-1.8-t,-1.8+t);
  W(-4.4,-3.1,-2.2-t,-2.2+t); W(-2.3,-2.2,-2.2-t,-2.2+t);
  W(-4.4,-2.2,1.6-t,1.6+t);
  W(-7.75,-6.0,3.2-t,3.2+t); W(-6.0-t,-6.0+t,3.2,3.4); W(-6.0-t,-6.0+t,4.1,4.75);
  B(-2.2,-2.0,y,y+0.012,-3.4,-2.5,AM.edge,o);                          // llindar
}
/* mobiliari (disposició A). El 2n A en té més detall. */
function buildFurniture(u){
  const y2=yb(u.f), o={floor:u.f,unit:u.id};
  const F=(x0,x1,y0,y1,z0,z1,m)=>UB(u,x0,x1,y2+y0,y2+y1,z0,z1,m,o);
  F(-7.6,-6.0,0,0.45,1.0,2.0,AM.furn2); F(-7.6,-7.3,0,0.8,1.0,2.0,AM.furn2);      // sofà
  F(-7.6,-6.6,0,0.45,-1.5,-1.15,AM.furn);                                       // moble TV
  F(-6.35,-5.65,0.93,0.97,-1.75,-1.48,AM.furn);                                 // prestatge de l'ONT
  F(-7.7,-4.6,0,0.9,-4.7,-4.15,AM.furn);                                        // taulell de cuina
  F(-4.3,-2.6,0,0.5,3.0,4.7,AM.furn2);                                          // llit dormitori 1
  F(-3.3,-2.3,0.68,0.72,2.05,2.5,AM.furn);
  for(const [lx,lz] of [[-3.27,2.08],[-2.33,2.08],[-3.27,2.47],[-2.33,2.47]]) F(lx-0.025,lx+0.025,0,0.68,lz-0.025,lz+0.025,AM.furn);
  F(-4.3,-2.6,0,0.5,-0.4,1.2,AM.furn2);                                         // llit dormitori 2
  F(-7.6,-7.2,0,0.42,4.2,4.65,AM.wallIn); F(-6.9,-6.4,0.6,0.85,4.35,4.7,AM.wallIn);   // bany
  F(-3.0,-2.3,0,0.02,-3.3,-2.6,AM.furn3);                                       // estora del rebedor
  if(u.id==='2A'){
    F(-6.4,-5.2,0,0.74,0.2,1.2,AM.furn); F(-6.35,-5.25,0.74,0.77,0.15,1.25,AM.furn);       // taula del menjador
    for(const [cx,cz] of [[-6.6,0.7],[-5.0,0.7]]) F(cx-0.2,cx+0.2,0,0.45,cz-0.2,cz+0.2,AM.furn2);
    F(-7.7,-7.1,0,0.85,-3.2,-2.0,AM.liftDoor);                                  // nevera i rentaplats
    F(-6.2,-5.6,0.9,0.93,-4.65,-4.2,AM.frame);                                  // placa de cocció
    F(-4.3,-3.7,0,2.0,4.1,4.7,AM.shelf);                                        // armari del dormitori 1
    F(-3.6,-2.4,0,2.0,-2.1,-1.6,AM.shelf);                                      // armari del dormitori 2
    F(-4.3,-4.0,0,1.6,-4.7,-4.4,AM.shelf);                                      // penjador del rebedor
    F(-7.0,-5.6,0,0.02,0.0,2.4,AM.awning);                                      // catifa
    F(-7.0,-6.6,0,1.5,-0.9,-0.6,AM.furn3);                                      // planta
    F(-7.4,-6.4,0,0.6,5.5,6.0,AM.furn);                                         // taula del balcó
  }
}

/* ===================================================================
   REFERÈNCIES (mode «Només ICT» i etiquetes de zones)
   =================================================================== */
function buildRefs(){
  for(let f=-1; f<=5; f++){
    const y = yb(f); const bas=f===-1;
    const w=bas?20.4:16, d=bas?27:20, cx=bas?2.2:0, cz=bas?-8.5:-5;
    const g=new THREE.EdgesGeometry(new THREE.BoxGeometry(w,0.01,d)); const l=new THREE.LineSegments(g,AM.ref); l.position.set(cx,y,cz);
    l.userData={kind:'ref', floor:f}; scene.add(l); G.refs.push(l);
    G.refLabels.push({text: FLOORNAME(f), pos:V(-8.6,y+0.3,4.6), floor:f, cls:'ref'});
  }
  for(const u of UNITS) G.refLabels.push({text:unitTitle(u), pos:V(mx(u,-5),yb(u.f)+2.4,mz(u,4.2)), floor:u.f, unit:u.id, cls:'ref', unitLbl:true});
  const r2=[["Rebedor",-3.2,-3.6],["Sala d'estar",-6.2,0.6],["Cuina",-6.2,-3.2],["Dormitori 1",-3.2,3.3],["Dormitori 2",-3.2,0],["Bany (sense preses)",-6.9,3.9],["Balcó",-5.1,5.7]];
  for(const u of UNITS) for(const [t,x,z] of r2) G.refLabels.push({text:t,pos:V(mx(u,x),yb(u.f)+1.25,mz(u,z)),floor:u.f,unit:u.id,cls:'room'});
  const Z=(t,x,y,z,f)=>G.refLabels.push({text:t,pos:V(x,y,z),floor:f,cls:'zone'});
  for(let f=1; f<=4; f++){ const y=yb(f); Z('Distribuïdor',0,y+1.2,-2.2,f); Z('Escala',-1.4,y+1.6,2.4,f); Z('Ascensor',1.15,y+2.4,3.7,f); Z('Patinet d\'instal·lacions',0.8,y+2.95,-5.0,f); Z('Pati de llums',0,y+0.8,-11.5,f); }
  Z('Vestíbul d\'entrada',3.6,1.4,1.5,0); Z('Botiga (local comercial)',-5,1.6,-3,0); Z('Local de serveis',5.2,1.4,-9,0); Z('Passadís posterior',-1.2,1.3,-10,0); Z('Escala',-1.4,1.6,2.4,0); Z('Ascensor',1.15,2.4,3.7,0);
  Z('Aparcament (16 places)',0,-1.4,-14.5,-1); Z('Rampa d\'accés de vehicles',10.2,-1.0,-4,-1); Z('Vestíbul d\'independència',0,-1.6,-0.8,-1); Z('Trasters',-5,-1.4,1.5,-1); Z('Trasters',5,-1.4,1.5,-1); Z('Escala',-1.4,-1.4,2.4,-1); Z('Ascensor',1.15,-0.6,3.7,-1);
  Z('Caseta d\'escala',-0.9,17.0,2.2,5); Z('Pati de llums',0,15.6,-11.5,5);
}

/* =====================================================================
   RITS DETALLAT: recinte d'obra, tubs corrugats, capçaleres i serveis
   Escala: recinte, equips, connectors i cables a escala real (mides dels catàlegs del fabricant)
   ===================================================================== */
let SCOPE=null;                       // meshes de la variant de capçalera en construcció
const VAR={meshes:[], keys:[], extra:[]};
const RI={x0:-0.34, x1:3.34, z0:-4.73, z1:-2.48, y0:15.02, y1:17.6};
/* posició del RITS a l'escena. A l'edifici és la identitat; el model de cases construeix el RITS (i les antenes) dins del
   grup RITS_ROOT i hi copia la matriu. ritsW(v): punt en coordenades del RITS → escena. */
const RITSM=new THREE.Matrix4(), RITSI=new THREE.Matrix4();
let RITS_ROOT=null;
const ritsW = v => v.applyMatrix4(RITSM);
const ZP=-4.715;                      // cara frontal de la placa de muntatge
const RFN={capt:0xA8742A, dist:0x2F6FDE, ac:0xD32F2F, dc:0xEF8A00, pe:0x2E9B3F, tube:0x7A8794, eq:0x455A64};
const RM={};                          // paràmetres de materials físics
const RG={sprites:[], halos:[], spot:null, fill:null, lumGlow:[]};

function canvasTex(w,h,draw,srgb=true){ const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); draw(g,w,h); const t=new THREE.CanvasTexture(c); if(srgb) t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t; }
function noiseTex(n,amp,base){ return canvasTex(n,n,(g,w,h)=>{ const id=g.createImageData(w,h); for(let i=0;i<w*h;i++){ const v=base+(Math.random()-0.5)*amp; id.data[i*4]=id.data[i*4+1]=id.data[i*4+2]=v; id.data[i*4+3]=255; } g.putImageData(id,0,0); },false); }
function ritsMats(){
  const plaster=noiseTex(256,90,128); plaster.wrapS=plaster.wrapT=THREE.RepeatWrapping; plaster.repeat.set(3,3);
  const floorN=noiseTex(128,26,200); floorN.wrapS=floorN.wrapT=THREE.RepeatWrapping; floorN.repeat.set(4,4); floorN.colorSpace=THREE.SRGBColorSpace;
  const gy=canvasTex(64,8,(g)=>{ for(let i=0;i<4;i++){ g.fillStyle=i%2?'#E8C71A':'#2E9B3F'; g.beginPath(); g.moveTo(i*16,0); g.lineTo(i*16+16,0); g.lineTo(i*16+12,8); g.lineTo(i*16-4,8); g.fill(); } g.fillStyle='#2E9B3F'; g.beginPath(); g.moveTo(60,8); g.lineTo(64,8); g.lineTo(64,0); g.fill(); });
  gy.wrapS=gy.wrapT=THREE.RepeatWrapping; gy.repeat.set(4,1);
  Object.assign(RM,{
    plaster:{roughness:0.94, metalness:0, bumpMap:plaster, bumpScale:0.9},
    floor:{roughness:0.82, metalness:0, map:floorN},
    paint:{roughness:0.5, metalness:0.1}, steel:{roughness:0.45, metalness:0.35},
    galv:{roughness:0.5, metalness:0.3}, zamak:{roughness:0.45, metalness:0.3}, zamakDark:{roughness:0.55, metalness:0.2},
    nickel:{roughness:0.3, metalness:0.5}, copper:{roughness:0.35, metalness:0.5},
    pvc:{roughness:0.55, metalness:0}, pe:{roughness:0.4, metalness:0}, plastic:{roughness:0.6, metalness:0}, rubber:{roughness:0.8, metalness:0},
    corr:{roughness:0.58, metalness:0, side:THREE.DoubleSide}, gy:{roughness:0.5, metalness:0, map:gy}, concrete:{roughness:0.9, metalness:0, map:floorN}
  });
}
/* ---------- aparellatge modular de carril DIN (quadres elèctrics) ----------
   Magnetotèrmic 1P+N i diferencial 2P de 2 mòduls (36 mm), 85 mm d'alt, perfil esglaonat: cos de 44 mm des del carril
   amb els borns a dalt i a baix, i frontal elevat fins a 70 mm amb la maneta. Muntat a la paret dreta del RITS
   (carril a x = 3,31, frontal cap a −x). Cada aparell és una sola malla amb colors per vèrtex + la serigrafia. */
const DINW=0.036;
function dinDevice(el,kind,zc,yc,o={}){
  const Mw=new THREE.Matrix4().makeBasis(V(0,0,1),V(0,1,0),V(-1,0,0)).setPosition(3.31,yc,zc);   // local: x dreta, y amunt, z enfora
  const parts=[], T=(x,y,z)=>Mw.clone().multiply(new THREE.Matrix4().makeTranslation(x,y,z)), RX=new THREE.Matrix4().makeRotationX(Math.PI/2);
  const box=(w,h,d,x,y,z,c)=>parts.push([new THREE.BoxGeometry(w,h,d),T(x,y,z),c]);
  const rr=(w,h,d,r,b,x,y,z,c)=>parts.push([rrectGeo(w,h,d,r,b),T(x,y,z),c]);
  const cyl=(r,h,x,y,z,c,seg=20)=>parts.push([new THREE.CylinderGeometry(r,r,h,seg),T(x,y,z).multiply(RX),c]);
  const W=DINW-0.0008, BODY=0xF1F1EE, FRONT=0xF7F7F5, DARK=0x33363A, MET=0xB8BCC0, HAND=0x2A2C2F, SLOT=0xC4C8CC, LEV=0xFBFBF9;
  rr(W,0.085,0.044,0.002,0.0006,0,0,0.022,BODY);                                                // cos
  const ty = kind==='rcd' ? 0.0345 : 0.0335;
  for(const px of [-0.0088,0.0088]) for(const py of [ty,-ty]){                                  // borns: obertura, cargol i ranura en creu
    cyl(0.0052,0.001,px,py,0.0441,DARK); cyl(0.0038,0.0012,px,py,0.0446,MET);
    box(0.0056,0.0009,0.0004,px,py,0.0454,0x55595D); box(0.0009,0.0056,0.0004,px,py,0.0454,0x55595D); }
  let lbl;
  if(kind==='rcd'){                                                                              // diferencial: frontal més alt
    rr(W,0.054,0.026,0.003,0.0012,0,-0.001,0.057,FRONT);
    box(0.007,0.0055,0.002,-0.0085,-0.0035,0.0705,0xD5D8DB);                                     // polsador de prova «T»
    box(0.007,0.0018,0.0006,0.0075,-0.0035,0.0703,0xC62828);                                     // finestreta indicadora
    box(0.018,0.016,0.0006,0,-0.018,0.0703,SLOT);                                                 // allotjament de la maneta
    box(0.012,0.010,0.006,0,-0.0145,0.0730,LEV); box(0.013,0.003,0.0068,0,-0.0105,0.0738,HAND);   // maneta (ON, amunt) amb el capçal negre
    lbl={w:W-0.004,h:0.016,y:0.012,t:['ID 40 A','30 mA · AC'],fs:[44,36]};
  } else {                                                                                       // magnetotèrmic
    rr(W,0.046,0.026,0.003,0.0012,0,0,0.057,FRONT);
    box(W-0.006,0.020,0.0006,0,-0.009,0.0703,SLOT);                                              // allotjament de les palanques
    for(const px of [-0.0082,0.0082]) box(0.0105,0.010,0.006,px,-0.0055,0.0730,LEV);            // palanques (ON, amunt)
    box(W-0.007,0.003,0.0068,0,-0.0010,0.0738,HAND);                                              // barra d'unió negra
    lbl={w:W-0.004,h:0.0135,y:0.0135,t:[o.curve||'C16','1P+N  230 V'],fs:[48,30]};
  }
  const m=rMesh(el,mergeParts(parts),0xFFFFFF,{roughness:0.5,metalness:0,vertexColors:true},{cast:true}); G.pick.push(m);
  const at=(x,y,z)=>V(x,y,z).applyMatrix4(Mw), N=V(-1,0,0);
  rPlane(el,lbl.w,lbl.h,at(0,lbl.y,0.07005),N,textTex(lbl.t,{w:256,h:Math.round(256*lbl.h/lbl.w),fs:lbl.fs,bold:[true,false],bg:'#F7F7F5',fg:'#263238'}));
  rPlane(el,lbl.w,0.0012,at(0,lbl.y-lbl.h/2-0.0012,0.07005),N,textTex([''],{w:16,h:4,bg:'#3DCD58'}));   // franja verda
  for(const py of [ty,-ty]) rPlane(el,0.0035,0.0045,at(-0.0158,py,0.04405),N,textTex(['N'],{w:32,h:40,size:34,bold:[true],bg:'#F1F1EE',fg:'#1565C0'}));   // marca de neutre
}
/* ---------- primitives ---------- */
function rMesh(el, geo, color, mat, o={}){ return ictMesh(geo, color, el, Object.assign({std:RM[mat]||mat, rits:true}, o)); }
function rBox(el,x0,x1,y0,y1,z0,z1,color,mat,o={}){
  const m=rMesh(el,new THREE.BoxGeometry(Math.abs(x1-x0),Math.abs(y1-y0),Math.abs(z1-z0)),color,mat,o); m.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
  if(o.pick) G.pick.push(m); return m;
}
const UP=new THREE.Vector3(0,1,0);
function orient(m,dir){ m.quaternion.setFromUnitVectors(UP, dir.clone().normalize()); return m; }
function rCyl(el,r,h,pos,dir,color,mat,o={}){
  const g=new THREE.CylinderGeometry(o.r2??r,r,h,o.seg||16,1,!!o.open); const m=rMesh(el,g,color,mat,o);
  m.position.copy(pos); orient(m,dir||UP); if(o.pick) G.pick.push(m); return m;
}
function rHex(el,r,h,pos,dir,color,mat,o={}){ return rCyl(el,r,h,pos,dir,color,mat,Object.assign({seg:6},o)); }
/* text en un pla (etiquetes, serigrafies) */
const _texCache={};
function textTex(lines,o={}){
  const key=JSON.stringify([lines,o]); if(_texCache[key]) return _texCache[key];
  const w=o.w||256, h=o.h||64;
  return _texCache[key]=canvasTex(w,h,(g)=>{ g.fillStyle=o.bg||'#FFFFFF'; g.fillRect(0,0,w,h);
    if(o.border){ g.strokeStyle=o.border; g.lineWidth=o.bw||4; g.strokeRect(2,2,w-4,h-4); }
    g.fillStyle=o.fg||'#1A1A1A'; g.textAlign='center'; g.textBaseline='middle';
    const n=lines.length; lines.forEach((t,i)=>{ const fs=(o.fs&&o.fs[i])||o.size||Math.floor(h/(n+0.6)); g.font=`${(o.bold&&o.bold[i])?'700':'500'} ${fs}px Arial, sans-serif`; g.fillText(t,w/2,h*(i+0.5)/n+(o.dy||0)); }); });
}
function rPlane(el,w,h,pos,normal,tex,o={}){
  const m=ictMesh(new THREE.PlaneGeometry(w,h),0xFFFFFF,el,Object.assign({std:{roughness:0.6,metalness:0,map:tex,side:o.double?THREE.DoubleSide:THREE.FrontSide}, rits:true},o));
  m.position.copy(pos); m.lookAt(pos.clone().add(normal)); if(o.rotZ) m.rotateZ(o.rotZ); return m;
}
/* geometria de tub del RITS (mateix escombrat; R: radi de corba físic de les cantonades) */
function rTubeGeo(pts,r,radial=10,cr=0.03,R,tag,cap){ return sweepGeo(pathSamples(polyCurve(pts,cr,R,tag)),r,radial,0,Math.PI*2,null,cap); }
function halo(base, geo, color){
  const h=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,side:THREE.BackSide,transparent:true,opacity:0.85,depthWrite:false}));
  h.userData={halo:true}; h.renderOrder=3; base.add(h); RG.halos.push(h); if(SCOPE) SCOPE.extra.push(h); return h;
}
function boxHalo(m,color,pad=0.008){
  const p=m.geometry.parameters; const g=new THREE.BoxGeometry(p.width+2*pad,p.height+2*pad,p.depth+2*pad); return halo(m,g,color);
}
/* cable del RITS amb aspecte real (color fix) */
function rCable(key, el, pts, color, mat, o={}){
  pts=P(pts); const D=CBL.rg6, r=o.r ?? D.d/2, R=o.R ?? D.rb, Sm=pathSamples(polyCurve(pts,0,R,{key,rb:D.rb}));   // coaxial RG-6 a mida real
  const m=ictMesh(sweepGeo(Sm,r,10,0,Math.PI*2,null,true), color, el, {std:RM[mat], cable:key, fixedColor:true, rits:true, tram:o.tram||EL[el].tram||'capt', tech:o.tech||'coax', svc:o.svc||EL[el].svc, cast:true});
  addProxy(m, sweepGeo(Sm, o.pr ?? 0.016, 5));
  if(o.halo!==false) halo(m, sweepGeo(Sm, r+0.003, 8), o.hc ?? RFN.capt);
  G.cables[key]={key, el, pts, mesh:m, from:o.from||null, to:o.to||null, via:o.via||null, sm:Sm, r};
  if(SCOPE) SCOPE.keys.push(key);
  return m;
}
/* camí pseudocable (recorregut del senyal dins d'un equip; sense malla) */
function pathOnly(key, el, pts){ G.cables[key]={key, el, pts:P(pts), mesh:null}; if(SCOPE) SCOPE.keys.push(key); }

/* ---------- marcs de transport paral·lel ---------- */
function frameTable(curve, L, ds=0.004){
  const n=Math.max(2,Math.ceil(L/ds)), Pp=[],T=[],N=[],B=[];
  for(let i=0;i<=n;i++){ const u=i/n; Pp.push(curve.getPointAt(u)); T.push(curve.getTangentAt(u).normalize()); }
  let n0 = Math.abs(T[0].y)<0.9 ? V(0,1,0) : V(1,0,0); n0.sub(T[0].clone().multiplyScalar(n0.dot(T[0]))).normalize();
  N[0]=n0; B[0]=T[0].clone().cross(n0);
  for(let i=1;i<=n;i++){
    const ax=T[i-1].clone().cross(T[i]); let nn=N[i-1].clone();
    if(ax.length()>1e-8){ ax.normalize(); nn.applyAxisAngle(ax, Math.acos(THREE.MathUtils.clamp(T[i-1].dot(T[i]),-1,1))); }
    nn.sub(T[i].clone().multiplyScalar(nn.dot(T[i]))).normalize(); N[i]=nn; B[i]=T[i].clone().cross(nn);
  }
  return {n, L, ds:L/n, P:Pp, T, N, B, at(s){ const i=THREE.MathUtils.clamp(Math.round(s/this.ds),0,this.n); return i; }};
}
/* recorregut d'un cable dins d'un tub: segueix la mateixa corba amb un desplaçament */
function insidePath(ft, s0, s1, dn, db){
  const out=[]; const i0=ft.at(s0), i1=ft.at(s1), st=Math.max(1,Math.round(0.02/ft.ds));
  for(let i=i0;i<=i1;i+=st) out.push(ft.P[i].clone().addScaledVector(ft.N[i],dn).addScaledVector(ft.B[i],db||0));
  const l=ft.P[i1].clone().addScaledVector(ft.N[i1],dn).addScaledVector(ft.B[i1],db||0);
  if(out[out.length-1].distanceTo(l)>1e-4) out.push(l); return out;
}
/* ---------- tub corrugat: superfície amb anelles, gruix de paret i boques obertes ---------- */
function corrShell(ft, s0, s1, r, ri, pitch, amp, ang, kind){
  // ang(i) → [a0,a1] per anella; kind: 'full' | 'half'
  const pos=[], nor=[], idx=[]; const radial = kind==='full'?14:8;
  const ds=pitch/4; const ns=Math.max(1,Math.ceil((s1-s0)/ds));
  const rad=s=> r - amp*(0.5-0.5*Math.cos(2*Math.PI*s/pitch));
  const drad=s=> -amp*0.5*Math.sin(2*Math.PI*s/pitch)*2*Math.PI/pitch;
  const ring=(s,rr,sign,dr)=>{ const i=ft.at(s); const [a0,a1]=ang(i); const Pp=ft.P[i], T=ft.T[i], N=ft.N[i], B=ft.B[i]; const base=pos.length/3;
    for(let j=0;j<=radial;j++){ const a=a0+(a1-a0)*j/radial, c=Math.cos(a), sn=Math.sin(a);
      const d=N.clone().multiplyScalar(c).addScaledVector(B,sn); const p=Pp.clone().addScaledVector(d,rr);
      pos.push(p.x,p.y,p.z); const nn = sign>0 ? d.clone().addScaledVector(T,-dr).normalize() : d.clone().multiplyScalar(-1); nor.push(nn.x,nn.y,nn.z); }
    return base; };
  const strip=(rows)=>{ for(let k=0;k<rows.length-1;k++){ const a=rows[k], b=rows[k+1]; for(let j=0;j<radial;j++){ idx.push(a+j,b+j,a+j+1, a+j+1,b+j,b+j+1); } } };
  const outer=[], inner=[];
  for(let k=0;k<=ns;k++){ const s=s0+(s1-s0)*k/ns; outer.push(ring(s,rad(s),1,drad(s))); }
  const nsi=Math.max(1,Math.ceil((s1-s0)/0.03));
  for(let k=0;k<=nsi;k++){ const s=s0+(s1-s0)*k/nsi; inner.push(ring(s,ri,-1,0)); }
  strip(outer); strip(inner);
  if(kind==='half'){ // cares del tall: unió paret exterior-interior a les dues vores longitudinals
    for(const jj of [0,radial]) for(let k=0;k<nsi;k++){
      const sA=s0+(s1-s0)*k/nsi, sB=s0+(s1-s0)*(k+1)/nsi; const base=pos.length/3;
      for(const s of [sA,sB]){ const i=ft.at(s); const [a0,a1]=ang(i); const a=jj?a1:a0; const d=ft.N[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(ft.B[i],Math.sin(a));
        const tn=ft.T[i].clone().cross(d).multiplyScalar(jj?1:-1);
        for(const rr of [ri, r-amp*0.5]){ const p=ft.P[i].clone().addScaledVector(d,rr); pos.push(p.x,p.y,p.z); nor.push(tn.x,tn.y,tn.z); } }
      idx.push(base,base+2,base+1, base+1,base+2,base+3);
    }
  }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3)); g.setIndex(idx); return g;
}
function annulus(ft, s, r, ri, a0, a1, sign){
  const i=ft.at(s), pos=[], nor=[], idx=[], n=24, T=ft.T[i].clone().multiplyScalar(sign);
  for(let j=0;j<=n;j++){ const a=a0+(a1-a0)*j/n; const d=ft.N[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(ft.B[i],Math.sin(a));
    for(const rr of [ri,r]){ const p=ft.P[i].clone().addScaledVector(d,rr); pos.push(p.x,p.y,p.z); nor.push(T.x,T.y,T.z); } }
  for(let j=0;j<n;j++){ const b=j*2; idx.push(b,b+1,b+2, b+1,b+3,b+2); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3)); g.setIndex(idx); return g;
}
function corrTube(el, pts, r, o={}){
  pts=P(pts); const cr=o.cr??0.09; const curve=polyCurve(pts,cr); const L=curve.getLength(); const ft=frameTable(curve,L);
  const ri=r*0.80, pitch=o.pitch||0.016, amp=r*0.13, col=o.color??0x202225;
  const full=()=>[0,Math.PI*2];
  const mk=(geo,extra)=>{ const m=rMesh(el,geo,col,'corr',Object.assign({corr:true, cast:true},extra)); G.pick.push(m); return m; };
  const pieces=[];
  const cut=o.cut, cd=o.cutDir?o.cutDir.clone().normalize():V(0,0,1);
  const phi=i=>Math.atan2(cd.dot(ft.B[i]), cd.dot(ft.N[i]));
  if(cut){
    pieces.push(mk(corrShell(ft,0,cut[0],r,ri,pitch,amp,full,'full')));
    pieces.push(mk(corrShell(ft,cut[0],cut[1],r,ri,pitch,amp,i=>[phi(i)+Math.PI/2,phi(i)+Math.PI*1.5],'half')));
    pieces.push(mk(corrShell(ft,cut[0],cut[1],r,ri,pitch,amp,i=>[phi(i)-Math.PI/2,phi(i)+Math.PI/2],'half'),{corrPiece:'openHalf'}));
    pieces.push(mk(corrShell(ft,cut[1],L,r,ri,pitch,amp,full,'full')));
    // cares del tall transversal (visibles en obrir el tram)
    const i0=ft.at(cut[0]), i1=ft.at(cut[1]);
    mk(annulus(ft,cut[0],r-amp*0.5,ri,phi(i0)-Math.PI/2,phi(i0)+Math.PI/2,1),{corrPiece:'cutEdge'});
    mk(annulus(ft,cut[1],r-amp*0.5,ri,phi(i1)-Math.PI/2,phi(i1)+Math.PI/2,-1),{corrPiece:'cutEdge'});
  } else pieces.push(mk(corrShell(ft,0,L,r,ri,pitch,amp,full,'full')));
  // boques obertes: anell de paret a cada extrem
  if(o.mouth0!==false) mk(annulus(ft,0,r,ri,0,Math.PI*2,-1));
  if(o.mouth1!==false) mk(annulus(ft,L,r,ri,0,Math.PI*2,1));
  halo(pieces[0], tubeGeo(pts, r*1.28, 12, cr), RFN.tube);
  return {ft, L, curve};
}
/* brida de subjecció d'un tub o cable a una superfície */
function clampAt(el, p, t, n, r, o={}){
  t=t.clone().normalize(); n=n.clone().normalize(); const w=o.w||0.016, d=o.stand ?? (r*1.12+0.006);
  const band=rCyl(el, r*1.12, w, p, t, 0xB9BEC4, 'galv', {open:true, seg:18}); band.material.side=THREE.DoubleSide;
  const foot=p.clone().addScaledVector(n, -d);
  const fb=rMesh(el,new THREE.BoxGeometry(0.034,0.006,0.034),0xB9BEC4,'galv'); fb.position.copy(foot.clone().addScaledVector(n,0.003)); fb.quaternion.setFromUnitVectors(UP,n);
  const sl=d-r*1.1; if(sl>0.001){ const st=rMesh(el,new THREE.BoxGeometry(0.008,sl,w),0xB9BEC4,'galv'); st.position.copy(p.clone().addScaledVector(n,-(r*1.1+sl/2))); st.quaternion.setFromUnitVectors(UP,n); const tq=new THREE.Quaternion().setFromUnitVectors(V(0,0,1).applyQuaternion(st.quaternion), t); if(Math.abs(t.dot(n))<0.9) st.quaternion.premultiply(tq); }
  rCyl(el,0.0045,0.004,foot.clone().addScaledVector(n,0.008),n,0x6E7378,'steel');
}
/* clip no aixafador per a cable coaxial */
function cableClip(el,p,n){ const m=rMesh(el,new THREE.TorusGeometry(0.0095,0.0022,6,14,Math.PI*1.2),0xEDEDED,'plastic'); m.position.copy(p); m.lookAt(p.clone().add(V(1,0,0))); m.rotateZ(Math.PI*-0.1);
  const b=rMesh(el,new THREE.BoxGeometry(0.012,0.012,0.006),0xEDEDED,'plastic'); b.position.copy(p.clone().addScaledVector(n,-0.012)); b.lookAt(p.clone().add(n)); }

/* ---------- connectors F (mida real: femella hexagonal d'11 mm, rosca de 3/8") ---------- */
const NI=0xC9CCCF;
/* port femella d'un equip: base + rosca (sense conductor visible) */
function fFemale(el, base, dir, o={}){ dir=dir.clone().normalize();
  rHex(el,0.00625,0.0035,base.clone().addScaledVector(dir,0.00175),dir,NI,'nickel');
  const b=rCyl(el,0.00475,0.011,base.clone().addScaledVector(dir,0.009),dir,NI,'nickel');
  for(const k of [0.0055,0.008,0.0105,0.013]) rCyl(el,0.00495,0.0006,base.clone().addScaledVector(dir,k),dir,0xA9ACAF,'nickel');
  if(o.open){ rCyl(el,0.0031,0.0004,base.clone().addScaledVector(dir,0.0147),dir,0xF2F2EC,'plastic'); rCyl(el,0.0008,0.00045,base.clone().addScaledVector(dir,0.01485),dir,0x333333,'plastic'); }
  return b;
}
/* Connector roscat 417101: plànol CAD07190354, 21,10586 mm; boca a l'origen i cos cap a +Y. */
const FC_LENGTH=0.02110585939695954;
function coaxPlug(el,tip,dir){ dir=dir.clone().normalize();
  const end=tip.clone().addScaledVector(dir,FC_LENGTH);
  if(MODELS.conF?.scene){
    const q=new THREE.Quaternion().setFromUnitVectors(UP,dir), ms=placeModel('conF',el,tip.x,tip.y,tip.z,{},q);
    for(const m of ms){ m.userData.connectorF=true; }
    if(ms[0]){ const pg=new THREE.CylinderGeometry(0.009,0.009,FC_LENGTH,8); pg.applyQuaternion(q); pg.translate((tip.x+end.x)/2,(tip.y+end.y)/2,(tip.z+end.z)/2); addProxy(ms[0],pg); }
  } else {
    rHex(el,0.0063,0.0047,tip.clone().addScaledVector(dir,0.00235),dir,NI,'nickel');
    rCyl(el,0.0041,0.0053,tip.clone().addScaledVector(dir,0.00735),dir,NI,'nickel');
    rCyl(el,0.0044,0.0111,tip.clone().addScaledVector(dir,0.01555),dir,NI,'nickel');
  }
  return end;
}
/* Port de l'equip + connector del cable; retorna l'entrada del cable al cos moletejat. */
function fMale(el,base,dir,cel='cap_conF'){ dir=dir.clone().normalize();
  rHex(el,0.00625,0.0035,base.clone().addScaledVector(dir,0.00175),dir,NI,'nickel');
  return coaxPlug(cel,base.clone().addScaledVector(dir,0.0035),dir);
}
/* Connector solt: el viu és el del cable, la boca del model no porta un pin propi. */
function fMaleFree(el,tip,dir){ return coaxPlug(el,tip,dir); }
/* ---------- fibra: adaptador i connector SC/APC a mida real (models adaptador_sc.glb i sc_apc.glb) ----------
   Connector SC/APC simplex (IEC 61754-4): grip 9,0 × 7,4 mm, virola Ø2,5 mm, 52 mm de la punta al final de la mànega.
   Adaptador simplex femella-femella 12,7 × 9,7 × 25,4 mm amb el marc de la tapa autoblocant (15,5 × 11 × 3,2 mm) a la
   boca exterior; el pla d'acoblament és a 12,7 mm de la boca. side: direcció de la cara ampla (eix X dels models). */
const SC_PLUG=0.052, SC_MATE=0.0127, SC_GREEN=0x2E9B3F;
function scQuat(dir,side){ const y=dir.clone().normalize(), z=new THREE.Vector3().crossVectors(side,y).normalize(), x=new THREE.Vector3().crossVectors(y,z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z)); }
/* caixa orientada (reserva procedural): w segons side, l segons l'eix, h, centrada a c */
function oBox(el,w,l,h,c,q,col){ const m=ictMesh(new THREE.BoxGeometry(w,l,h),col,el,{std:{roughness:0.45,metalness:0}}); m.position.copy(c); m.quaternion.copy(q); return m; }
/* adaptador amb la boca exterior a mouth i l'eix cap endins (dir); plug: hi ha connector (sense tapa). Retorna el pla d'acoblament. */
function scAdapter(el,mouth,dir,side,plug){ const d=dir.clone().normalize(), q=scQuat(d,side);
  if(MODELS.adSC?.scene) placeModel('adSC',el,mouth.x,mouth.y,mouth.z,plug?{tapa:null}:{},q);
  else { oBox(el,0.0155,0.0032,0.011,mouth.clone().addScaledVector(d,0.0016),q,SC_GREEN); oBox(el,0.0127,0.0222,0.0097,mouth.clone().addScaledVector(d,0.0143),q,SC_GREEN); }
  return mouth.clone().addScaledVector(d,SC_MATE);
}
/* connector amb la punta de la virola a tip i el cable cap a dir; retorna on comença el cable */
function scPlug(el,tip,dir,side){ const d=dir.clone().normalize(), q=scQuat(d,side), end=tip.clone().addScaledVector(d,SC_PLUG);
  if(MODELS.scApc?.scene){ const ms=placeModel('scApc',el,tip.x,tip.y,tip.z,{},q);
    if(ms[0]){ const pg=new THREE.BoxGeometry(0.014,SC_PLUG,0.014).applyQuaternion(q); const c=tip.clone().addScaledVector(d,SC_PLUG/2); pg.translate(c.x,c.y,c.z); addProxy(ms[0],pg); } }
  else { oBox(el,0.009,0.0222,0.0074,tip.clone().addScaledVector(d,0.0139),q,SC_GREEN); rCyl(el,0.0012,0.025,tip.clone().addScaledVector(d,0.0395),d,0x24803F,'plastic',{r2:0.003}); }
  return end.toArray();
}
function fLoad(el, base, dir, dcBlock){ dir=dir.clone().normalize();
  if(MODELS.carrega?.scene){                                     // càrrega 75 Ω 4061 (models/carrega.glb): la femella s'enrosca al port
    const p=base.clone().addScaledVector(dir,0.0025), ms=placeModel('carrega','cap_carregues',p.x,p.y,p.z,{},new THREE.Quaternion().setFromUnitVectors(UP,dir));
    for(const m of ms) G.pick.push(m); return; }
  rHex(el,0.00625,0.0035,base.clone().addScaledVector(dir,0.00175),dir,NI,'nickel');
  rHex('cap_carregues',0.00675,0.0085,base.clone().addScaledVector(dir,0.00775),dir,NI,'nickel');
  const L = dcBlock?0.021:0.008;
  rCyl('cap_carregues',dcBlock?0.006:0.00525,L,base.clone().addScaledVector(dir,0.012+L/2),dir,dcBlock?0xD9DCDF:NI,'nickel');
  if(dcBlock) rCyl('cap_carregues',0.0061,0.002,base.clone().addScaledVector(dir,0.012+L*0.75),dir,0xC62828,'plastic');
}
/* etiqueta d'identificació de cable (brida + bandera amb text) */
/* p és la posició aproximada: la brida s'enganxa al punt més proper del cable (key, o els cables de l'element el)
   i s'orienta segons el cable en aquell punt; la bandera surt cap a side, perpendicular al cable */
function cableTag(el, p, side, text, axis, key){
  const cs = key ? [G.cables[key]] : Object.values(G.cables).filter(c=>c.el===el);
  let best=Infinity, q=null, t=null;
  for(const c of cs) if(c?.sm) for(let i=1;i<c.sm.P.length;i++){
    const a=c.sm.P[i-1], d=c.sm.P[i].clone().sub(a), L2=d.lengthSq(); if(L2<1e-12) continue;
    const k=THREE.MathUtils.clamp(p.clone().sub(a).dot(d)/L2,0,1), x=a.clone().addScaledVector(d,k), e=x.distanceTo(p);
    if(e<best){ best=e; q=x; t=d.normalize(); } }
  if(q){ p=q; axis=t; side=side.clone().addScaledVector(t,-side.dot(t));
    if(side.lengthSq()<1e-4) side=new THREE.Vector3().crossVectors(t,Math.abs(t.z)<0.9?V(0,0,1):V(0,1,0));
    side.normalize(); }
  rCyl(el,0.0045,0.006,p,axis||V(0,1,0),0xF5F5F0,'plastic',{seg:14});
  const w=Math.max(0.04,text.length*0.0027);                      // bandera prou ampla per al text (4 cm com a mínim)
  const tx=textTex([text],{w:Math.round(256*w/0.04),h:72,size:30,border:'#888',bw:3});
  /* la bandera (horitzontal, mirant a +Z) penja de la brida: a sota/a sobre si side és més vertical, i si no al costat */
  const vert=Math.abs(side.y)>Math.abs(side.x), off=vert ? V(0,Math.sign(side.y)*(0.004+0.0056),0) : V(Math.sign(side.x||1)*(0.004+w/2),0,0);
  const pos=p.clone().add(off).add(V(0,0,0.005));   // 5 mm endavant: passa per davant dels cables veïns
  const m=rPlane(el,w,0.0112,pos,V(0,0,1),tx,{double:true});
  m.lookAt(pos.clone().add(V(0,0,1)));
  return m;
}
/* sprite de símbol (mode d'identificació didàctica) */
function symSprite(el, pos, text, color, sc=0.26){
  const w=Math.max(320, Math.ceil(text.length*25+40));
  const t=textTex([text],{w,h:80,size:40,bg:'#FFFFFF',fg:color,border:color,bw:6,bold:[true]});
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:true,transparent:true}));
  s.position.copy(pos); const k=sc/320; s.scale.set(w*k,80*k,1); s.userData={sprite:true, el}; s.renderOrder=6; (ROOT||scene).add(s); RG.sprites.push(s); if(SCOPE) SCOPE.extra.push(s); return s;
}

/* =====================================================================
   RECINTE: parets, terra, sostre, porta, safata, terra, electricitat
   ===================================================================== */
const RITS_EXIT={}, RITS_OPEN=[];
function polyR(el, pts, r, color, mat, o={}){ pts=P(pts); const m=rMesh(el, rTubeGeo(pts,r,o.radial||10,o.cr??0.04,undefined,undefined,true), color, mat, Object.assign({cast:true},o)); if(o.pick!==false) addProxy(m, rTubeGeo(pts,Math.max(r*2,0.02),5,o.cr??0.04)); if(o.hc!==undefined) halo(m, rTubeGeo(pts,r+0.005,8,o.cr??0.04), o.hc); return m; }
function buildRITSRoom(){
  const W=0xE3E6E8, pk={cast:true, pick:true};
  rBox('rits',RI.x0,RI.x1,15.0,RI.y0,RI.z0,RI.z1,0x92999E,'floor',{pick:true});
  rBox('rits',-0.46,-0.34,15.0,17.6,-4.99,-2.36,W,'plaster',pk);
  rBox('rits',3.34,3.46,15.0,17.6,-4.99,-2.36,W,'plaster',pk);
  rBox('rits',-0.34,3.34,15.0,17.6,-4.99,-4.73,W,'plaster',pk);
  const F=Object.assign({ritsPart:'front'},pk);
  rBox('rits',-0.34,2.17,15.0,17.6,-2.48,-2.36,W,'plaster',F);
  rBox('rits',3.13,3.34,15.0,17.6,-2.48,-2.36,W,'plaster',F);
  rBox('rits',2.17,3.13,17.13,17.6,-2.48,-2.36,W,'plaster',F);
  // sostre (forjat) amb cara inferior arrebossada; es pot retirar
  rBox('rits',-0.50,3.50,17.615,17.76,-5.03,-2.32,0xB9BCBE,'concrete',{ritsPart:'roof',cast:true,pick:true});
  rBox('rits',RI.x0,RI.x1,17.6,17.615,RI.z0,RI.z1,W,'plaster',{ritsPart:'roof',cast:true});
  rBox('rits',-0.50,3.50,17.76,17.80,-5.03,-2.32,0x8E9396,'concrete',{ritsPart:'roof'});      // impermeabilització
  // sòcol de protecció a la base exterior
  rBox('rits',-0.47,3.47,15.0,15.08,-2.355,-2.345,0xA9AEB2,'concrete',{ritsPart:'front'});
  /* --- porta metàl·lica (una fulla, obre cap a fora, frontissa a la dreta) --- */
  const D='rits_porta', DC=0xC6CBC6, FR=Object.assign({ritsPart:'front',cast:true});
  rBox(D,2.17,2.255,15.02,17.13,-2.50,-2.34,0xB7BDB8,'paint',Object.assign({pick:true},FR));
  rBox(D,3.045,3.13,15.02,17.13,-2.50,-2.34,0xB7BDB8,'paint',Object.assign({pick:true},FR));
  rBox(D,2.255,3.045,17.05,17.13,-2.50,-2.34,0xB7BDB8,'paint',FR);
  rBox(D,2.17,3.13,15.0,15.028,-2.52,-2.34,0x9DA3A8,'steel',{ritsPart:'front'});     // llindar
  for(const y of [15.30,16.06,16.82]) rCyl(D,0.009,0.11,V(3.052,y,-2.334),UP,0x9DA3A8,'steel',{ritsPart:'front'});
  const piv=new THREE.Group(); piv.position.set(3.045,16.035,-2.375); (ROOT||scene).add(piv);
  const L=(geo,col,mat,x,y,z,o={})=>{ const m=rMesh(o.el||D,geo,col,mat,Object.assign({parent:piv,ritsPart:'front',cast:true},o)); m.position.set(x,y,z); return m; };
  const leaf=L(new THREE.BoxGeometry(0.788,2.028,0.045),DC,'paint',-0.395,0,-0.0225); G.pick.push(leaf);
  L(new THREE.BoxGeometry(0.70,0.006,0.004),0xB4BAB4,'paint',-0.395,0.62,0.0015); L(new THREE.BoxGeometry(0.70,0.006,0.004),0xB4BAB4,'paint',-0.395,-0.30,0.0015);
  // reixeta de ventilació baixa
  L(new THREE.BoxGeometry(0.46,0.22,0.004),0x3B4044,'steel',-0.395,-0.78,0.0015,{el:'rits_vent'});
  for(let i=0;i<7;i++) L(new THREE.BoxGeometry(0.44,0.012,0.02),0xB9BEB9,'paint',-0.395,-0.87+i*0.03,0.008,{el:'rits_vent'});
  // manetes (dues cares), placa i pany
  for(const sz of [1,-1]){ const zf= sz>0 ? 0.002 : -0.047;
    L(new THREE.BoxGeometry(0.05,0.22,0.008),0x8F969C,'steel',-0.71,0.02,zf+sz*0.004);
    L(new THREE.CylinderGeometry(0.009,0.009,0.05,12).rotateX(Math.PI/2),0x8F969C,'steel',-0.71,0.08,zf+sz*0.03);
    L(new THREE.BoxGeometry(0.14,0.018,0.018),0x9AA1A7,'steel',-0.66,0.08,zf+sz*0.055);
    L(new THREE.CylinderGeometry(0.011,0.011,0.012,14).rotateX(Math.PI/2),0xC9A227,'nickel',-0.71,-0.05,zf+sz*0.012); }
  (G.doors ||= []).push({piv, of:'rits', side:-1, cur:0});
  /* --- safata perimetral --- */
  const TS=0xB0B6BC, y0=17.30, y1=17.36;
  const trayRun=(x0,x1,z0,z1,along)=>{
    rBox('rits_safata',x0,x1,y0,y0+0.004,z0,z1,TS,'galv',{cast:true,pick:true});
    if(along==='x'){ rBox('rits_safata',x0,x1,y0,y1,z0,z0+0.003,TS,'galv',{cast:true}); rBox('rits_safata',x0,x1,y0,y1,z1-0.003,z1,TS,'galv',{cast:true});
      for(let x=x0+0.25;x<x1-0.1;x+=0.9){ rBox('rits_safata',x-0.015,x+0.015,y0-0.03,y0,z0-0.07,z1,0x9EA5AC,'galv'); } }
    else { rBox('rits_safata',x0,x0+0.003,y0,y1,z0,z1,TS,'galv',{cast:true}); rBox('rits_safata',x1-0.003,x1,y0,y1,z0,z1,TS,'galv',{cast:true}); }
  };
  trayRun(-0.27,3.27,-4.66,-4.46,'x');
  trayRun(-0.27,-0.07,-4.46,-2.55,'z'); trayRun(3.07,3.27,-4.46,-2.55,'z');
  rBox('rits_safata',-0.07,3.07,y0,y0+0.004,-2.75,-2.55,TS,'galv',{cast:true,pick:true}); rBox('rits_safata',-0.07,3.07,y0,y1,-2.553,-2.55,TS,'galv'); rBox('rits_safata',-0.07,3.07,y0,y1,-2.75,-2.747,TS,'galv');
  for(const z of [-3.2,-4.1]){ rBox('rits_safata',-0.34,-0.07,y0-0.03,y0,z-0.015,z+0.015,0x9EA5AC,'galv'); rBox('rits_safata',3.07,3.34,y0-0.03,y0,z-0.015,z+0.015,0x9EA5AC,'galv'); }
  for(const x of [0.6,1.8]) rBox('rits_safata',x-0.015,x+0.015,y0-0.03,y0,-2.75,-2.48,0x9EA5AC,'galv');
  // perforacions: franges fosques al fons
  for(let x=-0.2;x<3.2;x+=0.06) rBox('rits_safata',x,x+0.025,y0+0.0042,y0+0.0046,-4.62,-4.50,0x6F767C,'galv');
  /* --- anell de terra i barra col·lectora --- */
  const yr=17.18, o=0.012, ring=[[0.45,yr,RI.z0+o],[RI.x1-o,yr,RI.z0+o],[RI.x1-o,yr,RI.z1-o],[RI.x0+o,yr,RI.z1-o],[RI.x0+o,yr,RI.z0+o],[0.05,yr,RI.z0+o]];
  polyR('rits_terra',ring,0.006,0xFFFFFF,'gy',{cr:0.05,hc:RFN.pe});
  rBox('rits_terra',0.05,0.45,yr-0.016,yr+0.016,-4.718,-4.706,0xB87333,'copper',{cast:true,pick:true});
  for(const x of [0.08,0.42]){ rCyl('rits_terra',0.008,0.012,V(x,yr,-4.724),V(0,0,1),0x2B2B2B,'plastic'); }
  for(let x=0.10;x<0.42;x+=0.05) rHex('rits_terra',0.0045,0.006,V(x,yr,-4.703),V(0,0,1),0xC0C3C6,'nickel');
  for(const [x,z] of [[1.4,RI.z0+o],[2.6,RI.z0+o]]) rBox('rits_terra',x-0.01,x+0.01,yr-0.012,yr+0.012,RI.z0,z+0.006,0x2B2B2B,'plastic');
  for(const z of [-3.2,-4.1]){ rBox('rits_terra',RI.x0,RI.x0+0.018,yr-0.012,yr+0.012,z-0.01,z+0.01,0x2B2B2B,'plastic'); rBox('rits_terra',RI.x1-0.018,RI.x1,yr-0.012,yr+0.012,z-0.01,z+0.01,0x2B2B2B,'plastic'); }
  polyR('rits_terra',[[0.25,yr-0.016,-4.712],[0.25,15.10,-4.712],[0.25,14.96,-4.712]],0.006,0xFFFFFF,'gy',{cr:0.03,hc:RFN.pe});
  for(const y of [16.4,15.6]) rBox('rits_terra',0.24,0.26,y-0.008,y+0.008,-4.73,-4.704,0x2B2B2B,'plastic');
  cableTag('rits_terra',V(0.25,16.85,-4.712),V(1,0,0),'Cap a la terra general');
  symSprite('rits_terra',V(0.25,17.32,-4.60),'⊥ Terra','#2E7D32');
  /* --- connexions equipotencials comunes --- */
  const B=(pts)=>polyR('rits_equip',pts,0.004,0xFFFFFF,'gy',{cr:0.02,hc:RFN.pe});
  B([[0.10,yr-0.016,-4.700],[0.10,16.80,-4.700],[0.86,16.80,-4.700],[0.86,16.715,-4.705]]);              // placa
  rHex('rits_suport',0.008,0.006,V(0.86,16.70,-4.712),V(0,0,1),0xC0C3C6,'nickel');
  B([[0.40,yr+0.016,-4.700],[0.40,17.33,-4.700],[0.40,17.33,-4.663]]);                                   // safata
  B([[0.30,yr-0.016,-4.700],[0.30,17.04,-4.700],[3.326,17.04,-4.700],[3.326,17.04,-2.86],[3.326,16.66,-2.86]]); // quadre
  /* --- placa de muntatge --- */
  rBox('rits_suport',0.80,2.50,15.50,16.75,RI.z0,ZP,0xC3C8CC,'galv',{cast:true,pick:true});
  for(const [x,y] of [[0.84,15.54],[1.65,15.54],[2.46,15.54],[0.84,16.70],[1.65,16.71],[2.46,16.71]]) rHex('rits_suport',0.009,0.006,V(x,y,ZP+0.003),V(0,0,1),0x8D949A,'steel');
  rPlane('rits_suport',0.62,0.035,V(1.27,15.535,ZP+0.0012),V(0,0,1),textTex(['Equips i connectors a mida real · dimensions del fabricant'],{w:1024,h:58,size:34,bg:'#F4F6F7',fg:'#37474F'}));
  /* --- espai lliure de manteniment (només en mode didàctic) --- */
  const tape=textTex(['ESPAI LLIURE DE MANTENIMENT'],{w:1024,h:96,size:54,bg:'#FFD54F',fg:'#3E2723',bold:[true]});
  rPlane('rits',1.1,0.10,V(1.65,RI.y0+0.002,-3.55),V(0,1,0),tape,{didOnly:true});
  for(const [x0,x1,z0,z1] of [[0.75,2.55,-4.62,-4.58],[0.75,2.55,-3.44,-3.40],[0.75,0.79,-4.62,-3.40],[2.51,2.55,-4.62,-3.40]]) rBox('rits',x0,x1,RI.y0,RI.y0+0.002,z0,z1,0xF9A825,'plastic',{didOnly:true});
  buildRITSElectrical();
}
function buildRITSElectrical(){
  const E='rits_tub_elec', EC=0xD9DCDE;
  const C=(pts,o={})=>polyR(o.el||E,pts,0.011,EC,'pvc',Object.assign({cr:0.05,hc:RFN.ac},o));
  C([[3.30,14.96,-2.95],[3.30,16.25,-2.95]]);                                                        // escomesa
  C([[3.30,16.65,-2.90],[3.30,17.50,-2.90],[3.30,17.555,-2.95]]);                                   // enllumenat (paret)
  C([[3.30,17.53,-2.90],[3.30,17.555,-2.90],[1.50,17.555,-2.90],[1.50,17.555,-3.00]],{ritsPart:'roof'}); // enllumenat (sostre)
  C([[3.30,16.65,-2.70],[3.30,16.86,-2.70]]);                                                        // emergència
  rBox(E,2.01,2.09,17.515,17.6,-2.94,-2.86,0xE4E6E8,'plastic',{ritsPart:'roof'});                                      // caixa de derivació
  C([[2.05,17.555,-2.86],[2.05,17.555,-2.52]],{ritsPart:'roof'}); C([[2.05,17.60,-2.52],[2.05,16.17,-2.52]],{ritsPart:'front'}); // interruptor
  C([[3.30,16.25,-3.00],[3.30,16.10,-3.00],[3.30,16.10,-3.72]]);                                     // bases de servei
  C([[3.30,16.25,-2.85],[3.30,15.10,-2.85],[3.30,15.10,-4.69],[0.64,15.10,-4.69],[0.64,16.00,-4.69]]); // bases capçalera
  for(const [x,y,z,n] of [[3.30,15.6,-2.95,'x'],[3.30,17.1,-2.90,'x'],[3.30,15.6,-2.85,'x'],[2.4,15.10,-4.69,'z'],[1.2,15.10,-4.69,'z'],[0.64,15.6,-4.69,'z']]){
    const g=n==='x'?[0.012,0.03,0.03]:n==='y'?[0.03,0.012,0.03]:[0.03,0.03,0.012]; const m=rMesh(E,new THREE.BoxGeometry(...g),0xBFC3C6,'plastic'); m.position.set(n==='x'?3.334:x, n==='y'?17.594:y, n==='z'?-4.724:z); }
  symSprite(E,V(3.10,15.45,-2.95),'⚡ 230 V c.a.','#C62828');
  /* quadre de protecció amb tapa */
  const Q='rits_quadre';
  const QC=0xEDEFF0;
  rBox(Q,3.33,3.34,16.25,16.65,-3.03,-2.67,QC,'plastic',{cast:true,pick:true});
  rBox(Q,3.232,3.33,16.64,16.65,-3.03,-2.67,QC,'plastic',{cast:true,pick:true}); rBox(Q,3.232,3.33,16.25,16.26,-3.03,-2.67,QC,'plastic',{cast:true,pick:true});
  rBox(Q,3.232,3.33,16.26,16.64,-3.03,-3.02,QC,'plastic',{cast:true}); rBox(Q,3.232,3.33,16.26,16.64,-2.68,-2.67,QC,'plastic',{cast:true});
  /* aparellatge modular a mida real (2 mòduls = 36 mm): files del carril DIN de dalt (IGA + diferencial) i de baix
     (magnetotèrmics dels circuits), juxtaposats des de l'esquerra; la resta del carril queda tapada amb una tapa cega */
  const ROWS=[[16.545,[['mcb','IGA','25 A','C25'],['rcd','ID','30 mA']]],
              [16.385,[['mcb','Enllumenat','10 A','C10'],['mcb','Bases','16 A','C16'],['mcb','Capçalera RTV','16 A','C16']]]];
  for(const [y,devs] of ROWS){
    rBox(Q,3.31,3.33,y-0.0045,y+0.0045,-3.01,-2.68,0xA9AFB4,'steel');                         // carril DIN
    devs.forEach(([k,t1,t2,curve],i)=>{ const zc=-2.99+DINW*(i+0.5);
      dinDevice(Q,k,zc,y,k==='mcb'?{curve}:{});
      rPlane(Q,DINW-0.002,0.013,V(3.2545,y+0.056,zc),V(-1,0,0),textTex([t1,t2],{w:192,h:72,fs:[22,24],bold:[false,true],bg:'#FFFFFF',fg:'#263238',border:'#B0B6BB',bw:2})); });
    const z1=-2.99+DINW*devs.length;                                                           // tapa cega fins al final del carril
    rBox(Q,3.266,3.31,y-0.0225,y+0.0225,z1+0.001,-2.69,0xE4E6E7,'plastic');
  }
  rBox(Q,3.27,3.33,16.27,16.29,-2.99,-2.90,0x2E9B3F,'plastic'); rBox(Q,3.27,3.33,16.27,16.29,-2.90,-2.86,0xE8C71A,'plastic');
  rPlane(Q,0.30,0.04,V(3.3385,16.69,-2.85),V(-1,0,0),textTex(['Quadre de protecció del RITS · exemple didàctic'],{w:1024,h:120,size:46,bg:'#FFFFFF',fg:'#B71C1C'}));
  { const piv=new THREE.Group(); piv.position.set(3.226,16.45,-3.03); (ROOT||scene).add(piv);
    const lid=rMesh(Q,new THREE.BoxGeometry(0.006,0.40,0.36),0x9EA7AD,{roughness:0.15,metalness:0},{parent:piv,opacity:0.42}); lid.position.set(0,0,0.18); G.pick.push(lid);
    // perfils sense cares coplanàries amb la tapa (evita el «z-fighting» quan es mira la tapa oberta)
    const fr=rMesh(Q,new THREE.BoxGeometry(0.010,0.012,0.362),0xE7E9EA,'plastic',{parent:piv}); fr.position.set(-0.0015,0.1945,0.18);
    const fr2=rMesh(Q,new THREE.BoxGeometry(0.010,0.012,0.362),0xE7E9EA,'plastic',{parent:piv}); fr2.position.set(-0.0015,-0.1945,0.18);
    const kn=rMesh(Q,new THREE.BoxGeometry(0.012,0.05,0.016),0x6E777E,'plastic',{parent:piv}); kn.position.set(-0.006,0,0.345);
    G.doors.push({piv, of:Q, side:1, cur:0}); }
  /* bases de corrent Schuko */
  const schuko=(el,cx,cy,cz,nrm)=>{ // nrm: 'z' (paret del fons) o '-x' (paret dreta)
    const pos=(dx,dy,dn)=> nrm==='z' ? V(cx+dx,cy+dy,cz+dn) : V(cx-dn,cy+dy,cz+dx);
    const N = nrm==='z' ? V(0,0,1) : V(-1,0,0);
    const plate=rMesh(el,new THREE.BoxGeometry(0.078,0.078,0.010),0xF7F7F4,'plastic',{cast:true}); plate.position.copy(pos(0,0,0.005)); plate.lookAt(plate.position.clone().add(N));
    const rec=rCyl(el,0.0205,0.006,pos(0,0,0.009),N,0xE6E6E2,'plastic',{seg:24});
    for(const dx of [-0.0095,0.0095]) rCyl(el,0.0026,0.004,pos(dx,0,0.0122),N,0x222222,'plastic',{seg:10});
    for(const dy of [-0.016,0.016]){ const c=rMesh(el,new THREE.BoxGeometry(0.010,0.004,0.004),0xC0C3C6,'nickel'); c.position.copy(pos(0,dy,0.0125)); c.lookAt(c.position.clone().add(N)); }
  };
  rBox('rits_bases_cap',0.52,0.76,16.00,16.12,RI.z0,-4.69,0xEEEEEA,'plastic',{cast:true,pick:true});
  schuko('rits_bases_cap',0.58,16.06,-4.69,'z'); schuko('rits_bases_cap',0.70,16.06,-4.69,'z');
  rPlane('rits_bases_cap',0.16,0.016,V(0.64,16.135,-4.689),V(0,0,1),textTex(['Capçalera RTV · circuit 16 A'],{w:512,h:52,size:30}));
  rBox('rits_bases_srv',3.30,3.34,16.04,16.16,-4.02,-3.72,0xEEEEEA,'plastic',{cast:true,pick:true});
  schuko('rits_bases_srv',3.30,16.10,-3.80,'-x'); schuko('rits_bases_srv',3.30,16.10,-3.94,'-x');
  rPlane('rits_bases_srv',0.20,0.016,V(3.2995,16.172,-3.87),V(-1,0,0),textTex(['Bases de servei · 16 A'],{w:512,h:52,size:30}));
  /* enllumenat */
  const LM='rits_llum';
  rBox(LM,1.45,1.55,17.545,17.6,-4.20,-3.00,0xEEF0F1,'paint',{pick:true,ritsPart:'roof'});
  const dif=rMesh(LM,new THREE.CylinderGeometry(0.05,0.05,1.18,20,1,false,Math.PI/2,Math.PI).rotateX(Math.PI/2),0xF4F4F0,{roughness:0.35,metalness:0},{glow:true,ritsPart:'roof'}); dif.position.set(1.5,17.545,-3.6); dif.scale.set(1,0.55,1);
  RG.lumGlow.push(dif);
  rBox(LM,2.01,2.09,16.08,16.16,-2.495,-2.48,0xF7F7F4,'plastic',{ritsPart:'front',pick:true}); rBox(LM,2.035,2.065,16.10,16.14,-2.50,-2.495,0xE0E0DC,'plastic',{ritsPart:'front'});
  const EM='rits_emerg';
  rBox(EM,3.29,3.34,16.86,16.95,-2.78,-2.62,0xF5F5F2,'plastic',{pick:true,cast:true});
  rBox(EM,3.287,3.29,16.865,16.885,-2.76,-2.64,0xE8F5E9,'plastic',{glow:true});
  rPlane(EM,0.10,0.04,V(3.2865,16.92,-2.70),V(-1,0,0),textTex(['← SORTIDA'],{w:256,h:96,size:50,bg:'#2E7D32',fg:'#FFFFFF',bold:[true]}));
  rCyl(EM,0.003,0.003,V(3.287,16.875,-2.63),V(-1,0,0),0x43A047,'plastic',{led:0x2E7D32});
  /* ventilació alta */
  const VE='rits_vent';
  for(const xx of [3.336,3.464]){ const nx = xx<3.4 ? -1 : 1;
    rBox(VE,xx-0.006,xx+0.006,16.72,16.88,-4.43,-4.17,0xD7DADC,'plastic',{pick:true});
    for(let i=0;i<5;i++) rBox(VE,xx+nx*0.006-0.004,xx+nx*0.006+0.004,16.74+i*0.03,16.75+i*0.03,-4.42,-4.18,0x8D9399,'plastic'); }
  /* placa d'identificació */
  rBox('rits_placa',3.335,3.34,16.35,16.55,-3.50,-3.30,0xFFFFFF,'paint',{pick:true});
  rPlane('rits_placa',0.196,0.196,V(3.3345,16.45,-3.40),V(-1,0,0),textTex(['RITS','Recinte d\'instal·lacions','de telecomunicació superior','EXEMPLE DIDÀCTIC','Sense número de registre oficial'],{w:512,h:512,fs:[96,34,34,46,26],bold:[true,false,false,true,false],bg:'#FFFFFF',fg:'#0D47A1',border:'#0D47A1',bw:10}));
  /* llums */
  const sp=new THREE.SpotLight(0xFFF3E0,0,3.3,1.2,0.75,1.6); sp.position.set(1.5,17.50,-3.6); sp.target.position.set(1.5,15.0,-3.62);
  sp.castShadow=true; sp.shadow.mapSize.set(1024,1024); sp.shadow.bias=-0.0004; sp.shadow.normalBias=0.012; sp.shadow.camera.near=0.05; sp.shadow.camera.far=3.4;
  sp.visible=false; (ROOT||scene).add(sp); (ROOT||scene).add(sp.target); RG.spot=sp;
}

/* =====================================================================
   ENTRADA DES DE LES ANTENES I SORTIDA CAP A LA DISTRIBUCIÓ
   ===================================================================== */
const PE=0x1C1D1F, WH=0xF4F3EF;
const RFT={};   // taules de marcs dels corrugats (per a recorreguts de cables)
function buildRITSEntry(){
  /* sistema de captació complet (torre, antenes, parabòlica) */
  buildAntennas();
  const TX=ANT.TX, TZ=ANT.TZ, MX=TX+0.55;          // boca del tub d'enllaç (coll de cigne cap avall)
  /* enllaç superior (RD 346/2011): 2 tubs corrugats negres de Ø40 mm, paral·lels (el recorregut és al pla z = TZ):
     el 1 porta TDT, DAB i FM; el 2, les dues sortides de l'LNB. Des del peu de la torre fins al passamurs. */
  const ER=0.020, EZ=[TZ-0.025,TZ+0.025];
  const ext=z=>[[MX,15.62,z],[MX,15.82,z],[MX+0.18,15.82,z],[MX+0.18,15.06,z],[-0.62,15.06,z],[-0.62,16.95,z],[-0.40,16.95,z]];
  const ET=EZ.map(z=>corrTube('canal_enllac_sup',ext(z),ER,{cut:[2.70,3.30],cutDir:V(0,1,0.35),cr:0.085,mouth1:false})); RFT.ext=ET[0];
  for(const z of EZ){
    for(const x of [-3.45,-2.75,-2.0,-1.25]) clampAt('canal_enllac_sup',V(x,15.06,z),V(1,0,0),V(0,1,0),ER);
    for(const y of [15.5,16.2]) clampAt('canal_enllac_sup',V(-0.62,y,z),V(0,1,0),V(1,0,0),ER,{stand:0.16});
  }
  rCyl('canal_enllac_sup',0.010,0.80,V(MX+0.18,15.40,TZ+0.07),UP,0xA7ADB2,'galv');
  rBox('canal_enllac_sup',MX+0.14,MX+0.22,15.0,15.012,TZ+0.03,TZ+0.11,0xA7ADB2,'galv');
  for(const [z,d] of [[EZ[1],0.045],[EZ[0],0.05]]) clampAt('canal_enllac_sup',V(MX+0.18,15.62,z),V(0,1,0),V(0,0,-1),ER,{stand:d});   // el tub 1 es lliga al 2
  /* passamurs a través de la paret esquerra */
  const sl=rCyl('reg_enllac_sup',0.05,0.20,V(-0.40,16.95,-3.5),V(1,0,0),0xC7CBCF,'pvc',{open:true,seg:24,cast:true,pick:true}); sl.material.side=THREE.DoubleSide;
  rCyl('reg_enllac_sup',0.075,0.012,V(-0.466,16.95,-3.5),V(1,0,0),0xC7CBCF,'pvc',{seg:24});
  rCyl('reg_enllac_sup',0.052,0.006,V(-0.498,16.95,-3.5),V(1,0,0),0x2B2B2B,'rubber',{open:true,seg:24}).material.side=THREE.DoubleSide;
  /* registre d'enllaç interior amb tapa */
  const RC=0xD5D9DC, R='reg_enllac_sup';
  rBox(R,-0.34,-0.205,17.095,17.10,-3.70,-3.40,RC,'plastic',{pick:true,cast:true}); rBox(R,-0.34,-0.205,16.80,16.805,-3.70,-3.40,RC,'plastic',{pick:true,cast:true});
  rBox(R,-0.34,-0.205,16.805,17.095,-3.70,-3.695,RC,'plastic',{pick:true,cast:true}); rBox(R,-0.34,-0.205,16.805,17.095,-3.405,-3.40,RC,'plastic',{pick:true,cast:true});
  const lid=rBox(R,-0.205,-0.199,16.795,17.105,-3.705,-3.395,0xC9CED2,'plastic',{lidOf:R,pick:true,cast:true}); G.lids.push(lid);
  for(const [y,z] of [[16.82,-3.68],[16.82,-3.42],[17.08,-3.68],[17.08,-3.42]]) rCyl(R,0.006,0.004,V(-0.197,y,z),V(1,0,0),0x8A9096,'steel',{lidOf:R});
  rPlane(R,0.22,0.03,V(-0.1985,17.05,-3.55),V(1,0,0),textTex(['Registre d\'enllaç superior'],{w:512,h:70,size:34,bg:'#ECEFF1'}),{lidOf:R});
  rBox(R,-0.33,-0.30,16.83,17.07,-3.585,-3.515,0x9EA3A8,'plastic');      // suport de les unions
  /* quatre coaxials exteriors: antena → torre → gassa de goteig → boca → tub → registre */
  const SV=[['tdt','cab_capt','capt_mast','capt_tube','antena','TDT'],['dab','cab_dab','dab_mast','dab_tube','antena_dab','DAB'],['fm','cab_fm','fm_mast','fm_tube','antena_fm','FM'],['sat','cab_sat','sat_1','sat_2','lnb','SAT A'],['sat2','cab_sat2','satb_1','satb_2','lnb','SAT B']];
  /* corrugat interior del RITS: cinc cables en anell, separats 72° */
  const RING=[0,1,2,3,4].map(i=>{ const a=(90+72*i)*Math.PI/180; return [0.016*Math.cos(a),0.016*Math.sin(a)]; });
  /* tubs d'enllaç (Ø40, Ø interior 32 mm): 3 cables a 120° al tub 1 i 2 cables al tub 2; [tub, dn, db] */
  const OFFE={tdt:[0,0,0.0055], fm:[0,-0.0048,-0.0028], dab:[0,0.0048,-0.0028], sat:[1,-0.005,0], sat2:[1,0.005,0]};
  const inT={};
  for(const [k,el,k1,,from] of SV){ const [ti,dn,db]=OFFE[k]; const zb=ANT.ZB[k], zc=EZ[ti];
    const pts=[...ANT.cab[k], [TX+0.24,dn>0?15.35:15.375,zb], [MX+dn-0.07,dn>0?15.35:15.375,zc-db], [MX+dn,15.47,zc-db], [MX+dn,15.62,zc-db]];
    rCable(k1,el,pts,PE,'pe',{from,to:'canal_enllac_sup',cr:0.035});
    inT[k]=insidePath(ET[ti].ft,0,ET[ti].L,dn,db); }
  /* unions F‑F: s'assignen per ordre d'arribada (de dalt a baix) perquè els cables no es creuin */
  const UY=[17.05,17.00,16.95,16.90,16.85];
  const ord=SV.map(x=>x[0]).sort((a,b)=>{ const A=inT[a][inT[a].length-1], B=inT[b][inT[b].length-1]; return (B.y-A.y)||(A.z-B.z); });
  const OFFI=RING;   // (dn,db) dins el corrugat interior, de la unió superior a la inferior
  RFT.cinStart={}; RFT.cinOff={}; RFT.ffY={};
  ord.forEach((k,r)=>{ const [,el,,k2]=SV.find(x=>x[0]===k); const y=UY[r];
    const U='rits_ff', uc=V(-0.27,y,-3.55);
    rHex(U,0.00675,0.015,uc,V(0,0,1),NI,'nickel',{pick:true});
    for(const s of [1,-1]) rCyl(U,0.00475,0.006,uc.clone().add(V(0,0,s*0.0105)),V(0,0,1),NI,'nickel');
    const tipE=uc.clone().add(V(0,0,0.0135)), tipI=uc.clone().add(V(0,0,-0.0135));
    const cE=fMaleFree(U,tipE,V(0,0,1)), cI=fMaleFree(U,tipI,V(0,0,-1));
        rCable(k2,el,[...inT[k],[-0.27,y,-3.47],cE],PE,'pe',{from:'canal_enllac_sup',to:'rits_ff',via:'canal_enllac_sup',cr:0.02});
    const [dn,db]=OFFI[r], zI=-3.681+0.0125*r, xI=-0.27+dn;
    RFT.cinStart[k]=[cI,[-0.27,y,zI],[xI,16.80,-3.65+db]]; RFT.cinOff[k]=[dn,db]; RFT.ffY[k]=y;   // surt recte de la unió, gira avall i entra al corrugat
  });
  cableTag('cab_capt',V(-0.285,RFT.ffY.tdt,-3.44),V(0,1,0),'Antena TDT',V(1,0,0));
  /* tub corrugat d'entrada a la capçalera */
  const cin=[[-0.27,16.795,-3.65],[-0.27,16.70,-3.65],[-0.27,16.70,-4.64],[1.40,16.70,-4.64],[1.40,16.60,-4.64]];
  RFT.cin=corrTube('rits_corr_in',cin,0.035,{cut:[1.90,2.50],cutDir:V(0,0.3,1),cr:0.07});
  for(const z of [-3.95,-4.35]) clampAt('rits_corr_in',V(-0.27,16.70,z),V(0,0,1),V(1,0,0),0.035,{stand:0.07});
  for(const x of [0.45,1.25]) clampAt('rits_corr_in',V(x,16.70,-4.64),V(1,0,0),V(0,0,1),0.035,{stand:0.09});
  symSprite('rits_corr_in',V(0.20,16.80,-4.55),'〰 RF entrada','#8D5A1A');
  /* tub corrugat de sortida cap a la canalització principal */
  const cout=[[2.30,15.45,RZ],[2.30,15.30,RZ],[RX.rtv,15.30,RZ],[RX.rtv,14.95,RZ]];   // continua el tub de RTV de la principal (Ø50)
  RFT.cout=corrTube('rits_corr_out',cout,RPR,{cut:[0.55,1.15],cutDir:V(0,0.3,1),cr:0.08,mouth1:false});
  for(const x of [1.85,Math.max(1.0,RX.rtv+0.15)]) clampAt('rits_corr_out',V(x,15.30,RZ),V(1,0,0),V(0,0,1),RPR,{stand:0.17});
  clampAt('rits_corr_out',V(2.30,15.40,RZ),V(0,1,0),V(0,0,1),RPR,{stand:0.17});
  symSprite('rits_corr_out',V(1.45,15.45,-4.50),'〰 RF distribució','#1E4FAE');
  /* tubs de la canalització principal sense ús al RITS (TBA, fibra, parells, reserva): tapats (al RITU, els de RITS_OPEN porten cables) */
  for(const k of ['tba1','fo','tba2','pt','res']){ const x=RX[k];
    corrTube('canal_principal',[[x,14.95,RZ],[x,15.30,RZ]],RPR,{mouth1:false,mouth0:false});
    if(!RITS_OPEN.includes(k)) rCyl('canal_principal',RPR+0.006,0.03,V(x,15.31,RZ),UP,0x2B2B2B,'rubber'); }
  /* sortida dels dos cables de distribució al final del tub (els cables es fan amb cada capçalera) */
  for(const [c,dn] of [['a',-0.012],['b',0.012]]){ const inP=insidePath(RFT.cout.ft,0,RFT.cout.L,dn,0); RITS_EXIT[c]=inP[inP.length-1].clone(); }
}

/* =====================================================================
   VARIANTS DE CAPÇALERA
   ===================================================================== */
function bond(pts){ return polyR('rits_equip',pts,0.004,0xFFFFFF,'gy',{cr:0.02,hc:RFN.pe}); }
function cord(el,pts){ return polyR(el,pts,0.0035,0x1E1E1E,'pvc',{cr:0.03,hc:RFN.ac}); }
function euroPlug(el, x, y){ // clavilla europea (sense terra) endollada a la base del fons
  rCyl(el,0.0175,0.036,V(x,y,-4.672),V(0,0,1),0x1E1E1E,'rubber',{seg:20,cast:true});
  rBox(el,x-0.012,x+0.012,y-0.03,y-0.016,-4.678,-4.664,0x1E1E1E,'rubber');
  return V(x,y-0.03,-4.671);
}
function tex12(lines,o){ return textTex(lines,o); }
/* =====================================================================
   MESCLADOR TERR + 2 SAT (model fidel a l'exemple Televes ref. 740710)
   Unitats locals: mil·límetres. Origen: centre del cos a la cara posterior
   (z = 0 contra la paret, +z cap endavant, +y amunt, +x a la dreta).
   Mides del fabricant: 98 × 76 × 27 mm (amplada amb orelles × alçada amb
   connectors × fondària), 194 g, xassís de zamac, connectors F.
   ===================================================================== */
const MIX740710 = {
  W:98, H:76, D:27, BODY_H:55, PORT_DX:24, PORT_Z:13.5, TIP:38,
  ports:{ in:{sa:-24, ter:0, sb:24}, out:{a:-24, c:0, b:24} },
  /* etiqueta frontal: icones i textos de l'aparell (sense logotip de marca) */
  labelCanvas(){
    const c=document.createElement('canvas'); c.width=1320; c.height=720; const g=c.getContext('2d');
    g.fillStyle='#F3F3F1'; g.fillRect(0,0,1320,720);
    g.strokeStyle='#1B1B1B'; g.fillStyle='#1B1B1B'; g.lineCap='round'; g.lineJoin='round';
    const font=(w,s)=>{ g.font=`${w} ${s}px Arial, Helvetica, sans-serif`; };
    const arrowDown=(x,y0,y1,lw)=>{ g.lineWidth=lw; g.beginPath(); g.moveTo(x,y0); g.lineTo(x,y1-10); g.stroke(); g.beginPath(); g.moveTo(x-11,y1-18); g.lineTo(x,y1); g.lineTo(x+11,y1-18); g.closePath(); g.fill(); };
    const arrowUp=(x,y0,y1)=>{ g.lineWidth=5; g.beginPath(); g.moveTo(x,y0); g.lineTo(x,y1+10); g.stroke(); g.beginPath(); g.moveTo(x-9,y1+16); g.lineTo(x,y1); g.lineTo(x+9,y1+16); g.closePath(); g.fill(); };
    /* icona d'entrada: caixa oberta per dalt amb fletxa que hi entra */
    const iconIn=(x,y,ter)=>{ g.lineWidth=7; g.beginPath(); g.moveTo(x-30,y-28); g.lineTo(x-30,y+30); g.lineTo(x+30,y+30); g.lineTo(x+30,y-28); g.stroke();
      g.beginPath(); g.moveTo(x-38,y-28); g.lineTo(x-22,y-28); g.moveTo(x+22,y-28); g.lineTo(x+38,y-28); g.stroke();
      arrowDown(x,y-44,y+18,7); if(ter){ g.lineWidth=5; for(const [dy,w] of [[-38,16],[-30,11]]){ g.beginPath(); g.moveTo(x-w,y+dy); g.lineTo(x+w,y+dy); g.stroke(); } } };
    /* icona de sortida: caixa oberta per baix amb fletxa que en surt */
    const iconOut=(x,y)=>{ g.lineWidth=7; g.beginPath(); g.moveTo(x-30,y+28); g.lineTo(x-30,y-30); g.lineTo(x+30,y-30); g.lineTo(x+30,y+28); g.stroke();
      g.beginPath(); g.moveTo(x-38,y+28); g.lineTo(x-22,y+28); g.moveTo(x+22,y+28); g.lineTo(x+38,y+28); g.stroke(); arrowDown(x,y-16,y+44,7); };
    const dc=(x,y,left)=>{ arrowUp(left?x:x+70,y+20,y-22); font('700',30); g.textAlign=left?'left':'right'; g.fillText('DC',left?x+16:x+56,y+10); };
    g.textBaseline='middle';
    /* fila superior: SAT/A · TER · SAT/B */
    iconIn(150,90); dc(205,82,true); font('700',36); g.textAlign='center'; g.fillText('SAT/A',150,165);
    iconIn(660,90,true); g.fillText('TER',660,165);
    iconIn(1170,90); dc(1040,82,false); g.textAlign='center'; g.fillText('SAT/B',1170,165);
    /* zona central: designació i rang de freqüències */
    font('800',96); g.textAlign='center'; g.fillText('TER + 2 SAT',660,292);
    font('700',46); g.textAlign='left'; g.fillText('TER + 2 SAT MIXER',90,400);
    font('400',44); g.textAlign='right'; g.fillText('47-790 / 950-2400 MHz',1230,400);
    g.lineWidth=4; g.beginPath(); g.moveTo(90,432); g.lineTo(1230,432); g.stroke();
    font('700',42); g.textAlign='left'; g.fillText('Ref. 740710',90,468); font('400',42); g.fillText('ESW201LTE',370,468);
    font('400',34); g.textAlign='right'; g.fillText('0715',1230,470);
    /* fila inferior: SAT/A + TER · CE · SAT/B + TER */
    font('700',36); g.textAlign='center'; g.fillText('SAT/A + TER',175,548); iconOut(150,625); dc(205,640,true);
    font('400',92); g.textAlign='center'; g.fillText('CE',660,628);
    font('700',36); g.textAlign='center'; g.fillText('SAT/B + TER',1145,548); iconOut(1170,625); dc(1040,640,false);
    return c;
  },
  /* peces geomètriques: [{geo, color, mat, part}] en mm locals */
  parts(){
    const P=[], ZK=0xBFC3C6, NI=0xC7CACD;
    const add=(geo,color,mat,part)=>{ P.push({geo,color,mat,part}); return geo; };
    const rr=(w,h,r)=>{ const s=new THREE.Shape(), x=-w/2, y=-h/2; s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r); s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h); s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r); s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y); return s; };
    /* cos: base de zamac (78 × 55) amb vores bisellades */
    let g=new THREE.ExtrudeGeometry(rr(76,53,3),{depth:15,bevelEnabled:true,bevelThickness:1.2,bevelSize:1,bevelSegments:2,curveSegments:6}); g.translate(0,0,1.2); add(g,ZK,'zamak','body');
    /* plataforma frontal elevada amb xamfrà (on va l'etiqueta) */
    g=new THREE.ExtrudeGeometry(rr(70,43,2.5),{depth:5.5,bevelEnabled:true,bevelThickness:2.2,bevelSize:2.2,bevelSegments:1,curveSegments:4}); g.translate(0,0,17.4); add(g,ZK,'zamak','body');
    /* nervis verticals a banda i banda de la plataforma (aspecte de fosa) */
    for(const sx of [-1,1]){ g=new THREE.BoxGeometry(2.2,46,4); g.translate(sx*38.2,0,18.5); add(g,0xB3B8BC,'zamak','body'); }
    /* orelles de fixació posteriors amb forat de Ø4 */
    for(const sx of [-1,1]){
      const s=new THREE.Shape(); const x0=36*sx, x1=49*sx, hw=21, r=4;
      if(sx>0){ s.moveTo(x0,-hw); s.lineTo(x1-r,-hw); s.quadraticCurveTo(x1,-hw,x1,-hw+r); s.lineTo(x1,hw-r); s.quadraticCurveTo(x1,hw,x1-r,hw); s.lineTo(x0,hw); s.lineTo(x0,-hw); }
      else { s.moveTo(x0,-hw); s.lineTo(x0,hw); s.lineTo(x1+r,hw); s.quadraticCurveTo(x1,hw,x1,hw-r); s.lineTo(x1,-hw+r); s.quadraticCurveTo(x1,-hw,x1+r,-hw); s.lineTo(x0,-hw); }
      const h=new THREE.Path(); h.absarc(44*sx,0,2.1,0,Math.PI*2,true); s.holes.push(h);
      g=new THREE.ExtrudeGeometry(s,{depth:6,bevelEnabled:true,bevelThickness:0.5,bevelSize:0.4,bevelSegments:1,curveSegments:16}); g.translate(0,0,0.5); add(g,ZK,'zamak','body');
    }
    /* bosses dels connectors i connectors F femella (3 a dalt, 2 a baix; la posició central inferior del motlle porta un tap) */
    const thread=()=>{ const pts=[V2(3.3,0),V2(5.6,0),V2(5.6,1.2),V2(4.7,1.2)]; const n=8, p=0.8, y0=1.4;
      for(let i=0;i<n;i++){ pts.push(V2(4.45,y0+i*p)); pts.push(V2(4.85,y0+i*p+p*0.5)); } pts.push(V2(4.45,y0+n*p)); pts.push(V2(4.45,y0+n*p+0.3)); pts.push(V2(3.2,y0+n*p+0.3)); pts.push(V2(3.2,0.4));
      return new THREE.LatheGeometry(pts,28); };
    const V2=(x,y)=>new THREE.Vector2(x,y);
    const TOP=27.5, L=this.TIP-TOP-3.5;              // el connector sobresurt fins a ±38 mm
    for(const [side,xs] of [[1,[-24,0,24]],[-1,[-24,0,24]]]) for(const x of xs){
      const tr=new THREE.Matrix4().makeTranslation(x,side*(TOP+1.75),this.PORT_Z); const rot=new THREE.Matrix4().makeRotationZ(side>0?0:Math.PI);
      g=new THREE.BoxGeometry(12,3.5,15); g.applyMatrix4(tr); add(g,ZK,'zamak','body');                                    // boss de fosa
      const base=new THREE.Matrix4().makeTranslation(x,side*(TOP+3.5),this.PORT_Z).multiply(rot);
      if(side<0 && x===0){                                                                   // posició del motlle sense ús: tap de plàstic negre
        g=new THREE.CylinderGeometry(5.0,5.3,5.5,24); g.translate(0,2.75,0); g.applyMatrix4(base); add(g,0x1E1E1E,'plastic','cap');
        g=new THREE.CylinderGeometry(4.2,5.0,0.8,24); g.translate(0,5.9,0); g.applyMatrix4(base); add(g,0x262626,'plastic','cap');
        continue; }
      g=new THREE.CylinderGeometry(5.6,5.6,1.4,6); g.translate(0,0.7,0); g.applyMatrix4(base); add(g,NI,'nickel','port');   // femella hexagonal
      g=thread(); g.scale(1,L/8,1); g.applyMatrix4(base); add(g,NI,'nickel','port');                                           // cos roscat 3/8"
      g=new THREE.CylinderGeometry(3.15,3.15,0.6,20); g.translate(0,L-0.6,0); g.applyMatrix4(base); add(g,0xF0EFE8,'plastic','port'); // dielèctric
      g=new THREE.CylinderGeometry(0.75,0.75,0.7,12); g.translate(0,L-0.5,0); g.applyMatrix4(base); add(g,0x262626,'plastic','port');  // contacte central
    }
    /* etiqueta adhesiva */
    g=new THREE.PlaneGeometry(68,37); g.translate(0,0,25.12); add(g,0xFFFFFF,'label','label');
    return P;
  }
};

/* model fidel del mesclador TER + 2 SAT a mida real; cx, cy: centre del cos a la placa */
function buildMix740710(cx,cy){
  if(MODELS.mix.scene){                                                    // model glTF (models/mesclador.glb), del plànol CAD
    const MX='cap_mix', ms=placeModel('mix',MX,cx,cy,ZP); G.pick.push(ms[0],ms[1]||ms[0]);
    halo(ms[0], new THREE.BoxGeometry(0.1,0.06,0.025).translate(cx,cy,ZP+0.0125), RFN.eq);
    const q=n=>{ const v=modelPoint('mix',n); return V(cx+v.x,cy+v.y,ZP+v.z); };
    const fe=q('forat_e'), fd=q('forat_d');
    for(const f of [fe,fd]){ rCyl(MX,0.0034,0.0016,f.clone().add(V(0,0,0.0008)),V(0,0,1),0x9AA0A6,'steel',{seg:20});   // cargols de fixació
      const sl=rMesh(MX,new THREE.BoxGeometry(0.0044,0.0007,0.0006),0x50555A,'steel'); sl.position.copy(f).add(V(0,0,0.0017)); }
    return {I:{sa:q('sa'), ter:q('ter'), sb:q('sb')}, O:{a:q('oa'), c:q('oc'), b:q('ob')}, screwR:fd.clone().add(V(0,0,0.0017))};
  }
  const MX='cap_mix', k=0.001, M=new THREE.Matrix4().makeTranslation(cx,cy,ZP).multiply(new THREE.Matrix4().makeScale(k,k,k));
  const tex=MIX740710._tex || (MIX740710._tex=canvasTex(1320,720,g=>g.drawImage(MIX740710.labelCanvas(),0,0)));
  const bodies=[];
  for(const p of MIX740710.parts()){ p.geo.applyMatrix4(M);
    const m=rMesh(MX,p.geo,p.color, p.mat==='label' ? {roughness:0.55,metalness:0,map:tex} : p.mat, {cast:p.part!=='label'});
    if(p.part==='body') bodies.push(m); }
  for(const m of bodies.slice(0,2)) G.pick.push(m);
  halo(bodies[0], new THREE.BoxGeometry(0.102,0.059,0.029).translate(cx,cy,ZP+0.0135), RFN.eq);
  for(const sx of [-1,1]){ rCyl(MX,0.0034,0.0016,V(cx+sx*0.044,cy,ZP+0.0076),V(0,0,1),0x9AA0A6,'steel',{seg:20});
    const sl=rMesh(MX,new THREE.BoxGeometry(0.0044,0.0007,0.0006),0x50555A,'steel'); sl.position.set(cx+sx*0.044,cy,ZP+0.0086); }
  const P=(x,s)=>V(cx+x*k, cy+s*MIX740710.TIP*k, ZP+MIX740710.PORT_Z*k);
  const pi=MIX740710.ports.in, po=MIX740710.ports.out;
  return {I:{sa:P(pi.sa,1), ter:P(pi.ter,1), sb:P(pi.sb,1)}, O:{a:P(po.a,-1), c:P(po.c,-1), b:P(po.b,-1)}, screwR:V(cx+0.044,cy,ZP+0.0086)};
}
function buildCapVariant(v){
  SCOPE=VAR;
  const ftI=RFT.cin.ft, LI=RFT.cin.L, Z=V(0,0,1), DN=V(0,-1,0);
  const IN={}; for(const k of ['tdt','dab','fm','sat','sat2']) IN[k]=[...RFT.cinStart[k],...insidePath(ftI,0,LI,RFT.cinOff[k][0],RFT.cinOff[k][1])];
  const inner=IN.tdt;
  /* port d'entrada d'un amplificador de FI: femella sempre (sense parabòlica queda lliure) + connector del cable (opcional) */
  const satPort=(el,cel,p,dir)=>{ fFemale(el,p,dir,{open:true}); return fMale(cel,p.clone().addScaledVector(dir,0.006),dir,cel); };
  /* sèrie T12 a mida real (catàleg Televes): mòdul 35 × 198 × 103 mm, font 70 × 198 × 92 mm, penjats d'un suport de paret.
     Y0: base dels equips; ZB: cara posterior; ZF: frontal dels mòduls; ZFF: frontal de les fonts. */
  const Y0=16.10, TH=0.198, Y1=Y0+TH, ZB=ZP+0.008, ZF=ZB+0.103, ZFF=ZB+0.092, DCY=Y0+0.088;
  /* ports F del frontal (plànol CAD del fabricant): centrats, dues entrades a dalt i dues sortides a baix separades 20 mm.
     El pont F de 48 mm (ref. 5074) uneix la boca superior d'un mòdul amb la inferior del següent: 35 × 20 mm, 29,7° (Z) */
  const PP={in1:[0,0.1665], in2:[0,0.1465], out1:[0,0.0515], out2:[0,0.0315]};
  const t12=(M,xc,lab,o={})=>{
    if(MODELS.t12.scene){                                                                                                      // model glTF (models/t12.glb)
      const ms=placeModel('t12',M,xc,Y0,ZB,{banda:o.band||0xF57C00});
      for(const m of ms) G.pick.push(m);
      halo(ms[0],new THREE.BoxGeometry(0.0352,TH+0.002,0.105).translate(xc,Y0+TH/2,ZB+0.0515),RFN.eq);
      rPlane(M,0.026,0.034,V(xc,Y0+0.112,ZF+0.0006),Z,textTex(lab,{w:104,h:136,fs:[24,30,20],bold:[true,true],bg:'#F4F4F2',fg:'#1A1A1A',border:'#9E9E9E',bw:3}));
    } else {
      const mb=rBox(M,xc-0.0172,xc+0.0172,Y0,Y1,ZB,ZF,o.col||0x1E1F22,'zamakDark',{pick:true,cast:true}); boxHalo(mb,RFN.eq);
      for(let k=0;k<8;k++) rBox(M,xc-0.0176,xc+0.0176,Y0+0.03+k*0.018,Y0+0.034+k*0.018,ZB+0.01,ZF-0.012,0x2A2B2F,'zamakDark');   // aletes de dissipació
      rBox(M,xc-0.0165,xc+0.0165,Y1-0.014,Y1-0.003,ZF,ZF+0.001,o.band||0xF57C00,'plastic');                                     // franja superior
      rPlane(M,0.026,0.008,V(xc,Y1-0.0085,ZF+0.0012),Z,textTex(['T12'],{w:104,h:32,size:26,bold:[true],bg:o.bandCss||'#F57C00',fg:'#1E1F22'}));
      rPlane(M,0.026,0.034,V(xc,Y0+0.112,ZF+0.0006),Z,textTex(lab,{w:104,h:136,fs:[24,30,20],bold:[true,true],bg:'#F4F4F2',fg:'#1A1A1A',border:'#9E9E9E',bw:3}));
      rCyl(M,0.0015,0.002,V(xc+0.010,Y0+0.135,ZF+0.001),Z,0x43A047,'plastic',{led:0x1B8F2E});
      rCyl(M,0.0035,0.003,V(xc-0.008,Y0+0.135,ZF+0.0015),Z,0xD0D3D6,'plastic');                                                  // ajust de guany
      for(const dx of [-0.008,0.008]) rBox(M,xc+dx-0.003,xc+dx+0.003,DCY-0.0025,DCY+0.0025,ZF,ZF+0.004,0x111111,'plastic');   // connectors de 24 V
    }
    /* ports: si el model porta objectes buits port_in1, port_in2, port_out1 i port_out2, s'agafen d'allà */
    const ports={}; for(const [k,[dx,dy]] of Object.entries(PP)){ const mp=modelPoint('t12','port_'+k); ports[k]=mp ? V(xc+mp.x,Y0+mp.y,ZB+mp.z) : V(xc+dx,Y0+dy,ZF); }
    return {xc,ports,M};
  };
  const fontBox=(x0,tag,left)=>{ const FN='cap_font';
    if(MODELS.font.scene){                                                                                                   // model glTF (models/font_t12.glb)
      const xc=x0+0.035, ms=placeModel('font',FN,xc,Y0,ZB); for(const m of ms) G.pick.push(m);
      halo(ms[0],new THREE.BoxGeometry(0.0702,TH+0.002,0.094).translate(xc,Y0+TH/2,ZB+0.046),RFN.dc);
      rPlane(FN,0.044,0.05,V(xc+0.00516,Y0+0.1165,ZFF+0.0012),Z,textTex([tag,'549812','24 V c.c. · 2,5 A','230 V ~ · 60 W','Classe II ▣'],{w:352,h:400,fs:[56,46,36,36,36],bold:[true,true],bg:'#202124',fg:'#ECEFF1'}));
      const d=modelPoint('font','dc'); return V(xc+d.x,Y0+d.y,ZB+d.z);
    }
    const fb=rBox(FN,x0,x0+0.07,Y0,Y1,ZB,ZFF,0x2A2C2F,'zamakDark',{pick:true,cast:true}); boxHalo(fb,RFN.dc);
    for(let i=0;i<9;i++) for(const x of [x0-0.0015,x0+0.0715]) rBox(FN,x-0.0015,x+0.0015,Y0+0.02+i*0.018,Y0+0.025+i*0.018,ZB+0.01,ZFF-0.01,0x3A3D41,'zamakDark');
    rBox(FN,x0+0.003,x0+0.067,Y1-0.014,Y1-0.003,ZFF,ZFF+0.001,0xF57C00,'plastic');
    rPlane(FN,0.026,0.008,V(x0+0.035,Y1-0.0085,ZFF+0.0012),Z,textTex(['T12'],{w:104,h:32,size:26,bold:[true],bg:'#F57C00',fg:'#1E1F22'}));
    rPlane(FN,0.058,0.072,V(x0+0.035,Y0+0.135,ZFF+0.0006),Z,textTex([tag,'549812','24 V c.c. · 2,5 A','230 V ~ · 60 W','Classe II ▣'],{w:232,h:288,fs:[36,30,24,24,24],bold:[true,true],bg:'#2A2C2F',fg:'#ECEFF1'}));
    rCyl(FN,0.0015,0.002,V(x0+0.035,Y0+0.185,ZFF+0.001),Z,0x43A047,'plastic',{led:0x1B8F2E});
    const sx = left ? x0+0.012 : x0+0.058, sy = DCM ? Y0+DCM.y : DCY;                                                           // a l'alçada dels mòduls
    rBox(FN,sx-0.006,sx+0.006,sy-0.0025,sy+0.0025,ZFF,ZFF+0.004,0x111111,'plastic');                                           // sortida de 24 V
    return V(sx,sy,ZFF+0.004); };
  const fontCord=(x,plugX,y)=>{ const pl=euroPlug('rits_cordo',plugX,16.06); cord('rits_cordo',[[x,Y0,ZB+0.04],[x,y,ZB+0.04],[x,y,-4.706],[plugX,y,-4.706],[plugX,y+0.02,-4.672],pl]); };
  /* latiguillos de 24 V entre mòduls veïns (bucle cap endavant, com a la instal·lació real) */
  const DCM=modelPoint('t12','dc'), DCO=DCM?0.0025:0.008;                     // connector d'alimentació del model glTF, si n'hi ha
  const dcp=m=>DCM ? V(m.xc+DCM.x,Y0+DCM.y,ZB+DCM.z) : V(m.xc,DCY,ZF+0.004);
  const dcChain=(pts)=>{ for(let i=0;i<pts.length-1;i++){ const a=pts[i], b=pts[i+1], sg=Math.sign(b.x-a.x)||1;
      const A=a.clone().add(V(i===0?0:DCO*sg,0,0)), B=b.clone().add(V(-DCO*sg,0,0));
      for(const [dy,col] of [[0.0016,0xC62828],[-0.0016,0x212121]]) polyR('cap_dc',[A.clone().add(V(0,dy,0)),A.clone().add(V(0.002*sg,dy,0.012)),B.clone().add(V(-0.002*sg,dy,0.012)),B.clone().add(V(0,dy,0))],0.0011,col,'pvc',{cr:0.005,hc:RFN.dc,pick:false});
      rBox('cap_dc',Math.min(A.x,B.x),Math.max(A.x,B.x),DCY-0.008,DCY+0.008,A.z,A.z+0.014,0x000000,{roughness:1,metalness:0},{opacity:0.0,pick:true}); } };
  /* suport de paret: dos perfils galvanitzats darrere dels equips */
  const rail=(x0,x1)=>{ for(const [ya,yb] of [[Y1-0.03,Y1-0.012],[Y0+0.012,Y0+0.03]]) rBox('cap_rail',x0,x1,ya,yb,ZP,ZB,0xC3C8CC,'galv',{pick:true,cast:true});
    for(const x of [x0+0.01,x1-0.01]) for(const yy of [Y1-0.021,Y0+0.021]) rHex('cap_rail',0.004,0.004,V(x,yy,ZB+0.002),Z,0x8D949A,'steel'); };
  /* mesclador MATV‑FI a mida real (98 × 65 × 27 mm): entrades a dalt, sortides a baix */
  const mixer=(x0,h,ins,outs,lines)=>{ const MX='cap_mix', y0=15.66, y1=y0+h, zc=ZP+0.0135, W=0.084;
    const b=rBox(MX,x0,x0+W,y0,y1,ZP,ZP+0.027,0xBFC4C8,'zamak',{pick:true,cast:true}); boxHalo(b,RFN.eq);
    for(const x of [x0-0.007,x0+W+0.007]){ rBox(MX,x-0.007,x+0.007,y0+h/2-0.01,y0+h/2+0.01,ZP,ZP+0.003,0xBFC4C8,'zamak'); rHex(MX,0.003,0.003,V(x,y0+h/2,ZP+0.0045),Z,0x8D949A,'steel'); }
    rPlane(MX,W-0.01,h-0.016,V(x0+W/2,y0+h/2,ZP+0.0273),Z,textTex(lines,{w:512,h:Math.round(512*(h-0.016)/(W-0.01)),fs:lines.map((_,i)=>i===0?58:40),bold:[true],bg:'#C9CDD1',fg:'#263238'}));
    rHex(MX,0.0045,0.003,V(x0+W-0.01,y1-0.01,ZP+0.0285),Z,0xC0C3C6,'nickel');                   // cargol de terra
    const I={}, O={}; for(const [k,x] of ins) I[k]=V(x,y1,zc); for(const [k,x] of outs) O[k]=V(x,y0,zc);
    return {I,O,earth:V(x0+W-0.01,y1-0.01,ZP+0.03)}; };
  /* cable de distribució dins del RITS: de la sortida fins al tub corrugat de sortida */
  const bajant=(c,start,via,from)=>{ const dn=c==='a'?-0.012:0.012; const inP=insidePath(RFT.cout.ft,0,RFT.cout.L,dn,0);
    rCable(`xd_rtv_${c}_r`,'xd_rtv',[start,...via,[2.30+dn,15.52,RZ],...inP],c==='a'?WH:PE,'pvc',{from,to:'canal_principal',via:'rits_corr_out',tram:'dist',hc:RFN.dist,cr:0.03});
    cableTag('xd_rtv',V(2.30+dn,15.505,RZ+0.002),V(c==='a'?-1:1,0,0),c==='a'?'Distribució 1':'Distribució 2'); };
  const jump=(key,pts,from,to)=>rCable(key,'cap_jump',pts,WH,'pvc',{from,to,cr:0.02});
  /* arribada d'un cable a un connector frontal (des de dalt i per davant) */
  const arrive=(p,yTop)=>[[p.x,yTop,p.z+0.04],[p.x,p.y,p.z+0.04],p];   // 4 cm rectes davant del connector i corba de 33 mm

  if(v==='A'){
    /* ---- centraleta programable amb FI (AVANT 12 PRO SAT, 532204): 201 × 120 × 42 mm ---- */
    const A='cap_avant', ZFA=ZP+0.042, zc=ZP+0.021, GR=0xC5CACE, AV=!!MODELS.avant.scene;
    /* punt d'un objecte buit del model glTF (models/avant.glb), o el valor per defecte del model procedural */
    const ap=(n,fb)=>{ const q=modelPoint('avant',n); return q ? V(1.45+q.x,16.30+q.y,ZP+q.z) : fb; };
    if(AV){
      const ms=placeModel('avant',A,1.45,16.30,ZP); for(const m of ms) G.pick.push(m);
      halo(ms[0],new THREE.BoxGeometry(0.204,0.124,0.044).translate(1.45,16.30,ZP+0.021),RFN.eq);
    } else {
      const body=rBox(A,1.3825,1.5175,16.25,16.35,ZP,ZFA,GR,'zamak',{pick:true,cast:true}); boxHalo(body,RFN.eq);
      for(const x0 of [1.3495,1.5175]){ const fl=rBox(A,x0,x0+0.033,16.24,16.36,ZP,ZP+0.035,GR,'zamak',{pick:true,cast:true}); boxHalo(fl,RFN.eq);
        for(const y of [16.25,16.35]) rCyl(A,0.00375,0.002,V(x0+0.0165,y,ZP+0.036),Z,0x55595D,'steel'); }
      for(let i=0;i<13;i++) rBox(A,1.390+i*0.0064,1.393+i*0.0064,16.2575,16.3425,ZFA,ZFA+0.006,GR,'zamak',{cast:true});   // aletes
      rPlane(A,0.0375,0.08,V(1.499,16.30,ZFA+0.0003),Z,textTex(['AVANT 12','PRO SAT','','532204'],{w:150,h:320,fs:[30,24,10,22],bold:[true,true],bg:'#C9CED2',fg:'#263238'}));
      rCyl(A,0.0095,0.005,V(1.499,16.285,ZFA+0.0025),Z,0xF57C00,'plastic',{seg:24});
      rPlane(A,0.125,0.01,V(1.45,16.346,ZFA+0.0063),Z,textTex(['1   2   3   4 · VHF+UHF   SAT'],{w:512,h:40,size:28,bg:'#C9CED2',fg:'#263238'}));
      rPlane(A,0.125,0.01,V(1.45,16.254,ZFA+0.0063),Z,textTex(['POWER      FM   TV   TV+SAT'],{w:512,h:40,size:26,bg:'#C9CED2',fg:'#263238'}));
      rCyl(A,0.0015,0.002,V(1.418,16.2625,ZFA+0.0065),Z,0x43A047,'plastic',{led:0x1B8F2E});
      rHex(A,0.004,0.004,V(1.534,16.285,ZP+0.037),Z,0xC0C3C6,'nickel');                     // cargol de terra
      rBox(A,1.390,1.404,16.244,16.25,zc-0.005,zc+0.005,0x2B2B2B,'plastic');
    }
    const ins=['in1','in2','in3','in4'].map((n,i)=>ap(n,V([1.4385,1.4555,1.4725,1.4895][i],16.35,zc)));
    const inEnd=fMale(A,ins[0],UP), dabEnd=fMale(A,ins[1],UP);
    for(let i=2;i<4;i++) fLoad(A,ins[i],UP,true);
    const sp=ap('sat',V(1.5065,16.35,zc));
    const satEnd=AV ? fMale('cab_sat_int',sp,UP,'cab_sat_int') : satPort(A,'cab_sat_int',sp,UP);   // entrada SAT (FI integrada); el model ja porta la femella
    const fmEnd=fMale(A,ap('fm',V(1.4725,16.25,zc)),DN);
    const tvEnd=fMale(A,ap('tv',V(1.4895,16.25,zc)),DN);                               // sortida TV (només terrestre)
    const tsEnd=fMale(A,ap('tvsat',V(1.5065,16.25,zc)),DN);                            // sortida TV+SAT
    /* cable de 230 V: clavilla C7 endollada a la presa «vuit» (C8) del lateral inferior */
    const pw=ap('power',V(1.397,16.244,zc));
    rBox('rits_cordo',pw.x-0.0075,pw.x+0.0075,pw.y-0.019,pw.y,pw.z-0.0065,pw.z+0.0065,0x1E1E1E,'rubber',{cast:true,pick:true});
    const pl=euroPlug('rits_cordo',0.70,16.06);
    cord('rits_cordo',[[pw.x,pw.y-0.019,pw.z],[pw.x,15.93,pw.z],[pw.x,15.93,-4.706],[0.70,15.93,-4.706],[0.70,15.95,-4.672],pl]);
    const top=(p)=>[[p.x,16.42,p.z],p];
    rCable('capt_in','cab_capt_int',[...inner,[1.42,16.52,-4.66],...top(inEnd)],WH,'pvc',{from:'rits_ff',to:'cap_avant',via:'rits_corr_in',cr:0.02});
    cableTag('cab_capt_int',V(inEnd.x,16.40,inEnd.z),V(-1,0,0),'TDT → entrada 1');
    rCable('dab_in','cab_dab_int',[...IN.dab,[1.44,16.52,-4.66],...top(dabEnd)],WH,'pvc',{from:'rits_ff',to:'cap_avant',via:'rits_corr_in',cr:0.02});
    rCable('fm_in','cab_fm_int',[...IN.fm,[1.36,16.50,-4.63],[1.33,16.42,-4.64],[1.33,16.20,-4.66],[1.44,16.19,zc+0.02],[fmEnd.x,16.20,zc+0.005],fmEnd],WH,'pvc',{from:'rits_ff',to:'cap_avant',via:'rits_corr_in',cr:0.02});
    cableTag('cab_fm_int',V(1.33,16.30,-4.64),V(-1,0,0),'FM → entrada FM');
    rCable('sat_in','cab_sat_int',[...IN.sat,[1.50,16.52,-4.66],...top(satEnd)],WH,'pvc',{from:'rits_ff',to:'cap_avant',via:'rits_corr_in',cr:0.02});
    cableTag('cab_sat_int',V(satEnd.x,16.40,satEnd.z),V(1,0,0),'SAT A → entrada SAT');
    /* segon amplificador de FI amb la seva font */
    rail(1.605,1.73);
    const fdc=fontBox(1.615,'Font');
    const fi=t12('cap_fi_2',1.7025,['FI','SAT B','508012'],{band:0x1565C0,bandCss:'#1565C0'});
    dcChain([fdc,dcp(fi)]);
    fontCord(1.65,0.58,15.90);
    const fiIn=satPort('cap_fi_2','cab_sat2_int',fi.ports.in1,Z);
    rCable('satb_in','cab_sat2_int',[...IN.sat2,[1.62,16.52,-4.62],...arrive(fiIn,16.40)],WH,'pvc',{from:'rits_ff',to:'cap_fi_2',via:'rits_corr_in',cr:0.02});
    cableTag('cab_sat2_int',V(fiIn.x,16.38,fiIn.z+0.03),V(1,0,0),'SAT B → FI 2',V(0,1,-1).normalize());
    const fiOut=fMale('cap_fi_2',fi.ports.out1,Z);
    /* mesclador MATV‑FI (745210) */
    const mx=mixer(2.258,0.065,[['terr',2.28],['sat',2.32]],[['out',2.30]],['745210','TERR        SAT','MATV + FI','OUT']);
    const mT=fMale('cap_mix',mx.I.terr,UP), mS=fMale('cap_mix',mx.I.sat,UP), mO=fMale('cap_mix',mx.O.out,DN);
    jump('cap_jump',[tvEnd,[tvEnd.x,16.17,zc],[1.55,16.05,-4.68],[2.20,15.86,-4.68],[mT.x,15.80,mT.z],mT],'cap_avant','cap_mix');
    cableTag('cap_jump',V(1.90,15.955,-4.68),V(0,-1,0),'TV → TERR',V(1,0,0),'cap_jump');
    jump('cap_jump_fi',[fiOut,[fiOut.x,fiOut.y,fiOut.z+0.04],[fiOut.x,16.04,-4.57],[2.30,15.92,-4.62],[mS.x,15.80,mS.z],mS],'cap_fi_2','cap_mix');
    cableTag('cap_jump',V(2.12,15.95,-4.60),V(0,-1,0),'FI 2 → SAT',V(1,0,-0.3).normalize(),'cap_jump_fi');
    /* cables de distribució: 1 directe de la centraleta (TV+SAT), 2 del mesclador */
    bajant('a',tsEnd,[[tsEnd.x,16.15,zc],[1.66,15.60,-4.66],[2.20,15.56,-4.66],[2.27,15.55,-4.64]],'cap_avant');
    bajant('b',mO,[[mO.x,mO.y-0.03,mO.z],[2.312,15.555,-4.645]],'cap_mix');
    { const ea=ap('terra',null);                                                         // born de terra de la centraleta
      if(ea) bond([[0.35,17.164,-4.700],[0.35,16.90,-4.688],[ea.x,16.90,-4.688],[ea.x,16.37,-4.700],[ea.x,ea.y+0.006,ea.z+0.003],[ea.x,ea.y+0.003,ea.z+0.001]]);
      else bond([[0.35,17.164,-4.700],[0.35,16.90,-4.688],[1.534,16.90,-4.688],[1.534,16.40,-4.688],[1.534,16.38,ZP+0.044],[1.534,16.295,ZP+0.044],[1.534,16.288,ZP+0.040]]); }
    bond([[0.20,17.164,-4.700],[0.20,15.80,-4.700],[2.34,15.80,-4.700],[2.34,15.74,-4.700],[mx.earth.x,mx.earth.y,mx.earth.z-0.002]]);
    symSprite(A,V(1.45,16.48,-4.60),'〰 RF','#8D5A1A',0.16);
    symSprite('cap_font',V(1.65,16.40,-4.55),'24 V c.c.','#E65100',0.20);
    symSprite('rits_cordo',V(1.00,15.86,-4.62),'⚡ 230 V c.a. · classe II','#C62828',0.30);
  } else {
    /* ---- capçalera de monocanals T12: F1 · FI 1 · FI 2 · TDT 10‑1 · DAB · FM · F2 ----
       Els mòduls de TDT es munten de dreta a esquerra (TDT 1 al costat de la DAB): així l'entrada superior lliure de la
       cadena en Z és la del TDT 1, on va el filtre LTE/5G, i la inferior lliure del TDT 10 es tanca amb una càrrega. */
    rail(1.38,2.05);
    const f1=fontBox(1.40,'Font 1',false), f2=fontBox(1.96,'Font 2',true);
    fontCord(1.43,0.58,15.93); fontCord(2.00,0.70,15.96);
    const XC=j=>1.4875+0.035*j;
    const M=[];
    M.push(t12('cap_fi_1',XC(0),['FI','SAT A','508012'],{band:0x1565C0,bandCss:'#1565C0'}));
    M.push(t12('cap_fi_2',XC(1),['FI','SAT B','508012'],{band:0x1565C0,bandCss:'#1565C0'}));
    for(let i=10;i>=1;i--) M.push(t12(`cap_t12_${i}`,XC(12-i),['UHF',`C${TDTCH[i-1]}`,'509812']));
    M.push(t12('cap_t12_dab',XC(12),['DAB','BIII','509012']));
    M.push(t12('cap_t12_fm',XC(13),['FM','87‑108','509012']));
    const TD=M.slice(2,12), TER=M.slice(2,14);                                        // TD: TDT 10 … TDT 1 (d'esquerra a dreta)
    /* alimentació: font 1 → FI 1, FI 2, TDT 10‑6; font 2 → FM, DAB, TDT 1‑5 */
    dcChain([f1,...M.slice(0,7).map(dcp)]); dcChain([f2,...M.slice(7,14).reverse().map(dcp)]);
    /* ponts F de 48 mm en Z (ref. 5074): de l'entrada/sortida superior d'un mòdul a la inferior del mòdul de la dreta */
    const bridge=(a,b)=>{ const PB='cap_ponts';
      const e=[a,b].map(p=>{ rHex(PB,0.0056,0.006,p.clone().addScaledVector(Z,0.003),Z,NI,'nickel');             // virolla del connector F ràpid
        rCyl(PB,0.0048,0.012,p.clone().addScaledVector(Z,0.012),Z,0xB5BABE,'zamak'); return p.clone().addScaledVector(Z,0.021); });
      const d=e[1].clone().sub(e[0]), mid=e[0].clone().add(e[1]).multiplyScalar(0.5);
      const bar=rMesh(PB,new THREE.BoxGeometry(d.length(),0.009,0.007),0xA9AEB3,'zamak',{cast:true}); bar.position.copy(mid); bar.rotation.z=Math.atan2(d.y,d.x); G.pick.push(bar); boxHalo(bar,RFN.capt);
      for(const p of e) rCyl(PB,0.0045,0.007,p,Z,0xA9AEB3,'zamak'); };
    for(let t=0;t<TD.length-1;t++) bridge(TD[t].ports.in1,TD[t+1].ports.in2);
    fLoad(TD[0].M,TD[0].ports.in2,Z,true);                                            // entrada lliure del TDT 10
    for(let t=0;t<TER.length-1;t++) bridge(TER[t].ports.out1,TER[t+1].ports.out2);
    fLoad(TER[0].M,TER[0].ports.out2,Z,false);                                        // sortida lliure del TDT 10
    const gOut=fMale('cap_t12_fm',TER[11].ports.out1,Z);                              // sortida MATV
    /* filtre LTE/5G (403201, 49 × 33 × 23 mm) endollat a l'entrada superior del TDT 1 */
    const FL='cap_filtre', fp=TD[9].ports.in1, fy=fp.y+0.004;
    rHex(FL,0.0068,0.0085,fp.clone().addScaledVector(Z,0.0078),Z,NI,'nickel');
    const flb=rBox(FL,fp.x-0.0165,fp.x+0.0165,fy-0.0115,fy+0.0115,fp.z+0.012,fp.z+0.061,0xC0C5C9,'zamak',{pick:true,cast:true}); boxHalo(flb,RFN.eq);
    rPlane(FL,0.03,0.02,V(fp.x,fy,fp.z+0.0612),Z,textTex(['LTE/5G','403201','≤694 MHz'],{w:150,h:100,fs:[30,24,22],bold:[true],bg:'#C0C5C9',fg:'#263238'}));
    const fOut=fMale(FL,fp.clone().addScaledVector(Z,0.061),Z);
    rCable('capt_in','cab_capt_int',[...inner,[1.42,16.56,-4.62],[fOut.x,16.42,-4.56],[fOut.x,fOut.y+0.012,fOut.z+0.03],[fOut.x,fOut.y,fOut.z+0.012],fOut],WH,'pvc',{from:'rits_ff',to:'cap_filtre',via:'rits_corr_in',cr:0.02});
    cableTag('cab_capt_int',V(fOut.x,16.40,-4.56),V(-1,0,0),'TDT → filtre → TDT 1',V(0,1,0));
    /* DAB i FM: entrada pròpia des de la seva antena */
    const dEnd=fMale('cap_t12_dab',M[12].ports.in1,Z), mEnd=fMale('cap_t12_fm',M[13].ports.in1,Z);
    fLoad('cap_t12_dab',M[12].ports.in2,Z,true); fLoad('cap_t12_fm',M[13].ports.in2,Z,true);
    rCable('dab_in','cab_dab_int',[...IN.dab,[1.50,16.55,-4.60],...arrive(dEnd,16.43)],WH,'pvc',{from:'rits_ff',to:'cap_t12_dab',via:'rits_corr_in',cr:0.02});
    rCable('fm_in','cab_fm_int',[...IN.fm,[1.52,16.535,-4.60],...arrive(mEnd,16.41)],WH,'pvc',{from:'rits_ff',to:'cap_t12_fm',via:'rits_corr_in',cr:0.02});
    cableTag('cab_dab_int',V(dEnd.x,16.36,dEnd.z+0.03),V(-1,0,0),'DAB',V(0,1,0));
    cableTag('cab_fm_int',V(mEnd.x,16.36,mEnd.z+0.03),V(1,0,0),'FM',V(0,1,0));
    /* amplificadors de FI: entrada des de l'LNB (si hi ha parabòlica) */
    const aIn=satPort('cap_fi_1','cab_sat_int',M[0].ports.in1,Z), bIn=satPort('cap_fi_2','cab_sat2_int',M[1].ports.in1,Z);
    rCable('sat_in','cab_sat_int',[...IN.sat,[1.30,16.585,-4.60],...arrive(aIn,16.42)],WH,'pvc',{from:'rits_ff',to:'cap_fi_1',via:'rits_corr_in',cr:0.02});
    rCable('satb_in','cab_sat2_int',[...IN.sat2,[1.32,16.60,-4.58],...arrive(bIn,16.40)],WH,'pvc',{from:'rits_ff',to:'cap_fi_2',via:'rits_corr_in',cr:0.02});
    cableTag('cab_sat_int',V(aIn.x,16.41,aIn.z+0.03),V(-1,0,0),'SAT A',V(0,1,0));
    cableTag('cab_sat2_int',V(bIn.x,16.39,bIn.z+0.03),V(1,0,0),'SAT B',V(0,1,0));
    const aOut=fMale('cap_fi_1',M[0].ports.out1,Z), bOut=fMale('cap_fi_2',M[1].ports.out1,Z);
    /* mesclador TERR + 2 SAT (740710) */
    const mx=buildMix740710(2.30,15.696);
    const mp=(p,dir)=>fMale('cap_mix',p.clone().addScaledVector(dir,-0.006),dir);      // connector F mascle roscat al port femella
    const mT=mp(mx.I.ter,UP), mA=mp(mx.I.sa,UP), mB=mp(mx.I.sb,UP);
    const oA=mp(mx.O.a,DN), oB=mp(mx.O.b,DN);
    jump('cap_jump',[gOut,[gOut.x,gOut.y,gOut.z+0.04],[gOut.x,16.06,-4.58],[2.20,15.92,-4.64],[mT.x,15.80,mT.z],mT],'cap_t12_fm','cap_mix');
    cableTag('cap_jump',V(2.13,15.94,-4.63),V(0,-1,0),'MATV → TER',V(1,0,-0.3).normalize(),'cap_jump');
    jump('cap_jump_fia',[aOut,[aOut.x,aOut.y,aOut.z+0.04],[aOut.x,16.07,-4.575],[1.60,16.04,-4.60],[2.20,15.95,-4.64],[mA.x,15.80,mA.z],mA],'cap_fi_1','cap_mix');
    jump('cap_jump_fib',[bOut,[bOut.x,bOut.y,bOut.z+0.04],[bOut.x,16.055,-4.585],[1.62,16.025,-4.62],[2.25,15.935,-4.66],[mB.x,15.80,mB.z],mB],'cap_fi_2','cap_mix');
    cableTag('cap_jump',V(1.56,16.045,-4.60),V(0,-1,0),'FI 1 → SAT/A',V(1,0,0),'cap_jump_fia');
    /* cables de distribució: SAT/A + TER → cable 1 (blanc), SAT/B + TER → cable 2 (negre) */
    bajant('a',oA,[[oA.x,oA.y-0.025,oA.z],[2.288,15.55,-4.66]],'cap_mix');
    bajant('b',oB,[[oB.x,oB.y-0.025,oB.z],[2.312,15.55,-4.66]],'cap_mix');
    bond([[0.35,17.164,-4.700],[0.35,16.90,-4.686],[2.04,16.90,-4.686],[2.04,16.29,-4.70],[2.04,16.277,ZB+0.004]]);
    /* connexió equipotencial: terminal d'anella sota el cargol de fixació dret del mesclador */
    bond([[0.20,17.164,-4.700],[0.20,15.58,-4.700],[2.42,15.58,-4.700],[2.42,15.68,-4.700],[2.36,15.696,ZP+0.006],[mx.screwR.x+0.003,mx.screwR.y,ZP+0.0068]]);
    { const t=rMesh('rits_equip',new THREE.TorusGeometry(0.004,0.0011,8,20),0xC98A3A,'copper'); t.position.set(mx.screwR.x,mx.screwR.y,ZP+0.0068); }
    symSprite('cap_t12_5',V(1.72,16.48,-4.55),'〰 RF','#8D5A1A',0.16);
    symSprite('cap_font',V(1.435,16.40,-4.55),'24 V c.c.','#E65100',0.20); symSprite('cap_font',V(1.995,16.40,-4.55),'24 V c.c.','#E65100',0.20);
    symSprite('rits_cordo',V(0.80,15.86,-4.62),'⚡ 230 V c.a. · classe II','#C62828',0.30);
  }
  SCOPE=null; CAPBUILT=v;
}
let CAPBUILT=null;
function clearScope(){
  const rm=new Set(VAR.meshes);
  for(const m of VAR.meshes){ if(m.parent) m.parent.remove(m); m.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material && o.material!==proxyMat) o.material.dispose(); }); }
  G.meshes=G.meshes.filter(m=>!rm.has(m));
  for(const k of Object.keys(G.byEl)){ const a=G.byEl[k].filter(m=>!rm.has(m)); if(a.length) G.byEl[k]=a; else delete G.byEl[k]; }
  G.pick=G.pick.filter(p=>!rm.has(p) && !rm.has(p.parent));
  G.lids=G.lids.filter(m=>!rm.has(m));
  const ex=new Set(VAR.extra);
  for(const s of VAR.extra){ if(s.parent) s.parent.remove(s); if(s.isSprite) s.material.dispose(); }
  RG.sprites=RG.sprites.filter(s=>!ex.has(s)); RG.halos=RG.halos.filter(s=>!ex.has(s));
  for(const k of VAR.keys) delete G.cables[k];
  VAR.meshes=[]; VAR.keys=[]; VAR.extra=[];
}

/* =====================================================================
   ESTAT, INTERFÍCIE I LLUM DEL RITS
   ===================================================================== */
function buildRITS(){ ritsMats(); buildRITSRoom(); buildRITSEntry(); buildCapVariant(S.cap); }
function ritsEnv(){
  const pm=new THREE.PMREMGenerator(renderer), es=new THREE.Scene();
  const room=new THREE.Mesh(new THREE.BoxGeometry(10,6,10),new THREE.MeshBasicMaterial({color:0x8E949A,side:THREE.BackSide})); es.add(room);
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshBasicMaterial({color:0x5C6166})); fl.rotation.x=-Math.PI/2; fl.position.y=-2.9; es.add(fl);
  for(const [x,z] of [[-2,0],[2,0],[0,3]]){ const p=new THREE.Mesh(new THREE.PlaneGeometry(2.4,0.8),new THREE.MeshBasicMaterial({color:0xFFFFFF})); p.rotation.x=Math.PI/2; p.position.set(x,2.9,z); es.add(p); }
  const w=new THREE.Mesh(new THREE.PlaneGeometry(4,2),new THREE.MeshBasicMaterial({color:0xDDE6EE})); w.position.set(0,0.5,-4.9); es.add(w);
  /* el mapa d'entorn s'ha desactivat: en ordinadors sense GPU (renderitzat per programari) multiplicava per 15 el temps de cada fotograma */
  pm.dispose();
}
const ritsBad = id => !!(id && EL[id] && EL[id].variant && EL[id].variant!==S.cap);
function inRits(id){ if(!id||!EL[id]) return false; if(id==='rits'||id==='rits_porta') return true; let p=EL[id].parent; while(p){ if(p==='rits') return true; p=EL[p].parent; } return false; }
function setCap(v){
  if(v===S.cap && CAPBUILT===v) return;
  S.cap=v; clearScope(); withRoot(RITS_ROOT,()=>buildCapVariant(v));
  if(ritsBad(S.selected)) S.selected='capcalera';
  if(ritsBad(S.hover)) S.hover=null;
  S.related=new Set([...S.related].filter(x=>!ritsBad(x)));
  if(S.ritsHl) S.related=ritsHlSet(S.ritsHl);
  for(const n of NAV.stack) if(ritsBad(n.selected)) n.selected='capcalera';
  applyVisibility(); renderInfo(); needLabels=true;
  if(renderer) shadowRefresh();
  const st=$('#statusNav'); if(st) st.textContent = `Capçalera canviada: ${v==='A'?'centraleta programable amb FI':'amplificadors monocanal'}. S'han reconstruït els equips i les connexions.`;
}
function ritsHlSet(k){
  if(k==='in') return new Set(['cab_capt','cab_dab','cab_fm','cab_sat','cab_sat2','canal_enllac_sup','reg_enllac_sup','rits_ff','cab_capt_int','cab_dab_int','cab_fm_int','cab_sat_int','cab_sat2_int','rits_corr_in','cap_fi_2', ...(S.cap==='A'?['cap_avant']:['cap_filtre','cap_t12_1','cap_t12_dab','cap_t12_fm','cap_fi_1'])]);
  return new Set(['cap_mix','cap_jump','xd_rtv','rits_corr_out','canal_principal', ...(S.cap==='A'?['cap_avant']:[])]);
}
function ritsVisibility(){
  const did=S.ritsLook==='did';
  for(const s of RG.sprites){ const e=EL[s.userData.el]; s.visible = did && elVisible(e) && (G.byEl[s.userData.el]||[]).some(m=>m.visible); }
  for(const h of RG.halos) h.visible = did;
}
function shadowRefresh(){ if(!renderer) return; const on=S.ritsLight && !S.lowq; renderer.shadowMap.enabled=on; renderer.shadowMap.autoUpdate=on; renderer.shadowMap.needsUpdate=true; if(RG.spot){ RG.spot.visible=S.ritsLight; RG.spot.castShadow=on; } }
function setRitsLight(on){
  S.ritsLight=on; if(RG.spot){ RG.spot.intensity = on ? 16 : 0; }
  shadowRefresh(); applyMaterials(); renderInfo();
}
function ritsInterior(){
  navPush(); setOpen('rits',true); S.ritsRoof=true;
  if(!['oberta','ict','transp'].includes(S.mode)) S.mode='oberta';
  for(const k of ['recintes','equips','punts','xarxes','canalitzacions','registres']) S.layers[k]=true;
  if(S.svc!=='all' && S.svc!=='rtv') S.svc='all';
  syncControls(); applyVisibility(); renderInfo();
  const v=VIEWS.ritsIn(); flyTo(v.p,v.t);
}
function ritsCardHTML(id){
  const open = id==='rits'||id==='capcalera'||id==='rits_porta';
  const b=(act,on,t1,t0)=>`<button data-ract="${act}" aria-pressed="${!!on}" class="${on?'on':''}">${on?t0:t1}</button>`;
  return `<details class="card ritscfg" ${open?'open':''}><summary><b>Configuració del ${CFG.rits}</b></summary>
   <fieldset><legend>Tipus de capçalera</legend>
    <label class="opt"><input type="radio" name="ritsCap" value="A" ${S.cap==='A'?'checked':''}> Centraleta programable amb FI <span class="muted small">(exemple: Televes AVANT 12 PRO SAT, ref. 532204 · 2n amplificador de FI i mesclador 745210)</span></label>
    <label class="opt"><input type="radio" name="ritsCap" value="B" ${S.cap==='B'?'checked':''}> Amplificadors monocanal <span class="muted small">(exemple: Televes T12 · 10 de TDT, DAB, FM, 2 de FI i mesclador 740710)</span></label></fieldset>
   <div class="small" style="margin:6px 0 2px"><b>Vista</b></div>
   <div class="actions" style="margin-top:2px"><button data-ract="view" class="primary">Interior del ${CFG.rits}</button>
    ${b('door',isOpen('rits'),'Obrir la porta','Tancar la porta')}${b('roof',S.ritsRoof,'Retirar el sostre','Recuperar el sostre')}${b('front',S.ritsFront,'Retirar la paret frontal','Recuperar la paret frontal')}</div>
   <div class="small" style="margin:6px 0 2px"><b>Observar</b></div>
   <div class="actions" style="margin-top:2px">${b('light',S.ritsLight,'Encendre llum','Apagar llum')}${b('cut',S.ritsCut,'Obrir un tram de corrugat','Tancar el tram de corrugat')}
    <button data-ract="xray" aria-pressed="${S.ritsXray}" class="${S.ritsXray?'on':''}">Veure cables a través dels tubs</button>
    <button data-ract="hlIn" aria-pressed="${S.ritsHl==='in'}" class="${S.ritsHl==='in'?'on':''}">Destacar entrada des de les antenes</button>
    <button data-ract="hlOut" aria-pressed="${S.ritsHl==='out'}" class="${S.ritsHl==='out'?'on':''}">Destacar sortides de distribució</button></div>
   <fieldset><legend>Representació</legend>
    <label class="opt"><input type="radio" name="ritsLook" value="real" ${S.ritsLook==='real'?'checked':''}> Aparença real</label>
    <label class="opt"><input type="radio" name="ritsLook" value="did" ${S.ritsLook==='did'?'checked':''}> Identificació didàctica <span class="muted small">(contorns i símbols: 〰 RF · ⚡ 230 V c.a. · 24 V c.c. · ⊥ terra)</span></label></fieldset>
   <p class="small muted" style="margin-bottom:0">El recinte, els equips, els connectors i els cables de dins són a escala real. Models d'equips: exemples comercials documentats, no una recomanació.</p>
  </details>`;
}
function ritsAction(a){
  if(a==='view') ritsInterior();
  if(a==='door'){ setOpen('rits',!isOpen('rits')); applyVisibility(); }
  if(a==='roof'){ S.ritsRoof=!S.ritsRoof; applyVisibility(); }
  if(a==='front'){ S.ritsFront=!S.ritsFront; applyVisibility(); }
  if(a==='light'){ setRitsLight(!S.ritsLight); return; }
  if(a==='cut'){ S.ritsCut=!S.ritsCut; applyVisibility(); }
  if(a==='xray'){ S.ritsXray=!S.ritsXray; applyMaterials(); }
  if(a==='hlIn'||a==='hlOut'){ const k=a==='hlIn'?'in':'out';
    if(S.ritsHl===k){ S.ritsHl=null; S.related=new Set(); }
    else { S.ritsHl=k; S.related=ritsHlSet(k); S.ritsXray=true; for(const r of S.related) ensureVisible(r);
      frameEl(k==='in'?['reg_enllac_sup','rits_corr_in',...(S.cap==='A'?['cap_avant']:['cap_t12_1'])]:['cap_mix','rits_corr_out']); }
    applyVisibility(); needLabels=true; }
  renderInfo();
}

/* =====================================================================
   SISTEMA DE CAPTACIÓ A LA COBERTA
   Torre triangular de gelosia (6 m), màstil, tres tirants a 120°,
   antenes TDT, DAB i FM, parabòlica offset amb LNB i 4 coaxials.
   La geometria repetitiva es fusiona en poques malles (lleugera).
   ===================================================================== */
const ANT={TX:-4.6, TZ:-3.5, Y0:15.0, Y1:21.0, RL:0.17, yT:24.55, yD:22.95, yF:21.50, RG:2.8,
  dish:{az:240, dist:0.405, y:16.0, rad:0.40, depth:0.07, tilt:15, elev:40}, info:{}, cab:{}};
const ANT_GALV=0xB7BDC2, ANT_ALU=0xD5D9DC, ANT_OR=0xF07A1A, ANT_GUY=0xD3D7DA, ANT_YEL=0xF2C230;
const agV = p => Array.isArray(p) ? V(...p) : p;
function agSeg(a,b,r,seg=6){ a=agV(a); b=agV(b); const d=b.clone().sub(a), L=d.length();
  const g=new THREE.CylinderGeometry(r,r,L,seg,1,false);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP,d.normalize()));
  const m=a.clone().add(b).multiplyScalar(0.5); g.translate(m.x,m.y,m.z); return g; }
function agBox(c,w,h,d,q){ const g=new THREE.BoxGeometry(w,h,d); if(q) g.applyQuaternion(q); c=agV(c); g.translate(c.x,c.y,c.z); return g; }
function agMerge(list){
  let nv=0, ni=0; for(const g of list){ nv+=g.attributes.position.count; ni+=g.index?g.index.count:g.attributes.position.count; }
  const pos=new Float32Array(nv*3), nor=new Float32Array(nv*3), uv=new Float32Array(nv*2), idx=new Uint32Array(ni);
  let ov=0, oi=0;
  for(const g of list){ const p=g.attributes.position, n=g.attributes.normal, u=g.attributes.uv;
    pos.set(p.array,ov*3); nor.set(n.array,ov*3); if(u) uv.set(u.array,ov*2);
    if(g.index){ const a=g.index.array; for(let i=0;i<a.length;i++) idx[oi+i]=a[i]+ov; oi+=a.length; }
    else { for(let i=0;i<p.count;i++) idx[oi+i]=ov+i; oi+=p.count; }
    ov+=p.count; g.dispose(); }
  const G2=new THREE.BufferGeometry();
  G2.setAttribute('position',new THREE.BufferAttribute(pos,3)); G2.setAttribute('normal',new THREE.BufferAttribute(nor,3)); G2.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  G2.setIndex(new THREE.BufferAttribute(idx,1)); G2.computeBoundingSphere(); G2.computeBoundingBox(); return G2;
}
function agMesh(el, list, color, mat, o={}){ const m=rMesh(el, agMerge(list), color, mat, Object.assign({cast:true},o)); if(o.pick!==false) G.pick.push(m); return m; }
ANT.segs={};
function tSeg(kind,a,b,r,seg){ (ANT.segs[kind] ||= []).push([agV(a).clone(),agV(b).clone(),r]); return agSeg(a,b,r,seg); }
const azv = a => V(Math.cos(a*Math.PI/180),0,Math.sin(a*Math.PI/180));
const legP = (a,y) => V(ANT.TX,y,ANT.TZ).addScaledVector(azv(a),ANT.RL);
/* brida negra de plàstic al voltant d'un feix (anell obert) */
function agTie(list, c, axis, r){ const g=new THREE.CylinderGeometry(r,r,0.010,14,1,true); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP,axis.clone().normalize())); g.translate(c.x,c.y,c.z); list.push(g); }

function buildAntennas(){
  const {TX,TZ,Y0,Y1}=ANT, T0=V(TX,Y0,TZ), LEGS=[60,180,300];
  /* ---------------- TORRE TRIANGULAR DE GELOSIA ---------------- */
  const tw=[], tb=[];
  for(const a of LEGS) tw.push(tSeg('torre',legP(a,Y0+0.014),legP(a,Y1-0.012),0.014,8));
  const ys=[]; for(let y=15.10;y<20.65;y+=0.5) ys.push(+y.toFixed(3)); ys.push(20.985);
  const faces=[[60,180],[180,300],[300,60]];
  ys.forEach((y,k)=>{ for(const [a,b] of faces){ tw.push(tSeg('torre',legP(a,y),legP(b,y),0.0065,5));
      if(k<ys.length-1){ const y2=ys[k+1]; tw.push(k%2 ? agSeg(legP(a,y),legP(b,y2),0.0055,5) : agSeg(legP(b,y),legP(a,y2),0.0055,5)); } } });
  // unions de tram cada metre (manegots als muntants)
  for(let y=16.0;y<21;y+=1) for(const a of LEGS) tw.push(tSeg('torre',legP(a,y-0.04),legP(a,y+0.04),0.018,8));
  // placa base, cartel·les i perns d'ancoratge
  tb.push(agBox([TX,Y0+0.007,TZ],0.56,0.014,0.56));
  for(const a of LEGS){ const p=legP(a,Y0+0.05); const q=new THREE.Quaternion().setFromAxisAngle(UP,-a*Math.PI/180);
    tb.push(agBox(p.clone().addScaledVector(azv(a),0.03),0.07,0.07,0.008,q)); }
  for(const [dx,dz] of [[-0.23,-0.23],[0.23,-0.23],[-0.23,0.23],[0.23,0.23]]){ tb.push(agSeg([TX+dx,Y0,TZ+dz],[TX+dx,Y0+0.055,TZ+dz],0.009,8)); tb.push(agSeg([TX+dx,Y0+0.014,TZ+dz],[TX+dx,Y0+0.034,TZ+dz],0.017,6)); }
  // placa superior triangular i placa intermèdia (guia del màstil)
  for(const [y0,y1] of [[20.986,21.0],[20.53,20.544]]){ const g=new THREE.CylinderGeometry(0.205,0.205,y1-y0,3,1,false,Math.PI/6); g.translate(TX,(y0+y1)/2,TZ); tw.push(g); }
  // orelles d'ancoratge dels tirants a cada muntant
  for(const a of LEGS){ const p=legP(a,20.85).addScaledVector(azv(a),0.03); const q=new THREE.Quaternion().setFromAxisAngle(UP,-a*Math.PI/180);
    tw.push(agBox(p,0.075,0.06,0.008,q)); }
  const tower=agMesh('torre',tw,ANT_GALV,'galv',{pick:false});
  agMesh('torre',tb,0xA9AFB4,'galv');
  { const pg=new THREE.CylinderGeometry(0.21,0.21,Y1-Y0,3,1,false,Math.PI/6); pg.translate(TX,(Y0+Y1)/2,TZ); addProxy(tower,pg); }
  ANT.info.tower={base:Y0, top:Y1, legs:LEGS.map(a=>legP(a,Y0))};
  COLL.push({x0:TX-0.28,x1:TX+0.28,y0:Y0,y1:Y1,z0:TZ-0.28,z1:TZ+0.28,mesh:tower,f:{floor:5}});

  /* ---------------- MÀSTIL ---------------- */
  const mt=[tSeg('mast',[TX,20.45,TZ],[TX,24.95,TZ],0.025,18)];
  for(const y of [20.60,20.93]) for(const s of [-1,1]) mt.push(tSeg('mast',[TX-0.035,y,TZ+s*0.028],[TX+0.035,y,TZ+s*0.028],0.005,6));   // brides en U a les plaques
  const mm=agMesh('mastil',mt,0xC2C7CB,'galv',{pick:false});
  rCyl('mastil',0.027,0.025,V(TX,24.962,TZ),UP,0x2B2B2B,'rubber');
  { const pg=new THREE.CylinderGeometry(0.08,0.08,4.4,6); pg.translate(TX,22.75,TZ); addProxy(mm,pg); }
  ANT.info.mast={y0:20.45, y1:24.975};

  /* ---------------- TIRANTS (3 a 120°) ---------------- */
  const gw=[], gf=[], gy=[]; ANT.info.guys=[];
  for(const a of LEGS){
    const d=azv(a), top=legP(a,20.85).addScaledVector(d,0.055);
    const A=V(TX,Y0,TZ).addScaledVector(d,ANT.RG), E=A.clone().add(V(0,0.085,0));
    const u=top.clone().sub(E).normalize(), side=V(0,1,0).cross(d).normalize();
    const q=new THREE.Quaternion().setFromAxisAngle(UP,-a*Math.PI/180);
    // placa d'ancoratge amb 4 tacs químics i cargol d'ull
    gf.push(agBox([A.x,Y0+0.006,A.z],0.22,0.012,0.16,q));
    for(const s1 of [-1,1]) for(const s2 of [-1,1]){ const p=A.clone().addScaledVector(d,s1*0.08).addScaledVector(side,s2*0.055); gf.push(agSeg([p.x,Y0,p.z],[p.x,Y0+0.04,p.z],0.007,6)); gf.push(agSeg([p.x,Y0+0.012,p.z],[p.x,Y0+0.026,p.z],0.013,6)); }
    gf.push(agSeg([A.x,Y0+0.012,A.z],[A.x,Y0+0.05,A.z],0.012,8));
    { const eye=new THREE.TorusGeometry(0.03,0.007,6,16); const qq=new THREE.Quaternion().setFromUnitVectors(V(0,0,1),side); eye.applyQuaternion(qq); eye.translate(E.x,E.y,E.z); gf.push(eye); }
    // tensor (cos obert, dos cargols d'ull) i guardacaps
    const t0=E.clone().addScaledVector(u,0.03), t1=E.clone().addScaledVector(u,0.30);
    const perp=side.clone().cross(u).normalize();
    gf.push(agSeg(t0,E.clone().addScaledVector(u,0.09),0.006,6)); gf.push(agSeg(E.clone().addScaledVector(u,0.24),t1,0.006,6));
    for(const s of [-1,1]) gf.push(agSeg(E.clone().addScaledVector(u,0.09).addScaledVector(perp,s*0.014),E.clone().addScaledVector(u,0.24).addScaledVector(perp,s*0.014),0.0045,6));
    for(const k of [0.09,0.24]) gf.push(agSeg(E.clone().addScaledVector(u,k-0.012),E.clone().addScaledVector(u,k+0.012),0.016,8));
    for(const P2 of [t1.clone().addScaledVector(u,0.03), top.clone().addScaledVector(u,-0.03)]){ const th=new THREE.TorusGeometry(0.022,0.0055,6,14); th.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,0,1),perp)); th.translate(P2.x,P2.y,P2.z); gf.push(th); }
    // grapes de cable (sujetacables) a cada extrem
    for(const k of [0.40,0.47]){ const c=E.clone().addScaledVector(u,k); gf.push(agBox(c.clone().addScaledVector(perp,0.006),0.03,0.03,0.022,new THREE.Quaternion().setFromUnitVectors(UP,u))); }
    for(const k of [0.16,0.23]){ const c=top.clone().addScaledVector(u,-k); gf.push(agBox(c.clone().addScaledVector(perp,0.006),0.03,0.03,0.022,new THREE.Quaternion().setFromUnitVectors(UP,u))); }
    // cable d'acer galvanitzat (amb la cua tornada) i funda groga de senyalització
    const w0=t1.clone().addScaledVector(u,0.055), w1=top.clone().addScaledVector(u,-0.055);
    gw.push(tSeg('guy',w0,w1,0.0055,6)); gw.push(tSeg('guy',w0.clone().addScaledVector(perp,0.011),E.clone().addScaledVector(u,0.52).addScaledVector(perp,0.011),0.0045,5));
    gw.push(tSeg('guy',w1.clone().addScaledVector(perp,0.011),top.clone().addScaledVector(u,-0.27).addScaledVector(perp,0.011),0.0045,5));
    gy.push(tSeg('guy',E.clone().addScaledVector(u,0.62),E.clone().addScaledVector(u,2.40),0.014,10));
    ANT.info.guys.push({az:a, top:w1.clone(), bot:w0.clone(), anchor:A.clone(), eye:E.clone()});
    COLL.push({x0:A.x-0.14,x1:A.x+0.14,y0:Y0,y1:Y0+0.4,z0:A.z-0.14,z1:A.z+0.14,mesh:null,virt:true,f:{floor:5}});
  }
  const gm=agMesh('tirants',gw,ANT_GUY,'steel',{pick:false});
  agMesh('tirants',gf,0xAEB4B9,'galv',{pick:false}); agMesh('tirants',gy,ANT_YEL,'plastic',{pick:false});
  for(const g of ANT.info.guys) addProxy(gm,agSeg(g.bot,g.top,0.05,4));
  for(const g of ANT.info.guys) addProxy(gm,agBox([g.anchor.x,Y0+0.15,g.anchor.z],0.3,0.3,0.3));

  /* ---------------- ANTENA TDT (Yagi UHF de panell) ---------------- */
  const yT=ANT.yT, bz=TZ+0.05, ta=[], tor=[];
  ta.push(agBox([TX-0.34,yT,bz],1.24,0.02,0.02));                        // bum principal
  ta.push(agBox([TX-0.60,yT+0.075,bz],0.72,0.014,0.014));                // bum superior de directors
  for(const x of [-0.25,-0.95]) ta.push(tSeg('tdt',[TX+x,yT,bz],[TX+x,yT+0.075,bz],0.004,5));
  ta.push(agBox([TX,yT,TZ+0.033],0.09,0.09,0.012));                       // brida de màstil
  for(const s of [-1,1]) ta.push(tSeg('tdt',[TX-0.03,yT+s*0.03,TZ-0.03],[TX-0.03,yT+s*0.03,TZ+0.03],0.005,6),tSeg('tdt',[TX+0.03,yT+s*0.03,TZ-0.03],[TX+0.03,yT+s*0.03,TZ+0.03],0.005,6),tSeg('tdt',[TX-0.03,yT+s*0.03,TZ-0.03],[TX+0.03,yT+s*0.03,TZ-0.03],0.005,6));
  // reflector de panell: varetes horitzontals en un marc
  const rx=TX+0.26;
  for(const s of [-1,1]) ta.push(tSeg('tdt',[rx,yT-0.21,bz+s*0.25],[rx,yT+0.21,bz+s*0.25],0.006,6));
  for(let k=0;k<7;k++){ const y=yT-0.20+k*(0.40/6); ta.push(tSeg('tdt',[rx+0.012,y,bz-0.25],[rx+0.012,y,bz+0.25],0.0035,5)); }
  ta.push(tSeg('tdt',[rx,yT-0.21,bz],[rx,yT+0.21,bz],0.006,6));
  for(const s of [-1,1]) ta.push(tSeg('tdt',[rx-0.01,yT,bz],[rx,yT+s*0.19,bz],0.004,5));
  // directors (bum principal i superior)
  for(let i=0;i<12;i++){ const x=TX-0.22-i*0.062, L=0.21-i*0.005; ta.push(tSeg('tdt',[x,yT,bz-L/2],[x,yT,bz+L/2],0.0032,5)); }
  for(let i=0;i<10;i++){ const x=TX-0.28-i*0.068, L=0.17-i*0.004; ta.push(tSeg('tdt',[x,yT+0.075,bz-L/2],[x,yT+0.075,bz+L/2],0.0032,5)); }
  // dipol plegat
  const dx=TX-0.08;
  for(const s of [-1,1]){ const z0=bz+s*0.045, z1=bz+s*0.125;
    ta.push(tSeg('tdt',[dx,yT+0.012,z0],[dx,yT+0.012,z1],0.005,6)); ta.push(tSeg('tdt',[dx,yT-0.012,z0],[dx,yT-0.012,z1],0.005,6)); ta.push(tSeg('tdt',[dx,yT-0.012,z1],[dx,yT+0.012,z1],0.005,6)); }
  tor.push(agBox([dx,yT,bz],0.10,0.07,0.09));                             // caixa de connexió taronja
  tor.push(agBox([dx,yT+0.04,bz],0.08,0.012,0.07));
  agMesh('antena',ta,ANT_ALU,'steel',{pick:false}); const tbm=agMesh('antena',tor,ANT_OR,'plastic');
  addProxy(tbm,agBox([TX-0.33,yT+0.0,bz],1.3,0.46,0.52));
  const tdtOut=fMale('antena',V(dx,yT-0.035,bz),V(0,-1,0),'antena');
  ANT.info.tdt={yMin:yT-0.21, yMax:yT+0.21, box:V(dx,yT,bz)};

  /* ---------------- ANTENA DAB (3 elements, polarització vertical) ---------------- */
  const yD=ANT.yD, da=[], dor=[];
  da.push(agBox([TX-0.49,yD,TZ],0.90,0.02,0.02));
  da.push(agBox([TX-0.033,yD,TZ],0.012,0.09,0.09));
  for(const s of [-1,1]) da.push(tSeg('dab',[TX-0.03,yD+s*0.03,TZ-0.036],[TX+0.05,yD+s*0.03,TZ-0.036],0.005,6),tSeg('dab',[TX-0.03,yD+s*0.03,TZ+0.036],[TX+0.05,yD+s*0.03,TZ+0.036],0.005,6),tSeg('dab',[TX+0.05,yD+s*0.03,TZ-0.036],[TX+0.05,yD+s*0.03,TZ+0.036],0.005,6));
  da.push(tSeg('dab',[TX-0.30,yD-0.36,TZ],[TX-0.30,yD+0.36,TZ],0.006,6));     // reflector
  da.push(tSeg('dab',[TX-0.88,yD-0.31,TZ],[TX-0.88,yD+0.31,TZ],0.006,6));     // director
  const fx=TX-0.58;                                                     // dipol plegat
  for(const s of [-1,1]){ const y0=yD+s*0.05, y1=yD+s*0.34;
    da.push(tSeg('dab',[fx+0.02,y0,TZ],[fx+0.02,y1,TZ],0.006,6)); da.push(tSeg('dab',[fx-0.02,y0,TZ],[fx-0.02,y1,TZ],0.006,6)); da.push(tSeg('dab',[fx-0.02,y1,TZ],[fx+0.02,y1,TZ],0.006,6)); }
  for(const x of [-0.30,-0.88]) da.push(agBox([TX+x,yD,TZ],0.03,0.035,0.03));
  dor.push(agBox([fx,yD,TZ],0.075,0.11,0.06));
  agMesh('antena_dab',da,ANT_ALU,'steel',{pick:false}); const dbm=agMesh('antena_dab',dor,ANT_OR,'plastic');
  addProxy(dbm,agBox([TX-0.49,yD,TZ],0.95,0.74,0.18));
  const dabOut=fMale('antena_dab',V(fx,yD-0.055,TZ-0.018),V(0,-1,0),'antena_dab');
  ANT.info.dab={yMin:yD-0.36, yMax:yD+0.36};

  /* ---------------- ANTENA FM (dipol circular horitzontal) ---------------- */
  const yF=ANT.yF, fa=[], foo=[], RR=0.30, cz=TZ+0.42, gap=0.30;
  { const g=new THREE.TorusGeometry(RR,0.0075,6,48,Math.PI*2-gap); g.rotateZ(gap/2); g.rotateX(Math.PI/2); g.rotateY(Math.PI/2); g.translate(TX,yF,cz); fa.push(g); }
  fa.push(agBox([TX,yF,TZ+0.07],0.025,0.025,0.08));                      // braç de suport
  fa.push(agBox([TX,yF,TZ+0.033],0.09,0.07,0.012));
  for(const s of [-1,1]) fa.push(tSeg('fm',[TX-0.03,yF+s*0.025,TZ-0.036],[TX-0.03,yF+s*0.025,TZ+0.03],0.005,6),tSeg('fm',[TX+0.05,yF+s*0.025,TZ-0.036],[TX+0.05,yF+s*0.025,TZ+0.03],0.005,6),tSeg('fm',[TX-0.03,yF+s*0.025,TZ-0.036],[TX+0.05,yF+s*0.025,TZ-0.036],0.005,6));
  for(const s of [-1,1]) fa.push(tSeg('fm',[TX+s*0.035,yF-0.012,cz-RR*0.93],[TX+s*0.16,yF-0.012,cz-RR*0.55],0.004,5));   // tirants del dipol
  foo.push(agBox([TX,yF,TZ+0.125],0.105,0.06,0.065));
  agMesh('antena_fm',fa,ANT_ALU,'steel',{pick:false}); const fbm=agMesh('antena_fm',foo,ANT_OR,'plastic');
  addProxy(fbm,agBox([TX,yF,cz],0.66,0.14,0.70));
  const fmOut=fMale('antena_fm',V(TX+0.03,yF-0.03,TZ+0.125),V(0,-1,0),'antena_fm');
  ANT.info.fm={yMin:yF-0.03, yMax:yF+0.03};

  /* ---------------- PARABÒLICA OFFSET + LNB ---------------- */
  const D=ANT.dish, d=azv(D.az), Cc=V(TX,D.y,TZ).addScaledVector(d,D.dist);
  const tl=D.tilt*Math.PI/180, el=D.elev*Math.PI/180;
  const n=d.clone().multiplyScalar(Math.cos(tl)).add(V(0,Math.sin(tl),0));           // eix del reflector
  const uu=V(0,Math.cos(tl),0).addScaledVector(d,-Math.sin(tl));                   // «amunt» del reflector
  const beam=d.clone().multiplyScalar(Math.cos(el)).add(V(0,Math.sin(el),0));       // direcció del satèl·lit
  const refl=n.clone().multiplyScalar(2*beam.dot(n)).sub(beam).normalize();          // cap al focus (LNB)
  const Rs=(D.rad*D.rad+D.depth*D.depth)/(2*D.depth), th=Math.asin(D.rad/Rs);
  const qd=new THREE.Quaternion().setFromUnitVectors(V(0,-1,0),n);
  const mkCap=(off)=>{ const g=new THREE.SphereGeometry(Rs,40,8,0,Math.PI*2,0,th); g.translate(0,-Rs+off,0); g.applyQuaternion(qd); g.translate(Cc.x,Cc.y,Cc.z); return g; };
  const dishM=agMesh('parabola',[mkCap(0)],0xEEF0F1,'paint',{pick:true}); dishM.material.side=THREE.DoubleSide;
  const backM=agMesh('parabola',[mkCap(0.012)],0xDCDFE1,'paint',{pick:false}); backM.material.side=THREE.DoubleSide;
  { const rim=new THREE.TorusGeometry(D.rad*0.995,0.007,6,48); rim.rotateX(Math.PI/2); rim.translate(0,-D.depth+0.006,0); rim.applyQuaternion(qd); rim.translate(Cc.x,Cc.y,Cc.z); agMesh('parabola',[rim],0xE2E5E7,'paint',{pick:false}); }
  // suport: tub vertical separat de la torre, braços en V amb brides als muntants, suport posterior i braç de l'LNB
  const sp=[], stub=V(TX,0,TZ).addScaledVector(d,0.235); ANT.info.stub=stub.clone();
  sp.push(tSeg('dish',[stub.x,15.55,stub.z],[stub.x,16.42,stub.z],0.021,12));
  for(const y of [15.70,16.25]) for(const a of [180,300]){ const L=legP(a,y); sp.push(tSeg('dish',L,[stub.x,y,stub.z],0.011,8)); sp.push(tSeg('dish',L.clone().add(V(0,-0.03,0)),L.clone().add(V(0,0.03,0)),0.021,8)); }
  const back=Cc.clone().addScaledVector(n,-0.016);
  sp.push(agBox(Cc.clone().addScaledVector(n,-0.016).lerp(V(stub.x,D.y,stub.z),0.5),0.05,0.05,back.distanceTo(V(stub.x,D.y,stub.z))+0.02,new THREE.Quaternion().setFromUnitVectors(V(0,0,1),back.clone().sub(V(stub.x,D.y,stub.z)).normalize())));
  sp.push(agBox(back.clone().addScaledVector(n,-0.004),0.16,0.18,0.012,new THREE.Quaternion().setFromUnitVectors(V(0,0,1),n)));
  for(const y of [D.y-0.045,D.y+0.045]) sp.push(tSeg('dish',[stub.x,y-0.02,stub.z],[stub.x,y+0.02,stub.z],0.028,10));
  const A0=V(TX,15.575,TZ).addScaledVector(d,0.56);
  sp.push(tSeg('dish',V(stub.x,15.60,stub.z),A0,0.012,8));
  const Lf=Cc.clone().addScaledVector(refl,0.60);                                      // focus: boca del botzina de l'LNB
  const lnbAx=refl.clone();                                                            // l'LNB mira cap al reflector (−refl)
  const holder=Lf.clone().addScaledVector(lnbAx,0.07);
  const lnbDown=V(0,1,0).sub(lnbAx.clone().multiplyScalar(lnbAx.y)).normalize();
  const armEnd=holder.clone().addScaledVector(lnbDown,-0.045);
  sp.push(tSeg('dish',A0,armEnd,0.012,8));
  { const ring=new THREE.TorusGeometry(0.026,0.005,6,16); ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,0,1),lnbAx)); ring.translate(holder.x,holder.y,holder.z); sp.push(ring); }
  sp.push(tSeg('dish',armEnd,holder.clone().addScaledVector(lnbDown,-0.026),0.006,6));
  agMesh('parabola',sp,0xC9CDD0,'galv',{pick:true});
  // LNB: botzina, cos i sortida F
  const ln=[], lnc=[];
  { const g=new THREE.CylinderGeometry(0.031,0.024,0.05,20,1,false); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP,lnbAx.clone().negate())); const c=Lf.clone().addScaledVector(lnbAx,0.025); g.translate(c.x,c.y,c.z); ln.push(g); }
  ln.push(agSeg(Lf.clone().addScaledVector(lnbAx,0.05),Lf.clone().addScaledVector(lnbAx,0.135),0.022,18));
  lnc.push(agSeg(Lf.clone().addScaledVector(lnbAx,-0.001),Lf.clone().addScaledVector(lnbAx,0.004),0.0235,18));   // tapa dielèctrica
  const lnM=agMesh('lnb',ln,0xF1F2F2,'plastic'); agMesh('lnb',lnc,0x2E2E2E,'plastic',{pick:false});
  addProxy(lnM,agSeg(Lf,Lf.clone().addScaledVector(lnbAx,0.14),0.06,8));
  const lnbF=Lf.clone().addScaledVector(lnbAx,0.11).addScaledVector(lnbDown,-0.022);
  const lnbSide=lnbAx.clone().cross(lnbDown).normalize();
  const satOut=fMale('lnb',lnbF.clone().addScaledVector(lnbSide,-0.016),lnbDown.clone().negate(),'lnb');
  const satOut2=fMale('lnb',lnbF.clone().addScaledVector(lnbSide,0.016),lnbDown.clone().negate(),'lnb');
  ANT.info.dish={center:Cc.clone(), n, beam, refl, lnb:Lf.clone(), radius:D.rad, rim:[Cc.clone().addScaledVector(uu,D.rad).addScaledVector(n,D.depth),Cc.clone().addScaledVector(uu,-D.rad).addScaledVector(n,D.depth)]};
  COLL.push({x0:Math.min(TX,Cc.x+0.6*d.x)-0.3,x1:Math.max(TX,Cc.x+0.6*d.x)+0.3,y0:Y0,y1:16.5,z0:Math.min(TZ,Cc.z+0.6*d.z)-0.3,z1:Math.max(TZ,Cc.z+0.6*d.z)+0.3,mesh:dishM,f:{floor:5}});

  /* ---------------- BRIDES DE CABLE (màstil i torre) ---------------- */
  const ties=[];
  const mties=[]; for(const y of [21.95,22.45,23.55,24.05]) agTie(mties,V(TX,y,TZ),UP,0.042); agMesh('mastil',mties,0x161616,'rubber',{pick:false});
  for(const y of ys.slice(1,-1)) if(y>15.5){ ties.push(agBox([TX+0.1345,y+0.012,TZ],0.005,0.010,0.10)); ties.push(agBox([TX+0.11,y+0.012,TZ+0.0505],0.05,0.010,0.005)); ties.push(agBox([TX+0.11,y+0.012,TZ-0.0505],0.05,0.010,0.005)); }
  agMesh('torre',ties,0x161616,'rubber',{pick:false});

  /* ---------------- RECORREGUTS DELS COAXIALS ---------------- */
  const BX=TX+0.122, slot=(ang)=>V(TX+0.0325*Math.cos(ang*Math.PI/180),0,TZ+0.0325*Math.sin(ang*Math.PI/180));
  const sT=slot(0), sF=slot(40), sD=slot(-40);
  const ZB={fm:TZ+0.033, tdt:TZ+0.011, dab:TZ-0.011, sat:TZ-0.033, sat2:TZ-0.055};
  ANT.cab={
    tdt:[tdtOut,[dx,yT-0.12,bz],[TX+0.0,yT-0.17,TZ+0.048],[TX+0.031,yT-0.20,TZ+0.031],[sT.x,yT-0.235,sT.z],[sT.x,21.32,sT.z]],
    dab:[dabOut,[fx,yD-0.14,TZ-0.024],[TX-0.30,yD-0.14,TZ-0.024],[TX-0.05,yD-0.14,TZ-0.036],[TX,yD-0.16,TZ-0.045],[TX+0.016,yD-0.19,TZ-0.036],[sD.x,yD-0.22,sD.z],[sD.x,21.32,sD.z]],
    fm:[fmOut,[TX+0.03,yF-0.11,TZ+0.10],[BX-0.035,21.30,ZB.fm+0.012]],
    sat:[satOut, armEnd.clone().addScaledVector(lnbDown,-0.03).addScaledVector(lnbAx,0.04), A0.clone().add(V(0,-0.032,0)).addScaledVector(d,-0.02), V(stub.x,15.556,stub.z).addScaledVector(d,0.03), V(stub.x,15.50,stub.z).addScaledVector(d,0.03), V(TX+0.02,15.50,TZ-0.215), V(TX+0.135,15.50,TZ-0.165), V(TX+0.15,15.47,TZ-0.07)]
  };
  for(const k of ['tdt','dab','fm']) ANT.cab[k].push([BX,21.06,ZB[k]],[BX,15.62,ZB[k]],[BX,15.50,ZB[k]]);
  /* sortida B de l'LNB: el segon cable va paral·lel al primer */
  { const off=V(-0.016*d.z,0,0.016*d.x); ANT.cab.sat2=[satOut2, ...ANT.cab.sat.slice(1).map((p,i)=>i===0?p.clone().addScaledVector(lnbSide,0.016):p.clone().add(off))];
    ANT.cab.sat2[ANT.cab.sat2.length-1]=V(TX+0.17,15.47,TZ-0.085); }
  // brides del cable de l'LNB al braç
  const st=[]; for(const t of [0.3,0.65]) agTie(st,A0.clone().lerp(armEnd,t).addScaledVector(lnbDown,-0.012),armEnd.clone().sub(A0),0.022);
  agTie(st,V(stub.x,15.53,stub.z).addScaledVector(d,0.015),UP,0.036);
  agMesh('parabola',st,0x161616,'rubber',{pick:false});
  ANT.ZB=ZB;
}

function init(){
  linkChildren(); buildStaticUI(); bindEvents();
  const gl=initGL();
  if(gl){
    TEX.fo=makeTex('fo'); TEX.pt=makeTex('pt');
    archMats(); buildArchitecture(); buildLandscape(); ritsEnv(); buildICT(); finalizeLids(); buildRefs();
    for(const m of G.arch) if(m.userData.floor===5) m.receiveShadow=true;
    onResize();
    const v=VIEWS.start(); camera.position.copy(v.p); controls.target.copy(v.t);
  }
  syncControls();
  if(gl) applyVisibility(); else { renderList(); renderLegend(); }
  renderInfo();
  navUI(); if(gl) requestAnimationFrame(loop);
  let seen=false; try{ seen=localStorage.getItem('ict3d.helpSeen')==='1'; }catch(_){}
  if(seen) $('#help').classList.add('hidden');
  if(/[?&]debug\b/.test(location.search)) window.__ICT={BEND,look:(p,t)=>{camAnim=null; camera.position.set(...p); controls.target.set(...t); controls.update();},setCap,ANT,frameEl,setRitsLight,ritsAction,ritsInterior,RG,CAPB:()=>CAPBUILT,get S(){return S},EL,G,NAV,navTo,navBack,setNav,bestView,select,setMode,setView,pickAt,ensureVisible,applyVisibility,setLearn,Q,QUIZ,elBox,get camera(){return camera},get renderer(){return renderer},get controls(){return controls},
    LEAVES,LEAF_BY_KEY,LEAF_OF,leavesTick,toggleLeaf,leafOpen,isOpen,setOpen,leafAt,singleAction,doubleAction,onPointerDown,onPointerUp,LIFT,setLiftFloor,COLL,UNITS,setPanel,openDrawer,closeAllLeaves,navPush,resetAll,}; // per a proves
}
/* ---------- models glTF opcionals (models/*.glb) ----------
   Si un fitxer no es pot carregar (no existeix, o la pàgina s'obre amb file://), es fa servir el model procedural. */
const MODELS={t12:{url:'models/t12.glb', scene:null}, font:{url:'models/font_t12.glb', scene:null}, mux:{url:'models/multiplexor.glb', scene:null}, avant:{url:'models/avant.glb', scene:null}, mix:{url:'models/mesclador.glb', scene:null}, deriv:{url:'models/derivador.glb', scene:null}, carrega:{url:'models/carrega.glb', scene:null}, conF:{url:'models/conector_f.glb', scene:null}, pauFo:{url:'models/pau_fo.glb', scene:null}, pauRtv:{url:'models/pau_rtv.glb', scene:null}, pauTba:{url:'models/pau_tba.glb', scene:null}, adSC:{url:'models/adaptador_sc.glb', scene:null}, scApc:{url:'models/sc_apc.glb', scene:null}};
function loadModels(){
  if(!THREE.GLTFLoader || location.protocol==='file:') return Promise.resolve();
  const loader=new THREE.GLTFLoader();
  return Promise.all(Object.values(MODELS).map(m=>loader.loadAsync(m.url).then(g=>{ g.scene.updateMatrixWorld(true); m.scene=g.scene; }).catch(()=>{})));
}
/* col·loca una còpia del model k a la posició (x, y, z), girada rot (radians en Y, Euler [x,y,z] o quaternion), i registra
   cada malla a l'element el. recolor: {nomDeMaterial: color} per canviar colors (p. ex. la franja dels mòduls de FI);
   amb null, aquella peça no es dibuixa (p. ex. la tapa d'un adaptador SC amb el connector endollat). */
function placeModel(k, el, x, y, z, recolor={}, rot=0){
  const tpl=MODELS[k]?.scene; if(!tpl) return [];
  const R=new THREE.Matrix4();
  if(rot?.isQuaternion) R.makeRotationFromQuaternion(rot);
  else if(typeof rot==='number') R.makeRotationY(rot);
  else if(Array.isArray(rot)) R.makeRotationFromEuler(new THREE.Euler(...rot));
  else if(rot && typeof rot==='object') R.makeRotationFromEuler(new THREE.Euler(rot.x||0, rot.y||0, rot.z||0));
  const T=new THREE.Matrix4().makeTranslation(x,y,z).multiply(R), out=[];
  tpl.traverse(n=>{ if(!n.isMesh) return; const mt=n.material, nm=mt.name||'';
    if(recolor[nm]===null) return;
    const g=n.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(T,n.matrixWorld));
    const col = recolor[nm] ?? mt.color.getHex();
    out.push(ictMesh(g,col,el,{std:{roughness:mt.roughness??0.6, metalness:mt.metalness??0, side:mt.side, map:mt.map||null, alphaTest:mt.alphaTest||0}, cast:!mt.alphaTest})); });
  return out;
}
/* posició d'un objecte buit del model (p. ex. 'port_in1') respecte de l'origen del model, o null */
function modelPoint(k, name){ const o=MODELS[k].scene?.getObjectByName(name); return o ? o.getWorldPosition(new THREE.Vector3()) : null; }
