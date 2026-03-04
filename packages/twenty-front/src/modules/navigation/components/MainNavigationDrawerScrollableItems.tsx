import { dialerSidebarOpenState } from '@/dialer/states/dialerSidebarOpenState';
import { NavigationDrawerOpenedSection } from '@/object-metadata/components/NavigationDrawerOpenedSection';
import { RemoteNavigationDrawerSection } from '@/object-metadata/components/RemoteNavigationDrawerSection';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { NavigationDrawerItemsCollapsableContainer } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItemsCollapsableContainer';
import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
import { NavigationDrawerSectionTitle } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSectionTitle';
import { NavigationDrawerSubItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSubItem';
import styled from '@emotion/styled';
import { lazy, Suspense, useState } from 'react';
import { useRecoilState } from 'recoil';
import { AppPath } from 'twenty-shared/types';
import {
  IconBolt,
  IconChevronDown,
  IconChevronRight,
  IconComment,
  IconPhone,
} from 'twenty-ui/display';

const CurrentWorkspaceMemberNavigationMenuItemFoldersDispatcher = lazy(() =>
  import(
    '@/navigation-menu-item/components/CurrentWorkspaceMemberNavigationMenuItemFoldersDispatcher'
  ).then((module) => ({
    default: module.CurrentWorkspaceMemberNavigationMenuItemFoldersDispatcher,
  })),
);

const WorkspaceNavigationMenuItemsDispatcher = lazy(() =>
  import(
    '@/navigation-menu-item/components/WorkspaceNavigationMenuItemsDispatcher'
  ).then((module) => ({
    default: module.WorkspaceNavigationMenuItemsDispatcher,
  })),
);

const StyledScrollableItemsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

export const MainNavigationDrawerScrollableItems = () => {
  const [dialerSidebarOpen, setDialerSidebarOpen] = useRecoilState(
    dialerSidebarOpenState,
  );
  const [agentFolderOpen, setAgentFolderOpen] = useState(true);

  return (
    <StyledScrollableItemsContainer>
      <NavigationDrawerSection>
        <NavigationDrawerItem
          label="Dialer"
          Icon={IconPhone}
          onClick={() => setDialerSidebarOpen(!dialerSidebarOpen)}
          active={dialerSidebarOpen}
          keyboard={['⌘', 'D']}
        />
      </NavigationDrawerSection>

      <NavigationDrawerSection>
        <NavigationDrawerItemsCollapsableContainer isGroup>
          <NavigationDrawerSectionTitle
            label="Agent"
            onClick={() => setAgentFolderOpen(!agentFolderOpen)}
            rightIcon={
              agentFolderOpen ? (
                <IconChevronDown size={16} />
              ) : (
                <IconChevronRight size={16} />
              )
            }
          />
          {agentFolderOpen && (
            <>
              <NavigationDrawerSubItem
                label="Chat"
                Icon={IconComment}
                to={AppPath.Agent}
              />
              <NavigationDrawerSubItem
                label="Skills"
                Icon={IconBolt}
                to={AppPath.AgentSkills}
              />
            </>
          )}
        </NavigationDrawerItemsCollapsableContainer>
      </NavigationDrawerSection>

      <NavigationDrawerOpenedSection />
      <Suspense fallback={null}>
        <CurrentWorkspaceMemberNavigationMenuItemFoldersDispatcher />
      </Suspense>
      <Suspense fallback={null}>
        <WorkspaceNavigationMenuItemsDispatcher />
      </Suspense>
      <RemoteNavigationDrawerSection />
    </StyledScrollableItemsContainer>
  );
};
