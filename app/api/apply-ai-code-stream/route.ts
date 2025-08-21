export const dynamic = &quot;force-static&quot;;


import { NextRequest, NextResponse } from &apos;next/server&apos;;
import { Sandbox } from &apos;@e2b/code-interpreter&apos;;
import type { SandboxState } from &apos;@/types/sandbox&apos;;
import type { ConversationState } from &apos;@/types/conversation&apos;;

declare global {
  var conversationState: ConversationState | null;
  var activeSandbox: any;
  var existingFiles: Set&amp;lt;string&amp;gt;;
  var sandboxState: SandboxState;
}

interface ParsedResponse {
  explanation: string;
  template: string;
  files: Array&amp;lt;{ path: string; content: string }&amp;gt;;
  packages: string[];
  commands: string[];
  structure: string | null;
}

function parseAIResponse(response: string): ParsedResponse {
  const sections = {
    files: [] as Array&amp;lt;{ path: string; content: string }&amp;gt;,
    commands: [] as string[],
    packages: [] as string[],
    structure: null as string | null,
    explanation: &apos;&apos;,
    template: &apos;&apos;
  };
  
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
          
          // Log important packages for debugging
          if (packageName === &apos;react-router-dom&apos; || packageName.includes(&apos;router&apos;) || packageName.includes(&apos;icon&apos;)) {
            console.log(`[apply-ai-code-stream] Detected package from imports: ${packageName}`);
          }
        }
      }
    }
    
    return packages;
  }

  // Parse file sections - handle duplicates and prefer complete versions
  const fileMap = new Map&amp;lt;string, { content: string; isComplete: boolean }&amp;gt;();
  
  // First pass: Find all file declarations
  const fileRegex = /&amp;lt;file path=&quot;([^&quot;]+)&quot;&amp;gt;([\s\S]*?)(?:&amp;lt;\/file&amp;gt;|$)/g;
  let match;
  while ((match = fileRegex.exec(response)) !== null) {
    const filePath = match[1];
    const content = match[2].trim();
    const hasClosingTag = response.substring(match.index, match.index + match[0].length).includes(&apos;&amp;lt;/file&amp;gt;&apos;);
    
    // Check if this file already exists in our map
    const existing = fileMap.get(filePath);
    
    // Decide whether to keep this version
    let shouldReplace = false;
    if (!existing) {
      shouldReplace = true; // First occurrence
    } else if (!existing.isComplete &amp;&amp; hasClosingTag) {
      shouldReplace = true; // Replace incomplete with complete
      console.log(`[apply-ai-code-stream] Replacing incomplete ${filePath} with complete version`);
    } else if (existing.isComplete &amp;&amp; hasClosingTag &amp;&amp; content.length &amp;gt; existing.content.length) {
      shouldReplace = true; // Replace with longer complete version
      console.log(`[apply-ai-code-stream] Replacing ${filePath} with longer complete version`);
    } else if (!existing.isComplete &amp;&amp; !hasClosingTag &amp;&amp; content.length &amp;gt; existing.content.length) {
      shouldReplace = true; // Both incomplete, keep longer one
    }
    
    if (shouldReplace) {
      // Additional validation: reject obviously broken content
      if (content.includes(&apos;...&apos;) &amp;&amp; !content.includes(&apos;...props&apos;) &amp;&amp; !content.includes(&apos;...rest&apos;)) {
        console.warn(`[apply-ai-code-stream] Warning: ${filePath} contains ellipsis, may be truncated`);
        // Still use it if it&apos;s the only version we have
        if (!existing) {
          fileMap.set(filePath, { content, isComplete: hasClosingTag });
        }
      } else {
        fileMap.set(filePath, { content, isComplete: hasClosingTag });
      }
    }
  }
  
  // Convert map to array for sections.files
  for (const [path, { content, isComplete }] of fileMap.entries()) {
    if (!isComplete) {
      console.log(`[apply-ai-code-stream] Warning: File ${path} appears to be truncated (no closing tag)`);
    }
    
    sections.files.push({
      path,
      content
    });
    
    // Extract packages from file content
    const filePackages = extractPackagesFromCode(content);
    for (const pkg of filePackages) {
      if (!sections.packages.includes(pkg)) {
        sections.packages.push(pkg);
        console.log(`[apply-ai-code-stream] 📦 Package detected from imports: ${pkg}`);
      }
    }
  }
  
  // Also parse markdown code blocks with file paths
  const markdownFileRegex = /```(?:file )?path=&quot;([^&quot;]+)&quot;\n([\s\S]*?)```/g;
  while ((match = markdownFileRegex.exec(response)) !== null) {
    const filePath = match[1];
    const content = match[2].trim();
    sections.files.push({
      path: filePath,
      content: content
    });
    
    // Extract packages from file content
    const filePackages = extractPackagesFromCode(content);
    for (const pkg of filePackages) {
      if (!sections.packages.includes(pkg)) {
        sections.packages.push(pkg);
        console.log(`[apply-ai-code-stream] 📦 Package detected from imports: ${pkg}`);
      }
    }
  }
  
  // Parse plain text format like &quot;Generated Files: Header.jsx, index.css&quot;
  const generatedFilesMatch = response.match(/Generated Files?:\s*([^\n]+)/i);
  if (generatedFilesMatch) {
    // Split by comma first, then trim whitespace, to preserve filenames with dots
    const filesList = generatedFilesMatch[1]
      .split(&apos;,&apos;)
      .map(f =&amp;gt; f.trim())
      .filter(f =&amp;gt; f.endsWith(&apos;.jsx&apos;) || f.endsWith(&apos;.js&apos;) || f.endsWith(&apos;.tsx&apos;) || f.endsWith(&apos;.ts&apos;) || f.endsWith(&apos;.css&apos;) || f.endsWith(&apos;.json&apos;) || f.endsWith(&apos;.html&apos;));
    console.log(`[apply-ai-code-stream] Detected generated files from plain text: ${filesList.join(&apos;, &apos;)}`);
    
    // Try to extract the actual file content if it follows
    for (const fileName of filesList) {
      // Look for the file content after the file name
      const fileContentRegex = new RegExp(`${fileName}[\\s\\S]*?(?:import[\\s\\S]+?)(?=Generated Files:|Applying code|$)`, &apos;i&apos;);
      const fileContentMatch = response.match(fileContentRegex);
      if (fileContentMatch) {
        // Extract just the code part (starting from import statements)
        const codeMatch = fileContentMatch[0].match(/^(import[\s\S]+)$/m);
        if (codeMatch) {
          const filePath = fileName.includes(&apos;/&apos;) ? fileName : `src/components/${fileName}`;
          sections.files.push({
            path: filePath,
            content: codeMatch[1].trim()
          });
          console.log(`[apply-ai-code-stream] Extracted content for ${filePath}`);
          
          // Extract packages from this file
          const filePackages = extractPackagesFromCode(codeMatch[1]);
          for (const pkg of filePackages) {
            if (!sections.packages.includes(pkg)) {
              sections.packages.push(pkg);
              console.log(`[apply-ai-code-stream] Package detected from imports: ${pkg}`);
            }
          }
        }
      }
    }
  }
  
  // Also try to parse if the response contains raw JSX/JS code blocks
  const codeBlockRegex = /```(?:jsx?|tsx?|javascript|typescript)?\n([\s\S]*?)```/g;
  while ((match = codeBlockRegex.exec(response)) !== null) {
    const content = match[1].trim();
    // Try to detect the file name from comments or context
    const fileNameMatch = content.match(/\/\/\s*(?:File:|Component:)\s*([^\n]+)/);
    if (fileNameMatch) {
      const fileName = fileNameMatch[1].trim();
      const filePath = fileName.includes(&apos;/&apos;) ? fileName : `src/components/${fileName}`;
      
      // Don&apos;t add duplicate files
      if (!sections.files.some(f =&amp;gt; f.path === filePath)) {
        sections.files.push({
          path: filePath,
          content: content
        });
        
        // Extract packages
        const filePackages = extractPackagesFromCode(content);
        for (const pkg of filePackages) {
          if (!sections.packages.includes(pkg)) {
            sections.packages.push(pkg);
          }
        }
      }
    }
  }

  // Parse commands
  const cmdRegex = /&amp;lt;command&amp;gt;(.*?)&amp;lt;\/command&amp;gt;/g;
  while ((match = cmdRegex.exec(response)) !== null) {
    sections.commands.push(match[1].trim());
  }

  // Parse packages - support both &amp;lt;package&amp;gt; and &amp;lt;packages&amp;gt; tags
  const pkgRegex = /&amp;lt;package&amp;gt;(.*?)&amp;lt;\/package&amp;gt;/g;
  while ((match = pkgRegex.exec(response)) !== null) {
    sections.packages.push(match[1].trim());
  }
  
  // Also parse &amp;lt;packages&amp;gt; tag with multiple packages
  const packagesRegex = /&amp;lt;packages&amp;gt;([\s\S]*?)&amp;lt;\/packages&amp;gt;/;
  const packagesMatch = response.match(packagesRegex);
  if (packagesMatch) {
    const packagesContent = packagesMatch[1].trim();
    // Split by newlines or commas
    const packagesList = packagesContent.split(/[\n,]+/)
      .map(pkg =&amp;gt; pkg.trim())
      .filter(pkg =&amp;gt; pkg.length &amp;gt; 0);
    sections.packages.push(...packagesList);
  }

  // Parse structure
  const structureMatch = /&amp;lt;structure&amp;gt;([\s\S]*?)&amp;lt;\/structure&amp;gt;/;
  const structResult = response.match(structureMatch);
  if (structResult) {
    sections.structure = structResult[1].trim();
  }

  // Parse explanation
  const explanationMatch = /&amp;lt;explanation&amp;gt;([\s\S]*?)&amp;lt;\/explanation&amp;gt;/;
  const explResult = response.match(explanationMatch);
  if (explResult) {
    sections.explanation = explResult[1].trim();
  }

  // Parse template
  const templateMatch = /&amp;lt;template&amp;gt;(.*?)&amp;lt;\/template&amp;gt;/;
  const templResult = response.match(templateMatch);
  if (templResult) {
    sections.template = templResult[1].trim();
  }

  return sections;
}

