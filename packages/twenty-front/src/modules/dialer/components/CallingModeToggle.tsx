import { useRecoilState } from 'recoil';
import { IconDeviceDesktop, IconPhone } from '@tabler/icons-react';
import styled from '@emotion/styled';

import { callingModeState } from '@/dialer/states/callingModeState';

const StyledToggle = styled.button<{ isActive: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.transparent.lighter};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.xs};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
  }
`;

export const CallingModeToggle = () => {
  const [mode, setMode] = useRecoilState(callingModeState);

  const isBrowser = mode === 'browser';
  const Icon = isBrowser ? IconDeviceDesktop : IconPhone;
  const label = isBrowser ? 'Browser' : 'Phone';

  return (
    <StyledToggle
      isActive={isBrowser}
      onClick={() => setMode(isBrowser ? 'phone' : 'browser')}
      title={`Calling via ${label}. Click to switch.`}
      aria-label={`Calling mode: ${label}`}
    >
      <Icon size={14} />
      {label}
    </StyledToggle>
  );
};
