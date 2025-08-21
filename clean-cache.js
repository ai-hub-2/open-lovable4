import fs from "fs";
import path from "path";

console.log("🧹 تنظيف الـ cache والملفات المؤقتة...\n");

const cacheDirs = [
  ".next/cache",
  "cache/webpack",
  ".next/static/chunks",
  ".next/static/css",
  ".next/static/media"
];

const tempDirs = [
  "node_modules/.cache",
  ".pnpm-store",
  "out"
];

function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`✅ تم حذف: ${dirPath}`);
      return true;
    } catch (error) {
      console.log(`⚠️  خطأ في حذف: ${dirPath} - ${error.message}`);
      return false;
    }
  } else {
    console.log(`ℹ️  المجلد غير موجود: ${dirPath}`);
    return false;
  }
}

let totalRemoved = 0;

// حذف مجلدات الـ cache
console.log("🔍 حذف مجلدات الـ cache...");
cacheDirs.forEach(dir => {
  if (removeDir(dir)) totalRemoved++;
});

// حذف المجلدات المؤقتة
console.log("\n🔍 حذف المجلدات المؤقتة...");
tempDirs.forEach(dir => {
  if (removeDir(dir)) totalRemoved++;
});

console.log(`\n📊 ملخص النتائج:`);
console.log(`✅ إجمالي المجلدات التي تم حذفها: ${totalRemoved}`);

if (totalRemoved > 0) {
  console.log("\n🎉 تم تنظيف الـ cache بنجاح!");
  console.log("🚀 يمكنك الآن تشغيل 'pnpm build' مع حجم أقل!");
} else {
  console.log("\n✅ لا توجد مجلدات cache للتنظيف!");
}

console.log("\n💡 نصيحة: شغل هذا السكربت قبل كل build للنشر!");