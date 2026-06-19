import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

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

type WorkspaceCloudflareManagedOsMcpIngressPolicyClient = {
  getAccountIpList: (input: {
    name: string;
  }) => Promise<{ id: string; name: string } | null>;
  getZoneCustomRuleset: (input: {
    zoneId: string;
    rulesetId?: string;
    phase: 'http_request_firewall_custom';
  }) => Promise<{ id: string; phase: 'http_request_firewall_custom'; rules: CloudflareRulesetRule[] } | null>;
  createZoneCustomRuleset: (input: {
    zoneId: string;
    name: string;
    description: string;
    phase: 'http_request_firewall_custom';
    rules: CloudflareRulesetRule[];
  }) => Promise<{ id: string; phase: 'http_request_firewall_custom'; rules: CloudflareRulesetRule[] }>;
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

type PlatformCloudflareProvisioningResult =
  | { status: 'skipped'; reason: string }
  | { status: 'planned'; zoneId: string; allowedIpsListName: string }
  | { status: 'provisioned'; rulesetId: string; allowRule: { status: string }; blockRule: { status: string } };

type PlatformCloudflareProvisioningContract = {
  provisionPlatformManagedOsMcpIngressPolicyFromEnv: (input: {
    env: Record<string, string | undefined>;
    baseDomain: string;
    dryRun?: boolean;
    cloudflare?: WorkspaceCloudflareManagedOsMcpIngressPolicyClient;
    fetchImpl?: typeof fetch;
  }) => Promise<PlatformCloudflareProvisioningResult>;
};

const runContract =
  process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;

async function loadPlatformCloudflareProvisioningContract(): Promise<PlatformCloudflareProvisioningContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'platform-cloudflare-provisioning.ts'),
  ).href;
  const module = (await import(modulePath)) as Partial<PlatformCloudflareProvisioningContract>;

  if (typeof module.provisionPlatformManagedOsMcpIngressPolicyFromEnv !== 'function') {
    throw new Error(
      'platform Cloudflare provisioning contract module is missing export: provisionPlatformManagedOsMcpIngressPolicyFromEnv',
    );
  }

  return module as PlatformCloudflareProvisioningContract;
}

