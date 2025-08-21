import * as React from &quot;react&quot;

import { cn } from &quot;@/lib/utils&quot;

export type InputProps = React.InputHTMLAttributes&amp;lt;HTMLInputElement&amp;gt;

const Input = React.forwardRef&amp;lt;HTMLInputElement, InputProps&amp;gt;(
  ({ className, type, ...props }, ref) =&amp;gt; {
    return (
      &amp;lt;input
        type={type}
        className={cn(
          &quot;flex h-10 w-full rounded-[10px] border border-zinc-300 bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [box-shadow:inset_0px_-2px_0px_0px_#e4e4e7,_0px_1px_6px_0px_rgba(228,_228,_231,_30%)] hover:[box-shadow:inset_0px_-2px_0px_0px_#d4d4d8,_0px_1px_6px_0px_rgba(212,_212,_216,_40%)] focus-visible:[box-shadow:inset_0px_-2px_0px_0px_#f97316,_0px_1px_6px_0px_rgba(249,_115,_22,_30%)] transition-all duration-200&quot;,
          className
        )}
        ref={ref}
        {...props}
      /&amp;gt;
    )
  }
)
Input.displayName = &quot;Input&quot;

export { Input }