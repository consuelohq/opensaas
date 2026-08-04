import type { LeadConnectorContact } from '../contracts/index.js';
import { resolveLeadConnectorContactName } from './contact-label.js';
import type { LeadConnectorSurface } from './surface.js';
import type { LeadConnectorEmbedState } from './state-machine.js';

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const maskPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 4 ? `••• ••• ${digits.slice(-4)}` : 'Private number';
};

const phaseLabel = (phase: string): string =>
  phase.replaceAll(/[-_]/g, ' ').replace(/^./, (value) => value.toUpperCase());

const targetLabel = (
  target: LeadConnectorEmbedState['selectedTargets'][number] | undefined,
): string =>
  escapeHtml(
    target?.name ??
      target?.contactId ??
      (target ? maskPhone(target.phone) : 'Contact'),
  );

const contactLabel = (contact: LeadConnectorContact): string =>
  escapeHtml(resolveLeadConnectorContactName(contact) ?? 'Unnamed contact');

const renderError = (state: LeadConnectorEmbedState): string =>
  state.error
    ? `<section class="notice notice--error" role="alert">
        <div><strong>${escapeHtml(state.error.message)}</strong><span>${
          state.error.recoverable
            ? 'Retry the secure session without leaving this page.'
            : 'This session cannot continue.'
        }</span></div>
        ${
          state.error.recoverable
            ? '<button type="button" class="button button--secondary" data-action="retry">Retry</button>'
            : ''
        }
      </section>`
    : '';

const renderSelectedTargets = (state: LeadConnectorEmbedState): string =>
  state.selectedTargets
    .map(
      (target) => `<div class="target-row">
        <div><strong>${targetLabel(target)}</strong><span>${maskPhone(target.phone)}</span></div>
        <button type="button" class="icon-button" data-action="remove-target" data-dedupe-key="${escapeHtml(target.dedupeKey)}" aria-label="Remove ${targetLabel(target)}">×</button>
      </div>`,
    )
    .join('');

const renderCallProgress = (state: LeadConnectorEmbedState): string => {
  const legs = state.callLegs.length
    ? state.callLegs
    : state.selectedTargets.map((target, position) => ({
        callSid: target.dedupeKey,
        customerNumber: target.phone,
        contactId: target.contactId ?? undefined,
        position,
        status: state.phase === 'ringing' ? 'ringing' : 'dialing',
        role: 'active' as const,
      }));
  return legs
    .map((leg) => {
      const target = state.selectedTargets.find(
        (candidate) =>
          candidate.contactId && candidate.contactId === leg.contactId,
      );
      return `<div class="progress-row">
        <span class="progress-dot" aria-hidden="true"></span>
        <div><strong>${targetLabel(target)}</strong><span>${maskPhone(leg.customerNumber)}</span></div>
        <span class="phase-label">${escapeHtml(phaseLabel(leg.status))}</span>
      </div>`;
    })
    .join('');
};

const renderContactRows = (
  state: LeadConnectorEmbedState,
  limit: number,
): string => {
  const contacts = state.contacts
    .filter((contact) => Boolean(contact.phone))
    .slice(0, limit);
  if (contacts.length === 0) {
    return '<p class="resource-empty">No callable contacts match this view.</p>';
  }
  return contacts
    .map(
      (
        contact,
      ) => `<button type="button" class="resource-row" data-action="select-contact" data-contact-id="${escapeHtml(contact.id)}" data-phone="${escapeHtml(contact.phone)}">
        <span class="resource-row__identity"><strong>${contactLabel(contact)}</strong><small>${maskPhone(contact.phone ?? '')}${contact.email ? ` · ${escapeHtml(contact.email)}` : ''}</small></span>
        <span class="resource-row__action">Call</span>
      </button>`,
    )
    .join('');
};

const renderQueueOptions = (state: LeadConnectorEmbedState): string =>
  state.pipelines
    .map(
      (pipeline) => `<optgroup label="${escapeHtml(pipeline.name)}">${pipeline.stages
        .map((stage) => {
          const selected =
            state.selectedQueue?.pipelineId === pipeline.id &&
            state.selectedQueue.stageId === stage.id;
          return `<option value="${escapeHtml(`${pipeline.id}:${stage.id}`)}"${selected ? ' selected' : ''}>${escapeHtml(stage.name)}</option>`;
        })
        .join('')}</optgroup>`,
    )
    .join('');

