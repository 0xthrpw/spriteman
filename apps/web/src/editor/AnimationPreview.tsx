import { useEffect, useRef, useState } from 'react';
import { useEditor } from './store.js';

// Reads committed frames only (no in-flight stroke flicker).
// Drives playback from a single rAF loop with accumulator-based FPS timing.
export function AnimationPreview() {
  const frameOrder = useEditor((s) => s.frameOrder);
  const previewExcluded = useEditor((s) => s.previewExcluded);
  const width = useEditor((s) => s.width);
  const height = useEditor((s) => s.height);
  const fps = useEditor((s) => s.fps);
  const setFps = (n: number) => useEditor.setState({ fps: Math.max(1, Math.min(60, n)), dirty: true });
  const bufferRev = useEditor((s) => s.bufferRev);

  const effectiveOrder = frameOrder.filter((id) => !previewExcluded.has(id));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(4);

  const bitmapsRef = useRef<Map<string, ImageBitmap>>(new Map());

  // Rebuild ImageBitmaps whenever committed state changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const buffers = useEditor.getState().buffers;
      const next = new Map<string, ImageBitmap>();
      for (const id of frameOrder) {
        const buf = buffers.get(id);
        if (!buf) continue;
        const bmp = await createImageBitmap(buf.toImageData());
        if (cancelled) {
          bmp.close();
          return;
        }
        next.set(id, bmp);
      }
      // Close old bitmaps
      for (const bmp of bitmapsRef.current.values()) bmp.close();
      bitmapsRef.current = next;
      draw(index);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bufferRev, frameOrder.join(',')]);

  function draw(i: number) {
    const c = canvasRef.current;
    if (!c) return;
    const id = effectiveOrder[i];
    if (!id) return;
    const bmp = bitmapsRef.current.get(id);
    if (!bmp) return;
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bmp, 0, 0);
  }

  useEffect(() => {
    if (!playing || effectiveOrder.length <= 1) {
      draw(Math.min(index, Math.max(0, effectiveOrder.length - 1)));
      return;
    }
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let i = Math.min(index, effectiveOrder.length - 1);
    const step = 1000 / fps;
    function loop(now: number) {
      acc += now - last;
      last = now;
      while (acc >= step) {
        i = (i + 1) % effectiveOrder.length;
        acc -= step;
      }
      draw(i);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      setIndex(i);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, fps, effectiveOrder.join(','), width, height]);

  // redraw on bufferRev when paused
  useEffect(() => {
    if (!playing) draw(Math.min(index, Math.max(0, effectiveOrder.length - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bufferRev, index, playing]);

  return (
    <div className="preview">
      <div className="preview-header">
        <span className="section-label">Preview</span>
        <div className="spacer" />
        <button className="tool" onClick={() => setPlaying((v) => !v)}>
          {playing ? 'Pause' : 'Play'}
        </button>
      </div>
      <canvas
        ref={canvasRef}
        style={{
          imageRendering: 'pixelated',
          width: width * scale,
          height: height * scale,
          background:
            'repeating-conic-gradient(#2a2f3a 0% 25%, #1f232c 0% 50%) 0 0 / 16px 16px',
          display: 'block',
          margin: '0 auto',
        }}
      />
      <div className="preview-controls">
        <label>
          FPS
          <input
            type="number"
            min={1}
            max={60}
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            style={{ width: 64 }}
          />
        </label>
        <label>
          Scale
          <input
            type="range"
            min={1}
            max={8}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
