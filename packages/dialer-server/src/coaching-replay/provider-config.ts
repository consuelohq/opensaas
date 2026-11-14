import { SYNTHETIC_LIFE_INSURANCE } from '../coaching/playbooks';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  BudgetError,
  reservationPerRequest,
  type BudgetConfig,
} from './provider-budget';

export type ProviderBenchmarkConfig = BudgetConfig & {
  schemaVersion: 1;
  scenarioCount: number;
  providerRevision: string;
  allowedResponseModels: readonly string[];
  allowedResponseProviderNames: readonly string[];
  transportRevision: string;
  pricingSource: string;
  pricingAsOf: string;
};
const name = (x: unknown): x is string =>
  typeof x === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,255}$/.test(x);
const uniqueNames = (x: unknown): x is string[] =>
  Array.isArray(x) &&
  x.length > 0 &&
  x.length <= 8 &&
  x.every(name) &&
  new Set(x).size === x.length;
export function parseProviderConfig(value: unknown): ProviderBenchmarkConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BudgetError('CONFIG');
  const c = value as Record<string, unknown>;
  const keys = [
    'schemaVersion',
    'model',
    'providerRevision',
    'allowedRequestProviderTags',
    'allowedResponseModels',
    'allowedResponseProviderNames',
    'transportRevision',
    'scenarioCount',
    'maxRequests',
    'maxReservedNanoUsd',
    'contextWindowTokens',
    'inputNanoUsdPerMillion',
    'outputNanoUsdPerMillion',
    'maxPromptNanoUsdPerMillion',
    'maxCompletionNanoUsdPerMillion',
    'pricingSource',
    'pricingAsOf',
  ];
  if (
    Object.keys(c).length !== keys.length ||
    keys.some((k) => !Object.hasOwn(c, k)) ||
    c.schemaVersion !== 1 ||
    !name(c.model) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*\/[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(
      String(c.model),
    ) ||
    !name(c.providerRevision) ||
    !uniqueNames(c.allowedRequestProviderTags) ||
    !uniqueNames(c.allowedResponseModels) ||
    !uniqueNames(c.allowedResponseProviderNames) ||
    !name(c.transportRevision) ||
    !Number.isSafeInteger(c.scenarioCount) ||
    Number(c.scenarioCount) < 1 ||
    Number(c.scenarioCount) > 108 ||
    c.maxRequests !== c.scenarioCount ||
    typeof c.pricingSource !== 'string' ||
    typeof c.pricingAsOf !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(c.pricingAsOf) ||
    !Number.isFinite(Date.parse(c.pricingAsOf + 'T00:00:00Z'))
  )
    throw new BudgetError('CONFIG');
  try {
    if (new URL(c.pricingSource).protocol !== 'https:') throw new Error();
  } catch {
    throw new BudgetError('CONFIG');
  }
  const result = c as ProviderBenchmarkConfig;
  const perRequest = reservationPerRequest(result);
  // The cap may stop a full cohort early; reservations are enforced per request.
  if (
    BigInt(perRequest) * BigInt(result.maxRequests) >
    BigInt(Number.MAX_SAFE_INTEGER)
  )
    throw new BudgetError('CONFIG');
  // Canonical order and copied arrays bind the complete reviewed configuration.
  return Object.freeze({
    schemaVersion: 1,
    model: result.model,
    providerRevision: result.providerRevision,
    allowedRequestProviderTags: Object.freeze([
      ...result.allowedRequestProviderTags,
    ]),
    allowedResponseModels: Object.freeze([...result.allowedResponseModels]),
    allowedResponseProviderNames: Object.freeze([
      ...result.allowedResponseProviderNames,
    ]),
    transportRevision: result.transportRevision,
    scenarioCount: result.scenarioCount,
    maxRequests: result.maxRequests,
    maxReservedNanoUsd: result.maxReservedNanoUsd,
    contextWindowTokens: result.contextWindowTokens,
    inputNanoUsdPerMillion: result.inputNanoUsdPerMillion,
    outputNanoUsdPerMillion: result.outputNanoUsdPerMillion,
    maxPromptNanoUsdPerMillion: result.maxPromptNanoUsdPerMillion,
    maxCompletionNanoUsdPerMillion: result.maxCompletionNanoUsdPerMillion,
    pricingSource: result.pricingSource,
    pricingAsOf: result.pricingAsOf,
  });
}
const sha = (value: string | Uint8Array) =>
  createHash('sha256').update(value).digest('hex');
export type SourceSnapshot = {
  bunVersion: string;
  files: readonly { path: string; sha256: string }[];
};
export function captureSourceSnapshot(root: string): SourceSnapshot {
  const fixture = readFileSync(
    join(root, 'packages/dialer-server/src/coaching-replay/fixtures.ts'),
  );
  const fixtureBlob = createHash('sha1')
    .update('blob ' + fixture.length + '\0')
    .update(fixture)
    .digest('hex');
  const independent = sha(
    readFileSync(
      join(
        root,
        'packages/dialer-server/src/coaching-replay/independent-cases.json',
      ),
    ),
  );
  if (
    fixtureBlob !== '1804de6079e69cb8f9894cfc6ccd8da856f06015' ||
    independent !==
      'f9636b98b4512d102bb46013d8e4f7567f32b6090c0fb5d798184614cf58fde6'
  )
    throw new BudgetError('INTEGRITY');
  const roots = [
    'packages/dialer-server/src/coaching',
    'packages/dialer-server/src/coaching-replay',
    'packages/conversation/dist',
  ];
  const files: { path: string; sha256: string }[] = [];
  const visit = (absolute: string) => {
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new BudgetError('INTEGRITY');
    if (stat.isDirectory()) {
      for (const child of readdirSync(absolute).sort())
        visit(join(absolute, child));
      return;
    }
    if (!stat.isFile()) throw new BudgetError('INTEGRITY');
    const path = relative(root, absolute);
    if (path.endsWith('.ts') || path.endsWith('.js') || path.endsWith('.json'))
      files.push({ path, sha256: sha(readFileSync(absolute)) });
  };
  for (const path of roots) visit(join(root, path));
  files.push({
    path: 'packages/conversation/package.json',
    sha256: sha(readFileSync(join(root, 'packages/conversation/package.json'))),
  });
  files.push({
    path: '@runtime/SYNTHETIC_LIFE_INSURANCE',
    sha256: sha(JSON.stringify(SYNTHETIC_LIFE_INSURANCE)),
  });
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { bunVersion: Bun.version, files };
}
export function configurationFingerprint(
  config: ProviderBenchmarkConfig,
  snapshot: SourceSnapshot,
  outputDirectory: string,
): string {
  return sha(JSON.stringify({ config, snapshot, outputDirectory }));
}
export function authorizeProviderRun(input: {
  optIn: string | undefined;
  config: unknown;
  snapshot: SourceSnapshot;
  expectedFingerprint: string | undefined;
  outputDirectory: string;
}) {
  if (
    input.optIn !== '1' ||
    !input.expectedFingerprint ||
    !/^[a-f0-9]{64}$/.test(input.expectedFingerprint)
  )
    throw new BudgetError('CONFIG');
  const config = parseProviderConfig(input.config);
  const fingerprint = configurationFingerprint(
    config,
    input.snapshot,
    input.outputDirectory,
  );
  if (fingerprint !== input.expectedFingerprint)
    throw new BudgetError('INTEGRITY');
  return { config, fingerprint };
}
