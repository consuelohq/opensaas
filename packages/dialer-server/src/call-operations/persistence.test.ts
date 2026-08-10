import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';

import {
  createPostgresCallOperationsRepository,
  initializeCallOperationsPersistence,
  type CallOperationsDatabase,
} from './persistence';

describe('call-operations persistence', () => {
  it('initializes canonical workspace settings, sessions, legs, segments, and transfer-compatible events', async () => {
    const statements: string[] = [];
    const database: CallOperationsDatabase = {
      query: async (text) => {
        statements.push(text);
        return { rows: [], rowCount: 0 };
      },
    };
    await initializeCallOperationsPersistence(database);
    const sql = statements.join('\n');

    expect(sql).toContain('dialer_workspace_settings');
    expect(sql).toContain(
      'transcription_enabled BOOLEAN NOT NULL DEFAULT FALSE',
    );
    expect(sql).toContain('transcript_retention_days');
    expect(sql).toContain('dialer_call_sessions');
    expect(sql).toContain('dialer_call_legs');
    expect(sql).toContain('dialer_transcript_segments');
    expect(sql).toContain('dialer_call_events');
    expect(sql).toContain('transfer_initiated');
    expect(sql).toContain('transfer_consulting');
    expect(sql).toContain('transfer_completed');
    expect(sql).toContain('transfer_cancelled');
    expect(sql).toContain('transfer_failed');
    expect(sql).toContain('UNIQUE (workspace_id, provider_call_id)');
    expect(sql).toContain('UNIQUE (workspace_id, session_id, idempotency_key)');
    expect(sql).not.toMatch(/audio|wav|mp3|mulaw|media_payload|raw_frame/i);
  });

  it('uses a workspace-scoped idempotent insert for transcript metadata', async () => {
    const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
    const database: CallOperationsDatabase = {
      query: async <TRow>(text: string, values?: readonly unknown[]) => {
        calls.push({ text, values });
        return { rows: [{ inserted: true }] as TRow[], rowCount: 1 };
      },
    };
    const repository = createPostgresCallOperationsRepository(database);
    const result = await Effect.runPromise(
      repository.appendTranscriptSegment({
        id: 'segment-1',
        workspaceId: 'workspace-1',
        sessionId: 'session-1',
        providerCallId: 'CA-1',
        sequence: 2,
        idempotencyKey: 'session-1:CA-1:inbound:2:3',
        track: 'inbound',
        speaker: 'inbound',
        text: 'Hello',
        startMs: 0,
        endMs: 500,
        language: 'en',
        confidence: 0.84,
        provider: 'groq',
        model: 'whisper-large-v3-turbo',
        createdAt: '2026-08-04T12:00:00.000Z',
      }),
    );

    expect(result).toEqual({ inserted: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toContain('ON CONFLICT');
    expect(calls[0]?.text).toContain('workspace_id');
    expect(calls[0]?.values).toContain('workspace-1');
    expect(JSON.stringify(calls[0]?.values)).not.toContain('audio');
  });

  it('atomically upserts the canonical session and all provider legs', async () => {
    const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
    const database: CallOperationsDatabase = {
      query: async <TRow>(text: string, values?: readonly unknown[]) => {
        calls.push({ text, values });
        return { rows: [] as TRow[], rowCount: 0 };
      },
    };
    const repository = createPostgresCallOperationsRepository(database);

    await Effect.runPromise(
      repository.createOrUpdateCallSession({
        id: 'session-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        source: 'queue',
        selectionStrategy: 'predictive',
        requestedFanout: 2,
        actualFanout: 2,
        queueId: 'queue-1',
        status: 'dialing',
        startedAt: '2026-08-04T12:00:00.000Z',
        calls: [
          {
            providerCallId: 'CA-1',
            contactId: 'contact-1',
            position: 1,
            status: 'queued',
          },
          {
            providerCallId: 'CA-2',
            contactId: 'contact-2',
            position: 2,
            status: 'queued',
          },
        ],
      }),
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toContain('WITH upserted_session AS');
    expect(calls[0]?.text).toContain('jsonb_to_recordset');
    expect(calls[0]?.text).toContain(
      'ON CONFLICT (workspace_id, provider_call_id)',
    );
    expect(String(calls[0]?.values?.[19])).toContain('CA-1');
    expect(String(calls[0]?.values?.[19])).toContain('CA-2');
  });
});
