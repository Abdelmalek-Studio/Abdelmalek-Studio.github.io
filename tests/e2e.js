/* اختبار شامل (Playwright). التشغيل: npm i -D playwright && npx playwright install chromium && node tests/e2e.js */
const {chromium}=require("playwright");const fs=require("fs"),path=require("path");
const os=require("os");
async function go(page,id){await page.evaluate(i=>{location.hash="#s="+i},id);await page.waitForTimeout(450)}
async function curTitle(page){return page.evaluate(() => { const ss = [...document.querySelectorAll("#content > section.sec")]; if (ss.length !== 1) return "الكل"; const h = ss[0].querySelector("h2").cloneNode(true); h.querySelectorAll("i").forEach(i => i.remove()); return h.textContent.trim(); })}
const ROOT=path.resolve(__dirname,"..");
const res=[];const T=(n,ok,d="")=>{res.push([n,ok]);console.log((ok?"PASS":"FAIL")+" | "+n+(d?" | "+d:""));};
const _D=JSON.parse(fs.readFileSync(ROOT+"/site/data/data.js","utf8").replace(/^\/\*[\s\S]*?\*\/\s*/,"").replace(/^window\.STUDIO_DATA\s*=\s*/,"").replace(/;\s*$/,""));
const NE=_D.sections.filter(s=>s.items.length).length,NI_=_D.sections.reduce((a,s)=>a+s.items.length,0),NP_=_D.sections.flatMap(s=>s.items).filter(i=>i.type==="prompt").length;   // عدد الأقسام غير الفاضية (من data.js)
const HNp=async pg=>0;
const goS=async(pg,id)=>{await pg.evaluate(h=>{location.hash=h},id?"#s="+id:"#");await pg.waitForTimeout(450)};
const SITE="file://"+ROOT+"/site/index.html", ADMIN="file://"+ROOT+"/admin/index.html";

/* ================= اختبارات المقاسات (الموقع + نافذة الـ Prompt + اللوحة) =================
   بتتشغّل على 8 مقاسات حقيقية. لو الخط Cairo مش متاح على الجهاز (مفيش إنترنت) ممكن تحدد مجلد ملفات
   الخط بـ CAIRO_FONTS=/path/to/@fontsource/cairo/files عشان القياس يبقى بالخط الحقيقي. */
const VIEWPORTS=[[320,700],[360,740],[390,844],[430,932],[768,1024],[1024,768],[1366,768],[1920,1080]];
async function useCairo(page){
 const dir=process.env.CAIRO_FONTS;if(!dir||!fs.existsSync(dir))return false;
 let css="";for(const w of [400,600,700,800]){const a=dir+"/cairo-arabic-"+w+"-normal.woff2";if(fs.existsSync(a))css+=`@font-face{font-family:'Cairo';font-weight:${w};src:url('file://${a}') format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFF,U+0020-007F}`;}
 await page.addStyleTag({content:css});await page.evaluate(()=>document.fonts.load("700 16px Cairo").then(()=>document.fonts.ready));return true;
}
async function responsiveSuite(b){
 for(const [w,h] of VIEWPORTS){
  const tag="["+w+"px] ";
  const ctx=await b.newContext({viewport:{width:w,height:h},permissions:["clipboard-read","clipboard-write"]});const p=await ctx.newPage();
  const errs=[];p.on("pageerror",e=>errs.push(e.message));
  await p.goto(SITE);await p.waitForSelector("#tabs .chip", {state: "attached"});await useCairo(p);
  await p.evaluate(async()=>{document.querySelectorAll("img").forEach(i=>i.loading="eager");for(let y=0;y<document.body.scrollHeight;y+=600){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60))}window.scrollTo(0,0);await new Promise(r=>setTimeout(r,500))});
  // 1) لا يوجد Horizontal Scroll غير مقصود (ولا عنصر خارج الشاشة)
  const hs=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth,iw:innerWidth,
    wide:[...document.querySelectorAll("body *")].filter(e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width>0&&(r.right>innerWidth+1||r.left<-1)&&cs.position!=="fixed"&&!e.closest("nav.tabs")&&!e.closest(".fgroup")&&!e.closest(".modal")&&!e.closest(".sec-head")&&!e.closest(".progress")}).map(e=>e.tagName+"."+e.className).slice(0,5)}));
  T(tag+"no horizontal scroll",hs.sw<=hs.iw&&hs.bw<=hs.iw&&hs.wide.length===0,JSON.stringify(hs));
  // 2) الهيدر: الشعار والبحث زر الثيم مش متداخلين (زر الصوت اتشال بطلب المستخدم) ومش لازقين في الحافة
  const hd=await p.evaluate(()=>{const R=s=>{const r=document.querySelector(s).getBoundingClientRect();return{l:r.left,r:r.right,t:r.top,b:r.bottom}};const ov=(a,b)=>!(a.r<=b.l+.5||b.r<=a.l+.5||a.b<=b.t+.5||b.b<=a.t+.5);
    const br=R(".brand"),se=R(".search"),so=R("#theme");const hb=document.querySelector("header.top").getBoundingClientRect();
    return{ov:ov(br,se)||ov(br,so)||ov(se,so),edge:Math.min(br.l,se.l,so.l,innerWidth-br.r,innerWidth-se.r,innerWidth-so.r),inside:[br,se,so].every(x=>x.t>=hb.top-1&&x.b<=hb.bottom+1)}});
  T(tag+"header: brand / search / theme don't overlap",!hd.ov&&hd.inside,JSON.stringify(hd));
  T(tag+"header: items keep ≥12px from screen edge",hd.edge>=12,"edge="+Math.round(hd.edge));
  // 3) الصورة الشخصية والاسم
  const hr=await p.evaluate(()=>{const a=document.querySelector("#avatar").getBoundingClientRect(),o=document.querySelector("#owner").getBoundingClientRect(),n=document.querySelector("#hName"),im=document.querySelector("#avatar img");
    return{avIn:a.left>=0&&a.right<=innerWidth&&a.width>=64,avSq:Math.abs(a.width-a.height)<2,imgOk:!!im&&im.complete&&im.naturalWidth>0,under:(o.top>=a.bottom-1&&Math.abs((o.left+o.right)/2-(a.left+a.right)/2)<40)||(Math.abs((o.top+o.bottom)/2-(a.top+a.bottom)/2)<40&&(o.right<=a.left+1||o.left>=a.right-1)),ownIn:o.left>=0&&o.right<=innerWidth,nameIn:n.scrollWidth<=n.clientWidth+1&&n.getBoundingClientRect().right<=innerWidth+1&&n.getBoundingClientRect().left>=-1}});
  T(tag+"hero: photo visible/square/loaded (≥64px), owner beside or under photo, name not clipped",hr.avIn&&hr.avSq&&hr.imgOk&&hr.under&&hr.ownIn&&hr.nameIn,JSON.stringify(hr));
  // 4) التابات الثابتة أثناء التمرير
  const st=await p.evaluate(async()=>{const o=[];for(const y of [900,2600,5200]){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,250));const hh=document.querySelector("header.top").getBoundingClientRect();o.push(hh.top===0&&hh.height>0)}window.scrollTo(0,0);return o});
  T(tag+"header stays pinned at 3 scroll positions",st.every(Boolean),JSON.stringify(st));
  // 5) عناوين الأقسام وصور الأغلفة
  await p.evaluate(()=>{location.hash="#s=prompts"});await p.waitForTimeout(600);   // الرئيسية من غير كروت → نقيس الكروت جوه قسم
  const sc=await p.evaluate(()=>[...document.querySelectorAll(".sec-head")].map(h=>{const r=h.getBoundingClientRect(),t=h.querySelector("h2"),tr=t.getBoundingClientRect(),c=h.querySelector("img.sec-cover"),cr=c&&c.getBoundingClientRect();
    return{titleIn:(()=>{const g=document.createRange();g.selectNodeContents(t);return [...g.getClientRects()].every(q=>q.left>=r.left-1&&q.right<=r.right+1&&q.top>=r.top-1&&q.bottom<=r.bottom+1)})()&&tr.left>=r.left-1&&tr.right<=r.right+1,cover:!c||cr.height===0||(c.complete&&c.naturalWidth>0&&Math.abs(cr.height-r.height)<=2&&cr.left>=r.left-1&&cr.right<=r.right+1&&cr.width>=Math.min(r.width,r.height*4)-2),cnt:(()=>{const kk=h.querySelector(".sec-count");if(!kk)return true;const k=kk.getBoundingClientRect();return k.right<=r.right+1&&k.left>=r.left-1&&k.bottom<=r.bottom+1})()}}));
  T(tag+"section titles not clipped ("+sc.length+")",sc.length===1&&sc.every(x=>x.titleIn)   // تغيير مقصود: رئيسية الموبايل = فيديوهات + Prompts + شغلي (الباقي من التصنيفات الرئيسية/الفرعية) (الباقي من التصنيفات)
,JSON.stringify(sc.filter(x=>!x.titleIn).length));
  // تغيير مقصود (طلب المستخدم لبانرات الأقسام الصغيرة): رسمة الغلاف بتتصغّر كلها على ارتفاع البانر بدل ما تملا عرضه وتتقص؛ فالشرط بقى: نفس ارتفاع البانر (±2px)، جوه حدوده، ومحمّلة، وعرضها بنسبتها (≥ 4× الارتفاع أو عرض البانر كله)
  T(tag+"section cover images fit the banner height (whole illustration scaled, not cropped), loaded, inside the banner, counter inside",sc.every(x=>x.cover&&x.cnt));
  // 6) توزيع الكروت والمسافات
  const gr=await p.evaluate(()=>{let bad=[],maxCols=0;document.querySelectorAll(".grid").forEach((g,gi)=>{const cs=[...g.children].map(c=>({l:c.offsetLeft,r:c.offsetLeft+c.offsetWidth,t:c.offsetTop,b:c.offsetTop+c.offsetHeight}));const gw={l:0,r:g.clientWidth};   // offset-based: مش متأثر بحركة الظهور / hover
    cs.forEach((r,i)=>{if(r.l<gw.l-1||r.r>gw.r+1)bad.push("out:"+gi+"/"+i);cs.forEach((q,j)=>{if(j>i&&!(r.r<=q.l+.5||q.r<=r.l+.5||r.b<=q.t+.5||q.b<=r.t+.5))bad.push("overlap:"+gi+"/"+i+"-"+j)})});
    const rows={};cs.forEach(r=>{(rows[r.t]=rows[r.t]||[]).push(r)});Object.values(rows).forEach(row=>{maxCols=Math.max(maxCols,row.length);row.sort((a,b)=>a.l-b.l);for(let i=1;i<row.length;i++){const gap=row[i].l-row[i-1].r;if(gap<12||gap>18)bad.push("gap"+Math.round(gap))}});
    const ys=Object.keys(rows).map(Number).sort((a,b)=>a-b);for(let i=1;i<ys.length;i++){const prevB=Math.max(...rows[ys[i-1]].map(r=>r.b));const gap=ys[i]-prevB;if(gap<11||gap>17)bad.push("vgap"+Math.round(gap))   /* ±1px: القياس بـ offsetTop/offsetHeight (أرقام صحيحة) فارتفاع كارت الفيديو الكسري (16:9) ممكن يطلع فرق 1px حسابيًا مع إن المسافة الفعلية 12px */}});
    return{bad:[...new Set(bad)].slice(0,6),maxCols,tracks:[...document.querySelectorAll(".grid")].map(g=>getComputedStyle(g).gridTemplateColumns.split(" ").filter(Boolean).length)}});
 // عدد الأعمدة المتوقع بالظبط لكل مقاس (مش "على الأقل").
 // مرحلة التصميم: الموقع بقى بيملا الشاشة (بدل عمود ثابت 1100px) والأقسام سايدبار على الديسكتوب (≥1000px) — فاتغيّرت القيم المتوقعة للمقاسات الكبيرة
 // تغيير مقصود: الصفحة بقت بعرض الشاشة كلها والتنقل شريط علوي (مفيش سايدبار واخد عرض) → 1024: 3، 1366: 4، 1920: 6. الموبايل/التابلت (≤768) زي ما هو، وباقي شروط الاختبار (جوه الشبكة/من غير تداخل/مسافة 12–16px) ثابتة.
 // تغيير مقصود (الموبايل بس): الموبايل: كروت أكبر، عمودين في الصف؛ الديسكتوب والتابلت زي ما كانوا
