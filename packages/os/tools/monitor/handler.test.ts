import { describe, expect, it } from 'vitest';

import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

describe('monitor tool package', () => {
  it('exposes a sessionless read-only OS trace analysis surface', () => {
    expect(toolSchemas[0]?.definition).toMatchObject({
      name: 'monitor.errors',
      inputSchema: 'EmptyInput',
      sessionRequired: false,
      capabilities: { readOnly: true, mutating: false },
    });
    expect(toolHandlers[0]?.command).toMatchObject({ script: 'monitor:errors', branchMode: 'optional' });
  });
});
