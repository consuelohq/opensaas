import './styles.css';

import { createLeadConnectorEmbedApi } from './api-client.js';
import { createLeadConnectorEmbedController } from './controller.js';
import {
  LEAD_CONNECTOR_PARENT_ORIGINS,
  createLeadConnectorParentBridge,
  normalizeClickToCallTarget,
} from './protocol.js';
import { renderLeadConnectorEmbed } from './view.js';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('LeadConnector embed root is missing');

const api = createLeadConnectorEmbedApi({ baseUrl: window.location.origin });
const controller = createLeadConnectorEmbedController({ api });
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

controller.subscribe((state) => {
  root.innerHTML = renderLeadConnectorEmbed(state);
  updateRefresh();
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
  if (action === 'start-single') void controller.startCall('single');
  if (action === 'start-parallel') void controller.startCall('predictive');
  if (action === 'pause') controller.pause();
  if (action === 'resume') controller.resume();
  if (action === 'stop') void controller.stop();
  if (action === 'hang-up') void controller.hangUp();
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
      name: contact?.name ?? null,
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
      name: contact.name,
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
  if (!(form instanceof HTMLFormElement) || form.dataset.form !== 'disposition')
    return;
  event.preventDefault();
  const data = new FormData(form);
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

bridge.start();
bootstrapTimer = setTimeout(failBootstrap, 5000);
bridge.requestUserContext();
window.addEventListener('beforeunload', () => {
  completeBootstrap();
  stopRefresh();
  bridge.stop();
});
