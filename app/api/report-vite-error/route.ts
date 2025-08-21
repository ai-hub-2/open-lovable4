export const dynamic = &quot;force-static&quot;;


import { NextRequest, NextResponse } from &apos;next/server&apos;;

declare global {
  var viteErrors: any[];
}

// Initialize global viteErrors array if it doesn&apos;t exist
if (!global.viteErrors) {
  global.viteErrors = [];
}

export async function POST(request: NextRequest) {
  try {
    const { error, file, type = &apos;runtime-error&apos; } = await request.json();
    
    if (!error) {
      return NextResponse.json({ 
        success: false, 
        error: &apos;Error message is required&apos; 
      }, { status: 400 });
    }
    
    // Parse the error to extract useful information
    const errorObj: any = {
      type,
      message: error,
      file: file || &apos;unknown&apos;,
      timestamp: new Date().toISOString()
    };
    
    // Extract import information if it&apos;s an import error
    const importMatch = error.match(/Failed to resolve import [&apos;&quot;]([^&apos;&quot;]+)[&apos;&quot;] from [&apos;&quot;]([^&apos;&quot;]+)[&apos;&quot;]/);
    if (importMatch) {
      errorObj.type = &apos;import-error&apos;;
      errorObj.import = importMatch[1];
      errorObj.file = importMatch[2];
    }
    
    // Add to global errors array
    global.viteErrors.push(errorObj);
    
    // Keep only last 50 errors
    if (global.viteErrors.length &amp;gt; 50) {
      global.viteErrors = global.viteErrors.slice(-50);
    }
    
    console.log(&apos;[report-vite-error] Error reported:&apos;, errorObj);
    
    return NextResponse.json({
      success: true,
      message: &apos;Error reported successfully&apos;,
      error: errorObj
    });
    
  } catch (error) {
    console.error(&apos;[report-vite-error] Error:&apos;, error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}