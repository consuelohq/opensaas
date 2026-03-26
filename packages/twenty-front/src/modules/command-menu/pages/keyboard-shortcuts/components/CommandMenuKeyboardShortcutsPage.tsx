import { KEYBOARD_SHORTCUTS_GENERAL } from '@/keyboard-shortcut-menu/constants/KeyboardShortcutsGeneral';
import { KEYBOARD_SHORTCUTS_TABLE } from '@/keyboard-shortcut-menu/constants/KeyboardShortcutsTable';
import {
  type Shortcut,
  ShortcutType,
} from '@/keyboard-shortcut-menu/types/Shortcut';
import { ScrollWrapper } from '@/ui/utilities/scroll/components/ScrollWrapper';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { getOsControlSymbol } from 'twenty-ui/utilities';

const KEYBOARD_SHORTCUTS_NAVIGATION: Shortcut[] = [
  { label: 'Go to People', type: ShortcutType.General, firstHotKey: 'G', secondHotKey: 'P', areSimultaneous: false },
  { label: 'Go to Companies', type: ShortcutType.General, firstHotKey: 'G', secondHotKey: 'C', areSimultaneous: false },
  { label: 'Go to Dashboards', type: ShortcutType.General, firstHotKey: 'G', secondHotKey: 'D', areSimultaneous: false },
  { label: 'Go to Tasks', type: ShortcutType.General, firstHotKey: 'G', secondHotKey: 'T', areSimultaneous: false },
  { label: 'Go to Notes', type: ShortcutType.General, firstHotKey: 'G', secondHotKey: 'N', areSimultaneous: false },
  { label: 'Go to Workflows', type: ShortcutType.General, firstHotKey: 'G', secondHotKey: 'W', areSimultaneous: false },
  { label: 'Go to Settings', type: ShortcutType.General, firstHotKey: 'G', secondHotKey: 'S', areSimultaneous: false },
  { label: 'Open Settings', type: ShortcutType.General, firstHotKey: getOsControlSymbol(), secondHotKey: ',', areSimultaneous: true },
];

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing(2, 3)};
`;

const StyledGroupHeading = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  padding: ${({ theme }) => theme.spacing(2, 1, 1)};
  text-transform: uppercase;
`;

const StyledShortcutRow = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.primary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.md};
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(1)};
`;

const StyledKeysContainer = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledKey = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.background.transparent.lighter};
  border: 1px solid ${({ theme }) => theme.border.color.strong};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  box-shadow: ${({ theme }) => theme.boxShadow.underline};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.md};
  height: 20px;
  justify-content: center;
  min-width: 20px;
  padding: 0 ${({ theme }) => theme.spacing(1)};
`;

const ShortcutItem = ({ shortcut }: { shortcut: Shortcut }) => (
  <StyledShortcutRow>
    <span>{shortcut.label}</span>
    <StyledKeysContainer>
      {shortcut.firstHotKey && <StyledKey>{shortcut.firstHotKey}</StyledKey>}
      {shortcut.secondHotKey && (
        <>
          {!shortcut.areSimultaneous && <span>{t`then`}</span>}
          <StyledKey>{shortcut.secondHotKey}</StyledKey>
        </>
      )}
    </StyledKeysContainer>
  </StyledShortcutRow>
);

const ShortcutGroup = ({
  heading,
  shortcuts,
}: {
  heading: string;
  shortcuts: Shortcut[];
}) => (
  <>
    <StyledGroupHeading>{heading}</StyledGroupHeading>
    {shortcuts.map((shortcut, index) => (
      <ShortcutItem shortcut={shortcut} key={index} />
    ))}
  </>
);

export const CommandMenuKeyboardShortcutsPage = () => (
  <ScrollWrapper componentInstanceId="scroll-wrapper-keyboard-shortcuts">
    <StyledContainer>
      <ShortcutGroup heading={t`Navigation`} shortcuts={KEYBOARD_SHORTCUTS_NAVIGATION} />
      <ShortcutGroup heading={t`General`} shortcuts={KEYBOARD_SHORTCUTS_GENERAL} />
      <ShortcutGroup heading={t`Table`} shortcuts={KEYBOARD_SHORTCUTS_TABLE} />
    </StyledContainer>
  </ScrollWrapper>
);
