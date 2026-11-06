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
import { createCyclicRecoveryPager } from './worker-recovery';

export const createInboundTelephony = (options: TelephonyOptions) => {
  const { pool } = options;
  const capacity = createPostgresRepCapacity(pool, { clock: options.clock });
  const routing = createPostgresInboundRouting(pool, {
    clock: options.clock, phoneOfferMilliseconds: options.phoneOfferMilliseconds,
  });
  const journal = createPostgresInboundJournal(pool);
  const callbacks = options.callbackRecipientCipher
    ? createPostgresCallbacks({
        pool,
        recipientCipher: options.callbackRecipientCipher,
        clock: options.clock,
        consent: options.callbackConsent,
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
  const sessionsPage = createCyclicRecoveryPager();
  const pendingEffectsPage = createCyclicRecoveryPager();
  const prepareCapacityPage = createCyclicRecoveryPager();
  const reconcileCapacityPage = createCyclicRecoveryPager();
  const recordingsPage = createCyclicRecoveryPager();
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
      const processedWorkspaces = new Set<string>();
      for (let offset = 0; offset < queues.length; offset++) {
        const number = queues[(cursor + offset) % queues.length]!;
        try {
        const sessions = await sessionsPage(
          number.workspaceId + ':' + number.queueId,
          async (after, limit) => (
            await pool.query<TelephonySession>(
            `SELECT session.* FROM dialer_telephony_sessions session
             WHERE session.workspace_id=$1 AND session.queue_id=$2 AND (
               session.mode IN ('waiting','voicemail')
               OR (
                 session.mode='callback_requested'
                 AND NOT EXISTS (
                   SELECT 1 FROM dialer_callback_obligations obligation
                   WHERE obligation.workspace_id=session.workspace_id
                     AND obligation.request_id=session.request_id
                 )
               )
             ) AND session.request_id>$3
             ORDER BY session.request_id LIMIT $4`,
              [number.workspaceId, number.queueId, after, limit],
            )
          ).rows,
          (session) => session.request_id,
        );
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
        const queue = await pool.query(
          'SELECT 1 FROM dialer_routing_queues WHERE workspace_id=$1 AND queue_id=$2',
          [number.workspaceId, number.queueId],
        );
        // Retired queues stop allocating, while existing carrier effects still drain.
        if (queue.rowCount) await attempt(() =>
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
        // Queue routing is per number; provider recovery is per workspace.
        if (processedWorkspaces.has(number.workspaceId)) continue;
        processedWorkspaces.add(number.workspaceId);
        const states = await prepareCapacityPage(
          number.workspaceId,
          (after, limit) => capacity.list({
            workspaceId: number.workspaceId,
            ownedOnly: true,
            afterCapacityId: after || undefined,
            limit,
          }),
          (state) => state.capacityId,
        );
        for (const state of states)
          await attempt(() => commands.prepare(state));
        const pending = await pendingEffectsPage(
          number.workspaceId,
          (after, limit) =>
            pool.query<TelephonyEffect>(
              "SELECT * FROM dialer_telephony_effects WHERE workspace_id=$1 AND status='pending' AND effect_id>$2 ORDER BY effect_id LIMIT $3",
              [number.workspaceId, after, limit],
            ).then((result) => result.rows),
          (effect) => effect.effect_id,
        );
        for (const effect of pending)
          await attempt(() => commands.execute(effect));
        if (callbackTelephony)
          await attempt(() => callbackTelephony.executePending(number.workspaceId)
            .then((result) => { failures += result.failures; }));
        for (const state of await reconcileCapacityPage(
          number.workspaceId,
          (after, limit) => capacity.list({
            workspaceId: number.workspaceId,
            ownedOnly: true,
            afterCapacityId: after || undefined,
            limit,
          }),
          (state) => state.capacityId,
        ))
          await attempt(() => reconcile(state));
        if (callbackTelephony)
          await attempt(() => callbackTelephony.reconcile(number.workspaceId)
            .then((result) => { failures += result.failures; }));
        if (callbacks)
          await attempt(() => callbacks.purgeRecipients(number.workspaceId));
        const recordings = await recordingsPage(
          number.workspaceId,
          async (after, limit) => (
            await pool.query<{ recording_sid: string }>(
              'SELECT recording_sid FROM dialer_telephony_voicemail WHERE workspace_id=$1 AND deleted_at IS NULL AND expires_at<=$2 AND recording_sid>$3 ORDER BY recording_sid LIMIT $4',
              [number.workspaceId, options.clock?.() ?? new Date().toISOString(), after, limit],
            )
          ).rows,
          (recording) => recording.recording_sid,
        );
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
        } catch {
          // A failed scan or provider query for one tenant/queue must not
          // prevent independent workspaces from recovering in this cycle.
          failures++;
        }
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
