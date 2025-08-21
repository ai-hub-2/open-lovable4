import { FileManifest, EditIntent, EditType } from &apos;@/types/file-manifest&apos;;
import { analyzeEditIntent } from &apos;@/lib/edit-intent-analyzer&apos;;
import { getEditExamplesPrompt, getComponentPatternPrompt } from &apos;@/lib/edit-examples&apos;;

export interface FileContext {
  primaryFiles: string[]; // Files to edit
  contextFiles: string[]; // Files to include for reference
  systemPrompt: string;   // Enhanced prompt with file info
  editIntent: EditIntent;
}

/**
 * Select files and build context based on user prompt
 */
export function selectFilesForEdit(
  userPrompt: string,
  manifest: FileManifest
): FileContext {
  // Analyze the edit intent
  const editIntent = analyzeEditIntent(userPrompt, manifest);
  
  // Get the files based on intent - only edit target files, but provide all others as context
  const primaryFiles = editIntent.targetFiles;
  const allFiles = Object.keys(manifest.files);
  let contextFiles = allFiles.filter(file =&amp;gt; !primaryFiles.includes(file));
  
  // ALWAYS include key files in context if they exist and aren&apos;t already primary files
  const keyFiles: string[] = [];
  
  // App.jsx is most important - shows component structure
  const appFile = allFiles.find(f =&amp;gt; f.endsWith(&apos;App.jsx&apos;) || f.endsWith(&apos;App.tsx&apos;));
  if (appFile &amp;&amp; !primaryFiles.includes(appFile)) {
    keyFiles.push(appFile);
  }
  
  // Include design system files for style context
  const tailwindConfig = allFiles.find(f =&amp;gt; f.endsWith(&apos;tailwind.config.js&apos;) || f.endsWith(&apos;tailwind.config.ts&apos;));
  if (tailwindConfig &amp;&amp; !primaryFiles.includes(tailwindConfig)) {
    keyFiles.push(tailwindConfig);
  }
  
  const indexCss = allFiles.find(f =&amp;gt; f.endsWith(&apos;index.css&apos;) || f.endsWith(&apos;globals.css&apos;));
  if (indexCss &amp;&amp; !primaryFiles.includes(indexCss)) {
    keyFiles.push(indexCss);
  }
  
  // Include package.json to understand dependencies
  const packageJson = allFiles.find(f =&amp;gt; f.endsWith(&apos;package.json&apos;));
  if (packageJson &amp;&amp; !primaryFiles.includes(packageJson)) {
    keyFiles.push(packageJson);
  }
  
  // Put key files at the beginning of context for visibility
  contextFiles = [...keyFiles, ...contextFiles.filter(f =&amp;gt; !keyFiles.includes(f))];
  
  // Build enhanced system prompt
  const systemPrompt = buildSystemPrompt(
    userPrompt,
    editIntent,
    primaryFiles,
    contextFiles,
    manifest
  );
  
  return {
    primaryFiles,
    contextFiles,
    systemPrompt,
    editIntent,
  };
}

/**
 * Build an enhanced system prompt with file structure context
 */
function buildSystemPrompt(
  userPrompt: string,
  editIntent: EditIntent,
  primaryFiles: string[],
  contextFiles: string[],
  manifest: FileManifest
): string {
  const sections: string[] = [];
  
  // Add edit examples first for better understanding
  if (editIntent.type !== EditType.FULL_REBUILD) {
    sections.push(getEditExamplesPrompt());
  }
  
  // Add edit intent section
  sections.push(`## Edit Intent
Type: ${editIntent.type}
Description: ${editIntent.description}
Confidence: ${(editIntent.confidence * 100).toFixed(0)}%

User Request: &quot;${userPrompt}&quot;`);
  
  // Add file structure overview
  sections.push(buildFileStructureSection(manifest));
  
  // Add component patterns
  const fileList = Object.keys(manifest.files).map(f =&amp;gt; f.replace(&apos;/home/user/app/&apos;, &apos;&apos;)).join(&apos;\n&apos;);
  sections.push(getComponentPatternPrompt(fileList));
  
  // Add primary files section
  if (primaryFiles.length &amp;gt; 0) {
    sections.push(`## Files to Edit
${primaryFiles.map(f =&amp;gt; {
  const fileInfo = manifest.files[f];
  return `- ${f}${fileInfo?.componentInfo ? ` (${fileInfo.componentInfo.name} component)` : &apos;&apos;}`;
}).join(&apos;\n&apos;)}`);
  }
  
  // Add context files section
  if (contextFiles.length &amp;gt; 0) {
    sections.push(`## Context Files (for reference only)
${contextFiles.map(f =&amp;gt; {
  const fileInfo = manifest.files[f];
  return `- ${f}${fileInfo?.componentInfo ? ` (${fileInfo.componentInfo.name} component)` : &apos;&apos;}`;
}).join(&apos;\n&apos;)}`);
  }
  
  // Add specific instructions based on edit type
  sections.push(buildEditInstructions(editIntent.type));
  
  // Add component relationships if relevant
  if (editIntent.type === EditType.UPDATE_COMPONENT || 
      editIntent.type === EditType.ADD_FEATURE) {
    sections.push(buildComponentRelationships(primaryFiles, manifest));
  }
  
  return sections.join(&apos;\n\n&apos;);
}

