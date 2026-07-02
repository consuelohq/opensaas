#!/usr/bin/env bun

import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import {
  findManifestEntry,
  getPackageRoot,
  readCoreToolManifest,
} from './lib/manifest';
import { validateManifestGuardrails } from './lib/local-guardrails';
import {
  assessDangerousMaterial,
  dangerousMaterialError,
} from './lib/dangerous-material-policy';
import {
  ensureRuntimePaths,
  getRuntimePaths,
  readSteeringGuardDecisions,
  recordExecutionFinished,
  recordExecutionStarted,
  recordSteeringGuardEvent,
} from './lib/runtime-state';
import {
  acquireSitePageLease,
  getSitesPaths,
  materializeSites,
  prepareSitePagePatch,
  publishSitePage,
  readOfficeSiteData,
  releaseSitePageLease,
  sitePageLeaseStatus,
} from './lib/sites';
import type { SitePageKind } from './lib/sites';
import { loadOsConfig } from './lib/install-state';
import type { CallInput, CallOutput, SkillContext } from './lib/types';

function writeStdout(value: string): void {
  process.stdout.write(value);
}

function writeStderr(value: string): void {
  process.stderr.write(`${value}\n`);
}

function safeJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function readIfExists(filePath: string): string {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function repoRoot(): string {
  return path.resolve(getPackageRoot(), '..', '..');
}

function readManifestCodeFileSource(codeFile: unknown): string | undefined {
  if (typeof codeFile !== 'string') return undefined;
  if (!codeFile.startsWith('scripts/code-call-examples/')) return undefined;
  if (!codeFile.endsWith('.ts') && !codeFile.endsWith('.py')) return undefined;

  const root = repoRoot();
  const candidate = path.resolve(root, codeFile);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return undefined;
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) return undefined;
  return fs.readFileSync(candidate, 'utf8');
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expandManifestCodeFileExamples(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => expandManifestCodeFileExamples(item));
  if (!isJsonObject(value)) return value;

  const expanded: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    expanded[key] = expandManifestCodeFileExamples(item);
  }

  const source = readManifestCodeFileSource(expanded.codeFile);
  if (source && expanded.codeFileSource === undefined) expanded.codeFileSource = source;
  return expanded;
}

function renderManifestForSteering(value: unknown): string {
  return safeJson(expandManifestCodeFileExamples(value));
}

function renderManifestTextForSteering(rawManifest: string): string {
  try {
    return renderManifestForSteering(JSON.parse(rawManifest));
  } catch {
    return rawManifest;
  }
}

const PRIMARY_STEERING_FILES = ['system_prompt.md', 'decision.md'] as const;
const LEGACY_STEERING_FILE = 'steering.md';

function localSteeringDir(home: string): string {
  return path.join(home, 'steering');
}

function isSupportedSteeringMarkdown(fileName: string): boolean {
  return fileName.endsWith('.md') && fileName.toLowerCase() !== LEGACY_STEERING_FILE;
}

function readSteeringMarkdownFiles(steeringDir: string): Array<{ name: string; content: string }> {
  const sections: Array<{ name: string; content: string }> = [];
  const seen = new Set<string>();

  for (const fileName of PRIMARY_STEERING_FILES) {
    const content = readIfExists(path.join(steeringDir, fileName));
    seen.add(fileName);
    if (content) sections.push({ name: fileName, content });
  }

  if (!fs.existsSync(steeringDir)) return sections;

  const additionalFiles = fs.readdirSync(steeringDir)
    .filter((fileName) => !seen.has(fileName) && isSupportedSteeringMarkdown(fileName))
    .sort((left, right) => left.localeCompare(right));

  for (const fileName of additionalFiles) {
    const filePath = path.join(steeringDir, fileName);
    if (!fs.statSync(filePath).isFile()) continue;
    const content = readIfExists(filePath);
    if (content) sections.push({ name: fileName, content });
  }

  return sections;
}

