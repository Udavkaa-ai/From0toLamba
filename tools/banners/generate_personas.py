#!/usr/bin/env python3
"""
Генерация портретов 7 хозяев для фона экрана AmaPage (беседа с дельцом).

Читает personas.json и генерирует через Vertex AI Imagen 4:
  • dark  → output_personas/<slug>.png        — тёмная тема (классическая)
  • light → output_personas/<slug>_LIGHT.png  — Сказочная тема

Формат 9:16, ~1024x1792 в источнике, после compress.py → WebP, целевой размер
~768x1376 (как существующие PNG в tg/server/public/personas/).

Usage:
    python generate_personas.py --project <GCP_PROJECT>                  # обе темы (14 шт)
    python generate_personas.py --project ... --variant dark             # только dark
    python generate_personas.py --project ... --variant light            # только light
    python generate_personas.py --project ... --only buratino            # одного персонажа
    python generate_personas.py --project ... --dry                      # посмотреть промт
    python generate_personas.py --project ... --force                    # перегенерить существующие

После генерации:
  1. python compress.py --inplace output_personas
  2. Скопировать output_personas/*.webp → tg/client/public/personas/
     (имена соответствуют слагу архетипа: buratino.webp, buratino_LIGHT.webp).
     Это исходники — Vite копирует их в билд при npm run build.
  3. Обновить AmaPage.tsx — добавить суффикс _LIGHT для fairy-темы
  4. git add tg/client/public/personas/*.webp + push
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from generate import ROOT, TokenBucket, write_image, already_done

OUTPUT_DIR = ROOT / "output_personas"

MODEL    = "imagen-4.0-generate-001"
LOCATION = "us-central1"
REQUESTS_PER_MINUTE = 10
MAX_RETRIES         = 5
INITIAL_BACKOFF_SEC = 5.0
BACKOFF_MULTIPLIER  = 2.0

# Общий якорь стиля. Применяется к обеим темам.
STYLE_ANCHOR = (
    "Russian fairy tale character portrait, painted realism in the style of "
    "Viktor Vasnetsov and Ivan Bilibin, full bust-up framing from shoulders "
    "to mid-thigh, character occupies central two-thirds of the vertical frame, "
    "environment fills the rest, "
    "NO text NO writing NO captions NO logos NO watermark, "
    "portrait 9:16 composition filling the entire frame edge to edge"
)

# Префикс для dark-варианта — атмосферная свечная/лунная сцена, глубокие тени.
STYLE_PREFIX_DARK = (
    "dramatic dark-toned painting with deep shadows and warm candlelight, "
    "rich amber and crimson accents against velvet darkness, "
    "moody cinematic atmosphere, ancient Slavic medieval interior or twilit exterior, "
)

# Префикс для light-варианта — медово-золотая палитра, дневная радость.
STYLE_PREFIX_LIGHT = (
    "bright joyful daylight painting, warm honey-gold and amber palette with "
    "rich ochre and crimson accents, vivid sunlight and azure blue sky where visible, "
    "NO dark backgrounds, NO night scenes, NO purple, NO violet, NO black sky, "
    "luminous warm light, cinematic but cheerful, ancient Slavic medieval setting at midday, "
)


def load_personas(only: str | None) -> list[dict]:
    data = json.loads((ROOT / "personas.json").read_text(encoding="utf-8"))
    items = data.get("personas", [])
    if only:
        items = [p for p in items if p["key"] == only]
        if not items:
            raise SystemExit(f"ERROR: ключ {only} не найден в personas.json")
    return items


def build_jobs(personas: list[dict], variant: str) -> list[dict]:
    """Раскладывает persona × variant в список job'ов с готовым output-ключом."""
    jobs: list[dict] = []
    variants = ["dark", "light"] if variant == "both" else [variant]
    for p in personas:
        for v in variants:
            desc_key = "dark_desc" if v == "dark" else "light_desc"
            desc = p.get(desc_key)
            if not desc:
                print(f"WARN: у {p['key']} нет {desc_key}", file=sys.stderr)
                continue
            out_key = p["key"] if v == "dark" else f"{p['key']}_LIGHT"
            jobs.append({"key": out_key, "desc": desc, "variant": v})
    return jobs


def build_prompt(desc: str, variant: str) -> str:
    prefix = STYLE_PREFIX_DARK if variant == "dark" else STYLE_PREFIX_LIGHT
    return f"{prefix}{desc}. {STYLE_ANCHOR}"


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
        raise RuntimeError("Vertex AI вернул пустой список.")
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
    parser.add_argument("--variant", choices=["dark", "light", "both"], default="both",
                        help="Какую тему генерить (default: both — 14 шт)")
    parser.add_argument("--only", help="Сгенерить только указанного персонажа (например buratino)")
    parser.add_argument("--dry", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if not args.project:
        print("ERROR: укажи --project your-gcp-project-id", file=sys.stderr)
        return 2

    personas = load_personas(args.only)
    jobs = build_jobs(personas, args.variant)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # monkey-patch OUTPUT_DIR для write_image / already_done
    import generate as _gen
    _gen.OUTPUT_DIR = OUTPUT_DIR

    price = 0.04
    print(f"[personas] {len(jobs)} портретов (variant={args.variant}) · model={args.model} · ≈${len(jobs)*price:.2f}")

    if args.dry:
        for j in jobs:
            print(f"\n--- {j['key']} ({j['variant']})")
            print(build_prompt(j["desc"], j["variant"])[:400])
        return 0

    try:
        from google import genai  # type: ignore
    except ImportError:
        print("ERROR: pip install google-genai", file=sys.stderr)
        return 2

    client = genai.Client(vertexai=True, project=args.project, location=args.location)
    limiter = TokenBucket(rpm=args.rpm)

    todo = [j for j in jobs if not already_done(j["key"]) or args.force]
    print(f"[personas] {len(todo)} to generate, {len(jobs)-len(todo)} already done\n")

    failures = []
    for i, job in enumerate(todo, 1):
        print(f"[{i}/{len(todo)}] {job['key']}  ({job['variant']})")
        prompt = build_prompt(job["desc"], job["variant"])
        backoff = INITIAL_BACKOFF_SEC
        for attempt in range(1, MAX_RETRIES + 1):
            limiter.wait()
            try:
                data, ext = call_vertex(client, args.model, prompt)
                path = write_image(job["key"], data, ext, "image/png")
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
    print("\nNext steps:")
    print(f"  1. python compress.py --inplace output_personas   (PNG → WebP)")
    print(f"  2. cp output_personas/*.webp ../../tg/client/public/personas/")
    print(f"     (исходники для Vite — gitignore'нутый tg/server/public/ это билд)")
    print(f"  3. AmaPage уже подхватывает _LIGHT-суффикс для fairy-темы")
    print(f"  4. git add tg/client/public/personas/*.webp + push")
    return 0


if __name__ == "__main__":
    sys.exit(main())
