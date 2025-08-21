// Global types for sandbox file management

export interface SandboxFile {
  content: string;
  lastModified: number;
}

export interface SandboxFileCache {
  files: Record&amp;lt;string, SandboxFile&amp;gt;;
  lastSync: number;
  sandboxId: string;
  manifest?: any; // FileManifest type from file-manifest.ts
}

export interface SandboxState {
  fileCache: SandboxFileCache | null;
  sandbox: any; // E2B sandbox instance
  sandboxData: {
    sandboxId: string;
    url: string;
  } | null;
}

// Declare global types
declare global {
  var activeSandbox: any;
  var sandboxState: SandboxState;
  var existingFiles: Set&amp;lt;string&amp;gt;;
}

export {};