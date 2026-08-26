import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { LifecycleConnectorReadiness } from './types';

type HeartbeatOutput = {
  skipped?: boolean;
  routeReady?: boolean;
  mcpReady?: boolean;
};

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

function heartbeatConfigPath(home: string): string {
  return resolve(home, 'node', 'security', 'generated', 'workspace-node-heartbeat.json');
}

function heartbeatScriptPath(osRoot: string): string | null {
  const candidates = [
    resolve(osRoot, 'scripts', 'workspace-node-heartbeat.ts'),
    resolve(osRoot, 'runtime', 'current', 'scripts', 'workspace-node-heartbeat.ts'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

async function connectorHealthUrl(configPath: string): Promise<string | null> {
  try {
    const value = JSON.parse(await readFile(configPath, 'utf8')) as {
      connectorHealthUrl?: unknown;
    };
    return typeof value.connectorHealthUrl === 'string' && value.connectorHealthUrl.trim()
      ? value.connectorHealthUrl.trim()
      : null;
  } catch {
    return null;
  }
}

async function runHeartbeat(input: {
  bunExecutable: string;
  scriptPath: string;
  configPath: string;
  env: NodeJS.ProcessEnv;
}): Promise<HeartbeatOutput | null> {
  const child = Bun.spawn(
    [input.bunExecutable, input.scriptPath, '--config', input.configPath],
    {
      env: input.env,
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const [stdout, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    child.exited,
  ]);
  if (exitCode !== 0) return null;
  try {
    return JSON.parse(stdout.trim()) as HeartbeatOutput;
  } catch {
    return null;
  }
}

/**
 * Proves the public connector reaches this node and that the signed authority heartbeat
 * reconciled a routable MCP target. Local-only installs without heartbeat config skip this gate.
 */
export function createConnectorReadinessAcceptance(input: {
  home: string;
  osRoot: string;
  attempts?: number;
  intervalMs?: number;
  fetchImpl?: typeof fetch;
  bunExecutable?: string;
  env?: NodeJS.ProcessEnv;
}): LifecycleConnectorReadiness {
  const attempts = input.attempts ?? 40;
  const intervalMs = input.intervalMs ?? 500;
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  const bunExecutable = input.bunExecutable ?? process.env.BUN_BIN ?? process.execPath;
  const env = input.env ?? process.env;
  const configPath = heartbeatConfigPath(input.home);

  return {
    async accept() {
      if (!existsSync(configPath)) return true;
      const scriptPath = heartbeatScriptPath(input.osRoot);
      if (!scriptPath) return false;
      const healthUrl = await connectorHealthUrl(configPath);
      if (!healthUrl) return false;

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          const response = await fetchImpl(healthUrl, {
            headers: { accept: 'application/json' },
            signal: AbortSignal.timeout(5_000),
          });
          if (response.ok) {
            const heartbeat = await runHeartbeat({
              bunExecutable,
              scriptPath,
              configPath,
              env,
            });
            if (
              heartbeat
              && !heartbeat.skipped
              && heartbeat.routeReady === true
              && heartbeat.mcpReady !== false
            ) {
              return true;
            }
          }
        } catch {
          // Bounded retry below.
        }
        if (attempt + 1 < attempts) await sleep(intervalMs);
      }
      return false;
    },
  };
}