const renderQueueSummary = (state: LeadConnectorEmbedState): string => {
  const queue = state.selectedQueue;
  if (!queue) {
    return '<p class="setup-hint">Choose a LeadConnector pipeline stage. Each stage is treated as one predictive calling list.</p>';
  }
  return `<div class="queue-summary">
    <div><span>${escapeHtml(queue.pipelineName)}</span><strong>${escapeHtml(queue.stageName)}</strong></div>
    <div><span>${queue.opportunityTotal} opportunities</span><strong>${queue.callableTotal} callable</strong></div>
  </div>`;
};

const renderCallSetup = (
  state: LeadConnectorEmbedState,
  surface: 'admin' | 'overlay',
): string => {
  const queueMode = state.setup.mode === 'queue';
  const canStart =
    state.sessionToken !== null &&
    state.selectedTargets.length > 0 &&
    (queueMode ? state.selectedQueue !== null : true);
  return `<section class="call-setup call-setup--${surface}" aria-label="Call setup">
    <div class="setup-heading">
      <div><p class="eyebrow">Call setup</p><h2>Who do you want to call?</h2><p>Choose a list or dial a single number.</p></div>
      <button type="button" class="icon-button refresh-button" data-action="refresh-resources" aria-label="Refresh CRM data">${state.resourcesRefreshing ? '↻' : '↻'}</button>
    </div>
    <div class="setup-tabs" role="tablist" aria-label="Call target mode">
      <button type="button" role="tab" aria-selected="${queueMode}" class="setup-tab${queueMode ? ' is-active' : ''}" data-action="setup-queue">Choose list</button>
      <button type="button" role="tab" aria-selected="${!queueMode}" class="setup-tab${!queueMode ? ' is-active' : ''}" data-action="setup-single">Single dial</button>
    </div>
    <div class="setup-fields">
      ${
        queueMode
          ? `<label class="setup-field setup-field--wide"><span>Choose list</span><select data-field="queue"><option value="">— Select a pipeline stage —</option>${renderQueueOptions(state)}</select></label>${renderQueueSummary(state)}`
          : `<div class="single-dial-panel">
              <label class="setup-field setup-field--wide"><span>Phone number</span><div class="input-action"><input type="tel" data-field="single-phone" placeholder="(555) 555-0123" autocomplete="tel" /><button type="button" class="button button--secondary" data-action="select-single-number">Use number</button></div></label>
              <label class="setup-field setup-field--wide"><span>Find a contact</span><input type="search" data-field="search" value="${escapeHtml(state.filters.query)}" placeholder="Name, email, or phone" autocomplete="off" /></label>
              <div class="single-contact-list">${renderContactRows(state, surface === 'overlay' ? 4 : 8)}</div>
            </div>`
      }
      <label class="setup-field setup-field--wide"><span>Call from</span><select data-field="caller-id"><option value="">Automatic caller ID</option></select></label>
      <label class="check-field"><input type="checkbox" data-field="local-presence"${state.setup.preferLocalPresence ? ' checked' : ''} /><span>Prefer local presence calling</span></label>
      ${
        queueMode
          ? `<label class="setup-field setup-field--wide"><span>Calling mode</span><select data-field="calling-mode"><option value="predictive"${state.setup.callingMode === 'predictive' ? ' selected' : ''}>Predictive Dialer (recommended)</option><option value="single"${state.setup.callingMode === 'single' ? ' selected' : ''}>Single (one call at a time)</option></select></label>
             <label class="setup-field setup-field--wide"><span>Number of lines</span><select data-field="line-count"${state.setup.callingMode === 'single' ? ' disabled' : ''}><option value="1"${state.setup.requestedFanout === 1 ? ' selected' : ''}>One</option><option value="2"${state.setup.requestedFanout === 2 ? ' selected' : ''}>Two</option><option value="3"${state.setup.requestedFanout === 3 ? ' selected' : ''}>Three</option></select></label>`
          : ''
      }
    </div>
    <div class="setup-actions">
      <button type="button" class="button button--secondary" data-action="refresh-resources">Refresh CRM</button>
      <button type="button" class="button button--primary" data-action="start-configured"${canStart ? '' : ' disabled'}>${queueMode && state.selectedQueue ? `Call ${escapeHtml(state.selectedQueue.stageName)}` : queueMode ? 'Start Dialer' : 'Call now'}</button>
    </div>
  </section>`;
};

