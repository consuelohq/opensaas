import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer, connect, type Server, type Socket } from 'node:net';
import { dirname, join } from 'node:path';

import { createDefaultLifecycleEngine } from '../lifecycle';
import {
  loadGlobalYamlConfig,
  loadNodeYamlConfig,
  loadWorkspaceYamlConfig,
  resolveConsueloHomeLayout,
} from './consuelo-home';
import { redactLifecycleDetail } from './lifecycle/diagnostics';
import { detectLocalAgents } from './local-agent-connectivity';
import { resolveLifecyclePaths } from './lifecycle/paths';
import { readLifecycleReleaseReference } from './lifecycle/retention';
import type {
  LifecycleEngine,
  LifecycleNotificationPreference,
  LifecycleReleaseChannel,
  LifecycleStatusResult,
} from './lifecycle/types';
import {
  createDetachedNativeLifecycleOperationLauncher,
  type NativeLifecycleOperationInput,
  type NativeLifecycleOperationState,
} from './native-lifecycle-operation';
import type {
  ConnectorState,
  LifecycleRequest,
  LifecycleResponse,
  LifecycleSnapshot,
  NotificationPreference,
  ReleaseChannel,
  ServiceManager,
  WorkspaceNode,
} from './native-lifecycle-client';
import { createWorkspaceNodeClient } from './workspace-node-client';

export const NATIVE_LIFECYCLE_MAX_PAYLOAD_BYTES = 1024 * 1024;
const USER_SELECTABLE_CHANNELS = ['stable', 'beta', 'canary', 'dev'] as const;
const SECRET_KEY =
  /token|secret|password|credential|authorization|cookie|private.?key/i;
const HOME_PATH = /\/Users\/[^/\s]+/g;

type ReleaseInspection = {
  available: number;
  latestVersion?: string;
  rollbackVersion?: string;
  summary?: string;
};

type ConnectorInspection = {
  state: ConnectorState;
  detail?: string;
};

type NativeOperationKind = NonNullable<LifecycleSnapshot['operation']>['kind'];

type NativeLifecycleEndpointControllerInput = {
  engine: LifecycleEngine;
  home?: string;
  platform?: NodeJS.Platform;
  architecture?: string;
  channelSelectionAllowed?: boolean;
  inspectRelease?: () => Promise<ReleaseInspection>;
  inspectConnector?: () => Promise<ConnectorInspection>;
  inspectWorkspace?: () => Promise<LifecycleSnapshot['workspace'] | undefined>;
  setDefaultNode?: (nodeId: string) => Promise<void>;
  exportDiagnostics?: () => Promise<string | void>;
  now?: () => Date;
  operationId?: () => string;
  instanceId?: string;
  enrichmentTimeoutMs?: number;
  launchOperation?: (
    operation: NativeLifecycleOperationInput,
  ) => Promise<{ accepted: true; operationId: string }>;
  readOperationState?: () => NativeLifecycleOperationState | undefined;
};

export type NativeLifecycleEndpointController = {
  handle(request: LifecycleRequest): Promise<LifecycleResponse>;
};

export type NativeLifecycleEndpoint = {
  socketPath: string;
  close(): Promise<void>;
};

const safeMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return String(redactLifecycleDetail(message))
    .replace(HOME_PATH, '/Users/[REDACTED]')
    .replace(/(token|secret|password|passphrase)=([^&\s]+)/gi, '$1=[REDACTED]');
};

const withFallbackTimeout = <T>(
  promise: Promise<T>,
  fallback: T,
  timeoutMs: number,
): Promise<T> =>
  new Promise((resolve) => {
    let settled = false;
    const finish = (value: T): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(fallback), timeoutMs);
    promise.then(finish, () => finish(fallback));
  });

const operationId = (): string => {
  return `native-${Date.now()}-${crypto.randomUUID()}`;
};

const notificationPreference = (
  preference: NotificationPreference,
): LifecycleNotificationPreference => {
  if (preference.state === 'on') return { mode: 'on' };
  if (preference.state === 'off') return { mode: 'off' };
  return { mode: 'snoozed', snoozedUntil: preference.until };
};

const snapshotNotificationPreference = (
  preference: LifecycleStatusResult['preferences']['notifications'],
): NotificationPreference => {
  if (preference.mode === 'on') return { state: 'on' };
  if (preference.mode === 'off') return { state: 'off' };
  return { state: 'snoozed', until: preference.snoozedUntil };
};

