import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const generatedTypes = readFileSync(resolve(here, '../src/generated/workspace.d.ts'), 'utf8');

describe('generated workspace error-code parity', () => {
  it('should include task-session failures when generating the public ErrorCode union', () => {
    expect(generatedTypes).toContain('"TASK_SESSION_REQUIRED"');
    expect(generatedTypes).toContain('"TASK_SESSION_NOT_FOUND"');
    expect(generatedTypes).toContain('"WORK_SESSION_NOT_FOUND"');
  });
});