const renderWrapUp = (state: LeadConnectorEmbedState): string => {
  const winner = state.callLegs.find((leg) => leg.role === 'winner');
  const target = state.selectedTargets.find(
    (candidate) =>
      candidate.contactId && candidate.contactId === winner?.contactId,
  );
  if (!winner) {
    return `<section class="overlay-stage overlay-stage--wrap-up">
      <div class="stage-heading"><p class="eyebrow">Batch complete</p><h1>No human answer</h1><p>The attempt outcomes were saved. Return to the setup to continue this list or choose another one.</p></div>
      <button type="button" class="button button--primary" data-action="return-home">Return to dialer</button>
    </section>`;
  }
  return `<section class="overlay-stage overlay-stage--wrap-up">
      <div class="stage-heading"><p class="eyebrow">Wrap-up</p><h1>Call complete</h1><p>${targetLabel(target ?? state.selectedTargets[0])}</p></div>
      <form class="wrap-up-form" data-form="disposition">
        <label>Outcome<select name="disposition"><option value="connected">Connected</option><option value="no-answer">No answer</option><option value="voicemail">Voicemail</option><option value="follow-up">Follow up</option></select></label>
        <label>Note<textarea name="note" rows="3" placeholder="Add a short follow-up note"></textarea></label>
        <details><summary>More details</summary><label>Tags<input name="tags" placeholder="called, follow-up" /></label></details>
        <div class="primary-actions"><button type="button" class="button button--secondary" data-action="return-home">Skip disposition</button><button type="submit" class="button button--primary" data-action="submit-disposition">Save and close</button></div>
      </form>
    </section>`;
};

const renderOverlayStage = (state: LeadConnectorEmbedState): string => {
  if (state.phase === 'failed') return renderError(state);
  if (['booting', 'authenticating'].includes(state.phase)) {
    return `<section class="overlay-stage overlay-stage--loading"><span class="spinner" aria-hidden="true"></span><div><p class="eyebrow">Secure session</p><h1>Connecting…</h1><p>Loading the current location and operator context.</p></div></section>`;
  }
  if (state.phase === 'ready') {
    return renderCallSetup(state, 'overlay');
  }
  if (state.phase === 'target-selected') {
    const count = state.selectedTargets.length;
    return `<section class="overlay-stage">
      <div class="stage-heading"><p class="eyebrow">${count > 1 ? 'Multiline setup' : 'Selected contact'}</p><h1>${count > 1 ? `${count} people selected` : targetLabel(state.selectedTargets[0])}</h1><p>${count > 1 ? 'Each line begins muted until one human answer wins.' : maskPhone(state.selectedTargets[0]?.phone ?? '')}</p></div>
      <div class="target-list">${renderSelectedTargets(state)}</div>
      <div class="primary-actions">${
        count > 1
          ? '<button type="button" class="button button--primary" data-action="start-parallel">Start multiline call</button>'
          : '<button type="button" class="button button--primary" data-action="start-single">Call now</button>'
      }</div>
    </section>`;
  }
  if (state.phase === 'starting') {
    const count = Math.max(state.selectedTargets.length, 1);
    return `<section class="overlay-stage overlay-stage--active"><span class="spinner" aria-hidden="true"></span><div class="stage-heading"><p class="eyebrow">Starting</p><h1>Preparing ${count} ${count === 1 ? 'line' : 'lines'}…</h1><p>Checking caller-ID capacity and creating the call session.</p></div><button type="button" class="button button--secondary" data-action="stop">Cancel</button></section>`;
  }
  if (['dialing', 'ringing'].includes(state.phase)) {
    const count = Math.max(
      state.callLegs.length,
      state.selectedTargets.length,
      1,
    );
    return `<section class="overlay-stage"><div class="stage-heading"><p class="eyebrow">Live call</p><h1>Calling ${count} ${count === 1 ? 'person' : 'people'}</h1><p>Waiting for a human answer.</p></div><div class="progress-list">${renderCallProgress(state)}</div><button type="button" class="button button--danger" data-action="stop">Stop all</button></section>`;
  }
  if (state.phase === 'connected') {
    const winner = state.callLegs.find((leg) => leg.role === 'winner');
    const target = state.selectedTargets.find(
      (candidate) =>
        candidate.contactId && candidate.contactId === winner?.contactId,
    );
    const loserCount = state.callLegs.filter(
      (leg) => leg.role === 'loser',
    ).length;
    return `<section class="overlay-stage overlay-stage--connected"><div class="connection-badge">Connected</div><div class="winner-card"><p class="eyebrow">Winner</p><h1>${targetLabel(target ?? state.selectedTargets[0])}</h1><p>${winner ? maskPhone(winner.customerNumber) : 'Private number'}</p></div>${loserCount ? `<p class="loser-summary">${loserCount} other ${loserCount === 1 ? 'line' : 'lines'} ended</p>` : ''}<button type="button" class="button button--danger" data-action="hang-up">Hang up</button></section>`;
  }
  if (state.phase === 'paused') {
    return `<section class="overlay-stage"><div class="stage-heading"><p class="eyebrow">Queue paused</p><h1>Calling is paused</h1><p>The active queue is preserved.</p></div><div class="split-actions"><button type="button" class="button button--primary" data-action="resume">Resume</button><button type="button" class="button button--secondary" data-action="stop">Stop queue</button></div></section>`;
  }
  if (state.phase === 'wrapping-up') return renderWrapUp(state);
  return `<section class="overlay-stage overlay-stage--complete"><div class="success-mark" aria-hidden="true">✓</div><div><p class="eyebrow">Saved</p><h1>Updated in LeadConnector</h1><p>The call outcome is complete.</p></div></section>`;
};

