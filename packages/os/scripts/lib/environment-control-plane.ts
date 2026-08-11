import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { Effect } from 'effect';

import { nodeResourceLockPath, withNodeResourceLock } from './node-resource-lock';
import {
  recordEnvironmentControlPlaneAuditEvent,
  type ControlPlaneAuditActor,
} from './control-plane-audit';

export type EnvironmentStatus = 'active' | 'inactive' | 'archived';

export type EnvironmentScope =
  | { kind: 'workspace' }
  | { kind: 'nodes'; nodeIds: string[] };

export type EnvironmentMetadataValue = string | number | boolean | null;

export type EnvironmentRecord = {
  environmentId: string;
  workspaceId: string;
  name: string;
  slug: string;
  label?: string;
  labels: string[];
  scope: EnvironmentScope;
  status: EnvironmentStatus;
  metadata: Record<string, EnvironmentMetadataValue>;
  createdAt: string;
  updatedAt: string;
};

export type EnvironmentSnapshot = {
  version: 1;
  workspaceId: string;
  generatedAt: string;
  environments: EnvironmentRecord[];
};

export type EnvironmentUpsertInput = {
  environmentId?: string;
  name: string;
  label?: string;
  labels?: string[];
  scope: EnvironmentScope;
  status?: EnvironmentStatus;
  metadata?: Record<string, EnvironmentMetadataValue>;
};

export type EnvironmentControlPlaneErrorCode =
  | 'InvalidInput'
  | 'SensitiveDataRejected'
  | 'WorkspaceMismatch'
  | 'EnvironmentNotFound'
  | 'PersistenceFailure'
  | 'AuditFailure';

export type EnvironmentControlPlaneError = {
  readonly _tag: 'EnvironmentControlPlaneError';
  readonly code: EnvironmentControlPlaneErrorCode;
  readonly message: string;
  readonly status: number;
};

type EnvironmentRegistryDocument = {
  version: 1;
  workspaceId: string;
  environments: EnvironmentRecord[];
};

type EnvironmentRepository = {
  read(workspaceId: string): Promise<EnvironmentRegistryDocument>;
  write(document: EnvironmentRegistryDocument): Promise<void>;
};

const SENSITIVE_KEY_PATTERN = /(^|[._-])(api[._-]?key|secret|token|password|credential|private[._-]?key|access[._-]?key|client[._-]?secret)($|[._-])/i;
const SENSITIVE_VALUE_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:sk|rk)_(?:live|test)_[^\s]{8,}/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*\b/i,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
] as const;

function environmentError(
  code: EnvironmentControlPlaneErrorCode,
  message: string,
  status = 500,
): EnvironmentControlPlaneError {
  return { _tag: 'EnvironmentControlPlaneError', code, message, status };
}

function isEnvironmentControlPlaneError(value: unknown): value is EnvironmentControlPlaneError {
  return Boolean(
    value
    && typeof value === 'object'
    && '_tag' in value
    && (value as { _tag?: unknown })._tag === 'EnvironmentControlPlaneError',
  );
}

function cleanString(value: unknown, field: string, maximum: number, required = false): string | undefined {
  if (value === undefined || value === null) {
    if (required) throw environmentError('InvalidInput', `${field} is required.`, 400);
    return undefined;
  }
  if (typeof value !== 'string') throw environmentError('InvalidInput', `${field} must be a string.`, 400);
  const trimmed = value.trim();
  if (required && trimmed.length === 0) throw environmentError('InvalidInput', `${field} is required.`, 400);
  if (trimmed.length > maximum) throw environmentError('InvalidInput', `${field} is too long.`, 400);
  return trimmed || undefined;
}

function assertNonSensitiveText(value: string, field: string): string {
  if (containsSensitiveValue(value)) {
    throw environmentError(
      'SensitiveDataRejected',
      `${field} cannot contain a credential or secret value.`,
      400,
    );
  }
  return value;
}

function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  if (!slug) throw environmentError('InvalidInput', 'Environment name must contain letters or numbers.', 400);
  return slug;
}

function validateIdentifier(value: string, field: string): string {
  const cleaned = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(cleaned)) {
    throw environmentError('InvalidInput', `${field} contains unsupported characters.`, 400);
  }
  return cleaned;
}

function validateLabels(labels: unknown): string[] {
  if (labels === undefined) return [];
  if (!Array.isArray(labels) || labels.length > 12) {
    throw environmentError('InvalidInput', 'Environment labels must be an array with at most 12 entries.', 400);
  }
  const normalized = labels
    .map((label) => assertNonSensitiveText(cleanString(label, 'Environment label', 48, true)!, 'Environment label'))
    .map((label) => label.toLowerCase());
  return [...new Set(normalized)];
}

