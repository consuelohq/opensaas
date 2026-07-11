import { createConnectorOriginHostnameRegexSource } from './connector-origin-hostname';

const MANAGED_RULE_REFS = [
  'consuelo-os-mcp-provider-allow',
  'consuelo-os-mcp-untrusted-block',
] as const;
const CUSTOM_RULESET_PHASE = 'http_request_firewall_custom';

type ManagedRuleRef = (typeof MANAGED_RULE_REFS)[number];

type CloudflareRule = {
  id: string;
  ref: string;
  description?: string;
  action: string;
  action_parameters?: unknown;
  enabled: boolean;
  expression: string;
};

type CloudflareRuleset = {
  id: string;
  rules: CloudflareRule[];
};

type RuleMigration = {
  ref: ManagedRuleRef;
  status: 'updated' | 'unchanged' | 'planned';
};

export type ManagedOsMcpOriginClassMigrationResult = {
  status: 'migrated' | 'unchanged' | 'planned';
  rulesetId: string;
  rules: RuleMigration[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requiredString = (
  value: Record<string, unknown>,
  key: string,
  context: string,
): string => {
  const result = value[key];
  if (typeof result !== 'string' || !result.trim()) {
    throw new Error(`${context} is missing ${key}`);
  }
  return result;
};

const parseRule = (value: unknown): CloudflareRule => {
  if (!isRecord(value)) throw new Error('Cloudflare managed rule was invalid');
  const enabled = value.enabled;
  if (typeof enabled !== 'boolean') {
    throw new Error('Cloudflare managed rule is missing enabled');
  }
  return {
    id: requiredString(value, 'id', 'Cloudflare managed rule'),
    ref: requiredString(value, 'ref', 'Cloudflare managed rule'),
    action: requiredString(value, 'action', 'Cloudflare managed rule'),
    expression: requiredString(value, 'expression', 'Cloudflare managed rule'),
    enabled,
    ...(typeof value.description === 'string'
      ? { description: value.description }
      : {}),
    ...(value.action_parameters !== undefined
      ? { action_parameters: value.action_parameters }
      : {}),
  };
};

const readCloudflareResult = async (
  response: Response,
  operation: string,
): Promise<unknown> => {
  try {
    const payload = await response.json() as unknown;
    if (!isRecord(payload)) {
      throw new Error(`Cloudflare ${operation} response was invalid`);
    }
    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    if (!response.ok || payload.success !== true) {
      throw new Error(
        `Cloudflare ${operation} failed: ${JSON.stringify(errors).slice(0, 1_000)}`,
      );
    }
    return payload.result;
  } catch (error: unknown) {
    throw new Error(
      `Cloudflare ${operation} response handling failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
};

const readRuleset = async (input: {
  apiBaseUrl: string;
  apiToken: string;
  zoneId: string;
  fetchImpl: typeof fetch;
}): Promise<CloudflareRuleset> => {
  try {
    const response = await input.fetchImpl(
      `${input.apiBaseUrl}/zones/${encodeURIComponent(input.zoneId)}/rulesets/phases/${CUSTOM_RULESET_PHASE}/entrypoint`,
      {
        headers: {
          authorization: `Bearer ${input.apiToken}`,
          'user-agent': 'consuelo-os-mcp-origin-class-migration/1.0',
        },
      },
    );
    const result = await readCloudflareResult(response, 'read custom ruleset');
    if (!isRecord(result) || !Array.isArray(result.rules)) {
      throw new Error('Cloudflare custom ruleset response was invalid');
    }
    return {
      id: requiredString(result, 'id', 'Cloudflare custom ruleset'),
      rules: result.rules.map(parseRule),
    };
  } catch (error: unknown) {
    throw new Error(
      `managed OS MCP ruleset read failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
};

const findManagedRule = (
  rules: CloudflareRule[],
  ref: ManagedRuleRef,
): CloudflareRule => {
  const matches = rules.filter((rule) => rule.ref === ref);
  if (matches.length !== 1) {
    throw new Error(`expected exactly one Cloudflare rule with ref ${ref}`);
  }
  return matches[0]!;
};

const replacementFragments = (baseDomain: string): {
  oldFragment: string;
  newFragment: string;
} => ({
  oldFragment: `not ends_with(http.host, ".os-origin.${baseDomain.trim().toLowerCase()}")`,
  newFragment: `not (http.host matches r"${createConnectorOriginHostnameRegexSource({ baseDomain })}")`,
});

const migrateExpression = (input: {
  expression: string;
  oldFragment: string;
  newFragment: string;
  ref: ManagedRuleRef;
}): { expression: string; changed: boolean } => {
  const oldCount = input.expression.split(input.oldFragment).length - 1;
  const newCount = input.expression.split(input.newFragment).length - 1;
  if (oldCount === 0 && newCount === 1) {
    return { expression: input.expression, changed: false };
  }
  if (oldCount !== 1 || newCount !== 0) {
    throw new Error(
      `managed Cloudflare rule ${input.ref} did not contain exactly one retired connector-origin fragment`,
    );
  }
  return {
    expression: input.expression.replace(input.oldFragment, input.newFragment),
    changed: true,
  };
};

const patchRule = async (input: {
  apiBaseUrl: string;
  apiToken: string;
  zoneId: string;
  rulesetId: string;
  rule: CloudflareRule;
  expression: string;
  fetchImpl: typeof fetch;
}): Promise<void> => {
  try {
    const body = {
      ref: input.rule.ref,
      ...(input.rule.description !== undefined
        ? { description: input.rule.description }
        : {}),
      action: input.rule.action,
      ...(input.rule.action_parameters !== undefined
        ? { action_parameters: input.rule.action_parameters }
        : {}),
      enabled: input.rule.enabled,
      expression: input.expression,
    };
    const response = await input.fetchImpl(
      `${input.apiBaseUrl}/zones/${encodeURIComponent(input.zoneId)}/rulesets/${encodeURIComponent(input.rulesetId)}/rules/${encodeURIComponent(input.rule.id)}`,
      {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${input.apiToken}`,
          'content-type': 'application/json',
          'user-agent': 'consuelo-os-mcp-origin-class-migration/1.0',
        },
        body: JSON.stringify(body),
      },
    );
    await readCloudflareResult(response, `update managed rule ${input.rule.ref}`);
  } catch (error: unknown) {
    throw new Error(
      `managed OS MCP rule ${input.rule.ref} update failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
};

export const migrateManagedOsMcpConnectorOriginClass = async (input: {
  apiToken: string;
  zoneId: string;
  baseDomain: string;
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
  dryRun?: boolean;
}): Promise<ManagedOsMcpOriginClassMigrationResult> => {
  try {
    const apiToken = input.apiToken.trim();
    const zoneId = input.zoneId.trim();
    if (!apiToken) throw new Error('Cloudflare API token is required');
    if (!zoneId) throw new Error('Cloudflare zone id is required');
    const apiBaseUrl = (input.apiBaseUrl ?? 'https://api.cloudflare.com/client/v4').replace(/\/$/, '');
    const fetchImpl = input.fetchImpl ?? fetch;
    const fragments = replacementFragments(input.baseDomain);
    const ruleset = await readRuleset({ apiBaseUrl, apiToken, zoneId, fetchImpl });
    const plans = MANAGED_RULE_REFS.map((ref) => {
      const rule = findManagedRule(ruleset.rules, ref);
      const migration = migrateExpression({
        expression: rule.expression,
        ...fragments,
        ref,
      });
      return { ref, rule, ...migration };
    });

    if (input.dryRun) {
      return {
        status: plans.some((plan) => plan.changed) ? 'planned' : 'unchanged',
        rulesetId: ruleset.id,
        rules: plans.map((plan) => ({
          ref: plan.ref,
          status: plan.changed ? 'planned' : 'unchanged',
        })),
      };
    }

    for (const plan of plans) {
      if (!plan.changed) continue;
      await patchRule({
        apiBaseUrl,
        apiToken,
        zoneId,
        rulesetId: ruleset.id,
        rule: plan.rule,
        expression: plan.expression,
        fetchImpl,
      });
    }

    if (plans.some((plan) => plan.changed)) {
      const verified = await readRuleset({ apiBaseUrl, apiToken, zoneId, fetchImpl });
      for (const ref of MANAGED_RULE_REFS) {
        const rule = findManagedRule(verified.rules, ref);
        const migration = migrateExpression({
          expression: rule.expression,
          ...fragments,
          ref,
        });
        if (migration.changed) {
          throw new Error(`managed Cloudflare rule ${ref} did not persist the canonical connector-origin class`);
        }
      }
    }

    return {
      status: plans.some((plan) => plan.changed) ? 'migrated' : 'unchanged',
      rulesetId: ruleset.id,
      rules: plans.map((plan) => ({
        ref: plan.ref,
        status: plan.changed ? 'updated' : 'unchanged',
      })),
    };
  } catch (error: unknown) {
    throw new Error(
      `managed OS MCP connector-origin class migration failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
};
