import type { WorkspaceRouteD1Database } from '../../../scripts/lib/workspace-cloudflare-d1-route-registry';
import type { WorkspaceSiteSnapshotId } from '../../../scripts/lib/workspace-edge-route-seed';
import type { ManagedCloudPricingRuntime } from './services/managed-cloud-pricing';
import type { ManagedCloudPlanId, ManagedCloudRegionId } from '../../../scripts/lib/managed-cloud-pricing';
import type {
  ManagedCloudProvisioningClaimResult,
  ManagedCloudProvisioningCreateResult,
  ManagedCloudProvisioningJob,
  ManagedCloudProvisioningStatus,
} from '../../../scripts/lib/managed-cloud-provisioning';
import type { InstallControlPlaneRepository } from '../../../scripts/lib/install-control-plane';
import type {
  InstallEventId,
  InstallId,
} from '../../../scripts/lib/install-telemetry-contract';
import type {
  InstallDiagnosticBundleStore,
  InstallDiagnosticR2Bucket,
} from '../../../scripts/lib/install-control-plane-r2';
import type { InstallTelemetryObserver } from '../../../scripts/lib/install-observability';

export type GrantStatus = 'pending' | 'approved' | 'denied' | 'failed';
export type GrantFailureCode = 'workspace_route_setup_failed';
export type WorkspaceNodeRole = 'home' | 'member';
export type WorkspaceNodeStatus = 'created' | 'reconnected';
export type StrongerAuthMethod =
  | 'google'
  | 'passkey'
  | 'magic_link'
  | 'hardware_key'
  | 'admin_invite'
  | 'managed_cloud_provisioning';

export type Grant = {
  hash: string;
  userCode: string;
  installId?: InstallId;
  installIdentityEventId?: InstallEventId;
  canonicalUserId?: string;
  canonicalWorkspaceId?: string;
  workspaceId?: string;
  workspaceSlug?: string;
  workspaceHost?: string;
  status: GrantStatus;
  expiresAt: number;
  interval: number;
  devicePublicKeyJwk: string;
  deviceKeyAlgorithm: string;
  devicePublicKeyThumbprint: string;
  lastPoll?: number;
  accountId?: string;
  accountAuthMethod?: StrongerAuthMethod;
  connectorToken?: string;
  connectorExpiresAt?: number;
  cloudflareTunnelToken?: string;
  accessToken?: string;
  failureCode?: GrantFailureCode;
  failureMessage?: string;
  nodeId?: string;
  nodeName?: string;
  nodeRole?: WorkspaceNodeRole;
  nodeStatus?: WorkspaceNodeStatus;
  nodeRegistrationVersion?: number;
  /**
   * Set only when the operator is deliberately re-enrolling an existing node id whose identity key
   * has changed, which is what a reinstall produces. Without it a thumbprint mismatch is still
   * rejected, so this never becomes a silent hijack path.
   */
  nodeIdentityReplacement?: boolean;
  /** Stamped by the control plane when a replacement is accepted. */
  nodeIdentityRotatedAt?: number;
  /**
   * Previous device identity, retained only between accepting a replacement and committing the
   * approval. Route provisioning runs after the key swap, so without these a provisioning failure
   * would leave the existing installation unable to authenticate with the key it still holds.
   */
  nodeReplacedPublicKeyJwk?: string;
  nodeReplacedThumbprint?: string;
  nodePlatform?: string;
  nodeArchitecture?: string;
  nodeChannel?: string;
  nodeCapabilities?: string[];
  nodeLastSeenAt?: number;
};

export type AccountWorkspace = {
  accountId: string;
  workspaceId?: string;
  displayName?: string;
  workspaceSlug: string;
  workspaceHost: string;
  homeNodeId?: string;
  defaultNodeId?: string;
  updatedAt: number;
};

export type WorkspaceNode = {
  accountId: string;
  workspaceId?: string;
  workspaceSlug: string;
  workspaceHost: string;
  nodeId: string;
  nodeName: string;
  displayName?: string;
  role: WorkspaceNodeRole;
  platform?: string;
  architecture?: string;
  channel?: string;
  connectorId?: string;
  capabilities?: string[];
  agents?: WorkspaceAgentName[];
  connectorStatus?: 'connected' | 'disconnected';
  state?: 'active' | 'revoked';
  devicePublicKeyJwk?: string;
  devicePublicKeyThumbprint: string;
  createdAt: number;
  updatedAt: number;
  lastSeenAt?: number;
  revokedAt?: number;
};

