import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Effect } from 'effect';

export type AgentName =
  | 'codex'
  | 'cursor'
  | 'claude'
  | 'opencode'
  | 'factory'
  | 'gemini'
  | 'pi';

export type AgentConnectionStatus =
  | 'not_detected'
  | 'detected'
  | 'configured'
  | 'approval_required'
  | 'verified'
  | 'failed'
  | 'unsupported';

export type AgentConnectivityErrorCode =
  | 'AGENT_CONFIG_MALFORMED'
  | 'AGENT_CONFIG_STALE'
  | 'AGENT_CONFIG_READ_FAILED'
  | 'AGENT_CONFIG_WRITE_FAILED'
  | 'AGENT_UNSUPPORTED'
  | 'MCP_COMMAND_MISSING'
  | 'MCP_PROCESS_START_FAILED'
  | 'MCP_HANDSHAKE_TIMED_OUT'
  | 'MCP_HANDSHAKE_FAILED';

export type AgentConnectivityError = {
  _tag:
    | 'AgentConfigMalformed'
    | 'AgentConfigStale'
    | 'AgentConfigReadFailed'
    | 'AgentConfigWriteFailed'
    | 'AgentUnsupported'
    | 'McpCommandMissing'
    | 'McpProcessStartFailed'
    | 'McpHandshakeTimedOut'
    | 'McpHandshakeFailed';
  code: AgentConnectivityErrorCode;
  message: string;
  path?: string;
  cause?: string;
};

export type LocalAgentDetection = {
  name: AgentName;
  label: string;
  homePath: string;
  detectionPaths: string[];
  configPath: string;
  detected: boolean;
  support: 'native' | 'unsupported';
  status: AgentConnectionStatus;
  fingerprint?: string;
  configuredAt?: string;
  verifiedAt?: string;
  message?: string;
  error?: AgentConnectivityError;
};

export type LocalAgentConfigRecord = {
  name: AgentName;
  homePath: string;
  configPath: string;
  status: AgentConnectionStatus;
  fingerprint?: string;
  configuredAt?: string;
  verifiedAt?: string;
  updatedAt: string;
  message?: string;
  error?: AgentConnectivityError;
};

export type LocalAgentAction = {
  type: 'create_file' | 'connect_agent' | 'skip_agent';
  path: string;
  status: 'planned' | 'created' | 'preserved' | 'updated' | 'skipped';
  message: string;
};

export type ConfigureLocalAgentsResult = {
  agents: LocalAgentDetection[];
  records: LocalAgentConfigRecord[];
  actions: LocalAgentAction[];
};

export type LocalAgentMcpHandshake = {
  protocolVersion: string;
  toolCount: number;
};

export type VerifyLocalAgentsResult = {
  agents: LocalAgentDetection[];
  records: LocalAgentConfigRecord[];
  handshake?: LocalAgentMcpHandshake;
  error?: AgentConnectivityError;
};

type JsonObject = Record<string, unknown>;

type AgentCandidate = {
  name: AgentName;
  label: string;
  homePath: string;
  detectionPaths: string[];
  configPath: string;
  support: 'native' | 'unsupported';
  format: 'json-mcp-servers' | 'json-opencode' | 'toml-codex' | 'unsupported';
  includeStdioType?: boolean;
};

type PersistedOsConfig = JsonObject & {
  agents?: unknown;
};

type NativeConfigInspection = {
  configured: boolean;
  fingerprint?: string;
  error?: AgentConnectivityError;
};

const CONSUELO_MCP_NAME = 'consuelo';
const LEGACY_CONSUELO_MCP_NAME = 'consuelo-os';
const CODEX_BLOCK_START = '# BEGIN CONSUELO MCP';
const CODEX_BLOCK_END = '# END CONSUELO MCP';
const LEGACY_CODEX_BLOCK_START = '# BEGIN CONSUELO OS MCP';
const LEGACY_CODEX_BLOCK_END = '# END CONSUELO OS MCP';
const DEFAULT_MCP_TIMEOUT_MS = 10_000;

function nowIso(): string {
  return new Date().toISOString();
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function agentError(
  _tag: AgentConnectivityError['_tag'],
  code: AgentConnectivityErrorCode,
  message: string,
  input: { path?: string; cause?: unknown } = {},
): AgentConnectivityError {
  return {
    _tag,
    code,
    message,
    ...(input.path ? { path: input.path } : {}),
    ...(input.cause === undefined ? {} : { cause: errorCause(input.cause) }),
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isJsonObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, canonicalize(value[key])]),
  );
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

export function localAgentMcpCommandPath(home: string): string {
  return path.join(home, 'bin', 'consuelo-mcp');
}

function localAgentMcpCommandSource(): string {
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'OS_HOME="${CONSUELO_OS_HOME:-${CONSUELO_HOME:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}}"',
    'HOSTED_SCRIPT="$OS_HOME/runtime/current/scripts/mcp-stdio.ts"',
    'SOURCE_SCRIPT="$OS_HOME/scripts/mcp-stdio.ts"',
    'if [ -f "$HOSTED_SCRIPT" ]; then',
    '  MCP_SCRIPT="$HOSTED_SCRIPT"',
    'elif [ -f "$SOURCE_SCRIPT" ]; then',
    '  MCP_SCRIPT="$SOURCE_SCRIPT"',
    'else',
    '  echo "Consuelo MCP runtime is not installed under $OS_HOME." >&2',
    '  exit 1',
    'fi',
    'exec bun "$MCP_SCRIPT"',
    '',
  ].join('\n');
}

