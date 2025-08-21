export const dynamic = &quot;force-static&quot;;


import { NextRequest, NextResponse } from &apos;next/server&apos;;
import { createGroq } from &apos;@ai-sdk/groq&apos;;
import { createAnthropic } from &apos;@ai-sdk/anthropic&apos;;
import { createOpenAI } from &apos;@ai-sdk/openai&apos;;
import { createGoogleGenerativeAI } from &apos;@ai-sdk/google&apos;;
import { streamText } from &apos;ai&apos;;
import type { SandboxState } from &apos;@/types/sandbox&apos;;
import { selectFilesForEdit, getFileContents, formatFilesForAI } from &apos;@/lib/context-selector&apos;;
import { executeSearchPlan, formatSearchResultsForAI, selectTargetFile } from &apos;@/lib/file-search-executor&apos;;
import { FileManifest } from &apos;@/types/file-manifest&apos;;
import type { ConversationState, ConversationMessage, ConversationEdit } from &apos;@/types/conversation&apos;;
import { appConfig } from &apos;@/config/app.config&apos;;

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL || &apos;https://api.anthropic.com/v1&apos;,
});

const googleGenerativeAI = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to analyze user preferences from conversation history
function analyzeUserPreferences(messages: ConversationMessage[]): {
  commonPatterns: string[];
  preferredEditStyle: &apos;targeted&apos; | &apos;comprehensive&apos;;
} {
  const userMessages = messages.filter(m =&amp;gt; m.role === &apos;user&apos;);
  const patterns: string[] = [];
  
  // Count edit-related keywords
  let targetedEditCount = 0;
  let comprehensiveEditCount = 0;
  
  userMessages.forEach(msg =&amp;gt; {
    const content = msg.content.toLowerCase();
    
    // Check for targeted edit patterns
    if (content.match(/\b(update|change|fix|modify|edit|remove|delete)\s+(\w+\s+)?(\w+)\b/)) {
      targetedEditCount++;
    }
    
    // Check for comprehensive edit patterns
    if (content.match(/\b(rebuild|recreate|redesign|overhaul|refactor)\b/)) {
      comprehensiveEditCount++;
    }
    
    // Extract common request patterns
    if (content.includes(&apos;hero&apos;)) patterns.push(&apos;hero section edits&apos;);
    if (content.includes(&apos;header&apos;)) patterns.push(&apos;header modifications&apos;);
    if (content.includes(&apos;color&apos;) || content.includes(&apos;style&apos;)) patterns.push(&apos;styling changes&apos;);
    if (content.includes(&apos;button&apos;)) patterns.push(&apos;button updates&apos;);
    if (content.includes(&apos;animation&apos;)) patterns.push(&apos;animation requests&apos;);
  });
  
  return {
    commonPatterns: [...new Set(patterns)].slice(0, 3), // Top 3 unique patterns
    preferredEditStyle: targetedEditCount &amp;gt; comprehensiveEditCount ? &apos;targeted&apos; : &apos;comprehensive&apos;
  };
}