export type WorkspaceTaskAffinity = {
  accountId: string;
  workspaceId?: string;
  workspaceHost: string;
  taskSession: string;
  ownerNodeId: string;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
};

export type WorkspaceTaskAffinityClaim = {
  status: 'created' | 'existing' | 'conflict';
  affinity: WorkspaceTaskAffinity;
};

export type WorkspaceSessionKind = 'task' | 'work';

export type WorkspaceSessionAffinity = {
  accountId: string;
  workspaceId?: string;
  workspaceHost: string;
  sessionKind: WorkspaceSessionKind;
  sessionId: string;
  ownerNodeId: string;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
};

export type WorkspaceSessionAffinityClaim = {
  status: 'created' | 'existing' | 'conflict';
  affinity: WorkspaceSessionAffinity;
};

export type WorkspaceAgentName =
  | 'codex'
  | 'cursor'
  | 'claude'
  | 'opencode'
  | 'factory'
  | 'gemini'
  | 'pi';

export type NodeBootstrapCredential = {
  tokenHash: string;
  accountId: string;
  workspaceId: string;
  workspaceHost: string;
  nodeId: string;
  expiresAt: number;
};

export type WorkspaceNodeAgentStatus = {
  workspaceId: string;
  workspaceHost: string;
  nodeId: string;
  agents: WorkspaceAgentName[];
  updatedAt: number;
};

export type WorkspaceAgentStatus = {
  workspaceId: string;
  workspaceHost: string;
  nodes: Record<string, WorkspaceNodeAgentStatus>;
  updatedAt: number;
};

export type OAuthState = {
  state: string;
  userCode: string;
  expiresAt: number;
};

export type WebOAuthState = {
  state: string;
  nonce: string;
  intent: 'login' | 'signup';
  returnPath: string;
  expiresAt: number;
};

export type WorkspaceCloudTrial = {
  accountId: string;
  workspaceId: string;
  planId: 'standard';
  provisioningJobId: string;
  startedAt: number;
  endsAt: number;
  createdAt: number;
  updatedAt: number;
};

export type ManagedCloudCheckout = {
  checkoutId: string;
  accountId: string;
  email: string;
  displayName: string;
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  planId: ManagedCloudPlanId;
  region: ManagedCloudRegionId;
  pricingVersion: string;
  monthlyPriceCents: number;
  currency: 'USD';
  status: 'pending' | 'paid';
  stripeCheckoutSessionId?: string;
  stripeCheckoutUrl?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  provisioningJobId?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  paidAt?: number;
};

export type WorkspaceMembership = {
  accountId: string;
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  status: 'active' | 'revoked';
  createdAt: number;
  updatedAt: number;
};

export type AuthoritySession = {
  tokenHash: string;
  accountId: string;
  email: string;
  cloudOnboardingEligible?: boolean;
  csrfToken: string;
  issuedAt: number;
  expiresAt: number;
};

export type WorkspaceLoginHandoff = {
  tokenHash: string;
  accountId: string;
  workspaceId: string;
  workspaceHost: string;
  returnPath: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
};

export type WorkspaceBrowserSession = {
  tokenHash: string;
  accountId: string;
  workspaceId: string;
  workspaceHost: string;
  csrfToken: string;
  issuedAt: number;
  expiresAt: number;
};

export type McpOAuthState = {
  state: string;
  clientId: string;
  redirectUri: string;
  requestedState: string;
  scope: string;
  scopes: string[];
  resource: string;
  workspaceHost: string;
  codeChallenge: string;
  expiresAt: number;
};

export type McpOAuthCode = {
  codeHash: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  scopes: string[];
  resource: string;
  workspaceHost: string;
  accountId: string;
  email: string;
  codeChallenge: string;
  expiresAt: number;
};

