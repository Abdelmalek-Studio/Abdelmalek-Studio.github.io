/* أدوات مشتركة + أنواع العناصر + الحالة الحالية اللي بتتعدل (siteData / sectionsData) */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const TYPES = {link:"موقع / رابط", prompt:"Prompt", video:"فيديو", file:"ملف / درايف"};
let siteData, sectionsData, updatesData = [], rootExtra = {}, baseline = null;   // updatesData = «آخر الإضافات»، rootExtra = أي حقول تانية في الملف بنحافظ عليها، baseline = آخر نسخة اتحمّلت/اتنزّلت (للمعاينة)
let isDirty = false;
function status(t){ $("#status").textContent = t; }
const dirty = () => { isDirty = true; status("فيه تعديلات لسه متنزلتش"); };
window.addEventListener("beforeunload", e => { if (isDirty) { e.preventDefault(); e.returnValue = ""; } });

/* معرفات: أقسام وعناصر (حروف إنجليزي / أرقام / - / _) */
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
function randHex(n){
  const a = new Uint8Array(Math.ceil(n/2));
  (window.crypto || window.msCrypto).getRandomValues(a);
  return Array.from(a, x => x.toString(16).padStart(2,"0")).join("").slice(0,n);
}
function newItemId(){
  const used = new Set(); (sectionsData||[]).forEach(s => (s.items||[]).forEach(i => used.add(i.id)));
  let id; do { id = "itm-" + randHex(8); } while (used.has(id));
  return id;
}
function newSectionId(){
  const used = new Set((sectionsData||[]).map(s => s.id));
  let id; do { id = "sec-" + randHex(6); } while (used.has(id));
  return id;
}
function downloadText(name, text, mime){
  const url = URL.createObjectURL(new Blob([text], {type: mime}));
  const a = document.createElement("a"); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
// JSON آمن للحط جوه ملف .js (بيهرّب فاصلي السطر الخاصين)
const safeJSON = o => JSON.stringify(o, null, 2).split(String.fromCharCode(0x2028)).join("\\u2028").split(String.fromCharCode(0x2029)).join("\\u2029");

/* السعر والتصنيف (حقلين منفصلين) — نفس قواعد الموقع (site/assets/js/utils.js). العناصر القديمة (tag بس) بتتقرا كسعر أو تصنيف حسب الكلمة */
const PRICES = ["مجاني", "مجاني محدود", "مدفوع"];
const priceOf = it => { const v = String((Object.prototype.hasOwnProperty.call(it, "price") ? it.price : it.tag) ?? "").trim(); return PRICES.includes(v) ? v : ""; };
const categoryOf = it => String((Object.prototype.hasOwnProperty.call(it, "category") ? it.category : (PRICES.includes(String(it.tag ?? "").trim()) ? "" : it.tag)) ?? "").trim();
// ترحيل العناصر القديمة: بيكتب price/category صراحةً من الـ tag (والـ tag نفسه بيفضل زي ما هو — مفيش بيانات بتتشال)
function migrateLegacyTags(sections){
  let n = 0;
  (sections || []).forEach(s => ((s && s.items) || []).forEach(it => {
    if (!it || typeof it !== "object" || typeof it.tag !== "string" || !it.tag.trim() || "price" in it || "category" in it) return;
    if (PRICES.includes(it.tag.trim())) it.price = it.tag.trim(); else it.category = it.tag.trim();
    n++;
  }));
  return n;
}
const today = () => { const d = new Date(), p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; };
// توحيد النص العربي/الإنجليزي للبحث والمقارنة (تشكيل، أ/إ/آ، ة/ه، ى/ي)
const anorm = s => String(s ?? "").toLowerCase().replace(/[\u064B-\u065F\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
function newUpdateId(){ const used = new Set((updatesData||[]).map(u => u.id)); let id; do { id = "upd-" + randHex(6); } while (used.has(id)); return id; }
// toast صغير غير مانع (بدل alert في الرسائل المعلوماتية)
function toast(msg, kind){
  let box = document.getElementById("toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
  const t = document.createElement("div"); t.className = "toast " + (kind || ""); t.textContent = msg; box.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}
