import { PixelBuffer, rgbaEqual, type RGBA } from './pixelBuffer.js';

// Paint a size×size square centered on (x,y). Optionally records diffs for undo
// and de-duplicates writes via a shared `seen` index-set.
export function stampBrush(
  buf: PixelBuffer,
  x: number,
  y: number,
  size: number,
  color: RGBA,
  diffs: { i: number; before: RGBA; after: RGBA }[] | null,
  seen: Set<number>,
): void {
  const half = Math.floor((size - 1) / 2);
  for (let dy = -half; dy <= size - 1 - half; dy++) {
    for (let dx = -half; dx <= size - 1 - half; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (!buf.inBounds(px, py)) continue;
      const i = buf.index(px, py);
      if (seen.has(i)) continue;
      seen.add(i);
      const before: RGBA = [buf.data[i]!, buf.data[i + 1]!, buf.data[i + 2]!, buf.data[i + 3]!];
      if (rgbaEqual(before, color)) continue;
      if (diffs) diffs.push({ i, before, after: color });
      buf.data[i] = color[0];
      buf.data[i + 1] = color[1];
      buf.data[i + 2] = color[2];
      buf.data[i + 3] = color[3];
    }
  }
}

// Bresenham — visits every integer grid point on the segment [(x0,y0),(x1,y1)].
export function bresenham(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  visit: (x: number, y: number) => void,
): void {
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  while (true) {
    visit(x, y);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// Snap a line endpoint to 0°/45°/90° relative to start.
export function constrainLineTo45(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): [number, number] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx > 2 * ady) return [x1, y0];
  if (ady > 2 * adx) return [x0, y1];
  const m = Math.max(adx, ady);
  return [x0 + Math.sign(dx) * m, y0 + Math.sign(dy) * m];
}

// ---------- High-level operations used by the CLI ----------

export function setPixel(buf: PixelBuffer, x: number, y: number, color: RGBA): void {
  if (!buf.inBounds(x, y)) return;
  buf.set(x, y, color);
}

export type LineOptions = { thickness?: number };

export function drawLine(
  buf: PixelBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: RGBA,
  opts: LineOptions = {},
): void {
  const t = Math.max(1, Math.floor(opts.thickness ?? 1));
  const seen = new Set<number>();
  bresenham(x0, y0, x1, y1, (x, y) => stampBrush(buf, x, y, t, color, null, seen));
}

export type RectOptions = { fill?: boolean };

export function drawRect(
  buf: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  color: RGBA,
  opts: RectOptions = {},
): void {
  if (w <= 0 || h <= 0) return;
  const x0 = x;
  const y0 = y;
  const x1 = x + w - 1;
  const y1 = y + h - 1;
  if (opts.fill) {
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) setPixel(buf, px, py, color);
    }
    return;
  }
  for (let px = x0; px <= x1; px++) {
    setPixel(buf, px, y0, color);
    setPixel(buf, px, y1, color);
  }
  for (let py = y0; py <= y1; py++) {
    setPixel(buf, x0, py, color);
    setPixel(buf, x1, py, color);
  }
}

// 4-connected flood fill — writes `color` into every same-colored pixel
// reachable from (x,y). No-op if target already matches `color`.
export function floodFill(buf: PixelBuffer, x: number, y: number, color: RGBA): void {
  if (!buf.inBounds(x, y)) return;
  const target = buf.get(x, y);
  if (rgbaEqual(target, color)) return;
  const stack: [number, number][] = [[x, y]];
  const seen = new Set<number>();
  while (stack.length) {
    const next = stack.pop()!;
    const cx = next[0];
    const cy = next[1];
    if (!buf.inBounds(cx, cy)) continue;
    const i = buf.index(cx, cy);
    if (seen.has(i)) continue;
    const px: RGBA = [buf.data[i]!, buf.data[i + 1]!, buf.data[i + 2]!, buf.data[i + 3]!];
    if (!rgbaEqual(px, target)) continue;
    seen.add(i);
    buf.data[i] = color[0];
    buf.data[i + 1] = color[1];
    buf.data[i + 2] = color[2];
    buf.data[i + 3] = color[3];
    stack.push([cx + 1, cy]);
    stack.push([cx - 1, cy]);
    stack.push([cx, cy + 1]);
    stack.push([cx, cy - 1]);
  }
}

export function clearBuffer(buf: PixelBuffer, color: RGBA = [0, 0, 0, 0]): void {
  for (let i = 0; i < buf.data.length; i += 4) {
    buf.data[i] = color[0];
    buf.data[i + 1] = color[1];
    buf.data[i + 2] = color[2];
    buf.data[i + 3] = color[3];
  }
}

const swapPixel = (buf: PixelBuffer, i: number, j: number): void => {
  const r = buf.data[i]!, g = buf.data[i + 1]!, b = buf.data[i + 2]!, a = buf.data[i + 3]!;
  buf.data[i] = buf.data[j]!;
  buf.data[i + 1] = buf.data[j + 1]!;
  buf.data[i + 2] = buf.data[j + 2]!;
  buf.data[i + 3] = buf.data[j + 3]!;
  buf.data[j] = r;
  buf.data[j + 1] = g;
  buf.data[j + 2] = b;
  buf.data[j + 3] = a;
};

// In-place mirror across the given axis. 'x' flips horizontally (left↔right),
// 'y' flips vertically (top↔bottom).
export function mirrorBuffer(buf: PixelBuffer, axis: 'x' | 'y'): void {
  const { width, height } = buf;
  if (axis === 'x') {
    const half = Math.floor(width / 2);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < half; x++) {
        swapPixel(buf, buf.index(x, y), buf.index(width - 1 - x, y));
      }
    }
  } else {
    const half = Math.floor(height / 2);
    for (let y = 0; y < half; y++) {
      for (let x = 0; x < width; x++) {
        swapPixel(buf, buf.index(x, y), buf.index(x, height - 1 - y));
      }
    }
  }
}

// In-place 90°-quantized rotation. `turns` is counted clockwise (1 = 90°,
// 2 = 180°, 3 = 270°). Only square buffers are supported for 1/3 turns —
// throws otherwise. 180° works on any rectangle.
export function rotateBuffer(buf: PixelBuffer, turns: 1 | 2 | 3): void {
  const t = (((turns % 4) + 4) % 4) as 0 | 1 | 2 | 3;
  if (t === 0) return;
  const { width, height } = buf;
  if (t === 2) {
    // 180° = mirror x then mirror y (either order works).
    const n = width * height;
    for (let i = 0; i < Math.floor(n / 2); i++) {
      const a = i * 4;
      const b = (n - 1 - i) * 4;
      swapPixel(buf, a, b);
    }
    return;
  }
  if (width !== height) {
    throw new Error('90°/270° rotation requires a square buffer');
  }
  const n = width;
  const temp = new Uint8ClampedArray(buf.data);
  const srcIdx = (x: number, y: number) => (y * n + x) * 4;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let sx: number, sy: number;
      if (t === 1) {
        // clockwise 90°: new(x,y) ← old(y, n-1-x)
        sx = y;
        sy = n - 1 - x;
      } else {
        // 270° (counter-clockwise 90°): new(x,y) ← old(n-1-y, x)
        sx = n - 1 - y;
        sy = x;
      }
      const s = srcIdx(sx, sy);
      const d = buf.index(x, y);
      buf.data[d] = temp[s]!;
      buf.data[d + 1] = temp[s + 1]!;
      buf.data[d + 2] = temp[s + 2]!;
      buf.data[d + 3] = temp[s + 3]!;
    }
  }
}
