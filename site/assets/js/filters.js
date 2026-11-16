/* الفلاتر (سعر / تصنيف — خاصة بالقسم المفتوح، من app.js) والمفضلة (+ مجموعات محلية) — دوال بسيطة مستقلة عن شكل الصفحة */
const PRICE_FILTERS = [["all","الكل"],["مجاني","مجاني"],["مجاني محدود","مجاني محدود"],["مدفوع","مدفوع"]];
// السعر: «مجاني» بيشمل أي عنصر مش مدفوع ومش «مجاني محدود» (البرومبتات والفيديوهات والملفات ملهاش سعر فمتتخفيش)
const matchPrice = (it, p) => { if (p === "all") return true; const v = priceOf(it); return p === "مجاني" ? (v === "" || v === "مجاني") : v === p; };
// التصنيف (category): نوع الاستخدام زي صور / منتجات / لوجو / أعمال
const matchCat = (it, c) => c === "all" || categoryOf(it) === c;

// المفضلة: بتتحفظ في المتصفح (localStorage) بمعرّف العنصر الثابت، فتفضل موجودة لما الزائر يرجع
const Favs = (() => {
  const KEY = "as-fav", set = new Set();
  try { const a = JSON.parse(localStorage.getItem(KEY) || "[]"); if (Array.isArray(a)) a.forEach(x => { if (typeof x === "string" && x.length <= 80) set.add(x); }); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch (e) {} };
  return {
    has: id => set.has(id),
    toggle(id){ if (set.has(id)) { set.delete(id); if (typeof FavGroups !== "undefined") FavGroups.forget(id); } else set.add(id); save(); return set.has(id); },
    count: ids => ids.filter(i => set.has(i)).length
  };
})();

// مجموعات المفضلة: كلها محلية (localStorage مفتاح as-fav-groups) من غير حساب ولا سيرفر، ومبتلمسش قايمة المفضلة نفسها (as-fav)
const FavGroups = (() => {
  const KEY = "as-fav-groups", MAX = 12, NAME_MAX = 30;
  const PRESETS = ["أدوات التصميم", "أدوات الذكاء الاصطناعي", "أدوات المونتاج", "أدوات الإنتاجية"];
  let groups = [], map = Object.create(null);
  const cleanName = n => String(n ?? "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
  try {   // قراءة حذرة: أي حاجة مش بالشكل المتوقع بتتجاهل
    const o = JSON.parse(localStorage.getItem(KEY) || "null");
    if (o && Array.isArray(o.groups)) {
      o.groups.forEach(g => { if (g && typeof g.id === "string" && /^g-[a-z0-9]{3,12}$/.test(g.id) && cleanName(g.name) && groups.length < MAX && !groups.some(x => x.id === g.id)) groups.push({id: g.id, name: cleanName(g.name)}); });
      if (o.map && typeof o.map === "object") Object.keys(o.map).forEach(k => { const v = o.map[k]; if (k.length <= 80 && typeof v === "string" && groups.some(g => g.id === v)) map[k] = v; });
    }
  } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({v: 1, groups, map})); } catch (e) {} };
  const newId = () => { let id; do { id = "g-" + Math.random().toString(36).slice(2, 8); } while (groups.some(g => g.id === id) || id.length < 5); return id; };
  return {
    PRESETS, MAX,
    list: () => groups.slice(),
    get: id => groups.find(g => g.id === id) || null,
    groupOf: itemId => map[itemId] || "",
    add(name){
      name = cleanName(name);
      if (!name) return {ok: false, msg: "اكتب اسم المجموعة الأول"};
      if (groups.some(g => g.name === name)) return {ok: false, msg: "فيه مجموعة بنفس الاسم"};
      if (groups.length >= MAX) return {ok: false, msg: "وصلت للحد الأقصى (" + MAX + " مجموعة)"};
      const g = {id: newId(), name}; groups.push(g); save(); return {ok: true, group: g};
    },
    rename(id, name){
      name = cleanName(name); const g = groups.find(x => x.id === id);
      if (!g || !name) return {ok: false, msg: "اكتب اسم المجموعة الأول"};
      if (groups.some(x => x.id !== id && x.name === name)) return {ok: false, msg: "فيه مجموعة بنفس الاسم"};
      g.name = name; save(); return {ok: true};
    },
    remove(id){ groups = groups.filter(g => g.id !== id); Object.keys(map).forEach(k => { if (map[k] === id) delete map[k]; }); save(); },   // العناصر بترجع «بدون مجموعة» وبتفضل في المفضلة
    assign(itemId, gid){ if (!gid) delete map[itemId]; else if (groups.some(g => g.id === gid)) map[itemId] = gid; save(); },
    forget(itemId){ if (itemId in map) { delete map[itemId]; save(); } }
  };
})();
