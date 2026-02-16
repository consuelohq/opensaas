import { useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { IconPhone } from '@tabler/icons-react';
import styled from '@emotion/styled';

import { callingModeState } from '@/dialer/states/callingModeState';
import { dialerSidebarOpenState } from '@/dialer/states/dialerSidebarOpenState';
import { phoneNumberState } from '@/dialer/states/phoneNumberState';
import { selectedContactState } from '@/dialer/states/selectedContactState';
import { userCallbackPhoneState } from '@/dialer/states/userCallbackPhoneState';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type ClickToCallButtonProps = {
  phone: string;
  contactId?: string;
  contactName?: string;
};

const StyledButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: transparent;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
    color: ${({ theme }) => theme.color.blue};
  }
`;

export const ClickToCallButton = ({
  phone,
  contactId,
  contactName,
}: ClickToCallButtonProps) => {
  const callingMode = useRecoilValue(callingModeState);
  const userCallbackPhone = useRecoilValue(userCallbackPhoneState);
  const setDialerOpen = useSetRecoilState(dialerSidebarOpenState);
  const setPhoneNumber = useSetRecoilState(phoneNumberState);
  const setSelectedContact = useSetRecoilState(selectedContactState);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      setPhoneNumber(phone);

      if (contactId) {
        setSelectedContact({
          id: contactId,
          name: contactName ?? null,
          firstName: null,
          lastName: null,
          company: null,
          phone,
          email: null,
          avatarUrl: null,
        });
      }

      setDialerOpen(true);

      // phone callback mode — call user's phone first, then bridge
      if (callingMode === 'phone' && userCallbackPhone) {
        fetch(`${REACT_APP_SERVER_BASE_URL}/v1/calls/callback`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentPhone: userCallbackPhone,
            customerPhone: phone,
          }),
        }).catch(() => {
          // callback initiation failure — user can still dial from sidebar
        });
      }
    },
    [
      phone,
      contactId,
      contactName,
      callingMode,
      userCallbackPhone,
      setPhoneNumber,
      setSelectedContact,
      setDialerOpen,
    ],
  );

  return (
    <StyledButton
      onClick={handleClick}
      aria-label={`Call ${contactName ?? phone}`}
      title={`Call ${contactName ?? phone}`}
    >
      <IconPhone size={14} />
    </StyledButton>
  );
};
