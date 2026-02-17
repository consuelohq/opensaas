import IORedis from 'ioredis';
import * as Sentry from '@sentry/node';

const CONFERENCE_TTL_SECONDS = 3600; // 1 hour

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
}

export const redisService = new RedisService();
