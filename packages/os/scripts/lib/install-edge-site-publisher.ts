import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Internal Consuelo operator helper. Public install must consume scoped bootstrap
// material from approval and leave Cloudflare R2/D1 mutations to the control plane.

export type InstallEdgePublishStage = 'snapshot_plan' | 'r2_upload' | 'd1_upsert' | 'edge_verify';
export type WorkspaceEdgePublishResult = { status: 'succeeded'; workspaceId: string; workspaceSlug: string; workspaceHost: string; siteId: string; versionId: string; snapshotKey: string; snapshotPath: string; verifyUrl: string; verifiedUrls: string[]; logPath: string; httpStatus: number; cacheAuthority: string | null; sitesCache: string | null };
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
const traceGatewayReadService = 'trace-sites-read-layer';
const traceGatewayLiveService = 'trace-sites-live-endpoints';
const forbiddenLogWords = /token|secret|credential/gi;
const commandTimeoutMs = 120_000;
const fetchTimeoutMs = 30_000;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const versionId = (value: string) => `sha256-${hash(value).slice(0, 16)}`;
const sql = (value: string) => `'${value.replace(/'/g, "''")}'`;
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

export function createWorkspaceEdgeSnapshotPlan(input: PublishInput): WorkspaceEdgeSnapshotPlan {
  const snapshotPath = path.join(input.home, 'sites', 'index.html');
  if (!fs.existsSync(snapshotPath)) throw new Error(`installed Sites index is missing: ${snapshotPath}`);
  const html = fs.readFileSync(snapshotPath, 'utf8');
  const version = versionId(html);
  const workspaceHost = host(input.workspaceHost);
  const snapshotKey = `sites/${input.workspaceId}/${siteId}/${version}/index.html`;
  const snapshotTarget = { kind: 'site-snapshot', siteId, versionId: version, manifestKey: snapshotKey, contentType, cachePolicy: 'static-shell' };
  const record = {
    workspaceId: input.workspaceId,
    workspaceSlug: input.workspaceSlug,
    hostname: workspaceHost,
    baseDomain: baseDomain(workspaceHost),
    provider: 'cloudflare',
    owner: 'consuelo-os-cloud',
    status: 'active',
    routes: [
      { surface: 'sites', pathPrefix: '/', auth: 'public', status: 'active', target: snapshotTarget },
      { surface: 'sites', pathPrefix: '/traces', auth: 'public', status: 'active', target: snapshotTarget },
      {
        surface: 'sites',
        pathPrefix: '/gateway/traces/events',
        auth: 'required',
        status: 'active',
        target: { kind: 'consuelo-gateway-service', serviceName: traceGatewayLiveService, gatewayRouteFamily: '/gateway/traces/*', publicSiteRouteFamily: '/traces/*' },
      },
      {
        surface: 'sites',
        pathPrefix: '/gateway/traces',
        auth: 'required',
        status: 'active',
        target: { kind: 'consuelo-gateway-service', serviceName: traceGatewayReadService, gatewayRouteFamily: '/gateway/traces/*', publicSiteRouteFamily: '/traces/*' },
      },
    ],
    updatedAt: input.now ?? new Date().toISOString(),
  };
  const routeSql = [`INSERT OR REPLACE INTO workspace_route_registry (`, `  hostname, workspace_id, workspace_slug, workspace_host, base_domain,`, `  route_path_prefix, route_surface, route_status, route_target_kind, target_origin_url,`, `  connector_id, connector_status, record_json, created_at, updated_at`, `) VALUES (`, `  ${sql(workspaceHost)}, ${sql(input.workspaceId)}, ${sql(input.workspaceSlug)}, ${sql(workspaceHost)}, ${sql(baseDomain(workspaceHost))},`, `  '/', 'sites', 'active', 'site-snapshot', ${sql(`r2://${bucket}/${snapshotKey}`)},`, `  NULL, NULL, ${sql(JSON.stringify(record))}, datetime('now'), datetime('now')`, `);`].join('\n');
  const verifyUrl = `https://${workspaceHost}/`;
  return { status: undefined as never, workspaceId: input.workspaceId, workspaceSlug: input.workspaceSlug, workspaceHost, baseDomain: baseDomain(workspaceHost), siteId, versionId: version, snapshotKey, snapshotPath, verifyUrl, verifiedUrls: [verifyUrl, `https://${workspaceHost}/traces`], logPath: '', httpStatus: 0, cacheAuthority: null, sitesCache: null, contentHash: hash(html), contentType, routeSql };
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
  try { plan = createWorkspaceEdgeSnapshotPlan(input); entries.push({ stage: 'snapshot_plan', workspaceId: plan.workspaceId, workspaceHost: plan.workspaceHost, snapshotKey: plan.snapshotKey, contentHash: plan.contentHash }); }
  catch (error: unknown) { entries.push({ stage: 'snapshot_plan', error: error instanceof Error ? error.message : String(error) }); writeLog(log, entries); throw new InstallEdgePublishError({ stage: 'snapshot_plan', workspaceHost: input.workspaceHost, logPath: log, message: 'install edge publish failed while planning snapshot', cause: error }); }
  const runner = input.commandRunner ?? defaultRunner;
  const routeSqlPath = path.join(input.home, 'tmp', `install-edge-route-${plan.versionId}.sql`);
  fs.mkdirSync(path.dirname(routeSqlPath), { recursive: true });
  fs.writeFileSync(routeSqlPath, `${plan.routeSql}\n`, { mode: 0o600 });
  await run(runner, plan, 'r2_upload', log, entries, ['wrangler', 'r2', 'object', 'put', `${bucket}/${plan.snapshotKey}`, '--remote', '--file', plan.snapshotPath, '--content-type', contentType]);
  await run(runner, plan, 'd1_upsert', log, entries, ['wrangler', 'd1', 'execute', d1, '--remote', '--config', wranglerConfig, '--file', routeSqlPath]);
  let response: Response | null = null;
  let cacheAuthority: string | null = null;
  let sitesCache: string | null = null;
  try {
    for (const verifyUrl of plan.verifiedUrls) {
      response = await (input.fetchImpl ?? defaultFetch)(verifyUrl, { headers: { 'cache-control': 'no-cache', 'user-agent': 'Consuelo-OS-Install' } });
      const body = await response.text();
      cacheAuthority = response.headers.get('x-consuelo-edge-cache-authority');
      sitesCache = response.headers.get('x-consuelo-sites-cache');
      const siteVersion = response.headers.get('x-consuelo-site-version');
      const bodyHash = hash(body);
      entries.push({ stage: 'edge_verify', url: verifyUrl, status: response.status, cacheAuthority, sitesCache, siteVersion, bodyHash });
      if (response.status !== 200 || cacheAuthority !== 'sites-snapshot' || siteVersion !== plan.versionId || bodyHash !== plan.contentHash) {
        writeLog(log, entries);
        throw new InstallEdgePublishError({ stage: 'edge_verify', workspaceHost: plan.workspaceHost, snapshotKey: plan.snapshotKey, logPath: log, message: `install edge publish verification failed for ${verifyUrl}`, diagnostics: { status: response.status, cacheAuthority, sitesCache, siteVersion } });
      }
    }
  } catch (error: unknown) {
    writeLog(log, entries);
    if (error instanceof InstallEdgePublishError) throw error;
    throw new InstallEdgePublishError({ stage: 'edge_verify', workspaceHost: plan.workspaceHost, snapshotKey: plan.snapshotKey, logPath: log, message: `install edge publish verification failed for ${plan.verifyUrl}`, diagnostics: { error: error instanceof Error ? error.message : String(error) }, cause: error });
  }
  writeLog(log, entries);
  return { status: 'succeeded', workspaceId: plan.workspaceId, workspaceSlug: plan.workspaceSlug, workspaceHost: plan.workspaceHost, siteId, versionId: plan.versionId, snapshotKey: plan.snapshotKey, snapshotPath: plan.snapshotPath, verifyUrl: plan.verifyUrl, verifiedUrls: plan.verifiedUrls, logPath: log, httpStatus: response?.status ?? 0, cacheAuthority, sitesCache };
}
