import type {
  AccountWorkspace,
  AuthoritySession,
  GitHubSourceControlConnection,
  GitHubSourceControlHandoff,
  GitHubSourceControlInstallState,
  Grant,
  McpOAuthAccessToken,
  McpOAuthCode,
  McpOAuthRefreshToken,
  McpOAuthState,
  NodeBootstrapCredential,
  OAuthState,
  StorageLike,
  Store,
  WorkspaceNode,
  WorkspaceAgentStatus,
  WebOAuthState,
  WorkspaceBrowserSession,
  WorkspaceLoginHandoff,
  WorkspaceMembership,
} from './types';
import { cleanCode } from './utils';

const cloneWorkspaceNode = (node: WorkspaceNode): WorkspaceNode => ({
  ...node,
  ...(node.capabilities ? { capabilities: [...node.capabilities] } : {}),
  ...(node.agents ? { agents: [...node.agents] } : {}),
});

const cloneGitHubSourceControlConnection = (
  connection: GitHubSourceControlConnection,
): GitHubSourceControlConnection => ({
  ...connection,
  repositories: connection.repositories.map((repository) => ({ ...repository })),
});

const isWorkspaceNode = (value: unknown): value is WorkspaceNode =>
  Boolean(value) &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  typeof (value as { accountId?: unknown }).accountId === 'string' &&
  typeof (value as { nodeId?: unknown }).nodeId === 'string' &&
  typeof (value as { workspaceHost?: unknown }).workspaceHost === 'string';

export const WORKSPACE_NODE_NONCE_LIMIT = 256;

type WorkspaceNodeNonceClaim = {
  nonce: string;
  expiresAt: number;
};

export class DurableStore implements Store {
  constructor(private storage: StorageLike) {}

  private async legacyWorkspaceNodes(prefix = 'wn:'): Promise<WorkspaceNode[]> {
    if (!this.storage.list) return [];
    const entries = await this.storage.list<unknown>({ prefix });
    return [...entries.entries()]
      .filter(([key, value]) => {
        if (!isWorkspaceNode(value)) return false;
        return key === `wn:${value.accountId}:${value.nodeId}`;
      })
      .map(([, value]) => cloneWorkspaceNode(value as WorkspaceNode));
  }

