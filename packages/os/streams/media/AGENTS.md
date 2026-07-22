# Media stream instructions

This stream owns Consuelo OS media ingestion, analysis, transformation, rendering, conversion, export, and artifact handoff.

- Prefer the typed `media.*` tools instead of ad hoc ffmpeg, image, audio, or vision commands.
- Preserve source identity, provenance, timestamps, transformation parameters, and output relationships.
- Return structured metadata, artifact paths, and validation evidence rather than embedding large binary or raw media payloads.
- Validate generated media. Check the relevant probe, timeline, render, QA, export, or SVG contract instead of assuming a command succeeded.
- Use the focused Media suites for the changed capability, then the broader Media contract suite when the shared schema or runtime changes.
- Keep media-specific tool and runtime work in `stream/media` unless the change genuinely belongs to the shared Tools architecture.

Update this file only with durable Media-stream guidance. Temporary task status belongs in the workpad.
