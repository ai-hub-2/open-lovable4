import fs from "fs";
import { glob } from "glob";

console.log("🔧 Fixing static export compatibility...\n");

// Find all API route files
const files = glob.sync("app/api/**/route.ts");

files.forEach((file) => {
  let content = fs.readFileSync(file, "utf8");
  let modified = false;

  // Remove any existing dynamic declarations
  content = content.replace(/export const dynamic\s*=\s*["'`][^"'`]+["'`];?\s*/g, "");
  
  // Add dynamic force-static at the top
  if (!content.includes('export const dynamic = "force-static";')) {
    content = `export const dynamic = "force-static";\n\n` + content;
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(file, content.trimStart(), "utf8");
    console.log(`✅ Fixed: ${file}`);
  } else {
    console.log(`ℹ️  Already correct: ${file}`);
  }
});

console.log("\n🎉 All API routes are now static export compatible!");
console.log("🚀 You can now build with 'npm run build'");