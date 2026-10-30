import type { LeadConnectorEmbedState } from './state-machine.js';
import type { CallingWorkspace } from './calling-workspace.js';
import { icon } from './workspace-icons.js';
import {
  escapeHtml as e,
  planName,
  repName,
  formatPhone,
  recordValue,
  money,
  titleCase,
} from './workspace-format.js';

export const pageHeading = (title: string, caption?: string) =>
  `<header class="page-heading"><h1 id="workspace-page-title" tabindex="-1">${e(title)}</h1>${caption ? `<p>${e(caption)}</p>` : ''}</header>`;
const row = (
  action: string,
  name: string,
  caption: string,
  glyph: Parameters<typeof icon>[0],
) =>
  `<button type="button" class="navigation-row" data-action="workspace-${action}"><span class="navigation-icon">${icon(glyph)}</span><span><strong>${e(name)}</strong><small>${e(caption)}</small></span>${icon('arrow')}</button>`;
const claim = (state: LeadConnectorEmbedState) =>
  state.commercialDashboard &&
  !state.commercialDashboard.subscription &&
  Object.hasOwn(state.commercialDashboard, 'publicPurchase')
    ? '<details class="purchase-code" data-disclosure="purchase-claim"><summary>Already checked out?</summary><form data-form="commercial-purchase-claim"><label>Setup code<input name="setupCode" type="password" autocomplete="off" spellcheck="false" required placeholder="Paste your checkout code" /></label><button type="submit" class="button button--secondary">Connect purchase</button></form></details>'
    : '';
const upgrade = (state: LeadConnectorEmbedState) =>
  `<button type="button" class="button button--primary" data-action="manage-billing"${state.commercialDashboard && Object.hasOwn(state.commercialDashboard, 'publicPurchase') ? '' : ' disabled'}>${state.commercialDashboard?.subscription ? 'Manage subscription' : 'Upgrade your plan'} ${icon('outgoing')}</button>`;

const people = (state: LeadConnectorEmbedState) => {
  const ids = new Set<string>();
  if (state.inboundOperator.rep.repId) ids.add(state.inboundOperator.rep.repId);
  for (const s of state.commercialDashboard?.seats ?? []) {
    const id = String(s.user_id ?? s.userId ?? '');
    if (id) ids.add(id);
  }
  return [...ids].map((id) => ({ id, label: repName(state, id) }));
};
const personOptions = (state: LeadConnectorEmbedState, current?: string) =>
  people(state)
    .map(
      (p) =>
        `<option value="${e(p.id)}"${p.id === current ? ' selected' : ''}>${e(p.label)}</option>`,
    )
    .join('');
const planOptions = (state: LeadConnectorEmbedState) =>
  Object.entries(state.commercialDashboard?.catalog.plans ?? {})
    .map(
      ([key, p]) =>
        `<option value="${key}">${e(p.name ?? { single: 'Professional', standard: 'Agency', power: 'Enterprise' }[key] ?? 'Plan')}</option>`,
    )
    .join('');
const loading = () =>
  '<p class="page-empty" role="status">Loading workspace…</p>';

