export type WorkspaceSnapshotStatus =
  | 'ok'
  | 'empty_workspace'
  | 'missing_capability'
  | 'auth_failed'
  | 'query_failed'
  | 'schema_gap';

export type WorkspaceSnapshotInput = {
  limit?: number;
  includeFiles?: boolean;
  includeAttachments?: boolean;
};

export type WorkspaceObjectRef = {
  id: string;
  type: string;
  label?: string;
  url?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
};

export type WorkspaceFileRef = WorkspaceObjectRef & {
  type: 'file';
  mimeType?: string;
  size?: number;
  storageKey?: string;
  downloadUrl?: string;
  category?: string;
  createdBy?: unknown;
};

export type WorkspaceAttachmentRef = WorkspaceObjectRef & {
  type: 'attachment';
  file?: unknown;
  fileId?: string;
  fileCategory?: string;
  target?: WorkspaceObjectRef;
  createdBy?: unknown;
};

export type WorkspaceSnapshot = {
  status: WorkspaceSnapshotStatus;
  safeMessage?: string;
  source: {
    mode: 'graphql';
    urlHost?: string;
    workspaceId?: string;
    userId?: string;
  };
  workspace: WorkspaceObjectRef | null;
  people: WorkspaceObjectRef[];
  companies: WorkspaceObjectRef[];
  lists: WorkspaceObjectRef[];
  calls: WorkspaceObjectRef[];
  files: WorkspaceFileRef[];
  attachments: WorkspaceAttachmentRef[];
  tasks: WorkspaceObjectRef[];
  notes: WorkspaceObjectRef[];
  workflows: WorkspaceObjectRef[];
  workflowRuns: WorkspaceObjectRef[];
  dashboards: WorkspaceObjectRef[];
  artifacts: WorkspaceObjectRef[];
  recentActivity: WorkspaceObjectRef[];
  counts: Record<string, number>;
  warnings: string[];
};

type GraphQLError = { message?: string };
type GraphQLResponse = { data?: unknown; errors?: GraphQLError[] };

type GraphQLRequestOptions = {
  query?: string;
  variables?: Record<string, unknown>;
  limit?: number;
  workspaceId?: string;
  userId?: string;
};

const DEFAULT_SNAPSHOT_QUERY = `
query ConsueloOsWorkspaceSnapshot($limit: Int!) {
  __typename
  workspace { id name displayName }
  people(first: $limit) { nodes { id name firstName lastName email createdAt updatedAt } }
  companies(first: $limit) { nodes { id name domainName createdAt updatedAt } }
  lists(first: $limit) { nodes { id name createdAt updatedAt } }
  calls(first: $limit) { nodes { id name title createdAt updatedAt } }
  files(first: $limit) { nodes { id name mimeType mime_type size storageKey storage_key downloadUrl url createdAt updatedAt } }
  attachments(first: $limit) { nodes { id name file fileId fileCategory createdBy targetTaskId targetNoteId targetPersonId targetCompanyId targetOpportunityId targetDashboardId targetWorkflowId createdAt updatedAt } }
  tasks(first: $limit) { nodes { id title name status createdAt updatedAt } }
  notes(first: $limit) { nodes { id title name body createdAt updatedAt } }
  workflows(first: $limit) { nodes { id name createdAt updatedAt } }
  workflowRuns(first: $limit) { nodes { id name status createdAt updatedAt } }
  dashboards(first: $limit) { nodes { id title name createdAt updatedAt } }
}`;

function getUrlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid-url';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function collectionToArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  if (Array.isArray(value.nodes)) return value.nodes;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.records)) return value.records;
  if (Array.isArray(value.edges)) {
    return value.edges
      .map((edge) => isRecord(edge) ? edge.node ?? edge.item ?? edge.record : edge)
      .filter((item) => item != null);
  }
  return [];
}

function readCollection(data: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const items = collectionToArray(data[key]);
    if (items.length > 0) return items;
  }
  return [];
}

