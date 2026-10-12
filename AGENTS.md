# Guía para agentes de IA — ICT · Explora l'edifici

Simulador 3D didáctico de la **ICT** (infraestructura común de telecomunicaciones, RD 346/2011). Tiene dos modelos con
la misma interfaz, que se eligen con el selector «Edifici / Cases adossades» de la cabecera:

- **Edificio** plurifamiliar (`index.html`): RITI en planta baja y RITS en la cubierta.
- **Casas adosadas** (`cases.html`): cuatro casas con aparcamiento subterráneo comunitario y un **RITU** (ver
  «Modelo de casas adosadas»).

Página web estática publicada con GitHub Pages en <https://ddelapaz1.github.io/edifici_ict/>.

## Estructura

| Archivo | Contenido | ¿Se edita? |
|---|---|---|
| `index.html` | Página del edificio: marcado de la interfaz y carga de los scripts | **Sí** |
| `cases.html` | Página de las casas adosadas (mismo marcado, con `data-model="cases"` y sus vistas) | **Sí** |
| `css/ict.css` | Estilos de la interfaz (compartidos) | **Sí** |
| `js/dades.js` | Datos: `UNITS`, `SERVICES`, `TRAMS`, `TECHS`, registro `EL`, `CONCEPTS`, `QUIZ`, `SIMPLIFICATIONS` | **Sí** |
| `js/app.js` | Aplicación: geometría, interfaz, visibilidad, selección, etiquetas y arranque (`init()`) | **Sí** |
| `js/dades-cases.js` | Datos del modelo de casas (solo `cases.html`): casas, registros secundarios, textos del RITU | **Sí** |
| `js/cases.js` | Construcción del modelo de casas (solo `cases.html`): sustituye `buildArchitecture`, `buildICT`… | **Sí** |
| `vendor/three.min.js` | Three.js r160 (UMD, define el global `THREE`) | **No** |
| `vendor/OrbitControls.js` | OrbitControls de Three.js adaptado a script clásico | **No** |
| `models/` | Modelos glTF de los equipos (`*.glb`) y sus fuentes (`src/`: `.blend`, texturas, scripts de Blender). Ver `models/README.md` | Sí (regenerando con los scripts) |
| `.github/workflows/static.yml` | Despliegue a GitHub Pages en cada push a `main` (sube toda la carpeta) | Solo si hace falta |

No hay *build*, ni npm, ni módulos ES: los `<script>` son clásicos y comparten el ámbito global.
Cualquier archivo nuevo que necesite la web debe ir dentro del repositorio y referenciarse con **ruta relativa**
(nada de CDN), para que funcione igual en local y en GitHub Pages.

Los scripts se cargan en este orden: `vendor/*`, `js/dades.js`, (`js/dades-cases.js`), `js/app.js`, (`js/cases.js`) y, al
final, `loadModels().finally(init)` (inline en la página). Los cambios en `js/app.js` y `js/dades.js` afectan a los dos
modelos: compruébalos en las dos páginas.

1. **Datos** (`js/dades.js`): `UNITS`, `SERVICES`, `TRAMS`, `TECHS` y el registro `EL` de elementos, creados con
   `def({...})`, `RD(...)` (elementos del RITS) y `RE(...)`. Cada elemento tiene `id`, `fam`, `layer`, `svc`, `floor`,
   `parent` y los textos de la ficha (`name`, `what`, `purpose`, `where`, `connects`, `example`, `confusion`), además
   de `nets`, `canals` y `links`. También `CONCEPTS`, `QUIZ` (modo «Comprova què has après») y `SIMPLIFICATIONS`.
2. **Aplicación** (`js/app.js`): geometría, interfaz, visibilidad, selección, etiquetas y arranque (`init()`).

## Cómo se construyen los modelos 3D

La mayor parte es **geometría procedural** de Three.js; los equipos principales son **modelos glTF** (ver más abajo). Cada pieza se crea con funciones auxiliares que la
registran con el `id` de un elemento de `EL`; esto es lo que hace funcionar la selección con clic, el resaltado, la
ficha, las capas y los filtros. **No crees `new THREE.Mesh` sueltos añadidos a la escena**: usa siempre estas
funciones.

Primitivas básicas (material Lambert, para elementos esquemáticos):

