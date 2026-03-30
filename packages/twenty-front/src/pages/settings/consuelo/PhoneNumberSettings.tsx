import { useAvailableCallerIds } from '~/modules/dialer/hooks/useAvailableCallerIds';
import { availableCallerIdsState } from '@/dialer/states/availableCallerIdsState';
import { selectedCallerIdState } from '@/dialer/states/selectedCallerIdState';
import { useReleaseNumber } from '@/dialer/hooks/useReleaseNumber';
import { useSetPrimaryNumber } from '@/dialer/hooks/useSetPrimaryNumber';
import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import {
  IconPhone,
  IconPlus,
  IconStar,
  IconStarFilled,
  IconTrash,
} from '@tabler/icons-react';
import { H2Title } from 'twenty-ui/display';
import { Card, Section } from 'twenty-ui/layout';

import { AddPhoneNumberModal } from '~/pages/settings/consuelo/AddPhoneNumberModal';

const StyledRow = styled.div`
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => `${theme.spacing(3)} ${theme.spacing(4)}`};

  &:last-child {
    border-bottom: none;
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

const StyledIconButton = styled.button`
  align-items: center;
  background: none;
  border: none;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  display: flex;
  padding: 4px;

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledPrimaryIcon = styled.button`
  align-items: center;
  background: none;
  border: none;
  color: ${({ theme }) => theme.color.blue};
  cursor: pointer;
  display: flex;
  padding: 4px;
`;

const StyledAddButton = styled.button`
  align-items: center;
  background: ${({ theme }) => theme.color.blue};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: #fff;
  cursor: pointer;
  display: flex;
  font-size: 13px;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};

  &:hover {
    opacity: 0.9;
  }
`;

const StyledHeaderRow = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
`;

const StyledModalBackdrop = styled.div`
  align-items: center;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 100;
`;

export const PhoneNumberSettings = () => {
  const { refetch } = useAvailableCallerIds();
  const availableCallerIds = useRecoilValue(availableCallerIdsState);
  const setSelectedCallerId = useSetRecoilState(selectedCallerIdState);
  const [showModal, setShowModal] = useState(false);
  const { release } = useReleaseNumber();
  const { setPrimary } = useSetPrimaryNumber();

  const handleSetPrimary = useCallback(
    async (sid: string, phoneNumber: string) => {
      const success = await setPrimary(sid);
      if (success) {
        setSelectedCallerId(phoneNumber);
        refetch();
      }
    },
    [setPrimary, setSelectedCallerId, refetch],
  );

  const handleDelete = useCallback(
    async (sid: string) => {
      const success = await release(sid);
      if (success) {
        refetch();
      }
    },
    [release, refetch],
  );

  const handleProvisioned = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <Section>
      <StyledHeaderRow>
        <H2Title
          title="Phone Numbers"
          description="Manage your outbound caller IDs"
        />
        <StyledAddButton onClick={() => setShowModal(true)}>
          <IconPlus size={14} />
          Add Number
        </StyledAddButton>
      </StyledHeaderRow>
      <Card rounded>
        {availableCallerIds.length === 0 ? (
          <StyledEmptyState>
            No phone numbers yet. Click &quot;Add Number&quot; to get started.
          </StyledEmptyState>
        ) : (
          availableCallerIds.map((number) => (
            <StyledRow key={number.phoneNumber}>
              <IconPhone size={16} />
              <StyledNumberInfo>
                <StyledPhoneNumber>{number.phoneNumber}</StyledPhoneNumber>
                {number.friendlyName && (
                  <StyledFriendlyName>{number.friendlyName}</StyledFriendlyName>
                )}
              </StyledNumberInfo>
              {number.areaCode && (
                <StyledAreaCode>{number.areaCode}</StyledAreaCode>
              )}
              {number.isPrimary ? (
                <StyledPrimaryIcon aria-label="Primary number">
                  <IconStarFilled size={16} />
                </StyledPrimaryIcon>
              ) : (
                <StyledIconButton
                  onClick={() =>
                    handleSetPrimary(number.sid, number.phoneNumber)
                  }
                  aria-label="Set as primary"
                >
                  <IconStar size={16} />
                </StyledIconButton>
              )}
              <StyledIconButton
                onClick={() => handleDelete(number.sid)}
                aria-label="Delete number"
              >
                <IconTrash size={16} />
              </StyledIconButton>
            </StyledRow>
          ))
        )}
      </Card>
      {showModal && (
        <StyledModalBackdrop onClick={() => setShowModal(false)}>
          <div onClick={(event) => event.stopPropagation()}>
            <AddPhoneNumberModal
              onClose={() => setShowModal(false)}
              onProvisioned={handleProvisioned}
            />
          </div>
        </StyledModalBackdrop>
      )}
    </Section>
  );
};
