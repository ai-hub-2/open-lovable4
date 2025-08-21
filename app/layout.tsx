import type { Metadata } from &quot;next&quot;;
import { Inter } from &quot;next/font/google&quot;;
import &quot;./globals.css&quot;;

const inter = Inter({ subsets: [&quot;latin&quot;] });

export const metadata: Metadata = {
  title: &quot;Open Lovable&quot;,
  description: &quot;Re-imagine any website in seconds with AI-powered website builder.&quot;,
};

export default function RootLayout({
  children,
}: Readonly&amp;lt;{
  children: React.ReactNode;
}&amp;gt;) {
  return (
    &amp;lt;html lang=&quot;en&quot;&amp;gt;
      &amp;lt;body className={inter.className}&amp;gt;
        {children}
      &amp;lt;/body&amp;gt;
    &amp;lt;/html&amp;gt;
  );
}