- `ictMesh(geo, color, elId, o)` — malla genérica registrada al elemento.
- `iBox(elId, w, h, d, x, y, z, color, o)` — caja centrada en (x, y, z).
- `iCyl(elId, r, h, x, y, z, color, axis, o)`, `regBox(...)` (registro con tapa), `tube(...)` (canalización).
  Los tubos entran un pequeño tramo dentro de cada registro o recinto (`DINS` = 2,5 cm; 1–1,8 cm donde el registro es
  poco profundo o los cables giran cerca) y `o.mouth` (0, 1 o 2) dibuja un collar en esas bocas (se fusionan en
  `flushMouths()`). El cable debe salir **recto** por la boca y girar ya fuera del tubo.
- `cable(key, elId, pts, o)` — cable con datos de conexión (`from`, `to`, `via`); el color depende del modo. El diámetro y
  el radio mínimo de curvatura salen de `CBL` según la clave (`CBL_KEY`); no pases `r` salvo casos especiales.
  Los puntos pueden ser `[x,y,z,R]` (radio propio de esa esquina). `inTube(pts, v, R)` da el camino de un tubo
  desplazado `v` con el mismo radio: así el cable no sale del tubo ni en las curvas.

Primitivas «realistas» (material físico; requieren `ritsMats()`, que se ejecuta en `buildRITS()`):

- `rBox(el, x0, x1, y0, y1, z0, z1, color, mat, o)` — caja definida por sus límites.
- `rCyl(el, r, h, pos, dir, color, mat, o)`, `rHex(...)` (prisma hexagonal), `rPlane(el, w, h, pos, normal, tex, o)`.
- `rCable(...)` (RG-6, arcos de 33 mm), `polyR(...)`, `fFemale` / `fMale` / `fLoad` (conectores F), `rj45(...)` (RJ45 macho),
  `rrectGeo(...)` (rectángulo redondeado extruido), `mergeParts(...)` (fusiona geometrías en una sola malla).
- Materiales (`mat`): `'plastic'`, `'zamak'`, `'zamakDark'`, `'nickel'`, `'galv'`, `'steel'`, `'pvc'`, `'rubber'`,
  `'copper'`… (ver `ritsMats()`).
- Textos y serigrafías: `textTex(lines, o)` o `canvasTex(w, h, draw)` pegados con `rPlane`.

Opciones habituales en `o`: `{pick:true}` (seleccionable), `{pick:false}` (decorativo), `{opacity}`, `{cast:true}`
(proyecta sombra), `{lidOf:id}` (tapa practicable), `{led:0xRRGGBB}`.

**Modelos glTF:** ver la sección «Modelos glTF de los equipos».

Si un modelo tiene muchas piezas pequeñas, fusiónalas (`mergeParts`, colores por vértice) para no multiplicar
mallas: el edificio ya tiene unas 4.700.

### Rendimiento: qué no se dibuja

Bloque «RENDIMENT» antes de `loop()` en `js/app.js`:

- **Dibujo a demanda**: `loop()` solo dibuja si la cámara se ha movido, hay una animación (vuelo, puertas y tapas,
  zoom con la rueda) o se ha llamado a `invalidate()`. `applyMaterials()`, `onResize()`, `shadowRefresh()` y cualquier
  evento de ratón o teclado ya lo hacen. **Si cambias la escena desde otro sitio (un temporizador, una carga
  asíncrona…), llama a `invalidate()`** o no se verá hasta que se mueva la cámara.
- **Oclusión**: lo que cabe entero dentro de un registro (`e.lid`, menos los recintos RITI/RITS, que no son cajas
  cerradas) no se dibuja si la tapa está cerrada y la cámara fuera (`OCC`, `occClosed()`).
- **Detalle**: no se dibujan las mallas con radio en pantalla < `OCC.px` (1 px CSS).
- Las mallas solo se ocultan durante `renderer.render()` (`cullBegin()`/`cullEnd()`): `m.visible` sigue siendo el de
  la aplicación. `scene.matrixWorldAutoUpdate` es `false`: las matrices se actualizan en `cullBegin()`.

### Dónde está cada cosa (busca por nombre de función)

