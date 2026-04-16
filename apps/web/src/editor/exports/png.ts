import { useEditor } from '../store.js';
import { downloadBlob } from './download.js';

function renderFrame(width: number, height: number, bufferRev: number, frameId: string, scale: number): Promise<Blob> {
  const buf = useEditor.getState().buffers.get(frameId);
  if (!buf) throw new Error('no buffer');
  const src = document.createElement('canvas');
  src.width = width;
  src.height = height;
  src.getContext('2d')!.putImageData(buf.toImageData(), 0, 0);
  const out = document.createElement('canvas');
  out.width = width * scale;
  out.height = height * scale;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return new Promise((resolve, reject) => {
    out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

export async function exportFramePng(scale = 1) {
  const s = useEditor.getState();
  const blob = await renderFrame(s.width, s.height, s.bufferRev, s.activeFrameId, scale);
  downloadBlob(blob, `${safeName(s.name)}-frame.png`);
}

export async function exportSpritesheetPng({
  cols,
  padding,
  scale,
}: { cols: number; padding: number; scale: number }) {
  const s = useEditor.getState();
  const frames = s.frameOrder;
  const n = frames.length;
  const rows = Math.ceil(n / cols);
  const cellW = s.width * scale + padding;
  const cellH = s.height * scale + padding;
  const canvasW = cols * cellW + padding;
  const canvasH = rows * cellH + padding;

  const out = document.createElement('canvas');
  out.width = canvasW;
  out.height = canvasH;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const src = document.createElement('canvas');
  src.width = s.width;
  src.height = s.height;
  const srcCtx = src.getContext('2d')!;

  frames.forEach((id, i) => {
    const buf = s.buffers.get(id);
    if (!buf) return;
    srcCtx.clearRect(0, 0, s.width, s.height);
    srcCtx.putImageData(buf.toImageData(), 0, 0);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const dx = padding + col * cellW;
    const dy = padding + row * cellH;
    ctx.drawImage(src, dx, dy, s.width * scale, s.height * scale);
  });

  const blob = await new Promise<Blob>((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
  downloadBlob(blob, `${safeName(s.name)}-sheet.png`);
}

function safeName(n: string): string {
  return n.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 80) || 'sprite';
}

export { safeName };
