import { useCallback, useState } from 'react';
import { useRecoilState } from 'recoil';
import styled from '@emotion/styled';
import { IconX } from '@tabler/icons-react';

import { activeQueueState } from '@/dialer/states/queueState';
import type { CallQueue, QueueSettings } from '@/dialer/types/queue';

const StyledOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
`;

const StyledModal = styled.div`
  background: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  width: 360px;
  max-height: 80vh;
  overflow-y: auto;
`;

const StyledModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  font-size: ${({ theme }) => theme.font.size.md};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledModalBody = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledSettingRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;
`;

const StyledModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledModalButton = styled.button<{ accent?: boolean }>`
  all: unset;
  box-sizing: border-box;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(3)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: 500;
  cursor: pointer;
  background: ${({ accent, theme }) =>
    accent ? theme.color.blue : theme.background.tertiary};
  color: ${({ accent, theme }) => (accent ? '#fff' : theme.font.color.primary)};
`;

const StyledNumberInput = styled.input`
  width: 64px;
  padding: 4px 8px;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  text-align: right;
`;

interface QueueSettingsModalProps {
  queue: CallQueue;
  onClose: () => void;
}

export const QueueSettingsModal = ({
  queue,
  onClose,
}: QueueSettingsModalProps) => {
  const [settings, setSettings] = useState<QueueSettings>(queue.settings);
  const [, setQueue] = useRecoilState(activeQueueState);

  const update = useCallback(
    <TKey extends keyof QueueSettings>(
      key: TKey,
      value: QueueSettings[TKey],
    ) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSave = useCallback(() => {
    setQueue((prev) => (prev ? { ...prev, settings } : null));
    onClose();
  }, [settings, setQueue, onClose]);

  return (
    <StyledOverlay onClick={onClose}>
      <StyledModal onClick={(e) => e.stopPropagation()}>
        <StyledModalHeader>Queue Settings</StyledModalHeader>
        <StyledModalBody>
          <StyledSettingRow>
            Auto-advance
            <input
              type="checkbox"
              checked={settings.autoAdvance}
              onChange={(e) => update('autoAdvance', e.target.checked)}
            />
          </StyledSettingRow>
          <StyledSettingRow>
            Auto-advance delay (ms)
            <StyledNumberInput
              type="number"
              value={settings.autoAdvanceDelay}
              onChange={(e) =>
                update('autoAdvanceDelay', Number(e.target.value))
              }
            />
          </StyledSettingRow>
          <StyledSettingRow>
            Skip no-answer
            <input
              type="checkbox"
              checked={settings.skipNoAnswer}
              onChange={(e) => update('skipNoAnswer', e.target.checked)}
            />
          </StyledSettingRow>
          <StyledSettingRow>
            Max attempts
            <StyledNumberInput
              type="number"
              value={settings.maxAttempts}
              onChange={(e) => update('maxAttempts', Number(e.target.value))}
            />
          </StyledSettingRow>
          <StyledSettingRow>
            Call timeout (s)
            <StyledNumberInput
              type="number"
              value={settings.callTimeout}
              onChange={(e) => update('callTimeout', Number(e.target.value))}
            />
          </StyledSettingRow>
          <StyledSettingRow>
            Auto-skip voicemail
            <input
              type="checkbox"
              checked={settings.autoSkipVoicemail}
              onChange={(e) => update('autoSkipVoicemail', e.target.checked)}
            />
          </StyledSettingRow>
          {settings.autoSkipVoicemail && (
            <StyledSettingRow>
              Voicemail skip delay (ms)
              <StyledNumberInput
                type="number"
                value={settings.voicemailSkipDelay}
                onChange={(e) =>
                  update('voicemailSkipDelay', Number(e.target.value))
                }
              />
            </StyledSettingRow>
          )}
          <StyledSettingRow>
            Parallel dialing
            <input
              type="checkbox"
              checked={settings.parallelDialingEnabled}
              onChange={(e) =>
                update('parallelDialingEnabled', e.target.checked)
              }
            />
          </StyledSettingRow>
          {settings.parallelDialingEnabled && (
            <>
              <StyledSettingRow>
                Max parallel lines
                <StyledNumberInput
                  type="number"
                  value={settings.parallelDialingMaxLines}
                  onChange={(e) =>
                    update('parallelDialingMaxLines', Number(e.target.value))
                  }
                />
              </StyledSettingRow>
              <StyledSettingRow>
                Cooldown between batches (ms)
                <StyledNumberInput
                  type="number"
                  value={settings.parallelDialingCooldown}
                  onChange={(e) =>
                    update('parallelDialingCooldown', Number(e.target.value))
                  }
                />
              </StyledSettingRow>
            </>
          )}
        </StyledModalBody>
        <StyledModalActions>
          <StyledModalButton onClick={onClose}>Cancel</StyledModalButton>
          <StyledModalButton accent onClick={handleSave}>
            Save
          </StyledModalButton>
        </StyledModalActions>
      </StyledModal>
    </StyledOverlay>
  );
};
