/* يشغّل كل ملفات الاختبار ويطبع جدول: قديم/جديد، نجح/فشل، وأي اختبار ما اتنفّذش. التشغيل: node tests/run-all.js [--quick] [--no-prod]
   --quick: من غير e2e (الأطول، حوالي 5 دقايق).  --no-prod: من غير إعادة تشغيل المجموعات على dist/.
   لو اختبار انهار (CRASH) أو ما طبعش TOTAL بيتحسب «لم يكتمل» ويفشّل التشغيل — مفيش اختبار بيتخفى. */
const {spawnSync} = require("child_process"), fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.resolve(__dirname, ".."), quick = process.argv.includes("--quick"), noProd = process.argv.includes("--no-prod");
const LOGS = process.env.TEST_LOG_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "as-tests-"));
const SUITES = [
  {f: "e2e.js", kind: "قديم", skip: quick}, {f: "features.js", kind: "قديم"},
  {f: "migration.js", kind: "جديد"}, {f: "routing.js", kind: "جديد"}, {f: "favorites.js", kind: "جديد"}, {f: "whatsnew.js", kind: "جديد"},
  {f: "search-filters.js", kind: "جديد"}, {f: "sections.js", kind: "جديد"}, {f: "admin.js", kind: "جديد"}, {f: "magnific.js", kind: "جديد"}, {f: "design.js", kind: "جديد"}, {f: "images.js", kind: "جديد"}, {f: "security.js", kind: "جديد"}, {f: "production.js", kind: "جديد (إنتاج)"},
];
const PROD = ["routing.js", "favorites.js", "whatsnew.js", "search-filters.js", "sections.js", "design.js"];     // المجموعات اللي بتقرا الموقع من SITE_DIR
const rows = [];
function run(f, label, kind, env = {}, skip = false, plain = false) {
  if (skip) { rows.push({label, kind, total: 0, failed: 0, state: "لم يُنفَّذ (--quick)"}); return; }
  const t = Date.now(); const r = spawnSync(process.execPath, [path.join(__dirname, f)], {cwd: ROOT, env: {...process.env, ...env}, encoding: "utf8", maxBuffer: 1 << 28});
  const out = (r.stdout || "") + (r.stderr || ""); fs.writeFileSync(path.join(LOGS, label.replace(/[^\w.-]+/g, "_") + ".log"), out);
  const m = [...out.matchAll(/TOTAL\s+(\d+)\s+FAILED\s+(\d+)/g)].pop(), total = m ? +m[1] : 0, failed = m ? +m[2] : (plain && r.status !== 0 ? 1 : 0), crashed = plain ? false : (!m || /CRASH/.test(out));
  rows.push({label, kind, total, failed, state: crashed ? "لم يكتمل (انهار)" : failed ? "فشل" : "نجح", secs: Math.round((Date.now() - t) / 1000)});
  console.log(`${label.padEnd(34)} ${String(total).padStart(4)} اختبار | فشل ${failed} | ${rows[rows.length - 1].state} | ${rows[rows.length - 1].secs}s`);
}
if (!fs.existsSync(path.join(ROOT, "node_modules/playwright")) && !process.env.NODE_PATH) console.warn("تنبيه: playwright مش متسطّب (npm install) أو NODE_PATH مش متظبط.");
run("../tools/check-syntax.js", "tools/check-syntax", "فحص", {}, false, true);   // مش اختبارات Playwright: النجاح = exit 0
SUITES.forEach(s => run(s.f, s.f, s.kind, {}, s.skip));
if (!noProd) { const b = spawnSync(process.execPath, [path.join(ROOT, "tools/build.js"), "--github", "Abdelmalek-Studio/Abdelmalek-Studio.github.io"], {encoding: "utf8"}); if (b.status !== 0) { console.error("BUILD FAILED\n" + b.stdout + b.stderr); rows.push({label: "build dist", kind: "إنتاج", total: 0, failed: 1, state: "فشل"}); } else PROD.forEach(f => run(f, f + "  [على dist/]", "جديد (إنتاج)", {SITE_DIR: path.join(ROOT, "dist")})); }
const sum = k => rows.filter(r => r.kind.startsWith(k));
const tot = a => a.reduce((n, r) => ({t: n.t + r.total, f: n.f + r.failed}), {t: 0, f: 0});
const old = tot(sum("قديم")), neu = tot(rows.filter(r => r.kind.startsWith("جديد")));
console.log(`\nالقديم: ${old.t} اختبار، نجح ${old.t - old.f}، فشل ${old.f}\nالجديد (بما فيها إعادة التشغيل على dist/): ${neu.t} اختبار، نجح ${neu.t - neu.f}، فشل ${neu.f}`);
const bad = rows.filter(r => r.state.startsWith("فشل") || r.state.startsWith("لم يكتمل")), skipped = rows.filter(r => r.state.startsWith("لم يُنفَّذ"));
if (skipped.length) console.log("لم يُنفَّذ: " + skipped.map(r => r.label).join(", "));
console.log(`اللوج في: ${LOGS}`); console.log(bad.length ? "النتيجة: ❌ فيه مشاكل: " + bad.map(r => r.label).join(", ") : skipped.length ? "النتيجة: ✔ اللي اتنفّذ نجح (لكن في حاجات اتخطّت)" : "النتيجة: ✔ كله نجح");
process.exit(bad.length ? 1 : 0);
