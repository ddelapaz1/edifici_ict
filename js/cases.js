/* =====================================================================
   MODEL DE CASES ADOSSADES (cases.html)
   Conjunt de quatre cases unifamiliars adossades amb aparcament soterrani comunitari i un recinte únic de
   telecomunicacions (RITU). Reutilitza el codi de l'edifici (js/app.js): aquest fitxer en substitueix la construcció
   (buildArchitecture, buildLandscape, buildICT, buildRefs), les vistes i alguns detalls de la interfície.
   Coordenades (metres): x al llarg de la filera (cases entre x = -20 i 20), z cap al carrer (façanes a z = 0), y amunt.
   - Cada parella de cases és un grup girat ±90° (PG): a dins, les coordenades són les dels habitatges A i D (o B i C) de
     l'edifici, de manera que buildInterior(), buildPartitions() i buildFurniture() funcionen sense canvis.
   - El RITU és el RITS de l'edifici construït dins del grup RITS_ROOT (girat i baixat 15 m), amb les antenes al costat.
   - Els registres principals (fibra i parells) són els del RITI de l'edifici, dins del grup RITI_ROOT, a la paret de la porta.
   ===================================================================== */
'use strict';
const KC = {
  xc:26.5,                                           // pla del tall transversal (x): a la dreta hi ha la zona del RITU
  pairs:[{x:-15, rot:-Math.PI/2}, {x:15, rot:Math.PI/2}],   // grups de les parelles (A, D) i (C, B); origen a z = 2
  zG:2,
  H:2.8, yK:3.8, pitch:30,                           // alçada de la planta baixa, cap dels murs de les golfes, pendent (°)
  bas:{x0:-20, z0:-17.5, z1:0.1, y:-3},              // soterrani: cara exterior dels murs (a la dreta, el tall)
  ramp:{x0:-23.9, x1:-20.3, z0:-12, z1:4},           // rampa de vehicles: de la vorera (z1) al replà del fons (z0)
  zGard:-17.5,                                       // fons dels jardins
  walk:[4,6.5], road:[6.5,13.5], walk2:[13.5,16],    // vorera, calçada i vorera del davant
  yLawn:-0.12, yWalk:-0.10, yRoad:-0.25, yLow:-3.65, // cotes: gespa, vorera, calçada i plana a l'altra banda del tall
  party:[-20,-10,0,10,20]                            // mitgeres (i testeres dels extrems)
};
const TANP=Math.tan(KC.pitch*Math.PI/180), Y_RIDGE=KC.yK+3*TANP;
/* RITU: el RITS de l'edifici girat −90° (porta cap a −x, torre al darrere) i baixat 15 m: x = RITU.x − z_RITS, z = RITU.z + x_RITS.
   RITI: els registres principals de l'edifici girats +90° a la paret interior de la porta: x = RITI.x + z_RITI, z = RITI.z − x_RITI. */
const RITU={x:19.6, z:-3.46, rot:-Math.PI/2}, RITI={x:26.83, z:-0.4, rot:Math.PI/2};
const ARQ={x:RITI.x-4.69, z:5.3};                           // arqueta d'entrada (a la vorera, davant del RITU)

/* ---------- grups de les parelles de cases i conversió de coordenades ---------- */
const PG=[];
const pairOf = u => (u.s==='A'||u.s==='D') ? 0 : 1;
const gw = (u, v) => v.applyMatrix4(PG[pairOf(u)].matrixWorld);                 // coordenades del grup → escena
const UW = (u, x, y, z) => gw(u, V(mx(u,x), y, mz(u,z)));                          // disposició de l'habitatge A → escena
const XZ = (u, z) => UW(u,-5,0,z).x;                                               // x de l'escena d'una z de la disposició A
function houseX(u){ const a=XZ(u,-5), b=XZ(u,5); return [Math.min(a,b), Math.max(a,b)]; }
function makePairs(){
  if(PG.length) return;
  for(const p of KC.pairs){ const g=new THREE.Group(); g.position.set(p.x,0,KC.zG); g.rotation.y=p.rot; scene.add(g); g.updateMatrixWorld(true); PG.push(g); }
}
/* caixa d'arquitectura en coordenades de l'habitatge A (envans i mobiliari de l'edifici), girada amb la parella */
function UB(u,x0,x1,y0,y1,z0,z1,mat,o){
  const a=UW(u,x0,0,z0), b=UW(u,x1,0,z1);
  return aBoxB(Math.min(a.x,b.x),Math.max(a.x,b.x),y0,y1,Math.min(a.z,b.z),Math.max(a.z,b.z),mat,o);
}
/* geometria qualsevol a la cua d'arquitectura (es fusiona per material, com aBox) */
function aGeo(g, mat, o={}){
  const key=mat.uuid+'|'+JSON.stringify(o);
  if(!ARCHQ.has(key)) ARCHQ.set(key,{mat,flags:Object.assign({},o),geos:[]});
  ARCHQ.get(key).geos.push(g.index ? g.toNonIndexed() : g);
}
/* caixa girada al voltant de l'eix x (vessants de la coberta): centre c, angle a */
function aRotX(w,h,d,a,c,mat,o){ const g=new THREE.BoxGeometry(w,h,d); g.rotateX(a); g.translate(c.x,c.y,c.z); aGeo(g,mat,o); }

/* ---------- materials propis ---------- */
function casesMats(){
  const L = (c,o={}) => new THREE.MeshLambertMaterial(Object.assign({color:c}, o));
  Object.assign(AM, {
    rend:[L(0xEFE4D2),L(0xE8D6BE),L(0xF1E8DA),L(0xE6D2B8)],        // arrebossat de cada casa (tons càlids)
    stone:L(0xB4AA9B), roofT:L(0xB4593A), roofD:L(0x9C4A31), ridge:L(0x8E4430), fascia:L(0xF2EEE6),
    shut:L(0x58775A), shut2:L(0x7A5A3E), sill:L(0xD9D3C7), lamp:L(0xFFF3C4,{emissive:0x8A7A40}),
    lawn:L(0xA8C487), lawn2:L(0x9BBB7C), hedge:L(0x5F8A4A), tree:L(0x6E9A52), trunk:L(0x6B4F36), pave:L(0xD7D0C2), gravel:L(0xC9C3B6),
    asph:L(0x6A6D72), kerb:L(0xBEBAB2), soilT:L(0x6E4F35), wood:L(0xA77D55), metal:L(0x55595E), glassD:L(0x5C7184,{transparent:true, opacity:0.55, depthWrite:false}),
    neon:L(0xF7FAFF,{emissive:0x9AA3AA}), red:L(0xC23B2E), car5:L(0x2F6E5E), car6:L(0xE1D7C2)
  });
  AM.list.push(AM.soil, AM.ground, AM.side, AM.street, AM.lawn, AM.lawn2, AM.gravel, AM.asph, AM.kerb, AM.glassD, ...AM.rend, AM.stone, AM.roofT, AM.roofD, AM.ridge, AM.fascia, AM.shut, AM.shut2, AM.sill, AM.lamp, AM.hedge, AM.tree, AM.trunk,
    AM.pave, AM.wood, AM.metal, AM.neon, AM.red, AM.car5, AM.car6, AM.soilT);
}

/* =====================================================================
   ARQUITECTURA
   ===================================================================== */
function buildArchitecture(){
  makePairs(); casesMats();
  buildTerrain(); buildBasementC();
  for(const u of UNITS){ buildHouse(u); buildPartitions(u); buildFurniture(u); }
  buildGardens(); buildStreet(); buildRITUSite();
  flushArch();
}
/* paisatge: cel, muntanyes i plana. La plana de l'esquerra del tall és més baixa (es veu la secció del terreny);
   sense el tall, el terreny continua a la mateixa cota. */
function buildLandscape(){
  SKY_TEX=skyTexture(); FOG=new THREE.Fog(HORIZ,110,290); MOUNTS=buildMountains();
  const F=320, Gd={ground:true, floor:0};
  aBoxB(KC.xc,F,KC.yLow-0.2,KC.yLow,-F,F,AM.ground,Object.assign({cut:true},Gd));
  for(const [z0,z1,top,m] of terrainStrips()) aBoxB(KC.xc,F,top-0.2,top,z0,z1,m,Object.assign({cut:false},Gd));
  flushArch();
}
/* franges del terreny (z0, z1, cota superior, material) d'un costat a l'altre del carrer */
function terrainStrips(){
  return [[-320,KC.zGard,KC.yLawn,AM.ground],[KC.zGard,KC.bas.z1,KC.yLawn,AM.lawn],[KC.bas.z1,KC.walk[0],KC.yLawn,AM.lawn],
    [KC.walk[0],KC.walk[1],KC.yWalk,AM.side],[KC.road[0],KC.road[1],KC.yRoad,AM.asph],[KC.walk2[0],KC.walk2[1],KC.yWalk,AM.side],[KC.walk2[1],320,KC.yLawn,AM.ground]];
}
/* terreny tallat pel pla x = KC.xc: capes superficials (gespa, paviments) i terra (vegetal i argila) fins a la cota yLow.
   El soterrani, la rampa i l'arqueta en buiden el volum. */
