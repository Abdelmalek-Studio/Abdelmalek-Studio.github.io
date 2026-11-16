/* نافذة عرض الـ Prompt: الاسم والشرح والنص كامل بتنسيق مقروء، وزرار النسخ من جوه.
   التنسيق للعرض بس — النسخ بياخد النص الأصلي بالحرف. */
const PromptModal = (() => {
  let el, cur = null, lastFocus = null;

  // تلوين JSON (مفاتيح / نصوص / أرقام / true-false) — بيشتغل على النص الأصلي من غير ما يغيّره
  function colorJSON(t){
    return t.replace(/("(?:\\.|[^"\\\n])*")(\s*:)?|\b(true|false|null)\b|-?\b\d+(?:\.\d+)?\b|[^"\w-]+|[\w-]+/g, (m, str, colon, kw) => {
      if (str) return colon ? `<span class="tk-key">${esc(str)}</span>${esc(colon)}` : `<span class="tk-str">${esc(str)}</span>`;
      if (kw) return `<span class="tk-kw">${esc(m)}</span>`;
      if (/^-?\d/.test(m)) return `<span class="tk-num">${esc(m)}</span>`;
      return esc(m);
    });
  }
  // نص عادي: العناوين الكابيتال (PRIMARY OBJECTIVE / 1. ANALYZE ...) بتتميّز
  function colorText(t){
    return t.split("\n").map(line => {
      const s = line.trim();
      const head = s.length > 3 && s.length < 90 && /[A-Z]{3}/.test(s) && s === s.toUpperCase() && /^(\d+[.)]\s*)?[A-Z]/.test(s);
      return head ? `<span class="tk-head">${esc(line)}</span>` : esc(line);
    }).join("\n");
  }
  function format(text){
    const t = String(text ?? "");
    const s = t.trim();
    if (/^[\[{]/.test(s)) { try { JSON.parse(s); return {html: colorJSON(t), kind: "JSON"}; } catch (e) { /* مش JSON سليم → نص عادي */ } }
    return {html: colorText(t), kind: "Text"};
  }

  function build(){
    el = document.createElement("div");
    el.className = "modal"; el.hidden = true;
    el.innerHTML = `<div class="modal-back" data-close></div>
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="mTitle">
        <div class="modal-head">
          <div class="meta" id="mMeta"></div>
          <button type="button" class="modal-x" data-close aria-label="إغلاق" title="إغلاق">✕</button>
        </div>
        <h2 id="mTitle"></h2>
        <img class="modal-img" id="mImg" alt="" hidden>
        <p class="modal-desc" id="mDesc"></p>
        <div class="pbar"><span class="pbar-title">Prompt <em id="mKind"></em></span>
          <button type="button" class="copy mini-copy" id="mCopyTop">Copy Prompt</button></div>
        <pre class="pcode" id="mCode" dir="ltr" tabindex="0"></pre>
        <div class="modal-foot"><button type="button" class="copy" id="mCopy">Copy Prompt</button><button type="button" class="copy alt" id="mShare" title="نسخ أو مشاركة رابط مباشر للبرومبت">مشاركة الرابط</button></div>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener("click", e => { if (e.target.closest("[data-close]")) close(); });
    document.addEventListener("keydown", e => {
      if (el.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "Tab") {                                  // نخلّي الـ Tab جوه النافذة
        const f = [...el.querySelectorAll("button, pre")].filter(x => !x.disabled && x.offsetParent !== null);
        if (!f.length) return;
        const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    });
    // النسخ من جوه النافذة (الزرارين)
    el.addEventListener("click", e => {
      if (e.target.closest("#mShare")) { if (cur && api.onShare) api.onShare(cur); return; }
      const b = e.target.closest(".copy"); if (!b || !cur) return;
      copyWithFeedback(b, cur.text || "", [$("#mCopy"), $("#mCopyTop")]);
    });
  }

  function open(it, trigger){
    if (!el) build();
    if (cur && cur !== it) { /* نافذة تانية مفتوحة: بنبدّل المحتوى بس */ }
    cur = it; lastFocus = trigger || document.activeElement;
    $("#mMeta").innerHTML = `<span class="kind">Prompt</span>${badgesHTML(it)}${it.tool ? `<span class="badge tool" title="الأداة المتوافقة">${esc(it.tool)}</span>` : ""}`;
    const im = $("#mImg"), src = safeImg(it.image);
    im.hidden = !src; im.onerror = () => { im.hidden = true; }; if (src) im.src = src; else im.removeAttribute("src");
    $("#mTitle").textContent = it.title || "";
    const d = $("#mDesc"); d.textContent = it.desc || ""; d.hidden = !it.desc;
    const f = format(it.text);
    $("#mCode").innerHTML = f.html; $("#mCode").scrollTop = 0;
    $("#mKind").textContent = f.kind;
    el.hidden = false;
    document.documentElement.classList.add("modal-open");
    requestAnimationFrame(() => el.classList.add("show"));
    $("#mCopy").focus({preventScroll: true});
  }
  function close(){
    if (!el || el.hidden) return;
    el.classList.remove("show"); el.hidden = true; cur = null;
    document.documentElement.classList.remove("modal-open");
    if (api.onClose) api.onClose();
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({preventScroll: true}); } catch (e) {} }
  }
  const api = {open, close, onClose: null, onShare: null, get isOpen(){ return !!el && !el.hidden; }};
  return api;
})();
