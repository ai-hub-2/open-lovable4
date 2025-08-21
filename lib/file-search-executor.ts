/**
 * Agentic file search executor
 * Executes search plans to find exact code locations before editing
 */

export interface SearchResult {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  matchedTerm?: string;
  matchedPattern?: string;
  contextBefore: string[];
  contextAfter: string[];
  confidence: &apos;high&apos; | &apos;medium&apos; | &apos;low&apos;;
}

export interface SearchPlan {
  editType: string;
  reasoning: string;
  searchTerms: string[];
  regexPatterns?: string[];
  fileTypesToSearch?: string[];
  expectedMatches?: number;
  fallbackSearch?: {
    terms: string[];
    patterns?: string[];
  };
}

export interface SearchExecutionResult {
  success: boolean;
  results: SearchResult[];
  filesSearched: number;
  executionTime: number;
  usedFallback: boolean;
  error?: string;
}

/**
 * Execute a search plan against the codebase
 */
export function executeSearchPlan(
  searchPlan: SearchPlan,
  files: Record&amp;lt;string, string&amp;gt;
): SearchExecutionResult {
  const startTime = Date.now();
  const results: SearchResult[] = [];
  let filesSearched = 0;
  let usedFallback = false;

  const { 
    searchTerms = [], 
    regexPatterns = [], 
    fileTypesToSearch = [&apos;.jsx&apos;, &apos;.tsx&apos;, &apos;.js&apos;, &apos;.ts&apos;],
    fallbackSearch 
  } = searchPlan;

  // Helper function to perform search
  const performSearch = (terms: string[], patterns?: string[]): SearchResult[] =&amp;gt; {
    const searchResults: SearchResult[] = [];

    for (const [filePath, content] of Object.entries(files)) {
      // Skip files that don&apos;t match the desired extensions
      const shouldSearch = fileTypesToSearch.some(ext =&amp;gt; filePath.endsWith(ext));
      if (!shouldSearch) continue;

      filesSearched++;
      const lines = content.split(&apos;\n&apos;);

      for (let i = 0; i &amp;lt; lines.length; i++) {
        const line = lines[i];
        let matched = false;
        let matchedTerm: string | undefined;
        let matchedPattern: string | undefined;

        // Check simple search terms (case-insensitive)
        for (const term of terms) {
          if (line.toLowerCase().includes(term.toLowerCase())) {
            matched = true;
            matchedTerm = term;
            break;
          }
        }

        // Check regex patterns if no term match
        if (!matched &amp;&amp; patterns) {
          for (const pattern of patterns) {
            try {
              const regex = new RegExp(pattern, &apos;i&apos;);
              if (regex.test(line)) {
                matched = true;
                matchedPattern = pattern;
                break;
              }
            } catch (e) {
              console.warn(`[file-search] Invalid regex pattern: ${pattern}`);
            }
          }
        }

        if (matched) {
          // Get context lines (3 before, 3 after)
          const contextBefore = lines.slice(Math.max(0, i - 3), i);
          const contextAfter = lines.slice(i + 1, Math.min(lines.length, i + 4));

          // Determine confidence based on match type and context
          let confidence: &apos;high&apos; | &apos;medium&apos; | &apos;low&apos; = &apos;medium&apos;;
          
          // High confidence if it&apos;s an exact match or in a component definition
          if (matchedTerm &amp;&amp; line.includes(matchedTerm)) {
            confidence = &apos;high&apos;;
          } else if (line.includes(&apos;function&apos;) || line.includes(&apos;export&apos;) || line.includes(&apos;return&apos;)) {
            confidence = &apos;high&apos;;
          } else if (matchedPattern) {
            confidence = &apos;medium&apos;;
          }

          searchResults.push({
            filePath,
            lineNumber: i + 1,
            lineContent: line.trim(),
            matchedTerm,
            matchedPattern,
            contextBefore,
            contextAfter,
            confidence
          });
        }
      }
    }

    return searchResults;
  };

  // Execute primary search
  results.push(...performSearch(searchTerms, regexPatterns));

  // If no results and we have a fallback, try it
  if (results.length === 0 &amp;&amp; fallbackSearch) {
    console.log(&apos;[file-search] No results from primary search, trying fallback...&apos;);
    usedFallback = true;
    results.push(...performSearch(
      fallbackSearch.terms,
      fallbackSearch.patterns
    ));
  }

  const executionTime = Date.now() - startTime;

  // Sort results by confidence
  results.sort((a, b) =&amp;gt; {
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
  });

  return {
    success: results.length &amp;gt; 0,
    results,
    filesSearched,
    executionTime,
    usedFallback,
    error: results.length === 0 ? &apos;No matches found for search terms&apos; : undefined
  };
}

