export type WorkspaceCloudflareProvisioningInput = {
  workspaceId: string;
  workspaceSlug: string;
  baseDomain: string;
  cloudflareZoneId: string;
  connectorId: string;
  dialerUpstreamUrl?: string;
  edgeHostname?: string;
  localServiceUrl?: string;
  managedOsMcpIngressPolicy?: WorkspaceCloudflareManagedOsMcpIngressPolicyConfig;
};

export type CloudflareRulesetRulePosition =
  | { before: string }
  | { after: string }
  | { index: number };

export type CloudflareRulesetRule = {
  id?: string;
  ref: string;
  description: string;
  expression: string;
  action: 'skip' | 'block';
  enabled: boolean;
  action_parameters?: Record<string, unknown>;
};

export type CloudflareRuleset = {
  id: string;
  phase: 'http_request_firewall_custom';
  rules: CloudflareRulesetRule[];
};

export type WorkspaceCloudflareManagedOsMcpIngressPolicyConfig = {
  zoneId: string;
  customRulesetId?: string;
  baseDomain: string;
  mcpAllowedIpsListName: string;
  temporaryDenyIpCidrs?: string[];
  reservedHostnames?: string[];
  allowInstallBootstrapRuleId?: string;
  allowInstallBootstrapRuleRef?: string;
  allowInstallBootstrapRuleDescription?: string;
};

export type WorkspaceCloudflareManagedOsMcpIngressPolicyResult = {
  zoneId: string;
  rulesetId: string;
  allowedIpsListName: string;
  allowRule: {
    id: string;
    ref: string;
    status: 'created' | 'updated' | 'unchanged';
  };
  blockRule: {
    id: string;
    ref: string;
    status: 'created' | 'updated' | 'unchanged';
  };
};

export type WorkspaceCloudflareManagedOsMcpIngressPolicyClient = {
  getAccountIpList: (input: {
    name: string;
  }) => Promise<{ id: string; name: string } | null>;
  getZoneCustomRuleset: (input: {
    zoneId: string;
    rulesetId?: string;
    phase: 'http_request_firewall_custom';
  }) => Promise<CloudflareRuleset | null>;
  createZoneCustomRuleset: (input: {
    zoneId: string;
    name: string;
    description: string;
    phase: 'http_request_firewall_custom';
    rules: CloudflareRulesetRule[];
  }) => Promise<CloudflareRuleset>;
  createZoneCustomRulesetRule: (input: {
    zoneId: string;
    rulesetId: string;
    rule: CloudflareRulesetRule;
    position?: CloudflareRulesetRulePosition;
  }) => Promise<CloudflareRulesetRule>;
  updateZoneCustomRulesetRule: (input: {
    zoneId: string;
    rulesetId: string;
    ruleId: string;
    rule?: CloudflareRulesetRule;
    position?: CloudflareRulesetRulePosition;
  }) => Promise<CloudflareRulesetRule>;
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
} & Partial<WorkspaceCloudflareManagedOsMcpIngressPolicyClient>;

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
    edgeHostname: string;
    localServiceUrl: string;
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
const CLOUDFLARE_CUSTOM_RULESET_PHASE = 'http_request_firewall_custom' as const;
const MANAGED_OS_MCP_ALLOW_RULE_REF = 'consuelo-os-mcp-provider-allow';
const MANAGED_OS_MCP_BLOCK_RULE_REF = 'consuelo-os-mcp-untrusted-block';
const DEFAULT_RESERVED_HOSTNAME_LABELS = [
  'app',
  'docs',
  'diffs',
  'install',
  'linear',
  'api',
  'www',
  'sites',
  'os',
  'internal',
  'workspace-edge',
  'workspace',
] as const;

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

const normalizeCloudflareListName = (listName: string): string => {
  const normalized = listName.trim().replace(/^\$/, '');

  if (!/^[a-z][a-z0-9_]*$/.test(normalized)) {
    throw new Error('Cloudflare IP list name must be a safe account-list identifier');
  }

  return normalized;
};

const normalizeIpCidrLiteral = (value: string): string => {
  const normalized = value.trim();

  if (!/^[0-9a-fA-F:.]+\/\d{1,3}$/.test(normalized)) {
    throw new Error('temporary deny CIDR must be an IPv4 or IPv6 CIDR literal');
  }

  return normalized;
};

