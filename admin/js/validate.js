/* التحقق من البيانات (قبل التصدير) + قراءة الملفات بدون تنفيذ أي كود.
   كل خطأ: {msg, sec, item} — sec/item أرقام (من 0) لمكان الخطأ، أو undefined للملف الشخصي. */
const isStr = v => typeof v === "string";
const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
// "فاضي" = مش موجود / null / نص فاضي (أو مسافات). الرقم والـ Object والـ Array مش فاضي — دول نوع غلط.
const isBlank = v => v === undefined || v === null || (isStr(v) && !v.trim());
// وصف نوع القيمة + معاينة قصيرة — للرسائل بس (الرسائل بتتعرض كنص عادي عن طريق esc، ومفيش تنفيذ لأي حاجة)
const typeName = v => v === undefined ? "مش موجودة" : v === null ? "فاضية (null)" : Array.isArray(v) ? "قائمة (Array)" : typeof v === "object" ? "كائن (Object)"
  : typeof v === "number" ? "رقم" : typeof v === "boolean" ? "true/false" : typeof v === "string" ? "نص" : typeof v;
const preview = v => {
  let s; try { s = JSON.stringify(v); } catch (e) { s = undefined; }
  if (typeof s !== "string") { try { s = String(v); } catch (e) { s = "؟"; } }
  return s.length > 40 ? s.slice(0, 40) + "…" : s;
};
const wrongType = (label, v) => `${label} لازم يكون نص، لكن القيمة الحالية ${typeName(v)}: ${preview(v)}`;
/* ---- قواعد موحّدة للينكات والمسارات والألوان (كل مكان بيستخدمها بنفس الشروط ونفس رسائل الخطأ) ---- */
const SAFE_SCHEMES = /^(https?:)$/i;
const BAD_SCHEMES = /^\s*(javascript|data|vbscript|file|blob|about|chrome|intent):/i;   // بروتوكولات غير آمنة بنرفضها بالاسم
// لينك http(s) سليم: من غير مسافات أو رموز تحكم، من غير يوزر/باسورد جوه اللينك، ونطاق فيه نقطة (أو localhost)
const isHttpUrl = u => {
  if (!isStr(u)) return false;
  const s = u.trim();
  if (!s || /[\s\u0000-\u001f\u007f\\]/.test(s)) return false;
  try {
    const x = new URL(s);
    return SAFE_SCHEMES.test(x.protocol) && !x.username && !x.password && (x.hostname.includes(".") || x.hostname === "localhost");
  } catch { return false; }
};
// مسار ملف جوه الموقع (زي ملف الـ CV): assets/...
const isLocalAsset = u => isStr(u) && /^assets\/[\w\-./%]+$/.test(u.trim()) && !u.includes("..");
const isSocialUrl = u => isHttpUrl(u) || (isStr(u) && /^mailto:[^\s@]+@[^\s@]+$/i.test(u.trim()));
// كود لون: #RGB أو #RRGGBB (مثال #FDC713)
const isHexColor = c => isStr(c) && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());
// مسار صورة محلي (نسبي من مجلد site): من غير .. ولا / في الأول ولا بروتوكول، وبامتداد صورة
const IMG_EXT = /\.(jpe?g|png|webp|gif|svg|avif|ico)$/i;
const isLocalImage = p => isStr(p) && /^[\w\-./%]+$/.test(p.trim()) && !p.includes("..") && !p.trim().startsWith("/") && IMG_EXT.test(p.trim());
// مسار صورة (غلاف / بروفايل / لوجو): مش موجود / null / فاضي مقبول، وإلا لازم نص = مسار محلي سليم أو لينك https/http سليم (رقم/Object/Array مرفوض)
const isImagePath = p => p === undefined || p === null || (isStr(p) && (!p.trim() || isLocalImage(p) || isHttpUrl(p)));

