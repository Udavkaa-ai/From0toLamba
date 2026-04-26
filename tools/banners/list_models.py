#!/usr/bin/env python3
"""
Диагностика: показывает все модели, доступные твоему ключу через Google AI
Studio. Фильтрует image-capable модели и показывает их описание/версию.

Usage:
    1. Вставь ключ в API_KEY ниже
    2. pip install google-genai (если ещё не стоит)
    3. python list_models.py
"""

API_KEY = ""   # AIzaSy...

import sys


def main() -> int:
    if not API_KEY or not API_KEY.startswith("AIzaSy"):
        print("ERROR: вставь ключ в API_KEY", file=sys.stderr)
        return 2

    try:
        from google import genai  # type: ignore
    except ImportError:
        print("ERROR: pip install google-genai", file=sys.stderr)
        return 2

    client = genai.Client(api_key=API_KEY)
    all_models = list(client.models.list())

    # ── Все модели ────────────────────────────────────────────────────────────
    print(f"\n{'ИМЯ МОДЕЛИ':<55} {'ВЫВОД':<25} ОПИСАНИЕ")
    print("─" * 120)

    image_capable = []

    for m in all_models:
        name = (m.name or "").replace("models/", "")

        out_mod = ""
        for attr in ("output_modalities", "supported_output_modalities"):
            val = getattr(m, attr, None)
            if val:
                out_mod = ", ".join(str(v) for v in val)
                break

        desc = (getattr(m, "description", None) or "").replace("\n", " ")[:80]

        is_image = (
            "image" in name.lower()
            or "imagen" in name.lower()
            or "IMAGE" in out_mod.upper()
        )

        marker = "  ◀◀ IMAGE" if is_image else ""
        if is_image:
            image_capable.append((name, out_mod, desc))

        print(f"{name:<55} {out_mod:<25} {desc}{marker}")

    # ── Только image-capable ──────────────────────────────────────────────────
    print()
    print("=" * 80)
    if image_capable:
        print(f"IMAGE-CAPABLE МОДЕЛИ ({len(image_capable)} шт.):\n")
        for name, out_mod, desc in image_capable:
            print(f"  Имя:    {name}")
            print(f"  Вывод:  {out_mod}")
            if desc:
                print(f"  Описание: {desc}")
            print()
    else:
        print("Ни одной image-capable модели не найдено.")
        print("Проверь https://aistudio.google.com/app/apikey — Plan: Free vs Paid.")

    return 0


if __name__ == "__main__":
    code = main()
    input("\nНажми Enter чтобы закрыть...")
    sys.exit(code)