function buildTerrain(){
  const Gd={ground:true, floor:0}, F=320, B=KC.bas, R=KC.ramp, x1=KC.xc, yL=KC.yLow, rx0=R.x0-0.3, rx1=R.x1+0.3, AQ=ARQ;
  const soil=(x0,x1,z0,z1,yTop)=>{ if(yTop-0.45>yL) aBoxB(x0,x1,yL,yTop-0.45,z0,z1,AM.soil,Gd); aBoxB(x0,x1,yTop-0.45,yTop,z0,z1,AM.soilT,Gd); };
  const holes=[[rx0,rx1,B.z1,R.z1],[AQ.x-0.52,AQ.x+0.52,AQ.z-0.52,AQ.z+0.52]];
  for(const [z0,z1,top,m] of terrainStrips()){
    if(z1<=B.z0 || z0>=B.z1){            // fora del soterrani: tota l'amplada, menys la rampa i l'arqueta
      const thick = m===AM.asph || m===AM.side ? 0.12 : 0.04;
      for(const [a,b,c,d] of rectMinus(-F,x1,z0,z1,holes)){ aBoxB(a,b,top-thick,top,c,d,m,Gd); soil(a,b,c,d,top-thick); }
    }
  }
  /* sobre el soterrani: camp de l'esquerra de la rampa; sota: terra fins a la cota yLow */
  aBoxB(-F,rx0,KC.yLawn-0.04,KC.yLawn,B.z0,B.z1,AM.ground,Gd); soil(-F,rx0,B.z0,B.z1,KC.yLawn-0.04);
  aBoxB(rx0,x1,yL,B.y-0.2,B.z0,B.z1,AM.soil,Gd);
}
/* rectangle (x0..x1, z0..z1) menys uns forats rectangulars: llista de rectangles */
function rectMinus(x0,x1,z0,z1,holes){
  const hs=holes.filter(h=>h[0]<x1&&h[1]>x0&&h[2]<z1&&h[3]>z0);
  const xs=[...new Set([x0,x1,...hs.flatMap(h=>[h[0],h[1]]).filter(v=>v>x0&&v<x1)])].sort((a,b)=>a-b), out=[];
  for(let i=0;i<xs.length-1;i++){ const a=xs[i], b=xs[i+1], cx=(a+b)/2;
    const zs=[...new Set([z0,z1,...hs.filter(h=>cx>h[0]&&cx<h[1]).flatMap(h=>[h[2],h[3]]).filter(v=>v>z0&&v<z1)])].sort((p,q)=>p-q);
    for(let j=0;j<zs.length-1;j++){ const cz=(zs[j]+zs[j+1])/2; if(!hs.some(h=>cx>h[0]&&cx<h[1]&&cz>h[2]&&cz<h[3])) out.push([a,b,zs[j],zs[j+1]]); } }
  return out;
}
/* ---------- soterrani: aparcament comunitari ---------- */
const PARK={rowB:[-16.2,-11.2], aisle:[-11.2,-5.2], rowF:[-5.2,-0.2]};
function buildBasementC(){
  const B=KC.bas, y=B.y, f=-1, o={floor:f}, x1=KC.xc, R=KC.ramp;
  aBoxB(B.x0,x1,y-0.2,y,B.z0,B.z1,AM.park,{floor:f, slab:true});                                // llosa de terra
  /* murs perimetrals (el de la dreta només sense el tall); a l'esquerra, porta cap al replà de la rampa */
  aBoxB(B.x0,x1,y,0,-0.2,B.z1,AM.concrete,o);                                                    // davant (sota les façanes)
  aBoxB(B.x0,x1,y,-0.32,B.z0,B.z0+0.3,AM.concrete,o);                                            // fons
  aBoxB(B.x0,B.x0+0.3,y,-0.2,-12.4,-0.2,AM.concrete,o); aBoxB(B.x0,B.x0+0.3,y+2.3,-0.32,B.z0+0.3,-12.4,AM.concrete,o);
  aBoxB(x1-0.3,x1,y,-0.2,B.z0,B.z1,AM.concrete,{floor:f, cut:false});
  /* sostre: sota les cases (forjat de la planta baixa, cota 0) i sota els jardins (llosa més baixa, coberta de gespa) */
  for(const u of UNITS){ const [a,b]=houseX(u); aBoxB(a,b,-0.2,0,-6,-0.2,AM.slab,{floor:0, unit:u.id, slab:true}); }
  aBoxB(20,x1,-0.32,-0.12,-6,B.z1,AM.slab,{ground:true, floor:0});                               // zona comuna (RITU)
  aBoxB(B.x0,x1,-0.32,-0.12,B.z0,-6,AM.slab,{ground:true, floor:0});                             // jardins posteriors i zona de la torre
  /* pilars sota les mitgeres */
  for(const x of [-10,0,10,20]) for(const z of [PARK.aisle[0],PARK.aisle[1]]) aBoxB(x-0.2,x+0.2,y,-0.32,z-0.2,z+0.2,AM.concrete,o);
  /* places de 2,4 m entre pilars (crugies de 10 m): fila de davant (morro cap al mur) i fila del fons des de x = -10 */
  const L=(x0,x1,z0,z1)=>aBoxB(x0,x1,y,y+0.012,z0,z1,AM.line,o);
  const bays=[[-19.6,-10.2,4],[-9.8,-0.2,4],[0.2,9.8,4],[10.2,19.8,4],[20.2,25.0,2]], P=[];
  for(const [a,b,k] of bays) for(let i=0;i<k;i++) for(const r of ['F','B']) if(r==='F' || a>-10) P.push([a+i*(b-a)/k, a+(i+1)*(b-a)/k, r]);
  let n=0;
  for(const [a,b,r] of P){ const [z0,z1]= r==='F' ? [PARK.rowF[0],PARK.rowF[1]-0.4] : [PARK.rowB[0]-0.6,PARK.rowB[1]];
    for(const xx of [a,b]) L(xx-0.05,xx+0.05,z0,z1);
    textPlane([String(++n)],0.6,0.6,V((a+b)/2,y+0.016,r==='F'?z0+0.8:z1-0.8),V(0,1,0),{bg:'#9EA2A6',fg:'#FFFFFF',px:128,flags:{floor:f}}); }
  for(let x=-19; x<26; x+=2.4) aBoxB(x,x+1.2,y,y+0.012,-8.25,-8.15,AM.line,o);                  // línia del passadís
  const cars=[[-18.4,'F',AM.car1],[-13.6,'F',AM.car3],[-8.6,'F',AM.car2],[-3.8,'F',AM.car5],[1.4,'F',AM.car4],[13.8,'F',AM.car6],[21.4,'F',AM.car2],
    [-6.2,'B',AM.car6],[3.8,'B',AM.car4],[11.4,'B',AM.car1],[16.2,'B',AM.car3],[23.8,'B',AM.car5]];
  for(const [x,r,m] of cars) carModel(x,y,r==='F' ? (PARK.rowF[0]+PARK.rowF[1])/2+0.1 : (PARK.rowB[0]+PARK.rowB[1])/2-0.1, r==='F'?'+z':'-z', m, o);
  /* llums del sostre (pantalles estanques), rètols i extintors */
  for(let x=-17; x<26; x+=5) for(const z of [-8.2,-2.6,-13.7]) if(!(x>20 && z>-3)) { aBoxB(x-0.6,x+0.6,-0.42,-0.36,z-0.08,z+0.08,AM.neon,o); aBoxB(x-0.62,x+0.62,-0.36,-0.32,z-0.09,z+0.09,AM.frame,o); }
  textPlane(['APARCAMENT COMUNITARI','planta -1'],2.2,0.5,V(5,y+2.25,B.z0+0.31),V(0,0,1),{bg:'#1F3A5F',fg:'#FFFFFF',flags:{floor:f}});
  textPlane(['SORTIDA DE VEHICLES','rampa ↑'],1.8,0.45,V(B.x0+0.31,y+2.0,-14.8),V(1,0,0),{bg:'#2C2C2B',fg:'#FFFFFF',flags:{floor:f}});
  for(const x of [0,20]) aBoxB(x+0.2,x+0.22,y+1.0,y+1.5,PARK.aisle[0]-0.06,PARK.aisle[0]+0.06,AM.red,o);
  /* rampa: llosa inclinada (de la vorera al replà), replà, murs laterals amb barana i porta enrotllada */
  const len=R.z1-R.z0, drop=y-KC.yWalk, ang=Math.atan2(-drop,len), cx=(R.x0+R.x1)/2;
  { const g=new THREE.BoxGeometry(R.x1-R.x0,0.25,Math.hypot(len,drop)); g.rotateX(-ang); g.translate(cx,(KC.yWalk+y)/2-0.125/Math.cos(ang),(R.z0+R.z1)/2); aGeo(g,AM.concrete,{floor:f, ramp:true}); }
  for(let i=0;i<10;i++){ const z=R.z1-0.8-i*1.5, yy=KC.yWalk+drop*(R.z1-z)/len; const g=new THREE.BoxGeometry(R.x1-R.x0-0.6,0.03,0.1); g.rotateX(-ang); g.translate(cx,yy+0.01,z); aGeo(g,AM.lineY,{floor:f}); }
  aBoxB(R.x0,R.x1,y-0.2,y,B.z0+0.3,R.z0,AM.park,{floor:f, slab:true});
  aBoxB(R.x0-0.3,R.x0,y-0.2,0.05,B.z0+0.3,R.z1,AM.concrete,{floor:f}); aBoxB(R.x1,R.x1+0.3,y-0.2,0.05,R.z0,R.z1,AM.concrete,{floor:f});
  aBoxB(R.x0-0.3,R.x1+0.3,y-0.2,-0.12,B.z0,B.z0+0.3,AM.concrete,{floor:f});
  for(const x of [R.x0-0.15,R.x1+0.15]){ aBoxB(x-0.03,x+0.03,0.95,1.0,R.z0-5,R.z1,AM.rail,{floor:0}); for(let z=R.z0-5;z<=R.z1;z+=1.5) aBoxB(x-0.02,x+0.02,0.05,0.97,z-0.02,z+0.02,AM.rail,{floor:0}); }
  aBoxB(B.x0-0.02,B.x0+0.32,y+2.15,y+2.35,-17.15,-12.45,AM.doorM,o);
}
/* cotxe d'exemple (turisme de 4,3 × 1,8 m): perfil lateral extruït, vidres foscos, rodes i llums.
   dir: cap on mira el morro ('+z', '-z', '+x' o '-x') */
