/* =====================================================================
   DADES EDUCATIVES  (independents de la geometria)
   Cada element: id estable, família, capa, nom, sigla, servei, planta,
   habitatge, zona, textos i relacions. La geometria hi fa referència per id.
   ===================================================================== */
'use strict';
/* model que es mostra: 'edifici' (index.html) o 'cases' (cases.html, dades a js/dades-cases.js) */
const MODEL = document.documentElement.dataset.model || 'edifici';
const ORD = {1:'1r',2:'2n',3:'3r',4:'4t'};
let FLOORNAME = f => f===-1 ? 'Soterrani' : f===0 ? 'Planta baixa' : f===5 ? 'Coberta' : `${f}a planta`;
const SIDES = ['A','B','C','D'];
const UNITS = [];
if (MODEL==='edifici') for (const f of [1,2,3,4]) for (const s of SIDES) UNITS.push({id:`${f}${s}`, f, s, name:`${ORD[f]} ${s}`});
const UNIT = id => UNITS.find(u => u.id === id);
const unitTitle = u => u.title || `Habitatge ${u.name}`;
/* paràmetres de la interfície que depenen del model (js/dades-cases.js els canvia per al model de cases) */
const CFG = {
  floor0:2, side0:'A',                          // planta i habitatge inicials (mode «Habitatge detallat»)
  unitFloors:[1,2,3,4],                         // plantes amb habitatges
  whole:'Edifici complet',                      // nom de la vista sencera
  rits:'RITS',                                  // nom del recinte de la capçalera
  clamp:{x:[-16,16], y:[-4,22], z:[-24,16]},    // límits del punt de mira de la càmera
  sceneLabel:"Escena 3D de l'edifici",
  welcome:null, about:null,                     // HTML de benvinguda i «Sobre el model» (null: els de l'edifici)
  keepFacade:null, backOf:null                  // funcions opcionals per a ensureVisible() i frameEl()
};

const FAMILIES = {
  xarxa:  {name:'A. Xarxes', short:'Xarxa', desc:'Cables i elements que transporten el senyal (el «contingut»).'},
  canal:  {name:'B. Canalitzacions', short:'Canalització', desc:'Tubs i canals que allotgen i protegeixen els cables (el «camí»).'},
  recinte:{name:'C. Recintes i registres', short:'Recinte o registre', desc:'Locals i caixes que allotgen equips, connexions o permeten el pas dels cables.'},
  punt:   {name:'D. Punts de connexió i equips', short:'Punt de connexió o equip', desc:'Llocs on s\'uneixen o acaben els trams de xarxa, i equips associats.'}
};
/* capes del menú de visibilitat (icona de l'ull) */
const LAYERS = {
  facana:'Façana', estructura:'Estructura i espais interiors', recintes:'Recintes', registres:'Registres',
  canalitzacions:'Canalitzacions', xarxes:'Cables', punts:'Punts de connexió', equips:'Equips', etiquetes:'Etiquetes'
};
/* llista natural d'habitatges d'una planta: «2n A, 2n B, 2n C i 2n D» */
const floorUnitsTxt = f => { const n=SIDES.map(s=>`${ORD[f]} ${s}`); return n.slice(0,-1).join(', ')+' i '+n[n.length-1]; };
/* derivadors F 4D de Televes (catàleg): el senyal baixa des de la capçalera de la coberta, de manera que la pèrdua de
   derivació creix a mesura que es puja (les plantes altes reben més nivell). db: nominal; der i pas: mesurades TER/SAT. */
const TAPF={4:{db:24, ref:'519345', der:'23,2 / 23,5', pas:'2,3 / 2,5'}, 3:{db:20, ref:'519344', der:'20', pas:'2,2'},
            2:{db:16, ref:'519343', der:'17 / 17,5', pas:'2,5 / 3'}, 1:{db:12, ref:'519342', der:'12,5 / 13', pas:'2,5 / 3,6'}};
const SERVICES = {all:'Tots els serveis', rtv:'RTV', fo:'Accés per fibra òptica', pt:'Parells (telefonia i dades)', tba:'Coaxial de TBA'};
const TRAMS = {
  alim:{name:'Alimentació', color:'#E07B24', sym:'▲'},
  capt:{name:'Captació RTV (antena → capçalera)', color:'#A8742A', sym:'✚'},
  dist:{name:'Distribució', color:'#2F6FDE', sym:'■'},
  disp:{name:'Dispersió', color:'#23955A', sym:'●'},
  int: {name:'Interior d\'usuari', color:'#8E4EC6', sym:'◆'},
  usr: {name:'Connexions d\'equips d\'usuari', color:'#7A7A7A', sym:'–'}
};
const TECHS = {
  fo:  {name:'Fibra òptica', color:'#0AA5C2', pattern:'franges blanques curtes', sym:'FO'},
  coax:{name:'Cable coaxial', color:'#C2185B', pattern:'llis', sym:'CX'},
  pt:  {name:'Parells de coure', color:'#8D6E1F', pattern:'franges diagonals', sym:'PT'}
};

const EL = {};
function def(o){ if(EL[o.id]) throw new Error('id duplicat '+o.id); o.links = o.links||[]; EL[o.id]=o; return o; }

/* ---------------- Elements comuns ---------------- */
def({id:'xal_fo', fam:'xarxa', layer:'xarxes', svc:'fo', tram:'alim', tech:'fo', floor:0, zone:'exterior i comuna', main:false,
 name:'Xarxa d\'alimentació de fibra òptica (operador)', sigla:'',
 what:'És el cable de fibra òptica de l\'operador que arriba des de la seva central fins a l\'edifici. És el primer tram de la xarxa d\'accés per fibra.',
 purpose:'Porta el servei de l\'operador (internet, telefonia, televisió de pagament) fins al punt d\'interconnexió de l\'edifici.',
 where:'Ve del carrer, entra per l\'arqueta d\'entrada, passa per la canalització externa i la canalització d\'enllaç inferior i acaba al registre principal òptic, dins del RITI.',
 connects:'Uneix la central o node de l\'operador amb el repartidor d\'entrada del punt d\'interconnexió òptic.',
 example:'Quan un veí contracta fibra, l\'operador estén el seu cable pels tubs que ja existeixen fins al RITI i el connecta al seu repartidor d\'entrada. No cal fer obres a l\'edifici.',
 confusion:'Aquest cable és de l\'operador, que el dissenya i el manté. La canalització per on passa, en canvi, és de l\'edifici i forma part de la ICT.',
 nets:[], canals:['canal_ext','canal_enllac_inf'], links:['arqueta','peg','reg_enllac_inf','pi_fo']});
def({id:'xal_pt', fam:'xarxa', layer:'xarxes', svc:'pt', tram:'alim', tech:'pt', floor:0, zone:'exterior i comuna',
 name:'Xarxa d\'alimentació de parells (mànega multiparell de l\'operador)', sigla:'',
 what:'És la mànega multiparell (un cable amb molts parells de coure) de l\'operador del servei telefònic disponible al públic (STDP), que arriba a l\'edifici pel mateix camí que la fibra.',
 purpose:'Fa arribar les línies telefòniques de l\'operador fins a les seves regletes d\'entrada, al punt d\'interconnexió de parells.',
 where:'Carrer → arqueta d\'entrada → canalització externa → enllaç inferior → regletes d\'entrada del registre principal de parells (RITI).',
 connects:'Uneix la central de l\'operador amb les regletes d\'entrada (columna esquerra) del punt d\'interconnexió de parells.',
 example:'Quan un veí contracta una línia, el tècnic de l\'operador fa un pont des d\'un parell de la seva regleta d\'entrada fins al parell de la regleta de sortida que va al 3r C.',
 confusion:'La mànega de l\'operador i la de l\'edifici són cables diferents: no s\'empalmen, s\'uneixen al punt d\'interconnexió amb ponts (fils de pont) entre regletes.',
 canals:['canal_ext','canal_enllac_inf'], links:['arqueta','peg','pi_pt']});
def({id:'cab_capt', fam:'xarxa', layer:'xarxes', svc:'rtv', tram:'capt', tech:'coax', floor:5, zone:'comuna (coberta)', main:false,
 name:'Cable coaxial de l\'antena TDT', sigla:'',
 what:'Cable coaxial que baixa des de la caixa de connexió de l\'antena de TDT fins a l\'entrada de la capçalera, al RITS. RTV vol dir radiodifusió sonora i televisió.',
 purpose:'Porta el senyal de televisió digital terrestre (bandes UHF) captat per l\'antena Yagi fins als amplificadors de la capçalera.',
 where:'Baixa pel màstil i per una cara de la torre subjectat amb brides, fa una gassa de goteig, entra al tub d\'enllaç superior i travessa el passamurs del RITS.',
 connects:'Antena TDT → tub d\'enllaç superior → registre d\'enllaç (unió F‑F) → entrada de TDT de la capçalera.',
 example:'Si després d\'un temporal no es veu la TDT a cap habitatge, però la ràdio sí que funciona, primer cal revisar l\'antena de TDT i aquest cable.',
 confusion:'Cada antena té el seu propi cable fins al RITS: els quatre coaxials comparteixen el tub d\'enllaç, però no s\'uneixen fins a la capçalera.',
 canals:['canal_enllac_sup'], links:['antena','reg_enllac_sup','capcalera']});
def({id:'cab_dab', fam:'xarxa', layer:'xarxes', svc:'rtv', tram:'capt', tech:'coax', floor:5, zone:'comuna (coberta)',
 name:'Cable coaxial de l\'antena DAB', sigla:'',
 what:'Cable coaxial d\'exterior, de polietilè negre, que surt de la caixa taronja del dipol plegat de l\'antena de ràdio digital (DAB).',
 purpose:'Porta el senyal de ràdio digital de la banda III (VHF) fins a la capçalera.',
 where:'Va per sota del bum de l\'antena DAB fins al màstil, baixa pel màstil i per la torre amb brides i entra al tub d\'enllaç superior.',
 connects:'Antena DAB → tub d\'enllaç superior → registre d\'enllaç (unió F‑F) → entrada de VHF/DAB de la capçalera.',
 example:'Si al RITS es desconnecta aquest cable, les emissores DAB desapareixen però la TDT i l\'FM continuen funcionant.',
 confusion:'És un cable independent del de TDT, encara que facin el mateix camí: el senyal de cada antena entra per separat a la capçalera.',
 canals:['canal_enllac_sup'], links:['antena_dab','reg_enllac_sup','capcalera']});
def({id:'cab_fm', fam:'xarxa', layer:'xarxes', svc:'rtv', tram:'capt', tech:'coax', floor:5, zone:'comuna (coberta)',
 name:'Cable coaxial de l\'antena FM', sigla:'',
 what:'Cable coaxial d\'exterior, de polietilè negre, que surt de la caixa taronja del dipol circular d\'FM.',
 purpose:'Porta el senyal de ràdio FM (87,5–108 MHz) fins a l\'entrada d\'FM de la capçalera.',
 where:'Surt de la caixa del dipol circular, baixa pel màstil i per la torre amb brides i entra al tub d\'enllaç superior.',
 connects:'Antena FM → tub d\'enllaç superior → registre d\'enllaç (unió F‑F) → entrada d\'FM de la capçalera.',
 example:'Quan la ràdio FM dels habitatges sona amb soroll, l\'instal·lador mesura el nivell a la unió F‑F d\'aquest cable.',
 confusion:'L\'FM és ràdio analògica en banda II; no es barreja amb la TDT fins a la capçalera.',
 canals:['canal_enllac_sup'], links:['antena_fm','reg_enllac_sup','capcalera']});
def({id:'cab_sat', fam:'xarxa', layer:'xarxes', svc:'rtv', tram:'capt', tech:'coax', floor:5, zone:'comuna (coberta)', optional:true,
 name:'Cable coaxial de l\'LNB (satèl·lit)', sigla:'',
 what:'Cable coaxial d\'exterior, de polietilè negre, que surt del connector F de l\'LNB de la parabòlica. Porta la freqüència intermèdia (FI) de satèl·lit.',
 purpose:'Porta els senyals de satèl·lit, ja convertits per l\'LNB a FI (950–2150 MHz), fins al RITS.',
 where:'Baixa pel braç de l\'LNB i pel tub de suport de la parabòlica, passa per la base de la torre, fa la gassa de goteig i entra al tub d\'enllaç superior.',
 connects:'LNB → tub d\'enllaç superior → registre d\'enllaç (unió F‑F) → cable interior de reserva al costat de la capçalera.',
 example:'Una comunitat que vol afegir canals de satèl·lit hi connecta un barrejador TV‑SAT o una capçalera de FI sense haver d\'estendre cap cable nou per la coberta.',
 confusion:'La recepció per satèl·lit és opcional a la ICT. Aquí el cable arriba al RITS i queda tapat a la reserva: la capçalera representada només tracta senyals terrestres.',
 canals:['canal_enllac_sup'], links:['lnb','parabola','reg_enllac_sup','rits']});
def({id:'xd_rtv', fam:'xarxa', layer:'xarxes', svc:'rtv', tram:'dist', tech:'coax', floor:null, vertical:true, zone:'comuna',
 name:'Xarxa de distribució de RTV', sigla:'',
 what:'Són els dos cables coaxials que surten de la capçalera, al RITS, i baixen per la canalització principal passant per tots els registres secundaris.',
 purpose:'Reparteix el senyal de ràdio i televisió per totes les plantes. Comença a la sortida del mesclador de la capçalera i acaba als derivadors.',
 where:'RITS → tub de RTV de la canalització principal → registres secundaris de la 4a a la 1a planta.',
 connects:'Uneix les sortides de la capçalera amb els derivadors de cada planta. El darrer derivador de cada cable té la sortida final tancada amb una càrrega.',
 example:'A la 2a planta, cada cable entra en un derivador: una part del senyal va als quatre habitatges de la planta (2n A, 2n B, 2n C i 2n D) i la resta continua cap a la 1a planta.',
 confusion:'«Distribució» és la funció del tram; «coaxial» és el tipus de cable. A l\'edifici també hi ha distribució de fibra i de parells, amb cables diferents. Hi ha dos cables perquè a cada PAU (punt d\'accés a l\'usuari) n\'arribin dos.',
 canals:['canal_principal'], links:['capcalera','deriv_1','deriv_2','deriv_3','deriv_4']});
def({id:'xd_fo', fam:'xarxa', layer:'xarxes', svc:'fo', tram:'dist', tech:'fo', floor:null, vertical:true, zone:'comuna',
 name:'Xarxa de distribució de fibra òptica', sigla:'',
 what:'És el cable multifibra de l\'edifici que surt del panell de sortida del registre principal òptic (RITI) i puja per la canalització principal.',
 purpose:'Fa arribar fibres a totes les plantes. És única per a aquesta tecnologia i la comparteixen tots els operadors.',
 where:'RITI → tub de fibra de la canalització principal → caixes de segregació dels registres secundaris.',
 connects:'Uneix el punt d\'interconnexió òptic amb els punts de distribució òptics (caixes de segregació). Configuració del model: a cada planta s\'empalmen les fibres d\'aquella planta amb els cables d\'escomesa; la resta de fibres continuen en pas cap amunt.',
 example:'Si arriba un operador nou, no instal·la un altre cable vertical: connecta la seva xarxa al punt d\'interconnexió i fa servir aquesta distribució.',
 confusion:'No és el cable de l\'operador. El cable de l\'operador s\'acaba al RITI; a partir del panell de sortida, la fibra és de la propietat de l\'edifici.',
 canals:['canal_principal'], links:['pi_fo','cseg_1','cseg_2','cseg_3','cseg_4']});
def({id:'xd_pt', fam:'xarxa', layer:'xarxes', svc:'pt', tram:'dist', tech:'pt', floor:null, vertical:true, zone:'comuna',
 name:'Xarxa de distribució de parells (mànega de 50 parells)', sigla:'',
 what:'És una mànega multiparell de 50 parells (Ø14,4 mm) que surt de les regletes de sortida del RITI, va per la safata i puja per la canalització principal. A cada planta entra al registre secundari, s\'apropa a la placa del fons, on va subjectada amb brides, i torna al tub de dalt. Al sangrat s\'obre una finestra a la coberta i se\'n treuen els 10 parells de la planta cap a la regleta; a la 4a planta la mànega acaba al registre amb un caputxó (parells 41–50 de reserva).',
 purpose:'Porta les línies de l\'edifici des del punt d\'interconnexió fins al punt de distribució de cada planta. Dimensionament (RD 346/2011, annex II): 16 habitatges × 2 línies + local 3 + serveis comuns 2 = 37 línies; × 1,2 de reserva = 44,4 → cable normalitzat de 50 parells.',
 where:'RITI (regletes de sortida) → tub de parells de la canalització principal → registres secundaris de la 1a a la 4a planta.',
 connects:'Regletes de sortida del punt d\'interconnexió ↔ regleta de 10 parells de cada registre secundari (parells 1–10 a la 1a planta, 11–20 a la 2a, 21–30 a la 3a i 31–40 a la 4a; del 41 al 50, reserva).',
 example:'Si s\'avaria el parell que va al 2n B, el tècnic pot passar la línia a un dels dos parells lliures de la regleta de la 2a planta sense estendre cap cable nou.',
 confusion:'El sangrat no talla la mànega: només se n\'extreuen els parells de la planta i la resta continua cap amunt. La reserva del 20 % és per a avaries i ampliacions.',
 canals:['canal_principal'], links:['pi_pt','bucle_1','bucle_2','bucle_3','bucle_4']});

def({id:'canal_ext', fam:'canal', layer:'canalitzacions', svc:'all', floor:0, zone:'exterior', main:true,
 name:'Canalització externa', sigla:'',
 what:'Són els tubs soterrats que van des de l\'arqueta d\'entrada fins al punt d\'entrada general de l\'edifici.',
 purpose:'Introdueix a l\'edifici les xarxes d\'alimentació dels operadors, protegides i sense haver d\'obrir la vorera cada vegada.',
 where:'Sota la vorera, entre l\'arqueta d\'entrada i la façana (es veu per la rasa oberta del model).',
 connects:'Allotja els cables d\'alimentació de fibra i de parells. Connecta l\'arqueta d\'entrada amb el punt d\'entrada general.',
 example:'Quan un segon operador vol donar servei, passa el seu cable per aquests tubs fins a la façana.',
 confusion:'La canalització externa és de l\'edifici encara que els cables que hi passen siguin dels operadors. Segons el RD 346/2011 són 4 tubs de Ø63 mm: al model, un per a cada cable d\'alimentació de fibra (dos operadors), un per a la de parells i un de reserva.',
 nets:['xal_fo','xal_pt'], links:['arqueta','peg']});
def({id:'canal_enllac_inf', fam:'canal', layer:'canalitzacions', svc:'all', floor:0, zone:'comuna', main:true,
 name:'Canalització d\'enllaç inferior', sigla:'',
 what:'Són els tubs que continuen des del punt d\'entrada general fins al registre principal del RITI, amb registres d\'enllaç intercalats. N\'hi ha tants com a la canalització externa (4), de Ø40 a Ø63 mm segons els cables: aquí de Ø63 mm, perquè la mànega de parells de l\'operador fa Ø18 mm i necessita corbes amples.',
 purpose:'Porta els cables d\'alimentació dels operadors per dins de l\'edifici fins al recinte inferior.',
 where:'Planta baixa: des de la façana, pel sostre del vestíbul, fins al RITI.',
 connects:'Punt d\'entrada general → registre d\'enllaç inferior → RITI (registres principals).',
 example:'El tècnic estira el cable des del registre d\'enllaç fins al RITI sense obrir el fals sostre del vestíbul.',
 confusion:'No s\'ha de confondre amb l\'enllaç superior: l\'inferior porta les xarxes dels operadors per cable; el superior porta els cables de les antenes.',
 nets:['xal_fo','xal_pt'], links:['peg','reg_enllac_inf','riti']});
def({id:'canal_enllac_sup', fam:'canal', layer:'canalitzacions', svc:'rtv', floor:5, zone:'comuna (coberta)',
 name:'Canalització d\'enllaç superior', sigla:'',
 what:'És el tub que porta els cables dels sistemes de captació (antenes) des de la coberta fins al RITS, entrant per un element passamurs.',
 purpose:'Protegeix els cables de les antenes i els fa entrar al recinte superior sense filtracions.',
 where:'Coberta: des del peu de la torre d\'antenes fins a la paret del RITS.',
 connects:'Torre d\'antenes → passamurs i registre d\'enllaç superior → RITS. Hi passen quatre coaxials independents: TDT, DAB, FM i satèl·lit.',
 example:'Per afegir la parabòlica, el cable de l\'LNB es passa pel mateix tub d\'enllaç superior fins a la capçalera.',
 confusion:'Aquest tub no porta cables d\'operadors de fibra: aquests entren per baix (arqueta i enllaç inferior).',
 nets:['cab_capt','cab_dab','cab_fm','cab_sat'], links:['torre','reg_enllac_sup','rits']});
