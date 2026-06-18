import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('bun:sqlite', () => ({
  Database: class MockDatabase {
    query() { return { get: () => null, all: () => [] }; }
    close() {}
  },
}));

const forbiddenBrowserLeakPattern = /127\.0\.0\.1|localhost|sqlite|\.db|tunnelOriginUrl|connectorUrl|implementationPath|backendTarget|local-agent|local agent|raw-trace-service|trace-store-file/i;

describe('Trace cockpit Sites shell', () => {
  it('materializes the approved cockpit shell at /traces instead of the reserved placeholder', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-trace-cockpit-'));
    const dbPath = join(home, 'consuelo.db');

    const { materializeSites } = await import('../scripts/lib/sites');

    const result = materializeSites({ home, dbPath, dryRun: false });
    const html = readFileSync(join(home, 'sites', 'traces', 'index.html'), 'utf8');

    expect(result.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: join(home, 'sites', 'traces', 'index.html') }),
    ]));
    expect(html).toContain('Trace Burn Intelligence');
    expect(html).toContain('EXECUTIVE COCKPIT / TOP SCREEN');
    expect(html).toContain('Workspace healthy');
    expect(html).toContain('Live traces');
    expect(html).toContain('Total Trace Burn');
    expect(html).toContain('Token Burn by Hour');
    expect(html).toContain('Inspect next');
    expect(html).toContain('Top workspace burn');
    expect(html).toContain('Search traces');
    expect(html).toContain('/gateway/traces/recent');
    expect(html).toContain('/gateway/traces/summary');
    expect(html).toContain('/gateway/traces/events');
    expect(html).toContain('data-trace-cockpit-root');
    expect(html).toContain('data-trace-heatmap');
    expect(html).toContain('data-trace-table');
    expect(html).not.toContain('Reserved Sites page');
    expect(html).not.toContain('This local page slot is reserved');
    expect(html).not.toMatch(forbiddenBrowserLeakPattern);
  });
});
