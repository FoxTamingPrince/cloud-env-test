# Waving row QA

- Source strip: `decoded/waving.png` (2056x765); the original ImageGen result remains at `/Users/zyb/.codex/generated_images/01a0ffdb-e096-7303-851e-e2aa6d47179a/exec-f25963a8-3cba-4c48-92fa-24ef6bac0dee.png`.
- Prompt and references: `prompts/rows/waving.md`, `references/canonical-base.png`, and `references/layout-guides/waving.png`.
- Visual review: four complete, consistently scaled natural fox poses; the greeting reads through the forepaw only. Fur and anatomy are photorealistic; no plush texture, scenery, labels, guide lines, or detached effects. The loop returns to the starting pose.
- Extraction: `extract_strip_frames.py` found four connected components and emitted four 192x208 frames in `frames/waving/`.
- Edge cleanup: chroma spill was suppressed on extracted frame boundaries; alpha remained unchanged. Per-frame reports are in `despill/`.
- Inspection: `inspect.json` passed with `--require-components`: 4/4 frames, component extraction, no errors or warnings, zero edge pixels in the 2-pixel margin, and 0–1 chroma-adjacent pixels per frame. Bboxes are x=22–169, y=5–203; poses share the same vertical baseline.
