#!/usr/bin/env python3
"""
Генерация фоновых изображений для страниц игры через Vertex AI Imagen 4.

Портретный формат 9:16, без персонажей — только атмосфера.
7 вариантов главной страницы + 5 страничных фонов = 12 изображений.

Usage:
    python generate_backgrounds.py --project gen-lang-client-0504555507
    python generate_backgrounds.py --project ... --dry
    python generate_backgrounds.py --project ... --force
"""

from __future__ import annotations

import argparse
import os
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from generate import ROOT, TokenBucket, autocrop, write_image, already_done

OUTPUT_DIR = ROOT / "output_backgrounds"

MODEL    = "imagen-4.0-generate-001"   # обычный (не fast) — фоны важнее качеством
LOCATION = "us-central1"
REQUESTS_PER_MINUTE = 10
MAX_RETRIES         = 5
INITIAL_BACKOFF_SEC = 5.0
BACKOFF_MULTIPLIER  = 2.0

STYLE_PREFIX = (
    "semi-realistic high-detail digital fantasy painting, "
    "Slavic folk-tale atmosphere, no cartoon outlines, no flat colour fields, "
    "three-dimensional volumetric lighting with warm amber and cool violet-blue contrast, "
    "deep atmospheric depth, painterly render, "
    "no characters, no people, no figures in foreground, "
    "russian fairy tale fantasy, dark mystical atmosphere, "
    "fairy gold and enchanted purple and night blue dominant palette, "
    "dark background, no text, no letters, no watermarks, "
    "portrait composition 9:16, full-frame immersive environment"
)


def load_backgrounds() -> list[dict]:
    import json
    data = json.loads((ROOT / "backgrounds.json").read_text(encoding="utf-8"))
    jobs = []
    for item in data.get("home", []):
        jobs.append({"key": item["key"], "desc": item["desc"]})
    for item in data.get("pages", []):
        jobs.append({"key": item["key"], "desc": item["desc"]})
    return jobs


def build_prompt(desc: str) -> str:
    return f"{STYLE_PREFIX}, {desc}"


def call_vertex(client, model: str, prompt: str) -> tuple[bytes, str]:
    from google.genai import types  # type: ignore
    response = client.models.generate_images(
        model=model,
        prompt=prompt,
        config=types.GenerateImagesConfig(
            number_of_images=1,
            aspect_ratio="9:16",
            safety_filter_level="block_few",
            person_generation="allow_adult",
        ),
    )
    images = getattr(response, "generated_images", None) or []
    if not images:
        raise RuntimeError(f"Vertex AI вернул пустой список.")
    img_obj = images[0]
    raw = getattr(getattr(img_obj, "image", None), "image_bytes", None)
    if raw:
        return raw, ".png"
    raw = getattr(img_obj, "_image_bytes", None)
    if raw:
        return raw, ".png"
    raise RuntimeError("Не удалось извлечь байты. pip install -U google-genai")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT", ""))
    parser.add_argument("--location", default=LOCATION)
    parser.add_argument("--model", default=MODEL)
    parser.add_argument("--rpm", type=int, default=REQUESTS_PER_MINUTE)
    parser.add_argument("--dry", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if not args.project:
        print("ERROR: укажи --project your-gcp-project-id", file=sys.stderr)
        return 2

    jobs = load_backgrounds()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # monkey-patch OUTPUT_DIR для write_image / already_done
    import generate as _gen
    _gen.OUTPUT_DIR = OUTPUT_DIR

    price = 0.04  # imagen-4.0-generate-001
    print(f"[plan] {len(jobs)} фонов · model={args.model} · ≈${len(jobs)*price:.2f}")

    if args.dry:
        for j in jobs:
            print(f"\n--- {j['key']}")
            print(build_prompt(j["desc"])[:300])
        return 0

    try:
        from google import genai  # type: ignore
    except ImportError:
        print("ERROR: pip install google-genai", file=sys.stderr)
        return 2

    client = genai.Client(vertexai=True, project=args.project, location=args.location)
    limiter = TokenBucket(rpm=args.rpm)

    todo = [j for j in jobs if not already_done(j["key"]) or args.force]
    print(f"[plan] {len(todo)} to generate, {len(jobs)-len(todo)} already done\n")

    failures = []
    for i, job in enumerate(todo, 1):
        print(f"[{i}/{len(todo)}] {job['key']}")
        prompt = build_prompt(job["desc"])
        backoff = INITIAL_BACKOFF_SEC
        for attempt in range(1, MAX_RETRIES + 1):
            limiter.wait()
            try:
                data, ext = call_vertex(client, args.model, prompt)
                mime = "image/png"
                path = write_image(job["key"], data, ext, mime)
                print(f"  ✓ {path.name} ({len(data)//1024} KB)")
                break
            except Exception as err:
                jitter = random.uniform(0, 0.5) * backoff
                wait = backoff + jitter
                print(f"  attempt {attempt}/{MAX_RETRIES} failed: {str(err)[:120]} → sleep {wait:.1f}s", file=sys.stderr)
                if attempt == MAX_RETRIES:
                    failures.append((job["key"], str(err)))
                    break
                time.sleep(wait)
                backoff *= BACKOFF_MULTIPLIER

    if failures:
        print(f"\n[done] {len(todo)-len(failures)}/{len(todo)} ok, {len(failures)} failed:", file=sys.stderr)
        for key, msg in failures:
            print(f"  - {key}: {msg[:150]}", file=sys.stderr)
        return 1

    print(f"\n[done] {len(todo)}/{len(todo)} → {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
