import { DocumentViewer } from '@/activities/files/components/DocumentViewer';
import { type PageLayoutWidget } from '@/page-layout/types/PageLayoutWidget';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';
import styled from '@emotion/styled';
import { Trans } from '@lingui/react/macro';
import { useRecoilValue } from 'recoil';
import { recordStoreFamilySelector } from '@/object-record/record-store/states/selectors/recordStoreFamilySelector';
import { isDefined } from 'twenty-shared/utils';

const REACT_APP_SERVER_BASE_URL =
  window._env_?.REACT_APP_SERVER_BASE_URL ??
  process.env.REACT_APP_SERVER_BASE_URL ??
  '';

const StyledContainer = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const StyledEmptyState = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.md};
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(8)};
`;

type FilePreviewWidgetProps = {
  widget: PageLayoutWidget;
};

export const FilePreviewWidget = ({
  widget: _widget,
}: FilePreviewWidgetProps) => {
  const targetRecord = useTargetRecord();

  const fileField = useRecoilValue(
    recordStoreFamilySelector({
      recordId: targetRecord.id,
      fieldName: 'file',
    }),
  );

  const nameField = useRecoilValue(
    recordStoreFamilySelector({
      recordId: targetRecord.id,
      fieldName: 'name',
    }),
  );

  const files = Array.isArray(fileField) ? fileField : [];
  const firstFile = files[0];

  if (!isDefined(firstFile) || !isDefined(firstFile.fileId)) {
    return (
      <StyledContainer>
        <StyledEmptyState>
          <Trans>No file uploaded yet</Trans>
        </StyledEmptyState>
      </StyledContainer>
    );
  }

  const documentName =
    (typeof nameField === 'string' ? nameField : '') ||
    firstFile.fileName ||
    'Untitled';
  const documentUrl = `${REACT_APP_SERVER_BASE_URL}/v1/files/${firstFile.fileId}`;
  const documentExtension = firstFile.extension ?? undefined;

  return (
    <StyledContainer>
      <DocumentViewer
        documentName={documentName}
        documentUrl={documentUrl}
        documentExtension={documentExtension}
      />
    </StyledContainer>
  );
};
