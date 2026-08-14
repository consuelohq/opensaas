import fs from 'node:fs';
import path from 'node:path';

import { Effect } from 'effect';

import { streamError, type StreamServiceError } from './errors';
import type { StreamInstructionResult, StreamInstructionSeedResult } from './types';

export const DEFAULT_STREAM_INSTRUCTIONS = '# Stream instructions\n\nOptional: add durable instructions for agents working in this stream.\n';

export function streamInstructionPath(streamsRoot: string, area: string): string {
  return path.join(streamsRoot, area, 'AGENTS.md');
}

export function readStreamInstructionsEffect(input: {
  streamsRoot: string;
  area: string;
}): Effect.Effect<StreamInstructionResult, StreamServiceError> {
  return Effect.try({
    try: () => {
      const filePath = streamInstructionPath(input.streamsRoot, input.area);
      if (!fs.existsSync(filePath)) {
        return { exists: false, path: filePath, content: '' };
      }
      return { exists: true, path: filePath, content: fs.readFileSync(filePath, 'utf8') };
    },
    catch: (cause) => streamError('INSTRUCTION_IO', `failed to read stream instructions for ${input.area}`, cause),
  });
}

export function seedStreamInstructionsEffect(input: {
  streamsRoot: string;
  area: string;
  content?: string;
}): Effect.Effect<StreamInstructionSeedResult, StreamServiceError> {
  return Effect.try({
    try: () => {
      const filePath = streamInstructionPath(input.streamsRoot, input.area);
      if (fs.existsSync(filePath)) {
        return { status: 'preserved' as const, path: filePath };
      }
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, input.content ?? DEFAULT_STREAM_INSTRUCTIONS);
      return { status: 'created' as const, path: filePath };
    },
    catch: (cause) => streamError('INSTRUCTION_IO', `failed to seed stream instructions for ${input.area}`, cause),
  });
}
