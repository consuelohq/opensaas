import type { TranscriptSegment } from './contracts';
import type { CallOperationsDatabase } from './persistence';

export type TranscriptOutboxReference = {
  outboxId: string;
  cursor: number;
  segment: TranscriptSegment;
};

// This cursor orders persisted SOURCE references. A host allocates core event cursors
// after trusted alignment/participant admission; one reference may also describe a gap.
export const readTranscriptOutbox = async (
  database: CallOperationsDatabase,
  input: {
    workspaceId: string;
    sessionId: string;
    afterCursor: number;
    limit: number;
    signal: AbortSignal;
  },
): Promise<TranscriptOutboxReference[]> => {
  try {
    input.signal.throwIfAborted();
    if (
      !Number.isSafeInteger(input.afterCursor) ||
      input.afterCursor < 0 ||
      !Number.isFinite(input.limit)
    )
      throw new Error('invalid transcript cursor or limit');
    const result = await database.query<{
      outbox_id: string;
      cursor: string | number;
      segment: TranscriptSegment;
    }>(
      `
      SELECT outbox.event_id AS outbox_id, outbox.cursor,
        jsonb_build_object(
          'id', segments.id, 'workspaceId', segments.workspace_id, 'sessionId', segments.session_id,
          'providerCallId', segments.provider_call_id, 'sequence', segments.sequence,
          'idempotencyKey', segments.idempotency_key, 'track', segments.track, 'speaker', segments.speaker,
          'text', segments.text, 'startMs', segments.start_ms, 'endMs', segments.end_ms,
          'language', segments.language, 'confidence', segments.confidence,
          'provider', segments.provider, 'model', segments.model, 'createdAt', segments.created_at,
          'metadata', segments.metadata
        ) AS segment
      FROM dialer_transcript_outbox outbox
      JOIN dialer_transcript_segments segments
        ON segments.workspace_id = outbox.workspace_id AND segments.session_id = outbox.session_id
        AND segments.id = outbox.payload->>'transcriptSegmentId'
      JOIN dialer_call_sessions sessions
        ON sessions.workspace_id = outbox.workspace_id AND sessions.id = outbox.session_id
      WHERE outbox.workspace_id = $1 AND outbox.session_id = $2 AND outbox.cursor > $3
        AND outbox.event_type = 'transcript-segment-persisted' AND sessions.transcription_enabled = TRUE
      ORDER BY outbox.cursor LIMIT $4
    `,
      [
        input.workspaceId,
        input.sessionId,
        input.afterCursor,
        Math.max(1, Math.min(100, Math.floor(input.limit))),
      ],
    );
    input.signal.throwIfAborted();
    return result.rows.map((row) => {
      const cursor = Number(row.cursor);
      if (!Number.isSafeInteger(cursor) || cursor <= input.afterCursor)
        throw new Error('invalid stored transcript cursor');
      return { outboxId: row.outbox_id, cursor, segment: row.segment };
    });
  } catch (cause: unknown) {
    throw cause instanceof Error
      ? cause
      : new Error('transcript reference read failed');
  }
};

export const acknowledgeTranscriptOutbox = async (
  database: CallOperationsDatabase,
  input: {
    workspaceId: string;
    sessionId: string;
    outboxId: string;
    signal: AbortSignal;
  },
): Promise<void> => {
  try {
    input.signal.throwIfAborted();
    await database.query(
      `
      UPDATE dialer_transcript_outbox SET delivered_at = COALESCE(delivered_at, NOW())
      WHERE workspace_id = $1 AND session_id = $2 AND event_id = $3
    `,
      [input.workspaceId, input.sessionId, input.outboxId],
    );
    input.signal.throwIfAborted();
  } catch (cause: unknown) {
    throw cause instanceof Error
      ? cause
      : new Error('transcript reference acknowledgment failed');
  }
};
