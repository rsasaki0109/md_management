"""Rebuild the README's illustrative UI animation: pip install Pillow; python scripts/generate-hero.py."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[1]
FONT = Path('/usr/share/fonts/truetype/dejavu')
def font(size, bold=False):
    return ImageFont.truetype(str(FONT / ('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')), size)
W,H=1200,760
bg='#eef1e9'; ink='#303b2c'; green='#617951'; muted='#98a38c'
base=Image.new('RGB',(W,H),bg); d=ImageDraw.Draw(base)
def text(x,y,s,size=14,color=ink,bold=False): d.text((x,y),s,font=font(size,bold),fill=color)
def box(rect,fill,r=10,outline=None):d.rounded_rectangle(rect,radius=r,fill=fill,outline=outline)
text(54,30,'f o l i a',21,green,True)
text(54,76,'A little space for big ideas.',38,ink,True)
text(56,132,'Write freely. Organize naturally. Keep it yours.',16,'#758168')
box((929,40,1144,72),'#e1e8d8',16);text(947,48,'MARKDOWN WORKSPACE',11,green,True)
box((48,194,1152,709),'#dfe5d7',18)
box((48,186,1152,701),'#ffffff',14)
box((48,186,1152,222),'#f7f8f3',14)
d.rectangle((49,209,1151,222),fill='#f7f8f3')
for x,c in [(69,'#d2aa9e'),(85,'#d8c994'),(101,'#b6c6a1')]: d.ellipse((x,200,x+8,208),fill=c)
text(498,197,'folia / your private workspace',10,'#9ba58e')
d.rectangle((49,223,274,686),fill='#f7f8f3');box((49,678,274,700),'#f7f8f3',14)
d.line((275,223,275,700),fill='#e7ebdf')
text(70,244,'folia',25,green,True);text(71,289,'M',13,green,True);text(96,286,'My workspace',12,ink,True)
text(71,327,'/   Search',13,'#7d8871');text(71,361,'⌂   Workspace',13,'#7d8871')
text(71,409,'PRIVATE',10,'#98a38c',True)
box((61,434,262,468),'#e7ecdf',5);text(76,444,'▣   Project notes',12,green)
text(89,486,'›   Reading list',12,'#7d8871');text(76,526,'▣   Ideas',12,'#7d8871');text(76,567,'+   New page',12,'#a1ab95')
d.ellipse((73,667,78,672),fill='#8ba375');text(86,662,'Saved in your browser',10,'#98a38c')
text(296,242,'▣   Project notes',11,'#8a967d');text(969,242,'☆',16,'#8a967d');text(1007,244,'↗ Markdown',11,'#8a967d')
d.line((275,270,1151,270),fill='#ecefe6')
cover=Image.new('RGB',(876,95),'#eff2e9');cd=ImageDraw.Draw(cover)
cd.ellipse((399,30,1054,299),fill='#e1e8d8');cd.ellipse((709,19,757,67),fill='#d9e2cd')
base.paste(cover,(276,271))
text(359,293,'SMALL NOTES, NEW POSSIBILITIES',9,'#9ba78d')
box((359,343,404,387),'#e4ebda',10);text(371,351,'✦',24,green)
text(359,409,'YOUR PRIVATE SPACE',9,'#9ba78e',True)
text(359,435,'Project notes',32,ink,True)
text(359,488,'Start small. Let your next idea take shape.',14,'#8b977e')
box((359,535,1066,579),'#f3f6ed',5);d.rectangle((359,535,362,579),fill='#9cae88')
text(377,548,'Make room for the things you want to build.',12,'#7d8b6e')
text(57,729,'LOCAL FIRST  /  BLOCK EDITOR  /  MARKDOWN IN & OUT',10,'#8f9d81')
text(1013,729,'UI ANIMATION',10,'#8f9d81')
frames=[]
line='Bring a little clarity to every day.'
for i in range(55):
    frame=base.copy();d=ImageDraw.Draw(frame)
    count=min(len(line),max(0,i-5))
    text(359,599,line[:count],16,ink)
    if i<42 and i%8<5:
        width=d.textlength(line[:count],font=font(16));d.rectangle((360+width,599,361+width,619),fill=green)
    checked=i>=43
    box((360,643,374,657),green if checked else '#ffffff',3,green if checked else '#b9c5ac')
    if checked:d.line((363,650,367,654,372,647),fill='white',width=2)
    text(387,640,'Write down the first idea',12,'#9ba68e' if checked else '#6e7d61')
    if checked:d.line((387,650,541,650),fill='#aab59f')
    if i>=43:
        box((927,638,1068,666),'#e8efdf',14);text(945,645,'✓  Idea captured',10,green)
    # One fixed palette prevents color shimmer between frames.
    frames.append(frame)
palette=base.quantize(colors=96,method=Image.Quantize.MEDIANCUT)
frames=[f.quantize(palette=palette,dither=Image.Dither.NONE) for f in frames]
(ROOT/'assets').mkdir(exist_ok=True)
frames[0].save(ROOT/'assets/hero.gif',save_all=True,append_images=frames[1:],duration=[100]*54+[1800],loop=0,optimize=True,disposal=1)
frames[48].convert('RGB').save(ROOT/'assets/hero-preview.png')
print(f'{ROOT}/assets/hero.gif: {(ROOT/"assets/hero.gif").stat().st_size:,} bytes')
