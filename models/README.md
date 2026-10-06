# Models 3D (glTF)

La web carrega els models d'aquesta carpeta si existeixen (`loadModels()` a `index.html`); si no, fa servir el model
procedural. Convenis: metres; origen al centre de l'aresta inferior de la cara posterior (el multiplexor, la central AVANT, el mesclador i el derivador, al centre de la cara posterior; la càrrega, al centre de la femella); frontal cap a +Z en glTF
(−Y a Blender). Els objectes buits `port_*`, `in`, `out`, `t1`–`t4` i `dc` marquen on s'enganxen ponts i cables.

| Model | Fitxer | Font |
|---|---|---|
| Mòdul T12 (35 × 198 × 103 mm) | `t12.glb` | `src/t12.blend` |
| Font d'alimentació T12, ref. 549812 (70 × 198 × 92 mm) | `font_t12.glb` | `src/font_t12.blend` |
| Multiplexor passiu RJ45, ref. 546501 (142 × 60 × 24 mm) | `multiplexor.glb` | `src/multiplexor.blend` |
| Central programable AVANT 12 PRO SAT, ref. 532204 (201 × 120 × 42 mm) | `avant.glb` | `src/avant.blend` |
| Mesclador TER + 2 SAT, ref. 740710 (98 × 76 × 27 mm) | `mesclador.glb` | `src/mesclador.blend` |
| Derivador F 4D, ref. 519345 (109 × 54 × 18 mm) | `derivador.glb` | `src/derivador.blend` |
| Càrrega terminal 75 Ω tipus F amb bloqueig CC, ref. 4061 (12 × 29 × 12 mm) | `carrega.glb` | `src/carrega.blend` |
| Connector F mascle roscat, ref. 417101 (L 21,106 mm, cos Ø8,824 mm, hexàgon 10,912 mm entre cares) | `conector_f.glb` | `src/conector_f.blend` |
| PAU de fibra òptica, ref. 231502 (119 × 94 × 33 mm; 97 mm amb els adaptadors) | `pau_fo.glb` | `src/pau_fo.blend` |
| Adaptador SC/APC simplex amb tapa autoblocant (12,7 × 9,7 × 25,4 mm; marc 15,5 × 11 × 3,2 mm) | `adaptador_sc.glb` | `src/adaptador_sc.blend` |
| Connector SC/APC simplex de latiguillo (grip 9,0 × 7,4 mm, 52 mm amb la mànega) | `sc_apc.glb` | `src/sc_apc.blend` |

## Regenerar el T12

Cal el plànol CAD del fabricant (Televes 509012) convertit a DXF a `src/` (no es publica, vegeu `.gitignore`):

```bash
dwg2dxf -y -o models/src/509012_CAD02230089.dxf 509012_CAD02230089.dwg   # LibreDWG
python3 models/src/scripts/t12_serigrafia.py                              # textura de serigrafia (Pillow)
/Applications/Blender.app/Contents/MacOS/Blender -b -P models/src/scripts/t12_model.py   # model i exportació
```

`t12_model.py` parteix de `src/t12_plantilla.blend` (el plànol importat com a línies de referència), genera la
geometria, desa `src/t12.blend` i exporta `t12.glb`. La serigrafia només inclou els elements comuns a tots els T12
(sense logotips de marca); l'etiqueta de canal la posa el codi de la web.

## Regenerar la font T12

Plànols del fabricant `FA_frontal.dwg` (vista frontal) i `FA_imagen.dwg` (versió en color, d'on surten els colors
taronja `#FFA000` i alumini `#C7C8CA`), convertits a DXF a `src/`:

```bash
dwg2dxf -y -o models/src/FA_frontal.dxf FA_frontal.dwg
python3 models/src/scripts/font_t12_serigrafia.py
/Applications/Blender.app/Contents/MacOS/Blender -b -P models/src/scripts/font_t12_model.py
```

## Regenerar el multiplexor

Plànol del fabricant `546501_CAD04230001.dwg` convertit a `src/546501.dxf`. Els números i els rètols de la serigrafia
s'escriuen amb tipografia (Arial Bold) perquè al plànol alguns dígits estan mal traçats.

```bash
dwg2dxf -y -o models/src/546501.dxf 546501_CAD04230001.dwg
python3 models/src/scripts/multiplexor_serigrafia.py
/Applications/Blender.app/Contents/MacOS/Blender -b -P models/src/scripts/multiplexor_model.py
```

