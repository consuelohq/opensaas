import { renderWorkspacePage } from './workspace-pages.js';
import { renderHistory, renderHistoryDetail } from './workspace-history.js';
import { planName } from './workspace-format.js';
import { icon } from './workspace-icons.js';
import type { LeadConnectorContact } from '../contracts/index.js';
import { resolveLeadConnectorContactName } from './contact-label.js';
import type { LeadConnectorSurface } from './surface.js';
import type { LeadConnectorEmbedState } from './state-machine.js';
import {
  sessionPresentation,
  activeCallingMode,
  type CallingWorkspace,
} from './calling-workspace.js';
import { renderInboundOperatorPanel } from './inbound-operator-view.js';

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
  escapeHtml(target?.name ?? (target ? maskPhone(target.phone) : 'Contact'));

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
        <span class="resource-row__action">Select</span>
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
    return '<p class="setup-hint">Choose a pipeline stage to build your calling list.</p>';
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
      <div><h1>Outbound calls</h1></div>
      <button type="button" class="icon-button refresh-button" data-action="refresh" aria-label="Refresh CRM data">↻</button>
    </div>
    <div class="setup-tabs" role="tablist" aria-label="Call target mode">
      <button type="button" role="tab" aria-selected="${queueMode}" class="setup-tab${queueMode ? ' is-active' : ''}" data-action="setup-queue">Choose list</button>
      <button type="button" role="tab" aria-selected="${!queueMode}" class="setup-tab${!queueMode ? ' is-active' : ''}" data-action="setup-single">One person</button>
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
      <details class="workspace-details" data-disclosure="call-options"><summary>Calling options<span>Caller ID &amp; lines</span></summary><div class="options-fields">
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
                  : [
                      {
                        value: 'predictive',
                        label: 'Predictive dialing',
                      },
                    ]),
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
      </div></details>
    </div>
    ${state.selectedTargets.length ? '<div class="target-list">' + renderSelectedTargets(state) + '</div>' : ''}
    ${caller && !caller.canStartCall ? `<p class="notice notice--error" role="status">Calling is unavailable: ${escapeHtml(phaseLabel(caller.denialCode ?? 'commercial access blocked'))}.</p>` : ''}
    <div class="setup-actions">
      <button type="button" class="button button--primary" data-action="start-configured"${canStart ? '' : ' disabled'}>Start calling</button>
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
  if (
    state.transfer.status === 'consulting' &&
    state.transfer.type === 'warm'
  ) {
    return (
      '<div class="transfer-controls transfer-controls--consulting" aria-label="Warm transfer consultation"><p><strong>Warm consultation</strong><span>' +
      maskPhone(state.transfer.target ?? '') +
      '</span></p><button type="button" class="button button--primary" data-action="complete-transfer">Complete transfer</button><button type="button" class="button button--secondary" data-action="cancel-transfer">Cancel transfer</button></div>'
    );
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
  return (
    outcome +
    '<form class="transfer-controls" data-form="transfer" aria-label="Transfer controls"><label>Transfer number<input name="to" type="tel" inputmode="tel" autocomplete="tel" placeholder="+15551234567" pattern="\\+[1-9][0-9]{7,14}" required /></label><label>Transfer type<select name="type"><option value="warm">Warm consultation</option><option value="cold">Cold transfer</option></select></label><button type="submit" class="button button--secondary" data-action="initiate-transfer">Start transfer</button></form>'
  );
};

const renderOverlayStage = (state: LeadConnectorEmbedState): string => {
  if (state.phase === 'failed') return renderError(state);
  if (['booting', 'authenticating'].includes(state.phase)) {
    return `<section class="overlay-stage overlay-stage--loading"><span class="spinner" aria-hidden="true"></span><div><p class="eyebrow">Secure session</p><h1>Connecting…</h1><p>Loading the current location and operator context.</p></div></section>`;
  }
  if (state.phase === 'ready') {
    return renderCallSetup(state, 'overlay');
  }
  if (state.phase === 'target-selected')
    return renderCallSetup(state, 'overlay');
  if (state.phase === 'starting') {
    const count = Math.max(state.selectedTargets.length, 1);
    return `<section class="overlay-stage overlay-stage--active"><span class="spinner" aria-hidden="true"></span><div class="stage-heading"><p class="eyebrow">Starting</p><h1>Preparing ${count} ${count === 1 ? 'line' : 'lines'}…</h1><p>Getting your calls ready. Keep this window open.</p></div><button type="button" class="button button--secondary" data-action="stop">Cancel</button></section>`;
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
    return `<section class="overlay-stage overlay-stage--connected"><div class="connection-badge" data-session-status>${sessionPresentation(state, 'outbound').label}</div><div class="winner-card"><p class="eyebrow">Speaking with</p><h1>${targetLabel(target ?? state.selectedTargets[0])}</h1><p>${winner ? maskPhone(winner.customerNumber) : 'Private number'}</p></div>${loserCount ? `<p class="loser-summary">${loserCount} other ${loserCount === 1 ? 'line' : 'lines'} ended</p>` : ''}<details class="workspace-details" data-disclosure="transfer"><summary>Transfer call</summary>${renderTransferControls(state)}</details><button type="button" class="button button--danger" data-action="hang-up">Hang up</button></section>`;
  }
  if (state.phase === 'paused') {
    return `<section class="overlay-stage"><div class="stage-heading"><p class="eyebrow">Queue paused</p><h1>Calling is paused</h1><p>The active queue is preserved.</p></div><div class="split-actions"><button type="button" class="button button--primary" data-action="resume">Resume</button><button type="button" class="button button--secondary" data-action="stop">Stop queue</button></div></section>`;
  }
  if (state.phase === 'wrapping-up') return renderWrapUp(state);
  return `<section class="overlay-stage overlay-stage--complete"><div class="success-mark" aria-hidden="true">✓</div><div><p class="eyebrow">Saved</p><h1>Updated in LeadConnector</h1><p>The call outcome is complete.</p></div></section>`;
};

