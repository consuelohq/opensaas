import type {
  InboundOperatorEndpoint,
  InboundOperatorState,
} from './inbound-operator.js';

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const phaseLabel = (phase: string): string =>
  phase.replaceAll('_', ' ').replace(/^./, (value) => value.toUpperCase());

const endpointRow = (
  endpoint: InboundOperatorEndpoint,
  ready: boolean,
): string =>
  '<label class="inbound-endpoint-row">' +
  '<input type="checkbox" data-field="inbound-endpoint" data-endpoint-id="' +
  escapeHtml(endpoint.endpointId) +
  '" data-endpoint-kind="' +
  escapeHtml(endpoint.kind) +
  '"' +
  (endpoint.active ?? ready ? ' checked' : '') +
  (endpoint.healthy ? '' : ' disabled') +
  ' />' +
  '<span><strong>' +
  escapeHtml(endpoint.label) +
  '</strong><small>' +
  (endpoint.healthy ? 'Healthy' : 'Device unavailable') +
  '</small></span></label>';

const assignmentStatus = (state: InboundOperatorState): string => {
  const assignment = state.rep.assignment;
  if (!assignment) return 'No active assignment';
  if (assignment.phase === 'connecting' && assignment.externalStarted) {
    return 'Connecting — media status is pending provider confirmation';
  }
  if (assignment.phase === 'unknown') {
    return 'Connection outcome unknown — state is protected while it reconciles';
  }
  if (assignment.phase === 'connected') return 'Connected';
  if (assignment.phase === 'wrap_up') return 'Wrap-up required';
  return phaseLabel(assignment.phase);
};

const renderOffers = (state: InboundOperatorState): string => {
  if (state.offers.length === 0) {
    return '<p class="resource-empty">No inbound offers are waiting for this rep.</p>';
  }
  return state.offers
    .map((offer) => {
      const eligible = state.rep.endpoints.filter(
        (candidate) =>
          offer.eligibleEndpoints.includes(candidate.endpointId) &&
          candidate.healthy,
      );
      const endpoint =
        eligible.find((candidate) => candidate.kind === 'browser') ?? eligible[0];
      const disabled = Boolean(state.pendingAction) || !endpoint;
      return (
        '<article class="inbound-offer" data-assignment-id="' +
        escapeHtml(offer.assignmentId) +
        '">' +
        '<div><p class="eyebrow">' +
        escapeHtml(offer.queueName) +
        '</p><h3>' +
        escapeHtml(offer.callerLabel) +
        '</h3><span>Waiting ' +
        escapeHtml(offer.waitingSeconds) +
        's · offer generation ' +
        escapeHtml(offer.generation) +
        '</span></div>' +
        '<div class="button-row"><button type="button" class="button button--primary" data-action="inbound-accept" data-assignment-id="' +
        escapeHtml(offer.assignmentId) +
        '" data-generation="' +
        escapeHtml(offer.generation) +
        '" data-endpoint-id="' +
        escapeHtml(endpoint?.endpointId ?? '') +
        '"' +
        (disabled ? ' disabled' : '') +
        '>Accept</button><button type="button" class="button button--secondary" data-action="inbound-decline" data-assignment-id="' +
        escapeHtml(offer.assignmentId) +
        '" data-generation="' +
        escapeHtml(offer.generation) +
        '"' +
        (disabled ? ' disabled' : '') +
        '>Decline</button></div>' +
        '</article>'
      );
    })
    .join('');
};

const renderWrapUp = (state: InboundOperatorState): string => {
  const assignment = state.rep.assignment;
  if (!assignment || assignment.phase !== 'wrap_up') return '';
  return (
    '<form class="inbound-wrap-up" data-form="inbound-wrap-up" data-assignment-id="' +
    escapeHtml(assignment.assignmentId) +
    '" data-generation="' +
    escapeHtml(assignment.generation) +
    '"><h3>Wrap up this inbound call</h3><label>Disposition<select name="disposition"><option value="connected">Connected</option><option value="follow-up">Follow-up</option><option value="not-qualified">Not qualified</option></select></label><label>Notes<textarea name="note" rows="3" maxlength="2000"></textarea></label><button type="submit" class="button button--primary">Complete wrap-up</button></form>'
  );
};

