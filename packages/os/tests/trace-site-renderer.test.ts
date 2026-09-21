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

  it('keeps the generated Sites trace page on the maintained observability renderer', () => {
    const sitesSource = readFileSync(
      new URL('../scripts/lib/sites.ts', import.meta.url),
      'utf8',
    );

    expect(sitesSource).toContain(
      "import { buildObservabilityTracesSite } from './observability-traces-site';",
    );
    expect(sitesSource).toContain(
      'fs.writeFileSync(paths.tracesIndexPath, buildObservabilityTracesSite(chromeOptions)',
    );
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

  it('recovers an expired workspace session instead of rendering an empty trace table', () => {
    expect(TRACE_SITE_JAVASCRIPT).toContain("response.status !== 401");
    expect(TRACE_SITE_JAVASCRIPT).toContain("payload.error !== 'workspace_session_required'");
    expect(TRACE_SITE_JAVASCRIPT).toContain("'/login/google/start'");
    expect(TRACE_SITE_JAVASCRIPT).toContain("searchParams.set('purpose', 'web')");
    expect(TRACE_SITE_JAVASCRIPT).toContain(
      'window.location.pathname + window.location.search + window.location.hash',
    );
    expect(TRACE_SITE_JAVASCRIPT).toContain('window.location.assign(loginUrl.toString())');
  });
});
