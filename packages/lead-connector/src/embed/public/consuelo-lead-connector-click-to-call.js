(function consueloLeadConnectorClickToCall() {
  'use strict';

  var config = window.ConsueloLeadConnectorConfig || {};
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

  function routeAllowed() {
    var path = window.location.pathname;
    return (
      path.indexOf('/contacts') !== -1 ||
      path.indexOf('/opportunities') !== -1
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

  function removeOverlayHost() {
    var host = document.getElementById(hostId);
    if (host) host.remove();
    frame = null;
    panel = null;
    launcher = null;
    ready = false;
    pending = null;
  }

  function minimizeOverlay() {
    if (panel) panel.hidden = true;
    if (launcher) {
      launcher.hidden = false;
      launcher.textContent = ready ? 'Resume dialer' : 'Dial';
    }
  }

  function closeOverlay() {
    pending = null;
    minimizeOverlay();
  }

  function createOverlayHost() {
    if (!routeAllowed() && !busy) return null;
    var existing = document.getElementById(hostId);
    if (existing) {
      launcher = document.getElementById(launcherId);
      panel = existing.querySelector('.consuelo-dialer-panel');
      frame = existing.querySelector('iframe[name="consuelo-dialer"]');
      return existing;
    }

    var html = [
      '<div id="',
      hostId,
      '">',
      '<button id="',
      launcherId,
      '" type="button" aria-label="Open Consuelo Dialer">Dial</button>',
      '<section class="consuelo-dialer-panel" ',
      'aria-label="Consuelo Dialer" hidden>',
      '<header class="consuelo-dialer-chrome">',
      '<strong>Consuelo Dialer</strong>',
      '<div class="consuelo-dialer-window-actions">',
      '<button type="button" data-action="minimize" ',
      'aria-label="Minimize dialer">-</button>',
      '<button type="button" data-action="close" ',
      'aria-label="Close dialer">x</button>',
      '</div></header>',
      '</section></div>',
    ].join('');
    document.body.insertAdjacentHTML('beforeend', html);

    var host = document.getElementById(hostId);
    launcher = document.getElementById(launcherId);
    panel = host.querySelector('.consuelo-dialer-panel');
    launcher.addEventListener('click', openOverlay);
    host
      .querySelector('[data-action="minimize"]')
      .addEventListener('click', minimizeOverlay);
    host
      .querySelector('[data-action="close"]')
      .addEventListener('click', closeOverlay);
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
    });
    return frame;
  }

  function openOverlay() {
    if (!createOverlayHost() || !panel || !launcher) return;
    if (!ensureOverlayFrame()) return;
    panel.hidden = false;
    launcher.hidden = true;
  }

  function post(message) {
    if (!frame || !frame.contentWindow) return false;
    frame.contentWindow.postMessage(message, origin);
    return true;
  }

  function targetContext(element, phone) {
    var selector = [
      '[data-contact-id]',
      '[data-record-id]',
      '[data-opportunity-id]',
      '.contact-card',
      '.contact-detail',
    ].join(',');
    var container = element.closest(selector);
    var nameNode =
      container &&
      container.querySelector(
        '[data-contact-name],.contact-name,h1,h2,h3',
      );
    return {
      phone: phone,
      contactId:
        container &&
        (container.getAttribute('data-contact-id') ||
          container.getAttribute('data-record-id')),
      opportunityId:
        container && container.getAttribute('data-opportunity-id'),
      name: nameNode ? String(nameNode.textContent || '').trim() : null,
    };
  }

  document.addEventListener(
    'click',
    function (event) {
      if (!routeAllowed()) return;
      var target = event.target;
      if (!target || !target.closest) return;
      var element = target.closest('a[href^="tel:"],[data-phone]');
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
    lastRoute = window.location.href;
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
  }

  window.addEventListener('message', function (event) {
    if (!frame || !frame.contentWindow) return;
    if (event.source !== frame.contentWindow) return;
    if (event.origin !== origin) return;
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
  }, 1000);
  syncRoute();
})();
