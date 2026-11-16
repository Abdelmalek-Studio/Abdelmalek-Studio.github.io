/* تحميل البيانات، التصدير (مع التحقق)، والنسخ الاحتياطي.
   - البيانات الافتراضية بتتحمّل من ../site/data/data.js (script عادي في admin/index.html)
   - الملفات اللي بتتفتح من جهازك بتتقرا بـ JSON.parse بس (من غير تنفيذ أي كود) */
const clone = o => JSON.parse(JSON.stringify(o));
const counts = (sections) => ({s: sections.length, i: sections.reduce((a, s) => a + (s.items||[]).length, 0)});

function applyData(site, sections, msg, updates, extra){
  siteData = site; sectionsData = sections;
  updatesData = Array.isArray(updates) ? updates : []; rootExtra = (extra && typeof extra === "object") ? extra : {};
  siteData.socials = siteData.socials || [];
  sectionsData.forEach(s => s.items = s.items || []);
  updatesData.forEach(u => { if (u && !Array.isArray(u.items)) u.items = u.items == null ? [] : u.items; });
  ensureItemIds(sectionsData);
  migrateLegacyTags(sectionsData);                       // السعر والتصنيف بقوا حقلين منفصلين (الـ tag القديم بيفضل زي ما هو)
  baseline = clone({site: siteData, sections: sectionsData, updates: updatesData});
  isDirty = false; hideErrors(); hideBoxes(); render(); status(msg || "اتحمّل");
}
function hideBoxes(){ ["#diffbox", "#dupbox"].forEach(s => { const b = $(s); if (b) { b.hidden = true; b.innerHTML = ""; } }); }
function loadDefault(){
  const D = window.STUDIO_DATA;
  if (!D || !D.site || !Array.isArray(D.sections)) {
    applyData({name:"", nameEn:"", tagline:"", about:"", photo:"", logo:"", accent:"#FDC713", accent2:"#F58220", socials:[]}, [], "ملف site/data/data.js مش موجود — بدأنا بقالب فاضي");
    return;
  }
  const extra = {}; Object.keys(D).forEach(k => { if (!["version", "site", "sections", "updates", "format", "exportedAt"].includes(k)) extra[k] = D[k]; });
  applyData(clone(D.site), clone(D.sections), undefined, Array.isArray(D.updates) ? clone(D.updates) : [], clone(extra));
}

/* قراءة ملف + تأكيد قبل الاستبدال */
async function importFile(file, what){
  let r;
  try { r = parseDataText(await file.text()); }
  catch (err) { alert("مقدرتش أقرا الملف — البيانات الحالية ما اتغيرتش.\n\n" + err.message); return; }
  const c = counts(r.sections), cur = counts(sectionsData);
  const warn = isDirty ? "\n\n⚠ عندك تعديلات لسه متنزلتش وهتضيع." : "";
  // مقارنة سريعة: إيه اللي هيتضاف وإيه اللي هيختفي لو كملت (عشان محدش يفقد حاجة من غير ما يعرف)
  const d = diffData({site: siteData, sections: sectionsData, updates: updatesData}, {site: r.site, sections: r.sections, updates: r.updates});
  const lost = d.removed.length ? `\n\n⚠ ${d.removed.length} عنصر موجود حاليًا مش موجود في الملف ده وهيختفي (مثال: «${d.removed.slice(0, 3).map(x => x.title || x.id).join("»، «")}»${d.removed.length > 3 ? "…" : ""}).` : "";
  const ok = confirm(`${what} «${file.name}» (${r.kind})\nفيه ${c.s} قسم و${c.i} عنصر.\n\nالبيانات الحالية (${cur.s} قسم و${cur.i} عنصر) هتتستبدل بيها.\nالفرق: +${d.added.length} جديد، −${d.removed.length} هيختفي، ~${d.modified.length} متعدّل.` + lost + warn + "\n\nتكمّل؟");
  if (!ok) { status("اتلغى — البيانات الحالية زي ما هي"); return; }
  const prev = {site: siteData, sections: sectionsData, updates: updatesData, extra: rootExtra, baseline, dirty: isDirty};
  try {
    applyData(r.site, r.sections, `اتحمّل من «${file.name}»` + (r.addedIds ? ` (اتضاف ${r.addedIds} معرّف)` : ""), r.updates, r.extra);
    const errs = validateData(siteData, sectionsData, updatesData);
    if (errs.length) showErrors(errs, "الملف اتحمّل، بس فيه ملاحظات لازم تتصلح قبل التنزيل:");
  } catch (err) {
    // أي خطأ غير متوقع أثناء التحميل: نرجّع البيانات الحالية بالظبط ونوضّح السبب (مفيش فقدان بيانات ومفيش توقف)
    siteData = prev.site; sectionsData = prev.sections; updatesData = prev.updates; rootExtra = prev.extra; baseline = prev.baseline; isDirty = prev.dirty;
    try { render(); } catch (e2) { /* العرض القديم كان شغال، ده احتياط بس */ }
    status("اتلغى — البيانات الحالية زي ما هي");
    alert("الملف فيه حاجة منعت تحميله — البيانات الحالية ما اتغيرتش.\n\n" + (err && err.message ? err.message : String(err)));
  }
}

