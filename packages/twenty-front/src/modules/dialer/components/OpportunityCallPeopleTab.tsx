import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import styled from '@emotion/styled';
import { useMemo, useState } from 'react';
import { t } from '@lingui/core/macro';

type NameComposite = {
  firstName?: string | null;
  lastName?: string | null;
};

type ListMemberRecord = ObjectRecord & {
  id: string;
  position?: number | null;
  status?: string | null;
  disposition?: string | null;
  name?: string | null;
  person?: {
    name?: NameComposite | string | null;
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

const extractName = (record: ListMemberRecord, index: number): string => {
  // listMember.name (string set during import)
  if (typeof record.name === 'string' && record.name.length > 0) {
    return record.name;
  }

  const personName = record.person?.name;

  if (typeof personName === 'string' && personName.length > 0) {
    return personName;
  }

  if (personName && typeof personName === 'object') {
    const parts = [personName.firstName, personName.lastName].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(' ');
    }
  }

  return `Person ${index + 1}`;
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

const CALLED_STATUSES = new Set(['COMPLETED', 'CALLED', 'SKIPPED']);

// styles

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(3)};
  overflow-y: auto;
`;

const StyledSectionHeader = styled.button`
  align-items: center;
  background: none;
  border: none;
  color: ${({ theme }) => theme.font.color.secondary};
  cursor: pointer;
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => `${theme.spacing(2)} 0`};
  text-transform: uppercase;

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledChevron = styled.span<{ isOpen: boolean }>`
  display: inline-block;
  transition: transform 0.15s ease;
  transform: ${({ isOpen }) => (isOpen ? 'rotate(90deg)' : 'rotate(0deg)')};
`;

const StyledCount = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-weight: ${({ theme }) => theme.font.weight.regular};
`;

const StyledRow = styled.div`
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(1)}`};
`;

const StyledPosition = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  min-width: 24px;
  text-align: right;
`;

const StyledInfo = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const StyledName = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledPhone = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledDisposition = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  text-transform: capitalize;
  white-space: nowrap;
`;

const StyledEmpty = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => theme.spacing(4)};
  text-align: center;
`;

type OpportunityCallPeopleTabProps = {
  listId: string;
};

export const OpportunityCallPeopleTab = ({
  listId,
}: OpportunityCallPeopleTabProps) => {
  const [calledOpen, setCalledOpen] = useState(false);

  const { records, loading } = useFindManyRecords<ListMemberRecord>({
    objectNameSingular: 'listMember',
    filter: { listId: { eq: listId } },
    limit: 200,
    orderBy: [{ position: 'AscNullsLast' }],
    recordGqlFields: {
      id: true,
      position: true,
      status: true,
      disposition: true,
      name: true,
      phoneNumber: {
        primaryPhoneNumber: true,
        additionalPhones: {
          number: true,
        },
      },
      person: {
        name: {
          firstName: true,
          lastName: true,
        },
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

  const { called, upNext } = useMemo(() => {
    const calledList: ListMemberRecord[] = [];
    const upNextList: ListMemberRecord[] = [];

    for (const record of records) {
      const status = (record.status ?? '').toUpperCase();
      const disposition = (record.disposition ?? '').toUpperCase();

      if (
        CALLED_STATUSES.has(status) ||
        CALLED_STATUSES.has(disposition) ||
        disposition.length > 0
      ) {
        calledList.push(record);
      } else {
        upNextList.push(record);
      }
    }

    return { called: calledList, upNext: upNextList };
  }, [records]);

  if (loading) {
    return <StyledContainer>{t`Loading people...`}</StyledContainer>;
  }

  if (records.length === 0) {
    return (
      <StyledContainer>
        <StyledEmpty>{t`No list members yet.`}</StyledEmpty>
      </StyledContainer>
    );
  }

  const renderRow = (record: ListMemberRecord, index: number) => {
    const phone = getListMemberPhone(record);
    const name = extractName(record, index);
    const disposition = record.disposition ?? record.status ?? null;

    return (
      <StyledRow key={record.id}>
        <StyledPosition>{record.position ?? index + 1}</StyledPosition>
        <StyledInfo>
          <StyledName>{name}</StyledName>
          {phone && <StyledPhone>{phone}</StyledPhone>}
        </StyledInfo>
        {disposition && (
          <StyledDisposition>{disposition.toLowerCase()}</StyledDisposition>
        )}
      </StyledRow>
    );
  };

  return (
    <StyledContainer>
      {called.length > 0 && (
        <>
          <StyledSectionHeader
            onClick={() => setCalledOpen((prev) => !prev)}
          >
            <StyledChevron isOpen={calledOpen}>▶</StyledChevron>
            {t`Called`}
            <StyledCount>({called.length})</StyledCount>
          </StyledSectionHeader>
          {calledOpen && called.map((record, i) => renderRow(record, i))}
        </>
      )}

      <StyledSectionHeader as="div">
        {t`Up Next`}
        <StyledCount>({upNext.length})</StyledCount>
      </StyledSectionHeader>
      {upNext.map((record, i) => renderRow(record, i))}

      {upNext.length === 0 && called.length > 0 && (
        <StyledEmpty>{t`All members have been called.`}</StyledEmpty>
      )}
    </StyledContainer>
  );
};
