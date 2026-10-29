#!/usr/bin/env python3
"""Pillow-backed regression checks for Consuelo OS source-preserving meme composer."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image, ImageChops, ImageDraw

MODULE = Path(__file__).resolve().parents[1] / "compose.py"
SPEC = importlib.util.spec_from_file_location("meme_composer", MODULE)
assert SPEC and SPEC.loader
composer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(composer)


class MemeComposerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "sources").mkdir()
        original = Image.new("RGB", (400, 300))
        pixels = original.load()
        for y in range(original.height):
            for x in range(original.width):
                pixels[x, y] = ((3*x) % 256, (2*y) % 256, (x+y) % 256)
        original.save(self.root / "sources" / "original.png")
        logo = Image.new("RGBA", (80, 80), (0,0,0,0))
        ImageDraw.Draw(logo).rounded_rectangle((3, 3, 76, 76), radius=16, fill=(255, 0, 0, 230))
        logo.save(self.root / "sources" / "logo.png")
        self.recipe = {
            "source": {"path":"sources/original.png", "url":"https://example.test/original", "crop":[40,20,360,280]},
            "canvas":{"width":240,"height":240},
            "layers":[
                {"type":"image","path":"sources/logo.png","x":20,"y":40,"width":50,"height":50,"corner_radius":8},
                {"type":"text","text":"He was a","x":15,"y":5,"size":23,"stroke_width":2},
            ]
        }
        self.config = self.root/"recipe.json"
        self.config.write_text(json.dumps(self.recipe),encoding="utf-8")
        self.output=self.root/"result"

    def test_exact_source_preservation_and_dimensions(self):
        report=composer.render_meme(self.config,self.output,"result")
        self.assertTrue(report["pngOutsideOverlayPixelsUnchanged"])
        self.assertEqual(report["canvas"],{"width":240,"height":240})
        expected=Image.open(self.root/"sources/original.png").crop((40,20,360,280)).resize((240,240),Image.Resampling.LANCZOS)
        blank=Image.open(self.output/"blank.png")
        result=Image.open(self.output/"result.png")
        self.assertIsNone(ImageChops.difference(expected.convert("RGB"),blank.convert("RGB")).getbbox())
        self.assertEqual(blank.getpixel((200,200)),result.getpixel((200,200)))
        self.assertNotEqual(blank.getpixel((45,60)),result.getpixel((45,60)))
        self.assertTrue((self.output/"result.jpg").is_file())
        self.assertTrue((self.output/"manifest.json").is_file())
        manifest=json.loads((self.output/"manifest.json").read_text())
        self.assertEqual(manifest["source"]["url"],"https://example.test/original")
        self.assertEqual(len(manifest["layers"]),2)
        self.assertEqual(len(manifest["files"]),4)

    def test_prevents_overwrite_without_explicit_flag(self):
        composer.render_meme(self.config,self.output,"result")
        with self.assertRaises(FileExistsError):
            composer.render_meme(self.config,self.output,"result")
        report=composer.render_meme(self.config,self.output,"result",overwrite=True)
        self.assertTrue(report["pngOutsideOverlayPixelsUnchanged"])

    def test_rejects_out_of_canvas(self):
        self.recipe["layers"][0]["x"]=230
        self.config.write_text(json.dumps(self.recipe))
        with self.assertRaisesRegex(ValueError,"outside"):
            composer.render_meme(self.config,self.output,"result")

    def test_rejects_missing_logo_without_creating_output(self):
        self.recipe["layers"][0]["path"]="sources/missing.png"
        self.config.write_text(json.dumps(self.recipe))
        with self.assertRaises(FileNotFoundError):
            composer.render_meme(self.config,self.output,"result")
        self.assertFalse(self.output.exists())

    def test_rejects_invalid_filename(self):
        with self.assertRaisesRegex(ValueError,"filename slug"):
            composer.render_meme(self.config,self.output,"../escape")


if __name__=="__main__":
    unittest.main()
