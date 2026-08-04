import type {
  LeadConnectorContact,
  LeadConnectorOpportunity,
} from '../contracts/index.js';
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
  phase.replaceAll('-', ' ').replace(/^./, (value) => value.toUpperCase());

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

const opportunityContact = (
  state: LeadConnectorEmbedState,
  opportunity: LeadConnectorOpportunity,
): LeadConnectorContact | undefined =>
  state.contacts.find((contact) => contact.id === opportunity.contactId);

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

const renderOpportunityRows = (
  state: LeadConnectorEmbedState,
  limit: number,
): string => {
  const opportunities = state.opportunities
    .map((opportunity) => ({
      opportunity,
      contact: opportunityContact(state, opportunity),
    }))
    .filter(({ contact }) => Boolean(contact?.phone))
    .slice(0, limit);
  if (opportunities.length === 0) {
    return '<p class="resource-empty">No callable opportunities match this view.</p>';
  }
  return opportunities
    .map(
      ({
        opportunity,
        contact,
      }) => `<button type="button" class="resource-row" data-action="select-opportunity" data-opportunity-id="${escapeHtml(opportunity.id)}">
        <span class="resource-row__identity"><strong>${escapeHtml(opportunity.name)}</strong><small>${contactLabel(contact!)} · ${maskPhone(contact?.phone ?? '')}</small></span>
        <span class="resource-row__action">Call</span>
      </button>`,
    )
    .join('');
};

const renderPipelineFilters = (state: LeadConnectorEmbedState): string => {
  const pipeline = state.pipelines.find(
    (candidate) => candidate.id === state.filters.pipelineId,
  );
  return `<div class="resource-filters">
    <label><span>Pipeline</span><select data-field="pipeline"><option value="">All pipelines</option>${state.pipelines
      .map(
        (candidate) =>
          `<option value="${escapeHtml(candidate.id)}"${candidate.id === state.filters.pipelineId ? ' selected' : ''}>${escapeHtml(candidate.name)}</option>`,
      )
      .join('')}</select></label>
    <label><span>Stage</span><select data-field="stage"${pipeline ? '' : ' disabled'}><option value="">All stages</option>${(
      pipeline?.stages ?? []
    )
      .map(
        (stage) =>
          `<option value="${escapeHtml(stage.id)}"${stage.id === state.filters.stageId ? ' selected' : ''}>${escapeHtml(stage.name)}</option>`,
      )
      .join('')}</select></label>
  </div>`;
};

const renderResourceBrowser = (
  state: LeadConnectorEmbedState,
  mode: 'admin' | 'overlay',
): string => {
  const compact = mode === 'overlay';
  const limit = compact ? 4 : 8;
  return `<section class="resource-browser resource-browser--${mode}" aria-label="Contacts and opportunities">
    <div class="resource-search">
      <label><span>Search contacts and opportunities</span><input type="search" data-field="search" value="${escapeHtml(state.filters.query)}" placeholder="Name, email, phone, or opportunity" autocomplete="off" /></label>
      ${compact ? '' : renderPipelineFilters(state)}
    </div>
    <div class="resource-columns">
      <article class="resource-group">
        <header><div><p class="eyebrow">Contacts</p><h3>People</h3></div><span>${state.contactTotal}</span></header>
        <div class="resource-list">${renderContactRows(state, limit)}</div>
      </article>
      <article class="resource-group">
        <header><div><p class="eyebrow">Opportunities</p><h3>Deals</h3></div><span>${state.opportunityTotal}</span></header>
        <div class="resource-list">${renderOpportunityRows(state, limit)}</div>
      </article>
    </div>
  </section>`;
};

const renderWrapUp = (state: LeadConnectorEmbedState): string => {
  const winner = state.callLegs.find((leg) => leg.role === 'winner');
  const target = state.selectedTargets.find(
    (candidate) =>
      candidate.contactId && candidate.contactId === winner?.contactId,
  );
  return `<section class="overlay-stage overlay-stage--wrap-up">
      <div class="stage-heading"><p class="eyebrow">Wrap-up</p><h1>Call complete</h1><p>${targetLabel(target ?? state.selectedTargets[0])}</p></div>
      <form class="wrap-up-form" data-form="disposition">
        <label>Outcome<select name="disposition"><option value="connected">Connected</option><option value="no-answer">No answer</option><option value="voicemail">Voicemail</option><option value="follow-up">Follow up</option></select></label>
        <label>Note<textarea name="note" rows="3" placeholder="Add a short follow-up note"></textarea></label>
        <details><summary>More details</summary><label>Tags<input name="tags" placeholder="called, follow-up" /></label></details>
        <button type="submit" class="button button--primary" data-action="submit-disposition">Save and close</button>
      </form>
    </section>`;
};

