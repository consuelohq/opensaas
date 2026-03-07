import type { DialerProvider } from './base.js';
import type {
  TwilioCredentials,
  DialOptions,
  DialResult,
  HangupResult,
  VoiceToken,
  ProvisionNumberOptions,
  ProvisionResult,
  PhoneNumber,
  SearchAvailableNumbersOptions,
  AvailableNumber,
  ReleaseResult,
} from '../types.js';
import { extractAreaCode } from '../services/local-presence.js';
import type TwilioClient from 'twilio';
import type { IncomingPhoneNumberInstance } from 'twilio/lib/rest/api/v2010/account/incomingPhoneNumber.js';
import * as Sentry from '@sentry/node';

const TERMINAL_STATUSES = [
  'completed',
  'failed',
  'busy',
  'no-answer',
  'canceled',
];

/**
 * Twilio implementation of the DialerProvider.
 *
 * Requires the `twilio` package as a peer dependency.
 * Credentials can be passed directly or read from env vars:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_API_KEY,
 *   TWILIO_API_SECRET, TWILIO_TWIML_APP_SID
 */
export class TwilioProvider implements DialerProvider {
  readonly name = 'twilio';
  private client: ReturnType<typeof TwilioClient> | null = null;
  private credentials: TwilioCredentials;

  constructor(credentials?: TwilioCredentials) {
    this.credentials = {
      accountSid:
        credentials?.accountSid ?? process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: credentials?.authToken ?? process.env.TWILIO_AUTH_TOKEN ?? '',
      apiKey: credentials?.apiKey ?? process.env.TWILIO_API_KEY,
      apiSecret: credentials?.apiSecret ?? process.env.TWILIO_API_SECRET,
      twimlAppSid: credentials?.twimlAppSid ?? process.env.TWILIO_TWIML_APP_SID,
    };
  }

  private async getClient(): Promise<ReturnType<typeof TwilioClient>> {
    try {
      if (this.client) return this.client;
      if (!this.credentials.accountSid || !this.credentials.authToken) {
        throw new Error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.');
      }
      const twilio = await import('twilio');
      this.client = twilio.default(
        this.credentials.accountSid,
        this.credentials.authToken,
      );
      return this.client;
    } catch (err: unknown) {
      this.client = null;
      throw err;
    }
  }

