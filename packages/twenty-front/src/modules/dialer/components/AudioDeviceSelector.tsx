import styled from '@emotion/styled';
import {
  IconMicrophone,
  IconVolume,
  IconMicrophoneOff,
} from '@tabler/icons-react';

import { useAudioDevices } from '@/dialer/hooks/useAudioDevices';

interface AudioDeviceSelectorProps {
  compact?: boolean;
}

const StyledContainer = styled.div<{ compact?: boolean }>`
  display: flex;
  flex-direction: ${({ compact }) => (compact ? 'row' : 'column')};
  gap: ${({ theme, compact }) => theme.spacing(compact ? 2 : 3)};
  ${({ compact }) => compact && 'align-items: center;'}
`;

const StyledGroup = styled.div<{ compact?: boolean }>`
  display: flex;
  flex-direction: ${({ compact }) => (compact ? 'row' : 'column')};
  gap: ${({ theme }) => theme.spacing(1)};
  ${({ compact }) => compact && 'align-items: center;'}
`;

const StyledLabel = styled.label`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledSelect = styled.select`
  background: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => `${theme.spacing(1)} ${theme.spacing(2)}`};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  min-width: 0;
  max-width: 200px;
  text-overflow: ellipsis;

  &:focus {
    outline: 2px solid ${({ theme }) => theme.color.blue};
    outline-offset: -2px;
  }
`;

const StyledPermissionButton = styled.button`
  background: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => `${theme.spacing(1)} ${theme.spacing(2)}`};
  font-size: ${({ theme }) => theme.font.size.xs};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};

  &:hover {
    background: ${({ theme }) => theme.background.secondary};
  }
`;

export const AudioDeviceSelector = ({
  compact = false,
}: AudioDeviceSelectorProps) => {
  const {
    microphones,
    speakers,
    selectedMic,
    selectedSpeaker,
    setSelectedMic,
    setSelectedSpeaker,
    hasPermission,
    requestPermission,
  } = useAudioDevices();

  if (!hasPermission) {
    return (
      <StyledPermissionButton onClick={requestPermission}>
        <IconMicrophoneOff size={14} />
        Grant microphone access
      </StyledPermissionButton>
    );
  }

  return (
    <StyledContainer compact={compact}>
      <StyledGroup compact={compact}>
        {!compact && (
          <StyledLabel>
            <IconMicrophone size={14} />
            Microphone
          </StyledLabel>
        )}
        <StyledSelect
          aria-label="Microphone"
          value={selectedMic ?? ''}
          onChange={(e) => setSelectedMic(e.target.value)}
        >
          {microphones.map((mic) => (
            <option key={mic.deviceId} value={mic.deviceId}>
              {compact ? mic.label.slice(0, 20) : mic.label}
            </option>
          ))}
        </StyledSelect>
      </StyledGroup>

      <StyledGroup compact={compact}>
        {!compact && (
          <StyledLabel>
            <IconVolume size={14} />
            Speaker
          </StyledLabel>
        )}
        <StyledSelect
          aria-label="Speaker"
          value={selectedSpeaker ?? ''}
          onChange={(e) => setSelectedSpeaker(e.target.value)}
        >
          {speakers.map((spk) => (
            <option key={spk.deviceId} value={spk.deviceId}>
              {compact ? spk.label.slice(0, 20) : spk.label}
            </option>
          ))}
        </StyledSelect>
      </StyledGroup>
    </StyledContainer>
  );
};