const managerForPlatform = (platform: NodeJS.Platform): ServiceManager => {
  if (platform === 'darwin') return 'launchd';
  if (platform === 'win32') return 'windows-service-manager';
  return 'systemd';
};

const installState = (
  status: LifecycleStatusResult,
): LifecycleSnapshot['install'] => {
  if (status.installState === 'no-install') return { state: 'not-installed' };
  return { state: 'installed' };
};

const runtimeState = (
  status: LifecycleStatusResult,
): LifecycleSnapshot['runtime']['state'] => {
  if (status.installState === 'no-install') return 'stopped';
  if (status.installState === 'corrupt' || status.installState === 'partial')
    return 'failed';
  return 'running';
};

const localWorkspace = (input: {
  home?: string;
  channel: ReleaseChannel;
  platform: NodeJS.Platform;
  architecture: string;
  observedAt: string;
}): LifecycleSnapshot['workspace'] | undefined => {
  try {
    const layout = resolveConsueloHomeLayout(input.home);
    if (!existsSync(layout.globalConfigPath)) return undefined;
    const global = loadGlobalYamlConfig(layout.globalConfigPath);
    const workspaceId = global.activeWorkspace;
    if (!workspaceId) return undefined;
    const workspacePath = layout.workspaceConfigPath(workspaceId);
    if (!existsSync(workspacePath) || !existsSync(layout.nodeConfigPath))
      return undefined;
    const workspace = loadWorkspaceYamlConfig(workspacePath);
    const node = loadNodeYamlConfig(layout.nodeConfigPath);
    if (!workspace.workspace.host) return undefined;
    const nodeMetadata = statSync(layout.nodeConfigPath);
    const createdAt =
      nodeMetadata.birthtimeMs > 0
        ? nodeMetadata.birthtime.toISOString()
        : nodeMetadata.mtime.toISOString();
    const lastSeenAt = nodeMetadata.mtime.toISOString();
    const localNode: WorkspaceNode = {
      workspaceId,
      nodeId: node.node.id,
      displayName: node.node.name,
      role: node.node.role ?? 'home',
      platform: input.platform,
      architecture: input.architecture,
      channel: input.channel,
      connectorId: 'local-runtime',
      capabilities: [...node.capabilities],
      agents: detectLocalAgents({ home: layout.home })
        .filter((agent) => agent.status === 'verified')
        .map((agent) => agent.name)
        .sort(),
      createdAt,
      lastSeenAt,
      presence: 'online',
      state: 'active',
      publicKeyThumbprint: 'unavailable',
    };
    return {
      workspaceId,
      workspaceHost: workspace.workspace.host,
      currentNodeId: global.activeNode ?? node.node.id,
      defaultNodeId: global.activeNode ?? node.node.id,
      nodes: [localNode],
    };
  } catch {
    return undefined;
  }
};

const stringField = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`workspace authority returned invalid ${label}`);
  }
  return value;
};

