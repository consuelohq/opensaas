import {
  type Shortcut,
  ShortcutType,
} from '@/keyboard-shortcut-menu/types/Shortcut';
import { ScrollWrapper } from '@/ui/utilities/scroll/components/ScrollWrapper';
import styled from '@emotion/styled';
import { getOsControlSymbol } from 'twenty-ui/utilities';

const cmd = getOsControlSymbol();

// general — available everywhere
const SHORTCUTS_GENERAL: Shortcut[] = [
  { label: 'Open command menu', type: ShortcutType.General, firstHotKey: cmd, secondHotKey: 'K', areSimultaneous: true },
  { label: 'Search records', type: ShortcutType.General, firstHotKey: '/', areSimultaneous: true },
  { label: 'Ask AI', type: ShortcutType.General, firstHotKey: '@', areSimultaneous: true },
  { label: 'Keyboard shortcuts', type: ShortcutType.General, firstHotKey: cmd, secondHotKey: '/', areSimultaneous: true },
  { label: 'Back / Close', type: ShortcutType.General, firstHotKey: 'Esc', areSimultaneous: true },
  { label: 'Open settings', type: ShortcutType.General, firstHotKey: cmd, secondHotKey: ',', areSimultaneous: true },
  { label: 'Mark as favourite', type: ShortcutType.General, firstHotKey: '⇧', secondHotKey: 'F', areSimultaneous: true },
];

// navigation — g+key sequences
const SHORTCUTS_NAVIGATION: Shortcut[] = [
  { label: 'Go to People', type: ShortcutType.General, firstHotKey: 'G', secondHotKey: 'P', areSimultaneous: false },
  { label: 'Go to Companies', type: ShortcutType.General, firstHotKey: 'G', secondHotKey: 'C', areSimultaneous: false },
  { label: 'Go to Dashboards', type: ShortcutType.General, firstHotKey: 'G', secondHotKey: 'D', areSimultaneous: false },
  { label: 'Go to Tasks', type: ShortcutType.General, firstHotKey: 'G', secondHotKey: 'T', areSimultaneous: false },
  { label: 'Go to Notes', type: ShortcutType.General, firstHotKey: 'G', secondHotKey: 'N', areSimultaneous: false },
  { label: 'Go to Workflows', type: ShortcutType.General, firstHotKey: 'G', secondHotKey: 'W', areSimultaneous: false },
  { label: 'Go to Settings', type: ShortcutType.General, firstHotKey: 'G', secondHotKey: 'S', areSimultaneous: false },
];

// record table — when viewing a table/list of records
const SHORTCUTS_TABLE: Shortcut[] = [
  { label: 'Move right', type: ShortcutType.Table, firstHotKey: '→', areSimultaneous: true },
  { label: 'Move left', type: ShortcutType.Table, firstHotKey: '←', areSimultaneous: true },
  { label: 'Move up', type: ShortcutType.Table, firstHotKey: '↑', areSimultaneous: true },
  { label: 'Move down', type: ShortcutType.Table, firstHotKey: '↓', areSimultaneous: true },
  { label: 'Open focused record', type: ShortcutType.Table, firstHotKey: 'Enter', areSimultaneous: true },
  { label: 'Clear selection', type: ShortcutType.Table, firstHotKey: 'Esc', areSimultaneous: true },
  { label: 'Select record', type: ShortcutType.Table, firstHotKey: 'X', areSimultaneous: true },
  { label: 'Select multiple', type: ShortcutType.Table, firstHotKey: '⇧', secondHotKey: 'Click', areSimultaneous: true },
];

// record actions — when a record is focused/selected
const SHORTCUTS_RECORD_ACTIONS: Shortcut[] = [
  { label: 'Peek into record', type: ShortcutType.General, firstHotKey: 'Space', areSimultaneous: true },
  { label: 'Open record', type: ShortcutType.General, firstHotKey: 'Enter', areSimultaneous: true },
  { label: 'Delete record', type: ShortcutType.General, firstHotKey: cmd, secondHotKey: '⌫', areSimultaneous: true },
  { label: 'Copy record URL', type: ShortcutType.General, firstHotKey: cmd, secondHotKey: '⇧ ,', areSimultaneous: true },
];

// dialer — when dialer sidebar is open
const SHORTCUTS_DIALER: Shortcut[] = [
  { label: 'Toggle dialer', type: ShortcutType.General, firstHotKey: cmd, secondHotKey: 'D', areSimultaneous: true },
  { label: 'Mute / Unmute', type: ShortcutType.General, firstHotKey: 'M', areSimultaneous: true },
  { label: 'Hold / Unhold', type: ShortcutType.General, firstHotKey: 'H', areSimultaneous: true },
  { label: 'Transfer', type: ShortcutType.General, firstHotKey: 'T', areSimultaneous: true },
  { label: 'End call', type: ShortcutType.General, firstHotKey: 'Esc', areSimultaneous: true },
  { label: 'Call selected contact', type: ShortcutType.General, firstHotKey: cmd, secondHotKey: '⇧ C', areSimultaneous: true },
  { label: 'Toggle calling mode', type: ShortcutType.General, firstHotKey: cmd, secondHotKey: '⇧ M', areSimultaneous: true },
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
          {!shortcut.areSimultaneous && <span>then</span>}
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
      <ShortcutGroup heading="General" shortcuts={SHORTCUTS_GENERAL} />
      <ShortcutGroup heading="Navigation" shortcuts={SHORTCUTS_NAVIGATION} />
      <ShortcutGroup heading="Record Table" shortcuts={SHORTCUTS_TABLE} />
      <ShortcutGroup heading="Record Actions" shortcuts={SHORTCUTS_RECORD_ACTIONS} />
      <ShortcutGroup heading="Dialer" shortcuts={SHORTCUTS_DIALER} />
    </StyledContainer>
  </ScrollWrapper>
);
