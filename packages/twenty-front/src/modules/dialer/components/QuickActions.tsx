import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import {
  IconCalendar,
  IconLoader2,
  IconNote,
} from '@tabler/icons-react';

import { useQuickActions } from '@/dialer/hooks/useQuickActions';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { selectedContactState } from '@/dialer/states/selectedContactState';
import { type CallStatus } from '@/dialer/types/dialer';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

const VISIBLE_STATUSES = new Set<CallStatus>(['active', 'ended']);

const FOLLOW_UP_OPTIONS = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 2 days', days: 2 },
  { label: 'Next week', days: 7 },
] as const;

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledActionButton = styled.button<{ isDisabled?: boolean }>`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  cursor: ${({ isDisabled }) => (isDisabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ isDisabled }) => (isDisabled ? 0.5 : 1)};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.background.secondary};
  }
`;

const StyledPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.md};
`;

const StyledTextarea = styled.textarea`
  width: 100%;
  min-height: 72px;
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-family: inherit;
  font-size: ${({ theme }) => theme.font.size.sm};
  resize: vertical;

  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
  }
`;

const StyledButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledSmallButton = styled.button<{ primary?: boolean }>`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(3)};
  border: 1px solid
    ${({ primary, theme }) =>
      primary ? theme.color.blue : theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ primary, theme }) =>
    primary ? theme.color.blue : 'transparent'};
  color: ${({ primary, theme }) =>
    primary ? '#fff' : theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StyledDateOption = styled.button<{ selected?: boolean }>`
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid
    ${({ selected, theme }) =>
      selected ? theme.color.blue : theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ selected, theme }) =>
    selected ? theme.color.blue10 : theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.background.tertiary};
  }
`;

const getFollowUpDate = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date;
};

export const QuickActions = () => {
  const callState = useRecoilValue(callStateAtom);
  const contact = useRecoilValue(selectedContactState);

  const { saveNote, scheduleFollowUp, isSaving } = useQuickActions({
    contactId: contact?.id ?? null,
    callSid: callState.callSid,
  });

  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const [noteOpen, setNoteOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [selectedDays, setSelectedDays] = useState<number | null>(null);

  const hasContact = contact !== null;

  const handleSaveNote = useCallback(async () => {
    const ok = await saveNote(noteContent);
    if (ok) {
      enqueueSuccessSnackBar({ message: 'Note saved' });
      setNoteContent('');
      setNoteOpen(false);
    } else {
      enqueueErrorSnackBar({ message: 'Failed to save note' });
    }
  }, [noteContent, saveNote, enqueueSuccessSnackBar, enqueueErrorSnackBar]);

  const handleSchedule = useCallback(async () => {
    if (selectedDays === null) return;
    const dueAt = getFollowUpDate(selectedDays);
    const name = contact?.name ?? contact?.firstName ?? 'Unknown';
    const ok = await scheduleFollowUp(dueAt, name);
    if (ok) {
      enqueueSuccessSnackBar({ message: 'Follow-up scheduled' });
      setSelectedDays(null);
      setFollowUpOpen(false);
    } else {
      enqueueErrorSnackBar({ message: 'Failed to schedule follow-up' });
    }
  }, [
    selectedDays,
    contact,
    scheduleFollowUp,
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
  ]);

  const handleNoteKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSaveNote();
      }
    },
    [handleSaveNote],
  );

  if (!VISIBLE_STATUSES.has(callState.status)) return null;

  return (
    <StyledContainer>
      <StyledRow>
        <StyledActionButton
          isDisabled={!hasContact}
          onClick={() => {
            setNoteOpen((p) => !p);
            setFollowUpOpen(false);
          }}
          title={hasContact ? 'Add note' : 'Save contact first to add notes'}
        >
          <IconNote size={16} />
          Add Note
        </StyledActionButton>
        <StyledActionButton
          isDisabled={!hasContact}
          onClick={() => {
            setFollowUpOpen((p) => !p);
            setNoteOpen(false);
          }}
          title={
            hasContact ? 'Schedule follow-up' : 'Save contact first'
          }
        >
          <IconCalendar size={16} />
          Follow-up
        </StyledActionButton>
      </StyledRow>

      {noteOpen && hasContact && (
        <StyledPanel>
          <StyledTextarea
            placeholder="Type your note..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            onKeyDown={handleNoteKeyDown}
            maxLength={2000}
            autoFocus
          />
          <StyledButtonRow>
            <StyledSmallButton onClick={() => setNoteOpen(false)}>
              Cancel
            </StyledSmallButton>
            <StyledSmallButton
              primary
              disabled={!noteContent.trim() || isSaving}
              onClick={handleSaveNote}
            >
              {isSaving ? <IconLoader2 size={14} /> : 'Save Note'}
            </StyledSmallButton>
          </StyledButtonRow>
        </StyledPanel>
      )}

      {followUpOpen && hasContact && (
        <StyledPanel>
          <StyledRow>
            {FOLLOW_UP_OPTIONS.map(({ label, days }) => (
              <StyledDateOption
                key={days}
                selected={selectedDays === days}
                onClick={() => setSelectedDays(days)}
              >
                {label}
              </StyledDateOption>
            ))}
          </StyledRow>
          <StyledButtonRow>
            <StyledSmallButton onClick={() => setFollowUpOpen(false)}>
              Cancel
            </StyledSmallButton>
            <StyledSmallButton
              primary
              disabled={selectedDays === null || isSaving}
              onClick={handleSchedule}
            >
              {isSaving ? <IconLoader2 size={14} /> : 'Schedule'}
            </StyledSmallButton>
          </StyledButtonRow>
        </StyledPanel>
      )}
    </StyledContainer>
  );
};
