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
