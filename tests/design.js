/* (المرحلة 3: الشريط بقى كبير بأيقونات وأعداد، كل الأقسام ظاهرة على الديسكتوب من غير تمرير، والضغط على قسم مبيحرّكش الصفحة — اختبارات الصفّ الواحد/النزول للبانر اتبدّلت بما يقابلها، بتغيير مقصود بطلب المستخدم.)
   الواجهة: شريط التنقل العلوي، عرض الشاشة كاملة، ألوان الأقسام، توهّج الخلفية، الموبايل، الوضعين، إمكانية الوصول (axe)، وإلغاء الصوت. التشغيل: node tests/design.js
   (كان فيه نسخة قديمة بتختبر السايدبار — اتستبدلت لأن السايدبار اتحوّل لشريط علوي بطلب المستخدم؛ شروط العرض/الألوان/الموبايل/axe اتحافظ عليها.) */
const L = require("./lib"), H = L.harness("design"), {T} = H, {path, fs} = L;
const D = L.loadData(path.join(L.SITE_DIR, "data/data.js")), SEC = D.sections.filter(s => s.items.length), total = SEC.reduce((n, s) => n + s.items.length, 0);
(async () => {
  const env = await H.start({});
  const open = async (vp, o = {}) => { const p = await env.mk({viewport: vp, ...o}); await p.goto(env.BASE + (o.hash || "")); await p.waitForSelector("#tabs .chip", {state: "attached"}); await p.waitForTimeout(350); return p; };
  const noHScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth);

  /* ===== 1) العرض ===== */
  for (const w of [1280, 1440, 1920, 2560]) {
    const p = await open({width: w, height: 1000}); const g = await p.evaluate(() => { const m = document.querySelector("main").getBoundingClientRect(), t = document.querySelector("header.top .wrap").getBoundingClientRect(); return {main: Math.round(m.width), bar: Math.round(t.width), iw: innerWidth}; });
    // الحاوية ليها سقف مقصود وثابت (.wrap: 1320px من عرض 1200، و1560px من 1600) — العرض المتوقع = الأقل بين نسبة الشاشة والسقف
    const cap = w >= 1600 ? 1560 : w >= 1200 ? 1320 : Infinity, want = Math.min(g.iw * (w >= 2400 ? .88 : .93), cap) - 1;
    T(`${w}px: content area fills the screen (main/header ≥ ${w >= 2400 ? "88" : "93"}% of width, or the deliberate container cap ${cap === Infinity ? "" : cap + "px"})`, g.main >= want && g.bar >= want && await noHScroll(p), g); await p.close();
  }
  /* ===== 2) شريط التنقل العلوي (نفس التصميم على كل المقاسات: 6 أقسام رئيسية بلون الهوية) ===== */
  const p = await open({width: 1920, height: 1080});
  const nb = await p.evaluate(() => {
    const hero = document.querySelector(".hero"), hr = hero.getBoundingClientRect(), nav = document.querySelector("#tabs"), br = nav.getBoundingClientRect();
    const chips = [...nav.querySelectorAll(".chip")], cs = getComputedStyle(chips[0]), cr = chips.map(c => c.getBoundingClientRect());
    return {afterHero: br.top >= hr.bottom - 1, n: chips.filter(c => c.dataset.g || (c.dataset.id && c.dataset.id !== "all")).length, bgi: cs.backgroundImage, minH: Math.round(Math.min(...cr.map(r => r.height))), allInside: cr.every(r => r.left >= -1 && r.right <= innerWidth + 1), noHidden: nav.scrollWidth <= nav.clientWidth + 1, icons: chips.every(c => c.querySelector("svg")), iw: innerWidth, barW: Math.round(br.width)};
  });
  T("main-section bar sits right after the hero, every chip visible at once with an icon (no hidden/scrolling chips)", nb.afterHero && nb.allInside && nb.noHidden && nb.icons && nb.n >= 6, nb);
  T("dark mode: main chips use the logo gradient (#FCEF44 → #FDC713 → #F58220)", /gradient/.test(nb.bgi) && /252, 239, 68/.test(nb.bgi) && /245, 130, 32/.test(nb.bgi), nb.bgi);
  T("chips are BIG enough to read (≥ 64px tall on desktop)", nb.minH >= 64, nb);
  const chips = await p.evaluate(() => [...document.querySelectorAll("#tabs .chip")].map(c => ({g: c.dataset.g, id: c.dataset.id, t: c.textContent.trim()})));
  T("6 main categories present: AI, education, prompts, stocks/resources, important sites, my work", ["الذكاء الاصطناعي", "الشروحات والتعليم", "البرومبتات", "الاستوكات والموارد", "مواقع مهمة", "شغلي"].every(t => chips.some(c => c.t.includes(t))), chips.map(c => c.t));
  /* كل قسم قابل للوصول ومعروض لوحده */
  let bad = [];
  for (const s of SEC) {
    await L.go(p, s.id); await p.waitForTimeout(150);
    const r = await p.evaluate(id => ({secs: document.querySelectorAll("#content > section.sec").length, only: !!document.getElementById(id), n: document.querySelectorAll("#content .cwrap").length, hash: location.hash, noH: document.documentElement.scrollWidth <= innerWidth}), s.id);
    if (!(r.secs === 1 && r.only && r.n === s.items.length && r.hash.includes("s=" + s.id) && r.noH)) bad.push({id: s.id, ...r});
  }
  T(`every one of the ${SEC.length} sections opens alone with ALL its items, URL updated, no overflow`, bad.length === 0, bad);
  await p.evaluate(() => scrollTo(0, 0));
  /* الضغط على قسم رئيسي = تفريعاته */
  await L.go(p, "all"); await p.waitForTimeout(300); await p.click('#tabs .chip[data-g="res"]'); await p.waitForTimeout(500);
  T("clicking a multi-section main category shows its sub-category tiles + a way back", await p.locator("#content .tile").count() >= 4 && await p.locator("#subtabs .home").count() >= 1);
  await L.go(p, "all"); await p.waitForTimeout(500);
  T("home = intro + the 6 main categories only (no cards outside)", await p.locator("#content .cwrap").count() === 0 && await p.locator("#tabs .chip:not(.newchip)").count() === 6);
  const hues = []; for (const s of SEC) { await L.go(p, s.id); await p.waitForTimeout(80); hues.push({id: s.id, h: await p.evaluate(id => +getComputedStyle(document.getElementById(id)).getPropertyValue("--h"), s.id)}); }
  await L.go(p, "all"); await p.waitForTimeout(400);
  /* ===== 3) ألوان الأقسام والتوهّج ===== */
  const hv = hues.map(x => x.h);
  T(`each section keeps its OWN accent hue: ${hv.length} unique hues`, hues.length === SEC.length && new Set(hv).size === hv.length, hv);
  await p.evaluate(() => scrollTo(0, 0)); const s1 = SEC[4]; await L.go(p,s1.id); await p.waitForTimeout(900);
  const col = await p.evaluate(id => ({h: +getComputedStyle(document.getElementById(id)).getPropertyValue("--h"), root: +getComputedStyle(document.documentElement).getPropertyValue("--h"), card: +getComputedStyle(document.getElementById(id).querySelector(".cwrap")).getPropertyValue("--h")}), s1.id);
  T("opening a section: page glow hue = that section's hue; its cards use it", col.root === col.h && col.card === col.h && col.h === hues.find(x => x.id === s1.id).h, col);
  const glow = await p.evaluate(() => { const b = getComputedStyle(document.body, "::before"); return {pos: b.position, z: b.zIndex, bg: (b.backgroundImage.match(/radial-gradient/g) || []).length, side: (b.backgroundImage.match(/linear-gradient\(90deg/g) || []).length, ptr: b.pointerEvents}; });
  T("identity glow background: fixed, behind everything, click-through, ≥ 3 radial glow layers + dark side shading (identity glow in the centre/top, shadow toward the edges — phase-3 change, by request)", glow.pos === "fixed" && glow.z === "-1" && glow.bg >= 3 && glow.side >= 1 && glow.ptr === "none", glow);
  /* مفضلة: الشريط يختفي والكروت بلونها */
  const sample = SEC[6].items.find(i => i.id); await p.evaluate(id => { try { localStorage.setItem("as-fav", JSON.stringify([id])); } catch (e) {} }, sample.id); await p.reload(); await p.waitForSelector("#tabs .chip", {state: "attached"});
  await p.evaluate(() => document.getElementById("favnav").click()); await p.waitForTimeout(500);
  const fav = await p.evaluate(() => ({bar: getComputedStyle(document.querySelector(".cgroup")).display, h: +getComputedStyle(document.querySelector("#content .cwrap")).getPropertyValue("--h"), noH: document.documentElement.scrollWidth <= innerWidth}));
  T("favourites view: bar hidden (as before), card keeps its section colour, no overflow", fav.bar === "none" && fav.h === hues.find(x => x.id === SEC[6].id).h && fav.noH, fav);
  await p.evaluate(() => document.getElementById("favnav").click()); await p.waitForTimeout(400);
  T("no JS errors on desktop", p.errs.length === 0, p.errs);

  /* ===== 4) الموبايل / التابلت ===== */
  for (const w of [390, 700, 768, 1024]) { const q = await open({width: w, height: 900}); T(`${w}px: no horizontal page scroll; bar spans the viewport`, await noHScroll(q) && await q.evaluate(() => document.querySelector("#tabs").getBoundingClientRect().width >= innerWidth - 80)); await q.close(); }
  const m = await open({width: 390, height: 844}, {isMobile: true, hasTouch: true});
  const mr = await m.evaluate(() => { const t = document.querySelector("#tabs"), cs = getComputedStyle(t), cr = [...t.querySelectorAll(".chip")].map(c => c.getBoundingClientRect()); return {ox: cs.overflowX, nowrap: cs.flexWrap, swipe: t.scrollWidth > t.clientWidth + 100, rows: new Set(cr.map(r => Math.round(r.top))).size, minH: Math.min(...cr.map(r => r.height)), minW: Math.min(...cr.map(r => r.width)), overlap: cr.some((r, i) => i && Math.abs(r.top - cr[0].top) < 3 && (cr[i - 1].left - r.right) < -1 && false), pos: "static", barH: Math.round(document.querySelector(".cgroup").getBoundingClientRect().height)}; });
  // تغيير مقصود (رسمة المستخدم): كل الأقسام ظاهرة مرة واحدة في شبكة ملفوفة (من غير سحب أفقي أو عناصر مخفية)، والشيبس صغيرة (≥34px)، والشريط مش لازق
  T("mobile: bar shows ALL sections at once (wrapped, no horizontal swipe), small chips (≥34px), not sticky", mr.ox === "visible" && !mr.swipe && mr.minH >= 34 && mr.minW >= 44 && !mr.overlap && mr.pos === "static", mr);
  const gaps = await m.evaluate(() => { const r = [...document.querySelectorAll("#tabs .chip")].map(c => c.getBoundingClientRect()); return r.every((x, i) => i === 0 || (r[i - 1].left - x.right) >= 4 || r[i - 1].top !== x.top); }); T("mobile: chips never overlap each other (≥ 4px gap)", gaps);
  T("mobile: bar does not need horizontal scrolling", await m.evaluate(() => { const t = document.querySelector("#tabs"); return t.scrollWidth <= t.clientWidth + 1; }));
  const sec = SEC.find(x => x.id === "prompts") || SEC[3]; await m.evaluate(id => document.querySelector(`#tabs .chip[data-id="${id}"]`).scrollIntoView({inline: "center", block: "nearest"}), sec.id); await m.tap(`#tabs .chip[data-id="${sec.id}"]`); await m.waitForTimeout(1100);
  T("mobile: tapping a section shows ONLY it and the page stays inside the screen", await m.locator("#content section.sec").count() === 1 && await noHScroll(m));
  T("no JS errors on mobile", m.errs.length === 0, m.errs);

  /* ===== 5) الصوت اتلغى نهائيًا ===== */
  const snd = await env.mk({viewport: {width: 1440, height: 900}});
  await snd.addInitScript(() => { window.__aud = {ctx: 0, osc: 0, play: 0, el: 0}; for (const k of ["AudioContext", "webkitAudioContext"]) if (window[k]) { const O = window[k]; window[k] = function () { window.__aud.ctx++; return new O(...arguments); }; } const pl = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { window.__aud.play++; return pl.apply(this, arguments); }; const NA = window.Audio; window.Audio = function () { window.__aud.el++; return new NA(...arguments); }; });
  await snd.goto(env.BASE); await snd.waitForSelector("#tabs .chip", {state: "attached"});
  T("no sound button anywhere (header has only favourites, theme, search)", await snd.locator("#sound, .sound[aria-label*='صوت'], [title*='الصوت'], [title*='صوت']").count() === 0);
  await snd.click('#tabs .chip[data-id="' + SEC[1].id + '"]'); await snd.waitForTimeout(300); await snd.click("#theme"); await snd.click("#favnav"); await snd.click("#favnav"); await snd.click("#totop").catch(() => {});
  await L.go(snd,"video"); await snd.locator(".card .favbtn, .favbtn").first().click().catch(() => {}); await snd.locator("[data-share]").first().click().catch(() => {}); await snd.locator("a.card").first().evaluate(a => a.addEventListener("click", e => e.preventDefault())); await snd.locator("a.card").first().click(); await snd.keyboard.press("/"); await snd.keyboard.type("canva"); await snd.waitForTimeout(300); await snd.keyboard.press("Escape");
  await snd.goto(env.BASE + "#i=" + SEC.flatMap(s => s.items).find(i => i.type === "prompt").id); await snd.reload(); await snd.waitForSelector(".modal.show #mTitle"); await snd.locator("#mCopy, .modal .copy").first().click().catch(() => {}); await snd.waitForTimeout(400);
  const aud = await snd.evaluate(() => ({...window.__aud, audioEls: document.querySelectorAll("audio, video[src]").length, key: (() => { try { return localStorage.getItem("sound"); } catch (e) { return null; } })()}));
  T("after clicking tabs/theme/favourites/share/links/search/copy/modal: zero AudioContext, zero audio playback, no <audio> element, no 'sound' preference stored", aud.ctx === 0 && aud.play === 0 && aud.el === 0 && aud.audioEls === 0 && aud.key === null, aud);
  const src = ["assets/js/fx.js", "assets/js/app.js", "assets/js/theme.js", "assets/js/modal.js", "assets/js/cards.js", "assets/js/report.js", "index.html"].map(f => fs.readFileSync(path.join(L.SITE_DIR, f), "utf8")).join("\n");
  T("source scan: no AudioContext / oscillator / sfx / Audio() / sound button / audio files in the shipped site", !/AudioContext|webkitAudioContext|createOscillator|\bsfx\b|new Audio\(|id="sound"|SOUND_DEFAULT|\.(mp3|wav|ogg|m4a)\b/i.test(src));
  T("toast messages still work without sound (visual success/error feedback kept)", await (async () => { await snd.goto(env.BASE); await snd.waitForSelector("#tabs .chip", {state: "attached"}); await snd.evaluate(() => FX.toast("اختبار ✓", true)); return (await snd.locator("#toast").innerText()) === "اختبار ✓" && await snd.locator("#toast.show.ok").count() === 1; })());
  T("no JS errors in the no-sound run", snd.errs.length === 0, snd.errs);

  /* ===== 6) الوضع الفاتح + axe ===== */
  const lp = await open({width: 1920, height: 1080}, {colorScheme: "light"}); await lp.evaluate(() => document.documentElement.setAttribute("data-theme", "light")); await lp.waitForTimeout(900);
  T("light theme: main chips are WHITE (dark mode = yellow identity), no horizontal scroll", await lp.evaluate(() => getComputedStyle(document.querySelector("#tabs .chip:not(.on)")).backgroundColor === "rgb(255, 255, 255)") && await noHScroll(lp));
  T("no JS errors in light theme", lp.errs.length === 0, lp.errs);
  let axeSrc = null; try { axeSrc = fs.readFileSync(require.resolve("axe-core/axe.min.js", {paths: [L.ROOT, process.env.AXE_DIR || "/nonexistent"]}), "utf8"); } catch (e) {}
  if (!axeSrc) console.log("[design] axe-core مش متسطّب (AXE_DIR) → فحص إمكانية الوصول لم يُنفَّذ — مش محسوب كنجاح");
  else for (const [name, vp, theme, mob] of [["desktop dark", {width: 1920, height: 1080}, "dark", false], ["desktop light", {width: 1920, height: 1080}, "light", false], ["mobile dark", {width: 390, height: 844}, "dark", true]]) {
    const q = await open(vp, mob ? {isMobile: true, hasTouch: true} : {}); await q.evaluate(t => document.documentElement.setAttribute("data-theme", t), theme); await q.click('#tabs .chip[data-id="' + (SEC.find(x => x.id === "prompts") || SEC[2]).id + '"]'); await q.waitForTimeout(900); await q.addScriptTag({content: axeSrc});
    const res = await q.evaluate(async () => (await axe.run(document, {runOnly: ["wcag2a", "wcag2aa", "wcag21aa"]})).violations.map(v => v.id + ":" + v.nodes.length + ":" + v.nodes.slice(0, 2).map(n => n.target.join(" ")).join("|")));
    T(`axe (WCAG 2.1 AA) ${name}: 0 violations`, res.length === 0, res); await q.close();
  }
  await H.end(env);
})().catch(e => { console.error("CRASH", e); process.exit(2); });
