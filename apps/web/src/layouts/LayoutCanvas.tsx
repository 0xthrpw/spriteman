import { useEffect, useRef, useState } from 'react';
import type { LayoutPlacement } from '@spriteman/shared';
import type { PixelBuffer } from '@spriteman/pixel';
import { bufferKey, computeStampPosition, snapToGrid, useLayout } from './store.js';

type Box = { x: number; y: number; w: number; h: number };

// After applying 90° rotations, the on-canvas AABB dimensions may swap.
function aabb(p: LayoutPlacement, sourceW: number, sourceH: number): Box {
  const rotated = p.rotation === 90 || p.rotation === 270;
  const w = rotated ? sourceH : sourceW;
  const h = rotated ? sourceW : sourceH;
  return { x: p.x, y: p.y, w, h };
}

export function LayoutCanvas() {
  const canvasWidth = useLayout((s) => s.canvasWidth);
  const canvasHeight = useLayout((s) => s.canvasHeight);
  const snapGrid = useLayout((s) => s.snapGrid);
  const placements = useLayout((s) => s.placements);
  const bufferRev = useLayout((s) => s.bufferRev);
  const selectedPlacementId = useLayout((s) => s.selectedPlacementId);
  const viewZoom = useLayout((s) => s.viewZoom);
  const activeStamp = useLayout((s) => s.activeStamp);
  const selectPlacement = useLayout((s) => s.selectPlacement);
  const movePlacement = useLayout((s) => s.movePlacement);
  const addPlacement = useLayout((s) => s.addPlacement);
  const zoomViewIn = useLayout((s) => s.zoomViewIn);
  const zoomViewOut = useLayout((s) => s.zoomViewOut);

  const [stampHover, setStampHover] = useState<{ x: number; y: number } | null>(null);

  const innerRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const dragRef = useRef<{
    pointerId: number;
    placementId: string;
    startCanvasX: number;
    startCanvasY: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);

  const panRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);

  useEffect(() => {
    const c = innerRef.current;
    if (!c) return;
    c.width = canvasWidth;
    c.height = canvasHeight;
    draw(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasWidth, canvasHeight, snapGrid, placements, bufferRev, selectedPlacementId, activeStamp, stampHover]);

  function draw(c: HTMLCanvasElement) {
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = '#1f232c';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    drawGrid(ctx, canvasWidth, canvasHeight, snapGrid);

    const state = useLayout.getState();
    for (const p of placements) {
      const meta = state.projectMeta.get(p.projectId);
      const buf = state.buffers.get(bufferKey(p.projectId, p.frameId));
      if (!meta) {
        drawMissing(ctx, p, 16, 16);
        continue;
      }
      if (!buf) {
        drawMissing(ctx, p, meta.width, meta.height);
        continue;
      }
      drawPlacement(ctx, p, buf);
    }

    if (selectedPlacementId) {
      const p = placements.find((x) => x.id === selectedPlacementId);
      if (p) {
        const meta = state.projectMeta.get(p.projectId);
        const w = meta?.width ?? 16;
        const h = meta?.height ?? 16;
        const box = aabb(p, w, h);
        ctx.strokeStyle = '#6aa6ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
      }
    }

    if (activeStamp && stampHover) {
      const meta = state.projectMeta.get(activeStamp.projectId);
      const buf = state.buffers.get(bufferKey(activeStamp.projectId, activeStamp.frameId));
      if (meta && buf) {
        const { x, y } = computeStampPosition(stampHover.x, stampHover.y, meta.width, meta.height, snapGrid);
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.drawImage(bufferToOffscreen(buf), x, y);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#6aa6ff';
        ctx.setLineDash([3, 2]);
        ctx.strokeRect(x + 0.5, y + 0.5, meta.width - 1, meta.height - 1);
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
  }

  function hitTest(canvasX: number, canvasY: number): LayoutPlacement | null {
    const state = useLayout.getState();
    for (let i = placements.length - 1; i >= 0; i--) {
      const p = placements[i]!;
      const meta = state.projectMeta.get(p.projectId);
      const w = meta?.width ?? 16;
      const h = meta?.height ?? 16;
      const box = aabb(p, w, h);
      if (
        canvasX >= box.x &&
        canvasX < box.x + box.w &&
        canvasY >= box.y &&
        canvasY < box.y + box.h
      ) {
        return p;
      }
    }
    return null;
  }

  function toCanvasCoords(e: React.PointerEvent): { x: number; y: number } {
    const rect = innerRef.current!.getBoundingClientRect();
    // rect.width is the on-screen CSS size (canvasWidth * viewZoom); map back to internal pixel space.
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    // Middle-click anywhere on the canvas = pan the scroll container.
    if (e.pointerType === 'mouse' && e.button === 1) {
      const vp = viewportRef.current;
      if (!vp) return;
      e.preventDefault();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      panRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startScrollLeft: vp.scrollLeft,
        startScrollTop: vp.scrollTop,
      };
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const { x, y } = toCanvasCoords(e);

    // Stamp mode: every click places a new instance. Skips hit-test/selection.
    if (activeStamp) {
      const meta = useLayout.getState().projectMeta.get(activeStamp.projectId);
      if (!meta) return;
      const pos = computeStampPosition(x, y, meta.width, meta.height, snapGrid);
      addPlacement({
        projectId: activeStamp.projectId,
        frameId: activeStamp.frameId,
        x: pos.x,
        y: pos.y,
      });
      return;
    }

    const hit = hitTest(x, y);
    if (!hit) {
      selectPlacement(null);
      return;
    }
    selectPlacement(hit.id);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      placementId: hit.id,
      startCanvasX: x,
      startCanvasY: y,
      offsetX: x - hit.x,
      offsetY: y - hit.y,
      moved: false,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const pan = panRef.current;
    if (pan && pan.pointerId === e.pointerId) {
      const vp = viewportRef.current;
      if (!vp) return;
      vp.scrollLeft = pan.startScrollLeft - (e.clientX - pan.startClientX);
      vp.scrollTop = pan.startScrollTop - (e.clientY - pan.startClientY);
      return;
    }
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId) {
      const { x, y } = toCanvasCoords(e);
      if (!d.moved && Math.abs(x - d.startCanvasX) < 2 && Math.abs(y - d.startCanvasY) < 2) return;
      d.moved = true;
      const nx = snapToGrid(x - d.offsetX, snapGrid);
      const ny = snapToGrid(y - d.offsetY, snapGrid);
      movePlacement(d.placementId, nx, ny);
      return;
    }
    // Track hover position for the stamp preview.
    if (activeStamp) {
      const { x, y } = toCanvasCoords(e);
      setStampHover((prev) => (prev && prev.x === x && prev.y === y ? prev : { x, y }));
    }
  }

  function onPointerLeave() {
    setStampHover(null);
  }

  function onPointerUp(e: React.PointerEvent) {
    if (panRef.current && panRef.current.pointerId === e.pointerId) {
      panRef.current = null;
      return;
    }
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
  }

  // React attaches onWheel as passive, which blocks preventDefault. Bind natively.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    function handler(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      if (e.deltaY < 0) zoomViewIn();
      else if (e.deltaY > 0) zoomViewOut();
    }
    vp.addEventListener('wheel', handler, { passive: false });
    return () => vp.removeEventListener('wheel', handler);
  }, [zoomViewIn, zoomViewOut]);

  return (
    <div ref={viewportRef} className="layouts-canvas-viewport-scroll">
      <div className="layouts-canvas-viewport">
        <canvas
          ref={innerRef}
          className="layouts-canvas"
          style={{
            width: canvasWidth * viewZoom,
            height: canvasHeight * viewZoom,
            imageRendering: 'pixelated',
            touchAction: 'none',
            userSelect: 'none',
            cursor: panRef.current ? 'grabbing' : activeStamp ? 'crosshair' : 'default',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onLostPointerCapture={onPointerUp}
          onPointerLeave={onPointerLeave}
        />
      </div>
    </div>
  );
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, grid: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = grid; x < w; x += grid) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = grid; y < h; y += grid) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.stroke();
  // Emphasize every 4th grid line for readability on large canvases.
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  for (let x = grid * 4; x < w; x += grid * 4) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = grid * 4; y < h; y += grid * 4) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.stroke();
}

