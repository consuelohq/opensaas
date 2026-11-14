import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Effect } from 'effect';
import { Hono } from 'hono';
import { Pool } from 'pg';
import { createMercuryAuthoringApi } from '../../../lead-connector/src/embed/mercury-authoring';
import { createMercuryFeedApi } from '../../../lead-connector/src/embed/mercury-feed-api';
import { CREATE_COACHING_SCRIPTS_SQL } from '../coaching/scripts';
import { CREATE_PLAYBOOK_PUBLICATIONS_SQL } from '../coaching/playbook-store';
import { SYNTHETIC_LIFE_INSURANCE } from '../coaching/playbooks';
import { createCoachingRuntime } from '../runtime/coaching';
import { createCoachingRoutes } from '../routes/coaching';
import {
  createPostgresCallOperationsRepository,
  initializeCallOperationsPersistence,
} from '../call-operations/persistence';
import { TRANSCRIPT_TIMING_SCHEMA_SQL } from '../call-operations/transcript-schema';
import type { DialerVariables } from '../middleware/auth';

const suite =
  process.env.CONSUELO_RUN_COACHING_POSTGRES === '1' ? describe : describe.skip;
const run = async (args: string[]) => {
  const process = Bun.spawn(args, {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...globalThis.process.env, LC_ALL: 'C', LANG: 'C' },
  });
  const [out, err, exit] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exit) throw new Error(err || out);
  return out.trim();
};
const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string')
        return reject(new Error('Missing port'));
      server.close(() => resolve(address.port));
    });
  });

