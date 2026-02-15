import { useCallback } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import {
  type AssistantMessage,
  assistantConversationIdState,
  assistantLoadingState,
  assistantMessagesState,
} from '@/assistant/states/assistantState';

type AssistantResponse = {
  reply: string;
  conversationId: string;
  commandsExecuted?: AssistantMessage['commandsExecuted'];
};

export const useAssistant = () => {
  const [messages, setMessages] = useRecoilState(assistantMessagesState);
  const [conversationId, setConversationId] = useRecoilState(
    assistantConversationIdState,
  );
  const setLoading = useSetRecoilState(assistantLoadingState);

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg: AssistantMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const res = await fetch(`${REACT_APP_SERVER_BASE_URL}/v1/assistant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            ...(conversationId ? { conversationId } : {}),
          }),
        });

        if (!res.ok) {
          const errBody = (await res.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          throw new Error(
            errBody?.error?.message ?? `Request failed (${res.status})`,
          );
        }

        const data = (await res.json()) as AssistantResponse;
        setConversationId(data.conversationId);

        const assistantMsg: AssistantMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.reply,
          commandsExecuted: data.commandsExecuted,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong';
        const errorMsg: AssistantMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Error: ${message}`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
      }
    },
    [conversationId, setConversationId, setLoading, setMessages],
  );

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, [setConversationId, setMessages]);

  return { messages, sendMessage, clearConversation };
};
