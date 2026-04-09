import { captureException } from '@sentry/react';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { useEffect, useState } from 'react';
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
import { importedListIdState } from '@/dialer/states/importedListIdState';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { Select } from '@/ui/input/components/Select';
import { TextInput } from '@/ui/input/components/TextInput';

import { IconList, IconPlus, IconSettings } from 'twenty-ui/display';

type OpportunityRecord = ObjectRecord & {
  id: string;
  name?: string | null;
};

type SourceMode = 'list' | 'phone';

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

const StyledFieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledLabel = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledToggleRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(4)};
`;

const StyledToggleOption = styled.button<{ isActive: boolean }>`
  background: none;
  border: none;
  border-bottom: ${({ isActive, theme }) =>
    isActive ? `1px solid ${theme.font.color.primary}` : 'none'};
  color: ${({ isActive, theme }) =>
    isActive ? theme.font.color.primary : theme.font.color.tertiary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: ${({ theme }) => `${theme.spacing(1)} 0`};

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
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
  const [sourceMode, setSourceMode] = useState<SourceMode>('list');
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [importedListId, setImportedListId] = useRecoilState(importedListIdState);
  const [phoneNumber, setPhoneNumber] = useState<string>('');

  // Auto-select a list that was just imported from the home page CSV flow
  useEffect(() => {
    if (importedListId) {
      setSelectedListId(importedListId);
      setImportedListId('');
    }
  }, [importedListId, setImportedListId]);
  const [numberOfLines, setNumberOfLines] = useState<string>('1');
  const { startQueue } = useQueueOperations();

  const { records: listRecords } = useFindManyRecords<OpportunityRecord>({
    objectNameSingular: 'opportunity',
    orderBy: [{ updatedAt: 'DescNullsLast' }],
    limit: 50,
  });

  const hasPhone = phoneNumber.trim().length > 0;
  const hasList = selectedListId.length > 0;
  const canStart = hasList || hasPhone;

  const handleLaunch = async () => {
    if (!canStart) return;

    if (hasList) {
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
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && canStart) {
      void handleLaunch();
    }
  };

  const handleCreateList = () => {
    navigate(
      getAppPath(AppPath.RecordIndexPage, {
        objectNamePlural: 'opportunities',
      }),
    );
  };

  return (
    <StyledPage onKeyDown={handleKeyDown}>
      <StyledHeading>
        <StyledTitle>{t`Who do you want to call?`}</StyledTitle>
        <StyledSubtitle>
          {t`Choose a list or dial a single number.`}
        </StyledSubtitle>
      </StyledHeading>

      <StyledForm>
        <StyledLabel>{t`Call setup`}</StyledLabel>

        <StyledFieldGroup>
          {/* 1. choose list / dial number toggle */}
          <StyledToggleRow>
            <StyledToggleOption
              isActive={sourceMode === 'list'}
              onClick={() => setSourceMode('list')}
              type="button"
            >
              {t`Choose list`}
            </StyledToggleOption>
            <StyledToggleOption
              isActive={sourceMode === 'phone'}
              onClick={() => setSourceMode('phone')}
              type="button"
            >
              {t`Dial number`}
            </StyledToggleOption>
          </StyledToggleRow>

          {sourceMode === 'list' ? (
            <Select
              dropdownId="dialer-home-list-select"
              fullWidth
              value={selectedListId}
              onChange={(value) => {
                if (value === '__create__') {
                  handleCreateList();
                  return;
                }
                setSelectedListId(value);
              }}
              options={[
                { value: '', label: t`— Select —`, Icon: IconList },
                ...listRecords.map((record) => ({
                  value: record.id,
                  label: record.name ?? t`Untitled list`,
                  Icon: IconList,
                })),
                { value: '__create__', label: t`Create list`, Icon: IconPlus },
              ]}
            />
          ) : (
            <TextInput
              value={phoneNumber}
              onChange={setPhoneNumber}
              placeholder={t`(555) 123-4567`}
              fullWidth
            />
          )}

          {/* 2. caller id + local presence */}
          <CallerIdSelectCard dropdownId="dialer-home-caller-id" />

          {!hasPermission && <AudioDeviceSelector />}

          {/* 3. calling mode */}
          <Select
            dropdownId="dialer-home-dialing-mode"
            fullWidth
            label={t`Calling mode`}
            value={dialingMode}
            onChange={(value) => setDialingMode(value)}
            options={[
              { value: 'parallel', label: t`Predictive Dialer (recommended)` },
              { value: 'single', label: t`Single (one call at a time)` },
            ]}
          />

          {/* 4. number of lines */}
          <Select
            dropdownId="dialer-home-number-of-lines"
            fullWidth
            label={t`Number of lines`}
            value={numberOfLines}
            onChange={(value) => setNumberOfLines(value)}
            options={[
              { value: '1', label: t`One` },
              { value: '2', label: t`Two` },
              { value: '3', label: t`Three` },
            ]}
          />

          {/* 5. assist mode */}
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
            title={t`Settings`}
            variant="secondary"
            Icon={IconSettings}
            onClick={() =>
              navigate(getSettingsPath(SettingsPath.AccountsPhoneNumbers))
            }
          />
          <Button
            title={t`Start Dialer`}
            onClick={() => void handleLaunch()}
            disabled={!canStart}
          />
        </StyledFooterActions>
      </StyledForm>
    </StyledPage>
  );
};
