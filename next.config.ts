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
  // Optimize bundle splitting - Turbopack compatible
  experimental: {
    optimizeCss: true,
    // Enable module exclusion for smaller bundles
    externalDir: true,
  },
  // Add empty turbopack config to avoid conflicts
  turbopack: {},
};

export default nextConfig;
