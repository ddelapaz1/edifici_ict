# Model 3D del multiplexor passiu RJ45 (Televes 546501, 142 × 60 × 24 mm) a partir del plànol frontal CAD (546501.dxf).
# Convenis: metres; origen al centre de la cara posterior; frontal cap a −Y (glTF: +Z). Plànol (mm): X = x/1000, Z = y/1000.
import bpy, bmesh, math, os
from mathutils import Vector
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
bpy.ops.wm.read_homefile(use_empty=True)
sc=bpy.context.scene; sc.unit_settings.length_unit='MILLIMETERS'
col=bpy.data.collections.new('Multiplexor'); sc.collection.children.link(col)
mm=lambda v: v/1000
def mat(name,hexc,met=0.0,rough=0.5,tex=None):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; b=nt.nodes['Principled BSDF']
    c=[int(hexc[i:i+2],16)/255 for i in (0,2,4)]; lin=[x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c]
    b.inputs['Base Color'].default_value=(*lin,1); b.inputs['Metallic'].default_value=met; b.inputs['Roughness'].default_value=rough
    if tex:
        im=nt.nodes.new('ShaderNodeTexImage'); im.image=bpy.data.images.load(tex); im.image.pack()
        nt.links.new(im.outputs['Color'],b.inputs['Base Color']); nt.links.new(im.outputs['Alpha'],b.inputs['Alpha']); m.blend_method='CLIP'; m.alpha_threshold=0.5
    return m
M={'carcassa':mat('carcassa','2A2C2F',0.0,0.6),'panell':mat('panell','1C1D20',0.0,0.55),'cavitat':mat('cavitat','0E0F10',0.0,0.8),
   'metall':mat('metall','C9CCCF',0.5,0.3),'contacte':mat('contacte','D9B44A',0.5,0.3),
   'serigrafia':mat('serigrafia','FFFFFF',0.0,0.5,os.path.join(D,'tex','multiplexor_serigrafia.png'))}
def link(o,m):
    o.data.materials.append(M[m])
    for c in o.users_collection: c.objects.unlink(o)
    col.objects.link(o); return o