const optionalString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const normalizeWorkspacePayload = (
  payload: Record<string, unknown>,
): LifecycleSnapshot['workspace'] => {
  for (const key of Object.keys(payload)) {
    if (SECRET_KEY.test(key))
      throw new Error('workspace authority returned a secret-bearing field');
  }
  const rawNodes = payload.nodes;
  if (!Array.isArray(rawNodes))
    throw new Error('workspace authority returned invalid nodes');
  const workspaceId = stringField(payload.workspaceId, 'workspaceId');
  const workspaceHost = stringField(payload.workspaceHost, 'workspaceHost');
  const nodes = rawNodes.map((raw, index): WorkspaceNode => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`workspace authority returned invalid node ${index}`);
    }
    const node = raw as Record<string, unknown>;
    for (const key of Object.keys(node)) {
      if (SECRET_KEY.test(key))
        throw new Error(
          'workspace authority returned a secret-bearing node field',
        );
    }
    const role = node.role;
    const presence = node.presence;
    const state = node.state;
    if (role !== 'home' && role !== 'member')
      throw new Error(
        `workspace authority returned invalid node role ${index}`,
      );
    if (
      presence !== 'online' &&
      presence !== 'offline' &&
      presence !== 'stale'
    ) {
      throw new Error(
        `workspace authority returned invalid node presence ${index}`,
      );
    }
    if (state !== 'active' && state !== 'revoked')
      throw new Error(
        `workspace authority returned invalid node state ${index}`,
      );
    if (
      !Array.isArray(node.capabilities) ||
      !node.capabilities.every((value) => typeof value === 'string')
    ) {
      throw new Error(
        `workspace authority returned invalid node capabilities ${index}`,
      );
    }
    if (
      node.agents !== null &&
      node.agents !== undefined &&
      (!Array.isArray(node.agents) ||
        !node.agents.every((value) => typeof value === 'string'))
    ) {
      throw new Error(
        `workspace authority returned invalid node agents ${index}`,
      );
    }
    return {
      workspaceId: stringField(node.workspaceId, `node ${index} workspaceId`),
      nodeId: stringField(node.nodeId, `node ${index} nodeId`),
      displayName: stringField(node.displayName, `node ${index} displayName`),
      role,
      platform: stringField(node.platform, `node ${index} platform`),
      architecture: stringField(
        node.architecture,
        `node ${index} architecture`,
      ),
      channel: stringField(node.channel, `node ${index} channel`),
      connectorId: optionalString(node.connectorId) ?? 'unavailable',
      capabilities: [...node.capabilities] as string[],
      ...(Array.isArray(node.agents)
        ? { agents: [...node.agents] as string[] }
        : {}),
      createdAt: stringField(node.createdAt, `node ${index} createdAt`),
      lastSeenAt: stringField(node.lastSeenAt, `node ${index} lastSeenAt`),
      presence,
      state,
      publicKeyThumbprint: stringField(
        node.publicKeyThumbprint,
        `node ${index} publicKeyThumbprint`,
      ),
    };
  });
  return {
    workspaceId,
    workspaceHost,
    ...(optionalString(payload.currentNodeId)
      ? { currentNodeId: optionalString(payload.currentNodeId) }
      : {}),
    ...(optionalString(payload.defaultNodeId)
      ? { defaultNodeId: optionalString(payload.defaultNodeId) }
      : {}),
    nodes,
  };
};

const redactDiagnosticValue = (
  value: unknown,
  home: string,
  key = '',
): unknown => {
  if (SECRET_KEY.test(key)) return '[REDACTED]';
  if (typeof value === 'string') {
    const lifecycleRedacted = String(redactLifecycleDetail(value));
    return lifecycleRedacted
      .replaceAll(home, '~/.consuelo')
      .replace(HOME_PATH, '~');
  }
  if (Array.isArray(value))
    return value.map((entry) => redactDiagnosticValue(entry, home));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(
        ([childKey, childValue]) => [
          childKey,
          redactDiagnosticValue(childValue, home, childKey),
        ],
      ),
    );
  }
  return value;
};

const createDefaultDiagnosticsExporter = (
  home?: string,
): (() => Promise<string>) => {
  return async () => {
    const paths = resolveLifecyclePaths(home);
    const supportDirectory = join(paths.home, 'support');
    mkdirSync(supportDirectory, { recursive: true, mode: 0o700 });
    chmodSync(supportDirectory, 0o700);
    const outputPath = join(
      supportDirectory,
      `lifecycle-diagnostics-${new Date().toISOString().replaceAll(':', '-')}.jsonl`,
    );
    const output: string[] = [];
    if (existsSync(paths.diagnosticsPath)) {
      for (const line of readFileSync(paths.diagnosticsPath, 'utf8').split(
        '\n',
      )) {
        if (!line.trim()) continue;
        try {
          output.push(
            JSON.stringify(redactDiagnosticValue(JSON.parse(line), paths.home)),
          );
        } catch {
          output.push(
            JSON.stringify({
              message: redactDiagnosticValue(line, paths.home),
            }),
          );
        }
      }
    }
    writeFileSync(
      outputPath,
      `${output.join('\n')}${output.length ? '\n' : ''}`,
      {
        encoding: 'utf8',
        mode: 0o600,
      },
    );
    chmodSync(outputPath, 0o600);
    return outputPath;
  };
};

