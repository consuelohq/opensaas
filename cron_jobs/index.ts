import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { refreshDiffCockpitCache } from '../packages/workspace/hooks/diff-cockpit/cache-refresh';

export type CronJobKind = 'diff-cockpit';

export type CronJobManifest = {
  schema: 'consuelo.cron.v1';
  name: string;
  kind: CronJobKind;
  enabled: boolean;
  intervalMs: number;
  envFile?: string;
  repo?: string;
  prLimit?: number;
  origin?: string;
  codePaths?: string[];
  warmPullLimit?: number;
  warmIntervalMs?: number;
};

export type DiffCockpitPullFingerprint = {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  updatedAt: string;
  headRef: string;
  baseRef: string;
  headSha: string;
  author: string;
};

export type CronJobState = {
  schema: 'consuelo.cron.state.v1';
  updatedAt: string;
  jobs: Record<string, CronJobStateEntry>;
};

export type CronJobStateEntry = {
  lastCheckedAt?: string;
  lastChangedAt?: string;
  lastFingerprint?: string;
  lastPayload?: DiffCockpitPullFingerprint[];
  lastStatus?: 'changed' | 'unchanged' | 'skipped' | 'error';
  lastError?: string;
  lastCacheRefreshAt?: string;
};

type DiscoveredJob = {
  dirName: string;
  dir: string;
  manifestPath: string;
  manifest: CronJobManifest;
};

type RunOnceOptions = {
  root?: string;
  only?: string;
  dryRun?: boolean;
  force?: boolean;
  statePath?: string;
  logPath?: string;
  fetcher?: typeof fetch;
  now?: Date;
};

const DEFAULT_ROOT = 'cron_jobs';
const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_REPO = 'consuelohq/opensaas';
const DEFAULT_ORIGIN = 'https://diffs.consuelohq.com';
const DEFAULT_WARM_PULL_LIMIT = 20;
const DEFAULT_WARM_INTERVAL_MS = 5 * 60_000;

export function statePath(): string {
  return path.join(process.env.HOME || process.cwd(), '.consuelo', 'state', 'cron_jobs.json');
}

export function logPath(): string {
  return path.join(process.env.HOME || process.cwd(), '.consuelo', 'logs', 'cron_jobs.log');
}

async function main(): Promise<void> {
  try {
    const [command = 'help', ...args] = process.argv.slice(2);
    if (command === 'help' || command === '--help' || command === '-h') return writeLine(usage());
    if (command === 'provision') return provisionCommand(args);
    if (command === 'list') return listCommand(args);
    if (command === 'run-once') return runOnceCommand(args);
    if (command === 'watch') return watchCommand(args);
    if (command === 'install') return installCommand(args);
    if (command === 'uninstall') return uninstallCommand(args);
    if (command === 'status') return statusCommand(args);
    if (command === 'logs') return logsCommand(args);
    throw new Error(`unknown cron command: ${command}`);
  } catch (error: unknown) {
    process.stderr.write(error instanceof Error ? `${error.message}\n` : `${String(error)}\n`);
    process.exitCode = 1;
  }
}

export function sanitizeName(input: string): string {
  const value = input.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!value) throw new Error('cron job name is required');
  return value;
}

export function launchAgentLabel(name: string): string {
  return `com.consuelo.cronjobs.${sanitizeName(name)}`;
}

async function provisionCommand(args: string[]): Promise<void> {
  const name = sanitizeName(args[0] || '');
  const root = flag(args, '--root') || DEFAULT_ROOT;
  const dir = path.join(root, name.replace(/-/g, '_'));
  await mkdir(dir, { recursive: true });
  const manifest: CronJobManifest = {
    schema: 'consuelo.cron.v1',
    name,
    kind: 'diff-cockpit',
    enabled: true,
    intervalMs: positiveNumber(flag(args, '--interval-ms'), DEFAULT_INTERVAL_MS),
    envFile: '.env',
    repo: flag(args, '--repo') || DEFAULT_REPO,
    prLimit: positiveNumber(flag(args, '--pr-limit'), 50),
    origin: flag(args, '--origin') || DEFAULT_ORIGIN,
    codePaths: ['packages'],
  };
  await writeJson(path.join(dir, 'cron.json'), manifest);
  await writeFile(path.join(dir, '.env.example'), envExample(), 'utf8');
  await writeFile(path.join(dir, 'README.md'), jobReadme(name), 'utf8');
  writeLine(`provisioned ${name} at ${dir}`);
}