def box(name,x0,x1,y0,y1,z0,z1,m=None,bev=0.0,seg=2):
    bpy.ops.mesh.primitive_cube_add(); o=bpy.context.object; o.name=name
    o.dimensions=(x1-x0,y1-y0,z1-z0); o.location=((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); bpy.ops.object.transform_apply(scale=True)
    if bev: md=o.modifiers.new('bisell','BEVEL'); md.width=bev; md.segments=seg; md.limit_method='ANGLE'
    if m: link(o,m)
    return o
def cut(target,cutter):
    md=target.modifiers.new('forat','BOOLEAN'); md.operation='DIFFERENCE'; md.object=cutter; md.solver='EXACT'
def apply_all(o):
    bpy.context.view_layer.objects.active=o
    for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
YF=-0.024                                                     # cara frontal
JX=[-41.96,-26.02,-10.08,5.86]; JR={'sup':14.29,'inf':-13.52}  # boques telefòniques (centres del plànol)
SX,SY=40.95,{'adsl':16.17,'line':-11.68}                      # boques apantallades
# --- cos i panell frontal
body=box('cos',mm(-60.45),mm(60.45),YF+0.0008,0.0,mm(-30.25),mm(30.25),'carcassa',0.002,3)
panel=box('panell',mm(-58.45),mm(58.45),YF,YF+0.0012,mm(-28.07),mm(27.7),'panell',0.0006)
apply_all(body); apply_all(panel)
# --- buidat de les boques: bisell (13,5 × 10,3 × 0,6 mm) i cavitat amb osca de la pestanya a dalt
def jack_cutters(cx,cz,bezel=True):
    cs=[]
    if bezel: cs.append(box('c',mm(cx-6.75),mm(cx+6.75),YF-0.001,YF+0.0006,mm(cz-5.15),mm(cz+5.15)))
    cs.append(box('c',mm(cx-5.95),mm(cx+5.95),YF-0.001,YF+0.014,mm(cz-3.9),mm(cz+2.6)))
    cs.append(box('c',mm(cx-3.0),mm(cx+3.0),YF-0.001,YF+0.014,mm(cz+2.0),mm(cz+4.4)))
    return cs
def union(cs):
    u=cs[0]
    for c in cs[1:]:
        md=u.modifiers.new('u','BOOLEAN'); md.operation='UNION'; md.object=c; md.solver='EXACT'
    apply_all(u)
    for c in cs[1:]: bpy.data.objects.remove(c,do_unlink=True)
    return u
# carcassa i panell: boques telefòniques + allotjament de les gàbies apantallades (la cavitat la fa la gàbia)
cs=[]
for r in JR.values():
    for x in JX: cs+=jack_cutters(x,r)
for y in SY.values(): cs.append(box('c',mm(SX-7.75),mm(SX+7.75),YF-0.001,YF+0.0101,mm(y-7.48),mm(y+7.48)))
u=union(cs)
for t in (body,panel): cut(t,u); apply_all(t)
bpy.data.objects.remove(u,do_unlink=True)
u=union([c for y in SY.values() for c in jack_cutters(SX,y,False)])
# fons fosc de les cavitats
for r in JR.values():
    for x in JX: box('fons',mm(x-6),mm(x+6),YF+0.0135,YF+0.014,mm(r-4),mm(r+4.5),'cavitat')
for y in SY.values(): box('fons',mm(SX-6),mm(SX+6),YF+0.0135,YF+0.014,mm(y-4),mm(y+4.5),'cavitat')
# --- gàbia metàl·lica de les boques apantallades (ADSL Out i Line In)
for y in SY.values():
    cage=box('gabia',mm(SX-7.74),mm(SX+7.74),YF-0.0006,YF+0.010,mm(y-7.47),mm(y+7.47),'metall',0.0003)
    apply_all(cage); cut(cage,u); apply_all(cage)
# --- contactes daurats (a la part inferior de la cavitat, oposats a l'osca)
def contacts(cx,cz):
    for i in range(8):
        x=cx+(i-3.5)*1.02; box('contacte',mm(x-0.22),mm(x+0.22),YF+0.003,YF+0.011,mm(cz-3.9),mm(cz-3.3),'contacte')
for r in JR.values():
    for x in JX: contacts(x,r)
for y in SY.values(): contacts(SX,y)
bpy.data.objects.remove(u,do_unlink=True)
# --- serigrafia
bpy.ops.mesh.primitive_plane_add(size=1); o=bpy.context.object; o.name='serigrafia'
o.dimensions=(mm(116.9),mm(55.77),0); o.rotation_euler=(math.pi/2,0,0); o.location=(0,YF-0.00005,mm((27.7-28.07)/2))
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True); link(o,'serigrafia')
# --- orelles de fixació amb ranura per al cargol (perfil del plànol)
for s in (-1,1):
    bm=bmesh.new(); pts=[(60.0,-29.75),(71.0,-29.75),(71.0,-0.75)]
    for i in range(1,13):                                            # corba fins al cos
        t=i/12; p0=Vector((71.0,-0.75)); p1=Vector((71.0,20.0)); p2=Vector((60.95,24.95)); q=(1-t)**2*p0+2*(1-t)*t*p1+t*t*p2; pts.append((q.x,q.y))
    pts.append((60.0,24.95))
    vs=[bm.verts.new((mm(s*x),0.0,mm(y))) for x,y in pts]; f=bm.faces.new(vs if s>0 else vs[::-1])
    bmesh.ops.extrude_face_region(bm,geom=[f]); 
    for v in bm.verts:
        if abs(v.co.y)<1e-9 and v not in vs: v.co.y=-0.0018
    me=bpy.data.meshes.new('orella'); bm.to_mesh(me); bm.free(); ob=bpy.data.objects.new('orella',me); sc.collection.objects.link(ob); link(ob,'carcassa')
    bpy.context.view_layer.objects.active=ob; bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=mm(2.1),depth=0.01,location=(mm(s*65.5),0,mm(-17.5)),rotation=(math.pi/2,0,0)); h1=bpy.context.object
    bpy.ops.mesh.primitive_cube_add(); h2=bpy.context.object; h2.dimensions=(mm(4.2),0.01,mm(5.0)); h2.location=(mm(s*65.5),0,mm(-20.0))
    bpy.ops.object.transform_apply(scale=True)
    for h in (h1,h2): cut(ob,h)
    apply_all(ob)
    for h in (h1,h2): bpy.data.objects.remove(h,do_unlink=True)
# --- objectes buits: boques (els fa servir la web per endollar-hi els connectors)
k=1
for r in ('sup','inf'):
    for x in JX:
        e=bpy.data.objects.new(f'j{k}',None); e.location=(mm(x),YF,mm(JR[r])); col.objects.link(e); k+=1
for n,y in SY.items(): e=bpy.data.objects.new(n,None); e.location=(mm(SX),YF,mm(y)); col.objects.link(e)
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
    objs[0].name='mux_'+name
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(D,'multiplexor.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in col.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(D,'..','multiplexor.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
print('OK',{k:len(v) for k,v in groups.items()})
