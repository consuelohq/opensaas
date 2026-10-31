import { createLeadConnectorEmbedApi } from './api-client.js';
import { createLeadConnectorInboundOperatorApi } from './inbound-operator.js';
import { createLeadConnectorAgentVoice } from './agent-voice.js';
import { resolveLeadConnectorContactName } from './contact-label.js';
import { createLeadConnectorEmbedController } from './controller.js';
import { createCombobox } from './combobox.js';
import { createLeadConnectorIdleRefreshScheduler } from './idle-refresh.js';
import {
  LEAD_CONNECTOR_PARENT_ORIGINS,
  createLeadConnectorParentBridge,
  normalizeClickToCallTarget,
} from './protocol.js';
import { resolveLeadConnectorSurface } from './surface.js';
import {
  sessionPresentation,
  activeCallingMode,
  type CallingWorkspace,
} from './calling-workspace.js';
import {
  replaceWorkspace,
  createInteractionRenderer,
} from './workspace-dom.js';
import type { WorkspaceLaunch } from './workspace-launch.js';
import { readScriptFile } from './coaching-scripts.js';
import { renderLeadConnectorEmbed } from './view.js';

import { normalizeAsyncError } from '../errors/normalize-async-error';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('LeadConnector embed root is missing');

const resolvedSurface = resolveLeadConnectorSurface(window.location.pathname);
if (resolvedSurface === 'customer')
  throw new Error('Customer entry must use the isolated public bootstrap');
const surface = resolvedSurface;
document.body.dataset.surface = surface;

const api = createLeadConnectorEmbedApi({ baseUrl: window.location.origin });
const inboundOperatorApi = createLeadConnectorInboundOperatorApi({
  baseUrl: window.location.origin,
});
const voice = createLeadConnectorAgentVoice({ getToken: api.getVoiceToken });
const controller = createLeadConnectorEmbedController({
  api,
  voice,
  surface,
  inboundOperatorApi,
  inboundObserver: surface === 'admin',
});
let workspace: CallingWorkspace = {
  screen: 'calling',
  mode: surface === 'admin' ? 'inbound' : 'outbound',
  compact: false,
};
try {
  const saved = localStorage.getItem('consuelo-calling-theme');
  if (saved === 'light' || saved === 'dark') workspace.theme = saved;
} catch {
  /* Embedded storage can be unavailable. */
}
let focusPageAfterPaint = false;
let managementError: string | null = null;
let pendingLaunch: WorkspaceLaunch | null = null;
const consumedLaunches = new Set<string>();
const applyLaunch = async (): Promise<void> => {
  try {
    const launch = pendingLaunch;
    const state = controller.getState();
    if (!launch || !state.sessionToken || state.phase === 'authenticating')
      return;
    pendingLaunch = null;
    if (consumedLaunches.has(launch.id)) {
      bridge.acknowledgeLaunch(launch.id);
      return;
    }
    consumedLaunches.add(launch.id);
    bridge.acknowledgeLaunch(launch.id); // Accepted locally; never replay an uncertain external effect.
    workspace = {
      ...workspace,
      screen: 'calling',
      mode: activeCallingMode(state) ?? launch.mode,
      compact: false,
    };
    render();
    if (launch.action === 'open') return;
    if (launch.action === 'inbound-readiness') {
      await controller.loadInboundOperator();
      if (!controller.getState().inboundOperator.rep.assignment)
        await controller.setInboundReadiness({
          ready: launch.ready === true,
          endpoints: launch.endpoints ?? [],
        });
    } else if (launch.action === 'inbound-hang-up')
      await controller.endInboundCall();
    else if (launch.action === 'inbound-reconnect')
      await controller.reconnectInbound();
    else if (
      launch.action === 'inbound-accept' &&
      launch.assignmentId &&
      launch.endpointId &&
      launch.generation !== undefined
    )
      await controller.acceptInboundOffer({
        assignmentId: launch.assignmentId,
        endpointId: launch.endpointId,
        generation: launch.generation,
      });
    else if (
      launch.action === 'inbound-decline' &&
      launch.assignmentId &&
      launch.generation !== undefined
    )
      await controller.declineInboundOffer({
        assignmentId: launch.assignmentId,
        generation: launch.generation,
        reason: 'rep_declined',
      });
    else if (launch.action === 'start-configured' && launch.setup) {
      if (
        sessionPresentation(controller.getState(), 'outbound').active ||
        controller.getState().inboundOperator.rep.assignment !== null
      )
        return;
      controller.updateSetup(launch.setup);
      if (launch.queue) await controller.selectQueue(launch.queue);
      else {
        for (const target of controller.getState().selectedTargets)
          controller.removeTarget(target.dedupeKey);
        for (const target of launch.targets ?? [])
          controller.selectTarget(target);
      }
      await controller.startConfiguredCall();
    }
  } catch (error: unknown) {
    managementError =
      error instanceof Error
        ? error.message
        : 'The calling window could not complete that action. Check your call status before retrying.';
    render();
  }
};

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let inboundRefreshTimer: ReturnType<typeof setInterval> | null = null;
let inboundHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
let bootstrapTimer: ReturnType<typeof setTimeout> | null = null;

