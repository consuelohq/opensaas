import { Trans, useLingui } from '@lingui/react/macro';
import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { availableCallerIdsState } from '@/dialer/states/availableCallerIdsState';
import { selectedCallerIdState } from '@/dialer/states/selectedCallerIdState';
import { useReleaseNumber } from '@/dialer/hooks/useReleaseNumber';
import { useSetPrimaryNumber } from '@/dialer/hooks/useSetPrimaryNumber';
import {
  H2Title,
  IconPhone,
  IconPlus,
  IconTrash,
  IconTwentyStar,
  IconTwentyStarFilled,
} from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { Card, Section } from 'twenty-ui/layout';
import { useAvailableCallerIds } from '~/modules/dialer/hooks/useAvailableCallerIds';

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

const StyledHeaderRow = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
`;

const StyledModalBackdrop = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.background.transparent.medium};
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 100;
`;
export const PhoneNumberSettings = () => {
  const { t } = useLingui();
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
          title={t`Phone Numbers`}
          description={t`Manage your outbound caller IDs`}
        />
        <Button
          Icon={IconPlus}
          onClick={() => setShowModal(true)}
          title={t`Add Number`}
          accent="blue"
          size="small"
        />
      </StyledHeaderRow>
      <Card rounded>
        {availableCallerIds.length === 0 ? (
          <StyledEmptyState>
            <Trans>
              No phone numbers yet. Click "Add Number" to get started.
            </Trans>
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
                <StyledPrimaryIcon aria-label={t`Primary number`}>
                  <IconTwentyStarFilled size={16} />
                </StyledPrimaryIcon>
              ) : (
                <StyledIconButton
                  onClick={() =>
                    handleSetPrimary(number.sid, number.phoneNumber)
                  }
                  aria-label={t`Set as primary`}
                >
                  <IconTwentyStar size={16} />
                </StyledIconButton>
              )}
              <StyledIconButton
                onClick={() => handleDelete(number.sid)}
                aria-label={t`Delete number`}
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
