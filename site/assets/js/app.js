/* المحرك الرئيسي: بيتأكد من data.js، بيرسم الصفحة، التابات، البحث، الفلاتر، المفضلة ومجموعاتها، الروابط المباشرة، آخر الإضافات */
if (typeof STUDIO_DATA === "undefined" || !STUDIO_DATA || !STUDIO_DATA.site || !Array.isArray(STUDIO_DATA.sections)) {
  document.body.innerHTML = '<p style="padding:40px;text-align:center">ملف data/data.js مش موجود أو فيه خطأ. اتأكد إنه في مكانه.</p>';
  throw new Error("data.js missing");
}
const SITE = STUDIO_DATA.site, SECTIONS = STUDIO_DATA.sections;
const UPDATES = Array.isArray(STUDIO_DATA.updates) ? STUDIO_DATA.updates.filter(u => u && typeof u === "object" && isDate(u.date) && typeof u.title === "string" && u.title.trim()) : [];

renderProfile(SITE);

/* ---------------- الحالة ----------------
   active: القسم | fprice: السعر (لأدوات المواقع بس) | fcat: التصنيف (category) — الاتنين خاصين بالقسم المفتوح | view: "" / "fav" (مفضلاتي) / "new" (آخر الإضافات)
   favGroup: مجموعة المفضلة المعروضة (all / none / id) | focusId: عنصر مفتوح برابط مباشر */
let active = "all", fprice = "all", fcat = "all", view = "", favGroup = "all", gMode = "", focusId = "";
const ITEMS = new Map();                                       // id → {it, sec}
SECTIONS.forEach(sec => (sec.items || []).forEach(it => { if (it && it.id && !ITEMS.has(it.id)) ITEMS.set(it.id, {it, sec}); }));
const allIds = [...ITEMS.keys()];
const favIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
const flagIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>';
// زرار مشاركة رابط الأداة (رابط مباشر في موقعنا): مشاركة النظام لو متاحة، وإلا نسخ الرابط
const shareBtn = it => it.id ? `<button type="button" class="sharebtn" data-share="${esc(it.id)}" aria-label="مشاركة رابط ${esc(it.title)}" title="مشاركة رابط الأداة"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4"/></svg></button>` : "";
// زرار الإبلاغ عن رابط معطل (للعناصر اللي ليها لينك خارجي)
const reportBtn = it => it.id && it.type !== "prompt" && /^https?:\/\//i.test(it.url || "") ? `<button type="button" class="reportbtn" data-report="${esc(it.id)}" aria-label="الإبلاغ عن رابط لا يعمل: ${esc(it.title)}" title="الإبلاغ عن رابط لا يعمل">${flagIcon}</button>` : "";
const copyBtn = (it, idx) => it.type === "prompt" ? `<button type="button" class="pcopy" data-copy="${idx}" aria-label="نسخ البرومبت: ${esc(it.title)}">Copy</button>` : "";
const favLabel = on => on ? "إزالة من المفضلة" : "إضافة للمفضلة";
const favBtn = it => { const on = Favs.has(it.id); return `<button type="button" class="favbtn${on ? " on" : ""}" data-fav="${esc(it.id)}" aria-pressed="${on}" aria-label="${favLabel(on)}" title="${favLabel(on)}">${favIcon}</button>`; };
let featuredList = [], latestList = [];
const flat = [];
/* لون مميّز لكل قسم (تصميم فقط — مفيش حاجة بتتكتب في البيانات): درجة اللون (hue) محسوبة من ترتيب القسم بزاوية ذهبية، فكل قسم ليه لون واضح ومختلف عن جاره.
   CSS بيحوّلها لألوان (hsl(var(--h) …)) في الشريط الجانبي والبانر والكروت والتوهّج الخلفي. القسم الأول بيطلع كهرماني زي هوية الموقع. */
const BRAND_HUE = 40, HUES = new Map(SECTIONS.map((s, i) => [s.id, Math.round((38 + i * 137.508) % 360)]));
const hueOf = id => HUES.has(id) ? HUES.get(id) : BRAND_HUE;
const hueStyle = id => ` style="--h:${hueOf(id)}"`;
const cwrap = (it, extra = "") => { flat.push(it); const n = flat.length - 1; return `<div class="cwrap"${it.id && ITEMS.has(it.id) ? hueStyle(ITEMS.get(it.id).sec.id) : ""}>${cardHTML(it, n)}${it.id ? favBtn(it) : ""}${shareBtn(it)}${reportBtn(it)}${copyBtn(it, n)}${extra}</div>`; };

// ترتيب الأسعار: مجاني ← مجاني محدود ← (من غير سعر) ← مدفوع. العناصر اللي مش روابط (Prompt / فيديو / ملف) بتفضل الأول بترتيبها زي ما هو، فروابط زي MeiGen متسبقش البرومبتات
const priceRank = it => { if (it.type !== "link") return -1; const t = priceOf(it); return t === "مجاني" ? 0 : t === "مجاني محدود" ? 1 : t === "مدفوع" ? 3 : 2; };

/* ---------------- البحث ----------------
   تطابق عنصر مع كلمة البحث: الكلمة نفسها، أو أي كلمة مرادفة ليها (إزالة الخلفية = Background Removal ...)
   المرادفات بتدوّر في بيانات الأداة (الاسم/الوصف/التصنيف/الكلمات المفتاحية) من غير نص البرومبت الطويل، عشان النتايج تبقى دقيقة */
