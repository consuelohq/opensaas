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

export type WorkspaceGatewayRouteInput = {
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

export type WorkspaceGatewayRouteResolution =
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

export type CloudflareWorkspaceGatewayWebhookInput = {
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

export type CloudflareWorkspaceGatewayWebhookResult =
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

export type WorkspaceHostnameSurface =
  | 'os'
  | 'dialer'
  | 'twenty'
  | 'sites'
  | 'app';

export type WorkspaceHostnameRouteTarget =
  | {
      kind: 'os-connector';
      connectorId: string;
      connectorStatus: 'connected' | 'disconnected';
    }
  | {
      kind: 'service-upstream';
      service: 'dialer' | 'twenty' | 'sites' | 'app';
      upstreamUrl: string;
    };

export type WorkspaceHostnameRoute = {
  surface: WorkspaceHostnameSurface;
  pathPrefix: string;
  auth: 'required';
  status: 'active' | 'disabled';
  target: WorkspaceHostnameRouteTarget;
};

export type WorkspaceHostnameRegistryRecord = {
  workspaceId: string;
  workspaceSlug: string;
  hostname: string;
  baseDomain: string;
  provider: 'cloudflare';
  routeMode: 'workspace-subdomain';
  owner: 'consuelo-os-cloud';
  routes: WorkspaceHostnameRoute[];
};

export type WorkspaceHostnameRegistryInput = {
  workspaceId: string;
  workspaceSlug: string;
  baseDomain: string;
  osConnectorId?: string;
  osConnectorStatus?: 'connected' | 'disconnected';
  dialerUpstreamUrl?: string;
  appUpstreamUrl?: string;
};

export type WorkspaceHostnameRegistryRouteInput = {
  host: string;
  path: string;
  records: WorkspaceHostnameRegistryRecord[];
};

export type WorkspaceHostnameRegistryRouteResolution =
  | {
      allowed: true;
      workspaceId: string;
      hostname: string;
      route: string;
      surface: WorkspaceHostnameSurface;
      target: WorkspaceHostnameRouteTarget;
      auth: 'required';
      auditEvent: 'workspace.hostname.route.allowed';
    }
  | {
      allowed: false;
      status: 404 | 503;
      errorCode: string;
      auditEvent: 'workspace.hostname.route.denied';
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

export const createWorkspaceHostnameRegistryRecord = (
  input: WorkspaceHostnameRegistryInput,
): WorkspaceHostnameRegistryRecord => {
  const hostname = normalizeHostname(input.workspaceSlug, input.baseDomain);
  const routes: WorkspaceHostnameRoute[] = [];

  if (input.osConnectorId) {
    routes.push(
      ...PUBLIC_WORKSPACE_ROUTES.map((pathPrefix) => ({
        surface: 'os' as const,
        pathPrefix,
        auth: 'required' as const,
        status: 'active' as const,
        target: {
          kind: 'os-connector' as const,
          connectorId: input.osConnectorId,
          connectorStatus: input.osConnectorStatus ?? 'disconnected',
        },
      })),
    );
  }

  if (input.dialerUpstreamUrl) {
    routes.push({
      surface: 'dialer',
      pathPrefix: '/dialer',
      auth: 'required',
      status: 'active',
      target: {
        kind: 'service-upstream',
        service: 'dialer',
        upstreamUrl: input.dialerUpstreamUrl,
      },
    });
  }

  if (input.appUpstreamUrl) {
    routes.push({
      surface: 'app',
      pathPrefix: '/app',
      auth: 'required',
      status: 'active',
      target: {
        kind: 'service-upstream',
        service: 'app',
        upstreamUrl: input.appUpstreamUrl,
      },
    });
  }

  return {
    workspaceId: input.workspaceId,
    workspaceSlug: input.workspaceSlug.trim().toLowerCase(),
    hostname,
    baseDomain: input.baseDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, ''),
    provider: 'cloudflare',
    routeMode: 'workspace-subdomain',
    owner: 'consuelo-os-cloud',
    routes,
  };
};

export const resolveWorkspaceHostnameRegistryRoute = (
  input: WorkspaceHostnameRegistryRouteInput,
): WorkspaceHostnameRegistryRouteResolution => {
  const record = input.records.find(
    (candidate) => candidate.hostname === input.host,
  );

  if (!record) {
    return {
      allowed: false,
      status: 404,
      errorCode: 'WORKSPACE_HOSTNAME_NOT_FOUND',
      auditEvent: 'workspace.hostname.route.denied',
    };
  }

  const route = [...record.routes]
    .filter((candidate) => candidate.status === 'active')
    .sort((left, right) => right.pathPrefix.length - left.pathPrefix.length)
    .find(
      (candidate) =>
        input.path === candidate.pathPrefix ||
        input.path.startsWith(`${candidate.pathPrefix}/`),
    );

  if (!route) {
    return {
      allowed: false,
      status: 404,
      errorCode: 'WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND',
      auditEvent: 'workspace.hostname.route.denied',
    };
  }

  if (
    route.target.kind === 'os-connector' &&
    route.target.connectorStatus !== 'connected'
  ) {
    return {
      allowed: false,
      status: 503,
      errorCode: 'WORKSPACE_HOSTNAME_OS_CONNECTOR_OFFLINE',
      auditEvent: 'workspace.hostname.route.denied',
    };
  }

  return {
    allowed: true,
    workspaceId: record.workspaceId,
    hostname: record.hostname,
    route: route.pathPrefix,
    surface: route.surface,
    target: route.target,
    auth: route.auth,
    auditEvent: 'workspace.hostname.route.allowed',
  };
};
