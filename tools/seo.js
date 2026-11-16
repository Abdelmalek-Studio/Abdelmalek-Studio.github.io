/* SEO تلقائي من بيانات الموقع (site/data/data.js) — من غير مكتبات:
   1) Structured Data (JSON-LD: WebSite + Person) وقائمة روابط جوه <noscript> عشان المحركات والمتصفحات من غير JavaScript.
   2) لو حددت الدومين: canonical + og:url + og:image + twitter:image (لينكات كاملة) + sitemap.xml + سطر Sitemap في robots.txt.
   التشغيل:
     node tools/seo.js                              ← يحدّث JSON-LD والـ noscript (والدومين لو متحدد)
     node tools/seo.js --domain https://example.com ← دومين مخصص (بيتحفظ في tools/seo.config.json) وليه الأولوية
     node tools/seo.js --domain ""                  ← يشيل الدومين المخصص
     node tools/seo.js --repo اسم-المستودع          ← بعد ما تنشئ الـ Repository: بيحسب رابط GitHub Pages لوحده ويحفظ الاسم
     node tools/seo.js --github owner/repo          ← نفس الفكرة من غير حفظ (بيستخدمه الـ workflow وقت النشر من GITHUB_REPOSITORY)
   ترتيب الأولوية: --domain / domain المحفوظ  ←  --github أو repo المحفوظ  ←  من غير دومين (مفيش canonical ولا sitemap، ومفيش روابط وهمية).
   GitHub Pages: لو اسم المستودع = <المستخدم>.github.io بيتنشر على جذر الدومين، وإلا على <المستخدم>.github.io/<المستودع>/.
   الأمر آمن للتكرار (idempotent): نفس الإعدادات = نفس الملفات بالظبط في كل تشغيل، وبيشتغل تلقائي مع كل نشر على GitHub Pages. */
const fs = require("fs"), path = require("path");
const siteArg = (() => { const k = process.argv.indexOf("--site"); return k > -1 ? process.argv[k + 1] : ""; })();   // --site <مجلد>: بيشتغل على نسخة بناء (dist) بدل site/
const root = siteArg ? path.resolve(siteArg) : path.join(__dirname, "..", "site"), cfgPath = process.env.SEO_CONFIG ? path.resolve(process.env.SEO_CONFIG) : path.join(__dirname, "seo.config.json");   // SEO_CONFIG: ملف إعدادات بديل (بيستخدمه الاختبار)
const read = p => fs.readFileSync(p, "utf8");
const D = JSON.parse(read(path.join(root, "data/data.js")).replace(/^\/\*[\s\S]*?\*\/\s*/, "").replace(/^window\.STUDIO_DATA\s*=\s*/, "").replace(/;\s*$/, ""));
const S = D.site || {};
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));

// ---- الإعدادات: githubUser (حساب GitHub) + repo (اسم المستودع بعد إنشائه) + domain (دومين مخصص، اختياري)
let cfg = {githubUser: "Abdelmalek-Studio", repo: "", plannedRepo: "", domain: ""};   // repo: المستودع الفعلي (فاضي لحد ما يتعمل)؛ plannedRepo: الاسم المستهدف — بيستخدمه tools/build.js بس لنسخة dist/
try { cfg = {...cfg, ...JSON.parse(read(cfgPath))}; } catch (e) {}
const arg = name => { const k = process.argv.indexOf(name); return k > -1 ? (process.argv[k + 1] || "").trim() : null; };
const fail = m => { console.error(m); process.exit(1); };
const normDomain = d => d.replace(/\/+$/, "") + "/";
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
let dirty = false;
const argDomain = arg("--domain");
if (argDomain !== null) {
  if (argDomain && !/^https:\/\/[a-z0-9.-]+(:\d+)?(\/[\w\-./]*)?$/i.test(argDomain)) fail("الدومين لازم يبدأ بـ https:// (مثال: https://abdelmalek.studio أو https://user.github.io/repo)");
  cfg.domain = argDomain ? normDomain(argDomain) : ""; dirty = true;
}
const argRepo = arg("--repo");
if (argRepo !== null) {
  if (argRepo && !REPO_RE.test(argRepo)) fail("اسم المستودع غلط: حروف إنجليزي وأرقام و - و _ و . بس.");
  cfg.repo = argRepo; dirty = true;
}
if (dirty) fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");   // بنحافظ على كل الحقول (منها plannedRepo اللي بيستخدمه build.js)

// رابط GitHub Pages: مستودع <user>.github.io ← جذر الدومين، وأي مستودع تاني ← /<repo>/ (الدومين دايمًا بحروف صغيرة)
function githubPagesUrl(owner, repo){
  if (!owner || !repo || !REPO_RE.test(owner) || !REPO_RE.test(repo)) return "";
  const host = owner.toLowerCase() + ".github.io";
  return "https://" + host + "/" + (repo.toLowerCase() === host ? "" : repo + "/");
}
let domain = cfg.domain ? normDomain(cfg.domain) : "";
if (!domain) {
  const gh = arg("--github");                                                    // owner/repo (من الـ workflow)
  if (gh) { const [o, r] = gh.split("/"); domain = githubPagesUrl(o, r); }
  else if (cfg.repo) domain = githubPagesUrl(cfg.githubUser, cfg.repo);
}

