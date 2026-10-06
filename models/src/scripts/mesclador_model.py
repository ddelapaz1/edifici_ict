# Model 3D del mesclador TER + 2 SAT (Televes 740710, 98 × 76 × 27 mm) a partir del plànol frontal CAD (740710_b.dxf).
# Convenis: metres; origen al centre de la cara posterior; frontal cap a −Y (glTF: +Z).
# Plànol (mm): X = x/1000, Z = (y − 0,75)/1000 (el cos és simètric respecte de y = 0,75).
import bpy, bmesh, math, os
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
bpy.ops.wm.read_homefile(use_empty=True)
sc=bpy.context.scene; sc.unit_settings.length_unit='MILLIMETERS'
col=bpy.data.collections.new('Mesclador'); sc.collection.children.link(col)
mm=lambda v: v/1000
def mat(name,hexc,met=0.0,rough=0.5,tex=None):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; b=nt.nodes['Principled BSDF']
    c=[int(hexc[i:i+2],16)/255 for i in (0,2,4)]; lin=[x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c]
    b.inputs['Base Color'].default_value=(*lin,1); b.inputs['Metallic'].default_value=met; b.inputs['Roughness'].default_value=rough
    if tex: im=nt.nodes.new('ShaderNodeTexImage'); im.image=bpy.data.images.load(tex); im.image.pack(); nt.links.new(im.outputs['Color'],b.inputs['Base Color'])
    return m
M={'zamak':mat('zamak','BFC3C6',0.5,0.5),'metall':mat('metall','C9CCCF',0.5,0.3),'dielectric':mat('dielectric','F0EFE8',0.0,0.5),
   'tap':mat('tap','1E1E1E',0.0,0.6),'etiqueta':mat('etiqueta','FFFFFF',0.0,0.55,os.path.join(D,'tex','mesclador_etiqueta.png'))}
def link(o,m):
    o.data.materials.append(M[m])
    for c in o.users_collection: c.objects.unlink(o)
    col.objects.link(o); return o
def apply_all(o):
    bpy.context.view_layer.objects.active=o
    for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
def bevel(o,w,seg=2):
    md=o.modifiers.new('b','BEVEL'); md.width=w; md.segments=seg; md.limit_method='ANGLE'; apply_all(o); return o
def box(name,x0,x1,y0,y1,z0,z1,m=None):
    bpy.ops.mesh.primitive_cube_add(); o=bpy.context.object; o.name=name
    o.dimensions=(x1-x0,y1-y0,z1-z0); o.location=((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); bpy.ops.object.transform_apply(scale=True)
    return link(o,m) if m else o
def rrect(name,x0,x1,z0,z1,r,y0,y1,m):
    bm=bmesh.new(); pts=[]
    for cx,cz,a0 in ((x1-r,z1-r,0),(x0+r,z1-r,90),(x0+r,z0+r,180),(x1-r,z0+r,270)):
        for i in range(7): a=math.radians(a0+i*15); pts.append((cx+r*math.cos(a),cz+r*math.sin(a)))
    vs=[bm.verts.new((x,y0,z)) for x,z in pts]; f=bm.faces.new(vs)
    ext=bmesh.ops.extrude_face_region(bm,geom=[f])
    for v in [e for e in ext['geom'] if isinstance(e,bmesh.types.BMVert)]: v.co.y=y1
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o=bpy.data.objects.new(name,me); sc.collection.objects.link(o); return link(o,m)
def cyl(name,x,z0,z1,y,r,m,n=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=abs(z1-z0),location=(x,y,(z0+z1)/2)); o=bpy.context.object; o.name=name; return link(o,m)
Z=lambda y: (y-0.75)/1000
YP=-0.0135                                                     # fondària de l'eix dels connectors
# --- orelles de fixació amb forat de Ø 4,2 mm
for s in (-1,1):
    ear=rrect('orella',mm(37.0) if s>0 else mm(-48.94),mm(48.94) if s>0 else mm(-37.0),Z(-22.25),Z(23.75),mm(2.0),0.0,-0.006,'zamak')
    h=box('h',mm(s*43.6-2.1),mm(s*43.6+2.1),0.005,-0.012,mm(-2.1),mm(2.1)); md=h.modifiers.new('r','BEVEL'); md.width=mm(2.05); md.segments=8; md.affect='EDGES'; apply_all(h)
    md=ear.modifiers.new('f','BOOLEAN'); md.operation='DIFFERENCE'; md.object=h; md.solver='EXACT'; apply_all(ear); bpy.data.objects.remove(h,do_unlink=True)
    bevel(ear,0.0004)
# --- cos de zamac, llistons dels connectors i plataforma de l'etiqueta
bevel(rrect('cos',mm(-37.74),mm(37.74),Z(-22.05),Z(23.55),mm(3.0),0.0,-0.016,'zamak'),0.0012,3)
for s in (1,-1): bevel(box('llisto',mm(-31.0),mm(31.0),-0.006,-0.021,Z(23.0) if s>0 else Z(-28.14),Z(29.64) if s>0 else Z(-21.5),'zamak'),0.0012,3)
bevel(rrect('plataforma',mm(-35.2),mm(35.2),Z(-20.6),Z(22.1),mm(2.0),-0.015,-0.0228,'zamak'),0.0012,2)
bpy.ops.mesh.primitive_plane_add(size=1); o=bpy.context.object; o.name='etiqueta'
o.dimensions=(mm(68.0),mm(40.0),0); o.rotation_euler=(math.pi/2,0,0); o.location=(0,-0.02295,Z(0.75)); bpy.ops.object.transform_apply(location=False,rotation=True,scale=True); link(o,'etiqueta')
# --- connectors F femella (rosca de 3/8") i tap negre a la posició inferior central (sense ús)
TIP=0.0365
for s in (1,-1):
    for x in (-26.0,0.0,26.0):
        z0=s*0.02814 if s>0 else -0.02814; z1=s*TIP; X=mm(x)
        if s<0 and x==0.0:
            cyl('tap',X,z0,z1+0.0005,YP,0.0052,'tap',32); continue
        cyl('virolla',X,z0,z0+s*0.0015,YP,0.0058,'metall',6)
        cyl('rosca',X,z0+s*0.0015,z1,YP,0.00476,'metall',24)
        for k in range(4): z=z0+s*(0.0025+k*0.0016); cyl('filet',X,z,z+s*0.0006,YP,0.0049,'metall',24)
        cyl('dielectric',X,z1-s*0.0004,z1+s*0.0001,YP,0.00175,'dielectric',20)
        cyl('viu',X,z1-s*0.0005,z1+s*0.0004,YP,0.0005,'metall',10)
for name,x,s in (('sa',-26,1),('ter',0,1),('sb',26,1),('oa',-26,-1),('oc',0,-1),('ob',26,-1)):
    e=bpy.data.objects.new(name,None); e.location=(mm(x),YP,s*TIP); col.objects.link(e)
for name,s in (('forat_e',-1),('forat_d',1)):
    e=bpy.data.objects.new(name,None); e.location=(mm(s*43.6),-0.006,0.0); col.objects.link(e)
# --- unir per material
groups={}
for o in col.objects:
    if o.type=='MESH': groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,objs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    if len(objs)>1: bpy.ops.object.join()
    objs[0].name='mix_'+name
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(D,'mesclador.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in col.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(D,'..','mesclador.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
print('OK',{k:len(v) for k,v in groups.items()})
