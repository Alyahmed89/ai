import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable source maps in production to reduce bundle size
  productionBrowserSourceMaps: false,
  // Enable compression
  compress: true,
  // Optimize bundle splitting
  experimental: {
    optimizeCss: true,
  },
  // Output configuration for Cloudflare Pages
  // Use 'export' for static export, but we need API routes so we can't use static export
  // output: 'export',
  output: 'standalone',
  // Image optimization
  images: {
    unoptimized: true, // Cloudflare Pages handles optimization
  },
};

export default nextConfig;
