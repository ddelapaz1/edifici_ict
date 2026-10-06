# Model 3D de la central AVANT 12 PRO SAT (Televes 532204, 201 × 120 × 42 mm) a partir del plànol frontal CAD (532204.dxf)
# i de fotografies del fabricant. Convenis: metres; origen al centre de la cara posterior; frontal cap a −Y (glTF: +Z).
# Coordenades del plànol (mm, origen al centre): X = x/1000, Z = y/1000. Fondària: brides 2 mm, cos 40 mm.
import bpy, bmesh, math, os
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
bpy.ops.wm.read_homefile(use_empty=True)
sc=bpy.context.scene; sc.unit_settings.length_unit='MILLIMETERS'
col=bpy.data.collections.new('AVANT'); sc.collection.children.link(col)
mm=lambda v: v/1000
def mat(name,hexc,met=0.0,rough=0.5,tex=None):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; b=nt.nodes['Principled BSDF']
    c=[int(hexc[i:i+2],16)/255 for i in (0,2,4)]; lin=[x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c]
    b.inputs['Base Color'].default_value=(*lin,1); b.inputs['Metallic'].default_value=met; b.inputs['Roughness'].default_value=rough
    if tex:
        im=nt.nodes.new('ShaderNodeTexImage'); im.image=bpy.data.images.load(tex); im.image.pack()
        nt.links.new(im.outputs['Color'],b.inputs['Base Color']); nt.links.new(im.outputs['Alpha'],b.inputs['Alpha']); m.blend_method='CLIP'; m.alpha_threshold=0.5
    return m
M={'alumini':mat('alumini','CDD0D3',0.5,0.4),'brida':mat('brida','C4C7CA',0.5,0.45),'boto':mat('boto','F39A1E',0.0,0.4),
   'led':mat('led','2E9B3F',0.0,0.3),'metall':mat('metall','C9CCCF',0.5,0.3),'dielectric':mat('dielectric','F5A000',0.0,0.45),
   'negre':mat('negre','161719',0.0,0.6),
   'serigrafia_tapa':mat('serigrafia_tapa','FFFFFF',0.0,0.5,os.path.join(D,'tex','avant_tapa.png')),
   'serigrafia_nom':mat('serigrafia_nom','FFFFFF',0.0,0.5,os.path.join(D,'tex','avant_nom.png'))}
def link(o,m):
    o.data.materials.append(M[m])
    for c in o.users_collection: c.objects.unlink(o)
    col.objects.link(o); return o
def apply_all(o):
    bpy.context.view_layer.objects.active=o
    for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