export type McpOAuthAccessToken = {
  tokenHash: string;
  clientId: string;
  scope: string;
  scopes: string[];
  resource: string;
  workspaceHost: string;
  accountId: string;
  email: string;
  expiresAt: number;
  issuedAt: number;
};

export type McpOAuthRefreshToken = {
  tokenHash: string;
  clientId: string;
  scope: string;
  scopes: string[];
  resource: string;
  workspaceHost: string;
  accountId: string;
  email: string;
  expiresAt: number;
  issuedAt: number;
};

export type GitHubSourceControlRepository = {
  id: number;
  nameWithOwner: string;
  defaultBranch: string;
};

export type GitHubSourceControlInstallState = {
  state: string;
  workspaceId: string;
  workspaceHost: string;
  nodeId: string;
  returnPath: string;
  expiresAt: number;
};

export type GitHubSourceControlConnection = {
  connectionId: string;
  workspaceId: string;
  workspaceHost: string;
  installationId: number;
  accountLogin: string;
  repositorySelection: 'all' | 'selected';
  repositories: GitHubSourceControlRepository[];
  createdAt: number;
  updatedAt: number;
};

export type GitHubSourceControlHandoff = {
  tokenHash: string;
  connectionId: string;
  workspaceId: string;
  workspaceHost: string;
  nodeId: string;
  returnPath: string;
  expiresAt: number;
};

export type WorkspaceRouteRegistryBinding = WorkspaceRouteD1Database;
export type DefaultSiteSnapshot = {
  key: string;
  versionId: string;
  siteId?: WorkspaceSiteSnapshotId;
  siteIds?: WorkspaceSiteSnapshotId[];
  contentType?: string;
  cachePolicy?:
    | 'static-shell'
    | 'versioned-asset'
    | 'mutable-artifact'
    | 'private-preview';
};

export type WorkspaceConnectorProvisioningInput = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  connectorId: string;
};

export type WorkspaceConnectorProvisioningResult = {
  connectorId: string;
  cloudflareTunnelToken: string;
  tunnelOriginUrl: string;
  localServiceUrl: string;
};

export type WorkspaceConnectorProvisioner = (
  input: WorkspaceConnectorProvisioningInput,
) => Promise<WorkspaceConnectorProvisioningResult>;