suite('actual Mercury client and Hono routes with fixture authority', () => {
  test('previews, publishes, admits, polls, delivers an approved cue and fences stale controls', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mercury-client-replay-'));
    let pool: Pool | undefined;
    let runtime: ReturnType<typeof createCoachingRuntime> | undefined;
    let pgCtl: string | undefined;
    let started = false;
    try {
      const pgConfig = Bun.which('pg_config');
      if (!pgConfig) throw new Error('pg_config required');
      const bin = await run([pgConfig, '--bindir']);
      pgCtl = join(bin, 'pg_ctl');
      const data = join(directory, 'data');
      const port = await freePort();
      await run([
        join(bin, 'initdb'),
        '-D',
        data,
        '--auth=trust',
        '--username=postgres',
        '--no-locale',
      ]);
      try {
        await run([
          pgCtl,
          '-D',
          data,
          '-l',
          join(directory, 'postgres.log'),
          '-o',
          `-h 127.0.0.1 -p ${port} -F`,
          '-w',
          'start',
        ]);
      } catch (error: unknown) {
        const log = await readFile(
          join(directory, 'postgres.log'),
          'utf8',
        ).catch(() => 'no PostgreSQL log');
        throw new Error(`fixture PostgreSQL failed: ${log}`, { cause: error });
      }
      started = true;
      pool = new Pool({
        host: '127.0.0.1',
        port,
        user: 'postgres',
        database: 'postgres',
        max: 6,
      });
      await pool.query(CREATE_COACHING_SCRIPTS_SQL);
      await pool.query(CREATE_PLAYBOOK_PUBLICATIONS_SQL);
      await initializeCallOperationsPersistence(pool);
      await pool.query(TRANSCRIPT_TIMING_SCHEMA_SQL);
      const repository = createPostgresCallOperationsRepository(pool);
      let live = false;
      runtime = createCoachingRuntime(pool, {
        resolveSessionId: async (identity, group) =>
          identity.workspaceId === 'fixture' &&
          identity.userId === 'rep' &&
          group === 'group'
            ? 'call'
            : null,
        liveAuthority: async (identity, { scope }) =>
          !live
            ? null
            : {
                scope,
                active: true,
                audioOffsetMs: 0,
                participants: [
                  {
                    participantId: 'customer',
                    legId: 'fixture-leg',
                    role: 'customer',
                    provenance: 'authenticated-leg',
                    bindingRevision: 1,
                  },
                ],
                policy: {
                  scope,
                  memberId: identity.userId,
                  revision: 1,
                  validUntilMs: Date.now() + 10000,
                  revoked: false,
                  capabilities: [
                    'manual-reference',
                    'live-transcription',
                    'live-coaching',
                  ],
                  consent: {
                    ephemeralTranscription: true,
                    retainedTranscript: false,
                    aiGeneration: false,
                  },
                },
              },
      });
      const app = new Hono<{ Variables: DialerVariables }>();
      app.use('*', async (c, next) => {
        const token = c.req.header('authorization');
        if (token !== 'Bearer fixture-rep' && token !== 'Bearer fixture-other')
          return c.json({ error: { code: 'UNAUTHORIZED' } }, 401);
        c.set('identity', {
          workspaceId: 'fixture',
          userId: token === 'Bearer fixture-rep' ? 'rep' : 'other',
        });
        await next();
      });
      app.route('/', createCoachingRoutes(runtime));
      const bridge = async (input: RequestInfo | URL, init?: RequestInit) =>
        app.fetch(new Request(input, init));
      const options = {
        baseUrl: 'https://fixture.invalid',
        getToken: () => 'fixture-rep',
        fetch: bridge,
      };
      const author = createMercuryAuthoringApi(options);
      const feed = createMercuryFeedApi(options);
      const scriptId = randomUUID();
      const identity = { workspaceId: 'fixture', userId: 'rep' };
      await runtime.save(identity, {
        id: scriptId,
        title: 'Synthetic examples',
        content: SYNTHETIC_LIFE_INSURANCE.content,
        expectedRevision: 0,
      });
      // Keep exercising the feed if preview is broken, then fail with the original error.
      let previewFailure: unknown;
      try {
        const preview = await author.preview(scriptId, 1);
        expect(preview.cards).toHaveLength(6);
        expect(
          preview.cards.find((card) => card.id === 'existing-coverage')
            ?.listenFor,
        ).toContain('existing coverage');
      } catch (error: unknown) {
        previewFailure = error;
      }
      expect(await author.versions(scriptId)).toEqual([]);
      expect(
        await author.publish(scriptId, {
          expectedRevision: 1,
          expectedPublishedVersion: 0,
          approved: true,
        }),
      ).toEqual({ version: 1 });
      expect(await author.versions(scriptId)).toEqual([1]);
      try {
        expect((await author.preview(scriptId, 1)).cards).toHaveLength(6);
      } catch (error: unknown) {
        previewFailure ??= error;
      }
      expect(
        await author.publish(scriptId, {
          expectedRevision: 1,
          expectedPublishedVersion: 1,
          approved: true,
        }),
      ).toEqual({ version: 2 });
      expect(await author.versions(scriptId)).toEqual([2, 1]);
      await Effect.runPromise(
        repository.createOrUpdateCallSession({
          id: 'call',
          workspaceId: 'fixture',
          userId: 'rep',
          source: 'direct',
          selectionStrategy: 'single',
          requestedFanout: 1,
          actualFanout: 1,
          transcriptionEnabled: true,
          startedAt: new Date().toISOString(),
          status: 'connected',
          calls: [
            {
              providerCallId: 'fixture-leg',
              position: 0,
              status: 'in-progress',
            },
          ],
        }),
      );
      const scopeKey = 'outbound:group';
      const opened = await feed.start({ scopeKey, scriptId });
      expect(opened.view?.status).toBe('manual');
      expect(opened.publishedVersion).toBe(`${scriptId}:2`);
      expect(
        (await feed.read(scopeKey, opened.view!.revision)).view,
      ).toBeNull();
      expect(
        (await feed.control(scopeKey, 'off', opened.projectionToken)).view
          ?.status,
      ).toBe('manual');
      await Effect.runPromise(
        repository.appendTranscriptSegment({
          id: 'segment-1',
          workspaceId: 'fixture',
          sessionId: 'call',
          providerCallId: 'fixture-leg',
          sequence: 1,
          idempotencyKey: 'segment-1',
          track: 'inbound',
          speaker: 'customer',
          text: 'I have existing coverage',
          startMs: 0,
          endMs: 900,
          language: 'en',
          confidence: null,
          provider: 'groq',
          model: 'synthetic-fixture',
          createdAt: new Date().toISOString(),
          metadata: {
            schemaVersion: 1,
            sourceAudioStartMs: 0,
            sourceAudioEndMs: 1000,
            streamSid: 'fixture-stream',
            timingBasis: 'provider-words',
            speakerProvenance: 'authenticated-leg',
            words: [],
            speechSegments: [],
          },
        }),
      );
      live = true;
      const reopened = await feed.start({ scopeKey, scriptId });
      expect(reopened.projectionToken).not.toBe(opened.projectionToken);
      expect(reopened.view).toMatchObject({
        kind: 'approved',
        status: 'live',
        heading: 'Existing coverage',
      });
      expect(reopened.view?.points[0]?.text).toBe(
        'Ask about existing coverage',
      );
      expect(
        (await pool.query('SELECT delivered_at FROM dialer_transcript_outbox'))
          .rows[0].delivered_at,
      ).not.toBeNull();
      await expect(
        feed.control(scopeKey, 'off', opened.projectionToken),
      ).rejects.toThrow();
      const other = createMercuryFeedApi({
        ...options,
        getToken: () => 'fixture-other',
      });
      await expect(other.read(scopeKey, 0)).rejects.toThrow();
      expect(
        (await feed.control(scopeKey, 'off', reopened.projectionToken)).view
          ?.status,
      ).toBe('manual');
      if (previewFailure) throw previewFailure;
    } finally {
      runtime?.mercury.cues.dispose();
      await pool?.end();
      if (started && pgCtl)
        await run([
          pgCtl,
          '-D',
          join(directory, 'data'),
          '-m',
          'fast',
          '-w',
          'stop',
        ]);
      await rm(directory, { recursive: true, force: true });
    }
  }, 30000);
});
