import { createHash } from 'node:crypto';

export type AuthenticatedMcpAuthMode =
  | 'oauth'
  | 'local-bearer'
  | 'machine'
  | 'workspace-edge';

export type AuthenticatedMcpPrincipal = {
  authMode: AuthenticatedMcpAuthMode;
  workspaceId?: string;
  workspaceHost: string;
  subjectId: string;
  clientId?: string;
  callerId?: string;
  appId?: string;
  deviceId?: string;
  connectorId?: string;
  connectionId?: string;
  scopes: string[];
  principalKey: string;
};

export function createAuthenticatedMcpPrincipal(
  input: Omit<AuthenticatedMcpPrincipal, 'principalKey'>,
): AuthenticatedMcpPrincipal {
  const stableIdentity = JSON.stringify([
    input.authMode,
    input.workspaceId ?? '',
    input.workspaceHost,
    input.subjectId,
    input.clientId ?? '',
    input.callerId ?? '',
    input.appId ?? '',
    input.deviceId ?? '',
    input.connectorId ?? '',
    input.connectionId ?? '',
  ]);
  const digest = createHash('sha256').update(stableIdentity).digest('hex');
  return {
    ...input,
    scopes: [...input.scopes],
    principalKey: `prn_${digest.slice(0, 32)}`,
  };
}
