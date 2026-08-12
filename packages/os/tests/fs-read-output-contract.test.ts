import { describe, expect, it } from 'vitest';

import { outputTypeSignatures as osOutputTypeSignatures } from '../scripts/lib/facade/schemas';
import { outputTypeSignatures as workspaceOutputTypeSignatures } from '../../workspace/scripts/lib/facade/schemas';

describe('fs.read output contract', () => {
  it('advertises full text reads in both facade schema copies', () => {
    expect(osOutputTypeSignatures.FsReadOutput).toContain('type: "text-full"');
    expect(workspaceOutputTypeSignatures.FsReadOutput).toContain('type: "text-full"');
  });
});
