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
  ref?: string;
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

export type TrustedOsMcpProviderIpSourceId =
  | 'openai_chatgpt_connectors'
  | 'openai_codex_cloud'
  | 'anthropic_claude';

export type CloudflareAccountIpListItemInput = {
  ip: string;
  comment?: string;
};

export type TrustedProviderIpAllowlistSyncResult =
  | {
      status: 'skipped';
      reason: 'trusted provider IP allowlist env not configured';
    }
  | {
      status: 'synced';
      count: number;
      operationId?: string;
    };

export type WorkspaceCloudflareManagedOsMcpIngressPolicyConfig = {
  zoneId: string;
  customRulesetId?: string;
  baseDomain: string;
  mcpAllowedIpsListName: string;
  temporaryDenyIpCidrs?: string[];
  trustedProviderIpSourceIds?: TrustedOsMcpProviderIpSourceId[];
  trustedProviderExtraIpCidrs?: string[];
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
  createAccountIpListItems: (input: {
    listId: string;
    items: CloudflareAccountIpListItemInput[];
  }) => Promise<{ operationId?: string }>;
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

export type CloudflareManagedOsMcpIngressPolicyClientInput = {
  accountId: string;
  apiToken: string;
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
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
const MANAGED_OS_MCP_SKIP_PHASES = [
  'http_ratelimit',
  'http_request_firewall_managed',
  'http_request_sbfm',
] as const;
const MANAGED_OS_MCP_POLICY_ENV_KEYS = [
  'CLOUDFLARE_MCP_ALLOWED_IPS_LIST_NAME',
  'CLOUDFLARE_CUSTOM_RULESET_ID',
  'CLOUDFLARE_ALLOW_INSTALL_BOOTSTRAP_RULE_ID',
  'CLOUDFLARE_ALLOW_INSTALL_BOOTSTRAP_RULE_REF',
  'CLOUDFLARE_ALLOW_INSTALL_BOOTSTRAP_RULE_DESCRIPTION',
  'CLOUDFLARE_MCP_TEMPORARY_DENY_CIDRS',
  'CLOUDFLARE_MCP_TRUSTED_PROVIDER_IP_SOURCES',
  'CLOUDFLARE_MCP_TRUSTED_PROVIDER_EXTRA_CIDRS',
] as const;
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

type TrustedProviderIpRange = {
  cidr: string;
  sourceId: TrustedOsMcpProviderIpSourceId | 'manual_extra';
};

type TrustedProviderIpSource =
  | {
      kind: 'openai-json';
      id: TrustedOsMcpProviderIpSourceId;
      url: string;
    }
  | {
      kind: 'static';
      id: TrustedOsMcpProviderIpSourceId;
      cidrs: string[];
    };

const TRUSTED_OS_MCP_PROVIDER_IP_SOURCES: Record<
  TrustedOsMcpProviderIpSourceId,
  TrustedProviderIpSource
> = {
  openai_chatgpt_connectors: {
    kind: 'openai-json',
    id: 'openai_chatgpt_connectors',
    url: 'https://openai.com/chatgpt-connectors.json',
  },
  openai_codex_cloud: {
    kind: 'openai-json',
    id: 'openai_codex_cloud',
    url: 'https://openai.com/chatgpt-agents.json',
  },
  anthropic_claude: {
    kind: 'static',
    id: 'anthropic_claude',
    cidrs: ['160.79.104.0/21'],
  },
};

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
    throw new Error('CIDR must be an IPv4 or IPv6 CIDR literal');
  }

  return normalized;
};

const splitCommaSeparatedValues = (value: string | undefined): string[] =>
  normalizeOptionalValue(value)
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) ?? [];

const normalizeTrustedProviderIpSourceId = (
  value: string,
): TrustedOsMcpProviderIpSourceId => {
  const normalized = value.trim();

  if (normalized in TRUSTED_OS_MCP_PROVIDER_IP_SOURCES) {
    return normalized as TrustedOsMcpProviderIpSourceId;
  }

  throw new Error(`unknown trusted OS MCP provider IP source: ${normalized}`);
};

