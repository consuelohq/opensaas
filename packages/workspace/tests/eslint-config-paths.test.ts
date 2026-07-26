import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(__dirname, '../../..');

const configPaths = [
  'eslint.config.mjs',
  'nx.json',
  'package.json',
  'packages/eslint-rules/eslint.config.react.mjs',
  'packages/eslint-rules/jest.config.mjs',
  'packages/eslint-rules/project.json',
  'packages/twenty-docker/twenty-website/Dockerfile',
  'packages/twenty-front/eslint.config.mjs',
  'packages/twenty-server/eslint.config.mjs',
  'packages/twenty-shared/eslint.config.mjs',
  'packages/twenty-ui/eslint.config.mjs',
] as const;

describe('shared React ESLint configuration paths', () => {
  it('should reference the current eslint-rules package when loading shared rules', () => {
    const sources = Object.fromEntries(
      configPaths.map((path) => [
        path,
        readFileSync(resolve(repositoryRoot, path), 'utf8'),
      ]),
    );

    for (const source of Object.values(sources)) {
      expect(source).not.toContain('packages/twenty-eslint-rules');
      expect(source).not.toContain('../twenty-eslint-rules');
    }
    expect(sources['packages/eslint-rules/eslint.config.react.mjs']).toContain(
      "loadWorkspaceRules('packages/eslint-rules')",
    );
    expect(sources['packages/twenty-front/eslint.config.mjs']).toContain(
      "from '../eslint-rules/eslint.config.react.mjs'",
    );
    expect(sources['packages/twenty-ui/eslint.config.mjs']).toContain(
      "from '../eslint-rules/eslint.config.react.mjs'",
    );
  });

  it('should import both React consumer configurations from a clean checkout', () => {
    for (const path of [
      'eslint.config.mjs',
      'packages/twenty-front/eslint.config.mjs',
      'packages/twenty-server/eslint.config.mjs',
      'packages/twenty-shared/eslint.config.mjs',
      'packages/twenty-ui/eslint.config.mjs',
    ]) {
      const url = pathToFileURL(resolve(repositoryRoot, path)).href;
      const result = spawnSync(
        'node',
        [
          '--input-type=module',
          '--eval',
          `const loaded = await import(${JSON.stringify(url)}); if (!Array.isArray(loaded.default)) process.exit(2);`,
        ],
        { encoding: 'utf8' },
      );

      expect(result.status, `${path}\n${result.stderr}`).toBe(0);
    }
  }, 20_000);
});
