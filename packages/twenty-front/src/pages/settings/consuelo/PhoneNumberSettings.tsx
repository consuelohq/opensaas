import { useAvailableCallerIds } from '~/modules/dialer/hooks/useAvailableCallerIds';
import { availableCallerIdsState } from '@/dialer/states/availableCallerIdsState';
import { selectedCallerIdState } from '@/dialer/states/selectedCallerIdState';
import styled from '@emotion/styled';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { IconPhone, IconStar, IconStarFilled } from '@tabler/icons-react';
import { H2Title } from 'twenty-ui/display';
import { Card, Section } from 'twenty-ui/layout';

const StyledRow = styled.button<{ isSelected: boolean }>`
  align-items: center;
  background: ${({ isSelected, theme }) =>
    isSelected ? theme.background.transparent.light : 'transparent'};
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  cursor: pointer;
  display: flex;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => `${theme.spacing(3)} ${theme.spacing(4)}`};
  text-align: left;
  width: 100%;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${({ theme }) => theme.background.transparent.lighter};
  }
`;

const StyledNumberInfo = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledPhoneNumber = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledFriendlyName = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledAreaCode = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledEmptyState = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
  padding: ${({ theme }) => theme.spacing(4)};
  text-align: center;
`;

export const PhoneNumberSettings = () => {
  // trigger fetch if not already done
  useAvailableCallerIds();

  const phoneNumbers = useRecoilValue(availableCallerIdsState);
  const setSelectedCallerId = useSetRecoilState(selectedCallerIdState);
  const selectedCallerId = useRecoilValue(selectedCallerIdState);

  const handleSelect = (phoneNumber: string) => {
    setSelectedCallerId(phoneNumber);
  };

  return (
    <Section>
      <H2Title
        title="Phone Numbers"
        description="Select your primary outbound caller ID"
      />
      <Card rounded>
        {phoneNumbers.length === 0 ? (
          <StyledEmptyState>
            No phone numbers available. Configure your Twilio account and add
            numbers to get started.
          </StyledEmptyState>
        ) : (
          phoneNumbers.map((number) => {
            const isSelected = selectedCallerId === number.phoneNumber;

            return (
              <StyledRow
                key={number.phoneNumber}
                isSelected={isSelected}
                onClick={() => handleSelect(number.phoneNumber)}
              >
                <IconPhone size={16} />
                <StyledNumberInfo>
                  <StyledPhoneNumber>{number.phoneNumber}</StyledPhoneNumber>
                  {number.friendlyName && (
                    <StyledFriendlyName>
                      {number.friendlyName}
                    </StyledFriendlyName>
                  )}
                </StyledNumberInfo>
                {number.areaCode && (
                  <StyledAreaCode>{number.areaCode}</StyledAreaCode>
                )}
                {isSelected ? (
                  <IconStarFilled size={16} />
                ) : (
                  <IconStar size={16} />
                )}
              </StyledRow>
            );
          })
        )}
      </Card>
    </Section>
  );
};
