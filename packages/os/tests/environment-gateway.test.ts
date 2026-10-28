import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  applyEnvironmentGatewayDelete,
  applyEnvironmentGatewayUpsert,
  readEnvironmentGatewaySnapshot,
} from '../scripts/lib/environment-gateway';

const actor = {
  actorType: 'user' as const,
  actorId: 'usr_environment_gateway',
  workspaceId: 'wrk_environment_gateway',
  correlationId: 'corr_environment_gateway',
};

describe('environment gateway', () => {
  it('parses, persists, and returns environment snapshots', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-environment-gateway-'));
    const created = await applyEnvironmentGatewayUpsert(home, 'wrk_environment_gateway', JSON.stringify({
      name: 'Production',
      label: 'Primary',
      scope: { kind: 'workspace' },
      metadata: { REGION: 'iad1' },
    }), actor);
    expect(created).toMatchObject({ ok: true, environment: { name: 'Production' } });

    const snapshot = await readEnvironmentGatewaySnapshot(home, 'wrk_environment_gateway');
    expect(snapshot).toMatchObject({ ok: true, snapshot: { workspaceId: 'wrk_environment_gateway' } });
    if (!snapshot.ok) throw new Error('expected environment snapshot');
    expect(snapshot.snapshot.environments).toHaveLength(1);

    const deleted = await applyEnvironmentGatewayDelete(home, 'wrk_environment_gateway', JSON.stringify({
      environmentId: snapshot.snapshot.environments[0]?.environmentId,
    }), { ...actor, correlationId: 'corr_delete' });
    expect(deleted).toMatchObject({ ok: true, snapshot: { environments: [] } });
  });

  it('returns safe validation errors without echoing input', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-environment-gateway-'));
    const marker = ['sk', 'live', 'do-not-echo-this-marker'].join('_');
    const result = await applyEnvironmentGatewayUpsert(home, 'wrk_environment_gateway', JSON.stringify({
      name: 'Unsafe',
      scope: { kind: 'workspace' },
      metadata: { PROVIDER_ID: marker },
    }), actor);

    expect(result).toMatchObject({ ok: false, status: 400, error: { code: 'SENSITIVE_DATA_REJECTED' } });
    expect(JSON.stringify(result)).not.toContain(marker);
  });

  it('treats user-controlled ok fields as ordinary input instead of gateway results', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-environment-gateway-'));
    const result = await applyEnvironmentGatewayUpsert(home, 'wrk_environment_gateway', JSON.stringify({
      ok: true,
      name: 'Production',
      scope: { kind: 'workspace' },
      metadata: { REGION: 'iad1' },
    }), actor);

    expect(result).toMatchObject({
      ok: true,
      environment: { name: 'Production' },
      snapshot: { workspaceId: 'wrk_environment_gateway' },
    });
  });
});
