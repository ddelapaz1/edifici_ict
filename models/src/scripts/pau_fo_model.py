# Model 3D del PAU de fibra òptica (Televes 231502, 119 × 94 × 33 mm) a partir del plànol frontal CAD (231502_a.dxf).
# Fitxa del fabricant: 119 × 97 × 33 mm (97 amb els adaptadors que sobresurten per sota), ABS blanc RAL 9003,
# fins a 4 sortides SC/APC per la base (1 i 2 a la fila davantera, 3 i 4 a la del darrere), 6 entrades
# pretallades als laterals i una a la base. Sense logotip (el requadre de la tapa queda llis).
# Convenis: metres; origen al centre de la cara posterior; frontal cap a −Y (glTF: +Z). Plànol (mm): X = x, Z = y − C.
# Els adaptadors SC/APC són un model a part (adaptador_sc.glb): la web els col·loca als buits sc1…sc4.
# Buits: sc1…sc4 (boca exterior de cada adaptador), entrada_d i entrada_e (pretallat superior de cada lateral).
import bpy, bmesh, math, os
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
bpy.ops.wm.read_homefile(use_empty=True)
sc=bpy.context.scene; sc.unit_settings.length_unit='MILLIMETERS'
col=bpy.data.collections.new('PAU_FO'); sc.collection.children.link(col)
mm=lambda v: v/1000
C=1.66                                                        # centre vertical del cos al plànol (−45,16 … 48,48)
def mat(name,hexc,met=0.0,rough=0.5,tex=None):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; b=nt.nodes['Principled BSDF']
    c=[int(hexc[i:i+2],16)/255 for i in (0,2,4)]; lin=[x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c]
    b.inputs['Base Color'].default_value=(*lin,1); b.inputs['Metallic'].default_value=met; b.inputs['Roughness'].default_value=rough
    if tex:
        im=nt.nodes.new('ShaderNodeTexImage'); im.image=bpy.data.images.load(tex); im.image.pack()
        nt.links.new(im.outputs['Color'],b.inputs['Base Color'])
    return m
M={'carcassa':mat('carcassa','F4F4F0',0.0,0.45),'junt':mat('junt','D9D9D4',0.0,0.6),
   'etiqueta':mat('etiqueta','FFFFFF',0.0,0.35,os.path.join(D,'tex','pau_fo_serigrafia.png'))}
def link(o,m):
    o.data.materials.append(M[m])
    for c in o.users_collection: c.objects.unlink(o)
    col.objects.link(o); return o
def apply_all(o):
    bpy.context.view_layer.objects.active=o
    for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
