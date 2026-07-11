import {
  ALLOWED_AUTH_METHOD_SET,
  AUTH_ASSERTION_HEADER,
  REJECTED_AUTH_METHODS,
} from '../constants';
import type { Grant, StrongerAuthMethod } from '../types';
import {
  b64Decode,
  expectedDeviceProofPayload,
  hmac,
  stringField,
} from '../utils';

export async function approvalAuth(
  request: Request,
  secret: string | undefined,
  nowMs: number,
): Promise<
  | { status: 'missing' }
  | { status: 'weak'; method: string }
  | { status: 'allowed'; accountId: string; method: StrongerAuthMethod }
> {
  try {
    const assertion = request.headers.get(AUTH_ASSERTION_HEADER)?.trim() ?? '';
    if (!secret || !assertion) return { status: 'missing' };
    const [payload, signature] = assertion.split('.');
    if (!payload || !signature) return { status: 'missing' };
    const expected = await hmac(secret, payload);
    if (signature !== expected) return { status: 'missing' };
    const parsed = JSON.parse(
      new TextDecoder().decode(b64Decode(payload)),
    ) as Record<string, unknown>;
    const accountId = stringField(parsed, 'account_id').trim();
    const method = stringField(parsed, 'auth_method').trim().toLowerCase();
    const expiresAt = Date.parse(stringField(parsed, 'expires_at'));
    if (
      !accountId ||
      !method ||
      !Number.isFinite(expiresAt) ||
      nowMs >= expiresAt
    )
      return { status: 'missing' };
    if (
      REJECTED_AUTH_METHODS.has(method) ||
      !ALLOWED_AUTH_METHOD_SET.has(method)
    )
      return { status: 'weak', method };
    return {
      status: 'allowed',
      accountId,
      method: method as StrongerAuthMethod,
    };
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('approval authentication failed');
  }
}

export async function verifyDevicePublicKeyProof(
  g: Grant,
  input: {
    clientId: string;
    deviceCode: string;
    proofPayload: string;
    proof: string;
  },
): Promise<boolean> {
  try {
    const expectedPayload = expectedDeviceProofPayload({
      clientId: input.clientId,
      deviceCode: input.deviceCode,
      devicePublicKeyThumbprint: g.devicePublicKeyThumbprint,
    });
    if (input.proofPayload !== expectedPayload || !input.proof) return false;
    const key = await crypto.subtle.importKey(
      'jwk',
      JSON.parse(g.devicePublicKeyJwk),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      b64Decode(input.proof),
      new TextEncoder().encode(input.proofPayload),
    );
  } catch {
    return false;
  }
}
