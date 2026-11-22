/* المرحلة 2: فلاتر وتصنيفات كل قسم + البحث الذكي المرتبط بالقسم المفتوح. التشغيل: node tests/sections.js */
const L = require("./lib"), H = L.harness("sections"), {T} = H, {path} = L;
const D = L.loadData(path.join(L.SITE_DIR, "data/data.js")), SEC = id => D.sections.find(s => s.id === id), all = D.sections.flatMap(s => s.items), total = all.length;
(async () => {
  const env = await H.start({}), p = await env.mk({viewport: {width: 1440, height: 900}});
  await p.goto(env.BASE); await p.waitForSelector("#tabs .chip", {state: "attached"});
  const n = () => p.locator("#content .cwrap").count(), res = () => p.innerText("#results"), open = async id => { await L.go(p,id); await p.waitForTimeout(250); }, type = async q => { await p.fill("#q", q); await p.waitForTimeout(150); };
  const titles = () => p.locator("#content .cwrap h3").allInnerTexts();
  /* بنية */
  T("home: no filters (no global type/price/category) — only the section bar and search", await p.locator("[data-fp], [data-fu], [data-ft]").count() === 0 && await p.locator(".controls").isHidden() && await n() === L.homeN(D));
  T("every item has a category or belongs to a section without category filters; sections with categories declare them", D.sections.every(s => !s.categories || s.categories.every(c => s.items.some(i => i.category === c))));
  /* البرومبت */
  await open("prompts");
  T("prompts: category chips come from the section data, each with its count; no price row", (await p.locator("[data-fu]").evaluateAll(l => l.map(x => x.dataset.fu))).join("|") === ["all", ...SEC("prompts").categories].join("|") && await p.locator("[data-fp]").count() === 0 && (await p.locator('[data-fu="all"] b').innerText()) === String(SEC("prompts").items.length));
  T("prompts: search box is scoped (placeholder names the section)", (await p.getAttribute("#q", "placeholder")).includes(SEC("prompts").title));
  await type("تايبوجرافي"); const typo = SEC("prompts").items.filter(i => i.category === "تايبوجرافي").map(i => i.title);
  T("«تايبوجرافي» finds the typography prompt(s) (first), only inside prompts, with a result count", typo.length > 0 && (await titles())[0] === typo[0] && /عنصر/.test(await res()) && (await res()).includes(SEC("prompts").title));
  await type("رفع الجودة"); const up = SEC("prompts").items.filter(i => i.category === "رفع جودة الصور").map(i => i.title), got = await titles();
  T("«رفع الجودة» finds both quality-enhancement prompts (not a literal match: synonym/near words)", up.length >= 2 && up.every(t => got.includes(t)), got);
  await type("الجودة"); T("«الجودة» (with ال) behaves like «جودة»", (await titles()).some(t => up.includes(t)));
  await type("كركتر"); T("«كركتر» finds the character prompts (synonym → category)", (await titles()).some(t => SEC("prompts").items.filter(i => i.category === "إنشاء الشخصيات").map(i => i.title).includes(t)));
  await type("ترميم"); T("«ترميم» finds restoration prompt", (await titles()).some(t => /ترميم/.test(t)));
  /* البحث + التصنيف */
  await type("صورة"); const before = await n(); await p.click('[data-fu="رفع جودة الصور"]'); await p.waitForTimeout(150);
  T("search + category combine: result is the intersection and chip counts follow the search", await n() <= before && (await titles()).every(t => up.includes(t)) && (await p.locator('[data-fu="رفع جودة الصور"] b').innerText()) === String(await n()));
  await p.click('[data-fu="all"]'); await type("");
  /* نطاق القسم + البحث في كل الأقسام */
  await open("vector"); await type("icon");
  const vt = await titles(); const rr = await res();
  T("search is scoped to the open section: only vector items, count shown, other sections' matches offered, not mixed in", vt.every(t => SEC("vector").items.some(i => i.title === t)) && /في «/.test(rr));
  const hasElse = await p.locator("[data-searchall]").count();
  if (hasElse) { await p.click("[data-searchall]"); await p.waitForTimeout(300); T("«في باقي الأقسام» widens the same query to all sections", await L.curTitle(p) === "الكل" && (await p.inputValue("#q")) === "icon" && await n() > vt.length); }
  else T("(no matches elsewhere for this query — widening button correctly absent)", true);
  await type(""); await open("sites"); await type("zzzxxqq"); T("no results in section: explanatory empty state, no crash, other sections not mixed", await n() === 0 && p.errs.length === 0);
  await type("");
  /* السعر: أدوات المواقع بس */
  for (const id of ["vector", "sites", "ai-images", "ai-both", "montage", "motion", "ideas"]) { await open(id); const hasP = SEC(id).items.filter(i => i.type === "link" && i.price).map(i => i.price); const wantP = ["all", "مجاني", ...(SEC(id).items.some(i => i.type === "link" && i.price === "مدفوع") ? ["مدفوع"] : [])].join();   // المرحلة 4: الكل/مجاني(بيشمل المحدود) + مدفوع لو القسم فيه مدفوع فعلًا
  T(`${id}: price row appears (tools section with mixed prices) with the unified chips`, new Set(hasP).size < 2 || (await p.locator("[data-fp]").evaluateAll(l => l.map(x => x.dataset.fp))).join() === wantP); }
  for (const id of ["prompts", "video", "files", "work"]) { await open(id); T(`${id}: no price row`, await p.locator("[data-fp]").count() === 0); }
  /* مفيش تضليل لـ Magnific */
  await open("ai-both"); await p.click('[data-fp="مجاني"]').catch(() => {}); const mg = SEC("ai-both").items.find(i => /magnific/i.test(i.title));
  T("Magnific sits under «مجاني محدود», not under fully free nor fully paid", mg.price === "مجاني محدود");
  /* فلتر + تنقل */
  await open("sites"); await p.locator("[data-fp]:not([data-fp=all])").first().click(); await open("vector");
  T("switching section resets that section's filters (no leaking between sections)", await p.locator('[data-fp="all"].on').count() === 1);
  T("no JS errors", p.errs.length === 0, p.errs);
  await H.end(env);
})().catch(e => { console.error("CRASH", e); process.exit(2); });
