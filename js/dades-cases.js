/* =====================================================================
   DADES DEL MODEL DE CASES ADOSSADES (cases.html)
   S'executa després de js/dades.js (que, amb MODEL = 'cases', no crea els habitatges ni les plantes de l'edifici):
   defineix les quatre cases i els registres secundaris del soterrani, adapta els textos dels elements comuns (el RITS de
   l'edifici fa de RITU) i substitueix les activitats i les simplificacions.
   ===================================================================== */
'use strict';
/* quatre cases en filera, d'esquerra a dreta: 1 (A), 2 (D), 3 (C) i 4 (B). Les lletres són la disposició de l'habitatge
   de l'edifici que fa servir cada casa (A i D, i B i C, són simètriques respecte de la mitgera que comparteixen). */
for (const [s,n] of [['A',1],['D',2],['C',3],['B',4]])
  UNITS.push({id:`0${s}`, f:0, s, n, name:`casa ${n}`, title:`Casa ${n}`, del:`de la casa ${n}`, al:`a la casa ${n}`, el:`la casa ${n}`});
FLOORNAME = f => f===-1 ? 'Soterrani' : f===0 ? 'Planta baixa i exterior' : f===1 ? 'Golfes i cobertes' : `Planta ${f}`;
/* registre secundari de cada casa: 1 (cases 1 i 2, mitgera x = −10) i 2 (cases 3 i 4, mitgera x = 10) */
const RSOF = u => (u.n<=2 ? 1 : 2);
const RSCASES = {1:'1 i 2', 2:'3 i 4'};

Object.assign(CFG, {
  floor0:0, side0:'A', unitFloors:[0], whole:'Conjunt complet', homeMode:'Casa detallada', rits:'RITU',
  clamp:{x:[-28,34], y:[-4,14], z:[-22,20]},
  sceneLabel:'Escena 3D del conjunt de cases adossades',
  /* elements que es veuen sense treure les façanes: RITU, antenes, soterrani i entrada */
  keepFacade: id => (typeof inRits==='function' && inRits(id)) || EL[id]?.floor===-1 ||
    ['antena','antena_dab','antena_fm','torre','mastil','tirants','lnb','parabola','cab_capt','cab_dab','cab_fm','cab_sat','cab_sat2','canal_enllac_sup','arqueta','canal_ext','xal_fo','xal_pt'].includes(id),
  backOf: () => false,
  welcome:`<p>Aquest model mostra la <b>ICT</b> (infraestructura comuna de telecomunicacions) d'un <b>conjunt de quatre cases adossades</b> amb aparcament soterrani comunitari. Hi ha un sol recinte de telecomunicacions, el <b>RITU</b> (recinte únic: fa de RITI i de RITS alhora), a l'extrem del conjunt i amb la torre d'antenes al costat. Un <b>tall transversal</b> del terreny deixa veure el soterrani, per on la canalització principal arriba als registres secundaris de cada parella de cases.</p>`,
  about:`<h3>Configuració representada</h3><ul>
   <li>Conjunt de 4 cases unifamiliars adossades (4 PAU) amb un <b>RITU</b>: recinte únic que reuneix la capçalera de RTV (funció de RITS) i els registres principals de fibra i de parells (funció de RITI). És una construcció a part, a l'extrem dret de la filera, amb la torre d'antenes al darrere.</li>
   <li>Entrada: operador → arqueta a la vorera → canalització externa (4 × Ø63) → punt d'entrada general al mur del soterrani → canalització d'enllaç inferior pel sostre del soterrani → registre d'enllaç, dins del RITU → registres principals.</li>
   <li>RTV: torre de 6 m amb antenes TDT, DAB i FM i parabòlica amb LNB doble → enllaç superior (2 × Ø40) → capçalera al RITU (centraleta programable o amplificadors monocanal) → dos coaxials de distribució.</li>
   <li>Canalització principal: 5 tubs de Ø50 (RTV, fibra, parells, TBA i reserva) que baixen del RITU al soterrani i van pel sostre, arran del mur de davant, fins als dos registres secundaris (550 × 1000 × 150 mm), un sota cada mitgera de parella.</li>
   <li>Registre secundari de cada parella: dos derivadors F 4D (un per cable de distribució; pèrdua de derivació de 16 dB al primer i 12 dB a l'últim, que tanca la línia amb càrregues), caixa de segregació de fibra i regleta de 10 parells (sangrat de la mànega de 25 parells).</li>
   <li>Canalització secundària: 3 tubs de Ø25 per casa (RTV; parells i fibra; TBA), del registre secundari al registre de terminació de xarxa (RTR), per dins de la mitgera.</li>
   <li>Dins de cada casa, la mateixa dotació i el mateix RTR que els habitatges de l'edifici: PAU de RTV, PAU de fibra, rosetes RJ45 amb multiplexor, PAU de TBA i preses a totes les estàncies.</li></ul>
   <h3>Les cases del model</h3><p class="small">Quatre cases de planta baixa i golfes sota coberta de teula a dues aigües, de 10 × 6 m, amb jardí davanter i posterior. Les parelles 1–2 i 3–4 són simètriques. A sota hi ha un aparcament comunitari amb rampa a l'extrem esquerre. La distribució interior és la dels habitatges de l'edifici (sala d'estar, cuina, dos dormitoris, bany i rebedor) i les golfes són traster.</p>
   <h3>Fonts tècniques</h3><ul><li>Reial decret 346/2011, d'11 de març (text consolidat, BOE-A-2011-5834): annex III, recintes (RITU en conjunts de vivendes unifamiliars), canalitzacions i registres. <a href="https://www.boe.es/buscar/act.php?id=BOE-A-2011-5834" target="_blank" rel="noopener">boe.es</a></li>
   <li>Esquemes de referència d'ICT per a vivendes unifamiliars dels fabricants de registres i armaris (dimensions orientatives de RITU, registres secundaris i de terminació de xarxa).</li>
   <li>Equips: els mateixos exemples comercials (Televes) i les mateixes fonts que el model de l'edifici.</li></ul>`
});