function carModel(x, y, z, dir, mat, o){
  const W=1.78, rot={'+z':-Math.PI/2,'-z':Math.PI/2,'+x':0,'-x':Math.PI}[dir];
  const T=g=>{ g.rotateY(rot); g.translate(x,y,z); return g; };            // local: x llargada (morro a +x), y alçada, z amplada
  const ext=(pts,d,m)=>{ const sh=new THREE.Shape(); sh.moveTo(...pts[0]); for(const p of pts.slice(1)) sh.lineTo(...p); sh.closePath();
    const g=new THREE.ExtrudeGeometry(sh,{depth:d,bevelEnabled:false}); g.translate(0,0,-d/2); aGeo(T(g),m,o); };
  ext([[-2.15,0.32],[-2.15,0.78],[-1.95,0.92],[-1.0,0.98],[-0.55,1.42],[0.85,1.45],[1.35,1.0],[2.05,0.9],[2.15,0.7],[2.15,0.32]],W,mat);
  ext([[-0.95,1.0],[-0.52,1.38],[0.82,1.4],[1.25,1.02]],W+0.02,AM.glassD);
  for(const a of [-1.35,1.35]) for(const b of [-0.8,0.8]){ const g=new THREE.CylinderGeometry(0.33,0.33,0.24,14); g.rotateX(Math.PI/2); g.translate(a,0.33,b); aGeo(T(g),AM.tyre,o); }
  for(const b of [-0.58,0.58]){ aGeo(T(new THREE.BoxGeometry(0.04,0.12,0.26).translate(2.15,0.68,b)),AM.lamp,o); aGeo(T(new THREE.BoxGeometry(0.04,0.1,0.3).translate(-2.15,0.72,b)),AM.red,o); }
}

/* ---------- cases: murs, finestres, coberta ---------- */
function buildHouse(u){
  const [hx0,hx1]=houseX(u), id=u.id, o={floor:0, unit:id}, o1={floor:1, unit:id}, H=KC.H, n=u.n, R=AM.rend[n-1];
  const F={floor:0, unit:id, facade:true, fside:'front'}, Fb={floor:0, unit:id, facade:true, fside:'back'};
  const F1={floor:1, unit:id, facade:true, fside:'front'}, Fr={floor:1, unit:id, facade:true, fside:'roof'};
  const op=(z0,z1,b0,b1,k)=>{ const a=XZ(u,z0), b=XZ(u,z1); return [Math.min(a,b),Math.max(a,b),b0,b1,...(k?[k]:[])]; };
  const door=op(-3.4,-2.5,0,2.15,'door'), w2=op(-1.0,0.4,0.9,2.15), w1=op(2.5,3.7,0.9,2.15);
  const wc=op(-3.8,-2.6,1.0,2.15), ws=op(-0.7,0.9,0,2.2), wb=op(3.55,4.35,1.5,2.1);
  /* planta baixa: façanes amb obertures, mitgeres (o testeres als extrems) i sòcol de pedra */
  wallOps(WB,'x',hx0,hx1,-0.2,0,0,H,[door,w2,w1],R,F,F);
  wallOps(WB,'x',hx0,hx1,-6,-5.75,0,H,[wc,ws,wb],R,Fb,Fb);
  for(const [a,b,end] of [[hx0,hx0+0.25,hx0===-20],[hx1-0.25,hx1,hx1===20]]){
    const fl = end ? {floor:0, unit:id, facade:true, fside:'side'} : o;
    aBoxB(a,b,0,H,-5.75,-0.2,end?R:AM.wall,fl);
  }
  for(const [z0,z1,ops] of [[0,0.03,[door]],[-6.03,-6,[ws]]]){
    let a=hx0-(hx0===-20?0.03:0); const segs=[];
    for(const p of ops.slice().sort((p,q)=>p[0]-q[0])){ segs.push([a,p[0]]); a=p[1]; }
    segs.push([a,hx1+(hx1===20?0.03:0)]);
    for(const [s0,s1] of segs) aBoxB(s0,s1,0,0.45,z0,z1,AM.stone,z0>-1?F:Fb);
  }
  /* ampits, llindes i porticons (persianes de llibret) */
  for(const [w,zf,s] of [[w2,0,1],[w1,0,1],[wc,-6,-1],[wb,-6,-1]]){
    const [a,b,b0,b1]=w, Fx=s>0?F:Fb, zo=zf+s*0.0;
    aBoxB(a-0.06,b+0.06,b0-0.05,b0,s>0?zo:zo-0.07,s>0?zo+0.07:zo,AM.sill,Fx);
    aBoxB(a-0.04,b+0.04,b1,b1+0.12,s>0?zo:zo-0.015,s>0?zo+0.015:zo,AM.facade2,Fx);
    const hw=(b-a)/2;
    if(w!==wb) for(const [p0,p1] of [[a-hw,a],[b,b+hw]]) aBoxB(p0+0.01,p1-0.01,b0,b1,s>0?zo+0.005:zo-0.035,s>0?zo+0.035:zo-0.005,n%2?AM.shut:AM.shut2,Fx);
  }
  /* porta d'entrada, marquesina, número i aplic */
  const dx=(door[0]+door[1])/2, dw=door[1]-door[0];
  archDoor(`ent:${id}`,`porta d'entrada de la ${u.name}`,door[0],0,-0.1,V(1,0,0),dw,2.15,V(0,0,-1),AM.door,o);
  aBoxB(dx-0.75,dx+0.75,2.4,2.48,0,0.95,AM.fascia,F); aBoxB(dx-0.75,dx+0.75,2.36,2.4,0.9,0.95,AM.metal,F);
  for(const s of [-1,1]) aBoxB(dx+s*0.7-0.02,dx+s*0.7+0.02,2.25,2.4,0,0.9,AM.metal,F);
  textPlane([String(n)],0.22,0.22,V(door[1]+0.3,1.75,0.012),V(0,0,1),{bg:'#2E3B4E',fg:'#FFFFFF',px:128,flags:F});
  aBoxB(door[0]-0.36,door[0]-0.24,1.95,2.12,0,0.08,AM.lamp,F);
  /* golfes: forjat, murs fins al ràfec i testeres o mitgeres triangulars */
  aBoxB(hx0,hx1,H,3.0,-6,0,AM.slab,Fr);
  aBoxB(hx0,hx1,H,KC.yK,-0.2,0,R,F1); aBoxB(hx0,hx1,H,KC.yK,-6,-5.75,R,{floor:1, unit:id, facade:true, fside:'back'});
  aBoxB(hx0,hx1,H,H+0.12,0,0.05,AM.facade2,F1); aBoxB(hx0,hx1,H,H+0.12,-6.05,-6,AM.facade2,{floor:1, unit:id, facade:true, fside:'back'});
  for(const [a,b,end] of [[hx0,hx0+0.25,hx0===-20],[hx1-0.25,hx1,hx1===20]]) gable(a,b,end?R:AM.wall,end?{floor:1, unit:id, facade:true, fside:'side'}:o1);
  buildRoof(u,hx0,hx1);
}
/* mitgera o testera de les golfes: pentàgon (de la cota 2,8 fins al vessant) extruït en x */
function gable(x0, x1, mat, o){
  const s=new THREE.Shape(); s.moveTo(0,KC.H); s.lineTo(0,KC.yK); s.lineTo(3,Y_RIDGE); s.lineTo(6,KC.yK); s.lineTo(6,KC.H); s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:x1-x0,bevelEnabled:false}); g.rotateY(Math.PI/2); g.translate(x0,0,0); aGeo(g,mat,o);
}
/* coberta de teula a dues aigües (carener paral·lel al carrer): vessants, filades de teules, carener, ràfecs, canals,
   baixants, tallafocs a les mitgeres, finestra de coberta i xemeneia (cases 1 i 3) */
