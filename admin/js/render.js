/* بيرسم فورم التعديل: الملف الشخصي + الأقسام + العناصر */
function render(){
  const P = siteData;
  $("#profile").innerHTML = `
    <div class="row"><div><label>الاسم بالعربي</label><input data-p="name" value="${esc(P.name)}"></div>
    <div><label>الاسم بالإنجليزي</label><input class="ltr" data-p="nameEn" value="${esc(P.nameEn)}"></div></div>
    <div class="row"><div><label>اسمك (بيظهر تحت الصورة)</label><input data-p="owner" value="${esc(P.owner)}"></div>
    <div><label>علامة التوثيق</label><label class="chk"><input type="checkbox" data-p="verified" ${P.verified ? "checked" : ""}> إظهار علامة التوثيق جنب اسمك</label></div></div>
    <label>سطر تعريفي قصير</label><input data-p="tagline" value="${esc(P.tagline)}">
    <label>نبذة عنك</label><textarea data-p="about">${esc(P.about)}</textarea>
    <div class="row"><div><label>مسار صورتك (مثال assets/img/photo.jpg) أو سيبه فاضي</label><input class="ltr" data-p="photo" value="${esc(P.photo)}"></div>
    <div><label>مسار اللوجو (مثال assets/img/logo.svg)</label><input class="ltr" data-p="logo" value="${esc(P.logo)}"></div></div>
    <div class="row"><div><label>اللون الأساسي (مثال #FDC713)</label><input class="ltr" data-p="accent" value="${esc(P.accent)}" placeholder="#FDC713"></div>
    <div><label>اللون التاني للتدرّج (مثال #F58220)</label><input class="ltr" data-p="accent2" value="${esc(P.accent2)}" placeholder="#F58220"></div></div>
    <label>أزرار التواصل</label>
    ${P.socials.map((s,i)=>`<div class="soc"><input data-soc="${i}" data-f="label" value="${esc(s.label)}" placeholder="الاسم"><input class="ltr" data-soc="${i}" data-f="url" value="${esc(s.url)}" placeholder="https://..."><button class="mini danger" data-act="delsoc" data-i="${i}">حذف</button></div>`).join("")}
    <button class="mini" style="margin-top:8px" data-act="addsoc">+ زرار تواصل</button>
    <div class="row" style="margin-top:12px"><div><label>إيميل استقبال بلاغات الروابط المعطلة (اختياري)</label><input class="ltr" data-p="reportEmail" type="email" value="${esc(P.reportEmail)}" placeholder="name@example.com"><div class="hint">لو فاضي: الزائر بيبعت البلاغ على واتساب (من زرار واتساب فوق) أو بينسخه. مفيش سيرفر ولا بيانات بتتجمع.</div></div>
    <div><label>عدّاد الزوار</label><label class="chk"><input type="checkbox" data-p="visitors" ${P.visitors === false ? "" : "checked"}> إظهار عدّاد الزوار (خدمة CounterAPI الخارجية المجانية)</label><div class="hint">الخدمة مجانية بحد يومي، وبتطلب اتصال بموقع خارجي. شيل العلامة لو عايز تقفله من غير ما تأثر على الموقع.</div></div></div>`;

  const cats = [...new Set(sectionsData.flatMap(s => s.items.map(categoryOf)).filter(Boolean))].sort();
  $("#catlist").innerHTML = cats.map(c => `<option value="${esc(c)}"></option>`).join("")
    + sectionsData.map((s, si) => `<datalist id="catlist-${si}">${secCats(s).map(c => `<option value="${esc(c)}"></option>`).join("")}</datalist>`).join("");
  const tot = sectionsData.reduce((a, s) => a + s.items.length, 0);
  $("#totals").textContent = `${sectionsData.length} قسم — ${tot} عنصر`;
  renderUpdates();
  $("#sections").innerHTML = sectionsData.map((sec,si)=>`
    <div class="panel" id="sec-${si}">
      <div class="seccount"><b>${sec.items.length}</b> عنصر في هذا القسم</div>
      <div class="sechead">
        <div><label>اسم القسم</label><input data-s="${si}" data-f="title" value="${esc(sec.title)}"></div>
        <div style="max-width:150px"><label>المعرّف (ID)</label><input class="ltr" data-s="${si}" data-f="id" value="${esc(sec.id)}"></div>
        <div style="max-width:90px"><label>رمز</label><input data-s="${si}" data-f="icon" value="${esc(sec.icon)}"></div>
        <button class="mini" data-act="secup" data-s="${si}">↑</button>
        <button class="mini" data-act="secdown" data-s="${si}">↓</button>
        <button class="mini danger" data-act="delsec" data-s="${si}">حذف القسم</button>
      </div>
      <div class="row"><div><label>وصف القسم (سطر تحت العنوان)</label><input data-s="${si}" data-f="desc" value="${esc(sec.desc)}"></div>
      <div><label>صورة غلاف القسم (اختياري — مسار نسبي من مجلد site)</label><input class="ltr" data-s="${si}" data-f="cover" value="${esc(sec.cover)}" placeholder="assets/img/sections/fonts.jpg"></div></div>
      ${catsHTML(sec,si)}
      ${sec.items.map((it,ii)=>itemHTML(it,si,ii)).join("")}
      <button class="mini" style="margin-top:12px" data-act="additem" data-s="${si}">+ إضافة عنصر في "${esc(sec.title)}"</button>
    </div>`).join("");
  applyAdminSearch();
}

