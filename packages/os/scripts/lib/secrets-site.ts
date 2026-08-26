/**
 * Secrets management surface. Kept separate from shared workspace chrome so route-menu,
 * Overview, mobile navigation, and theme work can evolve independently.
 */

export function secretsSiteStyles(): string {
  return `
.secrets-surface { display: grid; gap: 18px; max-width: 1120px; }
.secret-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, 320px) auto; gap: 12px; align-items: end; padding-bottom: 16px; border-bottom: 1px solid var(--site-color-line-strong); }
.secret-toolbar-copy { display: grid; gap: 4px; }
.secret-toolbar-copy strong { font-size: 18px; font-weight: 500; }
.secret-summary-line { color: var(--site-color-muted); font-family: var(--site-font-mono); font-size: 11px; }
.secret-search-wrap { position: relative; }
.secret-search-wrap span { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--site-color-muted); font-family: var(--site-font-mono); font-size: 10px; text-transform: uppercase; pointer-events: none; }
#secret-search { min-height: 38px; padding-left: 66px; }
.secret-list { display: grid; }
.secret-list-header, .secret-row { display: grid; grid-template-columns: minmax(170px, 1.3fr) 108px minmax(130px, .85fr) 150px 92px 84px; gap: 14px; align-items: center; }
.secret-list-header { min-height: 34px; border-bottom: 1px solid var(--site-color-line); color: var(--site-color-muted); font-family: var(--site-font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
.secret-row { min-height: 58px; border-bottom: 1px solid var(--site-color-line); }
.secret-name { min-width: 0; font-family: var(--site-font-mono); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.secret-hidden-value { color: var(--site-color-muted); letter-spacing: .12em; font-family: var(--site-font-mono); }
.secret-node, .secret-updated { min-width: 0; color: var(--site-color-muted); font-family: var(--site-font-mono); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.secret-status { color: var(--site-color-secondary); font-family: var(--site-font-mono); font-size: 10px; text-transform: uppercase; }
.secret-replace { justify-self: end; padding: 5px 8px; border-color: transparent; background: transparent; font-family: var(--site-font-mono); font-size: 10px; }
.secret-empty { display: grid; place-items: start; gap: 5px; padding: 28px 0; border-bottom: 1px solid var(--site-color-line); }
.secret-empty strong { font-size: 18px; font-weight: 500; }
.secret-dialog { width: min(620px, calc(100vw - 32px)); }
.secret-dialog-form { display: grid; gap: 22px; }
.secret-dialog-copy { display: grid; gap: 6px; max-width: 470px; }
.secret-dialog-copy h2 { font-size: clamp(26px, 4vw, 34px); }
.secret-form-fields { display: grid; gap: 14px; }
.secret-value-note { color: var(--site-color-secondary); font-size: 13px; }
.secret-form-status { min-height: 18px; color: var(--site-color-muted); font-family: var(--site-font-mono); font-size: 10px; }
@media (max-width: 820px) {
  .secret-toolbar { grid-template-columns: 1fr auto; }
  .secret-toolbar-copy { grid-column: 1 / -1; }
  .secret-search-wrap { min-width: 0; }
  .secret-list-header { display: none; }
  .secret-row { grid-template-columns: minmax(0, 1fr) auto; gap: 5px 12px; padding: 13px 0; align-items: baseline; }
  .secret-name { grid-column: 1; grid-row: 1; }
  .secret-hidden-value { grid-column: 1; grid-row: 2; }
  .secret-node { grid-column: 1; grid-row: 3; }
  .secret-updated { grid-column: 1; grid-row: 4; }
  .secret-status { grid-column: 2; grid-row: 1; justify-self: end; }
  .secret-replace { grid-column: 2; grid-row: 2 / span 3; align-self: center; }
}
@media (max-width: 520px) {
  .secret-toolbar { grid-template-columns: 1fr; }
  .secret-toolbar-copy, .secret-search-wrap { grid-column: 1; }
  #add-secret-button { width: 100%; }
}
  `;
}

