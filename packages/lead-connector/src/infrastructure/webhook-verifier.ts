import { Effect, Layer } from 'effect';

import {
  LEAD_CONNECTOR_CURRENT_SIGNATURE_HEADER,
  LEAD_CONNECTOR_LEGACY_SIGNATURE_HEADER,
} from '../constants.js';
import { LeadConnectorProviderError, errorMessage } from '../errors.js';
import { LeadConnectorWebhookVerifier } from '../ports/index.js';

const toArrayBuffer = (value: Uint8Array): ArrayBuffer =>
  value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer;

const publicKeyBase64 = (value: string): string =>
  value.includes('BEGIN PUBLIC KEY')
    ? value
        .replace('-----BEGIN PUBLIC KEY-----', '')
        .replace('-----END PUBLIC KEY-----', '')
        .replace(/\s+/g, '')
    : value.replace(/\s+/g, '');

const decodeBase64 = (value: string): ArrayBuffer =>
  toArrayBuffer(Uint8Array.from(Buffer.from(publicKeyBase64(value), 'base64')));

const verifyCurrentSignature = async (input: {
  rawBody: string;
  signature: string;
  publicKey: string;
}): Promise<boolean> => {
  try {
    const key = await crypto.subtle.importKey(
      'spki',
      decodeBase64(input.publicKey),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      decodeBase64(input.signature),
      toArrayBuffer(new TextEncoder().encode(input.rawBody)),
    );
  } catch (cause: unknown) {
    throw new Error('Failed to verify the current webhook signature', {
      cause,
    });
  }
};

const verifyLegacySignature = async (input: {
  rawBody: string;
  signature: string;
  publicKey: string;
}): Promise<boolean> => {
  try {
    const algorithm = {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    };
    const key = await crypto.subtle.importKey(
      'spki',
      decodeBase64(input.publicKey),
      algorithm,
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      algorithm,
      key,
      decodeBase64(input.signature),
      toArrayBuffer(new TextEncoder().encode(input.rawBody)),
    );
  } catch (cause: unknown) {
    throw new Error('Failed to verify the legacy webhook signature', {
      cause,
    });
  }
};

export const verifyLeadConnectorWebhookSignature = async (input: {
  rawBody: string;
  currentSignature?: string;
  currentPublicKey?: string;
  legacySignature?: string;
  legacyPublicKey?: string;
}): Promise<boolean> => {
  try {
    if (input.currentSignature && input.currentPublicKey) {
      return await verifyCurrentSignature({
        rawBody: input.rawBody,
        signature: input.currentSignature,
        publicKey: input.currentPublicKey,
      });
    }
    if (input.legacySignature && input.legacyPublicKey) {
      return await verifyLegacySignature({
        rawBody: input.rawBody,
        signature: input.legacySignature,
        publicKey: input.legacyPublicKey,
      });
    }
    return false;
  } catch {
    return false;
  }
};

const normalizedHeaders = (
  headers: Record<string, string | undefined>,
): Record<string, string | undefined> =>
  Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );

export const createLeadConnectorWebhookVerifierLayer = (keys: {
  currentPublicKey?: string;
  legacyPublicKey?: string;
}) =>
  Layer.succeed(LeadConnectorWebhookVerifier, {
    verify: (input) =>
      Effect.tryPromise({
        try: async () => {
          const headers = normalizedHeaders(input.headers);
          return verifyLeadConnectorWebhookSignature({
            rawBody: input.rawBody,
            currentSignature: headers[LEAD_CONNECTOR_CURRENT_SIGNATURE_HEADER],
            currentPublicKey: keys.currentPublicKey,
            legacySignature: headers[LEAD_CONNECTOR_LEGACY_SIGNATURE_HEADER],
            legacyPublicKey: keys.legacyPublicKey,
          });
        },
        catch: (cause) =>
          new LeadConnectorProviderError({
            operation: 'verify-webhook-signature',
            message: errorMessage(cause),
            retryable: false,
            cause,
          }),
      }),
  });