const createJsonResponse = (result: unknown): Response =>
  new Response(JSON.stringify({ success: true, result }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

contractDescribe('platform Cloudflare provisioning boundary', () => {
  it('should keep public install out of Cloudflare account-admin provisioning', () => {
    const installSource = readFileSync(
      join(process.cwd(), 'scripts', 'install.ts'),
      'utf8',
    );
    const provisionIndex = installSource.indexOf('const result = provisionLocalOs');
    const platformPayloadIndex = installSource.indexOf('const platformProvisioning =');
    const payloadIndex = installSource.indexOf('const payload = {');
    const successIndex = installSource.indexOf('spin?.succeed');

    expect(provisionIndex).toBeGreaterThan(-1);
    expect(platformPayloadIndex).toBeGreaterThan(provisionIndex);
    expect(payloadIndex).toBeGreaterThan(platformPayloadIndex);
    expect(successIndex).toBeGreaterThan(payloadIndex);
    expect(installSource).toContain('platformProvisioning,');
    expect(installSource).toContain('Consuelo platform provisioning');
    expect(installSource).not.toMatch(/install-cloudflare-provisioning|platform-cloudflare-provisioning/);
    expect(installSource).not.toMatch(/provision(?:Platform)?ManagedOsMcpIngressPolicyFromEnv/);
    expect(installSource).not.toMatch(/publishWorkspaceEdgeSnapshot|edgePublish|wrangler/);
    expect(installSource).not.toMatch(/CLOUDFLARE_(?:ACCOUNT_ID|API_TOKEN|ZONE_ID|CUSTOM_RULESET_ID)/);
  });

  it('should expose managed OS MCP WAF provisioning only through an explicit platform script', () => {
    const scriptSource = readFileSync(
      join(process.cwd(), 'scripts', 'provision-managed-os-mcp-ingress-policy.ts'),
      'utf8',
    );
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };

    expect(scriptSource).toContain('platform-cloudflare-provisioning');
    expect(scriptSource).toContain('provisionPlatformManagedOsMcpIngressPolicyFromEnv');
    expect(scriptSource).toContain('env: process.env');
    expect(scriptSource).toContain('Consuelo platform/admin script');
    expect(packageJson.scripts?.['platform:managed-os-mcp-ingress:provision']).toBe(
      'bun ./scripts/provision-managed-os-mcp-ingress-policy.ts',
    );
  });

  it('should stay inert when managed OS MCP policy env is absent', async () => {
    const { provisionPlatformManagedOsMcpIngressPolicyFromEnv } =
      await loadPlatformCloudflareProvisioningContract();
    const cloudflare: WorkspaceCloudflareManagedOsMcpIngressPolicyClient = {
      async getAccountIpList() {
        throw new Error('Cloudflare should not be called without managed policy env');
      },
      async getZoneCustomRuleset() {
        throw new Error('Cloudflare should not be called without managed policy env');
      },
      async createZoneCustomRuleset() {
        throw new Error('Cloudflare should not be called without managed policy env');
      },
      async createZoneCustomRulesetRule() {
        throw new Error('Cloudflare should not be called without managed policy env');
      },
      async updateZoneCustomRulesetRule() {
        throw new Error('Cloudflare should not be called without managed policy env');
      },
    };

    await expect(
      provisionPlatformManagedOsMcpIngressPolicyFromEnv({
        env: {},
        baseDomain: 'consuelohq.com',
        cloudflare,
      }),
    ).resolves.toEqual({
      status: 'skipped',
      reason: 'managed OS MCP ingress policy env not configured',
    });
  });

  it('should fail closed when managed policy env is explicit but incomplete', async () => {
    const { provisionPlatformManagedOsMcpIngressPolicyFromEnv } =
      await loadPlatformCloudflareProvisioningContract();

    await expect(
      provisionPlatformManagedOsMcpIngressPolicyFromEnv({
        env: {
          CLOUDFLARE_MCP_ALLOWED_IPS_LIST_NAME: 'mcp_allowed_ips',
        },
        baseDomain: 'consuelohq.com',
      }),
    ).rejects.toThrow(/CLOUDFLARE_ZONE_ID/);

    await expect(
      provisionPlatformManagedOsMcpIngressPolicyFromEnv({
        env: {
          CLOUDFLARE_ZONE_ID: 'zone_123',
          CLOUDFLARE_MCP_ALLOWED_IPS_LIST_NAME: 'mcp_allowed_ips',
        },
        baseDomain: 'consuelohq.com',
      }),
    ).rejects.toThrow(/CLOUDFLARE_ACCOUNT_ID/);

    await expect(
      provisionPlatformManagedOsMcpIngressPolicyFromEnv({
        env: {
          CLOUDFLARE_ZONE_ID: 'zone_123',
          CLOUDFLARE_ACCOUNT_ID: 'account_123',
          CLOUDFLARE_MCP_ALLOWED_IPS_LIST_NAME: 'mcp_allowed_ips',
        },
        baseDomain: 'consuelohq.com',
      }),
    ).rejects.toThrow(/CLOUDFLARE_API_TOKEN/);
  });

  it('should use the real Cloudflare policy client from platform env and preserve exact skip phases', async () => {
    const { provisionPlatformManagedOsMcpIngressPolicyFromEnv } =
      await loadPlatformCloudflareProvisioningContract();
    const calls: Array<{
      method: string;
      path: string;
      authorization: string | null;
      body?: Record<string, unknown>;
    }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = new Request(input, init);
      const parsedUrl = new URL(request.url);
      const body = request.method === 'GET' ? undefined : await request.json() as Record<string, unknown>;
      calls.push({
        method: request.method,
        path: parsedUrl.pathname,
        authorization: request.headers.get('authorization'),
        ...(body ? { body } : {}),
      });

      if (request.method === 'GET' && parsedUrl.pathname.endsWith('/accounts/account_123/rules/lists')) {
        return createJsonResponse([{ id: 'list_123', name: 'mcp_allowed_ips', kind: 'ip' }]);
      }
      if (request.method === 'GET' && parsedUrl.pathname.endsWith('/zones/zone_123/rulesets/ruleset_123')) {
        return createJsonResponse({
          id: 'ruleset_123',
          phase: 'http_request_firewall_custom',
          rules: [
            {
              id: 'rule_bootstrap',
              ref: 'allow-install-curl-bootstrap',
              description: 'Allow install curl bootstrap',
              expression: 'starts_with(http.request.uri.path, "/install")',
              action: 'skip',
              action_parameters: { ruleset: 'current' },
              enabled: true,
            },
          ],
        });
      }
      if (request.method === 'POST' && parsedUrl.pathname.endsWith('/zones/zone_123/rulesets/ruleset_123/rules')) {
        return createJsonResponse({
          ...body,
          id: body?.ref === 'consuelo-os-mcp-provider-allow' ? 'rule_allow' : 'rule_block',
        });
      }

      return new Response(JSON.stringify({ success: false, errors: [{ message: 'unexpected request' }] }), { status: 500 });
    };

    const result = await provisionPlatformManagedOsMcpIngressPolicyFromEnv({
      env: {
        CLOUDFLARE_ZONE_ID: 'zone_123',
        CLOUDFLARE_ACCOUNT_ID: 'account_123',
        CLOUDFLARE_API_TOKEN: 'token_fixture',
        CLOUDFLARE_CUSTOM_RULESET_ID: 'ruleset_123',
        CLOUDFLARE_MCP_ALLOWED_IPS_LIST_NAME: 'mcp_allowed_ips',
        CLOUDFLARE_ALLOW_INSTALL_BOOTSTRAP_RULE_REF: 'allow-install-curl-bootstrap',
      },
      baseDomain: 'consuelohq.com',
      fetchImpl,
    });

    expect(result).toMatchObject({
      status: 'provisioned',
      rulesetId: 'ruleset_123',
      allowRule: { status: 'created' },
      blockRule: { status: 'created' },
    });
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'GET /client/v4/accounts/account_123/rules/lists',
      'GET /client/v4/zones/zone_123/rulesets/ruleset_123',
      'POST /client/v4/zones/zone_123/rulesets/ruleset_123/rules',
      'POST /client/v4/zones/zone_123/rulesets/ruleset_123/rules',
    ]);
    expect(calls.every((call) => call.authorization === 'Bearer token_fixture')).toBe(true);
    const allowCall = calls.find(
      (call) => call.body?.ref === 'consuelo-os-mcp-provider-allow',
    );
    expect(allowCall?.body).toMatchObject({
      action: 'skip',
      action_parameters: {
        ruleset: 'current',
        phases: [
          'http_ratelimit',
          'http_request_firewall_managed',
          'http_request_sbfm',
        ],
      },
      position: { after: 'rule_bootstrap' },
    });
    expect(JSON.stringify(calls.map((call) => call.body ?? {}))).not.toMatch(
      /kokayi\.consuelohq\.com|openai\.consuelohq\.com/,
    );
  });
});
