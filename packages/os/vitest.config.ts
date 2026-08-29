import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/test-environment.ts'],
  },
  resolve: {
    alias: {
      'bun:test': 'vitest',
    },
  },
});
