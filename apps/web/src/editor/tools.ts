import type { PixelBuffer, RGBA } from './pixelBuffer.js';
import { rgbaEqual } from './pixelBuffer.js';
import type { PixelDiff } from './history.js';
import type { ToolId } from './store.js';

export type Point = { x: number; y: number };

export type StrokeContext = {
  tool: ToolId;
  color: RGBA;        // primary color
  brushSize: 1 | 2 | 3 | 4;
  constrain: boolean; // shift held
  buffer: PixelBuffer;
};

// A stroke lifecycle: begin(point) → move(point[]) → end(): commit diffs
export interface Stroke {
  begin(p: Point): void;
  move(p: Point): void;
  end(): PixelDiff[];
  /** If true, current stroke is a "preview" that must be rendered on the overlay, not baked into artwork until end(). */
  previewOnly: boolean;
  /** For preview tools, render overlay frame based on current gesture state. */
  renderPreview?: (ctx: CanvasRenderingContext2D, scale: number) => void;
}

// ---- utility: brush stamp (paints square of size around p) ----
function stampBrush(buf: PixelBuffer, x: number, y: number, size: number, color: RGBA, diffs: PixelDiff[] | null, seen: Set<number>) {
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

// Bresenham
function line(x0: number, y0: number, x1: number, y1: number, visit: (x: number, y: number) => void) {
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

function constrainLineTo45(x0: number, y0: number, x1: number, y1: number): [number, number] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx > 2 * ady) return [x1, y0];
  if (ady > 2 * adx) return [x0, y1];
  const m = Math.max(adx, ady);
  return [x0 + Math.sign(dx) * m, y0 + Math.sign(dy) * m];
}

// ---------------- pencil / eraser ----------------

class PaintStroke implements Stroke {
  previewOnly = false;
  private last: Point | null = null;
  private seen = new Set<number>();
  private diffs: PixelDiff[] = [];
  constructor(private ctx: StrokeContext, private eraser: boolean) {}
  begin(p: Point) {
    this.paint(p);
    this.last = p;
  }
  move(p: Point) {
    if (!this.last) return this.begin(p);
    let end = p;
    if (this.ctx.constrain) {
      const [cx, cy] = constrainLineTo45(this.last.x, this.last.y, p.x, p.y);
      end = { x: cx, y: cy };
    }
    line(this.last.x, this.last.y, end.x, end.y, (x, y) => this.paintAt(x, y));
    this.last = end;
  }
  end() {
    return this.diffs;
  }
  private paint(p: Point) {
    this.paintAt(p.x, p.y);
  }
  private paintAt(x: number, y: number) {
    const c: RGBA = this.eraser ? [0, 0, 0, 0] : this.ctx.color;
    stampBrush(this.ctx.buffer, x, y, this.ctx.brushSize, c, this.diffs, this.seen);
  }
}

// ---------------- fill bucket ----------------

class FillStroke implements Stroke {
  previewOnly = false;
  private diffs: PixelDiff[] = [];
  constructor(private ctx: StrokeContext) {}
  begin(p: Point) {
    const buf = this.ctx.buffer;
    if (!buf.inBounds(p.x, p.y)) return;
    const target: RGBA = buf.get(p.x, p.y);
    if (rgbaEqual(target, this.ctx.color)) return;
    const stack: Point[] = [p];
    const seen = new Set<number>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (!buf.inBounds(cur.x, cur.y)) continue;
      const i = buf.index(cur.x, cur.y);
      if (seen.has(i)) continue;
      const px: RGBA = [buf.data[i]!, buf.data[i + 1]!, buf.data[i + 2]!, buf.data[i + 3]!];
      if (!rgbaEqual(px, target)) continue;
      seen.add(i);
      this.diffs.push({ i, before: px, after: this.ctx.color });
      buf.data[i] = this.ctx.color[0];
      buf.data[i + 1] = this.ctx.color[1];
      buf.data[i + 2] = this.ctx.color[2];
      buf.data[i + 3] = this.ctx.color[3];
      stack.push({ x: cur.x + 1, y: cur.y });
      stack.push({ x: cur.x - 1, y: cur.y });
      stack.push({ x: cur.x, y: cur.y + 1 });
      stack.push({ x: cur.x, y: cur.y - 1 });
    }
  }
  move() {}
  end() {
    return this.diffs;
  }
}

// ---------------- eyedropper ----------------

class EyedropperStroke implements Stroke {
  previewOnly = false;
  picked: RGBA | null = null;
  constructor(private ctx: StrokeContext) {}
  begin(p: Point) {
    if (!this.ctx.buffer.inBounds(p.x, p.y)) return;
    this.picked = this.ctx.buffer.get(p.x, p.y);
  }
  move(p: Point) {
    this.begin(p);
  }
  end() {
    return [];
  }
}

