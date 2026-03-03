import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // devIndicators configuration with valid position property
  // appIsrStatus is not a valid property in Next.js 16.1.6
  devIndicators: {
    position: 'bottom-right',
  },
};

export default nextConfig;
