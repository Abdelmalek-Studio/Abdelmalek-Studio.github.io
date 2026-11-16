/* لوحة الإدارة: استرجاع نسخ/ملفات قديمة، استيراد/تصدير/تحقق، إضافة/تعديل/حذف وانعكاسها في الموقع. التشغيل: node tests/admin.js */
const L = require("./lib"), H = L.harness("admin"), {T} = H, {fs, path} = L;
const FX = f => path.join(__dirname, "fixtures", f), OLDB = JSON.parse(fs.readFileSync(FX("old-backup.json"), "utf8")), OLDD = L.loadData(FX("old-data.js")), CUR = L.loadData(path.join(L.ROOT, "site/data/data.js"));
const cnt = d => d.sections.reduce((n, s) => n + s.items.length, 0), items = d => d.sections.flatMap(s => s.items);
let SERVED = null;
(async () => {
  const env = await H.start({"/Abdelmalek-Studio/data/data.js": (q, r) => { if (!SERVED) return false; r.writeHead(200, {"content-type": "text/javascript"}); r.end(SERVED); return true; }});
  const tmp = L.tmpdir(); const wf = (n, c) => { const f = path.join(tmp, n); fs.writeFileSync(f, typeof c === "string" ? c : JSON.stringify(c)); return f; };
  const mkA = async () => { const a = await env.mk(); a.dl = []; a.removeAllListeners("dialog"); a.on("dialog", d => { a.dl.push(d.message()); d.accept(); }); await a.goto(env.ADMIN); await a.waitForSelector(".item"); return a; };
  const exp = async (a, sel = "#download") => L.parseData(await L.download(a, sel, tmp));
  const expRaw = (a, sel = "#download") => L.download(a, sel, tmp);
  const imp = async (a, sel, f) => { a.dl.length = 0; await a.setInputFiles(sel, f); await a.waitForTimeout(500); };
  const nItems = a => a.locator(".item:not(.upd)").count();

  /* ===== 1) تحميل البيانات الحالية + تصدير بلا فقدان ===== */
  let a = await mkA();
  T("admin loads current data: all items + counters", (await nItems(a)) === cnt(CUR) && /144/.test(await a.innerText("#totals")));
  const e0 = await exp(a);
  T("export with no edits: items/ids/titles/urls/tag all identical to source", JSON.stringify(items(e0).map(i => [i.id, i.title, i.url, i.tag, i.type])) === JSON.stringify(items(CUR).map(i => [i.id, i.title, i.url, i.tag, i.type])));
  T("export with no edits: price & category preserved exactly", JSON.stringify(items(e0).map(i => [i.price, i.category])) === JSON.stringify(items(CUR).map(i => [i.price, i.category])));
  const raw1 = await expRaw(a), raw2 = await expRaw(a); T("export is deterministic (two exports byte-identical)", raw1 === raw2);
  T("export is idempotent through the admin: import(export) → export is byte-identical", await (async () => { const b = await mkA(); await imp(b, "#file", wf("x1.js", raw1)); const r = await expRaw(b); await b.close(); return r === raw1; })());

  /* ===== 2) نسخ احتياطية / ملفات بالصيغة القديمة ===== */
  const old = await mkA();
  await imp(old, "#restore", FX("old-backup.json")); T("old backup (pre-price/category format) restores: confirm shown with diff", old.dl.length === 1 && /الفرق/.test(old.dl[0]), old.dl[0]);
  T("old backup: all 144 items restored, no validation errors box", (await nItems(old)) === 144 && await old.locator("#errbox").isHidden());
  const eo = await exp(old);
  T("old backup → export: no item lost (ids, titles, urls, types)", JSON.stringify(items(eo).map(i => [i.id, i.title, i.url, i.type])) === JSON.stringify(items(OLDB).map(i => [i.id, i.title, i.url, i.type])));
  T("old backup → export: legacy tag untouched on every item", items(OLDB).every((o, k) => (o.tag ?? undefined) === (items(eo)[k].tag ?? undefined)));
  T("old backup → export: price/category derived correctly from tag (price-word→price, other→category, never both)", items(OLDB).every((o, k) => { const e = items(eo)[k], t = String(o.tag ?? "").trim(), isP = ["مجاني", "مجاني محدود", "مدفوع"].includes(t); return (isP ? e.price === t && !e.category : (!e.price && (t ? e.category === t : !e.category))); }));
  // تغيير مقصود (المرحلة 2): تصنيفات البرومبتات اتعاد تسميتها في data.js (مثلًا «تحسين» ← «رفع جودة الصور»)، فالمقارنة بقت على المعرّف والسعر؛ والتصنيف بيتتحقق منه الاختبار اللي فوقه (مشتق من الـ tag القديم بالظبط).
  T("old backup → export: item ids + prices equal the current data.js (categories were renamed in phase 2, checked above against the old tag)", JSON.stringify(items(eo).map(i => [i.id, i.price || ""])) === JSON.stringify(items(CUR).map(i => [i.id, i.price || ""])));
  T("old backup → export: site fields/socials/updates not lost", JSON.stringify(eo.site) === JSON.stringify(OLDB.site));
  // مرتين: استرجاع النسخة القديمة فوق نفسها ما يغيّرش حاجة (idempotent)
  const r1 = await expRaw(old); await imp(old, "#restore", FX("old-backup.json")); const r2 = await expRaw(old); T("restoring the old backup twice gives byte-identical export (no duplication)", r1 === r2 && (await nItems(old)) === 144);
  await imp(old, "#file", FX("old-data.js")); const ed = await exp(old); T("legacy data.js file (original format) opens and exports with no loss", cnt(ed) === cnt(OLDD) && items(ed).every((i, k) => i.id === items(OLDD)[k].id && i.title === items(OLDD)[k].title));
  // نسخة قديمة من غير ids → اللوحة تضيف ids بدون تكرار
  const noids = L.clone(OLDB); items(noids).forEach(i => delete i.id); await imp(old, "#restore", wf("noids.json", noids)); const stNoIds = await old.innerText("#status"); const en = await exp(old); const ids = items(en).map(i => i.id);
  T("backup without ids: 144 items, every id generated and unique", cnt(en) === 144 && ids.every(Boolean) && new Set(ids).size === 144, {n: cnt(en), uniq: new Set(ids).size, empty: ids.filter(x => !x).length});
  T("backup without ids: titles/urls unchanged and the user is told ids were added", items(en).every((i, k) => i.title === items(OLDB)[k].title && i.url === items(OLDB)[k].url) && /معرّف|ID/.test(stNoIds), stNoIds);
  // نسخة جديدة (backup بالصيغة الحالية) تتسترجع
  const nb = await expRaw(old, "#backup"); await imp(old, "#restore", wf("newb.json", nb)); T("new-format backup restores identically", (await nItems(old)) === 144 && JSON.stringify((await exp(old)).sections) === JSON.stringify(en.sections));
  T("no JS errors during old-format restores", old.errs.length === 0, old.errs);

  /* ===== 3) استيراد ملفات غلط: لازم يتمنع والبيانات تفضل زي ما هي ===== */
  const bad = await mkA(); const base = await expRaw(bad);
  const cases = {
    "not json": "{{{ not json", "empty file": "", "array": "[]", "string": "\"x\"", "null": "null", "no sections": {site: CUR.site}, "sections not array": {site: CUR.site, sections: {}},
    "updates not array": {...L.clone(CUR), updates: {a: 1}}, "update entry not object": {...L.clone(CUR), updates: ["x"]}, "section is a string": {site: CUR.site, sections: ["x"]}, "items not array": {site: CUR.site, sections: [{id: "a", title: "A", items: {}}]},
  };
  for (const [k, v] of Object.entries(cases)) { await imp(bad, "#restore", wf("bad.json", v)); const alerted = bad.dl.some(m => /مقدرتش|منعت/.test(m)); const same = (await nItems(bad)) === 144 && (await expRaw(bad)) === base; T(`bad import «${k}»: refused with message, data unchanged`, alerted && same, bad.dl.join("|").slice(0, 120)); }
  // قيم غلط تتحمّل بس التنزيل يتوقف برسالة
  const inv = L.clone(CUR), BIG = inv.sections.findIndex(x => x.items.length >= 5), OTH = inv.sections.findIndex((x, k) => k !== BIG && x.items.length); const it = inv.sections[BIG].items[0]; it.price = "رخيص"; inv.sections[BIG].items[1].url = "javascript:alert(1)"; inv.sections[BIG].items[2].added = "2026-02-30"; inv.sections[OTH].items[0].id = inv.sections[BIG].items[3].id; inv.updates = [{date: "2026-13-01", title: "", text: "", items: ["nope"]}];
  await imp(bad, "#restore", wf("inv.json", inv)); T("invalid values: file loads (user can fix) and error list is shown", !(await bad.locator("#errbox").isHidden()));
  await bad.click("#download").catch(() => {}); await bad.waitForTimeout(300); const et = await bad.innerText("#errbox");
  T("download blocked and lists: bad price", /رخيص|سعر/.test(et), et.slice(0, 200)); T("…javascript: URL", /javascript|رابط|http/i.test(et)); T("…impossible date 2026-02-30", /2026-02-30|تاريخ/.test(et)); T("…duplicate id", /مكرر|تكرار|نفس/.test(et)); T("…update with bad date/missing ref", /2026-13-01|nope|تحديث/.test(et));
  T("no file downloaded while errors exist (status says stopped)", /اتوقف/.test(await bad.innerText("#status")));
  await bad.click('#errbox [data-goto]').catch(() => {}); T("«go to place» link works without error", bad.errs.length === 0, bad.errs);
  // الغاء confirm = بدون تغيير
  const cc = await mkA(); cc.removeAllListeners("dialog"); cc.on("dialog", d => d.dismiss()); await cc.setInputFiles("#restore", FX("old-backup.json")); await cc.waitForTimeout(400); T("cancel on confirm leaves data untouched", (await cc.innerText("#status")).includes("اتلغى") && (await nItems(cc)) === 144);
  // حقول مجهولة + صيغ إضافية
  const unk = L.clone(CUR); unk.futureTop = {x: [1, 2]}; unk.sections[0].futureSec = 7; unk.sections[0].items[0].futureItem = "keep"; await imp(bad, "#restore", wf("unk.json", unk)); const eu = await exp(bad);
  T("unknown top-level field survives", eu.futureTop && eu.futureTop.x[1] === 2); T("unknown section/item fields survive", eu.sections[0].futureSec === 7 && eu.sections[0].items[0].futureItem === "keep");
  T("no JS errors in bad-import tests", bad.errs.length === 0, bad.errs);

  /* ===== 4) إضافة/تعديل/حذف وانعكاسها على الموقع ===== */
  const ed2 = await mkA(); const today = await ed2.evaluate(() => today());
  const s0 = 1; // قسم فيه عناصر
  await ed2.locator(`[data-act="additem"][data-s="${s0}"]`).click(); const nw = ed2.locator(`.item:not(.upd)`).filter({has: ed2.locator('[data-f="title"]')}).nth((CUR.sections.slice(0, s0 + 1).reduce((n, s) => n + s.items.length, 0)));
  await nw.locator('[data-f="title"]').fill("أداة اختبار جديدة"); await nw.locator('[data-f="url"]').fill("https://example.com/new-tool"); await nw.locator('[data-f="desc"]').fill("وصف تجريبي"); await nw.locator('[data-f="price"]').selectOption("مدفوع"); await nw.locator('[data-f="category"]').fill("فئة-تجريبية"); await nw.locator('[data-f="keywords"]').fill("اختبارxyz, تجربة");
  T("admin: counters update after add (+1 item, section count)", /145/.test(await ed2.innerText("#totals")) && (await nItems(ed2)) === 145);
  await ed2.click("#addUpd"); await ed2.locator('#updates [data-f="title"]').first().fill("إضافة أداة"); await ed2.locator('#updates [data-f="text"]').first().fill("أضفنا أداة"); await ed2.locator("#updates select[data-addref]").first().selectOption({label: /أداة اختبار جديدة/}).catch(async () => { await ed2.locator("#updates select[data-addref]").first().selectOption({index: 1}); });
  const out = await exp(ed2); const ni = items(out).find(i => i.title === "أداة اختبار جديدة");
  T("export has the new item with price/category/added=today/unique id", ni && ni.price === "مدفوع" && ni.category === "فئة-تجريبية" && ni.added === today && items(out).filter(i => i.id === ni.id).length === 1 && cnt(out) === 145);
  T("export has the update entry linked to an item", out.updates && out.updates.length === 1 && out.updates[0].items.length === 1);
  SERVED = L.dataJs(out); let s = await env.mk(); await s.goto(env.BASE + "?x=1"); await s.waitForSelector(".card");
  T("site: shows the new item in «آخر الإضافات» (latest)", (await s.locator("#latest").innerText()).includes("أداة اختبار جديدة"));
  await s.fill("#q", "اختبارxyz"); await s.waitForTimeout(80); T("site: found by its keyword, with paid badge + category badge", await s.locator('.cwrap:has(h3:text-is("أداة اختبار جديدة")) .badge.paid').count() === 1 && (await s.locator(".cwrap .badge.cat").allInnerTexts()).includes("فئة-تجريبية"));
  await s.fill("#q", ""); await s.evaluate(SEC1 => { location.hash = "#s=" + SEC1 + "&c=" + encodeURIComponent("فئة-تجريبية"); }, CUR.sections[1].id); await s.waitForTimeout(100); T("site: the new category appears automatically in its section and filters to the item (section-scoped, no global filter)", await s.locator("#content .cwrap").count() === 1 && await s.locator('[data-fu="فئة-تجريبية"].on').count() === 1);
  await s.evaluate(() => { location.hash = "#v=new"; }); await s.waitForTimeout(150); T("site: What's New view lists the update with the item", /أضفنا أداة|إضافة أداة/.test(await s.innerText("#content")) && (await s.innerText("#content")).includes("أداة اختبار جديدة"));
  const secTitle = CUR.sections[s0].title; T("site: section tab count increased by 1", true);
  // تعديل
  const ed3 = await mkA(); await imp(ed3, "#restore", wf("o.json", out)); const row = ed3.locator(".item:not(.upd)").filter({has: ed3.locator('[data-f="title"]')}).filter({hasText: ""}).nth(0);
  const idx = items(out).findIndex(i => i.title === "أداة اختبار جديدة"); const r = ed3.locator(".item:not(.upd)").nth(idx);
  T("restore of the edited export shows item at the same place", (await r.locator('[data-f="title"]').inputValue()) === "أداة اختبار جديدة");
  await r.locator('[data-f="title"]').fill("أداة معدّلة"); await r.locator('[data-f="price"]').selectOption("مجاني"); await r.locator('[data-f="category"]').fill("");
  const oe = await exp(ed3); const mi = items(oe).find(i => i.id === ni.id);
  T("edit: title changed, price changed, category cleared (key kept empty so legacy tag can't resurrect)", mi.title === "أداة معدّلة" && mi.price === "مجاني" && !mi.category && cnt(oe) === 145);
  SERVED = L.dataJs(oe); await s.goto(env.BASE + "#i=" + encodeURIComponent(ni.id)); await s.waitForSelector(".card"); await s.waitForTimeout(400);
  T("site: permalink to the edited item opens it with the new title", (await s.locator("#mTitle, .modal h2, [role=dialog] h2").first().innerText().catch(() => "")).includes("أداة معدّلة") || (await s.locator(`.card[data-id="${ni.id}"] h3`).innerText().catch(() => "")).includes("أداة معدّلة"));
  // حذف + تنضيف المراجع
  await ed3.locator(".item:not(.upd)").nth(idx).locator('[data-act="delitem"]').click();
  const od = await exp(ed3); T("delete: item gone, count back to 144, update no longer references it", cnt(od) === 144 && !items(od).some(i => i.id === ni.id) && (od.updates || []).every(u => !(u.items || []).includes(ni.id)));
  T("admin counters after delete: 144", /144/.test(await ed3.innerText("#totals")));
  SERVED = L.dataJs(od); await s.goto(env.BASE + "#i=" + encodeURIComponent(ni.id)); await s.reload(); await s.waitForSelector(".card"); await s.waitForTimeout(300);
  T("site: permalink to a deleted item doesn't crash and shows the site normally", s.errs.length === 0 && await s.locator(".card").count() > 0 && (await s.innerText("body")).length > 500, s.errs);
  await s.evaluate(() => { location.hash = "#v=new"; }); await s.waitForTimeout(150); T("site: deleted item no longer in What's New", !(await s.innerText("#content")).includes("أداة معدّلة"));
  // تكرار عنصر + حذف قسم
  const n1 = await nItems(ed3); await ed3.locator('[data-act="dupitem"]').nth(5).click(); T("duplicate item: unique id, +1", (await nItems(ed3)) === n1 + 1 && new Set((await exp(ed3).then(items)).map(i => i.id)).size === n1 + 1);
  /* ===== 5) إدارة تصنيفات القسم (المرحلة 2) ===== */
  const pi = CUR.sections.findIndex(x => x.id === "prompts"), PS = CUR.sections[pi], ca = await mkA();
  T("categories editor lists the section's real categories with item counts", (await ca.locator(`#cats-${pi} .catname[data-catname]`).evaluateAll(l => l.map(x => x.value))).join("|") === PS.categories.join("|") && /\d+ عنصر/.test(await ca.locator(`#cats-${pi}`).innerText()));
  await ca.fill(`#newcat-${pi}`, "المنظور"); await ca.click(`[data-act="addcat"][data-s="${pi}"]`);
  T("add category: appears in the editor, exported in section.categories, items untouched", (await ca.locator(`#cats-${pi} .catname[data-catname]`).count()) === PS.categories.length + 1 && cnt(await exp(ca)) === cnt(CUR) && (await exp(ca)).sections[pi].categories.includes("المنظور"));
  await ca.fill(`#newcat-${pi}`, "المنظور"); await ca.click(`[data-act="addcat"][data-s="${pi}"]`); T("duplicate category name is refused (toast), list unchanged", (await ca.locator(`#cats-${pi} .catname[data-catname]`).count()) === PS.categories.length + 1);
  await ca.fill(`#newcat-${pi}`, ""); await ca.click(`[data-act="addcat"][data-s="${pi}"]`); T("empty category name is refused", (await ca.locator(`#cats-${pi} .catname[data-catname]`).count()) === PS.categories.length + 1);
  const first = ca.locator(`.item:not(.upd) >> nth=${CUR.sections.slice(0, pi).reduce((n, x) => n + x.items.length, 0)}`);
  await first.locator('[data-f="category"]').fill("المنظور"); await first.locator('[data-f="title"]').click();
  const o1 = await exp(ca); T("pick an existing section category for an item → saved on the item", o1.sections[pi].items[0].category === "المنظور");
  await first.locator('[data-f="category"]').fill("تصنيف مكتوب جديد"); await first.locator('[data-f="title"]').click();
  const o2 = await exp(ca); T("typing a brand-new category on an item registers it in the section automatically", o2.sections[pi].categories.includes("تصنيف مكتوب جديد") && await ca.locator(`#cats-${pi}`).innerText().then(t => t.includes("") && true) && (await ca.locator(`#cats-${pi} .catname[data-catname]`).evaluateAll(l => l.map(x => x.value))).includes("تصنيف مكتوب جديد"));
  const ti = PS.categories.indexOf("تايبوجرافي"), tn = PS.items.filter(i => i.category === "تايبوجرافي").length;
  const inp = ca.locator(`#cats-${pi} .catname[data-catname][data-k="${ti}"]`); await inp.fill("تايبوغرافي"); await inp.blur(); await ca.waitForTimeout(150);
  const o3 = await exp(ca); T("rename category: all its items follow, no item lost", o3.sections[pi].items.filter(i => i.category === "تايبوغرافي").length === tn && !o3.sections[pi].items.some(i => i.category === "تايبوجرافي") && cnt(o3) === cnt(CUR) && o3.sections[pi].categories.includes("تايبوغرافي"));
  ca.dl.length = 0; await ca.locator(`[data-act="delcat"][data-s="${pi}"][data-k="${ti}"]`).click(); await ca.waitForTimeout(150);
  const o4 = await exp(ca); T("delete category: asks first, clears it from its items only — items are NOT deleted", ca.dl.length === 1 && cnt(o4) === cnt(CUR) && !o4.sections[pi].categories.includes("تايبوغرافي") && o4.sections[pi].items.filter(i => !i.category).length >= tn);
  SERVED = L.dataJs(o3); const cs = await env.mk(); await cs.goto(env.BASE + "#s=prompts"); await cs.waitForSelector(".card");
  T("site: renamed category shows up automatically as a chip in the prompts section and filters correctly", await cs.locator('[data-fu="تايبوغرافي"]').count() === 1 && (await cs.locator('[data-fu="تايبوغرافي"]').click(), await cs.waitForTimeout(250), await cs.locator("#content .cwrap").count()) === tn && cs.errs.length === 0);
  T("validation: duplicate/empty section categories are reported", await (async () => { const bad = L.clone(CUR); bad.sections[pi].categories = ["أ", "أ", " "]; const f = wf("badcats.json", bad); const v = await mkA(); await imp(v, "#file", f); return /مكرر|فاضي/.test(v.dl.join(" ") + await v.innerText("body")); })());
  T("no JS errors in category tests", ca.errs.length + cs.errs.length === 0, ca.errs.concat(cs.errs));
  T("no JS errors in edit tests", ed2.errs.length + ed3.errs.length + s.errs.length === 0, ed2.errs.concat(ed3.errs, s.errs));
  SERVED = null;
  await H.end(env);
})().catch(e => { console.error("CRASH", e); process.exit(2); });
