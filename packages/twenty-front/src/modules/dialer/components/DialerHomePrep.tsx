import { captureException } from '@sentry/react';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { AppPath, SettingsPath } from 'twenty-shared/types';
import { getAppPath, getSettingsPath } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/input';

import { AudioDeviceSelector } from '@/dialer/components/AudioDeviceSelector';
import { CallerIdSelectCard } from '@/dialer/components/CallerIdSelectCard';
import { useAudioDevices } from '@/dialer/hooks/useAudioDevices';
import { useCoachingScripts } from '@/dialer/hooks/useCoachingScripts';
import { useQueueOperations } from '@/dialer/hooks/useQueueOperations';
import { callAssistModeState } from '@/dialer/states/callAssistModeState';
import { dialingModeState } from '@/dialer/states/dialingModeState';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { Select } from '@/ui/input/components/Select';
import { TextInput } from '@/ui/input/components/TextInput';

import { IconList, IconSettings } from 'twenty-ui/display';

type OpportunityRecord = ObjectRecord & {
  id: string;
  name?: string | null;
};

// -- styled --

const StyledPage = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(6)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledHeading = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledTitle = styled.h1`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xxl};
  margin: 0;
`;

const StyledSubtitle = styled.p`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.md};
  margin: 0;
`;

const StyledForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  margin: 0 auto;
  max-width: 600px;
  width: 100%;
`;

const StyledFieldGroup = styled.div<{ disabled?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  opacity: ${({ disabled }) => (disabled ? 0.4 : 1)};
  pointer-events: ${({ disabled }) => (disabled ? 'none' : 'auto')};
`;

const StyledLabel = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledDivider = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(2)};

  &::before,
  &::after {
    border-top: 1px solid ${({ theme }) => theme.border.color.medium};
    content: '';
    flex: 1;
  }
`;

const StyledFooterActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
`;

// -- component --

export const DialerHomePrep = () => {
  const navigate = useNavigate();
  const [callAssistMode, setCallAssistMode] =
    useRecoilState(callAssistModeState);
  const [dialingMode, setDialingMode] = useRecoilState(dialingModeState);
  const { selectedCoachingScriptId, setSelectedCoachingScriptId, coachingScripts } =
    useCoachingScripts();
  const { hasPermission } = useAudioDevices();
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const { startQueue } = useQueueOperations();

  const { records: listRecords } = useFindManyRecords<OpportunityRecord>({
    objectNameSingular: 'opportunity',
    limit: 50,
  });

  const hasPhone = phoneNumber.trim().length > 0;
  const hasList = selectedListId.length > 0;

  const handleListChange = (value: string) => {
    setSelectedListId(value);
    if (value) {
      setPhoneNumber('');
    }
  };

  const handlePhoneChange = (value: string) => {
    setPhoneNumber(value);
    if (value.trim()) {
      setSelectedListId('');
    }
  };

  const handleLaunch = async () => {
    if (!hasList) return;

    try {
      await startQueue(selectedListId);
      navigate(
        getAppPath(AppPath.RecordShowPage, {
          objectNameSingular: 'opportunity',
          objectRecordId: selectedListId,
        }),
      );
    } catch (error: unknown) {
      captureException(error);
    }
  };

  return (
    <StyledPage>
      <StyledHeading>
        <StyledTitle>{t`Who do you want to call?`}</StyledTitle>
        <StyledSubtitle>
          {t`Choose a list or dial a single number.`}
        </StyledSubtitle>
      </StyledHeading>

      <StyledForm>
        {/* list selection — grayed out when phone number is entered */}
        <StyledFieldGroup disabled={hasPhone}>
          <StyledLabel>{t`Select a list`}</StyledLabel>
          <Select
            dropdownId="dialer-home-list-select"
            fullWidth
            value={selectedListId}
            onChange={handleListChange}
            disabled={hasPhone}
            options={[
              { value: '', label: t`— Select —`, Icon: IconList },
              ...listRecords.map((record) => ({
                value: record.id,
                label: record.name ?? t`Untitled list`,
                Icon: IconList,
              })),
            ]}
          />
        </StyledFieldGroup>

        <StyledDivider>{t`or`}</StyledDivider>

        {/* single phone number — grayed out when list is selected */}
        <StyledFieldGroup disabled={hasList}>
          <StyledLabel>{t`Dial a number`}</StyledLabel>
          <TextInput
            value={phoneNumber}
            onChange={handlePhoneChange}
            placeholder={t`(555) 123-4567`}
            disabled={hasList}
            fullWidth
          />
        </StyledFieldGroup>

        {/* call setup */}
        <StyledFieldGroup>
          <StyledLabel>{t`Call setup`}</StyledLabel>

          {/* 1. caller id + local presence */}
          <CallerIdSelectCard dropdownId="dialer-home-caller-id" />

          {/* mic permission — only shown when not yet granted */}
          {!hasPermission && <AudioDeviceSelector />}

          {/* 2. calling mode */}
          <Select
            dropdownId="dialer-home-dialing-mode"
            fullWidth
            label={t`Calling mode`}
            value={dialingMode}
            onChange={(value) => setDialingMode(value)}
            options={[
              { value: 'single', label: t`Single (one call at a time)` },
              { value: 'parallel', label: t`Parallel / Power Dialer` },
            ]}
          />

          {/* 3. assist mode */}
          <Select
            dropdownId="dialer-home-assist-mode"
            fullWidth
            label={t`Assist mode`}
            value={callAssistMode}
            onChange={(value) => setCallAssistMode(value)}
            options={[
              { value: 'ai', label: t`AI coaching` },
              { value: 'script', label: t`Script mode` },
            ]}
          />

          {callAssistMode === 'script' && (
            <Select
              dropdownId="dialer-home-script-select"
              fullWidth
              label={t`Script`}
              value={selectedCoachingScriptId ?? ''}
              onChange={(value) => setSelectedCoachingScriptId(value)}
              options={coachingScripts.map((script) => ({
                value: script.id,
                label: script.name,
              }))}
            />
          )}
        </StyledFieldGroup>

        {/* launch */}
        <StyledFooterActions>
          <Button
            title={t`Open fullscreen workspace`}
            onClick={() => void handleLaunch()}
            disabled={!hasList && !hasPhone}
          />
          <Button
            title={t`Settings`}
            variant="secondary"
            Icon={IconSettings}
            onClick={() =>
              navigate(getSettingsPath(SettingsPath.AccountsPhoneNumbers))
            }
          />
        </StyledFooterActions>
      </StyledForm>
    </StyledPage>
  );
};
