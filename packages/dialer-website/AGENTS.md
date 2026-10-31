# Consuelo Dialer website

This independently Bun-owned Astro package clones the current Consuelo website design. Read DESIGN.md, animations.md and COMPONENTS.md before structural changes. Keep tokens and primitives, responsive layouts, stacked wordmark, cloud assets and FAQ behavior.

Own this package only. The OS website remains packages/consuelo-website; Branch 2 owns Dialer docs. Branch 3 owns production domain cutover. Do not copy OS authentication routes, live OAuth registrations or production domain bindings into this package.

Copy lives in src/data/dialer-content.ts; links/navigation/pricing have separate typed modules. Keep a claim ledger. Ko approved intended-launch wording for the Oct 30 pricing redesign, including Mercury coaching. CLAIMS.md and BILLING-ECONOMICS.md track the implementation gaps and DEV-1644–1647 launch gates. Do not mistake draft prices or feature rows for deployed entitlements. Do not claim unmeasured performance improvements or universal integration support.

Commands: bun install; bun run build; bun test tests/marketing-contract.test.ts; bun run test:browser. The build materializes checked-in cloud/share assets. Regenerate social cards only when needed, then keep their encoded sources. Preview is noindex and has no production routes. Do not remove those boundaries before Branch 3 approves cutover.

Pricing redesign delivery is scoped to the noindex preview. The production domain cutover has already shipped independently; preserve its routes. Do not publish the intended-launch pricing to the indexed company domain until product/billing evidence is reconciled.
