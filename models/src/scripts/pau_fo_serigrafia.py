# Etiqueta del PAU de fibra òptica (Televes 231502) a partir del plànol frontal CAD (231502_a.dxf).
# Etiqueta negra de 79,6 × 24,3 mm; textos i icones en blanc, quadre d'advertència groc i quadre blanc per escriure-hi.
# El logotip de la tapa no forma part de l'etiqueta i no es reprodueix.
import math, os
from PIL import Image, ImageDraw, ImageChops
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
SRC=os.path.join(D,'231502_a.dxf'); OUT=os.path.join(D,'tex','pau_fo_serigrafia.png')
L=open(SRC,encoding='utf-8',errors='ignore').read().splitlines(); P=[(L[i].strip(),L[i+1].strip()) for i in range(0,len(L)-1,2)]
ents=[]; sec=None; cur=None
for c,v in P:
    if c=='0' and v=='SECTION': sec='?'; continue
    if c=='2' and sec=='?': sec=v; continue
    if sec!='ENTITIES': continue
    if c=='0':
        if cur: ents.append(cur)
        cur={'t':v,'g':[]}
    elif cur: cur['g'].append((c,v))
ents.append(cur)
def g(e,c,d=0.0):
    for k,v in e['g']:
        if k==c: return float(v)
    return d
def arcpts(cx,cy,r,a0,a1):
    if a1<=a0: a1+=2*math.pi
    n=max(8,int((a1-a0)/(2*math.pi)*48)); return [(cx+r*math.cos(a0+(a1-a0)*i/n),cy+r*math.sin(a0+(a1-a0)*i/n)) for i in range(n+1)]
figs=[]; poly=None
for e in ents:
    t=e['t']
    if t=='LINE': figs.append(([(g(e,'10'),g(e,'20')),(g(e,'11'),g(e,'21'))],False))
    elif t=='ARC': figs.append((arcpts(g(e,'10'),g(e,'20'),g(e,'40'),math.radians(g(e,'50')),math.radians(g(e,'51'))),False))
    elif t=='CIRCLE': figs.append((arcpts(g(e,'10'),g(e,'20'),g(e,'40'),0,2*math.pi-1e-6),True))
    elif t=='POLYLINE': poly={'p':[],'c':int(g(e,'70'))&1}
    elif t=='VERTEX' and poly is not None: poly['p'].append((g(e,'10'),g(e,'20')))
    elif t=='SEQEND' and poly is not None: figs.append((poly['p'],poly['c'] or (len(poly['p'])>3 and math.dist(poly['p'][0],poly['p'][-1])<1e-3))); poly=None
def bb(p): xs=[a for a,b in p]; ys=[b for a,b in p]; return min(xs),max(xs),min(ys),max(ys)
X0,X1,Y0,Y1=-39.8,39.8,-19.69,4.61; S=24                   # etiqueta (mm)
WB=(-6.01,36.8,-5.86,2.51); YB=(-6.1,29.09,-16.68,-7.48)   # quadre blanc i quadre groc
W=round((X1-X0)*S); H=round((Y1-Y0)*S); px=lambda x,y:((x-X0)*S,(Y1-y)*S)
inside=lambda b,r:b[0]>=r[0]-0.05 and b[1]<=r[1]+0.05 and b[2]>=r[2]-0.05 and b[3]<=r[3]+0.05
img=Image.new('RGB',(W,H),(26,26,27)); d=ImageDraw.Draw(img)
d.rectangle([px(WB[0],WB[3]),px(WB[1],WB[2])],fill=(250,250,248))
d.rectangle([px(YB[0],YB[3]),px(YB[1],YB[2])],fill=(255,222,0))
fm=Image.new('1',(W,H),0); ln=Image.new('L',(W,H),0); dl=ImageDraw.Draw(ln)
for p,closed in figs:
    b=bb(p)
    if not inside(b,(X0+0.15,X1-0.15,Y0+0.15,Y1-0.15)): continue
    if max(b[1]-b[0],b[3]-b[2])>30: continue
    if inside(b,WB) and (b[1]-b[0])>30: continue                # contorn del quadre blanc
    if inside(b,YB) and (b[1]-b[0])>30: continue                # contorn del quadre groc
    if closed and len(p)>3:
        t=Image.new('1',(W,H),0); ImageDraw.Draw(t).polygon([px(*q) for q in p],fill=1); fm=ImageChops.logical_xor(fm,t)
    else: dl.line([px(*q) for q in p],fill=255,width=3)
ink=ImageChops.lighter(ln,fm.convert('L'))
# colors de les icones de sortida: 3 blau, 4 blanc, 1 verd, 2 taronja (com l'etiqueta real)
col=Image.new('RGB',(W,H),(255,255,255)); dc=ImageDraw.Draw(col)
dc.rectangle([px(-39.8,-5.0),px(-28.9,-11.1)],fill=(59,169,224)); dc.rectangle([px(-39.8,-11.6),px(-28.9,-19.69)],fill=(118,188,67))
dc.rectangle([px(-28.6,-11.6),px(-18,-19.69)],fill=(242,107,33))
dc.rectangle([px(YB[0],YB[3]),px(YB[1],YB[2])],fill=(26,26,27))
img.paste(col,mask=ink)
os.makedirs(os.path.dirname(OUT),exist_ok=True); img.save(OUT); print(W,H)
