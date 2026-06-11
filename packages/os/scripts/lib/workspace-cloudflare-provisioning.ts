export type WorkspaceCloudflareProvisioningInput = {
  workspaceId: string;
  workspaceSlug: string;
  baseDomain: string;
  cloudflareZoneId: string;
  connectorId: string;
  dialerUpstreamUrl?: string;
};

export type WorkspaceCloudflareProvisioningClient = {
  createOrReuseTunnel: (input: {
    name: string;
    connectorId: string;
  }) => Promise<{
    tunnelId: string;
    tunnelCredential: string;
    connectorCredentialId: string;
  }>;
  putTunnelConfig: (input: {
    tunnelId: string;
    hostname: string;
    localServiceUrl: string;
  }) => Promise<void>;
  createOrReuseDnsRecord: (input: {
    zoneId: string;
    name: string;
    type: 'CNAME';
    content: string;
    proxied: boolean;
  }) => Promise<{ recordId: string }>;
};

export type WorkspaceCloudflareRouteTarget =
  | {
      kind: 'service-upstream';
      service: 'dialer' | 'app' | 'sites' | 'twenty';
      upstreamUrl: string;
    }
  | {
      kind: 'os-connector';
      connectorId: string;
      connectorStatus: 'connected' | 'disconnected';
      tunnelOriginUrl: string;
    };

export type WorkspaceCloudflareProvisioningRoute = {
  surface: 'os' | 'dialer' | 'app' | 'sites' | 'twenty';
  pathPrefix: string;
  auth: 'required';
  target: WorkspaceCloudflareRouteTarget;
};

export type WorkspaceCloudflareProvisioningPlan = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceHostname: string;
  osTunnelHostname: string;
  provider: 'cloudflare';
  owner: 'consuelo-os-cloud';
  cloudflare: {
    zoneId: string;
    tunnelName: string;
    workspaceDnsRecord: { name: string };
    osTunnelDnsRecord: { name: string };
  };
  routes: WorkspaceCloudflareProvisioningRoute[];
};

export type WorkspaceCloudflareRegistryRecord = {
  workspaceId: string;
  workspaceSlug: string;
  hostname: string;
  baseDomain: string;
  provider: 'cloudflare';
  owner: 'consuelo-os-cloud';
  status: 'active';
  routes: Array<WorkspaceCloudflareProvisioningRoute & { status: 'active' }>;
};

export type WorkspaceCloudflareProvisioningResult = {
  workspaceHostname: string;
  osTunnelHostname: string;
  connectorBootstrap: {
    connectorId: string;
    tunnelId: string;
    tunnelCredential: string;
  };
  registryRecord: WorkspaceCloudflareRegistryRecord;
};

const OS_ROUTE_PREFIXES = ['/mcp', '/traces'] as const;

const normalizeBaseDomain = (baseDomain: string): string => {
  const normalized = baseDomain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  if (!normalized || normalized.includes('/')) {
    throw new Error('base domain must be a hostname');
  }

  return normalized;
};

const normalizeWorkspaceSlug = (workspaceSlug: string): string => {
  const normalized = workspaceSlug.trim().toLowerCase();

  if (!normalized || normalized.includes('.') || /[^a-z0-9-]/.test(normalized)) {
    throw new Error('workspace slug must be a DNS-safe label');
  }

  return normalized;
};

const normalizeConnectorLabel = (connectorId: string): string => {
  const normalized = connectorId.trim().toLowerCase().replace(/_/g, '-');

  if (!normalized || normalized.includes('.') || /[^a-z0-9-]/.test(normalized)) {
    throw new Error('connector id must be DNS-label safe after normalization');
  }

  return normalized;
};

const createRegistryRecord = (input: {
  plan: WorkspaceCloudflareProvisioningPlan;
  baseDomain: string;
}): WorkspaceCloudflareRegistryRecord => ({
  workspaceId: input.plan.workspaceId,
  workspaceSlug: input.plan.workspaceSlug,
  hostname: input.plan.workspaceHostname,
  baseDomain: input.baseDomain,
  provider: 'cloudflare',
  owner: 'consuelo-os-cloud',
  status: 'active',
  routes: input.plan.routes.map((route) => ({ ...route, status: 'active' as const })),
});

