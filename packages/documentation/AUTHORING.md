# Consuelo OS documentation authoring

The public documentation is organized around seven user intents: Start, Connect, Build with OS, Sites, Observe, Secure, and Reference.

Office specifications and reports are directional research inputs. They are not proof of current product behavior. Before publishing a material claim, verify it against current code, focused tests, and a real runtime path where practical.

## Claim ledger

Each writing PR keeps a claim ledger with these fields:

| Claim | Public page | Source code | Tests | Runtime verification | Directional artifact | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

Allowed status values are `shipped`, `preview`, `planned`, `unresolved`, and `deprecated`. Public pages may describe shipped behavior and clearly labeled preview behavior. Planned and unresolved behavior must not be written as available.

## Page contract

A task page should state what the reader will accomplish, prerequisites, the shortest correct path, exact commands or settings, the expected result, verification, common failures, and the relevant reference page.
