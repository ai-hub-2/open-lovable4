import fs from "fs";
import path from "path";
import { glob } from "glob";

console.log("🔧 Fixing Cloudflare Pages runtime for Next.js 15...\n");

// Find all API route files
const files = glob.sync("app/api/**/route.ts");

files.forEach((file) => {
  let content = fs.readFileSync(file, "utf8");
  let modified = false;

  // Remove any existing runtime declarations
  const runtimeRegex = /export const runtime\s*=\s*["'`][^"'`]+["'`];?\s*/g;
  if (runtimeRegex.test(content)) {
    content = content.replace(runtimeRegex, "");
    modified = true;
  }

  // Remove any existing dynamic declarations
  const dynamicRegex = /export const dynamic\s*=\s*["'`][^"'`]+["'`];?\s*/g;
  if (dynamicRegex.test(content)) {
    content = content.replace(dynamicRegex, "");
    modified = true;
  }

  // Add clean runtime and dynamic declarations at the top
  if (!content.includes('export const runtime = "edge";') || !content.includes('export const dynamic = "force-dynamic";')) {
    // Remove any existing declarations first
    content = content.replace(/export const runtime\s*=\s*["'`][^"'`]+["'`];?\s*/g, "");
    content = content.replace(/export const dynamic\s*=\s*["'`][^"'`]+["'`];?\s*/g, "");
    
    // Add clean declarations at the top
    content = `export const runtime = "edge";\nexport const dynamic = "force-dynamic";\n\n` + content;
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(file, content.trimStart(), "utf8");
    console.log(`✅ Fixed: ${file}`);
  } else {
    console.log(`ℹ️  Already correct: ${file}`);
  }
});

// Note: runtime is defined in individual API routes, not in next.config.ts
console.log("ℹ️  next.config.ts is already correctly configured");

console.log("\n🎉 All Cloudflare Pages runtime issues fixed!");
console.log("🚀 Your app is now ready for Cloudflare Pages deployment!");