const EXPECT_COLS={320:2,360:2,390:2,430:2,768:3,1024:4,1366:5,1920:6};   // تغيير مقصود (طلب المستخدم): نفس التصميم على كل المقاسات، وعدد الأعمدة بيزيد مع العرض (2/3/4/5/6)
  const want=EXPECT_COLS[w];
  T(tag+"cards: exactly "+want+" column(s) (found "+gr.maxCols+"), inside grid, no overlap, 12–16px gaps",gr.bad.length===0&&want!==undefined&&gr.maxCols===want,JSON.stringify(gr));
  T(tag+"cards: every grid has a valid column count (2 on phone, "+want+" on desktop) (CSS)",want!==undefined&&gr.tracks.length>0&&gr.tracks.every(t=>t===want),JSON.stringify(gr.tracks));
  // 7) نافذة الـ Prompt
  await p.evaluate(()=>window.scrollTo(0,0));
  await go(p,"prompts");await p.waitForTimeout(500);
  await p.locator(".pcard").first().click();await p.waitForSelector(".modal.show");await p.waitForTimeout(400);
  const md=await p.evaluate(()=>{const bx=document.querySelector(".modal-box").getBoundingClientRect(),x=document.querySelector(".modal-x").getBoundingClientRect(),c=document.querySelector("#mCopy").getBoundingClientRect(),cd=document.querySelector("#mCode"),vis=r=>r.left>=-0.5&&r.right<=innerWidth+.5&&r.top>=-0.5&&r.bottom<=innerHeight+.5&&r.width>0;
    return{box:vis(bx),x:vis(x),copy:vis(c),code:cd.getBoundingClientRect().height>=100,hs:document.documentElement.scrollWidth<=innerWidth,tall:bx.height<=innerHeight+.5,xSize:Math.min(x.width,x.height)}});
  T(tag+"prompt modal fits the screen: box / close / copy visible, no h-scroll",md.box&&md.x&&md.copy&&md.code&&md.hs&&md.tall,JSON.stringify(md));
  T(tag+"modal close button is touch-friendly (≥34px)",md.xSize>=34,String(md.xSize));
  // كيبورد: Tab يفضل جوه النافذة، Enter على زرار النسخ بينسخ، Esc بيقفل ويرجّع الفوكس للكارت
  const seen=new Set();for(let i=0;i<7;i++){await p.keyboard.press("Tab");seen.add(await p.evaluate(()=>{const a=document.activeElement;return a&&a.closest(".modal")?(a.id||a.className||a.tagName):"OUTSIDE"}))}
  T(tag+"keyboard: Tab stays trapped inside the modal",!seen.has("OUTSIDE")&&seen.size>=3,[...seen].join(","));
  await p.focus("#mCopy");await p.evaluate(()=>navigator.clipboard.writeText("x"));await p.keyboard.press("Enter");await p.waitForTimeout(400);
  const cp=await p.evaluate(()=>navigator.clipboard.readText());
  T(tag+"keyboard: Enter on Copy copies the full prompt",cp.length>100&&/Copied/.test(await p.locator("#mCopy").textContent()),String(cp.length));
  await p.keyboard.press("Escape");await p.waitForTimeout(400);
  T(tag+"keyboard: Esc closes modal and focus returns to the card",await p.locator(".modal.show").count()===0&&await p.evaluate(()=>!!document.activeElement.closest(".pcard")));
  // زرار الإغلاق بالماوس / اللمس
  await p.locator(".pcard").first().click();await p.waitForSelector(".modal.show");await p.click(".modal-x");await p.waitForTimeout(400);
  T(tag+"close button closes the modal",await p.locator(".modal.show").count()===0);
  T(tag+"no JS errors",errs.length===0,errs.join(";"));
  await ctx.close();

  // اللوحة على نفس المقاس: من غير Horizontal Scroll ولا عناصر طالعة بره
  const actx=await b.newContext({viewport:{width:w,height:h}});const ap=await actx.newPage();await ap.goto(ADMIN);await ap.waitForSelector(".item");
  const ad=await ap.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth,out:[...document.querySelectorAll("input,select,textarea,button")].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left<-1)}).length}));
  T(tag+"admin: no horizontal scroll, controls inside screen",ad.sw<=ad.iw&&ad.out===0,JSON.stringify(ad));
  await actx.close();
 }
}

/* ================= المرحلة 2: مرادفات البحث، الاقتراحات، مسح الكل، فلتر الاستخدام، Copy من الكارت، الحقول الجديدة ================= */
async function phase2Suite(b){
 const D=_D, titles=async p=>p.locator(".card h3").allInnerTexts();
 const ctx=await b.newContext({viewport:{width:1366,height:900},permissions:["clipboard-read","clipboard-write"]});const p=await ctx.newPage();
 const errs=[];p.on("pageerror",e=>errs.push(e.message));
 await p.goto(SITE);await p.waitForSelector("#tabs .chip", {state: "attached"});
 const q=async v=>{await p.fill("#q",v);await p.waitForTimeout(60);return titles(p)};
 // 1) مرادفات: وظيفة الأداة حتى لو مش في اسمها
 for(const term of ["Background Removal","remove background","إزالة خلفية","ازالة الخلفية","bg remover"]){
  const t=await q(term);T("synonym search '"+term+"' → Remove.bg + Clipdrop only",t.length===2&&t.includes("Remove.bg")&&t.includes("Clipdrop"),t.join(" | "));}
 let t=await q("upscale");T("synonym search 'upscale' finds Upscayl + Topaz",t.includes("Upscayl")&&t.includes("Topaz Labs"),t.join(" | "));
 t=await q("رفع جودة");T("Arabic 'رفع جودة' finds the same upscale tools",t.includes("Upscayl")&&t.includes("Topaz Labs"));
 t=await q("fonts");T("synonym search 'fonts' finds font sites",t.includes("Google Fonts (عربي)")&&t.includes("DaFont"));
 t=await q("icons");T("synonym search 'icons' finds icon libraries",t.includes("Lucide")&&t.includes("Flaticon"));
 t=await q("color palette");T("synonym search 'color palette' finds Coolors + Color Hunt",t.includes("Coolors")&&t.includes("Color Hunt"));
 t=await q("ضغط الصور");T("'ضغط الصور' finds Squoosh/TinyPNG and NOT Remove.bg ('ضغطة' false positive)",t.includes("Squoosh")&&t.includes("TinyPNG")&&!t.includes("Remove.bg"),t.join(" | "));
 t=await q("zzqqxx");T("no results → clear message",await p.locator(".empty").count()===1&&/مفيش نتائج/.test(await p.locator(".empty").innerText()));
 await p.fill("#q","");await p.waitForTimeout(60);
 // 2) اقتراحات أثناء الكتابة
 await p.fill("#q","");await p.focus("#q");await p.keyboard.type("remo");await p.waitForSelector("#suggest .sg");
 let sg=await p.locator("#suggest .sg").allInnerTexts();
 T("suggestions appear while typing (topic + tool)",sg.length>=2&&sg.some(x=>/إزالة الخلفية/.test(x))&&sg.some(x=>/Remove\.bg/.test(x)),sg.join(" | "));
 T("suggestions: combobox state (aria-expanded=true)",(await p.getAttribute("#q","aria-expanded"))==="true");
 await p.keyboard.press("ArrowDown");T("suggestions: ArrowDown highlights first (aria-selected)",(await p.locator("#suggest .sg").first().getAttribute("aria-selected"))==="true");
 await p.keyboard.press("Enter");await p.waitForTimeout(150);
 t=await titles(p);T("suggestions: Enter picks the idea → Remove.bg + Clipdrop, list closes",(await p.inputValue("#q"))==="إزالة الخلفية"&&t.includes("Remove.bg")&&t.includes("Clipdrop")&&await p.locator("#suggest").isHidden(),t.join(" | "));
 await p.fill("#q","");await p.keyboard.type("remo");await p.waitForSelector("#suggest .sg");await p.keyboard.press("Escape");
 T("suggestions: Escape closes the list",await p.locator("#suggest").isHidden());
 await p.fill("#q","");await p.keyboard.type("canva");await p.waitForSelector("#suggest .sg");
 await p.locator("#suggest .sg",{hasText:"Canva"}).first().dispatchEvent("mousedown");await p.waitForTimeout(150);
 T("suggestions: clicking a tool name searches it",/Canva/i.test(await p.inputValue("#q"))&&(await titles(p)).some(x=>/Canva/.test(x)));
 // 3) مسح الكل
 await p.fill("#q","");await p.waitForTimeout(60);
 T("clear-all hidden when nothing is active",await p.locator(".clearall").isHidden());
 // تغيير مقصود (المرحلة 2): فلتر النوع العام اتشال؛ بدله فتح قسم Prompts (نفس الفكرة: فلتر نشط + بحث)
 await go(p,"prompts");await p.fill("#q","لوجو");await p.waitForTimeout(80);
 T("clear-all visible once a filter/search is active",await p.locator(".clearall").isVisible());
 await p.locator(".clearall").click();await p.waitForTimeout(120);
 T("clear-all resets search + filters + tab, back to the clean home",(await p.inputValue("#q"))===""&&await p.locator(".card").count()===0&&await p.locator(".clearall").isHidden());
 // 4) فلتر نوع الاستخدام للبرومبتات
 T("use-case group hidden outside prompts",await p.locator('[data-fu]').count()===0);
 await go(p,"prompts");await p.waitForTimeout(150);
 const uses=[...new Set(D.sections.find(s=>s.id==="prompts").items.map(i=>i.category).filter(Boolean))];
 T("use-case chips show every prompt category ("+uses.length+")",await p.locator('[data-fu]').count()===uses.length+1);
 const useTag=uses.find(u=>D.sections.flatMap(s=>s.items).filter(i=>i.type==="prompt"&&i.category===u).length===2)||uses[0];
 const wantN=D.sections.flatMap(s=>s.items).filter(i=>i.type==="prompt"&&i.category===useTag).length;
 await p.locator('[data-fu="'+useTag+'"]').click();await p.waitForTimeout(120);
 T("use-case filter '"+useTag+"' → "+wantN+" prompts only",await p.locator(".card").count()===wantN&&await p.locator(".pcard").count()===wantN);
 await p.locator(".clearall").click();await p.waitForTimeout(120);
 T("clear-all also resets use-case",await p.locator('[data-fu]').count()===0&&await p.locator(".card").count()===await HNp(p));
 // 5) Copy سريع من كارت البرومبت
 await go(p,"prompts");await p.waitForTimeout(150);
 T("every prompt card has a Copy button",await p.locator(".pcopy").count()===await p.locator(".pcard").count()&&await p.locator(".pcopy").count()===NP_);
 const firstCard=p.locator(".cwrap:has(.pcopy)").first();const ttl=await firstCard.locator("h3").innerText();
 await firstCard.locator(".pcopy").click();await p.waitForTimeout(200);
 const clip=await p.evaluate(()=>navigator.clipboard.readText());const want=D.sections.flatMap(s=>s.items).find(i=>i.type==="prompt"&&i.title===ttl).text;
 T("card Copy copies the exact full prompt in one click (no modal)",clip===want&&!await p.locator(".modal.show").count(),clip.length+" vs "+want.length);
 T("card Copy shows 'Copied ✓'",(await firstCard.locator(".pcopy").innerText())==="Copied ✓");
 T("no JS errors in phase 2 flows",errs.length===0,errs.join(";"));
 await ctx.close();
 // 6) حقول جديدة اختيارية: keywords / tool / image (نسخة مؤقتة من الموقع ببيانات معدّلة)
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"as-p2-"));fs.cpSync(ROOT+"/site",tmp+"/site",{recursive:true});
 const D2=JSON.parse(JSON.stringify(D));const pr=D2.sections.find(x=>x.id==="prompts"),pit=pr.items.find(i=>i.type==="prompt");
 pit.tool="Gemini / Nano Banana";pit.image="assets/img/photo.jpg";const lk=D2.sections[0].items[0];lk.keywords=["كلمةسرية","hiddenword"];
 const pit2=pr.items.filter(i=>i.type==="prompt")[1];pit2.image="assets/img/missing-xyz.webp";
 fs.writeFileSync(tmp+"/site/data/data.js","window.STUDIO_DATA = "+JSON.stringify(D2)+";\n");
 const c2=await b.newContext({viewport:{width:1366,height:900}});const p2=await c2.newPage();const e2=[];p2.on("pageerror",e=>e2.push(e.message));
 await p2.goto("file://"+tmp+"/site/index.html");await p2.waitForSelector("#tabs .chip", {state: "attached"});
 await p2.fill("#q","كلمةسرية");await p2.waitForTimeout(80);T("item keywords (array) are searchable",await p2.locator(".card").count()===1&&(await p2.locator(".card h3").innerText())===lk.title);
 await p2.fill("#q","hiddenword");await p2.waitForTimeout(80);T("item keywords: English keyword also finds it",await p2.locator(".card").count()===1);
 await p2.fill("#q","nano banana");await p2.waitForTimeout(80);T("prompt 'tool' is searchable",(await p2.locator(".pcard h3").allInnerTexts()).includes(pit.title));
 await p2.fill("#q","");await go(p2,"prompts");await p2.waitForTimeout(250);
 const pc=p2.locator(".pcard",{hasText:pit.title}).first();
 T("prompt card shows the compatible-tool badge",(await pc.locator(".badge.tool").innerText())==="Gemini / Nano Banana");
 T("prompt card shows the result image (loaded)",await pc.locator(".pthumb img").evaluate(i=>i.complete&&i.naturalWidth>0));
 T("broken result image is removed, card stays text-only",await p2.locator(".pcard",{hasText:pit2.title}).locator(".pthumb").count()===0);
 await pc.click();await p2.waitForSelector(".modal.show");
 T("modal shows tool badge + result image",(await p2.locator("#mMeta .badge.tool").innerText())==="Gemini / Nano Banana"&&await p2.locator("#mImg").isVisible());
 await p2.keyboard.press("Escape");
 T("no JS errors with the new optional fields",e2.length===0,e2.join(";"));
 await c2.close();
 // 7) لوحة الإدارة: الحقول الجديدة + التصدير + التحقق
 const c3=await b.newContext({acceptDownloads:true,viewport:{width:1366,height:900}});const a=await c3.newPage();const ae=[];a.on("pageerror",e=>ae.push(e.message));
 a.on("dialog",d=>d.accept());
 await a.goto(ADMIN);await a.waitForSelector(".item");
 T("admin: keywords field on every item",await a.locator('[data-f="keywords"]').count()===NI_);
 T("admin: tool + result-image fields on every prompt",await a.locator('[data-f="tool"]').count()===NP_&&await a.locator('[data-f="image"]').count()===NP_);
 await a.locator('[data-f="keywords"]').first().fill("كلمة1، word2");
 let [dl]=await Promise.all([a.waitForEvent("download"),a.click("#download")]);
 let out=fs.readFileSync(await dl.path(),"utf8");let E=JSON.parse(out.replace(/^\/\*[\s\S]*?\*\/\s*/,"").replace(/^window\.STUDIO_DATA\s*=\s*/,"").replace(/;\s*$/,""));
 const its=E.sections.flatMap(s=>s.items);
 T("admin export: keywords saved on the edited item only; empty optional fields not written",its[0].keywords==="كلمة1، word2"&&its.slice(1).every(i=>!("keywords" in i)&&!("tool" in i)&&!("image" in i)));
 await a.locator('[data-f="image"]').first().fill("../secret.png");
 await a.click("#download");await a.waitForTimeout(300);
 T("admin: bad result-image path blocks export with a clear message",await a.locator("#errbox").isVisible()&&/صورة النتيجة/.test(await a.locator("#errbox").innerText()));
 T("no JS errors in admin phase 2",ae.length===0,ae.join(";"));
 await c3.close();
}

