import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createGatewaySecurityConfig } from '../scripts/lib/security-gateway';

/**
 * A managed cloud node installs before it enrolls. Install has no workspace identity yet — that is
 * deliberate and guarded by "does not seed placeholder workspace identity before authority
 * enrollment" — so it writes generated auth under the local placeholder workspace. Enrollment then
 * arrives with the real workspace and must be able to take over that placeholder.
 *
 * Before this, the mismatch check rejected it and no managed cloud node could ever enroll.
 */

const PLACEHOLDER = 'local-consuelo-os';

let home: string;

const config = (workspaceId: string, slug: string, host: string) =>
  createGatewaySecurityConfig({ home, workspaceId, workspaceSlug: slug, workspaceHost: host });

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-gateway-auth-'));
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

describe('gateway auth workspace ownership', () => {
  it('lets enrollment take over auth left by the un-enrolled placeholder install', () => {
    config(PLACEHOLDER, 'local', 'local.consuelohq.com');

    expect(() =>
      config('workspace_internal', 'internal', 'internal.consuelohq.com'),
    ).not.toThrow();
  });

  it('adopts the real workspace identity after takeover', () => {
    config(PLACEHOLDER, 'local', 'local.consuelohq.com');
    const adopted = config('workspace_internal', 'internal', 'internal.consuelohq.com');

    expect(adopted.workspaceId).toBe('workspace_internal');
  });

  it('still refuses to reuse auth between two real workspaces', () => {
    config('workspace_internal', 'internal', 'internal.consuelohq.com');

    expect(() =>
      config('workspace_other', 'other', 'other.consuelohq.com'),
    ).toThrowError(/different workspace/);
  });

  it('is idempotent for the same workspace', () => {
    config('workspace_internal', 'internal', 'internal.consuelohq.com');
    expect(() =>
      config('workspace_internal', 'internal', 'internal.consuelohq.com'),
    ).not.toThrow();
  });
});

describe('managed cloud node enrollment declares identity replacement', () => {
  it('sends nodeIdentityReplacement so a reprovisioned node can re-enrol', async () => {
    // A wipe-and-reprovision mints a new device key while the control plane still holds the old
    // one for this node id. Without the declaration the mismatch is rejected and the node is stuck.
    const { runManagedCloudNodeEnrollment } = await import(
      '../scripts/lib/managed-cloud-node-enrollment'
    );
    let sent: Record<string, unknown> | undefined;

    await runManagedCloudNodeEnrollment({
      home: '/tmp/unused-managed-node',
      onboarding: {
        workspaceId: 'workspace_internal',
        workspaceSlug: 'internal',
        workspaceHost: 'internal.consuelohq.com',
        nodeId: 'cloud-1',
        nodeName: 'Cloud node',
      },
      dependencies: {
        loadOrCreateDeviceKeyPair: () => ({
          algorithm: 'Ed25519',
          publicKeyJwk: '{}',
          signingKeyJwk: '{}',
        }),
        requestDeviceCode: async (input: Record<string, unknown>) => {
          sent = input;
          return { status: 'error', message: 'stop after request' };
        },
      },
    } as never).catch(() => undefined);

    expect(sent?.nodeIdentityReplacement).toBe(true);
    expect(sent?.nodeId).toBe('cloud-1');
  });
});
