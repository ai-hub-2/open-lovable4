import fs from "fs";
import path from "path";

console.log("🧹 تنظيف شامل للـ cache قبل النشر على Cloudflare Pages...\n");

const cacheDirs = [
  ".next/cache",
  "cache/webpack",
  ".next/static/chunks",
  ".next/static/css",
  ".next/static/media",
  "node_modules/.cache",
  ".pnpm-store",
  "out",
  ".vercel",
  "dist"
];

const tempFiles = [
  ".next/build-manifest.json",
  ".next/prerender-manifest.json",
  ".next/routes-manifest.json"
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

function removeFile(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`✅ تم حذف: ${filePath}`);
      return true;
    } catch (error) {
      console.log(`⚠️  خطأ في حذف: ${filePath} - ${error.message}`);
      return false;
    }
  } else {
    console.log(`ℹ️  الملف غير موجود: ${filePath}`);
    return false;
  }
}

let totalRemoved = 0;

// حذف مجلدات الـ cache
console.log("🔍 حذف مجلدات الـ cache...");
cacheDirs.forEach(dir => {
  if (removeDir(dir)) totalRemoved++;
});

// حذف الملفات المؤقتة
console.log("\n🔍 حذف الملفات المؤقتة...");
tempFiles.forEach(file => {
  if (removeFile(file)) totalRemoved++;
});

console.log(`\n📊 ملخص النتائج:`);
console.log(`✅ إجمالي العناصر التي تم حذفها: ${totalRemoved}`);

if (totalRemoved > 0) {
  console.log("\n🎉 تم تنظيف الـ cache بنجاح!");
  console.log("🚀 يمكنك الآن تشغيل 'pnpm build' مع حجم أقل!");
  console.log("💡 هذا سيضمن عدم تجاوز أي ملف 25 MiB على Cloudflare Pages!");
} else {
  console.log("\n✅ لا توجد عناصر cache للتنظيف!");
}

console.log("\n📋 الخطوات التالية:");
console.log("1. pnpm install");
console.log("2. pnpm build");
console.log("3. نشر على Cloudflare Pages");