import { createTelephonyReconciliation } from './telephony-reconciliation';
import { createPostgresCallbacks } from './callbacks';
import { createCallbackTelephony } from './callback-telephony';
import { randomUUID } from 'node:crypto';
import { Effect } from 'effect';
import type { RepCapacityState, InboundStoredCommand } from '@consuelo/dialer';
import {
  createPostgresInboundJournal,
  readInboundSnapshot,
  withInboundTransaction,
} from './postgres-journal';
import {
  createPostgresRepCapacity,
  executeRepCapacityOnClient,
} from './rep-capacity';
import { createPostgresInboundRouting } from './routing';
import {
  createTelephonyAdmission,
  type TelephonyOptions,
} from './telephony-admission';
import { createTelephonyCommands } from './telephony-commands';
import {
  readTelephonyCapacity,
  readTelephonySession,
  readTelephonyEffects,
  moveTelephonyEntity,
  recordTelephonyFact,
  telephonyId,
} from './telephony-store';
import {
  terminalCarrierStatus,
  type TelephonyEffect,
  type TelephonySession,
} from './telephony-contracts';

export const createInboundTelephony = (options: TelephonyOptions) => {
  const { pool } = options;
  const capacity = createPostgresRepCapacity(pool, { clock: options.clock });
  const routing = createPostgresInboundRouting(pool, { clock: options.clock });
  const journal = createPostgresInboundJournal(pool);
  const callbacks = options.callbackRecipientCipher
    ? createPostgresCallbacks({
        pool,
        recipientCipher: options.callbackRecipientCipher,
        clock: options.clock,
      })
    : null;
  const callbackTelephony = callbacks
    ? createCallbackTelephony(options, callbacks)
    : null;
  const admission = createTelephonyAdmission(options);
  const commands = createTelephonyCommands(options);
  const { reportCaller, reconcile } = createTelephonyReconciliation(
    options,
    commands,
  );
  let running = false;
  let cursor = 0;
  const tick = async () => {
    if (running) return { skipped: true, failures: 0 };
    running = true;
    let failures = 0;
    const attempt = async (operation: () => Promise<unknown>) => {
      try {
        await operation();
      } catch {
        failures++;
      }
    };
    try {
      const queues = [
        ...new Map(
          options.numbers.map((number) => [
            number.workspaceId + ':' + number.queueId,
            number,
          ]),
        ).values(),
      ];
      for (let offset = 0; offset < queues.length; offset++) {
        const number = queues[(cursor + offset) % queues.length]!;
        const sessions = (
          await pool.query<TelephonySession>(
            "SELECT * FROM dialer_telephony_sessions WHERE workspace_id=$1 AND queue_id=$2 AND mode IN ('waiting','voicemail') ORDER BY request_id LIMIT 1001",
            [number.workspaceId, number.queueId],
          )
        ).rows;
        if (sessions.length > 1000)
          throw new Error('Inbound scan bound exceeded');
        for (const session of sessions)
          await attempt(async () => {
            try {
              const call = await options.carrier.call(session.caller_sid);
              if (call.accountSid !== number.accountSid)
                throw new Error('Account mismatch');
              await reportCaller(session, call.status);
            } catch (cause: unknown) {
              if (cause instanceof Error) throw cause;
              throw new Error(
                'Async operation rejected with a non-Error cause',
                { cause },
              );
            }
          });
        await attempt(() =>
          callbacks
            ? callbacks.tick({
                workspaceId: number.workspaceId,
                queueId: number.queueId,
                cycleId: 'tel:' + randomUUID(),
              })
            : routing.tick({
                workspaceId: number.workspaceId,
                queueId: number.queueId,
                decisionId: 'tel:' + randomUUID(),
              }),
        );
        const states = await capacity.list({
          workspaceId: number.workspaceId,
          ownedOnly: true,
          limit: 1000,
        });
        for (const state of states)
          await attempt(() => commands.prepare(state));
        const pending = (
          await pool.query<TelephonyEffect>(
            "SELECT * FROM dialer_telephony_effects WHERE workspace_id=$1 AND status='pending' ORDER BY effect_id LIMIT 100",
            [number.workspaceId],
          )
        ).rows;
        for (const effect of pending)
          await attempt(() => commands.execute(effect));
        if (callbackTelephony)
          await attempt(() => callbackTelephony.executePending(number.workspaceId));
        for (const state of await capacity.list({
          workspaceId: number.workspaceId,
          ownedOnly: true,
          limit: 1000,
        }))
          await attempt(() => reconcile(state));
        if (callbackTelephony)
          await attempt(() => callbackTelephony.reconcile(number.workspaceId));
        if (callbacks)
          await attempt(() => callbacks.purgeRecipients(number.workspaceId));
        const recordings = (
          await pool.query<{ recording_sid: string }>(
            'SELECT recording_sid FROM dialer_telephony_voicemail WHERE workspace_id=$1 AND deleted_at IS NULL AND expires_at<=$2 ORDER BY expires_at LIMIT 100',
            [number.workspaceId, options.clock?.() ?? new Date().toISOString()],
          )
        ).rows;
        for (const recording of recordings)
          await attempt(async () => {
            try {
              await options.carrier.deleteRecording(recording.recording_sid);
              await pool.query(
                'UPDATE dialer_telephony_voicemail SET deleted_at=clock_timestamp() WHERE workspace_id=$1 AND recording_sid=$2',
                [number.workspaceId, recording.recording_sid],
              );
            } catch (cause: unknown) {
              if (cause instanceof Error) throw cause;
              throw new Error(
                'Async operation rejected with a non-Error cause',
                { cause },
              );
            }
          });
      }
      cursor = queues.length ? (cursor + 1) % queues.length : 0;
      return { skipped: false, failures };
    } finally {
      running = false;
    }
  };
  const handle = async (
    numberId: string,
    action: string,
    facts: Record<string, string>,
    reference?: string,
  ) => {
    try {
      const number = options.numbers.find((item) => item.numberId === numberId);
      if (action === 'callback-join' || action === 'callback-status') {
        if (!callbackTelephony || !reference)
          throw new Error('Callback telephony is not enabled');
        return callbackTelephony.handle(numberId, action, facts, reference);
      }
      if (action === 'caller-status') {
        if (!number || facts.AccountSid !== number.accountSid || !facts.CallSid)
          throw new Error('Caller status account mismatch');
        const session = await readTelephonySession(
          pool,
          number.workspaceId,
          telephonyId(number.accountSid, facts.CallSid),
        );
        if (!session || session.number_id !== numberId)
          throw new Error('Caller status binding missing');
        await reportCaller(session, facts.CallStatus ?? '');
        return '<Response/>';
      }
      return admission.handle(numberId, action, facts, reference);
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', {
        cause,
      });
    }
  };
  const effect = <T>(operation: () => Promise<T>) =>
    Effect.tryPromise({
      try: operation,
      catch: (cause) =>
        new Error('Inbound telephony operation failed', { cause }),
    });
  return {
    publicUrl: options.publicUrl,
    authToken: options.authToken,
    handle: (
      numberId: string,
      action: string,
      facts: Record<string, string>,
      reference?: string,
    ) =>
      Effect.runPromise(
        effect(() => handle(numberId, action, facts, reference)),
      ),
    accept: admission.accept,
    tick,
    reconcile,
    commands,
    callbacks,
    callbackTelephony,
    application: {
      tick: () => effect(tick),
      accept: (input: Parameters<typeof admission.accept>[0]) =>
        effect(() => admission.accept(input)),
    },
  };
};
