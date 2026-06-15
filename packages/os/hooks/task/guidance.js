const TASK_FLOW_ANCHOR = 'stream.context → task.start → scoped workpad + test-first contract → decision-engine research → focused red test or no-test waiver → implementation → focused green test → validation / verify → task.push → task.pr → stream review PR → task.finish';
const TASK_SESSION_ANCHOR = 'For task-scoped work, `task.start` returns `data.taskSession`.';
const TOP_LEVEL_SESSION_ANCHOR = 'Pass `taskSession` at the top level of every task-scoped `os.call`:';
const TEST_FIRST_ANCHOR = 'For non-trivial code changes, implementation must not begin until the scoped workpad contains a Test-first contract and either:';
const FOCUSED_RED_ANCHOR = 'a focused test has been written or updated and run red, or';
const NO_TEST_WAIVER_ANCHOR = 'a no-test waiver explains why no test is appropriate and what validation replaces it.';
const WORKPAD_ANCHOR = 'Every task must keep its task-local scoped workpad current enough for another agent to continue without chat history.';
const STREAM_APPROVAL_ANCHOR = 'Ko must explicitly provide or approve the stream before task work begins.';

const VALID_STAGES = new Set([
  'before-task-start',
  'after-task-start',
  'before-production-edit',
  'before-publish',
  'unknown-task-tool',
]);

function getTaskHookGuidance(stage, options = {}) {
  if (!VALID_STAGES.has(stage)) {
    throw new Error(`unknown task hook stage: ${stage}`);
  }

  switch (stage) {
    case 'before-task-start':
      return buildBeforeTaskStart(options);
    case 'after-task-start':
      return buildAfterTaskStart(options);
    case 'before-production-edit':
      return buildBeforeProductionEdit(options);
    case 'before-publish':
      return buildBeforePublish(options);
    case 'unknown-task-tool':
      return buildUnknownTaskTool(options);
    default:
      throw new Error(`unhandled task hook stage: ${stage}`);
  }
}

function buildBeforeTaskStart(options) {
  const area = options.area || '<area>';
  return {
    stage: 'before-task-start',
    title: 'Before task start — orient in the stream',
    skillAnchors: [
      STREAM_APPROVAL_ANCHOR,
      TASK_FLOW_ANCHOR,
    ],
    actions: [
      osCall('stream.context', { area }),
      osCall('task.start', {
        area,
        title: options.title || '<task title>',
        startFrom: options.startFrom || 'main',
      }),
    ],
    notes: [
      'Use stream.list first only when the correct stream area is unknown.',
      'Confirm stream branch, open task PRs, recent stream commits, worktrees, and obvious conflicts before task.start.',
    ],
  };
}

function buildAfterTaskStart(options) {
  const area = options.area || '<area>';
  const taskSession = options.taskSession || '<taskSession>';
  const worktreePath = options.worktreePath || '<worktreePath>';
  return {
    stage: 'after-task-start',
    title: 'Task started — preserve task-scoped workflow',
    skillAnchors: [
      TASK_FLOW_ANCHOR,
      TASK_SESSION_ANCHOR,
      TOP_LEVEL_SESSION_ANCHOR,
      WORKPAD_ANCHOR,
      'Agents must update the workpad at these checkpoints:',
      '1. Immediately after `task.start`',
    ],
    actions: [
      osCall('fs.read', { path: 'AGENTS.md' }, taskSession),
      osCall('status', {}, taskSession),
      osCall('code.run', {
        mode: 'read',
        code: 'return await workspace.explore({ query: "task implementation path", limit: 8 });',
      }, taskSession),
    ],
    notes: [
      `Worktree: ${worktreePath}`,
      `Area: ${area}`,
      'Copy acceptance criteria, plan, assumptions, and a Test-first contract stub into the scoped workpad before editing.',
      'Do not rely on root `.task/current.json`, current branch, or ambient task selection.',
    ],
  };
}

