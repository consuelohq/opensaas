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

type ComboboxOption = { value: string; label: string };

const renderCombobox = (input: {
  field: string;
  label: string;
  value: string | null;
  placeholder: string;
  options: ComboboxOption[];
  disabled?: boolean;
}): string => {
  const id = `combobox-${input.field}`;
  const selected = input.options.find((option) => option.value === input.value);
  return `<label class="setup-field setup-field--wide"><span>${escapeHtml(input.label)}</span>
    <div class="combobox" data-combobox-field="${escapeHtml(input.field)}" data-combobox-value="${escapeHtml(input.value ?? '')}">
      <button type="button" class="combobox__trigger" role="combobox" aria-controls="${id}-listbox" aria-expanded="false"${input.disabled ? ' disabled' : ''}>${escapeHtml(selected?.label ?? input.placeholder)}</button>
      <div id="${id}-listbox" class="combobox__listbox" role="listbox" hidden>${input.options
        .map(
          (option, index) =>
            `<button type="button" id="${id}-option-${index}" class="combobox__option" role="option" data-combobox-value="${escapeHtml(option.value)}" aria-selected="${option.value === input.value}">${escapeHtml(option.label)}</button>`,
        )
        .join('')}</div>
    </div>
  </label>`;
};

const queueOptions = (state: LeadConnectorEmbedState): ComboboxOption[] =>
  state.pipelines.flatMap((pipeline) =>
    pipeline.stages.map((stage) => ({
      value: `${pipeline.id}:${stage.id}`,
      label: `${pipeline.name} — ${stage.name}`,
    })),
  );

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
  const caller = state.commercialCaller;
  const lineOptions = caller?.lineOptions.length
    ? caller.lineOptions
    : [1, 2, 3];
  const canStart =
    state.sessionToken !== null &&
    state.selectedTargets.length > 0 &&
    (queueMode ? state.selectedQueue !== null : true) &&
    (caller?.canStartCall ?? true);
  return `<section class="call-setup call-setup--${surface}" aria-label="Call setup">
    <div class="setup-heading">
      <div><p class="eyebrow">Call setup</p><h2>Who do you want to call?</h2><p>Choose a list or dial a single number.</p></div>
      <button type="button" class="icon-button refresh-button" data-action="refresh" aria-label="Refresh CRM data">↻</button>
    </div>
    <div class="setup-tabs" role="tablist" aria-label="Call target mode">
      <button type="button" role="tab" aria-selected="${queueMode}" class="setup-tab${queueMode ? ' is-active' : ''}" data-action="setup-queue">Choose list</button>
      <button type="button" role="tab" aria-selected="${!queueMode}" class="setup-tab${!queueMode ? ' is-active' : ''}" data-action="setup-single">Single dial</button>
    </div>
    <div class="setup-fields">
      ${
        queueMode
          ? `${renderCombobox({
              field: 'queue',
              label: 'Choose list',
              value: state.selectedQueue
                ? `${state.selectedQueue.pipelineId}:${state.selectedQueue.stageId}`
                : null,
              placeholder: '— Select a pipeline stage —',
              options: queueOptions(state),
            })}${renderQueueSummary(state)}`
          : `<div class="single-dial-panel">
              <label class="setup-field setup-field--wide"><span>Phone number</span><div class="input-action"><input type="tel" data-field="single-phone" placeholder="(555) 555-0123" autocomplete="tel" /><button type="button" class="button button--secondary" data-action="select-single-number">Use number</button></div></label>
              <label class="setup-field setup-field--wide"><span>Find a contact</span><input type="search" data-field="search" value="${escapeHtml(state.filters.query)}" placeholder="Name, email, or phone" autocomplete="off" /></label>
              <div class="single-contact-list">${renderContactRows(state, surface === 'overlay' ? 4 : 8)}</div>
            </div>`
      }
      ${renderCombobox({
        field: 'caller-id',
        label: 'Call from',
        value: state.setup.callerIdNumber,
        placeholder: 'Automatic caller ID',
        options: [
          { value: '', label: 'Automatic caller ID' },
          ...state.callerIds.map((phoneNumber) => ({
            value: phoneNumber,
            label: maskPhone(phoneNumber),
          })),
        ],
      })}
      <label class="check-field"><input type="checkbox" data-field="local-presence"${state.setup.preferLocalPresence ? ' checked' : ''} /><span>Prefer local presence calling</span></label>
      ${
        queueMode
          ? `${renderCombobox({
              field: 'calling-mode',
              label: 'Calling mode',
              value: state.setup.callingMode,
              placeholder: 'Choose a calling mode',
              options: [
                ...(caller?.predictive === false
                  ? []
                  : [{ value: 'predictive', label: 'Predictive Dialer (recommended)' }]),
                { value: 'single', label: 'Single (one call at a time)' },
              ],
            })}
             ${renderCombobox({
               field: 'line-count',
               label: 'Number of lines',
               value: String(state.setup.requestedFanout),
               placeholder: 'Choose line count',
               options: lineOptions.map((line) => ({
                 value: String(line),
                 label: line === 1 ? 'One' : String(line),
               })),
               disabled: state.setup.callingMode === 'single',
             })}`
          : ''
      }
    </div>
    ${caller && !caller.canStartCall ? `<p class="notice notice--error" role="status">Calling is unavailable: ${escapeHtml(phaseLabel(caller.denialCode ?? 'commercial access blocked'))}.</p>` : ''}
    <div class="setup-actions">
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

const renderTransferControls = (state: LeadConnectorEmbedState): string => {
  if (state.transfer.status === 'consulting' && state.transfer.type === 'warm') {
    return '<div class="transfer-controls transfer-controls--consulting" aria-label="Warm transfer consultation"><p><strong>Warm consultation</strong><span>' +
      maskPhone(state.transfer.target ?? '') +
      '</span></p><button type="button" class="button button--primary" data-action="complete-transfer">Complete transfer</button><button type="button" class="button button--secondary" data-action="cancel-transfer">Cancel transfer</button></div>';
  }
  if (state.transfer.status === 'initiating') {
    return '<div class="transfer-controls" role="status">Starting transfer\u2026</div>';
  }
  const outcome =
    state.transfer.status === 'completed'
      ? '<p class="transfer-outcome">Transfer completed.</p>'
      : state.transfer.status === 'cancelled'
        ? '<p class="transfer-outcome">Transfer cancelled. Customer restored.</p>'
        : '';
  return outcome + '<form class="transfer-controls" data-form="transfer" aria-label="Transfer controls"><label>Transfer number<input name="to" type="tel" inputmode="tel" autocomplete="tel" placeholder="+15551234567" pattern="\\+[1-9][0-9]{7,14}" required /></label><label>Transfer type<select name="type"><option value="warm">Warm consultation</option><option value="cold">Cold transfer</option></select></label><button type="submit" class="button button--secondary" data-action="initiate-transfer">Start transfer</button></form>';
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
    return `<section class="overlay-stage overlay-stage--connected"><div class="connection-badge">Connected</div><div class="winner-card"><p class="eyebrow">Winner</p><h1>${targetLabel(target ?? state.selectedTargets[0])}</h1><p>${winner ? maskPhone(winner.customerNumber) : 'Private number'}</p></div>${loserCount ? `<p class="loser-summary">${loserCount} other ${loserCount === 1 ? 'line' : 'lines'} ended</p>` : ''}${renderTransferControls(state)}<button type="button" class="button button--danger" data-action="hang-up">Hang up</button></section>`;
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

const commercialValue = (
  value: Record<string, unknown> | null | undefined,
  snake: string,
  camel: string,
): unknown => value?.[snake] ?? value?.[camel];

const money = (cents: number): string => '$' + (cents / 100).toFixed(2);

const commercialQuantity = (
  items: Array<Record<string, unknown>>,
  code: string,
): number => {
  const item = items.find(
    (candidate) => String(candidate.item_code ?? candidate.itemCode ?? '') === code,
  );
  const quantity = Number(item?.quantity ?? 0);
  return Number.isSafeInteger(quantity) && quantity >= 0 ? quantity : 0;
};

const billingDate = (seconds: number | null): string => {
  if (!seconds) return 'the next billing date';
  return new Date(seconds * 1_000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const renderCommercialAdmin = (state: LeadConnectorEmbedState): string => {
  const dashboard = state.commercialDashboard;
  if (!dashboard) {
    return `<section class="commercial-admin-grid commercial-loading" aria-live="polite" aria-busy="true">
      <article class="operator-panel commercial-card"><h2>Plans</h2><p>Loading subscription…</p></article>
      <article class="operator-panel commercial-card"><h2>Team</h2><p>Loading seat assignments…</p></article>
      <article class="operator-panel commercial-card"><h2>Phone numbers</h2><p>Loading number inventory…</p></article>
      <article class="operator-panel commercial-card"><h2>Usage</h2><p>Loading current-period usage…</p></article>
      <article class="operator-panel commercial-card"><h2>Billing</h2><p>Loading billing status…</p></article>
    </section>`;
  }
  const subscriptionStatus = String(
    commercialValue(dashboard.subscription, 'status', 'status') ?? 'Free trial',
  );
  const seats = dashboard.seats
    .map((seat) => {
      const userId = String(commercialValue(seat, 'user_id', 'userId') ?? '');
      const planCode = String(
        commercialValue(seat, 'plan_code', 'planCode') ?? 'standard',
      );
      const status = String(commercialValue(seat, 'status', 'status') ?? 'active');
      return `<tr><td>${escapeHtml(userId)}</td><td>${escapeHtml(phaseLabel(planCode))}</td><td>${escapeHtml(phaseLabel(status))}</td></tr>`;
    })
    .join('');
  const numbers = dashboard.numbers
    .map((number) => {
      const phoneNumber = String(
        commercialValue(number, 'phone_number', 'phoneNumber') ?? '',
      );
      const userId = String(
        commercialValue(number, 'user_id', 'userId') ?? 'Unassigned',
      );
      const status = String(
        commercialValue(number, 'status', 'status') ?? 'active',
      );
      return `<tr><td>${escapeHtml(maskPhone(phoneNumber))}</td><td>${escapeHtml(userId)}</td><td>${escapeHtml(phaseLabel(status))}</td><td>${status === 'active' ? `<button type="button" class="button button--secondary" data-action="release-number" data-phone-number="${escapeHtml(phoneNumber)}">Release</button>` : ''}</td></tr>`;
    })
    .join('');
  const searchResults = state.commercialNumberSearchResults
    .map((number) => {
      const phoneNumber = String(number.phoneNumber ?? number.phone_number ?? '');
      const location = [number.city, number.state].filter(Boolean).join(', ');
      return `<li><div><strong>${escapeHtml(maskPhone(phoneNumber))}</strong><span>${escapeHtml(location || 'US local number')} · ${money(dashboard.catalog.additionalNumberPriceCents)}/month when an add-on slot is required</span></div><button type="button" class="button button--secondary" data-action="provision-number" data-phone-number="${escapeHtml(phoneNumber)}">Provision</button></li>`;
    })
    .join('');
  const connectedMinutes = Number(
    commercialValue(dashboard.usage, 'connected_minutes', 'connectedMinutes') ?? 0,
  );
  const providerCostMicros = Number(
    commercialValue(dashboard.usage, 'provider_cost_micros', 'providerCostMicros') ?? 0,
  );
  const plans = (['single', 'standard', 'power'] as const)
    .map((code) => {
      const plan = dashboard.catalog.plans[code];
      return `<li><strong>${escapeHtml(phaseLabel(code))}</strong><span>${money(plan.priceCents)}/seat · ${plan.maxNumbersPerSeat} line${plan.maxNumbersPerSeat === 1 ? '' : 's'} · ${plan.includedMinutes ?? 'Unlimited'} minutes</span></li>`;
    })
    .join('');
  const quantities = {
    single: commercialQuantity(dashboard.subscriptionItems, 'single'),
    standard: commercialQuantity(dashboard.subscriptionItems, 'standard'),
    power: commercialQuantity(dashboard.subscriptionItems, 'power'),
    additionalNumber: commercialQuantity(
      dashboard.subscriptionItems,
      'additional-number',
    ),
  };
  const hasSubscription = dashboard.subscription !== null;
  const cancelAtPeriodEnd = Boolean(
    commercialValue(
      dashboard.subscription,
      'cancel_at_period_end',
      'cancelAtPeriodEnd',
    ),
  );
  const paymentFailedAt = String(
    commercialValue(
      dashboard.subscription,
      'payment_failed_at',
      'paymentFailedAt',
    ) ?? '',
  );
  const paymentRecovery =
    hasSubscription &&
    (subscriptionStatus === 'past_due' ||
      subscriptionStatus === 'unpaid' ||
      paymentFailedAt.length > 0);
  const recurringCents =
    quantities.single * dashboard.catalog.plans.single.priceCents +
    quantities.standard * dashboard.catalog.plans.standard.priceCents +
    quantities.power * dashboard.catalog.plans.power.priceCents +
    quantities.additionalNumber *
      dashboard.catalog.additionalNumberPriceCents;
  const quantityFields = `
    <label>Single seats<input name="single" type="number" min="0" step="1" value="${quantities.single}" /></label>
    <label>Standard seats<input name="standard" type="number" min="0" step="1" value="${hasSubscription ? quantities.standard : Math.max(1, quantities.standard)}" /></label>
    <label>Power seats<input name="power" type="number" min="0" step="1" value="${quantities.power}" /></label>
    <label>Additional numbers<input name="additionalNumber" type="number" min="0" step="1" value="${quantities.additionalNumber}" /></label>`;
  const preview = state.commercialBillingPreview;
  const previewPanel = preview
    ? `<section class="billing-preview" role="status"><p class="eyebrow">Proration preview</p><h3>Due now: ${money(preview.amountDue)}</h3><p>Stripe calculated this amount for the exact confirmed change. The subscription remains unchanged until you confirm.</p><div class="button-row"><button type="button" class="button button--primary" data-action="apply-billing-change">Confirm change</button><button type="button" class="button button--secondary" data-action="cancel-billing-preview">Cancel</button></div></section>`
    : '';
  const plansCard = hasSubscription
    ? `<article class="operator-panel commercial-card" data-admin-section="plans"><p class="eyebrow">${escapeHtml(phaseLabel(subscriptionStatus))}</p><h2>Plans</h2><ul class="commercial-list">${plans}</ul><form data-form="commercial-billing-change" class="billing-quantity-form">${quantityFields}<button type="submit" class="button button--secondary">Preview subscription change</button></form>${previewPanel}</article>`
    : `<article class="operator-panel commercial-card" data-admin-section="plans"><p class="eyebrow">Free trial</p><h2>Plans</h2><ul class="commercial-list">${plans}</ul><p>Trial: ${dashboard.catalog.trial.includedMinutes} minutes, ${dashboard.catalog.trial.maxSeats} seat, ${dashboard.catalog.trial.maxNumbers} number.</p><form data-form="commercial-billing-checkout" class="billing-quantity-form">${quantityFields}<button type="submit" class="button button--primary">Start paid plan</button></form></article>`;
  const statusPanel = cancelAtPeriodEnd
    ? `<div class="billing-state billing-state--warning" role="status"><strong>Cancellation scheduled</strong><p>Access remains active through the current paid period. Use the billing portal to resume or review the cancellation date.</p></div>`
    : paymentRecovery
      ? `<div class="billing-state billing-state--warning" role="status"><strong>Payment recovery</strong><p>Update the payment method during the ${dashboard.catalog.paymentGraceDays}-day grace period to avoid call suspension.</p></div>`
      : hasSubscription
        ? '<div class="billing-state billing-state--success" role="status"><strong>Subscription active</strong><p>Confirmed Stripe quantities are applied to seat and number inventory.</p></div>'
        : '<div class="billing-state" role="status"><strong>Free trial</strong><p>Choose paid quantities in Plans to open secure Stripe Checkout.</p></div>';
  const upcomingInvoice = dashboard.billingSummary
    ? `<div class="billing-summary"><p class="eyebrow">Upcoming invoice</p><strong>${money(dashboard.billingSummary.amountDue)}</strong><span>Estimated for ${escapeHtml(billingDate(dashboard.billingSummary.periodEnd))}</span></div>`
    : dashboard.billingSummaryError
      ? `<p class="resource-empty">${escapeHtml(dashboard.billingSummaryError)}</p>`
      : '';
  const addOnLabel = `${quantities.additionalNumber} additional number${quantities.additionalNumber === 1 ? '' : 's'}`;
  const billingCard = `<article class="operator-panel commercial-card" data-admin-section="billing"><p class="eyebrow">Subscription</p><h2>Billing</h2>${statusPanel}${upcomingInvoice}<dl><div><dt>Recurring plan total</dt><dd>${money(recurringCents)}/month</dd></div><div><dt>Add-on breakdown</dt><dd>${escapeHtml(addOnLabel)} · ${money(quantities.additionalNumber * dashboard.catalog.additionalNumberPriceCents)}/month</dd></div></dl>${hasSubscription ? '<p>Payment methods, invoices, and cancellation are managed securely in Stripe.</p><button type="button" class="button button--secondary" data-action="manage-billing">Open billing portal</button>' : '<p>No payment method is stored until secure Checkout is completed.</p>'}</article>`;
  return `<section class="commercial-admin-grid" aria-label="Commercial dialer administration">
    ${plansCard}
    <article class="operator-panel commercial-card" data-admin-section="team"><p class="eyebrow">${dashboard.seats.length} assigned</p><h2>Team</h2><table><thead><tr><th>User</th><th>Tier</th><th>Status</th></tr></thead><tbody>${seats || '<tr><td colspan="3">No paid seats assigned.</td></tr>'}</tbody></table><form data-form="commercial-seat"><label>Provider user ID<input name="userId" required /></label><label>Tier<select name="planCode"><option value="single">Single</option><option value="standard">Standard</option><option value="power">Power</option></select></label><button type="submit" class="button button--secondary">Save seat</button></form></article>
    <article class="operator-panel commercial-card" data-admin-section="phone-numbers"><p class="eyebrow">${dashboard.numbers.filter((number) => String(commercialValue(number, 'status', 'status')) === 'active').length} active</p><h2>Phone numbers</h2><table><thead><tr><th>Number</th><th>User</th><th>Status</th><th></th></tr></thead><tbody>${numbers || '<tr><td colspan="4">No numbers provisioned.</td></tr>'}</tbody></table><form data-form="commercial-number-search"><label>Area code or digits<input name="query" inputmode="numeric" required /></label><label>Assign to user<input name="userId" value="${escapeHtml(state.commercialNumberTargetUserId)}" required /></label><button type="submit" class="button button--secondary">Search available numbers</button></form><ul class="commercial-number-results">${searchResults}</ul></article>
    <article class="operator-panel commercial-card" data-admin-section="usage"><p class="eyebrow">Current period</p><h2>Usage</h2><dl><div><dt>Connected minutes</dt><dd>${connectedMinutes}</dd></div><div><dt>Provider cost</dt><dd>${money(Math.round(providerCostMicros / 10_000))}</dd></div></dl></article>
    ${billingCard}
  </section>`;
};

const renderAdmin = (state: LeadConnectorEmbedState): string => `
  <main class="surface-shell admin-shell" data-surface="admin" data-phase="${escapeHtml(state.phase)}">
    <header class="operator-header"><div><p class="eyebrow">Workspace administration</p><h1>Dialer settings</h1><p class="lede">Manage subscriptions, seats, caller IDs, usage, and billing for this location.</p></div></header>
    ${renderError(state)}
    ${renderCommercialAdmin(state)}
    ${renderAdminCallOperations(state)}
  </main>
`;

const renderOverlay = (state: LeadConnectorEmbedState): string => `
  <main class="surface-shell overlay-shell" data-surface="overlay" data-phase="${escapeHtml(state.phase)}">
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
