import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type WorkspaceCloudflareProvisioningInput = {
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

type CloudflareRulesetRulePosition =
  | { before: string }
  | { after: string }
  | { index: number };

type CloudflareRulesetRule = {
  id?: string;
  ref?: string;
  description: string;
  expression: string;
  action: 'skip' | 'block';
  enabled: boolean;
  action_parameters?: Record<string, unknown>;
};

type CloudflareRuleset = {
  id: string;
  phase: 'http_request_firewall_custom';
  rules: CloudflareRulesetRule[];
};

type TrustedOsMcpProviderIpSourceId =
  | 'openai_chatgpt_connectors'
  | 'openai_codex_cloud'
  | 'anthropic_claude';

type CloudflareAccountIpListItemInput = {
  ip: string;
  comment?: string;
};

type TrustedProviderIpAllowlistSyncResult =
  | {
      status: 'skipped';
      reason: 'trusted provider IP allowlist env not configured';
    }
  | {
      status: 'synced';
      count: number;
      operationId?: string;
    };

type WorkspaceCloudflareManagedOsMcpIngressPolicyConfig = {
  zoneId: string;
  customRulesetId?: string;
  baseDomain: string;
  mcpAllowedIpsListName: string;
  temporaryDenyIpCidrs?: string[];
  trustedProviderIpSourceIds?: TrustedOsMcpProviderIpSourceId[];
  trustedProviderExtraIpCidrs?: string[];
  allowInstallBootstrapRuleId?: string;
  allowInstallBootstrapRuleRef?: string;
  allowInstallBootstrapRuleDescription?: string;
};

type WorkspaceCloudflareManagedOsMcpIngressPolicyResult = {
  zoneId: string;
  rulesetId: string;
  allowedIpsListName: string;
  allowRule: { id: string; ref: string; status: 'created' | 'updated' | 'unchanged' };
  blockRule: { id: string; ref: string; status: 'created' | 'updated' | 'unchanged' };
};

type WorkspaceCloudflareProvisioningClient = {
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
  getAccountIpList?: (input: {
    name: string;
  }) => Promise<{ id: string; name: string } | null>;
  createAccountIpListItems?: (input: {
    listId: string;
    items: CloudflareAccountIpListItemInput[];
  }) => Promise<{ operationId?: string }>;
  getZoneCustomRuleset?: (input: {
    zoneId: string;
    rulesetId?: string;
    phase: 'http_request_firewall_custom';
  }) => Promise<CloudflareRuleset | null>;
  createZoneCustomRuleset?: (input: {
    zoneId: string;
    name: string;
    description: string;
    phase: 'http_request_firewall_custom';
    rules: CloudflareRulesetRule[];
  }) => Promise<CloudflareRuleset>;
  createZoneCustomRulesetRule?: (input: {
    zoneId: string;
    rulesetId: string;
    rule: CloudflareRulesetRule;
    position?: CloudflareRulesetRulePosition;
  }) => Promise<CloudflareRulesetRule>;
  updateZoneCustomRulesetRule?: (input: {
    zoneId: string;
    rulesetId: string;
    ruleId: string;
    rule?: CloudflareRulesetRule;
    position?: CloudflareRulesetRulePosition;
  }) => Promise<CloudflareRulesetRule>;
};

type WorkspaceCloudflareManagedOsMcpIngressPolicyClient = Required<
  Pick<
    WorkspaceCloudflareProvisioningClient,
    | 'getAccountIpList'
    | 'createAccountIpListItems'
    | 'getZoneCustomRuleset'
    | 'createZoneCustomRuleset'
    | 'createZoneCustomRulesetRule'
    | 'updateZoneCustomRulesetRule'
  >
>;

type WorkspaceCloudflareProvisioningPlan = {
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
  routes: Array<{
    surface: 'os' | 'dialer' | 'app' | 'sites' | 'twenty';
    pathPrefix: string;
    auth: 'required';
    target: Record<string, unknown>;
  }>;
};

type WorkspaceCloudflareProvisioningResult = {
  workspaceHostname: string;
  osTunnelHostname: string;
  connectorBootstrap: {
    connectorId: string;
    tunnelId: string;
    tunnelCredential: string;
  };
  registryRecord: Record<string, unknown>;
};

type WorkspaceCloudflareProvisioningContract = {
  planWorkspaceCloudflareProvisioning: (
    input: WorkspaceCloudflareProvisioningInput,
  ) => WorkspaceCloudflareProvisioningPlan;
  applyWorkspaceCloudflareProvisioning: (input: {
    cloudflare: WorkspaceCloudflareProvisioningClient;
    input: WorkspaceCloudflareProvisioningInput;
  }) => Promise<WorkspaceCloudflareProvisioningResult>;
  buildManagedOsMcpIngressPolicyRules: (
    input: WorkspaceCloudflareManagedOsMcpIngressPolicyConfig,
  ) => { allowRule: CloudflareRulesetRule; blockRule: CloudflareRulesetRule };
  createManagedOsMcpIngressPolicyConfigFromEnv: (input: {
    env: Record<string, string | undefined>;
    baseDomain: string;
  }) => WorkspaceCloudflareManagedOsMcpIngressPolicyConfig;
  createOptionalManagedOsMcpIngressPolicyConfigFromEnv: (input: {
    env: Record<string, string | undefined>;
    baseDomain: string;
  }) => WorkspaceCloudflareManagedOsMcpIngressPolicyConfig | undefined;
  applyWorkspaceCloudflareProvisioningFromEnv: (input: {
    cloudflare: WorkspaceCloudflareProvisioningClient;
    env: Record<string, string | undefined>;
    input: WorkspaceCloudflareProvisioningInput;
  }) => Promise<WorkspaceCloudflareProvisioningResult>;
  createCloudflareManagedOsMcpIngressPolicyClient: (input: {
    accountId: string;
    apiToken: string;
    apiBaseUrl?: string;
    fetchImpl?: typeof fetch;
  }) => WorkspaceCloudflareManagedOsMcpIngressPolicyClient;
  resolveTrustedOsMcpProviderIpRanges: (input: {
    sourceIds?: TrustedOsMcpProviderIpSourceId[];
    extraCidrs?: string[];
    fetchImpl?: typeof fetch;
  }) => Promise<string[]>;
  syncManagedOsMcpTrustedProviderIpAllowlist: (input: {
    cloudflare: WorkspaceCloudflareProvisioningClient;
    config: WorkspaceCloudflareManagedOsMcpIngressPolicyConfig;
    fetchImpl?: typeof fetch;
  }) => Promise<TrustedProviderIpAllowlistSyncResult>;
  ensureManagedOsMcpIngressPolicy: (input: {
    cloudflare: WorkspaceCloudflareProvisioningClient;
    config: WorkspaceCloudflareManagedOsMcpIngressPolicyConfig;
  }) => Promise<WorkspaceCloudflareManagedOsMcpIngressPolicyResult>;
};

const runContract =
  process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;

async function loadWorkspaceCloudflareProvisioningContract(): Promise<WorkspaceCloudflareProvisioningContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'workspace-cloudflare-provisioning.ts'),
  ).href;
  const module = (await import(
    modulePath
  )) as Partial<WorkspaceCloudflareProvisioningContract>;
  const requiredExports: Array<keyof WorkspaceCloudflareProvisioningContract> = [
    'planWorkspaceCloudflareProvisioning',
    'applyWorkspaceCloudflareProvisioning',
    'buildManagedOsMcpIngressPolicyRules',
    'createManagedOsMcpIngressPolicyConfigFromEnv',
    'createOptionalManagedOsMcpIngressPolicyConfigFromEnv',
    'applyWorkspaceCloudflareProvisioningFromEnv',
    'createCloudflareManagedOsMcpIngressPolicyClient',
    'resolveTrustedOsMcpProviderIpRanges',
    'syncManagedOsMcpTrustedProviderIpAllowlist',
    'ensureManagedOsMcpIngressPolicy',
  ];
  const missingExports = requiredExports.filter(
    (name) => typeof module[name] !== 'function',
  );

  if (missingExports.length > 0) {
    throw new Error(
      `workspace Cloudflare provisioning contract module is missing exports: ${missingExports.join(', ')}`,
    );
  }

  return module as WorkspaceCloudflareProvisioningContract;
}

