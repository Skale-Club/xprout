"""Create the brand manual and vector logo plates with embedded support fonts."""
import json
import sys
import math
import re
from pathlib import Path

from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.utils import simpleSplit
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else (Path(__file__).resolve().parent.parent if (Path(__file__).parent/'geometry.json').exists() else Path(__file__).resolve().parents[2]/'output/branding/xprout/xprout-brand-pack-v1')
G = json.loads((ROOT/'source/geometry.json').read_text())
L = json.loads((ROOT/'source/layouts.json').read_text())
MANIFEST = json.loads((ROOT/'brand-manifest.json').read_text())
FOREST, IVORY = '#283F32', '#F3EFE5'
W, H = 960, 640
for name, file in [('Body','Inter-Regular.ttf'),('Strong','Inter-SemiBold.ttf'),('Display','Fraunces-SemiBold.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(ROOT/'source/pdf-fonts'/file)))
text_boxes=[]

def color(c): return HexColor(c) if isinstance(c,str) else c
def mix(a,b,t):
    aa,bb=color(a),color(b)
    return Color(aa.red*(1-t)+bb.red*t,aa.green*(1-t)+bb.green*t,aa.blue*(1-t)+bb.blue*t)

def rect(x,y,w,h,fill=None,stroke=None,radius=0):
    if fill: C.setFillColor(color(fill))
    if stroke: C.setStrokeColor(color(stroke))
    C.setLineWidth(.6)
    if radius: C.roundRect(x,H-y-h,w,h,radius,fill=int(bool(fill)),stroke=int(bool(stroke)))
    else: C.rect(x,H-y-h,w,h,fill=int(bool(fill)),stroke=int(bool(stroke)))

def text(value,x,y,size=12,font='Body',ink=FOREST):
    C.setFillColor(color(ink)); C.setFont(font,size)
    C.drawString(x,H-y-size,value)
    text_boxes.append((C.getPageNumber(),x,y,pdfmetrics.stringWidth(value,font,size),size))

def para(value,x,y,width,size=12,leading=18,font='Body',ink=FOREST):
    for line in simpleSplit(value,font,size,width):
        text(line,x,y,size,font,ink);y+=leading
    return y

def line(x1,y1,x2,y2,ink=FOREST,width=.65,dash=None):
    C.setStrokeColor(color(ink));C.setLineWidth(width);C.setDash(dash or [])
    C.line(x1,H-y1,x2,H-y2);C.setDash([])

def path(d):
    values=re.findall(r'[MCQZmcqz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',d)
    result=C.beginPath();i=0;last=(0,0)
    while i<len(values):
        cmd=values[i];i+=1
        if cmd=='M':
            p=list(map(float,values[i:i+2]));i+=2;result.moveTo(*p);last=p
        elif cmd=='C':
            p=list(map(float,values[i:i+6]));i+=6;result.curveTo(*p);last=p[-2:]
        elif cmd=='Q':
            p=list(map(float,values[i:i+4]));i+=4
            a=[last[j]+2*(p[j]-last[j])/3 for j in range(2)]
            b=[p[j+2]+2*(p[j]-p[j+2])/3 for j in range(2)]
            result.curveTo(*a,*b,*p[2:]);last=p[2:]
        elif cmd=='Z': result.close()
        else: raise ValueError('Unsupported logo command '+cmd)
    return result

def shape(kind,x,y,scale,ink=FOREST,outline=False):
    item=G[kind];b=item['bounds']
    C.saveState();C.translate(x,H-y);C.scale(scale,-scale);C.translate(-b[0],-b[1]);C.setFillColor(color(ink));C.setStrokeColor(color(ink));C.setLineWidth(1.5/max(scale,.01))
    C.drawPath(path(item['d']),fill=int(not outline),stroke=int(outline),fillMode=0);C.restoreState()

def logo(kind,x,y,width,height,ink=FOREST,outline=False):
    layout=L[kind];scale=min(width/layout['w'],height/layout['h'])
    left=x+(width-layout['w']*scale)/2;top=y+(height-layout['h']*scale)/2
    for item in layout['items']:
        shape(item['kind'],left+item['x']*scale,top+item['y']*scale,item['scale']*scale,ink,outline)
    return left,top,layout['w']*scale,layout['h']*scale,layout['symbolHeight']*scale

def heading(number,kicker,title,subtitle=None,dark=False):
    bg,fg=(FOREST,IVORY)if dark else(IVORY,FOREST)
    rect(0,0,W,H,bg)
    text(f'{number:02d} / {kicker.upper()}',64,36,10,'Strong',fg)
    text(title,64,76,36,'Display',fg)
    if subtitle: para(subtitle,64,132,820,12,18,'Body',fg)

def footer(page,dark=False):
    fg=IVORY if dark else FOREST
    if page==5:
        line(64,596,440,596,mix(IVORY,FOREST,.7));line(520,596,896,596,mix(FOREST,IVORY,.7))
        text('Xprout Brand Manual',64,608,9,'Body',IVORY)
        text('Version 1.1 / 14 November 2026',536,608,9,'Body',FOREST)
        text('05',876,608,9,'Strong',FOREST);C.showPage();return
    line(64,596,896,596,mix(fg,FOREST if dark else IVORY,.7))
    text('Xprout Brand Manual',64,608,9,'Body',fg)
    text('Version 1.1 / 14 November 2026',364,608,9,'Body',fg)
    text(f'{page:02d}',876,608,9,'Strong',fg)
    C.showPage()

def bullet_block(title,body,x,y,width):
    text(title,x,y,13,'Strong');return para(body,x,y+26,width,12,18)

manual=ROOT/'manual/xprout-brand-manual.pdf'
C=canvas.Canvas(str(manual),pagesize=(W,H),pageCompression=1)
C.setTitle('Xprout Brand Manual');C.setAuthor('Xprout');C.setSubject('Logo system and brand use, version 1.1')

# 01 Cover
rect(0,0,W,H,FOREST)
text('XPROUT / IDENTITY SYSTEM',64,44,11,'Strong',IVORY)
text('Brand manual',64,90,46,'Display',IVORY)
logo('horizontal',64,244,832,150,IVORY)
para('The approved mark, its visual language and the rules that keep it consistent.',64,462,510,16,24,'Body',IVORY)
text('LOGO PACK V1.1',64,552,10,'Strong',IVORY)
footer(1,True)

# 02 Meaning
heading(2,'Brand idea','An organic X with a culinary detail')
para('Xprout is a digital menu platform for restaurants. The name echoes sprout; the X connects that idea to a distinctive product name.',64,156,360,15,23)
bullet_block('The symbol','Two spoon-bowl shapes live inside the organic X. The lower curves read as handles while the outer silhouette keeps its sprouting character.',64,268,360)
bullet_block('The voice','Write with warmth and precision. Use familiar food and restaurant language, direct actions and useful detail.',64,390,360)
logo('symbol',518,165,320,290)
line(510,488,896,488,mix(FOREST,IVORY,.7))
text('Xprout',518,510,18,'Strong')
text('Product name',670,514,11)
text('xprout.app',518,544,18,'Strong')
text('Web address',670,548,11)
footer(2)

# 03 Lockups
heading(3,'Logo system','The same identity in four forms','Use the horizontal signature by default. Choose another supplied form when the format needs it.')
rect(64,190,524,146,FOREST,radius=12)
logo('horizontal',90,222,472,84,IVORY)
text('01  Primary horizontal',64,349,12,'Strong')
logo('wordmark',646,206,240,100)
text('02  Wordmark',646,349,12,'Strong')
logo('stacked',94,389,256,154)
text('03  Stacked',64,558,12,'Strong')
logo('symbol',489,390,162,147)
text('04  Symbol',462,558,12,'Strong')
para('The lettering is supplied as outlined artwork. Never retype the logo or substitute a similar serif.',704,414,192,12,19)
footer(3)

# 04 Clear space
heading(4,'Spacing','Give the mark room to breathe','Clear space is measured from the visible artwork, not from the outer edge of an image file.')
bx,by,bw,bh,sh=logo('horizontal',112,220,736,131)
unit=sh/4
C.setStrokeColor(mix(FOREST,IVORY,.45));C.setDash([3,3]);C.rect(bx-unit,H-by-bh-unit,bw+2*unit,bh+2*unit,fill=0,stroke=1);C.setDash([])
line(bx-unit,by-12,bx,by-12);text('x',bx-unit/2-3,by-31,11,'Strong')
line(bx-13,by-unit,bx-13,by);text('x',bx-31,by-unit/2-7,11,'Strong')
text('x = 1/4 of the visible symbol height',306,387,13,'Strong')
for x,title,digital,print_size in [(64,'Horizontal','160 px','35 mm'),(352,'Stacked','96 px','22 mm'),(640,'Symbol','24 px','6 mm')]:
    line(x,441,x+256,441,mix(FOREST,IVORY,.6))
    text(title,x,459,13,'Strong');text(digital,x,487,28,'Display');text(print_size+' in print',x,529,11)
text('Minimum sizes refer to visible artwork width. Favicon exception: 16 px, using the same silhouette.',64,566,10)
footer(4)

# 05 Palette
rect(0,0,480,H,FOREST);rect(480,0,480,H,IVORY)
text('05 / COLOR',64,36,10,'Strong',IVORY)
text('Burnt forest green',64,78,30,'Display',IVORY)
text('Warm ivory',536,78,36,'Display',FOREST)
text('#283F32',64,143,25,'Strong',IVORY);text('#F3EFE5',536,143,25,'Strong')
text('RGB  40 / 63 / 50',64,195,13,'Body',IVORY);text('RGB  243 / 239 / 229',536,195,13)
text('CMYK approx. 37 / 0 / 21 / 75',64,225,11,'Body',IVORY);text('CMYK approx. 0 / 2 / 6 / 5',536,225,11)
text('Aa',64,271,110,'Display',IVORY);text('Aa',536,271,110,'Display')
text(f'{MANIFEST["contrastRatio"]:.2f}:1 contrast',64,446,25,'Strong',IVORY)
para('Green and ivory exceed 7:1 for normal text, the WCAG AAA contrast threshold. This is a color-pair result, not an accessibility audit of a complete interface.',64,491,350,11,17,'Body',IVORY)
para('Use these RGB values for digital work. CMYK values are unprofiled approximations: ask the printer to convert the RGB vector master with its output profile and approve a physical proof.',536,446,350,12,18)
text('Reference: W3C WCAG 2.2 SC 1.4.6',536,552,9)
C.linkURL('https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html',(536,H-570,890,H-548),relative=0)
footer(5,True)

# 06 Typography
heading(6,'Typography','A warm voice with clear information','Supporting type complements the logo. It never replaces the custom outlined wordmark.')
text('Fraunces Semibold',64,192,17,'Strong')
text('Aa Bb Cc',64,231,56,'Display')
text('0123456789',64,308,36,'Display')
para('Editorial headlines and short display text. Recommended axes: weight 600, optical size 72, softness 50, wonky 1.',64,382,360,12,18)
text('Inter',528,192,17,'Strong')
text('Aa Bb Cc',528,231,51,'Body')
text('Menus  Dishes  Orders',528,311,20,'Strong')
para('Regular 400 for body copy. Semibold 600 for labels and emphasis. Keep the interface readable and retain the existing customer-menu typography contract.',528,382,368,12,18)
line(64,478,896,478,mix(FOREST,IVORY,.6))
para('Both families are included under the SIL Open Font License, with their original license files. Use the original variable fonts for design work; local PDF instances are included only for reproducibility.',64,502,810,11,17)
text('Sources: github.com/google/fonts/tree/main/ofl/fraunces and /ofl/inter',64,560,9)
footer(6)

# 07 Care
heading(7,'Logo care','Keep the artwork intact','Choose a quiet, contrasting field. On a busy photo, place the logo on a solid ivory or green backplate.')
cases=[('Do not stretch','stretch'),('Do not rotate','rotate'),('Do not use outlines','outline'),('Keep the inner opening','close'),('Keep enough contrast','contrast'),('Do not retype the name','type')]
for i,(label,kind) in enumerate(cases):
    x=64+(i%3)*288;y=192+(i//3)*181
    rect(x,y,256,130,mix(IVORY,FOREST,.035),radius=8)
    if kind=='stretch':
        C.saveState();C.translate(x+84,H-(y+26));C.scale(1.35,1);shape('symbol',0,H,.19);C.restoreState()
    elif kind=='rotate':
        C.saveState();C.translate(x+128,H-y-66);C.rotate(22);shape('symbol',-50,H-48,.30);C.restoreState()
    elif kind=='outline': logo('symbol',x+78,y+17,100,91,outline=True)
    elif kind=='close':
        logo('symbol',x+78,y+17,100,91);rect(x+119,y+53,18,55,FOREST)
    elif kind=='contrast':
        rect(x+30,y+20,196,90,FOREST,radius=6);logo('horizontal',x+40,y+45,176,36,mix(FOREST,IVORY,.12))
    else:text('Xprout',x+32,y+41,32,'Display')
    text('x',x+232,y+5,16,'Strong');text(label,x,y+143,12,'Strong')
text('Use supplied black or white artwork only when a one-color production process requires it.',64,564,11)
footer(7)

# 08 Icons
heading(8,'Digital assets','Recognizable at every scale','Use the symbol by itself for app icons, avatars and browser tabs. The shape stays the same.')
for x,filename,label in [(64,'xprout-app-icon-forest-512.png','Standard square'),(292,'xprout-avatar-ivory-512.png','Rounded avatar'),(520,'xprout-maskable-forest-512.png','Maskable safe area')]:
    C.drawImage(str(ROOT/'icons'/filename),x,H-205-180,width=180,height=180,mask='auto')
    text(label,x,403,12,'Strong')
C.setStrokeColor(mix(IVORY,FOREST,.25));C.setDash([3,3]);C.circle(610,H-295,72,stroke=1,fill=0);C.setDash([])
text('Browser sizes',756,207,13,'Strong')
for size,x in [(16,756),(32,794),(48,846)]:
    C.drawImage(str(ROOT/'icons'/f'favicon-{size}.png'),x,H-274-size,width=size,height=size,mask='auto')
    text(str(size),x,340,10)
para('Use the dedicated maskable file for circle-safe placement. Do not crop a standard app icon to fake a maskable asset.',64,470,390,12,18)
para('Transparent SVGs scale without a raster limit. PNGs are supplied at 256 and 512 px. Icons include 192 and 512 px; the ICO bundles 16, 32 and 48 px.',520,470,376,12,18)
footer(8)

# 09 Applications
heading(9,'Applications','Made for the restaurant table','These are brand demonstrations. Restaurant menus keep their own colors and typography.')
rect(84,190,286,363,IVORY,FOREST,12)
logo('horizontal',108,218,238,45)
qr=QrCodeWidget('https://xprout.app',barFillColor=HexColor(FOREST),barBorder=4)
qb=qr.getBounds();qsize=158
drawing=Drawing(qsize,qsize,transform=[qsize/(qb[2]-qb[0]),0,0,qsize/(qb[3]-qb[1]),0,0]);drawing.add(qr)
renderPDF.draw(drawing,C,148,H-295-qsize)
text('Discover Xprout',145,475,18,'Strong')
text('xprout.app',187,514,11)
rect(454,205,442,248,FOREST,radius=12)
logo('horizontal',492,280,366,68,IVORY)
text('xprout.app',492,405,12,'Body',IVORY)
para('The sample QR points to the Xprout homepage. Before a restaurant sign is produced, insert and test that restaurant\'s verified menu URL.',454,484,442,12,18)
text('Illustrative layouts; not print-ready signs or deployed customer screens.',454,558,10)
footer(9)

# 10 Handoff
heading(10,'Handoff','The files and when to use them','Start with the supplied artwork. Keep its proportions, clear space and approved colors intact.')
rows=[('svg/','Scalable outlined logos, with transparent and solid-background versions.'),('png/','Transparent 256/512 px exports and prepared background versions.'),('icons/','App icons, avatars, maskable icons, favicon and a social card.'),('print/','Vector PDF logo plates in RGB, for printer conversion and proofing.'),('fonts/','Original support fonts with their complete OFL license files.'),('manual/','This guide and its editable text reference.'),('source/','Approved symbol, outlined geometry and reproducible build scripts.')]
y=191
for folder,description in rows:
    text(folder,64,y,14,'Strong');para(description,258,y,625,12,18);line(64,y+40,896,y+40,mix(FOREST,IVORY,.82));y+=49
para('The approved v7 symbol path is preserved exactly in every exported composition. New spacing and typography guidance in this manual is consolidated for brand pack v1. Application rollout is a separate step.',64,550,832,10,15)
footer(10)
C.save()

# Text-free vector plates; transparent page background, RGB artwork.
plates=ROOT/'print/xprout-vector-masters.pdf'
C=canvas.Canvas(str(plates),pageCompression=1)
C.setTitle('Xprout Vector Logo Masters');C.setAuthor('Xprout')
for kind in ['horizontal','stacked','symbol','wordmark']:
    l=L[kind];p=l['symbolHeight']/4;scale=400/(l['h']+2*p)
    W,H=(l['w']+2*p)*scale,400
    C.setPageSize((W,H));logo(kind,p*scale,p*scale,l['w']*scale,l['h']*scale);C.showPage()
C.save()
bad=[box for box in text_boxes if box[1]<0 or box[2]<0 or box[1]+box[3]>961 or box[2]+box[4]>641]
if bad: raise RuntimeError('Text outside artboard: '+str(bad))
(ROOT/'evidence/manual-layout-check.json').write_text(json.dumps({'manualPages':10,'vectorPlatePages':4,'checkedTextBoxes':len(text_boxes),'outOfPageTextBoxes':len(bad),'pdfFiles':[str(manual),str(plates)]},indent=2))
print(json.dumps({'manual':str(manual),'plates':str(plates),'textBoxes':len(text_boxes)}))
