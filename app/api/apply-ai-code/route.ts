export const dynamic = &quot;force-static&quot;;


import { NextRequest, NextResponse } from &apos;next/server&apos;;
import type { SandboxState } from &apos;@/types/sandbox&apos;;
import type { ConversationState } from &apos;@/types/conversation&apos;;

declare global {
  var conversationState: ConversationState | null;
}

interface ParsedResponse {
  explanation: string;
  template: string;
  files: Array&amp;lt;{ path: string; content: string }&amp;gt;;
  packages: string[];
  commands: string[];
  structure: string | null;
}

function parseAIResponse(response: string): ParsedResponse {
  const sections = {
    files: [] as Array&amp;lt;{ path: string; content: string }&amp;gt;,
    commands: [] as string[],
    packages: [] as string[],
    structure: null as string | null,
    explanation: &apos;&apos;,
    template: &apos;&apos;
  };

  // Parse file sections - handle duplicates and prefer complete versions
  const fileMap = new Map&amp;lt;string, { content: string; isComplete: boolean }&amp;gt;();
  
  const fileRegex = /&amp;lt;file path=&quot;([^&quot;]+)&quot;&amp;gt;([\s\S]*?)(?:&amp;lt;\/file&amp;gt;|$)/g;
  let match;
  while ((match = fileRegex.exec(response)) !== null) {
    const filePath = match[1];
    const content = match[2].trim();
    const hasClosingTag = response.substring(match.index, match.index + match[0].length).includes(&apos;&amp;lt;/file&amp;gt;&apos;);
    
    // Check if this file already exists in our map
    const existing = fileMap.get(filePath);
    
    // Decide whether to keep this version
    let shouldReplace = false;
    if (!existing) {
      shouldReplace = true; // First occurrence
    } else if (!existing.isComplete &amp;&amp; hasClosingTag) {
      shouldReplace = true; // Replace incomplete with complete
      console.log(`[parseAIResponse] Replacing incomplete ${filePath} with complete version`);
    } else if (existing.isComplete &amp;&amp; hasClosingTag &amp;&amp; content.length &amp;gt; existing.content.length) {
      shouldReplace = true; // Replace with longer complete version
      console.log(`[parseAIResponse] Replacing ${filePath} with longer complete version`);
    } else if (!existing.isComplete &amp;&amp; !hasClosingTag &amp;&amp; content.length &amp;gt; existing.content.length) {
      shouldReplace = true; // Both incomplete, keep longer one
    }
    
    if (shouldReplace) {
      // Additional validation: reject obviously broken content
      if (content.includes(&apos;...&apos;) &amp;&amp; !content.includes(&apos;...props&apos;) &amp;&amp; !content.includes(&apos;...rest&apos;)) {
        console.warn(`[parseAIResponse] Warning: ${filePath} contains ellipsis, may be truncated`);
        // Still use it if it&apos;s the only version we have
        if (!existing) {
          fileMap.set(filePath, { content, isComplete: hasClosingTag });
        }
      } else {
        fileMap.set(filePath, { content, isComplete: hasClosingTag });
      }
    }
  }
  
  // Convert map to array for sections.files
  for (const [path, { content, isComplete }] of fileMap.entries()) {
    if (!isComplete) {
      console.log(`[parseAIResponse] Warning: File ${path} appears to be truncated (no closing tag)`);
    }
    
    sections.files.push({
      path,
      content
    });
  }

  // Parse commands
  const cmdRegex = /&amp;lt;command&amp;gt;(.*?)&amp;lt;\/command&amp;gt;/g;
  while ((match = cmdRegex.exec(response)) !== null) {
    sections.commands.push(match[1].trim());
  }

  // Parse packages - support both &amp;lt;package&amp;gt; and &amp;lt;packages&amp;gt; tags
  const pkgRegex = /&amp;lt;package&amp;gt;(.*?)&amp;lt;\/package&amp;gt;/g;
  while ((match = pkgRegex.exec(response)) !== null) {
    sections.packages.push(match[1].trim());
  }
  
  // Also parse &amp;lt;packages&amp;gt; tag with multiple packages
  const packagesRegex = /&amp;lt;packages&amp;gt;([\s\S]*?)&amp;lt;\/packages&amp;gt;/;
  const packagesMatch = response.match(packagesRegex);
  if (packagesMatch) {
    const packagesContent = packagesMatch[1].trim();
    // Split by newlines or commas
    const packagesList = packagesContent.split(/[\n,]+/)
      .map(pkg =&amp;gt; pkg.trim())
      .filter(pkg =&amp;gt; pkg.length &amp;gt; 0);
    sections.packages.push(...packagesList);
  }

  // Parse structure
  const structureMatch = /&amp;lt;structure&amp;gt;([\s\S]*?)&amp;lt;\/structure&amp;gt;/;
  const structResult = response.match(structureMatch);
  if (structResult) {
    sections.structure = structResult[1].trim();
  }

  // Parse explanation
  const explanationMatch = /&amp;lt;explanation&amp;gt;([\s\S]*?)&amp;lt;\/explanation&amp;gt;/;
  const explResult = response.match(explanationMatch);
  if (explResult) {
    sections.explanation = explResult[1].trim();
  }

  // Parse template
  const templateMatch = /&amp;lt;template&amp;gt;(.*?)&amp;lt;\/template&amp;gt;/;
  const templResult = response.match(templateMatch);
  if (templResult) {
    sections.template = templResult[1].trim();
  }

  return sections;
}

