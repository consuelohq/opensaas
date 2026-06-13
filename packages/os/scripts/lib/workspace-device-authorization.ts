import { randomBytes } from 'node:crypto';

export const CONSUELO_DEVICE_VERIFICATION_URL = 'https://consuelohq.com/login/device';
export const CONSUELO_DEVICE_CODE_URL = 'https://consuelohq.com/login/device/code';
export const CONSUELO_OAUTH_ACCESS_TOKEN_URL = 'https://consuelohq.com/login/oauth/access_token';

export type WorkspaceDeviceAuthorizationSession = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresAt: string;
  intervalSeconds: number;
};

export type WorkspaceDeviceAuthorizationPollResult =
  | {
      status: 'pending' | 'slow_down';
      intervalSeconds: number;
    }
  | {
      status: 'approved';
      workspaceId: string;
      workspaceSlug: string;
      workspaceHost: string;
      connectorId: string;
      connectorBootstrapToken: string;
      connectorBootstrapExpiresAt: string;
    }
  | { status: 'denied' | 'expired'; errorCode: string };

export type WorkspaceDeviceAuthorizationStartInput = {
  clientId: string;
  scope: string[];
  verificationBaseUrl?: string;
  now?: string;
};

export type WorkspaceDeviceAuthorizationPollInput = {
  deviceCode: string;
  now?: string;
  approve?: {
    workspaceId: string;
    workspaceSlug: string;
    workspaceHost: string;
    connectorId: string;
  };
  deny?: boolean;
};

type StoredDeviceAuthorizationSession = WorkspaceDeviceAuthorizationSession & {
  clientId: string;
  scope: string[];
  createdAtMs: number;
  expiresAtMs: number;
  lastPollAtMs?: number;
};

const DEVICE_CODE_TTL_MS = 15 * 60 * 1000;
const CONNECTOR_BOOTSTRAP_TTL_MS = 10 * 60 * 1000;
const DEFAULT_INTERVAL_SECONDS = 5;
const sessions = new Map<string, StoredDeviceAuthorizationSession>();

const nowMs = (now?: string): number => {
  if (!now) return Date.now();
  const parsed = Date.parse(now);
  if (!Number.isFinite(parsed)) throw new Error('device authorization now must be an ISO timestamp');
  return parsed;
};

const randomToken = (prefix: string, byteLength: number): string =>
  `${prefix}_${randomBytes(byteLength).toString('base64url')}`;

const randomUserCode = (): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const characters = Array.from({ length: 8 }, () => {
    const index = randomBytes(1)[0] % alphabet.length;
    return alphabet[index];
  });
  return `${characters.slice(0, 4).join('')}-${characters.slice(4).join('')}`;
};

const verificationUriComplete = (baseUrl: string, userCode: string): string => {
  const url = new URL(baseUrl);
  url.searchParams.set('user_code', userCode.replaceAll('-', ''));
  return url.toString();
};

export function startWorkspaceDeviceAuthorization(
  input: WorkspaceDeviceAuthorizationStartInput,
): WorkspaceDeviceAuthorizationSession {
  const createdAtMs = nowMs(input.now);
  const expiresAtMs = createdAtMs + DEVICE_CODE_TTL_MS;
  const userCode = randomUserCode();
  const deviceCode = randomToken('dev', 24);
  const verificationBaseUrl = input.verificationBaseUrl ?? CONSUELO_DEVICE_VERIFICATION_URL;
  const session: StoredDeviceAuthorizationSession = {
    deviceCode,
    userCode,
    verificationUri: verificationBaseUrl,
    verificationUriComplete: verificationUriComplete(verificationBaseUrl, userCode),
    expiresAt: new Date(expiresAtMs).toISOString(),
    intervalSeconds: DEFAULT_INTERVAL_SECONDS,
    clientId: input.clientId,
    scope: [...input.scope],
    createdAtMs,
    expiresAtMs,
  };

  sessions.set(deviceCode, session);

  return {
    deviceCode: session.deviceCode,
    userCode: session.userCode,
    verificationUri: session.verificationUri,
    verificationUriComplete: session.verificationUriComplete,
    expiresAt: session.expiresAt,
    intervalSeconds: session.intervalSeconds,
  };
}

export function pollWorkspaceDeviceAuthorization(
  input: WorkspaceDeviceAuthorizationPollInput,
): WorkspaceDeviceAuthorizationPollResult {
  const session = sessions.get(input.deviceCode);
  const polledAtMs = nowMs(input.now);

  if (!session) {
    return { status: 'denied', errorCode: 'DEVICE_CODE_NOT_FOUND' };
  }

  if (polledAtMs >= session.expiresAtMs) {
    sessions.delete(input.deviceCode);
    return { status: 'expired', errorCode: 'DEVICE_CODE_EXPIRED' };
  }

  if (input.deny) {
    sessions.delete(input.deviceCode);
    return { status: 'denied', errorCode: 'DEVICE_CODE_DENIED' };
  }

  if (input.approve) {
    sessions.delete(input.deviceCode);
    return {
      status: 'approved',
      workspaceId: input.approve.workspaceId,
      workspaceSlug: input.approve.workspaceSlug,
      workspaceHost: input.approve.workspaceHost,
      connectorId: input.approve.connectorId,
      connectorBootstrapToken: randomToken('cbt', 32),
      connectorBootstrapExpiresAt: new Date(
        polledAtMs + CONNECTOR_BOOTSTRAP_TTL_MS,
      ).toISOString(),
    };
  }

  if (
    session.lastPollAtMs !== undefined &&
    polledAtMs - session.lastPollAtMs < session.intervalSeconds * 1000
  ) {
    return {
      status: 'slow_down',
      intervalSeconds: session.intervalSeconds + DEFAULT_INTERVAL_SECONDS,
    };
  }

  session.lastPollAtMs = polledAtMs;
  return { status: 'pending', intervalSeconds: session.intervalSeconds };
}
