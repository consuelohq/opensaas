import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { IconCalendar } from 'twenty-ui/display';
import { IconLoader2, IconNote } from '@tabler/icons-react';
import { useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';

import { useQuickActions } from '@/dialer/hooks/useQuickActions';
import { selectedContactState } from '@/dialer/states/selectedContactState';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { type CallStatus } from '@/dialer/types/dialer';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

const VISIBLE_STATUSES = new Set<CallStatus>(['active', 'ended']);

const FOLLOW_UP_OPTIONS = [
  { label: msg`Tomorrow`, days: 1 },
  { label: msg`In 2 days`, days: 2 },
  { label: msg`Next week`, days: 7 },
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
  background: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
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
    primary ? theme.font.color.inverted : theme.font.color.secondary};
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
  const { t } = useLingui();
  const callState = useRecoilValue(callStateAtom);
  const selectedContact = useRecoilValue(selectedContactState);

  const { saveNote, scheduleFollowUp, isSaving } = useQuickActions({
    contactId: selectedContact?.id ?? null,
    callSid: callState.callSid,
  });

  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const [noteOpen, setNoteOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [selectedDays, setSelectedDays] = useState<number | null>(null);

  const hasContact = selectedContact !== null;

  const handleSaveNote = useCallback(async () => {
    const ok = await saveNote(noteContent);
    if (ok) {
      enqueueSuccessSnackBar({ message: t`Note saved` });
      setNoteContent('');
      setNoteOpen(false);
    } else {
      enqueueErrorSnackBar({ message: t`Failed to save note` });
    }
  }, [noteContent, saveNote, enqueueSuccessSnackBar, enqueueErrorSnackBar, t]);

  const handleSchedule = useCallback(async () => {
    if (selectedDays === null) return;
    const dueAt = getFollowUpDate(selectedDays);
    const name = selectedContact?.name ?? selectedContact?.firstName ?? t`Unknown`;
    const ok = await scheduleFollowUp(dueAt, name);
    if (ok) {
      enqueueSuccessSnackBar({ message: t`Follow-up scheduled` });
      setSelectedDays(null);
      setFollowUpOpen(false);
    } else {
      enqueueErrorSnackBar({ message: t`Failed to schedule follow-up` });
    }
  }, [
    selectedDays,
    selectedContact,
    scheduleFollowUp,
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    t,
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
          disabled={!hasContact}
          onClick={() => {
            setNoteOpen((p) => !p);
            setFollowUpOpen(false);
          }}
          title={hasContact ? t`Add note` : t`Save selectedContact first to add notes`}
        >
          <IconNote size={16} />
          {t`Add Note`}
        </StyledActionButton>
        <StyledActionButton
          isDisabled={!hasContact}
          disabled={!hasContact}
          onClick={() => {
            setFollowUpOpen((p) => !p);
            setNoteOpen(false);
          }}
          title={hasContact ? t`Schedule follow-up` : t`Save selectedContact first`}
        >
          <IconCalendar size={16} />
          {t`Follow-up`}
        </StyledActionButton>
      </StyledRow>

      {noteOpen && hasContact && (
        <StyledPanel>
          <StyledTextarea
            placeholder={t`Type your note...`}
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            onKeyDown={handleNoteKeyDown}
            maxLength={2000}
            autoFocus
          />
          <StyledButtonRow>
            <StyledSmallButton onClick={() => setNoteOpen(false)}>
              {t`Cancel`}
            </StyledSmallButton>
            <StyledSmallButton
              primary
              disabled={!noteContent.trim() || isSaving}
              onClick={handleSaveNote}
            >
              {isSaving ? <IconLoader2 size={14} /> : t`Save Note`}
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
                {t(label)}
              </StyledDateOption>
            ))}
          </StyledRow>
          <StyledButtonRow>
            <StyledSmallButton onClick={() => setFollowUpOpen(false)}>
              {t`Cancel`}
            </StyledSmallButton>
            <StyledSmallButton
              primary
              disabled={selectedDays === null || isSaving}
              onClick={handleSchedule}
            >
              {isSaving ? <IconLoader2 size={14} /> : t`Schedule`}
            </StyledSmallButton>
          </StyledButtonRow>
        </StyledPanel>
      )}
    </StyledContainer>
  );
};
