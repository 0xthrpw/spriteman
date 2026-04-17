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
