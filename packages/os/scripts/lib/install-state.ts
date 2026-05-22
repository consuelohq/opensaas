import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { executeCall, getSteering } from '../os';
import { getCapabilityHealth, isCapabilitySetHealthy } from './capabilities';
import { validateBundledSkills } from './skills';

export type OsMode = 'local' | 'cloud';
export type AgentName = 'codex' | 'claude' | 'opencode' | 'factory';
export type HealthStatus =
  | 'connected'
  | 'not_configured'
  | 'missing_capability'
  | 'unhealthy'
  | 'local_only'
  | 'cloud_only'
  | 'permission_denied'
  | 'approval_required'
  | 'validation_failed'
  | 'execution_failed';

export type AgentDetection = {
  name: AgentName;
  label: string;
  homePath: string;
  configPath: string;
  detected: boolean;
  connected: boolean;
  status: HealthStatus;
};

export type OsConfig = {
  version: 1;
  mode: OsMode;
  home: string;
  port: number;
  artifactStorage: 'local';
  agents: Array<{
    name: AgentName;
    homePath: string;
    configPath: string;
    connected: boolean;
    connectedAt?: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type ProvisionOptions = {
  home?: string;
  mode?: OsMode;
  port?: number;
  dryRun?: boolean;
  connectAgents?: AgentName[];
};

export type ProvisionAction = {
  type:
    | 'create_dir'
    | 'create_file'
    | 'preserve_file'
    | 'connect_agent'
    | 'skip_agent';
  path: string;
  status: 'planned' | 'created' | 'preserved' | 'skipped';
  message: string;
};

export type ProvisionResult = {
  home: string;
  configPath: string;
  dbPath: string;
  actions: ProvisionAction[];
  agents: AgentDetection[];
};

export type DoctorCheck = {
  name: string;
  status: HealthStatus;
  message: string;
};

export type DoctorResult = {
  home: string;
  checks: DoctorCheck[];
  ok: boolean;
};

const REQUIRED_DIRS = [
  'agents',
  'skills',
  'scripts',
  'artifacts',
  'logs',
  'runs',
  'cache',
  'runtime',
  'bin',
  'tmp',
] as const;
const DEFAULT_PORT = 8850;

function expandHome(value: string): string {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

export function resolveOsHome(home?: string): string {
  return path.resolve(
    expandHome(home ?? process.env.CONSUELO_HOME ?? '~/.consuelo/os'),
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function writeJsonFile(
  filePath: string,
  value: unknown,
  dryRun: boolean,
): void {
  if (dryRun) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export function createDefaultConfig(
  home: string,
  mode: OsMode,
  port = DEFAULT_PORT,
): OsConfig {
  return {
    version: 1,
    mode,
    home,
    port,
    artifactStorage: 'local',
    agents: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function loadOsConfig(home?: string): OsConfig | null {
  const resolvedHome = resolveOsHome(home);
  return readJsonFile<OsConfig>(path.join(resolvedHome, 'config.json'));
}

export function detectAgents(home?: string): AgentDetection[] {
  const resolvedHome = resolveOsHome(home);
  const config = loadOsConfig(resolvedHome);
  const connected = new Set(
    (config?.agents ?? [])
      .filter((agent) => agent.connected)
      .map((agent) => agent.name),
  );
  const userHome = os.homedir();
  const candidates: Array<
    Omit<AgentDetection, 'detected' | 'connected' | 'status'>
  > = [
    {
      name: 'codex',
      label: 'Codex',
      homePath: path.join(userHome, '.codex'),
      configPath: path.join(userHome, '.codex', 'consuelo-os.json'),
    },
    {
      name: 'claude',
      label: 'Claude',
      homePath: path.join(userHome, '.claude'),
      configPath: path.join(userHome, '.claude', 'consuelo-os.json'),
    },
    {
      name: 'opencode',
      label: 'OpenCode',
      homePath: path.join(userHome, '.opencode'),
      configPath: path.join(userHome, '.opencode', 'consuelo-os.json'),
    },
    {
      name: 'opencode',
      label: 'OpenCode config',
      homePath: path.join(userHome, '.config', 'opencode'),
      configPath: path.join(
        userHome,
        '.config',
        'opencode',
        'consuelo-os.json',
      ),
    },
    {
      name: 'factory',
      label: 'Factory',
      homePath: path.join(userHome, '.factory'),
      configPath: path.join(userHome, '.factory', 'consuelo-os.json'),
    },
  ];

  return candidates.map((candidate) => {
    const detected = fs.existsSync(candidate.homePath);
    const isConnected =
      connected.has(candidate.name) || fs.existsSync(candidate.configPath);
    return {
      ...candidate,
      detected,
      connected: isConnected,
      status: detected
        ? isConnected
          ? 'connected'
          : 'not_configured'
        : 'missing_capability',
    };
  });
}

function connectAgent(
  home: string,
  config: OsConfig,
  agent: AgentDetection,
  dryRun: boolean,
): ProvisionAction[] {
  const actions: ProvisionAction[] = [];
  const record = {
    name: agent.name,
    label: agent.label,
    osHome: home,
    portal: {
      url: `http://127.0.0.1:${config.port}`,
      steeringUrl: `http://127.0.0.1:${config.port}/get_steering`,
      callUrl: `http://127.0.0.1:${config.port}/call`,
    },
    commands: {
      start: 'consuelo os start',
      doctor: 'consuelo os doctor',
    },
    connectedAt: nowIso(),
  };

  if (!agent.detected) {
    actions.push({
      type: 'skip_agent',
      path: agent.homePath,
      status: 'skipped',
      message: `${agent.label} was not detected`,
    });
    return actions;
  }

  const backupPath = `${agent.configPath}.bak`;
  if (
    !dryRun &&
    fs.existsSync(agent.configPath) &&
    !fs.existsSync(backupPath)
  ) {
    fs.copyFileSync(agent.configPath, backupPath);
  }
  writeJsonFile(agent.configPath, record, dryRun);
  actions.push({
    type: 'connect_agent',
    path: agent.configPath,
    status: dryRun ? 'planned' : 'created',
    message: `connected ${agent.label}`,
  });

  const existingIndex = config.agents.findIndex(
    (item) => item.name === agent.name && item.homePath === agent.homePath,
  );
  const agentConfig = {
    name: agent.name,
    homePath: agent.homePath,
    configPath: agent.configPath,
    connected: true,
    connectedAt: nowIso(),
  };
  if (existingIndex >= 0) config.agents[existingIndex] = agentConfig;
  else config.agents.push(agentConfig);
  return actions;
}

export function provisionLocalOs(
  options: ProvisionOptions = {},
): ProvisionResult {
  const home = resolveOsHome(options.home);
  const configPath = path.join(home, 'config.json');
  const dbPath = path.join(home, 'consuelo.db');
  const dryRun = Boolean(options.dryRun);
  const actions: ProvisionAction[] = [];

  for (const dir of [
    home,
    ...REQUIRED_DIRS.map((entry) => path.join(home, entry)),
  ]) {
    const exists = fs.existsSync(dir);
    actions.push({
      type: 'create_dir',
      path: dir,
      status: exists ? 'preserved' : dryRun ? 'planned' : 'created',
      message: exists ? 'directory exists' : 'directory created',
    });
    if (!dryRun) fs.mkdirSync(dir, { recursive: true });
  }

  let config = readJsonFile<OsConfig>(configPath);
  if (config) {
    actions.push({
      type: 'preserve_file',
      path: configPath,
      status: 'preserved',
      message: 'config exists',
    });
  } else {
    config = createDefaultConfig(
      home,
      options.mode ?? 'local',
      options.port ?? DEFAULT_PORT,
    );
    actions.push({
      type: 'create_file',
      path: configPath,
      status: dryRun ? 'planned' : 'created',
      message: 'config created',
    });
    writeJsonFile(configPath, config, dryRun);
  }

  if (fs.existsSync(dbPath)) {
    actions.push({
      type: 'preserve_file',
      path: dbPath,
      status: 'preserved',
      message: 'database exists',
    });
  } else {
    actions.push({
      type: 'create_file',
      path: dbPath,
      status: dryRun ? 'planned' : 'created',
      message: 'database initialized',
    });
    if (!dryRun) {
      const db = new Database(dbPath);
      db.close();
    }
  }

  const agents = detectAgents(home);
  const requestedAgents = new Set(options.connectAgents ?? []);
  for (const agent of agents) {
    if (requestedAgents.has(agent.name))
      actions.push(...connectAgent(home, config, agent, dryRun));
  }

  if (!dryRun) {
    config.updatedAt = nowIso();
    writeJsonFile(configPath, config, false);
  }

  return { home, configPath, dbPath, actions, agents: detectAgents(home) };
}

export async function runDoctor(home?: string): Promise<DoctorResult> {
  const resolvedHome = resolveOsHome(home);
  const checks: DoctorCheck[] = [];
  const requiredPaths = [
    resolvedHome,
    path.join(resolvedHome, 'config.json'),
    ...REQUIRED_DIRS.map((entry) => path.join(resolvedHome, entry)),
  ];

  checks.push({
    name: 'bun',
    status: typeof Bun !== 'undefined' ? 'connected' : 'missing_capability',
    message:
      typeof Bun !== 'undefined' ? `Bun ${Bun.version}` : 'Bun is required',
  });

  for (const requiredPath of requiredPaths) {
    checks.push({
      name: path.basename(requiredPath) || requiredPath,
      status: fs.existsSync(requiredPath) ? 'connected' : 'not_configured',
      message: fs.existsSync(requiredPath)
        ? `${requiredPath} exists`
        : `${requiredPath} is missing`,
    });
  }

  try {
    const db = new Database(path.join(resolvedHome, 'consuelo.db'));
    db.close();
    checks.push({
      name: 'sqlite',
      status: 'connected',
      message: 'SQLite database opens',
    });
  } catch (error: unknown) {
    checks.push({
      name: 'sqlite',
      status: 'unhealthy',
      message:
        error instanceof Error ? error.message : 'SQLite database failed',
    });
  }

  try {
    const steering = getSteering();
    checks.push({
      name: 'portal',
      status: steering.includes('Consuelo OS') ? 'connected' : 'unhealthy',
      message: 'OS portal returned steering',
    });
  } catch (error: unknown) {
    checks.push({
      name: 'portal',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'OS portal failed',
    });
  }

  const skillIssues = validateBundledSkills();
  checks.push({
    name: 'skills',
    status: skillIssues.length === 0 ? 'connected' : 'unhealthy',
    message:
      skillIssues.length === 0
        ? 'bundled skill metadata matches manifest'
        : `${skillIssues.length} bundled skill issue(s)`,
  });

  try {
    const result = await executeCall({
      name: 'daily-revenue-brief',
      traceId: `trc_doctor_${Date.now().toString(36)}`,
    });
    checks.push({
      name: 'daily-revenue-brief',
      status: result.ok && result.artifacts?.length ? 'connected' : 'unhealthy',
      message: result.ok
        ? 'skill created a local artifact'
        : (result.error?.message ?? 'skill failed'),
    });
  } catch (error: unknown) {
    checks.push({
      name: 'daily-revenue-brief',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'skill failed',
    });
  }

  for (const agent of detectAgents(resolvedHome)) {
    checks.push({
      name: agent.label,
      status: agent.status,
      message: agent.detected
        ? agent.connected
          ? 'agent connection recorded'
          : 'agent detected, connection pending'
        : 'agent not detected',
    });
  }

  const capabilities = getCapabilityHealth(resolvedHome);
  for (const capability of capabilities) {
    checks.push({
      name: `capability:${capability.id}`,
      status: capability.status,
      message: capability.message,
    });
  }

  const basicChecksHealthy = checks.every(
    (check) =>
      check.status === 'connected' ||
      check.status === 'missing_capability' ||
      check.status === 'not_configured' ||
      check.status === 'local_only' ||
      check.status === 'cloud_only',
  );
  return {
    home: resolvedHome,
    checks,
    ok: basicChecksHealthy && isCapabilitySetHealthy(capabilities),
  };
}
