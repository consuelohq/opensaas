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

if (!accountSid || !authToken) {
  throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required');
}

export const sharedDialer = new Dialer({
  credentials: {
    accountSid,
    authToken,
  },
  baseUrl,
});

export const sharedInMemoryLockStore = new InMemoryLockStore();

export const sharedCallerIdLockService = redisUrl
  ? new CallerIdLockService(new RedisLockStore(redisUrl))
  : new CallerIdLockService(sharedInMemoryLockStore);

sharedDialer.withCallerIdLock(sharedCallerIdLockService);
