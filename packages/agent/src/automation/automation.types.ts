export type Condition = {
  field: string;
  operator:
    | 'eq'
    | 'neq'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'contains'
    | 'not_contains';
  value: string | number | boolean;
};

export type ConditionGroup = {
  operator: 'and' | 'or';
  conditions: Condition[];
};

export type TriggerConfig =
  | { type: 'event'; event: string; conditions?: ConditionGroup }
  | { type: 'schedule'; cron: string; timezone: string }
  | { type: 'conditional'; event: string; conditions: ConditionGroup };

export type Automation = {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  skillId: string;
  trigger: TriggerConfig;
  inputOverrides: Record<string, unknown>;
  notifyOn: 'success' | 'failure' | 'both' | 'none';
  maxRunsPerDay?: number;
  lastRunAt?: Date;
  lastRunStatus?: 'success' | 'failure' | 'skipped';
  userId: string;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateAutomationInput = Omit<
  Automation,
  'id' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'lastRunStatus'
>;