declare global {
  var sandboxState: SandboxState;
  var conversationState: ConversationState | null;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, model = &apos;openai/gpt-oss-20b&apos;, context, isEdit = false } = await request.json();
    
    console.log(&apos;[generate-ai-code-stream] Received request:&apos;);
    console.log(&apos;[generate-ai-code-stream] - prompt:&apos;, prompt);
    console.log(&apos;[generate-ai-code-stream] - isEdit:&apos;, isEdit);
    console.log(&apos;[generate-ai-code-stream] - context.sandboxId:&apos;, context?.sandboxId);
    console.log(&apos;[generate-ai-code-stream] - context.currentFiles:&apos;, context?.currentFiles ? Object.keys(context.currentFiles) : &apos;none&apos;);
    console.log(&apos;[generate-ai-code-stream] - currentFiles count:&apos;, context?.currentFiles ? Object.keys(context.currentFiles).length : 0);
    
    // Initialize conversation state if not exists
    if (!global.conversationState) {
      global.conversationState = {
        conversationId: `conv-${Date.now()}`,
        startedAt: Date.now(),
        lastUpdated: Date.now(),
        context: {
          messages: [],
          edits: [],
          projectEvolution: { majorChanges: [] },
          userPreferences: {}
        }
      };
    }
    
    // Add user message to conversation history
    const userMessage: ConversationMessage = {
      id: `msg-${Date.now()}`,
      role: &apos;user&apos;,
      content: prompt,
      timestamp: Date.now(),
      metadata: {
        sandboxId: context?.sandboxId
      }
    };
    global.conversationState.context.messages.push(userMessage);
    
    // Clean up old messages to prevent unbounded growth
    if (global.conversationState.context.messages.length &amp;gt; 20) {
      // Keep only the last 15 messages
      global.conversationState.context.messages = global.conversationState.context.messages.slice(-15);
      console.log(&apos;[generate-ai-code-stream] Trimmed conversation history to prevent context overflow&apos;);
    }
    
    // Clean up old edits
    if (global.conversationState.context.edits.length &amp;gt; 10) {
      global.conversationState.context.edits = global.conversationState.context.edits.slice(-8);
    }
    
    // Debug: Show a sample of actual file content
    if (context?.currentFiles &amp;&amp; Object.keys(context.currentFiles).length &amp;gt; 0) {
      const firstFile = Object.entries(context.currentFiles)[0];
      console.log(&apos;[generate-ai-code-stream] - sample file:&apos;, firstFile[0]);
      console.log(&apos;[generate-ai-code-stream] - sample content preview:&apos;, 
        typeof firstFile[1] === &apos;string&apos; ? firstFile[1].substring(0, 100) + &apos;...&apos; : &apos;not a string&apos;);
    }
    
    if (!prompt) {
      return NextResponse.json({ 
        success: false, 
        error: &apos;Prompt is required&apos; 
      }, { status: 400 });
    }
    
    // Create a stream for real-time updates
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    
    // Function to send progress updates
    const sendProgress = async (data: any) =&amp;gt; {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(message));
    };
    
    // Start processing in background
    (async () =&amp;gt; {
      try {
        // Send initial status
        await sendProgress({ type: &apos;status&apos;, message: &apos;Initializing AI...&apos; });
        
        // No keep-alive needed - sandbox provisioned for 10 minutes
        
        // Check if we have a file manifest for edit mode
        let editContext = null;
        let enhancedSystemPrompt = &apos;&apos;;
        
        if (isEdit) {
          console.log(&apos;[generate-ai-code-stream] Edit mode detected - starting agentic search workflow&apos;);
          console.log(&apos;[generate-ai-code-stream] Has fileCache:&apos;, !!global.sandboxState?.fileCache);
          console.log(&apos;[generate-ai-code-stream] Has manifest:&apos;, !!global.sandboxState?.fileCache?.manifest);
          
          const manifest: FileManifest | undefined = global.sandboxState?.fileCache?.manifest;
          
          if (manifest) {
            await sendProgress({ type: &apos;status&apos;, message: &apos;🔍 Creating search plan...&apos; });
            
            const fileContents = global.sandboxState.fileCache?.files || {};
            console.log(&apos;[generate-ai-code-stream] Files available for search:&apos;, Object.keys(fileContents).length);
            
            // STEP 1: Get search plan from AI
            try {
              const intentResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || &apos;http://localhost:3000&apos;}/api/analyze-edit-intent`, {
                method: &apos;POST&apos;,
                headers: { &apos;Content-Type&apos;: &apos;application/json&apos; },
                body: JSON.stringify({ prompt, manifest, model })
              });
              
              if (intentResponse.ok) {
                const { searchPlan } = await intentResponse.json();
                console.log(&apos;[generate-ai-code-stream] Search plan received:&apos;, searchPlan);
                
                await sendProgress({ 
                  type: &apos;status&apos;, 
                  message: `🔎 Searching for: &quot;${searchPlan.searchTerms.join(&apos;&quot;, &quot;&apos;)}&quot;`
                });
                
                // STEP 2: Execute the search plan
                const searchExecution = executeSearchPlan(searchPlan, 
                  Object.fromEntries(
                    Object.entries(fileContents).map(([path, data]) =&amp;gt; [
                      path.startsWith(&apos;/&apos;) ? path : `/home/user/app/${path}`,
                      data.content
                    ])
                  )
                );
                
                console.log(&apos;[generate-ai-code-stream] Search execution:&apos;, {
                  success: searchExecution.success,
                  resultsCount: searchExecution.results.length,
                  filesSearched: searchExecution.filesSearched,
                  time: searchExecution.executionTime + &apos;ms&apos;
                });
                
                if (searchExecution.success &amp;&amp; searchExecution.results.length &amp;gt; 0) {
                  // STEP 3: Select the best target file
                  const target = selectTargetFile(searchExecution.results, searchPlan.editType);
                  
                  if (target) {
                    await sendProgress({ 
                      type: &apos;status&apos;, 
                      message: `✅ Found code in ${target.filePath.split(&apos;/&apos;).pop()} at line ${target.lineNumber}`
                    });
                    
                    console.log(&apos;[generate-ai-code-stream] Target selected:&apos;, target);
                    
                    // Create surgical edit context with exact location
                    const normalizedPath = target.filePath.replace(&apos;/home/user/app/&apos;, &apos;&apos;);
                    const fileContent = fileContents[normalizedPath]?.content || &apos;&apos;;
                    
                    // Build enhanced context with search results
                    enhancedSystemPrompt = `
${formatSearchResultsForAI(searchExecution.results)}

SURGICAL EDIT INSTRUCTIONS:
You have been given the EXACT location of the code to edit.
- File: ${target.filePath}
- Line: ${target.lineNumber}
- Reason: ${target.reason}

Make ONLY the change requested by the user. Do not modify any other code.
User request: &quot;${prompt}&quot;`;
                    
                    // Set up edit context with just this one file
                    editContext = {
                      primaryFiles: [target.filePath],
                      contextFiles: [],
                      systemPrompt: enhancedSystemPrompt,
                      editIntent: {
                        type: searchPlan.editType,
                        description: searchPlan.reasoning,
                        targetFiles: [target.filePath],
                        confidence: 0.95, // High confidence since we found exact location
                        searchTerms: searchPlan.searchTerms
                      }
                    };
                    
                    console.log(&apos;[generate-ai-code-stream] Surgical edit context created&apos;);
                  }
                } else {
                  // Search failed - fall back to old behavior but inform user
                  console.warn(&apos;[generate-ai-code-stream] Search found no results, falling back to broader context&apos;);
                  await sendProgress({ 
                    type: &apos;status&apos;, 
                    message: &apos;⚠️ Could not find exact match, using broader search...&apos;
                  });
                }
              } else {
                console.error(&apos;[generate-ai-code-stream] Failed to get search plan&apos;);
              }
            } catch (error) {
              console.error(&apos;[generate-ai-code-stream] Error in agentic search workflow:&apos;, error);
              await sendProgress({ 
                type: &apos;status&apos;, 
                message: &apos;⚠️ Search workflow error, falling back to keyword method...&apos;
              });
              // Fall back to old method on any error if we have a manifest
              if (manifest) {
                editContext = selectFilesForEdit(prompt, manifest);
              }
            }
          } else {
            // Fall back to old method if AI analysis fails
            console.warn(&apos;[generate-ai-code-stream] AI intent analysis failed, falling back to keyword method&apos;);
            if (manifest) {
              editContext = selectFilesForEdit(prompt, manifest);
            } else {
              console.log(&apos;[generate-ai-code-stream] No manifest available for fallback&apos;);
              await sendProgress({ 
                type: &apos;status&apos;, 
                message: &apos;⚠️ No file manifest available, will use broad context&apos;
              });
            }
          }
          
          // If we got an edit context from any method, use its system prompt
          if (editContext) {
            enhancedSystemPrompt = editContext.systemPrompt;
            
            await sendProgress({ 
              type: &apos;status&apos;, 
              message: `Identified edit type: ${editContext.editIntent?.description || &apos;Code modification&apos;}`
            });
          } else if (!manifest) {
            console.log(&apos;[generate-ai-code-stream] WARNING: No manifest available for edit mode!&apos;);
            
            // Try to fetch files from sandbox if we have one
            if (global.activeSandbox) {
              await sendProgress({ type: &apos;status&apos;, message: &apos;Fetching current files from sandbox...&apos; });
              
              try {
                // Fetch files directly from sandbox
                const filesResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || &apos;http://localhost:3000&apos;}/api/get-sandbox-files`, {
                  method: &apos;GET&apos;,
                  headers: { &apos;Content-Type&apos;: &apos;application/json&apos; }
                });
                
                if (filesResponse.ok) {
                  const filesData = await filesResponse.json();
                  
                  if (filesData.success &amp;&amp; filesData.manifest) {
                    console.log(&apos;[generate-ai-code-stream] Successfully fetched manifest from sandbox&apos;);
                    const manifest = filesData.manifest;
                    
                    // Now try to analyze edit intent with the fetched manifest
                    try {
                      const intentResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || &apos;http://localhost:3000&apos;}/api/analyze-edit-intent`, {
                        method: &apos;POST&apos;,
                        headers: { &apos;Content-Type&apos;: &apos;application/json&apos; },
                        body: JSON.stringify({ prompt, manifest, model })
                      });
                      
                      if (intentResponse.ok) {
                        const { searchPlan } = await intentResponse.json();
                        console.log(&apos;[generate-ai-code-stream] Search plan received (after fetch):&apos;, searchPlan);
                        
                        // For now, fall back to keyword search since we don&apos;t have file contents for search execution
                        // This path happens when no manifest was initially available
                        let targetFiles: string[] = [];
                        if (!searchPlan || searchPlan.searchTerms.length === 0) {
                          console.warn(&apos;[generate-ai-code-stream] No target files after fetch, searching for relevant files&apos;);
                          
                          const promptLower = prompt.toLowerCase();
                          const allFilePaths = Object.keys(manifest.files);
                          
                          // Look for component names mentioned in the prompt
                          if (promptLower.includes(&apos;hero&apos;)) {
                            targetFiles = allFilePaths.filter(p =&amp;gt; p.toLowerCase().includes(&apos;hero&apos;));
                          } else if (promptLower.includes(&apos;header&apos;)) {
                            targetFiles = allFilePaths.filter(p =&amp;gt; p.toLowerCase().includes(&apos;header&apos;));
                          } else if (promptLower.includes(&apos;footer&apos;)) {
                            targetFiles = allFilePaths.filter(p =&amp;gt; p.toLowerCase().includes(&apos;footer&apos;));
                          } else if (promptLower.includes(&apos;nav&apos;)) {
                            targetFiles = allFilePaths.filter(p =&amp;gt; p.toLowerCase().includes(&apos;nav&apos;));
                          } else if (promptLower.includes(&apos;button&apos;)) {
                            targetFiles = allFilePaths.filter(p =&amp;gt; p.toLowerCase().includes(&apos;button&apos;));
                          }
                          
                          if (targetFiles.length &amp;gt; 0) {
                            console.log(&apos;[generate-ai-code-stream] Found target files by keyword search after fetch:&apos;, targetFiles);
                          }
                        }
                        
                        const allFiles = Object.keys(manifest.files)
                          .filter(path =&amp;gt; !targetFiles.includes(path));
                        
                        editContext = {
                          primaryFiles: targetFiles,
                          contextFiles: allFiles,
                          systemPrompt: `
You are an expert senior software engineer performing a surgical, context-aware code modification. Your primary directive is **precision and preservation**.

Think of yourself as a surgeon making a precise incision, not a construction worker demolishing a wall.

## Search-Based Edit
Search Terms: ${searchPlan?.searchTerms?.join(&apos;, &apos;) || &apos;keyword-based&apos;}
Edit Type: ${searchPlan?.editType || &apos;UPDATE_COMPONENT&apos;}
Reasoning: ${searchPlan?.reasoning || &apos;Modifying based on user request&apos;}

Files to Edit: ${targetFiles.join(&apos;, &apos;) || &apos;To be determined&apos;}
User Request: &quot;${prompt}&quot;

## Your Mandatory Thought Process (Execute Internally):
Before writing ANY code, you MUST follow these steps:

1. **Understand Intent:**
   - What is the user&apos;s core goal? (adding feature, fixing bug, changing style?)
   - Does the conversation history provide extra clues?

2. **Locate the Code:**
   - First examine the Primary Files provided
   - Check the &quot;ALL PROJECT FILES&quot; list to find the EXACT file name
   - &quot;nav&quot; might be Navigation.tsx, NavBar.tsx, Nav.tsx, or Header.tsx
   - DO NOT create a new file if a similar one exists!

3. **Plan the Changes (Mental Diff):**
   - What is the *minimal* set of changes required?
   - Which exact lines need to be added, modified, or deleted?
   - Will this require new packages?

4. **Verify Preservation:**
   - What existing code, props, state, and logic must NOT be touched?
   - How can I make my change without disrupting surrounding code?

5. **Construct the Final Code:**
   - Only after completing steps above, generate the final code
   - Provide the ENTIRE file content with modifications integrated

## Critical Rules &amp; Constraints:

**PRESERVATION IS KEY:** You MUST NOT rewrite entire components or files. Integrate your changes into the existing code. Preserve all existing logic, props, state, and comments not directly related to the user&apos;s request.

**MINIMALISM:** Only output files you have actually changed. If a file doesn&apos;t need modification, don&apos;t include it.

**COMPLETENESS:** Each file must be COMPLETE from first line to last:
- NEVER TRUNCATE - Include EVERY line
- NO ellipsis (...) to skip content
- ALL imports, functions, JSX, and closing tags must be present
- The file MUST be runnable

**SURGICAL PRECISION:**
- Change ONLY what&apos;s explicitly requested
- If user says &quot;change background to green&quot;, change ONLY the background class
- 99% of the original code should remain untouched
- NO refactoring, reformatting, or &quot;improvements&quot; unless requested

**NO CONVERSATION:** Your output must contain ONLY the code. No explanations or apologies.

## EXAMPLES:

### CORRECT APPROACH for &quot;change hero background to blue&quot;:
&amp;lt;thinking&amp;gt;
I need to change the background color of the Hero component. Looking at the file, I see the main div has &apos;bg-gray-900&apos;. I will change ONLY this to &apos;bg-blue-500&apos; and leave everything else exactly as is.
&amp;lt;/thinking&amp;gt;

Then return the EXACT same file with only &apos;bg-gray-900&apos; changed to &apos;bg-blue-500&apos;.

### WRONG APPROACH (DO NOT DO THIS):
- Rewriting the Hero component from scratch
- Changing the structure or reorganizing imports
- Adding or removing unrelated code
- Reformatting or &quot;cleaning up&quot; the code

Remember: You are a SURGEON making a precise incision, not an artist repainting the canvas!`,
                          editIntent: {
                            type: searchPlan?.editType || &apos;UPDATE_COMPONENT&apos;,
                            targetFiles: targetFiles,
                            confidence: searchPlan ? 0.85 : 0.6,
                            description: searchPlan?.reasoning || &apos;Keyword-based file selection&apos;,
                            suggestedContext: []
                          }
                        };
                        
                        enhancedSystemPrompt = editContext.systemPrompt;
                        
                        await sendProgress({ 
                          type: &apos;status&apos;, 
                          message: `Identified edit type: ${editContext.editIntent.description}`
                        });
                      }
                    } catch (error) {
                      console.error(&apos;[generate-ai-code-stream] Error analyzing intent after fetch:&apos;, error);
                    }
                  } else {
                    console.error(&apos;[generate-ai-code-stream] Failed to get manifest from sandbox files&apos;);
                  }
                } else {
                  console.error(&apos;[generate-ai-code-stream] Failed to fetch sandbox files:&apos;, filesResponse.status);
                }
              } catch (error) {
                console.error(&apos;[generate-ai-code-stream] Error fetching sandbox files:&apos;, error);
                await sendProgress({ 
                  type: &apos;warning&apos;, 
                  message: &apos;Could not analyze existing files for targeted edits. Proceeding with general edit mode.&apos;
                });
              }
            } else {
              console.log(&apos;[generate-ai-code-stream] No active sandbox to fetch files from&apos;);
              await sendProgress({ 
                type: &apos;warning&apos;, 
                message: &apos;No existing files found. Consider generating initial code first.&apos;
              });
            }
          }
        }
        
        // Build conversation context for system prompt
        let conversationContext = &apos;&apos;;
        if (global.conversationState &amp;&amp; global.conversationState.context.messages.length &amp;gt; 1) {
          console.log(&apos;[generate-ai-code-stream] Building conversation context&apos;);
          console.log(&apos;[generate-ai-code-stream] Total messages:&apos;, global.conversationState.context.messages.length);
          console.log(&apos;[generate-ai-code-stream] Total edits:&apos;, global.conversationState.context.edits.length);
          
          conversationContext = `\n\n## Conversation History (Recent)\n`;
          
          // Include only the last 3 edits to save context
          const recentEdits = global.conversationState.context.edits.slice(-3);
          if (recentEdits.length &amp;gt; 0) {
            console.log(&apos;[generate-ai-code-stream] Including&apos;, recentEdits.length, &apos;recent edits in context&apos;);
            conversationContext += `\n### Recent Edits:\n`;
            recentEdits.forEach(edit =&amp;gt; {
              conversationContext += `- &quot;${edit.userRequest}&quot; → ${edit.editType} (${edit.targetFiles.map(f =&amp;gt; f.split(&apos;/&apos;).pop()).join(&apos;, &apos;)})\n`;
            });
          }
          
          // Include recently created files - CRITICAL for preventing duplicates
          const recentMsgs = global.conversationState.context.messages.slice(-5);
          const recentlyCreatedFiles: string[] = [];
          recentMsgs.forEach(msg =&amp;gt; {
            if (msg.metadata?.editedFiles) {
              recentlyCreatedFiles.push(...msg.metadata.editedFiles);
            }
          });
          
          if (recentlyCreatedFiles.length &amp;gt; 0) {
            const uniqueFiles = [...new Set(recentlyCreatedFiles)];
            conversationContext += `\n### 🚨 RECENTLY CREATED/EDITED FILES (DO NOT RECREATE THESE):\n`;
            uniqueFiles.forEach(file =&amp;gt; {
              conversationContext += `- ${file}\n`;
            });
            conversationContext += `\nIf the user mentions any of these components, UPDATE the existing file!\n`;
          }
          
          // Include only last 5 messages for context (reduced from 10)
          const recentMessages = recentMsgs;
          if (recentMessages.length &amp;gt; 2) { // More than just current message
            conversationContext += `\n### Recent Messages:\n`;
            recentMessages.slice(0, -1).forEach(msg =&amp;gt; { // Exclude current message
              if (msg.role === &apos;user&apos;) {
                const truncatedContent = msg.content.length &amp;gt; 100 ? msg.content.substring(0, 100) + &apos;...&apos; : msg.content;
                conversationContext += `- &quot;${truncatedContent}&quot;\n`;
              }
            });
          }
          
          // Include only last 2 major changes
          const majorChanges = global.conversationState.context.projectEvolution.majorChanges.slice(-2);
          if (majorChanges.length &amp;gt; 0) {
            conversationContext += `\n### Recent Changes:\n`;
            majorChanges.forEach(change =&amp;gt; {
              conversationContext += `- ${change.description}\n`;
            });
          }
          
          // Keep user preferences - they&apos;re concise
          const userPrefs = analyzeUserPreferences(global.conversationState.context.messages);
          if (userPrefs.commonPatterns.length &amp;gt; 0) {
            conversationContext += `\n### User Preferences:\n`;
            conversationContext += `- Edit style: ${userPrefs.preferredEditStyle}\n`;
          }
          
          // Limit total conversation context length
          if (conversationContext.length &amp;gt; 2000) {
            conversationContext = conversationContext.substring(0, 2000) + &apos;\n[Context truncated to prevent length errors]&apos;;
          }
        }
        
        // Build system prompt with conversation awareness
        const systemPrompt = `You are an expert React developer with perfect memory of the conversation. You maintain context across messages and remember scraped websites, generated components, and applied code. Generate clean, modern React code for Vite applications.
${conversationContext}

🚨 CRITICAL RULES - YOUR MOST IMPORTANT INSTRUCTIONS:
1. **DO EXACTLY WHAT IS ASKED - NOTHING MORE, NOTHING LESS**
   - Don&apos;t add features not requested
   - Don&apos;t fix unrelated issues
   - Don&apos;t improve things not mentioned
2. **CHECK App.jsx FIRST** - ALWAYS see what components exist before creating new ones
3. **NAVIGATION LIVES IN Header.jsx** - Don&apos;t create Nav.jsx if Header exists with nav
4. **USE STANDARD TAILWIND CLASSES ONLY**:
   - ✅ CORRECT: bg-white, text-black, bg-blue-500, bg-gray-100, text-gray-900
   - ❌ WRONG: bg-background, text-foreground, bg-primary, bg-muted, text-secondary
   - Use ONLY classes from the official Tailwind CSS documentation
5. **FILE COUNT LIMITS**:
   - Simple style/text change = 1 file ONLY
   - New component = 2 files MAX (component + parent)
   - If &amp;gt;3 files, YOU&apos;RE DOING TOO MUCH

COMPONENT RELATIONSHIPS (CHECK THESE FIRST):
- Navigation usually lives INSIDE Header.jsx, not separate Nav.jsx
- Logo is typically in Header, not standalone
- Footer often contains nav links already
- Menu/Hamburger is part of Header, not separate

PACKAGE USAGE RULES:
- DO NOT use react-router-dom unless user explicitly asks for routing
- For simple nav links in a single-page app, use scroll-to-section or href=&quot;#&quot;
- Only add routing if building a multi-page application
- Common packages are auto-installed from your imports

WEBSITE CLONING REQUIREMENTS:
When recreating/cloning a website, you MUST include:
1. **Header with Navigation** - Usually Header.jsx containing nav
2. **Hero Section** - The main landing area (Hero.jsx)
3. **Main Content Sections** - Features, Services, About, etc.
4. **Footer** - Contact info, links, copyright (Footer.jsx)
5. **App.jsx** - Main app component that imports and uses all components

${isEdit ? `CRITICAL: THIS IS AN EDIT TO AN EXISTING APPLICATION

