// بيقيس حدود كل رسمة غلاف (bbox) ويكتبها في tools/covers-bbox.json عشان make-covers.py يوحّد المقاس والمكان.
// الاستخدام: (1) امسح covers-bbox.json  (2) python3 tools/make-covers.py <مجلد مؤقت>  (3) node tools/measure-covers.js <نفس المجلد>  (4) python3 tools/make-covers.py site/assets/img/sections
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
(async()=>{
  const dir=process.argv[2],b=await chromium.launch(),p=await b.newPage(),out={};
  for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.svg'))){
    await p.goto('file://'+path.resolve(dir,f));
    const r=await p.evaluate(()=>{const g=document.getElementById('art').getBBox();return [g.x,g.y,g.width,g.height].map(v=>Math.round(v*10)/10)});
    out[f.replace('.svg','')]=r;
  }
  fs.writeFileSync(path.join(__dirname,'covers-bbox.json'),JSON.stringify(out,null,1));console.log(out);await b.close();
})();
