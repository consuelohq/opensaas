import { captureException } from '@sentry/react';
import { t } from '@lingui/core/macro';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { IconSparkles, IconUpload, IconX } from 'twenty-ui/display';
import { Button, LightIconButton } from 'twenty-ui/input';
import { useDebounce } from 'use-debounce';

import { useCommandMenu } from '@/command-menu/hooks/useCommandMenu';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { isCommandMenuOpenedState } from '@/command-menu/states/isCommandMenuOpenedState';
import { contextStoreCurrentObjectMetadataItemIdComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemIdComponentState';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { DialerHomePageContent } from '@/dialer/components/DialerHomePageContent';
import { useOpenListMemberImportDialog } from '@/dialer/hooks/useOpenListMemberImportDialog';
import { importedListIdState } from '@/dialer/states/importedListIdState';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { MainContainerLayoutWithCommandMenu } from '@/object-record/components/MainContainerLayoutWithCommandMenu';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useLazyFindManyRecords } from '@/object-record/hooks/useLazyFindManyRecords';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { SpreadsheetImportProvider } from '@/spreadsheet-import/provider/components/SpreadsheetImportProvider';
import { TextInput } from '@/ui/input/components/TextInput';
import { Modal } from '@/ui/layout/modal/components/Modal';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { useSetRecoilComponentState } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentState';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';

import {
  StyledImportListNameModalContent,
  StyledImportListNameModalFooter,
  StyledImportListNameModalHeader,
  StyledImportListNameModalHeaderText,
  StyledImportListNameModalSubtitle,
  StyledImportListNameModalTitle,
} from './home-page.styles';

import { FeatureFlagKey } from '~/generated-metadata/graphql';

const IMPORT_CONTEXT_STORE_ID = 'home-import-context-store';
const HOME_IMPORT_CSV_LIST_NAME_MODAL_ID = 'home-import-csv-list-name-modal';
const IMPORT_LIST_NAME_VALIDATION_LIMIT = 1;
const IMPORT_LIST_NAME_VALIDATION_DEBOUNCE_MS = 300;
const DEFAULT_ACTIVE_LIST_NAME_LOOKUP_LIMIT = 1000;

type OpportunityRecord = ObjectRecord & {
  id: string;
  name?: string | null;
};

const normalizeListName = (name: string) => name.trim().toLocaleLowerCase();

const getActiveListNames = (opportunityRecords: OpportunityRecord[]) => {
  return new Set(
    opportunityRecords
      .map((record) => normalizeListName(record.name ?? ''))
      .filter(Boolean),
  );
};

const getDefaultImportListName = ({
  activeOpportunityRecords,
  historicalOpportunityCount,
}: {
  activeOpportunityRecords: OpportunityRecord[];
  historicalOpportunityCount?: number;
}) => {
  const activeListNames = getActiveListNames(activeOpportunityRecords);
  let nextListNumber =
    (historicalOpportunityCount ?? activeOpportunityRecords.length) + 1;
  let defaultName = t`List ${nextListNumber}`;

  while (activeListNames.has(normalizeListName(defaultName))) {
    nextListNumber += 1;
    defaultName = t`List ${nextListNumber}`;
  }

  return defaultName;
};

const HomeImportContextStoreEffect = () => {
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: 'person',
  });

  const setObjectMetadataItemId = useSetRecoilComponentState(
    contextStoreCurrentObjectMetadataItemIdComponentState,
    IMPORT_CONTEXT_STORE_ID,
  );

  useEffect(() => {
    setObjectMetadataItemId(objectMetadataItem.id);
  }, [objectMetadataItem.id, setObjectMetadataItemId]);

  return null;
};

