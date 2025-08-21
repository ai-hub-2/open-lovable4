import * as React from &quot;react&quot;
import { cva, type VariantProps } from &quot;class-variance-authority&quot;
import { cn } from &quot;@/lib/utils&quot;

const toggleVariants = cva(
  &quot;inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground&quot;,
  {
    variants: {
      variant: {
        default: &quot;bg-transparent&quot;,
        outline:
          &quot;border border-input bg-transparent hover:bg-accent hover:text-accent-foreground&quot;,
      },
      size: {
        default: &quot;h-10 px-3&quot;,
        sm: &quot;h-9 px-2.5&quot;,
        lg: &quot;h-11 px-5&quot;,
      },
    },
    defaultVariants: {
      variant: &quot;default&quot;,
      size: &quot;default&quot;,
    },
  }
)

export interface ToggleProps
  extends React.ButtonHTMLAttributes&amp;lt;HTMLButtonElement&amp;gt;,
    VariantProps&amp;lt;typeof toggleVariants&amp;gt; {
  pressed?: boolean
  onPressedChange?: (pressed: boolean) =&amp;gt; void
}

const Toggle = React.forwardRef&amp;lt;HTMLButtonElement, ToggleProps&amp;gt;(
  ({ className, variant, size, pressed, onPressedChange, ...props }, ref) =&amp;gt; {
    return (
      &amp;lt;button
        ref={ref}
        type=&quot;button&quot;
        aria-pressed={pressed}
        data-state={pressed ? &quot;on&quot; : &quot;off&quot;}
        onClick={() =&amp;gt; onPressedChange?.(!pressed)}
        className={cn(toggleVariants({ variant, size, className }))}
        {...props}
      /&amp;gt;
    )
  }
)

Toggle.displayName = &quot;Toggle&quot;

export { Toggle, toggleVariants }