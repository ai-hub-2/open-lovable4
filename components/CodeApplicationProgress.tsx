import React from &apos;react&apos;;
import { motion, AnimatePresence } from &apos;framer-motion&apos;;

export interface CodeApplicationState {
  stage: &apos;analyzing&apos; | &apos;installing&apos; | &apos;applying&apos; | &apos;complete&apos; | null;
  packages?: string[];
  installedPackages?: string[];
  filesGenerated?: string[];
  message?: string;
}

interface CodeApplicationProgressProps {
  state: CodeApplicationState;
}

export default function CodeApplicationProgress({ state }: CodeApplicationProgressProps) {
  if (!state.stage || state.stage === &apos;complete&apos;) return null;

  return (
    &amp;lt;AnimatePresence mode=&quot;wait&quot;&amp;gt;
      &amp;lt;motion.div
        key=&quot;loading&quot;
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className=&quot;inline-block bg-gray-100 rounded-[10px] p-3 mt-2&quot;
      &amp;gt;
        &amp;lt;div className=&quot;flex items-center gap-3&quot;&amp;gt;
          {/* Rotating loading indicator */}
          &amp;lt;motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: &quot;linear&quot; }}
            className=&quot;w-4 h-4&quot;
          &amp;gt;
            &amp;lt;svg className=&quot;w-full h-full&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot;&amp;gt;
              &amp;lt;circle 
                cx=&quot;12&quot; 
                cy=&quot;12&quot; 
                r=&quot;10&quot; 
                stroke=&quot;currentColor&quot; 
                strokeWidth=&quot;2&quot; 
                strokeLinecap=&quot;round&quot;
                strokeDasharray=&quot;31.416&quot;
                strokeDashoffset=&quot;10&quot;
                className=&quot;text-gray-700&quot;
              /&amp;gt;
            &amp;lt;/svg&amp;gt;
          &amp;lt;/motion.div&amp;gt;

          {/* Simple loading text */}
          &amp;lt;div className=&quot;text-sm font-medium text-gray-700&quot;&amp;gt;
            Applying to sandbox...
          &amp;lt;/div&amp;gt;
        &amp;lt;/div&amp;gt;
      &amp;lt;/motion.div&amp;gt;
    &amp;lt;/AnimatePresence&amp;gt;
  );
}