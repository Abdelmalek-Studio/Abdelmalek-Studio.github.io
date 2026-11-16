/* حالة الصفحة في الـ URL (بعد علامة #): بتخلّي البحث والفلاتر والقسم والعنصر المفتوح قابلين للمشاركة والرجوع بالمتصفح.
   من غير سيرفر ومن غير صفحات منفصلة — شغّال على GitHub Pages (وعلى file:// كمان).
   الصيغة:  #i=itm-xxxx                       ← عنصر واحد (رابط مباشر)
            #s=قسم&t=link&p=مجاني&c=صور&q=كلمة ← قسم / نوع / سعر / تصنيف / بحث
            #v=fav&g=g-abc123  /  #v=new       ← مفضلاتي (ومجموعة) / آخر الإضافات
   القديم #sectionId لسه بيتفتح. القيم بتتفحص قبل الاستخدام (مفيش HTML ولا كود بيتبني من الـ URL). */
const Route = (() => {
  const KEYS = ["i", "v", "s", "t", "p", "c", "q", "g"];
  function parse(hash){
    let h = String(hash ?? "").replace(/^#/, ""); const o = {};
    if (!h) return o;
    if (!h.includes("=")) { try { o.s = decodeURIComponent(h).slice(0, 80); } catch (e) {} return o; }   // رابط قديم: #sectionId
    let sp; try { sp = new URLSearchParams(h); } catch (e) { return o; }
    KEYS.forEach(k => { const v = sp.get(k); if (v && v.trim()) o[k] = v.trim().slice(0, 200); });
    return o;
  }
  function build(o){
    const sp = new URLSearchParams();
    KEYS.forEach(k => { if (o && o[k]) sp.set(k, o[k]); });
    const s = sp.toString(); return s ? "#" + s : "";
  }
  const base = () => location.href.split("#")[0];
  return {
    parse, build,
    pageUrl: o => base() + build(o),
    itemUrl: id => base() + build({i: id}),
    // بيكتب الـ URL من غير ما يعمل تحميل للصفحة. push = خطوة جديدة في سجل المتصفح، replace = تعديل الخطوة الحالية
    write(o, mode){
      const h = build(o); if (h === (location.hash || "")) return;
      const url = location.pathname + location.search + h;
      try { history[mode === "push" ? "pushState" : "replaceState"](null, "", url); }
      catch (e) { try { if (mode === "push") location.hash = h; else location.replace(h || "#"); } catch (e2) {} }   // بعض المتصفحات بتمنع history API على file://
    }
  };
})();