function displayLabel(record: Record<string, unknown>): string | undefined {
  const direct = asString(record.name) ?? asString(record.title) ?? asString(record.displayName) ?? asString(record.label) ?? asString(record.email);
  if (direct) return direct;
  const firstName = asString(record.firstName);
  const lastName = asString(record.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName.length > 0 ? fullName : undefined;
}

function recordId(record: Record<string, unknown>): string | undefined {
  return asString(record.id) ?? asString(record.fileId) ?? asString(record.uuid) ?? asString(record.recordId);
}

function objectRef(record: unknown, type: string): WorkspaceObjectRef | null {
  if (!isRecord(record)) return null;
  const id = recordId(record);
  if (!id) return null;
  const metadata: Record<string, unknown> = {};
  for (const key of ['status', 'domainName', 'mimeType', 'mime_type', 'storageKey', 'storage_key']) {
    if (record[key] != null) metadata[key] = record[key];
  }
  return {
    id,
    type,
    label: displayLabel(record),
    url: asString(record.url) ?? asString(record.downloadUrl),
    createdAt: asString(record.createdAt),
    updatedAt: asString(record.updatedAt),
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

function fileRef(record: unknown): WorkspaceFileRef | null {
  const base = objectRef(record, 'file');
  if (!base || !isRecord(record)) return null;
  return {
    ...base,
    type: 'file',
    mimeType: asString(record.mimeType) ?? asString(record.mime_type),
    size: asNumber(record.size),
    storageKey: asString(record.storageKey) ?? asString(record.storage_key),
    downloadUrl: asString(record.downloadUrl) ?? asString(record.url),
    category: asString(record.fileCategory) ?? asString(record.category),
    createdBy: record.createdBy,
  };
}

function attachmentTarget(record: Record<string, unknown>): WorkspaceObjectRef | undefined {
  const targetFields: Array<[string, string]> = [
    ['targetTaskId', 'task'],
    ['targetNoteId', 'note'],
    ['targetPersonId', 'person'],
    ['targetCompanyId', 'company'],
    ['targetOpportunityId', 'opportunity'],
    ['targetDashboardId', 'dashboard'],
    ['targetWorkflowId', 'workflow'],
  ];
  for (const [field, type] of targetFields) {
    const id = asString(record[field]);
    if (id) return { id, type };
  }
  for (const [field, type] of [
    ['targetTask', 'task'],
    ['targetNote', 'note'],
    ['targetPerson', 'person'],
    ['targetCompany', 'company'],
    ['targetOpportunity', 'opportunity'],
    ['targetDashboard', 'dashboard'],
    ['targetWorkflow', 'workflow'],
  ] as Array<[string, string]>) {
    const ref = objectRef(record[field], type);
    if (ref) return ref;
  }
  return undefined;
}

function attachmentRef(record: unknown): WorkspaceAttachmentRef | null {
  const base = objectRef(record, 'attachment');
  if (!base || !isRecord(record)) return null;
  const file = record.file;
  const fileId = asString(record.fileId) ?? (Array.isArray(file) && isRecord(file[0]) ? asString(file[0].fileId) ?? asString(file[0].id) : undefined);
  return {
    ...base,
    type: 'attachment',
    file,
    fileId,
    fileCategory: asString(record.fileCategory),
    target: attachmentTarget(record),
    createdBy: record.createdBy,
  };
}

function compactRefs(items: unknown[], type: string): WorkspaceObjectRef[] {
  return items.map((item) => objectRef(item, type)).filter((item): item is WorkspaceObjectRef => item != null);
}

function compactFiles(items: unknown[]): WorkspaceFileRef[] {
  return items.map(fileRef).filter((item): item is WorkspaceFileRef => item != null);
}

function compactAttachments(items: unknown[]): WorkspaceAttachmentRef[] {
  return items.map(attachmentRef).filter((item): item is WorkspaceAttachmentRef => item != null);
}

function classifyErrors(errors: GraphQLError[] | undefined): { status: WorkspaceSnapshotStatus; message: string } {
  const message = errors?.map((error) => error.message ?? '').join(' ').trim() || 'GraphQL returned errors.';
  const lower = message.toLowerCase();
  if (lower.includes('cannot query field') || lower.includes('unknown type') || lower.includes('schema')) {
    return { status: 'schema_gap', message: message.slice(0, 240) };
  }
  if (lower.includes('unauthorized') || lower.includes('forbidden') || lower.includes('authentication')) {
    return { status: 'auth_failed', message: message.slice(0, 240) };
  }
  return { status: 'query_failed', message: message.slice(0, 240) };
}

function emptySnapshot(status: WorkspaceSnapshotStatus, input: { workspaceId?: string; userId?: string; urlHost?: string; safeMessage?: string }): WorkspaceSnapshot {
  return {
    status,
    safeMessage: input.safeMessage,
    source: {
      mode: 'graphql',
      urlHost: input.urlHost,
      workspaceId: input.workspaceId,
      userId: input.userId,
    },
    workspace: null,
    people: [],
    companies: [],
    lists: [],
    calls: [],
    files: [],
    attachments: [],
    tasks: [],
    notes: [],
    workflows: [],
    workflowRuns: [],
    dashboards: [],
    artifacts: [],
    recentActivity: [],
    counts: {},
    warnings: input.safeMessage ? [input.safeMessage] : [],
  };
}

function buildSnapshot(data: Record<string, unknown>, input: { workspaceId?: string; userId?: string; urlHost?: string }): WorkspaceSnapshot {
  const workspace = objectRef(data.workspace ?? data.currentWorkspace ?? data.organization, 'workspace') ??
    (input.workspaceId ? { id: input.workspaceId, type: 'workspace' } : null);
  const snapshot = {
    status: 'ok' as WorkspaceSnapshotStatus,
    source: {
      mode: 'graphql' as const,
      urlHost: input.urlHost,
      workspaceId: workspace?.id ?? input.workspaceId,
      userId: input.userId,
    },
    workspace,
    people: compactRefs(readCollection(data, ['people', 'contacts', 'workspaceMembers']), 'person'),
    companies: compactRefs(readCollection(data, ['companies', 'accounts']), 'company'),
    lists: compactRefs(readCollection(data, ['lists']), 'list'),
    calls: compactRefs(readCollection(data, ['calls', 'callRecords']), 'call'),
    files: compactFiles(readCollection(data, ['files', 'workspaceFiles'])),
    attachments: compactAttachments(readCollection(data, ['attachments', 'fileAttachments'])),
    tasks: compactRefs(readCollection(data, ['tasks']), 'task'),
    notes: compactRefs(readCollection(data, ['notes']), 'note'),
    workflows: compactRefs(readCollection(data, ['workflows']), 'workflow'),
    workflowRuns: compactRefs(readCollection(data, ['workflowRuns', 'workflowRunRecords']), 'workflowRun'),
    dashboards: compactRefs(readCollection(data, ['dashboards']), 'dashboard'),
    artifacts: compactRefs(readCollection(data, ['artifacts', 'outputs']), 'artifact'),
    recentActivity: compactRefs(readCollection(data, ['recentActivity', 'activities', 'timeline']), 'activity'),
    counts: {} as Record<string, number>,
    warnings: [] as string[],
  };
  for (const key of ['people', 'companies', 'lists', 'calls', 'files', 'attachments', 'tasks', 'notes', 'workflows', 'workflowRuns', 'dashboards', 'artifacts', 'recentActivity'] as const) {
    snapshot.counts[key] = snapshot[key].length;
  }
  const hasData = Object.values(snapshot.counts).some((count) => count > 0);
  if (!hasData) snapshot.status = 'empty_workspace';
  return snapshot;
}

export async function fetchConsueloWorkspaceSnapshot(options: GraphQLRequestOptions = {}): Promise<WorkspaceSnapshot> {
  const url = (process.env.CONSUELO_APP_GRAPHQL_URL ?? process.env.CONSUELO_GRAPHQL_URL);
  const apiKey = (process.env.CONSUELO_APP_GRAPHQL_API_KEY ?? process.env.CONSUELO_INTERNAL_GRAPHQL_API_KEY);
  const workspaceId = options.workspaceId ?? process.env.CONSUELO_WORKSPACE_ID;
  const userId = options.userId ?? process.env.CONSUELO_USER_ID;
  const urlHost = url ? getUrlHost(url) : undefined;
  if (!url || !apiKey) {
    return emptySnapshot('missing_capability', {
      workspaceId,
      userId,
      urlHost,
      safeMessage: 'CONSUELO_GRAPHQL_URL or CONSUELO_INTERNAL_GRAPHQL_API_KEY is missing.',
    });
  }
  try {
    const limit = Math.max(1, Math.min(options.limit ?? 25, 100));
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query: options.query ?? process.env.CONSUELO_WORKSPACE_SNAPSHOT_QUERY ?? DEFAULT_SNAPSHOT_QUERY,
        variables: { limit, workspaceId, ...(options.variables ?? {}) },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json().catch(() => ({})) as GraphQLResponse;
    if (!response.ok) {
      return emptySnapshot(response.status === 401 || response.status === 403 ? 'auth_failed' : 'query_failed', {
        workspaceId,
        userId,
        urlHost,
        safeMessage: `GraphQL HTTP ${response.status}`,
      });
    }
    if (body.errors?.length) {
      const classified = classifyErrors(body.errors);
      return emptySnapshot(classified.status, { workspaceId, userId, urlHost, safeMessage: classified.message });
    }
    if (!isRecord(body.data)) {
      return emptySnapshot('empty_workspace', { workspaceId, userId, urlHost });
    }
    return buildSnapshot(body.data, { workspaceId, userId, urlHost });
  } catch (error: unknown) {
    return emptySnapshot('query_failed', {
      workspaceId,
      userId,
      urlHost,
      safeMessage: error instanceof Error ? error.message.slice(0, 240) : 'Workspace snapshot query failed.',
    });
  }
}