export type Store = {
  put(g: Grant): Promise<void>;
  byHash(hash: string): Promise<Grant | undefined>;
  byUserCode(code: string): Promise<Grant | undefined>;
  del(hash: string): Promise<void>;
  putOAuthState(s: OAuthState): Promise<void>;
  byOAuthState(state: string): Promise<OAuthState | undefined>;
  delOAuthState(state: string): Promise<void>;
  putWebOAuthState(s: WebOAuthState): Promise<void>;
  byWebOAuthState(state: string): Promise<WebOAuthState | undefined>;
  delWebOAuthState(state: string): Promise<void>;
  putMcpOAuthState(s: McpOAuthState): Promise<void>;
  byMcpOAuthState(state: string): Promise<McpOAuthState | undefined>;
  delMcpOAuthState(state: string): Promise<void>;
  putMcpOAuthCode(c: McpOAuthCode): Promise<void>;
  byMcpOAuthCode(codeHash: string): Promise<McpOAuthCode | undefined>;
  delMcpOAuthCode(codeHash: string): Promise<void>;
  putMcpOAuthAccessToken(t: McpOAuthAccessToken): Promise<void>;
  byMcpOAuthAccessToken(
    tokenHash: string,
  ): Promise<McpOAuthAccessToken | undefined>;
  delMcpOAuthAccessToken(tokenHash: string): Promise<void>;
  putMcpOAuthRefreshToken(t: McpOAuthRefreshToken): Promise<void>;
  byMcpOAuthRefreshToken(
    tokenHash: string,
  ): Promise<McpOAuthRefreshToken | undefined>;
  delMcpOAuthRefreshToken(tokenHash: string): Promise<void>;
  putGitHubSourceControlInstallState(state: GitHubSourceControlInstallState): Promise<void>;
  byGitHubSourceControlInstallState(state: string): Promise<GitHubSourceControlInstallState | undefined>;
  delGitHubSourceControlInstallState(state: string): Promise<void>;
  putGitHubSourceControlConnection(connection: GitHubSourceControlConnection): Promise<void>;
  byGitHubSourceControlConnection(connectionId: string): Promise<GitHubSourceControlConnection | undefined>;
  putGitHubSourceControlHandoff(handoff: GitHubSourceControlHandoff): Promise<void>;
  consumeGitHubSourceControlHandoff(input: {
    tokenHash: string;
    workspaceId: string;
    nodeId: string;
    nowMs: number;
  }): Promise<GitHubSourceControlHandoff | undefined>;
  putAccountWorkspace(workspace: AccountWorkspace): Promise<void>;
  byAccountWorkspace(accountId: string): Promise<AccountWorkspace | undefined>;
  resetWorkspaceEnrollment(input: {
    accountId: string;
    workspaceId: string;
    workspaceHost: string;
  }): Promise<{ nodesRemoved: number }>;
  createWorkspaceCloudTrial(
    trial: WorkspaceCloudTrial,
  ): Promise<WorkspaceCloudTrial>;
  byWorkspaceCloudTrial(
    workspaceId: string,
  ): Promise<WorkspaceCloudTrial | undefined>;
  putManagedCloudCheckout(checkout: ManagedCloudCheckout): Promise<void>;
  byManagedCloudCheckout(checkoutId: string): Promise<ManagedCloudCheckout | undefined>;
  byAccountManagedCloudCheckout(accountId: string): Promise<ManagedCloudCheckout | undefined>;
  putWorkspaceMembership(membership: WorkspaceMembership): Promise<void>;
  listWorkspaceMemberships(accountId: string): Promise<WorkspaceMembership[]>;
  putAuthoritySession(session: AuthoritySession): Promise<void>;
  byAuthoritySession(tokenHash: string): Promise<AuthoritySession | undefined>;
  delAuthoritySession(tokenHash: string): Promise<void>;
  putWorkspaceLoginHandoff(handoff: WorkspaceLoginHandoff): Promise<void>;
  consumeWorkspaceLoginHandoff(input: {
    tokenHash: string;
    audienceHost: string;
    nowMs: number;
  }): Promise<WorkspaceLoginHandoff | undefined>;
  putWorkspaceBrowserSession(session: WorkspaceBrowserSession): Promise<void>;
  byWorkspaceBrowserSession(
    tokenHash: string,
  ): Promise<WorkspaceBrowserSession | undefined>;
  delWorkspaceBrowserSession(tokenHash: string): Promise<void>;
  putWorkspaceNode(node: WorkspaceNode): Promise<void>;
  delWorkspaceNode(accountId: string, nodeId: string): Promise<void>;
  delWorkspaceNodeIfMatch(input: {
    accountId: string;
    nodeId: string;
    updatedAt: number;
    devicePublicKeyThumbprint: string;
  }): Promise<boolean>;
  byWorkspaceNode(
    accountId: string,
    nodeId: string,
  ): Promise<WorkspaceNode | undefined>;
  byWorkspaceNodeId(nodeId: string): Promise<WorkspaceNode | undefined>;
  listWorkspaceNodes(accountId: string): Promise<WorkspaceNode[]>;
  listWorkspaceNodesByHost(workspaceHost: string): Promise<WorkspaceNode[]>;
  listAllWorkspaceNodes(): Promise<WorkspaceNode[]>;
  claimWorkspaceNodeNonce(
    nodeId: string,
    nonce: string,
    expiresAt: number,
    nowMs: number,
  ): Promise<boolean>;
  byWorkspaceTaskAffinity(input: {
    accountId: string;
    workspaceHost: string;
    taskSession: string;
    nowMs?: number;
  }): Promise<WorkspaceTaskAffinity | undefined>;
  claimWorkspaceTaskAffinity(
    affinity: WorkspaceTaskAffinity,
  ): Promise<WorkspaceTaskAffinityClaim>;
  releaseWorkspaceTaskAffinity(input: {
    accountId: string;
    workspaceHost: string;
    taskSession: string;
    ownerNodeId: string;
  }): Promise<boolean>;
  byWorkspaceSessionAffinity(input: {
    accountId: string;
    workspaceHost: string;
    sessionKind: WorkspaceSessionKind;
    sessionId: string;
    nowMs?: number;
  }): Promise<WorkspaceSessionAffinity | undefined>;
  claimWorkspaceSessionAffinity(
    affinity: WorkspaceSessionAffinity,
  ): Promise<WorkspaceSessionAffinityClaim>;
  releaseWorkspaceSessionAffinity(input: {
    accountId: string;
    workspaceHost: string;
    sessionKind: WorkspaceSessionKind;
    sessionId: string;
    ownerNodeId: string;
  }): Promise<boolean>;
  putNodeBootstrapCredential(
    credential: NodeBootstrapCredential,
  ): Promise<void>;
  byNodeBootstrapCredential(
    tokenHash: string,
  ): Promise<NodeBootstrapCredential | undefined>;
  delNodeBootstrapCredential(tokenHash: string): Promise<void>;
  putWorkspaceAgentStatus(status: WorkspaceAgentStatus): Promise<void>;
  byWorkspaceAgentStatus(
    workspaceHost: string,
  ): Promise<WorkspaceAgentStatus | undefined>;
  createManagedCloudProvisioningJob(
    job: ManagedCloudProvisioningJob,
  ): Promise<ManagedCloudProvisioningCreateResult>;
  byManagedCloudProvisioningJob(
    jobId: string,
  ): Promise<ManagedCloudProvisioningJob | undefined>;
  claimNextManagedCloudProvisioningJob(input: {
    leaseId: string;
    nowMs: number;
    leaseExpiresAt: number;
    enrollmentNonce: string;
    enrollmentExpiresAt: number;
  }): Promise<ManagedCloudProvisioningClaimResult>;
  updateManagedCloudProvisioningJob(input: {
    jobId: string;
    leaseId?: string;
    status: ManagedCloudProvisioningStatus;
    nowMs: number;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<ManagedCloudProvisioningJob | undefined>;
  consumeManagedCloudProvisioningEnrollment(input: {
    jobId: string;
    nowMs: number;
  }): Promise<ManagedCloudProvisioningJob | undefined>;
  markManagedCloudProvisioningReadyByNode(input: {
    nodeId: string;
    nowMs: number;
  }): Promise<ManagedCloudProvisioningJob | undefined>;
};
export type StorageTransactionLike = {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list?<T>(options?: { prefix?: string }): Promise<Map<string, T>>;
};
export type StorageLike = StorageTransactionLike & {
  list?<T>(options?: { prefix?: string }): Promise<Map<string, T>>;
  transaction?<T>(
    closure: (transaction: StorageTransactionLike) => Promise<T>,
  ): Promise<T>;
};
export type StateLike = { storage: StorageLike };
export type StubLike = { fetch(request: Request): Promise<Response> };
export type NamespaceLike = {
  idFromName(name: string): unknown;
  get(id: unknown): StubLike;
};
export type Env = {
  DEVICE_GRANTS: NamespaceLike;
  OS_DEVICE_AUTH_ORIGIN?: string;
  OS_DEVICE_AUTH_ASSERTION_SECRET?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  GITHUB_APP_ID?: string;
  GITHUB_APP_SLUG?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  WORKSPACE_ROUTE_REGISTRY?: WorkspaceRouteRegistryBinding;
  WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET?: string;
  OS_ENROLLMENT_RESET_SECRET?: string;
  OS_DEVICE_AUTH_DEFAULT_SITE_SNAPSHOT_KEY?: string;
  OS_DEVICE_AUTH_DEFAULT_SITE_SNAPSHOT_VERSION_ID?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  OS_DEVICE_AUTH_BASE_DOMAIN?: string;
  OS_DEVICE_AUTH_WORKSPACE_EDGE_HOSTNAME?: string;
  OS_DEVICE_AUTH_CONNECTOR_LOCAL_SERVICE_URL?: string;
  OS_DEVICE_AUTH_CLOUDFLARE_API_BASE_URL?: string;
  OS_MANAGED_CLOUD_PRICING_POLICY_JSON?: string;
  OS_MANAGED_CLOUD_RATE_CARDS_JSON?: string;
  OS_MANAGED_CLOUD_PROVISIONER_SECRET?: string;
  OS_MANAGED_CLOUD_ENROLLMENT_SECRET?: string;
  OS_STRIPE_SECRET_KEY?: string;
  OS_STRIPE_WEBHOOK_SECRET?: string;
  OS_STRIPE_API_BASE_URL?: string;
  OS_STRIPE_SYNTHETIC_SECRET_KEY?: string;
  OS_STRIPE_SYNTHETIC_WEBHOOK_SECRET?: string;
  OS_STRIPE_SYNTHETIC_ACCOUNT_IDS?: string;
  OS_STRIPE_SYNTHETIC_WORKSPACE_IDS?: string;
  OS_DEVICE_AUTH_LOGGER?: DeviceAuthorityLogger;
  INSTALL_DIAGNOSTICS?: InstallDiagnosticR2Bucket;
  OS_INSTALL_SUCCESS_DIAGNOSTIC_RETENTION_DAYS?: string;
  SENTRY_DSN?: string;
  POSTHOG_API_KEY?: string;
  POSTHOG_HOST?: string;
};

export type CheckoutTelemetryEventName =
  | 'checkout_catalog_viewed'
  | 'checkout_plan_selected'
  | 'checkout_session_created'
  | 'checkout_cancelled'
  | 'checkout_completed'
  | 'checkout_failed'
  | 'checkout_synthetic_session_created'
  | 'checkout_synthetic_completed'
  | 'checkout_synthetic_failed';

export type CheckoutTelemetryEvent = {
  name: CheckoutTelemetryEventName;
  accountId?: string;
  checkoutId?: string;
  stripeSessionId?: string;
  planId?: string;
  pricingVersion?: string;
  monthlyPriceCents?: number;
  currency?: string;
  synthetic: boolean;
  outcome?: 'started' | 'success' | 'cancelled' | 'error';
  errorCode?: string;
  durationMs?: number;
  cloudflareRayId?: string;
};

export type CheckoutObservability = {
  observe(event: CheckoutTelemetryEvent): Promise<void>;
  captureException(error: unknown, event: CheckoutTelemetryEvent): Promise<void>;
};

export type DeviceAuthorityOperationalLogContext = {
  component: 'os-device-authority';
  operation: 'mcp-node-directory' | 'task-affinity-bookkeeping';
  accountId: string;
  workspaceId: string;
  workspaceHost: string;
  failure: string;
  taskSession?: string;
  nodeId?: string;
  outcome?: 'conflict' | 'error';
};

export type DeviceAuthorityLogger = {
  warn: (message: string, context: DeviceAuthorityOperationalLogContext) => void;
};

export type DeviceAuthorityRuntime = {
  store: Store;
  origin: string;
  now: () => number;
  approvalAssertionSecret?: string;
  googleOAuthClientId?: string;
  googleOAuthClientSecret?: string;
  githubAppId?: string;
  githubAppSlug?: string;
  githubAppPrivateKey?: string;
  fetchImpl: typeof fetch;
  workspaceRouteRegistry?: WorkspaceRouteRegistryBinding;
  workspaceConnectorProvisioner?: WorkspaceConnectorProvisioner;
  workspaceEdgeInternalSigningSecret?: string;
  operatorEnrollmentResetSecret?: string;
  defaultSiteSnapshot?: DefaultSiteSnapshot;
  managedCloudPricing?: ManagedCloudPricingRuntime;
  managedCloudProvisionerSecret?: string;
  managedCloudEnrollmentSecret?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  stripeApiBaseUrl?: string;
  stripeSyntheticSecretKey?: string;
  stripeSyntheticWebhookSecret?: string;
  stripeSyntheticAccountIds?: string;
  stripeSyntheticWorkspaceIds?: string;
  checkoutObservability?: CheckoutObservability;
  operationalLogger?: DeviceAuthorityLogger;
  installControlPlaneRepository?: InstallControlPlaneRepository;
  installDiagnosticBundleStore?: InstallDiagnosticBundleStore;
  installTelemetryObserver?: InstallTelemetryObserver;
  installSentryDsn?: string;
};
