/* ترحيل آمن: فصل «السعر» عن «التصنيف» في data.js.
   - عنصر tag بتاعه (مجاني / مجاني محدود / مدفوع)  ←  price = tag
   - أي tag تاني (صور، منتجات، أعمال، يوتيوب...)     ←  category = tag
   حقل tag القديم بيفضل زي ما هو (مفيش بيانات بتتشال) والموقع واللوحة بيقروا price/category الأول.
   الأمر آمن للتكرار: العناصر اللي فيها price أو category بالفعل مبتتلمسش.
   التشغيل: node tools/migrate-price-category.js [--dry] [--file مسار/data.js] */
const fs = require("fs"), path = require("path");
const fi = process.argv.indexOf("--file");
const file = fi > -1 ? path.resolve(process.argv[fi + 1]) : path.join(__dirname, "..", "site", "data", "data.js");
const raw = fs.readFileSync(file, "utf8");
const head = (raw.match(/^\/\*[\s\S]*?\*\/\s*/) || [""])[0];
const D = JSON.parse(raw.slice(head.length).replace(/^window\.STUDIO_DATA\s*=\s*/, "").replace(/;\s*$/, ""));
const PRICES = ["مجاني", "مجاني محدود", "مدفوع"];
let nPrice = 0, nCat = 0, nSkip = 0;
const NEAR = /مجان|مدفوع|free|paid/i;   // كلمات شبه كلمات السعر لكن مش مطابقة تمامًا: بنحذّر ومبنخمّنش
for (const s of D.sections) for (const it of s.items || []) {
  const tag = typeof it.tag === "string" ? it.tag.trim() : "";
  if (!tag || "price" in it || "category" in it) { nSkip++; continue; }
  if (PRICES.includes(tag)) { it.price = tag; nPrice++; }
  else { it.category = tag; nCat++; if (NEAR.test(tag)) console.warn(`⚠ «${it.title}»: الـ tag «${tag}» شبه كلمة سعر لكنه مش مطابق (مجاني / مجاني محدود / مدفوع) — اتحوّل لتصنيف. راجعه.`); }
}
const out = (head || "/* data.js — بيانات الموقع بصيغة JSON صرفة (من غير كود). بتتعدل من لوحة الإدارة. */\n") + "window.STUDIO_DATA = " +
  JSON.stringify(D, null, 2).split("\u2028").join("\\u2028").split("\u2029").join("\\u2029") + ";\n";
console.log(`price: ${nPrice} | category: ${nCat} | اتخطى (من غير tag أو متحوّل بالفعل): ${nSkip}`);
if (!process.argv.includes("--dry")) fs.writeFileSync(file, out);
