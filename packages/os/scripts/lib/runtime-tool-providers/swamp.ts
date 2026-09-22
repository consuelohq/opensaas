import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type {
  CommandPlan,
  RunnerResult,
  RuntimeProviderMetadata,
  ToolInput,
  ToolManifestEntry,
  ToolRunner,
} from '../facade/types';
import { getErrorMessage, isTimeoutError } from '../facade/errors';

type JsonObject = Record<string, unknown>;

export type SwampDiscoveryOptions = {
  cliPath: string;
  repoDir: string;
  env: NodeJS.ProcessEnv;
  discoveredAt: string;
  timeoutMs?: number;
  maxBufferBytes?: number;
};

type SwampExecutionOptions = {
  runner: ToolRunner;
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
};

export type SwampExecutionResult = {
  plan: CommandPlan;
  runResult: RunnerResult;
  data: unknown;
  timedOut: boolean;
  parseError?: string;
};

export type SwampDiscoveryResult =
  | { ok: true; tools: ToolManifestEntry[] }
  | { ok: false; failure: 'provider-unavailable' | 'incomplete' };

const DISCOVERY_TIMEOUT_MS = 2_000;
const DISCOVERY_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const RUNTIME_PROVIDER_PAYLOAD_FIELD = '__consueloRuntimeProviderPayload';

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function safeSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'tool';
}

function parseJsonOutput(stdout: string): { data: unknown; error?: string } {
  const trimmed = stdout.trim();
  if (!trimmed) return { data: null };
  try {
    return { data: JSON.parse(trimmed) as unknown };
  } catch {
    const parsed: unknown[] = [];
    for (const line of trimmed.split(/\r?\n/)) {
      const candidate = line.trim();
      if (!candidate) continue;
      try {
        parsed.push(JSON.parse(candidate) as unknown);
      } catch {
        // Swamp may emit non-JSON status lines around JSON mode.
      }
    }
    if (parsed.length === 1) return { data: parsed[0] };
    if (parsed.length > 1) return { data: parsed };
    return { data: null, error: 'Swamp returned output that was not valid JSON.' };
  }
}

function runDiscoveryCommand(
  options: SwampDiscoveryOptions,
  args: string[],
): { ok: true; data: unknown } | { ok: false } {
  const result = spawnSync(options.cliPath, args, {
    cwd: options.repoDir,
    env: { ...options.env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: options.timeoutMs ?? DISCOVERY_TIMEOUT_MS,
    maxBuffer: options.maxBufferBytes ?? DISCOVERY_MAX_BUFFER_BYTES,
    killSignal: 'SIGKILL',
  });
  if (result.error || result.status !== 0) return { ok: false };
  const parsed = parseJsonOutput(result.stdout || '');
  return parsed.error ? { ok: false } : { ok: true, data: parsed.data };
}

function resultArray(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isObject(value)) return [];
  for (const key of keys) {
    if (Array.isArray(value[key])) return value[key] as unknown[];
  }
  return [];
}

function objectSchema(value: unknown): JsonObject {
  return isObject(value)
    ? value
    : { type: 'object', properties: {}, additionalProperties: true };
}

function workflowInputSchema(value: unknown): JsonObject {
  if (!isObject(value)) {
    return { type: 'object', properties: {}, additionalProperties: false };
  }

  if (value.type === 'object' && isObject(value.properties)) {
    return value;
  }

  const properties = Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, JsonObject] => isObject(entry[1])),
  );
  const required = Object.entries(properties)
    .filter(([, schema]) => !Object.prototype.hasOwnProperty.call(schema, 'default'))
    .map(([name]) => name);

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };
}

function exampleFromSchema(schema: JsonObject): Record<string, unknown> {
  const properties = isObject(schema.properties) ? schema.properties : {};
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((value): value is string => typeof value === 'string')
      : [],
  );
  const example: Record<string, unknown> = {};
  for (const [key, rawProperty] of Object.entries(properties)) {
    if (!required.has(key) || !isObject(rawProperty)) continue;
    if ('default' in rawProperty) {
      example[key] = rawProperty.default;
      continue;
    }
    if (Array.isArray(rawProperty.enum) && rawProperty.enum.length > 0) {
      example[key] = rawProperty.enum[0];
      continue;
    }
    switch (rawProperty.type) {
      case 'boolean':
        example[key] = false;
        break;
      case 'integer':
      case 'number':
        example[key] = 0;
        break;
      case 'array':
        example[key] = [];
        break;
      case 'object':
        example[key] = {};
        break;
      default:
        example[key] = '<' + key + '>';
    }
  }
  return example;
}

