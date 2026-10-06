# Serigrafia de la central AVANT 12 PRO SAT (Televes 532204) a partir del plànol frontal CAD (532204.dxf).
# Dues textures: la franja de rètols de la tapa d'aletes i el nom del producte al capçal esquerre. Sense logotip de marca.
import math, os
from PIL import Image, ImageDraw, ImageChops
D=os.path.join(os.path.dirname(__file__),'..')
SRC=os.path.join(D,'532204.dxf')
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
    elif t=='CIRCLE' and g(e,'40')<2: figs.append((arcpts(g(e,'10'),g(e,'20'),g(e,'40'),0,2*math.pi),True))
    elif t=='ARC' and g(e,'40')<3: figs.append((arcpts(g(e,'10'),g(e,'20'),g(e,'40'),math.radians(g(e,'50')),math.radians(g(e,'51'))),False))
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
def inside(p,x0,x1,y0,y1): a,b,c,d=bb(p); return a>=x0 and b<=x1 and c>=y0 and d<=y1
INK=(58,61,65); S=16
def render(name,X0,X1,Y0,Y1,zones,fill=False):
    W=round((X1-X0)*S); H=round((Y1-Y0)*S); px=lambda x,y:((x-X0)*S,(Y1-y)*S)
    m=Image.new('L',(W,H),0); d=ImageDraw.Draw(m); fm=Image.new('1',(W,H),0); n=0
    for p,closed in figs:
        a,b,c,e=bb(p)
        if not any(inside(p,*z) for z in zones) or max(b-a,e-c)>14: continue
        if fill and closed and len(p)>3:
            t=Image.new('1',(W,H),0); ImageDraw.Draw(t).polygon([px(*q) for q in p],fill=1); fm=ImageChops.logical_xor(fm,t)
        else: d.line([px(*q) for q in p],fill=255,width=2,joint='curve')
        n+=1
    m=ImageChops.lighter(m,fm.convert('L'))
    out=Image.new('RGBA',(W,H),(*INK,0)); out.putalpha(m); out.save(os.path.join(D,'tex',name+'.png'))
    pv=Image.new('RGB',(W,H),(200,203,206)); pv.paste(INK,mask=m); pv.save(os.path.join(D,'tex',name+'_preview.png'))
    print(name,W,H,n)
# tapa d'aletes: franges de rètols superior i inferior (les ranures queden fora)
render('avant_tapa',-67.39,68.35,-49.99,50.0,[(-67,68,42.3,49.9),(-67,68,-49.9,-42.3)])
# capçal esquerre: «AVANT 12 PRO-SAT» (text vertical)
render('avant_nom',-92.08,-67.41,-52.94,52.94,[(-90,-68,-30,30)],fill=True)
# El nom del producte està traçat amb línies soltes al plànol: es torna a escriure amb tipografia a la mateixa posició.
from PIL import ImageFont
def nom():
    X0,X1,Y0,Y1=-92.08,-67.41,-52.94,52.94; W=round((X1-X0)*S); H=round((Y1-Y0)*S); px=lambda x,y:((x-X0)*S,(Y1-y)*S)
    m=Image.new('L',(W,H),0)
    for txt,font,size,cx,y0,y1 in (('AVANT 12','Arial Bold.ttf',5.6,-79.9,-12.9,13.6),('PRO-SAT','Arial.ttf',3.6,-74.9,-12.7,2.3)):
        f=ImageFont.truetype('/System/Library/Fonts/Supplemental/'+font,round(size*S))
        l,t,r,b=f.getbbox(txt); im=Image.new('L',(r-l+4,b-t+4),0); ImageDraw.Draw(im).text((2-l,2-t),txt,font=f,fill=255)
        im=im.rotate(90,expand=True); L_=round((y1-y0)*S); im=im.resize((im.width,L_))
        x,yt=px(cx,y1); m.paste(im,(round(x-im.width/2),round(yt)),im)
    out=Image.new('RGBA',(W,H),(*INK,0)); out.putalpha(m); out.save(os.path.join(D,'tex','avant_nom.png'))
    pv=Image.new('RGB',(W,H),(200,203,206)); pv.paste(INK,mask=m); pv.save(os.path.join(D,'tex','avant_nom_preview.png')); print('avant_nom (tipografia)')
nom()
