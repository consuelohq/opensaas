import styled from '@emotion/styled';
import { IconCheck, IconX } from '@tabler/icons-react';

type BatchConfirmationBarProps = {
  pendingCount: number;
  onApproveAll: () => void;
  onCancelAll: () => void;
};

const StyledBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(4)};
  border-top: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.secondary};
`;

const StyledLabel = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledButtonGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledButton = styled.button<{ variant: 'approve' | 'cancel' }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid
    ${({ theme, variant }) =>
      variant === 'approve'
        ? theme.color.turquoise
        : theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme, variant }) =>
    variant === 'approve'
      ? theme.color.turquoise
      : theme.background.primary};
  color: ${({ theme, variant }) =>
    variant === 'approve'
      ? theme.font.color.inverted
      : theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  cursor: pointer;

  &:hover {
    opacity: 0.85;
  }
`;

export const BatchConfirmationBar = ({
  pendingCount,
  onApproveAll,
  onCancelAll,
}: BatchConfirmationBarProps) => {
  if (pendingCount === 0) return null;

  return (
    <StyledBar>
      <StyledLabel>
        {pendingCount} action{pendingCount > 1 ? 's' : ''} pending
      </StyledLabel>
      <StyledButtonGroup>
        <StyledButton variant="cancel" onClick={onCancelAll}>
          <IconX size={14} />
          Cancel
        </StyledButton>
        <StyledButton variant="approve" onClick={onApproveAll}>
          <IconCheck size={14} />
          Approve All ({pendingCount})
        </StyledButton>
      </StyledButtonGroup>
    </StyledBar>
  );
};
