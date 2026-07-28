'use strict';

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compactTool(tool) {
  const definition = isObject(tool?.definition) ? tool.definition : tool;
  const capabilities = isObject(definition?.capabilities) ? definition.capabilities : {};
  return {
    name: tool?.name || definition?.name || '<tool>',
    category: tool?.category || definition?.category || null,
    workflowRole: tool?.workflowRole || definition?.workflowRole || null,
    readOnly: capabilities.readOnly === true,
    mutating: capabilities.mutating === true,
  };
}

function compactSubscription(subscription) {
  return {
    event: subscription?.event || null,
    workflow: subscription?.workflow || null,
    tool: subscription?.tool || null,
    stage: subscription?.stage || null,
  };
}

function compactManifestBundle(bundle) {
  if (!isObject(bundle)) return null;
  return {
    id: bundle.id || null,
    aliases: Array.isArray(bundle.aliases) ? bundle.aliases : [],
    roles: Array.isArray(bundle.roles) ? bundle.roles : [],
    categories: Array.isArray(bundle.categories) ? bundle.categories : [],
    subscriptions: Array.isArray(bundle.subscriptions)
      ? bundle.subscriptions.map(compactSubscription)
      : [],
    tools: Array.isArray(bundle.tools) ? bundle.tools.map(compactTool) : [],
  };
}

function recommendedTools(hookResult) {
  const names = new Set();
  const collect = (action) => {
    if (!isObject(action)) return;
    if (typeof action.tool === 'string') names.add(action.tool);
    const steps = action.input?.steps;
    if (Array.isArray(steps)) {
      for (const step of steps) {
        if (isObject(step) && typeof step.tool === 'string') names.add(step.tool);
      }
    }
  };

  collect(hookResult?.requiredNextAction);
  collect(hookResult?.suggestedNextAction);
  if (Array.isArray(hookResult?.orderedActions)) {
    for (const action of hookResult.orderedActions) collect(action);
  }
  return [...names];
}

function compactContextInjection(contextInjection) {
  if (!isObject(contextInjection)) return null;
  return {
    taskSession: contextInjection.taskSession || null,
    worktreePath: contextInjection.worktreePath || null,
    requiredBeforeProductionEdit: contextInjection.requiredBeforeProductionEdit || null,
    discoveryGuidance: contextInjection.discoveryGuidance || null,
  };
}

function compactSuggestedAction(action, hookResult) {
  if (!isObject(action)) return null;
  return {
    capability: action.capability || null,
    tool: action.tool || null,
    taskSessionPlacement: action.taskSessionPlacement || null,
    taskSession: action.taskSession || null,
    tools: recommendedTools(hookResult),
  };
}

function compactHookResult(hookResult) {
  if (!isObject(hookResult)) return null;
  return {
    workflow: hookResult.workflow || null,
    stage: hookResult.stage || null,
    event: hookResult.event || null,
    contextInjection: compactContextInjection(hookResult.contextInjection),
    suggestedNextAction: compactSuggestedAction(hookResult.suggestedNextAction, hookResult),
    notes: Array.isArray(hookResult.notes) ? hookResult.notes : [],
  };
}

function compactHookEvent(hookEvent) {
  if (!isObject(hookEvent)) return null;
  const state = isObject(hookEvent.state) ? hookEvent.state : {};
  return {
    workflow: hookEvent.workflow || null,
    event: hookEvent.event || null,
    tool: hookEvent.tool || null,
    taskSession: hookEvent.taskSession || null,
    state: {
      area: state.area || null,
      title: state.title || null,
      branch: state.branch || null,
      worktreePath: state.worktreePath || null,
      taskSession: state.taskSession || hookEvent.taskSession || null,
    },
  };
}

function compactTaskStartOutput(result) {
  return {
    ...result,
    manifestBundle: compactManifestBundle(result?.manifestBundle),
    hookEvent: compactHookEvent(result?.hookEvent),
    hookResult: compactHookResult(result?.hookResult),
  };
}

module.exports = {
  compactHookEvent,
  compactHookResult,
  compactManifestBundle,
  compactTaskStartOutput,
};
