// Consuelo Click-to-Call — Custom JS for GHL Marketplace
// Detects phone numbers on GHL CRM pages and routes clicks to the Consuelo dialer
// via postMessage to the Custom Menu Link iframe.
//
// GHL injects this script on every CRM page (contacts, conversations, pipelines, calendar).
// It must be self-contained — no external dependencies, no dynamic imports.

(function consuelo_click_to_call() {
  'use strict';

  var CONSUELO_ORIGIN = 'https://calls.consuelohq.com';
  var MESSAGE_PREFIX = 'consuelo:';
  var CLICK_TO_CALL_TYPE = MESSAGE_PREFIX + 'click_to_call';
  var DIALER_READY_TYPE = MESSAGE_PREFIX + 'dialer_ready';
  var PROCESSED_ATTR = 'data-consuelo-c2c';
  var DEBOUNCE_MS = 300;

  // E.164 phone regex — matches +1XXXXXXXXXX and common US/intl formats
  var PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

  var dialerReady = false;
  var dialerFrame = null;
  var debounceTimer = null;

  // --- iframe discovery ---

  function findDialerFrame() {
    // try by name attribute first (set by CML config)
    var frame = document.querySelector('iframe[name="consuelo-dialer"]');
    if (frame) return frame;

    // fallback: find iframe whose src contains our origin
    var iframes = document.querySelectorAll('iframe');
    for (var i = 0; i < iframes.length; i++) {
      try {
        if (iframes[i].src && iframes[i].src.indexOf(CONSUELO_ORIGIN) === 0) {
          return iframes[i];
        }
      } catch (_e) {
        // cross-origin access may throw — skip
      }
    }
    return null;
  }

  // --- phone number normalization ---

  function normalizeToE164(raw) {
    var digits = raw.replace(/\D/g, '');
    // US numbers: 10 digits → +1 prefix
    if (digits.length === 10) return '+1' + digits;
    // already has country code
    if (digits.length === 11 && digits[0] === '1') return '+' + digits;
    // international or other — return with + prefix if not present
    if (digits.length >= 10) return '+' + digits;
    return null;
  }

  // --- contact context extraction ---

  function extractContactContext(element) {
    var context = { phone: null, name: null, contactId: null };

    // extract phone from the element itself
    if (element.href && element.href.indexOf('tel:') === 0) {
      context.phone = element.href.replace('tel:', '').trim();
    } else if (element.dataset && element.dataset.phone) {
      context.phone = element.dataset.phone;
    } else {
      context.phone = (element.textContent || '').trim();
    }

    // normalize
    if (context.phone) {
      context.phone = normalizeToE164(context.phone) || context.phone;
    }

    // try to find contact name from nearby DOM
    var card = element.closest('[data-contact-id], [data-record-id], .contact-card, .contact-detail');
    if (card) {
      context.contactId = card.dataset.contactId || card.dataset.recordId || null;
      var nameEl = card.querySelector('[data-contact-name], .contact-name, h1, h2, h3');
      if (nameEl) {
        context.name = (nameEl.textContent || '').trim() || null;
      }
    }

    return context;
  }

  // --- postMessage sender ---

  function sendClickToCall(contact) {
    if (!contact.phone) return;

    dialerFrame = dialerFrame || findDialerFrame();
    if (!dialerFrame || !dialerFrame.contentWindow) {
      // no dialer iframe — let native tel: link work
      return;
    }

    try {
      dialerFrame.contentWindow.postMessage({
        type: CLICK_TO_CALL_TYPE,
        contact: {
          phone: contact.phone,
          name: contact.name || null,
          contactId: contact.contactId || null,
        },
        autoDial: false,
        timestamp: new Date().toISOString(),
      }, CONSUELO_ORIGIN);
    } catch (_e) {
      // postMessage failed — allow native behavior
    }
  }

  // --- click handler ---

  function handleClick(event) {
    var target = event.target;

    // walk up to find the clickable phone element
    var phoneEl = null;
    var el = target;
    while (el && el !== document.body) {
      if (el.getAttribute && el.getAttribute(PROCESSED_ATTR) === 'true') {
        phoneEl = el;
        break;
      }
      el = el.parentElement;
    }

    if (!phoneEl) return;

    // only intercept if dialer is available
    dialerFrame = dialerFrame || findDialerFrame();
    if (!dialerFrame) return;

    event.preventDefault();
    event.stopPropagation();

    var contact = extractContactContext(phoneEl);
    sendClickToCall(contact);
  }

  // --- DOM scanning ---

  function processElement(el) {
    if (el.getAttribute(PROCESSED_ATTR)) return;
    el.setAttribute(PROCESSED_ATTR, 'true');
    el.style.cursor = 'pointer';
    el.title = 'Click to dial with Consuelo';
  }

  function scanForPhoneNumbers() {
    // strategy 1: tel: links (most reliable)
    var telLinks = document.querySelectorAll('a[href^="tel:"]:not([' + PROCESSED_ATTR + '])');
    for (var i = 0; i < telLinks.length; i++) {
      processElement(telLinks[i]);
    }

    // strategy 2: elements with phone data attributes
    var dataPhones = document.querySelectorAll(
      '[data-phone]:not([' + PROCESSED_ATTR + ']), ' +
      '[data-contact-phone]:not([' + PROCESSED_ATTR + '])'
    );
    for (var j = 0; j < dataPhones.length; j++) {
      processElement(dataPhones[j]);
    }
  }

  function debouncedScan() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanForPhoneNumbers, DEBOUNCE_MS);
  }

  // --- MutationObserver for SPA navigation ---

  function setupObserver() {
    if (typeof MutationObserver === 'undefined') return;

    var observer = new MutationObserver(function (mutations) {
      var shouldScan = false;
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].addedNodes.length > 0) {
          shouldScan = true;
          break;
        }
      }
      if (shouldScan) debouncedScan();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // --- message listener (dialer → parent) ---

  function handleMessage(event) {
    if (event.origin !== CONSUELO_ORIGIN) return;

    var data = event.data;
    if (!data || typeof data.type !== 'string') return;

    if (data.type === DIALER_READY_TYPE) {
      dialerReady = true;
      dialerFrame = event.source ? findDialerFrame() : dialerFrame;
      // re-scan now that dialer is ready
      scanForPhoneNumbers();
    }
  }

  // --- initialization ---

  function init() {
    // event delegation on document for all click-to-call clicks
    document.addEventListener('click', handleClick, true);

    // listen for dialer ready messages
    window.addEventListener('message', handleMessage, false);

    // initial scan
    scanForPhoneNumbers();

    // watch for SPA navigation
    setupObserver();
  }

  // start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
