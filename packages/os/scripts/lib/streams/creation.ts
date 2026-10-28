import { Effect } from 'effect';

import { StreamServiceError, streamError } from './errors';
import { DEFAULT_STREAM_INSTRUCTIONS } from './instructions';
import type { StreamCreateInput, StreamCreateResult, StreamCreationContext } from './types';

function validateArea(area: string): string {
  const normalized = area.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw streamError('INVALID_AREA', `invalid stream area: ${area}`);
  }
  return normalized;
}

export function createStreamEffect(
  input: StreamCreateInput,
  context: StreamCreationContext,
): Effect.Effect<StreamCreateResult, StreamServiceError> {
  return Effect.gen(function* () {
    const area = yield* Effect.try({
      try: () => validateArea(input.area),
      catch: (cause) => cause instanceof StreamServiceError
        ? cause
        : streamError('INVALID_AREA', `invalid stream area: ${input.area}`, cause),
    });
    const stream = `stream/${area}`;
    const sourceBranch = input.sourceBranch || 'main';
    const existing = yield* context.remote.getBranch(stream);
    if (existing) return yield* Effect.fail(streamError('STREAM_EXISTS', `${stream} already exists`));
    const source = yield* context.remote.getBranch(sourceBranch);
    if (!source) return yield* Effect.fail(streamError('SOURCE_MISSING', `source branch ${sourceBranch} does not exist`));

    const files = [
      { path: `packages/os/streams/${area}/AGENTS.md`, content: DEFAULT_STREAM_INSTRUCTIONS },
      { path: `packages/workspace/streams/${area}/AGENTS.md`, content: DEFAULT_STREAM_INSTRUCTIONS },
    ];
    const commit = yield* context.remote.commitFiles({
      parentSha: source.sha,
      files,
      message: `chore(stream): initialize ${area} instructions`,
    });
    yield* context.remote.createBranch({ branch: stream, sha: commit.sha });
    yield* context.local.fetchOrigin();
    const localExists = yield* context.local.branchExists(stream);
    if (!localExists) {
      yield* context.local.createTrackingBranch({ branch: stream, upstream: `origin/${stream}` });
    }

    return {
      stream,
      sourceBranch,
      commitSha: commit.sha,
      instructionPaths: files.map((file) => file.path),
      localTrackingCreated: !localExists,
    };
  });
}