YOU MUST FOLLOW THESE EDIT RULES:
0. NEVER create tailwind.config.js, vite.config.js, package.json, or any other config files - they already exist!
1. DO NOT regenerate the entire application
2. DO NOT create files that already exist (like App.jsx, index.css, tailwind.config.js)
3. ONLY edit the EXACT files needed for the requested change - NO MORE, NO LESS
4. If the user says &quot;update the header&quot;, ONLY edit the Header component - DO NOT touch Footer, Hero, or any other components
5. If the user says &quot;change the color&quot;, ONLY edit the relevant style or component file - DO NOT &quot;improve&quot; other parts
6. If you&apos;re unsure which file to edit, choose the SINGLE most specific one related to the request
7. IMPORTANT: When adding new components or libraries:
   - Create the new component file
   - UPDATE ONLY the parent component that will use it
   - Example: Adding a Newsletter component means:
     * Create Newsletter.jsx
     * Update ONLY the file that will use it (e.g., Footer.jsx OR App.jsx) - NOT both
8. When adding npm packages:
   - Import them ONLY in the files where they&apos;re actually used
   - The system will auto-install missing packages

CRITICAL FILE MODIFICATION RULES - VIOLATION = FAILURE:
- **NEVER TRUNCATE FILES** - Always return COMPLETE files with ALL content
- **NO ELLIPSIS (...)** - Include every single line of code, no skipping
- Files MUST be complete and runnable - include ALL imports, functions, JSX, and closing tags
- Count the files you&apos;re about to generate
- If the user asked to change ONE thing, you should generate ONE file (or at most two if adding a new component)
- DO NOT &quot;fix&quot; or &quot;improve&quot; files that weren&apos;t mentioned in the request
- DO NOT update multiple components when only one was requested
- DO NOT add features the user didn&apos;t ask for
- RESIST the urge to be &quot;helpful&quot; by updating related files

CRITICAL: DO NOT REDESIGN OR REIMAGINE COMPONENTS
- &quot;update&quot; means make a small change, NOT redesign the entire component
- &quot;change X to Y&quot; means ONLY change X to Y, nothing else
- &quot;fix&quot; means repair what&apos;s broken, NOT rewrite everything
- &quot;remove X&quot; means delete X from the existing file, NOT create a new file
- &quot;delete X&quot; means remove X from where it currently exists
- Preserve ALL existing functionality and design unless explicitly asked to change it

NEVER CREATE NEW FILES WHEN THE USER ASKS TO REMOVE/DELETE SOMETHING
If the user says &quot;remove X&quot;, you must:
1. Find which existing file contains X
2. Edit that file to remove X
3. DO NOT create any new files

${editContext ? `
TARGETED EDIT MODE ACTIVE
- Edit Type: ${editContext.editIntent.type}
- Confidence: ${editContext.editIntent.confidence}
- Files to Edit: ${editContext.primaryFiles.join(&apos;, &apos;)}

🚨 CRITICAL RULE - VIOLATION WILL RESULT IN FAILURE 🚨
YOU MUST ***ONLY*** GENERATE THE FILES LISTED ABOVE!

ABSOLUTE REQUIREMENTS:
1. COUNT the files in &quot;Files to Edit&quot; - that&apos;s EXACTLY how many files you must generate
2. If &quot;Files to Edit&quot; shows ONE file, generate ONLY that ONE file
3. DO NOT generate App.jsx unless it&apos;s EXPLICITLY listed in &quot;Files to Edit&quot;
4. DO NOT generate ANY components that aren&apos;t listed in &quot;Files to Edit&quot;
5. DO NOT &quot;helpfully&quot; update related files
6. DO NOT fix unrelated issues you notice
7. DO NOT improve code quality in files not being edited
8. DO NOT add bonus features

EXAMPLE VIOLATIONS (THESE ARE FAILURES):
❌ User says &quot;update the hero&quot; → You update Hero, Header, Footer, and App.jsx
❌ User says &quot;change header color&quot; → You redesign the entire header
❌ User says &quot;fix the button&quot; → You update multiple components
❌ Files to Edit shows &quot;Hero.jsx&quot; → You also generate App.jsx &quot;to integrate it&quot;
❌ Files to Edit shows &quot;Header.jsx&quot; → You also update Footer.jsx &quot;for consistency&quot;

CORRECT BEHAVIOR (THIS IS SUCCESS):
✅ User says &quot;update the hero&quot; → You ONLY edit Hero.jsx with the requested change
✅ User says &quot;change header color&quot; → You ONLY change the color in Header.jsx
✅ User says &quot;fix the button&quot; → You ONLY fix the specific button issue
✅ Files to Edit shows &quot;Hero.jsx&quot; → You generate ONLY Hero.jsx
✅ Files to Edit shows &quot;Header.jsx, Nav.jsx&quot; → You generate EXACTLY 2 files: Header.jsx and Nav.jsx

THE AI INTENT ANALYZER HAS ALREADY DETERMINED THE FILES.
DO NOT SECOND-GUESS IT.
DO NOT ADD MORE FILES.
ONLY OUTPUT THE EXACT FILES LISTED IN &quot;Files to Edit&quot;.
` : &apos;&apos;}

