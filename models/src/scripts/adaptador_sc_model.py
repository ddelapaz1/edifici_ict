# Adaptador SC/APC simplex femella-femella amb tapa autoblocant (com els 2 que inclou el PAU Televes 231502), sense marca.
# Mides habituals: cos 12,7 × 9,7 mm, llargada 25,4 mm; a la boca exterior, el marc de la tapa (15,5 × 11 × 3,2 mm),
# que és el que sobresurt per sota del PAU al plànol (231502_a.dxf: 15,5 mm d'amplada, 3,22 mm d'alçada).
# Metres; centre de la boca exterior a l'origen; cos cap a +Z a Blender (+Y en glTF), cara ampla segons X.
# Marcadors: sc (pla d'acoblament, on queda la punta del connector), interior (boca interior).
# La tapa (material «tapa») tanca la boca: la web la treu quan hi ha un connector endollat.
import bpy, bmesh, math, os
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
bpy.ops.wm.read_homefile(use_empty=True)
sc=bpy.context.scene; sc.unit_settings.length_unit='MILLIMETERS'
col=bpy.data.collections.new('Adaptador_SC'); sc.collection.children.link(col)
mm=lambda v: v/1000
def mat(name,hexc,met=0.0,rough=0.5):
    m=bpy.data.materials.new(name); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']
    c=[int(hexc[i:i+2],16)/255 for i in (0,2,4)]; lin=[x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c]
    b.inputs['Base Color'].default_value=(*lin,1); b.inputs['Metallic'].default_value=met; b.inputs['Roughness'].default_value=rough
    return m
M={'verd':mat('verd','2E9B3F',0.0,0.4),'tapa':mat('tapa','24803F',0.0,0.5),'ceramica':mat('ceramica','F2F0EA',0.0,0.3),'cavitat':mat('cavitat','12301A',0.0,0.8)}
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
L=25.4
# --- cos i marc de la tapa, amb el pas del connector (9,2 × 7,6 mm) i la ranura de la clau (+Y) a les dues boques
body=box('cos',mm(12.7),mm(9.7),mm(3.0),mm(L),'verd',mm(0.3))
frame=box('marc',mm(15.5),mm(11.0),0.0,mm(3.2),'verd',mm(0.3))
for t in (body,frame): apply_all(t)
cs=[box('c',mm(9.2),mm(7.6),mm(-1),mm(L+1)), box('c',mm(4.0),mm(1.4),mm(-1),mm(L+1),y=mm(3.8))]
for t in (body,frame):
    for c in cs: cut(t,c)
    apply_all(t)
for c in cs: bpy.data.objects.remove(c,do_unlink=True)
# --- ganxos de retenció: tabic central fosc amb el casquet d'alineació de ceràmica
box('tabic',mm(9.2),mm(7.6),mm(L/2-0.6),mm(L/2+0.6),'cavitat')
bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=mm(1.7),depth=mm(9.0),location=(0,0,mm(L/2))); o=bpy.context.object; link(o,'ceramica')
for p in o.data.polygons: p.use_smooth=True
for s in (-1,1): box('ganxo',mm(0.8),mm(3.0),mm(4.0),mm(L-4.0),'cavitat',x=s*mm(4.2))
# --- tapa autoblocant (abatible cap endins quan s'endolla el connector)
box('tapa',mm(9.0),mm(7.4),mm(0.3),mm(1.1),'tapa',mm(0.2)); box('pestanya',mm(3.0),mm(1.0),mm(0.0),mm(0.4),'tapa',y=mm(-2.6))
for name,z in [('sc',L/2),('interior',L)]:
    e=bpy.data.objects.new(name,None); e.location=(0,0,mm(z)); col.objects.link(e)
groups={}
for o in col.objects:
    if o.type=='MESH': apply_all(o); groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,objs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    if len(objs)>1: bpy.ops.object.join()
    objs[0].name='adsc_'+name
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(D,'adaptador_sc.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in col.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(D,'..','adaptador_sc.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
print('OK',{k:len(v) for k,v in groups.items()})
