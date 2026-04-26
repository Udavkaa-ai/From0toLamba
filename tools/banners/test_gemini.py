#!/usr/bin/env python3
"""
Smoke test для Gemini image-моделей.

Перед запуском:
1. Вставь свой ключ в API_KEY ниже (между кавычек)
2. pip install google-genai
3. python test_gemini.py

Создаст пробные баннеры в tools/banners/output/*_test.png
Если первая модель не работает — скрипт сам попробует следующую из MODEL_FALLBACKS.
"""

# ─── ВСТАВЬ КЛЮЧ СЮДА ────────────────────────────────────────────
# ⚠️  НЕ КОММИТЬ КЛЮЧ В GIT.
# Перед запуском: API_KEY = "AIzaSy..."
# После теста: API_KEY = ""  (или сделай git update-index --skip-worktree
# tools/banners/test_gemini.py чтобы git перестал замечать изменения).
API_KEY = ""
# ─────────────────────────────────────────────────────────────────


import argparse
import time
from pathlib import Path
import sys
import traceback

OUTPUT_DIR = Path(__file__).resolve().parent / "output"

# Бесплатный тир image-моделей: обычно 2 RPM.
# Если у тебя Pay-as-you-go — ставь --rpm 10 или выше.
DEFAULT_RPM = 2

# Перебираем модели в этом порядке. Первая работающая — побеждает.
# Если у тебя есть конкретное имя — поставь его первым.
MODEL_FALLBACKS = [
    "gemini-2.5-flash-image",          # GA, самый надёжный
    "gemini-3.1-flash-image-preview",  # preview — иногда нужен opt-in
    "gemini-3-pro-image-preview",      # дорогой ($0.134/шт) — последний шанс
]

# Три тестовых промпта — три разных архетипа × дела × композиции,
# в одном (билибинском) стиле. Если эти три выглядят прилично,
# полный прогон 90 штук точно взлетит.
TEST_PROMPTS = [
    (
        "BABA_YAGA_POTION_BREW_test",
        "illustration in the style of Ivan Bilibin, classic Russian fairy tale book art, "
        "art-nouveau decorative composition, ornamental floral border, flat saturated jewel-tone colour, "
        "strong black ink outlines, traditional Slavic folk patterns, gold leaf accents. "
        "An ancient hunchbacked crone with long crooked nose and wild grey hair under a black headscarf with skull pattern, "
        "tattered dark sarafan, holding a bony pestle, eyes glowing pale yellow. "
        "Leaning over a bubbling copper cauldron in a smoky log izba, jars of strange roots and dried mushrooms on shelves, "
        "green steam curling up, dried herbs hanging from low ceiling beams. "
        "Russian fairy tale fantasy, dark mystical atmosphere, fairy gold and enchanted purple and night blue dominant palette, "
        "cinematic horizontal banner composition 7:4, character clearly framed as the focal point, "
        "no text, no letters, no captions, no signatures, no watermarks."
    ),
    (
        "IVAN_DURAK_TREASURE_HUNT_test",
        "illustration in the style of Ivan Bilibin, classic Russian fairy tale book art, "
        "art-nouveau decorative composition, ornamental floral border, flat saturated jewel-tone colour, "
        "strong black ink outlines, traditional Slavic folk patterns, gold leaf accents. "
        "A young flaxen-haired peasant lad with a slight foolish grin, in white linen rubakha embroidered with red cross-stitch, "
        "kushak belt, bast-shoe lapti. Kneeling beside a half-buried oak chest in a moonlit pine forest, "
        "lid cracked open spilling silver coins and pearl strings, a shovel stuck in dark earth, "
        "will-o'-the-wisp lights drifting between trees. "
        "Russian fairy tale fantasy, dark mystical atmosphere, fairy gold and enchanted purple and night blue dominant palette, "
        "cinematic horizontal banner composition 7:4, character clearly framed as the focal point, "
        "no text, no letters, no captions, no signatures, no watermarks."
    ),
    (
        "KOLOBOK_HONEST_TRADE_test",
        "illustration in the style of Ivan Bilibin, classic Russian fairy tale book art, "
        "art-nouveau decorative composition, ornamental floral border, flat saturated jewel-tone colour, "
        "strong black ink outlines, traditional Slavic folk patterns, gold leaf accents. "
        "A round golden-baked bread roll character with smooth crust, two cheerful black-bead eyes and a wide cracked-crust grin, "
        "small flour-dusted limbs. Behind a sturdy wooden market stall hung with strings of dried fish and bunches of onions, "
        "weighing goods on a brass scale, customers in homespun coats waiting, a shaggy horse and cart in the background. "
        "Russian fairy tale fantasy, dark mystical atmosphere, fairy gold and enchanted purple and night blue dominant palette, "
        "cinematic horizontal banner composition 7:4, character clearly framed as the focal point, "
        "no text, no letters, no captions, no signatures, no watermarks."
    ),
]


