import styled from '@emotion/styled';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconChevronDown,
  IconChevronUp,
  IconMicrophone,
} from 'twenty-ui/display';
import { useLingui } from '@lingui/react/macro';

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
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledDot = styled.span<{ connected: boolean }>`
  background: ${({ connected, theme }) =>
    connected ? theme.color.green : theme.font.color.tertiary};
  border-radius: 50%;
  height: 8px;
  width: 8px;
`;

const StyledContent = styled.div`
  aria-live: polite;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  max-height: 30vh;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
`;

const StyledEntry = styled.div<{ isAgent: boolean }>`
  align-self: ${({ isAgent }) => (isAgent ? 'flex-end' : 'flex-start')};
  background: ${({ isAgent, theme }) =>
    isAgent ? theme.background.secondary : theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 85%;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
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
  const { t } = useLingui();
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
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

  // N11: only auto-scroll if user is near the bottom (within 50px)
  useEffect(() => {
    const container = contentRef.current;
    if (container) {
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        50;
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [transcript.length]);

  return (
    <StyledPanel>
      <StyledHeader onClick={toggleExpanded} aria-expanded={isExpanded}>
        <StyledHeaderLeft>
          <IconMicrophone size={16} />
          <StyledHeaderTitle>{t`Live Transcript`}</StyledHeaderTitle>
          <StyledDot
            connected={isConnected}
            role="status"
            aria-label={isConnected ? t`Connected` : t`Disconnected`}
          />
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
                  ? t`Listening...`
                  : t`Transcript will appear when connected`}
              </span>
            </StyledEmpty>
          ) : (
            transcript.map((entry) => (
              <StyledEntry key={entry.id} isAgent={entry.speaker === 'agent'}>
                <StyledSpeaker>
                  {entry.speaker === 'agent' ? t`You` : t`Customer`}
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
