import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

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

type InstallCloudflareProvisioningResult =
  | { status: 'skipped'; reason: string }
  | { status: 'provisioned'; rulesetId: string; allowRule: { status: string }; blockRule: { status: string } };

type InstallCloudflareProvisioningContract = {
  provisionManagedOsMcpIngressPolicyFromEnv: (input: {
    env: Record<string, string | undefined>;
    baseDomain: string;
    cloudflare?: WorkspaceCloudflareManagedOsMcpIngressPolicyClient;
    fetchImpl?: typeof fetch;
  }) => Promise<InstallCloudflareProvisioningResult>;
};

const runContract =
  process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;

async function loadInstallCloudflareProvisioningContract(): Promise<InstallCloudflareProvisioningContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'install-cloudflare-provisioning.ts'),
  ).href;
  const module = (await import(modulePath)) as Partial<InstallCloudflareProvisioningContract>;

  if (typeof module.provisionManagedOsMcpIngressPolicyFromEnv !== 'function') {
    throw new Error(
      'install Cloudflare provisioning contract module is missing export: provisionManagedOsMcpIngressPolicyFromEnv',
    );
  }

  return module as InstallCloudflareProvisioningContract;
}

const createJsonResponse = (result: unknown): Response =>
  new Response(JSON.stringify({ success: true, result }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

contractDescribe('install Cloudflare provisioning contract', () => {
  it('should invoke managed OS MCP ingress policy provisioning from the real install flow before success output', () => {
    const installSource = readFileSync(
      join(process.cwd(), 'scripts', 'install.ts'),
      'utf8',
    );

    const policyImportIndex = installSource.indexOf(
      'provisionManagedOsMcpIngressPolicyFromEnv',
    );
    const provisionIndex = installSource.indexOf('const result = provisionLocalOs');
    const policyCallIndex = installSource.indexOf(
      'await provisionManagedOsMcpIngressPolicyFromEnv',
    );
    const edgePublishIndex = installSource.indexOf('let edgePublish');
    const payloadIndex = installSource.indexOf('const payload = {');
    const successIndex = installSource.indexOf('spin?.succeed');

    expect(policyImportIndex).toBeGreaterThan(-1);
    expect(provisionIndex).toBeGreaterThan(-1);
    expect(policyCallIndex).toBeGreaterThan(provisionIndex);
    expect(edgePublishIndex).toBeGreaterThan(policyCallIndex);
    expect(payloadIndex).toBeGreaterThan(policyCallIndex);
    expect(successIndex).toBeGreaterThan(payloadIndex);
    expect(installSource).toContain('env: process.env');
    expect(installSource).toContain('baseDomain: WORKSPACE_BASE_DOMAIN');
    expect(installSource).toContain('cloudflareMcpIngress,');
  });

  it('should stay inert when managed OS MCP policy env is absent', async () => {
    const { provisionManagedOsMcpIngressPolicyFromEnv } =
      await loadInstallCloudflareProvisioningContract();
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
      provisionManagedOsMcpIngressPolicyFromEnv({
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
    const { provisionManagedOsMcpIngressPolicyFromEnv } =
      await loadInstallCloudflareProvisioningContract();

    await expect(
      provisionManagedOsMcpIngressPolicyFromEnv({
        env: {
          CLOUDFLARE_MCP_ALLOWED_IPS_LIST_NAME: 'mcp_allowed_ips',
        },
        baseDomain: 'consuelohq.com',
      }),
    ).rejects.toThrow(/CLOUDFLARE_ZONE_ID/);

    await expect(
      provisionManagedOsMcpIngressPolicyFromEnv({
        env: {
          CLOUDFLARE_ZONE_ID: 'zone_123',
          CLOUDFLARE_MCP_ALLOWED_IPS_LIST_NAME: 'mcp_allowed_ips',
        },
        baseDomain: 'consuelohq.com',
      }),
    ).rejects.toThrow(/CLOUDFLARE_ACCOUNT_ID/);

    await expect(
      provisionManagedOsMcpIngressPolicyFromEnv({
        env: {
          CLOUDFLARE_ZONE_ID: 'zone_123',
          CLOUDFLARE_ACCOUNT_ID: 'account_123',
          CLOUDFLARE_MCP_ALLOWED_IPS_LIST_NAME: 'mcp_allowed_ips',
        },
        baseDomain: 'consuelohq.com',
      }),
    ).rejects.toThrow(/CLOUDFLARE_API_TOKEN/);
  });

  it('should use the real Cloudflare policy client from install env and preserve the exact skip phases', async () => {
    const { provisionManagedOsMcpIngressPolicyFromEnv } =
      await loadInstallCloudflareProvisioningContract();
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

    const result = await provisionManagedOsMcpIngressPolicyFromEnv({
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
