import type { Context } from 'hono';

import type {
  DialerServerDependencies,
  TwilioSignatureInput,
} from '../contracts';
import { invalidRequestResponse } from '../errors';

const firstForwardedValue = (
  value: string | undefined,
  fallback: string,
): string => value?.split(',')[0]?.trim() || fallback;

const externalUrl = (request: Request): string => {
  const internal = new URL(request.url);
  const protocol = firstForwardedValue(
    request.headers.get('x-forwarded-proto') ?? undefined,
    'https',
  );
  const host = firstForwardedValue(
    request.headers.get('x-forwarded-host') ?? undefined,
    request.headers.get('host') ?? internal.host,
  );
  return `${protocol}://${host}${internal.pathname}${internal.search}`;
};

const parseRecord = (
  rawBody: string,
  contentType: string,
): Record<string, string> => {
  if (contentType.toLowerCase().includes('application/json')) {
    const parsed: unknown = JSON.parse(rawBody || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('JSON body must be an object');
    }
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [
        key,
        value == null ? '' : String(value),
      ]),
    );
  }
  return Object.fromEntries(new URLSearchParams(rawBody));
};

export type VerifiedTwilioRequest = { params: Record<string, string> };

export async function verifyAndParseTwilioRequest(
  context: Context,
  dependencies: Pick<DialerServerDependencies, 'verifyTwilioSignature'>,
): Promise<VerifiedTwilioRequest | Response> {
  const signature = firstForwardedValue(
    context.req.header('x-twilio-signature'),
    '',
  );
  if (!signature) {
    return context.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing Twilio signature',
          retryable: false,
        },
      },
      401,
    );
  }
  const contentType = context.req.header('content-type') ?? '';
  const rawBody = await context.req.text();
  let params: Record<string, string>;
  try {
    params = parseRecord(rawBody, contentType);
  } catch {
    return invalidRequestResponse(context, 'Invalid callback body');
  }
  const input: TwilioSignatureInput = {
    signature,
    url: externalUrl(context.req.raw),
    contentType,
    rawBody,
    params,
  };
  const valid = await dependencies.verifyTwilioSignature(input);
  if (!valid) {
    return context.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid Twilio signature',
          retryable: false,
        },
      },
      401,
    );
  }
  return { params };
}
