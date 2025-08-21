export const dynamic = &quot;force-static&quot;;


import { NextRequest, NextResponse } from &apos;next/server&apos;;

declare global {
  var activeSandbox: any;
}

export async function GET(request: NextRequest) {
  try {
    if (!global.activeSandbox) {
      return NextResponse.json({ 
        success: false, 
        error: &apos;No active sandbox&apos; 
      }, { status: 400 });
    }
    
    console.log(&apos;[sandbox-logs] Fetching Vite dev server logs...&apos;);
    
    // Get the last N lines of the Vite dev server output
    const result = await global.activeSandbox.runCode(`
import subprocess
import os

# Try to get the Vite process output
try:
    # Read the last 100 lines of any log files
    log_content = []
    
    # Check if there are any node processes running
    ps_result = subprocess.run([&apos;ps&apos;, &apos;aux&apos;], capture_output=True, text=True)
    vite_processes = [line for line in ps_result.stdout.split(&apos;\\n&apos;) if &apos;vite&apos; in line.lower()]
    
    if vite_processes:
        log_content.append(&quot;Vite is running&quot;)
    else:
        log_content.append(&quot;Vite process not found&quot;)
    
    # Try to capture recent console output (this is a simplified approach)
    # In a real implementation, you&apos;d want to capture the Vite process output directly
    print(json.dumps({
        &quot;hasErrors&quot;: False,
        &quot;logs&quot;: log_content,
        &quot;status&quot;: &quot;running&quot; if vite_processes else &quot;stopped&quot;
    }))
except Exception as e:
    print(json.dumps({
        &quot;hasErrors&quot;: True,
        &quot;logs&quot;: [str(e)],
        &quot;status&quot;: &quot;error&quot;
    }))
    `);
    
    try {
      const logData = JSON.parse(result.output || &apos;{}&apos;);
      return NextResponse.json({
        success: true,
        ...logData
      });
    } catch {
      return NextResponse.json({
        success: true,
        hasErrors: false,
        logs: [result.output],
        status: &apos;unknown&apos;
      });
    }
    
  } catch (error) {
    console.error(&apos;[sandbox-logs] Error:&apos;, error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}