const metaHay = new WeakMap();
const metaOf = (sec, it) => {
  let h = metaHay.get(it);
  if (h === undefined) { h = norm([sec.title, it.title, it.desc, priceOf(it), categoryOf(it), kwText(it), it.tool].join("\n")); metaHay.set(it, h); }
  return h;
};
const findsCache = new Map();   // مرادفات الكلمة بتتحسب مرة واحدة مش لكل عنصر
const findsOf = term => { let f = findsCache.get(term); if (!f) { f = Search.finds(term); if (findsCache.size > 300) findsCache.clear(); findsCache.set(term, f); } return f; };
const hit1 = (sec, it, term) => {
  if (hayOf(sec, it).includes(term)) return true;
  const f = findsOf(term);
  if (!f.length) return false;
  const m = metaOf(sec, it);
  return f.some(x => m.includes(x));
};
// «ال» التعريف في أول الكلمة بتتشال كاحتمال تاني (الجودة ≈ جودة)، والبحث بأكتر من كلمة: كل كلمة لازم تلاقي نفسها (أو مرادفها) — مش لازم تتجاور
let LOOSE = false;   // بحث الكلمات المتفرقة بيشتغل بس لو البحث الدقيق (العبارة + المرادفات) ملقاش حاجة في النطاق — عشان ميطلّعش نتايج زيادة
const stem = w => w.length > 4 && w.startsWith("ال") ? w.slice(2) : w;
const matches = (sec, it, term) => {
  if (!term) return true;
  if (hit1(sec, it, term)) return true;
  const st = stem(term); if (st !== term && hit1(sec, it, st)) return true;
  const ws = term.split(/\s+/).filter(w => w.length > 1);
  return LOOSE && ws.length > 1 && ws.every(w => hit1(sec, it, w) || (stem(w) !== w && hit1(sec, it, stem(w))));
};
// نص البحث لكل عنصر بيتحسب مرة واحدة (مش مع كل حرف بيتكتب) — فالبحث يفضل سريع حتى مع مئات العناصر.
// بيشمل: اسم القسم + اسم العنصر + الوصف + السعر + التصنيف + نص الـ Prompt + النطاق (domain) + اللينك من غير البروتوكول
const hay = new WeakMap();
const hayOf = (sec, it) => {
  let h = hay.get(it);
  if (h === undefined) {
    const host = it.type === "prompt" ? "" : hostOf(it.url);
    const link = it.type === "prompt" ? "" : String(it.url ?? "").replace(/^[a-z][a-z0-9+.-]*:\/\/(www\.)?/i, "");
    h = norm([sec.title, it.title, it.desc, priceOf(it), categoryOf(it), kwText(it), it.tool, it.text, it.type === "prompt" ? "prompt prompts برومبت برومبتس" : "", host, link].join("\n"));
    hay.set(it, h);
  }
  return h;
};
const termOf = () => norm($("#q").value.trim()).replace(/^(https?:\/\/)?(www\.)?/, "");   // لو لصق لينك كامل (أو كتب www.) نشيل البروتوكول عشان يطابق
// رمز القسم: حرف/إيموجي عادي، أو مسار صورة (زي لوجو شغلي) فبيتعرض كصورة
const isImgIcon = v => /\.(svg|png|webp|jpe?g)$/i.test(String(v ?? "").trim()) && !!safeImg(v);
const iconHTML = v => isImgIcon(v) ? `<img src="${esc(safeImg(v))}" alt="">` : esc(v);

/* ---------------- الـ URL ↔ الحالة ---------------- */
function curState(){
  if (focusId) return {i: focusId};
  const q = $("#q").value.trim();
  return {v: view, g: view === "fav" && favGroup !== "all" ? favGroup : "", s: active !== "all" ? active : "", p: fprice !== "all" ? fprice : "", c: fcat !== "all" ? fcat : "", q};
}
const commit = mode => Route.write(curState(), mode || "replace");
let syncing = false;
function applyRoute(st){
  syncing = true;
  try {
    active = "all"; fprice = "all"; fcat = "all"; view = ""; favGroup = "all"; focusId = ""; gMode = ""; $("#q").value = "";
    if (st.i && ITEMS.has(st.i)) { focusId = st.i; active = ITEMS.get(st.i).sec.id; }
    else {
      if (st.v === "fav" || (st.v === "new" && hasNews())) view = st.v;
      if (st.g && (st.g === "none" || FavGroups.get(st.g))) favGroup = st.g;
      if (st.s && SECTIONS.some(s => s.id === st.s && (s.items || []).length)) active = st.s;
      if (st.p && PRICE_FILTERS.some(x => x[0] === st.p)) fprice = st.p;
      if (st.c) fcat = st.c;
      if (st.q) $("#q").value = st.q.slice(0, 120);
    }
    document.body.classList.toggle("fav-mode", !!view);
    hideSuggest(); renderTabs(); render(true);
    if (focusId) revealItem(focusId);
  } finally { syncing = false; }
}
function revealItem(id){
  const e = ITEMS.get(id); if (!e) return;
  if (e.it.type === "prompt") { PromptModal.open(e.it, null); return; }
  const card = document.querySelector(`#content [data-id="${CSS.escape(id)}"]`); if (!card) return;
  const w = card.closest(".cwrap") || card;
  w.classList.add("flash"); setTimeout(() => w.classList.remove("flash"), 2600);
  const go = () => w.scrollIntoView({block: "center", behavior: "instant"});   // فوري فعلًا (auto كان بيتحوّل لـ smooth بسبب CSS scroll-behavior): الرابط المباشر لازم يوصّل بدقة حتى لو الصور لسه بتتحمّل
  go(); try { card.focus({preventScroll: true}); } catch (err) {}
  [350, 1100].forEach(ms => setTimeout(() => { if (focusId === id && w.classList.contains("flash")) { const r = w.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) go(); } }, ms));   // تصحيح لو الصور غيّرت الارتفاع
}
function onNav(){ if (syncing) return; if (Route.build(curState()) === (location.hash || "")) return; applyRoute(Route.parse(location.hash)); }
window.addEventListener("popstate", onNav);
window.addEventListener("hashchange", onNav);

/* ---------------- عرض الصفحة ---------------- */
const newsEntries = () => SECTIONS.flatMap(s => (s.items || []).filter(it => isDate(it.added)));
const hasNews = () => UPDATES.length > 0 || newsEntries().length > 0;
function favCards(term){
  // كل العناصر المفضلة من كل الأقسام بترتيب الأقسام، والبحث بيشتغل عليها كمان (وبمجموعة لو محددة)
  const out = [];
  SECTIONS.forEach(sec => (sec.items || []).forEach(it => {
    if (!it.id || !Favs.has(it.id) || !matches(sec, it, term)) return;
    const g = FavGroups.groupOf(it.id);
    if (favGroup === "none" ? g : (favGroup !== "all" && g !== favGroup)) return;
    out.push(it);
  }));
  return out;
}
function updateFavCount(){ const n = Favs.count(allIds); $("#favcount").textContent = n; $("#favcount").hidden = !n; }
function setView(v, push = true){
  view = v; favGroup = "all"; gMode = ""; focusId = ""; active = v ? "all" : active;
  document.body.classList.toggle("fav-mode", !!v);
  $("#favnav").setAttribute("aria-pressed", String(view === "fav"));
  renderTabs(); render(true);
  if (push) commit("push");
  window.scrollTo({top: 0, behavior: "auto"});
}
const setFavView = on => setView(on ? "fav" : "");

