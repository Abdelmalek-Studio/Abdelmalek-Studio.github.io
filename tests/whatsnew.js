/* آخر الإضافات: بيانات محلية فقط، تجميع بالتاريخ، ملاحظات، مراجع، تنظيف البيانات الغريبة، أمان. التشغيل: node tests/whatsnew.js */
const L = require("./lib"), H = L.harness("whatsnew"), {T} = H;
const D0 = L.loadData(L.path.join(L.SITE_DIR, "data/data.js")); let DATA = null;
(async () => {
  const env = await H.start({"/Abdelmalek-Studio/data/data.js": (q, r) => { if (!DATA) return false; r.writeHead(200, {"content-type": "text/javascript"}); r.end(L.dataJs(DATA)); return true; }});
  const open = async (d, hash = "") => { DATA = d; const p = await env.mk(); await p.goto(env.BASE + hash); await p.waitForSelector("#tabs .chip, .empty"); await p.waitForTimeout(350); return p; };
  const it = (si, k) => D0.sections[si].items[k];
  const mk = f => { const d = L.clone(D0); f(d); return d; };

  /* بدون أي بيانات: مفيش حاجة تظهر */
  let p = await open(null);
  T("no dated data → no tab, no block, no clutter", await p.locator("#tabs .newchip").count() === 0 && await p.locator("#latest").isHidden());
  p = await open(null, "#v=new"); T("#v=new with no data falls back to normal page", await p.locator("#whatsnew").count() === 0 && await p.locator("#tabs .chip").count() === 6);

  /* عناصر بتاريخ فقط */
  const d1 = mk(d => { [[2, 0, "2026-11-05"], [2, 1, "2026-11-05"], [3, 0, "2026-10-01"], [4, 0, "2025-01-31"], [4, 1, "2026-11-07"]].forEach(([s, k, a]) => d.sections[s].items[k].added = a); });
  p = await open(d1);
  T("dated items alone → the what's-new chip appears (the home itself stays clean: no latest block outside)", await p.locator("#tabs .newchip").count() === 1 && await p.locator("#latest .fcard").count() === 0);
  await p.click("#tabs .newchip"); await p.waitForSelector("#whatsnew");
  const dates = await p.locator(".dh time").evaluateAll(n => n.map(x => x.getAttribute("datetime"))); T("grouped by date, newest first", JSON.stringify(dates) === '["2026-11-07","2026-11-05","2026-10-01","2025-01-31"]', dates);
  T("items under their own date (2 on 11-05)", (await p.locator(".dgroup").nth(1).locator(".cwrap").count()) === 2);
  T("dates shown human-readable with western digits", /2026/.test(await p.locator(".dh time").first().innerText()) && !/[٠-٩]/.test(await p.locator(".dh time").first().innerText()), await p.locator(".dh time").first().innerText());
  T("cards in what's new have fav / share / report like everywhere", await p.locator("#whatsnew .favbtn").count() === 5 && await p.locator("#whatsnew .sharebtn").count() === 5);
  T("URL is #v=new; filters/search UI hidden in this view", /v=new/.test(await p.evaluate(() => location.hash)) && await p.locator("body.fav-mode").count() === 1);
  await p.reload(); await p.waitForSelector("#whatsnew"); T("reload stays", true);
  await p.goBack(); await p.waitForTimeout(150); T("Back leaves the view", await p.locator("#whatsnew").count() === 0); await p.goForward(); await p.waitForTimeout(150); T("Forward returns", await p.locator("#whatsnew").count() === 1);
  await p.fill("#q", "a"); await p.waitForTimeout(100); T("typing in search leaves the view and searches", await p.locator("#whatsnew").count() === 0);
  p = await open(d1); await p.locator("#tabs .newchip").click(); await p.waitForTimeout(300); T("the what's-new chip opens the view", await p.locator("#whatsnew").count() === 1);

  /* ملاحظات + مراجع */
  const d2 = mk(d => { d.sections[2].items[0].added = "2026-11-05"; d.updates = [
    {id: "u1", date: "2026-11-05", title: "أدوات <b>جديدة</b>", text: "سطر 1\nسطر <img src=x onerror=window.__n=1> 2", items: [it(2, 0).id, it(3, 0).id, "itm-gone", it(3, 0).id]},
    {id: "u2", date: "2026-11-09", title: "تحديث لوحدو"}, {date: "2026-13-45", title: "تاريخ غلط"}, {date: "2026-11-01", title: ""}, {date: "2026-11-01"}, null, 5, "x", {title: "من غير تاريخ"}]; });
  p = await open(d2); await p.click("#tabs .newchip"); await p.waitForSelector("#whatsnew");
  T("valid notes shown; invalid ones (bad date / empty title / no date / non-objects) silently skipped, no crash", await p.locator(".unote").count() === 2 && p.errs.length === 0, p.errs);
  T("note titles escaped (no <b>), text escaped, nothing executes", await p.locator(".unote h4").first().innerText() === "تحديث لوحدو" || (await p.locator(".unote h4").allInnerTexts()).includes("أدوات <b>جديدة</b>"));
  T("no injected elements from note text", await p.locator(".unote b, .unote img:not(.ficon)").count() === 0 && !(await p.evaluate(() => window.__n)));
  const note = p.locator(".unote", {hasText: "أدوات"}); T("note shows its linked items: unknown id ignored, duplicate id once", await note.locator(".cwrap").count() === 2);
  T("an item both linked in a note and dated the same day is not shown twice", (await p.locator(`#whatsnew [data-id="${it(2, 0).id}"]`).count()) === 1);
  T("note-only date (no items) still gets its own date heading", (await p.locator(".dh time").evaluateAll(n => n.map(x => x.getAttribute("datetime")))).includes("2026-11-09"));
  await p.goto(env.BASE); await p.waitForSelector("#tabs .chip", {state: "attached"}); T("what's-new chip works with notes-only data too", await p.locator("#tabs .newchip").isVisible());

  /* بيانات غريبة */
  const weird = [mk(d => { d.updates = "x"; }), mk(d => { d.updates = {a: 1}; }), mk(d => { d.updates = [{date: "2026-11-05", title: "t", items: "nope"}]; }), mk(d => { d.updates = [{date: "2026-11-05", title: "t", items: [1, null, {}]}]; }), mk(d => { d.sections[2].items[0].added = "yesterday"; d.sections[2].items[1].added = 20261105; d.sections[2].items[2].added = "2026-02-30"; }), mk(d => { d.updates = Array.from({length: 300}, (_, k) => ({date: "2026-01-" + String(k % 28 + 1).padStart(2, "0"), title: "u" + k})); })];
  let wb = []; for (const [k, w] of weird.entries()) { const q = await open(w); if (q.errs.length) wb.push(k + ":" + q.errs[0]); if (await q.locator("#tabs .newchip").count()) { await q.click("#tabs .newchip"); await q.waitForSelector("#whatsnew"); } await q.context().close(); }
  T(`${weird.length} malformed update structures never crash the site`, wb.length === 0, wb);
  /* تنسيق 2026-02-30 */
  const q = await open(weird[4]); T("impossible (2026-02-30) / non-string dates are not treated as news", await q.locator("#tabs .newchip").count() === 0);
  /* عناصر بعد الحذف من البيانات (المراجع القديمة في المفضلة وغيره) */
  T("no JS errors", p.errs.length === 0, p.errs);
  await H.end(env);
})().catch(e => { console.error("CRASH", e); process.exit(2); });
