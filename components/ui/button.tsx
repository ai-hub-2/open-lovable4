import * as React from &quot;react&quot;
import { cva, type VariantProps } from &quot;class-variance-authority&quot;

import { cn } from &quot;@/lib/utils&quot;

const buttonVariants = cva(
  &quot;inline-flex items-center justify-center whitespace-nowrap rounded-[10px] text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50&quot;,
  {
    variants: {
      variant: {
        default: &quot;bg-zinc-900 text-white hover:bg-zinc-800 [box-shadow:inset_0px_-2px_0px_0px_#18181b,_0px_1px_6px_0px_rgba(24,_24,_27,_58%)] hover:translate-y-[1px] hover:scale-[0.98] hover:[box-shadow:inset_0px_-1px_0px_0px_#18181b,_0px_1px_3px_0px_rgba(24,_24,_27,_40%)] active:translate-y-[2px] active:scale-[0.97] active:[box-shadow:inset_0px_1px_1px_0px_#18181b,_0px_1px_2px_0px_rgba(24,_24,_27,_30%)] disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:scale-100&quot;,
        secondary: &quot;bg-zinc-100 text-zinc-900 hover:bg-zinc-200 [box-shadow:inset_0px_-2px_0px_0px_#d4d4d8,_0px_1px_6px_0px_rgba(161,_161,_170,_58%)] hover:translate-y-[1px] hover:scale-[0.98] hover:[box-shadow:inset_0px_-1px_0px_0px_#d4d4d8,_0px_1px_3px_0px_rgba(161,_161,_170,_40%)] active:translate-y-[2px] active:scale-[0.97] active:[box-shadow:inset_0px_1px_1px_0px_#d4d4d8,_0px_1px_2px_0px_rgba(161,_161,_170,_30%)] disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:scale-100&quot;,
        outline: &quot;border border-zinc-300 bg-transparent hover:bg-zinc-50 text-zinc-900 [box-shadow:inset_0px_-2px_0px_0px_#e4e4e7,_0px_1px_6px_0px_rgba(228,_228,_231,_58%)] hover:translate-y-[1px] hover:scale-[0.98] hover:[box-shadow:inset_0px_-1px_0px_0px_#e4e4e7,_0px_1px_3px_0px_rgba(228,_228,_231,_40%)] active:translate-y-[2px] active:scale-[0.97] active:[box-shadow:inset_0px_1px_1px_0px_#e4e4e7,_0px_1px_2px_0px_rgba(228,_228,_231,_30%)] disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:scale-100&quot;,
        destructive: &quot;bg-red-500 text-white hover:bg-red-600 [box-shadow:inset_0px_-2px_0px_0px_#dc2626,_0px_1px_6px_0px_rgba(239,_68,_68,_58%)] hover:translate-y-[1px] hover:scale-[0.98] hover:[box-shadow:inset_0px_-1px_0px_0px_#dc2626,_0px_1px_3px_0px_rgba(239,_68,_68,_40%)] active:translate-y-[2px] active:scale-[0.97] active:[box-shadow:inset_0px_1px_1px_0px_#dc2626,_0px_1px_2px_0px_rgba(239,_68,_68,_30%)] disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:scale-100&quot;,
        code: &quot;bg-[#36322F] text-white hover:bg-[#4a4542] [box-shadow:inset_0px_-2px_0px_0px_#171310,_0px_1px_6px_0px_rgba(58,_33,_8,_58%)] hover:translate-y-[1px] hover:scale-[0.98] hover:[box-shadow:inset_0px_-1px_0px_0px_#171310,_0px_1px_3px_0px_rgba(58,_33,_8,_40%)] active:translate-y-[2px] active:scale-[0.97] active:[box-shadow:inset_0px_1px_1px_0px_#171310,_0px_1px_2px_0px_rgba(58,_33,_8,_30%)] disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:scale-100&quot;,
        orange: &quot;bg-orange-500 text-white hover:bg-orange-600 [box-shadow:inset_0px_-2px_0px_0px_#c2410c,_0px_1px_6px_0px_rgba(234,_88,_12,_58%)] hover:translate-y-[1px] hover:scale-[0.98] hover:[box-shadow:inset_0px_-1px_0px_0px_#c2410c,_0px_1px_3px_0px_rgba(234,_88,_12,_40%)] active:translate-y-[2px] active:scale-[0.97] active:[box-shadow:inset_0px_1px_1px_0px_#c2410c,_0px_1px_2px_0px_rgba(234,_88,_12,_30%)] disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:scale-100&quot;,
        ghost: &quot;hover:bg-accent hover:text-accent-foreground&quot;,
      },
      size: {
        default: &quot;h-10 px-4 py-2&quot;,
        sm: &quot;h-8 px-3 py-1 text-sm&quot;,
        lg: &quot;h-12 px-6 py-3&quot;,
      },
    },
    defaultVariants: {
      variant: &quot;default&quot;,
      size: &quot;default&quot;,
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes&amp;lt;HTMLButtonElement&amp;gt;,
    VariantProps&amp;lt;typeof buttonVariants&amp;gt; {
  asChild?: boolean
}

const Button = React.forwardRef&amp;lt;HTMLButtonElement, ButtonProps&amp;gt;(
  ({ className, variant, size, asChild = false, ...props }, ref) =&amp;gt; {
    const Comp = asChild ? &quot;button&quot; : &quot;button&quot;
    return (
      &amp;lt;Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      /&amp;gt;
    )
  }
)
Button.displayName = &quot;Button&quot;

export { Button, buttonVariants }