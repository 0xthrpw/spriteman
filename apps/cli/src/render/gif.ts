import { writeFileSync } from 'node:fs';
import gifencPkg from 'gifenc';
import type { PixelBuffer } from '@spriteman/pixel';

// gifenc is CJS-style; Node's ESM interop only surfaces the default export.
const { GIFEncoder, quantize, applyPalette } = gifencPkg as unknown as {
  GIFEncoder: typeof import('gifenc').GIFEncoder;
  quantize: typeof import('gifenc').quantize;
  applyPalette: typeof import('gifenc').applyPalette;
};

export type GifFrame = { buf: PixelBuffer; durationMs: number };

/**
 * Encode a series of same-sized frames as an animated GIF. Uses gifenc's
 * median-cut quantizer; alpha is flattened to on/off (GIF limitation).
 */
export const renderGif = (frames: GifFrame[], outPath: string): void => {
  if (frames.length === 0) throw new Error('no frames');
  const w = frames[0]!.buf.width;
  const h = frames[0]!.buf.height;
  for (const f of frames) {
    if (f.buf.width !== w || f.buf.height !== h) throw new Error('frames must share dimensions');
  }
  const enc = GIFEncoder();
  // Build a shared palette from all frames combined for consistent color.
  const combined = new Uint8ClampedArray(w * h * 4 * frames.length);
  for (let i = 0; i < frames.length; i++) {
    combined.set(frames[i]!.buf.data, i * w * h * 4);
  }
  const palette = quantize(combined, 256, { format: 'rgba4444' });
  for (const f of frames) {
    const indexed = applyPalette(f.buf.data, palette, 'rgba4444');
    enc.writeFrame(indexed, w, h, {
      palette,
      delay: Math.max(10, Math.round(f.durationMs)),
      transparent: true,
      transparentIndex: findTransparentIndex(palette),
    });
  }
  enc.finish();
  writeFileSync(outPath, Buffer.from(enc.bytes()));
};

const findTransparentIndex = (palette: number[][]): number | undefined => {
  for (let i = 0; i < palette.length; i++) {
    if ((palette[i]![3] ?? 255) === 0) return i;
  }
  return undefined;
};
