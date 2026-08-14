export const releaseChannels = [
  'stable',
  'beta',
  'canary',
  'dev',
  'nightly',
] as const;
export type ReleaseChannel = (typeof releaseChannels)[number];
export type RuntimeState =
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'offline'
  | 'failed';
export type ServiceState =
  | 'healthy'
  | 'degraded'
  | 'stopped'
  | 'failed'
  | 'unknown';
export type ServiceManager = 'launchd' | 'windows-service-manager' | 'systemd';
export type LifecycleInstallState =
  | 'not-installed'
  | 'installing'
  | 'installed';
export type ConnectorState = 'connected' | 'degraded' | 'offline' | 'unknown';
export type NotificationPreference =
  | { state: 'on' }
  | { state: 'off' }
  | { state: 'snoozed'; until: string };
export type WorkspaceNode = {
  workspaceId: string;
  nodeId: string;
  displayName: string;
  role: 'home' | 'member';
  platform: string;
  architecture: string;
  channel: string;
  connectorId: string;
  capabilities: string[];
  agents?: string[];
  createdAt: string;
  lastSeenAt: string;
  presence: 'online' | 'offline' | 'stale';
  state: 'active' | 'revoked';
  publicKeyThumbprint: string;
};

export type LifecycleSnapshot = {
  schemaVersion: 1;
  instanceId?: string;
  sequence: number;
  observedAt: string;
  install?: { state: LifecycleInstallState };
  runtime: {
    version: string;
    channel: ReleaseChannel;
    state: RuntimeState;
  };
  services: Array<{
    id: string;
    state: ServiceState;
    managedBy: ServiceManager;
    detail?: string;
  }>;
  connector?: { state: ConnectorState; detail?: string };
  updates: {
    available: number;
    latestVersion?: string;
    rollbackVersion?: string;
  };
  release?: { summary?: string };
  operation?: {
    kind:
      | 'install'
      | 'update'
      | 'repair'
      | 'rollback'
      | 'restart'
      | 'uninstall';
    phase: 'queued' | 'running' | 'succeeded' | 'failed';
    message?: string;
  };
  preferences?: {
    channelSelectionAllowed: boolean;
    notifications: NotificationPreference;
  };
  workspace?: {
    workspaceId: string;
    workspaceHost: string;
    currentNodeId?: string;
    defaultNodeId?: string;
    nodes: WorkspaceNode[];
  };
  connection?: {
    state: 'online' | 'offline';
    reason?: string;
  };
};

export type LifecycleRequest =
  | { kind: 'status.get' }
  | { kind: 'update.apply'; targetVersion: string }
  | { kind: 'update.rollback'; targetVersion: string }
  | { kind: 'repair.run'; destructive: boolean }
  | { kind: 'service.restart' }
  | {
      kind: 'preferences.notifications.set';
      notifications: NotificationPreference;
    }
  | { kind: 'preferences.channel.set'; channel: ReleaseChannel }
  | { kind: 'workspace.default-node.set'; nodeId: string }
  | { kind: 'diagnostics.export' }
  | {
      kind: 'uninstall.execute';
      removeNode: boolean;
      removeUserContent: boolean;
    };

export type LifecycleOperationAccepted = {
  accepted: true;
  operationId: string;
};

export type LifecycleOperationRejected = {
  accepted: false;
  operationId: string;
  error?: string;
};

export type LifecycleOperationResponse =
  | LifecycleOperationAccepted
  | LifecycleOperationRejected;

export type LifecycleResponse = LifecycleSnapshot | LifecycleOperationResponse;

export type NativeLifecycleTransport = {
  request(request: LifecycleRequest): Promise<LifecycleResponse>;
  subscribe(listener: (snapshot: LifecycleSnapshot) => void): () => void;
};