| Zona | Funciones |
|---|---|
| Arquitectura del edificio | `buildArchitecture()` y siguientes (`buildGroundFloor`, `buildResidentialFloor`…) |
| ICT general, RITI, registros secundarios | `buildICT()` |
| CTO de fibra del RITI | `CTO_FO`, `ctoBox()`, `buildRITIFibre()` |
| Repartidores Krone (STDP) | `KR`, `kroneModule()`, `kroneColumn()`, `buildRITIPairs()` |
| Viviendas y RTR (PAU, roseta, multiplexor) | `buildUnit()`, `buildInterior()`, `MUX`, `rj45()` |
| RITS (recinto, entrada, cabecera) | `buildRITSRoom()`, `buildRITSEntry()`, `buildCapVariant(v)` (variante `'A'` central programable / `'B'` monocanales T12), `buildMix740710()` |
| Derivadores de RTV (registros secundarios) | `TAPF` (pérdida por planta, en el bloque de datos), `DER`, `DPX`, `DERPORT`, bucle de registros secundarios en `buildICT()` |
| Mánega de 50 pares y sangrado | `PT50`, `buildPairRiser()`, `pairWindow()`, `PAIRC` |
| Conectores F y cargas | `fFemale()`, `fMale()`, `coaxPlug()` (modelo 417101), `fLoad()` (modelo 4061) |
| PAU de RTV en la vivienda (519534) | `PRD`, `pauRtvPos()`; cables de dispersión en `buildUnit()` (bucle en U por debajo) |
| PAU de TBA coaxial en la vivienda (519602, `div_tba_*`) | `PTD`, `pauTbaPos()`; salidas `TBAOUT`/`TBATAIL` en `buildInterior()` |
| Fibra en la vivienda (PAU 231502, SC/APC) | `pauFoPos()`, `scQuat()`, `scAdapter()`, `scPlug()`; presa óptica en el bucle de `PRESES` de `buildInterior()` |
| Modelos glTF | `MODELS`, `loadModels()`, `placeModel()`, `modelPoint()` (al final del segundo `<script>`) |
| Paisaje de fondo | `skyTexture()`, `buildMountains()`, `buildLandscape()`, `landscapeVisibility()` |
| Antenas | `buildAntennas()` |
| Cotxes (Tesla Model 3, Corolla, RAV4, A4 Avant; colors per vèrtex, material `AM.carV`) | `CARS`, `carBody()`, `carClass()`, `carModel(x,y,z,dir,type,mat,o)` |

### Cables: diámetros y curvas

- `CBL` (antes de `cable()`) centraliza diámetro `d` y radio mínimo `rb` de cada tipo, con la referencia comercial
  citada en el comentario. Three.js recibe **radios** (`d/2`).
- `polyCurve(pts, cr, R, tag)`: con `R` las esquinas son arcos tangentes de ese radio (radio físico real); si el tramo
  no da para tanto, el radio se reduce y se anota en `BEND` (`__ICT.BEND` con `?debug`). Sin `R`, esquina Bézier
  (tubos y caminos antiguos). `pathSamples()` + `sweepGeo()` sustituyen a `TubeGeometry`: tramos rectos con dos anillos
  y arcos cada 7,5°.
- Registro secundario: constantes `RSW`, `TAPR`, `RISE`, `CSEG`, `RSK`, `PT50` (ver comentario junto a `RSK`).
- Canalización secundaria: tramo comunitario (4 × Ø25, `CSC`, `cscPath()`, `buildSecTrunk()`), registro de pas `RPS` y
  acceso a cada vivienda (3 × Ø25, `csPath()`). Desplazamiento de los cables en los tubos: `cscV()` (tramo comunitario) y
  `cscW()` (acceso), elegidos para que no se crucen en el registro secundario ni en el de pas.
  Mánega de 50 pares: `buildPairRiser()` y `pairWindow()` (sangrado). RTR: capas `LAY` en `buildInterior()`.
- Tras tocar recorridos, comprueba `__ICT.BEND` y que no haya interpenetraciones (muestras en `G.cables[k].sm`, radio
  en `G.cables[k].r`).

## Modelo de casas adosadas (`cases.html`)

Reutiliza todo el código del edificio. `js/dades.js` lee `MODEL` (atributo `data-model` de `<html>`) y, si no es
`'edifici'`, no crea las plantas ni las viviendas; `js/dades-cases.js` crea las casas (`defUnit(u)`), los registros
secundarios y cambia los textos (`CFG` guarda los parámetros de la interfaz que dependen del modelo). `js/cases.js` se carga
después de `js/app.js` y **redefine funciones** (`buildArchitecture`, `buildLandscape`, `buildICT`, `buildRefs`, `setView`,
`UB`) y amplía `VIEWS`.

- **Disposición** (`KC`): casas entre x = −20 y 20 (casa 1 a 4 de izquierda a derecha), fachadas en z = 0, calle hacia +z.
  Sótano entre x = −20 y el **tall transversal** (`KC.xc` = 26,5); rampa a la izquierda; RITU y torre a la derecha. El
  tall es la opción `S.cut` (las piezas con `cut:true/false` se muestran según el estado).
