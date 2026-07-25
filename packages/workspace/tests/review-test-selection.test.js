import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  isLintConfigurationFile,
  reviewTaskEntrypoint,
  reviewTestPackages,
} = require('../scripts/lib/review-test-selection');

describe('review test package selection', () => {
  it('should exclude lint configuration files from broad package tests', () => {
    const existingJestConfigs = new Set([
      path.join('/repo', 'packages', 'twenty-front', 'jest.config.mjs'),
      path.join('/repo', 'packages', 'twenty-server', 'jest.config.mjs'),
      path.join('/repo', 'packages', 'twenty-ui', 'jest.config.mjs'),
    ]);

    const packages = reviewTestPackages(
      [
        'packages/twenty-front/eslint.config.mjs',
        'packages/twenty-server/eslint.config.mjs',
        'packages/twenty-ui/eslint.config.mjs',
      ],
      '/repo',
      (file) => existingJestConfigs.has(file),
    );

    expect(packages).toEqual([]);
  });

  it('should retain package tests for changed source and rule files', () => {
    const existingJestConfigs = new Set([
      path.join('/repo', 'packages', 'twenty-front', 'jest.config.mjs'),
      path.join('/repo', 'packages', 'eslint-rules', 'jest.config.mjs'),
    ]);

    const packages = reviewTestPackages(
      [
        'packages/twenty-front/src/example.tsx',
        'packages/eslint-rules/rules/example.ts',
      ],
      '/repo',
      (file) => existingJestConfigs.has(file),
    );

    expect(packages).toEqual(['twenty-front', 'eslint-rules']);
    expect(isLintConfigurationFile('packages/twenty-front/eslint.config.mjs')).toBe(true);
    expect(isLintConfigurationFile('packages/twenty-front/src/example.tsx')).toBe(false);
  });

  it('should execute the review implementation from the selected task worktree', () => {
    expect(reviewTaskEntrypoint('/tmp/task-worktree')).toBe(
      path.join('/tmp/task-worktree', 'packages', 'workspace', 'scripts', 'review.js'),
    );
  });
});
