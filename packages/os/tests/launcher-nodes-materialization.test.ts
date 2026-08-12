import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runSitesCommand } from '../scripts/os';

const homes: string[] = [];

afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

describe('Nodes launcher materialization', () => {
  it('materializes a first-class Nodes snapshot while retaining the legacy Environment artifact', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-nodes-site-'));
    homes.push(home);
    const result = await runSitesCommand(['refresh', '--json'], { home, openUrl: false });

    expect(result.nodesIndexPath).toBe(join(home, 'sites', 'nodes', 'index.html'));
    expect(result.nodesIndexExists).toBe(true);
    expect(existsSync(result.environmentsIndexPath)).toBe(true);

    const nodesHtml = readFileSync(result.nodesIndexPath, 'utf8');
    expect(nodesHtml).toContain('<h1>Nodes</h1>');
    expect(nodesHtml).toContain('Create cloud node');
    expect(nodesHtml).toContain('/gateway/nodes/snapshot');
    expect(nodesHtml).not.toMatch(/e2-(?:medium|standard)/);
  });
});
