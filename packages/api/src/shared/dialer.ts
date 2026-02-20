import {
  Dialer,
  CallerIdLockService,
  InMemoryLockStore,
  RedisLockStore,
} from '@consuelo/dialer';

const accountSid = process.env.TWILIO_ACCOUNT_SID ?? '';
const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
const baseUrl = process.env.API_BASE_URL;
const redisUrl = process.env.REDIS_URL;

let _dialer: Dialer | null = null;
let _lockService: CallerIdLockService | null = null;
let _inMemoryStore: InMemoryLockStore | null = null;

function ensureDialer(): Dialer {
  if (!_dialer) {
    if (!accountSid || !authToken) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required');
    }
    _dialer = new Dialer({ credentials: { accountSid, authToken }, baseUrl });
    _dialer.withCallerIdLock(getCallerIdLockService());
  }
  return _dialer;
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

export { ensureDialer as sharedDialer };
export { getCallerIdLockService as sharedCallerIdLockService };
export { getInMemoryLockStore as sharedInMemoryLockStore };
