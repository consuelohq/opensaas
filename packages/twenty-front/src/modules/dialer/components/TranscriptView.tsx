import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
// eslint-disable-next-line no-restricted-imports — DEV-788: twenty-ui module resolution conflict
import { IconChevronDown, IconChevronUp, IconCopy } from '@tabler/icons-react';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { type TranscriptEntry } from '@/dialer/types/coaching';

// region styled

const StyledToggle = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  background: none;
  border: none;
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing(1)} 0;

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StyledCopyButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(0.5)};
  background: none;
  border: none;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledEntry = styled.div<{ lowConfidence: boolean }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1.5)};
  opacity: ${({ lowConfidence }) => (lowConfidence ? 0.5 : 1)};
`;

const StyledTimestamp = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  white-space: nowrap;
  min-width: 36px;
`;

const StyledSpeaker = styled.span<{ isAgent: boolean }>`
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ isAgent, theme }) =>
    isAgent ? theme.color.blue : theme.font.color.secondary};
  white-space: nowrap;
  min-width: 60px;
`;

const StyledText = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.primary};
  line-height: 1.4;
`;

const StyledEmpty = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  padding: ${({ theme }) => theme.spacing(1)} 0;
`;

// endregion

type TranscriptViewProps = {
  callId: string;
  hasTranscript: boolean;
};

const formatTimestamp = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const SPEAKER_LABELS: Record<TranscriptEntry['speaker'], string> = {
  agent: 'You',
  customer: 'Customer',
};

const CONFIDENCE_THRESHOLD = 0.6;

export const TranscriptView = ({
  callId,
  hasTranscript,
}: TranscriptViewProps) => {
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<TranscriptEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchTranscript = useCallback(async () => {
    if (entries) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/calls/${callId}/transcript`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error('fetch failed');
      const data = (await res.json()) as { entries: TranscriptEntry[] };
      setEntries(data.entries);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [callId, entries]);

  const handleToggle = useCallback(async () => {
    if (!expanded && !entries) {
      await fetchTranscript();
    }
    setExpanded((prev) => !prev);
  }, [expanded, entries, fetchTranscript]);

  const handleCopy = useCallback(async () => {
    if (!entries?.length) return;
    const text = entries
      .map(
        (e) =>
          `[${formatTimestamp(e.timestamp)}] ${SPEAKER_LABELS[e.speaker]}: ${e.text}`,
      )
      .join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [entries]);

  if (!hasTranscript) {
    return <StyledEmpty>No transcript available</StyledEmpty>;
  }

  return (
    <div>
      <StyledToggle onClick={handleToggle}>
        {expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        Transcript
      </StyledToggle>

      {expanded && (
        <StyledContainer>
          {loading && <StyledEmpty>Loading transcript…</StyledEmpty>}

          {!loading && entries?.length === 0 && (
            <StyledEmpty>No transcript available</StyledEmpty>
          )}

          {!loading && entries && entries.length > 0 && (
            <>
              <StyledHeader>
                <span />
                <StyledCopyButton onClick={handleCopy}>
                  <IconCopy size={12} />
                  {copied ? 'Copied' : 'Copy'}
                </StyledCopyButton>
              </StyledHeader>
              {entries.map((entry) => (
                <StyledEntry
                  key={entry.id}
                  lowConfidence={entry.confidence < CONFIDENCE_THRESHOLD}
                >
                  <StyledTimestamp>
                    {formatTimestamp(entry.timestamp)}
                  </StyledTimestamp>
                  <StyledSpeaker isAgent={entry.speaker === 'agent'}>
                    {SPEAKER_LABELS[entry.speaker]}
                  </StyledSpeaker>
                  <StyledText>{entry.text}</StyledText>
                </StyledEntry>
              ))}
            </>
          )}
        </StyledContainer>
      )}
    </div>
  );
};
