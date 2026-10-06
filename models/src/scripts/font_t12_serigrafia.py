# Serigrafia del frontal de la font T12 (549812) a partir del plànol CAD del fabricant (FA_frontal.dxf).
# Inclou «T.12», la icona, el connector PWR amb el rètol i la reixeta de ventilació; sense logotips de marca.
import math, os
from PIL import Image, ImageDraw, ImageChops
D=os.path.join(os.path.dirname(__file__),'..')
SRC=os.path.join(D,'FA_frontal.dxf'); OUT=os.path.join(D,'tex','font_t12_serigrafia.png')
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
def g(e,c):
    for k,v in e['g']:
        if k==c: return float(v)
    return 0.0
figs=[]; poly=None
for e in ents:
    t=e['t']
    if t=='LINE': figs.append(([(g(e,'10'),g(e,'20')),(g(e,'11'),g(e,'21'))],'line'))
    elif t=='POLYLINE': poly=[]
    elif t=='VERTEX' and poly is not None: poly.append((g(e,'10'),g(e,'20')))
    elif t=='SEQEND' and poly is not None: figs.append((poly,'poly')); poly=None
def bb(p): xs=[a for a,b in p]; ys=[b for a,b in p]; return min(xs),max(xs),min(ys),max(ys)
def inside(p,x0,x1,y0,y1): a,b,c,d=bb(p); return a>=x0 and b<=x1 and c>=y0 and d<=y1
X0,X1,Y0,Y1=-20.36,30.32,-94.05,95.45; S=16
W=round((X1-X0)*S); H=round((Y1-Y0)*S); px=lambda x,y:((x-X0)*S,(Y1-y)*S)
ORANGE=(255,160,0); WHITE=(242,242,240); BLACK=(24,24,26)
layers=[]   # (color, mask)
def mask(): return Image.new('L',(W,H),0)
# «T.12» (contorns tancats, emplenats amb regla parell-senar)
mT=mask()
for p,k in figs:
    if k=='poly' and inside(p,-19,29,76,94) and (bb(p)[1]-bb(p)[0])<20:
        m=mask(); ImageDraw.Draw(m).polygon([px(*q) for q in p],fill=255); mT=ImageChops.logical_xor(mT.convert('1'),m.convert('1')).convert('L')
d=ImageDraw.Draw(mT)
for p,k in figs:                                   # parts del rètol dibuixades amb línies soltes (la «T.»)
    if k=='line' and inside(p,-19,29,76,94) and math.dist(*p[:2])<8: d.line([px(*q) for q in p],fill=255,width=3)
layers.append((BLACK,mT))
# icona (línies taronja)
mI=mask(); d=ImageDraw.Draw(mI)
for p,k in figs:
    if inside(p,1.8,8.5,54.9,61.6): d.line([px(*q) for q in p],fill=255,width=3)
layers.append((ORANGE,mI))
# connector PWR i rètol (línies blanques)
mP=mask(); d=ImageDraw.Draw(mP)
for p,k in figs:
    if inside(p,-13,1.0,-38,-24): d.line([px(*q) for q in p],fill=255,width=3)
layers.append((WHITE,mP))
# reixeta de ventilació: quadrats entre parelles de línies
sel=[p for p,k in figs if k=='line' and inside(p,-20,30,-65,-49)]
hy=sorted(set(round(p[0][1],2) for p in sel if abs(p[0][1]-p[1][1])<0.01)); vx=sorted(set(round(p[0][0],2) for p in sel if abs(p[0][0]-p[1][0])<0.01))
mG=mask(); d=ImageDraw.Draw(mG)
for i in range(0,len(vx)-1,2):
    for j in range(0,len(hy)-1,2): d.rectangle([px(vx[i],hy[j+1]),px(vx[i+1],hy[j])],fill=255)
layers.append((ORANGE,mG))
rgb=Image.new('RGB',(W,H),WHITE); alpha=mask()
for col,m in layers: rgb.paste(col,mask=m); alpha=ImageChops.lighter(alpha,m)
out=Image.merge('RGBA',(*rgb.split(),alpha)); os.makedirs(os.path.dirname(OUT),exist_ok=True); out.save(OUT)
pv=Image.new('RGB',(W,H),(30,31,34)); ImageDraw.Draw(pv).rectangle([px(X0,95.45),px(X1,75.35)],fill=ORANGE); pv.paste(out,mask=alpha); pv.resize((W//2,H//2)).save(OUT.replace('.png','_preview.png'))
print('OK',W,H,'reixeta',len(vx)//2,'x',len(hy)//2)
