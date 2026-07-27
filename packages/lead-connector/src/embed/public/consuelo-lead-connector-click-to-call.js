(function consueloLeadConnectorClickToCall() {
  'use strict';

  var config = window.ConsueloLeadConnectorConfig || {};
  var approvedEmbedOrigins = [
    'https://calls.consuelohq.com',
    'https://consuelo-lead-connector-embed.kokayi-90b.workers.dev',
  ];
  var configuredEmbedOrigin = String(config.embedOrigin || '').replace(
    /\/$/,
    '',
  );
  if (
    configuredEmbedOrigin &&
    approvedEmbedOrigins.indexOf(configuredEmbedOrigin) === -1
  ) {
    configuredEmbedOrigin = '';
  }
  var activeEmbedOrigin = configuredEmbedOrigin || null;
  var bootstrapToken = config.bootstrapToken || '';
  var protocolVersion = 1;
  var processedAttribute = 'data-consuelo-lead-connector-call';
  var frame = null;
  var ready = false;

  function normalizePhone(raw) {
    var digits = String(raw || '').replace(/\D/g, '');
    if (digits.length === 10) return '+1' + digits;
    if (digits.length === 11 && digits.charAt(0) === '1') return '+' + digits;
    if (digits.length >= 10 && digits.length <= 15) return '+' + digits;
    return null;
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
    if (configuredEmbedOrigin && origin !== configuredEmbedOrigin) return null;
    activeEmbedOrigin = origin;
    return candidate;
  }

  function findFrame() {
    var named = approveFrame(
      document.querySelector('iframe[name="consuelo-dialer"]'),
    );
    if (named) return named;
    var frames = document.querySelectorAll('iframe');
    for (var index = 0; index < frames.length; index += 1) {
      var approved = approveFrame(frames[index]);
      if (approved) return approved;
    }
    return null;
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
    if (!ready) sendHandshake();
    post({
      type: 'consuelo.leadconnector/click-to-call',
      version: protocolVersion,
      target: readContext(element, phone),
      autoDial: config.autoDial === true,
    });
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
      event.preventDefault();
      event.stopPropagation();
      sendTarget(element, rawPhone);
    });
  }

  function scan() {
    var candidates = document.querySelectorAll('a[href^="tel:"], [data-phone]');
    for (var index = 0; index < candidates.length; index += 1)
      decorate(candidates[index]);
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
    if (event.data.type === 'consuelo.leadconnector/ready') ready = true;
  });

  var observer = new MutationObserver(scan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  scan();
  sendHandshake();
  window.setInterval(function refreshHandshake() {
    if (!ready) sendHandshake();
  }, 1500);
})();
