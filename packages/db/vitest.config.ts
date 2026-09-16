import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@tas/db',
    include: ['src/**/*.test.ts'],
    // testDb() boots PGlite and applies every migration; that takes 1-4 s idle and up to 10 s on a
    // loaded machine, past Vitest's 5000 ms default (TICKET-005 round 3).
    testTimeout: 30_000,
  },
});
