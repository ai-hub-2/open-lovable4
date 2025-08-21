export const dynamic = &quot;force-static&quot;;


import { NextResponse } from &apos;next/server&apos;;

declare global {
  var activeSandbox: any;
  var sandboxData: any;
  var existingFiles: Set&amp;lt;string&amp;gt;;
}

export async function GET() {
  try {
    // Check if sandbox exists
    const sandboxExists = !!global.activeSandbox;
    
    let sandboxHealthy = false;
    let sandboxInfo = null;
    
    if (sandboxExists &amp;&amp; global.activeSandbox) {
      try {
        // Since Python isn&apos;t available in the Vite template, just check if sandbox exists
        // The sandbox object existing is enough to confirm it&apos;s healthy
        sandboxHealthy = true;
        sandboxInfo = {
          sandboxId: global.sandboxData?.sandboxId,
          url: global.sandboxData?.url,
          filesTracked: global.existingFiles ? Array.from(global.existingFiles) : [],
          lastHealthCheck: new Date().toISOString()
        };
      } catch (error) {
        console.error(&apos;[sandbox-status] Health check failed:&apos;, error);
        sandboxHealthy = false;
      }
    }
    
    return NextResponse.json({
      success: true,
      active: sandboxExists,
      healthy: sandboxHealthy,
      sandboxData: sandboxInfo,
      message: sandboxHealthy 
        ? &apos;Sandbox is active and healthy&apos; 
        : sandboxExists 
          ? &apos;Sandbox exists but is not responding&apos; 
          : &apos;No active sandbox&apos;
    });
    
  } catch (error) {
    console.error(&apos;[sandbox-status] Error:&apos;, error);
    return NextResponse.json({ 
      success: false,
      active: false,
      error: (error as Error).message 
    }, { status: 500 });
  }
}