function createTraceId(): string {
  return `trc_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

function envPresence(): Record<string, unknown> {
  const graphqlUrl = process.env.CONSUELO_GRAPHQL_URL;
  const paths = getRuntimePaths();
  return {
    workspaceId: process.env.CONSUELO_WORKSPACE_ID ?? null,
    userId: process.env.CONSUELO_USER_ID ?? null,
    graphqlUrlHost: graphqlUrl ? new URL(graphqlUrl).host : null,
    hasGraphqlApiKey: Boolean(process.env.CONSUELO_INTERNAL_GRAPHQL_API_KEY),
    consueloHome: paths.home,
    sqlitePath: paths.dbPath,
    artifactStorage: 'local',
  };
}

export type SitesCommandResult = {
  ok: boolean;
  command: string;
  home: string;
  sitesDir: string;
  indexPath: string;
  officeIndexPath: string;
  officeDataPath: string;
  officeAssetsDir: string;
  tracesIndexPath: string;
  diffsIndexPath: string;
  docsIndexPath: string;
  url: string;
  artifacts: number;
  generatedAt: string | null;
  indexExists: boolean;
  officeIndexExists: boolean;
  officeDataExists: boolean;
  tracesIndexExists: boolean;
  diffsIndexExists: boolean;
  docsIndexExists: boolean;
  message: string;
  pagesDir?: string;
  pagesRegistryPath?: string;
  pageId?: string;
  pagePath?: string;
  sectionId?: string;
  agentId?: string | null;
  leaseAction?: 'acquire' | 'release' | 'status';
  leasesPath?: string;
  leases?: unknown[];
  rebased?: boolean;
  stagedTarget?: string;
  contentPath?: string;
  pageTitle?: string;
  pageKind?: SitePageKind;
  currentVersionId?: string | null;
  publishedVersionId?: string | null;
  requiredBaseVersion?: string | null;
  versionCount?: number;
  currentPath?: string;
  versionPath?: string;
  renderTemplate?: ReaderSiteTemplate;
  inputPath?: string;
  outputPath?: string;
  rendered?: boolean;
  rendererStdout?: string;
  actions?: Array<{ type: string; path: string; status: string; message: string }>;
  error?: { code: string; message: string };
};

export type OfficeCommandResult = SitesCommandResult;

export type RunSitesCommandOptions = {
  home?: string;
  openUrl?: boolean;
};

export type RunOfficeCommandOptions = RunSitesCommandOptions;

type GeneratedOfficeSiteData = {
  generatedAt?: string;
  artifacts?: unknown[];
};

function hasFlag(args: readonly string[], flag: string): boolean {
  return args.includes(flag);
}

function readFlagValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  const value = args[index + 1];
  return value && !value.startsWith('-') ? value : null;
}

type ReaderSiteTemplate = 'spec' | 'plan' | 'guide';

function sitePageKind(value: string | null): SitePageKind {
  const kind = value ?? 'uncategorized';
  if (['spec', 'plan', 'guide', 'trace', 'diff', 'office', 'uncategorized'].includes(kind)) return kind as SitePageKind;
  throw new Error(`Unsupported Sites page kind: ${kind}`);
}

function readerSiteTemplate(value: string | null): ReaderSiteTemplate | null {
  if (value === 'spec' || value === 'plan' || value === 'guide') return value;
  return null;
}

function repoRootFromOsPackage(): string {
  return path.resolve(getPackageRoot(), '..', '..');
}

function textFromBytes(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return Buffer.from(value as Uint8Array).toString('utf8');
}

function renderReaderContent(template: ReaderSiteTemplate, input: string, output: string): { ok: boolean; stdout: string; error?: string } {
  const repoRoot = repoRootFromOsPackage();
  const renderProcess = Bun.spawnSync(['bun', 'run', 'wiki:render', '--', '--template', template, '--input', input, '--out', output], { cwd: repoRoot, stdout: 'pipe', stderr: 'pipe' });
  const stdout = textFromBytes(renderProcess.stdout).trim();
  const stderr = textFromBytes(renderProcess.stderr).trim();
  return { ok: renderProcess.exitCode === 0 && fs.existsSync(output), stdout, error: stderr || stdout || `wiki:render exited with ${renderProcess.exitCode}` };
}

function firstSitesSubcommand(args: readonly string[]): string {
  return args.find((arg) => !arg.startsWith('-')) ?? 'status';
}

function runtimePathsForHome(home?: string): { home: string; dbPath: string } {
  if (home) return { home, dbPath: path.join(home, 'consuelo.db') };
  const paths = getRuntimePaths();
  return { home: paths.home, dbPath: paths.dbPath };
}

function readGeneratedOfficeSiteData(dataPath: string): GeneratedOfficeSiteData | null {
  if (!fs.existsSync(dataPath)) return null;
  const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed as GeneratedOfficeSiteData;
}


function workspaceHostForSites(home: string): string | null {
  const config = loadOsConfig(home);
  return config?.workspace?.host ?? config?.security?.gateway?.workspaceHost ?? null;
}

function sitesStatusResult(command: string, home: string, dbPath: string): SitesCommandResult {
  const sitesPaths = getSitesPaths(home);
  const generated = readGeneratedOfficeSiteData(sitesPaths.officeDataPath);
  const currentData = generated ?? readOfficeSiteData(dbPath);
  const artifacts = Array.isArray(currentData.artifacts) ? currentData.artifacts.length : 0;
  return {
    ok: true,
    command,
    home,
    sitesDir: sitesPaths.sitesDir,
    indexPath: sitesPaths.indexPath,
    pagesDir: sitesPaths.pagesDir,
    pagesRegistryPath: sitesPaths.pagesRegistryPath,
    officeIndexPath: sitesPaths.officeIndexPath,
    officeDataPath: sitesPaths.officeDataPath,
    officeAssetsDir: sitesPaths.officeAssetsDir,
    tracesIndexPath: sitesPaths.tracesIndexPath,
    diffsIndexPath: sitesPaths.diffsIndexPath,
    docsIndexPath: sitesPaths.docsIndexPath,
    url: pathToFileURL(sitesPaths.indexPath).href,
    artifacts,
    generatedAt: typeof currentData.generatedAt === 'string' ? currentData.generatedAt : null,
    indexExists: fs.existsSync(sitesPaths.indexPath),
    officeIndexExists: fs.existsSync(sitesPaths.officeIndexPath),
    officeDataExists: fs.existsSync(sitesPaths.officeDataPath),
    tracesIndexExists: fs.existsSync(sitesPaths.tracesIndexPath),
    diffsIndexExists: fs.existsSync(sitesPaths.diffsIndexPath),
    docsIndexExists: fs.existsSync(sitesPaths.docsIndexPath),
    message: `Sites index: ${sitesPaths.indexPath}`,
  };
}

export async function runSitesCommand(
  args: readonly string[],
  options: RunSitesCommandOptions = {},
): Promise<SitesCommandResult> {
  const command = firstSitesSubcommand(args);
  const paths = runtimePathsForHome(options.home);

  if (command === 'path') return sitesStatusResult(command, paths.home, paths.dbPath);
  if (command === 'status') return sitesStatusResult(command, paths.home, paths.dbPath);

  if (command === 'refresh') {
    const result = materializeSites({
      home: paths.home,
      dbPath: paths.dbPath,
      dryRun: hasFlag(args, '--dry-run'),
      workspaceHost: workspaceHostForSites(paths.home),
    });
    return {
      ...sitesStatusResult(command, paths.home, paths.dbPath),
      artifacts: result.data.artifacts.length,
      generatedAt: result.data.generatedAt,
      actions: result.actions,
      message: `Sites refreshed: ${result.indexPath}`,
    };
  }

  if (command === 'render') {
    const templateValue = readFlagValue(args, '--template');
    const template = readerSiteTemplate(templateValue);
    const input = readFlagValue(args, '--input');
    const output = readFlagValue(args, '--out');
    const status = sitesStatusResult(command, paths.home, paths.dbPath);
    if (!template || !input || !output) {
      return {
        ...status,
        ok: false,
        renderTemplate: template ?? undefined,
        inputPath: input ?? undefined,
        outputPath: output ?? undefined,
        rendered: false,
        error: { code: 'INVALID_SITES_RENDER_ARGS', message: 'sites render requires --template <spec|plan|guide>, --input, and --out' },
        message: 'Invalid Sites render arguments.',
      };
    }

    const repoRoot = repoRootFromOsPackage();
    const renderProcess = Bun.spawnSync([
      'bun',
      'run',
      'wiki:render',
      '--',
      '--template',
      template,
      '--input',
      input,
      '--out',
      output,
    ], { cwd: repoRoot, stdout: 'pipe', stderr: 'pipe' });
    const stdout = textFromBytes(renderProcess.stdout).trim();
    const stderr = textFromBytes(renderProcess.stderr).trim();
    const rendered = fs.existsSync(output);
    const ok = renderProcess.exitCode === 0 && rendered;
    return {
      ...status,
      ok,
      pageKind: template,
      renderTemplate: template,
      inputPath: input,
      outputPath: output,
      rendered,
      rendererStdout: stdout || undefined,
      message: ok ? `Sites reader page rendered: ${output}` : 'Sites reader render failed.',
      error: ok ? undefined : { code: 'SITES_RENDER_FAILED', message: stderr || stdout || `wiki:render exited with ${renderProcess.exitCode}` },
    };
  }


  if (command === 'patch') {
    const pagePath = readFlagValue(args, '--page') ?? readFlagValue(args, '--path');
    const sectionId = readFlagValue(args, '--section');
    const input = readFlagValue(args, '--input');
    const agentId = readFlagValue(args, '--agent');
    const status = sitesStatusResult(command, paths.home, paths.dbPath);
    if (!pagePath || !sectionId || !input) return { ...status, ok: false, error: { code: 'INVALID_SITES_PATCH_ARGS', message: 'sites patch requires --page, --section, and --input' }, message: 'Invalid Sites patch arguments.' };
    const prepared = prepareSitePagePatch({ home: paths.home, pagePath, sectionId, input, baseVersion: readFlagValue(args, '--base-version') ?? readFlagValue(args, '--base-revision'), forcePublish: hasFlag(args, '--force-publish'), agentId });
    if (!prepared.ok) return { ...status, ok: false, pageId: prepared.pageId, pagePath: prepared.path, sectionId: prepared.sectionId, currentVersionId: prepared.currentVersionId, requiredBaseVersion: prepared.currentVersionId, rebased: prepared.rebased, error: prepared.error, message: prepared.message };
    const template = readerSiteTemplate(prepared.kind);
    let renderResult: { ok: boolean; stdout: string; error?: string } | null = null;
    if (template) {
      renderResult = renderReaderContent(template, prepared.contentPath, path.join(prepared.stagedTarget, 'index.html'));
      if (!renderResult.ok) return { ...status, ok: false, pageId: prepared.pageId, pagePath: prepared.path, pageKind: prepared.kind ?? undefined, sectionId: prepared.sectionId, currentVersionId: prepared.currentVersionId, requiredBaseVersion: prepared.currentVersionId, rebased: prepared.rebased, stagedTarget: prepared.stagedTarget, contentPath: prepared.contentPath, rendered: false, error: { code: 'SITES_PATCH_RENDER_FAILED', message: renderResult.error ?? 'wiki:render failed' }, message: 'Sites patch render failed.' };
    }
    const result = publishSitePage({ home: paths.home, dbPath: paths.dbPath, target: prepared.stagedTarget, pagePath, title: prepared.title ?? prepared.pageId, kind: prepared.kind ?? 'uncategorized', baseVersion: prepared.currentVersionId, forcePublish: hasFlag(args, '--force-publish'), agentId, changedSectionIds: [prepared.sectionId] });
    return { ...status, ok: result.ok, pageId: result.pageId, pagePath: result.path, pageTitle: result.title, pageKind: result.kind, sectionId: prepared.sectionId, currentVersionId: result.currentVersionId, publishedVersionId: result.publishedVersionId, requiredBaseVersion: result.requiredBaseVersion, versionCount: result.versionCount, currentPath: result.currentPath, versionPath: result.versionPath, rebased: prepared.rebased, stagedTarget: prepared.stagedTarget, contentPath: prepared.contentPath, rendered: renderResult ? renderResult.ok : undefined, rendererStdout: renderResult?.stdout || undefined, message: result.ok ? `Sites section patched: ${prepared.path}#${prepared.sectionId}` : result.message, error: result.error };
  }

  if (command === 'lease') {
    const action = args.find((arg, index) => index > 0 && !arg.startsWith('-')) ?? 'status';
    const pagePath = readFlagValue(args, '--page') ?? readFlagValue(args, '--path');
    const sectionId = readFlagValue(args, '--section');
    const agentId = readFlagValue(args, '--agent');
    const status = sitesStatusResult(command, paths.home, paths.dbPath);
    if (action === 'status') {
      const result = sitePageLeaseStatus({ home: paths.home, pagePath, sectionId });
      return { ...status, ok: result.ok, pageId: result.pageId, sectionId: result.sectionId ?? undefined, agentId: result.agentId, leaseAction: result.leaseAction, leasesPath: result.leasesPath, leases: result.leases, message: result.message, error: result.error };
    }
    if (!pagePath || !sectionId) return { ...status, ok: false, error: { code: 'INVALID_SITES_LEASE_ARGS', message: 'sites lease requires --page and --section for acquire/release' }, message: 'Invalid Sites lease arguments.' };
    if (action === 'acquire') {
      if (!agentId) return { ...status, ok: false, pageId: pagePath, sectionId, error: { code: 'INVALID_SITES_LEASE_ARGS', message: 'sites lease acquire requires --agent' }, message: 'Invalid Sites lease arguments.' };
      const ttl = Number(readFlagValue(args, '--ttl-minutes') ?? '45');
      const result = acquireSitePageLease({ home: paths.home, pagePath, sectionId, agentId, ttlMinutes: Number.isFinite(ttl) ? ttl : 45 });
      return { ...status, ok: result.ok, pageId: result.pageId, sectionId: result.sectionId ?? undefined, agentId: result.agentId, leaseAction: result.leaseAction, leasesPath: result.leasesPath, leases: result.leases, message: result.message, error: result.error };
    }
    if (action === 'release') {
      const result = releaseSitePageLease({ home: paths.home, pagePath, sectionId, agentId, force: hasFlag(args, '--force-publish') });
      return { ...status, ok: result.ok, pageId: result.pageId, sectionId: result.sectionId ?? undefined, agentId: result.agentId, leaseAction: result.leaseAction, leasesPath: result.leasesPath, leases: result.leases, message: result.message, error: result.error };
    }
    return { ...status, ok: false, error: { code: 'INVALID_SITES_LEASE_ACTION', message: `Unsupported sites lease action: ${action}` }, message: 'Invalid Sites lease action.' };
  }

  if (command === 'publish') {
    const target = readFlagValue(args, '--target');
    const pagePath = readFlagValue(args, '--path');
    const title = readFlagValue(args, '--title') ?? readFlagValue(args, '--name');
    if (!target || !pagePath || !title) {
      return {
        ...sitesStatusResult(command, paths.home, paths.dbPath),
        ok: false,
        error: { code: 'INVALID_SITES_PUBLISH_ARGS', message: 'sites publish requires --target, --path, and --title or --name' },
        message: 'Invalid Sites publish arguments.',
      };
    }
    let kind: SitePageKind;
    try {
      kind = sitePageKind(readFlagValue(args, '--kind'));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ...sitesStatusResult(command, paths.home, paths.dbPath),
        ok: false,
        error: { code: 'INVALID_SITES_PUBLISH_KIND', message },
        message: 'Invalid Sites publish arguments.',
      };
    }
    const result = publishSitePage({
      home: paths.home,
      dbPath: paths.dbPath,
      target,
      pagePath,
      title,
      kind,
      baseVersion: readFlagValue(args, '--base-version') ?? readFlagValue(args, '--base-revision'),
      forcePublish: hasFlag(args, '--force-publish'),
      dryRun: hasFlag(args, '--dry-run'),
      agentId: readFlagValue(args, '--agent'),
      traceId: readFlagValue(args, '--trace'),
      changedSectionIds: (readFlagValue(args, '--sections') ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    });
    return {
      ...sitesStatusResult(command, paths.home, paths.dbPath),
      ok: result.ok,
      pageId: result.pageId,
      pagePath: result.path,
      pageTitle: result.title,
      pageKind: result.kind,
      currentVersionId: result.currentVersionId,
      publishedVersionId: result.publishedVersionId,
      requiredBaseVersion: result.requiredBaseVersion,
      versionCount: result.versionCount,
      pagesRegistryPath: result.registryPath,
      currentPath: result.currentPath,
      versionPath: result.versionPath,
      message: result.message,
      error: result.error,
    };
  }

  if (command === 'open') {
    const result = materializeSites({ home: paths.home, dbPath: paths.dbPath, dryRun: false, workspaceHost: workspaceHostForSites(paths.home) });
    if (options.openUrl !== false) {
      const openProcess = Bun.spawn(['open', result.indexPath], {
        stdout: 'ignore',
        stderr: 'pipe',
      });
      const exitCode = await openProcess.exited;
      if (exitCode !== 0) {
        const errorText = await new Response(openProcess.stderr).text();
        return {
          ...sitesStatusResult(command, paths.home, paths.dbPath),
          ok: false,
          error: { code: 'OPEN_FAILED', message: errorText.trim() || 'open command failed' },
          message: `Sites open failed: ${result.indexPath}`,
        };
      }
    }
    return {
      ...sitesStatusResult(command, paths.home, paths.dbPath),
      artifacts: result.data.artifacts.length,
      generatedAt: result.data.generatedAt,
      actions: result.actions,
      message: `Sites opened: ${result.indexPath}`,
    };
  }

  return {
    ...sitesStatusResult(command, paths.home, paths.dbPath),
    ok: false,
    error: {
      code: 'UNKNOWN_SITES_COMMAND',
      message: `Unknown sites command: ${command}`,
    },
    message: 'Unknown Sites command.',
  };
}

