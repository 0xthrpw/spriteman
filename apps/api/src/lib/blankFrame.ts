import { deflate } from 'node:zlib';
import { promisify } from 'node:util';

const deflateAsync = promisify(deflate);

// Returns a base64-encoded, deflated, fully-transparent RGBA buffer of w*h pixels.
export async function makeBlankFrame(w: number, h: number): Promise<string> {
  const raw = new Uint8Array(w * h * 4); // zeroed = transparent
  const compressed = await deflateAsync(raw);
  return Buffer.from(compressed).toString('base64');
}
