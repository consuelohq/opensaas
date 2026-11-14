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
      // Deliberately arbitrary authored aliases prove this is not the canned life pack.
      const rules = [
        {
          cardId: 'existing-coverage',
          aliases: ['emerald umbrella'],
          required: [],
          forbidden: [],
          priority: 50,
          speaker: 'customer' as const,
          nextCardIds: [],
        },
      ];
      const preview = await author.preview(scriptId, 1, rules);
      expect(preview.cards).toHaveLength(6);
      expect(
        preview.cards.find((card) => card.id === 'existing-coverage')
          ?.listenFor,
      ).toContain('emerald umbrella');
      expect(await author.versions(scriptId)).toEqual([]);
      const command = {
        expectedRevision: 1,
        expectedPublishedVersion: preview.expectedPublishedVersion,
        approved: true as const,
        rules: preview.rules,
        reviewToken: preview.reviewToken,
      };
      await expect(
        author.publish(scriptId, {
          ...command,
          rules: [{ ...rules[0]!, aliases: ['violet lantern'] }],
        }),
      ).rejects.toThrow();
      await expect(
        author.publish(scriptId, { ...command, reviewToken: '0'.repeat(64) }),
      ).rejects.toThrow();
      expect(await author.versions(scriptId)).toEqual([]);
      expect(await author.publish(scriptId, command)).toEqual({ version: 1 });
      expect(await author.versions(scriptId)).toEqual([1]);
      const loaded = await author.preview(scriptId, 1);
      expect(loaded.rules).toEqual(preview.rules);
      expect(
        loaded.cards.find((card) => card.id === 'existing-coverage')?.listenFor,
      ).toContain('emerald umbrella');
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
      const manual = await feed.start({ scopeKey, scriptId });
      expect(manual.view?.status).toBe('manual');
      expect(manual.publishedVersion).toBe(`${scriptId}:1`);
      expect(
        (await feed.control(scopeKey, 'off', manual.projectionToken)).view
          ?.status,
      ).toBe('manual');
      live = true;
      const opened = await feed.start({ scopeKey, scriptId });
      expect(opened.projectionToken).not.toBe(manual.projectionToken);
      await expect(
        feed.control(scopeKey, 'off', manual.projectionToken),
      ).rejects.toThrow();
      expect(opened.view?.status).toBe('manual');
      expect(opened.publishedVersion).toBe(`${scriptId}:1`);
      expect(
        (await feed.read(scopeKey, opened.view!.revision)).view,
      ).toBeNull();
      const nextRules = [{ ...rules[0]!, aliases: ['violet lantern'] }];
      const nextPreview = await author.preview(scriptId, 1, nextRules);
      expect(
        await author.publish(scriptId, {
          expectedRevision: 1,
          expectedPublishedVersion: nextPreview.expectedPublishedVersion,
          approved: true,
          rules: nextPreview.rules,
          reviewToken: nextPreview.reviewToken,
        }),
      ).toEqual({ version: 2 });
      expect(await author.versions(scriptId)).toEqual([2, 1]);
      expect(
        (await feed.read(scopeKey, opened.view!.revision)).publishedVersion,
      ).toBe(`${scriptId}:1`);
      const stale = await author.preview(scriptId, 1, nextRules);
      await runtime.save(identity, {
        id: scriptId,
        title: 'Synthetic examples',
        content: SYNTHETIC_LIFE_INSURANCE.content.replace(
          'Confirm who it protects',
          'Confirm the protection they need',
        ),
        expectedRevision: 1,
      });
      await expect(
        author.publish(scriptId, {
          expectedRevision: 1,
          expectedPublishedVersion: stale.expectedPublishedVersion,
          approved: true,
          rules: stale.rules,
          reviewToken: stale.reviewToken,
        }),
      ).rejects.toThrow();
      // Updating the revision in the command cannot salvage a token for old source.
      await expect(
        author.publish(scriptId, {
          expectedRevision: 2,
          expectedPublishedVersion: stale.expectedPublishedVersion,
          approved: true,
          rules: stale.rules,
          reviewToken: stale.reviewToken,
        }),
      ).rejects.toThrow();
      const editedPreview = await author.preview(scriptId, 2);
      expect(
        editedPreview.cards.find((card) => card.id === 'existing-coverage')
          ?.listenFor,
      ).not.toContain('violet lantern');
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
          text: 'emerald umbrella',
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
      const delivered = await feed.read(scopeKey, opened.view!.revision);
      expect(delivered.publishedVersion).toBe(`${scriptId}:1`);
      expect(delivered.view).toMatchObject({
        kind: 'approved',
        status: 'live',
        heading: 'Existing coverage',
      });
      expect(delivered.view?.points[0]?.text).toBe(
        'Ask about existing coverage',
      );
      expect(
        (await feed.control(scopeKey, 'off', opened.projectionToken)).view
          ?.status,
      ).toBe('manual');
      const reopened = await feed.start({ scopeKey, scriptId });
      // A restarted projection in the same call retains its durable V1 pin.
      expect(reopened.publishedVersion).toBe(`${scriptId}:1`);
      expect(reopened.projectionToken).not.toBe(opened.projectionToken);
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
      // Compile the reviewed source while an editor holds an uncommitted update.
      // The INSERT must wait on that row and recheck the revision after commit.
      const raceId = randomUUID();
      await runtime.save(identity, {
        id: raceId,
        title: 'Race fixture',
        content: SYNTHETIC_LIFE_INSURANCE.content,
        expectedRevision: 0,
      });
      const publicationClient = await pool.connect();
      const editor = await pool.connect();
      let editorOpen = false;
      let insertStarted!: () => void;
      const startedInsert = new Promise<void>((resolve) => {
        insertStarted = resolve;
      });
      let insertion: Promise<unknown> | undefined;
      const database = new Proxy(pool, {
        get(target, property) {
          if (property === 'query')
            return (sql: string, values?: unknown[]) => {
              if (
                sql.includes('INSERT INTO dialer_coaching_script_publications')
              ) {
                insertion = publicationClient.query(sql, values);
                insertStarted();
                return insertion;
              }
              return target.query(sql, values);
            };
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      const raceRuntime = createCoachingRuntime(database);
      try {
        const raceApp = new Hono<{ Variables: DialerVariables }>();
        raceApp.use('*', async (c, next) => {
          c.set('identity', identity);
          await next();
        });
        raceApp.route('/', createCoachingRoutes(raceRuntime));
        const raceAuthor = createMercuryAuthoringApi({
          ...options,
          fetch: async (input, init) => raceApp.fetch(new Request(input, init)),
        });
        const reviewed = await raceAuthor.preview(raceId, 1, rules);
        await editor.query('BEGIN');
        editorOpen = true;
        await editor.query(
          'UPDATE dialer_coaching_scripts SET content=$1, revision=revision+1 WHERE workspace_id=$2 AND id=$3::uuid',
          [
            SYNTHETIC_LIFE_INSURANCE.content.replace(
              'Confirm who it protects',
              'Confirm changed protection',
            ),
            'fixture',
            raceId,
          ],
        );
        const pid = (
          await publicationClient.query('SELECT pg_backend_pid() AS pid')
        ).rows[0]!.pid;
        let settled = false;
        const publishing = raceAuthor
          .publish(raceId, {
            expectedRevision: 1,
            expectedPublishedVersion: reviewed.expectedPublishedVersion,
            rules: reviewed.rules,
            reviewToken: reviewed.reviewToken,
            approved: true,
          })
          .then(
            () => 'published',
            () => 'rejected',
          );
        await startedInsert;
        insertion!.then(
          () => {
            settled = true;
          },
          () => {
            settled = true;
          },
        );
        const deadline = Date.now() + 5000;
        let blocked = false;
        while (!settled && Date.now() < deadline) {
          const activity = await pool.query(
            'SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',
            [pid],
          );
          if (activity.rows[0]?.wait_event_type === 'Lock') {
            blocked = true;
            break;
          }
        }
        await editor.query('COMMIT');
        editorOpen = false;
        expect(await publishing).toBe('rejected');
        expect(blocked).toBe(true);
        expect(await raceAuthor.versions(raceId)).toEqual([]);
      } finally {
        if (editorOpen) await editor.query('ROLLBACK');
        await insertion?.catch(() => undefined);
        raceRuntime.mercury.cues.dispose();
        editor.release();
        publicationClient.release();
      }
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
