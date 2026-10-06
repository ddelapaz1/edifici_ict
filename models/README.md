# Models 3D (glTF)

La web carrega els models d'aquesta carpeta si existeixen (`loadModels()` a `index.html`); si no, fa servir el model
procedural. Convenis: metres, origen al centre de l'aresta inferior de la cara posterior, frontal cap a +Z en glTF
(−Y a Blender). Els objectes buits `port_*` i `dc` marquen on s'enganxen ponts i latiguillos.

| Model | Fitxer | Font |
|---|---|---|
| Mòdul T12 (35 × 198 × 103 mm) | `t12.glb` | `src/t12.blend` |

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
