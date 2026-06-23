export type MediaErrorCode =
  | 'MEDIA_DEPENDENCY_MISSING'
  | 'MEDIA_INPUT_MISSING'
  | 'MEDIA_VALIDATION_ERROR'
  | 'MEDIA_NOT_IMPLEMENTED'
  | 'MEDIA_SOURCE_ASSET_MISSING';

export class MediaError extends Error {
  readonly code: MediaErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: MediaErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'MediaError';
    this.code = code;
    this.details = details;
  }
}

export function toMediaError(value: unknown): MediaError {
  if (value instanceof MediaError) return value;
  if (value instanceof Error) return new MediaError('MEDIA_VALIDATION_ERROR', value.message);
  return new MediaError('MEDIA_VALIDATION_ERROR', String(value));
}
