import { createState } from '@/ui/utilities/state/utils/createState';

import type { CommandResult } from '@/assistant/commands/types';

export type ExecutedCommand = {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
};

export type AssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  commandsExecuted?: ExecutedCommand[];
  commandResult?: CommandResult;
  timestamp: string;
};

export const assistantMessagesState = createState<AssistantMessage[]>({
  key: 'assistantMessages',
  defaultValue: [],
});

export const assistantConversationIdState = createState<string | null>({
  key: 'assistantConversationId',
  defaultValue: null,
});

export const assistantLoadingState = createState<boolean>({
  key: 'assistantLoading',
  defaultValue: false,
});

export const assistantSidebarOpenState = createState<boolean>({
  key: 'assistantSidebarOpen',
  defaultValue: false,
});
