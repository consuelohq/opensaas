import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createWorkspaceEdgeRouteSeedSql } from './workspace-edge-route-seed';

// Internal Consuelo operator helper. Public install must consume scoped bootstrap
// material from approval and leave Cloudflare R2/D1 mutations to the control plane.

export type InstallEdgePublishStage = 'snapshot_plan' | 'r2_upload' | 'd1_upsert' | 'edge_verify';
export type WorkspaceEdgePublishedSnapshot = { siteId: string; pathPrefix: string; versionId: string; snapshotKey: string; snapshotPath: string; verifyUrl: string; contentHash: string; contentType: string };
export type WorkspaceEdgePublishResult = { status: 'succeeded'; workspaceId: string; workspaceSlug: string; workspaceHost: string; siteId: string; versionId: string; snapshotKey: string; snapshotPath: string; verifyUrl: string; verifiedUrls: string[]; snapshots: WorkspaceEdgePublishedSnapshot[]; logPath: string; httpStatus: number; cacheAuthority: string | null; sitesCache: string | null };
export type WorkspaceEdgeSnapshotPlan = WorkspaceEdgePublishResult & { status: never; baseDomain: string; contentHash: string; contentType: string; routeSql: string };
export type CommandRunner = (input: { argv: string[]; cwd?: string }) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
export type PublishInput = { home: string; workspaceId: string; workspaceSlug: string; workspaceHost: string; now?: string; commandRunner?: CommandRunner; fetchImpl?: (url: string, init?: RequestInit) => Promise<Response> };

export class InstallEdgePublishError extends Error {
  code = 'INSTALL_EDGE_PUBLISH_FAILED' as const;
  stage: InstallEdgePublishStage;
  workspaceHost: string;
  snapshotKey?: string;
  logPath: string;
  diagnostics?: Record<string, unknown>;
  constructor(input: { stage: InstallEdgePublishStage; workspaceHost: string; logPath: string; message: string; snapshotKey?: string; diagnostics?: Record<string, unknown>; cause?: unknown }) {
    super(input.message, { cause: input.cause });
    this.name = 'InstallEdgePublishError';
    this.stage = input.stage;
    this.workspaceHost = input.workspaceHost;
    this.snapshotKey = input.snapshotKey;
    this.logPath = input.logPath;
    this.diagnostics = input.diagnostics;
  }
}

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const bucket = 'consuelo-sites-snapshots';
const d1 = 'consuelo-workspace-route-registry';
const wranglerConfig = 'cloudflare/workspace-edge/wrangler.toml';
const siteId = 'launcher';
const contentType = 'text/html; charset=utf-8';
const forbiddenLogWords = /token|secret|credential/gi;
const commandTimeoutMs = 120_000;
const fetchTimeoutMs = 30_000;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const versionId = (value: string) => `sha256-${hash(value).slice(0, 16)}`;
const host = (value: string) => value.trim().toLowerCase();
const baseDomain = (value: string) => host(value).endsWith('.consuelohq.com') ? 'consuelohq.com' : host(value).split('.').slice(-2).join('.');
const clean = (value: unknown): unknown => {
  if (typeof value === 'string') return value.replace(forbiddenLogWords, '[redacted]');
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key.replace(forbiddenLogWords, 'redacted'), clean(child)]));
  return value;
};
const logPath = (home: string, now?: string) => path.join(home, 'logs', `install-edge-publish-${(now ?? new Date().toISOString()).replace(/[^0-9A-Za-z-]/g, '-')}.log`);
const writeLog = (file: string, entries: unknown[]) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${entries.map((entry) => JSON.stringify(clean(entry), null, 2)).join('\n')}\n`, { mode: 0o600 }); };

const snapshotSites = [
  { siteId: 'launcher', pathPrefix: '/', relativePath: ['index.html'] },
  { siteId: 'office', pathPrefix: '/office', relativePath: ['office', 'index.html'] },
  { siteId: 'traces', pathPrefix: '/observability', relativePath: ['traces', 'index.html'] },
  { siteId: 'traces', pathPrefix: '/traces', relativePath: ['traces', 'index.html'] },
  { siteId: 'diffs', pathPrefix: '/diffs', relativePath: ['diffs', 'index.html'] },
  { siteId: 'docs', pathPrefix: '/docs', relativePath: ['docs', 'index.html'] },
  { siteId: 'settings', pathPrefix: '/settings', relativePath: ['settings', 'index.html'] },
] as const;

function readSnapshotHtml(snapshotPath: string, siteName: string): string {
  if (!fs.existsSync(snapshotPath)) throw new Error(`installed Sites ${siteName} snapshot is missing: ${snapshotPath}`);
  return fs.readFileSync(snapshotPath, 'utf8');
}

export function createWorkspaceEdgeSnapshotPlan(input: PublishInput): WorkspaceEdgeSnapshotPlan {
  const workspaceHost = host(input.workspaceHost);
  const sitesDir = path.join(input.home, 'sites');
  const rootSnapshotPath = path.join(sitesDir, 'index.html');
  const rootHtml = readSnapshotHtml(rootSnapshotPath, siteId);
  const version = versionId(rootHtml);
  const snapshots = snapshotSites.map((snapshot): WorkspaceEdgePublishedSnapshot => {
    const snapshotPath = path.join(sitesDir, ...snapshot.relativePath);
    const html = snapshot.siteId === siteId ? rootHtml : readSnapshotHtml(snapshotPath, snapshot.siteId);
    const snapshotKey = `sites/${input.workspaceId}/${snapshot.siteId}/${version}/index.html`;
    const verifyUrl = `https://${workspaceHost}${snapshot.pathPrefix === '/' ? '/' : snapshot.pathPrefix}`;
    return {
      siteId: snapshot.siteId,
      pathPrefix: snapshot.pathPrefix,
      versionId: version,
      snapshotKey,
      snapshotPath,
      verifyUrl,
      contentHash: hash(html),
      contentType,
    };
  });
  const rootSnapshot = snapshots[0];
  if (!rootSnapshot) throw new Error('install edge snapshot plan requires a launcher snapshot');
  const routeSql = createWorkspaceEdgeRouteSeedSql({
    workspaceId: input.workspaceId,
    workspaceSlug: input.workspaceSlug,
    hostname: workspaceHost,
    baseDomain: baseDomain(workspaceHost),
    siteSnapshotKey: rootSnapshot.snapshotKey,
    siteVersionId: version,
  });
  return {
    status: undefined as never,
    workspaceId: input.workspaceId,
    workspaceSlug: input.workspaceSlug,
    workspaceHost,
    baseDomain: baseDomain(workspaceHost),
    siteId,
    versionId: version,
    snapshotKey: rootSnapshot.snapshotKey,
    snapshotPath: rootSnapshot.snapshotPath,
    verifyUrl: rootSnapshot.verifyUrl,
    verifiedUrls: snapshots.map((snapshot) => snapshot.verifyUrl),
    snapshots,
    logPath: '',
    httpStatus: 0,
    cacheAuthority: null,
    sitesCache: null,
    contentHash: rootSnapshot.contentHash,
    contentType,
    routeSql,
  };
}

