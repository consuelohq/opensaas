import type { Pool, PoolClient } from 'pg';
import {
  InboundPersistenceError,
  decodeInboundQueuePolicy,
  decodeRoutingRequestMetadata,
  evaluateInboundRouting,
  type InboundQueuePolicy,
  type RoutingRequestMetadata,
} from '@consuelo/dialer';
import {
  withInboundTransaction,
  readInboundSnapshot,
} from './postgres-journal';

export const routingId = (value: string) => {
  if (!/^[A-Za-z0-9_.:-]{1,160}$/.test(value))
    throw new InboundPersistenceError('Invalid routing identifier');
  return value;
};
export const routingTime = async (client: PoolClient, clock?: () => string) => {
  try {
    const row = await client.query<{ now: Date }>(
      'SELECT clock_timestamp() AS now',
    );
    const at = clock?.() ?? row.rows[0]!.now.toISOString();
    if (
      at.length !== 24 ||
      !Number.isFinite(Date.parse(at)) ||
      new Date(at).toISOString() !== at
    )
      throw new InboundPersistenceError('Invalid routing authority time');
    return at;
  } catch (cause: unknown) {
    if (cause instanceof InboundPersistenceError) throw cause;
    throw new InboundPersistenceError('Routing authority clock failed', {
      cause,
    });
  }
};
const version = (value: number) => {
  if (!Number.isSafeInteger(value) || value < 0 || value >= 2_147_483_647)
    throw new InboundPersistenceError('Invalid routing configuration version');
};
export const createRoutingConfiguration = (pool: Pool) => ({
  configureQueue: (policy: InboundQueuePolicy, expectedVersion: number) =>
    withInboundTransaction(
      pool,
      routingId(policy.workspaceId),
      async (client) => {
        try {
          const decoded = decodeInboundQueuePolicy(policy);
          version(expectedVersion);
          evaluateInboundRouting({
            policy: decoded,
            at: new Date().toISOString(),
            requests: [],
            capacities: [],
          });
          const previous = await client.query<{ version: number }>(
            'SELECT version FROM dialer_routing_queues WHERE workspace_id=$1 AND queue_id=$2',
            [decoded.workspaceId, decoded.queueId],
          );
          if ((previous.rows[0]?.version ?? 0) !== expectedVersion)
            throw new InboundPersistenceError('Queue policy version conflict');
          await client.query(
            'INSERT INTO dialer_routing_queues(workspace_id,queue_id,version,policy) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,queue_id) DO UPDATE SET version=EXCLUDED.version,policy=EXCLUDED.policy',
            [
              decoded.workspaceId,
              decoded.queueId,
              expectedVersion + 1,
              JSON.stringify(decoded),
            ],
          );
          return expectedVersion + 1;
        } catch (cause: unknown) {
          if (cause instanceof InboundPersistenceError) throw cause;
          throw new InboundPersistenceError('Queue configuration failed', {
            cause,
          });
        }
      },
    ),
  configureRequest: (
    workspaceId: string,
    requestId: string,
    metadata: RoutingRequestMetadata,
    expectedVersion: number,
  ) =>
    withInboundTransaction(pool, routingId(workspaceId), async (client) => {
      try {
        routingId(requestId);
        version(expectedVersion);
        const decoded = decodeRoutingRequestMetadata(metadata);
        if ((decoded.ownerStatus === 'known') !== (decoded.ownerRepId !== null))
          throw new InboundPersistenceError('Invalid CRM owner classification');
        if (
          decoded.kind === 'callback'
            ? !decoded.notBefore ||
              !decoded.deadline ||
              decoded.notBefore > decoded.deadline
            : decoded.notBefore !== null || decoded.deadline !== null
        )
          throw new InboundPersistenceError('Invalid callback routing window');
        const request = await readInboundSnapshot(
          client,
          workspaceId,
          'request',
          requestId,
        );
        if (
          !request ||
          request.identity.kind !== 'request' ||
          !['created', 'queued', 'offering'].includes(request.state)
        )
          throw new InboundPersistenceError(
            'Routing requires an active request',
          );
        const previous = await client.query<{ version: number }>(
          'SELECT version FROM dialer_routing_entries WHERE workspace_id=$1 AND request_id=$2',
          [workspaceId, requestId],
        );
        if ((previous.rows[0]?.version ?? 0) !== expectedVersion)
          throw new InboundPersistenceError(
            'Request metadata version conflict',
          );
        // Changing CRM/calendar metadata never clears attempt history or a fallback disposition.
        await client.query(
          'INSERT INTO dialer_routing_entries(workspace_id,request_id,queue_id,version,metadata) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,request_id) DO UPDATE SET version=EXCLUDED.version,metadata=EXCLUDED.metadata',
          [
            workspaceId,
            requestId,
            request.identity.queueId,
            expectedVersion + 1,
            JSON.stringify(decoded),
          ],
        );
        return expectedVersion + 1;
      } catch (cause: unknown) {
        if (cause instanceof InboundPersistenceError) throw cause;
        throw new InboundPersistenceError(
          'Request routing configuration failed',
          { cause },
        );
      }
    }),
});
