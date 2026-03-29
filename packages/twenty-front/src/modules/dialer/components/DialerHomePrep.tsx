import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { AppPath, SettingsPath } from 'twenty-shared/types';
import { getAppPath, getSettingsPath } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/input';
import { Card } from 'twenty-ui/layout';

import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { AudioDeviceSelector } from '@/dialer/components/AudioDeviceSelector';
import { CallerIdSelectCard } from '@/dialer/components/CallerIdSelectCard';
import { CallButton } from '@/dialer/components/CallButton';
import { DialPad } from '@/dialer/components/DialPad';
import { useCoachingScripts } from '@/dialer/hooks/useCoachingScripts';
import { useQueueOperations } from '@/dialer/hooks/useQueueOperations';
import { useTwilioConfigStatus } from '@/dialer/hooks/useTwilioConfigStatus';
import { callAssistModeState } from '@/dialer/states/callAssistModeState';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useOpenObjectRecordsSpreadsheetImportDialog } from '@/object-record/spreadsheet-import/hooks/useOpenObjectRecordsSpreadsheetImportDialog';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { Select } from '@/ui/input/components/Select';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';

import { IconList, IconRobot, IconUpload, IconUser } from 'twenty-ui/display';

import { FeatureFlagKey } from '~/generated-metadata/graphql';

type HomeSource = 'person' | 'list' | 'segment' | 'csv' | 'ai';

type OpportunityRecord = ObjectRecord & {
  id: string;
  name?: string | null;
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
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

const StyledDescription = styled.p`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: 1.6;
  margin: 0;
`;

const StyledSourceGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(3)};
  grid-template-columns: repeat(5, minmax(0, 1fr));

  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const StyledSourceCard = styled.button<{ isActive: boolean }>`
  align-items: flex-start;
  background: ${({ isActive, theme }) =>
    isActive ? theme.background.secondary : theme.background.primary};
  border: 1px solid
    ${({ isActive, theme }) =>
      isActive ? theme.color.blue : theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  text-align: left;
`;

const StyledSourceTitle = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledSourceCopy = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: 1.5;
`;

const StyledPanelGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(4)};
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const StyledPanel = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledSectionTitle = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledInlineActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
`;