function validateScope(scope: unknown): EnvironmentScope {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    throw environmentError('InvalidInput', 'Environment scope is required.', 400);
  }
  const candidate = scope as { kind?: unknown; nodeIds?: unknown };
  if (candidate.kind === 'workspace') return { kind: 'workspace' };
  if (candidate.kind !== 'nodes' || !Array.isArray(candidate.nodeIds) || candidate.nodeIds.length === 0 || candidate.nodeIds.length > 64) {
    throw environmentError('InvalidInput', 'Node-scoped environments require one to 64 node IDs.', 400);
  }
  const nodeIds = [...new Set(candidate.nodeIds.map((nodeId) => {
    if (typeof nodeId !== 'string') throw environmentError('InvalidInput', 'Environment node IDs must be strings.', 400);
    return assertNonSensitiveText(
      validateIdentifier(nodeId, 'Environment node ID'),
      'Environment node ID',
    );
  }))];
  return { kind: 'nodes', nodeIds };
}

function containsSensitiveValue(value: string): boolean {
  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function validateMetadata(metadata: unknown): Record<string, EnvironmentMetadataValue> {
  if (metadata === undefined) return {};
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw environmentError('InvalidInput', 'Environment metadata must be a JSON object.', 400);
  }
  const entries = Object.entries(metadata);
  if (entries.length > 64) throw environmentError('InvalidInput', 'Environment metadata may contain at most 64 fields.', 400);
  const output: Record<string, EnvironmentMetadataValue> = {};
  for (const [rawKey, value] of entries) {
    const key = rawKey.trim();
    if (!/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(key)) {
      throw environmentError('InvalidInput', 'Environment metadata keys must be stable configuration identifiers.', 400);
    }
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      throw environmentError('SensitiveDataRejected', 'Credentials and secret values cannot be stored in environment metadata.', 400);
    }
    if (value !== null && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      throw environmentError('InvalidInput', 'Environment metadata values must be strings, numbers, booleans, or null.', 400);
    }
    if (typeof value === 'string') {
      if (value.length > 500) throw environmentError('InvalidInput', 'Environment metadata string values are too long.', 400);
      if (containsSensitiveValue(value)) {
        throw environmentError('SensitiveDataRejected', 'Credentials and secret values cannot be stored in environment metadata.', 400);
      }
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw environmentError('InvalidInput', 'Environment metadata numbers must be finite.', 400);
    }
    output[key] = value;
  }
  return output;
}

function validateStatus(status: unknown): EnvironmentStatus {
  if (status === undefined) return 'active';
  if (status !== 'active' && status !== 'inactive' && status !== 'archived') {
    throw environmentError('InvalidInput', 'Environment status must be active, inactive, or archived.', 400);
  }
  return status;
}

function validateUpsertInput(input: EnvironmentUpsertInput): Omit<EnvironmentRecord, 'environmentId' | 'workspaceId' | 'createdAt' | 'updatedAt'> & { environmentId?: string } {
  const name = assertNonSensitiveText(
    cleanString(input.name, 'Environment name', 80, true)!,
    'Environment name',
  );
  const label = cleanString(input.label, 'Environment label', 160);
  const environmentId = input.environmentId === undefined
    ? undefined
    : validateIdentifier(input.environmentId, 'Environment ID');
  return {
    ...(environmentId ? { environmentId } : {}),
    name,
    slug: slugify(name),
    ...(label ? { label: assertNonSensitiveText(label, 'Environment label') } : {}),
    labels: validateLabels(input.labels),
    scope: validateScope(input.scope),
    status: validateStatus(input.status),
    metadata: validateMetadata(input.metadata),
  };
}

function validateTimestamp(value: unknown, field: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw environmentError('PersistenceFailure', `${field} is invalid in the environment registry.`, 500);
  }
  return value;
}

