import type { DialerProvider } from './providers/base.js';
import type {
  DialerConfig,
  DialOptions,
  DialResult,
  HangupResult,
  VoiceToken,
  ProvisionNumberOptions,
  ProvisionResult,
  TransferOptions,
  TransferResult,
  ConferenceParticipant,
  ParallelStore,
} from './types.js';
import { TwilioProvider } from './providers/twilio.js';
import { LocalPresenceService, type NumberPool } from './services/local-presence.js';
import type { CallerIdLockService } from './services/caller-id.js';
import { ConferenceService } from './services/conference.js';
import { ParallelDialerService, InMemoryParallelStore } from './services/parallel-dialer.js';

/**
 * Main Dialer class — the public API for @consuelo/dialer.
 *
 * Composes a telephony provider with local presence and caller ID
 * locking services to provide a clean, high-level dialing interface.
 *
 * @example
 * ```ts
 * import { Dialer } from '@consuelo/dialer';
 *
 * const dialer = new Dialer({ credentials: { accountSid: '...', authToken: '...' } });
 * const result = await dialer.dial({ to: '+15551234567', from: '+15559876543', userId: 'user_1' });
 * ```
 */
export class Dialer {
  readonly provider: DialerProvider;
  readonly localPresence: LocalPresenceService;
  readonly conference: ConferenceService;
  readonly parallel: ParallelDialerService;
  private callerIdLock?: CallerIdLockService;
  private config: DialerConfig;

  constructor(config: DialerConfig = {}, parallelStore?: ParallelStore) {
    this.config = config;
    this.provider = new TwilioProvider(config.credentials);
    this.localPresence = new LocalPresenceService();
    this.conference = new ConferenceService(config.credentials);
    this.parallel = new ParallelDialerService(config.credentials, parallelStore ?? new InMemoryParallelStore());
  }

  /** Attach a caller ID lock service (optional, for concurrent call protection) */
  withCallerIdLock(service: CallerIdLockService): this {
    this.callerIdLock = service;
    return this;
  }

  /**
   * Initiate an outbound call.
   *
   * Number selection priority:
   *  1. options.callerIdNumber (manual override)
   *  2. Local presence match (if localPresence enabled and numberPool provided)
   *  3. config.defaultNumber
   *  4. options.from (agent's personal number)
   */
  async dial(options: DialOptions, numberPool?: NumberPool): Promise<DialResult> {
    let callerIdNumber = options.callerIdNumber;
    let selectionMethod: DialResult['selectionMethod'] = 'manual';

    // auto-select via local presence if no manual override
    if (!callerIdNumber && options.localPresence !== false && numberPool) {
      const selection = await this.localPresence.selectNumber(numberPool, options.to);
      if (selection) {
        callerIdNumber = selection.phoneNumber;
        selectionMethod = selection.localMatch
          ? 'local_presence'
          : selection.proximityMatch
            ? 'local_presence'
            : 'primary_fallback';
      }
    }

    if (!callerIdNumber && this.config.defaultNumber) {
      callerIdNumber = this.config.defaultNumber;
      selectionMethod = 'primary';
    }

    if (!callerIdNumber) {
      selectionMethod = 'system_default';
    }

    // acquire caller ID lock if service is configured
    if (callerIdNumber && this.callerIdLock) {
      const locked = await this.callerIdLock.acquireLock(callerIdNumber, options.userId, '');
      if (!locked) {
        return { success: false, error: 'Caller ID number is currently in use by another call' };
      }
    }

    const result = await this.provider.dial({
      ...options,
      callerIdNumber,
      statusCallbackUrl: options.statusCallbackUrl ?? this.config.baseUrl,
    });

    // update lock with actual call SID
    if (result.success && result.callSid && callerIdNumber && this.callerIdLock) {
      await this.callerIdLock.releaseLock('');
      await this.callerIdLock.acquireLock(callerIdNumber, options.userId, result.callSid);
    }

    return { ...result, selectionMethod };
  }

  /** Hang up an active call and release any caller ID lock */
  async hangup(callSid: string): Promise<HangupResult> {
    const result = await this.provider.hangup(callSid);
    if (this.callerIdLock) {
      await this.callerIdLock.releaseLock(callSid);
    }
    return result;
  }

  /** Generate a voice token for browser-based calling */
  async getToken(userId: string): Promise<VoiceToken> {
    return this.provider.getToken(userId);
  }

  /** Provision a new phone number */
  async provisionNumber(options: ProvisionNumberOptions): Promise<ProvisionResult> {
    return this.provider.provisionNumber(options);
  }

  /** Check if a call has reached a terminal status */
  async isCallCompleted(callSid: string): Promise<boolean> {
    return this.provider.isCallCompleted(callSid);
  }

  /** Create an outbound call with a TwiML URL or inline TwiML */
  async createCall(to: string, from: string, opts: { url?: string; twiml?: string; statusCallback?: string }): Promise<{ callSid: string }> {
    return this.conference.createCall(to, from, opts);
  }

  /** Generate conference TwiML for the browser's incoming webhook */
  generateConferenceTwiml(conferenceName: string, participantLabel?: string): string {
    return this.conference.generateConferenceTwiml(conferenceName, {
      participantLabel,
    });
  }

  /** Dial the customer into the agent's conference */
  async addCustomerToConference(conferenceName: string, to: string, from: string, statusCallback?: string): Promise<{ callSid: string; conferenceSid: string }> {
    return this.conference.addParticipant(conferenceName, to, from, {
      label: 'customer',
      endConferenceOnExit: true,
      statusCallback,
    });
  }

  /** Initiate a cold or warm transfer */
  async initiateTransfer(options: TransferOptions): Promise<TransferResult> {
    return this.conference.initiateTransfer(options);
  }

  /** Complete a warm transfer — unhold customer, remove agent */
  async completeTransfer(conferenceSid: string, agentCallSid: string): Promise<TransferResult> {
    return this.conference.completeTransfer(conferenceSid, agentCallSid);
  }

  /** Cancel a warm transfer — remove target, unhold customer */
  async cancelTransfer(conferenceSid: string, transferCallSid: string): Promise<TransferResult> {
    return this.conference.cancelTransfer(conferenceSid, transferCallSid);
  }

  /** Hold or unhold a participant in a conference */
  async holdParticipant(conferenceSid: string, callSid: string, hold: boolean): Promise<void> {
    return this.conference.holdParticipant(conferenceSid, callSid, hold);
  }

  /** Mute or unmute a participant in a conference */
  async muteParticipant(conferenceSid: string, callSid: string, muted: boolean): Promise<void> {
    return this.conference.muteParticipant(conferenceSid, callSid, muted);
  }

  /** List participants in a conference */
  async listParticipants(conferenceSid: string): Promise<ConferenceParticipant[]> {
    return this.conference.listParticipants(conferenceSid);
  }
}