function buildRoof(u, hx0, hx1){
  const o={floor:1, unit:u.id, facade:true, fside:'roof'}, a=KC.pitch*Math.PI/180, c=Math.cos(a), sn=Math.sin(a), t=0.16, ov=0.45;
  const x0=hx0-(hx0===-20?0.35:0), x1=hx1+(hx1===20?0.35:0), W=x1-x0, xm=(x0+x1)/2;
  const run=3+ov, L=run/c+0.02;
  for(const s of [1,-1]){                                    // s = 1: vessant davanter; s = -1: posterior
    const zm=-3+s*run/2, ym=KC.yK+(3-run/2)*TANP;
    aRotX(W,t,L,s*a,V(xm,ym+c*t/2,zm+s*sn*t/2),AM.roofT,o);
    for(let k=1;k<run/c/0.34;k++){ const d=k*0.34, zz=-3+s*d*c, yy=Y_RIDGE-d*sn;
      aRotX(W,0.035,0.06,s*a,V(xm,yy+c*(t+0.012),zz+s*sn*(t+0.012)),AM.roofD,o); }
    /* ràfec: tauler frontal i canal */
    const ze=-3+s*run, ye=KC.yK-ov*TANP;
    aBoxB(x0,x1,ye-0.12,ye+0.1,s>0?ze:ze-0.04,s>0?ze+0.04:ze,AM.fascia,o);
    const gc=new THREE.CylinderGeometry(0.07,0.07,W,10,1,false,0,Math.PI); gc.rotateZ(Math.PI/2); gc.rotateX(Math.PI); gc.translate(xm,ye-0.02,ze+s*0.08); aGeo(gc,AM.metal,o);
  }
  { const g=new THREE.CylinderGeometry(0.11,0.11,W,10); g.rotateZ(Math.PI/2); g.translate(xm,Y_RIDGE+t/c,-3); aGeo(g,AM.ridge,o); }
  /* baixant a la mitgera de la dreta (davant i darrere) */
  for(const z of [0.1,-6.1]){ const g=new THREE.CylinderGeometry(0.045,0.045,KC.yK-0.15,10); g.translate(hx1-0.15,(KC.yK-0.15)/2,z); aGeo(g,AM.metal,{floor:0, unit:u.id, facade:true, fside:z>0?'front':'back'}); }
  /* tallafocs: la mitgera de la dreta (si no és l'extrem) sobresurt 15 cm per sobre de les teules */
  if(hx1<20) for(const s of [1,-1]) aRotX(0.26,0.1,3.4/c,s*a,V(hx1,KC.yK+1.6*TANP+c*(t+0.05),-3+s*1.6+s*sn*(t+0.05)),AM.ridge,o);
  /* finestra de coberta al vessant davanter i xemeneia */
  const xs=(hx0+hx1)/2+(u.s==='A'||u.s==='C'?-1.4:1.4), d=1.6;
  aRotX(0.78,0.06,1.0,a,V(xs,Y_RIDGE-d*sn+c*(t+0.03),-3+d*c+sn*(t+0.03)),AM.frame,o);
  aRotX(0.66,0.07,0.88,a,V(xs,Y_RIDGE-d*sn+c*(t+0.04),-3+d*c+sn*(t+0.04)),AM.glassD,o);
  if(u.n===1||u.n===3){ const xc=hx1-1.2, zc=-4.0; aBoxB(xc-0.3,xc+0.3,KC.yK+1.0,Y_RIDGE+0.9,zc-0.3,zc+0.3,AM.rend[u.n-1],o); aBoxB(xc-0.36,xc+0.36,Y_RIDGE+0.9,Y_RIDGE+0.98,zc-0.36,zc+0.36,AM.roofD,o); }
}

/* ---------- jardins (davant i darrere) ---------- */
function buildGardens(){
  const g={ground:true, floor:0};
  for(const u of UNITS){
    const [hx0,hx1]=houseX(u), dz=XZ(u,-2.95), o={floor:0, unit:u.id};
    /* davant: camí de l'entrada, replà, mur baix amb porta, bústia i bardissa */
    aBoxB(dz-0.6,dz+0.6,KC.yLawn,-0.02,0,KC.walk[0]-0.2,AM.pave,g);
    aBoxB(dz-0.9,dz+0.9,KC.yLawn,0,0,1.0,AM.pave,g);
    for(const [a,b] of [[hx0,dz-0.55],[dz+0.55,hx1]]){
      aBoxB(a,b,KC.yLawn,0.55,KC.walk[0]-0.2,KC.walk[0],AM.rend[u.n-1],g); aBoxB(a,b,0.55,0.6,KC.walk[0]-0.23,KC.walk[0]+0.03,AM.sill,g);
      aBoxB(a+0.05,b-0.05,KC.yLawn,0.85,KC.walk[0]-0.75,KC.walk[0]-0.25,AM.hedge,g); }
    aBoxB(dz-0.55,dz+0.55,0.0,0.95,KC.walk[0]-0.13,KC.walk[0]-0.07,AM.metal,g);                 // porta de la tanca
    aBoxB(dz+0.62,dz+0.98,0.65,0.95,KC.walk[0]-0.02,KC.walk[0]+0.04,AM.metal,g);                // bústia
    if(hx1<20) aBoxB(hx1-0.08,hx1+0.08,KC.yLawn,0.7,0.0,KC.walk[0]-0.25,AM.hedge,g);             // bardissa entre jardins
    /* darrere: terrassa, tanca de fusta entre jardins, arbre i taula */
    aBoxB(hx0,hx1,KC.yLawn,KC.yLawn+0.015,KC.zGard,-8.2,AM.lawn,g);
    aBoxB(hx0,hx1,KC.yLawn,-0.02,-8.2,-6,AM.pave,g);
    if(hx1<20) for(let z=KC.zGard; z<-6.05; z+=0.12) aBoxB(hx1-0.02,hx1+0.02,KC.yLawn,1.5,z,z+0.1,AM.wood,g);
    if(hx1<20) aBoxB(hx1-0.03,hx1+0.03,1.3,1.38,KC.zGard,-6.05,AM.wood,g);
    tree((hx0+hx1)/2+(u.n%2?2.5:-2.5),-14.0,u.n%2?1.0:0.85,g);
    aBoxB(hx0+1.5,hx0+2.5,0.7,0.74,-7.6,-6.8,AM.wood,g); for(const s of [-1,1]) aBoxB(hx0+2+s*0.4-0.03,hx0+2+s*0.4+0.03,-0.02,0.7,-7.25,-7.15,AM.metal,g);
  }
  /* bardissa del fons de tots els jardins */
  aBoxB(-20,KC.xc-0.2,KC.yLawn,1.3,KC.zGard,KC.zGard+0.5,AM.hedge,g);
}
function tree(x, z, k, o){
  const tr=new THREE.CylinderGeometry(0.11*k,0.15*k,2.2*k,8); tr.translate(x,KC.yLawn+1.1*k,z); aGeo(tr,AM.trunk,o);
  for(const [dx,dy,dz,r] of [[0,3.0,0,1.25],[0.6,2.6,0.3,0.9],[-0.55,2.7,-0.35,0.95],[0.1,3.6,-0.2,0.85]]){
    const g=new THREE.IcosahedronGeometry(r*k,1); g.translate(x+dx*k,KC.yLawn+dy*k,z+dz*k); aGeo(g,AM.tree,o); }
}
/* ---------- carrer: voreres, vorades, calçada, fanals, arbres i cotxes ---------- */
function buildStreet(){
  const g={ground:true, floor:0}, x1=KC.xc;
  for(const z of [KC.road[0],KC.road[1]]) aBoxB(-320,x1,KC.yRoad,KC.yWalk+0.01,z-0.12,z+0.12,AM.kerb,g);
  for(let x=x1-4; x>-300; x-=6) aBoxB(x,x+3,KC.yRoad,KC.yRoad+0.01,9.95,10.05,AM.line,g);
  for(const x of [-18,-6,8,22]){
    const p=new THREE.CylinderGeometry(0.06,0.08,4.6,8); p.translate(x,KC.yWalk+2.3,6.0); aGeo(p,AM.metal,g);
    aBoxB(x-0.04,x+0.04,KC.yWalk+4.5,KC.yWalk+4.58,5.4,6.0,AM.metal,g); aBoxB(x-0.16,x+0.16,KC.yWalk+4.38,KC.yWalk+4.5,5.2,5.6,AM.lamp,g); }
  for(const x of [-13,-1,15]){ aBoxB(x-0.6,x+0.6,KC.yWalk,KC.yWalk+0.03,4.9,6.1,AM.soilT,g); tree(x,5.5,0.8,g); }
  carModel(-9.0,KC.yRoad,8.1,'+x',AM.car2,g); carModel(3.5,KC.yRoad,8.1,'+x',AM.car5,g); carModel(17.0,KC.yRoad,11.9,'-x',AM.car3,g);
}
/* ---------- zona comuna del RITU: grava, camí, mur amb porta, tanca amb el jardí de la casa 4 i llosa del RITU ---------- */
function buildRITUSite(){
  const g={ground:true, floor:0}, w=KC.walk[0];
  aBoxB(20,KC.xc,KC.yLawn,KC.yLawn+0.02,KC.zGard+0.5,w-0.2,AM.gravel,g);
  aBoxB(20.4,21.6,KC.yLawn,-0.02,-1.4,w-0.2,AM.pave,g);
  for(const [a,b] of [[20,20.45],[21.55,KC.xc]]){ aBoxB(a,b,KC.yLawn,0.55,w-0.2,w,AM.rend[2],g); aBoxB(a,b,0.55,0.6,w-0.23,w+0.03,AM.sill,g); }
  aBoxB(20.45,21.55,0.0,1.2,w-0.13,w-0.07,AM.metal,g);
  textPlane(['Instal·lacions comunes','RITU'],0.9,0.3,V(22.6,0.38,w+0.035),V(0,0,1),{bg:'#2F6FDE',fg:'#FFFFFF',flags:g,px:256});
  for(let z=KC.zGard+0.5; z<-6.05; z+=0.12) aBoxB(19.98,20.02,KC.yLawn,1.5,z,z+0.1,AM.wood,g);
  aBoxB(19.97,20.03,1.3,1.38,KC.zGard+0.5,-6.05,AM.wood,g);
  aBoxB(RITU.x+2.25,RITU.x+5.1,-0.32,0,RITU.z-0.59,RITU.z+3.56,AM.concrete,{floor:0});           // llosa de fonamentació del RITU
  /* sòcol de pedra al voltant del RITU (menys a la porta) i vorera de formigó */
  const rx0=RITU.x+2.355, rx1=RITU.x+5.0, rz0=RITU.z-0.475, rz1=RITU.z+3.475, so={floor:0};
  aBoxB(rx1,rx1+0.015,0,0.4,rz0,rz1,AM.stone,so); aBoxB(rx0-0.015,rx1+0.015,0,0.4,rz0-0.015,rz0,AM.stone,so); aBoxB(rx0-0.015,rx1+0.015,0,0.4,rz1,rz1+0.015,AM.stone,so);
  aBoxB(rx0-0.015,rx0,0,0.4,rz0,RITU.z+2.13,AM.stone,so); aBoxB(rx0-0.015,rx0,0,0.4,RITU.z+3.13,rz1,AM.stone,so);
  aBoxB(rx0-0.9,rx0,KC.yLawn,-0.02,RITU.z+1.9,RITU.z+3.4,AM.pave,g);
}
/* =====================================================================
   ICT DEL CONJUNT
   Senyal: RITU (a la dreta) → canalització principal (5 × Ø50) pel sostre del soterrani, arran del mur de davant →
   registre secundari 2 (mitgera de les cases 3 i 4) → registre secundari 1 (cases 1 i 2) → per cada casa, canalització
   secundària (3 × Ø25) per dins de la mitgera fins al registre de terminació de xarxa (RTR).
   ===================================================================== */