/* رسالة خطأ موحّدة للينك (نص فاضي لو سليم). opts.local = يقبل assets/…، opts.mail = يقبل mailto: */
function linkProblem(u, opts = {}){
  if (isBlank(u)) return "اللينك فاضي";
  if (!isStr(u)) return wrongType("اللينك", u);
  if (BAD_SCHEMES.test(u)) return `اللينك «${u}» غير آمن (مسموح https:// أو http:// بس)`;
  if (isHttpUrl(u) || (opts.local && isLocalAsset(u)) || (opts.mail && isSocialUrl(u))) return "";
  return `اللينك «${u}» مش صحيح (لازم يبدأ بـ https://)`;
}
const IMG_HINT = "استخدم مسار زي assets/img/sections/x.jpg (امتداد صورة، من غير .. أو /) أو لينك https";

/* التحقق الشامل. القواعد:
   - أي قيمة مستوردة مهما كان نوعها (رقم / Object / Array / null / Boolean) بتتفحص بأمان — ومفيش استدعاء .trim() إلا بعد التأكد إنها نص.
   - الحقل المطلوب: لازم نص مش فاضي.  الحقل الاختياري: مش موجود / null / "" مقبولين، لكن رقم أو Object أو Array مرفوضين.
   - validateData عمرها ما بترمي استثناء: أي مشكلة بترجع كخطأ مكتوب (وبالتالي التنزيل بيتوقف بدل ما اللوحة تقف). */
// تاريخ حقيقي بصيغة YYYY-MM-DD (بيرفض 2026-02-30 و2026-13-01)
const realDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && (t => !isNaN(t) && new Date(t).toISOString().slice(0, 10) === d)(Date.parse(d + "T00:00:00Z"));
function validateData(site, sections, updates){
  const errs = [];
  const add = (msg, sec, item, upd) => errs.push({msg, sec, item, upd});
  try { runChecks(site, sections, add); if (updates !== undefined) checkUpdates(updates, sections, add); }
  catch (e) { add("حصل خطأ غير متوقع أثناء فحص البيانات، فالتنزيل اتوقف حفاظًا على الموقع (" + (e && e.message ? e.message : String(e)) + ")."); }
  return errs;
}