const normalizeOptionalValue = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const createDefaultReservedHostnames = (baseDomain: string): string[] =>
  DEFAULT_RESERVED_HOSTNAME_LABELS.map((label) => `${label}.${baseDomain}`);

const normalizeReservedHostnames = (input: {
  baseDomain: string;
  reservedHostnames?: string[];
}): string[] => {
  const values = input.reservedHostnames ?? createDefaultReservedHostnames(input.baseDomain);
  return [...new Set(values.map(normalizeBaseDomain))].sort();
};

const formatHostnameSet = (hostnames: string[]): string =>
  hostnames.map((hostname) => `  "${hostname}"`).join('\n');

const formatIpSet = (cidrs: string[], indent: string): string =>
  cidrs.map((cidr) => `${indent}${cidr}`).join('\n');

const createManagedOsMcpBaseExpression = (input: {
  baseDomain: string;
  reservedHostnames: string[];
}): string =>
  [
    `ends_with(http.host, ".${input.baseDomain}")`,
    `not ends_with(http.host, ".os-origin.${input.baseDomain}")`,
    `not (http.host in {\n${formatHostnameSet(input.reservedHostnames)}\n})`,
    'starts_with(http.request.uri.path, "/mcp")',
  ].join('\nand ');

const createRuleSummary = (
  rule: CloudflareRulesetRule,
  status: 'created' | 'updated' | 'unchanged',
): { id: string; ref: string; status: 'created' | 'updated' | 'unchanged' } => {
  if (!rule.id) {
    throw new Error(`Cloudflare rule ${rule.ref} did not return an id`);
  }

  return { id: rule.id, ref: rule.ref, status };
};

const rulesEqual = (
  left: CloudflareRulesetRule,
  right: CloudflareRulesetRule,
): boolean =>
  left.ref === right.ref &&
  left.description === right.description &&
  left.expression === right.expression &&
  left.action === right.action &&
  left.enabled === right.enabled &&
  JSON.stringify(left.action_parameters ?? null) ===
    JSON.stringify(right.action_parameters ?? null);

const findManagedRule = (
  rules: CloudflareRulesetRule[],
  rule: CloudflareRulesetRule,
): CloudflareRulesetRule | undefined =>
  rules.find((candidate) => candidate.ref === rule.ref) ??
  rules.find((candidate) => candidate.description === rule.description);

const findRulePositionAnchor = (input: {
  rules: CloudflareRulesetRule[];
  config: WorkspaceCloudflareManagedOsMcpIngressPolicyConfig;
}): CloudflareRulesetRule | undefined => {
  const { rules, config } = input;
  if (config.allowInstallBootstrapRuleId) {
    const rule = rules.find((candidate) => candidate.id === config.allowInstallBootstrapRuleId);
    if (!rule) throw new Error('Cloudflare install bootstrap rule id was not found');
    return rule;
  }
  if (config.allowInstallBootstrapRuleRef) {
    const rule = rules.find((candidate) => candidate.ref === config.allowInstallBootstrapRuleRef);
    if (!rule) throw new Error('Cloudflare install bootstrap rule ref was not found');
    return rule;
  }
  if (config.allowInstallBootstrapRuleDescription) {
    const rule = rules.find(
      (candidate) => candidate.description === config.allowInstallBootstrapRuleDescription,
    );
    if (!rule) throw new Error('Cloudflare install bootstrap rule description was not found');
    return rule;
  }

  return undefined;
};

const isPositionedAfter = (input: {
  rules: CloudflareRulesetRule[];
  ruleId: string;
  anchorId: string;
}): boolean => {
  const anchorIndex = input.rules.findIndex((rule) => rule.id === input.anchorId);
  const ruleIndex = input.rules.findIndex((rule) => rule.id === input.ruleId);
  return anchorIndex >= 0 && ruleIndex === anchorIndex + 1;
};