let RITI_ROOT=null;
const RSX={2:10, 1:-10};                                  // registres secundaris: x de la mitgera (el 2 rep primer el senyal)
const RSD={w:0.55, h:1.0, d:0.15, y:-0.75};               // 550 × 1000 × 150 mm (mida de catàleg), centre a la cota −0,75
const ML={rtv:-0.125, fo:-0.20, pt:-0.275, tba:-0.35, res:-0.425};   // tubs principals al registre (y local)
const ZW=-0.275;                                          // eix dels tubs principals i secundaris: 7,5 cm davant del mur
const TOPX={tba:0.12, all:0.17, rtv:0.22};                // sortides de la canalització secundària per dalt (|x| local)
const HRTR={rtv:1.80, all:1.55, tba:1.30};                // alçada d'entrada de cada tub al RTR (per la paret del fons)
const TAPC=TAPCASES;                                      // derivadors (pèrdua de derivació, js/dades-cases.js): el 1 tanca la línia
const RSG={}, RSP={};
const unitC = u => (houseX(u)[0]+houseX(u)[1])/2;
const rsUnits = i => UNITS.filter(u=>Math.abs(unitC(u)-RSX[i])<6);
const sideOf = (i,u) => unitC(u) < RSX[i] ? 1 : -1;       // +1: casa a l'esquerra de la mitgera (x local positiva al registre)
const rsW = (i,x,y,z) => V(x,y,z).applyMatrix4(RSG[i].matrixWorld);
const ritiW = (x,y,z) => V(x,y,z).applyMatrix4(RITI_ROOT.matrixWorld);
const ritsL = v => v.clone().applyMatrix4(RITSI.copy(RITSM).invert());
const A3 = v => [v.x,v.y,v.z];
const inTubeR = (pts,v,R) => pts.map(p=>[p[0]+v[0],p[1]+v[1],p[2]+v[2],p[3]??R]);   // com inTube(), però conserva el radi propi de cada punt
const XDROP = () => RITU.x-RZ;                            // x dels baixants sota el RITU

function buildICT(){
  const C={reg:0x6F7F8F, regLid:0x8D9AA8};
  /* canalització principal: l'ordre dels tubs a la sortida del RITU fixa l'ordre en alçada al soterrani (RTV a dalt) */
  Object.assign(RX,{res:0.55, tba1:0.675, tba2:0.80, pt:0.925, fo:1.05, rtv:1.175}); RITS_OPEN.push('fo','pt');
  /* STDP: 4 cases × 2 línies × 1,2 = 9,6 parells → mànega de 25 parells (3 regletes de sortida); entrada 1,5 × 25 → 4 regletes */
  Object.assign(KRP,{nin:4, nout:3, lin:['OPERADOR','entrada · 40 parells'], lout:['CONJUNT','sortida · 25 parells'], J:[[0,2,0,1],[1,5,0,3],[2,1,1,1],[3,7,1,3]]});
  CBL.pt25={d:0.0108, rb:0.108}; CBL_KEY.unshift([/^xd_pt25/,'pt25']);
  /* RITU */
  RITS_ROOT=new THREE.Group(); RITS_ROOT.position.set(RITU.x,-15,RITU.z); RITS_ROOT.rotation.y=RITU.rot; scene.add(RITS_ROOT); RITS_ROOT.updateMatrixWorld(true);
  RITSM.copy(RITS_ROOT.matrixWorld);
  withRoot(RITS_ROOT,()=>{ buildRITS();
    /* rètol del recinte, a la paret de la porta (per fora) */
    rPlane('rits',0.62,0.24,V(1.3,16.95,-2.354),V(0,0,1),textTex(['RITU','Recinte de telecomunicacions'],{w:620,h:240,fs:[96,40],bold:[true,false],bg:'#2F6FDE',fg:'#FFFFFF'}),{ritsPart:'front'}); });
  /* registres principals (RITI) a la paret de la porta, i registre d'enllaç a sota */
  RITI_ROOT=new THREE.Group(); RITI_ROOT.position.set(RITI.x,0,RITI.z); RITI_ROOT.rotation.y=RITI.rot; scene.add(RITI_ROOT); RITI_ROOT.updateMatrixWorld(true);
  withRoot(RITI_ROOT,()=>{
    regBox('rp_fo',0.75,1.0,0.3,2.05,1.45,-4.6,C.reg,C.regLid); regBox('rp_pt',0.6,1.0,0.3,2.95,1.45,-4.6,C.reg,C.regLid);
    buildRITIFibre(); buildRITIPairs();
    regBox('reg_enllac_inf',0.45,0.45,0.12,1.55,0.45,-4.69,C.reg,C.regLid);
  });
  buildTowerBase(); buildEntryC();
  for(const i of [1,2]) buildRSC(i,C);
  buildMainC();
  for(const u of UNITS) buildHouseICT(u);
  flushMouths(); flushArch();
}
/* daus de formigó de la torre i dels ancoratges dels tirants (la torre és a terra, al costat del RITU) */
function buildTowerBase(){
  const o={floor:0}, t=V(ANT.TX,15,ANT.TZ).applyMatrix4(RITSM);
  aBoxB(t.x-0.5,t.x+0.5,KC.yLawn,0,t.z-0.5,t.z+0.5,AM.concrete,o);
  for(const g of ANT.info.guys||[]){ const a=g.anchor.clone().applyMatrix4(RITSM); aBoxB(a.x-0.25,a.x+0.25,KC.yLawn,0.04,a.z-0.25,a.z+0.25,AM.concrete,o); }
}

/* ---------- entrada: arqueta, canalització externa, punt d'entrada general i enllaç inferior ----------
   RD 346/2011: 4 tubs de Ø63 (fibra de dos operadors, parells i reserva). Travessen el mur del soterrani (PEG) apilats,
   pugen al RITU un darrere l'altre (arcs paral·lels de radi 0,25) i entren pel fons al registre d'enllaç. */
const ENL=[{k:'fo',y:-0.45},{k:'fo2',y:-0.52},{k:'pt',y:-0.59},{k:'res',y:-0.66}];
function buildEntryC(){
  const ax=ARQ.x, az=ARQ.z, y0=KC.yWalk, RAL=0.25, R0=0.0315;
  iBox('arqueta',1.0,0.06,1.0,ax,y0-0.92,az,0x8A8A85);
  iBox('arqueta',1.0,0.86,0.08,ax,y0-0.5,az-0.46,0x9C9C96); iBox('arqueta',1.0,0.86,0.08,ax,y0-0.5,az+0.46,0x9C9C96);
  iBox('arqueta',0.08,0.86,1.0,ax-0.46,y0-0.5,az,0x9C9C96); iBox('arqueta',0.08,0.86,1.0,ax+0.46,y0-0.5,az,0x9C9C96);
  iBox('arqueta',1.04,0.05,1.04,ax,y0,az,0x55595E,{lidOf:'arqueta'});
  /* PEG: passamurs al mur de davant del soterrani, amb placa */
  iBox('peg',0.24,0.36,0.32,ax,-0.555,-0.05,0xD08A3A); iBox('peg',0.4,0.5,0.03,ax,-0.555,0.115,0xE6B47A,{opacity:0.9});
  const riseZ=k=>RITI.z-(1.445+0.07*k), yReg=0.25;
  ENL.forEach((t,k)=>{
    tube('canal_ext',[[ax,t.y,az-0.42],[ax,t.y,0.11]],R0,{mouth:0});
    tube('canal_enllac_inf',[[ax,t.y,0.09],[ax,t.y,riseZ(k)],[ax,yReg,riseZ(k)]],R0,{R:RAL, mouth:1});
  });
  /* xarxes d'alimentació: de la calçada a l'arqueta, pels tubs i, des del registre d'enllaç, fins a les CTO i la regleta */
  const K=CTO_FO, g0=K.ops[0].gland, g1=K.ops[1].gland;
  const tails={fo:[[1.445,0.70,-4.69],[1.445,g0[1],-4.69],[g0[0]-0.002,g0[1],g0[2]]],
               fo2:[[1.515,0.70,-4.69],[1.515,g1[1],-4.66],[g1[0]-0.002,g1[1],g1[2]]],
               pt:[[1.585,0.80,-4.70],[2.688,0.80,-4.705],[2.688,1.50,-4.705]]};
  ENL.forEach((t,k)=>{ if(!tails[t.k]) return;
    const el=t.k==='pt'?'xal_pt':'xal_fo', x=ax+(k-1.5)*0.03, tl=tails[t.k].map(p=>A3(ritiW(...p)));
    cable(`xal_${t.k}_1`,el,[[x,-0.8,13.4],[x,-0.8,az+0.75],[ax,-0.8,az+0.42],[ax,t.y,az+0.2],[ax,t.y,az-0.2]],{from:'operador', to:'arqueta'});
    cable(`xal_${t.k}_2`,el,[[ax,t.y,az-0.2],[ax,t.y,0.1]],{from:'arqueta', to:'peg', via:'canal_ext'});
    cable(`xal_${t.k}_3`,el,[[ax,t.y,0.1],[ax,t.y,riseZ(k),RAL],[ax,yReg,riseZ(k),RAL],...tl],{from:'peg', to:el==='xal_fo'?'pi_fo':'pi_pt', via:'canal_enllac_inf', R:CBL[el==='xal_fo'?'foAlim':'ptAlim'].rb});
  });
}