function normalizeStoredEnvironment(
  value: unknown,
  workspaceId: string,
): EnvironmentRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw environmentError('PersistenceFailure', 'Environment registry contains an invalid record.', 500);
  }
  const record = value as Partial<EnvironmentRecord>;
  if (record.workspaceId !== workspaceId) {
    throw environmentError('WorkspaceMismatch', 'Environment record belongs to another workspace.', 403);
  }
  const environmentId = typeof record.environmentId === 'string'
    ? validateIdentifier(record.environmentId, 'Environment ID')
    : (() => { throw environmentError('PersistenceFailure', 'Environment registry contains an invalid ID.', 500); })();
  let validated: ReturnType<typeof validateUpsertInput>;
  try {
    validated = validateUpsertInput({
      environmentId,
      name: record.name as string,
      ...(record.label === undefined ? {} : { label: record.label }),
      labels: record.labels,
      scope: record.scope as EnvironmentScope,
      status: record.status,
      metadata: record.metadata,
    });
  } catch (cause: unknown) {
    if (isEnvironmentControlPlaneError(cause) && cause.code === 'WorkspaceMismatch') throw cause;
    throw environmentError(
      isEnvironmentControlPlaneError(cause) && cause.code === 'SensitiveDataRejected'
        ? 'SensitiveDataRejected'
        : 'PersistenceFailure',
      isEnvironmentControlPlaneError(cause) && cause.code === 'SensitiveDataRejected'
        ? 'Environment registry contains a credential or secret value.'
        : 'Environment registry contains an invalid record.',
      isEnvironmentControlPlaneError(cause) && cause.code === 'SensitiveDataRejected' ? 400 : 500,
    );
  }
  if (record.slug !== validated.slug) {
    throw environmentError('PersistenceFailure', 'Environment registry contains an invalid slug.', 500);
  }
  return {
    environmentId,
    workspaceId,
    name: validated.name,
    slug: validated.slug,
    ...(validated.label ? { label: validated.label } : {}),
    labels: validated.labels,
    scope: validated.scope,
    status: validated.status,
    metadata: validated.metadata,
    createdAt: validateTimestamp(record.createdAt, 'Environment createdAt'),
    updatedAt: validateTimestamp(record.updatedAt, 'Environment updatedAt'),
  };
}

export function environmentRegistryPath(home: string): string {
  return path.join(home, 'config', 'environments.json');
}

function createFileEnvironmentRepository(home: string): EnvironmentRepository {
  const registryPath = environmentRegistryPath(home);
  return {
    async read(workspaceId: string): Promise<EnvironmentRegistryDocument> {
      if (!fs.existsSync(registryPath)) return { version: 1, workspaceId, environments: [] };
      let parsed: EnvironmentRegistryDocument;
      try {
        parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as EnvironmentRegistryDocument;
      } catch {
        throw environmentError('PersistenceFailure', 'Environment registry could not be read.', 500);
      }
      if (parsed.version !== 1 || !Array.isArray(parsed.environments) || typeof parsed.workspaceId !== 'string') {
        throw environmentError('PersistenceFailure', 'Environment registry has an unsupported format.', 500);
      }
      if (parsed.workspaceId !== workspaceId) {
        throw environmentError('WorkspaceMismatch', 'Environment registry belongs to another workspace.', 403);
      }
      return {
        version: 1,
        workspaceId: parsed.workspaceId,
        environments: parsed.environments.map((environment) =>
          normalizeStoredEnvironment(environment, parsed.workspaceId)),
      };
    },
    async write(document: EnvironmentRegistryDocument): Promise<void> {
      const directory = path.dirname(registryPath);
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      try { fs.chmodSync(directory, 0o700); } catch { /* best effort on unsupported filesystems */ }
      const temporaryPath = `${registryPath}.${process.pid}.${randomUUID()}.tmp`;
      fs.writeFileSync(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600 });
      fs.renameSync(temporaryPath, registryPath);
      try { fs.chmodSync(registryPath, 0o600); } catch { /* best effort on unsupported filesystems */ }
    },
  };
}

function snapshot(document: EnvironmentRegistryDocument): EnvironmentSnapshot {
  return {
    version: 1,
    workspaceId: document.workspaceId,
    generatedAt: new Date().toISOString(),
    environments: document.environments.map((environment) => ({
      ...environment,
      labels: [...environment.labels],
      scope: environment.scope.kind === 'nodes'
        ? { kind: 'nodes', nodeIds: [...environment.scope.nodeIds] }
        : { kind: 'workspace' },
      metadata: { ...environment.metadata },
    })),
  };
}

export function listEnvironmentSnapshotEffect(input: {
  home: string;
  workspaceId: string;
}): Effect.Effect<EnvironmentSnapshot, EnvironmentControlPlaneError> {
  return Effect.tryPromise({
    try: () => createFileEnvironmentRepository(input.home)
      .read(input.workspaceId)
      .then(snapshot),
    catch: (cause: unknown) => isEnvironmentControlPlaneError(cause)
      ? cause
      : environmentError('PersistenceFailure', 'Environment registry could not be read.', 500),
  });
}

