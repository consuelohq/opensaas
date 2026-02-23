import styled from '@emotion/styled';

const StyledBadge = styled.button`
  background: none;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.xs};
  padding: ${({ theme }) => theme.spacing(0.5)}
    ${({ theme }) => theme.spacing(1)};

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
    color: ${({ theme }) => theme.font.color.secondary};
  }
`;

type SkillVersionBadgeProps = {
  version: number;
  savedAt: string;
  onClick?: () => void;
};

const formatRelativeTime = (dateString: string): string => {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000,
  );

  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days}d ago`;
};

export const SkillVersionBadge = ({
  version,
  savedAt,
  onClick,
}: SkillVersionBadgeProps) => {
  return (
    <StyledBadge onClick={onClick}>
      v{version} · saved {formatRelativeTime(savedAt)}
    </StyledBadge>
  );
};
