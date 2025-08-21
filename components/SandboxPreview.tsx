import { useState, useEffect } from &apos;react&apos;;
import { Loader2, ExternalLink, RefreshCw, Terminal } from &apos;lucide-react&apos;;

interface SandboxPreviewProps {
  sandboxId: string;
  port: number;
  type: &apos;vite&apos; | &apos;nextjs&apos; | &apos;console&apos;;
  output?: string;
  isLoading?: boolean;
}

export default function SandboxPreview({ 
  sandboxId, 
  port, 
  type, 
  output,
  isLoading = false 
}: SandboxPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState&amp;lt;string&amp;gt;(&apos;&apos;);
  const [showConsole, setShowConsole] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() =&amp;gt; {
    if (sandboxId &amp;&amp; type !== &apos;console&apos;) {
      // In production, this would be the actual E2B sandbox URL
      // Format: https://{sandboxId}-{port}.e2b.dev
      setPreviewUrl(`https://${sandboxId}-${port}.e2b.dev`);
    }
  }, [sandboxId, port, type]);

  const handleRefresh = () =&amp;gt; {
    setIframeKey(prev =&amp;gt; prev + 1);
  };

  if (type === &apos;console&apos;) {
    return (
      &amp;lt;div className=&quot;bg-gray-800 rounded-lg p-4 border border-gray-700&quot;&amp;gt;
        &amp;lt;div className=&quot;font-mono text-sm whitespace-pre-wrap text-gray-300&quot;&amp;gt;
          {output || &apos;No output yet...&apos;}
        &amp;lt;/div&amp;gt;
      &amp;lt;/div&amp;gt;
    );
  }

  return (
    &amp;lt;div className=&quot;space-y-4&quot;&amp;gt;
      {/* Preview Controls */}
      &amp;lt;div className=&quot;flex items-center justify-between bg-gray-800 rounded-lg p-3 border border-gray-700&quot;&amp;gt;
        &amp;lt;div className=&quot;flex items-center gap-3&quot;&amp;gt;
          &amp;lt;span className=&quot;text-sm text-gray-400&quot;&amp;gt;
            {type === &apos;vite&apos; ? &apos;⚡ Vite&apos; : &apos;▲ Next.js&apos;} Preview
          &amp;lt;/span&amp;gt;
          &amp;lt;code className=&quot;text-xs bg-gray-900 px-2 py-1 rounded text-blue-400&quot;&amp;gt;
            {previewUrl}
          &amp;lt;/code&amp;gt;
        &amp;lt;/div&amp;gt;
        &amp;lt;div className=&quot;flex items-center gap-2&quot;&amp;gt;
          &amp;lt;button
            onClick={() =&amp;gt; setShowConsole(!showConsole)}
            className=&quot;p-2 hover:bg-gray-700 rounded transition-colors&quot;
            title=&quot;Toggle console&quot;
          &amp;gt;
            &amp;lt;Terminal className=&quot;w-4 h-4&quot; /&amp;gt;
          &amp;lt;/button&amp;gt;
          &amp;lt;button
            onClick={handleRefresh}
            className=&quot;p-2 hover:bg-gray-700 rounded transition-colors&quot;
            title=&quot;Refresh preview&quot;
          &amp;gt;
            &amp;lt;RefreshCw className=&quot;w-4 h-4&quot; /&amp;gt;
          &amp;lt;/button&amp;gt;
          &amp;lt;a
            href={previewUrl}
            target=&quot;_blank&quot;
            rel=&quot;noopener noreferrer&quot;
            className=&quot;p-2 hover:bg-gray-700 rounded transition-colors&quot;
            title=&quot;Open in new tab&quot;
          &amp;gt;
            &amp;lt;ExternalLink className=&quot;w-4 h-4&quot; /&amp;gt;
          &amp;lt;/a&amp;gt;
        &amp;lt;/div&amp;gt;
      &amp;lt;/div&amp;gt;

      {/* Main Preview */}
      &amp;lt;div className=&quot;relative bg-gray-900 rounded-lg overflow-hidden border border-gray-700&quot;&amp;gt;
        {isLoading &amp;&amp; (
          &amp;lt;div className=&quot;absolute inset-0 bg-gray-900/80 flex items-center justify-center z-10&quot;&amp;gt;
            &amp;lt;div className=&quot;text-center&quot;&amp;gt;
              &amp;lt;Loader2 className=&quot;w-8 h-8 animate-spin mx-auto mb-2&quot; /&amp;gt;
              &amp;lt;p className=&quot;text-sm text-gray-400&quot;&amp;gt;
                {type === &apos;vite&apos; ? &apos;Starting Vite dev server...&apos; : &apos;Starting Next.js dev server...&apos;}
              &amp;lt;/p&amp;gt;
            &amp;lt;/div&amp;gt;
          &amp;lt;/div&amp;gt;
        )}
        
        &amp;lt;iframe
          key={iframeKey}
          src={previewUrl}
          className=&quot;w-full h-[600px] bg-white&quot;
          title={`${type} preview`}
          sandbox=&quot;allow-scripts allow-same-origin allow-forms&quot;
        /&amp;gt;
      &amp;lt;/div&amp;gt;

      {/* Console Output (Toggle) */}
      {showConsole &amp;&amp; output &amp;&amp; (
        &amp;lt;div className=&quot;bg-gray-800 rounded-lg p-4 border border-gray-700&quot;&amp;gt;
          &amp;lt;div className=&quot;flex items-center justify-between mb-2&quot;&amp;gt;
            &amp;lt;span className=&quot;text-sm font-semibold text-gray-400&quot;&amp;gt;Console Output&amp;lt;/span&amp;gt;
          &amp;lt;/div&amp;gt;
          &amp;lt;div className=&quot;font-mono text-xs whitespace-pre-wrap text-gray-300 max-h-48 overflow-y-auto&quot;&amp;gt;
            {output}
          &amp;lt;/div&amp;gt;
        &amp;lt;/div&amp;gt;
      )}
    &amp;lt;/div&amp;gt;
  );
}