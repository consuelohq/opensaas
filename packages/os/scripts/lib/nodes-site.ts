import { listManagedCloudPlans, listManagedCloudRegions } from './managed-cloud-pricing';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function nodesSiteStyles(): string {
  return `
    .nodes-surface { display: grid; gap: 18px; max-width: 1180px; }
    .nodes-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, 320px) auto; gap: 12px; align-items: end; padding-bottom: 16px; border-bottom: 1px solid var(--site-color-line-strong); }
    .nodes-toolbar-copy { display: grid; gap: 4px; }
    .nodes-toolbar-copy strong { font-size: 18px; font-weight: 500; }
    .nodes-summary-line { color: var(--site-color-muted); font: 11px/1.4 var(--site-font-mono); }
    .node-search-wrap { position: relative; }
    .node-search-wrap span { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--site-color-muted); font: 10px/1 var(--site-font-mono); text-transform: uppercase; pointer-events: none; }
    #node-search { min-height: 38px; padding-left: 66px; }
    .node-inventory { display: grid; }
    .node-list-header, .node-row { display: grid; grid-template-columns: minmax(190px, 1.35fr) 92px minmax(120px, .72fr) 120px 138px minmax(100px, .58fr); gap: 14px; align-items: center; }
    .node-list-header { min-height: 34px; border-bottom: 1px solid var(--site-color-line); color: var(--site-color-muted); font: 10px/1 var(--site-font-mono); text-transform: uppercase; letter-spacing: .04em; }
    .node-row { min-height: 62px; padding: 8px 0; border-bottom: 1px solid var(--site-color-line); }
    .node-row[hidden] { display: none; }
    .node-name { min-width: 0; display: grid; gap: 4px; }
    .node-name strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; font-weight: 500; }
    .node-name code, .node-meta-text, .node-seen { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--site-color-muted); font: 10px/1.35 var(--site-font-mono); }
    .node-role, .node-state { font: 10px/1.35 var(--site-font-mono); text-transform: uppercase; }
    .node-role { color: var(--site-color-muted); }
    .node-state { display: inline-flex; align-items: center; gap: 7px; color: var(--site-color-muted); }
    .node-state::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    .node-state[data-presence="online"] { color: var(--site-color-secondary); }
    .node-state[data-presence="stale"] { color: var(--site-color-accent); }
    .node-row-actions { justify-self: end; }
    .node-row-actions button { padding: 5px 8px; font: 10px/1 var(--site-font-mono); }
    .node-empty { display: grid; gap: 5px; padding: 28px 0; border-bottom: 1px solid var(--site-color-line); }
    .node-empty strong { font-size: 18px; font-weight: 500; }
    .node-feedback { min-height: 18px; color: var(--site-color-muted); font: 11px/1.4 var(--site-font-mono); }
    .node-dialog { width: min(760px, calc(100vw - 32px)); }
    .node-dialog .dialog-shell { gap: 22px; }
    .node-dialog-copy { display: grid; gap: 6px; max-width: 520px; }
    .node-dialog-copy h2 { font-size: clamp(26px, 4vw, 34px); }
    .node-plan-list { display: grid; border-top: 1px solid var(--site-color-line-strong); }
    .node-plan-option { position: relative; display: block; }
    .node-plan-option input { position: absolute; opacity: 0; pointer-events: none; }
    .node-plan-card { display: grid; grid-template-columns: minmax(130px, .75fr) minmax(180px, 1.25fr) auto; gap: 14px; align-items: center; min-height: 58px; padding: 10px 8px; border-bottom: 1px solid var(--site-color-line); cursor: pointer; }
    .node-plan-card:hover { background: var(--site-color-panel); }
    .node-plan-option input:checked + .node-plan-card { box-shadow: inset 3px 0 0 var(--site-color-accent); background: var(--site-color-panel); }
    .node-plan-option input:focus-visible + .node-plan-card { outline: 2px solid var(--site-color-accent); outline-offset: -2px; }
    .node-plan-name { display: flex; align-items: center; gap: 7px; }
    .node-plan-name strong { font-size: 15px; font-weight: 500; }
    .plan-recommended { color: var(--site-color-accent); font: 9px/1 var(--site-font-mono); text-transform: uppercase; }
    .node-plan-spec { color: var(--site-color-muted); font-size: 13px; }
    .plan-price { min-width: 100px; text-align: right; font-size: 18px; font-variant-numeric: tabular-nums; }
    .plan-price small { color: var(--site-color-muted); font-size: 11px; }
    .node-create-config { display: grid; grid-template-columns: minmax(0, 280px) minmax(0, 1fr); gap: 18px; align-items: end; }
    .node-create-note { color: var(--site-color-muted); font-size: 13px; line-height: 1.4; }
    .provisioning-progress { border-left: 2px solid var(--site-color-accent); padding: 2px 0 2px 14px; display: grid; gap: 4px; }
    @media (max-width: 820px) {
      .nodes-toolbar { grid-template-columns: 1fr auto; }
      .nodes-toolbar-copy { grid-column: 1 / -1; }
      .node-list-header { display: none; }
      .node-row { grid-template-columns: minmax(0, 1fr) auto; gap: 5px 12px; align-items: baseline; }
      .node-name { grid-column: 1; grid-row: 1; }
      .node-role { grid-column: 1; grid-row: 2; }
      .node-meta-text { grid-column: 1; grid-row: 3; }
      .node-seen { grid-column: 1; grid-row: 4; }
      .node-state { grid-column: 2; grid-row: 1; justify-self: end; }
      .node-row-actions { grid-column: 2; grid-row: 2 / span 3; align-self: center; }
      .node-plan-card { grid-template-columns: minmax(0, 1fr) auto; }
      .node-plan-spec { grid-column: 1; }
      .plan-price { grid-column: 2; grid-row: 1 / span 2; }
      .node-create-config { grid-template-columns: 1fr; }
    }
    @media (max-width: 520px) {
      .nodes-toolbar { grid-template-columns: 1fr; }
      .nodes-toolbar-copy, .node-search-wrap { grid-column: 1; }
      #add-node-button { width: 100%; }
      .node-plan-card { padding-left: 5px; padding-right: 5px; }
    }
  `;
}

