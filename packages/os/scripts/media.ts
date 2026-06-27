#!/usr/bin/env bun
import { Effect } from 'effect';

import { transcribeForCli } from './lib/media/audio';
import { breakdownPlanForCli } from './lib/media/sports-science';
import { exportPackageForCli } from './lib/media/export';
import { renderOverlayForCli } from './lib/media/overlays';
import { convertSvgForCli } from './lib/media/svg';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';

import { composeForCli } from './lib/media/compose';
import { checkMediaDependenciesEffect } from './lib/media/dependencies';
import { extractFramesForCli } from './lib/media/frames';
import { createMediaInstallPlan } from './lib/media/install-plan';
import { probeForCli } from './lib/media/probe';
import { qaForCli } from './lib/media/qa';
import { validateTimelineForCli } from './lib/media/timeline';

type ParsedProfileArgs = {
  json: boolean;
  dryRun: boolean;
  allProfiles: boolean;
  profiles: string[];
  maxEstimatedSizeMb?: number;
};

type MediaCliEnvelope = {
  schema: string;
  ok: boolean;
  data?: unknown;
  error?: Record<string, unknown>;
};

function parseProfileArgs(rest: string[]): ParsedProfileArgs {
  const args: ParsedProfileArgs = { json: false, dryRun: false, allProfiles: false, profiles: [] };
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    switch (item) {
      case '--json':
        args.json = true;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--all-profiles':
        args.allProfiles = true;
        break;
      case '--profile': {
        const value = rest[index + 1];
        if (!value || value.startsWith('--')) throw new Error('missing value for --profile');
        args.profiles.push(value);
        index += 1;
        break;
      }
      case '--max-estimated-size-mb': {
        const value = rest[index + 1];
        if (!value || value.startsWith('--')) throw new Error('missing value for --max-estimated-size-mb');
        args.maxEstimatedSizeMb = Number(value);
        if (!Number.isFinite(args.maxEstimatedSizeMb)) throw new Error('invalid --max-estimated-size-mb');
        index += 1;
        break;
      }
      default:
        break;
    }
  }
  return args;
}

function optionValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

function writeJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + String.fromCharCode(10));
}

function hasCommand(command: string): boolean {
  if (process.env.CONSUELO_MEDIA_TEST_DISABLE_HOMEBREW === '1' && command === 'brew') return false;
  const searchPath = process.env.PATH ?? '';
  for (const directory of searchPath.split(delimiter)) {
    if (!directory) continue;
    if (existsSync(join(directory, command))) return true;
  }
  return false;
}

function missingDependencyError(command: string): MediaCliEnvelope {
  const dependencyId = command === 'ffprobe' ? 'ffmpeg' : command;
  return {
    schema: 'media.error.v1',
    ok: false,
    error: {
      code: 'MEDIA_DEPENDENCY_MISSING',
      message: 'Required media dependency is missing: ' + command,
      dependencyId,
      commands: [command],
      profile: 'media-core',
      requiredProfiles: ['media-core'],
      requiredCommands: [command],
    },
  };
}

function missingInputError(kind: string, path: string | undefined): MediaCliEnvelope {
  return {
    schema: 'media.error.v1',
    ok: false,
    error: {
      code: 'MEDIA_INPUT_MISSING',
      message: kind + ' input does not exist: ' + (path ?? '<missing>'),
      path,
    },
  };
}

function allOptionValues(args: string[], flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== flag) continue;
    const value = args[index + 1];
    if (value && !value.startsWith('--')) values.push(value);
  }
  return values;
}

function parseNumericOptions(args: string[], flag: string): number[] {
  return allOptionValues(args, flag).map((value) => Number(value)).filter((value) => Number.isFinite(value));
}

function inputExists(path: string | undefined): path is string {
  return typeof path === 'string' && path.length > 0 && existsSync(path);
}

