# Fix nested OS validator

## Goal
Clear remaining docs-lint failure after moving OS under `User Guide > Documentation > OS`.

## Issue
`packages/consuelo-docs/scripts/validate-os-docs.ts` still assumed OS was a top-level tab. The navigation now intentionally keeps only `User Guide` and `Tools` top tabs.

## Plan
Update the validator to locate the explicit `OS` group wherever it sits in the generated navigation, including localized route prefixes.


## Validation
- yarn docs:validate-os-docs: passed, validated 13 generated skill pages and localized OS routes.
- bun --check packages/consuelo-docs/scripts/validate-os-docs.ts: passed.