const createDefaultReleaseInspector = (input: {
  engine: LifecycleEngine;
  home?: string;
  now?: () => number;
  ttlMs?: number;
}): (() => Promise<ReleaseInspection>) => {
  let cached: { expiresAt: number; value: ReleaseInspection } | undefined;
  const now = input.now ?? Date.now;
  const ttlMs = input.ttlMs ?? 60_000;
  return async () => {
    if (cached && cached.expiresAt > now()) return cached.value;
    let rollbackVersion: string | undefined;
    try {
      rollbackVersion = readLifecycleReleaseReference(input.home, 'previous')
        ?.manifest.version;
    } catch {
      rollbackVersion = undefined;
    }
    let value: ReleaseInspection = {
      available: 0,
      ...(rollbackVersion ? { rollbackVersion } : {}),
    };
    try {
      const checked = await input.engine.update({ check: true });
      value = {
        available: checked.updateAvailable ? 1 : 0,
        ...(checked.version ? { latestVersion: checked.version } : {}),
        ...(rollbackVersion ? { rollbackVersion } : {}),
      };
    } catch {
      // Release inspection is optional status enrichment; lifecycle mutations still fail closed.
    }
    cached = { expiresAt: now() + ttlMs, value };
    return value;
  };
};

const parseRequest = (value: unknown): LifecycleRequest => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('lifecycle request must be a JSON object');
  const request = value as Record<string, unknown>;
  const kind = request.kind;
  if (typeof kind !== 'string')
    throw new Error('lifecycle request kind is required');
  switch (kind) {
    case 'status.get':
    case 'service.restart':
    case 'diagnostics.export':
      return { kind };
    case 'update.apply':
    case 'update.rollback':
      return {
        kind,
        targetVersion: stringField(request.targetVersion, 'targetVersion'),
      };
    case 'repair.run':
      if (typeof request.destructive !== 'boolean')
        throw new Error('repair destructive flag is required');
      return { kind, destructive: request.destructive };
    case 'preferences.notifications.set': {
      const notifications = request.notifications;
      if (
        !notifications ||
        typeof notifications !== 'object' ||
        Array.isArray(notifications)
      ) {
        throw new Error('notification preference is required');
      }
      const state = (notifications as Record<string, unknown>).state;
      if (state === 'on' || state === 'off')
        return { kind, notifications: { state } };
      if (state === 'snoozed') {
        return {
          kind,
          notifications: {
            state,
            until: stringField(
              (notifications as Record<string, unknown>).until,
              'notification until',
            ),
          },
        };
      }
      throw new Error('notification preference is invalid');
    }
    case 'preferences.channel.set': {
      const channel = stringField(request.channel, 'channel') as ReleaseChannel;
      return { kind, channel };
    }
    case 'workspace.default-node.set':
      return { kind, nodeId: stringField(request.nodeId, 'nodeId') };
    case 'uninstall.execute':
      if (
        typeof request.removeNode !== 'boolean' ||
        typeof request.removeUserContent !== 'boolean'
      ) {
        throw new Error('uninstall retention flags are required');
      }
      return {
        kind,
        removeNode: request.removeNode,
        removeUserContent: request.removeUserContent,
      };
    default:
      throw new Error(`unsupported lifecycle request kind: ${kind}`);
  }
};

