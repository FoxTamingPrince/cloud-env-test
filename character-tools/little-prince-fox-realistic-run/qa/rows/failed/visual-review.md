# Failed row visual QA

- Strip: 8 full-body frames, 2172x724; source copied to `decoded/failed.png`. Original imagegen output remains at `/Users/zyb/.codex/generated_images/01a0ffdf-4c9b-79c0-bd48-8c5dd8b45b77/exec-baea4c03-2ede-4350-9d46-8b4a3d4967cf.png`.
- Readability: clear standing-to-seated slump; ears flatten progressively, head lowers, and the final poses close their eyes.
- Continuity: russet fox identity and realistic fur/light stay consistent. Width remains about 101-107 px within 192 px cells; height reduction tracks the intended crouch, with paws held on a stable baseline. No abrupt scale pop.
- Geometry/effects: all 8 poses extracted as complete connected groups; bodies and tails remain inside cells. No detached effects or clipping.
- Pipeline: `extract_strip_frames.py --method auto` and `inspect_frames.py --require-components` both report `ok: true`; 8/8 frames, zero warnings/errors, zero edge pixels.
- Source background is transparent RGBA rather than the requested magenta; the bundled extraction recognizes it and the extracted frames are clean.
