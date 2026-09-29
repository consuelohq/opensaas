import { describe, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const readSource = (relativePath) =>
  readFileSync(join(packageRoot, relativePath), 'utf8');

describe('homepage platform-aware installer source', () => {
  test('selects the client platform and copies the displayed command', () => {
    const hero = readSource('src/components/home/HomeHero.astro');
    const content = readSource('src/data/home-content.ts');

    expect(content).toContain("import { POSIX_INSTALL_COMMAND } from '../lib/install-command'");
    expect(content).toContain('export const INSTALL_COMMAND = POSIX_INSTALL_COMMAND;');
    expect(hero).toContain("import { installCommandForPlatform } from '../../lib/install-command'");
    expect(hero).toContain('data-install-command');
    expect(hero).toContain('installCommandForPlatform(navigator.platform || navigator.userAgent)');
    expect(hero).toContain('await navigator.clipboard.writeText(command)');
  });
});
