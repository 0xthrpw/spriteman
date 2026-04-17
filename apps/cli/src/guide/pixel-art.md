# Pixel art for agents — a working guide

This guide is written for an AI agent authoring sprites with the `spriteman`
CLI. Each section is a `##` heading; you can print just one via
`spriteman guide <slug>` (e.g. `spriteman guide palette`).

## overview

You are drawing on an integer grid. Every pixel is a discrete unit — there is
no anti-aliasing, no sub-pixel positioning, no alpha-blending unless you
explicitly paint with a semi-transparent color. That constraint is the whole
point of pixel art: you get legibility and character from decisions about
*which specific pixels to fill*, not from sampling a continuous image.

Work in this order for each new sprite:

1. Pick a resolution that fits the subject (see `guide resolution`).
2. Pick a palette of 4–16 colors before you draw anything (see `guide palette`).
3. Block in silhouette with a single midtone color.
4. Commit to a light direction and add one shadow color + one highlight color.
5. Add a cleanup pass — fix jaggies, prune stray pixels, tidy outlines.

Drive the tool via `spriteman apply <script.json>` for anything non-trivial.
Every single-op `draw *` command issues a full GET + PUT round-trip with
optimistic-concurrency; batching with `apply` is cheaper and atomic.

## resolution

Small canvases are unforgiving and readable. Large canvases are forgiving and
blurry. Pick the smallest size that fits your subject.

- **8×8** — ui icons, tiny emoji, tile decorations. Room for a silhouette, one
  accent color, and maybe a single-pixel shadow.
- **16×16** — classic tile size (NES-era). Good for small items, coins,
  collectibles, minimalist character heads.
- **24×24** — in-between; Game Boy Advance sprites, small overworld
  characters.
- **32×32** — classic character sprite (SNES overworld, GBA). Enough pixels
  for recognizable faces, limb shapes, and shading.
- **48×48** or **64×64** — detailed portraits, bosses, UI avatars. Still
  disciplined pixel art; use a tight palette to keep it from looking painterly.
- **≥128×128** — approaches illustration. Most "pixel art" at this size
  cheats with AA or smooth gradients and reads as stylized 2D art rather than
  true pixel art.

When unsure, default to 32×32 for characters, 16×16 for items, 64×64 for
detailed key art.

## palette

**Before you draw anything, decide your palette.** A limited palette does
more to make something look like "real" pixel art than any drawing skill.

Rules of thumb:

- Start with 4–16 colors. Avoid >32.
- Group colors in 3–5 ramps (dark → midtone → light) — one ramp per material
  (skin, cloth, metal, wood).
- Shift hue across a ramp, don't just change lightness. Shadows drift toward
  cool/complementary hues; highlights drift toward warm/desaturated.
