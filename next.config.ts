import type { NextConfig } from &quot;next&quot;;

const nextConfig: NextConfig = {
  output: &apos;export&apos;,
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

export default nextConfig;