export const renderLeadConnectorEmbed = (
  state: LeadConnectorEmbedState,
  options: {
    surface?: LeadConnectorSurface;
    workspace?: CallingWorkspace;
  } = {},
): string => {
  const surface = options.surface === 'overlay' ? 'overlay' : 'admin';
  const requested = options.workspace ?? {
    screen: 'calling',
    mode: surface === 'admin' ? 'inbound' : 'outbound',
    compact: false,
  };
  const callMode = activeCallingMode(state);
  const workspace = { ...requested, mode: callMode ?? requested.mode };
  const status = sessionPresentation(state, workspace.mode);
  if (workspace.compact)
    return `<main class="calling-workspace compact-session" data-workspace data-workspace-compact="true" data-status="${status.status}" data-surface="${surface}"><img src="/consuelo-logo.svg" width="32" height="32" data-brand-logo alt="Consuelo" /><span class="session-dot" aria-hidden="true"></span><div><strong data-session-status role="status">${status.label}</strong><small>${workspace.mode === 'inbound' ? 'Inbound' : 'Outbound'} · Consuelo Dialer</small></div><button type="button" class="icon-button" data-action="workspace-expand" aria-label="Expand calling window">${icon('expand')}</button></main>`;
  const loading = ['booting', 'authenticating'].includes(state.phase);
  const body =
    workspace.screen === 'calling'
      ? loading
        ? renderOverlayStage(state)
        : state.phase === 'failed'
          ? renderError(state)
          : workspace.mode === 'inbound'
            ? renderInboundOperatorPanel(state.inboundOperator, {
                selectedEndpointIds: workspace.answeringEndpointIds,
              })
            : renderOverlayStage(state)
      : workspace.screen === 'history'
        ? renderHistory(state)
        : workspace.screen === 'call-detail'
          ? renderHistoryDetail(state)
          : renderWorkspacePage(state, workspace);
  const parentScreen =
    workspace.screen === 'mercury' &&
    (workspace.scriptId || workspace.scriptDraft)
      ? 'mercury'
      : ['team', 'numbers', 'billing', 'appearance'].includes(workspace.screen)
        ? 'settings'
        : workspace.screen === 'call-detail'
          ? 'history'
          : 'calling';
  const remaining = state.commercialCaller?.remainingMinutes;
  return `<main class="calling-workspace" data-workspace data-workspace-screen="${workspace.screen}" data-workspace-compact="false" data-surface="${surface}" data-phase="${state.phase}">
  <header class="workspace-header"><a class="workspace-brand" href="https://consuelohq.com/" target="_blank" rel="noopener noreferrer" aria-label="Consuelo Dialer"><img src="/consuelo-logo.svg" data-brand-logo width="36" height="36" alt="" /><span class="workspace-wordmark"><span>CONSUELO</span><span>DIALER</span></span></a><nav aria-label="Workspace"><button type="button" class="header-action" data-action="workspace-history" aria-label="Call history" aria-pressed="${workspace.screen === 'history' || workspace.screen === 'call-detail'}">${icon('history')}<span>History</span></button><button type="button" class="header-action" data-action="workspace-mercury" aria-label="Mercury scripts" aria-pressed="${workspace.screen === 'mercury'}">${icon('script')}<span>Mercury</span></button><button type="button" class="icon-button" data-action="workspace-settings" aria-label="Settings">${icon('settings')}</button>${surface === 'overlay' || status.active ? `<button type="button" class="icon-button" data-action="workspace-minimize" aria-label="Minimize calling window">${icon('minus')}</button>` : ''}</nav></header>
  ${workspace.screen === 'calling' ? `<div class="direction-tabs" role="tablist" aria-label="Calling direction"><button type="button" role="tab" aria-selected="${workspace.mode === 'inbound'}" data-action="workspace-inbound"${callMode === 'outbound' ? ' disabled' : ''}>${icon('incoming')} Inbound</button><button type="button" role="tab" aria-selected="${workspace.mode === 'outbound'}" data-action="workspace-outbound"${callMode === 'inbound' ? ' disabled' : ''}>${icon('outgoing')} Outbound</button></div>` : `<div class="page-breadcrumb"><button type="button" class="text-button" data-action="workspace-${parentScreen}">${icon('back')} ${parentScreen === 'settings' ? 'Settings' : parentScreen === 'history' ? 'Call history' : 'Back to calling'}</button>${status.active ? `<button type="button" class="live-indicator" data-action="workspace-calling"><span class="session-dot"></span>${escapeHtml(status.label)}</button>` : ''}</div>`}
  <div class="workspace-content">${workspace.screen !== 'calling' ? renderError(state) : ''}${body}</div>
  ${!loading ? `<footer class="workspace-footer"><button type="button" class="plan-entry" data-action="workspace-billing" aria-label="Open plan and billing"><strong>${escapeHtml(planName(state))}</strong><span>${remaining == null ? (remaining === null ? 'Unlimited minutes' : '') : escapeHtml(remaining.toLocaleString('en-US')) + ' minutes left'}</span>${icon('arrow')}</button><a href="https://docs.consuelohq.com/" target="_blank" rel="noopener noreferrer">Learn more</a></footer>` : ''}
  </main>`;
};