export type NativeLifecycleClient = {
  refresh(): Promise<LifecycleSnapshot>;
  applyUpdate(targetVersion: string): Promise<LifecycleOperationAccepted>;
  rollback(targetVersion: string): Promise<LifecycleOperationAccepted>;
  repair(destructive: boolean): Promise<LifecycleOperationAccepted>;
  restart(): Promise<LifecycleOperationAccepted>;
  setNotifications(
    preference: NotificationPreference,
  ): Promise<LifecycleOperationAccepted>;
  setChannel(channel: ReleaseChannel): Promise<LifecycleOperationAccepted>;
  setDefaultNode(nodeId: string): Promise<LifecycleOperationAccepted>;
  exportDiagnostics(): Promise<LifecycleOperationAccepted>;
  uninstall(input: {
    removeNode: boolean;
    removeUserContent: boolean;
  }): Promise<LifecycleOperationAccepted>;
  connect(listener: (snapshot: LifecycleSnapshot) => void): () => void;
  closeShell(): void;
  current(): LifecycleSnapshot | undefined;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isSnapshot = (
  response: LifecycleResponse,
): response is LifecycleSnapshot => 'schemaVersion' in response;

const isOperationResponse = (
  response: LifecycleResponse,
): response is LifecycleOperationResponse => 'accepted' in response;

export const createNativeLifecycleClient = (input: {
  transport: NativeLifecycleTransport;
  initialSnapshot?: LifecycleSnapshot;
}): NativeLifecycleClient => {
  let snapshot = input.initialSnapshot;
  let hasLocalOfflineProjection = false;
  let subscription: { close: () => void; closed: boolean } | undefined;

  const closeSubscription = (current: {
    close: () => void;
    closed: boolean;
  }): void => {
    if (current.closed) return;
    current.closed = true;
    current.close();
    if (subscription === current) subscription = undefined;
  };

  const acceptSnapshot = (
    next: LifecycleSnapshot,
    options: { allowEqual?: boolean } = {},
  ): boolean => {
    if (snapshot) {
      const currentInstance = snapshot.instanceId ?? 'legacy';
      const nextInstance = next.instanceId ?? 'legacy';
      if (currentInstance !== nextInstance) {
        if (next.observedAt < snapshot.observedAt) return false;
      } else {
        if (next.sequence < snapshot.sequence) return false;
        if (
          next.sequence === snapshot.sequence &&
          !options.allowEqual &&
          !hasLocalOfflineProjection
        ) {
          return false;
        }
      }
    }
    snapshot = { ...next, connection: { state: 'online' } };
    hasLocalOfflineProjection = false;
    return true;
  };

  const operation = async (
    request: Exclude<LifecycleRequest, { kind: 'status.get' }>,
  ): Promise<LifecycleOperationAccepted> => {
    const response = await input.transport.request(request);
    if (!isOperationResponse(response)) {
      throw new Error(`unexpected lifecycle response for ${request.kind}`);
    }
    if (!response.accepted) {
      throw new Error(
        response.error ??
          `lifecycle operation rejected: ${response.operationId}`,
      );
    }
    return response;
  };

  return {
    refresh: async () => {
      try {
        const response = await input.transport.request({ kind: 'status.get' });
        if (!isSnapshot(response)) {
          throw new Error('unexpected lifecycle response for status.get');
        }
        acceptSnapshot(response, { allowEqual: true });
        return snapshot!;
      } catch (error: unknown) {
        if (!snapshot) throw error;
        snapshot = {
          ...snapshot,
          runtime: { ...snapshot.runtime, state: 'offline' },
          connection: { state: 'offline', reason: errorMessage(error) },
        };
        hasLocalOfflineProjection = true;
        return snapshot;
      }
    },
    applyUpdate: (targetVersion) => {
      return operation({ kind: 'update.apply', targetVersion });
    },
    rollback: (targetVersion) => {
      return operation({ kind: 'update.rollback', targetVersion });
    },
    repair: (destructive) => {
      return operation({ kind: 'repair.run', destructive });
    },
    restart: () => {
      return operation({ kind: 'service.restart' });
    },
    setNotifications: (notifications) => {
      return operation({
        kind: 'preferences.notifications.set',
        notifications,
      });
    },
    setChannel: (channel) => {
      return operation({ kind: 'preferences.channel.set', channel });
    },
    setDefaultNode: (nodeId) => {
      return operation({ kind: 'workspace.default-node.set', nodeId });
    },
    exportDiagnostics: () => {
      return operation({ kind: 'diagnostics.export' });
    },
    uninstall: ({ removeNode, removeUserContent }) => {
      return operation({
        kind: 'uninstall.execute',
        removeNode,
        removeUserContent,
      });
    },
    connect: (listener) => {
      if (subscription) closeSubscription(subscription);
      const current = {
        close: input.transport.subscribe((next) => {
          if (acceptSnapshot(next)) listener(snapshot!);
        }),
        closed: false,
      };
      subscription = current;
      return () => closeSubscription(current);
    },
    closeShell: () => {
      if (subscription) closeSubscription(subscription);
    },
    current: () => {
      return snapshot;
    },
  };
};