// ---------------- line (preview) ----------------

class LineStroke implements Stroke {
  previewOnly = true;
  private start: Point | null = null;
  private current: Point | null = null;
  constructor(private ctx: StrokeContext) {}
  begin(p: Point) {
    this.start = p;
    this.current = p;
  }
  move(p: Point) {
    this.current = p;
  }
  end() {
    if (!this.start || !this.current) return [];
    const diffs: PixelDiff[] = [];
    const seen = new Set<number>();
    let ex = this.current.x;
    let ey = this.current.y;
    if (this.ctx.constrain) {
      [ex, ey] = constrainLineTo45(this.start.x, this.start.y, ex, ey);
    }
    line(this.start.x, this.start.y, ex, ey, (x, y) =>
      stampBrush(this.ctx.buffer, x, y, this.ctx.brushSize, this.ctx.color, diffs, seen),
    );
    return diffs;
  }
  renderPreview(ctx: CanvasRenderingContext2D, scale: number) {
    if (!this.start || !this.current) return;
    const [r, g, b, a] = this.ctx.color;
    ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
    let ex = this.current.x;
    let ey = this.current.y;
    if (this.ctx.constrain) {
      [ex, ey] = constrainLineTo45(this.start.x, this.start.y, ex, ey);
    }
    const b0 = this.ctx.brushSize;
    line(this.start.x, this.start.y, ex, ey, (x, y) => {
      const h = Math.floor((b0 - 1) / 2);
      ctx.fillRect((x - h) * scale, (y - h) * scale, b0 * scale, b0 * scale);
    });
  }
}

// ---------------- rectangle (preview) ----------------

class RectStroke implements Stroke {
  previewOnly = true;
  private start: Point | null = null;
  private current: Point | null = null;
  constructor(private ctx: StrokeContext) {}
  begin(p: Point) {
    this.start = p;
    this.current = p;
  }
  move(p: Point) {
    this.current = p;
  }
  end() {
    if (!this.start || !this.current) return [];
    const diffs: PixelDiff[] = [];
    const seen = new Set<number>();
    const { x0, y0, x1, y1 } = this.rect();
    // outline (stroke)
    for (let x = x0; x <= x1; x++) {
      stampBrush(this.ctx.buffer, x, y0, 1, this.ctx.color, diffs, seen);
      stampBrush(this.ctx.buffer, x, y1, 1, this.ctx.color, diffs, seen);
    }
    for (let y = y0; y <= y1; y++) {
      stampBrush(this.ctx.buffer, x0, y, 1, this.ctx.color, diffs, seen);
      stampBrush(this.ctx.buffer, x1, y, 1, this.ctx.color, diffs, seen);
    }
    return diffs;
  }
  renderPreview(ctx: CanvasRenderingContext2D, scale: number) {
    if (!this.start || !this.current) return;
    const [r, g, b, a] = this.ctx.color;
    ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
    const { x0, y0, x1, y1 } = this.rect();
    for (let x = x0; x <= x1; x++) {
      ctx.fillRect(x * scale, y0 * scale, scale, scale);
      ctx.fillRect(x * scale, y1 * scale, scale, scale);
    }
    for (let y = y0; y <= y1; y++) {
      ctx.fillRect(x0 * scale, y * scale, scale, scale);
      ctx.fillRect(x1 * scale, y * scale, scale, scale);
    }
  }
  private rect() {
    let { x: sx, y: sy } = this.start!;
    let { x: cx, y: cy } = this.current!;
    if (this.ctx.constrain) {
      const dx = cx - sx;
      const dy = cy - sy;
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      cx = sx + Math.sign(dx || 1) * m;
      cy = sy + Math.sign(dy || 1) * m;
    }
    const x0 = Math.min(sx, cx);
    const x1 = Math.max(sx, cx);
    const y0 = Math.min(sy, cy);
    const y1 = Math.max(sy, cy);
    return { x0, y0, x1, y1 };
  }
}

export function createStroke(ctx: StrokeContext): Stroke {
  switch (ctx.tool) {
    case 'pencil':
      return new PaintStroke(ctx, false);
    case 'eraser':
      return new PaintStroke(ctx, true);
    case 'fill':
      return new FillStroke(ctx);
    case 'eyedropper':
      return new EyedropperStroke(ctx);
    case 'line':
      return new LineStroke(ctx);
    case 'rect':
      return new RectStroke(ctx);
  }
}

export { EyedropperStroke };
