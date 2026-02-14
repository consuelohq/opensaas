import { type AttachmentFileCategory } from '@/activities/files/types/AttachmentFileCategory';
import { FileIcon } from '@/file/components/FileIcon';
import { formatFileSize } from '@/file/utils/formatFileSize';
import { mimeToCategory } from '@/files/components/FileCard';
import { FileBrowser } from '@/files/components/FileBrowser';
import {
  type EntityType,
  useFileAttachments,
} from '@/files/hooks/useFileAttachments';
import { filePreviewState } from '@/files/states/filePreviewState';
import type { FileRecord } from '@/files/types/FileUpload';
import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { IconPaperclip, IconX } from 'twenty-ui/display';
import { Button, LightIconButton } from 'twenty-ui/input';
import { Modal } from '@/ui/layout/modal/components/Modal';
import { useModal } from '@/ui/layout/modal/hooks/useModal';

export type FileAttachmentsProps = {
  entityType: EntityType;
  entityId: string;
};

const PICKER_MODAL_ID = 'file-attachment-picker';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledHeader = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledTitle = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledCount = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
`;

const StyledFileRow = styled.div`
  align-items: center;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(1)} ${theme.spacing(2)}`};

  &:hover {
    background: ${({ theme }) => theme.background.transparent.lighter};
  }
`;

const StyledFileName = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  flex: 1;
  font-size: ${({ theme }) => theme.font.size.sm};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledFileMeta = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  flex-shrink: 0;
`;

const StyledRemove = styled.div`
  flex-shrink: 0;
  opacity: 0;

  ${StyledFileRow}:hover & {
    opacity: 1;
  }
`;

const StyledEmpty = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => `${theme.spacing(1)} ${theme.spacing(2)}`};
`;

const StyledPickerContent = styled.div`
  height: 60vh;
  overflow: hidden;
`;

export const FileAttachments = ({
  entityType,
  entityId,
}: FileAttachmentsProps) => {
  const { t } = useLingui();
  const { files, loading, attach, detach } = useFileAttachments(
    entityType,
    entityId,
  );
  const setPreviewFile = useSetRecoilState(filePreviewState);
  const { openModal, closeModal } = useModal();
  const [isAttaching, setIsAttaching] = useState(false);

  const handleFileClick = useCallback(
    (file: FileRecord) => {
      setPreviewFile(file);
    },
    [setPreviewFile],
  );

  const handleDetach = useCallback(
    (fileId: string, attachmentId: string) => (e: React.MouseEvent) => {
      e.stopPropagation();
      void detach(fileId, attachmentId);
    },
    [detach],
  );

  const handlePickerSelect = useCallback(
    async (file: FileRecord) => {
      setIsAttaching(true);
      try {
        await attach(file.id);
        closeModal(PICKER_MODAL_ID);
      } catch {
        // error handled in hook
      } finally {
        setIsAttaching(false);
      }
    },
    [attach, closeModal],
  );

  const handleOpenPicker = useCallback(() => {
    openModal(PICKER_MODAL_ID);
  }, [openModal]);

  if (loading) {
    return null;
  }

  return (
    <StyledContainer>
      <StyledHeader>
        <IconPaperclip size={16} />
        <StyledTitle>{t`Attached Files`}</StyledTitle>
        <StyledCount>({files.length})</StyledCount>
        <Button
          title={t`Attach`}
          variant="secondary"
          size="small"
          onClick={handleOpenPicker}
          disabled={isAttaching}
        />
      </StyledHeader>

      {files.length === 0 ? (
        <StyledEmpty>{t`No files attached`}</StyledEmpty>
      ) : (
        files.map((file) => (
          <StyledFileRow
            key={file.attachmentId}
            onClick={() => handleFileClick(file)}
          >
            <FileIcon
              fileCategory={
                mimeToCategory(file.mimeType) as AttachmentFileCategory
              }
              size="small"
            />
            <StyledFileName title={file.name}>{file.name}</StyledFileName>
            <StyledFileMeta>{formatFileSize(file.size)}</StyledFileMeta>
            <StyledRemove>
              <LightIconButton
                Icon={IconX}
                accent="tertiary"
                onClick={handleDetach(file.id, file.attachmentId)}
                aria-label={t`Remove attachment`}
              />
            </StyledRemove>
          </StyledFileRow>
        ))
      )}

      <Modal modalId={PICKER_MODAL_ID} size="large">
        <Modal.Header>{t`Select a file to attach`}</Modal.Header>
        <Modal.Content>
          <StyledPickerContent>
            <FileBrowser onFileClick={handlePickerSelect} />
          </StyledPickerContent>
        </Modal.Content>
      </Modal>
    </StyledContainer>
  );
};
