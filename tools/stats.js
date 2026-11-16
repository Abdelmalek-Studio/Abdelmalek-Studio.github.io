/* بيطبع الأعداد الفعلية من data.js (للتأكد إن README مطابق). التشغيل: node tools/stats.js */
const fs = require("fs"), path = require("path");
const t = fs.readFileSync(path.join(__dirname, "..", "site/data/data.js"), "utf8").replace(/^\/\*[\s\S]*?\*\/\s*/, "").replace(/^window\.STUDIO_DATA\s*=\s*/, "").replace(/;\s*$/, "");
const D = JSON.parse(t), items = D.sections.flatMap(s => s.items), by = k => items.filter(i => i.type === k).length;
console.log(`الأقسام: ${D.sections.length} (الظاهر: ${D.sections.filter(s => s.items.length).length}) | الروابط: ${by("link")} | البرومبتات: ${by("prompt")} | الفيديوهات: ${by("video")} | الملفات: ${by("file")} | الإجمالي: ${items.length}`);