export const createNativeLifecycleEndpointController = (
  input: NativeLifecycleEndpointControllerInput,
): NativeLifecycleEndpointController => {
  const now = input.now ?? (() => new Date());
  const nextOperationId = input.operationId ?? operationId;
  const instanceId = input.instanceId ?? crypto.randomUUID();
  const platform = input.platform ?? process.platform;
  const architecture = input.architecture ?? process.arch;
  const inspectRelease =
    input.inspectRelease ?? (async () => ({ available: 0 }));
  const inspectConnector =
    input.inspectConnector ?? (async () => ({ state: 'unknown' as const }));
  const exportDiagnostics =
    input.exportDiagnostics ?? createDefaultDiagnosticsExporter(input.home);
  const enrichmentTimeoutMs = Math.max(1, input.enrichmentTimeoutMs ?? 1_500);
  let sequence = 0;
  let localOperationGeneration = 0;
  let currentOperation: LifecycleSnapshot['operation'];

  const runOperation = (
    kind: NativeOperationKind,
    execute: () => Promise<unknown>,
  ): LifecycleResponse => {
    const id = nextOperationId();
    const generation = ++localOperationGeneration;
    currentOperation = { kind, phase: 'queued' };
    queueMicrotask(() => {
      if (generation !== localOperationGeneration) return;
      currentOperation = { kind, phase: 'running' };
      void execute().then(
        () => {
          if (generation === localOperationGeneration) {
            currentOperation = { kind, phase: 'succeeded' };
          }
        },
        (error: unknown) => {
          if (generation === localOperationGeneration) {
            currentOperation = {
              kind,
              phase: 'failed',
              message: safeMessage(error),
            };
          }
        },
      );
    });
    return { accepted: true, operationId: id };
  };

  const launchDetachedOperation = async (
    operation: NativeLifecycleOperationInput,
  ): Promise<LifecycleResponse> => {
    if (!input.launchOperation) {
      throw new Error('detached lifecycle operation authority is unavailable');
    }
    const response = await input.launchOperation(operation);
    localOperationGeneration += 1;
    currentOperation = undefined;
    return response;
  };

  const statusSnapshot = async (): Promise<LifecycleSnapshot> => {
    const status = await input.engine.status();
    const observedAt = now().toISOString();
    const [release, connector, inspectedWorkspace] = await Promise.all([
      withFallbackTimeout(
        inspectRelease(),
        { available: 0 },
        enrichmentTimeoutMs,
      ),
      withFallbackTimeout(
        inspectConnector().catch((error: unknown) => ({
          state: 'unknown' as const,
          detail: safeMessage(error),
        })),
        { state: 'unknown' as const },
        enrichmentTimeoutMs,
      ),
      input.inspectWorkspace
        ? withFallbackTimeout(
            input.inspectWorkspace(),
            undefined,
            enrichmentTimeoutMs,
          )
        : Promise.resolve(undefined),
    ]);
    const channel = status.preferences.channel as ReleaseChannel;
    const workspace =
      inspectedWorkspace ??
      localWorkspace({
        home: input.home,
        channel,
        platform,
        architecture,
        observedAt,
      });
    const persistedOperation = input.readOperationState?.();
    const persistedSnapshot = persistedOperation
      ? {
          kind: persistedOperation.kind,
          phase: persistedOperation.phase,
          ...(persistedOperation.message
            ? { message: persistedOperation.message }
            : {}),
        }
      : undefined;
    const persistedIsActive =
      persistedOperation?.phase === 'queued' ||
      persistedOperation?.phase === 'running';
    const operation = persistedIsActive
      ? persistedSnapshot
      : (currentOperation ?? persistedSnapshot);
    return {
      schemaVersion: 1,
      instanceId,
      sequence: ++sequence,
      observedAt,
      install: installState(status),
      runtime: {
        version: status.version ?? 'unknown',
        channel,
        state: runtimeState(status),
      },
      services: [
        {
          id: 'consuelo-os',
          state:
            runtimeState(status) === 'running'
              ? 'healthy'
              : runtimeState(status) === 'failed'
                ? 'failed'
                : 'stopped',
          managedBy: managerForPlatform(platform),
        },
      ],
      connector,
      updates: {
        available: Math.max(0, release.available),
        ...(release.latestVersion
          ? { latestVersion: release.latestVersion }
          : {}),
        ...(release.rollbackVersion
          ? { rollbackVersion: release.rollbackVersion }
          : {}),
      },
      release: release.summary ? { summary: release.summary } : {},
      ...(operation ? { operation } : {}),
      preferences: {
        channelSelectionAllowed: input.channelSelectionAllowed ?? false,
        notifications: snapshotNotificationPreference(
          status.preferences.notifications,
        ),
      },
      ...(workspace ? { workspace } : {}),
      connection: { state: 'online' },
    };
  };

  return {
    handle: async (request) => {
      try {
        switch (request.kind) {
          case 'status.get':
            return statusSnapshot();
          case 'update.apply': {
            const release = await inspectRelease();
            if (
              !release.latestVersion ||
              request.targetVersion !== release.latestVersion
            ) {
              throw new Error(
                'requested update target does not match the available release',
              );
            }
            return launchDetachedOperation({
              kind: 'update',
              targetVersion: request.targetVersion,
            });
          }
          case 'update.rollback': {
            const release = await inspectRelease();
            if (
              !release.rollbackVersion ||
              request.targetVersion !== release.rollbackVersion
            ) {
              throw new Error(
                'requested rollback target does not match the retained rollback release',
              );
            }
            return launchDetachedOperation({
              kind: 'rollback',
              targetVersion: request.targetVersion,
            });
          }
          case 'repair.run':
            if (request.destructive) {
              throw new Error(
                'destructive repair is not supported by the lifecycle engine',
              );
            }
            return launchDetachedOperation({ kind: 'repair' });
          case 'service.restart':
            return launchDetachedOperation({ kind: 'restart' });
          case 'preferences.notifications.set':
            return runOperation('update', () =>
              input.engine.setUpdateNotifications(
                notificationPreference(request.notifications),
              ),
            );
          case 'preferences.channel.set': {
            if (
              !USER_SELECTABLE_CHANNELS.includes(
                request.channel as (typeof USER_SELECTABLE_CHANNELS)[number],
              )
            ) {
              throw new Error(
                `release channel ${request.channel} is not user-selectable`,
              );
            }
            return runOperation('update', () =>
              input.engine.setChannel(
                request.channel as LifecycleReleaseChannel,
              ),
            );
          }
          case 'workspace.default-node.set':
            if (!input.setDefaultNode)
              throw new Error('workspace node authority is unavailable');
            return runOperation('repair', () =>
              input.setDefaultNode!(request.nodeId),
            );
          case 'diagnostics.export':
            return runOperation('repair', exportDiagnostics);
          case 'uninstall.execute':
            return launchDetachedOperation({
              kind: 'uninstall',
              removeNode: request.removeNode,
              removeUserContent: request.removeUserContent,
            });
        }
      } catch (error: unknown) {
        throw new Error(safeMessage(error));
      }
    },
  };
};

