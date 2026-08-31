#!/usr/bin/env bun

import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { createConnection, createServer } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import Redis from 'ioredis';
import { Pool } from 'pg';

import { migrateDialerDatabase } from '../src/database/migrations';
import {
  createSyntheticDialerFixture,
  resolveLabScale,
  runLocalDialerBenchmarks,
  type LabScaleName,
} from '../src/lab/local-dialer-lab';

const LAB_WORKSPACE_ID = 'consuelo-local-dialer-lab';
const DEFAULT_SEED = 20_260_814;
const DEFAULT_BASE_TIME = new Date('2026-08-14T16:00:00.000Z');

const scriptFailure = (operation: string, cause: unknown) =>
  new Error(`Local dialer lab ${operation} failed`, { cause });

const parseScale = (): LabScaleName => {
  const index = process.argv.indexOf('--scale');
  const value = index >= 0 ? process.argv[index + 1] : 'smoke';
  if (value === 'smoke' || value === 'standard' || value === 'large') {
    return value;
  }
  throw new Error(`Unsupported --scale ${value ?? '<missing>'}; expected smoke, standard, or large`);
};

const parseSeed = () => {
  const index = process.argv.indexOf('--seed');
  if (index < 0) return DEFAULT_SEED;
  const value = Number(process.argv[index + 1]);
  if (!Number.isSafeInteger(value)) {
    throw new Error('--seed must be a safe integer');
  }
  return value;
};

const runCommand = async (command: string[], label: string) => {
  try {
    const processHandle = Bun.spawn(command, {
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
        `${label} failed (${exitCode}): ${(stderr || stdout).trim()}`,
      );
    }
    return stdout.trim();
  } catch (cause: unknown) {
    throw scriptFailure(`command ${label}`, cause);
  }
};

const resolvePostgresBinary = async (name: 'initdb' | 'pg_ctl') => {
  try {
    const direct = Bun.which(name);
    if (direct) return direct;
    const pgConfig = Bun.which('pg_config');
    if (!pgConfig) {
      throw new Error(
        `Missing ${name}; install PostgreSQL 16+ and ensure pg_config is on PATH`,
      );
    }
    const bindir = await runCommand(
      [pgConfig, '--bindir'],
      'pg_config --bindir',
    );
    return join(bindir, name);
  } catch (cause: unknown) {
    throw scriptFailure(`PostgreSQL binary lookup for ${name}`, cause);
  }
};

const allocatePort = async (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to allocate an isolated local TCP port'));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });

const canConnect = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = (result: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(150);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });

const waitForPort = async (port: number, expectedOpen: boolean) => {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if ((await canConnect(port)) === expectedOpen) return;
    await Bun.sleep(50);
  }
  throw new Error(
    `Timed out waiting for port ${port} to become ${expectedOpen ? 'ready' : 'closed'}`,
  );
};

const startPostgres = async (root: string, port: number) => {
  const initdb = await resolvePostgresBinary('initdb');
  const pgCtl = await resolvePostgresBinary('pg_ctl');
  const dataDirectory = join(root, 'postgres');
  const logPath = join(root, 'postgres.log');
  await mkdir(dataDirectory, { recursive: true });
  await runCommand(
    [
      initdb,
      '-D',
      dataDirectory,
      '--auth=trust',
      '--username=postgres',
      '--no-locale',
    ],
    'initdb',
  );
  try {
    await runCommand(
      [
        pgCtl,
        '-D',
        dataDirectory,
        '-l',
        logPath,
        '-o',
        `-h 127.0.0.1 -p ${port} -F -c synchronous_commit=off`,
        '-w',
        'start',
      ],
      'pg_ctl start',
    );
  } catch (cause: unknown) {
    const log = await readFile(logPath, 'utf8').catch(() => '');
    throw new Error(`Failed to start isolated PostgreSQL: ${log.trim()}`, {
      cause,
    });
  }
  await waitForPort(port, true);
  return {
    stop: async () => {
      try {
        await runCommand(
          [pgCtl, '-D', dataDirectory, '-m', 'fast', '-w', 'stop'],
          'pg_ctl stop',
        );
        await waitForPort(port, false);
      } catch (cause: unknown) {
        throw new Error(`Failed to stop isolated PostgreSQL on port ${port}`, {
          cause,
        });
      }
    },
  };
};

const startRedis = async (root: string, port: number) => {
  const redisServer = Bun.which('redis-server');
  if (!redisServer) {
    throw new Error('Missing redis-server; install Redis and ensure it is on PATH');
  }
  const directory = join(root, 'redis');
  const logPath = join(root, 'redis.log');
  await mkdir(directory, { recursive: true });
  const processHandle = Bun.spawn(
    [
      redisServer,
      '--bind',
      '127.0.0.1',
      '--port',
      String(port),
      '--protected-mode',
      'yes',
      '--save',
      '',
      '--appendonly',
      'no',
      '--dir',
      directory,
      '--logfile',
      logPath,
    ],
    { stdout: 'ignore', stderr: 'ignore' },
  );
  try {
    await waitForPort(port, true);
    if (processHandle.exitCode !== null) {
      throw new Error(`redis-server exited with code ${processHandle.exitCode}`);
    }
  } catch (cause: unknown) {
    const log = await readFile(logPath, 'utf8').catch(() => '');
    if (processHandle.exitCode === null) {
      processHandle.kill('SIGTERM');
      await processHandle.exited.catch(() => undefined);
    }
    throw new Error(`Failed to start isolated Redis: ${log.trim()}`, { cause });
  }
  return {
    stop: async () => {
      if (processHandle.exitCode === null) {
        processHandle.kill('SIGTERM');
        await processHandle.exited;
      }
      await waitForPort(port, false);
    },
  };
};

