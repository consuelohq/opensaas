import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { LifecycleMigrationRunner } from './types';

export const noOpLifecycleMigrationRunner: LifecycleMigrationRunner = {
  async run(input) {
    for (const migration of input.manifest.migrations) {
      if (!migration.path) continue;
      const migrationPath = resolve(input.releasePath, migration.path);
      if (!migrationPath.startsWith(`${resolve(input.releasePath)}/`) || !existsSync(migrationPath)) {
        throw new Error(`runtime migration is missing or escapes the release: ${migration.id}`);
      }
    }
  },
};
