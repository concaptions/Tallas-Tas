import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@tas/env',
    include: ['src/**/*.test.ts'],
  },
});
