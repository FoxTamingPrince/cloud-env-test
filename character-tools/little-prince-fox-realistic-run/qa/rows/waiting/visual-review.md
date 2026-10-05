# Waiting row visual QA

Source: `decoded/waiting.png` (generated from canonical-base and waiting layout references). The original generated image remains at its generated-images path.

- Six extracted full-body poses; bundled extraction selected connected components; all extracted frames are 192x208.
- Bundled `inspect_frames.py --require-components`: `ok: true`, no errors or warnings. All six have `edge_pixels: 0` and `chroma_adjacent_pixels: 0`.
- Baseline is stable at bottom y=203 in each frame. No clipped ears, paws, or tail; no overlap or detached effects.
- Motion reads as patient, expectant asking: small head/ear changes and a brief, restrained forepaw lift, then settling back into attentive eye contact. This is distinct from a motionless idle pose.
- The fox retains natural anatomy, realistic guard-hair/underfur texture, natural light, orange/cream/black markings, and the canonical face. No plush, fabric, stitching, toy proportions, or cartoon cues.

Contact sheet: `qa/rows/waiting/contact-sheet.png`. Machine review: `qa/rows/waiting/review.json`.
