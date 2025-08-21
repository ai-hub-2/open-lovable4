import type { Config } from &quot;tailwindcss&quot;;

const config: Config = {
  darkMode: &quot;class&quot;,
  content: [
    &quot;./pages/**/*.{js,ts,jsx,tsx,mdx}&quot;,
    &quot;./components/**/*.{js,ts,jsx,tsx,mdx}&quot;,
    &quot;./app/**/*.{js,ts,jsx,tsx,mdx}&quot;,
  ],
  theme: {
    container: {
      center: true,
      padding: &quot;2rem&quot;,
      screens: {
        &quot;2xl&quot;: &quot;1400px&quot;,
      },
    },
    extend: {
      colors: {
        border: &quot;hsl(var(--border))&quot;,
        input: &quot;hsl(var(--input))&quot;,
        ring: &quot;hsl(var(--ring))&quot;,
        background: &quot;hsl(var(--background))&quot;,
        foreground: &quot;hsl(var(--foreground))&quot;,
        primary: {
          DEFAULT: &quot;hsl(var(--primary))&quot;,
          foreground: &quot;hsl(var(--primary-foreground))&quot;,
        },
        secondary: {
          DEFAULT: &quot;hsl(var(--secondary))&quot;,
          foreground: &quot;hsl(var(--secondary-foreground))&quot;,
        },
        destructive: {
          DEFAULT: &quot;hsl(var(--destructive))&quot;,
          foreground: &quot;hsl(var(--destructive-foreground))&quot;,
        },
        muted: {
          DEFAULT: &quot;hsl(var(--muted))&quot;,
          foreground: &quot;hsl(var(--muted-foreground))&quot;,
        },
        accent: {
          DEFAULT: &quot;hsl(var(--accent))&quot;,
          foreground: &quot;hsl(var(--accent-foreground))&quot;,
        },
        popover: {
          DEFAULT: &quot;hsl(var(--popover))&quot;,
          foreground: &quot;hsl(var(--popover-foreground))&quot;,
        },
        card: {
          DEFAULT: &quot;hsl(var(--card))&quot;,
          foreground: &quot;hsl(var(--card-foreground))&quot;,
        },
      },
      borderRadius: {
        lg: &quot;var(--radius)&quot;,
        md: &quot;calc(var(--radius) - 2px)&quot;,
        sm: &quot;calc(var(--radius) - 4px)&quot;,
      },
      fontFamily: {
        sans: [&quot;var(--font-inter)&quot;, &quot;ui-sans-serif&quot;, &quot;system-ui&quot;, &quot;sans-serif&quot;],
        mono: [&quot;ui-monospace&quot;, &quot;SFMono-Regular&quot;, &quot;monospace&quot;],
      },
    },
  },
  plugins: [],
};

export default config;