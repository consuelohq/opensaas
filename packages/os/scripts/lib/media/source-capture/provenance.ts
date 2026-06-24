import type { SourceCaptureResult } from './schema';

export function createSourceCaptureProvenance(result: SourceCaptureResult): Record<string, unknown> {
  return {
    status: 'captured',
    url: result.source.url,
    path: result.source.path,
    extractor: result.source.extractor,
    capturedAt: result.capturedAt,
    commandPlan: result.commandPlan,
  };
}