export function getLocalAgentCandidates(userHome = os.homedir()): AgentCandidate[] {
  return [
    {
      name: 'codex',
      label: 'Codex',
      homePath: path.join(userHome, '.codex'),
      detectionPaths: [path.join(userHome, '.codex')],
      configPath: path.join(userHome, '.codex', 'config.toml'),
      support: 'native',
      format: 'toml-codex',
    },
    {
      name: 'cursor',
      label: 'Cursor',
      homePath: path.join(userHome, '.cursor'),
      detectionPaths: [
        path.join(userHome, '.cursor'),
        path.join(userHome, 'Library', 'Application Support', 'Cursor', 'User'),
      ],
      configPath: path.join(userHome, '.cursor', 'mcp.json'),
      support: 'native',
      format: 'json-mcp-servers',
      includeStdioType: true,
    },
    {
      name: 'claude',
      label: 'Claude Code',
      homePath: path.join(userHome, '.claude'),
      detectionPaths: [
        path.join(userHome, '.claude'),
        path.join(userHome, 'Library', 'Application Support', 'Claude'),
      ],
      configPath: path.join(userHome, '.claude.json'),
      support: 'native',
      format: 'json-mcp-servers',
    },
    {
      name: 'opencode',
      label: 'OpenCode',
      homePath: path.join(userHome, '.config', 'opencode'),
      detectionPaths: [
        path.join(userHome, '.config', 'opencode'),
        path.join(userHome, '.opencode'),
      ],
      configPath: path.join(userHome, '.config', 'opencode', 'opencode.json'),
      support: 'native',
      format: 'json-opencode',
    },
    {
      name: 'factory',
      label: 'Factory Droid',
      homePath: path.join(userHome, '.factory'),
      detectionPaths: [path.join(userHome, '.factory')],
      configPath: path.join(userHome, '.factory', 'mcp.json'),
      support: 'native',
      format: 'json-mcp-servers',
    },
    {
      name: 'gemini',
      label: 'Gemini CLI',
      homePath: path.join(userHome, '.gemini'),
      detectionPaths: [
        path.join(userHome, '.gemini'),
        path.join(userHome, '.config', 'gemini'),
      ],
      configPath: path.join(userHome, '.gemini', 'settings.json'),
      support: 'native',
      format: 'json-mcp-servers',
    },
    {
      name: 'pi',
      label: 'Pi',
      homePath: path.join(userHome, 'Library', 'Application Support', 'Pi'),
      detectionPaths: [
        path.join(userHome, 'Library', 'Application Support', 'Pi'),
        path.join(userHome, '.config', 'pi'),
      ],
      configPath: path.join(userHome, 'Library', 'Application Support', 'Pi', 'mcp.json'),
      support: 'unsupported',
      format: 'unsupported',
    },
  ];
}

function expectedJsonEntry(candidate: AgentCandidate, home: string): JsonObject {
  const command = localAgentMcpCommandPath(home);
  if (candidate.format === 'json-opencode') {
    return {
      type: 'local',
      command: [command],
      cwd: home,
      enabled: true,
      environment: { CONSUELO_HOME: home, CONSUELO_AGENT_ID: candidate.name },
    };
  }

  return {
    ...(candidate.includeStdioType ? { type: 'stdio' } : {}),
    command,
    args: [],
    env: { CONSUELO_HOME: home, CONSUELO_AGENT_ID: candidate.name },
  };
}

function codexManagedBlock(home: string): string {
  const command = localAgentMcpCommandPath(home);
  return [
    CODEX_BLOCK_START,
    `[mcp_servers.${JSON.stringify(CONSUELO_MCP_NAME)}]`,
    `command = ${JSON.stringify(command)}`,
    'args = []',
    '',
    `[mcp_servers.${JSON.stringify(CONSUELO_MCP_NAME)}.env]`,
    `CONSUELO_HOME = ${JSON.stringify(home)}`,
    `CONSUELO_AGENT_ID = ${JSON.stringify('codex')}`,
    CODEX_BLOCK_END,
  ].join('\n');
}

function candidateFingerprint(candidate: AgentCandidate, home: string): string {
  const serverPath = path.join(home, 'scripts', 'mcp-stdio.ts');
  const serverDigest = fs.existsSync(serverPath)
    ? createHash('sha256').update(fs.readFileSync(serverPath)).digest('hex')
    : 'missing';
  return fingerprint({
    clientEntry: candidate.format === 'toml-codex'
      ? codexManagedBlock(home)
      : expectedJsonEntry(candidate, home),
    commandSource: localAgentMcpCommandSource(),
    serverDigest,
  });
}

function parseJsonConfig(configPath: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as unknown;
  if (!isJsonObject(parsed)) throw new Error('expected a JSON object');
  return parsed;
}

