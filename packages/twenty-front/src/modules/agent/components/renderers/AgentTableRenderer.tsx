import styled from '@emotion/styled';
import { useCallback, useMemo, useState } from 'react';

type TableInput = {
  columns: Array<string>;
  rows: Array<Record<string, unknown>>;
  title?: string;
};

type AgentTableRendererProps = {
  input: TableInput;
};

const PAGE_SIZE = 10;

const StyledWrapper = styled.div`
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  background: ${({ theme }) => theme.background.primary};
  overflow: hidden;
`;

const StyledTitle = styled.div`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
`;

const StyledTable = styled.table`
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.font.size.sm};
  width: 100%;
`;

const StyledTh = styled.th`
  text-align: left;
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(2)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  color: ${({ theme }) => theme.font.color.secondary};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  cursor: pointer;
  user-select: none;

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledTd = styled.td`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  color: ${({ theme }) => theme.font.color.primary};
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(2)};
`;

const StyledPagination = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(2)};
`;

const StyledPageButton = styled.button<{ disabled: boolean }>`
  background: none;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(0.5)}
    ${({ theme }) => theme.spacing(1.5)};
  color: ${({ theme, disabled }) =>
    disabled ? theme.font.color.tertiary : theme.font.color.primary};
  cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

export const AgentTableRenderer = ({ input }: AgentTableRendererProps) => {
  const { columns, rows, title } = input;
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);

  const handleSort = useCallback(
    (col: string) => {
      if (sortCol === col) {
        setSortAsc((prev) => !prev);
      } else {
        setSortCol(col);
        setSortAsc(true);
      }
      setPage(0);
    },
    [sortCol],
  );

  const sorted = useMemo(() => {
    if (!sortCol) {
      return rows;
    }

    return [...rows].sort((a, b) => {
      const aVal = String(a[sortCol] ?? '');
      const bVal = String(b[sortCol] ?? '');

      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [rows, sortCol, sortAsc]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const needsPagination = sorted.length > PAGE_SIZE;

  return (
    <StyledWrapper>
      {title && <StyledTitle>{title}</StyledTitle>}
      <StyledTable>
        <thead>
          <tr>
            {columns.map((col) => (
              <StyledTh key={col} onClick={() => handleSort(col)}>
                {col}
                {sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
              </StyledTh>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((col) => (
                <StyledTd key={col}>{String(row[col] ?? '')}</StyledTd>
              ))}
            </tr>
          ))}
        </tbody>
      </StyledTable>
      {needsPagination && (
        <StyledPagination>
          <span>
            {page * PAGE_SIZE + 1}–
            {Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <StyledPageButton
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </StyledPageButton>
            <StyledPageButton
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </StyledPageButton>
          </div>
        </StyledPagination>
      )}
    </StyledWrapper>
  );
};
