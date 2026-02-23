import { useState } from 'react';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

import { getTokenPair } from '@/apollo/utils/getTokenPair';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

export const useAgentChat = () => {
  const [input, setInput] = useState('');

  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({
      api: `${REACT_APP_SERVER_BASE_URL}/v1/agent/chat`,
      headers: () => ({
        Authorization: `Bearer ${getTokenPair()?.accessOrWorkspaceAgnosticToken.token}`,
      }),
    }),
  });

  const isLoading = status === 'streaming';

  const handleSubmit = () => {
    const trimmed = input.trim();

    if (trimmed === '' || isLoading) {
      return;
    }

    sendMessage({ text: trimmed });
    setInput('');
  };

  return {
    messages,
    input,
    setInput,
    handleSubmit,
    handleStop: stop,
    isLoading,
    error,
  };
};