def box(name,x0,x1,y0,y1,z0,z1,m=None,bev=0.0):
    bpy.ops.mesh.primitive_cube_add(); o=bpy.context.object; o.name=name
    o.dimensions=(x1-x0,y1-y0,z1-z0); o.location=((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); bpy.ops.object.transform_apply(scale=True)
    if bev: md=o.modifiers.new('bisell','BEVEL'); md.width=bev; md.segments=3; md.limit_method='ANGLE'
    if m: link(o,m)
    return o
def cut(t,c): md=t.modifiers.new('tall','BOOLEAN'); md.operation='DIFFERENCE'; md.object=c; md.solver='EXACT'
def cyl(name,x,y,z,r,h,axis,m,n=32):
    rot={'y':(math.pi/2,0,0),'z':(0,0,0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=h,location=(x,y,z),rotation=rot); o=bpy.context.object; o.name=name; return link(o,m)
def rrect(name,x0,x1,z0,z1,r,y0,y1,m,holes=()):
    """perfil rectangular arrodonit al pla frontal (XZ), extrudit de y0 a y1"""
    bm=bmesh.new(); pts=[]
    for cx,cz,a0 in ((x1-r,z1-r,0),(x0+r,z1-r,90),(x0+r,z0+r,180),(x1-r,z0+r,270)):
        for i in range(9): a=math.radians(a0+i*90/8); pts.append((cx+r*math.cos(a),cz+r*math.sin(a)))
    vs=[bm.verts.new((x,y0,z)) for x,z in pts]; f=bm.faces.new(vs)
    ext=bmesh.ops.extrude_face_region(bm,geom=[f]); 
    for v in [e for e in ext['geom'] if isinstance(e,bmesh.types.BMVert)]: v.co.y=y1
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o=bpy.data.objects.new(name,me); sc.collection.objects.link(o); return link(o,m)
YT=-0.040                                                     # cara superior (frontal) del cos
# --- cos: dos capçals arrodonits (radi 16,44 mm) i secció central rebaixada als laterals (allotja els connectors)
body=rrect('cos',mm(-92.08),mm(92.08),mm(-52.94),mm(52.94),mm(16.44),0.0,YT,'alumini')
md=body.modifiers.new('bisell','BEVEL'); md.width=0.0025; md.segments=4; md.limit_method='ANGLE'; apply_all(body)
for s in (1,-1):
    c=box('c',mm(-67.41),mm(68.35),-0.05,0.01,mm(50.0) if s>0 else mm(-70),mm(70) if s>0 else mm(-50.0)); cut(body,c); apply_all(body); bpy.data.objects.remove(c,do_unlink=True)
# --- tapa acanalada: 16 ranures de 0,9 mm (interrompudes al voltant del botó)
GX=[-63.27,-54.77,-46.27,-37.77,-29.27,-20.77,-12.27,-3.77,4.73,13.23,21.73,30.23,38.73,47.23,55.73,64.23]
cs=[]
for x in GX:
    spans=[(-42.06,-10.3),(10.3,42.07)] if x in (-29.27,-20.77) else [(-42.06,42.07)]
    for z0,z1 in spans: cs.append(box('c',mm(x-0.45),mm(x+0.45),YT-0.001,YT+0.0012,mm(z0),mm(z1)))
for y in (42.49,-42.48): cs.append(box('c',mm(-66.9),mm(67.85),YT-0.001,YT+0.0004,mm(y-0.2),mm(y+0.2)))
u=cs[0]
for c in cs[1:]: m2=u.modifiers.new('u','BOOLEAN'); m2.operation='UNION'; m2.object=c; m2.solver='EXACT'
apply_all(u)
for c in cs[1:]: bpy.data.objects.remove(c,do_unlink=True)
cut(body,u); apply_all(body); bpy.data.objects.remove(u,do_unlink=True)
# --- botó taronja i LEDs
cyl('boto',mm(-25.02),YT-0.0008,0.0,mm(10.5),0.0016,'y','boto',48); bpy.context.object.modifiers.new('b','BEVEL').width=0.0005
cyl('anell',mm(-25.02),YT-0.0002,0.0,mm(10.75),0.0004,'y','alumini',48)
for x in (1.68,9.5): cyl('led',mm(x),YT-0.0003,mm(-47.56),mm(0.9),0.0008,'y','led',16)
# --- brides de fixació (2 mm) amb forats allargats i born de terra
for s in (-1,1):
    x0,x1=(mm(66.5),mm(100.17)) if s>0 else (mm(-100.17),mm(-70.5))
    fl=rrect('brida',x0,x1,mm(-61.13),mm(61.13),mm(3.0),0.0,-0.002,'brida')
    for hx,hz,horiz in ((s*93.0,54.0,s<0),(s*93.0,-54.0,s>0)):
        h1=box('h',mm(hx-(3.2 if horiz else 1.75)),mm(hx+(3.2 if horiz else 1.75)),-0.01,0.01,mm(hz-(1.75 if horiz else 3.2)),mm(hz+(1.75 if horiz else 3.2)))
        md=h1.modifiers.new('r','BEVEL'); md.width=mm(1.7); md.segments=6; md.affect='EDGES'; apply_all(h1); cut(fl,h1); apply_all(fl); bpy.data.objects.remove(h1,do_unlink=True)
box('born',mm(91.3),mm(99.3),-0.008,-0.002,mm(-7.0),mm(7.0),'brida',0.0005)
cyl('cargol',mm(95.29),-0.0088,0.0,mm(2.75),0.0016,'y','metall',24)
box('ranura',mm(93.6),mm(97.0),-0.0098,-0.0094,mm(-0.35),mm(0.35),'negre')
# --- connectors F femella (5 entrades a dalt, 3 a baix) amb aïllant taronja
YC=-0.020
TOP=[('in1',-11.18),('in2',5.82),('in3',22.82),('in4',39.82),('sat',56.82)]; BOT=[('fm',22.82),('tv',39.82),('tvsat',56.82)]
for lst,s in ((TOP,1),(BOT,-1)):
    for name,x in lst:
        z0=s*0.05033
        cyl('virolla',mm(x),YC,z0+s*0.00075,0.0056,0.0015,'z','metall',6)
        cyl('rosca',mm(x),YC,z0+s*(0.0015+0.0046),0.00476,0.0092,'z','metall',24)
        for k in range(4): cyl('filet',mm(x),YC,z0+s*(0.0028+k*0.002),0.0049,0.0006,'z','metall',24)
        cyl('aillant',mm(x),YC,z0+s*0.0106,0.0029,0.0006,'z','dielectric',24)
        cyl('viu',mm(x),YC,z0+s*0.0105,0.0005,0.0012,'z','metall',12)
        e=bpy.data.objects.new(name,None); e.location=(mm(x),YC,z0); col.objects.link(e)
# --- presa de corrent IEC C8 («vuit») al lateral inferior, sota el rètol POWER
pw=box('presa',mm(-60.5),mm(-45.5),YC-0.0045,YC+0.0045,mm(-51.0),mm(-50.0),'negre',0.0008)
for dx in (-3.6,3.6): cyl('pin',mm(-53+dx),YC,mm(-50.9),mm(0.9),0.0008,'z','metall',12)
e=bpy.data.objects.new('power',None); e.location=(mm(-53),YC,mm(-51.0)); col.objects.link(e)
e=bpy.data.objects.new('terra',None); e.location=(mm(95.29),-0.0096,0.0); col.objects.link(e)
# --- serigrafia (plans amb textura) sobre la tapa i el capçal esquerre
for name,m,x0,x1,z0,z1 in (('ser_tapa','serigrafia_tapa',-67.39,68.35,-49.99,50.0),('ser_nom','serigrafia_nom',-92.08,-67.41,-52.94,52.94)):
    bpy.ops.mesh.primitive_plane_add(size=1); o=bpy.context.object; o.name=name
    o.dimensions=(mm(x1-x0),mm(z1-z0),0); o.rotation_euler=(math.pi/2,0,0); o.location=(mm((x0+x1)/2),YT-0.00005,mm((z0+z1)/2))
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True); link(o,m)
# --- unir per material
for o in list(col.objects):
    if o.type=='MESH': apply_all(o)
groups={}
for o in col.objects:
    if o.type=='MESH': groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,objs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    if len(objs)>1: bpy.ops.object.join()
    objs[0].name='avant_'+name
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(D,'avant.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in col.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(D,'..','avant.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
print('OK',{k:len(v) for k,v in groups.items()})
