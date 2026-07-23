import { randomUUID } from 'node:crypto';
import type {
  TwilioCredentials,
  ParallelStore,
  ParallelGroup,
  ParallelDialOptions,
  ParallelDialResult,
  ParallelCall,
  ParallelCleanupAction,
  ParallelCleanupFailure,
  ParallelTelemetry,
} from '../types.js';
import { ACTIVE_CALL_TTL_SECONDS } from './caller-id.js';

type TwilioClientInstance = import('twilio').Twilio;

const GROUP_TTL_SECONDS = ACTIVE_CALL_TTL_SECONDS;
const GROUP_DIALING_TIMEOUT_MS = 60_000;
const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response />';
const TERMINAL_CALL_STATUSES = new Set([
  'completed',
  'failed',
  'busy',
  'no-answer',
  'canceled',
]);

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class ParallelDialerService {
  private client: TwilioClientInstance | null = null;
  private credentials: TwilioCredentials;
  private store: ParallelStore;

  constructor(
    credentials: TwilioCredentials | undefined,
    store: ParallelStore,
  ) {
    this.credentials = {
      accountSid:
        credentials?.accountSid ?? process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: credentials?.authToken ?? process.env.TWILIO_AUTH_TOKEN ?? '',
    };
    this.store = store;
  }

  private async getClient(): Promise<TwilioClientInstance> {
    if (this.client) return this.client;
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

  private async generateGroupId(): Promise<string> {
    try {
      for (let i = 0; i < 3; i++) {
        const id = `pg_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
        const existing = await this.store.getGroup(id);
        if (!existing) return id;
      }
      throw new Error('Failed to generate unique group ID after 3 attempts');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Group ID generation failed';
      throw new Error(message);
    }
  }

  async initiateGroup(opts: ParallelDialOptions): Promise<ParallelDialResult> {
    try {
      const client = await this.getClient();
      const groupId = await this.generateGroupId();
      const conferenceName = `${groupId}_${opts.queueId}`;
      const createdAt = new Date().toISOString();
      const calls: ParallelCall[] = [];
      const group: ParallelGroup = {
        groupId,
        conferenceName,
        status: 'dialing',
        winnerSid: null,
        calls: [],
        workspaceId: opts.workspaceId,
        queueId: opts.queueId,
        userId: opts.userId,
        createdAt,
        campaignSegment: opts.campaignSegment,
        profile: opts.profile,
        resolverReason: 'route-resolved',
        cleanupFailures: [],
      };

      await this.store.setGroup(
        groupId,
        JSON.stringify(group),
        GROUP_TTL_SECONDS,
      );

      try {
        for (let i = 0; i < opts.customerNumbers.length; i++) {
          if (i > 0) await delay(opts.profile.staggerMs);

          const call = await client.calls.create({
            to: opts.customerNumbers[i],
            from: opts.fromNumbers[i],
            url: opts.customerTwimlUrl,
            statusCallback: opts.statusCallbackUrl,
            statusCallbackEvent: [
              'initiated',
              'ringing',
              'answered',
              'completed',
            ],
            machineDetection: 'Enable',
          });

          const parallelCall: ParallelCall = {
            callSid: call.sid,
            customerNumber: opts.customerNumbers[i],
            fromNumber: opts.fromNumbers[i],
            position: i + 1,
            status: 'dialing',
            contactId: opts.contactIds?.[i],
            dialStartedAt: new Date().toISOString(),
          };
          calls.push(parallelCall);

          await this.store.registerCall(
            groupId,
            parallelCall,
            GROUP_TTL_SECONDS,
          );
        }
      } catch (err: unknown) {
        await this.failInitializingGroup(groupId);
        throw err;
      }

      return {
        groupId,
        conferenceName,
        profileId: opts.profile.id,
        calls: calls.map((call) => ({
          callSid: call.callSid,
          customerNumber: call.customerNumber,
          fromNumber: call.fromNumber,
          position: call.position,
          status: 'dialing' as const,
        })),
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Parallel dial initiation failed';
      throw new Error(message);
    }
  }

  async handleStatusCallback(
    callSid: string,
    callStatus: string,
    answeredBy?: string,
  ): Promise<void> {
    try {
      const groupId = await this.store.getCallMapping(callSid);
      if (!groupId) return;

      await this.store.withGroupLock(groupId, () =>
        this.processStatusCallbackLocked(
          groupId,
          callSid,
          callStatus,
          answeredBy,
        ),
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Status callback handling failed';
      throw new Error(message);
    }
  }

  private async processStatusCallbackLocked(
    groupId: string,
    callSid: string,
    callStatus: string,
    answeredBy?: string,
  ): Promise<void> {
    try {
      const raw = await this.store.getGroup(groupId);
      if (!raw) return;

      const group = this.parseGroup(raw);
      const call = group.calls.find((item) => item.callSid === callSid);
      if (!call || TERMINAL_CALL_STATUSES.has(call.status)) return;

      call.status = callStatus;
      if (answeredBy) {
        call.amdResult =
          answeredBy === 'human'
            ? 'human'
            : answeredBy === 'unknown'
              ? 'unknown'
              : 'machine';
      }

      if (callStatus === 'in-progress') {
        call.answeredAt = new Date().toISOString();
      }

      const isHumanLikeAnswer =
        call.amdResult === 'human' ||
        (group.profile.amdPolicy === 'human-or-unknown' &&
          call.amdResult === 'unknown');

      if (callStatus === 'in-progress' && isHumanLikeAnswer) {
        if (group.winnerSid === callSid) {
          group.status = 'connected';
          group.connectedAt ??= call.answeredAt ?? new Date().toISOString();
        } else if (group.winnerSid) {
          await this.tryTerminateCall(group, call);
        } else {
          const won = await this.store.setWinnerIfAbsent(
            groupId,
            callSid,
            GROUP_TTL_SECONDS,
          );

          if (!won) {
            group.winnerSid = await this.store.getWinner(groupId);
            await this.tryTerminateCall(group, call);
          } else {
            group.winnerSid = callSid;
            group.status = 'connected';
            group.connectedAt = call.answeredAt ?? new Date().toISOString();
            if (group.profile.terminationPolicy === 'winner-take-all') {
              await this.terminateLosingCalls(group, callSid);
            }
            await this.tryUnmuteWinner(group, callSid);
          }
        }
      } else if (
        callStatus === 'in-progress' &&
        call.amdResult !== undefined &&
        !isHumanLikeAnswer
      ) {
        await this.tryTerminateCall(group, call);
      } else if (TERMINAL_CALL_STATUSES.has(callStatus)) {
        call.terminatedAt = new Date().toISOString();
      }

      const allResolved = group.calls.every((item) =>
        TERMINAL_CALL_STATUSES.has(item.status),
      );
      if (allResolved && !group.winnerSid) {
        group.status = 'completed';
        group.completedAt = new Date().toISOString();
      }

      await this.store.setGroup(
        groupId,
        JSON.stringify(group),
        GROUP_TTL_SECONDS,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Locked status callback handling failed';
      throw new Error(message);
    }
  }

  async getGroup(groupId: string): Promise<ParallelGroup | null> {
    try {
      const raw = await this.store.getGroup(groupId);
      if (!raw) return null;

      const group = this.parseGroup(raw);

      if (this.isStaleDialingGroup(group, new Date())) {
        await this.terminateGroup(groupId);

        const refreshedRaw = await this.store.getGroup(groupId);
        return refreshedRaw ? this.parseGroup(refreshedRaw) : null;
      }

      return group;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Group lookup failed';
      throw new Error(message);
    }
  }

  async getGroupForWorkspace(
    groupId: string,
    workspaceId: string,
  ): Promise<ParallelGroup | null> {
    try {
      const group = await this.getGroup(groupId);
      return group?.workspaceId === workspaceId ? group : null;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Workspace group lookup failed';
      throw new Error(message);
    }
  }

  async terminateGroup(groupId: string): Promise<void> {
    try {
      await this.store.withGroupLock(groupId, () =>
        this.terminateGroupLocked(groupId),
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Group termination failed';
      throw new Error(message);
    }
  }

  private async terminateGroupLocked(groupId: string): Promise<void> {
    try {
      const raw = await this.store.getGroup(groupId);
      if (!raw) return;

      const group = this.parseGroup(raw);
      for (const call of group.calls) {
        if (!TERMINAL_CALL_STATUSES.has(call.status)) {
          await this.tryTerminateCall(group, call);
        }
      }
      group.status = group.cleanupFailures.length > 0 ? 'failed' : 'completed';
      group.completedAt = new Date().toISOString();
      await this.store.setGroup(
        groupId,
        JSON.stringify(group),
        GROUP_TTL_SECONDS,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Locked group termination failed';
      throw new Error(message);
    }
  }

  async terminateGroupForWorkspace(
    groupId: string,
    workspaceId: string,
  ): Promise<boolean> {
    try {
      const group = await this.getGroupForWorkspace(groupId, workspaceId);
      if (!group) return false;
      await this.terminateGroup(groupId);
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Workspace group termination failed';
      throw new Error(message);
    }
  }

  async retryPendingCleanup(groupId: string): Promise<void> {
    try {
      await this.store.withGroupLock(groupId, () =>
        this.retryPendingCleanupLocked(groupId),
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Cleanup reconciliation failed';
      throw new Error(message);
    }
  }

  private async retryPendingCleanupLocked(groupId: string): Promise<void> {
    try {
      const raw = await this.store.getGroup(groupId);
      if (!raw) return;

      const group = this.parseGroup(raw);
      const pendingFailures = [...group.cleanupFailures];
      group.cleanupFailures = [];

      for (const failure of pendingFailures) {
        try {
          if (failure.action === 'terminate-call') {
            await this.terminateCall(failure.callSid);
            const call = group.calls.find(
              (candidate) => candidate.callSid === failure.callSid,
            );
            if (call) {
              call.status = 'completed';
              call.terminatedAt = new Date().toISOString();
            }
          } else {
            await this.unmuteConferenceParticipant(
              group.conferenceName,
              failure.callSid,
            );
          }
        } catch (err: unknown) {
          this.recordCleanupFailure(
            group,
            failure.action,
            failure.callSid,
            err,
            failure,
          );
        }
      }

      await this.store.setGroup(
        groupId,
        JSON.stringify(group),
        GROUP_TTL_SECONDS,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Locked cleanup reconciliation failed';
      throw new Error(message);
    }
  }

  async generateCustomerTwiml(callSid: string): Promise<string | null> {
    try {
      const groupId = await this.store.getCallMapping(callSid);
      if (!groupId) return null;

      const raw = await this.store.getGroup(groupId);
      if (!raw) return null;

      const group: ParallelGroup = JSON.parse(raw);
      const call = group.calls.find((item) => item.callSid === callSid);

      if (!call || TERMINAL_CALL_STATUSES.has(call.status)) {
        return EMPTY_TWIML;
      }

      const muted = group.winnerSid === callSid ? 'false' : 'true';

      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Response>',
        '<Dial>',
        `<Conference beep="false" muted="${muted}" startConferenceOnEnter="true" endConferenceOnExit="false">${group.conferenceName}</Conference>`,
        '</Dial>',
        '</Response>',
      ].join('');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'TwiML generation failed';
      throw new Error(message);
    }
  }

  async getGroupIdForCall(callSid: string): Promise<string | null> {
    try {
      return await this.store.getCallMapping(callSid);
    } catch {
      return null;
    }
  }

  getReleasableNumbers(group: ParallelGroup): string[] {
    return group.calls
      .filter((call) => call.callSid !== group.winnerSid)
      .map((call) => call.fromNumber);
  }

  validateRequirements(
    numberCount: number,
    fanout = 3,
  ): {
    valid: boolean;
    required: number;
    current: number;
    message?: string;
  } {
    const required = fanout;
    if (numberCount >= required) {
      return { valid: true, required, current: numberCount };
    }
    return {
      valid: false,
      required,
      current: numberCount,
      message: `Need at least ${required} phone numbers`,
    };
  }

  computeTelemetry(group: ParallelGroup): ParallelTelemetry {
    const winnerRate = group.winnerSid ? 1 : 0;
    const wastedLegs = Math.max(
      group.calls.length - (group.winnerSid ? 1 : 0),
      0,
    );
    const connectLatencyMs = group.connectedAt
      ? Math.max(
          0,
          new Date(group.connectedAt).getTime() -
            new Date(group.createdAt).getTime(),
        )
      : null;

    return {
      winnerRate,
      wastedLegs,
      connectLatencyMs,
    };
  }

  async markTelemetryEmitted(groupId: string): Promise<void> {
    try {
      await this.store.claimTelemetryEmission(
        groupId,
        new Date().toISOString(),
        GROUP_TTL_SECONDS,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown telemetry store error';
      throw new Error(`Failed to mark parallel telemetry emitted: ${message}`);
    }
  }

  async markTelemetryEmittedIfAbsent(groupId: string): Promise<boolean> {
    try {
      return await this.store.claimTelemetryEmission(
        groupId,
        new Date().toISOString(),
        GROUP_TTL_SECONDS,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown telemetry store error';
      throw new Error(
        `Failed to claim parallel telemetry emission: ${message}`,
      );
    }
  }

  private isStaleDialingGroup(group: ParallelGroup, now: Date): boolean {
    if (group.status !== 'dialing') {
      return false;
    }

    const createdAtMs = new Date(group.createdAt).getTime();

    return (
      Number.isFinite(createdAtMs) &&
      now.getTime() - createdAtMs >= GROUP_DIALING_TIMEOUT_MS
    );
  }

  private parseGroup(raw: string): ParallelGroup {
    const group = JSON.parse(raw) as ParallelGroup;
    group.cleanupFailures ??= [];
    return group;
  }

  private async failInitializingGroup(groupId: string): Promise<void> {
    try {
      await this.store.withGroupLock(groupId, () =>
        this.failInitializingGroupLocked(groupId),
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Initializing group cleanup failed';
      throw new Error(message);
    }
  }

  private async failInitializingGroupLocked(groupId: string): Promise<void> {
    try {
      const raw = await this.store.getGroup(groupId);
      if (!raw) return;

      const group = this.parseGroup(raw);
      for (const call of group.calls) {
        if (!TERMINAL_CALL_STATUSES.has(call.status)) {
          await this.tryTerminateCall(group, call);
        }
      }
      group.status = 'failed';
      group.completedAt = new Date().toISOString();
      await this.store.setGroup(
        groupId,
        JSON.stringify(group),
        GROUP_TTL_SECONDS,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Locked initializing group cleanup failed';
      throw new Error(message);
    }
  }

  private async terminateLosingCalls(
    group: ParallelGroup,
    winnerSid: string,
  ): Promise<void> {
    for (const call of group.calls) {
      if (
        call.callSid !== winnerSid &&
        !TERMINAL_CALL_STATUSES.has(call.status)
      ) {
        await this.tryTerminateCall(group, call);
      }
    }
  }

  private async tryTerminateCall(
    group: ParallelGroup,
    call: ParallelCall,
  ): Promise<boolean> {
    try {
      await this.terminateCall(call.callSid);
      call.status = 'completed';
      call.terminatedAt = new Date().toISOString();
      this.clearCleanupFailure(group, 'terminate-call', call.callSid);
      return true;
    } catch (err: unknown) {
      this.recordCleanupFailure(group, 'terminate-call', call.callSid, err);
      return false;
    }
  }

  private async tryUnmuteWinner(
    group: ParallelGroup,
    callSid: string,
  ): Promise<boolean> {
    try {
      await this.unmuteConferenceParticipant(group.conferenceName, callSid);
      this.clearCleanupFailure(group, 'unmute-winner', callSid);
      return true;
    } catch (err: unknown) {
      this.recordCleanupFailure(group, 'unmute-winner', callSid, err);
      return false;
    }
  }

  private recordCleanupFailure(
    group: ParallelGroup,
    action: ParallelCleanupAction,
    callSid: string,
    err: unknown,
    previous?: ParallelCleanupFailure,
  ): void {
    const now = new Date().toISOString();
    const existing =
      previous ??
      group.cleanupFailures.find(
        (failure) => failure.action === action && failure.callSid === callSid,
      );
    const message =
      err instanceof Error ? err.message : 'Provider cleanup failed';

    this.clearCleanupFailure(group, action, callSid);
    group.cleanupFailures.push({
      action,
      callSid,
      message,
      attempts: (existing?.attempts ?? 0) + 1,
      firstFailedAt: existing?.firstFailedAt ?? now,
      lastFailedAt: now,
    });
  }

  private clearCleanupFailure(
    group: ParallelGroup,
    action: ParallelCleanupAction,
    callSid: string,
  ): void {
    group.cleanupFailures = group.cleanupFailures.filter(
      (failure) => failure.action !== action || failure.callSid !== callSid,
    );
  }

  private async terminateCall(callSid: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.calls(callSid).update({ status: 'completed' });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Provider call termination failed';
      throw new Error(`Failed to terminate provider call: ${message}`);
    }
  }

  private async unmuteConferenceParticipant(
    conferenceName: string,
    callSid: string,
  ): Promise<void> {
    try {
      const client = await this.getClient();
      const conferences = await client.conferences.list({
        friendlyName: conferenceName,
        status: 'in-progress',
        limit: 1,
      });
      const conferenceSid = conferences[0]?.sid;

      if (!conferenceSid) {
        throw new Error('Active conference not found');
      }

      await client
        .conferences(conferenceSid)
        .participants(callSid)
        .update({ muted: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Conference unmute failed';
      throw new Error(`Failed to unmute conference winner: ${message}`);
    }
  }
}

export class InMemoryParallelStore implements ParallelStore {
  private groups = new Map<string, { data: string; expiresAt: number }>();

  private callMappings = new Map<
    string,
    { groupId: string; expiresAt: number }
  >();

  private winners = new Map<string, { callSid: string; expiresAt: number }>();

  private groupLocks = new Map<string, Promise<void>>();

  async setGroup(
    groupId: string,
    data: string,
    ttlSeconds: number,
  ): Promise<void> {
    this.groups.set(groupId, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async getGroup(groupId: string): Promise<string | null> {
    const entry = this.groups.get(groupId);
    if (!entry || entry.expiresAt < Date.now()) {
      this.groups.delete(groupId);
      return null;
    }
    return entry.data;
  }

  async registerCall(
    groupId: string,
    call: ParallelCall,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.withGroupLock(groupId, () =>
        this.registerCallLocked(groupId, call, ttlSeconds),
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Parallel call registration failed';
      throw new Error(message);
    }
  }

  private async registerCallLocked(
    groupId: string,
    call: ParallelCall,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      const raw = await this.getGroup(groupId);
      if (!raw) {
        throw new Error('Parallel group not found while registering call');
      }

      const group = JSON.parse(raw) as ParallelGroup;
      group.cleanupFailures ??= [];
      if (
        !group.calls.some((candidate) => candidate.callSid === call.callSid)
      ) {
        group.calls.push(call);
      }
      await this.setGroup(groupId, JSON.stringify(group), ttlSeconds);
      await this.setCallMapping(call.callSid, groupId, ttlSeconds);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Locked parallel call registration failed';
      throw new Error(message);
    }
  }

  async setCallMapping(
    callSid: string,
    groupId: string,
    ttlSeconds: number,
  ): Promise<void> {
    this.callMappings.set(callSid, {
      groupId,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async getCallMapping(callSid: string): Promise<string | null> {
    const entry = this.callMappings.get(callSid);
    if (!entry || entry.expiresAt < Date.now()) {
      this.callMappings.delete(callSid);
      return null;
    }
    return entry.groupId;
  }

  async setWinnerIfAbsent(
    groupId: string,
    callSid: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const existing = this.winners.get(groupId);
    if (existing && existing.expiresAt >= Date.now()) return false;
    this.winners.set(groupId, {
      callSid,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return true;
  }

  async getWinner(groupId: string): Promise<string | null> {
    const entry = this.winners.get(groupId);
    if (!entry || entry.expiresAt < Date.now()) {
      this.winners.delete(groupId);
      return null;
    }
    return entry.callSid;
  }

  async claimTelemetryEmission(
    groupId: string,
    emittedAt: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    try {
      return await this.withGroupLock(groupId, () =>
        this.claimTelemetryEmissionLocked(groupId, emittedAt, ttlSeconds),
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Telemetry claim failed';
      throw new Error(message);
    }
  }

  private async claimTelemetryEmissionLocked(
    groupId: string,
    emittedAt: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    try {
      const raw = await this.getGroup(groupId);
      if (!raw) return false;

      const group = JSON.parse(raw) as ParallelGroup;
      if (group.telemetryEmittedAt) return false;

      group.telemetryEmittedAt = emittedAt;
      await this.setGroup(groupId, JSON.stringify(group), ttlSeconds);
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Locked telemetry claim failed';
      throw new Error(message);
    }
  }

  async withGroupLock<T>(
    groupId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.groupLocks.get(groupId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    this.groupLocks.set(groupId, tail);

    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.groupLocks.get(groupId) === tail) {
        this.groupLocks.delete(groupId);
      }
    }
  }

  async deleteGroup(groupId: string): Promise<void> {
    this.groups.delete(groupId);
    this.winners.delete(groupId);
    for (const [callSid, mapping] of this.callMappings.entries()) {
      if (mapping.groupId === groupId) {
        this.callMappings.delete(callSid);
      }
    }
  }
}
