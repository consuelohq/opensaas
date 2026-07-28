import { describe, it } from 'vitest';

describe('future OS distribution lifecycle contracts', () => {
  // Worker 05 rollback, retention, and uninstall contracts are behavioral tests in
  // tests/lifecycle-retention-uninstall.test.ts.
  it.todo('[Worker 04] should activate one verified runtime bundle on clean install');
  it.todo('[Worker 04] should update an existing install without onboarding');
  it.todo('[Worker 04] should leave current unchanged when a download is interrupted');
  it.todo('[Workers 02 and 04] should fail closed when a signature or digest mismatches');
  it.todo('[Worker 06] should never silently overwrite modified managed content');
  it.todo('[Worker 03] should promote a channel without rebuilding or mutating bundle bytes');
  it.todo('[Workers 04 and 23] should redact representative tokens and provider secrets from diagnostics');
});