const failBootstrap = (): void => {
  if (bootstrapTimer) clearTimeout(bootstrapTimer);
  bootstrapTimer = null;
  controller.fail({
    code: 'EMBED_PARENT_UNAVAILABLE',
    message: 'Open the dialer from the LeadConnector custom menu to reconnect.',
    recoverable: true,
  });
};

const completeBootstrap = (): void => {
  if (bootstrapTimer) clearTimeout(bootstrapTimer);
  bootstrapTimer = null;
};

const parentOrigin = (() => {
  try {
    const origin = document.referrer ? new URL(document.referrer).origin : '';
    return LEAD_CONNECTOR_PARENT_ORIGINS.includes(
      origin as (typeof LEAD_CONNECTOR_PARENT_ORIGINS)[number],
    )
      ? origin
      : undefined;
  } catch (_error: unknown) {
    return undefined;
  }
})();

const bridge = createLeadConnectorParentBridge(window, {
  allowedOrigins: LEAD_CONNECTOR_PARENT_ORIGINS,
  parentOrigin,
  onMessage: (message) => {
    if (message.type === 'workspace-presentation') {
      if (surface !== 'overlay') return;
      workspace.compact = message.compact;
      render();
      return;
    }
    if (message.type === 'workspace-launch') {
      if (surface !== 'overlay') return;
      pendingLaunch = message.launch;
      void applyLaunch();
      return;
    }
    if (message.type === 'bootstrap') {
      completeBootstrap();
      void controller.authenticate(message.encryptedData).then(() => {
        const phase = controller.getState().phase;
        if (phase === 'ready' || phase === 'target-selected') {
          bridge.sendReady();
          void applyLaunch();
        }
      });
      return;
    }
    if (message.type === 'handshake') {
      completeBootstrap();
      void controller.authenticate(message.bootstrapToken).then(() => {
        const phase = controller.getState().phase;
        if (phase === 'ready' || phase === 'target-selected') {
          bridge.sendReady();
          void applyLaunch();
        }
      });
      return;
    }
    workspace = {
      ...workspace,
      screen: 'calling',
      mode: 'outbound',
      compact: false,
    };
    controller.updateSetup({
      mode: 'single',
      callingMode: 'single',
      requestedFanout: 1,
    });
    for (const target of controller.getState().selectedTargets)
      controller.removeTarget(target.dedupeKey);
    controller.selectTarget(message.target);
    if (message.autoDial) void controller.startCall('single');
  },
  onProtocolError: failBootstrap,
});

const stopRefresh = (): void => {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
};