function runChecks(site, sections, add){
  const A = (where, msg, sec, item) => add(`${where}: ${msg}.`, sec, item);
  // حقل نصي: req=true → لازم نص مش فاضي | req=false → اختياري. نوع غير النص = خطأ في الحالتين
  const txt = (v, req, label, emptyMsg, where, sec, item) => {
    if (isBlank(v)) { if (req) A(where, emptyMsg, sec, item); return; }
    if (!isStr(v)) A(where, wrongType(label, v), sec, item);
  };
  // مسار صورة (اختياري): مش موجود / null / فاضي مقبول، وإلا لازم نص سليم
  const imgProblem = (v, label) => {
    if (v === undefined || v === null) return "";
    if (!isStr(v)) return wrongType(label, v);
    return isImagePath(v) ? "" : `${label} «${v}» غير صالح (${IMG_HINT})`;
  };
  const titleOf = v => isObj(v) && isStr(v.title) && v.title.trim() ? ` «${v.title.trim()}»` : "";
  const TYPE_LIST = Object.keys(TYPES).join(" / ");

  /* ---- الملف الشخصي ---- */
  const P = "الملف الشخصي";
  if (!isObj(site)) { A(P, "البيانات مفقودة أو شكلها غلط"); }
  else {
    txt(site.name, true, "الاسم بالعربي", "الاسم بالعربي فاضي", P);
    txt(site.nameEn, false, "الاسم بالإنجليزي", "", P);
    txt(site.owner, false, "اسم صاحب الموقع (owner)", "", P);
    txt(site.tagline, false, "السطر التعريفي (tagline)", "", P);
    txt(site.about, false, "النبذة (about)", "", P);
    [["photo", "مسار الصورة الشخصية"], ["logo", "مسار اللوجو"]].forEach(([k, label]) => {
      const m = imgProblem(site[k], label); if (m) A(P, m);
    });
    [["accent", "اللون الأساسي"], ["accent2", "اللون التاني"]].forEach(([k, label]) => {
      const v = site[k];
      if (v === undefined || v === null) return;
      if (!isStr(v)) A(P, `${label} «${preview(v)}» مش كود لون صحيح (لازم نص بصيغة زي #FDC713)`);
      else if (v.trim() && !isHexColor(v)) A(P, `${label} «${v}» مش كود لون صحيح (لازم بصيغة زي #FDC713)`);
    });
    if (site.verified !== undefined && site.verified !== null && typeof site.verified !== "boolean")
      A(P, `علامة التوثيق (verified) لازم تكون true أو false، لكن القيمة الحالية ${typeName(site.verified)}: ${preview(site.verified)}`);
    if (site.visitors !== undefined && site.visitors !== null && typeof site.visitors !== "boolean")
      A(P, `إعداد عدّاد الزوار (visitors) لازم يكون true أو false، لكن القيمة الحالية ${typeName(site.visitors)}: ${preview(site.visitors)}`);
    if (!isBlank(site.reportEmail) && !(isStr(site.reportEmail) && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(site.reportEmail.trim())))
      A(P, `إيميل استقبال البلاغات «${preview(site.reportEmail)}» مش صحيح (مثال: name@example.com) — أو سيبه فاضي`);
    if (site.socials !== undefined && site.socials !== null && !Array.isArray(site.socials)) A(P, "أزرار التواصل (socials) لازم تكون قائمة");
    else (site.socials || []).forEach((s, i) => {
      const w = `${P} — زرار التواصل رقم ${i+1}${isObj(s) && isStr(s.label) && s.label.trim() ? " «" + s.label.trim() + "»" : ""}`;
      if (!isObj(s)) { A(w, "شكله غلط (لازم يكون فيه اسم ولينك)"); return; }
      txt(s.label, true, "الاسم", "الاسم فاضي", w);
      const lp = linkProblem(s.url, {mail: true}); if (lp) A(w, lp);
    });
  }

  /* ---- الأقسام والعناصر ---- */
  if (!Array.isArray(sections)) { A("الأقسام", "قائمة الأقسام مفقودة أو شكلها غلط"); return; }
  const secIds = new Map(), itemIds = new Map();
  sections.forEach((s, si) => {
    if (!isObj(s)) { A(`القسم رقم ${si+1}`, "شكله غلط (لازم يكون كائن فيه اسم وعناصر)", si); return; }
    const where = `القسم رقم ${si+1}` + titleOf(s);
    txt(s.title, true, "اسم القسم", "اسم القسم فاضي", where, si);
    if (isBlank(s.id)) A(where, "معرّف القسم (ID) فاضي", si);
    else if (!isStr(s.id)) A(where, wrongType("معرّف القسم (ID)", s.id), si);
    else if (!ID_RE.test(s.id)) A(where, `معرّف القسم «${s.id}» لازم يكون حروف إنجليزي أو أرقام أو - أو _ بدون مسافات`, si);
    else if (secIds.has(s.id)) A(where, `معرّف القسم «${s.id}» مكرر — اتستخدم في القسم رقم ${secIds.get(s.id)+1}`, si);
    else secIds.set(s.id, si);
    txt(s.icon, false, "الرمز (icon)", "", where, si);
    txt(s.desc, false, "وصف القسم", "", where, si);
    const cm = imgProblem(s.cover, "مسار صورة الغلاف"); if (cm) A(where, cm, si);
    if (s.categories !== undefined) {   // تصنيفات القسم (اختيارية): قايمة نصوص مش فاضية ولا مكررة
      if (!Array.isArray(s.categories)) A(where, "تصنيفات القسم لازم تكون قائمة", si);
      else { const seen = new Set(); s.categories.forEach(c => { if (!isStr(c) || !c.trim()) A(where, "فيه تصنيف فاضي أو شكله غلط في تصنيفات القسم", si); else if (c.trim().length > 40) A(where, `التصنيف «${c.trim().slice(0, 20)}…» أطول من 40 حرف`, si); else if (seen.has(c.trim())) A(where, `التصنيف «${c.trim()}» مكرر في القسم`, si); else seen.add(c.trim()); }); }
    }

    if (s.items !== undefined && s.items !== null && !Array.isArray(s.items)) { A(where, "عناصر القسم لازم تكون قائمة", si); return; }
    (s.items || []).forEach((it, ii) => {
      const w0 = `${where} ← العنصر رقم ${ii+1}`;
      if (!isObj(it)) { A(w0, "شكله غلط (لازم يكون كائن فيه اسم ونوع ولينك)", si, ii); return; }
      const w = w0 + titleOf(it);
      txt(it.title, true, "اسم العنصر", "اسم العنصر فاضي", w, si, ii);
      // حقول اختيارية جديدة: كلمات مفتاحية (نص أو قائمة نصوص)، الأداة المتوافقة، صورة النتيجة
      if (!isBlank(it.keywords) && !isStr(it.keywords) && !(Array.isArray(it.keywords) && it.keywords.every(isStr)))
        A(w, `الكلمات المفتاحية لازم تكون نص (أو قائمة نصوص)، لكن القيمة الحالية ${typeName(it.keywords)}: ${preview(it.keywords)}`, si, ii);
      if (!isBlank(it.added) && !(isStr(it.added) && realDate(it.added)))
        A(w, `تاريخ الإضافة «${preview(it.added)}» غلط (لازم بصيغة YYYY-MM-DD زي 2026-11-06)`, si, ii);
      txt(it.tool, false, "الأداة المتوافقة", "", w, si, ii);
      { const im = imgProblem(it.image, "صورة النتيجة"); if (im) A(w, im, si, ii); }

      // النوع: لازم نص ومن الأنواع المعروفة بالاسم بالظبط (hasOwn عشان أسماء زي constructor / __proto__ ماتعديش)
      let kind = "";
      if (isBlank(it.type)) A(w, `نوع العنصر ناقص (لازم واحد من: ${TYPE_LIST})`, si, ii);
      else if (!isStr(it.type)) A(w, wrongType("نوع العنصر", it.type), si, ii);
      else if (!hasOwn(TYPES, it.type)) A(w, `نوع العنصر «${it.type}» غير معروف (المسموح: ${TYPE_LIST})`, si, ii);
      else kind = it.type;

      if (kind === "prompt") {
        txt(it.text, true, "نص الـ Prompt", "نص الـ Prompt فاضي", w, si, ii);
        if (it.url !== undefined && it.url !== null && !isStr(it.url)) A(w, wrongType("اللينك", it.url), si, ii);   // مش بيتستخدم في الـ Prompt، بس مينفعش يبقى نوع غريب
      } else if (kind) {
        const lp = linkProblem(it.url, {local: true}); if (lp) A(w, lp, si, ii);
        txt(it.text, false, "حقل النص (text)", "", w, si, ii);
      }
      txt(it.desc, false, "الوصف", "", w, si, ii);
      txt(it.tag, false, "التصنيف القديم (tag)", "", w, si, ii);
      txt(it.category, false, "التصنيف (category)", "", w, si, ii);
      if (!isBlank(it.price)) {
        if (!isStr(it.price)) A(w, wrongType("السعر (price)", it.price), si, ii);
        else if (!PRICES.includes(it.price.trim())) A(w, `السعر «${it.price}» غير مقبول (المسموح: ${PRICES.join(" / ")} — أو سيبه فاضي)`, si, ii);
      }

      if (isBlank(it.id)) A(w, "معرّف العنصر (ID) ناقص", si, ii);
      else if (!isStr(it.id)) A(w, wrongType("معرّف العنصر (ID)", it.id), si, ii);
      else if (!ID_RE.test(it.id)) A(w, `معرّف العنصر «${it.id}» غير صالح`, si, ii);
      else if (itemIds.has(it.id)) A(w, `معرّف العنصر «${it.id}» مكرر`, si, ii);
      else itemIds.set(it.id, [si, ii]);
    });
  });
}