function groupsBar(){
  const favs = allIds.filter(id => Favs.has(id)), gs = FavGroups.list();
  const cnt = gid => favs.filter(id => (gid === "none" ? !FavGroups.groupOf(id) : FavGroups.groupOf(id) === gid)).length;
  const chip = (val, label, n) => `<button type="button" class="fchip${favGroup === val ? " on" : ""}" aria-pressed="${favGroup === val}" data-gchip="${esc(val)}">${esc(label)}<b>${n}</b></button>`;
  let h = `<div class="gbar" role="group" aria-label="مجموعات المفضلة">${chip("all", "الكل", favs.length)}${gs.map(g => chip(g.id, g.name, cnt(g.id))).join("")}${gs.length ? chip("none", "بدون مجموعة", cnt("none")) : ""}`
    + (gMode ? "" : `<button type="button" class="fchip gnew" data-gnew>＋ مجموعة جديدة</button>`) + `</div>`;
  const cur = FavGroups.get(favGroup);
  if (cur && !gMode) h += `<div class="gmanage"><span>المجموعة: <b>${esc(cur.name)}</b></span><button type="button" class="fchip" data-grename>إعادة تسمية</button><button type="button" class="fchip danger" data-gdel>حذف المجموعة</button></div>`;
  if (gMode) {
    const left = FavGroups.PRESETS.filter(p => !gs.some(g => g.name === p));
    h += `<form class="gform" data-gform><label class="sr-only" for="gname">اسم المجموعة</label><input id="gname" name="gname" maxlength="30" autocomplete="off" placeholder="اسم المجموعة (مثال: أدوات التصميم)" value="${gMode === "rename" && cur ? esc(cur.name) : ""}">`
      + `<button type="submit" class="fchip on">${gMode === "rename" ? "حفظ الاسم" : "إنشاء"}</button><button type="button" class="fchip" data-gcancel>إلغاء</button></form>`
      + (gMode === "new" && left.length ? `<div class="gpresets"><span>اقتراحات:</span>${left.map(p => `<button type="button" class="fchip" data-gpreset="${esc(p)}">${esc(p)}</button>`).join("")}</div>` : "");
  }
  return h;
}
function groupSelect(it){
  const gs = FavGroups.list(); if (!gs.length) return "";
  const cur = FavGroups.groupOf(it.id);
  return `<label class="gmove"><span class="sr-only">نقل «${esc(it.title)}» إلى مجموعة</span><select data-gsel="${esc(it.id)}" aria-label="نقل «${esc(it.title)}» إلى مجموعة"><option value="">بدون مجموعة</option>${gs.map(g => `<option value="${esc(g.id)}"${g.id === cur ? " selected" : ""}>${esc(g.name)}</option>`).join("")}</select></label>`;
}
function renderFavView(term, animate){
  const items = favCards(term), total = Favs.count(allIds);
  if (favGroup !== "all" && favGroup !== "none" && !FavGroups.get(favGroup)) favGroup = "all";
  const cards = items.map(it => cwrap(it, groupSelect(it))).join("");
  const emptyMsg = !total ? "لسه مضفتش حاجة لمفضلاتك — اضغط على ♥ في أي كارت وهتلاقيه هنا." : term ? "مفيش نتائج للبحث ده في مفضلاتك." : "المجموعة دي فاضية — انقل إليها عناصر من القايمة المنسدلة تحت أي كارت.";
  $("#content").innerHTML = `<section class="sec favsec" id="favorites"><header class="fav-head"><h2><i aria-hidden="true">♥</i>مفضلاتي</h2><button type="button" class="fchip" data-favback>← رجوع للموقع</button></header>`
    + (total || FavGroups.list().length ? groupsBar() : "")
    + (items.length ? `<div class="grid">${cards}</div>` : `<div class="empty">${emptyMsg}</div>`) + `</section>`;
  $("#results").textContent = "";
  renderFeatured(false); renderLatest(false);
  FX.reveal($("#content"), !animate); fillVideoTitles();
}
function renderNewView(animate){
  const byDate = new Map(), ensure = d => { if (!byDate.has(d)) byDate.set(d, {notes: [], items: []}); return byDate.get(d); };
  UPDATES.forEach(u => ensure(u.date).notes.push(u));
  newsEntries().forEach(it => ensure(it.added).items.push(it));
  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));
  let shown = 0;
  const html = dates.map(d => {
    const g = byDate.get(d), inNotes = new Set();
    const notes = g.notes.map(u => {
      const refs = [...new Set(Array.isArray(u.items) ? u.items : [])].map(id => ITEMS.get(id)).filter(Boolean).map(e => e.it);
      refs.forEach(r => inNotes.add(r.id));
      return `<article class="unote"><h4>${esc(u.title)}</h4>${u.text ? `<p>${esc(u.text)}</p>` : ""}${refs.length ? `<div class="grid">${refs.map(r => { shown++; return cwrap(r); }).join("")}</div>` : ""}</article>`;
    }).join("");
    const rest = g.items.filter(it => !inNotes.has(it.id));
    shown += rest.length;
    return `<div class="dgroup"><h3 class="dh"><time datetime="${esc(d)}">${esc(fmtDate(d))}</time></h3>${notes}${rest.length ? `<div class="grid">${rest.map(it => cwrap(it)).join("")}</div>` : ""}</div>`;
  }).join("");
  $("#content").innerHTML = `<section class="sec newsec" id="whatsnew"><header class="fav-head"><h2><i aria-hidden="true">✦</i>آخر الإضافات</h2><button type="button" class="fchip" data-favback>← رجوع للموقع</button></header>${html}</section>`;
  $("#results").textContent = "";
  renderFeatured(false); renderLatest(false);
  FX.reveal($("#content"), !animate); fillVideoTitles();
}
const emptyHTML = (term, filtersOn) => {
  const secs = SECTIONS.filter(s => (s.items || []).length).slice(0, 6);
  const topics = (typeof SYN !== "undefined" ? SYN : []).slice(0, 5);
  return `<div class="empty" role="status"><p class="e-t">${term ? `مفيش نتائج لـ «${esc($("#q").value.trim())}»` : "مفيش نتائج بالفلاتر الحالية"}</p>`
    + `<p class="e-h">جرّب كلمة أقصر أو أعم، أو اكتب بالعربي أو الإنجليزي (مثال: «إزالة خلفية» أو «background removal»)${filtersOn ? "، أو شيل بعض الفلاتر" : ""}.</p>`
    + `<div class="e-act">${term ? '<button type="button" class="fchip" data-qclear>مسح البحث</button>' : ""}${filtersOn ? '<button type="button" class="fchip" data-reset>مسح الفلاتر</button>' : ""}${term || filtersOn || active !== "all" ? '<button type="button" class="fchip" data-clearall2>عرض كل المحتوى</button>' : ""}</div>`
    + (topics.length ? `<div class="e-sug"><span>أفكار للبحث:</span>${topics.map(t => `<button type="button" class="fchip" data-q="${esc(t.q)}">${esc(t.label.replace(/\s*\(.*\)\s*$/, ""))}</button>`).join("")}</div>` : "")
    + `<div class="e-sug"><span>أو تصفّح قسم:</span>${secs.map(s => `<button type="button" class="fchip" data-sec="${esc(s.id)}">${esc(s.title)}</button>`).join("")}</div></div>`;
};
function render(animate){
  const term = termOf();
  flat.length = 0;
  let html = "", shown = 0;
  LOOSE = false;
  if (term) { const scope = active !== "all" && !view ? SECTIONS.filter(x => x.id === active) : SECTIONS; LOOSE = !scope.some(x => (x.items || []).some(it => matches(x, it, term))); }
  updateFavCount(); renderFilters(); updateClear();   // الأول: بيصحّح التصنيف/السعر لو مش بتوع القسم المفتوح، وبيحسب العدّادات
  if (view === "fav") return renderFavView(term, animate);
  if (view === "new") return renderNewView(animate);
  SECTIONS.forEach(sec => {
    if (active !== "all" && active !== sec.id) return;
    const items = (sec.items || []).filter(it => matches(sec, it, term) && matchPrice(it, fprice) && matchCat(it, fcat));
    if (!items.length) return;
    items.sort((a, b) => priceRank(a) - priceRank(b));   // الأول المجاني، بعده المجاني المحدود، وآخر حاجة المدفوع (الترتيب جوه كل مجموعة زي ما هو)
    shown += items.length;
    const cover = safeImg(sec.cover);
    html += `<section class="sec" id="${esc(sec.id)}"${hueStyle(sec.id)}>
      <header class="sec-head${cover ? " has-cover" : ""}">${cover ? `<img class="sec-cover" src="${esc(cover)}" alt="" loading="lazy">` : ""}
        <span class="sec-mark" aria-hidden="true">${isImgIcon(sec.icon) ? "" : esc(sec.icon)}</span>
        <div class="sec-text"><h2><i${isImgIcon(sec.icon) ? ' class="img"' : ""}>${iconHTML(sec.icon)}</i>${esc(sec.title)}</h2>${sec.desc ? `<p>${esc(sec.desc)}</p>` : ""}</div>
      </header><div class="grid">` + items.map(it => cwrap(it)).join("") + `</div></section>`;
  });
  const filtersOn = fprice !== "all" || fcat !== "all";
  $("#content").innerHTML = shown ? html : emptyHTML(term, filtersOn);
  const q = $("#q").value.trim(), asec = active !== "all" ? SECTIONS.find(x => x.id === active) : null;
  const share = (term || filtersOn) && shown ? ` <button type="button" class="fchip sres" data-shareres>مشاركة النتائج</button>` : "";
  // لو بنبحث جوه قسم: نقول كام نتيجة جواه، وكام نتيجة تانية في باقي الأقسام (زرار يوسّع البحث لكل الأقسام)
  let elsewhere = "";
  if (term && asec) { let n = 0; SECTIONS.forEach(x => { if (x.id !== active) n += (x.items || []).filter(it => matches(x, it, term)).length; }); if (n) elsewhere = ` <button type="button" class="fchip" data-searchall>${esc(countLabel(n))} في باقي الأقسام ←</button>`; }
  const scope = asec ? ` في «${asec.title}»` : "";
  const cnt = term ? `${countLabel(shown)} لـ «${q}»${scope}` : filtersOn ? `${countLabel(shown)}${scope}` : "";
  const clr = (term || filtersOn) ? ` <button type="button" class="fchip clearall" data-clearall>مسح الكل ✕</button>` : "";
  $("#results").innerHTML = (shown ? esc(cnt) + share : "") + elsewhere + clr;
  renderFeatured(!term && !filtersOn);
  renderLatest(!term && !filtersOn);
  FX.reveal($("#content"), !animate);
  fillVideoTitles();
}

