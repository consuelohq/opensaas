import type {
  InboundOperatorEndpoint,
  InboundOperatorState,
} from './inbound-operator.js';
import { inboundPresentation } from './calling-workspace.js';

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
const title = (value: string) =>
  value.replaceAll(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase());
const endpointRow = (
  endpoint: InboundOperatorEndpoint,
  ready: boolean,
): string =>
  `<label class="inbound-endpoint-row"><input type="checkbox" data-field="inbound-endpoint" data-endpoint-id="${escapeHtml(endpoint.endpointId)}" data-endpoint-kind="${endpoint.kind}"${(endpoint.active ?? ready) ? ' checked' : ''}${endpoint.healthy && !ready ? '' : ' disabled'} /><span class="device-icon" aria-hidden="true">${endpoint.kind === 'phone' ? '↗' : '◉'}</span><span><strong>${endpoint.kind === 'phone' ? 'My phone' : 'This browser'}</strong><small>${endpoint.healthy ? (endpoint.kind === 'phone' ? 'Answer on your forwarding phone' : 'Use your microphone and speakers') : 'Unavailable — check your device settings'}</small></span></label>`;

const renderOffers = (state: InboundOperatorState): string =>
  state.offers
    .map((offer) => {
      const eligible = state.rep.endpoints.filter(
        (e) => offer.eligibleEndpoints.includes(e.endpointId) && e.healthy,
      );
      const endpoint =
        eligible.find((e) => e.kind === 'browser') ?? eligible[0];
      return `<article class="inbound-offer" data-assignment-id="${escapeHtml(offer.assignmentId)}"><p class="eyebrow">Incoming call · ${escapeHtml(offer.queueName)}</p><h2>${escapeHtml(offer.callerLabel)}</h2><p>Waiting ${offer.waitingSeconds}s${endpoint?.kind === 'phone' ? ' · Answer your phone and press 1, or accept below.' : ''}</p><div class="button-row"><button type="button" class="button button--primary" data-action="inbound-accept" data-assignment-id="${escapeHtml(offer.assignmentId)}" data-generation="${offer.generation}" data-endpoint-id="${escapeHtml(endpoint?.endpointId ?? '')}"${state.pendingAction || !endpoint ? ' disabled' : ''}>Answer call</button><button type="button" class="button button--secondary" data-action="inbound-decline" data-assignment-id="${escapeHtml(offer.assignmentId)}" data-generation="${offer.generation}"${state.pendingAction ? ' disabled' : ''}>Decline</button></div></article>`;
    })
    .join('');

const renderWrapUp = (state: InboundOperatorState): string => {
  const a = state.rep.assignment;
  if (a?.phase !== 'wrap_up') return '';
  return `<form class="inbound-wrap-up" data-form="inbound-wrap-up" data-assignment-id="${escapeHtml(a.assignmentId)}" data-generation="${a.generation}"><label>Call outcome<select name="disposition"><option value="connected">Connected</option><option value="follow-up">Follow up</option><option value="not-qualified">Not qualified</option></select></label><label>Notes <span class="optional">optional</span><textarea name="note" rows="3" maxlength="2000" placeholder="What should happen next?"></textarea></label><button type="submit" class="button button--primary"${state.pendingAction ? ' disabled' : ''}>Save and finish</button></form>`;
};
export const renderInboundOperatorPanel = (
  state: InboundOperatorState,
): string => {
  const status = inboundPresentation(state);
  const fresh =
    state.phase === 'ready' ||
    (state.phase === 'loading' && state.lastSyncAt !== null);
  const canToggle =
    fresh &&
    !state.pendingAction &&
    !state.rep.assignment &&
    (state.rep.ready || state.rep.endpoints.some((e) => e.healthy));
  const busy = state.rep.assignment !== null || state.offers.length > 0;
  return `<section class="inbound-operator-panel" aria-label="Incoming calls" data-inbound-phase="${state.phase}"${state.rep.assignment ? ` data-assignment-id="${escapeHtml(state.rep.assignment.assignmentId)}"` : ''}>
    <div class="calling-heading"><p class="eyebrow">Consuelo Inbound</p><h1>${status.active ? status.label : 'Be there for the next call.'}</h1><p>${status.detail}</p></div>
    <div class="session-banner" data-status="${status.status}"><span class="session-dot" aria-hidden="true"></span><span data-session-status role="status">${status.label}</span>${status.active ? '<button type="button" class="text-button" data-action="workspace-minimize">Minimize ↘</button>' : ''}</div>
    ${state.error ? `<div class="notice notice--error" role="alert">${escapeHtml(state.error.message)}</div>` : ''}
    ${status.status === 'reconnecting' ? '<div class="recovery-note"><p>Your place is protected while we check the connection.</p><button type="button" class="button button--secondary" data-action="inbound-reconnect">Reconnect</button></div>' : ''}
    ${!state.rep.assignment || state.rep.assignment.phase === 'offering' ? renderOffers(state) : ''}${renderWrapUp(state)}
    ${state.rep.assignment?.phase === 'connected' ? (state.rep.endpoints.find((e) => e.endpointId === state.rep.assignment?.endpointId)?.kind === 'browser' ? '<button type="button" class="button button--danger primary-wide" data-action="inbound-hang-up">End call</button>' : '<p class="form-footnote">End the call on your phone. We’ll show wrap-up here when it finishes.</p>') : ''}
    ${!busy ? `<fieldset class="answering-devices"><legend>Answer calls on</legend>${state.rep.endpoints.map((e) => endpointRow(e, state.rep.ready)).join('') || '<p class="resource-empty">No answering device is set up yet. Ask your administrator to add one.</p>'}</fieldset>` : ''}
    <button type="button" class="button ${state.rep.ready ? 'button--secondary' : 'button--primary'} primary-wide" data-action="inbound-readiness" data-ready="${!state.rep.ready}"${canToggle ? '' : ' disabled'}>${state.pendingAction ? 'Updating…' : state.rep.ready ? 'Stop receiving calls' : 'Start receiving calls'}</button>
    ${!status.active ? '<p class="form-footnote">Incoming calls are routed to you while you’re receiving calls.</p>' : ''}
    <details class="workspace-details" data-disclosure="inbound-queue"><summary>Queue details <span>${state.queue.waitingCount} waiting</span></summary><dl class="detail-list"><div><dt>Queue</dt><dd>${escapeHtml(state.queue.queueName || 'Your team')}</dd></div><div><dt>Longest wait</dt><dd>${state.queue.oldestWaitSeconds}s</dd></div><div><dt>Business hours</dt><dd>${title(state.queue.businessHours)}</dd></div><div><dt>Overflow</dt><dd>${title(state.queue.overflow)}</dd></div><div><dt>Number</dt><dd>${escapeHtml(state.configuration.maskedNumber)}</dd></div></dl></details>
  </section>`;
};
