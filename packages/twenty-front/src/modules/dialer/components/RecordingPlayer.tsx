import styled from '@emotion/styled';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { activePlaybackIdState } from '@/dialer/states/historyState';

// region styled

const StyledContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(1)} 0;
`;

const StyledPlayButton = styled.button<{ disabled?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.primary};
  cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
  flex-shrink: 0;

  &:hover {
    background: ${({ theme, disabled }) =>
      disabled ? theme.background.tertiary : theme.background.secondary};
  }
`;

const StyledProgressContainer = styled.div`
  flex: 1;
  height: 4px;
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: 2px;
  cursor: pointer;
  position: relative;
`;

const StyledProgressFill = styled.div<{ width: number }>`
  height: 100%;
  width: ${({ width }) => width}%;
  background: ${({ theme }) => theme.color.blue};
  border-radius: 2px;
  transition: width 0.1s linear;
`;

const StyledTime = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  white-space: nowrap;
  min-width: 70px;
  text-align: right;
`;

const StyledError = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  text-decoration: underline;
`;

// endregion

type RecordingPlayerProps = {
  callId: string;
  duration: number | null;
};

const formatTime = (s: number): string => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export const RecordingPlayer = ({ callId, duration }: RecordingPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeId, setActiveId] = useRecoilState(activePlaybackIdState);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration ?? 0);

  // pause when another player takes over
  useEffect(() => {
    if (activeId !== callId && playing) {
      audioRef.current?.pause();
      setPlaying(false);
    }
  }, [activeId, callId, playing]);

  const fetchUrl = useCallback(async (): Promise<string | null> => {
    if (url) return url;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/calls/${callId}/recording`,
      );
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setUrl(data.url);
      return data.url as string;
    } catch (err: unknown) {
      setError('Recording unavailable');
      return null;
    } finally {
      setLoading(false);
    }
  }, [callId, url]);

  const toggle = useCallback(async () => {
    if (loading) return;

    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }

    let audioUrl = url;
    if (!audioUrl) {
      audioUrl = await fetchUrl();
      if (!audioUrl) return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.addEventListener('timeupdate', () => {
        setCurrentTime(audioRef.current?.currentTime ?? 0);
      });
      audioRef.current.addEventListener('loadedmetadata', () => {
        setAudioDuration(audioRef.current?.duration ?? 0);
      });
      audioRef.current.addEventListener('ended', () => {
        setPlaying(false);
        setCurrentTime(0);
      });
      audioRef.current.addEventListener('error', () => {
        setError('Playback error');
        setPlaying(false);
      });
    }

    try {
      setActiveId(callId);
      await audioRef.current.play();
      setPlaying(true);
    } catch (err: unknown) {
      setError('Playback error');
    }
  }, [loading, playing, url, fetchUrl, callId, setActiveId]);

  const seek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!audioRef.current || audioDuration === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audioRef.current.currentTime = ratio * audioDuration;
      setCurrentTime(audioRef.current.currentTime);
    },
    [audioDuration],
  );

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  if (error) {
    return (
      <StyledContainer>
        <StyledError onClick={() => { setError(null); toggle(); }}>
          {error} — retry
        </StyledError>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer>
      <StyledPlayButton onClick={toggle} disabled={loading}>
        {playing ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}
      </StyledPlayButton>
      <StyledProgressContainer onClick={seek}>
        <StyledProgressFill width={progress} />
      </StyledProgressContainer>
      <StyledTime>
        {formatTime(currentTime)} / {formatTime(audioDuration)}
      </StyledTime>
    </StyledContainer>
  );
};
