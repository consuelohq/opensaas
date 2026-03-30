import { type ReactNode, useCallback, useMemo } from 'react';

import { useChat } from '@ai-sdk/react';
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
} from '@assistant-ui/react';
import { DefaultChatTransport } from 'ai';

import { getTokenPair } from '@/apollo/utils/getTokenPair';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

import type { ThreadMessage, AppendMessage } from '@assistant-ui/react';
import type { UIMessage } from 'ai';

type AgentRuntimeProviderProps = {
  children: ReactNode;
};

const convertMessage = (msg: UIMessage): ThreadMessage => {
  const createdAt = new Date();
  const textPart = msg.parts?.find(
    (p): p is { type: 'text'; text: string } => p.type === 'text',
  );
  const text = textPart?.text ?? '';

  if (msg.role === 'user') {
    return {
      id: msg.id,
      role: 'user',
      createdAt,
      content: [{ type: 'text', text }],
      attachments: [],
      metadata: { custom: {} },
    };
  }

  return {
    id: msg.id,
    role: 'assistant',
    createdAt,
    content: [{ type: 'text', text }],
    status: { type: 'complete', reason: 'stop' },
    metadata: {
      custom: {},
      unstable_state: null,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
    },
  };
};

export const AgentRuntimeProviderWrapper = ({
  children,
}: AgentRuntimeProviderWrapperProps) => {
  const chat = useChat({
    transport: new DefaultChatTransport({
      api: `${REACT_APP_SERVER_BASE_URL}/v1/agent/chat`,
      headers: () => ({
        Authorization: `Bearer ${getTokenPair()?.accessOrWorkspaceAgnosticToken.token}`,
      }),
    }),
  });

  const isRunning = chat.status === 'streaming';

  const messages = useMemo(
    () => chat.messages.map(convertMessage),
    [chat.messages],
  );

  // mark last assistant message as running if streaming
  const messagesWithStatus = useMemo(() => {
    if (!isRunning || messages.length === 0) {
      return messages;
    }

    const last = messages[messages.length - 1];

    if (last.role !== 'assistant') {
      return messages;
    }

    return [
      ...messages.slice(0, -1),
      { ...last, status: { type: 'running' as const } },
    ];
  }, [messages, isRunning]);

  const onNew = useCallback(
    async (message: AppendMessage) => {
      const text = message.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('');

      chat.sendMessage({ text });
    },
    [chat],
  );

  const onCancel = useCallback(async () => {
    chat.stop();
  }, [chat]);

  const runtime = useExternalStoreRuntime({
    messages: messagesWithStatus,
    isRunning,
    onNew,
    onCancel,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
};
