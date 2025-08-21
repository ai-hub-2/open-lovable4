export const dynamic = &quot;force-static&quot;;


import { NextRequest, NextResponse } from &apos;next/server&apos;;
import { createGroq } from &apos;@ai-sdk/groq&apos;;
import { createAnthropic } from &apos;@ai-sdk/anthropic&apos;;
import { createOpenAI } from &apos;@ai-sdk/openai&apos;;
import { createGoogleGenerativeAI } from &apos;@ai-sdk/google&apos;;
import { generateObject } from &apos;ai&apos;;
import { z } from &apos;zod&apos;;
import type { FileManifest } from &apos;@/types/file-manifest&apos;;

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL || &apos;https://api.anthropic.com/v1&apos;,
});

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// Schema for the AI&apos;s search plan - not file selection!
const searchPlanSchema = z.object({
  editType: z.enum([
    &apos;UPDATE_COMPONENT&apos;,
    &apos;ADD_FEATURE&apos;, 
    &apos;FIX_ISSUE&apos;,
    &apos;UPDATE_STYLE&apos;,
    &apos;REFACTOR&apos;,
    &apos;ADD_DEPENDENCY&apos;,
    &apos;REMOVE_ELEMENT&apos;
  ]).describe(&apos;The type of edit being requested&apos;),
  
  reasoning: z.string().describe(&apos;Explanation of the search strategy&apos;),
  
  searchTerms: z.array(z.string()).describe(&apos;Specific text to search for (case-insensitive). Be VERY specific - exact button text, class names, etc.&apos;),
  
  regexPatterns: z.array(z.string()).optional().describe(&apos;Regex patterns for finding code structures (e.g., &quot;className=[\\&quot;\\\&apos;].*header.*[\\&quot;\\\&apos;]&quot;)&apos;),
  
  fileTypesToSearch: z.array(z.string()).default([&apos;.jsx&apos;, &apos;.tsx&apos;, &apos;.js&apos;, &apos;.ts&apos;]).describe(&apos;File extensions to search&apos;),
  
  expectedMatches: z.number().min(1).max(10).default(1).describe(&apos;Expected number of matches (helps validate search worked)&apos;),
  
  fallbackSearch: z.object({
    terms: z.array(z.string()),
    patterns: z.array(z.string()).optional()
  }).optional().describe(&apos;Backup search if primary fails&apos;)
});

export async function POST(request: NextRequest) {
  try {
    const { prompt, manifest, model = &apos;openai/gpt-oss-20b&apos; } = await request.json();
    
    console.log(&apos;[analyze-edit-intent] Request received&apos;);
    console.log(&apos;[analyze-edit-intent] Prompt:&apos;, prompt);
    console.log(&apos;[analyze-edit-intent] Model:&apos;, model);
    console.log(&apos;[analyze-edit-intent] Manifest files count:&apos;, manifest?.files ? Object.keys(manifest.files).length : 0);
    
    if (!prompt || !manifest) {
      return NextResponse.json({
        error: &apos;prompt and manifest are required&apos;
      }, { status: 400 });
    }
    
    // Create a summary of available files for the AI
    const validFiles = Object.entries(manifest.files as Record&amp;lt;string, any&amp;gt;)
      .filter(([path, info]) =&amp;gt; {
        // Filter out invalid paths
        return path.includes(&apos;.&apos;) &amp;&amp; !path.match(/\/\d+$/);
      });
    
    const fileSummary = validFiles
      .map(([path, info]: [string, any]) =&amp;gt; {
        const componentName = info.componentInfo?.name || path.split(&apos;/&apos;).pop();
        const hasImports = info.imports?.length &amp;gt; 0;
        const childComponents = info.componentInfo?.childComponents?.join(&apos;, &apos;) || &apos;none&apos;;
        return `- ${path} (${componentName}, renders: ${childComponents})`;
      })
      .join(&apos;\n&apos;);
    
    console.log(&apos;[analyze-edit-intent] Valid files found:&apos;, validFiles.length);
    
    if (validFiles.length === 0) {
      console.error(&apos;[analyze-edit-intent] No valid files found in manifest&apos;);
      return NextResponse.json({
        success: false,
        error: &apos;No valid files found in manifest&apos;
      }, { status: 400 });
    }
    
    console.log(&apos;[analyze-edit-intent] Analyzing prompt:&apos;, prompt);
    console.log(&apos;[analyze-edit-intent] File summary preview:&apos;, fileSummary.split(&apos;\n&apos;).slice(0, 5).join(&apos;\n&apos;));
    
    // Select the appropriate AI model based on the request
    let aiModel: any;
    if (model.startsWith(&apos;anthropic/&apos;)) {
      aiModel = anthropic(model.replace(&apos;anthropic/&apos;, &apos;&apos;));
    } else if (model.startsWith(&apos;openai/&apos;)) {
      if (model.includes(&apos;gpt-oss&apos;)) {
        aiModel = groq(model);
      } else {
        aiModel = openai(model.replace(&apos;openai/&apos;, &apos;&apos;));
      }
    } else if (model.startsWith(&apos;google/&apos;)) {
      aiModel = createGoogleGenerativeAI(model.replace(&apos;google/&apos;, &apos;&apos;));
    } else {
      // Default to groq if model format is unclear
      aiModel = groq(model);
    }
    
    console.log(&apos;[analyze-edit-intent] Using AI model:&apos;, model);
    
    // Use AI to create a search plan
    const result = await generateObject({
      model: aiModel,
      schema: searchPlanSchema,
      messages: [
        {
          role: &apos;system&apos;,
          content: `You are an expert at planning code searches. Your job is to create a search strategy to find the exact code that needs to be edited.

DO NOT GUESS which files to edit. Instead, provide specific search terms that will locate the code.

SEARCH STRATEGY RULES:
1. For text changes (e.g., &quot;change &apos;Start Deploying&apos; to &apos;Go Now&apos;&quot;):
   - Search for the EXACT text: &quot;Start Deploying&quot;
   
2. For style changes (e.g., &quot;make header black&quot;):
   - Search for component names: &quot;Header&quot;, &quot;&amp;lt;header&quot;
   - Search for class names: &quot;header&quot;, &quot;navbar&quot;
   - Search for className attributes containing relevant words
   
3. For removing elements (e.g., &quot;remove the deploy button&quot;):
   - Search for the button text or aria-label
   - Search for relevant IDs or data-testids
   
4. For navigation/header issues:
   - Search for: &quot;navigation&quot;, &quot;nav&quot;, &quot;Header&quot;, &quot;navbar&quot;
   - Look for Link components or href attributes
   
5. Be SPECIFIC:
   - Use exact capitalization for user-visible text
   - Include multiple search terms for redundancy
   - Add regex patterns for structural searches

Current project structure for context:
${fileSummary}`
        },
        {
          role: &apos;user&apos;,
          content: `User request: &quot;${prompt}&quot;

Create a search plan to find the exact code that needs to be modified. Include specific search terms and patterns.`
        }
      ]
    });
    
    console.log(&apos;[analyze-edit-intent] Search plan created:&apos;, {
      editType: result.object.editType,
      searchTerms: result.object.searchTerms,
      patterns: result.object.regexPatterns?.length || 0,
      reasoning: result.object.reasoning
    });
    
    // Return the search plan, not file matches
    return NextResponse.json({
      success: true,
      searchPlan: result.object
    });
    
  } catch (error) {
    console.error(&apos;[analyze-edit-intent] Error:&apos;, error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}