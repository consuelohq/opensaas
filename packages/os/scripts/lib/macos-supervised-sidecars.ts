import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

export const MACOS_SUPERVISED_SIDECARS_VERSION = 1;
export const MACOS_SUPERVISED_SIDECARS_CONFIG = 'macos-supervised-sidecars.json';

export type MacosSupervisedSidecarSpec = {
  id: 'caddy' | 'cloudflared';
  command: string[];
  cwd: string;
  environment: NodeJS.ProcessEnv;
  pidFile: string;
};

type ConnectorConfig = {
  id: string;
  programArguments: string[];
};

type SidecarConfig = {
  schemaVersion: 1;
  connector?: ConnectorConfig;
};

export type MacosSidecarProcessHandle = {
  pid: number;
  exited: Promise<number>;
  kill(signal?: NodeJS.Signals): boolean;
};

export type MacosSupervisedSidecars = {
  reconcile(): Promise<void>;
  stop(): Promise<void>;
};

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

function readSidecarConfig(consueloHome: string): SidecarConfig | null {
  const configPath = path.join(
    consueloHome,
    'node',
    'security',
    'generated',
    MACOS_SUPERVISED_SIDECARS_CONFIG,
  );
  if (!existsSync(configPath)) return null;
  const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as Partial<SidecarConfig>;
  if (parsed.schemaVersion !== 1) {
    throw new Error('macOS supervised sidecar config schema is unsupported');
  }
  if (parsed.connector) {
    const connector = parsed.connector as Partial<ConnectorConfig>;
    if (
      typeof connector.id !== 'string'
      || !connector.id.trim()
      || !Array.isArray(connector.programArguments)
      || connector.programArguments.length === 0
      || connector.programArguments.some((entry) => typeof entry !== 'string' || !entry)
    ) {
      throw new Error('macOS supervised connector config is invalid');
    }
  }
  return parsed as SidecarConfig;
}

function configuredBinary(
  environment: NodeJS.ProcessEnv,
  variable: 'CADDY_BIN' | 'CLOUDFLARED_BIN',
  fallback: string,
): string {
  return environment[variable]?.trim() || fallback;
}

export function resolveMacosSupervisedSidecarSpecs(input: {
  consueloHome: string;
  runtimeRoot: string;
  environment?: NodeJS.ProcessEnv;
}): MacosSupervisedSidecarSpec[] {
  const environment = input.environment ?? process.env;
  const runtimeDir = path.join(input.consueloHome, 'node', 'runs', 'supervised-sidecars');
  const specs: MacosSupervisedSidecarSpec[] = [];
  const caddy = configuredBinary(
    environment,
    'CADDY_BIN',
    path.join(input.consueloHome, 'bin', 'caddy'),
  );
  if (existsSync(caddy)) {
    specs.push({
      id: 'caddy',
      command: [
        '/bin/bash',
        path.join(input.runtimeRoot, 'scripts', 'start-caddy-daemon.sh'),
      ],
      cwd: input.runtimeRoot,
      environment: {
        ...environment,
        CADDY_BIN: caddy,
        CONSUELO_HOME: input.consueloHome,
      },
      pidFile: path.join(runtimeDir, 'caddy.pid'),
    });
  }

  const config = readSidecarConfig(input.consueloHome);
  const connector = config?.connector;
  if (connector) {
    const cloudflared = configuredBinary(
      environment,
      'CLOUDFLARED_BIN',
      path.join(input.consueloHome, 'bin', 'cloudflared'),
    );
    const command = [...connector.programArguments];
    command[0] = cloudflared;
    specs.push({
      id: 'cloudflared',
      command,
      cwd: input.runtimeRoot,
      environment: {
        ...environment,
        CLOUDFLARED_BIN: cloudflared,
        CONSUELO_HOME: input.consueloHome,
      },
      pidFile: path.join(runtimeDir, `cloudflared-${connector.id}.pid`),
    });
  }
  return specs;
}

function defaultSpawn(spec: MacosSupervisedSidecarSpec): MacosSidecarProcessHandle {
  const subprocess = Bun.spawn(spec.command, {
    cwd: spec.cwd,
    env: spec.environment,
    stdin: 'ignore',
    stdout: 'inherit',
    stderr: 'inherit',
  });
  return {
    pid: subprocess.pid,
    exited: subprocess.exited,
    kill(signal) {
      subprocess.kill(signal);
      return true;
    },
  };
}