// الأدوات المميزة: العناصر اللي متعلّم عليها featured من لوحة الإدارة. لو مفيش، الجزء كله بيختفي
function renderFeatured(allowed){
  const box = $("#featured");
  featuredList = SECTIONS.flatMap(s => (s.items || []).filter(it => it.featured === true));
  if (!featuredList.length || !allowed || active !== "all") { box.hidden = true; box.innerHTML = ""; return; }
  box.innerHTML = `<h2 class="fh"><i aria-hidden="true">★</i>أدوات مميزة</h2><div class="fgrid">${featuredList.map((it, n) => fcardHTML(it, n)).join("")}</div>`;
  box.hidden = false;
}
// آخر الإضافات: أحدث 6 عناصر ليها تاريخ added (YYYY-MM-DD). لو مفيش ولا عنصر متأرّخ، الجزء بيختفي
function renderLatest(allowed){
  const box = $("#latest");
  latestList = newsEntries().sort((a, b) => b.added.localeCompare(a.added)).slice(0, 6);
  if (!hasNews() || !allowed || active !== "all") { box.hidden = true; box.innerHTML = ""; return; }
  box.innerHTML = `<h2 class="fh"><i aria-hidden="true">✦</i>آخر الإضافات<button type="button" class="fchip fh-more" data-newview>عرض الكل ←</button></h2>` + (latestList.length ? `<div class="fgrid">${latestList.map((it, n) => fcardHTML(it, n, "lopen")).join("")}</div>` : `<div class="fgrid">${UPDATES.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map(u => `<div class="fcard"><strong>${esc(u.title)}</strong><span class="fd">${esc(fmtDate(u.date))}</span></div>`).join("")}</div>`);
  box.hidden = false;
}
/* الفلاتر: خاصة بالقسم المفتوح بس (مفيش فلاتر عامة).
   التصنيفات: من حقل categories في القسم (بترتيبه، وبتتحكم فيها من لوحة الإدارة) + أي تصنيف مستخدم في عناصره. بتظهر لو القسم فيه تصنيفين أو أكتر فعليًا.
   فلتر السعر: بيظهر بس في أقسام المواقع والأدوات (عناصر type=link) اللي فيها أكتر من حالة سعر. الحالة بتتحدد لكل عنصر لوحده (مفيش موقع كله بيتصنّف مجاني/مدفوع). */
