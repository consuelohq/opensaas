import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { createTimeline, reduceTimeline } from '@consuelo/conversation';
import { normalizeTranscriptSegment } from './normalization';
import { readTranscriptOutbox, acknowledgeTranscriptOutbox } from './outbox';
import { websocket } from 'hono/bun';
import { createCallOperationsApplication } from './application';
import {
  createPostgresCallOperationsRepository,
  initializeCallOperationsPersistence,
  type CallOperationsDatabase,
} from './persistence';
import { createTwilioMediaRoutes } from '../routes/twilio-media';
import { withDisposableCommercialPostgres } from '../test-support/disposable-commercial-postgres';

const suite =
  process.env.CONSUELO_RUN_TRANSCRIPTION_POSTGRES === '1'
    ? describe
    : describe.skip;
// This checkout's Bun declarations omit the native client's header overload.
const FixtureWebSocket = WebSocket as unknown as {
  new (
    url: string,
    options: { headers: Record<string, string> },
  ): globalThis.WebSocket;
};

suite('real loopback Twilio Media Streams with isolated PostgreSQL', () => {
  it('persists exact provider timing, deduplicates reconnects and enforces call/account/tenant/consent', async () => {
    await withDisposableCommercialPostgres(async (database) => {
      const typedDatabase: CallOperationsDatabase = {
        query: async <TRow,>(sql: string, values?: readonly unknown[]) => {
          const result = await database.query(sql, values);
          return { rows: result.rows as TRow[], rowCount: result.rowCount };
        },
      };
      await initializeCallOperationsPersistence(typedDatabase);
      const repository = createPostgresCallOperationsRepository(typedDatabase);
      for (const [id, enabled] of [
        ['call-one', true],
        ['call-off', false],
      ] as const) {
        await Effect.runPromise(
          repository.createOrUpdateCallSession({
            id,
            workspaceId: 'tenant-one',
            userId: 'rep-one',
            source: 'direct',
            selectionStrategy: 'single',
            requestedFanout: 1,
            actualFanout: 1,
            status: 'connected',
            startedAt: new Date().toISOString(),
            transcriptionEnabled: enabled,
            calls: [
              {
                providerCallId: id,
                providerAccountId: 'AC-owner',
                contactId: 'customer-one',
                position: 1,
                status: 'in-progress',
              },
            ],
          }),
        );
      }
      let requests = 0;
      const application = createCallOperationsApplication({
        repository,
        speechToTextProvider: {
          transcribe: () =>
            Effect.sync(() => {
              requests++;
              return {
                text: 'existing coverage',
                words: [
                  { text: 'existing', startMs: 10, endMs: 40 },
                  { text: 'coverage', startMs: 50, endMs: 90 },
                ],
                language: 'en',
              };
            }),
        },
        config: {
          model: 'whisper-large-v3-turbo',
          chunkBytes: 16000,
          maxBufferBytesPerTrack: 48000,
          providerTimeoutMs: 1000,
          maxConcurrentTranscriptions: 2,
        },
      });
      let resolveDrain: () => void = () => {};
      const watchedApplication = {
        ...application,
        processTranscriptionFrame: (
          request: Parameters<typeof application.processTranscriptionFrame>[0],
        ) =>
          application.processTranscriptionFrame(request).pipe(
            Effect.tap(() =>
              Effect.sync(() => {
                if (request.frame.event === 'stop') resolveDrain();
              }),
            ),
          ),
        failTranscriptionSession: (
          request: Parameters<typeof application.failTranscriptionSession>[0],
        ) =>
          application
            .failTranscriptionSession(request)
            .pipe(Effect.tap(() => Effect.sync(() => resolveDrain()))),
      };
      const routes = createTwilioMediaRoutes({
        callOperations: watchedApplication,
        verifyTwilioSignature: async (input) =>
          input.signature === 'fixture-signature',
      });
      const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch: routes.fetch,
        websocket,
      });
      const stream = async (
        options: {
          call?: string;
          account?: string;
          session?: string;
          stream?: string;
        } = {},
      ) => {
        const call = options.call ?? 'call-one',
          streamSid = options.stream ?? 'MZ-fixture';
        const drained = new Promise<void>((resolve) => {
          resolveDrain = resolve;
        });
        const socket = new FixtureWebSocket(
          'ws://127.0.0.1:' + server.port + '/webhooks/twilio/media/' + call,
          { headers: { 'x-twilio-signature': 'fixture-signature' } },
        );
        try {
          await new Promise<void>((resolve, reject) => {
            socket.onopen = () => resolve();
            socket.onerror = () => reject(new Error('loopback socket failed'));
          });
          const media = {
            event: 'media',
            sequenceNumber: '2',
            streamSid,
            media: {
              track: 'inbound',
              chunk: '1',
              timestamp: '1000',
              payload: Buffer.alloc(800, 0x20).toString('base64'),
            },
          };
          for (const frame of [
            { event: 'connected', protocol: 'Call', version: '1.0.0' },
            {
              event: 'start',
              sequenceNumber: '1',
              streamSid,
              start: {
                streamSid,
                callSid: call,
                accountSid: options.account ?? 'AC-owner',
                tracks: ['inbound', 'outbound'],
                mediaFormat: {
                  encoding: 'audio/x-mulaw',
                  sampleRate: 8000,
                  channels: 1,
                },
                customParameters: {
                  sessionId: options.session ?? call,
                  callId: call,
                },
              },
            },
            media,
            media,
            {
              event: 'stop',
              sequenceNumber: '3',
              streamSid,
              stop: {
                callSid: call,
                accountSid: options.account ?? 'AC-owner',
              },
            },
          ])
            socket.send(JSON.stringify(frame));
          await Promise.race([
            drained,
            new Promise<never>((_resolve, reject) => {
              const timer = setTimeout(
                () => reject(new Error('media drain timed out')),
                1000,
              );
              timer.unref();
            }),
          ]);
        } finally {
          socket.close();
        }
      };
      try {
        expect(
          (
            await fetch(
              'http://127.0.0.1:' +
                server.port +
                '/webhooks/twilio/media/call-one',
            )
          ).status,
        ).toBe(401);
        await stream();
        const segments = await Effect.runPromise(
          repository.getCallTranscript({
            workspaceId: 'tenant-one',
            callId: 'call-one',
          }),
        );
        expect(segments).toHaveLength(1);
        expect(segments[0]).toMatchObject({
          text: 'existing coverage',
          startMs: 1010,
          endMs: 1090,
          speaker: 'customer',
          metadata: {
            sourceAudioStartMs: 1000,
            sourceAudioEndMs: 1100,
            timingBasis: 'provider-words',
          },
        });
        await stream({ stream: 'MZ-reconnected' });
        expect(
          await Effect.runPromise(
            repository.getCallTranscript({
              workspaceId: 'tenant-one',
              callId: 'call-one',
            }),
          ),
        ).toHaveLength(1);
        const outbox = await database.query(
          'SELECT cursor, payload FROM dialer_transcript_outbox WHERE workspace_id = $1 AND session_id = $2 ORDER BY cursor',
          ['tenant-one', 'call-one'],
        );
        expect(outbox.rows).toHaveLength(1);
        expect(outbox.rows[0]).toMatchObject({
          cursor: '1',
          payload: { schemaVersion: 1, transcriptSegmentId: segments[0]!.id },
        });
        expect(JSON.stringify(outbox.rows)).not.toContain('existing coverage');
        const signal = new AbortController().signal;
        const references = await readTranscriptOutbox(typedDatabase, {
          workspaceId: 'tenant-one',
          sessionId: 'call-one',
          afterCursor: 0,
          limit: 10,
          signal,
        });
        const scope = {
          workspaceId: 'tenant-one',
          callSessionId: 'call-one',
          callGeneration: 1,
        };
        const binding = {
          participantId: 'customer-one',
          legId: 'call-one',
          role: 'customer' as const,
          provenance: 'authenticated-leg' as const,
          bindingRevision: 1,
        };
        const normalized = normalizeTranscriptSegment({
          segment: references[0]!.segment,
          scope,
          binding,
          cursor: { sequence: 1, epoch: 0 },
          audioOffsetMs: 0,
        });
        expect(normalized.ok).toBe(true);
        if (!normalized.ok) throw new Error(normalized.reason);
        expect(
          reduceTimeline(createTimeline(scope, [binding]), normalized.value)
            .status,
        ).toBe('applied');
        await acknowledgeTranscriptOutbox(typedDatabase, {
          workspaceId: 'tenant-one',
          sessionId: 'call-one',
          outboxId: references[0]!.outboxId,
          signal,
        });
        expect(
          await readTranscriptOutbox(typedDatabase, {
            workspaceId: 'tenant-one',
            sessionId: 'call-one',
            afterCursor: 1,
            limit: 10,
            signal,
          }),
        ).toEqual([]);
        const before = requests;
        await stream({ account: 'AC-foreign' });
        await stream({ session: 'foreign-session' });
        await stream({ call: 'call-off' });
        expect(requests).toBe(before);
        expect(
          await Effect.runPromise(
            repository.getCallTranscript({
              workspaceId: 'foreign-tenant',
              callId: 'call-one',
            }),
          ),
        ).toEqual([]);
        await Effect.runPromise(
          repository.setTranscriptStatus({
            workspaceId: 'tenant-one',
            sessionId: 'call-one',
            status: 'failed',
            failureCode: 'PROVIDER_TIMEOUT',
          }),
        );
        expect(
          await Effect.runPromise(
            repository.getCallDetail({
              workspaceId: 'tenant-one',
              callId: 'call-one',
            }),
          ),
        ).toMatchObject({
          transcriptCoverage: 'partial',
          transcriptFailureCode: 'PROVIDER_TIMEOUT',
          status: 'connected',
        });
        await database.query(
          'UPDATE dialer_call_sessions SET transcription_enabled = FALSE WHERE id = $1',
          ['call-one'],
        );
        const late = await Effect.runPromise(
          repository.appendTranscriptSegment({
            ...segments[0]!,
            id: 'late',
            idempotencyKey: 'late',
          }),
        );
        expect(late.inserted).toBe(false);
        const history = await Effect.runPromise(
          repository.getCallDetail({
            workspaceId: 'tenant-one',
            callId: 'call-one',
          }),
        );
        expect(history?.status).toBe('connected');
      } finally {
        await server.stop(true);
      }
    });
  }, 30000);
});
