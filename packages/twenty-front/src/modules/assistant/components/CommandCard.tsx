import styled from '@emotion/styled';

import type {
  CommandResult,
  ContactResult,
  HealthData,
  HistoryEntry,
  MetricsData,
} from '@/assistant/commands/types';

// -- styled components --

const StyledCard = styled.div`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  overflow: hidden;
  font-size: ${({ theme }) => theme.font.size.sm};
  max-width: 85%;
`;

const StyledCardHeader = styled.div`
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(2)};
  background: ${({ theme }) => theme.background.tertiary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledCardBody = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledFields = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing(1.5)};
`;

const StyledField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const StyledFieldLabel = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
`;

const StyledFieldValue = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing(1)} 0;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};

  &:last-of-type {
    border-bottom: none;
  }
`;

const StyledRowPrimary = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledRowSecondary = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.xs};
`;

const StyledError = styled.div`
  color: ${({ theme }) => theme.color.red};
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledStatusDot = styled.span<{ healthy: boolean }>`
  background: ${({ theme, healthy }) =>
    healthy ? theme.color.green : theme.color.red};
  border-radius: 50%;
  display: inline-block;
  height: 8px;
  margin-right: ${({ theme }) => theme.spacing(1)};
  width: 8px;
`;

// -- helpers --

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const formatRate = (rate: number): string => `${Math.round(rate * 100)}%`;

// -- renderers --

const MeCard = ({ data }: { data: MetricsData }) => (
  <StyledCard>
    <StyledCardHeader>Your Stats</StyledCardHeader>
    <StyledCardBody>
      <StyledFields>
        <StyledField>
          <StyledFieldLabel>Calls Today</StyledFieldLabel>
          <StyledFieldValue>{data.callsToday}</StyledFieldValue>
        </StyledField>
        <StyledField>
          <StyledFieldLabel>Calls This Week</StyledFieldLabel>
          <StyledFieldValue>{data.callsThisWeek}</StyledFieldValue>
        </StyledField>
        <StyledField>
          <StyledFieldLabel>Connect Rate</StyledFieldLabel>
          <StyledFieldValue>{formatRate(data.answerRate)}</StyledFieldValue>
        </StyledField>
        <StyledField>
          <StyledFieldLabel>Avg Duration</StyledFieldLabel>
          <StyledFieldValue>
            {formatDuration(data.avgDuration)}
          </StyledFieldValue>
        </StyledField>
      </StyledFields>
    </StyledCardBody>
  </StyledCard>
);

const StatusCard = ({ data }: { data: HealthData }) => {
  const isHealthy = data.status === 'ok';

  return (
    <StyledCard>
      <StyledCardHeader>Service Status</StyledCardHeader>
      <StyledCardBody>
        <StyledRow>
          <StyledRowPrimary>
            <StyledStatusDot healthy={isHealthy} />
            API
          </StyledRowPrimary>
          <StyledRowSecondary>
            {isHealthy ? 'Healthy' : 'Unhealthy'}
          </StyledRowSecondary>
        </StyledRow>
      </StyledCardBody>
    </StyledCard>
  );
};

const ContactsCard = ({ data }: { data: ContactResult[] }) => (
  <StyledCard>
    <StyledCardHeader>
      {data.length} Contact{data.length !== 1 ? 's' : ''} Found
    </StyledCardHeader>
    <StyledCardBody>
      {data.length === 0 ? (
        <StyledRowSecondary>No matching contacts</StyledRowSecondary>
      ) : (
        data.map((c) => (
          <StyledRow key={c.id}>
            <div>
              <StyledRowPrimary>{c.name}</StyledRowPrimary>
              <br />
              <StyledRowSecondary>
                {c.phone}
                {c.company ? ` · ${c.company}` : ''}
              </StyledRowSecondary>
            </div>
          </StyledRow>
        ))
      )}
    </StyledCardBody>
  </StyledCard>
);

const HistoryCard = ({ data }: { data: HistoryEntry[] }) => (
  <StyledCard>
    <StyledCardHeader>Recent Calls</StyledCardHeader>
    <StyledCardBody>
      {data.length === 0 ? (
        <StyledRowSecondary>No call history</StyledRowSecondary>
      ) : (
        data.map((entry) => (
          <StyledRow key={entry.id}>
            <div>
              <StyledRowPrimary>
                {entry.contact_name ?? entry.to}
              </StyledRowPrimary>
              <br />
              <StyledRowSecondary>
                {entry.outcome} · {formatDuration(entry.duration_seconds)}
              </StyledRowSecondary>
            </div>
            <StyledRowSecondary>
              {new Date(entry.start_time).toLocaleDateString()}
            </StyledRowSecondary>
          </StyledRow>
        ))
      )}
    </StyledCardBody>
  </StyledCard>
);

// -- main component --

type CommandCardProps = {
  result: CommandResult;
};

export const CommandCard = ({ result }: CommandCardProps) => {
  if (result.error) {
    return (
      <StyledCard>
        <StyledCardHeader>Error</StyledCardHeader>
        <StyledError>{result.error}</StyledError>
      </StyledCard>
    );
  }

  switch (result.command) {
    case 'me':
      return <MeCard data={result.data as MetricsData} />;
    case 'status':
      return <StatusCard data={result.data as HealthData} />;
    case 'contacts-search':
      return <ContactsCard data={result.data as ContactResult[]} />;
    case 'history':
      return <HistoryCard data={result.data as HistoryEntry[]} />;
    default:
      return null;
  }
};