export async function runOfficeCommand(
  args: readonly string[],
  options: RunOfficeCommandOptions = {},
): Promise<OfficeCommandResult> {
  return runSitesCommand(args, options);
}

function renderSitesCommandResult(result: SitesCommandResult): string {
  return [
    result.message,
    `Path: ${result.indexPath}`,
    `Office: ${result.officeIndexPath}`,
    `URL: ${result.url}`,
    `Artifacts: ${result.artifacts}`,
  ].join('\n');
}

function renderOfficeCommandResult(result: OfficeCommandResult): string {
  return renderSitesCommandResult(result);
}
export function getSteering(): string {
  const runtimePaths = ensureRuntimePaths();
  const sections = [
    '# Consuelo OS runtime context',
    '',
    '## Runtime identity',
    '',
    '```json',
    safeJson(envPresence()),
    '```',
  ];

  for (const file of readSteeringMarkdownFiles(localSteeringDir(runtimePaths.home))) {
    sections.push('', `# ${file.name}`, '', file.content);
  }

  sections.push(
    '',
    '# tool discovery routing',
    '',
    'Use core tools directly when present. Use tools.search when a tool, provider, deployment surface, product area, or workflow is mentioned but is not in core steering.',
    '',
    '# raw core tool manifest',
    '',
    '```json',
    renderManifestForSteering(readCoreToolManifest()),
    '```',
  );
  return sections.join('\n');
}


