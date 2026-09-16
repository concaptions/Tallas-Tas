import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The app's own `@/*` alias (tsconfig `paths`), so a unit test can import a module that uses it.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    name: '@tas/web',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