/* ---------- registre secundari (500 × 1000 mm de catàleg 550 × 1000 × 150) al mur de davant, sota la mitgera ----------
   Grup girat 180°: x local cap a −x de l'escena, z local cap al soterrani. A dins (de dalt a baix): regleta de 10 parells
   (punt de distribució de parells), dos derivadors F 4D (ports cap avall: entrada a l'esquerra, sortida a la dreta) i, sobre la
   línia del tub de fibra, la caixa de segregació. Els cables de dispersió surten per dalt cap a les dues cases. */
const DRV={a:-0.10, b:0.06, y:0.05};
function buildRSC(i, C){
  const g=new THREE.Group(); g.position.set(RSX[i],RSD.y,-0.2); g.rotation.y=Math.PI; scene.add(g); g.updateMatrixWorld(true); RSG[i]=g;
  const ports=RSP[i]={};
  withRoot(g,()=>{
    regBox(`rs_${i}`,RSD.w,RSD.h,RSD.d,0,0,RSD.d/2,C.reg,C.regLid);
    const el=`deriv_${i}`;
    for(const c of ['a','b']){
      const xc=DRV[c], yd=DRV.y, P=ports[c]={};
      if(MODELS.deriv?.scene){
        const ms=placeModel('deriv',el,xc,yd,0.025); for(const m of ms) G.pick.push(m);
        for(const [txt,dx,dy,w] of [[`${TAPC[i].db}dB`,-0.0276,-0.0033,0.0072],[`${TAPC[i].ref}/F 4D`,0.0314,-0.0003,0.0186]]){
          const tm=rPlane(el,w,0.0026,V(xc+dx,yd+dy,0.025+0.0186),V(0,0,1),tapText(txt,Math.round(w*20000),52)); tm.material.alphaTest=0.5; }
        addProxy(ms[0],new THREE.BoxGeometry(0.14,0.12,0.08).translate(xc,yd,0.034));
      } else iBox(el,0.109,0.054,0.018,xc,yd,0.034,0xD7DCE2);
      for(const name of ['in','t1','t2','t3','t4','out']){
        const mp=modelPoint('deriv',name), q=mp||{x:DPX[name], y:-0.0267, z:0.009}, port=V(xc+q.x,yd+q.y,0.025+q.z);
        if(name==='t3'||name==='t4'||(name==='out'&&i===1)){                       // ports lliures: càrrega de 75 Ω
          if(MODELS.carrega?.scene){ for(const m of placeModel('carrega',el,port.x,port.y,port.z,{},[Math.PI,0,0])) G.pick.push(m); }
          else iCyl(el,0.006,0.02,port.x,port.y-0.013,port.z,0x222222,'y',{pick:false});
          continue; }
        const cel = name==='in'||name==='out' ? 'xd_rtv' : `xs_rtv_${rsUnits(i).find(u=>sideOf(i,u)===tapSide(c,name)).id}`;
        P[name]=coaxPlug(cel,port.clone().add(V(0,0.004,0)),V(0,-1,0));
      }
    }
    /* caixa de segregació de fibra (160 × 90 × 80 mm) sobre la línia del tub de fibra: la distribució hi entra i en surt pels
       laterals; les escomeses de les dues cases surten per dalt */
    { const el=`cseg_${i}`, cx=0.12, cy=ML.fo, gl=[], cyl=new THREE.CylinderGeometry(0.0065,0.0065,0.012,12);
      iBox(el,0.16,0.09,0.08,cx,cy,0.065,0xF2F2F2);
      iBox(el,0.10,0.025,0.006,cx,cy+0.012,0.108,0x0AA5C2,{pick:false});
      const M=(x,y,z,ax)=>{ const m=new THREE.Matrix4().makeTranslation(x,y,z); if(ax==='x') m.multiply(new THREE.Matrix4().makeRotationZ(Math.PI/2)); return m; };
      gl.push([cyl,M(cx-0.086,cy,0.075,'x'),0x3A3F45]); if(i===2) gl.push([cyl,M(cx+0.086,cy,0.075,'x'),0x3A3F45]);
      for(const dx of [-0.03,0.03]) gl.push([cyl,M(cx+dx,cy+0.051,0.075),0x3A3F45]);
      ictMesh(mergeParts(gl),0xFFFFFF,el,{std:{roughness:0.8,metalness:0,vertexColors:true}}); }
    /* punt de distribució de parells: regleta Krone de 10 parells sobre placa (entrada per sota, sortides per dalt) */
    rBox(`bucle_${i}`,-0.085,0.085,0.29,0.37,0.025,0.035,0xB9BEC2,'galv',{pick:true});
    kroneModule(`bucle_${i}`,0,0.33,0.035);
  });
}
/* derivador c, port t: cap a quin costat va (+1: casa de x local positiva). Vegeu els carrils de buildHouseICT(). */
const tapSide = (c,t) => (c==='a'&&t==='t2')||(c==='b'&&t==='t1') ? 1 : -1;

/* ---------- canalització principal i xarxes de distribució ---------- */
const MAINK={rtv:'rtv', fo:'fo', pt:'pt', tba:'tba1', res:'res'};
function mainPath(k){ const z0=RITU.z+RX[MAINK[k]], y=RSD.y+ML[k];
  return [[XDROP(),-0.05,z0],[XDROP(),y,z0],[XDROP(),y,ZW],[RSX[2]+RSD.w/2-DINS,y,ZW]]; }
function mainPath2(k){ const y=RSD.y+ML[k]; return [[RSX[2]-RSD.w/2+DINS,y,ZW],[RSX[1]+RSD.w/2-DINS,y,ZW]]; }
function buildMainC(){
  const RM=0.25;
  for(const k of Object.keys(ML)){
    tube('canal_principal',mainPath(k),RPR,{tubeSvc:k, R:RM, mouth:1});
    tube('canal_principal',mainPath2(k),RPR,{tubeSvc:k, mouth:2});
  }
  /* RTV: dos coaxials (1 blanc, 2 negre). Dins dels tubs, desplaçats w; dins del registre, carrils propis (z local a: 0,083; b: 0,067) */
  const z0=RITU.z+RX.rtv, W={};
  for(const c of ['a','b']){ const ex=RITS_EXIT[c].clone().applyMatrix4(RITSM); W[c]=[ex.x-XDROP(), c==='a'?0.005:-0.005, ex.z-z0]; }
  const rsIn = (i,c) => { const P=RSP[i][c].in, w=W[c], oy=w[1], oz=-w[2], zc=0.075+oz, x=P.x;
    return [[-RSD.w/2+DINS,ML.rtv+oy,zc],[x,ML.rtv+oy,zc],[x,-0.075,zc],[x,P.y-0.02,0.034],[x,P.y,P.z]].map(p=>A3(rsW(i,...p))); };
  const rsOut = i => c => { const P=RSP[i][c].out, w=W[c], oy=w[1], oz=-w[2], zc=0.075+oz, x=P.x;
    return [[x,P.y,P.z],[x,P.y-0.02,0.034],[x,-0.075,zc],[x,ML.rtv+oy,zc],[RSD.w/2-DINS,ML.rtv+oy,zc]].map(p=>A3(rsW(i,...p))); };
  for(const c of ['a','b']){
    const w=W[c], tp=inTube(mainPath('rtv'),w,RM);
    cable(`xd_rtv_${c}_2`,'xd_rtv',[...tp.slice(0,-1),...rsIn(2,c)],{from:'cap_mix', to:'deriv_2', via:'canal_principal', R:CBL.rg6.rb});
    cable(`xd_rtv_${c}_1`,'xd_rtv',[...rsOut(2)(c),...rsIn(1,c)],{from:'deriv_2', to:'deriv_1', via:'canal_principal'});
  }
  /* fibra: de la CTO de sortida (al RITU) puja a la safata, baixa per la cantonada, va arran de terra fins al tub de fibra i
     baixa; al soterrani, recta pel tub fins a la caixa de segregació del registre 2 i, d'allà, a la del registre 1 */
  { const out=ritiW(...CTO_FO.out), o=ritsL(out), yt=17.32, R=CBL.foDist.rb;
    const rits=[[o.x,o.y,o.z],[o.x,yt,-2.65],[-0.27,yt,-2.65],[-0.27,15.50,-2.65],[-0.27,15.50,-4.56],[RX.fo,15.50,-4.56],[RX.fo,15.25,-4.56]].map(p=>A3(ritsW(V(...p))));
    const cs=i=>[0.12-0.092,0.12+0.092].map(x=>A3(rsW(i,x,ML.fo,0.075)));
    cable('xd_fo_0','xd_fo',[...rits,...inTubeR(mainPath('fo'),[0,0,0],0.25).slice(1,-1),cs(2)[0]],{from:'pi_fo', to:'cseg_2', via:'canal_principal', R});
    cable('xd_fo_1','xd_fo',[cs(2)[1],cs(1)[0]],{from:'cseg_2', to:'cseg_1', via:'canal_principal'});
  }
  buildPairsC();
}
/* mànega de 25 parells: de la regleta de sortida (RITU) al registre 1, amb sangrat de 10 parells a cada registre (2: parells
   1–10; 1: 11–20). Un sol camí amb el radi de la mànega, tallat a la finestra de cada registre; al registre 1 acaba amb caputxó. */
