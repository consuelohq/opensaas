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

// click-to-call postMessage protocol — DEV-1206
export type GHLClickToCallContact = {
  phone: string;
  name: string | null;
  contactId: string | null;
};

export type GHLClickToCallMessage = {
  type: 'consuelo:click_to_call';
  contact: GHLClickToCallContact;
  autoDial: boolean;
  timestamp: string;
};

export type GHLDialerReadyMessage = {
  type: 'consuelo:dialer_ready';
};

export type GHLDialerBusyMessage = {
  type: 'consuelo:dialer_busy';
  callSid: string;
};

export type GHLBridgeMessage =
  | GHLClickToCallMessage
  | GHLDialerReadyMessage
  | GHLDialerBusyMessage;

export const GHL_MESSAGE_TYPES = {
  CLICK_TO_CALL: 'consuelo:click_to_call',
  DIALER_READY: 'consuelo:dialer_ready',
  DIALER_BUSY: 'consuelo:dialer_busy',
} as const;
