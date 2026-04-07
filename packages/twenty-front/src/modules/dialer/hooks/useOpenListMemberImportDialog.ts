import { t } from '@lingui/core/macro';
import { useRef } from 'react';
import { useSetRecoilState } from 'recoil';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useGenerateDepthRecordGqlFieldsFromObject } from '@/object-record/graphql/record-gql-fields/hooks/useGenerateDepthRecordGqlFieldsFromObject';
import { useBatchCreateManyRecords } from '@/object-record/hooks/useBatchCreateManyRecords';
import { useBuildSpreadsheetImportFields } from '@/object-record/spreadsheet-import/hooks/useBuildSpreadSheetImportFields';
import { buildRecordFromImportedStructuredRow } from '@/object-record/spreadsheet-import/utils/buildRecordFromImportedStructuredRow';
import { spreadsheetImportFilterAvailableFieldMetadataItems } from '@/object-record/spreadsheet-import/utils/spreadsheetImportFilterAvailableFieldMetadataItems';
import { spreadsheetImportGetUnicityTableHook } from '@/object-record/spreadsheet-import/utils/spreadsheetImportGetUnicityTableHook';
import { SPREADSHEET_IMPORT_CREATE_RECORDS_BATCH_SIZE } from '@/spreadsheet-import/constants/SpreadsheetImportCreateRecordsBatchSize';
import { useOpenSpreadsheetImportDialog } from '@/spreadsheet-import/hooks/useOpenSpreadsheetImportDialog';
import { spreadsheetImportCreatedRecordsProgressState } from '@/spreadsheet-import/states/spreadsheetImportCreatedRecordsProgressState';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

// Reuses twenty's spreadsheet import infrastructure but targets person fields,
// then creates listMember join records to populate a specific list.
export const useOpenListMemberImportDialog = (listId: string) => {
  const apolloCoreClient = useApolloCoreClient();
  const { openSpreadsheetImportDialog } = useOpenSpreadsheetImportDialog();
  const { buildSpreadsheetImportFields } = useBuildSpreadsheetImportFields();
  const { enqueueErrorSnackBar } = useSnackBar();

  const { objectMetadataItem: personMetadata } = useObjectMetadataItem({
    objectNameSingular: 'person',
  });

  const setCreatedRecordsProgress = useSetRecoilState(
    spreadsheetImportCreatedRecordsProgressState,
  );

  const abortControllerRef = useRef(new AbortController());

  const { recordGqlFields: personGqlFields } =
    useGenerateDepthRecordGqlFieldsFromObject({
      objectNameSingular: 'person',
      depth: 0,
    });

  const { batchCreateManyRecords: batchCreatePersons } =
    useBatchCreateManyRecords({
      objectNameSingular: 'person',
      recordGqlFields: personGqlFields,
      mutationBatchSize: SPREADSHEET_IMPORT_CREATE_RECORDS_BATCH_SIZE,
      setBatchedRecordsCount: setCreatedRecordsProgress,
      abortController: abortControllerRef.current,
    });

  const { recordGqlFields: listMemberGqlFields } =
    useGenerateDepthRecordGqlFieldsFromObject({
      objectNameSingular: 'listMember',
      depth: 0,
    });

  const { batchCreateManyRecords: batchCreateListMembers } =
    useBatchCreateManyRecords({
      objectNameSingular: 'listMember',
      recordGqlFields: listMemberGqlFields,
      mutationBatchSize: SPREADSHEET_IMPORT_CREATE_RECORDS_BATCH_SIZE,
    });

  const openListMemberImportDialog = () => {
    // Reset so prior abort doesn't poison this invocation
    abortControllerRef.current = new AbortController();

    const availableFieldMetadataItems =
      spreadsheetImportFilterAvailableFieldMetadataItems(
        personMetadata.updatableFields,
      );

    const spreadsheetImportFields = buildSpreadsheetImportFields(
      availableFieldMetadataItems,
    );

    openSpreadsheetImportDialog({
      onSubmit: async (data) => {
        const personInputs = data.validStructuredRows.map((row) =>
          buildRecordFromImportedStructuredRow({
            importedStructuredRow: row,
            fieldMetadataItems: availableFieldMetadataItems,
            spreadsheetImportFields,
          }),
        );

        try {
          const createdPersons = await batchCreatePersons({
            recordsToCreate: personInputs,
            upsert: true,
          });

          // Guard: if person creation was aborted, don't create orphan memberships
          if (abortControllerRef.current.signal.aborted) {
            return;
          }

          // phoneNumber is the structured PHONES composite type — same format on both entities
          const listMemberInputs = createdPersons.map(
            (person: { id: string; phones?: unknown }) => ({
              listId,
              personId: person.id,
              phoneNumber: person.phones ?? null,
              status: 'PENDING',
            }),
          );

          await batchCreateListMembers({
            recordsToCreate: listMemberInputs,
            upsert: true,
          });

          await apolloCoreClient.refetchQueries({
            updateCache: (cache) => {
              cache.evict({ fieldName: 'people' });
              cache.evict({ fieldName: 'listMembers' });
            },
          });
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : t`Import failed`;
          enqueueErrorSnackBar({ message });
        }
      },
      spreadsheetImportFields,
      availableFieldMetadataItems,
      onAbortSubmit: () => {
        abortControllerRef.current.abort();
      },
      tableHook: spreadsheetImportGetUnicityTableHook(personMetadata),
    });
  };

  return { openListMemberImportDialog };
};
