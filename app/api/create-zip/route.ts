export const dynamic = &quot;force-static&quot;;


import { NextRequest, NextResponse } from &apos;next/server&apos;;

declare global {
  var activeSandbox: any;
}

export async function POST(request: NextRequest) {
  try {
    if (!global.activeSandbox) {
      return NextResponse.json({ 
        success: false, 
        error: &apos;No active sandbox&apos; 
      }, { status: 400 });
    }
    
    console.log(&apos;[create-zip] Creating project zip...&apos;);
    
    // Create zip file in sandbox
    const result = await global.activeSandbox.runCode(`
import zipfile
import os
import json

os.chdir(&apos;/home/user/app&apos;)

# Create zip file
with zipfile.ZipFile(&apos;/tmp/project.zip&apos;, &apos;w&apos;, zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(&apos;.&apos;):
        # Skip node_modules and .git
        dirs[:] = [d for d in dirs if d not in [&apos;node_modules&apos;, &apos;.git&apos;, &apos;.next&apos;, &apos;dist&apos;]]
        
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, &apos;.&apos;)
            zipf.write(file_path, arcname)

# Get file size
file_size = os.path.getsize(&apos;/tmp/project.zip&apos;)
print(f&quot; Created project.zip ({file_size} bytes)&quot;)
    `);
    
    // Read the zip file and convert to base64
    const readResult = await global.activeSandbox.runCode(`
import base64

with open(&apos;/tmp/project.zip&apos;, &apos;rb&apos;) as f:
    content = f.read()
    encoded = base64.b64encode(content).decode(&apos;utf-8&apos;)
    print(encoded)
    `);
    
    const base64Content = readResult.logs.stdout.join(&apos;&apos;).trim();
    
    // Create a data URL for download
    const dataUrl = `data:application/zip;base64,${base64Content}`;
    
    return NextResponse.json({
      success: true,
      dataUrl,
      fileName: &apos;e2b-project.zip&apos;,
      message: &apos;Zip file created successfully&apos;
    });
    
  } catch (error) {
    console.error(&apos;[create-zip] Error:&apos;, error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}