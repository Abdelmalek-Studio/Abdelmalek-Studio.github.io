/* (المرحلة 3: الشريط بقى كبير بأيقونات وأعداد، كل الأقسام ظاهرة على الديسكتوب من غير تمرير، والضغط على قسم مبيحرّكش الصفحة — اختبارات الصفّ الواحد/النزول للبانر اتبدّلت بما يقابلها، بتغيير مقصود بطلب المستخدم.)
   الواجهة: شريط التنقل العلوي، عرض الشاشة كاملة، ألوان الأقسام، توهّج الخلفية، الموبايل، الوضعين، إمكانية الوصول (axe)، وإلغاء الصوت. التشغيل: node tests/design.js
   (كان فيه نسخة قديمة بتختبر السايدبار — اتستبدلت لأن السايدبار اتحوّل لشريط علوي بطلب المستخدم؛ شروط العرض/الألوان/الموبايل/axe اتحافظ عليها.) */
const L = require("./lib"), H = L.harness("design"), {T} = H, {path, fs} = L;
const D = L.loadData(path.join(L.SITE_DIR, "data/data.js")), SEC = D.sections.filter(s => s.items.length), total = SEC.reduce((n, s) => n + s.items.length, 0);
(async () => {
  const env = await H.start({});
  const open = async (vp, o = {}) => { const p = await env.mk({viewport: vp, ...o}); await p.goto(env.BASE + (o.hash || "")); await p.waitForSelector(".card"); await p.waitForTimeout(350); return p; };
  const noHScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth);

  /* ===== 1) العرض ===== */
  for (const w of [1280, 1440, 1920, 2560]) {
    const p = await open({width: w, height: 1000}); const g = await p.evaluate(() => { const m = document.querySelector("main").getBoundingClientRect(), t = document.querySelector("header.top .wrap").getBoundingClientRect(); return {main: Math.round(m.width), bar: Math.round(t.width), iw: innerWidth}; });
    T(`${w}px: content area fills the screen (main/header ≥ ${w >= 2400 ? "88" : "93"}% of width)`, g.main >= g.iw * (w >= 2400 ? .88 : .93) && g.bar >= g.iw * (w >= 2400 ? .88 : .93) && await noHScroll(p), g); await p.close();
  }
  /* ===== 2) شريط التنقل العلوي (ديسكتوب) ===== */
  const p = await open({width: 1920, height: 1080});
  const nb = await p.evaluate(() => {
    const hero = document.querySelector(".hero"), bar = document.querySelector(".cgroup"), hr = hero.getBoundingClientRect(), br = bar.getBoundingClientRect(), hd = document.querySelector("header.top").getBoundingClientRect();
    const rgb = s => s.match(/[\d.]+/g).map(Number), lum = ([r, g, b]) => { const f = v => (v /= 255) <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const chip = document.querySelector("#tabs .chip:not(.on)"), cs = getComputedStyle(chip), on = getComputedStyle(document.querySelector("#tabs .chip.on")), bs = getComputedStyle(bar);
    const socials = document.querySelector(".hero .socials, .hero a[href^=http]"); const sr = socials && socials.getBoundingClientRect();
    return {afterHero: br.top >= hr.bottom - 1, belowSocials: !sr || br.top >= sr.bottom - 1, hero: hero.nextElementSibling.id + ">" + hero.nextElementSibling.nextElementSibling.className, barW: Math.round(br.width), iw: innerWidth, barLum: lum(rgb(bs.backgroundColor.startsWith("rgba(0, 0, 0, 0)") ? "rgb(20,15,10)" : bs.backgroundColor)), bgImg: bs.backgroundImage.slice(0, 60), txt: cs.color, h: Math.round(chip.getBoundingClientRect().height), fs: parseFloat(cs.fontSize), onBg: on.backgroundImage, onTxt: on.color, horizontal: [...document.querySelectorAll("#tabs .chip")].slice(0, 6).every((c, i, a) => i === 0 || Math.abs(c.getBoundingClientRect().top - a[0].getBoundingClientRect().top) < 3), headerBottom: Math.round(hd.bottom)};
  });
  T("top bar sits right after the hero (socials), before everything else, full viewport width", nb.afterHero && nb.belowSocials && nb.hero.startsWith("navtop>cgroup") && nb.barW >= nb.iw - 2, nb);
  T("top bar: dark background, white text, BIG (≥52px chips, ≥16px font), horizontal rows", nb.barLum < .05 && nb.txt === "rgb(255, 255, 255)" && nb.h >= 52 && nb.fs >= 16 && nb.horizontal, nb);
  T("top bar: active section uses the orange→red identity gradient with white text", /gradient/.test(nb.onBg) && /232, 86, 26/.test(nb.onBg) && /192, 48, 31/.test(nb.onBg) && nb.onTxt === "rgb(255, 255, 255)", nb.onBg);
  const chips = await p.evaluate(() => [...document.querySelectorAll("#tabs .chip")].map(c => ({id: c.dataset.id || c.dataset.view, t: c.textContent.trim(), title: c.title})));
  const ids = chips.filter(c => c.id !== "new").map(c => c.id);
  T(`top bar contains EVERY existing section (${SEC.length}) + the home chip; titles equal the data; none dropped`, chips[0].id === "all" && SEC.every(s => chips.some(c => c.id === s.id && c.t === s.title)) && ids.length === SEC.length + 1, chips.map(c => c.id).join());
  T("home chip is clearly labelled (house icon + «الكل» + tooltip «الرئيسية — عرض كل الأقسام»)", chips[0].t === "الكل" && /الرئيسية/.test(chips[0].title) && (await p.evaluate(() => getComputedStyle(document.querySelector('#tabs .chip[data-id="all"]'), "::before").content)) === '""');
  /* لزق تحت الهيدر */
  const st = []; for (const y of [900, 2500, 6000]) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(220); st.push(await p.evaluate(() => { const r = document.querySelector(".cgroup").getBoundingClientRect(), h = document.querySelector("header.top").getBoundingClientRect(); return Math.abs(r.top - h.bottom) <= 2 && r.height > 60 && r.height < 190; })); }
  T("desktop: bar stays stuck right under the header while scrolling (switch section from anywhere)", st.every(Boolean), st);
  await p.evaluate(() => scrollTo(0, 0));
  /* الضغط على قسم = محتواه وبس وفورًا */
  const targets = SEC.filter((s, i) => i % 3 === 1).slice(0, 5); let bad = [];
  for (const s of targets) {
    await p.evaluate(() => scrollTo(0, [0, 420][Math.round(Math.random())])); await p.waitForTimeout(250); await p.click(`#tabs .chip[data-id="${s.id}"]`); await p.waitForTimeout(1400);
    // تغيير مقصود (طلب المستخدم): الضغط بيطلّع الشريط تحت الهيدر على طول (الهيرو يطلع برّه) والمحتوى تحته
    const r = await p.evaluate(id => { const sec = document.getElementById(id), bar = document.querySelector(".cgroup").getBoundingClientRect(), hd = document.querySelector("header.top").getBoundingClientRect(), h = sec && sec.querySelector(".sec-head").getBoundingClientRect(); return {barAtTop: Math.abs(bar.top - hd.bottom) <= 3, heroGone: document.querySelector(".hero").getBoundingClientRect().bottom <= hd.bottom + 4, below: !!h && h.top >= bar.bottom - 2 && h.top < innerHeight, secs: document.querySelectorAll("#content section.sec").length, only: !!sec && document.querySelector("#content section.sec").id === id, n: sec ? sec.querySelectorAll(".cwrap").length : 0, hash: location.hash, on: document.querySelector("#tabs .chip.on").dataset.id}; }, s.id);
    if (!(r.secs === 1 && r.only && r.n === s.items.length && r.on === s.id && r.hash.includes("s=" + s.id) && r.barAtTop && r.heroGone && r.below)) bad.push({id: s.id, ...r});
  }
  T(`click a section ×${targets.length}: the section BAR ends up at the very top (under the header; name/photo scrolled away), ONLY that section's content is right below it, URL + active state`, bad.length === 0, bad);
  await p.evaluate(() => { document.querySelector("#tabs").scrollLeft = -99999; document.querySelector("#tabs").scrollLeft = 99999; document.querySelector("#tabs").scrollLeft = -99999; }); await p.evaluate(() => document.querySelector("#tabs").scrollTo({left: -5000})); await p.waitForTimeout(200);
  const vis = await p.evaluate(() => { const nav = document.querySelector("#tabs"), cs = [...nav.querySelectorAll(".chip")].map(c => c.getBoundingClientRect()); return {noHidden: nav.scrollWidth <= nav.clientWidth + 1, allInside: cs.every(r => r.left >= -1 && r.right <= innerWidth + 1 && r.width > 90), n: cs.length, icons: [...nav.querySelectorAll(".chip")].filter(c => getComputedStyle(c, "::before").content !== "none").length, counts: [...nav.querySelectorAll(".chip")].every(c => /^\d+$/.test(c.dataset.n))}; });
  T("desktop: EVERY section chip is visible at once (no hidden/scrolled-away chips), each with an icon and its item count", vis.noHidden && vis.allInside && vis.icons === vis.n && vis.counts, vis);
  await p.click('#tabs .chip[data-id="all"]'); await p.waitForTimeout(700);
  T("home chip → back to ALL sections (every section and every card), no section selected, URL cleared", await p.locator("#content section.sec").count() === SEC.length && await p.locator("#content .cwrap").count() === total && !/s=/.test(await p.evaluate(() => location.hash)));
  const hov = await (async () => { await p.click(`#tabs .chip[data-id="${SEC[2].id}"]`); await p.hover("#tabs .chip.on"); await p.waitForTimeout(350); return p.evaluate(() => getComputedStyle(document.querySelector("#tabs .chip.on")).backgroundImage); })();
  T("hovering the ACTIVE section keeps its colour", /gradient/.test(hov), hov);
  await p.click('#tabs .chip[data-id="all"]'); await p.waitForTimeout(500);
  /* ===== 3) ألوان الأقسام والتوهّج (لسه شغّالة على البانر والكروت والخلفية) ===== */
  const hues = await p.evaluate(() => [...document.querySelectorAll("#content section.sec")].map(s => ({id: s.id, h: +getComputedStyle(s).getPropertyValue("--h")})));
  const dist = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); }, hv = hues.map(x => x.h);
  T(`each section keeps its OWN accent colour on banner/cards: ${hv.length} unique hues, neighbours ≥ 25° apart`, hues.length === SEC.length && new Set(hv).size === hv.length && hv.every((h, i) => i === 0 || dist(h, hv[i - 1]) >= 25), hv);
  await p.evaluate(() => scrollTo(0, 0)); const s1 = SEC[4]; await p.click(`#tabs .chip[data-id="${s1.id}"]`); await p.waitForTimeout(900);
  const col = await p.evaluate(id => ({h: +getComputedStyle(document.getElementById(id)).getPropertyValue("--h"), root: +getComputedStyle(document.documentElement).getPropertyValue("--h"), card: +getComputedStyle(document.getElementById(id).querySelector(".cwrap")).getPropertyValue("--h")}), s1.id);
  T("opening a section: page glow hue = that section's hue; its cards use it", col.root === col.h && col.card === col.h && col.h === hues.find(x => x.id === s1.id).h, col);
  const glow = await p.evaluate(() => { const b = getComputedStyle(document.body, "::before"); return {pos: b.position, z: b.zIndex, bg: (b.backgroundImage.match(/radial-gradient/g) || []).length, side: (b.backgroundImage.match(/linear-gradient\(90deg/g) || []).length, ptr: b.pointerEvents}; });
  T("identity glow background: fixed, behind everything, click-through, ≥ 3 radial glow layers + dark side shading (identity glow in the centre/top, shadow toward the edges — phase-3 change, by request)", glow.pos === "fixed" && glow.z === "-1" && glow.bg >= 3 && glow.side >= 1 && glow.ptr === "none", glow);
  /* مفضلة: الشريط يختفي والكروت بلونها */
  const sample = SEC[6].items.find(i => i.id); await p.evaluate(id => { try { localStorage.setItem("as-fav", JSON.stringify([id])); } catch (e) {} }, sample.id); await p.reload(); await p.waitForSelector(".card");
  await p.evaluate(() => document.getElementById("favnav").click()); await p.waitForTimeout(500);
  const fav = await p.evaluate(() => ({bar: getComputedStyle(document.querySelector(".cgroup")).display, h: +getComputedStyle(document.querySelector("#content .cwrap")).getPropertyValue("--h"), noH: document.documentElement.scrollWidth <= innerWidth}));
  T("favourites view: bar hidden (as before), card keeps its section colour, no overflow", fav.bar === "none" && fav.h === hues.find(x => x.id === SEC[6].id).h && fav.noH, fav);
  await p.evaluate(() => document.getElementById("favnav").click()); await p.waitForTimeout(400);
  T("no JS errors on desktop", p.errs.length === 0, p.errs);

  /* ===== 4) الموبايل / التابلت ===== */
  for (const w of [390, 700, 768, 1024]) { const q = await open({width: w, height: 900}); T(`${w}px: no horizontal page scroll; bar spans the viewport`, await noHScroll(q) && await q.evaluate(() => document.querySelector(".cgroup").getBoundingClientRect().width >= innerWidth - 2)); await q.close(); }
  const m = await open({width: 390, height: 844}, {isMobile: true, hasTouch: true});
  const mr = await m.evaluate(() => { const t = document.querySelector("#tabs"), cs = getComputedStyle(t), cr = [...t.querySelectorAll(".chip")].map(c => c.getBoundingClientRect()); return {ox: cs.overflowX, nowrap: cs.flexWrap, swipe: t.scrollWidth > t.clientWidth + 100, rows: new Set(cr.map(r => Math.round(r.top))).size, minH: Math.min(...cr.map(r => r.height)), minW: Math.min(...cr.map(r => r.width)), overlap: cr.some((r, i) => i && Math.abs(r.top - cr[0].top) < 3 && (cr[i - 1].left - r.right) < -1 && false), pos: getComputedStyle(document.querySelector(".cgroup")).position, barH: Math.round(document.querySelector(".cgroup").getBoundingClientRect().height)}; });
  T("mobile: bar is a 2-row horizontally-swipeable grid (many sections visible), touch-sized chips (≥44px), not sticky (no crowding)", mr.ox === "auto" && mr.swipe && mr.rows === 2 && mr.minH >= 44 && mr.minW >= 44 && mr.pos === "static" && mr.barH < 190, mr);
  const gaps = await m.evaluate(() => { const r = [...document.querySelectorAll("#tabs .chip")].map(c => c.getBoundingClientRect()); return r.every((x, i) => i === 0 || (r[i - 1].left - x.right) >= 4 || r[i - 1].top !== x.top); }); T("mobile: chips never overlap each other (≥ 4px gap)", gaps);
  const before = await m.evaluate(() => document.querySelector("#tabs").scrollLeft); await m.evaluate(() => document.querySelector("#tabs").scrollBy({left: -400})); await m.waitForTimeout(250); T("mobile: bar scrolls horizontally", await m.evaluate(b => document.querySelector("#tabs").scrollLeft !== b, before));
  const sec = SEC[3]; await m.evaluate(id => document.querySelector(`#tabs .chip[data-id="${id}"]`).scrollIntoView({inline: "center", block: "nearest"}), sec.id); await m.tap(`#tabs .chip[data-id="${sec.id}"]`); await m.waitForTimeout(1100);
  T("mobile: tapping a section shows ONLY it, the page stays inside the screen, and the bar is brought to the top (hero scrolled away)", await m.locator("#content section.sec").count() === 1 && await noHScroll(m) && await m.evaluate(() => { const b = document.querySelector(".cgroup").getBoundingClientRect(), hd = document.querySelector("header.top").getBoundingClientRect(); return b.top <= hd.bottom + 80 && b.top >= 0; }));
  T("no JS errors on mobile", m.errs.length === 0, m.errs);

  /* ===== 5) الصوت اتلغى نهائيًا ===== */
  const snd = await env.mk({viewport: {width: 1440, height: 900}});
  await snd.addInitScript(() => { window.__aud = {ctx: 0, osc: 0, play: 0, el: 0}; for (const k of ["AudioContext", "webkitAudioContext"]) if (window[k]) { const O = window[k]; window[k] = function () { window.__aud.ctx++; return new O(...arguments); }; } const pl = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { window.__aud.play++; return pl.apply(this, arguments); }; const NA = window.Audio; window.Audio = function () { window.__aud.el++; return new NA(...arguments); }; });
  await snd.goto(env.BASE); await snd.waitForSelector(".card");
  T("no sound button anywhere (header has only favourites, theme, search)", await snd.locator("#sound, .sound[aria-label*='صوت'], [title*='الصوت'], [title*='صوت']").count() === 0);
  await snd.click('#tabs .chip[data-id="' + SEC[1].id + '"]'); await snd.waitForTimeout(300); await snd.click("#theme"); await snd.click("#favnav"); await snd.click("#favnav"); await snd.click("#totop").catch(() => {});
  await snd.click('#tabs .chip[data-id="all"]'); await snd.locator(".card .favbtn, .favbtn").first().click().catch(() => {}); await snd.locator("[data-share]").first().click().catch(() => {}); await snd.locator("a.card").first().evaluate(a => a.addEventListener("click", e => e.preventDefault())); await snd.locator("a.card").first().click(); await snd.keyboard.press("/"); await snd.keyboard.type("canva"); await snd.waitForTimeout(300); await snd.keyboard.press("Escape");
  await snd.goto(env.BASE + "#i=" + SEC.flatMap(s => s.items).find(i => i.type === "prompt").id); await snd.reload(); await snd.waitForSelector(".modal.show #mTitle"); await snd.locator("#mCopy, .modal .copy").first().click().catch(() => {}); await snd.waitForTimeout(400);
  const aud = await snd.evaluate(() => ({...window.__aud, audioEls: document.querySelectorAll("audio, video[src]").length, key: (() => { try { return localStorage.getItem("sound"); } catch (e) { return null; } })()}));
  T("after clicking tabs/theme/favourites/share/links/search/copy/modal: zero AudioContext, zero audio playback, no <audio> element, no 'sound' preference stored", aud.ctx === 0 && aud.play === 0 && aud.el === 0 && aud.audioEls === 0 && aud.key === null, aud);
  const src = ["assets/js/fx.js", "assets/js/app.js", "assets/js/theme.js", "assets/js/modal.js", "assets/js/cards.js", "assets/js/report.js", "index.html"].map(f => fs.readFileSync(path.join(L.SITE_DIR, f), "utf8")).join("\n");
  T("source scan: no AudioContext / oscillator / sfx / Audio() / sound button / audio files in the shipped site", !/AudioContext|webkitAudioContext|createOscillator|\bsfx\b|new Audio\(|id="sound"|SOUND_DEFAULT|\.(mp3|wav|ogg|m4a)\b/i.test(src));
  T("toast messages still work without sound (visual success/error feedback kept)", await (async () => { await snd.goto(env.BASE); await snd.waitForSelector(".card"); await snd.evaluate(() => FX.toast("اختبار ✓", true)); return (await snd.locator("#toast").innerText()) === "اختبار ✓" && await snd.locator("#toast.show.ok").count() === 1; })());
  T("no JS errors in the no-sound run", snd.errs.length === 0, snd.errs);

  /* ===== 6) الوضع الفاتح + axe ===== */
  const lp = await open({width: 1920, height: 1080}, {colorScheme: "light"}); await lp.evaluate(() => document.documentElement.setAttribute("data-theme", "light")); await lp.waitForTimeout(300);
  T("light theme: bar stays dark with white text (identity), no horizontal scroll", await lp.evaluate(() => getComputedStyle(document.querySelector("#tabs .chip:not(.on)")).color === "rgb(255, 255, 255)") && await noHScroll(lp));
  T("no JS errors in light theme", lp.errs.length === 0, lp.errs);
  let axeSrc = null; try { axeSrc = fs.readFileSync(require.resolve("axe-core/axe.min.js", {paths: [L.ROOT, process.env.AXE_DIR || "/nonexistent"]}), "utf8"); } catch (e) {}
  if (!axeSrc) console.log("[design] axe-core مش متسطّب (AXE_DIR) → فحص إمكانية الوصول لم يُنفَّذ — مش محسوب كنجاح");
  else for (const [name, vp, theme, mob] of [["desktop dark", {width: 1920, height: 1080}, "dark", false], ["desktop light", {width: 1920, height: 1080}, "light", false], ["mobile dark", {width: 390, height: 844}, "dark", true]]) {
    const q = await open(vp, mob ? {isMobile: true, hasTouch: true} : {}); await q.evaluate(t => document.documentElement.setAttribute("data-theme", t), theme); await q.click('#tabs .chip[data-id="' + SEC[2].id + '"]'); await q.waitForTimeout(900); await q.addScriptTag({content: axeSrc});
    const res = await q.evaluate(async () => (await axe.run(document, {runOnly: ["wcag2a", "wcag2aa", "wcag21aa"]})).violations.map(v => v.id + ":" + v.nodes.length + ":" + v.nodes.slice(0, 2).map(n => n.target.join(" ")).join("|")));
    T(`axe (WCAG 2.1 AA) ${name}: 0 violations`, res.length === 0, res); await q.close();
  }
  await H.end(env);
})().catch(e => { console.error("CRASH", e); process.exit(2); });
