import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  generateNodeEncryptionKeyPair,
  sealCredential,
  type NodeEncryptionKeyPair,
  type SealedCredentialRecipient,
} from '../scripts/lib/node-credential-sealing';
import {
  credentialStatus,
  installSealedCredential,
  listSealedCredentials,
  nodeSealedCredentialStorePath,
  removeSealedCredential,
  resolveCredentialForBroker,
} from '../scripts/lib/node-sealed-credential-store';

const recipient: SealedCredentialRecipient = {
  workspaceId: 'workspace_internal',
  nodeId: 'node_cloud_1',
  bindingId: 'GITHUB_TOKEN',
};

const secret = 'ghp_sealed_store_value_0123456789';

let home: string;
let keyPair: NodeEncryptionKeyPair;

const seal = (
  to: SealedCredentialRecipient = recipient,
  plaintext = secret,
  publicKeyJwk = keyPair.publicKeyJwk,
) => sealCredential({ recipientPublicKeyJwk: publicKeyJwk, recipient: to, plaintext });

const install = (
  to: SealedCredentialRecipient = recipient,
  plaintext = secret,
) =>
  installSealedCredential({
    home,
    nodePrivateKeyJwk: keyPair.privateKeyJwk,
    recipient: to,
    envelope: seal(to, plaintext),
  });

const resolve = (to: SealedCredentialRecipient = recipient) =>
  resolveCredentialForBroker({
    home,
    nodePrivateKeyJwk: keyPair.privateKeyJwk,
    workspaceId: to.workspaceId,
    nodeId: to.nodeId,
    bindingId: to.bindingId,
  });

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-sealed-store-'));
  keyPair = generateNodeEncryptionKeyPair();
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

