import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { Effect } from 'effect';

import { causeMessage, codeCallServiceError, isCodeCallServiceError } from './errors';
import type { CodeCallMistakeClass } from './types';

const BINARY_EXTENSIONS = new Set([
  '.zip', '.tar', '.gz', '.7z', '.exe', '.dll', '.so', '.class', '.jar', '.war',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.pdf', '.bin', '.dat',
  '.wasm', '.png', '.jpg', '.jpeg', '.gif', '.webp',
]);

function hasPrefix(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((byte, index) => bytes[index] === byte);
}

function looksBinary(filePath: string, bytes: Uint8Array): boolean {
  if (BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return true;
  if (bytes.includes(0)) return true;
  if (hasPrefix(bytes, [0x25, 0x50, 0x44, 0x46])) return true;
  if (hasPrefix(bytes, [0x50, 0x4b, 0x03, 0x04])) return true;
  if (hasPrefix(bytes, [0x1f, 0x8b])) return true;
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47])) return true;
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) return true;
  return false;
}

function invalidSource(message: string) {
  return codeCallServiceError({
    envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
    message,
    detectedMistakeClass: 'invalid_source' satisfies CodeCallMistakeClass,
  });
}

export const readCodeCallTextFileEffect = (filePath: string, inputKind: 'codeFile' | 'stdinFile') => Effect.try({
  try: () => {
    const stats = statSync(filePath);
    if (!stats.isFile()) {
      throw invalidSource(`${inputKind} must be a regular file: ${filePath}`);
    }

    const bytes = readFileSync(filePath);
    const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
    if (looksBinary(filePath, sample)) {
      throw invalidSource(`${inputKind} is binary or not text-readable: ${filePath}`);
    }

    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  },
  catch: (cause) => {
    if (isCodeCallServiceError(cause)) return cause;
    return invalidSource(`failed to read ${inputKind}: ${filePath}: ${causeMessage(cause)}`);
  },
}).pipe(
  Effect.flatMap((value) => typeof value === 'string' ? Effect.succeed(value) : Effect.fail(value)),
);
