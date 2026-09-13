import { createTelephonyEndpoints } from './telephony-endpoints';
import type { Pool } from 'pg';
import {
  decodeRoutingRequestMetadata,
  type RepCapacityState,
} from '@consuelo/dialer';
import type { CallbackRecipientCipher } from './callback-recipient-cipher';
import { createPostgresCallbacks } from './callbacks';
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

export type TelephonyOptions = {
  pool: Pool;
  numbers: readonly InboundNumber[];
  endpoints: readonly InboundEndpoint[];
  carrier: InboundCarrier;
  publicUrl: string;
  authToken: string;
  clock?: () => string;
  enrich?: InboundEnrichment;
  callbackRecipientCipher?: CallbackRecipientCipher;
};
export const telephonyUrl = (
  options: TelephonyOptions,
  numberId: string,
  action: string,
  reference: string,
) =>
  new URL(
    '/webhooks/twilio/inbound/' +
      encodeURIComponent(numberId) +
      '/' +
      action +
      '/' +
      encodeURIComponent(reference),
    options.publicUrl,
  ).toString();
export const createTelephonyAdmission = (options: TelephonyOptions) => {
  const { pool } = options;
  const callbacks = options.callbackRecipientCipher
    ? createPostgresCallbacks({
        pool,
        recipientCipher: options.callbackRecipientCipher,
        clock: options.clock,
      })
    : null;
  const byNumber = (id: string) => {
    const number = options.numbers.find((item) => item.numberId === id);
    if (!number) throw new Error('Unknown inbound number');
    return number;
  };
  const accept = async (
    input: {
      workspaceId: string;
      userId: string;
      capacityId: string;
      assignmentId: string;
      generation: number;
      endpointId: string;
      callSid: string;
      operationId?: string;
    },
    screened = false,
  ) =>
    withInboundTransaction(pool, input.workspaceId, async (client) => {
      try {
        const state = await readTelephonyCapacity(
          client,
          input.workspaceId,
          input.capacityId,
        );
        const endpoint = options.endpoints.find(
          (item) =>
            item.workspaceId === input.workspaceId &&
            item.repId === input.userId &&
            item.endpointId === input.endpointId,
        );
        if (
          !state ||
          state.repId !== input.userId ||
          !endpoint ||
          (!screened && endpoint.kind !== 'browser')
        )
          throw new Error('Endpoint is not owned by authenticated rep');
        const effect = (
          await client.query<TelephonyEffect>(
            'SELECT * FROM dialer_telephony_effects WHERE workspace_id=$1 AND assignment_id=$2 AND endpoint_id=$3 AND kind=$4',
            [input.workspaceId, input.assignmentId, input.endpointId, 'offer'],
          )
        ).rows[0];
        if (
          !effect ||
          effect.call_sid !== input.callSid ||
          state.owner?.assignmentId !== input.assignmentId ||
          state.owner.generation !== input.generation
        )
          throw new Error('Stale or unbound endpoint acceptance');
        const session = await readTelephonySession(
          client,
          input.workspaceId,
          effect.request_id,
        );
        if (!session || !['waiting', 'callback_requested'].includes(session.mode))
          throw new Error('Caller no longer waiting');
        const operationId =
          input.operationId ??
          telephonyId(input.assignmentId, input.endpointId, 'accept');
        const priorAcceptance = (
          await client.query<{ snapshot: RepCapacityState }>(
            'SELECT snapshot FROM dialer_rep_capacity_events WHERE workspace_id=$1 AND operation_id=$2',
            [input.workspaceId, operationId],
          )
        ).rows[0]?.snapshot;
        if (priorAcceptance) {
          const priorOwner = priorAcceptance.owner;
          if (
            priorOwner?.assignmentId === input.assignmentId &&
            priorOwner.generation === input.generation &&
            priorOwner.winnerEndpointId === input.endpointId &&
            ['connecting', 'connected'].includes(priorOwner.phase)
          )
            return { accepted: true as const };
          throw new Error('Acceptance operation identity collision');
        }
        if (
          state.owner.winnerEndpointId === input.endpointId &&
          ['connecting', 'connected'].includes(state.owner.phase)
        )
          throw new Error('Offer already accepted by another action');
        await executeRepCapacityOnClient(
          client,
          {
            workspaceId: input.workspaceId,
            capacityId: state.capacityId,
            expectedVersion: state.version,
            operationId,
            action: {
              type: 'accept',
              assignmentId: input.assignmentId,
              generation: input.generation,
              endpointId: input.endpointId,
            },
          },
          { clock: options.clock },
        );
        return { accepted: true as const };
      } catch (cause: unknown) {
        if (cause instanceof Error) throw cause;
        throw new Error('Async operation rejected with a non-Error cause', {
          cause,
        });
      }
    });
  const incoming = async (
    number: InboundNumber,
    facts: Record<string, string>,
  ) => {
    if (
      !number.enabled ||
      facts.AccountSid !== number.accountSid ||
      facts.To !== number.did ||
      !facts.CallSid ||
      facts.Direction !== 'inbound'
    )
      return hangupTwiml('This number is unavailable.');
    const requestId = telephonyId(number.accountSid, facts.CallSid);
    let metadata = decodeRoutingRequestMetadata({
      requiredSkills: [],
      ownerRepId: null,
      ownerStatus: 'missing',
      kind: 'live',
      notBefore: null,
      deadline: null,
    });
    if (options.enrich) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        metadata = decodeRoutingRequestMetadata(
          await Promise.race([
            options.enrich({
              workspaceId: number.workspaceId,
              caller: facts.From ?? '',
            }),
            new Promise<never>((_resolve, reject) => {
              timer = setTimeout(
                () => reject(new Error('Enrichment deadline')),
                500,
              );
            }),
          ]),
        );
      } catch {
        metadata = { ...metadata, ownerStatus: 'unavailable' };
      } finally {
        if (timer) clearTimeout(timer);
      }
      if (metadata.kind !== 'live')
        throw new Error('Inbound enrichment must describe a live caller');
    }
    await withInboundTransaction(pool, number.workspaceId, async (client) => {
      try {
        if (await readTelephonySession(client, number.workspaceId, requestId))
          return;
        const count = await client.query<{ count: string }>(
          "SELECT count(*) FROM dialer_telephony_sessions WHERE workspace_id=$1 AND mode='waiting'",
          [number.workspaceId],
        );
        const rejected =
          Number(count.rows[0]?.count) >= number.maxActiveRequests;
        const at = await routingTime(client, options.clock);
        await moveTelephonyEntity(
          client,
          number.workspaceId,
          'request',
          requestId,
          'created',
          {
            clock: options.clock,
            identity: {
              kind: 'request',
              queueId: number.queueId,
              enteredAt: at,
            },
          },
        );
        await moveTelephonyEntity(
          client,
          number.workspaceId,
          'request',
          requestId,
          rejected ? 'rejected' : 'queued',
          { clock: options.clock },
        );
        await moveTelephonyEntity(
          client,
          number.workspaceId,
          'leg',
          facts.CallSid!,
          'ringing',
          {
            clock: options.clock,
            identity: { kind: 'leg', requestId, role: 'caller' },
          },
        );
        await client.query(
          'INSERT INTO dialer_telephony_sessions(workspace_id,request_id,number_id,queue_id,caller_sid,conference_name) VALUES($1,$2,$3,$4,$5,$6)',
          [
            number.workspaceId,
            requestId,
            number.numberId,
            number.queueId,
            facts.CallSid,
            telephonyId(requestId, 'conference'),
          ],
        );
        if (rejected) {
          await client.query(
            "UPDATE dialer_telephony_sessions SET mode='ended' WHERE workspace_id=$1 AND request_id=$2",
            [number.workspaceId, requestId],
          );
          return;
        }
        await client.query(
          'INSERT INTO dialer_routing_entries(workspace_id,request_id,queue_id,version,metadata) VALUES($1,$2,$3,1,$4)',
          [
            number.workspaceId,
            requestId,
            number.queueId,
            JSON.stringify(metadata),
          ],
        );
      } catch (cause: unknown) {
        if (cause instanceof Error) throw cause;
        throw new Error('Async operation rejected with a non-Error cause', {
          cause,
        });
      }
    });
    return wait(number, requestId, facts);
  };
  const wait = async (
    number: InboundNumber,
    requestId: string,
    facts: Record<string, string>,
  ) =>
    withInboundTransaction(pool, number.workspaceId, async (client) => {
      try {
        const session = await readTelephonySession(
          client,
          number.workspaceId,
          requestId,
        );
        if (!session || session.caller_sid !== facts.CallSid)
          throw new Error('Caller identity mismatch');
        if (!['waiting', 'callback_requested'].includes(session.mode)) return hangupTwiml();
        const request = await readInboundSnapshot(
          client,
          number.workspaceId,
          'request',
          requestId,
        );
        if (
          !request ||
          !['queued', 'offering', 'bridging', 'connected'].includes(
            request.state,
          )
        )
          return hangupTwiml();
        if (request.state === 'connected' || request.state === 'bridging') {
          const dispatched = await client.query(
            "SELECT effect_id FROM dialer_telephony_effects WHERE workspace_id=$1 AND request_id=$2 AND kind='bridge_caller' AND status IN ('dispatched','succeeded')",
            [number.workspaceId, requestId],
          );
          if (dispatched.rowCount)
            return conferenceTwiml(
              session.conference_name,
              telephonyUrl(options, number.numberId, 'conference', requestId),
              'caller',
            );
          return waitingTwiml(
            telephonyUrl(options, number.numberId, 'wait', requestId),
            Boolean(number.voicemail),
            false,
            callbacks ? (number.callback?.disclosure ?? null) : null,
          );
        }
        const callbackPolicy = number.callback ?? null;
        const callbackSelected =
          facts.Digits === '1' && callbackPolicy !== null && callbacks !== null;
        if (callbackSelected || (facts.Digits === '2' && number.voicemail)) {
          if (callbackSelected) {
            if (!facts.From || request.identity.kind !== 'request')
              throw new Error('Callback recipient evidence is unavailable');
            const at = await routingTime(client, options.clock);
            const callbackId = telephonyId(requestId, 'callback');
            const callbackRequestId = telephonyId(requestId, 'callback-request');
            const routing = (
              await client.query<{ metadata: import('@consuelo/dialer').RoutingRequestMetadata }>(
                'SELECT metadata FROM dialer_routing_entries WHERE workspace_id=$1 AND request_id=$2',
                [number.workspaceId, requestId],
              )
            ).rows[0]?.metadata;
            const queue = (
              await client.query<{ policy: import('@consuelo/dialer').InboundQueuePolicy }>(
                'SELECT policy FROM dialer_routing_queues WHERE workspace_id=$1 AND queue_id=$2',
                [number.workspaceId, number.queueId],
              )
            ).rows[0]?.policy;
            if (!routing || !queue)
              throw new Error('Callback routing evidence is unavailable');
            await recordTelephonyFact(
              client,
              number.workspaceId,
              requestId,
              telephonyId(requestId, 'callback-consent'),
              'callback_consent',
            );
            await callbacks.requestOnClient(
              client,
              {
                operationId: telephonyId(requestId, 'callback-requested'),
                workspaceId: number.workspaceId,
                callbackId,
                requestId: callbackRequestId,
                sourceRequestId: requestId,
                numberId: number.numberId,
                queueId: number.queueId,
                originalEnteredAt: request.identity.enteredAt,
                consentReference: telephonyId(requestId, 'callback-consent'),
                recipient: facts.From,
                timezone: queue.timezone,
                notBefore: at,
                deadline: new Date(
                  Date.parse(at) + callbackPolicy.immediateWindowMilliseconds,
                ).toISOString(),
                metadata: {
                  requiredSkills: routing.requiredSkills,
                  ownerRepId: routing.ownerRepId,
                  ownerStatus: routing.ownerStatus,
                },
                policy: callbackPolicy,
              },
              at,
            );
          }
          if (request.state === 'offering') {
            const owned = (
              await client.query<{ snapshot: import('@consuelo/dialer').RepCapacityState }>(
                `SELECT snapshot FROM dialer_rep_capacity
                 WHERE workspace_id=$1 AND snapshot->'owner'->>'requestId'=$2 LIMIT 2`,
                [number.workspaceId, requestId],
              )
            ).rows;
            if (owned.length > 1)
              throw new Error('Live request owns more than one capacity slot');
            const state = owned[0]?.snapshot;
            if (state?.owner)
              await executeRepCapacityOnClient(
                client,
                {
                  workspaceId: number.workspaceId,
                  capacityId: state.capacityId,
                  expectedVersion: state.version,
                  operationId: telephonyId(requestId, 'callback-live-cancel'),
                  action: {
                    type: 'cancel',
                    assignmentId: state.owner.assignmentId,
                    generation: state.owner.generation,
                  },
                },
                { clock: options.clock },
              );
            await moveTelephonyEntity(
              client,
              number.workspaceId,
              'request',
              requestId,
              'queued',
              { clock: options.clock },
            );
          }
          const mode =
            facts.Digits === '1' ? 'callback_requested' : 'voicemail';
          await moveTelephonyEntity(
            client,
            number.workspaceId,
            'request',
            requestId,
            mode,
            { clock: options.clock },
          );
          await client.query(
            'UPDATE dialer_telephony_sessions SET mode=$3 WHERE workspace_id=$1 AND request_id=$2',
            [number.workspaceId, requestId, mode],
          );
          return mode === 'callback_requested'
            ? hangupTwiml('Your callback request has been saved.')
            : voicemailTwiml(
                telephonyUrl(options, number.numberId, 'recording', requestId),
                number.voicemail!.disclosure,
                number.voicemail!.maxSeconds,
              );
        }
        const fallback =
          (
            await client.query<{ routing_state: string }>(
              'SELECT routing_state FROM dialer_routing_entries WHERE workspace_id=$1 AND request_id=$2',
              [number.workspaceId, requestId],
            )
          ).rows[0]?.routing_state === 'fallback';
        if (fallback) {
          const deadline = (
            await client.query<{ fallback_at: Date }>(
              'UPDATE dialer_telephony_sessions SET fallback_at=coalesce(fallback_at,$3::timestamptz) WHERE workspace_id=$1 AND request_id=$2 RETURNING fallback_at',
              [
                number.workspaceId,
                requestId,
                await routingTime(client, options.clock),
              ],
            )
          ).rows[0]!.fallback_at;
          if (
            Date.parse(await routingTime(client, options.clock)) -
              deadline.getTime() >=
            20000
          ) {
            if (request.state === 'offering')
              await moveTelephonyEntity(
                client,
                number.workspaceId,
                'request',
                requestId,
                'queued',
                { clock: options.clock },
              );
            await moveTelephonyEntity(
              client,
              number.workspaceId,
              'request',
              requestId,
              'overflowed',
              { clock: options.clock },
            );
            return hangupTwiml(
              'No representative is available. Please call again later.',
            );
          }
        }
        return waitingTwiml(
          telephonyUrl(options, number.numberId, 'wait', requestId),
          Boolean(number.voicemail),
          fallback,
          callbacks ? (number.callback?.disclosure ?? null) : null,
        );
      } catch (cause: unknown) {
        if (cause instanceof Error) throw cause;
        throw new Error('Async operation rejected with a non-Error cause', {
          cause,
        });
      }
    });
  const endpoint = createTelephonyEndpoints(options, accept);
  const handle = async (
    numberId: string,
    action: string,
    facts: Record<string, string>,
    reference?: string,
  ) => {
    try {
      const number = byNumber(numberId);
      if (facts.AccountSid !== number.accountSid)
        throw new Error('Provider account mismatch');
      if (action === 'incoming') return incoming(number, facts);
      if (!reference) throw new Error('Missing provider correlation');
      if (['screen', 'accept', 'status'].includes(action))
        return endpoint(number, reference, action, facts);
      if (action === 'wait') return wait(number, reference, facts);
      const session = await readTelephonySession(
        pool,
        number.workspaceId,
        reference,
      );
      if (!session || session.number_id !== numberId)
        throw new Error('Provider session mismatch');
      if (action === 'recording') {
        const request = await withInboundTransaction(
          pool,
          number.workspaceId,
          (client) =>
            readInboundSnapshot(
              client,
              number.workspaceId,
              'request',
              reference,
            ),
        );
        if (
          facts.CallSid !== session.caller_sid ||
          request?.state !== 'voicemail' ||
          !number.voicemail
        )
          throw new Error('Recording not authorized');
        if (facts.RecordingStatus === 'completed' && facts.RecordingSid) {
          const recording = await options.carrier.recording(facts.RecordingSid);
          if (
            recording.callSid !== session.caller_sid ||
            recording.accountSid !== number.accountSid ||
            recording.status !== 'completed'
          )
            throw new Error('Recording evidence mismatch');
          await pool.query(
            'INSERT INTO dialer_telephony_voicemail(workspace_id,recording_sid,request_id,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
            [
              number.workspaceId,
              facts.RecordingSid,
              reference,
              new Date(
                Date.parse(options.clock?.() ?? new Date().toISOString()) +
                  number.voicemail.retentionMilliseconds,
              ).toISOString(),
            ],
          );
        }
        return hangupTwiml('Thank you.');
      }
      if (action === 'conference') {
        if (facts.FriendlyName !== session.conference_name)
          throw new Error('Conference identity mismatch');
        await withInboundTransaction(pool, number.workspaceId, (client) =>
          recordTelephonyFact(
            client,
            number.workspaceId,
            reference,
            JSON.stringify([
              facts.ConferenceSid,
              facts.SequenceNumber,
              facts.StatusCallbackEvent,
              facts.CallSid,
            ]),
            'conference_observed',
          ),
        );
        return '<Response/>';
      }
      throw new Error('Unknown inbound action');
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', {
        cause,
      });
    }
  };
  return { handle, accept };
};
