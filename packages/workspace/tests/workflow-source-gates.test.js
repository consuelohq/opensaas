import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '..', '..', '..');
const workflowDir = join(repoRoot, '.github', 'workflows');

describe('workflow source gates', () => {
  test('separates frontend config lint from source typecheck, tests, and builds', () => {
    const frontWorkflow = readFileSync(join(workflowDir, 'ci-front.yaml'), 'utf8');

    expect(frontWorkflow).toContain('classify-front-source-changes:');
    expect(frontWorkflow).toContain(
      'node packages/workspace/scripts/ci/classify-front-source-change.cjs',
    );
    expect(frontWorkflow).toContain('front-lint:');
    expect(frontWorkflow).toContain('tasks: lint:diff-with-main');
    expect(frontWorkflow).toContain('task: [typecheck, test]');
    expect(frontWorkflow).toContain(
      "if: needs.classify-front-source-changes.outputs.any_changed == 'true'",
    );
    expect(frontWorkflow).toContain('tasks: ${{ matrix.task }}');
  });

  test('runs shared application gates only for shared source changes', () => {
    const sharedWorkflow = readFileSync(join(workflowDir, 'ci-shared.yaml'), 'utf8');

    expect(sharedWorkflow).toContain('classify-shared-source-changes:');
    expect(sharedWorkflow).toContain(
      'node packages/workspace/scripts/ci/classify-front-source-change.cjs',
    );
    expect(sharedWorkflow).toContain(
      "needs.classify-shared-source-changes.outputs.source_changed == 'true'",
    );
    expect(sharedWorkflow).toContain('task: [lint, typecheck, test]');
  });
});
