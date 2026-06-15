export type PermissionLevel = 'guidance' | 'read' | 'draft' | 'write' | 'execute' | 'external' | 'admin';

export type OsManifestEntry = {
  name: string;
  title: string;
  description: string;
  permission: PermissionLevel;
  requiresApproval: boolean;
  writesRecords: boolean;
  externalSideEffects: boolean;
  requiredEnv?: string[];
  requiredIntegrations?: string[];
  implementation: {
    script: string;
  };
  inputSchema?: unknown;
  outputSchema?: unknown;
};

export type CallInput = {
  name: string;
  input?: unknown;
  workspaceId?: string;
  userId?: string;
  traceId?: string;
};

export type SourceEnvelope = {
  id: string;
  title: string;
  kind: 'steering' | 'file' | 'search' | 'trace' | 'review' | 'verify' | 'pr' | 'commit' | 'tool' | 'audit';
  uri: string;
  summary: string;
  toolName?: string;
  traceId?: string;
  url?: string;
  lineStart?: number;
  lineEnd?: number;
  lines?: Array<{ line: number; text: string }>;
  metadata?: Record<string, unknown>;
};

export type ArtifactDescriptor = {
  id?: string;
  name: string;
  title?: string;
  path?: string;
  localPath?: string;
  url?: string;
  appUrl?: string;
  downloadUrl?: string;
  appFileId?: string;
  appAttachmentId?: string;
  storageKey?: string;
  cloud?: {
    provider: 'consuelo-app-files';
    fileId?: string;
    attachmentId?: string;
    storageKey?: string;
    appUrl?: string;
    downloadUrl?: string;
    workspaceId?: string;
  };
  type?: string;
  format?: string;
  status?: string;
  storageMode?: 'local' | 's3' | 'external';
  traceId?: string;
  skillName?: string;
  createdAt?: string;
  currentVersionId?: string;
  versionCount?: number;
};

export type CallOutput = {
  ok: boolean;
  name: string;
  permission: PermissionLevel;
  traceId?: string;
  durationMs?: number;
  result?: unknown;
  artifacts?: ArtifactDescriptor[];
  sources?: SourceEnvelope[];
  proposedWrites?: unknown[];
  requiresApproval?: boolean;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type SkillContext = {
  traceId: string;
  workspaceId?: string;
  userId?: string;
  manifestEntry: OsManifestEntry;
};

