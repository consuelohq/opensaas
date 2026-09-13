import type { Pool, PoolClient } from 'pg';
import type { InboundStoredCommand, RepCapacityState } from '@consuelo/dialer';
import { createPostgresInboundJournal, withInboundTransaction } from './postgres-journal';
import { createPostgresRepCapacity, executeRepCapacityOnClient } from './rep-capacity';
import { conferenceTwiml, hangupTwiml } from './telephony-twiml';
import { telephonyUrl, type TelephonyOptions } from './telephony-admission';
import {
  readTelephonyCapacity,
  readTelephonyEffects,
  readTelephonySession,
  telephonyId,
} from './telephony-store';
import { terminalCarrierStatus } from './telephony-contracts';
import type { createPostgresCallbacks } from './callbacks';

export type CallbackEffect = {
  workspace_id: string;
  callback_id: string;
  attempt_id: string;
  effect_kind:
    | 'rep_bridge'
    | 'customer_dial'
    | 'terminate_rep'
    | 'terminate_customer';
  command_id: string;
  status: 'pending' | 'dispatched' | 'unknown' | 'succeeded' | 'failed';
  call_sid: string | null;
};

type CallbackCommand = {
  command: InboundStoredCommand['command'];
  version: number;
  status: InboundStoredCommand['status'];
};

type CallbackRuntime = ReturnType<typeof createPostgresCallbacks>;

const readCommand = async (
  client: Pool | PoolClient,
  workspaceId: string,
  commandId: string,
): Promise<CallbackCommand | null> => {
  try {
    const row = await client.query<CallbackCommand>(
      'SELECT command,version,status FROM dialer_inbound_commands WHERE workspace_id=$1 AND command_id=$2',
      [workspaceId, commandId],
    );
    return row.rows[0] ?? null;
  } catch (cause: unknown) {
    if (cause instanceof Error) throw cause;
    throw new Error('Async operation rejected with a non-Error cause', { cause });
  }
};

const readEffects = async (
  client: Pool | PoolClient,
  workspaceId: string,
  callbackId: string,
  attemptId: string,
): Promise<CallbackEffect[]> => {
  try {
    const rows = await client.query<CallbackEffect>(
      `SELECT * FROM dialer_callback_effects
       WHERE workspace_id=$1 AND callback_id=$2 AND attempt_id=$3
       ORDER BY CASE effect_kind
         WHEN 'rep_bridge' THEN 1 WHEN 'customer_dial' THEN 2
         WHEN 'terminate_rep' THEN 3 ELSE 4 END`,
      [workspaceId, callbackId, attemptId],
    );
    return rows.rows;
  } catch (cause: unknown) {
    if (cause instanceof Error) throw cause;
    throw new Error('Async operation rejected with a non-Error cause', { cause });
  }
};