- Reuse colors across ramps where possible — it ties the image together.
- Reserve pure black (#000000) and pure white (#ffffff) for emphasis only.

Good starting palettes shipped with spriteman (list with
`spriteman palette list`):

- **PICO-8** (16 colors) — bright, cartoony, extremely versatile.
- **Sweetie 16** (16 colors) — soft pastel ramps, great for cozy / storybook.
- **Grayscale** (16 colors) — build first, color later.

Agents: quantize your mental design to the palette BEFORE emitting ops.
Don't emit a color outside the palette unless you explicitly intend to
extend it.

## shading

Pick a light direction and commit to it. Conventional choice: light from
upper-left (so highlights go on top-left, shadows on bottom-right).

Three-color rule for a beginner-friendly result:

- **Midtone** — the base color of the material.
- **Shadow** — one step darker and hue-shifted toward the complementary (cool
  colors' shadows go warmer and vice-versa).
- **Highlight** — one step lighter, used sparingly on the single clearest
  light-facing edge.

Common shading mistakes:

- **Pillow shading**: highlight in the middle, shadow around the edges
  uniformly. Looks soft and three-dimensional-ly wrong. Commit to a
  directional light instead.
- **Banding**: two consecutive shading bands run perfectly parallel for a
  long stretch, making visible "stairs". Break the band by shifting one color
  over a row, or by interleaving a pixel of the other color.
- **Too many highlight pixels**: a highlight is loudest when there are very
  few of them. One or two pixels is usually enough.

## lines

Pixel-perfect lines have no "doubles" — places where two pixels share a
corner. On a 1-pixel line, each step goes either horizontally or diagonally,
never both at once next to each other.

Line segment conventions:

- Use segment lengths that progress evenly: e.g. 3, 2, 2, 2, 3 rather than
  1, 4, 1, 4. Long–short–long patterns look jagged.
- For a 45° line, draw a perfect diagonal — every pixel connects corner to
  corner. For shallower angles, use mostly horizontal runs with the
  occasional one-pixel step.
- `drawLine` via the CLI uses Bresenham, which is correct but doesn't auto-
  clean jaggies. For clean outlines on characters, consider drawing them by
  hand op-by-op in an `apply` script.

## animation

Typical frame counts for common cycles at 12 fps:

- **Idle**: 2–4 frames, 200–400 ms per frame. Small bob or breathing motion.
- **Walk**: 4 frames (contact, down, passing, up) or 8 frames for smoother.
  120 ms/frame at 8 fps feels right for classic game vibes.
- **Run**: 6–8 frames, 80–100 ms/frame.
- **Attack**: 3–5 frames, with anticipation (wind-up), the hit frame (held
  longer, 100–150 ms), and a recovery frame.

Set per-frame timing with `spriteman frame duration <ref> <ms>`. Omitting
durations falls back to the project's FPS.

Anti-stutter: keep the sprite's "center of mass" consistent across frames so
animations don't wiggle. Anchor characters to a fixed foot position.

## pitfalls

The mistakes that most often make AI-authored pixel art look wrong:

- **Stray pixels**: isolated single pixels floating away from the sprite,
  or speckles inside a solid color fill. Clean them up in a final pass.
- **Accidental anti-aliasing**: emitting `#80808080` (half-transparent gray)
  to "smooth" an edge. Don't. Use solid pixels and commit to the edge.
- **Inconsistent outlines**: outline one pixel wide here, two pixels wide
  there, absent in a third spot. Pick one and hold it across the whole sprite.
- **Muddy palette**: 30 slightly different browns, each used once. Collapse
  them to 2–3 shared browns.
- **Scale confusion**: a 16×16 sprite designed as if it were 64×64. You
  don't have enough pixels for eyebrows, teeth, fingernails — cut features
  to essentials.
- **Banding** (see `guide shading`).
- **Mixed light directions**: head lit from upper-left, body lit from the
  right. Pick one.

## workflow

Example end-to-end session to author a 16×16 coin sprite:

```bash
spriteman login
spriteman project create coin --width 16 --height 16 --fps 8
# spriteman sets this as the active project; subsequent commands omit --project.

cat > /tmp/coin-f0.json <<'EOF'
{
  "frame": 0,
  "ops": [
    {"type": "clear"},
    {"type": "rect", "at": [3, 3], "size": [10, 10], "color": "#ffec27ff", "fill": true},
    {"type": "rect", "at": [3, 3], "size": [10, 10], "color": "#ab5236ff"},
    {"type": "pixel", "x": 6, "y": 6, "color": "#fff1e8ff"},
    {"type": "pixel", "x": 7, "y": 6, "color": "#fff1e8ff"},
    {"type": "line", "from": [7, 8], "to": [7, 11], "color": "#ab5236ff"}
  ]
}
EOF

spriteman apply /tmp/coin-f0.json
spriteman render $(spriteman project list --json | jq -r '.[0].id') --frame 0 --out coin.png
```

Guidelines:

- One `apply` per frame. Don't mix edits to different frames in one script.
- Keep a mental model of the canvas: agents are not good at invisible state,
  so `spriteman render ... --out preview.png` between edits, then re-read the
  PNG to verify your mental model matches reality.
- When iterating, prefer `apply` with `clear` at the top of the script. It's
  cheaper to rebuild a small frame than to patch it.
- Use `spriteman guide palette` before you choose colors. The built-in
  palettes are curated and will almost always look better than ad-hoc picks.