/* «آخر الإضافات والتحديثات»: كل تحديث لازم يكون له تاريخ سليم وعنوان. العناصر المرتبطة لازم تكون موجودة فعلًا */
function checkUpdates(updates, sections, add){
  if (updates === null) return;
  if (!Array.isArray(updates)) { add("آخر الإضافات والتحديثات: القائمة شكلها غلط (لازم تكون قائمة)."); return; }
  const ids = new Set(); (Array.isArray(sections) ? sections : []).forEach(s => ((isObj(s) && Array.isArray(s.items)) ? s.items : []).forEach(i => { if (isObj(i) && isStr(i.id)) ids.add(i.id); }));
  updates.forEach((u, k) => {
    const w = `آخر الإضافات — التحديث رقم ${k+1}${isObj(u) && isStr(u.title) && u.title.trim() ? " «" + u.title.trim() + "»" : ""}`;
    if (!isObj(u)) { add(`${w}: شكله غلط.`, undefined, undefined, k); return; }
    if (!(isStr(u.date) && realDate(u.date))) add(`${w}: التاريخ «${preview(u.date)}» غلط (لازم بصيغة YYYY-MM-DD زي 2026-11-06).`, undefined, undefined, k);
    if (isBlank(u.title)) add(`${w}: العنوان فاضي.`, undefined, undefined, k);
    else if (!isStr(u.title)) add(`${w}: ${wrongType("العنوان", u.title)}.`, undefined, undefined, k);
    if (!isBlank(u.text) && !isStr(u.text)) add(`${w}: ${wrongType("التفاصيل", u.text)}.`, undefined, undefined, k);
    if (u.items !== undefined && u.items !== null) {
      if (!Array.isArray(u.items) || !u.items.every(isStr)) add(`${w}: العناصر المرتبطة لازم تكون قائمة معرّفات.`, undefined, undefined, k);
      else u.items.forEach(id => { if (!ids.has(id)) add(`${w}: العنصر المرتبط «${id}» مش موجود (اتحذف؟) — شيله من التحديث.`, undefined, undefined, k); });
    }
  });
}

