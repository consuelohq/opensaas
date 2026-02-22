import { existsSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { error, isJson, json } from '../output.js';

const MAX_INPUT_LENGTH = 4096;

export const sanitizeInput = (value: string): string => {
  const trimmed = value.trim();

  if (trimmed.includes('\0')) {
    if (isJson()) {
      json({
        error: { code: 'INVALID_INPUT', message: 'input contains null bytes' },
      });
    } else {
      error('error: input contains null bytes');
    }
    process.exit(1);
  }

  if (trimmed.length > MAX_INPUT_LENGTH) {
    if (isJson()) {
      json({
        error: {
          code: 'INPUT_TOO_LONG',
          message: `input exceeds ${MAX_INPUT_LENGTH} characters`,
        },
      });
    } else {
      error(`error: input exceeds ${MAX_INPUT_LENGTH} characters`);
    }
    process.exit(1);
  }

  return trimmed;
};

export const validateTranscriptFile = (filePath: string): string => {
  const sanitized = sanitizeInput(filePath);

  if (!existsSync(sanitized)) {
    if (isJson()) {
      json({
        error: {
          code: 'FILE_NOT_FOUND',
          message: `transcript file not found: ${basename(sanitized)}`,
        },
      });
    } else {
      error(`error: transcript file not found: ${basename(sanitized)}`);
    }
    process.exit(1);
  }

  const stats = statSync(sanitized);
  if (!stats.isFile()) {
    if (isJson()) {
      json({
        error: {
          code: 'NOT_A_FILE',
          message: `transcript path is not a file: ${basename(sanitized)}`,
        },
      });
    } else {
      error(`error: transcript path is not a file: ${basename(sanitized)}`);
    }
    process.exit(1);
  }

  return sanitized;
};
