import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { controlPlaneAuditPath } from '../scripts/lib/control-plane-audit';
import {
  inspectCredential,
  withCredential,
  withCredentialEnvironment,
  type CredentialBrokerPolicy,
} from '../scripts/lib/credential-broker';
import { sealCredential } from '../scripts/lib/node-credential-sealing';
import { ensureNodeEncryptionKey } from '../scripts/lib/node-encryption-key-file';
import { installSealedCredential } from '../scripts/lib/node-sealed-credential-store';

const workspaceId = 'workspace_internal';
const nodeId = 'node_cloud_1';
const scriptId = 'git';
const secret = 'ghp_broker_value_0123456789';

let home: string;
let nodeHome: string;

const actor = {
  actorType: 'agent' as const,
  actorId: 'agent:claude',
  workspaceId,
  correlationId: 'corr_1',
  nodeId,
};

const policy: CredentialBrokerPolicy = {
  workspaceId,
  nodeId,
  grants: [
    {
      bindingId: 'GITHUB_TOKEN',
      scriptIds: ['git', 'github'],
      environmentVariable: 'GITHUB_TOKEN',
    },
    { bindingId: 'TWILIO_AUTH_TOKEN', scriptIds: ['dialer'] },
  ],
};

const provision = (bindingId: string, plaintext: string): void => {
  const published = ensureNodeEncryptionKey({ nodeHome, workspaceId, nodeId });
  installSealedCredential({
    home,
    nodePrivateKeyJwk: JSON.parse(
      fs.readFileSync(
        path.join(nodeHome, 'security', 'generated', 'node-encryption-key.json'),
        'utf8',
      ),
    ).privateKeyJwk,
    recipient: { workspaceId, nodeId, bindingId },
    envelope: sealCredential({
      recipientPublicKeyJwk: published.publicKeyJwk,
      recipient: { workspaceId, nodeId, bindingId },
      plaintext,
    }),
  });
};

const auditLines = (): Record<string, unknown>[] => {
  const file = controlPlaneAuditPath(home);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
};

const base = () => ({ home, nodeHome, policy, actor, scriptId });

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-broker-home-'));
  nodeHome = path.join(home, 'node');
  fs.mkdirSync(nodeHome, { recursive: true });
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

