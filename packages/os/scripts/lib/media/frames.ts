import { Effect } from 'effect';

export const extractFramesEffect = (_input: unknown) => Effect.fail(new Error('media.frames.extract is implemented in branch 3'));
export function extractFramesForCli(_input: unknown): Promise<unknown> {
  return Promise.resolve({ schema: 'media.error.v1', ok: false, error: { code: 'MEDIA_NOT_IMPLEMENTED', message: 'media.frames.extract is implemented in branch 3' } });
}
