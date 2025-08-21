&apos;use client&apos;;

import { useState, useEffect, useRef, Suspense } from &apos;react&apos;;
import { useSearchParams, useRouter } from &apos;next/navigation&apos;;
import { appConfig } from &apos;@/config/app.config&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Textarea } from &apos;@/components/ui/textarea&apos;;
import { Prism as SyntaxHighlighter } from &apos;react-syntax-highlighter&apos;;
import { vscDarkPlus } from &apos;react-syntax-highlighter/dist/esm/styles/prism&apos;;
// Import icons from centralized module to avoid Turbopack chunk issues
import { 
  FiFile, 
  FiChevronRight, 
  FiChevronDown,
  FiGithub,
  BsFolderFill, 
  BsFolder2Open,
  SiJavascript, 
  SiReact, 
  SiCss3, 
  SiJson 
} from &apos;@/lib/icons&apos;;
import { motion, AnimatePresence } from &apos;framer-motion&apos;;
import CodeApplicationProgress, { type CodeApplicationState } from &apos;@/components/CodeApplicationProgress&apos;;

interface SandboxData {
  sandboxId: string;
  url: string;
  [key: string]: any;
}

interface ChatMessage {
  content: string;
  type: &apos;user&apos; | &apos;ai&apos; | &apos;system&apos; | &apos;file-update&apos; | &apos;command&apos; | &apos;error&apos;;
  timestamp: Date;
  metadata?: {
    scrapedUrl?: string;
    scrapedContent?: any;
    generatedCode?: string;
    appliedFiles?: string[];
    commandType?: &apos;input&apos; | &apos;output&apos; | &apos;error&apos; | &apos;success&apos;;
  };
}

