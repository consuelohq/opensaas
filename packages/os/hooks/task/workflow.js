'use strict';

const TASK_WORKFLOW_ID = 'task';

const STAGE_IDS = [
  'stream-context',
  'task-start',
  'workpad-bootstrap',
  'test-contract',
  'decision-research',
  'focused-red-or-waiver',
  'implementation',
  'focused-green',
  'validation',
  'task-push',
  'task-pr',
  'stream-review-pr',
  'task-finish',
];

const SUBSCRIPTIONS = [
  { event: 'workflow.intent.task.detected', workflow: TASK_WORKFLOW_ID },
  { event: 'tool.preInvoke', workflow: TASK_WORKFLOW_ID, tool: 'stream.context' },
  { event: 'tool.postInvoke', workflow: TASK_WORKFLOW_ID, tool: 'stream.context' },
  { event: 'tool.preInvoke', workflow: TASK_WORKFLOW_ID, tool: 'task.start' },
  { event: 'tool.postInvoke', workflow: TASK_WORKFLOW_ID, tool: 'task.start' },
  { event: 'workflow.stage.ready', workflow: TASK_WORKFLOW_ID, stage: 'validation' },
  { event: 'tool.preInvoke', workflow: TASK_WORKFLOW_ID, tool: 'task.push' },
  { event: 'tool.postInvoke', workflow: TASK_WORKFLOW_ID, tool: 'task.pr' },
  { event: 'workflow.stage.ready', workflow: TASK_WORKFLOW_ID, stage: 'task-finish' },
];

const DEFAULT_SKILL_ANCHORS = {
  flow: 'stream.context → task.start → scoped workpad + test-first contract → decision-engine research → focused red test or no-test waiver → implementation → focused green test → validation / verify → task.push → task.pr → stream review PR → task.finish',
  taskSession: 'For task-scoped work, task.start returns data.taskSession.',
  topLevelSession: 'Pass taskSession at the top level of every task-scoped os.call.',
  workpad: 'Every task must keep its task-local scoped workpad current enough for another agent to continue without chat history.',
  testFirst: 'Test-first contract requires a focused test or no-test waiver before implementation.',
  streamReview: 'task.pr must promote the task into the stream and return the stream review PR unless Ko explicitly asks for task-only mode.',
};

function createTaskWorkflowHookRegistry(options = {}) {
  const manifest = Array.isArray(options.manifest) ? options.manifest : [];
  const resolver = createManifestResolver(manifest);
  const anchors = extractSkillAnchors(options.skillText || '');
  const workflows = new Map([
    [TASK_WORKFLOW_ID, { id: TASK_WORKFLOW_ID, stages: buildStages(anchors) }],
  ]);

  return {
    workflow(workflowId) {
      return workflows.get(workflowId) || null;
    },
    subscriptions() {
      return SUBSCRIPTIONS.map((subscription) => ({ ...subscription }));
    },
    handle(event) {
      if (!isTaskWorkflowEvent(event)) return null;

      if (event.event === 'tool.preInvoke' && event.tool === 'task.start') {
        return handlePreTaskStart(event, resolver);
      }

      if (event.event === 'tool.postInvoke' && event.tool === 'task.start') {
        return handlePostTaskStart(event, resolver, anchors);
      }

      if (event.event === 'workflow.stage.ready' && event.stage === 'validation') {
        return handleValidationReady(event, resolver);
      }

      if (event.event === 'workflow.stage.ready' && event.stage === 'task-finish') {
        return handleTaskFinishReady(event, resolver);
      }

      return null;
    },
  };
}

function buildStages(anchors) {
  return STAGE_IDS.map((id) => ({
    id,
    workflow: TASK_WORKFLOW_ID,
    requiredSkillAnchors: anchorsForStage(id, anchors),
  }));
}

