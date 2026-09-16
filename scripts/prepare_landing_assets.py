"""Convert approved landing source images to web delivery assets."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def convert(source: Path, destination: Path, quality: int) -> None:
    with Image.open(source) as image:
        image = image.convert("RGB")
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, format="WEBP", quality=quality, method=6)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--course-source", type=Path, required=True)
    parser.add_argument("--crossroads-source", type=Path, required=True)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("public/landing"),
    )
    parser.add_argument("--quality", type=int, default=90)
    args = parser.parse_args()

    convert(args.course_source, args.output_dir / "course-overload.webp", args.quality)
    convert(
        args.crossroads_source,
        args.output_dir / "direction-crossroads.webp",
        args.quality,
    )


if __name__ == "__main__":
    main()