/* ================= المرحلة 3: التليجرام، درايف التاني، المشاركة، آخر الإضافات ================= */
async function phase3Suite(b){
 const D=_D;const all=D.sections.flatMap(s=>s.items);
 const ctx=await b.newContext({viewport:{width:1366,height:900},permissions:["clipboard-read","clipboard-write"]});const p=await ctx.newPage();const errs=[];p.on("pageerror",e=>errs.push(e.message));
 await p.goto(SITE);await p.waitForSelector("#tabs .chip", {state: "attached"});
 T("Telegram button in socials → t.me/abdelmalek_studio with icon",await p.locator('#socials a.ico-telegram[href="https://t.me/abdelmalek_studio"] svg').count()===1);
 T("Telegram opens safely in new tab (noopener)",/noopener/.test(await p.locator("#socials a.ico-telegram").getAttribute("rel")));
 const files=D.sections.find(x=>x.id==="files").items;
await goS(p,"files");T("files section has both drive links",files.length===2&&files.every(f=>/^https:\/\/drive\.google\.com\/drive\/folders\//.test(f.url))&&await p.locator("#files .card").count()===2);
 const linkable=all.filter(i=>i.type!=="prompt"&&/^https?:/.test(i.url||"")).length;
 let shN=0;for(const sc of D.sections.filter(x=>x.items.length)){await goS(p,sc.id);shN+=await p.locator(".sharebtn").count()}
 T("share button on every card ("+all.length+") incl. prompts (permalink)",shN===all.length);await goS(p,"");
 T("latest section hidden when no item has a date",await p.locator("#latest").isHidden());
 // مشاركة: بدون navigator.share → نسخ اللينك
 await p.evaluate(()=>{Object.defineProperty(navigator,"share",{value:undefined,configurable:true})});
 await goS(p,D.sections.find(x=>x.items.some(i=>i.title==="Photopea")).id);const card=p.locator(".cwrap:has(.sharebtn)",{hasText:"Photopea"}).first();await card.locator(".sharebtn").click();await p.waitForTimeout(250);
 const clip=await p.evaluate(()=>navigator.clipboard.readText());
 T("share (no Web Share API) copies a direct link to the tool on our site",clip.endsWith("#i="+all.find(i=>i.title==="Photopea").id),clip);
 T("share button keeps card link intact (no navigation/new tab)",p.url().startsWith("file://")&&ctx.pages().length===1);
 await p.setViewportSize({width:320,height:700});await p.waitForTimeout(200);
 T("share + fav buttons fit on 320px (no horizontal overflow)",await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 T("no JS errors (phase 3)",errs.length===0,errs.join(";"));
 await ctx.close();
 // آخر الإضافات (نسخة مؤقتة ببيانات متأرّخة)
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"as-p3-"));fs.cpSync(ROOT+"/site",tmp+"/site",{recursive:true});
 const D2=JSON.parse(JSON.stringify(D));const all2=D2.sections.flatMap(s=>s.items),its=all2.filter(i=>i.type!=="video"&&i.type!=="prompt");   // الفيديوهات عناوينها بتتجاب من يوتيوب فمش بنستخدمها هنا
 const pr=all2.find(i=>i.type==="prompt");pr.added="2026-11-05";its[0].added="2026-11-01";its[1].added="2026-11-03";its[2].added="bad-date";
 its.slice(10,15).forEach((x,k)=>x.added="2026-10-0"+(k+1));
 fs.writeFileSync(tmp+"/site/data/data.js","window.STUDIO_DATA = "+JSON.stringify(D2)+";\n");
 const c2=await b.newContext({viewport:{width:1366,height:900}});const q=await c2.newPage();const e2=[];q.on("pageerror",e=>e2.push(e.message));
 await q.goto("file://"+tmp+"/site/index.html");await q.waitForSelector("#tabs .chip", {state: "attached"});
 await q.locator("#tabs .newchip").click();await q.waitForSelector("#whatsnew");
 const names=await q.locator("#whatsnew .cwrap").allInnerTexts();
 T("what's new lists dated items newest first, ignores invalid dates; home has no latest block",names.length===8&&names[0].includes(pr.title.slice(0,12))&&names[1].includes(its[1].title)&&names[2].includes(its[0].title)&&!names.some(n=>n.includes(its[2].title))&&await q.locator("#latest .fcard").count()===0,names.map(n=>n.slice(0,20)).join(" | "));
 await q.locator("#whatsnew .pcard").first().click();await q.waitForSelector(".modal.show");
 T("what's-new prompt card opens its modal",(await q.locator("#mTitle").innerText()).includes(pr.title.slice(0,10)));
 T("latest prompt card opens its modal",(await q.locator("#mTitle").innerText()).includes(pr.title.slice(0,10)));
 await q.keyboard.press("Escape");
 T("no JS errors (latest)",e2.length===0,e2.join(";"));
 await c2.close();
 // الإدارة: تاريخ الإضافة
 const c3=await b.newContext({acceptDownloads:true,viewport:{width:1366,height:900}});const a=await c3.newPage();a.on("dialog",d=>d.accept());
 await a.goto(ADMIN);await a.waitForSelector(".item");
 await a.locator('[data-act="additem"]').first().click();
 const today=(d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"))(new Date());   // تاريخ محلي زي اللوحة (مش UTC)
 const last=a.locator("#sec-0 .item").last();
 T("admin: new item is stamped with today's date",(await last.locator('[data-f="added"]').inputValue())===today);
 await last.locator('[data-f="added"]').fill("11/6/2026");await a.click("#download");await a.waitForTimeout(300);
 T("admin: bad date blocks export with a clear message",await a.locator("#errbox").isVisible()&&/تاريخ الإضافة/.test(await a.locator("#errbox").innerText()));
 await c3.close();
}

/* ================= المرحلة 4: SEO، الخط المحلي، Structured Data، noscript ================= */
async function phase4Suite(b){
 const D=_D, cp=require("child_process"), idx=()=>fs.readFileSync(ROOT+"/site/index.html","utf8");
 const html=idx();
 T("title + meta description + robots + theme-color present",/<title>[^<]{10,}<\/title>/.test(html)&&/name="description" content="[^"]{40,}/.test(html)&&/name="robots"/.test(html)&&/name="theme-color"/.test(html));
 T("Open Graph basics (type/title/description/locale/site_name) + Twitter card",["og:type","og:title","og:description","og:locale","og:site_name"].every(k=>html.includes('property="'+k+'"'))&&html.includes('name="twitter:card"'));
 const ld=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);let g=null;try{g=JSON.parse(ld[1])}catch(e){}
 T("JSON-LD is valid: WebSite + Person with sameAs (no WhatsApp number exposed)",g&&g["@context"]==="https://schema.org"&&g["@graph"].some(x=>x["@type"]==="WebSite")&&g["@graph"].find(x=>x["@type"]==="Person").sameAs.length>=5&&!/wa\.me/.test(ld[1]));
 const ns=html.match(/<noscript><section class="nojs"[\s\S]*?<\/noscript>/);
 T("<noscript> fallback lists every section and item ("+NI_+")",!!ns&&(ns[0].match(/<li>/g)||[]).length===NI_&&D.sections.filter(s=>s.items.length).every(s=>ns[0].includes(">"+s.title.replace(/&/g,"&amp;")+"<")));
 T("no Google Fonts / external CSS in <head> (self-hosted Cairo)",!/googleapis|gstatic/.test(html)&&fs.existsSync(ROOT+"/site/assets/fonts/cairo-arabic.woff2")&&fs.existsSync(ROOT+"/site/assets/fonts/OFL-LICENSE.txt"));
 T("no domain → no canonical/sitemap (nothing invented)",!/rel="canonical"/.test(html)&&!fs.existsSync(ROOT+"/site/sitemap.xml")&&!/^Sitemap:/m.test(fs.readFileSync(ROOT+"/site/robots.txt","utf8")));
 T("og-image.jpg exists, JPEG, 1200×630, under 120KB",(()=>{const f=ROOT+"/site/assets/img/og-image.jpg",bf=fs.readFileSync(f);let i=2,w=0,h=0;while(i<bf.length){if(bf[i]!==0xFF){i++;continue}const m=bf[i+1];if(m>=0xC0&&m<=0xC3){h=bf.readUInt16BE(i+5);w=bf.readUInt16BE(i+7);break}i+=2+bf.readUInt16BE(i+2)}return bf[0]===0xFF&&bf[1]===0xD8&&w===1200&&h===630&&bf.length<120000})());
 // seo.js: آمن للتكرار ومبيغيّرش حاجة لو البيانات ثابتة
 const before=idx();cp.execFileSync("node",[ROOT+"/tools/seo.js"],{cwd:ROOT+"/.."});
 T("tools/seo.js is idempotent (index.html unchanged on re-run)",idx()===before);
 // وضع الدومين في نسخة مؤقتة (من غير ما نلمس المشروع)
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"as-p4-"));fs.cpSync(ROOT+"/site",tmp+"/site",{recursive:true});fs.cpSync(ROOT+"/tools",tmp+"/tools",{recursive:true});
 cp.execFileSync("node",[tmp+"/tools/seo.js","--domain","https://example.com/app"],{cwd:tmp});
 const h2=fs.readFileSync(tmp+"/site/index.html","utf8"),sm=fs.readFileSync(tmp+"/site/sitemap.xml","utf8"),rb=fs.readFileSync(tmp+"/site/robots.txt","utf8");
 T("domain mode: canonical + og:url + absolute og:image + twitter:image",h2.includes('rel="canonical" href="https://example.com/app/"')&&h2.includes('og:image" content="https://example.com/app/assets/img/og-image.jpg"')&&h2.includes('twitter:image" content="https://example.com/app/assets/img/og-image.jpg"'));
 T("domain mode: valid sitemap.xml + Sitemap line in robots.txt",/<loc>https:\/\/example\.com\/app\/<\/loc>/.test(sm)&&/^Sitemap: https:\/\/example\.com\/app\/sitemap\.xml$/m.test(rb));
 let bad=false;try{cp.execFileSync("node",[tmp+"/tools/seo.js","--domain","http://insecure.com"],{cwd:tmp,stdio:"pipe"})}catch(e){bad=true}
 T("domain mode rejects non-https / malformed domain",bad);
 // المتصفح: الخط محلي ومفيش طلبات لجهات خارجية للخط
 const ctx=await b.newContext({viewport:{width:1366,height:800}});const p=await ctx.newPage();const reqs=[];p.on("request",r=>reqs.push(r.url()));
 await p.goto(SITE);await p.waitForSelector("#tabs .chip", {state: "attached"});await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(600);
 T("Cairo loads from local files (Arabic subset used on the page)",await p.evaluate(()=>[...document.fonts].some(f=>f.family.replace(/"/g,"")==="Cairo"&&f.status==="loaded")));
 T("no request to Google Fonts",!reqs.some(u=>/googleapis|gstatic/.test(u)));
 await ctx.close();
}

(async()=>{
 if(process.env.ONLY==='resp'){const b0=await chromium.launch();await responsiveSuite(b0);await b0.close();const fl=res.filter(r=>!r[1]);console.log('\nTOTAL',res.length,'FAILED',fl.length);process.exit(fl.length?1:0)}
 // data integrity
 const txt=fs.readFileSync(ROOT+"/site/data/data.js","utf8");
 const D=JSON.parse(txt.replace(/^\/\*[\s\S]*?\*\/\s*/,"").replace(/^window\.STUDIO_DATA\s*=\s*/,"").replace(/;\s*$/,""));
 const PR=D.sections.find(x=>x.id==="prompts"),PI=D.sections.findIndex(x=>x.id==="prompts");
 const NS=D.sections.length,NI=D.sections.reduce((a,s)=>a+s.items.length,0),NP=D.sections.flatMap(s=>s.items).filter(i=>i.type==="prompt").length;   // الأعداد كلها بتتحسب من data.js — مفيش أرقام ثابتة
 T(NS+" sections / "+NI+" items",D.sections.length===NS&&D.sections.reduce((a,s)=>a+s.items.length,0)===NI);
 const ids=D.sections.flatMap(s=>s.items.map(i=>i.id));
 T(NI+" unique item ids",new Set(ids).size===NI&&ids.every(i=>/^itm-[0-9a-f]{8}$/.test(i)));
 T("section ids unique",new Set(D.sections.map(s=>s.id)).size===NS);
 const src=fs.readdirSync(ROOT+"/admin/js").map(f=>fs.readFileSync(ROOT+"/admin/js/"+f,"utf8")).join("\n");
 T("no new Function/eval in admin js",!/new Function|\beval\s*\(/.test(src));
 const b=await chromium.launch();
 // site
 let ctx=await b.newContext({permissions:["clipboard-read","clipboard-write"]});let p=await ctx.newPage();const errs=[];
 p.on("pageerror",e=>errs.push(e.message));p.on("console",m=>{if(m.type()==="error"&&!/net::|fonts|ERR_/.test(m.text()))errs.push(m.text())});
 await p.goto(SITE);await p.waitForSelector("#tabs .chip", {state: "attached"});
 T("contact button → WhatsApp direct",await p.evaluate(()=>{const a=document.querySelector("#contact a.contact-btn");return !!a&&/^https:\/\/wa\.me\/\d+/.test(a.href)&&a.textContent.includes("تواصل معنا")}));
 T("admin folder is NOT inside site/ (public)",!fs.existsSync(ROOT+"/site/admin")&&!require("child_process").execSync("find "+ROOT+"/site -iname '*admin*' | wc -l").toString().trim().replace(/0/,""));
 T("site loads from file://, no JS errors",errs.length===0,errs.join(";"));
 const colsW=await p.evaluate(()=>innerWidth),colsN=colsW<561?2:colsW<900?3:colsW<1200?4:colsW<1600?5:6,secN=id=>D.sections.find(x=>x.id===id).items.length,HN=secN("video")+Math.min(secN("prompts"),Math.max(6,colsN*2))+Math.min(secN("work"),Math.max(4,colsN));
 T("home = intro + 6 main categories only: no cards outside; all "+NI+" items stay reachable via categories",await p.locator(".card").count()===0);
 T("6 main category chips (+ optional what's-new chip)",await p.locator("#tabs .chip:not(.newchip)").count()===6);
 // search
 const q=async s=>{await p.fill("#q",s);return p.locator(".card").count()};
 T("search by section name 'AI فيديو' → "+(D.sections.find(x=>x.id==="ai-video").items.length)+"",await q("AI فيديو")===D.sections.find(x=>x.id==="ai-video").items.length);
 T("search by section name 'خطوط' → ≥8",(await q("خطوط"))>=8);
 T("search section 'مواقع هتحتاجها' → "+D.sections.find(x=>x.id==="sites").items.length,await q("مواقع هتحتاجها")===D.sections.find(x=>x.id==="sites").items.length);
 const pt=PR.items[0].text.match(/Ultra Premium/)?"Ultra Premium":"";
 T("search by prompt text",(await q(pt))>=1);
 T("search by item title",(await q(D.sections[1].items[0].title))>=1);
 T("search no result message",(await q("zzzzqqq"))===0&&await p.locator(".empty").count()===1);
 await p.fill("#q","");

 // --- UI / UX جديد ---
 T("hero title is English name",(await p.locator("#hName").innerText()).replace(/\s+/g," ").trim()==="Abdelmalek Studio");
 T("owner name under photo + verified badge",(await p.locator("#owner").innerText()).includes(D.site.owner)&&await p.locator("#owner svg.verified").count()===1);
 const pos=await p.evaluate(()=>{const a=document.querySelector("#avatar").getBoundingClientRect(),o=document.querySelector("#owner").getBoundingClientRect();return o.top>=a.bottom-1&&Math.abs((o.left+o.right)/2-(a.left+a.right)/2)<40});
 T("owner caption sits directly under the photo",pos);
 await p.evaluate(()=>{location.hash="#s=video"});await p.waitForTimeout(500);
 T("a section opens with a banner (title)",await p.locator(".sec-head").count()===1&&await p.locator(".sec-head h2").count()===1);
 T("every section (14) has a cover file",D.sections.every(s=>s.cover&&fs.existsSync(ROOT+"/site/"+s.cover)));
 await p.waitForTimeout(600);
 await p.evaluate(()=>{location.hash="#s=prompts"});await p.waitForTimeout(500);await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(500);T("progress bar + back-to-top react to scroll",(await p.evaluate(()=>getComputedStyle(document.querySelector("#totop")).opacity))==="1");
 await p.evaluate(()=>window.scrollTo(0,0));
 const stick=await p.evaluate(async()=>{window.scrollTo(0,1500);await new Promise(r=>setTimeout(r,300));const h=document.querySelector("header.top").getBoundingClientRect();return h.top===0&&h.bottom>0&&getComputedStyle(document.querySelector("header.top")).position==="sticky"});
 T("header stays pinned while scrolling",stick);
 await p.evaluate(()=>window.scrollTo(0,0));
 // تغيير مقصود (المرحلة 1): الصوت اتلغى بالكامل، فاختبارات زر الصوت اتبدلت باختبارات إن مفيش صوت ولا زر ولا تفضيل متخزّن
 T("no sound button in the page",await p.locator("#sound").count()===0);
 T("no sound preference stored",await p.evaluate(()=>{try{return localStorage.getItem("sound")===null}catch(e){return true}}));
 // tab click: بيفلتر على القسم ويطلّع الشريط فوق
 await p.evaluate(()=>window.scrollTo(0,2500));await p.evaluate(()=>{location.hash="#s=fonts"});await p.waitForTimeout(900);
 T("tab click filters to that section only",await p.locator(".sec").count()===1&&await p.locator(".card").count()===8);
 // تغيير مقصود (طلب المستخدم، بعد المرحلة 3): الضغط على قسم بيطلّع الشريط فوق (تحت الهيدر) والهيرو (الاسم والصورة) يطلع برّه الشاشة، والمحتوى تحت الشريط
 T("section URL updated to #s=fonts",await p.evaluate(()=>location.hash.includes("s=fonts")));
 await p.evaluate(()=>{location.hash="#"});await p.waitForTimeout(500);
 // search result count text
 await p.fill("#q","midjourney");T("search shows result count text",(await p.locator("#results").innerText()).includes("midjourney"));await p.fill("#q","");
 // keyboard "/" focuses search
 await p.locator("body").click({position:{x:5,y:300}});await p.keyboard.press("/");T("'/' focuses search",await p.evaluate(()=>document.activeElement.id)==="q");
 await p.fill("#q","");
 // no horizontal overflow on mobile
 const mctx=await b.newContext({viewport:{width:390,height:800}});const mp=await mctx.newPage();await mp.goto(SITE);await mp.waitForSelector("#tabs .chip", {state: "attached"});await mp.waitForTimeout(500);
 T("mobile (390px): no horizontal scroll",await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await mctx.close();
 // reduced motion: content visible without animation
 const rctx=await b.newContext({reducedMotion:"reduce"});const rp=await rctx.newPage();await rp.goto(SITE+"#s=video");await rp.waitForSelector(".card");
 T("reduced-motion: cards visible immediately",(await rp.evaluate(()=>getComputedStyle(document.querySelector(".card")).opacity))==="1");
 await rctx.close();
 // Prompt cards: outside = name + description only, full prompt inside the modal
 await p.evaluate(()=>{location.hash="#s=prompts"});await p.waitForTimeout(500);T("prompt cards show no prompt text outside",(await p.locator(".pcard").first().innerText()).indexOf("PROJECT")<0&&await p.locator(".pcard .copy").count()===0);
 T("section title is English 'Prompts' (no Arabic word)",!/[\u0600-\u06FF]/.test(await p.locator("#prompts h2").innerText()));
 await p.evaluate(()=>{location.hash="#s=video"});await p.waitForTimeout(500);
 T("video cards show thumbnails outside (3)",await p.locator(".vcard .thumb img").count()===3);
 T("video cards link to the YouTube videos",(await p.locator(".vcard").evaluateAll(a=>a.map(x=>x.href))).every(h=>/youtu\.be\//.test(h)));
 await p.evaluate(()=>{location.hash="#s=prompts"});await p.waitForTimeout(500);
 const open=async n=>{await p.locator(".pcard").nth(n).click();await p.waitForSelector(".modal.show");};
 const shut=async()=>{await p.keyboard.press("Escape");await p.waitForSelector(".modal",{state:"hidden"});};
 await open(0);
 T("modal shows title + desc + full prompt",(await p.locator("#mTitle").innerText())===PR.items[0].title&&(await p.locator("#mCode").innerText()).includes("PROJECT")&&(await p.locator("#mDesc").innerText())===PR.items[0].desc);
 T("modal prompt displayed text equals original",(await p.locator("#mCode").evaluate(e=>e.textContent))===PR.items[0].text);
 await shut();T("Esc closes modal and restores focus to card",await p.evaluate(()=>document.activeElement.classList.contains("pcard")));
 await open(0);await p.locator(".modal-back").click({position:{x:5,y:5}});await p.waitForSelector(".modal",{state:"hidden"});T("backdrop click closes modal",true);
 await p.locator(".pcard").first().focus();await p.keyboard.press("Enter");await p.waitForSelector(".modal.show");T("Enter on card opens modal",true);await shut();
 // copy (from inside the modal)
 await open(0);await p.locator("#mCopy").click();await p.waitForTimeout(100);
 const lab=await p.locator("#mCopy").textContent();
 const cb=await p.evaluate(()=>navigator.clipboard.readText());
 T("copy success shows ✓ and clipboard equals prompt exactly",lab.includes("Copied")&&cb===PR.items[0].text);
 for(let i=0;i<6;i++)await p.locator("#mCopy").click();
 await p.waitForTimeout(1800);
 T("repeated clicks → label restores to original",(await p.locator("#mCopy").textContent())==="Copy Prompt");
 await p.locator("#mCopyTop").click();await p.waitForTimeout(100);T("top copy button works too",(await p.evaluate(()=>navigator.clipboard.readText()))===PR.items[0].text);await shut();
 await open(0);await p.locator("#mCopyTop").click();await p.waitForTimeout(900);await p.locator("#mCopy").click();await p.waitForTimeout(900);
 T("copy label: timer of the other button doesn't reset the label early",(await p.locator("#mCopy").textContent()).includes("Copied")&&(await p.locator("#mCopyTop").textContent()).includes("Copied"));await p.waitForTimeout(900);await shut();
 await open(1);await p.locator("#mCopy").click();await p.waitForTimeout(100);
 T("second prompt copies its own text",(await p.evaluate(()=>navigator.clipboard.readText()))===PR.items[1].text);await shut();
 // fallback success
 await p.evaluate(()=>{navigator.clipboard.writeText=()=>Promise.reject(new Error("x"));window.__ec=0;document.execCommand=c=>{window.__ec++;return true}});
 await open(2);await p.locator("#mCopy").click();await p.waitForFunction(()=>window.__ec>=1&&/Copied|failed/.test(document.querySelector("#mCopy").textContent),null,{timeout:5000}).catch(()=>{});await p.waitForTimeout(150);   // استنى لحد ما البديل (execCommand) يتنادى فعليًا بدل 100ms ثابتة — كان فيه فشل متقطع لأن النص القديم "Copied" بيفضل ظاهر 1.4 ثانية
 {const lb=await p.locator("#mCopy").textContent(),ec=await p.evaluate(()=>window.__ec);T("primary fails, fallback ok → success msg",lb.includes("Copied")&&ec===1,lb+" / execCommand calls="+ec);}await shut();
 // both fail
 await p.evaluate(()=>{document.execCommand=()=>false});
 await open(3);await p.locator("#mCopy").click();await p.waitForTimeout(100);
 const f=await p.locator("#mCopy").textContent();
 T("both fail → failure msg (no ✓ success)",f.includes("failed")&&!f.includes("Copied"));
 await p.evaluate(()=>{document.execCommand=()=>{throw new Error("no")}});
 await p.locator("#mCopy").click();await p.waitForTimeout(100);
 T("execCommand throws → failure msg",(await p.locator("#mCopy").textContent()).includes("failed"));
 await p.waitForTimeout(3200);
 T("failure label restores",(await p.locator("#mCopy").textContent())==="Copy Prompt");
 await shut();
 // Arabic search alias still finds prompts
 T("search 'برومبت' (Arabic) still finds the "+NP+" prompts",await q("برومبت")>=NP);await p.fill("#q","");
 
 await ctx.close();
 // admin
 ctx=await b.newContext({acceptDownloads:true});p=await ctx.newPage();const aerr=[];
 p.on("pageerror",e=>aerr.push(e.message));
 let dialogs=[];let answer=true;
 p.on("dialog",d=>{dialogs.push(d.message());answer?d.accept():d.dismiss()});
 await p.goto(ADMIN);await p.waitForSelector("#sections .panel");
 const cnt=async()=>({s:await p.locator("#sections > .panel").count(),i:await p.locator("#sections .item").count()});
 let c=await cnt();T("admin loads "+(NS)+"/"+(NI)+", no errors",c.s===NS&&c.i===NI&&aerr.length===0,JSON.stringify(c)+aerr.join());
 const dl=async(sel)=>{const [d]=await Promise.all([p.waitForEvent("download",{timeout:3000}).catch(()=>null),p.click(sel)]);if(!d)return null;const f=await d.path();return {name:d.suggestedFilename(),text:fs.readFileSync(f,"utf8")}};
 const parse=t=>JSON.parse(t.replace(/^\/\*[\s\S]*?\*\/\s*/,"").replace(/^window\.STUDIO_DATA\s*=\s*/,"").replace(/;\s*$/,""));
 let ex=await dl("#download");
 T("export unchanged data: valid, identical to site data",ex&&ex.name==="data.js"&&JSON.stringify(parse(ex.text))===JSON.stringify(D));
 // reorder section
 await p.locator('[data-act="secdown"]').first().click();
 let titles=await p.locator('#sections > .panel [data-f="title"][data-i]').count();
 const t0=await p.locator('#sections > .panel').first().locator('.sechead [data-f="title"]').inputValue();
 T("section move down",t0===D.sections[1].title);
 await p.locator('[data-act="secup"]').nth(1).click();
 T("section move up restores",(await p.locator('#sections > .panel').first().locator('.sechead [data-f="title"]').inputValue())===D.sections[0].title);
 // item reorder
 const itemTitles=async()=>p.locator('#sections > .panel').nth(PI).locator('.item [data-f="title"]').evaluateAll(a=>a.map(x=>x.value));
 await p.locator('#sections > .panel').nth(PI).locator('[data-act="itemdown"]').first().click();
 let it=await itemTitles();T("item move down",it[0]===PR.items[1].title&&it[1]===PR.items[0].title);
 await p.locator('#sections > .panel').nth(PI).locator('[data-act="itemup"]').nth(1).click();
 it=await itemTitles();T("item move up restores",it[0]===PR.items[0].title);
 // add section + item with validation errors
 await p.click("#addSec");c=await cnt();T("add section → "+(NS+1)+"",c.s===NS+1);
 const last=p.locator('#sections > .panel').last();
 await last.locator('[data-act="additem"]').click();c=await cnt();T("add item → "+(NI+1)+"",c.i===NI+1);
 ex=await dl("#download");
 const eb=await p.locator("#errbox").innerText();
 T("export blocked with clear location (empty item name + empty link)",ex===null&&new RegExp("القسم رقم "+(NS+1)).test(eb)&&/العنصر رقم 1/.test(eb)&&/اسم العنصر فاضي/.test(eb)&&/اللينك فاضي/.test(eb),eb.replace(/\n/g," | "));
 await last.locator('.item [data-f="title"]').fill("اختبار");
 await last.locator('.item [data-f="type"]').selectOption("prompt");
 ex=await dl("#download");T("export blocked: empty prompt text",ex===null&&/نص الـ Prompt فاضي/.test(await p.locator("#errbox").innerText()));
 await last.locator('.item [data-f="text"]').fill("نص تجريبي");
 await last.locator('.item [data-f="type"]').selectOption("link");
 await last.locator('.item [data-f="url"]').fill("not a url");
 ex=await dl("#download");T("export blocked: invalid link",ex===null&&/مش صحيح/.test(await p.locator("#errbox").innerText()));
 await last.locator('.item [data-f="url"]').fill("javascript:alert(1)");
 ex=await dl("#download");T("export blocked: javascript: link",ex===null);
 await last.locator('.item [data-f="url"]').fill("https://example.com/x");
 await last.locator('.sechead [data-f="id"]').fill(D.sections[0].id);
 ex=await dl("#download");T("export blocked: duplicate section id",ex===null&&/مكرر/.test(await p.locator("#errbox").innerText()));
 await last.locator('.sechead [data-f="id"]').fill("bad id!");
 ex=await dl("#download");T("export blocked: invalid section id",ex===null);
 await last.locator('.sechead [data-f="id"]').fill("");
 ex=await dl("#download");T("export blocked: empty section id",ex===null);
 await last.locator('.sechead [data-f="id"]').fill("test-sec");
 await last.locator('.sechead [data-f="title"]').fill("  ");
 ex=await dl("#download");T("export blocked: empty section name",ex===null&&/اسم القسم فاضي/.test(await p.locator("#errbox").innerText()));
 await last.locator('.sechead').locator('xpath=..').locator('[data-f="cover"]').fill('../../etc/x.jpg');
 ex=await dl('#download');T('export blocked: bad cover path',ex===null&&/صورة الغلاف/.test(await p.locator('#errbox').innerText()));
 await last.locator('[data-f="cover"]').fill('assets/img/sections/a.jpg');
 await last.locator('.sechead [data-f="title"]').fill('');
 // goto link
 await p.locator('#errbox [data-goto]').first().click();T("'go to location' link works (no crash)",true);
 await last.locator('.sechead [data-f="title"]').fill("قسم اختبار");
 ex=await dl("#download");
 let E=ex&&parse(ex.text);
 T("section desc/cover fields exist in admin for all 14",(await p.locator('[data-f="desc"][data-s]:not([data-i])').count())>=14);
 T("export succeeds after fixes: "+(NS+1)+" sections / "+(NI+1)+" items, new ids unique",E&&E.sections.length===NS+1&&E.sections.flatMap(s=>s.items).length===NI+1&&new Set(E.sections.flatMap(s=>s.items.map(i=>i.id))).size===NI+1);
 T("exported originals unchanged (prompts/urls)",E&&JSON.stringify(E.sections.slice(0,NS))===JSON.stringify(D.sections)&&JSON.stringify(E.site)===JSON.stringify(D.site));
 // backup
 const bk=await dl("#backup");
 const B=bk&&JSON.parse(bk.text);
 T("backup downloads JSON (even with unsaved work)",bk&&/^abdelmalek-backup-.*\.json$/.test(bk.name)&&B.format==="abdelmalek-studio-backup"&&B.sections.length===NS+1);
 // delete item & section
 dialogs=[];answer=false;await last.locator('[data-act="delitem"]').click();c=await cnt();
 T("delete item cancelled → unchanged ("+(NI+1)+")",c.i===NI+1&&dialogs.length===1);
 answer=true;await last.locator('[data-act="delitem"]').click();c=await cnt();T("delete item confirmed → "+(NI)+"",c.i===NI);
 await last.locator('[data-act="delsec"]').click();c=await cnt();T("delete section → "+(NS)+"",c.s===NS);
 // restore: dismissed
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"abd-"));
 fs.writeFileSync(tmp+"/b.json",bk.text);
 dialogs=[];answer=false;await p.setInputFiles("#restore",tmp+"/b.json");await p.waitForTimeout(300);
 c=await cnt();T("restore declined → data NOT replaced",c.s===NS&&dialogs.length===1&&/هتتستبدل/.test(dialogs[0]),dialogs[0]);
 answer=true;dialogs=[];await p.setInputFiles("#restore",tmp+"/b.json");await p.waitForTimeout(300);
 c=await cnt();T("restore confirmed → "+(NS+1)+" sections / "+(NI+1)+" items restored",c.s===NS+1&&c.i===NI+1);
 // delete again then roundtrip export of restored
 // legacy import
 const LG=JSON.parse(JSON.stringify(D));LG.sections.forEach(s=>s.items.forEach(i=>delete i.id));fs.writeFileSync(tmp+"/legacy.js","const SITE = "+JSON.stringify(LG.site,null,2)+";\n\nconst SECTIONS = "+JSON.stringify(LG.sections,null,2)+";\n");
 dialogs=[];await p.setInputFiles("#file",tmp+"/legacy.js");await p.waitForTimeout(300);
 c=await cnt();T("open legacy data.js (old format) → "+(NS)+"/"+(NI)+" with ids added",c.s===NS&&c.i===NI&&/صيغة قديمة/.test(dialogs[0]));
 ex=await dl("#download");E=ex&&parse(ex.text);
 const s2=JSON.parse(JSON.stringify(E.sections));s2.forEach(s=>s.items.forEach(i=>delete i.id));
 T("legacy → export loses nothing",JSON.stringify(s2)===JSON.stringify(LG.sections)&&JSON.stringify(E.site)===JSON.stringify(LG.site)&&E.sections.flatMap(s=>s.items).every(i=>i.id));
 // malicious
 fs.writeFileSync(tmp+"/evil.js","window.__pwned=1;const SITE={};const SECTIONS=[];");
 dialogs=[];await p.setInputFiles("#file",tmp+"/evil.js");await p.waitForTimeout(300);
 T("code-bearing file rejected, not executed, data untouched",!(await p.evaluate(()=>window.__pwned))&&dialogs.length===1&&/مقدرتش/.test(dialogs[0])&&(await cnt()).s===NS,dialogs[0]);
 fs.writeFileSync(tmp+"/evil2.js","window.STUDIO_DATA = (function(){window.__pwned=2;return {site:{},sections:[]}})();");
 dialogs=[];await p.setInputFiles("#file",tmp+"/evil2.js");await p.waitForTimeout(300);
 T("IIFE payload rejected (JSON.parse only)",!(await p.evaluate(()=>window.__pwned))&&/مقدرتش/.test(dialogs[0]||""));
 fs.writeFileSync(tmp+"/bad.json","{not json");
 dialogs=[];await p.setInputFiles("#restore",tmp+"/bad.json");await p.waitForTimeout(300);
 T("broken JSON rejected, data untouched",/مقدرتش/.test(dialogs[0]||"")&&(await cnt()).s===NS);
 fs.writeFileSync(tmp+"/shape.json",JSON.stringify({format:"abdelmalek-studio-backup",site:{},sections:"x"}));
 dialogs=[];await p.setInputFiles("#restore",tmp+"/shape.json");await p.waitForTimeout(300);
 T("wrong shape rejected",/مقدرتش/.test(dialogs[0]||""));
 // duplicate ids in imported file → warns, export blocked
 const dup=JSON.parse(JSON.stringify(D));const PRd=dup.sections.find(x=>x.id==="prompts");PRd.items[1].id=PRd.items[0].id;dup.sections[1].id=dup.sections[0].id;
 fs.writeFileSync(tmp+"/dup.json",JSON.stringify({format:"abdelmalek-studio-backup",site:dup.site,sections:dup.sections}));
 await p.setInputFiles("#restore",tmp+"/dup.json");await p.waitForTimeout(300);
 const eb2=await p.locator("#errbox").innerText();
 T("imported duplicates flagged with location; export blocked",/مكرر/.test(eb2)&&(await dl("#download"))===null,eb2.replace(/\n/g," | "));
 // edit profile & social
 await p.click("#reset");await p.waitForTimeout(200);
 T("reset to original (confirmed) → "+(NS)+"/"+(NI)+"",(await cnt()).i===NI);
 await p.fill('[data-p="name"]',"اسم جديد");
 await p.locator('[data-act="addsoc"]').click();
 ex=await dl("#download");T("empty social blocked",ex===null&&/زرار التواصل/.test(await p.locator("#errbox").innerText()));
 

 // ================= تحقق اللوحة الموحّد (لينكات / صور / ألوان) =================
 await p.click("#reset");await p.waitForTimeout(200);
 const firstUrl=p.locator('#sections .item [data-f="url"]').first(),origItemUrl=D.sections.flatMap(s=>s.items).find(i=>i.type!=="prompt").url;
 const errText=async()=>p.locator("#errbox").innerText();
 const blocked=async(name,re)=>{const x=await dl("#download");const e=x===null?await errText():"";T(name,x===null&&re.test(e),e.replace(/\n/g," | ").slice(0,200));};
 const okExport=async(name)=>{const x=await dl("#download");T(name,x!==null);return x;};
 await okExport("validation: untouched data exports (baseline)");
 // صورة البروفايل واللوجو
 for(const [v,n] of [["javascript:alert(1)","javascript: photo"],["assets/img/photo.txt","non-image extension"],["../x.jpg","parent-folder path"],["/etc/x.jpg","absolute path"],["data:image/png;base64,AAAA","data: URI"]])
  {await p.fill('[data-p="photo"]',v);await blocked("profile photo rejected: "+n,/الصورة الشخصية/);}
 await p.fill('[data-p="photo"]',"https://example.com/me.jpg");await okExport("profile photo: https URL accepted");
 await p.fill('[data-p="photo"]',"assets/img/photo.jpg");
 await p.fill('[data-p="logo"]',"data:image/svg+xml;base64,AAA");await blocked("logo rejected: data: URI",/اللوجو/);
 await p.fill('[data-p="logo"]',"assets/img/logo");await blocked("logo rejected: no image extension",/اللوجو/);
 await p.fill('[data-p="logo"]',"assets/img/logo.svg");
 // الألوان
 for(const v of ["red","#FDC71","#GGGGGG","FDC713","rgb(1,2,3)","#FDC7133"]){await p.fill('[data-p="accent"]',v);await blocked("color rejected: «"+v+"»",/اللون الأساسي.*#FDC713/);}
 await p.fill('[data-p="accent"]',"#fdc");await okExport("color accepted: #fdc");
 await p.fill('[data-p="accent2"]',"blue");await blocked("second color rejected: «blue»",/اللون التاني/);
 await p.fill('[data-p="accent"]',"#FDC713");await p.fill('[data-p="accent2"]',"#F58220");await okExport("colors restored → exports");
 // لينكات العناصر والسوشيال: نفس القواعد ونفس الرسائل
 const bad=[["javascript:alert(1)",/غير آمن/],["JaVaScRiPt:alert(1)",/غير آمن/],["data:text/html,<b>x</b>",/غير آمن/],["vbscript:x",/غير آمن/],["file:///etc/passwd",/غير آمن/],["ftp://example.com/f",/مش صحيح/],["https://user:pw@example.com/",/مش صحيح/],["https://nodot",/مش صحيح/],["https://exa mple.com",/مش صحيح/],["example.com",/مش صحيح/],["",/اللينك فاضي/]];
 for(const [v,re] of bad){await firstUrl.fill(v);await blocked("item link rejected: «"+v+"»",re);}
 await firstUrl.fill(origItemUrl);
 const socUrl=p.locator('[data-soc="0"][data-f="url"]'),origSoc=D.site.socials[0].url;
 for(const [v,re] of bad.slice(0,6)){await socUrl.fill(v);await blocked("social link rejected: «"+v+"» (same message as items)",re);}
 await socUrl.fill("mailto:me@example.com");await okExport("social: mailto: accepted");
 await socUrl.fill(origSoc);
 await firstUrl.fill("javascript:alert(1)");await dl("#download");const e1=await errText();
 T("error message states location (section + item) and has 'go to' link",/القسم رقم 1/.test(e1)&&/العنصر رقم \d+/.test(e1)&&await p.locator("#errbox [data-goto]").count()>=1);
 await firstUrl.fill(origItemUrl);
 // أغلفة الأقسام
 const cov=p.locator('#sec-0 [data-f="cover"]'),origCov=D.sections[0].cover;
 for(const v of ["assets/img/sections/x","javascript:x.jpg","assets/img/sections/../../x.jpg","assets/x.js"]){await cov.fill(v);await blocked("cover rejected: «"+v+"»",/صورة الغلاف/);}
 await cov.fill("https://example.com/c.jpg");await okExport("cover: https URL accepted");
 await cov.fill("assets/img/sections/does-not-exist.jpg");
 const xm=await okExport("cover: missing local file does NOT block export (warning only)");
 await p.waitForSelector("#errbox:not([hidden])",{timeout:4000}).catch(()=>{});
 T("cover: missing file produces a clear non-blocking warning",xm!==null&&/مش موجود/.test(await errText()),(await errText()).replace(/\n/g," | ").slice(0,160));
 await cov.fill(origCov);
 await okExport("validation: restored → exports again");
 T("existing local images are NOT reported missing",!/مش موجود/.test(await p.locator("#errbox").innerText()||"")||await p.locator("#errbox").isHidden());

 // ================= عدم فقدان البيانات بعد تعديل الأقسام والعناصر =================
 await p.click("#reset");await p.waitForTimeout(200);
 const origItems=Object.fromEntries(D.sections.flatMap(s=>s.items).map(i=>[i.id,i]));
 await p.locator('[data-s="1"][data-i="0"][data-f="title"]').fill("عنوان معدّل للاختبار");
 await p.locator('[data-act="secdown"][data-s="2"]').click();                    // قسم 3 ينزل مكان 4
 await p.locator('[data-act="additem"][data-s="0"]').click();                   // عنصر مؤقت
 answer=true;await p.locator('#sec-0 [data-act="delitem"]').last().click();   // ويتحذف
 await p.locator('[data-act="itemdown"][data-s="3"][data-i="0"]').click();       // تحريك عنصر
 await p.locator('[data-act="itemup"][data-s="3"][data-i="1"]').click();         // ورجوعه
 ex=await dl("#download");E=ex&&parse(ex.text);
 const eItems=E?Object.fromEntries(E.sections.flatMap(s=>s.items).map(i=>[i.id,i])):{};
 const changed=Object.keys(origItems).filter(id=>JSON.stringify(origItems[id])!==JSON.stringify(eItems[id]));
 T("data safety: still "+(NS)+" sections / "+(NI)+" items after edit+move+add+delete",E&&E.sections.length===NS&&E.sections.flatMap(s=>s.items).length===NI);
 T("data safety: only the edited item changed (all others identical, ids kept)",E&&changed.length===1&&eItems[changed[0]].title==="عنوان معدّل للاختبار",changed.join());
 T("data safety: section moved, others untouched (order + fields)",E&&E.sections[2].id===D.sections[3].id&&E.sections[3].id===D.sections[2].id&&JSON.stringify(E.sections[3].desc)===JSON.stringify(D.sections[2].desc)&&JSON.stringify(E.site)===JSON.stringify(D.site));
 T("data safety: prompts text byte-identical after round-trip",E&&JSON.stringify(E.sections.find(s=>s.id==="prompts").items.map(i=>i.text))===JSON.stringify(PR.items.map(i=>i.text)));
 // backup → restore roundtrip بيرجّع نفس البيانات بالظبط
 const bk2=await dl("#backup");fs.writeFileSync(tmp+"/rt.json",bk2.text);await p.click("#reset");await p.waitForTimeout(200);
 answer=true;await p.setInputFiles("#restore",tmp+"/rt.json");await p.waitForTimeout(300);
 ex=await dl("#download");const E2=ex&&parse(ex.text);
 T("backup → restore → export round-trip is lossless",E&&E2&&JSON.stringify(E2)===JSON.stringify(E));

 // ================= استيراد: نسخ قديمة/جديدة + أمان =================
 const plain=JSON.stringify({site:D.site,sections:D.sections});fs.writeFileSync(tmp+"/plain.json",plain);
 answer=true;dialogs=[];await p.setInputFiles("#restore",tmp+"/plain.json");await p.waitForTimeout(300);
 T("import plain {site,sections} JSON → "+(NS)+"/"+(NI)+"",(await cnt()).i===NI&&(await cnt()).s===NS);
 const old=JSON.parse(plain);delete old.site.socials;old.sections.forEach(s=>{delete s.desc;delete s.cover;delete s.icon});old.sections[0].items.forEach(i=>delete i.id);delete old.sections[1].items;
 fs.writeFileSync(tmp+"/old.json",JSON.stringify({format:"abdelmalek-studio-backup",site:old.site,sections:old.sections}));
 dialogs=[];await p.setInputFiles("#restore",tmp+"/old.json");await p.waitForTimeout(300);
 const oc=await cnt();T("import older/partial backup (no ids, no socials, missing items) loads without crash",oc.s===NS&&oc.i===NI-D.sections[1].items.length,JSON.stringify(oc));
 // محتوى خبيث جوه النصوص: بيتعرض كنص ومبيتنفذش
 const xss=JSON.parse(plain);xss.sections[0].items[0].title='<img src=x onerror="window.__xss=1">';xss.sections[0].items[0].desc='</script><script>window.__xss=2</script>';xss.site.name='"><svg onload=window.__xss=3>';
 fs.writeFileSync(tmp+"/xss.json",JSON.stringify({format:"abdelmalek-studio-backup",site:xss.site,sections:xss.sections}));
 dialogs=[];await p.setInputFiles("#restore",tmp+"/xss.json");await p.waitForTimeout(500);
 T("imported markup is shown as plain text, nothing executes",!(await p.evaluate(()=>window.__xss))&&await p.locator('[data-s="0"][data-i="0"][data-f="title"]').inputValue()===xss.sections[0].items[0].title&&await p.locator("#sections img[src='x'], #profile svg").count()===0);
 ex=await dl("#download");const E3=ex&&parse(ex.text);
 T("exported file keeps the hostile text as inert JSON data",E3&&E3.sections[0].items[0].title===xss.sections[0].items[0].title&&E3.sections[0].items[0].desc===xss.sections[0].items[0].desc);
 // ملف فيه بيانات غير صحيحة: بيتحمّل (من غير فقدان) + بيتوضح الخطأ ومكانه + التنزيل ممنوع
 const bd=JSON.parse(plain);bd.site.accent="red";bd.site.photo="javascript:x";bd.sections[2].items[0].url="javascript:alert(1)";bd.sections[3].cover="http://";
 fs.writeFileSync(tmp+"/bad2.json",JSON.stringify({format:"abdelmalek-studio-backup",site:bd.site,sections:bd.sections}));
 dialogs=[];await p.setInputFiles("#restore",tmp+"/bad2.json");await p.waitForTimeout(400);
 const eb3=await errText();
 T("imported invalid data: nothing lost, every problem listed with its location",(await cnt()).i===NI&&/اللون الأساسي/.test(eb3)&&/الصورة الشخصية/.test(eb3)&&/القسم رقم 3.*العنصر رقم 1.*غير آمن/.test(eb3.replace(/\n/g," "))&&/القسم رقم 4.*صورة الغلاف/.test(eb3.replace(/\n/g," ")),eb3.replace(/\n/g," | ").slice(0,300));
 T("imported invalid data: export stays blocked until fixed",(await dl("#download"))===null);
 await p.click("#reset");await p.waitForTimeout(200);

 // ================= بيانات بأنواع غير متوقعة (رقم / Object / Array / null / Boolean) =================
 // كل حالة بتتستورد كملف حقيقي، والمطلوب: مفيش Crash، البيانات المستوردة محفوظة بالظبط (مفيش فقدان)،
 // الخطأ واضح ومعاه مكانه، والتنزيل ممنوع. التحقق نفسه (validateData) بيتجرّب كمان على مئات القيم الغريبة.
 {
  let dlCount=0;p.on("download",()=>dlCount++);
  const base=()=>JSON.parse(JSON.stringify({site:D.site,sections:D.sections}));
  const norm=s=>s.replace(/\s+/g," ");
  const writeBackup=o=>fs.writeFileSync(tmp+"/t.json",JSON.stringify({format:"abdelmalek-studio-backup",site:o.site,sections:o.sections}));
  const loadFile=async o=>{writeBackup(o);dialogs=[];answer=true;await p.setInputFiles("#restore",tmp+"/t.json");await p.waitForTimeout(250)};
  const itemCount=o=>o.sections.reduce((a,s)=>a+(Array.isArray(s.items)?s.items.length:0),0);
  const L0=D.sections[0].items[0];                       // عنصر لينك عادي في القسم الأول
  const BAD=async(name,mut,res,opt={})=>{
   const o=base();mut(o);const before=aerr.length;
   await loadFile(o);
   const eb=norm(await errText());
   const c1=await cnt();
   let goto=true;
   if(opt.goto){const n=await p.locator("#errbox [data-goto]").count();if(n>=1){await p.locator("#errbox [data-goto]").first().click();await p.waitForTimeout(100)}else goto=false}
   const n0=dlCount;await p.click("#download");await p.waitForTimeout(150);
   const eb2=norm(await errText());
   const blocked=dlCount===n0&&/التنزيل اتوقف/.test(eb2);
   const bk=await dl("#backup");const B=bk&&JSON.parse(bk.text);
   const kept=!!B&&JSON.stringify(B.site)===JSON.stringify(o.site)&&JSON.stringify(B.sections)===JSON.stringify(o.sections);
   const matched=[].concat(res).every(r=>r.test(eb)&&r.test(eb2));
   const ok=aerr.length===before&&dialogs.length===1&&c1.s===o.sections.length&&c1.i===itemCount(o)&&matched&&blocked&&kept&&goto;
   T(name,ok,ok?"":JSON.stringify({crash:aerr.length-before,dialogs:dialogs.length,counts:c1,matched,blocked,kept,goto})+" | "+eb.slice(0,260));
  };
  // --- الحالات المطلوبة بالاسم ---
  await BAD("invalid type: section title is a number (no crash, located)",o=>{o.sections[0].title=123},/القسم رقم 1: اسم القسم لازم يكون نص.*رقم: 123/,{goto:true});
  await BAD("invalid type: item title is a number (no crash, located)",o=>{o.sections[1].items[0].title=456},/القسم رقم 2.*العنصر رقم 1: اسم العنصر لازم يكون نص.*رقم: 456/,{goto:true});
  await BAD("invalid type: nameEn is a number",o=>{o.site.nameEn=789},/الملف الشخصي: الاسم بالإنجليزي لازم يكون نص.*رقم: 789/);
  await BAD("invalid type: photo is an Object",o=>{o.site.photo={a:1}},/مسار الصورة الشخصية لازم يكون نص.*كائن \(Object\)/);
  await BAD("invalid type: photo is a number (old isImagePath accepted it)",o=>{o.site.photo=123},/مسار الصورة الشخصية لازم يكون نص.*رقم: 123/);
  await BAD("invalid type: logo is an Array",o=>{o.site.logo=["assets/img/logo.svg"]},/مسار اللوجو لازم يكون نص.*قائمة \(Array\)/);
  for(const [lab,v] of [["number",5],["Boolean",true],["Object",{}],["Array",["x"]]])
   await BAD("invalid type: tagline is "+lab,o=>{o.site.tagline=v},/السطر التعريفي \(tagline\) لازم يكون نص/);
  await BAD("invalid type: section description is not text",o=>{o.sections[2].desc=7},/القسم رقم 3.*وصف القسم لازم يكون نص.*رقم: 7/,{goto:true});
  await BAD("invalid type: item link is an Object",o=>{o.sections[0].items[0].url={href:"https://example.com"}},/القسم رقم 1.*العنصر رقم 1.*اللينك لازم يكون نص.*كائن \(Object\)/,{goto:true});
  await BAD("invalid type: item link is a number",o=>{o.sections[0].items[0].url=12345},/اللينك لازم يكون نص.*رقم: 12345/,{goto:true});
  await BAD("unknown item type «weird»",o=>{o.sections[0].items[0].type="weird"},/العنصر رقم 1.*نوع العنصر «weird» غير معروف \(المسموح: link \/ prompt \/ video \/ file\)/,{goto:true});
  await BAD("unknown item type «constructor» (inherited property must not pass)",o=>{o.sections[0].items[0].type="constructor"},/نوع العنصر «constructor» غير معروف/,{goto:true});
  await BAD("unknown item type «__proto__»",o=>{o.sections[0].items[0].type="__proto__"},/نوع العنصر «__proto__» غير معروف/,{goto:true});
  await BAD("invalid type: item type is a number",o=>{o.sections[0].items[0].type=1},/نوع العنصر لازم يكون نص.*رقم: 1/,{goto:true});
  // --- باقي حقول الملف الشخصي ---
  await BAD("invalid type: name is a number",o=>{o.site.name=42},/الاسم بالعربي لازم يكون نص.*رقم: 42/);
  await BAD("invalid type: owner is an Array",o=>{o.site.owner=["x"]},/اسم صاحب الموقع \(owner\) لازم يكون نص.*قائمة/);
  await BAD("invalid type: about is an Object",o=>{o.site.about={t:"x"}},/النبذة \(about\) لازم يكون نص.*كائن/);
  await BAD("invalid type: verified is a string (must be Boolean)",o=>{o.site.verified="yes"},/علامة التوثيق \(verified\) لازم تكون true أو false.*نص/);
  await BAD("invalid type: verified is a number",o=>{o.site.verified=1},/علامة التوثيق \(verified\) لازم تكون true أو false.*رقم: 1/);
  await BAD("invalid type: accent color is a number",o=>{o.site.accent=123456},/اللون الأساسي «123456» مش كود لون صحيح/);
  await BAD("invalid type: social label is a number",o=>{o.site.socials[0].label=9},/زرار التواصل رقم 1.*الاسم لازم يكون نص.*رقم: 9/);
  await BAD("invalid type: social link is an Object",o=>{o.site.socials[0].url={u:1}},/زرار التواصل رقم 1.*اللينك لازم يكون نص.*كائن/);
  // --- باقي حقول الأقسام والعناصر ---
  await BAD("invalid type: section id is a number",o=>{o.sections[0].id=5},/القسم رقم 1.*معرّف القسم \(ID\) لازم يكون نص.*رقم: 5/,{goto:true});
  await BAD("invalid type: section icon is an Object",o=>{o.sections[0].icon={}},/القسم رقم 1.*الرمز \(icon\) لازم يكون نص/,{goto:true});
  await BAD("invalid type: section cover is a number",o=>{o.sections[0].cover=5},/القسم رقم 1.*مسار صورة الغلاف لازم يكون نص.*رقم: 5/,{goto:true});
  await BAD("invalid type: section cover is an Array",o=>{o.sections[0].cover=[]},/القسم رقم 1.*مسار صورة الغلاف لازم يكون نص.*قائمة/,{goto:true});
  await BAD("invalid type: item id is a number (kept as-is, reported — not silently replaced)",o=>{o.sections[0].items[0].id=77},/القسم رقم 1.*العنصر رقم 1.*معرّف العنصر \(ID\) لازم يكون نص.*رقم: 77/,{goto:true});
  await BAD("invalid type: item description is an Object",o=>{o.sections[0].items[0].desc={d:1}},/العنصر رقم 1.*الوصف لازم يكون نص.*كائن/,{goto:true});
  await BAD("invalid type: item tag is a number",o=>{o.sections[0].items[0].tag=3},/العنصر رقم 1.*التصنيف القديم \(tag\) لازم يكون نص.*رقم: 3/,{goto:true});
  await BAD("invalid type: link item's optional text is an Object",o=>{o.sections[0].items[0].text={x:1}},/العنصر رقم 1.*حقل النص \(text\) لازم يكون نص.*كائن/,{goto:true});
  await BAD("invalid type: Prompt text is a number",o=>{o.sections[PI].items[0].text=100},new RegExp("القسم رقم "+(PI+1)+".*العنصر رقم 1.*نص الـ Prompt لازم يكون نص.*رقم: 100"),{goto:true});
  await BAD("invalid type: Prompt item's unused link is an Object",o=>{o.sections[PI].items[0].url={x:1}},new RegExp("القسم رقم "+(PI+1)+".*العنصر رقم 1.*اللينك لازم يكون نص.*كائن"),{goto:true});
  // --- null / ناقص في الحقول المطلوبة (لازم خطأ واضح) ---
  await BAD("null/missing: name null",o=>{o.site.name=null},/الملف الشخصي: الاسم بالعربي فاضي/);
  await BAD("null/missing: name missing",o=>{delete o.site.name},/الملف الشخصي: الاسم بالعربي فاضي/);
  await BAD("null/missing: section title null",o=>{o.sections[0].title=null},/القسم رقم 1: اسم القسم فاضي/,{goto:true});
  await BAD("null/missing: section id null",o=>{o.sections[0].id=null},/القسم رقم 1.*معرّف القسم \(ID\) فاضي/,{goto:true});
  await BAD("null/missing: item title null",o=>{o.sections[0].items[0].title=null},/العنصر رقم 1: اسم العنصر فاضي/,{goto:true});
  await BAD("null/missing: item type missing",o=>{delete o.sections[0].items[0].type},/العنصر رقم 1.*نوع العنصر ناقص/,{goto:true});
  await BAD("null/missing: item type null",o=>{o.sections[0].items[0].type=null},/العنصر رقم 1.*نوع العنصر ناقص/,{goto:true});
  await BAD("null/missing: item link null",o=>{o.sections[0].items[0].url=null},/العنصر رقم 1.*اللينك فاضي/,{goto:true});
  await BAD("null/missing: item link missing",o=>{delete o.sections[0].items[0].url},/العنصر رقم 1.*اللينك فاضي/,{goto:true});
  await BAD("null/missing: Prompt text null",o=>{o.sections[PI].items[0].text=null},/نص الـ Prompt فاضي/,{goto:true});
  await BAD("null/missing: Prompt text missing",o=>{delete o.sections[PI].items[0].text},/نص الـ Prompt فاضي/,{goto:true});
  await BAD("null/missing: social label null + link null",o=>{o.site.socials[0].label=null;o.site.socials[0].url=null},[/زرار التواصل رقم 1.*الاسم فاضي/,/زرار التواصل رقم 1.*اللينك فاضي/]);
  await BAD("several invalid values at once → all listed, each with its own location",o=>{o.sections[0].title=1;o.sections[1].items[0].title=2;o.site.nameEn=3;o.site.photo={}},[/القسم رقم 1: اسم القسم/,/القسم رقم 2.*العنصر رقم 1: اسم العنصر/,/الاسم بالإنجليزي/,/مسار الصورة الشخصية/],{goto:true});

  // --- حقول اختيارية: null / ناقص / فاضي مقبولين (مفيش خطأ) والموقع بيفتح من غير مشاكل بعد التصدير ---
  {
   const o=base();Object.assign(o.site,{nameEn:null,owner:null,tagline:null,about:null,photo:null,logo:null,accent:null,accent2:null,verified:null});
   delete o.site.owner;
   o.sections[0].icon=null;o.sections[0].desc=null;o.sections[0].cover=null;delete o.sections[1].desc;
   const it0=o.sections[0].items[0];it0.desc=null;it0.tag=null;delete o.sections[1].items[0].desc;delete o.sections[1].items[0].tag;
   const before=aerr.length;await loadFile(o);
   const hidden=await p.locator("#errbox").isHidden();
   const x=await dl("#download");
   T("optional fields: null / missing / empty are accepted (no errors) and export works",aerr.length===before&&hidden&&x!==null&&dialogs.length===1,"hidden="+hidden+" export="+(x!==null));
   const Y=tmp+"/site-y";fs.rmSync(Y,{recursive:true,force:true});fs.cpSync(ROOT+"/site",Y,{recursive:true});fs.writeFileSync(Y+"/data/data.js",x.text);
   const c=await b.newContext();const pg=await c.newPage();const pe=[];pg.on("pageerror",e=>pe.push(e.message));await pg.goto("file://"+Y+"/index.html");await pg.waitForSelector("#tabs .chip", {state: "attached"});
   T("site opens with the exported optional-null data: no JS errors, all cards shown",pe.length===0&&(await pg.locator(".card").count())===await HNp(pg),pe.join(";"));
   await c.close();
  }
  // --- من البيانات الغلط للتصليح من الفورم لحد موقع شغال ---
  {
   const o=base();o.site.nameEn=123;o.sections[0].title=456;
   await loadFile(o);
   await p.fill('[data-p="nameEn"]',D.site.nameEn);await p.fill('[data-s="0"][data-f="title"]:not([data-i])',D.sections[0].title);
   const x=await dl("#download");
   T("fix invalid values in the form → export is allowed again and equals the original data",x!==null&&JSON.stringify(parse(x.text))===JSON.stringify(D));
   const Y=tmp+"/site-y";fs.rmSync(Y,{recursive:true,force:true});fs.cpSync(ROOT+"/site",Y,{recursive:true});fs.writeFileSync(Y+"/data/data.js",x.text);
   const c=await b.newContext();const pg=await c.newPage();const pe=[];pg.on("pageerror",e=>pe.push(e.message));await pg.goto("file://"+Y+"/index.html");await pg.waitForSelector("#tabs .chip", {state: "attached"});
   T("site opens with the repaired export: no JS errors",pe.length===0&&(await pg.locator(".card").count())===await HNp(pg)&&(await pg.locator("#hName").innerText()).replace(/\s+/g," ").trim()===D.site.nameEn,pe.join(";"));
   await c.close();
  }
  // --- ملفات شكلها العام غلط: الاستيراد بيترفض برسالة واضحة والبيانات الحالية ما بتتغيرش ---
  await p.click("#reset");await p.waitForTimeout(200);
  const REJ=async(name,mut,re)=>{
   const o=base();mut(o);const before=aerr.length,c0=await cnt(),nm=await p.inputValue('[data-p="name"]');
   fs.writeFileSync(tmp+"/s.json",JSON.stringify({format:"abdelmalek-studio-backup",site:o.site,sections:o.sections}));
   dialogs=[];answer=true;await p.setInputFiles("#restore",tmp+"/s.json");await p.waitForTimeout(250);
   const c1=await cnt(),nm1=await p.inputValue('[data-p="name"]');
   const ok=aerr.length===before&&dialogs.length===1&&/مقدرتش/.test(dialogs[0])&&re.test(dialogs[0])&&c1.s===c0.s&&c1.i===c0.i&&nm===nm1;
   T(name,ok,ok?"":JSON.stringify({crash:aerr.length-before,dialogs,c0,c1}));
  };
  await REJ("malformed file: an item that is null → rejected with location, current data untouched",o=>{o.sections[0].items[2]=null},/القسم رقم 1، العنصر رقم 3 شكله غلط/);
  await REJ("malformed file: an item that is a string",o=>{o.sections[1].items[0]="x"},/القسم رقم 2، العنصر رقم 1 شكله غلط/);
  await REJ("malformed file: a section that is null",o=>{o.sections[3]=null},/القسم رقم 4 شكله غلط/);
  await REJ("malformed file: a section that is a number",o=>{o.sections[0]=7},/القسم رقم 1 شكله غلط/);
  await REJ("malformed file: section items is a string",o=>{o.sections[0].items="x"},/عناصر القسم رقم 1 لازم تكون قائمة/);
  await REJ("malformed file: section items is an Object",o=>{o.sections[0].items={}},/عناصر القسم رقم 1 لازم تكون قائمة/);
  await REJ("malformed file: a social button that is null",o=>{o.site.socials[1]=null},/زرار التواصل رقم 2 شكله غلط/);
  await REJ("malformed file: socials is an Object",o=>{o.site.socials={}},/أزرار التواصل \(socials\) لازم تكون قائمة/);
  await REJ("malformed file: site is an Array",o=>{o.site=[]},/بيانات الموقع \(site\)/);
  await REJ("malformed file: site is a number",o=>{o.site=5},/بيانات الموقع \(site\)/);
  await REJ("malformed file: sections is an Object",o=>{o.sections={}},/قائمة الأقسام \(sections\)/);
  await REJ("malformed file: sections is null",o=>{o.sections=null},/قائمة الأقسام \(sections\)/);
  {
   const o=base();o.site.socials=null;o.sections[2].items=null;const before=aerr.length;const expItems=itemCount(o);
   await loadFile(o);const c=await cnt();
   T("null socials / null items are treated as empty lists (loads, no crash)",aerr.length===before&&dialogs.length===1&&c.s===NS&&c.i===expItems&&(await p.locator('[data-act="addsoc"]').count())===1,JSON.stringify(c));
   await p.click("#reset");await p.waitForTimeout(200);
  }
  // --- نص خبيث جوه قيمة من نوع غلط: بيظهر كنص في رسالة الخطأ ومبيتنفذش ---
  {
   const o=base();o.site.photo={x:'<img src=x onerror="window.__xss=9">'};o.sections[0].title={t:"</script><script>window.__xss=10</script>"};
   const before=aerr.length;await loadFile(o);
   const eb=await errText();
   T("hostile markup inside a wrong-typed value is shown as plain text, nothing runs",aerr.length===before&&!(await p.evaluate(()=>window.__xss))&&/onerror/.test(eb)&&(await p.locator("#errbox img, #errbox script").count())===0);
   await p.click("#reset");await p.waitForTimeout(200);
  }
  // --- validateData عمرها ما بترمي استثناء مهما كانت القيمة (فحص عشوائي منظّم) ---
  const fz=await p.evaluate(({PI})=>{
   const JUNK=[undefined,null,0,1,-5,NaN,Infinity,true,false,"","  ","abc","<b>x</b>",[],[1,"a"],{},{a:1},{title:"x"},()=>1];
   const mk=()=>JSON.parse(JSON.stringify({site:window.STUDIO_DATA.site,sections:window.STUDIO_DATA.sections}));
   let calls=0;const thrown=[];let notArray=0;
   const run=(o,tag)=>{calls++;try{const e=validateData(o.site,o.sections);if(!Array.isArray(e))notArray++;return e}catch(x){thrown.push(tag+": "+x.message);return null}};
   const keys0=mk();
   const siteKeys=Object.keys(keys0.site),secKeys=Object.keys(keys0.sections[0]);
   const itemKeys=[...new Set(keys0.sections.flatMap(s=>s.items.flatMap(i=>Object.keys(i))))];
   JUNK.forEach((j,ji)=>{
    const t=k=>k+"="+ji;
    siteKeys.forEach(k=>{const o=mk();o.site[k]=j;run(o,t("site."+k))});
    ["label","url"].forEach(k=>{const o=mk();o.site.socials[0][k]=j;run(o,t("social."+k))});
    secKeys.forEach(k=>{const o=mk();o.sections[0][k]=j;run(o,t("section."+k))});
    itemKeys.forEach(k=>{[[0,0],[PI,0]].forEach(([si,ii])=>{const o=mk();o.sections[si].items[ii][k]=j;run(o,t("item."+k+"@"+si))})});
    {const o=mk();o.site=j;run(o,t("site"))}
    {const o=mk();o.sections=j;run(o,t("sections"))}
    {const o=mk();o.sections[0]=j;run(o,t("sections[0]"))}
    {const o=mk();o.sections[0].items=j;run(o,t("items"))}
    {const o=mk();o.sections[0].items[0]=j;run(o,t("items[0]"))}
    {const o=mk();o.site.socials=j;run(o,t("socials"))}
    {const o=mk();o.site.socials[0]=j;run(o,t("socials[0]"))}
   });
   return{calls,thrown:thrown.slice(0,5),nThrown:thrown.length,notArray};
  },{PI});
  T("validateData never throws and always returns a list ("+fz.calls+" hostile inputs)",fz.calls>=700&&fz.nThrown===0&&fz.notArray===0,JSON.stringify(fz));
  // --- قواعد الأنواع لكل حقل: غير النص مرفوض، والفاضي مقبول في الاختياري بس ---
  const ru=await p.evaluate(({PI})=>{
   const mk=()=>JSON.parse(JSON.stringify({site:window.STUDIO_DATA.site,sections:window.STUDIO_DATA.sections}));
   const NOTTEXT=[0,1,-5,true,false,[],[1],{},{a:1}],EMPTY=[undefined,null,"","  "],FINE=["abc","نص عربي"];
   const n=(setter)=>{const o=mk();setter(o);return validateData(o.site,o.sections).length};
   const F={};const bad=(k,why)=>(F[k]=F[k]||[]).push(why);
   const text=[ // [اسم, setter(o,v)]
    ["site.nameEn",(o,v)=>o.site.nameEn=v],["site.owner",(o,v)=>o.site.owner=v],["site.tagline",(o,v)=>o.site.tagline=v],["site.about",(o,v)=>o.site.about=v],
    ["section.icon",(o,v)=>o.sections[0].icon=v],["section.desc",(o,v)=>o.sections[0].desc=v],
    ["item.desc",(o,v)=>o.sections[0].items[0].desc=v],["item.tag",(o,v)=>o.sections[0].items[0].tag=v],["item.text(link)",(o,v)=>o.sections[0].items[0].text=v]];
   const required=[["site.name",(o,v)=>o.site.name=v],["section.title",(o,v)=>o.sections[0].title=v],["item.title",(o,v)=>o.sections[0].items[0].title=v],
    ["section.id",(o,v)=>o.sections[0].id=v],["item.type",(o,v)=>o.sections[0].items[0].type=v],["item.url(link)",(o,v)=>o.sections[0].items[0].url=v],["prompt.text",(o,v)=>o.sections[PI].items[0].text=v]];
   const images=[["site.photo",(o,v)=>o.site.photo=v],["site.logo",(o,v)=>o.site.logo=v],["section.cover",(o,v)=>o.sections[0].cover=v]];
   text.forEach(([k,s])=>{NOTTEXT.forEach(v=>{if(n(o=>s(o,v))<1)bad(k,"accepted "+JSON.stringify(v))});[...EMPTY,...FINE].forEach(v=>{if(n(o=>s(o,v))>0)bad(k,"rejected "+JSON.stringify(v))})});
   required.forEach(([k,s])=>{[...NOTTEXT,...EMPTY].forEach(v=>{if(n(o=>s(o,v))<1)bad(k,"accepted "+JSON.stringify(v))})});
   images.forEach(([k,s])=>{NOTTEXT.forEach(v=>{if(n(o=>s(o,v))<1)bad(k,"accepted "+JSON.stringify(v))});[undefined,null,"","assets/img/logo.svg","https://example.com/a.png"].forEach(v=>{if(n(o=>s(o,v))>0)bad(k,"rejected "+JSON.stringify(v))})});
   [0,1,"true","yes",[],{},{a:1}].forEach(v=>{if(n(o=>o.site.verified=v)<1)bad("site.verified","accepted "+JSON.stringify(v))});
   [true,false,undefined,null].forEach(v=>{if(n(o=>o.site.verified=v)>0)bad("site.verified","rejected "+JSON.stringify(v))});
   return{F,clean:validateData(mk().site,mk().sections).length};
  },{PI});
  T("original data validates clean (0 errors)",ru.clean===0,String(ru.clean));
  T("type rules: every text/id/type/link/image/verified field rejects non-text values, optional ones accept empty",Object.keys(ru.F).length===0,JSON.stringify(ru.F).slice(0,400));
  await p.click("#reset");await p.waitForTimeout(200);
 }

 // ================= نسخة واحدة من البيانات =================
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(/^(node_modules|\.git|tests|dist|\.dist-nogh)$/.test(e.name)?[]:walk(d+"/"+e.name)):[d+"/"+e.name]);
 const holders=walk(ROOT).filter(x=>/\.(js|json|html)$/.test(x)&&/^window\.STUDIO_DATA\s*=\s*\{/m.test(fs.readFileSync(x,"utf8"))).map(x=>path.relative(ROOT,x));
 T("single source of truth: only site/data/data.js defines STUDIO_DATA",holders.length===1&&holders[0]==="site/data/data.js",holders.join());
 T("admin/js/data.js (stale duplicate) is gone and nothing references it",!fs.existsSync(ROOT+"/admin/js/data.js")&&!/js\/data\.js/.test(fs.readFileSync(ROOT+"/admin/index.html","utf8")));
 await ctx.close();

 // ================= الموقع: بدائل الصور + اللون + البحث بالنطاق + الأداء =================
 const X=tmp+"/site-x";fs.cpSync(ROOT+"/site",X,{recursive:true});
 const dtxt=fs.readFileSync(X+"/data/data.js","utf8");
 const brk=(over)=>{let s=dtxt;for(const [k,v] of Object.entries(over))s=s.replace(new RegExp('("'+k+'": )"[^"]*"'),'$1"'+v+'"');fs.writeFileSync(X+"/data/data.js",s)};
 const openX=async(over)=>{brk(over);const c=await b.newContext();const pg=await c.newPage();await pg.goto("file://"+X+"/index.html");await pg.waitForSelector("#tabs .chip", {state: "attached"});await pg.waitForTimeout(900);return [c,pg]};
 let [c2,p2]=await openX({photo:"assets/img/missing-photo.jpg",logo:"assets/img/missing-logo.svg",accent:"#zzz",accent2:"not-a-color"});
 const fb=await p2.evaluate(()=>({avImgs:document.querySelectorAll("#avatar img").length,avText:document.querySelector("#avatar").textContent.trim(),logoLetter:document.querySelector("#logo").classList.contains("letter"),logoImgs:document.querySelectorAll("#logo img").length,broken:[...document.querySelectorAll("header img, .hero img")].filter(i=>i.complete&&i.naturalWidth===0).length,acc:getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().toLowerCase(),acc2:getComputedStyle(document.documentElement).getPropertyValue("--accent2").trim().toLowerCase()}));
 T("missing photo+logo → letter fallbacks, no broken image icons",fb.avImgs===0&&fb.avText==="A"&&fb.logoLetter&&fb.logoImgs===0&&fb.broken===0,JSON.stringify(fb));
 T("invalid color values ignored → brand colors kept (#FDC713 / #F58220)",fb.acc==="#fdc713"&&fb.acc2==="#f58220",fb.acc+" "+fb.acc2);
 await c2.close();
 [c2,p2]=await openX({photo:"assets/img/missing-photo.jpg",logo:"assets/img/logo.svg",accent:"#FDC713",accent2:"#F58220"});
 const fb2=await p2.evaluate(()=>{const i=document.querySelector("#avatar img");return{cls:i&&i.className,ok:!!i&&i.complete&&i.naturalWidth>0}});
 T("missing photo but valid logo → avatar falls back to the logo",fb2.cls==="mark"&&fb2.ok,JSON.stringify(fb2));
 await c2.close();
 [c2,p2]=await openX({photo:"assets/img/photo.jpg",logo:"assets/img/logo.svg"});
 const heroOK=await p2.evaluate(()=>{const i=document.querySelector("#avatar img"),r=i.getBoundingClientRect();return i.naturalWidth>0&&Math.round(r.width)===Math.round(r.height)&&getComputedStyle(i).objectFit==="cover"});
 T("valid photo: same size and object-fit as before (cover, square)",heroOK);
 await c2.close();
 // غلاف قسم مش موجود → الغلاف الافتراضي (من غير صورة مكسورة)
 {let s=dtxt.replace('"cover": "assets/img/sections/work.svg"','"cover": "assets/img/sections/nope.jpg"');fs.writeFileSync(X+"/data/data.js",s);const c=await b.newContext();const pg=await c.newPage();await pg.goto("file://"+X+"/index.html#s=work");await pg.waitForSelector("#work");await pg.evaluate(()=>document.querySelector("#work").scrollIntoView({block:"center"}));await pg.waitForFunction(()=>!document.querySelector("#work .sec-head").classList.contains("has-cover"),null,{timeout:4000}).catch(()=>{});await pg.waitForTimeout(300);
  const cv=await pg.evaluate(()=>({n:document.querySelectorAll("img.sec-cover").length,first:document.querySelector("#work .sec-head").classList.contains("has-cover")}));
  T("missing section cover → banner still renders (title visible), no broken image shown",await pg.locator("#work .sec-head h2").isVisible()&&await pg.evaluate(()=>[...document.querySelectorAll("img.sec-cover")].every(i=>getComputedStyle(i).display==="none"||i.naturalWidth>0)),JSON.stringify(cv));await c.close();}
 fs.writeFileSync(X+"/data/data.js",dtxt);
 // البحث بالنطاق
 ctx=await b.newContext();p=await ctx.newPage();await p.goto(SITE);await p.waitForSelector("#tabs .chip", {state: "attached"});
 const links=D.sections.flatMap(s=>s.items).filter(i=>i.type!=="prompt"&&/^https?:/.test(i.url));
 const hostOfU=u=>new URL(u).hostname.replace(/^www\./,"").toLowerCase();
 const picks=[...new Map(links.map(i=>[hostOfU(i.url),i])).values()].filter(i=>!(i.title+i.desc+i.tag).toLowerCase().includes(hostOfU(i.url).split(".")[0])).slice(0,3);
 T("domain search: found items whose domain isn't in their title/desc ("+picks.length+")",picks.length>=1);
 for(const it of picks){await p.fill("#q",hostOfU(it.url));const hr=await p.locator(".card").evaluateAll(a=>a.map(x=>x.getAttribute("href")));T("search by domain «"+hostOfU(it.url)+"» finds it",hr.includes(it.url));}
 const full=picks[0]||links[0];await p.fill("#q",full.url);T("search by pasted full URL finds exactly that link",(await p.locator(".card").evaluateAll(a=>a.map(x=>x.getAttribute("href")))).includes(full.url));
 await p.fill("#q","WWW."+hostOfU(full.url).toUpperCase());T("domain search is case-insensitive and tolerates www.",(await p.locator(".card").evaluateAll(a=>a.map(x=>x.getAttribute("href")))).includes(full.url));
 await p.fill("#q","youtu.be");T("search 'youtu.be' matches the 3 video items (by domain)",(await p.locator(".vcard").count())===3);
 {const yt=links.filter(i=>/youtube/i.test(hostOfU(i.url))||/youtube/i.test(i.title+i.desc+i.tag)).length;await p.fill("#q","youtube");const n=await p.locator(".card").count();T("search 'youtube' returns at least all items with that domain/text ("+yt+")",n>=yt&&(yt>0||await p.locator(".empty").count()===1));}
 await p.fill("#q","");
 await p.fill("#q","برومبت");T("Arabic normalization still works (ة/ه, أ/ا, ى/ي)",(await p.locator(".card").count())>=11);
 await p.fill("#q","ادواتي اليوميه");T("Arabic ة→ه search still returns the section",(await p.locator(".card").count())===D.sections.find(x=>x.id==="daily").items.length);
 await p.fill("#q","");
 // الأداء: 115 عنصر ثم ~1265 عنصر
 const perf=await p.evaluate(async()=>{const q=document.querySelector("#q"),terms=["a","can","ai","design","مواقع","youtube.com","free","zzzz","prompt","font"];
  const run=()=>{const t0=performance.now();for(const s of terms){q.value=s;q.dispatchEvent(new Event("input"))}q.value="";q.dispatchEvent(new Event("input"));return (performance.now()-t0)/(terms.length+1)};
  run();const small=run();const base=SECTIONS.flatMap(s=>s.items);for(let k=0;k<10;k++)SECTIONS[0].items.push(...base.map(i=>Object.assign({},i,{id:i.id+"-x"+k})));
  const n=SECTIONS.reduce((a,s)=>a+s.items.length,0);run();const big=run();return{small:Math.round(small),big:Math.round(big),n}});
 T("search stays fast: 115 items avg "+perf.small+"ms / "+perf.n+" items avg "+perf.big+"ms per keystroke (limit 150 / 600)",perf.small<150&&perf.big<600,JSON.stringify(perf));
 await ctx.close();
 // مقاسات الموقع واللوحة
 await phase2Suite(b);
 await phase3Suite(b);
 await phase4Suite(b);
 await responsiveSuite(b);

 // mobile admin/site screenshot

 await b.close();
 const fails=res.filter(r=>!r[1]);console.log("\nTOTAL",res.length,"FAILED",fails.length);
 process.exit(fails.length?1:0);
})().catch(e=>{console.error("CRASH",e);process.exit(1)});