export const planWorkspaceCloudflareProvisioning = (
  input: WorkspaceCloudflareProvisioningInput,
): WorkspaceCloudflareProvisioningPlan => {
  const workspaceSlug = normalizeWorkspaceSlug(input.workspaceSlug);
  const baseDomain = normalizeBaseDomain(input.baseDomain);
  const connectorLabel = normalizeConnectorLabel(input.connectorId);
  const workspaceHostname = `${workspaceSlug}.${baseDomain}`;
  const osTunnelHostname = `${connectorLabel}.os-origin.${baseDomain}`;
  const osTarget: WorkspaceCloudflareRouteTarget = {
    kind: 'os-connector',
    connectorId: input.connectorId,
    connectorStatus: 'connected',
    tunnelOriginUrl: `https://${osTunnelHostname}`,
  };
  const routes: WorkspaceCloudflareProvisioningRoute[] = OS_ROUTE_PREFIXES.map(
    (pathPrefix) => ({
      surface: 'os',
      pathPrefix,
      auth: 'required',
      target: osTarget,
    }),
  );

  if (input.dialerUpstreamUrl) {
    routes.push({
      surface: 'dialer',
      pathPrefix: '/dialer',
      auth: 'required',
      target: {
        kind: 'service-upstream',
        service: 'dialer',
        upstreamUrl: input.dialerUpstreamUrl,
      },
    });
  }

  return {
    workspaceId: input.workspaceId,
    workspaceSlug,
    workspaceHostname,
    osTunnelHostname,
    provider: 'cloudflare',
    owner: 'consuelo-os-cloud',
    cloudflare: {
      zoneId: input.cloudflareZoneId,
      tunnelName: `workspace-${input.workspaceId}-${connectorLabel}`,
      workspaceDnsRecord: { name: workspaceHostname },
      osTunnelDnsRecord: { name: osTunnelHostname },
    },
    routes,
  };
};

export const applyWorkspaceCloudflareProvisioning = async (input: {
  cloudflare: WorkspaceCloudflareProvisioningClient;
  input: WorkspaceCloudflareProvisioningInput;
}): Promise<WorkspaceCloudflareProvisioningResult> => {
  try {
    const baseDomain = normalizeBaseDomain(input.input.baseDomain);
    const plan = planWorkspaceCloudflareProvisioning(input.input);
    const tunnel = await input.cloudflare.createOrReuseTunnel({
      name: plan.cloudflare.tunnelName,
      connectorId: input.input.connectorId,
    });

    await input.cloudflare.putTunnelConfig({
      tunnelId: tunnel.tunnelId,
      hostname: plan.osTunnelHostname,
      localServiceUrl: 'http://localhost:3000',
    });

    await input.cloudflare.createOrReuseDnsRecord({
      zoneId: plan.cloudflare.zoneId,
      name: plan.cloudflare.workspaceDnsRecord.name,
      type: 'CNAME',
      content: 'workspace-edge.consuelohq.com',
      proxied: true,
    });

    await input.cloudflare.createOrReuseDnsRecord({
      zoneId: plan.cloudflare.zoneId,
      name: plan.cloudflare.osTunnelDnsRecord.name,
      type: 'CNAME',
      content: `${tunnel.tunnelId}.cfargotunnel.com`,
      proxied: true,
    });

    return {
      workspaceHostname: plan.workspaceHostname,
      osTunnelHostname: plan.osTunnelHostname,
      connectorBootstrap: {
        connectorId: input.input.connectorId,
        tunnelId: tunnel.tunnelId,
        tunnelCredential: tunnel.tunnelCredential,
      },
      registryRecord: createRegistryRecord({ plan, baseDomain }),
    };
  } catch (error: unknown) {
    throw new Error('workspace Cloudflare provisioning failed', {
      cause: error,
    });
  }
};
