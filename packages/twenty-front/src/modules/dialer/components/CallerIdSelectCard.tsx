import { useAvailableCallerIds } from '@/dialer/hooks/useAvailableCallerIds';
import { useCallerIdSelection } from '@/dialer/hooks/useCallerIdSelection';
import { localPresenceEnabledState } from '@/dialer/states/localPresenceEnabledState';
import { Select } from '@/ui/input/components/Select';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { useEffect } from 'react';
import { useRecoilState } from 'recoil';
import { IconPhone, IconWorld } from 'twenty-ui/display';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledToggle = styled.label`
  align-items: center;
  color: ${({ theme }) => theme.font.color.secondary};
  display: inline-flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledMessage = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: 1.5;
`;

type CallerIdSelectCardProps = {
  dropdownId: string;
};

export const CallerIdSelectCard = ({ dropdownId }: CallerIdSelectCardProps) => {
  useAvailableCallerIds();

  const { availableNumbers, selectedCallerId, setSelectedCallerId } =
    useCallerIdSelection();
  const [localPresenceEnabled, setLocalPresenceEnabled] = useRecoilState(
    localPresenceEnabledState,
  );

  useEffect(() => {
    if (!selectedCallerId && availableNumbers.length > 0) {
      setSelectedCallerId(availableNumbers[0].phoneNumber);
    }
  }, [availableNumbers, selectedCallerId, setSelectedCallerId]);

  if (availableNumbers.length === 0) {
    return (
      <StyledMessage>
        {t`No outbound numbers are available yet. Add a number in phone settings to start calling.`}
      </StyledMessage>
    );
  }

  return (
    <StyledContainer>
      <Select
        dropdownId={dropdownId}
        fullWidth
        label={t`Call from`}
        value={selectedCallerId ?? availableNumbers[0].phoneNumber}
        onChange={(value) => setSelectedCallerId(value)}
        options={availableNumbers.map((option) => ({
          value: option.phoneNumber,
          label: option.friendlyName || option.phoneNumber,
          Icon: IconPhone,
        }))}
      />

      <StyledToggle>
        <input
          checked={localPresenceEnabled}
          onChange={(event) => setLocalPresenceEnabled(event.target.checked)}
          type="checkbox"
        />
        <IconWorld size={14} />
        <span>{t`Prefer a local presence number when a matching area code exists.`}</span>
      </StyledToggle>
    </StyledContainer>
  );
};
