import { CallerIdSelectCard } from '@/dialer/components/CallerIdSelectCard';
import { AudioDeviceSelector } from '@/dialer/components/AudioDeviceSelector';
import { OpportunityCallAnalyticsTab } from '@/dialer/components/OpportunityCallAnalyticsTab';
import { OpportunityCallCoachingTab } from '@/dialer/components/OpportunityCallCoachingTab';
import { OpportunityCallPeopleTab } from '@/dialer/components/OpportunityCallPeopleTab';
import { QueuePanel } from '@/dialer/components/QueuePanel';
import { useCoachingScripts } from '@/dialer/hooks/useCoachingScripts';
import { useOpportunityQueueWorkspace } from '@/dialer/hooks/useOpportunityQueueWorkspace';
import { callAssistModeState } from '@/dialer/states/callAssistModeState';
import { PageLayoutInitializationQueryEffect } from '@/page-layout/components/PageLayoutInitializationQueryEffect';
import { PageLayoutRelationWidgetsSyncEffect } from '@/page-layout/components/PageLayoutRelationWidgetsSyncEffect';
import { PageLayoutMainContent } from '@/page-layout/PageLayoutMainContent';
import { useCurrentPageLayout } from '@/page-layout/hooks/useCurrentPageLayout';
import { useSetIsPageLayoutInEditMode } from '@/page-layout/hooks/useSetIsPageLayoutInEditMode';
import { PageLayoutComponentInstanceContext } from '@/page-layout/states/contexts/PageLayoutComponentInstanceContext';
import { TabList } from '@/ui/layout/tab-list/components/TabList';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { IconChartBar } from '@tabler/icons-react';
import {
  IconLayoutSidebarRightCollapse,
  IconList,
  IconSettings,
  useIcons,
} from 'twenty-ui/display';
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

const OpportunityCallingWorkspaceContent = ({
  listId,
}: OpportunityCallingWorkspaceContentProps<
  OpportunityCallingWorkspaceProps,
  'listId'
>) => {
  const { currentPageLayout } = useCurrentPageLayout();
  const callAssistMode = useRecoilValue(callAssistModeState);
  const callStateAtom = useRecoilValue(callStateAtom);
  const { selectedScript } = useCoachingScripts();
  const { wrapUpState, continueList, endList } = useOpportunityQueueWorkspace({
    listId,
  });
  const { getIcon } = useIcons();
  const navigate = useNavigate();
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
    if (callState.status === 'active') {
      setSelectedTabId('coaching');
      return;
    }

    if (callState.status === 'ended') {
      setSelectedTabId('analytics');
    }
  }, [callState.status]);

  return (
    <StyledContainer>
      <StyledSidebar>
        <QueuePanel />
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
                {assistMode === 'script'
                  ? activeScriptLabel
                    ? t`Script mode is active - ${activeScriptLabel}`
                    : t`Script mode is active`
                  : t`AI coaching is active`}
              </div>
              <Button
                title={t`Open AI settings`}
                variant="secondary"
                onClick={() => navigate(getSettingsPath(SettingsPath.AI))}
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
