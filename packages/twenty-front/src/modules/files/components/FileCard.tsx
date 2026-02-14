import { type AttachmentFileCategory } from '@/activities/files/types/AttachmentFileCategory';
import { FileIcon } from '@/file/components/FileIcon';
import { formatFileSize } from '@/file/utils/formatFileSize';
import type { FileRecord } from '@/files/types/FileUpload';
import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { Checkbox, CheckboxShape, CheckboxSize } from 'twenty-ui/input';

import type { FileBrowserView } from '@/files/states/fileBrowserViewState';

export type FileCardProps = {
  file: FileRecord;
  view: FileBrowserView;
  selected: boolean;
  onSelect: (fileId: string) => void;
  onClick: (file: FileRecord) => void;
};

const MIME_TO_CATEGORY: Record<string, AttachmentFileCategory> = {
  'application/pdf': 'TEXT_DOCUMENT',
  'text/csv': 'SPREADSHEET',
  'text/plain': 'TEXT_DOCUMENT',
  'application/msword': 'TEXT_DOCUMENT',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'TEXT_DOCUMENT',
  'image/png': 'IMAGE',
  'image/jpeg': 'IMAGE',
  'image/gif': 'IMAGE',
  'audio/mpeg': 'AUDIO',
  'audio/wav': 'AUDIO',
  'video/mp4': 'VIDEO',
};

export const mimeToCategory = (mimeType: string): AttachmentFileCategory =>
  MIME_TO_CATEGORY[mimeType] ?? 'OTHER';

// grid card
const StyledGridCard = styled.div<{ isSelected: boolean }>`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid
    ${({ theme, isSelected }) =>
      isSelected ? theme.color.blue : theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(4)};
  transition: border-color 150ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledGridCheckbox = styled.div`
  align-self: flex-start;
`;

const StyledGridName = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
`;

const StyledGridSize = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
`;

// list row
const StyledListRow = styled.div<{ isSelected: boolean }>`
  align-items: center;
  background: ${({ theme, isSelected }) =>
    isSelected ? theme.background.transparent.lighter : 'transparent'};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  cursor: pointer;
  display: flex;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(3)}`};

  &:hover {
    background: ${({ theme }) => theme.background.transparent.lighter};
  }
`;

const StyledListName = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  flex: 1;
  font-size: ${({ theme }) => theme.font.size.sm};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledListMeta = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  flex-shrink: 0;
`;

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

export const FileCard = ({
  file,
  view,
  selected,
  onSelect,
  onClick,
}: FileCardProps) => {
  const { t } = useLingui();
  const category = mimeToCategory(file.mimeType);

  const handleCheckbox = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(file.id);
  };

  if (view === 'list') {
    return (
      <StyledListRow isSelected={selected} onClick={() => onClick(file)}>
        <div onClick={handleCheckbox}>
          <Checkbox
            checked={selected}
            shape={CheckboxShape.Squared}
            size={CheckboxSize.Small}
          />
        </div>
        <FileIcon fileCategory={category} size="small" />
        <StyledListName>{file.name}</StyledListName>
        <StyledListMeta>{formatFileSize(file.size)}</StyledListMeta>
        <StyledListMeta>{formatDate(file.createdAt)}</StyledListMeta>
      </StyledListRow>
    );
  }

  return (
    <StyledGridCard isSelected={selected} onClick={() => onClick(file)}>
      <StyledGridCheckbox onClick={handleCheckbox}>
        <Checkbox
          checked={selected}
          shape={CheckboxShape.Squared}
          size={CheckboxSize.Small}
        />
      </StyledGridCheckbox>
      <FileIcon fileCategory={category} />
      <StyledGridName title={file.name}>{file.name}</StyledGridName>
      <StyledGridSize>
        {formatFileSize(file.size)} · {formatDate(file.createdAt)}
      </StyledGridSize>
    </StyledGridCard>
  );
};
