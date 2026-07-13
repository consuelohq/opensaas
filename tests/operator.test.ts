import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function runOperator(args: string[]): string {
  return execFileSync('bun', ['operator/operator.ts', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

describe('operator prompt surface', () => {
  it('lists the bundled review prompt', () => {
    expect(runOperator(['list'])).toContain('review');
  });

  it('prints the review prompt body', () => {
    const output = runOperator(['print', 'review']);
    expect(output).toContain('Review the PR as a high-signal Consuelo teammate review.');
    expect(output).toContain('THIS SHOULD ALL BE DONE ON GITHUB');
  });

  it('wraps a prompt as an executable operator handoff', () => {
    const output = runOperator(['run', 'review']);
    expect(output).toContain('Run the `review` operator prompt now.');
    expect(output).toContain('Review the PR as a high-signal Consuelo teammate review.');
  });
});
