# Serigrafia del frontal del multiplexor passiu RJ45 (Televes 546501) a partir del plànol CAD del fabricant (546501.dxf).
# Inclou les icones de telèfon amb el número i els rètols «ADSL Out» i «Line In»; sense el logotip de marca.
import math, os
from PIL import Image, ImageDraw
D=os.path.join(os.path.dirname(__file__),'..')
SRC=os.path.join(D,'546501.dxf'); OUT=os.path.join(D,'tex','multiplexor_serigrafia.png')
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
    if t=='LINE': figs.append([(g(e,'10'),g(e,'20')),(g(e,'11'),g(e,'21'))])
    elif t=='CIRCLE': figs.append(arcpts(g(e,'10'),g(e,'20'),g(e,'40'),0,2*math.pi))
    elif t=='ARC': figs.append(arcpts(g(e,'10'),g(e,'20'),g(e,'40'),math.radians(g(e,'50')),math.radians(g(e,'51'))))
    elif t=='ELLIPSE':
        cx,cy,mx,my,ra,t0,t1=g(e,'10'),g(e,'20'),g(e,'11'),g(e,'21'),g(e,'40'),g(e,'41'),g(e,'42',2*math.pi)
        if t1<=t0: t1+=2*math.pi
        a=math.hypot(mx,my); an=math.atan2(my,mx); pts=[]
        for i in range(33):
            tt=t0+(t1-t0)*i/32; x=a*math.cos(tt); y=a*ra*math.sin(tt); pts.append((cx+x*math.cos(an)-y*math.sin(an),cy+x*math.sin(an)+y*math.cos(an)))
        figs.append(pts)
    elif t=='POLYLINE': poly=[]
    elif t=='VERTEX' and poly is not None: poly.append((g(e,'10'),g(e,'20')))
    elif t=='SEQEND' and poly is not None: figs.append(poly); poly=None
def bb(p): xs=[a for a,b in p]; ys=[b for a,b in p]; return min(xs),max(xs),min(ys),max(ys)
def inside(p,x0,x1,y0,y1): a,b,c,d=bb(p); return a>=x0 and b<=x1 and c>=y0 and d<=y1
X0,X1,Y0,Y1=-58.45,58.45,-28.07,27.7; S=20
W=round((X1-X0)*S); H=round((Y1-Y0)*S); px=lambda x,y:((x-X0)*S,(Y1-y)*S)
from PIL import ImageFont
m=Image.new('L',(W,H),0); d=ImageDraw.Draw(m); n=0
ICX=[-43.51,-27.64,-11.64,4.08]; ROWY={4.53:[1,2,3,4],-2.09:[5,6,7,8]}   # centres de les icones de telèfon (cercles del plànol)
for p in figs:
    a,b,c,e=bb(p)
    if not inside(p,-50,14,-4.2,7.2) or (e-c)>4: continue        # només icones (sense contorns de les boques)
    if any(a>cx+2.6 and b<cx+10 for cx in ICX): continue           # els números del plànol estan mal traçats: es tornen a escriure
    d.line([px(*q) for q in p],fill=255,width=3,joint='curve'); n+=1
F=lambda sz: ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', round(sz*S))
for y,nums in ROWY.items():
    for cx,k in zip(ICX,nums): d.text(px(cx+6.0,y-0.1),str(k),font=F(3.2),fill=255,anchor='mm')
for txt,y in (('ADSL',21.6),('Out',18.6),('Line',-7.8),('In',-10.8)): d.text(px(54.0,y),txt,font=F(2.5),fill=255,anchor='mm')
out=Image.new('RGBA',(W,H),(236,239,241,0)); out.putalpha(m); os.makedirs(os.path.dirname(OUT),exist_ok=True); out.save(OUT)
pv=Image.new('RGB',(W,H),(28,29,32)); pv.paste((236,239,241),mask=m); pv.save(OUT.replace('.png','_preview.png'))
print('OK',W,H,n)
