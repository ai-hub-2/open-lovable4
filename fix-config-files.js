import fs from "fs";
import path from "path";

console.log("🔧 إصلاح ملفات Configuration من HTML entities...\n");

// ملفات Configuration التي يجب إصلاحها
const configFiles = [
  "next.config.ts",
  "tailwind.config.ts",
  "postcss.config.mjs",
  "tsconfig.json",
  "package.json",
  "wrangler.toml"
];

// الرموز التي يجب إصلاحها في ملفات Configuration
const htmlEntities = [
  { entity: """, char: '"' },
  { entity: "'", char: "'" },
  { entity: "<", char: "<" },
  { entity: ">", char: ">" },
  { entity: "&", char: "&" }
];

function fixConfigFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  الملف غير موجود: ${filePath}`);
    return false;
  }

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
  } else {
    console.log(`ℹ️  لا يحتاج إصلاح: ${filePath}`);
    return false;
  }
}

let totalFixed = 0;

configFiles.forEach(file => {
  if (fixConfigFile(file)) {
    totalFixed++;
  }
});

console.log(`\n📊 ملخص النتائج:`);
console.log(`✅ إجمالي ملفات Configuration التي تم إصلاحها: ${totalFixed}`);

if (totalFixed > 0) {
  console.log("\n🎉 تم إصلاح جميع ملفات Configuration!");
  console.log("🚀 يمكنك الآن تشغيل 'pnpm build' بدون أخطاء!");
} else {
  console.log("\n✅ جميع ملفات Configuration نظيفة!");
}