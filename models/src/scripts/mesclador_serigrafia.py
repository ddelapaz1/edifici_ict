# Etiqueta del mesclador TER + 2 SAT (Televes 740710) a partir del plànol frontal CAD (740710_b.dxf), sense el logotip.
import math, os
from PIL import Image, ImageDraw, ImageChops
D=os.path.join(os.path.dirname(__file__),'..')
SRC=os.path.join(D,'740710_b.dxf'); OUT=os.path.join(D,'tex','mesclador_etiqueta.png')
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
    elif t=='ELLIPSE':
        cx,cy,mx,my,ra,t0,t1=g(e,'10'),g(e,'20'),g(e,'11'),g(e,'21'),g(e,'40'),g(e,'41'),g(e,'42',2*math.pi)
        if t1<=t0: t1+=2*math.pi
        a=math.hypot(mx,my); an=math.atan2(my,mx); pts=[]
        for i in range(33):
            tt=t0+(t1-t0)*i/32; x=a*math.cos(tt); y=a*ra*math.sin(tt); pts.append((cx+x*math.cos(an)-y*math.sin(an),cy+x*math.sin(an)+y*math.cos(an)))
        figs.append((pts,abs(t1-t0-2*math.pi)<1e-3))
    elif t=='POLYLINE': poly={'p':[],'c':int(g(e,'70'))&1}
    elif t=='VERTEX' and poly is not None: poly['p'].append((g(e,'10'),g(e,'20')))
    elif t=='SEQEND' and poly is not None: figs.append((poly['p'],poly['c'] or (len(poly['p'])>3 and math.dist(poly['p'][0],poly['p'][-1])<1e-3))); poly=None
def bb(p): xs=[a for a,b in p]; ys=[b for a,b in p]; return min(xs),max(xs),min(ys),max(ys)
X0,X1,Y0,Y1=-34.0,34.0,-19.25,20.75; S=24
W=round((X1-X0)*S); H=round((Y1-Y0)*S); px=lambda x,y:((x-X0)*S,(Y1-y)*S)
ln=Image.new('L',(W,H),0); d=ImageDraw.Draw(ln); fm=Image.new('1',(W,H),0); n=0
for p,closed in figs:
    a,b,c,e=bb(p)
    if not (a>=-33.6 and b<=33.6 and c>=-19.0 and e<=20.5): continue          # només l'interior de l'etiqueta
    if a>=-16 and b<=16 and c>=1.0 and e<=11.8: continue                      # logotip de marca
    if closed and len(p)>3:
        t=Image.new('1',(W,H),0); ImageDraw.Draw(t).polygon([px(*q) for q in p],fill=1); fm=ImageChops.logical_xor(fm,t)
    else: d.line([px(*q) for q in p],fill=255,width=3,joint='curve')
    n+=1
ink=ImageChops.lighter(ln,fm.convert('L'))
img=Image.new('RGB',(W,H),(244,244,241)); img.paste((26,26,26),mask=ink)
os.makedirs(os.path.dirname(OUT),exist_ok=True); img.save(OUT); img.resize((W//2,H//2)).save(OUT.replace('.png','_preview.png'))
print('OK',W,H,n)
