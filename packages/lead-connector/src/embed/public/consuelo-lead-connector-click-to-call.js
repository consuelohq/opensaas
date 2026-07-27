(function consueloLeadConnectorClickToCall() {
  'use strict';

  var config = window.ConsueloLeadConnectorConfig || {};
  var approvedEmbedOrigins = [
    'https://calls.consuelohq.com',
    'https://consuelo-lead-connector-embed.kokayi-90b.workers.dev',
  ];
  var defaultEmbedOrigin =
    'https://consuelo-lead-connector-embed.kokayi-90b.workers.dev';
  var overlayPath = '/overlay';
  var launcherId = 'consuelo-dialer-launcher';
  var overlayHostId = 'consuelo-dialer-overlay-host';
  var styleId = 'consuelo-dialer-overlay-styles';
  var configuredEmbedOrigin = String(
    config.embedOrigin || defaultEmbedOrigin,
  ).replace(/\/$/, '');
  if (approvedEmbedOrigins.indexOf(configuredEmbedOrigin) === -1) {
    configuredEmbedOrigin = defaultEmbedOrigin;
  }
  var activeEmbedOrigin = configuredEmbedOrigin;
  var bootstrapToken = config.bootstrapToken || '';
  var protocolVersion = 1;
  var processedAttribute = 'data-consuelo-lead-connector-call';
  var frame = null;
  var launcher = null;
  var overlayHost = null;
  var overlayPanel = null;
  var ready = false;
  var pendingMessage = null;
  var lastRoute = window.location.href;

  function normalizePhone(raw) {
    var digits = String(raw || '').replace(/\D/g, '');
    if (digits.length === 10) return '+1' + digits;
    if (digits.length === 11 && digits.charAt(0) === '1') return '+' + digits;
    if (digits.length >= 10 && digits.length <= 15) return '+' + digits;
    return null;
  }

  function isApprovedCrmRoute(pathname) {
    return (
      pathname.indexOf('/opportunities') !== -1 ||
      pathname.indexOf('/contacts') !== -1
    );
  }

  function frameOrigin(candidate) {
    if (!candidate || !candidate.src) return null;
    try {
      return new URL(candidate.src, window.location.href).origin;
    } catch (_error) {
      return null;
    }
  }

  function approveFrame(candidate) {
    var origin = frameOrigin(candidate);
    if (!origin || approvedEmbedOrigins.indexOf(origin) === -1) return null;
    if (origin !== configuredEmbedOrigin) return null;
    activeEmbedOrigin = origin;
    return candidate;
  }

  function findFrame() {
    return approveFrame(
      document.querySelector('iframe[name="consuelo-dialer"]'),
    );
  }

  function ensureStyles() {
    if (document.getElementById(styleId)) return;
    var style = document.createElement('style');
    style.id = styleId;
    style.textContent =
      '#' +
      overlayHostId +
      '{position:fixed;top:88px;left:248px;z-index:2147483000;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;pointer-events:none}' +
      '#' +
      launcherId +
      '{pointer-events:auto;display:flex;align-items:center;gap:8px;border:0;border-radius:12px;padding:10px 16px;background:#0000f2;color:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.12),0 12px 30px rgba(0,0,0,.16);font:700 14px/1 inherit;cursor:pointer}' +
      '#' +
      launcherId +
      '[hidden]{display:none}' +
      '.consuelo-dialer-panel{pointer-events:auto;width:380px;max-width:calc(100vw - 32px);height:min(560px,calc(100vh - 120px));overflow:hidden;border-radius:16px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.16),0 22px 60px rgba(0,0,0,.24)}' +
      '.consuelo-dialer-panel[hidden]{display:none}' +
      '.consuelo-dialer-chrome{height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 10px 0 14px;border-bottom:1px solid #e7e7e7;background:#fff;color:#0a0a0a}' +
      '.consuelo-dialer-chrome strong{font-size:13px;letter-spacing:-.01em}' +
      '.consuelo-dialer-window-actions{display:flex;gap:4px}' +
      '.consuelo-dialer-window-actions button{width:30px;height:30px;border:0;border-radius:8px;background:#f5f5f5;color:#0a0a0a;cursor:pointer;font:700 15px/1 inherit}' +
      '.consuelo-dialer-frame{display:block;width:100%;height:calc(100% - 44px);border:0;background:#fff}' +
      '@media(max-width:900px){#' +
      overlayHostId +
      '{left:auto;right:16px}}' +
      '@media(max-width:520px){#' +
      overlayHostId +
      '{top:auto;right:8px;bottom:8px;left:8px}.consuelo-dialer-panel{width:100%;max-width:none;height:min(620px,calc(100vh - 24px))}}';
    document.head.appendChild(style);
  }

  function post(message) {
    frame = frame || findFrame();
    if (!frame || !frame.contentWindow || !activeEmbedOrigin) return false;
    frame.contentWindow.postMessage(message, activeEmbedOrigin);
    return true;
  }

  function sendHandshake() {
    if (!bootstrapToken) return;
    post({
      type: 'consuelo.leadconnector/handshake',
      version: protocolVersion,
      bootstrapToken: bootstrapToken,
    });
  }

  function minimizeOverlay() {
    if (overlayPanel) overlayPanel.hidden = true;
    if (launcher) {
      launcher.hidden = false;
      launcher.textContent = ready ? '☎ Resume dialer' : '☎ Dial';
    }
  }

  function closeOverlay() {
    pendingMessage = null;
    minimizeOverlay();
  }

  function createOverlayHost() {
    if (!isApprovedCrmRoute(window.location.pathname)) return null;
    overlayHost = document.getElementById(overlayHostId);
    if (overlayHost) {
      launcher = document.getElementById(launcherId);
      overlayPanel = overlayHost.querySelector('.consuelo-dialer-panel');
      frame = findFrame();
      return overlayHost;
    }

    ensureStyles();
    overlayHost = document.createElement('div');
    overlayHost.id = overlayHostId;

    launcher = document.createElement('button');
    launcher.id = launcherId;
    launcher.type = 'button';
    launcher.textContent = '☎ Dial';
    launcher.setAttribute('aria-label', 'Open Consuelo Dialer');
    launcher.addEventListener('click', openOverlay);

    overlayPanel = document.createElement('section');
    overlayPanel.className = 'consuelo-dialer-panel';
    overlayPanel.hidden = true;
    overlayPanel.setAttribute('aria-label', 'Consuelo Dialer');

    var chrome = document.createElement('header');
    chrome.className = 'consuelo-dialer-chrome';
    var title = document.createElement('strong');
    title.textContent = 'Consuelo Dialer';
    var actions = document.createElement('div');
    actions.className = 'consuelo-dialer-window-actions';

    var minimize = document.createElement('button');
    minimize.type = 'button';
    minimize.textContent = '−';
    minimize.setAttribute('aria-label', 'Minimize dialer');
    minimize.addEventListener('click', minimizeOverlay);

    var close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close dialer');
    close.addEventListener('click', closeOverlay);

    frame = document.createElement('iframe');
    frame.name = 'consuelo-dialer';
    frame.title = 'Consuelo Dialer';
    frame.className = 'consuelo-dialer-frame';
    frame.allow = 'microphone';
    frame.src = configuredEmbedOrigin + overlayPath;
    frame.addEventListener('load', function handleFrameLoad() {
      ready = false;
      activeEmbedOrigin = configuredEmbedOrigin;
      sendHandshake();
    });

    actions.appendChild(minimize);
    actions.appendChild(close);
    chrome.appendChild(title);
    chrome.appendChild(actions);
    overlayPanel.appendChild(chrome);
    overlayPanel.appendChild(frame);
    overlayHost.appendChild(launcher);
    overlayHost.appendChild(overlayPanel);
    document.body.appendChild(overlayHost);
    return overlayHost;
  }

  function openOverlay() {
    if (!createOverlayHost() || !overlayPanel || !launcher) return;
    overlayPanel.hidden = false;
    launcher.hidden = true;
    frame = frame || findFrame();
    if (!ready) sendHandshake();
  }

  var contactContainerSelector =
    '[data-contact-id], [data-record-id], ' + '.contact-card, .contact-detail';

  function readContext(element, phone) {
    var container = element.closest(contactContainerSelector);
    var contactId =
      container &&
      (container.getAttribute('data-contact-id') ||
        container.getAttribute('data-record-id'));
    var opportunityId =
      container && container.getAttribute('data-opportunity-id');
    var nameNode =
      container &&
      container.querySelector('[data-contact-name], .contact-name, h1, h2, h3');
    return {
      phone: phone,
      contactId: contactId || null,
      opportunityId: opportunityId || null,
      name: nameNode ? String(nameNode.textContent || '').trim() : null,
    };
  }

  function sendTarget(element, rawPhone) {
    var phone = normalizePhone(rawPhone);
    if (!phone) return;
    var message = {
      type: 'consuelo.leadconnector/click-to-call',
      version: protocolVersion,
      target: readContext(element, phone),
      autoDial: config.autoDial === true,
    };
    pendingMessage = message;
    openOverlay();
    if (ready && post(message)) pendingMessage = null;
  }

  function decorate(element) {
    if (element.getAttribute(processedAttribute) === 'true') return;
    var rawPhone = element.getAttribute('href');
    if (rawPhone && rawPhone.indexOf('tel:') === 0)
      rawPhone = rawPhone.slice(4);
    else rawPhone = element.getAttribute('data-phone') || element.textContent;
    if (!normalizePhone(rawPhone)) return;
    element.setAttribute(processedAttribute, 'true');
    element.addEventListener('click', function handleClick(event) {
      if (!isApprovedCrmRoute(window.location.pathname)) return;
      event.preventDefault();
      event.stopPropagation();
      sendTarget(element, rawPhone);
    });
  }

  function scan() {
    if (!isApprovedCrmRoute(window.location.pathname)) return;
    var candidates = document.querySelectorAll('a[href^="tel:"], [data-phone]');
    for (var index = 0; index < candidates.length; index += 1)
      decorate(candidates[index]);
  }

  function removeOverlayHost() {
    if (overlayHost && overlayHost.parentNode)
      overlayHost.parentNode.removeChild(overlayHost);
    overlayHost = null;
    overlayPanel = null;
    launcher = null;
    frame = null;
    ready = false;
    pendingMessage = null;
  }

  function syncRoute() {
    lastRoute = window.location.href;
    if (!isApprovedCrmRoute(window.location.pathname)) {
      removeOverlayHost();
      return;
    }
    createOverlayHost();
    scan();
  }

  window.addEventListener('message', function handleEmbedMessage(event) {
    frame = frame || findFrame();
    if (
      !frame ||
      !frame.contentWindow ||
      event.source !== frame.contentWindow ||
      event.origin !== activeEmbedOrigin ||
      !event.data ||
      event.data.version !== protocolVersion
    )
      return;
    if (event.data.type === 'consuelo.leadconnector/ready') {
      ready = true;
      if (pendingMessage && post(pendingMessage)) pendingMessage = null;
    }
    if (event.data.type === 'consuelo.leadconnector/busy') openOverlay();
    if (event.data.type === 'consuelo.leadconnector/completed') {
      window.setTimeout(minimizeOverlay, 1200);
    }
  });

  var observer = new MutationObserver(scan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  window.addEventListener('popstate', syncRoute);
  window.addEventListener('hashchange', syncRoute);
  window.addEventListener('routeChangeEvent', syncRoute);
  window.setInterval(function watchRoute() {
    if (window.location.href !== lastRoute) syncRoute();
    if (frame && !ready) sendHandshake();
  }, 1000);
  syncRoute();
})();
