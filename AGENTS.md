# Guía para agentes de IA — ICT · Explora l'edifici

Simulador 3D didáctico de la **ICT** (infraestructura común de telecomunicaciones, RD 346/2011) de un edificio
plurifamiliar. Página web estática publicada con GitHub Pages en <https://ddelapaz1.github.io/edifici_ict/>.

## Estructura

| Archivo | Contenido | ¿Se edita? |
|---|---|---|
| `index.html` | Toda la aplicación: HTML, CSS, datos de los elementos y código 3D | **Sí** |
| `vendor/three.min.js` | Three.js r160 (UMD, define el global `THREE`) | **No** |
| `vendor/OrbitControls.js` | OrbitControls de Three.js adaptado a script clásico | **No** |
| `.github/workflows/static.yml` | Despliegue a GitHub Pages en cada push a `main` (sube toda la carpeta) | Solo si hace falta |

No hay *build*, ni npm, ni módulos ES: los `<script>` son clásicos y comparten el ámbito global.
Cualquier archivo nuevo que necesite la web debe ir dentro del repositorio y referenciarse con **ruta relativa**
(nada de CDN), para que funcione igual en local y en GitHub Pages.

Dentro de `index.html` hay dos bloques `<script>`:

1. **Datos**: `UNITS`, `SERVICES`, `TRAMS`, `TECHS` y el registro `EL` de elementos, creados con
   `def({...})`, `RD(...)` (elementos del RITS) y `RE(...)`. Cada elemento tiene `id`, `fam`, `layer`, `svc`, `floor`,
   `parent` y los textos de la ficha (`name`, `what`, `purpose`, `where`, `connects`, `example`, `confusion`), además
   de `nets`, `canals` y `links`. También `CONCEPTS`, `QUIZ` (modo «Comprova què has après») y `SIMPLIFICATIONS`.
2. **Aplicación**: geometría, interfaz, visibilidad, selección, etiquetas y arranque (`init()`).

## Cómo se construyen los modelos 3D

Todo es **geometría procedural** de Three.js (no hay glTF/OBJ). Cada pieza se crea con funciones auxiliares que la
registran con el `id` de un elemento de `EL`; esto es lo que hace funcionar la selección con clic, el resaltado, la
ficha, las capas y los filtros. **No crees `new THREE.Mesh` sueltos añadidos a la escena**: usa siempre estas
funciones.

Primitivas básicas (material Lambert, para elementos esquemáticos):

- `ictMesh(geo, color, elId, o)` — malla genérica registrada al elemento.
- `iBox(elId, w, h, d, x, y, z, color, o)` — caja centrada en (x, y, z).
- `iCyl(elId, r, h, x, y, z, color, axis, o)`, `regBox(...)` (registro con tapa), `tube(...)` (canalización).
- `cable(key, elId, pts, o)` — cable con datos de conexión (`from`, `to`, `via`); el color depende del modo.

Primitivas «realistas» (material físico; requieren `ritsMats()`, que se ejecuta en `buildRITS()`):

- `rBox(el, x0, x1, y0, y1, z0, z1, color, mat, o)` — caja definida por sus límites.
- `rCyl(el, r, h, pos, dir, color, mat, o)`, `rHex(...)` (prisma hexagonal), `rPlane(el, w, h, pos, normal, tex, o)`.
- `rCable(...)`, `polyR(...)`, `fFemale` / `fMale` / `fLoad` (conectores F), `rj45(...)` (RJ45 macho),
  `rrectGeo(...)` (rectángulo redondeado extruido), `mergeParts(...)` (fusiona geometrías en una sola malla).
- Materiales (`mat`): `'plastic'`, `'zamak'`, `'zamakDark'`, `'nickel'`, `'galv'`, `'steel'`, `'pvc'`, `'rubber'`,
  `'copper'`… (ver `ritsMats()`).
- Textos y serigrafías: `textTex(lines, o)` o `canvasTex(w, h, draw)` pegados con `rPlane`.

Opciones habituales en `o`: `{pick:true}` (seleccionable), `{pick:false}` (decorativo), `{opacity}`, `{cast:true}`
(proyecta sombra), `{lidOf:id}` (tapa practicable), `{led:0xRRGGBB}`.

Si un modelo tiene muchas piezas pequeñas, fusiónalas (`mergeParts`, colores por vértice) para no multiplicar
mallas: el edificio ya tiene unas 4.700.

### Dónde está cada cosa (busca por nombre de función)

| Zona | Funciones |
|---|---|
| Arquitectura del edificio | `buildArchitecture()` y siguientes (`buildGroundFloor`, `buildResidentialFloor`…) |
| ICT general, RITI, registros secundarios | `buildICT()` |
| CTO de fibra del RITI | `CTO_FO`, `ctoBox()`, `buildRITIFibre()` |
| Repartidores Krone (STDP) | `KR`, `kroneModule()`, `kroneColumn()`, `buildRITIPairs()` |
| Viviendas y RTR (PAU, roseta, multiplexor) | `buildUnit()`, `buildInterior()`, `MUX`, `rj45()` |
| RITS (recinto, entrada, cabecera) | `buildRITSRoom()`, `buildRITSEntry()`, `buildCapVariant(v)` (variante `'A'` central programable / `'B'` monocanales T12), `buildMix740710()` |
| Antenas | `buildAntennas()` |

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

## Convenciones

- Textos de la interfaz, fichas y **comentarios del código en catalán**.
- No cambies los `id` de `EL`: los usan las fichas, el modo «Comprova», las vistas y las conexiones.
- Mantén el estilo del código que rodea el cambio (funciones compactas, comentarios cortos).
- Si cambias cómo funciona algo (topología, número de puertos, posición de un equipo), actualiza también la ficha del
  elemento en `EL` y, si procede, `SIMPLIFICATIONS` y el texto de «Sobre el model».
- No modifiques los archivos de `vendor/`.

## Cómo probar

1. Sirve la carpeta: `python3 -m http.server 8765` y abre <http://localhost:8765/index.html?debug>.
2. Con `?debug` existe `window.__ICT` para inspeccionar desde la consola:
   - `__ICT.look([x,y,z],[tx,ty,tz])` — coloca la cámara y su objetivo.
   - `__ICT.setOpen('riti', true); __ICT.applyVisibility()` — abre puertas y tapas (`rp_fo`, `rp_pt`, `rs_1`, `rtr_1A`…).
   - `__ICT.ritsInterior()` — entra en el RITS; `__ICT.setCap('A'|'B')` — cambia la variante de cabecera.
   - `__ICT.setMode('ict')` — muestra solo la ICT; `__ICT.select('id')` — selecciona un elemento y abre su ficha.
   - `__ICT.G.meshes.length` — número de mallas; `__ICT.EL` — registro de elementos.
3. Comprueba que la consola no muestra errores y que el elemento modificado se ve bien desde varios ángulos y, si
   está en las viviendas, en una vivienda A y en una C (reflejada).
4. Comprobación rápida de sintaxis de los scripts de `index.html`:
   ```bash
   node -e "const s=require('fs').readFileSync('index.html','utf8');[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((x,i)=>{try{new Function(x[1])}catch(e){console.log('ERR',i,e.message)}});console.log('ok')"
   ```

## Git

- Un commit por mejora, con mensaje en catalán que explique qué cambia y por qué.
- Antes de empezar, `git pull`: el proyecto lo pueden editar varias personas o agentes y todo está en `index.html`,
  así que dos cambios simultáneos chocan fácilmente.
- El push a `main` publica la web automáticamente.
