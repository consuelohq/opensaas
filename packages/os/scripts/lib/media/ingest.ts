import { Effect } from 'effect';
import './source-capture/schema';

export const ingestMediaEffect = (_input: unknown) => Effect.fail(new Error('media.ingest is implemented in branch 4'));
export function ingestMediaForCli(_input: unknown): Promise<unknown> {
  return Promise.resolve({ schema: 'media.error.v1', ok: false, error: { code: 'MEDIA_NOT_IMPLEMENTED', message: 'media.ingest is implemented in branch 4' } });
}
