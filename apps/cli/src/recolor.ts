import { randomUUID } from 'node:crypto';
import { PixelBuffer, hexToRgba, rgbaToHex, type RGBA } from '@spriteman/pixel';
import type { Frame, Project } from '@spriteman/shared';

export type ColorMap = Map<string, RGBA>;

// Parse "#aaa:#bbb,#ccc:#ddd" into a canonical-hex-keyed map.
// Keys are normalized to lowercased 8-char hex (no `#`) so lookups against
// `rgbaToHex(...).slice(1)` always hit.
export const parseColorMap = (spec: string): ColorMap => {
  const out: ColorMap = new Map();
  const pairs = spec.split(',').map((s) => s.trim()).filter(Boolean);
  for (const pair of pairs) {
    const [from, to] = pair.split(':').map((s) => s?.trim());
    if (!from || !to) throw new Error(`invalid --map pair: ${pair}`);
    const fromKey = rgbaToHex(hexToRgba(from)).slice(1).toLowerCase();
    const toRgba = hexToRgba(to);
    out.set(fromKey, toRgba);
  }
  return out;
};

export const recolorFrames = (src: Project, map: ColorMap): Frame[] =>
  src.frames.map((frame) => {
    const buf = PixelBuffer.decode(src.width, src.height, frame.layers[0]!.pixels);
    const data = buf.data;
    for (let i = 0; i < data.length; i += 4) {
      const key = rgbaToHex([data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!])
        .slice(1)
        .toLowerCase();
      const replacement = map.get(key);
      if (!replacement) continue;
      data[i] = replacement[0];
      data[i + 1] = replacement[1];
      data[i + 2] = replacement[2];
      data[i + 3] = replacement[3];
    }
    return {
      id: randomUUID(),
      durationMs: frame.durationMs,
      layers: [{ pixels: buf.encode() }],
    };
  });
