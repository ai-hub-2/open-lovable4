import { FileInfo, ImportInfo, ComponentInfo } from &apos;@/types/file-manifest&apos;;

/**
 * Parse a JavaScript/JSX file to extract imports, exports, and component info
 */
export function parseJavaScriptFile(content: string, filePath: string): Partial&amp;lt;FileInfo&amp;gt; {
  const imports = extractImports(content);
  const exports = extractExports(content);
  const componentInfo = extractComponentInfo(content, filePath);
  const fileType = determineFileType(filePath, content);
  
  return {
    imports,
    exports,
    componentInfo,
    type: fileType,
  };
}

/**
 * Extract import statements from file content
 */
function extractImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  
  // Match import statements
  const importRegex = /import\s+(?:(.+?)\s+from\s+)?[&apos;&quot;](.+?)[&apos;&quot;]/g;
  const matches = content.matchAll(importRegex);
  
  for (const match of matches) {
    const [, importClause, source] = match;
    const importInfo: ImportInfo = {
      source,
      imports: [],
      isLocal: source.startsWith(&apos;./&apos;) || source.startsWith(&apos;../&apos;) || source.startsWith(&apos;@/&apos;),
    };
    
    if (importClause) {
      // Handle default import
      const defaultMatch = importClause.match(/^(\w+)(?:,|$)/);
      if (defaultMatch) {
        importInfo.defaultImport = defaultMatch[1];
      }
      
      // Handle named imports
      const namedMatch = importClause.match(/\{([^}]+)\}/);
      if (namedMatch) {
        importInfo.imports = namedMatch[1]
          .split(&apos;,&apos;)
          .map(imp =&amp;gt; imp.trim())
          .map(imp =&amp;gt; imp.split(/\s+as\s+/)[0].trim());
      }
    }
    
    imports.push(importInfo);
  }
  
  return imports;
}

/**
 * Extract export statements from file content
 */
function extractExports(content: string): string[] {
  const exports: string[] = [];
  
  // Match default export
  if (/export\s+default\s+/m.test(content)) {
    // Try to find the name of the default export
    const defaultExportMatch = content.match(/export\s+default\s+(?:function\s+)?(\w+)/);
    if (defaultExportMatch) {
      exports.push(`default:${defaultExportMatch[1]}`);
    } else {
      exports.push(&apos;default&apos;);
    }
  }
  
  // Match named exports
  const namedExportRegex = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
  const namedMatches = content.matchAll(namedExportRegex);
  
  for (const match of namedMatches) {
    exports.push(match[1]);
  }
  
  // Match export { ... } statements
  const exportBlockRegex = /export\s+\{([^}]+)\}/g;
  const blockMatches = content.matchAll(exportBlockRegex);
  
  for (const match of blockMatches) {
    const names = match[1]
      .split(&apos;,&apos;)
      .map(exp =&amp;gt; exp.trim())
      .map(exp =&amp;gt; exp.split(/\s+as\s+/)[0].trim());
    exports.push(...names);
  }
  
  return exports;
}

/**
 * Extract React component information
 */
function extractComponentInfo(content: string, filePath: string): ComponentInfo | undefined {
  // Check if this is likely a React component
  const hasJSX = /&amp;lt;[A-Z]\w*|&amp;lt;[a-z]+\s+[^&amp;gt;]*\/?&amp;gt;/.test(content);
  if (!hasJSX &amp;&amp; !content.includes(&apos;React&apos;)) return undefined;
  
  // Try to find component name
  let componentName = &apos;&apos;;
  
  // Check for function component
  const funcComponentMatch = content.match(/(?:export\s+)?(?:default\s+)?function\s+([A-Z]\w*)\s*\(/);
  if (funcComponentMatch) {
    componentName = funcComponentMatch[1];
  } else {
    // Check for arrow function component
    const arrowComponentMatch = content.match(/(?:export\s+)?(?:default\s+)?(?:const|let)\s+([A-Z]\w*)\s*=\s*(?:\([^)]*\)|[^=])*=&amp;gt;/);
    if (arrowComponentMatch) {
      componentName = arrowComponentMatch[1];
    }
  }
  
  // If no component name found, try to get from filename
  if (!componentName) {
    const fileName = filePath.split(&apos;/&apos;).pop()?.replace(/\.(jsx?|tsx?)$/, &apos;&apos;);
    if (fileName &amp;&amp; /^[A-Z]/.test(fileName)) {
      componentName = fileName;
    }
  }
  
  if (!componentName) return undefined;
  
  // Extract hooks used
  const hooks: string[] = [];
  const hookRegex = /use[A-Z]\w*/g;
  const hookMatches = content.matchAll(hookRegex);
  for (const match of hookMatches) {
    if (!hooks.includes(match[0])) {
      hooks.push(match[0]);
    }
  }
  
  // Check if component has state
  const hasState = hooks.includes(&apos;useState&apos;) || hooks.includes(&apos;useReducer&apos;);
  
  // Extract child components (rough approximation)
  const childComponents: string[] = [];
  const componentRegex = /&amp;lt;([A-Z]\w*)[^&amp;gt;]*(?:\/?&amp;gt;|&amp;gt;)/g;
  const componentMatches = content.matchAll(componentRegex);
  
  for (const match of componentMatches) {
    const comp = match[1];
    if (!childComponents.includes(comp) &amp;&amp; comp !== componentName) {
      childComponents.push(comp);
    }
  }
  
  return {
    name: componentName,
    hooks,
    hasState,
    childComponents,
  };
}