function secFilterInfo(sec){
  const items = (sec && sec.items) || [], used = new Map();
  items.forEach(it => { const c = categoryOf(it); if (c) used.set(c, 1); });
  const order = (Array.isArray(sec && sec.categories) ? sec.categories : []).filter(c => typeof c === "string" && c.trim()).map(c => c.trim());
  const cats = [...new Set([...order, ...used.keys()])].filter(c => used.has(c));
  const prices = new Set(items.filter(it => it.type === "link").map(priceOf).filter(Boolean));
  return {cats: cats.length >= 2 ? cats : [], price: prices.size >= 2, prices: PRICES.filter(p => prices.has(p))};
}
function renderFilters(){
  const box = $("#filters"), sec = active !== "all" && !view ? SECTIONS.find(x => x.id === active) : null, info = sec ? secFilterInfo(sec) : {cats: [], price: false};
  if (!info.cats.includes(fcat)) fcat = "all";
  if (!info.price) fprice = "all";
  const wrap = box.closest(".controls"); if (wrap) wrap.hidden = !sec || (!info.cats.length && !info.price);
  if (!sec || (!info.cats.length && !info.price)) { box.innerHTML = ""; return; }
  const term = termOf();
  // العدّادات بتتحسب حسب البحث والفلتر التاني، فمفيش شيب يوديك لنتيجة فاضية
  const base = term ? (sec.items || []).filter(it => matches(sec, it, term)) : (sec.items || []);   // البحث بيتحسب مرة واحدة، والعدّادات بتتحسب من نتيجته
  const n = (c, p) => base.filter(it => matchPrice(it, p) && matchCat(it, c)).length;
  const chip = (attr, val, label, cur, cnt) => `<button type="button" class="fchip${cur === val ? " on" : ""}" aria-pressed="${cur === val}" data-${attr}="${esc(val)}">${esc(label)}<b>${cnt}</b></button>`;
  box.innerHTML = (info.cats.length ? `<div class="fgroup" role="group" aria-label="تصنيفات ${esc(sec.title)}"><span class="flabel">التصنيف</span>${chip("fu", "all", "كل " + sec.title, fcat, n("all", fprice))}${info.cats.map(c => chip("fu", c, c, fcat, n(c, fprice))).join("")}</div>` : "")
    + (info.price ? `<div class="fgroup" role="group" aria-label="السعر"><span class="flabel">السعر</span>${chip("fp", "all", "الكل", fprice, n(fcat, "all"))}${info.prices.map(p => chip("fp", p, p, fprice, n(fcat, p))).join("")}<span class="fnote">«مجاني محدود» = جزء مجاني وجزء مدفوع (التفاصيل في وصف كل أداة)</span></div>` : "")
    + "";
}
// زرار «مسح الكل» وزرار × في البحث
function updateClear(){
  const has = !!$("#q").value.trim();
  const qc = $("#qclear"); if (qc) qc.hidden = !has;
}
function clearAll(){
  $("#q").value = ""; fprice = "all"; fcat = "all"; active = "all"; focusId = ""; hideSuggest();
  renderTabs(); render(true); commit("push");
}
const Q_PLACEHOLDER = $("#q").placeholder;
function renderTabs(){
  // الأقسام الفاضية متظهرش في التابات
  const all = [{id:"all", title:"الكل"}, ...SECTIONS.filter(s => (s.items || []).length)];
  if (!all.some(s => s.id === active)) active = "all";
  const icoOf = s => { if (s.id === "all") return ""; const v = String(s.icon ?? "").trim(); return isImgIcon(v) ? ` style="--ic:url(&quot;${esc(new URL(safeImg(v), document.baseURI).href)}&quot;)"` : v ? ` data-i="${esc(v)}"` : ""; };
  const cntOf = s => s.id === "all" ? SECTIONS.reduce((n, x) => n + (x.items || []).length, 0) : (s.items || []).length;
  // الأيقونة والعدد بيترسموا بـ CSS من data-i / data-n (نص الزرار نفسه = اسم القسم بس)
  $("#tabs").innerHTML = all.map(s => `<button class="chip ${s.id===active && !view ?"on":""}" aria-pressed="${s.id===active && !view}" data-id="${esc(s.id)}" data-n="${cntOf(s)}"${icoOf(s)}${s.id === "all" ? ' title="الرئيسية — عرض كل الأقسام"' : ""}>${esc(s.title)}</button>`).join("")
    + (hasNews() ? `<button class="chip newchip${view === "new" ? " on" : ""}" aria-pressed="${view === "new"}" data-view="new">✦ آخر الإضافات</button>` : "");
  // درجة لون الخلفية (التوهّج) بتتغير مع القسم المفتوح
  const asec = !view && active !== "all" ? all.find(x => x.id === active) : null;
  $("#q").placeholder = asec ? `ابحث في «${asec.title}»…` : Q_PLACEHOLDER;
  document.documentElement.style.setProperty("--h", String(view || active === "all" ? BRAND_HUE : hueOf(active)));
}

$("#results").addEventListener("click", e => {
  if (e.target.closest("[data-clearall]")) { clearAll(); $("#q").focus({preventScroll: true}); return; }
  // «ابحث في كل الأقسام»: نفس الكلمة، من غير تقييد بالقسم
  if (!e.target.closest("[data-searchall]")) return;
  active = "all"; fprice = "all"; fcat = "all"; focusId = ""; renderTabs(); render(true); commit("push");
});
$("#tabs").addEventListener("click", e => {
  const b = e.target.closest(".chip"); if (!b) return;
  if (b.dataset.view) { setView(b.dataset.view); return; }
  active = b.dataset.id; focusId = ""; fprice = "all"; fcat = "all"; renderTabs(); render(true); commit("push");
  // الضغط على قسم: الشريط يبقى هو اللي فوق (تحت الهيدر على طول) والجزء بتاع الاسم والصورة يطلع لفوق، ومحتوى القسم تحت الشريط — بنزول ناعم
  const top = $("#navtop").getBoundingClientRect().top + window.scrollY - (parseInt(getComputedStyle(document.documentElement).getPropertyValue("--hdr")) || 0);
  if (Math.abs(window.scrollY - top) > 4) window.scrollTo({top: Math.max(0, top), behavior: FX.reduce ? "auto" : "smooth"});
  if (matchMedia("(max-width:700px)").matches) { const on = $("#tabs .chip.on"); if (on) { const t = $("#tabs"); t.scrollLeft += on.getBoundingClientRect().left - t.getBoundingClientRect().left - (t.clientWidth - on.offsetWidth) / 2; } }   // موبايل بس: القسم النشط يتوسّط الشريط (من غير ما الصفحة تتحرك)
});
$("#q").addEventListener("input", () => { focusId = ""; if (view === "new") { view = ""; document.body.classList.remove("fav-mode"); renderTabs(); } render(false); showSuggest(); commit("replace"); });
$("#qclear").addEventListener("click", () => { $("#q").value = ""; hideSuggest(); focusId = ""; render(false); commit("replace"); $("#q").focus({preventScroll: true}); });

