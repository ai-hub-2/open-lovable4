// Application Configuration
// This file contains all configurable settings for the application

export const appConfig = {
  // E2B Sandbox Configuration
  e2b: {
    // Sandbox timeout in minutes
    timeoutMinutes: 15,
    
    // Convert to milliseconds for E2B API
    get timeoutMs() {
      return this.timeoutMinutes * 60 * 1000;
    },
    
    // Vite development server port
    vitePort: 5173,
    
    // Time to wait for Vite to be ready (in milliseconds)
    viteStartupDelay: 7000,
    
    // Time to wait for CSS rebuild (in milliseconds)
    cssRebuildDelay: 2000,
    
    // Default sandbox template (if using templates)
    defaultTemplate: undefined, // or specify a template ID
  },
  
  // AI Model Configuration
  ai: {
    // Default AI model
    defaultModel: &apos;moonshotai/kimi-k2-instruct&apos;,
    
    // Available models
    availableModels: [
      &apos;openai/gpt-5&apos;,
      &apos;moonshotai/kimi-k2-instruct&apos;,
      &apos;anthropic/claude-sonnet-4-20250514&apos;,
      &apos;google/gemini-2.5-pro&apos;
    ],
    
    // Model display names
    modelDisplayNames: {
      &apos;openai/gpt-5&apos;: &apos;GPT-5&apos;,
      &apos;moonshotai/kimi-k2-instruct&apos;: &apos;Kimi K2 Instruct&apos;,
      &apos;anthropic/claude-sonnet-4-20250514&apos;: &apos;Sonnet 4&apos;,
      &apos;google/gemini-2.5-pro&apos;: &apos;Gemini 2.5 Pro&apos;
    },
    
    // Temperature settings for non-reasoning models
    defaultTemperature: 0.7,
    
    // Max tokens for code generation
    maxTokens: 8000,
    
    // Max tokens for truncation recovery
    truncationRecoveryMaxTokens: 4000,
  },
  
  // Code Application Configuration
  codeApplication: {
    // Delay after applying code before refreshing iframe (milliseconds)
    defaultRefreshDelay: 2000,
    
    // Delay when packages are installed (milliseconds)
    packageInstallRefreshDelay: 5000,
    
    // Enable/disable automatic truncation recovery
    enableTruncationRecovery: false, // Disabled - too many false positives
    
    // Maximum number of truncation recovery attempts per file
    maxTruncationRecoveryAttempts: 1,
  },
  
  // UI Configuration
  ui: {
    // Show/hide certain UI elements
    showModelSelector: true,
    showStatusIndicator: true,
    
    // Animation durations (milliseconds)
    animationDuration: 200,
    
    // Toast notification duration (milliseconds)
    toastDuration: 3000,
    
    // Maximum chat messages to keep in memory
    maxChatMessages: 100,
    
    // Maximum recent messages to send as context
    maxRecentMessagesContext: 20,
  },
  
  // Development Configuration
  dev: {
    // Enable debug logging
    enableDebugLogging: true,
    
    // Enable performance monitoring
    enablePerformanceMonitoring: false,
    
    // Log API responses
    logApiResponses: true,
  },
  
  // Package Installation Configuration
  packages: {
    // Use --legacy-peer-deps flag for npm install
    useLegacyPeerDeps: true,
    
    // Package installation timeout (milliseconds)
    installTimeout: 60000,
    
    // Auto-restart Vite after package installation
    autoRestartVite: true,
  },
  
  // File Management Configuration
  files: {
    // Excluded file patterns (files to ignore)
    excludePatterns: [
      &apos;node_modules/**&apos;,
      &apos;.git/**&apos;,
      &apos;.next/**&apos;,
      &apos;dist/**&apos;,
      &apos;build/**&apos;,
      &apos;*.log&apos;,
      &apos;.DS_Store&apos;
    ],
    
    // Maximum file size to read (bytes)
    maxFileSize: 1024 * 1024, // 1MB
    
    // File extensions to treat as text
    textFileExtensions: [
      &apos;.js&apos;, &apos;.jsx&apos;, &apos;.ts&apos;, &apos;.tsx&apos;,
      &apos;.css&apos;, &apos;.scss&apos;, &apos;.sass&apos;,
      &apos;.html&apos;, &apos;.xml&apos;, &apos;.svg&apos;,
      &apos;.json&apos;, &apos;.yml&apos;, &apos;.yaml&apos;,
      &apos;.md&apos;, &apos;.txt&apos;, &apos;.env&apos;,
      &apos;.gitignore&apos;, &apos;.dockerignore&apos;
    ],
  },
  
  // API Endpoints Configuration (for external services)
  api: {
    // Retry configuration
    maxRetries: 3,
    retryDelay: 1000, // milliseconds
    
    // Request timeout (milliseconds)
    requestTimeout: 30000,
  }
};

// Type-safe config getter
export function getConfig&amp;lt;K extends keyof typeof appConfig&amp;gt;(key: K): typeof appConfig[K] {
  return appConfig[key];
}

// Helper to get nested config values
export function getConfigValue(path: string): any {
  return path.split(&apos;.&apos;).reduce((obj, key) =&amp;gt; obj?.[key], appConfig as any);
}

export default appConfig;