const updateRefresh = (): void => {
  const state = controller.getState();
  const active = [
    'starting',
    'dialing',
    'ringing',
    'connected',
    'paused',
  ].includes(state.phase);
  if (active && !refreshTimer) {
    refreshTimer = setInterval(() => void controller.refreshSession(), 1200);
  } else if (!active) {
    stopRefresh();
  }
  if (surface === 'overlay') {
    const inbound = sessionPresentation(state, 'inbound');
    const outbound = sessionPresentation(state, 'outbound');
    const mode =
      activeCallingMode(state) ?? (inbound.active ? 'inbound' : 'outbound');
    const current = mode === 'inbound' ? inbound : outbound;
    bridge.sendWorkspaceStatus({
      active: inbound.active || outbound.active,
      mode,
      status: current.status,
    });
  }
  if (state.activeSessionId && state.phase === 'completed') {
    bridge.sendCompleted(state.activeSessionId);
  }
  if (state.sessionToken && !inboundRefreshTimer) {
    inboundRefreshTimer = setInterval(
      () => void controller.loadInboundOperator(),
      5000,
    );
  }
  if (!state.sessionToken && inboundRefreshTimer) {
    clearInterval(inboundRefreshTimer);
    inboundRefreshTimer = null;
  }
  // Keep this timer independent of stopRefresh(), which runs on idle redraws.
  if (surface === 'overlay' && state.sessionToken && !inboundHeartbeatTimer) {
    inboundHeartbeatTimer = setInterval(() => {
      const operator = controller.getState().inboundOperator;
      if (operator.rep.ready && !operator.pendingAction) {
        void controller.heartbeatInbound();
      }
    }, 30_000);
  }
  if ((!state.sessionToken || surface !== 'overlay') && inboundHeartbeatTimer) {
    clearInterval(inboundHeartbeatTimer);
    inboundHeartbeatTimer = null;
  }
};

const mountComboboxes = (): void => {
  for (const comboboxRoot of root.querySelectorAll<HTMLElement>(
    '[data-combobox-field]',
  )) {
    const field = comboboxRoot.dataset.comboboxField;
    const options = [
      ...comboboxRoot.querySelectorAll<HTMLElement>('[role="option"]'),
    ].map((option) => ({
      value: option.dataset.comboboxValue ?? '',
      label: option.textContent?.trim() ?? '',
    }));
    createCombobox({
      root: comboboxRoot,
      options,
      value: comboboxRoot.dataset.comboboxValue || null,
      activeValue: comboboxRoot.dataset.activeValue,
      onChange: (value) => {
        if (field === 'queue') {
          const [pipelineId, stageId] = value.split(':');
          if (pipelineId && stageId) {
            void controller.selectQueue({ pipelineId, stageId });
          }
        }
        if (field === 'caller-id') {
          controller.updateSetup({ callerIdNumber: value || null });
        }
        if (field === 'calling-mode') {
          controller.updateSetup({
            callingMode: value === 'single' ? 'single' : 'predictive',
          });
        }
        if (field === 'line-count') {
          const requestedFanout = Number(value);
          if (
            requestedFanout === 1 ||
            requestedFanout === 2 ||
            requestedFanout === 3
          ) {
            controller.updateSetup({ requestedFanout });
          }
        }
      },
    });
  }
};

const paint = (): void => {
  const state = controller.getState();
  const callMode = activeCallingMode(state);
  if (callMode) workspace.mode = callMode;
  if (state.inboundOperator.offers.length) workspace.screen = 'calling';
  document.documentElement.dataset.theme = workspace.theme ?? 'system';
  replaceWorkspace(
    root,
    renderLeadConnectorEmbed(state, { surface, workspace }),
  );
  if (managementError && !workspace.compact) {
    const notice = document.createElement('p');
    notice.className = 'notice notice--error';
    notice.setAttribute('role', 'alert');
    notice.textContent = managementError;
    root.querySelector('.workspace-content')?.prepend(notice);
  }
  mountComboboxes();
  if (focusPageAfterPaint) {
    root
      .querySelector<HTMLElement>('#workspace-page-title')
      ?.focus({ preventScroll: true });
    focusPageAfterPaint = false;
  }
  updateRefresh();
};
const interactionRenderer = createInteractionRenderer(root, paint);
const render = interactionRenderer.render;
controller.subscribe(render);

const openHostedBilling = async (
  operation: () => Promise<string | null>,
): Promise<void> => {
  try {
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    const url = await operation();
    if (!url) {
      popup?.close();
      return;
    }
    if (popup) popup.location.href = url;
    else {
      const notice = document.createElement('p');
      notice.className = 'notice';
      notice.setAttribute('role', 'status');
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Open secure billing in a new tab';
      notice.append(link);
      root.append(notice);
    }
  } catch (cause: unknown) {
    throw normalizeAsyncError(cause);
  }
};

