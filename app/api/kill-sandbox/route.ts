export const dynamic = &quot;force-static&quot;;


import { NextResponse } from &apos;next/server&apos;;

declare global {
  var activeSandbox: any;
  var sandboxData: any;
  var existingFiles: Set&amp;lt;string&amp;gt;;
}

export async function POST() {
  try {
    console.log(&apos;[kill-sandbox] Killing active sandbox...&apos;);
    
    let sandboxKilled = false;
    
    // Kill existing sandbox if any
    if (global.activeSandbox) {
      try {
        await global.activeSandbox.close();
        sandboxKilled = true;
        console.log(&apos;[kill-sandbox] Sandbox closed successfully&apos;);
      } catch (e) {
        console.error(&apos;[kill-sandbox] Failed to close sandbox:&apos;, e);
      }
      global.activeSandbox = null;
      global.sandboxData = null;
    }
    
    // Clear existing files tracking
    if (global.existingFiles) {
      global.existingFiles.clear();
    }
    
    return NextResponse.json({
      success: true,
      sandboxKilled,
      message: &apos;Sandbox cleaned up successfully&apos;
    });
    
  } catch (error) {
    console.error(&apos;[kill-sandbox] Error:&apos;, error);
    return NextResponse.json(
      { 
        success: false, 
        error: (error as Error).message 
      }, 
      { status: 500 }
    );
  }
}