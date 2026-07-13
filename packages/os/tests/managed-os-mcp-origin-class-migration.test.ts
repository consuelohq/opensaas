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

const createLegacyRules = (fragment = oldFragment) =>
  createRules(fragment).map(({ ref: _ref, ...rule }) => rule);

const createUnrelatedRule = (id: string, description: string) => ({
  id,
  ref: `${id}-ref`,
  description,
  action: 'block',
  action_parameters: {
    response: {
      content: '{"blocked":true}',
      content_type: 'application/json',
      status_code: 403,
    },
  },
  enabled: false,
  expression: `http.host eq "${id}.example.com"`,
  logging: { enabled: true },
  ratelimit: {
    characteristics: ['ip.src'],
    period: 60,
    requests_per_period: 100,
  },
  last_updated: '2026-07-13T00:00:00Z',
  version: '7',
  categories: ['response-only-category'],
});

const createRuleset = (
  rules: Array<Record<string, unknown>> = createRules(),
) => ({
  id: 'ruleset-id',
  name: 'zone',
  description: 'Zone-level custom ruleset',
  kind: 'zone',
  phase: 'http_request_firewall_custom',
  rules,
  last_updated: '2026-07-13T00:00:00Z',
  version: '11',
});

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
        return response(createRuleset(rules));
      }
      const ruleId = url.split('/').at(-1);
      const index = rules.findIndex((rule) => rule.id === ruleId);
      expect(index).toBeGreaterThanOrEqual(0);
      rules = rules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, ...(body as object) } : rule,
      );
      return response(createRuleset(rules));
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

  it('adopts legacy rule refs by exact managed description and action', async () => {
    const beforeRule = createUnrelatedRule('before-rule-id', 'Before managed rules');
    const afterRule = createUnrelatedRule('after-rule-id', 'After managed rules');
    let rules: Array<Record<string, unknown>> = [
      beforeRule,
      ...createLegacyRules(),
      afterRule,
    ];
    const requests: Array<{ method: string; url: string; body?: unknown }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ method, url, ...(body ? { body } : {}) });

      if (method === 'GET') {
        return response(createRuleset(rules));
      }
      expect(method).toBe('PUT');
      expect(url).toBe(
        'https://api.cloudflare.com/client/v4/zones/zone-id/rulesets/ruleset-id',
      );
      const bodyRules = (body as { rules: Array<Record<string, unknown>> }).rules;
      rules = bodyRules.map((rule, index) => ({
        ...rule,
        id: typeof rule.id === 'string' ? rule.id : `replacement-rule-${index}`,
      }));
      return response(createRuleset(rules));
    };

    const result = await migrateManagedOsMcpConnectorOriginClass({
      apiToken: 'secret',
      zoneId: 'zone-id',
      baseDomain: 'consuelohq.com',
      fetchImpl,
    });

    expect(result.status).toBe('migrated');
    expect(requests.map((request) => request.method)).toEqual(['GET', 'PUT', 'GET']);
    const put = requests[1]!;
    expect(put.body).toMatchObject({
      name: 'zone',
      description: 'Zone-level custom ruleset',
      kind: 'zone',
      phase: 'http_request_firewall_custom',
    });
    const putRules = (put.body as { rules: Array<Record<string, unknown>> }).rules;
    expect(putRules.map((rule) => rule.description)).toEqual([
      'Before managed rules',
      'Allow/skip trusted OS MCP provider traffic',
      'Block untrusted OS MCP traffic',
      'After managed rules',
    ]);
    expect(putRules[0]).toEqual({
      id: beforeRule.id,
      ref: beforeRule.ref,
      description: beforeRule.description,
      action: beforeRule.action,
      action_parameters: beforeRule.action_parameters,
      enabled: beforeRule.enabled,
      expression: beforeRule.expression,
      logging: beforeRule.logging,
      ratelimit: beforeRule.ratelimit,
    });
    expect(putRules[1]).toMatchObject({
      ref: 'consuelo-os-mcp-provider-allow',
      description: 'Allow/skip trusted OS MCP provider traffic',
      action: 'skip',
      enabled: true,
      expression: expect.stringContaining(newFragment),
      action_parameters: {
        ruleset: 'current',
        phases: [
          'http_ratelimit',
          'http_request_firewall_managed',
          'http_request_sbfm',
        ],
      },
    });
    expect(putRules[1]).not.toHaveProperty('id');
    expect(putRules[2]).toMatchObject({
      ref: 'consuelo-os-mcp-untrusted-block',
      description: 'Block untrusted OS MCP traffic',
      action: 'block',
      enabled: true,
      expression: expect.stringContaining(newFragment),
    });
    expect(putRules[2]).not.toHaveProperty('id');
    expect(putRules[3]).toEqual({
      id: afterRule.id,
      ref: afterRule.ref,
      description: afterRule.description,
      action: afterRule.action,
      action_parameters: afterRule.action_parameters,
      enabled: afterRule.enabled,
      expression: afterRule.expression,
      logging: afterRule.logging,
      ratelimit: afterRule.ratelimit,
    });
    expect(putRules[0]).not.toHaveProperty('last_updated');
    expect(putRules[0]).not.toHaveProperty('version');
    expect(putRules[0]).not.toHaveProperty('categories');
  });

  it('adopts legacy refs even when the connector-origin expression is already canonical', async () => {
    let rules: Array<Record<string, unknown>> = createLegacyRules(newFragment);
    const methods: string[] = [];
    const submittedRefs: unknown[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      const method = init?.method ?? 'GET';
      methods.push(method);
      if (method === 'GET') {
        return response(createRuleset(rules));
      }
      expect(method).toBe('PUT');
      const body = JSON.parse(String(init?.body)) as {
        rules: Array<Record<string, unknown>>;
      };
      submittedRefs.push(...body.rules.map((rule) => rule.ref));
      rules = body.rules.map((rule, index) => ({
        ...rule,
        id: typeof rule.id === 'string' ? rule.id : `replacement-rule-${index}`,
      }));
      return response(createRuleset(rules));
    };

    const result = await migrateManagedOsMcpConnectorOriginClass({
      apiToken: 'secret',
      zoneId: 'zone-id',
      baseDomain: 'consuelohq.com',
      fetchImpl,
    });

    expect(result.status).toBe('migrated');
    expect(submittedRefs).toEqual([
      'consuelo-os-mcp-provider-allow',
      'consuelo-os-mcp-untrusted-block',
    ]);
    expect(methods).toEqual(['GET', 'PUT', 'GET']);
  });

  it('fails closed when the whole-ruleset reread drifts an unrelated rule', async () => {
    const unrelatedRule = createUnrelatedRule('unrelated-rule-id', 'Unrelated rule');
    const initialRules: Array<Record<string, unknown>> = [
      unrelatedRule,
      ...createLegacyRules(),
    ];
    let submittedRules: Array<Record<string, unknown>> = [];
    let getCount = 0;
    const methods: string[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      const method = init?.method ?? 'GET';
      methods.push(method);
      if (method === 'PUT') {
        submittedRules = (
          JSON.parse(String(init?.body)) as {
            rules: Array<Record<string, unknown>>;
          }
        ).rules;
        return response(createRuleset(submittedRules));
      }
      getCount += 1;
      if (getCount === 1) return response(createRuleset(initialRules));
      return response(
        createRuleset(
          submittedRules.map((rule, index) => ({
            ...rule,
            ...(index === 0
              ? { expression: 'http.host eq "drifted.example.com"' }
              : {}),
            id: typeof rule.id === 'string' ? rule.id : `replacement-rule-${index}`,
          })),
        ),
      );
    };

    await expect(
      migrateManagedOsMcpConnectorOriginClass({
        apiToken: 'secret',
        zoneId: 'zone-id',
        baseDomain: 'consuelohq.com',
        fetchImpl,
      }),
    ).rejects.toThrow(/ordered writable ruleset projection/);
    expect(methods).toEqual(['GET', 'PUT', 'GET']);
  });

  it('is idempotent when the live rules already use the canonical class', async () => {
    const rules = createRules(newFragment);
    const methods: string[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      methods.push(init?.method ?? 'GET');
      return response(createRuleset(rules));
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
      return response(createRuleset(createLegacyRules()));
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

  it('fails closed when canonical ref and canonical description identify different rules', async () => {
    const canonicalRules = createRules();
    const conflictingRules = [
      {
        ...canonicalRules[0],
        description: 'Renamed provider allow rule',
      },
      {
        ...canonicalRules[0],
        id: 'legacy-allow-rule-id',
        ref: 'legacy-provider-allow',
      },
      canonicalRules[1],
    ];
    const methods: string[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      methods.push(init?.method ?? 'GET');
      return response(createRuleset(conflictingRules));
    };

    await expect(
      migrateManagedOsMcpConnectorOriginClass({
        apiToken: 'secret',
        zoneId: 'zone-id',
        baseDomain: 'consuelohq.com',
        fetchImpl,
      }),
    ).rejects.toThrow(/conflicting Cloudflare rules/);
    expect(methods).toEqual(['GET']);
  });

  it('fails closed when a legacy description candidate has the wrong action', async () => {
    const rules = createLegacyRules().map((rule, index) =>
      index === 0 ? { ...rule, action: 'block' } : rule,
    );
    const methods: string[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      methods.push(init?.method ?? 'GET');
      return response(createRuleset(rules));
    };

    await expect(
      migrateManagedOsMcpConnectorOriginClass({
        apiToken: 'secret',
        zoneId: 'zone-id',
        baseDomain: 'consuelohq.com',
        fetchImpl,
      }),
    ).rejects.toThrow(/expected action skip/);
    expect(methods).toEqual(['GET']);
  });

  it('fails closed when multiple legacy rules share a managed description', async () => {
    const rules = [
      ...createLegacyRules(),
      {
        ...createLegacyRules()[0],
        id: 'duplicate-legacy-allow-rule-id',
        ref: 'second-legacy-provider-allow',
      },
    ];
    const methods: string[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      methods.push(init?.method ?? 'GET');
      return response(createRuleset(rules));
    };

    await expect(
      migrateManagedOsMcpConnectorOriginClass({
        apiToken: 'secret',
        zoneId: 'zone-id',
        baseDomain: 'consuelohq.com',
        fetchImpl,
      }),
    ).rejects.toThrow(/expected exactly one Cloudflare rule/);
    expect(methods).toEqual(['GET']);
  });

  it.each([
    [],
    [createRules()[0]],
    [...createRules(), { ...createRules()[0], id: 'duplicate' }],
    createRules('not starts_with(http.host, "connector-")'),
  ])('fails closed for missing, duplicate, or unexpected managed policy %#', async (rules) => {
    const fetchImpl: typeof fetch = async () => response(createRuleset(rules));

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
