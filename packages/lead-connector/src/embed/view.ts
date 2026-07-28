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

const renderError = (state: LeadConnectorEmbedState): string =>
  state.error
    ? `<section class="notice notice--error" role="alert">
        <div><strong>${escapeHtml(state.error.message)}</strong><span>${
          state.error.recoverable
            ? 'Reconnect and try again.'
            : 'This session cannot continue.'
        }</span></div>
        ${
          state.error.recoverable
            ? '<button type="button" class="button button--secondary" data-action="retry">Retry</button>'
            : ''
        }
      </section>`
    : '';

const renderAdmin = (state: LeadConnectorEmbedState): string => {
  const connectionLabel = ['booting', 'authenticating'].includes(state.phase)
    ? 'Connecting'
    : state.error
      ? 'Needs attention'
      : 'Connected';
  return `
    <main class="surface-shell admin-shell" data-surface="admin" data-phase="${escapeHtml(state.phase)}">
      <header class="admin-header">
        <div>
          <p class="eyebrow">Consuelo Dialer</p>
          <h1>Calling operations</h1>
          <p class="lede">Administration, diagnostics, and team-level visibility for the embedded dialer.</p>
        </div>
        <span class="status-pill">${escapeHtml(connectionLabel)}</span>
      </header>

      ${renderError(state)}

      <section class="metric-grid" aria-label="Overview">
        <article class="metric"><span>Contacts available</span><strong>${state.contactTotal}</strong></article>
        <article class="metric"><span>Opportunities available</span><strong>${state.opportunityTotal}</strong></article>
        <article class="metric"><span>Pipelines connected</span><strong>${state.pipelines.length}</strong></article>
        <article class="metric"><span>Session state</span><strong>${escapeHtml(phaseLabel(state.phase))}</strong></article>
      </section>

      <section class="admin-section">
        <div class="section-copy"><p class="eyebrow">Overview</p><h2>Workspace readiness</h2><p>The embedded calling service, CRM resources, and browser session share one protected workspace context.</p></div>
        <dl class="detail-list">
          <div><dt>CRM connection</dt><dd>${state.sessionToken ? 'Authenticated' : connectionLabel}</dd></div>
          <div><dt>Calling surface</dt><dd>Opportunities and Contacts overlay</dd></div>
          <div><dt>Default workflow</dt><dd>Single or multiline from selected CRM records</dd></div>
        </dl>
      </section>

      <section class="admin-grid">
        <article class="admin-card">
          <p class="eyebrow">Analytics</p>
          <h2>Calling performance</h2>
          <p>Answer rates, talk time, and queue outcomes will appear here as validated call sessions accumulate.</p>
          <span class="quiet-label">No synthetic metrics</span>
        </article>
        <article class="admin-card">
          <p class="eyebrow">Caller IDs</p>
          <h2>Inventory and health</h2>
          <p>Caller-ID capacity and reputation remain backend-authoritative. Inventory controls will be added after the configuration contract is finalized.</p>
          <span class="quiet-label">Managed by dialer-server</span>
        </article>
        <article class="admin-card">
          <p class="eyebrow">Permissions</p>
          <h2>Location access</h2>
          <p>The installed draft is scoped to the current isolated location and authenticated platform users.</p>
          <span class="quiet-label">Location-scoped</span>
        </article>
        <article class="admin-card">
          <p class="eyebrow">Diagnostics</p>
          <h2>Browser and microphone</h2>
          <p>Microphone permission is required only when a live conversation connects. Calling controls now open over CRM records.</p>
          <span class="quiet-label">Iframe and session checks active</span>
        </article>
      </section>
    </main>
  `;
};

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
    return `<section class="overlay-stage overlay-stage--loading"><span class="spinner" aria-hidden="true"></span><div><p class="eyebrow">Secure session</p><h1>Connecting…</h1><p>Loading the current location and user context.</p></div></section>`;
  }
  if (state.phase === 'ready') {
    return `<section class="overlay-stage overlay-stage--empty"><div class="dial-mark" aria-hidden="true">☎</div><div><p class="eyebrow">Ready</p><h1>Select someone to call</h1><p>Choose a phone action from an opportunity, contact, or record detail.</p></div></section>`;
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