function buildPairsC(){
  const D=CBL.pt25, r=D.d/2, el='xd_pt', e=EL[el], s0=ritsL(ritiW(3.212,1.60,-4.705)), yr=15.38;
  const rits=[[s0.x,s0.y,s0.z],[s0.x,yr,s0.z],[s0.x,yr,-4.56],[RX.pt,yr,-4.56],[RX.pt,15.25,-4.56]].map(p=>A3(ritsW(V(...p))));
  const yl=RSD.y+ML.pt, xEnd=RSX[1]-0.12;
  const pts=[...rits,...inTubeR(mainPath('pt'),[0,0,0],0.25).slice(1,-1),[xEnd,yl,ZW]];
  const Sm=pathSamples(polyCurve(P(pts),0,D.rb,{key:'xd_pt25',rb:D.rb}));
  const sAt=x=>{ for(let k=1;k<Sm.P.length;k++){ const a=Sm.P[k-1], b=Sm.P[k]; if(Math.abs(a.y-yl)<1e-4 && Math.abs(b.y-yl)<1e-4 && (a.x-x)*(b.x-x)<=0) return Sm.L[k-1]+(x-a.x)/(b.x-a.x)*(Sm.L[k]-Sm.L[k-1]); } throw new Error('finestra fora del tram'); };
  const win={2:[RSX[2]+0.13,RSX[2]+0.03], 1:[RSX[1]+0.13,RSX[1]+0.03]}, cut={2:win[2].map(sAt), 1:win[1].map(sAt)}, Lt=Sm.L[Sm.L.length-1];
  cableFromSamples('xd_pt25_0',el,sliceSamples(Sm,0,cut[2][0]),r,{from:'pi_pt', to:'rs_2', via:'canal_principal'});
  cableFromSamples('xd_pt25_1',el,sliceSamples(Sm,cut[2][1],cut[1][0]),r,{from:'rs_2', to:'rs_1', via:'canal_principal'});
  const Se=sliceSamples(Sm,cut[1][1],Lt), base={cableLike:true, tram:e.tram, tech:e.tech, svc:e.svc};
  const me=ictMesh(sweepGeo(Se,r,10,0,Math.PI*2,null,true),cableColor(e.tram,e.tech,REAL.pt50),el,Object.assign({real:REAL.pt50},base)); addProxy(me,sweepGeo(Se,0.02,4));
  const pe=Se.P[Se.P.length-1]; iCyl(el,r+0.0012,0.03,pe.x-0.012,pe.y,pe.z,0x2A2D31,'x',{pick:false});
  for(const i of [2,1]) pairWindowC(i,Sm,cut[i][0],cut[i][1],i===2?0:10);
}
/* finestra del sangrat dins del registre i: coberta oberta i 10 parells (n0+1 … n0+10) cap a la regleta, per sota */
function pairWindowC(i, Sm, s0, s1, n0){
  const el='xd_pt', e=EL[el], r=CBL.pt25.d/2, ri=r-0.0012, front=V(0,0,-1);
  const base={cableLike:true, tram:e.tram, tech:e.tech, svc:e.svc};
  const W=sliceSamples(Sm,s0,s1), op=1.0;
  const parts=[[sweepGeo(W,r-0.0006,14,op,Math.PI*2-op,front),new THREE.Matrix4()]];
  for(const k of [0,W.P.length-1]){ const g=new THREE.RingGeometry(ri,r,20); g.lookAt(W.T[k]); g.translate(W.P[k].x,W.P[k].y,W.P[k].z); parts.push([g,new THREE.Matrix4()]); }
  const jm=ictMesh(mergeParts(parts),cableColor(e.tram,e.tech,REAL.pt50),el,Object.assign({real:REAL.pt50, std:{roughness:0.7,metalness:0,side:THREE.DoubleSide}},base));
  addProxy(jm,sweepGeo(W,0.02,4));
  const Wd=denseSamples(new THREE.LineCurve3(W.P[0],W.P[W.P.length-1]),0.004), core=[];
  for(let k=0;k<6;k++) core.push([sweepGeo(helixSamples(Wd,0.0024,0.09,k*Math.PI/3,front),0.0019,6,0,Math.PI*2,null,true),new THREE.Matrix4(),k%2?PAIRC.b[(k>>1)%5]:PAIRC.a[(k>>1)%5]]);
  ictMesh(mergeParts(core),0xFFFFFF,el,Object.assign({real:0xFFFFFF, vcol:true, std:{roughness:0.5,metalness:0,vertexColors:true}},base));
  /* 10 parells: surten per l'obertura (x local 0,03…0,13), pugen en cinta per davant fins a sota la regleta */
  const conds=[]; let mid=null;
  for(let p=1;p<=10;p++){
    const n=n0+p, xw=-0.115+0.008*(p-1), zr=0.112-0.0008*p, yb=ML.pt+0.012, kx=krX(0,p), yk=0.33-KR.h/2, zl=0.055;
    const loc=[[xw,yb,0.075+0.004],[xw,yb+0.02,zr],[xw,0.20+0.003*(10-p),zr],[kx,0.24+0.003*(10-p),zr],[kx,yk-0.02,zl],[kx,yk,zl]];
    const path=polyCurve(P(loc.map(q=>A3(rsW(i,...q)))),0,CBL.pair.rb,{key:`xd_pt_s${i}`,rb:CBL.pair.rb});
    const Sd=denseSamples(path,0.0025); conds.push(...twistedPair(Sd,pairCols(n))); if(p===5) mid=Sd;
  }
  const pm=ictMesh(mergeParts(conds),0xFFFFFF,el,{cable:`xd_pt_s${i}`, tram:e.tram, tech:e.tech, svc:e.svc, real:0xFFFFFF, vcol:true, std:{roughness:0.5,metalness:0,vertexColors:true}});
  addProxy(pm,sweepGeo(mid,0.012,4));
  G.cables[`xd_pt_s${i}`]={key:`xd_pt_s${i}`, el, pts:mid.P, mesh:pm, from:`rs_${i}`, to:`bucle_${i}`, via:null};
}

/* ---------- per casa: RTR, canalització secundària i xarxa de dispersió ----------
   Tres tubs de Ø25 (RTV; parells i fibra; TBA) surten per dalt del registre secundari, pugen per dins de la mitgera, giren
   cap a la façana i entren al RTR per la paret del fons (x = −2,76 de la disposició A, al costat del multiplexor).
   Dins del registre, els coaxials de derivació baixen del port, van per un carril cap al lateral i pugen arran de la paret:
   cap a la dreta (costat +1) arran de la placa, cap a l'esquerra 2 cm més endavant (no es creuen). */
