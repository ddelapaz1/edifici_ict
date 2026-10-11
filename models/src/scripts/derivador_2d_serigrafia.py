# Serigrafia del derivador F 2D (Televes 519322/519323, 74 × 54 × 18 mm) composta a partir de la del 4D (derivador_serigrafia.png,
# executa abans derivador_serigrafia.py): mateixos símbols dels connectors amb el pas de 17 mm; textos reescrits («2D»). Sense logotip; el
# valor de derivació i la referència els escriu la web.
import os
from PIL import Image, ImageDraw, ImageFont
D=os.path.join(os.path.dirname(__file__),'..'); T=os.path.join(D,'tex')
src=Image.open(os.path.join(T,'derivador_serigrafia.png')); S=24; Y1=9.6
X0s=-46.0; X0,X1=-29.75,29.56                                        # placa frontal del 4D i del 2D (mm)
W=round((X1-X0)*S); H=src.height; out=Image.new('RGBA',(W,H),(52,55,59,0))
px=lambda x,x0: round((x-x0)*S)
ys=round((Y1+5.2)*S)                                                # franja inferior dels símbols (y < −5,2 mm)
for xs,xd in ((-42.6,-25.6),(-25.6,-8.6),(-8.6,8.4),(42.4,25.4)):    # entrada, derivacions 1 i 2, sortida
    a=px(xs-4,X0s); out.alpha_composite(src.crop((a,ys,a+8*S,H)),(px(xd-4,X0),ys))
lx=px(13.6,X0s); out.alpha_composite(src.crop((lx,0,src.width,round((Y1+2.5)*S))),(W-(src.width-lx),0))  # marques de conformitat i terra
# textos amb tipografia (els del plànol són traços: «TAP/ABZWEIGER 2D» i «5-2400MHz», mateixa alçada i posició)
g=ImageDraw.Draw(out); f=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Narrow.ttf',round(2.55*S))
for txt,yb in (('TAP/ABZWEIGER  2D',round(10.75*S)),('5–2400MHz',round(13.75*S))): g.text((px(-28.8,X0),yb),txt,font=f,fill=(52,55,59,255),anchor='ls')
out.save(os.path.join(T,'derivador_2d_serigrafia.png'))
pv=Image.new('RGB',(W,H),(200,203,206)); pv.paste((52,55,59),mask=out.split()[3]); pv.save(os.path.join(T,'derivador_2d_serigrafia_preview.png'))
print('OK',W,H)
