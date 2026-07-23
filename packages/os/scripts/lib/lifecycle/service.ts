import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type {
  LifecycleHealthAcceptance,
  LifecycleServiceController,
} from './types';

export type LifecycleProcessResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type LifecycleProcessRunner = (
  command: string,
  args: string[],
) => Promise<LifecycleProcessResult>;

async function defaultRunner(command: string, args: string[]): Promise<LifecycleProcessResult> {
  try {
    const proc = Bun.spawn([command, ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { exitCode, stdout, stderr };
  } catch (error: unknown) {
    throw new Error(
      `failed to execute lifecycle service command: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

export function createReloadServiceController(input: {
  osRoot: string;
  run?: LifecycleProcessRunner;
}): LifecycleServiceController {
  const reloadScript = resolve(input.osRoot, 'scripts', 'consuelo-reload.js');
  const run = input.run ?? defaultRunner;
  return {
    async preflight() {
      if (!existsSync(reloadScript)) {
        throw new Error(`canonical reload adapter is missing: ${reloadScript}`);
      }
    },
    async restart(options = {}) {
      try {
        const command = options.waitForCompletion ? 'restart-now' : 'restart';
        const result = await run(process.execPath, [reloadScript, command]);
        if (result.exitCode !== 0) {
          throw new Error(result.stderr.trim() || result.stdout.trim() || `reload adapter exited ${result.exitCode}`);
        }
      } catch (error: unknown) {
        throw new Error(
          `canonical reload adapter failed: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
    },
  };
}

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

export function createHttpHealthAcceptance(input: {
  url: string;
  attempts?: number;
  intervalMs?: number;
  expectedName?: string;
  expectedBundleId?: string;
  fetchImpl?: typeof fetch;
}): LifecycleHealthAcceptance {
  const attempts = input.attempts ?? 40;
  const intervalMs = input.intervalMs ?? 500;
  const expectedName = input.expectedName ?? 'consuelo-os';
  const fetchImpl = input.fetchImpl ?? fetch;
  return {
    async accept(expected = {}) {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          const response = await fetchImpl(input.url, { signal: AbortSignal.timeout(2_000) });
          if (response.ok) {
            const body = (await response.json()) as { name?: string; bundleId?: string; version?: string };
            const expectedBundleId = expected.bundleId ?? input.expectedBundleId;
            if (
              body.name === expectedName
              && (!expectedBundleId || body.bundleId === expectedBundleId)
              && (!expected.version || body.version === expected.version)
            ) return true;
          }
        } catch {
          // A bounded retry follows; health failure remains a typed engine result.
        }
        if (attempt + 1 < attempts) await sleep(intervalMs);
      }
      return false;
    },
  };
}