function readJsonInput(path: string | undefined, kind: string): unknown | MediaCliEnvelope {
  if (!inputExists(path)) return missingInputError(kind, path);
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error: unknown) {
    return {
      schema: 'media.error.v1',
      ok: false,
      error: {
        code: 'MEDIA_JSON_INPUT_INVALID',
        message: kind + ' JSON input is invalid: ' + (error instanceof Error ? error.message : String(error)),
        path,
      },
    };
  }
}

function isErrorEnvelope(value: unknown): value is MediaCliEnvelope {
  return typeof value === 'object' && value !== null && 'ok' in value && (value as { ok?: unknown }).ok === false;
}

async function handleAudioCommand(args: string[]): Promise<unknown> {
  const [subcommand = 'help', ...rest] = args;
  try {
    if (subcommand === 'transcribe') {
      const inputPath = optionValue(rest, '--input');
      if (!inputExists(inputPath)) return missingInputError('audio.transcribe', inputPath);
      const mode = optionValue(rest, '--mode') ?? 'fixture';
      const fixtureText = optionValue(rest, '--fixture-text');
      const language = optionValue(rest, '--language');
      const modelRef = optionValue(rest, '--model');
      return await Effect.runPromise(transcribeForCli({ inputPath, mode: mode === 'whisper.cpp' || mode === 'openai-whisper' ? mode : 'fixture', fixtureText, language, modelRef }));
    }
    return { schema: 'media.help.v1', ok: true, data: { commands: ['audio transcribe'] } };
  } catch (error: unknown) {
    return { schema: 'media.error.v1', ok: false, error: { code: 'MEDIA_AUDIO_COMMAND_ERROR', message: error instanceof Error ? error.message : String(error) } };
  }
}

async function handleCoreCommand(command: string, args: string[]): Promise<unknown> {
  try {

    if (command === 'svg' || command === 'svg.convert' || command === 'svg:convert') {
      const rest = command === 'svg' && args[0] === 'convert' ? args.slice(1) : args;
      const inputPath = optionValue(rest, '--input');
      const outPath = optionValue(rest, '--out');
      if (!inputExists(inputPath)) return missingInputError('svg.convert', inputPath);
      if (!outPath) return missingInputError('svg.convert out', outPath);
      return await Effect.runPromise(convertSvgForCli({
        inputPath,
        outPath,
        strategy: optionValue(rest, '--strategy') ?? optionValue(rest, '--mode'),
      }));
    }
    if (command === 'audio') {
      return await handleAudioCommand(args);
    }
    if (command === 'overlay' || command === 'overlay.render') {
      const rest = command === 'overlay' && args[0] === 'render' ? args.slice(1) : args;
      const spec = readJsonInput(optionValue(rest, '--spec'), 'overlay.render');
      if (isErrorEnvelope(spec)) return spec;
      const outPath = optionValue(rest, '--out');
      const value = typeof spec === 'object' && spec !== null ? { ...(spec as Record<string, unknown>) } : {};
      if (outPath) {
        const output = typeof value.output === 'object' && value.output !== null ? value.output as Record<string, unknown> : {};
        value.output = { ...output, path: outPath };
      }
      return await Effect.runPromise(renderOverlayForCli(value));
    }
    if (command === 'breakdown' || command === 'breakdown.plan' || command === 'breakdown:plan') {
      const rest = command === 'breakdown' && args[0] === 'plan' ? args.slice(1) : args;
      const plan = readJsonInput(optionValue(rest, '--input'), 'breakdown.plan');
      if (isErrorEnvelope(plan)) return plan;
      return await Effect.runPromise(breakdownPlanForCli({ plan, availableRefs: allOptionValues(rest, '--available-ref') }));
    }
    if (command === 'export') {
      const renderResultPath = optionValue(args, '--render-result');
      if (!inputExists(renderResultPath)) return missingInputError('export render-result', renderResultPath);
      return await Effect.runPromise(exportPackageForCli({
        renderResultPath,
        target: optionValue(args, '--target'),
        outDir: optionValue(args, '--out'),
        thumbnail: optionValue(args, '--thumbnail'),
        captions: optionValue(args, '--captions'),
        notes: optionValue(args, '--notes'),
        rightsNotes: optionValue(args, '--rights-notes'),
      }));
    }
    if (command === 'probe') {
      if (process.env.CONSUELO_MEDIA_TEST_FORCE_MISSING === 'ffprobe') return missingDependencyError('ffprobe');
      const inputPath = optionValue(args, '--input');
      if (!inputExists(inputPath)) return missingInputError('probe', inputPath);
      return await Effect.runPromise(probeForCli({ inputPath, provenance: { status: 'needs-review' } }));
    }
    if (command === 'frames') {
      const inputPath = optionValue(args, '--input');
      const outDir = optionValue(args, '--out');
      if (!inputExists(inputPath)) return missingInputError('frames.extract', inputPath);
      if (!outDir) return missingInputError('frames.extract out', outDir);
      return await Effect.runPromise(extractFramesForCli({ inputPath, outDir, timestamps: parseNumericOptions(args, '--timestamp') }));
    }
    if (command === 'timeline') {
      const timelinePath = optionValue(args, '--timeline');
      if (!inputExists(timelinePath)) return missingInputError('timeline.validate', timelinePath);
      return await Effect.runPromise(validateTimelineForCli({ timelinePath }));
    }
    if (command === 'compose') {
      const timelinePath = optionValue(args, '--timeline');
      const outPath = optionValue(args, '--out');
      if (!inputExists(timelinePath)) return missingInputError('compose', timelinePath);
      if (!outPath) return missingInputError('compose out', outPath);
      return await Effect.runPromise(composeForCli({ timelinePath, outPath }));
    }
    if (command === 'qa') {
      const inputPath = optionValue(args, '--input');
      if (!inputExists(inputPath)) return missingInputError('qa', inputPath);
      return await Effect.runPromise(qaForCli({ inputPath }));
    }
    return { schema: 'media.help.v1', ok: true, data: { commands: ['doctor', 'install', 'probe', 'svg convert', 'audio transcribe', 'frames extract', 'timeline validate', 'compose', 'qa'] } };
  } catch (error: unknown) {
    return { schema: 'media.error.v1', ok: false, error: { code: 'MEDIA_CORE_COMMAND_ERROR', message: error instanceof Error ? error.message : String(error) } };
  }
}