async function listCommand(args: string[]): Promise<void> {
  const jobs = await discoverJobs(flag(args, '--root') || DEFAULT_ROOT);
  if (jobs.length === 0) return writeLine('no cron jobs found');
  for (const job of jobs) {
    writeLine(`${job.manifest.name}\t${job.manifest.kind}\t${job.manifest.intervalMs}ms\t${job.manifest.enabled ? 'enabled' : 'disabled'}`);
  }
}

async function runOnceCommand(args: string[]): Promise<void> {
  const result = await runOnce({
    root: flag(args, '--root') || DEFAULT_ROOT,
    only: flag(args, '--job'),
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
  });
  writeLine(JSON.stringify(result, null, 2));
}

async function watchCommand(args: string[]): Promise<void> {
  const intervalMs = positiveNumber(flag(args, '--interval-ms') || process.env.CONSUELO_CRON_INTERVAL_MS, DEFAULT_INTERVAL_MS);
  writeLine(`watching ${flag(args, '--root') || DEFAULT_ROOT} every ${intervalMs}ms`);
  while (true) {
    const startedAt = Date.now();
    await runOnce({
      root: flag(args, '--root') || DEFAULT_ROOT,
      only: flag(args, '--job'),
      dryRun: args.includes('--dry-run'),
      force: args.includes('--force'),
    });
    const elapsed = Date.now() - startedAt;
    await sleep(Math.max(1000, intervalMs - elapsed));
  }
}

async function installCommand(args: string[]): Promise<void> {
  const name = sanitizeName(flag(args, '--name') || path.basename(process.cwd()));
  const label = launchAgentLabel(name);
  const plistPath = path.join(process.env.HOME || process.cwd(), 'Library', 'LaunchAgents', `${label}.plist`);
  const intervalMs = positiveNumber(flag(args, '--interval-ms'), DEFAULT_INTERVAL_MS);
  await mkdir(path.dirname(plistPath), { recursive: true });
  await mkdir(path.dirname(logPath()), { recursive: true });
  await writeFile(plistPath, launchAgentPlist({ label, bunPath: process.execPath, repoRoot: process.cwd(), intervalMs }), 'utf8');
  spawnSync('launchctl', ['unload', plistPath], { stdio: 'ignore' });
  const loaded = spawnSync('launchctl', ['load', plistPath], { stdio: 'pipe', encoding: 'utf8' });
  if (loaded.status !== 0) throw new Error(loaded.stderr || `launchctl load failed with status ${loaded.status}`);
  writeLine(`installed ${label}`);
  writeLine(plistPath);
}

async function uninstallCommand(args: string[]): Promise<void> {
  const name = sanitizeName(flag(args, '--name') || path.basename(process.cwd()));
  const label = launchAgentLabel(name);
  const plistPath = path.join(process.env.HOME || process.cwd(), 'Library', 'LaunchAgents', `${label}.plist`);
  if (existsSync(plistPath)) {
    spawnSync('launchctl', ['unload', plistPath], { stdio: 'ignore' });
    await unlink(plistPath);
    writeLine(`removed ${label}`);
  } else {
    writeLine(`not installed ${label}`);
  }
  writeLine(plistPath);
}

async function statusCommand(args: string[]): Promise<void> {
  const root = flag(args, '--root') || DEFAULT_ROOT;
  const name = sanitizeName(flag(args, '--name') || path.basename(process.cwd()));
  const jobs = await discoverJobs(root);
  writeLine(`label: ${launchAgentLabel(name)}`);
  writeLine(`root: ${root}`);
  writeLine(`state: ${statePath()}`);
  writeLine(`log: ${logPath()}`);
  writeLine(`jobs: ${jobs.map((job) => job.manifest.name).join(', ') || 'none'}`);
}

async function logsCommand(args: string[]): Promise<void> {
  const file = flag(args, '--log') || logPath();
  if (!existsSync(file)) return writeLine(`no log file at ${file}`);
  writeLine(await readFile(file, 'utf8'));
}

