/* بيجيب عناوين فيديوهات يوتيوب الحقيقية (oEmbed) ويكتبها في site/data/data.js للعناصر النوع video اللي عنوانها لسه احتياطي.
   ليه؟ عشان العنوان الحقيقي يظهر في البحث والمفضلة والـ SEO و<noscript> من غير ما يعتمد على طلب لايف من الزائر.
   التشغيل (محتاج إنترنت، Node 18+):  node tools/fetch-yt-titles.js [--all]
   من غير --all: بيحدّث بس العناوين الاحتياطية («فيديو من القناة» أو الفاضية). مع --all: بيحدّث كل الفيديوهات.
   الخطوات بعده: ① node tools/seo.js (بيحدّث قسم <noscript> وJSON-LD جوه site/index.html) ② npm run build (لو عايز تجرّب dist/ محليًا) ③ ارفع التغيير على GitHub — النشر بيشغّل seo + build تلقائي.
   آمن: الأداة بتغيّر حقل title بس لعناصر الفيديو، ولو فشل الطلب للفيديو بيفضل عنوانه القديم، ولو فشلت كل الطلبات الملف بيفضل زي ما هو. حقل autoTitle بيفضل زي ما هو. */
const fs = require("fs"), path = require("path");
const file = path.join(__dirname, "..", "site/data/data.js");
const raw = fs.readFileSync(file, "utf8");
const head = (raw.match(/^\/\*[\s\S]*?\*\/\s*/) || [""])[0];
const D = JSON.parse(raw.replace(/^\/\*[\s\S]*?\*\/\s*/, "").replace(/^window\.STUDIO_DATA\s*=\s*/, "").replace(/;\s*$/, ""));
const all = process.argv.includes("--all"), GENERIC = ["", "فيديو من القناة"];
const ytId = u => (String(u).match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/) || [])[1] || "";
(async () => {
  let changed = 0, failed = 0;
  for (const s of D.sections) for (const it of s.items || []) {
    if (it.type !== "video") continue;
    const id = ytId(it.url); if (!id) continue;
    if (!all && !GENERIC.includes(String(it.title || "").trim())) continue;
    try {
      const r = await fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + id), {signal: AbortSignal.timeout(12000)});
      const j = r.ok ? await r.json() : null;
      if (j && typeof j.title === "string" && j.title.trim()) { it.title = j.title.trim(); changed++; console.log("✔", id, "→", it.title); }
      else { failed++; console.log("✘", id, "HTTP", r.status); }
    } catch (e) { failed++; console.log("✘", id, e.name); }
  }
  if (changed) fs.writeFileSync(file, head + "window.STUDIO_DATA = " + JSON.stringify(D, null, 2) + ";\n");
  console.log(`اتحدّث ${changed} عنوان، وفشل ${failed}.` + (changed ? " الخطوات بعده: node tools/seo.js ثم (اختياري) npm run build ثم ارفع التغيير." : ""));
  process.exit(failed ? 1 : 0);
})();
