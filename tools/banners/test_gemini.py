#!/usr/bin/env python3
"""
Smoke test для gemini-3.1-flash-image-preview.

Перед запуском:
1. Вставь свой ключ в API_KEY ниже (между кавычек)
2. pip install google-genai
3. python3 test_gemini.py

Создаст 3 пробных баннера в tools/banners/output/test_*.png
"""

# ─── ВСТАВЬ КЛЮЧ СЮДА ────────────────────────────────────────────
# ⚠️  НЕ КОММИТЬ КЛЮЧ В GIT.
# Перед запуском: API_KEY = "AIzaSy..."
# После теста: API_KEY = ""  (или сделай git update-index --skip-worktree
# tools/banners/test_gemini.py чтобы git перестал замечать изменения).
API_KEY = ""
# ─────────────────────────────────────────────────────────────────


from pathlib import Path
import sys

OUTPUT_DIR = Path(__file__).resolve().parent / "output"
MODEL = "gemini-3.1-flash-image-preview"

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


def main() -> int:
    if not API_KEY or API_KEY.startswith("AIzaSy") is False:
        print("ERROR: вставь свой ключ в API_KEY в начале файла", file=sys.stderr)
        return 2

    try:
        from google import genai  # type: ignore
    except ImportError:
        print("ERROR: pip install google-genai", file=sys.stderr)
        return 2

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    client = genai.Client(api_key=API_KEY)

    for i, (stem, prompt) in enumerate(TEST_PROMPTS, 1):
        print(f"[{i}/{len(TEST_PROMPTS)}] {stem}")
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt,
            )
        except Exception as err:  # noqa: BLE001
            print(f"  ✗ API error: {err}", file=sys.stderr)
            continue

        saved = False
        for cand in (response.candidates or []):
            content = getattr(cand, "content", None)
            if not content:
                continue
            for part in (content.parts or []):
                inline = getattr(part, "inline_data", None)
                if inline and getattr(inline, "data", None):
                    mime = inline.mime_type or "image/png"
                    ext = ".png" if "png" in mime else (".jpg" if "jpeg" in mime else ".bin")
                    out = OUTPUT_DIR / f"{stem}{ext}"
                    out.write_bytes(inline.data)
                    print(f"  ✓ {out} ({len(inline.data)//1024} KB)")
                    saved = True
                    break
            if saved:
                break

        if not saved:
            text = getattr(response, "text", None) or "<no text>"
            print(f"  ✗ no image in response. text={text[:300]}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
