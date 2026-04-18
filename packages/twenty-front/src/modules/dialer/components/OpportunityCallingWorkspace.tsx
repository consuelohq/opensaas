import { AudioDeviceSelector } from '@/dialer/components/AudioDeviceSelector';
import { CallerIdSelectCard } from '@/dialer/components/CallerIdSelectCard';
import { OpportunityCallAnalyticsTab } from '@/dialer/components/OpportunityCallAnalyticsTab';
import { OpportunityCallCoachingTab } from '@/dialer/components/OpportunityCallCoachingTab';
import { OpportunityCallPeopleTab } from '@/dialer/components/OpportunityCallPeopleTab';
import { QueuePanel } from '@/dialer/components/QueuePanel';
import { useCoaching } from '@/dialer/hooks/useCoaching';
import { useCoachingScripts } from '@/dialer/hooks/useCoachingScripts';
import { useOpportunityQueueWorkspace } from '@/dialer/hooks/useOpportunityQueueWorkspace';
import { useResetCoachingState } from '@/dialer/hooks/useResetCoachingState';
import { useTranscript } from '@/dialer/hooks/useTranscript';
import { callAssistModeState } from '@/dialer/states/callAssistModeState';
import { callStateAtom } from '@/dialer/states/callStateAtom';
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
import { useEffect, useMemo, useState } from 'react';
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
  const { status: callStatus } = useRecoilValue(callStateAtom);
  const { selectedScript } = useCoachingScripts();
  const {
    wrapUpState,
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
              wrapUpState={wrapUpState}
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