export async function POST(request: NextRequest) {
  try {
    const { response, isEdit = false, packages = [], sandboxId } = await request.json();
    
    if (!response) {
      return NextResponse.json({
        error: &apos;response is required&apos;
      }, { status: 400 });
    }
    
    // Debug log the response
    console.log(&apos;[apply-ai-code-stream] Received response to parse:&apos;);
    console.log(&apos;[apply-ai-code-stream] Response length:&apos;, response.length);
    console.log(&apos;[apply-ai-code-stream] Response preview:&apos;, response.substring(0, 500));
    console.log(&apos;[apply-ai-code-stream] isEdit:&apos;, isEdit);
    console.log(&apos;[apply-ai-code-stream] packages:&apos;, packages);
    
    // Parse the AI response
    const parsed = parseAIResponse(response);
    
    // Log what was parsed
    console.log(&apos;[apply-ai-code-stream] Parsed result:&apos;);
    console.log(&apos;[apply-ai-code-stream] Files found:&apos;, parsed.files.length);
    if (parsed.files.length &amp;gt; 0) {
      parsed.files.forEach(f =&amp;gt; {
        console.log(`[apply-ai-code-stream] - ${f.path} (${f.content.length} chars)`);
      });
    }
    console.log(&apos;[apply-ai-code-stream] Packages found:&apos;, parsed.packages);
    
    // Initialize existingFiles if not already
    if (!global.existingFiles) {
      global.existingFiles = new Set&amp;lt;string&amp;gt;();
    }
    
    // First, always check the global state for active sandbox
    let sandbox = global.activeSandbox;
    
    // If we don&apos;t have a sandbox in this instance but we have a sandboxId,
    // reconnect to the existing sandbox
    if (!sandbox &amp;&amp; sandboxId) {
      console.log(`[apply-ai-code-stream] Sandbox ${sandboxId} not in this instance, attempting reconnect...`);
      
      try {
        // Reconnect to the existing sandbox using E2B&apos;s connect method
        sandbox = await Sandbox.connect(sandboxId, { apiKey: process.env.E2B_API_KEY });
        console.log(`[apply-ai-code-stream] Successfully reconnected to sandbox ${sandboxId}`);
        
        // Store the reconnected sandbox globally for this instance
        global.activeSandbox = sandbox;
        
        // Update sandbox data if needed
        if (!global.sandboxData) {
          const host = (sandbox as any).getHost(5173);
          global.sandboxData = {
            sandboxId,
            url: `https://${host}`
          };
        }
        
        // Initialize existingFiles if not already
        if (!global.existingFiles) {
          global.existingFiles = new Set&amp;lt;string&amp;gt;();
        }
      } catch (reconnectError) {
        console.error(`[apply-ai-code-stream] Failed to reconnect to sandbox ${sandboxId}:`, reconnectError);
        
        // If reconnection fails, we&apos;ll still try to return a meaningful response
        return NextResponse.json({
          success: false,
          error: `Failed to reconnect to sandbox ${sandboxId}. The sandbox may have expired or been terminated.`,
          results: {
            filesCreated: [],
            packagesInstalled: [],
            commandsExecuted: [],
            errors: [`Sandbox reconnection failed: ${(reconnectError as Error).message}`]
          },
          explanation: parsed.explanation,
          structure: parsed.structure,
          parsedFiles: parsed.files,
          message: `Parsed ${parsed.files.length} files but couldn&apos;t apply them - sandbox reconnection failed.`
        });
      }
    }
    
    // If no sandbox at all and no sandboxId provided, return an error
    if (!sandbox &amp;&amp; !sandboxId) {
      console.log(&apos;[apply-ai-code-stream] No sandbox available and no sandboxId provided&apos;);
      return NextResponse.json({
        success: false,
        error: &apos;No active sandbox found. Please create a sandbox first.&apos;,
        results: {
          filesCreated: [],
          packagesInstalled: [],
          commandsExecuted: [],
          errors: [&apos;No sandbox available&apos;]
        },
        explanation: parsed.explanation,
        structure: parsed.structure,
        parsedFiles: parsed.files,
        message: `Parsed ${parsed.files.length} files but no sandbox available to apply them.`
      });
    }
    
    // Create a response stream for real-time updates
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    
    // Function to send progress updates
    const sendProgress = async (data: any) =&amp;gt; {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(message));
    };
    
    // Start processing in background (pass sandbox and request to the async function)
    (async (sandboxInstance, req) =&amp;gt; {
      const results = {
        filesCreated: [] as string[],
        filesUpdated: [] as string[],
        packagesInstalled: [] as string[],
        packagesAlreadyInstalled: [] as string[],
        packagesFailed: [] as string[],
        commandsExecuted: [] as string[],
        errors: [] as string[]
      };
      
      try {
        await sendProgress({ 
          type: &apos;start&apos;, 
          message: &apos;Starting code application...&apos;,
          totalSteps: 3
        });
        
        // Step 1: Install packages
        const packagesArray = Array.isArray(packages) ? packages : [];
        const parsedPackages = Array.isArray(parsed.packages) ? parsed.packages : [];
        
        // Combine and deduplicate packages
        const allPackages = [...packagesArray.filter(pkg =&amp;gt; pkg &amp;&amp; typeof pkg === &apos;string&apos;), ...parsedPackages];
        
        // Use Set to remove duplicates, then filter out pre-installed packages
        const uniquePackages = [...new Set(allPackages)]
          .filter(pkg =&amp;gt; pkg &amp;&amp; typeof pkg === &apos;string&apos; &amp;&amp; pkg.trim() !== &apos;&apos;) // Remove empty strings
          .filter(pkg =&amp;gt; pkg !== &apos;react&apos; &amp;&amp; pkg !== &apos;react-dom&apos;); // Filter pre-installed
        
        // Log if we found duplicates
        if (allPackages.length !== uniquePackages.length) {
          console.log(`[apply-ai-code-stream] Removed ${allPackages.length - uniquePackages.length} duplicate packages`);
          console.log(`[apply-ai-code-stream] Original packages:`, allPackages);
          console.log(`[apply-ai-code-stream] Deduplicated packages:`, uniquePackages);
        }
        
        if (uniquePackages.length &amp;gt; 0) {
          await sendProgress({ 
            type: &apos;step&apos;, 
            step: 1,
            message: `Installing ${uniquePackages.length} packages...`,
            packages: uniquePackages
          });
          
          // Use streaming package installation
          try {
            // Construct the API URL properly for both dev and production
            const protocol = process.env.NODE_ENV === &apos;production&apos; ? &apos;https&apos; : &apos;http&apos;;
            const host = req.headers.get(&apos;host&apos;) || &apos;localhost:3000&apos;;
            const apiUrl = `${protocol}://${host}/api/install-packages`;
            
            const installResponse = await fetch(apiUrl, {
              method: &apos;POST&apos;,
              headers: { &apos;Content-Type&apos;: &apos;application/json&apos; },
              body: JSON.stringify({ 
                packages: uniquePackages,
                sandboxId: sandboxId || (sandboxInstance as any).sandboxId
              })
            });
            
            if (installResponse.ok &amp;&amp; installResponse.body) {
              const reader = installResponse.body.getReader();
              const decoder = new TextDecoder();
              
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                if (!chunk) continue;
                const lines = chunk.split(&apos;\n&apos;);
                
                for (const line of lines) {
                  if (line.startsWith(&apos;data: &apos;)) {
                    try {
                      const data = JSON.parse(line.slice(6));
                      
                      // Forward package installation progress
                      await sendProgress({
                        type: &apos;package-progress&apos;,
                        ...data
                      });
                      
                      // Track results
                      if (data.type === &apos;success&apos; &amp;&amp; data.installedPackages) {
                        results.packagesInstalled = data.installedPackages;
                      }
                    } catch (e) {
                      // Ignore parse errors
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error(&apos;[apply-ai-code-stream] Error installing packages:&apos;, error);
            await sendProgress({
              type: &apos;warning&apos;,
              message: `Package installation skipped (${(error as Error).message}). Continuing with file creation...`
            });
            results.errors.push(`Package installation failed: ${(error as Error).message}`);
          }
        } else {
          await sendProgress({ 
            type: &apos;step&apos;, 
            step: 1,
            message: &apos;No additional packages to install, skipping...&apos;
          });
        }
        
        // Step 2: Create/update files
        const filesArray = Array.isArray(parsed.files) ? parsed.files : [];
        await sendProgress({ 
          type: &apos;step&apos;, 
          step: 2,
          message: `Creating ${filesArray.length} files...`
        });
        
        // Filter out config files that shouldn&apos;t be created
        const configFiles = [&apos;tailwind.config.js&apos;, &apos;vite.config.js&apos;, &apos;package.json&apos;, &apos;package-lock.json&apos;, &apos;tsconfig.json&apos;, &apos;postcss.config.js&apos;];
        const filteredFiles = filesArray.filter(file =&amp;gt; {
          if (!file || typeof file !== &apos;object&apos;) return false;
          const fileName = (file.path || &apos;&apos;).split(&apos;/&apos;).pop() || &apos;&apos;;
          return !configFiles.includes(fileName);
        });
        
        for (const [index, file] of filteredFiles.entries()) {
          try {
            // Send progress for each file
            await sendProgress({
              type: &apos;file-progress&apos;,
              current: index + 1,
              total: filteredFiles.length,
              fileName: file.path,
              action: &apos;creating&apos;
            });
            
            // Normalize the file path
            let normalizedPath = file.path;
            if (normalizedPath.startsWith(&apos;/&apos;)) {
              normalizedPath = normalizedPath.substring(1);
            }
            if (!normalizedPath.startsWith(&apos;src/&apos;) &amp;&amp; 
                !normalizedPath.startsWith(&apos;public/&apos;) &amp;&amp; 
                normalizedPath !== &apos;index.html&apos; &amp;&amp; 
                !configFiles.includes(normalizedPath.split(&apos;/&apos;).pop() || &apos;&apos;)) {
              normalizedPath = &apos;src/&apos; + normalizedPath;
            }
            
            const fullPath = `/home/user/app/${normalizedPath}`;
            const isUpdate = global.existingFiles.has(normalizedPath);
            
            // Remove any CSS imports from JSX/JS files (we&apos;re using Tailwind)
            let fileContent = file.content;
            if (file.path.endsWith(&apos;.jsx&apos;) || file.path.endsWith(&apos;.js&apos;) || file.path.endsWith(&apos;.tsx&apos;) || file.path.endsWith(&apos;.ts&apos;)) {
              fileContent = fileContent.replace(/import\s+[&apos;&quot;]\.\/[^&apos;&quot;]+\.css[&apos;&quot;];?\s*\n?/g, &apos;&apos;);
            }
            
            // Write the file using Python (code-interpreter SDK)
            const escapedContent = fileContent
              .replace(/\\/g, &apos;\\\\&apos;)
              .replace(/&quot;&quot;&quot;/g, &apos;\\&quot;\\&quot;\\&quot;&apos;)
              .replace(/\$/g, &apos;\\$&apos;);
            
            await sandboxInstance.runCode(`
import os
os.makedirs(os.path.dirname(&quot;${fullPath}&quot;), exist_ok=True)
with open(&quot;${fullPath}&quot;, &apos;w&apos;) as f:
    f.write(&quot;&quot;&quot;${escapedContent}&quot;&quot;&quot;)
print(f&quot;File written: ${fullPath}&quot;)
            `);
            
            // Update file cache
            if (global.sandboxState?.fileCache) {
              global.sandboxState.fileCache.files[normalizedPath] = {
                content: fileContent,
                lastModified: Date.now()
              };
            }
            
            if (isUpdate) {
              if (results.filesUpdated) results.filesUpdated.push(normalizedPath);
            } else {
              if (results.filesCreated) results.filesCreated.push(normalizedPath);
              if (global.existingFiles) global.existingFiles.add(normalizedPath);
            }
            
            await sendProgress({
              type: &apos;file-complete&apos;,
              fileName: normalizedPath,
              action: isUpdate ? &apos;updated&apos; : &apos;created&apos;
            });
          } catch (error) {
            if (results.errors) {
              results.errors.push(`Failed to create ${file.path}: ${(error as Error).message}`);
            }
            await sendProgress({
              type: &apos;file-error&apos;,
              fileName: file.path,
              error: (error as Error).message
            });
          }
        }
        
        // Step 3: Execute commands
        const commandsArray = Array.isArray(parsed.commands) ? parsed.commands : [];
        if (commandsArray.length &amp;gt; 0) {
          await sendProgress({ 
            type: &apos;step&apos;, 
            step: 3,
            message: `Executing ${commandsArray.length} commands...`
          });
          
          for (const [index, cmd] of commandsArray.entries()) {
            try {
              await sendProgress({
                type: &apos;command-progress&apos;,
                current: index + 1,
                total: parsed.commands.length,
                command: cmd,
                action: &apos;executing&apos;
              });
              
              // Use E2B commands.run() for cleaner execution
              const result = await sandboxInstance.commands.run(cmd, {
                cwd: &apos;/home/user/app&apos;,
                timeout: 60,
                on_stdout: async (data: string) =&amp;gt; {
                  await sendProgress({
                    type: &apos;command-output&apos;,
                    command: cmd,
                    output: data,
                    stream: &apos;stdout&apos;
                  });
                },
                on_stderr: async (data: string) =&amp;gt; {
                  await sendProgress({
                    type: &apos;command-output&apos;,
                    command: cmd,
                    output: data,
                    stream: &apos;stderr&apos;
                  });
                }
              });
              
              if (results.commandsExecuted) {
                results.commandsExecuted.push(cmd);
              }
              
              await sendProgress({
                type: &apos;command-complete&apos;,
                command: cmd,
                exitCode: result.exitCode,
                success: result.exitCode === 0
              });
            } catch (error) {
              if (results.errors) {
                results.errors.push(`Failed to execute ${cmd}: ${(error as Error).message}`);
              }
              await sendProgress({
                type: &apos;command-error&apos;,
                command: cmd,
                error: (error as Error).message
              });
            }
          }
        }
        
        // Send final results
        await sendProgress({
          type: &apos;complete&apos;,
          results,
          explanation: parsed.explanation,
          structure: parsed.structure,
          message: `Successfully applied ${results.filesCreated.length} files`
        });
        
        // Track applied files in conversation state
        if (global.conversationState &amp;&amp; results.filesCreated.length &amp;gt; 0) {
          const messages = global.conversationState.context.messages;
          if (messages.length &amp;gt; 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.role === &apos;user&apos;) {
              lastMessage.metadata = {
                ...lastMessage.metadata,
                editedFiles: results.filesCreated
              };
            }
          }
          
          // Track applied code in project evolution
          if (global.conversationState.context.projectEvolution) {
            global.conversationState.context.projectEvolution.majorChanges.push({
              timestamp: Date.now(),
              description: parsed.explanation || &apos;Code applied&apos;,
              filesAffected: results.filesCreated || []
            });
          }
          
          global.conversationState.lastUpdated = Date.now();
        }
        
      } catch (error) {
        await sendProgress({
          type: &apos;error&apos;,
          error: (error as Error).message
        });
      } finally {
        await writer.close();
      }
    })(sandbox, request);
    
    // Return the stream
    return new Response(stream.readable, {
      headers: {
        &apos;Content-Type&apos;: &apos;text/event-stream&apos;,
        &apos;Cache-Control&apos;: &apos;no-cache&apos;,
        &apos;Connection&apos;: &apos;keep-alive&apos;,
      },
    });
    
  } catch (error) {
    console.error(&apos;Apply AI code stream error:&apos;, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : &apos;Failed to parse AI code&apos; },
      { status: 500 }
    );
  }
}