$("#file").onchange = async e => { const f = e.target.files[0]; e.target.value = ""; if (f) await importFile(f, "فتح ملف"); };
$("#restore").onchange = async e => { const f = e.target.files[0]; e.target.value = ""; if (f) await importFile(f, "استرجاع نسخة"); };
$("#reset").onclick = () => { if (confirm("ترجع للبيانات الحالية في site/data/data.js؟ التعديلات اللي مش متنزّلة هتتمسح.")) loadDefault(); };

/* أخطاء التحقق */
function showErrors(errs, title){
  const box = $("#errbox");
  box.innerHTML = `<b>${esc(title)}</b><ol>` + errs.map((e, k) =>
    `<li>${esc(e.msg)}${e.sec !== undefined || e.upd !== undefined ? ` <a href="#" data-goto="${k}">روح للمكان</a>` : ""}</li>`).join("") + `</ol>`;
  box._errs = errs; box.hidden = false;
  box.scrollIntoView({behavior:"smooth", block:"start"});
}
function hideErrors(){ const b = $("#errbox"); if (b) { b.hidden = true; b.innerHTML = ""; b._errs = null; } }
$("#errbox").addEventListener("click", e => {
  const a = e.target.closest("[data-goto]"); if (!a) return; e.preventDefault();
  const er = $("#errbox")._errs[+a.dataset.goto];
  const el = document.getElementById(er.upd !== undefined ? `upd-${er.upd}` : er.item !== undefined ? `item-${er.sec}-${er.item}` : `sec-${er.sec}`);
  if (el && el.hidden) { $("#asearch").value = ""; applyAdminSearch(); }   // لو البحث مخبّي المكان، بنمسحه
  if (el) { el.scrollIntoView({behavior:"smooth", block:"center"}); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 2000); }
});

/* تحقق غير مانع: هل ملفات الصور المحلية (بروفايل / لوجو / أغلفة) موجودة فعلًا جنب اللوحة؟
   مفيش حظر للتنزيل — لو ملف ناقص الموقع بيعرض بديل (غلاف افتراضي / حرف الاسم) بس بننبّهك */
