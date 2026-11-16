/* الإبلاغ عن رابط لا يعمل — من غير سيرفر ولا خدمة خارجية:
   بيجهّز رسالة فيها اسم الأداة واللينك ولينك الموقع، وصاحب الموقع يستلمها على واتساب (من زرار واتساب الموجود في بيانات الموقع)
   أو إيميل (لو متحدد site.reportEmail أو زرار mailto في السوشيال)، أو الزائر ينسخها ويبعتها بأي طريقة. */
const Report = (() => {
  let el, cur = null, lastFocus = null;
  const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
  function targets(){
    const S = (typeof SITE !== "undefined" && SITE) || {}, out = {wa: "", mail: ""};
    (S.socials || []).forEach(s => {
      const u = String(s && s.url || "").trim();
      const m = u.match(/^https:\/\/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?(\d{6,15})/i);
      if (m && !out.wa) out.wa = m[1];
      if (/^mailto:/i.test(u) && !out.mail) { const a = u.slice(7).split("?")[0]; if (EMAIL_RE.test(a)) out.mail = a; }
    });
    if (typeof S.reportEmail === "string" && EMAIL_RE.test(S.reportEmail.trim())) out.mail = S.reportEmail.trim();
    return out;
  }
  const message = it => `بلاغ عن رابط لا يعمل — ${(typeof SITE !== "undefined" && (SITE.nameEn || SITE.name)) || ""}\nالأداة: ${it.title}\nالرابط: ${it.url}\nفي الموقع: ${Route.itemUrl(it.id)}`;
  function build(){
    el = document.createElement("div"); el.className = "modal"; el.hidden = true;
    el.innerHTML = `<div class="modal-back" data-close></div>
      <div class="modal-box rep" role="dialog" aria-modal="true" aria-labelledby="rTitle">
        <div class="modal-head"><div class="meta"><span class="kind">بلاغ</span></div>
          <button type="button" class="modal-x" data-close aria-label="إغلاق" title="إغلاق">✕</button></div>
        <h2 id="rTitle">الإبلاغ عن رابط لا يعمل</h2>
        <p class="modal-desc" id="rItem"></p>
        <pre class="pcode rmsg" id="rMsg" dir="auto" tabindex="0"></pre>
        <p class="rhint" id="rHint"></p>
        <div class="ractions" id="rActions"></div>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) { close(); return; }
      const c = e.target.closest("[data-rcopy]");
      if (c && cur) copyText(message(cur)).then(ok => { if (typeof FX !== "undefined") FX.toast(ok ? "اتنسخ نص البلاغ ✓" : "فشل النسخ — حدد النص وانسخه يدويًا", ok); });
    });
    document.addEventListener("keydown", e => {
      if (el.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === "Tab") {
        const f = [...el.querySelectorAll("button, a[href], pre")].filter(x => !x.disabled && x.offsetParent !== null);
        if (!f.length) return;
        const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    }, true);
  }
  function open(it, trigger){
    if (!el) build();
    cur = it; lastFocus = trigger || document.activeElement;
    const t = targets(), msg = message(it), q = encodeURIComponent(msg);
    el.querySelector("#rItem").textContent = it.title + " — " + it.url;
    el.querySelector("#rMsg").textContent = msg;
    const acts = [];
    if (t.wa) acts.push(`<a class="copy rbtn" href="${esc("https://wa.me/" + t.wa + "?text=" + q)}" target="_blank" rel="noopener noreferrer">إرسال على واتساب</a>`);
    if (t.mail) acts.push(`<a class="copy rbtn" href="${esc("mailto:" + t.mail + "?subject=" + encodeURIComponent("بلاغ عن رابط لا يعمل: " + it.title) + "&body=" + q)}">إرسال بالإيميل</a>`);
    acts.push(`<button type="button" class="copy rbtn alt" data-rcopy>نسخ نص البلاغ</button>`);
    el.querySelector("#rActions").innerHTML = acts.join("");
    el.querySelector("#rHint").textContent = (t.wa || t.mail) ? "هتفتح رسالة جاهزة تبعتها بنفسك — مفيش حاجة بتتبعت تلقائيًا ومفيش بيانات بتتجمع." : "انسخ النص وابعته لصاحب الموقع على أي حساب تواصل من أسفل الصفحة.";
    el.hidden = false; document.documentElement.classList.add("modal-open");
    requestAnimationFrame(() => el.classList.add("show"));
    (el.querySelector(".rbtn") || el.querySelector(".modal-x")).focus({preventScroll: true});
  }
  function close(){
    if (!el || el.hidden) return;
    el.classList.remove("show"); el.hidden = true; cur = null;
    if (!(typeof PromptModal !== "undefined" && PromptModal.isOpen)) document.documentElement.classList.remove("modal-open");
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({preventScroll: true}); } catch (e) {} }
  }
  return {open, close, message, targets, get isOpen(){ return !!el && !el.hidden; }};
})();