const loadScripts = async (): Promise<void> => {
  if (!controller.getState().sessionToken) return;
  try {
    workspace.coachingLibrary = await api.listCoachingScripts();
    managementError = null;
  } catch (error: unknown) {
    managementError =
      error instanceof Error
        ? error.message
        : 'Your script library is unavailable. Please try again.';
  }
  render();
};

const currentBillingQuantities = () => {
  const dashboard = controller.getState().commercialDashboard;
  const quantities = { single: 0, standard: 0, power: 0, additionalNumber: 0 };
  for (const seat of dashboard?.seats ?? []) {
    const code = String(seat.plan_code ?? seat.planCode ?? '');
    if (code === 'single' || code === 'standard' || code === 'power') {
      quantities[code] += 1;
    }
  }
  if (quantities.single + quantities.standard + quantities.power === 0) {
    quantities.single = 1;
  }
  return quantities;
};

const billingQuantitiesFromFormData = (data: FormData) => ({
  single: Number(data.get('single') ?? 0),
  standard: Number(data.get('standard') ?? 0),
  power: Number(data.get('power') ?? 0),
  additionalNumber: Number(data.get('additionalNumber') ?? 0),
});

const readElement = (target: EventTarget | null): HTMLElement | null =>
  target instanceof Element
    ? target.closest<HTMLElement>('[data-action]')
    : null;

