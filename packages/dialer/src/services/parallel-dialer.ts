import { randomUUID } from 'node:crypto';
import type {
  TwilioCredentials,
  ParallelStore,
  ParallelGroup,
  ParallelDialOptions,
  ParallelDialResult,
  ParallelCall,
} from '../types.js';
import type TwilioClient from 'twilio';

const GROUP_TTL_SECONDS = 300;
const STAGGER_MS = 500;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parallel dialer — initiates 3 concurrent outbound calls,
 * first human to answer wins, others terminated.
 * Redis-backed group state with atomic SETNX for race conditions.
 */
export class ParallelDialerService {
  private client: ReturnType<typeof TwilioClient> | null = null;
  private credentials: TwilioCredentials;
  private store: ParallelStore;

  constructor(credentials: TwilioCredentials | undefined, store: ParallelStore) {
    this.credentials = {
      accountSid: credentials?.accountSid ?? process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: credentials?.authToken ?? process.env.TWILIO_AUTH_TOKEN ?? '',
    };
    this.store = store;
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

  private async generateGroupId(): Promise<string> {
    try {
      for (let i = 0; i < 3; i++) {
        const id = `pg_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
        const existing = await this.store.getGroup(id);
        if (!existing) return id;
      }
      throw new Error('Failed to generate unique group ID after 3 attempts');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Group ID generation failed';
      throw new Error(message);
    }
  }

  /** Initiate a parallel dial batch (3 concurrent calls with AMD) */
  async initiateGroup(opts: ParallelDialOptions): Promise<ParallelDialResult> {
    try {
      const client = await this.getClient();
      const groupId = await this.generateGroupId();
      const conferenceName = `${groupId}_${opts.queueId}`;
      const calls: ParallelCall[] = [];

      // create 3 calls with ~500ms stagger
      for (let i = 0; i < opts.customerNumbers.length; i++) {
        if (i > 0) await delay(STAGGER_MS);

        const call = await client.calls.create({
          to: opts.customerNumbers[i],
          from: opts.fromNumbers[i],
          url: opts.customerTwimlUrl,
          statusCallback: opts.statusCallbackUrl,
          statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
          machineDetection: 'Enable',
        });

        const parallelCall: ParallelCall = {
          callSid: call.sid,
          customerNumber: opts.customerNumbers[i],
          fromNumber: opts.fromNumbers[i],
          position: i + 1,
          status: 'dialing',
          contactId: opts.contactIds?.[i],
        };
        calls.push(parallelCall);

        // reverse lookup: callSid → groupId
        await this.store.setCallMapping(call.sid, groupId, GROUP_TTL_SECONDS);
      }

      const group: ParallelGroup = {
        groupId,
        conferenceName,
        status: 'dialing',
        winnerSid: null,
        calls,
        queueId: opts.queueId,
        userId: opts.userId,
        createdAt: new Date().toISOString(),
      };

      await this.store.setGroup(groupId, JSON.stringify(group), GROUP_TTL_SECONDS);

      return {
        groupId,
        conferenceName,
        calls: calls.map((c) => ({
          callSid: c.callSid,
          customerNumber: c.customerNumber,
          fromNumber: c.fromNumber,
          position: c.position,
          status: 'dialing' as const,
        })),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Parallel dial initiation failed';
      throw new Error(message);
    }
  }

  /** Handle twilio status callback — winner detection via atomic SETNX */
  async handleStatusCallback(callSid: string, callStatus: string, answeredBy?: string): Promise<void> {
    try {
      const groupId = await this.store.getCallMapping(callSid);
      if (!groupId) return;

      const raw = await this.store.getGroup(groupId);
      if (!raw) return;

      const group: ParallelGroup = JSON.parse(raw);
      const call = group.calls.find((c) => c.callSid === callSid);
      if (!call) return;

      call.status = callStatus;
      if (answeredBy) call.amdResult = answeredBy === 'human' ? 'human' : answeredBy === 'unknown' ? 'unknown' : 'machine';

      if (callStatus === 'in-progress' && (call.amdResult === 'human' || call.amdResult === 'unknown')) {
        const won = await this.store.setWinnerIfAbsent(groupId, callSid, GROUP_TTL_SECONDS);
        if (won) {
          group.winnerSid = callSid;
          group.status = 'connected';
          await this.terminateLosingCalls(group, callSid);
        } else {
          await this.terminateCall(callSid);
          call.status = 'completed';
        }
      } else if (callStatus === 'in-progress' && call.amdResult === 'machine') {
        await this.terminateCall(callSid);
        call.status = 'completed';
      }

      // check if all calls resolved with no winner
      const allResolved = group.calls.every((c) =>
        ['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(c.status),
      );
      if (allResolved && !group.winnerSid) {
        group.status = 'completed';
      }

      await this.store.setGroup(groupId, JSON.stringify(group), GROUP_TTL_SECONDS);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Status callback handling failed';
      throw new Error(message);
    }
  }

  /** Get current group state */
  async getGroup(groupId: string): Promise<ParallelGroup | null> {
    try {
      const raw = await this.store.getGroup(groupId);
      if (!raw) return null;
      return JSON.parse(raw) as ParallelGroup;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Group lookup failed';
      throw new Error(message);
    }
  }

  /** Terminate all pending calls in a group */
  async terminateGroup(groupId: string): Promise<void> {
    try {
      const raw = await this.store.getGroup(groupId);
      if (!raw) return;

      const group: ParallelGroup = JSON.parse(raw);
      for (const call of group.calls) {
        if (!['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(call.status)) {
          await this.terminateCall(call.callSid);
          call.status = 'completed';
        }
      }
      group.status = 'completed';
      await this.store.setGroup(groupId, JSON.stringify(group), GROUP_TTL_SECONDS);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Group termination failed';
      throw new Error(message);
    }
  }

  /** Generate conference TwiML for the winning customer leg */
  async generateCustomerTwiml(callSid: string): Promise<string | null> {
    try {
      const groupId = await this.store.getCallMapping(callSid);
      if (!groupId) return null;

      const raw = await this.store.getGroup(groupId);
      if (!raw) return null;

      const group: ParallelGroup = JSON.parse(raw);
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Response>',
        '<Dial>',
        `<Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="false">${group.conferenceName}</Conference>`,
        '</Dial>',
        '</Response>',
      ].join('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'TwiML generation failed';
      throw new Error(message);
    }
  }

  /** Get groupId for a call SID (reverse lookup) */
  async getGroupIdForCall(callSid: string): Promise<string | null> {
    try {
      return await this.store.getCallMapping(callSid);
    } catch (err: unknown) {
      return null;
    }
  }

  /** Get fromNumbers for non-winner calls (for lock release) */
  getReleasableNumbers(group: ParallelGroup): string[] {
    return group.calls
      .filter((c) => c.callSid !== group.winnerSid)
      .map((c) => c.fromNumber);
  }

  /** Check if user meets parallel dialing requirements */
  validateRequirements(numberCount: number): { valid: boolean; required: number; current: number; message?: string } {
    const required = 3;
    if (numberCount >= required) return { valid: true, required, current: numberCount };
    return { valid: false, required, current: numberCount, message: `Need at least ${required} phone numbers` };
  }

  private async terminateLosingCalls(group: ParallelGroup, winnerSid: string): Promise<void> {
    try {
      for (const call of group.calls) {
        if (call.callSid !== winnerSid && !['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(call.status)) {
          await this.terminateCall(call.callSid);
          call.status = 'completed';
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to terminate losing calls';
      throw new Error(message);
    }
  }

  private async terminateCall(callSid: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.calls(callSid).update({ status: 'completed' });
    } catch (err: unknown) {
      // call may already be completed — safe to ignore
    }
  }
}

/** In-memory parallel store for testing / single-process use */
export class InMemoryParallelStore implements ParallelStore {
  private groups = new Map<string, { data: string; expiresAt: number }>();
  private callMappings = new Map<string, { groupId: string; expiresAt: number }>();
  private winners = new Map<string, { callSid: string; expiresAt: number }>();

  async setGroup(groupId: string, data: string, ttlSeconds: number): Promise<void> {
    this.groups.set(groupId, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async getGroup(groupId: string): Promise<string | null> {
    const entry = this.groups.get(groupId);
    if (!entry || entry.expiresAt < Date.now()) { this.groups.delete(groupId); return null; }
    return entry.data;
  }

  async setCallMapping(callSid: string, groupId: string, ttlSeconds: number): Promise<void> {
    this.callMappings.set(callSid, { groupId, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async getCallMapping(callSid: string): Promise<string | null> {
    const entry = this.callMappings.get(callSid);
    if (!entry || entry.expiresAt < Date.now()) { this.callMappings.delete(callSid); return null; }
    return entry.groupId;
  }

  async setWinnerIfAbsent(groupId: string, callSid: string, ttlSeconds: number): Promise<boolean> {
    const existing = this.winners.get(groupId);
    if (existing && existing.expiresAt >= Date.now()) return false;
    this.winners.set(groupId, { callSid, expiresAt: Date.now() + ttlSeconds * 1000 });
    return true;
  }

  async getWinner(groupId: string): Promise<string | null> {
    const entry = this.winners.get(groupId);
    if (!entry || entry.expiresAt < Date.now()) { this.winners.delete(groupId); return null; }
    return entry.callSid;
  }

  async deleteGroup(groupId: string): Promise<void> {
    this.groups.delete(groupId);
    this.winners.delete(groupId);
  }
}