describe('node sealed credential store', () => {
  describe('install and resolve', () => {
    it('installs a delivered envelope and resolves it for the broker', () => {
      const descriptor = install();
      expect(descriptor).toMatchObject({
        workspaceId: recipient.workspaceId,
        nodeId: recipient.nodeId,
        bindingId: recipient.bindingId,
        status: 'set',
      });
      expect(resolve()).toBe(secret);
    });

    it('survives a fresh read with no in-memory state', () => {
      install();
      expect(
        resolveCredentialForBroker({
          home,
          nodePrivateKeyJwk: keyPair.privateKeyJwk,
          workspaceId: recipient.workspaceId,
          nodeId: recipient.nodeId,
          bindingId: recipient.bindingId,
        }),
      ).toBe(secret);
    });

    it('rotates in place and preserves the original createdAt', () => {
      const first = install();
      const rotated = install(recipient, 'ghp_rotated_value_9876543210');

      expect(rotated.createdAt).toBe(first.createdAt);
      expect(resolve()).toBe('ghp_rotated_value_9876543210');
    });

    it('keeps distinct bindings independent', () => {
      install();
      const other = { ...recipient, bindingId: 'TWILIO_AUTH_TOKEN' };
      install(other, 'twilio_value_abc');

      expect(resolve()).toBe(secret);
      expect(resolve(other)).toBe('twilio_value_abc');
    });

    it('refuses an envelope sealed for a different node before touching disk', () => {
      const foreign = { ...recipient, nodeId: 'node_other_machine' };
      expect(() =>
        installSealedCredential({
          home,
          nodePrivateKeyJwk: keyPair.privateKeyJwk,
          recipient,
          envelope: seal(foreign),
        }),
      ).toThrowError(/not issued for this node and binding/);

      expect(fs.existsSync(nodeSealedCredentialStorePath(home))).toBe(false);
    });
  });

  describe('at-rest protection', () => {
    it('never writes the plaintext to disk', () => {
      install();
      const file = path.join(
        nodeSealedCredentialStorePath(home),
        `${recipient.bindingId}.json`,
      );
      const raw = fs.readFileSync(file, 'utf8');

      expect(raw).not.toContain(secret);
      expect(raw).not.toContain('ghp_sealed_store');
    });

    it('does not persist the transit envelope, which would stay replayable', () => {
      const envelope = seal();
      installSealedCredential({
        home,
        nodePrivateKeyJwk: keyPair.privateKeyJwk,
        recipient,
        envelope,
      });
      const raw = fs.readFileSync(
        path.join(nodeSealedCredentialStorePath(home), `${recipient.bindingId}.json`),
        'utf8',
      );

      expect(raw).not.toContain(envelope.ciphertext);
      expect(raw).not.toContain(envelope.ephemeralPublicKeyJwk);
    });

    it('writes records and the store directory with owner-only permissions', () => {
      install();
      const dir = nodeSealedCredentialStorePath(home);
      const file = path.join(dir, `${recipient.bindingId}.json`);

      expect(fs.statSync(dir).mode & 0o777).toBe(0o700);
      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    });

    it('cannot be decrypted with a different node private key', () => {
      install();
      const attacker = generateNodeEncryptionKeyPair();

      expect(() =>
        resolveCredentialForBroker({
          home,
          nodePrivateKeyJwk: attacker.privateKeyJwk,
          workspaceId: recipient.workspaceId,
          nodeId: recipient.nodeId,
          bindingId: recipient.bindingId,
        }),
      ).toThrowError(/could not be decrypted/);
    });

    it('detects a tampered at-rest ciphertext', () => {
      install();
      const file = path.join(
        nodeSealedCredentialStorePath(home),
        `${recipient.bindingId}.json`,
      );
      const record = JSON.parse(fs.readFileSync(file, 'utf8'));
      const bytes = Buffer.from(record.ciphertext, 'base64');
      bytes[0] = bytes[0] ^ 0xff;
      record.ciphertext = bytes.toString('base64');
      fs.writeFileSync(file, JSON.stringify(record));

      expect(() => resolve()).toThrowError(/could not be decrypted/);
    });

    it('does not let one binding record be decrypted as another', () => {
      install();
      const other = { ...recipient, bindingId: 'TWILIO_AUTH_TOKEN' };
      install(other, 'twilio_value_abc');

      const dir = nodeSealedCredentialStorePath(home);
      // Swap the record bodies but keep each file's binding id, simulating an attacker who moves
      // ciphertext between records hoping the at-rest key is shared.
      const github = JSON.parse(
        fs.readFileSync(path.join(dir, 'GITHUB_TOKEN.json'), 'utf8'),
      );
      const twilio = JSON.parse(
        fs.readFileSync(path.join(dir, 'TWILIO_AUTH_TOKEN.json'), 'utf8'),
      );
      fs.writeFileSync(
        path.join(dir, 'TWILIO_AUTH_TOKEN.json'),
        JSON.stringify({ ...github, bindingId: 'TWILIO_AUTH_TOKEN' }),
      );
      fs.writeFileSync(
        path.join(dir, 'GITHUB_TOKEN.json'),
        JSON.stringify({ ...twilio, bindingId: 'GITHUB_TOKEN' }),
      );

      expect(() => resolve()).toThrowError(/could not be decrypted/);
      expect(() => resolve(other)).toThrowError(/could not be decrypted/);
    });
  });

  describe('no cross-node fallback', () => {
    it('refuses to resolve a record belonging to another node even when readable', () => {
      install();
      const file = path.join(
        nodeSealedCredentialStorePath(home),
        `${recipient.bindingId}.json`,
      );
      const record = JSON.parse(fs.readFileSync(file, 'utf8'));
      record.nodeId = 'node_other_machine';
      fs.writeFileSync(file, JSON.stringify(record));

      expect(() => resolve()).toThrowError(
        /not set for this workspace and node/,
      );
    });

    it('refuses to resolve a record belonging to another workspace', () => {
      install();
      const file = path.join(
        nodeSealedCredentialStorePath(home),
        `${recipient.bindingId}.json`,
      );
      const record = JSON.parse(fs.readFileSync(file, 'utf8'));
      record.workspaceId = 'workspace_other';
      fs.writeFileSync(file, JSON.stringify(record));

      expect(() => resolve()).toThrowError(
        /not set for this workspace and node/,
      );
    });

    it('reports a foreign record as missing rather than set', () => {
      install();
      expect(
        credentialStatus({
          home,
          workspaceId: recipient.workspaceId,
          nodeId: 'node_other_machine',
          bindingId: recipient.bindingId,
        }),
      ).toBe('missing');
    });
  });

  describe('status surface', () => {
    it('reports missing before install and set after', () => {
      const args = {
        home,
        workspaceId: recipient.workspaceId,
        nodeId: recipient.nodeId,
        bindingId: recipient.bindingId,
      };
      expect(credentialStatus(args)).toBe('missing');
      install();
      expect(credentialStatus(args)).toBe('set');
    });

    it('reports missing for an empty store without creating it', () => {
      expect(
        credentialStatus({
          home,
          workspaceId: recipient.workspaceId,
          nodeId: recipient.nodeId,
          bindingId: 'NEVER_SET',
        }),
      ).toBe('missing');
      expect(fs.existsSync(nodeSealedCredentialStorePath(home))).toBe(false);
    });

    it('fails resolve with a distinct code when the credential is absent', () => {
      try {
        resolve();
        throw new Error('expected resolve to fail');
      } catch (error: unknown) {
        expect(error).toMatchObject({
          _tag: 'NodeSealedCredentialStoreError',
          code: 'CredentialNotFound',
        });
      }
    });
  });

  describe('listing', () => {
    it('lists only this node’s bindings, sorted, with no values', () => {
      install({ ...recipient, bindingId: 'ZULU_TOKEN' }, 'zulu');
      install({ ...recipient, bindingId: 'ALPHA_TOKEN' }, 'alpha');

      const listed = listSealedCredentials({
        home,
        workspaceId: recipient.workspaceId,
        nodeId: recipient.nodeId,
      });

      expect(listed.map((entry) => entry.bindingId)).toEqual([
        'ALPHA_TOKEN',
        'ZULU_TOKEN',
      ]);
      expect(JSON.stringify(listed)).not.toContain('zulu');
      expect(JSON.stringify(listed)).not.toContain('alpha');
      expect(listed.every((entry) => entry.status === 'set')).toBe(true);
    });

    it('returns an empty list when the store does not exist', () => {
      expect(
        listSealedCredentials({
          home,
          workspaceId: recipient.workspaceId,
          nodeId: recipient.nodeId,
        }),
      ).toEqual([]);
    });

    it('excludes records belonging to another node', () => {
      install();
      const file = path.join(
        nodeSealedCredentialStorePath(home),
        `${recipient.bindingId}.json`,
      );
      const record = JSON.parse(fs.readFileSync(file, 'utf8'));
      record.nodeId = 'node_other_machine';
      fs.writeFileSync(file, JSON.stringify(record));

      expect(
        listSealedCredentials({
          home,
          workspaceId: recipient.workspaceId,
          nodeId: recipient.nodeId,
        }),
      ).toEqual([]);
    });
  });

  describe('removal', () => {
    it('removes a credential so it resolves as missing', () => {
      install();
      expect(removeSealedCredential({ home, bindingId: recipient.bindingId })).toEqual(
        { removed: true },
      );
      expect(
        credentialStatus({
          home,
          workspaceId: recipient.workspaceId,
          nodeId: recipient.nodeId,
          bindingId: recipient.bindingId,
        }),
      ).toBe('missing');
    });

    it('is idempotent so a retried rotation does not fail', () => {
      install();
      removeSealedCredential({ home, bindingId: recipient.bindingId });
      expect(removeSealedCredential({ home, bindingId: recipient.bindingId })).toEqual(
        { removed: true },
      );
    });
  });

  describe('binding id validation', () => {
    it.each([
      ['path traversal', '../../escape'],
      ['absolute path', '/etc/passwd'],
      ['separator', 'a/b'],
      ['empty', ''],
    ])('rejects %s rather than sanitizing it', (_label, bindingId) => {
      expect(() =>
        credentialStatus({
          home,
          workspaceId: recipient.workspaceId,
          nodeId: recipient.nodeId,
          bindingId,
        }),
      ).toThrowError(/binding ID/);
    });

    it('keeps a traversal attempt from reading outside the store', () => {
      expect(() =>
        removeSealedCredential({ home, bindingId: '../../../etc/passwd' }),
      ).toThrowError(/binding ID/);
    });
  });

  describe('corruption handling', () => {
    it('reports a corrupt record distinctly from a missing one', () => {
      install();
      fs.writeFileSync(
        path.join(nodeSealedCredentialStorePath(home), `${recipient.bindingId}.json`),
        'not json',
      );

      try {
        resolve();
        throw new Error('expected resolve to fail');
      } catch (error: unknown) {
        expect(error).toMatchObject({ code: 'RecordCorrupt' });
      }
    });

    it('rejects an unsupported record version', () => {
      install();
      const file = path.join(
        nodeSealedCredentialStorePath(home),
        `${recipient.bindingId}.json`,
      );
      const record = JSON.parse(fs.readFileSync(file, 'utf8'));
      record.version = 99;
      fs.writeFileSync(file, JSON.stringify(record));

      expect(() => resolve()).toThrowError(/version is unsupported/);
    });

    it('leaves no temp files behind after a successful write', () => {
      install();
      const entries = fs.readdirSync(nodeSealedCredentialStorePath(home));
      expect(entries.filter((entry) => entry.endsWith('.tmp'))).toEqual([]);
    });
  });
});