function inspectJsonCandidate(candidate: AgentCandidate, home: string): NativeConfigInspection {
  if (!fs.existsSync(candidate.configPath)) return { configured: false };
  let config: JsonObject;
  try {
    config = parseJsonConfig(candidate.configPath);
  } catch (cause: unknown) {
    return {
      configured: false,
      error: agentError(
        'AgentConfigMalformed',
        'AGENT_CONFIG_MALFORMED',
        `${candidate.label} configuration is malformed JSON.`,
        { path: candidate.configPath, cause },
      ),
    };
  }

  const containerKey = candidate.format === 'json-opencode' ? 'mcp' : 'mcpServers';
  const container = config[containerKey];
  if (container === undefined) return { configured: false };
  if (!isJsonObject(container)) {
    return {
      configured: false,
      error: agentError(
        'AgentConfigMalformed',
        'AGENT_CONFIG_MALFORMED',
        `${candidate.label} ${containerKey} configuration must be an object.`,
        { path: candidate.configPath },
      ),
    };
  }

  const entry = container[CONSUELO_MCP_NAME];
  if (entry === undefined) return { configured: false };
  const expected = expectedJsonEntry(candidate, home);
  if (!valuesEqual(entry, expected)) {
    return {
      configured: false,
      error: agentError(
        'AgentConfigStale',
        'AGENT_CONFIG_STALE',
        `${candidate.label} has a stale Consuelo MCP entry and must be repaired.`,
        { path: candidate.configPath },
      ),
    };
  }

  return { configured: true, fingerprint: candidateFingerprint(candidate, home) };
}

