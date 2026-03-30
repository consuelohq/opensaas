import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { useLingui } from '@lingui/react/macro';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { useCopyToClipboard } from '~/hooks/useCopyToClipboard';
import { useOpenKeyboardShortcutsPageInCommandMenu } from '@/command-menu/hooks/useOpenKeyboardShortcutsPageInCommandMenu';
import { openSentryFeedbackForm } from '@/error-handler/utils/openSentryFeedbackForm';
import {
  CONSUELO_CHANGELOG_URL,
  CONSUELO_DISCORD_COMMUNITY_URL,
  DOWNLOAD_APP_ITEMS,
  NAVIGATION_DRAWER_SUPPORT_DROPDOWN_ID,
  type DownloadAppItemId,
} from '@/navigation/constants/navigation-drawer-support-menu.constants';
import { getDocumentationUrl } from '@/support/utils/getDocumentationUrl';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuHeader } from '@/ui/layout/dropdown/components/DropdownMenuHeader/DropdownMenuHeader';
import { DropdownMenuHeaderLeftComponent } from '@/ui/layout/dropdown/components/DropdownMenuHeader/internal/DropdownMenuHeaderLeftComponent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { DropdownMenuSeparator } from '@/ui/layout/dropdown/components/DropdownMenuSeparator';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { isNavigationDrawerExpandedState } from '@/ui/navigation/states/isNavigationDrawerExpanded';
import { navigationDrawerExpandedMemorizedState } from '@/ui/navigation/states/navigationDrawerExpandedMemorizedState';
import { navigationMemorizedUrlState } from '@/ui/navigation/states/navigationMemorizedUrlState';
import { getOsControlSymbol } from 'twenty-ui/utilities';
import { AppPath, SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import {
  IconArrowLeft,
  IconBook2,
  IconBrandChrome,
  IconBrandDiscord,
  IconBrandOpenai,
  IconBrandSlack,
  IconBrandTabler,
  IconBrandWindows,
  IconCommand,
  IconDeviceLaptop,
  IconDownload,
  IconExternalLink,
  IconHelpCircle,
  IconMessageCircle,
  IconSettings,
  IconStatusChange,
  IconTerminal2,
} from '@tabler/icons-react';
import { MenuItem } from 'twenty-ui/navigation';

const SUPPORT_EMAIL = 'support@consuelohq.com';

const StyledHelpButton = styled.button`
  align-items: center;
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.strong};
  border-radius: ${({ theme }) => theme.border.radius.rounded};
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;
  display: inline-flex;
  height: ${({ theme }) => theme.spacing(7)};
  justify-content: center;
  transition:
    background ${({ theme }) => theme.animation.duration.normal}s,
    border-color ${({ theme }) => theme.animation.duration.normal}s,
    color ${({ theme }) => theme.animation.duration.normal}s;
  width: ${({ theme }) => theme.spacing(7)};

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
    border-color: ${({ theme }) => theme.border.color.strong};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledDropdownFrame = styled(motion.div)`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  display: flex;
  flex-direction: column;
  min-height: 400px;
  padding: ${({ theme }) => theme.spacing(1.5)};
`;

const StyledDropdownBody = styled(motion.div)`
  display: flex;
  flex: 1;
  flex-direction: column;
`;

const StyledUpdatesSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.75)};
  padding: ${({ theme }) => theme.spacing(2.5, 2, 1.5)};
`;

const StyledUpdatesHeading = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  text-transform: uppercase;
`;

const StyledUpdateLink = styled.a`
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
  padding: ${({ theme }) => theme.spacing(1.25, 1.5)};
  text-decoration: none;
  transition:
    background ${({ theme }) => theme.animation.duration.normal}s,
    color ${({ theme }) => theme.animation.duration.normal}s;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledUpdateTitle = styled.div`
  color: inherit;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  line-height: 1.4;
`;

const StyledFullChangelogLink = styled.a`
  align-items: center;
  color: ${({ theme }) => theme.font.color.primary};
  display: inline-flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  gap: ${({ theme }) => theme.spacing(1)};
  margin-top: ${({ theme }) => theme.spacing(1)};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 4px;
  }
`;

const getDownloadItemLabel = (
  itemId: DownloadAppItemId,
  t: ReturnType<typeof useLingui>['t'],
) => {
  switch (itemId) {
    case 'web':
      return t`Web`;
    case 'gohighlevel':
      return t`GoHighLevel`;
    case 'chatgpt':
      return t`ChatGPT`;
    case 'claude':
      return t`Claude`;
    case 'discord':
      return t`Discord`;
    case 'slack':
      return t`Slack`;
    case 'chrome':
      return t`Chrome`;
    case 'cli':
      return t`CLI`;
  }
};

const getDownloadItemIcon = (itemId: DownloadAppItemId) => {
  switch (itemId) {
    case 'web':
      return IconDeviceLaptop;
    case 'gohighlevel':
      return IconBrandWindows;
    case 'chatgpt':
      return IconBrandOpenai;
    case 'claude':
      return IconBrandTabler;
    case 'discord':
      return IconBrandDiscord;
    case 'slack':
      return IconBrandSlack;
    case 'chrome':
      return IconBrandChrome;
    case 'cli':
      return IconTerminal2;
  }
};

type HelpDropdownView = 'main' | 'apps';

const DOWNLOAD_APPS_HOVER_DELAY_IN_MS = 1500;

export const NavigationDrawerHelpDropdown = () => {
  const theme = useTheme();
  const { t } = useLingui();
  const navigate = useNavigate();
  const location = useLocation();
  const { closeDropdown } = useCloseDropdown();
  const { copyToClipboard } = useCopyToClipboard();
  const { enqueueInfoSnackBar } = useSnackBar();
  const { openKeyboardShortcutsPage } =
    useOpenKeyboardShortcutsPageInCommandMenu();
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const [isNavigationDrawerExpanded, setIsNavigationDrawerExpanded] =
    useRecoilState(isNavigationDrawerExpandedState);
  const setNavigationDrawerExpandedMemorized = useSetRecoilState(
    navigationDrawerExpandedMemorizedState,
  );
  const setNavigationMemorizedUrl = useSetRecoilState(
    navigationMemorizedUrlState,
  );

  const [view, setView] = useState<HelpDropdownView>('main');
  const [direction, setDirection] = useState(1);
  const openAppsTimeoutRef = useRef<number | null>(null);

  const commandSymbol = getOsControlSymbol();

  const changelogPreviewItems = [
    {
      title: t`Settings refresh and agent polish`,
    },
    {
      title: t`Launch site and mercury updates`,
    },
  ];

  useEffect(() => {
    return () => {
      if (openAppsTimeoutRef.current !== null) {
        window.clearTimeout(openAppsTimeoutRef.current);
      }
    };
  }, []);

  const clearOpenAppsTimeout = () => {
    if (openAppsTimeoutRef.current !== null) {
      window.clearTimeout(openAppsTimeoutRef.current);
      openAppsTimeoutRef.current = null;
    }
  };

  const closeHelpDropdown = () => {
    closeDropdown(NAVIGATION_DRAWER_SUPPORT_DROPDOWN_ID);
  };

  const openAppsView = () => {
    clearOpenAppsTimeout();
    setDirection(1);
    setView('apps');
  };

  const openMainView = () => {
    clearOpenAppsTimeout();
    setDirection(-1);
    setView('main');
  };

  const handleDownloadAppsHoverStart = () => {
    clearOpenAppsTimeout();

    openAppsTimeoutRef.current = window.setTimeout(() => {
      openAppsView();
    }, DOWNLOAD_APPS_HOVER_DELAY_IN_MS);
  };

  const handleOpenSettings = () => {
    closeHelpDropdown();
    setNavigationDrawerExpandedMemorized(isNavigationDrawerExpanded);
    setIsNavigationDrawerExpanded(true);
    setNavigationMemorizedUrl(location.pathname + location.search);
    navigate(getSettingsPath(SettingsPath.ProfilePage));
  };

  const handleOpenDocs = () => {
    window.open(
      getDocumentationUrl({ locale: currentWorkspaceMember?.locale }),
      '_blank',
      'noopener,noreferrer',
    );
    closeHelpDropdown();
  };

  const handleOpenStatus = () => {
    window.open(AppPath.Status, '_blank', 'noopener,noreferrer');
    closeHelpDropdown();
  };

  const handleOpenDiscord = () => {
    window.open(
      CONSUELO_DISCORD_COMMUNITY_URL,
      '_blank',
      'noopener,noreferrer',
    );
    closeHelpDropdown();
  };

  const handleOpenKeyboardShortcuts = () => {
    closeHelpDropdown();
    openKeyboardShortcutsPage();
  };

  const handleOpenFeedback = async () => {
    try {
      closeHelpDropdown();

      const didOpenFeedback = await openSentryFeedbackForm({
        formTitle: t`Contact us`,
        submitButtonLabel: t`Send feedback`,
        messagePlaceholder: t`How can we help?`,
      });

      if (!didOpenFeedback) {
        window.location.href = `mailto:${SUPPORT_EMAIL}`;
        enqueueInfoSnackBar({
          message: t`Opening email because feedback isn't ready yet`,
        });
      }
    } catch {
      window.location.href = `mailto:${SUPPORT_EMAIL}`;
    }
  };

  const handleDownloadAppClick = async (itemId: DownloadAppItemId) => {
    try {
      const item = DOWNLOAD_APP_ITEMS.find(
        (downloadItem) => downloadItem.id === itemId,
      );

      if (!item) {
        return;
      }

      closeHelpDropdown();

      if (item.type === 'link') {
        window.open(item.href, '_blank', 'noopener,noreferrer');
        return;
      }

      const downloadItemLabel = getDownloadItemLabel(item.id, t);
      const copiedCommandMessage = t`${downloadItemLabel} command copied`;

      await copyToClipboard(item.value, copiedCommandMessage);
    } catch {
      enqueueInfoSnackBar({
        message: t`Couldn't open that right now`,
      });
    }
  };

  const dropdownContent = (
    <DropdownContent widthInPixels={300}>
      <StyledDropdownFrame
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: theme.animation.duration.normal }}
      >
        <AnimatePresence initial={false} mode="wait">
          <StyledDropdownBody
            key={view}
            initial={{ opacity: 0, x: direction > 0 ? 18 : -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -18 : 18 }}
            transition={{ duration: theme.animation.duration.normal }}
          >
            {view === 'main' ? (
              <>
                <DropdownMenuItemsContainer scrollable={false}>
                  <MenuItem
                    LeftIcon={IconBook2}
                    onClick={handleOpenDocs}
                    text={t`Docs`}
                  />
                  <MenuItem
                    LeftIcon={IconMessageCircle}
                    onClick={() => {
                      void handleOpenFeedback();
                    }}
                    text={t`Contact us`}
                  />
                  <MenuItem
                    LeftIcon={IconCommand}
                    onClick={handleOpenKeyboardShortcuts}
                    text={t`Keyboard shortcuts`}
                    contextualText={`${commandSymbol} /`}
                    contextualTextPosition="right"
                  />
                  <MenuItem
                    LeftIcon={IconStatusChange}
                    onClick={handleOpenStatus}
                    text={t`Consuelo status`}
                  />
                  <MenuItem
                    LeftIcon={IconDownload}
                    onClick={openAppsView}
                    onMouseEnter={handleDownloadAppsHoverStart}
                    onMouseLeave={clearOpenAppsTimeout}
                    text={t`Download apps`}
                    hasSubMenu={true}
                    isSubMenuOpened={false}
                  />
                  <MenuItem
                    LeftIcon={IconSettings}
                    onClick={handleOpenSettings}
                    text={t`Settings`}
                    contextualText={t`G then S`}
                    contextualTextPosition="right"
                  />
                  <MenuItem
                    LeftIcon={IconBrandDiscord}
                    onClick={handleOpenDiscord}
                    text={t`Discord community`}
                  />
                </DropdownMenuItemsContainer>

                <DropdownMenuSeparator />

                <StyledUpdatesSection>
                  <StyledUpdatesHeading>{t`What's new`}</StyledUpdatesHeading>
                  {changelogPreviewItems.map((item) => (
                    <StyledUpdateLink
                      href={CONSUELO_CHANGELOG_URL}
                      key={item.title}
                      onClick={closeHelpDropdown}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <StyledUpdateTitle>{item.title}</StyledUpdateTitle>
                    </StyledUpdateLink>
                  ))}
                  <StyledFullChangelogLink
                    href={CONSUELO_CHANGELOG_URL}
                    onClick={closeHelpDropdown}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t`Full changelog`}
                    <IconExternalLink size={14} />
                  </StyledFullChangelogLink>
                </StyledUpdatesSection>
              </>
            ) : (
              <>
                <DropdownMenuHeader
                  StartComponent={
                    <DropdownMenuHeaderLeftComponent Icon={IconArrowLeft} />
                  }
                  onClick={openMainView}
                >
                  {t`Download apps`}
                </DropdownMenuHeader>
                <DropdownMenuItemsContainer scrollable={false}>
                  {DOWNLOAD_APP_ITEMS.map((item) => {
                    const Icon = getDownloadItemIcon(item.id);

                    return (
                      <MenuItem
                        key={item.id}
                        LeftIcon={Icon}
                        onClick={() => {
                          void handleDownloadAppClick(item.id);
                        }}
                        text={getDownloadItemLabel(item.id, t)}
                        contextualText={
                          item.type === 'command' ? t`Copy command` : undefined
                        }
                        contextualTextPosition="right"
                      />
                    );
                  })}
                </DropdownMenuItemsContainer>
              </>
            )}
          </StyledDropdownBody>
        </AnimatePresence>
      </StyledDropdownFrame>
    </DropdownContent>
  );

  return (
    <Dropdown
      dropdownId={NAVIGATION_DRAWER_SUPPORT_DROPDOWN_ID}
      dropdownPlacement="top-start"
      dropdownOffset={{ x: 0, y: -10 }}
      clickableComponent={
        <StyledHelpButton type="button" title={t`Help`}>
          <IconHelpCircle size={theme.icon.size.md} stroke={1.8} />
        </StyledHelpButton>
      }
      dropdownComponents={dropdownContent}
      onClose={() => {
        clearOpenAppsTimeout();
        setDirection(-1);
        setView('main');
      }}
    />
  );
};
