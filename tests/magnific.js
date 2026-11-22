/* تصنيف Magnific (محتوى مجاني ومدفوع – أدوات AI مدفوعة): البيانات، البحث، الفلاتر، الكارت، لوحة الإدارة. التشغيل: node tests/magnific.js */
const L = require("./lib"), H = L.harness("magnific"), {T} = H, {path} = L;
const D = L.loadData(path.join(L.SITE_DIR, "data/data.js")), all = D.sections.flatMap(s => s.items.map(i => ({...i, sec: s.id})));
const M = all.filter(i => /magnific/i.test(i.title)), m = M[0];
const PHRASE = "محتوى مجاني ومدفوع – أدوات AI مدفوعة";
(async () => {
  T("data: exactly one Magnific item", M.length === 1);
  T("data: description states the split with the required wording", m.desc.includes(PHRASE), m.desc);
  T("data: description says stock = free + paid content, AI tools = fully paid; no longer claims a free AI credit", /Stock Assets[^.]*مجاني[^.]*مدفوع/.test(m.desc) && /الذكاء الاصطناعي[^.]*مدفوعة بالكامل/.test(m.desc) && !/رصيد يومي مجاني/.test(m.desc));
  T("data: price = «مجاني محدود» (mixed platform: not plain free, not plain paid); legacy tag untouched", m.price === "مجاني محدود" && m.tag === "مجاني محدود" && !("category" in m));
  T("data: url/id/type unchanged", m.url === "https://magnific.com/" && m.id === "itm-de9b5ce3" && m.type === "link");
  const env = await H.start({}), p = await env.mk(); await p.goto(env.BASE + "#s=" + m.sec); await p.waitForSelector("#tabs .chip", {state: "attached"});
  const titles = async () => p.locator("#content h3").allInnerTexts(), has = async () => (await titles()).includes("Magnific");
  const nav = async h => { await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(120); };
  T("site: card shows the «مجاني محدود» price badge (not paid red, not free)", (await p.locator('.cwrap:has(h3 .t:text-is("Magnific")) .pbadge').allInnerTexts()).join() === "مجاني محدود" && await p.locator('.cwrap:has(h3 .t:text-is("Magnific")) .pbadge.paid').count() === 0 && await p.locator('.cwrap:has(h3 .t:text-is("Magnific")) .pbadge.free').count() === 0);
  T("site: card description shows the new wording", (await p.locator('.cwrap:has(h3 .t:text-is("Magnific")) p').innerText()).includes(PHRASE));
  await nav("#s=" + m.sec + "&p=" + encodeURIComponent("مجاني محدود")); T("old «مجاني محدود» URL value is ignored safely (merged into «مجاني»): Magnific still listed", await has());
  await nav("#s=" + m.sec + "&p=" + encodeURIComponent("مجاني")); T("filter «مجاني» includes Magnific (limited-free counts as free in the unified filter)", await has());
  await nav("#s=" + m.sec + "&p=" + encodeURIComponent("مدفوع")); T("filter «مدفوع» does NOT include Magnific (it has free content)", !(await has()));
  await nav("#s=" + m.sec); T("without a price filter Magnific is listed", await has());
  for (const q of ["Magnific", "magnific", "Freepik AI", "stock assets", "أدوات AI مدفوعة", "محتوى مجاني ومدفوع"]) { await nav("#q=" + encodeURIComponent(q)); await p.waitForSelector("#tabs .chip, .empty"); T(`search «${q}» finds Magnific`, await has()); }
  // تغيير مقصود (المرحلة 2): فلتر السعر بقى جوه أقسام المواقع والأدوات بس، فالعدّ بيتم قسم قسم ومجموعه لازم يطابق البيانات (مفيش عنصر اتحرّك)
  const priced = D.sections.filter(s => new Set(s.items.filter(i => i.type === "link").map(i => String(i.price ?? "")).filter(Boolean)).size >= 2), counts = {}, ref = {};
  // المرحلة 4: فلتر موحّد — «مجاني» بيشمل المجاني المحدود وغير المسعّر، ومفيش شيب «مجاني محدود» منفصل
  const pvOf = i => { const v = String(("price" in i ? i.price : i.tag) ?? "").trim(); return ["مجاني", "مجاني محدود", "مدفوع"].includes(v) ? v : ""; };
  for (const f of ["مجاني", "مدفوع"]) { counts[f] = 0; ref[f] = 0; for (const s of priced) { await nav("#s=" + s.id + "&p=" + encodeURIComponent(f)); await p.waitForSelector("#tabs .chip, .empty"); counts[f] += await p.locator("#content .cwrap").count(); ref[f] += s.items.filter(i => (f === "مجاني" ? pvOf(i) !== "مدفوع" : pvOf(i) === "مدفوع")).length; } }
  T(`price-filter counts across the ${priced.length} tools sections still match the data (no other item moved)`, counts["مجاني"] === ref["مجاني"] && counts["مدفوع"] === ref["مدفوع"] && priced.some(s => s.id === m.sec), {counts, ref});
  await nav("#i=" + m.id); await p.waitForTimeout(500); T("permalink to Magnific opens and highlights it", await p.locator(`#content [data-id="${m.id}"]`).count() === 1);
  T("no JS errors on the site", p.errs.length === 0, p.errs);
  /* لوحة الإدارة */
  const a = await env.mk(); await a.goto(env.ADMIN); await a.waitForSelector(".item"); const idx = all.findIndex(i => i.id === m.id), row = a.locator(".item:not(.upd)").nth(idx);
  T("admin: row shows title/price/description exactly", (await row.locator('[data-f="title"]').inputValue()) === "Magnific" && (await row.locator('[data-f="price"]').inputValue()) === "مجاني محدود" && (await row.locator('[data-f="desc"]').inputValue()) === m.desc);
  const out = L.parseData(await L.download(a, "#download", L.tmpdir())), mo = out.sections.flatMap(s => s.items).find(i => i.id === m.id);
  T("admin: validation passes and export keeps Magnific unchanged (desc/price/tag)", mo && mo.desc === m.desc && mo.price === "مجاني محدود" && mo.tag === "مجاني محدود");
  await a.fill("#asearch", "magnific"); T("admin search finds it", (await a.locator(".item:not(.upd):visible").count()) === 1);
  T("no JS errors in admin", a.errs.length === 0, a.errs);
  await H.end(env);
})().catch(e => { console.error("CRASH", e); process.exit(2); });