def({id:'canal_principal', fam:'canal', layer:'canalitzacions', svc:'all', floor:null, vertical:true, zone:'comuna', main:true,
 name:'Canalització principal', sigla:'',
 what:'És el conjunt de tubs verticals que uneix el RITI, els registres secundaris de cada planta i el RITS.',
 purpose:'Dona suport a les xarxes de distribució de tots els serveis. És l\'«eix vertical» de la ICT.',
 where:'Zona comuna, al patinet d\'instal·lacions del distribuïdor de cada planta, des del RITI (planta baixa) fins al RITS (coberta).',
 connects:'Sis tubs de Ø50 mm (RD 346/2011): un per a RTV, un per a parells o parells trenats, dos per a cables coaxials (TBA), un per a fibra òptica i un de reserva. Al model, els de TBA i el de reserva són buits.',
 example:'Entre la 2a i la 3a planta, pel tub de RTV hi passen els dos coaxials de distribució i pel tub de parells, els cables que van als habitatges de la 3a i la 4a planta.',
 confusion:'La canalització principal és el conducte; la xarxa de distribució són els cables que hi ha a dins. Un tub buit continua sent canalització.',
 nets:['xd_rtv','xd_fo','xd_pt'], links:['riti','rits','rs_1','rs_2','rs_3','rs_4']});

def({id:'arqueta', fam:'recinte', layer:'recintes', svc:'all', floor:0, zone:'exterior', main:true, container:true, lid:true,
 name:'Arqueta d\'entrada', sigla:'',
 what:'És una caixa soterrada a la vorera, amb tapa, on conflueixen les canalitzacions dels operadors i on comença la canalització externa de l\'edifici.',
 purpose:'És el punt de trobada entre les xarxes dels operadors i la ICT (infraestructura comuna de telecomunicacions). Facilita estendre els cables sense obrir la vorera.',
 where:'Zona exterior, a la vorera davant de la façana.',
 connects:'Hi passen els cables d\'alimentació (fibra i parells) i en surt la canalització externa cap al punt d\'entrada general.',
 example:'Un tècnic de l\'operador aixeca la tapa de l\'arqueta per passar el cable de fibra cap a l\'edifici.',
 confusion:'L\'arqueta no és el punt d\'entrada general: l\'arqueta és a l\'exterior; el punt d\'entrada general és on els tubs travessen el límit de l\'edifici.',
 nets:['xal_fo','xal_pt'], canals:['canal_ext'], links:['peg']});
def({id:'peg', fam:'punt', layer:'punts', svc:'all', floor:0, zone:'límit exterior/comuna', main:true,
 name:'Punt d\'entrada general', sigla:'PEG',
 what:'És el lloc de la façana per on la canalització externa travessa el mur i entra a la zona comuna de l\'edifici.',
 purpose:'Marca l\'accés físic dels cables d\'alimentació a l\'edificació. A partir d\'aquí, la canalització és interior.',
 where:'Base de la façana, a sota del nivell de la vorera, al final de la rasa.',
 connects:'Separa la canalització externa de la canalització d\'enllaç inferior.',
 example:'Si entra aigua al vestíbul pels tubs, cal revisar el segellat del punt d\'entrada general.',
 confusion:'No és una caixa amb connexions ni un equip: és un accés físic. Hi passen cables, però no s\'hi connecta res.',
 nets:['xal_fo','xal_pt'], canals:['canal_ext','canal_enllac_inf'], links:['arqueta','reg_enllac_inf']});
def({id:'reg_enllac_inf', fam:'recinte', layer:'registres', svc:'all', floor:0, zone:'comuna', container:true, lid:true,
 name:'Registre d\'enllaç inferior', sigla:'',
 what:'És una caixa situada a la cara interior de la façana, just després del punt d\'entrada general, intercalada en la canalització d\'enllaç.',
 purpose:'Facilita l\'estesa dels cables d\'alimentació: permet estirar-los per trams i deixar-hi una reserva de cable.',
 where:'Planta baixa, paret interior de la façana, a sobre del punt d\'entrada general.',
 connects:'Allotja els cables d\'alimentació en pas. No hi ha connexions de xarxa.',
 example:'L\'operador fa passar el cable fins aquí, el recull i després l\'estira cap al RITI.',
 confusion:'És un registre de pas dels cables, no un punt de connexió: els cables hi entren i en surten sense tallar-se.',
 nets:['xal_fo','xal_pt'], canals:['canal_enllac_inf'], links:['peg','riti']});
def({id:'riti', fam:'recinte', layer:'recintes', svc:'all', floor:0, zone:'comuna', main:true, container:true, lid:true,
 name:'Recinte d\'instal·lacions de telecomunicació inferior', sigla:'RITI',
 what:'És un local de la zona comuna, a la part baixa de l\'edifici, on hi ha els registres principals dels serveis de telefonia i banda ampla.',
 purpose:'Allotja els punts d\'interconnexió, on els operadors connecten les seves xarxes a la xarxa de l\'edifici. D\'aquí arrenca la canalització principal.',
 where:'Planta baixa, zona comuna, al fons del vestíbul.',
 connects:'Allotja el registre principal òptic i el de parells. Hi arriba l\'enllaç inferior i hi comença la canalització principal. Té una safata perimetral per als cables.',
 example:'Per donar d\'alta la fibra del 2n A, el tècnic entra al RITI i connecta un latiguillo del seu repartidor al connector «2n A» del panell de sortida.',
 confusion:'El RITI és el recinte; el registre principal és la caixa o armari que hi ha a dins i que conté el punt d\'interconnexió. Al model el RITI es veu tancat amb dues portes abatibles: obre\'l des del panell per veure\'n l\'interior.',
 nets:['xal_fo','xal_pt','xd_fo','xd_pt'], canals:['canal_enllac_inf','canal_principal'], links:['rits']});
def({id:'rp_fo', fam:'recinte', layer:'registres', svc:'fo', floor:0, zone:'comuna', parent:'riti', container:true, lid:true,
 name:'Registre principal òptic', sigla:'',
 what:'És la caixa o armari, dins del RITI, que conté el punt d\'interconnexió de fibra òptica.',
 purpose:'Protegeix i ordena els repartidors d\'entrada dels operadors i el panell de sortida comú de la xarxa de distribució.',
 where:'RITI, paret del fons, a la dreta de la canalització principal.',
 connects:'Hi acaba la xarxa d\'alimentació de fibra i hi comença la xarxa de distribució de fibra.',
 example:'Cada operador té el seu repartidor d\'entrada dins d\'aquest registre; el panell de sortida és únic i comú per a tots.',
 confusion:'No és el mateix que el RITI: un RITI pot contenir diversos registres principals, un per tecnologia.',
 nets:['xal_fo','xd_fo'], canals:['canal_enllac_inf','canal_principal'], links:['riti']});
def({id:'pi_fo', fam:'punt', layer:'punts', svc:'fo', floor:0, zone:'comuna', parent:'rp_fo',
 name:'Punt d\'interconnexió òptic (repartidors i panell de sortida)', sigla:'',
 what:'Són els panells de connexió on acaben les fibres dels operadors (repartidors d\'entrada) i on comencen les fibres de l\'edifici (panell de sortida). S\'uneixen amb latiguillos.',
 purpose:'Uneix la xarxa d\'alimentació amb la de distribució i delimita responsabilitats: fins aquí, l\'operador; d\'aquí cap amunt, la propietat. També s\'anomena punt de terminació de xarxa.',
 where:'Dins del registre principal òptic, al RITI.',
 connects:'Xarxa d\'alimentació de fibra (entrada) ↔ xarxa de distribució de fibra (sortida). Els connectors de sortida estan etiquetats per habitatge.',
 example:'Donar servei al 2n A vol dir posar un latiguillo entre el repartidor de l\'operador i el connector «2n A» del panell de sortida.',
 confusion:'Punt, registre i recinte són tres coses diferents: el punt d\'interconnexió és dins del registre principal, que és dins del RITI. Al model es veu com tres caixes terminals òptiques (CTO) murals: la de dalt, amb etiqueta blava, és el panell de sortida de l\'edifici; les de sota, amb etiqueta taronja i el número de l\'operador, són els repartidors d\'entrada de dos operadors. Els latiguillos grocs les uneixen pel lateral dret.',
 nets:['xal_fo','xd_fo'], links:['rp_fo']});
def({id:'rp_pt', fam:'recinte', layer:'registres', svc:'pt', floor:0, zone:'comuna', parent:'riti', container:true, lid:true,
 name:'Registre principal de parells (STDP)', sigla:'',
 what:'És la caixa, dins del RITI, que conté el punt d\'interconnexió de parells: les regletes d\'entrada dels operadors i les regletes de sortida de l\'edifici, de tipus Krone.',
 purpose:'Ordena i protegeix les connexions entre la mànega de l\'operador i la mànega de distribució de l\'edifici.',
 where:'RITI, paret del fons, a l\'extrem dret.',
 connects:'Hi acaba la xarxa d\'alimentació de parells i hi comença la mànega de distribució de 50 parells.',
 example:'Hi ha dues columnes de regletes de 10 parells: a l\'esquerra, 8 d\'entrada (80 parells, almenys 1,5 vegades els de sortida); a la dreta, 5 de sortida (50 parells, tots els de la mànega).',
 confusion:'El registre és la caixa; el punt d\'interconnexió són les regletes i els ponts que hi ha a dins.',
 nets:['xal_pt','xd_pt'], canals:['canal_enllac_inf','canal_principal'], links:['riti']});
def({id:'pi_pt', fam:'punt', layer:'punts', svc:'pt', floor:0, zone:'comuna', parent:'rp_pt',
 name:'Punt d\'interconnexió de parells (regletes Krone d\'entrada i de sortida)', sigla:'',
 what:'Són regletes de 10 parells amb connexió per desplaçament d\'aïllant (tipus Krone): a l\'esquerra, les d\'entrada de l\'operador; a la dreta, les de sortida de l\'edifici. Els ponts vermells i blaus són les línies donades d\'alta.',
 purpose:'Permet assignar a cada habitatge la línia de l\'operador que ha contractat amb un pont entre dues regletes. Delimita responsabilitats: fins a l\'entrada, l\'operador; des de la sortida, la propietat.',
 where:'Dins del registre principal de parells, al RITI.',
 connects:'Xarxa d\'alimentació de parells (regletes d\'entrada) ↔ ponts ↔ mànega de distribució (regletes de sortida). Cada regleta de sortida correspon a una planta.',
 example:'Per canviar d\'operador, el tècnic treu el pont i en fa un de nou des de la regleta d\'entrada del nou operador fins al mateix parell de sortida.',
 confusion:'Les regletes del RITI (punt d\'interconnexió) i la regleta de cada registre secundari (punt de distribució) són punts diferents de la mateixa xarxa.',
 nets:['xal_pt','xd_pt'], links:['rp_pt']});
def({id:'rits', fam:'recinte', layer:'recintes', svc:'rtv', floor:5, zone:'comuna (coberta)', main:true, container:true, lid:true,
 name:'Recinte d\'instal·lacions de telecomunicació superior', sigla:'RITS',
 what:'És el local de la coberta on s\'allotgen els equips per adaptar i distribuir els senyals de RTV i, si n\'hi ha, elements de serveis d\'accés sense fils (SAI).',
 purpose:'Hi arriben els cables de les antenes i hi comença la xarxa de distribució de RTV cap a les plantes.',
 where:'Coberta, sobre el nucli d\'escala, a prop de les antenes.',
 connects:'Allotja l\'equip de capçalera i el registre d\'enllaç superior. Hi acaba la canalització principal.',
 example:'Quan un canal de TDT canvia de freqüència, l\'instal·lador ajusta l\'amplificador corresponent de la capçalera del RITS.',
 confusion:'El RITS no rep la fibra dels operadors: el seu paper principal és la RTV. RITI i RITS es comuniquen per la canalització principal. Al model es veu tancat amb dues portes abatibles: obre\'l des del panell.',
 nets:['cab_capt','xd_rtv'], canals:['canal_enllac_sup','canal_principal'], links:['riti']});
def({id:'reg_enllac_sup', fam:'recinte', layer:'registres', svc:'rtv', floor:5, zone:'comuna (coberta)', parent:'rits',
 name:'Passamurs i registre d\'enllaç superior', sigla:'',
 what:'És l\'element que permet que el tub d\'enllaç superior travessi la paret del RITS sense filtracions, amb una caixa interior per accedir als cables.',
 purpose:'Fa l\'entrada segura dels cables de captació dins de l\'edificació.',
 where:'Paret lateral del RITS, a la coberta.',
 connects:'Canalització d\'enllaç superior → interior del RITS. Hi passen els cables de captació.',
 example:'En afegir una antena nova, el cable entra pel passamurs; no cal fer un forat nou a la paret.',
 confusion:'És un pas protegit, no un amplificador ni un punt de connexió.',
 nets:['cab_capt','cab_dab','cab_fm','cab_sat'], canals:['canal_enllac_sup'], links:['rits']});
def({id:'capcalera', fam:'punt', layer:'equips', svc:'rtv', floor:5, zone:'comuna (coberta)', parent:'rits',
 name:'Equip de capçalera de RTV', sigla:'',
 what:'Són els equips que adapten els senyals de les antenes: amplificadors, filtres, font d\'alimentació i mesclador.',
 purpose:'Ajusta el nivell i la qualitat dels senyals perquè arribin bé a totes les preses. La xarxa de distribució de RTV comença a la sortida del mesclador.',
 where:'RITS, paret del fons.',
 connects:'Entrades: cables de captació. Sortides: els dos cables de la xarxa de distribució de RTV.',
 example:'Un amplificador programable de la capçalera puja el nivell d\'un múltiplex de TDT que arribava feble als pisos baixos.',
 confusion:'La capçalera no té res a veure amb la fibra dels operadors i no és al RITI. Tampoc és un PAU.',
 nets:['cab_capt','cab_dab','cab_fm','xd_rtv'], links:['antena','antena_dab','antena_fm','rits']});
def({id:'torre', support:true, fam:'punt', layer:'equips', svc:'rtv', floor:5, zone:'comuna (coberta)',
 name:'Torre de gelosia triangular (suport d\'antenes)', sigla:'',
 what:'Torre d\'acer galvanitzat de secció triangular, amb tres muntants units per travessers horitzontals i diagonals, ancorada a la coberta amb una placa base i perns. Fa 6 m des del paviment de la coberta fins a la placa superior.',
 purpose:'Eleva les antenes per sobre dels obstacles de la coberta i sosté el màstil, la parabòlica i els cables.',
 where:'Coberta, al costat del RITS. Està arriostrada amb tres tirants a 120°.',
 connects:'Suporta el màstil (a la part superior), la parabòlica (en un lateral) i els quatre cables coaxials, subjectats amb brides a una de les cares.',
 example:'Abans de pujar-hi, l\'instal·lador comprova la placa base, els perns i la tensió dels tres tirants.',
 confusion:'La torre és un suport mecànic: no capta ni transporta senyal. Les mesures del model són didàctiques; en una obra real cal seguir el càlcul i les instruccions del fabricant.',
 links:['mastil','tirants','parabola','cab_capt','cab_dab','cab_fm','cab_sat']});
def({id:'mastil', support:true, fam:'punt', layer:'equips', svc:'rtv', floor:5, zone:'comuna (coberta)',
 name:'Màstil tubular de les antenes', sigla:'',
 what:'Tub d\'acer galvanitzat encaixat a la part alta de la torre i subjectat amb brides en U a dues plaques guia. Té un tap a l\'extrem superior.',
 purpose:'Sosté les tres antenes terrestres separades verticalment, cadascuna amb la seva brida.',
 where:'Damunt de la torre, de 21 m a uns 25 m d\'alçada sobre el terra del carrer al model.',
 connects:'Antena TDT (a dalt), antena DAB (al mig) i dipol FM (a baix). Els cables baixen per la seva cara posterior.',
 example:'Si cal reorientar l\'antena TDT, s\'afluixa la seva brida al màstil i es gira sense tocar la DAB ni l\'FM.',
 confusion:'Al model, entre els elements de dues antenes consecutives hi ha almenys 1 m de separació vertical; és un criteri de disseny del simulador, no una cita normativa.',
 links:['torre','antena','antena_dab','antena_fm']});
def({id:'tirants', support:true, fam:'punt', layer:'equips', svc:'rtv', floor:5, zone:'comuna (coberta)',
 name:'Tirants de la torre (3 a 120°)', sigla:'',
 what:'Tres cables d\'acer galvanitzat que van des de les orelles de la part alta de la torre fins a tres ancoratges a la coberta, separats 120°. Cada tirant té guardacaps, grapes, un tensor i una funda groga de senyalització a la part baixa.',
 purpose:'Estabilitzen la torre davant del vent i en limiten les oscil·lacions.',
 where:'Coberta: tres plaques d\'ancoratge amb tacs i cargol d\'ull, lluny de la caseta, de l\'ascensor, del pati de llums i del RITS.',
 connects:'Orelles de la torre ↔ tensor ↔ ancoratge a la coberta.',
 example:'En el manteniment anual es revisa que els tensors no estiguin rovellats i que els tres tirants tinguin una tensió semblant.',
 confusion:'Els tirants són d\'acer i no porten senyal: no s\'han de confondre amb els cables coaxials, que són negres i baixen per la torre.',
 links:['torre']});
def({id:'antena', fam:'punt', layer:'equips', svc:'rtv', floor:5, zone:'comuna (coberta)', main:true,
 name:'Antena TDT (Yagi UHF amb reflector de panell)', sigla:'',
 what:'Antena directiva de televisió digital terrestre amb un reflector de panell de varetes, un dipol a la caixa de connexió taronja i files de directors sobre dos bums longitudinals. Inspirada en antenes comercials del tipus Televes, sense marques.',
 purpose:'Capta els canals de TDT de la banda UHF que arriben des del repetidor.',
 where:'Part superior del màstil, amb la seva brida pròpia.',
 connects:'Caixa del dipol → cable coaxial de l\'antena TDT → capçalera.',
 example:'L\'antena s\'orienta cap al repetidor que dona servei a la zona; una mala orientació afecta tots els habitatges.',
 confusion:'L\'antena no és la xarxa de distribució: és l\'origen del senyal de TDT. Els directors van davant del dipol i el reflector, darrere.',
 nets:['cab_capt'], canals:['canal_enllac_sup'], links:['mastil','capcalera']});
def({id:'antena_dab', fam:'punt', layer:'equips', svc:'rtv', floor:5, zone:'comuna (coberta)',
 name:'Antena DAB de 3 elements (polarització vertical)', sigla:'',
 what:'Antena de ràdio digital per a la banda III amb tres elements verticals sobre un bum horitzontal: reflector, dipol plegat central amb caixa taronja i director.',
 purpose:'Capta les emissores de ràdio digital DAB, que s\'emeten amb polarització vertical.',
 where:'Al mig del màstil, almenys 1 m per sota de l\'antena TDT i per sobre del dipol FM.',
 connects:'Caixa del dipol plegat → cable coaxial de l\'antena DAB → capçalera.',
 example:'Si els elements estiguessin horitzontals, l\'antena rebria molt menys senyal, perquè la DAB s\'emet en vertical.',
 confusion:'Els elements verticals no són un error de muntatge: indiquen polarització vertical.',
 nets:['cab_dab'], canals:['canal_enllac_sup'], links:['mastil','capcalera']});
def({id:'antena_fm', fam:'punt', layer:'equips', svc:'rtv', floor:5, zone:'comuna (coberta)',
 name:'Antena FM (dipol circular)', sigla:'',
 what:'Dipol d\'FM doblegat en forma d\'anella horitzontal, amb la caixa de connexió taronja a l\'obertura de l\'anella i un braç de subjecció al màstil.',
 purpose:'Capta la ràdio FM (87,5–108 MHz) de manera gairebé igual en totes les direccions.',
 where:'Part baixa del màstil, almenys 1 m per sota de l\'antena DAB i per sobre de la torre.',
 connects:'Caixa del dipol → cable coaxial de l\'antena FM → entrada d\'FM de la capçalera.',
 example:'Com que és gairebé omnidireccional, no cal orientar-la cap a un repetidor concret.',
 confusion:'És una antena diferent de la de TDT: l\'FM treballa en una banda molt més baixa i té cable i entrada propis.',
 nets:['cab_fm'], canals:['canal_enllac_sup'], links:['mastil','capcalera']});
def({id:'parabola', support:true, fam:'punt', layer:'equips', svc:'rtv', floor:5, zone:'comuna (coberta)', optional:true,
 name:'Antena parabòlica offset', sigla:'',
 what:'Reflector parabòlic offset (de focus desplaçat) de color clar, amb suport posterior, brides a la torre i un braç frontal que sosté l\'LNB. El centre del reflector és a 1 m sobre el paviment de la coberta.',
 purpose:'Concentra els senyals de satèl·lit en l\'LNB. En un reflector offset, el focus queda per sota del feix i el braç no fa ombra al senyal.',
 where:'Coberta, fixada en un lateral de la torre, orientada cap al satèl·lit amb el camí lliure d\'obstacles.',
 connects:'Reflector → LNB → cable coaxial de l\'LNB → RITS.',
 example:'El reflector sembla gairebé vertical, però apunta cap amunt: en una antena offset, el feix arriba amb un angle més alt que la inclinació del plat.',
 confusion:'La parabòlica no amplifica: només reflecteix i concentra. El component electrònic és l\'LNB.',
 nets:['cab_sat'], canals:['canal_enllac_sup'], links:['lnb','torre']});