declare global {
  var activeSandbox: any;
  var existingFiles: Set&amp;lt;string&amp;gt;;
  var sandboxState: SandboxState;
}

export async function POST(request: NextRequest) {
  try {
    const { response, isEdit = false, packages = [] } = await request.json();
    
    if (!response) {
      return NextResponse.json({
        error: &apos;response is required&apos;
      }, { status: 400 });
    }
    
    // Parse the AI response
    const parsed = parseAIResponse(response);
    
    // Initialize existingFiles if not already
    if (!global.existingFiles) {
      global.existingFiles = new Set&amp;lt;string&amp;gt;();
    }
    
    // If no active sandbox, just return parsed results
    if (!global.activeSandbox) {
      return NextResponse.json({
        success: true,
        results: {
          filesCreated: parsed.files.map(f =&amp;gt; f.path),
          packagesInstalled: parsed.packages,
          commandsExecuted: parsed.commands,
          errors: []
        },
        explanation: parsed.explanation,
        structure: parsed.structure,
        parsedFiles: parsed.files,
        message: `Parsed ${parsed.files.length} files successfully. Create a sandbox to apply them.`
      });
    }
    
    // Apply to active sandbox
    console.log(&apos;[apply-ai-code] Applying code to sandbox...&apos;);
    console.log(&apos;[apply-ai-code] Is edit mode:&apos;, isEdit);
    console.log(&apos;[apply-ai-code] Files to write:&apos;, parsed.files.map(f =&amp;gt; f.path));
    console.log(&apos;[apply-ai-code] Existing files:&apos;, Array.from(global.existingFiles));
    
    const results = {
      filesCreated: [] as string[],
      filesUpdated: [] as string[],
      packagesInstalled: [] as string[],
      packagesAlreadyInstalled: [] as string[],
      packagesFailed: [] as string[],
      commandsExecuted: [] as string[],
      errors: [] as string[]
    };
    
    // Combine packages from tool calls and parsed XML tags
    const allPackages = [...packages.filter((pkg: any) =&amp;gt; pkg &amp;&amp; typeof pkg === &apos;string&apos;), ...parsed.packages];
    const uniquePackages = [...new Set(allPackages)]; // Remove duplicates
    
    if (uniquePackages.length &amp;gt; 0) {
      console.log(&apos;[apply-ai-code] Installing packages from XML tags and tool calls:&apos;, uniquePackages);
      
      try {
        const installResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || &apos;http://localhost:3000&apos;}/api/install-packages`, {
          method: &apos;POST&apos;,
          headers: { &apos;Content-Type&apos;: &apos;application/json&apos; },
          body: JSON.stringify({ packages: uniquePackages })
        });
        
        if (installResponse.ok) {
          const installResult = await installResponse.json();
          console.log(&apos;[apply-ai-code] Package installation result:&apos;, installResult);
          
          if (installResult.installed &amp;&amp; installResult.installed.length &amp;gt; 0) {
            results.packagesInstalled = installResult.installed;
          }
          if (installResult.failed &amp;&amp; installResult.failed.length &amp;gt; 0) {
            results.packagesFailed = installResult.failed;
          }
        }
      } catch (error) {
        console.error(&apos;[apply-ai-code] Error installing packages:&apos;, error);
      }
    } else {
      // Fallback to detecting packages from code
      console.log(&apos;[apply-ai-code] No packages provided, detecting from generated code...&apos;);
      console.log(&apos;[apply-ai-code] Number of files to scan:&apos;, parsed.files.length);
      
      // Filter out config files first
      const configFiles = [&apos;tailwind.config.js&apos;, &apos;vite.config.js&apos;, &apos;package.json&apos;, &apos;package-lock.json&apos;, &apos;tsconfig.json&apos;, &apos;postcss.config.js&apos;];
      const filteredFilesForDetection = parsed.files.filter(file =&amp;gt; {
        const fileName = file.path.split(&apos;/&apos;).pop() || &apos;&apos;;
        return !configFiles.includes(fileName);
      });
      
      // Build files object for package detection
      const filesForPackageDetection: Record&amp;lt;string, string&amp;gt; = {};
      for (const file of filteredFilesForDetection) {
        filesForPackageDetection[file.path] = file.content;
        // Log if heroicons is found
        if (file.content.includes(&apos;heroicons&apos;)) {
          console.log(`[apply-ai-code] Found heroicons import in ${file.path}`);
        }
      }
      
      try {
        console.log(&apos;[apply-ai-code] Calling detect-and-install-packages...&apos;);
        const packageResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || &apos;http://localhost:3000&apos;}/api/detect-and-install-packages`, {
          method: &apos;POST&apos;,
          headers: { &apos;Content-Type&apos;: &apos;application/json&apos; },
          body: JSON.stringify({ files: filesForPackageDetection })
        });
        
        console.log(&apos;[apply-ai-code] Package detection response status:&apos;, packageResponse.status);
        
        if (packageResponse.ok) {
          const packageResult = await packageResponse.json();
          console.log(&apos;[apply-ai-code] Package installation result:&apos;, JSON.stringify(packageResult, null, 2));
        
        if (packageResult.packagesInstalled &amp;&amp; packageResult.packagesInstalled.length &amp;gt; 0) {
          results.packagesInstalled = packageResult.packagesInstalled;
          console.log(`[apply-ai-code] Installed packages: ${packageResult.packagesInstalled.join(&apos;, &apos;)}`);
        }
        
        if (packageResult.packagesAlreadyInstalled &amp;&amp; packageResult.packagesAlreadyInstalled.length &amp;gt; 0) {
          results.packagesAlreadyInstalled = packageResult.packagesAlreadyInstalled;
          console.log(`[apply-ai-code] Already installed: ${packageResult.packagesAlreadyInstalled.join(&apos;, &apos;)}`);
        }
        
        if (packageResult.packagesFailed &amp;&amp; packageResult.packagesFailed.length &amp;gt; 0) {
          results.packagesFailed = packageResult.packagesFailed;
          console.error(`[apply-ai-code] Failed to install packages: ${packageResult.packagesFailed.join(&apos;, &apos;)}`);
          results.errors.push(`Failed to install packages: ${packageResult.packagesFailed.join(&apos;, &apos;)}`);
        }
        
        // Force Vite restart after package installation
        if (results.packagesInstalled.length &amp;gt; 0) {
          console.log(&apos;[apply-ai-code] Packages were installed, forcing Vite restart...&apos;);
          
          try {
            // Call the restart-vite endpoint
            const restartResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || &apos;http://localhost:3000&apos;}/api/restart-vite`, {
              method: &apos;POST&apos;,
              headers: { &apos;Content-Type&apos;: &apos;application/json&apos; }
            });
            
            if (restartResponse.ok) {
              const restartResult = await restartResponse.json();
              console.log(&apos;[apply-ai-code] Vite restart result:&apos;, restartResult.message);
            } else {
              console.error(&apos;[apply-ai-code] Failed to restart Vite:&apos;, await restartResponse.text());
            }
          } catch (e) {
            console.error(&apos;[apply-ai-code] Error calling restart-vite:&apos;, e);
          }
          
          // Additional delay to ensure files can be written after restart
          await new Promise(resolve =&amp;gt; setTimeout(resolve, 1000));
        }
        } else {
          console.error(&apos;[apply-ai-code] Package detection/installation failed:&apos;, await packageResponse.text());
        }
      } catch (error) {
        console.error(&apos;[apply-ai-code] Error detecting/installing packages:&apos;, error);
        // Continue with file writing even if package installation fails
      }
    }
    
    // Filter out config files that shouldn&apos;t be created
    const configFiles = [&apos;tailwind.config.js&apos;, &apos;vite.config.js&apos;, &apos;package.json&apos;, &apos;package-lock.json&apos;, &apos;tsconfig.json&apos;, &apos;postcss.config.js&apos;];
    const filteredFiles = parsed.files.filter(file =&amp;gt; {
      const fileName = file.path.split(&apos;/&apos;).pop() || &apos;&apos;;
      if (configFiles.includes(fileName)) {
        console.warn(`[apply-ai-code] Skipping config file: ${file.path} - already exists in template`);
        return false;
      }
      return true;
    });
    
    // Create or update files AFTER package installation
    for (const file of filteredFiles) {
      try {
        // Normalize the file path
        let normalizedPath = file.path;
        // Remove leading slash if present
        if (normalizedPath.startsWith(&apos;/&apos;)) {
          normalizedPath = normalizedPath.substring(1);
        }
        // Ensure src/ prefix for component files
        if (!normalizedPath.startsWith(&apos;src/&apos;) &amp;&amp; 
            !normalizedPath.startsWith(&apos;public/&apos;) &amp;&amp; 
            normalizedPath !== &apos;index.html&apos; &amp;&amp; 
            normalizedPath !== &apos;package.json&apos; &amp;&amp;
            normalizedPath !== &apos;vite.config.js&apos; &amp;&amp;
            normalizedPath !== &apos;tailwind.config.js&apos; &amp;&amp;
            normalizedPath !== &apos;postcss.config.js&apos;) {
          normalizedPath = &apos;src/&apos; + normalizedPath;
        }
        
        const fullPath = `/home/user/app/${normalizedPath}`;
        const isUpdate = global.existingFiles.has(normalizedPath);
        
        // Remove any CSS imports from JSX/JS files (we&apos;re using Tailwind)
        let fileContent = file.content;
        if (file.path.endsWith(&apos;.jsx&apos;) || file.path.endsWith(&apos;.js&apos;) || file.path.endsWith(&apos;.tsx&apos;) || file.path.endsWith(&apos;.ts&apos;)) {
          fileContent = fileContent.replace(/import\s+[&apos;&quot;]\.\/[^&apos;&quot;]+\.css[&apos;&quot;];?\s*\n?/g, &apos;&apos;);
        }
        
        console.log(`[apply-ai-code] Writing file using E2B files API: ${fullPath}`);
        
        try {
          // Use the correct E2B API - sandbox.files.write()
          await global.activeSandbox.files.write(fullPath, fileContent);
          console.log(`[apply-ai-code] Successfully wrote file: ${fullPath}`);
          
          // Update file cache
          if (global.sandboxState?.fileCache) {
            global.sandboxState.fileCache.files[normalizedPath] = {
              content: fileContent,
              lastModified: Date.now()
            };
            console.log(`[apply-ai-code] Updated file cache for: ${normalizedPath}`);
          }
          
        } catch (writeError) {
          console.error(`[apply-ai-code] E2B file write error:`, writeError);
          throw writeError;
        }
        
        
        if (isUpdate) {
          results.filesUpdated.push(normalizedPath);
        } else {
          results.filesCreated.push(normalizedPath);
          global.existingFiles.add(normalizedPath);
        }
      } catch (error) {
        results.errors.push(`Failed to create ${file.path}: ${(error as Error).message}`);
      }
    }
    
    // Only create App.jsx if it&apos;s not an edit and doesn&apos;t exist
    const appFileInParsed = parsed.files.some(f =&amp;gt; {
      const normalized = f.path.replace(/^\//, &apos;&apos;).replace(/^src\//, &apos;&apos;);
      return normalized === &apos;App.jsx&apos; || normalized === &apos;App.tsx&apos;;
    });
    
    const appFileExists = global.existingFiles.has(&apos;src/App.jsx&apos;) || 
                         global.existingFiles.has(&apos;src/App.tsx&apos;) ||
                         global.existingFiles.has(&apos;App.jsx&apos;) ||
                         global.existingFiles.has(&apos;App.tsx&apos;);
    
    if (!isEdit &amp;&amp; !appFileInParsed &amp;&amp; !appFileExists &amp;&amp; parsed.files.length &amp;gt; 0) {
      // Find all component files
      const componentFiles = parsed.files.filter(f =&amp;gt; 
        (f.path.endsWith(&apos;.jsx&apos;) || f.path.endsWith(&apos;.tsx&apos;)) &amp;&amp;
        f.path.includes(&apos;component&apos;)
      );
      
      // Generate imports for components
      const imports = componentFiles
        .filter(f =&amp;gt; !f.path.includes(&apos;App.&apos;) &amp;&amp; !f.path.includes(&apos;main.&apos;) &amp;&amp; !f.path.includes(&apos;index.&apos;))
        .map(f =&amp;gt; {
          const pathParts = f.path.split(&apos;/&apos;);
          const fileName = pathParts[pathParts.length - 1];
          const componentName = fileName.replace(/\.(jsx|tsx)$/, &apos;&apos;);
          // Fix import path - components are in src/components/
          const importPath = f.path.startsWith(&apos;src/&apos;) 
            ? f.path.replace(&apos;src/&apos;, &apos;./&apos;).replace(/\.(jsx|tsx)$/, &apos;&apos;)
            : &apos;./&apos; + f.path.replace(/\.(jsx|tsx)$/, &apos;&apos;);
          return `import ${componentName} from &apos;${importPath}&apos;;`;
        })
        .join(&apos;\n&apos;);
      
      // Find the main component
      const mainComponent = componentFiles.find(f =&amp;gt; {
        const name = f.path.toLowerCase();
        return name.includes(&apos;header&apos;) || 
               name.includes(&apos;hero&apos;) ||
               name.includes(&apos;layout&apos;) ||
               name.includes(&apos;main&apos;) ||
               name.includes(&apos;home&apos;);
      }) || componentFiles[0];
      
      const mainComponentName = mainComponent 
        ? mainComponent.path.split(&apos;/&apos;).pop()?.replace(/\.(jsx|tsx)$/, &apos;&apos;) 
        : null;
      
      // Create App.jsx with better structure
      const appContent = `import React from &apos;react&apos;;
${imports}

function App() {
  return (
    &amp;lt;div className=&quot;min-h-screen bg-gray-900 text-white p-8&quot;&amp;gt;
      ${mainComponentName ? `&amp;lt;${mainComponentName} /&amp;gt;` : &apos;&amp;lt;div className=&quot;text-center&quot;&amp;gt;\n        &amp;lt;h1 className=&quot;text-4xl font-bold mb-4&quot;&amp;gt;Welcome to your React App&amp;lt;/h1&amp;gt;\n        &amp;lt;p className=&quot;text-gray-400&quot;&amp;gt;Your components have been created but need to be added here.&amp;lt;/p&amp;gt;\n      &amp;lt;/div&amp;gt;&apos;}
      {/* Generated components: ${componentFiles.map(f =&amp;gt; f.path).join(&apos;, &apos;)} */}
    &amp;lt;/div&amp;gt;
  );
}

export default App;`;
      
      try {
        await global.activeSandbox.runCode(`
file_path = &quot;/home/user/app/src/App.jsx&quot;
file_content = &quot;&quot;&quot;${appContent.replace(/&quot;/g, &apos;\\&quot;&apos;).replace(/\n/g, &apos;\\n&apos;)}&quot;&quot;&quot;

with open(file_path, &apos;w&apos;) as f:
    f.write(file_content)

print(f&quot;Auto-generated: {file_path}&quot;)
        `);
        results.filesCreated.push(&apos;src/App.jsx (auto-generated)&apos;);
      } catch (error) {
        results.errors.push(`Failed to create App.jsx: ${(error as Error).message}`);
      }
      
      // Don&apos;t auto-generate App.css - we&apos;re using Tailwind CSS
      
      // Only create index.css if it doesn&apos;t exist
      const indexCssInParsed = parsed.files.some(f =&amp;gt; {
        const normalized = f.path.replace(/^\//, &apos;&apos;).replace(/^src\//, &apos;&apos;);
        return normalized === &apos;index.css&apos; || f.path === &apos;src/index.css&apos;;
      });
      
      const indexCssExists = global.existingFiles.has(&apos;src/index.css&apos;) || 
                            global.existingFiles.has(&apos;index.css&apos;);
      
      if (!isEdit &amp;&amp; !indexCssInParsed &amp;&amp; !indexCssExists) {
        try {
          await global.activeSandbox.runCode(`
file_path = &quot;/home/user/app/src/index.css&quot;
file_content = &quot;&quot;&quot;@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: dark;
  
  color: rgba(255, 255, 255, 0.87);
  background-color: #0a0a0a;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}&quot;&quot;&quot;

with open(file_path, &apos;w&apos;) as f:
    f.write(file_content)

print(f&quot;Auto-generated: {file_path}&quot;)
          `);
          results.filesCreated.push(&apos;src/index.css (with Tailwind)&apos;);
        } catch (error) {
          results.errors.push(&apos;Failed to create index.css with Tailwind&apos;);
        }
      }
    }
    
    // Execute commands
    for (const cmd of parsed.commands) {
      try {
        await global.activeSandbox.runCode(`
import subprocess
os.chdir(&apos;/home/user/app&apos;)
result = subprocess.run(${JSON.stringify(cmd.split(&apos; &apos;))}, capture_output=True, text=True)
print(f&quot;Executed: ${cmd}&quot;)
print(result.stdout)
if result.stderr:
    print(f&quot;Errors: {result.stderr}&quot;)
        `);
        results.commandsExecuted.push(cmd);
      } catch (error) {
        results.errors.push(`Failed to execute ${cmd}: ${(error as Error).message}`);
      }
    }
    
    // Check for missing imports in App.jsx
    const missingImports: string[] = [];
    const appFile = parsed.files.find(f =&amp;gt; 
      f.path === &apos;src/App.jsx&apos; || f.path === &apos;App.jsx&apos;
    );
    
    if (appFile) {
      // Extract imports from App.jsx
      const importRegex = /import\s+(?:\w+|\{[^}]+\})\s+from\s+[&apos;&quot;]([^&apos;&quot;]+)[&apos;&quot;]/g;
      let match;
      const imports: string[] = [];
      
      while ((match = importRegex.exec(appFile.content)) !== null) {
        const importPath = match[1];
        if (importPath.startsWith(&apos;./&apos;) || importPath.startsWith(&apos;../&apos;)) {
          imports.push(importPath);
        }
      }
      
      // Check if all imported files exist
      for (const imp of imports) {
        // Skip CSS imports for this check
        if (imp.endsWith(&apos;.css&apos;)) continue;
        
        // Convert import path to expected file paths
        const basePath = imp.replace(&apos;./&apos;, &apos;src/&apos;);
        const possiblePaths = [
          basePath + &apos;.jsx&apos;,
          basePath + &apos;.js&apos;,
          basePath + &apos;/index.jsx&apos;,
          basePath + &apos;/index.js&apos;
        ];
        
        const fileExists = parsed.files.some(f =&amp;gt; 
          possiblePaths.some(path =&amp;gt; f.path === path)
        );
        
        if (!fileExists) {
          missingImports.push(imp);
        }
      }
    }
    
    // Prepare response
    const responseData: any = {
      success: true,
      results,
      explanation: parsed.explanation,
      structure: parsed.structure,
      message: `Applied ${results.filesCreated.length} files successfully`
    };
    
    // Handle missing imports automatically
    if (missingImports.length &amp;gt; 0) {
      console.warn(&apos;[apply-ai-code] Missing imports detected:&apos;, missingImports);
      
      // Automatically generate missing components
      try {
        console.log(&apos;[apply-ai-code] Auto-generating missing components...&apos;);
        
        const autoCompleteResponse = await fetch(
          `${request.nextUrl.origin}/api/auto-complete-components`,
          {
            method: &apos;POST&apos;,
            headers: { &apos;Content-Type&apos;: &apos;application/json&apos; },
            body: JSON.stringify({
              missingImports,
              model: &apos;claude-sonnet-4-20250514&apos;
            })
          }
        );
        
        const autoCompleteData = await autoCompleteResponse.json();
        
        if (autoCompleteData.success) {
          responseData.autoCompleted = true;
          responseData.autoCompletedComponents = autoCompleteData.components;
          responseData.message = `Applied ${results.filesCreated.length} files + auto-generated ${autoCompleteData.files} missing components`;
          
          // Add auto-completed files to results
          results.filesCreated.push(...autoCompleteData.components);
        } else {
          // If auto-complete fails, still warn the user
          responseData.warning = `Missing ${missingImports.length} imported components: ${missingImports.join(&apos;, &apos;)}`;
          responseData.missingImports = missingImports;
        }
      } catch (error) {
        console.error(&apos;[apply-ai-code] Auto-complete failed:&apos;, error);
        responseData.warning = `Missing ${missingImports.length} imported components: ${missingImports.join(&apos;, &apos;)}`;
        responseData.missingImports = missingImports;
      }
    }
    
    // Track applied files in conversation state
    if (global.conversationState &amp;&amp; results.filesCreated.length &amp;gt; 0) {
      // Update the last message metadata with edited files
      const messages = global.conversationState.context.messages;
      if (messages.length &amp;gt; 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role === &apos;user&apos;) {
          lastMessage.metadata = {
            ...lastMessage.metadata,
            editedFiles: results.filesCreated
          };
        }
      }
      
      // Track applied code in project evolution
      if (global.conversationState.context.projectEvolution) {
        global.conversationState.context.projectEvolution.majorChanges.push({
          timestamp: Date.now(),
          description: parsed.explanation || &apos;Code applied&apos;,
          filesAffected: results.filesCreated
        });
      }
      
      // Update last updated timestamp
      global.conversationState.lastUpdated = Date.now();
      
      console.log(&apos;[apply-ai-code] Updated conversation state with applied files:&apos;, results.filesCreated);
    }
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error(&apos;Apply AI code error:&apos;, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : &apos;Failed to parse AI code&apos; },
      { status: 500 }
    );
  }
}