import { createHmac, timingSafeEqual } from 'node:crypto';

const CLIENT_ADDRESS_HEADER = 'x-consuelo-edge-client-address';
const CLIENT_TIMESTAMP_HEADER = 'x-consuelo-edge-client-timestamp';
const CLIENT_SIGNATURE_HEADER = 'x-consuelo-edge-client-signature';
const MAX_ASSERTION_AGE_MS = 60_000;

const canonicalIdentity = (
  request: Request,
  clientAddress: string,
  issuedAt: string,
): string => {
  const url = new URL(request.url);
  return [
    'v1',
    issuedAt,
    request.method.toUpperCase(),
    url.pathname + url.search,
    clientAddress,
  ].join('\n');
};

const safeSignatureEqual = (expected: string, actual: string): boolean => {
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return (
    expectedBytes.length === actualBytes.length &&
    timingSafeEqual(expectedBytes, actualBytes)
  );
};

export const resolveTrustedClientAddress = (
  request: Request,
  socketAddress: string,
  secret: string | undefined,
  clock: () => number = Date.now,
): string | null => {
  const fallback = socketAddress.trim() || 'unknown';
  const key = secret?.trim() ?? '';
  if (!key) return fallback;
  if (key.length < 24) return null;

  const clientAddress = request.headers.get(CLIENT_ADDRESS_HEADER)?.trim() ?? '';
  const issuedAt = request.headers.get(CLIENT_TIMESTAMP_HEADER)?.trim() ?? '';
  const signature = request.headers.get(CLIENT_SIGNATURE_HEADER)?.trim() ?? '';
  if (
    !clientAddress ||
    clientAddress.length > 64 ||
    /[\s,]/.test(clientAddress) ||
    !/^\d{13}$/.test(issuedAt) ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature)
  )
    return null;

  const issuedAtMs = Number(issuedAt);
  if (!Number.isSafeInteger(issuedAtMs)) return null;
  if (Math.abs(clock() - issuedAtMs) > MAX_ASSERTION_AGE_MS) return null;

  const expected = createHmac('sha256', key)
    .update(canonicalIdentity(request, clientAddress, issuedAt))
    .digest('base64url');
  return safeSignatureEqual(expected, signature) ? clientAddress : null;
};
