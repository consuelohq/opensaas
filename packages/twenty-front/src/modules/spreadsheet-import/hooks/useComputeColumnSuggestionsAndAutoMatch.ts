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

type AiMappingResponse = {
  headerRowIndex?: number;
  mappings?: Record<string, string>;
};

const fetchAiMappings = async (
  rawRows: string[][],
  targetFields: { key: string; label: string }[],
): Promise<AiMappingResponse | null> => {
  try {
    const response = await authenticatedFetch(
      `/api/v1/csv-mapping/analyze`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawRows, targetFields }),
      },
    );

    if (response.status >= 300) return null;

    return (await response.json()) as AiMappingResponse;
  } catch {
    return null;
  }
};

export type AiHeaderResult = {
  headerRowIndex: number;
  mappings: Record<string, string>;
} | null;

export const useComputeColumnSuggestionsAndAutoMatch = () => {
  const { spreadsheetImportFields: fields, autoMapHeaders } =
    useSpreadsheetImportInternal();

  const computeColumnSuggestionsAndAutoMatch = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({
        headerValues,
        data,
        rawRows,
      }: {
        headerValues: ImportedRow;
        data: ImportedRow[];
        rawRows?: ImportedRow[];
      }): Promise<AiHeaderResult> => {
        if (!autoMapHeaders) return null;

        // send raw rows to AI for header detection + mapping
        const rowsForAi = (rawRows ?? [headerValues, ...data])
          .slice(0, 10)
          .map((row) =>
            (Array.isArray(row) ? row : [row]).map((cell) =>
              typeof cell === 'string' ? cell : String(cell ?? ''),
            ),
          );

        const targetFields = fields.map((f) => ({
          key: f.key,
          label: f.label,
        }));

        const aiResult = await fetchAiMappings(rowsForAi, targetFields);

        // if AI detected a different header row, recalculate headerValues and data
        let effectiveHeaderValues = headerValues;
        let effectiveData = data;
        let headerRowIndex = 0;

        if (
          aiResult?.headerRowIndex !== undefined &&
          aiResult.headerRowIndex > 0 &&
          rawRows
        ) {
          headerRowIndex = aiResult.headerRowIndex;
          effectiveHeaderValues = rawRows[headerRowIndex];
          effectiveData = rawRows.slice(headerRowIndex + 1);
        }

        const columns = snapshot
          .getLoadable(
            initialComputedColumnsSelector(effectiveHeaderValues),
          )
          .getValue();

        let matchedColumns: SpreadsheetColumns;
        let suggestedFieldsByColumnHeader: Record<
          string,
          SpreadsheetImportField[]
        >;

        if (aiResult?.mappings) {
          matchedColumns = [...columns] as SpreadsheetColumns;
          suggestedFieldsByColumnHeader = {};
          const usedKeys = new Set<string>();

          for (let i = 0; i < matchedColumns.length; i++) {
            const targetKey = aiResult.mappings[String(i)];

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
              effectiveData,
            );
          }

          // for unmatched columns, get Fuse suggestions
          if (
            matchedColumns.some(
              (c) => c.type === SpreadsheetColumnType.empty,
            )
          ) {
            const fuseResult = getMatchedColumnsWithFuse({
              columns,
              fields,
              data: effectiveData,
            });

            suggestedFieldsByColumnHeader =
              fuseResult.suggestedFieldsByColumnHeader;
          }
        } else {
          // AI failed — fall back to Fuse-only
          const fuseResult = getMatchedColumnsWithFuse({
            columns,
            fields,
            data: effectiveData,
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

        // return header info so the caller can update step state
        if (aiResult?.headerRowIndex !== undefined && aiResult.mappings) {
          return {
            headerRowIndex,
            mappings: aiResult.mappings,
          };
        }

        return null;
      },
    [autoMapHeaders, fields],
  );

  return computeColumnSuggestionsAndAutoMatch;
};
