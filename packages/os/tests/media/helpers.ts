import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect } from 'vitest';

export const packageRoot = resolve(import.meta.dirname, '../..');
export const repoRoot = resolve(packageRoot, '../..');

export const expectedMediaToolNames = [
  'media.doctor',
  'media.install',
  'media.probe',
  'media.ingest',
  'media.clip.search',
  'media.transcribe',
  'media.audio.extract',
  'media.audio.normalize',
  'media.frames.extract',
  'media.scene.detect',
  'media.motion.track',
  'media.object.track',
  'media.camera.motion',
  'media.pose.estimate',
  'media.angle.measure',
  'media.sports-science.metrics',
  'media.breakdown.plan',
  'media.timeline.validate',
  'media.overlay.render',
  'media.compose',
  'media.qa',
  'media.export',
  'media.svg.convert',
] as const;

export const expectedCoreToolNames = [
  'media.doctor',
  'media.probe',
  'media.frames.extract',
  'media.timeline.validate',
  'media.compose',
  'media.qa',
] as const;

export const expectedProfiles = [
  'media-core',
  'media-youtube',
  'media-audio',
  'media-vision-light',
  'media-vision-pose',
  'media-render-advanced',
] as const;

export const expectedSchemaKinds = [
  'media.asset.v1',
  'media.timeline.v1',
  'media.render-result.v1',
  'media.dependency-report.v1',
  'media.ingest-manifest.v1',
  'media.frame-manifest.v1',
  'media.transcript.v1',
  'media.pose-track.v1',
  'media.motion-track.v1',
  'media.overlay.v1',
  'media.breakdown-plan.v1',
  'media.export-package.v1',
  'media.svg-result.v1',
] as const;

type JsonObject = Record<string, unknown>;
type ParseResult = { success: boolean; error?: unknown };
type SchemaLike = {
  safeParse?: (value: unknown) => ParseResult;
  parse?: (value: unknown) => unknown;
};

export type ManifestTool = {
  name: string;
  category?: string;
  methodPath?: string[];
  description?: string;
  underlying?: string;
  workflowRole?: string;
  inputSchema?: string;
  outputSchema?: string;
  requiredProfiles?: string[];
  requiredCommands?: string[];
  requiredDependencies?: string[];
  capabilities?: {
    readOnly?: boolean;
    mutating?: boolean;
    deterministic?: boolean;
    safeToRetry?: boolean;
  };
  command?: {
    script?: string;
    subcommand?: string;
    branchMode?: string;
    jsonFlag?: string;
    arguments?: Array<Record<string, unknown>>;
  };
};

export type GeneratedManifestTool = {
  name: string;
  kind?: string;
  core?: boolean;
  definition: ManifestTool;
};

export function absolutePath(relativePath: string): string {
  return join(packageRoot, relativePath);
}

export function repoRelativePath(path: string): string {
  return relative(repoRoot, path).split(/[\\/]/).join('/');
}

export function fileExists(relativePath: string): boolean {
  return existsSync(absolutePath(relativePath));
}

export function expectFile(relativePath: string): string {
  const path = absolutePath(relativePath);
  expect(existsSync(path), 'expected file to exist: ' + relativePath).toBe(true);
  return path;
}

export function readText(relativePath: string): string {
  return readFileSync(expectFile(relativePath), 'utf8');
}

export function readOptionalText(relativePath: string): string {
  const path = absolutePath(relativePath);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

export function readJson<T = unknown>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}

export function readPackageJson(): JsonObject {
  return readJson<JsonObject>('package.json');
}

export function readManifestArray(relativePath: string): ManifestTool[] {
  const value = readJson<unknown>(relativePath);
  expect(Array.isArray(value), relativePath + ' should be an array').toBe(true);
  return value as ManifestTool[];
}

export function readGeneratedManifest(relativePath: string): { tools: GeneratedManifestTool[] } {
  const value = readJson<{ tools?: unknown }>(relativePath);
  expect(Array.isArray(value.tools), relativePath + ' should contain tools array').toBe(true);
  return value as { tools: GeneratedManifestTool[] };
}

export function findSourceTool(tools: ManifestTool[], name: string): ManifestTool | undefined {
  return tools.find((tool) => tool.name === name);
}

export function findGeneratedTool(tools: GeneratedManifestTool[], name: string): GeneratedManifestTool | undefined {
  return tools.find((tool) => tool.name === name);
}

export function expectArrayContainsAll(actual: readonly string[], expected: readonly string[]): void {
  for (const item of expected) {
    expect(actual, 'expected array to contain ' + item).toContain(item);
  }
}

export async function importMediaModule(relativePath: string): Promise<Record<string, unknown>> {
  const path = expectFile(relativePath);
  try {
    return await import(pathToFileURL(path).href) as Record<string, unknown>;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error('failed to import media module ' + relativePath + ': ' + message);
  }
}

export function getExport(module: Record<string, unknown>, exportName: string): unknown {
  expect(module[exportName], 'missing export ' + exportName).toBeDefined();
  return module[exportName];
}

export function expectFunctionExport(module: Record<string, unknown>, exportName: string): void {
  expect(typeof module[exportName], 'expected function export ' + exportName).toBe('function');
}

export function expectSchemaAccepts(schema: unknown, value: unknown): void {
  const schemaLike = schema as SchemaLike;
  if (typeof schemaLike.safeParse === 'function') {
    const result = schemaLike.safeParse(value);
    expect(result.success, 'schema should accept valid value: ' + JSON.stringify(result.error)).toBe(true);
    return;
  }
  if (typeof schemaLike.parse === 'function') {
    expect(() => schemaLike.parse?.(value)).not.toThrow();
    return;
  }
  throw new Error('schema does not expose safeParse or parse');
}