/* اقتراحات أثناء الكتابة (أفكار ← أقسام ← أدوات). الأسهم والـ Enter والـ Esc بتشتغل بالكيبورد. */
let sugList = [], sugIdx = -1;
function hideSuggest(){ const b = $("#suggest"); b.hidden = true; b.innerHTML = ""; sugList = []; sugIdx = -1; $("#q").setAttribute("aria-expanded", "false"); $("#q").removeAttribute("aria-activedescendant"); }
function showSuggest(){
  const term = norm($("#q").value.trim());
  sugList = view === "fav" ? [] : Search.suggest(term, SECTIONS); sugIdx = -1;
  const b = $("#suggest");
  if (!sugList.length) { hideSuggest(); return; }
  const KIND = {topic: "فكرة", section: "قسم", item: "أداة"};
  b.innerHTML = sugList.map((x, i) => `<div class="sg" role="option" id="sg${i}" aria-selected="false" data-sg="${i}"><span class="sk">${KIND[x.kind]}</span><span class="st">${esc(x.text)}</span></div>`).join("");
  b.hidden = false; $("#q").setAttribute("aria-expanded", "true");
}
function pickSuggest(i){
  const x = sugList[i]; if (!x) return;
  $("#q").value = x.value; hideSuggest(); focusId = ""; render(true); commit("replace");
}
function moveSuggest(d){
  if (!sugList.length) return;
  sugIdx = (sugIdx + d + sugList.length) % sugList.length;
  document.querySelectorAll("#suggest .sg").forEach((n, i) => { n.setAttribute("aria-selected", String(i === sugIdx)); n.classList.toggle("on", i === sugIdx); });
  $("#q").setAttribute("aria-activedescendant", "sg" + sugIdx);
  const on = document.getElementById("sg" + sugIdx); if (on && on.scrollIntoView) on.scrollIntoView({block: "nearest"});
}
$("#q").addEventListener("keydown", e => {
  if (e.key === "ArrowDown") { if ($("#suggest").hidden) showSuggest(); e.preventDefault(); moveSuggest(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); moveSuggest(-1); }
  else if (e.key === "Enter") {
    e.preventDefault();
    if (sugIdx >= 0) { pickSuggest(sugIdx); return; }
    hideSuggest(); const first = document.querySelector("#content .cwrap .card");    // Enter من غير اختيار: ننقل التركيز لأول نتيجة
    if (first) { first.focus({preventScroll: true}); first.scrollIntoView({block: "center", behavior: FX.reduce ? "auto" : "smooth"}); }
  }
  else if (e.key === "Escape") {
    if (!$("#suggest").hidden) { e.preventDefault(); hideSuggest(); }
    else if ($("#q").value) { e.preventDefault(); $("#q").value = ""; render(false); commit("replace"); }   // Esc تاني بيمسح البحث
  }
});
$("#q").addEventListener("blur", () => setTimeout(hideSuggest, 120));
$("#q").addEventListener("focus", () => { if ($("#q").value.trim()) showSuggest(); });
$("#suggest").addEventListener("mousedown", e => { e.preventDefault(); const n = e.target.closest("[data-sg]"); if (n) pickSuggest(+n.dataset.sg); });
$("#filters").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.hasAttribute("data-clearall")) { clearAll(); $("#q").focus({preventScroll: true}); return; }
  let sel;
  if (b.dataset.fp !== undefined) { fprice = b.dataset.fp; sel = `[data-fp="${fprice}"]`; }
  else if (b.dataset.fu !== undefined) { fcat = b.dataset.fu; sel = `[data-fu="${fcat}"]`; }
  else return;
  focusId = "";
  render(false); commit("replace");
  setTimeout(() => { const n = $("#filters").querySelector(sel); if (n) n.focus({preventScroll: true}); }, 0);   // التركيز بعد الرسم: يرجّع التركيز على نفس الزرار (الفلاتر بتتبني من جديد) من غير ما يعطّل الضغطة
});
/* أزرار جوه المحتوى: رجوع، مسح، اقتراحات، مجموعات المفضلة */
$("#content").addEventListener("click", e => {
  const t = e.target, hit = s => t.closest(s);
  if (hit("[data-favback]")) { setView(""); return; }
  if (hit("[data-reset]")) { fprice = "all"; fcat = "all"; render(true); commit("replace"); return; }
  if (hit("[data-qclear]")) { $("#q").value = ""; render(true); commit("replace"); $("#q").focus({preventScroll: true}); return; }
  if (hit("[data-clearall2]")) { clearAll(); return; }
  let b;
  if ((b = hit("[data-q]"))) { $("#q").value = b.dataset.q; render(true); commit("replace"); return; }
  if ((b = hit("[data-sec]"))) { $("#q").value = ""; fprice = "all"; fcat = "all"; active = b.dataset.sec; renderTabs(); render(true); commit("push"); return; }
  if ((b = hit("[data-gchip]"))) { favGroup = b.dataset.gchip; gMode = ""; render(false); commit("replace"); return; }
  if (hit("[data-gnew]")) { gMode = "new"; render(false); const i = $("#gname"); if (i) i.focus(); return; }
  if (hit("[data-grename]")) { gMode = "rename"; render(false); const i = $("#gname"); if (i) { i.focus(); i.select(); } return; }
  if (hit("[data-gcancel]")) { gMode = ""; render(false); return; }
  if ((b = hit("[data-gpreset]"))) { const r = FavGroups.add(b.dataset.gpreset); if (r.ok) { favGroup = r.group.id; gMode = ""; FX.toast("اتعملت مجموعة «" + r.group.name + "» ✓", true); commit("replace"); } else FX.toast(r.msg, false); render(false); return; }
  if (hit("[data-gdel]")) {
    const g = FavGroups.get(favGroup); if (!g) return;
    if (!confirm(`تحذف مجموعة «${g.name}»؟ العناصر هتفضل في مفضلاتك من غير مجموعة.`)) return;
    FavGroups.remove(g.id); favGroup = "all"; FX.toast("اتحذفت المجموعة — المفضلة زي ما هي", true); render(false); commit("replace"); return;
  }
  if ((b = hit(".favbtn"))) {
    const on = Favs.toggle(b.dataset.fav);
    FX.toast(on ? "اتضاف للمفضلة ♥" : "اتشال من المفضلة", true); 
    if (view === "fav") { render(false); return; }   // في «مفضلاتي»: الكارت بيختفي أول ما يتشال القلب
    b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); b.setAttribute("aria-label", favLabel(on)); b.title = favLabel(on);
    updateFavCount();
    return;
  }
  if ((b = hit("[data-report]"))) { const en = ITEMS.get(b.dataset.report); if (en) { Report.open(en.it, b); } return; }
  if (hit("[data-newview]")) { setView("new"); return; }
});
$("#content").addEventListener("submit", e => {
  const f = e.target.closest("[data-gform]"); if (!f) return; e.preventDefault();
  const name = f.elements.gname.value;
  const r = gMode === "rename" ? FavGroups.rename(favGroup, name) : FavGroups.add(name);
  if (!r.ok) { FX.toast(r.msg, false); f.elements.gname.focus(); return; }
  if (gMode === "new") favGroup = r.group.id;
  gMode = ""; FX.toast("اتحفظت المجموعة ✓", true); render(false); commit("replace");
});
$("#content").addEventListener("change", e => {
  const s = e.target.closest("[data-gsel]"); if (!s) return;
  FavGroups.assign(s.dataset.gsel, s.value);
  FX.toast(s.value ? "اتنقل للمجموعة ✓" : "اتشال من المجموعة", true);
  render(false);
});
$("#results").addEventListener("click", async e => {
  if (!e.target.closest("[data-shareres]")) return;
  const url = Route.pageUrl(curState()), q = $("#q").value.trim();
  await shareLink({title: (SITE.nameEn || SITE.name) + (q ? " — " + q : ""), text: q ? `نتايج البحث عن «${q}»` : "نتايج مفلترة", url}, "اتنسخ رابط النتايج ✓");
});
// زرار «مفضلاتي» فوق: بيفتح/يقفل صفحة المفضلات. واللوجو بيرجّع للموقع
$("#favnav").addEventListener("click", () => { setView(view === "fav" ? "" : "fav"); });
document.querySelector(".brand").addEventListener("click", e => { if (view || focusId || location.hash) { e.preventDefault(); applyRoute({}); commit("push"); window.scrollTo({top: 0, behavior: "auto"}); } });
$("#featured").addEventListener("click", e => {
  const b = e.target.closest("[data-fopen]"); if (!b) return;
  const it = featuredList[+b.dataset.fopen]; if (it) { openPromptItem(it, b); }
});
$("#latest").addEventListener("click", e => {
  if (e.target.closest("[data-newview]")) { setView("new"); return; }
  const b = e.target.closest("[data-lopen]"); if (!b) return;
  const it = latestList[+b.dataset.lopen]; if (it) { openPromptItem(it, b); }
});
// لو صورة الغلاف مش بتفتح، نشيلها ويظهر الغلاف الافتراضي
$("#content").addEventListener("error", e => { if (e.target.classList && e.target.classList.contains("sec-cover")) { e.target.closest(".sec-head").classList.remove("has-cover"); e.target.remove(); } }, true);

