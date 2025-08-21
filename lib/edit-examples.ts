/**
 * Example-based prompts for teaching AI proper edit behavior
 */

export const EDIT_EXAMPLES = `
## Edit Strategy Examples

### Example 1: Update Header Color
USER: &quot;Make the header background black&quot;

CORRECT APPROACH:
1. Identify Header component location
2. Edit ONLY Header.jsx
3. Change background color class/style

INCORRECT APPROACH:
- Regenerating entire App.jsx
- Creating new Header.jsx from scratch
- Modifying unrelated files

EXPECTED OUTPUT:
&amp;lt;file path=&quot;src/components/Header.jsx&quot;&amp;gt;
// Only the Header component with updated background
// Preserving all existing functionality
&amp;lt;/file&amp;gt;

### Example 2: Add New Page
USER: &quot;Add a videos page&quot;

CORRECT APPROACH:
1. Create Videos.jsx component
2. Update routing in App.jsx or Router component
3. Add navigation link if needed

INCORRECT APPROACH:
- Regenerating entire application
- Recreating all existing pages

EXPECTED OUTPUT:
&amp;lt;file path=&quot;src/components/Videos.jsx&quot;&amp;gt;
// New Videos component
&amp;lt;/file&amp;gt;

&amp;lt;file path=&quot;src/App.jsx&quot;&amp;gt;
// ONLY the routing update, preserving everything else
&amp;lt;/file&amp;gt;

### Example 3: Fix Styling Issue
USER: &quot;Fix the button styling on mobile&quot;

CORRECT APPROACH:
1. Identify which component has the button
2. Update only that component&apos;s Tailwind classes
3. Add responsive modifiers (sm:, md:, etc)

INCORRECT APPROACH:
- Regenerating all components
- Creating new CSS files
- Modifying global styles unnecessarily

### Example 4: Add Feature to Component
USER: &quot;Add a search bar to the header&quot;

CORRECT APPROACH:
1. Modify Header.jsx to add search functionality
2. Preserve all existing header content
3. Integrate search seamlessly

INCORRECT APPROACH:
- Creating Header.jsx from scratch
- Losing existing navigation/branding

### Example 5: Add New Component
USER: &quot;Add a newsletter signup to the footer&quot;

CORRECT APPROACH:
1. Create Newsletter.jsx component
2. UPDATE Footer.jsx to import Newsletter
3. Add &amp;lt;Newsletter /&amp;gt; in the appropriate place in Footer

EXPECTED OUTPUT:
&amp;lt;file path=&quot;src/components/Newsletter.jsx&quot;&amp;gt;
// New Newsletter component
&amp;lt;/file&amp;gt;

&amp;lt;file path=&quot;src/components/Footer.jsx&quot;&amp;gt;
// Updated Footer with Newsletter import and usage
import Newsletter from &apos;./Newsletter&apos;;
// ... existing code ...
// Add &amp;lt;Newsletter /&amp;gt; in the render
&amp;lt;/file&amp;gt;

### Example 6: Add External Library
USER: &quot;Add animations with framer-motion to the hero&quot;

CORRECT APPROACH:
1. Import framer-motion in Hero.jsx
2. Use motion components
3. System will auto-install framer-motion

EXPECTED OUTPUT:
&amp;lt;file path=&quot;src/components/Hero.jsx&quot;&amp;gt;
import { motion } from &apos;framer-motion&apos;;
// ... rest of Hero with motion animations
&amp;lt;/file&amp;gt;

### Example 7: Remove Element
USER: &quot;Remove start deploying button&quot;

CORRECT APPROACH:
1. Search for &quot;start deploying&quot; in all component files
2. Find it in Hero.jsx
3. Edit ONLY Hero.jsx to remove that button

INCORRECT APPROACH:
- Creating a new file
- Editing multiple files
- Redesigning the entire Hero

EXPECTED OUTPUT:
&amp;lt;file path=&quot;src/components/Hero.jsx&quot;&amp;gt;
// Hero component with &quot;start deploying&quot; button removed
// All other content preserved
&amp;lt;/file&amp;gt;

### Example 8: Delete Section
USER: &quot;Delete the testimonials section&quot;

CORRECT APPROACH:
1. Find which file contains testimonials
2. Remove only that section from the file
3. Keep all other content intact

INCORRECT APPROACH:
- Deleting the entire file
- Recreating the page without testimonials

### Example 9: Change a Single Style (CRITICAL EXAMPLE)
USER: &quot;update the hero to bg blue&quot;

CORRECT APPROACH:
1. Identify the Hero component file: &apos;src/components/Hero.jsx&apos;.
2. Locate the outermost &apos;div&apos; or container element.
3. Find the existing background color class (e.g., &apos;bg-gray-900&apos;).
4. Replace ONLY that class with &apos;bg-blue-500&apos;.
5. Return the entire file, completely unchanged except for that single class modification.

**Original File Content (BEFORE):**
&amp;lt;file path=&quot;src/components/Hero.jsx&quot;&amp;gt;
import React from &apos;react&apos;;

export default function Hero() {
  return (
    &amp;lt;div className=&quot;w-full bg-gray-900 text-white py-20 px-4&quot;&amp;gt;
      &amp;lt;h1 className=&quot;text-5xl font-bold&quot;&amp;gt;Welcome to the App&amp;lt;/h1&amp;gt;
      &amp;lt;p className=&quot;mt-4 text-lg&quot;&amp;gt;This is the original hero section.&amp;lt;/p&amp;gt;
      &amp;lt;button className=&quot;mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg&quot;&amp;gt;
        Get Started
      &amp;lt;/button&amp;gt;
    &amp;lt;/div&amp;gt;
  );
}
&amp;lt;/file&amp;gt;

**Expected Output (AFTER):**
&amp;lt;file path=&quot;src/components/Hero.jsx&quot;&amp;gt;
import React from &apos;react&apos;;

export default function Hero() {
  return (
    &amp;lt;div className=&quot;w-full bg-blue-500 text-white py-20 px-4&quot;&amp;gt;
      &amp;lt;h1 className=&quot;text-5xl font-bold&quot;&amp;gt;Welcome to the App&amp;lt;/h1&amp;gt;
      &amp;lt;p className=&quot;mt-4 text-lg&quot;&amp;gt;This is the original hero section.&amp;lt;/p&amp;gt;
      &amp;lt;button className=&quot;mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg&quot;&amp;gt;
        Get Started
      &amp;lt;/button&amp;gt;
    &amp;lt;/div&amp;gt;
  );
}
&amp;lt;/file&amp;gt;

NOTICE: Everything remains EXACTLY the same except &apos;bg-gray-900&apos; → &apos;bg-blue-500&apos;. 
- The button still has bg-blue-600 (unchanged)
- All text, structure, imports are identical
- No reformatting, no &quot;improvements&quot;, no cleanup

## Key Principles

1. **Minimal Changes**: Only modify what&apos;s necessary
2. **Preserve Functionality**: Keep all existing features
3. **Respect Structure**: Follow existing patterns
4. **Target Precision**: Edit specific files, not everything
5. **Context Awareness**: Use imports/exports to understand relationships

## File Identification Patterns

- &quot;header&quot; → src/components/Header.jsx
- &quot;navigation&quot; → src/components/Nav.jsx or Header.jsx
- &quot;footer&quot; → src/components/Footer.jsx
- &quot;home page&quot; → src/App.jsx or src/pages/Home.jsx
- &quot;styling&quot; → Component files (Tailwind) or index.css
- &quot;routing&quot; → App.jsx or Router component
- &quot;layout&quot; → Layout components or App.jsx

## Edit Intent Classification

UPDATE_COMPONENT: Modify existing component
- Keywords: update, change, modify, edit, fix
- Action: Edit single file

ADD_FEATURE: Add new functionality
- Keywords: add, create, implement, build
- Action: Create new files + minimal edits

FIX_ISSUE: Resolve problems
- Keywords: fix, resolve, debug, repair
- Action: Targeted fixes

UPDATE_STYLE: Change appearance
- Keywords: style, color, theme, design
- Action: Update Tailwind classes

REFACTOR: Improve code quality
- Keywords: refactor, clean, optimize
- Action: Restructure without changing behavior
`;

export function getEditExamplesPrompt(): string {
  return EDIT_EXAMPLES;
}

export function getComponentPatternPrompt(fileStructure: string): string {
  return `
## Current Project Structure

${fileStructure}

## Component Naming Patterns
Based on your file structure, here are the patterns to follow:

1. Component files are in: src/components/
2. Page components might be in: src/pages/ or src/components/
3. Utility functions are in: src/utils/ or src/lib/
4. Styles use Tailwind classes inline
5. Main app entry is: src/App.jsx

When the user mentions a component by name, look for:
- Exact matches first (Header → Header.jsx)
- Partial matches (nav → Navigation.jsx, NavBar.jsx)
- Semantic matches (top bar → Header.jsx)
`;
}