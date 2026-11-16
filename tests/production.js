/* نسخة الإنتاج (dist/): بناء متكرر ثابت، محتوى نظيف، SEO بدون روابط مفترضة، تشغيل فعلي تحت مسار GitHub Pages. التشغيل: node tests/production.js */
process.env.SITE_DIR = require("path").join(__dirname, "..", "dist");
process.env.AS_PREFIX = "/";      // الهدف: مستودع Abdelmalek-Studio.github.io ← الموقع على جذر https://abdelmalek-studio.github.io/
const L = require("./lib"), H = L.harness("production"), {T} = H, {fs, path, ROOT} = L; const cp = require("child_process"), crypto = require("crypto");
const DIST = path.join(ROOT, "dist"), NOGH = path.join(ROOT, ".dist-nogh");
const build = (out, ...a) => cp.spawnSync(process.execPath, [path.join(ROOT, "tools/build.js"), "--out", out, ...a], {encoding: "utf8"});
const walk = d => fs.readdirSync(d, {withFileTypes: true}).flatMap(f => f.isDirectory() ? walk(path.join(d, f.name)) : [path.join(d, f.name)]);
const tree = d => walk(d).sort().map(f => path.relative(d, f) + ":" + crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex")).join("\n");
(async () => {
  const GH = "Abdelmalek-Studio/Abdelmalek-Studio.github.io";
  let r = build(DIST, "--github", GH); T("build succeeds (with --github <user>/<user>.github.io, like the workflow)", r.status === 0, r.stdout + r.stderr);
  const t1 = tree(DIST); r = build(DIST, "--github", GH); T("second build is byte-identical (deterministic, no timestamps)", r.status === 0 && tree(DIST) === t1);
  const files = walk(DIST).map(f => path.relative(DIST, f));
  T("dist has only the public site (index, assets, data, robots, sitemap)", files.includes("index.html") && files.includes("data/data.js") && files.includes("robots.txt") && files.includes("sitemap.xml"), files.length);
  const banned = files.filter(f => /(^|\/)(admin|tests?|tools|node_modules|\.github|\.git)(\/|$)|\.(md|map|bak|log|zip|env)$|package(-lock)?\.json|backup|\.DS_Store|Thumbs\.db/i.test(f));
  T("dist contains NO admin / tests / tools / docs / backups / dotfiles", banned.length === 0, banned);
  const text = files.filter(f => /\.(html|js|css|json|txt|xml|svg)$/i.test(f)).map(f => [f, fs.readFileSync(path.join(DIST, f), "utf8")]);
  const secret = text.filter(([f, t]) => /(api[_-]?key|secret|token|passw(or)?d|private[_-]?key|Bearer\s+[A-Za-z0-9._-]{12,})\s*["']?\s*[:=]\s*["'][^"']{8,}/i.test(t)).map(x => x[0]); T("no secrets/tokens/passwords in any published text file", secret.length === 0, secret);
  const emails = [...new Set(text.flatMap(([f, t]) => t.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []))]; T("only expected e-mail addresses appear in published files (review list)", emails.length <= 3, emails);
  T("no absolute (/…) or file:// references to local assets in HTML/CSS/JS", text.filter(([f, t]) => /\.(html|css|js)$/.test(f) && /(?:src|href)="\/(?!\/)|url\(\s*["']?\/(?!\/)|file:\/\/\//.test(t.replace(/\/\*[\s\S]*?\*\//g, ""))).map(x => x[0]).length === 0);
  T("dist data.js is identical to site data.js", fs.readFileSync(path.join(DIST, "data/data.js"), "utf8") === fs.readFileSync(path.join(ROOT, "site/data/data.js"), "utf8"));
  const idx = fs.readFileSync(path.join(DIST, "index.html"), "utf8"), rb = fs.readFileSync(path.join(DIST, "robots.txt"), "utf8"), sm = fs.readFileSync(path.join(DIST, "sitemap.xml"), "utf8");
  const base = "https://abdelmalek-studio.github.io/";
  T("SEO: canonical / og:url / sitemap loc / robots Sitemap agree on one base URL", idx.includes(`rel="canonical" href="${base}"`) && idx.includes(`og:url" content="${base}"`) && sm.includes(`<loc>${base}</loc>`) && rb.includes(`Sitemap: ${base}sitemap.xml`));
  T("SEO: robots.txt has exactly one Sitemap line and one User-agent block (no duplicates)", (rb.match(/^Sitemap:/gim) || []).length === 1 && (rb.match(/^User-agent:/gim) || []).length === 1, rb);
  T("SEO: sitemap is valid XML-ish with one <url> and no fragment/hash URLs", (sm.match(/<url>/g) || []).length === 1 && !/#/.test(sm));
  const build2 = fs.readFileSync(path.join(DIST, "index.html"), "utf8"); T("SEO: exactly one canonical, one og:url, one description", (build2.match(/rel="canonical"/g) || []).length === 1 && (build2.match(/og:url/g) || []).length === 1 && (build2.match(/name="description"/g) || []).length === 1);
  // بدون repo/domain: ممنوع نفترض رابط
  const emptyCfg = path.join(L.tmpdir(), "seo-empty.json"); fs.writeFileSync(emptyCfg, JSON.stringify({githubUser: "Abdelmalek-Studio", repo: "", plannedRepo: "", domain: ""})); r = cp.spawnSync(process.execPath, [path.join(ROOT, "tools/build.js"), "--out", NOGH], {encoding: "utf8", env: {...process.env, SEO_CONFIG: emptyCfg}});
  if (r.status === 0) { const i2 = fs.readFileSync(path.join(NOGH, "index.html"), "utf8"), r2 = fs.readFileSync(path.join(NOGH, "robots.txt"), "utf8"); const smx = fs.existsSync(path.join(NOGH, "sitemap.xml")) ? fs.readFileSync(path.join(NOGH, "sitemap.xml"), "utf8") : "";
    T("no repo/domain configured (empty seo config) → NO invented canonical/og:url/Sitemap URL anywhere", !/github\.io|rel="canonical"|og:url/.test(i2) && !/github\.io|Sitemap:/i.test(r2) && !/github\.io|<loc>/.test(smx), {r2: r2.slice(0, 120)}); }
  else T("build without repo/domain runs", false, r.stdout + r.stderr);
  fs.rmSync(NOGH, {recursive: true, force: true});
  // الإعداد المحفوظ في المشروع (repo=Abdelmalek-Studio.github.io) من غير أي وسيط → نفس الجذر، من غير /repo/
  const cfgNow = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/seo.config.json"), "utf8")); T("seo.config.json: githubUser=Abdelmalek-Studio, plannedRepo=Abdelmalek-Studio.github.io, repo empty (not created yet), no custom domain", cfgNow.githubUser === "Abdelmalek-Studio" && cfgNow.plannedRepo === "Abdelmalek-Studio.github.io" && cfgNow.repo === "" && cfgNow.domain === "", cfgNow);
  T("site/ source stays free of invented URLs (no canonical/og:url/sitemap/Sitemap line in site/)", !/rel="canonical"|og:url/.test(fs.readFileSync(path.join(ROOT, "site/index.html"), "utf8")) && !fs.existsSync(path.join(ROOT, "site/sitemap.xml")) && !/^Sitemap:/m.test(fs.readFileSync(path.join(ROOT, "site/robots.txt"), "utf8")));
  r = build(NOGH); const cn = r.status === 0 ? fs.readFileSync(path.join(NOGH, "index.html"), "utf8") : ""; T("local build with NO arguments uses plannedRepo from the config → canonical is the root URL (no /Abdelmalek-Studio.github.io/ path segment)", cn.includes(`rel="canonical" href="${base}"`) && !/github\.io\/Abdelmalek/i.test(cn), r.stderr); fs.rmSync(NOGH, {recursive: true, force: true});
  T("case-insensitive: repo 'Abdelmalek-Studio.github.io' owner 'Abdelmalek-Studio' → host lowercased", idx.includes("https://abdelmalek-studio.github.io/") && !idx.includes("Abdelmalek-Studio.github.io"));
  const dd = L.loadData(path.join(DIST, "data/data.js")); T("dist data: site.visitors === false (CounterAPI off in v1)", dd.site.visitors === false);
  const wf = fs.readFileSync(path.join(ROOT, ".github/workflows/pages.yml"), "utf8"), gi0 = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  T("workflow publishes the built dist/ (not the repo root), after the syntax check", /check-syntax/.test(wf) && /build\.js/.test(wf) && /path:\s*dist/.test(wf) && !/secrets\./.test(wf));
  T("workflow permissions are minimal (contents: read globally; never contents: write)", /^permissions:\n\s+contents:\s*read/m.test(wf) && !/contents:\s*write/.test(wf));
  // ===== ربط النشر بنجاح الاختبارات + npm ci + lock =====
  const jobBlock = (txt, name) => { const m = txt.match(new RegExp("^  " + name + ":\\n([\\s\\S]*?)(?=^  \\w[\\w-]*:\\n|(?![\\s\\S]))", "m")); return m ? m[1] : ""; };
  const tj = jobBlock(wf, "test"), dj = jobBlock(wf, "deploy");
  T("workflow: job «test» exists and runs npm ci + playwright install + check-syntax + npm test", /npm ci/.test(tj) && /playwright install/.test(tj) && /check-syntax/.test(tj) && /run:\s*npm test/.test(tj), tj.slice(0, 80));
  T("workflow: job «deploy» has needs: test (failing tests block publishing)", /^\s+needs:\s*(test|\[\s*test\s*\])\s*$/m.test(dj));
  T("workflow: only the deploy job has pages:write / id-token:write; the test job doesn't", /pages:\s*write/.test(dj) && /id-token:\s*write/.test(dj) && !/pages:\s*write|id-token:\s*write/.test(tj));
  T("workflow: deploy builds dist with the real repo name and uploads dist/", /build\.js --github "\$\{\{ github\.repository \}\}"/.test(dj) && /path:\s*dist/.test(dj));
  T("workflow: test steps have no continue-on-error / || true (a failure can't be swallowed)", !/continue-on-error|\|\|\s*true/.test(wf));
  T("workflow: no deploy action anywhere except in the gated deploy job", (wf.match(/deploy-pages@/g) || []).length === 1 && dj.includes("deploy-pages@") && !/deploy-pages|upload-pages-artifact/.test(fs.readFileSync(path.join(ROOT, ".github/workflows/tests.yml"), "utf8")));
  const tw = fs.readFileSync(path.join(ROOT, ".github/workflows/tests.yml"), "utf8"); T("tests.yml: PR/manual runs npm ci + npm test and has read-only permissions", /npm ci/.test(tw) && /run:\s*npm test/.test(tw) && !/write/.test(tw));
  const pj = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")), lock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));
  T("package-lock.json exists, lockfileVersion 3, and matches package.json (pinned Playwright, same version in lock)", lock.lockfileVersion === 3 && pj.devDependencies.playwright === lock.packages["node_modules/playwright"].version && /^\d+\.\d+\.\d+$/.test(pj.devDependencies.playwright) && lock.packages[""].devDependencies.playwright === pj.devDependencies.playwright, {pj: pj.devDependencies, lock: lock.packages["node_modules/playwright"].version});
  T("package.json: test script runs the full suite, build script exists, node >= 20 (Playwright requirement)", pj.scripts.test === "node tests/run-all.js" && pj.scripts.build && /20/.test(pj.engines.node) && lock.packages["node_modules/playwright"].engines.node.includes("20"));
  T("package-lock.json is not git-ignored and package.json has no runtime dependencies", !/package-lock/.test(gi0) && !pj.dependencies);
  const gi = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8"); T(".gitignore: admin is NOT ignored (clone runs tests), dist/ and node_modules ARE", !/^\/?admin\/?$/m.test(gi) && /^\/?dist\/?$/m.test(gi) && /node_modules/.test(gi));

  /* ===== تشغيل فعلي لـ dist على الجذر (زي https://abdelmalek-studio.github.io/) ===== */
  const env = await H.start({}); const p = await env.mk(); const reqs = []; p.on("request", q => reqs.push(q.url()));
  await p.goto(env.BASE); await p.waitForSelector(".card"); await p.waitForTimeout(500);
  T("dist: home loads, 144 items, no JS/console errors", (await p.locator("#tabs .chip").count()) > 5 && p.errs.length === 0, p.errs);
  T("dist: zero 404s on the root-served site", env.misses.length === 0, env.misses);
  T("dist: visitors counter disabled → ZERO requests to counterapi and the counter box stays empty", reqs.filter(u => /counterapi/i.test(u)).length === 0 && (await p.locator("#visitors").innerText()).trim() === "", {reqs: reqs.filter(u => /counterapi/i.test(u)), box: await p.locator("#visitors").innerText()});
  T("dist: admin is not reachable under the site path", await (async () => { const q = await fetch(env.BASE + "admin/index.html"); return q.status === 404; })());
  T("dist: robots.txt and sitemap.xml are served", (await (await fetch(env.BASE + "robots.txt")).text()).includes("Sitemap:") && (await (await fetch(env.BASE + "sitemap.xml")).text()).includes("<urlset"));
  const D = L.loadData(path.join(DIST, "data/data.js")), it = D.sections.flatMap(s => s.items).find(i => i.type === "prompt");
  const p2 = await env.mk(); await p2.goto(env.BASE + "#i=" + it.id); await p2.waitForSelector(".card"); await p2.waitForTimeout(500); T("dist: direct link opens the prompt modal with the right title (fresh tab)", await p2.waitForSelector(".modal.show #mTitle", {timeout: 3000}).then(async () => (await p2.locator("#mTitle").innerText()) === it.title).catch(() => false));
  await p2.reload(); await p2.waitForSelector(".modal.show #mTitle", {timeout: 3000}); T("dist: refresh on direct link reopens it and keeps the URL", (await p2.locator("#mTitle").innerText()) === it.title && p2.url().endsWith("#i=" + it.id));
  await p2.evaluate(() => navigator.clipboard.writeText("")); await p2.locator("#mShare").click(); await p2.waitForTimeout(300); const link = await p2.evaluate(() => navigator.clipboard.readText());
  T("dist: share link is the ROOT permalink " + env.BASE + "#i=<id> (no repo path segment)", link === env.BASE + "#i=" + it.id, link);
  const p3 = await env.mk({viewport: {width: 375, height: 700}, colorScheme: "dark", isMobile: true}); await p3.goto(env.BASE); await p3.waitForSelector(".card");
  T("dist: mobile + dark: no horizontal scroll, dark theme applied, no errors", await p3.evaluate(() => document.documentElement.scrollWidth <= innerWidth) && p3.errs.length === 0 && (await p3.evaluate(() => getComputedStyle(document.body).backgroundColor)) !== "rgb(255, 255, 255)", p3.errs);
  await p.fill("#q", "canva"); await p.waitForTimeout(100); T("dist: search works", await p.locator("#content .cwrap").count() > 0);
  await H.end(env);
})().catch(e => { console.error("CRASH", e); process.exit(2); });
