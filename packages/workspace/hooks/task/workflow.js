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
  topLevelSession: 'Pass taskSession at the top level of every task-scoped workspace.call.',
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
  const area = state.area || '<area>';
  const title = state.title || '<task title>';

  return {
    workflow: TASK_WORKFLOW_ID,
    stage: 'task-start-guidance',
    event: event.event,
    advisory: {
      suggestedNextTool: 'stream.context',
      reason: 'Next tool call should usually be stream.context if fresh stream context has not already been gathered for this area.',
      skipWhen: 'If stream.context was already run recently in this conversation, call task.start directly with an explicit startFrom value.',
    },
    examples: [
      {
        label: 'fresh stream context first, then start from stream',
        orderedActions: [
          resolver.action('stream.context', { input: { area } }),
          resolver.action('task.start', { input: { area, title, startFrom: 'stream' } }),
        ],
      },
      {
        label: 'already have stream context; start from main',
        orderedActions: [
          resolver.action('task.start', { input: { area, title, startFrom: 'main' } }),
        ],
      },
      {
        label: 'already have stream context; start from stream',
        orderedActions: [
          resolver.action('task.start', { input: { area, title, startFrom: 'stream' } }),
        ],
      },
    ],
    notes: [
      'This hook is advisory only; it must not block task.start because prior stream.context calls are not tracked before task intent starts.',
      'Use startFrom exactly as "main" or "stream". Do not pass a branch name to startFrom.',
      'Use stream only to override the target stream branch when the default stream/<area> is wrong.',
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
    stage: 'post-task-start-guidance',
    event: event.event,
    contextInjection: {
      taskSession,
      worktreePath,
      requiredBeforeProductionEdit: 'Before any meaningful production edit, record a task-shaped discovery batch, then add a Test-first contract and either a focused red test result or a no-test waiver.',
      skillAnchors: [anchors.taskSession, anchors.topLevelSession, anchors.workpad, anchors.testFirst],
      discoveryGuidance: 'Batch the workpad update with direct explore plus Bun/Python code.call read-mode probes.',
    },
    suggestedNextAction: resolver.action('tool.batch', {
      taskSession,
      input: {
        steps: buildDiscoveryBatchSteps({ area, workpadPath }),
      },
    }),
    notes: [
      'Place taskSession at the top level of every task-scoped call.',
      'task.start already creates task metadata and the initial workpad; this hook is advisory next-step guidance.',
      'Run a batch that updates the workpad and gathers direct explore plus Bun/Python code.call discovery evidence before production edits.',
    ],
  };
}