const billing = (state: LeadConnectorEmbedState): string => {
  const d = state.commercialDashboard,
    c = state.commercialCaller;
  if (!d || !c) return loading();
  const status = String(d.subscription?.status ?? 'starter');
  const used = Math.max(0, c.connectedMinutes);
  const remaining = c.remainingMinutes;
  const total = remaining === null ? null : used + Math.max(0, remaining);
  const purchase = d.publicPurchase;
  const recovery = ['past_due', 'unpaid'].includes(status);
  const cancelled = Boolean(
    d.subscription?.cancel_at_period_end ?? d.subscription?.cancelAtPeriodEnd,
  );
  return (
    pageHeading('Plan & billing', 'Your subscription, minutes and invoices.') +
    `
    <section class="plan-summary"><span class="section-label">CURRENT PLAN</span><div class="plan-title"><h2>${e(planName(state))}</h2><span class="quiet-chip">${cancelled ? 'Cancels at period end' : recovery ? 'Payment needs attention' : c.trial ? 'Free' : 'Active'}</span></div>
    ${purchase ? `<p>${purchase.seats} ${purchase.seats === 1 ? 'seat' : 'seats'} · ${purchase.billing === 'annual' ? 'Billed annually' : 'Billed monthly'}</p><p class="plan-price">${money(purchase.recurringCents)} <small>/ ${purchase.billing === 'annual' ? 'year' : 'month'}</small></p>` : ''}
    ${upgrade(state)}<p class="form-caption">Subscription options and payment open securely in Stripe.</p></section>
    ${recovery ? '<p class="notice notice--error" role="alert">Update your payment method to keep calling.</p>' : ''}
    <section class="settings-section"><div class="section-heading"><h2>Calling minutes</h2><span>${c.trial ? 'Starter allowance' : 'Current billing period'}</span></div>
    <div class="usage-total"><strong>${remaining === null ? 'Unlimited' : e(Math.max(0, remaining).toLocaleString())}</strong><span>${remaining === null ? 'calling minutes' : 'minutes remaining'}</span></div>
    ${total !== null && total > 0 ? `<meter min="0" max="${total}" value="${Math.min(used, total)}" aria-label="Connected minutes used"></meter>` : ''}
    <div class="usage-labels"><span>${e(used.toLocaleString())} used</span><span>${total === null ? 'No fixed allowance' : e(total.toLocaleString()) + ' included'}</span></div></section>
    <section class="settings-section"><h2>Invoices & payment</h2>${d.subscription ? '<p>View invoices, update your card or manage cancellation in Stripe.</p><button type="button" class="button button--secondary" data-action="manage-billing">Open billing portal</button>' : '<p>No invoices yet. You can use Starter without adding a card.</p>'}</section>
    ${claim(state)}`
  );
};
const team = (state: LeadConnectorEmbedState): string => {
  const d = state.commercialDashboard;
  if (!d) return loading();
  const rows = d.seats
    .map(
      (s) =>
        `<li class="member-row"><span class="member-avatar">${e(repName(state, s.user_id ?? s.userId).slice(0, 1))}</span><span><strong>${e(repName(state, s.user_id ?? s.userId))}</strong><small>${e(d.catalog.plans[String(s.plan_code ?? s.planCode) as 'single']?.name ?? planName(state))}</small></span><span class="quiet-chip">${e(titleCase(String(s.status ?? 'active')))}</span></li>`,
    )
    .join('');
  return (
    pageHeading('Team & seats', 'Choose who can call with your workspace.') +
    `<ul class="member-list">${rows || '<li class="page-empty">No paid seats assigned yet.</li>'}</ul><section class="settings-section"><h2>Assign a seat</h2><form data-form="commercial-seat"><label>Team member<select name="userId" required>${personOptions(state)}</select></label><label>Plan<select name="planCode">${planOptions(state)}</select></label><button type="submit" class="button button--primary"${people(state).length ? '' : ' disabled'}>Save seat</button></form></section>`
  );
};
const numbers = (state: LeadConnectorEmbedState): string => {
  const d = state.commercialDashboard;
  if (!d) return loading();
  const rows = d.numbers
    .map((n) => {
      const phone = String(recordValue(n, 'phone_number', 'phoneNumber') ?? ''),
        status = String(n.status ?? 'active');
      return `<li class="number-row"><span class="navigation-icon">${icon('phone')}</span><span><strong>${e(formatPhone(phone))}</strong><small>${e(repName(state, n.user_id ?? n.userId))} · ${e(titleCase(status))}</small></span>${status === 'active' ? `<button type="button" class="text-button danger-text" data-action="request-release-number" data-phone-number="${e(phone)}">Remove</button>` : ''}</li>`;
    })
    .join('');
  const results = state.commercialNumberSearchResults
    .map((n) => {
      const phone = String(n.phoneNumber ?? n.phone_number ?? '');
      return `<li class="number-row"><span><strong>${e(formatPhone(phone))}</strong><small>${e([n.city, n.state].filter(Boolean).join(', ') || 'US local number')}</small></span><button type="button" class="button button--secondary" data-action="provision-number" data-phone-number="${e(phone)}">Add number</button></li>`;
    })
    .join('');
  return (
    pageHeading('Phone numbers', 'Your calling numbers, in one place.') +
    `<ul class="number-list">${rows || '<li class="page-empty">No calling numbers yet.</li>'}</ul><section class="settings-section"><h2>Add a number</h2><form data-form="commercial-number-search"><label>Area code<input name="query" inputmode="numeric" placeholder="e.g. 212" required /></label><label>Assign to<select name="userId" required>${personOptions(state, state.commercialNumberTargetUserId)}</select></label><button type="submit" class="button button--secondary"${people(state).length ? '' : ' disabled'}>Find numbers</button></form><p class="form-caption">An additional number slot is ${money(d.catalog.additionalNumberPriceCents)}/month. Included slots follow your plan.</p><ul class="number-list">${results}</ul></section>`
  );
};
const mercury = (
  state: LeadConnectorEmbedState,
  workspace: CallingWorkspace,
): string => {
  const lib = workspace.coachingLibrary,
    draft = workspace.scriptDraft,
    active = workspace.scriptId
      ? lib?.scripts.find((s) => s.id === workspace.scriptId)
      : null;
  if (active && !draft)
    return (
      pageHeading(active.title, 'Mercury · Team script') +
      `<div class="script-reader">${e(active.content)}</div>${active.canEdit ? `<button type="button" class="button button--secondary" data-action="script-edit" data-script-id="${e(active.id)}">Edit script</button>` : ''}`
    );
  if (draft)
    return (
      pageHeading(
        draft.expectedRevision ? 'Edit script' : 'Add a call script',
        'Text and Markdown, up to 100 KB.',
      ) +
      `<form data-form="coaching-script"><label class="file-import">${icon('upload')}<span>Import a script</span><input type="file" data-field="script-file" accept=".txt,.md,text/plain,text/markdown" /></label><label>Script name<input name="title" required maxlength="120" value="${e(draft.title)}" placeholder="e.g. First conversation" /></label><label>Script<textarea name="content" required maxlength="100000" rows="11" placeholder="Your opening, discovery questions and next steps…">${e(draft.content)}</textarea></label><p class="form-caption">Saved scripts are shared with this workspace. Live AI coaching is configured separately.</p><div class="button-row"><button type="button" class="button button--secondary" data-action="script-cancel">Cancel</button><button type="submit" class="button button--primary"${workspace.scriptSaving ? ' disabled' : ''}>${workspace.scriptSaving ? 'Saving…' : 'Save script'}</button></div></form>`
    );
  return (
    pageHeading('Mercury', 'Keep your team’s playbook close.') +
    `<section class="mercury-intro"><span class="mercury-symbol">${icon('script')}</span><h2>Scripts for your calling day.</h2><p>Upload a playbook or write one here. Open a script whenever you need it.</p><button type="button" class="button button--primary" data-action="script-new"${lib ? '' : ' disabled'}>${icon('upload')} Add a script</button></section><section class="settings-section"><h2>Your scripts</h2>${lib ? (lib.scripts.length ? `<div class="navigation-list">${lib.scripts.map((s) => `<button type="button" class="navigation-row" data-action="script-open" data-script-id="${e(s.id)}"><span class="navigation-icon">${icon('script')}</span><span><strong>${e(s.title)}</strong><small>Team script</small></span>${icon('arrow')}</button>`).join('')}</div>` : '<p>No scripts yet. Add your first playbook above.</p>') : '<p class="page-empty">Loading your script library…</p>'}</section>`
  );
};
export const renderWorkspacePage = (
  state: LeadConnectorEmbedState,
  workspace: CallingWorkspace,
): string => {
  if (workspace.screen === 'billing') return billing(state);
  if (workspace.screen === 'team') return team(state);
  if (workspace.screen === 'numbers') return numbers(state);
  if (workspace.screen === 'mercury') return mercury(state, workspace);
  if (workspace.screen === 'appearance')
    return (
      pageHeading('Appearance', 'Make the workspace comfortable for you.') +
      `<fieldset class="theme-choices"><legend>Color theme</legend>${(['system', 'light', 'dark'] as const).map((t) => `<button type="button" class="theme-choice" data-action="workspace-theme" data-theme-value="${t}" aria-pressed="${(workspace.theme ?? 'system') === t}"><span class="theme-preview theme-preview--${t}">${icon(t === 'system' ? 'browser' : 'sun')}</span>${t === 'system' ? 'Match your system' : titleCase(t)}</button>`).join('')}</fieldset>`
    );
  return (
    pageHeading('Settings', 'A few things to make calling yours.') +
    `<section class="settings-plan"><span class="section-label">YOUR PLAN</span><div><h2>${e(planName(state))}</h2><button type="button" class="text-button" data-action="workspace-billing">Manage plan ${icon('arrow')}</button></div></section><div class="navigation-list">${row('team', 'Team & seats', 'People who call with you', 'team')}${row('numbers', 'Phone numbers', 'Manage your calling numbers', 'phone')}${row('billing', 'Plan & billing', 'Minutes, subscription and invoices', 'card')}${row('mercury', 'Mercury', 'Call scripts for your team', 'script')}${row('appearance', 'Appearance', 'Light, dark or system theme', 'sun')}</div>`
  );
};