type FakePolicyCall = {
  operation: string;
  key: string;
  body?: unknown;
};

const cloneRule = (rule: CloudflareRulesetRule): CloudflareRulesetRule => ({
  ...rule,
  ...(rule.action_parameters
    ? { action_parameters: { ...rule.action_parameters } }
    : {}),
});

const cloneRuleset = (ruleset: CloudflareRuleset): CloudflareRuleset => ({
  ...ruleset,
  rules: ruleset.rules.map(cloneRule),
});

const createFakeCloudflarePolicyClient = (input: {
  ruleset?: CloudflareRuleset;
  accountLists?: Array<{ id: string; name: string }>;
}) => {
  const calls: FakePolicyCall[] = [];
  let nextRuleId = 1;
  let ruleset =
    input.ruleset ??
    ({
      id: 'ruleset_123',
      phase: 'http_request_firewall_custom' as const,
      rules: [],
    } satisfies CloudflareRuleset);
  const accountLists = input.accountLists ?? [
    { id: 'list_mcp_allowed_ips', name: 'mcp_allowed_ips' },
  ];

  const insertRule = (
    rule: CloudflareRulesetRule,
    position?: CloudflareRulesetRulePosition,
  ): CloudflareRulesetRule => {
    const nextRule = {
      ...cloneRule(rule),
      id: rule.id ?? `rule_${nextRuleId++}`,
    };
    const withoutExisting = ruleset.rules.filter(
      (candidate) => candidate.id !== nextRule.id,
    );
    let index = withoutExisting.length;
    if (position && 'after' in position) {
      const anchorIndex = withoutExisting.findIndex(
        (candidate) => candidate.id === position.after,
      );
      index = anchorIndex >= 0 ? anchorIndex + 1 : withoutExisting.length;
    }
    if (position && 'before' in position) {
      const anchorIndex = withoutExisting.findIndex(
        (candidate) => candidate.id === position.before,
      );
      index = anchorIndex >= 0 ? anchorIndex : 0;
    }
    if (position && 'index' in position) {
      index = Math.max(0, position.index - 1);
    }
    withoutExisting.splice(index, 0, nextRule);
    ruleset = { ...ruleset, rules: withoutExisting };
    return cloneRule(nextRule);
  };

  const client: WorkspaceCloudflareProvisioningClient = {
    async createOrReuseTunnel(input) {
      calls.push({ operation: 'createOrReuseTunnel', key: input.name, body: input });
      return {
        tunnelId: 'tunnel_123',
        tunnelCredential: 'credential_fixture',
        connectorCredentialId: 'connector_credential_123',
      };
    },
    async putTunnelConfig(input) {
      calls.push({ operation: 'putTunnelConfig', key: input.tunnelId, body: input });
    },
    async createOrReuseDnsRecord(input) {
      calls.push({ operation: 'createOrReuseDnsRecord', key: input.name, body: input });
      return { recordId: `dns_${input.name}` };
    },
    async getAccountIpList(input) {
      calls.push({ operation: 'getAccountIpList', key: input.name, body: input });
      return accountLists.find((list) => list.name === input.name) ?? null;
    },
    async createAccountIpListItems(input) {
      calls.push({
        operation: 'createAccountIpListItems',
        key: input.listId,
        body: input,
      });
      return { operationId: 'list_items_operation_123' };
    },
    async getZoneCustomRuleset(input) {
      calls.push({ operation: 'getZoneCustomRuleset', key: input.zoneId, body: input });
      if (input.rulesetId && input.rulesetId !== ruleset.id) return null;
      return cloneRuleset(ruleset);
    },
    async createZoneCustomRuleset(input) {
      calls.push({ operation: 'createZoneCustomRuleset', key: input.zoneId, body: input });
      ruleset = {
        id: 'ruleset_created',
        phase: input.phase,
        rules: input.rules.map((rule) => ({
          ...cloneRule(rule),
          id: rule.id ?? `rule_${nextRuleId++}`,
        })),
      };
      return cloneRuleset(ruleset);
    },
    async createZoneCustomRulesetRule(input) {
      calls.push({ operation: 'createZoneCustomRulesetRule', key: input.rule.ref, body: input });
      return insertRule(input.rule, input.position);
    },
    async updateZoneCustomRulesetRule(input) {
      calls.push({ operation: 'updateZoneCustomRulesetRule', key: input.ruleId, body: input });
      const existing = ruleset.rules.find(
        (candidate) => candidate.id === input.ruleId,
      );
      if (!existing) throw new Error(`missing fake Cloudflare rule ${input.ruleId}`);
      return insertRule({ ...(input.rule ? cloneRule(input.rule) : cloneRule(existing)), id: input.ruleId }, input.position);
    },
  };

  return {
    client,
    calls,
    getRuleset: () => cloneRuleset(ruleset),
  };
};

