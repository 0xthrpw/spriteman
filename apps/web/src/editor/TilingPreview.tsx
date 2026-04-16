import { useEffect, useRef, useState } from 'react';
import { useEditor } from './store.js';

type Mode = 'tile' | 'stamp';

// Tile mode: auto-renders an N×N repeating grid of the current frame.
// Stamp mode: the user can click to stamp the current frame onto a fresh canvas.
export function TilingPreview() {
  const width = useEditor((s) => s.width);
  const height = useEditor((s) => s.height);
  const bufferRev = useEditor((s) => s.bufferRev);
  const activeFrameId = useEditor((s) => s.activeFrameId);

  const [mode, setMode] = useState<Mode>('tile');
  const [repeat, setRepeat] = useState(6);
  const [scale, setScale] = useState(2);
  const [showSeams, setShowSeams] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stampLayerRef = useRef<Uint8ClampedArray | null>(null);

  const canvasWidth = width * repeat;
  const canvasHeight = height * repeat;

  // Tile mode: render N×N copies (with `copy` composite so transparent pixels stay transparent).
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = canvasWidth;
    c.height = canvasHeight;
    const ctx = c.getContext('2d')!;

    // clear to transparent
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const buf = useEditor.getState().buffers.get(activeFrameId);
    if (!buf) return;
    const imgData = buf.toImageData();

    if (mode === 'tile') {
      // Use an offscreen canvas so we can drawImage cleanly
      const off = document.createElement('canvas');
      off.width = width;
      off.height = height;
      off.getContext('2d')!.putImageData(imgData, 0, 0);
      for (let ty = 0; ty < repeat; ty++) {
        for (let tx = 0; tx < repeat; tx++) {
          ctx.drawImage(off, tx * width, ty * height);
        }
      }
      if (showSeams) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        for (let x = width; x < canvasWidth; x += width) {
          ctx.beginPath();
          ctx.moveTo(x + 0.5, 0);
          ctx.lineTo(x + 0.5, canvasHeight);
          ctx.stroke();
        }
        for (let y = height; y < canvasHeight; y += height) {
          ctx.beginPath();
          ctx.moveTo(0, y + 0.5);
          ctx.lineTo(canvasWidth, y + 0.5);
          ctx.stroke();
        }
      }
    } else {
      // stamp mode: restore prior stamps
      if (stampLayerRef.current && stampLayerRef.current.length === canvasWidth * canvasHeight * 4) {
        ctx.putImageData(new ImageData(new Uint8ClampedArray(stampLayerRef.current), canvasWidth, canvasHeight), 0, 0);
      }
    }
  }, [bufferRev, activeFrameId, mode, repeat, width, height, canvasWidth, canvasHeight, showSeams]);

  // reset stamp layer when switching modes or size changes
  useEffect(() => {
    if (mode === 'stamp') {
      stampLayerRef.current = new Uint8ClampedArray(canvasWidth * canvasHeight * 4);
    }
  }, [mode, canvasWidth, canvasHeight]);

  function onStamp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (mode !== 'stamp') return;
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const px = Math.floor(((e.clientX - rect.left) / rect.width) * canvasWidth);
    const py = Math.floor(((e.clientY - rect.top) / rect.height) * canvasHeight);
    const buf = useEditor.getState().buffers.get(activeFrameId);
    if (!buf) return;
    const ctx = c.getContext('2d')!;
    const off = document.createElement('canvas');
    off.width = width;
    off.height = height;
    off.getContext('2d')!.putImageData(buf.toImageData(), 0, 0);
    ctx.drawImage(off, px - Math.floor(width / 2), py - Math.floor(height / 2));
    // persist stamps so they survive re-renders
    stampLayerRef.current = ctx.getImageData(0, 0, canvasWidth, canvasHeight).data;
  }

  function clearStamps() {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext('2d')!.clearRect(0, 0, canvasWidth, canvasHeight);
    stampLayerRef.current = new Uint8ClampedArray(canvasWidth * canvasHeight * 4);
  }

  return (
    <div className="tiling">
      <div className="preview-header">
        <span className="section-label">Tiling test</span>
        <div className="spacer" />
        <button className={mode === 'tile' ? 'tool active' : 'tool'} onClick={() => setMode('tile')}>
          Tile
        </button>
        <button className={mode === 'stamp' ? 'tool active' : 'tool'} onClick={() => setMode('stamp')}>
          Stamp
        </button>
      </div>
      <canvas
        ref={canvasRef}
        onClick={onStamp}
        style={{
          imageRendering: 'pixelated',
          width: canvasWidth * scale,
          height: canvasHeight * scale,
          background:
            'repeating-conic-gradient(#2a2f3a 0% 25%, #1f232c 0% 50%) 0 0 / 16px 16px',
          display: 'block',
          margin: '0 auto',
          cursor: mode === 'stamp' ? 'crosshair' : 'default',
          maxWidth: '100%',
        }}
      />
      <div className="preview-controls">
        <label>
          Repeat
          <input
            type="range"
            min={2}
            max={12}
            value={repeat}
            onChange={(e) => setRepeat(Number(e.target.value))}
          />
          <span>{repeat}×{repeat}</span>
        </label>
        <label>
          Scale
          <input
            type="range"
            min={1}
            max={4}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
          />
        </label>
        {mode === 'tile' && (
          <label>
            <input type="checkbox" checked={showSeams} onChange={(e) => setShowSeams(e.target.checked)} />
            Show seams
          </label>
        )}
        {mode === 'stamp' && (
          <button onClick={clearStamps}>Clear</button>
        )}
      </div>
    </div>
  );
}
