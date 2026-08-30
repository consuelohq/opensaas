import { AudioDeviceSelector } from '@/dialer/components/AudioDeviceSelector';
import { CallerIdSelectCard } from '@/dialer/components/CallerIdSelectCard';
import { OpportunityCallAnalyticsTab } from '@/dialer/components/OpportunityCallAnalyticsTab';
import { OpportunityCallCoachingTab } from '@/dialer/components/OpportunityCallCoachingTab';
import { OpportunityCallPeopleTab } from '@/dialer/components/OpportunityCallPeopleTab';
import {
  PostCallWrapUpModal,
  type PostCallWrapUpMode,
} from '@/dialer/components/PostCallWrapUpModal';
import { QueuePanel } from '@/dialer/components/QueuePanel';
import { useCoaching } from '@/dialer/hooks/useCoaching';
import { useCoachingScripts } from '@/dialer/hooks/useCoachingScripts';
import { useOpportunityQueueWorkspace } from '@/dialer/hooks/useOpportunityQueueWorkspace';
import { useResetCoachingState } from '@/dialer/hooks/useResetCoachingState';
import { useTranscript } from '@/dialer/hooks/useTranscript';
import { callAssistModeState } from '@/dialer/states/callAssistModeState';
import { postCallAnalysisState } from '@/dialer/states/coachingState';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { activeQueueState } from '@/dialer/states/queueState';
import { PageLayoutInitializationQueryEffect } from '@/page-layout/components/PageLayoutInitializationQueryEffect';
import { PageLayoutRelationWidgetsSyncEffect } from '@/page-layout/components/PageLayoutRelationWidgetsSyncEffect';
import { PageLayoutMainContent } from '@/page-layout/PageLayoutMainContent';
import { useCurrentPageLayout } from '@/page-layout/hooks/useCurrentPageLayout';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';
import { useSetIsPageLayoutInEditMode } from '@/page-layout/hooks/useSetIsPageLayoutInEditMode';
import { PageLayoutComponentInstanceContext } from '@/page-layout/states/contexts/PageLayoutComponentInstanceContext';
import { TabList } from '@/ui/layout/tab-list/components/TabList';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { SettingsPath } from 'twenty-shared/types';
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  IconChartBar,
  IconLayoutSidebarRightCollapse,
  IconList,
  IconSettings,
  useIcons,
} from 'twenty-ui/display';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { Button } from 'twenty-ui/input';

