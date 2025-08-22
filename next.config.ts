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
        maxSize: 20000000, // 20 MiB لكل chunk (أقل من 25 MiB)
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
            maxSize: 20000000, // 20 MiB
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            maxSize: 20000000, // 20 MiB
          },
          // تقسيم إضافي للمكتبات الثقيلة
          heavy: {
            test: /[\\/]node_modules[\\/](react-icons|@ai-sdk|@e2b)[\\/]/,
            name: 'heavy-libs',
            chunks: 'all',
            priority: 15,
            maxSize: 15000000, // 15 MiB
          },
        },
      };
      
      // تحسينات إضافية
      config.optimization.minimize = true;
      config.optimization.minimizer = config.optimization.minimizer || [];
    }
    return config;
  },
};

export default nextConfig;
