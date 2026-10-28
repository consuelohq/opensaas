import { Data } from 'effect';

export class StreamServiceError extends Data.TaggedError('StreamServiceError')<{
  code: 'INVALID_AREA' | 'STREAM_EXISTS' | 'SOURCE_MISSING' | 'INSTRUCTION_IO' | 'REMOTE_FAILURE' | 'LOCAL_FAILURE';
  message: string;
  cause?: unknown;
}> {}

export function streamError(
  code: StreamServiceError['code'],
  message: string,
  cause?: unknown,
): StreamServiceError {
  return new StreamServiceError({ code, message, ...(cause === undefined ? {} : { cause }) });
}
