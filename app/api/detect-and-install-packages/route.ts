export const dynamic = &quot;force-static&quot;;


import { NextRequest, NextResponse } from &apos;next/server&apos;;

declare global {
  var activeSandbox: any;
}

export async function POST(request: NextRequest) {
  try {
    const { files } = await request.json();
    
    if (!files || typeof files !== &apos;object&apos;) {
      return NextResponse.json({ 
        success: false, 
        error: &apos;Files object is required&apos; 
      }, { status: 400 });
    }

    if (!global.activeSandbox) {
      return NextResponse.json({
        success: false,
        error: &apos;No active sandbox&apos;
      }, { status: 404 });
    }

    console.log(&apos;[detect-and-install-packages] Processing files:&apos;, Object.keys(files));

    // Extract all import statements from the files
    const imports = new Set&amp;lt;string&amp;gt;();
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*,?\s*)*(?:from\s+)?[&apos;&quot;]([^&apos;&quot;]+)[&apos;&quot;]/g;
    const requireRegex = /require\s*\([&apos;&quot;]([^&apos;&quot;]+)[&apos;&quot;]\)/g;

    for (const [filePath, content] of Object.entries(files)) {
      if (typeof content !== &apos;string&apos;) continue;
      
      // Skip non-JS/JSX/TS/TSX files
      if (!filePath.match(/\.(jsx?|tsx?)$/)) continue;

      // Find ES6 imports
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        imports.add(match[1]);
      }

      // Find CommonJS requires
      while ((match = requireRegex.exec(content)) !== null) {
        imports.add(match[1]);
      }
    }

    console.log(&apos;[detect-and-install-packages] Found imports:&apos;, Array.from(imports));
    
    // Log specific heroicons imports
    const heroiconImports = Array.from(imports).filter(imp =&amp;gt; imp.includes(&apos;heroicons&apos;));
    if (heroiconImports.length &amp;gt; 0) {
      console.log(&apos;[detect-and-install-packages] Heroicon imports:&apos;, heroiconImports);
    }

    // Filter out relative imports and built-in modules
    const packages = Array.from(imports).filter(imp =&amp;gt; {
      // Skip relative imports
      if (imp.startsWith(&apos;.&apos;) || imp.startsWith(&apos;/&apos;)) return false;
      
      // Skip built-in Node modules
      const builtins = [&apos;fs&apos;, &apos;path&apos;, &apos;http&apos;, &apos;https&apos;, &apos;crypto&apos;, &apos;stream&apos;, &apos;util&apos;, &apos;os&apos;, &apos;url&apos;, &apos;querystring&apos;, &apos;child_process&apos;];
      if (builtins.includes(imp)) return false;
      
      // Extract package name (handle scoped packages and subpaths)
      const parts = imp.split(&apos;/&apos;);
      if (imp.startsWith(&apos;@&apos;)) {
        // Scoped package like @vitejs/plugin-react
        return true;
      } else {
        // Regular package, return just the first part
        return true;
      }
    });

    // Extract just the package names (without subpaths)
    const packageNames = packages.map(pkg =&amp;gt; {
      if (pkg.startsWith(&apos;@&apos;)) {
        // Scoped package: @scope/package or @scope/package/subpath
        const parts = pkg.split(&apos;/&apos;);
        return parts.slice(0, 2).join(&apos;/&apos;);
      } else {
        // Regular package: package or package/subpath
        return pkg.split(&apos;/&apos;)[0];
      }
    });

    // Remove duplicates
    const uniquePackages = [...new Set(packageNames)];

    console.log(&apos;[detect-and-install-packages] Packages to install:&apos;, uniquePackages);

    if (uniquePackages.length === 0) {
      return NextResponse.json({
        success: true,
        packagesInstalled: [],
        message: &apos;No new packages to install&apos;
      });
    }

    // Check which packages are already installed
    const checkResult = await global.activeSandbox.runCode(`
import os
import json

installed = []
missing = []

packages = ${JSON.stringify(uniquePackages)}

for package in packages:
    # Handle scoped packages
    if package.startswith(&apos;@&apos;):
        package_path = f&quot;/home/user/app/node_modules/{package}&quot;
    else:
        package_path = f&quot;/home/user/app/node_modules/{package}&quot;
    
    if os.path.exists(package_path):
        installed.append(package)
    else:
        missing.append(package)

result = {
    &apos;installed&apos;: installed,
    &apos;missing&apos;: missing
}

print(json.dumps(result))
    `);

    const status = JSON.parse(checkResult.logs.stdout.join(&apos;&apos;));
    console.log(&apos;[detect-and-install-packages] Package status:&apos;, status);

    if (status.missing.length === 0) {
      return NextResponse.json({
        success: true,
        packagesInstalled: [],
        packagesAlreadyInstalled: status.installed,
        message: &apos;All packages already installed&apos;
      });
    }

    // Install missing packages
    console.log(&apos;[detect-and-install-packages] Installing packages:&apos;, status.missing);
    
    const installResult = await global.activeSandbox.runCode(`
import subprocess
import os
import json

os.chdir(&apos;/home/user/app&apos;)
packages_to_install = ${JSON.stringify(status.missing)}

# Join packages into a single install command
packages_str = &apos; &apos;.join(packages_to_install)
cmd = f&apos;npm install {packages_str} --save&apos;

print(f&quot;Running: {cmd}&quot;)

# Run npm install with explicit save flag
result = subprocess.run([&apos;npm&apos;, &apos;install&apos;, &apos;--save&apos;] + packages_to_install, 
                       capture_output=True, 
                       text=True, 
                       cwd=&apos;/home/user/app&apos;,
                       timeout=60)

print(&quot;stdout:&quot;, result.stdout)
if result.stderr:
    print(&quot;stderr:&quot;, result.stderr)

# Verify installation
installed = []
failed = []

for package in packages_to_install:
    # Handle scoped packages correctly
    if package.startswith(&apos;@&apos;):
        # For scoped packages like @heroicons/react
        package_path = f&quot;/home/user/app/node_modules/{package}&quot;
    else:
        package_path = f&quot;/home/user/app/node_modules/{package}&quot;
    
    if os.path.exists(package_path):
        installed.append(package)
        print(f&quot;✓ Verified installation of {package}&quot;)
    else:
        # Check if it&apos;s a submodule of an installed package
        base_package = package.split(&apos;/&apos;)[0]
        if package.startswith(&apos;@&apos;):
            # For @scope/package, the base is @scope/package
            base_package = &apos;/&apos;.join(package.split(&apos;/&apos;)[:2])
        
        base_path = f&quot;/home/user/app/node_modules/{base_package}&quot;
        if os.path.exists(base_path):
            installed.append(package)
            print(f&quot;✓ Verified installation of {package} (via {base_package})&quot;)
        else:
            failed.append(package)
            print(f&quot;✗ Failed to verify installation of {package}&quot;)

result_data = {
    &apos;installed&apos;: installed,
    &apos;failed&apos;: failed,
    &apos;returncode&apos;: result.returncode
}

print(&quot;\\nResult:&quot;, json.dumps(result_data))
    `, { timeout: 60000 });

    // Parse the result more safely
    let installStatus;
    try {
      const stdout = installResult.logs.stdout.join(&apos;&apos;);
      const resultMatch = stdout.match(/Result:\s*({.*})/);
      if (resultMatch) {
        installStatus = JSON.parse(resultMatch[1]);
      } else {
        // Fallback parsing
        const lines = stdout.split(&apos;\n&apos;);
        const resultLine = lines.find((line: string) =&amp;gt; line.includes(&apos;Result:&apos;));
        if (resultLine) {
          installStatus = JSON.parse(resultLine.split(&apos;Result:&apos;)[1].trim());
        } else {
          throw new Error(&apos;Could not find Result in output&apos;);
        }
      }
    } catch (parseError) {
      console.error(&apos;[detect-and-install-packages] Failed to parse install result:&apos;, parseError);
      console.error(&apos;[detect-and-install-packages] stdout:&apos;, installResult.logs.stdout.join(&apos;&apos;));
      // Fallback to assuming all packages were installed
      installStatus = {
        installed: status.missing,
        failed: [],
        returncode: 0
      };
    }

    if (installStatus.failed.length &amp;gt; 0) {
      console.error(&apos;[detect-and-install-packages] Failed to install:&apos;, installStatus.failed);
    }

    return NextResponse.json({
      success: true,
      packagesInstalled: installStatus.installed,
      packagesFailed: installStatus.failed,
      packagesAlreadyInstalled: status.installed,
      message: `Installed ${installStatus.installed.length} packages`,
      logs: installResult.logs.stdout.join(&apos;\n&apos;)
    });

  } catch (error) {
    console.error(&apos;[detect-and-install-packages] Error:&apos;, error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}