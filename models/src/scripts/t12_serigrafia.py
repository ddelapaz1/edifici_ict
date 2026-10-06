# Serigrafia del frontal del T12 a partir del plànol CAD (509012): només elements comuns a tots els mòduls.
import math
from PIL import Image, ImageDraw, ImageChops
SRC='/Users/ddelapaz/code/edifici_ict/models/src/509012_CAD02230089.dxf'
OUT='/Users/ddelapaz/code/edifici_ict/models/src/tex/t12_serigrafia.png'
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
# figures: llista de (punts, tancada)
figs=[]; poly=None
def arcpts(cx,cy,r,a0,a1):
    if a1<=a0: a1+=2*math.pi
    n=max(12,int((a1-a0)/(2*math.pi)*64)); return [(cx+r*math.cos(a0+(a1-a0)*i/n),cy+r*math.sin(a0+(a1-a0)*i/n)) for i in range(n+1)]
for e in ents:
    t=e['t']
    if t=='LINE': figs.append(([(g(e,'10'),g(e,'20')),(g(e,'11'),g(e,'21'))],False))
    elif t=='CIRCLE': figs.append((arcpts(g(e,'10'),g(e,'20'),g(e,'40'),0,2*math.pi),True))
    elif t=='ARC': figs.append((arcpts(g(e,'10'),g(e,'20'),g(e,'40'),math.radians(g(e,'50')),math.radians(g(e,'51'))),False))
    elif t=='POLYLINE': poly={'p':[],'c':int(g(e,'70'))&1}
    elif t=='VERTEX' and poly is not None: poly['p'].append((g(e,'10'),g(e,'20')))
    elif t=='SEQEND' and poly is not None: figs.append((poly['p'],poly['c'] or (len(poly['p'])>3 and math.dist(poly['p'][0],poly['p'][-1])<1e-3))); poly=None
def bb(p): xs=[a for a,b in p]; ys=[b for a,b in p]; return min(xs),max(xs),min(ys),max(ys)
def inside(p,x0,x1,y0,y1): a,b,c,d=bb(p); return a>=x0 and b<=x1 and c>=y0 and d<=y1
# zones que es copien (mm, origen al centre del mòdul)
PORTS=[67.5,47.5,-47.5,-67.5]
keep_line=[]; keep_fill=[]
for p,cl in figs:
    a,b,c,d=bb(p); w=b-a; h=d-c
    if inside(p,-12.6,12.6,75.2,87.4) and w<20: keep_fill.append(p); continue              # «T.12» de la finestra
    if c>-61.5 and d<-53.5: continue                                                        # logotip «LTE ready» (marca)
    if inside(p,5.5,12.6,40.0,74.0) or inside(p,5.5,12.6,-74.0,-40.0): keep_line.append(p); continue   # icones d'entrada/sortida
    if inside(p,-4.5,7.5,-38.5,-25.5): keep_line.append(p); continue                       # connector PWR i rètol
    if inside(p,-13.0,-3.0,-64.0,-46.0): keep_fill.append(p); continue                     # reixeta de ventilació
S=16; X0,X1,Y0,Y1=-12.75,12.75,-87.78,87.81
W=round((X1-X0)*S); H=round((Y1-Y0)*S)
px=lambda x,y:((x-X0)*S,(Y1-y)*S)
ink=Image.new('L',(W,H),0); d=ImageDraw.Draw(ink)
for p in keep_line: d.line([px(*q) for q in p],fill=255,width=3,joint='curve')
fill=Image.new('L',(W,H),0)
for p in keep_fill:
    m=Image.new('L',(W,H),0); ImageDraw.Draw(m).polygon([px(*q) for q in p],fill=255); fill=ImageChops.logical_xor(fill.convert('1'),m.convert('1')).convert('L')
ink=ImageChops.lighter(ink,fill)
# color: blanc al panell, negre dins la finestra (sobre la franja de color)
rgb=Image.new('RGB',(W,H),(242,242,240)); win=Image.new('L',(W,H),0); ImageDraw.Draw(win).rectangle([px(X0,87.81),px(X1,74.58)],fill=255)
rgb.paste((24,24,26),mask=win)
out=Image.merge('RGBA',(*rgb.split(),ink)); out.save(OUT)
# vista prèvia sobre fons fosc / taronja
pv=Image.new('RGB',(W,H),(32,33,36)); pv.paste((245,124,0),mask=win); pv.paste(out,mask=out.split()[3]); pv.resize((W//2,H//2)).save(OUT.replace('.png','_preview.png'))
print('OK',W,H,len(keep_line),len(keep_fill))