const resolveVersions = async () => {
  try {
    const pgConfig = Bun.which('pg_config');
    const redisServer = Bun.which('redis-server');
    return {
      bun: Bun.version,
      postgres: pgConfig
        ? await runCommand([pgConfig, '--version'], 'pg_config --version')
        : 'unknown',
      redis: redisServer
        ? await runCommand([redisServer, '--version'], 'redis-server --version')
        : 'unknown',
    };
  } catch (cause: unknown) {
    throw scriptFailure('version inspection', cause);
  }
};

const main = async () => {
  const scaleName = parseScale();
  const seed = parseSeed();
  const scale = resolveLabScale(scaleName);
  const fixture = createSyntheticDialerFixture({
    seed,
    contactCount: scale.contactCount,
    attemptsPerContact: scale.attemptsPerContact,
    baseTime: DEFAULT_BASE_TIME,
  });
  const root = await mkdtemp(join(tmpdir(), 'consuelo-dialer-lab-'));
  const postgresPort = await allocatePort();
  let redisPort = await allocatePort();
  while (redisPort === postgresPort) {
    redisPort = await allocatePort();
  }
  const databaseUrl = `postgresql://postgres@127.0.0.1:${postgresPort}/postgres`;
  const redisUrl = `redis://127.0.0.1:${redisPort}`;
  let postgres: Awaited<ReturnType<typeof startPostgres>> | undefined;
  let redisServer: Awaited<ReturnType<typeof startRedis>> | undefined;
  let pool: Pool | undefined;
  let redis: Redis | undefined;
  let result: Record<string, unknown> | undefined;
  let cleanupError: unknown;

  try {
    postgres = await startPostgres(root, postgresPort);
    redisServer = await startRedis(root, redisPort);
    pool = new Pool({ connectionString: databaseUrl, max: 10 });
    redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    redis.on('error', () => undefined);
    await redis.connect();
    await redis.ping();
    const database = {
      query: <TRow>(text: string, values?: readonly unknown[]) =>
        pool!.query<TRow>(text, values as unknown[] | undefined),
    };
    const redisClient = {
      get: (key: string) => redis!.get(key),
      set: (key: string, value: string, ...args: unknown[]) =>
        redis!.set(key, value, ...(args as [string, ...Array<string | number>])),
      del: (...keys: string[]) => redis!.del(...keys),
      eval: (script: string, numberOfKeys: number, ...args: unknown[]) =>
        redis!.eval(script, numberOfKeys, ...args).then(Number),
    };

    const migrationStartedAt = performance.now();
    await migrateDialerDatabase(database);
    const migrationMs = Math.round((performance.now() - migrationStartedAt) * 1_000) / 1_000;
    const benchmarks = await runLocalDialerBenchmarks({
      database,
      redis: redisClient,
      workspaceId: LAB_WORKSPACE_ID,
      fixture,
      scale,
    });
    const migrationRows = await database.query<{ migration_id: string }>(
      'SELECT migration_id FROM consuelo_dialer_schema_migrations ORDER BY migration_id',
    );
    const fixtureCounts = await database.query<{
      ledger_count: string;
      outcome_count: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM contact_attempt_ledger WHERE workspace_id = $1)::text AS ledger_count,
         (SELECT COUNT(*) FROM consuelo_lead_connector_call_outcomes WHERE workspace_id = $1)::text AS outcome_count`,
      [LAB_WORKSPACE_ID],
    );

    result = {
      ok: true,
      scale: scaleName,
      versions: await resolveVersions(),
      isolation: {
        postgresPort,
        redisPort,
        productionCredentialsUsed: false,
        externalProvidersUsed: false,
      },
      migration: {
        durationMs: migrationMs,
        applied: migrationRows.rows.map((row) => row.migration_id),
      },
      persistedFixture: {
        candidateLedgerRows: Number(fixtureCounts.rows[0]?.ledger_count ?? 0),
        trainingOutcomeRows: Number(fixtureCounts.rows[0]?.outcome_count ?? 0),
      },
      benchmarks,
    };
  } finally {
    redis?.disconnect();
    await pool?.end().catch(() => undefined);
    try {
      await redisServer?.stop();
      await postgres?.stop();
    } catch (cause: unknown) {
      cleanupError = cause;
    }
    const postgresClosed = !(await canConnect(postgresPort));
    const redisClosed = !(await canConnect(redisPort));
    await rm(root, { recursive: true, force: true });
    if (result) {
      result.cleanup = {
        postgresClosed,
        redisClosed,
        tempDirectoryRemoved: true,
      };
    }
  }

  if (cleanupError) {
    throw new Error('Local dialer lab cleanup failed', { cause: cleanupError });
  }
  if (!result) {
    throw new Error('Local dialer lab did not produce a result');
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

main().catch((cause: unknown) => {
  process.stderr.write(
    `[dialer-lab] ${cause instanceof Error ? cause.stack ?? cause.message : String(cause)}\n`,
  );
  process.exitCode = 1;
});
