export type WorkspaceGatewayProvisioningInput = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceDisplayName: string;
  baseDomain: string;
  cloudflareZoneId: string;
  osConnectorId: string;
};

export type WorkspaceGatewayProvisioningPlan = {
  workspaceId: string;
  hostname: string;
  provider: 'cloudflare';
  routeMode: 'workspace-subdomain';
  connectorMode: 'outbound-os-connector';
  cloudflare: {
    zoneId: string;
    customHostname: {
      hostname: string;
      ssl: {
        method: 'txt';
        type: 'dv';
        settings: {
          min_tls_version: '1.2';
          tls_1_3: 'on';
          http2: 'on';
        };
      };
    };
  };
  publicRoutes: Array<{
    path: string;
    auth: 'required';
    workspaceId: string;
    connectorId: string;
  }>;
};

type WorkspaceGatewayRouteInput = {
  host: string;
  method: 'GET' | 'POST';
  path: string;
  gateways: Array<{
    workspaceId: string;
    hostname: string;
    connectorId: string;
    connectorStatus: 'connected' | 'disconnected';
    allowedRoutes: string[];
  }>;
};

type WorkspaceGatewayRouteResolution =
  | {
      allowed: true;
      workspaceId: string;
      connectorId: string;
      route: string;
      targetPath: string;
      auth: 'required';
      auditEvent: 'workspace.gateway.route.allowed';
    }
  | {
      allowed: false;
      status: 401 | 404 | 503;
      errorCode: string;
      auditEvent: 'workspace.gateway.route.denied';
    };

type CloudflareWorkspaceGatewayWebhookInput = {
  allowedZoneIds: string[];
  event: {
    data?: {
      data?: {
        hostname?: string;
        ssl?: { status?: string };
        status?: string;
      };
      metadata?: { zone?: { id?: string } };
    };
  };
  gateways: Array<{
    workspaceId: string;
    hostname: string;
    status: 'pending' | 'active' | 'error';
  }>;
};

type CloudflareWorkspaceGatewayWebhookResult =
  | {
      handled: true;
      workspaceId: string;
      hostname: string;
      status: 'active' | 'pending' | 'error';
      certificateStatus: string;
      auditEvent: 'workspace.gateway.cloudflare.updated';
    }
  | {
      handled: false;
      reason: 'unknown-zone' | 'unknown-hostname' | 'missing-hostname';
    };

const PUBLIC_WORKSPACE_ROUTES = [
  '/office',
  '/diffs',
  '/wiki',
  '/traces',
  '/tools',
  '/api',
  '/mcp',
  '/apps/chatgpt',
] as const;

const normalizeHostname = (slug: string, baseDomain: string): string => {
  const normalizedSlug = slug.trim().toLowerCase();
  const normalizedDomain = baseDomain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  if (
    !normalizedSlug ||
    normalizedSlug.includes('.') ||
    /[^a-z0-9-]/.test(normalizedSlug)
  ) {
    throw new Error('workspace slug must be a DNS-safe label');
  }

  if (!normalizedDomain || normalizedDomain.includes('/')) {
    throw new Error('base domain must be a hostname');
  }

  return `${normalizedSlug}.${normalizedDomain}`;
};

const matchAllowedRoute = (
  path: string,
  allowedRoutes: string[],
): string | undefined => {
  return [...allowedRoutes]
    .sort((left, right) => right.length - left.length)
    .find((route) => path === route || path.startsWith(`${route}/`));
};

const normalizeWebhookStatus = (
  value: string | undefined,
): 'active' | 'pending' | 'error' => {
  if (value === 'active') return 'active';
  if (value === 'pending') return 'pending';

  return 'error';
};

export const planWorkspaceGatewayProvisioning = (
  input: WorkspaceGatewayProvisioningInput,
): WorkspaceGatewayProvisioningPlan => {
  const hostname = normalizeHostname(input.workspaceSlug, input.baseDomain);

  return {
    workspaceId: input.workspaceId,
    hostname,
    provider: 'cloudflare',
    routeMode: 'workspace-subdomain',
    connectorMode: 'outbound-os-connector',
    cloudflare: {
      zoneId: input.cloudflareZoneId,
      customHostname: {
        hostname,
        ssl: {
          method: 'txt',
          type: 'dv',
          settings: {
            min_tls_version: '1.2',
            tls_1_3: 'on',
            http2: 'on',
          },
        },
      },
    },
    publicRoutes: PUBLIC_WORKSPACE_ROUTES.map((path) => ({
      path,
      auth: 'required',
      workspaceId: input.workspaceId,
      connectorId: input.osConnectorId,
    })),
  };
};

export const resolveWorkspaceGatewayRoute = (
  input: WorkspaceGatewayRouteInput,
): WorkspaceGatewayRouteResolution => {
  const gateway = input.gateways.find(
    (candidate) => candidate.hostname === input.host,
  );

  if (!gateway) {
    return {
      allowed: false,
      status: 404,
      errorCode: 'WORKSPACE_GATEWAY_NOT_FOUND',
      auditEvent: 'workspace.gateway.route.denied',
    };
  }

  const route = matchAllowedRoute(input.path, gateway.allowedRoutes);

  if (!route) {
    return {
      allowed: false,
      status: 404,
      errorCode: 'WORKSPACE_GATEWAY_ROUTE_NOT_FOUND',
      auditEvent: 'workspace.gateway.route.denied',
    };
  }

  if (gateway.connectorStatus !== 'connected') {
    return {
      allowed: false,
      status: 503,
      errorCode: 'WORKSPACE_GATEWAY_CONNECTOR_OFFLINE',
      auditEvent: 'workspace.gateway.route.denied',
    };
  }

  return {
    allowed: true,
    workspaceId: gateway.workspaceId,
    connectorId: gateway.connectorId,
    route,
    targetPath: input.path,
    auth: 'required',
    auditEvent: 'workspace.gateway.route.allowed',
  };
};

export const applyCloudflareWorkspaceGatewayWebhook = (
  input: CloudflareWorkspaceGatewayWebhookInput,
): CloudflareWorkspaceGatewayWebhookResult => {
  const zoneId = input.event.data?.metadata?.zone?.id;

  if (!zoneId || !input.allowedZoneIds.includes(zoneId)) {
    return { handled: false, reason: 'unknown-zone' };
  }

  const hostname = input.event.data?.data?.hostname;

  if (!hostname) {
    return { handled: false, reason: 'missing-hostname' };
  }

  const gateway = input.gateways.find(
    (candidate) => candidate.hostname === hostname,
  );

  if (!gateway) {
    return { handled: false, reason: 'unknown-hostname' };
  }

  return {
    handled: true,
    workspaceId: gateway.workspaceId,
    hostname,
    status: normalizeWebhookStatus(input.event.data?.data?.status),
    certificateStatus: input.event.data?.data?.ssl?.status ?? 'unknown',
    auditEvent: 'workspace.gateway.cloudflare.updated',
  };
};
