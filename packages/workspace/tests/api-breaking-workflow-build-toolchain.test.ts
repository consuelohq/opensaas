import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflowPath = resolve(
  import.meta.dirname,
  '../../../.github/workflows/ci-breaking-changes.yaml',
);

function workflowText(): string {
  return readFileSync(workflowPath, 'utf8');
}

describe('API breaking-change workflow build toolchain', () => {
  it('uses the pull request compiler toolchain when building the main API baseline', () => {
    const workflow = workflowText();
    const preserve = workflow.indexOf(
      '- name: Preserve API comparison build toolchain',
    );
    const checkoutMain = workflow.indexOf('- name: Checkout main branch');
    const restore = workflow.indexOf(
      '- name: Restore API comparison build toolchain',
    );
    const buildMain = workflow.indexOf('- name: Build main branch server');

    expect(preserve).toBeGreaterThan(-1);
    expect(checkoutMain).toBeGreaterThan(preserve);
    expect(restore).toBeGreaterThan(checkoutMain);
    expect(buildMain).toBeGreaterThan(restore);

    expect(workflow).toContain(
      'cp packages/twenty-server/.swcrc /tmp/api-comparison-build-toolchain/.swcrc',
    );
    expect(workflow).toContain(
      'cp packages/twenty-server/nest-cli.json /tmp/api-comparison-build-toolchain/nest-cli.json',
    );
    expect(workflow).toContain(
      'cp /tmp/api-comparison-build-toolchain/.swcrc packages/twenty-server/.swcrc',
    );
    expect(workflow).toContain(
      'cp /tmp/api-comparison-build-toolchain/nest-cli.json packages/twenty-server/nest-cli.json',
    );
  });
});
