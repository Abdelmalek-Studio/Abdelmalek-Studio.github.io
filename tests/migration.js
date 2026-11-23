/* ترحيل البيانات (tag → price/category): تكرار التشغيل آمن، مفيش فقدان ولا تكرار ولا تصنيف غلط.
   + نفس قواعد القراءة (priceOf/categoryOf) في الموقع واللوحة. التشغيل: node tests/migration.js */
const L = require("./lib"), {spawnSync} = require("child_process"), crypto = require("crypto");
const H = L.harness("migration"), {T} = H, tmp = L.tmpdir();
const PRICES = ["مجاني", "مجاني محدود", "مدفوع"];
const sha = f => crypto.createHash("sha256").update(L.fs.readFileSync(f)).digest("hex");
const run = (f, extra = []) => spawnSync(process.execPath, [L.path.join(L.ROOT, "tools/migrate-price-category.js"), "--file", f, ...extra], {encoding: "utf8"});
const items = d => d.sections.flatMap(s => s.items);
(async () => {
  /* 1) البيانات الحقيقية القديمة (نسخة الأصل قبل أي تعديل) */
  const legacyF = tmp + "/legacy.js"; L.fs.copyFileSync(L.path.join(__dirname, "fixtures/legacy-site-data.js"), legacyF);
  const legacy = L.loadData(legacyF), nLegacy = items(legacy).length;
  T("legacy fixture has no price/category (really old format)", items(legacy).every(i => !("price" in i) && !("category" in i)));
  const r1 = run(legacyF); const h1 = sha(legacyF), d1 = L.loadData(legacyF);
  T("run #1 migrates (stdout reports counts)", r1.status === 0 && /price: 124/.test(r1.stdout) && /category: 20/.test(r1.stdout), r1.stdout.trim());
  const r2 = run(legacyF), h2 = sha(legacyF), r3 = run(legacyF), h3 = sha(legacyF);
  T("run #2 and #3 leave the file byte-identical (idempotent)", h1 === h2 && h2 === h3, [h1.slice(0, 8), h2.slice(0, 8), h3.slice(0, 8)]);
  T("re-runs report 0 changes", /price: 0 \| category: 0/.test(r2.stdout) && /price: 0 \| category: 0/.test(r3.stdout), r3.stdout.trim());
  T("no items lost or duplicated (count + unique ids + same order)", items(d1).length === nLegacy && new Set(items(d1).map(i => i.id)).size === nLegacy && JSON.stringify(items(d1).map(i => i.id)) === JSON.stringify(items(legacy).map(i => i.id)));
  T("section count, ids and per-section item counts unchanged", JSON.stringify(d1.sections.map(s => [s.id, s.items.length])) === JSON.stringify(legacy.sections.map(s => [s.id, s.items.length])));
  const strip = d => { const c = L.clone(d); items(c).forEach(i => { delete i.price; delete i.category; }); return c; };
  // تغيير مقصود موثّق (المرحلة 2): كل قسم ممكن يبقى له `categories` (قايمة تصنيفات القسم) — حقل جديد بيتشال هنا قبل المقارنة؛ قيم category نفسها بتتشال زي price.
  const stripCats = d => { d.sections.forEach(s => { delete s.categories; }); return d; };
  T("after removing price/category the data equals the legacy data exactly (nothing else touched, `tag` kept)", JSON.stringify(strip(d1)) === JSON.stringify(legacy));
  let wrong = [];
  items(legacy).forEach((o, k) => { const n = items(d1)[k], t = typeof o.tag === "string" ? o.tag.trim() : "";
    const expP = PRICES.includes(t) ? t : undefined, expC = t && !PRICES.includes(t) ? t : undefined;
    if (n.price !== expP || n.category !== expC) wrong.push(o.title + ":" + o.tag + "→" + n.price + "/" + n.category); });
  T("every item got exactly the right field (price-word → price, anything else → category, no tag → nothing)", wrong.length === 0, wrong.slice(0, 3));
  T("no item has both price and category from the same tag; items without tag stay without both", items(d1).every(i => !(i.price && i.category)) && items(legacy).every((o, k) => o.tag || (!("price" in items(d1)[k]) && !("category" in items(d1)[k]))));
  T("prompts keep their usage category, tools keep their price", items(d1).filter(i => i.type === "prompt").every((i, k) => i.category === items(legacy).filter(x => x.type === "prompt")[k].tag && !i.price));
  T("file format preserved (header comment + window.STUDIO_DATA)", /^\/\*.*\*\/\s*\nwindow\.STUDIO_DATA = \{/s.test(L.fs.readFileSync(legacyF, "utf8")) && L.fs.readFileSync(legacyF, "utf8").trimEnd().endsWith("};"));
  /* 2) البيانات الحالية في المشروع = القديمة + الحقلين بس */
  const cur = L.loadData(L.path.join(L.ROOT, "site/data/data.js"));
  // التغييرات المقصودة الموثّقة بعد الترحيل (طلب المستخدم): ① site.visitors=false (عدّاد الزوار مقفول) ② وصف Magnific (محتوى مجاني ومدفوع – أدوات AI مدفوعة). أي فرق تاني = فشل.
  const rest = stripCats(strip(cur)), mg = items(rest).find(i => i.title === "Magnific"), mgLegacy = items(legacy).find(i => i.title === "Magnific");
  const intended = {visitors: rest.site.visitors, magnificDescChanged: mg && mgLegacy && mg.desc !== mgLegacy.desc && mg.desc.includes("محتوى مجاني ومدفوع – أدوات AI مدفوعة")};
  T("the only deltas vs legacy besides price/category are the 2 documented ones (site.visitors=false, Magnific description)", intended.visitors === false && intended.magnificDescChanged, intended);
  delete rest.site.visitors; mg.desc = mgLegacy.desc;  items(rest).forEach(i => { if (i.featured === true) delete i.featured; });
  items(rest).forEach(i => { if (i.id === "itm-61fcdbd3" && i.title === "Pinterest (صفحتي)") i.title = "Pinterest"; });   // تعديل مقصود رابع (مراجعة): تمييز Pinterest بتاع صاحب الموقع عن Pinterest العام   // الأدوات المميزة (featured) تعديل مقصود تالت: 6 عناصر موجودة فعلًا
  // تعديلات مقصودة (إعادة التصميم): ترتيب الأقسام (الفيديوهات الأول وشغلي آخر الصفحة) + نص tagline/about الجديد
  rest.sections.sort((a, b) => legacy.sections.findIndex(x => x.id === a.id) - legacy.sections.findIndex(x => x.id === b.id));
  rest.site.tagline = legacy.site.tagline; rest.site.about = legacy.site.about; rest.site.photo = legacy.site.photo;   // الصورة الجديدة (photo.jpg الأصلية بدل webp)
  // تغيير مقصود: قسم «شغلي» اتضاف له YouTube وLinkedIn وTikTok (من روابط السوشيال الموجودة) ووصفه اتحدّث
  { const w = rest.sections.find(x => x.id === "work"), lw = legacy.sections.find(x => x.id === "work"); w.items = w.items.filter(i => lw.items.some(j => j.id === i.id)); w.desc = lw.desc; }
  // تغيير مقصود موثّق (طلب المستخدم): قسم «فيديوهات تعليمية» اتضاف له فيديو رابع — بنشيله قبل المقارنة زي قسم «شغلي»
  { const v = rest.sections.find(x => x.id === "video"), lv = legacy.sections.find(x => x.id === "video"); v.items = v.items.filter(i => lv.items.some(j => j.id === i.id)); }
  // تعديل مقصود موثّق (مراجعة): قسم «روابط مهمة» كان فاضي (0 عنصر) واتشال من البيانات الحالية — بنشيله من القديمة قبل المقارنة
  legacy.sections = legacy.sections.filter(s => !(s.id === "links" && s.items.length === 0));
  T("project's current data.js == legacy + price/category + those 2 documented changes ONLY (nothing else touched)", JSON.stringify(rest) === JSON.stringify(legacy));
  T("project's current data.js already migrated (re-running changes nothing)", /price: 0 \| category: 0/.test(run(L.path.join(L.ROOT, "site/data/data.js"), ["--dry"]).stdout));
  /* 3) حالات خاصة */
  const edge = L.clone(legacy); const bi = edge.sections.reduce((m, s, k) => s.items.length > edge.sections[m].items.length ? k : m, 0); const E = edge.sections[bi].items;
  E[0].tag = "  مجاني  "; E[1].tag = 5; E[2].tag = ""; delete E[3].tag; E[4].tag = "مجانى"; E[5].tag = "مدفوع"; E[5].price = "مجاني";   // مسافات / رقم / فاضي / مفيش / نسخة مكتوبة غلط / price موجود ومعاه tag مختلف
  E[6].tag = "free"; E[7].tag = "صور"; E[7].category = "لوجو"; E[8].tag = "مجاني محدود"; E[8].category = "x";
  const eF = tmp + "/edge.js"; L.fs.writeFileSync(eF, "/* x */\nwindow.STUDIO_DATA = " + JSON.stringify(edge, null, 2) + ";\n");
  const er = run(eF), eh1 = sha(eF), ed = L.loadData(eF), EI = ed.sections[bi].items; run(eF); const eh2 = sha(eF);
  T("edge: whitespace tag trimmed → price «مجاني»", EI[0].price === "مجاني" && EI[0].tag === "  مجاني  ");
  T("edge: numeric / empty / missing tags are skipped without crashing", er.status === 0 && !("price" in EI[1]) && !("category" in EI[1]) && !("price" in EI[2]) && !("price" in EI[3]) && EI[1].tag === 5);
  T("edge: existing price wins over a different tag (not overwritten)", EI[5].price === "مجاني" && EI[5].tag === "مدفوع" && !("category" in EI[5]));
  T("edge: existing category is never overwritten by tag", EI[7].category === "لوجو" && EI[7].tag === "صور" && !("price" in EI[7]));
  T("edge: near-miss «مجانى» becomes a category and a warning is printed (not guessed as price)", EI[4].category === "مجانى" && !EI[4].price && /مجانى/.test(er.stderr), er.stderr.trim().slice(0, 120));
  T("edge: file with partial migration is stable on re-run", eh1 === eh2);
  /* 4) نفس قواعد القراءة في الموقع واللوحة */
  const env = await H.start(); const site = await env.mk(), adm = await env.mk();
  await site.goto(env.BASE); await site.waitForSelector("#tabs .chip", {state: "attached"}); await adm.goto(env.ADMIN); await adm.waitForSelector(".item");
  const matrix = [{tag: "مجاني"}, {tag: "مجاني محدود"}, {tag: "مدفوع"}, {tag: "صور"}, {tag: "  مدفوع "}, {tag: 5}, {}, {tag: "مجاني", price: ""}, {tag: "مجاني", price: "مدفوع"}, {tag: "صور", category: ""}, {tag: "صور", category: "لوجو"}, {price: "free"}, {price: "مجاني", category: "صور"}, {tag: "مدفوع", category: "x"}, {price: null}, {category: null, tag: "مجاني"}];
  const calc = m => page => page.evaluate(arr => arr.map(i => [priceOf(i), categoryOf(i)]), m);
  const a = await calc(matrix)(site), b = await calc(matrix)(adm);
  T("site and admin read price/category identically for 16 edge combinations", JSON.stringify(a) === JSON.stringify(b), a.slice(0, 4));
  T("explicit empty price/category is respected (legacy tag does NOT resurrect)", JSON.stringify(a[7]) === '["",""]' && a[9][1] === "" && a[15][0] === "مجاني");
  T("invalid price value is ignored, not guessed", a[11][0] === "");
  const idem = await adm.evaluate(() => { const s = [{items: [{tag: "مجاني"}, {tag: "صور"}, {tag: ""}, {tag: "x", price: "مدفوع"}]}]; const n1 = migrateLegacyTags(s), j1 = JSON.stringify(s), n2 = migrateLegacyTags(s), j2 = JSON.stringify(s); return {n1, n2, same: j1 === j2, s}; });
  T("admin migrateLegacyTags: first run changes 2 items, second run changes 0 and output is identical", idem.n1 === 2 && idem.n2 === 0 && idem.same, idem);
  T("no JS errors", site.errs.length + adm.errs.length === 0, site.errs.concat(adm.errs));
  await H.end(env);
})().catch(e => { console.error("CRASH", e); process.exit(2); });