const normalizeProviderIpSourceIds = (
  value: string | undefined,
): TrustedOsMcpProviderIpSourceId[] => [
  ...new Set(splitCommaSeparatedValues(value).map(normalizeTrustedProviderIpSourceId)),
];

const normalizeIpCidrs = (values: string[]): string[] => [
  ...new Set(values.map(normalizeIpCidrLiteral)),
];

const normalizeOptionalValue = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (
  input: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = input[key];
  return typeof value === 'string' ? value : undefined;
};

const readBoolean = (
  input: Record<string, unknown>,
  key: string,
): boolean | undefined => {
  const value = input[key];
  return typeof value === 'boolean' ? value : undefined;
};

const readActionParameters = (
  input: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  const value = input.action_parameters;
  return isRecord(value) ? value : undefined;
};

const parseOpenAiIpFeed = (input: {
  payload: unknown;
  sourceId: TrustedOsMcpProviderIpSourceId;
}): TrustedProviderIpRange[] => {
  if (!isRecord(input.payload) || !Array.isArray(input.payload.prefixes)) {
    throw new Error(`trusted provider IP feed ${input.sourceId} returned invalid JSON`);
  }

  return input.payload.prefixes.flatMap((prefix): TrustedProviderIpRange[] => {
    if (!isRecord(prefix)) return [];
    const cidrs = [
      readString(prefix, 'ipv4Prefix'),
      readString(prefix, 'ipv6Prefix'),
    ].filter((cidr): cidr is string => Boolean(cidr));

    return cidrs.map((cidr) => ({
      cidr: normalizeIpCidrLiteral(cidr),
      sourceId: input.sourceId,
    }));
  });
};

const fetchTrustedProviderIpSource = async (input: {
  source: TrustedProviderIpSource;
  fetchImpl: typeof fetch;
}): Promise<TrustedProviderIpRange[]> => {
  if (input.source.kind === 'static') {
    return normalizeIpCidrs(input.source.cidrs).map((cidr) => ({
      cidr,
      sourceId: input.source.id,
    }));
  }

  try {
    const response = await input.fetchImpl(input.source.url);
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }

    const payload = await response.json();
    return parseOpenAiIpFeed({ payload, sourceId: input.source.id });
  } catch (error: unknown) {
    throw new Error(
      `trusted provider IP source ${input.source.id} fetch failed: ${getErrorMessage(error)}`,
      { cause: error },
    );
  }
};

const resolveTrustedOsMcpProviderIpRangeDetails = async (input: {
  sourceIds?: TrustedOsMcpProviderIpSourceId[];
  extraCidrs?: string[];
  fetchImpl?: typeof fetch;
}): Promise<TrustedProviderIpRange[]> => {
  try {
    const fetchImpl = input.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new Error('trusted provider IP source fetch implementation is required');
    }

    const sourceRanges = await Promise.all(
      (input.sourceIds ?? []).map((sourceId) =>
        fetchTrustedProviderIpSource({
          source: TRUSTED_OS_MCP_PROVIDER_IP_SOURCES[sourceId],
          fetchImpl,
        }),
      ),
    );
    const extraRanges = normalizeIpCidrs(input.extraCidrs ?? []).map((cidr) => ({
      cidr,
      sourceId: 'manual_extra' as const,
    }));
    const ranges: TrustedProviderIpRange[] = [...sourceRanges.flat(), ...extraRanges];
    const seenCidrs = new Set<string>();

    return ranges.filter((range) => {
      if (seenCidrs.has(range.cidr)) return false;
      seenCidrs.add(range.cidr);
      return true;
    });
  } catch (error: unknown) {
    throw new Error(
      `trusted OS MCP provider IP range resolution failed: ${getErrorMessage(error)}`,
      { cause: error },
    );
  }
};

export const resolveTrustedOsMcpProviderIpRanges = async (input: {
  sourceIds?: TrustedOsMcpProviderIpSourceId[];
  extraCidrs?: string[];
  fetchImpl?: typeof fetch;
}): Promise<string[]> => {
  try {
    const ranges = await resolveTrustedOsMcpProviderIpRangeDetails(input);
    return ranges.map((range) => range.cidr);
  } catch (error: unknown) {
    throw new Error(
      `trusted OS MCP provider IP range list resolution failed: ${getErrorMessage(error)}`,
      { cause: error },
    );
  }
};

