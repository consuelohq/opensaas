import { useSpreadsheetImportInternal } from '@/spreadsheet-import/hooks/useSpreadsheetImportInternal';
import { initialComputedColumnsSelector, matchColumnsState,
} from '@/spreadsheet-import/steps/components/MatchColumnsStep/components/states/initialComputedColumnsState';
import { suggestedFieldsByColumnHeaderState } from '@/spreadsheet-import/steps/components/MatchColumnsStep/components/states/suggestedFieldsByColumnHeaderState';
import { SpreadsheetColumnType } from '@/spreadsheet-import/types/SpreadsheetColumnType';
import type { SpreadsheetColumns, ImportedRow } from '@/spreadsheet-import/types';
import { getMatchedColumnsWithFuse } from '@/spreadsheet-import/utils/getMatchedColumnsWithFuse';
import { setColumn } from '@/spreadsheet-import/utils/setColumn';
import { useRecoilCallback } from 'recoil';

import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

// call the AI endpoint to map unmatched CSV columns to target fields
// returns index-based mappings: { [columnIndex]: targetFieldKey | 'skip' }
const fetchAiMappings = async (
  unmatchedColumns: { index: number; header: string }[],
  sampleRows: ImportedRow[],
  fields: { key: string; label: string }[],
): Promise<Record<number, string> | null> => {
  try {
    const response = await authenticatedFetch(
      `${REACT_APP_SERVER_BASE_URL}/api/v1/csv-mapping/analyze`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columns: unmatchedColumns.map((c) => ({
            index: c.index,
            header: c.header,
          })),
          sampleRows: sampleRows.slice(0, 5).map((row) =>
            unmatchedColumns.map((c) => {
              const originalIndex = row[c.index];
              return typeof originalIndex === 'string'
                ? originalIndex.slice(0, 100)
                : String(originalIndex ?? '');
            }),
          ),
          targetFields: fields,
        }),
      },
    );

    if (!response.ok) return null;

    // wait for response body with timeout
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 3000),
    );
    const isSuccess = await Promise.race([
      response.ok,
      timeoutPromise.catch(() => false),
    ]);
    if (!isSuccess) return null;

    const data = (await response.json()) as {
      mappings?: Record<string, string>;
    };
    // convert string keys to numeric keys
    if (data.mappings) {
      const numericMappings: Record<number, string> = {};
      for (const [key, value] of Object.entries(data.mappings)) {
        const idx = parseInt(key, 10);
        if (!isNaN(idx)) {
          numericMappings[idx] = value;
        }
      }
      return numericMappings;
    }
    return null;
  } catch (_err: unknown) {
    // graceful fallback — AI failure should not block import
    return null;
  }
};

export const useComputeColumnSuggestionsAndAutoMatch = () => {
  const { spreadsheetImportFields: fields, autoMapHeaders } =
    useSpreadsheetImportInternal();

  const computeColumnSuggestionsAndAutoMatch = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({ headerValues, data }: { headerValues: string[]; data: ImportedRow[] }) => {
        const initialComputedColumns = await snapshot.getPromise(
          initialComputedColumnsSelector,
        );

        const { matchedColumns, suggestedFieldsByColumnHeader } =
          getMatchedColumnsWithFuse(headerValues, data, fields, autoMapHeaders);

        // find unmatched columns (those with type 'empty')
        const unmatchedIndices = matchedColumns
          .map((col, idx) => (col.type === SpreadsheetColumnType.empty ? idx : -1))
          .filter((idx) => idx !== -1);

        if (unmatchedIndices.length > 0) {
          // collect already-used field keys from Fuse-matched columns
          const usedFieldKeys = new Set(
            matchedColumns
              .filter(
                (c) =>
                  c.type === SpreadsheetColumnType.matched ||
                  c.type === SpreadsheetColumnType.matchedCheckbox ||
                  c.type === SpreadsheetColumnType.matchedSelect ||
                  c.type === SpreadsheetColumnType.matchedSelectOptions,
              )
              .map((c) => ('value' in c ? c.value : undefined))
              .filter((v): v is string => typeof v === 'string'),
          );

          // only offer fields that Fuse hasn't already matched
          const availableFields = fields
            .filter((f) => !usedFieldKeys.has(f.key))
            .map((f) => ({ key: f.key, label: f.label }));

          const unmatchedColumns = unmatchedIndices.map((idx) => ({
            index: idx,
            header: matchedColumns[idx].header,
          }));

          const aiMappings = await fetchAiMappings(
            unmatchedColumns,
            data as ImportedRow[],
            availableFields,
          );

          if (aiMappings) {
            applyAiMappings(
              matchedColumns,
              aiMappings,
              fields,
              data,
              availableFields.map((f) => f.key),
              usedFieldKeys,
            );
          }
        }

        set(matchColumnsState, matchedColumns);
        set(suggestedFieldsByColumnHeaderState, suggestedFieldsByColumnHeader);
      },
    [autoMapHeaders, fields],
  );

  return computeColumnSuggestionsAndAutoMatch;
};

// mutate matchedColumns in place — apply AI mappings to columns
const applyAiMappings = (
  matchedColumns: SpreadsheetColumns,
  aiMappings: Record<number, string>,
  fields: readonly { key: string; label: string; fieldType: { type: string } }[],
  data: ImportedRow[],
  allowedKeys: string[],
  alreadyUsedKeys: Set<string>,
) => {
  const usedByAi = new Set<string>(alreadyUsedKeys);

  for (const [idxStr, targetKey] of Object.entries(aiMappings)) {
    const colIdx = parseInt(idxStr, 10);
    if (isNaN(colIdx) || colIdx < 0 || colIdx >= matchedColumns.length) continue;

    // validate: must be in allowed keys
    if (!allowedKeys.includes(targetKey)) continue;
    // validate: must not be already used
    if (targetKey === 'skip' || usedByAi.has(targetKey)) continue;

    const field = fields.find((f) => f.key === targetKey);
    if (!field) continue;

    usedByAi.add(targetKey);
    matchedColumns[colIdx] = setColumn(
      matchedColumns[colIdx],
      field as Parameters<typeof setColumn>[1],
      data,
    );
  }
};