export const encodeNativeLifecycleFrame = (value: unknown): Buffer => {
  const payload = Buffer.from(JSON.stringify(value), 'utf8');
  if (payload.length > NATIVE_LIFECYCLE_MAX_PAYLOAD_BYTES) {
    throw new Error(
      `native lifecycle payload exceeds ${NATIVE_LIFECYCLE_MAX_PAYLOAD_BYTES} bytes`,
    );
  }
  const header = Buffer.alloc(4);
  header.writeUInt32BE(payload.length);
  return Buffer.concat([header, payload]);
};

const handleSocket = (
  socket: Socket,
  controller: NativeLifecycleEndpointController,
): void => {
  let buffer = Buffer.alloc(0);
  let expectedLength: number | undefined;
  let handled = false;
  socket.setTimeout(5_000, () => socket.destroy());
  socket.on('data', (chunk) => {
    if (handled) return;
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    if (expectedLength === undefined && buffer.length >= 4) {
      expectedLength = buffer.readUInt32BE(0);
      if (expectedLength > NATIVE_LIFECYCLE_MAX_PAYLOAD_BYTES) {
        handled = true;
        socket.destroy();
        return;
      }
    }
    if (expectedLength === undefined || buffer.length < expectedLength + 4)
      return;
    handled = true;
    const payload = buffer.subarray(4, expectedLength + 4);
    void Promise.resolve()
      .then(() => parseRequest(JSON.parse(payload.toString('utf8'))))
      .then((request) => controller.handle(request))
      .then((response) => socket.end(encodeNativeLifecycleFrame(response)))
      .catch((error: unknown) =>
        socket.end(
          encodeNativeLifecycleFrame({
            accepted: false,
            operationId: `rejected-${crypto.randomUUID()}`,
            error: safeMessage(error),
          }),
        ),
      );
  });
  socket.on('error', () => socket.destroy());
};

const activeSocket = async (socketPath: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = connect(socketPath);
    let settled = false;
    const finish = (active: boolean): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(active);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(250, () => finish(false));
  });
};

const verifyExistingSocket = (socketPath: string): void => {
  const metadata = lstatSync(socketPath);
  if (!metadata.isSocket())
    throw new Error(
      `native lifecycle endpoint exists but is not a Unix socket: ${socketPath}`,
    );
  const expectedOwner =
    typeof process.geteuid === 'function' ? process.geteuid() : metadata.uid;
  if (metadata.uid !== expectedOwner)
    throw new Error(
      'native lifecycle socket owner does not match the service user',
    );
  if ((metadata.mode & 0o077) !== 0)
    throw new Error('native lifecycle socket permissions are too broad');
};