/**
 * Build file structure overview section
 */
function buildFileStructureSection(manifest: FileManifest): string {
  const allFiles = Object.entries(manifest.files)
    .map(([path]) =&amp;gt; path.replace(&apos;/home/user/app/&apos;, &apos;&apos;))
    .filter(path =&amp;gt; !path.includes(&apos;node_modules&apos;))
    .sort();
  
  const componentFiles = Object.entries(manifest.files)
    .filter(([, info]) =&amp;gt; info.type === &apos;component&apos; || info.type === &apos;page&apos;)
    .map(([path, info]) =&amp;gt; ({
      path: path.replace(&apos;/home/user/app/&apos;, &apos;&apos;),
      name: info.componentInfo?.name || path.split(&apos;/&apos;).pop(),
      type: info.type,
    }));
  
  return `## 🚨 EXISTING PROJECT FILES - DO NOT CREATE NEW FILES WITH SIMILAR NAMES 🚨

### ALL PROJECT FILES (${allFiles.length} files)
\`\`\`
${allFiles.join(&apos;\n&apos;)}
\`\`\`

### Component Files (USE THESE EXACT NAMES)
${componentFiles.map(f =&amp;gt; 
  `- ${f.name} → ${f.path} (${f.type})`
).join(&apos;\n&apos;)}

### CRITICAL: Component Relationships
**ALWAYS CHECK App.jsx FIRST** to understand what components exist and how they&apos;re imported!

Common component overlaps to watch for:
- &quot;nav&quot; or &quot;navigation&quot; → Often INSIDE Header.jsx, not a separate file
- &quot;menu&quot; → Usually part of Header/Nav, not separate
- &quot;logo&quot; → Typically in Header, not standalone

When user says &quot;nav&quot; or &quot;navigation&quot;:
1. First check if Header.jsx exists
2. Look inside Header.jsx for navigation elements
3. Only create Nav.jsx if navigation doesn&apos;t exist anywhere

Entry Point: ${manifest.entryPoint}

### Routes
${manifest.routes.map(r =&amp;gt; 
  `- ${r.path} → ${r.component.split(&apos;/&apos;).pop()}`
).join(&apos;\n&apos;) || &apos;No routes detected&apos;}`;
}

/**
 * Build edit-type specific instructions
 */
function buildEditInstructions(editType: EditType): string {
  const instructions: Record&amp;lt;EditType, string&amp;gt; = {
    [EditType.UPDATE_COMPONENT]: `## SURGICAL EDIT INSTRUCTIONS
- You MUST preserve 99% of the original code
- ONLY edit the specific component(s) mentioned
- Make ONLY the minimal change requested
- DO NOT rewrite or refactor unless explicitly asked
- DO NOT remove any existing code unless explicitly asked
- DO NOT change formatting or structure
- Preserve all imports and exports
- Maintain the existing code style
- Return the COMPLETE file with the surgical change applied
- Think of yourself as a surgeon making a precise incision, not an artist repainting`,
    
    [EditType.ADD_FEATURE]: `## Instructions
- Create new components in appropriate directories
- IMPORTANT: Update parent components to import and use the new component
- Update routing if adding new pages
- Follow existing patterns and conventions
- Add necessary styles to match existing design
- Example workflow:
  1. Create NewComponent.jsx
  2. Import it in the parent: import NewComponent from &apos;./NewComponent&apos;
  3. Use it in the parent&apos;s render: &amp;lt;NewComponent /&amp;gt;`,
    
    [EditType.FIX_ISSUE]: `## Instructions
- Identify and fix the specific issue
- Test the fix doesn&apos;t break other functionality
- Preserve existing behavior except for the bug
- Add error handling if needed`,
    
    [EditType.UPDATE_STYLE]: `## SURGICAL STYLE EDIT INSTRUCTIONS
- Change ONLY the specific style/class mentioned
- If user says &quot;change background to blue&quot;, change ONLY the background class
- DO NOT touch any other styles, classes, or attributes
- DO NOT refactor or &quot;improve&quot; the styling
- DO NOT change the component structure
- Preserve ALL other classes and styles exactly as they are
- Return the COMPLETE file with only the specific style change`,
    
    [EditType.REFACTOR]: `## Instructions
- Improve code quality without changing functionality
- Follow project conventions
- Maintain all existing features
- Improve readability and maintainability`,
    
    [EditType.FULL_REBUILD]: `## Instructions
- You may rebuild the entire application
- Keep the same core functionality
- Improve upon the existing design
- Use modern best practices`,
    
    [EditType.ADD_DEPENDENCY]: `## Instructions
- Update package.json with new dependency
- Add necessary import statements
- Configure the dependency if needed
- Update any build configuration`,
  };
  
  return instructions[editType] || instructions[EditType.UPDATE_COMPONENT];
}

