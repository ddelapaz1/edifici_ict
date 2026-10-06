# Connector SC/APC simplex (IEC 61754-4) d'un latiguillo de fibra Ø2,0 mm, sense marca.
# Mides habituals de catàleg: cos (grip) 9,0 × 7,4 mm, virola de zircònia Ø2,5 mm, llargada total amb la mànega ≈ 52 mm.
# APC: cos i mànega verds (polit en angle de 8°, que no es veu a aquesta escala).
# Metres; punta de la virola (pla d'acoblament) a l'origen; cos cap a +Z a Blender (+Y en glTF).
# Cara ampla de 9,0 mm segons X; la clau (guia) és a la cara +Y de Blender (−Z en glTF). Marcadors: tip, cable.
import bpy, bmesh, math, os
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
bpy.ops.wm.read_homefile(use_empty=True)
sc=bpy.context.scene; sc.unit_settings.length_unit='MILLIMETERS'
col=bpy.data.collections.new('SC_APC'); sc.collection.children.link(col)
mm=lambda v: v/1000
def mat(name,hexc,met=0.0,rough=0.5):
    m=bpy.data.materials.new(name); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']
    c=[int(hexc[i:i+2],16)/255 for i in (0,2,4)]; lin=[x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c]
    b.inputs['Base Color'].default_value=(*lin,1); b.inputs['Metallic'].default_value=met; b.inputs['Roughness'].default_value=rough
    return m
M={'verd':mat('verd','2E9B3F',0.0,0.4),'manega':mat('manega','24803F',0.0,0.55),'ceramica':mat('ceramica','F2F0EA',0.0,0.25)}
def link(o,m):
    o.data.materials.append(M[m])
    for c in o.users_collection: c.objects.unlink(o)
    col.objects.link(o); return o
def apply_all(o):
    bpy.context.view_layer.objects.active=o
    for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
def box(name,w,h,z0,z1,m=None,bev=0.0,x=0.0,y=0.0):
    bpy.ops.mesh.primitive_cube_add(); o=bpy.context.object; o.name=name
    o.dimensions=(w,h,z1-z0); o.location=(x,y,(z0+z1)/2); bpy.ops.object.transform_apply(scale=True)
    if bev: md=o.modifiers.new('bisell','BEVEL'); md.width=bev; md.segments=2; md.limit_method='ANGLE'
    if m: link(o,m)
    return o
def cut(target,cutter):
    md=target.modifiers.new('forat','BOOLEAN'); md.operation='DIFFERENCE'; md.object=cutter; md.solver='EXACT'
def lathe(name,prof,m,n=24):
    """sòlid de revolució al voltant de Z; prof = [(z, r)] en mm"""
    bm=bmesh.new(); rings=[]
    for z,r in prof: rings.append([bm.verts.new((mm(r)*math.cos(2*math.pi*i/n),mm(r)*math.sin(2*math.pi*i/n),mm(z))) for i in range(n)])
    for a,b in zip(rings,rings[1:]):
        for i in range(n): bm.faces.new((a[i],a[(i+1)%n],b[(i+1)%n],b[i]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o=bpy.data.objects.new(name,me); sc.collection.objects.link(o)
    for p in me.polygons: p.use_smooth=True
    return link(o,m)
# --- virola de zircònia (Ø2,5) i cos intern (sobresurt 2,3 mm del grip)
lathe('virola',[(0,1.0),(0.25,1.25),(6.0,1.25)],'ceramica')
inner=box('intern',mm(7.2),mm(5.8),mm(0.5),mm(10.0),'verd',mm(0.4))
apply_all(inner); c=box('c',mm(2.7),mm(2.7),mm(0.0),mm(3.0)); cut(inner,c); apply_all(inner); bpy.data.objects.remove(c,do_unlink=True)
# --- grip exterior 9,0 × 7,4 mm amb finestres laterals i la clau a la cara +Y
grip=box('grip',mm(9.0),mm(7.4),mm(2.8),mm(25.0),'verd',mm(0.5)); apply_all(grip)
cs=[box('c',mm(7.6),mm(6.2),mm(2.0),mm(12.0))]                                      # boca on corre el cos intern
for s in (-1,1): cs.append(box('c',mm(1.0),mm(3.2),mm(5.0),mm(9.5),x=s*mm(4.5)))     # finestres dels ganxos
for g in range(5):                                                                    # estries de la presa dels dits
    for s in (-1,1): cs.append(box('c',mm(0.5),mm(8.0),mm(15.5+1.6*g),mm(16.3+1.6*g),x=s*mm(4.5)))
for c in cs: cut(grip,c)
apply_all(grip)
for c in cs: bpy.data.objects.remove(c,do_unlink=True)
box('clau',mm(3.6),mm(1.0),mm(3.6),mm(23.0),'verd',mm(0.25),y=mm(3.7+0.5))
# --- cos posterior (engast) i mànega segmentada fins al cable de Ø2,0 mm
box('engast',mm(6.6),mm(6.0),mm(25.0),mm(27.5),'manega',mm(0.5))
prof=[(27.5,3.3),(29.0,3.3)]
for i in range(8):                                                                    # anells de la mànega (flexible)
    z=29.0+2.6*i; r=3.2-0.21*i; prof+=[(z+0.4,r),(z+1.6,r),(z+2.0,r-0.35),(z+2.6,r-0.35)]
prof+=[(50.0,1.45),(52.0,1.2),(52.0,1.0)]
lathe('manega',prof,'manega')
for name,z in [('tip',0.0),('cable',52.0)]:
    e=bpy.data.objects.new(name,None); e.location=(0,0,mm(z)); col.objects.link(e)
# --- unir per material
groups={}
for o in col.objects:
    if o.type=='MESH': apply_all(o); groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,objs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    if len(objs)>1: bpy.ops.object.join()
    objs[0].name='sc_'+name
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(D,'sc_apc.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in col.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(D,'..','sc_apc.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
print('OK',{k:len(v) for k,v in groups.items()})
