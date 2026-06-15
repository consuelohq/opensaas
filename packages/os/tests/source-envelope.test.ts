import { describe, expect, it } from 'vitest';

import { createSteeringSourceEnvelope, wrapToolResultWithSources } from '../scripts/lib/source-envelope';
import type { ToolResult } from '../scripts/lib/facade/types';

describe('OS source envelopes', () => {
  it('builds a citeable steering source without changing the steering body', () => {
    const steering = '# system_prompt.md\n\nline one\nline two';
    const source = createSteeringSourceEnvelope(steering, 'trc_test');

    expect(source).toMatchObject({
      id: 'os-source-get-steering-trc_test',
      title: 'Consuelo OS steering',
      kind: 'steering',
      uri: 'os://get_steering/trc_test',
      traceId: 'trc_test',
      lineStart: 1,
      lineEnd: 4,
    });
    expect(source.lines?.map((line) => line.text)).toEqual([
      '# system_prompt.md',
      '',
      'line one',
      'line two',
    ]);
  });

  it('wraps facade read results with file source metadata centrally', () => {
    const result: ToolResult<unknown> = {
      now: '1970-01-01T00:00:01.000Z',
      ok: true,
      code: 'OK',
      message: 'command completed',
      data: [{ path: 'packages/os/scripts/install.ts', from: 562, to: 568, total: 594, lines: ['if (!options.quiet) {', '  success(...)'] }],
      stderr: '',
      exitCode: 0,
      durationMs: 12,
      traceId: 'trc_read',
      apiVersion: '1.0.0',
    };

    const wrapped = wrapToolResultWithSources('fs.read', result, { input: { path: 'packages/os/scripts/install.ts' } });

    expect(wrapped.data).toBe(result.data);
    expect(wrapped.sources).toHaveLength(1);
    expect(wrapped.sources?.[0]).toMatchObject({
      title: 'packages/os/scripts/install.ts',
      kind: 'file',
      uri: 'os://file/packages%2Fos%2Fscripts%2Finstall.ts?from=562&to=568',
      toolName: 'fs.read',
      traceId: 'trc_read',
      lineStart: 562,
      lineEnd: 568,
    });
  });
});
