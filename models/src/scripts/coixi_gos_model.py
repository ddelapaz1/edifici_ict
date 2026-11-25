# Coixí de peluix amb forma de gos (60 cm de llarg) per al sofà dels habitatges i cases.
# Construeix una malla 3D bombada a partir de la silueta real (coixi_gos_mask.png) amb textura frontal i posterior
# (coixi_gos.jpg). Convenis: metres; base a Z = 0, frontal cap a −Y (glTF: +Z), llargada total = 0,60 m.
import bpy, bmesh, math, os
import numpy as np
from collections import deque

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
bpy.ops.wm.read_homefile(use_empty=True)
sc = bpy.context.scene
sc.unit_settings.system = 'METRIC'

# Carrega la màscara (512 × 720) i calcula la caixa útil
mimg = bpy.data.images.load(os.path.join(D, 'tex', 'coixi_gos_mask.png'))
mw, mh = mimg.size
mpix = np.array(mimg.pixels[:], dtype=np.float32).reshape((mh, mw, 4))[:, :, 0] > 0.5  # y=0 a baix!
ys, xs = np.where(mpix)
x0, x1 = int(xs.min()), int(xs.max())
y0, y1 = int(ys.min()), int(ys.max())

# Graella regular fina dins la màscara
NX, NY = 38, 54
gx_coords = np.linspace(x0, x1, NX)
gy_coords = np.linspace(y0, y1, NY)
inside = np.zeros((NY, NX), dtype=bool)
for j, gy in enumerate(gy_coords):
    iy = min(mh - 1, max(0, int(round(gy))))
    for i, gx in enumerate(gx_coords):
        ix = min(mw - 1, max(0, int(round(gx))))
        inside[j, i] = mpix[iy, ix]

# Conserva només la component connexa principal
vis = np.zeros_like(inside)
best_comp = []
for j in range(NY):
    for i in range(NX):
        if inside[j, i] and not vis[j, i]:
            q = deque([(j, i)]); vis[j, i] = True; comp = []
            while q:
                cy, cx = q.popleft(); comp.append((cy, cx))
                for dy, dx in ((-1,0),(1,0),(0,-1),(0,1)):
                    ny, nx = cy+dy, cx+dx
                    if 0 <= ny < NY and 0 <= nx < NX and inside[ny, nx] and not vis[ny, nx]:
                        vis[ny, nx] = True; q.append((ny, nx))
            if len(comp) > len(best_comp): best_comp = comp
inside[:] = False
for cy, cx in best_comp: inside[cy, cx] = True

# Cel·les actives: quads amb almenys 3 vèrtexs dins (i marca tots 4 com a usats per suavitzar vores)
cells = []
used = np.zeros_like(inside)
for j in range(NY - 1):
    for i in range(NX - 1):
        c = int(inside[j,i]) + int(inside[j,i+1]) + int(inside[j+1,i+1]) + int(inside[j+1,i])
        if c >= 3:
            cells.append((j, i))
            used[j,i] = used[j,i+1] = used[j+1,i+1] = used[j+1,i] = True

# Identifica vèrtexs de contorn (els que no tenen les 4 cel·les veïnes)
cell_set = set(cells)
is_bnd = np.zeros_like(used)
for j in range(NY):
    for i in range(NX):
        if not used[j, i]: continue
        cnt = sum((j+dj, i+di) in cell_set for dj in (-1, 0) for di in (-1, 0))
        if cnt < 4: is_bnd[j, i] = True

# Posicions 2D inicials en espai píxel (u_px, v_px) + suavitzat laplacià del contorn (elimina esglaons)
px_x = np.tile(gx_coords, (NY, 1)).astype(np.float64)
px_y = np.tile(gy_coords[:, None], (1, NX)).astype(np.float64)

# Construeix veïns de contorn per suavitzar la silueta
bnd_adj = {}
for j, i in cells:
    edges = [((j,i),(j,i+1)), ((j,i+1),(j+1,i+1)), ((j+1,i+1),(j+1,i)), ((j+1,i),(j,i))]
    for a, b in edges:
        if is_bnd[a] and is_bnd[b]:
            # només arestes de vora (pertanyen a una sola cel·la)
            pass
edge_count = {}
for j, i in cells:
    for a, b in [((j,i),(j,i+1)), ((j,i+1),(j+1,i+1)), ((j+1,i+1),(j+1,i)), ((j+1,i),(j,i))]:
        k = (a, b) if a < b else (b, a)
        edge_count[k] = edge_count.get(k, 0) + 1
for (a, b), cnt in edge_count.items():
    if cnt == 1:
        bnd_adj.setdefault(a, []).append(b)
        bnd_adj.setdefault(b, []).append(a)

for _ in range(8):
    nx_arr, ny_arr = px_x.copy(), px_y.copy()
    for p, nbs in bnd_adj.items():
        if len(nbs) == 2:
            nx_arr[p] = 0.5 * px_x[p] + 0.25 * (px_x[nbs[0]] + px_x[nbs[1]])
            ny_arr[p] = 0.5 * px_y[p] + 0.25 * (px_y[nbs[0]] + px_y[nbs[1]])
    px_x, px_y = nx_arr, ny_arr

