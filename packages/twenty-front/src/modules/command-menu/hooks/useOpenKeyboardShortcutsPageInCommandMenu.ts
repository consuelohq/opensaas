import { useCommandMenu } from '@/command-menu/hooks/useCommandMenu';
import { isCommandMenuOpenedState } from '@/command-menu/states/isCommandMenuOpenedState';
import { CommandMenuPages } from '@/command-menu/types/CommandMenuPages';
import { t } from '@lingui/core/macro';
import { useRecoilValue } from 'recoil';
import { IconKeyboard } from 'twenty-ui/display';
import { v4 } from 'uuid';

export const useOpenKeyboardShortcutsPageInCommandMenu = () => {
  const { navigateCommandMenu, closeCommandMenu } = useCommandMenu();
  const isCommandMenuOpened = useRecoilValue(isCommandMenuOpenedState);

  const openKeyboardShortcutsPage = () => {
    if (isCommandMenuOpened) {
      closeCommandMenu();
      return;
    }
    navigateCommandMenu({
      page: CommandMenuPages.KeyboardShortcuts,
      pageTitle: t`Keyboard Shortcuts`,
      pageIcon: IconKeyboard,
      pageId: v4(),
      resetNavigationStack: true,
    });
  };

  return { openKeyboardShortcutsPage };
};
