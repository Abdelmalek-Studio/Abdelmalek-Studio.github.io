/* زرار الوضع الفاتح / الغامق — الاختيار بيتحفظ في المتصفح (الافتراضي: غامق) */
(() => {
  const b = document.getElementById("theme"); if (!b) return;
  const root = document.documentElement, meta = document.querySelector('meta[name="theme-color"]');
  const ico = p => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const SUN = ico('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>');
  const MOON = ico('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>');
  const light = () => root.getAttribute("data-theme") === "light";
  function paint(){
    const t = light() ? "التبديل للوضع الغامق" : "التبديل للوضع الفاتح";
    b.title = t; b.setAttribute("aria-label", t); b.innerHTML = light() ? MOON : SUN;
    if (meta) meta.content = light() ? "#f6f4ee" : "#0c0c10";
  }
  b.addEventListener("click", () => {
    const n = light() ? "dark" : "light";
    root.setAttribute("data-theme", n);
    try { localStorage.setItem("theme", n); } catch (e) {}
    paint();
    
  });
  paint();
})();
