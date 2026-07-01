import { Effect } from 'effect';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';

import { MediaError } from './errors';
import { MediaSvgResultSchema } from './schema';

export const svgConvertStrategies = ['wrapper', 'trace', 'both', 'auto'] as const;

type SvgConvertStrategy = typeof svgConvertStrategies[number];
type JsonObject = Record<string, unknown>;

type ImageInfo = {
  mimeType: string;
  width: number;
  height: number;
};

type SvgConvertInput = {
  inputPath?: string;
  outPath?: string;
  strategy?: string;
  traceEngine?: string;
  optimize?: boolean;
};

type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

function stableId(prefix: string, value: unknown): string {
  return prefix + '_' + createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

function ensureParent(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function commandExists(command: string): boolean {
  const searchPath = process.env.PATH ?? '';
  for (const directory of searchPath.split(':')) {
    if (!directory) continue;
    if (existsSync(join(directory, command))) return true;
  }
  return false;
}

async function runCommand(command: string, args: string[]): Promise<CommandResult> {
  try {
    const proc = Bun.spawn([command, ...args], { stdout: 'pipe', stderr: 'pipe' });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { exitCode, stdout, stderr };
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

function parsePngInfo(buffer: Buffer): ImageInfo | undefined {
  const pngSignature = '89504e470d0a1a0a';
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== pngSignature) return undefined;
  return { mimeType: 'image/png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function parseJpegInfo(buffer: Buffer): ImageInfo | undefined {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) return undefined;
    const marker = buffer[offset + 1];
    if (marker === undefined) return undefined;
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) return undefined;
    if (marker >= 0xc0 && marker <= 0xc3) {
      if (offset + 9 > buffer.length) return undefined;
      return { mimeType: 'image/jpeg', height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return undefined;
}

export function inspectRasterImage(inputPath: string): ImageInfo {
  if (!existsSync(inputPath)) throw new MediaError('MEDIA_INPUT_MISSING', 'SVG input image does not exist: ' + inputPath, { inputPath });
  const buffer = readFileSync(inputPath);
  const info = parsePngInfo(buffer) ?? parseJpegInfo(buffer);
  if (info) return info;
  const extension = extname(inputPath).toLowerCase();
  throw new MediaError('MEDIA_VALIDATION_ERROR', 'Unsupported SVG conversion input type: ' + extension, { inputPath, extension });
}

export function buildWrapperSvg(inputPath: string): { svg: string; info: ImageInfo } {
  const info = inspectRasterImage(inputPath);
  const encoded = readFileSync(inputPath).toString('base64');
  const href = 'data:' + info.mimeType + ';base64,' + encoded;
  const svg = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + info.width + '" height="' + info.height + '" viewBox="0 0 ' + info.width + ' ' + info.height + '">',
    '  <image width="' + info.width + '" height="' + info.height + '" href="' + escapeXml(href) + '"/>',
    '</svg>',
    '',
  ].join('\n');
  return { svg, info };
}

async function writeWrapperSvg(inputPath: string, outPath: string): Promise<{ path: string; info: ImageInfo }> {
  const { svg, info } = buildWrapperSvg(inputPath);
  ensureParent(outPath);
  writeFileSync(outPath, svg);
  return { path: outPath, info };
}

async function traceWithVtracer(inputPath: string, outPath: string, required = false): Promise<string | undefined> {
  if (!commandExists('vtracer')) {
    if (required) {
      throw new MediaError('MEDIA_DEPENDENCY_MISSING', 'vtracer is required for color SVG tracing. Install it with: cargo install vtracer', { dependencyId: 'vtracer', installHint: 'cargo install vtracer' });
    }
    return undefined;
  }
  ensureParent(outPath);
  const result = await runCommand('vtracer', ['--input', inputPath, '--output', outPath]);
  if (result.exitCode !== 0) {
    throw new MediaError('MEDIA_VALIDATION_ERROR', 'vtracer failed to convert image to SVG', { stderr: result.stderr, exitCode: result.exitCode });
  }
  return 'vtracer';
}

async function traceWithPotrace(inputPath: string, outPath: string): Promise<string> {
  if (!commandExists('ffmpeg')) throw new MediaError('MEDIA_DEPENDENCY_MISSING', 'ffmpeg is required for SVG trace fallback', { dependencyId: 'ffmpeg' });
  if (!commandExists('potrace')) throw new MediaError('MEDIA_DEPENDENCY_MISSING', 'potrace is required for SVG trace fallback', { dependencyId: 'potrace' });
  ensureParent(outPath);
  const workDir = join(tmpdir(), 'consuelo-media-svg-' + createHash('sha256').update(inputPath + outPath + String(Date.now())).digest('hex').slice(0, 12));
  mkdirSync(workDir, { recursive: true });
  const pgmPath = join(workDir, 'trace.pgm');
  try {
    const ffmpeg = await runCommand('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-vf', 'format=gray', pgmPath]);
    if (ffmpeg.exitCode !== 0) {
      throw new MediaError('MEDIA_VALIDATION_ERROR', 'ffmpeg failed to preprocess image for SVG tracing', { stderr: ffmpeg.stderr, exitCode: ffmpeg.exitCode });
    }
    const potrace = await runCommand('potrace', [pgmPath, '-s', '-o', outPath]);
    if (potrace.exitCode !== 0) {
      throw new MediaError('MEDIA_VALIDATION_ERROR', 'potrace failed to trace image to SVG', { stderr: potrace.stderr, exitCode: potrace.exitCode });
    }
    return 'potrace';
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

type TraceEngine = 'auto' | 'color' | 'mono';

function normalizeTraceEngine(value: string | undefined): TraceEngine {
  if (value === undefined) return 'auto';
  if (value === 'color' || value === 'mono' || value === 'auto') return value;
  throw new MediaError('MEDIA_VALIDATION_ERROR', 'Unsupported SVG trace engine: ' + value, { traceEngine: value });
}

async function writeTracedSvg(inputPath: string, outPath: string, traceEngine: TraceEngine): Promise<{ path: string; tool: string; traceEngine: TraceEngine }> {
  try {
    if (traceEngine === 'color') {
      const tool = await traceWithVtracer(inputPath, outPath, true);
      return { path: outPath, tool: tool ?? 'vtracer', traceEngine: 'color' };
    }
    if (traceEngine === 'mono') {
      const tool = await traceWithPotrace(inputPath, outPath);
      return { path: outPath, tool, traceEngine: 'mono' };
    }
    const vtracerTool = await traceWithVtracer(inputPath, outPath);
    if (vtracerTool) return { path: outPath, tool: vtracerTool, traceEngine: 'color' };
    const tool = await traceWithPotrace(inputPath, outPath);
    return { path: outPath, tool, traceEngine: 'mono' };
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

function normalizeStrategy(value: string | undefined): Exclude<SvgConvertStrategy, 'auto'> {
  if (value === undefined || value === 'auto') return 'both';
  if (value === 'wrapper' || value === 'trace' || value === 'both') return value;
  throw new MediaError('MEDIA_VALIDATION_ERROR', 'Unsupported SVG conversion strategy: ' + value, { strategy: value });
}

function relatedPath(outPath: string, suffix: string): string {
  return outPath.toLowerCase().endsWith('.svg') ? outPath.slice(0, -4) + suffix + '.svg' : outPath + suffix + '.svg';
}

async function optimizeSvgPath(path: string): Promise<boolean> {
  if (!commandExists('svgo')) {
    throw new MediaError('MEDIA_DEPENDENCY_MISSING', 'svgo is required for SVG optimization. Install it with: brew install svgo', { dependencyId: 'svgo', installHint: 'brew install svgo' });
  }
  const first = await runCommand('svgo', ['--multipass', '--input', path, '--output', path]);
  if (first.exitCode === 0) return true;
  const second = await runCommand('svgo', ['--multipass', path, '--output', path]);
  if (second.exitCode === 0) return true;
  throw new MediaError('MEDIA_VALIDATION_ERROR', 'svgo failed to optimize SVG', { stderr: first.stderr + String.fromCharCode(10) + second.stderr, exitCode: second.exitCode });
}

async function convertSvg(input: SvgConvertInput): Promise<JsonObject> {
  try {
    const inputPath = input.inputPath;
    const outPath = input.outPath;
    if (!inputPath) throw new MediaError('MEDIA_INPUT_MISSING', 'SVG conversion requires --input');
    if (!outPath) throw new MediaError('MEDIA_INPUT_MISSING', 'SVG conversion requires --out');
    const strategy = normalizeStrategy(input.strategy);
    const requestedTraceEngine = normalizeTraceEngine(input.traceEngine);
    const info = inspectRasterImage(inputPath);
    const outputs: Record<string, string> = {};
    const toolVersions: Record<string, string> = {};
    let actualTraceEngine: TraceEngine = requestedTraceEngine;

    if (strategy === 'wrapper') {
      const wrapper = await writeWrapperSvg(inputPath, outPath);
      outputs.svg = wrapper.path;
      outputs.wrapperSvg = wrapper.path;
    }
    if (strategy === 'trace') {
      const traced = await writeTracedSvg(inputPath, outPath, requestedTraceEngine);
      outputs.svg = traced.path;
      outputs.tracedSvg = traced.path;
      actualTraceEngine = traced.traceEngine;
      toolVersions[traced.tool] = 'available';
    }
    if (strategy === 'both') {
      const wrapper = await writeWrapperSvg(inputPath, relatedPath(outPath, '.wrapper'));
      const traced = await writeTracedSvg(inputPath, outPath, requestedTraceEngine);
      outputs.svg = traced.path;
      outputs.wrapperSvg = wrapper.path;
      outputs.tracedSvg = traced.path;
      actualTraceEngine = traced.traceEngine;
      toolVersions[traced.tool] = 'available';
    }

    if (input.optimize) {
      const uniquePaths = Array.from(new Set(Object.values(outputs)));
      for (const outputPath of uniquePaths) await optimizeSvgPath(outputPath);
      toolVersions.svgo = 'available';
    }

    const result = {
      schema: 'media.svg-result.v1',
      id: stableId('svg', { inputPath, outPath, strategy }),
      input: { path: inputPath, mimeType: info.mimeType, width: info.width, height: info.height },
      strategy,
      traceEngine: actualTraceEngine,
      optimized: input.optimize === true,
      outputs,
      toolVersions,
      deterministic: true,
    };
    return MediaSvgResultSchema.parse(result) as JsonObject;
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export const convertSvgEffect = (input: SvgConvertInput) => Effect.tryPromise({
  try: () => convertSvg(input),
  catch: (cause) => cause instanceof Error ? cause : new Error(String(cause)),
});

export function convertSvgForCli(input: SvgConvertInput) {
  return Effect.map(convertSvgEffect(input), (data) => ({ schema: 'media.svg-result.v1', ok: true, data }));
}
