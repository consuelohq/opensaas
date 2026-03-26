import { useCommandMenu } from '@/command-menu/hooks/useCommandMenu';
import { isCommandMenuOpenedState } from '@/command-menu/states/isCommandMenuOpenedState';
import { CommandMenuPages } from '@/command-menu/types/CommandMenuPages';
import { useRecoilValue } from 'recoil';
import { IconCommand } from 'twenty-ui/display';
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
      pageTitle: 'Keyboard Shortcuts',
      pageIcon: IconCommand,
      pageId: v4(),
      resetNavigationStack: true,
    });
  };

  return { openKeyboardShortcutsPage };
};
