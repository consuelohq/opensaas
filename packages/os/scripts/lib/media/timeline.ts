import { Effect } from 'effect';

export const validateTimelineEffect = (_input: unknown) => Effect.fail(new Error('media.timeline.validate is implemented in branch 3'));
export function validateTimelineForCli(_input: unknown): Promise<unknown> {
  return Promise.resolve({ schema: 'media.error.v1', ok: false, error: { code: 'MEDIA_NOT_IMPLEMENTED', message: 'media.timeline.validate is implemented in branch 3' } });
}
