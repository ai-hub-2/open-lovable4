import fs from "fs";
import path from "path";

const targetExts = [".tsx", ".ts"];
const forbidden = [
  { char: ">", safe: "&gt;" },
  { char: "<", safe: "&lt;" },
  { char: "&", safe: "&amp;" },
  { char: "\"", safe: "&quot;" },
  { char: "'", safe: "&apos;" }
];

function checkFile(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  let hasIssues = false;
  
  lines.forEach((line, i) => {
    forbidden.forEach(f => {
      if (line.includes(f.char)) {
        console.log(
          `${filePath}:${i + 1} → لقيت "${f.char}" (بدلها بـ ${f.safe})`
        );
        hasIssues = true;
      }
    });
  });
  
  return hasIssues;
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let fixed = false;
  
  forbidden.forEach(f => {
    if (content.includes(f.char)) {
      content = content.replace(new RegExp(f.char, 'g'), f.safe);
      fixed = true;
    }
  });
  
  if (fixed) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✅ تم إصلاح: ${filePath}`);
  }
  
  return fixed;
}

function walkDir(dir) {
  let totalIssues = 0;
  let totalFixed = 0;
  
  fs.readdirSync(dir).forEach(f => {
    const fullPath = path.join(dir, f);
    
    // تجاهل مجلدات معينة
    if (f === "node_modules" || f === ".next" || f === ".git" || f === "out") {
      return;
    }
    
    if (fs.statSync(fullPath).isDirectory()) {
      const [issues, fixed] = walkDir(fullPath);
      totalIssues += issues;
      totalFixed += fixed;
    } else if (targetExts.some(ext => fullPath.endsWith(ext))) {
      const hasIssues = checkFile(fullPath);
      if (hasIssues) totalIssues++;
      
      // إصلاح تلقائي
      const wasFixed = fixFile(fullPath);
      if (wasFixed) totalFixed++;
    }
  });
  
  return [totalIssues, totalFixed];
}

console.log("🔍 فحص وإصلاح الرموز غير المحمية في ملفات TypeScript/TSX...\n");

const [totalIssues, totalFixed] = walkDir("./");

console.log(`\n📊 ملخص النتائج:`);
console.log(`🔴 إجمالي الملفات التي تحتوي مشاكل: ${totalIssues}`);
console.log(`✅ إجمالي الملفات التي تم إصلاحها: ${totalFixed}`);

if (totalFixed > 0) {
  console.log("\n🎉 تم إصلاح جميع المشاكل تلقائياً!");
  console.log("🚀 مشروعك جاهز للنشر على Cloudflare Pages!");
} else if (totalIssues === 0) {
  console.log("\n✅ لا توجد مشاكل! مشروعك نظيف تماماً!");
} else {
  console.log("\n⚠️  توجد مشاكل لم يتم إصلاحها تلقائياً.");
  console.log("🔧 راجع التقرير أعلاه للإصلاح اليدوي.");
}