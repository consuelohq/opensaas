import { Injectable, Logger } from '@nestjs/common';

import { randomUUID } from 'node:crypto';

import * as Sentry from '@sentry/node';

import { LegacyDialerService } from 'src/engine/core-modules/consuelo-api/services/legacy-dialer.service';
import { VoiceStateService } from 'src/engine/core-modules/consuelo-api/services/voice-state.service';

const FAILURE_STATUSES = new Set(['failed', 'busy', 'no-answer', 'canceled']);

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    private readonly legacyDialerService: LegacyDialerService,
    private readonly voiceStateService: VoiceStateService,
  ) {}

  async getPhoneNumbers(workspaceId: string) {
    try {
      const cached =
        await this.voiceStateService.getPhoneNumbersCache(workspaceId);

      if (cached) {
        return JSON.parse(cached) as {
          phoneNumbers: Array<Record<string, unknown>>;
        };
      }

      const dialer = this.legacyDialerService.getDialer();
      const numbers = await dialer.listNumbers();
      let primarySid: string | null = null;

      try {
        primarySid = await this.voiceStateService.getPrimaryNumber(workspaceId);
      } catch {
        primarySid = null;
      }

      const phoneNumbers = numbers.map((number) => {
        const phoneNumber = number.phoneNumber ?? '';
        const areaCode =
          phoneNumber.startsWith('+1') && phoneNumber.length >= 5
            ? phoneNumber.slice(2, 5)
            : '';

        return {
          phoneNumber,
          friendlyName: number.friendlyName ?? '',
          areaCode,
          sid: number.twilioSid ?? '',
          isPrimary: primarySid !== null && number.twilioSid === primarySid,
        };
      });

      const response = { phoneNumbers };

      await this.voiceStateService.setPhoneNumbersCache(workspaceId, response);

      return response;
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  async getVoiceToken(userId: string) {
    return this.legacyDialerService.getDialer().getToken(userId);
  }

  async getVoiceStatus(workspaceId: string) {
    const twimlAppConfigured = Boolean(process.env.TWILIO_TWIML_APP_SID);

    if (!this.legacyDialerService.isConfigured()) {
      return {
        mode: 'byok',
        configured: false,
        twilioConnected: false,
        hasPhoneNumbers: false,
        twimlAppConfigured,
        error: null,
      };
    }

    try {
      const phoneNumbers = await this.getPhoneNumbers(workspaceId);
      const hasPhoneNumbers = phoneNumbers.phoneNumbers.length > 0;

      return {
        mode: 'byok',
        configured: hasPhoneNumbers && twimlAppConfigured,
        twilioConnected: true,
        hasPhoneNumbers,
        twimlAppConfigured,
        error: null,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Status check failed';

      Sentry.captureException(err instanceof Error ? err : new Error(message));

      return {
        mode: 'byok',
        configured: false,
        twilioConnected: false,
        hasPhoneNumbers: false,
        twimlAppConfigured,
        error: message,
      };
    }
  }

  async buildTwimlResponse(body: Record<string, string | undefined>) {
    const to = body.To ?? '';
    const from = body.From ?? '';
    const callSid = body.CallSid ?? '';
    const conferenceName = `conf-${randomUUID()}`;

    await this.voiceStateService.setConferenceName(callSid, conferenceName);

    const dialer = this.legacyDialerService.getDialer();
    const twiml = dialer.generateConferenceTwiml(conferenceName, {
      participantLabel: 'agent',
      endOnExit: true,
    });

    if (from) {
      this.legacyDialerService.trackCallerId(callSid, from);
    }

    if (to && !to.startsWith('client:')) {
      const statusCallback = process.env.API_BASE_URL
        ? `${process.env.API_BASE_URL}/v1/webhooks/status`
        : undefined;

      void dialer
        .addCustomerToConference(conferenceName, to, from, statusCallback)
        .then(async ({ callSid: customerCallSid }) => {
          await this.voiceStateService.setCustomerConferenceName(
            customerCallSid,
            conferenceName,
          );
        })
        .catch((err: unknown) => {
          Sentry.captureException(err, {
            extra: {
              context: 'buildTwimlResponse.addCustomer',
              conferenceName,
              to,
            },
          });
        });
    }

    return twiml;
  }

  async getActiveCall(conferenceName: string) {
    const conferenceSid = await this.legacyDialerService
      .getDialer()
      .conference.findConferenceSid(conferenceName);

    if (conferenceSid) {
      return { active: true, conferenceSid };
    }

    return { active: false };
  }

  async getConferenceByCallSid(callSid: string) {
    const conferenceName =
      await this.voiceStateService.getConferenceName(callSid);

    if (!conferenceName) {
      return null;
    }

    return { conferenceName };
  }

  async handleStatusWebhook(body: Record<string, string | undefined>) {
    const callSid = body.CallSid;
    const callStatus = body.CallStatus;

    if (!callSid || !callStatus) {
      throw new Error('Missing CallSid or CallStatus');
    }

    const conferenceName =
      await this.voiceStateService.getCustomerConferenceName(callSid);

    if (conferenceName) {
      await this.voiceStateService.setCallStatus(conferenceName, callStatus);
    }

    if (FAILURE_STATUSES.has(callStatus) || callStatus === 'completed') {
      try {
        await this.legacyDialerService.releaseCallerId(callSid);
      } catch (err: unknown) {
        this.logger.error('Failed to release caller id', { callSid });
        Sentry.captureException(err, {
          extra: { context: 'handleStatusWebhook.releaseCallerId', callSid },
        });
      }
    }

    return { received: true };
  }

  async getCallStatusForPolling(callSid: string) {
    const conferenceName =
      await this.voiceStateService.getConferenceName(callSid);

    if (!conferenceName) {
      return null;
    }

    const status =
      (await this.voiceStateService.getCallStatus(conferenceName)) ?? 'unknown';

    return {
      callSid,
      conferenceName,
      status,
    };
  }
}
