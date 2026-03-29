import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
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
  background: ${({ theme }) => theme.background.transparent.light};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.rounded};
  color: ${({ theme }) => theme.font.color.secondary};
  cursor: pointer;
  display: inline-flex;
  height: ${({ theme }) => theme.spacing(8)};
  justify-content: center;
  transition:
    background ${({ theme }) => theme.animation.duration.normal}s,
    border-color ${({ theme }) => theme.animation.duration.normal}s,
    color ${({ theme }) => theme.animation.duration.normal}s;
  width: ${({ theme }) => theme.spacing(8)};

  &:hover {
    background: ${({ theme }) => theme.background.transparent.lighter};
    border-color: ${({ theme }) => theme.border.color.strong};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledDropdownFrame = styled(motion.div)`
  display: flex;
  flex-direction: column;
  min-height: 460px;
`;

const StyledDropdownBody = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
`;

const StyledUpdatesSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(3)};
`;

const StyledUpdatesHeading = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  text-transform: uppercase;
`;

const StyledUpdateLink = styled.a`
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
  padding: ${({ theme }) => theme.spacing(1.5, 2)};
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
`;

const StyledUpdateMeta = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
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

  const commandSymbol = getOsControlSymbol();

  const changelogPreviewItems = [
    {
      id: 'v0.4.2',
      title: t`Settings restructure, agent polish, and landing refresh`,
      date: 'Mar 25, 2026',
    },
    {
      id: 'v0.4.1',
      title: t`Launch site refresh and mercury positioning updates`,
      date: 'Mar 24, 2026',
    },
    {
      id: 'v0.4.0',
      title: t`GoHighLevel navigation, nav reorg, and docs updates`,
      date: 'Mar 21, 2026',
    },
  ];

  const closeHelpDropdown = () => {
    closeDropdown(NAVIGATION_DRAWER_SUPPORT_DROPDOWN_ID);
  };

  const openAppsView = () => {
    setDirection(1);
    setView('apps');
  };

  const openMainView = () => {
    setDirection(-1);
    setView('main');
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
  };

  const handleDownloadAppClick = async (itemId: DownloadAppItemId) => {
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
  };

  const dropdownContent = (
    <DropdownContent widthInPixels={320}>
      <StyledDropdownFrame
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: theme.animation.duration.normal }}
      >
        <AnimatePresence initial={false} mode="wait">
          <StyledDropdownBody
            as={motion.div}
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
                  />
                  <MenuItem
                    LeftIcon={IconStatusChange}
                    onClick={handleOpenStatus}
                    text={t`Consuelo status`}
                  />
                  <MenuItem
                    LeftIcon={IconDownload}
                    onClick={openAppsView}
                    onMouseEnter={openAppsView}
                    text={t`Download apps`}
                    hasSubMenu={true}
                    isSubMenuOpened={view === 'apps'}
                  />
                  <MenuItem
                    LeftIcon={IconSettings}
                    onClick={handleOpenSettings}
                    text={t`Settings`}
                    contextualText={t`G then S`}
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
                      key={item.id}
                      onClick={closeHelpDropdown}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <StyledUpdateTitle>{item.title}</StyledUpdateTitle>
                      <StyledUpdateMeta>{`${item.id} - ${item.date}`}</StyledUpdateMeta>
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
        setDirection(-1);
        setView('main');
      }}
    />
  );
};
