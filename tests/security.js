/* أمان المدخلات: XSS في اللوحة (حقول/استيراد/أسماء ملفات) وفي الموقع (بيانات معادية، روابط، hash، localStorage)، تلويث prototype، حقن كود في data.js. التشغيل: node tests/security.js */
const L = require("./lib"), H = L.harness("security"), {T} = H, {fs, path} = L;
const CUR = L.loadData(path.join(L.ROOT, "site/data/data.js"));
const PAY = `<img src=x onerror="window.__x=(window.__x||0)+1">"'><svg onload=window.__x=9></svg><script>window.__x=7</script>`;
const items = d => d.sections.flatMap(s => s.items);
let SERVED = null;
// أي عنصر بخاصية معالج حدث أو سكريبت أو iframe مضاف من المستخدم = حقن
const injected = p => p.evaluate(() => ({x: window.__x, polluted: ({}).polluted, nodes: [...document.querySelectorAll("body *")].filter(e => [...e.attributes].some(a => /^on/i.test(a.name)) || (e.tagName === "SCRIPT" && /__x/.test(e.textContent)) || (e.tagName === "IMG" && e.getAttribute("src") === "x") || e.tagName === "IFRAME").map(e => e.outerHTML.slice(0, 80))}));
const clean = (r, w) => r.x === undefined && r.polluted === undefined && r.nodes.length === 0;
(async () => {
  const env = await H.start({"/Abdelmalek-Studio/data/data.js": (q, r) => { if (!SERVED) return false; r.writeHead(200, {"content-type": "text/javascript"}); r.end(SERVED); return true; }});
  const tmp = L.tmpdir(); const wf = (n, c) => { const f = path.join(tmp, n); fs.writeFileSync(f, typeof c === "string" ? c : JSON.stringify(c)); return f; };
  const mkA = async () => { const a = await env.mk(); a.dl = []; a.removeAllListeners("dialog"); a.on("dialog", d => { a.dl.push(d.message()); d.accept(); }); await a.goto(env.ADMIN); await a.waitForSelector(".item"); return a; };
  const hostile = () => { const d = L.clone(CUR); const S = d.site;
    ["name", "nameEn", "owner", "tagline", "about"].forEach(k => S[k] = PAY + k);
    (S.socials || []).forEach(s => s.label = PAY + "soc");
    d.sections.forEach((s, k) => { s.title = PAY + "sec" + k; s.desc = PAY + "sd"; s.items.forEach((i, j) => { i.title = PAY + "t" + k + "_" + j; i.desc = PAY + "d"; if (i.type === "prompt") { i.text = PAY + "prompt"; i.tool = PAY + "tool"; } i.category = PAY + "cat"; i.keywords = PAY + "kw"; }); });
    d.updates = [{id: "u1", date: "2026-11-01", title: PAY + "ut", text: PAY + "utext", items: [items(d)[0].id, items(d)[1].id]}]; return d; };

  /* ===== A) اللوحة: بيانات معادية تتفتح وتتعرض وتتصدّر ===== */
  const a = await mkA(); const H1 = hostile();
  await a.setInputFiles("#restore", wf("h.json", H1)); await a.waitForTimeout(700);
  T("admin: hostile import renders with no script execution / injected nodes", clean(await injected(a)), await injected(a));
  T("admin: payload shown as TEXT inside inputs (value preserved exactly)", (await a.locator('.item:not(.upd) [data-f="title"]').first().inputValue()) === items(H1)[0].title);
  await a.click("#preview"); await a.click("#dupcheck"); await a.fill("#asearch", PAY); await a.fill("#asearch", "sec"); await a.fill("#asearch", "");
  await a.waitForTimeout(100);
  T("admin: preview / duplicates / search / updates panels safe with hostile data", clean(await injected(a)), await injected(a));
  const opts = await a.locator("#updates select[data-addref] option").allInnerTexts(); T("admin: update-ref dropdown shows titles as text", opts.some(o => o.includes("<img")) && clean(await injected(a)));
  const exH = L.parseData(await L.download(a, "#download", tmp)); T("admin export keeps payload text byte-exact (no sanitising loss, no escaping drift)", items(exH)[0].title === items(H1)[0].title && exH.site.about === H1.site.about && exH.updates[0].title === PAY + "ut");
  const raw = await L.download(a, "#download", tmp); T("exported file has no raw U+2028/U+2029 line separators (valid as a JS source)", !/[\u2028\u2029]/.test(raw));
  T("exported data.js is pure JSON assignment: re-parses to the same object", JSON.stringify(L.parseData(raw)) === JSON.stringify(exH));
  /* ===== B) روابط خطيرة في اللوحة ===== */
  const U = L.clone(CUR); const ui = items(U); const bad = ["javascript:window.__x=1", "JaVaScRiPt:window.__x=2", " javascript:window.__x=3", "\tjava\nscript:window.__x=4", "data:text/html,<script>window.__x=5</script>", "vbscript:x", "file:///etc/passwd", "//evil.example/x"];
  bad.forEach((u, k) => { ui[k].url = u; }); U.site.socials[0].url = "javascript:window.__x=6"; ui[8].image = "javascript:window.__x=8"; U.sections[0].cover = "x\");}</style><img src=x onerror=window.__x=1>";
  await a.setInputFiles("#restore", wf("u.json", U)); await a.waitForTimeout(600);
  await a.click("#download").catch(() => {}); await a.waitForTimeout(400); const et = await a.innerText("#errbox");
  const marks = ["__x=1", "__x=2", "__x=3", "__x=4", "data:text/html", "vbscript:x", "file:///etc/passwd", "//evil.example"];
  T("admin: all 8 dangerous/odd item URLs are each named in the error list (download blocked)", marks.every(m => et.includes(m)) && (await a.innerText("#status")).includes("اتوقف"), marks.filter(m => !et.includes(m)));
  T("admin: javascript: social-button URL rejected", /زرار التواصل[^\n]*__x=6/.test(et));
  T("admin: javascript: image path and hostile cover path rejected", /__x=8/.test(et) && /صورة الغلاف/.test(et));
  T("admin: hostile URLs/cover render safely as inputs", clean(await injected(a)), await injected(a));
  /* ===== C) ملف data.js فيه كود: لازم ما يتنفّذش + ملوثات prototype ===== */
  const code = "window.STUDIO_DATA = " + JSON.stringify(CUR) + ";\nwindow.__x = 'RAN';\n";
  const c1 = await mkA(); await c1.setInputFiles("#file", wf("code.js", code)); await c1.waitForTimeout(500); const rc = await injected(c1);
  T("admin: data.js with extra trailing code → code is NEVER executed", rc.x === undefined, rc.x);
  const wrapped = "window.STUDIO_DATA = (function(){window.__x='IIFE';return " + JSON.stringify(CUR) + ";})();"; await c1.setInputFiles("#file", wf("iife.js", wrapped)); await c1.waitForTimeout(500);
  T("admin: data.js built from a function call is refused/not executed", (await injected(c1)).x === undefined && (await c1.locator(".item").count()) === 144);
  const pp = JSON.stringify(CUR).replace('{"version"', '{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}},"version"'); await c1.setInputFiles("#restore", wf("pp.json", pp)); await c1.waitForTimeout(500);
  const rp = await injected(c1); T("admin: __proto__/constructor.prototype keys can't pollute Object.prototype", rp.polluted === undefined, rp);
  const pe = L.parseData(await L.download(c1, "#download", tmp)); T("admin: export after prototype-pollution attempt keeps all 144 items and Object.prototype stays clean", cnt(pe) === 144 && (await injected(c1)).polluted === undefined, cnt(pe));
  function cnt(d) { return (d.sections || []).reduce((n, s) => n + s.items.length, 0); }
  // اسم الملف نفسه معادي
  const fn = path.join(tmp, `"><img src=x onerror=window.__x=1>.json`); fs.writeFileSync(fn, JSON.stringify(CUR)); await c1.setInputFiles("#restore", fn); await c1.waitForTimeout(500);
  T("admin: hostile FILE NAME shown safely in status/toast/dialog", clean(await injected(c1)), await injected(c1));
  T("no JS errors in admin security tests", a.errs.length + c1.errs.length === 0, a.errs.concat(c1.errs));

  /* ===== D) الموقع: بيانات معادية ===== */
  SERVED = L.dataJs(H1); const s = await env.mk(); await s.goto(env.BASE); await s.waitForSelector(".card, .fcard");
  T("site: hostile titles/desc/site fields render as text (no execution, no injected nodes)", clean(await injected(s)), await injected(s));
  T("site: payload visible as literal text", (await s.innerText("body")).includes("<img src=x"));
  for (const h of ["#v=new", "#s=" + H1.sections[1].id, "#t=prompt", "#v=fav"]) { await s.evaluate(h => { location.hash = h; }, h); await s.waitForTimeout(150); T(`site: hostile data in view ${h.slice(0, 20)} is safe`, clean(await injected(s)), await injected(s)); }
  const pr = items(H1).find(i => i.type === "prompt"); await s.goto(env.BASE + "#i=" + pr.id); await s.reload(); await s.waitForSelector(".card, .fcard"); await s.waitForTimeout(500);
  T("site: prompt modal with hostile text/tool is safe", clean(await injected(s)) && (await s.locator("#modal, [role=dialog]").first().innerText().catch(() => "")).includes("<img"), await injected(s));
  await s.evaluate(() => { try { localStorage.setItem("as-fav", JSON.stringify(["x", "<img src=x onerror=window.__x=1>"])); localStorage.setItem("as-fav-groups", JSON.stringify({v: 1, groups: [{id: "g-aaaaaa", name: "<img src=x onerror=window.__x=2>"}, {id: "__proto__", name: "p"}], map: {"__proto__": "g-aaaaaa", "constructor": "g-aaaaaa"}})); } catch (e) {} });
  await s.goto(env.BASE + "#v=fav"); await s.reload(); await s.waitForSelector("#content"); await s.waitForTimeout(300);
  T("site: poisoned localStorage (fav ids / group names / __proto__ keys) renders safely", clean(await injected(s)), await injected(s));
  /* hash معادي */
  const hashes = ["#q=" + encodeURIComponent(PAY), "#i=" + encodeURIComponent(PAY), "#s=" + encodeURIComponent(PAY) + "&t=" + encodeURIComponent(PAY) + "&p=" + encodeURIComponent(PAY) + "&c=" + encodeURIComponent(PAY) + "&g=" + encodeURIComponent(PAY) + "&v=" + encodeURIComponent(PAY), "#" + encodeURIComponent("\"><img src=x onerror=window.__x=1>"), "#__proto__=1&constructor=2"];
  for (const h of hashes) { await s.goto(env.BASE + h); await s.reload(); await s.waitForSelector("#content"); await s.waitForTimeout(250); T(`site: hostile URL hash is inert (${h.slice(0, 18)}…)`, clean(await injected(s)), await injected(s)); }
  T("site: no JS errors with hostile data", s.errs.length === 0, s.errs);

  /* ===== E) الموقع: روابط خطيرة في البيانات ===== */
  SERVED = L.dataJs(U); const u = await env.mk(); await u.goto(env.BASE); await u.waitForSelector(".card, .fcard");
  const hrefs = async () => u.evaluate(() => [...document.querySelectorAll("a[href]")].map(a => a.getAttribute("href")));
  const okH = h => /^(https?:|mailto:|#|assets\/|\.\.?\/|\/|tel:)/i.test(h.trim()) && !/^\s*(javascript|data|vbscript|file):/i.test(h);
  let hs = await hrefs(); T("site: no <a href> with javascript:/data:/vbscript:/file: anywhere (home)", hs.every(okH), hs.filter(h => !okH(h)));
  let badHrefs = [], seen = 0; for (const sec of U.sections.filter(x => x.items.length)) { await u.evaluate(id => { location.hash = "#s=" + id; }, sec.id); await u.waitForTimeout(80); hs = await hrefs(); seen += hs.length; badHrefs.push(...hs.filter(h => !okH(h))); }
  T(`site: every section view (${seen} links checked): no unsafe href`, seen > 100 && badHrefs.length === 0, badHrefs);
  await u.evaluate(() => { location.hash = "#t=link"; }); await u.waitForTimeout(120); const bl = u.locator('a.card[href="#"]'); const nb = await bl.count();
  if (nb) { const pg = u.context().pages().length; await bl.first().click().catch(() => {}); await u.waitForTimeout(300); T("site: clicking a card with a neutralised URL runs nothing and opens no new tab", (await injected(u)).x === undefined && u.context().pages().length === pg, {pagesBefore: pg, pagesAfter: u.context().pages().length}); } else T("site: neutralised URL cards exist (hostile URLs became href=#)", false, "no href=# card found");
  T("site: <img src>/background from javascript: image or hostile cover not used", await u.evaluate(() => ![...document.querySelectorAll("img")].some(i => /^\s*javascript:/i.test(i.getAttribute("src") || "")) && !/javascript:|onerror/i.test(document.documentElement.innerHTML.replace(/<script[\s\S]*?<\/script>/g, ""))), "");
  T("site: no code executed with dangerous URLs", clean(await injected(u)), await injected(u));
  // نسخة تقارير البلاغ: mailto مشفّر
  T("no JS errors in site link tests", u.errs.length === 0, u.errs);
  SERVED = null; await H.end(env);
})().catch(e => { console.error("CRASH", e); process.exit(2); });
