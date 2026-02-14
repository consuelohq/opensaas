import type { TwilioCredentials, ConferenceParticipant, TransferOptions, TransferResult } from '../types.js';
import type TwilioClient from 'twilio';

/**
 * Conference + transfer orchestration via Twilio REST API.
 *
 * All calls go through conferences (even 1-on-1) so transfers
 * can add/remove participants without dropping audio.
 */
export class ConferenceService {
  private client: ReturnType<typeof TwilioClient> | null = null;
  private credentials: TwilioCredentials;

  constructor(credentials?: TwilioCredentials) {
    this.credentials = {
      accountSid: credentials?.accountSid ?? process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: credentials?.authToken ?? process.env.TWILIO_AUTH_TOKEN ?? '',
    };
  }

  private async getClient(): Promise<ReturnType<typeof TwilioClient>> {
    if (this.client) return this.client;
    try {
      const twilio = await import('twilio');
      this.client = twilio.default(this.credentials.accountSid, this.credentials.authToken);
      return this.client;
    } catch (err: unknown) {
      this.client = null;
      throw err;
    }
  }

  /** Generate conference TwiML for the agent's browser connection */
  generateConferenceTwiml(conferenceName: string, opts?: {
    startOnEnter?: boolean;
    endOnExit?: boolean;
    waitUrl?: string;
    participantLabel?: string;
  }): string {
    const startOnEnter = opts?.startOnEnter ?? true;
    const endOnExit = opts?.endOnExit ?? false;
    const waitUrl = opts?.waitUrl ?? '';
    const label = opts?.participantLabel ? ` participantLabel="${opts.participantLabel}"` : '';

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      `<Dial>`,
      `<Conference startConferenceOnEnter="${startOnEnter}" endConferenceOnExit="${endOnExit}" waitUrl="${waitUrl}"${label}>`,
      conferenceName,
      '</Conference>',
      '</Dial>',
      '</Response>',
    ].join('');
  }

  /** Dial the customer into the conference via REST API */
  async addParticipant(conferenceName: string, to: string, from: string, opts?: {
    label?: string;
    endConferenceOnExit?: boolean;
    statusCallback?: string;
  }): Promise<{ callSid: string; conferenceSid: string }> {
    try {
      const client = await this.getClient();

      const conferences = await client.conferences.list({
        friendlyName: conferenceName,
        status: 'in-progress',
        limit: 1,
      });

      if (!conferences.length) {
        throw Object.assign(new Error(`Conference "${conferenceName}" not found or not in-progress`), { status: 404 });
      }

      const conf = conferences[0];
      const participant = await client.conferences(conf.sid).participants.create({
        to,
        from,
        endConferenceOnExit: opts?.endConferenceOnExit ?? true,
        label: opts?.label ?? 'customer',
        statusCallback: opts?.statusCallback,
        statusCallbackEvent: ['ringing', 'answered', 'completed'],
      });

      return { callSid: participant.callSid, conferenceSid: conf.sid };
    } catch (err: unknown) {
      if (err instanceof Error && 'status' in err) throw err;
      const message = err instanceof Error ? err.message : 'Failed to add participant';
      throw new Error(message);
    }
  }

  /** Hold or unhold a participant */
  async holdParticipant(conferenceSid: string, callSid: string, hold: boolean): Promise<void> {
    try {
      const client = await this.getClient();
      await client.conferences(conferenceSid).participants(callSid).update({ hold });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Hold toggle failed';
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
      const message = err instanceof Error ? err.message : 'Conference lookup failed';
      throw new Error(message);
    }
  }

  /** Remove a participant from the conference */
  async removeParticipant(conferenceSid: string, callSid: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.conferences(conferenceSid).participants(callSid).remove();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Remove participant failed';
      throw new Error(message);
    }
  }

  /** List participants in a conference */
  async listParticipants(conferenceSid: string): Promise<ConferenceParticipant[]> {
    try {
      const client = await this.getClient();
      const participants = await client.conferences(conferenceSid).participants.list();
      return participants.map((p: { callSid: string; conferenceSid: string; label?: string; hold: boolean; muted: boolean; status: string }) => ({
        callSid: p.callSid,
        conferenceSid: p.conferenceSid,
        label: p.label ?? '',
        hold: p.hold,
        muted: p.muted,
        status: p.status,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'List participants failed';
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

  /** Cold transfer: add target, remove agent */
  private async coldTransfer(options: TransferOptions): Promise<TransferResult> {
    try {
      const { callSid: transferCallSid, conferenceSid } = await this.addParticipant(
        options.conferenceName,
        options.to,
        options.from,
        { label: 'transfer-target', endConferenceOnExit: true },
      );

      await this.removeParticipant(conferenceSid, options.callSid);
      return { success: true, transferCallSid, conferenceSid };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Cold transfer failed';
      return { success: false, error: message };
    }
  }

  /** Warm transfer: hold customer, add target for consult */
  private async warmTransfer(options: TransferOptions): Promise<TransferResult> {
    try {
      const conferenceSid = await this.findConferenceSid(options.conferenceName);
      if (!conferenceSid) {
        return { success: false, error: 'Conference not found' };
      }

      // hold the customer so agent can consult privately
      const participants = await this.listParticipants(conferenceSid);
      const customer = participants.find((p) => p.label === 'customer');
      if (customer) {
        await this.holdParticipant(conferenceSid, customer.callSid, true);
      }

      // add the transfer target
      const client = await this.getClient();
      const participant = await client.conferences(conferenceSid).participants.create({
        to: options.to,
        from: options.from,
        endConferenceOnExit: false,
        label: 'transfer-target',
      });

      return { success: true, transferCallSid: participant.callSid, conferenceSid };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Warm transfer failed';
      return { success: false, error: message };
    }
  }

  /** Complete a warm transfer: unhold customer, remove original agent */
  async completeTransfer(conferenceSid: string, agentCallSid: string): Promise<TransferResult> {
    try {
      const participants = await this.listParticipants(conferenceSid);
      const customer = participants.find((p) => p.label === 'customer');
      if (customer?.hold) {
        await this.holdParticipant(conferenceSid, customer.callSid, false);
      }

      const target = participants.find((p) => p.label === 'transfer-target');
      if (target) {
        const client = await this.getClient();
        await client.conferences(conferenceSid).participants(target.callSid).update({
          endConferenceOnExit: true,
        });
      }

      await this.removeParticipant(conferenceSid, agentCallSid);
      return { success: true, conferenceSid };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Complete transfer failed';
      return { success: false, error: message };
    }
  }

  /** Cancel a warm transfer: remove transfer target, unhold customer */
  async cancelTransfer(conferenceSid: string, transferCallSid: string): Promise<TransferResult> {
    try {
      await this.removeParticipant(conferenceSid, transferCallSid);

      const participants = await this.listParticipants(conferenceSid);
      const customer = participants.find((p) => p.label === 'customer');
      if (customer?.hold) {
        await this.holdParticipant(conferenceSid, customer.callSid, false);
      }

      return { success: true, conferenceSid };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Cancel transfer failed';
      return { success: false, error: message };
    }
  }
}
