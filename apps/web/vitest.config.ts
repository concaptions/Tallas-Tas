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
  },
});