for (const u of UNITS) defUnit(u);

/* ---------------- el RITS de l'edifici fa de RITU: és a la planta baixa, al costat de les cases ---------------- */
delete EL.riti; delete EL.ritu;
const txtFields = ['name','what','purpose','where','connects','example','confusion'];
const fixTxt = (e, f) => { for (const k of txtFields) if (typeof e[k]==='string') e[k]=f(e[k]); if (e.vt) for (const v of Object.values(e.vt)) for (const k of txtFields) if (typeof v[k]==='string') v[k]=f(v[k]); if (e.more) e.more=e.more.map(f); };
for (const e of Object.values(EL)) {
  if (e.floor===5) e.floor=0;
  if (e.zone==='comuna (coberta)') e.zone='comuna (zona del RITU)';
  if (e.zone==='comuna (RITS)') e.zone='comuna (RITU)';
  fixTxt(e, t => t.replace(/\bRITS\b/g,'RITU').replace(/baixen per l'edifici/g,"van cap a les cases").replace(/a tot l'edifici/g,'a totes les cases')
    .replace(/(terra general|presa de terra|alimentació elèctrica) de l'edifici/g,'$1 del conjunt'));
}
for (const id of ['rp_fo','rp_pt','reg_enllac_inf']) EL[id].parent='rits';

Object.assign(EL.rits, {name:"Recinte d'instal·lacions de telecomunicació únic", sigla:'RITU',
  what:"És el local d'obra, separat de les cases, que fa alhora de recinte inferior (RITI) i de recinte superior (RITS): hi ha la capçalera de RTV i els registres principals de fibra i de parells, amb el registre d'enllaç on arriben els cables dels operadors. Té parets arrebossades, terra dissipador, porta metàl·lica, safata perimetral, quadre elèctric, llum normal i d'emergència, ventilació i anell de terra.",
  purpose:"Concentra en un sol lloc els punts d'interconnexió de tots els serveis del conjunt de cases: hi arriben les antenes (per dalt) i els operadors (per sota), i en surt la canalització principal cap als registres secundaris.",
  where:"Extrem dret del conjunt, en una zona comuna entre la casa 4 i el tall del terreny, sobre el soterrani. La porta mira cap a les cases i la torre d'antenes és al darrere.",
  connects:"Entrada superior: tub d'enllaç superior → passamurs → registre d'enllaç → capçalera de RTV. Entrada inferior: canalització d'enllaç → registre d'enllaç inferior → registre principal òptic i registre principal de parells (paret de la porta). Sortida: cinc tubs de la canalització principal que baixen al soterrani.",
  example:"El tècnic d'un operador i l'instal·lador d'antenes treballen al mateix recinte: el primer, a les caixes de la paret de la porta; el segon, a la placa de la capçalera del fons.",
  confusion:"El RITU no és un RITI ni un RITS més petit: és el recinte únic que admet el RD 346/2011 en conjunts de cases unifamiliars (i en edificis petits). Usa el panell «Configuració del RITU» per obrir-lo per dins."});
Object.assign(EL.capcalera, {confusion:"La capçalera és al RITU, però no té res a veure amb la fibra dels operadors, que acaba als registres principals del mateix recinte. Tampoc és un PAU."});
Object.assign(EL.torre, {what:"Torre d'acer galvanitzat de secció triangular, amb tres muntants units per travessers horitzontals i diagonals, ancorada amb una placa base i perns a un dau de formigó. Fa 6 m des del terra fins a la placa superior.",
  purpose:"Eleva les antenes per sobre de les cobertes de les cases i sosté el màstil, la parabòlica i els cables.",
  where:"Zona comuna del RITU, darrere del recinte. Està arriostrada amb tres tirants a 120°."});
Object.assign(EL.tirants, {what:"Tres cables d'acer galvanitzat que van des de les orelles de la part alta de la torre fins a tres ancoratges al terra, separats 120°. Cada tirant té guardacaps, grapes, un tensor i una funda groga de senyalització a la part baixa.",
  where:"Zona comuna del RITU: tres daus de formigó amb cargol d'ull, al voltant de la torre.", connects:"Orelles de la torre ↔ tensor ↔ ancoratge al terra."});
EL.parabola.what=EL.parabola.what.replace('sobre el paviment de la coberta','sobre el terra');
EL.parabola.where='Zona comuna del RITU, fixada en un lateral de la torre, orientada cap al satèl·lit amb el camí lliure d\'obstacles.';
EL.rits_porta.where='Paret de la porta del RITU, mirant cap a les cases.';
if (EL.canal_enllac_sup) EL.canal_enllac_sup.where=EL.canal_enllac_sup.where.replace(/^Coberta: /,'Zona comuna del RITU: ');

/* ---------------- entrada dels operadors ---------------- */
Object.assign(EL.arqueta, {where:"A la vorera, davant del RITU."});
Object.assign(EL.canal_ext, {what:"Són els tubs soterrats que van des de l'arqueta d'entrada fins al punt d'entrada general, al mur del soterrani.",
  where:"Sota la vorera i el jardí comú, entre l'arqueta d'entrada i el mur del soterrani (es veuen amb «Només ICT»).",
  connects:"Allotja els cables d'alimentació de fibra i de parells. Connecta l'arqueta d'entrada amb el punt d'entrada general."});
Object.assign(EL.peg, {what:"És el passamurs per on la canalització externa travessa el mur del soterrani i entra a la zona comuna del conjunt.",
  where:"Mur de davant del soterrani, sota el RITU, just per sota del sostre.", floor:-1,
  example:"Si entra aigua al soterrani pels tubs, cal revisar el segellat del punt d'entrada general."});
Object.assign(EL.canal_enllac_inf, {floor:-1,
  what:"Són els quatre tubs de Ø63 mm que continuen des del punt d'entrada general, pel sostre del soterrani, i pugen dins del RITU fins al registre d'enllaç inferior. Travessen el mur apilats i pugen un darrere l'altre amb corbes paral·leles.",
  purpose:"Porta els cables d'alimentació dels operadors per dins de la zona comuna fins al recinte únic.",
  where:"Soterrani: des del punt d'entrada general, arran del sostre, fins a sota del RITU; després travessen la llosa i entren al registre d'enllaç per sota.",
  connects:"Punt d'entrada general → registre d'enllaç inferior (dins del RITU) → registres principals.",
  example:"El tècnic estira el cable des de l'arqueta fins al registre d'enllaç del RITU sense entrar a l'aparcament."});
Object.assign(EL.reg_enllac_inf, {name:"Registre d'enllaç inferior (450 × 450 × 120 mm)",
  what:"És una caixa de 450 × 450 × 120 mm a la paret de la porta del RITU, prop del terra, on acaben els quatre tubs de la canalització d'enllaç inferior.",
  where:"Dins del RITU, a la paret de la porta, sota els registres principals.",
  connects:"Hi entren per sota els tubs d'enllaç; en surten per dalt els cables dels operadors cap a les caixes terminals òptiques i la regleta d'entrada de parells.",
  example:"L'operador fa passar el cable des de l'arqueta fins aquí, el recull i després l'estira fins a la seva caixa terminal."});
Object.assign(EL.xal_fo, {where:"Ve del carrer, entra per l'arqueta d'entrada, passa per la canalització externa i la d'enllaç inferior (pel soterrani) i acaba al registre principal òptic, dins del RITU.",
  example:"Quan una casa contracta fibra, l'operador estén el seu cable pels tubs que ja existeixen fins al RITU i el connecta al seu repartidor d'entrada. No cal fer obres."});
Object.assign(EL.xal_pt, {where:"Carrer → arqueta d'entrada → canalització externa → enllaç inferior (soterrani) → regletes d'entrada del registre principal de parells (RITU).",
  example:"Quan una casa contracta una línia, el tècnic de l'operador fa un pont des d'un parell de la seva regleta d'entrada fins al parell de la regleta de sortida que va a la casa 3."});
Object.assign(EL.rp_fo, {what:"És la caixa, dins del RITU, que conté el punt d'interconnexió de fibra òptica.", where:"RITU, paret de la porta, sobre el registre d'enllaç."});
Object.assign(EL.pi_fo, {where:"Dins del registre principal òptic, al RITU.",
  connects:"Xarxa d'alimentació de fibra (entrada) ↔ xarxa de distribució de fibra (sortida). Els connectors de sortida estan etiquetats per casa.",
  example:"Donar servei a la casa 2 vol dir posar un latiguillo entre el repartidor de l'operador i el connector «casa 2» del panell de sortida."});
Object.assign(EL.rp_pt, {what:"És la caixa, dins del RITU, que conté el punt d'interconnexió de parells: les regletes d'entrada dels operadors i les regletes de sortida del conjunt, de tipus Krone.",
  where:"RITU, paret de la porta, a l'extrem del fons.", connects:"Hi acaba la xarxa d'alimentació de parells i hi comença la mànega de distribució de 25 parells.",
  example:"Hi ha dues columnes de regletes de 10 parells: a l'esquerra, 4 d'entrada (40 parells, almenys 1,5 vegades els de sortida); a la dreta, 3 de sortida (els 25 parells de la mànega i 5 de lliures)."});
Object.assign(EL.pi_pt, {where:"Dins del registre principal de parells, al RITU.",
  connects:"Xarxa d'alimentació de parells (regletes d'entrada) ↔ ponts ↔ mànega de distribució (regletes de sortida). La primera regleta de sortida va al registre secundari 2 (cases 3 i 4) i la segona, al 1 (cases 1 i 2)."});

/* ---------------- canalització principal i distribució (soterrani) ---------------- */
Object.assign(EL.canal_principal, {floor:-1, vertical:false,
  what:"Són els cinc tubs de Ø50 mm que baixen del RITU al soterrani i van pel sostre, arran del mur de davant, fins als dos registres secundaris.",
  purpose:"Dona suport a les xarxes de distribució de tots els serveis. És l'«eix» comú del conjunt: en un edifici és vertical; aquí és gairebé tot horitzontal.",
  where:"Sota el RITU baixen junts i, a la cota del sostre del soterrani, giren cap al mur i s'hi apilen (RTV a dalt). Continuen arran del mur fins al registre secundari 2 i, d'allà, fins al 1.",
  connects:"Cinc tubs de Ø50 mm (RD 346/2011, conjunts de fins a 10 PAU): RTV, parells, fibra òptica, coaxial de TBA i reserva. Al model, els de TBA i de reserva són buits.",
  example:"Entre el registre secundari 2 i l'1, pel tub de RTV hi passen els dos coaxials de distribució que ja han deixat senyal a les cases 3 i 4.",
  confusion:"La canalització principal és el conducte; la xarxa de distribució són els cables que hi ha a dins. Un tub buit continua sent canalització."});
Object.assign(EL.xd_rtv, {floor:-1, vertical:false,
  what:"Són els dos cables coaxials que surten de la capçalera, al RITU, baixen al soterrani i passen pels dos registres secundaris. Cadascun porta els senyals terrestres i una FI de satèl·lit.",
  purpose:"Reparteix el senyal de ràdio i televisió fins a les quatre cases. Comença a les sortides de la capçalera i acaba als derivadors.",
  where:"RITU (tub corrugat de sortida) → tub de RTV de la canalització principal → registre secundari 2 → registre secundari 1.",
  connects:"Uneix les dues sortides de la capçalera amb els derivadors de cada registre secundari. Al registre 1 (l'últim), la sortida de cada derivador es tanca amb una càrrega.",
  example:"Al registre secundari 2, cada cable entra en un derivador: una part del senyal va a les cases 3 i 4 i la resta continua cap al registre 1.",
  confusion:"«Distribució» és la funció del tram; «coaxial» és el tipus de cable. Hi ha dos cables perquè a cada PAU n'arribin dos. Com que el senyal ve del RITU, el primer derivador (més a prop) té més pèrdua de derivació que l'últim."});
Object.assign(EL.xd_fo, {floor:-1, vertical:false,
  what:"És el cable multifibra del conjunt que surt del panell de sortida del registre principal òptic (RITU), va per la safata i arran de terra fins al tub de fibra i passa pels dos registres secundaris.",
  purpose:"Fa arribar fibres a les quatre cases. És única per a aquesta tecnologia i la comparteixen tots els operadors.",
  where:"RITU → tub de fibra de la canalització principal → caixa de segregació del registre secundari 2 → caixa del registre 1.",
  connects:"Uneix el punt d'interconnexió òptic amb les caixes de segregació. A cada caixa s'empalmen les fibres de les dues cases del registre; la resta continuen en pas.",
  example:"Si arriba un operador nou, no instal·la cap cable fins a les cases: connecta la seva xarxa al punt d'interconnexió del RITU i fa servir aquesta distribució.",
  confusion:"No és el cable de l'operador. El cable de l'operador s'acaba al RITU; a partir del panell de sortida, la fibra és de la propietat del conjunt."});
Object.assign(EL.xd_pt, {floor:-1, vertical:false, name:'Xarxa de distribució de parells (mànega de 25 parells)',
  what:"És una mànega multiparell de 25 parells (Ø10,8 mm) que surt de les regletes de sortida del RITU, va arran de terra fins al tub de parells i passa pels dos registres secundaris. A cada registre s'obre una finestra a la coberta (sangrat) i se'n treuen 10 parells cap a la regleta; al registre 1 acaba amb un caputxó.",
  purpose:"Porta les línies des del punt d'interconnexió fins al punt de distribució de cada parella de cases. Dimensionament (RD 346/2011, annex II): 4 cases × 2 línies = 8; × 1,2 de reserva = 9,6 → cable normalitzat de 25 parells.",
  where:"RITU (regletes de sortida) → tub de parells de la canalització principal → registre secundari 2 → registre secundari 1.",
  connects:"Regletes de sortida del punt d'interconnexió ↔ regleta de 10 parells de cada registre secundari (parells 1–10 al registre 2 i 11–20 al registre 1; del 21 al 25, reserva).",
  example:"Si s'avaria el parell que va a la casa 3, el tècnic pot passar la línia a un dels parells lliures de la regleta del registre 2 sense estendre cap cable nou.",
  confusion:"El sangrat no talla la mànega: només se n'extreuen els parells d'aquell registre i la resta continua. La reserva del 20 % és per a avaries i ampliacions."});

/* ---------------- registres secundaris (soterrani) ---------------- */
const TAPCASES = {2:{db:16, ref:'519343'}, 1:{db:12, ref:'519342'}};
for (const i of [1,2]) {
  const cs=RSCASES[i], first=i===2, d=TAPCASES[i], us=UNITS.filter(u=>RSOF(u)===i);
  def({id:`rs_${i}`, fam:'recinte', layer:'registres', svc:'all', floor:-1, zone:'comuna', rs:true, rsTag:`cases ${cs}`, container:true, lid:true, main:i===1,
   name:`Registre secundari ${i} (cases ${cs})`, sigla:'RS',
   what:"És una caixa metàl·lica de 550 × 1000 × 150 mm, amb tapa, fixada al mur de davant del soterrani. La canalització principal hi entra pel lateral i en surten per dalt les canalitzacions secundàries de les dues cases.",
   purpose:"Separa la canalització principal de les secundàries i allotja els elements de distribució de cada servei: derivadors de RTV, caixa de segregació de fibra i regleta de parells.",
   where:`Soterrani, al mur de davant, just a sota de la mitgera entre les cases ${cs}.`,
   connects:`Entren els tubs de la canalització principal${first?' (i en continuen cap al registre 1)':' (és el darrer registre)'}. En surten sis tubs de Ø25 mm: tres per a cada casa (RTV; parells i fibra; TBA).`,
   example:`L'instal·lador obre aquest registre per mesurar el senyal de televisió que arriba a les cases ${cs} sense entrar a cap casa.`,
   confusion:"La mida mínima per a conjunts de cases és de 450 × 450 × 150 mm; aquí és més gran (mida de catàleg) perquè hi caben els dos derivadors, la caixa de segregació i la regleta amb els cables a les corbes mínimes.",
   canals:['canal_principal',...us.map(u=>`cs_${u.id}`)], links:[`deriv_${i}`,`cseg_${i}`,`bucle_${i}`]});
  def({id:`deriv_${i}`, fam:'punt', layer:'punts', svc:'rtv', floor:-1, zone:'comuna', rs:true, parent:`rs_${i}`,
   name:`Derivadors F 4D de ${d.db} dB (2; exemple: Televes ref. ${d.ref}) — cases ${cs}`, sigla:'',
   what:`Dos derivadors passius de 4 sortides (109 × 54 × 18 mm), un per a cada cable de distribució. Tenen els connectors F cap avall: entrada a l'esquerra, quatre derivacions i sortida a la dreta. Pèrdua de derivació nominal: ${d.db} dB.`,
   purpose:"Treuen una part del senyal de cada cable de distribució cap a les cases i deixen passar la resta cap al registre següent.",
   where:`Registre secundari ${i}, a sobre de la línia del tub de RTV.`,
   connects:`Entrada ← cable de distribució. Derivacions 1 i 2 → cables de dispersió de les cases ${cs} (cada casa rep el cable blanc del primer derivador i el negre del segon). Derivacions 3 i 4: càrregues de 75 Ω. Sortida → ${first?'cable cap al registre 1':'càrrega de 75 Ω (final de línia)'}.`,
   example:first?"Com que és el primer registre que troba el senyal, porta derivadors de 16 dB: n'hi arriba més que al registre 1 i, així, les quatre cases reben un nivell semblant.":"És el darrer derivador de cada cable: per això porta menys pèrdua de derivació (12 dB) i la sortida tancada amb una càrrega.",
   confusion:"El derivador és a la zona comuna i alimenta cases; el PAU + repartidor és dins de cada casa i alimenta preses. Tota sortida o derivació lliure es tanca amb una càrrega per no desadaptar la línia.",
   nets:['xd_rtv',...us.map(u=>`xs_rtv_${u.id}`)]});
  def({id:`cseg_${i}`, fam:'punt', layer:'punts', svc:'fo', floor:-1, zone:'comuna', rs:true, parent:`rs_${i}`,
   name:`Caixa de segregació de fibra — cases ${cs}`, sigla:'',
   what:"Caixa de plàstic (160 × 90 × 80 mm) on s'empalmen les fibres del cable de distribució amb les escomeses de les cases. El cable de distribució hi entra pel premsaestopes de l'esquerra i, si continua, en surt per la dreta.",
   purpose:"És el punt de distribució òptic: separa les fibres de cada casa i les protegeix.",
   where:`Registre secundari ${i}, sobre la línia del tub de fibra.`,
   connects:`Cable de distribució de fibra ↔ escomeses òptiques de les cases ${cs} (per dalt).`,
   example:"Cada escomesa està empalmada a fibres del cable de distribució etiquetades amb el número de la casa.",
   confusion:"No és un PAU ni una ONT: és passiva i és a la zona comuna. El PAU de fibra és al RTR de cada casa.",
   nets:['xd_fo',...us.map(u=>`xs_fo_${u.id}`)]});
  def({id:`bucle_${i}`, fam:'punt', layer:'punts', svc:'pt', floor:-1, zone:'comuna', rs:true, parent:`rs_${i}`,
   name:`Punt de distribució de parells (regleta de 10 parells) — cases ${cs}`, sigla:'',
   what:"Regleta de 10 parells de connexió per desplaçament d'aïllant (tipus Krone) sobre una placa, a la part de dalt del registre. Per sota hi arriben els 10 parells del sangrat de la mànega; per dalt en surten les escomeses de 2 parells.",
   purpose:"Assigna dues línies a cada casa i en deixa sis de reserva.",
   where:`Registre secundari ${i}, a dalt, entre les sortides cap a les dues cases.`,
   connects:`Parells ${i===2?'1–10':'11–20'} de la mànega ↔ escomeses de les cases ${cs} (parells 1 i 2 de la regleta cap a la casa ${i===1?2:4}; 3 i 4 cap a la casa ${i===1?1:3}).`,
   example:"Per comprovar una línia, el tècnic connecta l'equip de prova als contactes de la regleta sense aixecar cap connexió.",
   confusion:"La regleta del registre secundari (punt de distribució) i les del RITU (punt d'interconnexió) són punts diferents de la mateixa xarxa.",
   nets:['xd_pt',...us.map(u=>`xs_pt_${u.id}`)]});
}

/* ---------------- per casa: canalització secundària i dispersió ---------------- */
for (const u of UNITS) {
  const U=u.id, i=RSOF(u), N=u.name;
  Object.assign(EL[`cs_${U}`], {name:`Canalització secundària de la ${N}`,
   what:"Són els tres tubs de Ø25 mm que van del registre secundari del soterrani al registre de terminació de xarxa de la casa. Formen la canalització secundària, que dona suport a la xarxa de dispersió.",
   purpose:"Fa que els cables surtin de la zona comuna i entrin a la casa protegits.",
   where:`Surten per dalt del registre secundari ${i}, travessen el sostre del soterrani i pugen per dins de la mitgera fins al rebedor ${u.del}, on entren al RTR per la paret del fons.`,
   connects:"Tres tubs de Ø25 mm: un per als dos coaxials de RTV, un per a la fibra i els parells, i un per a coaxial de TBA (aquí buit, amb fil guia).",
   example:`Si cal canviar l'escomesa de fibra ${u.del}, es pot estirar des del registre secundari sense obrir cap paret.`,
   confusion:"La canalització és el conducte que protegeix els cables; la xarxa són els cables. En un conjunt de cases no hi ha registre de pas a la planta: el tub va directament del registre secundari al RTR.",
   links:[`rs_${i}`,`rtr_${U}`]});
  Object.assign(EL[`xs_rtv_${U}`], {
   what:`Són els dos cables coaxials que surten dels derivadors del registre secundari ${i} i arriben al PAU de RTV ${u.del}.`,
   where:`Registre secundari ${i} (soterrani) → tub de RTV de la canalització secundària → RTR ${u.del}.`,
   connects:`Derivadors del registre secundari ${i} → PAU de RTV.`, canals:[`cs_${U}`], links:[`deriv_${i}`,`pau_rtv_${U}`]});
  Object.assign(EL[`xs_fo_${U}`], {
   what:`És el cable d'escomesa òptica (dues fibres, Ø3,8 mm) que surt per dalt de la caixa de segregació del registre secundari ${i} i acaba a la roseta òptica ${u.del}.`,
   where:`Caixa de segregació (registre secundari ${i}) → tub de parells i fibra de la canalització secundària → RTR.`,
   canals:[`cs_${U}`], links:[`cseg_${i}`,`pau_fo_${U}`]});
  Object.assign(EL[`xs_pt_${U}`], {
   what:`És el cable d'escomesa de 2 parells (Ø4 mm) ${u.del}: surt per dalt de la regleta del registre secundari ${i} i arriba al PAU de parells.`,
   connects:"Regleta del registre secundari → rosetes RJ45 del PAU (una per línia).",
   example:`Per comprovar la línia ${u.del}, el tècnic mesura des de la regleta del registre secundari (sense aixecar connexions) fins a la roseta del PAU.`,
   canals:[`cs_${U}`], links:[`bucle_${i}`,`pau_pt_${U}`,'pi_pt']});
  Object.assign(EL[`rtr_${U}`], {where:`Rebedor ${u.del}, a la mitgera, a prop de la porta d'entrada.`});
}

/* ---------------- conceptes, activitats i simplificacions ---------------- */
{ const c=CONCEPTS.find(x=>x[0]==='RITU'); if (c) c[1]=c[1].replace("No s'aplica a l'edifici del model.","És el recinte d'aquest conjunt de cases."); }
CONCEPTS.push(['Conjunt de cases unifamiliars',"En un conjunt de cases la ICT és comuna, com en un edifici: hi ha un recinte (aquí el RITU), una canalització principal soterrada o pel soterrani comunitari i un registre secundari a cada derivació. Des de cada registre secundari, la canalització secundària va directament al RTR de cada casa."]);

QUIZ.splice(0, QUIZ.length,
 {type:'pick', q:'Localitza el RITU al model o a la llista d\'elements.', ok:id=>id==='rits',
  hint:id=> id==='rp_fo'||id==='rp_pt'||id==='capcalera' ? 'Aquest element és dins del RITU. Selecciona el recinte sencer (o la seva porta).' : id==='torre' ? 'Aquesta és la torre d\'antenes. El RITU és el recinte que hi ha al davant.' : 'El RITU és la caseta de l\'extrem dret del conjunt, al costat de la torre d\'antenes.',
  good:'Correcte! El RITU és el recinte únic: fa de RITI i de RITS alhora.'},
 {type:'mcq', q:'Per què aquest conjunt té un RITU i no un RITI i un RITS?', opts:[
   'Perquè les cases no tenen televisió per satèl·lit.',
   'Perquè en conjunts de cases unifamiliars (i en edificis petits) el RD 346/2011 permet un sol recinte que faci les dues funcions.',
   'Perquè el RITU només serveix per a la fibra òptica.',
   'Perquè cada casa té el seu propi RITS.'], ok:1,
  why:['La capçalera de RTV també hi és, amb les antenes al costat.','','Al RITU hi ha la capçalera de RTV i els registres principals de fibra i de parells.','Hi ha un sol recinte per a tot el conjunt.'],
  good:'Correcte! El RITU reuneix en un sol local la capçalera de RTV i els punts d\'interconnexió dels operadors.'},
 {type:'pick', q:'Selecciona un registre secundari.', ok:id=>/^rs_\d$/.test(id),
  hint:id=> /^(deriv|cseg|bucle)_/.test(id) ? 'Aquest element és dins d\'un registre secundari. Selecciona la caixa que l\'allotja.' : id==='canal_principal' ? 'Aquesta és la canalització principal: segueix-la pel soterrani fins a una caixa al mur.' : 'Els registres secundaris són al soterrani, al mur de davant, sota les mitgeres de cada parella de cases.',
  good:'Correcte! Cada registre secundari dona servei a una parella de cases.'},
 {type:'mcq', q:'Per on passa la canalització principal en aquest conjunt?', opts:[
   'Per un patinet vertical de cada casa.',
   'Per la coberta de les cases.',
   'Pel sostre del soterrani comunitari, arran del mur de davant, des del RITU fins als registres secundaris.',
   'No n\'hi ha: cada casa té el seu cable des del carrer.'], ok:2,
  why:['En un edifici sí que és vertical; aquí les cases són adossades i la canalització és horitzontal.','Per sobre de terra només hi ha l\'enllaç superior, entre les antenes i el RITU.','','La ICT és comuna: els operadors arriben al RITU i des d\'allà es distribueix.'],
  good:'Correcte! Baixa del RITU al soterrani i va pel sostre fins als dos registres secundaris.'},
 {type:'pick', q:'Troba un PAU de la casa 3.', ok:id=>/^pau_(rtv|fo|pt)_0C$/.test(id),
  hint:id=> id==='rtr_0C' ? 'Has triat el registre de terminació de xarxa, que és la caixa. El PAU és a dins: obre\'l amb el botó «Obrir» del panell.' : /_0[ABD]$/.test(id) ? 'Aquest element és d\'una altra casa. La casa 3 és la tercera des de l\'esquerra.' : 'Els PAU són dins del registre de terminació de xarxa del rebedor de la casa.',
  good:'Correcte! Has trobat un PAU, dins del registre de terminació de xarxa.'},
 {type:'mcq', q:'Al registre secundari 2 hi ha derivadors de 16 dB i al registre 1, de 12 dB. Per què?', opts:[
   'Perquè les cases 1 i 2 tenen més preses.',
   'Perquè el registre 2 és el primer que troba el senyal: hi arriba més nivell i se\'n pot derivar menys proporció, de manera que totes les cases en reben un de semblant.',
   'Perquè els derivadors de 16 dB amplifiquen el senyal.',
   'És indiferent: es podrien intercanviar.'], ok:1,
  why:['Totes les cases tenen la mateixa dotació.','','Els derivadors són passius: no amplifiquen mai.','Si s\'intercanviessin, les cases 3 i 4 rebrien massa senyal i les 1 i 2, massa poc.'],
  good:'Correcte! La pèrdua de derivació és més gran on el senyal és més fort, a prop de la capçalera.'},
 {type:'pick', q:'Selecciona una canalització secundària (de qualsevol casa).', ok:id=>/^cs_/.test(id),
  hint:id=> /^xs/.test(id) ? 'Has triat els cables de dispersió (xarxa). La canalització és el tub que els allotja.' : id==='canal_principal' ? 'Aquesta és la canalització principal. La secundària surt per dalt dels registres secundaris cap a cada casa.' : 'Els tubs de la canalització secundària surten per dalt del registre secundari i pugen per la mitgera fins al RTR.',
  good:'Correcte! Tres tubs de Ø25 mm per casa, del registre secundari al RTR.'},
 {type:'order', q:'Ordena els trams de la xarxa de fibra, des de l\'operador fins a l\'usuari.', items:['Dispersió','Interior d\'usuari','Alimentació','Distribució'], ok:['Alimentació','Distribució','Dispersió','Interior d\'usuari'],
  bad:'Encara no. Recorda: l\'operador arriba fins al RITU (alimentació), va pel soterrani fins als registres secundaris (distribució), entra a la casa (dispersió) i es reparteix per les estàncies (interior).',
  good:'Correcte! Alimentació → distribució → dispersió → interior d\'usuari.'}
);

SIMPLIFICATIONS.splice(0, SIMPLIFICATIONS.length,
 'Model didàctic simplificat. La configuració real depèn del projecte i de la normativa aplicable.',
 'Conjunt de 4 cases (4 PAU). Cada casa té a la planta baixa la mateixa distribució i la mateixa ICT que els habitatges del model de l\'edifici (sala d\'estar, cuina, dos dormitoris, bany i rebedor); les golfes són traster i no porten preses.',
 'El RITU és el mateix recinte que el RITS del model de l\'edifici, amb la capçalera, l\'enllaç superior i les antenes, als quals s\'hi han afegit els registres principals de fibra i de parells i el registre d\'enllaç inferior a la paret de la porta. No se n\'han verificat les dimensions mínimes per a conjunts de cases.',
 'La canalització principal va pel soterrani comunitari. Es podria fer també soterrada, amb arquetes i registres de canvi de direcció, si no hi hagués soterrani.',
 'Els registres secundaris són de 550 × 1000 × 150 mm (més grans que el mínim) per poder veure els elements amb els cables a les corbes mínimes. Els tubs de la canalització secundària pugen per dins de la mitgera; al model es veuen si s\'amaguen les façanes i l\'estructura.',
 'El tall transversal del terreny és una representació: deixa veure el soterrani, el punt d\'entrada general i la canalització principal. Es pot treure a «Què es veu» → Opcions.',
 'Les corbes dels cables són arcs amb el radi mínim de curvatura de cada tipus (RG-6 33 mm, fibra d\'escomesa 18 mm, fibra de distribució 80 mm, mànega de 25 parells 108 mm). Dins dels registres, alguns radis es redueixen lleugerament per manca d\'espai.',
 'No es representa la xarxa coaxial de TBA (no hi ha operador de cable): els tubs de TBA de la canalització principal i de la secundària queden buits.',
 'Les façanes, els jardins, el carrer, els cotxes i l\'aparcament són orientatius; no són un projecte d\'arquitectura.',
 'RITU: els equips de la capçalera i els connectors són a escala real (mides dels catàlegs del fabricant). Els equips són exemples comercials documentats (Televes), no una recomanació.'
);
