import { decodeRoutingRequestMetadata } from '@consuelo/dialer';
import type {
  InboundEndpoint,
  InboundEnrichment,
  InboundNumber,
  TelephonyEffect,
} from './telephony-contracts';
import {
  withInboundTransaction,
  readInboundSnapshot,
} from './postgres-journal';
import { executeRepCapacityOnClient } from './rep-capacity';
import {
  moveTelephonyEntity,
  telephonyId,
  readTelephonySession,
  readTelephonyCapacity,
  recordTelephonyFact,
} from './telephony-store';
import { routingTime } from './routing-store';
import {
  conferenceTwiml,
  hangupTwiml,
  screeningTwiml,
  voicemailTwiml,
  waitingTwiml,
} from './telephony-twiml';
import type { InboundCarrier } from './telephony-contracts';

import type {
  TelephonyOptions,
  createTelephonyAdmission,
} from './telephony-admission';
import { telephonyUrl } from './telephony-admission';
export const createTelephonyEndpoints = (
  options: TelephonyOptions,
  accept: ReturnType<typeof createTelephonyAdmission>['accept'],
) => {
  const { pool } = options;
  const endpoint = async (
    number: InboundNumber,
    effectId: string,
    action: string,
    facts: Record<string, string>,
  ) => {
    try {
      const found = await withInboundTransaction(
        pool,
        number.workspaceId,
        async (client) => {
          try {
            const effect = (
              await client.query<TelephonyEffect>(
                "SELECT * FROM dialer_telephony_effects WHERE workspace_id=$1 AND effect_id=$2 AND kind='offer'",
                [number.workspaceId, effectId],
              )
            ).rows[0];
            if (
              !effect ||
              !facts.CallSid ||
              !['dispatched', 'unknown', 'succeeded'].includes(effect.status)
            )
              throw new Error('Unknown provider offer');
            const session = await readTelephonySession(
              client,
              number.workspaceId,
              effect.request_id,
            );
            if (
              !session ||
              session.number_id !== number.numberId ||
              (effect.call_sid && effect.call_sid !== facts.CallSid)
            )
              throw new Error('Provider offer identity mismatch');
            await client.query(
              'UPDATE dialer_telephony_effects SET call_sid=$3,status=$4 WHERE workspace_id=$1 AND effect_id=$2',
              [number.workspaceId, effectId, facts.CallSid, 'succeeded'],
            );
            await moveTelephonyEntity(
              client,
              number.workspaceId,
              'leg',
              facts.CallSid,
              'ringing',
              {
                clock: options.clock,
                identity: {
                  kind: 'leg',
                  requestId: session.request_id,
                  role: 'rep',
                },
              },
            );
            const leg = await readInboundSnapshot(
              client,
              number.workspaceId,
              'leg',
              facts.CallSid,
            );
            if (action !== 'status' && leg?.state === 'ringing')
              await moveTelephonyEntity(
                client,
                number.workspaceId,
                'leg',
                facts.CallSid,
                'answered',
                { clock: options.clock },
              );
            if (
              ['completed', 'canceled', 'busy', 'failed', 'no-answer'].includes(
                facts.CallStatus ?? '',
              )
            )
              await moveTelephonyEntity(
                client,
                number.workspaceId,
                'leg',
                facts.CallSid,
                'ended',
                { clock: options.clock },
              );
            const row = await client.query<{
              snapshot: import('@consuelo/dialer').RepCapacityState;
            }>(
              "SELECT snapshot FROM dialer_rep_capacity WHERE workspace_id=$1 AND snapshot->'owner'->>'assignmentId'=$2",
              [number.workspaceId, effect.assignment_id],
            );
            return { effect, state: row.rows[0]?.snapshot, session };
          } catch (cause: unknown) {
            if (cause instanceof Error) throw cause;
            throw new Error('Async operation rejected with a non-Error cause', {
              cause,
            });
          }
        },
      );
      if (action === 'status') return '<Response/>';
      const { state, effect, session } = found;
      if (!state?.owner || session.mode !== 'waiting') return hangupTwiml();
      const target = options.endpoints.find(
        (item) =>
          item.workspaceId === number.workspaceId &&
          item.repId === state.repId &&
          item.endpointId === effect.endpoint_id,
      );
      if (!target) return hangupTwiml();
      if (
        action === 'accept' &&
        target.kind === 'phone' &&
        facts.Digits === '1'
      ) {
        try {
          await accept(
            {
              workspaceId: number.workspaceId,
              userId: state.repId,
              capacityId: state.capacityId,
              assignmentId: state.owner.assignmentId,
              generation: state.owner.generation,
              endpointId: target.endpointId,
              callSid: facts.CallSid!,
            },
            true,
          );
        } catch {
          return hangupTwiml();
        }
      }
      if (
        state.owner.winnerEndpointId &&
        state.owner.winnerEndpointId !== target.endpointId
      )
        return hangupTwiml();
      const current = await withInboundTransaction(
        pool,
        number.workspaceId,
        (client) =>
          readTelephonyCapacity(client, number.workspaceId, state.capacityId),
      );
      if (
        !current?.owner ||
        current.owner.assignmentId !== effect.assignment_id ||
        ['unknown', 'wrap_up'].includes(current.owner.phase)
      )
        return hangupTwiml();
      if (current.owner.winnerEndpointId === target.endpointId) {
        const bridge = await pool.query(
          "SELECT effect_id FROM dialer_telephony_effects WHERE workspace_id=$1 AND assignment_id=$2 AND kind='bridge_rep' AND status IN ('dispatched','succeeded')",
          [number.workspaceId, effect.assignment_id],
        );
        if (bridge.rowCount)
          return conferenceTwiml(
            session.conference_name,
            telephonyUrl(
              options,
              number.numberId,
              'conference',
              session.request_id,
            ),
            'rep',
          );
        return screeningTwiml(
          telephonyUrl(options, number.numberId, 'screen', effect.effect_id),
          'browser',
        );
      }
      return screeningTwiml(
        telephonyUrl(options, number.numberId, 'accept', effect.effect_id),
        target.kind,
      );
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', {
        cause,
      });
    }
  };
  return endpoint;
};
