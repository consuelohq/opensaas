export type PermissionLevel = 'read' | 'draft' | 'write' | 'execute' | 'external' | 'admin';

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

export type ArtifactDescriptor = {
  name: string;
  path?: string;
  url?: string;
  type?: string;
};

export type CallOutput = {
  ok: boolean;
  name: string;
  permission: PermissionLevel;
  traceId?: string;
  durationMs?: number;
  result?: unknown;
  artifacts?: ArtifactDescriptor[];
  proposedWrites?: unknown[];
  requiresApproval?: boolean;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type SkillContext = {
  workspaceId?: string;
  userId?: string;
  manifestEntry: OsManifestEntry;
};
