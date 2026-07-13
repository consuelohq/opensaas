import { createConnectorOriginHostnameRegexSource } from './connector-origin-hostname';

const MANAGED_RULE_IDENTITIES = [
  {
    ref: 'consuelo-os-mcp-provider-allow',
    description: 'Allow/skip trusted OS MCP provider traffic',
    action: 'skip',
  },
  {
    ref: 'consuelo-os-mcp-untrusted-block',
    description: 'Block untrusted OS MCP traffic',
    action: 'block',
  },
] as const;
const CUSTOM_RULESET_PHASE = 'http_request_firewall_custom';

type ManagedRuleIdentity = (typeof MANAGED_RULE_IDENTITIES)[number];
type ManagedRuleRef = ManagedRuleIdentity['ref'];

type CloudflareRule = {
  id: string;
  ref?: string;
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
  const ref = value.ref;
  if (
    ref !== undefined &&
    (typeof ref !== 'string' || !ref.trim())
  ) {
    throw new Error('Cloudflare managed rule has an invalid ref');
  }
  return {
    id: requiredString(value, 'id', 'Cloudflare managed rule'),
    ...(typeof ref === 'string' ? { ref } : {}),
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
  identity: ManagedRuleIdentity,
): { rule: CloudflareRule; identityChanged: boolean } => {
  const refMatches = rules.filter((rule) => rule.ref === identity.ref);
  if (refMatches.length > 1) {
    throw new Error(
      `expected at most one Cloudflare rule with ref ${identity.ref}`,
    );
  }

  const descriptionMatches = rules.filter(
    (rule) => rule.description === identity.description,
  );
  const refMatch = refMatches[0];
  if (refMatch) {
    const conflictingDescriptionMatches = descriptionMatches.filter(
      (rule) => rule.id !== refMatch.id,
    );
    if (conflictingDescriptionMatches.length > 0) {
      throw new Error(
        `conflicting Cloudflare rules identify managed rule ${identity.ref}`,
      );
    }
    if (refMatch.action !== identity.action) {
      throw new Error(
        `managed Cloudflare rule ${identity.ref} expected action ${identity.action} but found ${refMatch.action}`,
      );
    }
    return { rule: refMatch, identityChanged: false };
  }

  if (descriptionMatches.length !== 1) {
    throw new Error(
      `expected exactly one Cloudflare rule with ref ${identity.ref} or description ${identity.description}`,
    );
  }
  const descriptionMatch = descriptionMatches[0]!;
  if (descriptionMatch.action !== identity.action) {
    throw new Error(
      `managed Cloudflare rule ${identity.ref} expected action ${identity.action} but found ${descriptionMatch.action}`,
    );
  }
  return { rule: descriptionMatch, identityChanged: true };
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
  canonicalRef: ManagedRuleRef;
  expression: string;
  fetchImpl: typeof fetch;
}): Promise<void> => {
  try {
    const body = {
      ref: input.canonicalRef,
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
    await readCloudflareResult(response, `update managed rule ${input.canonicalRef}`);
  } catch (error: unknown) {
    throw new Error(
      `managed OS MCP rule ${input.canonicalRef} update failed: ${error instanceof Error ? error.message : String(error)}`,
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
    const plans = MANAGED_RULE_IDENTITIES.map((identity) => {
      const resolved = findManagedRule(ruleset.rules, identity);
      const migration = migrateExpression({
        expression: resolved.rule.expression,
        ...fragments,
        ref: identity.ref,
      });
      return {
        ref: identity.ref,
        rule: resolved.rule,
        expression: migration.expression,
        changed: resolved.identityChanged || migration.changed,
      };
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
        canonicalRef: plan.ref,
        expression: plan.expression,
        fetchImpl,
      });
    }

    if (plans.some((plan) => plan.changed)) {
      const verified = await readRuleset({ apiBaseUrl, apiToken, zoneId, fetchImpl });
      for (const identity of MANAGED_RULE_IDENTITIES) {
        const resolved = findManagedRule(verified.rules, identity);
        if (resolved.identityChanged) {
          throw new Error(
            `managed Cloudflare rule ${identity.ref} did not persist the canonical ref`,
          );
        }
        const migration = migrateExpression({
          expression: resolved.rule.expression,
          ...fragments,
          ref: identity.ref,
        });
        if (migration.changed) {
          throw new Error(`managed Cloudflare rule ${identity.ref} did not persist the canonical connector-origin class`);
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
