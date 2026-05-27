import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { useEffect } from 'react';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { Button, Checkbox } from 'twenty-ui/input';

import { Modal } from '@/ui/layout/modal/components/Modal';
import { useModal } from '@/ui/layout/modal/hooks/useModal';

const POST_CALL_WRAP_UP_MODAL_ID = 'post-call-wrap-up-modal';

export type PostCallWrapUpMode =
  | 'auto-advance'
  | 'manual-advance'
  | 'manual-disposition';

type DispositionOption = {
  value: string;
  label: string;
};

const getDefaultDispositionOptions = (): DispositionOption[] => [
  { value: 'connected', label: t`Connected` },
  { value: 'follow-up', label: t`Follow-up` },
  { value: 'not-interested', label: t`Not Interested` },
  { value: 'voicemail', label: t`Voicemail` },
  { value: 'no-answer', label: t`No Answer` },
  { value: 'wrong-number', label: t`Wrong Number` },
];

const StyledHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledTitle = styled.h2`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  margin: 0;
`;

const StyledSubtitle = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
`;

const StyledSummaryGrid = styled.div`
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  overflow: hidden;
`;

const StyledSummaryItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(3)};

  & + & {
    border-left: 1px solid ${({ theme }) => theme.border.color.light};
  }
`;

const StyledSummaryLabel = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  text-transform: uppercase;
`;

const StyledSummaryValue = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledCountdown = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  color: ${({ theme }) => theme.font.color.primary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledPreferenceRow = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.secondary};
  cursor: pointer;
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledDispositionGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(2)};
  grid-template-columns: repeat(2, minmax(0, 1fr));
`;

const StyledFooter = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: flex-end;
  width: 100%;
`;

const formatDuration = (durationSeconds: number) => {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.max(0, durationSeconds % 60);

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
};

export type PostCallWrapUpModalProps = {
  isOpen: boolean;
  mode: PostCallWrapUpMode;
  contactName: string;
  durationSeconds: number;
  disposition: string | null;
  countdownSeconds: number;
  autoAdvanceEnabled: boolean;
  selectedDisposition?: string | null;
  dispositionOptions?: DispositionOption[];
  onAdvance: () => void;
  onCancelAutoAdvance: () => void;
  onAutoAdvanceChange: (enabled: boolean) => void;
  onSelectDisposition: (disposition: string) => void;
};

export const PostCallWrapUpModal = ({
  isOpen,
  mode,
  contactName,
  durationSeconds,
  disposition,
  countdownSeconds,
  autoAdvanceEnabled,
  selectedDisposition = null,
  dispositionOptions = getDefaultDispositionOptions(),
  onAdvance,
  onCancelAutoAdvance,
  onAutoAdvanceChange,
  onSelectDisposition,
}: PostCallWrapUpModalProps) => {
  const { openModal, closeModal } = useModal();
  const isManualDisposition = mode === 'manual-disposition';
  const resolvedDisposition =
    disposition ?? selectedDisposition ?? t`Needs review`;
  const preferenceLabel = autoAdvanceEnabled
    ? t`Turn off auto advance next call`
    : t`Turn on auto advance next call`;

  useEffect(() => {
    if (isOpen) {
      openModal(POST_CALL_WRAP_UP_MODAL_ID);
      return;
    }

    closeModal(POST_CALL_WRAP_UP_MODAL_ID);
  }, [closeModal, isOpen, openModal]);

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      modalId={POST_CALL_WRAP_UP_MODAL_ID}
      isClosable={false}
      size="medium"
      padding="none"
      shouldCloseModalOnClickOutsideOrEscape={false}
      ignoreContainer
    >
      <Modal.Header>
        <StyledHeader>
          <StyledTitle>{t`Call complete`}</StyledTitle>
          <StyledSubtitle>
            {t`Review the call before advancing the queue.`}
          </StyledSubtitle>
        </StyledHeader>
      </Modal.Header>

      <Modal.Content>
        <StyledContent>
          <StyledSummaryGrid>
            <StyledSummaryItem>
              <StyledSummaryLabel>{t`Contact`}</StyledSummaryLabel>
              <StyledSummaryValue>{contactName}</StyledSummaryValue>
            </StyledSummaryItem>
            <StyledSummaryItem>
              <StyledSummaryLabel>{t`Duration`}</StyledSummaryLabel>
              <StyledSummaryValue>
                {formatDuration(durationSeconds)}
              </StyledSummaryValue>
            </StyledSummaryItem>
            <StyledSummaryItem>
              <StyledSummaryLabel>{t`Disposition`}</StyledSummaryLabel>
              <StyledSummaryValue>{resolvedDisposition}</StyledSummaryValue>
            </StyledSummaryItem>
          </StyledSummaryGrid>

          {mode === 'auto-advance' ? (
            <StyledCountdown>
              {t`Starting next call in ${countdownSeconds}`}
            </StyledCountdown>
          ) : isManualDisposition ? (
            <>
              <StyledSubtitle>
                {t`Select a disposition before advancing to the next call.`}
              </StyledSubtitle>
              <StyledDispositionGrid>
                {dispositionOptions.map((option) => (
                  <Button
                    key={option.value}
                    title={option.label}
                    variant={
                      selectedDisposition === option.value
                        ? 'primary'
                        : 'secondary'
                    }
                    accent={
                      selectedDisposition === option.value ? 'blue' : 'default'
                    }
                    fullWidth
                    onClick={() => onSelectDisposition(option.value)}
                  />
                ))}
              </StyledDispositionGrid>
            </>
          ) : null}

          <StyledPreferenceRow
            onClick={() => onAutoAdvanceChange(!autoAdvanceEnabled)}
          >
            <Checkbox checked={autoAdvanceEnabled} />
            <span>{preferenceLabel}</span>
          </StyledPreferenceRow>
        </StyledContent>
      </Modal.Content>

      <Modal.Footer>
        <StyledFooter>
          {mode === 'auto-advance' ? (
            <Button
              title={t`Cancel`}
              variant="secondary"
              onClick={onCancelAutoAdvance}
            />
          ) : (
            <Button
              title={t`Advance to Next Call`}
              variant="primary"
              accent="blue"
              disabled={isManualDisposition && selectedDisposition === null}
              onClick={onAdvance}
            />
          )}
        </StyledFooter>
      </Modal.Footer>
    </Modal>
  );
};
