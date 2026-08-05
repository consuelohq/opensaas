import { randomUUID } from 'node:crypto';

import { DialerInfrastructureError } from '@consuelo/dialer';
import { Effect } from 'effect';

import type {
  CallDetail,
  CallLegSummary,
  CallSessionSummary,
  OpportunitySnapshot,
  TranscriptSegment,
} from './contracts';
import type { CallOperationsRepositoryService } from './ports';

export type CallOperationsDatabase = {
  query: <TRow>(
    text: string,
    values?: readonly unknown[],
  ) => Promise<{ rows: TRow[]; rowCount?: number | null }>;
};

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS dialer_workspace_settings (
    workspace_id TEXT PRIMARY KEY,
    transcription_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    transcription_language TEXT,
    transcript_retention_days INTEGER NOT NULL DEFAULT 30 CHECK (transcript_retention_days > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS dialer_call_sessions (
    id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    installation_id TEXT,
    location_id TEXT,
    representative_name TEXT,
    source TEXT NOT NULL,
    selection_strategy TEXT NOT NULL,
    requested_fanout INTEGER NOT NULL,
    actual_fanout INTEGER NOT NULL,
    queue_id TEXT,
    pipeline_id TEXT,
    stage_id TEXT,
    contact_id TEXT,
    contact_name TEXT,
    opportunity_id TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    status TEXT NOT NULL,
    disposition TEXT,
    note TEXT,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    crm_sync_status TEXT NOT NULL DEFAULT 'pending',
    crm_sync_error_code TEXT,
    recording_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    recording_status TEXT,
    recording_sid TEXT,
    recording_url TEXT,
    recording_duration_seconds INTEGER,
    recording_failure_code TEXT,
    transcription_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    transcript_status TEXT,
    transcript_provider TEXT,
    transcript_model TEXT,
    transcript_language TEXT,
    transcript_retention_days INTEGER,
    transcript_failure_code TEXT,
    opportunity_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, id),
    UNIQUE (workspace_id, id)
  )`,
  `ALTER TABLE dialer_call_sessions ADD COLUMN IF NOT EXISTS representative_name TEXT`,
  `ALTER TABLE dialer_call_sessions ADD COLUMN IF NOT EXISTS contact_name TEXT`,
  `ALTER TABLE dialer_call_sessions ADD COLUMN IF NOT EXISTS recording_enabled BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE dialer_call_sessions ADD COLUMN IF NOT EXISTS recording_status TEXT`,
  `ALTER TABLE dialer_call_sessions ADD COLUMN IF NOT EXISTS recording_sid TEXT`,
  `ALTER TABLE dialer_call_sessions ADD COLUMN IF NOT EXISTS recording_url TEXT`,
  `ALTER TABLE dialer_call_sessions ADD COLUMN IF NOT EXISTS recording_duration_seconds INTEGER`,
  `ALTER TABLE dialer_call_sessions ADD COLUMN IF NOT EXISTS recording_failure_code TEXT`,
  `ALTER TABLE dialer_call_sessions ADD COLUMN IF NOT EXISTS transcription_enabled BOOLEAN NOT NULL DEFAULT FALSE`,
  `CREATE TABLE IF NOT EXISTS dialer_call_legs (
    id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    provider_call_id TEXT NOT NULL,
    contact_id TEXT,
    position INTEGER,
    caller_identity TEXT,
    status TEXT NOT NULL,
    amd_result TEXT,
    role TEXT,
    terminal_outcome TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, id),
    UNIQUE (workspace_id, provider_call_id),
    FOREIGN KEY (workspace_id, session_id)
      REFERENCES dialer_call_sessions(workspace_id, id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS dialer_transcript_segments (
    id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    provider_call_id TEXT NOT NULL,
    sequence BIGINT NOT NULL,
    idempotency_key TEXT NOT NULL,
    track TEXT NOT NULL,
    speaker TEXT NOT NULL,
    text TEXT NOT NULL,
    start_ms INTEGER,
    end_ms INTEGER,
    language TEXT,
    confidence DOUBLE PRECISION,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, id),
    UNIQUE (workspace_id, session_id, idempotency_key),
    FOREIGN KEY (workspace_id, session_id)
      REFERENCES dialer_call_sessions(workspace_id, id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS dialer_call_events (
    id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
      'transfer_initiated',
      'transfer_dialing',
      'transfer_consulting',
      'transfer_completed',
      'transfer_cancelled',
      'transfer_failed'
    )),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, id),
    FOREIGN KEY (workspace_id, session_id)
      REFERENCES dialer_call_sessions(workspace_id, id) ON DELETE CASCADE
  )`,
  `ALTER TABLE dialer_call_events DROP CONSTRAINT IF EXISTS dialer_call_events_event_type_check`,
  `ALTER TABLE dialer_call_events ADD CONSTRAINT dialer_call_events_event_type_check CHECK (event_type IN (
    'transfer_initiated', 'transfer_dialing', 'transfer_consulting',
    'transfer_completed', 'transfer_cancelled', 'transfer_failed'
  ))`,
  `CREATE INDEX IF NOT EXISTS dialer_call_sessions_active_idx
    ON dialer_call_sessions(workspace_id, status, started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS dialer_call_sessions_history_idx
    ON dialer_call_sessions(workspace_id, started_at DESC, id DESC)`,
  `CREATE INDEX IF NOT EXISTS dialer_call_legs_session_idx
    ON dialer_call_legs(workspace_id, session_id, position)`,
  `CREATE INDEX IF NOT EXISTS dialer_transcript_segments_session_idx
    ON dialer_transcript_segments(workspace_id, session_id, sequence, created_at)`,
];

export const initializeCallOperationsPersistence = (
  database: CallOperationsDatabase,
): Promise<void> =>
  SCHEMA_STATEMENTS.reduce<Promise<void>>(
    (operation, statement) =>
      operation.then(() => database.query(statement).then(() => undefined)),
    Promise.resolve(),
  );

type SessionRow = {
  id: string;
  workspace_id?: string;
  user_id?: string | null;
  installation_id?: string | null;
  location_id?: string | null;
  representative_name?: string | null;
  source?: string;
  selection_strategy?: string;
  requested_fanout?: number | string | null;
  actual_fanout?: number | string | null;
  queue_id?: string | null;
  pipeline_id?: string | null;
  stage_id?: string | null;
  contact_id?: string | null;
  contact_name?: string | null;
  opportunity_id?: string | null;
  started_at?: string | Date | null;
  answered_at?: string | Date | null;
  ended_at?: string | Date | null;
  status: string;
  disposition?: string | null;
  note?: string | null;
  tags?: unknown;
  crm_sync_status?: 'pending' | 'synced' | 'failed' | null;
  recording_enabled?: boolean;
  recording_status?: CallSessionSummary['recordingStatus'];
  recording_sid?: string | null;
  recording_url?: string | null;
  recording_duration_seconds?: number | string | null;
  transcription_enabled?: boolean;
  transcript_status?: CallSessionSummary['transcriptStatus'];
  transcript_provider?: string | null;
  transcript_model?: string | null;
  transcript_language?: string | null;
  transcript_retention_days?: number | string | null;
  opportunity_snapshot?: unknown;
};

type LegRow = {
  id?: string;
  provider_call_id: string;
  contact_id?: string | null;
  position?: number | string | null;
  caller_identity?: string | null;
  status?: string | null;
  amd_result?: string | null;
  role?: CallLegSummary['role'];
  terminal_outcome?: string | null;
  duration_seconds?: number | string | null;
};

type EventRow = {
  id: string;
  event_type: NonNullable<CallDetail['transferEvents']>[number]['type'];
  metadata?: unknown;
  created_at: string | Date;
};

type TranscriptionContextRow = {
  workspace_id: string;
  session_id: string;
  transcription_enabled: boolean;
  transcription_language: string | null;
  transcript_retention_days: number | string;
};

const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const isoOrNull = (value: string | Date | null | undefined): string | null =>
  value ? new Date(value).toISOString() : null;

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];

const opportunitySnapshot = (value: unknown): OpportunitySnapshot | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as OpportunitySnapshot)
    : null;

const mapLeg = (row: LegRow): CallLegSummary => ({
  id: row.id,
  providerCallId: row.provider_call_id,
  contactId: row.contact_id ?? null,
  position: numberOrNull(row.position),
  callerIdentity: row.caller_identity ?? null,
  status: row.status ?? null,
  amdResult: row.amd_result ?? null,
  role: row.role ?? null,
  terminalOutcome: row.terminal_outcome ?? null,
  durationSeconds: numberOrNull(row.duration_seconds),
});

const mapSession = (
  row: SessionRow,
  calls: CallLegSummary[],
): CallSessionSummary => {
  const startedAt = isoOrNull(row.started_at);
  const endedAt = isoOrNull(row.ended_at);
  const durationSeconds =
    startedAt && endedAt
      ? Math.max(
          0,
          Math.floor(
            (new Date(endedAt).getTime() - new Date(startedAt).getTime()) /
              1_000,
          ),
        )
      : null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id ?? null,
    installationId: row.installation_id ?? null,
    locationId: row.location_id ?? null,
    representative: row.representative_name ?? row.user_id ?? null,
    contactId: row.contact_id ?? null,
    contactName: row.contact_name ?? null,
    opportunityId: row.opportunity_id ?? null,
    queueId: row.queue_id ?? null,
    pipelineId: row.pipeline_id ?? null,
    stageId: row.stage_id ?? null,
    source: row.source,
    selectionStrategy: row.selection_strategy,
    requestedFanout: numberOrNull(row.requested_fanout),
    actualFanout: numberOrNull(row.actual_fanout),
    status: row.status,
    disposition: row.disposition ?? null,
    note: row.note ?? null,
    tags: stringArray(row.tags),
    crmSyncStatus: row.crm_sync_status ?? null,
    recordingEnabled: row.recording_enabled === true,
    recordingStatus: row.recording_status ?? null,
    recordingSid: row.recording_sid ?? null,
    recordingUrl: row.recording_url ?? null,
    recordingDurationSeconds: numberOrNull(row.recording_duration_seconds),
    transcriptStatus: row.transcript_status ?? null,
    transcriptProvider: row.transcript_provider ?? null,
    transcriptModel: row.transcript_model ?? null,
    transcriptLanguage: row.transcript_language ?? null,
    transcriptRetentionDays: numberOrNull(row.transcript_retention_days),
    opportunity: opportunitySnapshot(row.opportunity_snapshot),
    startedAt,
    answeredAt: isoOrNull(row.answered_at),
    endedAt,
    durationSeconds,
    elapsedSeconds: startedAt
      ? Math.max(
          0,
          Math.floor(
            ((endedAt ? new Date(endedAt) : new Date()).getTime() -
              new Date(startedAt).getTime()) /
              1_000,
          ),
        )
      : 0,
    activeLineCount: calls.filter(
      (call) =>
        !['completed', 'failed', 'canceled', 'busy', 'no-answer'].includes(
          call.status?.toLowerCase() ?? '',
        ),
    ).length,
    calls,
  };
};

const repositoryFailure = (operation: string, cause: unknown) =>
  new DialerInfrastructureError({
    operation,
    message: cause instanceof Error ? cause.message : String(cause),
    retryable: true,
    cause,
  });

const queryEffect = <TRow>(
  database: CallOperationsDatabase,
  operation: string,
  text: string,
  values?: readonly unknown[],
) =>
  Effect.tryPromise({
    try: () => database.query<TRow>(text, values),
    catch: (cause) => repositoryFailure(operation, cause),
  });

const loadLegs = (
  database: CallOperationsDatabase,
  workspaceId: string,
  sessionIds: string[],
) => {
  if (sessionIds.length === 0)
    return Effect.succeed(new Map<string, CallLegSummary[]>());
  return queryEffect<LegRow & { session_id: string }>(
    database,
    'list-call-legs',
    `SELECT id, session_id, provider_call_id, contact_id, position,
      caller_identity, status, amd_result, role, terminal_outcome, duration_seconds
     FROM dialer_call_legs
     WHERE workspace_id = $1 AND session_id = ANY($2::text[])
     ORDER BY session_id, position NULLS LAST, created_at`,
    [workspaceId, sessionIds],
  ).pipe(
    Effect.map(({ rows }) => {
      const bySession = new Map<string, CallLegSummary[]>();
      for (const row of rows) {
        const list = bySession.get(row.session_id) ?? [];
        list.push(mapLeg(row));
        bySession.set(row.session_id, list);
      }
      return bySession;
    }),
  );
};

const decodeCursor = (cursor: string | undefined) => {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const [startedAt, ...idParts] = decoded.split('|');
    const id = idParts.join('|');
    return startedAt && id ? { startedAt, id } : null;
  } catch {
    return null;
  }
};

const encodeCursor = (call: CallSessionSummary): string | null =>
  call.startedAt
    ? Buffer.from(`${call.startedAt}|${call.id}`, 'utf8').toString('base64url')
    : null;

export const createPostgresCallOperationsRepository = (
  database: CallOperationsDatabase,
): CallOperationsRepositoryService => ({
  resolveTranscriptionSettings: (workspaceId) =>
    queryEffect<{
      transcription_enabled: boolean;
      transcription_language: string | null;
      transcript_retention_days: number | string;
    }>(
      database,
      'resolve-transcription-settings',
      `SELECT transcription_enabled, transcription_language, transcript_retention_days
       FROM dialer_workspace_settings
       WHERE workspace_id = $1`,
      [workspaceId],
    ).pipe(
      Effect.map(({ rows }) => {
        const row = rows[0];
        return row
          ? {
              enabled: row.transcription_enabled,
              language: row.transcription_language,
              retentionDays: Number(row.transcript_retention_days),
            }
          : { enabled: false, language: null, retentionDays: 30 };
      }),
    ),
  resolveTranscriptionContextForSession: (sessionId) =>
    queryEffect<TranscriptionContextRow>(
      database,
      'resolve-transcription-context-for-session',
      `SELECT sessions.workspace_id, sessions.id AS session_id,
        sessions.transcription_enabled AS transcription_enabled,
        settings.transcription_language,
        COALESCE(sessions.transcript_retention_days, settings.transcript_retention_days, 30) AS transcript_retention_days
       FROM dialer_call_sessions sessions
       LEFT JOIN dialer_workspace_settings settings
         ON settings.workspace_id = sessions.workspace_id
       WHERE sessions.id = $1
       ORDER BY sessions.created_at DESC
       LIMIT 1`,
      [sessionId],
    ).pipe(
      Effect.map(({ rows }) => {
        const row = rows[0];
        return row
          ? {
              workspaceId: row.workspace_id,
              sessionId: row.session_id,
              enabled: row.transcription_enabled,
              language: row.transcription_language,
              retentionDays: Number(row.transcript_retention_days),
            }
          : null;
      }),
    ),
  resolveTranscriptionContext: (providerCallId) =>
    queryEffect<TranscriptionContextRow>(
      database,
      'resolve-transcription-context',
      `SELECT sessions.workspace_id, sessions.id AS session_id,
        COALESCE(settings.transcription_enabled, FALSE) AS transcription_enabled,
        settings.transcription_language,
        COALESCE(settings.transcript_retention_days, 30) AS transcript_retention_days
       FROM dialer_call_legs legs
       JOIN dialer_call_sessions sessions
         ON sessions.workspace_id = legs.workspace_id AND sessions.id = legs.session_id
       LEFT JOIN dialer_workspace_settings settings
         ON settings.workspace_id = sessions.workspace_id
       WHERE legs.provider_call_id = $1
       LIMIT 1`,
      [providerCallId],
    ).pipe(
      Effect.map(({ rows }) => {
        const row = rows[0];
        return row
          ? {
              workspaceId: row.workspace_id,
              sessionId: row.session_id,
              enabled: row.transcription_enabled,
              language: row.transcription_language,
              retentionDays: Number(row.transcript_retention_days),
            }
          : null;
      }),
    ),
  setTranscriptStatus: (request) =>
    queryEffect(
      database,
      'set-transcript-status',
      `UPDATE dialer_call_sessions
       SET transcript_status = $3,
           transcript_provider = COALESCE($4, transcript_provider),
           transcript_model = COALESCE($5, transcript_model),
           transcript_language = COALESCE($6, transcript_language),
           transcript_failure_code = $7,
           transcript_retention_days = COALESCE(
             transcript_retention_days,
             (SELECT transcript_retention_days FROM dialer_workspace_settings WHERE workspace_id = $1),
             30
           ),
           updated_at = NOW()
       WHERE workspace_id = $1 AND id = $2`,
      [
        request.workspaceId,
        request.sessionId,
        request.status,
        request.provider ?? null,
        request.model ?? null,
        request.language ?? null,
        request.failureCode ?? null,
      ],
    ).pipe(Effect.asVoid),
  appendTranscriptSegment: (segment: TranscriptSegment) =>
    queryEffect<{ inserted: boolean }>(
      database,
      'append-transcript-segment',
      `INSERT INTO dialer_transcript_segments (
        id, workspace_id, session_id, provider_call_id, sequence,
        idempotency_key, track, speaker, text, start_ms, end_ms,
        language, confidence, provider, model, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      ON CONFLICT (workspace_id, session_id, idempotency_key) DO NOTHING
      RETURNING TRUE AS inserted`,
      [
        segment.id,
        segment.workspaceId,
        segment.sessionId,
        segment.providerCallId,
        segment.sequence,
        segment.idempotencyKey,
        segment.track,
        segment.speaker,
        segment.text,
        segment.startMs,
        segment.endMs,
        segment.language,
        segment.confidence,
        segment.provider,
        segment.model,
        segment.createdAt,
      ],
    ).pipe(
      Effect.map(({ rows }) => ({ inserted: rows[0]?.inserted === true })),
    ),
  recoverInterruptedTranscriptions: () =>
    queryEffect(
      database,
      'recover-interrupted-transcriptions',
      `UPDATE dialer_call_sessions
       SET transcript_status = 'failed',
           transcript_failure_code = 'PROCESS_RESTARTED',
           updated_at = NOW()
       WHERE transcript_status IN ('pending', 'processing')
         AND updated_at < NOW() - INTERVAL '5 minutes'
       RETURNING id`,
    ).pipe(Effect.map(({ rows }) => rows.length)),
  createOrUpdateCallSession: (request) =>
    queryEffect(
      database,
      'upsert-call-session',
      `WITH upserted_session AS (
        INSERT INTO dialer_call_sessions (
          id, workspace_id, user_id, installation_id, location_id,
          representative_name, source,
          selection_strategy, requested_fanout, actual_fanout, queue_id,
          pipeline_id, stage_id, contact_id, contact_name, opportunity_id,
          started_at, status, opportunity_snapshot,
          recording_enabled, recording_status, transcription_enabled,
          transcript_status, transcript_retention_days
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19,
          $20, CASE WHEN $20 THEN 'pending' ELSE NULL END,
          $21, CASE WHEN $21 THEN 'pending' ELSE NULL END,
          COALESCE((SELECT transcript_retention_days FROM dialer_workspace_settings WHERE workspace_id = $2), 30)
        )
        ON CONFLICT (workspace_id, id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          installation_id = COALESCE(EXCLUDED.installation_id, dialer_call_sessions.installation_id),
          location_id = COALESCE(EXCLUDED.location_id, dialer_call_sessions.location_id),
          source = EXCLUDED.source,
          selection_strategy = EXCLUDED.selection_strategy,
          requested_fanout = EXCLUDED.requested_fanout,
          actual_fanout = EXCLUDED.actual_fanout,
          queue_id = COALESCE(EXCLUDED.queue_id, dialer_call_sessions.queue_id),
          pipeline_id = COALESCE(EXCLUDED.pipeline_id, dialer_call_sessions.pipeline_id),
          stage_id = COALESCE(EXCLUDED.stage_id, dialer_call_sessions.stage_id),
          contact_id = COALESCE(EXCLUDED.contact_id, dialer_call_sessions.contact_id),
          opportunity_id = COALESCE(EXCLUDED.opportunity_id, dialer_call_sessions.opportunity_id),
          status = EXCLUDED.status,
          representative_name = COALESCE(EXCLUDED.representative_name, dialer_call_sessions.representative_name),
          contact_name = COALESCE(EXCLUDED.contact_name, dialer_call_sessions.contact_name),
          opportunity_snapshot = COALESCE(EXCLUDED.opportunity_snapshot, dialer_call_sessions.opportunity_snapshot),
          recording_enabled = EXCLUDED.recording_enabled,
          recording_status = CASE
            WHEN EXCLUDED.recording_enabled THEN COALESCE(dialer_call_sessions.recording_status, 'pending')
            ELSE NULL
          END,
          transcription_enabled = EXCLUDED.transcription_enabled,
          transcript_status = CASE
            WHEN EXCLUDED.transcription_enabled THEN COALESCE(dialer_call_sessions.transcript_status, 'pending')
            ELSE NULL
          END,
          updated_at = NOW()
        RETURNING workspace_id, id
      )
      INSERT INTO dialer_call_legs (
        id, workspace_id, session_id, provider_call_id, contact_id,
        position, caller_identity, status, role
      )
      SELECT calls.id, session.workspace_id, session.id,
        calls.provider_call_id, calls.contact_id, calls.position,
        calls.caller_identity, calls.status, 'active'
      FROM upserted_session session
      CROSS JOIN jsonb_to_recordset($22::jsonb) AS calls(
        id TEXT,
        provider_call_id TEXT,
        contact_id TEXT,
        position INTEGER,
        caller_identity TEXT,
        status TEXT
      )
      ON CONFLICT (workspace_id, provider_call_id) DO UPDATE SET
        contact_id = EXCLUDED.contact_id,
        position = EXCLUDED.position,
        caller_identity = EXCLUDED.caller_identity,
        status = EXCLUDED.status,
        updated_at = NOW()`,
      [
        request.id,
        request.workspaceId,
        request.userId,
        request.installationId ?? null,
        request.locationId ?? null,
        request.representativeName ?? null,
        request.source,
        request.selectionStrategy,
        request.requestedFanout,
        request.actualFanout,
        request.queueId ?? null,
        request.pipelineId ?? null,
        request.stageId ?? null,
        request.contactId ?? null,
        request.contactName ?? null,
        request.opportunityId ?? null,
        request.startedAt,
        request.status,
        request.opportunitySnapshot
          ? JSON.stringify(request.opportunitySnapshot)
          : null,
        request.recordingEnabled === true,
        request.transcriptionEnabled === true,
        JSON.stringify(
          request.calls.map((call) => ({
            id: randomUUID(),
            provider_call_id: call.providerCallId,
            contact_id: call.contactId ?? null,
            position: call.position,
            caller_identity: call.callerIdentity ?? null,
            status: call.status,
          })),
        ),
      ],
    ).pipe(Effect.asVoid),
  recordCallLegTransition: (request) =>
    Effect.gen(function* () {
      const update = yield* queryEffect<{
        workspace_id: string;
        session_id: string;
      }>(
        database,
        'record-call-leg-transition',
        `UPDATE dialer_call_legs
         SET status = $2,
             amd_result = COALESCE($3, amd_result),
             duration_seconds = COALESCE($4, duration_seconds),
             terminal_outcome = COALESCE($5, terminal_outcome),
             role = CASE
               WHEN $3 = 'human' THEN 'winner'
               WHEN $3 IS NOT NULL AND $3 <> 'human' THEN 'loser'
               ELSE role
             END,
             updated_at = NOW()
         WHERE provider_call_id = $1
         RETURNING workspace_id, session_id`,
        [
          request.providerCallId,
          request.status,
          request.amdResult ?? null,
          request.durationSeconds ?? null,
          request.terminalOutcome ?? null,
        ],
      );
      const leg = update.rows[0];
      if (!leg) return;
      yield* queryEffect(
        database,
        'project-call-session-transition',
        `UPDATE dialer_call_sessions sessions
         SET status = CASE
               WHEN $3 = 'human' THEN 'connected'
               WHEN NOT EXISTS (
                 SELECT 1 FROM dialer_call_legs legs
                 WHERE legs.workspace_id = sessions.workspace_id
                   AND legs.session_id = sessions.id
                   AND LOWER(legs.status) NOT IN ('completed', 'failed', 'canceled', 'busy', 'no-answer')
               ) THEN 'completed'
               ELSE sessions.status
             END,
             answered_at = CASE WHEN $3 = 'human' THEN COALESCE(answered_at, NOW()) ELSE answered_at END,
             ended_at = CASE
               WHEN NOT EXISTS (
                 SELECT 1 FROM dialer_call_legs legs
                 WHERE legs.workspace_id = sessions.workspace_id
                   AND legs.session_id = sessions.id
                   AND LOWER(legs.status) NOT IN ('completed', 'failed', 'canceled', 'busy', 'no-answer')
               ) THEN COALESCE(ended_at, NOW()) ELSE ended_at END,
             updated_at = NOW()
         WHERE workspace_id = $1 AND id = $2`,
        [leg.workspace_id, leg.session_id, request.amdResult ?? null],
      );
    }),
  listActiveCalls: ({ workspaceId }) =>
    Effect.gen(function* () {
      const { rows } = yield* queryEffect<SessionRow>(
        database,
        'list-active-calls',
        `SELECT * FROM dialer_call_sessions
         WHERE workspace_id = $1
           AND LOWER(status) NOT IN ('completed', 'failed', 'terminated', 'canceled')
         ORDER BY started_at DESC, id DESC`,
        [workspaceId],
      );
      const legs = yield* loadLegs(
        database,
        workspaceId,
        rows.map((row) => row.id),
      );
      return rows.map((row) => mapSession(row, legs.get(row.id) ?? []));
    }),
  listCallHistory: ({ workspaceId, status, cursor, limit }) =>
    Effect.gen(function* () {
      const decoded = decodeCursor(cursor);
      const boundedLimit = Math.min(Math.max(limit, 1), 100);
      const { rows } = yield* queryEffect<SessionRow>(
        database,
        'list-call-history',
        `SELECT * FROM dialer_call_sessions
         WHERE workspace_id = $1
           AND ($2::text IS NULL OR status = $2)
           AND ($3::timestamptz IS NULL OR (started_at, id) < ($3::timestamptz, $4::text))
         ORDER BY started_at DESC, id DESC
         LIMIT $5`,
        [
          workspaceId,
          status ?? null,
          decoded?.startedAt ?? null,
          decoded?.id ?? null,
          boundedLimit + 1,
        ],
      );
      const pageRows = rows.slice(0, boundedLimit);
      const legs = yield* loadLegs(
        database,
        workspaceId,
        pageRows.map((row) => row.id),
      );
      const calls = pageRows.map((row) =>
        mapSession(row, legs.get(row.id) ?? []),
      );
      return {
        calls,
        nextCursor:
          rows.length > boundedLimit
            ? encodeCursor(calls[calls.length - 1])
            : null,
      };
    }),
  getCallDetail: ({ workspaceId, callId }) =>
    Effect.gen(function* () {
      const { rows } = yield* queryEffect<SessionRow>(
        database,
        'get-call-detail',
        `SELECT * FROM dialer_call_sessions WHERE workspace_id = $1 AND id = $2 LIMIT 1`,
        [workspaceId, callId],
      );
      const row = rows[0];
      if (!row) return null;
      const [legs, events] = yield* Effect.all([
        loadLegs(database, workspaceId, [callId]),
        queryEffect<EventRow>(
          database,
          'get-call-events',
          `SELECT id, event_type, metadata, created_at
           FROM dialer_call_events
           WHERE workspace_id = $1 AND session_id = $2
           ORDER BY created_at, id`,
          [workspaceId, callId],
        ),
      ]);
      return {
        ...mapSession(row, legs.get(callId) ?? []),
        transferEvents: events.rows.map((event) => ({
          id: event.id,
          type: event.event_type,
          createdAt: new Date(event.created_at).toISOString(),
          metadata:
            event.metadata && typeof event.metadata === 'object'
              ? (event.metadata as Record<string, unknown>)
              : {},
        })),
      } satisfies CallDetail;
    }),
  getCallTranscript: ({ workspaceId, callId }) =>
    queryEffect<{
      id: string;
      workspace_id: string;
      session_id: string;
      provider_call_id: string;
      sequence: number | string;
      idempotency_key: string;
      track: TranscriptSegment['track'];
      speaker: TranscriptSegment['speaker'];
      text: string;
      start_ms: number | null;
      end_ms: number | null;
      language: string | null;
      confidence: number | null;
      provider: 'groq';
      model: string;
      created_at: string | Date;
    }>(
      database,
      'get-call-transcript',
      `SELECT * FROM dialer_transcript_segments
       WHERE workspace_id = $1 AND session_id = $2
       ORDER BY sequence, created_at, id`,
      [workspaceId, callId],
    ).pipe(
      Effect.map(({ rows }) =>
        rows.map((row) => ({
          id: row.id,
          workspaceId: row.workspace_id,
          sessionId: row.session_id,
          providerCallId: row.provider_call_id,
          sequence: Number(row.sequence),
          idempotencyKey: row.idempotency_key,
          track: row.track,
          speaker: row.speaker,
          text: row.text,
          startMs: row.start_ms,
          endMs: row.end_ms,
          language: row.language,
          confidence: row.confidence,
          provider: row.provider,
          model: row.model,
          createdAt: new Date(row.created_at).toISOString(),
        })),
      ),
    ),
  recordDisposition: (request) =>
    queryEffect(
      database,
      'record-call-disposition',
      `UPDATE dialer_call_sessions
       SET disposition = $3,
           note = COALESCE($4, note),
           tags = COALESCE($5::jsonb, tags),
           crm_sync_status = 'pending',
           crm_sync_error_code = NULL,
           updated_at = NOW()
       WHERE workspace_id = $1 AND id = $2`,
      [
        request.workspaceId,
        request.sessionId,
        request.disposition,
        request.note ?? null,
        request.tags ? JSON.stringify(request.tags) : null,
      ],
    ).pipe(Effect.asVoid),
  setCrmSyncStatus: (request) =>
    queryEffect(
      database,
      'set-crm-sync-status',
      `UPDATE dialer_call_sessions
       SET crm_sync_status = $3,
           crm_sync_error_code = $4,
           updated_at = NOW()
       WHERE workspace_id = $1 AND id = $2`,
      [
        request.workspaceId,
        request.sessionId,
        request.status,
        request.errorCode ?? null,
      ],
    ).pipe(Effect.asVoid),
  claimCallRecording: (request) =>
    queryEffect<{ workspace_id: string; session_id: string }>(
      database,
      'claim-call-recording',
      `UPDATE dialer_call_sessions AS sessions
       SET recording_status = 'starting',
           recording_failure_code = NULL,
           updated_at = NOW()
       FROM dialer_call_legs AS legs
       WHERE legs.workspace_id = sessions.workspace_id
         AND legs.session_id = sessions.id
         AND legs.provider_call_id = $1
         AND sessions.recording_enabled = TRUE
         AND sessions.recording_sid IS NULL
         AND sessions.recording_status = 'pending'
       RETURNING sessions.workspace_id, sessions.id AS session_id`,
      [request.providerCallId],
    ).pipe(
      Effect.map(({ rows }) =>
        rows[0]
          ? {
              workspaceId: rows[0].workspace_id,
              sessionId: rows[0].session_id,
              providerCallId: request.providerCallId,
            }
          : null,
      ),
    ),
  setCallRecordingStarted: (request) =>
    queryEffect(
      database,
      'set-call-recording-started',
      `UPDATE dialer_call_sessions
       SET recording_sid = $3,
           recording_status = $4,
           recording_failure_code = NULL,
           updated_at = NOW()
       WHERE workspace_id = $1 AND id = $2`,
      [
        request.workspaceId,
        request.sessionId,
        request.recordingSid,
        request.status,
      ],
    ).pipe(Effect.asVoid),
  setCallRecordingFailed: (request) =>
    queryEffect(
      database,
      'set-call-recording-failed',
      `UPDATE dialer_call_sessions
       SET recording_status = 'failed',
           recording_failure_code = $3,
           updated_at = NOW()
       WHERE workspace_id = $1 AND id = $2`,
      [request.workspaceId, request.sessionId, request.failureCode],
    ).pipe(Effect.asVoid),
  recordCallRecordingStatus: (request) =>
    queryEffect(
      database,
      'record-call-recording-status',
      `UPDATE dialer_call_sessions AS sessions
       SET recording_sid = $2,
           recording_status = $3,
           recording_url = COALESCE($4, recording_url),
           recording_duration_seconds = COALESCE($5, recording_duration_seconds),
           recording_failure_code = CASE WHEN $3 IN ('failed', 'absent') THEN UPPER($3) ELSE NULL END,
           updated_at = NOW()
       FROM dialer_call_legs AS legs
       WHERE legs.workspace_id = sessions.workspace_id
         AND legs.session_id = sessions.id
         AND legs.provider_call_id = $1`,
      [
        request.providerCallId,
        request.recordingSid,
        request.recordingStatus,
        request.recordingUrl ?? null,
        request.recordingDurationSeconds ?? null,
      ],
    ).pipe(Effect.asVoid),
});
