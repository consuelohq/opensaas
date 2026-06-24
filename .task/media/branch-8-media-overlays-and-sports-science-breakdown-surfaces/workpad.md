# Branch 8: media overlays + sports-science breakdown surfaces

Updated: 2026-06-24T01:25:17.130Z

Scope:
- Implement declarative overlay render schema/fixture surfaces.
- Implement data-backed sports-science breakdown planning surfaces.
- Keep work limited to tests 25-26 plus compose overlay artifact consumption hook.
- Do not implement export packages, artifact handoff, storage-budget model accounting, research ingest, or native rendering dependencies.

Implementation notes:
- Added strict media.overlay.v1 schema surfaces for arrow, label, zoom-box, freeze-frame-callout, force-vector, joint-angle, velocity-trail, comparison-ghost.
- Overlay specs reject executable/arbitrary-code surfaces and remain declarative JSON.
- Added renderOverlayEffect / renderOverlayForCli fixture surface without native renderer dependencies.
- Added sports-science breakdown plan validation and assertBreakdownPlanIsDataBacked.
- Sports-science planned overlays enforce required data: force-vector coordinate data, joint-angle pose data, velocity-trail motion-track data.
- Added compose overlay artifact collection hook so compose can consume media.overlay.v1 artifacts without changing native render behavior.

Validation:
- bun run --cwd packages/os typecheck: pass
- bun --cwd packages/os test tests/media/25-overlay-render.test.ts tests/media/26-sports-science-breakdown.test.ts: pass
- bun run --cwd packages/os media:test:manifest: pass
- bun run --cwd packages/os media:test:deps: pass
- bun run --cwd packages/os media:test:contracts: pass
- bun run --cwd packages/os media:test:core: pass
- bun run --cwd packages/os media:test:ingest: pass
- bun run --cwd packages/os media:test:audio: pass
- bun run --cwd packages/os media:test:vision: pass

## workspace-owned: validation evidence

- 2026-06-24 01:25:54 `review.run`: passed — OK