const LANE={a:{t1:{y:-0.05,col:-0.20}, t2:{y:-0.07,col:0.215}}, b:{t1:{y:-0.05,col:0.20}, t2:{y:-0.07,col:-0.215}}};
function csPathC(u, t){
  const i=rsOf(u), sd=sideOf(i,u), X0=RSX[i]-sd*TOPX[t], h=HRTR[t], m=UW(u,-2.76,h,-4.715);
  return [[X0,RSD.y+RSD.h/2-DINS,ZW],[X0,h,ZW,0.1],[X0,h,m.z,0.06],[m.x,h,m.z]];
}
const rsOf = u => rsUnits(1).includes(u) ? 1 : 2;
function buildHouseICT(u){
  const id=u.id, i=rsOf(u), sd=sideOf(i,u), X=x=>mx(u,x), Z=z=>mz(u,z), sz=SZ(u), L=v=>A3(gw(u,v.clone()));
  for(const t of ['rtv','all','tba']) tube(`cs_${id}`,csPathC(u,t),CSR,{tubeSvc:t, R:RCS, mouth:2});
  withRoot(PG[pairOf(u)],()=>regBox(`rtr_${id}`,1.0,0.8,0.3,X(-3.2),1.5,Z(-4.6),0xE9E6DF,0xF4F2EE,sz));
  /* RTV: cable 1 (blanc, derivador a) i 2 (negre, derivador b); al tub, desplaçats ±4 mm en les tres direccions */
  const Wc={a:[0.004,0.004,0.004], b:[-0.004,-0.004,-0.004]};
  for(const c of ['a','b']){
    const tn=(c==='a')===(sd>0)?'t2':'t1', P=RSP[i][c][tn], ln=LANE[c][tn], zp = ln.col>0 ? 0.034 : 0.055, w=Wc[c], wl=[-w[0],w[1],-w[2]];
    const tx=sd*TOPX.rtv+wl[0], top=RSD.h/2-DINS;
    const rs=[[P.x,P.y,P.z],[P.x,ln.y,zp],[ln.col,ln.y,zp],[ln.col,0.40,zp],[tx,0.44,0.075+wl[2]],[tx,top,0.075+wl[2]]].map(p=>A3(rsW(i,...p)));
    const tp=inTubeR(csPathC(u,'rtv'),w,RCS);
    const PR=pauRtvPos(u), E=PR.at(c==='a'?'in':'inc').add(V(0,0.004-FC_LENGTH,0)), yu=E.y-0.06;
    const far=Math.abs(PR.at(c==='a'?'in':'inc').x-X(-2.76)) > Math.abs(PR.at(c==='a'?'inc':'in').x-X(-2.76)), zf=E.z+sz*(far?0.084:0.068);
    const tail=[V(X(-2.76),HRTR.rtv+w[1],zf),V(E.x,HRTR.rtv+w[1],zf),V(E.x,yu,zf),V(E.x,yu,E.z),V(E.x,E.y,E.z)].map(L);
    cable(`xs_rtv_${c}_${id}`,`xs_rtv_${id}`,[...rs,...tp.slice(1),...tail],{tram:'disp',tech:'coax',svc:'rtv',from:`deriv_${i}`, to:`pau_rtv_${id}`, via:`cs_${id}`});
  }
  /* fibra: escomesa des del premsaestopes de dalt de la caixa de segregació, per davant de tot, fins al tub de parells i fibra;
     al RTR, entra al PAU de fibra pel pretallat lateral més proper, amb un passacables de goma */
  { const w=[-0.004,-0.004,-0.004], wl=[0.004,-0.004,0.004], gx=0.12+sd*0.03, tx=sd*TOPX.all+wl[0], top=RSD.h/2-DINS;
    const rs=[[gx,ML.fo+0.057,0.075],[gx,ML.fo+0.08,0.10],[gx,0.40,0.11],[tx,0.43,0.11],[tx,0.455,0.075+wl[2]],[tx,top,0.075+wl[2]]].map(p=>A3(rsW(i,...p)));
    const tp=inTubeR(csPathC(u,'all'),w,RCS);
    const pf=pauFoPos(u), ed=pf.at('entrada_d'), ee=pf.at('entrada_e'), en=Math.abs(ed.x-X(-2.96))<Math.abs(ee.x-X(-2.96))?ed:ee, out=Math.sign(X(-2.96)-en.x);
    withRoot(PG[pairOf(u)],()=>rCyl(`pau_fo_${id}`,0.0036,0.003,V(en.x+out*0.001,en.y,en.z),V(1,0,0),0x2A2D31,'rubber',{r2:0.0036}));
    const h=HRTR.all+w[1], tail=[V(X(-2.76),h,Z(-4.67)),V(X(-2.96),h,Z(-4.67)),V(X(-2.96),en.y,Z(-4.67)),V(X(-2.96),en.y,en.z),V(en.x-out*0.008,en.y,en.z)].map(L);
    cable(`xs_fo_${id}`,`xs_fo_${id}`,[...rs,...tp.slice(1),...tail],{tram:'disp',tech:'fo',svc:'fo',from:`cseg_${i}`, to:`pau_fo_${id}`, via:`cs_${id}`}); }
  /* parells: escomesa de 2 parells des de la regleta (parells 1–2 cap a l'esquerra, 3–4 cap a la dreta) fins a la roseta */
  { const w=[0.004,0.004,0.004], wl=[-0.004,0.004,-0.004], kx=krX(0,sd>0?3.5:1.5), tx=sd*TOPX.all+wl[0], top=RSD.h/2-DINS;
    const rs=[[kx,0.33+0.014,0.06],[kx,0.39,0.065],[tx,0.43,0.075+wl[2]],[tx,top,0.075+wl[2]]].map(p=>A3(rsW(i,...p)));
    const tp=inTubeR(csPathC(u,'all'),w,RCS), pp=X(-2.86);
    const h=HRTR.all+w[1], tail=[V(X(-2.76),h,Z(-4.675)),V(pp,h,Z(-4.675)),V(pp,1.64,Z(-4.70)),V(pp,1.69,Z(-4.701))].map(L);
    cable(`xs_pt_${id}`,`xs_pt_${id}`,[...rs,...tp.slice(1),...tail],{tram:'disp',tech:'pt',svc:'pt',from:`bucle_${i}`, to:`pau_pt_${id}`, via:`cs_${id}`}); }
  withRoot(PG[pairOf(u)],()=>buildInterior(u));
}
/* ---------- referències (mode «Només ICT») i etiquetes de cases, estàncies i zones ---------- */
function buildRefs(){
  for(const [f,y] of [[-1,-3],[0,0],[1,KC.H+0.2]]){
    const x0=-20, x1=KC.xc, z0=f===-1?KC.bas.z0:-6, z1=f===-1?0:0;
    const g=new THREE.EdgesGeometry(new THREE.BoxGeometry(x1-x0,0.01,z1-z0)); const l=new THREE.LineSegments(g,AM.ref); l.position.set((x0+x1)/2,y,(z0+z1)/2);
    l.userData={kind:'ref', floor:f}; scene.add(l); G.refs.push(l);
    G.refLabels.push({text:FLOORNAME(f), pos:V(-20.6,y+0.3,0.4), floor:f, cls:'ref'});
  }
  for(const u of UNITS) G.refLabels.push({text:unitTitle(u), pos:UW(u,-5,2.4,0.0).setZ(0.8), floor:0, unit:u.id, cls:'ref', unitLbl:true});
  const r2=[["Rebedor",-3.2,-3.6],["Sala d'estar",-6.2,0.6],["Cuina",-6.2,-3.2],["Dormitori 1",-3.2,3.3],["Dormitori 2",-3.2,0],["Bany (sense preses)",-6.9,3.9]];
  for(const u of UNITS) for(const [t,x,z] of r2) G.refLabels.push({text:t,pos:UW(u,x,1.25,z),floor:0,unit:u.id,cls:'room'});
  const Z=(t,x,y,z,f)=>G.refLabels.push({text:t,pos:V(x,y,z),floor:f,cls:'zone'});
  Z('Aparcament comunitari',0,-1.4,-8.2,-1); Z('Rampa d\'accés de vehicles',-22.1,-1.0,-6,-1); Z('Zona del RITU (soterrani)',23.2,-1.6,-9,-1);
  Z('RITU',RITU.x+3.6,3.2,RITU.z+1.5,0); Z('Torre d\'antenes',RITU.x+3.5,2.0,RITU.z-4.6,0); Z('Carrer',0,0.6,10,0);
  for(const u of UNITS){ const c=UW(u,-5,0,0); Z('Jardí',c.x,0.8,-12,0); Z('Golfes (traster)',c.x,4.0,-3,1); }
}

/* ---------- vistes ---------- */
Object.assign(VIEWS, {
  start:   ()=>(camera&&camera.aspect<1 ? {p:V(44,14,40), t:V(6,-0.5,-6)} : {p:V(45,8.5,19), t:V(5,-0.8,-7)}),
  building:()=>({p:V(36,22,36), t:V(2,0,-5)}),
  tall:    ()=>({p:V(40,1.5,-6.5), t:V(10,-1.6,-7.5)}),
  entry:   ()=>({p:V(29.5,3.2,8.0), t:V(22.4,-0.4,-0.6)}),
  roof:    ()=>({p:V(36,10,10), t:V(22,3,-5)}),
  basement:()=>({p:V(6,17,-33), t:V(4,-2.4,-5)}),
  floor:   ()=>S.floor===-1 ? VIEWS.basement() : S.floor===1 ? {p:V(2,26,22), t:V(1,3,-5)} : {p:V(2,24,21), t:V(1,0,-5)},
  home:    ()=>{ const u=UNIT(curUnit()||'0A'), c=UW(u,-5,0,0); return {p:V(c.x+1.5,10.5,c.z+9.5), t:V(c.x,0.2,c.z-0.3)}; }
});
function setView(name, opt={}){
  if(!opt.noPush) navPush();
  if(name==='ritsIn'){ ritsInterior(); return; }
  if(name==='complet'){ S.mode='oberta'; S.layers.facana=true; S.layers.estructura=true; name='building'; }
  else if(name==='oberta'){ S.mode='oberta'; S.layers.facana=false; S.layers.estructura=true; name='building'; }
  else if(name==='tall'){ if(S.mode==='planta'||S.mode==='habitatge') S.mode='oberta'; S.cut=true; S.layers.estructura=true; }
  else if(name==='entry'){ S.mode='transp'; S.cut=true; for(const k of ['recintes','registres','canalitzacions','xarxes','punts']) S.layers[k]=true; }
  else if(name==='basement'||name==='ground'||name==='f1'){ S.floor = name==='basement'?-1 : name==='ground'?0 : 1; S.mode='planta'; name='floor'; }
  else if(name==='roof'){ if(S.mode==='planta'||S.mode==='habitatge') S.mode='oberta'; }
  if(name==='home'){ if(!curUnit()){ S.floor=CFG.floor0; S.unitSide=CFG.side0; } S.mode='habitatge'; }
  if(name==='building' && (S.mode==='planta'||S.mode==='habitatge')) S.mode='oberta';
  syncControls(); applyVisibility();
  const v=VIEWS[name](); flyTo(v.p,v.t); navUI();
}