// نتيجة الفحص: "ok" اتحمّلت | "fail" الملف مش موجود/بايظ | "timeout" انتهت المهلة قبل ما نعرف (مش نجاح ولا فشل — بنحذّر منها)
const PROBE_TIMEOUT = 6000;
function probeImage(path){
  return new Promise(res => {
    const i = new Image(); let done = false;
    const end = r => { if (done) return; done = true; clearTimeout(t); i.onload = i.onerror = null; res(r); };
    const t = setTimeout(() => end("timeout"), PROBE_TIMEOUT);
    i.onload = () => end(i.naturalWidth > 0 || /\.svg$/i.test(path) ? "ok" : "fail");
    i.onerror = () => end("fail");
    i.src = "../site/" + path.trim();
  });
}
/* بيرجّع قايمة تنبيهات: kind = "missing" (الملف مش موجود) أو "unverified" (المهلة خلصت — مقدرناش نتأكد). الفحص بيشتغل بالتوازي ومكرر المسار بيتفحص مرة واحدة */
async function findMissingImages(site, sections){
  const cache = new Map(), probe = p => { const k = p.trim(); if (!cache.has(k)) cache.set(k, probeImage(k)); return cache.get(k); };
  const jobs = [];
  const add = (path, label, sec) => { if (isStr(path) && path.trim() && isLocalImage(path)) jobs.push(probe(path).then(r => r === "ok" ? null
    : r === "fail" ? {kind: "missing", msg: `${label}: الملف «${path}» مش موجود جوه مجلد site — هيظهر بديل مكانه.`, sec}
    : {kind: "unverified", msg: `${label}: «${path}» — لم يتم التحقق منها (انتهت مهلة الفحص). اتأكد إنها بتفتح قبل النشر.`, sec})); };
  add(site.photo, "الملف الشخصي — الصورة الشخصية");
  add(site.logo, "الملف الشخصي — اللوجو");
  sections.forEach((s, si) => add(s.cover, `القسم رقم ${si+1}${s.title ? " «" + s.title + "»" : ""} — صورة الغلاف`, si));
  sections.forEach((s, si) => (s.items || []).forEach((it, ii) => add(it.image, `القسم رقم ${si+1} ← العنصر رقم ${ii+1}${it.title ? " «" + it.title + "»" : ""} — صورة النتيجة`, si)));
  const out = (await Promise.all(jobs)).filter(Boolean);
  return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "missing" ? -1 : 1));
}

/* شكل الملف المتصدّر: version + site + sections (+ updates لو فيه) + أي حقول إضافية كانت في الملف الأصلي */
function exportObject(){
  const o = {version: 1, site: siteData, sections: sectionsData};
  if (updatesData.length) o.updates = updatesData;
  Object.keys(rootExtra).forEach(k => { if (!(k in o)) o[k] = rootExtra[k]; });
  return o;
}

