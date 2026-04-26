#!/usr/bin/env python3
"""
Generate banner images via Google Cloud Vertex AI — Imagen 3 Fast.

Зачем: $300 Google Cloud welcome credits покрывают ~15 000 изображений
(Imagen 3 Fast ≈ $0.02/шт), тогда как AI Studio обходится в $0.04–0.06/шт.

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
       gcloud auth application-default login

5. Установи зависимости:
       pip install google-cloud-aiplatform pillow

6. Запомни свой Project ID (не название, именно ID):
       https://console.cloud.google.com/ — вверху страницы
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage:
    python generate_vertex.py --project my-gcp-project-id
    python generate_vertex.py --project my-gcp-project-id --test
    python generate_vertex.py --project my-gcp-project-id --only BABA_YAGA
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

# Общие утилиты из generate.py — не дублируем код
sys.path.insert(0, str(Path(__file__).parent))
from generate import (
    ROOT, OUTPUT_DIR, DEFAULT_STYLE, DEAL_TYPES, ARCHETYPES, VARIANTS_PER_PAIR,
    load_json, parse_style_anchor, Job, build_jobs,
    TokenBucket, autocrop, write_image, already_done,
)

# --- Config -----------------------------------------------------------------

# Imagen 3 Fast — самая дешёвая image-модель Vertex AI (~$0.02/шт)
# Imagen 3 (без fast) — лучше качеством, но ~$0.04/шт
MODEL = "imagen-3.0-fast-generate-001"
LOCATION = "us-central1"   # ближайший регион с Imagen

# Imagen 3 Fast: до 600 QPM на Tier 1; берём 10 RPM — запас и экономия
REQUESTS_PER_MINUTE = 10
MAX_RETRIES = 5
INITIAL_BACKOFF_SEC = 5.0
BACKOFF_MULTIPLIER = 2.0

# Три архетипа для --test прогона
_TEST_ARCHETYPES = ["BABA_YAGA", "IVAN_DURAK", "KOLOBOK"]
_TEST_DEAL = "POTION_BREW"


# --- Vertex AI call ---------------------------------------------------------

def call_vertex(model, prompt: str) -> tuple[bytes, str]:
    """
    Генерирует одно изображение через Vertex AI Imagen.
    Возвращает (image_bytes, file_extension).
    """
    response = model.generate_images(
        prompt=prompt,
        number_of_images=1,
        aspect_ratio="16:9",
        safety_filter_level="block_few",
        person_generation="allow_adult",
    )

    if not response.images:
        raise RuntimeError("Vertex AI вернул пустой список изображений")

    img = response.images[0]

    # Пробуем получить байты напрямую (внутреннее поле SDK)
    raw = getattr(img, "_image_bytes", None)
    if raw:
        return raw, ".png"

    # Fallback через PIL (всегда доступен, если установлен pillow)
    pil_img = getattr(img, "_pil_image", None)
    if pil_img is not None:
        buf = io.BytesIO()
        pil_img.save(buf, format="PNG")
        return buf.getvalue(), ".png"

    raise RuntimeError(
        "Не удалось извлечь байты из ответа Vertex AI. "
        "Попробуй обновить google-cloud-aiplatform: pip install -U google-cloud-aiplatform"
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
        help="Google Cloud Project ID (или переменная GOOGLE_CLOUD_PROJECT)",
    )
    parser.add_argument(
        "--location", default=LOCATION,
        help=f"GCP регион (default: {LOCATION})",
    )
    parser.add_argument(
        "--model", default=MODEL,
        help=f"Vertex AI модель (default: {MODEL}). "
             "Альтернатива: imagen-3.0-generate-001 ($0.04/шт, лучше качество)",
    )
    parser.add_argument("--style", default=DEFAULT_STYLE)
    parser.add_argument("--only", dest="only_archetype",
                        help="только один архетип (напр. BABA_YAGA)")
    parser.add_argument("--only-deal", dest="only_deal",
                        help="только один тип дела (напр. POTION_BREW)")
    parser.add_argument("--rpm", type=int, default=REQUESTS_PER_MINUTE,
                        help=f"запросов в минуту (default: {REQUESTS_PER_MINUTE})")
    parser.add_argument("--limit", type=int, default=None,
                        help="остановиться после N картинок")
    parser.add_argument(
        "--test", action="store_true",
        help="сгенерировать 3 тестовых баннера (BABA_YAGA/IVAN_DURAK/KOLOBOK × POTION_BREW)",
    )
    parser.add_argument("--dry", action="store_true",
                        help="показать промпты без вызова API")
    parser.add_argument("--force", action="store_true",
                        help="перегенерировать уже существующие файлы")
    args = parser.parse_args()

    if not args.project:
        print(
            "ERROR: укажи --project your-gcp-project-id\n"
            "       или установи переменную окружения GOOGLE_CLOUD_PROJECT\n"
            "       Project ID найдёшь на https://console.cloud.google.com/",
            file=sys.stderr,
        )
        return 2

    characters = load_json(ROOT / "characters.json")
    deals = load_json(ROOT / "deals.json")
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
                jobs.append(batch[0])   # по одной картинке на архетип
    else:
        jobs = build_jobs(
            characters=characters, deals=deals, style_block=style_block,
            only_archetype=args.only_archetype, only_deal=args.only_deal,
        )

    cost_est = len(jobs) * 0.02
    print(f"[plan] {len(jobs)} jobs · style={args.style} · model={args.model}")
    print(f"       project={args.project} · location={args.location}")
    print(f"       ≈${cost_est:.2f} при $0.02/шт (Imagen 3 Fast)")

    if args.dry:
        for j in jobs:
            print(f"\n--- {j.filename_stem}")
            print(j.prompt)
        return 0

    # Инициализация Vertex AI
    try:
        import vertexai
        from vertexai.vision_models import ImageGenerationModel
    except ImportError:
        print("ERROR: pip install google-cloud-aiplatform", file=sys.stderr)
        return 2

    try:
        vertexai.init(project=args.project, location=args.location)
        model = ImageGenerationModel.from_pretrained(args.model)
    except Exception as e:
        print(f"ERROR: не удалось инициализировать Vertex AI: {e}", file=sys.stderr)
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
        print(f"[limit] capped to first {args.limit}")

    print(f"[plan] {len(todo)} to generate, {len(jobs) - len(todo)} already done\n")

    failures: list[tuple[Job, str]] = []
    for i, job in enumerate(todo, 1):
        print(f"[{i}/{len(todo)}] {job.filename_stem}")
        backoff = INITIAL_BACKOFF_SEC
        for attempt in range(1, MAX_RETRIES + 1):
            limiter.wait()
            try:
                data, ext = call_vertex(model, job.prompt)
                mime = "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png"
                path = write_image(job.filename_stem, data, ext, mime)
                print(f"  ✓ {path.name} ({len(data)//1024} KB)")
                break
            except Exception as err:   # noqa: BLE001
                msg = str(err)
                jitter = random.uniform(0, 0.5) * backoff
                wait = backoff + jitter
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
            f"\n[done] {len(todo) - len(failures)}/{len(todo)} ok, "
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
