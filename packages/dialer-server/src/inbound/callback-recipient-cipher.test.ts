import { describe, expect, it } from 'bun:test';
import { createCallbackRecipientCipher } from './callback-recipient-cipher';

describe('RD6 callback recipient cipher', () => {
  it('stores authenticated ciphertext and rejects the wrong workspace or secret', () => {
    const first = createCallbackRecipientCipher('fixture-secret-one');
    const second = createCallbackRecipientCipher('fixture-secret-two');
    const ciphertext = first.encrypt('workspace-1', '+18285550123');
    expect(ciphertext).not.toContain('+18285550123');
    expect(first.decrypt('workspace-1', ciphertext)).toBe('+18285550123');
    expect(() => first.decrypt('workspace-2', ciphertext)).toThrow();
    expect(() => second.decrypt('workspace-1', ciphertext)).toThrow();
  });
});
