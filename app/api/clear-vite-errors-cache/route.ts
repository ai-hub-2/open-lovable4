export const dynamic = &quot;force-static&quot;;


import { NextResponse } from &apos;next/server&apos;;

declare global {
  var viteErrorsCache: { errors: any[], timestamp: number } | null;
}

export async function POST() {
  try {
    // Clear the cache
    global.viteErrorsCache = null;
    
    console.log(&apos;[clear-vite-errors-cache] Cache cleared&apos;);
    
    return NextResponse.json({
      success: true,
      message: &apos;Vite errors cache cleared&apos;
    });
    
  } catch (error) {
    console.error(&apos;[clear-vite-errors-cache] Error:&apos;, error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}