# Model 3D del mòdul T12 (35 × 198 × 103 mm) a partir del plànol frontal CAD del fabricant.
# Convenis: metres; origen al centre de l'aresta inferior de la cara posterior; frontal cap a −Y (glTF: +Z).
# Coordenades del plànol (mm, origen al centre del frontal): X = x/1000, Z = (y + 99)/1000.
import bpy, bmesh, math
SRC='/Users/ddelapaz/code/edifici_ict/models/src/'
bpy.ops.wm.open_mainfile(filepath=SRC+'t12_plantilla.blend')
sc=bpy.context.scene
col=bpy.data.collections.new('T12'); sc.collection.children.link(col)
def mm(x,y): return x/1000, (y+99)/1000
def mat(name,hexc,met=0.0,rough=0.5,tex=None,alpha=False):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; b=nt.nodes['Principled BSDF']
    c=[int(hexc[i:i+2],16)/255 for i in (0,2,4)]; lin=[x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c]
    b.inputs['Base Color'].default_value=(*lin,1); b.inputs['Metallic'].default_value=met; b.inputs['Roughness'].default_value=rough
    if tex:
        im=nt.nodes.new('ShaderNodeTexImage'); im.image=bpy.data.images.load(tex); im.image.pack()
        nt.links.new(im.outputs['Color'],b.inputs['Base Color'])
        if alpha: nt.links.new(im.outputs['Alpha'],b.inputs['Alpha']); m.blend_method='CLIP'; m.alpha_threshold=0.5
    return m
M={'carcassa':mat('carcassa','1E1F22',0.3,0.55),'panell':mat('panell','26272A',0.0,0.6),'banda':mat('banda','F57C00',0.0,0.45),
   'metall':mat('metall','C9CCCF',1.0,0.32),'dielectric':mat('dielectric','F0EFE8',0.0,0.5),'negre':mat('negre','111214',0.0,0.7),
   'led':mat('led','2E9B3F',0.0,0.3),'serigrafia':mat('serigrafia','FFFFFF',0.0,0.6,SRC+'tex/t12_serigrafia.png',True)}
def link(o,m):
    o.data.materials.append(M[m]); 
    for c in o.users_collection: c.objects.unlink(o)
    col.objects.link(o); return o
def box(name,x0,x1,y0,y1,z0,z1,m,bev=0.0):
    bpy.ops.mesh.primitive_cube_add(); o=bpy.context.object; o.name=name
    o.dimensions=(x1-x0,y1-y0,z1-z0); o.location=((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); bpy.ops.object.transform_apply(scale=True)
    if bev: md=o.modifiers.new('bisell','BEVEL'); md.width=bev; md.segments=2; md.limit_method='ANGLE'
    return link(o,m)
def cyl(name,x,z,r,y0,y1,m,n=32):   # cilindre segons l'eix Y, de y0 a y1
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=abs(y1-y0),location=(x,(y0+y1)/2,z),rotation=(math.pi/2,0,0)); o=bpy.context.object; o.name=name
    return link(o,m)
YF=-0.103                                  # cara frontal (pla de referència dels ports)
# --- carcassa de zamac i tapes superior i inferior amb junta central
box('carcassa',-0.0175,0.0175,-0.100,0.0,0.0,0.198,'carcassa',0.001)
for (y0,y1) in [(95.02,99),(-99,-94.98)]:
    for sx in (-1,1): 
        x0,x1=(0.00025,0.0175) if sx>0 else (-0.0175,-0.00025); box('tapa',x0,x1,-0.1006,-0.0998,mm(0,y0)[1],mm(0,y1)[1],'carcassa',0.0002)
for y in (91.5,-91.5): box('junta',-0.00025,0.00025,-0.1004,-0.0999,mm(0,y-3.6)[1],mm(0,y+3.6)[1],'negre')
# --- panell frontal en dos graons i finestra de color
box('panell',-0.0135,0.0135,-0.1015,-0.0995,mm(0,-89.57)[1],mm(0,89.43)[1],'panell',0.0004)
box('panell_interior',-0.01275,0.01275,-0.1030,-0.1013,mm(0,-87.78)[1],mm(0,74.58)[1],'panell',0.0003)
box('finestra',-0.01275,0.01275,-0.1026,-0.1013,mm(0,74.58)[1],mm(0,87.81)[1],'banda',0.0002)
# --- serigrafia (pla amb textura i transparència) just davant del panell
bpy.ops.mesh.primitive_plane_add(size=1); o=bpy.context.object; o.name='serigrafia'
o.dimensions=(0.0255,0.17559,0); o.rotation_euler=(math.pi/2,0,0); o.location=(0,YF-0.00004,mm(0,(87.81-87.78)/2)[1]); bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
link(o,'serigrafia')
# --- connectors F femella (plànol: virolla Ø10, rosca Ø9,5, dielèctric Ø3,5, vius Ø1,5)
for y in (67.5,47.5,-47.5,-67.5):
    x,z=mm(0,y)
    cyl('virolla',x,z,0.005,YF,YF-0.002,'metall',6)
    cyl('rosca',x,z,0.00476,YF-0.002,YF-0.010,'metall',32)
    for k in range(6): cyl('filet',x,z,0.0049,YF-0.003-k*0.0012,YF-0.0035-k*0.0012,'metall',32)
    cyl('dielectric',x,z,0.00175,YF-0.0098,YF-0.0101,'dielectric',24)
    cyl('viu',x,z,0.0005,YF-0.0095,YF-0.0103,'metall',12)
# --- connector d'alimentació (PWR, 2 × 3 contactes) i LED
x0,z0=mm(1.2,-37.8); x1,z1=mm(7.0,-26.3)
box('pwr',x0,x1,YF-0.0018,YF+0.0002,z0,z1,'negre',0.0003)
for i in range(2):
    for j in range(3):
        cx=x0+0.0017+i*0.0024; cz=z0+0.0022+j*0.0036; box('pwr_forat',cx-0.0006,cx+0.0006,YF-0.0019,YF-0.0017,cz-0.0006,cz+0.0006,'metall')
x,z=mm(6.4,-15.1); cyl('led',x,z,0.0015,YF,YF-0.0009,'led',20)
# --- objectes buits: ports i connector d'alimentació (els fa servir el codi de la web)
for name,y in (('port_in1',67.5),('port_in2',47.5),('port_out1',-47.5),('port_out2',-67.5)):
    e=bpy.data.objects.new(name,None); e.location=(0,YF,mm(0,y)[1]); col.objects.link(e)
e=bpy.data.objects.new('dc',None); e.location=(mm(4.1,0)[0],YF-0.0018,mm(0,-32.05)[1]); col.objects.link(e)
# --- unir per material per tenir poques malles
for o in list(col.objects):
    if o.type=='MESH':
        for md in o.modifiers: 
            bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=md.name)
groups={}
for o in col.objects:
    if o.type=='MESH': groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,objs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    if len(objs)>1: bpy.ops.object.join()
    objs[0].name='T12_'+name
bpy.data.objects['plantilla_frontal'].hide_viewport=True
bpy.ops.wm.save_as_mainfile(filepath=SRC+'t12.blend')
# exportació: només la col·lecció T12
bpy.ops.object.select_all(action='DESELECT')
for o in col.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath='/Users/ddelapaz/code/edifici_ict/models/t12.glb',export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
print('OK', {k:len(v) for k,v in groups.items()})
