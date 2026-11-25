# Coixí de peluix 3D amb forma de gos (60 cm de llarg) per al sofà dels habitatges i cases.
# Construeix un volum 3D rodó i bombat (tipus coixí tubular farcit) seguint l'eix corbat del gos i ajustant cada secció
# el·líptica al perfil exacte de coixi_gos_mask.png, amb projecció UV de coixi_gos.jpg per les dues cares.
# Convenis: metres; base a Z = 0, frontal lateral cap a −Y (glTF: +Z), llargada total = 0,60 m.
import bpy, bmesh, math, os
import numpy as np

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
bpy.ops.wm.read_homefile(use_empty=True)
sc = bpy.context.scene
sc.unit_settings.system = 'METRIC'

# Carrega la màscara (512 × 720, origen baix-esquerra a Blender)
mimg = bpy.data.images.load(os.path.join(D, 'tex', 'coixi_gos_mask.png'))
mw, mh = mimg.size
mpix = np.array(mimg.pixels[:], dtype=np.float32).reshape((mh, mw, 4))[:, :, 0] > 0.5
ys, xs = np.where(mpix)
vmin_m, vmax_m = float(ys.min()), float(ys.max())
ucen_m = 0.5 * (float(xs.min()) + float(xs.max()))
L_TARGET = 0.60
scale = L_TARGET / (vmax_m - vmin_m)

def inside(u, v):
    ix, iy = int(round(u)), int(round(v))
    return 0 <= ix < mw and 0 <= iy < mh and bool(mpix[iy, ix])

# Corba guia de l'espina dorsal (coordenades normalitzades [0..1] respecte de la imatge 512×720, v=0 baix, v=1 dalt):
# recorre des de la base arrodonida, puja pel cos/panxa, gira pel coll i acaba a la punta del morro.
CTRL = np.array([
    [0.44, 0.015],  # base posterior (cul)
    [0.34, 0.14],   # part baixa arrodonida
    [0.31, 0.30],   # panxa / llom inferior
    [0.29, 0.50],   # tors mitjà
    [0.32, 0.68],   # espatlles
    [0.43, 0.81],   # clatell / gir del coll
    [0.60, 0.88],   # crani / orella
    [0.77, 0.86],   # ulls / front
    [0.88, 0.79],   # inici del morro
    [0.985, 0.745], # punta del nas
], dtype=np.float64)
CTRL_PX = np.column_stack([CTRL[:, 0] * (mw - 1), CTRL[:, 1] * (mh - 1)])

def catmull_rom(pts, n_samples):
    # Mostra la corba spline Catmull-Rom centrípeta en n_samples punts
    P = np.vstack([2*pts[0]-pts[1], pts, 2*pts[-1]-pts[-2]])
    segs = len(pts) - 1
    out = []
    for k in range(n_samples):
        u = k / (n_samples - 1) * segs
        i = min(segs - 1, int(u))
        t = u - i
        p0, p1, p2, p3 = P[i], P[i+1], P[i+2], P[i+3]
        t2, t3 = t*t, t*t*t
        q = 0.5 * ((2*p1) + (-p0+p2)*t + (2*p0-5*p1+4*p2-p3)*t2 + (-p0+3*p1-3*p2+p3)*t3)
        out.append(q)
    return np.array(out)

# Remostreig uniforme per longitud d'arc
raw = catmull_rom(CTRL_PX, 240)
arc = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(raw, axis=0), axis=1))])
NS = 40  # seccions longitudinals (sense comptar els pols)
s_targets = np.linspace(0.025 * arc[-1], 0.985 * arc[-1], NS)
spine = np.column_stack([np.interp(s_targets, arc, raw[:, 0]), np.interp(s_targets, arc, raw[:, 1])])

# Tangents i normals 2D al llarg de la corba
tang = np.zeros_like(spine)
tang[1:-1] = spine[2:] - spine[:-2]
tang[0] = spine[1] - spine[0]
tang[-1] = spine[-1] - spine[-2]
tang /= np.linalg.norm(tang, axis=1, keepdims=True)
norm2 = np.column_stack([-tang[:, 1], tang[:, 0]])  # normal cap a l'esquerra (esquena)