def({id:'lnb', fam:'punt', layer:'equips', svc:'rtv', floor:5, zone:'comuna (coberta)', optional:true,
 name:'LNB (convertidor de baix soroll)', sigla:'LNB',
 what:'Capçal amb botzina i cos de plàstic situat al focus de la parabòlica, mirant cap al reflector, amb un connector F de sortida.',
 purpose:'Capta els senyals concentrats pel reflector, els amplifica amb poc soroll i els converteix a freqüència intermèdia (FI) perquè puguin anar per cable coaxial.',
 where:'A l\'extrem del braç de la parabòlica, davant i per sota del centre del reflector.',
 connects:'Reflector → LNB → cable coaxial de l\'LNB.',
 example:'Si un ocell fa niu davant de l\'LNB, els canals de satèl·lit es perden encara que el plat estigui ben orientat.',
 confusion:'L\'LNB rep alimentació pel mateix cable coaxial des de l\'equip receptor o la capçalera de FI.',
 nets:['cab_sat'], links:['parabola','cab_sat']});

/* ---------------- Elements per planta ---------------- */
if (MODEL==='edifici') for (const f of [1,2,3,4]) {
  const P = FLOORNAME(f), A = `${ORD[f]} A`, B = `${ORD[f]} B`, ALL = floorUnitsTxt(f);
  def({id:`rs_${f}`, fam:'recinte', layer:'registres', svc:'all', floor:f, zone:'comuna', rs:true, container:true, lid:true, main: f===2,
   name:`Registre secundari — ${P}`, sigla:'',
   what:'És una caixa de la zona comuna de la planta, intercalada en la canalització principal.',
   purpose:'Hi ha els punts de distribució de la planta i en surten les canalitzacions secundàries cap als habitatges.',
   where:`${P}, distribuïdor comú, a la cara del patinet d\'instal·lacions per on passa la canalització principal.`,
   connects:'Allotja els derivadors de RTV, la caixa de segregació de fibra i la regleta de 10 parells del punt de distribució de parells.',
   example:`A la ${P.toLowerCase()}, si obres la tapa veus els dos derivadors, la caixa de segregació, la mànega de parells amb el sangrat i la regleta d\'on surten les escomeses dels quatre habitatges (${ALL}).`,
   confusion:'El registre secundari és la caixa; el punt de distribució és l\'element de connexió que hi ha a dins. Al model, cada registre secundari té tres punts de distribució: derivadors (RTV), caixa de segregació (fibra) i regleta (parells).',
   nets:['xd_rtv','xd_fo','xd_pt'], canals:['canal_principal',`csc_${f}e`,`csc_${f}d`], links:[`rps_${f}e`,`rps_${f}d`]});
  for(const [k,cs,us] of [['e','esquerra','AD'],['d','dreta','BC']]){
    const UU=[...us].map(s=>`${ORD[f]} ${s}`).join(' i ');
    def({id:`csc_${f}${k}`, fam:'canal', layer:'canalitzacions', svc:'all', floor:f, zone:'comuna',
     name:`Canalització secundària, tram comunitari (${cs}) — ${P}`, sigla:'',
     what:`Són quatre tubs de Ø25 mm, un per a cada servei (RTV, fibra òptica, parells o parells trenats i coaxial de TBA), que van pel sostre del distribuïdor des del registre secundari fins al registre de pas del costat ${cs}.`,
     purpose:`Porten junts els cables de dispersió dels dos habitatges d'aquest costat (${UU}) fins al punt on es reparteixen.`,
     where:`${P}, sostre del distribuïdor comú, entre el registre secundari i el registre de pas.`,
     connects:`Registre secundari → registre de pas. Pel tub de RTV hi passen quatre coaxials (dos per habitatge); pel de fibra i pel de parells, una escomesa per habitatge; el de TBA queda de reserva.`,
     example:`Si cal canviar l'escomesa de fibra del ${[...us].map(s=>`${ORD[f]} ${s}`)[0]}, s'estira des del registre de pas sense tocar els cables de l'altre habitatge.`,
     confusion:'El diàmetre del tram comunitari depèn del nombre de PAU que atén (Ø25, Ø32 o Ø40 mm): aquí n\'atén dos, per això Ø25 mm. Els tubs d\'accés a cada habitatge són una altra part de la canalització secundària.',
     nets:[...[...us].flatMap(s=>[`xs_rtv_${f}${s}`,`xs_fo_${f}${s}`,`xs_pt_${f}${s}`])], links:[`rs_${f}`,`rps_${f}${k}`]});
    def({id:`rps_${f}${k}`, fam:'recinte', layer:'registres', svc:'all', floor:f, zone:'comuna', container:true, lid:true,
     name:`Registre de pas de la canalització secundària (${cs}) — ${P}`, sigla:'',
     what:'És una caixa de registre de pas tipus A (360 × 360 × 120 mm) encastada a la paret del distribuïdor, prop del sostre.',
     purpose:'Separa el tram comunitari de la canalització secundària dels tubs d\'accés a cada habitatge i permet estirar els cables per trams curts.',
     where:`${P}, paret del distribuïdor, sobre la mitgera entre el ${UU.replace(' i ',' i el ')}.`,
     connects:`Hi arriben per un lateral els quatre tubs del tram comunitari i en surten pel fons, per dins de la paret, els tres tubs d'accés de cada habitatge (${UU}). Els cables hi passen sense connexions.`,
     example:'Per passar un cable nou fins a un habitatge, l\'instal·lador obre aquest registre i el registre de terminació de xarxa, i estira el cable només pel tub d\'accés.',
     confusion:'No és un registre secundari: no hi ha cap punt de distribució ni cap connexió, només hi passen cables.',
     nets:[...[...us].flatMap(s=>[`xs_rtv_${f}${s}`,`xs_fo_${f}${s}`,`xs_pt_${f}${s}`])], canals:[`csc_${f}${k}`,...[...us].map(s=>`cs_${f}${s}`)], links:[`rs_${f}`]});
  }
  def({id:`deriv_${f}`, fam:'punt', layer:'punts', svc:'rtv', floor:f, zone:'comuna', rs:true, parent:`rs_${f}`,
   name:`Derivadors de RTV de ${TAPF[f].db} dB (punt de distribució) — ${P}`, sigla:'',
   what:`Són dispositius passius, un per cada cable de distribució, que treuen una part del senyal cap als habitatges de la planta i deixen passar la resta cap avall. Al model: derivadors de 4 sortides de la sèrie F (exemple: Televes ref. ${TAPF[f].ref}, ${TAPF[f].db} dB, 109 × 54 × 18 mm).`,
   purpose:'Fan la realització física del punt de distribució de RTV: uneixen la xarxa de distribució amb la de dispersió.',
   where:`Dins del registre secundari de la ${P.toLowerCase()}.`,
   connects:`Entrada i sortida de pas: cable de distribució. Sortides de derivació (quatre): un cable cap a cada habitatge de la planta (${ALL}) per cada derivador.${f===1?' Com que és la darrera planta del recorregut, la sortida de pas s\'acaba amb una càrrega.':''}`,
   example:`Els dos cables que arriben al PAU del ${A} surten de dos derivadors diferents, un per cada cable de distribució.`,
   confusion:'El derivador no és el registre secundari (és dins seu) i no és un amplificador: no afegeix senyal, la reparteix.',
   more:['Per què cada planta porta un derivador diferent',
     `El senyal baixa des de la capçalera del RITS, a la coberta, pels cables de distribució. A cada planta, el derivador en treu una part cap als habitatges (pèrdua de derivació) i deixa passar la resta cap avall amb una petita pèrdua de pas (uns 2-3 dB). Com més avall és la planta, més metres de cable i més derivadors ha travessat el senyal, i hi arriba amb menys nivell. Per igualar el nivell a les preses de tots els habitatges, les plantes altes, més a prop de la capçalera, porten derivadors amb més pèrdua de derivació, i a mesura que es baixa se'n posen de menys pèrdua: 4a planta 24 dB (ref. 519345), 3a 20 dB (519344), 2a 16 dB (519343) i 1a 12 dB (519342). Dit a l'inrevés: des de la planta baixa, cada planta que es puja porta més pèrdua. La 1a planta és la darrera del recorregut i la sortida de pas es tanca amb una càrrega de 75 Ω (ref. 4061). Aquesta planta: ${TAPF[f].db} dB nominals; derivació mesurada ${TAPF[f].der} dB i pas ${TAPF[f].pas} dB (terrestre / satèl·lit). Els valors exactes s'han de calcular al projecte amb els nivells de la capçalera i les longituds reals de cable.`],
   nets:['xd_rtv',...SIDES.map(s=>`xs_rtv_${f}${s}`)], canals:['canal_principal',`csc_${f}e`,`csc_${f}d`], links:[`rs_${f}`]});
  def({id:`cseg_${f}`, fam:'punt', layer:'punts', svc:'fo', floor:f, zone:'comuna', rs:true, parent:`rs_${f}`,
   name:`Caixa de segregació de fibra òptica — ${P}`, sigla:'',
   what:'És la realització física del punt de distribució òptic: una caixa on es fan els empalmaments entre les fibres de distribució de la planta i els cables d\'escomesa dels habitatges.',
   purpose:'Separa les fibres que es queden a la planta. Les fibres de les plantes superiors hi passen sense tallar (fibres en pas). Guarda bucles de reserva.',
   where:`Dins del registre secundari de la ${P.toLowerCase()}.`,
   connects:`Xarxa de distribució de fibra ↔ cables d\'escomesa de dispersió cap als quatre habitatges (${ALL}).`,
   example:`L\'instal·lador troba a la caixa l\'empalmament etiquetat «${A}»; si cal, el pot refer sense tocar les fibres de les altres plantes.`,
   confusion:'No és una ONT ni un equip actiu: no transforma el senyal, només uneix i ordena fibres.',
   nets:['xd_fo'], canals:['canal_principal'], links:[`rs_${f}`]});
  def({id:`bucle_${f}`, fam:'punt', layer:'punts', svc:'pt', floor:f, zone:'comuna', rs:true, parent:`rs_${f}`,
   name:`Punt de distribució de parells (regleta de 10 parells) — ${P}`, sigla:'',
   what:`És una regleta Krone de 10 parells on acaben els 10 parells extrets de la mànega de distribució (sangrat), que hi entren per sota. Per dalt en surten les escomeses de 2 parells dels quatre habitatges (${ALL}); els parells 9 i 10 queden lliures.`,
   purpose:'Separa la xarxa de distribució (mànega comuna) de la de dispersió (un cable per habitatge) i deixa parells de reserva a la planta.',
   where:`Dins del registre secundari de la ${P.toLowerCase()}, a la dreta de la canalització principal.`,
   connects:'Parells del sangrat de la mànega de 50 parells → regleta → cables d\'escomesa de 2 parells cap al PAU de cada habitatge (parells 1-2: A; 3-4: B; 5-6: C; 7-8: D).',
   example:'Si un veí demana una tercera línia, s\'aprofita un parell lliure de la regleta i un fil nou fins al seu PAU.',
   confusion:'Nombre de regletes de planta segons el RD 346/2011: total de parells ÷ plantes ÷ 10, arrodonit per excés. El model en mostra una per planta per simplificar.',
   nets:['xd_pt'], canals:['canal_principal'], links:[`rs_${f}`,'pi_pt']});
}

/* ---------------- Elements per habitatge (tots complets) ----------------
   Dotació de preses segons el RD 346/2011 (annex I 3.5.1; annex II 3.5.1-3.5.3)
   i l'annex III 5.13 (redacció de l'Ordre ECE/983/2019) per a un habitatge amb
   sala d'estar, cuina i dos dormitoris (el bany no porta preses). */
const ROOMS = [
  {k:'sala',  name:'sala d\'estar', de:'de la sala d\'estar', a:'a la sala d\'estar', la:'la sala d\'estar', principal:true},
  {k:'cuina', name:'cuina',        de:'de la cuina',        a:'a la cuina',        la:'la cuina'},
  {k:'d1',    name:'dormitori 1',  de:'del dormitori 1',    a:'al dormitori 1',    la:'el dormitori 1', principal:true},
  {k:'d2',    name:'dormitori 2',  de:'del dormitori 2',    a:'al dormitori 2',    la:'el dormitori 2'}
];
const ROOM = k => ROOMS.find(r=>r.k===k);
/* preses de cada habitatge: k = part de l'id, t = tipus, room, dbl = BAT doble */
const PRESES = [
  {k:'rtv_sala', t:'rtv', room:'sala'}, {k:'rtv_cuina', t:'rtv', room:'cuina'}, {k:'rtv_d1', t:'rtv', room:'d1'}, {k:'rtv_d2', t:'rtv', room:'d2'},
  {k:'dat_sala', t:'dat', room:'sala', dbl:true, nearFO:true}, {k:'dat2_sala', t:'dat', room:'sala'},
  {k:'dat_d1', t:'dat', room:'d1', dbl:true}, {k:'dat2_d1', t:'dat', room:'d1'},
  {k:'dat_cuina', t:'dat', room:'cuina'}, {k:'dat_d2', t:'dat', room:'d2'},
  {k:'tba_sala', t:'tba', room:'sala'}, {k:'tba_d1', t:'tba', room:'d1'},
  {k:'fo_sala', t:'fo', room:'sala'}
];
const PTYPE = {
  rtv:{svc:'rtv', tech:'coax', reg:'Registre de presa de RTV', bat:'Base d\'accés de terminal de RTV', net:'xi_rtv'},
  dat:{svc:'pt',  tech:'pt',   reg:'Registre de presa de parells trenats', bat:'Base d\'accés de terminal RJ45', net:'xi_dat'},
  tba:{svc:'tba', tech:'coax', reg:'Registre de presa coaxial de TBA', bat:'Base d\'accés de terminal coaxial de TBA', net:'xi_tba'},
  fo: {svc:'fo',  tech:'fo',   reg:'Registre de presa de fibra òptica', bat:'Base d\'accés de terminal òptica (roseta SC/APC)', net:'xi_fo'}
};
const cap = s => s[0].toUpperCase()+s.slice(1);

/* defineix tots els elements d'un habitatge u. u.del, u.al, u.el: com es diu «del 2n A», «al 2n A» i «el 2n A» (per defecte,
   amb el nom de l'habitatge); el model de cases hi posa «de la casa 1», etc. */
