import { Effect } from 'effect';

import { resolveBrowserConfig } from './config';
import { BrowserServiceError } from './errors';
import { createBrowserProcess } from './process';
import type {
  BrowserContext,
  BrowserHeadedResult,
  BrowserOpenInput,
  BrowserOpenResult,
  BrowserProcessResult,
  BrowserStatus,
} from './types';

export function createBrowserContext(env: NodeJS.ProcessEnv = process.env): BrowserContext {
  const config = resolveBrowserConfig(env);
  return { config, process: createBrowserProcess(config.defaultTimeoutMs) };
}

function validateUrl(value: string): string {
  try {
    return new URL(value).toString();
  } catch {
    throw new BrowserServiceError('BROWSER_INVALID_URL', `Invalid browser URL: ${value}`);
  }
}

function commandFailure(operation: string, result: BrowserProcessResult): BrowserServiceError {
  if (result.runtimeMissing) {
    return new BrowserServiceError('BROWSER_RUNTIME_MISSING', 'agent-browser is not installed or is not available on PATH');
  }
  if (result.timedOut) {
    return new BrowserServiceError('BROWSER_TIMEOUT', `${operation} timed out`);
  }
  const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`;
  return new BrowserServiceError('BROWSER_COMMAND_FAILED', `${operation} failed: ${detail}`);
}

function ensureSuccess(operation: string, result: BrowserProcessResult) {
  return result.exitCode === 0
    ? Effect.succeed(result)
    : Effect.fail(commandFailure(operation, result));
}

export function runBrowserCommandEffect(
  input: { args: string[]; useProfile?: boolean; timeoutMs?: number },
  context: BrowserContext,
) {
  const args = input.useProfile === false
    ? input.args
    : ['--profile', context.config.profilePath, ...input.args];
  return context.process.run({ args, timeoutMs: input.timeoutMs });
}

function runRequired(
  operation: string,
  input: { args: string[]; useProfile?: boolean; timeoutMs?: number },
  context: BrowserContext,
) {
  return Effect.flatMap(runBrowserCommandEffect(input, context), (result) => ensureSuccess(operation, result));
}

export function headedBrowserEffect(input: { url: string }, context: BrowserContext) {
  return Effect.gen(function* () {
    const url = validateUrl(input.url);
    const close = yield* runBrowserCommandEffect({ args: ['close', '--all'], useProfile: false }, context);
    if (close.runtimeMissing || close.timedOut) {
      return yield* Effect.fail(commandFailure('browser daemon restart', close));
    }

    yield* runRequired('headed browser launch', { args: ['--headed', 'open', 'about:blank'] }, context);
    yield* runRequired('headed browser navigation', { args: ['open', input.url] }, context);
    const currentUrl = yield* runRequired('browser URL read', { args: ['get', 'url'] }, context);
    const title = yield* runRequired('browser title read', { args: ['get', 'title'] }, context);

    return {
      mode: 'headed',
      profilePath: context.config.profilePath,
      url: currentUrl.stdout.trim() || url,
      title: title.stdout.trim(),
      leftRunning: true,
    } satisfies BrowserHeadedResult;
  });
}

export function openBrowserEffect(input: BrowserOpenInput, context: BrowserContext) {
  if (input.headed) return headedBrowserEffect({ url: input.url }, context);

  return Effect.gen(function* () {
    const url = validateUrl(input.url);
    yield* runRequired('browser open', { args: ['open', input.url] }, context);
    return {
      mode: 'existing',
      profilePath: context.config.profilePath,
      url,
      leftRunning: true,
    } satisfies BrowserOpenResult;
  });
}

function hasActiveSession(summary: string): boolean {
  return /(?:^|\n)\s*[→*]\s+\S/.test(summary);
}

export function statusBrowserEffect(_input: Record<string, never>, context: BrowserContext) {
  return Effect.gen(function* () {
    const session = yield* runBrowserCommandEffect({ args: ['session', 'list'] }, context);
    const sessionSummary = session.stdout.trim();
    if (session.exitCode !== 0 || !hasActiveSession(sessionSummary)) {
      return {
        profilePath: context.config.profilePath,
        reachable: false,
        sessionSummary,
        url: '',
        title: '',
      } satisfies BrowserStatus;
    }

    const url = yield* runBrowserCommandEffect({ args: ['get', 'url'] }, context);
    const title = yield* runBrowserCommandEffect({ args: ['get', 'title'] }, context);

    return {
      profilePath: context.config.profilePath,
      reachable: url.exitCode === 0,
      sessionSummary,
      url: url.exitCode === 0 ? url.stdout.trim() : '',
      title: title.exitCode === 0 ? title.stdout.trim() : '',
    } satisfies BrowserStatus;
  });
}

export function closeBrowserEffect(context: BrowserContext) {
  return runRequired('browser close', { args: ['close', '--all'], useProfile: false }, context).pipe(
    Effect.as({ closed: true as const }),
  );
}
