import type {
  AccountWorkspace,
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
} from './types';
import { cleanCode } from './utils';

const cloneWorkspaceNode = (node: WorkspaceNode): WorkspaceNode => ({
  ...node,
  ...(node.capabilities ? { capabilities: [...node.capabilities] } : {}),
});

export class DurableStore implements Store {
  constructor(private storage: StorageLike) {}
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
      return await this.storage.get<McpOAuthRefreshToken>(
        `mrt:${tokenHash}`,
      );
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
  async putWorkspaceNode(node: WorkspaceNode) {
    try {
      const boundAccountId = await this.storage.get<string>(`wni:${node.nodeId}`);
      if (boundAccountId && boundAccountId !== node.accountId) {
        throw new Error('workspace node ID is already bound to another account');
      }
      const nodeIds =
        (await this.storage.get<string[]>(`wnl:${node.accountId}`)) ?? [];
      await this.storage.put(
        `wn:${node.accountId}:${node.nodeId}`,
        cloneWorkspaceNode(node),
      );
      await this.storage.put(`wni:${node.nodeId}`, node.accountId);
      if (!nodeIds.includes(node.nodeId)) {
        await this.storage.put(`wnl:${node.accountId}`, [...nodeIds, node.nodeId]);
      }
    } catch {
      throw new Error('workspace node write failed');
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
      return accountId ? await this.byWorkspaceNode(accountId, nodeId) : undefined;
    } catch {
      throw new Error('workspace node identity read failed');
    }
  }
  async listWorkspaceNodes(accountId: string) {
    try {
      const nodeIds =
        (await this.storage.get<string[]>(`wnl:${accountId}`)) ?? [];
      const nodes = await Promise.all(
        nodeIds.map((nodeId) => this.byWorkspaceNode(accountId, nodeId)),
      );
      return nodes.filter((node): node is WorkspaceNode => Boolean(node));
    } catch {
      throw new Error('workspace node list failed');
    }
  }
  async claimWorkspaceNodeNonce(
    nodeId: string,
    nonce: string,
    expiresAt: number,
    nowMs: number,
  ) {
    try {
      const key = `wnn:${nodeId}:${nonce}`;
      const existing = await this.storage.get<number>(key);
      if (existing && existing > nowMs) return false;
      await this.storage.put(key, expiresAt);
      return true;
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
      return await this.storage.get<NodeBootstrapCredential>(`nbc:${tokenHash}`);
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
      return await this.storage.get<WorkspaceAgentStatus>(`was:${workspaceHost}`);
    } catch {
      throw new Error('workspace agent status read failed');
    }
  }
}

export function createMemoryDeviceGrantStore(): Store {
  const grants = new Map<string, Grant>();
  const states = new Map<string, OAuthState>();
  const mcpStates = new Map<string, McpOAuthState>();
  const mcpCodes = new Map<string, McpOAuthCode>();
  const mcpTokens = new Map<string, McpOAuthAccessToken>();
  const mcpRefreshTokens = new Map<string, McpOAuthRefreshToken>();
  const accountWorkspaces = new Map<string, AccountWorkspace>();
  const workspaceNodes = new Map<string, WorkspaceNode>();
  const workspaceNodeAccounts = new Map<string, string>();
  const workspaceNodeNonces = new Map<string, number>();
  const nodeBootstrapCredentials = new Map<string, NodeBootstrapCredential>();
  const workspaceAgentStatuses = new Map<string, WorkspaceAgentStatus>();
  const cloneWorkspaceAgentStatus = (status: WorkspaceAgentStatus): WorkspaceAgentStatus => ({
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
    putAccountWorkspace(workspace) {
      accountWorkspaces.set(workspace.accountId, { ...workspace });
      return Promise.resolve();
    },
    byAccountWorkspace(accountId) {
      const workspace = accountWorkspaces.get(accountId);
      return Promise.resolve(workspace ? { ...workspace } : undefined);
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
    claimWorkspaceNodeNonce(nodeId, nonce, expiresAt, nowMs) {
      const key = `${nodeId}:${nonce}`;
      const existing = workspaceNodeNonces.get(key);
      if (existing && existing > nowMs) return Promise.resolve(false);
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
      workspaceAgentStatuses.set(status.workspaceHost, cloneWorkspaceAgentStatus(status));
      return Promise.resolve();
    },
    byWorkspaceAgentStatus(workspaceHost) {
      const status = workspaceAgentStatuses.get(workspaceHost);
      return Promise.resolve(status ? cloneWorkspaceAgentStatus(status) : undefined);
    },
  };
}