function defUnit(u) {
  const f=u.f, P=FLOORNAME(f).toLowerCase(), N=u.name, DEL=u.del||`del ${N}`, AL=u.al||`al ${N}`, ELN=u.el||`el ${N}`, U=u.id, ex = U==='2A', K=(u.s==='A'||u.s==='D')?'e':'d';
  def({id:`cs_${U}`, fam:'canal', layer:'canalitzacions', svc:'all', floor:f, unit:U, zone:'comuna', main: ex,
   name:`Canalització secundària, accés ${AL}`, sigla:'',
   what:'Són els tres tubs de Ø25 mm que porten els cables des del registre de pas del distribuïdor fins al registre de terminació de xarxa de l\'habitatge. Formen l\'últim tram de la canalització secundària, que dona suport a la xarxa de dispersió.',
   purpose:'Fa que els cables surtin de la zona comuna i entrin a l\'habitatge protegits.',
   where:`${FLOORNAME(f)}: des del registre de pas del distribuïdor, per dins de la paret, fins al rebedor ${DEL}.`,
   connects:'Tres tubs de Ø25 mm (RD 346/2011): un per als dos coaxials de RTV, un per a parells o parells trenats i fibra òptica, i un per a coaxial de TBA (telecomunicacions de banda ampla; aquí de reserva, amb fil guia).',
   example:`A la ${P}, permet que els cables passin del registre de pas al registre ${DEL} sense tocar els dels altres habitatges.`,
   confusion:'La canalització és el conducte que protegeix i allotja els cables. La xarxa està formada pels cables i els seus elements de connexió. El tram comunitari (quatre tubs, un per servei) arriba fins al registre de pas; des d\'allà, cada habitatge té els seus tres tubs d\'accés.',
   nets:[`xs_rtv_${U}`,`xs_fo_${U}`,`xs_pt_${U}`], links:[`rps_${f}${K}`,`rtr_${U}`]});
  def({id:`rtr_${U}`, fam:'recinte', layer:'registres', svc:'all', floor:f, unit:U, zone:'privada (frontera)', container:true, lid:true, main: ex,
   name:`Registre de terminació de xarxa — ${N}`, sigla:'RTR',
   what:'És la caixa encastada dins de l\'habitatge, a prop de l\'entrada, on acaben les xarxes de dispersió i comença la xarxa interior.',
   purpose:'Allotja els PAU de cada servei (el de RTV i el de TBA coaxial amb el repartidor integrat) i els extrems RJ45 de la xarxa interior. Té a prop una presa de corrent i el registre de presa configurable.',
   where:`Rebedor ${DEL}, paret del fons.`,
   connects:'Allotja el PAU + repartidor de RTV, la caixa de terminació òptica (PAU de fibra), les dues rosetes RJ45 amb el multiplexor passiu (PAU de parells) i el PAU + repartidor 2D de TBA coaxial. D\'aquí surten en estrella tots els tubs interiors.',
   example:`Si obres la tapa del registre ${DEL} veus un punt d\'accés diferent per a cada tecnologia.`,
   confusion:'El registre és la caixa; el PAU és el punt de connexió que hi ha a dins. Es pot canviar la tapa del registre sense tocar el PAU.',
   nets:[`xs_rtv_${U}`,`xs_fo_${U}`,`xs_pt_${U}`,`xi_rtv_${U}`,`xi_dat_${U}`,`xi_tba_${U}`,`xi_fo_${U}`], canals:[`cs_${U}`,`ci_${U}`], links:[`rconf_${U}`]});
  def({id:`ci_${U}`, fam:'canal', layer:'canalitzacions', svc:'all', floor:f, unit:U, zone:'privada',
   name:`Canalització interior d\'usuari — ${N}`, sigla:'',
   what:'Són els tubs encastats, independents i de Ø20 mm com a mínim, que van en estrella des del registre de terminació de xarxa fins a cada registre de presa.',
   purpose:'Allotgen la xarxa interior. Cada registre de presa té el seu propi tub independent.',
   where:`Dins ${DEL}: terra i parets, des del rebedor fins a les estàncies.`,
   connects:'Catorze tubs: quatre de RTV, sis de parells trenats, dos de coaxial de TBA, un de fibra òptica i un cap al registre de presa configurable. Els tubs cap a la paret del televisor de la sala passen per un registre de pas.',
   example:'Per arribar a la sala, alguns tubs fan diversos canvis de direcció; el registre de pas permet estirar el cable sense forçar-lo.',
   confusion:'Si es trenca un tub, el cable pot continuar intacte, i a l\'inrevés: tub (canalització) i cable (xarxa) són coses diferents.',
   nets:[`xi_rtv_${U}`,`xi_dat_${U}`,`xi_tba_${U}`,`xi_fo_${U}`], links:[`rtr_${U}`,`rpas_${U}`]});

  /* dispersió */
  def({id:`xs_rtv_${U}`, fam:'xarxa', layer:'xarxes', svc:'rtv', tram:'disp', tech:'coax', floor:f, unit:U, zone:'comuna',
   name:`Xarxa de dispersió de RTV — ${N}`, sigla:'',
   what:`Són els dos cables coaxials que surten dels derivadors del registre secundari de la ${P} i arriben al PAU de RTV ${DEL}.`,
   purpose:'Fan arribar a l\'habitatge els dos cables previstos: el cable 1 (blanc) es connecta a l\'entrada del PAU + repartidor i el cable 2 (negre), en reserva, a l\'entrada carregada.',
   where:`Registre secundari de la ${P} → tub de RTV de la canalització secundària → registre de terminació de xarxa ${DEL}.`,
   connects:`Derivadors de la ${P} → PAU de RTV.`,
   example:`Si la comunitat posa canals de satèl·lit al segon cable, ${ELN} els pot rebre canviant el cable al PAU, sense obres a la zona comuna.`,
   confusion:'La dispersió encara és instal·lació comuna: arriba fins al PAU. Després del PAU comença la xarxa interior.',
   canals:[`csc_${f}${K}`,`cs_${U}`], links:[`deriv_${f}`,`pau_rtv_${U}`]});
  def({id:`xs_fo_${U}`, fam:'xarxa', layer:'xarxes', svc:'fo', tram:'disp', tech:'fo', floor:f, unit:U, zone:'comuna',
   name:`Xarxa de dispersió de fibra òptica — ${N}`, sigla:'',
   what:`És el cable d\'escomesa òptica (dues fibres, Ø3,8 mm) que surt per dalt de la caixa de segregació de la ${P} i acaba a la roseta òptica ${DEL}.`,
   purpose:`Porta les fibres assignades ${AL} des de la zona comuna fins al seu PAU.`,
   where:`Caixa de segregació (registre secundari, ${P}) → tub de parells i fibra de la canalització secundària → registre de terminació de xarxa.`,
   connects:'Empalmament a la caixa de segregació → roseta òptica (PAU).',
   example:`A la caixa de segregació, l\'escomesa ${DEL} està empalmada a fibres del cable de distribució etiquetades amb el seu nom.`,
   confusion:'La fibra de dispersió acaba a la roseta del PAU. Des d\'allà, una fibra interior la porta fins a la presa òptica de la sala, on es connecta l\'ONT.',
   canals:[`csc_${f}${K}`,`cs_${U}`], links:[`cseg_${f}`,`pau_fo_${U}`]});
  def({id:`xs_pt_${U}`, fam:'xarxa', layer:'xarxes', svc:'pt', tram:'disp', tech:'pt', floor:f, unit:U, zone:'comuna',
   name:`Xarxa de dispersió de parells — ${N}`, sigla:'',
   what:`És el cable d\'escomesa de 2 parells (Ø4 mm) ${DEL}: surt per dalt de la regleta del registre secundari i arriba al PAU de parells.`,
   purpose:'Porta les dues línies previstes per a l\'habitatge (RD 346/2011: 2 línies per habitatge).',
   where:'Regleta del registre secundari → tub de parells i fibra de la canalització secundària → registre de terminació de xarxa.',
   connects:'Regleta del punt de distribució de la planta → rosetes RJ45 del PAU (una per línia).',
   example:`Per comprovar la línia ${DEL}, el tècnic mesura des de la regleta de la planta (sense aixecar connexions) fins a la roseta del PAU.`,
   confusion:'Comparteix tub amb la fibra, però són cables i serveis diferents.',
   canals:[`csc_${f}${K}`,`cs_${U}`], links:[`bucle_${f}`,`pau_pt_${U}`,'pi_pt']});

  /* PAU i elements del registre de terminació de xarxa */
  def({id:`pau_rtv_${U}`, fam:'punt', layer:'punts', svc:'rtv', floor:f, unit:U, zone:'frontera comuna/privada', parent:`rtr_${U}`,
   name:`PAU + repartidor de RTV (2 entrades, una carregada, 4 sortides F; exemple: Televes ref. 519534) — ${N}`, sigla:'PAU',
   what:"És un únic element passiu de zamac (109 × 54 × 18 mm) amb sis connectors F roscats cap avall: l'entrada (fletxa amunt), l'entrada carregada (símbol de la resistència) i quatre sortides (fletxa avall), una per cada presa de RTV de l'habitatge. Banda de 5 a 2.400 MHz, amb 8–9 dB de pèrdua de distribució.",
   purpose:"Separa la instal·lació comuna de la privada (frontera de responsabilitats) i, alhora, reparteix el senyal en estrella cap a les preses.",
   where:`Dins del registre de terminació de xarxa ${DEL} (rebedor).`,
   connects:"Entrada ← cable de dispersió 1 (blanc), que és el que arriba a les preses. Entrada carregada ← cable de dispersió 2 (negre): queda en reserva, tancat a dins amb una càrrega de 75 Ω. Els dos cables baixen per davant del PAU i fan una U per entrar als connectors per sota. Sortides → quatre cables coaxials interiors: cuina, sala d'estar, dormitori 2 i dormitori 1 (una presa per estància, sense comptar el bany).",
   example:"Si la comunitat posa un servei diferent al cable 2, n'hi ha prou d'intercanviar els connectors del cable blanc i del negre entre les dues entrades: no cal cap obra ni cap càrrega externa.",
   confusion:"No és un derivador de planta: el derivador és a la zona comuna i alimenta habitatges; el PAU + repartidor és dins de l'habitatge i alimenta preses. L'entrada carregada ja porta la càrrega de 75 Ω a dins: el cable que no es fa servir hi queda connectat i ben terminat.",
   nets:[`xs_rtv_${U}`,`xi_rtv_${U}`], links:[`rtr_${U}`]});
  def({id:`pau_fo_${U}`, fam:'punt', layer:'punts', svc:'fo', floor:f, unit:U, zone:'frontera comuna/privada', parent:`rtr_${U}`,
   name:`PAU de fibra òptica (roseta de terminació òptica, 2 × SC/APC; exemple: Televes ref. 231502) — ${N}`, sigla:'PAU',
   what:"És una caixa petita de plàstic blanc (119 × 94 × 33 mm) on s'empalma la fibra d'escomesa. Té lloc per a quatre sortides per la base i porta dos adaptadors SC/APC (verds, polit en angle) amb tapa autoblocant.",
   purpose:"Fa de frontera entre la fibra comuna de l'edifici i la xarxa interior de l'habitatge.",
   where:`Dins del registre de terminació de xarxa ${DEL}.`,
   connects:"Escomesa de fibra (entra per un pretallat lateral amb passacables i s'empalma a dins) → adaptador SC/APC de la sortida 1 → fibra interior (groga) fins a la roseta òptica de la sala d'estar. La sortida 2 queda en reserva, amb la tapa de l'adaptador tancada; les sortides 3 i 4 no porten adaptador.",
   example:"Quan l'operador activa el servei, comprova que la llum arriba bé a la sortida 1 del PAU i a la roseta de la sala.",
   confusion:"La caixa de terminació no és l'ONT: és passiva. Els connectors SC/APC són verds; els SC/UPC (blaus) no s'hi poden barrejar perquè el polit és diferent.",
   nets:[`xs_fo_${U}`,`xi_fo_${U}`], links:[`bat_fo_sala_${U}`,`rtr_${U}`]});
  def({id:`pau_pt_${U}`, fam:'punt', layer:'punts', svc:'pt', floor:f, unit:U, zone:'frontera comuna/privada', parent:`rtr_${U}`,
   name:`PAU de parells (rosetes RJ45 i multiplexor passiu) — ${N}`, sigla:'PAU',
   what:'És una roseta doble RJ45 de superfície, una boca per línia: cada parell de l\'escomesa acaba als contactes 4 i 5 d\'una boca. A sota hi ha el multiplexor passiu (142 × 60 × 24 mm), on s\'endollen els cables interiors.',
   purpose:'Fa de punt de tall i de prova entre la xarxa comuna (propietat) i la interior (usuari), i permet portar cada línia a qualsevol presa de l\'habitatge.',
   where:`Dins del registre de terminació de xarxa ${DEL}.`,
   connects:'Escomesa de 2 parells → roseta doble RJ45 (línia 1 i línia 2) → latiguillo a l\'entrada (Line In) del multiplexor passiu, que té 8 sortides telefòniques i 1 d\'ADSL. Només hi van endollats els cables d\'una boca de la BAT doble de la sala i d\'una del dormitori 1 (telèfon); l\'altra boca de cada BAT és de dades i s\'uneix amb el latiguillo de l\'encaminador. Els altres cables queden lliures, amb el connector RJ45, per si cal.',
   example:'Si es vol telèfon a la cuina, n\'hi ha prou d\'endollar el connector RJ45 lliure del cable de la cuina a una sortida lliure del multiplexor.',
   confusion:'La xarxa comuna és de cables de parells (telefonia), però la xarxa interior és sempre de parells trenats: el PAU fa la transició.',
   nets:[`xs_pt_${U}`,`xi_dat_${U}`], links:[`rtr_${U}`]});
  def({id:`div_tba_${U}`, fam:'punt', layer:'punts', svc:'tba', floor:f, unit:U, zone:'privada', parent:`rtr_${U}`,
   name:`PAU + repartidor de TBA coaxial (1 entrada, 2 sortides F; exemple: Televes ref. 519602) — ${N}`, sigla:'PAU',
   what:"És un repartidor passiu de 2 sortides de zamac (74 × 54 × 18 mm), per a la banda de 5 a 1.220 MHz (també el canal de retorn de l'operador), amb tres connectors F roscats cap avall: l'entrada (fletxa amunt) i dues sortides (fletxa avall). Cada sortida rep el senyal amb una pèrdua de 4 dB.",
   purpose:"És el punt d'accés a l'usuari de la xarxa coaxial de TBA (telecomunicacions de banda ampla): separa la xarxa de l'operador de cable de la xarxa interior de l'habitatge i en reparteix el senyal a les dues preses.",
   where:`Dins del registre de terminació de xarxa ${DEL}, cargolat a la paret del fons, sota el PAU de RTV.`,
   connects:"Entrada: lliure, tancada amb una càrrega de 75 Ω (no hi ha operador de cable; hi arribaria la seva escomesa coaxial pel tub de TBA de la canalització secundària). Sortides → cables interiors cap a la BAT de TBA de la sala d'estar i del dormitori 1.",
   example:"Si es contracta un operador de cable, l'instal·lador treu la càrrega i hi enrosca el connector F de l'escomesa: totes dues preses queden en servei sense tocar la xarxa interior.",
   confusion:"No és el PAU de RTV: aquest coaxial és de TBA (operadors de cable) i té tubs, cables, PAU i preses propis. Tampoc no és un derivador: reparteix el senyal a parts iguals entre les dues sortides.",
   nets:[`xi_tba_${U}`], links:[`rtr_${U}`]});
  def({id:`rconf_${U}`, fam:'recinte', layer:'registres', svc:'all', floor:f, unit:U, zone:'privada', container:true,
   name:`Registre de presa configurable — ${N}`, sigla:'',
   what:'És un registre de presa encastat a prop del registre de terminació de xarxa, amb el seu tub, sense una tecnologia assignada.',
   purpose:'Reserva un punt per a qualsevol servei futur (per exemple, un equip que l\'operador vulgui instal·lar a prop del PAU).',
   where:`Rebedor ${DEL}, al costat del registre de terminació de xarxa.`,
   connects:'Tub independent des del registre de terminació de xarxa. No té cable ni BAT instal·lats.',
   example:'Si cal posar-hi una presa de dades o un petit equip, s\'hi estén el cable pel tub que ja existeix.',
   confusion:'És un registre (caixa) buit, no una presa equipada: la normativa en demana un a prop del PAU.',
   canals:[`ci_${U}`], links:[`rtr_${U}`]});
  def({id:`rpas_${U}`, fam:'recinte', layer:'registres', svc:'all', floor:f, unit:U, zone:'privada', container:true,
   name:`Registre de pas — canalització interior ${DEL}`, sigla:'',
   what:'És una caixa petita intercalada en els tubs, sense connexions, que facilita estirar els cables en un canvi de direcció o un tram llarg.',
   purpose:'Evita forçar els cables quan el recorregut té corbes. Justificació al model: els tubs cap a la paret del televisor fan diversos canvis de direcció.',
   where:'Paret entre el dormitori 2 i la sala d\'estar, a prop del terra.',
   connects:'Hi passen, sense tallar-se, els cables de RTV, TBA, dades i fibra que van cap a la paret del televisor de la sala.',
   example:'L\'instal·lador estira el cable fins al registre de pas, el recull i després continua cap a la sala.',
   confusion:'No és un registre de presa: no té cap base de connexió per a l\'usuari.',
   nets:[`xi_rtv_${U}`,`xi_dat_${U}`,`xi_tba_${U}`,`xi_fo_${U}`], canals:[`ci_${U}`], links:[`rtr_${U}`]});

  /* xarxes interiors */
  def({id:`xi_rtv_${U}`, fam:'xarxa', layer:'xarxes', svc:'rtv', tram:'int', tech:'coax', floor:f, unit:U, zone:'privada',
   name:`Xarxa interior de RTV — ${N}`, sigla:'',
   what:'Són els cables coaxials que surten de les sortides del PAU + repartidor i van en estrella fins a cada registre de presa de RTV.',
   purpose:'Porten la ràdio i la televisió a cada estància.',
   where:`Canalització interior ${DEL} (un tub per presa).`,
   connects:'PAU + repartidor → quatre BAT de RTV: sala d\'estar, cuina, dormitori 1 i dormitori 2. Normativa: una presa per estància, excepte banys i trasters, amb un mínim de dues.',
   example:'El cable de la sala és independent del de la cuina: si un es fa malbé, els altres continuen funcionant.',
   confusion:'La xarxa interior és zona privada: la comunitat és responsable fins al PAU.',
   canals:[`ci_${U}`], links:[`pau_rtv_${U}`]});
  def({id:`xi_dat_${U}`, fam:'xarxa', layer:'xarxes', svc:'pt', tram:'int', tech:'pt', floor:f, unit:U, zone:'privada',
   name:`Xarxa interior de parells trenats — ${N}`, sigla:'',
   what:'Són cables de parells trenats que surten del registre de terminació de xarxa, acabats en connectors RJ45 etiquetats, i van en estrella fins a les BAT RJ45.',
   purpose:'Permeten connectar ordinadors, televisors intel·ligents o telèfons a l\'encaminador o al PAU de parells.',
   where:`Canalització interior ${DEL} (un tub per registre de presa).`,
   connects:'Vuit cables: dos a la BAT doble de la sala, un a l\'altra BAT de la sala, dos a la BAT doble del dormitori 1, un a l\'altra BAT del dormitori 1, un a la cuina i un al dormitori 2.',
   example:'L\'encaminador de la sala envia dades pel segon connector de la BAT doble fins al registre de terminació de xarxa; allà un latiguillo les passa al cable del dormitori 1.',
   confusion:'Aquest cable no és fibra: la fibra acaba a la presa òptica i a l\'ONT. Després de l\'encaminador, les dades van per parells trenats.',
   canals:[`ci_${U}`], links:[`pau_pt_${U}`,`router_${U}`]});
  def({id:`xi_tba_${U}`, fam:'xarxa', layer:'xarxes', svc:'tba', tram:'int', tech:'coax', floor:f, unit:U, zone:'privada',
   name:`Xarxa interior coaxial de TBA — ${N}`, sigla:'',
   what:'Són dos cables coaxials que van del PAU + repartidor de TBA del registre de terminació de xarxa fins a dues preses coaxials de TBA.',
   purpose:'Permeten rebre serveis d\'un operador de cable (TBA: telecomunicacions de banda ampla).',
   where:`Canalització interior ${DEL}: un tub cap a la sala d\'estar i un cap al dormitori 1.`,
   connects:'Sortides del PAU + repartidor de TBA → BAT coaxial de TBA de la sala d\'estar i del dormitori 1 (les dues estàncies principals).',
   example:'Un descodificador d\'un operador de cable es connectaria a la presa de TBA de la sala.',
   confusion:'No es barreja amb la RTV: són cables, tubs i preses diferents encara que tots dos siguin coaxials.',
   canals:[`ci_${U}`], links:[`div_tba_${U}`]});
  def({id:`xi_fo_${U}`, fam:'xarxa', layer:'xarxes', svc:'fo', tram:'int', tech:'fo', floor:f, unit:U, zone:'privada',
   name:`Xarxa interior de fibra òptica — ${N}`, sigla:'',
   what:'És un cable de fibra òptica (groc) amb connectors SC/APC verds que va de la sortida 1 del PAU de fibra fins a la roseta òptica de la sala d\'estar.',
   purpose:'Porta la fibra fins a l\'estància principal, perquè l\'ONT i l\'encaminador puguin estar a la sala i no al rebedor.',
   where:`Canalització interior ${DEL}: tub independent des del registre de terminació de xarxa fins a la sala d\'estar.`,
   connects:'Adaptador SC/APC de la roseta del PAU → BAT òptica (roseta SC/APC) de la sala d\'estar.',
   example:'L\'operador connecta l\'ONT directament a la presa òptica de la sala, al costat del televisor, sense passar cables pel passadís.',
   confusion:'Aquesta fibra és interior (privada): comença després del PAU. La fibra de dispersió, comuna, acaba al PAU.',
   canals:[`ci_${U}`], links:[`pau_fo_${U}`,`bat_fo_sala_${U}`]});

  /* registres de presa i BAT */
  for (const p of PRESES) {
    const T=PTYPE[p.t], R=ROOM(p.room), pid=`${p.k}_${U}`;
    const dblTxt = p.dbl ? ' doble (dos connectors RJ45 alimentats per cables independents)' : '';
    const why = {
      rtv:'Normativa: una presa de RTV per estància, excepte banys i trasters (mínim dues).',
      dat: p.room==='sala' ? (p.dbl ? 'Normativa: a la sala, almenys dos registres amb BAT; un amb BAT doble a menys de 50 cm de la presa de fibra.' : 'Normativa: la sala (estància principal) ha de tenir almenys dos registres de presa de parells trenats.')
          : p.room==='d1' ? (p.dbl ? 'Normativa: com a mínim una altra estància ha de tenir una BAT doble; aquí és el dormitori 1.' : 'Normativa: les dues estàncies principals tenen dos registres de presa de parells trenats.')
          : 'Normativa: a la resta d\'estàncies (excepte banys i trasters), un registre de presa de parells trenats amb BAT.',
      tba:'Normativa: dues preses coaxials de TBA, en dues estàncies diferents (aquí, les dues estàncies principals).',
      fo:'Normativa (última redacció): una presa de fibra òptica en una estància principal, preferiblement la sala d\'estar, a prop de la BAT RJ45 doble.'
    }[p.t];
    def({id:`rp_${pid}`, fam:'recinte', layer:'registres', svc:T.svc, floor:f, unit:U, zone:'privada', room:p.room, container:true, ptype:p.t,
     name:`${T.reg}${p.k.startsWith('dat2')?' (2a)':''} — ${R.name}, ${N}`, sigla:'',
     what:`És la caixa encastada a la paret que allotja la ${T.bat[0].toLowerCase()+T.bat.slice(1)}${dblTxt}.`,
     purpose:`Protegeix l\'extrem del cable interior i fixa la BAT a la paret. ${why}`,
     where:`${cap(R.name)} ${DEL}, a prop del terra.`,
     connects:`${p.dbl?'Hi arriben dos cables':'Hi arriba un cable'} ${p.t==='rtv'?'coaxial des d\'una sortida del PAU + repartidor':p.t==='tba'?'coaxial des d\'una sortida del PAU + repartidor de TBA':p.t==='fo'?'de fibra des de la roseta òptica del PAU':'de parells trenats des del registre de terminació de xarxa'}. Allotja la BAT.`,
     example: p.t==='fo' ? 'Darrere de l\'ONT de la sala hi ha aquest registre amb la roseta òptica.' : p.k==='rtv_sala' ? 'Darrere del televisor de la sala hi ha aquest registre.' : `${cap(R.a)}, la caixa queda darrere de la placa frontal de la presa.`,
     confusion:'El registre de presa és la caixa; la BAT és el connector frontal on l\'usuari endolla el cable. A menys de 50 cm hi ha d\'haver una presa de corrent.',
     nets:[`${T.net}_${U}`], canals:[`ci_${U}`], links:[`bat_${pid}`]});
    def({id:`bat_${pid}`, fam:'punt', layer:'punts', svc:T.svc, floor:f, unit:U, zone:'privada', room:p.room, parent:`rp_${pid}`, ptype:p.t, dbl:!!p.dbl,
     name:`${T.bat}${p.dbl?' doble':''}${p.k.startsWith('dat2')?' (2a)':''} — ${R.name}, ${N}`, sigla:'BAT',
     what: p.t==='fo' ? 'És la presa òptica (roseta amb adaptador SC/APC) on es connecta l\'ONT amb un latiguillo òptic.' : `És la presa${p.dbl?' doble':''} on l\'usuari connecta ${p.t==='rtv'?'el televisor o la ràdio':p.t==='tba'?'l\'equip d\'un operador de cable':'un equip de dades'}.`,
     purpose:`És el punt final de la xarxa interior ${p.t==='rtv'?'de RTV':p.t==='tba'?'coaxial de TBA':p.t==='fo'?'de fibra òptica':'de parells trenats'}. ${why}`,
     where:`Dins del ${T.reg[0].toLowerCase()+T.reg.slice(1)} ${R.de}.`,
     connects: p.t==='fo' ? 'Fibra interior des del PAU → latiguillo òptic → ONT.' : p.k==='dat_sala' ? 'Connector 1: encaminador (dades de sortida cap al registre de terminació de xarxa). Connector 2: lliure o per a un altre equip.' : `Cable interior → cable curt de l\'equip.`,
     example: p.t==='fo' ? 'L\'ONT de la sala es connecta a aquesta presa amb un latiguillo òptic curt.' : p.k==='rtv_sala' ? 'El televisor de la sala es connecta a aquesta BAT amb un cable coaxial curt.' : p.k==='dat_d1' ? 'L\'ordinador del dormitori 1 es connecta aquí amb un latiguillo.' : p.k==='dat_sala' ? 'L\'encaminador, al costat, s\'hi connecta per enviar dades a la resta de l\'habitatge.' : `Aquí s\'hi connectaria un equip ${R.de}.`,
     confusion: p.t==='fo' ? 'La presa òptica no és el PAU: el PAU de fibra és al registre de terminació de xarxa. Aquesta presa és el final de la fibra interior.' : 'La BAT és el connector; el registre de presa és la caixa encastada que l\'allotja.',
     nets:[`${T.net}_${U}`], links:[`rp_${pid}`]});
  }

  /* equips de l'usuari */
  def({id:`ont_${U}`, fam:'punt', layer:'equips', svc:'fo', floor:f, unit:U, zone:'privada (equip d\'usuari)', room:'sala',
   name:`Terminal de xarxa òptica — ${N}`, sigla:'ONT',
   what:'L\'ONT (Optical Network Terminal) és un equip actiu que converteix el senyal òptic de la fibra (llum) en senyal elèctric de dades. Normalment el subministra l\'operador.',
   purpose:'Fa el canvi de mitjà: de fibra òptica a una connexió elèctrica Ethernet.',
   where:'Sala d\'estar, en un prestatge al costat de la presa òptica i de la BAT RJ45 doble, amb presa de corrent.',
   connects:'Presa òptica de la sala → latiguillo òptic → ONT → latiguillo Ethernet → encaminador.',
   example:'Si el llum d\'alarma òptica de l\'ONT s\'encén, el problema és a la fibra; si l\'ONT funciona i no hi ha Wi‑Fi, cal mirar l\'encaminador.',
   confusion:'L\'ONT no és el PAU: és un equip de l\'usuari que es connecta a la presa òptica. Hi ha equips que integren ONT i encaminador en una sola caixa.',
   links:[`bat_fo_sala_${U}`,`router_${U}`]});
  def({id:`router_${U}`, fam:'punt', layer:'equips', svc:'fo', floor:f, unit:U, zone:'privada (equip d\'usuari)', room:'sala',
   name:`Encaminador (router) — ${N}`, sigla:'',
   what:'És l\'equip actiu que crea la xarxa local de l\'habitatge i reparteix les dades per Wi‑Fi i pels cables de parells trenats interiors.',
   purpose:'Fa el canvi de funció: de l\'accés de l\'operador a la xarxa local de l\'usuari.',
   where:'Sala d\'estar, al costat de l\'ONT.',
   connects:'ONT (entrada) → port LAN → BAT RJ45 doble de la sala → cable interior fins al registre de terminació de xarxa → latiguillo (o petit commutador) → cables de les altres estàncies.',
   example:'Per donar cable a l\'ordinador del dormitori 1, l\'encaminador s\'endolla a la BAT doble de la sala i, al registre de terminació de xarxa, aquest cable s\'uneix amb el del dormitori 1.',
   confusion:'No forma part de la ICT comuna ni és un PAU: és un equip de l\'usuari associat al servei contractat.',
   nets:[`xi_dat_${U}`], links:[`ont_${U}`,`bat_dat_sala_${U}`]});
  def({id:`tv_${U}`, fam:'punt', layer:'equips', svc:'rtv', floor:f, unit:U, zone:'privada (equip terminal)', room:'sala',
   name:`Televisor (equip terminal) — ${N}`, sigla:'',
   what:'És l\'equip terminal de l\'usuari que rep la RTV.', purpose:'Mostra el destí final del recorregut de RTV.',
   where:`Sala d\'estar ${DEL}.`, connects:'Es connecta a la BAT de RTV de la sala.',
   example:'Si el televisor no sintonitza, primer es prova amb un altre cable entre la BAT i el televisor.',
   confusion:'El televisor no forma part de la ICT.', links:[`bat_rtv_sala_${U}`]});
  def({id:`pc_${U}`, fam:'punt', layer:'equips', svc:'pt', floor:f, unit:U, zone:'privada (equip terminal)', room:'d1',
   name:`Ordinador (equip terminal) — ${N}`, sigla:'',
   what:'És l\'equip terminal de dades de l\'usuari.', purpose:'Mostra el destí final del recorregut de dades.',
   where:`Escriptori del dormitori 1 ${DEL}.`, connects:'Es connecta amb un latiguillo a la BAT RJ45 doble del dormitori 1.',
   example:'Una connexió per cable sol ser més estable que la Wi‑Fi per a videotrucades.',
   confusion:'L\'ordinador no forma part de la ICT ni de la xarxa interior: s\'hi connecta.', links:[`bat_dat_d1_${U}`,`router_${U}`]});
}
for (const u of UNITS) defUnit(u);

