import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useRecoilState } from 'recoil';
// eslint-disable-next-line no-restricted-imports -- twenty-ui module resolution broken (DEV-788)
import { IconFilter, IconX } from '@tabler/icons-react';

import { historyFiltersState } from '@/dialer/states/historyState';
import {
  type HistoryCallOutcome,
  type HistoryFilters,
} from '@/dialer/types/history';

/* eslint-disable lingui/no-unlocalized-strings */
const OUTCOME_OPTIONS: Array<{
  value: HistoryCallOutcome | 'all';
  label: string;
}> = [
  { value: 'all', label: 'All Calls' },
  { value: 'connected', label: 'Answered' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'no-answer', label: 'No Answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'not-interested', label: 'Not Interested' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'callback-requested', label: 'Callback' },
  { value: 'wrong-number', label: 'Wrong Number' },
  { value: 'dnc', label: 'DNC' },
];

type DatePreset = 'today' | 'yesterday' | 'this-week' | 'this-month' | 'custom';

const DATE_PRESETS: Array<{ value: DatePreset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this-week', label: 'This Week' },
  { value: 'this-month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
];
/* eslint-enable lingui/no-unlocalized-strings */

const getDateRange = (
  preset: DatePreset,
): { dateFrom: string; dateTo: string } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayIso = today.toISOString();
  const nowIso = now.toISOString();

  switch (preset) {
    case 'today':
      return { dateFrom: todayIso, dateTo: nowIso };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { dateFrom: yesterday.toISOString(), dateTo: todayIso };
    }
    case 'this-week': {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      return { dateFrom: weekStart.toISOString(), dateTo: nowIso };
    }
    case 'this-month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { dateFrom: monthStart.toISOString(), dateTo: nowIso };
    }
    default:
      return { dateFrom: todayIso, dateTo: nowIso };
  }
};

type HistoryFilterProps = {
  totalCount: number;
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
`;

const StyledRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledSelect = styled.select`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
`;

const StyledDateInput = styled.input`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
`;

const StyledClearButton = styled.button`
  align-items: center;
  background: none;
  border: none;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)};

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledCount = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin-left: auto;
`;

const StyledFilterIcon = styled(IconFilter)`
  color: ${({ theme }) => theme.font.color.tertiary};
  flex-shrink: 0;
`;

export const HistoryFilter = ({ totalCount }: HistoryFilterProps) => {
  const { t } = useLingui();
  const [historyFilters, setHistoryFilters] =
    useRecoilState(historyFiltersState);

  const hasActiveFilters =
    historyFilters.outcome !== 'all' ||
    historyFilters.dateFrom !== null ||
    historyFilters.dateTo !== null;

  const updateFilter = (partial: Partial<HistoryFilters>) => {
    setHistoryFilters((prev) => ({ ...prev, ...partial }));
  };

  const handleOutcomeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateFilter({ outcome: e.target.value as HistoryCallOutcome | 'all' });
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = e.target.value as DatePreset;
    if (preset === 'custom') {
      return;
    }
    const range = getDateRange(preset);
    updateFilter({ dateFrom: range.dateFrom, dateTo: range.dateTo });
  };

  const handleClear = () => {
    setHistoryFilters({
      outcome: 'all',
      dateFrom: null,
      dateTo: null,
      contactId: null,
    });
  };

  const activePreset = (): DatePreset | '' => {
    if (historyFilters.dateFrom === null || historyFilters.dateTo === null) {
      return '';
    }
    // if dates are set but don't match a preset, it's custom
    return 'custom';
  };

  return (
    <StyledContainer>
      <StyledRow>
        <StyledFilterIcon size={16} />
        <StyledSelect
          onChange={handleOutcomeChange}
          value={historyFilters.outcome}
        >
          {OUTCOME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </StyledSelect>
        <StyledSelect onChange={handlePresetChange} value={activePreset()}>
          <option value="">{t`Any Date`}</option>
          {DATE_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </StyledSelect>
        {hasActiveFilters && (
          <StyledClearButton onClick={handleClear} type="button">
            <IconX size={14} />
            {t`Clear`}
          </StyledClearButton>
        )}
        <StyledCount>{t`${totalCount} calls`}</StyledCount>
      </StyledRow>
      {activePreset() === 'custom' && (
        <StyledRow>
          <StyledDateInput
            onChange={(e) =>
              updateFilter({
                dateFrom:
                  e.target.value !== ''
                    ? new Date(e.target.value).toISOString()
                    : null,
              })
            }
            type="date"
            value={
              historyFilters.dateFrom !== null
                ? historyFilters.dateFrom.split('T')[0]
                : ''
            }
          />
          <span>—</span>
          <StyledDateInput
            onChange={(e) =>
              updateFilter({
                dateTo:
                  e.target.value !== ''
                    ? new Date(e.target.value).toISOString()
                    : null,
              })
            }
            type="date"
            value={
              historyFilters.dateTo !== null
                ? historyFilters.dateTo.split('T')[0]
                : ''
            }
          />
        </StyledRow>
      )}
    </StyledContainer>
  );
};
