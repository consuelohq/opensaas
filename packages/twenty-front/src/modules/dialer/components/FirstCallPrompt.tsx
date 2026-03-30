import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { IconPhone, IconCheck } from 'twenty-ui/display';
import { useLingui } from '@lingui/react/macro';

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
`;

const StyledContainer = styled.div<{ variant: 'prompt' | 'congrats' }>`
  animation: ${pulse} 2s ease-in-out infinite;
  background: ${({ theme, variant }) =>
    variant === 'congrats' ? theme.color.green10 : theme.background.tertiary};
  border: 1px solid
    ${({ theme, variant }) =>
      variant === 'congrats' ? theme.color.green1 : theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(4)};
  text-align: center;
`;

const StyledIcon = styled.div<{ variant: 'prompt' | 'congrats' }>`
  align-items: center;
  background: ${({ theme, variant }) =>
    variant === 'congrats' ? theme.color.green : theme.color.blue};
  border-radius: 50%;
  color: ${({ theme }) => theme.font.color.inverted};
  display: flex;
  height: 40px;
  justify-content: center;
  width: 40px;
`;

const StyledTitle = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledSubtext = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

type FirstCallPromptProps = {
  variant: 'prompt' | 'congrats';
};

export const FirstCallPrompt = ({ variant }: FirstCallPromptProps) => {
  const { t } = useLingui();

  if (variant === 'congrats') {
    return (
      <StyledContainer variant="congrats">
        <StyledIcon variant="congrats">
          <IconCheck size={20} />
        </StyledIcon>
        <StyledTitle>{t`First call complete!`}</StyledTitle>
        <StyledSubtext>{t`You're all set. Happy calling.`}</StyledSubtext>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer variant="prompt">
      <StyledIcon variant="prompt">
        <IconPhone size={20} />
      </StyledIcon>
      <StyledTitle>{t`Make your first call`}</StyledTitle>
      <StyledSubtext>{t`Try calling yourself to hear how it sounds.`}</StyledSubtext>
    </StyledContainer>
  );
};
