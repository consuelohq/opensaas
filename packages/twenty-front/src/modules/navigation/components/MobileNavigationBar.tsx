import { useCommandMenu } from '@/command-menu/hooks/useCommandMenu';
import { useOpenRecordsSearchPageInCommandMenu } from '@/command-menu/hooks/useOpenRecordsSearchPageInCommandMenu';
import { isCommandMenuOpenedState } from '@/command-menu/states/isCommandMenuOpenedState';
import { MAIN_CONTEXT_STORE_INSTANCE_ID } from '@/context-store/constants/MainContextStoreInstanceId';
import { contextStoreCurrentObjectMetadataItemIdComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemIdComponentState';
import { useDefaultHomePagePath } from '@/navigation/hooks/useDefaultHomePagePath';
import { useFilteredObjectMetadataItems } from '@/object-metadata/hooks/useFilteredObjectMetadataItems';
import { isNavigationDrawerExpandedState } from '@/ui/navigation/states/isNavigationDrawerExpanded';
import { useRecoilComponentState } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentState';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { AppPath } from 'twenty-shared/types';
import {
  type IconComponent,
  IconHome,
  IconList,
  IconSearch,
} from 'twenty-ui/display';
import { NavigationBar } from 'twenty-ui/navigation';
import { currentMobileNavigationDrawerState } from '@/navigation/states/currentMobileNavigationDrawerState';

type NavigationBarItemName = 'main' | 'search' | 'home';

export const MobileNavigationBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { defaultHomePagePath } = useDefaultHomePagePath();
  const [isCommandMenuOpened] = useRecoilState(isCommandMenuOpenedState);
  const { closeCommandMenu } = useCommandMenu();
  const { openRecordsSearchPage } = useOpenRecordsSearchPageInCommandMenu();
  const [isNavigationDrawerExpanded, setIsNavigationDrawerExpanded] =
    useRecoilState(isNavigationDrawerExpandedState);
  const [currentMobileNavigationDrawer, setCurrentMobileNavigationDrawer] =
    useRecoilState(currentMobileNavigationDrawerState);
  const { alphaSortedActiveNonSystemObjectMetadataItems } =
    useFilteredObjectMetadataItems();

  const [, setContextStoreCurrentObjectMetadataItemId] =
    useRecoilComponentState(
      contextStoreCurrentObjectMetadataItemIdComponentState,
      MAIN_CONTEXT_STORE_INSTANCE_ID,
    );

  const activeItemName = isNavigationDrawerExpanded
    ? currentMobileNavigationDrawer
    : isCommandMenuOpened
      ? 'search'
      : location.pathname === AppPath.Home
        ? 'home'
        : 'main';

  const items: {
    name: NavigationBarItemName;
    Icon: IconComponent;
    onClick: () => void;
  }[] = [
    {
      name: 'main',
      Icon: IconList,
      onClick: () => {
        closeCommandMenu();
        setIsNavigationDrawerExpanded(
          (previousIsOpen) => activeItemName !== 'main' || !previousIsOpen,
        );
        setCurrentMobileNavigationDrawer('main');

        if (location.pathname === AppPath.Home && defaultHomePagePath !== AppPath.Home) {
          navigate(defaultHomePagePath);
        }
      },
    },
    {
      name: 'search',
      Icon: IconSearch,
      onClick: () => {
        setIsNavigationDrawerExpanded(false);
        closeCommandMenu();

        if (location.pathname === AppPath.Home) {
          const firstObjectMetadataItem =
            alphaSortedActiveNonSystemObjectMetadataItems[0];
          if (firstObjectMetadataItem !== undefined) {
            setContextStoreCurrentObjectMetadataItemId(
              firstObjectMetadataItem.id,
            );
          }
        }

        openRecordsSearchPage();
      },
    },
    {
      name: 'home',
      Icon: IconHome,
      onClick: () => {
        setIsNavigationDrawerExpanded(false);
        closeCommandMenu();
        navigate(AppPath.Home);
      },
    },
  ];

  return <NavigationBar activeItemName={activeItemName} items={items} />;
};
