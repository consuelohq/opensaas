import fs from 'node:fs';
import path from 'node:path';

export const WORKSPACE_NODE_SNAPSHOT_MAX_AGE_MS = 3 * 60_000;

const SNAPSHOT_VERSION = 1 as const;
const SNAPSHOT_KIND = 'consuelo-workspace-node-snapshot' as const;
const FORBIDDEN_FIELD =
  /token|secret|password|credential|authorization|cookie|private.?key|connector.?id|public.?key.?thumbprint/i;

export type WorkspaceNodeSnapshotNode = {
  workspaceId: string;
  nodeId: string;
  displayName: string;
  role: 'home' | 'member';
  platform: string;
  architecture: string;
  channel: string;
  capabilities: string[];
  agents: string[] | null;
  createdAt: string;
  lastSeenAt: string | null;
  presence: 'online' | 'stale' | 'offline';
  state: 'active' | 'revoked';
};

export type WorkspaceNodeSnapshot = {
  workspaceId: string;
  workspaceHost: string;
  currentNodeId: string | null;
  defaultNodeId: string | null;
  nodes: WorkspaceNodeSnapshotNode[];
};

type StoredWorkspaceNodeSnapshot = {
  version: typeof SNAPSHOT_VERSION;
  kind: typeof SNAPSHOT_KIND;
  observedAt: string;
  workspaceId: string;
  currentNodeId: string;
  workspace: WorkspaceNodeSnapshot;
};

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is invalid`);
  }
  return value.trim();
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null;
  return requiredString(value, label);
}

function assertNoForbiddenFields(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) assertNoForbiddenFields(entry);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_FIELD.test(key)) {
      throw new Error('workspace node snapshot contains a forbidden field');
    }
    assertNoForbiddenFields(child);
  }
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new Error(`${label} is invalid`);
  }
  return value.map((entry) => entry.trim()).filter(Boolean);
}

export function parseWorkspaceNodeSnapshot(value: unknown): WorkspaceNodeSnapshot {
  assertNoForbiddenFields(value);
  const raw = objectValue(value, 'workspace node snapshot');
  const workspaceId = requiredString(raw.workspaceId, 'workspace node snapshot workspaceId');
  const workspaceHost = requiredString(raw.workspaceHost, 'workspace node snapshot workspaceHost');
  const currentNodeId = nullableString(
    raw.currentNodeId,
    'workspace node snapshot currentNodeId',
  );
  const defaultNodeId = nullableString(
    raw.defaultNodeId,
    'workspace node snapshot defaultNodeId',
  );
  if (!Array.isArray(raw.nodes)) {
    throw new Error('workspace node snapshot nodes are invalid');
  }
  const seen = new Set<string>();
  const nodes = raw.nodes.map((entry, index): WorkspaceNodeSnapshotNode => {
    const node = objectValue(entry, `workspace node snapshot node ${index}`);
    const nodeWorkspaceId = requiredString(
      node.workspaceId,
      `workspace node snapshot node ${index} workspaceId`,
    );
    if (nodeWorkspaceId !== workspaceId) {
      throw new Error('workspace node snapshot crosses workspace boundaries');
    }
    const nodeId = requiredString(node.nodeId, `workspace node snapshot node ${index} nodeId`);
    if (seen.has(nodeId)) throw new Error('workspace node snapshot contains duplicate nodes');
    seen.add(nodeId);
    const role = node.role;
    const presence = node.presence;
    const state = node.state;
    if (role !== 'home' && role !== 'member') {
      throw new Error(`workspace node snapshot node ${index} role is invalid`);
    }
    if (presence !== 'online' && presence !== 'stale' && presence !== 'offline') {
      throw new Error(`workspace node snapshot node ${index} presence is invalid`);
    }
    if (state !== 'active' && state !== 'revoked') {
      throw new Error(`workspace node snapshot node ${index} state is invalid`);
    }
    const agents = node.agents === null || node.agents === undefined
      ? null
      : stringArray(node.agents, `workspace node snapshot node ${index} agents`);
    return {
      workspaceId: nodeWorkspaceId,
      nodeId,
      displayName: requiredString(
        node.displayName,
        `workspace node snapshot node ${index} displayName`,
      ),
      role,
      platform: requiredString(node.platform, `workspace node snapshot node ${index} platform`),
      architecture: requiredString(
        node.architecture,
        `workspace node snapshot node ${index} architecture`,
      ),
      channel: requiredString(node.channel, `workspace node snapshot node ${index} channel`),
      capabilities: stringArray(
        node.capabilities,
        `workspace node snapshot node ${index} capabilities`,
      ),
      agents,
      createdAt: requiredString(node.createdAt, `workspace node snapshot node ${index} createdAt`),
      lastSeenAt: nullableString(
        node.lastSeenAt,
        `workspace node snapshot node ${index} lastSeenAt`,
      ),
      presence,
      state,
    };
  });
  if (currentNodeId && !seen.has(currentNodeId)) {
    throw new Error('workspace node snapshot current node is missing');
  }
  if (defaultNodeId && !seen.has(defaultNodeId)) {
    throw new Error('workspace node snapshot default node is missing');
  }
  return { workspaceId, workspaceHost, currentNodeId, defaultNodeId, nodes };
}

export function workspaceNodeSnapshotPath(home: string): string {
  return path.join(home, 'node', 'cache', 'workspace-nodes.json');
}

export function writeStoredWorkspaceNodeSnapshot(input: {
  home: string;
  workspace: WorkspaceNodeSnapshot;
  expectedWorkspaceId: string;
  expectedCurrentNodeId: string;
  observedAt?: Date;
}): void {
  const workspace = parseWorkspaceNodeSnapshot(input.workspace);
  if (
    workspace.workspaceId !== input.expectedWorkspaceId ||
    workspace.currentNodeId !== input.expectedCurrentNodeId
  ) {
    throw new Error('workspace node snapshot identity does not match the enrolled node');
  }
  const target = workspaceNodeSnapshotPath(input.home);
  const directory = path.dirname(target);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  const stored: StoredWorkspaceNodeSnapshot = {
    version: SNAPSHOT_VERSION,
    kind: SNAPSHOT_KIND,
    observedAt: (input.observedAt ?? new Date()).toISOString(),
    workspaceId: input.expectedWorkspaceId,
    currentNodeId: input.expectedCurrentNodeId,
    workspace,
  };
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(stored, null, 2)}\n`, {
      mode: 0o600,
      flag: 'wx',
    });
    fs.renameSync(temporary, target);
    fs.chmodSync(target, 0o600);
  } finally {
    try {
      fs.rmSync(temporary, { force: true });
    } catch {
      // Best-effort cleanup after an interrupted atomic write.
    }
  }
}