export async function discoverJobs(root = DEFAULT_ROOT): Promise<DiscoveredJob[]> {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const jobs: DiscoveredJob[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    const manifestPath = path.join(dir, 'cron.json');
    if (!existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as CronJobManifest;
      validateManifest(manifest, manifestPath);
      if (manifest.enabled) jobs.push({ dirName: entry.name, dir, manifestPath, manifest });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`skipping invalid cron manifest ${manifestPath}: ${message}\n`);
    }
  }
  return jobs.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

export async function runOnce(options: RunOnceOptions = {}): Promise<{
  checked: number;
  changed: number;
  skipped: number;
  errors: number;
  jobs: Array<{ name: string; status: string; changedPulls?: number[]; error?: string }>;
}> {
  const stateFile = options.statePath || statePath();
  const logFile = options.logPath || logPath();
  const state = readState(stateFile);
  const jobs = (await discoverJobs(options.root || DEFAULT_ROOT)).filter((job) => !options.only || job.manifest.name === options.only);
  const result = { checked: 0, changed: 0, skipped: 0, errors: 0, jobs: [] as Array<{ name: string; status: string; changedPulls?: number[]; error?: string }> };

  for (const job of jobs) {
    const name = job.manifest.name;
    if (!options.force && !isDue(job.manifest, state.jobs[name], options.now || new Date())) {
      result.skipped += 1;
      result.jobs.push({ name, status: 'skipped' });
      continue;
    }

    try {
      const env = { ...process.env, ...readEnvFile(path.join(job.dir, job.manifest.envFile || '.env')) };
      const previous = state.jobs[name]?.lastPayload || [];
      const current = await loadDiffCockpitFingerprint({
        repo: job.manifest.repo || env.DIFF_COCKPIT_REPO || DEFAULT_REPO,
        prLimit: job.manifest.prLimit || positiveNumber(env.DIFF_COCKPIT_PR_LIMIT, 50),
        githubToken: env.GITHUB_TOKEN,
        fetcher: options.fetcher || fetch,
      });
      const previousFingerprint = stableFingerprint(previous);
      const currentFingerprint = stableFingerprint(current);
      const changed = previousFingerprint !== currentFingerprint;
      const changedPulls = previous.length === 0 ? current.map((pull) => pull.number) : changedPullNumbers(previous, current);
      const warmPullLimit = job.manifest.warmPullLimit || positiveNumber(env.DIFF_COCKPIT_WARM_PULL_LIMIT, DEFAULT_WARM_PULL_LIMIT);
      const warmIntervalMs = job.manifest.warmIntervalMs || positiveNumber(env.DIFF_COCKPIT_WARM_INTERVAL_MS, DEFAULT_WARM_INTERVAL_MS);
      const warmPulls = selectWarmPullNumbers(previous, current, warmPullLimit);
      const now = options.now || new Date();
      const refreshCache = shouldRefreshWarmCache(changed, state.jobs[name], now, warmIntervalMs);
      if (refreshCache && !options.dryRun) {
        await refreshDiffCockpitCache({
          repo: job.manifest.repo || env.DIFF_COCKPIT_REPO || DEFAULT_REPO,
          pulls: warmPulls,
          codePaths: job.manifest.codePaths || ['packages'],
          reason: `cron.${name}`,
          origin: job.manifest.origin || env.DIFF_COCKPIT_ORIGIN || DEFAULT_ORIGIN,
          token: env.DIFF_COCKPIT_REFRESH_TOKEN,
        });
      }

      result.checked += 1;
      if (changed) result.changed += 1;
      result.jobs.push({ name, status: changed ? 'changed' : 'unchanged', changedPulls });
      state.jobs[name] = {
        lastCheckedAt: now.toISOString(),
        lastChangedAt: changed ? now.toISOString() : state.jobs[name]?.lastChangedAt,
        lastFingerprint: currentFingerprint,
        lastPayload: current,
        lastStatus: changed ? 'changed' : 'unchanged',
        lastError: '',
        lastCacheRefreshAt: refreshCache && !options.dryRun ? now.toISOString() : state.jobs[name]?.lastCacheRefreshAt,
      };
      await appendLog(logFile, `${name}: ${changed ? 'changed' : 'unchanged'}${changedPulls.length ? ` pulls=${changedPulls.join(',')}` : ''}${options.dryRun ? ' dry-run' : ''}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors += 1;
      result.jobs.push({ name, status: 'error', error: message });
      state.jobs[name] = {
        ...state.jobs[name],
        lastCheckedAt: (options.now || new Date()).toISOString(),
        lastStatus: 'error',
        lastError: message,
      };
      await appendLog(logFile, `${name}: error ${message}`);
    }
  }

  if (!options.dryRun) await writeState(state, stateFile);
  return result;
}

export async function loadDiffCockpitFingerprint(options: {
  repo: string;
  prLimit: number;
  githubToken?: string;
  fetcher?: typeof fetch;
}): Promise<DiffCockpitPullFingerprint[]> {
  const [owner, name] = parseRepo(options.repo);
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls?state=all&sort=updated&direction=desc&per_page=${encodeURIComponent(String(options.prLimit))}`;
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'consuelo-cron/diff-cockpit',
  };
  if (options.githubToken) headers.authorization = `Bearer ${options.githubToken}`;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await (options.fetcher || fetch)(url, {
      headers,
      signal: controller.signal,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('GitHub PR fingerprint fetch timed out after 15000ms');
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!response.ok) throw new Error(`GitHub PR fingerprint fetch failed with HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error('GitHub PR fingerprint response was not an array');
  return payload.map(normalizePull).filter((pull): pull is DiffCockpitPullFingerprint => Boolean(pull));
}

export function changedPullNumbers(previous: DiffCockpitPullFingerprint[], current: DiffCockpitPullFingerprint[]): number[] {
  const previousByNumber = new Map(previous.map((pull) => [pull.number, stableFingerprint(pull)]));
  const currentByNumber = new Map(current.map((pull) => [pull.number, stableFingerprint(pull)]));
  const changed = new Set<number>();
  for (const [number, value] of currentByNumber) {
    if (previousByNumber.get(number) !== value) changed.add(number);
  }
  for (const number of previousByNumber.keys()) {
    if (!currentByNumber.has(number)) changed.add(number);
  }
  return [...changed].sort((a, b) => a - b);
}

export function selectWarmPullNumbers(
  previous: DiffCockpitPullFingerprint[],
  current: DiffCockpitPullFingerprint[],
  limit = DEFAULT_WARM_PULL_LIMIT,
): number[] {
  const cappedLimit = Math.max(1, Math.floor(limit));
  const selected = new Set<number>();
  const add = (number: number) => {
    if (selected.size < cappedLimit && Number.isInteger(number) && number > 0) selected.add(number);
  };
  const changed = previous.length === 0 ? current.map((pull) => pull.number) : changedPullNumbers(previous, current);
  for (const number of changed) add(number);
  for (const pull of current) {
    if (pull.state === 'open') add(pull.number);
  }
  for (const pull of current) add(pull.number);
  return [...selected];
}

function shouldRefreshWarmCache(
  changed: boolean,
  entry: CronJobStateEntry | undefined,
  now: Date,
  intervalMs: number,
): boolean {
  if (changed) return true;
  if (!entry?.lastCacheRefreshAt) return true;
  const lastRefreshMs = Date.parse(entry.lastCacheRefreshAt);
  if (!Number.isFinite(lastRefreshMs)) return true;
  return now.getTime() - lastRefreshMs >= intervalMs;
}

export function stableFingerprint(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function normalizePull(value: unknown): DiffCockpitPullFingerprint | null {
  if (!isRecord(value)) return null;
  const head = isRecord(value.head) ? value.head : {};
  const base = isRecord(value.base) ? value.base : {};
  const user = isRecord(value.user) ? value.user : {};
  const number = Number(value.number);
  if (!Number.isInteger(number)) return null;
  return {
    number,
    title: stringValue(value.title),
    state: stringValue(value.state),
    draft: Boolean(value.draft),
    updatedAt: stringValue(value.updated_at),
    headRef: stringValue(head.ref),
    baseRef: stringValue(base.ref),
    headSha: stringValue(head.sha),
    author: stringValue(user.login),
  };
}

function validateManifest(manifest: CronJobManifest, manifestPath: string): void {
  if (manifest.schema !== 'consuelo.cron.v1') throw new Error(`invalid cron schema in ${manifestPath}`);
  if (!manifest.name) throw new Error(`missing cron name in ${manifestPath}`);
  if (manifest.kind !== 'diff-cockpit') throw new Error(`unsupported cron kind in ${manifestPath}: ${manifest.kind}`);
  if (!Number.isFinite(manifest.intervalMs) || manifest.intervalMs < 1000) throw new Error(`invalid intervalMs in ${manifestPath}`);
}

function isDue(manifest: CronJobManifest, previous: CronJobStateEntry | undefined, now: Date): boolean {
  if (!previous?.lastCheckedAt) return true;
  const last = Date.parse(previous.lastCheckedAt);
  return !Number.isFinite(last) || now.getTime() - last >= manifest.intervalMs;
}

function readState(filePath: string): CronJobState {
  if (!existsSync(filePath)) return { schema: 'consuelo.cron.state.v1', updatedAt: new Date(0).toISOString(), jobs: {} };
  try {
    const state = JSON.parse(readFileSync(filePath, 'utf8')) as CronJobState;
    return state.schema === 'consuelo.cron.state.v1' && state.jobs ? state : { schema: 'consuelo.cron.state.v1', updatedAt: new Date(0).toISOString(), jobs: {} };
  } catch {
    return { schema: 'consuelo.cron.state.v1', updatedAt: new Date(0).toISOString(), jobs: {} };
  }
}
async function writeState(state: CronJobState, filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeJson(filePath, { ...state, updatedAt: new Date().toISOString() });
}

function readEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const env: Record<string, string> = {};
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
  return env;
}

async function appendLog(filePath: string, message: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `[${new Date().toISOString()}] ${message}\n`, { flag: 'a' });
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function envExample(): string {
  return [
    'DIFF_COCKPIT_ORIGIN=https://diffs.consuelohq.com',
    'DIFF_COCKPIT_REPO=consuelohq/opensaas',
    'DIFF_COCKPIT_REFRESH_TOKEN=',
    'GITHUB_TOKEN=',
    'DIFF_COCKPIT_PR_LIMIT=50',
    '',
  ].join('\n');
}

function jobReadme(name: string): string {
  return `# ${name}\n\nLocal Consuelo cron job. Copy \`.env.example\` to \`.env\` and keep secrets local.\n`;
}

function launchAgentPlist(input: { label: string; bunPath: string; repoRoot: string; intervalMs: number }): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n  <key>Label</key>\n  <string>${escapeXml(input.label)}</string>\n  <key>ProgramArguments</key>\n  <array>\n    <string>${escapeXml(input.bunPath)}</string>\n    <string>cron_jobs/index.ts</string>\n    <string>watch</string>\n    <string>--interval-ms</string>\n    <string>${String(input.intervalMs)}</string>\n  </array>\n  <key>WorkingDirectory</key>\n  <string>${escapeXml(input.repoRoot)}</string>\n  <key>RunAtLoad</key>\n  <true/>\n  <key>KeepAlive</key>\n  <true/>\n  <key>StandardOutPath</key>\n  <string>${escapeXml(logPath())}</string>\n  <key>StandardErrorPath</key>\n  <string>${escapeXml(logPath().replace(/\\.log$/, '.err.log'))}</string>\n</dict>\n</plist>\n`;
}

function usage(): string {
  return [
    'usage: bun run cron -- provision <name> [--interval-ms 30000]',
    '       bun run cron -- list',
    '       bun run cron -- run-once [--job diff-cockpit] [--dry-run] [--force]',
    '       bun run cron -- watch [--interval-ms 30000]',
    '       bun run cron -- install [--name opensaas] [--interval-ms 30000]',
    '       bun run cron -- status|logs|uninstall',
  ].join('\n');
}

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function positiveNumber(value: string | number | undefined, fallback: number): number {
  const number = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`expected a positive number, received ${value}`);
  return number;
}

function parseRepo(repo: string): [string, string] {
  const [owner, name] = repo.split('/');
  if (!owner || !name) throw new Error(`repo must be owner/name, received ${repo}`);
  return [owner, name];
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeLine(value: string): void {
  process.stdout.write(`${value}\n`);
}

if (import.meta.main) void main();
