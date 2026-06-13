export type WorkspaceEdgeBetaSmokeStep = {
  id: string;
  kind: 'local' | 'edge' | 'dialer' | 'os-connector';
  method: 'GET' | 'POST';
  url: string;
  expectedStatus: number;
  signedLocal?: boolean;
  signedEdge?: boolean;
};

export type WorkspaceEdgeBetaSmokePlan = {
  workspaceHost: string;
  connectorId: string;
  steps: WorkspaceEdgeBetaSmokeStep[];
  redactions: string[];
};

export type WorkspaceEdgeBetaSmokePlanInput = {
  workspaceHost: string;
  connectorId: string;
  localPort: number;
  dialerPath?: string;
  osPath?: string;
};

const pathWithLeadingSlash = (value: string): string =>
  value.startsWith('/') ? value : `/${value}`;

const localUrl = (localPort: number, routePath: string): string =>
  `http://127.0.0.1:${localPort}${pathWithLeadingSlash(routePath)}`;

const edgeUrl = (workspaceHost: string, routePath: string): string =>
  `https://${workspaceHost}${pathWithLeadingSlash(routePath)}`;

export function createWorkspaceEdgeBetaSmokePlan(
  input: WorkspaceEdgeBetaSmokePlanInput,
): WorkspaceEdgeBetaSmokePlan {
  const dialerPath = input.dialerPath ?? '/dialer/health';
  const osPath = input.osPath ?? '/health';

  return {
    workspaceHost: input.workspaceHost,
    connectorId: input.connectorId,
    steps: [
      {
        id: 'local-health-is-public',
        kind: 'local',
        method: 'GET',
        url: localUrl(input.localPort, '/health'),
        expectedStatus: 200,
      },
      {
        id: 'local-protected-route-requires-signature',
        kind: 'local',
        method: 'GET',
        url: localUrl(input.localPort, '/get_steering'),
        expectedStatus: 401,
        signedLocal: false,
      },
      {
        id: 'local-signed-get-steering-succeeds',
        kind: 'local',
        method: 'GET',
        url: localUrl(input.localPort, '/get_steering'),
        expectedStatus: 200,
        signedLocal: true,
      },
      {
        id: 'local-replayed-signature-is-denied',
        kind: 'local',
        method: 'GET',
        url: localUrl(input.localPort, '/get_steering'),
        expectedStatus: 401,
        signedLocal: true,
      },
      {
        id: 'edge-unknown-workspace-fails-closed',
        kind: 'edge',
        method: 'GET',
        url: 'https://unknown-workspace.consuelohq.com/health',
        expectedStatus: 404,
        signedEdge: false,
      },
      {
        id: 'edge-revoked-workspace-fails-closed',
        kind: 'edge',
        method: 'GET',
        url: edgeUrl(input.workspaceHost, '/__revoked_probe'),
        expectedStatus: 404,
        signedEdge: false,
      },
      {
        id: 'edge-dialer-route-reaches-railway-through-signed-internal-headers',
        kind: 'dialer',
        method: 'GET',
        url: edgeUrl(input.workspaceHost, dialerPath),
        expectedStatus: 200,
        signedEdge: true,
      },
      {
        id: 'edge-os-route-reaches-installed-os-through-outbound-connector',
        kind: 'os-connector',
        method: 'GET',
        url: edgeUrl(input.workspaceHost, osPath),
        expectedStatus: 200,
        signedEdge: true,
      },
    ],
    redactions: [
      'generated auth material',
      'connector bootstrap material',
      'edge signer material',
    ],
  };
}