const assertManagedOsMcpIngressPolicyClient = (
  client: WorkspaceCloudflareProvisioningClient,
): asserts client is WorkspaceCloudflareProvisioningClient &
  WorkspaceCloudflareManagedOsMcpIngressPolicyClient => {
  const requiredMethods: Array<keyof WorkspaceCloudflareManagedOsMcpIngressPolicyClient> = [
    'getAccountIpList',
    'getZoneCustomRuleset',
    'createZoneCustomRuleset',
    'createZoneCustomRulesetRule',
    'updateZoneCustomRulesetRule',
  ];
  const missingMethods = requiredMethods.filter(
    (method) => typeof client[method] !== 'function',
  );

  if (missingMethods.length > 0) {
    throw new Error(
      `Cloudflare provisioning client is missing managed OS MCP ingress methods: ${missingMethods.join(', ')}`,
    );
  }
};

const DNS_LABEL_ERROR =
  'must be DNS-label safe: 1-63 chars, no leading/trailing hyphen, [a-z0-9-] only';

export const buildManagedOsMcpIngressPolicyRules = (
  input: WorkspaceCloudflareManagedOsMcpIngressPolicyConfig,
): { allowRule: CloudflareRulesetRule; blockRule: CloudflareRulesetRule } => {
  const baseDomain = normalizeBaseDomain(input.baseDomain);
  const mcpAllowedIpsListName = normalizeCloudflareListName(input.mcpAllowedIpsListName);
  const temporaryDenyIpCidrs = [
    ...new Set((input.temporaryDenyIpCidrs ?? []).map(normalizeIpCidrLiteral)),
  ];
  const reservedHostnames = normalizeReservedHostnames({
    baseDomain,
    reservedHostnames: input.reservedHostnames,
  });
  const baseExpression = createManagedOsMcpBaseExpression({
    baseDomain,
    reservedHostnames,
  });
  const allowedIpsExpression = `ip.src in $${mcpAllowedIpsListName}`;
  const allowTemporaryDenyExpression = temporaryDenyIpCidrs.length
    ? `\nand not (ip.src in {\n${formatIpSet(temporaryDenyIpCidrs, '  ')}\n})`
    : '';
  const blockIpsExpression = temporaryDenyIpCidrs.length
    ? `(\n  not (${allowedIpsExpression})\n  or ip.src in {\n${formatIpSet(temporaryDenyIpCidrs, '    ')}\n  }\n)`
    : `not (${allowedIpsExpression})`;

  return {
    allowRule: {
      ref: MANAGED_OS_MCP_ALLOW_RULE_REF,
      description: 'Allow/skip trusted OS MCP provider traffic',
      action: 'skip',
      action_parameters: { ruleset: 'current' },
      enabled: true,
      expression: `${baseExpression}\nand (${allowedIpsExpression})${allowTemporaryDenyExpression}`,
    },
    blockRule: {
      ref: MANAGED_OS_MCP_BLOCK_RULE_REF,
      description: 'Block untrusted OS MCP traffic',
      action: 'block',
      enabled: true,
      expression: `${baseExpression}\nand ${blockIpsExpression}`,
    },
  };
};

export const createManagedOsMcpIngressPolicyConfigFromEnv = (input: {
  env: Record<string, string | undefined>;
  baseDomain: string;
}): WorkspaceCloudflareManagedOsMcpIngressPolicyConfig => {
  const zoneId = normalizeOptionalValue(input.env.CLOUDFLARE_ZONE_ID);
  const mcpAllowedIpsListName = normalizeOptionalValue(
    input.env.CLOUDFLARE_MCP_ALLOWED_IPS_LIST_NAME,
  );

  if (!zoneId) throw new Error('CLOUDFLARE_ZONE_ID is required');
  if (!mcpAllowedIpsListName) {
    throw new Error('CLOUDFLARE_MCP_ALLOWED_IPS_LIST_NAME is required');
  }

  const temporaryDenyIpCidrs = normalizeOptionalValue(
    input.env.CLOUDFLARE_MCP_TEMPORARY_DENY_CIDRS,
  )
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const config: WorkspaceCloudflareManagedOsMcpIngressPolicyConfig = {
    zoneId,
    baseDomain: normalizeBaseDomain(input.baseDomain),
    mcpAllowedIpsListName,
    ...(normalizeOptionalValue(input.env.CLOUDFLARE_CUSTOM_RULESET_ID)
      ? {
          customRulesetId: normalizeOptionalValue(
            input.env.CLOUDFLARE_CUSTOM_RULESET_ID,
          ),
        }
      : {}),
    ...(normalizeOptionalValue(input.env.CLOUDFLARE_ALLOW_INSTALL_BOOTSTRAP_RULE_ID)
      ? {
          allowInstallBootstrapRuleId: normalizeOptionalValue(
            input.env.CLOUDFLARE_ALLOW_INSTALL_BOOTSTRAP_RULE_ID,
          ),
        }
      : {}),
    ...(normalizeOptionalValue(input.env.CLOUDFLARE_ALLOW_INSTALL_BOOTSTRAP_RULE_REF)
      ? {
          allowInstallBootstrapRuleRef: normalizeOptionalValue(
            input.env.CLOUDFLARE_ALLOW_INSTALL_BOOTSTRAP_RULE_REF,
          ),
        }
      : {}),
    ...(normalizeOptionalValue(input.env.CLOUDFLARE_ALLOW_INSTALL_BOOTSTRAP_RULE_DESCRIPTION)
      ? {
          allowInstallBootstrapRuleDescription: normalizeOptionalValue(
            input.env.CLOUDFLARE_ALLOW_INSTALL_BOOTSTRAP_RULE_DESCRIPTION,
          ),
        }
      : {}),
    ...(temporaryDenyIpCidrs?.length ? { temporaryDenyIpCidrs } : {}),
  };

  buildManagedOsMcpIngressPolicyRules(config);

  return config;
};