/**
 * Format search results for AI consumption
 */
export function formatSearchResultsForAI(results: SearchResult[]): string {
  if (results.length === 0) {
    return &apos;No search results found.&apos;;
  }

  const sections: string[] = [];
  
  sections.push(&apos;🔍 SEARCH RESULTS - EXACT LOCATIONS FOUND:\n&apos;);
  
  // Group by file for better readability
  const resultsByFile = new Map&amp;lt;string, SearchResult[]&amp;gt;();
  for (const result of results) {
    if (!resultsByFile.has(result.filePath)) {
      resultsByFile.set(result.filePath, []);
    }
    resultsByFile.get(result.filePath)!.push(result);
  }

  for (const [filePath, fileResults] of resultsByFile) {
    sections.push(`\n📄 FILE: ${filePath}`);
    
    for (const result of fileResults) {
      sections.push(`\n  📍 Line ${result.lineNumber} (${result.confidence} confidence)`);
      
      if (result.matchedTerm) {
        sections.push(`     Matched: &quot;${result.matchedTerm}&quot;`);
      } else if (result.matchedPattern) {
        sections.push(`     Pattern: ${result.matchedPattern}`);
      }
      
      sections.push(`     Code: ${result.lineContent}`);
      
      if (result.contextBefore.length &amp;gt; 0 || result.contextAfter.length &amp;gt; 0) {
        sections.push(`     Context:`);
        for (const line of result.contextBefore) {
          sections.push(`       ${line}`);
        }
        sections.push(`     → ${result.lineContent}`);
        for (const line of result.contextAfter) {
          sections.push(`       ${line}`);
        }
      }
    }
  }

  sections.push(&apos;\n\n🎯 RECOMMENDED ACTION:&apos;);
  
  // Recommend the highest confidence result
  const bestResult = results[0];
  sections.push(`Edit ${bestResult.filePath} at line ${bestResult.lineNumber}`);

  return sections.join(&apos;\n&apos;);
}

/**
 * Select the best file to edit based on search results
 */
export function selectTargetFile(
  results: SearchResult[],
  editType: string
): { filePath: string; lineNumber: number; reason: string } | null {
  if (results.length === 0) return null;

  // For style updates, prefer components over CSS files
  if (editType === &apos;UPDATE_STYLE&apos;) {
    const componentResult = results.find(r =&amp;gt; 
      r.filePath.endsWith(&apos;.jsx&apos;) || r.filePath.endsWith(&apos;.tsx&apos;)
    );
    if (componentResult) {
      return {
        filePath: componentResult.filePath,
        lineNumber: componentResult.lineNumber,
        reason: &apos;Found component with style to update&apos;
      };
    }
  }

  // For remove operations, find the component that renders the element
  if (editType === &apos;REMOVE_ELEMENT&apos;) {
    const renderResult = results.find(r =&amp;gt; 
      r.lineContent.includes(&apos;return&apos;) || 
      r.lineContent.includes(&apos;&amp;lt;&apos;)
    );
    if (renderResult) {
      return {
        filePath: renderResult.filePath,
        lineNumber: renderResult.lineNumber,
        reason: &apos;Found element to remove in render output&apos;
      };
    }
  }

  // Default: use highest confidence result
  const best = results[0];
  return {
    filePath: best.filePath,
    lineNumber: best.lineNumber,
    reason: `Highest confidence match (${best.confidence})`
  };
}