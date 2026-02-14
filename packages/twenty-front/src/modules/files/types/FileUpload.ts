// mirrors ALLOWED_TYPES from packages/api/src/routes/files.ts
export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/csv',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/gif',
  'audio/mpeg',
  'audio/wav',
  'video/mp4',
]);

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export type FileUploadStatus = 'pending' | 'uploading' | 'complete' | 'error';

export type FileUploadItem = {
  id: string;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  progress: number;
  status: FileUploadStatus;
  errorMessage?: string;
  storageKey?: string;
};

export type FileRecord = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  storageKey: string;
  folder?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
};

export type UploadUrlResponse = {
  uploadUrl: string;
  storageKey: string;
};

export type FileDropZoneProps = {
  folder?: string;
  tags?: string[];
  onUploadComplete?: (record: FileRecord) => void;
  onUploadError?: (fileName: string, error: string) => void;
  accept?: string;
  maxFiles?: number;
};
