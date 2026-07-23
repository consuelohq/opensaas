import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  TRACE_SITE_CSS,
  TRACE_SITE_JAVASCRIPT,
  renderTraceSite,
} from '../scripts/lib/trace-site';

describe('shared trace site renderer', () => {
  it('renders Hono-owned assets without embedding workspace data in those assets', () => {
    const html = renderTraceSite({
      workspaceId: 'workspace_renderer',
      workspaceHost: 'renderer.consuelohq.com',
      nodeId: 'node_renderer',
      assetMode: 'hono',
    });

    expect(html).toContain('data-workspace-id="workspace_renderer"');
    expect(html).toContain('data-node-id="node_renderer"');
    expect(html).toContain('/traces/assets/trace.css');
    expect(html).toContain('/traces/assets/trace.js');
    expect(TRACE_SITE_CSS).not.toContain('workspace_renderer');
    expect(TRACE_SITE_JAVASCRIPT).not.toContain('node_renderer');
  });

  it('demotes the generated Sites trace page to a non-interactive canonical link', () => {
    const sitesSource = readFileSync(
      new URL('../scripts/lib/sites.ts', import.meta.url),
      'utf8',
    );

    expect(sitesSource).toContain('Open authenticated traces');
    expect(sitesSource).toContain('href="/traces"');
    expect(sitesSource).not.toContain("return renderTraceSite({ assetMode: 'inline' });");
    expect(sitesSource).not.toContain("import { renderTraceSite } from './trace-site';");
    expect(sitesSource).not.toContain("payload.events || payload.rows || payload.traces");
  });

  it('bounds live rows and stores only view state, not raw payloads', () => {
    expect(TRACE_SITE_JAVASCRIPT).toContain('const MAX_ROWS = 200');
    expect(TRACE_SITE_JAVASCRIPT).toContain('window.setInterval(pollNewer, 2500)');
    expect(TRACE_SITE_JAVASCRIPT).toContain('selectedId: view.selectedId');
    expect(TRACE_SITE_JAVASCRIPT).not.toContain('rawInputJson:');
    expect(TRACE_SITE_JAVASCRIPT).not.toContain('rawResultJson:');
  });
});
