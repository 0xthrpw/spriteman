import { useEffect, useRef, useState } from 'react';
import { useEditor, hexToRgba } from './store.js';
import { createStroke, EyedropperStroke, type Stroke } from './tools.js';
import { rgbaToHex } from './pixelBuffer.js';

export function CanvasStack() {
  const state = useEditor();
  const { width, height, zoom } = state;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const onionRef = useRef<HTMLCanvasElement>(null);
  const artRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<HTMLCanvasElement>(null);

  const strokeRef = useRef<Stroke | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  // Draw checkerboard (once per size change)
  useEffect(() => {
    const c = bgRef.current;
    if (!c) return;
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);
    const S = 1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#2a2f3a' : '#1f232c';
        ctx.fillRect(x * S, y * S, S, S);
      }
    }
  }, [width, height]);

  // Draw artwork whenever bufferRev or active frame changes
  useEffect(() => {
    const c = artRef.current;
    if (!c) return;
    c.width = width;
    c.height = height;
    const buf = state.buffers.get(state.activeFrameId);
    if (!buf) return;
    const ctx = c.getContext('2d')!;
    ctx.putImageData(buf.toImageData(), 0, 0);
  }, [state.activeFrameId, state.bufferRev, state.buffers, width, height]);

  // Draw onion skin
  useEffect(() => {
    const c = onionRef.current;
    if (!c) return;
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);
    if (!state.onionSkin) return;
    const idx = state.frameOrder.indexOf(state.activeFrameId);
    const prevId = state.frameOrder[idx - 1];
    if (!prevId) return;
    const prev = state.buffers.get(prevId);
    if (!prev) return;
    ctx.globalAlpha = 0.35;
    ctx.putImageData(prev.toImageData(), 0, 0);
  }, [state.activeFrameId, state.bufferRev, state.onionSkin, state.buffers, state.frameOrder, width, height]);

  // Grid overlay
  useEffect(() => {
    const c = gridRef.current;
    if (!c) return;
    const scale = Math.max(1, zoom);
    c.width = width * scale;
    c.height = height * scale;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!state.showGrid || scale < 4) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x++) {
      ctx.beginPath();
      ctx.moveTo(Math.round(x * scale) + 0.5, 0);
      ctx.lineTo(Math.round(x * scale) + 0.5, height * scale);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y * scale) + 0.5);
      ctx.lineTo(width * scale, Math.round(y * scale) + 0.5);
      ctx.stroke();
    }
  }, [state.showGrid, zoom, width, height]);

  // Pointer handlers
  function pointToPixel(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const c = overlayRef.current!;
    const rect = c.getBoundingClientRect();
    const scale = rect.width / width;
    const x = Math.floor((e.clientX - rect.left) / scale);
    const y = Math.floor((e.clientY - rect.top) / scale);
    return { x, y };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const s = useEditor.getState();
    const buffer = s.buffers.get(s.activeFrameId);
    if (!buffer) return;
    const useEyedropper = e.altKey;
    const stroke = createStroke({
      tool: useEyedropper ? 'eyedropper' : s.tool,
      color: hexToRgba(s.activeColor),
      brushSize: s.brushSize,
      constrain: e.shiftKey,
      buffer,
    });
    const p = pointToPixel(e);
    stroke.begin(p);
    strokeRef.current = stroke;
    if (!stroke.previewOnly) {
      useEditor.setState((st) => ({ bufferRev: st.bufferRev + 1 }));
    }
    drawOverlay();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = pointToPixel(e);
    setHover(p);
    const stroke = strokeRef.current;
    if (!stroke) {
      drawOverlay(p);
      return;
    }
    stroke.move(p);
    if (!stroke.previewOnly) {
      useEditor.setState((st) => ({ bufferRev: st.bufferRev + 1 }));
    }
    drawOverlay(p);
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = strokeRef.current;
    strokeRef.current = null;
    if (!stroke) return;
    if (stroke instanceof EyedropperStroke) {
      if (stroke.picked) {
        const hex = rgbaToHex(stroke.picked);
        useEditor.getState().setActiveColor(hex);
        useEditor.getState().pushRecent(hex);
      }
    } else {
      const diffs = stroke.end();
      const { activeFrameId } = useEditor.getState();
      useEditor.getState().commitPixelStroke(activeFrameId, diffs);
      const s = useEditor.getState();
      s.pushRecent(s.activeColor);
    }
    drawOverlay(pointToPixel(e));
  }

  function drawOverlay(hoverPt?: { x: number; y: number }) {
    const c = overlayRef.current;
    if (!c) return;
    const scale = Math.max(1, zoom);
    c.width = width * scale;
    c.height = height * scale;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    const stroke = strokeRef.current;
    if (stroke?.previewOnly && stroke.renderPreview) {
      stroke.renderPreview(ctx, scale);
    }
    // hover indicator
    const h = hoverPt ?? hover;
    if (h) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(h.x * scale + 0.5, h.y * scale + 0.5, scale - 1, scale - 1);
    }
  }

  // Redraw overlay on hover / zoom change
  useEffect(() => {
    drawOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover, zoom, width, height]);

  const scale = Math.max(1, zoom);
  const dims = { width: width * scale, height: height * scale };
  const layerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    imageRendering: 'pixelated',
    width: dims.width,
    height: dims.height,
    pointerEvents: 'none',
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        width: dims.width,
        height: dims.height,
        background: '#0b0d12',
      }}
    >
      <canvas ref={bgRef} style={layerStyle} />
      <canvas ref={onionRef} style={layerStyle} />
      <canvas ref={artRef} style={layerStyle} />
      <canvas ref={gridRef} style={{ ...layerStyle }} />
      <canvas
        ref={overlayRef}
        style={{ ...layerStyle, pointerEvents: 'auto', cursor: 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
      />
    </div>
  );
}