function bufferToOffscreen(buf: PixelBuffer): HTMLCanvasElement {
  const off = document.createElement('canvas');
  off.width = buf.width;
  off.height = buf.height;
  off.getContext('2d')!.putImageData(buf.toImageData(), 0, 0);
  return off;
}

function drawPlacement(ctx: CanvasRenderingContext2D, p: LayoutPlacement, buf: PixelBuffer) {
  const w = buf.width;
  const h = buf.height;
  const rotated = p.rotation === 90 || p.rotation === 270;
  const boxW = rotated ? h : w;
  const boxH = rotated ? w : h;

  const off = bufferToOffscreen(buf);
  ctx.save();
  ctx.translate(p.x + boxW / 2, p.y + boxH / 2);
  ctx.rotate((p.rotation * Math.PI) / 180);
  ctx.scale(p.flipX ? -1 : 1, p.flipY ? -1 : 1);
  ctx.drawImage(off, -w / 2, -h / 2);
  ctx.restore();
}

function drawMissing(ctx: CanvasRenderingContext2D, p: LayoutPlacement, w: number, h: number) {
  const rotated = p.rotation === 90 || p.rotation === 270;
  const boxW = rotated ? h : w;
  const boxH = rotated ? w : h;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 77, 143, 0.3)';
  ctx.fillRect(p.x, p.y, boxW, boxH);
  ctx.strokeStyle = '#ff4d8f';
  ctx.lineWidth = 1;
  ctx.strokeRect(p.x + 0.5, p.y + 0.5, boxW - 1, boxH - 1);
  // Diagonal hash
  ctx.beginPath();
  for (let i = -boxH; i < boxW; i += 6) {
    ctx.moveTo(p.x + i, p.y);
    ctx.lineTo(p.x + i + boxH, p.y + boxH);
  }
  ctx.stroke();
  ctx.restore();
}