/* ---------------- Fitxes sense representació 3D ---------------- */
def({id:'ritu', fam:'recinte', layer:'recintes', svc:'all', floor:null, noModel:true, zone:'—',
 name:'Recinte d\'instal·lacions de telecomunicació únic', sigla:'RITU',
 what:'És un únic recinte que acumula les funcions del RITI i del RITS.',
 purpose:'La normativa l\'admet en edificis de fins a tres plantes i planta baixa amb un màxim de deu PAU, i en conjunts de cases unifamiliars.',
 where:'No es representa al model: aquest edifici té quatre plantes sobre la planta baixa i 16 PAU (més de deu), per això té RITI i RITS.',
 connects:'Allotjaria alhora els registres principals i la capçalera de RTV.',
 example:'Un edifici de planta baixa i dues plantes amb sis habitatges podria tenir un sol RITU.',
 confusion:'El RITU no és un tercer recinte: és una alternativa que substitueix RITI i RITS quan la normativa ho permet.'});
def({id:'ritm', fam:'recinte', layer:'recintes', svc:'all', floor:null, noModel:true, zone:'—',
 name:'Recinte modular', sigla:'RITM',
 what:'RITM fa referència a la realització dels recintes (inferior, superior o únic) mitjançant armaris modulars no propagadors de la flama.',
 purpose:'La normativa ho admet en edificis de pisos de fins a 45 PAU i en conjunts unifamiliars de fins a 20 PAU, amb els graus de protecció que corresponguin.',
 where:'No es representa al model: aquí els recintes són locals d\'obra.',
 connects:'Fa la mateixa funció que el recinte que substitueix.',
 example:'En una rehabilitació sense espai per a un local, el RITI es pot fer amb un armari modular.',
 confusion:'Un RITM no és un tipus nou de recinte amb una altra funció: és una manera de construir-lo.'});

/* ---------------- RITS detallat: elements nous ---------------- */
const RD = o => def(Object.assign({floor:5, zone:'comuna (RITS)', parent:'rits', svc:'rtv', links:[]}, o));
RD({id:'rits_porta', fam:'recinte', layer:'recintes', parent:null, openOf:'rits', svc:'all', zone:'comuna (coberta)',
 name:'Porta metàl·lica del RITS',
 what:'Porta d\'una fulla de xapa d\'acer amb bastiment, tres frontisses, maneta per les dues cares, pany amb clau i reixeta de ventilació a la part baixa.',
 purpose:'Tanca el recinte i en limita l\'accés al personal autoritzat. Obre cap a fora per no ocupar l\'espai interior de treball.',
 where:'Paret frontal del RITS, a la coberta.',
 connects:'Forma part del tancament del RITS. El quadre de protecció i l\'interruptor de la llum són a prop d\'aquesta porta.',
 example:'Abans d\'entrar a ajustar la capçalera, l\'instal·lador obre amb clau, encén la llum des de l\'interruptor del costat de la porta i deixa la porta oberta mentre treballa.',
 confusion:'El reglament demana una porta metàl·lica que obri cap a fora, amb pany i unes dimensions mínimes. Al model l\'obertura és orientativa: no s\'han verificat les mesures del projecte.',
 links:['rits','rits_quadre']});
RD({id:'cab_capt_int', fam:'xarxa', layer:'xarxes', tram:'capt', tech:'coax',
 name:'Cable coaxial interior de TDT (PVC blanc)',
 what:'Tram de cable coaxial d\'interior, amb coberta de PVC blanca, que continua el cable de captació dins del RITS. Comença a la unió F‑F del registre d\'enllaç i acaba a l\'entrada de la capçalera.',
 purpose:'Porta el senyal de l\'antena TDT des del passamurs fins a l\'entrada de la capçalera, protegit dins d\'un tub corrugat.',
 where:'Interior del RITS: surt del registre d\'enllaç superior, baixa i recorre la paret del fons dins del tub corrugat d\'entrada.',
 connects:'Unió F‑F del registre d\'enllaç superior → entrada de la capçalera.',
 example:'Si cal canviar la capçalera, només es desconnecta aquest tram interior: el cable exterior de l\'antena no es toca.',
 confusion:'El canvi de color no és un canvi de servei: el cable exterior és de polietilè negre (resistent als raigs UV) i el d\'interior és de PVC blanc. Tots dos són coaxials de 75 Ω i s\'uneixen amb connectors F.',
 canals:['rits_corr_in'], links:['rits_ff','capcalera','cab_capt'],
 vt:{A:{connects:'Unió F‑F del registre d\'enllaç superior → entrada 1 (VHF+UHF) de la centraleta programable.'},
     B:{connects:'Unió F‑F del registre d\'enllaç superior → filtre LTE/5G → entrada del primer amplificador monocanal.'}}});
RD({id:'rits_ff', fam:'punt', layer:'punts', parent:'reg_enllac_sup',
 name:'Unions F‑F (transició exterior‑interior, 4)',
 what:'Quatre adaptadors F femella‑femella, un per cable (TDT, DAB, FM i satèl·lit). A cadascun s\'hi rosquen dos connectors F mascle: el del cable exterior negre i el del cable interior blanc.',
 purpose:'Fa la transició entre el cable d\'exterior i el d\'interior en un punt accessible i registrable, sense empalmaments improvisats.',
 where:'Dins del registre d\'enllaç superior, just a l\'interior del passamurs.',
 connects:'Per a cada antena: cable exterior (PE negre) ↔ cable interior (PVC blanc). Els quatre senyals continuen separats.',
 example:'Per comprovar si el problema és a l\'antena o a la capçalera, l\'instal·lador desenrosca la unió i hi connecta el mesurador de camp.',
 confusion:'És un punt de connexió passiu: no amplifica ni filtra. Els connectors F cobreixen el conductor; no ha de quedar coure a la vista.',
 links:['cab_capt','cab_dab','cab_fm','cab_sat','cab_capt_int','cab_dab_int','cab_fm_int','cab_sat_int','reg_enllac_sup']});
RD({id:'rits_corr_in', fam:'canal', layer:'canalitzacions',
 name:'Tub corrugat d\'entrada a la capçalera',
 what:'Tub corrugat flexible de color negre, subjectat a la paret amb brides, que protegeix el cable interior de captació.',
 purpose:'Guia i protegeix el cable des del registre d\'enllaç fins a la capçalera, amb corbes suaus que no deformen el coaxial.',
 where:'Interior del RITS: baixa del registre d\'enllaç superior i recorre la paret del fons fins damunt de la capçalera.',
 connects:'Registre d\'enllaç superior → capçalera. Allotja el cable interior de captació.',
 example:'Amb «Obrir un tram de corrugat» es retira mig tub en un tram i es veu el cable blanc a dins.',
 confusion:'El tub és canalització; el cable que hi passa és xarxa. El tub s\'atura abans de l\'equip perquè el cable hi arribi amb una petita reserva.',
 nets:['cab_capt_int','cab_dab_int','cab_fm_int','cab_sat_int'], links:['reg_enllac_sup','capcalera']});
RD({id:'rits_corr_out', fam:'canal', layer:'canalitzacions',
 name:'Tub corrugat de sortida cap a la canalització principal',
 what:'Tub corrugat negre que recull els dos cables de distribució a la sortida del repartidor i els porta fins al tub de RTV de la canalització principal.',
 purpose:'Protegeix els cables de distribució dins del RITS fins que baixen per l\'edifici.',
 where:'Interior del RITS: de sota del repartidor, per la part baixa de la paret del fons, fins al pas del forjat.',
 connects:'Repartidor de 2 sortides → tub de RTV de la canalització principal. Allotja els dos cables de distribució.',
 example:'Amb «Destacar sortides de distribució» es ressalten el repartidor, aquest tub i els dos cables que baixen per l\'edifici.',
 confusion:'Dins del RITS els cables de distribució es veuen blancs (aparença real); fora del RITS el model els pinta amb el color didàctic del tram.',
 nets:['xd_rtv'], links:['cap_rep','canal_principal']});
RD({id:'rits_safata', fam:'canal', layer:'canalitzacions', svc:'all',
 name:'Safata perimetral de cables',
 what:'Safata metàl·lica perforada que recorre el perímetre del recinte a prop del sostre.',
 purpose:'Permet estendre ordenadament cables nous (per exemple, d\'un servei futur) sense obrir regates.',
 where:'Tot el perímetre interior del RITS, uns 30 cm per sota del sostre.',
 connects:'Està unida a l\'anell de terra amb una connexió equipotencial.',
 example:'Si la comunitat afegeix una parabòlica, el seu cable pot anar per aquesta safata fins a la capçalera.',
 confusion:'Al model la safata és buida: els cables de captació i distribució van dins de tubs corrugats per veure clarament el recorregut.',
 links:['rits_terra','rits_equip']});
RD({id:'rits_suport', fam:'punt', layer:'equips',
 name:'Placa de muntatge de la capçalera',
 what:'Placa d\'acer galvanitzat fixada a la paret amb sis cargols i tacs, on es munten la capçalera i el repartidor.',
 purpose:'Dona una base rígida i ventilada als equips i separa la seva fixació de la paret d\'obra.',
 where:'Paret del fons del RITS, a l\'alçada de treball.',
 connects:'Suporta l\'equip de capçalera i el repartidor. Està connectada a la barra de terra.',
 example:'Davant de la placa es deixa espai lliure perquè l\'instal·lador hi pugui treballar amb el mesurador de camp.',
 confusion:'La placa no forma part del circuit de senyal. Els equips i connectors que hi ha al damunt són a mida real (dimensions dels catàlegs del fabricant).',
 links:['capcalera','cap_rep','rits_equip']});
RD({id:'cap_avant', fam:'punt', layer:'equips', parent:'capcalera', variant:'A',
 name:"Centraleta programable amb FI (exemple: Televes AVANT 12 PRO SAT, ref. 532204)",
 what:"Amplificador programable compacte amb xassís de zamac. Té quatre entrades VHF+UHF, una entrada d'FM i una entrada de satèl·lit (FI) amb amplificador de FI integrat. Té dues sortides: TV (només senyal terrestre) i TV+SAT (terrestre + satèl·lit).",
 purpose:"Selecciona i iguala els canals de TDT, la DAB i l'FM i, a més, amplifica la FI d'una sortida de l'LNB. És el primer amplificador de FI de la capçalera.",
 where:"Placa de muntatge, paret del fons del RITS. Entrades terrestres i de satèl·lit a la part superior; alimentació, entrada FM i sortides a la part inferior.",
 connects:"Entrada 1 ← TDT. Entrada 2 ← DAB. Entrades 3 i 4 tancades amb càrregues amb bloqueig de CC. Entrada FM ← FM. Entrada SAT ← sortida A de l'LNB (la centraleta alimenta l'LNB per aquest cable). Sortida TV+SAT → directament al cable de distribució 1. Sortida TV (només terrestre) → latiguillo → entrada TERR del mesclador, on s'hi afegeix la FI del segon amplificador → cable de distribució 2.",
 example:"Si la parabòlica es desorienta, la TDT, la DAB i l'FM continuen arribant per tots dos cables de distribució: només desapareix la FI.",
 confusion:"Les dues sortides no són iguals: la TV+SAT ja porta la FI i va directa al cable 1; la sortida TV és només terrestre i cal mesclar-la amb la FI del segon amplificador per fer el cable 2. Les posicions dels connectors del model són aproximades.",
 links:['cab_capt_int','cab_dab_int','cab_fm_int','cab_sat_int','cap_fi_2','cap_jump','cap_mix','xd_rtv','cap_carregues','rits_cordo','rits_bases_cap','rits_terra']});
const TDTCH=[23,26,27,29,32,34,36,38,40,45];
for(let i=1;i<=10;i++){
  RD({id:`cap_t12_${i}`, fam:'punt', layer:'equips', parent:'capcalera', variant:'B',
   name:`Amplificador monocanal TDT ${i} · UHF canal ${TDTCH[i-1]} (exemple: Televes T12, ref. 509812)`,
   what:"Mòdul amplificador UHF selectiu d'un sol canal de la sèrie T12, amb xassís de zamac negre, dos connectors F d'entrada, dos de sortida, interruptor de CC, LED i potenciòmetre de guany.",
   purpose:`Amplifica només el canal ${TDTCH[i-1]} de TDT (canal d'exemple) i en permet ajustar el nivell sense afectar els altres múltiplexs.`,
   where:`Suport de paret de la placa de muntatge, posició ${14-i} començant per l'esquerra: els mòduls de TDT van del 10 (al costat dels amplificadors de FI) a l'1 (al costat de la DAB).`,
   connects: i===1 ? "Entrada superior ← filtre LTE/5G ← cable interior de TDT: és l'única entrada des de l'antena UHF. L'altra entrada passa el senyal al mòdul 2 amb un pont F (connexió en Z). La sortida s'acumula amb la dels veïns amb ponts F. Alimentació 24 V c.c. des de la font 2."
     : i===10 ? "Rep la TDT del mòdul 9 per un pont F; l'entrada inferior lliure es tanca amb una càrrega amb bloqueig de CC. La seva sortida superior s'acumula amb la del veí per un pont F i la inferior, lliure, es tanca amb una càrrega. Alimentació 24 V c.c. des de la font 1."
     : `Rep la TDT del mòdul ${i-1} per un pont F i la passa al mòdul ${i+1} (connexió en Z). La seva sortida s'acumula amb la dels veïns amb ponts F. Alimentació 24 V c.c. des de la font ${i<=5?2:1}.`,
   example:"Si un múltiplex canvia de canal, només cal reajustar o substituir el mòdul d'aquell canal.",
   confusion:"Els canals són un exemple didàctic; en una instal·lació real depenen dels múltiplexs que es reben a la zona. L'ordre exacte dels ponts en Z s'ha de comprovar al manual d'instal·lació del fabricant.",
   links:['cap_ponts','cap_dc','cap_font','cap_rail', i===1?'cap_filtre':null, i===1?'cab_capt_int':null].filter(Boolean)});
}
RD({id:'cap_t12_dab', fam:'punt', layer:'equips', parent:'capcalera', variant:'B',
 name:"Amplificador DAB · banda III (exemple: Televes T12, ref. 508312)",
 what:"Mòdul amplificador de la banda III (174‑230 MHz) per a ràdio digital DAB, amb el mateix format de la sèrie T12.",
 purpose:"Amplifica i ajusta el nivell dels blocs de ràdio digital DAB rebuts per l'antena DAB.",
 where:"Carril de suport, a la dreta del darrer mòdul de TDT.",
 connects:"Entrada superior ← cable interior de DAB (entrada pròpia, des de la seva antena). L'altra entrada es tanca amb una càrrega. La sortida s'acumula amb les dels veïns amb ponts F. Alimentació 24 V c.c. des de la font 2.",
 example:"Si l'antena DAB s'avaria, la TDT i l'FM no es veuen afectades: cada banda té el seu mòdul i el seu cable.",
 confusion:"La DAB no entra pel pont de TDT: té cable i entrada propis.",
 links:['cab_dab_int','cap_ponts','cap_dc','cap_font','cap_rail']});
RD({id:'cap_t12_fm', fam:'punt', layer:'equips', parent:'capcalera', variant:'B',
 name:"Amplificador FM · 87,5‑108 MHz (exemple de la sèrie T12)",
 what:"Mòdul amplificador de la banda II per a ràdio FM, amb el mateix format de la sèrie T12.",
 purpose:"Amplifica i ajusta el nivell de les emissores d'FM rebudes pel dipol circular.",
 where:"Carril de suport, darrer mòdul terrestre (a l'esquerra de la font 2).",
 connects:"Entrada superior ← cable interior d'FM. L'altra entrada es tanca amb una càrrega. Rep la sortida acumulada dels mòduls terrestres per ponts F; la seva sortida lliure és la sortida MATV de la capçalera → latiguillo → entrada TERR del mesclador. Alimentació 24 V c.c. des de la font 2.",
 example:"Mesurant a la sortida MATV es veuen alhora la TDT, la DAB i l'FM, abans d'afegir-hi la FI.",
 confusion:"La sortida MATV només porta senyals terrestres: la FI de satèl·lit s'hi afegeix després, al mesclador.",
 links:['cab_fm_int','cap_ponts','cap_dc','cap_font','cap_rail','cap_jump']});
RD({id:'cap_fi_1', fam:'punt', layer:'equips', parent:'capcalera', variant:'B',
 name:"Amplificador de FI 1 · SAT A (exemple: Televes T12, ref. 508012)",
 what:"Mòdul amplificador de freqüència intermèdia de satèl·lit (950‑2150 MHz) de la sèrie T12, amb una entrada i una sortida F, regulació de guany i equalitzador.",
 purpose:"Amplifica la FI de la sortida A de l'LNB i alimenta l'LNB (13‑17 V c.c.) pel mateix cable.",
 where:"Carril de suport, primera posició a la dreta de la font 1.",
 connects:"Entrada ← cable interior de satèl·lit A. Sortida → latiguillo → entrada SAT A del mesclador. Alimentació 24 V c.c. des de la font 1.",
 example:"Encara que la comunitat no hagi instal·lat la parabòlica, l'amplificador ja és a la capçalera: només caldrà connectar-hi el cable de l'LNB.",
 confusion:"No amplifica TDT: la FI de satèl·lit va per un camí separat fins al mesclador. Sense parabòlica, la seva entrada queda lliure.",
 links:['cab_sat_int','cap_mix','cap_dc','cap_font','cap_rail']});
