import { useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { v4 as uuidv4 } from 'uuid';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { fileUploadsState } from '@/files/states/fileUploadsState';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  type FileRecord,
  type FileUploadItem,
  type UploadUrlResponse,
} from '@/files/types/FileUpload';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { formatFileSize } from '@/file/utils/formatFileSize';

// upload a single file to a presigned S3 URL with progress tracking via XHR
const uploadToPresignedUrl = (
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.send(file);
  });
};

export const useFileUploadToStorage = () => {
  const [uploads, setUploads] = useRecoilState(fileUploadsState);
  const { enqueueErrorSnackBar } = useSnackBar();

  const updateUpload = useCallback(
    (id: string, patch: Partial<FileUploadItem>) => {
      setUploads((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [setUploads],
  );

  const removeUpload = useCallback(
    (id: string) => {
      setUploads((prev) => prev.filter((item) => item.id !== id));
    },
    [setUploads],
  );

  const clearCompleted = useCallback(() => {
    setUploads((prev) => prev.filter((item) => item.status !== 'complete'));
  }, [setUploads]);

  const uploadFile = useCallback(
    async (
      file: File,
      options?: { folder?: string; tags?: string[] },
    ): Promise<FileRecord | null> => {
      // validate mime type
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        enqueueErrorSnackBar({
          message: `${file.name}: file type not allowed`,
        });
        return null;
      }

      // validate size
      if (file.size > MAX_FILE_SIZE) {
        enqueueErrorSnackBar({
          message: `${file.name} exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`,
        });
        return null;
      }

      const id = uuidv4();
      const uploadItem: FileUploadItem = {
        id,
        file,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        progress: 0,
        status: 'pending',
      };

      setUploads((prev) => [...prev, uploadItem]);

      try {
        // step 1: get presigned upload URL from our API
        updateUpload(id, { status: 'uploading' });

        const urlResponse = await fetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/files/upload-url`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: file.name,
              contentType: file.type,
              size: file.size,
              folder: options?.folder,
            }),
          },
        );

        if (!urlResponse.ok) {
          const errorData = (await urlResponse.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          throw new Error(
            errorData?.error?.message ?? `Server error ${urlResponse.status}`,
          );
        }

        const { url, key } = (await urlResponse.json()) as UploadUrlResponse;

        // step 2: upload directly to S3 via presigned URL
        await uploadToPresignedUrl(url, file, (progress) => {
          updateUpload(id, { progress });
        });

        // step 3: create file record in our DB
        const recordResponse = await fetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/files`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: file.name,
              mimeType: file.type,
              size: file.size,
              storageKey: key,
              folder: options?.folder,
              tags: options?.tags,
            }),
          },
        );

        if (!recordResponse.ok) {
          const errorData = (await recordResponse
            .json()
            .catch(() => null)) as {
            error?: { message?: string };
          } | null;
          throw new Error(
            errorData?.error?.message ??
              `Failed to create file record: ${recordResponse.status}`,
          );
        }

        const record = (await recordResponse.json()) as FileRecord;

        updateUpload(id, {
          status: 'complete',
          progress: 100,
          storageKey: key,
        });

        return record;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Upload failed';
        updateUpload(id, { status: 'error', errorMessage: message });
        enqueueErrorSnackBar({ message: `${file.name}: ${message}` });
        return null;
      }
    },
    [setUploads, updateUpload, enqueueErrorSnackBar],
  );

  const uploadFiles = useCallback(
    async (
      files: File[],
      options?: { folder?: string; tags?: string[] },
    ): Promise<FileRecord[]> => {
      const results = await Promise.all(
        files.map((file) => uploadFile(file, options)),
      );
      return results.filter(
        (record): record is FileRecord => record !== null,
      );
    },
    [uploadFile],
  );

  return {
    uploads,
    uploadFile,
    uploadFiles,
    removeUpload,
    clearCompleted,
  };
};