function parseToml(content: string): JsonObject {
  const bunGlobal = (globalThis as typeof globalThis & {
    Bun?: { TOML?: { parse?: (value: string) => unknown } };
  }).Bun;
  let parsed: unknown;
  if (typeof bunGlobal?.TOML?.parse === 'function') {
    parsed = bunGlobal.TOML.parse(content);
  } else {
    const result = spawnSync('bun', ['-e', [
      'const input = await new Response(Bun.stdin.stream()).text();',
      'process.stdout.write(JSON.stringify(Bun.TOML.parse(input)));',
    ].join(' ')], {
      input: content,
      encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error(result.stderr || 'Bun TOML parser failed.');
    parsed = JSON.parse(result.stdout) as unknown;
  }
  if (!isJsonObject(parsed)) throw new Error('expected a TOML object');
  return parsed;
}

function inspectCodexCandidate(candidate: AgentCandidate, home: string): NativeConfigInspection {
  if (!fs.existsSync(candidate.configPath)) return { configured: false };
  let content: string;
  try {
    content = fs.readFileSync(candidate.configPath, 'utf8');
    parseToml(content);
  } catch (cause: unknown) {
    return {
      configured: false,
      error: agentError(
        'AgentConfigMalformed',
        'AGENT_CONFIG_MALFORMED',
        `${candidate.label} configuration is malformed TOML.`,
        { path: candidate.configPath, cause },
      ),
    };
  }

  const expected = codexManagedBlock(home);
  if (content.includes(expected)) {
    return { configured: true, fingerprint: candidateFingerprint(candidate, home) };
  }
  if (content.includes(`[mcp_servers.${JSON.stringify(CONSUELO_MCP_NAME)}]`)) {
    return {
      configured: false,
      error: agentError(
        'AgentConfigStale',
        'AGENT_CONFIG_STALE',
        `${candidate.label} has a stale Consuelo MCP entry and must be repaired.`,
        { path: candidate.configPath },
      ),
    };
  }
  return { configured: false };
}

function inspectNativeConfiguration(candidate: AgentCandidate, home: string): NativeConfigInspection {
  if (candidate.format === 'toml-codex') return inspectCodexCandidate(candidate, home);
  if (candidate.format === 'json-mcp-servers' || candidate.format === 'json-opencode') {
    return inspectJsonCandidate(candidate, home);
  }
  return { configured: false };
}

function readPersistedRecords(home: string): Map<AgentName, LocalAgentConfigRecord> {
  const configPath = path.join(home, 'config.json');
  if (!fs.existsSync(configPath)) return new Map();
  try {
    const config = parseJsonConfig(configPath) as PersistedOsConfig;
    if (!Array.isArray(config.agents)) return new Map();
    const records = new Map<AgentName, LocalAgentConfigRecord>();
    for (const value of config.agents) {
      if (!isJsonObject(value)) continue;
      const name = value.name;
      const status = value.status;
      if (
        typeof name !== 'string' ||
        !['codex', 'cursor', 'claude', 'opencode', 'factory', 'gemini', 'pi'].includes(name) ||
        typeof status !== 'string' ||
        !['not_detected', 'detected', 'configured', 'approval_required', 'verified', 'failed', 'unsupported'].includes(status)
      ) {
        continue;
      }
      records.set(name as AgentName, value as LocalAgentConfigRecord);
    }
    return records;
  } catch {
    return new Map();
  }
}

function detectedCandidate(candidate: AgentCandidate): boolean {
  return fs.existsSync(candidate.configPath) || candidate.detectionPaths.some((candidatePath) => fs.existsSync(candidatePath));
}

function publicCandidate(candidate: AgentCandidate): Omit<LocalAgentDetection, 'detected' | 'status'> {
  return {
    name: candidate.name,
    label: candidate.label,
    homePath: candidate.homePath,
    detectionPaths: candidate.detectionPaths,
    configPath: candidate.configPath,
    support: candidate.support,
  };
}

export function detectLocalAgents(input: {
  home: string;
  userHome?: string;
}): LocalAgentDetection[] {
  const persisted = readPersistedRecords(input.home);
  return getLocalAgentCandidates(input.userHome).map((candidate) => {
    const detected = detectedCandidate(candidate);
    if (!detected) {
      return {
        ...publicCandidate(candidate),
        detected: false,
        status: 'not_detected' as const,
        message: `${candidate.label} was not detected.`,
      };
    }
    if (candidate.support === 'unsupported') {
      return {
        ...publicCandidate(candidate),
        detected: true,
        status: 'unsupported' as const,
        message: `${candidate.label} is detected, but no authoritative native MCP registration path is available.`,
        error: agentError(
          'AgentUnsupported',
          'AGENT_UNSUPPORTED',
          `${candidate.label} native MCP configuration is not supported.`,
          { path: candidate.configPath },
        ),
      };
    }

    const inspection = inspectNativeConfiguration(candidate, input.home);
    if (inspection.error) {
      return {
        ...publicCandidate(candidate),
        detected: true,
        status: 'failed' as const,
        message: inspection.error.message,
        error: inspection.error,
      };
    }
    if (!inspection.configured || !inspection.fingerprint) {
      return {
        ...publicCandidate(candidate),
        detected: true,
        status: 'detected' as const,
        message: `${candidate.label} is detected and not configured for Consuelo MCP.`,
      };
    }
    const commandPath = localAgentMcpCommandPath(input.home);
    if (!fs.existsSync(commandPath)) {
      const error = agentError(
        'McpCommandMissing',
        'MCP_COMMAND_MISSING',
        'Consuelo local MCP command is missing.',
        { path: commandPath },
      );
      return {
        ...publicCandidate(candidate),
        detected: true,
        status: 'failed' as const,
        message: error.message,
        error,
      };
    }

    const previous = persisted.get(candidate.name);
    const verified = previous?.status === 'verified' && previous.fingerprint === inspection.fingerprint;
    return {
      ...publicCandidate(candidate),
      detected: true,
      status: verified ? 'verified' as const : 'configured' as const,
      fingerprint: inspection.fingerprint,
      ...(previous?.configuredAt ? { configuredAt: previous.configuredAt } : {}),
      ...(verified && previous?.verifiedAt ? { verifiedAt: previous.verifiedAt } : {}),
      message: verified
        ? `${candidate.label} MCP connection is verified.`
        : `${candidate.label} MCP configuration is installed and awaiting verification.`,
    };
  });
}

export function toLocalAgentConfigRecords(
  agents: readonly LocalAgentDetection[],
  previous: ReadonlyMap<AgentName, LocalAgentConfigRecord> = new Map(),
): LocalAgentConfigRecord[] {
  const updatedAt = nowIso();
  return agents
    .filter((agent) => agent.detected || agent.status !== 'not_detected')
    .map((agent) => {
      const prior = previous.get(agent.name);
      return {
        name: agent.name,
        homePath: agent.homePath,
        configPath: agent.configPath,
        status: agent.status,
        ...(agent.fingerprint ? { fingerprint: agent.fingerprint } : {}),
        ...(agent.configuredAt ?? prior?.configuredAt ? { configuredAt: agent.configuredAt ?? prior?.configuredAt } : {}),
        ...(agent.verifiedAt ? { verifiedAt: agent.verifiedAt } : {}),
        updatedAt,
        ...(agent.message ? { message: agent.message } : {}),
        ...(agent.error ? { error: agent.error } : {}),
      };
    });
}

function tryFs<T>(
  operation: () => T,
  error: (cause: unknown) => AgentConnectivityError,
): Effect.Effect<T, AgentConnectivityError> {
  return Effect.try({ try: operation, catch: error });
}

function writeFileAtomicallyEffect(
  filePath: string,
  content: string,
  mode: number,
): Effect.Effect<void, AgentConnectivityError> {
  return tryFs(
    () => {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const temporaryPath = `${filePath}.tmp-${process.pid}`;
      fs.writeFileSync(temporaryPath, content, { mode });
      fs.renameSync(temporaryPath, filePath);
      fs.chmodSync(filePath, mode);
    },
    (cause) => agentError(
      'AgentConfigWriteFailed',
      'AGENT_CONFIG_WRITE_FAILED',
      `Failed to write ${filePath}.`,
      { path: filePath, cause },
    ),
  );
}

function backupOnceEffect(filePath: string): Effect.Effect<void, AgentConnectivityError> {
  return tryFs(
    () => {
      const backupPath = `${filePath}.bak`;
      if (fs.existsSync(filePath) && !fs.existsSync(backupPath)) fs.copyFileSync(filePath, backupPath);
    },
    (cause) => agentError(
      'AgentConfigWriteFailed',
      'AGENT_CONFIG_WRITE_FAILED',
      `Failed to back up ${filePath}.`,
      { path: filePath, cause },
    ),
  );
}

function materializeMcpCommandEffect(input: {
  home: string;
  dryRun: boolean;
}): Effect.Effect<LocalAgentAction, AgentConnectivityError> {
  const commandPath = localAgentMcpCommandPath(input.home);
  const source = localAgentMcpCommandSource();
  return Effect.gen(function* () {
    const existing = fs.existsSync(commandPath) ? fs.readFileSync(commandPath, 'utf8') : null;
    if (!input.dryRun && existing !== source) yield* writeFileAtomicallyEffect(commandPath, source, 0o755);
    return {
      type: 'create_file' as const,
      path: commandPath,
      status: input.dryRun
        ? 'planned' as const
        : existing === source
          ? 'preserved' as const
          : existing === null
            ? 'created' as const
            : 'updated' as const,
      message: 'Consuelo local MCP command installed.',
    };
  });
}

function removeCodexConsueloSections(content: string): string {
  // remove legacy Consuelo OS MCP entries during migration.
  const withoutManaged = content.replace(
    new RegExp(`${CODEX_BLOCK_START}[\\s\\S]*?${CODEX_BLOCK_END}\\s*`, 'g'),
    '',
  ).replace(
    new RegExp(`${LEGACY_CODEX_BLOCK_START}[\\s\\S]*?${LEGACY_CODEX_BLOCK_END}\\s*`, 'g'),
    '',
  );
  const lines = withoutManaged.split('\n');
  const output: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const header = trimmed.match(/^\[([^\]]+)\]$/)?.[1];
    if (header !== undefined) {
      skipping = [
        CONSUELO_MCP_NAME,
        LEGACY_CONSUELO_MCP_NAME,
      ].some((name) =>
        header === `mcp_servers.${JSON.stringify(name)}` ||
        header === `mcp_servers.${JSON.stringify(name)}.env`
      );
      if (!skipping) output.push(line);
      continue;
    }
    if (!skipping) output.push(line);
  }
  return output.join('\n').trimEnd();
}

