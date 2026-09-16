import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@tas/db',
    include: ['src/**/*.test.ts'],
  },
});