function anchorsForStage(stageId, anchors) {
  switch (stageId) {
    case 'stream-context':
      return [anchors.flow];
    case 'task-start':
      return [anchors.flow, anchors.taskSession];
    case 'workpad-bootstrap':
      return [anchors.workpad, anchors.taskSession, anchors.topLevelSession];
    case 'test-contract':
      return [
        anchors.testFirst,
        'focused test has been written or updated and run red',
        'no-test waiver explains why no test is appropriate',
      ];
    case 'task-pr':
      return [anchors.streamReview];
    case 'stream-review-pr':
      return [anchors.streamReview, 'Report the stream review PR, not only the intermediate task PR.'];
    default:
      return [anchors.flow];
  }
}

function isTaskWorkflowEvent(event) {
  return Boolean(event && event.workflow === TASK_WORKFLOW_ID);
}

function handlePreTaskStart(event, resolver) {
  const state = event.state || {};
  if (state.hasStreamContext === true) {
    return null;
  }

  return {
    workflow: TASK_WORKFLOW_ID,
    stage: 'stream-context',
    event: event.event,
    blockedAction: {
      requestedTool: event.tool,
      reason: 'stream.context must run before task.start so the agent sees stream branch, open task PRs, recent commits, worktrees, and conflicts.',
    },
    requiredNextAction: resolver.action('stream.context', {
      input: { area: state.area || '<area>' },
    }),
    notes: [
      'This hook is scoped to tool.preInvoke:task.start only; it is not ambient guidance for general chat or non-task workflows.',
    ],
  };
}

function handlePostTaskStart(event, resolver, anchors) {
  const result = event.result || {};
  const taskSession = result.taskSession || result.data?.taskSession || '<taskSession>';
  const area = result.area || result.data?.area || areaFromBranch(result.branch || result.data?.branch) || '<area>';
  const branch = result.branch || result.data?.branch || `task/${area}/<task-slug>`;
  const worktreePath = result.worktreePath || result.data?.worktreePath || '<worktreePath>';
  const workpadPath = workpadPathForBranch(branch, area);

  return {
    workflow: TASK_WORKFLOW_ID,
    stage: 'workpad-bootstrap',
    event: event.event,
    contextInjection: {
      taskSession,
      worktreePath,
      requiredBeforeProductionEdit: 'Before any meaningful production edit, the scoped workpad must contain a Test-first contract and either a focused red test result or a no-test waiver.',
      skillAnchors: [anchors.taskSession, anchors.topLevelSession, anchors.workpad, anchors.testFirst],
    },
    requiredNextAction: resolver.action('workpad.write', {
      taskSession,
      input: {
        path: workpadPath,
        content: buildInitialWorkpadContent({ area, branch, taskSession, worktreePath }),
      },
    }),
    notes: [
      'Place taskSession at the top level of every task-scoped call.',
      'Bootstrap or update the scoped workpad before production edits.',
    ],
  };
}

function handleValidationReady(event, resolver) {
  const state = event.state || {};
  const taskSession = state.taskSession || '<taskSession>';
  const base = state.base || `origin/stream/${state.area || '<area>'}`;
  const noTests = Boolean(state.noTests);

  return {
    workflow: TASK_WORKFLOW_ID,
    stage: 'validation',
    event: event.event,
    orderedActions: [
      resolver.action('diff.inspect', {
        taskSession,
        input: { base, stat: true, files: true, hunks: true, maxBytes: 20000 },
      }),
      resolver.action('validation.review', {
        taskSession,
        input: { base, noTests },
      }),
      resolver.action('validation.verify', {
        taskSession,
        input: { base, noDb: true },
      }),
      resolver.action('task.push', {
        taskSession,
        input: { message: 'type(os): description', changed: true },
      }),
      resolver.action('task.pr', {
        taskSession,
        input: { ready: true },
      }),
    ],
    notes: [
      'Validation must be recorded in the scoped workpad before task.push or task.pr.',
      'task.pr must promote into the stream and return the stream review PR, not only the intermediate task PR.',
      `Changed files: ${(state.changedFiles || []).join(', ') || '<unknown>'}`,
    ],
  };
}

function handleTaskFinishReady(event, resolver) {
  const state = event.state || {};
  const taskSession = state.taskSession || '<taskSession>';

  return {
    workflow: TASK_WORKFLOW_ID,
    stage: 'task-finish',
    event: event.event,
    requiredNextAction: resolver.action('task.finish', {
      taskSession,
      input: {},
    }),
    notes: [
      'Use task.finish only when merge proof and cleanup safety are established.',
    ],
  };
}