root.addEventListener('click', (event) => {
  const actionElement = readElement(event.target);
  const action = actionElement?.dataset.action;
  if (
    !actionElement ||
    !action ||
    (actionElement instanceof HTMLButtonElement && actionElement.disabled)
  )
    return;
  if (action.startsWith('workspace-')) {
    if (action === 'workspace-minimize' || action === 'workspace-expand') {
      if (surface === 'admin')
        bridge.openWorkspace({
          id: crypto.randomUUID(),
          mode: workspace.mode,
          action: 'open',
        });
      else bridge.requestPresentation(action === 'workspace-minimize');
      return;
    }
    workspace.compact = false;
    focusPageAfterPaint = true;
    managementError = null;
    if (action === 'workspace-inbound' || action === 'workspace-outbound') {
      workspace.screen = 'calling';
      workspace.mode = action === 'workspace-inbound' ? 'inbound' : 'outbound';
    }
    if (action === 'workspace-theme') {
      const theme = actionElement.dataset.themeValue;
      if (theme === 'system' || theme === 'light' || theme === 'dark') {
        workspace.theme = theme;
        try {
          localStorage.setItem('consuelo-calling-theme', theme);
        } catch {}
      }
      render();
      return;
    }
    const page = action.slice('workspace-'.length);
    if (
      [
        'settings',
        'team',
        'numbers',
        'billing',
        'appearance',
        'mercury',
      ].includes(page)
    )
      workspace.screen = page as CallingWorkspace['screen'];
    if (
      [
        'workspace-settings',
        'workspace-team',
        'workspace-numbers',
        'workspace-billing',
      ].includes(action)
    ) {
      managementError = null;
      void controller.loadAdministration().then((error) => {
        managementError = error;
        render();
      });
    }
    if (action === 'workspace-history') workspace.screen = 'history';
    if (action === 'workspace-mercury') {
      workspace.scriptId = undefined;
      workspace.scriptDraft = undefined;
      void loadScripts();
    }
    if (action === 'workspace-calling') workspace.screen = 'calling';
    render();
    return;
  }
  if (
    surface === 'admin' &&
    [
      'inbound-readiness',
      'inbound-accept',
      'inbound-decline',
      'inbound-reconnect',
      'inbound-hang-up',
      'start-configured',
      'start-single',
      'start-parallel',
    ].includes(action)
  ) {
    const state = controller.getState();
    const launch: WorkspaceLaunch = {
      id: crypto.randomUUID(),
      mode: action.startsWith('inbound-') ? 'inbound' : 'outbound',
      action: action.startsWith('start-')
        ? 'start-configured'
        : (action as WorkspaceLaunch['action']),
    };
    if (action === 'inbound-readiness') {
      launch.ready = actionElement.dataset.ready === 'true';
      launch.endpoints = [
        ...root.querySelectorAll<HTMLInputElement>(
          '[data-field="inbound-endpoint"]',
        ),
      ]
        .filter(
          (e) =>
            (e.checked && !e.disabled) ||
            (e.checked && state.inboundOperator.rep.ready),
        )
        .map((e) => ({
          endpointId: e.dataset.endpointId!,
          kind: e.dataset.endpointKind === 'phone' ? 'phone' : 'browser',
        }));
    }
    if (action === 'inbound-accept' || action === 'inbound-decline') {
      launch.assignmentId = actionElement.dataset.assignmentId;
      launch.generation = Number(actionElement.dataset.generation);
      launch.endpointId = actionElement.dataset.endpointId;
    }
    if (launch.action === 'start-configured') {
      launch.setup = state.setup;
      launch.targets = state.selectedTargets.slice(0, 3);
      if (state.selectedQueue)
        launch.queue = {
          pipelineId: state.selectedQueue.pipelineId,
          stageId: state.selectedQueue.stageId,
        };
    }
    bridge.openWorkspace(launch);
    return;
  }
  if (action === 'script-new') {
    if (workspace.scriptSaving) return;
    workspace.scriptId = undefined;
    workspace.scriptDraft = {
      id: crypto.randomUUID(),
      title: '',
      content: '',
      expectedRevision: 0,
    };
    render();
    return;
  }
  if (action === 'script-open' || action === 'script-edit') {
    if (workspace.scriptSaving) return;
    const script = workspace.coachingLibrary?.scripts.find(
      (s) => s.id === actionElement.dataset.scriptId,
    );
    if (script) {
      workspace.scriptId = script.id;
      workspace.scriptDraft =
        action === 'script-edit' && script.canEdit
          ? {
              id: script.id,
              title: script.title,
              content: script.content,
              expectedRevision: script.revision,
            }
          : undefined;
      render();
    }
    return;
  }
  if (action === 'script-cancel') {
    workspace.scriptDraft = undefined;
    render();
    return;
  }
  if (action === 'retry') {
    controller.retry();
    bootstrapTimer = setTimeout(failBootstrap, 5000);
    bridge.requestUserContext();
  }
  if (action === 'setup-queue') {
    controller.updateSetup({ mode: 'queue', callingMode: 'predictive' });
  }
  if (action === 'setup-single') {
    controller.updateSetup({
      mode: 'single',
      callingMode: 'single',
      requestedFanout: 1,
    });
  }
  if (action === 'refresh' || action === 'refresh-resources') {
    void controller.refreshResources();
  }
  if (action === 'return-home') controller.returnHome();
  if (action === 'start-configured') void controller.startConfiguredCall();
  if (action === 'select-single-number') {
    const field = root.querySelector<HTMLInputElement>(
      '[data-field="single-phone"]',
    );
    const target = field
      ? normalizeClickToCallTarget({ phone: field.value })
      : null;
    if (target) {
      for (const previous of controller.getState().selectedTargets)
        controller.removeTarget(previous.dedupeKey);
      controller.selectTarget(target);
    }
  }
  if (action === 'start-single') void controller.startCall('single');
  if (action === 'start-parallel') void controller.startCall('predictive');
  if (action === 'pause') controller.pause();
  if (action === 'resume') controller.resume();
  if (action === 'stop') void controller.stop();
  if (action === 'hang-up') void controller.hangUp();
  if (action === 'complete-transfer') void controller.completeTransfer();
  if (action === 'cancel-transfer') void controller.cancelTransfer();
  if (action === 'apply-billing-change') {
    const preview = controller.getState().commercialBillingPreview;
    if (preview) {
      void controller.applyBillingChange({
        quantities: preview.quantities,
        prorationDate: preview.prorationDate,
      });
    }
  }
  if (action === 'cancel-billing-preview') {
    controller.clearBillingPreview();
  }
  if (
    action === 'manage-billing' ||
    action === 'manage-number-billing' ||
    action === 'buy-minute-pack'
  ) {
    const hasSubscription = Boolean(
      controller.getState().commercialDashboard?.subscription,
    );
    void openHostedBilling(() =>
      hasSubscription
        ? controller.openBillingPortal(
            action === 'manage-number-billing'
              ? 'numbers'
              : action === 'buy-minute-pack'
                ? 'minutes'
                : 'base',
          )
        : controller.createCheckout(currentBillingQuantities()),
    );
  }
  if (action === 'select-call' && actionElement.dataset.callId) {
    workspace.screen = 'call-detail';
    render();
    void controller.selectCall(actionElement.dataset.callId);
  }
  if (action === 'load-more-history') {
    void controller.loadMoreCallHistory();
  }
  if (action === 'inbound-hang-up') void controller.endInboundCall();
  if (action === 'inbound-reconnect') {
    void controller.reconnectInbound();
  }
  if (action === 'inbound-readiness') {
    const endpoints = [
      ...root.querySelectorAll<HTMLInputElement>(
        '[data-field="inbound-endpoint"]',
      ),
    ]
      .filter(
        (endpoint) =>
          endpoint.checked &&
          endpoint.dataset.endpointId &&
          endpoint.dataset.endpointKind,
      )
      .map((endpoint) => ({
        endpointId: endpoint.dataset.endpointId!,
        kind:
          endpoint.dataset.endpointKind === 'phone'
            ? ('phone' as const)
            : ('browser' as const),
      }));
    void controller.setInboundReadiness({
      ready: actionElement.dataset.ready === 'true',
      endpoints,
    });
  }
  if (action === 'inbound-accept') {
    const assignmentId = actionElement.dataset.assignmentId;
    const endpointId = actionElement.dataset.endpointId;
    const generation = Number(actionElement.dataset.generation);
    if (assignmentId && endpointId && Number.isSafeInteger(generation)) {
      void controller.acceptInboundOffer({
        assignmentId,
        generation,
        endpointId,
      });
    }
  }
  if (action === 'inbound-decline') {
    const assignmentId = actionElement.dataset.assignmentId;
    const generation = Number(actionElement.dataset.generation);
    if (assignmentId && Number.isSafeInteger(generation)) {
      void controller.declineInboundOffer({
        assignmentId,
        generation,
        reason: 'rep_declined',
      });
    }
  }
  if (
    action === 'request-release-number' &&
    actionElement.dataset.phoneNumber
  ) {
    const dialog = document.createElement('dialog');
    dialog.className = 'workspace-dialog';
    const title = document.createElement('h2');
    title.textContent = 'Remove this number?';
    const description = document.createElement('p');
    description.textContent =
      'This number will stop receiving calls for your workspace. This cannot be undone.';
    const cancel = document.createElement('button');
    cancel.className = 'button button--secondary';
    cancel.textContent = 'Keep number';
    cancel.onclick = () => dialog.close();
    const confirm = document.createElement('button');
    confirm.className = 'button button--danger';
    confirm.textContent = 'Remove number';
    confirm.onclick = () => {
      dialog.close();
      void controller.releaseNumber(actionElement.dataset.phoneNumber!);
    };
    dialog.append(title, description, cancel, confirm);
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
    return;
  }
  if (action === 'release-number' && actionElement.dataset.phoneNumber) {
    void controller.releaseNumber(actionElement.dataset.phoneNumber);
  }
  if (action === 'provision-number' && actionElement.dataset.phoneNumber) {
    const userId = controller.getState().commercialNumberTargetUserId;
    if (userId) {
      void controller.provisionNumber({
        userId,
        phoneNumber: actionElement.dataset.phoneNumber,
      });
    }
  }
  if (action === 'remove-target' && actionElement.dataset.dedupeKey) {
    controller.removeTarget(actionElement.dataset.dedupeKey);
  }
  if (action === 'select-contact') {
    const contactId = actionElement.dataset.contactId;
    const phone = actionElement.dataset.phone;
    const contact = controller
      .getState()
      .contacts.find((item) => item.id === contactId);
    if (!contactId || !phone) return;
    const target = normalizeClickToCallTarget({
      phone,
      contactId,
      name: contact ? resolveLeadConnectorContactName(contact) : null,
    });
    if (target) {
      for (const previous of controller.getState().selectedTargets)
        controller.removeTarget(previous.dedupeKey);
      controller.selectTarget(target);
    }
  }
  if (action === 'select-opportunity') {
    const opportunityId = actionElement.dataset.opportunityId;
    const opportunity = controller
      .getState()
      .opportunities.find((item) => item.id === opportunityId);
    const contact = controller
      .getState()
      .contacts.find((item) => item.id === opportunity?.contactId);
    if (!opportunity || !contact?.phone) return;
    const target = normalizeClickToCallTarget({
      phone: contact.phone,
      contactId: contact.id,
      name: resolveLeadConnectorContactName(contact),
      opportunityId: opportunity.id,
    });
    if (target) {
      for (const previous of controller.getState().selectedTargets)
        controller.removeTarget(previous.dedupeKey);
      controller.selectTarget(target);
    }
  }
});

