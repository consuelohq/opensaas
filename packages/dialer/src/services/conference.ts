import * as Sentry from '@sentry/node';

import type {
  TwilioCredentials,
  ConferenceParticipant,
  TransferOptions,
  TransferResult,
} from '../types.js';
import type TwilioClient from 'twilio';

const escapeXml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * Conference + transfer orchestration via Twilio REST API.
 *
 * All calls go through conferences (even 1-on-1) so transfers
 * can add/remove participants without dropping audio.
 */
export class ConferenceService {
  private client: ReturnType<typeof TwilioClient> | null = null;
  private credentials: TwilioCredentials;
  private ringingStartTimes = new Map<string, number>();

  constructor(credentials?: TwilioCredentials) {
    this.credentials = {
      accountSid:
        credentials?.accountSid ?? process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: credentials?.authToken ?? process.env.TWILIO_AUTH_TOKEN ?? '',
    };
  }

  private async getClient(): Promise<ReturnType<typeof TwilioClient>> {
    if (this.client) return this.client;
    if (!this.credentials.accountSid || !this.credentials.authToken) {
      throw new Error(
        'Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.',
      );
    }
    try {
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

  /** Generate conference TwiML for the agent's browser connection */
  generateConferenceTwiml(
    conferenceName: string,
    opts?: {
      startOnEnter?: boolean;
      endOnExit?: boolean;
      waitUrl?: string;
      participantLabel?: string;
      streamUrl?: string;
      streamParameters?: Record<string, string>;
      streamTrack?: 'inbound_track' | 'outbound_track' | 'both_tracks';
    },
  ): string {
    const startOnEnter = opts?.startOnEnter ?? true;
    const endOnExit = opts?.endOnExit ?? false;
    const waitUrl = opts?.waitUrl ? escapeXml(opts.waitUrl) : '';
    const label = opts?.participantLabel
      ? ` participantLabel="${escapeXml(opts.participantLabel)}"`
      : '';
    const streamTrack = opts?.streamTrack ?? 'both_tracks';
    const streamBlock = opts?.streamUrl
      ? [
          '<Start>',
          `<Stream url="${escapeXml(opts.streamUrl)}" track="${escapeXml(streamTrack)}">`,
          ...Object.entries(opts.streamParameters ?? {}).map(
            ([name, value]) =>
              `<Parameter name="${escapeXml(name)}" value="${escapeXml(value)}" />`,
          ),
          '</Stream>',
          '</Start>',
        ].join('')
      : '';

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      streamBlock,
      `<Dial>`,
      `<Conference startConferenceOnEnter="${startOnEnter}" endConferenceOnExit="${endOnExit}" beep="false" waitUrl="${waitUrl}"${label}>`,
      escapeXml(conferenceName),
      '</Conference>',
      '</Dial>',
      '</Response>',
    ].join('');
  }

  /** Wait for a conference to reach in-progress status with exponential backoff */
  private async waitForConference(
    client: Awaited<ReturnType<typeof this.getClient>>,
    conferenceName: string,
    timeoutMs: number = 20000,
  ): Promise<{ sid: string }> {
    const startTime = Date.now();
    let delayMs = 500;
    const maxDelayMs = 2000;

    while (Date.now() - startTime < timeoutMs) {
      const conferences = await client.conferences.list({
        friendlyName: conferenceName,
        status: 'in-progress',
        limit: 1,
      });

      if (conferences.length) {
        return { sid: conferences[0].sid };
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 2, maxDelayMs);
    }

    throw Object.assign(
      new Error(
        `Conference "${conferenceName}" not found or not in-progress after ${timeoutMs}ms`,
      ),
      { status: 404 },
    );
  }

  /** Dial the customer into the conference via REST API */
  async addParticipant(
    conferenceName: string,
    to: string,
    from: string,
    opts?: {
      label?: string;
      endConferenceOnExit?: boolean;
      statusCallback?: string;
      conferenceLookupTimeoutMs?: number;
    },
  ): Promise<{ callSid: string; conferenceSid: string }> {
    try {
      const client = await this.getClient();

      const conf = await this.waitForConference(
        client,
        conferenceName,
        opts?.conferenceLookupTimeoutMs,
      );

      const participant = await client
        .conferences(conf.sid)
        .participants.create({
          to,
          from,
          earlyMedia: true,
          endConferenceOnExit: opts?.endConferenceOnExit ?? true,
          label: opts?.label ?? 'customer',
          statusCallback: opts?.statusCallback,
          statusCallbackEvent: [
            'initiated',
            'ringing',
            'answered',
            'completed',
          ],
        });

      this.ringingStartTimes.set(participant.callSid, Date.now());
      return { callSid: participant.callSid, conferenceSid: conf.sid };
    } catch (err: unknown) {
      if (err instanceof Error && 'status' in err) throw err;
      const message =
        err instanceof Error ? err.message : 'Failed to add participant';
      throw new Error(message);
    }
  }

  /** Create an outbound call with a TwiML URL or inline TwiML */
  async createCall(
    to: string,
    from: string,
    opts: {
      url?: string;
      twiml?: string;
      statusCallback?: string;
      statusCallbackEvent?: string[];
      timeout?: number;
    },
  ): Promise<{ callSid: string }> {
    try {
      const client = await this.getClient();
      const call = await client.calls.create({
        to,
        from,
        ...(opts.url ? { url: opts.url } : {}),
        ...(opts.twiml ? { twiml: opts.twiml } : {}),
        statusCallback: opts.statusCallback,
        statusCallbackEvent: opts.statusCallbackEvent ?? ['completed'],
        ...(opts.timeout ? { timeout: opts.timeout } : {}),
      });
      return { callSid: call.sid };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create call';
      throw new Error(message);
    }
  }

  /** Hold or unhold a participant */
  async holdParticipant(
    conferenceSid: string,
    callSid: string,
    hold: boolean,
  ): Promise<void> {
    try {
      const client = await this.getClient();
      await client
        .conferences(conferenceSid)
        .participants(callSid)
        .update({ hold });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Hold toggle failed';
      throw new Error(message);
    }
  }

  async muteParticipant(
    conferenceSid: string,
    callSid: string,
    muted: boolean,
  ): Promise<void> {
    try {
      const client = await this.getClient();
      await client
        .conferences(conferenceSid)
        .participants(callSid)
        .update({ muted });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Mute toggle failed';
      throw new Error(message);
    }
  }

  /** Find the conference SID by friendly name */
  async findConferenceSid(conferenceName: string): Promise<string | null> {
    try {
      const client = await this.getClient();
      const conferences = await client.conferences.list({
        friendlyName: conferenceName,
        status: 'in-progress',
        limit: 1,
      });
      return conferences.length ? conferences[0].sid : null;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Conference lookup failed';
      throw new Error(message);
    }
  }

  /** Remove a participant from the conference */
  async removeParticipant(
    conferenceSid: string,
    callSid: string,
  ): Promise<void> {
    try {
      const client = await this.getClient();
      await client.conferences(conferenceSid).participants(callSid).remove();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Remove participant failed';
      throw new Error(message);
    }
  }

  /** List participants in a conference */
  async listParticipants(
    conferenceSid: string,
  ): Promise<ConferenceParticipant[]> {
    try {
      const client = await this.getClient();
      const participants = await client
        .conferences(conferenceSid)
        .participants.list();
      return participants.map(
        (p: {
          callSid: string;
          conferenceSid: string;
          label?: string;
          hold: boolean;
          muted: boolean;
          status: string;
        }) => ({
          callSid: p.callSid,
          conferenceSid: p.conferenceSid,
          label: p.label ?? '',
          hold: p.hold,
          muted: p.muted,
          status: p.status,
        }),
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'List participants failed';
      throw new Error(message);
    }
  }

  /** Initiate a cold or warm transfer */
  async initiateTransfer(options: TransferOptions): Promise<TransferResult> {
    try {
      if (options.type === 'warm') {
        return await this.warmTransfer(options);
      }
      return await this.coldTransfer(options);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Transfer failed';
      return { success: false, error: message };
    }
  }

  private appendTransferId(
    statusCallbackUrl: string | undefined,
    transferId: string | undefined,
  ): string | undefined {
    if (!statusCallbackUrl || !transferId) {
      return statusCallbackUrl;
    }

    const separator = statusCallbackUrl.includes('?') ? '&' : '?';

    return `${statusCallbackUrl}${separator}transfer_id=${encodeURIComponent(transferId)}`;
  }

  /** Cold transfer: add target, remove agent */
  private async coldTransfer(
    options: TransferOptions,
  ): Promise<TransferResult> {
    try {
      const statusCallback = this.appendTransferId(
        options.statusCallbackUrl,
        options.transferId,
      );

      const { callSid: transferCallSid, conferenceSid } =
        await this.addParticipant(
          options.conferenceName,
          options.to,
          options.from,
          {
            label: 'transfer-target',
            endConferenceOnExit: true,
            statusCallback,
          },
        );

      await this.removeParticipant(conferenceSid, options.callSid);
      return {
        success: true,
        transferCallSid,
        conferenceSid,
        transferId: options.transferId,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Cold transfer failed';
      return { success: false, error: message };
    }
  }

  /** Warm transfer: hold customer, add target for consult */
  private async warmTransfer(
    options: TransferOptions,
  ): Promise<TransferResult> {
    try {
      const conferenceSid = await this.findConferenceSid(
        options.conferenceName,
      );
      if (!conferenceSid) {
        return { success: false, error: 'Conference not found' };
      }

      // hold the customer so agent can consult privately
      const participants = await this.listParticipants(conferenceSid);
      const customer = participants.find((p) => p.label === 'customer');
      if (!customer) {
        return {
          success: false,
          error: 'CUSTOMER_NOT_FOUND: cannot hold customer for warm transfer',
        };
      }
      await this.holdParticipant(conferenceSid, customer.callSid, true);

      // add the transfer target
      const client = await this.getClient();
      const statusCallback = this.appendTransferId(
        options.statusCallbackUrl,
        options.transferId,
      );

      const participant = await client
        .conferences(conferenceSid)
        .participants.create({
          to: options.to,
          from: options.from,
          endConferenceOnExit: false,
          label: 'transfer-target',
          statusCallback,
          statusCallbackEvent: [
            'initiated',
            'ringing',
            'answered',
            'completed',
          ],
        });

      return {
        success: true,
        transferCallSid: participant.callSid,
        conferenceSid,
        transferId: options.transferId,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Warm transfer failed';
      return { success: false, error: message };
    }
  }

  /** Complete a warm transfer: unhold customer, remove original agent */
  async completeTransfer(
    conferenceSid: string,
    agentCallSid: string,
  ): Promise<TransferResult> {
    try {
      const participants = await this.listParticipants(conferenceSid);
      const customer = participants.find((p) => p.label === 'customer');
      if (!customer) {
        return {
          success: false,
          error: 'CUSTOMER_NOT_FOUND: cannot complete transfer safely',
        };
      }
      if (customer.hold) {
        await this.holdParticipant(conferenceSid, customer.callSid, false);
      }

      const target = participants.find((p) => p.label === 'transfer-target');
      if (!target) {
        return {
          success: false,
          error: 'TRANSFER_TARGET_NOT_FOUND: cannot complete transfer',
        };
      }
      const client = await this.getClient();
      await client
        .conferences(conferenceSid)
        .participants(target.callSid)
        .update({
          endConferenceOnExit: true,
        });

      await this.removeParticipant(conferenceSid, agentCallSid);
      return { success: true, conferenceSid };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Complete transfer failed';
      return { success: false, error: message };
    }
  }

  /** Cancel a warm transfer: remove transfer target, unhold customer */
  async cancelTransfer(
    conferenceSid: string,
    transferCallSid: string,
  ): Promise<TransferResult> {
    try {
      await this.removeParticipant(conferenceSid, transferCallSid);

      const participants = await this.listParticipants(conferenceSid);
      const customer = participants.find((p) => p.label === 'customer');
      if (!customer) {
        return {
          success: false,
          error:
            'CUSTOMER_NOT_FOUND: transfer cancelled but customer not found to unhold',
        };
      }
      if (customer.hold) {
        await this.holdParticipant(conferenceSid, customer.callSid, false);
      }

      return { success: true, conferenceSid };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Cancel transfer failed';
      return { success: false, error: message };
    }
  }

  /** Get a recording by SID */
  async getRecording(
    recordingSid: string,
  ): Promise<{ url: string; duration: number }> {
    try {
      const client = await this.getClient();
      const recording = await client.recordings(recordingSid).fetch();

      return {
        url: `https://api.twilio.com/2010-04-01/Accounts/${this.credentials.accountSid}/Recordings/${recordingSid}.mp3`,
        duration: Number(recording.duration ?? 0),
      };
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { recordingSid } });
      const message = err instanceof Error ? err.message : 'Get recording failed';
      throw new Error(message);
    }
  }

  /** List recordings for a conference */
  async listRecordings(
    conferenceName: string,
  ): Promise<Array<{ url: string; duration: number }>> {
    try {
      const client = await this.getClient();
      const conferences = await client.conferences.list({
        friendlyName: conferenceName,
        limit: 1,
      });

      const conference = conferences[0];

      if (!conference) {
        return [];
      }

      const recordings = await client.recordings.list({
        conferenceSid: conference.sid,
        limit: 10,
      });

      return recordings.map((recording) => ({
        url: `https://api.twilio.com/2010-04-01/Accounts/${this.credentials.accountSid}/Recordings/${recording.sid}.mp3`,
        duration: Number(recording.duration ?? 0),
      }));
    } catch (err: unknown) {
      Sentry.captureException(err, { extra: { conferenceName } });
      const message = err instanceof Error ? err.message : 'List recordings failed';
      throw new Error(message);
    }
  }
}
