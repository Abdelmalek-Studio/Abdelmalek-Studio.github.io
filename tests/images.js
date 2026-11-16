/* فحص الصور في لوحة الإدارة: موجودة / مفقودة / بطيئة / مهلة / تالفة / متكررة. التشغيل: node tests/images.js */
const L = require("./lib"), H = L.harness("images"), {T} = H, {fs, path} = L;
const CUR = L.loadData(path.join(L.ROOT, "site/data/data.js"));
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';
const P = "/site/assets/img/t/", hits = {};
const reply = (name, o) => [P + name, (q, r) => { hits[name] = (hits[name] || 0) + 1; const go = () => { r.writeHead(o.status || 200, {"content-type": o.type || "image/png"}); r.end(o.body ?? PNG); }; o.delay ? setTimeout(go, o.delay) : go(); return true; }];
const OV = Object.fromEntries([
  reply("ok.png", {}), reply("gone.png", {status: 404, type: "text/plain", body: "nf"}), reply("slow2.png", {delay: 2000}), reply("slow2b.png", {delay: 2000}), reply("slow9.png", {delay: 9000}), reply("slow9b.png", {delay: 9000}), reply("slow9c.png", {delay: 9000}), reply("corrupt.png", {body: Buffer.from("this is not a png at all")}),
  reply("html.jpg", {type: "text/html", body: "<html>hi</html>"}), reply("ok.svg", {type: "image/svg+xml", body: SVG}), reply("bad.svg", {type: "text/html", body: "<html>nope</html>"}), reply("err500.png", {status: 500, type: "text/plain", body: "x"}),
]);
(async () => {
  const env = await H.start(OV), tmp = L.tmpdir();
  const open = async () => { const a = await env.mk(); a.dl = []; a.removeAllListeners("dialog"); a.on("dialog", d => { a.dl.push(d.message()); d.accept(); }); await a.goto(env.ADMIN); await a.waitForSelector(".item"); return a; };
  const probe = (a, p) => a.evaluate(async p => { const t = Date.now(); const r = await probeImage(p); return {r, ms: Date.now() - t}; }, p);
  const a = await open();
  /* ===== probeImage وحدها ===== */
  const cases = [["t/ok.png", "ok"], ["t/gone.png", "fail"], ["t/corrupt.png", "fail"], ["t/html.jpg", "fail"], ["t/err500.png", "fail"], ["t/ok.svg", "ok"], ["t/bad.svg", "ok-or-fail"], ];
  for (const [p, exp] of cases) { const r = await probe(a, "assets/img/" + p); T(`probe ${p} → ${exp}`, exp === "ok-or-fail" ? ["ok", "fail"].includes(r.r) : r.r === exp, r); }
  const slow = await probe(a, "assets/img/t/slow2b.png"); T("slow-but-in-time image (2s) is OK, not flagged", slow.r === "ok" && slow.ms >= 1800 && slow.ms < 5000, slow);
  const to = await probe(a, "assets/img/t/slow9b.png"); T("image slower than the limit → «timeout» (NOT ok, NOT fail) after ≈6s", to.r === "timeout" && to.ms >= 5800 && to.ms < 7500, to);
  /* ===== findMissingImages ===== */
  const t0 = Date.now();
  const rep = await a.evaluate(async () => { const site = {photo: "assets/img/t/ok.png", logo: "assets/img/t/gone.png"}; const secs = [{id: "a", title: "A", cover: "assets/img/t/slow9c.png", items: [
    {id: "1", title: "ok", image: "assets/img/t/ok.png"}, {id: "2", title: "miss", image: "assets/img/t/gone.png"}, {id: "3", title: "dup", image: "assets/img/t/gone.png"}, {id: "4", title: "unk", image: "assets/img/t/slow9c.png"},
    {id: "5", title: "ext", image: "https://example.com/x.png"}, {id: "6", title: "blank", image: "   "}, {id: "7", title: "none"}, {id: "8", title: "corrupt", image: "assets/img/t/corrupt.png"}, {id: "9", title: "svg", image: "assets/img/t/ok.svg"}]}]; const t = Date.now(); const r = await findMissingImages(site, secs); return {r: r.map(x => ({kind: x.kind, msg: x.msg})), ms: Date.now() - t}; });
  T("findMissing: classifies missing / unverified separately", rep.r.filter(x => x.kind === "missing").length === 4 && rep.r.filter(x => x.kind === "unverified").length === 2, rep.r.map(x => x.kind).join());
  T("findMissing: missing sorted before unverified", rep.r.slice(0, 4).every(x => x.kind === "missing") && rep.r.slice(4).every(x => x.kind === "unverified"));
  T("findMissing: ok, svg, external URL, blank and absent images produce no warning", !rep.r.some(x => /ok\.png|ok\.svg|example\.com|«ok»|«svg»|«none»|«blank»|«ext»/.test(x.msg)), rep.r.map(x => x.msg.slice(0, 60)));
  T("findMissing: timeout message is distinct («لم يتم التحقق»), missing says «مش موجود»", rep.r.find(x => x.kind === "unverified").msg.includes("لم يتم التحقق") && rep.r.find(x => x.kind === "missing").msg.includes("مش موجود"));
  T("findMissing: runs in parallel (total ≈6s, not a sum of timeouts) and is bounded", rep.ms < 8000, rep.ms);
  const h0 = hits["err500.png"] || 0; await a.evaluate(async () => { await findMissingImages({}, [{id: "a", title: "A", items: [1, 2, 3, 4, 5].map(k => ({id: "x" + k, title: "t", image: "assets/img/t/err500.png"}))}]); });
  T("five items sharing one image path → exactly one request", (hits["err500.png"] || 0) - h0 === 1, (hits["err500.png"] || 0) - h0);
  /* ===== مسار التنزيل الكامل ===== */
  const d = L.clone(CUR); d.sections[0].items[0].image = "assets/img/t/gone.png"; d.sections[0].items[1].image = "assets/img/t/slow9.png"; d.sections[0].items[2].image = "assets/img/t/ok.png";
  const f = path.join(tmp, "img.json"); fs.writeFileSync(f, JSON.stringify(d)); await a.setInputFiles("#restore", f); await a.waitForTimeout(500);
  const tD = Date.now(); const txt = await L.download(a, "#download", tmp); await a.waitForFunction(() => !document.querySelector("#errbox").hidden, null, {timeout: 12000}); const box = await a.innerText("#errbox");
  T("download is NOT blocked by image warnings (file produced with all data)", L.parseData(txt).sections[0].items[0].image === "assets/img/t/gone.png" && L.parseData(txt).sections.reduce((n, s) => n + s.items.length, 0) === 144);
  T("warning box lists «1 صورة مش موجودة» and «1 … لم يتم التحقق»", /1 صورة مش موجودة/.test(box) && /1 صورة لم يتم التحقق/.test(box), box.slice(0, 220));
  T("warning box says it doesn't block download", /مش بيمنع/.test(box));
  T("page stayed responsive while probing (status/UI already updated before warnings)", /اتنزّل/.test(await a.innerText("#status")));
  const d2 = L.clone(CUR); const f2 = path.join(tmp, "img2.json"); fs.writeFileSync(f2, JSON.stringify(d2)); await a.setInputFiles("#restore", f2); await a.waitForTimeout(400);
  const t1 = Date.now(); await L.download(a, "#download", tmp); await a.waitForTimeout(1500); T("real data (all images exist): no image warning appears", await a.locator("#errbox").isHidden() || !/صورة/.test(await a.innerText("#errbox")), await a.innerText("#errbox"));
  T("no JS errors", a.errs.length === 0, a.errs);
  await H.end(env);
})().catch(e => { console.error("CRASH", e); process.exit(2); });
