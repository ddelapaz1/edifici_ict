# Serigrafia del repartidor 2D (Televes 519602, PAU de TBA coaxial) a partir del plànol frontal CAD (519602.dxf).
# Sense logotip ni data de fabricació (MM/AA); es conserven la referència, les pèrdues i els símbols dels connectors.
import math, os
from PIL import Image, ImageDraw, ImageChops
D=os.path.join(os.path.dirname(__file__),'..')
SRC=os.path.join(D,'519602.dxf'); OUT=os.path.join(D,'tex','pau_tba_serigrafia.png')
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
    elif t=='ARC' and g(e,'40')<1.4: figs.append((arcpts(g(e,'10'),g(e,'20'),g(e,'40'),math.radians(g(e,'50')),math.radians(g(e,'51'))),False))
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
X0,X1,Y0,Y1=-29.75,29.56,-11.9,9.6; S=24
W=round((X1-X0)*S); H=round((Y1-Y0)*S); px=lambda x,y:((x-X0)*S,(Y1-y)*S)
ln=Image.new('L',(W,H),0); d=ImageDraw.Draw(ln); fm=Image.new('1',(W,H),0); n=0; skipped={}
for p,closed in figs:
    a,b,c,e=bb(p)
    if not (a>=X0 and b<=X1 and c>=Y0 and e<=Y1) or max(b-a,e-c)>12: continue
    if b<=-3.0 and c>=0.5: continue                                             # logotip de marca
    if a>=28.8 and e<=-2.0: continue                                            # data de fabricació (MM/AA), varia per unitat
    if closed and len(p)>3:
        t=Image.new('1',(W,H),0); ImageDraw.Draw(t).polygon([px(*q) for q in p],fill=1); fm=ImageChops.logical_xor(fm,t)
    else: d.line([px(*q) for q in p],fill=255,width=2,joint='curve')
    n+=1
ink=ImageChops.lighter(ln,fm.convert('L'))
out=Image.new('RGBA',(W,H),(52,55,59,0)); out.putalpha(ink); os.makedirs(os.path.dirname(OUT),exist_ok=True); out.save(OUT)
pv=Image.new('RGB',(W,H),(200,203,206)); pv.paste((52,55,59),mask=ink); pv.save(OUT.replace('.png','_preview.png'))
for k,v in skipped.items():
    if v: print(k,'bbox',round(min(x[0] for x in v),2),round(max(x[1] for x in v),2),round(min(x[2] for x in v),2),round(max(x[3] for x in v),2),len(v))
print('OK',W,H,n)