/* ===== معاينة التغييرات: مقارنة بين نسختين (بالمعرّف الثابت للعناصر) ===== */
const FIELD_LABEL = {title:"الاسم", desc:"الوصف", url:"اللينك", type:"النوع", price:"السعر", category:"التصنيف", tag:"التصنيف القديم", text:"نص الـ Prompt", keywords:"كلمات البحث", tool:"الأداة", image:"الصورة", added:"تاريخ الإضافة", featured:"مميز", autoTitle:"عنوان تلقائي"};
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
function diffData(a, b){
  const idx = d => { const m = new Map(); (d.sections || []).forEach((s, si) => (s.items || []).forEach(it => { if (it && it.id) m.set(it.id, {it, sec: s.title || s.id, si}); })); return m; };
  const A = idx(a), B = idx(b), out = {added: [], removed: [], modified: [], moved: [], profile: [], sections: [], updates: 0};
  B.forEach((v, id) => { if (!A.has(id)) out.added.push({id, title: v.it.title, sec: v.sec}); });
  A.forEach((v, id) => {
    const n = B.get(id);
    if (!n) { out.removed.push({id, title: v.it.title, sec: v.sec}); return; }
    const keys = [...new Set([...Object.keys(v.it), ...Object.keys(n.it)])].filter(k => k !== "id" && !same(v.it[k], n.it[k]));
    if (keys.length) out.modified.push({id, title: n.it.title || v.it.title, sec: n.sec, fields: keys.map(k => FIELD_LABEL[k] || k)});
    if (v.sec !== n.sec) out.moved.push({id, title: n.it.title, from: v.sec, to: n.sec});
  });
  const pk = [...new Set([...Object.keys(a.site || {}), ...Object.keys(b.site || {})])].filter(k => !same((a.site || {})[k], (b.site || {})[k]));
  out.profile = pk;
  const sa = (a.sections || []).map(s => s.id), sb = (b.sections || []).map(s => s.id);
  sb.forEach(id => { if (!sa.includes(id)) out.sections.push("قسم جديد: " + ((b.sections.find(s => s.id === id) || {}).title || id)); });
  sa.forEach(id => { if (!sb.includes(id)) out.sections.push("قسم محذوف: " + ((a.sections.find(s => s.id === id) || {}).title || id)); });
  (a.sections || []).forEach(s => { const t = (b.sections || []).find(x => x.id === s.id); if (t) ["title", "desc", "icon", "cover", "categories"].forEach(k => { if (!same(s[k], t[k])) out.sections.push(`القسم «${t.title || s.id}»: تغيّر ${({title:"الاسم", desc:"الوصف", icon:"الرمز", cover:"الغلاف", categories:"التصنيفات"})[k]}`); }); });
  if (sa.join() !== sb.join() && sa.length === sb.length && sa.every(x => sb.includes(x))) out.sections.push("ترتيب الأقسام اتغيّر");
  out.updates = same(a.updates || [], b.updates || []) ? 0 : 1;
  return out;
}
function showPreview(){
  const d = diffData(baseline || {site: {}, sections: [], updates: []}, {site: siteData, sections: sectionsData, updates: updatesData});
  const total = d.added.length + d.removed.length + d.modified.length + d.sections.length + d.profile.length + d.updates;
  const list = (arr, f, cls, mark) => arr.length ? `<div class="grp"><span class="${cls}">${mark}</span> ${arr.length}</div><ul>${arr.slice(0, 40).map(x => `<li>${f(x)}</li>`).join("")}${arr.length > 40 ? `<li>…و${arr.length - 40} آخرين</li>` : ""}</ul>` : "";
  const box = $("#diffbox");
  box.innerHTML = `<b>معاينة التغييرات</b> <span class="hint">(مقارنة بآخر نسخة اتحمّلت أو اتنزّلت — ${total ? "ده اللي هيتغيّر لما تنزّل" : "مفيش تغييرات"})</span>`
    + list(d.added, x => `${esc(x.title || x.id)} <span class="hint">في «${esc(x.sec)}»</span>`, "mark-add", "+ عناصر جديدة")
    + list(d.removed, x => `${esc(x.title || x.id)} <span class="hint">كان في «${esc(x.sec)}»</span>`, "mark-del", "− عناصر محذوفة")
    + list(d.modified, x => `${esc(x.title || x.id)} <span class="hint">(${esc(x.fields.join("، "))})</span>`, "mark-mod", "~ عناصر معدّلة")
    + (d.sections.length ? `<div class="grp">الأقسام</div><ul>${d.sections.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "")
    + (d.profile.length ? `<div class="grp">الملف الشخصي</div><ul><li>${esc(d.profile.map(k => ({name:"الاسم", nameEn:"الاسم الإنجليزي", owner:"اسمك", verified:"التوثيق", tagline:"السطر التعريفي", about:"النبذة", photo:"الصورة", logo:"اللوجو", accent:"اللون الأساسي", accent2:"اللون التاني", socials:"أزرار التواصل", visitors:"عدّاد الزوار", reportEmail:"إيميل البلاغات"})[k] || k).join("، "))}</li></ul>` : "")
    + (d.updates ? `<div class="grp">آخر الإضافات والتحديثات اتعدّلت</div>` : "");
  box.hidden = false; box.scrollIntoView({behavior: "smooth", block: "start"});
  status(total ? `${total} تغيير` : "مفيش تغييرات");
}
$("#preview").onclick = showPreview;

/* ===== فحص التكرارات: روابط مكررة + أسماء مكررة + عناصر متشابهة (تنبيه فقط — مبيمنعش التنزيل) ===== */
const TRACK = /^(utm_|fbclid$|gclid$|ref$|ref_src$|igshid$|mc_)/i;
function urlKey(u){
  try {
    const x = new URL(String(u).trim()); if (!/^https?:$/.test(x.protocol)) return "";
    const yt = String(u).match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/); if (yt) return "yt:" + yt[1];
    const sp = [...x.searchParams.entries()].filter(([k]) => !TRACK.test(k)).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => k + "=" + v).join("&");
    return x.hostname.toLowerCase().replace(/^www\./, "") + x.pathname.replace(/\/+$/, "").toLowerCase() + (sp ? "?" + sp : "");
  } catch (e) { return ""; }
}
const hostKey = u => { try { return new URL(String(u).trim()).hostname.toLowerCase().replace(/^www\./, ""); } catch (e) { return ""; } };
const tokens = t => new Set(anorm(t).replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(w => w.length > 1));
const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; a.forEach(x => { if (b.has(x)) n++; }); return n / (a.size + b.size - n); };
function findDuplicates(sections){
  const rows = []; sections.forEach((s, si) => (s.items || []).forEach((it, ii) => { if (isObj(it)) rows.push({it, si, ii, label: `«${it.title || it.id}» (${s.title || "قسم " + (si+1)} ← ${ii+1})`}); }));
  const out = [], seen = new Set();
  const group = (map, make) => map.forEach(list => { if (list.length > 1) out.push(make(list)); });
  const by = (keyFn) => { const m = new Map(); rows.forEach(r => { const k = keyFn(r); if (k) (m.get(k) || m.set(k, []).get(k)).push(r); }); return m; };
  const refs = list => list.map(r => ({sec: r.si, item: r.ii, label: r.label}));
  // 1) نفس اللينك بعد تنضيف (من غير www / # / تتبّع / شرطة آخر)
  group(by(r => r.it.type === "prompt" ? "" : urlKey(r.it.url)), l => { l.forEach(r => seen.add(r)); return {kind: "رابط مكرر", msg: `نفس اللينك في ${l.length} عناصر: ${l.map(r => r.label).join("، ")}`, refs: refs(l)}; });
  // 2) نفس الاسم (من غير عناصر الفيديو بعنوان تلقائي)
  group(by(r => r.it.autoTitle ? "" : anorm(r.it.title).replace(/[^\p{L}\p{N}]/gu, "")), l => ({kind: "اسم مكرر", msg: `نفس الاسم في ${l.length} عناصر: ${l.map(r => r.label).join("، ")}`, refs: refs(l)}));
  // 3) نص Prompt مكرر
  group(by(r => r.it.type === "prompt" ? anorm(r.it.text).replace(/\s+/g, " ").trim().slice(0, 400) : ""), l => ({kind: "Prompt مكرر", msg: `نص الـ Prompt متطابق في: ${l.map(r => r.label).join("، ")}`, refs: refs(l)}));
  // 4) عناصر متشابهة: نفس الموقع وأسماء متقاربة (أو اسم بيحتوي التاني) — من غير اللي اتبلّغ عنه كتكرار صريح
  for (let a = 0; a < rows.length; a++) for (let b = a + 1; b < rows.length; b++) {
    const x = rows[a], y = rows[b]; if (seen.has(x) && seen.has(y)) continue;
    if (x.it.type === "prompt" || y.it.type === "prompt" || x.it.autoTitle || y.it.autoTitle) continue;
    const hx = hostKey(x.it.url); if (!hx || hx !== hostKey(y.it.url) || urlKey(x.it.url) === urlKey(y.it.url)) continue;
    if (/^(drive|docs)\.google\.com$|^(www\.)?(youtube\.com|youtu\.be)$/.test(hx)) continue;   // مواقع بتستضيف حاجات كتير مختلفة
    const tx = tokens(x.it.title), ty = tokens(y.it.title);
    if (jaccard(tx, ty) >= 0.6) out.push({kind: "متشابهين", msg: `أسماء متقاربة ونفس الموقع (${hx}): ${x.label} و${y.label}`, refs: refs([x, y])});
  }
  return out;
}
function showDuplicates(){
  const res = findDuplicates(sectionsData), box = $("#dupbox");
  if (!res.length) { box.innerHTML = "<b>مفيش تكرارات أو عناصر متشابهة ✓</b>"; box.hidden = false; toast("مفيش تكرارات ✓", "ok"); return; }
  box.innerHTML = `<b>فحص التكرارات: ${res.length} تنبيه</b> <span class="hint">(تنبيه فقط — مبيمنعش التنزيل. بعض التشابه ممكن يكون مقصود)</span><ol>` + res.map((r, k) => `<li><b>${esc(r.kind)}:</b> ${esc(r.msg)} ${r.refs.map((x, n) => `<a href="#" data-dgo="${k}.${n}">روح ${n + 1}</a>`).join(" ")}</li>`).join("") + `</ol>`;
  box._res = res; box.hidden = false; box.scrollIntoView({behavior: "smooth", block: "start"});
  toast(`${res.length} تنبيه تكرار`, "warn");
}
$("#dupcheck").onclick = showDuplicates;
$("#dupbox").addEventListener("click", e => {
  const a = e.target.closest("[data-dgo]"); if (!a) return; e.preventDefault();
  const [k, n] = a.dataset.dgo.split(".").map(Number), ref = $("#dupbox")._res[k].refs[n];
  let el = document.getElementById(`item-${ref.sec}-${ref.item}`);
  if (el && el.hidden) { $("#asearch").value = ""; applyAdminSearch(); }
  if (el) { el.scrollIntoView({behavior: "smooth", block: "center"}); el.classList.add("flash", "ok"); setTimeout(() => el.classList.remove("flash", "ok"), 2200); }
});

/* تنزيل data.js (بعد التحقق) */
$("#download").onclick = async () => {
  try { await doDownload(); }
  catch (err) {
    showErrors([{msg: "حصل خطأ غير متوقع أثناء التنزيل، فالتنزيل اتوقف وبياناتك زي ما هي: " + (err && err.message ? err.message : String(err))}], "التنزيل اتوقف:");
    status("التنزيل اتوقف: خطأ غير متوقع");
  }
};
async function doDownload(){
  ensureItemIds(sectionsData);
  const errs = validateData(siteData, sectionsData, updatesData);
  if (errs.length) { showErrors(errs, `التنزيل اتوقف — فيه ${errs.length} ${errs.length > 10 ? "خطأ" : "أخطاء"} لازم تتصلح الأول (بياناتك زي ما هي ومفيش حاجة اتفقدت):`); status(`التنزيل اتوقف: ${errs.length} خطأ`); return; }
  hideErrors();
  const txt = "/* data.js — بيانات الموقع بصيغة JSON صرفة (من غير كود). بتتعدل من لوحة الإدارة. */\nwindow.STUDIO_DATA = " + safeJSON(exportObject()) + ";\n";
  downloadText("data.js", txt, "text/javascript");
  const d = diffData(baseline, {site: siteData, sections: sectionsData, updates: updatesData});
  baseline = clone({site: siteData, sections: sectionsData, updates: updatesData});
  isDirty = false; status("اتنزّل ✓ حطه مكان site/data/data.js");
  toast(`اتنزّل data.js ✓ (+${d.added.length} جديد، −${d.removed.length} محذوف، ~${d.modified.length} متعدّل)`, "ok");
  const issues = await findMissingImages(siteData, sectionsData);
  const miss = issues.filter(x => x.kind === "missing").length, unv = issues.length - miss;
  if (issues.length) showErrors(issues, `اتنزّل data.js، بس ${[miss ? miss + " صورة مش موجودة" : "", unv ? unv + " صورة لم يتم التحقق منها (انتهت المهلة)" : ""].filter(Boolean).join(" و")} (تنبيه — مش بيمنع التنزيل):`);
}

/* نسخة احتياطية (من غير تحقق — عشان تقدر تحفظ شغل لسه مخلصش) */
$("#backup").onclick = () => {
  ensureItemIds(sectionsData);
  const d = new Date(), p = n => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
  const o = {format:"abdelmalek-studio-backup", version:1, exportedAt:d.toISOString(), ...exportObject()};
  downloadText(`abdelmalek-backup-${stamp}.json`, safeJSON(o) + "\n", "application/json");
  status("اتنزّلت نسخة احتياطية ✓");
};
