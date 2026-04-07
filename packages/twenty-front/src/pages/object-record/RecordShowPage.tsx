import { useParams } from 'react-router-dom';

import { RecordShowActionMenu } from '@/action-menu/components/RecordShowActionMenu';
import { ActionMenuComponentInstanceContext } from '@/action-menu/states/contexts/ActionMenuComponentInstanceContext';
import { TimelineActivityContext } from '@/activities/timeline-activities/contexts/TimelineActivityContext';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { MAIN_CONTEXT_STORE_INSTANCE_ID } from '@/context-store/constants/MainContextStoreInstanceId';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { MainContainerLayoutWithCommandMenu } from '@/object-record/components/MainContainerLayoutWithCommandMenu';
import { RecordComponentInstanceContextsWrapper } from '@/object-record/components/RecordComponentInstanceContextsWrapper';
import { PageLayoutRecordPageRenderer } from '@/object-record/record-show/components/PageLayoutRecordPageRenderer';
import { RecordShowPageSSESubscribeEffect } from '@/object-record/record-show/components/RecordShowPageSSESubscribeEffect';
import { useRecordShowPage } from '@/object-record/record-show/hooks/useRecordShowPage';
import { computeRecordShowComponentInstanceId } from '@/object-record/record-show/utils/computeRecordShowComponentInstanceId';
import { PageHeaderToggleCommandMenuButton } from '@/ui/layout/page-header/components/PageHeaderToggleCommandMenuButton';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { t } from '@lingui/core/macro';
import { FeatureFlagKey } from '~/generated-metadata/graphql';
import { IconSparkles } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { SpreadsheetImportProvider } from '@/spreadsheet-import/provider/components/SpreadsheetImportProvider';
import { RecordShowPageHeader } from '~/pages/object-record/RecordShowPageHeader';
import { RecordShowPageTitle } from '~/pages/object-record/RecordShowPageTitle';

export const RecordShowPage = () => {
  const parameters = useParams<{
    objectNameSingular: string;
    objectRecordId: string;
  }>();

  const { objectNameSingular, objectRecordId } = useRecordShowPage(
    parameters.objectNameSingular ?? '',
    parameters.objectRecordId ?? '',
  );
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const isAiEnabled = useIsFeatureEnabled(FeatureFlagKey.IS_AI_ENABLED);

  const recordShowComponentInstanceId =
    computeRecordShowComponentInstanceId(objectRecordId);

  return (
    <RecordComponentInstanceContextsWrapper
      componentInstanceId={recordShowComponentInstanceId}
    >
      <ContextStoreComponentInstanceContext.Provider
        value={{ instanceId: MAIN_CONTEXT_STORE_INSTANCE_ID }}
      >
        <ActionMenuComponentInstanceContext.Provider
          value={{ instanceId: recordShowComponentInstanceId }}
        >
          <PageContainer>
            <RecordShowPageTitle
              objectNameSingular={objectNameSingular}
              objectRecordId={objectRecordId}
            />
            <RecordShowPageHeader
              objectNameSingular={objectNameSingular}
              objectRecordId={objectRecordId}
            >
              {isAiEnabled &&
                objectNameSingular === CoreObjectNameSingular.Opportunity && (
                  <Button
                    title={t`Ask AI`}
                    variant="secondary"
                    Icon={IconSparkles}
                    onClick={() =>
                      openAskAIPage({ resetNavigationStack: false })
                    }
                  />
                )}
              <RecordShowActionMenu />
              <PageHeaderToggleCommandMenuButton />
            </RecordShowPageHeader>
            <MainContainerLayoutWithCommandMenu>
              <SpreadsheetImportProvider>
                <TimelineActivityContext.Provider
                  value={{
                    recordId: objectRecordId,
                  }}
                >
                  <PageLayoutRecordPageRenderer
                    targetRecordIdentifier={{
                      id: objectRecordId,
                      targetObjectNameSingular: objectNameSingular,
                    }}
                    isInRightDrawer={false}
                  />
                  <RecordShowPageSSESubscribeEffect
                    objectNameSingular={objectNameSingular}
                    recordId={objectRecordId}
                  />
                </TimelineActivityContext.Provider>
              </SpreadsheetImportProvider>
            </MainContainerLayoutWithCommandMenu>
          </PageContainer>
        </ActionMenuComponentInstanceContext.Provider>
      </ContextStoreComponentInstanceContext.Provider>
    </RecordComponentInstanceContextsWrapper>
  );
};