VIOLATION OF THESE RULES WILL RESULT IN FAILURE!
` : &apos;&apos;}

CRITICAL INCREMENTAL UPDATE RULES:
- When the user asks for additions or modifications (like &quot;add a videos page&quot;, &quot;create a new component&quot;, &quot;update the header&quot;):
  - DO NOT regenerate the entire application
  - DO NOT recreate files that already exist unless explicitly asked
  - ONLY create/modify the specific files needed for the requested change
  - Preserve all existing functionality and files
  - If adding a new page/route, integrate it with the existing routing system
  - Reference existing components and styles rather than duplicating them
  - NEVER recreate config files (tailwind.config.js, vite.config.js, package.json, etc.)

IMPORTANT: When the user asks for edits or modifications:
- You have access to the current file contents in the context
- Make targeted changes to existing files rather than regenerating everything
- Preserve the existing structure and only modify what&apos;s requested
- If you need to see a specific file that&apos;s not in context, mention it

IMPORTANT: You have access to the full conversation context including:
- Previously scraped websites and their content
- Components already generated and applied
- The current project being worked on
- Recent conversation history
- Any Vite errors that need to be resolved

When the user references &quot;the app&quot;, &quot;the website&quot;, or &quot;the site&quot; without specifics, refer to:
1. The most recently scraped website in the context
2. The current project name in the context
3. The files currently in the sandbox

If you see scraped websites in the context, you&apos;re working on a clone/recreation of that site.

CRITICAL UI/UX RULES:
- NEVER use emojis in any code, text, console logs, or UI elements
- ALWAYS ensure responsive design using proper Tailwind classes (sm:, md:, lg:, xl:)
- ALWAYS use proper mobile-first responsive design patterns
- NEVER hardcode pixel widths - use relative units and responsive classes
- ALWAYS test that the layout works on mobile devices (320px and up)
- ALWAYS make sections full-width by default - avoid max-w-7xl or similar constraints
- For full-width layouts: use className=&quot;w-full&quot; or no width constraint at all
- Only add max-width constraints when explicitly needed for readability (like blog posts)
- Prefer system fonts and clean typography
- Ensure all interactive elements have proper hover/focus states
- Use proper semantic HTML elements for accessibility

CRITICAL STYLING RULES - MUST FOLLOW:
- NEVER use inline styles with style={{ }} in JSX
- NEVER use &amp;lt;style jsx&amp;gt; tags or any CSS-in-JS solutions
- NEVER create App.css, Component.css, or any component-specific CSS files
- NEVER import &apos;./App.css&apos; or any CSS files except index.css
- ALWAYS use Tailwind CSS classes for ALL styling
- ONLY create src/index.css with the @tailwind directives
- The ONLY CSS file should be src/index.css with:
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
- Use Tailwind&apos;s full utility set: spacing, colors, typography, flexbox, grid, animations, etc.
- ALWAYS add smooth transitions and animations where appropriate:
  - Use transition-all, transition-colors, transition-opacity for hover states
  - Use animate-fade-in, animate-pulse, animate-bounce for engaging UI elements
  - Add hover:scale-105 or hover:scale-110 for interactive elements
  - Use transform and transition utilities for smooth interactions
- For complex layouts, combine Tailwind utilities rather than writing custom CSS
- NEVER use non-standard Tailwind classes like &quot;border-border&quot;, &quot;bg-background&quot;, &quot;text-foreground&quot;, etc.
- Use standard Tailwind classes only:
  - For borders: use &quot;border-gray-200&quot;, &quot;border-gray-300&quot;, etc. NOT &quot;border-border&quot;
  - For backgrounds: use &quot;bg-white&quot;, &quot;bg-gray-100&quot;, etc. NOT &quot;bg-background&quot;
  - For text: use &quot;text-gray-900&quot;, &quot;text-black&quot;, etc. NOT &quot;text-foreground&quot;
- Examples of good Tailwind usage:
  - Buttons: className=&quot;px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 hover:shadow-lg transform hover:scale-105 transition-all duration-200&quot;
  - Cards: className=&quot;bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-xl transition-shadow duration-300&quot;
  - Full-width sections: className=&quot;w-full px-4 sm:px-6 lg:px-8&quot;
  - Constrained content (only when needed): className=&quot;max-w-7xl mx-auto px-4 sm:px-6 lg:px-8&quot;
  - Dark backgrounds: className=&quot;min-h-screen bg-gray-900 text-white&quot;
  - Hero sections: className=&quot;animate-fade-in-up&quot;
  - Feature cards: className=&quot;transform hover:scale-105 transition-transform duration-300&quot;
  - CTAs: className=&quot;animate-pulse hover:animate-none&quot;

CRITICAL STRING AND SYNTAX RULES:
- ALWAYS escape apostrophes in strings: use \&apos; instead of &apos; or use double quotes
- ALWAYS escape quotes properly in JSX attributes
- NEVER use curly quotes or smart quotes (&apos;&apos; &quot;&quot; &apos;&apos; &quot;&quot;) - only straight quotes (&apos; &quot;)
- ALWAYS convert smart/curly quotes to straight quotes:
  - &apos; and &apos; → &apos;
  - &quot; and &quot; → &quot;
  - Any other Unicode quotes → straight quotes
- When strings contain apostrophes, either:
  1. Use double quotes: &quot;you&apos;re&quot; instead of &apos;you&apos;re&apos;
  2. Escape the apostrophe: &apos;you\&apos;re&apos;
- When working with scraped content, ALWAYS sanitize quotes first
- Replace all smart quotes with straight quotes before using in code
- Be extra careful with user-generated content or scraped text
- Always validate that JSX syntax is correct before generating

CRITICAL CODE SNIPPET DISPLAY RULES:
- When displaying code examples in JSX, NEVER put raw curly braces { } in text
- ALWAYS wrap code snippets in template literals with backticks
- For code examples in components, use one of these patterns:
  1. Template literals: &amp;lt;div&amp;gt;{\`const example = { key: &apos;value&apos; }\`}&amp;lt;/div&amp;gt;
  2. Pre/code blocks: &amp;lt;pre&amp;gt;&amp;lt;code&amp;gt;{\`your code here\`}&amp;lt;/code&amp;gt;&amp;lt;/pre&amp;gt;
  3. Escape braces: &amp;lt;div&amp;gt;{&apos;{&apos;}key: value{&apos;}&apos;}&amp;lt;/div&amp;gt;
- NEVER do this: &amp;lt;div&amp;gt;const example = { key: &apos;value&apos; }&amp;lt;/div&amp;gt; (causes parse errors)
- For multi-line code snippets, always use:
  &amp;lt;pre className=&quot;bg-gray-900 text-gray-100 p-4 rounded&quot;&amp;gt;
    &amp;lt;code&amp;gt;{\`
      // Your code here
      const example = {
        key: &apos;value&apos;
      }
    \`}&amp;lt;/code&amp;gt;
  &amp;lt;/pre&amp;gt;

CRITICAL: When asked to create a React app or components:
- ALWAYS CREATE ALL FILES IN FULL - never provide partial implementations
- ALWAYS CREATE EVERY COMPONENT that you import - no placeholders
- ALWAYS IMPLEMENT COMPLETE FUNCTIONALITY - don&apos;t leave TODOs unless explicitly asked
- If you&apos;re recreating a website, implement ALL sections and features completely
- NEVER create tailwind.config.js - it&apos;s already configured in the template
- ALWAYS include a Navigation/Header component (Nav.jsx or Header.jsx) - websites need navigation!

REQUIRED COMPONENTS for website clones:
1. Nav.jsx or Header.jsx - Navigation bar with links (NEVER SKIP THIS!)
2. Hero.jsx - Main landing section
3. Features/Services/Products sections - Based on the site content
4. Footer.jsx - Footer with links and info
5. App.jsx - Main component that imports and arranges all components
- NEVER create vite.config.js - it&apos;s already configured in the template
- NEVER create package.json - it&apos;s already configured in the template

WHEN WORKING WITH SCRAPED CONTENT:
- ALWAYS sanitize all text content before using in code
- Convert ALL smart quotes to straight quotes
- Example transformations:
  - &quot;Firecrawl&apos;s API&quot; → &quot;Firecrawl&apos;s API&quot; or &quot;Firecrawl\\&apos;s API&quot;
  - &apos;It&apos;s amazing&apos; → &quot;It&apos;s amazing&quot; or &apos;It\\&apos;s amazing&apos;
  - &quot;Best tool ever&quot; → &quot;Best tool ever&quot;
- When in doubt, use double quotes for strings containing apostrophes
- For testimonials or quotes from scraped content, ALWAYS clean the text:
  - Bad: content: &apos;Moved our internal agent&apos;s web scraping...&apos;
  - Good: content: &quot;Moved our internal agent&apos;s web scraping...&quot;
  - Also good: content: &apos;Moved our internal agent\\&apos;s web scraping...&apos;

When generating code, FOLLOW THIS PROCESS:
1. ALWAYS generate src/index.css FIRST - this establishes the styling foundation
2. List ALL components you plan to import in App.jsx
3. Count them - if there are 10 imports, you MUST create 10 component files
4. Generate src/index.css first (with proper CSS reset and base styles)
5. Generate App.jsx second
6. Then generate EVERY SINGLE component file you imported
7. Do NOT stop until all imports are satisfied

Use this XML format for React components only (DO NOT create tailwind.config.js - it already exists):

&amp;lt;file path=&quot;src/index.css&quot;&amp;gt;
@tailwind base;
@tailwind components;
@tailwind utilities;
&amp;lt;/file&amp;gt;

&amp;lt;file path=&quot;src/App.jsx&quot;&amp;gt;
// Main App component that imports and uses other components
// Use Tailwind classes: className=&quot;min-h-screen bg-gray-50&quot;
&amp;lt;/file&amp;gt;

&amp;lt;file path=&quot;src/components/Example.jsx&quot;&amp;gt;
// Your React component code here
// Use Tailwind classes for ALL styling
&amp;lt;/file&amp;gt;

CRITICAL COMPLETION RULES:
1. NEVER say &quot;I&apos;ll continue with the remaining components&quot;
2. NEVER say &quot;Would you like me to proceed?&quot;
3. NEVER use &amp;lt;continue&amp;gt; tags
4. Generate ALL components in ONE response
5. If App.jsx imports 10 components, generate ALL 10
6. Complete EVERYTHING before ending your response

With 16,000 tokens available, you have plenty of space to generate a complete application. Use it!

UNDERSTANDING USER INTENT FOR INCREMENTAL VS FULL GENERATION:
- &quot;add/create/make a [specific feature]&quot; → Add ONLY that feature to existing app
- &quot;add a videos page&quot; → Create ONLY Videos.jsx and update routing
- &quot;update the header&quot; → Modify ONLY header component
- &quot;fix the styling&quot; → Update ONLY the affected components
- &quot;change X to Y&quot; → Find the file containing X and modify it
- &quot;make the header black&quot; → Find Header component and change its color
- &quot;rebuild/recreate/start over&quot; → Full regeneration
- Default to incremental updates when working on an existing app

SURGICAL EDIT RULES (CRITICAL FOR PERFORMANCE):
- **PREFER TARGETED CHANGES**: Don&apos;t regenerate entire components for small edits
- For color/style changes: Edit ONLY the specific className or style prop
- For text changes: Change ONLY the text content, keep everything else
- For adding elements: INSERT into existing JSX, don&apos;t rewrite the whole return
- **PRESERVE EXISTING CODE**: Keep all imports, functions, and unrelated code exactly as-is
- Maximum files to edit:
  - Style change = 1 file ONLY
  - Text change = 1 file ONLY
  - New feature = 2 files MAX (feature + parent)
- If you&apos;re editing &amp;gt;3 files for a simple request, STOP - you&apos;re doing too much

EXAMPLES OF CORRECT SURGICAL EDITS:
✅ &quot;change header to black&quot; → Find className=&quot;...&quot; in Header.jsx, change ONLY color classes
✅ &quot;update hero text&quot; → Find the &amp;lt;h1&amp;gt; or &amp;lt;p&amp;gt; in Hero.jsx, change ONLY the text inside
✅ &quot;add a button to hero&quot; → Find the return statement, ADD button, keep everything else
❌ WRONG: Regenerating entire Header.jsx to change one color
❌ WRONG: Rewriting Hero.jsx to add one button

NAVIGATION/HEADER INTELLIGENCE:
- ALWAYS check App.jsx imports first
- Navigation is usually INSIDE Header.jsx, not separate
- If user says &quot;nav&quot;, check Header.jsx FIRST
- Only create Nav.jsx if no navigation exists anywhere
- Logo, menu, hamburger = all typically in Header

CRITICAL: When files are provided in the context:
1. The user is asking you to MODIFY the existing app, not create a new one
2. Find the relevant file(s) from the provided context
3. Generate ONLY the files that need changes
4. Do NOT ask to see files - they are already provided in the context above
5. Make the requested change immediately`;

        // Build full prompt with context
        let fullPrompt = prompt;
        if (context) {
          const contextParts = [];
          
          if (context.sandboxId) {
            contextParts.push(`Current sandbox ID: ${context.sandboxId}`);
          }
          
          if (context.structure) {
            contextParts.push(`Current file structure:\n${context.structure}`);
          }
          
          // Use backend file cache instead of frontend-provided files
          let backendFiles = global.sandboxState?.fileCache?.files || {};
          let hasBackendFiles = Object.keys(backendFiles).length &amp;gt; 0;
          
          console.log(&apos;[generate-ai-code-stream] Backend file cache status:&apos;);
          console.log(&apos;[generate-ai-code-stream] - Has sandboxState:&apos;, !!global.sandboxState);
          console.log(&apos;[generate-ai-code-stream] - Has fileCache:&apos;, !!global.sandboxState?.fileCache);
          console.log(&apos;[generate-ai-code-stream] - File count:&apos;, Object.keys(backendFiles).length);
          console.log(&apos;[generate-ai-code-stream] - Has manifest:&apos;, !!global.sandboxState?.fileCache?.manifest);
          
          // If no backend files and we&apos;re in edit mode, try to fetch from sandbox
          if (!hasBackendFiles &amp;&amp; isEdit &amp;&amp; (global.activeSandbox || context?.sandboxId)) {
            console.log(&apos;[generate-ai-code-stream] No backend files, attempting to fetch from sandbox...&apos;);
            
            try {
              const filesResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || &apos;http://localhost:3000&apos;}/api/get-sandbox-files`, {
                method: &apos;GET&apos;,
                headers: { &apos;Content-Type&apos;: &apos;application/json&apos; }
              });
              
              if (filesResponse.ok) {
                const filesData = await filesResponse.json();
                if (filesData.success &amp;&amp; filesData.files) {
                  console.log(&apos;[generate-ai-code-stream] Successfully fetched&apos;, Object.keys(filesData.files).length, &apos;files from sandbox&apos;);
                  
                  // Initialize sandboxState if needed
                  if (!global.sandboxState) {
                    global.sandboxState = {
                      fileCache: {
                        files: {},
                        lastSync: Date.now(),
                        sandboxId: context?.sandboxId || &apos;unknown&apos;
                      }
                    } as any;
                  } else if (!global.sandboxState.fileCache) {
                    global.sandboxState.fileCache = {
                      files: {},
                      lastSync: Date.now(),
                      sandboxId: context?.sandboxId || &apos;unknown&apos;
                    };
                  }
                  
                  // Store files in cache
                  for (const [path, content] of Object.entries(filesData.files)) {
                    const normalizedPath = path.replace(&apos;/home/user/app/&apos;, &apos;&apos;);
                    if (global.sandboxState.fileCache) {
                      global.sandboxState.fileCache.files[normalizedPath] = {
                        content: content as string,
                        lastModified: Date.now()
                      };
                    }
                  
                  if (filesData.manifest &amp;&amp; global.sandboxState.fileCache) {
                    global.sandboxState.fileCache.manifest = filesData.manifest;
                    
                    // Now try to analyze edit intent with the fetched manifest
                    if (!editContext) {
                      console.log(&apos;[generate-ai-code-stream] Analyzing edit intent with fetched manifest&apos;);
                      try {
                        const intentResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || &apos;http://localhost:3000&apos;}/api/analyze-edit-intent`, {
                          method: &apos;POST&apos;,
                          headers: { &apos;Content-Type&apos;: &apos;application/json&apos; },
                          body: JSON.stringify({ prompt, manifest: filesData.manifest, model })
                        });
                        
                        if (intentResponse.ok) {
                          const { searchPlan } = await intentResponse.json();
                          console.log(&apos;[generate-ai-code-stream] Search plan received:&apos;, searchPlan);
                          
                          // Create edit context from AI analysis
                          // Note: We can&apos;t execute search here without file contents, so fall back to keyword method
                          const fileContext = selectFilesForEdit(prompt, filesData.manifest);
                          editContext = fileContext;
                          enhancedSystemPrompt = fileContext.systemPrompt;
                          
                          console.log(&apos;[generate-ai-code-stream] Edit context created with&apos;, editContext.primaryFiles.length, &apos;primary files&apos;);
                        }
                      } catch (error) {
                        console.error(&apos;[generate-ai-code-stream] Failed to analyze edit intent:&apos;, error);
                      }
                    }
                  }
                }
                  
                  // Update variables
                  if (global.sandboxState.fileCache) {
                    backendFiles = global.sandboxState.fileCache.files;
                    hasBackendFiles = Object.keys(backendFiles).length &amp;gt; 0;
                  }
                  console.log(&apos;[generate-ai-code-stream] Updated backend cache with fetched files&apos;);
                }
              }
            } catch (error) {
              console.error(&apos;[generate-ai-code-stream] Failed to fetch sandbox files:&apos;, error);
            }
          }
          
          // Include current file contents from backend cache
          if (hasBackendFiles) {
            // If we have edit context, use intelligent file selection
            if (editContext &amp;&amp; editContext.primaryFiles.length &amp;gt; 0) {
              contextParts.push(&apos;\nEXISTING APPLICATION - TARGETED EDIT MODE&apos;);
              contextParts.push(`\n${editContext.systemPrompt || enhancedSystemPrompt}\n`);
              
              // Get contents of primary and context files
              const primaryFileContents = await getFileContents(editContext.primaryFiles, global.sandboxState!.fileCache!.manifest!);
              const contextFileContents = await getFileContents(editContext.contextFiles, global.sandboxState!.fileCache!.manifest!);
              
              // Format files for AI
              const formattedFiles = formatFilesForAI(primaryFileContents, contextFileContents);
              contextParts.push(formattedFiles);
              
              contextParts.push(&apos;\nIMPORTANT: Only modify the files listed under &quot;Files to Edit&quot;. The context files are provided for reference only.&apos;);
            } else {
              // Fallback to showing all files if no edit context
              console.log(&apos;[generate-ai-code-stream] WARNING: Using fallback mode - no edit context available&apos;);
              contextParts.push(&apos;\nEXISTING APPLICATION - TARGETED EDIT REQUIRED&apos;);
              contextParts.push(&apos;\nYou MUST analyze the user request and determine which specific file(s) to edit.&apos;);
              contextParts.push(&apos;\nCurrent project files (DO NOT regenerate all of these):&apos;);
              
              const fileEntries = Object.entries(backendFiles);
              console.log(`[generate-ai-code-stream] Using backend cache: ${fileEntries.length} files`);
              
              // Show file list first for reference
              contextParts.push(&apos;\n### File List:&apos;);
              for (const [path] of fileEntries) {
                contextParts.push(`- ${path}`);
              }
              
              // Include ALL files as context in fallback mode
              contextParts.push(&apos;\n### File Contents (ALL FILES FOR CONTEXT):&apos;);
              for (const [path, fileData] of fileEntries) {
                const content = fileData.content;
                if (typeof content === &apos;string&apos;) {
                  contextParts.push(`\n&amp;lt;file path=&quot;${path}&quot;&amp;gt;\n${content}\n&amp;lt;/file&amp;gt;`);
                }
              }
              
              contextParts.push(&apos;\n🚨 CRITICAL INSTRUCTIONS - VIOLATION = FAILURE 🚨&apos;);
              contextParts.push(&apos;1. Analyze the user request: &quot;&apos; + prompt + &apos;&quot;&apos;);
              contextParts.push(&apos;2. Identify the MINIMUM number of files that need editing (usually just ONE)&apos;);
              contextParts.push(&apos;3. PRESERVE ALL EXISTING CONTENT in those files&apos;);
              contextParts.push(&apos;4. ONLY ADD/MODIFY the specific part requested&apos;);
              contextParts.push(&apos;5. DO NOT regenerate entire components from scratch&apos;);
              contextParts.push(&apos;6. DO NOT change unrelated parts of any file&apos;);
              contextParts.push(&apos;7. Generate ONLY the files that MUST be changed - NO EXTRAS&apos;);
              contextParts.push(&apos;\n⚠️ FILE COUNT RULE:&apos;);
              contextParts.push(&apos;- Simple change (color, text, spacing) = 1 file ONLY&apos;);
              contextParts.push(&apos;- Adding new component = 2 files MAX (new component + parent that imports it)&apos;);
              contextParts.push(&apos;- DO NOT exceed these limits unless absolutely necessary&apos;);
              contextParts.push(&apos;\nEXAMPLES OF CORRECT BEHAVIOR:&apos;);
              contextParts.push(&apos;✅ &quot;add a chart to the hero&quot; → Edit ONLY Hero.jsx, ADD the chart, KEEP everything else&apos;);
              contextParts.push(&apos;✅ &quot;change header to black&quot; → Edit ONLY Header.jsx, change ONLY the color&apos;);
              contextParts.push(&apos;✅ &quot;fix spacing in footer&quot; → Edit ONLY Footer.jsx, adjust ONLY spacing&apos;);
              contextParts.push(&apos;\nEXAMPLES OF FAILURES:&apos;);
              contextParts.push(&apos;❌ &quot;change header color&quot; → You edit Header, Footer, and App &quot;for consistency&quot;&apos;);
              contextParts.push(&apos;❌ &quot;add chart to hero&quot; → You regenerate the entire Hero component&apos;);
              contextParts.push(&apos;❌ &quot;fix button&quot; → You update 5 different component files&apos;);
              contextParts.push(&apos;\n⚠️ FINAL WARNING:&apos;);
              contextParts.push(&apos;If you generate MORE files than necessary, you have FAILED&apos;);
              contextParts.push(&apos;If you DELETE or REWRITE existing functionality, you have FAILED&apos;);
              contextParts.push(&apos;ONLY change what was EXPLICITLY requested - NOTHING MORE&apos;);
            }
          } else if (context.currentFiles &amp;&amp; Object.keys(context.currentFiles).length &amp;gt; 0) {
            // Fallback to frontend-provided files if backend cache is empty
            console.log(&apos;[generate-ai-code-stream] Warning: Backend cache empty, using frontend files&apos;);
            contextParts.push(&apos;\nEXISTING APPLICATION - DO NOT REGENERATE FROM SCRATCH&apos;);
            contextParts.push(&apos;Current project files (modify these, do not recreate):&apos;);
            
            const fileEntries = Object.entries(context.currentFiles);
            for (const [path, content] of fileEntries) {
              if (typeof content === &apos;string&apos;) {
                contextParts.push(`\n&amp;lt;file path=&quot;${path}&quot;&amp;gt;\n${content}\n&amp;lt;/file&amp;gt;`);
              }
            }
            contextParts.push(&apos;\nThe above files already exist. When the user asks to modify something (like &quot;change the header color to black&quot;), find the relevant file above and generate ONLY that file with the requested changes.&apos;);
          }
          
          // Add explicit edit mode indicator
          if (isEdit) {
            contextParts.push(&apos;\nEDIT MODE ACTIVE&apos;);
            contextParts.push(&apos;This is an incremental update to an existing application.&apos;);
            contextParts.push(&apos;DO NOT regenerate App.jsx, index.css, or other core files unless explicitly requested.&apos;);
            contextParts.push(&apos;ONLY create or modify the specific files needed for the user\&apos;s request.&apos;);
            contextParts.push(&apos;\n⚠️ CRITICAL FILE OUTPUT FORMAT - VIOLATION = FAILURE:&apos;);
            contextParts.push(&apos;YOU MUST OUTPUT EVERY FILE IN THIS EXACT XML FORMAT:&apos;);
            contextParts.push(&apos;&amp;lt;file path=&quot;src/components/ComponentName.jsx&quot;&amp;gt;&apos;);
            contextParts.push(&apos;// Complete file content here&apos;);
            contextParts.push(&apos;&amp;lt;/file&amp;gt;&apos;);
            contextParts.push(&apos;&amp;lt;file path=&quot;src/index.css&quot;&amp;gt;&apos;);
            contextParts.push(&apos;/* CSS content here */&apos;);
            contextParts.push(&apos;&amp;lt;/file&amp;gt;&apos;);
            contextParts.push(&apos;\n❌ NEVER OUTPUT: &quot;Generated Files: index.css, App.jsx&quot;&apos;);
            contextParts.push(&apos;❌ NEVER LIST FILE NAMES WITHOUT CONTENT&apos;);
            contextParts.push(&apos;✅ ALWAYS: One &amp;lt;file&amp;gt; tag per file with COMPLETE content&apos;);
            contextParts.push(&apos;✅ ALWAYS: Include EVERY file you modified&apos;);
          } else if (!hasBackendFiles) {
            // First generation mode - make it beautiful!
            contextParts.push(&apos;\n🎨 FIRST GENERATION MODE - CREATE SOMETHING BEAUTIFUL!&apos;);
            contextParts.push(&apos;\nThis is the user\&apos;s FIRST experience. Make it impressive:&apos;);
            contextParts.push(&apos;1. **USE TAILWIND PROPERLY** - Use standard Tailwind color classes&apos;);
            contextParts.push(&apos;2. **NO PLACEHOLDERS** - Use real content, not lorem ipsum&apos;);
            contextParts.push(&apos;3. **COMPLETE COMPONENTS** - Header, Hero, Features, Footer minimum&apos;);
            contextParts.push(&apos;4. **VISUAL POLISH** - Shadows, hover states, transitions&apos;);
            contextParts.push(&apos;5. **STANDARD CLASSES** - bg-white, text-gray-900, bg-blue-500, NOT bg-background&apos;);
            contextParts.push(&apos;\nCreate a polished, professional application that works perfectly on first load.&apos;);
            contextParts.push(&apos;\n⚠️ OUTPUT FORMAT:&apos;);
            contextParts.push(&apos;Use &amp;lt;file path=&quot;...&quot;&amp;gt;content&amp;lt;/file&amp;gt; tags for EVERY file&apos;);
            contextParts.push(&apos;NEVER output &quot;Generated Files:&quot; as plain text&apos;);
          }
          
          // Add conversation context (scraped websites, etc)
          if (context.conversationContext) {
            if (context.conversationContext.scrapedWebsites?.length &amp;gt; 0) {
              contextParts.push(&apos;\nScraped Websites in Context:&apos;);
              context.conversationContext.scrapedWebsites.forEach((site: any) =&amp;gt; {
                contextParts.push(`\nURL: ${site.url}`);
                contextParts.push(`Scraped: ${new Date(site.timestamp).toLocaleString()}`);
                if (site.content) {
                  // Include a summary of the scraped content
                  const contentPreview = typeof site.content === &apos;string&apos; 
                    ? site.content.substring(0, 1000) 
                    : JSON.stringify(site.content).substring(0, 1000);
                  contextParts.push(`Content Preview: ${contentPreview}...`);
                }
              });
            }
            
            if (context.conversationContext.currentProject) {
              contextParts.push(`\nCurrent Project: ${context.conversationContext.currentProject}`);
            }
          }
          
          if (contextParts.length &amp;gt; 0) {
            fullPrompt = `CONTEXT:\n${contextParts.join(&apos;\n&apos;)}\n\nUSER REQUEST:\n${prompt}`;
          }
        }
        
        await sendProgress({ type: &apos;status&apos;, message: &apos;Planning application structure...&apos; });
        
        console.log(&apos;\n[generate-ai-code-stream] Starting streaming response...\n&apos;);
        
        // Track packages that need to be installed
        const packagesToInstall: string[] = [];
        
        // Determine which provider to use based on model
        const isAnthropic = model.startsWith(&apos;anthropic/&apos;);
        const isGoogle = model.startsWith(&apos;google/&apos;);
        const isOpenAI = model.startsWith(&apos;openai/gpt-5&apos;);
        const modelProvider = isAnthropic ? anthropic : (isOpenAI ? openai : (isGoogle ? googleGenerativeAI : groq));
        const actualModel = isAnthropic ? model.replace(&apos;anthropic/&apos;, &apos;&apos;) : 
                           (model === &apos;openai/gpt-5&apos;) ? &apos;gpt-5&apos; :
                           (isGoogle ? model.replace(&apos;google/&apos;, &apos;&apos;) : model);

        // Make streaming API call with appropriate provider
        const streamOptions: any = {
          model: modelProvider(actualModel),
          messages: [
            { 
              role: &apos;system&apos;, 
              content: systemPrompt + `

🚨 CRITICAL CODE GENERATION RULES - VIOLATION = FAILURE 🚨:
1. NEVER truncate ANY code - ALWAYS write COMPLETE files
2. NEVER use &quot;...&quot; anywhere in your code - this causes syntax errors
3. NEVER cut off strings mid-sentence - COMPLETE every string
4. NEVER leave incomplete class names or attributes
5. ALWAYS close ALL tags, quotes, brackets, and parentheses
6. If you run out of space, prioritize completing the current file

CRITICAL STRING RULES TO PREVENT SYNTAX ERRORS:
- NEVER write: className=&quot;px-8 py-4 bg-black text-white font-bold neobrut-border neobr...
- ALWAYS write: className=&quot;px-8 py-4 bg-black text-white font-bold neobrut-border neobrut-shadow&quot;
- COMPLETE every className attribute
- COMPLETE every string literal
- NO ellipsis (...) ANYWHERE in code

PACKAGE RULES:
- For INITIAL generation: Use ONLY React, no external packages
- For EDITS: You may use packages, specify them with &amp;lt;package&amp;gt; tags
- NEVER install packages like @mendable/firecrawl-js unless explicitly requested

Examples of SYNTAX ERRORS (NEVER DO THIS):
❌ className=&quot;px-4 py-2 bg-blue-600 hover:bg-blue-7...
❌ &amp;lt;button className=&quot;btn btn-primary btn-...
❌ const title = &quot;Welcome to our...
❌ import { useState, useEffect, ... } from &apos;react&apos;

Examples of CORRECT CODE (ALWAYS DO THIS):
✅ className=&quot;px-4 py-2 bg-blue-600 hover:bg-blue-700&quot;
✅ &amp;lt;button className=&quot;btn btn-primary btn-large&quot;&amp;gt;
✅ const title = &quot;Welcome to our application&quot;
✅ import { useState, useEffect, useCallback } from &apos;react&apos;

REMEMBER: It&apos;s better to generate fewer COMPLETE files than many INCOMPLETE files.`
            },
            { 
              role: &apos;user&apos;, 
              content: fullPrompt + `

CRITICAL: You MUST complete EVERY file you start. If you write:
&amp;lt;file path=&quot;src/components/Hero.jsx&quot;&amp;gt;

You MUST include the closing &amp;lt;/file&amp;gt; tag and ALL the code in between.

NEVER write partial code like:
&amp;lt;h1&amp;gt;Build and deploy on the AI Cloud.&amp;lt;/h1&amp;gt;
&amp;lt;p&amp;gt;Some text...&amp;lt;/p&amp;gt;  ❌ WRONG

ALWAYS write complete code:
&amp;lt;h1&amp;gt;Build and deploy on the AI Cloud.&amp;lt;/h1&amp;gt;
&amp;lt;p&amp;gt;Some text here with full content&amp;lt;/p&amp;gt;  ✅ CORRECT

If you&apos;re running out of space, generate FEWER files but make them COMPLETE.
It&apos;s better to have 3 complete files than 10 incomplete files.`
            }
          ],
          maxTokens: 8192, // Reduce to ensure completion
          stopSequences: [] // Don&apos;t stop early
          // Note: Neither Groq nor Anthropic models support tool/function calling in this context
          // We use XML tags for package detection instead
        };
        
        // Add temperature for non-reasoning models
        if (!model.startsWith(&apos;openai/gpt-5&apos;)) {
          streamOptions.temperature = 0.7;
        }
        
        // Add reasoning effort for GPT-5 models
        if (isOpenAI) {
          streamOptions.experimental_providerMetadata = {
            openai: {
              reasoningEffort: &apos;high&apos;
            }
          };
        }
        
        const result = await streamText(streamOptions);
        
        // Stream the response and parse in real-time
        let generatedCode = &apos;&apos;;
        let currentFile = &apos;&apos;;
        let currentFilePath = &apos;&apos;;
        let componentCount = 0;
        let isInFile = false;
        let isInTag = false;
        let conversationalBuffer = &apos;&apos;;
        
        // Buffer for incomplete tags
        let tagBuffer = &apos;&apos;;
        
        // Stream the response and parse for packages in real-time
        for await (const textPart of result.textStream) {
          const text = textPart || &apos;&apos;;
          generatedCode += text;
          currentFile += text;
          
          // Combine with buffer for tag detection
          const searchText = tagBuffer + text;
          
          // Log streaming chunks to console
          process.stdout.write(text);
          
          // Check if we&apos;re entering or leaving a tag
          const hasOpenTag = /&amp;lt;(file|package|packages|explanation|command|structure|template)\b/.test(text);
          const hasCloseTag = /&amp;lt;\/(file|package|packages|explanation|command|structure|template)&amp;gt;/.test(text);
          
          if (hasOpenTag) {
            // Send any buffered conversational text before the tag
            if (conversationalBuffer.trim() &amp;&amp; !isInTag) {
              await sendProgress({ 
                type: &apos;conversation&apos;, 
                text: conversationalBuffer.trim()
              });
              conversationalBuffer = &apos;&apos;;
            }
            isInTag = true;
          }
          
          if (hasCloseTag) {
            isInTag = false;
          }
          
          // If we&apos;re not in a tag, buffer as conversational text
          if (!isInTag &amp;&amp; !hasOpenTag) {
            conversationalBuffer += text;
          }
          
          // Stream the raw text for live preview
          await sendProgress({ 
            type: &apos;stream&apos;, 
            text: text,
            raw: true 
          });
          
          // Check for package tags in buffered text (ONLY for edits, not initial generation)
          let lastIndex = 0;
          if (isEdit) {
            const packageRegex = /&amp;lt;package&amp;gt;([^&amp;lt;]+)&amp;lt;\/package&amp;gt;/g;
            let packageMatch;
            
            while ((packageMatch = packageRegex.exec(searchText)) !== null) {
              const packageName = packageMatch[1].trim();
              if (packageName &amp;&amp; !packagesToInstall.includes(packageName)) {
                packagesToInstall.push(packageName);
                console.log(`[generate-ai-code-stream] Package detected: ${packageName}`);
                await sendProgress({ 
                  type: &apos;package&apos;, 
                  name: packageName,
                  message: `Package detected: ${packageName}`
                });
              }
              lastIndex = packageMatch.index + packageMatch[0].length;
            }
          }
          
          // Keep unmatched portion in buffer for next iteration
          tagBuffer = searchText.substring(Math.max(0, lastIndex - 50)); // Keep last 50 chars
          
          // Check for file boundaries
          if (text.includes(&apos;&amp;lt;file path=&quot;&apos;)) {
            const pathMatch = text.match(/&amp;lt;file path=&quot;([^&quot;]+)&quot;/);
            if (pathMatch) {
              currentFilePath = pathMatch[1];
              isInFile = true;
              currentFile = text;
            }
          }
          
          // Check for file end
          if (isInFile &amp;&amp; currentFile.includes(&apos;&amp;lt;/file&amp;gt;&apos;)) {
            isInFile = false;
            
            // Send component progress update
            if (currentFilePath.includes(&apos;components/&apos;)) {
              componentCount++;
              const componentName = currentFilePath.split(&apos;/&apos;).pop()?.replace(&apos;.jsx&apos;, &apos;&apos;) || &apos;Component&apos;;
              await sendProgress({ 
                type: &apos;component&apos;, 
                name: componentName,
                path: currentFilePath,
                index: componentCount
              });
            } else if (currentFilePath.includes(&apos;App.jsx&apos;)) {
              await sendProgress({ 
                type: &apos;app&apos;, 
                message: &apos;Generated main App.jsx&apos;,
                path: currentFilePath
              });
            }
            
            currentFile = &apos;&apos;;
            currentFilePath = &apos;&apos;;
          }
        }
        
        console.log(&apos;\n\n[generate-ai-code-stream] Streaming complete.&apos;);
        
        // Send any remaining conversational text
        if (conversationalBuffer.trim()) {
          await sendProgress({ 
            type: &apos;conversation&apos;, 
            text: conversationalBuffer.trim()
          });
        }
        
        // Also parse &amp;lt;packages&amp;gt; tag for multiple packages - ONLY for edits
        if (isEdit) {
          const packagesRegex = /&amp;lt;packages&amp;gt;([\s\S]*?)&amp;lt;\/packages&amp;gt;/g;
          let packagesMatch;
          while ((packagesMatch = packagesRegex.exec(generatedCode)) !== null) {
            const packagesContent = packagesMatch[1].trim();
            const packagesList = packagesContent.split(/[\n,]+/)
              .map(pkg =&amp;gt; pkg.trim())
              .filter(pkg =&amp;gt; pkg.length &amp;gt; 0);
            
            for (const packageName of packagesList) {
              if (!packagesToInstall.includes(packageName)) {
                packagesToInstall.push(packageName);
                console.log(`[generate-ai-code-stream] Package from &amp;lt;packages&amp;gt; tag: ${packageName}`);
                await sendProgress({ 
                  type: &apos;package&apos;, 
                  name: packageName,
                  message: `Package detected: ${packageName}`
                });
              }
            }
          }
        }
        
        // Function to extract packages from import statements
        function extractPackagesFromCode(content: string): string[] {
          const packages: string[] = [];
          // Match ES6 imports
          const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?[&apos;&quot;]([^&apos;&quot;]+)[&apos;&quot;]/g;
          let importMatch;
          
          while ((importMatch = importRegex.exec(content)) !== null) {
            const importPath = importMatch[1];
            // Skip relative imports and built-in React
            if (!importPath.startsWith(&apos;.&apos;) &amp;&amp; !importPath.startsWith(&apos;/&apos;) &amp;&amp; 
                importPath !== &apos;react&apos; &amp;&amp; importPath !== &apos;react-dom&apos; &amp;&amp;
                !importPath.startsWith(&apos;@/&apos;)) {
              // Extract package name (handle scoped packages like @heroicons/react)
              const packageName = importPath.startsWith(&apos;@&apos;) 
                ? importPath.split(&apos;/&apos;).slice(0, 2).join(&apos;/&apos;)
                : importPath.split(&apos;/&apos;)[0];
              
              if (!packages.includes(packageName)) {
                packages.push(packageName);
              }
            }
          }
          
          return packages;
        }
        
        // Parse files and send progress for each
        const fileRegex = /&amp;lt;file path=&quot;([^&quot;]+)&quot;&amp;gt;([\s\S]*?)&amp;lt;\/file&amp;gt;/g;
        const files = [];
        let match;
        
        while ((match = fileRegex.exec(generatedCode)) !== null) {
          const filePath = match[1];
          const content = match[2].trim();
          files.push({ path: filePath, content });
          
          // Extract packages from file content - ONLY for edits
          if (isEdit) {
            const filePackages = extractPackagesFromCode(content);
            for (const pkg of filePackages) {
              if (!packagesToInstall.includes(pkg)) {
                packagesToInstall.push(pkg);
                console.log(`[generate-ai-code-stream] Package detected from imports: ${pkg}`);
                await sendProgress({ 
                  type: &apos;package&apos;, 
                  name: pkg,
                  message: `Package detected from imports: ${pkg}`
                });
              }
            }
          }
          
          // Send progress for each file (reusing componentCount from streaming)
          if (filePath.includes(&apos;components/&apos;)) {
            const componentName = filePath.split(&apos;/&apos;).pop()?.replace(&apos;.jsx&apos;, &apos;&apos;) || &apos;Component&apos;;
            await sendProgress({ 
              type: &apos;component&apos;, 
              name: componentName,
              path: filePath,
              index: componentCount
            });
          } else if (filePath.includes(&apos;App.jsx&apos;)) {
            await sendProgress({ 
              type: &apos;app&apos;, 
              message: &apos;Generated main App.jsx&apos;,
              path: filePath
            });
          }
        }
        
        // Extract explanation
        const explanationMatch = generatedCode.match(/&amp;lt;explanation&amp;gt;([\s\S]*?)&amp;lt;\/explanation&amp;gt;/);
        const explanation = explanationMatch ? explanationMatch[1].trim() : &apos;Code generated successfully!&apos;;
        
        // Validate generated code for truncation issues
        const truncationWarnings: string[] = [];
        
        // Skip ellipsis checking entirely - too many false positives with spread operators, loading text, etc.
        
        // Check for unclosed file tags
        const fileOpenCount = (generatedCode.match(/&amp;lt;file path=&quot;/g) || []).length;
        const fileCloseCount = (generatedCode.match(/&amp;lt;\/file&amp;gt;/g) || []).length;
        if (fileOpenCount !== fileCloseCount) {
          truncationWarnings.push(`Unclosed file tags detected: ${fileOpenCount} open, ${fileCloseCount} closed`);
        }
        
        // Check for files that seem truncated (very short or ending abruptly)
        const truncationCheckRegex = /&amp;lt;file path=&quot;([^&quot;]+)&quot;&amp;gt;([\s\S]*?)(?:&amp;lt;\/file&amp;gt;|$)/g;
        let truncationMatch;
        while ((truncationMatch = truncationCheckRegex.exec(generatedCode)) !== null) {
          const filePath = truncationMatch[1];
          const content = truncationMatch[2];
          
          // Only check for really obvious HTML truncation - file ends with opening tag
          if (content.trim().endsWith(&apos;&amp;lt;&apos;) || content.trim().endsWith(&apos;&amp;lt;/&apos;)) {
            truncationWarnings.push(`File ${filePath} appears to have incomplete HTML tags`);
          }
          
          // Skip &quot;...&quot; check - too many false positives with loading text, etc.
          
          // Only check for SEVERE truncation issues
          if (filePath.match(/\.(jsx?|tsx?)$/)) {
            // Only check for severely unmatched brackets (more than 3 difference)
            const openBraces = (content.match(/{/g) || []).length;
            const closeBraces = (content.match(/}/g) || []).length;
            const braceDiff = Math.abs(openBraces - closeBraces);
            if (braceDiff &amp;gt; 3) { // Only flag severe mismatches
              truncationWarnings.push(`File ${filePath} has severely unmatched braces (${openBraces} open, ${closeBraces} closed)`);
            }
            
            // Check if file is extremely short and looks incomplete
            if (content.length &amp;lt; 20 &amp;&amp; content.includes(&apos;function&apos;) &amp;&amp; !content.includes(&apos;}&apos;)) {
              truncationWarnings.push(`File ${filePath} appears severely truncated`);
            }
          }
        }
        
        // Handle truncation with automatic retry (if enabled in config)
        if (truncationWarnings.length &amp;gt; 0 &amp;&amp; appConfig.codeApplication.enableTruncationRecovery) {
          console.warn(&apos;[generate-ai-code-stream] Truncation detected, attempting to fix:&apos;, truncationWarnings);
          
          await sendProgress({
            type: &apos;warning&apos;,
            message: &apos;Detected incomplete code generation. Attempting to complete...&apos;,
            warnings: truncationWarnings
          });
          
          // Try to fix truncated files automatically
          const truncatedFiles: string[] = [];
          const fileRegex = /&amp;lt;file path=&quot;([^&quot;]+)&quot;&amp;gt;([\s\S]*?)(?:&amp;lt;\/file&amp;gt;|$)/g;
          let match;
          
          while ((match = fileRegex.exec(generatedCode)) !== null) {
            const filePath = match[1];
            const content = match[2];
            
            // Check if this file appears truncated - be more selective
            const hasEllipsis = content.includes(&apos;...&apos;) &amp;&amp; 
                               !content.includes(&apos;...rest&apos;) &amp;&amp; 
                               !content.includes(&apos;...props&apos;) &amp;&amp;
                               !content.includes(&apos;spread&apos;);
                               
            const endsAbruptly = content.trim().endsWith(&apos;...&apos;) || 
                                 content.trim().endsWith(&apos;,&apos;) ||
                                 content.trim().endsWith(&apos;(&apos;);
                                 
            const hasUnclosedTags = content.includes(&apos;&amp;lt;/&apos;) &amp;&amp; 
                                    !content.match(/&amp;lt;\/[a-zA-Z0-9]+&amp;gt;/) &amp;&amp;
                                    content.includes(&apos;&amp;lt;&apos;);
                                    
            const tooShort = content.length &amp;lt; 50 &amp;&amp; filePath.match(/\.(jsx?|tsx?)$/);
            
            // Check for unmatched braces specifically
            const openBraceCount = (content.match(/{/g) || []).length;
            const closeBraceCount = (content.match(/}/g) || []).length;
            const hasUnmatchedBraces = Math.abs(openBraceCount - closeBraceCount) &amp;gt; 1;
            
            const isTruncated = (hasEllipsis &amp;&amp; endsAbruptly) || 
                               hasUnclosedTags || 
                               (tooShort &amp;&amp; !content.includes(&apos;export&apos;)) ||
                               hasUnmatchedBraces;
            
            if (isTruncated) {
              truncatedFiles.push(filePath);
            }
          }
          
          // If we have truncated files, try to regenerate them
          if (truncatedFiles.length &amp;gt; 0) {
            console.log(&apos;[generate-ai-code-stream] Attempting to regenerate truncated files:&apos;, truncatedFiles);
            
            for (const filePath of truncatedFiles) {
              await sendProgress({
                type: &apos;info&apos;,
                message: `Completing ${filePath}...`
              });
              
              try {
                // Create a focused prompt to complete just this file
                const completionPrompt = `Complete the following file that was truncated. Provide the FULL file content.
                
File: ${filePath}
Original request: ${prompt}
                
Provide the complete file content without any truncation. Include all necessary imports, complete all functions, and close all tags properly.`;
                
                // Make a focused API call to complete this specific file
                // Create a new client for the completion based on the provider
                let completionClient;
                if (model.includes(&apos;gpt&apos;) || model.includes(&apos;openai&apos;)) {
                  completionClient = openai;
                } else if (model.includes(&apos;claude&apos;)) {
                  completionClient = anthropic;
                } else {
                  completionClient = groq;
                }
                
                const completionResult = await streamText({
                  model: completionClient(model),
                  messages: [
                    { 
                      role: &apos;system&apos;, 
                      content: &apos;You are completing a truncated file. Provide the complete, working file content.&apos;
                    },
                    { role: &apos;user&apos;, content: completionPrompt }
                  ],
                  temperature: appConfig.ai.defaultTemperature
                });
                
                // Get the full text from the stream
                let completedContent = &apos;&apos;;
                for await (const chunk of completionResult.textStream) {
                  completedContent += chunk;
                }
                
                // Replace the truncated file in the generatedCode
                const filePattern = new RegExp(
                  `&amp;lt;file path=&quot;${filePath.replace(/[.*+?^${}()|[\]\\]/g, &apos;\\$&amp;&apos;)}&quot;&amp;gt;[\\s\\S]*?(?:&amp;lt;/file&amp;gt;|$)`,
                  &apos;g&apos;
                );
                
                // Extract just the code content (remove any markdown or explanation)
                let cleanContent = completedContent;
                if (cleanContent.includes(&apos;```&apos;)) {
                  const codeMatch = cleanContent.match(/```[\w]*\n([\s\S]*?)```/);
                  if (codeMatch) {
                    cleanContent = codeMatch[1];
                  }
                }
                
                generatedCode = generatedCode.replace(
                  filePattern,
                  `&amp;lt;file path=&quot;${filePath}&quot;&amp;gt;\n${cleanContent}\n&amp;lt;/file&amp;gt;`
                );
                
                console.log(`[generate-ai-code-stream] Successfully completed ${filePath}`);
                
              } catch (completionError) {
                console.error(`[generate-ai-code-stream] Failed to complete ${filePath}:`, completionError);
                await sendProgress({
                  type: &apos;warning&apos;,
                  message: `Could not auto-complete ${filePath}. Manual review may be needed.`
                });
              }
            }
            
            // Clear the warnings after attempting fixes
            truncationWarnings.length = 0;
            await sendProgress({
              type: &apos;info&apos;,
              message: &apos;Truncation recovery complete&apos;
            });
          }
        }
        
        // Send completion with packages info
        await sendProgress({ 
          type: &apos;complete&apos;, 
          generatedCode,
          explanation,
          files: files.length,
          components: componentCount,
          model,
          packagesToInstall: packagesToInstall.length &amp;gt; 0 ? packagesToInstall : undefined,
          warnings: truncationWarnings.length &amp;gt; 0 ? truncationWarnings : undefined
        });
        
        // Track edit in conversation history
        if (isEdit &amp;&amp; editContext &amp;&amp; global.conversationState) {
          const editRecord: ConversationEdit = {
            timestamp: Date.now(),
            userRequest: prompt,
            editType: editContext.editIntent.type,
            targetFiles: editContext.primaryFiles,
            confidence: editContext.editIntent.confidence,
            outcome: &apos;success&apos; // Assuming success if we got here
          };
          
          global.conversationState.context.edits.push(editRecord);
          
          // Track major changes
          if (editContext.editIntent.type === &apos;ADD_FEATURE&apos; || files.length &amp;gt; 3) {
            global.conversationState.context.projectEvolution.majorChanges.push({
              timestamp: Date.now(),
              description: editContext.editIntent.description,
              filesAffected: editContext.primaryFiles
            });
          }
          
          // Update last updated timestamp
          global.conversationState.lastUpdated = Date.now();
          
          console.log(&apos;[generate-ai-code-stream] Updated conversation history with edit:&apos;, editRecord);
        }
        
      } catch (error) {
        console.error(&apos;[generate-ai-code-stream] Stream processing error:&apos;, error);
        
        // Check if it&apos;s a tool validation error
        if ((error as any).message?.includes(&apos;tool call validation failed&apos;)) {
          console.error(&apos;[generate-ai-code-stream] Tool call validation error - this may be due to the AI model sending incorrect parameters&apos;);
          await sendProgress({ 
            type: &apos;warning&apos;, 
            message: &apos;Package installation tool encountered an issue. Packages will be detected from imports instead.&apos;
          });
          // Continue processing - packages can still be detected from the code
        } else {
          await sendProgress({ 
            type: &apos;error&apos;, 
            error: (error as Error).message 
          });
        }
      } finally {
        await writer.close();
      }
    })();
    
    // Return the stream
    return new Response(stream.readable, {
      headers: {
        &apos;Content-Type&apos;: &apos;text/event-stream&apos;,
        &apos;Cache-Control&apos;: &apos;no-cache&apos;,
        &apos;Connection&apos;: &apos;keep-alive&apos;,
      },
    });
    
  } catch (error) {
    console.error(&apos;[generate-ai-code-stream] Error:&apos;, error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}