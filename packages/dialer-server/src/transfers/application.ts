import {
  DialerInfrastructureError,
  DialerRequestError,
  type ConferenceParticipant,
  type DialerApplicationError,
  type ParallelGroup,
  type TransferOptions,
  type TransferResult,
} from '@consuelo/dialer';
import { Effect } from 'effect';

import type {
  DialerTransferApplication,
  DialerTransferResult,
} from '../contracts';

export type PersistedTransferStatus =
  | 'initiating'
  | 'consulting'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type PersistedTransfer = {
  workspaceId: string;
  sessionId: string;
  transferId: string;
  groupId: string;
  type: 'cold' | 'warm';
  target: string;
  status: PersistedTransferStatus;
  conferenceSid: string | null;
  transferCallSid: string | null;
};

export type TransferEventInput = PersistedTransfer & {
  id: string;
  eventType:
    | 'transfer_initiated'
    | 'transfer_dialing'
    | 'transfer_consulting'
    | 'transfer_completed'
    | 'transfer_cancelled'
    | 'transfer_failed';
  error?: string;
};

export type TransferRepository = {
  recordEvent: (input: TransferEventInput) => Promise<void>;
  getTransfer: (input: {
    workspaceId: string;
    sessionId: string;
    transferId: string;
  }) => Promise<PersistedTransfer | null>;
  getTransferById: (transferId: string) => Promise<PersistedTransfer | null>;
};

export type TransferDialer = {
  findConferenceSid: (conferenceName: string) => Promise<string | null>;
  listParticipants: (
    conferenceSid: string,
  ) => Promise<ConferenceParticipant[]>;
  initiateTransfer: (input: TransferOptions) => Promise<TransferResult>;
  completeTransfer: (
    conferenceSid: string,
    agentCallSid: string,
  ) => Promise<TransferResult>;
  cancelTransfer: (
    conferenceSid: string,
    transferCallSid: string,
  ) => Promise<TransferResult>;
  holdParticipant: (
    conferenceSid: string,
    callSid: string,
    hold: boolean,
  ) => Promise<void>;
};

export type TransferApplicationInput = {
  loadGroup: (
    groupId: string,
    workspaceId: string,
  ) => Promise<ParallelGroup | null>;
  selectDialer: (groupId: string) => Promise<TransferDialer>;
  repository: TransferRepository;
  publicUrl: string;
  generateId: () => string;
};

const requestError = (code: string, message: string): DialerRequestError =>
  new DialerRequestError({ code, message, retryable: false });

const infrastructureError = (
  operation: string,
  cause: unknown,
): DialerInfrastructureError =>
  new DialerInfrastructureError({
    operation,
    message: cause instanceof Error ? cause.message : String(cause),
    retryable: true,
    cause,
  });

const effect = <T>(operation: string, run: () => Promise<T>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause): DialerApplicationError =>
      cause instanceof DialerRequestError
        ? cause
        : infrastructureError(operation, cause),
  });

const requireOwnedGroup = (
  group: ParallelGroup | null,
  input: { workspaceId: string; userId: string },
): ParallelGroup => {
  if (!group || group.workspaceId !== input.workspaceId) {
    throw requestError('CALL_SESSION_NOT_FOUND', 'Call session was not found');
  }
  if (group.userId !== input.userId) {
    throw requestError(
      'CALL_SESSION_FORBIDDEN',
      'Call session belongs to another user',
    );
  }
  if (!group.dialerSessionId) {
    throw requestError(
      'CALL_HISTORY_SESSION_REQUIRED',
      'Call session is not attached to durable history',
    );
  }
  return group;
};

const requireOwnedConnectedGroup = (
  group: ParallelGroup | null,
  input: { workspaceId: string; userId: string },
): ParallelGroup => {
  const owned = requireOwnedGroup(group, input);
  if (owned.status !== 'connected' || !owned.winnerSid) {
    throw requestError(
      'CALL_NOT_CONNECTED',
      'A connected customer call is required to transfer',
    );
  }
  return owned;
};

const requireWinner = (group: ParallelGroup) => {
  const winner = group.calls.find((call) => call.callSid === group.winnerSid);
  if (!winner) {
    throw requestError('WINNING_CALL_NOT_FOUND', 'Winning call leg was not found');
  }
  return winner;
};

const requireConference = async (
  dialer: TransferDialer,
  group: ParallelGroup,
) => {
  const conferenceSid = await dialer.findConferenceSid(group.conferenceName);
  if (!conferenceSid) {
    throw requestError('CONFERENCE_NOT_FOUND', 'Live conference was not found');
  }
  const participants = await dialer.listParticipants(conferenceSid);
  const agent = participants.find((participant) => participant.label === 'agent');
  if (!agent) {
    throw requestError('AGENT_NOT_FOUND', 'Live agent participant was not found');
  }
  return { conferenceSid, agent };
};

