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
    ${purchase?.separateInvoices ? `<p class="form-caption">${purchase.mercurySeats ? 'Mercury is included for every paid seat.' : 'Add or remove Mercury with your plan in Stripe.'}</p>` : ''}
    ${upgrade(state)}<p class="form-caption">Subscription options and payment open securely in Stripe.</p></section>
    ${recovery ? '<p class="notice notice--error" role="alert">Update your payment method to keep calling.</p>' : ''}
    ${purchase?.paymentPending ? '<p class="notice" role="status">Stripe is processing a billing change. Your confirmed allowance stays in effect until payment is confirmed.</p>' : ''}
    ${c.denialCode === 'SUBSCRIPTION_CAPACITY_EXCEEDED' ? '<p class="notice notice--error" role="alert">Your assigned reps or phone numbers exceed your paid allowance. Update assignments or manage your plan before starting another call.</p>' : ''}
    ${purchase?.separateInvoices ? `<section class="settings-section"><h2>Extra number pool</h2><p>${['past_due', 'unpaid', 'incomplete'].includes(purchase.numberStatus ?? '') ? 'Number-pack payment needs attention. Open Stripe to review the invoice.' : purchase.numberPack ? `${purchase.numberPack} extra numbers · ${money(purchase.numberRecurringCents ?? 0)} / ${purchase.numberBilling === 'annual' ? 'year' : 'month'}` : 'No extra numbers selected.'}</p><button type="button" class="button button--secondary" data-action="manage-number-billing">Manage number pack ${icon('outgoing')}</button><p class="form-caption">Your number pack has a separate invoice. Choose or remove a pack securely in Stripe.</p></section>` : ''}
    <section class="settings-section"><div class="section-heading"><h2>Calling minutes</h2><span>${c.trial ? 'Starter allowance' : 'Current billing period'}</span></div>
    <div class="usage-total"><strong>${remaining === null ? 'Unlimited' : e(Math.max(0, remaining).toLocaleString())}</strong><span>${remaining === null ? 'calling minutes' : 'minutes remaining'}</span></div>
    ${total !== null && total > 0 ? `<meter min="0" max="${total}" value="${Math.min(used, total)}" aria-label="Connected minutes used"></meter>` : ''}
    <div class="usage-labels"><span>${e(used.toLocaleString())} used</span><span>${total === null ? 'No fixed allowance' : e(total.toLocaleString()) + ' included'}</span></div>${purchase?.separateInvoices ? '<button type="button" class="button button--secondary" data-action="buy-minute-pack">Buy extra minutes</button><p class="form-caption">Choose a one-time minute pack in Stripe. No recurring subscription is added.</p>' : ''}</section>
    <section class="settings-section"><h2>Invoices & payment</h2>${d.subscription ? '<p>View invoices, update your card or manage cancellation in Stripe.</p><button type="button" class="button button--secondary" data-action="manage-billing">Open billing portal</button>' : '<p>No invoices yet. You can use Starter without adding a card.</p>'}</section>
    ${claim(state)}`
  );
};
const team = (state: LeadConnectorEmbedState): string => {
  const d = state.commercialDashboard;
  if (!d) return loading();
  const seats = d.seats;
  const capacity = d.publicPurchase?.seats;
  return (
    pageHeading('Team & seats', 'People with access to your Dialer.') +
    `<p class="team-summary">${state.commercialCaller?.trial ? 'Starter includes your access.' : `${seats.length} assigned${capacity ? ' of ' + capacity + ' paid seats' : ''}.`}</p><ul class="member-list">${seats.length ? seats.map((s) => `<li class="member-row"><span class="member-avatar">${e(repName(state, s.user_id ?? s.userId).slice(0, 1))}</span><span><strong>${e(repName(state, s.user_id ?? s.userId))}</strong><small>${e(planName(state))}</small></span><span class="quiet-chip">${e(titleCase(String(s.status ?? 'active')))}</span></li>`).join('') : '<li class="member-row"><span class="member-avatar">Y</span><span><strong>You</strong><small>Starter access</small></span></li>'}</ul><section class="settings-section"><h2>Growing your team</h2><p>Team membership belongs to your CRM location. Your paid plan and seat quantity are managed in Stripe.</p><button type="button" class="button button--secondary" data-action="manage-billing">${d.subscription ? 'Manage paid seats' : 'Choose a team plan'}</button></section>`
  );
};
const numbers = (
  state: LeadConnectorEmbedState,
  workspace: CallingWorkspace,
): string => {
  const d = state.commercialDashboard;
  if (!d) return loading();
  const tabs = `<div class="setup-tabs" role="tablist" aria-label="Phone number purpose"><button type="button" role="tab" aria-selected="${workspace.numberTab !== 'call-from'}" data-action="numbers-receive">Receive calls</button><button type="button" role="tab" aria-selected="${workspace.numberTab === 'call-from'}" data-action="numbers-call-from">Call from</button></div>`;
  if (workspace.numberTab !== 'call-from')
    return (
      pageHeading('Phone numbers', 'Choose how callers reach you.') +
      tabs +
      `<section class="settings-section"><h2>Your team’s inbound number</h2><p>${e(state.inboundOperator.configuration.maskedNumber || 'Not configured yet')}</p><p class="form-caption">Customers call this number to reach your team.</p></section><section class="settings-section"><h2>Your answering devices</h2><div class="navigation-list">${[
        ...state.inboundOperator.rep.endpoints,
      ]
        .sort(
          (a, b) => Number(b.kind === 'browser') - Number(a.kind === 'browser'),
        )
        .map(
          (device) =>
            `<div class="navigation-row"><span class="navigation-icon">${icon(device.kind === 'browser' ? 'browser' : 'phone')}</span><span><strong>${device.kind === 'browser' ? 'This browser' : 'Forwarding phone'}</strong><small>${device.kind === 'browser' ? 'Use your microphone and speakers' : 'Your personal phone that rings for incoming calls'}</small></span><span class="quiet-chip">${device.healthy ? 'Configured' : 'Unavailable'}</span></div>`,
        )
        .join(
          '',
        )}</div><p class="form-caption">Forwarding phone changes are managed by your workspace administrator. Selecting a device on Inbound does not change your Call from numbers.</p></section>`
    );
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
    pageHeading('Phone numbers', 'Numbers customers see when you call.') +
    tabs +
    `<ul class="number-list">${rows || '<li class="page-empty">No calling numbers yet.</li>'}</ul><section class="settings-section"><h2>Add a number</h2><form data-form="commercial-number-search"><label>Area code<input name="query" inputmode="numeric" placeholder="e.g. 212" required /></label><label>Assign to<select name="userId" required>${personOptions(state, state.commercialNumberTargetUserId)}</select></label><button type="submit" class="button button--secondary"${people(state).length ? '' : ' disabled'}>Find numbers</button></form><p class="form-caption">An additional number slot is ${money(d.catalog.additionalNumberPriceCents)}/month. Included slots follow your plan.</p><ul class="number-list">${results}</ul></section>`
  );
};
const mercury = (
  state: LeadConnectorEmbedState,
  workspace: CallingWorkspace,
): string => {
  const preferences = `<div class="coaching-modes" role="group" aria-label="Mercury mode">${(['off', 'script'] as const).map((mode) => `<button type="button" data-action="coaching-mode" data-mode="${mode}" aria-pressed="${(workspace.coachingMode ?? 'off') === mode}">${mode === 'off' ? 'Off' : 'Script mode'}</button>`).join('')}<button type="button" disabled>AI mode · coming soon</button></div>${workspace.coachingMode === 'script' ? `<label class="active-script-field">Call script<select data-field="active-script"><option value="">Choose a saved script</option>${(workspace.coachingLibrary?.scripts ?? []).map((s) => `<option value="${e(s.id)}"${s.id === workspace.activeScriptId ? ' selected' : ''}>${e(s.title)}</option>`).join('')}</select></label><p class="form-caption">Your script appears one cue at a time during connected calls.</p>` : ''}`;
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
    preferences +
    `<section class="mercury-intro"><span class="mercury-symbol">${icon('script')}</span><h2>Scripts for your calling day.</h2><p>Upload a playbook or write one here. Open a script whenever you need it.</p><button type="button" class="button button--primary" data-action="script-new"${lib ? '' : ' disabled'}>${icon('upload')} Add a script</button></section><section class="settings-section"><h2>Your scripts</h2>${lib ? (lib.scripts.length ? `<div class="navigation-list">${lib.scripts.map((s) => `<button type="button" class="navigation-row" data-action="script-open" data-script-id="${e(s.id)}"><span class="navigation-icon">${icon('script')}</span><span><strong>${e(s.title)}</strong><small>Team script</small></span>${icon('arrow')}</button>`).join('')}</div>` : '<p>No scripts yet. Add your first playbook above.</p>') : '<p class="page-empty">Loading your script library…</p>'}</section>`
  );
};
export const renderWorkspacePage = (
  state: LeadConnectorEmbedState,
  workspace: CallingWorkspace,
): string => {
  if (workspace.screen === 'billing') return billing(state);
  if (workspace.screen === 'team') return team(state);
  if (workspace.screen === 'numbers') return numbers(state, workspace);
  if (workspace.screen === 'mercury') return mercury(state, workspace);
  if (workspace.screen === 'appearance')
    return (
      pageHeading('Appearance', 'Make the workspace comfortable for you.') +
      `<fieldset class="theme-choices"><legend>Color theme</legend>${(['system', 'light', 'dark'] as const).map((t) => `<button type="button" class="theme-choice" data-action="workspace-theme" data-theme-value="${t}" aria-pressed="${(workspace.theme ?? 'system') === t}"><span class="theme-preview theme-preview--${t}">${icon(t === 'system' ? 'browser' : 'sun')}</span>${t === 'system' ? 'Match your system' : titleCase(t)}</button>`).join('')}</fieldset>`
    );
  return (
    pageHeading('Settings', 'A few things to make calling yours.') +
    `<section class="settings-plan"><span class="section-label">YOUR PLAN</span><div><h2>${e(planName(state))}</h2><button type="button" class="text-button" data-action="workspace-billing">Manage plan ${icon('arrow')}</button></div></section><div class="navigation-list">${row('numbers', 'Phone numbers', 'Answering devices and calling numbers', 'phone')}${row('mercury', 'Mercury', 'Call scripts for your team', 'script')}${row('team', 'Team & seats', 'People with Dialer access', 'team')}${row('billing', 'Plan & billing', 'Minutes, subscription and invoices', 'card')}${row('appearance', 'Appearance', 'Light, dark or system theme', 'sun')}</div>`
  );
};