export function renderNodesContent(): string {
  const planRows = listManagedCloudPlans().map((plan) => {
    const cpu = `${plan.cpu.vcpus}${plan.cpu.shared ? ' shared' : ''} vCPU`;
    const checked = plan.recommended ? ' checked' : '';
    const recommended = plan.recommended ? '<span class="plan-recommended">Recommended</span>' : '';
    return `<label class="node-plan-option"><input type="radio" name="cloud-plan" value="${escapeHtml(plan.id)}"${checked}><span class="node-plan-card"><span class="node-plan-name"><strong>${escapeHtml(plan.name)}</strong>${recommended}</span><span class="node-plan-spec">${escapeHtml(cpu)} · ${escapeHtml(String(plan.memoryGb))} GB RAM</span><span class="plan-price" data-plan-price="${escapeHtml(plan.id)}">Loading…</span></span></label>`;
  }).join('');
  const regionOptions = listManagedCloudRegions().map((region) =>
    `<option value="${escapeHtml(region.id)}">${escapeHtml(region.name)}</option>`,
  ).join('');

  return `
      <p id="node-loading" class="sr-only" aria-live="polite">Loading workspace nodes</p>
      <section id="node-error" class="state-panel" aria-live="polite" hidden>
        <strong>Nodes unavailable</strong>
        <p class="muted">Sign in again or verify the workspace control plane is available.</p>
      </section>
      <div id="node-content" aria-busy="true">
        <section class="nodes-surface">
          <div class="nodes-toolbar">
            <div class="nodes-toolbar-copy"><strong id="node-summary">0 nodes</strong><span class="nodes-summary-line">The default node handles calls that do not target a node explicitly.</span></div>
            <label class="node-search-wrap" for="node-search"><span>Search</span><input id="node-search" type="search" autocomplete="off" placeholder="name or node" /></label>
            <button id="add-node-button" class="primary-button" type="button">+ Add node</button>
          </div>
          <p id="node-feedback" class="node-feedback" aria-live="polite"></p>
          <div id="node-list" class="node-inventory" role="table" aria-label="Workspace nodes">
            <div class="node-list-header" role="row"><span role="columnheader">Node</span><span role="columnheader">Role</span><span role="columnheader">Platform</span><span role="columnheader">Seen</span><span role="columnheader">Status</span><span aria-hidden="true"></span></div>
            <div id="node-rows" role="rowgroup"></div>
          </div>
        </section>
      </div>
      <dialog id="add-node-dialog" class="node-dialog" aria-labelledby="add-node-title">
        <div class="dialog-shell">
          <header class="dialog-header">
            <div class="node-dialog-copy"><p class="identity">Managed by Consuelo</p><h2 id="add-node-title">Create cloud node</h2><p class="muted">Always available for agent work. Pick a plan and region; the shown monthly price is the checkout price.</p></div>
            <button id="add-node-close" class="dialog-close" type="button" aria-label="Close">×</button>
          </header>
          <section aria-labelledby="plan-heading"><h3 id="plan-heading">Plan</h3><div class="node-plan-list">${planRows}</div></section>
          <div class="node-create-config">
            <label class="field"><span>Region</span><select id="cloud-region">${regionOptions}</select></label>
            <p class="node-create-note">The price includes the managed node and operations. Consuelo will not create a paid node unless a current quote is available.</p>
          </div>
          <div class="actions"><button id="create-cloud-node-button" class="primary-button provisioning-button" type="button" disabled>Create cloud node</button><button id="add-node-cancel" type="button">Cancel</button></div>
          <p id="pricing-status" class="node-feedback" aria-live="polite">Loading current monthly prices…</p>
          <div id="provisioning-progress" class="provisioning-progress" aria-live="polite" hidden><strong id="provisioning-phase">Preparing cloud node</strong><p id="provisioning-detail" class="muted">Provisioning continues if you close this page.</p></div>
        </div>
      </dialog>`;
}

