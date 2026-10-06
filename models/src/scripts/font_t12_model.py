# Model 3D de la font d'alimentació T12 (Televes 549812, 70 × 198 × 92 mm) a partir del plànol frontal CAD
# (FA_frontal.dxf), la versió en color (FA_imagen.dxf: taronja #FFA000, alumini #C7C8CA) i fotografies.
# Convenis: metres; origen al centre de l'aresta inferior de la cara posterior; frontal cap a −Y (glTF: +Z).
# Coordenades del plànol (mm): X = (x + 0,18)/1000 (centre de l'amplada total), Z = (y + 99)/1000.
import bpy, math, os
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
bpy.ops.wm.read_homefile(use_empty=True)
sc=bpy.context.scene; sc.unit_settings.length_unit='MILLIMETERS'
col=bpy.data.collections.new('Font_T12'); sc.collection.children.link(col)
def X(x): return (x+0.18)/1000
def Zm(y): return (y+99)/1000
def mat(name,hexc,met=0.0,rough=0.5,tex=None):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; b=nt.nodes['Principled BSDF']
    c=[int(hexc[i:i+2],16)/255 for i in (0,2,4)]; lin=[x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c]
    b.inputs['Base Color'].default_value=(*lin,1); b.inputs['Metallic'].default_value=met; b.inputs['Roughness'].default_value=rough
    if tex:
        im=nt.nodes.new('ShaderNodeTexImage'); im.image=bpy.data.images.load(tex); im.image.pack()
        nt.links.new(im.outputs['Color'],b.inputs['Base Color']); nt.links.new(im.outputs['Alpha'],b.inputs['Alpha']); m.blend_method='CLIP'; m.alpha_threshold=0.5
    return m
M={'alumini':mat('alumini','C7C8CA',0.5,0.35),'carcassa':mat('carcassa','1E1F22',0.2,0.6),'dissipador':mat('dissipador','1A1B1D',0.3,0.45),
   'panell':mat('panell','202124',0.0,0.55),'finestra':mat('finestra','FFA000',0.0,0.45),'negre':mat('negre','111214',0.0,0.7),
   'metall':mat('metall','C9CCCF',0.5,0.3),'led':mat('led','2E9B3F',0.0,0.3),
   'serigrafia':mat('serigrafia','FFFFFF',0.0,0.55,os.path.join(D,'tex','font_t12_serigrafia.png'))}
def link(o,m):
    o.data.materials.append(M[m])
    for c in o.users_collection: c.objects.unlink(o)
    col.objects.link(o); return o
def box(name,x0,x1,y0,y1,z0,z1,m,bev=0.0):
    bpy.ops.mesh.primitive_cube_add(); o=bpy.context.object; o.name=name
    o.dimensions=(x1-x0,y1-y0,z1-z0); o.location=((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); bpy.ops.object.transform_apply(scale=True)
    if bev: md=o.modifiers.new('bisell','BEVEL'); md.width=bev; md.segments=2; md.limit_method='ANGLE'
    return link(o,m)
YF=-0.092                                                          # pla frontal
# --- xassís d'alumini: tapes superior i inferior i lateral dret (perfil en C)
box('tapa_sup',X(-21.17),X(34.82),YF,0.0,Zm(94.95),Zm(98.95),'alumini',0.0005)
box('tapa_inf',X(-21.17),X(34.82),YF,0.0,Zm(-99.05),Zm(-95.05),'alumini',0.0005)
box('lateral',X(30.32),X(34.82),YF,0.0,Zm(-95.05),Zm(94.95),'alumini',0.0004)
box('cos',X(-21.18),X(30.32),YF+0.0008,0.0,Zm(-95.05),Zm(94.95),'carcassa')
# --- dissipador d'aletes al costat esquerre (7 aletes verticals d'1,2 mm)
for i in range(7):
    x0=-35.18+i*(14.0-1.2)/6
    box('aleta',X(x0),X(x0+1.2),YF+0.003,0.0,Zm(-94.7),Zm(94.6),'dissipador',0.0003)
box('base_aletes',X(-35.18),X(-21.18),-0.006,0.0,Zm(-94.7),Zm(94.6),'dissipador')
# --- panell frontal, finestra taronja i serigrafia
box('panell',X(-20.36),X(30.32),YF-0.0006,YF+0.0008,Zm(-94.05),Zm(75.35),'panell',0.0002)
box('finestra',X(-20.36),X(30.32),YF-0.0008,YF+0.0008,Zm(75.35),Zm(95.45),'finestra',0.0002)
bpy.ops.mesh.primitive_plane_add(size=1); o=bpy.context.object; o.name='serigrafia'
o.dimensions=(X(30.32)-X(-20.36),Zm(95.45)-Zm(-94.05),0); o.rotation_euler=(math.pi/2,0,0)
o.location=((X(30.32)+X(-20.36))/2,YF-0.00085,(Zm(95.45)+Zm(-94.05))/2); bpy.ops.object.transform_apply(location=False,rotation=True,scale=True); link(o,'serigrafia')
# --- connector PWR (2 × 3 contactes) i LED
x0,x1,z0,z1=X(-5.95),X(0.0),Zm(-36.9),Zm(-25.7)
box('pwr',x0,x1,YF-0.0024,YF,z0,z1,'negre',0.0003)
for i in range(2):
    for j in range(3):
        cx=x0+0.0018+i*0.0024; cz=z0+0.0026+j*0.003; box('pwr_pin',cx-0.0005,cx+0.0005,YF-0.0026,YF-0.0022,cz-0.0005,cz+0.0005,'metall')
bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=0.0012,depth=0.0012,location=(X(-4.9),YF-0.0012,Zm(-14.3)),rotation=(math.pi/2,0,0)); link(bpy.context.object,'led')
# --- objecte buit: connector de sortida de 24 V (hi arriba el latiguillo)
e=bpy.data.objects.new('dc',None); e.location=((x0+x1)/2,YF-0.0024,(z0+z1)/2); col.objects.link(e)
# --- aplicar modificadors i unir per material
for o in list(col.objects):
    if o.type=='MESH':
        bpy.context.view_layer.objects.active=o
        for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
groups={}
for o in col.objects:
    if o.type=='MESH': groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,objs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    if len(objs)>1: bpy.ops.object.join()
    objs[0].name='font_'+name
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(D,'font_t12.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in col.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(D,'..','font_t12.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
print('OK',{k:len(v) for k,v in groups.items()})
