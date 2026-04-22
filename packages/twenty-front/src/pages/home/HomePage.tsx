import { t } from '@lingui/core/macro';
import { useCallback, useEffect } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { IconSparkles, IconUpload } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';

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
import { useAggregateRecords } from '@/object-record/hooks/useAggregateRecords';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { AggregateOperations } from '@/object-record/record-table/constants/AggregateOperations';
import { SpreadsheetImportProvider } from '@/spreadsheet-import/provider/components/SpreadsheetImportProvider';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { useSetRecoilComponentState } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentState';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';

import { FeatureFlagKey } from '~/generated-metadata/graphql';

const IMPORT_CONTEXT_STORE_ID = 'home-import-context-store';

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
  const isCommandMenuOpened = useRecoilValue(isCommandMenuOpenedState);
  const isAiEnabled = useIsFeatureEnabled(FeatureFlagKey.IS_AI_ENABLED);
  const setImportedListId = useSetRecoilState(importedListIdState);

  const { createOneRecord: createOpportunity } = useCreateOneRecord({
    objectNameSingular: 'opportunity',
  });

  const { data: opportunityAggregateData } = useAggregateRecords<{
    id: { COUNT: number };
  }>({
    objectNameSingular: 'opportunity',
    recordGqlFieldsAggregate: {
      id: [AggregateOperations.COUNT],
    },
  });

  const opportunityCount = opportunityAggregateData?.id?.COUNT;

  const { openListMemberImportDialog } = useOpenListMemberImportDialog();

  const handleImportCSV = useCallback(async () => {
    const defaultName =
      opportunityCount === undefined ? t`List` : t`List ${opportunityCount + 1}`;
    const listName = window.prompt(t`Name your list`, defaultName);

    if (!listName) {
      return;
    }

    try {
      const newList = await createOpportunity({ name: listName });

      if (!newList?.id) {
        return;
      }

      setImportedListId(newList.id);
      openListMemberImportDialog(newList.id);
    } catch {
      // createOpportunity handles its own errors
    }
  }, [
    createOpportunity,
    opportunityCount,
    setImportedListId,
    openListMemberImportDialog,
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
          onClick={() => void handleImportCSV()}
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
    </PageContainer>
  );
};
