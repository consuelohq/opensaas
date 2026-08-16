import { describe, expect, it } from 'vitest';

import { resolveCanonicalDeviceIdentity } from '../cloudflare/os-device-authority/src/services/canonical-device-identity';
import { createMemoryDeviceGrantStore } from '../cloudflare/os-device-authority/src/stores';
import { createMemoryInstallControlPlaneRepository } from '../scripts/lib/install-control-plane';

describe('canonical device identity resolution', () => {
  it('resolves a verified email to the most recently synchronized canonical workspace', async () => {
    const repository = createMemoryInstallControlPlaneRepository();
    await repository.upsertUser({
      userId: 'user_123',
      email: 'Ko@Example.com',
      workspaceIds: ['workspace_old'],
      workspaceMembershipVerifiedAt: '2026-08-10T12:00:00.000Z',
      createdAt: '2026-08-10T12:00:00.000Z',
      updatedAt: '2026-08-10T12:00:00.000Z',
    });
    await repository.upsertUser({
      userId: 'user_123',
      email: 'ko@example.com',
      workspaceIds: ['workspace_new'],
      workspaceMembershipVerifiedAt: '2026-08-13T12:00:00.000Z',
      createdAt: '2026-08-10T12:00:00.000Z',
      updatedAt: '2026-08-13T12:00:00.000Z',
    });

    await expect(
      resolveCanonicalDeviceIdentity({
        repository,
        store: createMemoryDeviceGrantStore(),
        email: ' KO@example.com ',
        googleSubject: 'google-sub-123',
        nowMs: Date.parse('2026-08-13T12:05:00.000Z'),
      }),
    ).resolves.toEqual({
      status: 'resolved',
      canonicalUserId: 'user_123',
      canonicalWorkspaceId: 'workspace_new',
      operatingAccountId: 'user_123',
    });
  });

  it('preserves an existing canonical account workspace when membership is still active', async () => {
    const repository = createMemoryInstallControlPlaneRepository();
    await repository.upsertUser({
      userId: 'user_123',
      email: 'ko@example.com',
      workspaceIds: ['workspace_new'],
      workspaceMembershipVerifiedAt: '2026-08-13T12:00:00.000Z',
      createdAt: '2026-08-10T12:00:00.000Z',
      updatedAt: '2026-08-13T12:00:00.000Z',
    });
    await repository.upsertUser({
      userId: 'user_123',
      email: 'ko@example.com',
      workspaceIds: ['workspace_old'],
      workspaceMembershipVerifiedAt: '2026-08-13T12:04:00.000Z',
      createdAt: '2026-08-10T12:00:00.000Z',
      updatedAt: '2026-08-13T12:00:00.000Z',
    });
    const store = createMemoryDeviceGrantStore();
    await store.putAccountWorkspace({
      accountId: 'user_123',
      workspaceId: 'workspace_old',
      workspaceSlug: 'existing-route',
      workspaceHost: 'existing-route.consuelohq.com',
      updatedAt: Date.parse('2026-08-12T12:00:00.000Z'),
    });

    await expect(
      resolveCanonicalDeviceIdentity({
        repository,
        store,
        email: 'ko@example.com',
        googleSubject: 'google-sub-123',
        nowMs: Date.parse('2026-08-13T12:05:00.000Z'),
      }),
    ).resolves.toEqual({
      status: 'resolved',
      canonicalUserId: 'user_123',
      canonicalWorkspaceId: 'workspace_old',
      operatingAccountId: 'user_123',
      workspaceRoute: {
        workspaceId: 'workspace_old',
        workspaceSlug: 'existing-route',
        workspaceHost: 'existing-route.consuelohq.com',
      },
    });
  });

  it('keeps a legacy Google account only as an internal node compatibility alias while binding canonical identity', async () => {
    const repository = createMemoryInstallControlPlaneRepository();
    await repository.upsertUser({
      userId: 'user_123',
      email: 'ko@example.com',
      workspaceIds: ['workspace_canonical'],
      workspaceMembershipVerifiedAt: '2026-08-13T12:00:00.000Z',
      createdAt: '2026-08-10T12:00:00.000Z',
      updatedAt: '2026-08-13T12:00:00.000Z',
    });
    const store = createMemoryDeviceGrantStore();
    await store.putAccountWorkspace({
      accountId: 'google:google-sub-123',
      workspaceId: 'workspace_canonical',
      workspaceSlug: 'existing-route',
      workspaceHost: 'existing-route.consuelohq.com',
      homeNodeId: 'node-existing',
      updatedAt: Date.parse('2026-08-12T12:00:00.000Z'),
    });

    await expect(
      resolveCanonicalDeviceIdentity({
        repository,
        store,
        email: 'ko@example.com',
        googleSubject: 'google-sub-123',
        nowMs: Date.parse('2026-08-13T12:05:00.000Z'),
      }),
    ).resolves.toEqual({
      status: 'resolved',
      canonicalUserId: 'user_123',
      canonicalWorkspaceId: 'workspace_canonical',
      operatingAccountId: 'google:google-sub-123',
      workspaceRoute: {
        workspaceId: 'workspace_canonical',
        workspaceSlug: 'existing-route',
        workspaceHost: 'existing-route.consuelohq.com',
      },
    });
  });

  it.each([
    {
      name: 'the synchronized directory is unavailable',
      seed: async () => undefined,
      repository: undefined,
      reason: 'directory_unavailable',
    },
    {
      name: 'the Google email has not been synchronized',
      seed: async () => undefined,
      reason: 'user_not_found',
    },
    {
      name: 'two canonical users share the same normalized email',
      seed: async (repository: ReturnType<typeof createMemoryInstallControlPlaneRepository>) => {
        for (const userId of ['user_1', 'user_2']) {
          await repository.upsertUser({
            userId,
            email: 'ko@example.com',
            workspaceIds: [`workspace_${userId}`],
            workspaceMembershipVerifiedAt: '2026-08-13T12:00:00.000Z',
            createdAt: '2026-08-10T12:00:00.000Z',
            updatedAt: '2026-08-13T12:00:00.000Z',
          });
        }
      },
      reason: 'ambiguous_user',
    },
    {
      name: 'the canonical user has no recently verified workspace membership',
      seed: async (repository: ReturnType<typeof createMemoryInstallControlPlaneRepository>) => {
        await repository.upsertUser({
          userId: 'user_123',
          email: 'ko@example.com',
          workspaceIds: ['workspace_unverified'],
          createdAt: '2026-08-10T12:00:00.000Z',
          updatedAt: '2026-08-13T12:00:00.000Z',
        });
      },
      reason: 'workspace_verification_required',
    },
    {
      name: 'the last signed workspace verification is stale',
      seed: async (repository: ReturnType<typeof createMemoryInstallControlPlaneRepository>) => {
        await repository.upsertUser({
          userId: 'user_123',
          email: 'ko@example.com',
          workspaceIds: ['workspace_stale'],
          workspaceMembershipVerifiedAt: '2026-08-13T11:30:00.000Z',
          createdAt: '2026-08-10T12:00:00.000Z',
          updatedAt: '2026-08-13T12:00:00.000Z',
        });
      },
      reason: 'workspace_verification_required',
    },
  ])('fails closed when $name', async ({ seed, repository: explicitRepository, reason }) => {
    const repository = explicitRepository ?? createMemoryInstallControlPlaneRepository();
    await seed(repository);

    await expect(
      resolveCanonicalDeviceIdentity({
        repository: explicitRepository === undefined && reason === 'directory_unavailable'
          ? undefined
          : repository,
        store: createMemoryDeviceGrantStore(),
        email: 'ko@example.com',
        googleSubject: 'google-sub-123',
        nowMs: Date.parse('2026-08-13T12:05:00.000Z'),
      }),
    ).resolves.toEqual({ status: 'denied', reason });
  });
});
