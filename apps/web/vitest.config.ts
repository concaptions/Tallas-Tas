import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The app's own `@/*` alias (tsconfig `paths`), so a unit test can import a module that uses it.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // `tsconfig.json` sets `jsx: "preserve"` because Next.js compiles the JSX itself; the test
  // transformer (oxc) reads that and refuses to transform a `.tsx` module, so a test could not
  // import a component at all. Overriding it here — and only here, the app's own build is
  // untouched — lets a test assert on a component's returned element without adding a renderer or
  // a DOM: this app has no `@testing-library/react` and needs none for that.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    name: '@tas/web',
    include: ['src/**/*.test.{ts,tsx}'],
    // A few tests here run against PGlite (the onboard action seeds a whole brand template — interface
    // config and every notification default — in WASM Postgres), which is genuinely slow and, at the
    // repo root, contends with every other package's suite for the CPU. `@tas/db` sets the same value
    // for the same reason; the 5s default fails those tests under load, not for being wrong.
    testTimeout: 30_000,
  },
});