// نسخ النص: الطريقة الأساسية (Clipboard API) ثم البديلة (execCommand). بترجّع true بس لو النسخ نجح فعلًا.
async function copyText(text){
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* نجرب البديلة */ }
  }
  const prev = document.activeElement;
  const t = document.createElement("textarea");
  t.value = text; t.setAttribute("readonly", "");
  t.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  document.body.appendChild(t);
  let ok = false;
  try { t.focus(); t.select(); t.setSelectionRange(0, text.length); ok = document.execCommand("copy") === true; } catch (e) { ok = false; }
  t.remove();
  if (prev && prev.focus) { try { prev.focus(); } catch (e) {} }
  return ok;
}

/* نسخ مع إشعار: بيظبط نص الزرار/الزراير ويرجّعها بعد ثانية ونص. اللي بيحدد النتيجة آخر ضغطة. */
async function copyWithFeedback(b, text, btns){
  btns = btns || [b];
  btns.forEach(x => { if (x && !x.dataset.label) x.dataset.label = x.textContent; });   // النص الأصلي مرة واحدة
  // المؤقت والترتيب بيتخزنوا على المجموعة كلها (مش على الزرار اللي اتداس) — عشان ضغطة على زرار تلغي مؤقت الزرار التاني
  // ومايرجّعش النص الأصلي قبل ميعاده
  const g = btns[0] || b;
  const seq = g._seq = (g._seq || 0) + 1;
  const ok = await copyText(text);
  if (seq !== g._seq) return;
  btns.forEach(x => { if (x) x.textContent = ok ? "Copied ✓" : "Copy failed ✕"; });
  if (ok) { FX.haptic(12); FX.toast("Prompt copied ✓", true); b.classList.add("done"); setTimeout(() => b.classList.remove("done"), 1400); }
  else { FX.toast("فشل النسخ — حدد النص وانسخه يدويًا", false); }
  clearTimeout(g._t); g._t = setTimeout(() => btns.forEach(x => { if (x) x.textContent = x.dataset.label; }), ok ? 1400 : 3000);
}


// فتح الـ Prompt: ضغطة على الكارت أو Enter / Space. الرابط بيتحدّث لرابط مباشر للعنصر (#i=...) وبيرجع لما النافذة تتقفل
function openPromptItem(it, trigger){
  if (it.id) { focusId = it.id; commit("replace"); }
  PromptModal.open(it, trigger);
}
PromptModal.onClose = () => { if (focusId) { focusId = ""; commit("replace"); } };
PromptModal.onShare = it => { if (it && it.id) shareItem(it.id); };
function openPrompt(card){
  const it = flat[card.dataset.open]; if (!it) return;
  openPromptItem(it, card);
}
$("#content").addEventListener("click", e => { if (e.target.closest(".favbtn, .sharebtn, .reportbtn, .pcopy, .gmove")) return; const c = e.target.closest(".pcard"); if (c) openPrompt(c); });
$("#content").addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const c = e.target.closest(".pcard"); if (!c || e.target !== c) return;
  e.preventDefault(); openPrompt(c);
});

