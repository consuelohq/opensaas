import styled from '@emotion/styled';
import { IconCheck, IconX } from '@tabler/icons-react';

// human-readable labels for CRM tool names
const TOOL_LABELS: Record<string, string> = {
  log_call: 'Log Call',
  update_deal: 'Update Deal',
  create_task: 'Create Task',
  send_email: 'Send Email',
};

const formatArgKey = (key: string): string =>
  key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const formatArgValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  return String(value);
};

type AgentActionCardProps = {
  toolName: string;
  args: Record<string, unknown>;
  status: 'requires-action' | 'running' | 'complete' | 'incomplete';
  result: string | undefined;
  onApprove: () => void;
  onSkip: () => void;
};

const StyledCard = styled.div`
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  background: ${({ theme }) => theme.background.primary};
  overflow: hidden;
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
`;

const StyledTitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledStatusBadge = styled.span<{ variant: 'pending' | 'approved' | 'rejected' }>`
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: 2px ${({ theme }) => theme.spacing(1.5)};
  border-radius: ${({ theme }) => theme.border.radius.pill};
  color: ${({ theme, variant }) => {
    if (variant === 'approved') return theme.color.turquoise;
    if (variant === 'rejected') return theme.color.red;

    return theme.font.color.tertiary;
  }};
  background: ${({ theme, variant }) => {
    if (variant === 'approved') return theme.background.transparent.success;
    if (variant === 'rejected') return theme.background.transparent.danger;

    return theme.background.transparent.light;
  }};
`;

const StyledBody = styled.div`
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledArgRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: 1.4;
`;

const StyledArgKey = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  min-width: 100px;
  flex-shrink: 0;
`;

const StyledArgValue = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  word-break: break-word;
`;

const StyledActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border-top: 1px solid ${({ theme }) => theme.border.color.medium};
`;

const StyledButton = styled.button<{ variant: 'approve' | 'skip' }>`
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

export const AgentActionCard = ({
  toolName,
  args,
  status,
  result,
  onApprove,
  onSkip,
}: AgentActionCardProps) => {
  const label = TOOL_LABELS[toolName] ?? toolName;
  const isPending = status === 'requires-action';
  const isComplete = status === 'complete';

  const badgeVariant = isComplete
    ? result && !result.includes('skipped')
      ? 'approved'
      : 'rejected'
    : 'pending';

  const badgeText = isComplete
    ? badgeVariant === 'approved'
      ? 'Executed'
      : 'Skipped'
    : status === 'running'
      ? 'Running…'
      : 'Pending';

  const argEntries = Object.entries(args).filter(
    ([, value]) => value !== undefined,
  );

  return (
    <StyledCard>
      <StyledHeader>
        <StyledTitle>{label}</StyledTitle>
        <StyledStatusBadge variant={badgeVariant}>{badgeText}</StyledStatusBadge>
      </StyledHeader>
      {argEntries.length > 0 && (
        <StyledBody>
          {argEntries.map(([key, value]) => (
            <StyledArgRow key={key}>
              <StyledArgKey>{formatArgKey(key)}</StyledArgKey>
              <StyledArgValue>{formatArgValue(value)}</StyledArgValue>
            </StyledArgRow>
          ))}
        </StyledBody>
      )}
      {isPending && (
        <StyledActions>
          <StyledButton variant="skip" onClick={onSkip}>
            <IconX size={14} />
            Skip
          </StyledButton>
          <StyledButton variant="approve" onClick={onApprove}>
            <IconCheck size={14} />
            Approve
          </StyledButton>
        </StyledActions>
      )}
    </StyledCard>
  );
};
