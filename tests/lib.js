/* أدوات مشتركة لملفات الاختبار: سيرفر ثابت بمسار فرعي زي GitHub Pages + مساعدات Playwright + عدّاد النتائج.
   السيرفر: /Abdelmalek-Studio/…  ← الموقع (أو نسخة dist لو SITE_DIR متحدد)،  /admin/…  ← لوحة الإدارة،  /site/…  ← site (عشان ../site في اللوحة).
   overrides: {"/path": (req,res)=>true} لو الدالة رجّعت true يبقى هي اللي ردّت (تأخير، 404، ملف بايظ...). */
const {chromium} = require("playwright"); const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.resolve(__dirname, "..");
const SITE_DIR = process.env.SITE_DIR ? path.resolve(process.env.SITE_DIR) : path.join(ROOT, "site");
const PREFIX = process.env.AS_PREFIX || "/Abdelmalek-Studio/";   // الافتراضي مسار فرعي (أصعب حالة)؛ AS_PREFIX=/ يحاكي مستودع <user>.github.io على الجذر
const MIME = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".txt": "text/plain", ".xml": "application/xml", ".json": "application/json"};
const parseData = txt => JSON.parse(txt.replace(/^\/\*[\s\S]*?\*\/\s*/, "").replace(/^window\.STUDIO_DATA\s*=\s*/, "").replace(/;\s*$/, ""));
const loadData = f => parseData(fs.readFileSync(f, "utf8"));
const clone = o => JSON.parse(JSON.stringify(o));
const dataJs = o => "window.STUDIO_DATA=" + JSON.stringify(o) + ";";

function server(overrides = {}) {
  const misses = [];
  const s = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split("?")[0]);
    if (overrides[u] && overrides[u](q, r) === true) return;
    let base, rel;
    if (u.startsWith(PREFIX)) { base = SITE_DIR; rel = u.slice(PREFIX.length); }
    else if (u.startsWith("/admin/")) { base = path.join(ROOT, "admin"); rel = u.slice(7); }
    else if (u.startsWith("/site/")) { base = path.join(ROOT, "site"); rel = u.slice(6); }
    else { misses.push(u); r.writeHead(404); return r.end("nf"); }
    if (!rel || rel.endsWith("/")) rel += "index.html";
    const f = path.join(base, rel);
    if (!f.startsWith(base) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { misses.push(u); r.writeHead(404); return r.end("nf"); }
    r.writeHead(200, {"content-type": MIME[path.extname(f)] || "application/octet-stream"}); fs.createReadStream(f).pipe(r);
  });
  return new Promise(ok => s.listen(0, "127.0.0.1", () => { const o = "http://127.0.0.1:" + s.address().port; ok({srv: s, origin: o, BASE: o + PREFIX, ADMIN: o + "/admin/index.html", misses, close: () => s.close()}); }));
}

function harness(title) {
  const res = []; let browser;
  const T = (name, ok, d = "") => { res.push(!!ok); console.log((ok ? "PASS" : "FAIL") + " | " + name + (d !== "" ? " | " + String(typeof d === "string" ? d : JSON.stringify(d)).slice(0, 300).replace(/\n/g, " ⏎ ") : "")); };
  async function start(overrides) {
    const sv = await server(overrides); browser = await chromium.launch();
    const mk = async (o = {}) => {
      const c = await browser.newContext({viewport: {width: 1280, height: 900}, permissions: ["clipboard-read", "clipboard-write"], acceptDownloads: true, ...o});
      const p = await c.newPage(); p.errs = []; p.dialogs = [];
      p.on("pageerror", e => p.errs.push(e.message));
      p.on("console", m => { if (m.type() === "error" && !/font|ERR_FAILED|youtube|counterapi|ytimg|net::|404|Failed to load resource/i.test(m.text())) p.errs.push(m.text()); });
      p.on("dialog", d => { p.dialogs.push(d.message()); d.accept(); });
      await p.route(/(youtube\.com|counterapi\.dev|ytimg\.com)/, r => r.abort());
      return p;
    };
    return {...sv, mk, browser};
  }
  async function end(env) { if (browser) await browser.close(); if (env) env.close(); const f = res.filter(x => !x).length; console.log(`\n[${title}] TOTAL ${res.length} FAILED ${f}`); process.exit(f ? 1 : 0); }
  return {T, start, end, res};
}
const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), "asf-"));
async function download(page, sel, dir) { const [d] = await Promise.all([page.waitForEvent("download"), page.click(sel)]); const f = path.join(dir, "d" + Math.random().toString(36).slice(2) + ".txt"); await d.saveAs(f); return fs.readFileSync(f, "utf8"); }
const homeN = () => 0;   // الرئيسية = تعريف + الأقسام الرئيسية بس (من غير كروت)
// تنقل بين الأقسام بعد توحيد التصميم (تصنيفات رئيسية ← فرعية): بنفتح القسم من الرابط زي ما المستخدم/الرابط المحفوظ بيعمل
async function go(page, id) { await page.evaluate(i => { location.hash = "#s=" + i; }, id); await page.waitForTimeout(450); }
// عنوان القسم المفتوح حالياً («الكل» لو الرئيسية)
async function curTitle(page) { return page.evaluate(() => { const ss = [...document.querySelectorAll("#content > section.sec")]; if (ss.length !== 1) return "الكل"; const h = ss[0].querySelector("h2").cloneNode(true); h.querySelectorAll("i").forEach(i => i.remove()); return h.textContent.trim(); }); }

module.exports = {homeN, go, curTitle, ROOT, SITE_DIR, PREFIX, parseData, loadData, clone, dataJs, server, harness, tmpdir, download, fs, path, chromium};
