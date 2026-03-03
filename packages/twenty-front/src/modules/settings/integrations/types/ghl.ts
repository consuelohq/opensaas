// GHL integration types — DEV-1094, DEV-1095

export type GHLSyncDirection = 'ghl-to-twenty' | 'twenty-to-ghl' | 'bidirectional';

export type GHLConflictResolution = 'newest' | 'ghl-wins' | 'twenty-wins';

// matches backend SyncLogEntry from ghl-sync.ts
export type GHLSyncLogEntry = {
  id: string;
  syncType: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  totalContacts: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  conflictCount: number;
  errorMessage?: string;
};

export type GHLSyncConfig = {
  direction: GHLSyncDirection;
  conflictResolution: GHLConflictResolution;
  autoSyncEnabled: boolean;
  autoSyncMinutes: number;
};

export type GHLPushSettings = {
  callOutcomes: boolean;
  contactUpdates: boolean;
  tags: boolean;
  notes: boolean;
};

export type GHLManualSyncProgress = {
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
};

export type GHLImportProgress = {
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
};

export type GHLFieldMapping = {
  id: string;
  ghlField: string;
  twentyField: string;
  direction: GHLSyncDirection;
};

export type GHLPipelineStage = {
  id: string;
  name: string;
  pipelineId: string;
  pipelineName: string;
};

export type TwentyPipelineStage = {
  id: string;
  name: string;
};

export type GHLPipelineStageMapping = {
  ghlStageId: string;
  ghlStageName: string;
  ghlPipelineId: string;
  ghlPipelineName: string;
  twentyStageId: string | null;
  twentyStageName: string | null;
};

export type GHLLoadingState = 'idle' | 'loading' | 'syncing' | 'importing' | 'saving';
