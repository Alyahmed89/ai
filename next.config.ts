import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // devIndicators configuration with valid position property
  // appIsrStatus is not a valid property in Next.js 16.1.6
  devIndicators: {
    position: 'bottom-right',
  },
  // Disable source maps in production to reduce bundle size
  productionBrowserSourceMaps: false,
  // Enable compression
  compress: true,
  // Optimize bundle splitting
  experimental: {
    optimizeCss: true,
    // Enable granular chunks for better code splitting
    granularChunks: true,
    // Enable module exclusion for smaller bundles
    externalDir: true,
  },
  // Reduce bundle size by excluding unnecessary modules
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Client-side optimizations
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          maxSize: 200000, // 200KB chunks
          minSize: 10000, // 10KB minimum
        },
      };
    }
    return config;
  },
};

export default nextConfig;
