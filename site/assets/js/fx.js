/* المؤثرات (من غير أي صوت — الصوت اتشال نهائيًا): الإشعار (toast)، ظهور العناصر عند النزول، شريط التقدم، زر الرجوع لأعلى، ريبل الأزرار.
   كل حاجة هنا اختيارية: لو حصل خطأ أو المتصفح قديم الموقع بيشتغل عادي.
   - الحركة بتتقفل تلقائيًا لو الجهاز عامل "تقليل الحركة" (prefers-reduced-motion). */
const FX = (() => {
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k){ try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
  };

  function haptic(ms){ try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  /* ---------- Toast ---------- */
  let toastT;
  function toast(msg, ok = true){
    const t = document.getElementById("toast"); if (!t) return;
    t.textContent = msg; t.className = "toast show " + (ok ? "ok" : "bad");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 1800);
  }

  /* ---------- ظهور العناصر عند النزول ---------- */
  let io = null;
  function reveal(root, instant){
    const els = root.querySelectorAll(".sec-head, .card");
    if (instant || reduce || !("IntersectionObserver" in window)) return;   // وقت البحث: من غير حركة عشان ميرمّش
    if (!io) io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), {threshold: 0.12, rootMargin: "0px 0px -6% 0px"});
    els.forEach((el, i) => { el.classList.add("reveal"); el.style.setProperty("--d", (i % 4) * 70 + "ms"); io.observe(el); });
  }

  /* ---------- الهيدر / التقدم / لأعلى / ارتفاع الشريط الثابت ---------- */
  function layout(){
    const h = document.querySelector("header.top");
    if (h) document.documentElement.style.setProperty("--hdr", h.offsetHeight + "px");
  }
  function onScroll(){
    const y = window.scrollY, max = document.documentElement.scrollHeight - innerHeight;
    const p = document.getElementById("progress"); if (p) p.style.transform = "scaleX(" + (max > 0 ? Math.min(1, y / max) : 0) + ")";
    const h = document.querySelector("header.top"); if (h) h.classList.toggle("scrolled", y > 8);
    const t = document.getElementById("totop"); if (t) t.classList.toggle("show", y > 600);
  }

  /* ---------- ريبل على الأزرار ---------- */
  function ripple(e){
    if (reduce) return;
    const b = e.target.closest(".copy, .chip"); if (!b) return;
    const r = b.getBoundingClientRect(), s = document.createElement("span");
    const d = Math.max(r.width, r.height);
    s.className = "ripple"; s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    b.appendChild(s); setTimeout(() => s.remove(), 600);
  }

  function init(){
    layout(); onScroll();
    addEventListener("resize", layout); addEventListener("scroll", onScroll, {passive: true});
    // ارتفاع الهيدر ممكن يتغير بعد تحميل الخط أو لو الأسطر اتكسرت — نحدّث --hdr عشان التابات الثابتة تفضل لازقة تحته
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    const hd = document.querySelector("header.top");
    if (hd && "ResizeObserver" in window) new ResizeObserver(layout).observe(hd);
    const tt = document.getElementById("totop");
    if (tt) tt.addEventListener("click", () => { window.scrollTo({top: 0, behavior: reduce ? "auto" : "smooth"}); });
    document.addEventListener("pointerdown", ripple);
    document.addEventListener("keydown", e => {            // "/" يفتح البحث
      if (e.key === "/" && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) { e.preventDefault(); const q = document.getElementById("q"); if (q) q.focus(); }
    });
  }
  init();
  return {toast, reveal, haptic, reduce, layout};
})();
