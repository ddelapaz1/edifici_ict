# Model 3D del derivador F 4D (Televes 519345, 109 × 54 × 18 mm) a partir del plànol frontal CAD (519345.dxf).
# Convenis: metres; origen al centre de la cara posterior del cos; frontal cap a −Y (glTF: +Z). Plànol (mm): X = x/1000, Z = y/1000.
import bpy, bmesh, math, os
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
bpy.ops.wm.read_homefile(use_empty=True)
sc=bpy.context.scene; sc.unit_settings.length_unit='MILLIMETERS'
col=bpy.data.collections.new('Derivador'); sc.collection.children.link(col)
mm=lambda v: v/1000
def mat(name,hexc,met=0.0,rough=0.5,tex=None):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; b=nt.nodes['Principled BSDF']
    c=[int(hexc[i:i+2],16)/255 for i in (0,2,4)]; lin=[x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c]
    b.inputs['Base Color'].default_value=(*lin,1); b.inputs['Metallic'].default_value=met; b.inputs['Roughness'].default_value=rough
    if tex:
        im=nt.nodes.new('ShaderNodeTexImage'); im.image=bpy.data.images.load(tex); im.image.pack()
        nt.links.new(im.outputs['Color'],b.inputs['Base Color']); nt.links.new(im.outputs['Alpha'],b.inputs['Alpha']); m.blend_method='CLIP'; m.alpha_threshold=0.5
    return m
M={'zamak':mat('zamak','C2C6C9',0.5,0.45),'metall':mat('metall','C9CCCF',0.5,0.3),'dielectric':mat('dielectric','F0EFE8',0.0,0.5),
   'serigrafia':mat('serigrafia','FFFFFF',0.0,0.5,os.path.join(D,'tex','derivador_serigrafia.png'))}
def link(o,m):
    o.data.materials.append(M[m])
    for c in o.users_collection: c.objects.unlink(o)
    col.objects.link(o); return o
def apply_all(o):
    bpy.context.view_layer.objects.active=o
    for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
def bevel(o,w,seg=2): md=o.modifiers.new('b','BEVEL'); md.width=w; md.segments=seg; md.limit_method='ANGLE'; apply_all(o); return o
def box(name,x0,x1,y0,y1,z0,z1,m=None):
    bpy.ops.mesh.primitive_cube_add(); o=bpy.context.object; o.name=name
    o.dimensions=(abs(x1-x0),abs(y1-y0),abs(z1-z0)); o.location=((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); bpy.ops.object.transform_apply(scale=True)
    return link(o,m) if m else o
def stadium(name,x0,x1,z0,z1,y0,y1,m=None):
    """placa amb els extrems arrodonits (radi = mitja amplada menor)"""
    o=box(name,x0,x1,y0,y1,z0,z1); md=o.modifiers.new('r','BEVEL'); md.width=min(abs(x1-x0),abs(z1-z0))/2*0.999; md.segments=10; md.affect='EDGES'
    # només les arestes paral·leles a Y (perfil frontal arrodonit)
    me=o.data; bm=bmesh.new(); bm.from_mesh(me); w=bm.edges.layers.bevel_weight.verify() if hasattr(bm.edges.layers,'bevel_weight') else None
    bm.free(); md.limit_method='ANGLE'; md.angle_limit=math.radians(89); apply_all(o)
    return link(o,m) if m else o
def cut(t,c): md=t.modifiers.new('c','BOOLEAN'); md.operation='DIFFERENCE'; md.object=c; md.solver='EXACT'; apply_all(t); bpy.data.objects.remove(c,do_unlink=True)
def cyl(name,x,y,z0,z1,r,m,n=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=abs(z1-z0),location=(x,y,(z0+z1)/2)); return link(bpy.context.object,m)
def cylY(name,x,z,y0,y1,r,m,n=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=abs(y1-y0),location=(x,(y0+y1)/2,z),rotation=(math.pi/2,0,0)); return link(bpy.context.object,m)
YF=-0.0175; YC=-0.009
# --- cos, llistó superior i placa frontal
bevel(box('cos',mm(-47.4),mm(47.3),0.0,YF,mm(-12.2),mm(11.9),'zamak'),0.0008)
bevel(box('llisto',mm(-35.7),mm(30.5),0.0,YF+0.0015,mm(11.0),mm(14.16),'zamak'),0.0008)
bevel(box('placa',mm(-46.0),mm(45.8),YF+0.0002,YF-0.0006,mm(-11.9),mm(9.84),'zamak'),0.0003)
# --- orelles de fixació (anell amb forat allargat) i pinça DIN
for x0,x1,z0,z1,hx0,hx1,hz0,hz1 in ((-47.85,-37.9,9.0,22.2,-44.6,-41.2,13.6,20.0),(37.9,47.66,9.0,17.95,39.6,45.9,12.6,15.7)):
    ear=stadium('orella',mm(x0),mm(x1),mm(z0),mm(z1),0.0,-0.0045)
    h=stadium('forat',mm(hx0),mm(hx1),mm(hz0),mm(hz1),0.002,-0.008); cut(ear,h); bevel(ear,0.0004); link(ear,'zamak')
din=box('din',mm(-54.3),mm(-47.3),0.0,-0.002,mm(-10.4),mm(10.8)); cut(din,box('c',mm(-55),mm(-51.9),0.01,-0.01,mm(-5.2),mm(4.25))); link(din,'zamak')
# --- born de terra amb cargol
bevel(box('born',mm(47.3),mm(53.6),0.0,-0.012,mm(-4.3),mm(3.3),'zamak'),0.0006)
cylY('cargol',mm(50.9),mm(-0.51),-0.012,-0.0145,mm(2.75),'metall',24)
box('ranura',mm(49.3),mm(52.5),-0.0144,-0.0148,mm(-0.85),mm(-0.17),'zamak')
# --- connectors F femella cap avall: entrada, 4 derivacions i sortida
PX={'in':-42.6,'t1':-25.6,'t2':-8.6,'t3':8.4,'t4':25.4,'out':42.4}; TIP=-0.02672
for name,x in PX.items():
    X=mm(x)
    cyl('base',X,YC,-0.0122,-0.0142,mm(5.0),'zamak',32)
    cyl('rosca',X,YC,-0.0142,TIP,0.00476,'metall',24)
    for k in range(4): z=-0.0152-k*0.0026; cyl('filet',X,YC,z,z-0.0006,0.0049,'metall',24)
    cyl('dielectric',X,YC,TIP+0.0004,TIP-0.0001,0.00175,'dielectric',20)
    cyl('viu',X,YC,TIP+0.0005,TIP-0.0004,0.0005,'metall',10)
    e=bpy.data.objects.new(name,None); e.location=(X,YC,TIP); col.objects.link(e)
e=bpy.data.objects.new('terra',None); e.location=(mm(50.9),-0.0145,mm(-0.51)); col.objects.link(e)
# --- serigrafia
bpy.ops.mesh.primitive_plane_add(size=1); o=bpy.context.object; o.name='serigrafia'
o.dimensions=(mm(91.8),mm(21.5),0); o.rotation_euler=(math.pi/2,0,0); o.location=(mm(-0.1),YF-0.00065,mm(-1.15)); bpy.ops.object.transform_apply(location=False,rotation=True,scale=True); link(o,'serigrafia')
groups={}
for o in col.objects:
    if o.type=='MESH': groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,objs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    if len(objs)>1: bpy.ops.object.join()
    objs[0].name='deriv_'+name
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(D,'derivador.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in col.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(D,'..','derivador.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
print('OK',{k:len(v) for k,v in groups.items()})
