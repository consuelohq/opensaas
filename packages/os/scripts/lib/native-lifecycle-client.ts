export const releaseChannels = ['stable', 'beta', 'canary', 'dev', 'nightly'] as const;
export type ReleaseChannel = (typeof releaseChannels)[number];
export type RuntimeState = 'starting' | 'running' | 'stopping' | 'stopped' | 'offline' | 'failed';
export type ServiceState = 'healthy' | 'degraded' | 'stopped' | 'failed' | 'unknown';
export type ServiceManager = 'launchd' | 'windows-service-manager' | 'systemd';

export type LifecycleSnapshot = {
  schemaVersion: 1;
  sequence: number;
  observedAt: string;
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
  updates: {
    available: number;
    latestVersion?: string;
    rollbackVersion?: string;
  };
  connection?: {
    state: 'online' | 'offline';
    reason?: string;
  };
};

export type LifecycleRequest =
  | { kind: 'status.get' }
  | { kind: 'update.apply'; targetVersion: string }
  | { kind: 'update.rollback'; targetVersion: string };

export type LifecycleOperationAccepted = {
  accepted: true;
  operationId: string;
};

export type LifecycleResponse = LifecycleSnapshot | LifecycleOperationAccepted;

export type NativeLifecycleTransport = {
  request(request: LifecycleRequest): Promise<LifecycleResponse>;
  subscribe(listener: (snapshot: LifecycleSnapshot) => void): () => void;
};

export type NativeLifecycleClient = {
  refresh(): Promise<LifecycleSnapshot>;
  applyUpdate(targetVersion: string): Promise<LifecycleOperationAccepted>;
  rollback(targetVersion: string): Promise<LifecycleOperationAccepted>;
  connect(listener: (snapshot: LifecycleSnapshot) => void): () => void;
  closeShell(): void;
  current(): LifecycleSnapshot | undefined;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isSnapshot = (response: LifecycleResponse): response is LifecycleSnapshot =>
  'schemaVersion' in response;

const isAccepted = (
  response: LifecycleResponse,
): response is LifecycleOperationAccepted => 'accepted' in response;

export function createNativeLifecycleClient(input: {
  transport: NativeLifecycleTransport;
  initialSnapshot?: LifecycleSnapshot;
}): NativeLifecycleClient {
  let snapshot = input.initialSnapshot;
  let hasLocalOfflineProjection = false;
  let subscription:
    | { close: () => void; closed: boolean }
    | undefined;

  const closeSubscription = (current: { close: () => void; closed: boolean }): void => {
    if (current.closed) return;
    current.closed = true;
    current.close();
    if (subscription === current) subscription = undefined;
  };

  const acceptSnapshot = (next: LifecycleSnapshot): boolean => {
    if (snapshot && next.sequence < snapshot.sequence) return false;
    if (snapshot && next.sequence === snapshot.sequence && !hasLocalOfflineProjection) return false;
    snapshot = { ...next, connection: { state: 'online' } };
    hasLocalOfflineProjection = false;
    return true;
  };

  const operation = async (
    request: Extract<LifecycleRequest, { kind: 'update.apply' | 'update.rollback' }>,
  ): Promise<LifecycleOperationAccepted> => {
    const response = await input.transport.request(request);
    if (!isAccepted(response)) {
      throw new Error(`unexpected lifecycle response for ${request.kind}`);
    }
    return response;
  };

  return {
    async refresh() {
      try {
        const response = await input.transport.request({ kind: 'status.get' });
        if (!isSnapshot(response)) {
          throw new Error('unexpected lifecycle response for status.get');
        }
        snapshot = { ...response, connection: { state: 'online' } };
        hasLocalOfflineProjection = false;
        return snapshot;
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
    applyUpdate(targetVersion) {
      return operation({ kind: 'update.apply', targetVersion });
    },
    rollback(targetVersion) {
      return operation({ kind: 'update.rollback', targetVersion });
    },
    connect(listener) {
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
    closeShell() {
      if (subscription) closeSubscription(subscription);
    },
    current() {
      return snapshot;
    },
  };
}
