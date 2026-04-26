#!/usr/bin/env python3
"""
Generate banner images via Google Cloud Vertex AI — Imagen 4 Fast.

Зачем: $300 Google Cloud welcome credits покрывают ~15 000 изображений
(Imagen 4 Fast ≈ $0.02/шт), тогда как AI Studio обходится в $0.04–0.06/шт.

Использует тот же google-genai SDK что и generate.py — отдельный
google-cloud-aiplatform не нужен. Отличие только в инициализации клиента.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
НАСТРОЙКА (один раз):

1. Создай / открой Google Cloud проект:
       https://console.cloud.google.com/

2. Включи Vertex AI API:
       https://console.cloud.google.com/apis/library/aiplatform.googleapis.com

3. Привяжи биллинг к проекту (активирует $300 кредиты):
       https://console.cloud.google.com/billing

4. Установи gcloud CLI и залогинься:
       https://cloud.google.com/sdk/docs/install
       winget install Google.CloudSDK   ← Windows
       gcloud init
       gcloud auth application-default login

5. Зависимости (google-cloud-aiplatform НЕ нужен):
       pip install google-genai pillow

6. Запомни Project ID — на https://console.cloud.google.com/ вверху страницы
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage:
    python generate_vertex.py --project my-gcp-project-id
    python generate_vertex.py --project my-gcp-project-id --test
    python generate_vertex.py --project my-gcp-project-id --only BABA_YAGA
    python generate_vertex.py --project my-gcp-project-id --variants 10
    python generate_vertex.py --project my-gcp-project-id --dry

Или через переменную окружения:
    set GOOGLE_CLOUD_PROJECT=my-gcp-project-id
    python generate_vertex.py
"""

from __future__ import annotations

import argparse
import io
import os
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from generate import (
    ROOT, OUTPUT_DIR, DEFAULT_STYLE,
    load_json, parse_style_anchor, Job, build_jobs,
    TokenBucket, autocrop, write_image, already_done,
    DEAL_TYPES, ARCHETYPES,
)

# --- Config -----------------------------------------------------------------

MODEL    = "imagen-4.0-fast-generate-001"   # $0.02/шт — самая дешёвая
LOCATION = "us-central1"

# Доступные модели (от дешёвой к дорогой):
#   imagen-4.0-fast-generate-001   ~$0.02/шт  ← default
#   imagen-4.0-generate-001        ~$0.04/шт
#   imagen-4.0-ultra-generate-001  ~$0.08/шт

REQUESTS_PER_MINUTE = 10   # Imagen 4: до 600 QPM на Tier 1; 10 — с запасом
MAX_RETRIES         = 5
INITIAL_BACKOFF_SEC = 5.0
BACKOFF_MULTIPLIER  = 2.0

_TEST_ARCHETYPES = ["BABA_YAGA", "IVAN_DURAK", "KOLOBOK"]
_TEST_DEAL       = "POTION_BREW"


# --- Vertex AI call (google-genai SDK, vertexai=True) -----------------------

def call_vertex(client, model: str, prompt: str) -> tuple[bytes, str]:
    """
    Imagen через google-genai SDK с Vertex AI backend.
    Не требует google-cloud-aiplatform — только google-genai.
    """
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
        raise RuntimeError(
            f"Vertex AI вернул пустой список. "
            f"prompt_feedback={getattr(response, 'prompt_feedback', None)}"
        )

    img_obj = images[0]
    raw = getattr(getattr(img_obj, "image", None), "image_bytes", None)
    if raw:
        return raw, ".png"
    raw = getattr(img_obj, "_image_bytes", None)
    if raw:
        return raw, ".png"

    raise RuntimeError(
        "Не удалось извлечь байты. pip install -U google-genai"
    )