/* بيدّي معرّف ثابت للعناصر اللي ملهاش (مش موجود / null / فاضي) من غير ما يلمس أي محتوى تاني. بيرجّع عدد اللي اتضاف.
   معرّف موجود بس نوعه غلط (رقم مثلًا) مبيتغيرش — بيتبلّغ عنه كخطأ عشان ماتضيعش قيمة الملف الأصلي بصمت. */
function ensureItemIds(sections){
  const used = new Set(); let n = 0;
  const each = fn => { if (Array.isArray(sections)) sections.forEach(s => { if (isObj(s) && Array.isArray(s.items)) s.items.forEach(i => { if (isObj(i)) fn(i); }); }); };
  each(i => { if (isStr(i.id) && i.id) used.add(i.id); });
  each(i => {
    if (isBlank(i.id)) {
      let id; do { id = "itm-" + randHex(8); } while (used.has(id));
      used.add(id); i.id = id; n++;
    }
  });
  return n;
}

/* فحص الشكل العام للبيانات (مش المحتوى): لازم site كائن، sections مصفوفة، وكل عنصر كائن. null في socials / items معناها "فاضي" */
function checkShape(site, sections){
  if (!isObj(site)) throw new Error("بيانات الموقع (site) مفقودة أو شكلها غلط.");
  if (!Array.isArray(sections)) throw new Error("قائمة الأقسام (sections) مفقودة أو شكلها غلط.");
  if (site.socials !== undefined && site.socials !== null && !Array.isArray(site.socials)) throw new Error("أزرار التواصل (socials) لازم تكون قائمة.");
  (site.socials || []).forEach((s, i) => { if (!isObj(s)) throw new Error(`زرار التواصل رقم ${i+1} شكله غلط.`); });
  sections.forEach((s, i) => {
    if (!isObj(s)) throw new Error(`القسم رقم ${i+1} شكله غلط.`);
    if (s.items !== undefined && s.items !== null && !Array.isArray(s.items)) throw new Error(`عناصر القسم رقم ${i+1} لازم تكون قائمة.`);
    (s.items || []).forEach((it, j) => { if (!isObj(it)) throw new Error(`القسم رقم ${i+1}، العنصر رقم ${j+1} شكله غلط.`); });
  });
}

