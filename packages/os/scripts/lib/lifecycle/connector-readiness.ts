import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type LifecycleConnectorReadiness = {
  /**
   * After the local OS process is healthy, re-assert the public connector path
   * and register a connected heartbeat with device authority.
   *
   * Returns true when readiness is confirmed or when no connector is configured.
   */
  accept(): Promise<boolean>;
};

export type LifecycleProcessResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type LifecycleProcessRunner = (
  command: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
) => Promise<LifecycleProcessResult>;

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

async function defaultRunner(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<LifecycleProcessResult> {
  try {
    const proc = Bun.spawn([command, ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
      env,
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { exitCode, stdout, stderr };
  } catch (error: unknown) {
    throw new Error(
      `failed to execute connector readiness command: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function heartbeatConfigPath(home: string): string {
  return resolve(home, 'node', 'security', 'generated', 'workspace-node-heartbeat.json');
}

function resolveHeartbeatScript(osRoot: string): string | null {
  const candidates = [
    resolve(osRoot, 'scripts', 'workspace-node-heartbeat.ts'),
    resolve(osRoot, 'runtime', 'current', 'scripts', 'workspace-node-heartbeat.ts'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

async function readConnectorHealthUrl(configPath: string): Promise<string | null> {
  try {
    const raw = JSON.parse(await readFile(configPath, 'utf8')) as {
      connectorHealthUrl?: unknown;
    };
    const value =
      typeof raw.connectorHealthUrl === 'string'
        ? raw.connectorHealthUrl.trim()
        : '';
    return value || null;
  } catch {
    return null;
  }
}

/**
 * Accepts the full ChatGPT/OS connector path:
 * public connector /health is OK, and one signed heartbeat reports connected.
 *
 * Skips when heartbeat config is absent (local-only installs).
 */
export function createConnectorReadinessAcceptance(input: {
  home: string;
  osRoot: string;
  attempts?: number;
  intervalMs?: number;
  fetchImpl?: typeof fetch;
  run?: LifecycleProcessRunner;
  bunExecutable?: string;
}): LifecycleConnectorReadiness {
  const attempts = input.attempts ?? 40;
  const intervalMs = input.intervalMs ?? 500;
  const fetchImpl = input.fetchImpl ?? fetch;
  const run = input.run ?? defaultRunner;
  const bunExecutable =
    input.bunExecutable ?? process.env.BUN_BIN ?? process.execPath;
  const configPath = heartbeatConfigPath(input.home);
  const heartbeatScript = resolveHeartbeatScript(input.osRoot);

  return {
    async accept() {
      if (!existsSync(configPath) || !heartbeatScript) {
        return true;
      }

      const healthUrl = await readConnectorHealthUrl(configPath);
      if (!healthUrl) {
        // No public connector — still send a heartbeat so authority lastSeenAt stays fresh.
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          const result = await run(bunExecutable, [
            heartbeatScript,
            '--config',
            configPath,
          ]);
          if (
            result.exitCode === 0 &&
            !result.stdout.includes('"skipped":true') &&
            !result.stdout.includes('"skipped": true')
          ) {
            return true;
          }
          if (attempt + 1 < attempts) await sleep(intervalMs);
        }
        return false;
      }

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          const response = await fetchImpl(healthUrl, {
            signal: AbortSignal.timeout(5_000),
            headers: { accept: 'application/json' },
          });
          if (response.ok) {
            const heartbeat = await run(bunExecutable, [
              heartbeatScript,
              '--config',
              configPath,
            ]);
            if (
              heartbeat.exitCode === 0 &&
              !heartbeat.stdout.includes('"skipped":true') &&
              !heartbeat.stdout.includes('"skipped": true')
            ) {
              return true;
            }
          }
        } catch {
          // Retry until attempts are exhausted.
        }
        if (attempt + 1 < attempts) await sleep(intervalMs);
      }
      return false;
    },
  };
}