const run = async (runner: CommandRunner, plan: WorkspaceEdgeSnapshotPlan, stage: InstallEdgePublishStage, log: string, entries: unknown[], argv: string[]) => {
  const result = await runner({ argv, cwd: packageRoot });
  entries.push({ stage, argv, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr });
  if (result.exitCode !== 0) { writeLog(log, entries); throw new InstallEdgePublishError({ stage, workspaceHost: plan.workspaceHost, snapshotKey: plan.snapshotKey, logPath: log, message: `install edge publish failed during ${stage}`, diagnostics: { exitCode: result.exitCode } }); }
};
const defaultRunner: CommandRunner = async ({ argv, cwd }) => {
  const proc = Bun.spawn(argv, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const timeout = setTimeout(() => proc.kill(), commandTimeoutMs);
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { stdout, stderr, exitCode };
  } finally {
    clearTimeout(timeout);
  }
};
const defaultFetch = async (url: string, init?: RequestInit) => {
  if (typeof fetch !== 'function') throw new Error('fetch unavailable');
  return await fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(fetchTimeoutMs) });
};

export async function publishWorkspaceEdgeSnapshot(input: PublishInput): Promise<WorkspaceEdgePublishResult> {
  const log = logPath(input.home, input.now);
  const entries: unknown[] = [];
  let plan: WorkspaceEdgeSnapshotPlan;
  try { plan = createWorkspaceEdgeSnapshotPlan(input); entries.push({ stage: 'snapshot_plan', workspaceId: plan.workspaceId, workspaceHost: plan.workspaceHost, snapshotKey: plan.snapshotKey, versionId: plan.versionId, snapshots: plan.snapshots.map((snapshot) => ({ siteId: snapshot.siteId, snapshotKey: snapshot.snapshotKey, contentHash: snapshot.contentHash })) }); }
  catch (error: unknown) { entries.push({ stage: 'snapshot_plan', error: error instanceof Error ? error.message : String(error) }); writeLog(log, entries); throw new InstallEdgePublishError({ stage: 'snapshot_plan', workspaceHost: input.workspaceHost, logPath: log, message: 'install edge publish failed while planning snapshot', cause: error }); }
  const runner = input.commandRunner ?? defaultRunner;
  const routeSqlPath = path.join(input.home, 'tmp', `install-edge-route-${plan.versionId}.sql`);
  fs.mkdirSync(path.dirname(routeSqlPath), { recursive: true });
  fs.writeFileSync(routeSqlPath, `${plan.routeSql}\n`, { mode: 0o600 });
  const uploadedSnapshotKeys = new Set<string>();
  for (const snapshot of plan.snapshots) {
    if (uploadedSnapshotKeys.has(snapshot.snapshotKey)) continue;
    uploadedSnapshotKeys.add(snapshot.snapshotKey);
    await run(runner, plan, 'r2_upload', log, entries, ['wrangler', 'r2', 'object', 'put', `${bucket}/${snapshot.snapshotKey}`, '--remote', '--file', snapshot.snapshotPath, '--content-type', snapshot.contentType]);
  }
  await run(runner, plan, 'd1_upsert', log, entries, ['wrangler', 'd1', 'execute', d1, '--remote', '--config', wranglerConfig, '--file', routeSqlPath]);
  let response: Response | null = null;
  let cacheAuthority: string | null = null;
  let sitesCache: string | null = null;
  const snapshotsByUrl = new Map(plan.snapshots.map((snapshot) => [snapshot.verifyUrl, snapshot]));
  try {
    for (const verifyUrl of plan.verifiedUrls) {
      const expectedSnapshot = snapshotsByUrl.get(verifyUrl);
      if (!expectedSnapshot) throw new Error(`missing snapshot plan for ${verifyUrl}`);
      response = await (input.fetchImpl ?? defaultFetch)(verifyUrl, { headers: { 'cache-control': 'no-cache', 'user-agent': 'Consuelo-OS-Install' } });
      const body = await response.text();
      cacheAuthority = response.headers.get('x-consuelo-edge-cache-authority');
      sitesCache = response.headers.get('x-consuelo-sites-cache');
      const siteVersion = response.headers.get('x-consuelo-site-version');
      const bodyHash = hash(body);
      entries.push({ stage: 'edge_verify', url: verifyUrl, status: response.status, cacheAuthority, sitesCache, siteVersion, bodyHash });
      if (response.status !== 200 || cacheAuthority !== 'sites-snapshot' || siteVersion !== expectedSnapshot.versionId || bodyHash !== expectedSnapshot.contentHash) {
        writeLog(log, entries);
        throw new InstallEdgePublishError({ stage: 'edge_verify', workspaceHost: plan.workspaceHost, snapshotKey: expectedSnapshot.snapshotKey, logPath: log, message: `install edge publish verification failed for ${verifyUrl}`, diagnostics: { status: response.status, cacheAuthority, sitesCache, siteVersion } });
      }
    }
  } catch (error: unknown) {
    writeLog(log, entries);
    if (error instanceof InstallEdgePublishError) throw error;
    throw new InstallEdgePublishError({ stage: 'edge_verify', workspaceHost: plan.workspaceHost, snapshotKey: plan.snapshotKey, logPath: log, message: `install edge publish verification failed for ${plan.verifyUrl}`, diagnostics: { error: error instanceof Error ? error.message : String(error) }, cause: error });
  }
  writeLog(log, entries);
  return { status: 'succeeded', workspaceId: plan.workspaceId, workspaceSlug: plan.workspaceSlug, workspaceHost: plan.workspaceHost, siteId, versionId: plan.versionId, snapshotKey: plan.snapshotKey, snapshotPath: plan.snapshotPath, verifyUrl: plan.verifyUrl, verifiedUrls: plan.verifiedUrls, snapshots: plan.snapshots, logPath: log, httpStatus: response?.status ?? 0, cacheAuthority, sitesCache };
}
