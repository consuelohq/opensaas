# Memes — source-preserving OS media subskill

## Trigger and boundary

Use for real-photo, movie-still, screenshot, screenshot-caption, reaction-image, or two-person meme creation and revision. This owns **the actual original-image → verified source → download → overlays → QA → final files** workflow. It does **not** generate a replacement photograph or imply that a still photo is a newly generated image. Only call image-generation capabilities if explicitly requested and compatible with the user's source-preservation constraints.

## Required workflow

### 1. Find the exact blank

- Start with any attached reference. Identify the **specific scene** by visible clues; search for uncaptioned copies of that actual scene (multiple reverse-image/image-search candidate queries when available). Do not assume the first result is the right crop.
- Compare candidate frames for camera position, clothing, props, shelf/background details, and overlap; reject watermarks and low-resolution screenshots. Prefer high-resolution originals from dependable sources, but distinguish provenance from copyright permission.
- If there is no exact uncaptioned original, use the closest verified shot and tell the user about the crop difference rather than silently substituting/generated content.
- Keep a URL + retrieval date + dimensions + hash for the chosen source. Retrieve logo/source artwork from verified/official resources when practical.

### 2. Download on the user's OS computer

- Use OS `browser.test` / `browser.open` for known webpages and `browser.download` for a real download link (found by `browser.snap`). The OS browser is not a general search engine; use supported search/discovery first.
- For a known direct HTTP(S) image URL, `code.call` (Bun `fetch` or Python) is suitable **on the connected local node**. Validate response status, content type, bytes, and decodeable dimensions before saving. The download is **not** a request to launch image generation.
- Prefer `session.start({kind:"work"})` for an isolated working directory, or use a scoped user-owned folder. Store `sources/original.<ext>` and `sources/<logo>.png/.svg`; never overwrite the attachment.
- Keep downloadable deliverables under `~/Downloads/<meme-slug>/` or an explicitly requested destination. Verify destination and file checksum after copy.



#### Direct-source download example (OS `code.call`, Bun)

After choosing a verified image URL and a work session on the **correct node**, save the original bytes instead of screen-capturing or generating a substitute:

~~~ts
const url = "https://example.com/verified-original.jpg"; // replace with a checked source URL
const destination = "sources/original.jpg";
const response = await fetch(url, { redirect: "follow" });
const mime = response.headers.get("content-type") ?? "";
if (!response.ok || !mime.startsWith("image/")) {
  throw new Error(`Rejected image fetch: HTTP ${response.status}, MIME ${mime}`);
}
const bytes = new Uint8Array(await response.arrayBuffer());
if (!bytes.length || bytes.length > 40_000_000) {
  throw new Error("Empty image or image exceeds 40 MB source limit");
}
await Bun.write(destination, bytes);
console.log(JSON.stringify({destination, mime, bytes: bytes.length, sourceUrl: response.url}));
~~~

Then inspect/decode the saved image (for example, Pillow `Image.open(...).verify()`), capture dimensions and SHA-256, and keep the original file immutable. Never use downloaded page HTML as if it were image bytes. For pages requiring a click, use the OS browser download flow instead.

### 3. Build a repeatable **edit recipe**

Use a config describing the crop, target size, and each overlay. Keep `sources/original` immutable. The [meme composer](compose.py) is a deterministic Pillow implementation for still photographs, captions, and PNG logo overlays.

Example command using OS `code.call` in the owning work session. Resolve `installedScriptPath` from the installed user Skills root on the selected node (e.g., `<user-root>/Consuelo/Skills/media/memes/compose.py` on macOS); do not assume any particular person's home directory:

~~~ts
const installedScriptPath = "<resolved-visible-user-root>/Skills/media/memes/compose.py";
await os.call({
  tool: "code.call",
  workSession,
  input: {
    language: "bash",
    mode: "edit",
    code: `python3 ${JSON.stringify(installedScriptPath)} --config ./meme.json --out ./output --name final`
  }
});
~~~

Resolve the placeholder path from the user's actual installed Consuelo root, not from another person's home. If Bash is unavailable, use a Python `code.call` wrapper with the same logic. The script accepts an `original` image, optional exact crop, transparent logos, and caption overlay placements and creates a blank crop, edited PNG/JPG, and manifest. It verifies pixel identity **outside all overlay masks** on the PNG result.

If logos are SVG, use `media.svg` to inspect/render to transparent PNG, or locally `rsvg-convert -w WIDTH -h HEIGHT logo.svg -o logo.png` if available; inspect results. Avoid flattening a photographic scene to vectors.

**Output defaults:** 1200×1200 social square when the reference is square; otherwise preserve the requested aspect ratio. Captions generally use bold white text with a dark stroke. Use layout positions appropriate to each source, not hard-coded positions from one movie still. Verify the expected words exactly.

### 4. Validate and deliver

- Check original/cropped photo geometry, source hash, logos' visible pixels, text placement, capitalization, bounds, contrast, and sharpness.
- Compare exported PNG with the original blank canvas **outside** the overlay rectangles. If anything changed there, investigate; do not label it source-preserving without evidence. A lossy JPG is permitted to differ across pixels.
- Export both `final.png` (sharp overlays) and `final.jpg` (smaller), plus the blank `blank.png`/`blank.jpg` when helpful. Keep the JSON recipe and `manifest.json`.
- Open or render a preview before calling the task complete. Use the OS browser on a local preview page if it genuinely helps, otherwise a viewer or file inspection.
- Copy outputs into the user's chosen folder, verify sizes/hash and report the directory. Provide provenance and note uncertainties, especially if original source is approximate or restricted.

## Prior proof: record-store logo meme (2026-10-28)

The user supplied a watermarked/text-overlaid 1:1 image of the record-bin scene from `(500) Days of Summer`. A cleaner 3840×2560 movie still was retrieved instead of repainting the supplied meme. The source was cropped and resized to 1200×1200; separate 245px Codex and 216px Grok logos were overlaid; the caption was revised to exactly **“He was a [Codex] boy”** and **“She was a [Grok] girl”**. The final source-preserving PNG and smaller JPG were written and SHA-verified on the user's computer. The original film pixels remain the original outside the added overlays. The attached [example recipe](examples/record-store.example.json) records the composition, but no copyrighted movie asset is bundled.

This is the procedure to repeat. The exact prior tool choice was **OS `code.call` + Pillow**, with OS work sessions and local download/copy. `media.svg` is useful for vector logos but was not required to composite that photograph.

## Failure modes

- Only finding a logo-covered template: continue source search; don't erase broad regions from a photo and pretend nothing changed.
- Wrong scene or crop: disclose discrepancy; do not falsely promise a pixel-perfect match.
- Missing Python/Pillow: check `media.svg`, `rsvg-convert`, and available image libraries; fail clearly or ask to install a dependency instead of inventing support.
- SVG wrong transparency: render at the exact required resolution, inspect channel/alpha, and avoid stretching.
- Captions hidden behind symbols: measure text bounds and reposition overlays.
- Publishing to public cloud: never do so silently; the default is a verified local file in the user's Downloads folder.
- Don't claim that X has a JPG/PNG ranking preference. Decide based on asset sharpness, dimensions and size.