function handleValidationReady(event, resolver) {
  const state = event.state || {};
  const taskSession = state.taskSession || '<taskSession>';
  const base = state.base || `origin/stream/${state.area || '<area>'}`;
  const noTests = Boolean(state.noTests);
  const changedFiles = Array.isArray(state.changedFiles) ? state.changedFiles : [];

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
        input: { message: 'type(workspace-agents): description', changed: true },
      }),
      resolver.action('task.pr', {
        taskSession,
        input: { ready: true },
      }),
    ],
    notes: [
      'Validation must be recorded in the scoped workpad before task.push or task.pr.',
      'task.pr must promote into the stream and return the stream review PR, not only the intermediate task PR.',
      `Changed files: ${changedFiles.join(', ') || '<unknown>'}`,
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

function buildDiscoveryBatchSteps({ area, workpadPath }) {
  const query = area === 'os' ? 'OS intent hooks' : `${area} intent hooks`;
  const root = area === 'os' ? 'packages/os' : 'packages/workspace';
  const workpadCode = `const path = ${JSON.stringify(workpadPath)};
const section = ['','## discovery','', '- direct explore query: ${query}', '- Bun structured repo scanner: pending', '- Python targeted file/snippet ownership read: pending', '- Python local diagnostic: pending', '- Bun exact CLI reproduction: pending', ''].join('\n');
await Bun.write(path, section, { append: true });
process.stdout.write(JSON.stringify({ ok: true, path, section: 'discovery' }, null, 2) + '\n');`;
  const bunScannerCode = `const fs = await import('node:fs');
const path = await import('node:path');
const root = ${JSON.stringify(root)};
const needles = ['task.intent', 'task-intent', 'intent.start', 'workflowRole', 'batch', 'code.call'];
const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.turbo', 'coverage', '.cache']);
const results = [];
let scanned = 0;
function visit(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(ent.name)) continue;
    const file = path.join(dir, ent.name);
    if (ent.isDirectory()) { visit(file); continue; }
    if (!/\.(js|ts|json|md)$/.test(ent.name)) continue;
    scanned++;
    let text = '';
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const found = needles.filter((needle) => text.includes(needle));
    if (!found.length) continue;
    results.push({ file, found });
  }
}
visit(root);
process.stdout.write(JSON.stringify({ ok: true, label: 'Bun structured repo scanner', root, scanned, results: results.slice(0, 20) }, null, 2) + '\n');`;
  const pythonTargetedCode = `from pathlib import Path
import json
files = [Path(${JSON.stringify(`${root}/hooks/task/workflow.js`)}), Path(${JSON.stringify(`${root}/tests/workflow-intent.test.ts`)}), Path(${JSON.stringify(`${root}/manifests/manifest.config.json`)})]
terms = ['task.intent', 'task-intent', 'intent.start', 'batch', 'code.call']
report = []
for file in files:
    if not file.exists():
        report.append({'file': str(file), 'exists': False})
        continue
    hits = []
    for index, line in enumerate(file.read_text(errors='ignore').splitlines(), 1):
        if any(term in line for term in terms):
            hits.append({'line': index, 'text': line.strip()[:220]})
            if len(hits) >= 20:
                break
    report.append({'file': str(file), 'exists': True, 'hits': hits})
print(json.dumps({'ok': True, 'label': 'Python targeted file/snippet ownership read', 'report': report}, indent=2))`;
  const pythonDiagnosticCode = `from pathlib import Path
import json
paths = [Path(${JSON.stringify(`${root}/manifests/core${area === 'os' ? '.manifest' : '-manifest'}.json`)}), Path(${JSON.stringify(`${root}/src/generated/workspace.d.ts`)})]
report = []
for path in paths:
    text = path.read_text(errors='ignore') if path.exists() else ''
    report.append({'file': str(path), 'exists': path.exists(), 'has_task_intent': 'task.intent' in text or 'intent:' in text})
print(json.dumps({'ok': True, 'label': 'Python local diagnostic', 'report': report}, indent=2))`;
  const exactReproductionCode = `const proc = Bun.spawnSync({ cmd: ['bun', 'run', 'explore', '--', ${JSON.stringify(query)}, '--budget', '8', '--json'], stdout: 'pipe', stderr: 'pipe' });
const stdout = new TextDecoder().decode(proc.stdout);
const stderr = new TextDecoder().decode(proc.stderr);
let parsed = null;
try { parsed = JSON.parse(stdout); } catch {}
process.stdout.write(JSON.stringify({ ok: proc.exitCode === 0, label: 'Bun exact CLI reproduction', command: ${JSON.stringify(`bun run explore -- ${query} --budget 8 --json`)}, resultCount: parsed?.data?.results?.length ?? parsed?.results?.length ?? null, stderrTail: stderr.slice(-1000) }, null, 2) + '\n');
process.exit(proc.exitCode ?? 1);`;
  return [
    { tool: 'code.call', input: { language: 'bun', mode: 'edit', code: workpadCode } },
    { tool: 'explore', input: { query, limit: 8 } },
    { tool: 'code.call', input: { language: 'bun', mode: 'read', code: bunScannerCode } },
    { tool: 'code.call', input: { language: 'python', mode: 'read', code: pythonTargetedCode } },
    { tool: 'code.call', input: { language: 'python', mode: 'read', code: pythonDiagnosticCode } },
    { tool: 'code.call', input: { language: 'bun', mode: 'read', code: exactReproductionCode } },
  ];
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
    '## discovery packet',
    '',
    'Run a just-in-time discovery batch before production edits. Prefer direct explore plus task-shaped code.call probes:',
    '',
    '- [ ] direct explore query for likely implementation paths',
    '- [ ] Bun structured repo scanner for broad file/symbol discovery',
    '- [ ] Python targeted file/snippet ownership read for likely implementation files',
    '- [ ] Python or Bun diagnostic for local state, schema, traces, config, or cache when relevant',
    '- [ ] Bun exact CLI reproduction when behavior depends on command output',
    '- [ ] workpad update batched with discovery findings',
    '',
    'Example batch shape: workpad edit + explore + Bun/read scanner + Python/read targeted packet + Python/read diagnostic + Bun/read exact reproduction.',
    '',
    '## plan',
    '',
    '- [ ] Run and record a task-shaped batch discovery packet.',
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
