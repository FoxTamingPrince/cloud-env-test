# Failed row visual review

Source: `decoded/failed.png` (8-frame connected strip). Extracted frames: `qa/rows/failed/frames/failed/00.png` through `07.png`.

- The row contains eight complete, centered fox poses and passed `inspect_frames.py --require-components` with `ok: true`, no errors, and no warnings.
- The fox remains the same slim russet-and-cream character with pointed ears, dark paws, and large tail. The image reads as hand-drawn watercolor with ink contours and painterly fur marks; it is clearly an illustration, not a plush toy or photograph.
- The animation progresses from a slightly uneasy pose into drooping ears and head, bent legs, seated lower posture, and closed sad eyes, then holds the deflated expression. No extra props or detached effects appear.
- Visual frame inspection shows a thin magenta fringe around some fur edges after chroma extraction. Keep the required one-pass despill for final atlas assembly; do not repeat it on this row.