function configureCodexEffect(input: {
  candidate: AgentCandidate;
  home: string;
  dryRun: boolean;
}): Effect.Effect<LocalAgentAction, AgentConnectivityError> {
  return Effect.gen(function* () {
    const current = fs.existsSync(input.candidate.configPath)
      ? yield* tryFs(
          () => fs.readFileSync(input.candidate.configPath, 'utf8'),
          (cause) => agentError(
            'AgentConfigReadFailed',
            'AGENT_CONFIG_READ_FAILED',
            `Failed to read ${input.candidate.label} configuration.`,
            { path: input.candidate.configPath, cause },
          ),
        )
      : '';
    if (current.length > 0) {
      yield* tryFs(
        () => parseToml(current),
        (cause) => agentError(
          'AgentConfigMalformed',
          'AGENT_CONFIG_MALFORMED',
          `${input.candidate.label} configuration is malformed TOML.`,
          { path: input.candidate.configPath, cause },
        ),
      );
    }
    const base = removeCodexConsueloSections(current);
    const next = `${base}${base.length > 0 ? '\n\n' : ''}${codexManagedBlock(input.home)}\n`;
    yield* tryFs(
      () => parseToml(next),
      (cause) => agentError(
        'AgentConfigMalformed',
        'AGENT_CONFIG_MALFORMED',
        `Generated ${input.candidate.label} configuration is invalid TOML.`,
        { path: input.candidate.configPath, cause },
      ),
    );
    if (!input.dryRun && next !== current) {
      yield* backupOnceEffect(input.candidate.configPath);
      yield* writeFileAtomicallyEffect(input.candidate.configPath, next, 0o600);
    }
    return {
      type: 'connect_agent' as const,
      path: input.candidate.configPath,
      status: input.dryRun
        ? 'planned' as const
        : next === current
          ? 'preserved' as const
          : fs.existsSync(`${input.candidate.configPath}.bak`)
            ? 'updated' as const
            : 'created' as const,
      message: `${input.candidate.label} MCP native configuration installed.`,
    };
  });
}

