import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  deleteEnvironmentEffect,
  environmentRegistryPath,
  listEnvironmentSnapshotEffect,
  upsertEnvironmentEffect,
} from '../scripts/lib/environment-control-plane';

const actor = {
  actorType: 'user' as const,
  actorId: 'usr_environment',
  workspaceId: 'wrk_environment',
  correlationId: 'corr_environment',
};

describe('environment control plane', () => {
  it('persists workspace-scoped non-sensitive environment records and redacted audit events', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-environment-control-plane-'));

    const created = await Effect.runPromise(upsertEnvironmentEffect({
      home,
      workspaceId: 'wrk_environment',
      actor,
      input: {
        name: 'Production',
        label: 'Customer-facing production',
        labels: ['production', 'customer'],
        scope: { kind: 'nodes', nodeIds: ['node_primary'] },
        status: 'active',
        metadata: { REGION: 'iad1', LOG_LEVEL: 'info', ENABLE_CACHE: true },
      },
    }));

    expect(created.environment).toMatchObject({
      workspaceId: 'wrk_environment',
      name: 'Production',
      slug: 'production',
      status: 'active',
      scope: { kind: 'nodes', nodeIds: ['node_primary'] },
      metadata: { REGION: 'iad1', LOG_LEVEL: 'info', ENABLE_CACHE: true },
    });
    expect(created.environment.environmentId).toMatch(/^env_/);

    const persistedPath = environmentRegistryPath(home);
    expect(fs.statSync(persistedPath).mode & 0o777).toBe(0o600);
    const persisted = fs.readFileSync(persistedPath, 'utf8');
    expect(persisted).toContain('REGION');
    expect(persisted).not.toContain('corr_environment');

    const snapshot = await Effect.runPromise(listEnvironmentSnapshotEffect({
      home,
      workspaceId: 'wrk_environment',
    }));
    expect(snapshot.environments).toHaveLength(1);
    expect(snapshot.environments[0]).toEqual(created.environment);

    const audit = fs.readFileSync(path.join(home, 'logs', 'control-plane-audit.jsonl'), 'utf8');
    expect(audit).toContain('environment.created');
    expect(audit).toContain(created.environment.environmentId);
    expect(audit).toContain('REGION');
    expect(audit).not.toContain('iad1');
    expect(audit).not.toMatch(/authorization|requestBody|secretValue|credentialValue/i);
  });

  it('updates and deletes records without crossing workspace boundaries', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-environment-control-plane-'));
    const created = await Effect.runPromise(upsertEnvironmentEffect({
      home,
      workspaceId: 'wrk_environment',
      actor,
      input: { name: 'Preview', scope: { kind: 'workspace' }, metadata: { REGION: 'dev' } },
    }));

    const updated = await Effect.runPromise(upsertEnvironmentEffect({
      home,
      workspaceId: 'wrk_environment',
      actor: { ...actor, correlationId: 'corr_update' },
      input: {
        environmentId: created.environment.environmentId,
        name: 'Preview',
        label: 'Shared preview',
        status: 'inactive',
        scope: { kind: 'workspace' },
        metadata: { REGION: 'preview' },
      },
    }));
    expect(updated.created).toBe(false);
    expect(updated.environment).toMatchObject({ status: 'inactive', label: 'Shared preview' });

    const mismatch = await Effect.runPromise(Effect.either(listEnvironmentSnapshotEffect({
      home,
      workspaceId: 'wrk_other',
    })));
    expect(mismatch).toMatchObject({ _tag: 'Left', left: { code: 'WorkspaceMismatch' } });

    const deleted = await Effect.runPromise(deleteEnvironmentEffect({
      home,
      workspaceId: 'wrk_environment',
      actor: { ...actor, correlationId: 'corr_delete' },
      environmentId: created.environment.environmentId,
    }));
    expect(deleted.deletedEnvironmentId).toBe(created.environment.environmentId);
    expect(deleted.snapshot.environments).toEqual([]);
  });

  it('rejects credential-shaped metadata before persistence', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-environment-control-plane-'));
    const tokenLikeValue = ['sk', 'live', 'abcdefghijklmnopqrstuvwxyz'].join('_');

    const secretKey = await Effect.runPromise(Effect.either(upsertEnvironmentEffect({
      home,
      workspaceId: 'wrk_environment',
      actor,
      input: {
        name: 'Unsafe',
        scope: { kind: 'workspace' },
        metadata: { STRIPE_SECRET_KEY: 'not-allowed' },
      },
    })));
    expect(secretKey).toMatchObject({ _tag: 'Left', left: { code: 'SensitiveDataRejected' } });

    const secretValue = await Effect.runPromise(Effect.either(upsertEnvironmentEffect({
      home,
      workspaceId: 'wrk_environment',
      actor,
      input: {
        name: 'Unsafe',
        scope: { kind: 'workspace' },
        metadata: { PROVIDER_ID: tokenLikeValue },
      },
    })));
    expect(secretValue).toMatchObject({ _tag: 'Left', left: { code: 'SensitiveDataRejected' } });
    expect(fs.existsSync(environmentRegistryPath(home))).toBe(false);
  });

  it('serializes concurrent writes without dropping environment records', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-environment-control-plane-'));
    await Promise.all([
      Effect.runPromise(upsertEnvironmentEffect({
        home,
        workspaceId: 'wrk_environment',
        actor: { ...actor, correlationId: 'corr_preview' },
        input: { name: 'Preview', scope: { kind: 'workspace' }, metadata: { REGION: 'preview' } },
      })),
      Effect.runPromise(upsertEnvironmentEffect({
        home,
        workspaceId: 'wrk_environment',
        actor: { ...actor, correlationId: 'corr_production' },
        input: { name: 'Production', scope: { kind: 'workspace' }, metadata: { REGION: 'production' } },
      })),
    ]);

    const snapshot = await Effect.runPromise(listEnvironmentSnapshotEffect({
      home,
      workspaceId: 'wrk_environment',
    }));
    expect(snapshot.environments.map((environment) => environment.name)).toEqual(['Preview', 'Production']);
  });

  it('refuses to hydrate a tampered registry containing secret material', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-environment-control-plane-'));
    const registryPath = environmentRegistryPath(home);
    const tamperedSecret = ['sk', 'live', 'tampered-secret-material'].join('_');
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    fs.writeFileSync(registryPath, JSON.stringify({
      version: 1,
      workspaceId: 'wrk_environment',
      environments: [{
        environmentId: 'env_tampered',
        workspaceId: 'wrk_environment',
        name: 'Production',
        slug: 'production',
        labels: [],
        scope: { kind: 'workspace' },
        status: 'active',
        metadata: { PROVIDER_ID: tamperedSecret },
        createdAt: '2026-07-18T00:00:00.000Z',
        updatedAt: '2026-07-18T00:00:00.000Z',
      }],
    }));

    const result = await Effect.runPromise(Effect.either(listEnvironmentSnapshotEffect({
      home,
      workspaceId: 'wrk_environment',
    })));
    expect(result).toMatchObject({
      _tag: 'Left',
      left: { code: 'SensitiveDataRejected' },
    });
    expect(JSON.stringify(result)).not.toContain(tamperedSecret);
  });
});
