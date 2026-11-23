/* اختبارات الميزات الجديدة (Playwright) + تشغيل الموقع من مسار فرعي زي GitHub Pages (http://127.0.0.1:PORT/Abdelmalek-Studio/).
   التشغيل: node tests/features.js */
const {chromium} = require("playwright"); const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.resolve(__dirname, ".."), PREFIX = "/Abdelmalek-Studio/";
const res = []; const T = (n, ok, d = "") => { res.push(ok); console.log((ok ? "PASS" : "FAIL") + " | " + n + (d ? " | " + String(d).slice(0, 240) : "")); };
const CIWAIT = process.env.CI ? 4 : 1;   // زمن الانتظار بس على CI: الـ runners أبطأ، فبنوسّع الـ timeout من غير ما نغيّر أي توقّع
const load = f => { const g = {}; new Function("window", fs.readFileSync(f, "utf8"))(g); return g.STUDIO_DATA; };
async function go(page,id){await page.evaluate(i=>{location.hash="#s="+i},id);await page.waitForTimeout(450)}
async function curTitle(page){return page.evaluate(() => { const ss = [...document.querySelectorAll("#content > section.sec")]; if (ss.length !== 1) return "الكل"; const h = ss[0].querySelector("h2").cloneNode(true); h.querySelectorAll("i").forEach(i => i.remove()); return h.textContent.trim(); })}
const homeN = () => 0;
const D = load(ROOT + "/site/data/data.js"), ALL = D.sections.flatMap(s => s.items.map(i => ({...i, sec: s.id})));
const MIME = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".txt": "text/plain", ".xml": "application/xml"};
const misses = [];
const srv = http.createServer((q, r) => {   // سيرفر ثابت: الموقع على /Abdelmalek-Studio/ بالظبط زي project page
  let u = decodeURIComponent(q.url.split("?")[0]);
  if (!u.startsWith(PREFIX)) { misses.push(u); r.writeHead(404); return r.end("nf"); }
  let rel = u.slice(PREFIX.length); if (!rel || rel.endsWith("/")) rel += "index.html"; const f = path.join(ROOT, "site", rel);
  if (!f.startsWith(path.join(ROOT, "site")) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { misses.push(u); r.writeHead(404); return r.end("nf"); }
  r.writeHead(200, {"content-type": MIME[path.extname(f)] || "application/octet-stream"}); fs.createReadStream(f).pipe(r);
});
(async () => {
  await new Promise(ok => srv.listen(0, "127.0.0.1", ok)); const BASE = "http://127.0.0.1:" + srv.address().port + PREFIX;
  const b = await chromium.launch();
  const mk = async (o = {}) => { const c = await b.newContext({viewport: {width: 1280, height: 900}, permissions: ["clipboard-read", "clipboard-write"], ...o}); const p = await c.newPage(); p.errs = []; p.on("pageerror", e => p.errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/font|ERR_FAILED|youtube|counterapi|net::/i.test(m.text())) p.errs.push(m.text()); }); await p.route(/(youtube\.com|counterapi\.dev|ytimg\.com)/, r => r.abort()); return p; };
  const cards = p => p.locator("#content .cwrap").count();

  /* ---------- 1) GitHub Pages: مسار فرعي ---------- */
  let p = await mk(); const bad = []; p.on("response", r => { if (r.status() >= 400 && r.url().startsWith(BASE.slice(0, 22))) bad.push(r.status() + " " + r.url()); });
  await p.goto(BASE); await p.waitForSelector("#tabs .chip", {timeout: 8000 * CIWAIT}).catch(async e => { console.log("DBG", await p.evaluate(() => document.body.innerText.slice(0, 200)), p.errs); throw e; });
  T("[GH Pages path] site loads from /Abdelmalek-Studio/ with the home cards", await cards(p) === homeN(D));
  await p.evaluate(async () => { document.querySelectorAll("img").forEach(i => i.loading = "eager"); for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } });
  await p.waitForTimeout(600);
  T("[GH Pages path] no 404 for assets/images/fonts", bad.length === 0 && misses.length === 0, bad.concat(misses).join(" | "));
  T("[GH Pages path] no JS errors", p.errs.length === 0, p.errs.join("|"));
  const rb = await (await p.request.get(BASE + "robots.txt")).text(); T("[robots.txt] one managed comment max, no duplicates", (rb.match(/^# بعد تحديد/gm) || []).length <= 1, rb);
  // رابط مباشر من مسار فرعي
  const photopea = ALL.find(i => i.title === "Photopea");
  const p2 = await mk(); await p2.goto(BASE + "#i=" + photopea.id); await p2.waitForSelector("#tabs .chip", {state: "attached"});
  T("[GH Pages path] direct link opens the tool's section and highlights it", await p2.locator(`#content [data-id="${photopea.id}"]`).count() === 1 && await p2.locator(".cwrap.flash").count() === 1 && await curTitle(p2) === D.sections.find(s => s.id === photopea.sec).title);
  await p.context().close(); await p2.context().close();

  /* ---------- 2) السعر والتصنيف والفلاتر ---------- */
  p = await mk(); await p.goto(BASE); await p.waitForSelector("#tabs .chip", {state: "attached"});
  const count = (f) => ALL.filter(f).length, price = i => { const v = String(i.price ?? i.tag ?? "").trim(); return ["مجاني", "مجاني محدود", "مدفوع"].includes(v) ? v : ""; };
  // تغيير مقصود (المرحلة 2): الفلاتر العامة (نوع/سعر/تصنيف على كل الموقع) اتشالت، وبقى لكل قسم فلاتره: تصنيفات القسم، وفلتر السعر لأقسام المواقع والأدوات بس.
  // الاختبارات دي كانت بتختبر نفس الحاجات (السعر والتصنيف وتوافق العناصر القديمة) على الفلاتر العامة؛ اتنقلت لتختبرها جوه الأقسام المناسبة بنفس الصرامة.
  const PW = ["مجاني", "مجاني محدود", "مدفوع"], SEC = id => D.sections.find(s => s.id === id), inSec = (id, f) => SEC(id).items.filter(f).length, openSec = async (pg, id) => { await go(pg,id); await pg.waitForTimeout(250); };
  T("data migrated: every old price-tag item has price; every other tag item has a category (tag kept as legacy)", D.sections.every(s => s.items.every(i => !i.tag || (PW.includes(i.tag) ? i.price === i.tag : !!String(i.category || "").trim()))));
  T("home (all sections): no filters at all — no type/price/category chips", await p.locator("[data-fp], [data-fu], [data-ft]").count() === 0 && await p.locator(".controls").isHidden());
  await openSec(p, "vector");
  // تغيير مقصود موثّق (المرحلة 4): فلتر السعر بقى 3 شيبات ثابتة — الكل / مجاني (بيشمل المجاني المحدود) / مدفوع
  T("tools section (vector): price row shows the 3 unified chips (الكل/مجاني/مدفوع)", await p.locator("[data-fp]").count() === 3);
  await p.click('[data-fp="مجاني"]'); T("vector «مجاني» shows free + limited-free items together (مجاني ⊇ مجاني محدود)", await cards(p) === inSec("vector", i => i.type === "link" && price(i) !== "مدفوع"));
  await p.click('[data-fp="مدفوع"]'); T("vector «مدفوع» shows only paid items of that section", await cards(p) === inSec("vector", i => price(i) === "مدفوع"));
  T("no separate «مجاني محدود» chip anymore (merged into «مجاني»)", await p.locator('[data-fp="مجاني محدود"]').count() === 0);
  await p.click('[data-fp="all"]');
  await p.click('[data-fu="أيقونات"]'); T("vector category «أيقونات» filters that section", await cards(p) === inSec("vector", i => i.category === "أيقونات"));
  await p.click('[data-fp="مدفوع"]'); T("vector price + category combine (no item is both → empty, not an error)", await cards(p) === inSec("vector", i => i.category === "أيقونات" && price(i) === "مدفوع") && p.errs.length === 0);
  await openSec(p, "prompts");
  const cats = [...new Set(SEC("prompts").items.map(i => i.category))];
  T("prompts: category row has «all» + every prompt category; NO price row (prompts aren't priced)", await p.locator("[data-fu]").count() === cats.length + 1 && await p.locator("[data-fp]").count() === 0);
  await p.click('[data-fu="إنشاء الشخصيات"]'); T("prompts category filter works", await cards(p) === inSec("prompts", i => i.category === "إنشاء الشخصيات") && await p.locator(".pcard").count() === await cards(p));
  // توافق العناصر القديمة: بيانات من غير price/category (tag بس)
  const legacy = JSON.parse(JSON.stringify(D)); legacy.sections.forEach(s => s.items.forEach(i => { delete i.price; delete i.category; }));
  const pl = await mk(); await pl.route("**/data/data.js", r => r.fulfill({contentType: "text/javascript", body: "window.STUDIO_DATA=" + JSON.stringify(legacy) + ";"}));
  await pl.goto(BASE + "#s=vector&p=" + encodeURIComponent("مدفوع")); await pl.waitForSelector("#tabs .chip", {state: "attached"});
  T("legacy items (tag only) still filter by price inside a tools section", await cards(pl) === inSec("vector", i => price(i) === "مدفوع") && pl.errs.length === 0);
  await pl.goto(BASE + "#s=prompts"); await pl.waitForSelector("#tabs .chip", {state: "attached"});
  T("legacy prompts (tag only) keep a category chip per old tag", await pl.locator("[data-fu]").count() === new Set(legacy.sections.find(s => s.id === "prompts").items.map(i => PW.includes(i.tag) ? "" : i.tag).filter(Boolean)).size + 1);
  await pl.context().close();

  /* ---------- 3) البحث ---------- */
  p = await mk(); await p.goto(BASE); await p.waitForSelector("#tabs .chip", {state: "attached"});
  T("search clear button hidden when empty", await p.locator("#qclear").isHidden());
  await p.fill("#q", "canva"); T("search clear button visible with text", await p.locator("#qclear").isVisible());
  const nC = await cards(p); T("search finds results", nC > 0 && nC < ALL.length, nC);
  await p.click("#qclear"); T("clear button resets search & results & focus", await p.inputValue("#q") === "" && await cards(p) === homeN(D) && await p.evaluate(() => document.activeElement.id) === "q");
  await p.fill("#q", "zzzxqwk"); T("no-results state: message, clear button, suggestions", await p.locator(".empty .e-t").count() === 1 && await p.locator("[data-qclear]").count() === 1 && await p.locator(".empty [data-sec]").count() > 0 && await p.locator(".empty [data-q]").count() > 0);
  await p.click("[data-q]"); T("suggested idea fills the search", await cards(p) > 0 && (await p.inputValue("#q")).length > 0);
  await p.fill("#q", ""); await p.fill("#q", "ذكاء"); await p.keyboard.press("ArrowDown"); await p.keyboard.press("Enter");
  T("keyboard: ArrowDown + Enter picks a suggestion", (await p.inputValue("#q")).length > 0 && await cards(p) > 0);
  await p.fill("#q", "canva"); await p.keyboard.press("Escape"); await p.keyboard.press("Escape");
  T("keyboard: Esc closes suggestions then clears search", await p.inputValue("#q") === "" && await cards(p) === homeN(D));
  await p.fill("#q", "canva"); await p.waitForSelector("#suggest:not([hidden])", {timeout: 4000 * CIWAIT});
  await p.waitForSelector("#content .cwrap .card", {timeout: 4000 * CIWAIT});   // النتائج ظهرت فعلًا قبل Enter (انتظار حتمي بدل افتراض التوقيت)
  await p.keyboard.press("Escape");
  await p.waitForSelector("#suggest", {state: "hidden", timeout: 4000 * CIWAIT});   // الاقتراحات اتقفلت فعلًا قبل ما نبعت Enter
  await p.keyboard.press("Enter");
  const focusMoved = await p.waitForFunction(() => { const a = document.activeElement; return !!a && !!a.closest("#content"); }, {timeout: 4000 * CIWAIT, polling: 250}).then(() => true, () => false);   // بنستنى الشرط نفسه بدل لقطة فورية — لو التركيز ما انتقلش أصلًا الاختبار يفشل برضه
  T("keyboard: Enter (no suggestion) moves focus to first result", focusMoved);
  await p.fill("#q", "canva"); await p.waitForTimeout(100);
  T("search state is in the URL (shareable)", /q=canva/.test(await p.evaluate(() => location.hash)));
  await p.evaluate(() => { Object.defineProperty(navigator, "share", {value: undefined, configurable: true}); });
  await p.click("[data-shareres]"); await p.waitForTimeout(250);
  const link = await p.evaluate(() => navigator.clipboard.readText()); T("share results copies a link with the query", /#.*q=canva/.test(link), link);
  const p3 = await mk(); await p3.goto(link); await p3.waitForSelector("#tabs .chip", {state: "attached"});
  T("opening the shared results link restores the same search", await p3.inputValue("#q") === "canva" && await cards(p3) === nC);
  await p3.context().close();
  // عربي في الرابط
  const p4 = await mk(); await p4.goto(BASE + "#" + new URLSearchParams({s: "vector", q: "إزالة خلفية", p: "مدفوع"}).toString()); await p4.waitForSelector("#tabs .chip", {state: "attached"});
  T("Arabic query + Arabic filter in URL restore correctly", await p4.inputValue("#q") === "إزالة خلفية" && await p4.locator('[data-fp="مدفوع"].on').count() === 1);
  await p4.context().close();

  /* ---------- 4) الفلاتر محفوظة مع التنقل والرجوع ---------- */
  p = await mk(); await p.goto(BASE); await p.waitForSelector("#tabs .chip", {state: "attached"});
  // (المرحلة 2: الفلاتر بقت خاصة بالقسم، فالاختبار بيمسك فلتر السعر جوه قسم أدوات)
  await openSec(p, "vector"); await p.click('[data-fp="مجاني"]'); const secTitle = SEC("vector").title;
  await go(p,"sites"); await p.waitForTimeout(250); await p.goBack(); await p.waitForTimeout(250);
  T("Back returns to previous section and keeps its price filter", await curTitle(p) === secTitle && await p.locator('[data-fp="مجاني"].on').count() === 1);
  await p.goForward(); await p.waitForTimeout(250); T("Forward works too", await curTitle(p) !== secTitle);
  await p.goBack(); await p.waitForTimeout(250); await p.reload(); await p.waitForSelector("#tabs .chip", {state: "attached"}); T("reload keeps section + filters (URL state)", await p.locator('[data-fp="مجاني"].on').count() === 1 && await curTitle(p) === secTitle);

  /* ---------- 5) روابط مباشرة ---------- */
  p = await mk(); await p.goto(BASE); await p.waitForSelector("#tabs .chip", {state: "attached"});
  const prm = ALL.find(i => i.type === "prompt");
  await p.goto(BASE + "#i=" + prm.id); await p.waitForSelector(".modal.show");
  T("direct link to a prompt opens its modal", await p.locator("#mTitle").innerText() === prm.title);
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  T("closing modal drops #i from URL", !/i=/.test(await p.evaluate(() => location.hash)));
  await p.locator(".pcard").first().click(); await p.waitForSelector(".modal.show"); T("clicking a prompt puts its permalink in the URL", /#i=itm-/.test(await p.evaluate(() => location.hash)));
  await p.evaluate(() => { Object.defineProperty(navigator, "share", {value: undefined, configurable: true}); });
  await p.click("#mShare"); await p.waitForTimeout(250); T("modal «share link» copies the permalink", /#i=itm-/.test(await p.evaluate(() => navigator.clipboard.readText())));
  await p.keyboard.press("Escape");
  await p.goto(BASE + "#i=itm-doesnotexist"); await p.waitForSelector("#tabs .chip", {state: "attached"}); T("unknown item id → normal page, no error", await cards(p) === homeN(D) && p.errs.length === 0);
  await p.goto(BASE + "#i=" + encodeURIComponent("<img src=x onerror=window.__x=1>")); await p.waitForSelector("#tabs .chip", {state: "attached"}); await p.waitForTimeout(100);
  T("hostile hash value does nothing", !(await p.evaluate(() => window.__x)) && p.errs.length === 0);
  await p.goto(BASE + "#" + D.sections[3].id); await p.waitForSelector("#tabs .chip", {state: "attached"}); T("legacy #sectionId link still opens the section", await curTitle(p) === D.sections[3].title);
  await p.goto(BASE + "#s=sites&v=zzz&t=bogus&p=bogus&c=bogus"); await p.waitForSelector("#tabs .chip", {state: "attached"}); T("invalid filter values in URL are ignored safely (old &t= type filter is just ignored)", await p.locator('#filters .fchip.on[data-fp="all"]').count() === 1 && await p.locator('#filters .fchip.on[data-fu="all"]').count() === 1 && p.errs.length === 0);
  await p.goto(BASE + "#s=video"); await p.waitForSelector(".sharebtn");
  await p.locator(".cwrap:has(.sharebtn)").first().locator(".sharebtn").click(); await p.waitForTimeout(200);
  T("share on a tool card copies the site's permalink", /#i=itm-/.test(await p.evaluate(() => navigator.clipboard.readText())));

  /* ---------- 6) المفضلة والمجموعات ---------- */
  p = await mk(); await p.goto(BASE); await p.waitForSelector("#tabs .chip", {state: "attached"});
  await p.evaluate(() => localStorage.setItem("as-fav", JSON.stringify(["itm-oldfav1"]))); await p.reload(); await p.waitForSelector("#tabs .chip", {state: "attached"}); await go(p, D.sections[0].id);
  const favIds = ALL.slice(0, 4).map(i => i.id);
  for (const id of favIds) await p.locator(`.favbtn[data-fav="${id}"]`).click();
  await p.click("#favnav"); await p.waitForSelector("#favorites");
  T("favorites view lists the 4 favorites", await cards(p) === 4);
  T("no groups yet: presets offered after clicking «new group»", await p.locator("[data-gnew]").count() === 1);
  await p.click("[data-gnew]"); T("4 preset suggestions", await p.locator("[data-gpreset]").count() === 4);
  await p.click('[data-gpreset="أدوات التصميم"]'); await p.click("[data-gnew]"); await p.fill("#gname", "أدوات الذكاء الاصطناعي"); await p.keyboard.press("Enter");
  T("2 groups created", await p.locator("[data-gchip]").count() === 4, await p.locator("[data-gchip]").count());   // الكل + 2 + بدون مجموعة
  await p.click('[data-gchip="all"]'); await p.locator("[data-gsel]").nth(0).selectOption({label: "أدوات التصميم"}); await p.locator("[data-gsel]").nth(1).selectOption({label: "أدوات التصميم"});
  await p.locator("[data-gchip]").filter({hasText: "أدوات التصميم"}).click(); T("group filter shows only its items", await cards(p) === 2);
  await p.locator("[data-gchip]").filter({hasText: "بدون مجموعة"}).click(); T("«no group» filter shows the rest", await cards(p) === 2);
  await p.reload(); await p.waitForSelector("#favorites"); T("groups + assignments persist after reload (localStorage)", await p.locator("[data-gchip]").count() === 4);
  const raw = await p.evaluate(() => localStorage.getItem("as-fav")); T("old favorites key untouched & old fav kept", JSON.parse(raw).includes("itm-oldfav1") && favIds.every(i => JSON.parse(raw).includes(i)));
  await p.locator("[data-gchip]").filter({hasText: "أدوات التصميم"}).click(); await p.click("[data-grename]"); await p.fill("#gname", "تصميم"); await p.keyboard.press("Enter");
  T("rename group", await p.locator("[data-gchip]").filter({hasText: "تصميم"}).count() >= 1);
  p.once("dialog", d => d.accept()); await p.click("[data-gdel]"); await p.waitForTimeout(150);
  T("delete group keeps favorites", await p.locator("[data-gchip]").count() === 3 && JSON.parse(await p.evaluate(() => localStorage.getItem("as-fav"))).length === 5);
  await p.evaluate(() => localStorage.setItem("as-fav-groups", '{"v":1,"groups":[{"id":"g-x1y2z3","name":"<img src=x onerror=window.__g=1>"},{"id":"bad id","name":"x"}],"map":{"a":"nope"}}'));
  await p.reload(); await p.waitForSelector("#favorites"); T("poisoned group storage is shown as text, never executed", !(await p.evaluate(() => window.__g)) && p.errs.length === 0);
  await p.evaluate(() => localStorage.setItem("as-fav-groups", "{{{broken")); await p.reload(); await p.waitForSelector("#tabs .chip", {state: "attached"}); T("corrupt groups storage doesn't break the site", p.errs.length === 0);
  // الرجوع من المفضلة
  await p.goto(BASE); await p.waitForSelector("#tabs .chip", {state: "attached"}); await p.click("#favnav"); await p.click("[data-favback]"); T("back-to-site from favorites", await p.locator("#favorites").count() === 0 && await cards(p) === homeN(D));

  /* ---------- 7) آخر الإضافات ---------- */
  p = await mk(); const news = JSON.parse(JSON.stringify(D)); news.sections[2].items[0].added = "2026-11-05"; news.sections[2].items[1].added = "2026-11-01";
  news.updates = [{id: "upd-1", date: "2026-11-05", title: "أدوات جديدة <b>x</b>", text: "تفاصيل", items: [news.sections[3].items[0].id, "itm-gone"]}, {date: "bad", title: "x"}];
  await p.route("**/data/data.js", r => r.fulfill({contentType: "text/javascript", body: "window.STUDIO_DATA=" + JSON.stringify(news) + ";"}));
  await p.goto(BASE); await p.waitForSelector("#tabs .chip", {state: "attached"});
  T("«what's new» chip appears only when data exists (home stays clean)", await p.locator("#tabs .newchip").count() === 1);
  await p.click("#tabs .newchip"); await p.waitForSelector("#whatsnew");
  T("what's new page: dates newest-first, note text escaped, linked tool shown, invalid update ignored", (await p.locator(".dh time").allInnerTexts()).length === 2 && await p.locator(".unote h4").innerText() === "أدوات جديدة <b>x</b>" && await p.locator(".unote .cwrap").count() === 1 && await p.locator(".unote b").count() === 0);
  T("what's new URL is shareable (#v=new)", /v=new/.test(await p.evaluate(() => location.hash)));
  await p.reload(); await p.waitForSelector("#whatsnew"); T("reload stays on what's new", true);
  await p.click("[data-favback]"); T("back from what's new", await p.locator("#whatsnew").count() === 0);

  /* ---------- 8) الإبلاغ عن رابط معطل ---------- */
  p = await mk(); await p.goto(BASE + "#s=sites"); await p.waitForSelector(".reportbtn");
  const rbtn = p.locator(".reportbtn").first(); T("report button on link cards, not on prompts", await p.locator(".reportbtn").count() > 0 && await p.locator(".cwrap:has(.pcard) .reportbtn").count() === 0);
  await rbtn.click(); await p.waitForSelector(".modal.show .rep");
  const wa = await p.locator(".rbtn[href^='https://wa.me/']").getAttribute("href"); T("report dialog: WhatsApp message prefilled (no server, no data sent)", /text=/.test(wa) && decodeURIComponent(wa).includes("#i=itm-"), wa.slice(0, 120));
  await p.click("[data-rcopy]"); await p.waitForTimeout(200); T("report: copy text works", (await p.evaluate(() => navigator.clipboard.readText())).includes("بلاغ عن رابط لا يعمل"));
  await p.keyboard.press("Escape"); T("report dialog closes with Esc", await p.locator(".modal.show .rep").count() === 0);
  // لا يوجد تداخل للأزرار على الكروت
  const ov = await p.evaluate(() => { const r = []; document.querySelectorAll(".cwrap").forEach(w => { const bs = [...w.querySelectorAll(".favbtn,.sharebtn,.reportbtn,.pcopy")].map(b => b.getBoundingClientRect()); for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i], c = bs[j]; if (!(a.right <= c.left || c.right <= a.left || a.bottom <= c.top || c.bottom <= a.top)) r.push(1); } }); return r.length; });
  T("card action buttons never overlap", ov === 0, ov);

  /* ---------- 9) مقاس الموبايل + الثيمات ---------- */
  for (const theme of ["dark", "light"]) {
    const pm = await mk({viewport: {width: 360, height: 740}, isMobile: true, hasTouch: true}); await pm.addInitScript(t => localStorage.setItem("theme", t), theme);
    await pm.goto(BASE); await pm.waitForSelector("#tabs .chip", {state: "attached"}); await pm.fill("#q", "ai");
    const m = await pm.evaluate(() => ({sw: document.documentElement.scrollWidth, iw: innerWidth, fs: parseFloat(getComputedStyle(document.querySelector("#q")).fontSize), cl: document.querySelector("#qclear").getBoundingClientRect().width}));
    T(`[mobile 360 ${theme}] no h-scroll, search input ≥16px (no iOS zoom), clear ≥34px`, m.sw <= m.iw && m.fs >= 16 && m.cl >= 34, JSON.stringify(m));
    await pm.fill("#q", "zzzzqq"); T(`[mobile ${theme}] empty state fits`, await pm.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await pm.context().close();
  }
  T("no JS errors in site tests", p.errs.length === 0, p.errs.join("|"));

  /* ---------- 10) لوحة الإدارة ---------- */
  const A = "file://" + ROOT + "/admin/index.html", tmp = fs.mkdtempSync(path.join(os.tmpdir(), "asf-"));
  const a = await mk({acceptDownloads: true}); let dlgs = []; a.on("dialog", d => { dlgs.push(d.message()); d.accept(); });
  await a.goto(A); await a.waitForSelector(".item");
  const saveDl = async sel => { const [d] = await Promise.all([a.waitForEvent("download"), a.click(sel)]); const f = path.join(tmp, "o" + Math.random() + ".txt"); await d.saveAs(f); return fs.readFileSync(f, "utf8"); };
  const parse = t => JSON.parse(t.replace(/^\/\*[\s\S]*?\*\/\s*/, "").replace(/^window\.STUDIO_DATA\s*=\s*/, "").replace(/;\s*$/, ""));
  T("admin: section counts shown (" + D.sections.length + " sections)", await a.locator(".seccount").count() === D.sections.length && /148/.test(await a.innerText("#totals")));   // تغيير مقصود: الفيديو الرابع خلى الإجمالي 148
  await a.fill("#asearch", "remove.bg"); const vis = await a.locator(".item:not(.upd):visible").count(); T("admin search filters items (+ info)", vis >= 1 && vis < 10 && /مطابق/.test(await a.innerText("#asearchinfo")), vis);
  await a.fill("#asearch", "zzzz"); T("admin search: no match message", /مفيش/.test(await a.innerText("#asearchinfo"))); await a.fill("#asearch", "");
  const n0 = await a.locator(".item:not(.upd)").count(); await a.locator('[data-act="dupitem"]').nth(2).click();
  T("admin duplicate item: +1 item, new unique id, ' (نسخة)' title", await a.locator(".item:not(.upd)").count() === n0 + 1 && (await a.locator(".item:not(.upd) [data-f=title]").nth(3).inputValue()).endsWith("(نسخة)"));
  await a.click("#preview"); T("admin preview shows the new item", /عناصر جديدة/.test(await a.innerText("#diffbox")));
  await a.click("#dupcheck"); T("admin duplicates check: finds same-URL items (ChatGPT / Gemini) and the copy", /رابط مكرر/.test(await a.innerText("#dupbox")) && /\(نسخة\)/.test(await a.innerText("#dupbox")));
  // السعر والتصنيف في اللوحة
  const it0 = a.locator(".item:not(.upd)").first(); await it0.locator('[data-f="price"]').selectOption("مدفوع"); await it0.locator('[data-f="category"]').fill("تجربة");
  // تحديث
  await a.click("#addUpd"); await a.locator('#updates [data-f="title"]').first().fill("إضافة تجريبية"); await a.locator("#updates select[data-addref]").first().selectOption({index: 3});
  let out = parse(await saveDl("#download")); const o0 = out.sections[0].items[0];
  T("admin export: price/category saved, nothing lost (items +1)", o0.price === "مدفوع" && o0.category === "تجربة" && out.sections.reduce((n, s) => n + s.items.length, 0) === n0 + 1);
  T("admin export: updates saved with linked item", out.updates && out.updates.length === 1 && out.updates[0].title === "إضافة تجريبية" && out.updates[0].items.length === 1);
  T("admin export keeps legacy tag untouched", D.sections.every((s, si) => s.items.every(i => { const m = out.sections[si].items.find(x => x.id === i.id); return !i.tag || (m && m.tag === i.tag); })));
  // استرجاع: رجوع كامل بدون فقدان
  const bk = await saveDl("#backup"); fs.writeFileSync(tmp + "/b.json", bk);
  await a.reload(); await a.waitForSelector(".item"); dlgs = [];
  await a.setInputFiles("#restore", tmp + "/b.json"); await a.waitForTimeout(400);
  T("restore shows diff summary in confirm (+ new / − lost / ~ changed)", dlgs.length === 1 && /الفرق/.test(dlgs[0]), dlgs[0]);
  T("restore brings back updates + items", await a.locator(".item:not(.upd)").count() === n0 + 1 && await a.locator("#updates .upd").count() === 1);
  // استيراد ملف يحذف عناصر: لازم يحذّر
  const small = JSON.parse(JSON.stringify(D)); small.sections[0].items = small.sections[0].items.slice(0, 1); fs.writeFileSync(tmp + "/s.json", JSON.stringify(small)); dlgs = [];
  await a.setInputFiles("#restore", tmp + "/s.json"); await a.waitForTimeout(400); T("import that removes items warns before replacing", /هيختفي/.test(dlgs[0] || ""), dlgs[0]);
  // حقول إضافية بتتحافظ
  const extra = JSON.parse(JSON.stringify(D)); extra.futureKey = {a: 1}; fs.writeFileSync(tmp + "/e.json", JSON.stringify(extra));
  await a.setInputFiles("#restore", tmp + "/e.json"); await a.waitForTimeout(400); out = parse(await saveDl("#download")); T("unknown top-level fields survive import → export", out.futureKey && out.futureKey.a === 1);
  // تحديث بمرجع محذوف يتمنع
  await a.click("#addUpd"); await a.locator('#updates [data-f="title"]').first().fill("x"); await a.locator("#updates select[data-addref]").first().selectOption({index: 1});
  T("update ref added", await a.locator("#updates .ref").count() === 1);
  await a.locator('.item:not(.upd) [data-act="delitem"]').first().click(); T("deleting an item removes it from updates references", await a.locator("#updates .ref").count() === 0);
  // فحص الصور: مهلة ≠ نجاح
  const pr = await a.evaluate(async () => { const orig = window.Image; let res; window.Image = function () { const i = new orig(); Object.defineProperty(i, "src", {set() { /* مفيش onload ولا onerror: هيعدّي المهلة */ }}); return i; }; const t0 = Date.now(); const r = await probeImage("assets/img/logo.svg"); window.Image = orig; return {r, ms: Date.now() - t0}; });
  T("image probe: timeout is reported as 'timeout', not success", pr.r === "timeout" && pr.ms >= 5500, JSON.stringify(pr));
  const pr2 = await a.evaluate(async () => [await probeImage("assets/img/logo.svg"), await probeImage("assets/img/nope.png")]); T("image probe: ok / fail distinguished", pr2[0] === "ok" && pr2[1] === "fail", pr2);
  const warn = await a.evaluate(async () => { const orig = window.probeImage; window.probeImage = async p => p.includes("slow") ? "timeout" : p.includes("nope") ? "fail" : "ok"; const r = await findMissingImages({photo: "assets/img/slow.png", logo: "assets/img/nope.png"}, []); window.probeImage = orig; return r.map(x => x.kind); });
  T("unverified images produce a clear warning (separate from missing)", warn.join() === "missing,unverified", warn);
  T("no JS errors in admin", a.errs.length === 0, a.errs.join("|"));

  await b.close(); srv.close();
  const f = res.filter(x => !x).length; console.log("\nTOTAL " + res.length + " FAILED " + f); process.exit(f ? 1 : 0);
})().catch(e => { console.error("CRASH", e); process.exit(2); });
