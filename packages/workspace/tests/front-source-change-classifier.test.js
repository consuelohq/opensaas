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

const osWorkspacePackage = {
  ...basePackage,
  workspaces: {
    packages: [
      ...basePackage.workspaces.packages,
      'packages/os',
    ],
  },
};

const exclusiveRegistry = {
  rules: [
    {
      id: 'dialer-cli-install-copy',
      exclusive: true,
      source: [
        'packages/twenty-front/src/modules/navigation/constants/navigation-drawer-support-menu.constants.ts',
      ],
      exclude: [],
    },
  ],
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

  it('should skip broad frontend gates for an isolated OS workspace migration with an exclusively owned frontend copy contract', () => {
    expect(
      classifyFrontSourceChange({
        changedFiles: [
          'package.json',
          'yarn.lock',
          'packages/os/package.json',
          'packages/os/tests/cli-product-split.test.ts',
          'packages/twenty-front/src/modules/navigation/constants/navigation-drawer-support-menu.constants.ts',
        ],
        basePackage,
        headPackage: osWorkspacePackage,
        registry: exclusiveRegistry,
      }),
    ).toEqual({
      sourceChanged: false,
      reason: 'isolated-workspace-migration',
    });
  });
});
