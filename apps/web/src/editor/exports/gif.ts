import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { useEditor } from '../store.js';
import { downloadBlob } from './download.js';
import { safeName } from './png.js';

// Render each frame to RGBA, run gifenc's quantize+palette to produce an indexed GIF.
// GIF's per-frame delay is in centiseconds, so we round 1000/fps.
export async function exportAnimatedGif({ scale }: { scale: number }) {
  const s = useEditor.getState();
  const w = s.width * scale;
  const h = s.height * scale;
  const delay = Math.max(2, Math.round(100 / s.fps)); // centiseconds

  const gif = GIFEncoder();
  const src = document.createElement('canvas');
  src.width = s.width;
  src.height = s.height;
  const srcCtx = src.getContext('2d')!;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const outCtx = out.getContext('2d')!;
  outCtx.imageSmoothingEnabled = false;

  for (const id of s.frameOrder) {
    const buf = s.buffers.get(id);
    if (!buf) continue;
    srcCtx.putImageData(buf.toImageData(), 0, 0);
    outCtx.clearRect(0, 0, w, h);
    outCtx.drawImage(src, 0, 0, w, h);
    const data = outCtx.getImageData(0, 0, w, h).data;
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, w, h, { palette, delay });
  }
  gif.finish();
  const bytes = gif.bytes();
  // Copy into a fresh ArrayBuffer so TS accepts it as a BlobPart
  const ab = new Uint8Array(bytes.byteLength);
  ab.set(bytes);
  const blob = new Blob([ab.buffer], { type: 'image/gif' });
  downloadBlob(blob, `${safeName(s.name)}.gif`);
}
