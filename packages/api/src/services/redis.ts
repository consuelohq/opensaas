import IORedis from 'ioredis';
import * as Sentry from '@sentry/node';

const CONFERENCE_TTL_SECONDS = 3600; // 1 hour
const PKCE_TTL_SECONDS = 600; // 10 minutes
const PHONE_NUMBERS_TTL_SECONDS = 300; // 5 minutes

class RedisService {
  private client: IORedis | null = null;

  async getClient(): Promise<IORedis> {
    try {
      if (!this.client) {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
          throw new Error('REDIS_URL not configured');
        }
        this.client = new IORedis(redisUrl, {
          retryStrategy: (times) => Math.min(times * 50, 2000),
          maxRetriesPerRequest: 3,
        });
      }
      return this.client;
    } catch (err: unknown) {
      this.client = null;
      Sentry.captureException(err, { extra: { context: 'RedisService.getClient' } });
      throw err;
    }
  }

  async getConferenceName(callSid: string): Promise<string | null> {
    try {
      const client = await this.getClient();
      return await client.get(`conference:${callSid}`);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'getConferenceName', callSid } });
      throw err;
    }
  }

  async setConferenceName(callSid: string, name: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.setex(`conference:${callSid}`, CONFERENCE_TTL_SECONDS, name);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'setConferenceName', callSid } });
      throw err;
    }
  }

  async deleteConferenceName(callSid: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.del(`conference:${callSid}`);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'deleteConferenceName', callSid } });
      throw err;
    }
  }

  async getCustomerConferenceName(customerCallSid: string): Promise<string | null> {
    try {
      const client = await this.getClient();
      return await client.get(`customer:${customerCallSid}`);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'getCustomerConferenceName', customerCallSid } });
      throw err;
    }
  }

  async setCustomerConferenceName(customerCallSid: string, name: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.setex(`customer:${customerCallSid}`, CONFERENCE_TTL_SECONDS, name);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'setCustomerConferenceName', customerCallSid } });
      throw err;
    }
  }

  async deleteCustomerConferenceName(customerCallSid: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.del(`customer:${customerCallSid}`);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'deleteCustomerConferenceName', customerCallSid } });
      throw err;
    }
  }

  async getCallStatus(conferenceName: string): Promise<string | null> {
    try {
      const client = await this.getClient();
      return await client.get(`status:${conferenceName}`);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'getCallStatus', conferenceName } });
      throw err;
    }
  }

  async setCallStatus(conferenceName: string, status: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.setex(`status:${conferenceName}`, CONFERENCE_TTL_SECONDS, status);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'setCallStatus', conferenceName } });
      throw err;
    }
  }

  async deleteCallStatus(conferenceName: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.del(`status:${conferenceName}`);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'deleteCallStatus', conferenceName } });
      throw err;
    }
  }

  async getTransfer(transferId: string): Promise<Record<string, unknown> | null> {
    try {
      const client = await this.getClient();
      const result = await client.get(`transfer:${transferId}`);
      if (!result) return null;
      return JSON.parse(result) as Record<string, unknown>;
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'getTransfer', transferId } });
      throw err;
    }
  }

  async setTransfer(transferId: string, data: Record<string, unknown>): Promise<void> {
    try {
      const client = await this.getClient();
      await client.setex(`transfer:${transferId}`, CONFERENCE_TTL_SECONDS, JSON.stringify(data));
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'setTransfer', transferId } });
      throw err;
    }
  }

  async deleteTransfer(transferId: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.del(`transfer:${transferId}`);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'deleteTransfer', transferId } });
      throw err;
    }
  }

  async setPkceVerifier(state: string, data: { codeVerifier: string; workspaceId: string }): Promise<void> {
    try {
      const client = await this.getClient();
      await client.setex(`ghl:pkce:${state}`, PKCE_TTL_SECONDS, JSON.stringify(data));
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'setPkceVerifier', state } });
      throw err;
    }
  }

  async getPkceVerifier(state: string): Promise<{ codeVerifier: string; workspaceId: string } | null> {
    try {
      const client = await this.getClient();
      const result = await client.get(`ghl:pkce:${state}`);
      if (!result) return null;
      return JSON.parse(result) as { codeVerifier: string; workspaceId: string };
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'getPkceVerifier', state } });
      throw err;
    }
  }

  async deletePkceVerifier(state: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.del(`ghl:pkce:${state}`);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'deletePkceVerifier', state } });
      throw err;
    }
  }

  async getPrimaryNumber(workspaceId: string): Promise<string | null> {
    try {
      const client = await this.getClient();
      return await client.get(`primary-number:${workspaceId}`);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'getPrimaryNumber', workspaceId } });
      throw err;
    }
  }

  async setPrimaryNumber(workspaceId: string, phoneNumberSid: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.set(`primary-number:${workspaceId}`, phoneNumberSid);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'setPrimaryNumber', workspaceId } });
      throw err;
    }
  }

  async deletePrimaryNumber(workspaceId: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.del(`primary-number:${workspaceId}`);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'deletePrimaryNumber', workspaceId } });
      throw err;
    }
  }

  // --- phone-based dialer infrastructure (DEV-1123) ---

  async getRepPhone(userId: string): Promise<string | null> {
    try {
      const client = await this.getClient();
      return await client.get(`consuelo:user:${userId}:phone`);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'getRepPhone', userId } });
      throw err;
    }
  }

  async setRepPhone(userId: string, phone: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.set(`consuelo:user:${userId}:phone`, phone);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'setRepPhone', userId } });
      throw err;
    }
  }

  async setPhoneCallState(callId: string, state: Record<string, unknown>): Promise<void> {
    try {
      const client = await this.getClient();
      await client.setex(`phone-call:${callId}`, CONFERENCE_TTL_SECONDS, JSON.stringify(state));
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'setPhoneCallState', callId } });
      throw err;
    }
  }

  async getPhoneCallState(callId: string): Promise<Record<string, unknown> | null> {
    try {
      const client = await this.getClient();
      const result = await client.get(`phone-call:${callId}`);
      if (!result) return null;
      return JSON.parse(result) as Record<string, unknown>;
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'getPhoneCallState', callId } });
      throw err;
    }
  }

  async deletePhoneCallState(callId: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.del(`phone-call:${callId}`);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'deletePhoneCallState', callId } });
      throw err;
    }
  }

  async mapCallSidToCallId(callSid: string, callId: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.setex(`phone-call-sid:${callSid}`, CONFERENCE_TTL_SECONDS, callId);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'mapCallSidToCallId', callSid } });
      throw err;
    }
  }

  async getCallIdByCallSid(callSid: string): Promise<string | null> {
    try {
      const client = await this.getClient();
      return await client.get(`phone-call-sid:${callSid}`);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'getCallIdByCallSid', callSid } });
      throw err;
    }
  }

  async publishCallEvent(event: Record<string, unknown>): Promise<void> {
    try {
      const client = await this.getClient();
      await client.publish('consuelo:call-events', JSON.stringify(event));
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'publishCallEvent' } });
      throw err;
    }
  }

  // -- phone numbers cache --

  async getPhoneNumbersCache(workspaceId: string): Promise<string | null> {
    try {
      const client = await this.getClient();
      return await client.get(`phone-numbers:${workspaceId}`);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'getPhoneNumbersCache', workspaceId } });
      return null;
    }
  }

  async setPhoneNumbersCache(workspaceId: string, data: unknown): Promise<void> {
    try {
      const client = await this.getClient();
      await client.setex(
        `phone-numbers:${workspaceId}`,
        PHONE_NUMBERS_TTL_SECONDS,
        JSON.stringify(data),
      );
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'setPhoneNumbersCache', workspaceId } });
    }
  }

  async invalidatePhoneNumbersCache(workspaceId: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.del(`phone-numbers:${workspaceId}`);
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { context: 'invalidatePhoneNumbersCache', workspaceId } });
    }
  }

}

export const redisService = new RedisService();
