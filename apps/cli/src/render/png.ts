import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { PixelBuffer } from '@spriteman/pixel';

export const renderPng = (buf: PixelBuffer, outPath: string): void => {
  const png = new PNG({ width: buf.width, height: buf.height });
  png.data = Buffer.from(buf.data.buffer, buf.data.byteOffset, buf.data.byteLength);
  const out = PNG.sync.write(png);
  writeFileSync(outPath, out);
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
