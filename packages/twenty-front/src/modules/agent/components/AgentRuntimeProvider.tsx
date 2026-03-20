import { type ReactNode } from 'react';

import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { useChatRuntime } from '@assistant-ui/react-ai-sdk';

import { getTokenPair } from '@/apollo/utils/getTokenPair';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

type AgentRuntimeProviderProps = {
  children: ReactNode;
};

export const AgentRuntimeProviderWrapper = ({
  children,
}: AgentRuntimeProviderProps) => {
  const runtime = useChatRuntime({
    api: `${REACT_APP_SERVER_BASE_URL}/v1/agent/chat`,
    headers: () =>
      Promise.resolve({
        Authorization: `Bearer ${getTokenPair()?.accessOrWorkspaceAgnosticToken.token}`,
      }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
};
