import { useState, useEffect } from 'react';
import { initPostHog, optOut } from '../lib/analytics';

const CONSENT_KEY = 'consuelo-cookie-consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // always init — tracking is on by default
    initPostHog();
    const consent = localStorage.getItem(CONSENT_KEY);
    if (consent === 'declined') {
      optOut();
    } else if (!consent) {
      setVisible(true);
    }
    // if 'accepted' or anything else — tracking stays on
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, 'declined');
    setVisible(false);
    optOut();
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        zIndex: 9999,
        maxWidth: '320px',
        padding: '1rem',
        borderRadius: '12px',
        border: '1px solid rgba(128,128,128,0.2)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-fg)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        fontFamily: 'var(--font-sans)',
        fontSize: '13px',
        lineHeight: '1.5',
      }}
    >
      <p style={{ margin: 0, opacity: 0.7 }}>
        we use cookies to understand how you use our site and improve your experience.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <button
          onClick={accept}
          style={{
            flex: 1,
            padding: '0.4rem 0.75rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'var(--color-fg)',
            color: 'var(--color-bg)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          accept
        </button>
        <button
          onClick={decline}
          style={{
            flex: 1,
            padding: '0.4rem 0.75rem',
            borderRadius: '8px',
            border: '1px solid rgba(128,128,128,0.3)',
            backgroundColor: 'transparent',
            color: 'var(--color-fg)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            opacity: 0.6,
          }}
        >
          decline
        </button>
      </div>
    </div>
  );
}