export async function startMacosSupervisedSidecars(input: {
  consueloHome: string;
  runtimeRoot: () => string;
  environment?: NodeJS.ProcessEnv;
  spawnProcess?: (spec: MacosSupervisedSidecarSpec) => MacosSidecarProcessHandle;
  restartDelayMs?: number;
  onError?: (error: unknown) => void;
}): Promise<MacosSupervisedSidecars> {
  const environment = input.environment ?? process.env;
  const spawnProcess = input.spawnProcess ?? defaultSpawn;
  const restartDelayMs = input.restartDelayMs ?? 500;
  const active = new Map<string, {
    handle: MacosSidecarProcessHandle;
    signature: string;
    spec: MacosSupervisedSidecarSpec;
  }>();
  const runtimeDir = path.join(input.consueloHome, 'node', 'runs', 'supervised-sidecars');
  mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
  let stopping = false;
  let watchdogRunning = false;

  const report = (error: unknown): void => {
    input.onError?.(error);
  };

  const launch = (spec: MacosSupervisedSidecarSpec): void => {
    const signature = JSON.stringify(spec.command);
    const handle = spawnProcess(spec);
    try {
      writeFileSync(spec.pidFile, `${handle.pid}\n`, { mode: 0o600 });
      active.set(spec.id, { handle, signature, spec });
    } catch (error: unknown) {
      try {
        handle.kill('SIGTERM');
      } catch (terminationError: unknown) {
        report(terminationError);
      }
      rmSync(spec.pidFile, { force: true });
      throw error;
    }
    void handle.exited.then(async (exitCode) => {
      const current = active.get(spec.id);
      if (!current || current.handle !== handle) return;
      active.delete(spec.id);
      rmSync(spec.pidFile, { force: true });
      if (stopping) return;
      report(new Error(`macOS supervised sidecar ${spec.id} exited ${exitCode}; restarting`));
      await sleep(restartDelayMs);
      if (stopping) return;
      const desired = resolveMacosSupervisedSidecarSpecs({
        consueloHome: input.consueloHome,
        runtimeRoot: input.runtimeRoot(),
        environment,
      }).find((candidate) => candidate.id === spec.id);
      if (desired && !active.has(spec.id)) launch(desired);
    }).catch((error: unknown) => report(error));
  };

  const stopEntry = async (entry: {
    handle: MacosSidecarProcessHandle;
    spec: MacosSupervisedSidecarSpec;
  }): Promise<void> => {
    try {
      entry.handle.kill('SIGTERM');
      const exited = await Promise.race([
        entry.handle.exited.then(() => true),
        sleep(5_000).then(() => false),
      ]);
      if (!exited) {
        entry.handle.kill('SIGKILL');
        await Promise.race([
          entry.handle.exited.then(() => undefined),
          sleep(1_000),
        ]);
      }
    } finally {
      rmSync(entry.spec.pidFile, { force: true });
    }
  };

  const reconcile = async (): Promise<void> => {
    const desired = resolveMacosSupervisedSidecarSpecs({
      consueloHome: input.consueloHome,
      runtimeRoot: input.runtimeRoot(),
      environment,
    });
    const desiredIds = new Set(desired.map((spec) => spec.id));
    for (const [id, current] of [...active]) {
      const next = desired.find((candidate) => candidate.id === id);
      const nextSignature = next ? JSON.stringify(next.command) : '';
      if (!desiredIds.has(id) || current.signature !== nextSignature) {
        active.delete(id);
        await stopEntry(current);
      }
    }
    for (const spec of desired) {
      if (!active.has(spec.id)) launch(spec);
    }
  };

  const runWatchdog = async (): Promise<void> => {
    if (watchdogRunning || stopping) return;
    const runtimeRoot = input.runtimeRoot();
    const script = path.join(runtimeRoot, 'scripts', 'workspace-watchdog.sh');
    if (!existsSync(script)) return;
    watchdogRunning = true;
    try {
      const subprocess = Bun.spawn(['/bin/bash', script], {
        cwd: runtimeRoot,
        env: {
          ...environment,
          CONSUELO_HOME: input.consueloHome,
          WORKSPACE_WATCHDOG_CADDY_PID_FILE: path.join(runtimeDir, 'caddy.pid'),
          WORKSPACE_WATCHDOG_SUPERVISED_SIDECARS: '1',
        },
        stdin: 'ignore',
        stdout: 'inherit',
        stderr: 'inherit',
      });
      await subprocess.exited;
    } catch (error: unknown) {
      report(error);
    } finally {
      watchdogRunning = false;
    }
  };

  await reconcile();
  const intervalSeconds = Number(environment.WORKSPACE_WATCHDOG_INTERVAL_SECONDS ?? '30');
  const intervalMs = Number.isInteger(intervalSeconds) && intervalSeconds > 0
    ? intervalSeconds * 1_000
    : 30_000;
  void runWatchdog();
  const watchdogTimer = setInterval(() => void runWatchdog(), intervalMs);
  watchdogTimer.unref?.();

  return {
    reconcile,
    async stop() {
      if (stopping) return;
      stopping = true;
      clearInterval(watchdogTimer);
      const entries = [...active.values()];
      active.clear();
      try {
        const results = await Promise.allSettled(entries.map(stopEntry));
        const rejected = results.find(
          (result): result is PromiseRejectedResult => result.status === 'rejected',
        );
        if (rejected) throw rejected.reason;
      } catch (error: unknown) {
        throw new Error('macOS supervised sidecar cleanup failed', { cause: error });
      }
    },
  };
}
