import type {
  PersistedTransfer,
  TransferEventInput,
  TransferRepository,
} from './application';

import { normalizeAsyncError } from '../errors/normalize-async-error';

export type TransferDatabase = {
  query: <TRow>(
    text: string,
    values?: readonly unknown[],
  ) => Promise<{ rows: TRow[]; rowCount?: number | null }>;
};

type TransferRow = {
  workspace_id: string;
  session_id: string;
  event_type: string;
  metadata: unknown;
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const requiredString = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value) {
    throw new Error('Invalid transfer metadata: ' + name);
  }
  return value;
};

const nullableString = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null;

const mapTransfer = (row: TransferRow | undefined): PersistedTransfer | null => {
  if (!row) return null;
  const metadata = record(row.metadata);
  const type = requiredString(metadata.type, 'type');
  if (type !== 'cold' && type !== 'warm') {
    throw new Error('Invalid transfer metadata: type');
  }
  const status = requiredString(metadata.status, 'status');
  if (!['initiating', 'consulting', 'completed', 'cancelled', 'failed'].includes(status)) {
    throw new Error('Invalid transfer metadata: status');
  }
  return {
    workspaceId: row.workspace_id,
    sessionId: row.session_id,
    transferId: requiredString(metadata.transferId, 'transferId'),
    groupId: requiredString(metadata.groupId, 'groupId'),
    type,
    target: requiredString(metadata.target, 'target'),
    status: status as PersistedTransfer['status'],
    conferenceSid: nullableString(metadata.conferenceSid),
    transferCallSid: nullableString(metadata.transferCallSid),
  };
};

const metadata = (input: TransferEventInput): Record<string, unknown> => ({
  transferId: input.transferId,
  groupId: input.groupId,
  type: input.type,
  target: input.target,
  status: input.status,
  conferenceSid: input.conferenceSid,
  transferCallSid: input.transferCallSid,
  ...(input.error ? { error: input.error } : {}),
});

export const createPostgresTransferRepository = (
  database: TransferDatabase,
): TransferRepository => ({
  recordEvent: async (input) => {
    try {
      await database.query(
        'INSERT INTO dialer_call_events (id, workspace_id, session_id, event_type, metadata) VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT (workspace_id, id) DO NOTHING',
        [
          input.id,
          input.workspaceId,
          input.sessionId,
          input.eventType,
          JSON.stringify(metadata(input)),
        ],
      );
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  getTransfer: async ({ workspaceId, sessionId, transferId }) => {
    try {
      const result = await database.query<TransferRow>(
        "SELECT workspace_id, session_id, event_type, metadata FROM dialer_call_events WHERE workspace_id = $1 AND session_id = $2 AND metadata ->> 'transferId' = $3 ORDER BY created_at DESC, id DESC LIMIT 1",
        [workspaceId, sessionId, transferId],
      );
      return mapTransfer(result.rows[0]);
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  getTransferById: async (transferId) => {
    try {
      const result = await database.query<TransferRow>(
        "SELECT workspace_id, session_id, event_type, metadata FROM dialer_call_events WHERE metadata ->> 'transferId' = $1 ORDER BY created_at DESC, id DESC LIMIT 1",
        [transferId],
      );
      return mapTransfer(result.rows[0]);
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
});
