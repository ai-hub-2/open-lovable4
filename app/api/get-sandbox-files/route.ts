export const dynamic = &quot;force-static&quot;;


import { NextResponse } from &apos;next/server&apos;;
import { parseJavaScriptFile, buildComponentTree } from &apos;@/lib/file-parser&apos;;
import { FileManifest, FileInfo, RouteInfo } from &apos;@/types/file-manifest&apos;;
import type { SandboxState } from &apos;@/types/sandbox&apos;;

declare global {
  var activeSandbox: any;
}

export async function GET() {
  try {
    if (!global.activeSandbox) {
      return NextResponse.json({
        success: false,
        error: &apos;No active sandbox&apos;
      }, { status: 404 });
    }

    console.log(&apos;[get-sandbox-files] Fetching and analyzing file structure...&apos;);
    
    // Get all React/JS/CSS files
    const result = await global.activeSandbox.runCode(`
import os
import json

def get_files_content(directory=&apos;/home/user/app&apos;, extensions=[&apos;.jsx&apos;, &apos;.js&apos;, &apos;.tsx&apos;, &apos;.ts&apos;, &apos;.css&apos;, &apos;.json&apos;]):
    files_content = {}
    
    for root, dirs, files in os.walk(directory):
        # Skip node_modules and other unwanted directories
        dirs[:] = [d for d in dirs if d not in [&apos;node_modules&apos;, &apos;.git&apos;, &apos;dist&apos;, &apos;build&apos;]]
        
        for file in files:
            if any(file.endswith(ext) for ext in extensions):
                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, &apos;/home/user/app&apos;)
                
                try:
                    with open(file_path, &apos;r&apos;) as f:
                        content = f.read()
                        # Only include files under 10KB to avoid huge responses
                        if len(content) &amp;lt; 10000:
                            files_content[relative_path] = content
                except:
                    pass
    
    return files_content

# Get the files
files = get_files_content()

# Also get the directory structure
structure = []
for root, dirs, files in os.walk(&apos;/home/user/app&apos;):
    level = root.replace(&apos;/home/user/app&apos;, &apos;&apos;).count(os.sep)
    indent = &apos; &apos; * 2 * level
    structure.append(f&quot;{indent}{os.path.basename(root)}/&quot;)
    sub_indent = &apos; &apos; * 2 * (level + 1)
    for file in files:
        if not any(skip in root for skip in [&apos;node_modules&apos;, &apos;.git&apos;, &apos;dist&apos;, &apos;build&apos;]):
            structure.append(f&quot;{sub_indent}{file}&quot;)

result = {
    &apos;files&apos;: files,
    &apos;structure&apos;: &apos;\\n&apos;.join(structure[:50])  # Limit structure to 50 lines
}

print(json.dumps(result))
    `);

    const output = result.logs.stdout.join(&apos;&apos;);
    const parsedResult = JSON.parse(output);
    
    // Build enhanced file manifest
    const fileManifest: FileManifest = {
      files: {},
      routes: [],
      componentTree: {},
      entryPoint: &apos;&apos;,
      styleFiles: [],
      timestamp: Date.now(),
    };
    
    // Process each file
    for (const [relativePath, content] of Object.entries(parsedResult.files)) {
      const fullPath = `/home/user/app/${relativePath}`;
      
      // Create base file info
      const fileInfo: FileInfo = {
        content: content as string,
        type: &apos;utility&apos;,
        path: fullPath,
        relativePath,
        lastModified: Date.now(),
      };
      
      // Parse JavaScript/JSX files
      if (relativePath.match(/\.(jsx?|tsx?)$/)) {
        const parseResult = parseJavaScriptFile(content as string, fullPath);
        Object.assign(fileInfo, parseResult);
        
        // Identify entry point
        if (relativePath === &apos;src/main.jsx&apos; || relativePath === &apos;src/index.jsx&apos;) {
          fileManifest.entryPoint = fullPath;
        }
        
        // Identify App.jsx
        if (relativePath === &apos;src/App.jsx&apos; || relativePath === &apos;App.jsx&apos;) {
          fileManifest.entryPoint = fileManifest.entryPoint || fullPath;
        }
      }
      
      // Track style files
      if (relativePath.endsWith(&apos;.css&apos;)) {
        fileManifest.styleFiles.push(fullPath);
        fileInfo.type = &apos;style&apos;;
      }
      
      fileManifest.files[fullPath] = fileInfo;
    }
    
    // Build component tree
    fileManifest.componentTree = buildComponentTree(fileManifest.files);
    
    // Extract routes (simplified - looks for Route components or page pattern)
    fileManifest.routes = extractRoutes(fileManifest.files);
    
    // Update global file cache with manifest
    if (global.sandboxState?.fileCache) {
      global.sandboxState.fileCache.manifest = fileManifest;
    }

    return NextResponse.json({
      success: true,
      files: parsedResult.files,
      structure: parsedResult.structure,
      fileCount: Object.keys(parsedResult.files).length,
      manifest: fileManifest,
    });

  } catch (error) {
    console.error(&apos;[get-sandbox-files] Error:&apos;, error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}

function extractRoutes(files: Record&amp;lt;string, FileInfo&amp;gt;): RouteInfo[] {
  const routes: RouteInfo[] = [];
  
  // Look for React Router usage
  for (const [path, fileInfo] of Object.entries(files)) {
    if (fileInfo.content.includes(&apos;&amp;lt;Route&apos;) || fileInfo.content.includes(&apos;createBrowserRouter&apos;)) {
      // Extract route definitions (simplified)
      const routeMatches = fileInfo.content.matchAll(/path=[&quot;&apos;]([^&quot;&apos;]+)[&quot;&apos;].*(?:element|component)={([^}]+)}/g);
      
      for (const match of routeMatches) {
        const [, routePath, componentRef] = match;
        routes.push({
          path: routePath,
          component: path,
        });
      }
    }
    
    // Check for Next.js style pages
    if (fileInfo.relativePath.startsWith(&apos;pages/&apos;) || fileInfo.relativePath.startsWith(&apos;src/pages/&apos;)) {
      const routePath = &apos;/&apos; + fileInfo.relativePath
        .replace(/^(src\/)?pages\//, &apos;&apos;)
        .replace(/\.(jsx?|tsx?)$/, &apos;&apos;)
        .replace(/index$/, &apos;&apos;);
        
      routes.push({
        path: routePath,
        component: path,
      });
    }
  }
  
  return routes;
}