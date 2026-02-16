import { spawn, type ChildProcess } from 'node:child_process';
import { execSync } from 'node:child_process';
import type { Command } from 'commander';
import { log, error } from '../output.js';
import { captureError } from '../sentry.js';

type ServiceName = 'postgres' | 'api' | 'twenty' | 'worker';

interface DevOptions {
  port: string;
  services?: string;
  skipDb: boolean;
  open: boolean;
}

const SERVICE_COLORS: Record<ServiceName, string> = {
  postgres: '\x1b[36m',
  api: '\x1b[33m',
  twenty: '\x1b[35m',
  worker: '\x1b[32m',
};

const RESET = '\x1b[0m';

const children: ChildProcess[] = [];

const prefix = (name: ServiceName, line: string): string =>
  `${SERVICE_COLORS[name]}[${name}]${RESET} ${line}`;

const spawnService = (name: ServiceName, cmd: string, args: string[], env?: Record<string, string>): ChildProcess => {
  const child = spawn(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  });

  child.stdout?.on('data', (data: Buffer) => {
    for (const line of data.toString().split('\n').filter(Boolean)) {
      log(prefix(name, line));
    }
  });

  child.stderr?.on('data', (data: Buffer) => {
    for (const line of data.toString().split('\n').filter(Boolean)) {
      log(prefix(name, line));
    }
  });

  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      log(prefix(name, `exited with code ${code}`));
    }
  });

  children.push(child);
  return child;
};

const isDockerPostgresRunning = (): boolean => {
  try {
    const out = execSync('docker inspect -f "{{.State.Running}}" consuelo-postgres 2>/dev/null', { encoding: 'utf-8' }).trim();
    return out === 'true';
  } catch (_err: unknown) {
    return false;
  }
};

const shutdown = (): void => {
  log('\nshutting down...');
  for (const child of children) {
    child.kill('SIGTERM');
  }
  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) child.kill('SIGKILL');
    }
    process.exit(0);
  }, 5000);
};

const dev = async (options: DevOptions): Promise<void> => {
  const requested = options.services
    ? (options.services.split(',').map(s => s.trim()) as ServiceName[])
    : (['postgres', 'api', 'twenty', 'worker'] as ServiceName[]);

  const port = options.port;

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // postgres
  if (requested.includes('postgres') && !options.skipDb) {
    if (isDockerPostgresRunning()) {
      log(prefix('postgres', 'already running'));
    } else {
      log(prefix('postgres', 'starting via docker...'));
      try {
        const { provisionDockerPostgres } = await import('../provisioning/database.js');
        const connStr = await provisionDockerPostgres();
        log(prefix('postgres', `ready — ${connStr}`));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        error(prefix('postgres', `failed: ${msg}`));
      }
    }
  }

  // api server
  if (requested.includes('api')) {
    log(prefix('api', `starting on port ${port}...`));
    spawnService('api', 'npx', ['tsx', 'watch', 'packages/api/src/index.ts'], { PORT: port });
  }

  // twenty frontend
  if (requested.includes('twenty')) {
    log(prefix('twenty', 'starting frontend...'));
    spawnService('twenty', 'npx', ['nx', 'start', 'twenty-front']);
  }

  // worker
  if (requested.includes('worker')) {
    log(prefix('worker', 'starting background worker...'));
    spawnService('worker', 'npx', ['nx', 'run', 'twenty-server:worker']);
  }

  if (options.open) {
    setTimeout(() => {
      try {
        execSync(`open http://localhost:3001`, { stdio: 'ignore' });
      } catch (_err: unknown) {
        // non-critical
      }
    }, 3000);
  }

  // keep alive
  await new Promise(() => {});
};

export const registerDev = (program: Command): void => {
  program
    .command('dev')
    .description('start local development environment')
    .option('--port <port>', 'API server port', '9000')
    .option('--services <list>', 'comma-separated services (postgres,api,twenty,worker)')
    .option('--skip-db', 'skip database setup', false)
    .option('--open', 'open browser on start', false)
    .action(async (opts: DevOptions) => {
      try {
        await dev(opts);
      } catch (err: unknown) {
        captureError(err, { command: 'dev' });
        const message = err instanceof Error ? err.message : 'dev failed';
        error(message);
        process.exit(1);
      }
    });
};