function createManifestResolver(manifest) {
  const byRole = new Map();
  for (const entry of manifest) {
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.workflowRole === 'string' && entry.workflowRole) {
      byRole.set(entry.workflowRole, entry);
    }
  }

  return {
    toolFor(capability) {
      return byRole.get(capability) || null;
    },
    action(capability, options = {}) {
      const tool = byRole.get(capability);
      if (tool) {
        return actionFromManifestEntry(capability, tool, options);
      }
      return missingCapabilityAction(capability, byRole, options);
    },
  };
}

function actionFromManifestEntry(capability, tool, options) {
  const action = {
    capability,
    tool: tool.name,
    inputSchema: tool.inputSchema,
    source: 'manifest',
    input: options.input || {},
  };

  if (tool.defaultTimeout !== undefined) {
    action.defaultTimeout = tool.defaultTimeout;
  }

  if (tool.sessionRequired || options.taskSession) {
    action.taskSessionPlacement = 'top-level';
  }

  if (options.taskSession) {
    action.taskSession = options.taskSession;
  }

  if (tool.command) {
    action.command = tool.command;
  }

  return action;
}

function missingCapabilityAction(capability, byRole, options) {
  const searchTool = byRole.get('tool.search');
  if (searchTool) {
    return actionFromManifestEntry('tool.search', searchTool, {
      ...options,
      input: { query: capability },
    });
  }

  return {
    capability: 'tool.search',
    tool: 'tools.search',
    source: 'fallback',
    input: { query: capability },
  };
}

function extractSkillAnchors(skillText) {
  return {
    flow: firstLineContaining(skillText, 'stream.context') || DEFAULT_SKILL_ANCHORS.flow,
    taskSession: firstLineContaining(skillText, 'taskSession') || DEFAULT_SKILL_ANCHORS.taskSession,
    topLevelSession: firstLineContaining(skillText, 'top level') || DEFAULT_SKILL_ANCHORS.topLevelSession,
    workpad: firstLineContaining(skillText, 'task-local scoped workpad') || DEFAULT_SKILL_ANCHORS.workpad,
    testFirst: firstLineContaining(skillText, 'Test-first contract') || DEFAULT_SKILL_ANCHORS.testFirst,
    streamReview: firstLineContaining(skillText, 'stream review PR') || DEFAULT_SKILL_ANCHORS.streamReview,
  };
}

function firstLineContaining(text, needle) {
  if (typeof text !== 'string') return null;
  const line = text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.includes(needle));
  return line || null;
}

function areaFromBranch(branch) {
  if (typeof branch !== 'string') return null;
  const match = branch.match(/^task\/([^/]+)\//);
  return match ? match[1] : null;
}

function slugFromBranch(branch) {
  if (typeof branch !== 'string') return '<task-slug>';
  const match = branch.match(/^task\/[^/]+\/(.+)$/);
  return match ? match[1] : branch.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function workpadPathForBranch(branch, fallbackArea) {
  const area = areaFromBranch(branch) || fallbackArea || '<area>';
  return `.task/${area}/${slugFromBranch(branch)}/workpad.md`;
}

function buildInitialWorkpadContent({ area, branch, taskSession, worktreePath }) {
  return [
    `# ${slugFromBranch(branch)}`,
    '',
    `branch: ${branch}`,
    `area: ${area}`,
    `taskSession: ${taskSession}`,
    `worktree: ${worktreePath}`,
    '',
    '## acceptance criteria',
    '',
    '- [ ] Fill from the user-approved task scope.',
    '',
    '## plan',
    '',
    '- [ ] Inspect stream context and local patterns.',
    '- [ ] Define the Test-first contract before production edits.',
    '',
    '## Test-first contract',
    '',
    'behavior under test: pending',
    'existing local pattern: pending',
    'new or changed tests: pending',
    'focused red command: pending',
    'expected red failure: pending',
    'no-test waiver: not applicable unless explicitly justified',
    '',
  ].join('\n');
}

module.exports = {
  createTaskWorkflowHookRegistry,
};
