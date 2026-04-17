// transcript context extension for pi-agent-core
// injects the latest live call transcript into the prompt before each coaching turn

import type { AgentMessage } from '@mariozechner/pi-agent-core';

const TRANSCRIPT_MARKER = '[TRANSCRIPT_CONTEXT]';
const DEFAULT_MAX_ENTRIES = 24;

export type TranscriptContextEntry = {
  speaker: 'agent' | 'customer';
  text: string;
  timestamp?: number;
  confidence?: number;
};

export type ActiveTranscriptState = {
  callSid: string;
  entries: TranscriptContextEntry[];
};

const isTranscriptMessage = (message: AgentMessage): boolean =>
  'role' in message &&
  message.role === 'user' &&
  typeof message.content === 'string' &&
  message.content.startsWith(TRANSCRIPT_MARKER);

const formatTimestamp = (timestamp?: number): string => {
  if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) {
    return '';
  }

  return new Date(timestamp).toISOString();
};

const formatEntry = (entry: TranscriptContextEntry): string => {
  const normalizedText = entry.text.trim();
  const speakerLabel = entry.speaker === 'agent' ? 'agent' : 'customer';
  const timestamp = formatTimestamp(entry.timestamp);

  if (timestamp.length > 0) {
    return `${speakerLabel.toUpperCase()} [${timestamp}]: ${normalizedText}`;
  }

  return `${speakerLabel.toUpperCase()}: ${normalizedText}`;
};

export type TranscriptContextExtension = {
  transformContext: (
    messages: AgentMessage[],
    signal?: AbortSignal,
  ) => Promise<AgentMessage[]>;
  buildSystemPromptSuffix: () => string;
};

export const createTranscriptContext = (
  getActiveTranscript: () => ActiveTranscriptState | undefined,
  options?: { maxEntries?: number },
): TranscriptContextExtension => {
  const maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;

  return {
    transformContext: async (messages: AgentMessage[]): Promise<AgentMessage[]> => {
      try {
        const transcript = getActiveTranscript();

        if (!transcript || transcript.entries.length === 0) {
          return messages.filter((message) => !isTranscriptMessage(message));
        }

        const latestEntries = transcript.entries
          .filter((entry) => entry.text.trim().length > 0)
          .slice(-maxEntries);

        if (latestEntries.length === 0) {
          return messages.filter((message) => !isTranscriptMessage(message));
        }

        const renderedTranscript = latestEntries.map(formatEntry).join('\n');
        const block = [
          TRANSCRIPT_MARKER,
          `<live_transcript callSid=\"${transcript.callSid}\">`,
          renderedTranscript,
          '</live_transcript>',
        ].join('\n');

        const filtered = messages.filter((message) => !isTranscriptMessage(message));
        const transcriptMessage: AgentMessage = {
          role: 'user' as const,
          content: block,
          timestamp: Date.now(),
        };

        return [transcriptMessage, ...filtered];
      } catch {
        return messages.filter((message) => !isTranscriptMessage(message));
      }
    },

    buildSystemPromptSuffix: () => '',
  };
};
