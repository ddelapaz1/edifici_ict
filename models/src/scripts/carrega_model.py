# Model 3D de la càrrega terminal de 75 Ω tipus F amb bloqueig de CC (Televes 4061, 12 × 29 × 12 mm), del plànol CAD.
# Convenis: metres; origen al centre de la cara de la femella (on s'enrosca al connector); eix cap a +Z (glTF: +Y).
import bpy, math, os
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
bpy.ops.wm.read_homefile(use_empty=True)
sc=bpy.context.scene; col=bpy.data.collections.new('Carrega'); sc.collection.children.link(col)
m=bpy.data.materials.new('metall'); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']
b.inputs['Base Color'].default_value=(0.58,0.6,0.62,1); b.inputs['Metallic'].default_value=0.5; b.inputs['Roughness'].default_value=0.28
k=bpy.data.materials.new('interior'); k.use_nodes=True; k.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(0.02,0.02,0.02,1)
def cyl(z0,z1,r,n,mt,bev=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=z1-z0,location=(0,0,(z0+z1)/2)); o=bpy.context.object
    if bev: md=o.modifiers.new('b','BEVEL'); md.width=bev; md.segments=2; md.limit_method='ANGLE'; bpy.ops.object.modifier_apply(modifier='b')
    o.data.materials.append(mt); sc.collection.objects.unlink(o); col.objects.link(o); return o
cyl(0.0,0.002,0.0055,24,m)                       # xamfrà d'entrada de la femella
cyl(0.002,0.012,0.00635,6,m,0.0004)                     # femella hexagonal (11 mm entre cares)
cyl(-0.0001,0.0005,0.0047,24,k)                         # rosca interior (vista des de la boca)
cyl(0.012,0.0225,0.0055,24,m)                    # cos
cyl(0.0225,0.0277,0.0053,24,m)
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=8,radius=0.0053,location=(0,0,0.0277)); s=bpy.context.object
s.scale=(1,1,0.245); bpy.ops.object.transform_apply(scale=True); s.data.materials.append(m); sc.collection.objects.unlink(s); col.objects.link(s)   # cúpula fins a 29 mm
groups={}
for o in col.objects: groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,objs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    if len(objs)>1: bpy.ops.object.join()
    objs[0].name='carrega_'+name
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(D,'carrega.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in col.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(D,'..','carrega.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
print('OK')
