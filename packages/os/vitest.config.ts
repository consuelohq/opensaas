import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const bunSqliteAlias = 'bun' in process.versions
  ? {}
  : {
      'bun:sqlite': fileURLToPath(
        new URL('./tests/helpers/bun-sqlite-vitest.ts', import.meta.url),
      ),
    };

export default defineConfig({
  test: {
    setupFiles: ['./tests/test-environment.ts'],
  },
  resolve: {
    alias: {
      'bun:test': 'vitest',
      ...bunSqliteAlias,
    },
  },
});
