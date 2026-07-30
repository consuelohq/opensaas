import { generateKeyPairSync } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  generateNodeEncryptionKeyPair,
  nodeEncryptionPublicKeyFromPrivate,
  openSealedCredential,
  sealCredential,
  type SealedCredentialEnvelope,
  type SealedCredentialRecipient,
} from '../scripts/lib/node-credential-sealing';

const recipient: SealedCredentialRecipient = {
  workspaceId: 'workspace_internal',
  nodeId: 'node_cloud_1',
  bindingId: 'binding_github_token',
};

const secret = 'ghp_example_credential_value_0123456789';

const sealTo = (
  publicKeyJwk: string,
  to: SealedCredentialRecipient = recipient,
  plaintext = secret,
): SealedCredentialEnvelope =>
  sealCredential({ recipientPublicKeyJwk: publicKeyJwk, recipient: to, plaintext });

describe('node credential sealing', () => {
  describe('key generation', () => {
    it('mints X25519 keypairs and never emits a private component in the public JWK', () => {
      const keyPair = generateNodeEncryptionKeyPair();
      const publicJwk = JSON.parse(keyPair.publicKeyJwk);
      const privateJwk = JSON.parse(keyPair.privateKeyJwk);

      expect(keyPair.algorithm).toBe('X25519');
      expect(publicJwk).toMatchObject({ kty: 'OKP', crv: 'X25519' });
      expect(publicJwk.d).toBeUndefined();
      expect(privateJwk.d).toEqual(expect.any(String));
    });

    it('generates a distinct keypair on every call', () => {
      const first = generateNodeEncryptionKeyPair();
      const second = generateNodeEncryptionKeyPair();
      expect(first.privateKeyJwk).not.toBe(second.privateKeyJwk);
      expect(first.publicKeyJwk).not.toBe(second.publicKeyJwk);
    });

    it('derives a public key from a private key that can open its own envelopes', () => {
      const keyPair = generateNodeEncryptionKeyPair();
      const derived = nodeEncryptionPublicKeyFromPrivate(keyPair.privateKeyJwk);

      const opened = openSealedCredential({
        recipientPrivateKeyJwk: keyPair.privateKeyJwk,
        expectedRecipient: recipient,
        envelope: sealTo(derived),
      });
      expect(opened).toBe(secret);
    });

    it('rejects an Ed25519 signing key, which must not be repurposed for encryption', () => {
      const ed25519 = generateKeyPairSync('ed25519');
      const signingPublicJwk = JSON.stringify(
        ed25519.publicKey.export({ format: 'jwk' }),
      );

      expect(() => sealTo(signingPublicJwk)).toThrowError(/X25519 OKP JWK/);
    });
  });

  describe('round trip', () => {
    it('opens an envelope on the node that owns the private key', () => {
      const keyPair = generateNodeEncryptionKeyPair();
      const opened = openSealedCredential({
        recipientPrivateKeyJwk: keyPair.privateKeyJwk,
        expectedRecipient: recipient,
        envelope: sealTo(keyPair.publicKeyJwk),
      });
      expect(opened).toBe(secret);
    });

    it('never places plaintext in the envelope', () => {
      const keyPair = generateNodeEncryptionKeyPair();
      const envelope = sealTo(keyPair.publicKeyJwk);
      expect(JSON.stringify(envelope)).not.toContain(secret);
      expect(JSON.stringify(envelope)).not.toContain('ghp_example');
    });

    it('produces a different envelope each time so ciphertext cannot be correlated', () => {
      const keyPair = generateNodeEncryptionKeyPair();
      const first = sealTo(keyPair.publicKeyJwk);
      const second = sealTo(keyPair.publicKeyJwk);

      expect(first.ciphertext).not.toBe(second.ciphertext);
      expect(first.iv).not.toBe(second.iv);
      expect(first.ephemeralPublicKeyJwk).not.toBe(second.ephemeralPublicKeyJwk);
    });

    it('preserves multi-byte and newline-bearing values exactly', () => {
      const keyPair = generateNodeEncryptionKeyPair();
      const awkward = '-----BEGIN KEY-----\nlíne→two\n🔐\n-----END KEY-----';
      const opened = openSealedCredential({
        recipientPrivateKeyJwk: keyPair.privateKeyJwk,
        expectedRecipient: recipient,
        envelope: sealTo(keyPair.publicKeyJwk, recipient, awkward),
      });
      expect(opened).toBe(awkward);
    });
  });

  describe('recipient binding', () => {
    it('refuses an envelope sealed for a different node', () => {
      const keyPair = generateNodeEncryptionKeyPair();
      const envelope = sealTo(keyPair.publicKeyJwk, {
        ...recipient,
        nodeId: 'node_other_machine',
      });

      expect(() =>
        openSealedCredential({
          recipientPrivateKeyJwk: keyPair.privateKeyJwk,
          expectedRecipient: recipient,
          envelope,
        }),
      ).toThrowError(/not issued for this node and binding/);
    });

    it('refuses an envelope sealed for a different binding on the same node', () => {
      const keyPair = generateNodeEncryptionKeyPair();
      const envelope = sealTo(keyPair.publicKeyJwk, {
        ...recipient,
        bindingId: 'binding_twilio_auth_token',
      });

      expect(() =>
        openSealedCredential({
          recipientPrivateKeyJwk: keyPair.privateKeyJwk,
          expectedRecipient: recipient,
          envelope,
        }),
      ).toThrowError(/not issued for this node and binding/);
    });

    it('refuses an envelope sealed for a different workspace', () => {
      const keyPair = generateNodeEncryptionKeyPair();
      const envelope = sealTo(keyPair.publicKeyJwk, {
        ...recipient,
        workspaceId: 'workspace_other',
      });

      expect(() =>
        openSealedCredential({
          recipientPrivateKeyJwk: keyPair.privateKeyJwk,
          expectedRecipient: recipient,
          envelope,
        }),
      ).toThrowError(/not issued for this node and binding/);
    });

    it('fails when the recipient block is rewritten to match, because it is authenticated', () => {
      const keyPair = generateNodeEncryptionKeyPair();
      const envelope = sealTo(keyPair.publicKeyJwk, {
        ...recipient,
        nodeId: 'node_other_machine',
      });

      // An attacker who controls the relay rewrites the recipient to pass the equality check.
      // GCM additional data still binds the original recipient, so decryption must fail.
      const forged: SealedCredentialEnvelope = { ...envelope, recipient };

      expect(() =>
        openSealedCredential({
          recipientPrivateKeyJwk: keyPair.privateKeyJwk,
          expectedRecipient: recipient,
          envelope: forged,
        }),
      ).toThrowError(/could not be opened/);
    });
  });

  describe('key confusion', () => {
    it('refuses to open an envelope with a different node private key', () => {
      const intended = generateNodeEncryptionKeyPair();
      const attacker = generateNodeEncryptionKeyPair();

      expect(() =>
        openSealedCredential({
          recipientPrivateKeyJwk: attacker.privateKeyJwk,
          expectedRecipient: recipient,
          envelope: sealTo(intended.publicKeyJwk),
        }),
      ).toThrowError(/could not be opened/);
    });

    it('rejects a public JWK carrying a private component', () => {
      const keyPair = generateNodeEncryptionKeyPair();
      expect(() => sealTo(keyPair.privateKeyJwk)).toThrowError(
        /must not contain a private component/,
      );
    });

    it('rejects a private JWK that has no private component', () => {
      const keyPair = generateNodeEncryptionKeyPair();
      expect(() =>
        openSealedCredential({
          recipientPrivateKeyJwk: keyPair.publicKeyJwk,
          expectedRecipient: recipient,
          envelope: sealTo(keyPair.publicKeyJwk),
        }),
      ).toThrowError(/missing its private component/);
    });
  });

  describe('tamper detection', () => {
    const mutate = (value: string): string => {
      const raw = Buffer.from(value, 'base64');
      raw[0] = raw[0] ^ 0xff;
      return raw.toString('base64');
    };

    it('detects a flipped ciphertext bit', () => {
      const keyPair = generateNodeEncryptionKeyPair();
      const envelope = sealTo(keyPair.publicKeyJwk);

      expect(() =>
        openSealedCredential({
          recipientPrivateKeyJwk: keyPair.privateKeyJwk,
          expectedRecipient: recipient,
          envelope: { ...envelope, ciphertext: mutate(envelope.ciphertext) },
        }),
      ).toThrowError(/could not be opened/);
    });

    it('detects a flipped auth tag bit', () => {
      const keyPair = generateNodeEncryptionKeyPair();
      const envelope = sealTo(keyPair.publicKeyJwk);

      expect(() =>
        openSealedCredential({
          recipientPrivateKeyJwk: keyPair.privateKeyJwk,
          expectedRecipient: recipient,
          envelope: { ...envelope, authTag: mutate(envelope.authTag) },
        }),
      ).toThrowError(/could not be opened/);
    });

    it('detects a swapped ephemeral public key', () => {
      const keyPair = generateNodeEncryptionKeyPair();
      const envelope = sealTo(keyPair.publicKeyJwk);
      const other = sealTo(keyPair.publicKeyJwk);

      expect(() =>
        openSealedCredential({
          recipientPrivateKeyJwk: keyPair.privateKeyJwk,
          expectedRecipient: recipient,
          envelope: {
            ...envelope,
            ephemeralPublicKeyJwk: other.ephemeralPublicKeyJwk,
          },
        }),
      ).toThrowError(/could not be opened/);
    });

    it('rejects an unsupported envelope version rather than attempting to decrypt', () => {
      const keyPair = generateNodeEncryptionKeyPair();
      const envelope = sealTo(keyPair.publicKeyJwk);

      expect(() =>
        openSealedCredential({
          recipientPrivateKeyJwk: keyPair.privateKeyJwk,
          expectedRecipient: recipient,
          envelope: { ...envelope, version: 2 as never },
        }),
      ).toThrowError(/version is unsupported/);
    });

    it('rejects an iv of the wrong length', () => {
      const keyPair = generateNodeEncryptionKeyPair();
      const envelope = sealTo(keyPair.publicKeyJwk);

      expect(() =>
        openSealedCredential({
          recipientPrivateKeyJwk: keyPair.privateKeyJwk,
          expectedRecipient: recipient,
          envelope: { ...envelope, iv: Buffer.alloc(8).toString('base64') },
        }),
      ).toThrowError(/unexpected length/);
    });
  });

  describe('input validation', () => {
    it('requires a non-empty plaintext', () => {
      const keyPair = generateNodeEncryptionKeyPair();
      expect(() => sealTo(keyPair.publicKeyJwk, recipient, '')).toThrowError(
        /plaintext is required/,
      );
    });

    it.each([
      ['workspaceId', { ...recipient, workspaceId: '' }],
      ['nodeId', { ...recipient, nodeId: '   ' }],
      ['bindingId', { ...recipient, bindingId: '' }],
    ])('requires %s on the recipient', (_label, badRecipient) => {
      const keyPair = generateNodeEncryptionKeyPair();
      expect(() =>
        sealTo(keyPair.publicKeyJwk, badRecipient as SealedCredentialRecipient),
      ).toThrowError(/is required/);
    });

    it('rejects a malformed recipient public key without leaking parse detail', () => {
      expect(() => sealTo('not-json')).toThrowError(/not valid JSON/);
    });
  });

  describe('error hygiene', () => {
    it('never includes plaintext or key material in a thrown error', () => {
      const intended = generateNodeEncryptionKeyPair();
      const attacker = generateNodeEncryptionKeyPair();
      const envelope = sealTo(intended.publicKeyJwk);

      try {
        openSealedCredential({
          recipientPrivateKeyJwk: attacker.privateKeyJwk,
          expectedRecipient: recipient,
          envelope,
        });
        throw new Error('expected open to fail');
      } catch (error) {
        const serialized = `${(error as Error).name}: ${(error as Error).message}`;
        expect(serialized).not.toContain(secret);
        expect(serialized).not.toContain(envelope.ciphertext);
        expect(serialized).not.toContain(JSON.parse(attacker.privateKeyJwk).d);
      }
    });

    it('carries a typed tag and code for callers to branch on', () => {
      try {
        sealTo('not-json');
        throw new Error('expected seal to fail');
      } catch (error) {
        expect(error).toMatchObject({
          _tag: 'NodeCredentialSealingError',
          code: 'InvalidKey',
        });
      }
    });
  });
});
