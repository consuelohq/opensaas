import type { CallingWorkspace } from './calling-workspace.js';
import type { LeadConnectorEmbedState } from './state-machine.js';
import type { MercuryCueView } from './mercury-cues.js';
import { scriptSteps } from './script-presentation.js';
import { escapeHtml as e } from './workspace-format.js';
import { sessionPresentation } from './calling-workspace.js';

export const mercuryCallScope = (
  state: LeadConnectorEmbedState,
  mode: CallingWorkspace['mode'],
): string | null => {
  const assignment =
    state.inboundOperator.rep.assignment ?? state.inboundOperator.offers[0];
  return mode === 'inbound'
    ? assignment
      ? `inbound:${assignment.assignmentId}:${assignment.generation}`
      : null
    : state.activeSessionId
      ? `outbound:${state.activeSessionId}`
      : null;
};

export const observeMercuryCaller = (
  workspace: CallingWorkspace,
  state: LeadConnectorEmbedState,
): void => {
  const offer = state.inboundOperator.offers.find(
    (candidate) =>
      `inbound:${candidate.assignmentId}:${candidate.generation}` ===
      workspace.mercuryScope,
  );
  if (offer && workspace.mercuryScope)
    workspace.mercuryCaller = {
      scopeKey: workspace.mercuryScope,
      label: offer.callerLabel,
      context: offer.queueName,
    };
};

