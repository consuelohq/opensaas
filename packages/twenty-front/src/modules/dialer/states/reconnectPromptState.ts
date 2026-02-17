import { createState } from '@/ui/utilities/state/utils/createState';

export type ReconnectPrompt = {
  visible: boolean;
  conferenceName: string;
  callSid: string;
} | null;

export const reconnectPromptState = createState<ReconnectPrompt>({
  key: 'dialerReconnectPrompt',
  defaultValue: null,
});
