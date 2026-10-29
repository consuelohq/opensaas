# Media tools available through Consuelo OS

Snapshot verified on **2026-10-28**, local macOS OS node. Before acting, discover the current tool signatures using `os.call({tool:"tools.search",input:{query:"media ...",limit:5}})`. Availability and readiness are different: a tool may be registered while an optional executable is missing. Use `media.doctor` or local dependency checks where appropriate.

## Useful for memes and still assets

| Tool | Verified OS purpose | Meme guidance |
|---|---|---|
| `tools.search` | Find current typed OS tools and signatures | First discovery step; no invented capabilities |
| `browser.test`, `browser.open`, `browser.snap` | Inspect known URLs and source sites | Candidate research after locating a URL |
| `browser.download` | Download from a clicked browser element | For files behind webpage links |
| `code.call` | Run bounded Bun/Python/bash programs on connected node | Direct HTTP download, Pillow compositing, file validation |
| `session.start` | Scoped work sessions outside managed repositories | Isolate sources/outputs on owning node |
| `media.svg` | SVG structure inspect/render/edit/measure/verify | Verify or render crisp logo assets |
| `media.svg.convert` | Raster to SVG wrapper/trace | Normally unnecessary for photographic memes |
| `media.screenshot.render` | Consuelo-themed deterministic social screenshot output | Only for screenshot-style assets |
| `media.probe` | ffprobe media metadata | Best for video; still image dimensions can use Pillow |
| `media.qa` | File/media quality checks | Mainly rendered video workflows; complement Pillow checks |

## Other OS media tools (25 media tools in current manifest)

- **Video/edit:** `media.ingest`, `media.frames.extract`, `media.clip.search`, `media.scene.detect`, `media.camera.motion`, `media.motion.track`, `media.object.track`, `media.overlay.render`, `media.compose`, `media.timeline.validate`, `media.export`.
- **Audio:** `media.audio.extract`, `media.audio.normalize`, `media.transcribe`.
- **Analysis:** `media.pose.estimate`, `media.angle.measure`, `media.sports-science.metrics`, `media.breakdown.plan`.
- **Runtime:** `media.doctor`, `media.install`.

These tools are not all appropriate for a still-image logo meme: **do not force a video/timeline tool into a static compositor job**.

## Example dependency inventory from one macOS node

- **Available on this test Mac, not a requirement for every OS installation:** `python3` at `/opt/homebrew/bin/python3`; `Pillow 12.1.0`; `ffmpeg`; `ffprobe`; `rsvg-convert`; macOS `sips` and `qlmanage`; `bun`.
- **Not observed in PATH:** ImageMagick `magick`, `convert`; do not rely on them.
- OS media tool registration and runtime dependencies can change with updates. Recheck `Bun.which`, `python3 -c "import PIL"`, or `media.doctor` before performing tasks.

## Live smoke checks for this node (2026-10-28)

- `media.svg` **worked**: inspected the Grok SVG, found four vector paths and no embedded raster content.
- `media.doctor` was registered but **failed** when invoked with `error: Script not found \"media\"`. This is a media-tool command routing gap, not proof that the node lacks all media utilities.
- The meme compositor independently **worked** with Python/Pillow on the actual 3840x2560 source, exported 1200x1200 PNG/JPG, and verified outside-overlay pixel preservation.
- Treat registration as a discoverability signal, not success. Validate individual tools at runtime and use tested fallbacks where appropriate.

## Why we chose Pillow on the record-store meme

A real film photo was already clean; only the logos and captions had to change. Direct 2D compositing with Pillow preserved the photograph, avoided model-based image generation, permitted exact typographic placement and crop control, produced both PNG and JPG, and supported byte/pixel-based validation. It was simpler and more appropriate than running video `media.compose`.

## Tool use boundaries

Use browser tools for page interaction; `code.call` for filesystem/code execution; `media.svg` for vector-specific manipulation; `media.screenshot.render` only if user wants a themed screenshot card. Do not leak local private files into external image APIs. Never use network URL downloads without checking the returned media type, response status, and final path.
