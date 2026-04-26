#!/usr/bin/env python3
"""
Диагностика: показывает все модели, доступные твоему ключу через Google AI
Studio, и какие из них умеют генерить картинки (response_modalities=IMAGE
или supported_actions содержит 'generateContent').

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

    print(f"{'name':<55} {'actions':<30} {'in/out modalities'}")
    print("─" * 110)

    image_capable = []
    for m in client.models.list():
        name = m.name or ""
        actions = ", ".join(m.supported_actions or [])
        in_mod = ", ".join(m.input_token_limit and ["text"] or [])  # placeholder
        # Достаём modalities из любого из доступных полей
        in_mod = ""
        out_mod = ""
        for attr in ("input_modalities", "supported_input_modalities"):
            val = getattr(m, attr, None)
            if val:
                in_mod = ", ".join(str(v) for v in val)
                break
        for attr in ("output_modalities", "supported_output_modalities"):
            val = getattr(m, attr, None)
            if val:
                out_mod = ", ".join(str(v) for v in val)
                break

        modalities = f"in:[{in_mod}] out:[{out_mod}]"

        # Помечаем кандидатов на image-генерацию
        marker = ""
        name_lc = name.lower()
        if "image" in name_lc or "imagen" in name_lc or "IMAGE" in (out_mod or "").upper():
            marker = "  ◀ image"
            image_capable.append(name)

        # Урезаем для влезания в строку
        short_name = name.replace("models/", "")
        print(f"{short_name:<55} {actions:<30} {modalities}{marker}")

    print()
    if image_capable:
        print(f"[image-capable] {len(image_capable)} модель(и):")
        for n in image_capable:
            print(f"  - {n}")
    else:
        print("[image-capable] ничего похожего на image-модель не нашлось.")
        print("  Возможно, image-генерация не включена в твоём тарифе/регионе.")
        print("  Проверь https://aistudio.google.com/app/apikey — Plan: Free vs Paid.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
