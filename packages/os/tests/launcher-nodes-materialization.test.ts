import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runSitesCommand } from '../scripts/os';

const homes: string[] = [];

afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

describe('workspace root Nodes materialization', () => {
  it('materializes a first-class Nodes snapshot while retaining the legacy Environment artifact', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-nodes-site-'));
    homes.push(home);
    const result = await runSitesCommand(['refresh', '--json'], { home, openUrl: false });

    expect(result.nodesIndexPath).toBe(join(home, 'sites', 'nodes', 'index.html'));
    expect(result.nodesIndexExists).toBe(true);
    expect(existsSync(result.environmentsIndexPath)).toBe(true);

    const rootHtml = readFileSync(result.indexPath, 'utf8');
    expect(rootHtml).toContain('<title>Nodes - Consuelo OS</title>');
    expect(rootHtml).toContain('data-workspace-shell');
    expect(rootHtml).toContain('data-workspace-route-trigger');
    expect(rootHtml).toContain('/gateway/nodes/snapshot');
    expect(rootHtml).not.toContain('Welcome to Consuelo OS');

    const nodesHtml = readFileSync(result.nodesIndexPath, 'utf8');
    expect(nodesHtml).toContain('<h1>Nodes</h1>');
    expect(nodesHtml).toContain('Create cloud node');
    expect(nodesHtml).toContain('/gateway/nodes/snapshot');
    expect(nodesHtml).not.toMatch(/e2-(?:medium|standard)/);
  });
  it('keeps daemon refresh wired to the Nodes root renderer instead of the retired launcher', () => {
    const osRoot = resolve(import.meta.dirname, '..');
    const daemon = readFileSync(resolve(osRoot, 'scripts', 'start-consuelo-daemon.sh'), 'utf8');
    const sites = readFileSync(resolve(osRoot, 'scripts', 'lib', 'sites.ts'), 'utf8');

    expect(daemon).toContain('sites refresh --json');
    expect(sites).toContain("return renderConfigurationSite('nodes');");
    expect(sites).not.toContain('renderLauncherOnboarding');
    expect(sites).not.toContain('Welcome to Consuelo OS');
  });

});
