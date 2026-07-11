import type {
  AccountWorkspace,
  Grant,
  McpOAuthAccessToken,
  McpOAuthCode,
  McpOAuthState,
  OAuthState,
  StorageLike,
  Store,
  WorkspaceNode,
} from './types';
import { cleanCode } from './utils';

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
      await this.storage.put(`wn:${node.accountId}:${node.nodeId}`, node);
    } catch {
      throw new Error('workspace node write failed');
    }
  }
  async byWorkspaceNode(accountId: string, nodeId: string) {
    try {
      return await this.storage.get<WorkspaceNode>(`wn:${accountId}:${nodeId}`);
    } catch {
      throw new Error('workspace node read failed');
    }
  }
}

export function createMemoryDeviceGrantStore(): Store {
  const grants = new Map<string, Grant>();
  const states = new Map<string, OAuthState>();
  const mcpStates = new Map<string, McpOAuthState>();
  const mcpCodes = new Map<string, McpOAuthCode>();
  const mcpTokens = new Map<string, McpOAuthAccessToken>();
  const accountWorkspaces = new Map<string, AccountWorkspace>();
  const workspaceNodes = new Map<string, WorkspaceNode>();
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
    putAccountWorkspace(workspace) {
      accountWorkspaces.set(workspace.accountId, { ...workspace });
      return Promise.resolve();
    },
    byAccountWorkspace(accountId) {
      const workspace = accountWorkspaces.get(accountId);
      return Promise.resolve(workspace ? { ...workspace } : undefined);
    },
    putWorkspaceNode(node) {
      workspaceNodes.set(`${node.accountId}:${node.nodeId}`, { ...node });
      return Promise.resolve();
    },
    byWorkspaceNode(accountId, nodeId) {
      const node = workspaceNodes.get(`${accountId}:${nodeId}`);
      return Promise.resolve(node ? { ...node } : undefined);
    },
  };
}
