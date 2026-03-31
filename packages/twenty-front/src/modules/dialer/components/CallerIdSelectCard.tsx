import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { useEffect } from 'react';
import { useRecoilState } from 'recoil';
import { IconPhone, IconWorld } from 'twenty-ui/display';
import { Checkbox } from 'twenty-ui/input';

import { useAvailableCallerIds } from '@/dialer/hooks/useAvailableCallerIds';
import { useCallerIdSelection } from '@/dialer/hooks/useCallerIdSelection';
import { localPresenceEnabledState } from '@/dialer/states/localPresenceEnabledState';
import { Select } from '@/ui/input/components/Select';

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

  const { availableCallerIds, selectedCallerId, setSelectedCallerId } =
    useCallerIdSelection();
  const [localPresenceEnabled, setLocalPresenceEnabled] = useRecoilState(
    localPresenceEnabledState,
  );

  useEffect(() => {
    if (!selectedCallerId && availableCallerIds.length > 0) {
      setSelectedCallerId(availableCallerIds[0].phoneNumber);
    }
  }, [availableCallerIds, selectedCallerId, setSelectedCallerId]);

  if (availableCallerIds.length === 0) {
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
        value={selectedCallerId ?? availableCallerIds[0].phoneNumber}
        onChange={(value) => setSelectedCallerId(value)}
        disabled={localPresenceEnabled}
        options={availableCallerIds.map((option) => ({
          value: option.phoneNumber,
          label: option.friendlyName || option.phoneNumber,
          Icon: IconPhone,
        }))}
      />

      <StyledToggle>
        <Checkbox
          checked={localPresenceEnabled}
          onCheckedChange={(checked) => setLocalPresenceEnabled(checked)}
        />
        <IconWorld size={14} />
        <span title={t`When enabled, we match the outbound caller ID to the closest area code available for the person being called.`}>
          {t`Prefer local presence calling`}
        </span>
      </StyledToggle>
    </StyledContainer>
  );
};
