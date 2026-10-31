import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { Pool } from 'pg';
import { Effect } from 'effect';
import {
  initializeCommercialPersistence,
  type CommercialSqlClient,
} from '../commercial/persistence';
import { normalizeAsyncError } from '../errors/normalize-async-error';
const run = async (args: string[]) => {
  try {
    const process = Bun.spawn(args, {
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...Bun.env, LC_ALL: 'C', LANG: 'C' },
    });
    const [stdout, stderr, exit] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ]);
    if (exit) throw new Error(args[0] + ': ' + stderr);
    return stdout.trim();
  } catch (cause: unknown) {
    throw normalizeAsyncError(cause);
  }
};
export const withDisposableCommercialPostgres = async (
  operation: (database: CommercialSqlClient) => Promise<void>,
) => {
  try {
    const root = await mkdtemp(join(tmpdir(), 'consuelo-native-billing-'));
    let pool: Pool | undefined,
      pgCtl: string | undefined,
      started = false;
    try {
      const pgConfig = Bun.which('pg_config');
      if (!pgConfig)
        throw new Error(
          'Local PostgreSQL is required; never use a customer DATABASE_URL',
        );
      const bin = await run([pgConfig, '--bindir']);
      pgCtl = join(bin, 'pg_ctl');
      const port = await new Promise<number>((resolve, reject) => {
        const server = createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
          const address = server.address();
          if (!address || typeof address === 'string') {
            server.close();
            reject(new Error('No loopback port'));
            return;
          }
          server.close((error) =>
            error ? reject(error) : resolve(address.port),
          );
        });
      });
      await run([
        join(bin, 'initdb'),
        '-D',
        join(root, 'postgres'),
        '--auth=trust',
        '--username=postgres',
        '--no-locale',
      ]);
      await run([
        pgCtl,
        '-D',
        join(root, 'postgres'),
        '-l',
        join(root, 'postgres.log'),
        '-o',
        `-h 127.0.0.1 -p ${port} -F -c unix_socket_directories=''`,
        '-w',
        'start',
      ]);
      started = true;
      pool = new Pool({
        host: '127.0.0.1',
        port,
        user: 'postgres',
        database: 'postgres',
        max: 8,
      });
      const database: CommercialSqlClient = {
        query: async (sql, parameters) => {
          try {
            const result = await pool!.query(sql, parameters as unknown[]);
            return {
              rows: result.rows,
              rowCount: result.rowCount ?? undefined,
            };
          } catch (cause: unknown) {
            throw normalizeAsyncError(cause);
          }
        },
      };
      await Effect.runPromise(initializeCommercialPersistence(database));
      await operation(database);
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    } finally {
      await pool?.end();
      if (started && pgCtl)
        await run([
          pgCtl,
          '-D',
          join(root, 'postgres'),
          '-m',
          'immediate',
          '-w',
          'stop',
        ]);
      await rm(root, { recursive: true, force: true });
    }
  } catch (cause: unknown) {
    throw normalizeAsyncError(cause);
  }
};