/* قراءة ملف بدون تنفيذه. بيقبل:
   1) نسخة احتياطية JSON  {format:"abdelmalek-studio-backup", site, sections}
   2) data.js الجديد:  window.STUDIO_DATA = {...};
   3) data.js القديم:  const SITE = {...}; const SECTIONS = [...];
   كله بـ JSON.parse بس — مفيش تنفيذ كود خالص. */
function parseDataText(text){
  if (typeof text !== "string" || !text.trim()) throw new Error("الملف فاضي.");
  if (text.length > 8 * 1024 * 1024) throw new Error("الملف كبير بشكل مش طبيعي (أكتر من 8 ميجا).");
  text = text.replace(/^﻿/, "");
  let site, sections, kind, updates, extra = {};
  const grab = o => {
    if (isObj(o) && hasOwn(o, "updates") && o.updates !== null) {
      if (!Array.isArray(o.updates)) throw new Error("قايمة «آخر الإضافات» (updates) لازم تكون قائمة.");
      o.updates.forEach((u, k) => { if (!isObj(u)) throw new Error(`التحديث رقم ${k+1} في «آخر الإضافات» شكله غلط.`); });
      updates = o.updates;
    } else updates = undefined;
    extra = {}; if (isObj(o)) Object.keys(o).forEach(k => { if (!["version", "site", "sections", "updates", "format", "exportedAt"].includes(k)) extra[k] = o[k]; }); };   // أي حقول إضافية في الملف بنحافظ عليها
  const t = text.trim();
  if (t[0] === "{") {                                   // JSON صرف (نسخة احتياطية)
    let o; try { o = JSON.parse(t); } catch (e) { throw new Error("الملف مش JSON سليم: " + e.message); }
    if (o && o.format === "abdelmalek-studio-backup") { site = o.site; sections = o.sections; kind = "نسخة احتياطية"; grab(o); }
    else if (o && o.site && o.sections) { site = o.site; sections = o.sections; kind = "بيانات"; grab(o); }
    else throw new Error("الملف مش نسخة احتياطية ولا data.js تبع الموقع.");
  } else {
    const stripped = text.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, "");   // تعليق البداية
    let m = stripped.match(/^window\.STUDIO_DATA\s*=\s*([\s\S]*?)\s*;?\s*$/);
    if (m) {
      let o; try { o = JSON.parse(m[1]); } catch (e) { throw new Error("محتوى data.js مش JSON سليم: " + e.message); }
      site = o && o.site; sections = o && o.sections; kind = "data.js"; grab(o);
    } else {
      m = stripped.match(/^const\s+SITE\s*=\s*([\s\S]*?);\s*const\s+SECTIONS\s*=\s*([\s\S]*?)\s*;?\s*$/);
      if (!m) throw new Error("الملف مش بصيغة data.js المعروفة.");
      try { site = JSON.parse(m[1]); sections = JSON.parse(m[2]); }
      catch (e) { throw new Error("data.js القديم فيه جزء مش JSON سليم: " + e.message); }
      kind = "data.js (صيغة قديمة)";
    }
  }
  checkShape(site, sections);
  sections.forEach(s => { s.items = s.items || []; });
  site.socials = site.socials || [];
  const migrated = migrateLegacyTags(sections);
  return {site, sections, updates: updates || [], extra, kind, addedIds: ensureItemIds(sections), migrated};
}
