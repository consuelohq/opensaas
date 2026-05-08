const assert = require('node:assert/strict');
const { test } = require('node:test');

const { assertTmuxAvailable } = require('../scripts/lib/task-session');

test('assertTmuxAvailable delegates to the tmux availability check', () => {
  assert.doesNotThrow(() => assertTmuxAvailable());
});
