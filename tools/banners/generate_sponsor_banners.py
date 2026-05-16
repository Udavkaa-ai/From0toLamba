#!/usr/bin/env python3
"""
Генерация баннеров для VIP / спонсорских дел через Vertex AI Imagen 4.

По одному баннеру на каждого партнёрского канала из channelTasksConfig.ts.
Формат 16:9 (как у обычных дел). Имена файлов: SPONSOR_<CHANNEL_KEY>.webp.
Кладутся прямо в output_realistic/ рядом с обычными баннерами — Dockerfile
их подхватит без правок.

После генерации админ при создании кампании `/sponsor add` указывает:
    "bannerImageUrl": "/banners/SPONSOR_SSIGNET_RING.webp"
(или какое имя соответствует каналу). Если bannerImageUrl=null — клиент
использует фолбэк SPONSOR_VIP_01.webp.

Usage:
    python generate_sponsor_banners.py --project <GCP_PROJECT>
    python generate_sponsor_banners.py --project ... --dry
    python generate_sponsor_banners.py --project ... --force
    python generate_sponsor_banners.py --project ... --only SPONSOR_SSIGNET_RING
"""

from __future__ import annotations

import argparse
import os
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from generate import ROOT, TokenBucket, write_image, already_done

OUTPUT_DIR = ROOT / "output_realistic"

MODEL    = "imagen-4.0-generate-001"   # обычный (не fast) — баннер должен быть приятным
LOCATION = "us-central1"
REQUESTS_PER_MINUTE = 10
MAX_RETRIES         = 5
INITIAL_BACKOFF_SEC = 5.0
BACKOFF_MULTIPLIER  = 2.0

# Стилевой префикс — теплый русско-сказочный «премиум»: формат 16:9, без людей-
# крупных-планов (хозяин виден как фигура, но банер — это сцена дела), без
# текста на изображении, без мультяшности.
STYLE_PREFIX = (
    "rich Russian fairy tale merchant scene, oil painting style with warm honey-gold "
    "and amber palette, cinematic depth and atmospheric lighting, ornate Slavic medieval "
    "interior details, painted wooden architecture with carved trim, dramatic but inviting, "
    "NO text NO writing NO captions NO logos NO watermark NO modern objects, "
    "wide cinematic 16:9 composition filling the entire frame edge to edge"
)


def load_jobs() -> list[dict]:
    import json
    data = json.loads((ROOT / "sponsor_banners.json").read_text(encoding="utf-8"))
    return [{"key": item["key"], "desc": item["desc"]} for item in data.get("channels", [])]


def build_prompt(desc: str) -> str:
    return f"{STYLE_PREFIX}, {desc}"


def call_vertex(client, model: str, prompt: str) -> tuple[bytes, str]:
    from google.genai import types  # type: ignore
    response = client.models.generate_images(
        model=model,
        prompt=prompt,
        config=types.GenerateImagesConfig(
            number_of_images=1,
            aspect_ratio="16:9",
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
    parser.add_argument("--dry", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--only", help="Сгенерить только указанный ключ (например SPONSOR_SSIGNET_RING)")
    args = parser.parse_args()

    if not args.project:
        print("ERROR: укажи --project your-gcp-project-id", file=sys.stderr)
        return 2

    jobs = load_jobs()
    if args.only:
        jobs = [j for j in jobs if j["key"] == args.only]
        if not jobs:
            print(f"ERROR: ключ {args.only} не найден в sponsor_banners.json", file=sys.stderr)
            return 2

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    import generate as _gen
    _gen.OUTPUT_DIR = OUTPUT_DIR

    price = 0.04
    print(f"[sponsor-banners] {len(jobs)} баннеров · model={args.model} · ≈${len(jobs)*price:.2f}")

    if args.dry:
        for j in jobs:
            print(f"\n--- {j['key']}")
            print(build_prompt(j["desc"])[:320])
        return 0

    try:
        from google import genai  # type: ignore
    except ImportError:
        print("ERROR: pip install google-genai", file=sys.stderr)
        return 2

    client = genai.Client(vertexai=True, project=args.project, location=args.location)
    limiter = TokenBucket(rpm=args.rpm)

    todo = [j for j in jobs if not already_done(j["key"]) or args.force]
    print(f"[sponsor-banners] {len(todo)} to generate, {len(jobs)-len(todo)} already done\n")

    failures = []
    for i, job in enumerate(todo, 1):
        print(f"[{i}/{len(todo)}] {job['key']}")
        prompt = build_prompt(job["desc"])
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
    print(f"  1. python compress.py --inplace output_realistic   (PNG → WebP)")
    print(f"  2. git add tools/banners/output_realistic/SPONSOR_*.webp")
    print(f"  3. git commit + push, дождись Railway deploy")
    print(f"  4. В боте: /sponsor add — указывай bannerImageUrl: \"/banners/SPONSOR_KEY.webp\"")
    return 0


if __name__ == "__main__":
    sys.exit(main())