## Regenerar la central AVANT 12 PRO SAT

Plànol del fabricant `532204_CAD10240005_532204.dwg` convertit a `src/532204.dxf`. El nom del producte es torna a
escriure amb tipografia perquè al plànol està traçat amb línies soltes.

```bash
dwg2dxf -y -o models/src/532204.dxf 532204_CAD10240005_532204.dwg
python3 models/src/scripts/avant_serigrafia.py
/Applications/Blender.app/Contents/MacOS/Blender -b -P models/src/scripts/avant_model.py
```

## Regenerar el mesclador

Plànol del fabricant `740710_CAD02230170.dwg` convertit a `src/740710_b.dxf` (l'etiqueta es copia del plànol, sense el
logotip):

```bash
dwg2dxf -y -o models/src/740710_b.dxf 740710_CAD02230170.dwg
python3 models/src/scripts/mesclador_serigrafia.py
/Applications/Blender.app/Contents/MacOS/Blender -b -P models/src/scripts/mesclador_model.py
```

## Regenerar el derivador

Plànol del fabricant `519345.dwg` convertit a `src/519345.dxf`:

```bash
dwg2dxf -y -o models/src/519345.dxf 519345.dwg
python3 models/src/scripts/derivador_serigrafia.py
/Applications/Blender.app/Contents/MacOS/Blender -b -P models/src/scripts/derivador_model.py
```

## Regenerar la càrrega terminal 75 Ω

Mides de catàleg i del connector F (Televes 4061):

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b -P models/src/scripts/carrega_model.py
```

## Regenerar el connector F roscat

Perfil del DWG `417101 - Conector_F_Roscado_CX_T100_10_Sin_CAD07190354.dwg`, facilitat per l'usuari, amb unitats
en mil·límetres. El model copia el perfil exterior; el moletejat de les fotos i les rosques interiors són aproximats.
No inclou logotips ni un pin propi: el contacte mascle és el conductor central del cable pelat.

```bash
dwg2dxf -y -o models/src/417101.dxf '417101 - Conector_F_Roscado_CX_T100_10_Sin_CAD07190354.dwg'
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b -P models/src/scripts/conector_f_model.py
```

El generador ja conté les mides del plànol i pot regenerar el model sense el DXF. Una sola malla de níquel, sense
textures externes. Origen al centre de la boca; cos cap a +Z a Blender (+Y en glTF). Marcadors `mouth` i `cable`.
`coaxPlug()` orienta el model segons el port i retorna l'entrada del cable. S'utilitza a antenes, equips del RITS,
unions F-F, derivadors i PAU; conserva la representació procedural si el GLB no es carrega.

## Regenerar el PAU de fibra òptica i els SC/APC

Plànols del fabricant `231502_CAD04230058.dwg` (vista frontal amb l'etiqueta) i `231502 - PAU_Fo.10_Sin_CAD07180150.dwg`
(contorn), convertits a `src/231502_a.dxf` i `src/231502_b.dxf`. Profunditat de la fitxa del producte (33 mm). L'etiqueta
es copia del plànol (textos i icones de les sortides en colors); el requadre del logotip de la tapa queda llis.

```bash
dwg2dxf -y -o models/src/231502_a.dxf 231502_CAD04230058.dwg
python3 models/src/scripts/pau_fo_serigrafia.py
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b -P models/src/scripts/pau_fo_model.py
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b -P models/src/scripts/adaptador_sc_model.py
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b -P models/src/scripts/sc_apc_model.py
```

PAU: origen al centre de la cara posterior; buits `sc1`…`sc4` (boca exterior de cada sortida, a la base; 1 i 2 a la
fila davantera) i `entrada_d` / `entrada_e` (pretallat lateral superior per a l'acometida). Adaptador: origen al centre de
la boca exterior, eix cap endins (+Y en glTF), cara ampla segons X; buits `sc` (pla d'acoblament, a 12,7 mm) i
`interior`; la tapa autoblocant té el material `tapa`, que la web treu (`recolor {tapa: null}`) quan hi ha connector.
Connector: origen a la punta de la virola, cable cap a +Y en glTF; buits `tip` i `cable` (a 52 mm).
`scAdapter()` i `scPlug()` orienten els models (eix i cara ampla) i tenen reserva procedural.