RD({id:'cap_fi_2', fam:'punt', layer:'equips', parent:'capcalera',
 name:"Amplificador de FI 2 · SAT B (exemple: Televes T12, ref. 508012)",
 what:"Mòdul amplificador de freqüència intermèdia de satèl·lit (950‑2150 MHz) de la sèrie T12, amb una entrada i una sortida F, regulació de guany i equalitzador.",
 purpose:"Amplifica la FI de la sortida B de l'LNB i alimenta l'LNB pel mateix cable.",
 where:"Carril de suport de la placa de muntatge.",
 connects:"Entrada ← cable interior de satèl·lit B. Sortida → latiguillo → entrada SAT del mesclador.",
 example:"Encara que la comunitat no hagi instal·lat la parabòlica, l'amplificador ja és a la capçalera.",
 confusion:"Cada cable de distribució porta una FI diferent (A o B): per això calen dos amplificadors de FI.",
 links:['cab_sat2_int','cap_mix','cap_dc','cap_font','cap_rail'],
 vt:{A:{where:"Carril de suport, a la dreta de la centraleta i de la font d'alimentació.", connects:"Entrada ← cable interior de satèl·lit B. Sortida → latiguillo → entrada SAT del mesclador MATV‑FI. Alimentació 24 V c.c. des de la font. El primer amplificador de FI és el que porta integrat la centraleta."},
     B:{where:"Carril de suport, segona posició a la dreta de la font 1.", connects:"Entrada ← cable interior de satèl·lit B. Sortida → latiguillo → entrada SAT B del mesclador. Alimentació 24 V c.c. des de la font 1."}}});
RD({id:'cap_font', fam:'punt', layer:'equips', parent:'capcalera',
 name:"Font d'alimentació de 24 V c.c. (exemple: Televes ref. 549812, 2,5 A)",
 what:"Font d'alimentació commutada de la sèrie T12, de classe II, amb sortida de 24 V de corrent continu (fins a 2,5 A) i cable amb clavilla europea.",
 purpose:"Alimenta els mòduls amplificadors amb 24 V c.c. a través de latiguillos d'alimentació.",
 where:"Carril de suport.",
 connects:"Entrada 230 V c.a. ← base de corrent de la capçalera (clavilla sense terra, equip de classe II). Sortida 24 V c.c. → latiguillos → mòduls.",
 example:"Abans d'afegir mòduls, se suma el consum de tots (inclòs el de l'LNB que alimenten els amplificadors de FI) i es comprova que no supera el de la font.",
 confusion:"La font no amplifica el senyal: només alimenta els equips. Com que és de classe II, el seu cable no porta conductor de protecció.",
 links:['cap_dc','rits_cordo','rits_bases_cap','cap_rail'],
 vt:{A:{name:"Font d'alimentació de 24 V c.c. de l'amplificador de FI 2 (exemple: Televes ref. 549812)", connects:"Entrada 230 V c.a. ← base de corrent de la capçalera. Sortida 24 V c.c. → latiguillo → amplificador de FI 2. La centraleta té la seva pròpia alimentació."},
     B:{name:"Fonts d'alimentació de 24 V c.c. (2 × exemple: Televes ref. 549812, 2,5 A)", connects:"Font 1 (esquerra) → amplificadors de FI 1 i 2 i mòduls de TDT 10 a 6. Font 2 (dreta) → mòduls FM, DAB i TDT 1 a 5. Cada font, a una base de corrent de la capçalera.",
       example:"Catorze mòduls (dotze de 195 mA i dos de FI de fins a 350 mA amb l'LNB) superen els 2,5 A d'una sola font: per això n'hi ha dues, cadascuna per sota del seu límit."}}});
RD({id:'cap_rail', fam:'punt', layer:'equips', parent:'capcalera',
 name:"Suport de paret dels mòduls T12 (exemple: ref. 5071)",
 what:"Dos perfils metàl·lics fixats a la placa, on es pengen les fonts (70 mm d'ample) i els amplificadors modulars (35 mm d'ample, 198 mm d'alt).",
 purpose:"Manté els mòduls alineats a la distància justa perquè hi encaixin els ponts F.",
 where:"Placa de muntatge de la capçalera.",
 connects:"Suporta les fonts i els mòduls. Té un cargol unit a la barra de terra.",
 example:"Per afegir un mòdul, es penja al carril al costat de l'últim i s'hi connecten els ponts.",
 confusion:"El carril és un suport mecànic, no un bus de senyal.",
 links:['cap_font','rits_terra']});
RD({id:'cap_filtre', fam:'punt', layer:'equips', parent:'capcalera', variant:'B',
 name:'Filtre LTE/5G (exemple: Televes ref. 403201)',
 what:'Filtre passiu endollable amb connectors F que deixa passar fins a 694 MHz i atenua la banda de telefonia mòbil de 733 a 862 MHz.',
 purpose:'Evita que els senyals de mòbil (4G/5G) saturin els amplificadors de TDT.',
 where:"Endollat directament a l'entrada superior del mòdul de TDT 1.",
 connects:"Cable interior de TDT → filtre → entrada del mòdul de TDT 1, que reparteix la TDT a la resta per ponts F. Deixa passar la tensió contínua.",
 example:'Si a prop hi ha una antena de telefonia, sense filtre la TDT pot pixelar a tot l\'edifici.',
 confusion:'A la centraleta programable aquest filtre ja és intern; per això només apareix a la capçalera modular.',
 links:['cab_capt_int','cap_t12_1']});
RD({id:'cap_ponts', fam:'punt', layer:'punts', parent:'capcalera', variant:'B',
 name:"Ponts F d'interconnexió (exemple: ref. 5074, 75 Ω)",
 what:"Ponts rígids de 48 mm entre connectors, amb un connector F ràpid a cada extrem, que uneixen dos mòduls veïns.",
 purpose:"Passen la TDT de l'únic mòdul que rep l'antena a la resta de mòduls de TDT, i acumulen les sortides de tots els mòduls terrestres (TDT, DAB i FM) cap a una sola sortida MATV.",
 where:"Davant dels mòduls terrestres, en diagonal: cada pont uneix el connector superior (a l'esquerra) d'un mòdul amb l'inferior (a la dreta) del mòdul veí de la dreta (connexió en Z), tant a les entrades com a les sortides.",
 connects:"Entrades: TDT 10 ↔ 9 ↔ … ↔ 1 (el TDT 1 rep l'antena pel filtre). Sortides: TDT 10 ↔ … ↔ 1 ↔ DAB ↔ FM. Els extrems lliures porten càrregues de 75 Ω. Els amplificadors de FI no hi estan connectats.",
 example:"Si falta un pont d'entrada, els canals dels mòduls següents desapareixen de la sortida.",
 confusion:"Els ponts són passius i bidireccionals: la TDT entra pel TDT 1 i es reparteix cap als mòduls de l'esquerra. Abans de fer servir el model com a pauta de muntatge, cal verificar l'ordre al manual d'instal·lació.",
 links:['cap_t12_1','cap_t12_10','cap_t12_dab','cap_t12_fm','cap_carregues']});
RD({id:'cap_dc', fam:'punt', layer:'equips', parent:'capcalera', svc:'all', noRoute:true,
 name:"Latiguillos d'alimentació de 24 V c.c.",
 what:"Cables curts de dos conductors amb connector que porten els 24 V de corrent continu de la font a cada mòdul.",
 purpose:"Alimenten els amplificadors en cadena des de la font.",
 where:"A la part frontal dels mòduls, a l'alçada dels connectors d'alimentació.",
 connects:"Font → mòdul → mòdul → …",
 example:"Si el LED d'un mòdul no s'encén, cal revisar el seu latiguillo d'alimentació i l'interruptor.",
 confusion:"Són cables d'alimentació, no de senyal: no porten RF.",
 links:['cap_font','cap_rail'],
 vt:{B:{connects:"Font 1 → FI 1 → FI 2 → TDT 1 → … → TDT 5. Font 2 → FM → DAB → TDT 10 → … → TDT 6."}, A:{connects:"Font → amplificador de FI 2."}}});
RD({id:'cap_mix', fam:'punt', layer:'equips', parent:'capcalera',
 name:"Mesclador de la capçalera",
 what:"Mesclador passiu de zamac amb connectors F que combina la sortida terrestre (MATV) amb la FI de satèl·lit.",
 purpose:"Posa en un mateix cable de distribució els senyals terrestres i els de satèl·lit, que viatgen en bandes diferents.",
 where:"Placa de muntatge, a la part baixa dreta, damunt del tub corrugat de sortida.",
 connects:"Entrades terrestre i de satèl·lit → sortides cap als cables de distribució.",
 example:"Cada entrada de satèl·lit deixa passar la tensió de l'LNB des de la sortida, perquè l'LNB es pugui alimentar.",
 confusion:"Un mesclador no és un repartidor: no divideix un senyal en dos, sinó que ajunta bandes diferents.",
 links:['cap_jump','xd_rtv','rits_corr_out','rits_equip','cap_fi_2'],
 vt:{A:{name:"Mesclador MATV‑FI de 2 entrades (exemple: Televes ref. 745210)",
        what:"Mesclador passiu de zamac amb dues entrades (TERR i SAT) i una sortida, amb connectors F.",
        connects:"Entrada TERR ← sortida TV (només terrestre) de la centraleta. Entrada SAT ← amplificador de FI 2. Sortida → cable de distribució 2. El cable de distribució 1 surt directament de la sortida TV+SAT de la centraleta.",
        example:"Pèrdues d'inserció d'exemple: 1,5 dB a la via terrestre i 1,8 dB a la de satèl·lit."},
     B:{name:"Mesclador TERR + 2 SAT, 3 entrades i 2 sortides (exemple: Televes ref. 740710)",
        what:"Mesclador passiu de zamac de tres entrades (TERR, SAT A i SAT B) i dues sortides (OUT A i OUT B), amb connectors F.",
        connects:"Entrada TERR ← sortida MATV dels mòduls (latiguillo). Entrada SAT A ← amplificador de FI 1. Entrada SAT B ← amplificador de FI 2. OUT A (TERR + SAT A) → cable de distribució 1. OUT B (TERR + SAT B) → cable de distribució 2.",
        example:"Pèrdues d'inserció d'exemple: 5,5 dB a la via terrestre (es reparteix a les dues sortides) i 1 dB a la de satèl·lit."}}});
RD({id:'cap_jump', fam:'xarxa', layer:'xarxes', parent:'capcalera', tram:'capt', tech:'coax',
 name:"Latiguillos coaxials de la capçalera",
 what:"Trams curts de coaxial blanc amb dos connectors F mascle.",
 purpose:"Uneixen les sortides dels amplificadors amb les entrades del mesclador.",
 where:"Placa de muntatge, per sota dels equips.",
 connects:"Sortida terrestre → entrada TERR del mesclador. Sortides dels amplificadors de FI → entrades SAT del mesclador.",
 example:"Són els primers cables que es desconnecten per mesurar el nivell de cada sortida.",
 confusion:"Encara són dins de la capçalera: la xarxa de distribució comença a les sortides cap als dos cables que baixen per l'edifici.",
 links:['cap_mix','capcalera'],
 vt:{A:{connects:"Sortida TV de la centraleta → entrada TERR del mesclador. Sortida de l'amplificador de FI 2 → entrada SAT del mesclador."},
     B:{connects:"Sortida MATV (mòdul FM) → entrada TERR del mesclador. Amplificador de FI 1 → SAT A. Amplificador de FI 2 → SAT B."}}});
RD({id:'cap_conF', fam:'punt', layer:'punts', parent:'capcalera',
 name:'Connectors F mascle roscats (exemple: ref. 417101)',
 what:'Connectors F mascle amb femella hexagonal i cos moletejat que es rosca sobre la coberta del cable coaxial.',
 purpose:'Uneixen els cables coaxials als ports F dels equips. El conductor central del cable pelat fa de contacte mascle; la malla connecta amb el cos metàl·lic.',
 where:'A cada extrem de cable coaxial del RITS.',
 connects:'Cables coaxials ↔ connectors F femella dels equips.',
 example:'Un connector mal rematat amb la malla tocant el conductor central pot curtcircuitar l\'alimentació d\'antena.',
 confusion:'No són connectors de compressió: el cos es rosca sobre el cable. El model 417101 segueix el perfil del plànol del fabricant (21,1 mm de llarg); la rosca interior i el moletejat són aproximats.',
 links:['cap_mix','rits_ff']});
RD({id:'cap_carregues', fam:'punt', layer:'punts', parent:'capcalera',
 name:'Càrregues de 75 Ω',
 what:'Taps amb una resistència de 75 Ω que tanquen els connectors que no es fan servir.',
 purpose:'Eviten reflexions i, a les entrades que donen tensió, bloquegen el corrent continu perquè no hi hagi un curtcircuit.',
 where:'Connectors lliures de la capçalera.',
 connects:'Connectors F lliures de la capçalera.',
 example:'Per mesurar la sortida de test, es retira la seva càrrega i s\'hi connecta el mesurador.',
 confusion:'Una càrrega amb bloqueig de CC (ref. 4061) es posa on el port pot donar tensió; una sense bloqueig (ref. 4058), on no n\'hi ha.',
 links:['capcalera'],
 vt:{A:{where:'Entrades 2, 3 i 4 (amb bloqueig de CC, ref. 4061), entrada FM i sortida de test (sense bloqueig, ref. 4058).', connects:'Entrades 2‑4, FM i test de la centraleta.'},
     B:{where:'Entrada lliure del mòdul de TDT 10 (amb bloqueig de CC, ref. 4061) i sortida lliure del mateix mòdul (ref. 4058).', connects:'Extrems lliures de la cadena de ponts en Z.'}}});
const RE = o => RD(Object.assign({svc:'all', noRoute:true, layer:'equips', fam:'punt'}, o));
RE({id:'rits_cordo', name:'Cable d\'alimentació de la capçalera (230 V c.a.)',
 what:'Cable de dos conductors, sense conductor de protecció, que va d\'una base de corrent a l\'equip de capçalera.',
 purpose:'Dona alimentació de xarxa a l\'equip de capçalera.',
 where:'Des de les bases de corrent de la capçalera fins a l\'equip, per sota de la placa.',
 connects:'Base de corrent de la capçalera → equip.',
 example:'Abans de manipular la capçalera es pot desendollar la clavilla per deixar-la sense tensió.',
 confusion:'L\'equip és de classe II (doble aïllament): per això la clavilla no té presa de terra. La connexió de terra funcional de l\'equip es fa amb un conductor verd i groc a part.',
 links:['rits_bases_cap'],
 vt:{A:{connects:'Base de corrent → connector de figura 8 (POWER) de la centraleta.'}, B:{connects:'Base de corrent → font d\'alimentació (clavilla europea).'}}});
RE({id:'rits_bases_cap', name:'Bases de corrent de la capçalera',
 what:'Dues bases de corrent tipus Schuko amb presa de terra, en una caixa doble a prop de la capçalera.',
 purpose:'Alimenten l\'equip de capçalera des d\'un circuit protegit propi.',
 where:'Paret del fons, a l\'esquerra de la placa de muntatge.',
 connects:'Circuit «Capçalera RTV 16 A» del quadre de protecció (tub elèctric gris) → equip de capçalera.',
 example:'Si salta el magnetotèrmic de la capçalera, la llum del recinte continua funcionant perquè és un altre circuit.',
 confusion:'Aquestes bases són del recinte; no s\'han de fer servir per a eines.',
 links:['rits_quadre','rits_cordo','rits_tub_elec']});
RE({id:'rits_bases_srv', name:'Bases de corrent de servei',
 what:'Dues bases de corrent tipus Schuko amb presa de terra en una caixa doble.',
 purpose:'Permeten connectar eines i aparells de mesura durant el manteniment.',
 where:'Paret dreta del RITS.',
 connects:'Circuit «Bases 16 A» del quadre de protecció.',
 example:'L\'instal·lador hi carrega el mesurador de camp mentre ajusta la capçalera.',
 confusion:'El reglament demana com a mínim dues bases de servei a més de les de la capçalera.',
 links:['rits_quadre','rits_tub_elec']});
RE({id:'rits_quadre', lid:true, name:'Quadre de protecció elèctrica del RITS',
 what:'Caixa amb tapa i carril DIN amb l\'interruptor general automàtic (IGA), el diferencial de 30 mA i els magnetotèrmics dels circuits del recinte, tots monofàsics de 2 mòduls (fase + neutre), i un borne de terra.',
 purpose:'Protegeix les persones i els circuits del recinte (enllumenat, bases de servei i capçalera) i permet tallar-los per separat.',
 where:'Paret dreta, a prop de la porta.',
 connects:'Arriba l\'alimentació elèctrica de l\'edifici per un tub des del terra. Surten els circuits d\'enllumenat, bases de servei i bases de la capçalera, cadascun pel seu tub. Té el borne de terra unit a l\'anell.',
 example:'Per treballar a les bases de la capçalera es baixa només el seu magnetotèrmic; la llum continua encesa.',
 confusion:'Els valors de les etiquetes (IGA 25 A, ID 30 mA, 10 A i 16 A) segueixen l\'exemple del reglament; el projecte real pot definir-ne d\'altres. Hi ha espai de reserva per ampliacions.',
 links:['rits_bases_cap','rits_bases_srv','rits_llum','rits_emerg','rits_tub_elec','rits_terra']});
RE({id:'rits_tub_elec', fam:'canal', layer:'canalitzacions', name:'Tubs de la instal·lació elèctrica del recinte',
 what:'Tubs de color gris clar, separats dels de telecomunicacions, que porten els circuits elèctrics del recinte.',
 purpose:'Separen físicament els cables de 230 V dels cables de senyal.',
 where:'Muntats en superfície a les parets i al sostre del RITS.',
 connects:'Quadre de protecció → lluminària, llum d\'emergència, interruptor, bases de servei i bases de la capçalera.',
 example:'Un tub nou per a una base addicional es pot estendre sense tocar els tubs corrugats de telecomunicacions.',
 confusion:'El color gris dels tubs elèctrics i el negre dels corrugats de telecomunicacions són una tria d\'aquest model per distingir-los, no una obligació.',
 links:['rits_quadre']});
RE({id:'rits_llum', name:'Lluminària del RITS', glow:true,
 what:'Lluminària de sostre amb difusor opal i interruptor al costat de la porta.',
 purpose:'Il·lumina el recinte per treballar-hi amb seguretat.',
 where:'Sostre, al centre del recinte.',
 connects:'Circuit «Enllumenat 10 A» del quadre de protecció i interruptor de la porta.',
 example:'Prem «Encendre llum» al panell del RITS per veure com canvia la il·luminació interior.',
 confusion:'El reglament fixa un nivell mitjà mínim d\'il·luminació; el model no calcula ni verifica els luxs.',
 links:['rits_quadre','rits_emerg']});
RE({id:'rits_emerg', name:'Llum d\'emergència',
 what:'Lluminària autònoma amb bateria i pilot indicador.',
 purpose:'S\'encén sola si falla l\'alimentació, perquè es pugui sortir del recinte amb seguretat.',
 where:'Paret dreta, a sobre de la porta i a prop del quadre.',
 connects:'Circuit d\'enllumenat del quadre de protecció.',
 example:'Si salta el diferencial mentre s\'hi treballa, aquest llum indica la sortida.',
 confusion:'No substitueix la lluminària normal: només funciona quan falta la tensió.',
 links:['rits_quadre','rits_llum']});
RE({id:'rits_terra', name:'Anell interior de terra i barra col·lectora',
 what:'Conductor de coure aïllat verd i groc que fa un anell tancat a totes les parets del recinte, amb una barra col·lectora de coure massís muntada sobre aïlladors.',
 purpose:'Iguala el potencial de totes les parts metàl·liques del recinte i les uneix a la presa de terra de l\'edifici.',
 where:'Perímetre del RITS a una alçada inspeccionable; la barra col·lectora és a la paret del fons, a l\'esquerra.',
 connects:'Barra col·lectora → conductor cap a la terra general de l\'edifici. Connexions equipotencials cap a la safata, la placa de muntatge, el repartidor, el quadre i l\'equip de capçalera.',
 example:'Abans de connectar un equip nou, se\'n porta el borne de terra a la barra col·lectora amb un conductor verd i groc.',
 confusion:'La terra de telecomunicacions no és el conductor de protecció de les bases de corrent, tot i que tots dos acaben a la terra de l\'edifici. La posició de l\'anell al model és una decisió de representació.',
 links:['rits_equip','rits_quadre','rits_safata']});
