import type { RuntimeBundleManifest } from '../distribution/runtime-bundle';
import type { SignedChannelManifest } from '../distribution/release-channels';

export const lifecycleReleaseChannels = ['stable', 'beta', 'canary', 'dev', 'nightly'] as const;
export type LifecycleReleaseChannel = (typeof lifecycleReleaseChannels)[number];

export type LifecycleNotificationPreference =
  | { mode: 'on' }
  | { mode: 'off' }
  | { mode: 'snoozed'; snoozedUntil: string };

export type LifecyclePreferences = {
  channel: LifecycleReleaseChannel;
  notifications: LifecycleNotificationPreference;
};

export type LifecycleInstallStateKind =
  | 'no-install'
  | 'legacy'
  | 'valid'
  | 'partial'
  | 'corrupt';

export type LifecycleInstallState = {
  kind: LifecycleInstallStateKind;
  home: string;
  onboardingRequired: boolean;
  reason?: string;
  currentBundleId?: string;
  currentVersion?: string;
  currentReleasePath?: string;
  manifest?: RuntimeBundleManifest;
};

export type ReleaseManifestPayload = {
  channel: LifecycleReleaseChannel;
  version: string;
  bundleId: string;
  bundleDigest: string;
  bundleUrl: string;
  releaseFingerprint: string;
  publishedAt: string;
  sourceCommit: string;
};

export type SignedReleaseManifest = SignedChannelManifest;

export type ReleaseSource = {
  fetchManifest(channel: LifecycleReleaseChannel): Promise<SignedReleaseManifest>;
  fetchBundle(url: string): Promise<Uint8Array>;
};

export type LifecycleOperation =
  | 'status'
  | 'install'
  | 'update'
  | 'restart'
  | 'repair'
  | 'rollback'
  | 'uninstall'
  | 'reset'
  | 'channel'
  | 'notifications';

export type LifecycleProgressPhase =
  | 'inspect'
  | 'onboarding'
  | 'lock'
  | 'manifest-fetch'
  | 'manifest-verify'
  | 'bundle-download'
  | 'bundle-verify'
  | 'stage'
  | 'preflight'
  | 'migrate'
  | 'activate'
  | 'service-restart'
  | 'health'
  | 'connectivity'
  | 'repair-scan'
  | 'rollback'
  | 'retention'
  | 'uninstall'
  | 'reset'
  | 'complete';

export type LifecycleProgressEvent = {
  schemaVersion: 1;
  sequence: number;
  operation: LifecycleOperation;
  phase: LifecycleProgressPhase;
  observedAt: string;
  detail?: Record<string, unknown>;
};

export type LifecycleOperationResult = {
  operation: LifecycleOperation;
  changed: boolean;
  version?: string;
  bundleId?: string;
  updateAvailable?: boolean;
  installState?: LifecycleInstallStateKind;
  preferences?: LifecyclePreferences;
  detail?: Record<string, unknown>;
};

export type LifecycleStatusResult = LifecycleOperationResult & {
  operation: 'status';
  installState: LifecycleInstallStateKind;
  preferences: LifecyclePreferences;
};

export type LifecycleServiceController = {
  preflight(): Promise<void>;
  restart(input?: {
    operationId?: string;
    expectedBundleId?: string;
    waitForCompletion?: boolean;
  }): Promise<void>;
  uninstall?(input?: {
    dryRun?: boolean;
    home?: string;
  }): Promise<void>;
};

export type LifecycleHealthAcceptance = {
  accept(input?: { bundleId?: string; version?: string }): Promise<boolean>;
};

export type LifecycleRuntimeMaterializer = {
  materialize(input: {
    home: string;
    releasePath: string;
    manifest: RuntimeBundleManifest;
  }): Promise<void>;
};

export type LifecycleMigrationRunner = {
  run(input: {
    home: string;
    releasePath: string;
    manifest: RuntimeBundleManifest;
  }): Promise<void>;
};

export type LifecycleHooks = {
  beforeStage?(input: { home: string; operationId: string }): Promise<void>;
  beforeActivate?(input: {
    home: string;
    operationId: string;
    previousReleasePath?: string;
    nextReleasePath: string;
    manifest: RuntimeBundleManifest;
  }): Promise<void>;
  afterActivate?(input: {
    home: string;
    operationId: string;
    previousReleasePath?: string;
    nextReleasePath: string;
    manifest: RuntimeBundleManifest;
  }): Promise<void>;
  onActivationFailure?(input: {
    home: string;
    operationId: string;
    previousReleasePath?: string;
    nextReleasePath?: string;
    error: unknown;
  }): Promise<void>;
  onHealthFailure?(input: {
    home: string;
    operationId: string;
    previousReleasePath?: string;
    nextReleasePath?: string;
  }): Promise<void>;
};

export type LifecycleEngine = {
  status(): Promise<LifecycleStatusResult>;
  install(input?: { channel?: LifecycleReleaseChannel }): Promise<LifecycleOperationResult>;
  update(input?: {
    channel?: LifecycleReleaseChannel;
    check?: boolean;
    yes?: boolean;
    expectedVersion?: string;
  }): Promise<LifecycleOperationResult>;
  restart(): Promise<LifecycleOperationResult>;
  repair(): Promise<LifecycleOperationResult>;
  rollback(input?: { dryRun?: boolean }): Promise<LifecycleOperationResult>;
  uninstall(input?: {
    dryRun?: boolean;
    removeNode?: boolean;
    removeUserContent?: boolean;
  }): Promise<LifecycleOperationResult>;
  devReset(input?: { yes?: boolean; dryRun?: boolean }): Promise<LifecycleOperationResult>;
  setChannel(channel: LifecycleReleaseChannel): Promise<LifecycleOperationResult>;
  setUpdateNotifications(
    preference: LifecycleNotificationPreference,
  ): Promise<LifecycleOperationResult>;
};
