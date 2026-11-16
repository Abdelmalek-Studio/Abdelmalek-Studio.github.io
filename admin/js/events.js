/* التقاط التعديلات والأزرار (إضافة / حذف / ترتيب) */
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.dataset && e.target.dataset.newcat !== undefined) { e.preventDefault(); const b = document.querySelector(`[data-act="addcat"][data-s="${e.target.dataset.newcat}"]`); if (b) b.click(); } });
const OPTIONAL_FIELDS = ["keywords", "tool", "image", "added"];
// تعديل القيم أثناء الكتابة
document.addEventListener("input", e => {
  const t = e.target, f = t.dataset.f, p = t.dataset.p;
  if (p === "visitors") { if (t.checked) delete siteData.visitors; else siteData.visitors = false; dirty(); return; }   // الافتراضي: ظاهر — بنكتب false بس لما يتقفل
  if (p === "reportEmail") { if (t.value.trim()) siteData.reportEmail = t.value.trim(); else delete siteData.reportEmail; dirty(); return; }
  if (p) { siteData[p] = t.type === "checkbox" ? t.checked : t.value; dirty(); return; }
  if (t.dataset.u !== undefined && f) { updatesData[+t.dataset.u][f] = t.value; dirty(); return; }   // تعديل تحديث في «آخر الإضافات»
  if (t.dataset.soc !== undefined) { siteData.socials[+t.dataset.soc][f] = t.value; dirty(); return; }
  if (t.dataset.s === undefined || !f) return;
  const sec = sectionsData[+t.dataset.s];
  if (t.dataset.i === undefined) { sec[f] = t.value; }
  else if (t.type === "checkbox") { const it = sec.items[+t.dataset.i]; if (t.checked) it[f] = true; else delete it[f]; }   // مثلًا featured: لو اتشال التعليم بنمسح المفتاح
  else if (f === "price" || f === "category") { const it = sec.items[+t.dataset.i]; it[f] = t.value.trim(); }   // بنكتب المفتاح حتى لو فاضي، عشان الـ tag القديم ميرجعش يتقرا
  else if (OPTIONAL_FIELDS.includes(f)) { const it = sec.items[+t.dataset.i]; if (t.value.trim()) it[f] = t.value; else delete it[f]; }   // الحقول الاختيارية الفاضية متتحفظش في الملف
  else { sec.items[+t.dataset.i][f] = t.value; }
  dirty();
  if (t.dataset.rerender) render();
});

// الأزرار
document.addEventListener("click", e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const act = b.dataset.act, s = +b.dataset.s, i = +b.dataset.i;
  const move = (arr, from, to) => { if (to < 0 || to >= arr.length) return; arr.splice(to, 0, arr.splice(from, 1)[0]); };
  if (act === "addsoc") siteData.socials.push({label:"", url:""});
  else if (act === "delsoc") siteData.socials.splice(i,1);
  else if (act === "additem") sectionsData[s].items.push({id:newItemId(), type:"link", title:"", desc:"", url:"", price:"", category:"", added:today()});   // العنصر الجديد بيتأرّخ بتاريخ النهارده → بيظهر في «آخر الإضافات»
  else if (act === "addcat" || act === "delcat") {
    const sec = sectionsData[s]; sec.categories = secCats(sec);
    if (act === "addcat") {
      const inp = document.getElementById("newcat-" + s), v = (inp && inp.value || "").replace(/\s+/g, " ").trim();
      if (!v) { toast("اكتب اسم التصنيف الأول", "err"); return; }
      if (v.length > 40) { toast("اسم التصنيف طويل (الحد 40 حرف)", "err"); return; }
      if (sec.categories.includes(v)) { toast("التصنيف ده موجود بالفعل في القسم", "err"); return; }
      sec.categories.push(v); render(); dirty(); toast("اتضاف التصنيف «" + v + "» — اختاره من خانة التصنيف في العناصر", "ok"); return;
    }
    const c = sec.categories[+b.dataset.k], used = sec.items.filter(it => categoryOf(it) === c);
    if (!confirm(used.length ? `تحذف التصنيف «${c}»؟ هيتشال من ${used.length} عنصر (العناصر نفسها مش هتتحذف).` : `تحذف التصنيف «${c}»؟`)) return;
    used.forEach(it => { it.category = ""; });
    sec.categories.splice(+b.dataset.k, 1); if (!sec.categories.length) delete sec.categories;
  }
  else if (act === "delitem") {
    if (!confirm("تحذف العنصر ده؟")) return;
    const gone = sectionsData[s].items.splice(i,1)[0];
    if (gone && gone.id) updatesData.forEach(u => { if (Array.isArray(u.items)) u.items = u.items.filter(x => x !== gone.id); });   // مفيش مرجع يفضل لعنصر اتحذف
  }
  else if (act === "dupitem") {   // نسخة من العنصر بمعرّف جديد، تتحط تحته عشان تتعدّل
    const src = sectionsData[s].items[i]; if (!src) return;
    const c = clone(src); c.id = newItemId(); c.title = (src.title || "").trim() ? src.title.trim() + " (نسخة)" : ""; delete c.featured; c.added = today(); delete c.autoTitle;
    sectionsData[s].items.splice(i + 1, 0, c);
    render(); dirty(); toast("اتعملت نسخة — عدّل اسمها ولينكها", "ok");
    const el = document.getElementById(`item-${s}-${i + 1}`);
    if (el) { el.scrollIntoView({behavior: "smooth", block: "center"}); el.classList.add("flash", "ok"); setTimeout(() => el.classList.remove("flash", "ok"), 2200); const ti = el.querySelector('[data-f="title"]'); if (ti) ti.focus({preventScroll: true}); }
    return;
  }
  else if (act === "delupd") { if (!confirm("تحذف التحديث ده؟")) return; updatesData.splice(+b.dataset.k, 1); }
  else if (act === "delref") { const u = updatesData[+b.dataset.k]; if (u && u.items) u.items.splice(+b.dataset.r, 1); }
  else if (act === "itemup") move(sectionsData[s].items, i, i-1);
  else if (act === "itemdown") move(sectionsData[s].items, i, i+1);
  else if (act === "secup") move(sectionsData, s, s-1);
  else if (act === "secdown") move(sectionsData, s, s+1);
  else if (act === "delsec") { if (!confirm("تحذف القسم كله بكل اللي فيه؟")) return; sectionsData.splice(s,1); }
  render(); dirty();
});

