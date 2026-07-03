'use strict';

const fs = require('fs');
const path = require('path');

const { createOsHookDispatcher } = require('./dispatcher.js');

const DEFAULT_MANIFEST_PATH = path.join(__dirname, '..', 'tooling', 'dev-tool-manifest.json');
const DEFAULT_BUNDLES_PATH = path.join(__dirname, '..', 'manifests', 'workflow-bundles.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadIntentManifest(options = {}) {
  if (Array.isArray(options.manifest)) return options.manifest;
  const manifest = readJson(options.manifestPath || DEFAULT_MANIFEST_PATH);
  if (!Array.isArray(manifest)) throw new Error('intent manifest must be an array');
  return manifest;
}

function loadWorkflowBundles(options = {}) {
  if (options.bundles && typeof options.bundles === 'object') return options.bundles;
  const bundles = readJson(options.bundlesPath || DEFAULT_BUNDLES_PATH);
  if (!bundles || bundles.kind !== 'consuelo-os-workflow-bundles' || !Array.isArray(bundles.workflows)) {
    throw new Error('workflow bundles manifest is invalid');
  }
  return bundles;
}

function copyWorkflowBundle(workflow) {
  return {
    id: workflow.id,
    aliases: [...(workflow.aliases || [])],
    roles: [...(workflow.roles || [])],
    categories: [...(workflow.categories || [])],
    subscriptions: (workflow.subscriptions || []).map((subscription) => ({ ...subscription })),
    tools: (workflow.tools || []).map((tool) => ({ ...tool, definition: { ...(tool.definition || {}) } })),
  };
}

function createWorkflowLookup(bundles) {
  const lookup = new Map();
  for (const workflow of bundles.workflows) {
    lookup.set(workflow.id, workflow);
    for (const alias of workflow.aliases || []) {
      lookup.set(alias, workflow);
    }
  }
  return lookup;
}

function sanitizeSlugSegment(value, fallback, maxLength) {
  const sanitized = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const truncated = maxLength ? sanitized.slice(0, maxLength) : sanitized;
  return truncated || fallback;
}

function createGeneratedTaskSession(workflow, input = {}) {
  const slug = sanitizeSlugSegment(input.title || input.area || workflow || 'intent', 'intent', 40);
  if (workflow === 'task') {
    const area = sanitizeSlugSegment(input.area || 'task', 'task');
    return `task/${area}/${slug}`;
  }
  return `tsk_${workflow}_${slug}`;
}

function eventTaskSession(event) {
  return event?.taskSession
    || event?.state?.taskSession
    || event?.result?.taskSession
    || null;
}

function requireTaskSession(input, event) {
  const taskSession = input.taskSession || eventTaskSession(event);
  if (!taskSession) throw new Error('taskSession is required for workflow intent dispatch');
  return taskSession;
}

function initialHookEvent(workflow, input, taskSession) {
  if (workflow.id === 'task') {
    return {
      workflow: 'task',
      event: 'tool.preInvoke',
      tool: 'task.start',
      taskSession,
      state: {
        taskSession,
        area: input.area || '<area>',
        hasStreamContext: input.hasStreamContext === true,
      },
    };
  }

  return {
    workflow: workflow.id,
    event: `workflow.intent.${workflow.id}.detected`,
    taskSession,
    state: {
      taskSession,
      area: input.area,
      title: input.title,
    },
  };
}

function createWorkflowIntentRuntime(options = {}) {
  const manifest = loadIntentManifest(options);
  const bundles = loadWorkflowBundles(options);
  const lookup = createWorkflowLookup(bundles);
  const dispatcher = createOsHookDispatcher({
    manifest,
    skillText: options.skillText || '',
  });
  const sessions = new Map();

  function resolveWorkflow(requestedWorkflow) {
    const requested = requestedWorkflow || 'task';
    const workflow = lookup.get(requested);
    if (!workflow) throw new Error(`unknown workflow: ${requested}`);
    return { requested, workflow };
  }

  function sessionFor(taskSession, workflow, requestedWorkflow, scope = {}) {
    const existing = sessions.get(taskSession);
    if (existing && existing.workflow !== workflow.id) {
      throw new Error(`taskSession ${taskSession} is scoped to ${existing.workflow}, not ${workflow.id}`);
    }
    const session = existing || {
      taskSession,
      workflow: workflow.id,
      requestedWorkflow,
      scope: {},
    };
    session.requestedWorkflow = session.requestedWorkflow || requestedWorkflow;
    session.scope = { ...session.scope, ...scope };
    sessions.set(taskSession, session);
    return session;
  }

  function scopedEventFor(session, event = {}) {
    return {
      ...event,
      workflow: session.workflow,
      taskSession: session.taskSession,
      state: {
        ...(session.scope || {}),
        ...(event.state || {}),
        taskSession: session.taskSession,
      },
      ...(event.result
        ? { result: { ...event.result, taskSession: event.result.taskSession || session.taskSession } }
        : {}),
    };
  }

  function dispatchScoped(session, event) {
    const scopedEvent = scopedEventFor(session, event);
    return {
      action: 'dispatch',
      workflow: session.workflow,
      requestedWorkflow: session.requestedWorkflow,
      taskSession: session.taskSession,
      hookEvent: scopedEvent,
      hookResult: dispatcher.dispatch(scopedEvent),
    };
  }

  function start(input = {}) {
    const { requested, workflow } = resolveWorkflow(input.workflow);
    const taskSession = input.taskSession || createGeneratedTaskSession(workflow.id, input);
    const scope = {
      area: input.area,
      title: input.title,
      branch: input.branch,
      worktreePath: input.worktreePath,
    };
    const session = sessionFor(taskSession, workflow, requested, scope);
    const hookEvent = initialHookEvent(workflow, input, taskSession);
    const dispatched = dispatchScoped(session, hookEvent);

    return {
      action: 'start',
      workflow: workflow.id,
      requestedWorkflow: requested,
      taskSession,
      scope: session.scope,
      manifestBundle: copyWorkflowBundle(workflow),
      hookEvent: dispatched.hookEvent,
      hookResult: dispatched.hookResult,
    };
  }

  function dispatch(input = {}) {
    const event = input.event || {};
    const taskSession = requireTaskSession(input, event);
    const { requested, workflow } = resolveWorkflow(input.workflow || event.workflow);
    const session = sessionFor(taskSession, workflow, requested, input.scope || {});
    return dispatchScoped(session, event);
  }

  function bundleFor(workflowName) {
    const { workflow } = resolveWorkflow(workflowName);
    return copyWorkflowBundle(workflow);
  }

  return {
    start,
    dispatch,
    bundleFor,
    sessions,
  };
}

module.exports = {
  DEFAULT_BUNDLES_PATH,
  DEFAULT_MANIFEST_PATH,
  createWorkflowIntentRuntime,
  loadIntentManifest,
  loadWorkflowBundles,
};