function buildBeforeProductionEdit(options) {
  return {
    stage: 'before-production-edit',
    title: 'Before production edit — prove the contract first',
    skillAnchors: [
      TEST_FIRST_ANCHOR,
      FOCUSED_RED_ANCHOR,
      NO_TEST_WAIVER_ANCHOR,
      'Before any meaningful production code edit',
      '- behavior under test',
      '- existing local test pattern to follow',
      '- new or changed tests',
      '- focused red command',
      '- expected red failure',
    ],
    actions: [
      osCall('fs.write', {
        path: `.task/${options.area || '<area>'}/<task-slug>/workpad.md`,
        append: true,
        content: '## Test-first contract\n\nBehavior under test:\n- ...\n',
      }, options.taskSession),
      osCall('code.call', {
        command: ['bun', '--cwd', 'packages/os', 'test', '<focused-test-file>'],
        tddPhase: 'red',
        timeout: 300000,
      }, options.taskSession),
    ],
    notes: [
      'A test is good only if it would fail when the intended behavior is broken.',
      'If no test is appropriate, write the no-test waiver before editing production code.',
    ],
  };
}

function buildBeforePublish(options) {
  return {
    stage: 'before-publish',
    title: 'Before publish — make review state durable',
    skillAnchors: [
      TASK_FLOW_ANCHOR,
      'Before `task.push`, `task.pr`, or `task.finish`',
      '- final summary',
      '- files changed',
      '- key decisions',
      '- green evidence',
      '- broader validation evidence',
      '- issues encountered',
      '`task.pr` must promote the task into the stream and return the stream review PR unless Ko explicitly asks for task-only mode.',
    ],
    actions: [
      osCall('git.diff', { stat: true, files: true, hunks: true, maxBytes: 20000 }, options.taskSession),
      osCall('review.run', { base: options.base || 'origin/main', noTests: Boolean(options.noTests) }, options.taskSession),
      osCall('verify', { base: options.base || 'origin/main', noDb: true }, options.taskSession),
      osCall('task.push', { message: options.message || 'type(os): description', changed: true }, options.taskSession),
      osCall('task.pr', { ready: true }, options.taskSession),
    ],
    notes: [
      'Report the stream review PR, not only the intermediate task PR.',
      'Use task.finish only after merge/cleanup safety is established.',
    ],
  };
}

function buildUnknownTaskTool(options) {
  const requestedTool = options.requestedTool || '<task tool>';
  return {
    stage: 'unknown-task-tool',
    title: 'Unknown task tool — recover through tool search',
    skillAnchors: [
      'Use `tools.search` when a workflow/provider/tool is not in core steering.',
      TASK_SESSION_ANCHOR,
      TOP_LEVEL_SESSION_ANCHOR,
    ],
    actions: [
      osCall('tools.search', { query: requestedTool }),
    ],
    notes: [
      `Requested tool: ${requestedTool}`,
      'Do not guess the tool input shape. Resolve the tool schema before calling it.',
    ],
  };
}

function osCall(tool, input, taskSession) {
  const call = {
    command: 'os.call',
    input: {
      tool,
      input,
      timeout: defaultTimeoutForTool(tool),
    },
  };
  if (taskSession) {
    call.input.taskSession = taskSession;
  }
  return call;
}

function defaultTimeoutForTool(tool) {
  if (tool === 'code.call' || tool === 'verify' || tool === 'review.run') return 300000;
  return 120;
}

function renderTaskHookGuidance(guidance) {
  const lines = [
    `# ${guidance.title}`,
    '',
    '## Skill anchors',
    ...guidance.skillAnchors.map((anchor) => `- ${anchor}`),
    '',
    '## Actions',
    ...guidance.actions.map((action) => `- ${action.command} ${JSON.stringify(action.input)}`),
  ];

  if (guidance.notes?.length) {
    lines.push('', '## Notes', ...guidance.notes.map((note) => `- ${note}`));
  }

  return `${lines.join('\n')}\n`;
}

module.exports = {
  getTaskHookGuidance,
  renderTaskHookGuidance,
  TASK_FLOW_ANCHOR,
  TASK_SESSION_ANCHOR,
  TOP_LEVEL_SESSION_ANCHOR,
};
