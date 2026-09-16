import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@tas/domain',
    include: ['src/**/*.test.ts'],
  },
});
