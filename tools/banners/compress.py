#!/usr/bin/env python3
"""
Сжать PNG-баннеры в WebP.

PNG → WebP quality=85 даёт ~3-4x уменьшение без заметной потери качества.

Usage:
    python compress.py                          # output_realistic/ → output_webp/
    python compress.py --input output_realistic --output output_webp
    python compress.py --quality 80             # чуть меньше размер
    python compress.py --inplace                # заменить PNG на WebP на месте
    python compress.py --dry                    # показать статистику без записи
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERROR: pip install pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent


def compress_dir(
    src: Path,
    dst: Path,
    quality: int,
    inplace: bool,
    dry: bool,
) -> None:
    pngs = sorted(src.glob("*.png"))
    if not pngs:
        print(f"[warn] нет PNG файлов в {src}")
        return

    if not dry and not inplace:
        dst.mkdir(parents=True, exist_ok=True)

    total_src = 0
    total_dst = 0

    for png in pngs:
        src_size = png.stat().st_size
        total_src += src_size

        out_path = (png.parent if inplace else dst) / (png.stem + ".webp")

        if dry:
            total_dst += src_size // 3  # грубая оценка
            print(f"  {png.name:45s} {src_size/1024:6.0f} KB → ~{src_size//3//1024} KB  (estimated)")
            continue

        with Image.open(png) as img:
            img.save(out_path, "WEBP", quality=quality, method=6)

        dst_size = out_path.stat().st_size
        total_dst += dst_size
        ratio = src_size / dst_size
        print(f"  {png.name:45s} {src_size/1024:6.0f} KB → {dst_size/1024:5.0f} KB  (×{ratio:.1f})")

        if inplace:
            png.unlink()

    if dry:
        print(f"\n[dry] {len(pngs)} файлов, ~{total_src/1024/1024:.1f} MB → ~{total_dst/1024/1024:.1f} MB")
    else:
        ratio = total_src / total_dst if total_dst else 0
        saved = total_src - total_dst
        print(
            f"\n[done] {len(pngs)} файлов  "
            f"{total_src/1024/1024:.1f} MB → {total_dst/1024/1024:.1f} MB  "
            f"сэкономлено {saved/1024/1024:.1f} MB  (×{ratio:.1f})"
        )
        if not inplace:
            print(f"       результат: {dst}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--input", "-i", default="output_realistic",
                        help="папка с PNG (default: output_realistic)")
    parser.add_argument("--output", "-o", default="output_webp",
                        help="папка для WebP (default: output_webp)")
    parser.add_argument("--quality", "-q", type=int, default=85,
                        help="WebP quality 0-100 (default: 85)")
    parser.add_argument("--inplace", action="store_true",
                        help="заменить PNG на WebP в той же папке, удалить оригиналы")
    parser.add_argument("--dry", action="store_true",
                        help="показать оценку без записи файлов")
    args = parser.parse_args()

    src = ROOT / args.input
    dst = ROOT / args.output

    if not src.exists():
        print(f"ERROR: папка не найдена: {src}", file=sys.stderr)
        return 2

    print(f"[compress] {src} → {'(inplace)' if args.inplace else dst}  quality={args.quality}\n")
    compress_dir(src, dst, args.quality, args.inplace, args.dry)
    return 0


if __name__ == "__main__":
    sys.exit(main())
