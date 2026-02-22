import type { ArtifactStore, CreateArtifactInput, SandboxArtifact } from '../types.js';

export type { ArtifactStore, CreateArtifactInput };

const SIZE_THRESHOLD = 256 * 1024; // 256KB — inline vs file-backed

// infer artifact type from mime type
const inferType = (mimeType: string): CreateArtifactInput['type'] => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'text/csv') return 'csv';
  if (mimeType === 'application/json') return 'table';
  return 'file';
};

// convert sandbox output files into artifact creation inputs
export const sandboxToArtifacts = (
  sandboxArtifacts: SandboxArtifact[],
  meta: { conversationId: string; executionId: string; workspaceId: string; userId: string },
): CreateArtifactInput[] =>
  sandboxArtifacts.map((artifact) => ({
    conversationId: meta.conversationId,
    executionId: meta.executionId,
    type: inferType(artifact.mimeType),
    title: artifact.path.split('/').pop() ?? artifact.path,
    mimeType: artifact.mimeType,
    sizeBytes: artifact.data.byteLength,
    // small files go inline as base64, large ones need file upload by the consuming app
    content: artifact.data.byteLength < SIZE_THRESHOLD
      ? { base64: artifact.data.toString('base64'), path: artifact.path }
      : undefined,
    workspaceId: meta.workspaceId,
    userId: meta.userId,
  }));