function configureJsonEffect(input: {
  candidate: AgentCandidate;
  home: string;
  dryRun: boolean;
}): Effect.Effect<LocalAgentAction, AgentConnectivityError> {
  return Effect.gen(function* () {
    let current: JsonObject = {};
    let currentText = '';
    if (fs.existsSync(input.candidate.configPath)) {
      currentText = yield* tryFs(
        () => fs.readFileSync(input.candidate.configPath, 'utf8'),
        (cause) => agentError(
          'AgentConfigReadFailed',
          'AGENT_CONFIG_READ_FAILED',
          `Failed to read ${input.candidate.label} configuration.`,
          { path: input.candidate.configPath, cause },
        ),
      );
      current = yield* tryFs(
        () => {
          const parsed = JSON.parse(currentText) as unknown;
          if (!isJsonObject(parsed)) throw new Error('expected a JSON object');
          return parsed;
        },
        (cause) => agentError(
          'AgentConfigMalformed',
          'AGENT_CONFIG_MALFORMED',
          `${input.candidate.label} configuration is malformed JSON.`,
          { path: input.candidate.configPath, cause },
        ),
      );
    }

    const containerKey = input.candidate.format === 'json-opencode' ? 'mcp' : 'mcpServers';
    const existingContainer = current[containerKey];
    if (existingContainer !== undefined && !isJsonObject(existingContainer)) {
      return yield* Effect.fail(agentError(
        'AgentConfigMalformed',
        'AGENT_CONFIG_MALFORMED',
        `${input.candidate.label} ${containerKey} configuration must be an object.`,
        { path: input.candidate.configPath },
      ));
    }
    const nextContainer = {
      ...(isJsonObject(existingContainer) ? existingContainer : {}),
    };
    delete nextContainer[LEGACY_CONSUELO_MCP_NAME];
    const next: JsonObject = {
      ...current,
      ...(input.candidate.format === 'json-opencode' && typeof current.$schema !== 'string'
        ? { $schema: 'https://opencode.ai/config.json' }
        : {}),
      [containerKey]: {
        ...nextContainer,
        [CONSUELO_MCP_NAME]: expectedJsonEntry(input.candidate, input.home),
      },
    };
    const nextText = `${JSON.stringify(next, null, 2)}\n`;
    if (!input.dryRun && nextText !== currentText) {
      yield* backupOnceEffect(input.candidate.configPath);
      yield* writeFileAtomicallyEffect(input.candidate.configPath, nextText, 0o600);
    }
    return {
      type: 'connect_agent' as const,
      path: input.candidate.configPath,
      status: input.dryRun
        ? 'planned' as const
        : nextText === currentText
          ? 'preserved' as const
          : currentText.length > 0
            ? 'updated' as const
            : 'created' as const,
      message: `${input.candidate.label} MCP native configuration installed.`,
    };
  });
}

function configureCandidateEffect(input: {
  candidate: AgentCandidate;
  home: string;
  dryRun: boolean;
}): Effect.Effect<LocalAgentAction, AgentConnectivityError> {
  if (input.candidate.format === 'toml-codex') return configureCodexEffect(input);
  if (input.candidate.format === 'json-mcp-servers' || input.candidate.format === 'json-opencode') {
    return configureJsonEffect(input);
  }
  return Effect.fail(agentError(
    'AgentUnsupported',
    'AGENT_UNSUPPORTED',
    `${input.candidate.label} native MCP configuration is not supported.`,
    { path: input.candidate.configPath },
  ));
}

function persistLocalAgentRecordsEffect(input: {
  home: string;
  records: LocalAgentConfigRecord[];
}): Effect.Effect<void, AgentConnectivityError> {
  const configPath = path.join(input.home, 'config.json');
  if (!fs.existsSync(configPath)) return Effect.void;
  return Effect.gen(function* () {
    const config = yield* tryFs(
      () => parseJsonConfig(configPath),
      (cause) => agentError(
        'AgentConfigMalformed',
        'AGENT_CONFIG_MALFORMED',
        'Consuelo OS config is malformed JSON.',
        { path: configPath, cause },
      ),
    );
    const next = { ...config, agents: input.records, updatedAt: nowIso() };
    yield* writeFileAtomicallyEffect(configPath, `${JSON.stringify(next, null, 2)}\n`, 0o600);
  });
}

export function persistLocalAgentRecords(
  home: string,
  records: LocalAgentConfigRecord[],
): void {
  Effect.runSync(persistLocalAgentRecordsEffect({ home, records }));
}