const ensureCloudflareRulesetRule = async (input: {
  cloudflare: WorkspaceCloudflareManagedOsMcpIngressPolicyClient;
  zoneId: string;
  rulesetId: string;
  rules: CloudflareRulesetRule[];
  desiredRule: CloudflareRulesetRule;
  position?: CloudflareRulesetRulePosition;
}): Promise<{
  rule: CloudflareRulesetRule;
  status: 'created' | 'updated' | 'unchanged';
}> => {
  try {
    const existing = findManagedRule(input.rules, input.desiredRule);
    if (!existing) {
      const rule = await input.cloudflare.createZoneCustomRulesetRule({
        zoneId: input.zoneId,
        rulesetId: input.rulesetId,
        rule: input.desiredRule,
        ...(input.position ? { position: input.position } : {}),
      });
      return { rule, status: 'created' };
    }

    const shouldMove =
      input.position &&
      'after' in input.position &&
      existing.id &&
      !isPositionedAfter({
        rules: input.rules,
        ruleId: existing.id,
        anchorId: input.position.after,
      });
    if (rulesEqual(existing, input.desiredRule) && !shouldMove) {
      return { rule: existing, status: 'unchanged' };
    }
    if (!existing.id) {
      throw new Error(`Cloudflare rule ${existing.ref} is missing an id`);
    }

    const rule = await input.cloudflare.updateZoneCustomRulesetRule({
      zoneId: input.zoneId,
      rulesetId: input.rulesetId,
      ruleId: existing.id,
      rule: input.desiredRule,
      ...(input.position ? { position: input.position } : {}),
    });
    return { rule, status: 'updated' };
  } catch (error: unknown) {
    throw new Error(
      `Cloudflare managed OS MCP rule ${input.desiredRule.ref} provisioning failed`,
      { cause: error },
    );
  }
};

