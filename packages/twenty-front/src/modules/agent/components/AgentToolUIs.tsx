import { makeAssistantToolUI } from '@assistant-ui/react';
import styled from '@emotion/styled';

const StyledShimmer = styled.span`
  @keyframes shimmer {
    0% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.5;
    }
  }

  animation: shimmer 1.5s ease-in-out infinite;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledToolResult = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

export const LearnToolsToolUI = makeAssistantToolUI({
  toolName: 'learn_tools',
  render: ({ status }) => {
    if (status.type === 'running') {
      return <StyledShimmer>Learning tools…</StyledShimmer>;
    }

    return null;
  },
});

export const LoadSkillToolUI = makeAssistantToolUI({
  toolName: 'load_skill',
  render: ({ status }) => {
    if (status.type === 'running') {
      return <StyledShimmer>Loading skill…</StyledShimmer>;
    }

    return null;
  },
});

export const ExecuteToolToolUI = makeAssistantToolUI({
  toolName: 'execute_tool',
  render: ({ args, status }) => {
    const toolName = (args as Record<string, unknown>)?.toolName ?? 'tool';

    if (status.type === 'running') {
      return <StyledShimmer>Running {String(toolName)}…</StyledShimmer>;
    }

    return null;
  },
});

export const FindPeopleToolUI = makeAssistantToolUI({
  toolName: 'find_people',
  render: ({ status }) => {
    if (status.type === 'running') {
      return <StyledShimmer>Searching contacts…</StyledShimmer>;
    }

    return null;
  },
});

export const ToolFallbackUI = ({
  toolName,
  isRunning,
}: {
  toolName: string;
  isRunning: boolean;
}) => {
  if (!isRunning) {
    return null;
  }

  return <StyledShimmer>Running {toolName}…</StyledShimmer>;
};