RE({id:'rits_equip', name:'Connexions equipotencials',
 what:'Conductors flexibles de coure verd i groc que uneixen cada part metàl·lica amb la barra col·lectora.',
 purpose:'Eviten diferències de tensió perilloses entre parts metàl·liques que es poden tocar alhora.',
 where:'Des de la barra col·lectora fins a la safata, la placa, el repartidor, el quadre i el borne de l\'equip de capçalera.',
 connects:'Barra col·lectora ↔ safata, placa de muntatge, repartidor, quadre i capçalera.',
 example:'El cargol de terra del repartidor es connecta a la barra perquè la malla dels coaxials quedi al mateix potencial.',
 confusion:'Cada connexió va directa a la barra, sense passar d\'un equip a l\'altre.',
 links:['rits_terra','rits_safata','rits_suport','cap_rep']});
RE({id:'rits_vent', name:'Ventilació del recinte',
 what:'Reixeta de ventilació a la part alta de la paret dreta i una altra a la part baixa de la porta.',
 purpose:'Renova l\'aire perquè els equips no s\'escalfin ni s\'hi acumuli humitat.',
 where:'Paret dreta (part alta) i porta (part baixa).',
 connects:'Interior del recinte ↔ exterior.',
 example:'Si les reixetes s\'obstrueixen, la temperatura interior puja i els amplificadors poden fallar.',
 confusion:'El reglament demana una renovació mínima d\'aire; el model no la calcula ni la verifica.',
 links:['rits_porta']});
RE({id:'rits_placa', name:'Placa d\'identificació del recinte (exemple didàctic)',
 what:'Placa a la paret amb el nom del recinte. Al model hi diu «Exemple didàctic» en lloc d\'un número de registre.',
 purpose:'En un recinte real identifica la instal·lació i hi consta el número de registre del projecte tècnic.',
 where:'Paret dreta, a l\'alçada dels ulls.',
 connects:'No té connexions.',
 example:'Un tècnic que hi arriba per primera vegada pot buscar el projecte amb el número de la placa.',
 confusion:'Aquesta placa no porta cap número oficial: és una mostra per a l\'aula.',
 links:[]});

/* textos actualitzats d'elements existents */
Object.assign(EL.rits, { svc:'all',
 what:'És el local d\'obra de la coberta on s\'allotgen els equips que adapten i distribueixen els senyals de RTV. Té parets arrebossades, terra que dissipa les càrregues electrostàtiques, porta metàl·lica, safata perimetral, quadre elèctric, bases de corrent, llum normal i d\'emergència, ventilació i anell de terra.',
 purpose:'Hi arriben els cables de les antenes i hi comença la xarxa de distribució de RTV cap a les plantes.',
 where:'Coberta, sobre el nucli d\'escala, a prop de les antenes.',
 connects:'Entrada superior: tub d\'enllaç superior → passamurs → registre d\'enllaç. A dins: capçalera i repartidor. Sortida inferior: tub corrugat cap a la canalització principal.',
 example:'Quan un canal de TDT canvia de freqüència, l\'instal·lador entra al RITS, encén la llum i reajusta la capçalera des de l\'espai lliure que hi ha davant de la placa.',
 confusion:'El RITS no rep la fibra dels operadors: el seu paper principal és la RTV. El recinte, els equips, els connectors i els cables de dins són a escala real. Usa el panell «Configuració del RITS» per obrir-lo per dins.',
 nets:['cab_capt','cab_capt_int','xd_rtv'], canals:['canal_enllac_sup','rits_corr_in','rits_corr_out','rits_safata','canal_principal'], links:['riti','rits_porta','capcalera']});
Object.assign(EL.capcalera, {
 what:'Conjunt d\'equips que adapten els senyals de les antenes abans de distribuir-los: amplificació, filtratge i, si cal, alimentació.',
 purpose:'Ajusta el nivell i la qualitat dels senyals perquè arribin bé a totes les preses.',
 where:'Placa de muntatge de la paret del fons del RITS.',
 connects:'Entrades: cables interiors de TDT, DAB i FM (el de satèl·lit queda en reserva). Sortida: latiguillo cap al repartidor de 2 sortides, on comencen els dos cables de distribució.',
 example:'Prova a canviar el «Tipus de capçalera» al panell del RITS: el model reconstrueix els equips i les connexions.',
 confusion:'La capçalera no té res a veure amb la fibra dels operadors i no és al RITI. Tampoc és un PAU.',
 nets:['cab_capt_int','cab_dab_int','cab_fm_int','cap_jump'], links:['cap_rep','rits_suport','rits'],
 vt:{A:{name:'Equip de capçalera de RTV · centraleta programable', what:'Capçalera feta amb una centraleta programable (exemple: Televes AVANT 12, ref. 532201): un sol equip amb quatre entrades, filtres digitals i una sortida de TV.'},
     B:{name:'Equip de capçalera de RTV · amplificadors modulars', what:'Capçalera feta amb amplificadors modulars de la sèrie T12 (exemple: un monocanal 509812 i un multicanal 508612 per a la TDT, un mòdul de DAB i un d\'FM), un filtre LTE/5G, ponts F en Z, una font de 24 V (ref. 549812) i un carril de suport.'}}});
Object.assign(EL.cab_capt, {
 name:'Cable coaxial de l\'antena TDT (exterior, PE negre)',
 links:['antena','reg_enllac_sup','rits_ff','cab_capt_int']});
for(const k of ['cab_dab','cab_fm','cab_sat']) EL[k].links.push('rits_ff', k+'_int');
EL.cab_dab.name+=' (exterior, PE negre)'; EL.cab_fm.name+=' (exterior, PE negre)'; EL.cab_sat.name+=' (exterior, PE negre)';
RD({id:'cab_dab_int', fam:'xarxa', layer:'xarxes', tram:'capt', tech:'coax',
 name:'Cable coaxial interior de DAB (PVC blanc)',
 what:'Tram interior, amb coberta de PVC blanca, que continua el cable de l\'antena DAB des de la seva unió F‑F fins a la capçalera.',
 purpose:'Porta la ràdio digital DAB des del registre d\'enllaç fins a l\'entrada de banda III de la capçalera.',
 where:'Interior del RITS, dins del tub corrugat d\'entrada, al costat dels altres tres cables de captació.',
 connects:'Unió F‑F del registre d\'enllaç → entrada de DAB de la capçalera.',
 example:'Per mesurar la DAB sense tocar la TDT, només cal desconnectar aquest cable de la capçalera.',
 confusion:'Comparteix el tub amb els altres cables, però és un cable separat: no hi ha cap barreja abans de la capçalera.',
 canals:['rits_corr_in'], links:['rits_ff','capcalera','cab_dab'],
 vt:{A:{connects:'Unió F‑F del registre d\'enllaç → entrada 2 (VHF+UHF) de la centraleta programable, que accepta la banda III.'},
     B:{connects:'Unió F‑F del registre d\'enllaç → entrada superior de l\'amplificador 3 (DAB, banda III).'}}});
RD({id:'cab_fm_int', fam:'xarxa', layer:'xarxes', tram:'capt', tech:'coax',
 name:'Cable coaxial interior d\'FM (PVC blanc)',
 what:'Tram interior, amb coberta de PVC blanca, que continua el cable del dipol circular d\'FM des de la seva unió F‑F fins a la capçalera.',
 purpose:'Porta la ràdio FM fins a l\'entrada d\'FM de la capçalera.',
 where:'Interior del RITS, dins del tub corrugat d\'entrada; a la centraleta, baixa pel costat esquerre fins a l\'entrada FM inferior.',
 connects:'Unió F‑F del registre d\'enllaç → entrada FM de la capçalera.',
 example:'Si l\'FM sona malament, l\'instal·lador comprova el nivell a l\'entrada FM sense afectar la TDT.',
 confusion:'L\'entrada FM no dona tensió d\'alimentació a l\'antena: el dipol circular és passiu.',
 canals:['rits_corr_in'], links:['rits_ff','capcalera','cab_fm'],
 vt:{A:{connects:'Unió F‑F del registre d\'enllaç → entrada FM (part inferior) de la centraleta programable.'},
     B:{connects:'Unió F‑F del registre d\'enllaç → entrada superior de l\'amplificador 4 (FM).'}}});
RD({id:'cab_sat_int', fam:'xarxa', layer:'xarxes', tram:'capt', tech:'coax', optional:true,
 name:'Cable coaxial interior de satèl·lit en reserva (PVC blanc)',
 what:'Tram interior, amb coberta de PVC blanca, que continua el cable de l\'LNB i acaba al costat de la capçalera amb un connector F tapat.',
 purpose:'Deixa la FI de satèl·lit preparada dins del RITS per a un futur barrejador TV‑SAT o una capçalera de FI.',
 where:'Interior del RITS, dins del tub corrugat d\'entrada; acaba penjant a l\'esquerra de la capçalera, amb una etiqueta.',
 connects:'Unió F‑F del registre d\'enllaç → extrem en reserva amb tap (no connectat a la capçalera terrestre).',
 example:'Quan la comunitat decideixi distribuir satèl·lit, només caldrà afegir l\'equip de FI i connectar-hi aquest cable.',
 confusion:'La capçalera terrestre (TDT, DAB i FM) no tracta la FI de satèl·lit (950–2150 MHz); per això el cable no hi entra.',
 canals:['rits_corr_in'], links:['rits_ff','cab_sat','capcalera']});
Object.assign(EL.reg_enllac_sup, {lid:true,
 name:'Passamurs i registre d\'enllaç superior',
 what:'Passamurs encastat a la paret lateral del RITS i caixa de registre interior amb tapa, on es fan les quatre unions F‑F entre els cables exteriors i els interiors.',
 where:'Paret esquerra del RITS, a la part alta. El passamurs travessa la paret; la caixa és a la cara interior.',
 connects:'Tub d\'enllaç superior → passamurs → registre (quatre unions F‑F: TDT, DAB, FM i satèl·lit) → tub corrugat d\'entrada.',
 confusion:'És un pas protegit i un punt d\'accés, no un amplificador. Les unions F‑F són dins, amb la tapa tancada; obre la tapa per veure-les.',
 links:['rits','rits_ff','rits_corr_in']});
Object.assign(EL.canal_enllac_sup, {
 what:'Dos tubs corrugats negres de Ø40 mm (RD 346/2011) que porten els cables d\'antena per la coberta fins al passamurs del RITS. Les boques exteriors estan girades cap avall (coll de cigne) perquè no hi entri l\'aigua.',
 where:'Coberta: des del peu de la torre d\'antenes, subjectat al terra amb suports i a la paret del RITS amb brides. Hi passen els quatre coaxials de captació.',
 links:['torre','reg_enllac_sup','rits']});
Object.assign(EL.xd_rtv, {
 what:'Són els dos cables coaxials que surten del repartidor de la capçalera, al RITS, i baixen per la canalització principal passant per tots els registres secundaris.',
 purpose:'Reparteix el senyal de ràdio i televisió per totes les plantes. Comença a les sortides del repartidor de la capçalera i acaba als derivadors.',
 where:'RITS (tub corrugat de sortida) → tub de RTV de la canalització principal → registres secundaris de la 4a a la 1a planta.',
 connects:'Uneix les dues sortides del repartidor de la capçalera amb els derivadors de cada planta. El darrer derivador de cada cable té la sortida final tancada amb una càrrega.',
 canals:['rits_corr_out','canal_principal'], links:['cap_rep','deriv_1','deriv_2','deriv_3','deriv_4']});
EL.canal_principal.links.push('rits_corr_out');

RD({id:'cab_sat2_int', fam:'xarxa', layer:'xarxes', tram:'capt', tech:'coax', optional:true,
 name:"Cable coaxial interior de satèl·lit B (PVC blanc)",
 what:"Tram interior, amb coberta de PVC blanca, que continua el cable de la sortida B de l'LNB des de la seva unió F‑F fins a l'amplificador de FI 2.",
 purpose:"Porta la FI de satèl·lit B fins a la capçalera.",
 where:"Interior del RITS, dins del tub corrugat d'entrada, amb els altres cables de captació.",
 connects:"Unió F‑F del registre d'enllaç → entrada de l'amplificador de FI 2.",
 example:"Si només falla el satèl·lit al cable de distribució 2, es comprova aquest cable i l'amplificador de FI 2.",
 confusion:"És un cable independent del de satèl·lit A: cada sortida de l'LNB té el seu.",
 canals:['rits_corr_in'], links:['rits_ff','cap_fi_2','cab_sat2']});
def({id:'cab_sat2', fam:'xarxa', layer:'xarxes', svc:'rtv', tram:'capt', tech:'coax', floor:5, zone:'comuna (coberta)', optional:true,
 name:"Cable coaxial de l'LNB · sortida B (exterior, PE negre)", sigla:'',
 what:"Segon cable coaxial d'exterior, de polietilè negre, que surt de la sortida B de l'LNB doble. Porta la FI de satèl·lit.",
 purpose:"Porta la segona FI de satèl·lit fins al RITS, on l'amplifica l'amplificador de FI 2.",
 where:"Baixa pel braç de l'LNB i pel suport de la parabòlica al costat del cable A, passa per la base de la torre i entra al tub d'enllaç superior.",
 connects:"LNB (sortida B) → tub d'enllaç superior → registre d'enllaç (unió F‑F) → amplificador de FI 2.",
 example:"Amb dues sortides de l'LNB, cada cable de distribució pot portar una FI diferent.",
 confusion:"Els dos cables de l'LNB fan el mateix camí però no porten el mateix senyal: cadascun surt d'una sortida diferent de l'LNB.",
 canals:['canal_enllac_sup'], links:['lnb','parabola','reg_enllac_sup','rits_ff','cab_sat2_int']});
Object.assign(EL.cab_sat, {name:"Cable coaxial de l'LNB · sortida A (exterior, PE negre)",
 what:"Cable coaxial d'exterior, de polietilè negre, que surt de la sortida A de l'LNB doble de la parabòlica. Porta la freqüència intermèdia (FI) de satèl·lit.",
 connects:"LNB (sortida A) → tub d'enllaç superior → registre d'enllaç (unió F‑F) → primer amplificador de FI de la capçalera.",
 example:"Si es treu la parabòlica, els amplificadors de FI es queden a la capçalera amb l'entrada lliure, preparats per quan es torni a connectar.",
 confusion:"La recepció per satèl·lit és opcional, però la capçalera del model ja té els dos amplificadors de FI: cada cable de l'LNB acaba en un d'ells."});
Object.assign(EL.cab_sat_int, {name:"Cable coaxial interior de satèl·lit A (PVC blanc)",
 what:"Tram interior, amb coberta de PVC blanca, que continua el cable de la sortida A de l'LNB des de la seva unió F‑F fins al primer amplificador de FI.",
 purpose:"Porta la FI de satèl·lit A fins a la capçalera.",
 where:"Interior del RITS, dins del tub corrugat d'entrada, amb els altres cables de captació.",
 connects:"Unió F‑F del registre d'enllaç → primer amplificador de FI (integrat a la centraleta o mòdul de FI 1, segons la capçalera).",
 example:"Si només falla el satèl·lit al cable de distribució 1, es comprova aquest cable i el primer amplificador de FI.",
 confusion:"Ja no queda en reserva: va connectat al primer amplificador de FI.",
 links:['rits_ff','cab_sat','cap_avant','cap_fi_1'],
 vt:{A:{connects:"Unió F‑F del registre d'enllaç → entrada SAT de la centraleta, que té l'amplificador de FI integrat."}, B:{connects:"Unió F‑F del registre d'enllaç → entrada de l'amplificador de FI 1."}}});
Object.assign(EL.lnb, {name:"LNB doble (convertidor de baix soroll, dues sortides)",
 what:"Capçal amb botzina i cos de plàstic situat al focus de la parabòlica, mirant cap al reflector, amb dues sortides F independents (A i B).",
 connects:"Reflector → LNB → sortida A (cable de satèl·lit A) i sortida B (cable de satèl·lit B).",
 confusion:"Cada sortida rep l'alimentació pel seu cable des de l'amplificador de FI corresponent de la capçalera.", links:['parabola','cab_sat','cab_sat2']});
EL.parabola.nets=['cab_sat','cab_sat2']; EL.parabola.connects="Reflector → LNB doble → dos cables coaxials (sortides A i B) → RITS.";
EL.torre.connects="Suporta el màstil (a la part superior), la parabòlica (en un lateral) i els cinc cables coaxials, subjectats amb brides a una de les cares."; EL.torre.links.push('cab_sat2');
Object.assign(EL.cab_capt, {confusion:"Cada sortida d'antena té el seu propi cable fins al RITS: els cinc coaxials comparteixen el tub d'enllaç, però no s'uneixen fins a la capçalera."});
Object.assign(EL.canal_enllac_sup, {where:"Coberta: des del peu de la torre d'antenes, subjectat al terra amb suports i a la paret del RITS amb brides. Pel primer tub hi passen els coaxials de TDT, DAB i FM; pel segon, les dues sortides de l'LNB.",
 connects:"Torre d'antenes → passamurs i registre d'enllaç superior → RITS. Hi passen cinc coaxials independents.", nets:['cab_capt','cab_dab','cab_fm','cab_sat','cab_sat2']});
Object.assign(EL.reg_enllac_sup, {what:"Passamurs encastat a la paret lateral del RITS i caixa de registre interior amb tapa, on es fan les cinc unions F‑F entre els cables exteriors i els interiors.",
 connects:"Tub d'enllaç superior → passamurs → registre (cinc unions F‑F: TDT, DAB, FM, SAT A i SAT B) → tub corrugat d'entrada.", nets:['cab_capt','cab_dab','cab_fm','cab_sat','cab_sat2']});
Object.assign(EL.rits_ff, {name:"Unions F‑F (transició exterior‑interior, 5)",
 what:"Cinc adaptadors F femella‑femella, un per cable (TDT, DAB, FM, SAT A i SAT B). A cadascun s'hi rosquen dos connectors F mascle: el del cable exterior negre i el del cable interior blanc.",
 connects:"Per a cada cable: exterior (PE negre) ↔ interior (PVC blanc). Els cinc senyals continuen separats."});
EL.rits_ff.links.push('cab_sat2','cab_sat2_int');
EL.rits_corr_in.nets.push('cab_sat2_int');
Object.assign(EL.rits_corr_out, {what:"Tub corrugat negre que recull els dos cables de distribució a les sortides de la capçalera i els porta fins al tub de RTV de la canalització principal.",
 where:"Interior del RITS: de sota del mesclador, per la part baixa de la paret del fons, fins al pas del forjat.",
 connects:"Sortides de la capçalera (mesclador i, amb centraleta, també la sortida TV+SAT) → tub de RTV de la canalització principal. Allotja els dos cables de distribució.",
 example:"Amb «Destacar sortides de distribució» es ressalten les sortides de la capçalera, aquest tub i els dos cables que baixen per l'edifici.", links:['cap_mix','canal_principal']});
Object.assign(EL.rits_suport, {connects:"Suporta l'equip de capçalera, els amplificadors de FI i el mesclador. Està connectada a la barra de terra.", links:['capcalera','cap_mix','rits_equip']});
Object.assign(EL.rits_equip, {where:"Des de la barra col·lectora fins a la safata, la placa, el mesclador, el quadre i el borne de l'equip de capçalera.",
 connects:"Barra col·lectora ↔ safata, placa de muntatge, mesclador, quadre i capçalera.",
 example:"El cargol de terra del mesclador es connecta a la barra perquè la malla dels coaxials quedi al mateix potencial.", links:['rits_terra','rits_safata','rits_suport','cap_mix']});
EL.rits_terra.connects=EL.rits_terra.connects.replace('el repartidor','el mesclador');
Object.assign(EL.capcalera, {
 what:"Conjunt d'equips que adapten els senyals de les antenes abans de distribuir-los: amplificació, filtratge, alimentació i mescla de senyals terrestres i de satèl·lit.",
 connects:"Entrades: cables interiors de TDT, DAB, FM i les dues sortides de l'LNB (SAT A i SAT B). Hi ha dos amplificadors de FI encara que no hi hagi parabòlica. Sortides: dos cables de distribució, cadascun amb el senyal terrestre i una FI de satèl·lit.",
 example:"Prova a canviar el «Tipus de capçalera» al panell del RITS: el model reconstrueix els equips i les connexions.",
 nets:['cab_capt_int','cab_dab_int','cab_fm_int','cab_sat_int','cab_sat2_int','cap_jump'], links:['cap_mix','rits_suport','rits'],
 vt:{A:{name:"Equip de capçalera de RTV · centraleta programable amb FI", what:"Capçalera feta amb una centraleta programable amb FI integrada (exemple: Televes AVANT 12 PRO SAT, ref. 532204), un segon amplificador de FI (T12, ref. 508012) amb la seva font i un mesclador MATV‑FI (ref. 745210). Cable 1: sortida TV+SAT de la centraleta. Cable 2: sortida TV de la centraleta + FI del segon amplificador, pel mesclador."},
     B:{name:"Equip de capçalera de RTV · amplificadors monocanal", what:"Capçalera modular T12: deu amplificadors monocanal de TDT (una sola entrada des de l'antena UHF i ponts F en Z), un mòdul de DAB i un d'FM amb la seva antena cadascun, dos amplificadors de FI (ref. 508012), dues fonts de 24 V i un mesclador TERR + 2 SAT (ref. 740710). Cable 1: TERR + SAT A. Cable 2: TERR + SAT B."}}});