const parseCloudflareRule = (value: unknown): CloudflareRulesetRule | null => {
  if (!isRecord(value)) return null;
  const ref = readString(value, 'ref');
  const description = readString(value, 'description');
  const expression = readString(value, 'expression');
  const action = readString(value, 'action');
  const enabled = readBoolean(value, 'enabled') ?? true;

  if (
    !description ||
    !expression ||
    (action !== 'skip' && action !== 'block')
  ) {
    return null;
  }

  return {
    ...(readString(value, 'id') ? { id: readString(value, 'id') } : {}),
    ...(ref ? { ref } : {}),
    description,
    expression,
    action,
    enabled,
    ...(readActionParameters(value)
      ? { action_parameters: readActionParameters(value) }
      : {}),
  };
};

const parseCloudflareRuleset = (value: unknown): CloudflareRuleset | null => {
  if (!isRecord(value)) return null;
  const id = readString(value, 'id');
  const phase = readString(value, 'phase');
  const rulesValue = value.rules;

  if (
    !id ||
    phase !== CLOUDFLARE_CUSTOM_RULESET_PHASE ||
    !Array.isArray(rulesValue)
  ) {
    return null;
  }

  return {
    id,
    phase,
    rules: rulesValue
      .map(parseCloudflareRule)
      .filter((rule): rule is CloudflareRulesetRule => rule !== null),
  };
};

const extractRuleFromCloudflareResult = (input: {
  result: unknown;
  desiredRule?: CloudflareRulesetRule;
  ruleId?: string;
}): CloudflareRulesetRule => {
  const directRule = parseCloudflareRule(input.result);
  if (directRule) return directRule;

  const ruleset = parseCloudflareRuleset(input.result);
  const rule = ruleset?.rules.find(
    (candidate) =>
      candidate.id === input.ruleId ||
      candidate.ref === input.desiredRule?.ref ||
      candidate.description === input.desiredRule?.description,
  );

  if (!rule) {
    throw new Error('Cloudflare API response did not include the expected rule');
  }

  return rule;
};

const getCloudflareApiErrorMessage = (payload: unknown): string | undefined => {
  if (!isRecord(payload) || !Array.isArray(payload.errors)) return undefined;
  return payload.errors
    .map((error) => (isRecord(error) ? readString(error, 'message') : undefined))
    .filter((message): message is string => Boolean(message))
    .join('; ');
};

const normalizeCloudflareApiBaseUrl = (value: string | undefined): string =>
  (value ?? 'https://api.cloudflare.com/client/v4').replace(/\/$/, '');

const encodeCloudflarePathSegment = (value: string): string =>
  encodeURIComponent(value);

