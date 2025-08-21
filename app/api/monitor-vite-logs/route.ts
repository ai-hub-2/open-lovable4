export const dynamic = &quot;force-static&quot;;


import { NextResponse } from &apos;next/server&apos;;

declare global {
  var activeSandbox: any;
}

export async function GET() {
  try {
    if (!global.activeSandbox) {
      return NextResponse.json({ 
        success: false, 
        error: &apos;No active sandbox&apos; 
      }, { status: 400 });
    }
    
    console.log(&apos;[monitor-vite-logs] Checking Vite process logs...&apos;);
    
    // Check both the error file and recent logs
    const result = await global.activeSandbox.runCode(`
import json
import subprocess
import re

errors = []

# First check the error file
try:
    with open(&apos;/tmp/vite-errors.json&apos;, &apos;r&apos;) as f:
        data = json.load(f)
        errors.extend(data.get(&apos;errors&apos;, []))
except:
    pass

# Also check if we can get recent Vite logs
try:
    # Try to get the Vite process PID
    with open(&apos;/tmp/vite-process.pid&apos;, &apos;r&apos;) as f:
        pid = int(f.read().strip())
    
    # Check if process is still running and get its logs
    # This is a bit hacky but works for our use case
    result = subprocess.run([&apos;ps&apos;, &apos;-p&apos;, str(pid)], capture_output=True, text=True)
    if result.returncode == 0:
        # Process is running, try to check for errors in output
        # Note: We can&apos;t easily get stdout/stderr from a running process
        # but we can check if there are new errors
        pass
except:
    pass

# Also scan the current console output for any HMR errors
# This won&apos;t catch everything but helps with recent errors
try:
    # Check if there&apos;s a log file we can read
    import os
    log_files = []
    for root, dirs, files in os.walk(&apos;/tmp&apos;):
        for file in files:
            if &apos;vite&apos; in file.lower() and file.endswith(&apos;.log&apos;):
                log_files.append(os.path.join(root, file))
    
    for log_file in log_files[:5]:  # Check up to 5 log files
        try:
            with open(log_file, &apos;r&apos;) as f:
                content = f.read()
                # Look for import errors
                import_errors = re.findall(r&apos;Failed to resolve import &quot;([^&quot;]+)&quot;&apos;, content)
                for pkg in import_errors:
                    if not pkg.startswith(&apos;.&apos;):
                        # Extract base package name
                        if pkg.startswith(&apos;@&apos;):
                            parts = pkg.split(&apos;/&apos;)
                            final_pkg = &apos;/&apos;.join(parts[:2]) if len(parts) &amp;gt;= 2 else pkg
                        else:
                            final_pkg = pkg.split(&apos;/&apos;)[0]
                        
                        error_obj = {
                            &quot;type&quot;: &quot;npm-missing&quot;,
                            &quot;package&quot;: final_pkg,
                            &quot;message&quot;: f&quot;Failed to resolve import \\&quot;{pkg}\\&quot;&quot;,
                            &quot;file&quot;: &quot;Unknown&quot;
                        }
                        
                        # Avoid duplicates
                        if not any(e[&apos;package&apos;] == error_obj[&apos;package&apos;] for e in errors):
                            errors.append(error_obj)
        except:
            pass
except Exception as e:
    print(f&quot;Error scanning logs: {e}&quot;)

# Deduplicate errors
unique_errors = []
seen_packages = set()
for error in errors:
    if error.get(&apos;package&apos;) and error[&apos;package&apos;] not in seen_packages:
        seen_packages.add(error[&apos;package&apos;])
        unique_errors.append(error)

print(json.dumps({&quot;errors&quot;: unique_errors}))
    `, { timeout: 5000 });
    
    const data = JSON.parse(result.output || &apos;{&quot;errors&quot;: []}&apos;);
    
    return NextResponse.json({
      success: true,
      hasErrors: data.errors.length &amp;gt; 0,
      errors: data.errors
    });
    
  } catch (error) {
    console.error(&apos;[monitor-vite-logs] Error:&apos;, error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}