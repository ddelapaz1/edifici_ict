# Model 3D del repartidor 2D de 5–1220 MHz (Televes 519602, 74 × 54 × 18 mm), PAU de TBA coaxial, a partir del plànol
# frontal CAD (519602.dxf). Mateixa família que el 519534: entrada i 2 sortides F cap avall, born de terra a la dreta.
# Convenis: metres; origen al centre de la cara posterior del cos; frontal cap a −Y (glTF: +Z). Plànol (mm): X = x/1000, Z = y/1000.
import bpy, bmesh, math, os
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
bpy.ops.wm.read_homefile(use_empty=True)
sc=bpy.context.scene; sc.unit_settings.length_unit='MILLIMETERS'
col=bpy.data.collections.new('PAU_TBA'); sc.collection.children.link(col)
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
   'serigrafia':mat('serigrafia','FFFFFF',0.0,0.5,os.path.join(D,'tex','pau_tba_serigrafia.png'))}
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
# --- cos, llistó superior i placa frontal (cotes del plànol, mm)
bevel(box('cos',mm(-30.8),mm(30.65),0.0,YF,mm(-12.2),mm(11.9),'zamak'),0.0008)
bevel(box('llisto',mm(-21.2),mm(16.0),0.0,YF+0.0015,mm(11.0),mm(14.16),'zamak'),0.0008)
bevel(box('placa',mm(-29.75),mm(29.56),YF+0.0002,YF-0.0006,mm(-11.9),mm(9.84),'zamak'),0.0003)
# --- orelles de fixació: l'esquerra amb forat vertical, la dreta amb forat horitzontal
ear=stadium('orella',mm(-30.85),mm(-20.89),mm(9.0),mm(26.72),0.0,-0.0045)
cut(ear,stadium('forat',mm(-28.43),mm(-23.38),mm(14.2),mm(24.2),0.002,-0.008)); bevel(ear,0.0004); link(ear,'zamak')
def union(t,c): md=t.modifiers.new('u','BOOLEAN'); md.operation='UNION'; md.object=c; md.solver='EXACT'; apply_all(t); bpy.data.objects.remove(c,do_unlink=True)
# cantonades superiors arrodonides (radi 4,4 mm): caixa + caixa + dos cilindres
r=4.4; ear=box('orella',mm(15.7),mm(30.66),0.0,-0.0045,mm(9.0),mm(22.48-r)); union(ear,box('o',mm(15.7+r),mm(30.66-r),0.0,-0.0045,mm(9.0),mm(22.48)))
for cx in (15.7+r,30.66-r):
    bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=mm(r),depth=0.0045,location=(mm(cx),-0.00225,mm(22.48-r)),rotation=(math.pi/2,0,0)); union(ear,bpy.context.object)
cut(ear,stadium('forat',mm(18.4),mm(28.0),mm(14.9),mm(19.6),0.002,-0.008)); bevel(ear,0.0004); link(ear,'zamak')
# --- pinça DIN (esquerra) i aleta del born (dreta)
din=box('din',mm(-37.3),mm(-30.8),0.0,-0.002,mm(-10.4),mm(10.8))
cut(din,box('c',mm(-38),mm(-34.0),0.01,-0.01,mm(-4.6),mm(1.8))); cut(din,box('c',mm(-38),mm(-35.1),0.01,-0.01,mm(-11),mm(-4.6))); link(din,'zamak')
box('aleta',mm(30.6),mm(34.95),0.0,-0.002,mm(-10.4),mm(10.9),'zamak')
# --- born de terra amb cargol
bevel(box('born',mm(30.6),mm(36.6),0.0,-0.012,mm(-4.3),mm(3.3),'zamak'),0.0006)
cylY('cargol',mm(33.9),mm(-0.51),-0.012,-0.0145,mm(2.75),'metall',24)
box('ranura',mm(32.3),mm(35.5),-0.0144,-0.0148,mm(-0.85),mm(-0.17),'zamak')
box('ranura',mm(33.56),mm(34.24),-0.0144,-0.0148,mm(-2.1),mm(1.08),'zamak')
# --- connectors F femella cap avall: entrada i 2 sortides
PX={'in':-25.6,'o1':8.4,'o2':25.4}; TIP=-0.02672
for name,x in PX.items():
    X=mm(x)
    cyl('base',X,YC,-0.0122,-0.0142,mm(5.0),'zamak',32)
    cyl('rosca',X,YC,-0.0142,TIP,0.00476,'metall',24)
    for k in range(4): z=-0.0152-k*0.0026; cyl('filet',X,YC,z,z-0.0006,0.0049,'metall',24)
    cyl('dielectric',X,YC,TIP+0.0004,TIP-0.0001,0.00175,'dielectric',20)
    cyl('viu',X,YC,TIP+0.0005,TIP-0.0004,0.0005,'metall',10)
    e=bpy.data.objects.new(name,None); e.location=(X,YC,TIP); col.objects.link(e)
e=bpy.data.objects.new('terra',None); e.location=(mm(33.9),-0.0145,mm(-0.51)); col.objects.link(e)
# --- serigrafia
bpy.ops.mesh.primitive_plane_add(size=1); o=bpy.context.object; o.name='serigrafia'
o.dimensions=(mm(59.31),mm(21.5),0); o.rotation_euler=(math.pi/2,0,0); o.location=(mm(-0.095),YF-0.00065,mm(-1.15)); bpy.ops.object.transform_apply(location=False,rotation=True,scale=True); link(o,'serigrafia')
groups={}
for o in col.objects:
    if o.type=='MESH': groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,objs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    if len(objs)>1: bpy.ops.object.join()
    objs[0].name='pau_'+name
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(D,'pau_tba.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in col.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(D,'..','pau_tba.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
print('OK',{k:len(v) for k,v in groups.items()})
