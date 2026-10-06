# Connector F mascle roscat Televes 417101, perfil del DWG CAD07190354 facilitat per l'usuari.
# Mides llegides del bloc 417101 (mm): L=21,10586; cos Ø8,82352; hexàgon Ø12,59999 (10,91192 entre cares).
# Fotos de referència: cos moletejat i femella oberta. Rosca interior 3/8-32 UNEF aproximada; sense logotips.
# El viu és el conductor del cable pelat: no és una peça del connector buit.
# Metres; boca a l'origen; cos cap a +Z a Blender, +Y en glTF. Marcadors: mouth, cable.
import bpy, math, os

D=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
bpy.ops.wm.read_homefile(use_empty=True)
sc=bpy.context.scene
sc.unit_settings.system='METRIC'
sc.unit_settings.length_unit='MILLIMETERS'
L=21.10585939695954
N=96
R=6.299992996765
AF=R*math.cos(math.pi/6)
mat=bpy.data.materials.new('niquel'); mat.use_nodes=True
bs=mat.node_tree.nodes['Principled BSDF']
bs.inputs['Base Color'].default_value=(0.584,0.604,0.624,1)
bs.inputs['Metallic'].default_value=0.5
bs.inputs['Roughness'].default_value=0.28
verts=[]; faces=[]

def ring(z, radius):
    out=[]
    for i in range(N):
        a=2*math.pi*i/N
        r=radius(a) if callable(radius) else radius
        out.append(len(verts)); verts.append((r*math.cos(a)/1000,r*math.sin(a)/1000,z/1000))
    return out

def connect(a,b,reverse=False):
    for i in range(N):
        j=(i+1)%N
        f=(a[i],a[j],b[j],b[i])
        faces.append(tuple(reversed(f)) if reverse else f)

def hexr(a,cap):
    # Sis cares planes amb els extrems tornejats: cercle que limita l'hexàgon.
    u=(a+math.pi/6)%(math.pi/3)-math.pi/6
    return min(AF/math.cos(u),cap)

# Perfil exterior invertit respecte del plànol (boca a z=0; entrada de cable a z=L).
rows=[]
for z,cap in [(0,AF),(0.20,AF+0.16),(0.65,R),(4.04,R),(4.49,AF+0.16),(4.694113,AF)]:
    rows.append(ring(z,lambda a,c=cap:hexr(a,c)))
for z,r in [(4.76,5.34),(5.35,5.29),(6.45,5.05),(7.094110,4.852936),(7.18,4.058819),(9.94,4.058819),(10.005872,4.411760)]:
    rows.append(ring(z,r))
for j in range(49):
    z=10.085872+(L-10.165872)*j/48
    def knurl(a,z=z):
        t=(z-10.005872)/11.099988
        p=abs(math.sin(24*a+12*math.pi*t)*math.sin(24*a-12*math.pi*t))
        return 4.411760-0.22*p
    rows.append(ring(z,knurl))
rows.append(ring(L,4.33))
for a,b in zip(rows,rows[1:]): connect(a,b)

# Forat passant i seient del cable: cap tap opac a la boca ni conductor fictici.
inside=[]
for z,r in [(0,4.83),(0.20,4.72),(4.55,4.72),(4.76,3.65),(9.94,3.65),(10.005872,3.40),(L-0.15,3.40),(L,3.48)]:
    inside.append(ring(z,r))
for a,b in zip(inside,inside[1:]): connect(a,b,True)
connect(inside[0],rows[0]); connect(rows[-1],inside[-1])

# Filet helicoidal real en geometria (pas 25,4/32 mm); detall visual, no rosca de fabricació.
def thread(z0,z1,r,pitch,depth,width):
    turns=(z1-z0)/pitch; steps=math.ceil(turns*48); sections=[]
    for i in range(steps+1):
        a=2*math.pi*turns*i/steps; z=z0+(z1-z0)*i/steps
        ids=[]
        for rr,dz in [(r, -width/2),(r-depth,0),(r,width/2)]:
            ids.append(len(verts)); verts.append((rr*math.cos(a)/1000,rr*math.sin(a)/1000,(z+dz)/1000))
        sections.append(ids)
    for a,b in zip(sections,sections[1:]):
        for k in range(3): faces.append((a[k],b[k],b[(k+1)%3],a[(k+1)%3]))
    faces.append(tuple(reversed(sections[0]))); faces.append(tuple(sections[-1]))
thread(0.45,4.20,4.723,25.4/32,0.23,0.53)
thread(10.55,L-0.55,3.403,1.35,0.12,0.56)

me=bpy.data.meshes.new('conector_f'); me.from_pydata(verts,[],faces); me.update()
o=bpy.data.objects.new('conector_f_niquel',me); sc.collection.objects.link(o); me.materials.append(mat)
for p in me.polygons: p.use_smooth=True
# Les cares de la femella són planes; conserva la lectura de l'hexàgon.
for p in me.polygons:
    if len(p.vertices)==4 and all(0.00065-1e-8<=me.vertices[v].co.z<=0.00404+1e-8 for v in p.vertices): p.use_smooth=False
    if len(p.vertices)==4 and all(0.010085-1e-8<=me.vertices[v].co.z<=0.021026+1e-8 for v in p.vertices): p.use_smooth=False
for name,z in [('mouth',0),('cable',L/1000)]:
    e=bpy.data.objects.new(name,None); e.location=(0,0,z); sc.collection.objects.link(e)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(D,'conector_f.blend'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(D,'..','conector_f.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
print('OK connector F:',len(verts),'vèrtexs,',len(faces),'cares, llargada',L,'mm')
