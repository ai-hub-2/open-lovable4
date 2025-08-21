export const dynamic = &quot;force-static&quot;;


import { NextResponse } from &apos;next/server&apos;;

declare global {
  var activeSandbox: any;
}

export async function POST() {
  try {
    if (!global.activeSandbox) {
      return NextResponse.json({ 
        success: false, 
        error: &apos;No active sandbox&apos; 
      }, { status: 400 });
    }
    
    console.log(&apos;[restart-vite] Forcing Vite restart...&apos;);
    
    // Kill existing Vite process and restart
    const result = await global.activeSandbox.runCode(`
import subprocess
import os
import signal
import time
import threading
import json
import sys

# Kill existing Vite process
try:
    with open(&apos;/tmp/vite-process.pid&apos;, &apos;r&apos;) as f:
        pid = int(f.read().strip())
        os.kill(pid, signal.SIGTERM)
        print(&quot;Killed existing Vite process&quot;)
        time.sleep(1)
except:
    print(&quot;No existing Vite process found&quot;)

os.chdir(&apos;/home/user/app&apos;)

# Clear error file
error_file = &apos;/tmp/vite-errors.json&apos;
with open(error_file, &apos;w&apos;) as f:
    json.dump({&quot;errors&quot;: [], &quot;lastChecked&quot;: time.time()}, f)

# Function to monitor Vite output for errors
def monitor_output(proc, error_file):
    while True:
        line = proc.stderr.readline()
        if not line:
            break
        
        sys.stdout.write(line)  # Also print to console
        
        # Check for import resolution errors
        if &quot;Failed to resolve import&quot; in line:
            try:
                # Extract package name from error
                import_match = line.find(&apos;&quot;&apos;)
                if import_match != -1:
                    end_match = line.find(&apos;&quot;&apos;, import_match + 1)
                    if end_match != -1:
                        package_name = line[import_match + 1:end_match]
                        # Skip relative imports
                        if not package_name.startswith(&apos;.&apos;):
                            with open(error_file, &apos;r&apos;) as f:
                                data = json.load(f)
                            
                            # Handle scoped packages correctly
                            if package_name.startswith(&apos;@&apos;):
                                # For @scope/package, keep the scope
                                pkg_parts = package_name.split(&apos;/&apos;)
                                if len(pkg_parts) &amp;gt;= 2:
                                    final_package = &apos;/&apos;.join(pkg_parts[:2])
                                else:
                                    final_package = package_name
                            else:
                                # For regular packages, just take the first part
                                final_package = package_name.split(&apos;/&apos;)[0]
                            
                            error_obj = {
                                &quot;type&quot;: &quot;npm-missing&quot;,
                                &quot;package&quot;: final_package,
                                &quot;message&quot;: line.strip(),
                                &quot;timestamp&quot;: time.time()
                            }
                            
                            # Avoid duplicates
                            if not any(e[&apos;package&apos;] == error_obj[&apos;package&apos;] for e in data[&apos;errors&apos;]):
                                data[&apos;errors&apos;].append(error_obj)
                                
                            with open(error_file, &apos;w&apos;) as f:
                                json.dump(data, f)
                                
                            print(f&quot;WARNING: Detected missing package: {error_obj[&apos;package&apos;]}&quot;)
            except Exception as e:
                print(f&quot;Error parsing Vite error: {e}&quot;)

# Start Vite with error monitoring
process = subprocess.Popen(
    [&apos;npm&apos;, &apos;run&apos;, &apos;dev&apos;],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    bufsize=1
)

# Start monitoring thread
monitor_thread = threading.Thread(target=monitor_output, args=(process, error_file))
monitor_thread.daemon = True
monitor_thread.start()

print(&quot;Vite restarted successfully!&quot;)

# Store process info for later
with open(&apos;/tmp/vite-process.pid&apos;, &apos;w&apos;) as f:
    f.write(str(process.pid))

# Wait for Vite to fully start
time.sleep(5)
print(&quot;Vite is ready&quot;)
    `);
    
    return NextResponse.json({
      success: true,
      message: &apos;Vite restarted successfully&apos;,
      output: result.output
    });
    
  } catch (error) {
    console.error(&apos;[restart-vite] Error:&apos;, error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}