- **Grupos girados** (`ROOT`/`withRoot()` de `app.js`): cada pareja de casas es un grupo `PG[i]` girado ±90° y, dentro,
  las coordenadas son las de las viviendas A y D (o B y C) del edificio: `buildInterior(u)` funciona sin cambios.
  `UW(u,x,y,z)` convierte coordenadas de la disposición A a la escena; `UB` (redefinida) hace lo mismo con las cajas de
  tabiques y muebles.
- **RITU**: es el RITS del edificio construido dentro del grupo `RITS_ROOT` (girado −90° y bajado 15 m); `RITSM` guarda su
  matriz para que las vistas y el encuadre del RITS (`ritsW()`, `frameEl`) funcionen. Los registros principales del RITI
  (`buildRITIFibre`, `buildRITIPairs`) se construyen en el grupo `RITI_ROOT`, en la pared de la puerta.
- **Canalización principal**: 5 tubos Ø50 que bajan del RITU y van por el techo del sótano junto al muro de delante
  (`mainPath`, `ML`), hasta los registros secundarios `rs_2` (x = 10, casas 3 y 4) y `rs_1` (x = −10, casas 1 y 2).
  Cada registro secundario es un grupo girado 180° (`RSG[i]`, `rsW()`); dentro: dos derivadores F 2D (`DRV`; cada registro solo sirve a dos casas), caja de
  segregación y regleta. La canalización secundaria (`csPathC`) sube por la medianera hasta el RTR.
- `RX` (posición de los tubos en el suelo del RITS), `KRP` (regletas del STDP) y `RITS_OPEN` se cambian en `buildICT()` de
  `cases.js`; en el edificio conservan sus valores.

## Escala y coordenadas

- Unidades: **metros**. Eje Y hacia arriba. Planta *f* empieza en `yb(f) = 3*f`.
- Las viviendas A, B, C y D son simétricas: dentro de `buildUnit`/`buildInterior` se usan `X(x)` y `Z(z)` (reflejan
  según la vivienda) y `sz = SZ(u)` (sentido hacia la vivienda). Usa siempre `X()`/`Z()` para que el modelo salga bien
  en las cuatro.
- RITS: recinto `RI`; placa de montaje con la cara frontal en `ZP = -4.715`.
- **Los equipos del RITI, del RTR y del RITS están a medida real** (dimensiones de catálogo del fabricante). Al
  añadir o mejorar un equipo, busca sus medidas reales y cítalas en un comentario. Fuera del RITS algunos elementos
  pequeños están ampliados para que se vean; está indicado en `SIMPLIFICATIONS`.
- Los modelos se inspiran en productos reales (sobre todo Televes) **sin logotipos de marca**.

## Modelos glTF de los equipos

| Equipo (Televes, sin logotipo) | Archivo | Dónde se usa |
|---|---|---|
| Módulo T12 (35 × 198 × 103 mm) | `t12.glb` | Cabecera B (monocanales) y FI 2 de la cabecera A |
| Fuente T12 549812 (70 × 198 × 92) | `font_t12.glb` | Fuentes de ambas cabeceras |
| Central AVANT 12 PRO SAT 532204 (201 × 120 × 42) | `avant.glb` | Cabecera A |
| Mezclador TER + 2 SAT 740710 (98 × 76 × 27) | `mesclador.glb` | Cabecera B |
| Multiplexor pasivo RJ45 546501 (142 × 60 × 24) | `multiplexor.glb` | RTR de cada vivienda |
| Derivador F 4D 519345 (109 × 54 × 18) | `derivador.glb` | Registros secundarios (2 por planta) |
| Derivador F 2D 519322/519323 (74 × 54 × 18) | `derivador_2d.glb` | Registros secundarios de las casas (2 por registro; `MODELS.deriv2` en `cases.js`) |
| PAU repartidor 4D 519534 (109 × 54 × 18), entrada carregada | `pau_rtv.glb` | RTR de cada vivienda (`pauRtvPos(u)`) |
| PAU de TBA coaxial: repartidor 2D 5–1220 MHz 519602 (74 × 54 × 18), entrada cargada con 4061 | `pau_tba.glb` | RTR de cada vivienda (`pauTbaPos(u)`) |
| Carga 75 Ω 4061 (12 × 29 × 12) | `carrega.glb` | Entradas/salidas libres (`fLoad`) y paso de la 1.ª planta |
| Conector F macho roscado 417101 | `conector_f.glb` | Conexiones coaxiales (`coaxPlug`) |
| PAU de fibra óptica 231502 (119 × 94 × 33) | `pau_fo.glb` | RTR de cada vivienda (`pauFoPos(u)`) |
| Adaptador SC/APC simplex con tapa autoblocante | `adaptador_sc.glb` | PAU de fibra y presa óptica de la sala (`scAdapter`) |
| Conector SC/APC de latiguillo (52 mm) | `sc_apc.glb` | PAU, presa óptica y ONT (`scPlug`) |