const STEERING_GUARD_WINDOW_MS = Number.parseInt(
  process.env.CONSUELO_OS_STEERING_GUARD_WINDOW_MS ?? '300000',
  10,
);
const STEERING_FORCE_WINDOW_MS = Number.parseInt(
  process.env.CONSUELO_OS_STEERING_FORCE_WINDOW_MS ?? '300000',
  10,
);

type SteeringGuardDecision =
  | 'full'
  | 'soft_guard'
  | 'hard_guard'
  | 'cooldown'
  | 'forced_refresh'
  | 'refresh_rate_limited'
  | 'reason_required';

type SteeringGuardOptions = {
  callerKey?: string;
  now?: () => number;
};

function steeringNow(options: SteeringGuardOptions): number {
  return options.now ? options.now() : Date.now();
}

function steeringCallerKey(options: SteeringGuardOptions): string {
  const raw = [
    options.callerKey,
    process.env.CONSUELO_OS_STEERING_CALLER_KEY,
    process.env.CONSUELO_AGENT_RUN_ID,
    process.env.MCP_SESSION_ID,
    process.env.CLAUDE_CODE_SESSION_ID,
    `process:${process.pid}`,
  ].filter((value): value is string => Boolean(value)).join('|');
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

function recordStarted(traceId: string, name: string, input: unknown): void {
  recordExecutionStarted({ traceId, name, input });
}

function finishSteeringExecution(args: {
  traceId: string;
  name: string;
  started: number;
  steering: string;
  decision: SteeringGuardDecision;
  code: string;
  reason?: string;
}): void {
  const durationMs = Date.now() - args.started;
  const result: Record<string, unknown> = {
    chars: args.steering.length,
    estimatedOutputTokens: Math.max(1, Math.floor(args.steering.length / 4)),
    content: args.steering,
    decision: args.decision,
  };
  if (args.reason !== undefined) result.reason = args.reason;
  recordExecutionFinished({
    traceId: args.traceId,
    status: 'succeeded',
    output: {
      ok: true,
      name: args.name,
      permission: 'read',
      traceId: args.traceId,
      durationMs,
      result,
      code: args.code,
    },
    durationMs,
  });
}

function getSteeringGuardDecision(
  callerKey: string,
  traceId: string,
  options: SteeringGuardOptions,
): { decision: SteeringGuardDecision; attempt: number } {
  const nowMs = steeringNow(options);
  const prior = readSteeringGuardDecisions({
    callerKey,
    tool: 'get_steering',
    windowMs: STEERING_GUARD_WINDOW_MS,
    nowMs,
  });
  const decision: SteeringGuardDecision = prior.length === 0
    ? 'full'
    : prior.length === 1
      ? 'soft_guard'
      : prior.length === 2
        ? 'hard_guard'
        : 'cooldown';
  recordSteeringGuardEvent({
    traceId,
    callerKey,
    tool: 'get_steering',
    decision,
    nowMs,
  });
  return { decision, attempt: prior.length + 1 };
}

function getRefreshGuardDecision(
  callerKey: string,
  traceId: string,
  reason: string,
  options: SteeringGuardOptions,
): { decision: SteeringGuardDecision; attempt: number } {
  const nowMs = steeringNow(options);
  const prior = readSteeringGuardDecisions({
    callerKey,
    tool: 'refresh_steering',
    windowMs: STEERING_FORCE_WINDOW_MS,
    nowMs,
  });
  const decision: SteeringGuardDecision = prior.length === 0
    ? 'forced_refresh'
    : 'refresh_rate_limited';
  recordSteeringGuardEvent({
    traceId,
    callerKey,
    tool: 'refresh_steering',
    decision,
    reason,
    nowMs,
  });
  return { decision, attempt: prior.length + 1 };
}

function steeringGuardMessage(decision: SteeringGuardDecision, attempt: number): string {
  if (decision === 'soft_guard') {
    return `GET_STEERING_LOOP_GUARD

You already received full OS steering very recently in this pre-task bootstrap context.
Do not call get_steering again unless you are intentionally refreshing bootstrap context.

Read only the specific file you need:
- $CONSUELO_HOME/steering/system_prompt.md
- $CONSUELO_HOME/steering/decision.md
- packages/os/manifests/core.manifest.json

Useful alternatives:
- fs.read for exact files
- context.search for repo/project context
- tools.search for tool discovery

If you truly need a fresh full steering snapshot, call refresh_steering with a concrete reason.
Attempt in current window: ${attempt}
`;
  }
  if (decision === 'hard_guard') {
    return `GET_STEERING_RATE_LIMITED

Repeated get_steering calls look like a bootstrap loop. Full steering is withheld for this attempt.
Continue with existing steering context or call refresh_steering with a concrete reason.
Attempt in current window: ${attempt}
`;
  }
  return `GET_STEERING_COOLDOWN

Full steering is temporarily blocked because this caller repeatedly called get_steering in a short window.
Use targeted file reads or search instead of retrying get_steering.
Attempt in current window: ${attempt}
`;
}

function refreshSteeringMessage(decision: SteeringGuardDecision, attempt: number): string {
  if (decision === 'reason_required') {
    return 'REFRESH_STEERING_REASON_REQUIRED\n\nrefresh_steering requires a concrete reason. Do not call it just to retry get_steering.\n';
  }
  return `REFRESH_STEERING_RATE_LIMITED

refresh_steering was already used recently for this caller.
Continue with existing context or targeted file reads. Attempt in current window: ${attempt}
`;
}

export function executeGetSteering(
  buildSteering: () => string = getSteering,
  options: SteeringGuardOptions = {},
): string {
  ensureRuntimePaths();
  const started = Date.now();
  const traceId = createTraceId();
  recordStarted(traceId, 'get_steering', {});

  try {
    const callerKey = steeringCallerKey(options);
    const { decision, attempt } = getSteeringGuardDecision(callerKey, traceId, options);
    if (decision !== 'full') {
      const steering = steeringGuardMessage(decision, attempt);
      const code = decision === 'soft_guard'
        ? 'STEERING_LOOP_GUARD'
        : decision === 'hard_guard'
          ? 'STEERING_RATE_LIMITED'
          : 'STEERING_COOLDOWN';
      finishSteeringExecution({
        traceId,
        name: 'get_steering',
        started,
        steering,
        decision,
        code,
      });
      return steering;
    }

    const steering = buildSteering();
    finishSteeringExecution({
      traceId,
      name: 'get_steering',
      started,
      steering,
      decision: 'full',
      code: 'OK',
    });
    return steering;
  } catch (error: unknown) {
    const durationMs = Date.now() - started;
    recordExecutionFinished({
      traceId,
      status: 'failed',
      errorCode: 'BOOTSTRAP_FAILED',
      errorMessage: error instanceof Error ? error.message : 'OS bootstrap failed.',
      durationMs,
    });
    throw error;
  }
}

export function executeRefreshSteering(
  reason: string,
  buildSteering: () => string = getSteering,
  options: SteeringGuardOptions = {},
): string {
  ensureRuntimePaths();
  const started = Date.now();
  const traceId = createTraceId();
  const normalizedReason = reason.trim();
  recordStarted(traceId, 'refresh_steering', { reason: normalizedReason });

  try {
    if (!normalizedReason) {
      const steering = refreshSteeringMessage('reason_required', 1);
      finishSteeringExecution({
        traceId,
        name: 'refresh_steering',
        started,
        steering,
        decision: 'reason_required',
        code: 'REFRESH_REASON_REQUIRED',
        reason: '',
      });
      return steering;
    }

    const callerKey = steeringCallerKey(options);
    const { decision, attempt } = getRefreshGuardDecision(callerKey, traceId, normalizedReason, options);
    if (decision !== 'forced_refresh') {
      const steering = refreshSteeringMessage(decision, attempt);
      finishSteeringExecution({
        traceId,
        name: 'refresh_steering',
        started,
        steering,
        decision,
        code: 'REFRESH_RATE_LIMITED',
        reason: normalizedReason,
      });
      return steering;
    }

    const steering = buildSteering();
    finishSteeringExecution({
      traceId,
      name: 'refresh_steering',
      started,
      steering,
      decision: 'forced_refresh',
      code: 'OK',
      reason: normalizedReason,
    });
    return steering;
  } catch (error: unknown) {
    const durationMs = Date.now() - started;
    recordExecutionFinished({
      traceId,
      status: 'failed',
      errorCode: 'REFRESH_STEERING_FAILED',
      errorMessage: error instanceof Error ? error.message : 'OS steering refresh failed.',
      durationMs,
    });
    throw error;
  }
}

export function getRawSteering(): string {
  ensureRuntimePaths();
  const packageRoot = getPackageRoot();
  const sections = [
    '# Consuelo OS raw/operator steering',
    '',
    'This surface is for build, design, deployment, debugging, and internal operator agents.',
    'It intentionally preserves the proven workspace steering pattern so OS capabilities can be repurposed instead of rebuilt.',
    'Use this context for landing pages, Office, GitHub, auth, deployment, file workflows, and operator/debug tasks.',
    '',
  ];
  const devSteering = readIfExists(path.join(packageRoot, 'steering', 'system_prompt.md'));
  if (devSteering)
    sections.push('# bundled OS system_prompt.md', '', devSteering);
  const decision = readIfExists(path.join(packageRoot, 'steering', 'decision.md'));
  if (decision)
    sections.push('', '# bundled OS decision.md', '', decision);
  const manifest = readIfExists(
    path.join(packageRoot, 'manifests', 'tool.manifest.json'),
  );
  if (manifest)
    sections.push(
      '',
      '# canonical full tool manifest',
      '',
      '```json',
      renderManifestTextForSteering(manifest),
      '```',
    );
  return sections.join('\n');
}

function notFound(name: string): CallOutput {
  return {
    ok: false,
    name,
    permission: 'read',
    error: {
      code: 'SKILL_NOT_FOUND',
      message: `Skill "${name}" is not defined in the manifest.`,
    },
  };
}

async function runSkill(callInput: CallInput): Promise<CallOutput> {
  const entry = findManifestEntry(callInput.name);
  if (!entry) return notFound(callInput.name);

  const guardrailIssues = validateManifestGuardrails([entry]);
  if (guardrailIssues.length > 0) {
    return {
      ok: false,
      name: entry.name,
      permission: entry.permission,
      requiresApproval: entry.requiresApproval,
      error: {
        code: 'SKILL_GUARDRAIL_BLOCKED',
        message:
          guardrailIssues[0]?.message ??
          'Skill failed OS guardrail validation.',
        details: guardrailIssues,
      },
    };
  }

  if (entry.requiresApproval) {
    return {
      ok: false,
      name: entry.name,
      permission: entry.permission,
      requiresApproval: true,
      error: {
        code: 'APPROVAL_REQUIRED',
        message: `Skill "${entry.name}" requires explicit approval before execution.`,
      },
    };
  }

  if (entry.name === 'get_raw_steering') {
    return {
      ok: true,
      name: entry.name,
      permission: entry.permission,
      requiresApproval: entry.requiresApproval,
      result: { steering: getRawSteering() },
    };
  }

  const context: SkillContext = {
    traceId: callInput.traceId ?? createTraceId(),
    workspaceId: callInput.workspaceId ?? process.env.CONSUELO_WORKSPACE_ID,
    userId: callInput.userId ?? process.env.CONSUELO_USER_ID,
    manifestEntry: entry,
  };
  if (entry.name === 'daily-revenue-brief') {
    try {
      const { runDailyRevenueBrief } =
        await import('./revenue/daily-revenue-brief');
      return await runDailyRevenueBrief(callInput.input ?? {}, context);
    } catch (error: unknown) {
      return {
        ok: false,
        name: entry.name,
        permission: entry.permission,
        requiresApproval: entry.requiresApproval,
        error: {
          code: 'SKILL_EXECUTION_FAILED',
          message:
            error instanceof Error
              ? error.message.slice(0, 240)
              : 'Skill execution failed.',
        },
      };
    }
  }
  if (entry.name === 'consuelo-workspace-snapshot') {
    try {
      const { runConsueloWorkspaceSnapshot } =
        await import('./workspace/consuelo-workspace-snapshot');
      return await runConsueloWorkspaceSnapshot(callInput.input ?? {}, context);
    } catch (error: unknown) {
      return {
        ok: false,
        name: entry.name,
        permission: entry.permission,
        requiresApproval: entry.requiresApproval,
        error: {
          code: 'SKILL_EXECUTION_FAILED',
          message:
            error instanceof Error
              ? error.message.slice(0, 240)
              : 'Skill execution failed.',
        },
      };
    }
  }
  if (entry.name === 'office') {
    try {
      const { runOffice } = await import('./design/office');
      return await runOffice(callInput.input ?? {}, context);
    } catch (error: unknown) {
      return {
        ok: false,
        name: entry.name,
        permission: entry.permission,
        requiresApproval: entry.requiresApproval,
        error: {
          code: 'SKILL_EXECUTION_FAILED',
          message:
            error instanceof Error
              ? error.message.slice(0, 240)
              : 'Skill execution failed.',
        },
      };
    }
  }
  if (entry.name === 'office-landing-page') {
    try {
      const { runOfficeLandingPage } =
        await import('./design/office-landing-page');
      return await runOfficeLandingPage(callInput.input ?? {}, context);
    } catch (error: unknown) {
      return {
        ok: false,
        name: entry.name,
        permission: entry.permission,
        requiresApproval: entry.requiresApproval,
        error: {
          code: 'SKILL_EXECUTION_FAILED',
          message:
            error instanceof Error
              ? error.message.slice(0, 240)
              : 'Skill execution failed.',
        },
      };
    }
  }


  return {
    ok: false,
    name: entry.name,
    permission: entry.permission,
    requiresApproval: entry.requiresApproval,
    error: {
      code: 'SKILL_NOT_IMPLEMENTED',
      message: `Skill "${entry.name}" is declared but has no runner yet.`,
    },
  };
}

export async function executeCall(callInput: CallInput): Promise<CallOutput> {
  ensureRuntimePaths();
  const started = Date.now();
  const traceId = callInput.traceId ?? createTraceId();
  const workspaceId =
    callInput.workspaceId ?? process.env.CONSUELO_WORKSPACE_ID;
  const userId = callInput.userId ?? process.env.CONSUELO_USER_ID;

  const materialDecision = assessDangerousMaterial({
    source: 'executeCall decoded-input',
    value: callInput,
  });
  if (!materialDecision.allowed) {
    return {
      ok: false,
      name: callInput.name,
      permission: 'admin',
      traceId,
      durationMs: Date.now() - started,
      error: dangerousMaterialError(materialDecision),
    };
  }

  recordExecutionStarted({
    traceId,
    name: callInput.name,
    workspaceId,
    userId,
    input: callInput.input,
  });

  try {
    const output = await runSkill({
      ...callInput,
      traceId,
      workspaceId,
      userId,
    });
    output.traceId = traceId;
    output.durationMs = Date.now() - started;
    recordExecutionFinished({
      traceId,
      status: output.ok ? 'succeeded' : 'failed',
      output,
      durationMs: output.durationMs,
    });
    return output;
  } catch (error: unknown) {
    const output: CallOutput = {
      ok: false,
      name: callInput.name,
      permission: 'read',
      traceId,
      durationMs: Date.now() - started,
      error: {
        code: 'CALL_FAILED',
        message:
          error instanceof Error
            ? error.message.slice(0, 240)
            : 'OS call failed.',
      },
    };
    recordExecutionFinished({
      traceId,
      status: 'failed',
      output,
      durationMs: output.durationMs ?? Date.now() - started,
    });
    return output;
  }
}

export function parseCallInput(rawInput: string | undefined): CallInput {
  if (!rawInput) {
    throw new Error('call requires JSON input');
  }
  const parsed = JSON.parse(rawInput) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('call input must be an object');
  }
  const input = parsed as Partial<CallInput>;
  if (!input.name || typeof input.name !== 'string') {
    throw new Error('call input requires name');
  }
  return input as CallInput;
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(1);
  const cliArgs = rawArgs[0]?.endsWith('os.ts') || rawArgs[0]?.endsWith('/os.ts')
    ? rawArgs.slice(1)
    : rawArgs;
  const [command, ...args] = cliArgs;
  const rawInput = args[0];

  if (command === 'get-steering') {
    writeStdout(executeGetSteering());
    return;
  }

  if (command === 'refresh-steering') {
    writeStdout(executeRefreshSteering(rawInput ?? ''));
    return;
  }

  if (command === 'get-raw-steering') {
    writeStdout(getRawSteering());
    return;
  }

  if (command === 'sites' || command === 'office') {
    try {
      const result = command === 'office'
        ? await runOfficeCommand(args)
        : await runSitesCommand(args);
      if (hasFlag(args, '--json')) writeStdout(`${safeJson(result)}
`);
      else writeStdout(`${renderSitesCommandResult(result)}
`);
      if (!result.ok) process.exitCode = 1;
    } catch (error: unknown) {
      writeStderr(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    return;
  }

  if (command === 'call') {
    try {
      const result = await executeCall(parseCallInput(rawInput));
      writeStdout(`${safeJson(result)}\n`);
      if (!result.ok) process.exitCode = 1;
    } catch (error: unknown) {
      writeStderr(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    return;
  }

  writeStdout(
    [
      'usage:',
      '  bun ./scripts/os.ts get-steering',
      '  bun ./scripts/os.ts get-raw-steering',
      '  bun ./scripts/os.ts sites path [--json]',
      '  bun ./scripts/os.ts sites status [--json]',
      '  bun ./scripts/os.ts sites refresh [--json]',
      '  bun ./scripts/os.ts sites open [--json]',
      '  bun ./scripts/os.ts sites publish --target <dir-or-file> --path /pages/<slug> --title <title> [--kind spec|plan|guide|trace|diff|office|uncategorized] [--base-version <id>] [--force-publish] [--json]',
      '  bun ./scripts/os.ts sites patch --page <slug> --section <id> --input <section.json> --base-version <id> [--agent <id>] [--json]',
      '  bun ./scripts/os.ts sites lease acquire|status|release --page <slug> --section <id> [--agent <id>] [--ttl-minutes 45] [--json]',
      '  bun ./scripts/os.ts call \'{"name":"daily-revenue-brief"}\'',
      '',
    ].join('\n'),
  );
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    writeStderr(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
