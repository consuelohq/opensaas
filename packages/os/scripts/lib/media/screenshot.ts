import { Effect } from 'effect';
import { createHash } from 'node:crypto';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, extname } from 'node:path';

import { MediaScreenshotResultSchema } from './schema';
import { liveMediaProcess } from './process';

export const screenshotThemes = ['dark', 'light'] as const;
export const screenshotFits = ['contain', 'cover'] as const;
export const screenshotPatterns = ['grid', 'lines', 'none'] as const;

export type ScreenshotTheme = typeof screenshotThemes[number];
export type ScreenshotFit = typeof screenshotFits[number];
export type ScreenshotPattern = typeof screenshotPatterns[number];

export type ScreenshotRenderInput = {
  inputPath: string;
  outPath: string;
  width?: number;
  height?: number;
  theme?: ScreenshotTheme;
  accent?: string;
  background?: string;
  padding?: number;
  fit?: ScreenshotFit;
  pattern?: ScreenshotPattern;
};

export type ScreenshotRenderPlan = {
  command: 'ffmpeg';
  args: string[];
  outputPath: string;
  template: {
    width: number;
    height: number;
    theme: ScreenshotTheme;
    accent: string;
    background: string;
    padding: number;
    fit: ScreenshotFit;
    pattern: ScreenshotPattern;
  };
};

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const INPUT_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function stableId(value: unknown): string {
  return 'screenshot_' + createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

function normalizeHex(value: string, label: string): string {
  if (!HEX_COLOR.test(value)) throw new Error(label + ' must be a six-digit hex color such as #0000F2');
  return value.toUpperCase();
}

function ffmpegColor(value: string): string {
  return '0x' + value.slice(1);
}

function assertIntegerInRange(value: number, label: string, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(label + ' must be an integer between ' + min + ' and ' + max);
  }
}

function normalizeTemplate(input: ScreenshotRenderInput): ScreenshotRenderPlan['template'] {
  const width = input.width ?? 1600;
  const height = input.height ?? 900;
  const theme = input.theme ?? 'dark';
  const accent = normalizeHex(input.accent ?? '#0000F2', 'accent');
  const background = normalizeHex(input.background ?? (theme === 'light' ? '#F5F5F5' : '#08080A'), 'background');
  const padding = input.padding ?? 120;
  const fit = input.fit ?? 'contain';
  const pattern = input.pattern ?? 'grid';

  assertIntegerInRange(width, 'width', 800, 4096);
  assertIntegerInRange(height, 'height', 450, 4096);
  assertIntegerInRange(padding, 'padding', 32, Math.floor(Math.min(width, height) / 3));
  if (!screenshotThemes.includes(theme)) throw new Error('theme must be dark or light');
  if (!screenshotFits.includes(fit)) throw new Error('fit must be contain or cover');
  if (!screenshotPatterns.includes(pattern)) throw new Error('pattern must be grid, lines, or none');

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  if (innerWidth < 320 || innerHeight < 240) throw new Error('padding leaves too little room for the screenshot');

  return { width, height, theme, accent, background, padding, fit, pattern };
}

function validatePaths(input: ScreenshotRenderInput): void {
  if (!input.inputPath) throw new Error('input image path is required');
  if (!INPUT_IMAGE_EXTENSIONS.has(extname(input.inputPath).toLowerCase())) {
    throw new Error('input must be a PNG, JPEG, or WebP image');
  }
  if (!input.outPath) throw new Error('output path is required');
  if (extname(input.outPath).toLowerCase() !== '.png') throw new Error('output must be a PNG file');
}

function patternFilter(template: ScreenshotRenderPlan['template']): string {
  const accent = ffmpegColor(template.accent);
  if (template.pattern === 'none') return 'null';
  if (template.pattern === 'lines') {
    const spacing = Math.max(120, Math.round(template.width / 5));
    return 'drawgrid=w=' + spacing + ':h=' + template.height + ':t=2:c=' + accent + '@0.16';
  }
  const spacing = Math.max(64, Math.round(Math.min(template.width, template.height) / 10));
  return 'drawgrid=w=' + spacing + ':h=' + spacing + ':t=2:c=' + accent + '@0.14';
}

export function buildScreenshotRenderPlan(input: ScreenshotRenderInput): ScreenshotRenderPlan {
  validatePaths(input);
  const template = normalizeTemplate(input);
  const contentWidth = template.width - template.padding * 2 - 8;
  const contentHeight = template.height - template.padding * 2 - 8;
  const frameColor = template.theme === 'light' ? '#D8D8DF' : '#34343A';
  const shadowAlpha = template.theme === 'light' ? '0.28' : '0.48';
  const scale = template.fit === 'cover'
    ? 'scale=' + contentWidth + ':' + contentHeight + ':force_original_aspect_ratio=increase,crop=' + contentWidth + ':' + contentHeight
    : 'scale=' + contentWidth + ':' + contentHeight + ':force_original_aspect_ratio=decrease';
  const filter = [
    '[0:v]format=rgba,' + patternFilter(template) + '[bg]',
    '[1:v]' + scale + ',pad=iw+8:ih+8:4:4:color=' + ffmpegColor(frameColor) + ',format=rgba[card]',
    '[card]split=2[cardmain][shadow]',
    '[shadow]colorchannelmixer=rr=0:gg=0:bb=0:aa=' + shadowAlpha + ',gblur=sigma=28[shadowblur]',
    '[bg][shadowblur]overlay=x=(W-w)/2+16:y=(H-h)/2+22[withshadow]',
    '[withshadow][cardmain]overlay=x=(W-w)/2:y=(H-h)/2[out]',
  ].join(';');

  return {
    command: 'ffmpeg',
    args: [
      '-v', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=' + ffmpegColor(template.background) + ':s=' + template.width + 'x' + template.height + ':d=1',
      '-i', input.inputPath,
      '-filter_complex', filter,
      '-map', '[out]',
      '-frames:v', '1',
      '-update', '1',
      input.outPath,
    ],
    outputPath: input.outPath,
    template,
  };
}

function versionLine(stdout: string): string {
  return stdout.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? 'ffmpeg';
}

export const renderScreenshotEffect = (input: ScreenshotRenderInput) => Effect.gen(function* () {
  const plan = buildScreenshotRenderPlan(input);
  mkdirSync(dirname(plan.outputPath), { recursive: true });
  const render = yield* liveMediaProcess.run({ command: plan.command, args: plan.args });
  if (render.exitCode !== 0) throw new Error('ffmpeg screenshot render failed: ' + render.stderr.trim());
  const version = yield* liveMediaProcess.run({ command: 'ffmpeg', args: ['-version'] });
  const result = {
    schema: 'media.screenshot-result.v1' as const,
    id: stableId({ inputPath: input.inputPath, outputPath: plan.outputPath, template: plan.template }),
    source: { path: input.inputPath },
    output: {
      path: plan.outputPath,
      width: plan.template.width,
      height: plan.template.height,
      format: 'png' as const,
      fileSizeBytes: statSync(plan.outputPath).size,
    },
    template: plan.template,
    toolVersions: { ffmpeg: version.exitCode === 0 ? versionLine(version.stdout) : 'ffmpeg' },
    deterministic: true as const,
  };
  return MediaScreenshotResultSchema.parse(result);
});

export function renderScreenshotForCli(input: ScreenshotRenderInput) {
  return Effect.map(renderScreenshotEffect(input), (result) => ({ ...result, ok: true }));
}
