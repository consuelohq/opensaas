'use strict';

const fs = require('fs');
const path = require('path');

const { createTaskWorkflowHookRegistry } = require('./task/workflow.js');

const DEFAULT_MANIFEST_PATH = path.join(__dirname, '..', 'tooling', 'dev-tool-manifest.json');

const LEGACY_WORKFLOW_ROLE_BY_TOOL = new Map([
  ['stream.context', 'stream.context'],
  ['task.start', 'task.start'],
  ['fs.write', 'workpad.write'],
  ['code.run', 'decision.research'],
  ['code.call', 'test.run'],
  ['git.diff', 'diff.inspect'],
  ['review.run', 'validation.review'],
  ['verify', 'validation.verify'],
  ['task.push', 'task.push'],
  ['task.pr', 'task.pr'],
  ['task.finish', 'task.finish'],
  ['tools.search', 'tool.search'],
]);

function createOsHookDispatcher(options = {}) {
  const manifest = normalizeManifest(loadManifest(options), {
    legacyWorkflowRoleFallback: Boolean(options.legacyWorkflowRoleFallback),
  });
  const taskRegistry = createTaskWorkflowHookRegistry({
    manifest,
    skillText: options.skillText || '',
  });

  return {
    manifest,
    registries: {
      task: taskRegistry,
    },
    dispatch(event) {
      if (!event || typeof event !== 'object') {
        throw new Error('hook event must be an object');
      }

      if (event.workflow === 'task') {
        return taskRegistry.handle(event);
      }

      return null;
    },
  };
}

function dispatchHookEvent(options = {}) {
  const dispatcher = createOsHookDispatcher(options);
  return dispatcher.dispatch(options.event);
}

function loadManifest(options = {}) {
  if (Array.isArray(options.manifest)) {
    return options.manifest;
  }

  const manifestPath = options.manifestPath || DEFAULT_MANIFEST_PATH;
  const manifestText = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestText);

  if (!Array.isArray(manifest)) {
    throw new Error(`tool manifest must be a JSON array: ${manifestPath}`);
  }

  return manifest;
}

function normalizeManifest(manifest, options = {}) {
  const legacyWorkflowRoleFallback = Boolean(options.legacyWorkflowRoleFallback);
  return manifest.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return entry;
    }

    if (entry.workflowRole) {
      return entry;
    }

    if (!legacyWorkflowRoleFallback) {
      return entry;
    }

    const workflowRole = LEGACY_WORKFLOW_ROLE_BY_TOOL.get(entry.name);
    if (!workflowRole) {
      return entry;
    }

    return {
      ...entry,
      workflowRole,
    };
  });
}

function renderHookResult(result) {
  if (result === null || result === undefined) {
    return '# Hook result: none\n';
  }

  const lines = [
    `# Hook result: ${result.workflow || '<workflow>'} / ${result.stage || '<stage>'}`,
    '',
  ];

  if (result.blockedAction) {
    lines.push('## Blocked action');
    pushObjectLines(lines, result.blockedAction);
    lines.push('');
  }

  if (result.contextInjection) {
    lines.push('## Context injection');
    pushObjectLines(lines, result.contextInjection);
    lines.push('');
  }

  if (result.requiredNextAction) {
    lines.push('## Required next action');
    pushActionLines(lines, result.requiredNextAction);
    lines.push('');
  }

  if (Array.isArray(result.orderedActions) && result.orderedActions.length > 0) {
    lines.push('## Ordered actions');
    result.orderedActions.forEach((action, index) => {
      lines.push(`${index + 1}. ${action.capability || '<capability>'}`);
      pushActionLines(lines, action, '   ');
    });
    lines.push('');
  }

  if (Array.isArray(result.notes) && result.notes.length > 0) {
    lines.push('## Notes');
    for (const note of result.notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function pushActionLines(lines, action, prefix = '') {
  lines.push(`${prefix}- capability: ${action.capability || '<capability>'}`);
  lines.push(`${prefix}- tool: ${action.tool || '<tool>'}`);
  if (action.inputSchema) lines.push(`${prefix}- inputSchema: ${action.inputSchema}`);
  if (action.source) lines.push(`${prefix}- source: ${action.source}`);
  if (action.taskSessionPlacement) lines.push(`${prefix}- taskSessionPlacement: ${action.taskSessionPlacement}`);
  if (action.taskSession) lines.push(`${prefix}- taskSession: ${action.taskSession}`);
  if (action.input) lines.push(`${prefix}- input: ${JSON.stringify(action.input)}`);
}

function pushObjectLines(lines, object, prefix = '- ') {
  for (const [key, value] of Object.entries(object)) {
    lines.push(`${prefix}${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
  }
}

module.exports = {
  DEFAULT_MANIFEST_PATH,
  createOsHookDispatcher,
  dispatchHookEvent,
  normalizeManifest,
  renderHookResult,
};