export function upsertEnvironmentEffect(input: {
  home: string;
  workspaceId: string;
  actor: ControlPlaneAuditActor;
  input: EnvironmentUpsertInput;
}): Effect.Effect<{ created: boolean; environment: EnvironmentRecord; snapshot: EnvironmentSnapshot }, EnvironmentControlPlaneError> {
  return Effect.tryPromise({
    try: () => withNodeResourceLock({
      lockPath: nodeResourceLockPath(environmentRegistryPath(input.home)),
      operationId: `environment:${input.workspaceId}`,
    }, async () => {
      try {
        if (input.actor.workspaceId !== input.workspaceId) {
          throw environmentError('WorkspaceMismatch', 'Environment actor belongs to another workspace.', 403);
        }
        const validated = validateUpsertInput(input.input);
        const repository = createFileEnvironmentRepository(input.home);
        const document = await repository.read(input.workspaceId);
        const existingIndex = validated.environmentId
          ? document.environments.findIndex((environment) => environment.environmentId === validated.environmentId)
          : -1;
        if (validated.environmentId && existingIndex < 0) {
          throw environmentError('EnvironmentNotFound', 'Environment record was not found.', 404);
        }
        const duplicate = document.environments.find((environment, index) => (
          environment.slug === validated.slug && index !== existingIndex
        ));
        if (duplicate) throw environmentError('InvalidInput', 'Environment names must be unique within a workspace.', 400);
        const now = new Date().toISOString();
        const created = existingIndex < 0;
        const existing = existingIndex >= 0 ? document.environments[existingIndex] : undefined;
        const environment: EnvironmentRecord = {
          environmentId: existing?.environmentId ?? `env_${randomUUID().replaceAll('-', '')}`,
          workspaceId: input.workspaceId,
          name: validated.name,
          slug: validated.slug,
          ...(validated.label ? { label: validated.label } : {}),
          labels: validated.labels,
          scope: validated.scope,
          status: validated.status,
          metadata: validated.metadata,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        if (existingIndex >= 0) document.environments[existingIndex] = environment;
        else document.environments.push(environment);
        document.environments.sort((left, right) => left.name.localeCompare(right.name));
        await repository.write(document);
        try {
          recordEnvironmentControlPlaneAuditEvent({
            home: input.home,
            actor: input.actor,
            event: created ? 'environment.created' : 'environment.updated',
            environment,
          });
        } catch (cause: unknown) {
          throw environmentError('AuditFailure', 'Environment audit event could not be recorded.', 500);
        }
        return { created, environment, snapshot: snapshot(document) };
      } catch (cause: unknown) {
        throw cause;
      }
    }),
    catch: (cause: unknown) => isEnvironmentControlPlaneError(cause)
      ? cause
      : environmentError('PersistenceFailure', 'Environment record could not be persisted.', 500),
  });
}

export function deleteEnvironmentEffect(input: {
  home: string;
  workspaceId: string;
  actor: ControlPlaneAuditActor;
  environmentId: string;
}): Effect.Effect<{ deletedEnvironmentId: string; snapshot: EnvironmentSnapshot }, EnvironmentControlPlaneError> {
  return Effect.tryPromise({
    try: () => withNodeResourceLock({
      lockPath: nodeResourceLockPath(environmentRegistryPath(input.home)),
      operationId: `environment:${input.workspaceId}`,
    }, async () => {
      try {
        if (input.actor.workspaceId !== input.workspaceId) {
          throw environmentError('WorkspaceMismatch', 'Environment actor belongs to another workspace.', 403);
        }
        const environmentId = validateIdentifier(input.environmentId, 'Environment ID');
        const repository = createFileEnvironmentRepository(input.home);
        const document = await repository.read(input.workspaceId);
        const index = document.environments.findIndex((environment) => environment.environmentId === environmentId);
        if (index < 0) throw environmentError('EnvironmentNotFound', 'Environment record was not found.', 404);
        const [environment] = document.environments.splice(index, 1);
        if (!environment) throw environmentError('EnvironmentNotFound', 'Environment record was not found.', 404);
        await repository.write(document);
        try {
          recordEnvironmentControlPlaneAuditEvent({
            home: input.home,
            actor: input.actor,
            event: 'environment.deleted',
            environment,
          });
        } catch (cause: unknown) {
          throw environmentError('AuditFailure', 'Environment audit event could not be recorded.', 500);
        }
        return { deletedEnvironmentId: environment.environmentId, snapshot: snapshot(document) };
      } catch (cause: unknown) {
        throw cause;
      }
    }),
    catch: (cause: unknown) => isEnvironmentControlPlaneError(cause)
      ? cause
      : environmentError('PersistenceFailure', 'Environment record could not be deleted.', 500),
  });
}
