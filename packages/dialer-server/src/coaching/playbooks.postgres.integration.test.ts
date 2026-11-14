import { describe, test, expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { Hono } from 'hono';
import { Effect } from 'effect';
import { CREATE_COACHING_SCRIPTS_SQL } from './scripts';
import { CREATE_PLAYBOOK_PUBLICATIONS_SQL } from './playbook-store';
import { createCoachingRuntime } from '../runtime/coaching';
import { createCoachingRoutes } from '../routes/coaching';
import {
  initializeCallOperationsPersistence,
  createPostgresCallOperationsRepository,
} from '../call-operations/persistence';
import { TRANSCRIPT_TIMING_SCHEMA_SQL } from '../call-operations/transcript-schema';
import { SYNTHETIC_LIFE_INSURANCE } from './playbooks';
import type { DialerVariables } from '../middleware/auth';
import type { TranscriptSegment } from '../call-operations/contracts';
const suite =
  process.env.CONSUELO_RUN_COACHING_POSTGRES === '1' ? describe : describe.skip;
const run = async (args: string[]) => {
  const p = Bun.spawn(args, {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
  });
  const [out, err, exit] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
    p.exited,
  ]);
  if (exit) throw new Error(err || out);
  return out.trim();
};
const port = () =>
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
suite('published playbooks and actual durable cue composition', () => {
  test('author race, immutable call pin, actual outbox normalization and authorized delivery', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mercury-playbooks-'));
    let pool: Pool | undefined,
      pgCtl: string | undefined,
      started = false;
    let runtime: ReturnType<typeof createCoachingRuntime> | undefined;
    try {
      const pgConfig = Bun.which('pg_config');
      if (!pgConfig) throw new Error('pg_config required');
      const bin = await run([pgConfig, '--bindir']);
      pgCtl = join(bin, 'pg_ctl');
      const data = join(root, 'data'),
        pgPort = await port();
      await run([
        join(bin, 'initdb'),
        '-D',
        data,
        '--auth=trust',
        '--username=postgres',
        '--no-locale',
      ]);
      await run([
        pgCtl,
        '-D',
        data,
        '-l',
        join(root, 'postgres.log'),
        '-o',
        '-h 127.0.0.1 -p ' + pgPort + ' -F',
        '-w',
        'start',
      ]);
      started = true;
      pool = new Pool({
        host: '127.0.0.1',
        port: pgPort,
        user: 'postgres',
        database: 'postgres',
        max: 6,
      });
      await pool.query(CREATE_COACHING_SCRIPTS_SQL);
      await pool.query(CREATE_PLAYBOOK_PUBLICATIONS_SQL);
      await initializeCallOperationsPersistence(pool);
      await pool.query(TRANSCRIPT_TIMING_SCHEMA_SQL);
      const repository = createPostgresCallOperationsRepository(pool);
      const scriptId = randomUUID(),
        scopeKey = 'outbound:provider-group',
        identity = { workspaceId: 'one', userId: 'alice' };
      let live = false,
        revoked = false,
        alignment = true;
      runtime = createCoachingRuntime(pool, {
        resolveSessionId: async (i, g) =>
          i.workspaceId === 'one' &&
          i.userId === 'alice' &&
          g === 'provider-group'
            ? 'call'
            : null,
        liveAuthority: async (i, { scope }) =>
          !live
            ? null
            : {
                scope,
                active: true,
                audioOffsetMs: alignment ? 0 : null,
                participants: [
                  {
                    participantId: 'customer',
                    legId: 'CAfixture',
                    role: 'customer',
                    provenance: 'authenticated-leg',
                    bindingRevision: 1,
                  },
                ],
                policy: {
                  scope,
                  memberId: i.userId,
                  revision: revoked ? 2 : 1,
                  validUntilMs: Date.now() + 10000,
                  revoked: false,
                  capabilities: revoked
                    ? ['manual-reference']
                    : [
                        'manual-reference',
                        'live-transcription',
                        'live-coaching',
                      ],
                  consent: {
                    ephemeralTranscription: !revoked,
                    retainedTranscript: false,
                    aiGeneration: false,
                  },
                },
              },
      });
      const app = new Hono<{ Variables: DialerVariables }>();
      app.use('*', async (c, next) => {
        c.set('identity', {
          workspaceId: c.req.header('x-foreign') ? 'foreign' : 'one',
          userId: c.req.header('x-other') ? 'bob' : 'alice',
        });
        await next();
      });
      app.route('/', createCoachingRoutes(runtime));
      const request = (
        path: string,
        body?: unknown,
        headers: Record<string, string> = {},
      ) =>
        app.request(path, {
          method: body === undefined ? 'GET' : 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
      const saved = await app.request('/v1/coaching/scripts/' + scriptId, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Synthetic examples',
          content: SYNTHETIC_LIFE_INSURANCE.content,
          expectedRevision: 0,
          workspaceId: 'foreign',
        }),
      });
      expect(saved.status).toBe(200);
      expect((await saved.json()).canPublish).toBe(true);
      const publication = {
        expectedRevision: 1,
        expectedPublishedVersion: 0,
        approved: true,
      };
      const preview = await request(
        '/v1/coaching/scripts/' + scriptId + '/preview',
        { expectedRevision: 1 },
      );
      expect(preview.status).toBe(200);
      const previewBody = await preview.json();
      expect(previewBody.preview.playbook.cards).toHaveLength(6);
      expect(previewBody.expectedPublishedVersion).toBe(0);
      expect(
        (
          await request('/v1/coaching/scripts/' + scriptId + '/publish', {
            expectedRevision: 1,
            approved: true,
          })
        ).status,
      ).toBe(400);
      const race = await Promise.all([
        request('/v1/coaching/scripts/' + scriptId + '/publish', publication),
        request('/v1/coaching/scripts/' + scriptId + '/publish', publication),
      ]);
      expect(race.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        (
          await request(
            '/v1/coaching/scripts/' + scriptId + '/publish',
            publication,
            { 'x-other': 'true' },
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(
            '/v1/coaching/scripts/' + scriptId + '/versions',
            undefined,
            { 'x-foreign': 'true' },
          )
        ).status,
      ).toBe(403);
      await Effect.runPromise(
        repository.createOrUpdateCallSession({
          id: 'call',
          workspaceId: 'one',
          userId: 'alice',
          source: 'direct',
          selectionStrategy: 'single',
          requestedFanout: 1,
          actualFanout: 1,
          transcriptionEnabled: true,
          startedAt: new Date().toISOString(),
          status: 'connected',
          calls: [
            { providerCallId: 'CAfixture', position: 0, status: 'in-progress' },
          ],
        }),
      );
      const opened = await request('/v1/coaching/sessions', {
        scopeKey,
        scriptId,
        version: 1,
      });
      expect(opened.status).toBe(200);
      const manual = await opened.json();
      let projectionToken = manual.projectionToken;
      expect(manual.view.status).toBe('manual');
      expect(manual.publishedVersion).toBe(scriptId + ':1');
      const control = async (action: string) =>
        request(
          '/v1/coaching/sessions/' + encodeURIComponent(scopeKey) + '/control',
          { action, projectionToken },
        );
      expect((await control('pin')).status).toBe(200);
      expect((await control('off')).status).toBe(200);
      const generationBefore = (
        await pool.query(
          'SELECT worker_generation FROM dialer_coaching_script_pins',
        )
      ).rows[0].worker_generation;
      const source: TranscriptSegment = {
        id: 'segment-1',
        workspaceId: 'one',
        sessionId: 'call',
        providerCallId: 'CAfixture',
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
        model: 'frozen-fixture',
        createdAt: new Date().toISOString(),
        metadata: {
          schemaVersion: 1,
          sourceAudioStartMs: 0,
          sourceAudioEndMs: 1000,
          streamSid: 'MZfixture',
          timingBasis: 'provider-words',
          speakerProvenance: 'authenticated-leg',
          words: [{ text: 'coverage', startMs: 600, endMs: 900 }],
          speechSegments: [],
        },
      };
      await Effect.runPromise(repository.appendTranscriptSegment(source));
      live = true;
      const reopened = await request('/v1/coaching/sessions', {
        scopeKey,
        scriptId,
        version: 1,
      });
      expect(reopened.status).toBe(200);
      const liveView = await reopened.json();
      projectionToken = liveView.projectionToken;
      expect(liveView.view).toMatchObject({
        kind: 'approved',
        status: 'live',
        heading: 'Existing coverage',
      });
      expect(liveView.view.points[0].text).toBe('Ask about existing coverage');
      expect(
        (
          await pool.query(
            'SELECT worker_generation FROM dialer_coaching_script_pins',
          )
        ).rows[0].worker_generation,
      ).toBeGreaterThan(generationBefore);
      expect(
        (await pool.query('SELECT delivered_at FROM dialer_transcript_outbox'))
          .rows[0].delivered_at,
      ).not.toBeNull();
      const unchanged = await request(
        '/v1/coaching/sessions/' +
          encodeURIComponent(scopeKey) +
          '/cue?afterRevision=' +
          liveView.view.revision,
      );
      expect((await unchanged.json()).view).toBeNull();
      expect(
        (
          await request(
            '/v1/coaching/sessions/' + encodeURIComponent(scopeKey) + '/cue',
            undefined,
            { 'x-other': 'true' },
          )
        ).status,
      ).toBe(403);
      await runtime.save(identity, {
        id: scriptId,
        title: 'Edited title',
        content: SYNTHETIC_LIFE_INSURANCE.content.replace(
          'Ask about existing coverage',
          'Ask about current coverage',
        ),
        expectedRevision: 1,
      });
      const historyPreview = await request(
        '/v1/coaching/scripts/' + scriptId + '/preview',
        { expectedRevision: 2 },
      );
      expect(historyPreview.status).toBe(200);
      const reviewed = await historyPreview.json();
      expect(reviewed.expectedPublishedVersion).toBe(1);
      expect(reviewed.preview.version).toBe(2);
      expect(
        (
          await request('/v1/coaching/scripts/' + scriptId + '/publish', {
            expectedRevision: 2,
            expectedPublishedVersion: reviewed.expectedPublishedVersion,
            approved: true,
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await (
            await request(
              '/v1/coaching/sessions/' + encodeURIComponent(scopeKey) + '/cue',
            )
          ).json()
        ).publishedVersion,
      ).toBe(scriptId + ':1');
      const oldToken = projectionToken;
      await control('off');
      const readmitted = await request('/v1/coaching/sessions', {
        scopeKey,
        scriptId,
      });
      const pinnedAgain = await readmitted.json();
      projectionToken = pinnedAgain.projectionToken;
      expect(pinnedAgain.publishedVersion).toBe(scriptId + ':1');
      expect(projectionToken).not.toBe(oldToken);
      expect(
        (
          await request(
            '/v1/coaching/sessions/' +
              encodeURIComponent(scopeKey) +
              '/control',
            { action: 'off', projectionToken: oldToken },
          )
        ).status,
      ).toBe(409);
      revoked = true;
      const revokedView = await request(
        '/v1/coaching/sessions/' + encodeURIComponent(scopeKey) + '/cue',
      );
      expect((await revokedView.json()).view.status).toBe('manual');
      await runtime.mercury.playbooks.archive(identity, scriptId, 2);
      await expect(
        runtime.mercury.playbooks.pin(identity, {
          scopeKey: 'outbound:another',
          callSessionId: 'call',
          callGeneration: 1,
          scriptId,
          version: 1,
        }),
      ).rejects.toThrow();
      expect(await runtime.list(identity)).toEqual([]);
      await pool.query(
        "UPDATE dialer_call_sessions SET ended_at=now(),status='completed'",
      );
      expect((await control('next')).status).toBe(403);
    } finally {
      runtime?.mercury.cues.dispose();
      await pool?.end();
      if (started && pgCtl)
        await run([
          pgCtl,
          '-D',
          join(root, 'data'),
          '-m',
          'fast',
          '-w',
          'stop',
        ]);
      await rm(root, { recursive: true, force: true });
    }
  }, 30000);
});