export function secretsClientScript(): string {
  return `
    const byId = (id) => document.getElementById(id);
    const setHidden = (id, value) => { const element = byId(id); if (element) element.hidden = value; };
    const setText = (id, value) => { const element = byId(id); if (element) element.textContent = value; };
    let secretBindings = [];
    let secretSetup = null;

    const readableDate = (value) => {
      const date = new Date(String(value || ''));
      if (!Number.isFinite(date.getTime())) return '—';
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    };

    const toBase64 = (bytes) => {
      let binary = '';
      for (const value of bytes) binary += String.fromCharCode(value);
      return globalThis.btoa(binary);
    };
    const utf8 = (value) => new TextEncoder().encode(value);
    const concatBytes = (first, second) => {
      const result = new Uint8Array(first.length + second.length);
      result.set(first, 0);
      result.set(second, first.length);
      return result;
    };

    async function sealSecret(setup, bindingId, plaintext) {
      try {
        if (!globalThis.crypto || !globalThis.crypto.subtle || setup.algorithm !== 'X25519') {
          throw new Error('sealed secret setup is unavailable');
        }
        const recipient = {
        workspaceId: setup.workspaceId,
        nodeId: setup.nodeId,
        bindingId,
      };
      const recipientPublicKey = await globalThis.crypto.subtle.importKey(
        'jwk',
        JSON.parse(setup.publicKeyJwk),
        { name: 'X25519' },
        false,
        [],
      );
      const ephemeral = await globalThis.crypto.subtle.generateKey(
        { name: 'X25519' },
        true,
        ['deriveBits'],
      );
      const ephemeralPublicJwk = await globalThis.crypto.subtle.exportKey('jwk', ephemeral.publicKey);
      const ephemeralPublicKeyJwk = JSON.stringify(ephemeralPublicJwk);
      const sharedSecret = await globalThis.crypto.subtle.deriveBits(
        { name: 'X25519', public: recipientPublicKey },
        ephemeral.privateKey,
        256,
      );
      const hkdfKey = await globalThis.crypto.subtle.importKey(
        'raw',
        sharedSecret,
        { name: 'HKDF' },
        false,
        ['deriveBits'],
      );
      const associatedData = utf8(JSON.stringify([
        1,
        recipient.workspaceId,
        recipient.nodeId,
        recipient.bindingId,
      ]));
      const envelopeKeyBits = await globalThis.crypto.subtle.deriveBits(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: utf8(ephemeralPublicKeyJwk),
          info: concatBytes(utf8('consuelo-os/sealed-credential/v1'), associatedData),
        },
        hkdfKey,
        256,
      );
      const envelopeKey = await globalThis.crypto.subtle.importKey(
        'raw',
        envelopeKeyBits,
        { name: 'AES-GCM' },
        false,
        ['encrypt'],
      );
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
      const encrypted = new Uint8Array(await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: associatedData, tagLength: 128 },
        envelopeKey,
        utf8(plaintext),
      ));
      const tagOffset = encrypted.length - 16;
        return {
          version: 1,
          algorithm: 'X25519',
          recipient,
          ephemeralPublicKeyJwk,
          iv: toBase64(iv),
          ciphertext: toBase64(encrypted.slice(0, tagOffset)),
          authTag: toBase64(encrypted.slice(tagOffset)),
        };
      } catch {
        throw new Error('browser secret sealing failed');
      }
    }

    const bindingMatchesSearch = (binding) => {
      const query = String(byId('secret-search')?.value || '').trim().toLowerCase();
      if (!query) return true;
      return [binding.bindingId, binding.nodeId, binding.status]
        .some((value) => String(value || '').toLowerCase().includes(query));
    };

    function renderBindingRow(binding) {
      const row = document.createElement('div');
      row.className = 'secret-row';
      row.setAttribute('role', 'row');

      const name = document.createElement('div');
      name.className = 'secret-name';
      name.setAttribute('role', 'cell');
      name.textContent = String(binding.bindingId || '');

      const hiddenValue = document.createElement('div');
      hiddenValue.className = 'secret-hidden-value';
      hiddenValue.setAttribute('role', 'cell');
      hiddenValue.setAttribute('aria-label', 'Secret value hidden');
      hiddenValue.textContent = '••••••••';

      const node = document.createElement('div');
      node.className = 'secret-node';
      node.setAttribute('role', 'cell');
      node.textContent = String(binding.nodeId || '');

      const updated = document.createElement('div');
      updated.className = 'secret-updated';
      updated.setAttribute('role', 'cell');
      updated.textContent = readableDate(binding.updatedAt);

      const status = document.createElement('div');
      status.className = 'secret-status';
      status.setAttribute('role', 'cell');
      status.textContent = binding.status === 'set' ? 'Stored' : String(binding.status || 'Unknown');

      const replace = document.createElement('button');
      replace.type = 'button';
      replace.className = 'secret-replace';
      replace.textContent = 'Replace';
      replace.addEventListener('click', () => void openSecretDialog(String(binding.bindingId || '')));

      row.append(name, hiddenValue, node, updated, status, replace);
      return row;
    }

    function renderBindings() {
      const rows = byId('secret-rows');
      if (!rows) return;
      const visible = secretBindings.filter(bindingMatchesSearch);
      rows.replaceChildren();
      if (!visible.length) {
        const empty = document.createElement('div');
        empty.className = 'secret-empty';
        const title = document.createElement('strong');
        title.textContent = secretBindings.length ? 'No matching secrets' : 'No secrets yet';
        const note = document.createElement('span');
        note.className = 'muted';
        note.textContent = secretBindings.length ? 'Try another search.' : 'Add one when a tool or integration needs it.';
        empty.append(title, note);
        rows.append(empty);
      } else {
        for (const binding of visible) rows.append(renderBindingRow(binding));
      }
      setText('secret-summary', secretBindings.length + (secretBindings.length === 1 ? ' secret' : ' secrets'));
    }

    async function loadBindings() {
      try {
        const response = await fetch('/gateway/secrets/bindings', {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('secrets unavailable');
        const payload = await response.json();
        secretBindings = Array.isArray(payload && payload.bindings) ? payload.bindings : [];
        renderBindings();
        setHidden('secret-loading', true);
        setHidden('secret-error', true);
        const content = byId('secret-content');
        if (content) content.setAttribute('aria-busy', 'false');
      } catch {
        setHidden('secret-loading', true);
        setHidden('secret-error', false);
        const content = byId('secret-content');
        if (content) content.setAttribute('aria-busy', 'false');
      }
    }

    async function loadSecretSetup() {
      if (secretSetup) return secretSetup;
      const response = await fetch('/gateway/secrets/setup', {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload || payload.ok === false || !payload.publicKeyJwk) {
        throw new Error('node setup unavailable');
      }
      secretSetup = payload;
      return payload;
    }

    async function openSecretDialog(bindingId = '') {
      const dialog = byId('secret-dialog');
      const form = byId('secret-form');
      const binding = byId('secret-binding');
      const value = byId('secret-value');
      if (!(dialog instanceof HTMLDialogElement) || !(form instanceof HTMLFormElement)) return;
      form.reset();
      if (binding instanceof HTMLInputElement) {
        binding.value = bindingId;
        binding.readOnly = Boolean(bindingId);
      }
      if (value instanceof HTMLInputElement) value.value = '';
      setText('secret-dialog-title', bindingId ? 'Replace secret' : 'New secret');
      setText('secret-form-status', 'Checking node encryption…');
      setText('secret-target-node', 'Loading…');
      dialog.showModal();
      try {
        const setup = await loadSecretSetup();
        setText('secret-target-node', setup.nodeId || 'Current node');
        setText('secret-form-status', 'Ready.');
        if (value instanceof HTMLInputElement) value.focus();
      } catch {
        setText('secret-target-node', 'Unavailable');
        setText('secret-form-status', 'This node cannot receive sealed secrets right now.');
      }
    }

    async function submitSecret(event) {
      event.preventDefault();
      const form = event.currentTarget;
      const binding = byId('secret-binding');
      const value = byId('secret-value');
      const submit = byId('save-secret-button');
      if (!(form instanceof HTMLFormElement) || !(binding instanceof HTMLInputElement) || !(value instanceof HTMLInputElement)) return;
      if (!form.reportValidity()) return;
      const bindingId = binding.value.trim();
      const plaintext = value.value;
      if (!plaintext) return;
      if (submit instanceof HTMLButtonElement) submit.disabled = true;
      setText('secret-form-status', 'Encrypting in this browser…');
      try {
        const setup = await loadSecretSetup();
        const envelope = await sealSecret(setup, bindingId, plaintext);
        const response = await fetch('/gateway/secrets/install', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({ bindingId, envelope }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload || payload.ok === false) throw new Error('secret install failed');
        value.value = '';
        const dialog = byId('secret-dialog');
        if (dialog instanceof HTMLDialogElement) dialog.close();
        await loadBindings();
        setText('secret-page-status', bindingId + ' stored.');
      } catch {
        value.value = '';
        setText('secret-form-status', 'Secret was not saved. Check the name and try again.');
      } finally {
        if (submit instanceof HTMLButtonElement) submit.disabled = false;
      }
    }

    byId('secret-search')?.addEventListener('input', renderBindings);
    byId('add-secret-button')?.addEventListener('click', () => void openSecretDialog());
    byId('secret-form')?.addEventListener('submit', (event) => void submitSecret(event));
    const closeSecretDialog = () => {
      const value = byId('secret-value');
      if (value instanceof HTMLInputElement) value.value = '';
      const dialog = byId('secret-dialog');
      if (dialog instanceof HTMLDialogElement) dialog.close();
    };
    byId('secret-dialog-cancel')?.addEventListener('click', closeSecretDialog);
    byId('secret-dialog-cancel-bottom')?.addEventListener('click', closeSecretDialog);
    void loadBindings();
  `;
}

