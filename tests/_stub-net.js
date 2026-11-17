/* بيتحمّل تلقائيًا مع كل اختبار (run-all بيحطّه في NODE_OPTIONS): لوجوهات المواقع (Google favicons) بترجع صورة صغيرة ثابتة
   بدل الإنترنت الحقيقي، فنتايج الاختبارات متتأثرش بسرعة الشبكة ولا بحظر/تقييد الطلبات على سيرفر GitHub. */
try {
  const pw = require("playwright"), png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAeklEQVR4nO3PUQkAIBTAwBfDpvY2gSH8OITBAtxm7fN1wwUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWPHYBlQoRaVkWLsAAAAAASUVORK5CYII=", "base64");
  const hook = ctx => ctx.route(/google\.com\/s2\/favicons/, r => r.fulfill({status: 200, contentType: "image/png", body: png}));
  const launch = pw.chromium.launch.bind(pw.chromium);
  pw.chromium.launch = async (...a) => {
    const b = await launch(...a), nc = b.newContext.bind(b);
    b.newContext = async (...x) => { const c = await nc(...x); await hook(c); return c; };
    b.newPage = async o => (await b.newContext(o || {})).newPage();
    return b;
  };
} catch {}
