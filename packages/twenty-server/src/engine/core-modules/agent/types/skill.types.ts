// skill definition schema — DEV-945
// shared types used by execution engine (DEV-946), CRUD API (DEV-947), and storage layer (DEV-948)

export type SkillCategory =
  | 'analysis'
  | 'automation'
  | 'preparation'
  | 'logging'
  | 'communication'
  | 'custom';

export type SkillOutputFormat =
  | 'text'
  | 'chart'
  | 'table'
  | 'report'
  | 'action'
  | 'mixed';

export type SkillTriggerType =
  | 'manual'
  | 'on_call_start'
  | 'on_call_end'
  | 'on_deal_change'
  | 'scheduled'
  | 'on_new_contact';

export type SkillIntegrationRequirement = {
  integrationId: string;
  required: boolean;
  reason: string;
};

export type Skill = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: SkillCategory;
  type: 'pre-built' | 'custom';
  tools: string[];
  systemPrompt: string;
  sandboxTemplate?: string;
  triggers: SkillTriggerType[];
  inputSchema?: Record<string, unknown>;
  outputFormat: SkillOutputFormat;
  integrations: SkillIntegrationRequirement[];
  useWhen: string[];
  dontUseWhen: string[];
  version: number;
  createdBy: 'system' | string;
  workspaceId: string;
  folderId?: string;
  isPublic: boolean;
  sandboxTimeoutMs: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SkillFolder = {
  id: string;
  name: string;
  icon?: string;
  workspaceId: string;
  createdBy: string;
  parentFolderId?: string;
  sortOrder: number;
  createdAt: Date;
};

export type SkillUsageLog = {
  id: string;
  skillId: string;
  userId: string;
  workspaceId: string;
  triggeredBy: 'manual' | 'trigger';
  success: boolean;
  errorCode?: string;
  durationMs: number;
  tokensInput: number;
  tokensCached: number;
  tokensOutput: number;
  provider?: string;
  sandboxUsed: boolean;
  executedAt: Date;
};

// execution engine types (DEV-946)

export type SkillExecutionContext = {
  skillId: string;
  userId: string;
  workspaceId: string;
  input: Record<string, unknown>;
  conversationId: string;
  triggeredBy: 'manual' | 'trigger';
  activeCallId?: string;
};

export type SkillOutput =
  | { format: 'text'; content: string }
  | { format: 'chart'; imageUrl: string; altText: string }
  | { format: 'table'; columns: string[]; rows: Record<string, unknown>[] }
  | { format: 'report'; sections: ReportSection[] }
  | { format: 'action'; actions: ActionCard[] }
  | { format: 'mixed'; parts: SkillOutput[] };

export type ReportSection = {
  title: string;
  content: string;
  chart?: { imageUrl: string; altText: string };
};

export type ActionCard = {
  id: string;
  title: string;
  description: string;
  actionType:
    | 'create_note'
    | 'update_deal'
    | 'create_task'
    | 'log_call'
    | 'add_to_queue';
  payload: Record<string, unknown>;
  status: 'pending' | 'confirmed' | 'rejected';
};

export type ToolCallRecord = {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  durationMs: number;
};

export type SkillExecutionResult = {
  skillId: string;
  output: SkillOutput;
  tokensUsed: {
    input: number;
    cached: number;
    output: number;
    provider: string;
  };
  sandboxUsed: boolean;
  durationMs: number;
  toolCalls: ToolCallRecord[];
};

export type SkillExecutionError =
  | { code: 'SKILL_NOT_FOUND'; message: string }
  | {
      code: 'INPUT_VALIDATION_FAILED';
      message: string;
      errors: { field: string; message: string }[];
    }
  | { code: 'INTEGRATION_MISSING'; message: string; integrationId: string }
  | { code: 'TOOL_EXECUTION_FAILED'; message: string; toolName: string }
  | { code: 'SANDBOX_TIMEOUT'; message: string; timeoutMs: number }
  | { code: 'SANDBOX_ERROR'; message: string; stderr: string }
  | { code: 'PROVIDER_ERROR'; message: string; provider: string }
  | { code: 'PERMISSION_DENIED'; message: string };

// version types (DEV-1023)

export type SkillVersion = {
  id: string;
  skillId: string;
  version: number;
  systemPrompt: string;
  sandboxTemplate: string;
  sandboxLanguage: 'python' | 'javascript';
  inputSchema?: Record<string, unknown>;
  outputFormat?: SkillOutputFormat;
  createdBy: string;
  createdAt: Date;
  changeSummary?: string;
};
