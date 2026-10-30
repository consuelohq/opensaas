import type {
  LeadConnectorEmbedState,
  EmbedAdminCall,
} from './state-machine.js';
import {
  escapeHtml as e,
  callName,
  repName,
  dateTime,
  duration,
  titleCase,
  money,
} from './workspace-format.js';
import { icon } from './workspace-icons.js';
import { pageHeading } from './workspace-pages.js';
const card = (s: LeadConnectorEmbedState, c: EmbedAdminCall, active = false) =>
  `<button type="button" class="history-row" data-action="select-call" data-call-id="${e(c.id)}" data-call-session="${e(c.id)}"><span class="history-call-icon">${icon('phone')}</span><span><strong>${e(callName(s, c))}</strong><small>${e(dateTime(c.startedAt))} · ${e(repName(s, c.representative))}</small></span><span class="history-result"><strong>${e(titleCase(c.disposition ?? c.status))}</strong><small>${e(duration(active ? c.elapsedSeconds : c.durationSeconds))}</small></span>${icon('arrow')}</button>`;
export const renderHistory = (s: LeadConnectorEmbedState): string =>
  pageHeading('Call history', 'Your conversations and recent activity.') +
  `<div class="history-metrics"><div><span>Recent calls</span><strong>${s.callHistory.length}</strong></div><div><span>Active now</span><strong>${s.activeCalls.length}</strong></div></div>${s.activeCalls.length ? `<section class="settings-section"><h2>Active calls</h2>${s.activeCalls.map((c) => card(s, c, true)).join('')}</section>` : ''}<section class="settings-section"><div class="section-heading"><h2>Recent calls</h2><span>${s.callHistoryCursor ? 'Latest results' : 'All available calls'}</span></div>${s.callHistory.length ? s.callHistory.map((c) => card(s, c)).join('') : '<div class="page-empty">Your calls will appear here.</div>'}${s.callHistoryCursor ? '<button type="button" class="button button--secondary" data-action="load-more-history">Load earlier calls</button>' : ''}</section>`;
const field = (name: string, value: unknown) =>
  `<div><dt>${e(name)}</dt><dd>${e(value ?? '—')}</dd></div>`;
export const renderHistoryDetail = (s: LeadConnectorEmbedState): string => {
  const d = s.selectedCallDetail;
  if (!d)
    return (
      pageHeading('Call details') +
      '<p class="page-empty" role="status">Loading conversation…</p>'
    );
  const transcript =
    d.transcriptStatus === 'ready' && s.selectedCallTranscript.length
      ? `<ol class="transcript-list">${s.selectedCallTranscript.map((t) => `<li><strong>${e(t.speaker === 'inbound' ? 'Caller' : t.speaker === 'outbound' ? 'Rep' : titleCase(t.speaker))}</strong><p>${e(t.text)}</p></li>`).join('')}</ol>`
      : `<p class="page-empty">${d.transcriptStatus === 'processing' ? 'Transcript is processing.' : d.transcriptStatus === 'failed' ? 'Transcript could not be processed.' : 'No transcript for this call.'}</p>`;
  const opportunity = (o: typeof d.opportunity) =>
    o
      ? e(titleCase(o.status ?? 'Open')) +
        (o.monetaryValue != null ? ' · ' + e(money(o.monetaryValue * 100)) : '')
      : 'Not linked';
  return (
    pageHeading(callName(s, d), dateTime(d.startedAt)) +
    `<section class="call-detail" data-call-detail="${e(d.id)}"><div class="detail-status"><span class="quiet-chip">${e(titleCase(d.status))}</span><span>${e(duration(d.durationSeconds))}</span></div><dl class="detail-list">${field('Rep', repName(s, d.representative))}${field('Outcome', d.disposition ? titleCase(d.disposition) : 'Not recorded')}${field('Numbers dialed', d.calls.length)}${field('CRM sync', titleCase(d.crmSyncStatus ?? 'Not started'))}</dl><section class="settings-section"><h2>Notes</h2><p>${e(d.note || 'No notes added.')}</p>${d.tags?.length ? `<div class="tag-list">${d.tags.map((t) => `<span class="quiet-chip">${e(t)}</span>`).join('')}</div>` : ''}</section><section class="settings-section"><h2>Opportunity</h2><dl class="detail-list"><div><dt>At the time of the call</dt><dd>${opportunity(d.opportunity)}</dd></div><div><dt>Current</dt><dd>${opportunity(d.currentOpportunity)}</dd></div></dl></section><section class="settings-section"><h2>Call transcript</h2>${transcript}</section>${d.transferEvents?.length ? `<section class="settings-section"><h2>Transfers</h2><ul class="transfer-event-list">${d.transferEvents.map((t) => `<li><strong>${e(titleCase(t.type))}</strong><small>${e(dateTime(t.createdAt))}</small></li>`).join('')}</ul></section>` : ''}</section>`
  );
};
