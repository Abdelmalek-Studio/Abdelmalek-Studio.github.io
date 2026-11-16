/* عدّاد الزوار: خدمة عدّ مجانية من بره (CounterAPI) من غير أي حساب.
   - بيعدّ كل جهاز مرة واحدة بس (بيفتكر ده في المتصفح)
   - مبيعدّش لما تفتح الملف من جهازك (file://) ولا على localhost
   - لو الخدمة مش شغالة، العدّاد بيتخفي والموقع يكمّل عادي */
(function(){
  const box = document.getElementById("visitors"); if (!box) return;
  if (typeof SITE !== "undefined" && SITE && SITE.visitors === false) return;   // مقفول من لوحة الإدارة (إعداد «عدّاد الزوار»)
  if (!/^https?:$/.test(location.protocol) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  const BASE = "https://api.counterapi.dev/v1/abdelmalek-studio-site/visitors";
  let seen = false; try { seen = localStorage.getItem("as-visited") === "1"; } catch (e) {}
  const ctl = new AbortController(); setTimeout(() => ctl.abort(), 6000);
  fetch(BASE + (seen ? "" : "/up"), {signal: ctl.signal})
    .then(r => r.ok ? r.json() : null)
    .then(j => {
      const n = j && (j.count ?? j.value); if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return;   // أي قيمة مش رقم سليم بتتتجاهل (مفيش HTML من الخدمة بيتعرض)
      if (!seen) { try { localStorage.setItem("as-visited", "1"); } catch (e) {} }
      box.innerHTML = `<span aria-hidden="true">👁</span> عدد الزوار: <b>${n.toLocaleString("en-US")}</b>`;
      box.hidden = false;
    }).catch(() => {});
})();
