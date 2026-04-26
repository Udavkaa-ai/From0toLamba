#!/usr/bin/env python3
"""
Generate 90 banner images (6 archetypes × 5 deal types × 3 variants) via
Google AI Studio's gemini-3.1-flash-image-preview.

Reads characters.json + deals.json + style_anchor.txt; writes to
output/{ARCHETYPE}_{DEAL}_{NN}.{ext}.

Usage:
    pip install google-genai pillow
    export GEMINI_API_KEY=...
    python generate.py                    # generate everything missing
    python generate.py --style vasnetsov  # use a different style block
    python generate.py --only BABA_YAGA   # one archetype only
    python generate.py --dry              # print prompts, don't call API
"""

from __future__ import annotations

import argparse
import io
import json
import mimetypes
import os
import random
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path

# --- Config -----------------------------------------------------------------

ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / "output"

MODEL = "gemini-2.5-flash-image"
DEFAULT_STYLE = "bilibin"

# Free tier of gemini-3.1-flash-image-preview is ~10 RPM at the time of
# writing. Stay under it with a steady pace; the limiter also smooths bursts.
# Adjust REQUESTS_PER_MINUTE if your key has a higher quota.
REQUESTS_PER_MINUTE = 8
MAX_RETRIES = 5
INITIAL_BACKOFF_SEC = 4.0
BACKOFF_MULTIPLIER = 2.0

# Deal types — must match the order/strings of the server enum.
DEAL_TYPES = [
    "TREASURE_HUNT",
    "POTION_BREW",
    "CARD_GAME",
    "GUILD_SCHEME",
    "HONEST_TRADE",
]

# Archetypes — must match the server enum.
ARCHETYPES = [
    "IVAN_DURAK",
    "BABA_YAGA",
    "ZOLUSHKA",
    "KOSCHEI",
    "TSAR_GOROKH",
    "KOLOBOK",
]

VARIANTS_PER_PAIR = 3   # NN = 01..03


# --- Prompt assembly --------------------------------------------------------

def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def parse_style_anchor(text: str, key: str) -> str:
    """
    style_anchor.txt has named blocks like:
        [bilibin]
        ...lines...
        [shared suffix ...]
        ...lines...

    Returns: <chosen block>\n<shared suffix block>
    Raises: ValueError if the block can't be found.
    """
    blocks: dict[str, str] = {}
    current_key: str | None = None
    buf: list[str] = []
    for raw in text.splitlines():
        m = re.match(r"^\[([^\]]+)\]\s*$", raw.strip())
        if m:
            if current_key is not None:
                blocks[current_key] = "\n".join(buf).strip()
            current_key = m.group(1).strip().lower()
            buf = []
        elif current_key is not None:
            buf.append(raw)
    if current_key is not None:
        blocks[current_key] = "\n".join(buf).strip()

    # Find the shared suffix — its key starts with "shared suffix"
    suffix_key = next((k for k in blocks if k.startswith("shared suffix")), None)
    if suffix_key is None:
        raise ValueError("style_anchor.txt: missing [shared suffix ...] block")

    style_text = blocks.get(key.lower())
    if not style_text:
        raise ValueError(
            f"style_anchor.txt: no [{key}] block. "
            f"Available: {[k for k in blocks if k != suffix_key]}"
        )

    # The shared suffix appears once after each style block; the parser above
    # captures only the FIRST occurrence (subsequent ones overwrite an
    # already-captured key, which is fine — content is identical). Use it.
    return f"{style_text}\n{blocks[suffix_key]}"


@dataclass
class Job:
    archetype: str
    deal: str
    variant: int                # 1..VARIANTS_PER_PAIR
    character_desc: str
    deal_desc: str
    style_block: str

    @property
    def filename_stem(self) -> str:
        return f"{self.archetype}_{self.deal}_{self.variant:02d}"

    @property
    def prompt(self) -> str:
        return ", ".join([
            self.style_block,
            f"a {self.character_desc}",
            self.deal_desc,
        ])


def build_jobs(
    characters: dict, deals: dict, style_block: str,
    only_archetype: str | None, only_deal: str | None,
) -> list[Job]:
    jobs: list[Job] = []
    for arch in ARCHETYPES:
        if only_archetype and arch != only_archetype:
            continue
        char_variants = characters.get(arch)
        if not isinstance(char_variants, list) or not char_variants:
            raise ValueError(f"characters.json: missing/empty entry for {arch}")
        for deal in DEAL_TYPES:
            if only_deal and deal != only_deal:
                continue
            scenarios = deals.get(deal)
            if not isinstance(scenarios, list) or len(scenarios) < VARIANTS_PER_PAIR:
                raise ValueError(
                    f"deals.json: {deal} needs at least {VARIANTS_PER_PAIR} scenarios"
                )
            for n in range(VARIANTS_PER_PAIR):
                # Different character variant + different scene per variant —
                # maximum variety inside a (archetype, deal) triple.
                char = char_variants[n % len(char_variants)]
                deal_desc = scenarios[n]
                jobs.append(Job(
                    archetype=arch, deal=deal, variant=n + 1,
                    character_desc=char, deal_desc=deal_desc,
                    style_block=style_block,
                ))
    return jobs


# --- Rate limiter -----------------------------------------------------------

