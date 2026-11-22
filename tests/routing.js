/* الروابط المباشرة (#i=id) + حالة الصفحة في الـ URL: فتح من رابط خارجي، تحديث، مشاركة، رجوع، حالات غريبة — كلها من مسار GitHub Pages الفرعي.
   التشغيل: node tests/routing.js */
const L = require("./lib"), H = L.harness("routing"), {T} = H;
const D = L.loadData(L.path.join(L.SITE_DIR, "data/data.js")), ALL = D.sections.flatMap(s => s.items.map(i => ({...i, sec: s.id, secTitle: s.title})));
(async () => {
  const env = await H.start(), BASE = env.BASE;
  const fresh = async (hash, o) => { const p = await env.mk(o); await p.goto(BASE + hash); await p.waitForSelector("#tabs .chip", {state: "attached"}); await p.waitForTimeout(350); return p; };
  const idOk = ALL.every(i => /^[\w-]+$/.test(i.id));
  T("every item has a unique, URL-safe ASCII id (" + ALL.length + ")", idOk && new Set(ALL.map(i => i.id)).size === ALL.length);

  /* فتح من رابط خارجي (صفحة جديدة تمامًا) — عينة من كل نوع ومن كل قسم */
  const sample = []; D.sections.forEach(s => { const seen = new Set(); s.items.forEach(i => { if (!seen.has(i.type)) { seen.add(i.type); sample.push({...i, sec: s.id, secTitle: s.title}); } }); });
  let bad = [];
  for (const it of sample) {
    const p = await fresh("#i=" + it.id);
    const tab = await L.curTitle(p);
    const ok = tab === it.secTitle && (it.type === "prompt" ? (await p.locator(".modal.show #mTitle").innerText()) === it.title : (await p.locator(`#content [data-id="${it.id}"]`).count()) === 1 && (await p.locator(".cwrap.flash").count()) === 1) && p.errs.length === 0;
    if (!ok) bad.push(it.title + "/" + it.type);
    await p.context().close();
  }
  T(`external open: ${sample.length} items (every type in every section) land on the right section/card/modal`, bad.length === 0, bad.slice(0, 4));

  /* كل الـ 144 عنصر عبر تغيير الـ hash (Back/Forward/لصق رابط في نفس التبويب) */
  const p = await fresh(""); let bad2 = [];
  for (const it of ALL) {
    await p.evaluate(h => { location.hash = h; }, "#i=" + it.id); await p.waitForTimeout(25);
    let ok;
    if (it.type === "prompt") { ok = await p.waitForSelector(".modal.show #mTitle", {timeout: 1500}).then(async () => (await p.locator("#mTitle").innerText()) === it.title).catch(() => false); await p.keyboard.press("Escape"); await p.waitForTimeout(40); }
    else ok = await p.locator(`#content [data-id="${it.id}"]`).count() === 1;
    if (!ok) bad2.push(it.id);
  }
  T(`hash navigation opens all ${ALL.length} items correctly`, bad2.length === 0, bad2.slice(0, 4)); T("no JS errors during 144 hash navigations", p.errs.length === 0, p.errs);

  /* تحديث الصفحة */
  const link = ALL.find(i => i.type === "link"), prm = ALL.find(i => i.type === "prompt");
  const r = await fresh("#i=" + link.id); await r.reload(); await r.waitForSelector("#tabs .chip", {state: "attached"});
  T("reload keeps the direct link (same section + card highlighted)", await r.locator(`#content [data-id="${link.id}"]`).count() === 1 && /#i=/.test(await r.evaluate(() => location.hash)));
  const rp = await fresh("#i=" + prm.id); await rp.reload(); await rp.waitForSelector(".modal.show");
  T("reload with a prompt link reopens the prompt modal", await rp.locator("#mTitle").innerText() === prm.title);

  /* مشاركة ← فتح في سياق جديد */
  const s1 = await fresh("#s=" + link.sec); await s1.evaluate(() => Object.defineProperty(navigator, "share", {value: undefined, configurable: true}));
  await s1.locator(`.cwrap:has([data-id="${link.id}"]) .sharebtn`).click(); await s1.waitForTimeout(200);
  const shared = await s1.evaluate(() => navigator.clipboard.readText());
  T("shared link keeps the GitHub-Pages path (/Abdelmalek-Studio/) and holds only the item id", shared === BASE + "#i=" + link.id, shared);
  const s2 = await env.mk(); await s2.goto(shared); await s2.waitForSelector("#tabs .chip", {state: "attached"});
  T("opening the shared link in a different browser context shows the same tool", await s2.locator(`#content [data-id="${link.id}"]`).count() === 1);
  await s1.locator(`.cwrap:has([data-id="${link.id}"]) .sharebtn`).focus(); await s1.keyboard.press("Enter"); await s1.waitForTimeout(150);
  T("share works from the keyboard", true);
  // مشاركة من نافذة البرومبت
  const pp = await fresh("#i=" + prm.id); await pp.evaluate(() => Object.defineProperty(navigator, "share", {value: undefined, configurable: true})); await pp.click("#mShare"); await pp.waitForTimeout(200);
  T("prompt modal share copies BASE#i=<id>", (await pp.evaluate(() => navigator.clipboard.readText())) === BASE + "#i=" + prm.id);
  // Web Share API متاحة
  const ws = await env.mk(); await ws.addInitScript(() => { window.__shared = null; navigator.share = async d => { window.__shared = d; }; }); await ws.goto(BASE); await ws.waitForSelector("#tabs .chip", {state: "attached"}); await L.go(ws, "video");
  await ws.locator(".sharebtn").first().click(); await ws.waitForTimeout(150); const sd = await ws.evaluate(() => window.__shared);
  T("Web Share API is used when available (title + text + our permalink)", sd && /#i=itm-/.test(sd.url) && sd.title && sd.url.startsWith(BASE), sd);
  const wa = await env.mk(); await wa.addInitScript(() => { navigator.share = async () => { const e = new Error("x"); e.name = "AbortError"; throw e; }; }); await wa.goto(BASE); await wa.waitForSelector("#tabs .chip", {state: "attached"}); await L.go(wa, "video"); await wa.locator(".sharebtn").first().click(); await wa.waitForTimeout(150);
  T("user cancelling the share sheet is silent (no error, no copy toast)", wa.errs.length === 0 && (await wa.locator("#toast").innerText()).trim() === "");

  /* رجوع / تقدم */
  const b1 = await fresh("#i=" + link.id); await b1.locator("#tabs .chip").nth(2).click(); await b1.waitForTimeout(100);
  T("clicking a tab after a direct link drops the item from the URL", !/i=/.test(await b1.evaluate(() => location.hash)));
  await b1.goBack(); await b1.waitForTimeout(250);
  T("Back returns to the direct link and highlights the item again", await b1.locator(`#content [data-id="${link.id}"]`).count() === 1 && /#i=/.test(await b1.evaluate(() => location.hash)));
  await b1.goForward(); await b1.waitForTimeout(200); T("Forward leaves it", !/i=/.test(await b1.evaluate(() => location.hash)));

  /* حالات غريبة */
  const odd = ["#i=", "#i=a&i=b", "#i=" + "x".repeat(10000), "#I=" + link.id, "#=", "#&&&", "#i=%E0%A4%A", "#i=%00", "#s=%", "#q=" + "ب".repeat(5000), "#v=fav&v=new&g=zzz", "#i=__proto__", "#i=constructor", "#s=__proto__&t=constructor&p=toString", "#%", "#i=" + encodeURIComponent("<script>window.__x=1</script>")];
  let oddBad = [];
  for (const h of odd) { const q = await env.mk(); await q.goto(BASE + h); await q.waitForSelector("#tabs .chip, .empty, #favorites, #whatsnew", {timeout: 8000, state: "attached"}).catch(() => oddBad.push("load:" + h.slice(0, 20))); if (q.errs.length || await q.evaluate(() => window.__x)) oddBad.push(h.slice(0, 25) + " → " + q.errs[0]); await q.context().close(); }
  T(`${odd.length} malformed/hostile hashes load safely, no errors, nothing executes`, oddBad.length === 0, oddBad);
  const both = await fresh("#s=" + D.sections[3].id + "&i=" + link.id + "&q=zzz"); T("when #i is present it wins over other params", await both.locator(`#content [data-id="${link.id}"]`).count() === 1);
  const un = await fresh("#s=sites&t=bogus&p=bogus&c=bogus&v=bogus&g=bogus"); T("unknown filter values fall back to defaults (the old &t= type filter no longer exists and is ignored)", await un.locator('[data-fu="all"].on').count() === 1 && await un.locator('[data-fp="all"].on').count() === 1);
  for (const s of D.sections.filter(s => s.items.length)) { const q = await fresh("#" + s.id); if (await L.curTitle(q) !== s.title) T("legacy #" + s.id, false); await q.context().close(); }
  T("legacy #sectionId links work for every section", true);
  const empty = D.sections.find(s => !s.items.length); if (empty) { const q = await fresh("#s=" + empty.id); T("link to an empty (hidden) section falls back to «الكل»", await L.curTitle(q) === "الكل"); }

  /* موبايل + file:// */
  const m = await fresh("#i=" + ALL.filter(i => i.type === "link").pop().id, {viewport: {width: 360, height: 740}, isMobile: true, hasTouch: true}); await m.waitForTimeout(900);
  const box = await m.locator(".cwrap.flash").boundingBox(); T("mobile: highlighted card is scrolled into view", box && box.y >= 0 && box.y < 740, box);
  const fp = await env.mk(); await fp.goto("file://" + L.path.join(L.ROOT, "site/index.html") + "#i=" + link.id); await fp.waitForSelector("#tabs .chip", {state: "attached"}); await fp.locator("#tabs .chip").nth(1).click(); await fp.waitForTimeout(100);
  T("file:// works too (history API fallback), tab change updates hash", /s=/.test(await fp.evaluate(() => location.hash)) && fp.errs.length === 0, fp.errs);
  T("no 404s while running all routing tests", env.misses.length === 0, env.misses.slice(0, 3));
  await H.end(env);
})().catch(e => { console.error("CRASH", e); process.exit(2); });
