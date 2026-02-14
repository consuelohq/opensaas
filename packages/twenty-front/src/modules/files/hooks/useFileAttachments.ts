import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { FileRecord } from '@/files/types/FileUpload';

const BASE_URL =
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  window._env_?.REACT_APP_SERVER_BASE_URL ?? process.env.REACT_APP_SERVER_BASE_URL!;

export type EntityType = 'contact' | 'call' | 'company' | 'deal';

export type AttachedFile = FileRecord & {
  attachmentId: string;
  attachedAt: string;
};

export const useFileAttachments = (entityType: EntityType, entityId: string) => {
  const { t } = useLingui();
  const { enqueueErrorSnackBar } = useSnackBar();

  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchAttachments = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await fetch(
        `${BASE_URL}/v1/files/by-entity/${entityType}/${entityId}`,
        { credentials: 'include', signal: controller.signal },
      );

      if (!res.ok) {
        if (res.status === 501) {
          setFiles([]);
          return;
        }
        throw new Error(`Failed to fetch attachments: ${res.status}`);
      }

      const data = (await res.json()) as { files: AttachedFile[] };
      setFiles(data.files ?? []);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      enqueueErrorSnackBar(t`Failed to load attached files`);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, enqueueErrorSnackBar, t]);

  useEffect(() => {
    void fetchAttachments();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchAttachments]);

  const attach = useCallback(
    async (fileId: string) => {
      try {
        const res = await fetch(`${BASE_URL}/v1/files/${fileId}/attach`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityType, entityId }),
        });
        if (!res.ok) throw new Error(`Attach failed: ${res.status}`);
        // refetch to get the full joined record
        await fetchAttachments();
      } catch (err: unknown) {
        enqueueErrorSnackBar(t`Failed to attach file`);
        throw err;
      }
    },
    [entityType, entityId, fetchAttachments, enqueueErrorSnackBar, t],
  );

  const detach = useCallback(
    async (fileId: string, attachmentId: string) => {
      try {
        const res = await fetch(
          `${BASE_URL}/v1/files/${fileId}/attach/${attachmentId}`,
          { method: 'DELETE', credentials: 'include' },
        );
        if (!res.ok) throw new Error(`Detach failed: ${res.status}`);
        setFiles((prev) => prev.filter((f) => f.attachmentId !== attachmentId));
      } catch (err: unknown) {
        enqueueErrorSnackBar(t`Failed to detach file`);
        throw err;
      }
    },
    [enqueueErrorSnackBar, t],
  );

  return { files, loading, attach, detach, refresh: fetchAttachments };
};