class TokenBucket:
    """Simple steady-pace limiter: at most N requests per minute."""

    def __init__(self, rpm: int):
        self.interval = 60.0 / max(1, rpm)
        self._next_ok = 0.0

    def wait(self) -> None:
        now = time.monotonic()
        sleep_for = self._next_ok - now
        if sleep_for > 0:
            time.sleep(sleep_for)
        self._next_ok = max(now, self._next_ok) + self.interval


# --- Gemini call ------------------------------------------------------------

def call_gemini(client, prompt: str) -> tuple[bytes, str]:
    """
    Returns (image_bytes, file_extension). Raises on failure.
    Uses the google-genai SDK (`pip install google-genai`).
    """
    from google.genai import types  # type: ignore

    def _make_config(modalities: list[str]) -> types.GenerateContentConfig:
        return types.GenerateContentConfig(
            response_modalities=modalities,
            image_config=types.ImageConfig(aspect_ratio="16:9"),
        )

    # Some SDK versions require ["IMAGE", "TEXT"]; try strict first.
    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=_make_config(["IMAGE"]),
        )
    except Exception:
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=_make_config(["IMAGE", "TEXT"]),
        )

    parts_dump = []
    for cand in (response.candidates or []):
        content = getattr(cand, "content", None)
        if not content:
            continue
        for part in (content.parts or []):
            inline = getattr(part, "inline_data", None)
            if inline and getattr(inline, "data", None):
                mime = inline.mime_type or "image/png"
                ext = mimetypes.guess_extension(mime) or ".png"
                if ext == ".jpe":
                    ext = ".jpg"
                return inline.data, ext
            text_part = getattr(part, "text", None)
            if text_part:
                parts_dump.append(text_part[:200])

    finish = None
    if response.candidates:
        finish = getattr(response.candidates[0], "finish_reason", None)
    raise RuntimeError(
        f"no image in response; finish_reason={finish}; "
        f"text={parts_dump or '<empty>'}"
    )


def write_image(stem: str, data: bytes, ext: str) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"{stem}{ext}"
    out_path.write_bytes(data)
    return out_path


def already_done(stem: str) -> Path | None:
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
        p = OUTPUT_DIR / f"{stem}{ext}"
        if p.exists() and p.stat().st_size > 0:
            return p
    return None


# --- Main loop --------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--style", default=DEFAULT_STYLE,
                        help=f"style key in style_anchor.txt (default: {DEFAULT_STYLE})")
    parser.add_argument("--only", dest="only_archetype",
                        help="only generate this archetype (e.g. BABA_YAGA)")
    parser.add_argument("--only-deal", dest="only_deal",
                        help="only generate this deal type (e.g. POTION_BREW)")
    parser.add_argument("--rpm", type=int, default=REQUESTS_PER_MINUTE,
                        help=f"requests per minute (default: {REQUESTS_PER_MINUTE})")
    parser.add_argument("--limit", type=int, default=None,
                        help="stop after generating this many images (for smoke tests)")
    parser.add_argument("--dry", action="store_true",
                        help="print prompts only, do not call the API")
    parser.add_argument("--force", action="store_true",
                        help="re-generate even if the output file already exists")
    args = parser.parse_args()

    characters = load_json(ROOT / "characters.json")
    deals = load_json(ROOT / "deals.json")
    style_text = (ROOT / "style_anchor.txt").read_text(encoding="utf-8")
    style_block = parse_style_anchor(style_text, args.style)

    jobs = build_jobs(
        characters=characters, deals=deals, style_block=style_block,
        only_archetype=args.only_archetype, only_deal=args.only_deal,
    )

    print(f"[plan] {len(jobs)} jobs · style={args.style} · model={MODEL}")
    if args.dry:
        for j in jobs:
            print(f"--- {j.filename_stem}")
            print(j.prompt)
            print()
        return 0

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY (or GOOGLE_API_KEY) not set", file=sys.stderr)
        return 2

    try:
        from google import genai  # type: ignore
    except ImportError:
        print("ERROR: pip install google-genai", file=sys.stderr)
        return 2

    client = genai.Client(api_key=api_key)
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

    print(f"[plan] {len(todo)} to generate, {len(jobs) - len(todo)} already done")

    failures: list[tuple[Job, str]] = []
    for i, job in enumerate(todo, 1):
        print(f"[{i}/{len(todo)}] {job.filename_stem}")
        backoff = INITIAL_BACKOFF_SEC
        for attempt in range(1, MAX_RETRIES + 1):
            limiter.wait()
            try:
                data, ext = call_gemini(client, job.prompt)
                path = write_image(job.filename_stem, data, ext)
                print(f"  ✓ {path.name} ({len(data)//1024} KB)")
                break
            except Exception as err:  # noqa: BLE001
                msg = str(err)
                # 429 / quota / rate-limit → exponential backoff with jitter.
                # Other transient errors → same treatment, capped at MAX_RETRIES.
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
        print(f"\n[done] {len(todo) - len(failures)}/{len(todo)} ok, "
              f"{len(failures)} failed:", file=sys.stderr)
        for job, msg in failures:
            print(f"  - {job.filename_stem}: {msg[:200]}", file=sys.stderr)
        return 1

    print(f"\n[done] {len(todo)}/{len(todo)} generated → {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
