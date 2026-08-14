import { createHash } from 'node:crypto';

export const createLeadConnectorMarketplaceBootstrap = (input: {
  assetOrigin: string;
}): string => {
  const origin = new URL(input.assetOrigin);
  if (origin.protocol !== 'https:') {
    throw new Error('Marketplace asset origin must use HTTPS');
  }
  const css = new URL(
    '/consuelo-lead-connector-click-to-call.css',
    origin,
  ).toString();
  const javascript = new URL(
    '/consuelo-lead-connector-click-to-call.js',
    origin,
  ).toString();
  return `<script>
  (function consueloDialerMarketplaceLoader() {
    'use strict';

    var root = document.head || document.documentElement;
    var stylesheet = document.querySelector(
      'link[data-consuelo-dialer-loader="stylesheet"], link[href="${css}"]',
    );
    if (!stylesheet) {
      stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = '${css}';
      stylesheet.setAttribute('data-consuelo-dialer-loader', 'stylesheet');
      root.appendChild(stylesheet);
    }

    var launcher = document.querySelector(
      'script[data-consuelo-dialer-loader="script"], script[src="${javascript}"]',
    );
    if (!launcher) {
      launcher = document.createElement('script');
      launcher.src = '${javascript}';
      launcher.defer = true;
      launcher.setAttribute('data-consuelo-dialer-loader', 'script');
      root.appendChild(launcher);
    }
  })();
</script>
`;
};

export type LeadConnectorMarketplaceBootstrapEvidence = {
  sha256: string;
  installationMode: 'one-time';
};

export const verifyLeadConnectorMarketplaceBootstrap = (input: {
  contents: string;
  expectedSha256: string;
}): LeadConnectorMarketplaceBootstrapEvidence => {
  const expectedSha256 = input.expectedSha256.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
    throw new Error('Expected Marketplace bootstrap SHA-256 is invalid');
  }

  const sha256 = createHash('sha256').update(input.contents).digest('hex');
  if (sha256 !== expectedSha256) {
    throw new Error(
      'Marketplace bootstrap does not match the approved one-time bootstrap source',
    );
  }

  return { sha256, installationMode: 'one-time' };
};
