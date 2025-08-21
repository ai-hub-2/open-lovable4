export const dynamic = &quot;force-static&quot;;


import { NextRequest, NextResponse } from &apos;next/server&apos;;

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    
    if (!url) {
      return NextResponse.json({ error: &apos;URL is required&apos; }, { status: 400 });
    }

    // Use Firecrawl API to capture screenshot
    const firecrawlResponse = await fetch(&apos;https://api.firecrawl.dev/v1/scrape&apos;, {
      method: &apos;POST&apos;,
      headers: {
        &apos;Authorization&apos;: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        &apos;Content-Type&apos;: &apos;application/json&apos;
      },
      body: JSON.stringify({
        url,
        formats: [&apos;screenshot&apos;], // Regular viewport screenshot, not full page
        waitFor: 3000, // Wait for page to fully load
        timeout: 30000,
        blockAds: true,
        actions: [
          {
            type: &apos;wait&apos;,
            milliseconds: 2000 // Additional wait for dynamic content
          }
        ]
      })
    });

    if (!firecrawlResponse.ok) {
      const error = await firecrawlResponse.text();
      throw new Error(`Firecrawl API error: ${error}`);
    }

    const data = await firecrawlResponse.json();
    
    if (!data.success || !data.data?.screenshot) {
      throw new Error(&apos;Failed to capture screenshot&apos;);
    }

    return NextResponse.json({
      success: true,
      screenshot: data.data.screenshot,
      metadata: data.data.metadata
    });

  } catch (error: any) {
    console.error(&apos;Screenshot capture error:&apos;, error);
    return NextResponse.json({ 
      error: error.message || &apos;Failed to capture screenshot&apos; 
    }, { status: 500 });
  }
}