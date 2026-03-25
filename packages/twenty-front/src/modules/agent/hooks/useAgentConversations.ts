import { useCallback } from 'react';

import { currentAIChatThreadState } from '@/ai/states/currentAIChatThreadState';
import { useRecoilState } from 'recoil';
import {
  useCreateChatThreadMutation,
  useGetChatThreadsQuery,
} from '~/generated-metadata/graphql';

export const useAgentConversations = () => {
  const [currentThreadId, setCurrentThreadId] = useRecoilState(
    currentAIChatThreadState,
  );

  const { data, loading, refetch } = useGetChatThreadsQuery();

  const [createThread] = useCreateChatThreadMutation({
    onCompleted: (result) => {
      setCurrentThreadId(result.createChatThread.id);
      void refetch();
    },
  });

  const conversations = (data?.chatThreads ?? []).map((thread) => ({
    id: thread.id,
    title: thread.title ?? 'New conversation',
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  }));

  const selectConversation = useCallback(
    (id: string | null) => {
      setCurrentThreadId(id);
    },
    [setCurrentThreadId],
  );

  const createNewConversation = useCallback(() => {
    void createThread();
  }, [createThread]);

  return {
    conversations,
    selectedConversationId: currentThreadId,
    selectConversation,
    createNewConversation,
    isLoading: loading,
    refetch,
  };
};