/**
 * Build component relationship information
 */
function buildComponentRelationships(
  files: string[],
  manifest: FileManifest
): string {
  const relationships: string[] = [&apos;## Component Relationships&apos;];
  
  for (const file of files) {
    const fileInfo = manifest.files[file];
    if (!fileInfo?.componentInfo) continue;
    
    const componentName = fileInfo.componentInfo.name;
    const treeNode = manifest.componentTree[componentName];
    
    if (treeNode) {
      relationships.push(`\n### ${componentName}`);
      
      if (treeNode.imports.length &amp;gt; 0) {
        relationships.push(`Imports: ${treeNode.imports.join(&apos;, &apos;)}`);
      }
      
      if (treeNode.importedBy.length &amp;gt; 0) {
        relationships.push(`Used by: ${treeNode.importedBy.join(&apos;, &apos;)}`);
      }
      
      if (fileInfo.componentInfo.childComponents?.length) {
        relationships.push(`Renders: ${fileInfo.componentInfo.childComponents.join(&apos;, &apos;)}`);
      }
    }
  }
  
  return relationships.join(&apos;\n&apos;);
}

/**
 * Get file content for selected files
 */
export async function getFileContents(
  files: string[],
  manifest: FileManifest
): Promise&amp;lt;Record&amp;lt;string, string&amp;gt;&amp;gt; {
  const contents: Record&amp;lt;string, string&amp;gt; = {};
  
  for (const file of files) {
    const fileInfo = manifest.files[file];
    if (fileInfo) {
      contents[file] = fileInfo.content;
    }
  }
  
  return contents;
}

/**
 * Format files for AI context
 */
export function formatFilesForAI(
  primaryFiles: Record&amp;lt;string, string&amp;gt;,
  contextFiles: Record&amp;lt;string, string&amp;gt;
): string {
  const sections: string[] = [];
  
  // Add primary files
  sections.push(&apos;## Files to Edit (ONLY OUTPUT THESE FILES)\n&apos;);
  sections.push(&apos;🚨 You MUST ONLY generate the files listed below. Do NOT generate any other files! 🚨\n&apos;);
  sections.push(&apos;⚠️ CRITICAL: Return the COMPLETE file - NEVER truncate with &quot;...&quot; or skip any lines! ⚠️\n&apos;);
  sections.push(&apos;The file MUST include ALL imports, ALL functions, ALL JSX, and ALL closing tags.\n\n&apos;);
  for (const [path, content] of Object.entries(primaryFiles)) {
    sections.push(`### ${path}
**IMPORTANT: This is the COMPLETE file. Your output must include EVERY line shown below, modified only where necessary.**
\`\`\`${getFileExtension(path)}
${content}
\`\`\`
`);
  }
  
  // Add context files if any - but truncate large files
  if (Object.keys(contextFiles).length &amp;gt; 0) {
    sections.push(&apos;\n## Context Files (Reference Only - Do Not Edit)\n&apos;);
    for (const [path, content] of Object.entries(contextFiles)) {
      // Truncate very large context files to save tokens
      let truncatedContent = content;
      if (content.length &amp;gt; 2000) {
        truncatedContent = content.substring(0, 2000) + &apos;\n// ... [truncated for context length]&apos;;
      }
      
      sections.push(`### ${path}
\`\`\`${getFileExtension(path)}
${truncatedContent}
\`\`\`
`);
    }
  }
  
  return sections.join(&apos;\n&apos;);
}

/**
 * Get file extension for syntax highlighting
 */
function getFileExtension(path: string): string {
  const ext = path.split(&apos;.&apos;).pop() || &apos;&apos;;
  const mapping: Record&amp;lt;string, string&amp;gt; = {
    &apos;js&apos;: &apos;javascript&apos;,
    &apos;jsx&apos;: &apos;javascript&apos;,
    &apos;ts&apos;: &apos;typescript&apos;,
    &apos;tsx&apos;: &apos;typescript&apos;,
    &apos;css&apos;: &apos;css&apos;,
    &apos;json&apos;: &apos;json&apos;,
  };
  return mapping[ext] || ext;
}