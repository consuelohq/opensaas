import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    setupFiles: ['./tests/test-environment.ts'],
  },
  resolve: {
    alias: {
      'bun:test': 'vitest',
      'bun:sqlite': fileURLToPath(new URL('./tests/helpers/bun-sqlite-vitest.ts', import.meta.url)),
    },
  },
});
