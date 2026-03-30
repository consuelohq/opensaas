import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import {
  IconKey,
  IconPhone,
  IconAlertTriangle,
  IconSettings,
  IconRefresh,
} from 'twenty-ui/display';
import { IconCloud } from '@tabler/icons-react';
import { useRecoilValue } from 'recoil';
import { Link } from 'react-router-dom';
import { Trans } from '@lingui/react/macro';

import { twilioConfigStatusState } from '@/dialer/states/twilioConfigStatusState';

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const StyledContainer = styled.div`
  background: ${({ theme }) => theme.background.tertiary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(4)};
  text-align: center;
`;

const StyledIcon = styled.div<{ colorKey: 'blue' | 'yellow' | 'red' | 'gray' }>`
  align-items: center;
  background: ${({ theme, colorKey }) => {
    switch (colorKey) {
      case 'blue':
        return theme.color.blue;
      case 'yellow':
        return theme.color.yellow;
      case 'red':
        return theme.color.red;
      default:
        return theme.color.gray;
    }
  }};
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

const StyledPulse = styled.span`
  animation: ${pulse} 1.5s ease-in-out infinite;
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledButton = styled.button`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  transition: background 120ms;

  &:hover {
    background: ${({ theme }) => theme.background.tertiary};
  }
`;

export const TwilioConfigStatus = () => {
  const status = useRecoilValue(twilioConfigStatusState);

  // loading or fully configured — render nothing
  if (!status || status.configured) return null;

  // hosted: sub-account not provisioned
  if (status.mode === 'hosted' && !status.twilioConnected) {
    return (
      <StyledContainer>
        <StyledIcon colorKey="blue">
          <IconCloud size={20} />
        </StyledIcon>
        <StyledTitle>
          <Trans>Setting up your phone system...</Trans>
        </StyledTitle>
        <StyledPulse>
          <Trans>This takes about 30 seconds on first use.</Trans>
        </StyledPulse>
      </StyledContainer>
    );
  }

  // hosted: connected but no phone numbers
  if (status.mode === 'hosted' && !status.hasPhoneNumbers) {
    return (
      <StyledContainer>
        <StyledIcon colorKey="blue">
          <IconPhone size={20} />
        </StyledIcon>
        <StyledTitle>
          <Trans>Pick a phone number to start calling</Trans>
        </StyledTitle>
        <StyledButton as={Link} to="/settings/accounts">
          <IconSettings size={14} /> <Trans>Go to Settings</Trans>
        </StyledButton>
      </StyledContainer>
    );
  }

  // hosted: TwiML app missing — auto-fix
  if (status.mode === 'hosted' && !status.twimlAppConfigured) {
    return (
      <StyledContainer>
        <StyledIcon colorKey="yellow">
          <IconRefresh size={20} />
        </StyledIcon>
        <StyledTitle>
          <Trans>Phone system needs repair</Trans>
        </StyledTitle>
        <StyledPulse>
          <Trans>Fixing automatically...</Trans>
        </StyledPulse>
      </StyledContainer>
    );
  }

  // BYOK: no credentials or connection failed
  if (status.mode === 'byok' && !status.twilioConnected) {
    const hasError = !!status.error;
    return (
      <StyledContainer>
        <StyledIcon colorKey={hasError ? 'red' : 'gray'}>
          {hasError ? <IconAlertTriangle size={20} /> : <IconKey size={20} />}
        </StyledIcon>
        <StyledTitle>
          {hasError ? (
            <Trans>Twilio connection failed</Trans>
          ) : (
            <Trans>Connect your Twilio account to start calling</Trans>
          )}
        </StyledTitle>
        {hasError && (
          <StyledSubtext>
            <Trans>Check your credentials in Settings</Trans>
          </StyledSubtext>
        )}
        <StyledButton as={Link} to="/settings/accounts">
          <IconSettings size={14} /> <Trans>Go to Settings</Trans>
        </StyledButton>
      </StyledContainer>
    );
  }

  // BYOK: TwiML app missing
  if (status.mode === 'byok' && !status.twimlAppConfigured) {
    return (
      <StyledContainer>
        <StyledIcon colorKey="yellow">
          <IconRefresh size={20} />
        </StyledIcon>
        <StyledTitle>
          <Trans>Phone system needs repair</Trans>
        </StyledTitle>
        <StyledPulse>
          <Trans>Fixing automatically...</Trans>
        </StyledPulse>
      </StyledContainer>
    );
  }

  // fallback: generic error
  if (status.error) {
    return (
      <StyledContainer>
        <StyledIcon colorKey="red">
          <IconAlertTriangle size={20} />
        </StyledIcon>
        <StyledTitle>
          <Trans>Phone system error</Trans>
        </StyledTitle>
        <StyledSubtext>{status.error}</StyledSubtext>
      </StyledContainer>
    );
  }

  return null;
};
