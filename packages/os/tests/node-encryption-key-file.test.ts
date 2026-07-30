import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  openSealedCredential,
  sealCredential,
} from '../scripts/lib/node-credential-sealing';
import {
  ensureNodeEncryptionKey,
  loadNodeEncryptionPrivateKey,
  nodeEncryptionKeyPath,
  readNodeEncryptionPublicKey,
  rotateNodeEncryptionKey,
} from '../scripts/lib/node-encryption-key-file';

const workspaceId = 'workspace_internal';
const nodeId = 'node_cloud_1';

let nodeHome: string;

const owner = { workspaceId, nodeId };

beforeEach(() => {
  nodeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-node-enc-key-'));
});

afterEach(() => {
  fs.rmSync(nodeHome, { recursive: true, force: true });
});

describe('node encryption key file', () => {
  describe('creation', () => {
    it('mints a key and returns only the public half', () => {
      const published = ensureNodeEncryptionKey({ nodeHome, ...owner });

      expect(published).toMatchObject({ workspaceId, nodeId, algorithm: 'X25519' });
      expect(JSON.parse(published.publicKeyJwk).d).toBeUndefined();
      expect(JSON.stringify(published)).not.toContain('privateKeyJwk');
    });

    it('writes the key file with owner-only permissions', () => {
      ensureNodeEncryptionKey({ nodeHome, ...owner });
      const file = nodeEncryptionKeyPath(nodeHome);

      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
      expect(fs.statSync(path.dirname(file)).mode & 0o777).toBe(0o700);
    });

    it('is idempotent so re-running install never orphans sealed credentials', () => {
      const first = ensureNodeEncryptionKey({ nodeHome, ...owner });
      const second = ensureNodeEncryptionKey({ nodeHome, ...owner });

      expect(second.publicKeyJwk).toBe(first.publicKeyJwk);
      expect(second.createdAt).toBe(first.createdAt);
    });

    it('produces a key that can actually open an envelope sealed to it', () => {
      const published = ensureNodeEncryptionKey({ nodeHome, ...owner });
      const envelope = sealCredential({
        recipientPublicKeyJwk: published.publicKeyJwk,
        recipient: { workspaceId, nodeId, bindingId: 'GITHUB_TOKEN' },
        plaintext: 'ghp_value',
      });

      expect(
        openSealedCredential({
          recipientPrivateKeyJwk: loadNodeEncryptionPrivateKey({ nodeHome, ...owner }),
          expectedRecipient: { workspaceId, nodeId, bindingId: 'GITHUB_TOKEN' },
          envelope,
        }),
      ).toBe('ghp_value');
    });
  });

  describe('ownership', () => {
    it('refuses a key belonging to a different node', () => {
      ensureNodeEncryptionKey({ nodeHome, ...owner });

      expect(() =>
        ensureNodeEncryptionKey({ nodeHome, workspaceId, nodeId: 'node_other' }),
      ).toThrowError(/different workspace or node/);
    });

    it('refuses a key belonging to a different workspace', () => {
      ensureNodeEncryptionKey({ nodeHome, ...owner });

      expect(() =>
        ensureNodeEncryptionKey({ nodeHome, workspaceId: 'workspace_other', nodeId }),
      ).toThrowError(/different workspace or node/);
    });

    it('refuses to load a private key for the wrong owner', () => {
      ensureNodeEncryptionKey({ nodeHome, ...owner });

      expect(() =>
        loadNodeEncryptionPrivateKey({ nodeHome, workspaceId, nodeId: 'node_other' }),
      ).toThrowError(/different workspace or node/);
    });
  });

  describe('integrity', () => {
    it('rejects a file whose public half was swapped for another key', () => {
      ensureNodeEncryptionKey({ nodeHome, ...owner });
      const other = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-other-'));
      const foreign = ensureNodeEncryptionKey({ nodeHome: other, ...owner });

      const file = nodeEncryptionKeyPath(nodeHome);
      const contents = JSON.parse(fs.readFileSync(file, 'utf8'));
      contents.publicKeyJwk = foreign.publicKeyJwk;
      fs.writeFileSync(file, JSON.stringify(contents));

      expect(() => loadNodeEncryptionPrivateKey({ nodeHome, ...owner })).toThrowError(
        /halves do not match/,
      );
      fs.rmSync(other, { recursive: true, force: true });
    });

    it('rejects a corrupt file rather than silently minting a new key', () => {
      ensureNodeEncryptionKey({ nodeHome, ...owner });
      fs.writeFileSync(nodeEncryptionKeyPath(nodeHome), 'not json');

      expect(() => ensureNodeEncryptionKey({ nodeHome, ...owner })).toThrowError(
        /not valid JSON/,
      );
    });

    it('rejects an unsupported file version', () => {
      ensureNodeEncryptionKey({ nodeHome, ...owner });
      const file = nodeEncryptionKeyPath(nodeHome);
      const contents = JSON.parse(fs.readFileSync(file, 'utf8'));
      contents.version = 99;
      fs.writeFileSync(file, JSON.stringify(contents));

      expect(() => readNodeEncryptionPublicKey({ nodeHome })).toThrowError(
        /version is unsupported/,
      );
    });

    it('reports a distinct code when no key exists yet', () => {
      try {
        loadNodeEncryptionPrivateKey({ nodeHome, ...owner });
        throw new Error('expected load to fail');
      } catch (error: unknown) {
        expect(error).toMatchObject({
          _tag: 'NodeEncryptionKeyError',
          code: 'KeyNotFound',
        });
      }
    });

    it('returns undefined from the public read when no key exists', () => {
      expect(readNodeEncryptionPublicKey({ nodeHome })).toBeUndefined();
    });
  });

  describe('rotation', () => {
    it('replaces the key and stamps rotatedAt while preserving createdAt', () => {
      const original = ensureNodeEncryptionKey({ nodeHome, ...owner });
      const rotated = rotateNodeEncryptionKey({ nodeHome, ...owner });

      expect(rotated.publicKeyJwk).not.toBe(original.publicKeyJwk);
      expect(rotated.createdAt).toBe(original.createdAt);
      expect(rotated.rotatedAt).toEqual(expect.any(String));
    });

    it('makes credentials sealed to the previous key unopenable, as documented', () => {
      const original = ensureNodeEncryptionKey({ nodeHome, ...owner });
      const envelope = sealCredential({
        recipientPublicKeyJwk: original.publicKeyJwk,
        recipient: { workspaceId, nodeId, bindingId: 'GITHUB_TOKEN' },
        plaintext: 'ghp_value',
      });
      rotateNodeEncryptionKey({ nodeHome, ...owner });

      expect(() =>
        openSealedCredential({
          recipientPrivateKeyJwk: loadNodeEncryptionPrivateKey({ nodeHome, ...owner }),
          expectedRecipient: { workspaceId, nodeId, bindingId: 'GITHUB_TOKEN' },
          envelope,
        }),
      ).toThrowError(/could not be opened/);
    });

    it('refuses to rotate a key owned by a different node', () => {
      ensureNodeEncryptionKey({ nodeHome, ...owner });

      expect(() =>
        rotateNodeEncryptionKey({ nodeHome, workspaceId, nodeId: 'node_other' }),
      ).toThrowError(/different workspace or node/);
    });

    it('can rotate into an empty home, creating the first key', () => {
      const rotated = rotateNodeEncryptionKey({ nodeHome, ...owner });
      expect(rotated.publicKeyJwk).toEqual(expect.any(String));
      expect(rotated.rotatedAt).toEqual(expect.any(String));
    });
  });
});