export function renderSecretsContent(): string {
  return `
      <p id="secret-loading" class="sr-only" aria-live="polite">Loading secrets</p>
      <section id="secret-error" class="state-panel" aria-live="polite" hidden>
        <strong>Secrets unavailable</strong>
        <p class="muted">Sign in again or check that this node is online.</p>
      </section>
      <div id="secret-content" aria-busy="true">
        <section class="secrets-surface" aria-labelledby="secret-summary">
          <div class="secret-toolbar">
            <div class="secret-toolbar-copy">
              <strong id="secret-summary">0 secrets</strong>
              <span class="secret-summary-line">Values stay sealed to the node that uses them.</span>
            </div>
            <label class="secret-search-wrap" for="secret-search"><span>Search</span><input id="secret-search" type="search" autocomplete="off" placeholder="name or node" /></label>
            <button id="add-secret-button" class="primary-button" type="button">+ New secret</button>
          </div>
          <p id="secret-page-status" class="sr-only" aria-live="polite"></p>
          <div class="secret-list" role="table" aria-label="Stored secrets">
            <div class="secret-list-header" role="row"><span role="columnheader">Name</span><span role="columnheader">Stored</span><span role="columnheader">Node</span><span role="columnheader">Updated</span><span role="columnheader">Status</span><span aria-hidden="true"></span></div>
            <div id="secret-rows" role="rowgroup"></div>
          </div>
        </section>
      </div>
      <dialog id="secret-dialog" class="secret-dialog" aria-labelledby="secret-dialog-title">
        <div class="dialog-shell">
          <form id="secret-form" class="secret-dialog-form">
            <header class="dialog-header">
              <div class="secret-dialog-copy"><p class="identity">Sealed credential</p><h2 id="secret-dialog-title">New secret</h2><p class="muted">Encrypted in this browser before it is sent.</p></div>
              <button id="secret-dialog-cancel" class="dialog-close" type="button" aria-label="Close">×</button>
            </header>
            <div class="secret-form-fields">
              <label class="field"><span>Name</span><input id="secret-binding" name="bindingId" required maxlength="128" pattern="[A-Za-z0-9._-]+" placeholder="STRIPE_SECRET_KEY" autocomplete="off" spellcheck="false" /></label>
              <label class="field"><span>Secret</span><input id="secret-value" name="secret" type="password" required autocomplete="off" spellcheck="false" /></label>
              <p class="secret-value-note">Target node: <code id="secret-target-node">Loading…</code></p>
            </div>
            <div class="actions"><button id="save-secret-button" class="primary-button" type="submit">Save secret</button><button id="secret-dialog-cancel-bottom" type="button">Cancel</button></div>
            <p id="secret-form-status" class="secret-form-status" aria-live="polite">Checking node encryption…</p>
          </form>
        </div>
      </dialog>`;
}
