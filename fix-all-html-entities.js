import fs from "fs";
import path from "path";

console.log("🔧 إصلاح جميع HTML entities في جميع الملفات...\n");

// الرموز التي يجب إصلاحها
const htmlEntities = [
  { entity: """, char: '"' },
  { entity: "'", char: "'" },
  { entity: "<", char: "<" },
  { entity: ">", char: ">" },
  { entity: "&", char: "&" }
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let fixed = false;

  htmlEntities.forEach(({ entity, char }) => {
    if (content.includes(entity)) {
      content = content.replace(new RegExp(entity, 'g'), char);
      fixed = true;
    }
  });

  if (fixed) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✅ تم إصلاح: ${filePath}`);
    return true;
  }
  
  return false;
}

function walkDir(dir) {
  let totalFixed = 0;
  
  // تجاهل مجلدات معينة
  const ignoreDirs = ['node_modules', '.next', '.git', 'out'];
  
  fs.readdirSync(dir).forEach(f => {
    const fullPath = path.join(dir, f);
    
    if (ignoreDirs.includes(f)) {
      return;
    }
    
    if (fs.statSync(fullPath).isDirectory()) {
      totalFixed += walkDir(fullPath);
    } else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.mjs')) {
      if (fixFile(fullPath)) {
        totalFixed++;
      }
    }
  });
  
  return totalFixed;
}

console.log("🔍 البحث في جميع الملفات...");
const totalFixed = walkDir("./");

console.log(`\n📊 ملخص النتائج:`);
console.log(`✅ إجمالي الملفات التي تم إصلاحها: ${totalFixed}`);

if (totalFixed > 0) {
  console.log("\n🎉 تم إصلاح جميع HTML entities!");
  console.log("🚀 يمكنك الآن تشغيل 'pnpm build' بدون أخطاء!");
} else {
  console.log("\n✅ جميع الملفات نظيفة!");
}