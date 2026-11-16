# بيولّد أغلفة الأقسام SVG الافتراضية. الاستخدام: python3 tools/make-covers.py site/assets/img/sections
# (اختياري — تقدر تستبدل أي غلاف بصورتك وتكتب مسارها في لوحة الإدارة)
import math,os,sys
OUT=sys.argv[1]
A="#FDC713";B="#F58220"
def star(x,y,r,fill="url(#g)",op=1):
    # النجوم الصغيرة المتفرقة (r<=26) اتشالت من الرسمة: كل غلاف بياخد نفس الـ sparkles في أماكن ثابتة (جوه wrap) عشان الأغلفة كلها تبقى متناسقة
    if r<=26: return ""
    return f'<path d="M{x},{y-r} Q{x},{y} {x+r},{y} Q{x},{y} {x},{y+r} Q{x},{y} {x-r},{y} Q{x},{y} {x},{y-r}Z" fill="{fill}" opacity="{op}"/>'
def rr(x,y,w,h,r,fill="none",stroke=None,sw=2,op=1,extra=""):
    s=f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}"{s} opacity="{op}" {extra}/>'
def bars(x,y,items,h=10,gap=10,fill="#fff",op=.35):
    o="";
    for i,(w,f) in enumerate(items):
        o+=rr(x,y+i*(h+gap),w,h,h/2,f or fill,op=1 if f else op)
    return o
# مساحة الرسمة الموحدة (على لوحة 1600×360): كل رسمة بتتحجّم وتتوسّط جواها، فمفيش حاجة بتتقطع من فوق/تحت،
# ومفيش حاجة بتوصل للجزء اللي عليه النص (اليمين). الأرقام: x,y,عرض,ارتفاع
FIT=(70,66,780,228)
# حدود (bbox) كل رسمة قبل التوحيد — بتتقاس بـ tools/measure-covers.js بعد تغيير أي رسمة
BOX={}
try:
    import json as _j; BOX=_j.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"covers-bbox.json")))
except Exception: pass
def fit(name):
    if name not in BOX: return ""
    x,y,w,h=BOX[name]; k=min(FIT[2]/w,FIT[3]/h,1.25)
    tx=FIT[0]+(FIT[2]-w*k)/2-x*k; ty=FIT[1]+(FIT[3]-h*k)/2-y*k
    return f' transform="translate({tx:.1f} {ty:.1f}) scale({k:.4f})"'
def sparkles():
    return "".join(f'<path d="M{x},{y-r} Q{x},{y} {x+r},{y} Q{x},{y} {x},{y+r} Q{x},{y} {x-r},{y} Q{x},{y} {x},{y-r}Z" fill="url(#g)" opacity="{o}"/>' for x,y,r,o in ((880,76,22,1),(900,300,13,.6),(52,48,13,.7)))
