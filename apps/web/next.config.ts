import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // ESLint runs once at the repo root through Turborepo (D-009). Left on, `next build` walks up to
  // the root eslint.config.js and runs the same rules a second time.
  eslint: { ignoreDuringBuilds: true },
  // The workspace packages ship TypeScript source, not a build (D-011).
  transpilePackages: ['@tas/db', '@tas/env', '@tas/domain', '@tas/ui'],
  experimental: {
    // `@tas/ui` and `@tas/domain` are barrels: `import { Button } from '@tas/ui'` otherwise pulls every
    // re-export into the client graph — every Radix primitive (~58 kB gzip) reached /sign-in and the
    // client portal through the root error boundary's single `Button` import. The barrel optimizer
    // rewrites named imports to the modules that define them. See docs/decisions.md D-031.
    optimizePackageImports: ['@tas/ui', '@tas/domain'],
  },
};

export default nextConfig;