/* تصنيفات القسم: قايمة (sec.categories) بتظهر تلقائيًا كفلاتر في واجهة القسم لما يبقى فيها تصنيفين أو أكتر مستخدمين.
   إعادة التسمية بتحدّث العناصر اللي بتستخدمها، والحذف بيشيل التصنيف من عناصره بس (العناصر نفسها مبتتحذفش). */
const secCats = sec => [...new Set([...(Array.isArray(sec.categories) ? sec.categories : []), ...sec.items.map(categoryOf)].filter(c => typeof c === "string" && c.trim()))];
function catsHTML(sec, si){
  const list = secCats(sec), n = c => sec.items.filter(it => categoryOf(it) === c).length;
  return `<div class="cats" id="cats-${si}"><label>تصنيفات القسم (فلاتر القسم في الموقع — بتظهر لما يبقى فيه تصنيفين أو أكتر مستخدمين)</label>
    <div class="refs">${list.map((c, k) => `<span class="ref cat"><input class="catname" data-catname="${si}" data-k="${k}" value="${esc(c)}" maxlength="40" aria-label="اسم التصنيف"><small>${n(c)} عنصر</small><button type="button" class="mini danger" data-act="delcat" data-s="${si}" data-k="${k}" aria-label="حذف التصنيف ${esc(c)}">✕</button></span>`).join("")}
      <span class="ref cat"><input class="catname" id="newcat-${si}" data-newcat="${si}" maxlength="40" placeholder="+ تصنيف جديد" aria-label="اسم تصنيف جديد"><button type="button" class="mini" data-act="addcat" data-s="${si}">إضافة</button></span></div></div>`;
}

/* «آخر الإضافات والتحديثات»: ملاحظات بتاريخ بتظهر في صفحة «آخر الإضافات» في الموقع (والعناصر اللي ليها تاريخ إضافة بتظهر تلقائيًا) */
function renderUpdates(){
  const allItems = sectionsData.flatMap((s, si) => s.items.map(it => ({it, si}))).filter(x => x.it.id);
  const opts = sectionsData.map(s => `<optgroup label="${esc(s.title)}">${s.items.filter(i => i.id).map(i => `<option value="${esc(i.id)}">${esc(i.title || i.id)}</option>`).join("")}</optgroup>`).join("");
  const title = id => { const f = allItems.find(x => x.it.id === id); return f ? (f.it.title || id) : id + " (محذوف)"; };
  $("#updates").innerHTML = updatesData.length ? updatesData.map((u, k) => `<div class="item upd" id="upd-${k}">
    <div class="top"><b>${esc(u.title) || "تحديث جديد"}</b><button class="mini danger" data-act="delupd" data-k="${k}">حذف</button></div>
    <div class="row"><div><label>التاريخ (YYYY-MM-DD)</label><input class="ltr" data-u="${k}" data-f="date" value="${esc(u.date)}" placeholder="2026-11-06"></div><div><label>العنوان</label><input data-u="${k}" data-f="title" value="${esc(u.title)}" placeholder="مثال: أدوات جديدة للمونتاج"></div></div>
    <label>تفاصيل (اختياري)</label><textarea data-u="${k}" data-f="text">${esc(u.text)}</textarea>
    <label>عناصر مرتبطة (اختياري)</label>
    <div class="refs">${(u.items || []).map((id, r) => `<span class="ref">${esc(title(id))}<button type="button" class="mini" data-act="delref" data-k="${k}" data-r="${r}" aria-label="إزالة ${esc(title(id))}">✕</button></span>`).join("")}
      <select data-addref="${k}" aria-label="إضافة عنصر مرتبط"><option value="">+ إضافة عنصر…</option>${opts}</select></div>
  </div>`).join("") : `<div class="hint">مفيش تحديثات مكتوبة. العناصر اللي ليها «تاريخ الإضافة» بتظهر في صفحة «آخر الإضافات» لوحدها؛ هنا بتكتب ملاحظات إضافية (مثال: «أضفت ٥ أدوات جديدة للمونتاج»).</div>`;
}