def try_generate(client, types_module, model: str, prompt: str):
    """
    Пробует сгенерировать картинку. Возвращает (image_bytes, mime_type) или
    кидает исключение с понятным текстом.
    """
    config = types_module.GenerateContentConfig(
        response_modalities=["IMAGE"],
    )
    try:
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=config,
        )
    except Exception:
        # Некоторые SDK-версии требуют ["IMAGE", "TEXT"]; пробуем мягкий вариант
        config = types_module.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        )
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=config,
        )

    parts_dump = []
    for cand in (response.candidates or []):
        content = getattr(cand, "content", None)
        if not content:
            continue
        for part in (content.parts or []):
            inline = getattr(part, "inline_data", None)
            if inline and getattr(inline, "data", None):
                return inline.data, inline.mime_type or "image/png"
            text = getattr(part, "text", None)
            if text:
                parts_dump.append(f"text: {text[:200]}")

    finish = None
    if response.candidates:
        finish = getattr(response.candidates[0], "finish_reason", None)
    raise RuntimeError(
        f"no inline image. finish_reason={finish}. "
        f"parts={parts_dump or '<empty>'}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke test Gemini image models")
    parser.add_argument(
        "--rpm", type=int, default=DEFAULT_RPM,
        help=f"max requests per minute (default: {DEFAULT_RPM} — free tier limit)",
    )
    args = parser.parse_args()

    interval = 60.0 / max(1, args.rpm)

    def pace(label: str = "") -> None:
        msg = f"  ⏳ пауза {interval:.0f}с (RPM={args.rpm})"
        if label:
            msg += f" — {label}"
        print(msg)
        time.sleep(interval)

    if not API_KEY or not API_KEY.startswith("AIzaSy"):
        print("ERROR: вставь свой ключ в API_KEY в начале файла", file=sys.stderr)
        return 2

    try:
        from google import genai  # type: ignore
        from google.genai import types  # type: ignore
    except ImportError:
        print("ERROR: pip install google-genai", file=sys.stderr)
        return 2

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    client = genai.Client(api_key=API_KEY)

    # Шаг 0: выясняем какая модель работает (одним пробным запросом).
    working_model = None
    print(f"[probe] ищем рабочую модель… (RPM={args.rpm}, пауза ~{interval:.0f}с между запросами)")
    probe_prompt = "a tiny test painting of a red apple, simple, no text"
    for idx, model in enumerate(MODEL_FALLBACKS):
        if idx > 0:
            pace(f"перед пробой {model}")
        try:
            data, _mime = try_generate(client, types, model, probe_prompt)
            print(f"  ✓ {model} работает ({len(data)//1024} KB на пробном запросе)")
            working_model = model
            (OUTPUT_DIR / f"_probe_{model.replace('/', '_')}.png").write_bytes(data)
            break
        except Exception as err:  # noqa: BLE001
            print(f"  ✗ {model}: {str(err)[:200]}")

    if working_model is None:
        print("\n[fail] ни одна из моделей не отдала картинку.", file=sys.stderr)
        print("Проверь что:", file=sys.stderr)
        print("  - ключ от Google AI Studio (а не Vertex AI)", file=sys.stderr)
        print("  - в твоём регионе/проекте включена Gemini API", file=sys.stderr)
        print("  - аккаунт принял условия использования image-генерации", file=sys.stderr)
        return 1

    print(f"\n[run] генерируем {len(TEST_PROMPTS)} пробных баннера моделью {working_model}\n")
    ok = 0
    for i, (stem, prompt) in enumerate(TEST_PROMPTS, 1):
        pace(f"перед {stem}")
        print(f"[{i}/{len(TEST_PROMPTS)}] {stem}")
        try:
            data, mime = try_generate(client, types, working_model, prompt)
            ext = ".png" if "png" in mime else (".jpg" if "jpeg" in mime else ".bin")
            out = OUTPUT_DIR / f"{stem}{ext}"
            out.write_bytes(data)
            print(f"  ✓ {out} ({len(data)//1024} KB)")
            ok += 1
        except Exception as err:  # noqa: BLE001
            print(f"  ✗ {err}", file=sys.stderr)
            traceback.print_exc()

    print(f"\n[done] {ok}/{len(TEST_PROMPTS)} ok → {OUTPUT_DIR}")
    return 0 if ok == len(TEST_PROMPTS) else 1


if __name__ == "__main__":
    sys.exit(main())
