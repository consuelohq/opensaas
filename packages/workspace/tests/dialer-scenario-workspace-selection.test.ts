import { describe, expect, it, vi } from 'vitest';

import { selectWorkspaceLoginToken } from '../scripts/run-dialer-scenario';

type WorkspaceFixture = Parameters<
  typeof selectWorkspaceLoginToken
>[0]['workspaces'][number];

const workspace = (id: string): WorkspaceFixture => ({
  id,
  loginToken: `login-${id}`,
  workspaceUrls: {
    customUrl: null,
    subdomainUrl: 'http://localhost:3001/',
  },
});

describe('dialer scenario workspace selection', () => {
  it('tries later workspaces when an earlier login token is invalid', async () => {
    const exchangeToken = vi.fn(async (candidate: WorkspaceFixture) => {
      if (candidate.id === 'stale-workspace') {
        throw new Error('Token is not valid for this workspace');
      }

      return 'valid-workspace-token';
    });

    await expect(
      selectWorkspaceLoginToken({
        workspaces: [
          workspace('stale-workspace'),
          workspace('valid-workspace'),
        ],
        requestedWorkspaceId: '',
        exchangeToken,
      }),
    ).resolves.toEqual({
      token: 'valid-workspace-token',
      workspaceId: 'valid-workspace',
    });

    expect(exchangeToken).toHaveBeenCalledTimes(2);
  });

  it('honors an explicit workspace selection', async () => {
    const exchangeToken = vi.fn(async () => 'explicit-workspace-token');

    await expect(
      selectWorkspaceLoginToken({
        workspaces: [
          workspace('first-workspace'),
          workspace('selected-workspace'),
        ],
        requestedWorkspaceId: 'selected-workspace',
        exchangeToken,
      }),
    ).resolves.toEqual({
      token: 'explicit-workspace-token',
      workspaceId: 'selected-workspace',
    });

    expect(exchangeToken).toHaveBeenCalledTimes(1);
    expect(exchangeToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'selected-workspace' }),
    );
  });

  it('fails clearly when an explicit workspace is absent', async () => {
    await expect(
      selectWorkspaceLoginToken({
        workspaces: [workspace('available-workspace')],
        requestedWorkspaceId: 'missing-workspace',
        exchangeToken: vi.fn(),
      }),
    ).rejects.toThrow(
      'Requested scenario workspace was not returned by sign-in',
    );
  });

  it('fails when every returned workspace login token is invalid', async () => {
    await expect(
      selectWorkspaceLoginToken({
        workspaces: [
          workspace('first-workspace'),
          workspace('second-workspace'),
        ],
        requestedWorkspaceId: '',
        exchangeToken: vi.fn(async () => {
          throw new Error('invalid login token');
        }),
      }),
    ).rejects.toThrow('No returned workspace login token could be exchanged');
  });
});
