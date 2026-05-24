import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  createAppFilesClient,
  getAppFilesCapability,
  isSupportedAttachmentTarget,
  type AppFileAttachment,
  type AppFileRecord,
  type AttachmentTarget,
} from './app-files-client';
import type { ArtifactDescriptor } from './types';

export type CloudArtifactPublishInput = {
  artifact: ArtifactDescriptor;
  localPath?: string;
  content?: string | Buffer | Uint8Array;
  mimeType?: string;
  folder?: string;
  tags?: string[];
  attachmentTarget?: AttachmentTarget;
  appBaseUrl?: string;
};

export type CloudArtifactPublishResult = {
  ok: boolean;
  artifact: ArtifactDescriptor;
  file?: AppFileRecord;
  attachment?: AppFileAttachment | null;
  warning?: string;
  error?: { code: string; message: string };
};

function mimeTypeForArtifact(artifact: ArtifactDescriptor, explicit?: string): string {
  if (explicit) return explicit;
  if (artifact.format === 'json') return 'application/json';
  if (artifact.format === 'markdown') return 'text/plain';
  if (artifact.format === 'html') return 'text/plain';
  if (artifact.format === 'csv') return 'text/csv';
  if (artifact.format === 'png') return 'image/png';
  if (artifact.format === 'pdf') return 'application/pdf';
  return 'text/plain';
}

function artifactBytes(input: CloudArtifactPublishInput): { body: string | Buffer | Uint8Array; size: number } {
  if (input.content != null) {
    const size = typeof input.content === 'string'
      ? Buffer.byteLength(input.content)
      : input.content.byteLength;
    return { body: input.content, size };
  }
  const localPath = input.localPath ?? input.artifact.localPath;
  if (!localPath) throw new Error('A local artifact path or content is required for cloud publish.');
  return { body: readFileSync(localPath), size: statSync(localPath).size };
}

function appFileId(file: AppFileRecord): string | undefined {
  return typeof file.id === 'string' ? file.id : undefined;
}

function storageKey(file: AppFileRecord, fallback: string): string {
  return typeof file.storageKey === 'string'
    ? file.storageKey
    : typeof file.storage_key === 'string'
      ? file.storage_key
      : fallback;
}

function downloadUrl(file: AppFileRecord): string | undefined {
  return typeof file.downloadUrl === 'string'
    ? file.downloadUrl
    : typeof file.url === 'string'
      ? file.url
      : undefined;
}

function attachmentId(attachment: AppFileAttachment | null | undefined): string | undefined {
  if (!attachment) return undefined;
  return typeof attachment.id === 'string'
    ? attachment.id
    : typeof attachment.attachment_id === 'string'
      ? attachment.attachment_id
      : undefined;
}

function buildAppUrl(appBaseUrl: string | undefined, fileId: string | undefined): string | undefined {
  if (!appBaseUrl || !fileId) return undefined;
  return `${appBaseUrl.replace(/\/+$/g, '')}/files/${fileId}`;
}

export async function publishArtifactToAppFile(input: CloudArtifactPublishInput): Promise<CloudArtifactPublishResult> {
  const capability = getAppFilesCapability();
  if (!capability.ok) {
    return {
      ok: false,
      artifact: input.artifact,
      error: { code: 'MISSING_APP_FILES_CAPABILITY', message: capability.safeMessage ?? 'App files capability is missing.' },
    };
  }

  if (input.attachmentTarget && !isSupportedAttachmentTarget(input.attachmentTarget)) {
    return {
      ok: false,
      artifact: input.artifact,
      error: { code: 'UNSUPPORTED_ATTACHMENT_TARGET', message: `Unsupported attachment target: ${input.attachmentTarget.entityType}` },
    };
  }

  const client = createAppFilesClient();
  if (!client) {
    return {
      ok: false,
      artifact: input.artifact,
      error: { code: 'MISSING_APP_FILES_CAPABILITY', message: 'App files capability is missing.' },
    };
  }

  try {
    const bytes = artifactBytes(input);
    const name = input.artifact.name || path.basename(input.artifact.localPath ?? input.localPath ?? 'artifact.json');
    const mimeType = mimeTypeForArtifact(input.artifact, input.mimeType);
    const upload = await client.createUploadUrl({ name, mimeType, size: bytes.size, folder: input.folder ?? 'os-artifacts' });
    await client.uploadBytes(upload.uploadUrl, bytes.body, mimeType);
    const created = await client.createFile({
      name,
      mimeType,
      size: bytes.size,
      storageKey: upload.storageKey,
      folder: input.folder ?? 'os-artifacts',
      tags: input.tags ?? ['consuelo-os', 'artifact'],
    });
    const id = appFileId(created);
    let attachment: AppFileAttachment | null = null;
    if (id && input.attachmentTarget) {
      attachment = await client.attachFile(id, input.attachmentTarget);
    }
    const resolved = id ? await client.getFile(id) : created;
    const resolvedStorageKey = storageKey(resolved, upload.storageKey);
    const resolvedDownloadUrl = downloadUrl(resolved);
    const resolvedAppUrl = buildAppUrl(input.appBaseUrl ?? process.env.CONSUELO_APP_URL ?? process.env.CONSUELO_APP_API_URL, id);
    const resolvedAttachmentId = attachmentId(attachment);
    const artifact: ArtifactDescriptor = {
      ...input.artifact,
      storageMode: 's3',
      storageKey: resolvedStorageKey,
      appFileId: id,
      appAttachmentId: resolvedAttachmentId,
      downloadUrl: resolvedDownloadUrl,
      appUrl: resolvedAppUrl,
      url: resolvedAppUrl ?? resolvedDownloadUrl ?? input.artifact.url,
      cloud: {
        provider: 'consuelo-app-files',
        fileId: id,
        attachmentId: resolvedAttachmentId,
        storageKey: resolvedStorageKey,
        appUrl: resolvedAppUrl,
        downloadUrl: resolvedDownloadUrl,
      },
    };
    return { ok: true, artifact, file: resolved, attachment };
  } catch (error: unknown) {
    return {
      ok: false,
      artifact: input.artifact,
      error: {
        code: 'APP_FILE_PUBLISH_FAILED',
        message: error instanceof Error ? error.message.slice(0, 240) : 'App file publish failed.',
      },
    };
  }
}
