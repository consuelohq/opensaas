(function consueloLeadConnectorClickToCall() {
  'use strict';

  var config = window.ConsueloLeadConnectorConfig || {};
  var appId = '690cbca9af44827eb89887b1';
  var approvedOrigins = [
    'https://calls.consuelohq.com',
    'https://consuelo-lead-connector-embed.kokayi-90b.workers.dev',
  ];
  var defaultOrigin =
    'https://consuelo-lead-connector-embed.kokayi-90b.workers.dev';
  var origin = String(config.embedOrigin || defaultOrigin).replace(/\/$/, '');
  if (approvedOrigins.indexOf(origin) === -1) origin = defaultOrigin;
  var overlayPath = '/overlay';

  var hostId = 'consuelo-dialer-overlay-host';
  var launcherId = 'consuelo-dialer-launcher';
  var frame = null;
  var panel = null;
  var launcher = null;
  var ready = false;
  var busy = false;
  var pending = null;
  var lastRoute = window.location.href;
  var sessionContextPromise = null;

  function routeAllowed() {
    var path = window.location.pathname;
    return (
      path.indexOf('/contacts') !== -1 || path.indexOf('/opportunities') !== -1
    );
  }

  function normalizePhone(raw) {
    var digits = String(raw || '').replace(/\D/g, '');
    if (digits.length === 10) return '+1' + digits;
    if (digits.length === 11 && digits.charAt(0) === '1') {
      return '+' + digits;
    }
    if (digits.length >= 10 && digits.length <= 15) return '+' + digits;
    return null;
  }

  function findOpportunityListAnchor() {
    var labels = document.querySelectorAll('.view-label');
    for (var index = 0; index < labels.length; index += 1) {
      if (String(labels[index].textContent || '').trim() !== 'List') continue;
      var view = labels[index].closest('.view');
      if (view && view.parentElement) return view;
    }
    return (
      document.getElementById('tb_opportunities-tab') ||
      document.getElementById('tb_pipeline')
    );
  }

  function findLauncherAnchor() {
    var path = window.location.pathname;
    if (path.indexOf('/contacts') !== -1) {
      return (
        document.getElementById('tb_lists') ||
        document.getElementById('tb_bulk-actions')
      );
    }
    if (path.indexOf('/opportunities') !== -1) {
      return findOpportunityListAnchor();
    }
    return null;
  }

  function placeLauncher() {
    if (!launcher || !routeAllowed()) return;
    var anchor = findLauncherAnchor();
    if (anchor && anchor.parentElement) {
      if (launcher.previousElementSibling !== anchor) {
        anchor.insertAdjacentElement('afterend', launcher);
      }
      launcher.setAttribute('data-placement', 'native');
    } else {
      if (launcher.parentElement !== document.body) {
        document.body.appendChild(launcher);
      }
      launcher.setAttribute('data-placement', 'fallback');
    }
    launcher.hidden = busy || (panel && !panel.hidden);
  }

  function clearDisconnectedReferences() {
    if (frame && !frame.isConnected) {
      frame = null;
      ready = false;
    }
    if (panel && !panel.isConnected) panel = null;
    if (launcher && !launcher.isConnected) launcher = null;
  }

  function removeOverlayHost() {
    var host = document.getElementById(hostId);
    var mountedLauncher = document.getElementById(launcherId);
    if (host) host.remove();
    if (mountedLauncher) mountedLauncher.remove();
    frame = null;
    panel = null;
    launcher = null;
    ready = false;
    pending = null;
    sessionContextPromise = null;
  }

  function minimizeOverlay() {
    if (panel) panel.hidden = true;
    if (launcher && routeAllowed()) {
      placeLauncher();
      launcher.hidden = false;
      launcher.textContent = ready ? 'Resume dialer' : 'Dial';
    }
  }

  function closeOverlay() {
    pending = null;
    minimizeOverlay();
  }

  function createLauncher() {
    var existing = document.getElementById(launcherId);
    if (existing) return existing;
    var button = document.createElement('button');
    button.id = launcherId;
    button.type = 'button';
    button.className = 'consuelo-dialer-launcher';
    button.setAttribute('aria-label', 'Open Consuelo Dialer');
    button.innerHTML =
      '<span aria-hidden="true" class="consuelo-dialer-launcher__icon">C</span>' +
      '<span>Dial</span>';
    button.addEventListener('click', openOverlay);
    document.body.appendChild(button);
    return button;
  }

  function createOverlayHost() {
    clearDisconnectedReferences();
    if (!routeAllowed() && !busy) return null;
    var existing = document.getElementById(hostId);
    launcher = createLauncher();
    if (existing) {
      panel = existing.querySelector('.consuelo-dialer-panel');
      frame = existing.querySelector('iframe[name="consuelo-dialer"]');
      placeLauncher();
      return existing;
    }

    var html = [
      '<div id="',
      hostId,
      '">',
      '<section class="consuelo-dialer-panel" ',
      'aria-label="Consuelo Dialer" hidden>',
      '<header class="consuelo-dialer-chrome">',
      '<strong>Consuelo Dialer</strong>',
      '<div class="consuelo-dialer-window-actions">',
      '<button type="button" data-action="minimize" ',
      'aria-label="Minimize dialer">−</button>',
      '<button type="button" data-action="close" ',
      'aria-label="Close dialer">×</button>',
      '</div></header>',
      '</section></div>',
    ].join('');
    document.body.insertAdjacentHTML('beforeend', html);

    var host = document.getElementById(hostId);
    panel = host.querySelector('.consuelo-dialer-panel');
    host
      .querySelector('[data-action="minimize"]')
      .addEventListener('click', minimizeOverlay);
    host
      .querySelector('[data-action="close"]')
      .addEventListener('click', closeOverlay);
    placeLauncher();
    return host;
  }

  function ensureOverlayFrame() {
    if (frame) return frame;
    if (!panel) return null;
    var html = [
      '<iframe name="consuelo-dialer" ',
      'class="consuelo-dialer-frame" title="Consuelo Dialer" ',
      'allow="microphone" src="',
      origin,
      overlayPath,
      '"></iframe>',
    ].join('');
    panel.insertAdjacentHTML('beforeend', html);
    frame = panel.querySelector('iframe[name="consuelo-dialer"]');
    frame.addEventListener('load', function () {
      ready = false;
      sessionContextPromise = null;
    });
    return frame;
  }

  function currentRecordContext() {
    var path = window.location.pathname;
    var detailRoute =
      path.indexOf('/contacts/detail/') !== -1 ||
      path.indexOf('/opportunities/detail/') !== -1;
    if (!detailRoute) return null;
    var phoneElement =
      document.querySelector('a[href^="tel:"]') ||
      document.querySelector('[data-phone]');
    if (!phoneElement) return null;
    var raw = phoneElement.getAttribute('href');
    if (raw && raw.indexOf('tel:') === 0) raw = raw.slice(4);
    else
      raw = phoneElement.getAttribute('data-phone') || phoneElement.textContent;
    var phone = normalizePhone(raw);
    return phone ? targetContext(phoneElement, phone) : null;
  }

  function openOverlay() {
    if (!createOverlayHost() || !panel || !launcher) return;
    if (!ensureOverlayFrame()) return;
    if (!pending) {
      var routeTarget = currentRecordContext();
      if (routeTarget) {
        pending = {
          type: 'consuelo.leadconnector/click-to-call',
          version: 1,
          target: routeTarget,
          autoDial: false,
        };
      }
    }
    panel.hidden = false;
    launcher.hidden = true;
  }

  function post(message) {
    if (!frame || !frame.contentWindow) return false;
    frame.contentWindow.postMessage(message, origin);
    return true;
  }

  function loadSessionContext() {
    if (sessionContextPromise) return sessionContextPromise;
    if (typeof window.exposeSessionDetails !== 'function') {
      return Promise.reject(new Error('Session context is unavailable'));
    }
    sessionContextPromise = Promise.resolve(window.exposeSessionDetails(appId))
      .then(function (encryptedData) {
        if (typeof encryptedData !== 'string' || !encryptedData) {
          throw new Error('Session context is empty');
        }
        return encryptedData;
      })
      .catch(function (error) {
        sessionContextPromise = null;
        throw error;
      });
    return sessionContextPromise;
  }

  function sendSessionContext() {
    loadSessionContext()
      .then(function (encryptedData) {
        if (!frame || !frame.contentWindow) return;
        frame.contentWindow.postMessage(
          {
            message: 'REQUEST_USER_DATA_RESPONSE',
            payload: encryptedData,
          },
          origin,
        );
      })
      .catch(function () {
        return undefined;
      });
  }

  function targetContext(element, phone) {
    var selectors = [
      '[data-contact-id]',
      '[data-record-id]',
      '[data-opportunity-id]',
      '.contact-card',
      '.contact-detail',
    ];
    var container = element.closest('tr') || element.closest('[role="row"]');
    for (var index = 0; !container && index < selectors.length; index += 1) {
      container = element.closest(selectors[index]);
    }
    var nameSelectors = [
      '[data-contact-name]',
      '.contact-name',
      '[data-name]',
      'h1',
      'h2',
      'h3',
    ];
    var nameNode = null;
    for (
      var nameIndex = 0;
      container && nameIndex < nameSelectors.length;
      nameIndex += 1
    ) {
      nameNode = container.querySelector(nameSelectors[nameIndex]);
      if (nameNode) break;
    }
    var contactId =
      container &&
      (container.getAttribute('data-contact-id') ||
        container.getAttribute('data-record-id'));
    var contactLink =
      container && container.querySelector('a[href*="/contacts/detail/"]');
    if (!contactId && contactLink) {
      var contactMatch = String(contactLink.getAttribute('href') || '').match(
        /\/contacts\/detail\/([^/?]+)/,
      );
      contactId = contactMatch ? contactMatch[1] : null;
    }
    var opportunityId =
      container && container.getAttribute('data-opportunity-id');
    return {
      phone: phone,
      contactId: contactId,
      opportunityId: opportunityId,
      name: nameNode ? String(nameNode.textContent || '').trim() : null,
    };
  }

  document.addEventListener(
    'click',
    function (event) {
      if (!routeAllowed()) return;
      var target = event.target;
      if (!target || !target.closest) return;
      var element =
        target.closest('a[href^="tel:"]') || target.closest('[data-phone]');
      if (!element) return;
      var raw = element.getAttribute('href');
      if (raw && raw.indexOf('tel:') === 0) raw = raw.slice(4);
      else raw = element.getAttribute('data-phone') || element.textContent;
      var phone = normalizePhone(raw);
      if (!phone) return;
      event.preventDefault();
      event.stopPropagation();
      pending = {
        type: 'consuelo.leadconnector/click-to-call',
        version: 1,
        target: targetContext(element, phone),
        autoDial: config.autoDial === true,
      };
      openOverlay();
      if (ready && post(pending)) pending = null;
    },
    true,
  );

  function syncRoute() {
    var routeChanged = window.location.href !== lastRoute;
    lastRoute = window.location.href;
    if (routeChanged) {
      sessionContextPromise = null;
      clearDisconnectedReferences();
    }
    if (!routeAllowed()) {
      if (busy && document.getElementById(hostId)) {
        if (panel) panel.hidden = false;
        if (launcher) launcher.hidden = true;
        return;
      }
      removeOverlayHost();
      return;
    }
    createOverlayHost();
    placeLauncher();
    if (routeChanged && !busy && frame && frame.isConnected) {
      sendSessionContext();
    }
  }

  window.addEventListener('message', function (event) {
    if (!frame || !frame.contentWindow) return;
    if (event.source !== frame.contentWindow) return;
    if (event.origin !== origin) return;
    if (event.data && event.data.message === 'REQUEST_USER_DATA') {
      sendSessionContext();
      return;
    }
    if (!event.data || event.data.version !== 1) return;
    if (event.data.type === 'consuelo.leadconnector/ready') {
      ready = true;
      if (pending && post(pending)) pending = null;
    }
    if (event.data.type === 'consuelo.leadconnector/busy') {
      busy = true;
      openOverlay();
    }
    if (event.data.type === 'consuelo.leadconnector/completed') {
      busy = false;
      window.setTimeout(function () {
        minimizeOverlay();
        if (!routeAllowed()) removeOverlayHost();
      }, 1200);
    }
  });

  window.addEventListener('routeLoaded', syncRoute);
  window.addEventListener('routeChangeEvent', syncRoute);
  window.addEventListener('popstate', syncRoute);
  window.addEventListener('hashchange', syncRoute);
  window.setInterval(function () {
    if (window.location.href !== lastRoute) syncRoute();
    else if (routeAllowed()) placeLauncher();
  }, 1000);
  syncRoute();
})();