/**
 * Determine file type based on path and content
 */
function determineFileType(
  filePath: string,
  content: string
): FileInfo[&apos;type&apos;] {
  const fileName = filePath.split(&apos;/&apos;).pop()?.toLowerCase() || &apos;&apos;;
  const dirPath = filePath.toLowerCase();
  
  // Style files
  if (fileName.endsWith(&apos;.css&apos;)) return &apos;style&apos;;
  
  // Config files
  if (fileName.includes(&apos;config&apos;) || 
      fileName === &apos;vite.config.js&apos; ||
      fileName === &apos;tailwind.config.js&apos; ||
      fileName === &apos;postcss.config.js&apos;) {
    return &apos;config&apos;;
  }
  
  // Hook files
  if (dirPath.includes(&apos;/hooks/&apos;) || fileName.startsWith(&apos;use&apos;)) {
    return &apos;hook&apos;;
  }
  
  // Context files
  if (dirPath.includes(&apos;/context/&apos;) || fileName.includes(&apos;context&apos;)) {
    return &apos;context&apos;;
  }
  
  // Layout components
  if (fileName.includes(&apos;layout&apos;) || content.includes(&apos;children&apos;)) {
    return &apos;layout&apos;;
  }
  
  // Page components (in pages directory or have routing)
  if (dirPath.includes(&apos;/pages/&apos;) || 
      content.includes(&apos;useRouter&apos;) ||
      content.includes(&apos;useParams&apos;)) {
    return &apos;page&apos;;
  }
  
  // Utility files
  if (dirPath.includes(&apos;/utils/&apos;) || 
      dirPath.includes(&apos;/lib/&apos;) ||
      !content.includes(&apos;export default&apos;)) {
    return &apos;utility&apos;;
  }
  
  // Default to component
  return &apos;component&apos;;
}

/**
 * Build component dependency tree
 */
export function buildComponentTree(files: Record&amp;lt;string, FileInfo&amp;gt;) {
  const tree: Record&amp;lt;string, {
    file: string;
    imports: string[];
    importedBy: string[];
    type: &apos;page&apos; | &apos;layout&apos; | &apos;component&apos;;
  }&amp;gt; = {};
  
  // First pass: collect all components
  for (const [path, fileInfo] of Object.entries(files)) {
    if (fileInfo.componentInfo) {
      const componentName = fileInfo.componentInfo.name;
      tree[componentName] = {
        file: path,
        imports: [],
        importedBy: [],
        type: fileInfo.type === &apos;page&apos; ? &apos;page&apos; : 
              fileInfo.type === &apos;layout&apos; ? &apos;layout&apos; : &apos;component&apos;,
      };
    }
  }
  
  // Second pass: build relationships
  for (const [path, fileInfo] of Object.entries(files)) {
    if (fileInfo.componentInfo &amp;&amp; fileInfo.imports) {
      const componentName = fileInfo.componentInfo.name;
      
      // Find imported components
      for (const imp of fileInfo.imports) {
        if (imp.isLocal &amp;&amp; imp.defaultImport) {
          // Check if this import is a component we know about
          if (tree[imp.defaultImport]) {
            tree[componentName].imports.push(imp.defaultImport);
            tree[imp.defaultImport].importedBy.push(componentName);
          }
        }
      }
    }
  }
  
  return tree;
}