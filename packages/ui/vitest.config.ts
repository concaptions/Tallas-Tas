import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@tas/ui',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