export const connectedTimer = (
  status: string,
  confirmedAt: string | null | undefined,
  now: number,
): string => {
  if (status !== 'connected' || !confirmedAt) return '—';
  const started = Date.parse(confirmedAt);
  if (!Number.isFinite(started) || started > now) return '—';
  const seconds = Math.floor((now - started) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export const renderCallIdentity = (
  state: LeadConnectorEmbedState,
  workspace: CallingWorkspace,
  now = Date.now(),
): string => {
  const status = sessionPresentation(state, workspace.mode);
  const scope = mercuryCallScope(state, workspace.mode);
  const target =
    state.selectedTargets.find(
      (t) =>
        t.contactId &&
        t.contactId ===
          state.callLegs.find((l) => l.role === 'winner')?.contactId,
    ) ?? state.selectedTargets[0];
  const contact =
    workspace.mode === 'inbound'
      ? workspace.mercuryCaller?.scopeKey === scope
        ? workspace.mercuryCaller.label
        : 'Incoming caller'
      : target?.name || 'Contact';
  const confirmedAt =
    workspace.mode === 'inbound'
      ? state.inboundOperator.rep.assignment?.connectedAt
      : workspace.confirmedConnection?.scopeKey === scope
        ? workspace.confirmedConnection.at
        : null;
  const timer = connectedTimer(status.status, confirmedAt, now);
  const context =
    workspace.mode === 'inbound'
      ? workspace.mercuryCaller?.scopeKey === scope
        ? workspace.mercuryCaller.context
        : 'Inbound'
      : state.selectedQueue?.stageName || 'Outbound call';
  return `<div class="mercury-call-identity"><div><strong class="mercury-contact">${e(contact)}</strong><small>${e(context)}</small></div><div class="mercury-call-clock"><span data-session-status role="status">${e(status.label)}</span><time data-call-timer aria-label="Confirmed connected duration" title="${timer === '—' ? 'Confirmed connection time unavailable' : 'Time since confirmed connection'}">${timer}</time></div></div>`;
};

const manualView = (
  workspace: CallingWorkspace,
  scopeKey: string,
): MercuryCueView | null => {
  const script = workspace.coachingLibrary?.scripts.find(
    (s) => s.id === workspace.activeScriptId,
  );
  if (!script) return null;
  const steps = scriptSteps(script.content);
  const start = Math.max(
    0,
    Math.min(workspace.scriptStep ?? 0, Math.max(0, steps.length - 1)),
  );
  return {
    scopeKey,
    revision: script.revision,
    kind: 'manual',
    status: 'manual',
    heading: script.title,
    points: steps.slice(start, start + 4).map((text, i) => ({
      slotId: String(i),
      text,
      exact: text,
      source: `${script.title} · revision ${script.revision} · manual text library`,
    })),
  };
};

const statusText = (view: MercuryCueView | null): string =>
  !view
    ? 'Choose a saved script in Mercury settings.'
    : view.status === 'delayed'
      ? 'Transcript delayed · showing the last available cues'
      : view.status === 'reconnecting'
        ? 'Coaching reconnecting · your call controls still work'
        : view.status === 'unavailable'
          ? 'Live coaching unavailable · use your manual script'
          : view.status === 'manual' && view.kind === 'approved'
            ? 'Manual reference · approved playbook'
            : view.kind === 'manual'
              ? 'Manual script · navigate at your own pace'
              : 'Approved points';

export const renderMercuryCue = (
  workspace: CallingWorkspace,
  scopeKey: string,
): string => {
  const enabled = workspace.coachingMode === 'script';
  const card =
    workspace.mercuryCard?.scopeKey === scopeKey ? workspace.mercuryCard : null;
  const view = enabled ? (card ?? manualView(workspace, scopeKey)) : null;
  const points = view?.points.slice(0, 4) ?? [];
  const mode = workspace.coachingMode ?? 'off';
  const history = workspace.mercuryHistory ?? [];
  const historyIndex = history.findIndex((item) => item === card);
  const manualScript = workspace.coachingLibrary?.scripts.find(
    (script) => script.id === workspace.activeScriptId,
  );
  const manualCount = manualScript
    ? scriptSteps(manualScript.content).length
    : 0;
  const previousDisabled =
    !view ||
    workspace.mercuryFeedStatus === 'updating' ||
    (!workspace.mercuryRemote &&
      (view.kind === 'approved'
        ? historyIndex <= 0
        : (workspace.scriptStep ?? 0) <= 0));
  const nextDisabled =
    !view ||
    workspace.mercuryFeedStatus === 'updating' ||
    (!workspace.mercuryRemote &&
      (view.kind === 'approved'
        ? historyIndex < 0 || historyIndex >= history.length - 1
        : (workspace.scriptStep ?? 0) >= Math.max(0, manualCount - 4)));
  const feedStatus = workspace.mercuryFeedStatus;
  const assistanceStatus =
    feedStatus === 'connecting'
      ? 'Connecting assistance · manual script available'
      : feedStatus === 'updating'
        ? 'Updating your talking points'
        : feedStatus === 'reconnecting'
          ? 'Assistance reconnecting · your call controls still work'
          : feedStatus === 'unavailable' || feedStatus === 'denied'
            ? 'Live assistance unavailable · manual script available'
            : statusText(view);
  return `<section class="mercury-cue" data-mercury-scope="${e(scopeKey)}" aria-label="Mercury call assistance">
    <div class="mercury-cue-tools"><span class="mercury-label">Mercury</span><div class="mercury-mode" role="group" aria-label="Mercury mode">${(['off', 'script'] as const).map((value) => `<button type="button" data-action="coaching-mode" data-mode="${value}" aria-pressed="${mode === value}">${value === 'off' ? 'Off' : 'Script'}</button>`).join('')}<button type="button" data-mode="ai" disabled title="AI suggestions are not available yet">AI</button></div></div>
    <p class="mercury-cue-status" role="status">${enabled ? e(assistanceStatus) : 'Coaching off'}</p>
    <h2 class="mercury-cue-heading">${e(view?.heading ?? (enabled ? 'Your next talking points' : 'Stay focused on the conversation'))}</h2>
    <ol class="mercury-points" aria-label="${view?.kind === 'approved' ? 'Approved talking points' : 'Manual script excerpts'}">${Array.from({ length: 4 }, (_, i) => `<li data-cue-slot="${e(points[i]?.slotId ?? String(i))}"${points[i] ? '' : ' aria-hidden="true"'}>${e(points[i]?.text ?? '')}</li>`).join('')}</ol>
    ${enabled ? `<div class="mercury-navigation"><button type="button" class="text-button" data-action="script-previous"${previousDisabled ? ' disabled' : ''}>Previous</button><button type="button" class="text-button" data-action="mercury-pin" aria-pressed="${Boolean(workspace.mercuryPinned)}"${view && workspace.mercuryFeedStatus !== 'updating' ? '' : ' disabled'}>${workspace.mercuryPinned ? 'Unpin' : 'Pin'}</button><button type="button" class="text-button" data-action="script-next"${nextDisabled ? ' disabled' : ''}>Next</button></div>${card ? `<button type="button" class="text-button mercury-return" data-action="mercury-auto"${workspace.mercuryPinned || workspace.mercuryManualIndex !== undefined ? '' : ' disabled'}>Return to auto</button>` : ''}<details class="mercury-source" data-disclosure="mercury-source"><summary>Source &amp; exact wording</summary>${points.map((p) => `<p><strong>${e(p.source)}</strong><span>${e(p.exact)}</span></p>`).join('') || '<p>No script is selected. Open Mercury in Settings to choose one.</p>'}</details>` : ''}
  </section>`;
};
