import { useSpreadsheetImportInternal } from '@/spreadsheet-import/hooks/useSpreadsheetImportInternal';
import {
  initialComputedColumnsSelector,
  matchColumnsState,
} from '@/spreadsheet-import/steps/components/MatchColumnsStep/components/states/initialComputedColumnsState';
import { suggestedFieldsByColumnHeaderState } from '@/spreadsheet-import/steps/components/MatchColumnsStep/components/states/suggestedFieldsByColumnHeaderState';
import { type ImportedRow } from '@/spreadsheet-import/types';
import { type SpreadsheetColumns } from '@/spreadsheet-import/types/SpreadsheetColumns';
import { SpreadsheetColumnType } from '@/spreadsheet-import/types/SpreadsheetColumnType';
import { getMatchedColumnsWithFuse } from '@/spreadsheet-import/utils/getMatchedColumnsWithFuse';
import { setColumn } from '@/spreadsheet-import/utils/setColumn';
import { useRecoilCallback } from 'recoil';

import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

// call the AI endpoint to map unmatched CSV columns to target fields
const fetchAiMappings = async (
  unmatchedHeaders: string[],
  sampleRows: ImportedRow[],
  fields: { key: string; label: string }[],
): Promise<Record<string, string> | null> => {
  try {
    const response = await authenticatedFetch(
      `${REACT_APP_SERVER_BASE_URL}/api/v1/csv-mapping/analyze`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headers: unmatchedHeaders,
          sampleRows: sampleRows.slice(0, 5).map((row) =>
            unmatchedHeaders.map((_, i) => {
              const originalIndex = row[i];

              return typeof originalIndex === 'string'
                ? originalIndex
                : String(originalIndex ?? '');
            }),
          ),
          targetFields: fields.map((f) => ({ key: f.key, label: f.label })),
        }),
      },
    );

    const isSuccess = response.status < 300;

    if (!isSuccess) return null;

    const data = (await response.json()) as {
      mappings?: Record<string, string>;
    };

    return data.mappings ?? null;
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
      async ({
        headerValues,
        data,
      }: {
        headerValues: ImportedRow;
        data: ImportedRow[];
      }) => {
        if (autoMapHeaders) {
          const columns = snapshot
            .getLoadable(initialComputedColumnsSelector(headerValues))
            .getValue();

          const { matchedColumns, suggestedFieldsByColumnHeader } =
            getMatchedColumnsWithFuse({ columns, fields, data });

          // find columns Fuse left unmatched
          const unmatchedIndices: number[] = [];

          for (let i = 0; i < matchedColumns.length; i++) {
            if (matchedColumns[i].type === SpreadsheetColumnType.empty) {
              unmatchedIndices.push(i);
            }
          }

          // if there are unmatched columns, ask the AI
          if (unmatchedIndices.length > 0) {
            const unmatchedHeaders = unmatchedIndices.map(
              (i) => matchedColumns[i].header,
            );

            // build sample rows using only unmatched column indices
            const sampleRows = data.slice(0, 5).map((row) =>
              unmatchedIndices.map((colIdx) => {
                const val = row[colIdx];

                return typeof val === 'string' ? val : String(val ?? '');
              }),
            );

            // only offer fields that Fuse hasn't already matched
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
                .filter(Boolean),
            );

            const availableFields = fields
              .filter((f) => !usedFieldKeys.has(f.key))
              .map((f) => ({ key: f.key, label: f.label }));

            const aiMappings = await fetchAiMappings(
              unmatchedHeaders,
              sampleRows as ImportedRow[],
              availableFields,
            );

            if (aiMappings) {
              applyAiMappings(
                matchedColumns,
                unmatchedIndices,
                aiMappings,
                fields,
                data,
              );
            }
          }

          set(matchColumnsState, matchedColumns);
          set(
            suggestedFieldsByColumnHeaderState,
            suggestedFieldsByColumnHeader,
          );
        }
      },
    [autoMapHeaders, fields],
  );

  return computeColumnSuggestionsAndAutoMatch;
};

// mutate matchedColumns in place — apply AI mappings to unmatched columns
const applyAiMappings = (
  matchedColumns: SpreadsheetColumns,
  unmatchedIndices: number[],
  aiMappings: Record<string, string>,
  fields: readonly { key: string; label: string; fieldType: { type: string } }[],
  data: ImportedRow[],
) => {
  const usedByAi = new Set<string>();

  for (const colIdx of unmatchedIndices) {
    const header = matchedColumns[colIdx].header;
    const targetKey = aiMappings[header];

    if (!targetKey || targetKey === 'skip' || usedByAi.has(targetKey)) {
      continue;
    }

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