# Distància euclidiana de cada vèrtex interior al contorn (per al volum tou del coixí)
bnd_pts = np.array([(px_x[p], px_y[p]) for p in bnd_adj.keys()], dtype=np.float64)
dist_map = np.zeros((NY, NX), dtype=np.float64)
for j in range(NY):
    for i in range(NX):
        if used[j, i] and (j, i) not in bnd_adj:
            dx = bnd_pts[:, 0] - px_x[j, i]
            dy = bnd_pts[:, 1] - px_y[j, i]
            dist_map[j, i] = math.sqrt(float(np.min(dx*dx + dy*dy)))

# Escala a llargada exacta = 0,60 m (de baix a dalt del gos)
L_TARGET = 0.60
u_vals = px_x[used]; v_vals = px_y[used]
vmin, vmax = float(v_vals.min()), float(v_vals.max())
ucen = 0.5 * (float(u_vals.min()) + float(u_vals.max()))
scale = L_TARGET / (vmax - vmin)

dmax = float(dist_map.max()) or 1.0
HALF_THICK = 0.068  # gruix total ~13,6 cm a la part més bombada del coixí

# Construeix malla tancada amb frontal (−Y) i posterior (+Y) units a la costura del contorn
bm = bmesh.new()
uv_layer = bm.loops.layers.uv.new('UVMap')
front_v = {}
back_v = {}

for j in range(NY):
    for i in range(NX):
        if not used[j, i]: continue
        x = (px_x[j, i] - ucen) * scale
        z = (px_y[j, i] - vmin) * scale
        d = dist_map[j, i] / dmax
        # perfil suau de coixí farcit (arrodonit cap a la costura)
        y_off = HALF_THICK * (d ** 0.58) if d > 0 else 0.0
        if (j, i) in bnd_adj:
            v = bm.verts.new((x, 0.0, z))
            front_v[(j, i)] = v
            back_v[(j, i)] = v
        else:
            front_v[(j, i)] = bm.verts.new((x, -y_off, z))
            back_v[(j, i)] = bm.verts.new((x, y_off, z))

# Mapa UV de cada vèrtex (mateixa foto al davant i reflectida al darrere)
v_uv = {}
for j in range(NY):
    for i in range(NX):
        if not used[j, i]: continue
        u = min(0.998, max(0.002, px_x[j, i] / (mw - 1)))
        v = min(0.998, max(0.002, px_y[j, i] / (mh - 1)))
        v_uv[front_v[(j, i)]] = (u, v)
        v_uv[back_v[(j, i)]] = (u, v)

for j, i in cells:
    q = [(j, i), (j, i+1), (j+1, i+1), (j+1, i)]
    # Frontal (normal cap a −Y)
    vf = [front_v[p] for p in q]
    try:
        ff = bm.faces.new(vf)
        for lp in ff.loops: lp[uv_layer].uv = v_uv[lp.vert]
    except ValueError:
        pass
    # Posterior (normal cap a +Y, ordre invers)
    vb = [back_v[p] for p in reversed(q)]
    try:
        fb = bm.faces.new(vb)
        for lp in fb.loops: lp[uv_layer].uv = v_uv[lp.vert]
    except ValueError:
        pass

bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
# Suavitzat suau del volum per eliminar qualsevol plec de la graella
bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=0.35, use_axis_x=False, use_axis_y=True, use_axis_z=False)
bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=0.35, use_axis_x=False, use_axis_y=True, use_axis_z=False)

me = bpy.data.meshes.new('coixi_gos')
bm.to_mesh(me); bm.free()
for p in me.polygons: p.use_smooth = True

obj = bpy.data.objects.new('coixi_gos', me)
sc.collection.objects.link(obj)

# Material de tela/peluix mat amb la textura del gos empaquetada
mat = bpy.data.materials.new('coixi_gos')
mat.use_nodes = True
nt = mat.node_tree
bs = nt.nodes['Principled BSDF']
bs.inputs['Roughness'].default_value = 0.90
bs.inputs['Metallic'].default_value = 0.0
im = nt.nodes.new('ShaderNodeTexImage')
im.image = bpy.data.images.load(os.path.join(D, 'tex', 'coixi_gos.jpg'))
im.image.pack()
nt.links.new(im.outputs['Color'], bs.inputs['Base Color'])
me.materials.append(mat)

# Neteja la imatge auxiliar de màscara abans de desar el .blend
bpy.data.images.remove(mimg)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(D, 'coixi_gos.blend'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=os.path.join(D, '..', 'coixi_gos.glb'),
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_image_format='JPEG',
    export_jpeg_quality=85,
)
bb = [obj.matrix_world @ v.co for v in me.vertices]
dims = [max(p[k] for p in bb) - min(p[k] for p in bb) for k in range(3)]
print(f'OK coixi_gos: {len(me.vertices)} vèrtexs, {len(me.polygons)} cares, mides={dims[0]*100:.1f}×{dims[1]*100:.1f}×{dims[2]*100:.1f} cm')
