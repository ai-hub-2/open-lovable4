export const dynamic = &quot;force-static&quot;;


import { NextRequest, NextResponse } from &apos;next/server&apos;;
import { Sandbox } from &apos;@e2b/code-interpreter&apos;;

// Get active sandbox from global state (in production, use a proper state management solution)
declare global {
  var activeSandbox: any;
}

export async function POST(request: NextRequest) {
  try {
    const { command } = await request.json();
    
    if (!command) {
      return NextResponse.json({ 
        success: false, 
        error: &apos;Command is required&apos; 
      }, { status: 400 });
    }
    
    if (!global.activeSandbox) {
      return NextResponse.json({ 
        success: false, 
        error: &apos;No active sandbox&apos; 
      }, { status: 400 });
    }
    
    console.log(`[run-command] Executing: ${command}`);
    
    const result = await global.activeSandbox.runCode(`
import subprocess
import os

os.chdir(&apos;/home/user/app&apos;)
result = subprocess.run(${JSON.stringify(command.split(&apos; &apos;))}, 
                       capture_output=True, 
                       text=True, 
                       shell=False)

print(&quot;STDOUT:&quot;)
print(result.stdout)
if result.stderr:
    print(&quot;\\nSTDERR:&quot;)
    print(result.stderr)
print(f&quot;\\nReturn code: {result.returncode}&quot;)
    `);
    
    const output = result.logs.stdout.join(&apos;\n&apos;);
    
    return NextResponse.json({
      success: true,
      output,
      message: &apos;Command executed successfully&apos;
    });
    
  } catch (error) {
    console.error(&apos;[run-command] Error:&apos;, error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}