def box(name,x0,x1,y0,y1,z0,z1,m=None,bev=0.0,seg=2):
    bpy.ops.mesh.primitive_cube_add(); o=bpy.context.object; o.name=name
    o.dimensions=(x1-x0,y1-y0,z1-z0); o.location=((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); bpy.ops.object.transform_apply(scale=True)
    if bev: md=o.modifiers.new('bisell','BEVEL'); md.width=bev; md.segments=seg; md.limit_method='ANGLE'
    if m: link(o,m)
    return o
def cyl(name,r,x,y,z,depth,axis,m=None,n=32):
    rot={'x':(0,math.pi/2,0),'y':(math.pi/2,0,0),'z':(0,0,0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=depth,location=(x,y,z),rotation=rot); o=bpy.context.object; o.name=name
    if m: link(o,m)
    return o
def cut(target,cutter):
    md=target.modifiers.new('forat','BOOLEAN'); md.operation='DIFFERENCE'; md.object=cutter; md.solver='EXACT'
def rrect(name,x0,x1,z0,z1,rt,rb,y0,y1,m=None,bev=0.0):
    """prisma de perfil rectangular arrodonit (radi rt a dalt, rb a baix) entre y0 i y1"""
    pts=[]
    for cx,cz,r,a0 in [(x1-rt,z1-rt,rt,0),(x0+rt,z1-rt,rt,90),(x0+rb,z0+rb,rb,180),(x1-rb,z0+rb,rb,270)]:
        for i in range(9): a=math.radians(a0+90*i/8); pts.append((cx+r*math.cos(a),cz+r*math.sin(a)))
    bm=bmesh.new(); vs=[bm.verts.new((x,y0,z)) for x,z in pts]; f=bm.faces.new(vs)
    r=bmesh.ops.extrude_face_region(bm,geom=[f])
    for v in [e for e in r['geom'] if isinstance(e,bmesh.types.BMVert)]: v.co.y=y1
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o=bpy.data.objects.new(name,me); sc.collection.objects.link(o)
    if bev: md=o.modifiers.new('bisell','BEVEL'); md.width=bev; md.segments=3; md.limit_method='ANGLE'; md.angle_limit=math.radians(40)
    if m: link(o,m)
    return o
# --- cos: base (0 … −12,4 mm) i tapa (−12,8 … −33 mm) amb el junt entremig
X0,X1,Z0,Z1=mm(-59.7),mm(59.7),mm(-45.16-C),mm(48.48-C); YF=mm(-33.0); YS0,YS1=mm(-12.4),mm(-12.8)
base=rrect('base',X0,X1,Z0,Z1,mm(6.0),mm(5.3),0.0,YS0,'carcassa',mm(0.5))
lid=rrect('tapa',X0,X1,Z0,Z1,mm(6.0),mm(5.3),YS1,YF,'carcassa',mm(1.4))
rrect('junt',X0+mm(0.4),X1-mm(0.4),Z0+mm(0.4),Z1-mm(0.4),mm(5.6),mm(4.9),mm(-12.2),mm(-13.0),'junt')
apply_all(base); apply_all(lid)
# --- tapa: requadre del logotip (llis, rebaixat 0,3 mm), finestra de l'etiqueta (rebaixada 0,8 mm) i osca semicircular
cs=[box('c',mm(-25.5),mm(25.5),YF-0.001,YF+mm(0.3),mm(13.96-C),mm(37.76-C)),
    box('c',mm(-40.1),mm(40.1),YF-0.001,YF+mm(0.8),mm(-20.01-C),mm(4.9-C)),
    cyl('c',mm(5.82),0,YF,mm(4.9-C),mm(1.6),'y',n=40)]
for c in cs: cut(lid,c)
apply_all(lid)
for c in cs: bpy.data.objects.remove(c,do_unlink=True)
# --- base: sortides SC (1, 2 a la fila davantera; 3, 4 darrere) i entrada pretallada inferior; laterals amb 3 + 3 entrades
PX={1:-41.23,2:-21.58,3:-41.23,4:-21.58}; PY={1:-23.5,2:-23.5,3:-10.0,4:-10.0}
ZB=mm(-45.16-C)
cs_l=[]; cs_b=[]
for k in (1,2):                                               # allotjament de l'adaptador (12,9 × 9,9 mm)
    c=box('c',mm(PX[k]-6.45),mm(PX[k]+6.45),mm(PY[k]-4.95),mm(PY[k]+4.95),ZB-0.001,ZB+mm(9)); (cs_l if PY[k]<-12.6 else cs_b).append(c)
for k in (3,4):                                               # pretallats tancats (solc de 0,3 mm)
    cs_b.append(box('c',mm(PX[k]-6.45),mm(PX[k]+6.45),mm(PY[k]-4.95),mm(PY[k]+4.95),ZB-0.001,ZB+mm(0.3)))
cs_l.append(box('c',mm(16.55),mm(30.1),mm(-22.0),mm(-14.0),ZB-0.001,ZB+mm(0.3)))   # accés al repartidor (plànol: 16,55 … 30,1)
SIDE=[25.0,0.0,-25.0]
for s in (-1,1):                                              # pretallats laterals (Ø7 mm, solc de 0,3 mm)
    for zz in SIDE: cs_b.append(cyl('c',mm(3.5),s*mm(59.7),mm(-7.0),mm(zz-C),mm(0.6),'x'))
for t,cl in ((lid,cs_l),(base,cs_b)):
    for c in cl: cut(t,c)
    apply_all(t)
    for c in cl: bpy.data.objects.remove(c,do_unlink=True)
# --- etiqueta (79,6 × 24,3 mm) al fons de la finestra
bpy.ops.mesh.primitive_plane_add(size=1); o=bpy.context.object; o.name='etiqueta'
o.dimensions=(mm(79.6),mm(24.3),0); o.rotation_euler=(math.pi/2,0,0); o.location=(0,YF+mm(0.75),mm((4.61-19.69)/2-C))
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True); link(o,'etiqueta')
# --- objectes buits: boca exterior de cada sortida SC (els adaptadors sobresurten 3,22 mm), entrada de l'acometida
for k in PX:
    e=bpy.data.objects.new(f'sc{k}',None); e.location=(mm(PX[k]),mm(PY[k]),mm(-48.38-C)); col.objects.link(e)
for n,s in (('entrada_d',1),('entrada_e',-1)):                # pretallat superior de cada lateral: entrada de l'acometida
    e=bpy.data.objects.new(n,None); e.location=(s*mm(59.7),mm(-7.0),mm(SIDE[0]-C)); col.objects.link(e)
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
    objs[0].name='pau_'+name
    for p in objs[0].data.polygons: p.use_smooth=False
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(D,'pau_fo.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in col.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(D,'..','pau_fo.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
print('OK',{k:len(v) for k,v in groups.items()})
