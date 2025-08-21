import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      // تقسيم الباندل لتجنب تجاوز 25 ميجا
      config.optimization.splitChunks = {
        chunks: 'all',
        maxSize: 25000000, // 25 MiB
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
