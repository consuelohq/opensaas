import { describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const packageRoot = import.meta.dir;
const repositoryRoot = resolve(packageRoot, '../..');

describe('@consuelo/coaching package contract', () => {
  test('emits the declaration artifact advertised by package.json', () => {
    const packageJson = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8'),
    ) as { types?: string };
    const tsconfig = JSON.parse(
      readFileSync(join(packageRoot, 'tsconfig.json'), 'utf8'),
    ) as { compilerOptions?: { declaration?: boolean } };

    expect(packageJson.types).toBe('dist/index.d.ts');
    expect(tsconfig.compilerOptions?.declaration).toBe(true);

    const outputDirectory = mkdtempSync(
      join(tmpdir(), 'consuelo-coaching-package-'),
    );

    try {
      const compile = spawnSync(
        'npx',
        [
          'tsc',
          '-p',
          join(packageRoot, 'tsconfig.json'),
          '--outDir',
          outputDirectory,
        ],
        {
          cwd: repositoryRoot,
          encoding: 'utf8',
        },
      );

      expect(compile.status, `${compile.stdout}\n${compile.stderr}`).toBe(0);
      expect(
        existsSync(
          join(
            outputDirectory,
            relative('dist', packageJson.types ?? 'dist/index.d.ts'),
          ),
        ),
      ).toBe(true);
    } finally {
      rmSync(outputDirectory, { recursive: true, force: true });
    }
  });
});