// ---- JSON-LD
const sameAs = (S.socials || []).map(s => s.url).filter(u => /^https:\/\//i.test(u) && !/wa\.me|whatsapp/i.test(u));
const graph = [
  {"@type": "WebSite", "name": S.nameEn || S.name, "alternateName": S.name, "inLanguage": "ar", "description": S.tagline || "", ...(domain ? {"url": domain} : {})},
  {"@type": "Person", "name": S.owner || S.name, "jobTitle": "Graphic Designer", ...(domain ? {"url": domain} : {}), "sameAs": sameAs}
];
const jsonld = `<script type="application/ld+json">${JSON.stringify({"@context": "https://schema.org", "@graph": graph}).replace(/</g, "\\u003c")}</script>`;

// ---- أجزاء <head>
const head = [jsonld];
if (domain) {
  const img = domain + "assets/img/og-image.jpg";
  head.push(`<link rel="canonical" href="${esc(domain)}">`, `<meta property="og:url" content="${esc(domain)}">`, `<meta property="og:image" content="${esc(img)}">`,
    `<meta property="og:image:width" content="1200">`, `<meta property="og:image:height" content="630">`, `<meta property="og:image:alt" content="${esc(S.nameEn || S.name)}">`, `<meta name="twitter:image" content="${esc(img)}">`);
}

// ---- <noscript>: قائمة بكل الأقسام والروابط
const sections = (D.sections || []).filter(s => (s.items || []).length).map(s => {
  const li = s.items.map(it => {
    const u = /^https?:\/\//i.test(it.url || "") ? it.url : "";
    return `<li>${u ? `<a href="${esc(u)}" rel="noopener noreferrer">${esc(it.title)}</a>` : esc(it.title)}${it.desc ? " — " + esc(it.desc) : ""}</li>`;
  }).join("");
  return `<h2>${esc(s.title)}</h2>${s.desc ? `<p>${esc(s.desc)}</p>` : ""}<ul>${li}</ul>`;
}).join("");
const noscript = `<noscript><section class="nojs" style="max-width:900px;margin:24px auto;padding:0 16px;line-height:1.9"><h1>${esc(S.nameEn || S.name)}</h1><p>${esc(S.tagline || "")}</p><p>الموقع محتاج JavaScript عشان يعرض البحث والفلاتر. دي قائمة بكل المصادر:</p>${sections}</section></noscript>`;

// ---- بنكتب في index.html بين العلامات
let html = read(path.join(root, "index.html"));
const put = (name, body) => {
  const re = new RegExp(`<!-- seo:${name}:start -->[\\s\\S]*?<!-- seo:${name}:end -->`);
  if (!re.test(html)) throw new Error("علامة seo:" + name + " مش موجودة في index.html");
  html = html.replace(re, () => `<!-- seo:${name}:start -->\n${body}\n<!-- seo:${name}:end -->`);
};
put("head", head.join("\n")); put("noscript", noscript);
fs.writeFileSync(path.join(root, "index.html"), html);

// ---- sitemap + robots
const robotsPath = path.join(root, "robots.txt"), smPath = path.join(root, "sitemap.xml");
// تاريخ آخر تعديل: أحدث تاريخ في المحتوى (added / updates)، مش تاريخ التشغيل — عشان نفس الإعدادات تدّي نفس الملف دايمًا. لو مفيش تواريخ بنسيبه
const dates = [...(D.sections || []).flatMap(s => (s.items || []).map(i => i.added)), ...(D.updates || []).map(u => u && u.date)].filter(d => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(d + "T00:00:00Z").toISOString().slice(0, 10) === d).sort();
const lastmod = dates.length ? dates[dates.length - 1] : "";
// robots.txt: بنشيل بس السطور اللي الأداة بتكتبها (Sitemap والتعليقات بتاعتها بكل صيغها القديمة) وبنسيب أي تعليمات تانية زي ما هي، وبعدين بنضيف السطر المناسب مرة واحدة
const MANAGED = /^\s*#?\s*Sitemap:/i, MANAGED_NOTE = /^\s*#\s*(بعد تحديد الدومين شغّل|أضف سطر Sitemap)/;
const kept = read(robotsPath).replace(/\r\n/g, "\n").split("\n").filter(l => !MANAGED.test(l) && !MANAGED_NOTE.test(l));
while (kept.length && !kept[kept.length - 1].trim()) kept.pop();
let robots = kept.join("\n") + "\n";
if (domain) {
  fs.writeFileSync(smPath, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${esc(domain)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n`);
  robots += `Sitemap: ${domain}sitemap.xml\n`;
} else {
  try { fs.unlinkSync(smPath); } catch (e) {}
  robots += "# بعد تحديد الدومين شغّل: node tools/seo.js --repo اسم-المستودع  (أو --domain https://YOUR-DOMAIN) وهيضيف canonical وsitemap وسطر Sitemap هنا\n";
}
fs.writeFileSync(robotsPath, robots);
console.log(domain ? "الدومين: " + domain : "من غير دومين (JSON-LD و noscript بس)", "— الأقسام:", (D.sections || []).length);
