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
    workspace: { host: 'one.consuelohq.com' },
    agents: [],
  }));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe('workspace chrome launcher customization', () => {
  it('migrates launcher extra sections into the current workspace route menu on every shared Site', () => {
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

    for (const relativePath of [
      'sites/index.html',
      'sites/configuration/index.html',
      'sites/tools/index.html',
      'sites/traces/index.html',
    ]) {
      const html = readFileSync(join(home, relativePath), 'utf8');
      expect(html).toContain('data-workspace-route-trigger');
      expect(html).toContain('data-custom-route-group="internal"');
      expect(html).toContain('>Internal</p>');
      expect(html).toContain('>Users &amp; installs</span>');
      expect(html).toContain('/auth/handoff/start?target_host=internal.consuelohq.com&amp;return_to=%2Fusers');
      expect(html).not.toContain('<h2 class="section-title">Internal</h2>');
      expect(html).not.toContain('href="https://internal.consuelohq.com/users"');
    }

    const root = readFileSync(join(home, 'sites', 'index.html'), 'utf8');
    expect(root).toContain('<title>Overview - Consuelo OS</title>');
    expect(root).toContain('data-workspace-shell');
    expect(root).toContain('<h1>Overview</h1>');
  });

  it('keeps the stock workspace menu unchanged when no launcher overlay exists', () => {
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
    expect(html).toContain('<title>Overview - Consuelo OS</title>');
    expect(html).toContain('data-workspace-route-trigger');
    expect(html).not.toContain('Welcome to Consuelo OS');
    expect(html).not.toContain('data-custom-route-group=');
    expect(html).not.toContain('internal.consuelohq.com/users');
  });
});
