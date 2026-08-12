import type { WorkspaceRouteD1Database } from '../../../scripts/lib/workspace-cloudflare-d1-route-registry';
import type { WorkspaceSiteSnapshotId } from '../../../scripts/lib/workspace-edge-route-seed';
import type { ManagedCloudPricingRuntime } from './services/managed-cloud-pricing';

export type GrantStatus = 'pending' | 'approved' | 'denied' | 'failed';
export type GrantFailureCode = 'workspace_route_setup_failed';
export type WorkspaceNodeRole = 'home' | 'member';
export type WorkspaceNodeStatus = 'created' | 'reconnected';
export type StrongerAuthMethod =
  | 'google'
  | 'passkey'
  | 'magic_link'
  | 'hardware_key'
  | 'admin_invite';

export type Grant = {
  hash: string;
  userCode: string;
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
};

export type WorkspaceTaskAffinityClaim = {
  status: 'created' | 'existing' | 'conflict';
  affinity: WorkspaceTaskAffinity;
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
  returnPath: string;
  expiresAt: number;
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

export type WorkspaceRouteRegistryBinding = WorkspaceRouteD1Database;
export type DefaultSiteSnapshot = {
  key: string;
  versionId: string;
  siteId?: WorkspaceSiteSnapshotId;
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
  putAccountWorkspace(workspace: AccountWorkspace): Promise<void>;
  byAccountWorkspace(accountId: string): Promise<AccountWorkspace | undefined>;
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
};
export type StorageTransactionLike = {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
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
  WORKSPACE_ROUTE_REGISTRY?: WorkspaceRouteRegistryBinding;
  WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET?: string;
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
};

export type DeviceAuthorityRuntime = {
  store: Store;
  origin: string;
  now: () => number;
  approvalAssertionSecret?: string;
  googleOAuthClientId?: string;
  googleOAuthClientSecret?: string;
  fetchImpl: typeof fetch;
  workspaceRouteRegistry?: WorkspaceRouteRegistryBinding;
  workspaceConnectorProvisioner?: WorkspaceConnectorProvisioner;
  workspaceEdgeInternalSigningSecret?: string;
  defaultSiteSnapshot?: DefaultSiteSnapshot;
  managedCloudPricing?: ManagedCloudPricingRuntime;
};