const transcriptLabel = (
  status: LeadConnectorEmbedState['callHistory'][number]['transcriptStatus'],
): string => (status ? `Transcript ${status}` : 'Transcript unavailable');

const callIdentity = (
  call: LeadConnectorEmbedState['callHistory'][number],
): string =>
  escapeHtml(
    call.contactName ??
      call.contactId ??
      (call.queueId ? `Queue ${call.queueId}` : null) ??
      call.representative ??
      'Call session',
  );

const maskProviderId = (value: string): string =>
  value.length > 6 ? `••••${value.slice(-6)}` : 'Provider call';

const formatEventTime = (value: string): string => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? `${new Date(timestamp).toISOString().slice(0, 16).replace('T', ' ')} UTC`
    : 'Unknown time';
};

const renderAdminCallCard = (
  call: LeadConnectorEmbedState['callHistory'][number],
  active: boolean,
): string => {
  const attemptCount = call.calls.length;
  const duration = active
    ? `${call.elapsedSeconds ?? 0}s elapsed`
    : call.durationSeconds != null
      ? `${call.durationSeconds}s`
      : 'Duration unavailable';
  const startedTime = call.startedAt?.slice(11, 16);
  const winner = call.calls.find((attempt) => attempt.role === 'winner');
  return `<button type="button" class="call-card${active ? ' call-card--active' : ''}" data-action="select-call" data-call-id="${escapeHtml(call.id)}" data-call-session="${escapeHtml(call.id)}">
    <span class="call-card__identity"><strong>${callIdentity(call)}</strong><small>${escapeHtml(call.representative ?? 'Representative unavailable')}</small></span>
    <span class="call-card__status"><strong>${escapeHtml(phaseLabel(call.status))}</strong><small>${escapeHtml(duration)}</small></span>
    <span class="call-card__attempts">${attemptCount} ${attemptCount === 1 ? 'attempt' : 'attempts'}${call.activeLineCount != null ? ` · ${call.activeLineCount} active` : ''}${winner ? ` · Human winner ${escapeHtml(maskProviderId(winner.providerCallId))}` : ''}</span>
    <span class="call-card__transcript">${startedTime ? `${escapeHtml(startedTime)} · ` : ''}${call.disposition ? `${escapeHtml(call.disposition)} · ` : ''}${call.opportunity?.status ? `${escapeHtml(call.opportunity.status)} · ` : ''}${escapeHtml(transcriptLabel(call.transcriptStatus))}</span>
  </button>`;
};

const renderCallHistoryGroups = (state: LeadConnectorEmbedState): string => {
  const groups = new Map<string, typeof state.callHistory>();
  for (const call of state.callHistory) {
    const date = call.startedAt?.slice(0, 10) ?? 'Unknown date';
    groups.set(date, [...(groups.get(date) ?? []), call]);
  }
  if (groups.size === 0) {
    return '<p class="resource-empty">No completed call sessions yet.</p>';
  }
  return [...groups.entries()]
    .map(
      ([date, calls]) =>
        `<section class="call-history-group"><h3>${escapeHtml(date)}</h3><div class="call-card-list">${calls
          .map((call) => renderAdminCallCard(call, false))
          .join('')}</div></section>`,
    )
    .join('');
};

