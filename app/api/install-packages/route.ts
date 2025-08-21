export const dynamic = &quot;force-static&quot;;


import { NextRequest, NextResponse } from &apos;next/server&apos;;
import { Sandbox } from &apos;@e2b/code-interpreter&apos;;

declare global {
  var activeSandbox: any;
  var sandboxData: any;
}

export async function POST(request: NextRequest) {
  try {
    const { packages, sandboxId } = await request.json();
    
    if (!packages || !Array.isArray(packages) || packages.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: &apos;Packages array is required&apos; 
      }, { status: 400 });
    }
    
    // Validate and deduplicate package names
    const validPackages = [...new Set(packages)]
      .filter(pkg =&amp;gt; pkg &amp;&amp; typeof pkg === &apos;string&apos; &amp;&amp; pkg.trim() !== &apos;&apos;)
      .map(pkg =&amp;gt; pkg.trim());
    
    if (validPackages.length === 0) {
      return NextResponse.json({
        success: false,
        error: &apos;No valid package names provided&apos;
      }, { status: 400 });
    }
    
    // Log if duplicates were found
    if (packages.length !== validPackages.length) {
      console.log(`[install-packages] Cleaned packages: removed ${packages.length - validPackages.length} invalid/duplicate entries`);
      console.log(`[install-packages] Original:`, packages);
      console.log(`[install-packages] Cleaned:`, validPackages);
    }
    
    // Try to get sandbox - either from global or reconnect
    let sandbox = global.activeSandbox;
    
    if (!sandbox &amp;&amp; sandboxId) {
      console.log(`[install-packages] Reconnecting to sandbox ${sandboxId}...`);
      try {
        sandbox = await Sandbox.connect(sandboxId, { apiKey: process.env.E2B_API_KEY });
        global.activeSandbox = sandbox;
        console.log(`[install-packages] Successfully reconnected to sandbox ${sandboxId}`);
      } catch (error) {
        console.error(`[install-packages] Failed to reconnect to sandbox:`, error);
        return NextResponse.json({ 
          success: false, 
          error: `Failed to reconnect to sandbox: ${(error as Error).message}` 
        }, { status: 500 });
      }
    }
    
    if (!sandbox) {
      return NextResponse.json({ 
        success: false, 
        error: &apos;No active sandbox available&apos; 
      }, { status: 400 });
    }
    
    console.log(&apos;[install-packages] Installing packages:&apos;, packages);
    
    // Create a response stream for real-time updates
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    
    // Function to send progress updates
    const sendProgress = async (data: any) =&amp;gt; {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(message));
    };
    
    // Start installation in background
    (async (sandboxInstance) =&amp;gt; {
      try {
        await sendProgress({ 
          type: &apos;start&apos;, 
          message: `Installing ${validPackages.length} package${validPackages.length &amp;gt; 1 ? &apos;s&apos; : &apos;&apos;}...`,
          packages: validPackages 
        });
        
        // Kill any existing Vite process first
        await sendProgress({ type: &apos;status&apos;, message: &apos;Stopping development server...&apos; });
        
        await sandboxInstance.runCode(`
import subprocess
import os
import signal

# Try to kill any existing Vite process
try:
    with open(&apos;/tmp/vite-process.pid&apos;, &apos;r&apos;) as f:
        pid = int(f.read().strip())
        os.kill(pid, signal.SIGTERM)
        print(&quot;Stopped existing Vite process&quot;)
except:
    print(&quot;No existing Vite process found&quot;)
        `);
        
        // Check which packages are already installed
        await sendProgress({ 
          type: &apos;status&apos;, 
          message: &apos;Checking installed packages...&apos; 
        });
        
        const checkResult = await sandboxInstance.runCode(`
import os
import json

os.chdir(&apos;/home/user/app&apos;)

# Read package.json to check installed packages
try:
    with open(&apos;package.json&apos;, &apos;r&apos;) as f:
        package_json = json.load(f)
    
    dependencies = package_json.get(&apos;dependencies&apos;, {})
    dev_dependencies = package_json.get(&apos;devDependencies&apos;, {})
    all_deps = {**dependencies, **dev_dependencies}
    
    # Check which packages need to be installed
    packages_to_check = ${JSON.stringify(validPackages)}
    already_installed = []
    need_install = []
    
    for pkg in packages_to_check:
        # Handle scoped packages
        if pkg.startswith(&apos;@&apos;):
            pkg_name = pkg
        else:
            # Extract package name without version
            pkg_name = pkg.split(&apos;@&apos;)[0]
        
        if pkg_name in all_deps:
            already_installed.append(pkg_name)
        else:
            need_install.append(pkg)
    
    print(f&quot;Already installed: {already_installed}&quot;)
    print(f&quot;Need to install: {need_install}&quot;)
    print(f&quot;NEED_INSTALL:{json.dumps(need_install)}&quot;)
    
except Exception as e:
    print(f&quot;Error checking packages: {e}&quot;)
    print(f&quot;NEED_INSTALL:{json.dumps(packages_to_check)}&quot;)
        `);
        
        // Parse packages that need installation
        let packagesToInstall = validPackages;
        
        // Check if checkResult has the expected structure
        if (checkResult &amp;&amp; checkResult.results &amp;&amp; checkResult.results[0] &amp;&amp; checkResult.results[0].text) {
          const outputLines = checkResult.results[0].text.split(&apos;\n&apos;);
          for (const line of outputLines) {
            if (line.startsWith(&apos;NEED_INSTALL:&apos;)) {
              try {
                packagesToInstall = JSON.parse(line.substring(&apos;NEED_INSTALL:&apos;.length));
              } catch (e) {
                console.error(&apos;Failed to parse packages to install:&apos;, e);
              }
            }
          }
        } else {
          console.error(&apos;[install-packages] Invalid checkResult structure:&apos;, checkResult);
          // If we can&apos;t check, just try to install all packages
          packagesToInstall = validPackages;
        }
        
        
        if (packagesToInstall.length === 0) {
          await sendProgress({ 
            type: &apos;success&apos;, 
            message: &apos;All packages are already installed&apos;,
            installedPackages: [],
            alreadyInstalled: validPackages
          });
          return;
        }
        
        // Install only packages that aren&apos;t already installed
        const packageList = packagesToInstall.join(&apos; &apos;);
        // Only send the npm install command message if we&apos;re actually installing new packages
        await sendProgress({ 
          type: &apos;info&apos;, 
          message: `Installing ${packagesToInstall.length} new package(s): ${packagesToInstall.join(&apos;, &apos;)}`
        });
        
        const installResult = await sandboxInstance.runCode(`
import subprocess
import os

os.chdir(&apos;/home/user/app&apos;)

# Run npm install with output capture
packages_to_install = ${JSON.stringify(packagesToInstall)}
cmd_args = [&apos;npm&apos;, &apos;install&apos;, &apos;--legacy-peer-deps&apos;] + packages_to_install

print(f&quot;Running command: {&apos; &apos;.join(cmd_args)}&quot;)

process = subprocess.Popen(
    cmd_args,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)

# Stream output
while True:
    output = process.stdout.readline()
    if output == &apos;&apos; and process.poll() is not None:
        break
    if output:
        print(output.strip())

# Get the return code
rc = process.poll()

# Capture any stderr
stderr = process.stderr.read()
if stderr:
    print(&quot;STDERR:&quot;, stderr)
    if &apos;ERESOLVE&apos; in stderr:
        print(&quot;ERESOLVE_ERROR: Dependency conflict detected - using --legacy-peer-deps flag&quot;)

print(f&quot;\\nInstallation completed with code: {rc}&quot;)

# Verify packages were installed
import json
with open(&apos;/home/user/app/package.json&apos;, &apos;r&apos;) as f:
    package_json = json.load(f)
    
installed = []
for pkg in ${JSON.stringify(packagesToInstall)}:
    if pkg in package_json.get(&apos;dependencies&apos;, {}):
        installed.append(pkg)
        print(f&quot;✓ Verified {pkg}&quot;)
    else:
        print(f&quot;✗ Package {pkg} not found in dependencies&quot;)
        
print(f&quot;\\nVerified installed packages: {installed}&quot;)
        `, { timeout: 60000 }); // 60 second timeout for npm install
        
        // Send npm output
        const output = installResult?.output || installResult?.logs?.stdout?.join(&apos;\n&apos;) || &apos;&apos;;
        const npmOutputLines = output.split(&apos;\n&apos;).filter((line: string) =&amp;gt; line.trim());
        for (const line of npmOutputLines) {
          if (line.includes(&apos;STDERR:&apos;)) {
            const errorMsg = line.replace(&apos;STDERR:&apos;, &apos;&apos;).trim();
            if (errorMsg &amp;&amp; errorMsg !== &apos;undefined&apos;) {
              await sendProgress({ type: &apos;error&apos;, message: errorMsg });
            }
          } else if (line.includes(&apos;ERESOLVE_ERROR:&apos;)) {
            const msg = line.replace(&apos;ERESOLVE_ERROR:&apos;, &apos;&apos;).trim();
            await sendProgress({ 
              type: &apos;warning&apos;, 
              message: `Dependency conflict resolved with --legacy-peer-deps: ${msg}` 
            });
          } else if (line.includes(&apos;npm WARN&apos;)) {
            await sendProgress({ type: &apos;warning&apos;, message: line });
          } else if (line.trim() &amp;&amp; !line.includes(&apos;undefined&apos;)) {
            await sendProgress({ type: &apos;output&apos;, message: line });
          }
        }
        
        // Check if installation was successful
        const installedMatch = output.match(/Verified installed packages: \[(.*?)\]/);
        let installedPackages: string[] = [];
        
        if (installedMatch &amp;&amp; installedMatch[1]) {
          installedPackages = installedMatch[1]
            .split(&apos;,&apos;)
            .map((p: string) =&amp;gt; p.trim().replace(/&apos;/g, &apos;&apos;))
            .filter((p: string) =&amp;gt; p.length &amp;gt; 0);
        }
        
        if (installedPackages.length &amp;gt; 0) {
          await sendProgress({ 
            type: &apos;success&apos;, 
            message: `Successfully installed: ${installedPackages.join(&apos;, &apos;)}`,
            installedPackages 
          });
        } else {
          await sendProgress({ 
            type: &apos;error&apos;, 
            message: &apos;Failed to verify package installation&apos; 
          });
        }
        
        // Restart Vite dev server
        await sendProgress({ type: &apos;status&apos;, message: &apos;Restarting development server...&apos; });
        
        await sandboxInstance.runCode(`
import subprocess
import os
import time

os.chdir(&apos;/home/user/app&apos;)

# Kill any existing Vite processes
subprocess.run([&apos;pkill&apos;, &apos;-f&apos;, &apos;vite&apos;], capture_output=True)
time.sleep(1)

# Start Vite dev server
env = os.environ.copy()
env[&apos;FORCE_COLOR&apos;] = &apos;0&apos;

process = subprocess.Popen(
    [&apos;npm&apos;, &apos;run&apos;, &apos;dev&apos;],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    env=env
)

print(f&apos;✓ Vite dev server restarted with PID: {process.pid}&apos;)

# Store process info for later
with open(&apos;/tmp/vite-process.pid&apos;, &apos;w&apos;) as f:
    f.write(str(process.pid))

# Wait a bit for Vite to start up
time.sleep(3)

# Touch files to trigger Vite reload
subprocess.run([&apos;touch&apos;, &apos;/home/user/app/package.json&apos;])
subprocess.run([&apos;touch&apos;, &apos;/home/user/app/vite.config.js&apos;])

print(&quot;Vite restarted and should now recognize all packages&quot;)
        `);
        
        await sendProgress({ 
          type: &apos;complete&apos;, 
          message: &apos;Package installation complete and dev server restarted!&apos;,
          installedPackages 
        });
        
      } catch (error) {
        const errorMessage = (error as Error).message;
        if (errorMessage &amp;&amp; errorMessage !== &apos;undefined&apos;) {
          await sendProgress({ 
            type: &apos;error&apos;, 
            message: errorMessage
          });
        }
      } finally {
        await writer.close();
      }
    })(sandbox);
    
    // Return the stream
    return new Response(stream.readable, {
      headers: {
        &apos;Content-Type&apos;: &apos;text/event-stream&apos;,
        &apos;Cache-Control&apos;: &apos;no-cache&apos;,
        &apos;Connection&apos;: &apos;keep-alive&apos;,
      },
    });
    
  } catch (error) {
    console.error(&apos;[install-packages] Error:&apos;, error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}