export const renderInboundOperatorPanel = (
  state: InboundOperatorState,
): string => {
  const readyLabel = state.rep.ready
    ? 'Ready for inbound'
    : 'Away from inbound';
  const canToggle = !state.pendingAction && !state.rep.assignment;
  const hoursLabel = phaseLabel(state.queue.businessHours);
  const overflowLabel = phaseLabel(state.queue.overflow);
  const recovery =
    state.phase === 'reconnecting' ||
    state.rep.assignment?.phase === 'unknown' ||
    (state.rep.assignment?.phase === 'connecting' &&
      state.rep.assignment.externalStarted);
  return (
    '<section class="inbound-operator-panel" aria-label="Inbound operator" data-inbound-phase="' +
    escapeHtml(state.phase) +
    '"><header class="panel-heading"><div><p class="eyebrow">Rep workspace</p><h2>Inbound operator</h2><p class="lede">Authority-backed readiness, offers, and queue state.</p></div><span class="status-pill">' +
    escapeHtml(readyLabel) +
    '</span></header>' +
    (state.error
      ? '<div class="notice notice--error" role="alert"><strong>' +
        escapeHtml(state.error.message) +
        '</strong><span>' +
        escapeHtml(state.error.code) +
        '</span></div>'
      : '') +
    (recovery
      ? '<div class="notice notice--warning" role="status"><strong>Recovering inbound state</strong><span>Reconnect to refresh authoritative assignment and media status.</span><button type="button" class="button button--secondary" data-action="inbound-reconnect">Reconnect state</button></div>'
      : '') +
    '<div class="inbound-operator-grid"><article class="operator-panel inbound-readiness"><header class="panel-heading"><div><p class="eyebrow">Rep readiness</p><h3>' +
    escapeHtml(assignmentStatus(state)) +
    '</h3></div><span>' +
    escapeHtml(phaseLabel(state.rep.presence)) +
    '</span></header><div class="inbound-endpoint-list">' +
    state.rep.endpoints
      .map((endpoint) => endpointRow(endpoint, state.rep.ready))
      .join('') +
    '</div><div class="button-row"><button type="button" class="button button--primary" data-action="inbound-readiness" data-ready="' +
    (state.rep.ready ? 'false' : 'true') +
    '"' +
    (canToggle ? '' : ' disabled') +
    '>' +
    (state.rep.ready ? 'Go away' : 'Go ready') +
    '</button></div></article>' +
    '<article class="operator-panel inbound-offers"><header class="panel-heading"><div><p class="eyebrow">Authority offers</p><h3>Incoming calls</h3></div><span>' +
    escapeHtml(state.offers.length) +
    '</span></header>' +
    renderOffers(state) +
    renderWrapUp(state) +
    '</article>' +
    '<article class="operator-panel inbound-queue"><header class="panel-heading"><div><p class="eyebrow">Queue visibility</p><h3>Waiting callers</h3></div><span>' +
    escapeHtml(state.queue.queueName) +
    '</span></header><dl class="detail-list"><div><dt>Waiting now</dt><dd>' +
    escapeHtml(state.queue.waitingCount) +
    '</dd></div><div><dt>Oldest wait</dt><dd>' +
    escapeHtml(state.queue.oldestWaitSeconds) +
    's</dd></div><div><dt>Serviceable</dt><dd>' +
    escapeHtml(state.queue.serviceableCount) +
    '</dd></div><div><dt>Hours</dt><dd>' +
    escapeHtml(hoursLabel) +
    '</dd></div><div><dt>Overflow</dt><dd>' +
    escapeHtml(overflowLabel) +
    '</dd></div></dl></article>' +
    '<article class="operator-panel inbound-configuration"><header class="panel-heading"><div><p class="eyebrow">Inbound configuration</p><h3>' +
    escapeHtml(state.configuration.numberLabel) +
    '</h3></div><span>' +
    escapeHtml(state.configuration.maskedNumber) +
    '</span></header><dl class="detail-list"><div><dt>Team</dt><dd>' +
    escapeHtml(state.configuration.teamName) +
    '</dd></div><div><dt>Hours</dt><dd>' +
    escapeHtml(state.configuration.hoursLabel) +
    '</dd></div><div><dt>Fallback</dt><dd>' +
    escapeHtml(state.configuration.overflowLabel) +
    '</dd></div></dl><p class="resource-empty">Inbound configuration is managed by the server.</p></article></div></section>'
  );
};