# A cada secció, cerca els límits exactes de la màscara a dreta i esquerra (amb recerca de llargada acotada)
centers = np.zeros_like(spine)
half_w = np.zeros(NS)
for k in range(NS):
    p = spine[k]; n = norm2[k]
    # Cerca l'extrem positiu (+n) i negatiu (-n) dins la màscara
    def ray_limit(sign, max_d=240.0):
        # Si el punt central queda fora, busca el primer dins; si no, avança fins sortir
        d = 0.0; last_in = 0.0; found = inside(p[0], p[1])
        step = 1.5
        while d <= max_d:
            q = p + sign * d * n
            if inside(q[0], q[1]):
                last_in = d; found = True
            elif found:
                # Comprova que no sigui un petit buit i refina per bisecció
                q2 = p + sign * (d + 4.0) * n
                if not inside(q2[0], q2[1]):
                    lo, hi = last_in, d
                    for _ in range(6):
                        mid = 0.5 * (lo + hi)
                        qm = p + sign * mid * n
                        if inside(qm[0], qm[1]): lo = mid
                        else: hi = mid
                    return lo
            d += step
        return last_in
    d_pos = ray_limit(+1.0)
    d_neg = ray_limit(-1.0)
    centers[k] = p + 0.5 * (d_pos - d_neg) * n
    half_w[k] = max(6.0, 0.5 * (d_pos + d_neg))

# Suavitza suaument centres i amplades perquè el volum 3D sigui orgànic i sense plecs
for _ in range(3):
    c2 = centers.copy(); w2 = half_w.copy()
    for k in range(1, NS - 1):
        c2[k] = 0.25*centers[k-1] + 0.5*centers[k] + 0.25*centers[k+1]
        w2[k] = 0.25*half_w[k-1] + 0.5*half_w[k] + 0.25*half_w[k+1]
    centers, half_w = c2, w2

# Recalcula tangents i normals a partir dels centres suavitzats
tang[1:-1] = centers[2:] - centers[:-2]
tang[0] = centers[1] - centers[0]
tang[-1] = centers[-1] - centers[-2]
tang /= np.linalg.norm(tang, axis=1, keepdims=True)
norm2 = np.column_stack([-tang[:, 1], tang[:, 0]])

# Construeix la malla 3D tubular amb seccions el·líptiques rodones i extrems arrodonits (cul i nas)
NR = 24  # segments radials per anell
bm = bmesh.new()
uv_layer = bm.loops.layers.uv.new('UVMap')

def px_to_world(u, v, y_m):
    return ((u - ucen_m) * scale, y_m, (v - vmin_m) * scale)

# Cerca el píxel interior més proper per a UV (cap vèrtex mostreja fora del pèl real)
in_ys, in_xs = np.where(mpix)
# Submostreig del contorn interior per projecció ràpida
inner_pts = np.column_stack([in_xs[::4], in_ys[::4]]).astype(np.float64)

def px_to_uv(u, v):
    ix, iy = int(round(u)), int(round(v))
    if not (0 <= ix < mw and 0 <= iy < mh and mpix[iy, ix]):
        d2 = (inner_pts[:, 0] - u)**2 + (inner_pts[:, 1] - v)**2
        p = inner_pts[int(np.argmin(d2))]
        u, v = float(p[0]), float(p[1])
    return (min(0.998, max(0.002, u / (mw - 1))), min(0.998, max(0.002, v / (mh - 1))))

rings = []
v_uv = {}

# Gruix 3D (eix Y): peluix ben rodó i farcit (~82% de l'amplada del perfil: ~22 cm al cos, ~14 cm al cap, ~8 cm al morro)
DEPTH_RATIO = 0.82