describe('credential mutation audit', () => {
  const actor = {
    actorType: 'user' as const,
    actorId: 'operator:cli',
    workspaceId: recipient.workspaceId,
    correlationId: 'corr_audit',
    nodeId: recipient.nodeId,
  };

  const auditEvents = (): Record<string, unknown>[] => {
    const file = path.join(home, 'logs', 'control-plane-audit.jsonl');
    if (!fs.existsSync(file)) return [];
    return fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  };

  it('records an install without leaking the value', () => {
    installSealedCredential({
      home,
      nodePrivateKeyJwk: keyPair.privateKeyJwk,
      recipient,
      envelope: seal(),
      actor,
    });

    const events = auditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: 'credential.installed',
      reasonCode: 'credential_installed',
      outcome: 'allowed',
      safeMetadata: { bindingId: recipient.bindingId, source: 'node-sealed' },
    });
    expect(JSON.stringify(events[0])).not.toContain(secret);
  });

  it('records a removal', () => {
    install();
    removeSealedCredential({ home, bindingId: recipient.bindingId, actor });
    expect(auditEvents().pop()).toMatchObject({
      event: 'credential.removed',
      reasonCode: 'credential_removed',
    });
  });

  it('stays silent when no actor is supplied', () => {
    install();
    removeSealedCredential({ home, bindingId: recipient.bindingId });
    expect(auditEvents()).toEqual([]);
  });
});
