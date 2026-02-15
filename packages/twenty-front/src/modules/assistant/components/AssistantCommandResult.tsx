import styled from '@emotion/styled';

import { type ExecutedCommand } from '@/assistant/states/assistantState';

const StyledCard = styled.div`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  overflow: hidden;
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
  background: ${({ theme }) => theme.background.tertiary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.secondary};
  cursor: pointer;
  user-select: none;
`;

const StyledCardBody = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  max-height: 200px;
  overflow-y: auto;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    text-align: left;
    padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1)};
    border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
    color: ${({ theme }) => theme.font.color.primary};
  }

  th {
    font-weight: ${({ theme }) => theme.font.weight.medium};
    color: ${({ theme }) => theme.font.color.secondary};
  }
`;

const StyledPre = styled.pre`
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: ${({ theme }) => theme.font.color.primary};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.xs};
`;

type AssistantCommandResultProps = {
  command: ExecutedCommand;
};

const isArrayOfObjects = (
  val: unknown,
): val is Record<string, unknown>[] =>
  Array.isArray(val) &&
  val.length > 0 &&
  typeof val[0] === 'object' &&
  val[0] !== null;

const renderTable = (rows: Record<string, unknown>[]) => {
  const keys = Object.keys(rows[0]);

  return (
    <StyledTable>
      <thead>
        <tr>
          {keys.map((k) => (
            <th key={k}>{k}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 20).map((row, i) => (
          <tr key={i}>
            {keys.map((k) => (
              <td key={k}>{String(row[k] ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </StyledTable>
  );
};

export const AssistantCommandResult = ({
  command,
}: AssistantCommandResultProps) => {
  const data = command.result;

  return (
    <StyledCard>
      <StyledCardHeader>{command.name}</StyledCardHeader>
      <StyledCardBody>
        {isArrayOfObjects(data) ? (
          renderTable(data)
        ) : (
          <StyledPre>{JSON.stringify(data, null, 2)}</StyledPre>
        )}
      </StyledCardBody>
    </StyledCard>
  );
};
