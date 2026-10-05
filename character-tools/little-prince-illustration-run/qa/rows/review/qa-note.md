# Review row QA

Source: `decoded/review.png`; six-frame extraction: `qa/rows/review/frames/review/00.png` through `05.png`.

- Extraction: bundled `extract_strip_frames.py --method auto` detected six connected components; bundled `inspect_frames.py --require-components` returned `ok: true`, with no errors or warnings.
- Motion semantics: the row reads as a quiet review loop: attentive neutral pose, lowered/leaning thoughtful gaze, blink, narrowed focused eyes, head tilt, then a small paw lift.
- Identity/style: all frames retain the same slender russet fox, cream facial/chest/tail markings, dark paws, watercolor-and-ink storybook rendering, and muted palette. It reads as an illustrated fox, not a plush toy or photograph.
- Continuity: apparent size and ground baseline remain stable; changes are small and confined mainly to head/eyes and one forepaw. No props, text, scenery, detached effects, crop, or guide marks.

Disposition: accepted for parent workflow integration. The standalone contact-sheet helper only accepts full atlas dimensions, so individual extracted frames were inspected directly.
