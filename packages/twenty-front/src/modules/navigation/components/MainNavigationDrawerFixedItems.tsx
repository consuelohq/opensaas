import { useOpenRecordsSearchPageInCommandMenu } from '@/command-menu/hooks/useOpenRecordsSearchPageInCommandMenu';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { useLingui } from '@lingui/react/macro';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';
import { IconHome, IconSearch } from 'twenty-ui/display';
import { useIsMobile } from 'twenty-ui/utilities';

export const MainNavigationDrawerFixedItems = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLingui();

  const { openRecordsSearchPage } = useOpenRecordsSearchPageInCommandMenu();

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
          active={location.pathname === AppPath.Home}
          label={t`Home`}
          Icon={IconHome}
          onClick={() => navigate(AppPath.Home)}
          to={AppPath.Home}
          keyboard={['G', 'H']}
        />
      </>
    )
  );
};
