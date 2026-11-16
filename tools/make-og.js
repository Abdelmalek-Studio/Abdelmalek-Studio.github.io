/* بيعمل صورة المعاينة (Open Graph) 1200×630 → site/assets/img/og-image.jpg
   من لوجو واسم وسطر تعريفي الموقع (data.js). التشغيل: node tools/make-og.js  (محتاج playwright) */
const fs = require("fs"), path = require("path");
const {chromium} = require("playwright");
const root = path.join(__dirname, "..", "site");
const txt = fs.readFileSync(path.join(root, "data/data.js"), "utf8");
const S = JSON.parse(txt.replace(/^\/\*[\s\S]*?\*\/\s*/, "").replace(/^window\.STUDIO_DATA\s*=\s*/, "").replace(/;\s*$/, "")).site;
const esc = s => String(s || "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const font = n => fs.readFileSync(path.join(root, "assets/fonts", n + ".woff2"), "base64");
const logo = fs.readFileSync(path.join(root, S.logo || "assets/img/logo.svg"), "base64");
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Cairo;font-weight:200 1000;src:url(data:font/woff2;base64,${font("cairo-arabic")})}
@font-face{font-family:Cairo;font-weight:200 1000;src:url(data:font/woff2;base64,${font("cairo-latin")});unicode-range:U+0000-00FF}
*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;background:radial-gradient(900px 500px at 85% 0%,${S.accent || "#FDC713"}33,transparent 60%),radial-gradient(700px 420px at 0% 100%,${S.accent2 || "#F58220"}2e,transparent 60%),#0c0c10;color:#f4f4f6;font-family:Cairo,sans-serif;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:22px;padding:60px;direction:rtl}
img{width:220px;height:auto}h1{font-size:82px;font-weight:800;line-height:1.1;letter-spacing:-.01em}h1 b{background:linear-gradient(90deg,${S.accent || "#FDC713"},${S.accent2 || "#F58220"});-webkit-background-clip:text;color:transparent}
p{font-size:36px;color:#b9b9c4;font-weight:600;max-width:980px;line-height:1.5}</style>
<img src="data:image/svg+xml;base64,${logo}" alt=""><h1>${esc((S.nameEn || S.name).replace(/ Studio$/, ""))} <b>Studio</b></h1><p>${esc(S.tagline || S.name)}</p>`;
(async () => {
  const b = await chromium.launch(), p = await b.newPage({viewport: {width: 1200, height: 630}});
  await p.setContent(html); await p.waitForTimeout(400);
  await p.screenshot({path: path.join(root, "assets/img/og-image.jpg"), type: "jpeg", quality: 86});
  await b.close(); console.log("og-image.jpg اتعمل");
})();
