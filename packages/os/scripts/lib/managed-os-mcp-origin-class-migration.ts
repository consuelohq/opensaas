import { isDeepStrictEqual } from 'node:util';

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
  exposed_credential_check?: unknown;
  expression: string;
  logging?: unknown;
  ratelimit?: unknown;
};

type CloudflareRuleset = {
  id: string;
  name: string;
  description?: string;
  kind: string;
  phase: string;
  rules: CloudflareRule[];
};

type CloudflareWritableRule = {
  id?: string;
  ref?: string;
  description?: string;
  action: string;
  action_parameters?: unknown;
  enabled: boolean;
  exposed_credential_check?: unknown;
  expression: string;
  logging?: unknown;
  ratelimit?: unknown;
};

type CloudflareRulesetUpdate = {
  name: string;
  description?: string;
  kind: string;
  phase: string;
  rules: CloudflareWritableRule[];
};

type RuleMigration = {
  ref: ManagedRuleRef;
  status: 'updated' | 'unchanged' | 'planned';
};

type ManagedRulePlan = {
  ref: ManagedRuleRef;
  rule: CloudflareRule;
  expression: string;
  identityChanged: boolean;
  expressionChanged: boolean;
  changed: boolean;
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
    ...(value.exposed_credential_check !== undefined
      ? { exposed_credential_check: value.exposed_credential_check }
      : {}),
    ...(value.logging !== undefined ? { logging: value.logging } : {}),
    ...(value.ratelimit !== undefined ? { ratelimit: value.ratelimit } : {}),
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
      name: requiredString(result, 'name', 'Cloudflare custom ruleset'),
      ...(typeof result.description === 'string'
        ? { description: result.description }
        : {}),
      kind: requiredString(result, 'kind', 'Cloudflare custom ruleset'),
      phase: requiredString(result, 'phase', 'Cloudflare custom ruleset'),
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

const createWritableRule = (input: {
  rule: CloudflareRule;
  includeId: boolean;
  ref?: string;
  expression?: string;
}): CloudflareWritableRule => {
  const ref = input.ref ?? input.rule.ref;
  return {
    ...(input.includeId ? { id: input.rule.id } : {}),
    ...(ref !== undefined ? { ref } : {}),
    ...(input.rule.description !== undefined
      ? { description: input.rule.description }
      : {}),
    action: input.rule.action,
    ...(input.rule.action_parameters !== undefined
      ? { action_parameters: input.rule.action_parameters }
      : {}),
    enabled: input.rule.enabled,
    ...(input.rule.exposed_credential_check !== undefined
      ? { exposed_credential_check: input.rule.exposed_credential_check }
      : {}),
    expression: input.expression ?? input.rule.expression,
    ...(input.rule.logging !== undefined
      ? { logging: input.rule.logging }
      : {}),
    ...(input.rule.ratelimit !== undefined
      ? { ratelimit: input.rule.ratelimit }
      : {}),
  };
};

const createRulesetUpdate = (
  ruleset: CloudflareRuleset,
  plans: ManagedRulePlan[],
): CloudflareRulesetUpdate => {
  const planByRuleId = new Map(plans.map((plan) => [plan.rule.id, plan]));
  return {
    name: ruleset.name,
    ...(ruleset.description !== undefined
      ? { description: ruleset.description }
      : {}),
    kind: ruleset.kind,
    phase: ruleset.phase,
    rules: ruleset.rules.map((rule) => {
      const plan = planByRuleId.get(rule.id);
      if (!plan) return createWritableRule({ rule, includeId: true });
      return createWritableRule({
        rule,
        includeId: !plan.identityChanged,
        ref: plan.ref,
        expression: plan.expression,
      });
    }),
  };
};

const assertRulesetMatchesUpdate = (
  actual: CloudflareRuleset,
  expected: CloudflareRulesetUpdate,
): void => {
  const metadataMatches =
    actual.name === expected.name &&
    actual.description === expected.description &&
    actual.kind === expected.kind &&
    actual.phase === expected.phase;
  if (!metadataMatches || actual.rules.length !== expected.rules.length) {
    throw new Error(
      'Cloudflare ruleset did not preserve the ordered writable ruleset projection',
    );
  }

  for (let index = 0; index < expected.rules.length; index += 1) {
    const expectedRule = expected.rules[index]!;
    const actualRule = actual.rules[index]!;
    const actualWritable = createWritableRule({
      rule: actualRule,
      includeId: true,
    });
    if (expectedRule.id !== undefined) {
      if (!isDeepStrictEqual(actualWritable, expectedRule)) {
        throw new Error(
          `Cloudflare ruleset did not preserve the ordered writable ruleset projection at rule ${index}`,
        );
      }
      continue;
    }

    const { id: actualId, ...actualWithoutId } = actualWritable;
    if (
      typeof actualId !== 'string' ||
      !actualId.trim() ||
      !isDeepStrictEqual(actualWithoutId, expectedRule)
    ) {
      throw new Error(
        `Cloudflare ruleset did not preserve the ordered writable ruleset projection at replacement rule ${index}`,
      );
    }
  }
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
    const body = createWritableRule({
      rule: input.rule,
      includeId: false,
      ref: input.canonicalRef,
      expression: input.expression,
    });
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

const putRuleset = async (input: {
  apiBaseUrl: string;
  apiToken: string;
  zoneId: string;
  rulesetId: string;
  update: CloudflareRulesetUpdate;
  fetchImpl: typeof fetch;
}): Promise<void> => {
  try {
    const response = await input.fetchImpl(
      `${input.apiBaseUrl}/zones/${encodeURIComponent(input.zoneId)}/rulesets/${encodeURIComponent(input.rulesetId)}`,
      {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${input.apiToken}`,
          'content-type': 'application/json',
          'user-agent': 'consuelo-os-mcp-origin-class-migration/1.0',
        },
        body: JSON.stringify(input.update),
      },
    );
    await readCloudflareResult(response, 'replace managed OS MCP ruleset version');
  } catch (error: unknown) {
    throw new Error(
      `managed OS MCP ruleset replacement failed: ${error instanceof Error ? error.message : String(error)}`,
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
    const plans: ManagedRulePlan[] = MANAGED_RULE_IDENTITIES.map((identity) => {
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
        identityChanged: resolved.identityChanged,
        expressionChanged: migration.changed,
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

    const requiresRulesetReplacement = plans.some(
      (plan) => plan.identityChanged,
    );
    const rulesetUpdate = requiresRulesetReplacement
      ? createRulesetUpdate(ruleset, plans)
      : undefined;

    if (rulesetUpdate) {
      await putRuleset({
        apiBaseUrl,
        apiToken,
        zoneId,
        rulesetId: ruleset.id,
        update: rulesetUpdate,
        fetchImpl,
      });
    } else {
      for (const plan of plans) {
        if (!plan.expressionChanged) continue;
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
    }

    if (plans.some((plan) => plan.changed)) {
      const verified = await readRuleset({ apiBaseUrl, apiToken, zoneId, fetchImpl });
      if (rulesetUpdate) {
        assertRulesetMatchesUpdate(verified, rulesetUpdate);
      }
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
