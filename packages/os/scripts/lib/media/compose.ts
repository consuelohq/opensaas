import { Effect } from 'effect';

export const composeEffect = (_input: unknown) => Effect.fail(new Error('media.compose is implemented in branch 3'));
export function composeForCli(_input: unknown): Promise<unknown> {
  return Promise.resolve({ schema: 'media.error.v1', ok: false, error: { code: 'MEDIA_NOT_IMPLEMENTED', message: 'media.compose is implemented in branch 3' } });
}
