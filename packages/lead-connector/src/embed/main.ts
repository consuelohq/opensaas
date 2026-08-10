import './styles.css';

import { createLeadConnectorEmbedApi } from './api-client.js';
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
import { renderLeadConnectorEmbed } from './view.js';

import { normalizeAsyncError } from '../errors/normalize-async-error';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('LeadConnector embed root is missing');

const surface = resolveLeadConnectorSurface(window.location.pathname);
document.body.dataset.surface = surface;

const api = createLeadConnectorEmbedApi({ baseUrl: window.location.origin });
const voice = createLeadConnectorAgentVoice({ getToken: api.getVoiceToken });
const controller = createLeadConnectorEmbedController({ api, voice, surface });
let refreshTimer: ReturnType<typeof setInterval> | null = null;
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
    if (message.type === 'bootstrap') {
      completeBootstrap();
      void controller.authenticate(message.encryptedData).then(() => {
        const phase = controller.getState().phase;
        if (phase === 'ready' || phase === 'target-selected') {
          bridge.sendReady();
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
        }
      });
      return;
    }
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
  if (state.activeSessionId && active) bridge.sendBusy(state.activeSessionId);
  if (state.activeSessionId && state.phase === 'completed') {
    bridge.sendCompleted(state.activeSessionId);
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

controller.subscribe((state) => {
  root.innerHTML = renderLeadConnectorEmbed(state, { surface });
  mountComboboxes();
  updateRefresh();
});

const openHostedBilling = async (operation: () => Promise<string | null>): Promise<void> => {
  try {
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    const url = await operation();
    if (!url) {
      popup?.close();
      return;
    }
    if (popup) popup.location.href = url;
    else window.location.assign(url);
  } catch (cause: unknown) {
    throw normalizeAsyncError(cause);
  }
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
  target instanceof HTMLElement
    ? target.closest<HTMLElement>('[data-action]')
    : null;

root.addEventListener('click', (event) => {
  const actionElement = readElement(event.target);
  const action = actionElement?.dataset.action;
  if (!actionElement || !action) return;
  if (action === 'retry') {
    controller.retry();
    bootstrapTimer = setTimeout(failBootstrap, 5000);
    bridge.requestUserContext();
  }
  if (action === 'setup-queue') {
    controller.updateSetup({ mode: 'queue', callingMode: 'predictive' });
  }
  if (action === 'setup-single') {
    controller.updateSetup({ mode: 'single', callingMode: 'single', requestedFanout: 1 });
  }
  if (action === 'refresh' || action === 'refresh-resources') {
    void controller.refreshResources();
  }
  if (action === 'return-home') controller.returnHome();
  if (action === 'start-configured') void controller.startConfiguredCall();
  if (action === 'select-single-number') {
    const field = root.querySelector<HTMLInputElement>('[data-field="single-phone"]');
    const target = field
      ? normalizeClickToCallTarget({ phone: field.value })
      : null;
    if (target) controller.selectTarget(target);
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
  if (action === 'manage-billing') {
    const hasSubscription = controller.getState().commercialDashboard?.subscription !== null;
    void openHostedBilling(() =>
      hasSubscription
        ? controller.openBillingPortal()
        : controller.createCheckout(currentBillingQuantities()),
    );
  }
  if (action === 'select-call' && actionElement.dataset.callId) {
    void controller.selectCall(actionElement.dataset.callId);
  }
  if (action === 'load-more-history') {
    void controller.loadMoreCallHistory();
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
    if (target) controller.selectTarget(target);
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
    if (target) controller.selectTarget(target);
  }
});

root.addEventListener('change', (event) => {
  const target = event.target;
  if (
    !(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)
  )
    return;
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
    if (requestedFanout === 1 || requestedFanout === 2 || requestedFanout === 3) {
      controller.updateSetup({ requestedFanout });
    }
  }
  if (target.dataset.field === 'local-presence' && target instanceof HTMLInputElement) {
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
        ...( /^\d{3}$/.test(query) ? { areaCode: query } : { contains: query }),
        userId,
      });
    }
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
  void Promise.all([controller.refreshResources(), controller.loadCommercial()]);
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
  idleRefreshScheduler.stop();
  voice.disconnect();
  bridge.stop();
});
