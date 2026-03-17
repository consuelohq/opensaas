/** @jsxImportSource chat */
import { createLogger } from '@consuelo/logger';
import { getAuth, getDiscordUserId } from './auth.js';
import { createApiClient } from './api-client.js';
import type { DiscordAuth } from './auth.js';

const logger = createLogger('chat-bot:transfer');

const TRANSFER_TTL_MS = 30 * 60 * 1000;

type TransferState = {
  transferId: string;
  callSid: string;
  conferenceName: string;
  conferenceSid: string | null;
  transferCallSid: string | null;
  repDiscordId: string;
  repAuth: DiscordAuth;
  managerDiscordId: string;
  managerPhone: string;
  contactName: string;
  contactPhone: string;
  contactCompany: string;
  callDuration: number;
  type: 'warm' | 'whisper';
  status: 'pending' | 'ringing' | 'consulting' | 'completed' | 'cancelled' | 'declined';
  createdAt: number;
};

type ActiveCall = {
  callId: string;
  callSid: string;
  conferenceName: string;
  contactName?: string;
  contactPhone?: string;
  contactCompany?: string;
  startedAt: string;
};

export type TransferManagerConfig = {
  apiUrl: string;
  redisUrl?: string;
};

export class TransferManager {
  private transfers = new Map<string, TransferState>();
  private activeCalls = new Map<string, ActiveCall>();
  private redisClient: import('ioredis').default | null = null;

  constructor(private config: TransferManagerConfig) {}