const StyledContainer = styled.div`
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  height: 100%;
  width: 100%;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const StyledSidebar = styled.div`
  background: ${({ theme }) => theme.background.secondary};
  border-right: 1px solid ${({ theme }) => theme.border.color.medium};
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledMain = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const StyledTabContent = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
`;

const StyledSettingsPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const POST_CALL_WRAP_UP_COUNTDOWN_SECONDS = 3;

const mapAnalysisOutcomeToDisposition = (outcome?: string | null) => {
  switch (outcome) {
    case 'interested':
      return 'connected';
    case 'not_interested':
      return 'not-interested';
    case 'callback_scheduled':
      return 'follow-up';
    case 'voicemail':
      return 'voicemail';
    case 'no_answer':
      return 'no-answer';
    case 'wrong_number':
      return 'wrong-number';
    default:
      return null;
  }
};

type OpportunityCallingWorkspaceProps = {
  listId: string;
  pageLayoutId: string;
};

type OpportunityCallingWorkspaceContentProps = {
  listId: string;
};

const OpportunityCallingWorkspaceContent = ({
  listId,
}: OpportunityCallingWorkspaceContentProps) => {
  useResetCoachingState();
  useCoaching();
  useTranscript();

  const { currentPageLayout } = useCurrentPageLayout();
  const callAssistMode = useRecoilValue(callAssistModeState);
  const activeQueue = useRecoilValue(activeQueueState);
  const postCallAnalysis = useRecoilValue(postCallAnalysisState);
  const { status: callStatus } = useRecoilValue(callStateAtom);
  const { selectedScript } = useCoachingScripts();
  const {
    wrapUpState,
    currentQueueItem,
    continueList,
    endList,
    pauseList,
    resumeList,
    skipCurrentListMember,
    restartList,
  } = useOpportunityQueueWorkspace({ listId });
  const { getIcon } = useIcons();
  const navigateSettings = useNavigateSettings();
  const [selectedTabId, setSelectedTabId] = useState('coaching');
  const activeScriptLabel = selectedScript?.name ?? '';
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);
  const [autoAdvanceCancelled, setAutoAdvanceCancelled] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(
    POST_CALL_WRAP_UP_COUNTDOWN_SECONDS,
  );
  const [selectedManualDisposition, setSelectedManualDisposition] = useState<
    string | null
  >(null);

  useEffect(() => {
    setAutoAdvanceEnabled(activeQueue?.settings.autoAdvance ?? true);
  }, [activeQueue?.id, activeQueue?.settings.autoAdvance]);

  useEffect(() => {
    setAutoAdvanceCancelled(false);
    setSelectedManualDisposition(null);
    setCountdownSeconds(POST_CALL_WRAP_UP_COUNTDOWN_SECONDS);
  }, [wrapUpState?.listMemberId]);

  const suggestedDisposition = useMemo(() => {
    if (!wrapUpState) {
      return null;
    }

    if (wrapUpState.outcome === 'no-answer') {
      return 'no-answer';
    }

    if (postCallAnalysis?.callId !== wrapUpState.callSid) {
      return null;
    }

    return mapAnalysisOutcomeToDisposition(postCallAnalysis?.outcome);
  }, [postCallAnalysis?.callId, postCallAnalysis?.outcome, wrapUpState]);

  const selectedDispositionForAdvance =
    suggestedDisposition ?? selectedManualDisposition;

  const wrapUpMode = useMemo<PostCallWrapUpMode>(() => {
    if (selectedDispositionForAdvance === null) {
      return 'manual-disposition';
    }

    if (autoAdvanceEnabled && !autoAdvanceCancelled) {
      return 'auto-advance';
    }

    return 'manual-advance';
  }, [autoAdvanceCancelled, autoAdvanceEnabled, selectedDispositionForAdvance]);

  const wrapUpContactName = useMemo(() => {
    const contactFullName = [
      currentQueueItem?.contact.firstName,
      currentQueueItem?.contact.lastName,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      currentQueueItem?.contact.name ??
      (contactFullName.length > 0 ? contactFullName : null) ??
      currentQueueItem?.contact.phone ??
      t`Current contact`
    );
  }, [currentQueueItem]);

  const handleAdvanceToNextCall = useCallback(() => {
    if (selectedDispositionForAdvance === null) {
      return;
    }

    void continueList(selectedDispositionForAdvance);
  }, [continueList, selectedDispositionForAdvance]);

  const handleCancelAutoAdvance = useCallback(() => {
    setAutoAdvanceCancelled(true);
  }, []);

  const handleAutoAdvanceChange = useCallback((enabled: boolean) => {
    setAutoAdvanceEnabled(enabled);
    setAutoAdvanceCancelled(!enabled);
    setCountdownSeconds(POST_CALL_WRAP_UP_COUNTDOWN_SECONDS);
  }, []);

  useEffect(() => {
    if (
      !wrapUpState ||
      wrapUpMode !== 'auto-advance' ||
      selectedDispositionForAdvance === null
    ) {
      return;
    }

    setCountdownSeconds(POST_CALL_WRAP_UP_COUNTDOWN_SECONDS);

    const countdownInterval = window.setInterval(() => {
      setCountdownSeconds((currentCountdownSeconds) =>
        Math.max(currentCountdownSeconds - 1, 0),
      );
    }, 1000);

    const advanceTimer = window.setTimeout(() => {
      void continueList(selectedDispositionForAdvance);
    }, POST_CALL_WRAP_UP_COUNTDOWN_SECONDS * 1000);

    return () => {
      window.clearInterval(countdownInterval);
      window.clearTimeout(advanceTimer);
    };
  }, [continueList, selectedDispositionForAdvance, wrapUpMode, wrapUpState]);

  const baseTabs = useMemo(() => {
    return (currentPageLayout?.tabs ?? [])
      .filter((tab) => tab.title !== 'Home')
      .map((tab) => ({
        id: tab.id,
        title: tab.title,
        Icon: tab.icon ? getIcon(tab.icon) : undefined,
      }));
  }, [currentPageLayout?.tabs, getIcon]);

  const tabs = useMemo(
    () => [
      {
        id: 'coaching',
        title: t`Coaching`,
        Icon: IconLayoutSidebarRightCollapse,
      },
      { id: 'people', title: t`People`, Icon: IconList },
      { id: 'analytics', title: t`Analytics`, Icon: IconChartBar },
      ...baseTabs,
      { id: 'settings', title: t`Settings`, Icon: IconSettings },
    ],
    [baseTabs],
  );

  useEffect(() => {
    if (callStatus === 'active') {
      setSelectedTabId('coaching');
      return;
    }

    if (callStatus === 'ended') {
      setSelectedTabId('analytics');
    }
  }, [callStatus]);

  return (
    <StyledContainer>
      {wrapUpState && (
        <PostCallWrapUpModal
          isOpen
          mode={wrapUpMode}
          contactName={wrapUpContactName}
          durationSeconds={wrapUpState.duration}
          disposition={selectedDispositionForAdvance}
          countdownSeconds={countdownSeconds}
          autoAdvanceEnabled={autoAdvanceEnabled}
          selectedDisposition={selectedManualDisposition}
          onAdvance={handleAdvanceToNextCall}
          onCancelAutoAdvance={handleCancelAutoAdvance}
          onAutoAdvanceChange={handleAutoAdvanceChange}
          onSelectDisposition={setSelectedManualDisposition}
        />
      )}

      <StyledSidebar>
        <QueuePanel
          onPauseQueue={pauseList}
          onResumeQueue={resumeList}
          onSkipQueueItem={skipCurrentListMember}
          onRestartQueue={restartList}
        />
      </StyledSidebar>

      <StyledMain>
        <TabList
          tabs={tabs}
          componentInstanceId={`opportunity-calling-tabs-${listId}`}
          behaveAsLinks={false}
          onChangeTab={setSelectedTabId}
        />

        <StyledTabContent>
          {selectedTabId === 'coaching' && <OpportunityCallCoachingTab />}
          {selectedTabId === 'people' && (
            <OpportunityCallPeopleTab listId={listId} />
          )}
          {selectedTabId === 'analytics' && (
            <OpportunityCallAnalyticsTab
              wrapUpState={null}
              onContinueList={continueList}
              onEndList={endList}
            />
          )}
          {selectedTabId === 'settings' && (
            <StyledSettingsPanel>
              <CallerIdSelectCard
                dropdownId={`opportunity-caller-id-${listId}`}
              />
              <AudioDeviceSelector />
              <div>
                {callAssistMode === 'script'
                  ? activeScriptLabel
                    ? t`Script mode is active - ${activeScriptLabel}`
                    : t`Script mode is active`
                  : t`AI coaching is active`}
              </div>
              <Button
                title={t`Open AI settings`}
                variant="secondary"
                onClick={() => navigateSettings(SettingsPath.AI)}
              />
            </StyledSettingsPanel>
          )}
          {selectedTabId !== 'coaching' &&
            selectedTabId !== 'people' &&
            selectedTabId !== 'analytics' &&
            selectedTabId !== 'settings' &&
            currentPageLayout && (
              <PageLayoutMainContent tabId={selectedTabId} />
            )}
        </StyledTabContent>
      </StyledMain>
    </StyledContainer>
  );
};

export const OpportunityCallingWorkspace = ({
  listId,
  pageLayoutId,
}: OpportunityCallingWorkspaceProps) => {
  const { setIsPageLayoutInEditMode } =
    useSetIsPageLayoutInEditMode(pageLayoutId);

  return (
    <PageLayoutComponentInstanceContext.Provider
      value={{ instanceId: pageLayoutId }}
    >
      <PageLayoutInitializationQueryEffect
        pageLayoutId={pageLayoutId}
        onInitialized={() => setIsPageLayoutInEditMode(false)}
      />
      <PageLayoutRelationWidgetsSyncEffect pageLayoutId={pageLayoutId} />
      <OpportunityCallingWorkspaceContent listId={listId} />
    </PageLayoutComponentInstanceContext.Provider>
  );
};
