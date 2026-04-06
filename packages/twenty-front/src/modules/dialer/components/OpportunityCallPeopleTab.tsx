import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';

type ListMemberRecord = ObjectRecord & {
  id: string;
  position?: number | null;
  status?: string | null;
  disposition?: string | null;
  person?: {
    name?: string | null;
    phone?: string | null;
    phones?: {
      primaryPhoneNumber?: string | null;
      additionalPhones?: Array<{ number?: string | null }> | null;
    } | null;
  } | null;
  phoneNumber?: {
    primaryPhoneNumber?: string | null;
    additionalPhones?: Array<{ number?: string | null }> | null;
  } | null;
};

const getListMemberPhone = (record: ListMemberRecord) => {
  return (
    record.phoneNumber?.primaryPhoneNumber ??
    record.phoneNumber?.additionalPhones?.find((entry) => entry.number)
      ?.number ??
    record.person?.phones?.primaryPhoneNumber ??
    record.person?.phones?.additionalPhones?.find((entry) => entry.number)
      ?.number ??
    record.person?.phone ??
    null
  );
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledCard = styled.div`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
`;

const StyledInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledName = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledMeta = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledBadge = styled.span`
  align-items: center;
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.rounded};
  color: ${({ theme }) => theme.font.color.secondary};
  display: inline-flex;
  font-size: ${({ theme }) => theme.font.size.xs};
  height: fit-content;
  padding: ${({ theme }) => `${theme.spacing(1)} ${theme.spacing(2)}`};
`;

const StyledEmpty = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

type OpportunityCallPeopleTabProps = {
  listId: string;
};

export const OpportunityCallPeopleTab = ({
  listId,
}: OpportunityCallPeopleTabProps) => {
  const { records, loading } = useFindManyRecords<ListMemberRecord>({
    objectNameSingular: 'listMember',
    filter: { listId: { eq: listId } },
    limit: 100,
    recordGqlFields: {
      id: true,
      position: true,
      status: true,
      disposition: true,
      phoneNumber: {
        primaryPhoneNumber: true,
        additionalPhones: {
          number: true,
        },
      },
      person: {
        name: true,
        phone: true,
        phones: {
          primaryPhoneNumber: true,
          additionalPhones: {
            number: true,
          },
        },
      },
    },
  });

  if (loading) {
    return <StyledContainer>{t`Loading people...`}</StyledContainer>;
  }

  if (records.length === 0) {
    return (
      <StyledContainer>
        <StyledEmpty>{t`No list members have been loaded for this list yet.`}</StyledEmpty>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer>
      {records.map((record, index) => {
        const positionLabel = String(record.position ?? index + 1);
        const personName = record.person?.name ?? t`Person ${positionLabel}`;

        return (
          <StyledCard key={record.id}>
            <StyledInfo>
              <StyledName>{personName}</StyledName>
              <StyledMeta>
                {getListMemberPhone(record) ?? t`Phone unavailable`}
              </StyledMeta>
              <StyledMeta>
                {record.disposition ?? record.status ?? t`Pending`}
              </StyledMeta>
            </StyledInfo>
            <StyledBadge>{t`#${positionLabel}`}</StyledBadge>
          </StyledCard>
        );
      })}
    </StyledContainer>
  );
};
