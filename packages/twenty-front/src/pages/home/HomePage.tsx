import { t } from '@lingui/core/macro';
import { IconSparkles, IconUpload } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';

import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { DialerHomePageContent } from '@/dialer/components/DialerHomePageContent';
import { MainContainerLayoutWithCommandMenu } from '@/object-record/components/MainContainerLayoutWithCommandMenu';
import { useOpenObjectRecordsSpreadsheetImportDialog } from '@/object-record/spreadsheet-import/hooks/useOpenObjectRecordsSpreadsheetImportDialog';
import { SpreadsheetImportProvider } from '@/spreadsheet-import/provider/components/SpreadsheetImportProvider';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';

import { FeatureFlagKey } from '~/generated-metadata/graphql';

export const HomePage = () => {
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const isAiEnabled = useIsFeatureEnabled(FeatureFlagKey.IS_AI_ENABLED);
  const { openObjectRecordsSpreadsheetImportDialog } =
    useOpenObjectRecordsSpreadsheetImportDialog('person');

  return (
    <PageContainer>
      <PageHeader title={t`Home`}>
        <Button
          title={t`Import CSV`}
          variant="secondary"
          Icon={IconUpload}
          onClick={() => openObjectRecordsSpreadsheetImportDialog()}
        />
        {isAiEnabled && (
          <Button
            title={t`Ask AI`}
            variant="secondary"
            Icon={IconSparkles}
            onClick={() => openAskAIPage({ resetNavigationStack: false })}
          />
        )}
      </PageHeader>
      <MainContainerLayoutWithCommandMenu>
        <SpreadsheetImportProvider>
          <DialerHomePageContent />
        </SpreadsheetImportProvider>
      </MainContainerLayoutWithCommandMenu>
    </PageContainer>
  );
};