export const createCallbackTelephony = (
  options: TelephonyOptions,
  callbacks: CallbackRuntime,
) => {
  const { pool } = options;
  const capacity = createPostgresRepCapacity(pool, { clock: options.clock });
  const journal = createPostgresInboundJournal(pool);

  const createEffects = async (command: InboundStoredCommand) => {
    try {
      return withInboundTransaction(
        pool,
        command.workspaceId,
        async (client) => {
          try {
            const current = await readCommand(
              client,
              command.workspaceId,
              command.command.commandId,
            );
            if (!current || current.command.type !== 'start_callback') return null;
            const callback = await callbacks.read(
              command.workspaceId,
              current.command.entityId,
            );
            const attempt = callback?.state.attempts[callback.state.attempts.length - 1];
            if (!callback || !attempt || callback.state.status !== 'dialing') return null;
            const state = await readTelephonyCapacity(
              client,
              command.workspaceId,
              attempt.capacityId,
            );
            if (
              !state?.owner ||
              state.owner.assignmentId !== attempt.assignmentId ||
              state.owner.generation !== attempt.generation ||
              state.owner.phase !== 'connecting' ||
              !state.owner.winnerEndpointId
            )
              return null;
            const rep = (
              await client.query<{ call_sid: string | null; status: string }>(
                `SELECT call_sid,status FROM dialer_telephony_effects
                 WHERE workspace_id=$1 AND assignment_id=$2
                   AND endpoint_id=$3 AND kind='offer'`,
                [
                  command.workspaceId,
                  attempt.assignmentId,
                  state.owner.winnerEndpointId,
                ],
              )
            ).rows[0];
            if (!rep?.call_sid || rep.status !== 'succeeded') return null;
            const rows: CallbackEffect[] = [
              {
                workspace_id: command.workspaceId,
                callback_id: callback.state.callbackId,
                attempt_id: attempt.attemptId,
                effect_kind: 'rep_bridge',
                command_id: current.command.commandId,
                status: 'pending',
                call_sid: rep.call_sid,
              },
              {
                workspace_id: command.workspaceId,
                callback_id: callback.state.callbackId,
                attempt_id: attempt.attemptId,
                effect_kind: 'customer_dial',
                command_id: current.command.commandId,
                status: 'pending',
                call_sid: null,
              },
            ];
            for (const effect of rows)
              await client.query(
                `INSERT INTO dialer_callback_effects(
                   workspace_id,callback_id,attempt_id,effect_kind,command_id,status,call_sid
                 ) VALUES($1,$2,$3,$4,$5,$6,$7)
                 ON CONFLICT(workspace_id,callback_id,attempt_id,effect_kind) DO NOTHING`,
                [
                  effect.workspace_id,
                  effect.callback_id,
                  effect.attempt_id,
                  effect.effect_kind,
                  effect.command_id,
                  effect.status,
                  effect.call_sid,
                ],
              );
            if (current.status === 'pending') {
              await executeRepCapacityOnClient(
                client,
                {
                  workspaceId: command.workspaceId,
                  capacityId: state.capacityId,
                  expectedVersion: state.version,
                  operationId: telephonyId(current.command.commandId, 'dispatch'),
                  action: {
                    type: 'dispatch',
                    commandId: current.command.commandId,
                    assignmentId: attempt.assignmentId,
                    generation: attempt.generation,
                  },
                },
                { clock: options.clock },
              );
            }
            return {
              callback,
              attempt,
              state,
              commandId: current.command.commandId,
            };
          } catch (cause: unknown) {
            if (cause instanceof Error) throw cause;
            throw new Error('Async operation rejected with a non-Error cause', {
              cause,
            });
          }
        },
      );
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const markUnknown = async (
    workspaceId: string,
    callbackId: string,
    attemptId: string,
    commandId: string,
  ) => {
    try {
      const callback = await callbacks.read(workspaceId, callbackId);
      const attempt = callback?.state.attempts.find(
        (candidate) => candidate.attemptId === attemptId,
      );
      if (!callback || !attempt) return;
      const current = await capacity.read(workspaceId, attempt.capacityId);
      if (
        current?.owner &&
        current.owner.assignmentId === attempt.assignmentId &&
        current.owner.phase !== 'unknown' &&
        current.owner.phase !== 'wrap_up'
      )
        await capacity.execute({
          workspaceId,
          capacityId: attempt.capacityId,
          expectedVersion: current.version,
          operationId: telephonyId(commandId, 'unknown-capacity'),
          action: {
            type: 'unknown',
            assignmentId: attempt.assignmentId,
            generation: attempt.generation,
          },
        });
      const latest = await callbacks.read(workspaceId, callbackId);
      if (latest?.state.status === 'dialing')
        await callbacks.recordAttemptResult({
          workspaceId,
          callbackId,
          operationId: telephonyId(commandId, 'unknown-callback'),
          attemptId,
          outcome: 'unknown',
          reconciled: false,
        });
      const command = await readCommand(pool, workspaceId, commandId);
      if (command?.status === 'dispatched')
        await journal.updateCommand(
          workspaceId,
          commandId,
          command.version,
          'unknown',
        );
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const settleCommand = async (
    workspaceId: string,
    commandId: string,
    callbackId: string,
    attemptId: string,
  ) => {
    try {
      const effects = await readEffects(pool, workspaceId, callbackId, attemptId);
      const command = await readCommand(pool, workspaceId, commandId);
      if (!command) return;
      if (effects.some((effect) => ['dispatched', 'unknown'].includes(effect.status))) {
        await markUnknown(workspaceId, callbackId, attemptId, commandId);
        return;
      }
      if (
        effects.length >= 2 &&
        effects
          .filter((effect) => ['rep_bridge', 'customer_dial'].includes(effect.effect_kind))
          .every((effect) => effect.status === 'succeeded')
      ) {
        if (command.status === 'dispatched')
          await journal.updateCommand(
            workspaceId,
            commandId,
            command.version,
            'succeeded',
          );
        else if (command.status === 'unknown')
          await journal.updateCommand(
            workspaceId,
            commandId,
            command.version,
            'succeeded',
            true,
          );
      }
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const executeEffect = async (original: CallbackEffect) => {
    try {
      const claimed = await withInboundTransaction(
        pool,
        original.workspace_id,
        async (client) => {
          try {
            const row = (
              await client.query<CallbackEffect>(
                `SELECT * FROM dialer_callback_effects
                 WHERE workspace_id=$1 AND callback_id=$2 AND attempt_id=$3 AND effect_kind=$4
                 FOR UPDATE`,
                [
                  original.workspace_id,
                  original.callback_id,
                  original.attempt_id,
                  original.effect_kind,
                ],
              )
            ).rows[0];
            if (!row || row.status !== 'pending') return null;
            await client.query(
              `UPDATE dialer_callback_effects
               SET status='dispatched',updated_at=clock_timestamp()
               WHERE workspace_id=$1 AND callback_id=$2 AND attempt_id=$3 AND effect_kind=$4`,
              [row.workspace_id, row.callback_id, row.attempt_id, row.effect_kind],
            );
            return row;
          } catch (cause: unknown) {
            if (cause instanceof Error) throw cause;
            throw new Error('Async operation rejected with a non-Error cause', {
              cause,
            });
          }
        },
      );
      if (!claimed) return;
      const callback = await callbacks.read(
        claimed.workspace_id,
        claimed.callback_id,
      );
      if (!callback) throw new Error('Callback obligation disappeared');
      const number = options.numbers.find(
        (candidate) => candidate.numberId === callback.numberId,
      );
      if (!number) throw new Error('Callback number configuration is unavailable');
      const session = await readTelephonySession(
        pool,
        claimed.workspace_id,
        callback.state.requestId,
      );
      if (!session) throw new Error('Callback telephony session is unavailable');
      let callSid = claimed.call_sid;
      if (claimed.effect_kind === 'rep_bridge') {
        if (!callSid) throw new Error('Callback rep call is missing');
        const rep = await options.carrier.call(callSid);
        if (rep.accountSid !== number.accountSid || terminalCarrierStatus(rep.status))
          throw new Error('Callback rep is no longer available');
        await options.carrier.redirect(
          callSid,
          conferenceTwiml(
            session.conference_name,
            telephonyUrl(
              options,
              number.numberId,
              'conference',
              session.request_id,
            ),
            'rep',
          ),
        );
      } else if (claimed.effect_kind === 'customer_dial') {
        const recipient = await callbacks.readRecipient(
          claimed.workspace_id,
          claimed.callback_id,
        );
        const call = await options.carrier.offer({
          to: recipient,
          from: number.did,
          url: telephonyUrl(
            options,
            number.numberId,
            'callback-join',
            claimed.callback_id,
          ),
          statusCallback: telephonyUrl(
            options,
            number.numberId,
            'callback-status',
            claimed.callback_id,
          ),
          timeoutSeconds: callback.policy.customerRingSeconds,
        });
        if (call.accountSid !== number.accountSid)
          throw new Error('Callback customer provider account mismatch');
        callSid = call.sid;
      } else {
        if (!callSid) throw new Error('Callback termination call is missing');
        await options.carrier.end(callSid);
      }
      const result = await pool.query(
        `UPDATE dialer_callback_effects
         SET status='succeeded',call_sid=$5,updated_at=clock_timestamp()
         WHERE workspace_id=$1 AND callback_id=$2 AND attempt_id=$3 AND effect_kind=$4
           AND status='dispatched' AND (call_sid IS NULL OR call_sid=$5)`,
        [
          claimed.workspace_id,
          claimed.callback_id,
          claimed.attempt_id,
          claimed.effect_kind,
          callSid,
        ],
      );
      if (result.rowCount !== 1)
        throw new Error('Callback provider correlation changed');
    } catch (cause: unknown) {
      await pool.query(
        `UPDATE dialer_callback_effects
         SET status='unknown',updated_at=clock_timestamp()
         WHERE workspace_id=$1 AND callback_id=$2 AND attempt_id=$3 AND effect_kind=$4
           AND status='dispatched'`,
        [
          original.workspace_id,
          original.callback_id,
          original.attempt_id,
          original.effect_kind,
        ],
      );
      await markUnknown(
        original.workspace_id,
        original.callback_id,
        original.attempt_id,
        original.command_id,
      );
      if (cause instanceof Error) return;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const ensureTermination = async (
    workspaceId: string,
    callbackId: string,
    attemptId: string,
    commandId: string,
    role: 'rep' | 'customer',
    callSid: string,
  ) => {
    try {
      const kind = role === 'rep' ? 'terminate_rep' : 'terminate_customer';
      await pool.query(
        `INSERT INTO dialer_callback_effects(
           workspace_id,callback_id,attempt_id,effect_kind,command_id,status,call_sid
         ) VALUES($1,$2,$3,$4,$5,'pending',$6)
         ON CONFLICT(workspace_id,callback_id,attempt_id,effect_kind) DO NOTHING`,
        [workspaceId, callbackId, attemptId, kind, commandId, callSid],
      );
      const effect = (await readEffects(pool, workspaceId, callbackId, attemptId)).find(
        (candidate) => candidate.effect_kind === kind,
      );
      if (effect?.status === 'pending') await executeEffect(effect);
      return effect;
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const reconcilePreAttemptCancellation = async (
    workspaceId: string,
    callbackId: string,
  ) => {
    try {
      const callback = await callbacks.read(workspaceId, callbackId);
      if (
        !callback ||
        callback.state.status !== 'cancel_pending' ||
        callback.state.attempts.length !== 0
      )
        return;
      const owned = await pool.query<{
        snapshot: import('@consuelo/dialer').RepCapacityState;
      }>(
        `SELECT snapshot FROM dialer_rep_capacity
         WHERE workspace_id=$1 AND snapshot->'owner'->>'requestId'=$2 LIMIT 2`,
        [workspaceId, callback.state.requestId],
      );
      if (owned.rows.length > 1)
        throw new Error('Callback request owns more than one capacity slot');
      let state: RepCapacityState | null | undefined = owned.rows[0]?.snapshot;
      if (!state?.owner) {
        await callbacks.cancel({
          workspaceId,
          callbackId,
          operationId: telephonyId(callbackId, 'preaccept-cancel-final'),
          reconciled: true,
        });
        return;
      }
      const owner = state.owner;
      const number = options.numbers.find(
        (candidate) => candidate.numberId === callback.numberId,
      );
      if (!number) throw new Error('Callback number configuration is unavailable');

      // A pending offer has not crossed the provider boundary. Once cancellation
      // has fenced the assignment, it must never be dispatched later.
      await pool.query(
        `UPDATE dialer_telephony_effects SET status='failed',updated_at=clock_timestamp()
         WHERE workspace_id=$1 AND assignment_id=$2 AND kind='offer' AND status='pending'`,
        [workspaceId, owner.assignmentId],
      );
      const offers = await readTelephonyEffects(pool, workspaceId, owner.assignmentId);
      for (const offer of offers.filter((effect) => effect.kind === 'offer')) {
        if (!offer.call_sid) continue;
        const call = await options.carrier.call(offer.call_sid);
        if (call.accountSid !== number.accountSid)
          throw new Error('Callback rep provider account mismatch');
        if (!terminalCarrierStatus(call.status))
          await ensureTermination(
            workspaceId,
            callbackId,
            telephonyId(callbackId, offer.effect_id, 'preaccept'),
            offer.command_id,
            'rep',
            offer.call_sid,
          );
      }

      const refreshedOffers = await readTelephonyEffects(
        pool,
        workspaceId,
        owner.assignmentId,
      );
      if (
        refreshedOffers.some(
          (offer) =>
            offer.kind === 'offer' &&
            !offer.call_sid &&
            ['dispatched', 'unknown', 'succeeded'].includes(offer.status),
        )
      )
        return;
      for (const offer of refreshedOffers.filter(
        (effect) => effect.kind === 'offer' && effect.call_sid,
      )) {
        const call = await options.carrier.call(offer.call_sid!);
        if (
          call.accountSid !== number.accountSid ||
          !terminalCarrierStatus(call.status)
        )
          return;
      }

      state = await capacity.read(workspaceId, state.capacityId);
      if (state?.owner && state.owner.assignmentId === owner.assignmentId) {
        if (['offering', 'connecting'].includes(state.owner.phase)) {
          state = (
            await capacity.execute({
              workspaceId,
              capacityId: state.capacityId,
              expectedVersion: state.version,
              operationId: telephonyId(callbackId, 'preaccept-capacity-cancel'),
              action: {
                type: 'cancel',
                assignmentId: owner.assignmentId,
                generation: owner.generation,
              },
            })
          ).state;
        }
        if (state.owner?.phase === 'unknown')
          state = (
            await capacity.execute({
              workspaceId,
              capacityId: state.capacityId,
              expectedVersion: state.version,
              operationId: telephonyId(callbackId, 'preaccept-no-effect'),
              action: {
                type: 'reconcile',
                assignmentId: owner.assignmentId,
                generation: owner.generation,
                outcome: 'no_effect',
                evidenceId: telephonyId(callbackId, 'preaccept-all-rep-legs-ended'),
              },
            })
          ).state;
      }
      if (!state?.owner)
        await callbacks.cancel({
          workspaceId,
          callbackId,
          operationId: telephonyId(callbackId, 'preaccept-cancel-final'),
          reconciled: true,
        });
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const reconcileOne = async (workspaceId: string, callbackId: string) => {
    try {
      const callback = await callbacks.read(workspaceId, callbackId);
      const attempt = callback?.state.attempts[callback.state.attempts.length - 1];
      if (!callback) return;
      if (!attempt) {
        await reconcilePreAttemptCancellation(workspaceId, callbackId);
        return;
      }
      if (
        !['dialing', 'unknown', 'connected', 'cancel_pending'].includes(
          callback.state.status,
        )
      )
        return;
      const state = await capacity.read(workspaceId, attempt.capacityId);
      if (
        !state?.owner ||
        state.owner.assignmentId !== attempt.assignmentId ||
        state.owner.generation !== attempt.generation
      )
        return;
      const effects = await readEffects(pool, workspaceId, callbackId, attempt.attemptId);
      const rep = effects.find((effect) => effect.effect_kind === 'rep_bridge');
      const customer = effects.find((effect) => effect.effect_kind === 'customer_dial');
      const unresolved = effects.some((effect) =>
        ['dispatched', 'unknown'].includes(effect.status),
      );
      if (unresolved || !rep?.call_sid || !customer?.call_sid) {
        if (unresolved) await markUnknown(workspaceId, callbackId, attempt.attemptId, rep?.command_id ?? customer?.command_id ?? telephonyId(callbackId, 'unknown'));
        return;
      }
      const number = options.numbers.find(
        (candidate) => candidate.numberId === callback.numberId,
      );
      const session = await readTelephonySession(
        pool,
        workspaceId,
        callback.state.requestId,
      );
      if (!number || !session) return;
      const [repCall, customerCall, participants] = await Promise.all([
        options.carrier.call(rep.call_sid),
        options.carrier.call(customer.call_sid),
        options.carrier.participants(session.conference_name),
      ]);
      if (
        repCall.accountSid !== number.accountSid ||
        customerCall.accountSid !== number.accountSid
      )
        throw new Error('Callback provider account mismatch during reconciliation');
      const participantIds = new Set(participants.map((participant) => participant.callSid));
      const bothJoined =
        participantIds.has(rep.call_sid) && participantIds.has(customer.call_sid);
      if (
        bothJoined &&
        ['connecting', 'unknown'].includes(state.owner.phase) &&
        !state.owner.connectedAt
      ) {
        const connected = await capacity.execute({
          workspaceId,
          capacityId: state.capacityId,
          expectedVersion: state.version,
          operationId: telephonyId(attempt.attemptId, 'participants-connected'),
          action: {
            type: 'reconcile',
            assignmentId: attempt.assignmentId,
            generation: attempt.generation,
            outcome: 'connected',
            evidenceId: telephonyId(attempt.attemptId, 'participants'),
          },
        });
        if (callback.state.status !== 'connected')
          await callbacks.recordAttemptResult({
            workspaceId,
            callbackId,
            operationId: telephonyId(attempt.attemptId, 'connected'),
            attemptId: attempt.attemptId,
            outcome: 'connected',
            reconciled: true,
          });
        return connected.state;
      }
      const repEnded = terminalCarrierStatus(repCall.status);
      const customerEnded = terminalCarrierStatus(customerCall.status);
      if (callback.state.status === 'cancel_pending') {
        if (!repEnded)
          await ensureTermination(
            workspaceId,
            callbackId,
            attempt.attemptId,
            rep.command_id,
            'rep',
            rep.call_sid,
          );
        if (!customerEnded)
          await ensureTermination(
            workspaceId,
            callbackId,
            attempt.attemptId,
            customer.command_id,
            'customer',
            customer.call_sid,
          );
        const freshRep = await options.carrier.call(rep.call_sid);
        const freshCustomer = await options.carrier.call(customer.call_sid);
        if (
          terminalCarrierStatus(freshRep.status) &&
          terminalCarrierStatus(freshCustomer.status)
        ) {
          const freshCapacity = await capacity.read(workspaceId, attempt.capacityId);
          if (freshCapacity?.owner) {
            await capacity.execute({
              workspaceId,
              capacityId: freshCapacity.capacityId,
              expectedVersion: freshCapacity.version,
              operationId: telephonyId(attempt.attemptId, 'cancel-release'),
              action: {
                type: 'reconcile',
                assignmentId: attempt.assignmentId,
                generation: attempt.generation,
                outcome: freshCapacity.owner.connectedAt ? 'ended' : 'no_effect',
                evidenceId: telephonyId(attempt.attemptId, 'cancel-ended'),
              },
            });
          }
          await callbacks.cancel({
            workspaceId,
            callbackId,
            operationId: telephonyId(attempt.attemptId, 'cancel-reconciled'),
            reconciled: true,
          });
        }
        return;
      }
      if (
        ['dialing', 'unknown'].includes(callback.state.status) &&
        !bothJoined &&
        (repEnded || customerEnded)
      ) {
        if (!repEnded)
          await ensureTermination(
            workspaceId,
            callbackId,
            attempt.attemptId,
            rep.command_id,
            'rep',
            rep.call_sid,
          );
        if (!customerEnded)
          await ensureTermination(
            workspaceId,
            callbackId,
            attempt.attemptId,
            customer.command_id,
            'customer',
            customer.call_sid,
          );
        const freshRep = await options.carrier.call(rep.call_sid);
        const freshCustomer = await options.carrier.call(customer.call_sid);
        if (
          terminalCarrierStatus(freshRep.status) &&
          terminalCarrierStatus(freshCustomer.status)
        ) {
          await callbacks.releaseAttemptCapacity({
            workspaceId,
            callbackId,
            operationId: telephonyId(attempt.attemptId, 'no-answer-release'),
            outcome: 'no_effect',
          });
          const latest = await callbacks.read(workspaceId, callbackId);
          if (['dialing', 'unknown'].includes(latest?.state.status ?? ''))
            await callbacks.recordAttemptResult({
              workspaceId,
              callbackId,
              operationId: telephonyId(attempt.attemptId, 'no-answer-result'),
              attemptId: attempt.attemptId,
              outcome: customerEnded ? 'no_answer' : 'failed',
              reconciled: latest?.state.status === 'unknown',
            });
        }
        return;
      }
      if (
        callback.state.status === 'connected' &&
        (repEnded || customerEnded)
      ) {
        if (!repEnded)
          await ensureTermination(
            workspaceId,
            callbackId,
            attempt.attemptId,
            rep.command_id,
            'rep',
            rep.call_sid,
          );
        if (!customerEnded)
          await ensureTermination(
            workspaceId,
            callbackId,
            attempt.attemptId,
            customer.command_id,
            'customer',
            customer.call_sid,
          );
        const current = await capacity.read(workspaceId, attempt.capacityId);
        if (current?.owner)
          await capacity.execute({
            workspaceId,
            capacityId: current.capacityId,
            expectedVersion: current.version,
            operationId: telephonyId(attempt.attemptId, 'connected-ended'),
            action: {
              type: 'reconcile',
              assignmentId: attempt.assignmentId,
              generation: attempt.generation,
              outcome: 'ended',
              evidenceId: telephonyId(attempt.attemptId, 'ended-evidence'),
            },
          });
      }
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const executePending = async (workspaceId: string) => {
    try {
      const commands = await journal.listCommands(workspaceId, 'pending');
      for (const command of commands.filter(
        (candidate) => candidate.command.type === 'start_callback',
      )) {
        const context = await createEffects(command);
        if (!context) continue;
        for (const effect of await readEffects(
          pool,
          workspaceId,
          context.callback.state.callbackId,
          context.attempt.attemptId,
        )) {
          if (effect.status !== 'pending') continue;
          if (
            effect.effect_kind === 'customer_dial' &&
            !(await readEffects(
              pool,
              workspaceId,
              context.callback.state.callbackId,
              context.attempt.attemptId,
            )).some(
              (candidate) =>
                candidate.effect_kind === 'rep_bridge' &&
                candidate.status === 'succeeded',
            )
          )
            continue;
          await executeEffect(effect);
        }
        await settleCommand(
          workspaceId,
          context.commandId,
          context.callback.state.callbackId,
          context.attempt.attemptId,
        );
      }
      const dispatched = await journal.listCommands(workspaceId, 'dispatched');
      const unknown = await journal.listCommands(workspaceId, 'unknown');
      for (const command of [...dispatched, ...unknown].filter(
        (candidate) => candidate.command.type === 'start_callback',
      )) {
        const callback = await callbacks.read(
          workspaceId,
          command.command.entityId,
        );
        const attempt = callback?.state.attempts[callback.state.attempts.length - 1];
        if (!callback || !attempt) continue;
        await settleCommand(
          workspaceId,
          command.command.commandId,
          callback.state.callbackId,
          attempt.attemptId,
        );
      }
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const reconcile = async (workspaceId: string) => {
    try {
      const rows = await pool.query<{ callback_id: string }>(
        `SELECT callback_id FROM dialer_callback_obligations
         WHERE workspace_id=$1 AND state->>'status' IN ('dialing','unknown','connected','cancel_pending')
         ORDER BY callback_id LIMIT 1001`,
        [workspaceId],
      );
      if (rows.rows.length > 1000)
        throw new Error('Callback reconciliation scan bound exceeded');
      for (const row of rows.rows) await reconcileOne(workspaceId, row.callback_id);
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const handle = async (
    numberId: string,
    action: 'callback-join' | 'callback-status',
    facts: Record<string, string>,
    callbackId: string,
  ) => {
    try {
      const number = options.numbers.find((candidate) => candidate.numberId === numberId);
      if (!number || facts.AccountSid !== number.accountSid || !facts.CallSid)
        throw new Error('Callback provider identity mismatch');
      const callback = await callbacks.read(number.workspaceId, callbackId);
      const attempt = callback?.state.attempts[callback.state.attempts.length - 1];
      if (!callback || !attempt || callback.numberId !== numberId)
        throw new Error('Callback provider binding is missing');
      const customer = (await readEffects(
        pool,
        number.workspaceId,
        callbackId,
        attempt.attemptId,
      )).find((effect) => effect.effect_kind === 'customer_dial');
      if (!customer || (customer.call_sid && customer.call_sid !== facts.CallSid))
        throw new Error('Callback customer call correlation mismatch');
      await pool.query(
        `UPDATE dialer_callback_effects
         SET call_sid=$5,status=CASE WHEN status IN ('dispatched','unknown') THEN 'succeeded' ELSE status END,
             updated_at=clock_timestamp()
         WHERE workspace_id=$1 AND callback_id=$2 AND attempt_id=$3 AND effect_kind=$4
           AND (call_sid IS NULL OR call_sid=$5)`,
        [
          number.workspaceId,
          callbackId,
          attempt.attemptId,
          'customer_dial',
          facts.CallSid,
        ],
      );
      if (action === 'callback-status') {
        await settleCommand(
          number.workspaceId,
          customer.command_id,
          callbackId,
          attempt.attemptId,
        );
        return '<Response/>';
      }
      const session = await readTelephonySession(
        pool,
        number.workspaceId,
        callback.state.requestId,
      );
      if (!session) return hangupTwiml();
      return conferenceTwiml(
        session.conference_name,
        telephonyUrl(
          options,
          number.numberId,
          'conference',
          session.request_id,
        ),
        'caller',
      );
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  return { executePending, reconcile, reconcileOne, handle };
};
