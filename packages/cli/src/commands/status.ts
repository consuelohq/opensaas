import * as os from 'node:os';
import { execSync } from 'node:child_process';
import type { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, loadFullConfig, validateConfig } from '../config.js';
import { log, json, isJson } from '../output.js';
import { captureError } from '../sentry.js';
import { printBanner, info } from '../utils/ui.js';

type ServiceName = 'api' | 'twenty' | 'database' | 'twilio' | 'ai';
type ServiceStatus = 'healthy' | 'unhealthy' | 'unconfigured';

interface CheckResult {
  service: ServiceName;
  status: ServiceStatus;
  latency?: number;
  message?: string;
}

interface StatusOpts {
  service?: string;
  watch?: boolean;
  interval?: string;
}

const SERVICES: ServiceName[] = ['api', 'twenty', 'database', 'twilio', 'ai'];

const checkService = async (name: ServiceName, config: ReturnType<typeof loadConfig>, full: ReturnType<typeof loadFullConfig>): Promise<CheckResult> => {
  const start = Date.now();
  try {
    switch (name) {
      case 'api': {
        const url = config.apiUrl ?? 'http://localhost:3000';
        const res = await fetch(url + '/healthz', { signal: AbortSignal.timeout(3000) });
        return { service: name, status: res.ok ? 'healthy' : 'unhealthy', latency: Date.now() - start };
      }
      case 'twenty': {
        const url = full.twenty?.serverUrl ?? 'http://localhost:3000';
        const res = await fetch(url + '/healthz', { signal: AbortSignal.timeout(3000) });
        return { service: name, status: res.ok ? 'healthy' : 'unhealthy', latency: Date.now() - start };
      }
      case 'database': {
        const dbUrl = full.database?.url ?? process.env['DATABASE_URL'];
        if (!dbUrl) return { service: name, status: 'unconfigured', message: 'no database url' };
        const pg = await import('pg');
        const client = new pg.Client({ connectionString: dbUrl });
        await client.connect();
        await client.query('SELECT 1');
        await client.end();
        return { service: name, status: 'healthy', latency: Date.now() - start };
      }
      case 'twilio': {
        if (!config.twilioAccountSid || !config.twilioAuthToken) {
          return { service: name, status: 'unconfigured', message: 'twilio credentials not set' };
        }
        const auth = Buffer.from(config.twilioAccountSid + ':' + config.twilioAuthToken).toString('base64');
        const res = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + config.twilioAccountSid + '.json', {
          headers: { Authorization: 'Basic ' + auth },
          signal: AbortSignal.timeout(5000),
        });
        return { service: name, status: res.ok ? 'healthy' : 'unhealthy', latency: Date.now() - start, message: res.ok ? undefined : 'invalid credentials' };
      }
      case 'ai': {
        const key = full.ai?.apiKey ?? config.llmApiKey;
        if (!key) return { service: name, status: 'unconfigured', message: 'ai api key not set' };
        const provider = full.ai?.provider ?? config.llmProvider ?? 'groq';
        const url = provider === 'openai' ? 'https://api.openai.com/v1/models' : 'https://api.groq.com/openai/v1/models';
        const res = await fetch(url, {
          headers: { Authorization: 'Bearer ' + key },
          signal: AbortSignal.timeout(5000),
        });
        return { service: name, status: res.ok ? 'healthy' : 'unhealthy', latency: Date.now() - start, message: res.ok ? undefined : 'invalid api key' };
      }
    }
  } catch (err: unknown) {
    return { service: name, status: 'unhealthy', latency: Date.now() - start, message: err instanceof Error ? err.message : 'unknown error' };
  }
};

const statusIcon = (s: ServiceStatus): string =>
  s === 'healthy' ? chalk.green('●') : s === 'unhealthy' ? chalk.red('●') : chalk.yellow('○');

const formatResult = (r: CheckResult): string => {
  const lat = r.latency !== undefined ? chalk.dim(' ' + r.latency + 'ms') : '';
  const msg = r.message ? chalk.dim(' — ' + r.message) : '';
  return '  ' + statusIcon(r.status) + ' ' + chalk.white(r.service) + lat + msg;
};

const getResources = (): { memTotal: number; memFree: number; memUsedPct: number; disk?: string } => {
  const memTotal = os.totalmem();
  const memFree = os.freemem();
  const memUsedPct = Math.round(((memTotal - memFree) / memTotal) * 100);
  let disk: string | undefined;
  try {
    disk = execSync('df -h . 2>/dev/null | tail -1', { encoding: 'utf-8' }).trim();
  } catch {
    // disk info unavailable
  }
  return { memTotal, memFree, memUsedPct, disk };
};

const mb = (bytes: number): string => Math.round(bytes / 1024 / 1024) + 'MB';

const runStatus = async (opts: StatusOpts): Promise<void> => {
  try {
    const config = loadConfig();
    const full = loadFullConfig('project');
    const targets: ServiceName[] = opts.service ? [opts.service as ServiceName] : SERVICES;

    if (opts.service && !SERVICES.includes(opts.service as ServiceName)) {
      throw new Error('unknown service: ' + opts.service + '. valid: ' + SERVICES.join(', '));
    }

    const results = await Promise.all(targets.map((s) => checkService(s, config, full)));
    const configIssues = validateConfig(full);
    const resources = getResources();

    if (isJson()) {
      json({ services: results, config: configIssues, resources });
      return;
    }

    printBanner();

    // services
    info(chalk.bold('services'));
    for (const r of results) log(formatResult(r));
    log('');

    // config validation
    if (configIssues.length > 0) {
      info(chalk.bold('config'));
      for (const issue of configIssues) {
        const icon = issue.level === 'error' ? chalk.red('✗') : chalk.yellow('!');
        log('  ' + icon + ' ' + chalk.dim(issue.key) + ' — ' + issue.message);
      }
      log('');
    }

    // resources
    if (!opts.service) {
      info(chalk.bold('resources'));
      log('  memory: ' + mb(resources.memTotal - resources.memFree) + ' / ' + mb(resources.memTotal) + ' (' + resources.memUsedPct + '%)');
      if (resources.disk) {
        const parts = resources.disk.split(/\s+/);
        if (parts.length >= 5) {
          log('  disk:   ' + parts[2] + ' / ' + parts[1] + ' (' + parts[4] + ')');
        }
      }
    }
  } catch (err: unknown) {
    captureError(err, { command: 'status' });
    throw err;
  }
};

export async function statusCommand(): Promise<void> {
  await runStatus({});
}

export function registerStatus(program: Command): void {
  program
    .command('status')
    .description('show service health, config validation, and resource usage')
    .option('--service <name>', 'check a specific service (api, twenty, database, twilio, ai)')
    .option('--watch', 'continuously monitor')
    .option('--interval <ms>', 'watch interval in milliseconds', '5000')
    .action(async (opts: StatusOpts) => {
      if (opts.watch) {
        const ms = parseInt(opts.interval ?? '5000', 10);
        const loop = async (): Promise<void> => {
          try {
            if (!isJson()) log(chalk.dim('— ' + new Date().toLocaleTimeString() + ' —'));
            await runStatus(opts);
            if (!isJson()) log('');
          } catch (err: unknown) {
            captureError(err, { command: 'status --watch' });
          }
        };
        await loop();
        const timer = setInterval(() => { void loop(); }, ms);
        process.on('SIGINT', () => { clearInterval(timer); process.exit(0); });
      } else {
        await runStatus(opts);
      }
    });
}