export function nodesClientScript(): string {
  return String.raw`
    const byId = (id) => document.getElementById(id);
    const setHidden = (id, value) => { const element = byId(id); if (element) element.hidden = value; };
    const setText = (id, value) => { const element = byId(id); if (element) element.textContent = value; };
    const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll(String.fromCharCode(34), '&quot;').replaceAll(String.fromCharCode(39), '&#39;');
    let currentNodeSnapshot = null;
    let currentNodes = [];
    let pricingRequestGeneration = 0;
    let currentPricing = null;
    let currentProvisioningJobId = null;
    let currentProvisioningKey = null;
    let provisioningPollTimer = null;

    const prettyPlatform = (value) => value === 'darwin' ? 'macOS' : value === 'linux' ? 'Linux' : value === 'win32' || value === 'windows' ? 'Windows' : (value || 'Unknown');
    const prettyPresence = (value) => value === 'online' ? 'Online' : value === 'stale' ? 'Stale' : 'Offline';
    const readableDate = (value) => { const date = new Date(String(value || '')); if (!Number.isFinite(date.getTime())) return '—'; return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date); };
    const csrfToken = () => { const part = document.cookie.split(';').map((value) => value.trim()).find((value) => value.startsWith('__Host-consuelo_os_csrf=')); return part ? decodeURIComponent(part.slice(part.indexOf('=') + 1)) : ''; };
    const selectedPlanId = () => { const input = document.querySelector('input[name="cloud-plan"]:checked'); return input instanceof HTMLInputElement ? input.value : ''; };
    const selectedRegionId = () => { const input = byId('cloud-region'); return input instanceof HTMLSelectElement ? input.value : ''; };
    const selectedQuote = () => { const planId = selectedPlanId(); const region = selectedRegionId(); const quotes = currentPricing && Array.isArray(currentPricing.quotes) ? currentPricing.quotes : []; return quotes.find((quote) => quote && quote.plan && quote.plan.id === planId && quote.region && quote.region.id === region) || null; };

    const nodeRow = (node) => {
      const isDefault = currentNodeSnapshot && currentNodeSnapshot.defaultNodeId === node.nodeId;
      const isCurrent = currentNodeSnapshot && currentNodeSnapshot.currentNodeId === node.nodeId;
      const online = node.presence === 'online' && node.state === 'active';
      const tags = [isDefault ? 'Default' : '', isCurrent ? 'Current' : ''].filter(Boolean).join(' · ');
      const role = tags || (node.role === 'home' ? 'Home' : 'Member');
      const action = isDefault
        ? '<button type="button" disabled>Default</button>'
        : '<button type="button" data-make-default="' + escapeHtml(node.nodeId) + '" ' + (online ? '' : 'disabled') + '>Make default</button>';
      const search = [node.displayName, node.nodeId, node.platform, node.channel, role, node.presence].join(' ').toLowerCase();
      return '<div class="node-row" role="row" data-node-search="' + escapeHtml(search) + '">' +
        '<div class="node-name" role="cell"><strong>' + escapeHtml(node.displayName || node.nodeId) + '</strong><code>' + escapeHtml(node.nodeId) + '</code></div>' +
        '<span class="node-role" role="cell">' + escapeHtml(role) + '</span>' +
        '<span class="node-meta-text" role="cell">' + escapeHtml(prettyPlatform(node.platform)) + ' · ' + escapeHtml(node.channel || 'standard') + '</span>' +
        '<span class="node-seen" role="cell">' + escapeHtml(readableDate(node.lastSeenAt)) + '</span>' +
        '<span class="node-state" role="cell" data-presence="' + escapeHtml(node.presence || 'offline') + '">' + escapeHtml(prettyPresence(node.presence)) + '</span>' +
        '<span class="node-row-actions" role="cell">' + action + '</span>' +
        '</div>';
    };

    function bindDefaultButtons() { document.querySelectorAll('[data-make-default]').forEach((button) => { button.addEventListener('click', () => void makeDefault(button.getAttribute('data-make-default') || '', button)); }); }
    function filterNodes() { const query = byId('node-search') instanceof HTMLInputElement ? byId('node-search').value.trim().toLowerCase() : ''; document.querySelectorAll('[data-node-search]').forEach((row) => { if (row instanceof HTMLElement) row.hidden = Boolean(query) && !(row.getAttribute('data-node-search') || '').includes(query); }); }
    function renderNodes(snapshot) {
      currentNodeSnapshot = snapshot;
      currentNodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : [];
      const rows = byId('node-rows');
      if (rows) rows.innerHTML = currentNodes.length ? currentNodes.map(nodeRow).join('') : '<div class="node-empty"><strong>No nodes yet</strong><span class="muted">Add a cloud node when you want Consuelo running without a local computer.</span></div>';
      const presence = snapshot.presence || {};
      setText('node-summary', currentNodes.length + (currentNodes.length === 1 ? ' node' : ' nodes') + ' · ' + String(presence.online || 0) + ' online');
      setHidden('node-loading', true); setHidden('node-error', true);
      const content = byId('node-content'); if (content) content.setAttribute('aria-busy', 'false');
      bindDefaultButtons(); filterNodes();
    }
    async function loadNodes() { try { const response = await fetch('/gateway/nodes/snapshot', { headers: { accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' }); if (!response.ok) throw new Error('nodes unavailable'); renderNodes(await response.json()); } catch { setHidden('node-loading', true); setHidden('node-error', false); const content = byId('node-content'); if (content) content.setAttribute('aria-busy', 'false'); } }
    async function makeDefault(nodeId, button) { const csrf = csrfToken(); if (!nodeId || !csrf) { setText('node-feedback', 'Refresh your workspace session before changing the default node.'); return; } if (button instanceof HTMLButtonElement) button.disabled = true; setText('node-feedback', 'Updating default node…'); try { const response = await fetch('/gateway/nodes/default', { method: 'POST', credentials: 'same-origin', headers: { accept: 'application/json', 'content-type': 'application/json', 'x-consuelo-csrf-token': csrf }, body: JSON.stringify({ nodeId }) }); if (!response.ok) throw new Error('default update denied'); await loadNodes(); setText('node-feedback', 'Default node updated.'); } catch { if (button instanceof HTMLButtonElement) button.disabled = false; setText('node-feedback', 'Default node update failed. The existing default was kept.'); } }

    const formatMonthlyPrice = (quote) => { if (!quote || !Number.isSafeInteger(quote.monthlyPriceCents)) return 'Unavailable'; const value = quote.monthlyPriceCents / 100; try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: quote.currency || 'USD', maximumFractionDigits: 0 }).format(value) + '<small>/month</small>'; } catch { return '$' + String(Math.ceil(value)) + '<small>/month</small>'; } };
    function updateCreateButton() { const button = byId('create-cloud-node-button'); if (!(button instanceof HTMLButtonElement)) return; const ready = Boolean(selectedQuote()) && !currentProvisioningJobId; button.disabled = !ready; button.textContent = currentProvisioningJobId ? 'Creating cloud node…' : 'Create cloud node'; }
    async function loadPricing() {
      const requestGeneration = ++pricingRequestGeneration;
      const selectedRegion = selectedRegionId() || 'us-east1';
      setText('pricing-status', 'Loading current monthly prices…'); currentPricing = null; updateCreateButton();
      try {
        const response = await fetch('/gateway/nodes/pricing?region=' + encodeURIComponent(selectedRegion), { headers: { accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) throw new Error('pricing unavailable');
        const payload = await response.json();
        if (requestGeneration !== pricingRequestGeneration) return;
        currentPricing = payload;
        const quotes = Array.isArray(payload.quotes) ? payload.quotes : [];
        document.querySelectorAll('[data-plan-price]').forEach((element) => { const quote = quotes.find((candidate) => candidate && candidate.plan && candidate.plan.id === element.getAttribute('data-plan-price')); element.innerHTML = formatMonthlyPrice(quote); });
        setText('pricing-status', payload.pricingAvailable ? 'Current monthly prices. Checkout uses the shown quote.' : 'Live pricing is unavailable. No paid node can be created until a current quote loads.');
        updateCreateButton();
      } catch {
        if (requestGeneration !== pricingRequestGeneration) return;
        document.querySelectorAll('[data-plan-price]').forEach((element) => { element.textContent = 'Unavailable'; });
        setText('pricing-status', 'Live pricing is unavailable. Try again in a moment.'); updateCreateButton();
      }
    }

    const provisioningCopy = (status) => status === 'requested' ? ['Request received', 'Your cloud node is queued.'] : status === 'provisioning' ? ['Creating cloud resources', 'Preparing compute, storage, and private networking.'] : status === 'booting' ? ['Installing Consuelo', 'The node is booting with the current Consuelo runtime.'] : status === 'connecting' ? ['Connecting your node', 'Consuelo is establishing the workspace connection.'] : status === 'ready' ? ['Cloud node ready', 'Your node is online.'] : status === 'failed' ? ['Cloud node needs attention', 'Provisioning did not finish. Retrying this request will not create a duplicate node.'] : ['Preparing cloud node', 'Provisioning is starting.'];
    function renderProvisioning(job) { if (!job) return; currentProvisioningJobId = job.jobId; const copy = provisioningCopy(job.status); setHidden('provisioning-progress', false); setText('provisioning-phase', copy[0]); setText('provisioning-detail', job.status === 'failed' && job.errorMessage ? job.errorMessage : copy[1]); updateCreateButton(); }
    function stopProvisioningPoll() { if (provisioningPollTimer) window.clearTimeout(provisioningPollTimer); provisioningPollTimer = null; }
    async function pollProvisioning() { if (!currentProvisioningJobId) return; try { const response = await fetch('/gateway/nodes/provisioning?job_id=' + encodeURIComponent(currentProvisioningJobId), { headers: { accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' }); if (!response.ok) throw new Error('status unavailable'); const payload = await response.json(); const job = payload && payload.job; renderProvisioning(job); if (job && job.status === 'ready') { stopProvisioningPoll(); await loadNodes(); currentProvisioningJobId = null; currentProvisioningKey = null; updateCreateButton(); window.setTimeout(() => { const dialog = byId('add-node-dialog'); if (dialog instanceof HTMLDialogElement) dialog.close(); }, 650); return; } if (job && job.status === 'failed') { stopProvisioningPoll(); currentProvisioningJobId = null; currentProvisioningKey = null; updateCreateButton(); return; } } catch { setText('provisioning-detail', 'The node is still being created. Status will retry automatically.'); } provisioningPollTimer = window.setTimeout(() => void pollProvisioning(), 2000); }
    async function createCloudNode() { const csrf = csrfToken(); const quote = selectedQuote(); if (!csrf || !quote) { setText('pricing-status', 'A current monthly quote is required before creating a node.'); return; } const button = byId('create-cloud-node-button'); if (button instanceof HTMLButtonElement) button.disabled = true; currentProvisioningKey = currentProvisioningKey || (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function' ? globalThis.crypto.randomUUID() : 'cloud-' + Date.now() + '-' + Math.random().toString(16).slice(2)); setHidden('provisioning-progress', false); setText('provisioning-phase', 'Creating cloud node'); setText('provisioning-detail', 'Submitting your quoted plan and region…'); try { const response = await fetch('/gateway/nodes/provision', { method: 'POST', credentials: 'same-origin', headers: { accept: 'application/json', 'content-type': 'application/json', 'x-consuelo-csrf-token': csrf }, body: JSON.stringify({ planId: quote.plan.id, region: quote.region.id, pricingVersion: quote.pricingVersion, idempotencyKey: currentProvisioningKey }) }); const payload = await response.json().catch(() => ({})); const job = payload && payload.job; if (!response.ok && response.status !== 409) throw new Error('create failed'); if (!job) throw new Error('missing job'); renderProvisioning(job); void pollProvisioning(); } catch { currentProvisioningJobId = null; setText('provisioning-phase', 'Cloud node was not created'); setText('provisioning-detail', 'Nothing was charged or provisioned. Check your connection and try again.'); updateCreateButton(); } }

    const dialog = byId('add-node-dialog');
    byId('node-search')?.addEventListener('input', filterNodes);
    byId('add-node-button')?.addEventListener('click', () => { if (dialog instanceof HTMLDialogElement) { currentProvisioningKey = null; setHidden('provisioning-progress', true); dialog.showModal(); void loadPricing(); } });
    byId('add-node-close')?.addEventListener('click', () => { if (dialog instanceof HTMLDialogElement) dialog.close(); });
    byId('add-node-cancel')?.addEventListener('click', () => { if (dialog instanceof HTMLDialogElement) dialog.close(); });
    byId('create-cloud-node-button')?.addEventListener('click', () => void createCloudNode());
    byId('cloud-region')?.addEventListener('change', () => void loadPricing());
    document.querySelectorAll('input[name="cloud-plan"]').forEach((input) => input.addEventListener('change', updateCreateButton));
    void loadNodes();
  `;
}
