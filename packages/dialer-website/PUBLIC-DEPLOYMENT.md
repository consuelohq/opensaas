# Public domain delivery

`CONSUELO_PUBLIC_SITE_PHASE` is a GitHub repository variable consumed by the production release workflow and its classifier. Unset means `legacy`; unknown values fail closed.

| Phase | Website job | Docs job |
| --- | --- | --- |
| legacy | OS site on the existing root Pages project | existing consuelo-docs Worker |
| os-mounted | OS site Worker at os.consuelohq.com/about/ | legacy docs plus OS docs at os.consuelohq.com/docs/ |
| dialer | OS mount plus Dialer on existing root Pages project | legacy translation origin, OS docs mount, Dialer docs route |

Dispatch `website` and `docs` individually from the approved exact main source. Do not dispatch `all` for a public-only change. Public jobs never deploy the auth authority, gateway, Dialer server, or telephone adapter. The login root, issuer, Google callbacks and MCP URL stay at their current URLs.

The OS docs Worker uses an internal service binding to the original docs Worker for translation. Credentials remain owned by the original Worker; do not export or copy its secret values. An unconfigured provider returns the existing 503 and English fallback.

## Local preparation and isolated previews

Run `bun packages/dialer-website/scripts/release-public-sites.mjs --surface website` or `--surface docs` with the phase environment set. This builds only. Add `--preview --deploy` to deploy route-free previews; preview Workers have distinct names. CI deployment requires scoped Cloudflare tokens. Pages uses `CLOUDFLARE_PAGES_API_TOKEN`; Workers uses `CLOUDFLARE_API_TOKEN`.

Validate previews with `node packages/dialer-website/scripts/test-public-mounts.mjs`; origin overrides let the same browser contract check the real OS namespaces after activation. The production Dialer browser contract uses `PUBLIC_SITE_CHANNEL=production`.

## Phased activation and rollback

1. Record the current Pages deployment, docs bypass route, auth route, auth Worker version, binding identities and public metadata.
2. Merge the validated source with phase still legacy. Confirm only public jobs execute.
3. Set phase os-mounted; dispatch website and docs. Check both namespaces, root login, issuer and existing authenticated MCP access.
4. Set phase dialer; dispatch website and docs. Check public website/docs, canonical URLs, pricing/setup, search, Markdown and old OS bookmark redirects. Verify auth identities and routes again.

Retain the exact pre-cutover Pages deployment ID in private release evidence. To roll back the website, restore that deployment through Pages rollback and keep phase os-mounted until the issue is fixed. To roll back docs, PUT the existing `docs.consuelohq.com/*` route to `{ pattern: 'docs.consuelohq.com/*', script: null }`. Do not delete the bypass route: the workspace wildcard would otherwise capture it. The existing consuelo-docs Worker/custom domain remains the origin. Setting the phase alone does not undo an already deployed route or Pages deployment.

No live carrier calls, Marketplace registration changes or Stripe charges are part of this release.
