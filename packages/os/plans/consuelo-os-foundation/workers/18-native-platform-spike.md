# Worker 18: Native Platform Architecture Spike

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` in full before inspecting or changing code. Treat it as the product contract. This is a bounded research and prototype task, not permission to build the full macOS app or redesign the lifecycle engine.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Mission

Prove the smallest maintainable native shell architecture for Consuelo OS and document how macOS, Linux, and Windows can consume the same lifecycle contract without duplicating updater logic.

## Dependencies

- The lifecycle interfaces described in workers 04 and 05 may still be under construction. Use their approved contracts, not private implementation details.
- Use current official Apple, Microsoft, Bun, and platform documentation for claims that can drift.

## Questions to answer

1. How should a SwiftUI menu-bar app communicate with the local OS runtime?
2. Which process owns install, update, rollback, repair, and uninstall state?
3. What is the minimal typed event/API contract that all platform shells consume?
4. How should launchd, systemd user services, and Windows services map to the same lifecycle states?
5. What can ship before Apple signing/notarization is configured, and what must remain a documented release gate?
6. Which update framework, if any, is appropriate after the shared lifecycle engine exists?
7. How can the platform shell avoid reading secrets or parsing terminal output?

## Required investigation

- Read the current bootstrap, installer, local service, launchd generation, health, and uninstall paths.
- Identify the existing structured JSON/event surfaces that can be reused.
- Verify whether SwiftUI `MenuBarExtra` meets the alpha UI need.
- Evaluate updater frameworks only as a shell around the shared signed runtime-bundle/channel contract. Do not let a native updater become a second release authority.
- Document signing, notarization, entitlements, keychain, and privilege boundaries separately from alpha development.
- Define how the mandatory OCI clean-host lane plus GitHub-hosted macOS/Windows runners exercise the typed lifecycle boundary. Local Apple `container` or Docker execution is optional; CI coverage is not.

## Prototype

Create a narrow throwaway or task-scoped prototype that can:

- read a mocked lifecycle status response;
- render current version, channel, service health, and available update count;
- invoke mocked update and rollback requests through a typed local interface;
- prove no shell-output parsing is required.

Do not connect the prototype to production credentials or mutate the installed Mac Mini OS.

## Deliverables

- Architecture decision record with rejected alternatives.
- Typed lifecycle client contract suitable for Swift, TypeScript/Bun, and later Windows/Linux clients.
- Prototype and focused tests.
- A platform responsibility matrix.
- Explicit recommendation for the macOS alpha path and later signed distribution path.
- Exact follow-up constraints for workers 19-22.

## Acceptance gates

- One release/channel authority exists: the shared lifecycle engine.
- The native shell never reads bearer tokens, tunnel credentials, or provider secrets.
- The native shell never parses human CLI output.
- Closing the UI cannot terminate the OS service.
- The design works when the MacBook Air is offline.
- No Docker or Apple-container dependency is imposed on product installation.

## Out of scope

- Production App Store submission.
- Final visual polish.
- Replacing Hono, Caddy, the sites gateway, or MCP transport.
- Building Windows or Linux implementations.

## Completion report

Report evidence, unresolved platform gates, prototype limitations, and any master-plan assumption that current code disproves. Do not mark this task complete with only a prose recommendation.