root.addEventListener('change', (event) => {
  const target = event.target;
  if (
    !(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)
  )
    return;
  if (target.dataset.field === 'inbound-endpoint') {
    workspace.answeringEndpointIds = [
      ...root.querySelectorAll<HTMLInputElement>(
        '[data-field="inbound-endpoint"]',
      ),
    ]
      .filter((e) => e.checked && !e.disabled)
      .map((e) => e.dataset.endpointId!);
  }
  if (
    target.dataset.field === 'script-file' &&
    target instanceof HTMLInputElement &&
    target.files?.[0]
  ) {
    const draft = workspace.scriptDraft;
    if (draft)
      void readScriptFile(target.files[0])
        .then((imported) => {
          if (workspace.scriptDraft === draft) {
            Object.assign(draft, imported);
            managementError = null;
            render();
          }
        })
        .catch((error) => {
          managementError =
            error instanceof Error
              ? error.message
              : 'Script could not be imported.';
          render();
        });
  }
  if (target.dataset.field === 'queue') {
    const [pipelineId, stageId] = target.value.split(':');
    if (pipelineId && stageId) {
      void controller.selectQueue({ pipelineId, stageId });
    }
  }
  if (target.dataset.field === 'calling-mode') {
    controller.updateSetup({
      callingMode: target.value === 'single' ? 'single' : 'predictive',
    });
  }
  if (target.dataset.field === 'line-count') {
    const requestedFanout = Number(target.value);
    if (
      requestedFanout === 1 ||
      requestedFanout === 2 ||
      requestedFanout === 3
    ) {
      controller.updateSetup({ requestedFanout });
    }
  }
  if (
    target.dataset.field === 'local-presence' &&
    target instanceof HTMLInputElement
  ) {
    controller.updateSetup({ preferLocalPresence: target.checked });
  }
  if (target.dataset.field === 'caller-id') {
    controller.updateSetup({ callerIdNumber: target.value || null });
  }
  if (target.dataset.field === 'pipeline') {
    void controller.searchOpportunities({
      query: controller.getState().filters.query,
      pipelineId: target.value || null,
      stageId: null,
    });
  }
  if (target.dataset.field === 'stage') {
    void controller.searchOpportunities({
      query: controller.getState().filters.query,
      pipelineId: controller.getState().filters.pipelineId,
      stageId: target.value || null,
    });
  }
});