export function configureLocalAgentsEffect(input: {
  home: string;
  userHome?: string;
  agentNames: readonly AgentName[];
  dryRun?: boolean;
  persist?: boolean;
}): Effect.Effect<ConfigureLocalAgentsResult, AgentConnectivityError> {
  const dryRun = Boolean(input.dryRun);
  const requested = new Set(input.agentNames);
  const userHome = input.userHome ?? os.homedir();
  return Effect.gen(function* () {
    const actions: LocalAgentAction[] = [];
    const errorsByAgent = new Map<AgentName, AgentConnectivityError>();
    const candidates = getLocalAgentCandidates(userHome);
    const shouldInstallCommand = candidates.some(
      (candidate) => requested.has(candidate.name) && candidate.support === 'native' && detectedCandidate(candidate),
    );
    if (shouldInstallCommand) {
      const commandAction = yield* materializeMcpCommandEffect({ home: input.home, dryRun }).pipe(
        Effect.catchAll((error) => {
          for (const candidate of candidates) {
            if (requested.has(candidate.name) && candidate.support === 'native' && detectedCandidate(candidate)) {
              errorsByAgent.set(candidate.name, error);
            }
          }
          return Effect.succeed<LocalAgentAction>({
            type: 'create_file',
            path: localAgentMcpCommandPath(input.home),
            status: 'skipped',
            message: error.message,
          });
        }),
      );
      if (!actions.includes(commandAction)) actions.push(commandAction);
    }

    for (const candidate of candidates) {
      if (!requested.has(candidate.name)) continue;
      if (!detectedCandidate(candidate)) {
        actions.push({
          type: 'skip_agent',
          path: candidate.homePath,
          status: 'skipped',
          message: `${candidate.label} was not detected.`,
        });
        continue;
      }
      if (candidate.support === 'unsupported') {
        actions.push({
          type: 'skip_agent',
          path: candidate.homePath,
          status: 'skipped',
          message: `${candidate.label} is detected but native MCP configuration is unsupported.`,
        });
        continue;
      }
      if (errorsByAgent.has(candidate.name)) continue;
      const action = yield* configureCandidateEffect({ candidate, home: input.home, dryRun }).pipe(
        Effect.catchAll((error) => {
          errorsByAgent.set(candidate.name, error);
          return Effect.succeed<LocalAgentAction>({
            type: 'skip_agent',
            path: candidate.configPath,
            status: 'skipped',
            message: error.message,
          });
        }),
      );
      actions.push(action);
    }

    const agents = detectLocalAgents({ home: input.home, userHome });
    const previous = readPersistedRecords(input.home);
    const configuredAt = nowIso();
    const adjustedAgents = agents.map((agent) => {
      const configurationError = errorsByAgent.get(agent.name);
      if (configurationError) {
        return {
          ...agent,
          status: 'failed' as const,
          message: configurationError.message,
          error: configurationError,
          verifiedAt: undefined,
        };
      }
      if (!requested.has(agent.name) || (agent.status !== 'configured' && agent.status !== 'verified')) {
        return agent;
      }
      return {
        ...agent,
        status: 'configured' as const,
        configuredAt: agent.configuredAt ?? configuredAt,
        verifiedAt: undefined,
        message: `${agent.label} MCP configuration is installed and awaiting verification.`,
      };
    });
    const records = toLocalAgentConfigRecords(adjustedAgents, previous);
    if (!dryRun && input.persist !== false) {
      yield* persistLocalAgentRecordsEffect({ home: input.home, records });
    }
    return { agents: adjustedAgents, records, actions };
  });
}

export function configureLocalAgents(input: {
  home: string;
  userHome?: string;
  agentNames: readonly AgentName[];
  dryRun?: boolean;
  persist?: boolean;
}): ConfigureLocalAgentsResult {
  return Effect.runSync(configureLocalAgentsEffect(input));
}

class ProbeFailure extends Error {
  constructor(readonly detail: AgentConnectivityError) {
    super(detail.message);
  }
}

export function parseMcpJsonLines(buffer: Buffer): {
  messages: JsonObject[];
  remainder: Buffer;
} {
  const messages: JsonObject[] = [];
  let offset = 0;
  while (offset < buffer.length) {
    const newline = buffer.indexOf(0x0a, offset);
    if (newline < 0) break;
    const line = buffer.subarray(offset, newline).toString('utf8').trim();
    offset = newline + 1;
    if (!line) continue;
    const parsed = JSON.parse(line) as unknown;
    if (!isJsonObject(parsed)) throw new Error('MCP response must be a JSON object.');
    messages.push(parsed);
  }
  return { messages, remainder: buffer.subarray(offset) };
}

