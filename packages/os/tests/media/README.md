# OS media final-state TDD suites

These tests are the executable spec for OS-native media tooling. They are intentionally written before the implementation is complete.

Run all media contract suites:

```bash
bun --cwd packages/os test tests/media
```

Suggested follow-up agent split:

1. Suites `00`-`05`: manifest taxonomy, package boundaries, workflow intent/runbook routing, runtime dependency catalog, installer plan, doctor.
2. Suites `06`-`10`: Effect architecture, versioned schemas, CLI JSON envelope.
3. Suites `11`-`15`: `media-core` tools: probe, frame extraction, timeline validation, composition, QA.
4. Suites `16`-`17`: media-internal source capture and `media.ingest` asset preservation.
5. Suites `18`-`19`: YouTube clip search and provenance-first ingest behavior.
6. Suite `20`: audio extraction/normalization/transcription scaffolding.
7. Suites `21`-`24`: OpenCV vision-light, MediaPipe pose, motion tracking, angle/sports metrics.
8. Suites `25`-`27`: declarative overlays, sports-science planning, export packages.
9. Suites `28`-`30`: artifact/office handoff, storage budget, generated-fixture integration.

Principles encoded here:

- Media lives under `packages/os`, not `packages/workspace`, and not under office.
- Media has its own source manifest and appears in the generated full manifest, not core by default.
- Native/runtime media tools are explicit installer dependencies, not hidden npm dependencies.
- OpenCV and MediaPipe are separate optional profiles: OpenCV is generic motion/computer vision; MediaPipe is semantic pose/body landmarks.
- Large model downloads are never implicit.
- Agents fill strict manifests and call deterministic tools; they do not make videos by vibes.
- `media.sourceCapture` is media-internal plumbing. It is not a manifest tool, workflow, runbook, package script, or user-facing operation.
- `media.ingest` is the visible media ingest tool and must preserve actual source media assets, not only transcripts or research packets.
- `research.ingest` stays independent. Media tests may borrow artifact discipline from it, but media implementation must not shell out through `research:ingest`.
