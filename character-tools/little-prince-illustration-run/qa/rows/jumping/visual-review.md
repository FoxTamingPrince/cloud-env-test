# Jumping row visual review

- Source: `decoded/jumping.png` (five left-to-right poses)
- Extraction: bundled `extract_strip_frames.py`, `--states jumping --method auto`
- Structural review: bundled `inspect_frames.py --require-components`; `review.json` reports `ok: true`, five extracted 192x208 frames, no errors or warnings.
- Visual review: all five poses are complete and well separated. The sequence reads as crouched anticipation, rising lift, airborne peak, descent, then settle. Frame bounding-box top positions are 79, 40, 5, 38, and 65 pixels, so the jump has clear vertical displacement.
- Style: simplified hand-drawn storybook watercolor with dark ink contour and grouped washes. At sprite size the coat reads as painted shapes rather than plush/fuzzy material; no scenery, detached effects, or shadows are present.
- Chroma/background: source is transparent outside the character; the bundled extractor produced clean transparent frames on the configured magenta key for QA.

The contact sheet `contact.png` is a temporary visual-inspection aid, not atlas artwork.
