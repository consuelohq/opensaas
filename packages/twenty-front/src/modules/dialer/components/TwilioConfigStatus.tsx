import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import {
  IconCloud,
  IconKey,
  IconPhone,
  IconAlertTriangle,
  IconSettings,
  IconRefresh,
} from '@tabler/icons-react';
import { useRecoilValue } from 'recoil';
import { useNavigate } from 'react-router-dom';

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

const StyledIcon = styled.div<{ color: string }>`
  align-items: center;
  background: ${({ color }) => color};
  border-radius: 50%;
  color: #fff;
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

export const TwilioConfigStatusEffect = () => {
  const twilioConfigStatus = useRecoilValue(twilioConfigStatusState);
  const navigate = useNavigate();

  // loading or fully configured — render nothing
  if (!status || status.configured) return null;

  // hosted: sub-account not provisioned
  if (status.mode === 'hosted' && !status.twilioConnected) {
    return (
      <StyledContainer>
        <StyledIcon color="#3b82f6">
          <IconCloud size={20} />
        </StyledIcon>
        <StyledTitle>Setting up your phone system...</StyledTitle>
        <StyledPulse>This takes about 30 seconds on first use.</StyledPulse>
      </StyledContainer>
    );
  }

  // hosted: connected but no phone numbers
  if (status.mode === 'hosted' && !status.hasPhoneNumbers) {
    return (
      <StyledContainer>
        <StyledIcon color="#3b82f6">
          <IconPhone size={20} />
        </StyledIcon>
        <StyledTitle>Pick a phone number to start calling</StyledTitle>
        <StyledButton onClick={() => navigate('/settings/accounts')}>
          <IconSettings size={14} /> Go to Settings
        </StyledButton>
      </StyledContainer>
    );
  }

  // hosted: TwiML app missing — auto-fix
  if (status.mode === 'hosted' && !status.twimlAppConfigured) {
    return (
      <StyledContainer>
        <StyledIcon color="#eab308">
          <IconRefresh size={20} />
        </StyledIcon>
        <StyledTitle>Phone system needs repair</StyledTitle>
        <StyledPulse>Fixing automatically...</StyledPulse>
      </StyledContainer>
    );
  }

  // BYOK: no credentials or connection failed
  if (status.mode === 'byok' && !status.twilioConnected) {
    const hasError = !!status.error;
    return (
      <StyledContainer>
        <StyledIcon color={hasError ? '#ef4444' : '#6b7280'}>
          {hasError ? <IconAlertTriangle size={20} /> : <IconKey size={20} />}
        </StyledIcon>
        <StyledTitle>
          {hasError
            ? 'Twilio connection failed'
            : 'Connect your Twilio account to start calling'}
        </StyledTitle>
        {hasError && (
          <StyledSubtext>Check your credentials in Settings</StyledSubtext>
        )}
        <StyledButton onClick={() => navigate('/settings/accounts')}>
          <IconSettings size={14} /> Go to Settings
        </StyledButton>
      </StyledContainer>
    );
  }

  // BYOK: TwiML app missing
  if (status.mode === 'byok' && !status.twimlAppConfigured) {
    return (
      <StyledContainer>
        <StyledIcon color="#eab308">
          <IconRefresh size={20} />
        </StyledIcon>
        <StyledTitle>Phone system needs repair</StyledTitle>
        <StyledPulse>Fixing automatically...</StyledPulse>
      </StyledContainer>
    );
  }

  // fallback: generic error
  if (status.error) {
    return (
      <StyledContainer>
        <StyledIcon color="#ef4444">
          <IconAlertTriangle size={20} />
        </StyledIcon>
        <StyledTitle>Phone system error</StyledTitle>
        <StyledSubtext>{status.error}</StyledSubtext>
      </StyledContainer>
    );
  }

  return null;
};