function runtimeEntry(input: {
  name: string;
  description: string;
  metadata: RuntimeProviderMetadata;
}): ToolManifestEntry {
  return {
    name: input.name,
    methodPath: input.name.split('.'),
    description: input.description,
    category: 'swamp',
    underlying: input.metadata.kind === 'workflow'
      ? 'swamp workflow run ' + input.metadata.externalName
      : ('swamp model method run ' + input.metadata.externalName + ' ' + (input.metadata.operation ?? '')).trim(),
    capabilities: {
      readOnly: false,
      mutating: true,
      deterministic: false,
      safeToRetry: false,
    },
    defaultTimeout: 120_000,
    inputSchema: 'RuntimeProviderInput',
    outputSchema: 'RawOutput',
    command: {
      script: 'swamp',
      executionScope: 'runtime',
      branchMode: 'none',
      internal: 'runtime-provider',
      arguments: [],
    },
    exampleInput: exampleFromSchema(input.metadata.inputSchema),
    sessionRequired: false,
    runtimeProvider: input.metadata,
  };
}

export function discoverSwampRuntimeTools(
  options: SwampDiscoveryOptions,
): SwampDiscoveryResult {
  const modelSearch = runDiscoveryCommand(options, [
    'model',
    'search',
    '--repo-dir',
    options.repoDir,
    '--json',
  ]);
  if (!modelSearch.ok) return { ok: false, failure: 'provider-unavailable' };

  const tools: ToolManifestEntry[] = [];
  const seenNames = new Set<string>();

  for (const rawModel of resultArray(modelSearch.data, ['results', 'models'])) {
    if (!isObject(rawModel)) continue;
    const modelName = nonEmptyString(rawModel.name) ?? nonEmptyString(rawModel.id);
    if (!modelName || !Array.isArray(rawModel.methods)) continue;
    for (const rawMethod of rawModel.methods) {
      if (!isObject(rawMethod)) continue;
      const methodName = nonEmptyString(rawMethod.name);
      if (!methodName) continue;
      const baseName = 'swamp.model.' + safeSlug(modelName) + '.' + safeSlug(methodName);
      if (seenNames.has(baseName)) continue;
      seenNames.add(baseName);
      const inputSchema = objectSchema(rawMethod.arguments);
      tools.push(runtimeEntry({
        name: baseName,
        description: nonEmptyString(rawMethod.description)
          ?? ('Run ' + methodName + ' on Swamp model ' + modelName),
        metadata: {
          provider: 'swamp',
          kind: 'model-method',
          cliPath: options.cliPath,
          repoDir: options.repoDir,
          externalId: nonEmptyString(rawModel.id),
          externalName: modelName,
          operation: methodName,
          inputSchema,
          discoveredAt: options.discoveredAt,
        },
      }));
    }
  }

  const workflowSearch = runDiscoveryCommand(options, [
    'workflow',
    'search',
    '--repo-dir',
    options.repoDir,
    '--json',
  ]);
  if (!workflowSearch.ok) return { ok: false, failure: 'incomplete' };
  for (const rawWorkflow of resultArray(workflowSearch.data, ['results', 'workflows'])) {
    if (!isObject(rawWorkflow)) continue;
    const workflowName = nonEmptyString(rawWorkflow.name) ?? nonEmptyString(rawWorkflow.id);
    if (!workflowName) continue;
    const workflowGet = runDiscoveryCommand(options, [
      'workflow',
      'get',
      workflowName,
      '--repo-dir',
      options.repoDir,
      '--json',
    ]);
    if (!workflowGet.ok || !isObject(workflowGet.data)) {
      return { ok: false, failure: 'incomplete' };
    }
    const fullWorkflow = workflowGet.data;
    const baseName = 'swamp.workflow.' + safeSlug(workflowName) + '.run';
    if (seenNames.has(baseName)) continue;
    seenNames.add(baseName);
    const inputSchema = workflowInputSchema(fullWorkflow.inputs);
    tools.push(runtimeEntry({
      name: baseName,
      description: nonEmptyString(fullWorkflow.description)
        ?? nonEmptyString(rawWorkflow.description)
        ?? ('Run Swamp workflow ' + workflowName),
      metadata: {
        provider: 'swamp',
        kind: 'workflow',
        cliPath: options.cliPath,
        repoDir: options.repoDir,
        externalId: nonEmptyString(fullWorkflow.id) ?? nonEmptyString(rawWorkflow.id),
        externalName: workflowName,
        inputSchema,
        discoveredAt: options.discoveredAt,
      },
    }));
  }

  return { ok: true, tools };
}