/* مشاركة رابط: مشاركة النظام لو متاحة، وإلا نسخ الرابط */
async function shareLink(data, okMsg){
  try { if (navigator.share) { await navigator.share(data); return; } } catch (err) { if (err && err.name === "AbortError") return; }
  const ok = await copyText(data.url);
  FX.toast(ok ? okMsg : "فشل النسخ — انسخ الرابط من شريط العنوان", ok); 
}
function shareItem(id){
  const en = ITEMS.get(id); if (!en) return Promise.resolve();
  return shareLink({title: en.it.title, text: en.it.desc || en.it.title, url: Route.itemUrl(id)}, "اتنسخ رابط «" + en.it.title + "» ✓");
}
$("#content").addEventListener("click", e => { const b = e.target.closest(".sharebtn"); if (b) shareItem(b.dataset.share); });
// زرار Copy على كارت البرومبت
$("#content").addEventListener("click", e => {
  const b = e.target.closest(".pcopy"); if (!b) return;
  const it = flat[b.dataset.copy]; if (it) copyWithFeedback(b, it.text || "", [b]);
});

// صورة نتيجة البرومبت لو مفتحتش بنشيلها ويفضل الكارت نصي
$("#content").addEventListener("error", e => { const i = e.target; if (i.tagName === "IMG" && i.closest && i.closest(".pthumb")) { const c = i.closest(".pcard"); i.closest(".pthumb").remove(); if (c) c.classList.remove("has-img"); } }, true);

// لوجو الموقع اللي مش موجود/فشل تحميله: بنبدّله بأيقونة عامة بنفس المقاس (الكارت ميتحركش)
const FICON_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239aa0aa' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpath d='M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18'/%3E%3C/svg%3E";
document.addEventListener("error", e => { const i = e.target; if (i && i.tagName === "IMG" && i.hasAttribute("data-ficon") && !i.hasAttribute("data-fb")) { i.setAttribute("data-fb", ""); i.src = FICON_FALLBACK; } }, true);   // أيقونة كرة أرضية بدل اللوجو: نفس المقاس فمفيش اهتزاز في الكارت
// صورة الفيديو: لو maxres مش موجودة نرجع لـ hqdefault
$("#content").addEventListener("error", e => {
  const i = e.target;
  if (i.tagName !== "IMG" || !i.dataset.fallback) return;
  if (i.src !== i.dataset.fallback) i.src = i.dataset.fallback; else i.style.visibility = "hidden";   // الاتنين فشلوا: نخفي أيقونة الصورة المكسورة
}, true);
// يوتيوب بيرجّع صورة 120x90 رمادية لو maxres مش متاحة — نرجع لـ hqdefault
$("#content").addEventListener("load", e => {
  const i = e.target;
  if (i.tagName === "IMG" && i.dataset.fallback && i.naturalWidth && i.naturalWidth <= 120 && i.src !== i.dataset.fallback) i.src = i.dataset.fallback;
}, true);

// عنوان الفيديو الحقيقي من يوتيوب (oEmbed) للعناصر المعلّمة autoTitle — لو فشل يفضل العنوان الاحتياطي
const ytTitles = new Map();
function fillVideoTitles(){
  document.querySelectorAll("#content [data-yt]").forEach(a => {
    const id = a.dataset.yt, h = a.querySelector("h3"); if (!h) return;
    const put = t => { if (t) { h.textContent = t; const im = a.querySelector("img"); if (im) im.alt = t; } };
    if (ytTitles.has(id)) return put(ytTitles.get(id));
    fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + id))
      .then(r => r.ok ? r.json() : null).then(j => { if (j && j.title) { ytTitles.set(id, j.title); put(j.title); } }).catch(() => {});
  });
}


// «تخطّي إلى المحتوى»: بنركّز على المحتوى من غير ما نغيّر الـ URL (عشان الـ # بتاعنا بيمثّل حالة الصفحة)
document.querySelector(".skip").addEventListener("click", e => { e.preventDefault(); const c = $("#content"); c.focus({preventScroll: true}); c.scrollIntoView({behavior: "auto", block: "start"}); });
// نقطة البداية: بنقرا الحالة من الـ URL (رابط مباشر / بحث / فلاتر) وإلا بنعرض الصفحة الرئيسية
applyRoute(Route.parse(location.hash));

// الشريط يصغر شوية بعد ما الصفحة تنزل (بيبقى لازق تحت الهيدر)
(() => { const bar = $(".cgroup"), mark = $("#navtop"); if (!bar || !mark) return; let on = false;
  const upd = () => { const hd = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--hdr")) || 64, c = mark.getBoundingClientRect().top < hd - 2; if (c !== on) { on = c; bar.classList.toggle("compact", c); } };
  addEventListener("scroll", upd, {passive: true}); addEventListener("resize", upd); upd(); })();

// تلميح السحب الأفقي لشريط الأقسام (موبايل): سهم بيظهر على الطرف اللي فيه أقسام زيادة، والضغط عليه بيحرّك الشريط. مبيغيّرش ارتفاع الشريط.
(() => { const tabs = $("#tabs"), nx = $("#tabsNext"), pv = $("#tabsPrev"), mq = matchMedia("(max-width:700px)"); if (!tabs || !nx || !pv) return;
  const upd = () => { const max = tabs.scrollWidth - tabs.clientWidth, x = Math.abs(tabs.scrollLeft), on = mq.matches && max > 8;
    nx.hidden = !(on && x < max - 8); pv.hidden = !(on && x > 8); };
  const go = dir => tabs.scrollBy({left: dir * tabs.clientWidth * .7, behavior: FX.reduce ? "auto" : "smooth"});
  // RTL: الأقسام الزيادة ناحية الشمال، فالسهم «التالي» بيحرّك الشريط شمال (قيمة سالبة)
  nx.addEventListener("click", () => go(-1)); pv.addEventListener("click", () => go(1));
  tabs.addEventListener("scroll", upd, {passive: true}); addEventListener("resize", upd);
  if ("ResizeObserver" in window) new ResizeObserver(upd).observe(tabs);
  new MutationObserver(upd).observe(tabs, {childList: true}); upd(); })();
