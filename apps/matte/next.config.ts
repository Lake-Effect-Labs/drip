import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workaround for font fetching in restricted environments
  // In production, Google Fonts will work fine on Vercel
  experimental: {
    turbopackUseSystemTlsCerts: true,
  },
};

export default nextConfig;
