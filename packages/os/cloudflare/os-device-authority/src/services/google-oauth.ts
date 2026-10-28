import {
  GOOGLE_AUTH_URL,
  GOOGLE_SCOPE,
  GOOGLE_TOKENINFO_URL,
  GOOGLE_TOKEN_URL,
} from '../constants';

type GoogleIdentityErrorKind =
  | 'token_exchange'
  | 'identity_verification'
  | 'audience_mismatch'
  | 'nonce_mismatch'
  | 'email_not_verified';

class GoogleIdentityError extends Error {
  constructor(
    public kind: GoogleIdentityErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleIdentityError';
  }
}

export function googleConfigured(input: {
  clientId?: string;
  clientSecret?: string;
}): boolean {
  return Boolean(input.clientId?.trim() && input.clientSecret?.trim());
}

export function googleConfig(input: {
  clientId?: string;
  clientSecret?: string;
}): { clientId: string; clientSecret: string } | undefined {
  const clientId = input.clientId?.trim() ?? '';
  const clientSecret = input.clientSecret?.trim() ?? '';
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

export function redirectUri(origin: string): string {
  return new URL('/login/google/callback', origin).toString();
}

export function googleAuthRedirect(input: {
  origin: string;
  clientId: string;
  state: string;
  nonce?: string;
}): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', redirectUri(input.origin));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPE);
  url.searchParams.set('state', input.state);
  if (input.nonce) url.searchParams.set('nonce', input.nonce);
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export async function googleIdentity(input: {
  code: string;
  origin: string;
  clientId: string;
  clientSecret: string;
  fetchImpl: typeof fetch;
  redirectUri?: string;
  expectedNonce?: string;
}): Promise<{ sub: string; email: string; emailVerified: boolean }> {
  try {
    const clientId = input.clientId.trim();
    const clientSecret = input.clientSecret.trim();
    const tokenResponse = await input.fetchImpl(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: new URLSearchParams({
        code: input.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: input.redirectUri ?? redirectUri(input.origin),
        grant_type: 'authorization_code',
      }).toString(),
    });
    const tokenJson = (await tokenResponse.json()) as Record<string, unknown>;
    if (!tokenResponse.ok || typeof tokenJson.id_token !== 'string') {
      throw new GoogleIdentityError(
        'token_exchange',
        String(
          tokenJson.error ||
            tokenJson.error_description ||
            'google_token_exchange_failed',
        ),
      );
    }

    const infoUrl = new URL(GOOGLE_TOKENINFO_URL);
    infoUrl.searchParams.set('id_token', tokenJson.id_token);
    const infoResponse = await input.fetchImpl(infoUrl.toString(), {
      headers: { accept: 'application/json' },
    });
    const infoJson = (await infoResponse.json()) as Record<string, unknown>;
    if (!infoResponse.ok)
      throw new GoogleIdentityError(
        'identity_verification',
        String(
          infoJson.error_description ||
            infoJson.error ||
            'google_identity_verification_failed',
        ),
      );
    if (infoJson.aud !== clientId)
      throw new GoogleIdentityError(
        'audience_mismatch',
        'google_audience_mismatch',
      );
    if (
      input.expectedNonce &&
      infoJson.nonce !== input.expectedNonce
    ) {
      throw new GoogleIdentityError('nonce_mismatch', 'google_nonce_mismatch');
    }
    const email = typeof infoJson.email === 'string' ? infoJson.email : '';
    const sub = typeof infoJson.sub === 'string' ? infoJson.sub : '';
    const emailVerified =
      infoJson.email_verified === true || infoJson.email_verified === 'true';
    if (!sub || !email || !emailVerified)
      throw new GoogleIdentityError(
        'email_not_verified',
        'google_email_not_verified',
      );
    return { sub, email, emailVerified };
  } catch (error: unknown) {
    if (error instanceof GoogleIdentityError) throw error;
    throw new Error(
      `google identity failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function googleApprovalErrorMessage(error: unknown): string {
  if (error instanceof GoogleIdentityError) {
    if (error.kind === 'token_exchange')
      return `Google approval failed during token exchange (${error.message}). Check the Cloudflare GOOGLE_OAUTH_CLIENT_SECRET and Google redirect URI, then try this device code again.`;
    if (error.kind === 'identity_verification')
      return `Google approval failed during identity verification (${error.message}). Try again with a verified Google account.`;
    if (error.kind === 'audience_mismatch')
      return 'Google approval failed because the returned Google identity was issued for a different OAuth client.';
    if (error.kind === 'nonce_mismatch')
      return 'Google approval failed because the sign-in session could not be verified.';
    return 'Google approval failed because this Google account does not have a verified email address.';
  }
  return `Google approval failed (${error instanceof Error ? error.message : String(error)}). Try this device code again.`;
}