export const startNativeLifecycleEndpoint = async (input: {
  socketPath: string;
  controller: NativeLifecycleEndpointController;
}): Promise<NativeLifecycleEndpoint> => {
  let server: Server | undefined;
  let ownsSocket = false;
  try {
    const parent = dirname(input.socketPath);
    mkdirSync(parent, { recursive: true, mode: 0o700 });
    chmodSync(parent, 0o700);
    if (existsSync(input.socketPath)) {
      verifyExistingSocket(input.socketPath);
      if (await activeSocket(input.socketPath)) {
        throw new Error('native lifecycle endpoint is already active');
      }
      rmSync(input.socketPath, { force: true });
    }

    server = createServer((socket) => handleSocket(socket, input.controller));
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        server?.off('listening', onListening);
        reject(error);
      };
      const onListening = (): void => {
        server?.off('error', onError);
        ownsSocket = true;
        resolve();
      };
      server?.once('error', onError);
      server?.once('listening', onListening);
      server?.listen(input.socketPath);
    });
    chmodSync(input.socketPath, 0o600);

    const activeServer = server;
    return {
      socketPath: input.socketPath,
      close: async () => {
        try {
          await new Promise<void>((resolve, reject) => {
            activeServer.close((error) => (error ? reject(error) : resolve()));
          });
        } catch (error: unknown) {
          throw new Error(safeMessage(error));
        } finally {
          rmSync(input.socketPath, { force: true });
        }
      },
    };
  } catch (error: unknown) {
    server?.close();
    if (ownsSocket && existsSync(input.socketPath)) {
      try {
        verifyExistingSocket(input.socketPath);
        rmSync(input.socketPath, { force: true });
      } catch (cleanupError: unknown) {
        void cleanupError;
      }
    }
    throw new Error(safeMessage(error));
  }
};

export const startDefaultNativeLifecycleEndpoint = async (
  input: {
    home?: string;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<NativeLifecycleEndpoint> => {
  try {
    const env = input.env ?? process.env;
    const home = resolveConsueloHomeLayout(
      input.home ?? env.CONSUELO_HOME ?? env.WORKSPACE_DAEMON_CONSUELO_HOME,
    ).home;
    const engine = createDefaultLifecycleEngine({
      home,
      quiet: true,
      json: true,
      progress: () => undefined,
    });
    const accessToken = env.CONSUELO_OS_WORKSPACE_TOKEN?.trim();
    const authorityOrigin =
      env.CONSUELO_OS_AUTHORITY_ORIGIN?.trim() || 'https://os.consuelohq.com';
    const workspaceClient = accessToken
      ? createWorkspaceNodeClient({ origin: authorityOrigin, accessToken })
      : undefined;
    const local = (): LifecycleSnapshot['workspace'] | undefined => {
      try {
        const status = {
          channel: loadGlobalYamlConfig(
            resolveConsueloHomeLayout(home).globalConfigPath,
          ).updates.channel,
        };
        return localWorkspace({
          home,
          channel: status.channel ?? 'stable',
          platform: process.platform,
          architecture: process.arch,
          observedAt: new Date().toISOString(),
        });
      } catch (error: unknown) {
        void error;
        return undefined;
      }
    };
    const inspectWorkspace = workspaceClient
      ? async (): Promise<LifecycleSnapshot['workspace'] | undefined> => {
          try {
            const current = local();
            const payload = await workspaceClient.execute({
              action: 'list',
              ...(current?.currentNodeId
                ? { currentNodeId: current.currentNodeId }
                : {}),
            });
            return normalizeWorkspacePayload(payload);
          } catch (error: unknown) {
            throw new Error(safeMessage(error));
          }
        }
      : (): Promise<LifecycleSnapshot['workspace'] | undefined> =>
          Promise.resolve(local());
    const setDefaultNode = workspaceClient
      ? async (nodeId: string): Promise<void> => {
          try {
            await workspaceClient.execute({ action: 'default', nodeId });
          } catch (error: unknown) {
            throw new Error(safeMessage(error));
          }
        }
      : undefined;
    const operationLauncher = createDetachedNativeLifecycleOperationLauncher({
      home,
      env,
    });
    const controller = createNativeLifecycleEndpointController({
      engine,
      home,
      launchOperation: operationLauncher.launch,
      readOperationState: operationLauncher.read,
      channelSelectionAllowed: /^(1|true|yes)$/i.test(
        env.CONSUELO_CHANNEL_SELECTION_ALLOWED ?? '',
      ),
      inspectRelease: createDefaultReleaseInspector({ engine, home }),
      inspectWorkspace,
      setDefaultNode,
    });
    return await startNativeLifecycleEndpoint({
      socketPath: join(home, 'run', 'lifecycle.sock'),
      controller,
    });
  } catch (error: unknown) {
    throw new Error(safeMessage(error));
  }
};
