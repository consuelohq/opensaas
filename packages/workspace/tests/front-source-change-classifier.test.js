import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { classifyFrontSourceChange } = require(
  '../scripts/ci/classify-front-source-change.cjs',
);

const basePackage = {
  private: true,
  dependencies: { react: '^18.2.0' },
  workspaces: { packages: ['packages/twenty-eslint-rules', 'packages/twenty-front'] },
};

const migratedPackage = {
  ...basePackage,
  workspaces: { packages: ['packages/eslint-rules', 'packages/twenty-front'] },
};

describe('frontend source change classifier', () => {
  it('should treat the ESLint workspace directory migration as configuration infrastructure', () => {
    expect(
      classifyFrontSourceChange({
        changedFiles: ['package.json', 'packages/twenty-front/eslint.config.mjs'],
        basePackage,
        headPackage: migratedPackage,
      }),
    ).toEqual({ sourceChanged: false, reason: 'eslint-workspace-migration' });
  });

  it('should require full frontend gates for dependency or lockfile changes', () => {
    expect(
      classifyFrontSourceChange({
        changedFiles: ['package.json'],
        basePackage,
        headPackage: {
          ...migratedPackage,
          dependencies: { react: '^19.0.0' },
        },
      }).sourceChanged,
    ).toBe(true);
    expect(
      classifyFrontSourceChange({ changedFiles: ['yarn.lock'] }).sourceChanged,
    ).toBe(true);
  });

  it('should require full frontend gates for source changes but not ESLint config files', () => {
    expect(
      classifyFrontSourceChange({
        changedFiles: ['packages/twenty-front/src/App.tsx'],
      }).sourceChanged,
    ).toBe(true);
    expect(
      classifyFrontSourceChange({
        changedFiles: [
          'packages/twenty-front/eslint.config.mjs',
          'packages/twenty-ui/eslint.config.mjs',
        ],
      }),
    ).toEqual({ sourceChanged: false, reason: 'configuration-only' });
  });
});