# Afegeix anells intermedis arrodonits als dos extrems (cul t=0 i nas t=1) per tancar en cúpula suau
def add_ring(c_px, n_px, hw_px, depth_scale=1.0):
    ring = []
    hd_m = hw_px * scale * DEPTH_RATIO * depth_scale
    for j in range(NR):
        a = 2.0 * math.pi * j / NR
        ca, sa = math.cos(a), math.sin(a)
        # Secció el·líptica molt rodona (lleugerament farcida)
        q_px = c_px + ca * hw_px * n_px
        y_m = sa * hd_m
        v = bm.verts.new(px_to_world(q_px[0], q_px[1], y_m))
        v_uv[v] = px_to_uv(q_px[0], q_px[1])
        ring.append(v)
    rings.append(ring)

# Cúpula d'inici (base posterior arrodonida)
t0 = tang[0]; p_start = centers[0] - t0 * (half_w[0] * 0.42)
for frac in (0.35, 0.72):
    r_f = math.sqrt(max(0.05, 1.0 - (1.0 - frac)**2))
    c_cap = p_start + (centers[0] - p_start) * frac
    add_ring(c_cap, norm2[0], half_w[0] * r_f, depth_scale=0.92)

# Cos principal seguint la silueta exacta
for k in range(NS):
    # Petit reforç de volum a la panxa/tors i morro ben rodó
    u_frac = k / (NS - 1)
    ds = 0.90 if u_frac > 0.78 else 1.0
    add_ring(centers[k], norm2[k], half_w[k], depth_scale=ds)

# Cúpula final (punta arrodonida del morro)
t1 = tang[-1]; p_tip = centers[-1] + t1 * (half_w[-1] * 0.45)
for frac in (0.72, 0.35):
    r_f = math.sqrt(max(0.05, 1.0 - (1.0 - frac)**2))
    c_cap = p_tip + (centers[-1] - p_tip) * frac
    add_ring(c_cap, norm2[-1], half_w[-1] * r_f, depth_scale=0.90)

# Connecta anells consecutius
for r0, r1 in zip(rings, rings[1:]):
    for j in range(NR):
        jn = (j + 1) % NR
        f = bm.faces.new((r0[j], r0[jn], r1[jn], r1[j]))
        for lp in f.loops: lp[uv_layer].uv = v_uv[lp.vert]

# Tanca els dos pols (cul i punta del nas)
v_p0 = bm.verts.new(px_to_world(p_start[0], p_start[1], 0.0)); v_uv[v_p0] = px_to_uv(p_start[0], p_start[1])
v_p1 = bm.verts.new(px_to_world(p_tip[0], p_tip[1], 0.0)); v_uv[v_p1] = px_to_uv(p_tip[0], p_tip[1])
for j in range(NR):
    jn = (j + 1) % NR
    f0 = bm.faces.new((v_p0, rings[0][jn], rings[0][j]))
    for lp in f0.loops: lp[uv_layer].uv = v_uv[lp.vert]
    f1 = bm.faces.new((v_p1, rings[-1][j], rings[-1][jn]))
    for lp in f1.loops: lp[uv_layer].uv = v_uv[lp.vert]

bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
# Re-centra X i ajusta exactament Z_min = 0 i alçada = 0,60 m
zs = [v.co.z for v in bm.verts]; xs_w = [v.co.x for v in bm.verts]
zmin, zmax = min(zs), max(zs)
xcen = 0.5 * (min(xs_w) + max(xs_w))
sc_fix = L_TARGET / (zmax - zmin)
for v in bm.verts:
    v.co.x = (v.co.x - xcen) * sc_fix
    v.co.y = v.co.y * sc_fix
    v.co.z = (v.co.z - zmin) * sc_fix

me = bpy.data.meshes.new('coixi_gos')
bm.to_mesh(me); bm.free()
for p in me.polygons: p.use_smooth = True

obj = bpy.data.objects.new('coixi_gos', me)
sc.collection.objects.link(obj)

# Material de peluix mat amb textura empaquetada
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
print(f'OK coixi_gos 3D: {len(me.vertices)} vèrtexs, {len(me.polygons)} cares, mides={dims[0]*100:.1f}×{dims[1]*100:.1f}×{dims[2]*100:.1f} cm')
