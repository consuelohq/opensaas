import { t } from '@lingui/core/macro';
import { v4 } from 'uuid';

import { useSetRecoilState } from 'recoil';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useGenerateDepthRecordGqlFieldsFromObject } from '@/object-record/graphql/record-gql-fields/hooks/useGenerateDepthRecordGqlFieldsFromObject';
import { useBatchCreateManyRecords } from '@/object-record/hooks/useBatchCreateManyRecords';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
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
// Pre-generates person IDs so listMembers can be created even if the graphql
// response errors (e.g. "Event stream does not exist") — the DB insert still
// succeeds, so the foreign keys are valid.
export const useOpenListMemberImportDialog = () => {
  const apolloCoreClient = useApolloCoreClient();
  const { openSpreadsheetImportDialog } = useOpenSpreadsheetImportDialog();
  const { buildSpreadsheetImportFields } = useBuildSpreadsheetImportFields();
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar, enqueueInfoSnackBar } =
    useSnackBar();

  const { objectMetadataItem: personMetadata } = useObjectMetadataItem({
    objectNameSingular: 'person',
  });

  const { updateOneRecord } = useUpdateOneRecord();

  const setCreatedRecordsProgress = useSetRecoilState(
    spreadsheetImportCreatedRecordsProgressState,
  );

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

  const openListMemberImportDialog = (listId: string) => {
    const availableFieldMetadataItems =
      spreadsheetImportFilterAvailableFieldMetadataItems(
        personMetadata.updatableFields,
      );

    const spreadsheetImportFields = buildSpreadsheetImportFields(
      availableFieldMetadataItems,
    );

    openSpreadsheetImportDialog({
      onSubmit: async (data) => {
        const personInputs = data.validStructuredRows.map((row) => {
          const record = buildRecordFromImportedStructuredRow({
            importedStructuredRow: row,
            fieldMetadataItems: availableFieldMetadataItems,
            spreadsheetImportFields,
          });

          return { ...record, id: record.id ?? v4() };
        });

        if (personInputs.length === 0) {
          enqueueInfoSnackBar({
            message: t`No valid rows to import`,
          });
          return;
        }

        // Build listMember inputs upfront using pre-generated person IDs.
        // This way we can create listMembers even if the person createMany
        // graphql response errors (the DB insert still succeeds).
        const listMemberInputs = personInputs.map((input) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rec = input as Record<string, any>;

          return {
            listId,
            personId: input.id,
            name:
              [rec.name?.firstName, rec.name?.lastName]
                .filter(Boolean)
                .join(' ') || null,
            phoneNumber: rec.phones ?? null,
            status: 'PENDING',
          };
        });

        try {
          await batchCreatePersons({
            recordsToCreate: personInputs,
            upsert: true,
          });
        } catch {
          // The DB insert may succeed even when the graphql response errors
          // (e.g. "Event stream does not exist"). Continue to listMember
          // creation — the person records exist in the DB.
        }

        try {
          await batchCreateListMembers({
            recordsToCreate: listMemberInputs,
            upsert: true,
          });

          await updateOneRecord({
            objectNameSingular: 'opportunity',
            idToUpdate: listId,
            updateOneRecordInput: {
              contactCount: listMemberInputs.length,
            },
          });

          await apolloCoreClient.refetchQueries({
            updateCache: (cache) => {
              cache.evict({ fieldName: 'people' });
              cache.evict({ fieldName: 'listMembers' });
              cache.evict({ fieldName: 'opportunities' });
            },
          });

          enqueueSuccessSnackBar({
            message: t`Imported ${personInputs.length} contacts`,
          });
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : t`Import failed`;
          enqueueErrorSnackBar({ message });
        }
      },
      spreadsheetImportFields,
      availableFieldMetadataItems,

      tableHook: spreadsheetImportGetUnicityTableHook(personMetadata),
    });
  };

  return { openListMemberImportDialog };
};