Cómo funcionan en la web:

- `MODELS` lista los archivos; `loadModels()` los carga antes de `init()`. Si un archivo falta o la página se abre con
  `file://`, cada función usa su **modelo procedural de reserva** (mantenlo siempre).
- `placeModel(k, el, x, y, z, recolor, rot)` copia el modelo, registra cada malla al elemento `el` y devuelve las mallas
  (añádelas a `G.pick` si deben seleccionarse). `rot`: número (giro en Y), `[x,y,z]` (Euler) o un `THREE.Quaternion`.
  `recolor` cambia colores por **nombre de material** (p. ej. `{banda: 0x1565C0}` en los T12 de FI).
- Los **objetos vacíos** del modelo marcan puntos de anclaje y se leen con `modelPoint(k, nombre)`: puertos F
  (`port_in1`, `in`, `t1`… `out`, `inc`, `o1`… `o4`, `sa`, `ter`…), bocas RJ45 (`j1`… `j8`, `line`, `adsl`), conector de 24 V (`dc`),
  tomas (`power`, `terra`), tornillos (`forat_e`, `forat_d`), salidas SC del PAU (`sc1`… `sc4`) y entradas laterales
  (`entrada_d`, `entrada_e`). Los cables y conectores se enganchan ahí.
- `recolor` con `null` omite una pieza (p. ej. `{tapa: null}`: adaptador SC sin tapa porque lleva un conector).
- Convenios de los modelos: metros; frontal hacia −Y en Blender (+Z en glTF); origen en el centro de la cara posterior
  (T12 y fuente: centro de la arista inferior posterior). Materiales: zamak `C2C6C9`, níquel `C9CCCF` (metálico 0,5;
  **nunca 1**, porque la escena no tiene mapa de entorno y el metal puro se ve negro).

### Flujo para un modelo nuevo a partir del DWG del fabricante

1. `brew install libredwg` (ya instalado) y `dwg2dxf -y -o models/src/REF.dxf archivo.dwg`. Los planos de Televes son
   **vistas frontales 2D en mm** con el origen en el centro; la profundidad sale de la ficha del catálogo.
2. Sacar cotas del DXF con un script de Python (líneas horizontales/verticales largas, círculos, agrupación de puntos
   para los conectores). Renderizarlo a SVG ayuda a verlo en el navegador.
3. Serigrafía: `models/src/scripts/REF_serigrafia.py` (Pillow) rasteriza las líneas del plano a un PNG con alfa,
   **excluyendo el logotipo** y lo que varíe por unidad (valores, referencias); los textos mal trazados en el plano se
   reescriben con tipografía (Arial/Menlo).
4. Modelo: `models/src/scripts/REF_model.py` se ejecuta con
   `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P script.py`; construye la geometría,
   une las piezas por material, guarda el `.blend` y exporta el `.glb`. Comprobar con un render EEVEE en segundo plano.
5. Integrar en `js/app.js` (`MODELS`, `placeModel`, puntos de anclaje, reserva procedural), actualizar la ficha en
   `EL`, `models/README.md` y esta tabla.
6. **Los DWG, DXF y SVG del fabricante no se publican** (`.gitignore`); sí el `.glb`, el `.blend` (sin el plano), la
   textura y los scripts.

## Criterios de diseño acordados

- **Medidas reales** de catálogo en RITI, RTR, RITS y registros secundarios; cítalas en un comentario.
- **Sin logotipos de marca** (Televes, LTE ready…). Nombres de producto y referencias sí.
- Cabecera de monocanales T12: puertos F **centrados** (entradas a 166,5 y 146,5 mm de la base, salidas a 51,5 y
  31,5 mm); puentes F de 48 mm (ref. 5074) en **Z**: de la boca superior de un módulo a la inferior del de la derecha.
  TDT 10 → 1 de izquierda a derecha (el filtro LTE va en la entrada superior del TDT 1).
