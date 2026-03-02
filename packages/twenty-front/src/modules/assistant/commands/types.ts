export type SlashCommandName = 'me' | 'status' | 'contacts-search' | 'history';

export type ParsedCommand = {
  command: SlashCommandName;
  args: Record<string, string>;
};

export type CommandResult = {
  command: SlashCommandName;
  data: unknown;
  error?: string;
};

// -- API response shapes --

export type MetricsData = {
  totalCalls: number;
  answeredCalls: number;
  answerRate: number;
  avgDuration: number;
  callsToday: number;
  callsThisWeek: number;
};

export type HealthData = {
  status: string;
  timestamp: string;
};

export type ContactResult = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  tags?: string[];
};

export type HistoryEntry = {
  id: string;
  to: string;
  from: string;
  contact_name?: string;
  outcome: string;
  duration_seconds: number;
  start_time: string;
};