# --- Main -------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--project",
        default=os.environ.get("GOOGLE_CLOUD_PROJECT", ""),
        help="Google Cloud Project ID (или GOOGLE_CLOUD_PROJECT)",
    )
    parser.add_argument("--location", default=LOCATION,
                        help=f"GCP регион (default: {LOCATION})")
    parser.add_argument(
        "--model", default=MODEL,
        help=f"Vertex AI модель (default: {MODEL})",
    )
    parser.add_argument("--style", default=DEFAULT_STYLE)
    parser.add_argument("--only", dest="only_archetype")
    parser.add_argument("--only-deal", dest="only_deal")
    parser.add_argument("--variants", type=int, default=3,
                        help="вариантов на пару архетип×дело (default: 3, max: сколько угодно)")
    parser.add_argument("--rpm", type=int, default=REQUESTS_PER_MINUTE)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--test", action="store_true",
                        help="3 тестовых картинки (BABA_YAGA/IVAN_DURAK/KOLOBOK × POTION_BREW)")
    parser.add_argument("--dry", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if not args.project:
        print(
            "ERROR: укажи --project your-gcp-project-id\n"
            "       или установи GOOGLE_CLOUD_PROJECT\n"
            "       Project ID: https://console.cloud.google.com/",
            file=sys.stderr,
        )
        return 2

    characters = load_json(ROOT / "characters.json")
    deals      = load_json(ROOT / "deals.json")
    style_text = (ROOT / "style_anchor.txt").read_text(encoding="utf-8")
    style_block = parse_style_anchor(style_text, args.style)

    if args.test:
        jobs = []
        for arch in _TEST_ARCHETYPES:
            batch = build_jobs(
                characters=characters, deals=deals, style_block=style_block,
                only_archetype=arch, only_deal=_TEST_DEAL,
            )
            if batch:
                jobs.append(batch[0])
    else:
        # build_jobs использует VARIANTS_PER_PAIR из generate.py (=3).
        # --variants позволяет задать больше: генерируем несколько раз с суффиксом.
        base_jobs = build_jobs(
            characters=characters, deals=deals, style_block=style_block,
            only_archetype=args.only_archetype, only_deal=args.only_deal,
        )
        if args.variants <= 3:
            jobs = base_jobs
        else:
            # Расширяем: для каждой пары архетип×дело генерируем args.variants штук
            jobs = []
            for arch in (ARCHETYPES if not args.only_archetype else [args.only_archetype]):
                for deal in (DEAL_TYPES if not args.only_deal else [args.only_deal]):
                    base = [j for j in base_jobs if j.archetype == arch and j.deal == deal]
                    if not base:
                        continue
                    for v in range(1, args.variants + 1):
                        template = base[(v - 1) % len(base)]
                        jobs.append(Job(
                            archetype=arch, deal=deal, variant=v,
                            character_desc=template.character_desc,
                            deal_desc=template.deal_desc,
                            style_block=template.style_block,
                        ))

    price = 0.02 if "fast" in args.model else (0.08 if "ultra" in args.model else 0.04)
    print(f"[plan] {len(jobs)} jobs · style={args.style} · model={args.model}")
    print(f"       project={args.project} · location={args.location}")
    print(f"       ≈${len(jobs)*price:.2f} при ${price:.2f}/шт из $300 кредитов")

    if args.dry:
        for j in jobs:
            print(f"\n--- {j.filename_stem}")
            print(j.prompt[:300])
        return 0

    try:
        from google import genai  # type: ignore
    except ImportError:
        print("ERROR: pip install google-genai", file=sys.stderr)
        return 2

    try:
        client = genai.Client(
            vertexai=True,
            project=args.project,
            location=args.location,
        )
    except Exception as e:
        print(f"ERROR: не удалось создать Vertex AI клиент: {e}", file=sys.stderr)
        print("  Убедись что выполнил: gcloud auth application-default login", file=sys.stderr)
        return 2

    limiter = TokenBucket(rpm=args.rpm)

    todo = []
    for j in jobs:
        existing = already_done(j.filename_stem)
        if existing and not args.force:
            print(f"[skip] {j.filename_stem} (exists: {existing.name})")
            continue
        todo.append(j)

    if args.limit is not None:
        todo = todo[:args.limit]

    print(f"[plan] {len(todo)} to generate, {len(jobs) - len(todo)} already done\n")

    failures: list[tuple[Job, str]] = []
    for i, job in enumerate(todo, 1):
        print(f"[{i}/{len(todo)}] {job.filename_stem}")
        backoff = INITIAL_BACKOFF_SEC
        for attempt in range(1, MAX_RETRIES + 1):
            limiter.wait()
            try:
                data, ext = call_vertex(client, args.model, job.prompt)
                mime = "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png"
                path = write_image(job.filename_stem, data, ext, mime)
                print(f"  ✓ {path.name} ({len(data)//1024} KB)")
                break
            except Exception as err:  # noqa: BLE001
                msg = str(err)
                jitter = random.uniform(0, 0.5) * backoff
                wait   = backoff + jitter
                print(
                    f"  attempt {attempt}/{MAX_RETRIES} failed: {msg[:160]}"
                    f"  → sleep {wait:.1f}s",
                    file=sys.stderr,
                )
                if attempt == MAX_RETRIES:
                    failures.append((job, msg))
                    break
                time.sleep(wait)
                backoff *= BACKOFF_MULTIPLIER

    if failures:
        print(
            f"\n[done] {len(todo)-len(failures)}/{len(todo)} ok, "
            f"{len(failures)} failed:",
            file=sys.stderr,
        )
        for job, msg in failures:
            print(f"  - {job.filename_stem}: {msg[:200]}", file=sys.stderr)
        return 1

    print(f"\n[done] {len(todo)}/{len(todo)} generated → {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
