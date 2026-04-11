import { useSpreadsheetImportInternal } from '@/spreadsheet-import/hooks/useSpreadsheetImportInternal';
import {
  initialComputedColumnsSelector,
  matchColumnsState,
} from '@/spreadsheet-import/steps/components/MatchColumnsStep/components/states/initialComputedColumnsState';
import { suggestedFieldsByColumnHeaderState } from '@/spreadsheet-import/steps/components/MatchColumnsStep/components/states/suggestedFieldsByColumnHeaderState';
import {
  type ImportedRow,
  type SpreadsheetImportField,
} from '@/spreadsheet-import/types';
import { type SpreadsheetColumns } from '@/spreadsheet-import/types/SpreadsheetColumns';
import { SpreadsheetColumnType } from '@/spreadsheet-import/types/SpreadsheetColumnType';
import { getMatchedColumnsWithFuse } from '@/spreadsheet-import/utils/getMatchedColumnsWithFuse';
import { setColumn } from '@/spreadsheet-import/utils/setColumn';
import { useRecoilCallback } from 'recoil';

import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';

const fetchAiMappings = async (
  headers: string[],
  sampleRows: string[][],
  targetFields: { key: string; label: string }[],
): Promise<Record<string, string> | null> => {
  try {
    const response = await authenticatedFetch(
      `/api/v1/csv-mapping/analyze`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columns: headers.map((h, i) => ({ index: i, header: h })),
          sampleRows,
          targetFields,
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

          // try AI first — it handles messy headers better than fuzzy matching
          const headers = columns.map((c) => c.header);
          const sampleRows = data.slice(0, 5).map((row) =>
            headers.map((_, i) => {
              const val = row[i];

              return typeof val === 'string' ? val : String(val ?? '');
            }),
          );
          const targetFields = fields.map((f) => ({
            key: f.key,
            label: f.label,
          }));

          const aiMappings = await fetchAiMappings(
            headers,
            sampleRows,
            targetFields,
          );

          let matchedColumns: SpreadsheetColumns;
          let suggestedFieldsByColumnHeader: Record<
            string,
            SpreadsheetImportField[]
          >;

          if (aiMappings) {
            // AI succeeded — apply its mappings directly to the initial columns
            matchedColumns = [...columns] as SpreadsheetColumns;
            suggestedFieldsByColumnHeader = {} as Record<
              string,
              SpreadsheetImportField[]
            >;
            const usedKeys = new Set<string>();

            for (let i = 0; i < matchedColumns.length; i++) {
              const targetKey = aiMappings[String(i)];

              if (
                !targetKey ||
                targetKey === 'skip' ||
                usedKeys.has(targetKey)
              ) {
                continue;
              }

              const field = fields.find((f) => f.key === targetKey);

              if (!field) continue;

              usedKeys.add(targetKey);
              matchedColumns[i] = setColumn(
                matchedColumns[i],
                field as Parameters<typeof setColumn>[1],
                data,
              );
            }

            // for any columns AI left unmatched, run Fuse to get suggestions
            const unmatchedExist = matchedColumns.some(
              (c) => c.type === SpreadsheetColumnType.empty,
            );

            if (unmatchedExist) {
              const fuseResult = getMatchedColumnsWithFuse({
                columns,
                fields,
                data,
              });

              suggestedFieldsByColumnHeader =
                fuseResult.suggestedFieldsByColumnHeader;
            }
          } else {
            // AI failed — fall back to Fuse-only (current behavior)
            const fuseResult = getMatchedColumnsWithFuse({
              columns,
              fields,
              data,
            });

            matchedColumns = fuseResult.matchedColumns;
            suggestedFieldsByColumnHeader =
              fuseResult.suggestedFieldsByColumnHeader;
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
