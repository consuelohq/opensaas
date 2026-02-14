import { downloadFile } from '@/activities/files/utils/downloadFile';
import { filePreviewState } from '@/files/states/filePreviewState';
import { Modal } from '@/ui/layout/modal/components/Modal';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ScrollWrapper } from '@/ui/utilities/scroll/components/ScrollWrapper';
import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { isDefined } from 'twenty-shared/utils';
import { IconDownload, IconX } from 'twenty-ui/display';
import { Button, IconButton } from 'twenty-ui/input';

const DocumentViewer = lazy(() =>
  import('@/activities/files/components/DocumentViewer').then((module) => ({
    default: module.DocumentViewer,
  })),
);

const FILE_PREVIEW_MODAL_ID = 'file-preview-modal';

const REACT_APP_SERVER_BASE_URL =
  window._env_?.REACT_APP_SERVER_BASE_URL ??
  process.env.REACT_APP_SERVER_BASE_URL ??
  '';

const StyledHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  height: 60px;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(0, 4)};
`;

const StyledTitle = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledButtons = styled.div`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledContent = styled.div`
  height: 100%;
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledLoadingContainer = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  height: 100%;
  justify-content: center;
`;

const StyledUnavailable = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  height: 100%;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(8)};
  text-align: center;
`;

const StyledUnavailableText = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.lg};
`;

type DownloadUrlResponse = {
  downloadUrl: string;
};

export const FilePreview = () => {
  const { t } = useLingui();
  const [file, setFile] = useRecoilState(filePreviewState);
  const { openModal, closeModal } = useModal();
  const { enqueueSnackBar } = useSnackBar();
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!isDefined(file)) {
      return;
    }

    openModal(FILE_PREVIEW_MODAL_ID);
    setDownloadUrl(null);
    setUnavailable(false);
    setLoading(true);

    const controller = new AbortController();

    fetch(`${REACT_APP_SERVER_BASE_URL}/v1/files/${file.id}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((response) => {
        if (response.status === 501) {
          setUnavailable(true);
          return null;
        }
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status}`);
        }
        return response.json() as Promise<DownloadUrlResponse>;
      })
      .then((data) => {
        if (isDefined(data)) {
          setDownloadUrl(data.downloadUrl);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setUnavailable(true);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [file, openModal, enqueueSnackBar]);

  const handleClose = useCallback(() => {
    closeModal(FILE_PREVIEW_MODAL_ID);
    setFile(null);
    setDownloadUrl(null);
  }, [closeModal, setFile]);

  const handleDownload = useCallback(() => {
    if (!isDefined(downloadUrl) || !isDefined(file)) {
      return;
    }
    downloadFile(downloadUrl, file.name);
  }, [downloadUrl, file]);

  if (!isDefined(file)) {
    return null;
  }

  const extension = file.name.includes('.')
    ? file.name.split('.').pop() ?? ''
    : '';

  return (
    <Modal
      modalId={FILE_PREVIEW_MODAL_ID}
      size="large"
      isClosable
      onClose={handleClose}
      ignoreContainer
    >
      <StyledHeader>
        <StyledTitle>{file.name}</StyledTitle>
        <StyledButtons>
          {isDefined(downloadUrl) && (
            <IconButton
              Icon={IconDownload}
              onClick={handleDownload}
              size="small"
            />
          )}
          <IconButton Icon={IconX} onClick={handleClose} size="small" />
        </StyledButtons>
      </StyledHeader>
      <ScrollWrapper
        componentInstanceId={`file-preview-${file.id}`}
      >
        <StyledContent>
          {loading && (
            <StyledLoadingContainer>
              {t`Loading preview...`}
            </StyledLoadingContainer>
          )}
          {unavailable && (
            <StyledUnavailable>
              <StyledUnavailableText>
                {t`File preview is not available yet. The download service is being set up.`}
              </StyledUnavailableText>
              <Button
                title={t`Close`}
                onClick={handleClose}
                variant="secondary"
              />
            </StyledUnavailable>
          )}
          {isDefined(downloadUrl) && (
            <Suspense
              fallback={
                <StyledLoadingContainer>
                  {t`Loading document viewer...`}
                </StyledLoadingContainer>
              }
            >
              <DocumentViewer
                documentName={file.name}
                documentUrl={downloadUrl}
                documentExtension={extension}
              />
            </Suspense>
          )}
        </StyledContent>
      </ScrollWrapper>
    </Modal>
  );
};
