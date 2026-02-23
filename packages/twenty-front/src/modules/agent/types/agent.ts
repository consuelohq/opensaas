/** Agent skill definition */
export type AgentSkill = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

/** Agent chat message */
export type AgentMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

/** Agent context item displayed in the right panel */
export type AgentContextItem = {
  id: string;
  label: string;
  type: 'file' | 'record' | 'url';
  value: string;
};

/** Status of an action confirmation request */
export type ActionConfirmationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executed';

/** Tracks a CRM tool call awaiting user confirmation */
export type ActionConfirmation = {
  toolName: string;
  args: Record<string, unknown>;
  status: ActionConfirmationStatus;
};