Object.assign(EL.xd_rtv, {what:"Són els dos cables coaxials que surten de la capçalera, al RITS, i baixen per la canalització principal passant per tots els registres secundaris. Cadascun porta els senyals terrestres i una FI de satèl·lit.",
 purpose:"Reparteix el senyal de ràdio i televisió per totes les plantes. Comença a les sortides de la capçalera i acaba als derivadors.",
 connects:"Uneix les dues sortides de la capçalera amb els derivadors de cada planta. El darrer derivador de cada cable té la sortida final tancada amb una càrrega.",
 links:['cap_mix','deriv_1','deriv_2','deriv_3','deriv_4']});
EL.rits.connects=EL.rits.connects.replace('capçalera i repartidor','capçalera (amplificadors, amplificadors de FI i mesclador)');
EL.cab_dab_int.vt.B={connects:"Unió F‑F del registre d'enllaç → entrada del mòdul amplificador de DAB (banda III)."};
EL.cab_fm_int.vt.B={connects:"Unió F‑F del registre d'enllaç → entrada del mòdul amplificador d'FM."};
EL.cab_capt_int.vt.B={connects:"Unió F‑F del registre d'enllaç → filtre LTE/5G → entrada del mòdul de TDT 1, l'única entrada de TDT de la capçalera."};
EL.cap_avant.vt={A:{}};
EL.cap_carregues.vt={A:{where:"Entrades 3 i 4 de la centraleta (amb bloqueig de CC, ref. 4061).", connects:"Entrades lliures de la centraleta."},
 B:{where:"Entrada lliure del mòdul de TDT 10, de la DAB i de l'FM (amb bloqueig de CC, ref. 4061) i sortida lliure del mòdul de TDT 10 (ref. 4058).", connects:"Extrems lliures de la cadena de ponts en Z."}};

Object.assign(EL.cap_mix.vt.B, {
 what:"Mesclador passiu en xassís de zamac de fosa (98 × 76 × 27 mm, 194 g) amb cinc connectors F. A dalt hi ha les tres entrades: SAT/A, TER i SAT/B. A baix, les dues sortides cap als cables de distribució: SAT/A + TER (esquerra) i SAT/B + TER (dreta); la posició central inferior del motlle no s'utilitza i porta un tap de plàstic negre. L'etiqueta frontal indica el pas de corrent continu (DC) de cada sortida cap a la seva entrada SAT. Té dues orelles posteriors amb forat per fixar-lo a la placa.",
 where:"Placa de muntatge del RITS, a la part baixa dreta, just damunt del tub corrugat de sortida.",
 connects:"Entrada TER ← sortida MATV dels mòduls (latiguillo). Entrada SAT/A ← amplificador de FI 1. Entrada SAT/B ← amplificador de FI 2. Sortida SAT/A + TER → cable de distribució 1 (blanc). Sortida SAT/B + TER → cable de distribució 2 (negre). La connexió equipotencial es fa amb un terminal d'anella al cargol de fixació.",
 example:"Bandes: TER 47‑790 MHz i SAT 950‑2400 MHz. Pèrdues d'inserció d'exemple: 5,5 dB a la via terrestre (es reparteix a les dues sortides) i 1 dB a la de satèl·lit. Aïllament TER→SAT > 30 dB i SAT→TER > 28 dB.",
 confusion:"La FI no es reparteix: la sortida esquerra només porta SAT/A i la dreta només SAT/B; el senyal terrestre, en canvi, surt per totes dues. El pas de corrent continu (de cada sortida cap a la seva entrada SAT) serveix quan l'LNB s'alimenta des de la xarxa; en aquesta capçalera l'alimenten els amplificadors de FI."});
/* contenidors inversos (es calculen a init(), quan ja s'han definit tots els elements del model) */
function linkChildren(){
  for (const e of Object.values(EL)) e.children = [];
  for (const e of Object.values(EL)) if (e.parent) EL[e.parent].children.push(e.id);
}

/* ---------------- Conceptes clau ---------------- */
const CONCEPTS = [
 ['ICT', 'Infraestructura comuna de telecomunicacions: xarxes, canalitzacions, recintes i registres comuns que permeten l\'accés als serveis de telecomunicació a l\'interior de l\'edifici.'],
 ['Recinte, registre i punt de connexió', '<b>Recinte:</b> espai (local o armari) que allotja equips i registres (RITI, RITS).<br><b>Registre:</b> envoltant o caixa que facilita l\'allotjament, l\'accés o el pas dels cables (registre principal, secundari, de terminació de xarxa, de presa).<br><b>Punt de connexió:</b> element o interfície on s\'uneixen o acaben trams de xarxa (punt d\'interconnexió, punt de distribució, PAU, BAT).'],
 ['Xarxa i canalització', 'La <b>xarxa</b> són els cables i els elements de connexió (el que porta el senyal). La <b>canalització</b> són els tubs i canals que els allotgen (el camí). Un tub buit és canalització sense xarxa.'],
 ['Tram de xarxa i tecnologia', '<b>Alimentació, distribució, dispersió i interior</b> descriuen la funció del tram dins de la instal·lació. <b>Fibra òptica, coaxial i parells trenats</b> descriuen el mitjà de transmissió. Un mateix tram pot tenir cables de tecnologies diferents.'],
 ['Els quatre trams', '<b>Alimentació:</b> de l\'operador fins al punt d\'interconnexió (RITI) o, en RTV, de les antenes a la capçalera.<br><b>Distribució:</b> del punt d\'interconnexió o la capçalera fins als punts de distribució de cada planta.<br><b>Dispersió:</b> del punt de distribució fins al PAU de cada habitatge.<br><b>Interior d\'usuari:</b> del PAU fins a les BAT, en estrella.'],
 ['Zones de la ICT', '<b>Exterior:</b> arqueta d\'entrada i canalització externa.<br><b>Comuna:</b> del punt d\'entrada general fins als PAU.<br><b>Privada:</b> xarxa interior de cada usuari (després del PAU).'],
 ['RITU', 'Recinte únic que acumula les funcions de RITI i RITS. Admès en edificis de fins a tres plantes i planta baixa amb un màxim de deu PAU, i en conjunts unifamiliars. No s\'aplica a l\'edifici del model.'],
 ['RITM', 'Realització modular dels recintes amb armaris no propagadors de la flama, admesa en edificis de fins a 45 PAU i conjunts unifamiliars de fins a 20 PAU, amb les condicions de protecció corresponents.'],
 ['Derivador, repartidor i capçalera', '<b>Capçalera:</b> equips del RITS que adapten els senyals de les antenes. <b>Derivador:</b> a la zona comuna, treu senyal del cable de distribució cap als habitatges d\'una planta. <b>PAU + repartidor:</b> dins de l\'habitatge, en un sol element, rep els cables de dispersió (una entrada carregada) i reparteix el senyal cap a les preses.'],
 ['Preses de l\'habitatge', 'Dotació mínima en un habitatge: <b>RTV</b>, una presa per estància (excepte banys i trasters, mínim dues). <b>Parells trenats</b>, dos registres a cada estància principal i un a la resta; a la sala, una BAT doble a menys de 50 cm de la presa de fibra, i una altra BAT doble en una altra estància. <b>Coaxial de TBA</b>, dues preses en dues estàncies diferents. <b>Fibra òptica</b>, una presa a una estància principal, preferiblement la sala d\'estar. A prop del PAU, un registre de presa configurable.'],
 ['PAU, ONT i encaminador', 'El <b>PAU</b> és la frontera entre la xarxa comuna i la interior. L\'<b>ONT</b> converteix la llum de la fibra en senyal elèctric. L\'<b>encaminador</b> crea la xarxa local. ONT i encaminador són equips associats al servei de l\'usuari, no part de la ICT comuna.']
];

/* ---------------- Activitats ---------------- */
const QUIZ = [
 {type:'pick', q:'Localitza el RITI al model o a la llista d\'elements.', ok:id=>id==='riti',
  hint:id=> id==='rits' ? 'Has triat el RITS, el recinte superior de la coberta (RTV). El RITI és el recinte inferior, a la planta baixa.' : id==='rp_fo'||id==='rp_pt' ? 'Has triat un registre principal, que és a dins del RITI. Selecciona el local sencer.' : 'Aquest no és el RITI. Busca un local a la planta baixa, al costat del vestíbul, d\'on surt la canalització principal.',
  good:'Correcte! El RITI és el local de la planta baixa que allotja els registres principals.'},
 {type:'pick', q:'Selecciona una canalització secundària (de qualsevol habitatge).', ok:id=>/^cs_/.test(id),
  hint:id=> /^xs/.test(id) ? 'Has triat els cables de dispersió (xarxa). La canalització és el tub que els allotja.' : id==='canal_principal' ? 'Aquesta és la canalització principal (vertical). La secundària va horitzontal fins als habitatges.' : /^ci_/.test(id) ? 'Aquesta és la canalització interior d\'usuari. La secundària va del registre secundari al registre de terminació de xarxa.' : 'Busca els tubs horitzontals que surten del registre secundari cap als habitatges.',
  good:'Correcte! La canalització secundària va del registre secundari al registre de terminació de xarxa.'},
 {type:'pick', q:'Troba un PAU de l\'habitatge 2n A.', ok:id=>/^pau_(rtv|fo|pt)_2A$/.test(id),
  hint:id=> id==='rtr_2A' ? 'Has triat el registre de terminació de xarxa, que és la caixa. El PAU és a dins: obre\'l amb el botó «Obrir» del panell.' : /ont|router/.test(id) ? 'Aquest és un equip de l\'usuari, no el PAU. El PAU és dins del registre de terminació de xarxa.' : 'Obre el menú «Vistes», tria la 2a planta i la porta A i prem «Veure l\'habitatge». Després obre el registre del rebedor i tria un dels punts que hi ha a dins.',
  good:'Correcte! Has trobat un PAU, dins del registre de terminació de xarxa.'},
 {type:'mcq', q:'Què és una BAT i on s\'allotja?', opts:[
   'Una caixa encastada que allotja els cables de l\'habitatge.',
   'El connector on l\'usuari connecta l\'equip terminal; s\'allotja dins del registre de presa.',
   'El punt on acaba la xarxa de dispersió, dins del registre de terminació de xarxa.',
   'Un equip actiu que reparteix el senyal entre les estàncies.'], ok:1,
  why:['Això és el registre de presa: la caixa. La BAT és el connector que hi ha a dins.','','Això és el PAU, no la BAT.','Els elements que reparteixen (repartidor, encaminador) no són la BAT. La BAT és un connector passiu.'],
  good:'Correcte! La BAT és la presa; el registre de presa és la caixa que l\'allotja.'},
 {type:'mcq', q:'Quina és la diferència entre el registre de terminació de xarxa i el PAU?', opts:[
   'Són el mateix element amb dos noms.',
   'El registre de terminació de xarxa és la caixa; el PAU és el punt de connexió que hi ha a dins.',
   'El PAU és a la zona comuna i el registre és dins de l\'habitatge.',
   'El registre de terminació de xarxa és l\'ONT de l\'operador.'], ok:1,
  why:['No: un és un contenidor i l\'altre un punt de connexió.','','Tots dos són dins de l\'habitatge: el PAU és dins del registre.','L\'ONT és un equip de l\'usuari; el registre és una caixa de la ICT.'],
  good:'Correcte! La caixa (registre) allotja el punt de connexió (PAU).'},
 {type:'pick', q:'Troba la presa de fibra òptica (BAT òptica) d\'un habitatge qualsevol.', ok:id=>/^(bat|rp)_fo_sala_/.test(id),
  hint:id=> /^pau_fo_/.test(id) ? 'Aquest és el PAU de fibra, al registre de terminació de xarxa. La presa òptica és a l\'estància principal.' : /^ont_/.test(id) ? 'Aquesta és l\'ONT, l\'equip que s\'hi connecta. Busca la presa de la paret, just a sota.' : /^(bat|rp)_dat/.test(id) ? 'Aquesta és una presa RJ45 de parells trenats. La presa òptica és al seu costat, a menys de 50 cm.' : 'Pista: la normativa la situa a una estància principal, preferiblement la sala d\'estar, a prop de la BAT RJ45 doble.',
  good:'Correcte! La presa òptica és a la sala d\'estar, a prop de la BAT RJ45 doble, i permet tenir l\'ONT i l\'encaminador a l\'estància principal.'},
 {type:'mcq', q:'Quantes preses de RTV ha de tenir un habitatge amb sala d\'estar, cuina, dos dormitoris i un bany?', opts:['Dues: una a cada estància principal.','Quatre: una per estància, sense comptar el bany.','Cinc: una per estància, bany inclòs.','Una, al costat del PAU.'], ok:1,
  why:['Dues és el mínim, però la norma demana una presa per estància (excepte banys i trasters).','','El bany i el traster no es compten.','Al costat del PAU hi ha el registre configurable, no la presa de RTV.'],
  good:'Correcte! Una presa de RTV per estància, excepte banys i trasters: sala, cuina i dos dormitoris.'},
 {type:'pick', q:'Al RITS, localitza la barra col·lectora de terra.', ok:id=>id==='rits_terra',
  hint:id=> id==='rits_equip' ? 'Has triat una connexió equipotencial. Segueix-la fins a la barra de coure on acaben totes.' : id==='rits_quadre' ? 'Aquest és el quadre de protecció elèctrica. La barra de terra és a la paret del fons, a la part alta.' : /^cap_|capcalera/.test(id) ? 'Això és part de la capçalera. Busca l\'anell verd i groc i la barra de coure, a la part alta de la paret del fons.' : 'Obre el RITS amb «Interior del RITS» i busca la barra de coure a la part alta de la paret del fons, a l\'esquerra.',
  good:'Correcte! A la barra col·lectora hi arriben l\'anell de terra, les connexions equipotencials i el conductor cap a la terra general de l\'edifici.'},
 {type:'order', q:'Ordena els trams de la xarxa de fibra, des de l\'operador fins a l\'usuari.', items:['Dispersió','Interior d\'usuari','Alimentació','Distribució'], ok:['Alimentació','Distribució','Dispersió','Interior d\'usuari'],
  bad:'Encara no. Recorda: l\'operador arriba fins al RITI (alimentació), puja per l\'edifici (distribució), entra a l\'habitatge (dispersió) i es reparteix per les estàncies (interior).',
  good:'Correcte! Alimentació → distribució → dispersió → interior d\'usuari.'}
];

const SIMPLIFICATIONS = [
 'Model didàctic simplificat. La configuració real depèn del projecte i de la normativa aplicable.',
 'Els tubs tenen el diàmetre normatiu (RD 346/2011). Fora del RITS, caixes i alguns equips petits estan ampliats per poder-los veure i seleccionar (no el PAU de fibra, els adaptadors i connectors SC/APC ni el multiplexor, que són a mida real); els cables, en canvi, tenen el diàmetre real d\'una referència comercial documentada: coaxial RG-6 Ø6,6 mm (també latiguillos i RITS), escomesa de 2 fibres Ø3,8 mm, cable de distribució de fibra Ø8 mm (el d\'un cable interior de 48 fibres, coherent amb el panell de sortida de 48 connectors), latiguillos de fibra Ø2 mm, mànega de 50 parells Ø14,4 mm, escomesa de 2 parells Ø4 mm i Cat 6 Ø6,2 mm. Els cables fins es poden seleccionar igualment: la zona de clic és un volum invisible més gruixut.',
 'Les corbes dels cables són arcs amb el radi mínim de curvatura de cada tipus (RG-6 33 mm, fibra d\'escomesa 18 mm, fibra de distribució 80 mm, mànega 144 mm, Cat 6 25 mm). Dins dels tubs, cada cable segueix el camí del tub desplaçat, amb el mateix radi, i no en surt. Al RITS, dins dels corrugats d\'entrada i als ponts entre mòduls, i a l\'entrada dels cables de l\'operador a les CTO del RITI, algunes corbes queden per sota del mínim perquè l\'espai del model no dona per més.',
 'Registre secundari: els coaxials van per carrils arran de la placa del fons i pugen junt a les parets; la fibra i els parells de dispersió hi passen per davant; els baixants entren i surten dels tubs en posicions fixes. Sangrat de la mànega: es representa una finestra de 16 cm amb la coberta oberta, 8 grups de parells en pas (en lloc dels 40, 30, 20 o 10 parells reals) i els 10 parells de la planta, trenats, que entren per sota a la regleta; les escomeses en surten per dalt.',
 'Per defecte els cables tenen un aspecte real habitual: els dos coaxials de distribució de RTV es distingeixen pel color (cable 1 blanc, cable 2 negre, també a la dispersió), la fibra és groga i els connectors SC/APC verds. Les opcions «per tram» i «per tecnologia» són un codi didàctic d\'aquesta aplicació. Cap color és obligatori.',
 'Les canalitzacions tenen el nombre de tubs i el diàmetre del RD 346/2011; els tubs es dibuixen translúcids i llisos (sense corrugat), excepte a la coberta i al RITS.',
 'Tots els habitatges tenen la mateixa distribució (sala d\'estar, cuina, dos dormitoris, bany i rebedor; els B, C i D són simètrics de l\'A respecte dels eixos de l\'edifici) i la dotació mínima de preses: 4 de RTV, 6 registres de parells trenats (2 amb BAT doble), 2 coaxials de TBA, 1 de fibra òptica a la sala i 1 registre configurable. Les preses de corrent properes no es dibuixen.',
 'Les preses s\'han situat de manera orientativa. En un projecte real la posició depèn del mobiliari previst i de les distàncies que fixa la normativa.',
 'La xarxa de distribució de fibra es mostra com un sol cable multifibra. Configuració escollida: empalmament a la caixa de segregació de cada planta i fibres en pas per a les altres plantes.',
 'La xarxa comuna de parells segueix l\'opció de cables de parells del RD 346/2011 (mànega multiparell i regletes), la més habitual en edificis existents; la xarxa interior és de parells trenats.',
 'No es representa la xarxa de distribució i dispersió coaxial de TBA (es considera que no hi ha operador de cable: el tub de la canalització secundària queda amb fil guia). Sí que es representa la xarxa interior coaxial de TBA fins al PAU + repartidor 2D del registre de terminació de xarxa, amb l\'entrada tancada amb una càrrega de 75 Ω. No es representa la xarxa d\'accés sense fils (SAI). La presa de terra i l\'alimentació elèctrica només es detallen al RITS.',
 'Els envans interiors es mostren a mitja alçada per veure l\'interior. El RITI es representa tancat amb dues portes abatibles, com un armari. El RITS és un recinte d\'obra amb porta metàl·lica; el sostre i la paret frontal es poden retirar des del panell «Configuració del RITS».',
 'RITS: el recinte, els equips, els connectors i els cables de dins són a escala real (mides dels catàlegs del fabricant). Els equips són exemples comercials documentats (Televes), no una recomanació; les formes dels connectors i les posicions dels ports són aproximades.',
 'RITS: els colors dels cables i tubs són els d\'una instal·lació real habitual (exterior PE negre, interior PVC blanc, corrugat negre, tub elèctric gris); és una tria de representació, no una obligació. Fora del RITS els cables tornen al codi de colors didàctic de la llegenda.',
 'RITS: els canals dels amplificadors monocanal (23, 26, 27, 29, 32, 34, 36, 38, 40 i 45) són d\'exemple. Els ponts F de 48 mm (ref. 5074) uneixen en Z l\'entrada o sortida superior d\'un mòdul amb la inferior del mòdul de la dreta; l\'ordre exacte s\'ha de verificar al manual d\'instal·lació.',
 'RITS: la posició de l\'anell de terra, del quadre i de les bases és una decisió del model. No s\'han verificat les dimensions mínimes, el nivell d\'il·luminació (lux), la renovació d\'aire ni la resistència de terra: el model no certifica el compliment del reglament.',
 'Edifici: soterrani d\'aparcament (16 places), planta baixa amb vestíbul, RITI, local de serveis i botiga, quatre plantes de quatre habitatges (A, B, C i D) i coberta amb el RITS. La distribució s\'inspira en tipologies habituals d\'edificis plurifamiliars amb nucli d\'escala i ascensor centrals; és orientativa i no és un projecte arquitectònic ni comprova el CTE, l\'accessibilitat ni la normativa urbanística.',
 'L\'interior de tots els habitatges té la mateixa ICT. El 2n A té més mobiliari per fer-lo més reconeixible; la resta en tenen una versió bàsica. L\'ascensor es representa amb el pou, les portes de replà i la cabina, que apareix a la planta on es crida; no se\'n simula el moviment.'
];