const RUNTIME_CONTROL_FIELDS = new Set([
  'requestId',
  'taskSession',
  'workSession',
  'branch',
  'taskWorktree',
  'workSessionRoot',
  'dryRun',
  'timeout',
  'timeoutMs',
]);

function schemaPropertyNames(schema: JsonObject): Set<string> {
  return new Set(isObject(schema.properties) ? Object.keys(schema.properties) : []);
}

export function runtimeProviderPayloadForSchema(
  input: ToolInput,
  schema: JsonObject,
): ToolInput {
  const nestedPayload = input[RUNTIME_PROVIDER_PAYLOAD_FIELD];
  if (isObject(nestedPayload)) return nestedPayload;
  const providerFields = schemaPropertyNames(schema);
  return Object.fromEntries(
    Object.entries(input).filter(([key]) => !RUNTIME_CONTROL_FIELDS.has(key) || providerFields.has(key)),
  );
}

export function runtimeProviderExecutionInput(
  input: ToolInput,
  schema: JsonObject,
  parsedPayload: ToolInput,
): ToolInput {
  return {
    ...runtimeProviderFacadeControls(input, schema),
    [RUNTIME_PROVIDER_PAYLOAD_FIELD]: parsedPayload,
  };
}

export function runtimeProviderFacadeControls(
  input: ToolInput,
  schema: JsonObject,
): ToolInput {
  const providerFields = schemaPropertyNames(schema);
  return Object.fromEntries(
    Object.entries(input).filter(([key]) => RUNTIME_CONTROL_FIELDS.has(key) && !providerFields.has(key)),
  );
}

export async function executeSwampRuntimeTool(
  metadata: RuntimeProviderMetadata,
  input: ToolInput,
  options: SwampExecutionOptions,
): Promise<SwampExecutionResult> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-swamp-input-'));
  const inputFile = path.join(tempDir, 'input.json');
  fs.writeFileSync(inputFile, JSON.stringify(runtimeProviderPayloadForSchema(input, metadata.inputSchema), null, 2) + '\n', {
    mode: 0o600,
  });

  const args = metadata.kind === 'workflow'
    ? [
      'workflow',
      'run',
      metadata.externalName,
      '--input-file',
      inputFile,
      '--repo-dir',
      metadata.repoDir,
      '--json',
    ]
    : [
      'model',
      'method',
      'run',
      metadata.externalName,
      metadata.operation ?? '',
      '--input-file',
      inputFile,
      '--repo-dir',
      metadata.repoDir,
      '--json',
    ].filter((value) => value.length > 0);

  const plan: CommandPlan = {
    command: metadata.cliPath,
    args,
    cwd: metadata.repoDir,
    env: { ...options.env },
  };

  try {
    try {
      const runResult = await options.runner(plan, options.timeoutMs);
      const parsed = parseJsonOutput(runResult.stdout);
      return {
        plan,
        runResult,
        data: parsed.data,
        timedOut: false,
        ...(parsed.error ? { parseError: parsed.error } : {}),
      };
    } catch (error: unknown) {
      return {
        plan,
        runResult: {
          stdout: '',
          stderr: getErrorMessage(error),
          exitCode: 1,
        },
        data: null,
        timedOut: isTimeoutError(error),
      };
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