const renderCallDetail = (state: LeadConnectorEmbedState): string => {
  const detail = state.selectedCallDetail;
  if (!detail) {
    return '<div class="session-empty"><strong>Select a call session</strong><p>Open a session to review its attempts, CRM snapshot, and transcript state.</p></div>';
  }
  const originalOpportunity = detail.opportunity;
  const currentOpportunity = detail.currentOpportunity;
  const attempts = detail.calls
    .map(
      (attempt) =>
        `<li><strong>${escapeHtml(attempt.role ?? 'attempt')}</strong><span>${escapeHtml(maskProviderId(attempt.providerCallId))}</span><span>${escapeHtml(phaseLabel(attempt.status ?? 'unknown'))}</span><span>${attempt.durationSeconds != null ? `${attempt.durationSeconds}s` : '—'}</span></li>`,
    )
    .join('');
  const transfers = detail.transferEvents ?? [];
  const transferEvents =
    transfers.length > 0
      ? `<ol class="transfer-event-list">${transfers
          .map(
            (event) =>
              `<li><strong>${escapeHtml(phaseLabel(event.type))}</strong><time datetime="${escapeHtml(event.createdAt)}">${escapeHtml(formatEventTime(event.createdAt))}</time></li>`,
          )
          .join('')}</ol>`
      : '<p class="resource-empty">No transfer events.</p>';
  const transcript =
    detail.transcriptStatus === 'ready'
      ? state.selectedCallTranscript.length > 0
        ? `<ol class="transcript-list">${state.selectedCallTranscript
            .map(
              (segment) =>
                `<li><strong>${escapeHtml(phaseLabel(segment.speaker))}${segment.startMs != null ? ` · ${(segment.startMs / 1_000).toFixed(1)}s` : ''}</strong><p>${escapeHtml(segment.text)}</p></li>`,
            )
            .join('')}</ol>`
        : '<p class="resource-empty">The transcript is ready but has no text segments.</p>'
      : `<p class="resource-empty">${escapeHtml(transcriptLabel(detail.transcriptStatus))}.</p>`;
  return `<div class="call-detail" data-call-detail="${escapeHtml(detail.id)}">
    <header><div><p class="eyebrow">Call details</p><h3>${callIdentity(detail)}</h3></div><span class="status-pill">${escapeHtml(phaseLabel(detail.status))}</span></header>
    <dl class="detail-list">
      <div><dt>Attempts</dt><dd>${detail.calls.length}</dd></div>
      <div><dt>Disposition</dt><dd>${escapeHtml(detail.disposition ?? 'Not set')}</dd></div>
      <div><dt>CRM sync</dt><dd>${escapeHtml(detail.crmSyncStatus ?? 'Not started')}</dd></div>
      <div><dt>Notes</dt><dd>${escapeHtml(detail.note ?? 'None')}</dd></div>
      <div><dt>Tags</dt><dd>${escapeHtml(detail.tags?.join(', ') || 'None')}</dd></div>
      <div><dt>Original opportunity</dt><dd>${escapeHtml(originalOpportunity?.status ?? 'Unavailable')}${originalOpportunity?.monetaryValue != null ? ` · $${originalOpportunity.monetaryValue}` : ''}${originalOpportunity?.stageId ? ` · Stage ${escapeHtml(originalOpportunity.stageId)}` : ''}</dd></div>
      <div><dt>Current opportunity</dt><dd>${escapeHtml(currentOpportunity?.status ?? 'Unavailable')}${currentOpportunity?.monetaryValue != null ? ` · $${currentOpportunity.monetaryValue}` : ''}${currentOpportunity?.stageId ? ` · Stage ${escapeHtml(currentOpportunity.stageId)}` : ''}</dd></div>
    </dl>
    <section class="attempt-panel"><h3>Provider attempts</h3><ol class="attempt-list">${attempts}</ol></section>
    <section class="transcript-panel"><h3>Call transcript</h3>${transcript}</section>
    <section class="transfer-event-panel"><h3>Transfer events</h3>${transferEvents}</section>
    <details class="call-diagnostics"><summary>Diagnostics</summary><p>${escapeHtml(detail.id)} · ${detail.calls.length} provider attempts</p></details>
  </div>`;
};