def wrap(name,body,gx=300,gy=60,seed=0):
    # dark base, brand glows, subtle grid, then art
    gl=[(gx,gy),(1100,330)] if seed%2==0 else [(1000,40),(250,330)]
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 360" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{A}"/><stop offset="1" stop-color="{B}"/></linearGradient>
<linearGradient id="g2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="{B}"/><stop offset="1" stop-color="{A}"/></linearGradient>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b1b25"/><stop offset="1" stop-color="#0e0e14"/></linearGradient>
<radialGradient id="gl1" cx="{gl[0][0]}" cy="{gl[0][1]}" r="620" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="{B}" stop-opacity=".42"/><stop offset="1" stop-color="{B}" stop-opacity="0"/></radialGradient>
<radialGradient id="gl2" cx="{gl[1][0]}" cy="{gl[1][1]}" r="520" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="{A}" stop-opacity=".22"/><stop offset="1" stop-color="{A}" stop-opacity="0"/></radialGradient>
<linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/></linearGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#000" flood-opacity=".5"/></filter>
<filter id="blur"><feGaussianBlur stdDeviation="14"/></filter>
<pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="#fff" opacity=".07"/></pattern>
</defs>
<rect width="1600" height="360" fill="url(#bg)"/><rect width="1600" height="360" fill="url(#gl1)"/><rect width="1600" height="360" fill="url(#gl2)"/><rect width="1600" height="360" fill="url(#dots)"/>
<g id="art"{fit(name)}>{body}</g>
{sparkles() if name in BOX else ""}
</svg>'''
    open(os.path.join(OUT,name+".svg"),"w",encoding="utf8").write(svg)

G='url(#g)';GL='url(#glass)'
def card(x,y,w,h,r=22,rot=0,stroke="#ffffff30"):
    return f'<g transform="rotate({rot} {x+w/2} {y+h/2})" filter="url(#sh)">{rr(x,y,w,h,r,"#1f1f2b",stroke,2)}{rr(x,y,w,h,r,GL)}</g>'
def mountains(x,y,w,h,c1="#2b2b3a",c2="#3a3a50"):
    return (f'<path d="M{x},{y+h} L{x+w*.28},{y+h*.35} L{x+w*.5},{y+h*.7} L{x+w*.68},{y+h*.2} L{x+w},{y+h} Z" fill="{c2}"/>'
            f'<path d="M{x},{y+h} L{x+w*.2},{y+h*.6} L{x+w*.42},{y+h} Z" fill="{c1}"/>')
def frame(x,y,w,h,rot=0,sun=True):
    s=f'<g transform="rotate({rot} {x+w/2} {y+h/2})" filter="url(#sh)">'
    s+=rr(x,y,w,h,18,"#262634","#ffffff33",2)
    s+=f'<clipPath id="c{x}{y}"><rect x="{x+10}" y="{y+10}" width="{w-20}" height="{h-20}" rx="12"/></clipPath><g clip-path="url(#c{x}{y})"><rect x="{x+10}" y="{y+10}" width="{w-20}" height="{h-20}" fill="url(#g2)" opacity=".85"/>'
    if sun: s+=f'<circle cx="{x+w*.7}" cy="{y+h*.35}" r="{h*.12}" fill="#fff" opacity=".9"/>'
    s+=mountains(x+10,y+h*.3,w-20,h*.7-10,"#3a1f12","#5a2e14")+'</g></g>'
    return s
def play(cx,cy,r,rot=0):
    return (f'<g filter="url(#sh)"><circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#g)"/><circle cx="{cx}" cy="{cy}" r="{r+10}" fill="none" stroke="{A}" stroke-opacity=".35" stroke-width="2"/>'
            f'<path d="M{cx-r*.28},{cy-r*.42} L{cx+r*.5},{cy} L{cx-r*.28},{cy+r*.42} Z" fill="#1a1205" stroke="#1a1205" stroke-width="6" stroke-linejoin="round"/></g>')

# 1 prompts
b=card(560,70,420,220,24,5)+card(300,40,440,250,24,-4)
b+=f'<g transform="rotate(-4 520 165)">'+"".join(f'<circle cx="{332+i*22}" cy="{74}" r="6" fill="{c}"/>' for i,c in enumerate(["#ff5d6c",A,"#34d399"]))
b+=rr(330,104,260,12,6,G)+rr(330,134,360,12,6,"#fff",op=.35)+rr(330,164,300,12,6,"#fff",op=.35)+rr(330,194,200,12,6,G,op=.8)+rr(330,224,120,12,6,"#fff",op=.25)
b+=rr(552,190,5,26,2,A)+rr(600,238,120,32,16,G)+'</g>'
b+=f'<g filter="url(#sh)"><path d="M860,70 h200 a24,24 0 0 1 24,24 v70 a24,24 0 0 1 -24,24 h-120 l-44,38 v-38 h-36 a24,24 0 0 1 -24,-24 v-70 a24,24 0 0 1 24,-24Z" fill="#22222f" stroke="#ffffff30" stroke-width="2"/></g>'
b+=rr(890,98,150,10,5,"#fff",op=.4)+rr(890,122,110,10,5,G)+rr(890,146,130,10,5,"#fff",op=.25)
b+=star(1130,70,28)+star(205,250,20)+star(1180,230,14,op=.7)+star(760,320,12,op=.6)
wrap("prompts",b)

# 2 ai-both
b=frame(250,70,300,200,-6)+f'<g transform="rotate(5 800 170)" filter="url(#sh)">{rr(650,80,300,190,18,"#262634","#ffffff33",2)}{rr(662,92,276,166,12,"url(#g2)",op=.85)}</g>'+play(800,176,38)
b+='<path d="M560,110 C640,20 700,20 740,70" fill="none" stroke="url(#g)" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"/>'
b+=star(640,48,26)+star(1010,100,22)+star(220,300,16,op=.8)+star(1040,260,14,op=.6)+star(430,320,10,op=.6)
wrap("ai-both",b,seed=1)

# 3 ai-images
b=frame(330,50,420,260,-3)+frame(800,110,200,140,6,False)+frame(220,170,150,110,-9,False)
b+='<g stroke-linecap="round"><path d="M880,330 L640,100" stroke="#f2f2f6" stroke-width="10" opacity=".9"/><path d="M880,330 L840,290" stroke="url(#g)" stroke-width="10"/></g>'+star(640,100,40)+star(560,60,16)+star(700,56,12,op=.8)+star(1060,60,18)
b+=''.join(f'<circle cx="{1040+i*34}" cy="{290}" r="12" fill="{c}"/>' for i,c in enumerate([A,B,"#ff5d6c","#a78bfa","#34d399"]))
wrap("ai-images",b)

# 4 ai-video: film strip
holes=''.join(rr(262+i*58,66,28,16,4,"#0e0e14")+rr(262+i*58,278,28,16,4,"#0e0e14") for i in range(14))
b=f'<g transform="rotate(-5 560 180)" filter="url(#sh)">{rr(240,50,640,260,24,"#20202c","#ffffff30",2)}{holes}'
for i in range(4):
    b+=rr(262+i*152,100,134,160,10,"url(#g2)" if i%2==0 else "url(#g)",op=.35+i*.15)
b+='</g>'+play(520,180,50)+f'<g transform="rotate(7 960 200)" filter="url(#sh)">{rr(900,110,200,130,16,"#262634","#ffffff33",2)}{rr(910,120,180,110,10,"url(#g)",op=.7)}</g>'
b+=star(1130,70,22)+star(220,300,16,op=.7)+star(900,320,12,op=.6)
wrap("ai-video",b,seed=1)

# 5 fonts
b='<g stroke="#ffffff" stroke-opacity=".16" stroke-width="2">'+''.join(f'<line x1="160" x2="1160" y1="{y}" y2="{y}"/>' for y in (70,130,250,310))+'</g>'
b+='<g stroke="url(#g)" stroke-width="30" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M300,300 L420,70 L540,300"/><path d="M350,220 H490" stroke="#FDC713" stroke-width="22"/></g>'
b+='<g stroke="#f2f2f6" stroke-width="22" stroke-linecap="round" fill="none"><circle cx="720" cy="238" r="52"/><path d="M772,186 V300"/></g>'
b+='<path d="M860,260 C900,120 1010,120 1030,230 S1100,330 1140,200" fill="none" stroke="url(#g)" stroke-width="10" stroke-linecap="round"/>'
b+='<g stroke="#ffffff55" stroke-width="2"><line x1="860" y1="260" x2="900" y2="150"/><line x1="1030" y1="230" x2="1070" y2="320"/></g>'
b+=''.join(f'<rect x="{x-8}" y="{y-8}" width="16" height="16" rx="3" fill="#fff"/>' for x,y in ((860,260),(1030,230),(1140,200)))+''.join(f'<circle cx="{x}" cy="{y}" r="7" fill="{A}"/>' for x,y in ((900,150),(1070,320)))
b+=star(1220,90,20)+star(200,300,14,op=.7)
wrap("fonts",b)

# 6 images stock
def polaroid(x,y,rot,k):
    return (f'<g transform="rotate({rot} {x+110} {y+130})" filter="url(#sh)">{rr(x,y,220,260,10,"#f2f2f6")}'
            f'<clipPath id="p{k}"><rect x="{x+14}" y="{y+14}" width="192" height="190" rx="4"/></clipPath><g clip-path="url(#p{k})"><rect x="{x+14}" y="{y+14}" width="192" height="190" fill="url(#g{"2" if k%2 else ""})"/>'
            f'<circle cx="{x+150}" cy="{y+65}" r="20" fill="#fff" opacity=".9"/>{mountains(x+14,y+60,192,144,"#4a2410","#6b3414")}</g>{rr(x+14,y+222,110,10,5,"#bbb")}</g>')
b=polaroid(250,60,-10,0)+polaroid(470,40,4,1)+polaroid(690,70,12,2)
b+='<g filter="url(#sh)"><circle cx="1010" cy="200" r="70" fill="#22222f" stroke="#ffffff33" stroke-width="2"/><circle cx="1010" cy="200" r="46" fill="none" stroke="url(#g)" stroke-width="10"/><circle cx="1010" cy="200" r="20" fill="#0e0e14"/><circle cx="1030" cy="182" r="6" fill="#fff" opacity=".8"/></g>'
b+=star(1130,70,20)+star(210,290,14,op=.7)
wrap("images",b,seed=1)

# 7 montage
b=f'<g filter="url(#sh)">{rr(220,60,900,250,22,"#1d1d28","#ffffff2a",2)}</g>'
b+=''.join(f'<line x1="{250+i*30}" x2="{250+i*30}" y1="84" y2="{98 if i%5 else 106}" stroke="#fff" stroke-opacity=".4" stroke-width="2"/>' for i in range(29))
b+=rr(250,120,230,40,10,G)+rr(490,120,160,40,10,"#fff",op=.25)+rr(660,120,260,40,10,"url(#g2)",op=.8)
b+=rr(250,172,130,40,10,"url(#g2)",op=.8)+rr(390,172,300,40,10,"#fff",op=.18)+rr(700,172,150,40,10,G)
b+=''.join(rr(252+i*10,236+(18-abs(((i*7)%36)-18))*-.7+4,5,2+abs(((i*7)%36)-18)*1.3,2.5,A if i<40 else "#fff",op=.9 if i<40 else .3) for i in range(0,85))
b+=f'<g><line x1="640" x2="640" y1="84" y2="296" stroke="#ff5d6c" stroke-width="3"/><path d="M626,76 h28 v18 l-14,12 l-14,-12Z" fill="#ff5d6c"/></g>'
b+=f'<g filter="url(#sh)" transform="translate(980 150)"><circle cx="0" cy="40" r="22" fill="none" stroke="url(#g)" stroke-width="9"/><circle cx="0" cy="110" r="22" fill="none" stroke="url(#g)" stroke-width="9"/><path d="M16,24 L86,-20 M16,126 L86,170" stroke="#f2f2f6" stroke-width="9" stroke-linecap="round"/></g>'
b+=star(1180,70,22)+star(190,300,14,op=.7)
wrap("montage",b)

# 8 video tutorials
b=f'<g filter="url(#sh)">{rr(240,40,620,280,26,"#20202c","#ffffff30",2)}{rr(260,60,580,200,16,"url(#g2)",op=.75)}</g>'+play(550,160,52)
b+=rr(268,282,560,8,4,"#fff",op=.2)+rr(268,282,330,8,4,G)+f'<circle cx="598" cy="286" r="12" fill="#f2f2f6"/>'
b+=''.join(rr(900,70+i*62,260,46,12,"#22222f","#ffffff26",2)+f'<circle cx="{930}" cy="{93+i*62}" r="10" fill="{A if i==0 else "#ffffff40"}"/>'+rr(955,86+i*62,150,8,4,"#fff",op=.45)+rr(955,102+i*62,90,8,4,"#fff",op=.2) for i in range(4))
b+=star(1220,300,16)+star(200,80,18,op=.8)
wrap("video",b,seed=1)

# 9 motion
b='<g stroke="#fff" stroke-opacity=".18" stroke-width="2"><line x1="260" y1="300" x2="260" y2="50"/><line x1="260" y1="300" x2="920" y2="300"/>'+''.join(f'<line x1="{260+i*110}" y1="296" x2="{260+i*110}" y2="304"/>' for i in range(1,7))+'</g>'
b+='<path d="M260,300 C560,300 560,60 900,60" fill="none" stroke="url(#g)" stroke-width="12" stroke-linecap="round"/>'
b+='<g stroke="#ffffff66" stroke-width="2" stroke-dasharray="5 6"><line x1="260" y1="300" x2="560" y2="300"/><line x1="900" y1="60" x2="560" y2="60"/></g>'
b+=f'<circle cx="560" cy="300" r="11" fill="#fff"/><circle cx="560" cy="60" r="11" fill="#fff"/><circle cx="260" cy="300" r="14" fill="{A}"/><circle cx="900" cy="60" r="14" fill="{B}"/>'
b+=''.join(f'<circle cx="{1000+i*58}" cy="{300-abs(math.sin(i*.62))*(230-i*24)}" r="{26-i*2}" fill="url(#g)" opacity="{1-i*.11:.2f}"/>' for i in range(8))
b+='<ellipse cx="1000" cy="326" rx="30" ry="6" fill="#000" opacity=".4"/>'+star(1230,80,20)+star(200,330,12,op=.6)
wrap("motion",b)

# 10 ideas
rays=''.join(f'<line x1="{600+math.cos(a)*130:.0f}" y1="{150+math.sin(a)*130:.0f}" x2="{600+math.cos(a)*175:.0f}" y2="{150+math.sin(a)*175:.0f}" stroke="url(#g)" stroke-width="8" stroke-linecap="round"/>' for a in [math.radians(d) for d in range(-160,-19,28)]+[math.radians(d) for d in (200,)][:0])
b=f'<circle cx="600" cy="150" r="150" fill="{A}" opacity=".12" filter="url(#blur)"/>'+rays
b+=f'<g filter="url(#sh)"><path d="M600,50 a95,95 0 0 1 56,172 v28 h-112 v-28 a95,95 0 0 1 56,-172Z" fill="url(#g)"/><path d="M560,230 q20,-50 40,0 t40,0" fill="none" stroke="#1a1205" stroke-width="7" stroke-linecap="round"/><rect x="548" y="256" width="104" height="14" rx="7" fill="#d9d9e3"/><rect x="560" y="276" width="80" height="14" rx="7" fill="#9a9aab"/><rect x="578" y="296" width="44" height="12" rx="6" fill="#d9d9e3"/></g>'
cols=[A,B,"#a78bfa","#34d399","#ff5d6c","#60a5fa"]
for i,(x,y,w,h,r) in enumerate([(240,60,100,100,-8),(300,190,120,80,6),(840,70,110,110,7),(900,210,130,90,-6),(1040,100,90,90,5),(180,150,70,70,10)]):
    b+=f'<g transform="rotate({r} {x+w/2} {y+h/2})" filter="url(#sh)">{rr(x,y,w,h,14,cols[i],op=.9 if i<2 else .75)}{rr(x+14,y+16,w-40,8,4,"#000",op=.25)}{rr(x+14,y+34,w-60,8,4,"#000",op=.18)}</g>'
b+=star(760,40,18)+star(1190,260,16)
wrap("ideas",b,seed=1)

# 11 sites
b=f'<g filter="url(#sh)">{rr(240,50,640,250,22,"#1f1f2b","#ffffff30",2)}</g>'+rr(240,50,640,46,22,"#2a2a39")
b+=''.join(f'<circle cx="{272+i*22}" cy="73" r="6" fill="{c}"/>' for i,c in enumerate(["#ff5d6c",A,"#34d399"]))+rr(370,60,330,26,13,"#0e0e14")+rr(384,70,120,6,3,"#fff",op=.35)
b+=rr(264,120,280,90,12,"url(#g2)",op=.8)+rr(560,120,150,90,12,"#fff",op=.12)+rr(724,120,134,90,12,"#fff",op=.08)+rr(264,226,180,12,6,"#fff",op=.4)+rr(264,250,360,10,5,"#fff",op=.2)+rr(264,270,300,10,5,"#fff",op=.2)
b+=''.join(f'<circle cx="{960+i*64}" cy="{250-(i%2)*30}" r="30" fill="{c}" filter="url(#sh)"/>' for i,c in enumerate([A,B,"#a78bfa","#34d399"]))
b+='<g filter="url(#sh)"><path d="M760,180 L760,300 L792,272 L816,326 L840,314 L816,262 L856,262Z" fill="#f2f2f6" stroke="#1a1205" stroke-width="5" stroke-linejoin="round"/></g>'+star(1190,80,20)+star(200,310,14,op=.7)
wrap("sites",b)

# 12 links
def link(cx,cy,rot,fill):
    return f'<g transform="rotate({rot} {cx} {cy})" filter="url(#sh)"><rect x="{cx-110}" y="{cy-55}" width="220" height="110" rx="55" fill="none" stroke="{fill}" stroke-width="26"/></g>'
b=link(470,170,-35,"url(#g)")+link(640,170,-35,"#f2f2f6")+link(810,170,-35,"url(#g2)")
b+=''.join(f'<g transform="translate({x} {y}) rotate({r})" filter="url(#sh)"><path d="M0,0 h46 v70 l-23,-18 l-23,18Z" fill="{c}"/></g>' for x,y,r,c in ((250,60,-10,A),(1000,70,8,B),(1060,210,-6,"#a78bfa")))
b+=star(1180,70,20)+star(210,280,16,op=.7)+star(930,320,12,op=.6)
wrap("links",b,seed=1)

# 13 files
b=f'<g transform="rotate(-8 520 160)" filter="url(#sh)">{rr(420,40,170,220,12,"#f2f2f6")}{rr(440,70,100,10,5,"#bbb")}{rr(440,92,130,10,5,"#ccc")}{rr(440,114,90,10,5,"#ccc")}</g><g transform="rotate(6 640 160)" filter="url(#sh)">{rr(540,30,170,230,12,"#e4e4ee")}{rr(560,66,130,50,8,"url(#g)")}{rr(560,130,100,10,5,"#bbb")}</g>'
b+=f'<g filter="url(#sh)"><path d="M250,130 h140 l30,36 h330 a24,24 0 0 1 24,24 v110 a24,24 0 0 1 -24,24 h-500 a24,24 0 0 1 -24,-24 v-146 a24,24 0 0 1 24,-24Z" fill="url(#g)"/><path d="M226,200 h548 v100 a24,24 0 0 1 -24,24 h-500 a24,24 0 0 1 -24,-24Z" fill="#000" opacity=".12"/></g>'
b+=f'<g filter="url(#sh)"><circle cx="930" cy="190" r="76" fill="#22222f" stroke="#ffffff33" stroke-width="2"/><path d="M930,150 v70 M900,196 l30,32 l30,-32" fill="none" stroke="url(#g)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="M896,252 h68" stroke="url(#g)" stroke-width="12" stroke-linecap="round"/></g>'
b+=''.join(rr(1060+i*50,90+i*40,42,52,8,c,op=.85) for i,c in enumerate([A,B,"#a78bfa"]))+star(1200,60,18)+star(200,300,14,op=.7)
wrap("files",b,seed=1)

# 14 work
b=''
tiles=[(250,60,200,150,"url(#g)"),(470,60,150,150,"#262634"),(640,60,200,150,"url(#g2)"),(250,230,150,80,"#262634"),(420,230,200,80,"url(#g2)"),(640,230,200,80,"url(#g)")]
for i,(x,y,w,h,f) in enumerate(tiles):
    b+=f'<g filter="url(#sh)">{rr(x,y,w,h,16,f,"#ffffff2a" if f=="#262634" else None,2,op=.9)}</g>'
    if f=="#262634": b+=rr(x+16,y+h-34,w-60,8,4,"#fff",op=.4)+rr(x+16,y+h-18,w-90,8,4,"#fff",op=.2)+f'<circle cx="{x+w/2}" cy="{y+h*.35}" r="{min(w,h)*.16}" fill="url(#g)"/>'
    else: b+=mountains(x,y+h*.45,w,h*.55,"#0003","#0002")+f'<circle cx="{x+w*.75}" cy="{y+h*.3}" r="{min(w,h)*.1}" fill="#fff" opacity=".85"/>'
LOGO_D=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","site","assets","img","logo.svg"),encoding="utf8").read()
import re as _re
_d=_re.search(r'<path class="st0" d="([^"]+)"',LOGO_D).group(1)
b+=f'<g filter="url(#sh)"><circle cx="980" cy="180" r="104" fill="#22222f" stroke="#ffffff33" stroke-width="2"/><svg x="896" y="146" width="168" height="66" viewBox="60 325 880 345"><defs><linearGradient id="lg" gradientUnits="userSpaceOnUse" x1="499.8564" y1="391.0826" x2="499.8564" y2="658.8845"><stop offset="0" stop-color="#FCEF44"/><stop offset=".0957" stop-color="#FCDE33"/><stop offset=".2159" stop-color="#FCD222"/><stop offset=".3398" stop-color="#FDCA17"/><stop offset=".4717" stop-color="#FDC713"/><stop offset="1" stop-color="#F58220"/></linearGradient></defs><path fill="url(#lg)" d="{_d}"/></svg></g>'
wrap("work",b)

# 15 daily (أدواتي اليومية): شبكة أيقونات تطبيقات + شات + نجمة
b=''
tiles=[(300,70,110,110,"url(#g)"),(430,70,110,110,"#262634"),(560,70,110,110,"url(#g2)"),(300,200,110,110,"#262634"),(430,200,110,110,"url(#g2)"),(560,200,110,110,"url(#g)")]
for x,y,w,h,f in tiles:
    b+=f'<g filter="url(#sh)">{rr(x,y,w,h,28,f,"#ffffff2a" if f=="#262634" else None,2,op=.95)}</g>'
    b+=star(x+w/2,y+h/2,30,"#fff" if f!="#262634" else "url(#g)",.9)
b+=f'<g filter="url(#sh)"><path d="M800,80 h250 a26,26 0 0 1 26,26 v90 a26,26 0 0 1 -26,26 h-150 l-54,44 v-44 h-46 a26,26 0 0 1 -26,-26 v-90 a26,26 0 0 1 26,-26Z" fill="#22222f" stroke="#ffffff30" stroke-width="2"/></g>'
b+=rr(836,112,180,12,6,"#fff",op=.4)+rr(836,140,130,12,6,G)+rr(836,168,160,12,6,"#fff",op=.25)
b+=star(1190,70,24)+star(240,300,16,op=.7)+star(770,310,12,op=.6)
wrap("daily",b)

# 16 vector (فيكتور وأيقونات): قلم بيزيه + نقط تحكم + أشكال أساسية + شبكة أيقونات
b=f'<g filter="url(#sh)">{rr(250,50,470,260,26,"#1f1f2b","#ffffff30",2)}</g>'
b+='<g stroke="#fff" stroke-opacity=".08" stroke-width="2">'+"".join(f'<line x1="{250+i*47}" y1="50" x2="{250+i*47}" y2="310"/>' for i in range(1,10))+"".join(f'<line x1="250" y1="{50+i*43}" x2="720" y2="{50+i*43}"/>' for i in range(1,6))+'</g>'
b+='<path d="M300,250 C360,70 520,70 560,170 S650,270 690,110" fill="none" stroke="url(#g)" stroke-width="12" stroke-linecap="round"/>'
b+='<g stroke="#ffffff66" stroke-width="2" stroke-dasharray="5 6"><line x1="300" y1="250" x2="360" y2="70"/><line x1="560" y1="170" x2="520" y2="70"/><line x1="560" y1="170" x2="620" y2="262"/><line x1="690" y1="110" x2="650" y2="270"/></g>'
b+="".join(f'<rect x="{x-9}" y="{y-9}" width="18" height="18" rx="3" fill="#fff"/>' for x,y in ((300,250),(560,170),(690,110)))+"".join(f'<circle cx="{x}" cy="{y}" r="8" fill="{A}"/>' for x,y in ((360,70),(520,70),(620,262),(650,270)))
# pen nib
b+=f'<g filter="url(#sh)" transform="rotate(28 840 150)"><path d="M840,40 L890,150 L865,250 L815,250 L790,150Z" fill="url(#g)"/><path d="M840,40 L840,150" stroke="#1a1205" stroke-width="5"/><circle cx="840" cy="150" r="11" fill="#1a1205"/><rect x="805" y="258" width="70" height="26" rx="8" fill="#d9d9e3"/></g>'
# basic shapes + icon tiles
b+=f'<g filter="url(#sh)"><circle cx="1030" cy="100" r="46" fill="url(#g2)"/><rect x="1100" y="56" width="90" height="90" rx="18" fill="#262634" stroke="#ffffff33" stroke-width="2"/><path d="M1145,76 L1172,126 L1118,126Z" fill="url(#g)"/></g>'
for i,(x,y) in enumerate(((990,190),(1068,190),(1146,190),(990,264),(1068,264),(1146,264))):
    b+=f'<g filter="url(#sh)">{rr(x,y,62,62,16,"url(#g)" if i%3==0 else "#262634","#ffffff2a" if i%3 else None,2)}</g>'
    b+=(f'<circle cx="{x+31}" cy="{y+31}" r="13" fill="#1a1205"/>' if i%3==0 else f'<rect x="{x+16}" y="{y+16}" width="30" height="30" rx="{8 if i%2 else 15}" fill="none" stroke="{A}" stroke-width="5"/>')
wrap("vector",b,seed=1)