const hasManagedOsMcpIngressPolicyEnv = (
  env: Record<string, string | undefined>,
): boolean =>
  MANAGED_OS_MCP_POLICY_ENV_KEYS.some((key) =>
    Boolean(normalizeOptionalValue(env[key])),
  );

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
  fallbackRef?: string,
): { id: string; ref: string; status: 'created' | 'updated' | 'unchanged' } => {
  if (!rule.id) {
    throw new Error(`Cloudflare rule ${rule.ref ?? rule.description} did not return an id`);
  }
  const ref = rule.ref ?? fallbackRef;
  if (!ref) {
    throw new Error(`Cloudflare rule ${rule.id} did not return a ref`);
  }

  return { id: rule.id, ref, status };
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
  client: Partial<WorkspaceCloudflareManagedOsMcpIngressPolicyClient>,
): asserts client is
  WorkspaceCloudflareManagedOsMcpIngressPolicyClient => {
  const requiredMethods: Array<keyof WorkspaceCloudflareManagedOsMcpIngressPolicyClient> = [
    'getAccountIpList',
    'createAccountIpListItems',
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

const createTrustedProviderIpListItems = (
  ranges: TrustedProviderIpRange[],
): CloudflareAccountIpListItemInput[] =>
  ranges.map((range) => ({
    ip: range.cidr,
    comment: `Consuelo OS MCP trusted provider: ${range.sourceId}`,
  }));

export const syncManagedOsMcpTrustedProviderIpAllowlist = async (input: {
  cloudflare:
    | WorkspaceCloudflareProvisioningClient
    | WorkspaceCloudflareManagedOsMcpIngressPolicyClient;
  config: WorkspaceCloudflareManagedOsMcpIngressPolicyConfig;
  fetchImpl?: typeof fetch;
}): Promise<TrustedProviderIpAllowlistSyncResult> => {
  try {
    const sourceIds = input.config.trustedProviderIpSourceIds ?? [];
    const extraCidrs = input.config.trustedProviderExtraIpCidrs ?? [];

    if (sourceIds.length === 0 && extraCidrs.length === 0) {
      return {
        status: 'skipped',
        reason: 'trusted provider IP allowlist env not configured',
      };
    }

    assertManagedOsMcpIngressPolicyClient(input.cloudflare);
    const allowedIpsListName = normalizeCloudflareListName(
      input.config.mcpAllowedIpsListName,
    );
    const accountList = await input.cloudflare.getAccountIpList({
      name: allowedIpsListName,
    });

    if (!accountList) {
      throw new Error(`Cloudflare account IP list ${allowedIpsListName} was not found`);
    }

    const ranges = await resolveTrustedOsMcpProviderIpRangeDetails({
      sourceIds,
      extraCidrs,
      fetchImpl: input.fetchImpl,
    });
    const result = await input.cloudflare.createAccountIpListItems({
      listId: accountList.id,
      items: createTrustedProviderIpListItems(ranges),
    });

    return {
      status: 'synced',
      count: ranges.length,
      ...(result.operationId ? { operationId: result.operationId } : {}),
    };
  } catch (error: unknown) {
    throw new Error(
      `Cloudflare managed OS MCP trusted provider IP allowlist sync failed: ${getErrorMessage(error)}`,
      { cause: error },
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
      action_parameters: {
        ruleset: 'current',
        phases: [...MANAGED_OS_MCP_SKIP_PHASES],
      },
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

  const temporaryDenyIpCidrs = splitCommaSeparatedValues(
    input.env.CLOUDFLARE_MCP_TEMPORARY_DENY_CIDRS,
  );
  const trustedProviderIpSourceIds = normalizeProviderIpSourceIds(
    input.env.CLOUDFLARE_MCP_TRUSTED_PROVIDER_IP_SOURCES,
  );
  const trustedProviderExtraIpCidrs = normalizeIpCidrs(
    splitCommaSeparatedValues(input.env.CLOUDFLARE_MCP_TRUSTED_PROVIDER_EXTRA_CIDRS),
  );
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
    ...(trustedProviderIpSourceIds.length ? { trustedProviderIpSourceIds } : {}),
    ...(trustedProviderExtraIpCidrs.length ? { trustedProviderExtraIpCidrs } : {}),
  };

  buildManagedOsMcpIngressPolicyRules(config);

  return config;
};

export const createOptionalManagedOsMcpIngressPolicyConfigFromEnv = (input: {
  env: Record<string, string | undefined>;
  baseDomain: string;
}): WorkspaceCloudflareManagedOsMcpIngressPolicyConfig | undefined => {
  if (!hasManagedOsMcpIngressPolicyEnv(input.env)) return undefined;

  return createManagedOsMcpIngressPolicyConfigFromEnv(input);
};

const createCloudflareApiRequest = (
  input: CloudflareManagedOsMcpIngressPolicyClientInput,
): ((request: {
  operation: string;
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  body?: unknown;
  allowNotFound?: boolean;
}) => Promise<unknown | null>) => {
  const apiBaseUrl = normalizeCloudflareApiBaseUrl(input.apiBaseUrl);
  const apiToken = normalizeOptionalValue(input.apiToken);
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;

  if (!apiToken) throw new Error('Cloudflare API token is required');
  if (typeof fetchImpl !== 'function') throw new Error('Cloudflare fetch implementation is required');

  return async (request) => {
    const response = await fetchImpl(`${apiBaseUrl}/${request.path}`, {
      method: request.method,
      headers: {
        authorization: `Bearer ${apiToken}`,
        'content-type': 'application/json',
      },
      ...(request.body === undefined
        ? {}
        : { body: JSON.stringify(request.body) }),
    });
    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (request.allowNotFound && response.status === 404) return null;

    const cloudflareMessage = getCloudflareApiErrorMessage(payload);
    if (!response.ok) {
      throw new Error(
        `Cloudflare API ${request.operation} failed with status ${response.status}${cloudflareMessage ? `: ${cloudflareMessage}` : ''}`,
      );
    }
    if (!isRecord(payload)) {
      throw new Error(`Cloudflare API ${request.operation} returned invalid JSON`);
    }
    if (payload.success === false) {
      throw new Error(
        `Cloudflare API ${request.operation} failed${cloudflareMessage ? `: ${cloudflareMessage}` : ''}`,
      );
    }

    return payload.result ?? null;
  };
};

const createCloudflarePath = (...segments: string[]): string =>
  segments.map(encodeCloudflarePathSegment).join('/');

const createCloudflareManagedPolicyClientError = (
  operation: string,
  error: unknown,
): Error =>
  new Error(
    `Cloudflare managed OS MCP policy client ${operation} failed: ${getErrorMessage(error)}`,
    { cause: error },
  );

export const createCloudflareManagedOsMcpIngressPolicyClient = (
  input: CloudflareManagedOsMcpIngressPolicyClientInput,
): WorkspaceCloudflareManagedOsMcpIngressPolicyClient => {
  const accountId = normalizeOptionalValue(input.accountId);
  if (!accountId) throw new Error('Cloudflare account id is required');
  const request = createCloudflareApiRequest(input);

  return {
    async getAccountIpList(input) {
      try {
        const result = await request({
          operation: 'getAccountIpList',
          method: 'GET',
          path: createCloudflarePath('accounts', accountId, 'rules', 'lists'),
        });

        if (!Array.isArray(result)) {
          throw new Error('Cloudflare account lists response was not an array');
        }

        const list = result.find((candidate) => {
          if (!isRecord(candidate)) return false;
          return readString(candidate, 'name') === input.name;
        });
        if (!isRecord(list)) return null;
        const id = readString(list, 'id');
        const name = readString(list, 'name');
        const kind = readString(list, 'kind');

        if (!id || !name) return null;
        if (kind && kind !== 'ip') {
          throw new Error(`Cloudflare account list ${input.name} is not an IP list`);
        }

        return { id, name };
      } catch (error: unknown) {
        throw createCloudflareManagedPolicyClientError('getAccountIpList', error);
      }
    },
    async createAccountIpListItems(input) {
      try {
        const result = await request({
          operation: 'createAccountIpListItems',
          method: 'POST',
          path: createCloudflarePath(
            'accounts',
            accountId,
            'rules',
            'lists',
            input.listId,
            'items',
          ),
          body: input.items,
        });

        if (!isRecord(result)) return {};
        const operationId = readString(result, 'operation_id');

        return operationId ? { operationId } : {};
      } catch (error: unknown) {
        throw createCloudflareManagedPolicyClientError(
          'createAccountIpListItems',
          error,
        );
      }
    },
    async getZoneCustomRuleset(input) {
      try {
        const path = input.rulesetId
          ? createCloudflarePath('zones', input.zoneId, 'rulesets', input.rulesetId)
          : createCloudflarePath(
              'zones',
              input.zoneId,
              'rulesets',
              'phases',
              input.phase,
              'entrypoint',
            );
        const result = await request({
          operation: 'getZoneCustomRuleset',
          method: 'GET',
          path,
          allowNotFound: true,
        });

        if (result === null) return null;
        const ruleset = parseCloudflareRuleset(result);
        if (!ruleset) throw new Error('Cloudflare custom ruleset response was invalid');

        return ruleset;
      } catch (error: unknown) {
        throw createCloudflareManagedPolicyClientError('getZoneCustomRuleset', error);
      }
    },
    async createZoneCustomRuleset(input) {
      try {
        const result = await request({
          operation: 'createZoneCustomRuleset',
          method: 'POST',
          path: createCloudflarePath('zones', input.zoneId, 'rulesets'),
          body: {
            name: input.name,
            description: input.description,
            kind: 'zone',
            phase: input.phase,
            rules: input.rules,
          },
        });
        const ruleset = parseCloudflareRuleset(result);
        if (!ruleset) {
          throw new Error('Cloudflare custom ruleset creation response was invalid');
        }

        return ruleset;
      } catch (error: unknown) {
        throw createCloudflareManagedPolicyClientError('createZoneCustomRuleset', error);
      }
    },
    async createZoneCustomRulesetRule(input) {
      try {
        const result = await request({
          operation: 'createZoneCustomRulesetRule',
          method: 'POST',
          path: createCloudflarePath(
            'zones',
            input.zoneId,
            'rulesets',
            input.rulesetId,
            'rules',
          ),
          body: {
            ...input.rule,
            ...(input.position ? { position: input.position } : {}),
          },
        });

        return extractRuleFromCloudflareResult({
          result,
          desiredRule: input.rule,
        });
      } catch (error: unknown) {
        throw createCloudflareManagedPolicyClientError(
          'createZoneCustomRulesetRule',
          error,
        );
      }
    },
    async updateZoneCustomRulesetRule(input) {
      try {
        const result = await request({
          operation: 'updateZoneCustomRulesetRule',
          method: 'PATCH',
          path: createCloudflarePath(
            'zones',
            input.zoneId,
            'rulesets',
            input.rulesetId,
            'rules',
            input.ruleId,
          ),
          body: {
            ...(input.rule ?? {}),
            ...(input.position ? { position: input.position } : {}),
          },
        });

        return extractRuleFromCloudflareResult({
          result,
          desiredRule: input.rule,
          ruleId: input.ruleId,
        });
      } catch (error: unknown) {
        throw createCloudflareManagedPolicyClientError(
          'updateZoneCustomRulesetRule',
          error,
        );
      }
    },
  };
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
      throw new Error(`Cloudflare rule ${existing.ref ?? existing.description} is missing an id`);
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
  cloudflare:
    | WorkspaceCloudflareProvisioningClient
    | WorkspaceCloudflareManagedOsMcpIngressPolicyClient;
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
        allowRule: createRuleSummary(
          allowRule,
          'created',
          desiredRules.allowRule.ref,
        ),
        blockRule: createRuleSummary(
          blockRule,
          'created',
          desiredRules.blockRule.ref,
        ),
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
      allowRule: createRuleSummary(
        allowResult.rule,
        allowResult.status,
        desiredRules.allowRule.ref,
      ),
      blockRule: createRuleSummary(
        blockResult.rule,
        blockResult.status,
        desiredRules.blockRule.ref,
      ),
    };
  } catch (error: unknown) {
    throw new Error(
      `Cloudflare managed OS MCP ingress policy provisioning failed: ${getErrorMessage(error)}`,
      { cause: error },
    );
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

export const applyWorkspaceCloudflareProvisioningFromEnv = async (input: {
  cloudflare: WorkspaceCloudflareProvisioningClient;
  env: Record<string, string | undefined>;
  input: WorkspaceCloudflareProvisioningInput;
}): Promise<WorkspaceCloudflareProvisioningResult> => {
  const managedOsMcpIngressPolicy =
    input.input.managedOsMcpIngressPolicy ??
    createOptionalManagedOsMcpIngressPolicyConfigFromEnv({
      env: input.env,
      baseDomain: input.input.baseDomain,
    });

  return applyWorkspaceCloudflareProvisioning({
    cloudflare: input.cloudflare,
    input: {
      ...input.input,
      ...(managedOsMcpIngressPolicy ? { managedOsMcpIngressPolicy } : {}),
    },
  });
};
