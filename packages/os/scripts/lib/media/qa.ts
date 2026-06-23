import { Effect } from 'effect';

export const qaEffect = (_input: unknown) => Effect.fail(new Error('media.qa is implemented in branch 3'));
export function qaForCli(_input: unknown): Promise<unknown> {
  return Promise.resolve({ schema: 'media.error.v1', ok: false, error: { code: 'MEDIA_NOT_IMPLEMENTED', message: 'media.qa is implemented in branch 3' } });
}
