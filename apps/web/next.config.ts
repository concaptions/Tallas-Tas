import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // ESLint runs once at the repo root through Turborepo (D-009). Left on, `next build` walks up to
  // the root eslint.config.js and runs the same rules a second time.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
