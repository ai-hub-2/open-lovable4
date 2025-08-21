import * as React from &quot;react&quot;

import { cn } from &quot;@/lib/utils&quot;

export type SelectProps = React.SelectHTMLAttributes&amp;lt;HTMLSelectElement&amp;gt;

const Select = React.forwardRef&amp;lt;HTMLSelectElement, SelectProps&amp;gt;(
  ({ className, children, ...props }, ref) =&amp;gt; {
    return (
      &amp;lt;select
        className={cn(
          &quot;flex h-10 w-full rounded-[10px] border border-zinc-300 bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [box-shadow:inset_0px_-2px_0px_0px_#e4e4e7,_0px_1px_6px_0px_rgba(228,_228,_231,_30%)] hover:[box-shadow:inset_0px_-2px_0px_0px_#d4d4d8,_0px_1px_6px_0px_rgba(212,_212,_216,_40%)] focus-visible:[box-shadow:inset_0px_-2px_0px_0px_#f97316,_0px_1px_6px_0px_rgba(249,_115,_22,_30%)] transition-all duration-200&quot;,
          className
        )}
        ref={ref}
        {...props}
      &amp;gt;
        {children}
      &amp;lt;/select&amp;gt;
    )
  }
)
Select.displayName = &quot;Select&quot;

export { Select }