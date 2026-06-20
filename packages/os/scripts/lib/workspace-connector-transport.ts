import path from 'node:path';

export type WorkspaceConnectorTransport = 'cloudflare-tunnel' | 'websocket-relay';

export type WorkspaceConnectorTransportPlan = {
  connectorId: string;
  workspaceHost: string;
  transport: WorkspaceConnectorTransport;
  localServiceUrl: string;
  tokenPath?: string;
  launchd?: {
    label: string;
    programArguments: string[];
    keepAlive: boolean;
    runAtLoad: boolean;
    standardOutPath: string;
    standardErrorPath: string;
  };
  relay?: {
    url: string;
    protocol: 'websocket';
    enabled: boolean;
  };
};

export type WorkspaceConnectorTransportInput = {
  home: string;
  connectorId: string;
  workspaceHost: string;
  localPort: number;
  transport: WorkspaceConnectorTransport;
  cloudflareTunnelToken?: string;
  cloudflaredBin?: string;
  relayUrl?: string;
};

const normalizeLaunchdLabelSegment = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const requireLocalPort = (localPort: number): void => {
  if (!Number.isInteger(localPort) || localPort <= 0 || localPort > 65535) {
    throw new Error('connector local port must be a valid TCP port');
  }
};

export function planWorkspaceConnectorTransport(
  input: WorkspaceConnectorTransportInput,
): WorkspaceConnectorTransportPlan {
  requireLocalPort(input.localPort);

  const localServiceUrl = `http://127.0.0.1:${input.localPort}`;

  if (input.transport === 'websocket-relay') {
    if (!input.relayUrl) {
      throw new Error('WebSocket relay URL is required when relay transport is selected');
    }

    return {
      connectorId: input.connectorId,
      workspaceHost: input.workspaceHost,
      transport: 'websocket-relay',
      localServiceUrl,
      relay: {
        url: input.relayUrl,
        protocol: 'websocket',
        enabled: false,
      },
    };
  }

  const cloudflareTunnelToken = input.cloudflareTunnelToken?.trim();

  if (!cloudflareTunnelToken) {
    throw new Error('Cloudflare Tunnel token is required for workspace connector transport');
  }

  const generatedDir = path.join(input.home, 'security', 'generated');
  const logDir = path.join(input.home, 'logs');
  const tokenPath = path.join(generatedDir, 'cloudflared-tunnel.token');
  const cloudflaredBin = input.cloudflaredBin ?? path.join(input.home, 'bin', 'cloudflared');
  const label = `com.consuelo.os.cloudflared.${normalizeLaunchdLabelSegment(
    input.connectorId,
  )}`;

  return {
    connectorId: input.connectorId,
    workspaceHost: input.workspaceHost,
    transport: 'cloudflare-tunnel',
    localServiceUrl,
    tokenPath,
    launchd: {
      label,
      programArguments: [
        cloudflaredBin,
        'tunnel',
        'run',
        '--token-file',
        tokenPath,
        '--url',
        localServiceUrl,
      ],
      keepAlive: true,
      runAtLoad: true,
      standardOutPath: path.join(logDir, 'cloudflared.out.log'),
      standardErrorPath: path.join(logDir, 'cloudflared.err.log'),
    },
  };
}