const renderAdminCallOperations = (state: LeadConnectorEmbedState): string => `
  <section class="call-operations" aria-label="Call operations">
    <article class="operator-panel call-operations__active">
      <header class="panel-heading"><div><p class="eyebrow">Live operations</p><h2>Active calls</h2></div><span>${state.activeCalls.length}</span></header>
      <div class="call-card-list">${
        state.activeCalls.length > 0
          ? state.activeCalls
              .map((call) => renderAdminCallCard(call, true))
              .join('')
          : '<p class="resource-empty">No active call sessions.</p>'
      }</div>
    </article>
    <article class="operator-panel call-operations__history">
      <header class="panel-heading"><div><p class="eyebrow">Durable records</p><h2>Call history</h2></div><span>${state.callHistory.length}</span></header>
      ${renderCallHistoryGroups(state)}
      ${state.callHistoryCursor ? '<button type="button" class="button button--secondary" data-action="load-more-history">Load more call history</button>' : ''}
    </article>
    <aside class="operator-panel call-operations__detail">${renderCallDetail(state)}</aside>
  </section>`;

const renderAdmin = (state: LeadConnectorEmbedState): string => {
  const connectionLabel = ['booting', 'authenticating'].includes(state.phase)
    ? 'Connecting'
    : state.error
      ? 'Needs attention'
      : state.sessionToken
        ? 'Connected'
        : 'Waiting for context';
  const setupVisible = state.phase === 'ready';
  return `
    <main class="surface-shell admin-shell" data-surface="admin" data-phase="${escapeHtml(state.phase)}">
      <header class="operator-header operator-header--setup">
        <div><p class="eyebrow">Consuelo Dialer</p><h1>Who do you want to call?</h1><p class="lede">Choose a LeadConnector stage as a predictive queue or dial one person directly.</p></div>
        <span class="status-pill">${escapeHtml(connectionLabel)}</span>
      </header>

      ${renderError(state)}

      <section class="admin-setup-layout">
        <article class="operator-panel operator-panel--setup">
          ${setupVisible ? renderCallSetup(state, 'admin') : renderOverlayStage(state)}
        </article>
        <aside class="operator-panel setup-context">
          <p class="eyebrow">Current setup</p>
          <h2>${state.selectedQueue ? escapeHtml(state.selectedQueue.stageName) : state.setup.mode === 'single' ? 'Single dial' : 'No list selected'}</h2>
          <dl class="detail-list">
            <div><dt>Mode</dt><dd>${state.setup.mode === 'queue' ? escapeHtml(phaseLabel(state.setup.callingMode)) : 'Single'}</dd></div>
            <div><dt>Lines</dt><dd>${state.setup.mode === 'queue' ? state.setup.requestedFanout : 1}</dd></div>
            <div><dt>Local presence</dt><dd>${state.setup.preferLocalPresence ? 'Preferred' : 'Off'}</dd></div>
            <div><dt>CRM refresh</dt><dd>${state.resourcesRefreshing ? 'Refreshing' : 'Live'}</dd></div>
          </dl>
        </aside>
      </section>

      ${renderAdminCallOperations(state)}

      <details class="operator-panel admin-diagnostics">
        <summary>Connection and browser checks</summary>
        <dl class="detail-list">
          <div><dt>CRM session</dt><dd>${state.sessionToken ? 'Authenticated' : connectionLabel}</dd></div>
          <div><dt>Contacts</dt><dd>${state.contactTotal}</dd></div>
          <div><dt>Opportunities</dt><dd>${state.opportunityTotal}</dd></div>
          <div><dt>Pipelines</dt><dd>${state.pipelines.length}</dd></div>
          <div><dt>Microphone</dt><dd>Checked before calling</dd></div>
        </dl>
      </details>
    </main>
  `;
};

const renderOverlay = (state: LeadConnectorEmbedState): string => `
  <main class="surface-shell overlay-shell" data-surface="overlay" data-phase="${escapeHtml(state.phase)}">
    <header class="overlay-header"><div class="brand-lockup"><span class="brand-mark">C</span><strong>Consuelo Dialer</strong></div><span class="status-pill">${escapeHtml(phaseLabel(state.phase))}</span></header>
    ${renderOverlayStage(state)}
  </main>
`;

export const renderLeadConnectorEmbed = (
  state: LeadConnectorEmbedState,
  options: { surface?: LeadConnectorSurface } = {},
): string =>
  (options.surface ?? 'admin') === 'overlay'
    ? renderOverlay(state)
    : renderAdmin(state);