export const ensureManagedOsMcpIngressPolicy = async (input: {
  cloudflare: WorkspaceCloudflareProvisioningClient;
  config: WorkspaceCloudflareManagedOsMcpIngressPolicyConfig;
}): Promise<WorkspaceCloudflareManagedOsMcpIngressPolicyResult> => {
  try {
    assertManagedOsMcpIngressPolicyClient(input.cloudflare);
    const zoneId = input.config.zoneId.trim();
    const allowedIpsListName = normalizeCloudflareListName(
      input.config.mcpAllowedIpsListName,
    );
    const accountList = await input.cloudflare.getAccountIpList({
      name: allowedIpsListName,
    });

    if (!accountList) {
      throw new Error(`Cloudflare account IP list ${allowedIpsListName} was not found`);
    }

    const desiredRules = buildManagedOsMcpIngressPolicyRules({
      ...input.config,
      mcpAllowedIpsListName: allowedIpsListName,
    });
    const existingRuleset = await input.cloudflare.getZoneCustomRuleset({
      zoneId,
      rulesetId: input.config.customRulesetId,
      phase: CLOUDFLARE_CUSTOM_RULESET_PHASE,
    });

    if (!existingRuleset) {
      const createdRuleset = await input.cloudflare.createZoneCustomRuleset({
        zoneId,
        name: 'Consuelo OS MCP ingress policy',
        description: 'Managed Consuelo OS MCP provider-source filtering policy',
        phase: CLOUDFLARE_CUSTOM_RULESET_PHASE,
        rules: [desiredRules.allowRule, desiredRules.blockRule],
      });
      const allowRule = findManagedRule(createdRuleset.rules, desiredRules.allowRule);
      const blockRule = findManagedRule(createdRuleset.rules, desiredRules.blockRule);
      if (!allowRule || !blockRule) {
        throw new Error('Cloudflare custom ruleset creation did not return managed OS MCP rules');
      }

      return {
        zoneId,
        rulesetId: createdRuleset.id,
        allowedIpsListName,
        allowRule: createRuleSummary(allowRule, 'created'),
        blockRule: createRuleSummary(blockRule, 'created'),
      };
    }

    const positionAnchor = findRulePositionAnchor({
      rules: existingRuleset.rules,
      config: input.config,
    });
    const allowPosition = positionAnchor?.id ? { after: positionAnchor.id } : undefined;
    const allowResult = await ensureCloudflareRulesetRule({
      cloudflare: input.cloudflare,
      zoneId,
      rulesetId: existingRuleset.id,
      rules: existingRuleset.rules,
      desiredRule: desiredRules.allowRule,
      ...(allowPosition ? { position: allowPosition } : {}),
    });
    const blockPosition = allowResult.rule.id
      ? { after: allowResult.rule.id }
      : undefined;
    const blockResult = await ensureCloudflareRulesetRule({
      cloudflare: input.cloudflare,
      zoneId,
      rulesetId: existingRuleset.id,
      rules: existingRuleset.rules,
      desiredRule: desiredRules.blockRule,
      ...(blockPosition ? { position: blockPosition } : {}),
    });

    return {
      zoneId,
      rulesetId: existingRuleset.id,
      allowedIpsListName,
      allowRule: createRuleSummary(allowResult.rule, allowResult.status),
      blockRule: createRuleSummary(blockResult.rule, blockResult.status),
    };
  } catch (error: unknown) {
    throw new Error('Cloudflare managed OS MCP ingress policy provisioning failed', {
      cause: error,
    });
  }
};

const isDnsLabelSafe = (label: string): boolean =>
  label.length >= 1 &&
  label.length <= 63 &&
  /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(label);

const normalizeWorkspaceSlug = (workspaceSlug: string): string => {
  const normalized = workspaceSlug.trim().toLowerCase();

  if (!isDnsLabelSafe(normalized)) {
    throw new Error(`workspace slug ${DNS_LABEL_ERROR}`);
  }

  return normalized;
};

const normalizeConnectorLabel = (connectorId: string): string => {
  const normalized = connectorId.trim().toLowerCase().replace(/_/g, '-');

  if (!isDnsLabelSafe(normalized)) {
    throw new Error(`connector id ${DNS_LABEL_ERROR}`);
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
  const edgeHostname = normalizeBaseDomain(
    input.edgeHostname ?? 'workspace-edge.consuelohq.com',
  );
  const localServiceUrl = input.localServiceUrl ?? 'http://localhost:3000';
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
      edgeHostname,
      localServiceUrl,
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
    if (input.input.managedOsMcpIngressPolicy) {
      await ensureManagedOsMcpIngressPolicy({
        cloudflare: input.cloudflare,
        config: input.input.managedOsMcpIngressPolicy,
      });
    }
    const tunnel = await input.cloudflare.createOrReuseTunnel({
      name: plan.cloudflare.tunnelName,
      connectorId: input.input.connectorId,
    });

    await input.cloudflare.putTunnelConfig({
      tunnelId: tunnel.tunnelId,
      hostname: plan.osTunnelHostname,
      localServiceUrl: plan.cloudflare.localServiceUrl,
    });

    await input.cloudflare.createOrReuseDnsRecord({
      zoneId: plan.cloudflare.zoneId,
      name: plan.cloudflare.workspaceDnsRecord.name,
      type: 'CNAME',
      content: plan.cloudflare.edgeHostname,
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