function probeMcpCommand(input: {
  home: string;
  agentId: AgentName;
  timeoutMs: number;
}): Promise<LocalAgentMcpHandshake> {
  return new Promise((resolve, reject) => {
    const commandPath = localAgentMcpCommandPath(input.home);
    if (!fs.existsSync(commandPath)) {
      reject(new ProbeFailure(agentError(
        'McpCommandMissing',
        'MCP_COMMAND_MISSING',
        'Consuelo local MCP command is missing.',
        { path: commandPath },
      )));
      return;
    }

    let settled = false;
    let stdout = Buffer.alloc(0);
    let stderr = '';
    let initialized: JsonObject | undefined;
    let tools: JsonObject | undefined;
    let toolsRequested = false;
    const child = spawn(commandPath, [], {
      cwd: input.home,
      env: {
        ...process.env,
        CONSUELO_HOME: input.home,
        CONSUELO_OS_HOME: input.home,
        CONSUELO_AGENT_ID: input.agentId,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const finish = (result: LocalAgentMcpHandshake | AgentConnectivityError, ok: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!child.killed) child.kill('SIGTERM');
      if (ok) resolve(result as LocalAgentMcpHandshake);
      else reject(new ProbeFailure(result as AgentConnectivityError));
    };

    const timer = setTimeout(() => {
      finish(agentError(
        'McpHandshakeTimedOut',
        'MCP_HANDSHAKE_TIMED_OUT',
        `Consuelo MCP handshake timed out after ${input.timeoutMs}ms.`,
        { path: commandPath, cause: stderr || undefined },
      ), false);
    }, input.timeoutMs);

    child.on('error', (cause) => {
      finish(agentError(
        'McpProcessStartFailed',
        'MCP_PROCESS_START_FAILED',
        'Failed to start the Consuelo local MCP command.',
        { path: commandPath, cause },
      ), false);
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.stdout.on('data', (chunk: Buffer) => {
      stdout = Buffer.concat([stdout, chunk]);
      try {
        const parsed = parseMcpJsonLines(stdout);
        stdout = parsed.remainder;
        for (const message of parsed.messages) {
          if (isJsonObject(message.error)) {
            throw new Error(`MCP request ${String(message.id ?? 'unknown')} failed: ${JSON.stringify(message.error)}`);
          }
          if (message.id === 1 && isJsonObject(message.result)) {
            initialized = message.result;
            if (!toolsRequested) {
              toolsRequested = true;
              child.stdin.write(`${JSON.stringify({
                jsonrpc: '2.0',
                method: 'notifications/initialized',
                params: {},
              })}\n`);
              child.stdin.write(`${JSON.stringify({
                jsonrpc: '2.0',
                id: 3,
                method: 'tools/list',
                params: {},
              })}\n`);
            }
          }
          if (message.id === 3 && isJsonObject(message.result)) tools = message.result;
        }
        const protocolVersion = initialized?.protocolVersion;
        const toolList = tools?.tools;
        if (typeof protocolVersion === 'string' && Array.isArray(toolList)) {
          if (toolList.length === 0) {
            finish(agentError(
              'McpHandshakeFailed',
              'MCP_HANDSHAKE_FAILED',
              'Consuelo MCP handshake returned no tools.',
              { path: commandPath },
            ), false);
            return;
          }
          finish({ protocolVersion, toolCount: toolList.length }, true);
        }
      } catch (cause: unknown) {
        finish(agentError(
          'McpHandshakeFailed',
          'MCP_HANDSHAKE_FAILED',
          'Consuelo MCP returned an invalid handshake response.',
          { path: commandPath, cause },
        ), false);
      }
    });
    child.on('close', (code) => {
      if (settled) return;
      finish(agentError(
        'McpHandshakeFailed',
        'MCP_HANDSHAKE_FAILED',
        `Consuelo MCP command exited before verification${code === null ? '' : ` with code ${code}`}.`,
        { path: commandPath, cause: stderr || undefined },
      ), false);
    });

    child.stdin.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'consuelo-verifier', version: '1.0.0' },
      },
    })}\n`);
  });
}

function probeMcpCommandEffect(input: {
  home: string;
  agentId: AgentName;
  timeoutMs: number;
}): Effect.Effect<LocalAgentMcpHandshake, AgentConnectivityError> {
  return Effect.tryPromise({
    try: () => probeMcpCommand(input),
    catch: (cause) => cause instanceof ProbeFailure
      ? cause.detail
      : agentError(
          'McpHandshakeFailed',
          'MCP_HANDSHAKE_FAILED',
          'Consuelo MCP verification failed.',
          { cause },
        ),
  });
}

export function verifyLocalAgentsEffect(input: {
  home: string;
  userHome?: string;
  agentNames: readonly AgentName[];
  timeoutMs?: number;
}): Effect.Effect<VerifyLocalAgentsResult, AgentConnectivityError> {
  const userHome = input.userHome ?? os.homedir();
  const requested = new Set(input.agentNames);
  return Effect.gen(function* () {
    const before = detectLocalAgents({ home: input.home, userHome });
    const targets = before.filter(
      (agent) => requested.has(agent.name) && (
        agent.status === 'configured' || agent.status === 'verified'
      ),
    );
    const previous = readPersistedRecords(input.home);
    if (targets.length === 0) {
      const records = toLocalAgentConfigRecords(before, previous);
      yield* persistLocalAgentRecordsEffect({ home: input.home, records });
      return { agents: before, records };
    }

    const probes = yield* Effect.forEach(targets, (target) =>
      probeMcpCommandEffect({
        home: input.home,
        agentId: target.name,
        timeoutMs: input.timeoutMs ?? DEFAULT_MCP_TIMEOUT_MS,
      }).pipe(
        Effect.either,
        Effect.map((outcome) => ({ name: target.name, outcome })),
      ),
    );
    const probesByAgent = new Map(
      probes.map((probe) => [probe.name, probe.outcome] as const),
    );
    const verifiedAt = nowIso();
    const agents = before.map((agent) => {
      const probe = probesByAgent.get(agent.name);
      if (!probe) return agent;
      if (probe._tag === 'Left') {
        return {
          ...agent,
          status: 'failed' as const,
          message: probe.left.message,
          error: probe.left,
        };
      }
      return {
        ...agent,
        status: 'verified' as const,
        verifiedAt,
        message: `${agent.label} MCP connection is verified.`,
        error: undefined,
      };
    });
    const records = toLocalAgentConfigRecords(agents, previous);
    yield* persistLocalAgentRecordsEffect({ home: input.home, records });
    const firstSuccess = probes.find((probe) => probe.outcome._tag === 'Right');
    const firstFailure = probes.find((probe) => probe.outcome._tag === 'Left');
    return {
      agents,
      records,
      ...(firstSuccess?.outcome._tag === 'Right'
        ? { handshake: firstSuccess.outcome.right }
        : {}),
      ...(firstFailure?.outcome._tag === 'Left'
        ? { error: firstFailure.outcome.left }
        : {}),
    };
  });
}

export async function verifyLocalAgents(input: {
  home: string;
  userHome?: string;
  agentNames: readonly AgentName[];
  timeoutMs?: number;
}): Promise<VerifyLocalAgentsResult> {
  return Effect.runPromise(verifyLocalAgentsEffect(input));
}