- Toda entrada o salida F libre lleva una **carga 4061** (`fLoad`).
- PAU de TBA coaxial: repartidor 2D 519602 bajo el PAU de RTV; entrada libre con carga 4061 (no hay operador de cable), salidas
  de izquierda a derecha (lógica) a sala y dorm. 1.
- PAU de RTV (519534): cable blanco a la entrada, cable negro (reserva) a la **entrada cargada** (75 Ω interna, sin carga
  externa); los dos entran por debajo con una U de 33 mm. Salidas asignadas de izquierda a derecha (lógica) a cocina, sala, dorm. 2 y 1.
- Derivadores: la señal baja desde la cubierta, así que la **pérdida de derivación crece al subir**
  (`TAPF`: 1.ª 12 dB 519342, 2.ª 16 dB 519343, 3.ª 20 dB 519344, 4.ª 24 dB 519345); la 1.ª cierra el paso con carga.
- Canalizaciones (RD 346/2011): externa y enlace inferior 4 × Ø63 (`ALX`), enlace superior 2 × Ø40, principal 6 × Ø50
  (`RX`, `RZ`, `RPR`), secundaria 4 × Ø25 hasta un registro de pas por lado + 3 × Ø25 por vivienda, interior Ø20 (`RIT`).
- Red de pares: STDP con regletas Krone y manguera de 50 pares (RD 346/2011, factor 1,2); en el RTR, roseta doble RJ45
  y multiplexor con teléfono solo en las BAT dobles de sala y dormitorio 1.
- Fondo: cielo con nubes (panorama generado), montañas 3D y niebla lejana; en el modo «Només ICT», fondo liso.

## Ahorrar contexto (tokens)

- **No leas `js/app.js` ni `js/dades.js` enteros** (≈ 470 KB entre los dos): busca con `grep -n` el nombre de la función o
  del `id` y lee solo ese tramo. No abras `vendor/` ni los `.glb`/`.blend`.
- Para comprobar en el navegador, prefiere `javascript_tool` (datos) a capturas; usa capturas reducidas
  (`scale` 0,6) y solo las necesarias. El navegador cachea la página y los scripts: recarga con `?debug&v=N` y, si un cambio en `js/` no aparece,
  fuerza la recarga (`location.reload()` tras vaciar la caché).
- Ediciones de varios bloques: un script de Python con reemplazos exactos (`assert s.count(a)==1`) evita releer.

## Convenciones

- Textos de la interfaz, fichas y **comentarios del código en catalán**.
- No cambies los `id` de `EL`: los usan las fichas, el modo «Comprova», las vistas y las conexiones.
- Mantén el estilo del código que rodea el cambio (funciones compactas, comentarios cortos).
- Si cambias cómo funciona algo (topología, número de puertos, posición de un equipo), actualiza también la ficha del
  elemento en `EL` y, si procede, `SIMPLIFICATIONS` y el texto de «Sobre el model».
- No modifiques los archivos de `vendor/`.

## Cómo probar

1. Sirve la carpeta: `python3 -m http.server 8765` y abre <http://localhost:8765/index.html?debug> (o `cases.html?debug`).
2. Con `?debug` existe `window.__ICT` para inspeccionar desde la consola:
   - `__ICT.look([x,y,z],[tx,ty,tz])` — coloca la cámara y su objetivo.
   - `__ICT.setOpen('riti', true); __ICT.applyVisibility()` — abre puertas y tapas (`rp_fo`, `rp_pt`, `rs_1`, `rtr_1A`…).
   - `__ICT.ritsInterior()` — entra en el RITS; `__ICT.setCap('A'|'B')` — cambia la variante de cabecera.
   - `__ICT.setMode('ict')` — muestra solo la ICT; `__ICT.select('id')` — selecciona un elemento y abre su ficha.
   - `__ICT.G.meshes.length` — número de mallas; `__ICT.EL` — registro de elementos.
3. Comprueba que la consola no muestra errores y que el elemento modificado se ve bien desde varios ángulos y, si
   está en las viviendas, en una vivienda A y en una C (reflejada).
4. Comprobación rápida de sintaxis de los scripts:
   ```bash
   for f in js/*.js; do node --check "$f" || echo "ERR $f"; done
   ```

## Git

- Un commit por mejora, con mensaje en catalán que explique qué cambia y por qué.
- Antes de empezar, `git pull`: el proyecto lo pueden editar varias personas o agentes y casi todo está en `js/app.js`,
  así que dos cambios simultáneos chocan fácilmente (sobre todo en `js/app.js`).
- El push a `main` publica la web automáticamente.
