import { captureException } from '@sentry/react';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { AppPath, SettingsPath } from 'twenty-shared/types';
import { getAppPath, getSettingsPath } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/input';

import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { AudioDeviceSelector } from '@/dialer/components/AudioDeviceSelector';
import { CallerIdSelectCard } from '@/dialer/components/CallerIdSelectCard';
import { useAudioDevices } from '@/dialer/hooks/useAudioDevices';
import { useCoachingScripts } from '@/dialer/hooks/useCoachingScripts';
import { useQueueOperations } from '@/dialer/hooks/useQueueOperations';
import { callAssistModeState } from '@/dialer/states/callAssistModeState';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useOpenObjectRecordsSpreadsheetImportDialog } from '@/object-record/spreadsheet-import/hooks/useOpenObjectRecordsSpreadsheetImportDialog';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { Select } from '@/ui/input/components/Select';
import { TextInput } from '@/ui/input/components/TextInput';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';

import { IconList, IconRobot, IconUpload } from 'twenty-ui/display';

import { FeatureFlagKey } from '~/generated-metadata/graphql';

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

const StyledHeader = styled.div`
  align-items: flex-start;
  display: flex;
  justify-content: space-between;

  @media (max-width: 600px) {
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing(3)};
  }
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

const StyledActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  flex-shrink: 0;
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

const StyledDisabledOverlay = styled.div`
  opacity: 0.4;
  pointer-events: none;
`;

const StyledFooterActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
`;

// -- component --

export const DialerHomePrep = () => {
  const navigate = useNavigate();
  const isAiEnabled = useIsFeatureEnabled(FeatureFlagKey.IS_AI_ENABLED);
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const [callAssistMode, setCallAssistMode] =
    useRecoilState(callAssistModeState);
  const { selectedCoachingScriptId, setSelectedCoachingScriptId, coachingScripts } =
    useCoachingScripts();
  const { hasPermission } = useAudioDevices();
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const { openObjectRecordsSpreadsheetImportDialog } =
    useOpenObjectRecordsSpreadsheetImportDialog('person');
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
      <StyledHeader>
        <StyledHeading>
          <StyledTitle>{t`Who do you want to call?`}</StyledTitle>
          <StyledSubtitle>
            {t`Choose a list or dial a single number.`}
          </StyledSubtitle>
        </StyledHeading>
        <StyledActions>
          <Button
            title={t`Import CSV`}
            variant="secondary"
            size="small"
            Icon={IconUpload}
            onClick={() => openObjectRecordsSpreadsheetImportDialog()}
          />
          <Button
            title={t`Ask AI`}
            variant="secondary"
            size="small"
            Icon={IconRobot}
            onClick={() => openAskAIPage({ resetNavigationStack: false })}
            disabled={!isAiEnabled}
          />
        </StyledActions>
      </StyledHeader>

      <StyledForm>
        {/* list selection */}
        <StyledFieldGroup>
          <StyledLabel>{t`Choose a list`}</StyledLabel>
          {hasPhone ? (
            <StyledDisabledOverlay>
              <Select
                dropdownId="dialer-home-list-select"
                fullWidth
                label={t`List`}
                value=""
                onChange={() => {}}
                options={[]}
                disabled
              />
            </StyledDisabledOverlay>
          ) : (
            <Select
              dropdownId="dialer-home-list-select"
              fullWidth
              label={t`List`}
              value={selectedListId}
              onChange={handleListChange}
              options={listRecords.map((record) => ({
                value: record.id,
                label: record.name ?? t`Untitled list`,
                Icon: IconList,
              }))}
            />
          )}
        </StyledFieldGroup>

        <StyledDivider>{t`or`}</StyledDivider>

        {/* single phone number */}
        <StyledFieldGroup>
          <StyledLabel>{t`Dial a number`}</StyledLabel>
          {hasList ? (
            <StyledDisabledOverlay>
              <TextInput
                value=""
                onChange={() => {}}
                placeholder={t`(555) 123-4567`}
                disabled
                fullWidth
              />
            </StyledDisabledOverlay>
          ) : (
            <TextInput
              value={phoneNumber}
              onChange={handlePhoneChange}
              placeholder={t`(555) 123-4567`}
              fullWidth
            />
          )}
        </StyledFieldGroup>

        {/* call setup */}
        <StyledFieldGroup>
          <StyledLabel>{t`Call setup`}</StyledLabel>

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

          <CallerIdSelectCard dropdownId="dialer-home-caller-id" />

          {!hasPermission && <AudioDeviceSelector />}
        </StyledFieldGroup>

        {/* launch */}
        <StyledFooterActions>
          <Button
            title={t`Open fullscreen workspace`}
            onClick={() => void handleLaunch()}
            disabled={!hasList && !hasPhone}
          />
          <Button
            title={t`Manage scripts`}
            variant="secondary"
            onClick={() => navigate(getSettingsPath(SettingsPath.AI))}
          />
          <Button
            title={t`Phone settings`}
            variant="secondary"
            onClick={() =>
              navigate(getSettingsPath(SettingsPath.AccountsPhoneNumbers))
            }
          />
        </StyledFooterActions>
      </StyledForm>
    </StyledPage>
  );
};
