import { Inject, Injectable, Logger } from '@nestjs/common';

import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';

const CONFERENCE_TTL_SECONDS = 3600;

@Injectable()
export class VoiceStateService {
  private readonly logger = new Logger(VoiceStateService.name);

  constructor(
    @Inject(RedisClientService)
    private readonly redisClientService: RedisClientService,
  ) {}

  private getClient() {
    return this.redisClientService.getClient();
  }

  async getConferenceName(callSid: string): Promise<string | null> {
    try {
      const client = this.getClient();

      return await client.get(`conference:${callSid}`);
    } catch (err: unknown) {
      this.logger.error('getConferenceName failed', { callSid });
      throw err;
    }
  }

  async setConferenceName(callSid: string, conferenceName: string) {
    try {
      const client = this.getClient();

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
      const client = this.getClient();

      return await client.get(`customer:${callSid}`);
    } catch (err: unknown) {
      this.logger.error('getCustomerConferenceName failed', { callSid });
      throw err;
    }
  }

  async setCustomerConferenceName(callSid: string, conferenceName: string) {
    try {
      const client = this.getClient();

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
      const client = this.getClient();

      return await client.get(`status:${conferenceName}`);
    } catch (err: unknown) {
      this.logger.error('getCallStatus failed', { conferenceName });
      throw err;
    }
  }

  async setCallStatus(conferenceName: string, callStatus: string) {
    try {
      const client = this.getClient();

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
      const client = this.getClient();

      return await client.get(`primary-number:${workspaceId}`);
    } catch (err: unknown) {
      this.logger.error('getPrimaryNumber failed', { workspaceId });
      throw err;
    }
  }

  async getPhoneNumbersCache(workspaceId: string): Promise<string | null> {
    try {
      const client = this.getClient();

      return await client.get(`phone-numbers:${workspaceId}`);
    } catch {
      this.logger.error('getPhoneNumbersCache failed', { workspaceId });

      return null;
    }
  }

  async setPhoneNumbersCache(workspaceId: string, data: unknown) {
    try {
      const client = this.getClient();

      await client.set(`phone-numbers:${workspaceId}`, JSON.stringify(data));
    } catch (err: unknown) {
      this.logger.error('setPhoneNumbersCache failed', { workspaceId });
      throw err;
    }
  }
}
