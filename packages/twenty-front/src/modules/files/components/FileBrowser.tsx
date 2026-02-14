import { FileCard } from '@/files/components/FileCard';
import { FilePreview } from '@/files/components/FilePreview';
import { useFiles } from '@/files/hooks/useFiles';
import {
  fileBrowserViewState,
  type FileBrowserView,
} from '@/files/states/fileBrowserViewState';
import { filePreviewState } from '@/files/states/filePreviewState';
import type { FileRecord } from '@/files/types/FileUpload';
import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useState } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import {
  IconFile,
  IconFolder,
  IconHeadphones,
  IconLayoutGrid,
  IconLayoutList,
  IconPhoto,
  IconSearch,
  IconTrash,
  IconVideo,
} from 'twenty-ui/display';
import { Button, LightIconButton, TabButton } from 'twenty-ui/input';
import {
  AnimatedPlaceholder,
  AnimatedPlaceholderEmptyContainer,
  AnimatedPlaceholderEmptySubTitle,
  AnimatedPlaceholderEmptyTextContainer,
  AnimatedPlaceholderEmptyTitle,
} from 'twenty-ui/layout';

// folder tabs
const FOLDERS = [
  { id: 'all', label: 'All' },
  { id: 'documents', label: 'Documents' },
  { id: 'images', label: 'Images' },
  { id: 'audio', label: 'Audio' },
  { id: 'video', label: 'Video' },
] as const;

// type filter → mime prefix
const TYPE_FILTERS: Record<string, string | undefined> = {
  all: undefined,
  documents: 'application',
  images: 'image',
  audio: 'audio',
  video: 'video',
};

// styled components
const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const StyledToolbar = styled.div`
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)}`};
`;

const StyledTitle = styled.h2`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  margin: 0;
`;

const StyledSearchWrapper = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.background.transparent.lighter};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  display: flex;
  flex: 1;
  gap: ${({ theme }) => theme.spacing(1)};
  max-width: 300px;
  padding: ${({ theme }) => `${theme.spacing(1)} ${theme.spacing(2)}`};

  &:focus-within {
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledSearchInput = styled.input`
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.font.color.primary};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.sm};
  outline: none;
  width: 100%;

  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
  }
`;

const StyledSearchIcon = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  flex-shrink: 0;
`;

const StyledViewToggle = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(0.5)};
  margin-left: auto;
`;

const StyledTabs = styled.div`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => `0 ${theme.spacing(4)}`};
`;

const StyledBulkBar = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.background.secondary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)}`};
`;

const StyledBulkCount = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(3)};
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledList = styled.div`
  display: flex;
  flex-direction: column;
`;

const StyledLoading = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  flex: 1;
  font-size: ${({ theme }) => theme.font.size.sm};
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(8)};
`;

const StyledEmptyContainer = styled(AnimatedPlaceholderEmptyContainer)`
  padding: ${({ theme }) => theme.spacing(8)};
`;

export type FileBrowserProps = {
  onFileClick?: (file: FileRecord) => void;
};

export const FileBrowser = ({ onFileClick }: FileBrowserProps) => {
  const { t } = useLingui();
  const [view, setView] = useRecoilState(fileBrowserViewState);
  const setPreviewFile = useSetRecoilState(filePreviewState);
  const [activeFolder, setActiveFolder] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { files, loading, filter, setFilter, deleteFiles } = useFiles();

  const handleFolderChange = useCallback(
    (folderId: string) => {
      setActiveFolder(folderId);
      setSelected(new Set());
      setFilter((prev) => ({
        ...prev,
        folder: folderId === 'all' ? undefined : folderId,
        type: TYPE_FILTERS[folderId],
      }));
    },
    [setFilter],
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilter((prev) => ({ ...prev, search: e.target.value || undefined }));
    },
    [setFilter],
  );

  const handleToggleSelect = useCallback((fileId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  const handleFileClick = useCallback(
    (file: FileRecord) => {
      if (onFileClick) {
        onFileClick(file);
      } else {
        setPreviewFile(file);
      }
    },
    [onFileClick, setPreviewFile],
  );

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selected);
    try {
      await deleteFiles(ids);
      setSelected(new Set());
    } catch {
      // errors handled in useFiles
    }
  }, [selected, deleteFiles]);

  const handleViewChange = useCallback(
    (v: FileBrowserView) => () => setView(v),
    [setView],
  );

  const folderIcons: Record<string, React.ComponentType<{ size?: number; stroke?: number }>> = {
    all: IconFolder,
    documents: IconFile,
    images: IconPhoto,
    audio: IconHeadphones,
    video: IconVideo,
  };

  return (
    <StyledContainer>
      <StyledToolbar>
        <StyledTitle>{t`Files`}</StyledTitle>
        <StyledSearchWrapper>
          <StyledSearchIcon>
            <IconSearch size={16} />
          </StyledSearchIcon>
          <StyledSearchInput
            placeholder={t`Search files...`}
            value={filter.search ?? ''}
            onChange={handleSearchChange}
          />
        </StyledSearchWrapper>
        <StyledViewToggle>
          <LightIconButton
            Icon={IconLayoutGrid}
            accent="secondary"
            active={view === 'grid'}
            onClick={handleViewChange('grid')}
            aria-label={t`Grid view`}
          />
          <LightIconButton
            Icon={IconLayoutList}
            accent="secondary"
            active={view === 'list'}
            onClick={handleViewChange('list')}
            aria-label={t`List view`}
          />
        </StyledViewToggle>
      </StyledToolbar>

      <StyledTabs>
        {FOLDERS.map((folder) => (
          <TabButton
            key={folder.id}
            id={folder.id}
            title={folder.label}
            active={activeFolder === folder.id}
            LeftIcon={folderIcons[folder.id]}
            onClick={() => handleFolderChange(folder.id)}
          />
        ))}
      </StyledTabs>

      {selected.size > 0 && (
        <StyledBulkBar>
          <StyledBulkCount>
            {t`${selected.size} selected`}
          </StyledBulkCount>
          <Button
            title={t`Delete`}
            Icon={IconTrash}
            variant="secondary"
            accent="danger"
            size="small"
            onClick={() => void handleBulkDelete()}
          />
        </StyledBulkBar>
      )}

      {loading ? (
        <StyledLoading>{t`Loading files...`}</StyledLoading>
      ) : files.length === 0 ? (
        <StyledEmptyContainer>
          <AnimatedPlaceholder type="noFile" />
          <AnimatedPlaceholderEmptyTextContainer>
            <AnimatedPlaceholderEmptyTitle>
              {t`No files found`}
            </AnimatedPlaceholderEmptyTitle>
            <AnimatedPlaceholderEmptySubTitle>
              {filter.search
                ? t`Try a different search term`
                : t`Upload files to get started`}
            </AnimatedPlaceholderEmptySubTitle>
          </AnimatedPlaceholderEmptyTextContainer>
        </StyledEmptyContainer>
      ) : view === 'grid' ? (
        <StyledGrid>
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              view="grid"
              selected={selected.has(file.id)}
              onSelect={handleToggleSelect}
              onClick={handleFileClick}
            />
          ))}
        </StyledGrid>
      ) : (
        <StyledList>
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              view="list"
              selected={selected.has(file.id)}
              onSelect={handleToggleSelect}
              onClick={handleFileClick}
            />
          ))}
        </StyledList>
      )}
      <FilePreview />
    </StyledContainer>
  );
};
