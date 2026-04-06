import { Injectable, Logger } from '@nestjs/common';

import * as Sentry from '@sentry/node';
import IORedis from 'ioredis';

const CONFERENCE_TTL_SECONDS = 3600;

@Injectable()
export class VoiceStateService {
  private readonly logger = new Logger(VoiceStateService.name);
  private client: IORedis | null = null;

  private async getClient(): Promise<IORedis> {
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
      Sentry.captureException(err, {
        extra: { context: 'VoiceStateService.getClient' },
      });
      throw err;
    }
  }

  async getConferenceName(callSid: string): Promise<string | null> {
    try {
      const client = await this.getClient();

      return await client.get(`conference:${callSid}`);
    } catch (err: unknown) {
      this.logger.error('getConferenceName failed', { callSid });
      throw err;
    }
  }

  async setConferenceName(callSid: string, conferenceName: string) {
    try {
      const client = await this.getClient();

      await client.setex(
        `conference:${callSid}`,
        CONFERENCE_TTL_SECONDS,
        conferenceName,
      );
    } catch (err: unknown) {
      this.logger.error('setConferenceName failed', { callSid });
      throw err;
    }
  }

  async getCustomerConferenceName(callSid: string): Promise<string | null> {
    try {
      const client = await this.getClient();

      return await client.get(`customer:${callSid}`);
    } catch (err: unknown) {
      this.logger.error('getCustomerConferenceName failed', { callSid });
      throw err;
    }
  }

  async setCustomerConferenceName(callSid: string, conferenceName: string) {
    try {
      const client = await this.getClient();

      await client.setex(
        `customer:${callSid}`,
        CONFERENCE_TTL_SECONDS,
        conferenceName,
      );
    } catch (err: unknown) {
      this.logger.error('setCustomerConferenceName failed', { callSid });
      throw err;
    }
  }

  async getCallStatus(conferenceName: string): Promise<string | null> {
    try {
      const client = await this.getClient();

      return await client.get(`status:${conferenceName}`);
    } catch (err: unknown) {
      this.logger.error('getCallStatus failed', { conferenceName });
      throw err;
    }
  }

  async setCallStatus(conferenceName: string, callStatus: string) {
    try {
      const client = await this.getClient();

      await client.setex(
        `status:${conferenceName}`,
        CONFERENCE_TTL_SECONDS,
        callStatus,
      );
    } catch (err: unknown) {
      this.logger.error('setCallStatus failed', { conferenceName });
      throw err;
    }
  }

  async getPrimaryNumber(workspaceId: string): Promise<string | null> {
    try {
      const client = await this.getClient();

      return await client.get(`primary-number:${workspaceId}`);
    } catch (err: unknown) {
      this.logger.error('getPrimaryNumber failed', { workspaceId });
      throw err;
    }
  }

  async getPhoneNumbersCache(workspaceId: string): Promise<string | null> {
    try {
      const client = await this.getClient();

      return await client.get(`phone-numbers:${workspaceId}`);
    } catch {
      this.logger.error('getPhoneNumbersCache failed', { workspaceId });

      return null;
    }
  }

  async setPhoneNumbersCache(workspaceId: string, data: unknown) {
    try {
      const client = await this.getClient();

      await client.set(`phone-numbers:${workspaceId}`, JSON.stringify(data));
    } catch (err: unknown) {
      this.logger.error('setPhoneNumbersCache failed', { workspaceId });
      throw err;
    }
  }
}