const renderOverlayStage = (state: LeadConnectorEmbedState): string => {
  if (state.phase === 'failed') return renderError(state);
  if (['booting', 'authenticating'].includes(state.phase)) {
    return `<section class="overlay-stage overlay-stage--loading"><span class="spinner" aria-hidden="true"></span><div><p class="eyebrow">Secure session</p><h1>Connecting…</h1><p>Loading the current location and operator context.</p></div></section>`;
  }
  if (state.phase === 'ready') {
    return `<section class="overlay-stage overlay-stage--browser"><div class="stage-heading"><p class="eyebrow">Ready</p><h1>Choose someone to call</h1><p>Select a callable CRM record below or use a phone action on the current page.</p></div>${renderResourceBrowser(state, 'overlay')}</section>`;
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

const renderAdmin = (state: LeadConnectorEmbedState): string => {
  const connectionLabel = ['booting', 'authenticating'].includes(state.phase)
    ? 'Connecting'
    : state.error
      ? 'Needs attention'
      : state.sessionToken
        ? 'Connected'
        : 'Waiting for context';
  const active = !['ready', 'completed'].includes(state.phase);
  return `
    <main class="surface-shell admin-shell" data-surface="admin" data-phase="${escapeHtml(state.phase)}">
      <header class="operator-header">
        <div><p class="eyebrow">Consuelo Dialer</p><h1>Operator workspace</h1><p class="lede">Find a CRM record, confirm the number, and start or manage the current calling session from one place.</p></div>
        <span class="status-pill">${escapeHtml(connectionLabel)}</span>
      </header>

      ${renderError(state)}

      <section class="metric-grid" aria-label="Workspace overview">
        <article class="metric"><span>Contacts available</span><strong>${state.contactTotal}</strong></article>
        <article class="metric"><span>Opportunities available</span><strong>${state.opportunityTotal}</strong></article>
        <article class="metric"><span>Pipelines connected</span><strong>${state.pipelines.length}</strong></article>
        <article class="metric"><span>Session state</span><strong>${escapeHtml(phaseLabel(state.phase))}</strong></article>
      </section>

      <section class="operator-layout">
        <article class="operator-panel operator-panel--records">
          <header class="panel-heading"><div><p class="eyebrow">CRM records</p><h2>Choose who to call</h2></div><span>Live data</span></header>
          ${renderResourceBrowser(state, 'admin')}
        </article>
        <aside class="operator-stack">
          <article class="operator-panel operator-panel--session">
            <header class="panel-heading"><div><p class="eyebrow">Current session</p><h2>${active ? 'Calling controls' : 'No active call'}</h2></div><span>${escapeHtml(phaseLabel(state.phase))}</span></header>
            ${active ? renderOverlayStage(state) : '<div class="session-empty"><strong>Ready for the next record</strong><p>Select a contact or opportunity from the workspace. The number is confirmed before any call begins.</p></div>'}
          </article>
          <article class="operator-panel operator-panel--checks">
            <header class="panel-heading"><div><p class="eyebrow">Diagnostics</p><h2>Connection and browser checks</h2></div></header>
            <dl class="detail-list">
              <div><dt>CRM session</dt><dd>${state.sessionToken ? 'Authenticated' : connectionLabel}</dd></div>
              <div><dt>Resource sync</dt><dd>${state.contacts.length + state.opportunities.length > 0 ? 'Loaded' : 'Waiting'}</dd></div>
              <div><dt>Microphone</dt><dd>Checked before calling</dd></div>
              <div><dt>Calling surface</dt><dd>Contacts and Opportunities</dd></div>
            </dl>
          </article>
        </aside>
      </section>
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