$("#addUpd").onclick = () => { updatesData.unshift({id:newUpdateId(), date:today(), title:"", text:"", items:[]}); render(); dirty(); const u = document.getElementById("upd-0"); if (u) { u.scrollIntoView({behavior:"smooth", block:"center"}); const t = u.querySelector('[data-f="title"]'); if (t) t.focus({preventScroll:true}); } };
// تصنيفات القسم: إعادة تسمية (بتتطبّق على العناصر)، وتصنيف جديد مكتوب في خانة تصنيف عنصر بيتضاف لقايمة القسم لوحده
document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset && t.dataset.catname !== undefined) {
    const sec = sectionsData[+t.dataset.catname]; sec.categories = secCats(sec);
    const k = +t.dataset.k, old = sec.categories[k], v = t.value.replace(/\s+/g, " ").trim();
    if (!v || v === old) { t.value = old; return; }
    if (sec.categories.includes(v)) { toast("فيه تصنيف بنفس الاسم في القسم", "err"); t.value = old; return; }
    sec.items.forEach(it => { if (categoryOf(it) === old) it.category = v; });
    sec.categories[k] = v; render(); dirty(); toast("اتغيّر اسم التصنيف في كل عناصره ✓", "ok"); return;
  }
  if (t.dataset && t.dataset.f === "category" && t.dataset.i !== undefined) {
    const sec = sectionsData[+t.dataset.s], v = (sec.items[+t.dataset.i].category || "").trim();
    if (v && !secCats({categories: sec.categories, items: []}).includes(v)) {
      sec.categories = [...secCats({categories: sec.categories, items: []}), v];
      // تحديث خفيف (من غير render كامل): الـ render الكامل كان بيمسح اللي المستخدم لسه بيكتبه في الخانات التانية
      const box = document.getElementById("cats-" + t.dataset.s); if (box) box.outerHTML = catsHTML(sec, +t.dataset.s);
      const dl = document.getElementById("catlist-" + t.dataset.s); if (dl) dl.innerHTML = secCats(sec).map(c => `<option value="${esc(c)}"></option>`).join("");
      dirty();
    }
    return;
  }
});
// إضافة عنصر مرتبط لتحديث
document.addEventListener("change", e => {
  const sel = e.target.closest("[data-addref]"); if (!sel || !sel.value) return;
  const u = updatesData[+sel.dataset.addref]; if (!u) return;
  u.items = u.items || []; if (!u.items.includes(sel.value)) u.items.push(sel.value);
  render(); dirty();
});
/* بحث داخل اللوحة: بيخبّي العناصر (والأقسام) اللي مش مطابقة من غير ما يعيد رسم الفورم (فمفيش حاجة بتتفقد من اللي بتكتبه) */
function applyAdminSearch(){
  const box = $("#asearch"); if (!box) return;
  const q = anorm(box.value.trim()), info = $("#asearchinfo");
  let shown = 0, total = 0;
  sectionsData.forEach((sec, si) => {
    const secHit = !!q && anorm(sec.title).includes(q);
    let any = false;
    sec.items.forEach((it, ii) => {
      total++;
      const el = document.getElementById(`item-${si}-${ii}`); if (!el) return;
      const hay = anorm([it.title, it.desc, it.url, it.id, priceOf(it), categoryOf(it), kwStr(it.keywords), it.tool, it.text].join("\n"));
      const hit = !q || secHit || hay.includes(q);
      el.hidden = !hit; if (hit) { any = true; shown++; }
    });
    const pn = document.getElementById(`sec-${si}`); if (pn) pn.hidden = !!q && !any && !secHit;
  });
  if (info) info.textContent = q ? (shown ? `${shown} من ${total} عنصر مطابق` : "مفيش عناصر مطابقة") : "";
}
$("#asearch").addEventListener("input", applyAdminSearch);

$("#addSec").onclick = () => {
  sectionsData.push({id:newSectionId(), title:"قسم جديد", icon:"✦", desc:"", cover:"", items:[]});
  render(); dirty(); window.scrollTo({top:document.body.scrollHeight, behavior:"smooth"});
};