describe('credential broker', () => {
  describe('resolution', () => {
    it('hands the value to the operation and returns the operation result', async () => {
      provision('GITHUB_TOKEN', secret);
      const result = await withCredential(
        { ...base(), bindingId: 'GITHUB_TOKEN' },
        (credential) => `used:${credential}`,
      );
      expect(result).toBe(`used:${secret}`);
    });

    it('supports an async operation', async () => {
      provision('GITHUB_TOKEN', secret);
      const result = await withCredential(
        { ...base(), bindingId: 'GITHUB_TOKEN' },
        async (credential) => credential.length,
      );
      expect(result).toBe(secret.length);
    });

    it('permits any script listed on the grant', async () => {
      provision('GITHUB_TOKEN', secret);
      const result = await withCredential(
        { ...base(), scriptId: 'github', bindingId: 'GITHUB_TOKEN' },
        (credential) => credential,
      );
      expect(result).toBe(secret);
    });
  });

  describe('authorization', () => {
    it('denies a binding that is not declared', async () => {
      provision('GITHUB_TOKEN', secret);
      await expect(
        withCredential({ ...base(), bindingId: 'UNDECLARED' }, () => 'x'),
      ).rejects.toMatchObject({ code: 'UnknownBinding' });
    });

    it('denies a script that is not on the grant', async () => {
      provision('GITHUB_TOKEN', secret);
      await expect(
        withCredential(
          { ...base(), scriptId: 'dialer', bindingId: 'GITHUB_TOKEN' },
          () => 'x',
        ),
      ).rejects.toMatchObject({ code: 'ScriptNotPermitted' });
    });

    it('does not run the operation when access is denied', async () => {
      provision('GITHUB_TOKEN', secret);
      let ran = false;
      await expect(
        withCredential({ ...base(), bindingId: 'UNDECLARED' }, () => {
          ran = true;
          return 'x';
        }),
      ).rejects.toThrow();
      expect(ran).toBe(false);
    });

    it('fails closed when the credential is not set, with no cross-node fallback', async () => {
      ensureNodeEncryptionKey({ nodeHome, workspaceId, nodeId });
      await expect(
        withCredential({ ...base(), bindingId: 'GITHUB_TOKEN' }, () => 'x'),
      ).rejects.toMatchObject({ code: 'CredentialMissing' });
    });
  });

  describe('audit', () => {
    it('records a resolution with no value in the event', async () => {
      provision('GITHUB_TOKEN', secret);
      await withCredential({ ...base(), bindingId: 'GITHUB_TOKEN' }, () => 'x');

      const events = auditLines();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        event: 'credential.resolved',
        reasonCode: 'credential_resolved',
        outcome: 'allowed',
        safeMetadata: { bindingId: 'GITHUB_TOKEN', scriptId: 'git', source: 'node-sealed' },
      });
      expect(JSON.stringify(events[0])).not.toContain(secret);
    });

    it('records a denial, as the contract requires for failures too', async () => {
      provision('GITHUB_TOKEN', secret);
      await expect(
        withCredential(
          { ...base(), scriptId: 'dialer', bindingId: 'GITHUB_TOKEN' },
          () => 'x',
        ),
      ).rejects.toThrow();

      expect(auditLines()[0]).toMatchObject({
        outcome: 'denied',
        reasonCode: 'credential_denied',
      });
    });

    it('records a missing credential distinctly from a denial', async () => {
      ensureNodeEncryptionKey({ nodeHome, workspaceId, nodeId });
      await expect(
        withCredential({ ...base(), bindingId: 'GITHUB_TOKEN' }, () => 'x'),
      ).rejects.toThrow();

      expect(auditLines()[0]).toMatchObject({
        outcome: 'failed',
        reasonCode: 'credential_missing',
      });
    });

    it('writes the audit log with owner-only permissions', async () => {
      provision('GITHUB_TOKEN', secret);
      await withCredential({ ...base(), bindingId: 'GITHUB_TOKEN' }, () => 'x');

      expect(fs.statSync(controlPlaneAuditPath(home)).mode & 0o777).toBe(0o600);
    });
  });

  describe('inspect surface', () => {
    it('reports set for a permitted binding that exists', () => {
      provision('GITHUB_TOKEN', secret);
      expect(
        inspectCredential({ home, policy, bindingId: 'GITHUB_TOKEN', scriptId }),
      ).toEqual({ status: 'set', permitted: true });
    });

    it('reports missing for a permitted binding that is not set', () => {
      expect(
        inspectCredential({ home, policy, bindingId: 'GITHUB_TOKEN', scriptId }),
      ).toEqual({ status: 'missing', permitted: true });
    });

    it('reports not permitted without revealing whether the credential exists', () => {
      provision('GITHUB_TOKEN', secret);
      expect(
        inspectCredential({
          home,
          policy,
          bindingId: 'GITHUB_TOKEN',
          scriptId: 'dialer',
        }),
      ).toEqual({ status: 'missing', permitted: false });
    });

    it('does not write an audit event, since nothing was resolved', () => {
      provision('GITHUB_TOKEN', secret);
      inspectCredential({ home, policy, bindingId: 'GITHUB_TOKEN', scriptId });
      expect(auditLines()).toEqual([]);
    });
  });

  describe('child process environment', () => {
    it('builds an environment containing the credential under its declared variable', async () => {
      provision('GITHUB_TOKEN', secret);
      const seen = await withCredentialEnvironment(
        { ...base(), bindingIds: ['GITHUB_TOKEN'] },
        (environment) => ({ ...environment }),
      );
      expect(seen).toEqual({ GITHUB_TOKEN: secret });
    });

    it('falls back to the binding id when no variable is declared', async () => {
      provision('TWILIO_AUTH_TOKEN', 'twilio_secret');
      const seen = await withCredentialEnvironment(
        { ...base(), scriptId: 'dialer', bindingIds: ['TWILIO_AUTH_TOKEN'] },
        (environment) => ({ ...environment }),
      );
      expect(seen).toEqual({ TWILIO_AUTH_TOKEN: 'twilio_secret' });
    });

    it('merges multiple credentials for one child process', async () => {
      provision('GITHUB_TOKEN', secret);
      const twoScripts: CredentialBrokerPolicy = {
        ...policy,
        grants: [
          { bindingId: 'GITHUB_TOKEN', scriptIds: ['git'], environmentVariable: 'GITHUB_TOKEN' },
          { bindingId: 'TWILIO_AUTH_TOKEN', scriptIds: ['git'] },
        ],
      };
      provision('TWILIO_AUTH_TOKEN', 'twilio_secret');

      const seen = await withCredentialEnvironment(
        { ...base(), policy: twoScripts, bindingIds: ['GITHUB_TOKEN', 'TWILIO_AUTH_TOKEN'] },
        (environment) => ({ ...environment }),
      );
      expect(seen).toEqual({
        GITHUB_TOKEN: secret,
        TWILIO_AUTH_TOKEN: 'twilio_secret',
      });
    });

    it('preserves the base environment and strips only injected credentials afterwards', async () => {
      provision('GITHUB_TOKEN', secret);
      const captured: Record<string, string> = {};
      await withCredentialEnvironment(
        { ...base(), bindingIds: ['GITHUB_TOKEN'], baseEnvironment: { PATH: '/usr/bin' } },
        (environment) => {
          Object.assign(captured, environment);
          return null;
        },
      );
      expect(captured).toEqual({ PATH: '/usr/bin', GITHUB_TOKEN: secret });
    });

    it('does not place the credential in the parent process environment', async () => {
      provision('GITHUB_TOKEN', secret);
      await withCredentialEnvironment(
        { ...base(), bindingIds: ['GITHUB_TOKEN'] },
        (environment) => environment.GITHUB_TOKEN,
      );
      expect(process.env.GITHUB_TOKEN).toBeUndefined();
    });

    it('propagates a denial for any one binding without running the operation', async () => {
      provision('GITHUB_TOKEN', secret);
      let ran = false;
      await expect(
        withCredentialEnvironment(
          { ...base(), bindingIds: ['GITHUB_TOKEN', 'TWILIO_AUTH_TOKEN'] },
          () => {
            ran = true;
            return null;
          },
        ),
      ).rejects.toMatchObject({ code: 'ScriptNotPermitted' });
      expect(ran).toBe(false);
    });
  });

  describe('error hygiene', () => {
    it('never includes the credential value in a thrown error', async () => {
      provision('GITHUB_TOKEN', secret);
      try {
        await withCredential({ ...base(), bindingId: 'GITHUB_TOKEN' }, () => {
          throw new Error('operation exploded');
        });
        throw new Error('expected failure');
      } catch (error: unknown) {
        expect((error as Error).message).not.toContain(secret);
      }
    });

    it('surfaces the operation error rather than swallowing it', async () => {
      provision('GITHUB_TOKEN', secret);
      await expect(
        withCredential({ ...base(), bindingId: 'GITHUB_TOKEN' }, () => {
          throw new Error('operation exploded');
        }),
      ).rejects.toThrow(/operation exploded/);
    });
  });
});