  private async backfillWorkspaceNodeIndexes(
    nodes: WorkspaceNode[],
  ): Promise<WorkspaceNode[]> {
    for (const node of nodes) await this.putWorkspaceNode(node);
    return nodes.map(cloneWorkspaceNode);
  }
  async put(g: Grant) {
    try {
      await this.storage.put(`d:${g.hash}`, g);
      await this.storage.put(`u:${cleanCode(g.userCode)}`, g.hash);
    } catch {
      throw new Error('grant write failed');
    }
  }
  async byHash(h: string) {
    try {
      return await this.storage.get<Grant>(`d:${h}`);
    } catch {
      throw new Error('grant read failed');
    }
  }
  async byUserCode(c: string) {
    try {
      const h = await this.storage.get<string>(`u:${cleanCode(c)}`);
      return h ? await this.byHash(h) : undefined;
    } catch {
      throw new Error('grant lookup failed');
    }
  }
  async del(h: string) {
    try {
      const g = await this.byHash(h);
      await this.storage.delete(`d:${h}`);
      if (g) await this.storage.delete(`u:${cleanCode(g.userCode)}`);
    } catch {
      throw new Error('grant delete failed');
    }
  }
  async putOAuthState(s: OAuthState) {
    try {
      await this.storage.put(`s:${s.state}`, s);
    } catch {
      throw new Error('oauth state write failed');
    }
  }
  async byOAuthState(state: string) {
    try {
      return await this.storage.get<OAuthState>(`s:${state}`);
    } catch {
      throw new Error('oauth state read failed');
    }
  }
  async delOAuthState(state: string) {
    try {
      await this.storage.delete(`s:${state}`);
    } catch {
      throw new Error('oauth state delete failed');
    }
  }
  async putWebOAuthState(s: WebOAuthState) {
    try {
      await this.storage.put(`wos:${s.state}`, s);
    } catch {
      throw new Error('web oauth state write failed');
    }
  }
  async byWebOAuthState(state: string) {
    try {
      return await this.storage.get<WebOAuthState>(`wos:${state}`);
    } catch {
      throw new Error('web oauth state read failed');
    }
  }
  async delWebOAuthState(state: string) {
    try {
      await this.storage.delete(`wos:${state}`);
    } catch {
      throw new Error('web oauth state delete failed');
    }
  }
  async putMcpOAuthState(s: McpOAuthState) {
    try {
      await this.storage.put(`mos:${s.state}`, s);
    } catch {
      throw new Error('mcp oauth state write failed');
    }
  }
  async byMcpOAuthState(state: string) {
    try {
      return await this.storage.get<McpOAuthState>(`mos:${state}`);
    } catch {
      throw new Error('mcp oauth state read failed');
    }
  }
  async delMcpOAuthState(state: string) {
    try {
      await this.storage.delete(`mos:${state}`);
    } catch {
      throw new Error('mcp oauth state delete failed');
    }
  }
  async putMcpOAuthCode(c: McpOAuthCode) {
    try {
      await this.storage.put(`moc:${c.codeHash}`, c);
    } catch {
      throw new Error('mcp oauth code write failed');
    }
  }
  async byMcpOAuthCode(codeHash: string) {
    try {
      return await this.storage.get<McpOAuthCode>(`moc:${codeHash}`);
    } catch {
      throw new Error('mcp oauth code read failed');
    }
  }
  async delMcpOAuthCode(codeHash: string) {
    try {
      await this.storage.delete(`moc:${codeHash}`);
    } catch {
      throw new Error('mcp oauth code delete failed');
    }
  }
  async putMcpOAuthAccessToken(t: McpOAuthAccessToken) {
    try {
      await this.storage.put(`mot:${t.tokenHash}`, t);
    } catch {
      throw new Error('mcp oauth token write failed');
    }
  }
  async byMcpOAuthAccessToken(tokenHash: string) {
    try {
      return await this.storage.get<McpOAuthAccessToken>(`mot:${tokenHash}`);
    } catch {
      throw new Error('mcp oauth token read failed');
    }
  }
  async delMcpOAuthAccessToken(tokenHash: string) {
    try {
      await this.storage.delete(`mot:${tokenHash}`);
    } catch {
      throw new Error('mcp oauth token delete failed');
    }
  }
  async putMcpOAuthRefreshToken(t: McpOAuthRefreshToken) {
    try {
      await this.storage.put(`mrt:${t.tokenHash}`, t);
    } catch {
      throw new Error('mcp oauth refresh token write failed');
    }
  }
  async byMcpOAuthRefreshToken(tokenHash: string) {
    try {
      return await this.storage.get<McpOAuthRefreshToken>(`mrt:${tokenHash}`);
    } catch {
      throw new Error('mcp oauth refresh token read failed');
    }
  }
  async delMcpOAuthRefreshToken(tokenHash: string) {
    try {
      await this.storage.delete(`mrt:${tokenHash}`);
    } catch {
      throw new Error('mcp oauth refresh token delete failed');
    }
  }
  async putGitHubSourceControlInstallState(state: GitHubSourceControlInstallState) {
    try {
      await this.storage.put(`gss:${state.state}`, state);
    } catch {
      throw new Error('github source-control install state write failed');
    }
  }
  async byGitHubSourceControlInstallState(state: string) {
    try {
      return await this.storage.get<GitHubSourceControlInstallState>(`gss:${state}`);
    } catch {
      throw new Error('github source-control install state read failed');
    }
  }
  async delGitHubSourceControlInstallState(state: string) {
    try {
      await this.storage.delete(`gss:${state}`);
    } catch {
      throw new Error('github source-control install state delete failed');
    }
  }
  async putGitHubSourceControlConnection(connection: GitHubSourceControlConnection) {
    try {
      await this.storage.put(
        `gsc:${connection.connectionId}`,
        cloneGitHubSourceControlConnection(connection),
      );
    } catch {
      throw new Error('github source-control connection write failed');
    }
  }
  async byGitHubSourceControlConnection(connectionId: string) {
    try {
      const connection = await this.storage.get<GitHubSourceControlConnection>(
        `gsc:${connectionId}`,
      );
      return connection ? cloneGitHubSourceControlConnection(connection) : undefined;
    } catch {
      throw new Error('github source-control connection read failed');
    }
  }
  async putGitHubSourceControlHandoff(handoff: GitHubSourceControlHandoff) {
    try {
      await this.storage.put(`gsh:${handoff.tokenHash}`, handoff);
    } catch {
      throw new Error('github source-control handoff write failed');
    }
  }
  async consumeGitHubSourceControlHandoff(input: {
    tokenHash: string;
    workspaceId: string;
    nodeId: string;
    nowMs: number;
  }) {
    const consume = async (storage: StorageLike) => {
      const key = `gsh:${input.tokenHash}`;
      const handoff = await storage.get<GitHubSourceControlHandoff>(key);
      if (
        !handoff
        || handoff.workspaceId !== input.workspaceId
        || handoff.nodeId !== input.nodeId
        || input.nowMs >= handoff.expiresAt
      ) {
        if (handoff && input.nowMs >= handoff.expiresAt) await storage.delete(key);
        return undefined;
      }
      await storage.delete(key);
      return { ...handoff };
    };
    try {
      return this.storage.transaction
        ? await this.storage.transaction((transaction) => consume(transaction))
        : await consume(this.storage);
    } catch {
      throw new Error('github source-control handoff consume failed');
    }
  }
  async putAccountWorkspace(workspace: AccountWorkspace) {
    try {
      await this.storage.put(`aw:${workspace.accountId}`, workspace);
    } catch {
      throw new Error('account workspace write failed');
    }
  }
  async byAccountWorkspace(accountId: string) {
    try {
      return await this.storage.get<AccountWorkspace>(`aw:${accountId}`);
    } catch {
      throw new Error('account workspace read failed');
    }
  }
  async putWorkspaceMembership(membership: WorkspaceMembership) {
    try {
      const key = `wml:${membership.accountId}`;
      const workspaceIds = (await this.storage.get<string[]>(key)) ?? [];
      await this.storage.put(
        `wm:${membership.accountId}:${membership.workspaceId}`,
        membership,
      );
      if (!workspaceIds.includes(membership.workspaceId)) {
        await this.storage.put(key, [...workspaceIds, membership.workspaceId]);
      }
    } catch {
      throw new Error('workspace membership write failed');
    }
  }
  async listWorkspaceMemberships(accountId: string) {
    try {
      const workspaceIds = await this.storage.get<string[]>(`wml:${accountId}`);
      if (workspaceIds) {
        const memberships = await Promise.all(
          workspaceIds.map((workspaceId) =>
            this.storage.get<WorkspaceMembership>(
              `wm:${accountId}:${workspaceId}`,
            ),
          ),
        );
        return memberships.filter(
          (membership): membership is WorkspaceMembership =>
            Boolean(membership),
        );
      }
      const workspace = await this.byAccountWorkspace(accountId);
      if (!workspace) return [];
      return [
        {
          accountId,
          workspaceId:
            workspace.workspaceId ??
            `workspace_${workspace.workspaceSlug.replace(/-/g, '_')}`,
          workspaceSlug: workspace.workspaceSlug,
          workspaceHost: workspace.workspaceHost,
          status: 'active' as const,
          createdAt: workspace.updatedAt,
          updatedAt: workspace.updatedAt,
        },
      ];
    } catch {
      throw new Error('workspace membership list failed');
    }
  }
  async putAuthoritySession(session: AuthoritySession) {
    try {
      await this.storage.put(`wasess:${session.tokenHash}`, session);
    } catch {
      throw new Error('authority session write failed');
    }
  }
  async byAuthoritySession(tokenHash: string) {
    try {
      return await this.storage.get<AuthoritySession>(`wasess:${tokenHash}`);
    } catch {
      throw new Error('authority session read failed');
    }
  }
  async delAuthoritySession(tokenHash: string) {
    try {
      await this.storage.delete(`wasess:${tokenHash}`);
    } catch {
      throw new Error('authority session delete failed');
    }
  }
  async putWorkspaceLoginHandoff(handoff: WorkspaceLoginHandoff) {
    try {
      await this.storage.put(`wlh:${handoff.tokenHash}`, handoff);
    } catch {
      throw new Error('workspace login handoff write failed');
    }
  }
  async consumeWorkspaceLoginHandoff(input: {
    tokenHash: string;
    audienceHost: string;
    nowMs: number;
  }) {
    const consume = async (storage: StorageLike) => {
      const key = `wlh:${input.tokenHash}`;
      const handoff = await storage.get<WorkspaceLoginHandoff>(key);
      if (
        !handoff ||
        handoff.workspaceHost !== input.audienceHost.trim().toLowerCase() ||
        input.nowMs >= handoff.expiresAt
      ) {
        return undefined;
      }
      await storage.delete(key);
      return handoff;
    };
    try {
      if (this.storage.transaction) {
        return await this.storage.transaction((transaction) =>
          consume(transaction),
        );
      }
      return await consume(this.storage);
    } catch {
      throw new Error('workspace login handoff consume failed');
    }
  }
  async putWorkspaceBrowserSession(session: WorkspaceBrowserSession) {
    try {
      await this.storage.put(`wbss:${session.tokenHash}`, session);
    } catch {
      throw new Error('workspace browser session write failed');
    }
  }
  async byWorkspaceBrowserSession(tokenHash: string) {
    try {
      return await this.storage.get<WorkspaceBrowserSession>(
        `wbss:${tokenHash}`,
      );
    } catch {
      throw new Error('workspace browser session read failed');
    }
  }
  async delWorkspaceBrowserSession(tokenHash: string) {
    try {
      await this.storage.delete(`wbss:${tokenHash}`);
    } catch {
      throw new Error('workspace browser session delete failed');
    }
  }
  async putWorkspaceNode(node: WorkspaceNode) {
    try {
      const boundAccountId = await this.storage.get<string>(
        `wni:${node.nodeId}`,
      );
      if (boundAccountId && boundAccountId !== node.accountId) {
        throw new Error(
          'workspace node ID is already bound to another account',
        );
      }
      const nodeIds =
        (await this.storage.get<string[]>(`wnl:${node.accountId}`)) ?? [];
      const hostNodeIds =
        (await this.storage.get<string[]>(`wnh:${node.workspaceHost}`)) ?? [];
      await this.storage.put(
        `wn:${node.accountId}:${node.nodeId}`,
        cloneWorkspaceNode(node),
      );
      await this.storage.put(`wni:${node.nodeId}`, node.accountId);
      if (!nodeIds.includes(node.nodeId)) {
        await this.storage.put(`wnl:${node.accountId}`, [
          ...nodeIds,
          node.nodeId,
        ]);
      }
      if (!hostNodeIds.includes(node.nodeId)) {
        await this.storage.put(`wnh:${node.workspaceHost}`, [
          ...hostNodeIds,
          node.nodeId,
        ]);
      }
    } catch {
      throw new Error('workspace node write failed');
    }
  }
  async delWorkspaceNode(accountId: string, nodeId: string) {
    const remove = async (storage: StorageLike) => {
      const boundAccountId = await storage.get<string>(`wni:${nodeId}`);
      if (boundAccountId && boundAccountId !== accountId) {
        throw new Error('workspace node ID is bound to another account');
      }
      const node = await storage.get<WorkspaceNode>(
        `wn:${accountId}:${nodeId}`,
      );
      const nodeIds = (await storage.get<string[]>(`wnl:${accountId}`)) ?? [];
      const hostNodeIds = node
        ? ((await storage.get<string[]>(`wnh:${node.workspaceHost}`)) ?? [])
        : [];
      await storage.delete(`wn:${accountId}:${nodeId}`);
      if (boundAccountId === accountId) {
        await storage.delete(`wni:${nodeId}`);
      }
      await storage.put(
        `wnl:${accountId}`,
        nodeIds.filter((candidate) => candidate !== nodeId),
      );
      if (node) {
        await storage.put(
          `wnh:${node.workspaceHost}`,
          hostNodeIds.filter((candidate) => candidate !== nodeId),
        );
      }
    };
    try {
      if (this.storage.transaction) {
        await this.storage.transaction((transaction) => remove(transaction));
      } else {
        await remove(this.storage);
      }
    } catch {
      throw new Error('workspace node delete failed');
    }
  }
  async delWorkspaceNodeIfMatch(input: {
    accountId: string;
    nodeId: string;
    updatedAt: number;
    devicePublicKeyThumbprint: string;
  }): Promise<boolean> {
    try {
      let deleted = false;
      const remove = async (storage: StorageLike) => {
        try {
          const node = await storage.get<WorkspaceNode>(
            `wn:${input.accountId}:${input.nodeId}`,
          );
          if (
            !node ||
            node.updatedAt !== input.updatedAt ||
            node.devicePublicKeyThumbprint !== input.devicePublicKeyThumbprint
          )
            return;
          const nodeIds =
            (await storage.get<string[]>(`wnl:${input.accountId}`)) ?? [];
          const hostNodeIds =
            (await storage.get<string[]>(`wnh:${node.workspaceHost}`)) ?? [];
          await storage.delete(`wn:${input.accountId}:${input.nodeId}`);
          await storage.delete(`wni:${input.nodeId}`);
          await storage.put(
            `wnl:${input.accountId}`,
            nodeIds.filter((candidate) => candidate !== input.nodeId),
          );
          await storage.put(
            `wnh:${node.workspaceHost}`,
            hostNodeIds.filter((candidate) => candidate !== input.nodeId),
          );
          deleted = true;
        } catch {
          throw new Error('workspace node conditional delete failed');
        }
      };
      if (this.storage.transaction) {
        await this.storage.transaction((transaction) => remove(transaction));
      } else {
        await remove(this.storage);
      }
      return deleted;
    } catch {
      throw new Error('workspace node conditional delete failed');
    }
  }