async function main(): Promise<void> {
  const [command = 'help', ...rest] = process.argv.slice(2);
  if (command === 'doctor') {
    const args = parseProfileArgs(rest);
    writeJson(await Effect.runPromise(checkMediaDependenciesEffect({ profiles: args.profiles, allProfiles: args.allProfiles })));
    return;
  }
  if (command === 'install') {
    const args = parseProfileArgs(rest);
    if (!args.dryRun && !hasCommand('brew')) {
      writeJson({
        schema: 'media.install-error.v1',
        ok: false,
        error: { code: 'HOMEBREW_UNAVAILABLE', message: 'Homebrew is required for media install. Run a dry-run or install Homebrew first.' },
      });
      process.exitCode = 1;
      return;
    }
    if (!args.dryRun) {
      writeJson({
        schema: 'media.install-error.v1',
        ok: false,
        error: { code: 'INSTALL_REQUIRES_EXPLICIT_FUTURE_APPROVAL', message: 'Media install execution is not implemented yet. Use --dry-run.' },
      });
      process.exitCode = 1;
      return;
    }
    writeJson(createMediaInstallPlan({ profiles: args.profiles, dryRun: args.dryRun, maxEstimatedSizeMb: args.maxEstimatedSizeMb }));
    return;
  }

  const envelope = await handleCoreCommand(command, rest);
  writeJson(envelope);
  if (typeof envelope === 'object' && envelope !== null && 'ok' in envelope && envelope.ok === false) process.exitCode = 1;
}

main().catch((error: unknown) => {
  writeJson({ schema: 'media.error.v1', ok: false, error: { code: 'MEDIA_CLI_ERROR', message: error instanceof Error ? error.message : String(error) } });
  process.exit(1);
});
