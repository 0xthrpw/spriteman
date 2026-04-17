import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { PixelBuffer } from '@spriteman/pixel';

const bufToPng = (buf: PixelBuffer): PNG => {
  const png = new PNG({ width: buf.width, height: buf.height });
  png.data = Buffer.from(buf.data.buffer, buf.data.byteOffset, buf.data.byteLength);
  return png;
};

export const encodePng = (buf: PixelBuffer): Buffer => PNG.sync.write(bufToPng(buf));

export const renderPng = (buf: PixelBuffer, outPath: string): void => {
  writeFileSync(outPath, encodePng(buf));
};

export const composeSheet = (frames: PixelBuffer[], cols: number): PixelBuffer => {
  if (frames.length === 0) throw new Error('no frames');
  const w = frames[0]!.width;
  const h = frames[0]!.height;
  const rows = Math.ceil(frames.length / cols);
  const sheet = new PixelBuffer(w * cols, h * rows);
  for (let i = 0; i < frames.length; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const f = frames[i]!;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const src = f.index(x, y);
        const dst = sheet.index(c * w + x, r * h + y);
        sheet.data[dst] = f.data[src]!;
        sheet.data[dst + 1] = f.data[src + 1]!;
        sheet.data[dst + 2] = f.data[src + 2]!;
        sheet.data[dst + 3] = f.data[src + 3]!;
      }
    }
  }
  return sheet;
};

// Integer nearest-neighbor upscale. `factor` must be >= 1.
export const scaleBuffer = (buf: PixelBuffer, factor: number): PixelBuffer => {
  if (!Number.isInteger(factor) || factor < 1) {
    throw new Error(`--scale must be an integer >= 1 (got ${factor})`);
  }
  if (factor === 1) return buf;
  const out = new PixelBuffer(buf.width * factor, buf.height * factor);
  for (let y = 0; y < buf.height; y++) {
    for (let x = 0; x < buf.width; x++) {
      const src = buf.index(x, y);
      const r = buf.data[src]!;
      const g = buf.data[src + 1]!;
      const b = buf.data[src + 2]!;
      const a = buf.data[src + 3]!;
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const d = out.index(x * factor + dx, y * factor + dy);
          out.data[d] = r;
          out.data[d + 1] = g;
          out.data[d + 2] = b;
          out.data[d + 3] = a;
        }
      }
    }
  }
  return out;
};
