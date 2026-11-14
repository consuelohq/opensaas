// Opt-in, loopback-only component fixture; do not use against real accounts or calls.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { Pool } from 'pg';
import { CREATE_COACHING_SCRIPTS_SQL } from '../coaching/scripts';
import { CREATE_PLAYBOOK_PUBLICATIONS_SQL } from '../coaching/playbook-store';
import { SYNTHETIC_LIFE_INSURANCE } from '../coaching/playbooks';
import { createCoachingRuntime } from '../runtime/coaching';
import { createCoachingRoutes } from '../routes/coaching';
import type { DialerVariables } from '../middleware/auth';

if (process.env.CONSUELO_RUN_COACHING_BROWSER_FIXTURE !== '1')
  throw new Error('Set CONSUELO_RUN_COACHING_BROWSER_FIXTURE=1');
const directory = await mkdtemp(join(tmpdir(), 'coaching-browser-fixture-'));
let pool: Pool | undefined,
  pgCtl = '',
  started = false;
const run = async (args: string[]) => {
  const p = Bun.spawn(args, {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
  });
  const [out, err, code] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
    p.exited,
  ]);
  if (code) throw new Error(err || out);
  return out.trim();
};
let runtime: ReturnType<typeof createCoachingRuntime> | undefined;
try {
  const pgConfig = Bun.which('pg_config');
  if (!pgConfig) throw new Error('pg_config required');
  const bin = await run([pgConfig, '--bindir']);
  pgCtl = join(bin, 'pg_ctl');
  // Obtain a local ephemeral port and release it before PostgreSQL binds.
  const socket = Bun.listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: { data() {} },
  });
  const pgPort = socket.port;
  socket.stop();
  const data = join(directory, 'data');
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
    join(directory, 'postgres.log'),
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
    max: 4,
  });
  await pool.query(CREATE_COACHING_SCRIPTS_SQL);
  await pool.query(CREATE_PLAYBOOK_PUBLICATIONS_SQL);
  runtime = createCoachingRuntime(pool);
  await runtime.save(
    { workspaceId: 'fixture', userId: 'rep' },
    {
      id: crypto.randomUUID(),
      title: 'Synthetic examples',
      content: SYNTHETIC_LIFE_INSURANCE.content,
      expectedRevision: 0,
    },
  );
  const build = await Bun.build({
    entrypoints: [join(import.meta.dir, 'browser-fixture-entry.ts')],
    target: 'browser',
  });
  if (!build.success)
    throw new Error('Browser fixture bundle failed: ' + build.logs.join(', '));
  const bundle = await build.outputs[0]!.text();
  const app = new Hono<{ Variables: DialerVariables }>();
  app.use('/v1/*', async (c, next) => {
    if (c.req.header('authorization') !== 'Bearer fixture-rep')
      return c.json({ error: 'unauthorized' }, 401);
    c.set('identity', { workspaceId: 'fixture', userId: 'rep' });
    try {
      await next();
    } catch (error: unknown) {
      throw error;
    }
  });
  app.route('/', createCoachingRoutes(runtime));
  app.get('/bundle.js', (c) =>
    c.body(bundle, 200, { 'Content-Type': 'application/javascript' }),
  );
  app.get('/styles.css', async (c) => {
    try {
      return c.body(
        await Bun.file(
          join(import.meta.dir, '../../../lead-connector/src/embed/styles.css'),
        ).text(),
        200,
        { 'Content-Type': 'text/css' },
      );
    } catch (error: unknown) {
      throw error;
    }
  });
  app.get('/theme.css', async (c) => {
    try {
      return c.body(
        await Bun.file(
          join(
            import.meta.dir,
            '../../../lead-connector/src/embed/workspace-theme.css',
          ),
        ).text(),
        200,
        { 'Content-Type': 'text/css' },
      );
    } catch (error: unknown) {
      throw error;
    }
  });
  app.get('/', (c) =>
    c.html(
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/theme.css"></head><body><main id="fixture"></main><script type="module" src="/bundle.js"></script></body></html>',
    ),
  );
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: app.fetch,
  });
  process.stdout.write('FIXTURE_URL=http://127.0.0.1:' + server.port + '\n');
  await new Promise<void>((resolve) => {
    process.once('SIGTERM', resolve);
    process.once('SIGINT', resolve);
  });
  server.stop(true);
} finally {
  runtime?.mercury.cues.dispose();
  await pool?.end();
  if (started)
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
