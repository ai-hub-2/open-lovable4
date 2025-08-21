import * as React from &quot;react&quot;
import { cva, type VariantProps } from &quot;class-variance-authority&quot;

import { cn } from &quot;@/lib/utils&quot;

const labelVariants = cva(
  &quot;text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70&quot;
)

const Label = React.forwardRef&amp;lt;
  HTMLLabelElement,
  React.ComponentPropsWithoutRef&amp;lt;&quot;label&quot;&amp;gt; &amp;
    VariantProps&amp;lt;typeof labelVariants&amp;gt;
&amp;gt;(({ className, ...props }, ref) =&amp;gt; (
  &amp;lt;label
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  /&amp;gt;
))
Label.displayName = &quot;Label&quot;

export { Label }