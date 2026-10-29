# Dialer documentation ownership

Read README.md, AUTHORING.md and CLAIM-LEDGER.md first. Preserve the cloned responsive shell unless the task explicitly changes its design.

Own this package only. Existing OS docs, marketing, auth, telephony and production domains have separate owners. Use Bun commands and the managed stream/task workflow. This is a standalone Bun-owned package; do not add it to root Yarn workspaces as an unrelated migration.

Every sidebar, footer, browse-menu and Markdown destination must resolve to curated Dialer material. English is the sole editorial source; do not commit machine-translated trees. Keep provider secrets server-side. Preview deployment must not copy a live KV ID or custom-domain route.

Run validate, package tests, translation tests, build and browser checks after structural changes. Include mobile, short landscape, tablet and desktop sizes. Shared release wiring and domain cutover belong to Branch 3.
