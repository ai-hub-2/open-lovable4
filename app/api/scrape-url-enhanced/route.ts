export const dynamic = &quot;force-static&quot;;


import { NextRequest, NextResponse } from &apos;next/server&apos;;

// Function to sanitize smart quotes and other problematic characters
function sanitizeQuotes(text: string): string {
  return text
    // Replace smart single quotes
    .replace(/[\u2018\u2019\u201A\u201B]/g, &quot;&apos;&quot;)
    // Replace smart double quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, &apos;&quot;&apos;)
    // Replace other quote-like characters
    .replace(/[\u00AB\u00BB]/g, &apos;&quot;&apos;) // Guillemets
    .replace(/[\u2039\u203A]/g, &quot;&apos;&quot;) // Single guillemets
    // Replace other problematic characters
    .replace(/[\u2013\u2014]/g, &apos;-&apos;) // En dash and em dash
    .replace(/[\u2026]/g, &apos;...&apos;) // Ellipsis
    .replace(/[\u00A0]/g, &apos; &apos;); // Non-breaking space
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({
        success: false,
        error: &apos;URL is required&apos;
      }, { status: 400 });
    }
    
    console.log(&apos;[scrape-url-enhanced] Scraping with Firecrawl:&apos;, url);
    
    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
    if (!FIRECRAWL_API_KEY) {
      throw new Error(&apos;FIRECRAWL_API_KEY environment variable is not set&apos;);
    }
    
    // Make request to Firecrawl API with maxAge for 500% faster scraping
    const firecrawlResponse = await fetch(&apos;https://api.firecrawl.dev/v1/scrape&apos;, {
      method: &apos;POST&apos;,
      headers: {
        &apos;Authorization&apos;: `Bearer ${FIRECRAWL_API_KEY}`,
        &apos;Content-Type&apos;: &apos;application/json&apos;
      },
      body: JSON.stringify({
        url,
        formats: [&apos;markdown&apos;, &apos;html&apos;],
        waitFor: 3000,
        timeout: 30000,
        blockAds: true,
        maxAge: 3600000, // Use cached data if less than 1 hour old (500% faster!)
        actions: [
          {
            type: &apos;wait&apos;,
            milliseconds: 2000
          }
        ]
      })
    });
    
    if (!firecrawlResponse.ok) {
      const error = await firecrawlResponse.text();
      throw new Error(`Firecrawl API error: ${error}`);
    }
    
    const data = await firecrawlResponse.json();
    
    if (!data.success || !data.data) {
      throw new Error(&apos;Failed to scrape content&apos;);
    }
    
    const { markdown, html, metadata } = data.data;
    
    // Sanitize the markdown content
    const sanitizedMarkdown = sanitizeQuotes(markdown || &apos;&apos;);
    
    // Extract structured data from the response
    const title = metadata?.title || &apos;&apos;;
    const description = metadata?.description || &apos;&apos;;
    
    // Format content for AI
    const formattedContent = `
Title: ${sanitizeQuotes(title)}
Description: ${sanitizeQuotes(description)}
URL: ${url}

Main Content:
${sanitizedMarkdown}
    `.trim();
    
    return NextResponse.json({
      success: true,
      url,
      content: formattedContent,
      structured: {
        title: sanitizeQuotes(title),
        description: sanitizeQuotes(description),
        content: sanitizedMarkdown,
        url
      },
      metadata: {
        scraper: &apos;firecrawl-enhanced&apos;,
        timestamp: new Date().toISOString(),
        contentLength: formattedContent.length,
        cached: data.data.cached || false, // Indicates if data came from cache
        ...metadata
      },
      message: &apos;URL scraped successfully with Firecrawl (with caching for 500% faster performance)&apos;
    });
    
  } catch (error) {
    console.error(&apos;[scrape-url-enhanced] Error:&apos;, error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}