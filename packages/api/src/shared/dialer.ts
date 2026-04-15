import {
  Dialer,
  CallerIdLockService,
  InMemoryLockStore,
  LocalPresenceService,
  RedisLockStore,
} from '@consuelo/dialer';
import * as Sentry from '@sentry/node';
import {
  getWorkspaceTwilioConfig,
  getDecryptedCredentials,
  provisionSubAccount,
  isHostedInstance,
  ensureOrCreateTwimlApp,
} from '../services/twilio-config.js';
import { getSharedPool } from './db.js';

// lazy logger to satisfy @nx/enforce-module-boundaries (peer dep)
let _dialerLogger: {
  info: (message: string, attributes?: Record<string, unknown>) => void;
  warn: (message: string, attributes?: Record<string, unknown>) => void;
  error: (message: string, attributes?: Record<string, unknown>) => void;
} | null = null;
const getLogger = async () => {
  try {
    if (!_dialerLogger) {
      const { createLogger } = await import('@consuelo/logger');
      _dialerLogger = createLogger('dialer:self-hosted');
    }
    return _dialerLogger!;
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

const baseUrl = process.env.API_BASE_URL;
const redisUrl = process.env.REDIS_URL;

// legacy env-var singleton for backwards compatibility (single-tenant self-hosted)
const legacyAccountSid = process.env.TWILIO_ACCOUNT_SID ?? '';
const legacyAuthToken = process.env.TWILIO_AUTH_TOKEN ?? '';

let _lockService: CallerIdLockService | null = null;
let _inMemoryStore: InMemoryLockStore | null = null;

// per-workspace dialer cache (keyed by workspaceId)
const dialerCache = new Map<string, Dialer>();

type AreaCodeLocation = {
  latitude: number;
  longitude: number;
};

const SQL_GET_AREA_CODE_LOCATIONS = `
  SELECT
    area_code,
    latitude::float8 AS latitude,
    longitude::float8 AS longitude
  FROM area_code_locations
  WHERE area_code = ANY($1::text[])
`;

const areaCodeLocationCache = new Map<string, AreaCodeLocation | null>();

function haversineMiles(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMiles = 3958.7613;
  const dLat = toRadians(latitudeB - latitudeA);
  const dLon = toRadians(longitudeB - longitudeA);
  const lat1 = toRadians(latitudeA);
  const lat2 = toRadians(latitudeB);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMiles * c;
}

async function loadAreaCodeLocations(areaCodes: string[]): Promise<void> {
  const uncachedAreaCodes = Array.from(
    new Set(
      areaCodes.filter(
        (areaCode) =>
          areaCode.trim().length > 0 && !areaCodeLocationCache.has(areaCode),
      ),
    ),
  );

  if (uncachedAreaCodes.length === 0) {
    return;
  }

  const pool = await getSharedPool();
  const { rows } = await pool.query<{
    area_code: string;
    latitude: number;
    longitude: number;
  }>(SQL_GET_AREA_CODE_LOCATIONS, [uncachedAreaCodes]);

  const foundAreaCodes = new Set<string>();

  for (const row of rows) {
    foundAreaCodes.add(row.area_code);
    areaCodeLocationCache.set(row.area_code, {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    });
  }

  for (const areaCode of uncachedAreaCodes) {
    if (!foundAreaCodes.has(areaCode)) {
      areaCodeLocationCache.set(areaCode, null);
    }
  }
}

async function getAreaCodeDistanceMiles(
  areaCodeA: string,
  areaCodeB: string,
): Promise<number | null> {
  if (!areaCodeA || !areaCodeB) {
    return null;
  }

  await loadAreaCodeLocations([areaCodeA, areaCodeB]);

  const locationA = areaCodeLocationCache.get(areaCodeA) ?? null;
  const locationB = areaCodeLocationCache.get(areaCodeB) ?? null;

  if (locationA === null || locationB === null) {
    return null;
  }

  return haversineMiles(
    locationA.latitude,
    locationA.longitude,
    locationB.latitude,
    locationB.longitude,
  );
}

function buildLocalPresenceService(): LocalPresenceService {
  return new LocalPresenceService({
    maxDistanceMiles: 100,
    distanceFn: getAreaCodeDistanceMiles,
  });
}

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

function buildDialer(
  accountSid: string,
  authToken: string,
  twimlAppSid?: string,
): Dialer {
  const dialer = new Dialer({
    credentials: { accountSid, authToken, twimlAppSid },
    baseUrl,
  });
  dialer.withCallerIdLock(getCallerIdLockService());
  dialer.withLocalPresence(buildLocalPresenceService());
  return dialer;
}

// get a dialer for a specific workspace (multi-tenant)
export async function getDialerForWorkspace(
  workspaceId: string,
): Promise<Dialer> {
  // check cache first
  const cached = dialerCache.get(workspaceId);
  if (cached) return cached;

  try {
    const config = await getWorkspaceTwilioConfig(workspaceId);

    if (config) {
      const creds = getDecryptedCredentials(config);
      const dialer = buildDialer(
        creds.accountSid,
        creds.authToken,
        creds.twimlAppSid,
      );
      dialerCache.set(workspaceId, dialer);
      return dialer;
    }

    // no config yet — auto-provision for hosted, or fall back to legacy env vars
    if (isHostedInstance()) {
      const creds = await provisionSubAccount(workspaceId);
      const dialer = buildDialer(
        creds.accountSid,
        creds.authToken,
        creds.twimlAppSid,
      );
      dialerCache.set(workspaceId, dialer);
      return dialer;
    }

    // self-hosted fallback: use legacy env vars
    if (legacyAccountSid && legacyAuthToken) {
      let twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

      // auto-create TwiML App if not configured and API_BASE_URL is set
      if (!twimlAppSid && baseUrl) {
        try {
          twimlAppSid = await ensureOrCreateTwimlApp(
            legacyAccountSid,
            legacyAuthToken,
          );
          (await getLogger()).info('TwiML App auto-created for self-hosted', {
            twimlAppSid,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'unknown error';
          (await getLogger()).warn(
            'TwiML App auto-creation failed — set TWILIO_TWIML_APP_SID manually',
            { error: message },
          );
        }
      }

      const dialer = buildDialer(
        legacyAccountSid,
        legacyAuthToken,
        twimlAppSid,
      );
      dialerCache.set(workspaceId, dialer);
      return dialer;
    }

    throw new Error(
      'Twilio not configured. Set BYOK credentials in settings or configure TWILIO_ACCOUNT_SID env var.',
    );
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
