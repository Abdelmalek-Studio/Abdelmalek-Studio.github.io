/* بيبني شكل الكارت لكل نوع عنصر: link / prompt / video / file */
function ytId(url){
  const m = String(url).match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  return m ? m[1] : "";
}
const ytThumb = (url, q = "maxresdefault") => { const id = ytId(url); return id ? `https://img.youtube.com/vi/${id}/${q}.jpg` : ""; };

/* لوجو الموقع (favicon) جنب العنوان: بيتحمّل بس لما الكارت يقرب من الشاشة (lazy)، ولو فشل بيتبدّل بأيقونة عامة بنفس المقاس (شوف مستمع error في app.js) */
const siteHost = u => { try { const x = new URL(String(u ?? "")); return /^https?:$/.test(x.protocol) ? x.hostname : ""; } catch { return ""; } };
const siteIcon = u => { const h = siteHost(u); return h ? `<img class="ficon" data-ficon src="https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(h)}" alt="" width="26" height="26" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ""; };

const TYPE_LABEL = {link:"موقع", prompt:"Prompt", video:"فيديو", file:"ملف"};
// شارات الكارت: السعر (أخضر/أحمر) ثم التصنيف (شارة عادية). لو العنصر ملوش سعر بتظهر شارة التصنيف لوحدها زي الأول
/* لينك غير صالح بيتحوّل لـ # — منفتحوش في تبويب جديد */
const blank = u => safeUrl(u) === "#" ? "" : ' target="_blank" rel="noopener noreferrer"';
const badgesHTML = it => { const p = priceOf(it), c = categoryOf(it); return (p ? `<span class="badge${priceClass(p)}">${esc(p)}</span>` : "") + (c ? `<span class="badge cat">${esc(c)}</span>` : ""); };
function cardHTML(it, idx){
  const tag = `<div class="meta"><span class="kind">${esc(TYPE_LABEL[it.type] || "")}</span>${badgesHTML(it)}</div>`;

  /* Prompt: من بره الاسم والشرح بس — الضغط بيفتح البرومبت كامل جوه نافذة ومنها النسخ */
  if (it.type === "prompt") {
    const pimg = safeImg(it.image);
    const ptag = `<div class="meta"><span class="kind">${esc(TYPE_LABEL.prompt)}</span>${badgesHTML(it)}${it.tool ? `<span class="badge tool" title="الأداة المتوافقة">${esc(it.tool)}</span>` : ""}</div>`;
    return `<div class="card pcard${pimg ? " has-img" : ""}" role="button" tabindex="0" data-open="${idx}" data-id="${esc(it.id || "")}" aria-haspopup="dialog">
      ${pimg ? `<div class="pthumb"><img src="${esc(pimg)}" alt="" loading="lazy"></div>` : ""}<span class="pmark" aria-hidden="true">{ }</span>${ptag}<h3>${esc(it.title)}</h3>${it.desc ? `<p>${esc(it.desc)}</p>` : ""}
      <span class="go">View Prompt ↗</span></div>`;
  }

  /* فيديو يوتيوب: الصورة المصغرة ظاهرة بره، والضغط على الكارت بيفتح الفيديو */
  const vid = it.type === "video" ? ytId(it.url) : "";
  const isChannel = /youtube\.com\/(@|channel\/|c\/|user\/)/i.test(String(it.url));
  const label = it.type === "file" ? "تحميل / فتح ↗" : it.type === "video" ? "مشاهدة على يوتيوب ↗" : isChannel ? "افتح القناة ↗" : "افتح الموقع ↗";
  if (vid) {
    const thumb = `<div class="thumb"><img src="${esc(ytThumb(it.url))}" data-fallback="${esc(ytThumb(it.url, "hqdefault"))}" alt="" loading="lazy"><span class="play" aria-hidden="true"></span></div>`;
    return `<a class="card vcard" data-id="${esc(it.id || "")}"${it.autoTitle ? ` data-yt="${esc(vid)}"` : ""} href="${esc(safeUrl(it.url))}"${blank(it.url)}>${thumb}${tag}
      <h3>${esc(it.title)}</h3>${it.desc ? `<p>${esc(it.desc)}</p>` : ""}<span class="go">${label}</span></a>`;
  }

  /* لينك/ملف: كارت موحّد ونضيف — شارة السعر مثبتة فوق في نفس المكان دايمًا، لوجو الموقع + اسمه في سطر واحد، وسطر وصف واحد بس */
  const pv = priceOf(it);
  const pbadge = pv ? `<span class="pbadge${pv === "مجاني" ? " free" : pv === "مدفوع" ? " paid" : " ltd"}">${esc(pv)}</span>` : "";
  return `<a class="card lcard" data-id="${esc(it.id || "")}" href="${esc(safeUrl(it.url))}"${blank(it.url)}>${pbadge}
    <h3>${siteIcon(it.url)}<span class="t">${esc(it.title)}</span></h3>${it.desc ? `<p>${esc(it.desc)}</p>` : ""}${it.type === "file" ? `<span class="go">${label}</span>` : ""}</a>`;
}

/* كارت صغير للأدوات المميزة: الـ Prompt بيفتح النافذة، والباقي لينك */
function fcardHTML(it, n, attr = "fopen"){
  const p = priceOf(it), c = categoryOf(it), b = p || c;
  const inner = `<strong>${it.type === "prompt" ? "" : siteIcon(it.url)}${esc(it.title)}${b ? `<span class="badge${p ? priceClass(p) : " cat"}">${esc(b)}</span>` : ""}</strong>${it.desc ? `<span class="fd">${esc(it.desc)}</span>` : ""}`;
  return it.type === "prompt"
    ? `<button type="button" class="fcard" data-${attr}="${n}" aria-haspopup="dialog">${inner}</button>`
    : `<a class="fcard" href="${esc(safeUrl(it.url))}"${blank(it.url)}>${inner}</a>`;
}
