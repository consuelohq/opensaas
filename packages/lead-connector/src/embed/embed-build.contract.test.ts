import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'bun:test';

const packageRoot = join(import.meta.dir, '..', '..');
const outputRoot = join(packageRoot, 'dist', 'embed-app');

const digestPrefix = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16);

describe('LeadConnector embed build', () => {
  it('content-versions every application asset reference with its exact digest', () => {
    const build = Bun.spawnSync({
      cmd: ['bun', join(packageRoot, 'scripts', 'build-embed.ts')],
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(build.exitCode).toBe(0);
    expect(readFileSync(join(outputRoot, 'consuelo-logo.svg'))).toEqual(
      readFileSync(
        join(packageRoot, '..', 'consuelo-website', 'public', 'logo.svg'),
      ),
    );
    for (const font of ['interface', 'wordmark']) {
      const bytes = readFileSync(join(outputRoot, 'fonts', font + '.woff2'));
      expect(bytes.subarray(0, 4).toString()).toBe('wOF2');
      expect(bytes.byteLength).toBeGreaterThan(10000);
    }
    expect(
      readFileSync(join(outputRoot, 'fonts', 'inter-LICENSE.txt'), 'utf8'),
    ).toContain('SIL OPEN FONT LICENSE');

    const html = readFileSync(join(outputRoot, 'index.html'), 'utf8');
    const cssVersion = digestPrefix(join(outputRoot, 'main.css'));
    const jsVersion = digestPrefix(join(outputRoot, 'main.js'));

    expect(html).toContain(`href="./main.css?v=${cssVersion}"`);
    expect(html).toContain(`src="./main.js?v=${jsVersion}"`);
    expect(html).not.toContain('href="./main.css"');
    expect(html).not.toContain('src="./main.js"');
  });
});
