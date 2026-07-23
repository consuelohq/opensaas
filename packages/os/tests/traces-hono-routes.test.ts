import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createGatewaySecurityConfig,
  issueAgentAppToken,
  signMachineRequest,
  type AgentAppToken,
  type GatewaySecurityConfig,
} from '../scripts/lib/security-gateway';
import { traceGatewayScopeFromHeaders } from '../scripts/lib/trace-sites-gateway-live-endpoints';
import { LOCAL_OS_ROUTE_POLICIES } from '../scripts/server/route-policies';
import { createTraceRoutes } from '../scripts/server/routes/traces';

let home = '';
let config: GatewaySecurityConfig;
let token: AgentAppToken;

function signedGet(
  path: string,
  nonce: string,
  extraHeaders: Record<string, string> = {},
): Request {
  const pathname = new URL(path, 'http://127.0.0.1:46321').pathname;
  const signed = signMachineRequest({
    config,
    token,
    method: 'GET',
    path: pathname,
    body: '',
    timestamp: new Date().toISOString(),
    nonce,
  });
  return new Request(`http://127.0.0.1:46321${path}`, {
    method: 'GET',
    headers: {
      ...signed.headers,
      'x-consuelo-node-id': 'node_trace_home',
      ...extraHeaders,
    },
  });
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'consuelo-traces-hono-'));
  config = createGatewaySecurityConfig({
    home,
    workspaceId: 'workspace_traces_hono',
    workspaceSlug: 'traces-hono',
    workspaceHost: 'traces-hono.consuelohq.com',
  });
  token = issueAgentAppToken({
    config,
    callerId: 'caller_traces_hono',
    appId: 'app_traces_hono',
    subjectId: 'subject_traces_hono',
    deviceId: 'node_trace_home',
    connectorId: 'connector_traces_hono',
    connectionId: 'connection_traces_hono',
    scopes: ['route:/gateway/traces:read'],
    expiresInSeconds: 300,
  });
  process.env.CONSUELO_HOME = home;
  process.env.CONSUELO_OS_HOME = home;
  process.env.CONSUELO_OS_AUTH_CONFIG = config.generatedAuthPath;
});

afterEach(() => {
  delete process.env.CONSUELO_HOME;
  delete process.env.CONSUELO_OS_HOME;
  delete process.env.CONSUELO_OS_AUTH_CONFIG;
  if (home) rmSync(home, { recursive: true, force: true });
  home = '';
});

describe('Hono trace surface', () => {
  it('serves the authenticated trace document and invariant assets from Hono', async () => {
    const app = createTraceRoutes();

    const unsigned = await app.fetch(
      new Request('http://127.0.0.1:46321/traces'),
    );
    expect(unsigned.status).toBe(401);
    expect(unsigned.headers.get('cache-control')).toBe('private, no-store');
    expect(unsigned.headers.get('vary')).toContain('x-consuelo-node-id');

    const document = await app.fetch(
      signedGet('/traces', 'trace-document-nonce'),
    );
    expect(document.status).toBe(200);
    expect(document.headers.get('content-type')).toContain('text/html');
    expect(document.headers.get('cache-control')).toBe('private, no-store');
    expect(document.headers.get('vary')).toContain('x-consuelo-workspace-id');
    expect(document.headers.get('vary')).toContain('x-consuelo-node-id');
    const html = await document.text();
    expect(html).toContain('data-workspace-id="workspace_traces_hono"');
    expect(html).toContain('data-node-id="node_trace_home"');
    expect(html).toContain('/traces/assets/trace.css');
    expect(html).toContain('/traces/assets/trace.js');
    expect(html).toContain('data-trace-table');
    expect(html).toContain('data-trace-inspector');
    expect(html).toContain('data-trace-state="loading"');
    expect(html).toContain('data-action="refresh"');
    expect(html).not.toContain(token.secret);

    const css = await app.fetch(
      signedGet('/traces/assets/trace.css', 'trace-css-nonce'),
    );
    expect(css.status).toBe(200);
    expect(css.headers.get('content-type')).toContain('text/css');
    expect(css.headers.get('cache-control')).toContain('immutable');
    expect(await css.text()).toContain('.trace-inspector');

    const javascript = await app.fetch(
      signedGet('/traces/assets/trace.js', 'trace-js-nonce'),
    );
    expect(javascript.status).toBe(200);
    expect(javascript.headers.get('content-type')).toContain('javascript');
    const source = await javascript.text();
    expect(source).toContain('direction=newer');
    expect(source).toContain('includeRawPayload=true');
    expect(source).toContain('WORKSPACE_NODE_OFFLINE');
    expect(source).toContain('localStorage');
    expect(source).not.toContain('rawInputJson, rawResolvedInputJson, rawResultJson');
  });

  it('fails closed when the edge-selected node differs from the signed local node', async () => {
    const app = createTraceRoutes();
    const response = await app.fetch(
      signedGet('/gateway/traces/recent', 'trace-node-mismatch-nonce', {
        'x-consuelo-node-id': 'node_other_machine',
      }),
    );

    expect(response.status).toBe(409);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toContain('x-consuelo-node-id');
    expect(await response.json()).toMatchObject({
      ok: false,
      error: {
        code: 'WORKSPACE_NODE_MISMATCH',
      },
    });
  });

  it('derives trace scope from signed workspace and resolved node identity', () => {
    const scope = traceGatewayScopeFromHeaders(
      signedGet('/gateway/traces/recent', 'trace-scope-nonce'),
    ) as ReturnType<typeof traceGatewayScopeFromHeaders> & { nodeId: string };

    expect(scope.workspaceId).toBe('workspace_traces_hono');
    expect(scope.nodeId).toBe('node_trace_home');
  });

  it('keeps trace document, assets, and data route trust explicit', () => {
    expect(LOCAL_OS_ROUTE_POLICIES).toEqual(
      expect.arrayContaining([
        { method: 'GET', path: '/traces', trust: 'signed' },
        { method: 'GET', path: '/traces/assets/trace.css', trust: 'signed' },
        { method: 'GET', path: '/traces/assets/trace.js', trust: 'signed' },
        { method: 'GET', path: '/gateway/traces/recent', trust: 'signed' },
      ]),
    );
  });
});
