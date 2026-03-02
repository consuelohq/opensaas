import {
  Dialer,
  CallerIdLockService,
  InMemoryLockStore,
  RedisLockStore,
} from '@consuelo/dialer';
import * as Sentry from '@sentry/node';
import {
  getWorkspaceTwilioConfig,
  getDecryptedCredentials,
  provisionSubAccount,
  isHostedInstance,
} from '../services/twilio-config.js';

const baseUrl = process.env.API_BASE_URL;
const redisUrl = process.env.REDIS_URL;

// legacy env-var singleton for backwards compatibility (single-tenant self-hosted)
const legacyAccountSid = process.env.TWILIO_ACCOUNT_SID ?? '';
const legacyAuthToken = process.env.TWILIO_AUTH_TOKEN ?? '';

let _lockService: CallerIdLockService | null = null;
let _inMemoryStore: InMemoryLockStore | null = null;

// per-workspace dialer cache (keyed by workspaceId)
const dialerCache = new Map<string, Dialer>();

function getCallerIdLockService(): CallerIdLockService {
  if (!_lockService) {
    _lockService = redisUrl
      ? new CallerIdLockService(new RedisLockStore(redisUrl))
      : new CallerIdLockService(getInMemoryLockStore());
  }
  return _lockService;
}

function getInMemoryLockStore(): InMemoryLockStore {
  if (!_inMemoryStore) {
    _inMemoryStore = new InMemoryLockStore();
  }
  return _inMemoryStore;
}

function buildDialer(accountSid: string, authToken: string, twimlAppSid?: string): Dialer {
  const dialer = new Dialer({
    credentials: { accountSid, authToken, twimlAppSid },
    baseUrl,
  });
  dialer.withCallerIdLock(getCallerIdLockService());
  return dialer;
}

// get a dialer for a specific workspace (multi-tenant)
export async function getDialerForWorkspace(workspaceId: string): Promise<Dialer> {
  // check cache first
  const cached = dialerCache.get(workspaceId);
  if (cached) return cached;

  try {
    const config = await getWorkspaceTwilioConfig(workspaceId);

    if (config) {
      const creds = getDecryptedCredentials(config);
      const dialer = buildDialer(creds.accountSid, creds.authToken, creds.twimlAppSid);
      dialerCache.set(workspaceId, dialer);
      return dialer;
    }

    // no config yet — auto-provision for hosted, or fall back to legacy env vars
    if (isHostedInstance()) {
      const creds = await provisionSubAccount(workspaceId);
      const dialer = buildDialer(creds.accountSid, creds.authToken, creds.twimlAppSid);
      dialerCache.set(workspaceId, dialer);
      return dialer;
    }

    // self-hosted fallback: use legacy env vars
    if (legacyAccountSid && legacyAuthToken) {
      const dialer = buildDialer(legacyAccountSid, legacyAuthToken);
      dialerCache.set(workspaceId, dialer);
      return dialer;
    }

    throw new Error('Twilio not configured. Set BYOK credentials in settings or configure TWILIO_ACCOUNT_SID env var.');
  } catch (err: unknown) {
    // don't cache failed attempts
    dialerCache.delete(workspaceId);
    Sentry.captureException(err);
    throw err;
  }
}

// invalidate cached dialer when config changes (called after settings update/delete)
export function invalidateDialerCache(workspaceId: string): void {
  dialerCache.delete(workspaceId);
}

// legacy singleton — kept for backwards compatibility with webhook routes that lack workspaceId
function ensureDialer(): Dialer {
  if (!legacyAccountSid || !legacyAuthToken) {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required');
  }
  return buildDialer(legacyAccountSid, legacyAuthToken);
}

export { ensureDialer as sharedDialer };
export { getCallerIdLockService as sharedCallerIdLockService };
export { getInMemoryLockStore as sharedInMemoryLockStore };
