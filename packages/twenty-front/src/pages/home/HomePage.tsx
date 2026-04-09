import { t } from '@lingui/core/macro';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
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

  const [pendingListId, setPendingListId] = useState<string | null>(null);

  const { createOneRecord: createOpportunity } = useCreateOneRecord({
    objectNameSingular: 'opportunity',
  });

  const { updateOneRecord } = useUpdateOneRecord();

  // We need a ref to hold the latest listId for the import dialog callback
  const pendingListIdRef = useRef<string | null>(null);

  // This hook is called with '' initially — we update it when we have a real listId
  // But hooks can't be called conditionally, so we always create it
  const { openListMemberImportDialog } = useOpenListMemberImportDialog(
    pendingListId ?? '',
  );

  const handleImportCSV = useCallback(async () => {
    const now = new Date();
    const defaultName = `Import ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    const listName = window.prompt(t`Name your list`, defaultName);

    if (!listName) {
      return;
    }

    try {
      const newList = await createOpportunity({ name: listName });

      if (!newList?.id) {
        return;
      }

      pendingListIdRef.current = newList.id;
      setPendingListId(newList.id);
    } catch {
      // createOpportunity handles its own errors
    }
  }, [createOpportunity]);

  // When pendingListId is set and the hook is ready, open the import dialog
  useEffect(() => {
    if (pendingListId) {
      openListMemberImportDialog();
      setPendingListId(null);
      setImportedListId(pendingListId);
    }
  }, [pendingListId, openListMemberImportDialog, setImportedListId]);

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
