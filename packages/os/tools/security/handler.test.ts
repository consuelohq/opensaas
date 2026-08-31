import { describe, expect, it } from 'vitest';

import { toolHandlers } from './handler';
import { toolSchemas } from './schema';

describe('security tool package', () => {
  it('exposes one sessionless defensive repo scan with no remote target input', () => {
    expect(toolSchemas).toHaveLength(1);
    expect(toolSchemas[0]?.definition).toMatchObject({
      name: 'security.scan',
      inputSchema: 'EmptyInput',
      sessionRequired: false,
      capabilities: { readOnly: true, mutating: false },
    });
    expect(toolHandlers[0]?.command).toMatchObject({ script: 'security:scan', branchMode: 'optional' });
  });
});
