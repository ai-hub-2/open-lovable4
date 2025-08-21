export const dynamic = &quot;force-static&quot;;


import { NextResponse } from &apos;next/server&apos;;
import { Sandbox } from &apos;@e2b/code-interpreter&apos;;
import type { SandboxState } from &apos;@/types/sandbox&apos;;
import { appConfig } from &apos;@/config/app.config&apos;;

// Store active sandbox globally
declare global {
  var activeSandbox: any;
  var sandboxData: any;
  var existingFiles: Set&amp;lt;string&amp;gt;;
  var sandboxState: SandboxState;
}

export async function POST() {
  let sandbox: any = null;

  try {
    console.log(&apos;[create-ai-sandbox] Creating base sandbox...&apos;);
    
    // Kill existing sandbox if any
    if (global.activeSandbox) {
      console.log(&apos;[create-ai-sandbox] Killing existing sandbox...&apos;);
      try {
        await global.activeSandbox.kill();
      } catch (e) {
        console.error(&apos;Failed to close existing sandbox:&apos;, e);
      }
      global.activeSandbox = null;
    }
    
    // Clear existing files tracking
    if (global.existingFiles) {
      global.existingFiles.clear();
    } else {
      global.existingFiles = new Set&amp;lt;string&amp;gt;();
    }

    // Create base sandbox - we&apos;ll set up Vite ourselves for full control
    console.log(`[create-ai-sandbox] Creating base E2B sandbox with ${appConfig.e2b.timeoutMinutes} minute timeout...`);
    sandbox = await Sandbox.create({ 
      apiKey: process.env.E2B_API_KEY,
      timeoutMs: appConfig.e2b.timeoutMs
    });
    
    const sandboxId = (sandbox as any).sandboxId || Date.now().toString();
    const host = (sandbox as any).getHost(appConfig.e2b.vitePort);
    
    console.log(`[create-ai-sandbox] Sandbox created: ${sandboxId}`);
    console.log(`[create-ai-sandbox] Sandbox host: ${host}`);

    // Set up a basic Vite React app using Python to write files
    console.log(&apos;[create-ai-sandbox] Setting up Vite React app...&apos;);
    
    // Write all files in a single Python script to avoid multiple executions
    const setupScript = `
import os
import json

print(&apos;Setting up React app with Vite and Tailwind...&apos;)

# Create directory structure
os.makedirs(&apos;/home/user/app/src&apos;, exist_ok=True)

# Package.json
package_json = {
    &quot;name&quot;: &quot;sandbox-app&quot;,
    &quot;version&quot;: &quot;1.0.0&quot;,
    &quot;type&quot;: &quot;module&quot;,
    &quot;scripts&quot;: {
        &quot;dev&quot;: &quot;vite --host&quot;,
        &quot;build&quot;: &quot;vite build&quot;,
        &quot;preview&quot;: &quot;vite preview&quot;
    },
    &quot;dependencies&quot;: {
        &quot;react&quot;: &quot;^18.2.0&quot;,
        &quot;react-dom&quot;: &quot;^18.2.0&quot;
    },
    &quot;devDependencies&quot;: {
        &quot;@vitejs/plugin-react&quot;: &quot;^4.0.0&quot;,
        &quot;vite&quot;: &quot;^4.3.9&quot;,
        &quot;tailwindcss&quot;: &quot;^3.3.0&quot;,
        &quot;postcss&quot;: &quot;^8.4.31&quot;,
        &quot;autoprefixer&quot;: &quot;^10.4.16&quot;
    }
}

with open(&apos;/home/user/app/package.json&apos;, &apos;w&apos;) as f:
    json.dump(package_json, f, indent=2)
print(&apos;✓ package.json&apos;)

# Vite config for E2B - with allowedHosts
vite_config = &quot;&quot;&quot;import { defineConfig } from &apos;vite&apos;
import react from &apos;@vitejs/plugin-react&apos;

// E2B-compatible Vite configuration
export default defineConfig({
  plugins: [react()],
  server: {
    host: &apos;0.0.0.0&apos;,
    port: 5173,
    strictPort: true,
    hmr: false,
    allowedHosts: [&apos;.e2b.app&apos;, &apos;localhost&apos;, &apos;127.0.0.1&apos;]
  }
})&quot;&quot;&quot;

with open(&apos;/home/user/app/vite.config.js&apos;, &apos;w&apos;) as f:
    f.write(vite_config)
print(&apos;✓ vite.config.js&apos;)

# Tailwind config - standard without custom design tokens
tailwind_config = &quot;&quot;&quot;/** @type {import(&apos;tailwindcss&apos;).Config} */
export default {
  content: [
    &quot;./index.html&quot;,
    &quot;./src/**/*.{js,ts,jsx,tsx}&quot;,
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}&quot;&quot;&quot;

with open(&apos;/home/user/app/tailwind.config.js&apos;, &apos;w&apos;) as f:
    f.write(tailwind_config)
print(&apos;✓ tailwind.config.js&apos;)

# PostCSS config
postcss_config = &quot;&quot;&quot;export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}&quot;&quot;&quot;

with open(&apos;/home/user/app/postcss.config.js&apos;, &apos;w&apos;) as f:
    f.write(postcss_config)
print(&apos;✓ postcss.config.js&apos;)

# Index.html
index_html = &quot;&quot;&quot;&amp;lt;!DOCTYPE html&amp;gt;
&amp;lt;html lang=&quot;en&quot;&amp;gt;
  &amp;lt;head&amp;gt;
    &amp;lt;meta charset=&quot;UTF-8&quot; /&amp;gt;
    &amp;lt;meta name=&quot;viewport&quot; content=&quot;width=device-width, initial-scale=1.0&quot; /&amp;gt;
    &amp;lt;title&amp;gt;Sandbox App&amp;lt;/title&amp;gt;
  &amp;lt;/head&amp;gt;
  &amp;lt;body&amp;gt;
    &amp;lt;div id=&quot;root&quot;&amp;gt;&amp;lt;/div&amp;gt;
    &amp;lt;script type=&quot;module&quot; src=&quot;/src/main.jsx&quot;&amp;gt;&amp;lt;/script&amp;gt;
  &amp;lt;/body&amp;gt;
&amp;lt;/html&amp;gt;&quot;&quot;&quot;

with open(&apos;/home/user/app/index.html&apos;, &apos;w&apos;) as f:
    f.write(index_html)
print(&apos;✓ index.html&apos;)

# Main.jsx
main_jsx = &quot;&quot;&quot;import React from &apos;react&apos;
import ReactDOM from &apos;react-dom/client&apos;
import App from &apos;./App.jsx&apos;
import &apos;./index.css&apos;

ReactDOM.createRoot(document.getElementById(&apos;root&apos;)).render(
  &amp;lt;React.StrictMode&amp;gt;
    &amp;lt;App /&amp;gt;
  &amp;lt;/React.StrictMode&amp;gt;,
)&quot;&quot;&quot;

with open(&apos;/home/user/app/src/main.jsx&apos;, &apos;w&apos;) as f:
    f.write(main_jsx)
print(&apos;✓ src/main.jsx&apos;)

# App.jsx with explicit Tailwind test
app_jsx = &quot;&quot;&quot;function App() {
  return (
    &amp;lt;div className=&quot;min-h-screen bg-gray-900 text-white flex items-center justify-center p-4&quot;&amp;gt;
      &amp;lt;div className=&quot;text-center max-w-2xl&quot;&amp;gt;
        &amp;lt;p className=&quot;text-lg text-gray-400&quot;&amp;gt;
          Sandbox Ready&amp;lt;br/&amp;gt;
          Start building your React app with Vite and Tailwind CSS!
        &amp;lt;/p&amp;gt;
      &amp;lt;/div&amp;gt;
    &amp;lt;/div&amp;gt;
  )
}

export default App&quot;&quot;&quot;

with open(&apos;/home/user/app/src/App.jsx&apos;, &apos;w&apos;) as f:
    f.write(app_jsx)
print(&apos;✓ src/App.jsx&apos;)

# Index.css with explicit Tailwind directives
index_css = &quot;&quot;&quot;@tailwind base;
@tailwind components;
@tailwind utilities;

/* Force Tailwind to load */
@layer base {
  :root {
    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -webkit-text-size-adjust: 100%;
  }
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
}

body {
  font-family: -apple-system, BlinkMacSystemFont, &apos;Segoe UI&apos;, Roboto, Oxygen, Ubuntu, sans-serif;
  background-color: rgb(17 24 39);
}&quot;&quot;&quot;

with open(&apos;/home/user/app/src/index.css&apos;, &apos;w&apos;) as f:
    f.write(index_css)
print(&apos;✓ src/index.css&apos;)

print(&apos;\\nAll files created successfully!&apos;)
`;

    // Execute the setup script
    await sandbox.runCode(setupScript);
    
    // Install dependencies
    console.log(&apos;[create-ai-sandbox] Installing dependencies...&apos;);
    await sandbox.runCode(`
import subprocess
import sys

print(&apos;Installing npm packages...&apos;)
result = subprocess.run(
    [&apos;npm&apos;, &apos;install&apos;],
    cwd=&apos;/home/user/app&apos;,
    capture_output=True,
    text=True
)

if result.returncode == 0:
    print(&apos;✓ Dependencies installed successfully&apos;)
else:
    print(f&apos;⚠ Warning: npm install had issues: {result.stderr}&apos;)
    # Continue anyway as it might still work
    `);
    
    // Start Vite dev server
    console.log(&apos;[create-ai-sandbox] Starting Vite dev server...&apos;);
    await sandbox.runCode(`
import subprocess
import os
import time

os.chdir(&apos;/home/user/app&apos;)

# Kill any existing Vite processes
subprocess.run([&apos;pkill&apos;, &apos;-f&apos;, &apos;vite&apos;], capture_output=True)
time.sleep(1)

# Start Vite dev server
env = os.environ.copy()
env[&apos;FORCE_COLOR&apos;] = &apos;0&apos;

process = subprocess.Popen(
    [&apos;npm&apos;, &apos;run&apos;, &apos;dev&apos;],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    env=env
)

print(f&apos;✓ Vite dev server started with PID: {process.pid}&apos;)
print(&apos;Waiting for server to be ready...&apos;)
    `);
    
    // Wait for Vite to be fully ready
    await new Promise(resolve =&amp;gt; setTimeout(resolve, appConfig.e2b.viteStartupDelay));
    
    // Force Tailwind CSS to rebuild by touching the CSS file
    await sandbox.runCode(`
import os
import time

# Touch the CSS file to trigger rebuild
css_file = &apos;/home/user/app/src/index.css&apos;
if os.path.exists(css_file):
    os.utime(css_file, None)
    print(&apos;✓ Triggered CSS rebuild&apos;)
    
# Also ensure PostCSS processes it
time.sleep(2)
print(&apos;✓ Tailwind CSS should be loaded&apos;)
    `);

    // Store sandbox globally
    global.activeSandbox = sandbox;
    global.sandboxData = {
      sandboxId,
      url: `https://${host}`
    };
    
    // Set extended timeout on the sandbox instance if method available
    if (typeof sandbox.setTimeout === &apos;function&apos;) {
      sandbox.setTimeout(appConfig.e2b.timeoutMs);
      console.log(`[create-ai-sandbox] Set sandbox timeout to ${appConfig.e2b.timeoutMinutes} minutes`);
    }
    
    // Initialize sandbox state
    global.sandboxState = {
      fileCache: {
        files: {},
        lastSync: Date.now(),
        sandboxId
      },
      sandbox,
      sandboxData: {
        sandboxId,
        url: `https://${host}`
      }
    };
    
    // Track initial files
    global.existingFiles.add(&apos;src/App.jsx&apos;);
    global.existingFiles.add(&apos;src/main.jsx&apos;);
    global.existingFiles.add(&apos;src/index.css&apos;);
    global.existingFiles.add(&apos;index.html&apos;);
    global.existingFiles.add(&apos;package.json&apos;);
    global.existingFiles.add(&apos;vite.config.js&apos;);
    global.existingFiles.add(&apos;tailwind.config.js&apos;);
    global.existingFiles.add(&apos;postcss.config.js&apos;);
    
    console.log(&apos;[create-ai-sandbox] Sandbox ready at:&apos;, `https://${host}`);
    
    return NextResponse.json({
      success: true,
      sandboxId,
      url: `https://${host}`,
      message: &apos;Sandbox created and Vite React app initialized&apos;
    });

  } catch (error) {
    console.error(&apos;[create-ai-sandbox] Error:&apos;, error);
    
    // Clean up on error
    if (sandbox) {
      try {
        await sandbox.kill();
      } catch (e) {
        console.error(&apos;Failed to close sandbox on error:&apos;, e);
      }
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : &apos;Failed to create sandbox&apos;,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}