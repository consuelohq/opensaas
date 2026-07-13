import { describe, expect, it } from 'vitest';

import { migrateManagedOsMcpConnectorOriginClass } from '../scripts/lib/managed-os-mcp-origin-class-migration';

const oldFragment =
  'not ends_with(http.host, ".os-origin.consuelohq.com")';
const newFragment =
  'not (http.host matches r"^c-[0-9a-f]{32}\\.consuelohq\\.com$")';

const createRules = (fragment = oldFragment) => [
  {
    id: 'allow-rule-id',
    ref: 'consuelo-os-mcp-provider-allow',
    description: 'Allow/skip trusted OS MCP provider traffic',
    action: 'skip',
    action_parameters: {
      ruleset: 'current',
      phases: [
        'http_ratelimit',
        'http_request_firewall_managed',
        'http_request_sbfm',
      ],
    },
    enabled: true,
    expression: `(http.request.uri.path eq "/mcp" and ${fragment}) and (ip.src in $consuelo_os_mcp_provider_ips)`,
  },
  {
    id: 'block-rule-id',
    ref: 'consuelo-os-mcp-untrusted-block',
    description: 'Block untrusted OS MCP traffic',
    action: 'block',
    enabled: true,
    expression: `(http.request.uri.path eq "/mcp" and ${fragment}) and not (ip.src in $consuelo_os_mcp_provider_ips)`,
  },
];

const response = (result: unknown, status = 200): Response =>
  new Response(JSON.stringify({ success: status < 400, errors: [], result }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('managed OS MCP connector-origin WAF migration', () => {
  it('patches only the two managed rules and preserves their security behavior', async () => {
    let rules = createRules();
    const requests: Array<{ method: string; url: string; body?: unknown }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ method, url, ...(body ? { body } : {}) });

      if (method === 'GET') {
        return response({ id: 'ruleset-id', rules });
      }
      const ruleId = url.split('/').at(-1);
      const index = rules.findIndex((rule) => rule.id === ruleId);
      expect(index).toBeGreaterThanOrEqual(0);
      rules = rules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, ...(body as object) } : rule,
      );
      return response(rules[index]);
    };

    const result = await migrateManagedOsMcpConnectorOriginClass({
      apiToken: 'secret',
      zoneId: 'zone-id',
      baseDomain: 'consuelohq.com',
      fetchImpl,
    });

    expect(result).toEqual({
      status: 'migrated',
      rulesetId: 'ruleset-id',
      rules: [
        { ref: 'consuelo-os-mcp-provider-allow', status: 'updated' },
        { ref: 'consuelo-os-mcp-untrusted-block', status: 'updated' },
      ],
    });
    const patches = requests.filter((request) => request.method === 'PATCH');
    expect(patches).toHaveLength(2);
    for (const patch of patches) {
      const body = patch.body as Record<string, unknown>;
      expect(String(body.expression)).toContain(newFragment);
      expect(String(body.expression)).not.toContain(oldFragment);
      expect(body.enabled).toBe(true);
      expect(body.ref).toMatch(/^consuelo-os-mcp-/);
    }
    expect(patches[0]?.body).toMatchObject({
      action: 'skip',
      action_parameters: {
        ruleset: 'current',
        phases: [
          'http_ratelimit',
          'http_request_firewall_managed',
          'http_request_sbfm',
        ],
      },
    });
    expect(patches[1]?.body).toMatchObject({ action: 'block' });
    expect(requests.at(-1)?.method).toBe('GET');
  });

  it('is idempotent when the live rules already use the canonical class', async () => {
    const rules = createRules(newFragment);
    const methods: string[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      methods.push(init?.method ?? 'GET');
      return response({ id: 'ruleset-id', rules });
    };

    const result = await migrateManagedOsMcpConnectorOriginClass({
      apiToken: 'secret',
      zoneId: 'zone-id',
      baseDomain: 'consuelohq.com',
      fetchImpl,
    });

    expect(result.status).toBe('unchanged');
    expect(methods).toEqual(['GET']);
  });

  it('plans without writing', async () => {
    const methods: string[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      methods.push(init?.method ?? 'GET');
      return response({ id: 'ruleset-id', rules: createRules() });
    };

    const result = await migrateManagedOsMcpConnectorOriginClass({
      apiToken: 'secret',
      zoneId: 'zone-id',
      baseDomain: 'consuelohq.com',
      fetchImpl,
      dryRun: true,
    });

    expect(result.status).toBe('planned');
    expect(methods).toEqual(['GET']);
  });

  it.each([
    [],
    [createRules()[0]],
    [...createRules(), { ...createRules()[0], id: 'duplicate' }],
    createRules('not starts_with(http.host, "connector-")'),
  ])('fails closed for missing, duplicate, or unexpected managed policy %#', async (rules) => {
    const fetchImpl: typeof fetch = async () =>
      response({ id: 'ruleset-id', rules });

    await expect(
      migrateManagedOsMcpConnectorOriginClass({
        apiToken: 'secret',
        zoneId: 'zone-id',
        baseDomain: 'consuelohq.com',
        fetchImpl,
      }),
    ).rejects.toThrow();
  });
});
