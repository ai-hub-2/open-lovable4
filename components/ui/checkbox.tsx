import * as React from &quot;react&quot;
import { Check } from &quot;lucide-react&quot;

import { cn } from &quot;@/lib/utils&quot;

export interface CheckboxProps {
  label?: string
  defaultChecked?: boolean
  disabled?: boolean
  className?: string
  onChange?: (checked: boolean) =&amp;gt; void
}

const Checkbox = React.forwardRef&amp;lt;HTMLDivElement, CheckboxProps&amp;gt;(
  ({ label, defaultChecked = false, disabled = false, className, onChange }, ref) =&amp;gt; {
    const [checked, setChecked] = React.useState(defaultChecked)

    const handleToggle = () =&amp;gt; {
      if (!disabled) {
        const newChecked = !checked
        setChecked(newChecked)
        onChange?.(newChecked)
      }
    }

    return (
      &amp;lt;div
        ref={ref}
        className={cn(&quot;flex items-center gap-2&quot;, className)}
      &amp;gt;
        &amp;lt;button
          type=&quot;button&quot;
          onClick={handleToggle}
          disabled={disabled}
          className={cn(
            &quot;h-4 w-4 rounded border border-zinc-300 flex items-center justify-center transition-all duration-200&quot;,
            &quot;[box-shadow:inset_0px_-1px_0px_0px_#e4e4e7,_0px_1px_3px_0px_rgba(228,_228,_231,_20%)]&quot;,
            !disabled &amp;&amp; &quot;hover:[box-shadow:inset_0px_-1px_0px_0px_#d4d4d8,_0px_1px_3px_0px_rgba(212,_212,_216,_30%)]&quot;,
            checked &amp;&amp; &quot;bg-orange-500 border-orange-500 [box-shadow:inset_0px_-1px_0px_0px_#c2410c,_0px_1px_3px_0px_rgba(234,_88,_12,_30%)]&quot;,
            disabled &amp;&amp; &quot;opacity-50 cursor-not-allowed&quot;
          )}
        &amp;gt;
          {checked &amp;&amp; &amp;lt;Check className=&quot;h-3 w-3 text-white&quot; /&amp;gt;}
        &amp;lt;/button&amp;gt;
        {label &amp;&amp; (
          &amp;lt;label
            onClick={handleToggle}
            className={cn(
              &quot;text-sm select-none&quot;,
              !disabled &amp;&amp; &quot;cursor-pointer&quot;,
              disabled &amp;&amp; &quot;opacity-50 cursor-not-allowed&quot;
            )}
          &amp;gt;
            {label}
          &amp;lt;/label&amp;gt;
        )}
      &amp;lt;/div&amp;gt;
    )
  }
)
Checkbox.displayName = &quot;Checkbox&quot;

export { Checkbox }