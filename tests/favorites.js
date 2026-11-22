/* المفضلة القديمة + مجموعات المفضلة: حفظ، توافق، تنظيف التخزين التالف، حدود، أمان. التشغيل: node tests/favorites.js */
const L = require("./lib"), H = L.harness("favorites"), {T} = H;
const D = L.loadData(L.path.join(L.SITE_DIR, "data/data.js")), ALL = D.sections.flatMap(s => s.items);
(async () => {
  const env = await H.start(), BASE = env.BASE;
  const open = async (init, hash = "#s=" + FS.id) => { const p = await env.mk(); if (init) await p.addInitScript(init, undefined); await p.goto(BASE + hash); await p.waitForSelector("#tabs .chip, #favorites", {state: "attached"}); await p.waitForTimeout(350); return p; };
  const ls = (p, k) => p.evaluate(k => localStorage.getItem(k), k);
  const favView = async p => { await p.click("#favnav"); await p.waitForSelector("#favorites"); };
  const cards = p => p.locator("#content .cwrap").count();
  const chips = p => p.locator("[data-gchip]").allInnerTexts();
  const FS = D.sections.find(x => x.items.filter(i => i.id).length >= 6), ids = FS.items.filter(i => i.id).slice(0, 6).map(i => i.id)   /* الرئيسية من غير كروت → بنفتح قسم فيه الكروت */, OLD = JSON.stringify([...ids.slice(0, 3), "itm-deleted-long-ago"]);

  /* ===== المفضلة القديمة (قبل ظهور المجموعات) ===== */
  let p = await env.mk(); await p.goto(BASE); await p.evaluate(v => localStorage.setItem("as-fav", v), OLD); await p.reload(); await p.waitForSelector("#tabs .chip", {state: "attached"}); await L.go(p, FS.id);
  T("old favorites (saved by the previous version) still show hearts on cards", await p.locator(".favbtn.on").count() === 3);
  T("favorites counter counts only existing items (stale id ignored)", await p.locator("#favcount").innerText() === "3");
  await favView(p); T("old favorites listed in «مفضلاتي»", await cards(p) === 3);
  T("no group UI clutter except the «new group» button before any group exists", await p.locator("[data-gchip]").count() === 1 && await p.locator("[data-gnew]").count() === 1);
  T("old favorites key is byte-for-byte untouched by merely viewing", await ls(p, "as-fav") === OLD);
  T("no groups key written until the user creates one", await ls(p, "as-fav-groups") === null);

  /* ===== إنشاء المجموعات ===== */
  await p.click("[data-gnew]"); T("form + 4 presets offered", await p.locator("#gname").count() === 1 && await p.locator("[data-gpreset]").count() === 4);
  await p.click('[data-gpreset="أدوات المونتاج"]'); T("preset creates its group and selects it", (await chips(p)).some(t => t.startsWith("أدوات المونتاج")) && await p.locator("[data-gchip].on").innerText().then(t => t.startsWith("أدوات المونتاج")));
  await p.click("[data-gnew]"); T("used preset no longer offered", await p.locator('[data-gpreset="أدوات المونتاج"]').count() === 0 && await p.locator("[data-gpreset]").count() === 3);
  for (const [name, why] of [["", "empty"], ["   ", "blank"], ["أدوات المونتاج", "duplicate"]]) { await p.fill("#gname", name); await p.keyboard.press("Enter"); await p.waitForTimeout(80); }
  T("empty / blank / duplicate names are rejected with a message, group count unchanged", (await chips(p)).length === 3 && /مجموعة|اسم/.test(await p.locator("#toast").innerText()), await chips(p));
  await p.fill("#gname", "  أدوات   التصميم  "); await p.keyboard.press("Enter");
  T("spaces are collapsed/trimmed in names", (await chips(p)).some(t => t.startsWith("أدوات التصميم") && !t.includes("  ")));
  await p.click("[data-gnew]"); await p.fill("#gname", "ب".repeat(80)); const maxLen = await p.locator("#gname").evaluate(i => i.maxLength); await p.keyboard.press("Enter");
  const stored = JSON.parse(await ls(p, "as-fav-groups")); T("name length capped at 30 (input + storage)", maxLen === 30 && stored.groups.every(g => g.name.length <= 30));
  await p.click("[data-gnew]"); await p.fill("#gname", "<img src=x onerror=window.__g=1>"); await p.keyboard.press("Enter"); await p.waitForTimeout(100);
  T("HTML in a group name is rendered as text, never executed", !(await p.evaluate(() => window.__g)) && await p.locator("#favorites img[src='x']").count() === 0 && (await chips(p)).some(t => t.includes("<img")));
  // الحد الأقصى 12
  for (let k = 0; k < 12; k++) { if (await p.locator("[data-gnew]").count()) { await p.click("[data-gnew]"); await p.fill("#gname", "g" + k); await p.keyboard.press("Enter"); await p.waitForTimeout(40); } }
  T("maximum 12 groups enforced", JSON.parse(await ls(p, "as-fav-groups")).groups.length === 12);
  // نرجع لمجموعتين نضيفتين
  await p.evaluate(() => localStorage.removeItem("as-fav-groups")); await p.reload(); await p.waitForSelector("#favorites");
  await p.click("[data-gnew]"); await p.fill("#gname", "تصميم"); await p.keyboard.press("Enter"); await p.click("[data-gnew]"); await p.fill("#gname", "ذكاء"); await p.keyboard.press("Enter");
  await p.click('[data-gchip="all"]');

  /* ===== التعيين والفلترة والعدّادات ===== */
  const cnt = async () => Object.fromEntries((await chips(p)).map(t => { const m = t.trim().match(/^(.*?)\s*(\d+)$/); return [m[1], +m[2]]; }));
  let c0 = await cnt(); T("counters: all=3, groups=0, none=3", c0["الكل"] === 3 && c0["تصميم"] === 0 && c0["بدون مجموعة"] === 3, c0);
  const sel = p.locator("[data-gsel]"); T("every favorite card has a labelled «move to group» select", await sel.count() === 3 && await sel.first().getAttribute("aria-label") !== null);
  await sel.nth(0).selectOption({label: "تصميم"}); await sel.nth(1).selectOption({label: "تصميم"}); await sel.nth(2).selectOption({label: "ذكاء"});
  c0 = await cnt(); T("counters update after assigning (2 / 1 / none 0)", c0["تصميم"] === 2 && c0["ذكاء"] === 1 && c0["بدون مجموعة"] === 0 && c0["الكل"] === 3, c0);
  await p.locator("[data-gchip]", {hasText: "تصميم"}).click(); T("group filter shows exactly its items", await cards(p) === 2);
  T("URL holds the group (#v=fav&g=…) and survives reload", /v=fav/.test(await p.evaluate(() => location.hash)) && /g=g-/.test(await p.evaluate(() => location.hash)));
  await p.reload(); await p.waitForSelector("#favorites"); T("after reload: same group still selected with 2 items", await cards(p) === 2 && (await p.locator("[data-gchip].on").innerText()).startsWith("تصميم"));
  await p.fill("#q", ALL.find(i => i.id === ids[0]).title.slice(0, 5)); T("search inside favorites + group works (never leaks other items)", await cards(p) <= 2); await p.fill("#q", "");
  await p.locator("[data-gchip]", {hasText: "ذكاء"}).click(); await p.locator("[data-gsel]").first().selectOption({label: "بدون مجموعة"});
  T("moving an item out of a group makes it disappear from that group view and counts follow", await cards(p) === 0 && (await cnt())["بدون مجموعة"] === 1);
  /* إلغاء المفضلة لعنصر في مجموعة */
  await p.locator("[data-gchip]", {hasText: "تصميم"}).click(); const victim = await p.locator(".favbtn").first().getAttribute("data-fav"); await p.locator(".favbtn").first().click();
  const gs = JSON.parse(await ls(p, "as-fav-groups")); T("un-favoriting removes the item from the group map and from as-fav", !(victim in gs.map) && !JSON.parse(await ls(p, "as-fav")).includes(victim) && (await cnt())["تصميم"] === 1);
  /* إعادة التسمية والحذف */
  await p.click("[data-grename]"); await p.fill("#gname", "تصميم جرافيك"); await p.keyboard.press("Enter"); T("rename keeps assignments", (await cnt())["تصميم جرافيك"] === 1);
  await p.click("[data-grename]"); await p.fill("#gname", "ذكاء"); await p.keyboard.press("Enter"); T("renaming to an existing name is rejected", (await cnt())["تصميم جرافيك"] === 1);
  await p.click("[data-gcancel]"); p.dialogs.length = 0; const before = JSON.parse(await ls(p, "as-fav")); await p.click("[data-gdel]"); await p.waitForTimeout(100);
  const after = JSON.parse(await ls(p, "as-fav"));
  T("deleting a group keeps every favorite (as-fav unchanged) and returns items to «no group»", JSON.stringify(before) === JSON.stringify(after) && (await cnt())["بدون مجموعة"] === 2 && !(await chips(p)).some(t => t.startsWith("تصميم جرافيك")), await cnt());
  /* الحفاظ على بيانات المستخدم القديمة بعد كل ده */
  const fin = JSON.parse(await ls(p, "as-fav")); T("old favorite ids (incl. the stale one) are all still stored after all group operations", ["itm-deleted-long-ago", ...ids.slice(0, 3)].filter(x => x !== victim).every(x => fin.includes(x)), fin);
  T("deleting group asked for confirmation", p.dialogs.some(d => /تحذف/.test(d)));
  /* ===== عمل مفضلة جديدة بعد المجموعات ===== */
  await p.click("[data-favback]"); await L.go(p, FS.id); await p.locator(`.favbtn[data-fav="${ids[5]}"]`).click(); await favView(p).catch(() => {}); T("new favorites after groups exist work normally", JSON.parse(await ls(p, "as-fav")).includes(ids[5]));

  /* ===== تخزين تالف / خبيث ===== */
  const bad = [["{{{", "not JSON"], ["null", "null"], ['"str"', "string"], ["[]", "array"], ['{"groups":"x"}', "groups not array"], ['{"groups":[{"id":"bad id","name":"x"},{"id":"g-abc123"},{"id":"g-abc123","name":"ok"},{"id":"g-abc123","name":"dup"},{"id":5,"name":"n"}],"map":{"a":"g-abc123","b":"nope","c":5,"__proto__":"g-abc123"}}', "mixed garbage"],
    [JSON.stringify({groups: Array.from({length: 40}, (_, k) => ({id: "g-" + String(k).padStart(4, "0") + "a", name: "n" + k})), map: {}}), "40 groups"], [JSON.stringify({groups: [{id: "g-x1y2z3", name: "<img src=x onerror=window.__g=2>"}], map: {}}), "xss name"]];
  let badRes = [];
  for (const [val, why] of bad) {
    const q = await env.mk(); await q.goto(BASE); await q.evaluate(([v, f]) => { localStorage.setItem("as-fav-groups", v); localStorage.setItem("as-fav", f); }, [val, JSON.stringify(ids.slice(0, 2))]); await q.reload(); await q.waitForSelector("#tabs .chip", {state: "attached"});
    await favView(q); const n = await q.locator("[data-gchip]").count(); if (q.errs.length || await q.evaluate(() => window.__g) || n > 14 || await cards(q) !== 2) badRes.push(why + ":" + q.errs[0] + n);
    await q.locator("[data-gnew]").click(); await q.fill("#gname", "جديدة"); await q.keyboard.press("Enter"); if (q.errs.length) badRes.push(why + " after add");
    await q.context().close();
  }
  T(`${bad.length} corrupt/hostile group storages: no errors, sanitized, favorites intact, still usable`, badRes.length === 0, badRes);
  const bf = [["{{{"], ['{"a":1}'], ['"x"'], ["[1,null,{},[],\"" + "x".repeat(200) + "\"," + JSON.stringify(ids[0]) + "]"]]; let bfBad = [];
  for (const [v] of bf) { const q = await env.mk(); await q.goto(BASE); await q.evaluate(v => localStorage.setItem("as-fav", v), v); await q.reload(); await q.waitForSelector("#tabs .chip", {state: "attached"}); const t = await q.locator("#favcount").innerText().catch(() => ""); if (q.errs.length) bfBad.push(v.slice(0, 10)); await q.context().close(); }
  T("corrupt as-fav (old key) never breaks the site", bfBad.length === 0, bfBad);
  T("a valid id inside a polluted as-fav array is still recognized", await (async () => { const q = await env.mk(); await q.goto(BASE); await q.evaluate(v => localStorage.setItem("as-fav", v), bf[3][0]); await q.reload(); await q.waitForSelector("#tabs .chip", {state: "attached"}); await L.go(q, FS.id); return await q.locator(".favbtn.on").count() === 1; })());
  /* URL */
  const u1 = await open(null, "#v=fav&g=g-nonexist"); T("unknown group in URL ignored (shows all favorites view)", await u1.locator("#favorites").count() === 1 && await u1.locator("[data-gchip].on").count() <= 1 && u1.errs.length === 0);
  const u2 = await env.mk(); await u2.goto(BASE + "#s=" + FS.id); await u2.waitForSelector(".favbtn"); await u2.evaluate(() => { localStorage.setItem("as-fav", '["' + document.querySelector(".favbtn").dataset.fav + '"]'); localStorage.setItem("as-fav-groups", '{"v":1,"groups":[{"id":"g-aaa111","name":"س"}],"map":{}}'); }); await u2.goto(BASE + "#v=fav&g=none"); await u2.reload(); await u2.waitForSelector("#favorites");
  T("#g=none shows the no-group view", await cards(u2) === 1);
  /* لوحة المفاتيح */
  const k = await open(null); await k.locator(".favbtn").first().focus(); await k.keyboard.press("Enter"); T("favorite toggles with keyboard (Enter) and exposes aria-pressed", await k.locator(".favbtn").first().getAttribute("aria-pressed") === "true");
  await k.keyboard.press("Space"); T("Space toggles back", await k.locator(".favbtn").first().getAttribute("aria-pressed") === "false");
  /* ثبات عبر جلسات */
  const ctx = await env.browser.newContext(); const a = await ctx.newPage(); await a.goto(BASE + "#s=" + FS.id); await a.waitForSelector(".favbtn"); await a.locator(".favbtn").nth(1).click(); await a.close();
  const b = await ctx.newPage(); await b.goto(BASE + "#s=" + FS.id); await b.waitForSelector(".favbtn"); T("favorites persist across tabs/sessions of the same browser", await b.locator(".favbtn.on").count() === 1);
  T("no JS errors in any favorites scenario", p.errs.length === 0 && k.errs.length === 0, p.errs);
  await H.end(env);
})().catch(e => { console.error("CRASH", e); process.exit(2); });
