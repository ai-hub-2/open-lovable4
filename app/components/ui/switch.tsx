&apos;use client&apos;;

import * as React from &quot;react&quot;
import * as SwitchPrimitives from &quot;@radix-ui/react-switch&quot;
import { cn } from &quot;@/lib/utils&quot;

const Switch = React.forwardRef&amp;lt;
  React.ElementRef&amp;lt;typeof SwitchPrimitives.Root&amp;gt;,
  React.ComponentPropsWithoutRef&amp;lt;typeof SwitchPrimitives.Root&amp;gt;
&amp;gt;(({ className, ...props }, ref) =&amp;gt; (
  &amp;lt;SwitchPrimitives.Root
    className={cn(
      &quot;peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50&quot;,
      &quot;data-[state=checked]:bg-primary data-[state=unchecked]:bg-input&quot;,
      className
    )}
    {...props}
    ref={ref}
  &amp;gt;
    &amp;lt;SwitchPrimitives.Thumb
      className={cn(
        &quot;pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform&quot;,
        &quot;data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0&quot;
      )}
    /&amp;gt;
  &amp;lt;/SwitchPrimitives.Root&amp;gt;
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }