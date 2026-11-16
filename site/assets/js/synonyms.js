/* مرادفات البحث + الاقتراحات أثناء الكتابة.
   كل مجموعة: label (اسم الفكرة بيظهر في الاقتراحات) / q (النص اللي بيتكتب في خانة البحث لما تختارها)
   match = كلمات المستخدم المحتملة (عربي وإنجليزي)، find = الكلمات اللي بندوّر عليها جوه محتوى الأدوات.
   يعني لو كتب «Background Removal» بنعرض أي أداة وصفها فيه «إزالة الخلفية» حتى لو الكلمة مش في اسمها.
   لإضافة مجموعة جديدة: أضف عنصر جديد في SYN. الحروف بتتوحّد تلقائيًا (أ/إ/ا، ة/ه، ى/ي). */
const SYN = [
  {label: "إزالة الخلفية (Background Removal)", q: "إزالة الخلفية",
   match: ["إزالة الخلفية", "ازالة خلفية", "حذف الخلفية", "قص الخلفية", "تفريغ الخلفية", "background removal", "remove background", "remove bg", "removebg", "background remover", "bg remover", "cutout"],
   find: ["إزالة الخلفية", "إزالة خلفية", "remove.bg", "clipdrop"]},
  {label: "رفع جودة / دقة الصور (Upscale)", q: "رفع جودة",
   match: ["رفع جودة", "رفع دقة", "تحسين الصور", "تحسين الصورة", "تكبير الصور", "تكبير الصورة", "upscale", "upscaler", "upscaling", "enhance", "super resolution", "ترميم", "رفع الجودة", "رفع الدقة", "تحسين الجودة", "تحسين جودة", "زيادة الجودة", "زيادة الدقة", "جودة الصور", "جودة الصورة", "ترميم الصور", "تكبير", "hd", "4k", "8k", "10k"],
   find: ["رفع جودة", "رفع دقة", "رفع الدقة", "تكبير", "upscale", "تحسين", "ترميم"]},
  {label: "خطوط (Fonts)", q: "خطوط",
   match: ["خط", "خطوط", "فونت", "فونتات", "font", "fonts", "typeface", "typography", "تايبوجرافي"],
   find: ["خطوط", "font", "تايبوجرافي", "typography"]},
  {label: "إنشاء شخصيات (Characters)", q: "شخصيات",
   match: ["شخصيات", "شخصية", "كركتر", "كاريكتر", "كاريكاتير", "character", "characters", "character sheet", "avatar", "أفاتار", "افاتار"],
   find: ["شخصيات", "شخصية", "كركتر", "كاريكاتير", "character"]},
  {label: "ألوان وباليتات (Colors)", q: "ألوان",
   match: ["ألوان", "الوان", "باليت", "باليتات", "color", "colors", "colour", "palette", "palettes", "color palette"],
   find: ["ألوان", "باليت", "palette", "color"]},
  {label: "أيقونات وفيكتور (Icons & Vector)", q: "أيقونات",
   match: ["أيقونات", "ايقونات", "أيقونة", "ايقونة", "icon", "icons", "vector", "vectors", "فيكتور", "svg", "illustration", "illustrations", "إيلستريشن", "ايلستريشن", "رسومات"],
   find: ["أيقونات", "أيقونة", "icon", "فيكتور", "vector", "svg", "إيلستريشن", "illustration"]},
  {label: "صور ستوك جاهزة (Stock Photos)", q: "ستوك",
   match: ["ستوك", "stock", "stock photos", "صور مجانية", "صور جاهزة", "free photos", "free images", "royalty free", "بدون حقوق"],
   find: ["ستوك", "stock", "صور مجانية", "صور عالية الجودة", "صور وفيديوهات مجانية", "بدون حقوق", "public domain"]},
  {label: "مونتاج وتعديل فيديو (Video Editing)", q: "مونتاج",
   match: ["مونتاج", "مونتير", "تعديل فيديو", "تعديل الفيديو", "video editing", "video editor", "editing", "كلر", "color grading"],
   find: ["مونتاج", "تعديل فيديو", "video editing", "كلر"]},
  {label: "موشن جرافيك وتحريك (Motion & Animation)", q: "موشن",
   match: ["موشن", "تحريك", "أنيميشن", "انيميشن", "animation", "animate", "motion", "motion graphics", "after effects", "lottie"],
   find: ["موشن", "تحريك", "أنيميشن", "animation", "motion", "lottie"]},
  {label: "توليد صور بالذكاء الاصطناعي (AI Images)", q: "توليد صور",
   match: ["توليد صور", "توليد الصور", "صور بالذكاء الاصطناعي", "ai image", "ai images", "image generation", "text to image", "ai art", "midjourney"],
   find: ["توليد صور", "توليد وتعديل صور", "image generation"]},
  {label: "توليد فيديو بالذكاء الاصطناعي (AI Video)", q: "توليد فيديو",
   match: ["توليد فيديو", "توليد الفيديو", "فيديو بالذكاء الاصطناعي", "ai video", "video generation", "text to video", "image to video", "تحريك صور"],
   find: ["توليد فيديو", "فيديو سينمائي", "تحريك صور", "تحريك الصور", "video generation"]},
  {label: "ضغط الصور (Compress)", q: "ضغط",
   match: ["ضغط", "ضغط الصور", "ضغط صور", "تصغير حجم", "تقليل حجم", "compress", "compression", "optimize", "optimizer"],
   find: ["ضغط الصور", "ضغط صور", "ضغط وتحويل", "وضغط", "compress"]},
  {label: "تعديل الصور / فوتوشوب (Photo Editing)", q: "فوتوشوب",
   match: ["فوتوشوب", "photoshop", "photo editor", "photo editing", "محرر صور", "تعديل صور", "تعديل الصور"],
   find: ["فوتوشوب", "photopea", "محرر صور", "تعديل صور", "تعديل وتوليد"]},
  {label: "لوجو وهوية بصرية (Logo & Branding)", q: "لوجو",
   match: ["لوجو", "لوجوهات", "logo", "logos", "هوية", "هوية بصرية", "branding", "brand", "براند", "براندينج"],
   find: ["لوجو", "هوية", "brand", "براند"]},
  {label: "شات ومساعد ذكي (AI Chat)", q: "شات",
   match: ["شات", "شات بوت", "chatbot", "chat", "ai assistant", "assistant", "مساعد", "مساعد ذكي"],
   find: ["مساعد", "محادثة", "شات ذكاء", "شات بوت", "chatbot"]},
  {label: "موسيقى ومؤثرات صوتية (Music & Sound)", q: "موسيقى",
   match: ["موسيقى", "موسيقي", "music", "sound", "sound effects", "sfx", "مؤثرات", "مؤثرات صوتية", "صوت", "audio"],
   find: ["موسيقى", "مؤثرات صوت", "music", "sound"]},
  {label: "إلهام ومراجع (Inspiration)", q: "إلهام",
   match: ["إلهام", "الهام", "inspiration", "inspire", "مودبورد", "moodboard", "mood board", "reference", "references", "مراجع", "أفكار", "افكار", "ideas"],
   find: ["إلهام", "مودبورد", "مراجع", "inspiration"]},
  {label: "ثري دي (3D)", q: "3D",
   match: ["3d", "ثري دي", "ثلاثي الأبعاد", "ثلاثي الابعاد", "مجسمات", "modeling"],
   find: ["3d", "ثلاثي الأبعاد", "ثلاثية الأبعاد"]},
  {label: "تصميم واجهات ومواقع (UI / Web)", q: "واجهات",
   match: ["واجهات", "ui", "ux", "ui ux", "interface", "landing page", "web design", "تصميم مواقع", "تصميم واجهات", "figma"],
   find: ["واجهات", "landing", "تصميمات مواقع", "تصميمات المواقع"]},
  {label: "باكدجينج وعبوات (Packaging)", q: "باكدجينج",
   match: ["باكدجينج", "packaging", "عبوات", "عبوة", "علب", "تغليف"],
   find: ["باكدجينج", "packaging", "عبوات"]},
  {label: "تحويل وتغيير صيغ الملفات (Convert)", q: "تحويل",
   match: ["تحويل", "تحويل صيغة", "تحويل الصيغ", "convert", "converter", "format"],
   find: ["تحويل", "convert"]},
  {label: "إعلانات وتصوير منتجات (Ads & Products)", q: "إعلان",
   match: ["إعلان", "اعلان", "إعلانات", "اعلانات", "ads", "advertising", "تصوير منتجات", "product photography", "منتجات", "منتج"],
   find: ["إعلان", "منتج", "product"]}
];