  private async getRedis(): Promise<import('ioredis').default> {
    try {
      if (!this.redisClient) {
        const { default: IORedis } = await import('ioredis');
        this.redisClient = new IORedis(this.config.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379');
      }
      return this.redisClient;
    } catch (err: unknown) {
      this.redisClient = null;
      throw err;
    }
  }

  private userClient(auth: DiscordAuth) {
    return createApiClient({ baseUrl: this.config.apiUrl, apiKey: auth.apiKey });
  }

  // track active calls from call events (called by the call event listener)
  trackCallStarted(userId: string, callId: string, conferenceName: string, contactName?: string, contactPhone?: string): void {
    this.activeCalls.set(userId, {
      callId,
      callSid: '',
      conferenceName,
      contactName,
      contactPhone,
      startedAt: new Date().toISOString(),
    });
  }

  trackCallEnded(userId: string): void {
    this.activeCalls.delete(userId);
  }

  // resolve active call for a user — enriches with Redis phone-call state
  async getActiveCall(auth: DiscordAuth): Promise<ActiveCall | null> {
    const call = this.activeCalls.get(auth.userId);
    if (!call) return null;

    // enrich with callSid from Redis if not yet resolved
    if (!call.callSid && call.callId) {
      try {
        const redis = await this.getRedis();
        const raw = await redis.get(`phone-call:${call.callId}`);
        if (raw) {
          const state = JSON.parse(raw) as Record<string, unknown>;
          call.callSid = (state.repCallSid as string) ?? '';
        }
      } catch (err: unknown) {
        logger.error('failed to get call state from redis', {
          error: err instanceof Error ? err.message : 'unknown',
          callId: call.callId,
        });
      }
    }

    return call;
  }

  // resolve a discord user mention to their phone number
  async resolveManagerPhone(managerDiscordId: string): Promise<{ phone: string | null; auth: DiscordAuth | null; error: string | null }> {
    const managerAuth = await getAuth(managerDiscordId);
    if (!managerAuth) {
      return { phone: null, auth: null, error: 'Manager is not linked to Consuelo. Ask them to run /consuelo login' };
    }

    try {
      const redis = await this.getRedis();
      const phone = await redis.get(`consuelo:user:${managerAuth.userId}:phone`);
      if (!phone) {
        return { phone: null, auth: managerAuth, error: 'Manager has no phone configured. Ask them to run /consuelo config set phone' };
      }
      return { phone, auth: managerAuth, error: null };
    } catch (err: unknown) {
      logger.error('failed to resolve manager phone', {
        error: err instanceof Error ? err.message : 'unknown',
      });
      return { phone: null, auth: managerAuth, error: 'Failed to look up manager phone' };
    }
  }

  // initiate a warm transfer — called when manager clicks "Join Call"
  async initiateTransfer(transferId: string): Promise<{ success: boolean; error?: string }> {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return { success: false, error: 'Transfer not found' };

    try {
      const client = this.userClient(transfer.repAuth);
      type TransferResponse = {
        success: boolean;
        transferCallSid?: string;
        conferenceSid?: string;
        transferId?: string;
        error?: string;
      };
      const result = await client.post<TransferResponse>(
        `/v1/calls/${transfer.callSid}/transfer`,
        {
          to: transfer.managerPhone,
          type: 'warm',
        },
      );

      if (!result.success) {
        transfer.status = 'cancelled';
        return { success: false, error: result.error ?? 'Transfer failed' };
      }

      transfer.transferCallSid = result.transferCallSid ?? null;
      transfer.conferenceSid = result.conferenceSid ?? null;
      transfer.status = 'consulting';
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      logger.error('transfer initiation failed', { transferId, error: message });
      transfer.status = 'cancelled';
      return { success: false, error: message };
    }
  }

  // complete a warm transfer — rep leaves, customer unheld
  async completeTransfer(transferId: string): Promise<{ success: boolean; error?: string }> {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return { success: false, error: 'Transfer not found' };

    try {
      const client = this.userClient(transfer.repAuth);
      type TransferResponse = { success: boolean; error?: string };
      const result = await client.post<TransferResponse>(
        `/v1/calls/${transfer.callSid}/transfer/complete`,
        {
          conferenceSid: transfer.conferenceSid,
          agentCallSid: transfer.callSid,
        },
      );

      transfer.status = 'completed';
      this.scheduleCleanup(transferId);
      return { success: result.success, error: result.error };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      logger.error('transfer complete failed', { transferId, error: message });
      return { success: false, error: message };
    }
  }

  // cancel a warm transfer — remove manager, unhold customer
  async cancelTransfer(transferId: string): Promise<{ success: boolean; error?: string }> {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return { success: false, error: 'Transfer not found' };

    try {
      const client = this.userClient(transfer.repAuth);
      type TransferResponse = { success: boolean; error?: string };
      const result = await client.post<TransferResponse>(
        `/v1/calls/${transfer.callSid}/transfer/cancel`,
        {
          conferenceSid: transfer.conferenceSid,
          transferCallSid: transfer.transferCallSid,
        },
      );

      transfer.status = 'cancelled';
      this.scheduleCleanup(transferId);
      return { success: result.success, error: result.error };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      logger.error('transfer cancel failed', { transferId, error: message });
      return { success: false, error: message };
    }
  }

  // initiate whisper — add manager to conference in muted (listen-only) mode
  async initiateWhisper(transferId: string): Promise<{ success: boolean; error?: string }> {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return { success: false, error: 'Whisper session not found' };

    try {
      const client = this.userClient(transfer.repAuth);
      type TransferResponse = {
        success: boolean;
        transferCallSid?: string;
        conferenceSid?: string;
        error?: string;
      };
      // use cold transfer to add participant without holding customer
      const result = await client.post<TransferResponse>(
        `/v1/calls/${transfer.callSid}/transfer`,
        {
          to: transfer.managerPhone,
          type: 'cold',
        },
      );

      if (!result.success) {
        transfer.status = 'cancelled';
        return { success: false, error: result.error ?? 'Whisper failed' };
      }

      transfer.transferCallSid = result.transferCallSid ?? null;
      transfer.conferenceSid = result.conferenceSid ?? null;
      transfer.status = 'consulting';

      // mute the manager participant so they can only listen
      if (result.conferenceSid && result.transferCallSid) {
        try {
          await client.post(`/v1/calls/${transfer.callSid}/hold`, {
            hold: false,
            participantCallSid: result.transferCallSid,
            muted: true,
          });
        } catch (muteErr: unknown) {
          logger.error('failed to mute whisper participant', {
            error: muteErr instanceof Error ? muteErr.message : 'unknown',
          });
          // non-fatal: manager joins unmuted, rep can ask them to mute
        }
      }

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      logger.error('whisper initiation failed', { transferId, error: message });
      transfer.status = 'cancelled';
      return { success: false, error: message };
    }
  }

  // create a pending transfer (before manager accepts)
  createPendingTransfer(params: {
    callSid: string;
    conferenceName: string;
    repDiscordId: string;
    repAuth: DiscordAuth;
    managerDiscordId: string;
    managerPhone: string;
    contactName: string;
    contactPhone: string;
    contactCompany: string;
    callDuration: number;
    type: 'warm' | 'whisper';
  }): string {
    const transferId = `xfer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.transfers.set(transferId, {
      ...params,
      transferId,
      conferenceSid: null,
      transferCallSid: null,
      status: 'pending',
      createdAt: Date.now(),
    });
    this.scheduleCleanup(transferId);
    return transferId;
  }

  getTransfer(transferId: string): TransferState | undefined {
    return this.transfers.get(transferId);
  }

  // find active transfer for a rep
  getActiveTransferForRep(repDiscordId: string): TransferState | undefined {
    for (const transfer of this.transfers.values()) {
      if (transfer.repDiscordId === repDiscordId && (transfer.status === 'pending' || transfer.status === 'consulting')) {
        return transfer;
      }
    }
    return undefined;
  }

  private scheduleCleanup(transferId: string): void {
    setTimeout(() => {
      this.transfers.delete(transferId);
    }, TRANSFER_TTL_MS);
  }

  async stop(): Promise<void> {
    if (this.redisClient) {
      this.redisClient.disconnect();
      this.redisClient = null;
    }
  }
}
