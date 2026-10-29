#!/usr/bin/env python3
"""Deterministic source-preserving still-image meme compositor for Consuelo OS.

Run: python3 compose.py --config meme.json --out ./output --name my-meme
Requirements: Pillow (PIL). Does not generate or inpaint source imagery.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sys

try:
    from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps
except ImportError as exc:
    raise SystemExit("Pillow is required: use the connected node's Python with PIL installed") from exc


def resolve_file(config_dir: Path, value: str) -> Path:
    path = Path(value).expanduser()
    return (path if path.is_absolute() else config_dir / path).resolve()


def image_sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def integer(value: object, name: str, minimum: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise ValueError(f"{name} must be an integer >= {minimum}")
    return value


def find_font(specified: str | None, size: int, config_dir: Path) -> ImageFont.FreeTypeFont:
    paths = [resolve_file(config_dir, specified)] if specified else []
    paths.extend(
        Path(candidate)
        for candidate in (
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
            "C:\\Windows\\Fonts\\arialbd.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
        )
    )
    for path in paths:
        if path.is_file():
            return ImageFont.truetype(str(path), size)
    raise FileNotFoundError("No bold font found; supply an explicit 'font' path in a text layer")


def box_inside(box: tuple[int, int, int, int], w: int, h: int, name: str) -> None:
    x0, y0, x1, y1 = box
    if x0 < 0 or y0 < 0 or x1 > w or y1 > h or x1 <= x0 or y1 <= y0:
        raise ValueError(f"{name} bounds {box} are outside the {w}x{h} canvas")


def render_recipe(recipe: dict, config_dir: Path) -> tuple[Image.Image, Image.Image, Image.Image, list[dict]]:
    source = recipe.get("source")
    if not isinstance(source, dict) or not isinstance(source.get("path"), str):
        raise ValueError("source.path is required")
    source_path = resolve_file(config_dir, source["path"])
    if not source_path.is_file():
        raise FileNotFoundError(f"source image missing: {source_path}")

    canvas = recipe.get("canvas", {})
    w = integer(canvas.get("width"), "canvas.width", 1)
    h = integer(canvas.get("height"), "canvas.height", 1)
    with Image.open(source_path) as original:
        original.load()
        base = original.convert("RGB")

    crop = source.get("crop")
    if crop is not None:
        if not isinstance(crop, list) or len(crop) != 4:
            raise ValueError("source.crop must be [left, top, right, bottom]")
        crop_box = tuple(integer(x, "source.crop coordinate") for x in crop)
        box_inside(crop_box, base.width, base.height, "source.crop")
        base = base.crop(crop_box)

    blank = base.resize((w, h), Image.Resampling.LANCZOS)
    result = blank.convert("RGBA")
    allowed = Image.new("L", (w, h), 0)
    allowed_draw = ImageDraw.Draw(allowed)
    layer_manifest = []
    for idx, layer in enumerate(recipe.get("layers", [])):
        if not isinstance(layer, dict):
            raise ValueError(f"layers[{idx}] must be an object")
        kind = layer.get("type")
        x = integer(layer.get("x"), f"layers[{idx}].x")
        y = integer(layer.get("y"), f"layers[{idx}].y")

        if kind == "image":
            file_value = layer.get("path")
            if not isinstance(file_value, str):
                raise ValueError(f"layers[{idx}].path is required")
            logo_path = resolve_file(config_dir, file_value)
            with Image.open(logo_path) as loaded:
                logo = loaded.convert("RGBA")
            width = integer(layer.get("width"), f"layers[{idx}].width", 1)
            height = integer(layer.get("height"), f"layers[{idx}].height", 1)
            box_inside((x, y, x + width, y + height), w, h, f"layers[{idx}]")
            # By default, preserve brand/logo proportions inside the requested placement box.
            if layer.get("fit", "contain") == "contain":
                logo.thumbnail((width, height), Image.Resampling.LANCZOS)
                holder = Image.new("RGBA", (width, height), (0, 0, 0, 0))
                holder.alpha_composite(logo, ((width-logo.width)//2, (height-logo.height)//2))
                logo = holder
            elif layer["fit"] == "stretch":
                logo = logo.resize((width, height), Image.Resampling.LANCZOS)
            else:
                raise ValueError(f"layers[{idx}].fit must be contain or stretch")

            corner_radius = integer(layer.get("corner_radius", 0), f"layers[{idx}].corner_radius")
            if corner_radius:
                mask = Image.new("L", (width, height), 0)
                ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, height - 1), radius=corner_radius, fill=255)
                logo.putalpha(ImageChops.multiply(logo.getchannel("A"), mask))
            result.alpha_composite(logo, (x, y))
            bounds = (x, y, x + width, y + height)
            layer_manifest.append({"type":kind, "bounds":list(bounds), "sha256":image_sha(logo_path), "path":str(logo_path)})
        elif kind == "text":
            label = layer.get("text")
            if not isinstance(label, str) or not label:
                raise ValueError(f"layers[{idx}].text must be a nonempty string")
            font = find_font(layer.get("font"), integer(layer.get("size", 48), f"layers[{idx}].size", 1), config_dir)
            stroke = integer(layer.get("stroke_width", 3), f"layers[{idx}].stroke_width")
            draw = ImageDraw.Draw(result)
            bounds = draw.textbbox((x, y), label, font=font, stroke_width=stroke, anchor="lt")
            box_inside(bounds, w, h, f"layers[{idx}]")
            draw.text((x,y), label, font=font, fill=layer.get("fill", "#ffffff"),
                      stroke_width=stroke, stroke_fill=layer.get("stroke_fill", "#111111"), anchor="lt")
            layer_manifest.append({"type":kind, "text":label, "bounds":list(bounds)})
        else:
            raise ValueError(f"layers[{idx}].type must be image or text")
        allowed_draw.rectangle(bounds, fill=255)

    final = result.convert("RGB")
    outside = Image.composite(
        ImageChops.difference(blank, final),
        Image.new("RGB", blank.size),
        ImageOps.invert(allowed)
    )
    if outside.getbbox() is not None:
        raise RuntimeError(f"source-preservation check failed: changed pixels outside overlays {outside.getbbox()}")
    return blank, final, allowed, layer_manifest


def render_meme(config_path: Path, output_dir: Path, name: str, overwrite: bool = False) -> dict:
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,90}", name):
        raise ValueError("name must be a 1-90 character filename slug (letters, numbers, _ or -)")
    config_path = config_path.expanduser().resolve()
    recipe = json.loads(config_path.read_text(encoding="utf-8"))
    if not isinstance(recipe, dict) or not isinstance(recipe.get("layers"), list):
        raise ValueError("config must contain a layers array")
    output_dir = output_dir.expanduser().resolve()
    file_names = [f"blank.png",f"blank.jpg",f"{name}.png",f"{name}.jpg","manifest.json"]
    targets = [output_dir / x for x in file_names]
    existing = [str(path) for path in targets if path.exists()]
    if existing and not overwrite:
        raise FileExistsError("outputs already exist; use --overwrite to replace only expected filenames: " + ", ".join(existing))

    blank, final, allowed, manifest_layers = render_recipe(recipe, config_path.parent)
    output_dir.mkdir(parents=True, exist_ok=True)
    blank.save(output_dir / "blank.png", optimize=True)
    blank.save(output_dir / "blank.jpg", format="JPEG", quality=95, subsampling=0)
    final.save(output_dir / f"{name}.png", optimize=True)
    final.save(output_dir / f"{name}.jpg", format="JPEG", quality=95, subsampling=0)
    with Image.open(output_dir / f"{name}.png") as exported:
        difference = ImageChops.difference(blank, exported.convert("RGB"))
        outside = Image.composite(difference, Image.new("RGB", blank.size), ImageOps.invert(allowed))
        if outside.getbbox() is not None:
            raise RuntimeError("PNG verification failed: changed pixels outside overlay regions")

    source = recipe["source"]
    source_path = resolve_file(config_path.parent, source["path"])
    paths = [output_dir / x for x in file_names[:-1]]
    manifest = {
        "schemaVersion": 1,
        "kind": "source-preserving-meme",
        "renderedAt": datetime.now(timezone.utc).isoformat(),
        "config": str(config_path),
        "source": {"path": str(source_path), "sha256": image_sha(source_path), "url": source.get("url")},
        "canvas": {"width":final.width, "height":final.height},
        "layers": manifest_layers,
        "pngOutsideOverlayPixelsUnchanged": True,
        "files": [
            {"name":p.name, "path":str(p), "bytes":p.stat().st_size, "sha256":image_sha(p)}
            for p in paths
        ],
    }
    (output_dir/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
    return manifest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, type=Path, help="JSON recipe with source and layers")
    parser.add_argument("--out", required=True, type=Path, help="User-owned output folder")
    parser.add_argument("--name", default="meme", help="Final PNG/JPG name stem")
    parser.add_argument("--overwrite", action="store_true", help="Explicitly replace only known output files")
    args = parser.parse_args(argv)
    try:
        manifest = render_meme(args.config, args.out, args.name, args.overwrite)
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps({
        "ok":True,
        "canvas":manifest["canvas"],
        "pngOutsideOverlayPixelsUnchanged":manifest["pngOutsideOverlayPixelsUnchanged"],
        "sourceSha256":manifest["source"]["sha256"],
        "outputs":manifest["files"],
    },indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
