// File manifest types for enhanced edit tracking

export interface FileInfo {
  content: string;
  type: &apos;component&apos; | &apos;page&apos; | &apos;style&apos; | &apos;config&apos; | &apos;utility&apos; | &apos;layout&apos; | &apos;hook&apos; | &apos;context&apos;;
  exports?: string[]; // Named exports and default export
  imports?: ImportInfo[]; // Dependencies
  lastModified: number;
  componentInfo?: ComponentInfo; // For React components
  path: string;
  relativePath: string; // Path relative to src/
}

export interface ImportInfo {
  source: string; // e.g., &apos;./Header&apos;, &apos;react&apos;, &apos;@/components/Button&apos;
  imports: string[]; // Named imports
  defaultImport?: string; // Default import name
  isLocal: boolean; // true if starts with &apos;./&apos; or &apos;@/&apos;
}

export interface ComponentInfo {
  name: string;
  props?: string[]; // Prop names if detectable
  hooks?: string[]; // Hooks used (useState, useEffect, etc)
  hasState: boolean;
  childComponents?: string[]; // Components rendered inside
}

export interface RouteInfo {
  path: string; // Route path (e.g., &apos;/videos&apos;, &apos;/about&apos;)
  component: string; // Component file path
  layout?: string; // Layout component if any
}

export interface ComponentTree {
  [componentName: string]: {
    file: string;
    imports: string[]; // Components it imports
    importedBy: string[]; // Components that import it
    type: &apos;page&apos; | &apos;layout&apos; | &apos;component&apos;;
  }
}

export interface FileManifest {
  files: Record&amp;lt;string, FileInfo&amp;gt;;
  routes: RouteInfo[];
  componentTree: ComponentTree;
  entryPoint: string; // Usually App.jsx or main.jsx
  styleFiles: string[]; // All CSS files
  timestamp: number;
}

// Edit classification types
export enum EditType {
  UPDATE_COMPONENT = &apos;UPDATE_COMPONENT&apos;,    // &quot;update the header&quot;, &quot;change button color&quot;
  ADD_FEATURE = &apos;ADD_FEATURE&apos;,              // &quot;add a videos page&quot;, &quot;create new component&quot;
  FIX_ISSUE = &apos;FIX_ISSUE&apos;,                 // &quot;fix the styling&quot;, &quot;resolve error&quot;
  REFACTOR = &apos;REFACTOR&apos;,                   // &quot;reorganize&quot;, &quot;clean up&quot;
  FULL_REBUILD = &apos;FULL_REBUILD&apos;,           // &quot;start over&quot;, &quot;recreate everything&quot;
  UPDATE_STYLE = &apos;UPDATE_STYLE&apos;,           // &quot;change colors&quot;, &quot;update theme&quot;
  ADD_DEPENDENCY = &apos;ADD_DEPENDENCY&apos;        // &quot;install package&quot;, &quot;add library&quot;
}

export interface EditIntent {
  type: EditType;
  targetFiles: string[]; // Predicted files to edit
  confidence: number; // 0-1 confidence score
  description: string; // Human-readable description
  suggestedContext: string[]; // Additional files to include for context
}

// Patterns for intent detection
export interface IntentPattern {
  patterns: RegExp[];
  type: EditType;
  fileResolver: (prompt: string, manifest: FileManifest) =&amp;gt; string[];
}