contractDescribe('workspace Cloudflare provisioning contract', () => {
  it('should plan one workspace hostname with hidden OS tunnel origin and Dialer routes', async () => {
    const { planWorkspaceCloudflareProvisioning } =
      await loadWorkspaceCloudflareProvisioningContract();
    const plan = planWorkspaceCloudflareProvisioning({
      workspaceId: 'workspace_123',
      workspaceSlug: 'kokayi',
      baseDomain: 'consuelohq.com',
      cloudflareZoneId: 'zone_123',
      connectorId: 'connector_123',
      dialerUpstreamUrl: 'https://dialer-production.up.railway.app',
    });

    expect(plan).toMatchObject({
      workspaceId: 'workspace_123',
      workspaceSlug: 'kokayi',
      workspaceHostname: 'kokayi.consuelohq.com',
      osTunnelHostname: 'connector-123.os-origin.consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      cloudflare: {
        zoneId: 'zone_123',
      },
    });

    expect(plan.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          surface: 'os',
          pathPrefix: '/mcp',
          auth: 'required',
          target: expect.objectContaining({
            kind: 'os-connector',
            connectorId: 'connector_123',
          }),
        }),
        expect.objectContaining({
          surface: 'os',
          pathPrefix: '/traces',
          auth: 'required',
          target: expect.objectContaining({
            kind: 'os-connector',
            connectorId: 'connector_123',
          }),
        }),
        expect.objectContaining({
          surface: 'dialer',
          pathPrefix: '/dialer',
          auth: 'required',
          target: expect.objectContaining({
            kind: 'service-upstream',
            service: 'dialer',
            upstreamUrl: 'https://dialer-production.up.railway.app',
          }),
        }),
      ]),
    );
  });

  it('should build managed OS MCP ingress rules for the OS hostname class', async () => {
    const { buildManagedOsMcpIngressPolicyRules } =
      await loadWorkspaceCloudflareProvisioningContract();

    const { allowRule, blockRule } = buildManagedOsMcpIngressPolicyRules({
      zoneId: 'zone_123',
      customRulesetId: 'ruleset_123',
      baseDomain: 'consuelohq.com',
      mcpAllowedIpsListName: 'mcp_allowed_ips',
      temporaryDenyIpCidrs: [
        '2603:6080:37f0:6c50::/64',
        '2603:6080:37f0:b460::/64',
      ],
    });

    expect(allowRule).toMatchObject({
      ref: 'consuelo-os-mcp-provider-allow',
      description: 'Allow/skip trusted OS MCP provider traffic',
      action: 'skip',
      enabled: true,
    });
    expect(allowRule.action_parameters).toEqual({
      ruleset: 'current',
      phases: [
        'http_ratelimit',
        'http_request_firewall_managed',
        'http_request_sbfm',
      ],
    });
    expect(blockRule).toMatchObject({
      ref: 'consuelo-os-mcp-untrusted-block',
      description: 'Block untrusted OS MCP traffic',
      action: 'block',
      enabled: true,
    });

    for (const expression of [allowRule.expression, blockRule.expression]) {
      expect(expression).toContain('ends_with(http.host, ".consuelohq.com")');
      expect(expression).toContain(
        'not ends_with(http.host, ".os-origin.consuelohq.com")',
      );
      expect(expression).toContain('starts_with(http.request.uri.path, "/mcp")');
      expect(expression).toContain('"workspace.consuelohq.com"');
      expect(expression).toContain('"workspace-edge.consuelohq.com"');
      expect(expression).not.toContain('kokayi.consuelohq.com');
      expect(expression).not.toContain('openai.consuelohq.com');
    }
    expect(allowRule.expression).toContain('ip.src in $mcp_allowed_ips');
    expect(allowRule.expression).toContain(
      'not (ip.src in {\n  2603:6080:37f0:6c50::/64\n  2603:6080:37f0:b460::/64\n})',
    );
    expect(blockRule.expression).toContain('not (ip.src in $mcp_allowed_ips)');
    expect(blockRule.expression).toContain(
      'ip.src in {\n    2603:6080:37f0:6c50::/64\n    2603:6080:37f0:b460::/64\n  }',
    );
    expect(JSON.stringify({ allowRule, blockRule })).not.toMatch(
      /kokayi\.consuelohq\.com|openai\.consuelohq\.com/,
    );
  });

  it('should read managed OS MCP ingress policy config from Cloudflare env', async () => {
    const { createManagedOsMcpIngressPolicyConfigFromEnv } =
      await loadWorkspaceCloudflareProvisioningContract();

    const config = createManagedOsMcpIngressPolicyConfigFromEnv({
      baseDomain: 'consuelohq.com',
      env: {
        CLOUDFLARE_ZONE_ID: 'zone_123',
        CLOUDFLARE_CUSTOM_RULESET_ID: 'ruleset_123',
        CLOUDFLARE_MCP_ALLOWED_IPS_LIST_NAME: 'mcp_allowed_ips',
        CLOUDFLARE_ALLOW_INSTALL_BOOTSTRAP_RULE_ID: 'rule_bootstrap',
        CLOUDFLARE_MCP_TEMPORARY_DENY_CIDRS:
          '2603:6080:37f0:6c50::/64, 2603:6080:37f0:b460::/64',
        CLOUDFLARE_MCP_TRUSTED_PROVIDER_IP_SOURCES:
          'openai_chatgpt_connectors, anthropic_claude',
        CLOUDFLARE_MCP_TRUSTED_PROVIDER_EXTRA_CIDRS:
          '203.0.113.0/24, 2001:db8:203::/48',
      },
    });

    expect(config).toEqual({
      zoneId: 'zone_123',
      customRulesetId: 'ruleset_123',
      baseDomain: 'consuelohq.com',
      mcpAllowedIpsListName: 'mcp_allowed_ips',
      allowInstallBootstrapRuleId: 'rule_bootstrap',
      temporaryDenyIpCidrs: [
        '2603:6080:37f0:6c50::/64',
        '2603:6080:37f0:b460::/64',
      ],
      trustedProviderIpSourceIds: [
        'openai_chatgpt_connectors',
        'anthropic_claude',
      ],
      trustedProviderExtraIpCidrs: ['203.0.113.0/24', '2001:db8:203::/48'],
    });
    expect(() =>
      createManagedOsMcpIngressPolicyConfigFromEnv({
        baseDomain: 'consuelohq.com',
        env: {},
      }),
    ).toThrow(/CLOUDFLARE_ZONE_ID/);
    expect(() =>
      createManagedOsMcpIngressPolicyConfigFromEnv({
        baseDomain: 'consuelohq.com',
        env: { CLOUDFLARE_ZONE_ID: 'zone_123' },
      }),
    ).toThrow(/CLOUDFLARE_MCP_ALLOWED_IPS_LIST_NAME/);
    expect(() =>
      createManagedOsMcpIngressPolicyConfigFromEnv({
        baseDomain: 'consuelohq.com',
        env: {
          CLOUDFLARE_ZONE_ID: 'zone_123',
          CLOUDFLARE_MCP_ALLOWED_IPS_LIST_NAME: 'mcp_allowed_ips',
          CLOUDFLARE_MCP_TRUSTED_PROVIDER_IP_SOURCES: 'google_gemini',
        },
      }),
    ).toThrow(/unknown trusted OS MCP provider IP source/);
  });

  it('should resolve trusted provider CIDRs from official provider sources and approved extras', async () => {
    const { resolveTrustedOsMcpProviderIpRanges } =
      await loadWorkspaceCloudflareProvisioningContract();
    const fetchCalls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const request = new Request(input);
      fetchCalls.push(request.url);

      if (request.url === 'https://openai.com/chatgpt-connectors.json') {
        return new Response(
          JSON.stringify({
            prefixes: [
              { ipv4Prefix: '20.42.10.0/24' },
              { ipv6Prefix: '2001:db8:42::/48' },
            ],
          }),
        );
      }
      if (request.url === 'https://openai.com/chatgpt-agents.json') {
        return new Response(
          JSON.stringify({ prefixes: [{ ipv4Prefix: '20.99.0.0/16' }] }),
        );
      }

      return new Response(JSON.stringify({ error: 'unexpected provider feed' }), {
        status: 500,
      });
    };

    const cidrs = await resolveTrustedOsMcpProviderIpRanges({
      sourceIds: [
        'openai_chatgpt_connectors',
        'openai_codex_cloud',
        'anthropic_claude',
      ],
      extraCidrs: ['203.0.113.0/24', '20.42.10.0/24'],
      fetchImpl,
    });

    expect(fetchCalls).toEqual([
      'https://openai.com/chatgpt-connectors.json',
      'https://openai.com/chatgpt-agents.json',
    ]);
    expect(cidrs).toEqual([
      '20.42.10.0/24',
      '2001:db8:42::/48',
      '20.99.0.0/16',
      '160.79.104.0/21',
      '203.0.113.0/24',
    ]);
    expect(JSON.stringify(cidrs)).not.toMatch(/127\.0\.0\.1|192\.168\./);
  });

  it('should sync trusted provider CIDRs into the configured Cloudflare account IP list', async () => {
    const { syncManagedOsMcpTrustedProviderIpAllowlist } =
      await loadWorkspaceCloudflareProvisioningContract();
    const fakeCloudflare = createFakeCloudflarePolicyClient({});

    const result = await syncManagedOsMcpTrustedProviderIpAllowlist({
      cloudflare: fakeCloudflare.client,
      config: {
        zoneId: 'zone_123',
        baseDomain: 'consuelohq.com',
        mcpAllowedIpsListName: 'mcp_allowed_ips',
        trustedProviderIpSourceIds: ['anthropic_claude'],
        trustedProviderExtraIpCidrs: ['203.0.113.0/24'],
      },
    });

    expect(result).toEqual({
      status: 'synced',
      count: 2,
      operationId: 'list_items_operation_123',
    });
    expect(fakeCloudflare.calls.map((call) => call.operation)).toEqual([
      'getAccountIpList',
      'createAccountIpListItems',
    ]);
    expect(fakeCloudflare.calls[1]?.body).toEqual({
      listId: 'list_mcp_allowed_ips',
      items: [
        {
          ip: '160.79.104.0/21',
          comment: 'Consuelo OS MCP trusted provider: anthropic_claude',
        },
        {
          ip: '203.0.113.0/24',
          comment: 'Consuelo OS MCP trusted provider: manual_extra',
        },
      ],
    });
  });

  it('should post trusted provider CIDRs through the real Cloudflare account list endpoint', async () => {
    const {
      createCloudflareManagedOsMcpIngressPolicyClient,
      syncManagedOsMcpTrustedProviderIpAllowlist,
    } = await loadWorkspaceCloudflareProvisioningContract();
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = new Request(input, init);
      const parsedUrl = new URL(request.url);
      const body = request.method === 'GET' ? undefined : await request.json();
      calls.push({
        method: request.method,
        path: parsedUrl.pathname,
        ...(body ? { body } : {}),
      });

      if (request.method === 'GET' && parsedUrl.pathname.endsWith('/accounts/account_123/rules/lists')) {
        return new Response(JSON.stringify({
          success: true,
          result: [{ id: 'list_123', name: 'mcp_allowed_ips', kind: 'ip' }],
        }));
      }
      if (request.method === 'POST' && parsedUrl.pathname.endsWith('/accounts/account_123/rules/lists/list_123/items')) {
        return new Response(JSON.stringify({
          success: true,
          result: { operation_id: 'list_items_operation_123' },
        }));
      }

      return new Response(JSON.stringify({
        success: false,
        errors: [{ message: 'unexpected request' }],
      }), { status: 500 });
    };
    const cloudflare = createCloudflareManagedOsMcpIngressPolicyClient({
      accountId: 'account_123',
      apiToken: 'token_fixture',
      fetchImpl,
    });

    const result = await syncManagedOsMcpTrustedProviderIpAllowlist({
      cloudflare,
      config: {
        zoneId: 'zone_123',
        baseDomain: 'consuelohq.com',
        mcpAllowedIpsListName: 'mcp_allowed_ips',
        trustedProviderExtraIpCidrs: ['203.0.113.0/24'],
      },
    });

    expect(result).toEqual({
      status: 'synced',
      count: 1,
      operationId: 'list_items_operation_123',
    });
    expect(calls).toEqual([
      {
        method: 'GET',
        path: '/client/v4/accounts/account_123/rules/lists',
      },
      {
        method: 'POST',
        path: '/client/v4/accounts/account_123/rules/lists/list_123/items',
        body: [
          {
            ip: '203.0.113.0/24',
            comment: 'Consuelo OS MCP trusted provider: manual_extra',
          },
        ],
      },
    ]);
  });

  it('should derive optional managed OS MCP ingress policy only when policy env is present', async () => {
    const { createOptionalManagedOsMcpIngressPolicyConfigFromEnv } =
      await loadWorkspaceCloudflareProvisioningContract();

    expect(
      createOptionalManagedOsMcpIngressPolicyConfigFromEnv({
        baseDomain: 'consuelohq.com',
        env: {},
      }),
    ).toBeUndefined();
    expect(
      createOptionalManagedOsMcpIngressPolicyConfigFromEnv({
        baseDomain: 'consuelohq.com',
        env: {
          CLOUDFLARE_ZONE_ID: 'zone_123',
          CLOUDFLARE_MCP_ALLOWED_IPS_LIST_NAME: 'mcp_allowed_ips',
        },
      }),
    ).toMatchObject({
      zoneId: 'zone_123',
      baseDomain: 'consuelohq.com',
      mcpAllowedIpsListName: 'mcp_allowed_ips',
    });
    expect(() =>
      createOptionalManagedOsMcpIngressPolicyConfigFromEnv({
        baseDomain: 'consuelohq.com',
        env: {
          CLOUDFLARE_MCP_ALLOWED_IPS_LIST_NAME: 'mcp_allowed_ips',
        },
      }),
    ).toThrow(/CLOUDFLARE_ZONE_ID/);
    expect(() =>
      createOptionalManagedOsMcpIngressPolicyConfigFromEnv({
        baseDomain: 'consuelohq.com',
        env: {
          CLOUDFLARE_ZONE_ID: 'zone_123',
          CLOUDFLARE_MCP_TEMPORARY_DENY_CIDRS: '2603:6080:37f0:6c50::/64',
        },
      }),
    ).toThrow(/CLOUDFLARE_MCP_ALLOWED_IPS_LIST_NAME/);
  });

  it('should provision managed OS MCP ingress rules idempotently', async () => {
    const { ensureManagedOsMcpIngressPolicy } =
      await loadWorkspaceCloudflareProvisioningContract();
    const fakeCloudflare = createFakeCloudflarePolicyClient({
      ruleset: {
        id: 'ruleset_123',
        phase: 'http_request_firewall_custom',
        rules: [
          {
            id: 'rule_bootstrap',
            ref: 'allow-install-curl-bootstrap',
            description: 'Allow install curl bootstrap',
            action: 'skip',
            action_parameters: { ruleset: 'current' },
            expression: 'starts_with(http.request.uri.path, "/install")',
            enabled: true,
          },
        ],
      },
    });
    const config: WorkspaceCloudflareManagedOsMcpIngressPolicyConfig = {
      zoneId: 'zone_123',
      customRulesetId: 'ruleset_123',
      baseDomain: 'consuelohq.com',
      mcpAllowedIpsListName: 'mcp_allowed_ips',
      allowInstallBootstrapRuleRef: 'allow-install-curl-bootstrap',
      temporaryDenyIpCidrs: ['2603:6080:37f0:6c50::/64'],
    };

    const first = await ensureManagedOsMcpIngressPolicy({
      cloudflare: fakeCloudflare.client,
      config,
    });
    const second = await ensureManagedOsMcpIngressPolicy({
      cloudflare: fakeCloudflare.client,
      config,
    });

    expect(first.allowRule.status).toBe('created');
    expect(first.blockRule.status).toBe('created');
    expect(second.allowRule.status).toBe('unchanged');
    expect(second.blockRule.status).toBe('unchanged');
    expect(
      fakeCloudflare.calls.filter(
        (call) => call.operation === 'createZoneCustomRulesetRule',
      ),
    ).toHaveLength(2);
    expect(
      fakeCloudflare.calls.filter(
        (call) => call.operation === 'updateZoneCustomRulesetRule',
      ),
    ).toHaveLength(0);

    const rules = fakeCloudflare.getRuleset().rules;
    expect(
      rules.filter(
        (rule) => rule.description === 'Allow/skip trusted OS MCP provider traffic',
      ),
    ).toHaveLength(1);
    expect(
      rules.filter((rule) => rule.description === 'Block untrusted OS MCP traffic'),
    ).toHaveLength(1);
    expect(rules.map((rule) => rule.ref)).toEqual([
      'allow-install-curl-bootstrap',
      'consuelo-os-mcp-provider-allow',
      'consuelo-os-mcp-untrusted-block',
    ]);
  });

  it('should update and reorder existing managed OS MCP ingress rules when dashboard payload drifts', async () => {
    const { buildManagedOsMcpIngressPolicyRules, ensureManagedOsMcpIngressPolicy } =
      await loadWorkspaceCloudflareProvisioningContract();
    const desired = buildManagedOsMcpIngressPolicyRules({
      zoneId: 'zone_123',
      customRulesetId: 'ruleset_123',
      baseDomain: 'consuelohq.com',
      mcpAllowedIpsListName: 'mcp_allowed_ips',
    });
    const fakeCloudflare = createFakeCloudflarePolicyClient({
      ruleset: {
        id: 'ruleset_123',
        phase: 'http_request_firewall_custom',
        rules: [
          {
            id: 'rule_bootstrap',
            ref: 'allow-install-curl-bootstrap',
            description: 'Allow install curl bootstrap',
            action: 'skip',
            action_parameters: { ruleset: 'current' },
            expression: 'starts_with(http.request.uri.path, "/install")',
            enabled: true,
          },
          {
            ...desired.blockRule,
            id: 'rule_block',
          },
          {
            ...desired.allowRule,
            id: 'rule_allow',
            action_parameters: { ruleset: 'current' },
          },
        ],
      },
    });

    const result = await ensureManagedOsMcpIngressPolicy({
      cloudflare: fakeCloudflare.client,
      config: {
        zoneId: 'zone_123',
        customRulesetId: 'ruleset_123',
        baseDomain: 'consuelohq.com',
        mcpAllowedIpsListName: 'mcp_allowed_ips',
        allowInstallBootstrapRuleRef: 'allow-install-curl-bootstrap',
      },
    });

    expect(result.allowRule.status).toBe('updated');
    expect(result.blockRule.status).toBe('updated');
    expect(
      fakeCloudflare.calls.filter(
        (call) => call.operation === 'updateZoneCustomRulesetRule',
      ),
    ).toHaveLength(2);
    expect(fakeCloudflare.getRuleset().rules.map((rule) => rule.ref)).toEqual([
      'allow-install-curl-bootstrap',
      'consuelo-os-mcp-provider-allow',
      'consuelo-os-mcp-untrusted-block',
    ]);
    expect(fakeCloudflare.getRuleset().rules[1]?.action_parameters).toEqual({
      ruleset: 'current',
      phases: [
        'http_ratelimit',
        'http_request_firewall_managed',
        'http_request_sbfm',
      ],
    });
  });

  it('should fail closed when the configured Cloudflare account IP list is missing', async () => {
    const { ensureManagedOsMcpIngressPolicy } =
      await loadWorkspaceCloudflareProvisioningContract();
    const fakeCloudflare = createFakeCloudflarePolicyClient({ accountLists: [] });

    await expect(
      ensureManagedOsMcpIngressPolicy({
        cloudflare: fakeCloudflare.client,
        config: {
          zoneId: 'zone_123',
          customRulesetId: 'ruleset_123',
          baseDomain: 'consuelohq.com',
          mcpAllowedIpsListName: 'mcp_allowed_ips',
        },
      }),
    ).rejects.toThrow(/Cloudflare account IP list mcp_allowed_ips was not found/);
    expect(
      fakeCloudflare.calls.some((call) =>
        ['createZoneCustomRuleset', 'createZoneCustomRulesetRule'].includes(
          call.operation,
        ),
      ),
    ).toBe(false);
  });

  it('should ensure managed OS MCP ingress policy during workspace provisioning', async () => {
    const { applyWorkspaceCloudflareProvisioning } =
      await loadWorkspaceCloudflareProvisioningContract();
    const fakeCloudflare = createFakeCloudflarePolicyClient({
      ruleset: {
        id: 'ruleset_123',
        phase: 'http_request_firewall_custom',
        rules: [
          {
            id: 'rule_bootstrap',
            ref: 'allow-install-curl-bootstrap',
            description: 'Allow install curl bootstrap',
            action: 'skip',
            action_parameters: { ruleset: 'current' },
            expression: 'starts_with(http.request.uri.path, "/install")',
            enabled: true,
          },
        ],
      },
    });

    await applyWorkspaceCloudflareProvisioning({
      cloudflare: fakeCloudflare.client,
      input: {
        workspaceId: 'workspace_123',
        workspaceSlug: 'kokayi',
        baseDomain: 'consuelohq.com',
        cloudflareZoneId: 'zone_123',
        connectorId: 'connector_123',
        managedOsMcpIngressPolicy: {
          zoneId: 'zone_123',
          customRulesetId: 'ruleset_123',
          baseDomain: 'consuelohq.com',
          mcpAllowedIpsListName: 'mcp_allowed_ips',
          allowInstallBootstrapRuleId: 'rule_bootstrap',
        },
      },
    });

    expect(fakeCloudflare.calls.map((call) => call.operation)).toEqual([
      'getAccountIpList',
      'getZoneCustomRuleset',
      'createZoneCustomRulesetRule',
      'createZoneCustomRulesetRule',
      'createOrReuseTunnel',
      'putTunnelConfig',
      'createOrReuseDnsRecord',
      'createOrReuseDnsRecord',
    ]);
  });

  it('should wire managed OS MCP ingress policy from Cloudflare env during provisioning', async () => {
    const { applyWorkspaceCloudflareProvisioningFromEnv } =
      await loadWorkspaceCloudflareProvisioningContract();
    const fakeCloudflare = createFakeCloudflarePolicyClient({
      ruleset: {
        id: 'ruleset_123',
        phase: 'http_request_firewall_custom',
        rules: [
          {
            id: 'rule_bootstrap',
            ref: 'allow-install-curl-bootstrap',
            description: 'Allow install curl bootstrap',
            action: 'skip',
            action_parameters: { ruleset: 'current' },
            expression: 'starts_with(http.request.uri.path, "/install")',
            enabled: true,
          },
        ],
      },
    });

    await applyWorkspaceCloudflareProvisioningFromEnv({
      cloudflare: fakeCloudflare.client,
      env: {
        CLOUDFLARE_ZONE_ID: 'zone_123',
        CLOUDFLARE_CUSTOM_RULESET_ID: 'ruleset_123',
        CLOUDFLARE_MCP_ALLOWED_IPS_LIST_NAME: 'mcp_allowed_ips',
        CLOUDFLARE_ALLOW_INSTALL_BOOTSTRAP_RULE_REF:
          'allow-install-curl-bootstrap',
      },
      input: {
        workspaceId: 'workspace_123',
        workspaceSlug: 'kokayi',
        baseDomain: 'consuelohq.com',
        cloudflareZoneId: 'zone_123',
        connectorId: 'connector_123',
      },
    });

    expect(fakeCloudflare.calls.map((call) => call.operation)).toEqual([
      'getAccountIpList',
      'getZoneCustomRuleset',
      'createZoneCustomRulesetRule',
      'createZoneCustomRulesetRule',
      'createOrReuseTunnel',
      'putTunnelConfig',
      'createOrReuseDnsRecord',
      'createOrReuseDnsRecord',
    ]);
    const allowCreate = fakeCloudflare.calls.find(
      (call) =>
        call.operation === 'createZoneCustomRulesetRule' &&
        call.key === 'consuelo-os-mcp-provider-allow',
    );
    expect(allowCreate?.body).toMatchObject({
      rule: {
        action_parameters: {
          ruleset: 'current',
          phases: [
            'http_ratelimit',
            'http_request_firewall_managed',
            'http_request_sbfm',
          ],
        },
      },
    });
  });

  it('should update dashboard-created managed OS MCP rules without ref instead of duplicating them', async () => {
    const {
      createCloudflareManagedOsMcpIngressPolicyClient,
      ensureManagedOsMcpIngressPolicy,
    } =
      await loadWorkspaceCloudflareProvisioningContract();
    const calls: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = new Request(input, init);
      const parsedUrl = new URL(request.url);
      const body = request.method === 'GET' ? undefined : await request.json() as Record<string, unknown>;
      calls.push({
        method: request.method,
        path: parsedUrl.pathname,
        ...(body ? { body } : {}),
      });

      if (request.method === 'GET' && parsedUrl.pathname.endsWith('/accounts/account_123/rules/lists')) {
        return new Response(JSON.stringify({
          success: true,
          result: [{ id: 'list_123', name: 'mcp_allowed_ips', kind: 'ip' }],
        }));
      }
      if (request.method === 'GET' && parsedUrl.pathname.endsWith('/zones/zone_123/rulesets/ruleset_123')) {
        return new Response(JSON.stringify({
          success: true,
          result: {
            id: 'ruleset_123',
            phase: 'http_request_firewall_custom',
            rules: [
              {
                id: 'rule_bootstrap',
                ref: 'allow-install-curl-bootstrap',
                description: 'Allow install curl bootstrap',
                action: 'skip',
                action_parameters: { ruleset: 'current' },
                expression: 'starts_with(http.request.uri.path, "/install")',
                enabled: true,
              },
              {
                id: 'rule_dashboard_allow',
                description: 'Allow/skip trusted OS MCP provider traffic',
                action: 'skip',
                action_parameters: { ruleset: 'current' },
                expression: 'legacy dashboard expression',
                enabled: true,
              },
              {
                id: 'rule_dashboard_block',
                description: 'Block untrusted OS MCP traffic',
                action: 'block',
                expression: 'legacy dashboard expression',
                enabled: true,
              },
            ],
          },
        }));
      }
      if (request.method === 'PATCH' && parsedUrl.pathname.endsWith('/rules/rule_dashboard_allow')) {
        return new Response(JSON.stringify({
          success: true,
          result: { ...body, id: 'rule_dashboard_allow' },
        }));
      }
      if (request.method === 'PATCH' && parsedUrl.pathname.endsWith('/rules/rule_dashboard_block')) {
        return new Response(JSON.stringify({
          success: true,
          result: { ...body, id: 'rule_dashboard_block' },
        }));
      }
      if (request.method === 'POST') {
        return new Response(JSON.stringify({
          success: false,
          errors: [{ message: 'dashboard rule should be updated, not duplicated' }],
        }), { status: 500 });
      }

      return new Response(JSON.stringify({
        success: false,
        errors: [{ message: 'unexpected request' }],
      }), { status: 500 });
    };
    const cloudflare = createCloudflareManagedOsMcpIngressPolicyClient({
      accountId: 'account_123',
      apiToken: 'token_fixture',
      fetchImpl,
    });

    const result = await ensureManagedOsMcpIngressPolicy({
      cloudflare,
      config: {
        zoneId: 'zone_123',
        customRulesetId: 'ruleset_123',
        baseDomain: 'consuelohq.com',
        mcpAllowedIpsListName: 'mcp_allowed_ips',
        allowInstallBootstrapRuleRef: 'allow-install-curl-bootstrap',
      },
    });

    expect(result).toMatchObject({
      allowRule: { id: 'rule_dashboard_allow', status: 'updated' },
      blockRule: { id: 'rule_dashboard_block', status: 'updated' },
    });
    expect(calls.map((call) => call.method)).toEqual([
      'GET',
      'GET',
      'PATCH',
      'PATCH',
    ]);
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
    expect(calls[2]?.body).toMatchObject({
      ref: 'consuelo-os-mcp-provider-allow',
      action_parameters: {
        ruleset: 'current',
        phases: [
          'http_ratelimit',
          'http_request_firewall_managed',
          'http_request_sbfm',
        ],
      },
    });
  });

  it('should keep provisioning local-dev safe when managed OS MCP policy env is absent', async () => {
    const { applyWorkspaceCloudflareProvisioningFromEnv } =
      await loadWorkspaceCloudflareProvisioningContract();
    const calls: Array<{ operation: string; key: string; body?: unknown }> = [];
    const cloudflare: WorkspaceCloudflareProvisioningClient = {
      async createOrReuseTunnel(input) {
        calls.push({ operation: 'createOrReuseTunnel', key: input.name, body: input });
        return {
          tunnelId: 'tunnel_123',
          tunnelCredential: 'credential_fixture',
          connectorCredentialId: 'connector_credential_123',
        };
      },
      async putTunnelConfig(input) {
        calls.push({ operation: 'putTunnelConfig', key: input.tunnelId, body: input });
      },
      async createOrReuseDnsRecord(input) {
        calls.push({ operation: 'createOrReuseDnsRecord', key: input.name, body: input });
        return { recordId: `dns_${input.name}` };
      },
    };

    await applyWorkspaceCloudflareProvisioningFromEnv({
      cloudflare,
      env: {},
      input: {
        workspaceId: 'workspace_123',
        workspaceSlug: 'kokayi',
        baseDomain: 'consuelohq.com',
        cloudflareZoneId: 'zone_123',
        connectorId: 'connector_123',
      },
    });

    expect(calls.map((call) => call.operation)).toEqual([
      'createOrReuseTunnel',
      'putTunnelConfig',
      'createOrReuseDnsRecord',
      'createOrReuseDnsRecord',
    ]);
  });

  it('should call Cloudflare Lists and Rulesets APIs through the real managed policy client', async () => {
    const { createCloudflareManagedOsMcpIngressPolicyClient } =
      await loadWorkspaceCloudflareProvisioningContract();
    const calls: Array<{
      method: string;
      path: string;
      authorization: string | null;
      body?: unknown;
    }> = [];
    const jsonResponse = (result: unknown, status = 200): Response =>
      new Response(
        JSON.stringify({
          success: status < 400,
          errors: status < 400 ? [] : [{ message: 'fixture failure' }],
          messages: [],
          result,
        }),
        { status, headers: { 'content-type': 'application/json' } },
      );
    const fetchImpl: typeof fetch = async (url, init) => {
      const parsedUrl = new URL(String(url));
      const bodyText = typeof init?.body === 'string' ? init.body : undefined;
      const body = bodyText ? JSON.parse(bodyText) : undefined;
      calls.push({
        method: init?.method ?? 'GET',
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        authorization: new Headers(init?.headers).get('authorization'),
        ...(body === undefined ? {} : { body }),
      });

      if (parsedUrl.pathname.endsWith('/accounts/account_123/rules/lists')) {
        return jsonResponse([
          { id: 'list_123', name: 'mcp_allowed_ips', kind: 'ip' },
        ]);
      }
      if (
        parsedUrl.pathname.endsWith(
          '/zones/zone_123/rulesets/phases/http_request_firewall_custom/entrypoint',
        )
      ) {
        return jsonResponse({
          id: 'ruleset_123',
          phase: 'http_request_firewall_custom',
          rules: [],
        });
      }
      if (
        parsedUrl.pathname.endsWith('/zones/zone_123/rulesets') &&
        init?.method === 'POST'
      ) {
        return jsonResponse({
          id: 'ruleset_created',
          phase: body.phase,
          rules: body.rules.map((rule: CloudflareRulesetRule, index: number) => ({
            ...rule,
            id: `created_rule_${index}`,
          })),
        });
      }
      if (
        parsedUrl.pathname.endsWith('/zones/zone_123/rulesets/ruleset_123/rules') &&
        init?.method === 'POST'
      ) {
        return jsonResponse({ ...body, id: 'rule_created' });
      }
      if (
        parsedUrl.pathname.endsWith(
          '/zones/zone_123/rulesets/ruleset_123/rules/rule_123',
        ) &&
        init?.method === 'PATCH'
      ) {
        return jsonResponse({
          id: 'ruleset_123',
          phase: 'http_request_firewall_custom',
          rules: [{ ...body, id: 'rule_123' }],
        });
      }

      return jsonResponse(null, 404);
    };
    const client = createCloudflareManagedOsMcpIngressPolicyClient({
      accountId: 'account_123',
      apiToken: 'token_fixture',
      apiBaseUrl: 'https://api.example.test/client/v4',
      fetchImpl,
    });

    await expect(
      client.getAccountIpList?.({ name: 'mcp_allowed_ips' }),
    ).resolves.toEqual({ id: 'list_123', name: 'mcp_allowed_ips' });
    await expect(
      client.getZoneCustomRuleset?.({
        zoneId: 'zone_123',
        phase: 'http_request_firewall_custom',
      }),
    ).resolves.toMatchObject({ id: 'ruleset_123' });
    await expect(
      client.createZoneCustomRuleset?.({
        zoneId: 'zone_123',
        name: 'Consuelo OS MCP ingress policy',
        description: 'Managed Consuelo OS MCP provider-source filtering policy',
        phase: 'http_request_firewall_custom',
        rules: [],
      }),
    ).resolves.toMatchObject({ id: 'ruleset_created' });
    await expect(
      client.createZoneCustomRulesetRule?.({
        zoneId: 'zone_123',
        rulesetId: 'ruleset_123',
        rule: {
          ref: 'consuelo-os-mcp-provider-allow',
          description: 'Allow/skip trusted OS MCP provider traffic',
          expression: 'starts_with(http.request.uri.path, "/mcp")',
          action: 'skip',
          action_parameters: { ruleset: 'current' },
          enabled: true,
        },
        position: { after: 'rule_bootstrap' },
      }),
    ).resolves.toMatchObject({ id: 'rule_created' });
    await expect(
      client.updateZoneCustomRulesetRule?.({
        zoneId: 'zone_123',
        rulesetId: 'ruleset_123',
        ruleId: 'rule_123',
        rule: {
          ref: 'consuelo-os-mcp-provider-allow',
          description: 'Allow/skip trusted OS MCP provider traffic',
          expression: 'starts_with(http.request.uri.path, "/mcp")',
          action: 'skip',
          action_parameters: { ruleset: 'current' },
          enabled: true,
        },
        position: { after: 'rule_bootstrap' },
      }),
    ).resolves.toMatchObject({ id: 'rule_123' });

    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'GET /client/v4/accounts/account_123/rules/lists',
      'GET /client/v4/zones/zone_123/rulesets/phases/http_request_firewall_custom/entrypoint',
      'POST /client/v4/zones/zone_123/rulesets',
      'POST /client/v4/zones/zone_123/rulesets/ruleset_123/rules',
      'PATCH /client/v4/zones/zone_123/rulesets/ruleset_123/rules/rule_123',
    ]);
    expect(calls.every((call) => call.authorization === 'Bearer token_fixture')).toBe(
      true,
    );
    expect(calls[2]?.body).toMatchObject({ kind: 'zone' });
    expect(calls[3]?.body).toMatchObject({ position: { after: 'rule_bootstrap' } });
    expect(calls[4]?.body).toMatchObject({ position: { after: 'rule_bootstrap' } });
  });

  it('should apply Cloudflare tunnel and DNS operations without Railway DNS provisioning', async () => {
    const { applyWorkspaceCloudflareProvisioning } =
      await loadWorkspaceCloudflareProvisioningContract();
    const calls: Array<{ operation: string; key: string; body?: unknown }> = [];
    const cloudflare: WorkspaceCloudflareProvisioningClient = {
      async createOrReuseTunnel(input) {
        calls.push({ operation: 'createOrReuseTunnel', key: input.name, body: input });
        return {
          tunnelId: 'tunnel_123',
          tunnelCredential: 'credential_fixture',
          connectorCredentialId: 'connector_credential_123',
        };
      },
      async putTunnelConfig(input) {
        calls.push({ operation: 'putTunnelConfig', key: input.tunnelId, body: input });
      },
      async createOrReuseDnsRecord(input) {
        calls.push({ operation: 'createOrReuseDnsRecord', key: input.name, body: input });
        return { recordId: `dns_${input.name}` };
      },
    };

    const result = await applyWorkspaceCloudflareProvisioning({
      cloudflare,
      input: {
        workspaceId: 'workspace_123',
        workspaceSlug: 'kokayi',
        baseDomain: 'consuelohq.com',
        cloudflareZoneId: 'zone_123',
        connectorId: 'connector_123',
        dialerUpstreamUrl: 'https://dialer-production.up.railway.app',
        edgeHostname: 'workspace-edge.staging.consuelohq.com',
        localServiceUrl: 'http://127.0.0.1:8787',
      },
    });

    expect(calls.map((call) => call.operation)).toEqual([
      'createOrReuseTunnel',
      'putTunnelConfig',
      'createOrReuseDnsRecord',
      'createOrReuseDnsRecord',
    ]);
    expect(calls.find((call) => call.operation === 'putTunnelConfig')?.body).toMatchObject({
      localServiceUrl: 'http://127.0.0.1:8787',
    });
    expect(calls.find(
      (call) =>
        call.operation === 'createOrReuseDnsRecord' &&
        call.key === 'kokayi.consuelohq.com',
    )?.body).toMatchObject({
      content: 'workspace-edge.staging.consuelohq.com',
    });
    expect(calls.some((call) => /railway/i.test(call.operation))).toBe(false);
    expect(result.workspaceHostname).toBe('kokayi.consuelohq.com');
    expect(result.osTunnelHostname).toBe('connector-123.os-origin.consuelohq.com');
    expect(result.connectorBootstrap).toMatchObject({
      connectorId: 'connector_123',
      tunnelId: 'tunnel_123',
      tunnelCredential: 'credential_fixture',
    });
    expect(JSON.stringify(result.registryRecord)).not.toContain('credential_fixture');
  });

  it('should keep client bootstrap credentials separate from durable registry data', async () => {
    const { applyWorkspaceCloudflareProvisioning } =
      await loadWorkspaceCloudflareProvisioningContract();
    const cloudflare: WorkspaceCloudflareProvisioningClient = {
      async createOrReuseTunnel() {
        return {
          tunnelId: 'tunnel_123',
          tunnelCredential: 'credential_fixture',
          connectorCredentialId: 'connector_credential_123',
        };
      },
      async putTunnelConfig() {},
      async createOrReuseDnsRecord(input) {
        return { recordId: `dns_${input.name}` };
      },
    };

    const result = await applyWorkspaceCloudflareProvisioning({
      cloudflare,
      input: {
        workspaceId: 'workspace_123',
        workspaceSlug: 'kokayi',
        baseDomain: 'consuelohq.com',
        cloudflareZoneId: 'zone_123',
        connectorId: 'connector_123',
        dialerUpstreamUrl: 'https://dialer-production.up.railway.app',
      },
    });

    expect(result.connectorBootstrap).toMatchObject({
      connectorId: 'connector_123',
      tunnelId: 'tunnel_123',
      tunnelCredential: 'credential_fixture',
    });
    expect(result.registryRecord).toMatchObject({
      workspaceId: 'workspace_123',
      workspaceSlug: 'kokayi',
      hostname: 'kokayi.consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
    });
    expect(JSON.stringify(result.registryRecord)).not.toMatch(/credential/i);
  });

  it('should produce idempotent Cloudflare keys for retries', async () => {
    const { planWorkspaceCloudflareProvisioning } =
      await loadWorkspaceCloudflareProvisioningContract();
    const first = planWorkspaceCloudflareProvisioning({
      workspaceId: 'workspace_123',
      workspaceSlug: 'Kokayi',
      baseDomain: 'https://consuelohq.com/',
      cloudflareZoneId: 'zone_123',
      connectorId: 'connector_123',
    });
    const second = planWorkspaceCloudflareProvisioning({
      workspaceId: 'workspace_123',
      workspaceSlug: 'kokayi',
      baseDomain: 'consuelohq.com',
      cloudflareZoneId: 'zone_123',
      connectorId: 'connector_123',
    });

    expect(first.workspaceHostname).toBe(second.workspaceHostname);
    expect(first.osTunnelHostname).toBe(second.osTunnelHostname);
    expect(first.cloudflare.tunnelName).toBe(second.cloudflare.tunnelName);
    expect(first.cloudflare.workspaceDnsRecord.name).toBe(
      second.cloudflare.workspaceDnsRecord.name,
    );
    expect(first.cloudflare.osTunnelDnsRecord.name).toBe(
      second.cloudflare.osTunnelDnsRecord.name,
    );
  });
  it('should reject workspace and connector labels that are not DNS-label safe', async () => {
    const { planWorkspaceCloudflareProvisioning } =
      await loadWorkspaceCloudflareProvisioningContract();
    const baseInput: WorkspaceCloudflareProvisioningInput = {
      workspaceId: 'workspace_123',
      workspaceSlug: 'kokayi',
      baseDomain: 'consuelohq.com',
      cloudflareZoneId: 'zone_123',
      connectorId: 'connector_123',
    };
    const invalidInputs: WorkspaceCloudflareProvisioningInput[] = [
      { ...baseInput, workspaceSlug: '-kokayi' },
      { ...baseInput, workspaceSlug: 'kokayi-' },
      { ...baseInput, workspaceSlug: 'k'.repeat(64) },
      { ...baseInput, connectorId: '-connector_123' },
      { ...baseInput, connectorId: 'connector_123-' },
      { ...baseInput, connectorId: 'c'.repeat(64) },
    ];

    for (const input of invalidInputs) {
      expect(() => planWorkspaceCloudflareProvisioning(input)).toThrow(
        /must be DNS-label safe: 1-63 chars, no leading\/trailing hyphen, \[a-z0-9-\] only/,
      );
    }
  });

});
