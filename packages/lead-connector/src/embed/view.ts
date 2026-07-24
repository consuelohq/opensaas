import {
  filterEmbedOpportunities,
  type LeadConnectorEmbedState,
} from './state-machine.js';

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

const targetLabel = (
  target: LeadConnectorEmbedState['selectedTargets'][number],
): string =>
  escapeHtml(target.name ?? target.contactId ?? maskPhone(target.phone));

const phaseLabel = (phase: LeadConnectorEmbedState['phase']): string =>
  phase.replaceAll('-', ' ').replace(/^./, (value) => value.toUpperCase());

export const renderLeadConnectorEmbed = (
  state: LeadConnectorEmbedState,
): string => {
  const opportunities = filterEmbedOpportunities(
    state.opportunities,
    state.filters,
  );
  const selectedPipeline = state.pipelines.find(
    (pipeline) => pipeline.id === state.filters.pipelineId,
  );
  const canStart =
    state.selectedTargets.length > 0 &&
    !['starting', 'dialing', 'ringing', 'connected'].includes(state.phase);
  const active = ['starting', 'dialing', 'ringing', 'connected'].includes(
    state.phase,
  );

  return `
    <main class="embed-shell" data-phase="${escapeHtml(state.phase)}">
      <header class="embed-header">
        <div>
          <p class="eyebrow">LeadConnector Dialer</p>
          <h1>Call workspace</h1>
        </div>
        <span class="status-pill">${escapeHtml(phaseLabel(state.phase))}</span>
      </header>

      <aside class="permission-guidance" role="note">
        <strong>Allow microphone access</strong>
        <span>Enable microphone permission for the embedded dialer before connecting a live conversation.</span>
      </aside>

      ${
        state.error
          ? `
        <section class="error-panel" role="alert">
          <strong>${escapeHtml(state.error.message)}</strong>
          <span>${state.error.recoverable ? 'This can be retried.' : 'This session cannot continue.'}</span>
          ${state.error.recoverable ? '<button type="button" data-action="retry">Retry</button>' : ''}
        </section>
      `
          : ''
      }

      <section class="workspace-grid">
        <div class="resource-panel">
          <div class="section-heading">
            <div><p class="eyebrow">Targets</p><h2>Contacts and opportunities</h2></div>
          </div>
          <label>
            Search
            <input data-field="search" value="${escapeHtml(state.filters.query)}" placeholder="Contact or opportunity" />
          </label>
          <div class="filters">
            <label>
              Pipeline
              <select data-field="pipeline">
                <option value="">All pipelines</option>
                ${state.pipelines
                  .map(
                    (pipeline) =>
                      `<option value="${escapeHtml(pipeline.id)}" ${pipeline.id === state.filters.pipelineId ? 'selected' : ''}>${escapeHtml(pipeline.name)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label>
              Stage
              <select data-field="stage">
                <option value="">All stages</option>
                ${(selectedPipeline?.stages ?? [])
                  .map(
                    (stage) =>
                      `<option value="${escapeHtml(stage.id)}" ${stage.id === state.filters.stageId ? 'selected' : ''}>${escapeHtml(stage.name)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
          </div>
          <div class="resource-list" aria-label="Opportunities">
            ${
              opportunities.length === 0
                ? '<p class="empty-state">No opportunities match these filters.</p>'
                : opportunities
                    .map(
                      (opportunity) => `
              <article class="resource-card">
                <div><strong>${escapeHtml(opportunity.name)}</strong><span>${escapeHtml(opportunity.status ?? 'Open')}</span></div>
                <button type="button" data-action="select-opportunity" data-opportunity-id="${escapeHtml(opportunity.id)}" data-contact-id="${escapeHtml(opportunity.contactId ?? '')}">Select</button>
              </article>
            `,
                    )
                    .join('')
            }
          </div>
          <div class="resource-list" aria-label="Contacts">
            ${state.contacts
              .slice(0, 20)
              .map(
                (contact) => `
              <article class="resource-card">
                <div><strong>${escapeHtml(contact.name ?? ([contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Contact'))}</strong><span>${contact.phone ? maskPhone(contact.phone) : 'No callable number'}</span></div>
                <button type="button" data-action="select-contact" data-contact-id="${escapeHtml(contact.id)}" ${contact.phone ? `data-phone="${escapeHtml(contact.phone)}"` : 'disabled'}>Select</button>
              </article>
            `,
              )
              .join('')}
          </div>
        </div>

        <div class="dialer-panel">
          <div class="section-heading">
            <div><p class="eyebrow">Queue</p><h2>Selected targets</h2></div>
            <span>${state.selectedTargets.length}</span>
          </div>
          <div class="selected-targets">
            ${
              state.selectedTargets.length === 0
                ? '<p class="empty-state">Select a contact, opportunity, or phone link.</p>'
                : state.selectedTargets
                    .map(
                      (target) => `
              <div class="selected-target">
                <div><strong>${targetLabel(target)}</strong><span>${maskPhone(target.phone)}</span></div>
                <button type="button" data-action="remove-target" data-dedupe-key="${escapeHtml(target.dedupeKey)}" aria-label="Remove ${targetLabel(target)}">Remove</button>
              </div>
            `,
                    )
                    .join('')
            }
          </div>
          <div class="call-controls">
            <button type="button" data-action="start-single" ${canStart ? '' : 'disabled'}>Start single call</button>
            <button type="button" data-action="start-parallel" ${canStart ? '' : 'disabled'}>Start multiline call</button>
            <button type="button" data-action="pause" ${active ? '' : 'disabled'}>Pause queue</button>
            <button type="button" data-action="resume" ${state.phase === 'paused' ? '' : 'disabled'}>Resume queue</button>
            <button type="button" data-action="hang-up" ${active ? '' : 'disabled'}>Hang up</button>
            <button type="button" data-action="stop" ${state.activeSessionId ? '' : 'disabled'}>Stop session</button>
          </div>

          <section class="session-panel" aria-label="Current call and queue status">
            <div class="section-heading"><div><p class="eyebrow">Live status</p><h2>Call legs</h2></div></div>
            ${
              state.callLegs.length === 0
                ? '<p class="empty-state">No active call session.</p>'
                : state.callLegs
                    .map(
                      (leg) => `
              <article class="call-leg call-leg--${escapeHtml(leg.role)}">
                <div><strong>${leg.role === 'winner' ? 'Winner' : leg.role === 'loser' ? 'Losing leg' : 'Active leg'}</strong><span>${maskPhone(leg.customerNumber)}</span></div>
                <span>${escapeHtml(leg.status)}${leg.amdResult ? ` · ${escapeHtml(leg.amdResult)}` : ''}</span>
              </article>
            `,
                    )
                    .join('')
            }
          </section>

          <form class="wrap-up" data-form="disposition">
            <div class="section-heading"><div><p class="eyebrow">Wrap-up</p><h2>Disposition</h2></div></div>
            <label>Outcome<select name="disposition"><option value="connected">Connected</option><option value="no-answer">No answer</option><option value="voicemail">Voicemail</option><option value="follow-up">Follow up</option></select></label>
            <label>Note<textarea name="note" rows="3" placeholder="Add a concise follow-up note"></textarea></label>
            <label>Tags<input name="tags" placeholder="called, follow-up" /></label>
            <button type="submit" data-action="submit-disposition">Save disposition</button>
          </form>
        </div>
      </section>
    </main>
  `;
};
