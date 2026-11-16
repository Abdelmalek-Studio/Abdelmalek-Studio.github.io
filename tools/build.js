/* بناء نسخة الإنتاج (dist/): نسخة من site/ + ملفات SEO المتولّدة، بالظبط اللي بيتنشر على GitHub Pages.
   التشغيل: node tools/build.js [--out dist] [--github owner/repo]
   بيفشل لو: لقى ملف admin جوه النسخة، أو ملف/صورة مرجعية ناقصة، أو أي مسار مطلق (/…) هيتكسر على GitHub Pages. */
const fs = require("fs"), path = require("path"), {spawnSync} = require("child_process");
const arg = n => { const k = process.argv.indexOf(n); return k > -1 ? process.argv[k + 1] : ""; };
const root = path.join(__dirname, ".."), src = path.join(root, "site"), out = path.resolve(arg("--out") || path.join(root, "dist"));
const fail = m => { console.error("BUILD FAILED: " + m); process.exit(1); };
if (out === src || out === root || !out.startsWith(path.resolve(root))) fail("--out لازم يكون مجلد جوه المشروع غير site/ (مثال: dist)");
fs.rmSync(out, {recursive: true, force: true});
fs.cpSync(src, out, {recursive: true});
const files = []; (function walk(d){ fs.readdirSync(d, {withFileTypes: true}).forEach(f => { const p = path.join(d, f.name); f.isDirectory() ? walk(p) : files.push(p); }); })(out);
const adminLike = files.filter(f => /admin/i.test(path.relative(out, f)));
if (adminLike.length) fail("ملفات admin جوه النسخة: " + adminLike.join(", "));
// المستودع: --github owner/repo (الـ workflow بيمرّر الحقيقي) ← وإلا الاسم المستهدف plannedRepo من tools/seo.config.json (للبناء المحلي) ← وإلا من غير رابط.
// ملاحظة: site/ نفسه مبيتغيّرش ومفيهوش روابط مخترعة؛ الرابط المستهدف بيتكتب في dist/ بس.
let gh = arg("--github"); if (!gh) { try { const c = JSON.parse(fs.readFileSync(process.env.SEO_CONFIG ? path.resolve(process.env.SEO_CONFIG) : path.join(__dirname, "seo.config.json"), "utf8")); if (!c.domain && !c.repo && c.githubUser && c.plannedRepo) gh = c.githubUser + "/" + c.plannedRepo; } catch (e) {} }
const args = [path.join(__dirname, "seo.js"), "--site", out].concat(gh ? ["--github", gh] : []);
const r = spawnSync(process.execPath, args, {encoding: "utf8"}); if (r.status !== 0) fail("seo.js: " + r.stderr + r.stdout);
// فحص المراجع المحلية في index.html و data.js
const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1]).filter(u => !/^(https?:|mailto:|tel:|data:)/i.test(u));
const bad = [];
refs.forEach(u => { if (u.startsWith("/")) bad.push("مسار مطلق (هيتكسر على GitHub Pages): " + u); else if (!fs.existsSync(path.join(out, u.split("?")[0]))) bad.push("ملف ناقص: " + u); });
const D = JSON.parse(fs.readFileSync(path.join(out, "data/data.js"), "utf8").replace(/^\/\*[\s\S]*?\*\/\s*/, "").replace(/^window\.STUDIO_DATA\s*=\s*/, "").replace(/;\s*$/, ""));
const local = p => typeof p === "string" && p.trim() && !/^([a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(p.trim());
const chk = (p, w) => { if (local(p) && !fs.existsSync(path.join(out, p.trim().split("?")[0]))) bad.push(`${w}: ${p}`); else if (typeof p === "string" && p.trim().startsWith("/") && !p.trim().startsWith("//")) bad.push(`${w}: مسار مطلق ${p}`); };
chk(D.site.photo, "site.photo"); chk(D.site.logo, "site.logo");
D.sections.forEach(s => { chk(s.cover, "cover " + s.id); (s.items || []).forEach(i => chk(i.image, "image " + i.id)); });
if (bad.length) fail("\n" + bad.join("\n"));
const final = []; (function walk(d){ fs.readdirSync(d, {withFileTypes: true}).forEach(f => { const p = path.join(d, f.name); f.isDirectory() ? walk(p) : final.push(p); }); })(out);   // بعد seo.js (ممكن يضيف/يشيل sitemap)
const size = final.reduce((n, f) => n + fs.statSync(f).size, 0);
console.log(`BUILD OK → ${out} (${final.length} ملف، ${(size / 1024).toFixed(0)}KB)${gh ? " | github=" + gh : ""}`);
