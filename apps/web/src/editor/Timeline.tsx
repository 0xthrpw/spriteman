import { Fragment, useEffect, useRef, useState } from 'react';
import { useEditor } from './store.js';

export function Timeline() {
  const frameOrder = useEditor((s) => s.frameOrder);
  const activeFrameId = useEditor((s) => s.activeFrameId);
  const setActiveFrame = useEditor((s) => s.setActiveFrame);
  const moveFrame = useEditor((s) => s.moveFrame);
  const addFrame = useEditor((s) => s.addFrame);
  const duplicateFrame = useEditor((s) => s.duplicateFrame);
  const deleteFrame = useEditor((s) => s.deleteFrame);

  const rowRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<{ id: string; startX: number; pointerId: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const onThumbPointerDown = (e: React.PointerEvent, id: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pendingRef.current = { id, startX: e.clientX, pointerId: e.pointerId };
  };

  const onThumbPointerMove = (e: React.PointerEvent) => {
    const p = pendingRef.current;
    if (!p || p.pointerId !== e.pointerId) return;
    if (draggingId === null) {
      if (Math.abs(e.clientX - p.startX) < 5) return;
      setDraggingId(p.id);
    }
    const row = rowRef.current;
    if (!row) return;
    setDropIndex(computeDropIndex(row, e.clientX));
  };

  const endDrag = (commit: boolean) => {
    const p = pendingRef.current;
    pendingRef.current = null;
    if (commit && p && draggingId && dropIndex !== null) {
      const from = frameOrder.indexOf(draggingId);
      if (from >= 0) {
        const toIndex = dropIndex > from ? dropIndex - 1 : dropIndex;
        if (toIndex !== from) moveFrame(draggingId, toIndex);
      }
    }
    setDraggingId(null);
    setDropIndex(null);
  };

  const onThumbPointerUp = (e: React.PointerEvent) => {
    const p = pendingRef.current;
    if (!p || p.pointerId !== e.pointerId) return;
    endDrag(true);
  };

  const onThumbPointerCancel = (e: React.PointerEvent) => {
    const p = pendingRef.current;
    if (!p || p.pointerId !== e.pointerId) return;
    endDrag(false);
  };

  return (
    <div className="timeline">
      <div className="timeline-row" ref={rowRef}>
        {frameOrder.map((id, i) => (
          <Fragment key={id}>
            {draggingId && dropIndex === i && <div className="drop-indicator" />}
            <FrameThumb
              id={id}
              index={i}
              active={id === activeFrameId}
              dragging={id === draggingId}
              onSelect={() => setActiveFrame(id)}
              onPointerDown={(e) => onThumbPointerDown(e, id)}
              onPointerMove={onThumbPointerMove}
              onPointerUp={onThumbPointerUp}
              onPointerCancel={onThumbPointerCancel}
            />
          </Fragment>
        ))}
        {draggingId && dropIndex === frameOrder.length && <div className="drop-indicator" />}
        <button className="frame-add" onClick={addFrame} title="Add frame">
          +
        </button>
      </div>
      <div className="timeline-actions">
        <button onClick={() => duplicateFrame(activeFrameId)}>Duplicate</button>
        <button onClick={() => deleteFrame(activeFrameId)} disabled={frameOrder.length <= 1} className="danger">
          Delete
        </button>
      </div>
    </div>
  );
}

function computeDropIndex(rowEl: HTMLElement, clientX: number): number {
  const thumbs = Array.from(rowEl.querySelectorAll<HTMLElement>('.frame-thumb'));
  for (let i = 0; i < thumbs.length; i++) {
    const thumb = thumbs[i];
    if (!thumb) continue;
    const r = thumb.getBoundingClientRect();
    if (clientX < r.left + r.width / 2) return i;
  }
  return thumbs.length;
}

type FrameThumbProps = {
  id: string;
  index: number;
  active: boolean;
  dragging: boolean;
  onSelect: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
};

function FrameThumb({
  id,
  index,
  active,
  dragging,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: FrameThumbProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const width = useEditor((s) => s.width);
  const height = useEditor((s) => s.height);
  const bufferRev = useEditor((s) => s.bufferRev);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = width;
    c.height = height;
    const buf = useEditor.getState().buffers.get(id);
    if (!buf) return;
    const ctx = c.getContext('2d')!;
    ctx.putImageData(buf.toImageData(), 0, 0);
  }, [bufferRev, width, height, id]);

  const cls = ['frame-thumb'];
  if (active) cls.push('active');
  if (dragging) cls.push('dragging');

  return (
    <button
      className={cls.join(' ')}
      onClick={onSelect}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
      title={`Frame ${index + 1}`}
    >
      <canvas ref={ref} style={{ imageRendering: 'pixelated', width: 48, height: 48 }} />
      <span>{index + 1}</span>
    </button>
  );
}