  async dial(options: DialOptions): Promise<DialResult> {
    try {
      const client = await this.getClient();
      const fromNumber = options.callerIdNumber ?? options.from;

      const call = await client.calls.create({
        to: options.from, // call the agent first (3-way pattern)
        from: fromNumber,
        url: options.statusCallbackUrl
          ? `${options.statusCallbackUrl}?customer_number=${encodeURIComponent(options.to)}&user_id=${encodeURIComponent(options.userId)}`
          : undefined,
        statusCallback: options.statusCallbackUrl,
        statusCallbackEvent: ['completed'],
        statusCallbackMethod: 'POST',
      });

      return {
        success: true,
        callSid: call.sid,
        fromNumber,
        selectionMethod: options.callerIdNumber ? 'manual' : 'system_default',
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  async hangup(callSid: string): Promise<HangupResult> {
    try {
      const client = await this.getClient();
      await client.calls(callSid).update({ status: 'completed' });
      return { success: true, callSid };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, callSid, error: message };
    }
  }

  async getToken(userId: string): Promise<VoiceToken> {
    try {
      const { apiKey, apiSecret, twimlAppSid, accountSid } = this.credentials;

      const missing: string[] = [];
      if (!apiKey) missing.push('TWILIO_API_KEY');
      if (!apiSecret) missing.push('TWILIO_API_SECRET');
      if (!twimlAppSid) missing.push('TWILIO_TWIML_APP_SID');

      if (missing.length > 0) {
        throw new Error(
          `Missing required Twilio credentials for voice tokens: ${missing.join(', ')}`,
        );
      }

      const twilio = await import('twilio');
      const { AccessToken } = twilio.default.jwt;
      const { VoiceGrant } = AccessToken;

      const identity = `user_${userId}`;
      const ttl = 3600;

      const token = new AccessToken(accountSid!, apiKey!, apiSecret!, {
        identity,
        ttl,
      });
      const grant = new VoiceGrant({
        outgoingApplicationSid: twimlAppSid,
        incomingAllow: true,
      });
      token.addGrant(grant);

      return { token: token.toJwt(), identity, ttl };
    } catch (err: unknown) {
      Sentry.captureException(err, {
        extra: {
          hasApiKey: !!this.credentials.apiKey,
          hasApiSecret: !!this.credentials.apiSecret,
          hasTwimlAppSid: !!this.credentials.twimlAppSid,
          accountSidPrefix: this.credentials.accountSid?.slice(0, 2),
        },
      });
      throw err;
    }
  }

  async provisionNumber(
    options: ProvisionNumberOptions,
  ): Promise<ProvisionResult> {
    try {
      const client = await this.getClient();

      if (options.phoneNumber) {
        // provision a specific number
        const number = await client.incomingPhoneNumbers.create({
          phoneNumber: options.phoneNumber,
          friendlyName: options.friendlyName ?? 'Consuelo Number',
          voiceUrl: options.voiceUrl,
          voiceMethod: 'POST',
          smsUrl: options.smsUrl,
          smsMethod: 'POST',
        });
        return {
          success: true,
          phoneNumber: number.phoneNumber,
          sid: number.sid,
          areaCode: options.areaCode,
        };
      }

      // search by area code then provision first available
      const available = await client.availablePhoneNumbers('US').local.list({
        areaCode: Number(options.areaCode),
        limit: 1,
      });

      if (!available.length) {
        return {
          success: false,
          error: `No numbers available for area code ${options.areaCode}`,
        };
      }

      const number = await client.incomingPhoneNumbers.create({
        phoneNumber: available[0].phoneNumber,
        friendlyName: options.friendlyName ?? 'Consuelo Number',
        voiceUrl: options.voiceUrl,
        voiceMethod: 'POST',
        smsUrl: options.smsUrl,
        smsMethod: 'POST',
      });

      return {
        success: true,
        phoneNumber: number.phoneNumber,
        sid: number.sid,
        areaCode: options.areaCode,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  async isCallCompleted(callSid: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      const call = await client.calls(callSid).fetch();
      return TERMINAL_STATUSES.includes(call.status);
    } catch {
      return true; // if we can't fetch it, treat as completed
    }
  }

  async listNumbers(): Promise<PhoneNumber[]> {
    try {
      const client = await this.getClient();
      const numbers = await client.incomingPhoneNumbers.list();
      return numbers.map((n: IncomingPhoneNumberInstance) => {
        const areaCode = extractAreaCode(n.phoneNumber);
        return {
          phoneNumber: n.phoneNumber,
          areaCode: areaCode ?? '',
          isPrimary: false,
          isActive: true,
          friendlyName: n.friendlyName,
          twilioSid: n.sid,
        };
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to list numbers: ${message}`);
    }
  }

  async searchAvailableNumbers(
    options: SearchAvailableNumbersOptions,
  ): Promise<AvailableNumber[]> {
    try {
      const client = await this.getClient();
      const country = options.country ?? 'US';
      const limit = options.limit ?? 10;
      const available = await client.availablePhoneNumbers(country).local.list({
        areaCode: Number(options.areaCode),
        limit,
      });
      return available.map((n) => ({
        phoneNumber: n.phoneNumber,
        areaCode: options.areaCode,
        friendlyName: n.friendlyName,
        city: n.locality ?? undefined,
        state: n.region ?? undefined,
        region: n.rateCenter ?? undefined,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to search available numbers: ${message}`);
    }
  }

  async releaseNumber(sid: string): Promise<ReleaseResult> {
    try {
      const client = await this.getClient();
      await client.incomingPhoneNumbers(sid).remove();
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}