export const HomePage = () => {
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const { closeCommandMenu } = useCommandMenu();
  const { closeModal, openModal } = useModal();
  const isCommandMenuOpened = useRecoilValue(isCommandMenuOpenedState);
  const isAiEnabled = useIsFeatureEnabled(FeatureFlagKey.IS_AI_ENABLED);
  const setImportedListId = useSetRecoilState(importedListIdState);
  const [importListName, setImportListName] = useState('');
  const [activeOpportunityRecords, setActiveOpportunityRecords] = useState<
    OpportunityRecord[]
  >([]);
  const [isCreatingImportList, setIsCreatingImportList] = useState(false);

  const { createOneRecord: createOpportunity } = useCreateOneRecord({
    objectNameSingular: 'opportunity',
  });

  const { findManyRecordsLazy: findManyActiveOpportunityRecords } =
    useLazyFindManyRecords<OpportunityRecord>({
      objectNameSingular: 'opportunity',
      recordGqlFields: { id: true, name: true },
      limit: DEFAULT_ACTIVE_LIST_NAME_LOOKUP_LIMIT,
    });

  const { totalCount: historicalOpportunityCount } =
    useFindManyRecords<OpportunityRecord>({
      objectNameSingular: 'opportunity',
      recordGqlFields: { id: true },
      limit: 1,
      withSoftDeleted: true,
    });

  const fetchActiveOpportunities = useCallback(async () => {
    const { records } = await findManyActiveOpportunityRecords();
    const fetchedActiveOpportunityRecords = records ?? [];

    setActiveOpportunityRecords(fetchedActiveOpportunityRecords);

    return fetchedActiveOpportunityRecords;
  }, [findManyActiveOpportunityRecords]);

  const defaultImportListName = useMemo(() => {
    return getDefaultImportListName({
      activeOpportunityRecords,
      historicalOpportunityCount,
    });
  }, [activeOpportunityRecords, historicalOpportunityCount]);

  const trimmedImportListName = importListName.trim();
  const [debouncedImportListName] = useDebounce(
    trimmedImportListName,
    IMPORT_LIST_NAME_VALIDATION_DEBOUNCE_MS,
  );
  const isListNameValidationPending =
    debouncedImportListName !== trimmedImportListName;

  const { records: duplicateOpportunityRecords, loading: isCheckingListName } =
    useFindManyRecords<OpportunityRecord>({
      objectNameSingular: 'opportunity',
      filter:
        debouncedImportListName.length > 0
          ? { name: { ilike: debouncedImportListName } }
          : undefined,
      recordGqlFields: { id: true, name: true },
      limit: IMPORT_LIST_NAME_VALIDATION_LIMIT,
      skip: debouncedImportListName.length === 0,
    });

  const isDuplicateListName = duplicateOpportunityRecords.some(
    (record) =>
      normalizeListName(record.name ?? '') ===
      normalizeListName(trimmedImportListName),
  );

  const importListNameError =
    isDuplicateListName && trimmedImportListName.length > 0
      ? t`A list with this name already exists`
      : undefined;

  const canCreateImportList =
    trimmedImportListName.length > 0 &&
    !isDuplicateListName &&
    !isCheckingListName &&
    !isListNameValidationPending &&
    !isCreatingImportList;

  const { openListMemberImportDialog } = useOpenListMemberImportDialog();

  const handleCloseImportCSVModal = useCallback(() => {
    closeModal(HOME_IMPORT_CSV_LIST_NAME_MODAL_ID);
    setImportListName('');
  }, [closeModal]);

  const handleOpenImportCSVModal = useCallback(async () => {
    const fetchedActiveOpportunityRecords = await fetchActiveOpportunities();

    setImportListName(
      getDefaultImportListName({
        activeOpportunityRecords: fetchedActiveOpportunityRecords,
        historicalOpportunityCount,
      }),
    );
    openModal(HOME_IMPORT_CSV_LIST_NAME_MODAL_ID);
  }, [fetchActiveOpportunities, historicalOpportunityCount, openModal]);

  const handleCreateImportList = useCallback(async () => {
    if (!canCreateImportList) {
      return;
    }

    setIsCreatingImportList(true);

    try {
      const newList = await createOpportunity({
        name: trimmedImportListName,
      });

      if (!newList?.id) {
        return;
      }

      closeModal(HOME_IMPORT_CSV_LIST_NAME_MODAL_ID);
      setImportListName('');
      setImportedListId(newList.id);
      openListMemberImportDialog(newList.id);
    } catch (error) {
      captureException(error, {
        extra: { context: 'HomePage:createOpportunity' },
      });
    } finally {
      setIsCreatingImportList(false);
    }
  }, [
    canCreateImportList,
    closeModal,
    createOpportunity,
    openListMemberImportDialog,
    setImportedListId,
    trimmedImportListName,
  ]);

  const handleAskAI = () => {
    if (isCommandMenuOpened) {
      closeCommandMenu();
    } else {
      openAskAIPage({ resetNavigationStack: false });
    }
  };

  return (
    <PageContainer>
      <PageHeader title={t`Home`}>
        <Button
          title={t`Import CSV`}
          variant="secondary"
          Icon={IconUpload}
          onClick={() => {
            void handleOpenImportCSVModal();
          }}
        />
        {isAiEnabled && (
          <Button
            title={t`Ask AI`}
            variant="secondary"
            Icon={IconSparkles}
            onClick={handleAskAI}
          />
        )}
      </PageHeader>
      <MainContainerLayoutWithCommandMenu>
        <ContextStoreComponentInstanceContext.Provider
          value={{ instanceId: IMPORT_CONTEXT_STORE_ID }}
        >
          <HomeImportContextStoreEffect />
          <SpreadsheetImportProvider>
            <DialerHomePageContent />
          </SpreadsheetImportProvider>
        </ContextStoreComponentInstanceContext.Provider>
      </MainContainerLayoutWithCommandMenu>
      <Modal
        modalId={HOME_IMPORT_CSV_LIST_NAME_MODAL_ID}
        isClosable={true}
        onClose={handleCloseImportCSVModal}
        onEnter={() => {
          void handleCreateImportList();
        }}
        size="medium"
        padding="none"
      >
        <StyledImportListNameModalContent>
          <StyledImportListNameModalHeader>
            <StyledImportListNameModalHeaderText>
              <StyledImportListNameModalTitle>
                {t`Name your list`}
              </StyledImportListNameModalTitle>
              <StyledImportListNameModalSubtitle>
                {t`Use the default list number or enter a custom name before importing your CSV.`}
              </StyledImportListNameModalSubtitle>
            </StyledImportListNameModalHeaderText>
            <LightIconButton
              Icon={IconX}
              accent="tertiary"
              size="small"
              onClick={handleCloseImportCSVModal}
              aria-label={t`Close`}
            />
          </StyledImportListNameModalHeader>

          <TextInput
            label={t`Import list name`}
            value={importListName}
            onChange={setImportListName}
            placeholder={defaultImportListName}
            error={importListNameError}
            fullWidth
            autoFocus
          />
        </StyledImportListNameModalContent>

        <StyledImportListNameModalFooter>
          <Button
            title={t`Cancel`}
            variant="secondary"
            onClick={handleCloseImportCSVModal}
          />
          <Button
            title={t`Continue`}
            variant="primary"
            onClick={() => {
              void handleCreateImportList();
            }}
            disabled={!canCreateImportList}
          />
        </StyledImportListNameModalFooter>
      </Modal>
    </PageContainer>
  );
};
