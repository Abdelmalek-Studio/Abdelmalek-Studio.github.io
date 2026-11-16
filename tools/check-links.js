/* فحص سلامة الروابط الخارجية في site/data/data.js
   التشغيل (محتاج إنترنت، Node 18+):  node tools/check-links.js
   بيطبع الروابط اللي مبتفتحش أو بترجّع خطأ. مواقع كتير بتمنع الفحص الآلي (403/429)
   فالنتيجة دي "تنبيه للمراجعة" مش حكم نهائي — افتح الرابط بنفسك قبل ما تحذفه. */
const fs = require("fs"), path = require("path");
const txt = fs.readFileSync(path.join(__dirname, "..", "site/data/data.js"), "utf8");
const D = JSON.parse(txt.replace(/^\/\*[\s\S]*?\*\/\s*/, "").replace(/^window\.STUDIO_DATA\s*=\s*/, "").replace(/;\s*$/, ""));
const items = D.sections.flatMap(s => s.items.filter(i => /^https?:/i.test(i.url || "")).map(i => ({sec: s.id, title: i.title, url: i.url})));
const seen = new Set(), list = items.filter(i => !seen.has(i.url) && seen.add(i.url));
async function check(i) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const r = await fetch(i.url, {method, redirect: "follow", signal: AbortSignal.timeout(12000), headers: {"user-agent": "Mozilla/5.0 link-check"}});
      if (r.ok) return null;
      if (method === "GET") return r.status;
    } catch (e) { if (method === "GET") return e.name === "TimeoutError" ? "timeout" : "unreachable"; }
  }
}
(async () => {
  const bad = []; let n = 0;
  for (let k = 0; k < list.length; k += 8) {
    await Promise.all(list.slice(k, k + 8).map(async i => { const r = await check(i); n++; if (r) bad.push({...i, problem: r}); }));
  }
  console.log(`فُحص ${n} رابط فريد، والمشكلة في ${bad.length}`);
  bad.forEach(b => console.log(`[${b.problem}] ${b.sec} | ${b.title} | ${b.url}`));
  process.exit(bad.length ? 1 : 0);
})();
