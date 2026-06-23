import { Effect } from 'effect';

export const probeEffect = (_input: unknown) => Effect.fail(new Error('media.probe is implemented in branch 3'));
export function probeForCli(_input: unknown): Promise<unknown> {
  return Promise.resolve({ schema: 'media.error.v1', ok: false, error: { code: 'MEDIA_NOT_IMPLEMENTED', message: 'media.probe is implemented in branch 3' } });
}