const transferEventId = (
  transferId: string,
  type: TransferEventInput['eventType'],
): string => transferId + ':' + type;

const record = (
  repository: TransferRepository,
  transfer: Omit<TransferEventInput, 'id'>,
): Promise<void> =>
  repository.recordEvent({
    ...transfer,
    id: transferEventId(transfer.transferId, transfer.eventType),
  });

const publicResult = (
  transferId: string,
  status: DialerTransferResult['status'],
  result: TransferResult,
): DialerTransferResult => ({
  success: result.success,
  transferId,
  ...(result.transferCallSid
    ? { transferCallSid: result.transferCallSid }
    : {}),
  ...(result.conferenceSid ? { conferenceSid: result.conferenceSid } : {}),
  status,
  ...(result.error ? { error: result.error } : {}),
});

export const createTransferApplication = (
  input: TransferApplicationInput,
): DialerTransferApplication => ({
  initiate: (command) =>
    effect('initiate-transfer', async () => {
      const group = requireOwnedConnectedGroup(
        await input.loadGroup(command.sessionId, command.workspaceId),
        command,
      );
      const winner = requireWinner(group);
      const dialer = await input.selectDialer(group.groupId);
      const { agent } = await requireConference(dialer, group);
      const transferId = input.generateId();
      const base: PersistedTransfer = {
        workspaceId: command.workspaceId,
        sessionId: group.dialerSessionId!,
        transferId,
        groupId: group.groupId,
        type: command.type,
        target: command.to,
        status: 'initiating',
        conferenceSid: null,
        transferCallSid: null,
      };
      await record(input.repository, {
        ...base,
        eventType: 'transfer_initiated',
      });
      const provider = await dialer.initiateTransfer({
        callSid: agent.callSid,
        conferenceName: group.conferenceName,
        to: command.to,
        from: winner.fromNumber,
        type: command.type,
        userId: command.userId,
        statusCallbackUrl:
          input.publicUrl.replace(/\/$/, '') +
          '/webhooks/twilio/transfer-status',
        transferId,
      });
      if (!provider.success) {
        await record(input.repository, {
          ...base,
          status: 'failed',
          conferenceSid: provider.conferenceSid ?? null,
          transferCallSid: provider.transferCallSid ?? null,
          eventType: 'transfer_failed',
          error: provider.error ?? 'Transfer failed',
        });
        return publicResult(transferId, 'failed', provider);
      }
      const status = command.type === 'warm' ? 'initiating' : 'completed';
      await record(input.repository, {
        ...base,
        status,
        conferenceSid: provider.conferenceSid ?? null,
        transferCallSid: provider.transferCallSid ?? null,
        eventType:
          command.type === 'warm'
            ? 'transfer_dialing'
            : 'transfer_completed',
      });
      return publicResult(transferId, status, provider);
    }),
  getStatus: (command) =>
    effect('get-transfer-status', async () => {
      const group = requireOwnedGroup(
        await input.loadGroup(command.sessionId, command.workspaceId),
        command,
      );
      const transfer = await input.repository.getTransfer({
        workspaceId: command.workspaceId,
        sessionId: group.dialerSessionId!,
        transferId: command.transferId,
      });
      if (!transfer || transfer.groupId !== group.groupId) {
        throw requestError('TRANSFER_NOT_FOUND', 'Transfer was not found');
      }
      return publicResult(command.transferId, transfer.status, {
        success: transfer.status !== 'failed',
        ...(transfer.transferCallSid
          ? { transferCallSid: transfer.transferCallSid }
          : {}),
        ...(transfer.conferenceSid
          ? { conferenceSid: transfer.conferenceSid }
          : {}),
      });
    }),
  complete: (command) =>
    effect('complete-transfer', async () => {
      const group = requireOwnedConnectedGroup(
        await input.loadGroup(command.sessionId, command.workspaceId),
        command,
      );
      const transfer = await input.repository.getTransfer({
        workspaceId: command.workspaceId,
        sessionId: group.dialerSessionId!,
        transferId: command.transferId,
      });
      if (
        !transfer ||
        transfer.groupId !== group.groupId ||
        transfer.type !== 'warm' ||
        transfer.status !== 'consulting' ||
        !transfer.conferenceSid
      ) {
        throw requestError(
          'WARM_TRANSFER_NOT_FOUND',
          'An active warm consultation was not found',
        );
      }
      const dialer = await input.selectDialer(group.groupId);
      const { agent } = await requireConference(dialer, group);
      const provider = await dialer.completeTransfer(
        transfer.conferenceSid,
        agent.callSid,
      );
      const status = provider.success ? 'completed' : 'failed';
      await record(input.repository, {
        ...transfer,
        status,
        eventType: provider.success
          ? 'transfer_completed'
          : 'transfer_failed',
        ...(provider.error ? { error: provider.error } : {}),
      });
      return publicResult(command.transferId, status, provider);
    }),
  cancel: (command) =>
    effect('cancel-transfer', async () => {
      const group = requireOwnedConnectedGroup(
        await input.loadGroup(command.sessionId, command.workspaceId),
        command,
      );
      const transfer = await input.repository.getTransfer({
        workspaceId: command.workspaceId,
        sessionId: group.dialerSessionId!,
        transferId: command.transferId,
      });
      if (
        !transfer ||
        transfer.groupId !== group.groupId ||
        transfer.type !== 'warm' ||
        transfer.status !== 'consulting' ||
        !transfer.conferenceSid ||
        !transfer.transferCallSid
      ) {
        throw requestError(
          'WARM_TRANSFER_NOT_FOUND',
          'An active warm consultation was not found',
        );
      }
      const dialer = await input.selectDialer(group.groupId);
      const provider = await dialer.cancelTransfer(
        transfer.conferenceSid,
        transfer.transferCallSid,
      );
      const status = provider.success ? 'cancelled' : 'failed';
      await record(input.repository, {
        ...transfer,
        status,
        eventType: provider.success
          ? 'transfer_cancelled'
          : 'transfer_failed',
        ...(provider.error ? { error: provider.error } : {}),
      });
      return publicResult(command.transferId, status, provider);
    }),
  processStatusCallback: (command) =>
    effect('process-transfer-status', async () => {
      const transfer = await input.repository.getTransferById(command.transferId);
      if (!transfer) {
        throw requestError(
          'TRANSFER_NOT_FOUND',
          'Transfer was not found for provider callback',
        );
      }
      if (
        transfer.transferCallSid &&
        transfer.transferCallSid !== command.callSid
      ) {
        throw requestError(
          'TRANSFER_CALL_MISMATCH',
          'Transfer provider call does not match persisted state',
        );
      }
      if (
        transfer.status === 'completed' ||
        transfer.status === 'cancelled' ||
        transfer.status === 'failed'
      ) {
        return { received: true as const, status: transfer.status };
      }

      const providerStatus = command.callStatus.trim().toLowerCase();
      if (providerStatus === 'answered' || providerStatus === 'in-progress') {
        const status = transfer.type === 'warm' ? 'consulting' : 'completed';
        await record(input.repository, {
          ...transfer,
          status,
          eventType:
            transfer.type === 'warm'
              ? 'transfer_consulting'
              : 'transfer_completed',
        });
        return { received: true as const, status };
      }

      const terminal = new Set([
        'busy',
        'canceled',
        'cancelled',
        'completed',
        'failed',
        'no-answer',
      ]);
      if (!terminal.has(providerStatus)) {
        return { received: true as const, status: transfer.status };
      }

      if (transfer.type === 'warm' && transfer.conferenceSid) {
        const dialer = await input.selectDialer(transfer.groupId);
        const participants = await dialer.listParticipants(
          transfer.conferenceSid,
        );
        const target = participants.find(
          (participant) =>
            participant.callSid === transfer.transferCallSid ||
            participant.label === 'transfer-target',
        );
        const customer = participants.find(
          (participant) => participant.label === 'customer',
        );
        if (target && transfer.transferCallSid) {
          const cancelled = await dialer.cancelTransfer(
            transfer.conferenceSid,
            transfer.transferCallSid,
          );
          if (!cancelled.success && customer?.hold) {
            await dialer.holdParticipant(
              transfer.conferenceSid,
              customer.callSid,
              false,
            );
          }
        } else if (customer?.hold) {
          await dialer.holdParticipant(
            transfer.conferenceSid,
            customer.callSid,
            false,
          );
        }
      }

      const status =
        transfer.type === 'cold' && providerStatus === 'completed'
          ? 'completed'
          : 'failed';
      await record(input.repository, {
        ...transfer,
        status,
        eventType:
          status === 'completed'
            ? 'transfer_completed'
            : 'transfer_failed',
        ...(status === 'failed'
          ? { error: 'Provider status: ' + providerStatus }
          : {}),
      });
      return { received: true as const, status };
    }),
});
