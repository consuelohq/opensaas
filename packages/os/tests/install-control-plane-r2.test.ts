import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { InstallControlPlaneRepository } from '../scripts/lib/install-control-plane';
import { createMemoryInstallControlPlaneRepository } from '../scripts/lib/install-control-plane';
import {
  createInstallDiagnosticBundleStore,
  type InstallDiagnosticR2Bucket,
} from '../scripts/lib/install-control-plane-r2';
import type { InstallTelemetryEvent } from '../scripts/lib/install-telemetry-contract';

const INSTALL_ID = 'ins_11111111-1111-4111-8111-111111111111' as const;
const EVENT_ID = 'evt_11111111-1111-4111-8111-111111111111' as const;

async function seededRepository(): Promise<InstallControlPlaneRepository> {
  const repository = createMemoryInstallControlPlaneRepository();
  const event: InstallTelemetryEvent = {
    schemaVersion: 1,
    eventId: EVENT_ID,
    installId: INSTALL_ID,
    producer: 'installer',
    name: 'install.started',
    stage: 'bootstrap',
    outcome: 'started',
    occurredAt: '2026-08-13T16:00:00.000Z',
    sequence: 1,
    identity: { state: 'anonymous' },
  };
  await repository.ingestEvent(event, {
    trust: 'installer',
    ingestedAt: '2026-08-13T16:00:01.000Z',
  });
  return repository;
}

function fakeBucket() {
  const puts: Array<{ key: string; body: string; options?: unknown }> = [];
  const deletes: string[] = [];
  const bucket: InstallDiagnosticR2Bucket = {
    async put(key, body, options) {
      puts.push({ key, body: typeof body === 'string' ? body : new TextDecoder().decode(body), options });
    },
    async delete(key) {
      deletes.push(key);
    },
  };
  return { bucket, puts, deletes };
}

describe('R2 diagnostic bundle storage', () => {
  it('server-redacts failed diagnostics, stores only the R2 object key in the private repository, and applies 30-day retention', async () => {
    const repository = await seededRepository();
    const { bucket, puts } = fakeBucket();
    const store = createInstallDiagnosticBundleStore({
      bucket,
      repository,
      now: () => Date.parse('2026-08-13T17:00:00.000Z'),
      randomUuid: () => '11111111-1111-4111-8111-111111111111',
    });

    const result = await store.put({
      installId: INSTALL_ID,
      outcome: 'failed',
      diagnostic: {
        home: '/Users/private-person',
        authorization: 'Bearer osat_super-secret-token',
        nested: { cloudflare_tunnel_token: 'cloudflared_tunnel_token_secret' },
        message: 'failed while reading /Users/private-person/.consuelo/config.json',
      },
    });

    expect(result).toMatchObject({ stored: true, bundleId: 'diag_11111111-1111-4111-8111-111111111111' });
    expect(puts).toHaveLength(1);
    expect(puts[0]?.key).toContain(`install-diagnostics/failed/${INSTALL_ID}/`);
    expect(puts[0]?.body).not.toContain('private-person');
    expect(puts[0]?.body).not.toContain('super-secret-token');
    expect(puts[0]?.body).not.toContain('cloudflared_tunnel_token_secret');
    expect(puts[0]?.body).toContain('[redacted]');

    const detail = await repository.getInstallDetail(INSTALL_ID, {
      nowMs: Date.parse('2026-08-13T17:01:00.000Z'),
    });
    expect(detail?.diagnosticBundle).toEqual({
      available: true,
      bundleId: 'diag_11111111-1111-4111-8111-111111111111',
      outcome: 'failed',
      createdAt: '2026-08-13T17:00:00.000Z',
      expiresAt: '2026-09-12T17:00:00.000Z',
    });
    expect(JSON.stringify(detail)).not.toContain('install-diagnostics/');
  });

  it('does not retain successful diagnostics by default and enforces the contract maximum when opt-in is configured', async () => {
    const repository = await seededRepository();
    const { bucket, puts } = fakeBucket();
    const store = createInstallDiagnosticBundleStore({ bucket, repository });

    await expect(
      store.put({ installId: INSTALL_ID, outcome: 'successful', diagnostic: { ok: true } }),
    ).resolves.toEqual({ stored: false, reason: 'successful_retention_disabled' });
    expect(puts).toHaveLength(0);

    expect(() =>
      createInstallDiagnosticBundleStore({
        bucket,
        repository,
        successfulRetentionDays: 8,
      }),
    ).toThrow(/7 days/i);
  });

  it('ships bucket lifecycle rules that physically delete failed bundles by 30 days and successful bundles by 7 days', () => {
    const lifecycle = JSON.parse(
      readFileSync(
        new URL('../cloudflare/os-device-authority/install-diagnostics-r2-lifecycle.json', import.meta.url),
        'utf8',
      ),
    ) as {
      rules: Array<{
        id: string;
        enabled: boolean;
        conditions: { prefix: string };
        deleteObjectsTransition: { condition: { type: string; maxAge: number } };
      }>;
    };
    expect(lifecycle.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          enabled: true,
          conditions: { prefix: 'install-diagnostics/failed/' },
          deleteObjectsTransition: {
            condition: { type: 'Age', maxAge: 30 * 24 * 60 * 60 },
          },
        }),
        expect.objectContaining({
          enabled: true,
          conditions: { prefix: 'install-diagnostics/successful/' },
          deleteObjectsTransition: {
            condition: { type: 'Age', maxAge: 7 * 24 * 60 * 60 },
          },
        }),
      ]),
    );
  });

  it('deletes the uploaded R2 object if canonical metadata persistence fails', async () => {
    const repository = await seededRepository();
    const failingRepository: InstallControlPlaneRepository = {
      ...repository,
      async recordDiagnosticBundle() {
        throw new Error('d1 unavailable');
      },
    };
    const { bucket, puts, deletes } = fakeBucket();
    const store = createInstallDiagnosticBundleStore({
      bucket,
      repository: failingRepository,
      randomUuid: () => '11111111-1111-4111-8111-111111111111',
    });

    await expect(
      store.put({ installId: INSTALL_ID, outcome: 'failed', diagnostic: { message: 'boom' } }),
    ).rejects.toThrow(/d1 unavailable/i);
    expect(puts).toHaveLength(1);
    expect(deletes).toEqual([puts[0]?.key]);
  });
});