  async byWorkspaceNode(accountId: string, nodeId: string) {
    try {
      const node = await this.storage.get<WorkspaceNode>(
        `wn:${accountId}:${nodeId}`,
      );
      return node ? cloneWorkspaceNode(node) : undefined;
    } catch {
      throw new Error('workspace node read failed');
    }
  }
  async byWorkspaceNodeId(nodeId: string) {
    try {
      const accountId = await this.storage.get<string>(`wni:${nodeId}`);
      const indexed = accountId
        ? await this.byWorkspaceNode(accountId, nodeId)
        : undefined;
      if (indexed) return indexed;
      const matches = (await this.legacyWorkspaceNodes()).filter(
        (node) => node.nodeId === nodeId,
      );
      if (matches.length === 0) return undefined;
      if (matches.length > 1) {
        throw new Error('workspace node ID is bound to multiple accounts');
      }
      await this.backfillWorkspaceNodeIndexes(matches);
      return cloneWorkspaceNode(matches[0]);
    } catch {
      throw new Error('workspace node identity read failed');
    }
  }
  async listWorkspaceNodes(accountId: string) {
    try {
      const indexedNodeIds = await this.storage.get<string[]>(
        `wnl:${accountId}`,
      );
      if (indexedNodeIds === undefined) {
        const legacyNodes = await this.legacyWorkspaceNodes(`wn:${accountId}:`);
        return this.backfillWorkspaceNodeIndexes(legacyNodes);
      }
      const nodeIds = indexedNodeIds;
      const nodes = await Promise.all(
        nodeIds.map((nodeId) => this.byWorkspaceNode(accountId, nodeId)),
      );
      return nodes.filter((node): node is WorkspaceNode => Boolean(node));
    } catch {
      throw new Error('workspace node list failed');
    }
  }
  async listWorkspaceNodesByHost(workspaceHost: string) {
    try {
      const indexedNodeIds = await this.storage.get<string[]>(
        `wnh:${workspaceHost}`,
      );
      if (indexedNodeIds === undefined) {
        const legacyNodes = (await this.legacyWorkspaceNodes()).filter(
          (node) => node.workspaceHost === workspaceHost,
        );
        return this.backfillWorkspaceNodeIndexes(legacyNodes);
      }
      const nodeIds = indexedNodeIds;
      const nodes = await Promise.all(
        nodeIds.map((nodeId) => this.byWorkspaceNodeId(nodeId)),
      );
      return nodes.filter(
        (node): node is WorkspaceNode =>
          Boolean(node) && node?.workspaceHost === workspaceHost,
      );
    } catch {
      throw new Error('workspace node host list failed');
    }
  }
  async claimWorkspaceNodeNonce(
    nodeId: string,
    nonce: string,
    expiresAt: number,
    nowMs: number,
  ) {
    const claim = async (storage: StorageLike): Promise<boolean> => {
      const key = `wnn:${nodeId}:${nonce}`;
      const existing = await storage.get<number>(key);
      if (existing && existing > nowMs) return false;
      const indexKey = `wnnl:${nodeId}`;
      const indexed =
        (await storage.get<WorkspaceNodeNonceClaim[]>(indexKey)) ?? [];
      const active: WorkspaceNodeNonceClaim[] = [];
      for (const entry of indexed) {
        if (entry.expiresAt <= nowMs) {
          await storage.delete(`wnn:${nodeId}:${entry.nonce}`);
        } else if (entry.nonce !== nonce) {
          active.push(entry);
        }
      }
      if (active.length >= WORKSPACE_NODE_NONCE_LIMIT) return false;
      await storage.put(key, expiresAt);
      await storage.put(indexKey, [...active, { nonce, expiresAt }]);
      return true;
    };
    try {
      return this.storage.transaction
        ? await this.storage.transaction((transaction) => claim(transaction))
        : await claim(this.storage);
    } catch {
      throw new Error('workspace node nonce write failed');
    }
  }
  async putNodeBootstrapCredential(credential: NodeBootstrapCredential) {
    try {
      await this.storage.put(`nbc:${credential.tokenHash}`, credential);
    } catch {
      throw new Error('node bootstrap credential write failed');
    }
  }
  async byNodeBootstrapCredential(tokenHash: string) {
    try {
      return await this.storage.get<NodeBootstrapCredential>(
        `nbc:${tokenHash}`,
      );
    } catch {
      throw new Error('node bootstrap credential read failed');
    }
  }
  async delNodeBootstrapCredential(tokenHash: string) {
    try {
      await this.storage.delete(`nbc:${tokenHash}`);
    } catch {
      throw new Error('node bootstrap credential delete failed');
    }
  }
  async putWorkspaceAgentStatus(status: WorkspaceAgentStatus) {
    try {
      await this.storage.put(`was:${status.workspaceHost}`, status);
    } catch {
      throw new Error('workspace agent status write failed');
    }
  }
  async byWorkspaceAgentStatus(workspaceHost: string) {
    try {
      return await this.storage.get<WorkspaceAgentStatus>(
        `was:${workspaceHost}`,
      );
    } catch {
      throw new Error('workspace agent status read failed');
    }
  }
}

