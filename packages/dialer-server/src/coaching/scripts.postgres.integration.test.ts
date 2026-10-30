import { describe, it, expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import {
  createCoachingScripts,
  CREATE_COACHING_SCRIPTS_SQL,
  ScriptConflictError,
} from './scripts';
const suite =
  process.env.CONSUELO_RUN_COACHING_POSTGRES === '1' ? describe : describe.skip;
const run = async (args: string[]): Promise<string> => {
  const processHandle = Bun.spawn(args, {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
    processHandle.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(
      `Command ${args[0]} failed (${exitCode}): ${stderr || stdout}`,
    );
  }
  return stdout.trim();
};

const reservePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('No loopback port allocated'));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });

suite('durable workspace scripts with isolated PostgreSQL', () => {
  it('persists across service recreation, fences edits and isolates tenants and authors', async () => {
    const root = await mkdtemp(join(tmpdir(), 'consuelo-coaching-'));
    let pgCtl: string | undefined,
      started = false,
      pool: Pool | undefined;
    try {
      const pgConfig = Bun.which('pg_config');
      if (!pgConfig) throw new Error('pg_config required');
      const bin = await run([pgConfig, '--bindir']);
      pgCtl = join(bin, 'pg_ctl');
      const data = join(root, 'postgres'),
        port = await reservePort();
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
        '-h 127.0.0.1 -p ' + port + ' -F',
        '-w',
        'start',
      ]);
      started = true;
      pool = new Pool({
        host: '127.0.0.1',
        port,
        user: 'postgres',
        database: 'postgres',
        max: 4,
      });
      await pool.query(CREATE_COACHING_SCRIPTS_SQL);
      const service = createCoachingScripts(pool),
        owner = { workspaceId: 'one', userId: 'alice' },
        other = { workspaceId: 'one', userId: 'bob' },
        foreign = { workspaceId: 'two', userId: 'alice' };
      const draft = {
        id: randomUUID(),
        title: 'Opening',
        content: 'Hello\nA question',
        expectedRevision: 0,
      };
      const saved = await service.save(owner, draft);
      expect(saved.revision).toBe(1);
      expect(saved.canEdit).toBe(true);
      expect(await createCoachingScripts(pool).list(owner)).toHaveLength(1);
      expect((await service.list(other))[0]?.canEdit).toBe(false);
      expect(await service.list(foreign)).toEqual([]);
      await expect(
        service.save(other, { ...draft, expectedRevision: 1 }),
      ).rejects.toBeInstanceOf(ScriptConflictError);
      await expect(
        service.save(foreign, { ...draft, expectedRevision: 1 }),
      ).rejects.toBeInstanceOf(ScriptConflictError);
      const raced = await Promise.allSettled(
        ['A', 'B'].map((title) =>
          service.save(owner, { ...draft, title, expectedRevision: 1 }),
        ),
      );
      expect(raced.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(raced.filter((r) => r.status === 'rejected')).toHaveLength(1);
      const updated = await service.save(
        { ...other, role: 'admin' },
        { ...draft, expectedRevision: 2, title: 'Team script' },
      );
      expect(updated.revision).toBe(3);
      expect((await service.list(owner))[0]?.title).toBe('Team script');
      expect(JSON.stringify(await service.list(owner))).not.toContain(
        'created_by',
      );
      await expect(service.save(owner, draft)).rejects.toBeInstanceOf(
        ScriptConflictError,
      );
      expect(await service.list(foreign)).toEqual([]);
    } finally {
      await pool?.end();
      if (started && pgCtl)
        await run([
          pgCtl,
          '-D',
          join(root, 'postgres'),
          '-m',
          'fast',
          '-w',
          'stop',
        ]);
      await rm(root, { recursive: true, force: true });
    }
  }, 30000);
});