function AISandboxPageContent() {
  const [sandboxData, setSandboxData] = useState&amp;lt;SandboxData | null&amp;gt;(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ text: &apos;Not connected&apos;, active: false });
  const [responseArea, setResponseArea] = useState&amp;lt;string[]&amp;gt;([]);
  const [structureContent, setStructureContent] = useState(&apos;No sandbox created yet&apos;);
  const [promptInput, setPromptInput] = useState(&apos;&apos;);
  const [chatMessages, setChatMessages] = useState&amp;lt;ChatMessage[]&amp;gt;([
    {
      content: &apos;Welcome! I can help you generate code with full context of your sandbox files and structure. Just start chatting - I\&apos;ll automatically create a sandbox for you if needed!\n\nTip: If you see package errors like &quot;react-router-dom not found&quot;, just type &quot;npm install&quot; or &quot;check packages&quot; to automatically install missing packages.&apos;,
      type: &apos;system&apos;,
      timestamp: new Date()
    }
  ]);
  const [aiChatInput, setAiChatInput] = useState(&apos;&apos;);
  const [aiEnabled] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [aiModel, setAiModel] = useState(() =&amp;gt; {
    const modelParam = searchParams.get(&apos;model&apos;);
    return appConfig.ai.availableModels.includes(modelParam || &apos;&apos;) ? modelParam! : appConfig.ai.defaultModel;
  });
  const [urlOverlayVisible, setUrlOverlayVisible] = useState(false);
  const [urlInput, setUrlInput] = useState(&apos;&apos;);
  const [urlStatus, setUrlStatus] = useState&amp;lt;string[]&amp;gt;([]);
  const [showHomeScreen, setShowHomeScreen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState&amp;lt;Set&amp;lt;string&amp;gt;&amp;gt;(new Set([&apos;app&apos;, &apos;src&apos;, &apos;src/components&apos;]));
  const [selectedFile, setSelectedFile] = useState&amp;lt;string | null&amp;gt;(null);
  const [homeScreenFading, setHomeScreenFading] = useState(false);
  const [homeUrlInput, setHomeUrlInput] = useState(&apos;&apos;);
  const [homeContextInput, setHomeContextInput] = useState(&apos;&apos;);
  const [activeTab, setActiveTab] = useState&amp;lt;&apos;generation&apos; | &apos;preview&apos;&amp;gt;(&apos;preview&apos;);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState&amp;lt;string | null&amp;gt;(null);
  const [showLoadingBackground, setShowLoadingBackground] = useState(false);
  const [urlScreenshot, setUrlScreenshot] = useState&amp;lt;string | null&amp;gt;(null);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [screenshotError, setScreenshotError] = useState&amp;lt;string | null&amp;gt;(null);
  const [isPreparingDesign, setIsPreparingDesign] = useState(false);
  const [targetUrl, setTargetUrl] = useState&amp;lt;string&amp;gt;(&apos;&apos;);
  const [loadingStage, setLoadingStage] = useState&amp;lt;&apos;gathering&apos; | &apos;planning&apos; | &apos;generating&apos; | null&amp;gt;(null);
  const [sandboxFiles, setSandboxFiles] = useState&amp;lt;Record&amp;lt;string, string&amp;gt;&amp;gt;({});
  const [fileStructure, setFileStructure] = useState&amp;lt;string&amp;gt;(&apos;&apos;);
  
  const [conversationContext, setConversationContext] = useState&amp;lt;{
    scrapedWebsites: Array&amp;lt;{ url: string; content: any; timestamp: Date }&amp;gt;;
    generatedComponents: Array&amp;lt;{ name: string; path: string; content: string }&amp;gt;;
    appliedCode: Array&amp;lt;{ files: string[]; timestamp: Date }&amp;gt;;
    currentProject: string;
    lastGeneratedCode?: string;
  }&amp;gt;({
    scrapedWebsites: [],
    generatedComponents: [],
    appliedCode: [],
    currentProject: &apos;&apos;,
    lastGeneratedCode: undefined
  });
  
  const iframeRef = useRef&amp;lt;HTMLIFrameElement&amp;gt;(null);
  const chatMessagesRef = useRef&amp;lt;HTMLDivElement&amp;gt;(null);
  const codeDisplayRef = useRef&amp;lt;HTMLDivElement&amp;gt;(null);
  
  const [codeApplicationState, setCodeApplicationState] = useState&amp;lt;CodeApplicationState&amp;gt;({
    stage: null
  });
  
  const [generationProgress, setGenerationProgress] = useState&amp;lt;{
    isGenerating: boolean;
    status: string;
    components: Array&amp;lt;{ name: string; path: string; completed: boolean }&amp;gt;;
    currentComponent: number;
    streamedCode: string;
    isStreaming: boolean;
    isThinking: boolean;
    thinkingText?: string;
    thinkingDuration?: number;
    currentFile?: { path: string; content: string; type: string };
    files: Array&amp;lt;{ path: string; content: string; type: string; completed: boolean }&amp;gt;;
    lastProcessedPosition: number;
    isEdit?: boolean;
  }&amp;gt;({
    isGenerating: false,
    status: &apos;&apos;,
    components: [],
    currentComponent: 0,
    streamedCode: &apos;&apos;,
    isStreaming: false,
    isThinking: false,
    files: [],
    lastProcessedPosition: 0
  });

  // Clear old conversation data on component mount and create/restore sandbox
  useEffect(() =&amp;gt; {
    let isMounted = true;

    const initializePage = async () =&amp;gt; {
      // Clear old conversation
      try {
        await fetch(&apos;/api/conversation-state&apos;, {
          method: &apos;POST&apos;,
          headers: { &apos;Content-Type&apos;: &apos;application/json&apos; },
          body: JSON.stringify({ action: &apos;clear-old&apos; })
        });
        console.log(&apos;[home] Cleared old conversation data on mount&apos;);
      } catch (error) {
        console.error(&apos;[ai-sandbox] Failed to clear old conversation:&apos;, error);
        if (isMounted) {
          addChatMessage(&apos;Failed to clear old conversation data.&apos;, &apos;error&apos;);
        }
      }
      
      if (!isMounted) return;

      // Check if sandbox ID is in URL
      const sandboxIdParam = searchParams.get(&apos;sandbox&apos;);
      
      setLoading(true);
      try {
        if (sandboxIdParam) {
          console.log(&apos;[home] Attempting to restore sandbox:&apos;, sandboxIdParam);
          // For now, just create a new sandbox - you could enhance this to actually restore
          // the specific sandbox if your backend supports it
          await createSandbox(true);
        } else {
          console.log(&apos;[home] No sandbox in URL, creating new sandbox automatically...&apos;);
          await createSandbox(true);
        }
      } catch (error) {
        console.error(&apos;[ai-sandbox] Failed to create or restore sandbox:&apos;, error);
        if (isMounted) {
          addChatMessage(&apos;Failed to create or restore sandbox.&apos;, &apos;error&apos;);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    initializePage();

    return () =&amp;gt; {
      isMounted = false;
    };
  }, []); // Run only on mount
  
  useEffect(() =&amp;gt; {
    // Handle Escape key for home screen
    const handleKeyDown = (e: KeyboardEvent) =&amp;gt; {
      if (e.key === &apos;Escape&apos; &amp;&amp; showHomeScreen) {
        setHomeScreenFading(true);
        setTimeout(() =&amp;gt; {
          setShowHomeScreen(false);
          setHomeScreenFading(false);
        }, 500);
      }
    };
    
    window.addEventListener(&apos;keydown&apos;, handleKeyDown);
    return () =&amp;gt; window.removeEventListener(&apos;keydown&apos;, handleKeyDown);
  }, [showHomeScreen]);
  
  // Start capturing screenshot if URL is provided on mount (from home screen)
  useEffect(() =&amp;gt; {
    if (!showHomeScreen &amp;&amp; homeUrlInput &amp;&amp; !urlScreenshot &amp;&amp; !isCapturingScreenshot) {
      let screenshotUrl = homeUrlInput.trim();
      if (!screenshotUrl.match(/^https?:\/\//i)) {
        screenshotUrl = &apos;https://&apos; + screenshotUrl;
      }
      captureUrlScreenshot(screenshotUrl);
    }
  }, [showHomeScreen, homeUrlInput]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() =&amp;gt; {
    // Only check sandbox status on mount and when user navigates to the page
    checkSandboxStatus();
    
    // Optional: Check status when window regains focus
    const handleFocus = () =&amp;gt; {
      checkSandboxStatus();
    };
    
    window.addEventListener(&apos;focus&apos;, handleFocus);
    return () =&amp;gt; window.removeEventListener(&apos;focus&apos;, handleFocus);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() =&amp;gt; {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages]);


  const updateStatus = (text: string, active: boolean) =&amp;gt; {
    setStatus({ text, active });
  };

  const log = (message: string, type: &apos;info&apos; | &apos;error&apos; | &apos;command&apos; = &apos;info&apos;) =&amp;gt; {
    setResponseArea(prev =&amp;gt; [...prev, `[${type}] ${message}`]);
  };

  const addChatMessage = (content: string, type: ChatMessage[&apos;type&apos;], metadata?: ChatMessage[&apos;metadata&apos;]) =&amp;gt; {
    setChatMessages(prev =&amp;gt; {
      // Skip duplicate consecutive system messages
      if (type === &apos;system&apos; &amp;&amp; prev.length &amp;gt; 0) {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage.type === &apos;system&apos; &amp;&amp; lastMessage.content === content) {
          return prev; // Skip duplicate
        }
      }
      return [...prev, { content, type, timestamp: new Date(), metadata }];
    });
  };
  
  const checkAndInstallPackages = async () =&amp;gt; {
    if (!sandboxData) {
      addChatMessage(&apos;No active sandbox. Create a sandbox first!&apos;, &apos;system&apos;);
      return;
    }
    
    // Vite error checking removed - handled by template setup
    addChatMessage(&apos;Sandbox is ready. Vite configuration is handled by the template.&apos;, &apos;system&apos;);
  };
  
  const handleSurfaceError = (errors: any[]) =&amp;gt; {
    // Function kept for compatibility but Vite errors are now handled by template
    
    // Focus the input
    const textarea = document.querySelector(&apos;textarea&apos;) as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
    }
  };
  
  const installPackages = async (packages: string[]) =&amp;gt; {
    if (!sandboxData) {
      addChatMessage(&apos;No active sandbox. Create a sandbox first!&apos;, &apos;system&apos;);
      return;
    }
    
    try {
      const response = await fetch(&apos;/api/install-packages&apos;, {
        method: &apos;POST&apos;,
        headers: { &apos;Content-Type&apos;: &apos;application/json&apos; },
        body: JSON.stringify({ packages })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to install packages: ${response.statusText}`);
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split(&apos;\n&apos;);
        
        for (const line of lines) {
          if (line.startsWith(&apos;data: &apos;)) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case &apos;command&apos;:
                  // Don&apos;t show npm install commands - they&apos;re handled by info messages
                  if (!data.command.includes(&apos;npm install&apos;)) {
                    addChatMessage(data.command, &apos;command&apos;, { commandType: &apos;input&apos; });
                  }
                  break;
                case &apos;output&apos;:
                  addChatMessage(data.message, &apos;command&apos;, { commandType: &apos;output&apos; });
                  break;
                case &apos;error&apos;:
                  if (data.message &amp;&amp; data.message !== &apos;undefined&apos;) {
                    addChatMessage(data.message, &apos;command&apos;, { commandType: &apos;error&apos; });
                  }
                  break;
                case &apos;warning&apos;:
                  addChatMessage(data.message, &apos;command&apos;, { commandType: &apos;output&apos; });
                  break;
                case &apos;success&apos;:
                  addChatMessage(`${data.message}`, &apos;system&apos;);
                  break;
                case &apos;status&apos;:
                  addChatMessage(data.message, &apos;system&apos;);
                  break;
              }
            } catch (e) {
              console.error(&apos;Failed to parse SSE data:&apos;, e);
            }
          }
        }
      }
    } catch (error: any) {
      addChatMessage(`Failed to install packages: ${error.message}`, &apos;system&apos;);
    }
  };

  const checkSandboxStatus = async () =&amp;gt; {
    try {
      const response = await fetch(&apos;/api/sandbox-status&apos;);
      const data = await response.json();
      
      if (data.active &amp;&amp; data.healthy &amp;&amp; data.sandboxData) {
        setSandboxData(data.sandboxData);
        updateStatus(&apos;Sandbox active&apos;, true);
      } else if (data.active &amp;&amp; !data.healthy) {
        // Sandbox exists but not responding
        updateStatus(&apos;Sandbox not responding&apos;, false);
        // Optionally try to create a new one
      } else {
        setSandboxData(null);
        updateStatus(&apos;No sandbox&apos;, false);
      }
    } catch (error) {
      console.error(&apos;Failed to check sandbox status:&apos;, error);
      setSandboxData(null);
      updateStatus(&apos;Error&apos;, false);
    }
  };

  const createSandbox = async (fromHomeScreen = false) =&amp;gt; {
    console.log(&apos;[createSandbox] Starting sandbox creation...&apos;);
    setLoading(true);
    setShowLoadingBackground(true);
    updateStatus(&apos;Creating sandbox...&apos;, false);
    setResponseArea([]);
    setScreenshotError(null);
    
    try {
      const response = await fetch(&apos;/api/create-ai-sandbox&apos;, {
        method: &apos;POST&apos;,
        headers: { &apos;Content-Type&apos;: &apos;application/json&apos; },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      console.log(&apos;[createSandbox] Response data:&apos;, data);
      
      if (data.success) {
        setSandboxData(data);
        updateStatus(&apos;Sandbox active&apos;, true);
        log(&apos;Sandbox created successfully!&apos;);
        log(`Sandbox ID: ${data.sandboxId}`);
        log(`URL: ${data.url}`);
        
        // Update URL with sandbox ID
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set(&apos;sandbox&apos;, data.sandboxId);
        newParams.set(&apos;model&apos;, aiModel);
        router.push(`/?${newParams.toString()}`, { scroll: false });
        
        // Fade out loading background after sandbox loads
        setTimeout(() =&amp;gt; {
          setShowLoadingBackground(false);
        }, 3000);
        
        if (data.structure) {
          displayStructure(data.structure);
        }
        
        // Fetch sandbox files after creation
        setTimeout(fetchSandboxFiles, 1000);
        
        // Restart Vite server to ensure it&apos;s running
        setTimeout(async () =&amp;gt; {
          try {
            console.log(&apos;[createSandbox] Ensuring Vite server is running...&apos;);
            const restartResponse = await fetch(&apos;/api/restart-vite&apos;, {
              method: &apos;POST&apos;,
              headers: { &apos;Content-Type&apos;: &apos;application/json&apos; }
            });
            
            if (restartResponse.ok) {
              const restartData = await restartResponse.json();
              if (restartData.success) {
                console.log(&apos;[createSandbox] Vite server started successfully&apos;);
              }
            }
          } catch (error) {
            console.error(&apos;[createSandbox] Error starting Vite server:&apos;, error);
          }
        }, 2000);
        
        // Only add welcome message if not coming from home screen
        if (!fromHomeScreen) {
          addChatMessage(`Sandbox created! ID: ${data.sandboxId}. I now have context of your sandbox and can help you build your app. Just ask me to create components and I&apos;ll automatically apply them!

Tip: I automatically detect and install npm packages from your code imports (like react-router-dom, axios, etc.)`, &apos;system&apos;);
        }
        
        setTimeout(() =&amp;gt; {
          if (iframeRef.current) {
            iframeRef.current.src = data.url;
          }
        }, 100);
      } else {
        throw new Error(data.error || &apos;Unknown error&apos;);
      }
    } catch (error: any) {
      console.error(&apos;[createSandbox] Error:&apos;, error);
      updateStatus(&apos;Error&apos;, false);
      log(`Failed to create sandbox: ${error.message}`, &apos;error&apos;);
      addChatMessage(`Failed to create sandbox: ${error.message}`, &apos;system&apos;);
    } finally {
      setLoading(false);
    }
  };

  const displayStructure = (structure: any) =&amp;gt; {
    if (typeof structure === &apos;object&apos;) {
      setStructureContent(JSON.stringify(structure, null, 2));
    } else {
      setStructureContent(structure || &apos;No structure available&apos;);
    }
  };

  const applyGeneratedCode = async (code: string, isEdit: boolean = false) =&amp;gt; {
    setLoading(true);
    log(&apos;Applying AI-generated code...&apos;);
    
    try {
      // Show progress component instead of individual messages
      setCodeApplicationState({ stage: &apos;analyzing&apos; });
      
      // Get pending packages from tool calls
      const pendingPackages = ((window as any).pendingPackages || []).filter((pkg: any) =&amp;gt; pkg &amp;&amp; typeof pkg === &apos;string&apos;);
      if (pendingPackages.length &amp;gt; 0) {
        console.log(&apos;[applyGeneratedCode] Sending packages from tool calls:&apos;, pendingPackages);
        // Clear pending packages after use
        (window as any).pendingPackages = [];
      }
      
      // Use streaming endpoint for real-time feedback
      const response = await fetch(&apos;/api/apply-ai-code-stream&apos;, {
        method: &apos;POST&apos;,
        headers: { &apos;Content-Type&apos;: &apos;application/json&apos; },
        body: JSON.stringify({ 
          response: code,
          isEdit: isEdit,
          packages: pendingPackages,
          sandboxId: sandboxData?.sandboxId // Pass the sandbox ID to ensure proper connection
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to apply code: ${response.statusText}`);
      }
      
      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalData: any = null;
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split(&apos;\n&apos;);
        
        for (const line of lines) {
          if (line.startsWith(&apos;data: &apos;)) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case &apos;start&apos;:
                  // Don&apos;t add as chat message, just update state
                  setCodeApplicationState({ stage: &apos;analyzing&apos; });
                  break;
                  
                case &apos;step&apos;:
                  // Update progress state based on step
                  if (data.message.includes(&apos;Installing&apos;) &amp;&amp; data.packages) {
                    setCodeApplicationState({ 
                      stage: &apos;installing&apos;, 
                      packages: data.packages 
                    });
                  } else if (data.message.includes(&apos;Creating files&apos;) || data.message.includes(&apos;Applying&apos;)) {
                    setCodeApplicationState({ 
                      stage: &apos;applying&apos;,
                      filesGenerated: data.filesCreated || 0
                    });
                  }
                  break;
                  
                case &apos;package-progress&apos;:
                  // Handle package installation progress
                  if (data.installedPackages) {
                    setCodeApplicationState(prev =&amp;gt; ({ 
                      ...prev,
                      installedPackages: data.installedPackages 
                    }));
                  }
                  break;
                  
                case &apos;command&apos;:
                  // Don&apos;t show npm install commands - they&apos;re handled by info messages
                  if (data.command &amp;&amp; !data.command.includes(&apos;npm install&apos;)) {
                    addChatMessage(data.command, &apos;command&apos;, { commandType: &apos;input&apos; });
                  }
                  break;
                  
                case &apos;success&apos;:
                  if (data.installedPackages) {
                    setCodeApplicationState(prev =&amp;gt; ({ 
                      ...prev,
                      installedPackages: data.installedPackages 
                    }));
                  }
                  break;
                  
                case &apos;file-progress&apos;:
                  // Skip file progress messages, they&apos;re noisy
                  break;
                  
                case &apos;file-complete&apos;:
                  // Could add individual file completion messages if desired
                  break;
                  
                case &apos;command-progress&apos;:
                  addChatMessage(`${data.action} command: ${data.command}`, &apos;command&apos;, { commandType: &apos;input&apos; });
                  break;
                  
                case &apos;command-output&apos;:
                  addChatMessage(data.output, &apos;command&apos;, { 
                    commandType: data.stream === &apos;stderr&apos; ? &apos;error&apos; : &apos;output&apos; 
                  });
                  break;
                  
                case &apos;command-complete&apos;:
                  if (data.success) {
                    addChatMessage(`Command completed successfully`, &apos;system&apos;);
                  } else {
                    addChatMessage(`Command failed with exit code ${data.exitCode}`, &apos;system&apos;);
                  }
                  break;
                  
                case &apos;complete&apos;:
                  finalData = data;
                  setCodeApplicationState({ stage: &apos;complete&apos; });
                  // Clear the state after a delay
                  setTimeout(() =&amp;gt; {
                    setCodeApplicationState({ stage: null });
                  }, 3000);
                  break;
                  
                case &apos;error&apos;:
                  addChatMessage(`Error: ${data.message || data.error || &apos;Unknown error&apos;}`, &apos;system&apos;);
                  break;
                  
                case &apos;warning&apos;:
                  addChatMessage(`${data.message}`, &apos;system&apos;);
                  break;
                  
                case &apos;info&apos;:
                  // Show info messages, especially for package installation
                  if (data.message) {
                    addChatMessage(data.message, &apos;system&apos;);
                  }
                  break;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
      
      // Process final data
      if (finalData &amp;&amp; finalData.type === &apos;complete&apos;) {
        const data = {
          success: true,
          results: finalData.results,
          explanation: finalData.explanation,
          structure: finalData.structure,
          message: finalData.message
        };
        
        if (data.success) {
          const { results } = data;
        
        // Log package installation results without duplicate messages
        if (results.packagesInstalled?.length &amp;gt; 0) {
          log(`Packages installed: ${results.packagesInstalled.join(&apos;, &apos;)}`);
        }
        
        if (results.filesCreated?.length &amp;gt; 0) {
          log(&apos;Files created:&apos;);
          results.filesCreated.forEach((file: string) =&amp;gt; {
            log(`  ${file}`, &apos;command&apos;);
          });
          
          // Verify files were actually created by refreshing the sandbox if needed
          if (sandboxData?.sandboxId &amp;&amp; results.filesCreated.length &amp;gt; 0) {
            // Small delay to ensure files are written
            setTimeout(() =&amp;gt; {
              // Force refresh the iframe to show new files
              if (iframeRef.current) {
                iframeRef.current.src = iframeRef.current.src;
              }
            }, 1000);
          }
        }
        
        if (results.filesUpdated?.length &amp;gt; 0) {
          log(&apos;Files updated:&apos;);
          results.filesUpdated.forEach((file: string) =&amp;gt; {
            log(`  ${file}`, &apos;command&apos;);
          });
        }
        
        // Update conversation context with applied code
        setConversationContext(prev =&amp;gt; ({
          ...prev,
          appliedCode: [...prev.appliedCode, {
            files: [...(results.filesCreated || []), ...(results.filesUpdated || [])],
            timestamp: new Date()
          }]
        }));
        
        if (results.commandsExecuted?.length &amp;gt; 0) {
          log(&apos;Commands executed:&apos;);
          results.commandsExecuted.forEach((cmd: string) =&amp;gt; {
            log(`  $ ${cmd}`, &apos;command&apos;);
          });
        }
        
        if (results.errors?.length &amp;gt; 0) {
          results.errors.forEach((err: string) =&amp;gt; {
            log(err, &apos;error&apos;);
          });
        }
        
        if (data.structure) {
          displayStructure(data.structure);
        }
        
        if (data.explanation) {
          log(data.explanation);
        }
        
        // Handle warnings if they exist
        // if (data.warning) {
        //   log(data.warning, &apos;error&apos;);
        //   
        //   if (data.missingImports &amp;&amp; data.missingImports.length &amp;gt; 0) {
        //     const missingList = data.missingImports.join(&apos;, &apos;);
        //     addChatMessage(
        //       `Ask me to &quot;create the missing components: ${missingList}&quot; to fix these import errors.`,
        //       &apos;system&apos;
        //     );
        //   }
        // }
        
        log(&apos;Code applied successfully!&apos;);
        console.log(&apos;[applyGeneratedCode] Response data:&apos;, data);
        console.log(&apos;[applyGeneratedCode] Debug info:&apos;, (data as any).debug);
        console.log(&apos;[applyGeneratedCode] Current sandboxData:&apos;, sandboxData);
        console.log(&apos;[applyGeneratedCode] Current iframe element:&apos;, iframeRef.current);
        console.log(&apos;[applyGeneratedCode] Current iframe src:&apos;, iframeRef.current?.src);
        
        if (results.filesCreated?.length &amp;gt; 0) {
          setConversationContext(prev =&amp;gt; ({
            ...prev,
            appliedCode: [...prev.appliedCode, {
              files: results.filesCreated,
              timestamp: new Date()
            }]
          }));
          
          // Update the chat message to show success
          // Only show file list if not in edit mode
          if (isEdit) {
            addChatMessage(`Edit applied successfully!`, &apos;system&apos;);
          } else {
            // Check if this is part of a generation flow (has recent AI recreation message)
            const recentMessages = chatMessages.slice(-5);
            const isPartOfGeneration = recentMessages.some(m =&amp;gt; 
              m.content.includes(&apos;AI recreation generated&apos;) || 
              m.content.includes(&apos;Code generated&apos;)
            );
            
            // Don&apos;t show files if part of generation flow to avoid duplication
            if (isPartOfGeneration) {
              addChatMessage(`Applied ${results.filesCreated.length} files successfully!`, &apos;system&apos;);
            } else {
              addChatMessage(`Applied ${results.filesCreated.length} files successfully!`, &apos;system&apos;, {
                appliedFiles: results.filesCreated
              });
            }
          }
          
          // If there are failed packages, add a message about checking for errors
          if (results.packagesFailed?.length &amp;gt; 0) {
            addChatMessage(`⚠️ Some packages failed to install. Check the error banner above for details.`, &apos;system&apos;);
          }
          
          // Fetch updated file structure
          await fetchSandboxFiles();
          
          // Automatically check and install any missing packages
          await checkAndInstallPackages();
          
          // Test build to ensure everything compiles correctly
          // Skip build test for now - it&apos;s causing errors with undefined activeSandbox
          // The build test was trying to access global.activeSandbox from the frontend,
          // but that&apos;s only available in the backend API routes
          console.log(&apos;[build-test] Skipping build test - would need API endpoint&apos;);
          
          // Force iframe refresh after applying code
          const refreshDelay = appConfig.codeApplication.defaultRefreshDelay; // Allow Vite to process changes
          
          setTimeout(() =&amp;gt; {
            if (iframeRef.current &amp;&amp; sandboxData?.url) {
              console.log(&apos;[home] Refreshing iframe after code application...&apos;);
              
              // Method 1: Change src with timestamp
              const urlWithTimestamp = `${sandboxData.url}?t=${Date.now()}&amp;applied=true`;
              iframeRef.current.src = urlWithTimestamp;
              
              // Method 2: Force reload after a short delay
              setTimeout(() =&amp;gt; {
                try {
                  if (iframeRef.current?.contentWindow) {
                    iframeRef.current.contentWindow.location.reload();
                    console.log(&apos;[home] Force reloaded iframe content&apos;);
                  }
                } catch (e) {
                  console.log(&apos;[home] Could not reload iframe (cross-origin):&apos;, e);
                }
              }, 1000);
            }
          }, refreshDelay);
          
          // Vite error checking removed - handled by template setup
        }
        
          // Give Vite HMR a moment to detect changes, then ensure refresh
          if (iframeRef.current &amp;&amp; sandboxData?.url) {
            // Wait for Vite to process the file changes
            // If packages were installed, wait longer for Vite to restart
            const packagesInstalled = results?.packagesInstalled?.length &amp;gt; 0 || data.results?.packagesInstalled?.length &amp;gt; 0;
            const refreshDelay = packagesInstalled ? appConfig.codeApplication.packageInstallRefreshDelay : appConfig.codeApplication.defaultRefreshDelay;
            console.log(`[applyGeneratedCode] Packages installed: ${packagesInstalled}, refresh delay: ${refreshDelay}ms`);
            
            setTimeout(async () =&amp;gt; {
            if (iframeRef.current &amp;&amp; sandboxData?.url) {
              console.log(&apos;[applyGeneratedCode] Starting iframe refresh sequence...&apos;);
              console.log(&apos;[applyGeneratedCode] Current iframe src:&apos;, iframeRef.current.src);
              console.log(&apos;[applyGeneratedCode] Sandbox URL:&apos;, sandboxData.url);
              
              // Method 1: Try direct navigation first
              try {
                const urlWithTimestamp = `${sandboxData.url}?t=${Date.now()}&amp;force=true`;
                console.log(&apos;[applyGeneratedCode] Attempting direct navigation to:&apos;, urlWithTimestamp);
                
                // Remove any existing onload handler
                iframeRef.current.onload = null;
                
                // Navigate directly
                iframeRef.current.src = urlWithTimestamp;
                
                // Wait a bit and check if it loaded
                await new Promise(resolve =&amp;gt; setTimeout(resolve, 2000));
                
                // Try to access the iframe content to verify it loaded
                try {
                  const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
                  if (iframeDoc &amp;&amp; iframeDoc.readyState === &apos;complete&apos;) {
                    console.log(&apos;[applyGeneratedCode] Iframe loaded successfully&apos;);
                    return;
                  }
                } catch (e) {
                  console.log(&apos;[applyGeneratedCode] Cannot access iframe content (CORS), assuming loaded&apos;);
                  return;
                }
              } catch (e) {
                console.error(&apos;[applyGeneratedCode] Direct navigation failed:&apos;, e);
              }
              
              // Method 2: Force complete iframe recreation if direct navigation failed
              console.log(&apos;[applyGeneratedCode] Falling back to iframe recreation...&apos;);
              const parent = iframeRef.current.parentElement;
              const newIframe = document.createElement(&apos;iframe&apos;);
              
              // Copy attributes
              newIframe.className = iframeRef.current.className;
              newIframe.title = iframeRef.current.title;
              newIframe.allow = iframeRef.current.allow;
              // Copy sandbox attributes
              const sandboxValue = iframeRef.current.getAttribute(&apos;sandbox&apos;);
              if (sandboxValue) {
                newIframe.setAttribute(&apos;sandbox&apos;, sandboxValue);
              }
              
              // Remove old iframe
              iframeRef.current.remove();
              
              // Add new iframe
              newIframe.src = `${sandboxData.url}?t=${Date.now()}&amp;recreated=true`;
              parent?.appendChild(newIframe);
              
              // Update ref
              (iframeRef as any).current = newIframe;
              
              console.log(&apos;[applyGeneratedCode] Iframe recreated with new content&apos;);
            } else {
              console.error(&apos;[applyGeneratedCode] No iframe or sandbox URL available for refresh&apos;);
            }
          }, refreshDelay); // Dynamic delay based on whether packages were installed
        }
        
        } else {
          throw new Error(finalData?.error || &apos;Failed to apply code&apos;);
        }
      } else {
        // If no final data was received, still close loading
        addChatMessage(&apos;Code application may have partially succeeded. Check the preview.&apos;, &apos;system&apos;);
      }
    } catch (error: any) {
      log(`Failed to apply code: ${error.message}`, &apos;error&apos;);
    } finally {
      setLoading(false);
      // Clear isEdit flag after applying code
      setGenerationProgress(prev =&amp;gt; ({
        ...prev,
        isEdit: false
      }));
    }
  };

  const fetchSandboxFiles = async () =&amp;gt; {
    if (!sandboxData) return;
    
    try {
      const response = await fetch(&apos;/api/get-sandbox-files&apos;, {
        method: &apos;GET&apos;,
        headers: {
          &apos;Content-Type&apos;: &apos;application/json&apos;,
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSandboxFiles(data.files || {});
          setFileStructure(data.structure || &apos;&apos;);
          console.log(&apos;[fetchSandboxFiles] Updated file list:&apos;, Object.keys(data.files || {}).length, &apos;files&apos;);
        }
      }
    } catch (error) {
      console.error(&apos;[fetchSandboxFiles] Error fetching files:&apos;, error);
    }
  };
  
  const restartViteServer = async () =&amp;gt; {
    try {
      addChatMessage(&apos;Restarting Vite dev server...&apos;, &apos;system&apos;);
      
      const response = await fetch(&apos;/api/restart-vite&apos;, {
        method: &apos;POST&apos;,
        headers: { &apos;Content-Type&apos;: &apos;application/json&apos; }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          addChatMessage(&apos;✓ Vite dev server restarted successfully!&apos;, &apos;system&apos;);
          
          // Refresh the iframe after a short delay
          setTimeout(() =&amp;gt; {
            if (iframeRef.current &amp;&amp; sandboxData?.url) {
              iframeRef.current.src = `${sandboxData.url}?t=${Date.now()}`;
            }
          }, 2000);
        } else {
          addChatMessage(`Failed to restart Vite: ${data.error}`, &apos;error&apos;);
        }
      } else {
        addChatMessage(&apos;Failed to restart Vite server&apos;, &apos;error&apos;);
      }
    } catch (error) {
      console.error(&apos;[restartViteServer] Error:&apos;, error);
      addChatMessage(`Error restarting Vite: ${error instanceof Error ? error.message : &apos;Unknown error&apos;}`, &apos;error&apos;);
    }
  };

  const applyCode = async () =&amp;gt; {
    const code = promptInput.trim();
    if (!code) {
      log(&apos;Please enter some code first&apos;, &apos;error&apos;);
      addChatMessage(&apos;No code to apply. Please generate code first.&apos;, &apos;system&apos;);
      return;
    }
    
    // Prevent double clicks
    if (loading) {
      console.log(&apos;[applyCode] Already loading, skipping...&apos;);
      return;
    }
    
    // Determine if this is an edit based on whether we have applied code before
    const isEdit = conversationContext.appliedCode.length &amp;gt; 0;
    await applyGeneratedCode(code, isEdit);
  };

  const renderMainContent = () =&amp;gt; {
    if (activeTab === &apos;generation&apos; &amp;&amp; (generationProgress.isGenerating || generationProgress.files.length &amp;gt; 0)) {
      return (
        /* Generation Tab Content */
        &amp;lt;div className=&quot;absolute inset-0 flex overflow-hidden&quot;&amp;gt;
          {/* File Explorer - Hide during edits */}
          {!generationProgress.isEdit &amp;&amp; (
            &amp;lt;div className=&quot;w-[250px] border-r border-gray-200 bg-white flex flex-col flex-shrink-0&quot;&amp;gt;
            &amp;lt;div className=&quot;p-3 bg-gray-100 text-gray-900 flex items-center justify-between&quot;&amp;gt;
              &amp;lt;div className=&quot;flex items-center gap-2&quot;&amp;gt;
                &amp;lt;BsFolderFill className=&quot;w-4 h-4&quot; /&amp;gt;
                &amp;lt;span className=&quot;text-sm font-medium&quot;&amp;gt;Explorer&amp;lt;/span&amp;gt;
              &amp;lt;/div&amp;gt;
            &amp;lt;/div&amp;gt;
            
            {/* File Tree */}
            &amp;lt;div className=&quot;flex-1 overflow-y-auto p-2 scrollbar-hide&quot;&amp;gt;
              &amp;lt;div className=&quot;text-sm&quot;&amp;gt;
                {/* Root app folder */}
                &amp;lt;div 
                  className=&quot;flex items-center gap-1 py-1 px-2 hover:bg-gray-100 rounded cursor-pointer text-gray-700&quot;
                  onClick={() =&amp;gt; toggleFolder(&apos;app&apos;)}
                &amp;gt;
                  {expandedFolders.has(&apos;app&apos;) ? (
                    &amp;lt;FiChevronDown className=&quot;w-4 h-4 text-gray-600&quot; /&amp;gt;
                  ) : (
                    &amp;lt;FiChevronRight className=&quot;w-4 h-4 text-gray-600&quot; /&amp;gt;
                  )}
                  {expandedFolders.has(&apos;app&apos;) ? (
                    &amp;lt;BsFolder2Open className=&quot;w-4 h-4 text-blue-500&quot; /&amp;gt;
                  ) : (
                    &amp;lt;BsFolderFill className=&quot;w-4 h-4 text-blue-500&quot; /&amp;gt;
                  )}
                  &amp;lt;span className=&quot;font-medium text-gray-800&quot;&amp;gt;app&amp;lt;/span&amp;gt;
                &amp;lt;/div&amp;gt;
                
                {expandedFolders.has(&apos;app&apos;) &amp;&amp; (
                  &amp;lt;div className=&quot;ml-4&quot;&amp;gt;
                    {/* Group files by directory */}
                    {(() =&amp;gt; {
                      const fileTree: { [key: string]: Array&amp;lt;{ name: string; edited?: boolean }&amp;gt; } = {};
                      
                      // Create a map of edited files
                      const editedFiles = new Set(
                        generationProgress.files
                          .filter(f =&amp;gt; (f as any).edited)
                          .map(f =&amp;gt; f.path)
                      );
                      
                      // Process all files from generation progress
                      generationProgress.files.forEach(file =&amp;gt; {
                        const parts = file.path.split(&apos;/&apos;);
                        const dir = parts.length &amp;gt; 1 ? parts.slice(0, -1).join(&apos;/&apos;) : &apos;&apos;;
                        const fileName = parts[parts.length - 1];
                        
                        if (!fileTree[dir]) fileTree[dir] = [];
                        fileTree[dir].push({
                          name: fileName,
                          edited: (file as any).edited || false
                        });
                      });
                      
                      return Object.entries(fileTree).map(([dir, files]) =&amp;gt; (
                        &amp;lt;div key={dir} className=&quot;mb-1&quot;&amp;gt;
                          {dir &amp;&amp; (
                            &amp;lt;div 
                              className=&quot;flex items-center gap-1 py-1 px-2 hover:bg-gray-100 rounded cursor-pointer text-gray-700&quot;
                              onClick={() =&amp;gt; toggleFolder(dir)}
                            &amp;gt;
                              {expandedFolders.has(dir) ? (
                                &amp;lt;FiChevronDown className=&quot;w-4 h-4 text-gray-600&quot; /&amp;gt;
                              ) : (
                                &amp;lt;FiChevronRight className=&quot;w-4 h-4 text-gray-600&quot; /&amp;gt;
                              )}
                              {expandedFolders.has(dir) ? (
                                &amp;lt;BsFolder2Open className=&quot;w-4 h-4 text-yellow-600&quot; /&amp;gt;
                              ) : (
                                &amp;lt;BsFolderFill className=&quot;w-4 h-4 text-yellow-600&quot; /&amp;gt;
                              )}
                              &amp;lt;span className=&quot;text-gray-700&quot;&amp;gt;{dir.split(&apos;/&apos;).pop()}&amp;lt;/span&amp;gt;
                            &amp;lt;/div&amp;gt;
                          )}
                          {(!dir || expandedFolders.has(dir)) &amp;&amp; (
                            &amp;lt;div className={dir ? &apos;ml-6&apos; : &apos;&apos;}&amp;gt;
                              {files.sort((a, b) =&amp;gt; a.name.localeCompare(b.name)).map(fileInfo =&amp;gt; {
                                const fullPath = dir ? `${dir}/${fileInfo.name}` : fileInfo.name;
                                const isSelected = selectedFile === fullPath;
                                
                                return (
                                  &amp;lt;div 
                                    key={fullPath} 
                                    className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-all ${
                                      isSelected 
                                        ? &apos;bg-blue-500 text-white&apos; 
                                        : &apos;text-gray-700 hover:bg-gray-100&apos;
                                    }`}
                                    onClick={() =&amp;gt; handleFileClick(fullPath)}
                                  &amp;gt;
                                    {getFileIcon(fileInfo.name)}
                                    &amp;lt;span className={`text-xs flex items-center gap-1 ${isSelected ? &apos;font-medium&apos; : &apos;&apos;}`}&amp;gt;
                                      {fileInfo.name}
                                      {fileInfo.edited &amp;&amp; (
                                        &amp;lt;span className={`text-[10px] px-1 rounded ${
                                          isSelected ? &apos;bg-blue-400&apos; : &apos;bg-orange-500 text-white&apos;
                                        }`}&amp;gt;✓&amp;lt;/span&amp;gt;
                                      )}
                                    &amp;lt;/span&amp;gt;
                                  &amp;lt;/div&amp;gt;
                                );
                              })}
                            &amp;lt;/div&amp;gt;
                          )}
                        &amp;lt;/div&amp;gt;
                      ));
                    })()}
                  &amp;lt;/div&amp;gt;
                )}
              &amp;lt;/div&amp;gt;
            &amp;lt;/div&amp;gt;
          &amp;lt;/div&amp;gt;
          )}
          
          {/* Code Content */}
          &amp;lt;div className=&quot;flex-1 flex flex-col overflow-hidden&quot;&amp;gt;
            {/* Thinking Mode Display - Only show during active generation */}
            {generationProgress.isGenerating &amp;&amp; (generationProgress.isThinking || generationProgress.thinkingText) &amp;&amp; (
              &amp;lt;div className=&quot;px-6 pb-6&quot;&amp;gt;
                &amp;lt;div className=&quot;flex items-center gap-2 mb-2&quot;&amp;gt;
                  &amp;lt;div className=&quot;text-purple-600 font-medium flex items-center gap-2&quot;&amp;gt;
                    {generationProgress.isThinking ? (
                      &amp;lt;&amp;gt;
                        &amp;lt;div className=&quot;w-2 h-2 bg-purple-600 rounded-full animate-pulse&quot; /&amp;gt;
                        AI is thinking...
                      &amp;lt;/&amp;gt;
                    ) : (
                      &amp;lt;&amp;gt;
                        &amp;lt;span className=&quot;text-purple-600&quot;&amp;gt;✓&amp;lt;/span&amp;gt;
                        Thought for {generationProgress.thinkingDuration || 0} seconds
                      &amp;lt;/&amp;gt;
                    )}
                  &amp;lt;/div&amp;gt;
                &amp;lt;/div&amp;gt;
                {generationProgress.thinkingText &amp;&amp; (
                  &amp;lt;div className=&quot;bg-purple-950 border border-purple-700 rounded-lg p-4 max-h-48 overflow-y-auto scrollbar-hide&quot;&amp;gt;
                    &amp;lt;pre className=&quot;text-xs font-mono text-purple-300 whitespace-pre-wrap&quot;&amp;gt;
                      {generationProgress.thinkingText}
                    &amp;lt;/pre&amp;gt;
                  &amp;lt;/div&amp;gt;
                )}
              &amp;lt;/div&amp;gt;
            )}
            
            {/* Live Code Display */}
            &amp;lt;div className=&quot;flex-1 rounded-lg p-6 flex flex-col min-h-0 overflow-hidden&quot;&amp;gt;
              &amp;lt;div className=&quot;flex-1 overflow-y-auto min-h-0 scrollbar-hide&quot; ref={codeDisplayRef}&amp;gt;
                {/* Show selected file if one is selected */}
                {selectedFile ? (
                  &amp;lt;div className=&quot;animate-in fade-in slide-in-from-top-2 duration-300&quot;&amp;gt;
                    &amp;lt;div className=&quot;bg-black border border-gray-200 rounded-lg overflow-hidden shadow-sm&quot;&amp;gt;
                      &amp;lt;div className=&quot;px-4 py-2 bg-[#36322F] text-white flex items-center justify-between&quot;&amp;gt;
                        &amp;lt;div className=&quot;flex items-center gap-2&quot;&amp;gt;
                          {getFileIcon(selectedFile)}
                          &amp;lt;span className=&quot;font-mono text-sm&quot;&amp;gt;{selectedFile}&amp;lt;/span&amp;gt;
                        &amp;lt;/div&amp;gt;
                        &amp;lt;button
                          onClick={() =&amp;gt; setSelectedFile(null)}
                          className=&quot;hover:bg-black/20 p-1 rounded transition-colors&quot;
                        &amp;gt;
                          &amp;lt;svg className=&quot;w-4 h-4&quot; fill=&quot;none&quot; viewBox=&quot;0 0 24 24&quot; stroke=&quot;currentColor&quot;&amp;gt;
                            &amp;lt;path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth={2} d=&quot;M6 18L18 6M6 6l12 12&quot; /&amp;gt;
                          &amp;lt;/svg&amp;gt;
                        &amp;lt;/button&amp;gt;
                      &amp;lt;/div&amp;gt;
                      &amp;lt;div className=&quot;bg-gray-900 border border-gray-700 rounded&quot;&amp;gt;
                        &amp;lt;SyntaxHighlighter
                          language={(() =&amp;gt; {
                            const ext = selectedFile.split(&apos;.&apos;).pop()?.toLowerCase();
                            if (ext === &apos;css&apos;) return &apos;css&apos;;
                            if (ext === &apos;json&apos;) return &apos;json&apos;;
                            if (ext === &apos;html&apos;) return &apos;html&apos;;
                            return &apos;jsx&apos;;
                          })()}
                          style={vscDarkPlus}
                          customStyle={{
                            margin: 0,
                            padding: &apos;1rem&apos;,
                            fontSize: &apos;0.875rem&apos;,
                            background: &apos;transparent&apos;,
                          }}
                          showLineNumbers={true}
                        &amp;gt;
                          {(() =&amp;gt; {
                            // Find the file content from generated files
                            const file = generationProgress.files.find(f =&amp;gt; f.path === selectedFile);
                            return file?.content || &apos;// File content will appear here&apos;;
                          })()}
                        &amp;lt;/SyntaxHighlighter&amp;gt;
                      &amp;lt;/div&amp;gt;
                    &amp;lt;/div&amp;gt;
                  &amp;lt;/div&amp;gt;
                ) : /* If no files parsed yet, show loading or raw stream */
                generationProgress.files.length === 0 &amp;&amp; !generationProgress.currentFile ? (
                  generationProgress.isThinking ? (
                    // Beautiful loading state while thinking
                    &amp;lt;div className=&quot;flex items-center justify-center h-full&quot;&amp;gt;
                      &amp;lt;div className=&quot;text-center&quot;&amp;gt;
                        &amp;lt;div className=&quot;mb-8 relative&quot;&amp;gt;
                          &amp;lt;div className=&quot;w-24 h-24 mx-auto&quot;&amp;gt;
                            &amp;lt;div className=&quot;absolute inset-0 border-4 border-gray-800 rounded-full&quot;&amp;gt;&amp;lt;/div&amp;gt;
                            &amp;lt;div className=&quot;absolute inset-0 border-4 border-green-500 rounded-full animate-spin border-t-transparent&quot;&amp;gt;&amp;lt;/div&amp;gt;
                          &amp;lt;/div&amp;gt;
                        &amp;lt;/div&amp;gt;
                        &amp;lt;h3 className=&quot;text-xl font-medium text-white mb-2&quot;&amp;gt;AI is analyzing your request&amp;lt;/h3&amp;gt;
                        &amp;lt;p className=&quot;text-gray-400 text-sm&quot;&amp;gt;{generationProgress.status || &apos;Preparing to generate code...&apos;}&amp;lt;/p&amp;gt;
                      &amp;lt;/div&amp;gt;
                    &amp;lt;/div&amp;gt;
                  ) : (
                    &amp;lt;div className=&quot;bg-black border border-gray-200 rounded-lg overflow-hidden&quot;&amp;gt;
                      &amp;lt;div className=&quot;px-4 py-2 bg-gray-100 text-gray-900 flex items-center justify-between&quot;&amp;gt;
                        &amp;lt;div className=&quot;flex items-center gap-2&quot;&amp;gt;
                          &amp;lt;div className=&quot;w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin&quot; /&amp;gt;
                          &amp;lt;span className=&quot;font-mono text-sm&quot;&amp;gt;Streaming code...&amp;lt;/span&amp;gt;
                        &amp;lt;/div&amp;gt;
                      &amp;lt;/div&amp;gt;
                      &amp;lt;div className=&quot;p-4 bg-gray-900 rounded&quot;&amp;gt;
                        &amp;lt;SyntaxHighlighter
                          language=&quot;jsx&quot;
                          style={vscDarkPlus}
                          customStyle={{
                            margin: 0,
                            padding: &apos;1rem&apos;,
                            fontSize: &apos;0.875rem&apos;,
                            background: &apos;transparent&apos;,
                          }}
                          showLineNumbers={true}
                        &amp;gt;
                          {generationProgress.streamedCode || &apos;Starting code generation...&apos;}
                        &amp;lt;/SyntaxHighlighter&amp;gt;
                        &amp;lt;span className=&quot;inline-block w-2 h-4 bg-orange-400 ml-1 animate-pulse&quot; /&amp;gt;
                      &amp;lt;/div&amp;gt;
                    &amp;lt;/div&amp;gt;
                  )
                ) : (
                  &amp;lt;div className=&quot;space-y-4&quot;&amp;gt;
                    {/* Show current file being generated */}
                    {generationProgress.currentFile &amp;&amp; (
                      &amp;lt;div className=&quot;bg-black border-2 border-gray-400 rounded-lg overflow-hidden shadow-sm&quot;&amp;gt;
                        &amp;lt;div className=&quot;px-4 py-2 bg-[#36322F] text-white flex items-center justify-between&quot;&amp;gt;
                          &amp;lt;div className=&quot;flex items-center gap-2&quot;&amp;gt;
                            &amp;lt;div className=&quot;w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin&quot; /&amp;gt;
                            &amp;lt;span className=&quot;font-mono text-sm&quot;&amp;gt;{generationProgress.currentFile.path}&amp;lt;/span&amp;gt;
                            &amp;lt;span className={`px-2 py-0.5 text-xs rounded ${
                              generationProgress.currentFile.type === &apos;css&apos; ? &apos;bg-blue-600 text-white&apos; :
                              generationProgress.currentFile.type === &apos;javascript&apos; ? &apos;bg-yellow-600 text-white&apos; :
                              generationProgress.currentFile.type === &apos;json&apos; ? &apos;bg-green-600 text-white&apos; :
                              &apos;bg-gray-200 text-gray-700&apos;
                            }`}&amp;gt;
                              {generationProgress.currentFile.type === &apos;javascript&apos; ? &apos;JSX&apos; : generationProgress.currentFile.type.toUpperCase()}
                            &amp;lt;/span&amp;gt;
                          &amp;lt;/div&amp;gt;
                        &amp;lt;/div&amp;gt;
                        &amp;lt;div className=&quot;bg-gray-900 border border-gray-700 rounded&quot;&amp;gt;
                          &amp;lt;SyntaxHighlighter
                            language={
                              generationProgress.currentFile.type === &apos;css&apos; ? &apos;css&apos; :
                              generationProgress.currentFile.type === &apos;json&apos; ? &apos;json&apos; :
                              generationProgress.currentFile.type === &apos;html&apos; ? &apos;html&apos; :
                              &apos;jsx&apos;
                            }
                            style={vscDarkPlus}
                            customStyle={{
                              margin: 0,
                              padding: &apos;1rem&apos;,
                              fontSize: &apos;0.75rem&apos;,
                              background: &apos;transparent&apos;,
                            }}
                            showLineNumbers={true}
                          &amp;gt;
                            {generationProgress.currentFile.content}
                          &amp;lt;/SyntaxHighlighter&amp;gt;
                          &amp;lt;span className=&quot;inline-block w-2 h-3 bg-orange-400 ml-4 mb-4 animate-pulse&quot; /&amp;gt;
                        &amp;lt;/div&amp;gt;
                      &amp;lt;/div&amp;gt;
                    )}
                    
                    {/* Show completed files */}
                    {generationProgress.files.map((file, idx) =&amp;gt; (
                      &amp;lt;div key={idx} className=&quot;bg-white border border-gray-200 rounded-lg overflow-hidden&quot;&amp;gt;
                        &amp;lt;div className=&quot;px-4 py-2 bg-[#36322F] text-white flex items-center justify-between&quot;&amp;gt;
                          &amp;lt;div className=&quot;flex items-center gap-2&quot;&amp;gt;
                            &amp;lt;span className=&quot;text-green-500&quot;&amp;gt;✓&amp;lt;/span&amp;gt;
                            &amp;lt;span className=&quot;font-mono text-sm&quot;&amp;gt;{file.path}&amp;lt;/span&amp;gt;
                          &amp;lt;/div&amp;gt;
                          &amp;lt;span className={`px-2 py-0.5 text-xs rounded ${
                            file.type === &apos;css&apos; ? &apos;bg-blue-600 text-white&apos; :
                            file.type === &apos;javascript&apos; ? &apos;bg-yellow-600 text-white&apos; :
                            file.type === &apos;json&apos; ? &apos;bg-green-600 text-white&apos; :
                            &apos;bg-gray-200 text-gray-700&apos;
                          }`}&amp;gt;
                            {file.type === &apos;javascript&apos; ? &apos;JSX&apos; : file.type.toUpperCase()}
                          &amp;lt;/span&amp;gt;
                        &amp;lt;/div&amp;gt;
                        &amp;lt;div className=&quot;bg-gray-900 border border-gray-700  max-h-48 overflow-y-auto scrollbar-hide&quot;&amp;gt;
                          &amp;lt;SyntaxHighlighter
                            language={
                              file.type === &apos;css&apos; ? &apos;css&apos; :
                              file.type === &apos;json&apos; ? &apos;json&apos; :
                              file.type === &apos;html&apos; ? &apos;html&apos; :
                              &apos;jsx&apos;
                            }
                            style={vscDarkPlus}
                            customStyle={{
                              margin: 0,
                              padding: &apos;1rem&apos;,
                              fontSize: &apos;0.75rem&apos;,
                              background: &apos;transparent&apos;,
                            }}
                            showLineNumbers={true}
                            wrapLongLines={true}
                          &amp;gt;
                            {file.content}
                          &amp;lt;/SyntaxHighlighter&amp;gt;
                        &amp;lt;/div&amp;gt;
                      &amp;lt;/div&amp;gt;
                    ))}
                    
                    {/* Show remaining raw stream if there&apos;s content after the last file */}
                    {!generationProgress.currentFile &amp;&amp; generationProgress.streamedCode.length &amp;gt; 0 &amp;&amp; (
                      &amp;lt;div className=&quot;bg-black border border-gray-200 rounded-lg overflow-hidden&quot;&amp;gt;
                        &amp;lt;div className=&quot;px-4 py-2 bg-[#36322F] text-white flex items-center justify-between&quot;&amp;gt;
                          &amp;lt;div className=&quot;flex items-center gap-2&quot;&amp;gt;
                            &amp;lt;div className=&quot;w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin&quot; /&amp;gt;
                            &amp;lt;span className=&quot;font-mono text-sm&quot;&amp;gt;Processing...&amp;lt;/span&amp;gt;
                          &amp;lt;/div&amp;gt;
                        &amp;lt;/div&amp;gt;
                        &amp;lt;div className=&quot;bg-gray-900 border border-gray-700 rounded&quot;&amp;gt;
                          &amp;lt;SyntaxHighlighter
                            language=&quot;jsx&quot;
                            style={vscDarkPlus}
                            customStyle={{
                              margin: 0,
                              padding: &apos;1rem&apos;,
                              fontSize: &apos;0.75rem&apos;,
                              background: &apos;transparent&apos;,
                            }}
                            showLineNumbers={false}
                          &amp;gt;
                            {(() =&amp;gt; {
                              // Show only the tail of the stream after the last file
                              const lastFileEnd = generationProgress.files.length &amp;gt; 0 
                                ? generationProgress.streamedCode.lastIndexOf(&apos;&amp;lt;/file&amp;gt;&apos;) + 7
                                : 0;
                              let remainingContent = generationProgress.streamedCode.slice(lastFileEnd).trim();
                              
                              // Remove explanation tags and content
                              remainingContent = remainingContent.replace(/&amp;lt;explanation&amp;gt;[\s\S]*?&amp;lt;\/explanation&amp;gt;/g, &apos;&apos;).trim();
                              
                              // If only whitespace or nothing left, show waiting message
                              return remainingContent || &apos;Waiting for next file...&apos;;
                            })()}
                          &amp;lt;/SyntaxHighlighter&amp;gt;
                        &amp;lt;/div&amp;gt;
                      &amp;lt;/div&amp;gt;
                    )}
                  &amp;lt;/div&amp;gt;
                )}
              &amp;lt;/div&amp;gt;
            &amp;lt;/div&amp;gt;
            
            {/* Progress indicator */}
            {generationProgress.components.length &amp;gt; 0 &amp;&amp; (
              &amp;lt;div className=&quot;mx-6 mb-6&quot;&amp;gt;
                &amp;lt;div className=&quot;h-2 bg-gray-200 rounded-full overflow-hidden&quot;&amp;gt;
                  &amp;lt;div 
                    className=&quot;h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-300&quot;
                    style={{
                      width: `${(generationProgress.currentComponent / Math.max(generationProgress.components.length, 1)) * 100}%`
                    }}
                  /&amp;gt;
                &amp;lt;/div&amp;gt;
              &amp;lt;/div&amp;gt;
            )}
          &amp;lt;/div&amp;gt;
        &amp;lt;/div&amp;gt;
      );
    } else if (activeTab === &apos;preview&apos;) {
      // Show screenshot when we have one and (loading OR generating OR no sandbox yet)
      if (urlScreenshot &amp;&amp; (loading || generationProgress.isGenerating || !sandboxData?.url || isPreparingDesign)) {
        return (
          &amp;lt;div className=&quot;relative w-full h-full bg-gray-100&quot;&amp;gt;
            &amp;lt;img 
              src={urlScreenshot} 
              alt=&quot;Website preview&quot; 
              className=&quot;w-full h-full object-contain&quot;
            /&amp;gt;
            {(generationProgress.isGenerating || isPreparingDesign) &amp;&amp; (
              &amp;lt;div className=&quot;absolute inset-0 bg-black/40 flex items-center justify-center&quot;&amp;gt;
                &amp;lt;div className=&quot;text-center bg-black/70 rounded-lg p-6 backdrop-blur-sm&quot;&amp;gt;
                  &amp;lt;div className=&quot;w-12 h-12 border-3 border-gray-300 border-t-white rounded-full animate-spin mx-auto mb-3&quot; /&amp;gt;
                  &amp;lt;p className=&quot;text-white text-sm font-medium&quot;&amp;gt;
                    {generationProgress.isGenerating ? &apos;Generating code...&apos; : `Preparing your design for ${targetUrl}...`}
                  &amp;lt;/p&amp;gt;
                &amp;lt;/div&amp;gt;
              &amp;lt;/div&amp;gt;
            )}
          &amp;lt;/div&amp;gt;
        );
      }
      
      // Check loading stage FIRST to prevent showing old sandbox
      // Don&apos;t show loading overlay for edits
      if (loadingStage || (generationProgress.isGenerating &amp;&amp; !generationProgress.isEdit)) {
        return (
          &amp;lt;div className=&quot;relative w-full h-full bg-gray-50 flex items-center justify-center&quot;&amp;gt;
            &amp;lt;div className=&quot;text-center&quot;&amp;gt;
              &amp;lt;div className=&quot;mb-8&quot;&amp;gt;
                &amp;lt;div className=&quot;w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto&quot;&amp;gt;&amp;lt;/div&amp;gt;
              &amp;lt;/div&amp;gt;
              &amp;lt;h3 className=&quot;text-xl font-semibold text-gray-800 mb-2&quot;&amp;gt;
                {loadingStage === &apos;gathering&apos; &amp;&amp; &apos;Gathering website information...&apos;}
                {loadingStage === &apos;planning&apos; &amp;&amp; &apos;Planning your design...&apos;}
                {(loadingStage === &apos;generating&apos; || generationProgress.isGenerating) &amp;&amp; &apos;Generating your application...&apos;}
              &amp;lt;/h3&amp;gt;
              &amp;lt;p className=&quot;text-gray-600 text-sm&quot;&amp;gt;
                {loadingStage === &apos;gathering&apos; &amp;&amp; &apos;Analyzing the website structure and content&apos;}
                {loadingStage === &apos;planning&apos; &amp;&amp; &apos;Creating the optimal React component architecture&apos;}
                {(loadingStage === &apos;generating&apos; || generationProgress.isGenerating) &amp;&amp; &apos;Writing clean, modern code for your app&apos;}
              &amp;lt;/p&amp;gt;
            &amp;lt;/div&amp;gt;
          &amp;lt;/div&amp;gt;
        );
      }
      
      // Show sandbox iframe only when not in any loading state
      if (sandboxData?.url &amp;&amp; !loading) {
        return (
          &amp;lt;div className=&quot;relative w-full h-full&quot;&amp;gt;
            &amp;lt;iframe
              ref={iframeRef}
              src={sandboxData.url}
              className=&quot;w-full h-full border-none&quot;
              title=&quot;Open Lovable Sandbox&quot;
              allow=&quot;clipboard-write&quot;
              sandbox=&quot;allow-scripts allow-same-origin allow-forms allow-popups allow-modals&quot;
            /&amp;gt;
            {/* Refresh button */}
            &amp;lt;button
              onClick={() =&amp;gt; {
                if (iframeRef.current &amp;&amp; sandboxData?.url) {
                  console.log(&apos;[Manual Refresh] Forcing iframe reload...&apos;);
                  const newSrc = `${sandboxData.url}?t=${Date.now()}&amp;manual=true`;
                  iframeRef.current.src = newSrc;
                }
              }}
              className=&quot;absolute bottom-4 right-4 bg-white/90 hover:bg-white text-gray-700 p-2 rounded-lg shadow-lg transition-all duration-200 hover:scale-105&quot;
              title=&quot;Refresh sandbox&quot;
            &amp;gt;
              &amp;lt;svg className=&quot;w-5 h-5&quot; fill=&quot;none&quot; viewBox=&quot;0 0 24 24&quot; stroke=&quot;currentColor&quot;&amp;gt;
                &amp;lt;path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth={2} d=&quot;M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15&quot; /&amp;gt;
              &amp;lt;/svg&amp;gt;
            &amp;lt;/button&amp;gt;
          &amp;lt;/div&amp;gt;
        );
      }
      
      // Show loading animation when capturing screenshot
      if (isCapturingScreenshot) {
        return (
          &amp;lt;div className=&quot;flex items-center justify-center h-full bg-gray-900&quot;&amp;gt;
            &amp;lt;div className=&quot;text-center&quot;&amp;gt;
              &amp;lt;div className=&quot;w-12 h-12 border-3 border-gray-600 border-t-white rounded-full animate-spin mx-auto mb-4&quot; /&amp;gt;
              &amp;lt;h3 className=&quot;text-lg font-medium text-white&quot;&amp;gt;Gathering website information&amp;lt;/h3&amp;gt;
            &amp;lt;/div&amp;gt;
          &amp;lt;/div&amp;gt;
        );
      }
      
      // Default state when no sandbox and no screenshot
      return (
        &amp;lt;div className=&quot;flex items-center justify-center h-full bg-gray-50 text-gray-600 text-lg&quot;&amp;gt;
          {screenshotError ? (
            &amp;lt;div className=&quot;text-center&quot;&amp;gt;
              &amp;lt;p className=&quot;mb-2&quot;&amp;gt;Failed to capture screenshot&amp;lt;/p&amp;gt;
              &amp;lt;p className=&quot;text-sm text-gray-500&quot;&amp;gt;{screenshotError}&amp;lt;/p&amp;gt;
            &amp;lt;/div&amp;gt;
          ) : sandboxData ? (
            &amp;lt;div className=&quot;text-gray-500&quot;&amp;gt;
              &amp;lt;div className=&quot;w-8 h-8 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mx-auto mb-2&quot; /&amp;gt;
              &amp;lt;p className=&quot;text-sm&quot;&amp;gt;Loading preview...&amp;lt;/p&amp;gt;
            &amp;lt;/div&amp;gt;
          ) : (
            &amp;lt;div className=&quot;text-gray-500 text-center&quot;&amp;gt;
              &amp;lt;p className=&quot;text-sm&quot;&amp;gt;Start chatting to create your first app&amp;lt;/p&amp;gt;
            &amp;lt;/div&amp;gt;
          )}
        &amp;lt;/div&amp;gt;
      );
    }
    return null;
  };

  const sendChatMessage = async () =&amp;gt; {
    const message = aiChatInput.trim();
    if (!message) return;
    
    if (!aiEnabled) {
      addChatMessage(&apos;AI is disabled. Please enable it first.&apos;, &apos;system&apos;);
      return;
    }
    
    addChatMessage(message, &apos;user&apos;);
    setAiChatInput(&apos;&apos;);
    
    // Check for special commands
    const lowerMessage = message.toLowerCase().trim();
    if (lowerMessage === &apos;check packages&apos; || lowerMessage === &apos;install packages&apos; || lowerMessage === &apos;npm install&apos;) {
      if (!sandboxData) {
        addChatMessage(&apos;No active sandbox. Create a sandbox first!&apos;, &apos;system&apos;);
        return;
      }
      await checkAndInstallPackages();
      return;
    }
    
    // Start sandbox creation in parallel if needed
    let sandboxPromise: Promise&amp;lt;void&amp;gt; | null = null;
    let sandboxCreating = false;
    
    if (!sandboxData) {
      sandboxCreating = true;
      addChatMessage(&apos;Creating sandbox while I plan your app...&apos;, &apos;system&apos;);
      sandboxPromise = createSandbox(true).catch((error: any) =&amp;gt; {
        addChatMessage(`Failed to create sandbox: ${error.message}`, &apos;system&apos;);
        throw error;
      });
    }
    
    // Determine if this is an edit
    const isEdit = conversationContext.appliedCode.length &amp;gt; 0;
    
    try {
      // Generation tab is already active from scraping phase
      setGenerationProgress(prev =&amp;gt; ({
        ...prev,  // Preserve all existing state
        isGenerating: true,
        status: &apos;Starting AI generation...&apos;,
        components: [],
        currentComponent: 0,
        streamedCode: &apos;&apos;,
        isStreaming: false,
        isThinking: true,
        thinkingText: &apos;Analyzing your request...&apos;,
        thinkingDuration: undefined,
        currentFile: undefined,
        lastProcessedPosition: 0,
        // Add isEdit flag to generation progress
        isEdit: isEdit,
        // Keep existing files for edits - we&apos;ll mark edited ones differently
        files: prev.files
      }));
      
      // Backend now manages file state - no need to fetch from frontend
      console.log(&apos;[chat] Using backend file cache for context&apos;);
      
      const fullContext = {
        sandboxId: sandboxData?.sandboxId || (sandboxCreating ? &apos;pending&apos; : null),
        structure: structureContent,
        recentMessages: chatMessages.slice(-20),
        conversationContext: conversationContext,
        currentCode: promptInput,
        sandboxUrl: sandboxData?.url,
        sandboxCreating: sandboxCreating
      };
      
      // Debug what we&apos;re sending
      console.log(&apos;[chat] Sending context to AI:&apos;);
      console.log(&apos;[chat] - sandboxId:&apos;, fullContext.sandboxId);
      console.log(&apos;[chat] - isEdit:&apos;, conversationContext.appliedCode.length &amp;gt; 0);
      
      const response = await fetch(&apos;/api/generate-ai-code-stream&apos;, {
        method: &apos;POST&apos;,
        headers: { &apos;Content-Type&apos;: &apos;application/json&apos; },
        body: JSON.stringify({
          prompt: message,
          model: aiModel,
          context: fullContext,
          isEdit: conversationContext.appliedCode.length &amp;gt; 0
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let generatedCode = &apos;&apos;;
      let explanation = &apos;&apos;;
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split(&apos;\n&apos;);
          
          for (const line of lines) {
            if (line.startsWith(&apos;data: &apos;)) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === &apos;status&apos;) {
                  setGenerationProgress(prev =&amp;gt; ({ ...prev, status: data.message }));
                } else if (data.type === &apos;thinking&apos;) {
                  setGenerationProgress(prev =&amp;gt; ({ 
                    ...prev, 
                    isThinking: true,
                    thinkingText: (prev.thinkingText || &apos;&apos;) + data.text
                  }));
                } else if (data.type === &apos;thinking_complete&apos;) {
                  setGenerationProgress(prev =&amp;gt; ({ 
                    ...prev, 
                    isThinking: false,
                    thinkingDuration: data.duration
                  }));
                } else if (data.type === &apos;conversation&apos;) {
                  // Add conversational text to chat only if it&apos;s not code
                  let text = data.text || &apos;&apos;;
                  
                  // Remove package tags from the text
                  text = text.replace(/&amp;lt;package&amp;gt;[^&amp;lt;]*&amp;lt;\/package&amp;gt;/g, &apos;&apos;);
                  text = text.replace(/&amp;lt;packages&amp;gt;[^&amp;lt;]*&amp;lt;\/packages&amp;gt;/g, &apos;&apos;);
                  
                  // Filter out any XML tags and file content that slipped through
                  if (!text.includes(&apos;&amp;lt;file&apos;) &amp;&amp; !text.includes(&apos;import React&apos;) &amp;&amp; 
                      !text.includes(&apos;export default&apos;) &amp;&amp; !text.includes(&apos;className=&apos;) &amp;&amp;
                      text.trim().length &amp;gt; 0) {
                    addChatMessage(text.trim(), &apos;ai&apos;);
                  }
                } else if (data.type === &apos;stream&apos; &amp;&amp; data.raw) {
                  setGenerationProgress(prev =&amp;gt; {
                    const newStreamedCode = prev.streamedCode + data.text;
                    
                    // Tab is already switched after scraping
                    
                    const updatedState = { 
                      ...prev, 
                      streamedCode: newStreamedCode,
                      isStreaming: true,
                      isThinking: false,
                      status: &apos;Generating code...&apos;
                    };
                    
                    // Process complete files from the accumulated stream
                    const fileRegex = /&amp;lt;file path=&quot;([^&quot;]+)&quot;&amp;gt;([^]*?)&amp;lt;\/file&amp;gt;/g;
                    let match;
                    const processedFiles = new Set(prev.files.map(f =&amp;gt; f.path));
                    
                    while ((match = fileRegex.exec(newStreamedCode)) !== null) {
                      const filePath = match[1];
                      const fileContent = match[2];
                      
                      // Only add if we haven&apos;t processed this file yet
                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split(&apos;.&apos;).pop() || &apos;&apos;;
                        const fileType = fileExt === &apos;jsx&apos; || fileExt === &apos;js&apos; ? &apos;javascript&apos; :
                                        fileExt === &apos;css&apos; ? &apos;css&apos; :
                                        fileExt === &apos;json&apos; ? &apos;json&apos; :
                                        fileExt === &apos;html&apos; ? &apos;html&apos; : &apos;text&apos;;
                        
                        // Check if file already exists
                        const existingFileIndex = updatedState.files.findIndex(f =&amp;gt; f.path === filePath);
                        
                        if (existingFileIndex &amp;gt;= 0) {
                          // Update existing file and mark as edited
                          updatedState.files = [
                            ...updatedState.files.slice(0, existingFileIndex),
                            {
                              ...updatedState.files[existingFileIndex],
                              content: fileContent.trim(),
                              type: fileType,
                              completed: true,
                              edited: true
                            } as any,
                            ...updatedState.files.slice(existingFileIndex + 1)
                          ];
                        } else {
                          // Add new file
                          updatedState.files = [...updatedState.files, {
                            path: filePath,
                            content: fileContent.trim(),
                            type: fileType,
                            completed: true,
                            edited: false
                          } as any];
                        }
                        
                        // Only show file status if not in edit mode
                        if (!prev.isEdit) {
                          updatedState.status = `Completed ${filePath}`;
                        }
                        processedFiles.add(filePath);
                      }
                    }
                    
                    // Check for current file being generated (incomplete file at the end)
                    const lastFileMatch = newStreamedCode.match(/&amp;lt;file path=&quot;([^&quot;]+)&quot;&amp;gt;([^]*?)$/);
                    if (lastFileMatch &amp;&amp; !lastFileMatch[0].includes(&apos;&amp;lt;/file&amp;gt;&apos;)) {
                      const filePath = lastFileMatch[1];
                      const partialContent = lastFileMatch[2];
                      
                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split(&apos;.&apos;).pop() || &apos;&apos;;
                        const fileType = fileExt === &apos;jsx&apos; || fileExt === &apos;js&apos; ? &apos;javascript&apos; :
                                        fileExt === &apos;css&apos; ? &apos;css&apos; :
                                        fileExt === &apos;json&apos; ? &apos;json&apos; :
                                        fileExt === &apos;html&apos; ? &apos;html&apos; : &apos;text&apos;;
                        
                        updatedState.currentFile = { 
                          path: filePath, 
                          content: partialContent, 
                          type: fileType 
                        };
                        // Only show file status if not in edit mode
                        if (!prev.isEdit) {
                          updatedState.status = `Generating ${filePath}`;
                        }
                      }
                    } else {
                      updatedState.currentFile = undefined;
                    }
                    
                    return updatedState;
                  });
                } else if (data.type === &apos;app&apos;) {
                  setGenerationProgress(prev =&amp;gt; ({ 
                    ...prev, 
                    status: &apos;Generated App.jsx structure&apos;
                  }));
                } else if (data.type === &apos;component&apos;) {
                  setGenerationProgress(prev =&amp;gt; ({
                    ...prev,
                    status: `Generated ${data.name}`,
                    components: [...prev.components, { 
                      name: data.name, 
                      path: data.path, 
                      completed: true 
                    }],
                    currentComponent: data.index
                  }));
                } else if (data.type === &apos;package&apos;) {
                  // Handle package installation from tool calls
                  setGenerationProgress(prev =&amp;gt; ({
                    ...prev,
                    status: data.message || `Installing ${data.name}`
                  }));
                } else if (data.type === &apos;complete&apos;) {
                  generatedCode = data.generatedCode;
                  explanation = data.explanation;
                  
                  // Save the last generated code
                  setConversationContext(prev =&amp;gt; ({
                    ...prev,
                    lastGeneratedCode: generatedCode
                  }));
                  
                  // Clear thinking state when generation completes
                  setGenerationProgress(prev =&amp;gt; ({
                    ...prev,
                    isThinking: false,
                    thinkingText: undefined,
                    thinkingDuration: undefined
                  }));
                  
                  // Store packages to install from tool calls
                  if (data.packagesToInstall &amp;&amp; data.packagesToInstall.length &amp;gt; 0) {
                    console.log(&apos;[generate-code] Packages to install from tools:&apos;, data.packagesToInstall);
                    // Store packages globally for later installation
                    (window as any).pendingPackages = data.packagesToInstall;
                  }
                  
                  // Parse all files from the completed code if not already done
                  const fileRegex = /&amp;lt;file path=&quot;([^&quot;]+)&quot;&amp;gt;([^]*?)&amp;lt;\/file&amp;gt;/g;
                  const parsedFiles: Array&amp;lt;{path: string; content: string; type: string; completed: boolean}&amp;gt; = [];
                  let fileMatch;
                  
                  while ((fileMatch = fileRegex.exec(data.generatedCode)) !== null) {
                    const filePath = fileMatch[1];
                    const fileContent = fileMatch[2];
                    const fileExt = filePath.split(&apos;.&apos;).pop() || &apos;&apos;;
                    const fileType = fileExt === &apos;jsx&apos; || fileExt === &apos;js&apos; ? &apos;javascript&apos; :
                                    fileExt === &apos;css&apos; ? &apos;css&apos; :
                                    fileExt === &apos;json&apos; ? &apos;json&apos; :
                                    fileExt === &apos;html&apos; ? &apos;html&apos; : &apos;text&apos;;
                    
                    parsedFiles.push({
                      path: filePath,
                      content: fileContent.trim(),
                      type: fileType,
                      completed: true
                    });
                  }
                  
                  setGenerationProgress(prev =&amp;gt; ({
                    ...prev,
                    status: `Generated ${parsedFiles.length &amp;gt; 0 ? parsedFiles.length : prev.files.length} file${(parsedFiles.length &amp;gt; 0 ? parsedFiles.length : prev.files.length) !== 1 ? &apos;s&apos; : &apos;&apos;}!`,
                    isGenerating: false,
                    isStreaming: false,
                    isEdit: prev.isEdit,
                    // Keep the files that were already parsed during streaming
                    files: prev.files.length &amp;gt; 0 ? prev.files : parsedFiles
                  }));
                } else if (data.type === &apos;error&apos;) {
                  throw new Error(data.error);
                }
              } catch (e) {
                console.error(&apos;Failed to parse SSE data:&apos;, e);
              }
            }
          }
        }
      }
      
      if (generatedCode) {
        // Parse files from generated code for metadata
        const fileRegex = /&amp;lt;file path=&quot;([^&quot;]+)&quot;&amp;gt;([^]*?)&amp;lt;\/file&amp;gt;/g;
        const generatedFiles = [];
        let match;
        while ((match = fileRegex.exec(generatedCode)) !== null) {
          generatedFiles.push(match[1]);
        }
        
        // Show appropriate message based on edit mode
        if (isEdit &amp;&amp; generatedFiles.length &amp;gt; 0) {
          // For edits, show which file(s) were edited
          const editedFileNames = generatedFiles.map(f =&amp;gt; f.split(&apos;/&apos;).pop()).join(&apos;, &apos;);
          addChatMessage(
            explanation || `Updated ${editedFileNames}`,
            &apos;ai&apos;,
            {
              appliedFiles: [generatedFiles[0]] // Only show the first edited file
            }
          );
        } else {
          // For new generation, show all files
          addChatMessage(explanation || &apos;Code generated!&apos;, &apos;ai&apos;, {
            appliedFiles: generatedFiles
          });
        }
        
        setPromptInput(generatedCode);
        // Don&apos;t show the Generated Code panel by default
        // setLeftPanelVisible(true);
        
        // Wait for sandbox creation if it&apos;s still in progress
        if (sandboxPromise) {
          addChatMessage(&apos;Waiting for sandbox to be ready...&apos;, &apos;system&apos;);
          try {
            await sandboxPromise;
            // Remove the waiting message
            setChatMessages(prev =&amp;gt; prev.filter(msg =&amp;gt; msg.content !== &apos;Waiting for sandbox to be ready...&apos;));
          } catch {
            addChatMessage(&apos;Sandbox creation failed. Cannot apply code.&apos;, &apos;system&apos;);
            return;
          }
        }
        
        if (sandboxData &amp;&amp; generatedCode) {
          // Use isEdit flag that was determined at the start
          await applyGeneratedCode(generatedCode, isEdit);
        }
      }
      
      // Show completion status briefly then switch to preview
      setGenerationProgress(prev =&amp;gt; ({
        ...prev,
        isGenerating: false,
        isStreaming: false,
        status: &apos;Generation complete!&apos;,
        isEdit: prev.isEdit,
        // Clear thinking state on completion
        isThinking: false,
        thinkingText: undefined,
        thinkingDuration: undefined
      }));
      
      setTimeout(() =&amp;gt; {
        // Switch to preview but keep files for display
        setActiveTab(&apos;preview&apos;);
      }, 1000); // Reduced from 3000ms to 1000ms
    } catch (error: any) {
      setChatMessages(prev =&amp;gt; prev.filter(msg =&amp;gt; msg.content !== &apos;Thinking...&apos;));
      addChatMessage(`Error: ${error.message}`, &apos;system&apos;);
      // Reset generation progress and switch back to preview on error
      setGenerationProgress({
        isGenerating: false,
        status: &apos;&apos;,
        components: [],
        currentComponent: 0,
        streamedCode: &apos;&apos;,
        isStreaming: false,
        isThinking: false,
        thinkingText: undefined,
        thinkingDuration: undefined,
        files: [],
        currentFile: undefined,
        lastProcessedPosition: 0
      });
      setActiveTab(&apos;preview&apos;);
    }
  };


  const downloadZip = async () =&amp;gt; {
    if (!sandboxData) {
      addChatMessage(&apos;No active sandbox to download. Create a sandbox first!&apos;, &apos;system&apos;);
      return;
    }
    
    setLoading(true);
    log(&apos;Creating zip file...&apos;);
    addChatMessage(&apos;Creating ZIP file of your Vite app...&apos;, &apos;system&apos;);
    
    try {
      const response = await fetch(&apos;/api/create-zip&apos;, {
        method: &apos;POST&apos;,
        headers: { &apos;Content-Type&apos;: &apos;application/json&apos; }
      });
      
      const data = await response.json();
      
      if (data.success) {
        log(&apos;Zip file created!&apos;);
        addChatMessage(&apos;ZIP file created! Download starting...&apos;, &apos;system&apos;);
        
        const link = document.createElement(&apos;a&apos;);
        link.href = data.dataUrl;
        link.download = data.fileName || &apos;e2b-project.zip&apos;;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        addChatMessage(
          &apos;Your Vite app has been downloaded! To run it locally:\n&apos; +
          &apos;1. Unzip the file\n&apos; +
          &apos;2. Run: npm install\n&apos; +
          &apos;3. Run: npm run dev\n&apos; +
          &apos;4. Open http://localhost:5173&apos;,
          &apos;system&apos;
        );
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      log(`Failed to create zip: ${error.message}`, &apos;error&apos;);
      addChatMessage(`Failed to create ZIP: ${error.message}`, &apos;system&apos;);
    } finally {
      setLoading(false);
    }
  };

  const reapplyLastGeneration = async () =&amp;gt; {
    if (!conversationContext.lastGeneratedCode) {
      addChatMessage(&apos;No previous generation to re-apply&apos;, &apos;system&apos;);
      return;
    }
    
    if (!sandboxData) {
      addChatMessage(&apos;Please create a sandbox first&apos;, &apos;system&apos;);
      return;
    }
    
    addChatMessage(&apos;Re-applying last generation...&apos;, &apos;system&apos;);
    const isEdit = conversationContext.appliedCode.length &amp;gt; 0;
    await applyGeneratedCode(conversationContext.lastGeneratedCode, isEdit);
  };

  // Auto-scroll code display to bottom when streaming
  useEffect(() =&amp;gt; {
    if (codeDisplayRef.current &amp;&amp; generationProgress.isStreaming) {
      codeDisplayRef.current.scrollTop = codeDisplayRef.current.scrollHeight;
    }
  }, [generationProgress.streamedCode, generationProgress.isStreaming]);

  const toggleFolder = (folderPath: string) =&amp;gt; {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileClick = async (filePath: string) =&amp;gt; {
    setSelectedFile(filePath);
    // TODO: Add file content fetching logic here
  };

  const getFileIcon = (fileName: string) =&amp;gt; {
    const ext = fileName.split(&apos;.&apos;).pop()?.toLowerCase();
    
    if (ext === &apos;jsx&apos; || ext === &apos;js&apos;) {
      return &amp;lt;SiJavascript className=&quot;w-4 h-4 text-yellow-500&quot; /&amp;gt;;
    } else if (ext === &apos;tsx&apos; || ext === &apos;ts&apos;) {
      return &amp;lt;SiReact className=&quot;w-4 h-4 text-blue-500&quot; /&amp;gt;;
    } else if (ext === &apos;css&apos;) {
      return &amp;lt;SiCss3 className=&quot;w-4 h-4 text-blue-500&quot; /&amp;gt;;
    } else if (ext === &apos;json&apos;) {
      return &amp;lt;SiJson className=&quot;w-4 h-4 text-gray-600&quot; /&amp;gt;;
    } else {
      return &amp;lt;FiFile className=&quot;w-4 h-4 text-gray-600&quot; /&amp;gt;;
    }
  };

  const clearChatHistory = () =&amp;gt; {
    setChatMessages([{
      content: &apos;Chat history cleared. How can I help you?&apos;,
      type: &apos;system&apos;,
      timestamp: new Date()
    }]);
  };


  const cloneWebsite = async () =&amp;gt; {
    let url = urlInput.trim();
    if (!url) {
      setUrlStatus(prev =&amp;gt; [...prev, &apos;Please enter a URL&apos;]);
      return;
    }
    
    if (!url.match(/^https?:\/\//i)) {
      url = &apos;https://&apos; + url;
    }
    
    setUrlStatus([`Using: ${url}`, &apos;Starting to scrape...&apos;]);
    
    setUrlOverlayVisible(false);
    
    // Remove protocol for cleaner display
    const cleanUrl = url.replace(/^https?:\/\//i, &apos;&apos;);
    addChatMessage(`Starting to clone ${cleanUrl}...`, &apos;system&apos;);
    
    // Capture screenshot immediately and switch to preview tab
    captureUrlScreenshot(url);
    
    try {
      addChatMessage(&apos;Scraping website content...&apos;, &apos;system&apos;);
      const scrapeResponse = await fetch(&apos;/api/scrape-url-enhanced&apos;, {
        method: &apos;POST&apos;,
        headers: { &apos;Content-Type&apos;: &apos;application/json&apos; },
        body: JSON.stringify({ url })
      });
      
      if (!scrapeResponse.ok) {
        throw new Error(`Scraping failed: ${scrapeResponse.status}`);
      }
      
      const scrapeData = await scrapeResponse.json();
      
      if (!scrapeData.success) {
        throw new Error(scrapeData.error || &apos;Failed to scrape website&apos;);
      }
      
      addChatMessage(`Scraped ${scrapeData.content.length} characters from ${url}`, &apos;system&apos;);
      
      // Clear preparing design state and switch to generation tab
      setIsPreparingDesign(false);
      setActiveTab(&apos;generation&apos;);
      
      setConversationContext(prev =&amp;gt; ({
        ...prev,
        scrapedWebsites: [...prev.scrapedWebsites, {
          url,
          content: scrapeData,
          timestamp: new Date()
        }],
        currentProject: `Clone of ${url}`
      }));
      
      // Start sandbox creation in parallel with code generation
      let sandboxPromise: Promise&amp;lt;void&amp;gt; | null = null;
      if (!sandboxData) {
        addChatMessage(&apos;Creating sandbox while generating your React app...&apos;, &apos;system&apos;);
        sandboxPromise = createSandbox(true);
      }
      
      addChatMessage(&apos;Analyzing and generating React recreation...&apos;, &apos;system&apos;);
      
      const recreatePrompt = `I scraped this website and want you to recreate it as a modern React application.

URL: ${url}

SCRAPED CONTENT:
${scrapeData.content}

${homeContextInput ? `ADDITIONAL CONTEXT/REQUIREMENTS FROM USER:
${homeContextInput}

Please incorporate these requirements into the design and implementation.` : &apos;&apos;}

REQUIREMENTS:
1. Create a COMPLETE React application with App.jsx as the main component
2. App.jsx MUST import and render all other components
3. Recreate the main sections and layout from the scraped content
4. ${homeContextInput ? `Apply the user&apos;s context/theme: &quot;${homeContextInput}&quot;` : `Use a modern dark theme with excellent contrast:
   - Background: #0a0a0a
   - Text: #ffffff
   - Links: #60a5fa
   - Accent: #3b82f6`}
5. Make it fully responsive
6. Include hover effects and smooth transitions
7. Create separate components for major sections (Header, Hero, Features, etc.)
8. Use semantic HTML5 elements

IMPORTANT CONSTRAINTS:
- DO NOT use React Router or any routing libraries
- Use regular &amp;lt;a&amp;gt; tags with href=&quot;#section&quot; for navigation, NOT Link or NavLink components
- This is a single-page application, no routing needed
- ALWAYS create src/App.jsx that imports ALL components
- Each component should be in src/components/
- Use Tailwind CSS for ALL styling (no custom CSS files)
- Make sure the app actually renders visible content
- Create ALL components that you reference in imports

IMAGE HANDLING RULES:
- When the scraped content includes images, USE THE ORIGINAL IMAGE URLS whenever appropriate
- Keep existing images from the scraped site (logos, product images, hero images, icons, etc.)
- Use the actual image URLs provided in the scraped content, not placeholders
- Only use placeholder images or generic services when no real images are available
- For company logos and brand images, ALWAYS use the original URLs to maintain brand identity
- If scraped data contains image URLs, include them in your img tags
- Example: If you see &quot;https://example.com/logo.png&quot; in the scraped content, use that exact URL

Focus on the key sections and content, making it clean and modern while preserving visual assets.`;
      
      setGenerationProgress(prev =&amp;gt; ({
        isGenerating: true,
        status: &apos;Initializing AI...&apos;,
        components: [],
        currentComponent: 0,
        streamedCode: &apos;&apos;,
        isStreaming: true,
        isThinking: false,
        thinkingText: undefined,
        thinkingDuration: undefined,
        // Keep previous files until new ones are generated
        files: prev.files || [],
        currentFile: undefined,
        lastProcessedPosition: 0
      }));
      
      // Switch to generation tab when starting
      setActiveTab(&apos;generation&apos;);
      
      const aiResponse = await fetch(&apos;/api/generate-ai-code-stream&apos;, {
        method: &apos;POST&apos;,
        headers: { &apos;Content-Type&apos;: &apos;application/json&apos; },
        body: JSON.stringify({
          prompt: recreatePrompt,
          model: aiModel,
          context: {
            sandboxId: sandboxData?.id,
            structure: structureContent,
            conversationContext: conversationContext
          }
        })
      });
      
      if (!aiResponse.ok) {
        throw new Error(`AI generation failed: ${aiResponse.status}`);
      }
      
      const reader = aiResponse.body?.getReader();
      const decoder = new TextDecoder();
      let generatedCode = &apos;&apos;;
      let explanation = &apos;&apos;;
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split(&apos;\n&apos;);
          
          for (const line of lines) {
            if (line.startsWith(&apos;data: &apos;)) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === &apos;status&apos;) {
                  setGenerationProgress(prev =&amp;gt; ({ ...prev, status: data.message }));
                } else if (data.type === &apos;thinking&apos;) {
                  setGenerationProgress(prev =&amp;gt; ({ 
                    ...prev, 
                    isThinking: true,
                    thinkingText: (prev.thinkingText || &apos;&apos;) + data.text
                  }));
                } else if (data.type === &apos;thinking_complete&apos;) {
                  setGenerationProgress(prev =&amp;gt; ({ 
                    ...prev, 
                    isThinking: false,
                    thinkingDuration: data.duration
                  }));
                } else if (data.type === &apos;conversation&apos;) {
                  // Add conversational text to chat only if it&apos;s not code
                  let text = data.text || &apos;&apos;;
                  
                  // Remove package tags from the text
                  text = text.replace(/&amp;lt;package&amp;gt;[^&amp;lt;]*&amp;lt;\/package&amp;gt;/g, &apos;&apos;);
                  text = text.replace(/&amp;lt;packages&amp;gt;[^&amp;lt;]*&amp;lt;\/packages&amp;gt;/g, &apos;&apos;);
                  
                  // Filter out any XML tags and file content that slipped through
                  if (!text.includes(&apos;&amp;lt;file&apos;) &amp;&amp; !text.includes(&apos;import React&apos;) &amp;&amp; 
                      !text.includes(&apos;export default&apos;) &amp;&amp; !text.includes(&apos;className=&apos;) &amp;&amp;
                      text.trim().length &amp;gt; 0) {
                    addChatMessage(text.trim(), &apos;ai&apos;);
                  }
                } else if (data.type === &apos;stream&apos; &amp;&amp; data.raw) {
                  setGenerationProgress(prev =&amp;gt; ({ 
                    ...prev, 
                    streamedCode: prev.streamedCode + data.text,
                    lastProcessedPosition: prev.lastProcessedPosition || 0
                  }));
                } else if (data.type === &apos;component&apos;) {
                  setGenerationProgress(prev =&amp;gt; ({
                    ...prev,
                    status: `Generated ${data.name}`,
                    components: [...prev.components, { 
                      name: data.name,
                      path: data.path,
                      completed: true
                    }],
                    currentComponent: prev.currentComponent + 1
                  }));
                } else if (data.type === &apos;complete&apos;) {
                  generatedCode = data.generatedCode;
                  explanation = data.explanation;
                  
                  // Save the last generated code
                  setConversationContext(prev =&amp;gt; ({
                    ...prev,
                    lastGeneratedCode: generatedCode
                  }));
                }
              } catch (e) {
                console.error(&apos;Error parsing streaming data:&apos;, e);
              }
            }
          }
        }
      }
      
      setGenerationProgress(prev =&amp;gt; ({
        ...prev,
        isGenerating: false,
        isStreaming: false,
        status: &apos;Generation complete!&apos;,
        isEdit: prev.isEdit
      }));
      
      if (generatedCode) {
        addChatMessage(&apos;AI recreation generated!&apos;, &apos;system&apos;);
        
        // Add the explanation to chat if available
        if (explanation &amp;&amp; explanation.trim()) {
          addChatMessage(explanation, &apos;ai&apos;);
        }
        
        setPromptInput(generatedCode);
        // Don&apos;t show the Generated Code panel by default
        // setLeftPanelVisible(true);
        
        // Wait for sandbox creation if it&apos;s still in progress
        if (sandboxPromise) {
          addChatMessage(&apos;Waiting for sandbox to be ready...&apos;, &apos;system&apos;);
          try {
            await sandboxPromise;
            // Remove the waiting message
            setChatMessages(prev =&amp;gt; prev.filter(msg =&amp;gt; msg.content !== &apos;Waiting for sandbox to be ready...&apos;));
          } catch (error: any) {
            addChatMessage(&apos;Sandbox creation failed. Cannot apply code.&apos;, &apos;system&apos;);
            throw error;
          }
        }
        
        // First application for cloned site should not be in edit mode
        await applyGeneratedCode(generatedCode, false);
        
        addChatMessage(
          `Successfully recreated ${url} as a modern React app${homeContextInput ? ` with your requested context: &quot;${homeContextInput}&quot;` : &apos;&apos;}! The scraped content is now in my context, so you can ask me to modify specific sections or add features based on the original site.`, 
          &apos;ai&apos;,
          {
            scrapedUrl: url,
            scrapedContent: scrapeData,
            generatedCode: generatedCode
          }
        );
        
        setUrlInput(&apos;&apos;);
        setUrlStatus([]);
        setHomeContextInput(&apos;&apos;);
        
        // Clear generation progress and all screenshot/design states
        setGenerationProgress(prev =&amp;gt; ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: &apos;Generation complete!&apos;
        }));
        
        // Clear screenshot and preparing design states to prevent them from showing on next run
        setUrlScreenshot(null);
        setIsPreparingDesign(false);
        setTargetUrl(&apos;&apos;);
        setScreenshotError(null);
        setLoadingStage(null); // Clear loading stage
        
        setTimeout(() =&amp;gt; {
          // Switch back to preview tab but keep files
          setActiveTab(&apos;preview&apos;);
        }, 1000); // Show completion briefly then switch
      } else {
        throw new Error(&apos;Failed to generate recreation&apos;);
      }
      
    } catch (error: any) {
      addChatMessage(`Failed to clone website: ${error.message}`, &apos;system&apos;);
      setUrlStatus([]);
      setIsPreparingDesign(false);
      // Clear all states on error
      setUrlScreenshot(null);
      setTargetUrl(&apos;&apos;);
      setScreenshotError(null);
      setLoadingStage(null);
      setGenerationProgress(prev =&amp;gt; ({
        ...prev,
        isGenerating: false,
        isStreaming: false,
        status: &apos;&apos;,
        // Keep files to display in sidebar
        files: prev.files
      }));
      setActiveTab(&apos;preview&apos;);
    }
  };

  const captureUrlScreenshot = async (url: string) =&amp;gt; {
    setIsCapturingScreenshot(true);
    setScreenshotError(null);
    try {
      const response = await fetch(&apos;/api/scrape-screenshot&apos;, {
        method: &apos;POST&apos;,
        headers: { &apos;Content-Type&apos;: &apos;application/json&apos; },
        body: JSON.stringify({ url })
      });
      
      const data = await response.json();
      if (data.success &amp;&amp; data.screenshot) {
        setUrlScreenshot(data.screenshot);
        // Set preparing design state
        setIsPreparingDesign(true);
        // Store the clean URL for display
        const cleanUrl = url.replace(/^https?:\/\//i, &apos;&apos;);
        setTargetUrl(cleanUrl);
        // Switch to preview tab to show the screenshot
        if (activeTab !== &apos;preview&apos;) {
          setActiveTab(&apos;preview&apos;);
        }
      } else {
        setScreenshotError(data.error || &apos;Failed to capture screenshot&apos;);
      }
    } catch (error) {
      console.error(&apos;Failed to capture screenshot:&apos;, error);
      setScreenshotError(&apos;Network error while capturing screenshot&apos;);
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  const handleHomeScreenSubmit = async (e: React.FormEvent) =&amp;gt; {
    e.preventDefault();
    if (!homeUrlInput.trim()) return;
    
    setHomeScreenFading(true);
    
    // Clear messages and immediately show the cloning message
    setChatMessages([]);
    let displayUrl = homeUrlInput.trim();
    if (!displayUrl.match(/^https?:\/\//i)) {
      displayUrl = &apos;https://&apos; + displayUrl;
    }
    // Remove protocol for cleaner display
    const cleanUrl = displayUrl.replace(/^https?:\/\//i, &apos;&apos;);
    addChatMessage(`Starting to clone ${cleanUrl}...`, &apos;system&apos;);
    
    // Start creating sandbox and capturing screenshot immediately in parallel
    const sandboxPromise = !sandboxData ? createSandbox(true) : Promise.resolve();
    
    // Only capture screenshot if we don&apos;t already have a sandbox (first generation)
    // After sandbox is set up, skip the screenshot phase for faster generation
    if (!sandboxData) {
      captureUrlScreenshot(displayUrl);
    }
    
    // Set loading stage immediately before hiding home screen
    setLoadingStage(&apos;gathering&apos;);
    // Also ensure we&apos;re on preview tab to show the loading overlay
    setActiveTab(&apos;preview&apos;);
    
    setTimeout(async () =&amp;gt; {
      setShowHomeScreen(false);
      setHomeScreenFading(false);
      
      // Wait for sandbox to be ready (if it&apos;s still creating)
      await sandboxPromise;
      
      // Now start the clone process which will stream the generation
      setUrlInput(homeUrlInput);
      setUrlOverlayVisible(false); // Make sure overlay is closed
      setUrlStatus([&apos;Scraping website content...&apos;]);
      
      try {
        // Scrape the website
        let url = homeUrlInput.trim();
        if (!url.match(/^https?:\/\//i)) {
          url = &apos;https://&apos; + url;
        }
        
        // Screenshot is already being captured in parallel above
        
        const scrapeResponse = await fetch(&apos;/api/scrape-url-enhanced&apos;, {
          method: &apos;POST&apos;,
          headers: { &apos;Content-Type&apos;: &apos;application/json&apos; },
          body: JSON.stringify({ url })
        });
        
        if (!scrapeResponse.ok) {
          throw new Error(&apos;Failed to scrape website&apos;);
        }
        
        const scrapeData = await scrapeResponse.json();
        
        if (!scrapeData.success) {
          throw new Error(scrapeData.error || &apos;Failed to scrape website&apos;);
        }
        
        setUrlStatus([&apos;Website scraped successfully!&apos;, &apos;Generating React app...&apos;]);
        
        // Clear preparing design state and switch to generation tab
        setIsPreparingDesign(false);
        setUrlScreenshot(null); // Clear screenshot when starting generation
        setTargetUrl(&apos;&apos;); // Clear target URL
        
        // Update loading stage to planning
        setLoadingStage(&apos;planning&apos;);
        
        // Brief pause before switching to generation tab
        setTimeout(() =&amp;gt; {
          setLoadingStage(&apos;generating&apos;);
          setActiveTab(&apos;generation&apos;);
        }, 1500);
        
        // Store scraped data in conversation context
        setConversationContext(prev =&amp;gt; ({
          ...prev,
          scrapedWebsites: [...prev.scrapedWebsites, {
            url: url,
            content: scrapeData,
            timestamp: new Date()
          }],
          currentProject: `${url} Clone`
        }));
        
        const prompt = `I want to recreate the ${url} website as a complete React application based on the scraped content below.

${JSON.stringify(scrapeData, null, 2)}

${homeContextInput ? `ADDITIONAL CONTEXT/REQUIREMENTS FROM USER:
${homeContextInput}

Please incorporate these requirements into the design and implementation.` : &apos;&apos;}

IMPORTANT INSTRUCTIONS:
- Create a COMPLETE, working React application
- Implement ALL sections and features from the original site
- Use Tailwind CSS for all styling (no custom CSS files)
- Make it responsive and modern
- Ensure all text content matches the original
- Create proper component structure
- Make sure the app actually renders visible content
- Create ALL components that you reference in imports
${homeContextInput ? &apos;- Apply the user\&apos;s context/theme requirements throughout the application&apos; : &apos;&apos;}

Focus on the key sections and content, making it clean and modern.`;
        
        setGenerationProgress(prev =&amp;gt; ({
          isGenerating: true,
          status: &apos;Initializing AI...&apos;,
          components: [],
          currentComponent: 0,
          streamedCode: &apos;&apos;,
          isStreaming: true,
          isThinking: false,
          thinkingText: undefined,
          thinkingDuration: undefined,
          // Keep previous files until new ones are generated
          files: prev.files || [],
          currentFile: undefined,
          lastProcessedPosition: 0
        }));
        
        const aiResponse = await fetch(&apos;/api/generate-ai-code-stream&apos;, {
          method: &apos;POST&apos;,
          headers: { &apos;Content-Type&apos;: &apos;application/json&apos; },
          body: JSON.stringify({ 
            prompt,
            model: aiModel,
            context: {
              sandboxId: sandboxData?.sandboxId,
              structure: structureContent,
              conversationContext: conversationContext
            }
          })
        });
        
        if (!aiResponse.ok || !aiResponse.body) {
          throw new Error(&apos;Failed to generate code&apos;);
        }
        
        const reader = aiResponse.body.getReader();
        const decoder = new TextDecoder();
        let generatedCode = &apos;&apos;;
        let explanation = &apos;&apos;;
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split(&apos;\n&apos;);
          
          for (const line of lines) {
            if (line.startsWith(&apos;data: &apos;)) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === &apos;status&apos;) {
                  setGenerationProgress(prev =&amp;gt; ({ ...prev, status: data.message }));
                } else if (data.type === &apos;thinking&apos;) {
                  setGenerationProgress(prev =&amp;gt; ({ 
                    ...prev, 
                    isThinking: true,
                    thinkingText: (prev.thinkingText || &apos;&apos;) + data.text
                  }));
                } else if (data.type === &apos;thinking_complete&apos;) {
                  setGenerationProgress(prev =&amp;gt; ({ 
                    ...prev, 
                    isThinking: false,
                    thinkingDuration: data.duration
                  }));
                } else if (data.type === &apos;conversation&apos;) {
                  // Add conversational text to chat only if it&apos;s not code
                  let text = data.text || &apos;&apos;;
                  
                  // Remove package tags from the text
                  text = text.replace(/&amp;lt;package&amp;gt;[^&amp;lt;]*&amp;lt;\/package&amp;gt;/g, &apos;&apos;);
                  text = text.replace(/&amp;lt;packages&amp;gt;[^&amp;lt;]*&amp;lt;\/packages&amp;gt;/g, &apos;&apos;);
                  
                  // Filter out any XML tags and file content that slipped through
                  if (!text.includes(&apos;&amp;lt;file&apos;) &amp;&amp; !text.includes(&apos;import React&apos;) &amp;&amp; 
                      !text.includes(&apos;export default&apos;) &amp;&amp; !text.includes(&apos;className=&apos;) &amp;&amp;
                      text.trim().length &amp;gt; 0) {
                    addChatMessage(text.trim(), &apos;ai&apos;);
                  }
                } else if (data.type === &apos;stream&apos; &amp;&amp; data.raw) {
                  setGenerationProgress(prev =&amp;gt; {
                    const newStreamedCode = prev.streamedCode + data.text;
                    
                    // Tab is already switched after scraping
                    
                    const updatedState = { 
                      ...prev, 
                      streamedCode: newStreamedCode,
                      isStreaming: true,
                      isThinking: false,
                      status: &apos;Generating code...&apos;
                    };
                    
                    // Process complete files from the accumulated stream
                    const fileRegex = /&amp;lt;file path=&quot;([^&quot;]+)&quot;&amp;gt;([^]*?)&amp;lt;\/file&amp;gt;/g;
                    let match;
                    const processedFiles = new Set(prev.files.map(f =&amp;gt; f.path));
                    
                    while ((match = fileRegex.exec(newStreamedCode)) !== null) {
                      const filePath = match[1];
                      const fileContent = match[2];
                      
                      // Only add if we haven&apos;t processed this file yet
                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split(&apos;.&apos;).pop() || &apos;&apos;;
                        const fileType = fileExt === &apos;jsx&apos; || fileExt === &apos;js&apos; ? &apos;javascript&apos; :
                                        fileExt === &apos;css&apos; ? &apos;css&apos; :
                                        fileExt === &apos;json&apos; ? &apos;json&apos; :
                                        fileExt === &apos;html&apos; ? &apos;html&apos; : &apos;text&apos;;
                        
                        // Check if file already exists
                        const existingFileIndex = updatedState.files.findIndex(f =&amp;gt; f.path === filePath);
                        
                        if (existingFileIndex &amp;gt;= 0) {
                          // Update existing file and mark as edited
                          updatedState.files = [
                            ...updatedState.files.slice(0, existingFileIndex),
                            {
                              ...updatedState.files[existingFileIndex],
                              content: fileContent.trim(),
                              type: fileType,
                              completed: true,
                              edited: true
                            } as any,
                            ...updatedState.files.slice(existingFileIndex + 1)
                          ];
                        } else {
                          // Add new file
                          updatedState.files = [...updatedState.files, {
                            path: filePath,
                            content: fileContent.trim(),
                            type: fileType,
                            completed: true,
                            edited: false
                          } as any];
                        }
                        
                        // Only show file status if not in edit mode
                        if (!prev.isEdit) {
                          updatedState.status = `Completed ${filePath}`;
                        }
                        processedFiles.add(filePath);
                      }
                    }
                    
                    // Check for current file being generated (incomplete file at the end)
                    const lastFileMatch = newStreamedCode.match(/&amp;lt;file path=&quot;([^&quot;]+)&quot;&amp;gt;([^]*?)$/);
                    if (lastFileMatch &amp;&amp; !lastFileMatch[0].includes(&apos;&amp;lt;/file&amp;gt;&apos;)) {
                      const filePath = lastFileMatch[1];
                      const partialContent = lastFileMatch[2];
                      
                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split(&apos;.&apos;).pop() || &apos;&apos;;
                        const fileType = fileExt === &apos;jsx&apos; || fileExt === &apos;js&apos; ? &apos;javascript&apos; :
                                        fileExt === &apos;css&apos; ? &apos;css&apos; :
                                        fileExt === &apos;json&apos; ? &apos;json&apos; :
                                        fileExt === &apos;html&apos; ? &apos;html&apos; : &apos;text&apos;;
                        
                        updatedState.currentFile = { 
                          path: filePath, 
                          content: partialContent, 
                          type: fileType 
                        };
                        // Only show file status if not in edit mode
                        if (!prev.isEdit) {
                          updatedState.status = `Generating ${filePath}`;
                        }
                      }
                    } else {
                      updatedState.currentFile = undefined;
                    }
                    
                    return updatedState;
                  });
                } else if (data.type === &apos;complete&apos;) {
                  generatedCode = data.generatedCode;
                  explanation = data.explanation;
                  
                  // Save the last generated code
                  setConversationContext(prev =&amp;gt; ({
                    ...prev,
                    lastGeneratedCode: generatedCode
                  }));
                }
              } catch (e) {
                console.error(&apos;Failed to parse SSE data:&apos;, e);
              }
            }
          }
        }
        
        setGenerationProgress(prev =&amp;gt; ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: &apos;Generation complete!&apos;
        }));
        
        if (generatedCode) {
          addChatMessage(&apos;AI recreation generated!&apos;, &apos;system&apos;);
          
          // Add the explanation to chat if available
          if (explanation &amp;&amp; explanation.trim()) {
            addChatMessage(explanation, &apos;ai&apos;);
          }
          
          setPromptInput(generatedCode);
          
          // First application for cloned site should not be in edit mode
          await applyGeneratedCode(generatedCode, false);
          
          addChatMessage(
            `Successfully recreated ${url} as a modern React app${homeContextInput ? ` with your requested context: &quot;${homeContextInput}&quot;` : &apos;&apos;}! The scraped content is now in my context, so you can ask me to modify specific sections or add features based on the original site.`, 
            &apos;ai&apos;,
            {
              scrapedUrl: url,
              scrapedContent: scrapeData,
              generatedCode: generatedCode
            }
          );
          
          setConversationContext(prev =&amp;gt; ({
            ...prev,
            generatedComponents: [],
            appliedCode: [...prev.appliedCode, {
              files: [],
              timestamp: new Date()
            }]
          }));
        } else {
          throw new Error(&apos;Failed to generate recreation&apos;);
        }
        
        setUrlInput(&apos;&apos;);
        setUrlStatus([]);
        setHomeContextInput(&apos;&apos;);
        
        // Clear generation progress and all screenshot/design states
        setGenerationProgress(prev =&amp;gt; ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: &apos;Generation complete!&apos;
        }));
        
        // Clear screenshot and preparing design states to prevent them from showing on next run
        setUrlScreenshot(null);
        setIsPreparingDesign(false);
        setTargetUrl(&apos;&apos;);
        setScreenshotError(null);
        setLoadingStage(null); // Clear loading stage
        
        setTimeout(() =&amp;gt; {
          // Switch back to preview tab but keep files
          setActiveTab(&apos;preview&apos;);
        }, 1000); // Show completion briefly then switch
      } catch (error: any) {
        addChatMessage(`Failed to clone website: ${error.message}`, &apos;system&apos;);
        setUrlStatus([]);
        setIsPreparingDesign(false);
        // Also clear generation progress on error
        setGenerationProgress(prev =&amp;gt; ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: &apos;&apos;,
          // Keep files to display in sidebar
          files: prev.files
        }));
      }
    }, 500);
  };

  return (
    &amp;lt;div className=&quot;font-sans bg-background text-foreground h-screen flex flex-col&quot;&amp;gt;
      {/* Home Screen Overlay */}
      {showHomeScreen &amp;&amp; (
        &amp;lt;div className={`fixed inset-0 z-50 transition-opacity duration-500 ${homeScreenFading ? &apos;opacity-0&apos; : &apos;opacity-100&apos;}`}&amp;gt;
          {/* Simple Sun Gradient Background */}
          &amp;lt;div className=&quot;absolute inset-0 bg-white overflow-hidden&quot;&amp;gt;
            {/* Main Sun - Pulsing */}
            &amp;lt;div className=&quot;absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-orange-400/50 via-orange-300/30 to-transparent rounded-full blur-[80px] animate-[sunPulse_4s_ease-in-out_infinite]&quot; /&amp;gt;
            
            {/* Inner Sun Core - Brighter */}
            &amp;lt;div className=&quot;absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-radial from-yellow-300/40 via-orange-400/30 to-transparent rounded-full blur-[40px] animate-[sunPulse_4s_ease-in-out_infinite_0.5s]&quot; /&amp;gt;
            
            {/* Outer Glow - Subtle */}
            &amp;lt;div className=&quot;absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] bg-gradient-radial from-orange-200/20 to-transparent rounded-full blur-[120px]&quot; /&amp;gt;
            
            {/* Giant Glowing Orb - Center Bottom */}
            &amp;lt;div className=&quot;absolute bottom-0 left-1/2 w-[800px] h-[800px] animate-[orbShrink_3s_ease-out_forwards]&quot; style={{ transform: &apos;translateX(-50%) translateY(45%)&apos; }}&amp;gt;
              &amp;lt;div className=&quot;relative w-full h-full&quot;&amp;gt;
                &amp;lt;div className=&quot;absolute inset-0 bg-orange-600 rounded-full blur-[100px] opacity-30 animate-pulse&quot;&amp;gt;&amp;lt;/div&amp;gt;
                &amp;lt;div className=&quot;absolute inset-16 bg-orange-500 rounded-full blur-[80px] opacity-40 animate-pulse&quot; style={{ animationDelay: &apos;0.3s&apos; }}&amp;gt;&amp;lt;/div&amp;gt;
                &amp;lt;div className=&quot;absolute inset-32 bg-orange-400 rounded-full blur-[60px] opacity-50 animate-pulse&quot; style={{ animationDelay: &apos;0.6s&apos; }}&amp;gt;&amp;lt;/div&amp;gt;
                &amp;lt;div className=&quot;absolute inset-48 bg-yellow-300 rounded-full blur-[40px] opacity-60&quot;&amp;gt;&amp;lt;/div&amp;gt;
              &amp;lt;/div&amp;gt;
            &amp;lt;/div&amp;gt;
          &amp;lt;/div&amp;gt;
          
          
          {/* Close button on hover */}
          &amp;lt;button
            onClick={() =&amp;gt; {
              setHomeScreenFading(true);
              setTimeout(() =&amp;gt; {
                setShowHomeScreen(false);
                setHomeScreenFading(false);
              }, 500);
            }}
            className=&quot;absolute top-8 right-8 text-gray-500 hover:text-gray-700 transition-all duration-300 opacity-0 hover:opacity-100 bg-white/80 backdrop-blur-sm p-2 rounded-lg shadow-sm&quot;
            style={{ opacity: 0 }}
            onMouseEnter={(e) =&amp;gt; e.currentTarget.style.opacity = &apos;0.8&apos;}
            onMouseLeave={(e) =&amp;gt; e.currentTarget.style.opacity = &apos;0&apos;}
          &amp;gt;
            &amp;lt;svg className=&quot;w-8 h-8&quot; fill=&quot;none&quot; viewBox=&quot;0 0 24 24&quot; stroke=&quot;currentColor&quot;&amp;gt;
              &amp;lt;path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth={2} d=&quot;M6 18L18 6M6 6l12 12&quot; /&amp;gt;
            &amp;lt;/svg&amp;gt;
          &amp;lt;/button&amp;gt;
          
          {/* Header */}
          &amp;lt;div className=&quot;absolute top-0 left-0 right-0 z-20 px-6 py-4 flex items-center justify-between animate-[fadeIn_0.8s_ease-out]&quot;&amp;gt;
            &amp;lt;img
              src=&quot;/firecrawl-logo-with-fire.webp&quot;
              alt=&quot;Firecrawl&quot;
              className=&quot;h-8 w-auto&quot;
            /&amp;gt;
            &amp;lt;a 
              href=&quot;https://github.com/mendableai/open-lovable&quot; 
              target=&quot;_blank&quot; 
              rel=&quot;noopener noreferrer&quot;
              className=&quot;inline-flex items-center gap-2 bg-[#36322F] text-white px-3 py-2 rounded-[10px] text-sm font-medium [box-shadow:inset_0px_-2px_0px_0px_#171310,_0px_1px_6px_0px_rgba(58,_33,_8,_58%)] hover:translate-y-[1px] hover:scale-[0.98] hover:[box-shadow:inset_0px_-1px_0px_0px_#171310,_0px_1px_3px_0px_rgba(58,_33,_8,_40%)] active:translate-y-[2px] active:scale-[0.97] active:[box-shadow:inset_0px_1px_1px_0px_#171310,_0px_1px_2px_0px_rgba(58,_33,_8,_30%)] transition-all duration-200&quot;
            &amp;gt;
              &amp;lt;FiGithub className=&quot;w-4 h-4&quot; /&amp;gt;
              &amp;lt;span&amp;gt;Use this template&amp;lt;/span&amp;gt;
            &amp;lt;/a&amp;gt;
          &amp;lt;/div&amp;gt;
          
          {/* Main content */}
          &amp;lt;div className=&quot;relative z-10 h-full flex items-center justify-center px-4&quot;&amp;gt;
            &amp;lt;div className=&quot;text-center max-w-4xl min-w-[600px] mx-auto&quot;&amp;gt;
              {/* Firecrawl-style Header */}
              &amp;lt;div className=&quot;text-center&quot;&amp;gt;
                &amp;lt;h1 className=&quot;text-[2.5rem] lg:text-[3.8rem] text-center text-[#36322F] font-semibold tracking-tight leading-[0.9] animate-[fadeIn_0.8s_ease-out]&quot;&amp;gt;
                  &amp;lt;span className=&quot;hidden md:inline&quot;&amp;gt;Open Lovable&amp;lt;/span&amp;gt;
                  &amp;lt;span className=&quot;md:hidden&quot;&amp;gt;Open Lovable&amp;lt;/span&amp;gt;
                &amp;lt;/h1&amp;gt;
                &amp;lt;motion.p 
                  className=&quot;text-base lg:text-lg max-w-lg mx-auto mt-2.5 text-zinc-500 text-center text-balance&quot;
                  animate={{
                    opacity: showStyleSelector ? 0.7 : 1
                  }}
                  transition={{ duration: 0.3, ease: &quot;easeOut&quot; }}
                &amp;gt;
                  Re-imagine any website, in seconds.
                &amp;lt;/motion.p&amp;gt;
              &amp;lt;/div&amp;gt;
              
              &amp;lt;form onSubmit={handleHomeScreenSubmit} className=&quot;mt-5 max-w-3xl mx-auto&quot;&amp;gt;
                &amp;lt;div className=&quot;w-full relative group&quot;&amp;gt;
                  &amp;lt;input
                    type=&quot;text&quot;
                    value={homeUrlInput}
                    onChange={(e) =&amp;gt; {
                      const value = e.target.value;
                      setHomeUrlInput(value);
                      
                      // Check if it&apos;s a valid domain
                      const domainRegex = /^(https?:\/\/)?(([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})(\/?.*)?$/;
                      if (domainRegex.test(value) &amp;&amp; value.length &amp;gt; 5) {
                        // Small delay to make the animation feel smoother
                        setTimeout(() =&amp;gt; setShowStyleSelector(true), 100);
                      } else {
                        setShowStyleSelector(false);
                        setSelectedStyle(null);
                      }
                    }}
                    placeholder=&quot; &quot;
                    aria-placeholder=&quot;https://firecrawl.dev&quot;
                    className=&quot;h-[3.25rem] w-full resize-none focus-visible:outline-none focus-visible:ring-orange-500 focus-visible:ring-2 rounded-[18px] text-sm text-[#36322F] px-4 pr-12 border-[.75px] border-border bg-white&quot;
                    style={{
                      boxShadow: &apos;0 0 0 1px #e3e1de66, 0 1px 2px #5f4a2e14, 0 4px 6px #5f4a2e0a, 0 40px 40px -24px #684b2514&apos;,
                      filter: &apos;drop-shadow(rgba(249, 224, 184, 0.3) -0.731317px -0.731317px 35.6517px)&apos;
                    }}
                    autoFocus
                  /&amp;gt;
                  &amp;lt;div 
                    aria-hidden=&quot;true&quot; 
                    className={`absolute top-1/2 -translate-y-1/2 left-4 pointer-events-none text-sm text-opacity-50 text-start transition-opacity ${
                      homeUrlInput ? &apos;opacity-0&apos; : &apos;opacity-100&apos;
                    }`}
                  &amp;gt;
                    &amp;lt;span className=&quot;text-[#605A57]/50&quot; style={{ fontFamily: &apos;monospace&apos; }}&amp;gt;
                      https://firecrawl.dev
                    &amp;lt;/span&amp;gt;
                  &amp;lt;/div&amp;gt;
                  &amp;lt;button
                    type=&quot;submit&quot;
                    disabled={!homeUrlInput.trim()}
                    className=&quot;absolute top-1/2 transform -translate-y-1/2 right-2 flex h-10 items-center justify-center rounded-md px-3 text-sm font-medium text-zinc-500 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors&quot;
                    title={selectedStyle ? `Clone with ${selectedStyle} Style` : &apos;Clone Website&apos;}
                  &amp;gt;
                    &amp;lt;svg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;24&quot; height=&quot;24&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; strokeWidth=&quot;2&quot; strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; className=&quot;h-4 w-4&quot;&amp;gt;
                      &amp;lt;polyline points=&quot;9 10 4 15 9 20&quot;&amp;gt;&amp;lt;/polyline&amp;gt;
                      &amp;lt;path d=&quot;M20 4v7a4 4 0 0 1-4 4H4&quot;&amp;gt;&amp;lt;/path&amp;gt;
                    &amp;lt;/svg&amp;gt;
                  &amp;lt;/button&amp;gt;
                &amp;lt;/div&amp;gt;
                  
                  {/* Style Selector - Slides out when valid domain is entered */}
                  {showStyleSelector &amp;&amp; (
                    &amp;lt;div className=&quot;overflow-hidden mt-4&quot;&amp;gt;
                      &amp;lt;div className={`transition-all duration-500 ease-out transform ${
                        showStyleSelector ? &apos;translate-y-0 opacity-100&apos; : &apos;-translate-y-4 opacity-0&apos;
                      }`}&amp;gt;
                    &amp;lt;div className=&quot;bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-4 shadow-sm&quot;&amp;gt;
                      &amp;lt;p className=&quot;text-sm text-gray-600 mb-3 font-medium&quot;&amp;gt;How do you want your site to look?&amp;lt;/p&amp;gt;
                      &amp;lt;div className=&quot;grid grid-cols-2 md:grid-cols-4 gap-2&quot;&amp;gt;
                        {[
                          { name: &apos;Neobrutalist&apos;, description: &apos;Bold colors, thick borders&apos; },
                          { name: &apos;Glassmorphism&apos;, description: &apos;Frosted glass effects&apos; },
                          { name: &apos;Minimalist&apos;, description: &apos;Clean and simple&apos; },
                          { name: &apos;Dark Mode&apos;, description: &apos;Dark theme&apos; },
                          { name: &apos;Gradient&apos;, description: &apos;Colorful gradients&apos; },
                          { name: &apos;Retro&apos;, description: &apos;80s/90s aesthetic&apos; },
                          { name: &apos;Modern&apos;, description: &apos;Contemporary design&apos; },
                          { name: &apos;Monochrome&apos;, description: &apos;Black and white&apos; }
                        ].map((style) =&amp;gt; (
                          &amp;lt;button
                            key={style.name}
                            type=&quot;button&quot;
                            onKeyDown={(e) =&amp;gt; {
                              if (e.key === &apos;Enter&apos;) {
                                e.preventDefault();
                                e.stopPropagation();
                                // Submit the form
                                const form = e.currentTarget.closest(&apos;form&apos;);
                                if (form) {
                                  form.requestSubmit();
                                }
                              }
                            }}
                            onClick={() =&amp;gt; {
                              if (selectedStyle === style.name) {
                                // Deselect if clicking the same style
                                setSelectedStyle(null);
                                // Keep only additional context, remove the style theme part
                                const currentAdditional = homeContextInput.replace(/^[^,]+theme\s*,?\s*/, &apos;&apos;).trim();
                                setHomeContextInput(currentAdditional);
                              } else {
                                // Select new style
                                setSelectedStyle(style.name);
                                // Extract any additional context (everything after the style theme)
                                const currentAdditional = homeContextInput.replace(/^[^,]+theme\s*,?\s*/, &apos;&apos;).trim();
                                setHomeContextInput(style.name.toLowerCase() + &apos; theme&apos; + (currentAdditional ? &apos;, &apos; + currentAdditional : &apos;&apos;));
                              }
                            }}
                            className={`p-3 rounded-lg border transition-all ${
                              selectedStyle === style.name
                                ? &apos;border-orange-400 bg-orange-50 text-gray-900 shadow-sm&apos;
                                : &apos;border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/50 text-gray-700&apos;
                            }`}
                          &amp;gt;
                            &amp;lt;div className=&quot;text-sm font-medium&quot;&amp;gt;{style.name}&amp;lt;/div&amp;gt;
                            &amp;lt;div className=&quot;text-xs text-gray-500 mt-1&quot;&amp;gt;{style.description}&amp;lt;/div&amp;gt;
                          &amp;lt;/button&amp;gt;
                        ))}
                      &amp;lt;/div&amp;gt;
                      
                      {/* Additional context input - part of the style selector */}
                      &amp;lt;div className=&quot;mt-4 mb-2&quot;&amp;gt;
                        &amp;lt;input
                          type=&quot;text&quot;
                          value={(() =&amp;gt; {
                            if (!selectedStyle) return homeContextInput;
                            // Extract additional context by removing the style theme part
                            const additional = homeContextInput.replace(new RegExp(&apos;^&apos; + selectedStyle.toLowerCase() + &apos; theme\\s*,?\\s*&apos;, &apos;i&apos;), &apos;&apos;);
                            return additional;
                          })()}
                          onChange={(e) =&amp;gt; {
                            const additionalContext = e.target.value;
                            if (selectedStyle) {
                              setHomeContextInput(selectedStyle.toLowerCase() + &apos; theme&apos; + (additionalContext.trim() ? &apos;, &apos; + additionalContext : &apos;&apos;));
                            } else {
                              setHomeContextInput(additionalContext);
                            }
                          }}
                          onKeyDown={(e) =&amp;gt; {
                            if (e.key === &apos;Enter&apos;) {
                              e.preventDefault();
                              const form = e.currentTarget.closest(&apos;form&apos;);
                              if (form) {
                                form.requestSubmit();
                              }
                            }
                          }}
                          placeholder=&quot;Add more details: specific features, color preferences...&quot;
                          className=&quot;w-full px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all duration-200&quot;
                        /&amp;gt;
                      &amp;lt;/div&amp;gt;
                    &amp;lt;/div&amp;gt;
                      &amp;lt;/div&amp;gt;
                    &amp;lt;/div&amp;gt;
                  )}
              &amp;lt;/form&amp;gt;
              
              {/* Model Selector */}
              &amp;lt;div className=&quot;mt-6 flex items-center justify-center animate-[fadeIn_1s_ease-out]&quot;&amp;gt;
                &amp;lt;select
                  value={aiModel}
                  onChange={(e) =&amp;gt; {
                    const newModel = e.target.value;
                    setAiModel(newModel);
                    const params = new URLSearchParams(searchParams);
                    params.set(&apos;model&apos;, newModel);
                    if (sandboxData?.sandboxId) {
                      params.set(&apos;sandbox&apos;, sandboxData.sandboxId);
                    }
                    router.push(`/?${params.toString()}`);
                  }}
                  className=&quot;px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#36322F] focus:border-transparent&quot;
                  style={{
                    boxShadow: &apos;0 0 0 1px #e3e1de66, 0 1px 2px #5f4a2e14&apos;
                  }}
                &amp;gt;
                  {appConfig.ai.availableModels.map(model =&amp;gt; (
                    &amp;lt;option key={model} value={model}&amp;gt;
                      {(appConfig.ai.modelDisplayNames as any)[model] || model}
                    &amp;lt;/option&amp;gt;
                  ))}
                &amp;lt;/select&amp;gt;
              &amp;lt;/div&amp;gt;
            &amp;lt;/div&amp;gt;
          &amp;lt;/div&amp;gt;
        &amp;lt;/div&amp;gt;
      )}
      
      &amp;lt;div className=&quot;bg-card px-4 py-4 border-b border-border flex items-center justify-between&quot;&amp;gt;
        &amp;lt;div className=&quot;flex items-center gap-4&quot;&amp;gt;
          &amp;lt;img
            src=&quot;/firecrawl-logo-with-fire.webp&quot;
            alt=&quot;Firecrawl&quot;
            className=&quot;h-8 w-auto&quot;
          /&amp;gt;
        &amp;lt;/div&amp;gt;
        &amp;lt;div className=&quot;flex items-center gap-2&quot;&amp;gt;
          {/* Model Selector - Left side */}
          &amp;lt;select
            value={aiModel}
            onChange={(e) =&amp;gt; {
              const newModel = e.target.value;
              setAiModel(newModel);
              const params = new URLSearchParams(searchParams);
              params.set(&apos;model&apos;, newModel);
              if (sandboxData?.sandboxId) {
                params.set(&apos;sandbox&apos;, sandboxData.sandboxId);
              }
              router.push(`/?${params.toString()}`);
            }}
            className=&quot;px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#36322F] focus:border-transparent&quot;
          &amp;gt;
            {appConfig.ai.availableModels.map(model =&amp;gt; (
              &amp;lt;option key={model} value={model}&amp;gt;
                {(appConfig.ai.modelDisplayNames as any)[model] || model}
              &amp;lt;/option&amp;gt;
            ))}
          &amp;lt;/select&amp;gt;
          &amp;lt;Button 
            variant=&quot;code&quot;
            onClick={() =&amp;gt; createSandbox()}
            size=&quot;sm&quot;
            title=&quot;Create new sandbox&quot;
          &amp;gt;
            &amp;lt;svg className=&quot;w-4 h-4&quot; fill=&quot;none&quot; viewBox=&quot;0 0 24 24&quot; stroke=&quot;currentColor&quot;&amp;gt;
              &amp;lt;path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth={2} d=&quot;M12 4v16m8-8H4&quot; /&amp;gt;
            &amp;lt;/svg&amp;gt;
          &amp;lt;/Button&amp;gt;
          &amp;lt;Button 
            variant=&quot;code&quot;
            onClick={reapplyLastGeneration}
            size=&quot;sm&quot;
            title=&quot;Re-apply last generation&quot;
            disabled={!conversationContext.lastGeneratedCode || !sandboxData}
          &amp;gt;
            &amp;lt;svg className=&quot;w-4 h-4&quot; fill=&quot;none&quot; viewBox=&quot;0 0 24 24&quot; stroke=&quot;currentColor&quot;&amp;gt;
              &amp;lt;path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth={2} d=&quot;M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15&quot; /&amp;gt;
            &amp;lt;/svg&amp;gt;
          &amp;lt;/Button&amp;gt;
          &amp;lt;Button 
            variant=&quot;code&quot;
            onClick={downloadZip}
            disabled={!sandboxData}
            size=&quot;sm&quot;
            title=&quot;Download your Vite app as ZIP&quot;
          &amp;gt;
            &amp;lt;svg className=&quot;w-4 h-4&quot; fill=&quot;none&quot; viewBox=&quot;0 0 24 24&quot; stroke=&quot;currentColor&quot;&amp;gt;
              &amp;lt;path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth={2} d=&quot;M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10&quot; /&amp;gt;
            &amp;lt;/svg&amp;gt;
          &amp;lt;/Button&amp;gt;
          &amp;lt;div className=&quot;inline-flex items-center gap-2 bg-[#36322F] text-white px-3 py-1.5 rounded-[10px] text-sm font-medium [box-shadow:inset_0px_-2px_0px_0px_#171310,_0px_1px_6px_0px_rgba(58,_33,_8,_58%)]&quot;&amp;gt;
            &amp;lt;span id=&quot;status-text&quot;&amp;gt;{status.text}&amp;lt;/span&amp;gt;
            &amp;lt;div className={`w-2 h-2 rounded-full ${status.active ? &apos;bg-green-500&apos; : &apos;bg-gray-500&apos;}`} /&amp;gt;
          &amp;lt;/div&amp;gt;
        &amp;lt;/div&amp;gt;
      &amp;lt;/div&amp;gt;

      &amp;lt;div className=&quot;flex-1 flex overflow-hidden&quot;&amp;gt;
        {/* Center Panel - AI Chat (1/3 of remaining width) */}
        &amp;lt;div className=&quot;flex-1 max-w-[400px] flex flex-col border-r border-border bg-background&quot;&amp;gt;
          {conversationContext.scrapedWebsites.length &amp;gt; 0 &amp;&amp; (
            &amp;lt;div className=&quot;p-4 bg-card&quot;&amp;gt;
              &amp;lt;div className=&quot;flex flex-col gap-2&quot;&amp;gt;
                {conversationContext.scrapedWebsites.map((site, idx) =&amp;gt; {
                  // Extract favicon and site info from the scraped data
                  const metadata = site.content?.metadata || {};
                  const sourceURL = metadata.sourceURL || site.url;
                  const favicon = metadata.favicon || `https://www.google.com/s2/favicons?domain=${new URL(sourceURL).hostname}&amp;sz=32`;
                  const siteName = metadata.ogSiteName || metadata.title || new URL(sourceURL).hostname;
                  
                  return (
                    &amp;lt;div key={idx} className=&quot;flex items-center gap-2 text-sm&quot;&amp;gt;
                      &amp;lt;img 
                        src={favicon} 
                        alt={siteName}
                        className=&quot;w-4 h-4 rounded&quot;
                        onError={(e) =&amp;gt; {
                          e.currentTarget.src = `https://www.google.com/s2/favicons?domain=${new URL(sourceURL).hostname}&amp;sz=32`;
                        }}
                      /&amp;gt;
                      &amp;lt;a 
                        href={sourceURL} 
                        target=&quot;_blank&quot; 
                        rel=&quot;noopener noreferrer&quot;
                        className=&quot;text-black hover:text-gray-700 truncate max-w-[250px]&quot;
                        title={sourceURL}
                      &amp;gt;
                        {siteName}
                      &amp;lt;/a&amp;gt;
                    &amp;lt;/div&amp;gt;
                  );
                })}
              &amp;lt;/div&amp;gt;
            &amp;lt;/div&amp;gt;
          )}

          &amp;lt;div className=&quot;flex-1 overflow-y-auto p-4 flex flex-col gap-1 scrollbar-hide&quot; ref={chatMessagesRef}&amp;gt;
            {chatMessages.map((msg, idx) =&amp;gt; {
              // Check if this message is from a successful generation
              const isGenerationComplete = msg.content.includes(&apos;Successfully recreated&apos;) || 
                                         msg.content.includes(&apos;AI recreation generated!&apos;) ||
                                         msg.content.includes(&apos;Code generated!&apos;);
              
              // Get the files from metadata if this is a completion message
              const completedFiles = msg.metadata?.appliedFiles || [];
              
              return (
                &amp;lt;div key={idx} className=&quot;block&quot;&amp;gt;
                  &amp;lt;div className={`flex ${msg.type === &apos;user&apos; ? &apos;justify-end&apos; : &apos;justify-start&apos;} mb-1`}&amp;gt;
                    &amp;lt;div className=&quot;block&quot;&amp;gt;
                      &amp;lt;div className={`block rounded-[10px] px-4 py-2 ${
                        msg.type === &apos;user&apos; ? &apos;bg-[#36322F] text-white ml-auto max-w-[80%]&apos; :
                        msg.type === &apos;ai&apos; ? &apos;bg-gray-100 text-gray-900 mr-auto max-w-[80%]&apos; :
                        msg.type === &apos;system&apos; ? &apos;bg-[#36322F] text-white text-sm&apos; :
                        msg.type === &apos;command&apos; ? &apos;bg-[#36322F] text-white font-mono text-sm&apos; :
                        msg.type === &apos;error&apos; ? &apos;bg-red-900 text-red-100 text-sm border border-red-700&apos; :
                        &apos;bg-[#36322F] text-white text-sm&apos;
                      }`}&amp;gt;
                    {msg.type === &apos;command&apos; ? (
                      &amp;lt;div className=&quot;flex items-start gap-2&quot;&amp;gt;
                        &amp;lt;span className={`text-xs ${
                          msg.metadata?.commandType === &apos;input&apos; ? &apos;text-blue-400&apos; :
                          msg.metadata?.commandType === &apos;error&apos; ? &apos;text-red-400&apos; :
                          msg.metadata?.commandType === &apos;success&apos; ? &apos;text-green-400&apos; :
                          &apos;text-gray-400&apos;
                        }`}&amp;gt;
                          {msg.metadata?.commandType === &apos;input&apos; ? &apos;$&apos; : &apos;&amp;gt;&apos;}
                        &amp;lt;/span&amp;gt;
                        &amp;lt;span className=&quot;flex-1 whitespace-pre-wrap text-white&quot;&amp;gt;{msg.content}&amp;lt;/span&amp;gt;
                      &amp;lt;/div&amp;gt;
                    ) : msg.type === &apos;error&apos; ? (
                      &amp;lt;div className=&quot;flex items-start gap-3&quot;&amp;gt;
                        &amp;lt;div className=&quot;flex-shrink-0&quot;&amp;gt;
                          &amp;lt;div className=&quot;w-8 h-8 bg-red-800 rounded-full flex items-center justify-center&quot;&amp;gt;
                            &amp;lt;svg className=&quot;w-5 h-5 text-red-200&quot; fill=&quot;none&quot; viewBox=&quot;0 0 24 24&quot; stroke=&quot;currentColor&quot;&amp;gt;
                              &amp;lt;path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth={2} d=&quot;M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z&quot; /&amp;gt;
                            &amp;lt;/svg&amp;gt;
                          &amp;lt;/div&amp;gt;
                        &amp;lt;/div&amp;gt;
                        &amp;lt;div className=&quot;flex-1&quot;&amp;gt;
                          &amp;lt;div className=&quot;font-semibold mb-1&quot;&amp;gt;Build Errors Detected&amp;lt;/div&amp;gt;
                          &amp;lt;div className=&quot;whitespace-pre-wrap text-sm&quot;&amp;gt;{msg.content}&amp;lt;/div&amp;gt;
                          &amp;lt;div className=&quot;mt-2 text-xs opacity-70&quot;&amp;gt;Press &apos;F&apos; or click the Fix button above to resolve&amp;lt;/div&amp;gt;
                        &amp;lt;/div&amp;gt;
                      &amp;lt;/div&amp;gt;
                    ) : (
                      msg.content
                    )}
                      &amp;lt;/div&amp;gt;
                  
                      {/* Show applied files if this is an apply success message */}
                      {msg.metadata?.appliedFiles &amp;&amp; msg.metadata.appliedFiles.length &amp;gt; 0 &amp;&amp; (
                    &amp;lt;div className=&quot;mt-2 inline-block bg-gray-100 rounded-[10px] p-3&quot;&amp;gt;
                      &amp;lt;div className=&quot;text-xs font-medium mb-1 text-gray-700&quot;&amp;gt;
                        {msg.content.includes(&apos;Applied&apos;) ? &apos;Files Updated:&apos; : &apos;Generated Files:&apos;}
                      &amp;lt;/div&amp;gt;
                      &amp;lt;div className=&quot;flex flex-wrap items-start gap-1&quot;&amp;gt;
                        {msg.metadata.appliedFiles.map((filePath, fileIdx) =&amp;gt; {
                          const fileName = filePath.split(&apos;/&apos;).pop() || filePath;
                          const fileExt = fileName.split(&apos;.&apos;).pop() || &apos;&apos;;
                          const fileType = fileExt === &apos;jsx&apos; || fileExt === &apos;js&apos; ? &apos;javascript&apos; :
                                          fileExt === &apos;css&apos; ? &apos;css&apos; :
                                          fileExt === &apos;json&apos; ? &apos;json&apos; : &apos;text&apos;;
                          
                          return (
                            &amp;lt;div
                              key={`applied-${fileIdx}`}
                              className=&quot;inline-flex items-center gap-1 px-2 py-1 bg-[#36322F] text-white rounded-[10px] text-xs animate-fade-in-up&quot;
                              style={{ animationDelay: `${fileIdx * 30}ms` }}
                            &amp;gt;
                              &amp;lt;span className={`inline-block w-1.5 h-1.5 rounded-full ${
                                fileType === &apos;css&apos; ? &apos;bg-blue-400&apos; :
                                fileType === &apos;javascript&apos; ? &apos;bg-yellow-400&apos; :
                                fileType === &apos;json&apos; ? &apos;bg-green-400&apos; :
                                &apos;bg-gray-400&apos;
                              }`} /&amp;gt;
                              {fileName}
                            &amp;lt;/div&amp;gt;
                          );
                        })}
                      &amp;lt;/div&amp;gt;
                    &amp;lt;/div&amp;gt;
                  )}
                  
                      {/* Show generated files for completion messages - but only if no appliedFiles already shown */}
                      {isGenerationComplete &amp;&amp; generationProgress.files.length &amp;gt; 0 &amp;&amp; idx === chatMessages.length - 1 &amp;&amp; !msg.metadata?.appliedFiles &amp;&amp; !chatMessages.some(m =&amp;gt; m.metadata?.appliedFiles) &amp;&amp; (
                    &amp;lt;div className=&quot;mt-2 inline-block bg-gray-100 rounded-[10px] p-3&quot;&amp;gt;
                      &amp;lt;div className=&quot;text-xs font-medium mb-1 text-gray-700&quot;&amp;gt;Generated Files:&amp;lt;/div&amp;gt;
                      &amp;lt;div className=&quot;flex flex-wrap items-start gap-1&quot;&amp;gt;
                        {generationProgress.files.map((file, fileIdx) =&amp;gt; (
                          &amp;lt;div
                            key={`complete-${fileIdx}`}
                            className=&quot;inline-flex items-center gap-1 px-2 py-1 bg-[#36322F] text-white rounded-[10px] text-xs animate-fade-in-up&quot;
                            style={{ animationDelay: `${fileIdx * 30}ms` }}
                          &amp;gt;
                            &amp;lt;span className={`inline-block w-1.5 h-1.5 rounded-full ${
                              file.type === &apos;css&apos; ? &apos;bg-blue-400&apos; :
                              file.type === &apos;javascript&apos; ? &apos;bg-yellow-400&apos; :
                              file.type === &apos;json&apos; ? &apos;bg-green-400&apos; :
                              &apos;bg-gray-400&apos;
                            }`} /&amp;gt;
                            {file.path.split(&apos;/&apos;).pop()}
                          &amp;lt;/div&amp;gt;
                        ))}
                      &amp;lt;/div&amp;gt;
                    &amp;lt;/div&amp;gt;
                  )}
                    &amp;lt;/div&amp;gt;
                    &amp;lt;/div&amp;gt;
                  &amp;lt;/div&amp;gt;
              );
            })}
            
            {/* Code application progress */}
            {codeApplicationState.stage &amp;&amp; (
              &amp;lt;CodeApplicationProgress state={codeApplicationState} /&amp;gt;
            )}
            
            {/* File generation progress - inline display (during generation) */}
            {generationProgress.isGenerating &amp;&amp; (
              &amp;lt;div className=&quot;inline-block bg-gray-100 rounded-lg p-3&quot;&amp;gt;
                &amp;lt;div className=&quot;text-sm font-medium mb-2 text-gray-700&quot;&amp;gt;
                  {generationProgress.status}
                &amp;lt;/div&amp;gt;
                &amp;lt;div className=&quot;flex flex-wrap items-start gap-1&quot;&amp;gt;
                  {/* Show completed files */}
                  {generationProgress.files.map((file, idx) =&amp;gt; (
                    &amp;lt;div
                      key={`file-${idx}`}
                      className=&quot;inline-flex items-center gap-1 px-2 py-1 bg-[#36322F] text-white rounded-[10px] text-xs animate-fade-in-up&quot;
                      style={{ animationDelay: `${idx * 30}ms` }}
                    &amp;gt;
                      &amp;lt;svg className=&quot;w-3 h-3&quot; fill=&quot;none&quot; viewBox=&quot;0 0 24 24&quot; stroke=&quot;currentColor&quot;&amp;gt;
                        &amp;lt;path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth={3} d=&quot;M5 13l4 4L19 7&quot; /&amp;gt;
                      &amp;lt;/svg&amp;gt;
                      {file.path.split(&apos;/&apos;).pop()}
                    &amp;lt;/div&amp;gt;
                  ))}
                  
                  {/* Show current file being generated */}
                  {generationProgress.currentFile &amp;&amp; (
                    &amp;lt;div className=&quot;flex items-center gap-1 px-2 py-1 bg-[#36322F]/70 text-white rounded-[10px] text-xs animate-pulse&quot;
                      style={{ animationDelay: `${generationProgress.files.length * 30}ms` }}&amp;gt;
                      &amp;lt;div className=&quot;w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin&quot; /&amp;gt;
                      {generationProgress.currentFile.path.split(&apos;/&apos;).pop()}
                    &amp;lt;/div&amp;gt;
                  )}
                &amp;lt;/div&amp;gt;
                
                {/* Live streaming response display */}
                {generationProgress.streamedCode &amp;&amp; (
                  &amp;lt;motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: &apos;auto&apos; }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className=&quot;mt-3 border-t border-gray-300 pt-3&quot;
                  &amp;gt;
                    &amp;lt;div className=&quot;flex items-center gap-2 mb-2&quot;&amp;gt;
                      &amp;lt;div className=&quot;flex items-center gap-1&quot;&amp;gt;
                        &amp;lt;div className=&quot;w-2 h-2 bg-green-500 rounded-full animate-pulse&quot; /&amp;gt;
                        &amp;lt;span className=&quot;text-xs font-medium text-gray-600&quot;&amp;gt;AI Response Stream&amp;lt;/span&amp;gt;
                      &amp;lt;/div&amp;gt;
                      &amp;lt;div className=&quot;flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent&quot; /&amp;gt;
                    &amp;lt;/div&amp;gt;
                    &amp;lt;div className=&quot;bg-gray-900 border border-gray-700 rounded max-h-32 overflow-y-auto scrollbar-hide&quot;&amp;gt;
                      &amp;lt;SyntaxHighlighter
                        language=&quot;jsx&quot;
                        style={vscDarkPlus}
                        customStyle={{
                          margin: 0,
                          padding: &apos;0.75rem&apos;,
                          fontSize: &apos;11px&apos;,
                          lineHeight: &apos;1.5&apos;,
                          background: &apos;transparent&apos;,
                          maxHeight: &apos;8rem&apos;,
                          overflow: &apos;hidden&apos;
                        }}
                      &amp;gt;
                        {(() =&amp;gt; {
                          const lastContent = generationProgress.streamedCode.slice(-1000);
                          // Show the last part of the stream, starting from a complete tag if possible
                          const startIndex = lastContent.indexOf(&apos;&amp;lt;&apos;);
                          return startIndex !== -1 ? lastContent.slice(startIndex) : lastContent;
                        })()}
                      &amp;lt;/SyntaxHighlighter&amp;gt;
                      &amp;lt;span className=&quot;inline-block w-2 h-3 bg-orange-400 ml-3 mb-3 animate-pulse&quot; /&amp;gt;
                    &amp;lt;/div&amp;gt;
                  &amp;lt;/motion.div&amp;gt;
                )}
              &amp;lt;/div&amp;gt;
            )}
          &amp;lt;/div&amp;gt;

          &amp;lt;div className=&quot;p-4 border-t border-border bg-card&quot;&amp;gt;
            &amp;lt;div className=&quot;relative&quot;&amp;gt;
              &amp;lt;Textarea
                className=&quot;min-h-[60px] pr-12 resize-y border-2 border-black focus:outline-none&quot;
                placeholder=&quot;&quot;
                value={aiChatInput}
                onChange={(e) =&amp;gt; setAiChatInput(e.target.value)}
                onKeyDown={(e) =&amp;gt; {
                  if (e.key === &apos;Enter&apos; &amp;&amp; !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
                rows={3}
              /&amp;gt;
              &amp;lt;button
                onClick={sendChatMessage}
                className=&quot;absolute right-2 bottom-2 p-2 bg-[#36322F] text-white rounded-[10px] hover:bg-[#4a4542] [box-shadow:inset_0px_-2px_0px_0px_#171310,_0px_1px_6px_0px_rgba(58,_33,_8,_58%)] hover:translate-y-[1px] hover:scale-[0.98] hover:[box-shadow:inset_0px_-1px_0px_0px_#171310,_0px_1px_3px_0px_rgba(58,_33,_8,_40%)] active:translate-y-[2px] active:scale-[0.97] active:[box-shadow:inset_0px_1px_1px_0px_#171310,_0px_1px_2px_0px_rgba(58,_33,_8,_30%)] transition-all duration-200&quot;
                title=&quot;Send message (Enter)&quot;
              &amp;gt;
                &amp;lt;svg className=&quot;w-4 h-4&quot; fill=&quot;none&quot; viewBox=&quot;0 0 24 24&quot; stroke=&quot;currentColor&quot;&amp;gt;
                  &amp;lt;path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth={2} d=&quot;M14 5l7 7m0 0l-7 7m7-7H3&quot; /&amp;gt;
                &amp;lt;/svg&amp;gt;
              &amp;lt;/button&amp;gt;
            &amp;lt;/div&amp;gt;
          &amp;lt;/div&amp;gt;
        &amp;lt;/div&amp;gt;

        {/* Right Panel - Preview or Generation (2/3 of remaining width) */}
        &amp;lt;div className=&quot;flex-1 flex flex-col overflow-hidden&quot;&amp;gt;
          &amp;lt;div className=&quot;px-4 py-2 bg-card border-b border-border flex justify-between items-center&quot;&amp;gt;
            &amp;lt;div className=&quot;flex items-center gap-4&quot;&amp;gt;
              &amp;lt;div className=&quot;flex bg-[#36322F] rounded-lg p-1&quot;&amp;gt;
                &amp;lt;button
                  onClick={() =&amp;gt; setActiveTab(&apos;generation&apos;)}
                  className={`p-2 rounded-md transition-all ${
                    activeTab === &apos;generation&apos; 
                      ? &apos;bg-black text-white&apos; 
                      : &apos;text-gray-300 hover:text-white hover:bg-gray-700&apos;
                  }`}
                  title=&quot;Code&quot;
                &amp;gt;
                  &amp;lt;svg className=&quot;w-4 h-4&quot; fill=&quot;none&quot; viewBox=&quot;0 0 24 24&quot; stroke=&quot;currentColor&quot;&amp;gt;
                    &amp;lt;path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth={2} d=&quot;M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4&quot; /&amp;gt;
                  &amp;lt;/svg&amp;gt;
                &amp;lt;/button&amp;gt;
                &amp;lt;button
                  onClick={() =&amp;gt; setActiveTab(&apos;preview&apos;)}
                  className={`p-2 rounded-md transition-all ${
                    activeTab === &apos;preview&apos; 
                      ? &apos;bg-black text-white&apos; 
                      : &apos;text-gray-300 hover:text-white hover:bg-gray-700&apos;
                  }`}
                  title=&quot;Preview&quot;
                &amp;gt;
                  &amp;lt;svg className=&quot;w-4 h-4&quot; fill=&quot;none&quot; viewBox=&quot;0 0 24 24&quot; stroke=&quot;currentColor&quot;&amp;gt;
                    &amp;lt;path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth={2} d=&quot;M15 12a3 3 0 11-6 0 3 3 0 016 0z&quot; /&amp;gt;
                    &amp;lt;path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth={2} d=&quot;M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z&quot; /&amp;gt;
                  &amp;lt;/svg&amp;gt;
                &amp;lt;/button&amp;gt;
              &amp;lt;/div&amp;gt;
            &amp;lt;/div&amp;gt;
            &amp;lt;div className=&quot;flex gap-2 items-center&quot;&amp;gt;
              {/* Live Code Generation Status - Moved to far right */}
              {activeTab === &apos;generation&apos; &amp;&amp; (generationProgress.isGenerating || generationProgress.files.length &amp;gt; 0) &amp;&amp; (
                &amp;lt;div className=&quot;flex items-center gap-3&quot;&amp;gt;
                  {!generationProgress.isEdit &amp;&amp; (
                    &amp;lt;div className=&quot;text-gray-600 text-sm&quot;&amp;gt;
                      {generationProgress.files.length} files generated
                    &amp;lt;/div&amp;gt;
                  )}
                  &amp;lt;div className={`inline-flex items-center justify-center whitespace-nowrap rounded-[10px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-[#36322F] text-white hover:bg-[#36322F] [box-shadow:inset_0px_-2px_0px_0px_#171310,_0px_1px_6px_0px_rgba(58,_33,_8,_58%)] hover:translate-y-[1px] hover:scale-[0.98] hover:[box-shadow:inset_0px_-1px_0px_0px_#171310,_0px_1px_3px_0px_rgba(58,_33,_8,_40%)] active:translate-y-[2px] active:scale-[0.97] active:[box-shadow:inset_0px_1px_1px_0px_#171310,_0px_1px_2px_0px_rgba(58,_33,_8,_30%)] disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:scale-100 h-8 px-3 py-1 text-sm gap-2`}&amp;gt;
                    {generationProgress.isGenerating ? (
                      &amp;lt;&amp;gt;
                        &amp;lt;div className=&quot;w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]&quot; /&amp;gt;
                        {generationProgress.isEdit ? &apos;Editing code&apos; : &apos;Live code generation&apos;}
                      &amp;lt;/&amp;gt;
                    ) : (
                      &amp;lt;&amp;gt;
                        &amp;lt;div className=&quot;w-2 h-2 bg-gray-500 rounded-full&quot; /&amp;gt;
                        COMPLETE
                      &amp;lt;/&amp;gt;
                    )}
                  &amp;lt;/div&amp;gt;
                &amp;lt;/div&amp;gt;
              )}
              {sandboxData &amp;&amp; !generationProgress.isGenerating &amp;&amp; (
                &amp;lt;&amp;gt;
                  &amp;lt;Button
                    variant=&quot;code&quot;
                    size=&quot;sm&quot;
                    asChild
                  &amp;gt;
                    &amp;lt;a 
                      href={sandboxData.url} 
                      target=&quot;_blank&quot; 
                      rel=&quot;noopener noreferrer&quot;
                      title=&quot;Open in new tab&quot;
                    &amp;gt;
                      &amp;lt;svg className=&quot;w-4 h-4&quot; fill=&quot;none&quot; viewBox=&quot;0 0 24 24&quot; stroke=&quot;currentColor&quot;&amp;gt;
                        &amp;lt;path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth={2} d=&quot;M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14&quot; /&amp;gt;
                      &amp;lt;/svg&amp;gt;
                    &amp;lt;/a&amp;gt;
                  &amp;lt;/Button&amp;gt;
                &amp;lt;/&amp;gt;
              )}
            &amp;lt;/div&amp;gt;
          &amp;lt;/div&amp;gt;
          &amp;lt;div className=&quot;flex-1 relative overflow-hidden&quot;&amp;gt;
            {renderMainContent()}
          &amp;lt;/div&amp;gt;
        &amp;lt;/div&amp;gt;
      &amp;lt;/div&amp;gt;




    &amp;lt;/div&amp;gt;
  );
}

export default function AISandboxPage() {
  return (
    &amp;lt;Suspense fallback={&amp;lt;div&amp;gt;Loading...&amp;lt;/div&amp;gt;}&amp;gt;
      &amp;lt;AISandboxPageContent /&amp;gt;
    &amp;lt;/Suspense&amp;gt;
  );
}