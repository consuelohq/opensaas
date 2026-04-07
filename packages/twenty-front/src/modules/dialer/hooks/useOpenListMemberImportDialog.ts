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
import { t } from '@lingui/core/macro';
import { useSetRecoilState } from 'recoil';

// Opens the spreadsheet import dialog configured for person fields.
// On submit: upserts person records, then creates listMember records
// linking each person to the given list, copying phone numbers to both.
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

  const personAbortController = new AbortController();

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
      abortController: personAbortController,
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
          // Step 1: upsert person records
          const createdPersons = await batchCreatePersons({
            recordsToCreate: personInputs,
            upsert: true,
          });

          // Step 2: create listMember records linking each person to this list
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
          });

          // Step 3: evict caches so the UI refreshes
          await apolloCoreClient.refetchQueries({
            updateCache: (cache) => {
              cache.evict({ fieldName: 'people' });
              cache.evict({ fieldName: 'listMembers' });
            },
          });
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : t`Import failed`;
          enqueueErrorSnackBar({ message });
        }
      },
      spreadsheetImportFields,
      availableFieldMetadataItems,
      onAbortSubmit: () => {
        personAbortController.abort();
      },
      tableHook: spreadsheetImportGetUnicityTableHook(personMetadata),
    });
  };

  return { openListMemberImportDialog };
};
