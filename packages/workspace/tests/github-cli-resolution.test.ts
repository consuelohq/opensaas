import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const helperModules = [
  '../scripts/lib/github.js',
  '../../os/scripts/lib/github.js',
] as const;

describe.each(helperModules)('%s external GitHub CLI resolution', (helperModule) => {
  it('skips the Consuelo gh tool wrapper when a real GitHub CLI follows it on PATH', () => {
    const root = mkdtempSync(join(tmpdir(), 'consuelo-gh-resolution-'));
    const consueloHome = join(root, '.consuelo');
    const consueloBin = join(consueloHome, 'bin');
    const externalBin = join(root, 'external-bin');
    mkdirSync(consueloBin, { recursive: true });
    mkdirSync(externalBin, { recursive: true });

    const consueloGh = join(consueloBin, 'gh');
    const externalGh = join(externalBin, 'gh');
    writeFileSync(consueloGh, '#!/usr/bin/env bash\necho consuelo-wrapper\n');
    writeFileSync(externalGh, '#!/usr/bin/env bash\necho external-gh\n');
    chmodSync(consueloGh, 0o755);
    chmodSync(externalGh, 0o755);

    const { resolveGitHubCli } = require(helperModule) as {
      resolveGitHubCli: (env: NodeJS.ProcessEnv) => string;
    };

    expect(resolveGitHubCli({
      CONSUELO_HOME: consueloHome,
      PATH: `${consueloBin}:${externalBin}`,
    })).toBe(externalGh);
  });
});
