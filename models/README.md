# Models 3D (glTF)

La web carrega els models d'aquesta carpeta si existeixen (`loadModels()` a `index.html`); si no, fa servir el model
procedural. Convenis: metres; origen al centre de l'aresta inferior de la cara posterior (el multiplexor i la central AVANT, al centre de la cara posterior); frontal cap a +Z en glTF
(−Y a Blender). Els objectes buits `port_*` i `dc` marquen on s'enganxen ponts i latiguillos.

| Model | Fitxer | Font |
|---|---|---|
| Mòdul T12 (35 × 198 × 103 mm) | `t12.glb` | `src/t12.blend` |
| Font d'alimentació T12, ref. 549812 (70 × 198 × 92 mm) | `font_t12.glb` | `src/font_t12.blend` |
| Multiplexor passiu RJ45, ref. 546501 (142 × 60 × 24 mm) | `multiplexor.glb` | `src/multiplexor.blend` |
| Central programable AVANT 12 PRO SAT, ref. 532204 (201 × 120 × 42 mm) | `avant.glb` | `src/avant.blend` |

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
