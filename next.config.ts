import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed output: 'export' as it's incompatible with API routes
  images: {
    unoptimized: true
  }
};

export default nextConfig;
