import styled from '@emotion/styled';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconChevronDown,
  IconChevronUp,
  IconMicrophone,
} from '@tabler/icons-react';

import { type TranscriptEntry } from '@/dialer/types/coaching';

const STORAGE_KEY = 'dialer_transcript_expanded';

interface LiveTranscriptProps {
  transcript: TranscriptEntry[];
  isConnected: boolean;
}

// region styled

const StyledPanel = styled.div`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  overflow: hidden;
`;

const StyledHeader = styled.button`
  all: unset;
  box-sizing: border-box;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.background.secondary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.background.tertiary};
  }
`;

const StyledHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledHeaderTitle = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledDot = styled.span<{ connected: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ connected, theme }) =>
    connected ? (theme.color.green ?? '#16a34a') : (theme.font.color.tertiary ?? '#999')};
`;

const StyledContent = styled.div`
  max-height: 30vh;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledEntry = styled.div<{ isAgent: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ isAgent, theme }) =>
    isAgent ? (theme.background.secondary) : (theme.background.tertiary)};
  align-self: ${({ isAgent }) => (isAgent ? 'flex-end' : 'flex-start')};
  max-width: 85%;
`;

const StyledSpeaker = styled.span`
  font-size: 11px;
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.tertiary};
  text-transform: uppercase;
`;

const StyledText = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  line-height: 1.4;
`;

const StyledEmpty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(4)} 0;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  text-align: center;
`;

// endregion

export const LiveTranscript = ({
  transcript,
  isConnected,
}: LiveTranscriptProps) => {
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });

  const contentRef = useRef<HTMLDivElement>(null);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // noop — DEV-725
      }
      return next;
    });
  }, []);

  // auto-scroll to bottom on new entries
  useEffect(() => {
    const container = contentRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [transcript.length]);

  return (
    <StyledPanel>
      <StyledHeader onClick={toggleExpanded} aria-expanded={isExpanded}>
        <StyledHeaderLeft>
          <IconMicrophone size={16} />
          <StyledHeaderTitle>Live Transcript</StyledHeaderTitle>
          <StyledDot connected={isConnected} />
        </StyledHeaderLeft>
        {isExpanded ? (
          <IconChevronUp size={14} />
        ) : (
          <IconChevronDown size={14} />
        )}
      </StyledHeader>
      {isExpanded && (
        <StyledContent ref={contentRef}>
          {transcript.length === 0 ? (
            <StyledEmpty>
              <IconMicrophone size={20} />
              <span>
                {isConnected
                  ? 'Listening...'
                  : 'Transcript will appear when connected'}
              </span>
            </StyledEmpty>
          ) : (
            transcript.map((entry) => (
              <StyledEntry key={entry.id} isAgent={entry.speaker === 'agent'}>
                <StyledSpeaker>
                  {entry.speaker === 'agent' ? 'You' : 'Customer'}
                </StyledSpeaker>
                <StyledText>{entry.text}</StyledText>
              </StyledEntry>
            ))
          )}
        </StyledContent>
      )}
    </StyledPanel>
  );
};