export function expectSchemaRejects(schema: unknown, value: unknown): void {
  const schemaLike = schema as SchemaLike;
  if (typeof schemaLike.safeParse === 'function') {
    const result = schemaLike.safeParse(value);
    expect(result.success, 'schema should reject invalid value').toBe(false);
    return;
  }
  if (typeof schemaLike.parse === 'function') {
    expect(() => schemaLike.parse?.(value)).toThrow();
    return;
  }
  throw new Error('schema does not expose safeParse or parse');
}

export function runMediaCli(args: string[], options: { env?: Record<string, string>; timeoutMs?: number } = {}) {
  return spawnSync('bun', ['./scripts/media.ts', ...args], {
    cwd: packageRoot,
    encoding: 'utf8',
    timeout: options.timeoutMs ?? 30_000,
    env: { ...process.env, ...options.env },
  });
}

export function parseJsonStdout(stdout: string): JsonObject {
  try {
    return JSON.parse(stdout) as JsonObject;
  } catch (error: unknown) {
    throw new Error('stdout was not JSON: ' + String(error) + '\nstdout:\n' + stdout);
  }
}

export function expectJsonCliSuccess(args: string[], timeoutMs = 30_000): JsonObject {
  const result = runMediaCli(args, { timeoutMs });
  expect(result.status, 'command should exit 0: bun ./scripts/media.ts ' + args.join(' ') + '\nstderr:\n' + result.stderr).toBe(0);
  return parseJsonStdout(result.stdout);
}

export function hasCommand(command: string): boolean {
  const result = spawnSync('/usr/bin/env', ['which', command], { encoding: 'utf8' });
  return result.status === 0;
}

export function createTempDir(prefix: string): string {
  const path = join(tmpdir(), prefix + String(Date.now()) + '-' + Math.random().toString(16).slice(2));
  mkdirSync(path, { recursive: true });
  return path;
}

export function removeTempDir(path: string): void {
  if (path.includes('consuelo-media-test-')) {
    rmSync(path, { recursive: true, force: true });
  }
}

export function listRepoFiles(startRelativePath: string): string[] {
  const start = join(repoRoot, startRelativePath);
  if (!existsSync(start)) return [];
  const ignoredNames = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage']);
  const out: string[] = [];
  const visit = (path: string) => {
    const name = path.split(/[\\/]/).pop() ?? '';
    if (ignoredNames.has(name)) return;
    const stat = statSync(path);
    if (stat.isDirectory()) {
      for (const child of readdirSync(path)) visit(join(path, child));
      return;
    }
    out.push(repoRelativePath(path));
  };
  visit(start);
  return out;
}

export function readIfExistsRepo(relativePath: string): string {
  const path = join(repoRoot, relativePath);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

export function validAssetFixture(overrides: JsonObject = {}): JsonObject {
  return {
    schema: 'media.asset.v1',
    id: 'asset_fixture_001',
    source: {
      path: 'assets/source.mp4',
      provenance: {
        status: 'needs-review',
        url: 'https://youtube.com/watch?v=fixture',
        capturedAt: '2026-06-23T00:00:00.000Z',
      },
      rights: {
        status: 'needs-review',
        notes: 'Fixture clip requires human rights review.',
      },
    },
    probe: {
      durationSeconds: 45,
      width: 1920,
      height: 1080,
      fps: 30,
      videoCodec: 'h264',
      audioCodec: 'aac',
      streams: [],
    },
    toolVersions: { ffprobe: 'fixture-ffprobe' },
    ...overrides,
  };
}

export function validTimelineFixture(overrides: JsonObject = {}): JsonObject {
  return {
    schema: 'media.timeline.v1',
    id: 'timeline_fixture_001',
    assets: [validAssetFixture()],
    source: { assetId: 'asset_fixture_001', path: 'assets/source.mp4' },
    render: { width: 1080, height: 1920, fps: 30, format: 'mp4', durationSeconds: 45 },
    beats: [
      { id: 'beat_001', startSeconds: 12.4, endSeconds: 13.1, type: 'freeze', label: 'plant foot angle', reason: 'Visible force transfer.' },
      { id: 'beat_002', startSeconds: 13.1, endSeconds: 15.0, type: 'overlay', overlayId: 'overlay_001' },
    ],
    overlays: [
      { id: 'overlay_001', type: 'force-vector', startSeconds: 13.1, endSeconds: 15.0, data: { start: [420, 760], end: [610, 680], label: 'horizontal force' } },
    ],
    tracks: { captions: 'captions/en.vtt', voiceover: 'audio/voiceover.wav', music: null },
    provenance: { status: 'needs-review', sourceAssetId: 'asset_fixture_001' },
    ...overrides,
  };
}

export function validRenderResultFixture(overrides: JsonObject = {}): JsonObject {
  return {
    schema: 'media.render-result.v1',
    id: 'render_fixture_001',
    timelineId: 'timeline_fixture_001',
    output: { path: 'renders/final.mp4', durationSeconds: 45, width: 1080, height: 1920, codec: 'h264', fileSizeBytes: 4_000_000 },
    qa: { status: 'passed', checks: [{ name: 'duration', status: 'passed' }] },
    provenance: { status: 'needs-review', sourceAssetId: 'asset_fixture_001' },
    toolVersions: { ffmpeg: 'fixture-ffmpeg', ffprobe: 'fixture-ffprobe' },
    artifacts: [{ kind: 'preview', path: 'renders/final.mp4' }],
    ...overrides,
  };
}
