/* فحص Syntax لكل ملفات JavaScript في المشروع (من غير تشغيلها). التشغيل: node tools/check-syntax.js */
const fs = require("fs"), path = require("path"), {spawnSync} = require("child_process");
const root = path.join(__dirname, "..");
const out = [];
(function walk(d){
  for (const f of fs.readdirSync(d, {withFileTypes: true})) {
    if (f.name === "node_modules" || f.name.startsWith(".git")) continue;
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p); else if (f.name.endsWith(".js")) out.push(p);
  }
})(root);
let bad = 0;
out.forEach(f => { const r = spawnSync(process.execPath, ["--check", f], {encoding: "utf8"}); if (r.status !== 0) { bad++; console.log("FAIL", path.relative(root, f), "\n" + r.stderr); } });
console.log(`${out.length} ملف JavaScript — ${bad ? bad + " فيهم خطأ Syntax" : "كلهم سليمين"}`);
process.exit(bad ? 1 : 0);
