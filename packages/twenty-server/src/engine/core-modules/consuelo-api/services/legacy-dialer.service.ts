import { Injectable } from '@nestjs/common';

import {
  Dialer,
  CallerIdLockService,
  InMemoryLockStore,
  RedisLockStore,
} from '@consuelo/dialer';

@Injectable()
export class LegacyDialerService {
  private dialer: Dialer | null = null;
  private callerIdLockService: CallerIdLockService | null = null;
  private readonly callerIdMap = new Map<string, string>();

  private getCredentials() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID ?? '';
    const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

    if (!accountSid || !authToken) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required');
    }

    return { accountSid, authToken, twimlAppSid };
  }

  getCallerIdLockService() {
    if (!this.callerIdLockService) {
      const redisUrl = process.env.REDIS_URL;

      this.callerIdLockService = redisUrl
        ? new CallerIdLockService(new RedisLockStore(redisUrl))
        : new CallerIdLockService(new InMemoryLockStore());
    }

    return this.callerIdLockService;
  }

  getDialer() {
    if (!this.dialer) {
      const credentials = this.getCredentials();

      this.dialer = new Dialer({
        credentials,
        baseUrl: process.env.API_BASE_URL,
      });
      this.dialer.withCallerIdLock(this.getCallerIdLockService());
    }

    return this.dialer;
  }

  isConfigured() {
    try {
      this.getCredentials();

      return true;
    } catch {
      return false;
    }
  }

  trackCallerId(callSid: string, callerId: string) {
    this.callerIdMap.set(callSid, callerId);
  }

  async releaseCallerId(callSid: string) {
    const callerId = this.callerIdMap.get(callSid);

    if (!callerId) {
      return;
    }

    await this.getCallerIdLockService().releaseLockByNumber(callerId);
    this.callerIdMap.delete(callSid);
  }
}