export function createMemoryDeviceGrantStore(): Store {
  const grants = new Map<string, Grant>();
  const states = new Map<string, OAuthState>();
  const webOAuthStates = new Map<string, WebOAuthState>();
  const mcpStates = new Map<string, McpOAuthState>();
  const mcpCodes = new Map<string, McpOAuthCode>();
  const mcpTokens = new Map<string, McpOAuthAccessToken>();
  const mcpRefreshTokens = new Map<string, McpOAuthRefreshToken>();
  const githubSourceControlInstallStates = new Map<string, GitHubSourceControlInstallState>();
  const githubSourceControlConnections = new Map<string, GitHubSourceControlConnection>();
  const githubSourceControlHandoffs = new Map<string, GitHubSourceControlHandoff>();
  const accountWorkspaces = new Map<string, AccountWorkspace>();
  const workspaceMemberships = new Map<string, WorkspaceMembership>();
  const authoritySessions = new Map<string, AuthoritySession>();
  const workspaceLoginHandoffs = new Map<string, WorkspaceLoginHandoff>();
  const workspaceBrowserSessions = new Map<string, WorkspaceBrowserSession>();
  const workspaceNodes = new Map<string, WorkspaceNode>();
  const workspaceNodeAccounts = new Map<string, string>();
  const workspaceNodeNonces = new Map<string, number>();
  const nodeBootstrapCredentials = new Map<string, NodeBootstrapCredential>();
  const workspaceAgentStatuses = new Map<string, WorkspaceAgentStatus>();
  const cloneWorkspaceAgentStatus = (
    status: WorkspaceAgentStatus,
  ): WorkspaceAgentStatus => ({
    ...status,
    nodes: Object.fromEntries(
      Object.entries(status.nodes).map(([nodeId, node]) => [
        nodeId,
        { ...node, agents: [...node.agents] },
      ]),
    ),
  });
  return {
    put(g) {
      grants.set(g.hash, { ...g });
      return Promise.resolve();
    },
    byHash(h) {
      const g = grants.get(h);
      return Promise.resolve(g ? { ...g } : undefined);
    },
    byUserCode(c) {
      for (const g of grants.values())
        if (cleanCode(g.userCode) === cleanCode(c))
          return Promise.resolve({ ...g });
      return Promise.resolve(undefined);
    },
    del(h) {
      grants.delete(h);
      return Promise.resolve();
    },
    putOAuthState(s) {
      states.set(s.state, { ...s });
      return Promise.resolve();
    },
    byOAuthState(state) {
      const s = states.get(state);
      return Promise.resolve(s ? { ...s } : undefined);
    },
    delOAuthState(state) {
      states.delete(state);
      return Promise.resolve();
    },
    putWebOAuthState(s) {
      webOAuthStates.set(s.state, { ...s });
      return Promise.resolve();
    },
    byWebOAuthState(state) {
      const s = webOAuthStates.get(state);
      return Promise.resolve(s ? { ...s } : undefined);
    },
    delWebOAuthState(state) {
      webOAuthStates.delete(state);
      return Promise.resolve();
    },
    putMcpOAuthState(s) {
      mcpStates.set(s.state, { ...s, scopes: [...s.scopes] });
      return Promise.resolve();
    },
    byMcpOAuthState(state) {
      const s = mcpStates.get(state);
      return Promise.resolve(s ? { ...s, scopes: [...s.scopes] } : undefined);
    },
    delMcpOAuthState(state) {
      mcpStates.delete(state);
      return Promise.resolve();
    },
    putMcpOAuthCode(c) {
      mcpCodes.set(c.codeHash, { ...c, scopes: [...c.scopes] });
      return Promise.resolve();
    },
    byMcpOAuthCode(codeHash) {
      const c = mcpCodes.get(codeHash);
      return Promise.resolve(c ? { ...c, scopes: [...c.scopes] } : undefined);
    },
    delMcpOAuthCode(codeHash) {
      mcpCodes.delete(codeHash);
      return Promise.resolve();
    },
    putMcpOAuthAccessToken(t) {
      mcpTokens.set(t.tokenHash, { ...t, scopes: [...t.scopes] });
      return Promise.resolve();
    },
    byMcpOAuthAccessToken(tokenHash) {
      const t = mcpTokens.get(tokenHash);
      return Promise.resolve(t ? { ...t, scopes: [...t.scopes] } : undefined);
    },
    delMcpOAuthAccessToken(tokenHash) {
      mcpTokens.delete(tokenHash);
      return Promise.resolve();
    },
    putMcpOAuthRefreshToken(t) {
      mcpRefreshTokens.set(t.tokenHash, { ...t, scopes: [...t.scopes] });
      return Promise.resolve();
    },
    byMcpOAuthRefreshToken(tokenHash) {
      const t = mcpRefreshTokens.get(tokenHash);
      return Promise.resolve(t ? { ...t, scopes: [...t.scopes] } : undefined);
    },
    delMcpOAuthRefreshToken(tokenHash) {
      mcpRefreshTokens.delete(tokenHash);
      return Promise.resolve();
    },
    putGitHubSourceControlInstallState(state) {
      githubSourceControlInstallStates.set(state.state, { ...state });
      return Promise.resolve();
    },
    byGitHubSourceControlInstallState(state) {
      const record = githubSourceControlInstallStates.get(state);
      return Promise.resolve(record ? { ...record } : undefined);
    },
    delGitHubSourceControlInstallState(state) {
      githubSourceControlInstallStates.delete(state);
      return Promise.resolve();
    },
    putGitHubSourceControlConnection(connection) {
      githubSourceControlConnections.set(
        connection.connectionId,
        cloneGitHubSourceControlConnection(connection),
      );
      return Promise.resolve();
    },
    byGitHubSourceControlConnection(connectionId) {
      const connection = githubSourceControlConnections.get(connectionId);
      return Promise.resolve(
        connection ? cloneGitHubSourceControlConnection(connection) : undefined,
      );
    },
    putGitHubSourceControlHandoff(handoff) {
      githubSourceControlHandoffs.set(handoff.tokenHash, { ...handoff });
      return Promise.resolve();
    },
    consumeGitHubSourceControlHandoff(input) {
      const handoff = githubSourceControlHandoffs.get(input.tokenHash);
      if (
        !handoff
        || handoff.workspaceId !== input.workspaceId
        || handoff.nodeId !== input.nodeId
        || input.nowMs >= handoff.expiresAt
      ) {
        if (handoff && input.nowMs >= handoff.expiresAt) {
          githubSourceControlHandoffs.delete(input.tokenHash);
        }
        return Promise.resolve(undefined);
      }
      githubSourceControlHandoffs.delete(input.tokenHash);
      return Promise.resolve({ ...handoff });
    },
    putAccountWorkspace(workspace) {
      accountWorkspaces.set(workspace.accountId, { ...workspace });
      return Promise.resolve();
    },
    byAccountWorkspace(accountId) {
      const workspace = accountWorkspaces.get(accountId);
      return Promise.resolve(workspace ? { ...workspace } : undefined);
    },
    putWorkspaceMembership(membership) {
      workspaceMemberships.set(
        `${membership.accountId}:${membership.workspaceId}`,
        { ...membership },
      );
      return Promise.resolve();
    },
    listWorkspaceMemberships(accountId) {
      const explicit = [...workspaceMemberships.values()]
        .filter((membership) => membership.accountId === accountId)
        .map((membership) => ({ ...membership }));
      if (explicit.length > 0) return Promise.resolve(explicit);
      const workspace = accountWorkspaces.get(accountId);
      return Promise.resolve(
        workspace
          ? [
              {
                accountId,
                workspaceId:
                  workspace.workspaceId ??
                  `workspace_${workspace.workspaceSlug.replace(/-/g, '_')}`,
                workspaceSlug: workspace.workspaceSlug,
                workspaceHost: workspace.workspaceHost,
                status: 'active' as const,
                createdAt: workspace.updatedAt,
                updatedAt: workspace.updatedAt,
              },
            ]
          : [],
      );
    },
    putAuthoritySession(session) {
      authoritySessions.set(session.tokenHash, { ...session });
      return Promise.resolve();
    },
    byAuthoritySession(tokenHash) {
      const session = authoritySessions.get(tokenHash);
      return Promise.resolve(session ? { ...session } : undefined);
    },
    delAuthoritySession(tokenHash) {
      authoritySessions.delete(tokenHash);
      return Promise.resolve();
    },
    putWorkspaceLoginHandoff(handoff) {
      workspaceLoginHandoffs.set(handoff.tokenHash, { ...handoff });
      return Promise.resolve();
    },
    consumeWorkspaceLoginHandoff(input) {
      const handoff = workspaceLoginHandoffs.get(input.tokenHash);
      if (
        !handoff ||
        handoff.workspaceHost !== input.audienceHost.trim().toLowerCase() ||
        input.nowMs >= handoff.expiresAt
      ) {
        return Promise.resolve(undefined);
      }
      workspaceLoginHandoffs.delete(input.tokenHash);
      return Promise.resolve({ ...handoff });
    },
    putWorkspaceBrowserSession(session) {
      workspaceBrowserSessions.set(session.tokenHash, { ...session });
      return Promise.resolve();
    },
    byWorkspaceBrowserSession(tokenHash) {
      const session = workspaceBrowserSessions.get(tokenHash);
      return Promise.resolve(session ? { ...session } : undefined);
    },
    delWorkspaceBrowserSession(tokenHash) {
      workspaceBrowserSessions.delete(tokenHash);
      return Promise.resolve();
    },
    putWorkspaceNode(node) {
      const boundAccountId = workspaceNodeAccounts.get(node.nodeId);
      if (boundAccountId && boundAccountId !== node.accountId) {
        return Promise.reject(
          new Error('workspace node ID is already bound to another account'),
        );
      }
      workspaceNodeAccounts.set(node.nodeId, node.accountId);
      workspaceNodes.set(
        `${node.accountId}:${node.nodeId}`,
        cloneWorkspaceNode(node),
      );
      return Promise.resolve();
    },
    delWorkspaceNode(accountId, nodeId) {
      const boundAccountId = workspaceNodeAccounts.get(nodeId);
      if (boundAccountId && boundAccountId !== accountId) {
        return Promise.reject(
          new Error('workspace node ID is bound to another account'),
        );
      }
      workspaceNodes.delete(`${accountId}:${nodeId}`);
      if (boundAccountId === accountId) workspaceNodeAccounts.delete(nodeId);
      return Promise.resolve();
    },
    delWorkspaceNodeIfMatch(input) {
      const key = `${input.accountId}:${input.nodeId}`;
      const node = workspaceNodes.get(key);
      if (
        !node ||
        node.updatedAt !== input.updatedAt ||
        node.devicePublicKeyThumbprint !== input.devicePublicKeyThumbprint
      )
        return Promise.resolve(false);
      workspaceNodes.delete(key);
      if (workspaceNodeAccounts.get(input.nodeId) === input.accountId) {
        workspaceNodeAccounts.delete(input.nodeId);
      }
      return Promise.resolve(true);
    },

    byWorkspaceNode(accountId, nodeId) {
      const node = workspaceNodes.get(`${accountId}:${nodeId}`);
      return Promise.resolve(node ? cloneWorkspaceNode(node) : undefined);
    },
    byWorkspaceNodeId(nodeId) {
      const boundAccountId = workspaceNodeAccounts.get(nodeId);
      const node = boundAccountId
        ? workspaceNodes.get(`${boundAccountId}:${nodeId}`)
        : undefined;
      return Promise.resolve(node ? cloneWorkspaceNode(node) : undefined);
    },
    listWorkspaceNodes(accountId) {
      return Promise.resolve(
        [...workspaceNodes.values()]
          .filter((node) => node.accountId === accountId)
          .map(cloneWorkspaceNode),
      );
    },
    listWorkspaceNodesByHost(workspaceHost) {
      return Promise.resolve(
        [...workspaceNodes.values()]
          .filter((node) => node.workspaceHost === workspaceHost)
          .map(cloneWorkspaceNode),
      );
    },
    claimWorkspaceNodeNonce(nodeId, nonce, expiresAt, nowMs) {
      const key = `${nodeId}:${nonce}`;
      const existing = workspaceNodeNonces.get(key);
      if (existing && existing > nowMs) return Promise.resolve(false);
      for (const [storedKey, storedExpiry] of workspaceNodeNonces) {
        if (storedExpiry <= nowMs) workspaceNodeNonces.delete(storedKey);
      }
      const nodePrefix = `${nodeId}:`;
      const activeClaims = [...workspaceNodeNonces.keys()].filter((storedKey) =>
        storedKey.startsWith(nodePrefix),
      ).length;
      if (activeClaims >= WORKSPACE_NODE_NONCE_LIMIT) {
        return Promise.resolve(false);
      }
      workspaceNodeNonces.set(key, expiresAt);
      return Promise.resolve(true);
    },
    putNodeBootstrapCredential(credential) {
      nodeBootstrapCredentials.set(credential.tokenHash, { ...credential });
      return Promise.resolve();
    },
    byNodeBootstrapCredential(tokenHash) {
      const credential = nodeBootstrapCredentials.get(tokenHash);
      return Promise.resolve(credential ? { ...credential } : undefined);
    },
    delNodeBootstrapCredential(tokenHash) {
      nodeBootstrapCredentials.delete(tokenHash);
      return Promise.resolve();
    },
    putWorkspaceAgentStatus(status) {
      workspaceAgentStatuses.set(
        status.workspaceHost,
        cloneWorkspaceAgentStatus(status),
      );
      return Promise.resolve();
    },
    byWorkspaceAgentStatus(workspaceHost) {
      const status = workspaceAgentStatuses.get(workspaceHost);
      return Promise.resolve(
        status ? cloneWorkspaceAgentStatus(status) : undefined,
      );
    },
  };
}
