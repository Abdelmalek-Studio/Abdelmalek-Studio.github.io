/* أدوات صغيرة مشتركة (اختصار querySelector، تأمين النصوص، تنضيف اللينكات، توحيد الحروف العربي للبحث) */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
// يمنع أي لينك غير http/https/mailto (زي javascript:)
// بيقبل https/http/mailto، ومسار ملف جوه الموقع نفسه (assets/...) زي ملف الـ CV
const safeUrl = u => { u = String(u ?? "").trim(); return /^(https?:|mailto:)/i.test(u) || (/^assets\/[\w\-./%]+$/.test(u) && !u.includes("..")) ? u : "#"; };
// توحيد الحروف العربي للبحث (تشكيل، أ/إ/آ، ة/ه، ى/ي)
const norm = s => String(s ?? "").toLowerCase().replace(/[ً-ٟـ]/g, "")
  .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
// مسار صورة الغلاف: لينك https أو مسار نسبي بسيط (من غير .. ولا بروتوكولات تانية)
const safeImg = u => { u = String(u ?? "").trim(); return /^https?:\/\//i.test(u) || (/^[\w\-./%]+$/.test(u) && !u.includes("..") && !u.startsWith("/")) ? u : ""; };
// اسم النطاق من اللينك (من غير www) — للبحث. بيرجّع "" لو مش لينك http(s)
const hostOf = u => { try { const x = new URL(String(u ?? "").trim()); return /^https?:$/.test(x.protocol) ? x.hostname.toLowerCase().replace(/^www\./, "") : ""; } catch (e) { return ""; } };
// الكلمات المفتاحية للعنصر (اختيارية): نص مفصول بفواصل أو قائمة نصوص — بترجّع نص واحد للبحث
const kwText = it => Array.isArray(it.keywords) ? it.keywords.filter(x => typeof x === "string").join(" ") : (typeof it.keywords === "string" ? it.keywords : "");
// كود لون صحيح: #RGB أو #RRGGBB
const isHexColor = c => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(c ?? "").trim());
// عدّاد بالعربي: 1 عنصر / 2 عنصران / 3-10 عناصر / 11+ عنصر
const countLabel = n => n === 1 ? "عنصر واحد" : n === 2 ? "عنصران" : n <= 10 ? n + " عناصر" : n + " عنصر";

/* ---- السعر والتصنيف (حقلين منفصلين) ----
   price    = حالة السعر: مجاني / مجاني محدود / مدفوع (أو فاضي)
   category = نوع المحتوى: صور، منتجات، لوجو، أعمال...
   العناصر القديمة (فيها tag بس): لو tag كلمة سعر بيتقرا كسعر، وإلا بيتقرا كتصنيف — من غير ما نغيّر الملف. */
const PRICES = ["مجاني", "مجاني محدود", "مدفوع"];
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const priceOf = it => { const v = String((hasOwn(it, "price") ? it.price : it.tag) ?? "").trim(); return PRICES.includes(v) ? v : ""; };
const categoryOf = it => String((hasOwn(it, "category") ? it.category : (PRICES.includes(String(it.tag ?? "").trim()) ? "" : it.tag)) ?? "").trim();
const priceClass = p => p === "مجاني" ? " free" : p === "مدفوع" ? " paid" : "";
// تاريخ YYYY-MM-DD صالح
const isDate = d => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && (t => !isNaN(t) && new Date(t).toISOString().slice(0, 10) === d)(Date.parse(d + "T00:00:00Z"));   // صارم: 2026-02-30 مش تاريخ
// تاريخ مقروء بالعربي (أرقام إنجليزي)
const fmtDate = d => { try { return new Date(d + "T00:00:00").toLocaleDateString("ar-EG-u-nu-latn", {year: "numeric", month: "long", day: "numeric"}); } catch (e) { return d; } };
