# Running row visual QA

- Source: `decoded/running.png` (six-frame horizontal strip, 2172x724 RGBA).
- Extraction: bundled `extract_strip_frames.py --method auto`; connected-component extraction produced six complete 192x208 cells.
- Automated review: `review.json` reports `ok: true`, with no errors or warnings; each frame has a complete fox silhouette, zero edge pixels, and zero chroma-adjacent pixels.
- Visual review: all six poses retain the same slender russet fox identity, cream face/chest/tail tip, dark paws, proportions, watercolor/ink illustration treatment, and readable full body. Frames show a restrained task-focused cycle: attentive start, eye/head scan, downward concentration, a small forepaw adjustment, upward return, and reset. There is no foot-running, travel, scenery, prop, shadow, or detached motion effect.
- Style check: it reads as a hand-drawn storybook illustration with painted texture and ink contours; there is no textile, plush, seam, plastic, 3D, or photographic treatment.
- Background note: generated strip is RGBA with transparent background rather than opaque magenta; the bundled extractor handles it cleanly.
- Preview renderer note: `render_animation_previews.py` expects the full standard-state frame tree and reports the absent `idle` row when run on this single-row directory. No preview was emitted; the six extracted frames were individually inspected.
