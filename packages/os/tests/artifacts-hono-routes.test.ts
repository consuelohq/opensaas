import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { publishArtifact } from '../scripts/lib/artifacts';
import {
  createGatewaySecurityConfig,
  issueAgentAppToken,
  signMachineRequest,
  type AgentAppToken,
  type GatewaySecurityConfig,
} from '../scripts/lib/security-gateway';
import { createArtifactRoutes } from '../scripts/server/routes/artifacts';
import { LOCAL_OS_ROUTE_POLICIES } from '../scripts/server/route-policies';

let home = '';
let config: GatewaySecurityConfig;
let token: AgentAppToken;
const app = createArtifactRoutes();

function signedGet(path: string, nonce: string): Request {
  const signed = signMachineRequest({
    config,
    token,
    method: 'GET',
    path,
    body: '',
    timestamp: new Date().toISOString(),
    nonce,
  });
  return new Request(`http://127.0.0.1:46321${path}`, {
    method: 'GET',
    headers: signed.headers,
  });
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'consuelo-artifacts-hono-'));
  writeFileSync(join(home, 'artifact.html'), '<!doctype html><html><body><h1>Hono Artifact</h1></body></html>');
  publishArtifact({
    home,
    target: join(home, 'artifact.html'),
    path: '/guides/hono-artifact',
    title: 'Hono Artifact',
    category: 'guides',
    template: 'guide',
    now: '2026-07-15T05:00:00.000Z',
  });
  config = createGatewaySecurityConfig({
    home,
    workspaceId: 'workspace_artifacts_hono',
    workspaceSlug: 'artifacts-hono',
    workspaceHost: 'artifacts-hono.consuelohq.com',
  });
  token = issueAgentAppToken({
    config,
    callerId: 'caller_artifacts_hono',
    appId: 'app_artifacts_hono',
    subjectId: 'subject_artifacts_hono',
    deviceId: 'device_artifacts_hono',
    connectorId: 'connector_artifacts_hono',
    connectionId: 'connection_artifacts_hono',
    scopes: ['route:/gateway/artifacts:read'],
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

describe('Hono Artifacts routes', () => {
  it('serves the public Artifacts index and published content', async () => {
    const index = await app.fetch(new Request('http://127.0.0.1:46321/artifacts'));
    expect(index.status).toBe(200);
    expect(index.headers.get('content-type')).toContain('text/html');
    await expect(index.text()).resolves.toContain('<h1>Artifacts</h1>');

    const artifact = await app.fetch(new Request(
      'http://127.0.0.1:46321/artifacts/guides/hono-artifact',
    ));
    expect(artifact.status).toBe(200);
    await expect(artifact.text()).resolves.toContain('Hono Artifact');
  });

  it('returns the signed catalog, artifact, and version history', async () => {
    const catalogResponse = await app.fetch(signedGet(
      '/gateway/artifacts',
      'artifacts-catalog-nonce',
    ));
    expect(catalogResponse.status).toBe(200);
    const catalogBody = await catalogResponse.json() as {
      artifacts: Array<{ id: string; path: string }>;
    };
    expect(catalogBody.artifacts).toHaveLength(1);
    const artifactId = catalogBody.artifacts[0]!.id;

    const artifactResponse = await app.fetch(signedGet(
      `/gateway/artifacts/${artifactId}`,
      'artifacts-detail-nonce',
    ));
    expect(artifactResponse.status).toBe(200);
    await expect(artifactResponse.json()).resolves.toMatchObject({
      artifact: { id: artifactId, path: '/guides/hono-artifact' },
    });

    const versionsResponse = await app.fetch(signedGet(
      `/gateway/artifacts/${artifactId}/versions`,
      'artifacts-versions-nonce',
    ));
    expect(versionsResponse.status).toBe(200);
    await expect(versionsResponse.json()).resolves.toMatchObject({
      artifactId,
      versions: [{ versionId: '2026-07-15T05-00-00-000Z' }],
    });
  });

  it('keeps Artifacts route trust explicit', () => {
    expect(LOCAL_OS_ROUTE_POLICIES).toEqual(expect.arrayContaining([
      { method: 'GET', path: '/artifacts', trust: 'public' },
      { method: 'GET', path: '/artifacts/*', trust: 'public' },
      { method: 'GET', path: '/gateway/artifacts', trust: 'signed' },
      { method: 'GET', path: '/gateway/artifacts/:artifactId', trust: 'signed' },
      { method: 'GET', path: '/gateway/artifacts/:artifactId/versions', trust: 'signed' },
    ]));
    expect(readFileSync(new URL('../scripts/server/app.ts', import.meta.url), 'utf8')).toContain(
      "app.route('/', createArtifactRoutes());",
    );
  });

  it('authorizes gateway reads before disclosing artifact data', async () => {
    const response = await app.fetch(new Request(
      'http://127.0.0.1:46321/gateway/artifacts',
    ));
    expect(response.status).toBe(401);
  });
});