export const DialerHomePrep = () => {
  const navigate = useNavigate();
  const isAiEnabled = useIsFeatureEnabled(FeatureFlagKey.IS_AI_ENABLED);
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const { status } = useTwilioConfigStatus();
  const [assistMode, setAssistMode] = useRecoilState(callAssistModeState);
  const { selectedScriptId, setSelectedScriptId, scripts } =
    useCoachingScripts();
  const [source, setSource] = useState<HomeSource>('person');
  const [selectedListId, setSelectedListId] = useState<string>('');
  const { openObjectRecordsSpreadsheetImportDialog } =
    useOpenObjectRecordsSpreadsheetImportDialog('person');
  const { startQueue } = useQueueOperations();

  const { objectMetadataItem: personMetadataItem } = useObjectMetadataItem({
    objectNameSingular: 'person',
  });
  const { records: listRecords } = useFindManyRecords<OpportunityRecord>({
    objectNameSingular: 'opportunity',
    limit: 50,
  });

  const personLabel = personMetadataItem?.labelPlural ?? t`People`;
  const personLabelLowercase = personLabel.toLowerCase();
  const personObjectNamePlural = personMetadataItem?.namePlural ?? 'people';

  const startSelectedList = async () => {
    if (!selectedListId) {
      return;
    }

    await startQueue(selectedListId);
    navigate(
      getAppPath(AppPath.RecordShowPage, {
        objectNameSingular: 'opportunity',
        objectRecordId: selectedListId,
      }),
    );
  };

  return (
    <StyledContainer>
      <StyledHeading>
        <StyledTitle>{t`Who do you want to call?`}</StyledTitle>
        <StyledDescription>
          {t`Start a one-off call, launch a list, or prepare your next outreach session from one place.`}
        </StyledDescription>
      </StyledHeading>

      <StyledSourceGrid>
        <StyledSourceCard
          isActive={source === 'person'}
          onClick={() => setSource('person')}
          type="button"
        >
          <IconUser size={18} />
          <StyledSourceTitle>{personLabel}</StyledSourceTitle>
          <StyledSourceCopy>
            {t`Dial a single number with coaching or script mode.`}
          </StyledSourceCopy>
        </StyledSourceCard>
        <StyledSourceCard
          isActive={source === 'list'}
          onClick={() => setSource('list')}
          type="button"
        >
          <IconList size={18} />
          <StyledSourceTitle>{t`Existing list`}</StyledSourceTitle>
          <StyledSourceCopy>
            {t`Jump into the fullscreen list workspace and start dialing.`}
          </StyledSourceCopy>
        </StyledSourceCard>
        <StyledSourceCard
          isActive={source === 'segment'}
          onClick={() => setSource('segment')}
          type="button"
        >
          <IconList size={18} />
          <StyledSourceTitle>{t`Filtered segment`}</StyledSourceTitle>
          <StyledSourceCopy>
            {t`Build a targeted segment from saved views before you call.`}
          </StyledSourceCopy>
        </StyledSourceCard>
        <StyledSourceCard
          isActive={source === 'csv'}
          onClick={() => setSource('csv')}
          type="button"
        >
          <IconUpload size={18} />
          <StyledSourceTitle>{t`CSV upload`}</StyledSourceTitle>
          <StyledSourceCopy>
            {t`Import a fresh batch of leads and turn them into the next call run.`}
          </StyledSourceCopy>
        </StyledSourceCard>
        <StyledSourceCard
          isActive={source === 'ai'}
          onClick={() => setSource('ai')}
          type="button"
        >
          <IconRobot size={18} />
          <StyledSourceTitle>{t`AI-built list`}</StyledSourceTitle>
          <StyledSourceCopy>
            {t`Use Ask AI to figure out who should be called next.`}
          </StyledSourceCopy>
        </StyledSourceCard>
      </StyledSourceGrid>

      <StyledPanelGrid>
        <StyledPanel rounded>
          {source === 'person' && (
            <>
              <StyledSectionTitle>{t`Single call`}</StyledSectionTitle>
              {status?.configured ? (
                <>
                  <DialPad />
                  <CallButton />
                </>
              ) : (
                <StyledDescription>
                  {t`Finish your phone setup before starting outbound calls.`}
                </StyledDescription>
              )}
            </>
          )}

          {source === 'list' && (
            <>
              <StyledSectionTitle>{t`Choose a list`}</StyledSectionTitle>
              <Select
                dropdownId="dialer-home-list-select"
                fullWidth
                label={t`List`}
                value={selectedListId}
                onChange={setSelectedListId}
                options={listRecords.map((record) => ({
                  value: record.id,
                  label: record.name ?? t`Untitled list`,
                  Icon: IconList,
                }))}
              />
              <StyledInlineActions>
                <Button
                  title={t`Open fullscreen workspace`}
                  onClick={() => void startSelectedList()}
                />
              </StyledInlineActions>
            </>
          )}

          {source === 'segment' && (
            <>
              <StyledSectionTitle>{t`Build from a segment`}</StyledSectionTitle>
              <StyledDescription>
                {t`Open your people view, apply the right filters, and save the segment you want to call.`}
              </StyledDescription>
              <StyledInlineActions>
                <Button
                  title={t`Open ${personLabel}`}
                  variant="secondary"
                  onClick={() =>
                    navigate(
                      getAppPath(AppPath.RecordIndexPage, {
                        objectNamePlural: personObjectNamePlural,
                      }),
                    )
                  }
                />
              </StyledInlineActions>
            </>
          )}

          {source === 'csv' && (
            <>
              <StyledSectionTitle>{t`Import a CSV`}</StyledSectionTitle>
              <StyledDescription>
                {t`Upload a CSV into ${personLabelLowercase} first, then turn the imported records into your next calling list.`}
              </StyledDescription>
              <StyledInlineActions>
                <Button
                  title={t`Import CSV`}
                  variant="secondary"
                  onClick={() => openObjectRecordsSpreadsheetImportDialog()}
                />
              </StyledInlineActions>
            </>
          )}

          {source === 'ai' && (
            <>
              <StyledSectionTitle>{t`Build with Ask AI`}</StyledSectionTitle>
              <StyledDescription>
                {t`Ask AI to find the best people to call, then turn that answer into your next list.`}
              </StyledDescription>
              <StyledInlineActions>
                <Button
                  title={t`Ask AI`}
                  variant="secondary"
                  onClick={() => openAskAIPage({ resetNavigationStack: false })}
                  disabled={!isAiEnabled}
                />
              </StyledInlineActions>
            </>
          )}
        </StyledPanel>

        <StyledPanel rounded>
          <StyledSectionTitle>{t`Call setup`}</StyledSectionTitle>

          <Select
            dropdownId="dialer-home-assist-mode"
            fullWidth
            label={t`Assist mode`}
            value={assistMode}
            onChange={(value) => setAssistMode(value)}
            options={[
              { value: 'ai', label: t`AI coaching` },
              { value: 'script', label: t`Script mode` },
            ]}
          />

          {assistMode === 'script' && (
            <Select
              dropdownId="dialer-home-script-select"
              fullWidth
              label={t`Script`}
              value={selectedScriptId ?? ''}
              onChange={(value) => setSelectedScriptId(value)}
              options={scripts.map((script) => ({
                value: script.id,
                label: script.name,
              }))}
            />
          )}

          <CallerIdSelectCard dropdownId="dialer-home-caller-id" />

          <AudioDeviceSelector />

          <StyledInlineActions>
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
          </StyledInlineActions>
        </StyledPanel>
      </StyledPanelGrid>
    </StyledContainer>
  );
};
