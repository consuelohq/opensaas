import { assistantSidebarOpenState } from '@/assistant/states/assistantState';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { useOpenRecordsSearchPageInCommandMenu } from '@/command-menu/hooks/useOpenRecordsSearchPageInCommandMenu';
import { dialerSidebarOpenState } from '@/dialer/states/dialerSidebarOpenState';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { isNavigationDrawerExpandedState } from '@/ui/navigation/states/isNavigationDrawerExpanded';
import { navigationDrawerExpandedMemorizedState } from '@/ui/navigation/states/navigationDrawerExpandedMemorizedState';
import { navigationMemorizedUrlState } from '@/ui/navigation/states/navigationMemorizedUrlState';
import { useLingui } from '@lingui/react/macro';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { AppPath, SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import {
  IconMessage,
  IconPhone,
  IconRobot,
  IconSearch,
  IconSettings,
  IconSparkles,
} from 'twenty-ui/display';
import { useIsMobile } from 'twenty-ui/utilities';

export const MainNavigationDrawerFixedItems = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const setNavigationMemorizedUrl = useSetRecoilState(
    navigationMemorizedUrlState,
  );

  const [isNavigationDrawerExpanded, setIsNavigationDrawerExpanded] =
    useRecoilState(isNavigationDrawerExpandedState);
  const setNavigationDrawerExpandedMemorized = useSetRecoilState(
    navigationDrawerExpandedMemorizedState,
  );

  const navigate = useNavigate();

  const { t } = useLingui();

  const { openRecordsSearchPage } = useOpenRecordsSearchPageInCommandMenu();
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const [dialerSidebarOpen, setDialerSidebarOpen] = useRecoilState(
    dialerSidebarOpenState,
  );
  const [assistantSidebarOpen, setAssistantSidebarOpen] = useRecoilState(
    assistantSidebarOpenState,
  );

  return (
    !isMobile && (
      <>
        <NavigationDrawerItem
          label={t`Search`}
          Icon={IconSearch}
          onClick={openRecordsSearchPage}
          keyboard={['/']}
          mouseUpNavigation={true}
        />
        <NavigationDrawerItem
          label={t`Ask AI`}
          Icon={IconSparkles}
          onClick={() => openAskAIPage({ resetNavigationStack: true })}
          keyboard={['@']}
          mouseUpNavigation={true}
        />
        <NavigationDrawerItem
          label="Consuelo"
          Icon={IconRobot}
          to={AppPath.Agent}
          active={location.pathname.startsWith('/agent')}
          keyboard={['a']}
        />
        <NavigationDrawerItem
          label="Mercury"
          Icon={IconPhone}
          onClick={() => setDialerSidebarOpen(!dialerSidebarOpen)}
          active={dialerSidebarOpen}
          keyboard={['⌘', 'D']}
        />
        <NavigationDrawerItem
          label={t`Assistant`}
          Icon={IconMessage}
          onClick={() => setAssistantSidebarOpen(!assistantSidebarOpen)}
          active={assistantSidebarOpen}
        />
        <NavigationDrawerItem
          label={t`Settings`}
          to={getSettingsPath(SettingsPath.ProfilePage)}
          onClick={() => {
            setNavigationDrawerExpandedMemorized(isNavigationDrawerExpanded);
            setIsNavigationDrawerExpanded(true);
            setNavigationMemorizedUrl(location.pathname + location.search);
            navigate(getSettingsPath(SettingsPath.ProfilePage));
          }}
          Icon={IconSettings}
        />
      </>
    )
  );
};
