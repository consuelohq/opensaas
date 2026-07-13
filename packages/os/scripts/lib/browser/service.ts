import { Effect } from 'effect';

import { resolveBrowserConfig } from './config';
import { BrowserServiceError } from './errors';
import { createBrowserProcess } from './process';
import type {
  BrowserContext,
  BrowserExistingResult,
  BrowserHeadedResult,
  BrowserOpenInput,
  BrowserProcessResult,
  BrowserStatus,
} from './types';

export function createBrowserContext(env: NodeJS.ProcessEnv = process.env): BrowserContext {
  const config = resolveBrowserConfig(env);
  return { config, process: createBrowserProcess(config.defaultTimeoutMs) };
}

function validateUrl(value: string) {
  return Effect.try({
    try: () => new URL(value).toString(),
    catch: () => new BrowserServiceError('BROWSER_INVALID_URL', `Invalid browser URL: ${value}`),
  });
}

function providerArgs(provider?: string): string[] {
  return provider ? ['--provider', provider] : [];
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

export function headedBrowserEffect(input: { url: string; provider?: string }, context: BrowserContext) {
  return Effect.gen(function* () {
    const url = yield* validateUrl(input.url);
    const provider = providerArgs(input.provider);
    const close = yield* runBrowserCommandEffect({ args: ['close', '--all'], useProfile: false }, context);
    if (close.runtimeMissing || close.timedOut) {
      return yield* Effect.fail(commandFailure('browser daemon restart', close));
    }

    yield* runRequired('headed browser launch', { args: [...provider, '--headed', 'open', 'about:blank'] }, context);
    yield* runRequired('headed browser navigation', { args: [...provider, 'open', url] }, context);
    const currentUrl = yield* runRequired('browser URL read', { args: [...provider, 'get', 'url'] }, context);
    const title = yield* runRequired('browser title read', { args: [...provider, 'get', 'title'] }, context);

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
  if (input.headed) return headedBrowserEffect({ url: input.url, provider: input.provider }, context);

  return Effect.gen(function* () {
    const url = yield* validateUrl(input.url);
    yield* runRequired('browser open', { args: [...providerArgs(input.provider), 'open', url] }, context);
    return {
      mode: 'existing',
      profilePath: context.config.profilePath,
      url,
      leftRunning: true,
    } satisfies BrowserExistingResult;
  });
}

function hasActiveSession(summary: string): boolean {
  return /(?:^|\n)\s*[→*]\s+\S/.test(summary);
}

export function statusBrowserEffect(_input: Record<string, never>, context: BrowserContext) {
  return Effect.gen(function* () {
    const session = yield* runRequired('browser status', { args: ['session', 'list'] }, context);
    const sessionSummary = session.stdout.trim();
    if (!hasActiveSession(sessionSummary)) {
      return {
        profilePath: context.config.profilePath,
        reachable: false,
        sessionSummary,
        url: '',
        title: '',
      } satisfies BrowserStatus;
    }

    const url = yield* runRequired('browser URL read', { args: ['get', 'url'] }, context);
    const title = yield* runRequired('browser title read', { args: ['get', 'title'] }, context);

    return {
      profilePath: context.config.profilePath,
      reachable: true,
      sessionSummary,
      url: url.stdout.trim(),
      title: title.stdout.trim(),
    } satisfies BrowserStatus;
  });
}

export function closeBrowserEffect(context: BrowserContext) {
  return runRequired('browser close', { args: ['close', '--all'], useProfile: false }, context).pipe(
    Effect.as({ closed: true as const }),
  );
}