// الكلمات المفتاحية ممكن تكون نص أو قائمة نصوص — بنعرضها كنص مفصول بفواصل
const kwStr = v => Array.isArray(v) ? v.filter(x => typeof x === "string").join("، ") : (typeof v === "string" ? v : "");
function itemHTML(it, si, ii){
  const k = `data-s="${si}" data-i="${ii}"`;
  const opts = Object.entries(TYPES).map(([v,l])=>`<option value="${v}" ${it.type===v?"selected":""}>${l}</option>`).join("");
  const body = it.type === "prompt"
    ? `<label>شرح قصير (بيعمل إيه؟)</label><input ${k} data-f="desc" value="${esc(it.desc)}"><div class="row"><div><label>الأداة المتوافقة (اختياري — مثال: Gemini / Nano Banana)</label><input class="ltr" ${k} data-f="tool" value="${esc(it.tool)}"></div><div><label>صورة النتيجة المتوقعة (اختياري — مسار نسبي من site أو لينك https)</label><input class="ltr" ${k} data-f="image" value="${esc(it.image)}" placeholder="assets/img/prompts/name.webp"></div></div><label>نص الـ Prompt</label><textarea ${k} data-f="text">${esc(it.text)}</textarea>`
    : `<label>وصف قصير</label><input ${k} data-f="desc" value="${esc(it.desc)}"><label>اللينك</label><input class="ltr" ${k} data-f="url" value="${esc(it.url)}" placeholder="https://...">`;
  return `<div class="item" id="item-${si}-${ii}">
    <div class="top"><b>${esc(it.title) || "عنصر جديد"}</b>
      <button class="mini" data-act="itemup" ${k}>↑</button><button class="mini" data-act="itemdown" ${k}>↓</button>
      <button class="mini" data-act="dupitem" ${k} title="يعمل نسخة من العنصر تحته عشان تعدّلها">نسخ</button>
      <button class="mini danger" data-act="delitem" ${k}>حذف</button></div>
    <div class="row3"><div><label>الاسم</label><input ${k} data-f="title" value="${esc(it.title)}"></div>
      <div><label>النوع</label><select ${k} data-f="type" data-rerender="1">${opts}</select></div>
      <div><label>السعر</label><select ${k} data-f="price"><option value="">بدون (برومبت / فيديو / ملف...)</option>${PRICES.map(p => `<option value="${esc(p)}" ${priceOf(it) === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></div></div>
    ${body}
    <label>كلمات مفتاحية للبحث (اختياري — افصل بينها بفاصلة، عربي وإنجليزي)</label><input ${k} data-f="keywords" value="${esc(kwStr(it.keywords))}" placeholder="مثال: إزالة خلفية، background removal، قص">
    <div class="row"><div><label>تاريخ الإضافة (اختياري — YYYY-MM-DD، بيظهر في «آخر الإضافات»)</label><input class="ltr" ${k} data-f="added" value="${esc(it.added)}" placeholder="2026-11-06"></div><div><label>التصنيف (من تصنيفات القسم — أو اكتب تصنيف جديد وهيتضاف للقسم تلقائيًا)</label><input list="catlist-${si}" ${k} data-f="category" value="${esc(categoryOf(it))}"></div></div>
    <label class="chk" style="margin-top:10px"><input type="checkbox" ${k} data-f="featured" ${it.featured === true ? "checked" : ""}> إظهار في الأدوات المميزة</label></div>`;
}