let searchTimer: ReturnType<typeof setTimeout> | null = null;
root.addEventListener('input', (event) => {
  const target = event.target;
  if (
    workspace.scriptDraft &&
    target instanceof HTMLInputElement &&
    target.name === 'title'
  )
    workspace.scriptDraft.title = target.value;
  if (
    workspace.scriptDraft &&
    target instanceof HTMLTextAreaElement &&
    target.name === 'content'
  )
    workspace.scriptDraft.content = target.value;
  if (
    !(target instanceof HTMLInputElement) ||
    target.dataset.field !== 'search'
  )
    return;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void Promise.all([
      controller.searchContacts(target.value),
      controller.searchOpportunities({
        query: target.value,
        pipelineId: controller.getState().filters.pipelineId,
        stageId: controller.getState().filters.stageId,
      }),
    ]);
  }, 250);
});

root.addEventListener('submit', (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  const data = new FormData(form);
  if (
    form.dataset.form === 'coaching-script' &&
    workspace.scriptDraft &&
    !workspace.scriptSaving
  ) {
    const draft = {
      ...workspace.scriptDraft,
      title: String(data.get('title') ?? ''),
      content: String(data.get('content') ?? ''),
    };
    workspace.scriptSaving = true;
    managementError = null;
    render();
    void api
      .saveCoachingScript(draft)
      .then((saved) => {
        if (workspace.scriptDraft?.id === draft.id) {
          workspace.scriptId = saved.id;
          workspace.scriptDraft = undefined;
        }
        return loadScripts();
      })
      .catch((error) => {
        managementError =
          error instanceof Error ? error.message : 'Script could not be saved.';
      })
      .finally(() => {
        workspace.scriptSaving = false;
        render();
      });
    return;
  }
  if (form.dataset.form === 'commercial-seat') {
    void controller.saveSeat({
      userId: String(data.get('userId') ?? '').trim(),
      planCode: String(data.get('planCode') ?? 'single') as
        | 'single'
        | 'standard'
        | 'power',
    });
    return;
  }
  if (form.dataset.form === 'transfer') {
    const to = String(data.get('to') ?? '').trim();
    const type = data.get('type') === 'cold' ? 'cold' : 'warm';
    void controller.initiateTransfer({ type, to });
    return;
  }
  if (form.dataset.form === 'commercial-purchase-claim') {
    const code = String(data.get('setupCode') ?? '').trim();
    const field = form.querySelector<HTMLInputElement>(
      'input[name="setupCode"]',
    );
    if (field) field.value = '';
    managementError = null;
    void controller.claimPurchase(code).then(async (error) => {
      try {
        managementError = error;
        if (!error) managementError = await controller.loadAdministration();
        render();
      } catch (cause: unknown) {
        managementError =
          cause instanceof Error
            ? cause.message
            : 'Billing settings could not be refreshed.';
        render();
      }
    });
    return;
  }
  if (form.dataset.form === 'commercial-billing-checkout') {
    const quantities = billingQuantitiesFromFormData(data);
    void openHostedBilling(() => controller.createCheckout(quantities));
    return;
  }
  if (form.dataset.form === 'commercial-billing-change') {
    const quantities = billingQuantitiesFromFormData(data);
    void controller.previewBillingChange(quantities);
    return;
  }
  if (form.dataset.form === 'commercial-number-search') {
    const query = String(data.get('query') ?? '').trim();
    const userId = String(data.get('userId') ?? '').trim();
    if (query && userId) {
      void controller.searchNumbers({
        ...(/^\d{3}$/.test(query) ? { areaCode: query } : { contains: query }),
        userId,
      });
    }
    return;
  }
  if (form.dataset.form === 'inbound-wrap-up') {
    const assignmentId = form.dataset.assignmentId;
    const generation = Number(form.dataset.generation);
    if (assignmentId && Number.isSafeInteger(generation)) {
      void controller.finishInboundWrapUp({
        assignmentId,
        generation,
        disposition: String(data.get('disposition') ?? 'connected'),
        note: String(data.get('note') ?? '').trim() || undefined,
      });
    }
    return;
  }
  if (form.dataset.form === 'inbound-configuration') {
    void controller.updateInboundConfiguration({
      ...controller.getState().inboundOperator.configuration,
      numberLabel: String(data.get('numberLabel') ?? '').trim(),
      teamName: String(data.get('teamName') ?? '').trim(),
      hoursLabel: String(data.get('hoursLabel') ?? '').trim(),
      overflowLabel: String(data.get('overflowLabel') ?? '').trim(),
    });
    return;
  }
  if (form.dataset.form !== 'disposition') return;
  const tags = String(data.get('tags') ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  void controller.submitDisposition({
    disposition: String(data.get('disposition') ?? 'connected'),
    note: String(data.get('note') ?? '').trim() || undefined,
    tags: tags.length > 0 ? tags : undefined,
  });
});

const refreshIdleResources = (): void => {
  void Promise.all([
    controller.refreshResources(),
    controller.loadCommercial(),
  ]);
};

const idleRefreshScheduler = createLeadConnectorIdleRefreshScheduler({
  windowTarget: window,
  documentTarget: document,
  refresh: refreshIdleResources,
});
idleRefreshScheduler.start();

bridge.start();
bootstrapTimer = setTimeout(failBootstrap, 5000);
bridge.requestUserContext();
window.addEventListener('beforeunload', () => {
  completeBootstrap();
  stopRefresh();
  if (inboundRefreshTimer) clearInterval(inboundRefreshTimer);
  if (inboundHeartbeatTimer) clearInterval(inboundHeartbeatTimer);
  idleRefreshScheduler.stop();
  interactionRenderer.dispose();
  voice.disconnect();
  bridge.stop();
});