export function readStoredWorkspaceNodeSnapshot(input: {
  home: string;
  expectedWorkspaceId: string;
  expectedCurrentNodeId: string;
  expectedWorkspaceHost?: string;
  nowMs?: number;
}): WorkspaceNodeSnapshot | undefined {
  const target = workspaceNodeSnapshotPath(input.home);
  try {
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) return undefined;
    if (typeof process.getuid === 'function' && stat.uid !== process.getuid()) return undefined;
    const parsed = JSON.parse(fs.readFileSync(target, 'utf8')) as Record<string, unknown>;
    if (parsed.version !== SNAPSHOT_VERSION || parsed.kind !== SNAPSHOT_KIND) return undefined;
    const observedAt = Date.parse(requiredString(parsed.observedAt, 'workspace node snapshot observedAt'));
    const nowMs = input.nowMs ?? Date.now();
    if (
      !Number.isFinite(observedAt) ||
      observedAt > nowMs + 60_000 ||
      nowMs - observedAt > WORKSPACE_NODE_SNAPSHOT_MAX_AGE_MS
    ) {
      return undefined;
    }
    if (
      parsed.workspaceId !== input.expectedWorkspaceId ||
      parsed.currentNodeId !== input.expectedCurrentNodeId
    ) {
      return undefined;
    }
    const workspace = parseWorkspaceNodeSnapshot(parsed.workspace);
    if (
      workspace.workspaceId !== input.expectedWorkspaceId ||
      workspace.currentNodeId !== input.expectedCurrentNodeId ||
      (input.expectedWorkspaceHost && workspace.workspaceHost !== input.expectedWorkspaceHost)
    ) {
      return undefined;
    }
    return workspace;
  } catch {
    return undefined;
  }
}