const Search = (() => {
  // بنعمل تطبيع لكل الكلمات مرة واحدة (نفس norm بتاعة البحث)
  const G = SYN.map(g => ({label: g.label, q: g.q, m: g.match.map(norm), f: g.find.map(norm)}));
  const cache = new Map();
  // المجموعات اللي الكلمة المكتوبة تخصها: تطابق كامل، أو الكلمة جزء من كتابة المستخدم، أو بداية كلمة (وهو لسه بيكتب)
  function groupsFor(term){
    if (term.length < 2) return [];
    return G.filter(g => g.m.some(p => p === term || (p.length > 2 && term.includes(p)) || (term.length >= 3 && p.split(" ").some(w => w.startsWith(term)))));
  }
  // الكلمات الإضافية اللي نبحث بيها (بتتخزّن لكل كلمة مرة واحدة)
  function finds(term){
    let r = cache.get(term);
    if (r === undefined) { r = [...new Set(groupsFor(term).flatMap(g => g.f))]; cache.set(term, r); }
    return r;
  }
  // اقتراحات أثناء الكتابة: أفكار (مجموعات) ثم أقسام ثم أسماء أدوات
  function suggest(term, sections){
    if (term.length < 2) return [];
    const out = [], seen = new Set();
    groupsFor(term).slice(0, 3).forEach(g => out.push({kind: "topic", text: g.label, value: g.q}));
    sections.forEach(s => { if (out.length < 5 && norm(s.title).includes(term) && (s.items || []).length) out.push({kind: "section", text: s.title, value: s.title}); });
    const items = [];
    sections.forEach(s => (s.items || []).forEach(it => { const t = norm(it.title); const i = t.indexOf(term); if (i >= 0 && !seen.has(t)) { seen.add(t); items.push({i, it}); } }));
    items.sort((a, b) => a.i - b.i);
    items.slice(0, 8 - out.length).forEach(x => out.push({kind: "item", text: x.it.title, value: x.it.title}));
    return out.slice(0, 8);
  }
  return {finds, suggest};
})();
