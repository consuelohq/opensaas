# Media — Consuelo OS

## Purpose

Create or edit media artifacts through **Consuelo OS**, on the user's connected node, using inspected source files and real OS tools. This is an OS skill, not a ChatGPT skill. Follow the general workflow below; for static memes, load and follow [memes/SKILL.md](memes/SKILL.md) before producing an image.

### When to invoke

Use this skill for source-preserving image edits, memes, compositing logos and captions on existing photographs, SVG asset inspection, screenshots, short-form media preparation, and file export. For video, audio, sports-science, or motion workflows, discover the relevant live `media.*` tools before acting.

### Subskills

- **memes** — `media/memes/SKILL.md`: locate the *actual* unedited template, download a high-resolution copy to the connected computer, overlay clean text and supplied/verified logos, produce PNG + JPG, and verify that the photographed scene remains unchanged.

## Execution contract

1. Call `os.get_steering` **once per conversation**, if steering has not already been loaded. Select the intended connected node, and verify it is online; never silently reroute an explicitly selected node.
2. Use `os.call({tool:"tools.search",input:{query:"media ...",limit:5}})` for current tool signatures instead of guessing them. Consult [tooling.md](tooling.md) for a **2026-10-28 snapshot**, not as a claim of permanent tool availability.
3. Resolve the source type. For a **user-provided image**, inspect it directly. For an online original, research/search for the unmarked source first; use `browser.test` / `browser.open` on known URLs and `browser.download` for clickable downloads. For a verified direct image URL, a tightly scoped `code.call` download may be preferable. Do not fabricate the source.
4. Start a `session.start({kind:"work",title:"..."})` on the node for non-repo local work, or use an explicitly user-owned target folder. Work in a fresh scoped directory. Never write to managed `~/.consuelo/` as an ordinary asset workflow.
5. Keep originals untouched; create separate source, blank, overlays, outputs, and manifest files.
6. For vector assets, use `media.svg` to inspect/render/verify SVG, or `rsvg-convert` locally if necessary. `media.svg.convert` can trace a raster but is usually unnecessary for a raster meme.
7. For **still-image** overlays, use the memes subskill and Python/Pillow through OS `code.call` if available; do not misuse video `media.compose` or `media.overlay.render` merely because they are named media.
8. Validate exact text, cropping, text overlap, logo sharpness, dimensions, outside-overlay preservation, and PNG/JPG output sizes. Show a preview if the interface supports it.
9. Copy completed files to a user-visible, user-approved path (typically `~/Downloads/<asset-slug>/`), verify they exist on the connected node, and report the exact paths.
10. Preserve source URLs, checksums, original files, config, and editability; avoid overwriting unrelated files, contacting external services with private files, and implying that rights/permissions were acquired.

## Tool guidance

Use **OS tools** rather than inventing direct computer actions. Helpful classes: `browser.*` for known-URL downloads and verification; `media.svg`, `media.svg.convert`, `media.screenshot.render` for relevant still/vector work; `media.probe`, `media.qa`, `media.ingest`, `media.frames.extract`, `media.overlay.render`, `media.compose`, `media.export` for video workflows; `code.call` for deterministic Pillow or Bun file operations; `session.start` for work scoping.

Before a new media job, rerun discovery and verify that the selected node has the required tools. If a preferred tool is absent, state the gap and switch to an available equivalent without fabricating output.

## Non-negotiable source preservation

- If the user wants a real photograph or original still, **never regenerate the underlying image** or replace subjects/faces/scenery with an AI approximation.
- Retouch or inpaint only with explicit permission and disclose it. Copy/resize/crop the original and composite captions/logos as separate layers.
- Research candidate originals carefully. Prefer the same actual scene, correct actors/composition, unwatermarked source and largest legitimate resolution. Record provenance and don't claim source rights.
- For logos, prefer official SVG/PNG assets, maintain transparency, and preserve brand proportions. No need to vectorize a photographic background.
- A visible `skill.json` is metadata, not a runnable tool or proof of global installation. For this local user-owned skill, the OS steering route below supplies discovery until it is bundled into an immutable release.
