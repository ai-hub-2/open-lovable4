import { useEffect, useRef } from &apos;react&apos;;

interface HMRErrorDetectorProps {
  iframeRef: React.RefObject&amp;lt;HTMLIFrameElement&amp;gt;;
  onErrorDetected: (errors: Array&amp;lt;{ type: string; message: string; package?: string }&amp;gt;) =&amp;gt; void;
}

export default function HMRErrorDetector({ iframeRef, onErrorDetected }: HMRErrorDetectorProps) {
  const checkIntervalRef = useRef&amp;lt;NodeJS.Timeout | null&amp;gt;(null);

  useEffect(() =&amp;gt; {
    const checkForHMRErrors = () =&amp;gt; {
      if (!iframeRef.current) return;

      try {
        const iframeDoc = iframeRef.current.contentDocument;
        if (!iframeDoc) return;

        // Check for Vite error overlay
        const errorOverlay = iframeDoc.querySelector(&apos;vite-error-overlay&apos;);
        if (errorOverlay) {
          // Try to extract error message
          const messageElement = errorOverlay.shadowRoot?.querySelector(&apos;.message-body&apos;);
          if (messageElement) {
            const errorText = messageElement.textContent || &apos;&apos;;
            
            // Parse import errors
            const importMatch = errorText.match(/Failed to resolve import &quot;([^&quot;]+)&quot;/);
            if (importMatch) {
              const packageName = importMatch[1];
              if (!packageName.startsWith(&apos;.&apos;)) {
                // Extract base package name
                let finalPackage = packageName;
                if (packageName.startsWith(&apos;@&apos;)) {
                  const parts = packageName.split(&apos;/&apos;);
                  finalPackage = parts.length &amp;gt;= 2 ? parts.slice(0, 2).join(&apos;/&apos;) : packageName;
                } else {
                  finalPackage = packageName.split(&apos;/&apos;)[0];
                }

                onErrorDetected([{
                  type: &apos;npm-missing&apos;,
                  message: `Failed to resolve import &quot;${packageName}&quot;`,
                  package: finalPackage
                }]);
              }
            }
          }
        }
      } catch (error) {
        // Cross-origin errors are expected, ignore them
      }
    };

    // Check immediately and then every 2 seconds
    checkForHMRErrors();
    checkIntervalRef.current = setInterval(checkForHMRErrors, 2000);

    return () =&amp;gt; {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [iframeRef, onErrorDetected]);

  return null;
}