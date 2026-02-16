import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import type { FileRecord } from '@/files/types/FileUpload';

const BASE_URL =
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  window._env_?.REACT_APP_SERVER_BASE_URL ?? process.env.REACT_APP_SERVER_BASE_URL!;

export type FilesFilter = {
  folder?: string;
  search?: string;
  type?: string;
};

export const useFiles = (initialFilter?: FilesFilter) => {
  const { t } = useLingui();
  const { enqueueErrorSnackBar } = useSnackBar();

  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilesFilter>(initialFilter ?? {});
  const abortRef = useRef<AbortController | null>(null);

  const fetchFiles = useCallback(
    async (currentFilter: FilesFilter) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (currentFilter.folder) params.set('folder', currentFilter.folder);
        if (currentFilter.search) params.set('search', currentFilter.search);
        if (currentFilter.type) params.set('type', currentFilter.type);

        const res = await fetch(`${BASE_URL}/v1/files?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
        });

        if (!res.ok) {
          // 501 = not implemented yet — show empty, don't error
          if (res.status === 501) {
            setFiles([]);
            return;
          }
          throw new Error(`Failed to fetch files: ${res.status}`);
        }

        const data = (await res.json()) as { files: FileRecord[] };
        setFiles(data.files ?? []);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        enqueueErrorSnackBar(t`Failed to load files`);
        setFiles([]);
      } finally {
        setLoading(false);
      }
    },
    [enqueueErrorSnackBar, t],
  );

  const debouncedFetch = useDebouncedCallback(
    (f: FilesFilter) => void fetchFiles(f),
    300,
  );

  useEffect(() => {
    debouncedFetch(filter);
    return () => {
      abortRef.current?.abort();
    };
  }, [filter, debouncedFetch]);

  const deleteFile = useCallback(
    async (fileId: string) => {
      try {
        const res = await fetch(`${BASE_URL}/v1/files/${fileId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok && res.status !== 501) {
          throw new Error(`Delete failed: ${res.status}`);
        }
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      } catch (err: unknown) {
        enqueueErrorSnackBar(t`Failed to delete file`);
        throw err;
      }
    },
    [enqueueErrorSnackBar, t],
  );

  const deleteFiles = useCallback(
    async (fileIds: string[]) => {
      await Promise.allSettled(fileIds.map((id) => deleteFile(id)));
    },
    [deleteFile],
  );

  const refresh = useCallback(() => void fetchFiles(filter), [fetchFiles, filter]);

  return {
    files,
    loading,
    filter,
    setFilter,
    deleteFile,
    deleteFiles,
    refresh,
  };
};
