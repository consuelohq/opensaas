import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { materializeSites } from '../scripts/lib/sites';

let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'consuelo-launcher-customization-'));
  mkdirSync(join(home, 'node', 'db'), { recursive: true });
  writeFileSync(join(home, 'config.json'), JSON.stringify({
    workspace: { host: 'internal.consuelohq.com' },
    agents: [],
  }));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe('launcher local customization', () => {
  it('materializes extra sections from the durable global YAML overlay', () => {
    writeFileSync(
      join(home, 'consuelo.yaml'),
      [
        'version: 1',
        'launcher:',
        '  extraSections:',
        '    - id: internal',
        '      label: Internal',
        '      links:',
        '        - label: Users & installs',
        '          href: https://internal.consuelohq.com/users',
        '',
      ].join('\n'),
      { mode: 0o600 },
    );

    materializeSites({
      home,
      dbPath: join(home, 'node', 'db', 'consuelo.db'),
      dryRun: false,
    });

    const html = readFileSync(join(home, 'sites', 'index.html'), 'utf8');
    expect(html).toContain('<h2 class="section-title">Internal</h2>');
    expect(html).toContain('href="https://internal.consuelohq.com/users"');
    expect(html).toContain('Users &amp; installs');
  });

  it('keeps the stock launcher unchanged when no overlay exists', () => {
    writeFileSync(
      join(home, 'consuelo.yaml'),
      [
        'version: 1',
        'updates:',
        '  channel: stable',
        '  notifications:',
        '    mode: on',
        '',
      ].join('\n'),
      { mode: 0o600 },
    );

    materializeSites({
      home,
      dbPath: join(home, 'node', 'db', 'consuelo.db'),
      dryRun: false,
    });

    const html = readFileSync(join(home, 'sites', 'index.html'), 'utf8');
    expect(html).toContain('<h2 class="section-title">Sites</h2>');
    expect(html).toContain('<h2 class="section-title">Guides and Tips</h2>');
    expect(html).not.toContain('<h2 class="section-title">Internal</h2>');
    expect(html).not.toContain('https://internal.consuelohq.com/users');
  });
});
