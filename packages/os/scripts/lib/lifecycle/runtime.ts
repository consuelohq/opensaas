import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import type { LifecycleRuntimeMaterializer } from './types';

export type LifecycleRuntimeProcessResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type LifecycleRuntimeProcessRunner = (input: {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}) => Promise<LifecycleRuntimeProcessResult>;

async function defaultRuntimeRunner(input: {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}): Promise<LifecycleRuntimeProcessResult> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      env: input.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (exitCode) => resolveResult({
      exitCode: exitCode ?? 1,
      stdout,
      stderr,
    }));
  });
}

export const noOpLifecycleRuntimeMaterializer: LifecycleRuntimeMaterializer = {
  materialize() { return Promise.resolve(); },
};

export function createBunRuntimeMaterializer(input: {
  run?: LifecycleRuntimeProcessRunner;
} = {}): LifecycleRuntimeMaterializer {
  const run = input.run ?? defaultRuntimeRunner;
  return {
    async materialize({ home, releasePath }) {
      const cacheDir = join(home, 'runtime', 'cache', 'bun');
      mkdirSync(cacheDir, { recursive: true });
      rmSync(join(releasePath, 'node_modules'), { recursive: true, force: true });
      let result: LifecycleRuntimeProcessResult;
      try {
        result = await run({
          command: process.execPath,
          args: ['install', '--frozen-lockfile', '--production'],
          cwd: releasePath,
          env: {
            ...process.env,
            BUN_INSTALL_CACHE_DIR: cacheDir,
            CONSUELO_HOME: home,
          },
        });
      } catch (error: unknown) {
        throw new Error(
          `failed to start runtime dependency materialization: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
      if (result.exitCode !== 0) {
        throw new Error(
          result.stderr.trim()
            || result.stdout.trim()
            || `bun install exited ${result.exitCode}`,
        );
      }
    },
  };
}
