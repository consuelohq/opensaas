import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

import { useFileUploadToStorage } from '@/files/hooks/useFileUploadToStorage';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  type FileDropZoneProps,
} from '@/files/types/FileUpload';
import { formatFileSize } from '@/file/utils/formatFileSize';
import { IconUpload, IconX, IconCheck, IconAlertCircle } from 'twenty-ui/display';
import { isDefined } from 'twenty-shared/utils';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  width: 100%;
`;

const StyledDropArea = styled.div<{ isDragActive: boolean }>`
  align-items: center;
  background: ${({ theme, isDragActive }) =>
    isDragActive ? theme.background.transparent.light : theme.background.secondary};
  border: 2px dashed
    ${({ theme, isDragActive }) =>
      isDragActive ? theme.color.blue : theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: center;
  min-height: 160px;
  padding: ${({ theme }) => theme.spacing(6)};
  transition:
    background 150ms ease,
    border-color 150ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledDropText = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  text-align: center;
`;

const StyledDropSubText = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  text-align: center;
`;

const StyledUploadList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledUploadRow = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(3)}`};
`;

const StyledFileName = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  flex: 1;
  font-size: ${({ theme }) => theme.font.size.sm};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledFileSize = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  white-space: nowrap;
`;

const StyledProgressBarContainer = styled.div`
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: 2px;
  height: 4px;
  overflow: hidden;
  width: 80px;
`;

const StyledProgressBarFill = styled.div<{ progress: number; hasError: boolean }>`
  background: ${({ theme, hasError }) =>
    hasError ? theme.color.red : theme.color.blue};
  border-radius: 2px;
  height: 100%;
  transition: width 150ms ease;
  width: ${({ progress }) => progress}%;
`;

const StyledStatusIcon = styled.div<{ color: string }>`
  align-items: center;
  color: ${({ color }) => color};
  display: flex;
  flex-shrink: 0;
`;

const StyledRemoveButton = styled.button`
  align-items: center;
  background: none;
  border: none;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  display: flex;
  flex-shrink: 0;
  padding: 0;

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

export const FileDropZone = ({
  folder,
  tags,
  onUploadComplete,
  onUploadError,
  accept,
  maxFiles,
}: FileDropZoneProps) => {
  const { t } = useLingui();
  const theme = useTheme();
  const { uploads, uploadFiles, removeUpload, clearCompleted } =
    useFileUploadToStorage();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const records = await uploadFiles(acceptedFiles, { folder, tags });
      for (const record of records) {
        onUploadComplete?.(record);
      }
    },
    [uploadFiles, folder, tags, onUploadComplete],
  );

  const acceptMap = accept
    ? Object.fromEntries(accept.split(',').map((type) => [type.trim(), []]))
    : Object.fromEntries(
        Array.from(ALLOWED_MIME_TYPES).map((type) => [type, []]),
      );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptMap,
    maxSize: MAX_FILE_SIZE,
    maxFiles,
    onDropRejected: (rejections) => {
      for (const rejection of rejections) {
        const errorMessage = rejection.errors
          .map((e) => e.message)
          .join(', ');
        onUploadError?.(rejection.file.name, errorMessage);
      }
    },
  });

  const activeUploads = uploads.filter(
    (u) => u.status === 'uploading' || u.status === 'pending',
  );
  const hasCompleted = uploads.some((u) => u.status === 'complete');

  return (
    <StyledContainer>
      <StyledDropArea
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...getRootProps()}
        isDragActive={isDragActive}
      >
        <input
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...getInputProps()}
        />
        <IconUpload
          size={theme.icon.size.lg}
          stroke={theme.icon.stroke.sm}
          color={
            isDragActive
              ? theme.color.blue
              : theme.font.color.tertiary
          }
        />
        <StyledDropText>
          {isDragActive
            ? t`Drop files here`
            : t`Drag files here or click to browse`}
        </StyledDropText>
        <StyledDropSubText>
          {t`Max ${formatFileSize(MAX_FILE_SIZE)} per file`}
        </StyledDropSubText>
      </StyledDropArea>

      {uploads.length > 0 && (
        <StyledUploadList>
          {uploads.map((upload) => (
            <StyledUploadRow key={upload.id}>
              <StyledFileName>{upload.name}</StyledFileName>
              <StyledFileSize>{formatFileSize(upload.size)}</StyledFileSize>

              {(upload.status === 'uploading' ||
                upload.status === 'pending') && (
                <StyledProgressBarContainer>
                  <StyledProgressBarFill
                    progress={upload.progress}
                    hasError={false}
                  />
                </StyledProgressBarContainer>
              )}

              {upload.status === 'complete' && (
                <StyledStatusIcon color={theme.color.green}>
                  <IconCheck
                    size={theme.icon.size.sm}
                    stroke={theme.icon.stroke.md}
                  />
                </StyledStatusIcon>
              )}

              {upload.status === 'error' && (
                <StyledStatusIcon color={theme.color.red}>
                  <IconAlertCircle
                    size={theme.icon.size.sm}
                    stroke={theme.icon.stroke.md}
                  />
                </StyledStatusIcon>
              )}

              {(upload.status === 'complete' ||
                upload.status === 'error') && (
                <StyledRemoveButton
                  onClick={(event) => {
                    event.stopPropagation();
                    removeUpload(upload.id);
                  }}
                  aria-label={t`Remove ${upload.name}`}
                >
                  <IconX
                    size={theme.icon.size.sm}
                    stroke={theme.icon.stroke.sm}
                  />
                </StyledRemoveButton>
              )}
            </StyledUploadRow>
          ))}
        </StyledUploadList>
      )}

      {hasCompleted && isDefined(activeUploads) && activeUploads.length === 0 && (
        <StyledRemoveButton
          onClick={clearCompleted}
          style={{ alignSelf: 'flex-end' }}
        >
          <StyledDropSubText>{t`Clear completed`}</StyledDropSubText>
        </StyledRemoveButton>
      )}
    </StyledContainer>
  );
};
