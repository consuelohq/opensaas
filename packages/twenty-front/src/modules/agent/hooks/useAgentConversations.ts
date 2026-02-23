import { useCallback, useEffect, useState } from 'react';

import { getTokenPair } from '@/apollo/utils/getTokenPair';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

type Conversation = {
  id: string;
  title: string;
  messageCount: number;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

const authHeaders = (): Record<string, string> => ({
  Authorization: `Bearer ${getTokenPair()?.accessOrWorkspaceAgnosticToken.token}`,
  'Content-Type': 'application/json',
});

export const useAgentConversations = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/agent/conversations`,
        { headers: authHeaders() },
      );

      if (response.ok) {
        const data = (await response.json()) as {
          conversations: Conversation[];
        };

        setConversations(data.conversations);
      }
    } catch {
      // silently fail — conversations list is non-critical
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  const selectConversation = useCallback((id: string | null) => {
    setSelectedConversationId(id);
  }, []);

  const togglePin = useCallback(
    async (id: string) => {
      try {
        await fetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/agent/conversations/${id}/pin`,
          { method: 'POST', headers: authHeaders() },
        );
        await fetchConversations();
      } catch {
        // silent
      }
    },
    [fetchConversations],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await fetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/agent/conversations/${id}`,
          { method: 'DELETE', headers: authHeaders() },
        );

        if (selectedConversationId === id) {
          setSelectedConversationId(null);
        }

        await fetchConversations();
      } catch {
        // silent
      }
    },
    [fetchConversations, selectedConversationId],
  );

  return {
    conversations,
    selectedConversationId,
    selectConversation,
    togglePin,
    deleteConversation,
    isLoading,
    refetch: fetchConversations,
  };
};
